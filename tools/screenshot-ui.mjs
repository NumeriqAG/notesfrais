#!/usr/bin/env node
/*
 * Rend l'interface reelle dans Chromium et la photographie, hors ligne.
 *
 *   node tools/screenshot-ui.mjs [mike|test]
 *
 * Le sandbox n'a pas de reseau pour le navigateur : React, ReactDOM et Babel
 * sont servis depuis .patch-out/vendor, et les routes /api/* sont simulees par
 * des fixtures. On voit donc l'app telle qu'elle est, sans toucher a la prod.
 *
 * Les captures atterrissent dans .patch-out/shots/ (non versionne).
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const channel = process.argv[2] || 'mike';
const OUT = '.patch-out/shots';
mkdirSync(OUT, { recursive: true });

execSync(`node tools/check-patches.js ${channel}`, { stdio: 'ignore' });
let html = readFileSync(`.patch-out/out-${channel}.html`, 'utf8');

// Le canal est defini par le chargeur (mike.html), pas par app.html. Sans lui,
// les patches qui portent leurs deux langues retombent en francais et les
// captures mentent.
html = html.replace('<head>', `<head>\n<script>window.NOTESFRAIS_CHANNEL=${JSON.stringify(channel)};<\/script>`);

// CDN -> fichiers locaux
html = html
  .replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/react@[^"]*/, 'vendor/react.js')
  .replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/react-dom@[^"]*/, 'vendor/react-dom.js')
  .replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/@babel\/standalone@[^"]*/, 'vendor/babel.js')
  .replace(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/g, '');
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
writeFileSync('.patch-out/render.html', html);

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

const FIXTURES = [
  expense(1, 3, 'Brasserie de la Paix', 67.2, 'repas', 'reconciled', 'Payment card: company\nWith: client Lausanne'),
  expense(2, 5, 'SBB CFF Billetterie', 48, 'transport', 'reconciled', 'Payment card: company'),
  expense(3, 11, 'Ibis Budget Lausanne', 89, 'hotel', 'pending', 'Payment card: personal'),
  expense(4, 14, 'Coop Supermarche', 43.6, 'repas', 'pending', 'Payment card: company'),
  expense(5, 18, 'Apple Store Geneve', 249, 'materiel', 'pending', 'Payment card: company')
];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox']
});
const page = await browser.newPage({
  viewport: { width: 393, height: 852 },      // iPhone 15 Pro
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true
});

const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 160)));

await page.route('**/api/**', route => {
  const url = route.request().url();
  const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (url.includes('/api/session')) {
    return json({ ok: true, session: { user: { id: 'mike', email: 'mike@numeriq.ch' } },
                  profile: { role: 'user', app_channel: channel } });
  }
  if (url.includes('/api/expenses')) {
    // loadData interroge les 12 mois : ne renvoyer les fixtures que pour le mois courant
    const month = new URL(url).searchParams.get('from') || '';
    return json({ ok: true, data: month.startsWith(today) ? FIXTURES : [] });
  }
  return json({ ok: true, data: [] });
});

await page.goto(`file://${process.cwd()}/.patch-out/render.html`, { waitUntil: 'load' });
await page.waitForTimeout(6000);

const shot = async name => {
  await page.screenshot({ path: `${OUT}/${channel}-${name}.png` });
  console.log(`  ${OUT}/${channel}-${name}.png`);
};
await shot('01-liste');

const tap = async (label, name, wait = 1800) => {
  const nav = page.locator(`#test-bottom-nav button:has-text("${label}")`);
  const el = (await nav.count()) ? nav.first() : page.locator(`button:has-text("${label}")`).first();
  if (await el.count() === 0) { console.log(`  (bouton "${label}" introuvable)`); return false; }
  await el.click({ force: true });
  await page.waitForTimeout(wait);
  await shot(name);
  return true;
};

// deux CTA coexistent (#mike-scan-cta et #test-scan-cta), un seul est visible
let opened = false;
for (const sel of ['#test-scan-cta', '#mike-scan-cta', 'button:has-text("+ Add expense")']) {
  const el = page.locator(sel).first();
  if (await el.count()) {
    try { await el.click({ force: true, timeout: 4000 }); opened = true; break; } catch (_) {}
  }
}
if (!opened) console.log('  (aucun CTA visible pour ouvrir la modale)');
await page.waitForTimeout(2200);
await shot('02-ajout');
const cancel = page.locator('button:has-text("Keep as draft"), button:has-text("Cancel")').first();
if (await cancel.count()) { await cancel.click({ force: true }); await page.waitForTimeout(1200); }
await tap('Stats', '03-stats');
await tap('UBS', '04-ubs');
await tap('Expenses', '05-retour');

console.log('\nerreurs JS :', errors.length ? errors.slice(0, 3) : 'aucune');
console.log('titre h1   :', await page.locator('h1').first().textContent().catch(() => '(aucun)'));
console.log('boutons    :', await page.locator('button').count());
await browser.close();
