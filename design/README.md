# Refonte visuelle — ce qu'il faut savoir avant de dessiner

## Lire la bonne interface

**Ne pas se baser sur `app.html`.** C'est le socle gelé de 2026 : `StatsTab` y
affiche encore « Vue détaillée à venir », il n'y a ni espace finance, ni
sélecteur de période, ni navigation mobile, ni édition d'un frais.

L'interface réelle est le résultat de **40 patches** appliqués à `app.html` au
chargement de la page. Elle est reproduite ici :

**`design/current-ui-mike.html`** — exactement ce que le navigateur exécute.
Régénérer avec `node tools/check-patches.js mike`.

Le React se trouve dans le `<script type="text/babel">` en bas du fichier.

## La contrainte qui décide de tout

| | Compte |
|---|---|
| Styles inline `style={{…}}` | **537** |
| `className=` | 20 |
| Blocs `<style>` | 4 |

Le visuel est écrit **directement dans le JSX**, et ce JSX est injecté par
**remplacement de chaînes exactes** dans un fichier gelé. Il n'y a presque pas
de feuille de style à modifier.

Conséquence : une maquette qui suppose des classes utilitaires ou un système de
composants se traduirait par des centaines de remplacements de chaînes, chacun
capable d'échouer **en silence** — c'est le mode de panne principal du dépôt.

## Les trois leviers, par rapport effet/risque

**1 · Les jetons de couleur — effet maximal, risque nul.**
15 variables CSS dans le `:root` d'`app.html`, référencées partout via
`var(--…)`. Les redéfinir repeint toute l'application sans toucher un seul
style inline.

```
--bg #F5F3EF   --w #fff       --s2 #EDEBE6   --border #E2DED8
--text #1A1A1A --t2 #6B6560   --t3 #9E9892
--accent #2D5BE3  --al #EEF2FD
--green #0F6E56   --gl #E1F5EE     (succès)
--amber #BA7517   --aml #FAEEDA    (attente)
--red #A32D2D     --rl #FCEBEB     (erreur)
```

Polices : **DM Sans** (texte) et **DM Mono** (montants), via Google Fonts.

**2 · Un bloc `<style>` injecté — effet fort, risque moyen.**
Typographie, espacements, rayons, ombres, états de survol. Il en existe déjà 4,
dont celui d'`ios-ui.js`. C'est la voie pour tout ce qui est structurel.

**3 · Retoucher les styles inline — à éviter.**
537 cibles, chacune un remplacement de chaîne exacte. À réserver aux écrans
qu'on refait entièrement.

## L'existant à connaître

`notesfrais-ios-ui.js` pose déjà une couche visuelle iOS **en dessous de
860 px** : police SF Pro, fond `#f2f2f7`, en-tête collant avec flou, classes
`nf-ios-*`. C'est pourquoi mobile et desktop ne se ressemblent pas — toute
refonte doit décider si elle conserve, étend ou remplace cette couche.

`notesfrais-test-sticky-nav.js` ajoute la barre d'onglets fixe et le bouton
« Scan receipt », **en manipulant le DOM toutes les 150 ms** et en repérant ses
cibles par leur **texte visible**. Renommer un libellé casse la navigation
mobile.

## Les écrans réels

**Utilisateur** — `home` (tableau de bord), `expenses` / `history` (liste),
`stats`, `recon` (réconciliation UBS).

**Finance** — `finance` (dashboard mensuel), `finance_expenses` (tableau),
`stats`, `recon`, `settings` (paramètres comptables).

**Transverses** — écran de connexion (`AccessGate`), modale d'ajout d'un frais
(plein écran sur iOS), modale de résumé avant soumission, modale de
confirmation de suppression, visionneuse de justificatif.

**États à ne pas oublier** — liste vide, chargement, erreur de connexion, mode
hors ligne avec file d'attente, mois soumis (verrouillé, badge « Closed »).

## Deux langues

`/mike` est en anglais, produit par substitution sur le HTML final. Les paires
`['frais','expenses']` et `['Frais','Expenses']` s'appliquent à **tout le
document, code compris**. Éviter donc ces mots dans un nom de classe ou
d'identifiant : ils seraient réécrits.
