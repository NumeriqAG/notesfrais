#!/usr/bin/env node
/*
 * Pilote l'interface mobile reelle dans Chromium et verifie les parcours.
 *
 *   node tools/e2e-mobile.mjs [mike|test]
 *
 * A la difference de screenshot-ui.mjs, qui photographie un ecran fige, ce
 * harnais CLIQUE : il ouvre la feuille de capture, enregistre un frais,
 * enchaine une seconde saisie, importe un CSV UBS, supprime un frais et
 * declenche une soumission. Chaque etape est une assertion.
 *
 * Pourquoi il existe : la compilation JSX de test-patches.js valide la
 * syntaxe, pas la portee. Un identifiant hors portee (nfmAgain dans UBSModal)
 * compile parfaitement et n'explose qu'au clic. C'est cette classe de panne
 * que ce fichier attrape.
 *
 * Le reseau du sandbox ne sert pas les CDN : React/ReactDOM/Babel viennent de
 * .patch-out/vendor et /api/* est simule. Tesseract n'est donc pas joignable —
 * le parcours OCR est exerce jusqu'a sa branche d'echec, qui est justement
 * celle qui doit rester rattrapable a la main.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const channel = process.argv[2] || 'mike';
const OUT = '.patch-out/e2e';
mkdirSync(OUT, { recursive: true });

execSync(`node tools/check-patches.js ${channel}`, { stdio: 'ignore' });
let html = readFileSync(`.patch-out/out-${channel}.html`, 'utf8');
html = html.replace('<head>', `<head>\n<script>window.NOTESFRAIS_CHANNEL=${JSON.stringify(channel)};<\/script>`);
html = html
  .replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/react@[^"]*/, 'vendor/react.js')
  .replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/react-dom@[^"]*/, 'vendor/react-dom.js')
  .replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/@babel\/standalone@[^"]*/, 'vendor/babel.js')
  .replace(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/g, '');
// Le logo est reference en chemin absolu : sous file:// il ne resout pas et la
// carte « Company card » afficherait un placeholder plus haut que le vrai logo.
const logo = readFileSync('logo-numeriq-payroll.png').toString('base64');
html = html.replace(/\/logo-numeriq-payroll\.png/g, `data:image/png;base64,${logo}`);
// Ce conteneur n'a que DejaVu Sans : `-apple-system` n'y resout rien et les
// captures montrent une police bien plus large et lourde que ce qu'affichera
// l'iPhone. On declare Inter — metriquement proche de SF Pro — sous le nom
// « SF Pro Text », 3e de la pile CSS, pour que l'apercu ne mente pas.
// C'est un artifice d'apercu : rien de tout cela n'est envoye en production.
const PREVIEW_FONT = `<style>
@font-face{font-family:"SF Pro Text";src:url("vendor/inter-latin.woff2") format("woff2");font-weight:100 900;font-display:block}
@font-face{font-family:"SF Pro Display";src:url("vendor/inter-latin.woff2") format("woff2");font-weight:100 900;font-display:block}
@font-face{font-family:"Segoe UI";src:url("vendor/inter-latin.woff2") format("woff2");font-weight:100 900;font-display:block}
</style>`;
if (existsSync('.patch-out/vendor/inter-latin.woff2')) {
  html = html.replace('</head>', PREVIEW_FONT + '</head>');
} else {
  console.log('  (police d apercu absente : les captures utiliseront DejaVu, bien plus large que SF Pro)');
  console.log('  curl -sL -o .patch-out/vendor/inter-latin.woff2 <woff2 Inter latin>');
}
writeFileSync('.patch-out/e2e.html', html);

const today = '2026-08';
const expense = (id, day, merchant, amount, cat, status, note = '') => ({
  id, date: `${today}-${String(day).padStart(2, '0')}`, merchant,
  amount, amount_chf: amount, tva: +(amount * 0.077).toFixed(2),
  category: cat, currency: 'CHF', status, note,
  ubs_label: status === 'reconciled' ? merchant.toUpperCase() : '',
  ubs_date: status === 'reconciled' ? `${today}-${String(day).padStart(2, '0')}` : null,
  amt_diff: 0, receipt_url: null, receipt_name: null, receipt_items: [],
  app_channel: channel, submission_status: 'pending', submitted_at: null
});

const rows = [
  expense(1, 3, 'Brasserie de la Paix', 67.2, 'repas', 'reconciled', 'Payment card: company'),
  expense(2, 5, 'SBB CFF Billetterie', 48, 'transport', 'reconciled', 'Payment card: company'),
  expense(3, 11, 'Ibis Budget Lausanne', 89, 'hotel', 'pending', 'Payment card: personal'),
  expense(4, 14, 'Coop Supermarche', 43.6, 'repas', 'pending', 'Payment card: company')
];

// Journal des appels API : c'est la preuve qu'un clic a bien agi.
const calls = [];
let nextId = 100;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox']
});
const page = await browser.newPage({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2, isMobile: true, hasTouch: true
});

