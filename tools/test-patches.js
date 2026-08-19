#!/usr/bin/env node
/*
 * Tests anti-regression NotesFrais.
 *
 *   node tools/test-patches.js                  lance tous les tests
 *   node tools/test-patches.js --update-baseline  reenregistre la baseline
 *
 * Ce repo n'a ni build ni framework de test. Ces tests s'appuient sur le fait
 * que la chaine de patches est rejouable hors navigateur (tools/check-patches.js)
 * : on genere le HTML final des trois canaux et on verifie des invariants
 * dessus. Ils attrapent la panne caracteristique du projet, un html.replace()
 * qui cesse de matcher en silence.
 *
 * Sortie non nulle si un test echoue.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASELINE = path.join(__dirname, 'patch-baseline.json');
const CHANNELS = { mike: 'mike.html', test: 'test.html' };
// index.html et iphone-fix.html ne sont plus que des replis : vercel.json sert
// mike.html sur /. Ils doivent rester des copies conformes, sinon on retombe
// dans la divergence qui a coute cher a l'epoque des trois canaux.
const FALLBACK_PAGES = ['index.html', 'iphone-fix.html'];
const SERVICE_WORKERS = { mike: 'mike-sw.js', test: 'test-sw.js' };
const UPDATE = process.argv.includes('--update-baseline');

let failures = 0;
let checks = 0;
function ok(name) { checks++; console.log(`  ok   ${name}`); }
function fail(name, detail) {
  checks++; failures++;
  console.log(`  FAIL ${name}`);
  if (detail) String(detail).split('\n').forEach(l => console.log(`         ${l}`));
}
function assert(cond, name, detail) { cond ? ok(name) : fail(name, detail); }
function section(title) { console.log(`\n${title}`); }

const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const patchListOf = entry => {
  const m = read(entry).match(/const patchFiles=\[([\s\S]*?)\];/);
  if (!m) throw new Error(`tableau patchFiles introuvable dans ${entry}`);
  return m[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
};

/* --- rejoue la chaine et collecte les replace() sans effet ------------- */
function buildChannel(channel) {
  const files = patchListOf(CHANNELS[channel]);
  const noop = {};
  const origReplace = String.prototype.replace;
  let currentFile = null;
  String.prototype.replace = function (search, repl) {
    const before = String(this);
    const out = origReplace.call(this, search, repl);
    if (currentFile && before.length > 200 && out === before) {
      noop[currentFile] = (noop[currentFile] || 0) + 1;
    }
    return out;
  };
  const declared = (read(CHANNELS[channel]).match(/window\.NOTESFRAIS_CHANNEL='([^']*)'/) || [])[1];
  global.window = { NOTESFRAIS_CHANNEL: declared };
  global.document = { addEventListener() {} };
  global.navigator = { onLine: true };
  try {
    for (const f of files) {
      new Function(read(f))();
      const inner = window.patchNotesFrais;
      window.patchNotesFrais = (html) => {
        const prev = currentFile;
        currentFile = f;
        try { return inner(html); } finally { currentFile = prev; }
      };
    }
    return { files, html: window.patchNotesFrais(read('app.html')), noop, error: null };
  } catch (e) {
    return { files, html: '', noop, error: e };
  } finally {
    String.prototype.replace = origReplace;
  }
}

/* --- 1. integrite des listes de patches -------------------------------- */
section('1. Listes de patches et service workers');

const lists = {};
for (const [channel, entry] of Object.entries(CHANNELS)) {
  let files;
  try { files = patchListOf(entry); } catch (e) { fail(`${entry} : liste lisible`, e.message); continue; }
  lists[channel] = files;
  const missing = files.filter(f => !fs.existsSync(path.join(ROOT, f)));
  assert(missing.length === 0, `${entry} : les ${files.length} patches existent`, missing.join('\n'));
}

for (const [channel, sw] of Object.entries(SERVICE_WORKERS)) {
  const inHtml = [...new Set(lists[channel] || [])].sort();
  const inSw = [...new Set(read(sw).match(/notesfrais-[a-z0-9-]+\.js/g) || [])].sort();
  const onlyHtml = inHtml.filter(f => !inSw.includes(f));
  const onlySw = inSw.filter(f => !inHtml.includes(f));
  assert(onlyHtml.length === 0 && onlySw.length === 0,
    `${sw} : SHELL_FILES aligne sur ${CHANNELS[channel]}`,
    [...onlyHtml.map(f => `absent du SW : ${f}`), ...onlySw.map(f => `absent du HTML : ${f}`)].join('\n'));
}

