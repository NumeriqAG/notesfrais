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
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

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
// Idem pour le logo Numeriq Payroll (connexion, espace finance).
for (const file of ['logo-numeriq-mark.png', 'logo-numeriq-payroll-full.png']) {
  const b64 = readFileSync(file).toString('base64');
  html = html.split('/' + file).join(`data:image/png;base64,${b64}`);
}
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
  // Note au format qu'ecrivait l'edition avant octobre 2026 : il y en a en base.
  expense(3, 11, 'Ibis Budget Lausanne', 89, 'hotel', 'pending', 'Carte utilisee: perso'),
  expense(4, 14, 'Coop Supermarche', 43.6, 'repas', 'pending', 'Payment card: company')
];
// La finance a pose une question sur l'hotel et l'a marque « a corriger ».
rows[2].review_status = 'to_fix';
rows[2].comments = [
  { id: 'c1', at: `${today}-15T09:00:00.000Z`, role: 'finance', email: 'finance@numeriq.ch', kind: 'status', review_status: 'to_fix' },
  { id: 'c2', at: `${today}-15T09:00:00.000Z`, role: 'finance', email: 'finance@numeriq.ch', kind: 'comment', body: 'Was this a client visit? Please add the client name in the note.' }
];

// Journal des appels API : c'est la preuve qu'un clic a bien agi.
const calls = [];
let nextId = 100;

// Servi en http://127.0.0.1 et non plus en file:// : les Chromium recents
// refusent fetch('/api/...') sous file:// (« URL scheme "file" is not
// supported ») avant meme que page.route() puisse l'intercepter, et l'app
// restait bloquee sur l'ecran de connexion.
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = createServer((req, res) => {
  const rel = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  if (rel.startsWith('..')) { res.statusCode = 403; return res.end(); }
  try {
    const body = readFileSync(join('.patch-out', rel));
    res.setHeader('Content-Type', TYPES[extname(rel)] || 'application/octet-stream');
    res.end(body);
  } catch (_) { res.statusCode = 404; res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({
  // Le chemin depend de l'image du conteneur : on prend le premier qui existe.
  executablePath: ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium']
    .find(p => existsSync(p)),
  args: ['--no-sandbox']
});
const page = await browser.newPage({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2, isMobile: true, hasTouch: true
});

// L'app ouvre le mois courant : sans horloge figee, les frais d'aout ne
// s'affichent plus des septembre et tout le parcours echoue. L'horloge suit
// son cours a partir de cette date ; la section 8 la deplace en 2027.
await page.clock.install({ time: new Date(`${today}-20T10:00:00`) });

const errors = [];
page.on('pageerror', e => errors.push(String(e).split('\n')[0].slice(0, 200)));

// Tesseract n'est de toute facon pas joignable ici : on coupe net pour que la
// branche d'echec s'exerce tout de suite au lieu d'attendre le timeout de 90 s.
await page.route('**/tesseract*', route => route.abort());

// Etat simule de /api/month-review et role de la session : la section 9
// rejoue la decision de la finance, puis ce que Mike en voit.
let role = 'user';
const reviews = {};

const apiHandler = async route => {
  const req = route.request();
  const url = new URL(req.url());
  const method = req.method();
  let body = null;
  try { body = req.postData() ? JSON.parse(req.postData()) : null; } catch (_) {}
  calls.push({ method, path: url.pathname, query: url.search, body });
  const json = payload => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });

  if (url.pathname === '/api/session') {
    return json({ ok: true, session: { user: { id: 'mike', email: 'mike@numeriq.ch' } },
                  profile: { role, app_channel: role === 'finance' ? 'all' : channel } });
  }
  if (url.pathname === '/api/month-review') {
    if (method === 'GET') return json({ ok: true, data: Object.values(reviews) });
    const { month, action, note = '' } = body || {};
    const inMonth = r => String(r.date).startsWith(month);
    const decided_at = new Date().toISOString();
    if (action === 'approve') reviews[month] = { app_channel: channel, month, status: 'approved', note, decided_at };
    if (action === 'reimburse') reviews[month] = { ...reviews[month], status: 'reimbursed', decided_at };
    if (action === 'undo') {
      if (reviews[month] && reviews[month].status === 'reimbursed') reviews[month] = { ...reviews[month], status: 'approved' };
      else delete reviews[month];
    }
    if (action === 'send_back') {
      reviews[month] = { app_channel: channel, month, status: 'sent_back', note, decided_at };
      rows.filter(inMonth).forEach(r => { r.submission_status = 'pending'; r.submitted_at = null; });
    }
    return json({ ok: true, month, action, review: reviews[month] || null });
  }
  if (url.pathname === '/api/receipts') return json({ ok: true, url: 'about:blank' });
  if (url.pathname === '/api/expense-comments') {
    const row = rows.find(r => r.id === Number(body && body.expense_id));
    if (!row) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Expense not found' }) });
    row.comments = [...(row.comments || []), { id: 'c' + (++nextId), at: new Date().toISOString(),
      role: 'user', email: 'mike@numeriq.ch', kind: 'comment', body: body.body }];
    return json({ ok: true, data: { id: row.id, comments: row.comments, review_status: row.review_status || 'ok' } });
  }
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
    const from = (url.searchParams.get('from') || '').slice(0, 7);
    return json({ ok: true, data: from ? rows.filter(r => String(r.date).startsWith(from)) : [] });
  }
  return json({ ok: true, data: [] });
};
await page.route('**/api/**', apiHandler);

