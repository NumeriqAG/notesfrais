#!/usr/bin/env node
/*
 * Rejoue la chaine de patches NotesFrais hors navigateur et signale chaque
 * html.replace() qui ne matche rien (no-op silencieux).
 *
 *   node tools/check-patches.js mike|test|main
 *
 * Ecrit le HTML final dans .patch-out/out-<canal>.html : c'est exactement ce
 * que le navigateur execute. Greper ce fichier pour verifier qu'un patch a
 * bien pris effet.
 *
 * Tous les no-op ne sont pas des bugs (beaucoup sont des fallbacks volontaires
 * pour d'anciennes versions du source). Un NOUVEAU no-op sur le patch qu'on
 * vient d'ecrire, si.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, '.patch-out');
const ENTRIES = { mike: 'mike.html', test: 'test.html' };

const channel = process.argv[2] || 'mike';
const entry = ENTRIES[channel];
if (!entry) {
  console.error(`Canal inconnu: ${channel}. Attendu: ${Object.keys(ENTRIES).join(', ')}`);
  process.exit(2);
}

const entryHtml = fs.readFileSync(path.join(ROOT, entry), 'utf8');
const listMatch = entryHtml.match(/const patchFiles=\[([\s\S]*?)\];/);
if (!listMatch) {
  console.error(`Impossible de lire le tableau patchFiles dans ${entry}`);
  process.exit(2);
}
const files = listMatch[1]
  .split(',')
  .map(s => s.trim().replace(/^'|'$/g, ''))
  .filter(Boolean);

const misses = [];
const hits = [];
const origReplace = String.prototype.replace;
let currentFile = null;

// Instrumente replace() pour reperer les remplacements sans effet.
// Le garde sur la longueur evite de compter les replace() internes sur de
// petites chaines (labels, chemins) qui ne visent pas le source de l'app.
String.prototype.replace = function (search, repl) {
  const before = String(this);
  const out = origReplace.call(this, search, repl);
  if (currentFile && before.length > 200) {
    const desc = typeof search === 'string'
      ? JSON.stringify(search.slice(0, 90))
      : String(search).slice(0, 90);
    (out === before ? misses : hits).push({ file: currentFile, search: desc });
  }
  return out;
};

// Environnement navigateur minimal attendu par les patches.
const declared = (entryHtml.match(/window\.NOTESFRAIS_CHANNEL='([^']*)'/) || [])[1];
global.window = { NOTESFRAIS_CHANNEL: declared };
global.document = { addEventListener() {} };
global.navigator = { onLine: true };

for (const f of files) {
  const full = path.join(ROOT, f);
  if (!fs.existsSync(full)) {
    console.error(`MANQUANT: ${f} est liste dans ${entry} mais absent du repo`);
    process.exit(1);
  }
  new Function(fs.readFileSync(full, 'utf8'))();
  // Enveloppe pour attribuer chaque replace() au bon fichier.
  const inner = window.patchNotesFrais;
  window.patchNotesFrais = (html) => {
    const prev = currentFile;
    currentFile = f;
    try { return inner(html); } finally { currentFile = prev; }
  };
}

const appHtml = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
let out;
try {
  out = window.patchNotesFrais(appHtml);
} catch (e) {
  String.prototype.replace = origReplace;
  console.error('CHAINE DE PATCHES EN ERREUR:', e.message);
  process.exit(1);
}
String.prototype.replace = origReplace;

fs.mkdirSync(OUT_DIR, { recursive: true });
const outPath = path.join(OUT_DIR, `out-${channel}.html`);
fs.writeFileSync(outPath, out);

console.log(`\n=== canal ${channel} — ${files.length} patches, app.html ${appHtml.length} -> ${out.length} octets ===`);
console.log(`replace() appliques: ${hits.length} | sans effet: ${misses.length}`);
console.log(`sortie: ${path.relative(ROOT, outPath)}\n`);

const byFile = {};
for (const m of misses) (byFile[m.file] ||= []).push(m.search);
for (const [f, list] of Object.entries(byFile)) {
  console.log(`--- ${f} : ${list.length} no-op`);
  for (const s of list) console.log(`      ${s}`);
}
if (misses.length === 0) console.log('Aucun replace() sans effet.');
