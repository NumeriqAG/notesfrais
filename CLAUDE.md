# NotesFrais — guide de travail

Application de notes de frais de **Numeriq AG** (Suisse, CHF). Un salarié
(Mike) photographie ses reçus, l'app les OCRise, les stocke dans Supabase,
les réconcilie avec un relevé bancaire UBS, puis le mois est « soumis » à la
finance qui contrôle et exporte.

**Il n'y a pas de build.** Pas de `package.json`, pas de bundler, pas de
tests. React est chargé par CDN et compilé dans le navigateur par Babel
Standalone. On déploie en poussant sur `main` (Vercel).

---

## 1. L'architecture — à lire avant toute modification

Le cœur de l'app est **`app.html`** : un fichier unique de ~470 lignes qui
contient tout le React inline dans un `<script type="text/babel">`.

Mais **`app.html` n'est jamais servi directement**. Les pages d'entrée
(`mike.html`, `test.html`, `index.html`) font ceci :

```js
let html = await (await fetch('/app.html')).text();   // 1. le source en TEXTE
for (const file of patchFiles) {                       // 2. chaîne de patches
  new Function(await (await fetch('/'+file)).text())();
}
html = window.patchNotesFrais(html);                   // 3. réécriture du source
document.open(); document.write(html); document.close();// 4. exécution
```

Chaque fichier `notesfrais-*.js` **enveloppe** `window.patchNotesFrais` en
décorateur, et applique des `html.replace('<code source exact>', '<nouveau
code>')` sur le texte de `app.html` :

```js
(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;      // les patches précédents d'abord
    if (html.includes('MON_MARQUEUR_V3')) return html;  // idempotence
    html = html.replace("<code exact de app.html>", "<remplacement>");
    return html;
  };
})();
```

### Conséquences directes

1. **`app.html` est quasi gelé.** Presque toutes les fonctionnalités des 12
   derniers mois vivent dans les patches. Modifier `app.html` casse
   silencieusement les patches qui ciblaient le code d'avant.
2. **L'ordre des patches est du code.** Un patch B qui cible du code produit
   par un patch A doit être chargé **après** A. Cet ordre n'existe que dans
   les tableaux `patchFiles` de `mike.html` / `test.html` / `index.html`.