// ── Assertions ────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail && !ok ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};
// Ouvre la fiche d'un frais comme le doigt : un clic sur la ligne, hors boutons.
const openDetail = async row => { await row.evaluate(el => el.click()); await page.waitForTimeout(700); };
const shot = name => page.screenshot({ path: `${OUT}/${channel}-${name}.png` });
const since = n => calls.slice(n);

await page.goto(`${BASE}/e2e.html`, { waitUntil: 'load' });
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

// capture="environment" n'ouvre que la camera sur iOS : les deux autres
// sources doivent etre de vrais boutons, et l'entree ne doit pas naitre bridee.
check('une seule autre source est proposee',
  await page.locator('.nfm-hero-alt button').count() === 1);
check('elle mene aux fichiers', await page.locator('[data-nfm-source="files"]').count() === 1);
check('l entree fichier n est pas bridee sur la camera',
  await page.evaluate(() => {
    const el = document.querySelector('[data-nfm-capture] input[type=file]');
    return !!el && !el.hasAttribute('capture');
  }));
await page.locator('[data-nfm-source="files"]').click({ force: true });
await page.waitForTimeout(400);
check('elle accepte photos et PDF sans forcer la camera',
  await page.evaluate(() => {
    const el = document.querySelector('[data-nfm-capture] input[type=file]');
    return !!el && !el.hasAttribute('capture') && /application\/pdf/.test(el.accept);
  }));
await page.locator('.nfm-hero').click({ force: true });
await page.waitForTimeout(400);
check('« Take a photo » ouvre bien la camera',
  await page.evaluate(() => {
    const el = document.querySelector('[data-nfm-capture] input[type=file]');
    return !!el && el.getAttribute('capture') === 'environment';
  }));

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
check('l echec d OCR est annonce', /Could not read/i.test(ocrLabel), ocrLabel);
await page.waitForTimeout(9000);
// Mike lit d'abord une phrase simple ; le diagnostic est replie dessous,
// toujours dans la page. On photographie l'etat replie, puis on l'ouvre.
const amberShort = await page.locator('.nfm-note-amber').innerText();
check('il rassure sur la photo', amberShort.includes('photo is kept'));
check('le diagnostic est replie par defaut',
  !/importScripts/.test(amberShort) && await page.locator('.nfm-ocr-details').count() === 1,
  amberShort.replace(/\s+/g, ' ').slice(0, 160));
await shot('01-capture');
await page.locator('.nfm-ocr-details > summary').click({ force: true });
await page.waitForTimeout(300);
const amber = await page.locator('.nfm-note-amber').innerText();
// Sans la cause, la meme panne se represente et personne ne sait pourquoi.
// L'etape est ce qui situe la panne quand l'erreur remontee est vide.
check('il nomme l etape', /(loading Tesseract|preprocessing image|reading|extracting)/.test(amber),
  amber.replace(/\s+/g, ' ').slice(0, 160));
