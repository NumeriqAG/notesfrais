# Product

<!-- impeccable:product-schema 1 -->

## Platform

web — installée en PWA sur iPhone, c'est le mode d'usage réel. Le design mobile
vise le langage natif iOS, mais la plateforme reste le web.

## Users

**Mike** — salarié de Numeriq AG (Suisse), utilisateur unique aujourd'hui. Il
engage des frais professionnels et doit les justifier : repas, transport, hôtel,
matériel.

Deux rythmes de saisie coexistent, et **aucun des deux n'est secondaire** :

- **Sur le vif** — il photographie le ticket au moment de payer. Debout, une
  main, lumière quelconque, réseau parfois faible.
- **Par salves** — il accumule les tickets et les saisit d'un coup, assis au
  calme, en enchaînant plusieurs frais.

**La finance** — contrôle et exporte. *Fait produit : son espace dans l'app est
prévisionnel, personne ne s'en sert réellement à ce jour.* Le circuit vivant est
l'email mensuel avec les justificatifs en ZIP.

**Question ouverte** : l'app restera-t-elle sur mesure pour Mike, ou servira-t-elle
d'autres collaborateurs ? Non tranché. Concevoir pour un utilisateur unique
aujourd'hui sans fermer la porte.

## Product Purpose

Transformer un ticket de caisse en pièce comptable sans ressaisie, et clore le
mois en un geste. Le succès se mesure à deux choses : aucun justificatif perdu,
et un mois soumis sans que Mike ait eu à recopier quoi que ce soit.

## Positioning

Outil sur mesure d'une seule entreprise, pas un produit générique. Deux
mécanismes propres :

- **La réconciliation UBS** — l'import du CSV e-banking apparie automatiquement
  les frais saisis avec les débits réels, et fait apparaître les dépenses
  bancaires sans justificatif. Personne ne ressaisit un relevé.
- **La soumission mensuelle en un geste** — clôture du mois, construction du ZIP
  des justificatifs et envoi à la finance dans la même action.

## Operating Context

- **iPhone, en PWA installée.** Écran unique, souvent une main, hors ligne
  possible : une file d'attente locale conserve les frais et les synchronise au
  retour du réseau.
- **Suisse, CHF, TVA récupérable.** Les montants et la TVA sont des données
  comptables, pas des décorations.
- **Le justificatif est la pièce.** Le ticket papier est souvent jeté juste
  après la photo — l'app est la seule copie. Toute action destructive doit être
  traitée en conséquence.
- **Cycle mensuel.** Saisie au fil de l'eau, puis réconciliation et soumission en
  fin de mois. Un mois soumis est clos : plus modifiable par l'utilisateur.

## Capabilities and Constraints

**Ce que l'app sait faire** : capture photo avec OCR (montant, TVA, date,
commerçant), plusieurs justificatifs par frais, catégories, carte utilisée
(entreprise/perso), contexte repas, brouillon automatique, recherche, file
d'attente hors ligne, réconciliation UBS, statistiques, soumission mensuelle
avec ZIP, édition et suppression confirmée.

**Contraintes techniques durables**, décisives pour toute refonte :

- Le visuel vit dans **537 styles inline** contre 20 classes CSS, injectés par
  **remplacement de chaînes exactes** dans un `app.html` gelé, à travers
  40 patches. Un remplacement qui ne matche pas échoue **en silence**.
- Les **15 jetons de couleur** du `:root` sont référencés partout via `var(--…)`.
  Les redéfinir repeint toute l'app sans toucher un style inline.
- Sous 860 px, `ios-ui.js` pose déjà une couche iOS ; `sticky-nav.js` construit
  la navigation basse **en manipulant le DOM et en repérant ses cibles par leur
  texte visible**. Renommer un libellé la casse.
- L'interface anglaise de `/mike` est produite par substitution sur le document
  final, **identifiants JS compris** : éviter `frais`/`Frais` dans tout nom de
  classe ou d'identifiant.
- **Tout est câblé sur l'année 2026** ; l'app se figera au 1er janvier 2027.

## Brand Commitments

Numeriq AG. Le bleu `#1A3FB5` et la carte « NUMERIQ PAYROLL » de l'écran d'accueil
sont l'identité existante. *Aucune charte formelle n'a été fournie* — à confirmer
avant de traiter ces éléments comme intouchables.

## Evidence on Hand

- `design/current-ui-mike.html` — l'interface réellement exécutée, générée par la
  chaîne de patches. **Seule source visuelle fiable** : `app.html` seul est un
  socle de 2026 qui ne correspond plus à l'écran.
- `CLAUDE.md` — architecture, droits, dette technique vérifiée.
- Préproduction sur `/test`, miroir exact de la production.
