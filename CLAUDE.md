# NotesFrais — guide de travail

Application de notes de frais de **Numeriq AG** (Suisse, CHF). Mike photographie
ses reçus, l'app les OCRise, les stocke, les réconcilie avec un relevé bancaire
UBS, puis le mois est « soumis » à la finance qui contrôle et exporte.

**Il n'y a pas de build front.** Pas de bundler, pas de framework de test. React
est chargé par CDN et compilé dans le navigateur par Babel Standalone. Le seul
`package.json` sert aux fonctions serverless. On déploie en poussant sur `main`
(Vercel).

---

## 1. L'architecture — à lire avant toute modification

Deux moitiés indépendantes.

### Le front : une chaîne de patches sur un fichier gelé

Le cœur est **`app.html`** : un fichier unique qui contient tout le React inline
dans un `<script type="text/babel">`. Mais **il n'est jamais servi directement**.
`mike.html` fait ceci :

```js
let html = await (await fetch('/app.html')).text();   // 1. le source en TEXTE
for (const file of patchFiles) {                       // 2. chaîne de 40 patches
  new Function(await (await fetch('/'+file)).text())();
}
html = window.patchNotesFrais(html);                   // 3. réécriture du source
document.open(); document.write(html); document.close();// 4. exécution
```

Chaque `notesfrais-*.js` **enveloppe** `window.patchNotesFrais` en décorateur et
applique des `html.replace('<code source exact>', '<nouveau code>')` :

```js
(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;      // les patches précédents d'abord
    if (html.includes('MON_MARQUEUR_V3')) return html;  // idempotence
    html = html.replace("<code exact>", "<remplacement>");
    return html;
  };
})();
```

**Conséquences directes :**

1. **`app.html` est gelé.** Presque tout vit dans les patches. Le modifier casse
   silencieusement ceux qui ciblaient le code d'avant.
2. **L'ordre des patches est du code.** Un patch B qui cible du code produit par
   A doit être chargé après A. Cet ordre n'existe que dans le tableau
   `patchFiles` de `mike.html`.
3. **Un `.replace()` qui ne matche pas ne lève aucune erreur.** Il retourne la
   chaîne inchangée. Une espace en trop, un accent mal encodé, un patch antérieur
   qui a déjà réécrit la cible → la fonctionnalité disparaît sans un message.
   C'est le mode de panne n°1 du dépôt.
4. Certains patches n'agissent pas sur le source mais **injectent un `<script>`
   qui manipule le DOM en boucle** (`setInterval`). Ils ciblent des éléments par
   leur **texte visible** — donc ils cassent quand on renomme un libellé.

### Le back : Vercel Functions + Neon + R2

Depuis la migration (branche `codex/neon-backend`, fusionnée), il n'y a plus de
base côté client. Le front parle à des routes serverless :

| Route | Rôle |
|---|---|
| `POST/GET/DELETE /api/session` | Login, lecture de session, logout. Cookie signé. |
| `GET/POST/PATCH/DELETE /api/expenses` | CRUD des frais. **Impose le canal et les droits.** |
| `GET/POST/DELETE /api/receipts` | Upload, URL signée et suppression des justificatifs dans R2. |
| `POST /api/monthly-submission` | Clôture le mois + email à la finance **avec les justificatifs en ZIP**. |
| `POST /api/notify-submission` | Email de notification simple. Probablement supplanté par la route ci-dessus — à vérifier avant de s'en servir. |

Le pont entre les deux moitiés est **`notesfrais-api-backend.js`**. Il remplace
par expression régulière tout le bloc

```js
const SUPABASE_URL='…'; const SUPABASE_KEY='…';
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
```

par un objet `sb` **de même forme** (`.from(table).select()…`, `.storage.from()…`)
qui route vers `/api/*`. Tout le code applicatif écrit à l'époque Supabase
continue donc de fonctionner sans être réécrit.