const errors = [];
page.on('pageerror', e => errors.push(String(e).split('\n')[0].slice(0, 200)));

await page.route('**/api/**', async route => {
  const req = route.request();
  const url = new URL(req.url());
  const method = req.method();
  let body = null;
  try { body = req.postData() ? JSON.parse(req.postData()) : null; } catch (_) {}
  calls.push({ method, path: url.pathname, body });
  const json = payload => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });

  if (url.pathname === '/api/session') {
    return json({ ok: true, session: { user: { id: 'mike', email: 'mike@numeriq.ch' } },
                  profile: { role: 'user', app_channel: channel } });
  }
  if (url.pathname === '/api/receipts') return json({ ok: true, url: 'about:blank' });
  if (url.pathname === '/api/monthly-submission') {
    await new Promise(r => setTimeout(r, 2500));   // laisse voir les 3 etapes
    return json({ ok: true, submitted: rows.length });
  }
  if (url.pathname === '/api/expenses') {
    if (method === 'POST') {
      const created = { ...rows[0], ...body, id: ++nextId,
                        date: body.date || `${today}-19`, submission_status: 'pending' };
      rows.push(created);
      return json({ ok: true, data: created });
    }
    if (method === 'DELETE') {
      const id = Number(url.searchParams.get('id'));
      const i = rows.findIndex(r => r.id === id);
      if (i >= 0) rows.splice(i, 1);
      return json({ ok: true, data: null });
    }
    if (method === 'PATCH') return json({ ok: true, data: null });
    const from = url.searchParams.get('from') || '';
    return json({ ok: true, data: from.startsWith(today) ? rows : [] });
  }
  return json({ ok: true, data: [] });
});

// ── Assertions ────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail && !ok ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};
const shot = name => page.screenshot({ path: `${OUT}/${channel}-${name}.png` });
const since = n => calls.slice(n);

await page.goto(`file://${process.cwd()}/.patch-out/e2e.html`, { waitUntil: 'load' });
await page.waitForTimeout(6000);

// ── 1 · La feuille de capture ─────────────────────────────────────────
console.log('\n1. Feuille de capture');
// Deux CTA coexistent (#mike-scan-cta et #test-scan-cta) ; un seul est visible.
const openCapture = async () => {
  for (const sel of ['#test-scan-cta', '#mike-scan-cta', 'button:has-text("+ Add expense")']) {
    const el = page.locator(sel).first();
    if (await el.count() && await el.isVisible()) { await el.click({ force: true }); return true; }
  }
  return false;
};
check('un CTA de capture est visible', await openCapture());
await page.waitForTimeout(1500);

const sheet = page.locator('[data-nfm-capture]');
check('la feuille s ouvre', await sheet.count() === 1);
check('elle est portee sur <body>',
  await page.evaluate(() => {
    const el = document.querySelector('[data-nfm-capture]');
    return !!el && el.parentElement === document.body;
  }));