check('il decrit l erreur', /\u2192\s*\S/.test(amber),
  amber.replace(/\s+/g, ' ').slice(0, 160));
// La sonde du worker blob: et l'identifiant de build voyagent avec la cause :
// sans eux on ne distingue pas un correctif inefficace d'un shell perime.
check('il sonde l importScripts du worker', /importScripts /.test(amber),
  amber.replace(/\s+/g, ' ').slice(0, 200));
check('il sonde le worker blob:', /blob worker (OK|BLOCKED)/.test(amber),
  amber.replace(/\s+/g, ' ').slice(0, 140));
check('il donne le build', /build \d{4}-\d{2}-\d{2}/.test(amber),
  amber.replace(/\s+/g, ' ').slice(0, 140));
await shot('01b-capture-diagnostic');

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

// Le releve se lance aussi depuis la carte du mois, sans passer par l'onglet.
await page.locator('#test-bottom-nav button:has-text("Expenses")').first().click({ force: true });
await page.waitForTimeout(1200);
const ubsCell = page.locator('[data-nf-ubs-open]');
check('la carte du mois resume le rapprochement UBS',
  /\d+ of \d+ matched/.test(await ubsCell.innerText().catch(() => '')),
  await ubsCell.innerText().catch(() => 'cellule absente'));
await ubsCell.click({ force: true });
await page.waitForTimeout(900);
check('elle ouvre l import UBS', await page.locator('text=Drop your UBS CSV here').count() >= 1);
await page.keyboard.press('Escape');
await page.locator('button').filter({ hasText: /^(Cancel|Close|×|✕)$/ }).first().click({ force: true, timeout: 1500 }).catch(() => {});
await page.waitForTimeout(600);

// ── 6a · Modification ─────────────────────────────────────────────────
// L'edition ecrivait « Carte utilisee: entreprise » quand tout le reste lit
// « Payment card: company » : un frais modifie perdait son badge de carte.
console.log('\n6a. Modification');
await page.locator('#test-bottom-nav button:has-text("Expenses")').first().click({ force: true });
await page.waitForTimeout(1500);
const ibis = page.locator('.nf-ios-expense-row').filter({ hasText: 'Ibis' }).first();
check('une note deja en base garde son badge de carte',
  /Personal card/.test(await ibis.innerText().catch(() => '')),
  (await ibis.innerText().catch(() => 'ligne absente')).replace(/\s+/g, ' ').slice(0, 120));
check('elle n affiche pas la mention brute',
  !/Carte utilisee/.test(await ibis.innerText().catch(() => '')));
// Une ligne ouvre la fiche du frais ; Edit et Delete y vivent desormais.
check('la liste est groupee par jour', await page.locator('.nfm-daylist .nfm-day').count() >= 3,
  String(await page.locator('.nfm-daylist .nfm-day').count()));
await openDetail(ibis);
const detail = page.locator('[data-nf-detail]');
check('une ligne ouvre la fiche du frais', await detail.count() === 1);
check('la fiche montre la carte et la TVA',
  /Personal card/.test(await detail.innerText().catch(() => '')) && /VAT/.test(await detail.innerText().catch(() => '')));
await shot('06a-fiche');
mark = calls.length;
await detail.locator('[data-nf-act="edit"]').click({ force: true });
await page.waitForTimeout(1200);
check('Edit referme la fiche', await page.locator('[data-nf-detail]').count() === 0);
const saveEdit = page.locator('button:has-text("Save changes")').first();
check('la fiche de modification s ouvre', await saveEdit.count() === 1);
if (await saveEdit.count()) {
  await saveEdit.click({ force: true });
  await page.waitForTimeout(2000);
  const patch = since(mark).find(c => c.method === 'PATCH' && c.path === '/api/expenses');
  const note = String(patch && (patch.body?.note ?? patch.body?.updates?.note ?? JSON.stringify(patch.body)) || '');
  check('la modification part vers l API', !!patch);
  check('elle enregistre la carte au format lu partout', /Payment card: personal/.test(note), note.slice(0, 120));
}