⚠ **`app.html` contient encore l'URL et la clé anon Supabase** (2 occurrences).
Elles sont retirées du HTML final par ce patch — vérifié, 0 occurrence en sortie
— mais restent du code mort dans le source. À nettoyer.

### Vérifier ses patches : `tools/check-patches.js`

Rien ne signale un `replace()` sans effet, donc un harnais rejoue la chaîne hors
navigateur et les liste :

```bash
node tools/check-patches.js mike
```

Il écrit le HTML final dans `.patch-out/out-mike.html` — **exactement ce que le
navigateur exécute**. Toujours le lancer avant de commiter, et grepper le
résultat. Tous les no-op ne sont pas des bugs (beaucoup sont des fallbacks
volontaires) — mais un **nouveau** no-op sur ton patch, si.

### Les tests anti-régression : `tools/test-patches.js`

```bash
node tools/test-patches.js                     # avant chaque commit
node tools/test-patches.js --update-baseline   # si une évolution est voulue
```

Le seul filet de sécurité du dépôt. Il vérifie :

1. **Listes** — chaque patch listé existe ; `SHELL_FILES` de `mike-sw.js` est
   aligné sur `mike.html` ; aucun `notesfrais-*.js` orphelin ; `index.html` et
   `iphone-fix.html` sont des copies conformes de `mike.html`.
2. **Exécution** — la chaîne tourne sans exception et produit un HTML complet.
3. **Fonctionnalités** — une vingtaine de marqueurs dans le HTML généré (routes
   API, OCR, hors ligne, dashboard finance, export ZIP, nav mobile, édition,
   justificatifs multiples, confirmation de suppression…), plus des interdits :
   aucun code d'accès en dur, plus aucun client Supabase.
4. **Baseline** (`tools/patch-baseline.json`) — le nombre de `replace()` sans
   effet **par fichier** ne doit jamais augmenter, ni le mojibake par fichier.
5. **Compilation JSX** — le script généré est réellement compilé avec la version
   exacte de Babel Standalone chargée en production. C'est la vérification la
   plus forte du dépôt : un patch qui produit du JSX invalide rend l'application
   entièrement blanche. Le bundle (2,8 Mo) n'est pas versionné — téléchargé une
   fois dans `.patch-out/`, et le test est sauté sans échouer si le réseau manque.

Le point 4 attrape la panne caractéristique du projet : ajouter une espace dans
une chaîne cible laisse tous les marqueurs au vert mais fait échouer la baseline.
Les deux couches sont complémentaires — ne pas en retirer une.

---

## 2. Carte du repo