3. **Un `.replace()` qui ne matche pas ne lève aucune erreur.** Il retourne
   la chaîne inchangée. Une espace en trop, un accent mal encodé, ou un patch
   antérieur qui a déjà réécrit la cible → la fonctionnalité disparaît sans
   un seul message dans la console. C'est le mode de panne n°1 de ce repo
   (voir §8, il y a des cas réels en production aujourd'hui).
4. Certains patches n'agissent pas sur le source mais **injectent un
   `<script>` qui manipule le DOM en boucle** (`setInterval`). Ils ciblent
   des éléments par leur **texte visible** — donc ils cassent quand on
   traduit ou renomme un libellé.

### Vérifier ses patches : `tools/check-patches.js`

Comme rien ne signale un `replace()` sans effet, un harnais rejoue la chaîne
complète hors navigateur et liste les no-op :

```bash
node tools/check-patches.js mike   # canal Mike (prod)
node tools/check-patches.js test   # canal test
node tools/check-patches.js main   # racine (legacy)
```

Il écrit aussi le HTML final dans `.patch-out/out-<canal>.html` — c'est
exactement ce que le navigateur exécute. **Toujours le lancer avant de
commiter un patch**, et grepper le résultat pour vérifier que la
modification est bien présente. Tous les no-op ne sont pas des bugs (beaucoup
sont des fallbacks volontaires pour d'anciennes versions) — mais un **nouveau**
no-op sur ton patch, si.

### Les tests anti-régression : `tools/test-patches.js`

```bash
node tools/test-patches.js                     # à lancer avant chaque commit
node tools/test-patches.js --update-baseline   # si une évolution est voulue
```

C'est le seul filet de sécurité du repo. Il vérifie :

1. **Listes** — chaque patch listé existe ; `SHELL_FILES` du SW est aligné sur
   la liste HTML de son canal ; aucun `notesfrais-*.js` orphelin sur le disque.
2. **Exécution** — la chaîne tourne sans exception sur les 3 canaux et produit
   un HTML complet.
3. **Fonctionnalités** — ~30 marqueurs vérifiés dans le HTML généré (AccessGate,
   URLs signées, file offline, OCR, dashboard finance, export ZIP, nav mobile,
   12 mois, UI anglaise sur mike…), plus des interdits : aucun code d'accès en
   dur, aucun `getPublicUrl` (le bucket est privé).
4. **Baseline** (`tools/patch-baseline.json`) — le nombre de `replace()` sans
   effet **par fichier et par canal** ne doit jamais augmenter, ni le nombre de
   séquences mojibake par fichier.
5. **Compilation JSX** — le script généré est réellement compilé avec la version
   exacte de Babel Standalone chargée en production. C'est la vérification la
   plus forte du dépôt : un patch qui produit du JSX invalide rend l'application
   entièrement blanche. Le bundle (2,8 Mo) n'est pas versionné — il est
   téléchargé une fois dans `.patch-out/`, et le test est sauté sans échouer si
   le réseau est absent.

Le point 4 est celui qui attrape la panne caractéristique du projet. Exemple
réel : ajouter une espace dans une chaîne cible de `test-compress.js` laisse
tous les marqueurs fonctionnels au vert, mais fait échouer la baseline sur
2 canaux. Les deux couches sont complémentaires — ne pas en retirer une.

---

## 2. Carte du repo

| Fichier | Rôle |
|---|---|
| `app.html` | Le socle React. Composants : `App`, `AddModal`, `UBSModal`, `ReceiptViewer`, `Thumb`, `Badge`, `StatsTab` (stub). Parseur CSV UBS + moteur de réconciliation. |
| `mike.html` / `test.html` / `index.html` | Pages d'entrée = **liste ordonnée des patches** par canal. |
| `iphone-fix.html` | Copie conforme d'`index.html`. C'est ce que `/` sert réellement (via `vercel.json`). |
| `notesfrais-*.js` | Les patches (§5). |
| `mike-sw.js` / `test-sw.js` / `sw.js` | Service workers, un par canal. |
| `manifest*.webmanifest` | Manifests PWA, un par canal. |
| `api/notify-submission.js` | Seule fonction serverless : mail à la finance via Resend. |
| `supabase-*.sql` | Migrations à passer à la main dans le SQL Editor Supabase. |
| `tools/check-patches.js` | Harnais : rejoue la chaîne, liste les `replace()` sans effet. |
| `tools/test-patches.js` | Tests anti-régression. À lancer avant chaque commit. |
| `tools/patch-baseline.json` | Baseline des no-op et du mojibake connus. |
| `icon.svg`, `logo-numeriq-payroll.png` | Assets. |

---

## 3. Les trois canaux

`vercel.json` réécrit `/mike` → `mike.html`, `/test` → `test.html`,
`/` → `iphone-fix.html`.

| Canal | URL | `window.NOTESFRAIS_CHANNEL` | Patches | Langue | SW |
|---|---|---|---|---|---|
| **mike** | `/mike` | `'mike'` | 33 | Anglais | `mike-sw.js` |
| **test** | `/test` | `'test'` | 32 | Français | `test-sw.js` |
| **racine** | `/` | *(undefined → `'main'`)* | 11 | Français | `sw.js` |

- **`/test` est la préprod, `/mike` la prod.** Le flux normal : développer et
  valider sur `/test`, puis promouvoir en ajoutant le patch à `mike.html` +
  `mike-sw.js`. C'est pour ça que des patches nommés `notesfrais-test-*.js`
  tournent en production sur Mike — **le préfixe `test-` ne veut pas dire
  « désactivé en prod »**.
- Beaucoup de patches s'auto-désactivent :
  `if(!['test','mike'].includes(window.NOTESFRAIS_CHANNEL)) return html;`
- **Le canal racine `/` est abandonné** : 11 patches sur 33, pas d'isolation
  de canal, pas d'espace finance, pas de nav mobile, `MONTHS` figé à
  janvier–juin 2026. Ne rien y construire ; soit on l'aligne sur `/mike`,
  soit on redirige `/` vers `/mike`.

---

## 4. Données, auth et rôles

### Supabase
Projet `zxbhfcihivgihytmxczl`. L'URL et la **clé anon** sont en dur dans
`app.html` — c'est normal, elle est publique par conception. **Toute la
sécurité repose sur les RLS**, jamais sur le code client.

**Table `expenses`**
`id, date, merchant, amount, amount_chf, tva, category, currency, status
('pending'|'reconciled'), note, ubs_label, ubs_date, amt_diff, receipt_url
(en fait un *chemin* storage, cf. plus bas), receipt_name, app_channel
('mike'|'test'), submission_status ('pending'|'to_submit'|'submitted'),
submitted_at`

**Table `app_profiles`**
`user_id (→ auth.users), role ('user'|'finance'), app_channel
('mike'|'test'|'all')`

**Bucket storage `receipts`** — cloisonné par dossier = canal
(`mike/<timestamp>_<rand>.jpg`). Les vieux reçus de Mike sont à la racine du
bucket ; les policies les traitent via `coalesce(folder,'mike')`.

**Migrations** — à appliquer manuellement, dans cet ordre :
`supabase-add-app-channel.sql` → `supabase-add-submission-status.sql` →
`supabase-auth-rls.sql`.
⚠ `supabase-auth-rls.sql` contient encore les placeholders
`MIKE_EMAIL_A_REMPLACER` / `FINANCE_EMAIL_A_REMPLACER`.

### Auth
`notesfrais-access.js` injecte un composant `AccessGate` qui enveloppe
`<App/>`. Login email + mot de passe Supabase **obligatoire**
(`NOTESFRAIS_REQUIRE_SUPABASE_AUTH = true`). Les anciens codes locaux
(`MIKE2026` / `FINANCE2026`) sont désactivés mais le code mort est resté.

Après login, `AccessGate` lit `app_profiles` et publie deux globales que
**tout le reste du code lit** :

```js
window.notesFraisRole      // 'user' | 'finance' | null
window.notesFraisProfile   // { role, app_channel }
```

C'est le mécanisme central de bascule d'UI. `notesfrais-test-finance-settings.js`
les assigne aussi en synchrone dans le rendu de `AccessGate` (sans quoi elles
arrivent trop tard pour le `useState` initial de `tab`).

### Les deux rôles
- **`user`** → onglets `Frais` (`expenses`), `Stats`, `UBS`. Saisit,
  photographie, soumet son mois.
- **`finance`** → onglets `Finance` (dashboard par mois), `Frais`
  (`finance_expenses`, avec export ZIP des justificatifs), `Stats`, `UBS`,
  `Paramètres` (mapping comptable). Voit tous les canaux.

### Triple cloisonnement des canaux
Défense en profondeur — modifier l'un sans les autres crée des fuites :
1. **RLS** — un `user` ne lit que les lignes de `app_channel = son canal`.
2. **Client** (`notesfrais-channel-isolation.js`) — filtre `belongsToNotesFraisChannel`
   au retour de `fetchExpenses`, et écrit un marqueur base64 `[NF:meta:...]`
   dans `note` (+ legacy `[NF:test]`) pour les lignes antérieures à la
   colonne `app_channel`.
3. **Storage** (`notesfrais-channel-storage.js`) — préfixe le canal dans le
   chemin du fichier.

### Justificatifs : chemins, pas URLs
`notesfrais-storage-secure.js` a fait passer le bucket de public à privé.
Depuis :
- la colonne `receipt_url` stocke un **chemin storage**, pas une URL ;
- côté JS l'expense expose `receiptPath` (et `receiptUrl` en alias) ;
- l'affichage passe par `getReceiptUrl(path, download?, name?)` qui crée une
  **URL signée valable 300 s**.

**Ne jamais réintroduire de `<img src={e.receiptUrl}>` ou de `<a href>`
direct** : ça ne marchera plus. Passer par `getReceiptUrl` ou `<Thumb path=…>`.

---

## 5. Quelle fonctionnalité vit dans quel patch

Ordre de chargement de `mike.html` (le canal test est identique moins
`mike-en`/`mike-final-en`, plus `test-user-expenses`) :

| # | Patch | Ce qu'il fait |
|---|---|---|
| 1 | `patches.js` | Base : vrai `StatsTab`, selects mois/nav en mobile, carte de marque « NUMERIQ PAYROLL », inputs 16px iOS. |
| 2 | `submit-summary.js` | Modale « Résumé avant soumission ». |
| 3 | `pwa.js` | Injecte manifest + enregistrement du SW selon le canal. |
| 4 | `storage-secure.js` | Bucket privé, URLs signées, `receiptPath`. |
| 5 | `channel-storage.js` | Préfixe canal dans les chemins storage. |
| 6 | `ocr-boost.js` | OCR Tesseract.js (chargé à la volée du CDN) + prétraitement image (binarisation adaptative) + extraction montant/TVA/date/commerçant. |
| 7 | `offline.js` | File d'attente IndexedDB (`notesfrais-offline-v1`), resync sur `online`. |
| 8 | `offline-fixed.js` | Timeout de fetch 6,5 s → « mode local », marquage canal dans la file. |
| 9 | `channel-isolation.js` | Marqueurs `[NF:meta:…]`, filtrage client, fallback si `app_channel` absent. |
| 10 | `sync-status.js` | Réécrit en DOM la pastille « Supabase connecté » (n à synchroniser / hors ligne). |
| 11 | `flow.js` | Brouillon auto du formulaire (localStorage, 7 j) + champ de recherche dans l'historique. |
| 12 | `meal-context.js` | Champ « Avec qui ? » sur la catégorie repas → préfixé dans `note`. |
| 13 | `current-month.js` | Mois par défaut = mois courant (fallback `2026-03`). |
| 14 | `test-payment-card.js` | Champ obligatoire « Carte utilisée » (entreprise/perso) → écrit dans `note`, badge 💳 dans les listes. |
| 15-16 | `test-annual-stats.js`, `-fix.js` | **`loadData` charge les 12 mois en parallèle** (indispensable au dashboard finance et aux stats annuelles) + `StatsTab` avec bascule année/mois. |
| 17 | `test-history-annual.js` | Largement supplanté par `-fix.js`. Ne reste efficace que sur 3 remplacements ; les 5 autres sont des fallbacks inertes. |
| 18 | `test-search-dedupe.js` | Déduplique le champ de recherche si deux inputs identiques deviennent adjacents. Le cas ne se produit plus depuis `period-inside-tabs.js` : le patch tourne mais ne fait rien. Filet de sécurité, à garder. |
| 19 | `access.js` | `AccessGate` (login Supabase, rôles). |
| 20 | `test-submission-badge.js` | Badge de statut de soumission + `submitCurrentMonth()` (UPDATE Supabase + appel `/api/notify-submission`). |
| 21-24 | `test-finance-settings/-dashboard/-expenses/-receipts-zip.js` | Tout l'espace finance : mapping comptable, dashboard mensuel, tableau des frais, export ZIP (JSZip depuis le CDN). |
| 25 | `delight.js` | Micro-interactions DOM. |
| 26 | `mobile-cleanup.js` | Masque le bloc d'actions desktop en mobile. |
| 27 | `test-sticky-nav.js` | Barre d'onglets fixe en bas + gros CTA « Scan receipt ». **Pur DOM, `setInterval` 150 ms**, pilote l'app en simulant des `change` sur le `<select>` de nav. |
| 28 | `test-modal-fix.js` | Force la modale d'ajout en feuille plein écran sur iOS. |
| 29 | `test-period-inside-tabs.js` | **Étend `MONTHS` aux 12 mois de 2026** + sélecteur de période Mois / Plage / Toute l'année dans chaque onglet. |
| 30 | `test-compress.js` | Compresse la photo (max 1800 px, JPEG q .78) avant OCR et upload. |
| 31 | `test-finance-submissions.js` | Vue finance des mois soumis. |
| 32-33 | `mike-en.js`, `mike-final-en.js` | Traduction FR → EN de tout le HTML final, par `split()/join()` de paires. Tout libellé français ajouté par un patch **antérieur** doit avoir sa paire ici. |
| 34 | `delete-confirm.js` | Boîte de confirmation avant suppression d'un frais. `deleteExpense` n'efface plus : il ouvre la modale, donc **tous les appelants sont couverts, présents et futurs**. Chargé **après** les traductions, il porte donc ses deux langues lui-même. |

Le test suite refuse tout `notesfrais-*.js` présent sur le disque et chargé par
aucune page — donc pas de fichier orphelin qui traîne.

---

## 6. Ajouter ou modifier une fonctionnalité

### Créer un nouveau patch

1. Copier le squelette de `notesfrais-test-compress.js`. Marqueur
   d'idempotence **versionné** (`NOTESFRAIS_MA_FEATURE_V1`) — l'incrémenter à
   chaque changement de forme du patch.
2. Copier la chaîne cible **depuis le HTML réellement produit**, pas depuis
   `app.html`, dès qu'un patch antérieur y a touché :
   ```bash
   node tools/check-patches.js test
   grep -o 'ma chaîne cible.\{0,120\}' .patch-out/out-test.html
   ```
3. L'ajouter à `test.html` (tableau `patchFiles`), à la **bonne position**
   dans l'ordre.
4. L'ajouter à `SHELL_FILES` dans `test-sw.js` **et bumper `CACHE_NAME`**
   (`notesfrais-test-shell-v30` → `v31`).
5. `node tools/test-patches.js` doit rester vert, et `node tools/check-patches.js
   test` ne doit pas montrer de nouveau no-op sur ton fichier. Vérifier au grep
   dans `.patch-out/out-test.html` que la modification est bien présente. Si le
   patch ajoute une fonctionnalité durable, lui ajouter un marqueur dans
   `REQUIRED` de `tools/test-patches.js`.
6. Tester sur `/test`, puis promouvoir : mêmes gestes sur `mike.html` +
   `mike-sw.js` (bumper `notesfrais-mike-shell-vN`).

### Les 4 pièges qui coûtent le plus cher

1. **Oublier le SW.** HTML, SW et cache doivent bouger ensemble. Le fichier
   ajouté à `mike.html` mais absent de `mike-sw.js` fait échouer le
   `fetch()` hors ligne → l'app entière affiche « Unable to load NotesFrais ».
2. **Ne pas bumper `CACHE_NAME`.** Les PWA installées continuent de servir
   l'ancien shell. Les SW sont en network-first, donc en ligne ça passe — le
   bug ne se voit qu'en offline ou au premier chargement. Bumper systématiquement.
3. **Ajouter du français sans sa traduction.** Tout libellé FR introduit par
   un patch doit avoir sa paire dans `mike-final-en.js` (**pas**
   `mike-en.js`, qui est mal encodé, cf. §8).
4. **Renommer un libellé visible.** `sticky-nav.js`, `delight.js`,
   `mobile-cleanup.js`, `sync-status.js`, `modal-fix.js` et le script du logo
   trouvent leurs éléments par `textContent`. Changer « + Ajouter un frais »
   casse la barre de nav mobile.

5. **Sur `/mike`, la traduction renomme aussi les identifiants JS.**
   `mike-en.js` et `mike-final-en.js` appliquent leurs paires par
   `split()/join()` sur **tout le document**, y compris le code. Les paires
   `['frais','expenses']` et `['Frais','Expenses']` transforment donc
   `window.notesFraisRole` en `window.notesExpensesRole`,
   `belongsToNotesFraisChannel` en `belongsToNotesExpensesChannel`, la clé
   `notesfrais_access` en `notesexpenses_access`… **Ça ne marche que parce que
   la substitution est appliquée en dernier, uniformément, à tout le HTML final.**
   Conséquences :
   - ne jamais lire `window.notesFraisRole` depuis un script **externe** au
     document généré : sur `/mike` la globale ne porte pas ce nom ;
   - les constantes en MAJUSCULES (`NOTESFRAIS_*`) ne sont pas touchées — s'en
     servir pour tout ce qui doit rester stable entre canaux.

   Deux emplacements possibles pour un nouveau patch, à choisir consciemment :
   **avant** les traductions, et il faut alors ajouter ses paires dans
   `mike-final-en.js` ; ou **après**, et le patch porte lui-même ses deux
   langues via `window.NOTESFRAIS_CHANNEL==='mike'` (c'est ce que font
   `meal-context.js` et `delete-confirm.js`). La seconde voie est plus sûre
   pour tout texte neuf. En contrepartie, un patch placé après les traductions
   doit cibler du code **déjà traduit** : viser des identifiants sans le mot
   « frais », ou passer par une expression régulière.

---

## 7. Détails de fonctionnement utiles

- **Chargement des données.** Depuis `test-annual-stats.js`, `loadData`
  déclenche **12 requêtes Supabase en parallèle** (une par mois de `MONTHS`)
  et concatène. `expenses` contient donc toute l'année ; `mE` est la
  projection sur la période choisie.
- **Filtre de période.** `periodMode` (`'month'|'range'|'year'`) +
  `periodFrom`/`periodTo` calculent `periodStart`/`periodEnd`, et `mE` filtre
  par comparaison de chaînes ISO. La soumission n'est possible qu'en mode
  `'month'`.
- **Réconciliation UBS.** `parseUBS` lit le CSV e-banking (`;`, dates
  `JJ.MM.AAAA`, apostrophes de milliers). `reconcile()` apparie sur montant
  (tolérance) + proximité de date + score de similarité de libellé
  (`labelScore`). Sortie : expenses `reconciled` avec `ubsRow`/`amtDiff`, et
  `forgotten` = lignes UBS sans frais correspondant, créables en un clic.
- **Soumission.** `submitCurrentMonth()` fait un `UPDATE` en masse
  (`submission_status='submitted'`, `submitted_at`) sur les ids du mois, puis
  `POST /api/notify-submission`. L'échec du mail ne fait pas échouer la
  soumission (notification d'avertissement).
- **Env vars Vercel** : `RESEND_API_KEY`, `SUBMISSION_MAIL_FROM`,
  `FINANCE_NOTIFICATION_EMAIL` (défaut `numeriqpayroll1@gmail.com`). Sans
  clé Resend, l'API répond `{ok:true, skipped:true}` et l'app affiche
  « email non envoyé ».
- **Offline.** IndexedDB `notesfrais-offline-v1`, store `expenses`, un champ
  `channel` par entrée. Le fichier est sérialisé en data-URL base64.
  Resync sur l'événement `online` et au montage.
- **CDN externes**, tous chargés à l'exécution : React 17, ReactDOM 17,
  Babel Standalone 7.23, supabase-js 2, Google Fonts (DM Sans / DM Mono),
  Tesseract.js 4 (à la première photo), JSZip 3.10 (au premier export ZIP).

---

## 8. Bugs connus et dette (vérifiés, pas supposés)

État constaté avec `tools/check-patches.js` sur le HEAD actuel.

### A. Double encodage UTF-8 — la cause racine
Plusieurs fichiers ont été sauvés une fois de trop en UTF-8 : `é` y est écrit
`Ã©` (octets `C3 83 C2 A9`) au lieu de `C3 A9`. `app.html` est correct, donc
**toute chaîne cible accentuée dans ces fichiers ne matche rien**.

Fichiers touchés : `notesfrais-mike-en.js` (le plus grave),
`notesfrais-flow.js`, `notesfrais-meal-context.js`,
`notesfrais-test-payment-card.js`, `notesfrais-test-search-dedupe.js`, et le
`<title>` d'`app.html`.

Détection :
```bash
grep -l 'Ã©\|Ã¨\|Ã \|â€' *.js *.html
```

Conséquences réelles :

1. **UI anglaise incomplète sur `/mike`.** 33 des 124 paires de
   `notesfrais-mike-en.js` échouent. ~14 chaînes françaises restent visibles
   pour Mike : « Relevé UBS » (7 occurrences), « Paramètres » (5),
   « Importer relevé UBS », « Réconciliation automatique », « Résumé avant
   soumission », « Détail par catégorie », « Aucun relevé UBS importé »,
   « Le commerçant est obligatoire », « stocké dans Supabase », « OCR en
   cours », « Créer », « à régulariser », « Optionnel », « Soumettre ».
   `notesfrais-mike-final-en.js` (correctement encodé) rattrape le reste —
   **c'est là qu'il faut ajouter les paires manquantes.**

2. **Le toast « Scanner un autre » est du code mort.** Dans
   `notesfrais-flow.js`, les deux `replace()` censés ajouter
   `setQuickAdd(true)` visent des chaînes mojibakées. Résultat dans le HTML
   final : l'état `quickAdd` et le JSX du toast existent, `setQuickAdd(true)`
   apparaît **0 fois**. Le toast ne peut jamais s'afficher, sur aucun canal.

3. **Le bouton « × » de la modale d'ajout efface le brouillon** au lieu de le
   garder, pour la même raison (le `replace()` correctif ne matche pas ;
   seul « Garder en brouillon » préserve la saisie).

### B. Tout est câblé en dur sur l'année 2026
`MONTHS` est une liste littérale des 12 mois de 2026, `StatsTab` affiche
« Annee 2026 », `getDefaultNotesFraisMonth()` retombe sur `2026-03` si le mois
courant n'est pas dans `MONTHS`. **Au 1er janvier 2027 l'app se bloque sur
mars 2026 et ne charge plus aucune donnée récente.** À rendre glissant
(générer `MONTHS` depuis la date courante).
Sur le canal racine `/`, où `test-period-inside-tabs.js` n'est pas chargé,
`MONTHS` s'arrête à juin 2026 — **le problème est déjà actif là-bas.**

### C. Boucles `setInterval` permanentes
`sticky-nav` (150 ms), `modal-fix` (150 ms), `history-annual` (500 ms),
`sync-status` (4 s) tournent en continu, plus `mobile-cleanup` (300 ms) et
l'injection du logo (250 ms) pendant les premières secondes. Chaque tick fait
des `querySelectorAll` sur tout le document. Coûteux en batterie sur mobile,
et source de scintillements. À migrer vers de vrais composants React dans les
patches quand on y touche.

### D. Divers
- `mobile-cleanup.js` ne matche que le libellé français `+ Ajouter un frais` :
  sur `/mike` (anglais) le bloc d'actions desktop n'est donc pas masqué en
  mobile.
- `index.html` et `iphone-fix.html` sont deux copies identiques. `vercel.json`
  sert `iphone-fix.html` sur `/` ; `index.html` ne sert que de repli au
  comportement par défaut de l'hébergeur. Toute modif doit aller dans les deux.
- `supabase-auth-rls.sql` n'est pas exécutable en l'état (emails placeholder).

### E. Déjà nettoyé (ne pas réintroduire)
- Codes d'accès en dur `MIKE2026` / `FINANCE2026` et tout le chemin de login
  « code local » : supprimés de `notesfrais-access.js`. L'auth Supabase est la
  seule voie ; `tools/test-patches.js` échoue si ces chaînes reviennent.
- `notesfrais-test-submission-status.js` et `-v2.js` : orphelins supprimés.
- La modale `submitModal` dupliquée dans `notesfrais-patches.js` : sa cible ne
  matchait pas (espace finale parasite) et `notesfrais-submit-summary.js` fait
  le travail. Supprimée.

---

## 9. Git et déploiement

- Déploiement Vercel sur push `main`. Pas de CI, pas de tests.
- Développer sur une branche, ouvrir une PR — **ne jamais pousser sur `main`
  sans demande explicite.**
- Après déploiement, forcer le rechargement du SW sur mobile (fermer la PWA,
  la rouvrir) sinon on teste l'ancien shell.
- Style de commit du repo : une ligne, impératif anglais
  (`Fix finance submitted month view on test`).