const footBox = await page.locator('.nfm-sheet-foot').boundingBox();
const vh = page.viewportSize().height;
check('le pied touche le bas de l ecran',
  !!footBox && Math.abs(footBox.y + footBox.height - vh) < 2,
  footBox ? `bas du pied a ${Math.round(footBox.y + footBox.height)} / ${vh}` : 'pied absent');

check('Save est desactive sans carte',
  await page.locator('.nfm-sheet-bar button.nfm-strong').isDisabled());
check('l erreur explique pourquoi',
  (await page.locator('.nfm-err').innerText()).includes('card'));

// ── 2 · Photo + OCR ───────────────────────────────────────────────────
console.log('\n2. Photo et OCR');
await page.setInputFiles('[data-nfm-capture] input[type=file]', {
  name: 'recu-coop.png', mimeType: 'image/png',
  // 1x1 PNG : Tesseract n'est pas joignable hors ligne, on exerce la branche d echec
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
});
await page.waitForTimeout(4000);
check('la photo est affichee', await page.locator('.nfm-shot').count() === 1);
check('le nom du fichier est visible',
  (await page.locator('.nfm-shot-name').innerText()).includes('recu-coop'));
const ocrLabel = await page.locator('.nfm-ocr-l').innerText();
check('l etat de lecture est annonce', ocrLabel.length > 0, ocrLabel);
if (/Could not read|failed/i.test(ocrLabel) || await page.locator('.nfm-note-amber').count()) {
  check('l echec d OCR rassure sur la photo',
    (await page.locator('.nfm-note-amber').innerText()).includes('photo is kept'));
}
await shot('01-capture');

// ── 3 · Enregistrer ───────────────────────────────────────────────────
console.log('\n3. Enregistrer un frais');
await page.locator('.nfm-row input.nfm-amount').fill('42.50');
await page.locator('.nfm-row input.nfm-vat').fill('3.27');
await page.locator('.nfm-row input[placeholder="Not filled yet"]').fill('Migros Geneve');
await page.locator('.nfm-card:has-text("Company card")').click();
await page.waitForTimeout(300);
// La categorie par defaut est « Meals » : meal-context.js rend « avec qui »
// obligatoire des la premiere saisie.
const meal = page.locator('[data-nfm-capture] input[placeholder="Add a name"]');
check('le champ « avec qui » apparait sur un repas', await meal.count() === 1);
if (await meal.count()) { await meal.scrollIntoViewIfNeeded(); await meal.fill('client Lausanne'); }
check('Save devient actif une fois la carte choisie',
  !(await page.locator('.nfm-sheet-bar button.nfm-strong').isDisabled()));
check('l erreur disparait', await page.locator('.nfm-err').count() === 0);

let mark = calls.length;
await page.locator('.nfm-btn-quiet:has-text("Save and add another")').click();
await page.waitForTimeout(3000);
const posted = since(mark).filter(c => c.method === 'POST' && c.path === '/api/expenses');
check('le frais est envoye', posted.length === 1, `${posted.length} POST`);
check('le montant part correct', posted[0] && Number(posted[0].body.amount_chf) === 42.5,
  posted[0] ? String(posted[0].body.amount_chf) : '-');
check('la carte part avec', posted[0] && /company/i.test(posted[0].body.note || ''),
  posted[0] ? JSON.stringify(posted[0].body.note) : '-');
check('la feuille reste ouverte', await page.locator('[data-nfm-capture]').count() === 1);
check('le montant est vide pour la saisie suivante',
  (await page.locator('.nfm-row input.nfm-amount').inputValue()) === '');
check('le commercant est vide',
  (await page.locator('.nfm-row input[placeholder="Not filled yet"]').inputValue()) === '');
check('la photo precedente est retiree', await page.locator('.nfm-hero').count() === 1);
await shot('02-apres-enchainement');