// ── 6b · Commentaires de la finance ───────────────────────────────────
console.log('\n6b. Commentaires');
await page.locator('#test-bottom-nav button:has-text("Expenses")').first().click({ force: true });
await page.waitForTimeout(1500);
const ibisRow = page.locator('.nf-ios-expense-row').filter({ hasText: 'Ibis' }).first();
check('le badge « To fix » est visible sur la carte', await ibisRow.locator('[data-nf-to-fix]').isVisible().catch(() => false));
check('le nombre de commentaires est affiche',
  /1/.test(await ibisRow.locator('[data-nf-comment-count]').innerText().catch(() => '')));
check('une carte sans commentaire n a pas de badge',
  await page.locator('.nf-ios-expense-row').filter({ hasText: 'SBB' }).locator('.nf-review-chips').count() === 0);
await shot('06b-carte-a-corriger');
await openDetail(ibisRow);
await page.locator('[data-nf-detail] [data-nf-comments-open]').click({ force: true });
await page.waitForTimeout(800);
const thread = page.locator('[data-nf-comments-sheet]');
check('le fil s ouvre', await thread.count() === 1);
check('il est porte sur <body>',
  await page.evaluate(() => document.querySelector('[data-nf-comments-sheet]')?.parentElement === document.body));
check('la question de la finance est lisible',
  /client visit/.test(await thread.innerText().catch(() => '')));
check('le bandeau de correction est affiche', await page.locator('[data-nf-to-fix-banner]').count() === 1);
check('l employe ne peut pas lever le statut', await page.locator('[data-nf-resolve]').count() === 0);
mark = calls.length;
await page.locator('[data-nf-comment-input]').fill('Yes, lunch with Acme SA. Note updated.');
await page.locator('[data-nf-comment-send]').click({ force: true });
await page.waitForTimeout(1200);
const sent = since(mark).find(c => c.method === 'POST' && c.path === '/api/expense-comments');
check('la reponse part vers l API', !!sent && /Acme/.test(sent.body?.body || ''));
check('elle ne tente pas de changer le statut', !!sent && !('review_status' in (sent.body || {})));
check('elle apparait dans le fil', await page.locator('[data-nf-comment]').count() === 2);
await shot('06b-fil');
await page.locator('[data-nf-comments-sheet] button[aria-label="Close comments"]').click({ force: true });
await page.waitForTimeout(600);
check('fermer le fil ramene a la fiche', await page.locator('[data-nf-detail]').count() === 1);
await page.locator('[data-nf-detail-close]').click({ force: true });
await page.waitForTimeout(500);
check('le compteur passe a 2',
  /2/.test(await ibisRow.locator('[data-nf-comment-count]').innerText().catch(() => '')));