const referenced = new Set(Object.values(lists).flat());
const onDisk = fs.readdirSync(ROOT).filter(f => /^notesfrais-.*\.js$/.test(f));
const orphans = onDisk.filter(f => !referenced.has(f));
assert(orphans.length === 0, 'aucun patch orphelin sur le disque', orphans.join('\n'));

const mikeHtml = read('mike.html');
for (const page of FALLBACK_PAGES) {
  assert(read(page) === mikeHtml, `${page} : copie conforme de mike.html`,
    'vercel.json sert mike.html sur / — ces pages doivent rester identiques');
}

/* --- 2. la chaine s'execute et produit du HTML ------------------------- */
section('2. Execution de la chaine');

const built = {};
for (const channel of Object.keys(CHANNELS)) {
  const r = buildChannel(channel);
  built[channel] = r;
  assert(!r.error, `canal ${channel} : la chaine s'execute sans exception`, r.error && r.error.stack);
  assert(r.html.length > 40000, `canal ${channel} : HTML final non tronque (${r.html.length})`);
  assert(r.html.includes('ReactDOM.render('), `canal ${channel} : point de montage React present`);
}

/* --- 3. invariants fonctionnels ---------------------------------------- */
// Marqueurs choisis parmi des identifiants sans le mot "frais"/"Frais" :
// sur /mike les patches de traduction remplacent ces mots partout, jusque
// dans les identifiants JS (cf. CLAUDE.md).
section('3. Fonctionnalites presentes dans le HTML genere');

const REQUIRED = {
  all: [
    ['AccessGate present', 'function AccessGate('],
    ['login par cookie signe', '/api/session'],
    ['frais lus et ecrits par l API', '/api/expenses'],
    ['justificatifs via l API R2', '/api/receipts'],
    ['soumission mensuelle', '/api/monthly-submission'],
    ['justificatifs multiples', 'receiptItems'],
    ['edition d un frais', 'setEditingExpense'],
    ['file d attente hors ligne', 'function queueOfflineExpense('],
    ['OCR avec pretraitement image', 'function preprocessReceiptImage('],
    ['brouillon du formulaire', 'NOTESFRAIS_DRAFT_KEY'],
    ['modale de resume avant soumission', 'showSubmitSummary'],
    ['confirmation avant suppression : handlers', 'NOTESFRAIS_DELETE_CONFIRM_V1'],
    ['confirmation avant suppression : etat', 'const [pendingDelete,setPendingDelete]=useState(null);'],
    ['confirmation avant suppression : modale', 'data-nf-delete-confirm'],
    ['suppression jamais immediate', 'const deleteExpense=useCallback((id,receiptPath)=>{setPendingDelete'],
  ],
  test: [
    ['12 mois disponibles', "{v:'2026-12'"],
    ['selecteur de periode dans les onglets', 'function PeriodInsideTabs('],
    ['soumission du mois', 'submitCurrentMonth'],
    ['dashboard finance', 'function FinanceDashboardTab('],
    ['export ZIP des justificatifs', 'function downloadFinanceReceiptsZip('],
    ['edition disponible en preprod', 'setEditingExpense'],
  ],
  mike: [
    ['12 mois disponibles', "{v:'2026-12'"],
    ['selecteur de periode dans les onglets', 'function PeriodInsideTabs('],
    ['soumission du mois', 'submitCurrentMonth'],
    ['dashboard finance', 'function FinanceDashboardTab('],
    ['parametres comptables finance', 'function FinanceSettingsTab('],
    ['export ZIP des justificatifs', 'function downloadFinanceReceiptsZip('],
    ['barre de navigation mobile', 'test-bottom-nav'],
    ['compression des photos', 'compressReceiptImageForTest'],
    ['UI anglaise active', 'Mike English UI active'],
  ],
};