// ── 4 · Sortie normale ────────────────────────────────────────────────
console.log('\n4. Enregistrer et fermer');
await page.locator('.nfm-row input.nfm-amount').fill('12.00');
await page.locator('.nfm-row input[placeholder="Not filled yet"]').fill('Parking Rive');
await page.locator('.nfm-card:has-text("Personal card")').click();
// La categorie est conservee d'une saisie a l'autre : le repas exige a nouveau
// « avec qui ». C'est ce qui prouve que nfmReset() ne remet pas tout a zero.
const meal2 = page.locator('[data-nfm-capture] input[placeholder="Add a name"]');
check('la categorie est conservee apres l enchainement', await meal2.count() === 1);
if (await meal2.count()) { await meal2.scrollIntoViewIfNeeded(); await meal2.fill('client Geneve'); }
mark = calls.length;
await page.locator('.nfm-btn-primary:has-text("Save expense")').click();
await page.waitForTimeout(3000);
const blocked = await page.locator('[data-nfm-capture] .nfm-note-red').count()
  ? await page.locator('[data-nfm-capture] .nfm-note-red').innerText() : '';
check('second frais envoye',
  since(mark).filter(c => c.method === 'POST' && c.path === '/api/expenses').length === 1,
  blocked || 'aucun POST, aucune erreur affichee');
check('la feuille se ferme', await page.locator('[data-nfm-capture]').count() === 0);
check('la liste s est allongee',
  (await page.locator('.nf-ios-expense-row').count()) >= 6,
  String(await page.locator('.nf-ios-expense-row').count()));
await shot('03-liste');

// ── 5 · Import UBS — la regression corrigee ───────────────────────────
console.log('\n5. Import UBS');
const errBefore = errors.length;
await page.locator('#test-bottom-nav button:has-text("UBS")').first().click({ force: true });
await page.waitForTimeout(1800);
await shot('04-ubs-onglet');
// Plusieurs boutons UBS coexistent : le bloc desktop n'est pas masque sur l'UI
// anglaise (mobile-cleanup.js ne matche que le libelle francais). On prend le visible.
const ubsAll = page.locator('button').filter({ hasText: /Import (a new )?UBS statement/ });
let ubsClicked = false;
for (let i = 0; i < await ubsAll.count(); i++) {
  const b = ubsAll.nth(i);
  if (await b.isVisible()) { await b.click({ force: true }); ubsClicked = true; break; }
}
check('le point d entree UBS est cliquable', ubsClicked,
  `${await ubsAll.count()} bouton(s), aucun visible`);
await page.waitForTimeout(1500);
const csv = [
  'Date de transaction;Description;Montant;Devise',
  '03.08.2026;BRASSERIE DE LA PAIX GENEVE;-67.20;CHF',
  '05.08.2026;CFF BILLET LAUSANNE;-48.00;CHF',
  '12.08.2026;PARKING RIVE;-8.50;CHF'
].join('\n');
const fileInputs = page.locator('input[type=file]');
await fileInputs.last().setInputFiles({ name: 'ubs.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') });
await page.waitForTimeout(1800);
const importBtn = page.locator('button').filter({ hasText: /Import(er)? \d+/ }).first();
check('le CSV est analyse', await importBtn.count() === 1);
if (await importBtn.count()) {
  await shot('04-ubs-apercu');
  await importBtn.click({ force: true });
  await page.waitForTimeout(1800);
}
check('l import ne leve aucune erreur',
  errors.length === errBefore,
  errors.slice(errBefore).join(' | '));
check('la modale UBS est fermee',
  await page.locator('button').filter({ hasText: /Import(er)? \d+/ }).count() === 0);
await shot('05-apres-ubs');

// ── 6 · Suppression ───────────────────────────────────────────────────
console.log('\n6. Suppression');
await page.locator('#test-bottom-nav button:has-text("Expenses")').first().click({ force: true });
await page.waitForTimeout(1500);
mark = calls.length;
await page.locator('.nf-ios-expense-actions button').last().click({ force: true });
await page.waitForTimeout(900);
const del = page.locator('[data-nf-delete-confirm]');
check('la confirmation s ouvre', await del.count() === 1);
check('elle est portee sur <body>',
  await page.evaluate(() => {
    const el = document.querySelector('[data-nf-delete-confirm]');
    return !!el && el.parentElement === document.body;
  }));