// ── 6 · Suppression ───────────────────────────────────────────────────
console.log('\n6. Suppression');
await page.locator('#test-bottom-nav button:has-text("Expenses")').first().click({ force: true });
await page.waitForTimeout(1500);
mark = calls.length;
await openDetail(page.locator('.nf-ios-expense-row').last());
await page.locator('[data-nf-detail] [data-nf-act="delete"]').click({ force: true });
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
await openDetail(page.locator('.nf-ios-expense-row').last());
await page.locator('[data-nf-detail] [data-nf-act="delete"]').click({ force: true });
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
// Un seul bouton d'ajout : « Scan receipt » ouvre la meme feuille, saisie
// manuelle comprise. Le lien « + Add expense » reste dans le DOM (sticky-nav
// le cherche par son texte) mais n'est plus affiche.
const addLink = page.locator('.nfm-add-link');
check('le lien « + Add expense » n est plus affiche en double',
  await addLink.count() === 1 && !(await addLink.isVisible()));
{
  await openCapture();
  await page.waitForTimeout(1500);
  check('le bouton photo ouvre la feuille de capture', await page.locator('[data-nfm-capture]').count() === 1);
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

// ── 8 · Changement d'annee ────────────────────────────────────────────
// MONTHS etait la liste litterale des mois de 2026. Au 1er janvier 2027 l'app
// devait suivre le calendrier ET laisser soumettre decembre 2026.
console.log("\n8. Changement d'annee");
rows.push(expense(900, 3, 'Hotel Bellevue', 210, 'hotel', 'pending', 'Payment card: company'));
rows[rows.length - 1].date = '2026-12-18';
await page.clock.setSystemTime(new Date('2027-01-12T10:00:00'));
mark = calls.length;
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(6000);
const monthSelect = page.locator('[data-period-selector] select').first();
check('janvier 2027 s ouvre par defaut', await monthSelect.inputValue() === '2027-01',
  await monthSelect.inputValue());
const loaded = since(mark).filter(c => c.method === 'GET' && c.path === '/api/expenses').map(c => c.query);
check('les 12 mois de 2027 sont charges',
  loaded.length === 12 && loaded.every(q => q.includes('from=2027-')), loaded.slice(0, 2).join(' '));
check('2026 reste proposee', await monthSelect.locator('option[value="nfyear:2026"]').count() === 1);
check('aucun mois de 2026 n est melange a 2027',
  await monthSelect.locator('option[value^="2026-"]').count() === 0);

mark = calls.length;
await Promise.all([
  page.waitForEvent('load'),
  monthSelect.selectOption('nfyear:2026')
]);
await page.waitForTimeout(6000);
check('revenir sur 2026 ouvre decembre', await page.locator('[data-period-selector] select').first().inputValue() === '2026-12');
check('le frais de decembre est liste', await page.locator('.nf-ios-expense-row').count() === 1,
  `${await page.locator('.nf-ios-expense-row').count()} ligne(s)`);
check('les mois de 2026 sont recharges',
  since(mark).some(c => c.method === 'GET' && c.path === '/api/expenses' && c.query.includes('from=2026-12')));
check('2027 reste atteignable', await page.locator('[data-period-selector] select option[value="nfyear:2027"]').count() === 1);
await shot('09-decembre-2026');

await page.locator('[data-period-selector] button:has-text("Full year")').first().click({ force: true });
await page.waitForTimeout(800);
const yearPicker = page.locator('[data-nf-year-picker]').first();
check('le mode annee propose les annees', await yearPicker.count() === 1);
if (await yearPicker.count()) {
  check('il affiche l annee active', await yearPicker.inputValue() === 'nfyear:2026');
  await Promise.all([page.waitForEvent('load'), yearPicker.selectOption('nfyear:2027')]);
  await page.waitForTimeout(6000);
  check('on reste en mode annee apres le changement',
    await page.locator('[data-nf-year-picker]').first().inputValue().catch(() => '') === 'nfyear:2027');
}

// ── 9 · Decision de la finance sur le mois ───────────────────────────
// Choix de Thomas (nov. 2026) : la finance decide au niveau du MOIS.
console.log('\n9. Decision de la finance');
const freshPage = async (viewport, mobile) => {
  const p = await browser.newPage({ viewport, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  await p.clock.install({ time: new Date(`${today}-20T10:00:00`) });
  p.on('pageerror', e => errors.push(String(e).split('\n')[0].slice(0, 200)));
  await p.route('**/tesseract*', route => route.abort());
  await p.route('**/api/**', apiHandler);
  await p.goto(`${BASE}/e2e.html`, { waitUntil: 'load' });
  await p.waitForTimeout(6000);
  return p;
};
rows.splice(0, rows.length,
  expense(1, 3, 'Brasserie de la Paix', 67.2, 'repas', 'reconciled', 'Payment card: company'),
  expense(2, 5, 'SBB CFF Billetterie', 48, 'transport', 'reconciled', 'Payment card: company'));
rows.forEach(r => { r.submission_status = 'submitted'; r.submitted_at = `${today}-19T08:00:00.000Z`; });
role = 'finance';
const fin = await freshPage({ width: 1280, height: 900 }, false);
await fin.locator('button:has-text("August 2026")').first().click({ force: true });
await fin.waitForTimeout(1200);
const decision = fin.locator('[data-nf-month-decision]');
check('la revue du mois porte le bloc de decision', await decision.count() === 1);
check('un mois soumis attend la decision', await decision.getAttribute('data-nf-month-decision').catch(() => '') === 'submitted');
await fin.screenshot({ path: `${OUT}/${channel}-10-finance-a-decider.png` });

mark = calls.length;
await fin.locator('button:has-text("Approve month")').click({ force: true });
await fin.waitForTimeout(900);
const approveCall = since(mark).find(c => c.method === 'POST' && c.path === '/api/month-review');
check('Approuver appelle l API', !!approveCall && approveCall.body.action === 'approve' && approveCall.body.month === `${today}`,
  JSON.stringify(approveCall && approveCall.body));
check('le canal est transmis', !!approveCall && approveCall.body.channel === channel);
check('le mois passe a Approved', await decision.getAttribute('data-nf-month-decision').catch(() => '') === 'approved');

await fin.locator('button:has-text("Mark reimbursed")').click({ force: true });
await fin.waitForTimeout(900);
check('puis a Reimbursed', await decision.getAttribute('data-nf-month-decision').catch(() => '') === 'reimbursed');
await fin.locator('button:has-text("Undo reimbursed")').click({ force: true });
await fin.waitForTimeout(900);
check('Undo revient a Approved', await decision.getAttribute('data-nf-month-decision').catch(() => '') === 'approved');

await fin.locator('button:has-text("Send back to user")').click({ force: true });
await fin.waitForTimeout(500);
const sendBtn = fin.locator('button:has-text("Send back and reopen the month")');
check('renvoyer exige un motif', await sendBtn.isDisabled());
await fin.locator('[data-nf-send-back-form] textarea').fill('Receipt missing for SBB');
mark = calls.length;
await sendBtn.click({ force: true });
await fin.waitForTimeout(900);
const backCall = since(mark).find(c => c.method === 'POST' && c.path === '/api/month-review');
check('Renvoyer appelle l API avec le motif', !!backCall && backCall.body.action === 'send_back' && backCall.body.note === 'Receipt missing for SBB',
  JSON.stringify(backCall && backCall.body));
check('le mois est marque renvoye', await decision.getAttribute('data-nf-month-decision').catch(() => '') === 'sent_back');
check('la revue n affiche plus le paquet comme soumis',
  (await fin.locator('text=Month not submitted').count()) === 1);
await fin.screenshot({ path: `${OUT}/${channel}-11-finance-renvoye.png` });

await fin.locator('button:has-text("Back inbox")').first().click({ force: true }).catch(() => {});
await fin.waitForTimeout(900);
check('le dashboard montre la pastille Sent back', await fin.locator('[data-nf-month-review="sent_back"]').count() >= 1);
await fin.close();

// ── 10 · Ce que Mike en voit ──────────────────────────────────────────
console.log('\n10. Ce que Mike voit de la decision');
role = 'user';
const mk = await freshPage({ width: 393, height: 852 }, true);
const back = mk.locator('[data-nf-month-review-banner="sent_back"]');
check('Mike voit le renvoi', await back.count() === 1);
check('avec le motif de la finance', (await back.innerText().catch(() => '')).includes('Receipt missing for SBB'));
check('le mois est de nouveau soumettable',
  !(await mk.locator('[data-user-submit-placement] > button:not(.nfm-add-link)').isDisabled()));
await mk.screenshot({ path: `${OUT}/${channel}-12-mike-renvoye.png` });
await mk.close();

rows.forEach(r => { r.submission_status = 'submitted'; r.submitted_at = `${today}-21T08:00:00.000Z`; });
reviews[today] = { app_channel: channel, month: today, status: 'approved', note: '', decided_at: `${today}-22T08:00:00.000Z` };
const mk2 = await freshPage({ width: 393, height: 852 }, true);
check('Mike voit l approbation', await mk2.locator('[data-nf-month-review-banner="approved"]').count() === 1);
check('la pastille du mois dit Approved', (await mk2.locator('.nfm-badge').first().innerText().catch(() => '')).trim() === 'Approved');
await mk2.screenshot({ path: `${OUT}/${channel}-13-mike-approuve.png` });
await mk2.close();

// ── Bilan ─────────────────────────────────────────────────────────────
const real = errors.filter(e => !e.includes('ServiceWorkerRegistration'));
check('aucune erreur JS sur tout le parcours', real.length === 0, real.join(' | '));

console.log(`\n${fail === 0 ? 'OK' : 'ECHEC'} — ${pass}/${pass + fail} verifications (canal ${channel})`);
console.log(`captures : ${OUT}/`);
await browser.close();
server.close();
process.exit(fail === 0 ? 0 : 1);