// Doit avoir disparu : bucket public et acces par code en dur.
const FORBIDDEN = [
  ['pas de code d acces en dur', /MIKE2026|FINANCE2026|ACCESS_CODES/],
  ['plus de client Supabase', /supabase\.createClient\(SUPABASE/],
];

// Chaque canal doit enregistrer SON service worker sur SA portee : une portee
// trop large et la preprod ecrase le shell de la production.
const SW_EXPECTED = { mike: ['/mike-sw.js', '/mike'], test: ['/test-sw.js', '/test'] };
for (const [channel, [script, scope]] of Object.entries(SW_EXPECTED)) {
  if (!built[channel]) continue;
  const found = (built[channel].html.match(/serviceWorker\.register\("([^"]*)",\{scope:"([^"]*)"\}/) || []).slice(1);
  assert(found[0] === script && found[1] === scope,
    `${channel} : enregistre ${script} sur ${scope}`,
    `trouve : ${found[0] || 'aucun'} sur ${found[1] || '?'}`);
}

for (const channel of Object.keys(CHANNELS)) {
  const html = built[channel].html;
  for (const [name, needle] of [...REQUIRED.all, ...(REQUIRED[channel] || [])]) {
    assert(html.includes(needle), `${channel} : ${name}`, `chaine absente : ${needle}`);
  }
  for (const [name, re] of FORBIDDEN) {
    const m = html.match(re);
    assert(!m, `${channel} : ${name}`, m && `trouve : ${m[0]}`);
  }
}

/* --- 4. baseline : no-op et encodage ne doivent pas empirer ------------ */
section('4. Baseline (replace sans effet, double encodage UTF-8)');

const mojibake = {};
for (const f of onDisk.concat(['app.html'])) {
  const n = (read(f).match(/Ã[©¨ª«¢\s]|â€|Â /g) || []).length;
  if (n > 0) mojibake[f] = n;
}

const current = {
  noop: Object.fromEntries(Object.entries(built).map(([c, r]) => [c, r.noop])),
  mojibake,
};

if (UPDATE) {
  fs.writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n');
  console.log(`  baseline reenregistree dans ${path.relative(ROOT, BASELINE)}`);
} else if (!fs.existsSync(BASELINE)) {
  fail('baseline presente', `${path.relative(ROOT, BASELINE)} manquant — lancer --update-baseline`);
} else {
  const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  for (const channel of Object.keys(CHANNELS)) {
    const cur = current.noop[channel] || {};
    const ref = (base.noop || {})[channel] || {};
    const worse = Object.entries(cur)
      .filter(([f, n]) => n > (ref[f] || 0))
      .map(([f, n]) => `${f} : ${ref[f] || 0} -> ${n} replace sans effet`);
    assert(worse.length === 0,
      `${channel} : aucun nouveau replace() sans effet`,
      worse.concat('un patch a cesse de matcher — corriger la chaine cible,',
                   'ou si la regression est voulue : node tools/test-patches.js --update-baseline').join('\n'));
    const fixed = Object.entries(ref).filter(([f, n]) => (cur[f] || 0) < n);
    if (fixed.length) console.log(`  note   ${channel} : ${fixed.length} fichier(s) ameliore(s), penser a --update-baseline`);
  }
  const worseEnc = Object.entries(current.mojibake)
    .filter(([f, n]) => n > ((base.mojibake || {})[f] || 0))
    .map(([f, n]) => `${f} : ${(base.mojibake || {})[f] || 0} -> ${n} sequences mojibake`);
  assert(worseEnc.length === 0,
    'aucun nouveau double encodage UTF-8',
    worseEnc.concat('un fichier a ete sauve deux fois en UTF-8 : ses chaines cibles accentuees ne matcheront plus').join('\n'));
}

/* --- 5. compilation JSX reelle ----------------------------------------- */
// La verification la plus forte du depot : un patch qui produit du JSX invalide
// rend l'application entierement blanche. On compile avec la version exacte de
// Babel Standalone chargee en production. Le bundle (2,8 Mo) n'est pas versionne
// — il est telecharge une fois et mis en cache dans .patch-out/, et le test est
// simplement saute si le reseau n'est pas disponible.
section('5. Compilation du JSX genere');

const BABEL_URL = 'https://cdn.jsdelivr.net/npm/@babel/standalone@7.23.10/babel.min.js';
const BABEL_CACHE = path.join(ROOT, '.patch-out', 'babel.min.js');

(async () => {
  let Babel = null;
  try {
    if (!fs.existsSync(BABEL_CACHE)) {
      const res = await fetch(BABEL_URL);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      fs.mkdirSync(path.dirname(BABEL_CACHE), { recursive: true });
      fs.writeFileSync(BABEL_CACHE, Buffer.from(await res.arrayBuffer()));
    }
    Babel = require(BABEL_CACHE);
  } catch (e) {
    console.log(`  saute  Babel indisponible (${e.message}) — compilation non verifiee`);
  }

  if (Babel) {
    for (const channel of Object.keys(CHANNELS)) {
      const m = built[channel].html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/);
      if (!m) { fail(`${channel} : script Babel present`); continue; }
      try {
        Babel.transform(m[1], { presets: ['react', 'env'], filename: channel + '.jsx' });
        ok(`${channel} : le JSX genere compile (${m[1].length} caracteres)`);
      } catch (e) {
        fail(`${channel} : le JSX genere compile`, e.message.split('\n').slice(0, 3).join('\n'));
      }
    }
  }

  console.log(`\n${failures === 0 ? 'OK' : 'ECHEC'} — ${checks - failures}/${checks} verifications passees`);
  process.exit(failures === 0 ? 0 : 1);
})();