| Fichier | Rôle |
|---|---|
| `app.html` | Le socle React. `App`, `AddModal`, `UBSModal`, `ReceiptViewer`, `Thumb`, `Badge`, `StatsTab`. Parseur CSV UBS + moteur de réconciliation. |
| `mike.html` | Page d'entrée = **liste ordonnée des 40 patches**. |
| `index.html`, `iphone-fix.html` | Replis, copies conformes de `mike.html` (un test l'impose). `vercel.json` sert `mike.html` sur `/`. |
| `notesfrais-*.js` | Les patches (§4). |
| `mike-sw.js` | Service worker. |
| `api/*.js` | Les routes serverless. |
| `api/_lib/auth.js` | Cookie signé, comptes, limitation des tentatives. |
| `api/_lib/db.js` | Client Neon, normalisation des frais. |
| `api/_lib/r2.js` | Stockage Cloudflare R2. |
| `api/_lib/receipt-email.js` | Copie des reçus par email. |
| `db/schema.sql` | Schéma Postgres. |
| `scripts/hash-password.mjs` | Génère une empreinte pour `NOTESFRAIS_USERS`. |
| `tools/check-patches.js` | Rejoue la chaîne, liste les `replace()` sans effet. |
| `tools/test-patches.js` | Tests anti-régression. **Avant chaque commit.** |
| `MIGRATION-SUPABASE.md` | Journal de la migration, écrit par Codex. |

---

## 3. Données, auth et droits

### Base Neon
Un seul client, `api/_lib/db.js`. `ensureSchema()` applique les migrations
légères au vol. Le schéma de référence est `db/schema.sql`.

**Table `expenses`** — `id, created_at, date, merchant, amount, amount_chf, tva,
category, currency, status ('pending'|'reconciled'), note, ubs_label, ubs_date,
amt_diff, receipt_url, receipt_name, receipt_items (jsonb), app_channel
('mike'|'test'), submission_status ('pending'|'to_submit'|'submitted'),
submitted_at`

**Table `login_attempts`** — limitation des tentatives de connexion, créée à la
demande.

**`receipt_items`** est la liste des justificatifs multiples,
`[{path, name}]`. `receipt_url`/`receipt_name` restent renseignés avec le
premier, pour compatibilité avec le code d'avant.

### Justificatifs : R2, jamais en direct
Clés de la forme `<canal>/<timestamp>_<aléa>.<ext>`. **Le bucket n'est jamais
exposé** : toute lecture passe par `GET /api/receipts`, qui renvoie une URL
signée ou sert le fichier. Ne jamais réintroduire d'`<img src>` pointant
directement sur R2.

### Auth
Cookie `notesfrais_session`, signé HMAC-SHA256 avec `NOTESFRAIS_COOKIE_SECRET`,
`HttpOnly` / `SameSite=Lax` / `Secure` en production, valable 14 jours.
Vérification en temps constant.

Deux façons de déclarer les comptes, par priorité :

1. **`NOTESFRAIS_USERS`** — tableau JSON, autant de comptes qu'on veut, avec
   `passwordHash` au format `scrypt$<sel>$<empreinte>` généré par
   `node scripts/hash-password.mjs 'secret'`.
2. Les quatre variables historiques `NOTESFRAIS_USER_*` / `NOTESFRAIS_FINANCE_*`,
   mots de passe en clair. Ignorées si la première est définie.

Après login, deux globales que **tout le front lit** :

```js
window.notesFraisRole      // 'user' | 'finance' | null
window.notesFraisProfile   // { role, app_channel }
```

### Les droits sont côté serveur, et seulement là
Il n'y a **pas de RLS** : Neon n'en a pas de configurées ici. Toute
l'autorisation vit dans les routes API. En conséquence, **chaque nouvelle route
doit refaire les contrôles elle-même** :

- `user` ne lit, modifie et supprime que `app_channel = sa valeur` ; `finance`
  voit tout.
- `app_channel` d'un frais créé est **forcé depuis la session**, jamais lu dans
  le corps de la requête.
- Un mois `submitted` est clos : un `user` ne peut plus rien y changer.
- L'accès à un justificatif est vérifié **deux fois** : préfixe de chemin, puis
  requête en base confirmant qu'il appartient à une dépense du canal. Lecture et
  suppression appliquent le même contrôle.

---

## 4. Quelle fonctionnalité vit dans quel patch

Ordre de chargement de `mike.html`, 40 patches. Les 34 premiers viennent de
l'époque Supabase et continuent de tourner grâce au shim.

| # | Patch | Ce qu'il fait |
|---|---|---|
| 1 | `patches.js` | Base : vrai `StatsTab`, selects mobiles, carte de marque, inputs 16px iOS. |
| 2 | `submit-summary.js` | Modale « Résumé avant soumission ». |
| 3 | `pwa.js` | Manifest + enregistrement du SW. |
| 4-5 | `storage-secure.js`, `channel-storage.js` | Chemins de justificatifs, préfixe de canal. |
| 6 | `ocr-boost.js` | OCR Tesseract.js + prétraitement image + extraction montant/TVA/date/commerçant. |
| 7-8 | `offline.js`, `offline-fixed.js` | File IndexedDB (`notesfrais-offline-v1`), resync, timeout 6,5 s → mode local. |
| 9 | `channel-isolation.js` | **Largement neutralisé** : `api-backend.js` réécrit le bloc où il s'injectait. Le cloisonnement est désormais serveur. |
| 10 | `sync-status.js` | Pastille d'état de synchronisation, en DOM. |
| 11 | `flow.js` | Brouillon auto du formulaire + recherche dans l'historique. |
| 12 | `meal-context.js` | Champ « Avec qui ? » sur la catégorie repas. |
| 13 | `current-month.js` | Mois par défaut = mois courant. |
| 14 | `test-payment-card.js` | Champ obligatoire « Carte utilisée », badge 💳. |
| 15-17 | `test-annual-stats*.js`, `test-history-annual.js` | Chargement des 12 mois, stats annuelles. |
| 18 | `test-search-dedupe.js` | Filet contre un doublon de champ de recherche. Inerte aujourd'hui. |
| 19 | `access.js` | `AccessGate` : écran de login, publication des globales de rôle. |
| 20 | `test-submission-badge.js` | Badge de statut + `submitCurrentMonth()`. |
| 21-24 | `test-finance-*.js` | Espace finance : paramètres comptables, dashboard, tableau des frais, export ZIP (JSZip). |
| 25-26 | `delight.js`, `mobile-cleanup.js` | Micro-interactions, masquage du bloc desktop. |
| 27-28 | `test-sticky-nav.js`, `test-modal-fix.js` | Nav fixe en bas + CTA scan ; modale plein écran iOS. **Pur DOM, `setInterval` 150 ms.** |
| 29 | `test-period-inside-tabs.js` | 12 mois + sélecteur Mois / Plage / Année. |
| 30-32 | `test-user-expenses.js`, `test-compress.js`, `test-finance-submissions.js` | Onglet Frais utilisateur, compression photo, vue des mois soumis. |
| 33-34 | `mike-en.js`, `mike-final-en.js` | Traduction FR → EN par `split()/join()` de paires. |
| 35 | **`api-backend.js`** | **Le shim** : remplace le client Supabase par un objet de même forme routant vers `/api/*`. |
| 36 | `multi-receipts.js` | Plusieurs justificatifs par dépense (`receipt_items`). |
| 37 | `english-ui.js` | 263 paires de traduction supplémentaires. |
| 38 | `ios-ui.js` | Ajustements iOS. |
| 39 | `user-edit.js` | **Édition d'un frais**, boutons Edit/Delete, état « Closed » sur un mois soumis. |
| 40 | `delete-confirm.js` | Confirmation avant suppression. `deleteExpense` n'efface plus : il ouvre la modale, donc **tous les appelants sont couverts, présents et futurs**. Chargé après les traductions, il porte ses deux langues lui-même. |

---

## 5. Ajouter ou modifier une fonctionnalité

### Créer un nouveau patch

1. Copier le squelette de `notesfrais-delete-confirm.js`. Marqueur d'idempotence
   **versionné** (`NOTESFRAIS_MA_FEATURE_V1`), à incrémenter à chaque changement
   de forme.
2. Copier la chaîne cible **depuis le HTML réellement produit**, jamais depuis
   `app.html`, dès qu'un patch antérieur y a touché :
   ```bash
   node tools/check-patches.js mike
   grep -o 'ma chaîne cible.\{0,120\}' .patch-out/out-mike.html
   ```
3. L'ajouter à `mike.html` à la **bonne position**, puis répercuter sur
   `index.html` et `iphone-fix.html` (`cp mike.html index.html`).
4. L'ajouter à `SHELL_FILES` dans `mike-sw.js` **et bumper `CACHE_NAME`**.
5. `node tools/test-patches.js` doit rester vert. Si le patch ajoute une
   fonctionnalité durable, lui ajouter un marqueur dans `REQUIRED`.

### Les cinq pièges qui coûtent le plus cher

1. **Oublier le SW.** HTML, SW et cache doivent bouger ensemble. Un fichier
   ajouté à `mike.html` mais absent de `mike-sw.js` fait échouer le `fetch()`
   hors ligne → l'app entière affiche « Unable to load NotesFrais ».
2. **Ne pas bumper `CACHE_NAME`.** Les PWA installées continuent de servir
   l'ancien shell. Le SW est network-first, donc en ligne ça passe — le bug ne
   se voit qu'en offline ou au premier chargement.
3. **Ajouter du français sans sa traduction.** Trois patches de traduction se
   superposent (`mike-en`, `mike-final-en`, `english-ui`, ~510 paires). Ajouter
   les paires dans `mike-final-en.js` ou `english-ui.js` — **pas** `mike-en.js`,
   mal encodé (§7).
4. **Renommer un libellé visible.** `sticky-nav`, `delight`, `mobile-cleanup`,
   `sync-status`, `modal-fix` et le script du logo trouvent leurs éléments par
   `textContent`.
5. **La traduction renomme aussi les identifiants JS.** Les paires
   `['frais','expenses']` et `['Frais','Expenses']` s'appliquent par
   `split()/join()` sur **tout le document, code compris** :
   `window.notesFraisRole` devient `window.notesExpensesRole`. Ça ne marche que
   parce que la substitution est uniforme et appliquée en dernier. Donc :
   - ne jamais lire `window.notesFraisRole` depuis un script **externe** au
     document généré ;
   - les constantes en MAJUSCULES (`NOTESFRAIS_*`) sont épargnées — s'en servir
     pour tout ce qui doit rester stable.

   **Deux emplacements possibles pour un nouveau patch**, à choisir sciemment :
   avant les traductions, et il faut alors ajouter ses paires ; ou après, et le
   patch porte lui-même ses deux langues via
   `window.NOTESFRAIS_CHANNEL==='mike'` (c'est ce que font `meal-context.js` et
   `delete-confirm.js`). La seconde voie est plus sûre pour tout texte neuf, mais
   impose de cibler du code **déjà traduit** : viser des identifiants sans le mot
   « frais », ou passer par une expression régulière.

### Toucher aux routes API

Il n'y a pas de RLS pour rattraper une erreur. Toute nouvelle route part de
`requireSession(req)` et refait les contrôles de §3. Relire `api/expenses.js`
comme modèle : liste blanche des champs modifiables, canal forcé depuis la
session, vérification que les ids demandés sont bien accessibles avant d'écrire.

---

## 6. Détails de fonctionnement utiles

- **Chargement des données.** `loadData` interroge les 12 mois en parallèle et
  concatène. `expenses` contient toute l'année ; `mE` est la projection sur la
  période choisie. Douze requêtes au démarrage — candidat à optimisation.
- **Filtre de période.** `periodMode` (`'month'|'range'|'year'`) +
  `periodFrom`/`periodTo` calculent `periodStart`/`periodEnd`. La soumission
  n'est possible qu'en mode `'month'`.
- **Réconciliation UBS.** `parseUBS` lit le CSV e-banking (`;`, dates
  `JJ.MM.AAAA`, apostrophes de milliers). `reconcile()` apparie sur montant
  (tolérance) + proximité de date + score de similarité de libellé. Sortie :
  frais `reconciled`, et `forgotten` = lignes UBS sans frais correspondant.
- **Soumission.** `POST /api/monthly-submission` avec `{month}` : passe le mois
  en `submitted`, **construit un ZIP des justificatifs et l'attache à l'email**
  envoyé à la finance. Timeout client de 90 s, avec étapes affichées.
- **Copie des reçus par email.** À chaque frais créé avec justificatif, un email
  part vers `RECEIPT_BACKUP_EMAIL` (défaut : l'email de la session).
- **Offline.** IndexedDB `notesfrais-offline-v1`, fichier sérialisé en data-URL
  base64. Resync sur l'événement `online` et au montage.
- **CDN externes**, chargés à l'exécution : React 17, ReactDOM 17, Babel
  Standalone 7.23, Google Fonts, Tesseract.js 4 (première photo), JSZip 3.10
  (premier export).

### Variables d'environnement

`DATABASE_URL` · `NOTESFRAIS_COOKIE_SECRET` (≥ 24 caractères) ·
`NOTESFRAIS_USERS` **ou** `NOTESFRAIS_USER_EMAIL/PASSWORD` +
`NOTESFRAIS_FINANCE_EMAIL/PASSWORD` · `R2_ACCOUNT_ID` · `R2_ACCESS_KEY_ID` ·
`R2_SECRET_ACCESS_KEY` · `R2_BUCKET` · `RESEND_API_KEY` ·
`FINANCE_NOTIFICATION_EMAIL` · `RECEIPT_BACKUP_EMAIL` · `RECEIPT_MAIL_FROM` ·
`SUBMISSION_MAIL_FROM`. Modèle complet dans `.env.example`.

---

## 7. Dette connue (vérifiée, pas supposée)

### A. Double encodage UTF-8
Plusieurs fichiers ont été sauvés une fois de trop en UTF-8 : `é` y est écrit
`Ã©` (`C3 83 C2 A9`) au lieu de `C3 A9`. `app.html` étant correct, **toute chaîne
cible accentuée dans ces fichiers ne matche rien**.

Touchés, mesuré sur le HEAD actuel : `notesfrais-mike-en.js` (46 séquences,
le plus grave), `notesfrais-flow.js` (5), `notesfrais-english-ui.js` (2),
`notesfrais-test-payment-card.js` (1), `app.html` (1, dans le `<title>`).

```bash
grep -c 'Ã©\|Ã¨\|Ã \|â€' *.js *.html | grep -v ':0'
```

Conséquences mesurées :

- **14 des 125 paires de `mike-en.js` n'aboutissent pas.** C'était 33 avant la
  migration : `english-ui.js` en rattrape la majorité. Deux libellés français
  restent visibles dans l'UI anglaise — « Résumé avant soumission » et « Détail
  par catégorie » (échantillon non exhaustif).
- **Le toast « Scanner un autre » est inatteignable** : l'état et le JSX existent,
  `setQuickAdd(true)` apparaît **0 fois** dans le HTML final.
- **La croix de la modale d'ajout efface le brouillon** au lieu de le garder ;
  seul « Garder en brouillon » préserve la saisie.

### B. Tout est câblé sur 2026
`MONTHS` est une liste littérale des douze mois de 2026, `StatsTab` affiche
« Annee 2026 », `getDefaultNotesFraisMonth()` retombe sur `2026-03`. **Au
1er janvier 2027 l'app se fige sur mars 2026.** À rendre glissant.

### C. Boucles `setInterval` permanentes
`sticky-nav` et `modal-fix` toutes les 150 ms, `history-annual` 500 ms,
`sync-status` 4 s. Chaque tick fait des `querySelectorAll` sur tout le document.
Coûteux en batterie, source de scintillements.

### D. Auth encore provisoire
Comptes déclarés en variables d'environnement. Pas de révocation : un cookie
signé reste valable 14 jours même après changement de mot de passe. Pas de trace
de qui fait quoi. Une vraie table utilisateurs reste à faire.

### E. Divers
- Le canal `test` n'a plus de page d'entrée, mais le schéma et les routes le
  supportent toujours (`app_channel = 'test'`). **Il n'y a donc plus de palier de
  préproduction** : tout déploiement va directement chez Mike.
- `app.html` garde 2 occurrences mortes de la clé Supabase.
- `/api/notify-submission` coexiste avec `/api/monthly-submission` ; vérifier
  lequel fait foi avant d'y toucher.
- `mobile-cleanup.js` ne matche que le libellé français `+ Ajouter un frais` :
  sur l'UI anglaise le bloc desktop n'est pas masqué en mobile.
- Douze requêtes Neon au démarrage, une par mois.

---

## 8. Git et déploiement

- Déploiement Vercel sur push `main`. Pas de CI.
- Développer sur une branche, ouvrir une PR — **ne jamais pousser sur `main`
  sans demande explicite.**
- Après déploiement, fermer et rouvrir la PWA sur mobile, sinon on teste
  l'ancien shell.
- Style de commit : une ligne, impératif anglais.