const panel = await page.locator('[data-nf-delete-confirm] .nfm-del-actions').boundingBox();
check('les boutons sont dans le bas de l ecran',
  !!panel && panel.y + panel.height > vh - 90,
  panel ? `bas a ${Math.round(panel.y + panel.height)} / ${vh}` : 'absent');
check('elle previent que le justificatif part avec',
  (await page.locator('.nfm-del-s').innerText()).length > 40);
check('aucune suppression avant confirmation',
  since(mark).every(c => c.method !== 'DELETE'));
await shot('06-suppression');

await page.locator('.nfm-del-keep').click({ force: true });
await page.waitForTimeout(800);
check('« garder » referme sans supprimer',
  await page.locator('[data-nf-delete-confirm]').count() === 0 &&
  since(mark).every(c => c.method !== 'DELETE'));

const before = await page.locator('.nf-ios-expense-row').count();
await page.locator('.nf-ios-expense-actions button').last().click({ force: true });
await page.waitForTimeout(900);
mark = calls.length;
await page.locator('.nfm-del-go').click({ force: true });
await page.waitForTimeout(2500);
check('la confirmation supprime pour de bon',
  since(mark).some(c => c.method === 'DELETE' && c.path === '/api/expenses'));
check('la ligne disparait de la liste',
  (await page.locator('.nf-ios-expense-row').count()) === before - 1,
  `${await page.locator('.nf-ios-expense-row').count()} au lieu de ${before - 1}`);

// ── 7 · Soumission ────────────────────────────────────────────────────
console.log('\n7. Soumission du mois');
// Le lien d'ajout manuel vit dans la meme carte que le bouton de soumission.
const addLink = page.locator('.nfm-add-link');
check('le lien « + Add expense » est present', await addLink.count() === 1);
if (await addLink.count()) {
  await addLink.click({ force: true });
  await page.waitForTimeout(1500);
  check('il ouvre la feuille de capture', await page.locator('[data-nfm-capture]').count() === 1);
  await page.locator('.nfm-sheet-bar button:has-text("Cancel")').click({ force: true });
  await page.waitForTimeout(1200);
  const keep = page.locator('button:has-text("Keep as draft"), button:has-text("Discard")').first();
  if (await keep.count() && await keep.isVisible()) { await keep.click({ force: true }); await page.waitForTimeout(900); }
}
check('le bandeau de contexte est au-dessus de la liste', await page.locator('.nfm-strip').count() === 1);

mark = calls.length;
await page.locator('[data-user-submit-placement] > button:not(.nfm-add-link)').click({ force: true });
await page.waitForTimeout(700);
const summaryBtn = page.locator('button').filter({ hasText: /^(Submit|Confirm|Send)/ }).last();
if (await page.locator('.nfm-bottom-sheet').count() && await summaryBtn.count()) {
  await summaryBtn.click({ force: true });
  await page.waitForTimeout(700);
}
const prog = page.locator('.nfm-progress');
check('la progression apparait', await prog.count() === 1);
if (await prog.count()) {
  check('elle est portee sur <body>',
    await page.evaluate(() => document.querySelector('.nfm-progress').parentElement === document.body));
  const steps = await page.locator('.nfm-step-l').allInnerTexts();
  check('les trois etapes sont nommees', steps.length === 3, steps.join(' / '));
  check('une etape est active', await page.locator('.nfm-step.nfm-active').count() === 1);
  await shot('07-soumission');
}
await page.waitForTimeout(4000);
check('la soumission part vers l API',
  since(mark).some(c => c.path === '/api/monthly-submission'));
await shot('08-soumis');

// ── Bilan ─────────────────────────────────────────────────────────────
const real = errors.filter(e => !e.includes('ServiceWorkerRegistration'));
check('aucune erreur JS sur tout le parcours', real.length === 0, real.join(' | '));

console.log(`\n${fail === 0 ? 'OK' : 'ECHEC'} — ${pass}/${pass + fail} verifications (canal ${channel})`);
console.log(`captures : ${OUT}/`);
await browser.close();
process.exit(fail === 0 ? 0 : 1);
