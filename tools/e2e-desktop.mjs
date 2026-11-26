#!/usr/bin/env node
/*
 * Parcours de Mike sur ORDINATEUR (ecran de 1440 px), dans Chromium.
 *
 *   node tools/e2e-desktop.mjs [mike|test]
 *
 * Mike recoit beaucoup de recus electroniques (PDF par email, portails) et les
 * saisit depuis son ordinateur : panneau « Add receipts from your computer »,
 * depot de plusieurs fichiers n'importe ou sur la page, file « Receipt 2 of 3 »
 * dans la fenetre d'ajout, apercu du justificatif a cote du formulaire.
 * Verifie aussi que la finance ne voit rien de tout cela.
 *
 * Meme banc que e2e-mobile.mjs (dont l'en-tete ci-dessous est repris) :
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
const OUT = '.patch-out/e2e-desktop';
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
writeFileSync('.patch-out/e2e-desktop.html', html);

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
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1
});

// L'app ouvre le mois courant : sans horloge figee, les frais d'aout ne
// s'affichent plus des septembre et tout le parcours echoue. L'horloge suit
// son cours a partir de cette date ; la section 8 la deplace en 2027.
await page.clock.install({ time: new Date(`${today}-20T10:00:00`) });

const errors = [];
page.on('pageerror', e => errors.push(String(e).split('\n')[0].slice(0, 200)));

// Tesseract n'est de toute facon pas joignable ici : on coupe net pour que la
// branche d'echec s'exerce tout de suite au lieu d'attendre le timeout de 90 s.
let tesseractHits = 0;
await page.route('**/tesseract*', route => { tesseractHits++; return route.abort(); });

// Etat simule de /api/month-review et role de la session : la section 9
// rejoue la decision de la finance, puis ce que Mike en voit.
let role = 'user';
let aiMode = 'ok';
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
  // Lecture par IA : d'abord sans cle (503, l'app retombe sur Tesseract),
  // puis avec une reponse type pour verifier le remplissage du formulaire.
  if (url.pathname === '/api/receipt-ai') {
    if (aiMode === 'ok') {
      await new Promise(r => setTimeout(r, 600));
      const text = body && body.media_type === 'application/pdf' ? Buffer.from(body.data || '', 'base64').toString('latin1') : '';
      if (text.includes('Hotel Bristol')) return json({ ok: true, fields: { is_receipt: true, merchant: 'Hotel Bristol',
        total: 312.5, vat: 11.25, currency: 'CHF', date: '2026-08-12', category: 'hotel' } });
      if (text.includes('SWISS')) return json({ ok: true, fields: { is_receipt: true, merchant: 'SWISS',
        total: 128, vat: 0, currency: 'CHF', date: '2026-08-10', category: 'transport' } });
      return json({ ok: true, fields: { is_receipt: true, merchant: 'Taxi Bleu Paris',
        total: 48.6, vat: 4.42, currency: 'EUR', date: '2026-08-18', category: 'transport' } });
    }
    return route.fulfill({ status: 503, contentType: 'application/json',
      body: JSON.stringify({ ok: false, error: 'AI reading is not configured (ANTHROPIC_API_KEY missing)' }) });
  }
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
let mark = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail && !ok ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};
// Ouvre la fiche d'un frais comme le doigt : un clic sur la ligne, hors boutons.
const openDetail = async row => { await row.evaluate(el => el.click()); await page.waitForTimeout(700); };
const shot = name => page.screenshot({ path: `${OUT}/${channel}-${name}.png` });

const FX = '.patch-out/fx';
const posts = () => calls.filter(c => c.method === 'POST' && c.path === '/api/expenses');
const modal = () => page.locator('div[style*="position: fixed"]:has-text("Add expense")').last();
const pickCard = async () => {
  await page.locator('[data-payment-card-field] select').first().selectOption('entreprise');
};

await page.goto(`${BASE}/e2e-desktop.html`, { waitUntil: 'load' });
await page.waitForTimeout(6000);

// ── 1 · L'ecran de Mike sur ordinateur ────────────────────────────────
console.log('\n1. Ecran de Mike sur ordinateur');
check('mode ordinateur actif (body.nf-desk-user)', await page.evaluate(() => document.body.classList.contains('nf-desk-user')));
check('pas de mise en page iPhone', !(await page.evaluate(() => document.body.classList.contains('nf-ios-mike'))));
check('panneau « Add receipts from your computer » visible', await page.locator('[data-nf-desk-import]').isVisible());
const sumDisplay = await page.locator('[data-user-submit-placement]').evaluate(el => getComputedStyle(el).display);
check('carte du mois mise en forme (grille)', sumDisplay === 'grid', sumDisplay);
await shot('01-accueil');

// ── 2 · Trois recus choisis d'un coup ─────────────────────────────────
console.log('\n2. Trois recus choisis d un coup (2 PDF + 1 photo)');
await page.locator('[data-nf-desk-import] input[type=file]').setInputFiles([
  `${FX}/swiss-eticket.pdf`, `${FX}/hotel-invoice.pdf`, `${FX}/taxi.jpg`]);
