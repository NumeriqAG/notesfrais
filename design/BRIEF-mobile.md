# Brief — refonte mobile de NotesFrais

À donner à Claude Design. Complète `PRODUCT.md` (vérité produit) et
`design/README.md` (contraintes d'implémentation).

## La décision

**Refonte complète**, pas un polissage. L'apparence actuelle est une
contre-référence : on garde la fonction, le contenu et les contraintes
techniques, rien du look.

**Direction : application iOS native.** Mike a un iPhone et l'app est installée
en PWA — elle doit se fondre dans le téléphone. SF Pro, fond gris système,
en-têtes larges puis collants, listes groupées, feuilles modales par le bas.

**Périmètre : le mobile de Mike uniquement.** L'espace finance est prévisionnel
et personne ne s'en sert : ne pas le traiter. Le desktop suivra plus tard, en
s'alignant sur ce qui sortira d'ici.

## Le scénario à concevoir

Deux rythmes, **aucun n'est secondaire** :

**Sur le vif** — Mike paye, sort son téléphone, photographie le ticket. Debout,
une main, lumière quelconque. Ce qui compte : atteindre l'appareil photo en un
geste, et que l'OCR fasse le reste. Zones tactiles généreuses, bas de l'écran
privilégié.

**Par salves** — il vide sa poche de tickets, assis. Ce qui compte : enchaîner
sans revenir au point de départ à chaque fois, et voir d'un coup d'œil ce qui est
déjà saisi.

## Les écrans, par ordre d'importance

1. **Capture d'un frais** — le cœur. Photo, OCR en cours, champs pré-remplis à
   corriger : montant, TVA, date, commerçant, catégorie, carte utilisée
   (obligatoire), « avec qui ? » sur un repas. Feuille modale plein écran.
2. **Liste des frais du mois** — total, ce qui est réconcilié, ce qui manque.
   Filtres par catégorie, recherche, sélecteur de période (mois / plage / année).
3. **Accueil** — montant du mois, TVA récupérable, état de la réconciliation,
   badge de statut de soumission, bouton de soumission.
4. **Soumission** — résumé avant envoi, puis progression (le ZIP et l'email
   prennent jusqu'à 90 secondes).
5. **Réconciliation UBS** — import du CSV, appariés / en attente / oubliés.
6. **Connexion** — email et mot de passe.

## Les états qu'on oublie toujours

Liste vide (premier usage) · chargement · erreur de connexion · **mode hors
ligne avec n frais en attente de synchronisation** · mois soumis, verrouillé,
badge « Closed » · OCR en cours, réussi, échoué · upload en cours.

Le mode hors ligne mérite une attention particulière : c'est une situation
normale, pas une panne. Mike doit comprendre que son frais est gardé.

## Ce qui doit rester vrai

- **CHF et TVA sont des données comptables.** Chiffres tabulaires, alignés,
  jamais décoratifs.
- **Le justificatif est la seule copie.** Le ticket papier est souvent déjà
  jeté. Toute action destructive doit se voir venir.
- **Interface en anglais** sur ce canal.
- **Le bleu `#1A3FB5`** et la carte « NUMERIQ PAYROLL » sont l'identité
  existante — à conserver, adapter ou écarter, mais consciemment.

## Ce qui coûte cher à implémenter, et pourquoi

Le visuel est écrit dans **537 styles inline** contre 20 classes CSS, injectés
par remplacement de chaînes exactes dans un fichier gelé.

**Gratuit** — redéfinir les 15 jetons de couleur du `:root` repeint toute
l'application.

**Raisonnable** — un bloc `<style>` injecté : typographie, espacements, rayons,
ombres, états. Suppose des classes sur les éléments, ce qui se négocie.

**Cher** — retoucher les styles inline un par un. Acceptable pour un écran refait
entièrement, à éviter pour un ajustement global.

Concevoir librement, mais savoir que **la palette et la typographie coûtent
presque rien, tandis qu'une refonte de la structure de chaque carte coûte cher**.
Si une idée demande le coûteux, elle doit valoir le prix.

## Deux pièges

**La navigation basse est construite en JavaScript** qui repère ses cibles par
leur **texte visible** (`+ Add expense`, `Scan receipt`). Changer un libellé la
casse. Me prévenir si une maquette renomme quoi que ce soit.

**Le mot `Frais`/`frais` est réécrit en `Expenses`/`expenses`** partout dans le
document final, identifiants compris. À proscrire dans les noms de classes.