await page.waitForTimeout(2500);
check('la fenetre d ajout s ouvre', await page.locator('text=Add expense').first().isVisible());
check('file : « Receipt 1 of 3 »', (await page.locator('[data-nf-desk-queue]').innerText().catch(() => '')).includes('Receipt 1 of 3'));
check('apercu du PDF a cote du formulaire', await page.locator('[data-nf-desk-preview] iframe').count() === 1);
let merchant = await page.locator('input[placeholder="E.g. Restaurant Le Bistrot"]').inputValue();
check('lecture IA : commercant du 1er PDF', merchant === 'SWISS', merchant);
check('lecture IA : montant', (await page.locator('input[type=number]').first().inputValue()) === '128.00');
await pickCard();
await shot('02-recu-1-sur-3');
let before = posts().length;
await page.locator('button:has-text("Confirm")').last().click();
await page.waitForTimeout(2500);
check('1er frais enregistre', posts().length === before + 1 && posts().at(-1).body && posts().at(-1).body.merchant === 'SWISS',
  JSON.stringify(posts().at(-1) && posts().at(-1).body && posts().at(-1).body.merchant));
let q = await page.locator('[data-nf-desk-queue]').innerText().catch(() => '');
check('le 2e s ouvre seul : « Receipt 2 of 3 »', q.includes('Receipt 2 of 3'), q);
check('confirmation du precedent dans la file', q.includes('SWISS saved'), q);
merchant = await page.locator('input[placeholder="E.g. Restaurant Le Bistrot"]').inputValue();
check('lecture IA : commercant du 2e PDF', merchant === 'Hotel Bristol', merchant);
check('carte de paiement conservee', (await page.locator('[data-payment-card-field] select').first().inputValue()) === 'entreprise');
await shot('03-recu-2-sur-3');
await page.locator('[data-nf-desk-queue] button').click();
await page.waitForTimeout(2500);
q = await page.locator('[data-nf-desk-queue]').innerText().catch(() => '');
check('« Skip this one » passe au 3e', q.includes('Receipt 3 of 3'), q);
check('le recu ignore n est pas enregistre', posts().length === before + 1);
check('apercu image pour la photo', await page.locator('[data-nf-desk-preview] img').count() === 1);
merchant = await page.locator('input[placeholder="E.g. Restaurant Le Bistrot"]').inputValue();
check('lecture IA : commercant de la photo', merchant === 'Taxi Bleu Paris', merchant);
await shot('04-recu-3-sur-3');
await page.locator('button:has-text("Confirm")').last().click();
await page.waitForTimeout(2500);
check('3e frais enregistre', posts().length === before + 2 && posts().at(-1).body.merchant === 'Taxi Bleu Paris');
check('la fenetre se ferme apres le dernier', !(await page.locator('[data-nf-desk-queue]').count()) &&
  !(await page.locator('input[placeholder="E.g. Restaurant Le Bistrot"]').count()));

// ── 3 · Glisser-deposer sur la page ───────────────────────────────────
console.log('\n3. Glisser-deposer sur la page');
const dropFiles = async (target, names) => {
  const payload = names.map(n => ({ name: n, b64: readFileSync(`${FX}/${n}`).toString('base64'),
    type: n.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg' }));
  await page.evaluate(({ target, payload, phase }) => {
    const dt = new DataTransfer();
    for (const f of payload) {
      const bin = Uint8Array.from(atob(f.b64), c => c.charCodeAt(0));
      dt.items.add(new File([bin], f.name, { type: f.type }));
    }
    const el = document.querySelector(target) || document.body;
    for (const t of phase) el.dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, { target, payload, phase: ['dragenter', 'dragover'] });
  await page.waitForTimeout(300);
  const overlay = await page.locator('.nf-desk-overlay').isVisible().catch(() => false);
  await shot('05-depot-en-cours');
  await page.evaluate(({ target, payload }) => {
    const dt = new DataTransfer();
    for (const f of payload) {
      const bin = Uint8Array.from(atob(f.b64), c => c.charCodeAt(0));
      dt.items.add(new File([bin], f.name, { type: f.type }));
    }
    const el = document.querySelector(target) || document.body;
    el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, { target, payload });
  return overlay;
};
const overlay = await dropFiles('h1', ['hotel-invoice.pdf', 'swiss-eticket.pdf']);
check('voile « Drop your receipts » pendant le survol', overlay);
await page.waitForTimeout(2500);
q = await page.locator('[data-nf-desk-queue]').innerText().catch(() => '');
check('depot de 2 fichiers : « Receipt 1 of 2 »', q.includes('Receipt 1 of 2'), q);
merchant = await page.locator('input[placeholder="E.g. Restaurant Le Bistrot"]').inputValue();
check('lecture IA apres depot', merchant === 'Hotel Bristol', merchant);
check('le voile disparait apres le depot', !(await page.locator('.nf-desk-overlay').count()));
// Un 3e fichier depose pendant que la fenetre est ouverte rejoint la file.
await dropFiles('[data-nf-desk-preview]', ['taxi.jpg']);
await page.waitForTimeout(800);
q = await page.locator('[data-nf-desk-queue]').innerText().catch(() => '');
check('un fichier depose fenetre ouverte rejoint la file (1 of 3)', q.includes('Receipt 1 of 3'), q);
await page.locator('button:has-text("Keep as draft"), button:has-text("Save draft")').first().click().catch(() => {});
await page.waitForTimeout(800);

// ── 4 · La finance ne voit rien de tout cela ──────────────────────────
console.log('\n4. Finance inchangee');
role = 'finance';
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(6000);
check('finance : pas de mode ordinateur Mike', !(await page.evaluate(() => document.body.classList.contains('nf-desk-user'))));
check('finance : pas de panneau d import', await page.locator('[data-nf-desk-import]').count() === 0);
await shot('06-finance');

console.log(`\n${fail ? 'ECHEC' : 'OK'} — ${pass}/${pass + fail} verifications, erreurs JS : ${errors.length ? errors.join(' | ') : 'aucune'}`);
await browser.close(); server.close();
process.exit(fail || errors.length ? 1 : 0);
