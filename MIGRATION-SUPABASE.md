# NotesFrais - migration Supabase vers Neon

Derniere mise a jour: 2026-08-18

## Statut reel avant migration

- Production actuelle: `https://notesfrais.vercel.app/mike`.
- Etat confirme par inspection externe: la production sert encore la version Supabase du depot GitHub `NumeriqAG/notesfrais`.
- Cette branche contient la version locale de migration vers Vercel Functions + Neon Postgres + Cloudflare R2.
- Cette version locale n'etait pas presente sur GitHub avant cette branche et ne doit pas etre consideree comme deja deployee.
- Objectif: recuperer proprement le travail local, le revoir, puis remplacer Supabase par Neon/R2 apres validation.

## Architecture cible de cette branche

- Neon Postgres stocke les frais et les statuts de soumission.
- Cloudflare R2 stocke les justificatifs.
- Vercel Functions exposent l'API serveur.
- Session applicative via cookie HttpOnly signe.
- L'UI existante reste basee sur `app.html` + patches runtime.

Routes serveur:

- `/api/session`: login, logout, session.
- `/api/expenses`: lecture, creation, mise a jour, suppression des frais.
- `/api/receipts`: upload, URL signee, proxy raw, suppression des justificatifs.
- `/api/monthly-submission`: soumission mensuelle Mike, ZIP des recus, email finance, cloture du mois.
- `/api/notify-submission`: ancienne notification email finance, gardee pour compatibilite.

Fichiers principaux:

- `api/session.js`
- `api/expenses.js`
- `api/receipts.js`
- `api/monthly-submission.js`
- `api/_lib/auth.js`
- `api/_lib/db.js`
- `api/_lib/r2.js`
- `api/_lib/receipt-email.js`
- `notesfrais-api-backend.js`
- `notesfrais-multi-receipts.js`
- `notesfrais-user-edit.js`
- `db/schema.sql`

## Variables Vercel

Variables requises en Production:

- `DATABASE_URL`
- `NOTESFRAIS_COOKIE_SECRET`
- `NOTESFRAIS_USER_EMAIL`
- `NOTESFRAIS_USER_PASSWORD`
- `NOTESFRAIS_FINANCE_EMAIL`
- `NOTESFRAIS_FINANCE_PASSWORD`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`

Variables email:

- `RESEND_API_KEY`
- `FINANCE_NOTIFICATION_EMAIL`
- `SUBMISSION_MAIL_FROM`
- `GMAIL_SMTP_USER`
- `GMAIL_SMTP_APP_PASSWORD`
- `RECEIPT_BACKUP_EMAIL`
- `RECEIPT_MAIL_FROM`
- `MONTHLY_SUBMISSION_EMAIL` optionnel, prioritaire pour l'email de soumission mensuelle.
- `MONTHLY_SUBMISSION_FROM` optionnel, expediteur de soumission mensuelle.

Comptes de recette actuels en production:

- Mike: `Mike@numeriq.ch`
- Finance: `finance@numeriq.ch`

Les mots de passe de recette restent volontairement simples pendant les tests. Les remplacer avant usage final.
Rotation appliquee le 2026-06-19:

- `NOTESFRAIS_USER_PASSWORD` remplace en Production.
- `NOTESFRAIS_FINANCE_PASSWORD` remplace en Production.
- `NOTESFRAIS_COOKIE_SECRET` remplace en Production.
- Redeploiement production effectue.
- Anciens mots de passe Mike/Finance refuses en 401.
- Nouveaux mots de passe Mike/Finance acceptes en 200.
- Les mots de passe ont ete remplaces une seconde fois le 2026-06-19 par des valeurs plus humaines pour l'exploitation.
- Les valeurs temporaires fortes precedentes sont refusees en 401.

Ne jamais commiter de vraies valeurs dans le repo.

## Schema Neon

Tables:

- `expenses`
- `app_profiles`

Champs importants de `expenses`:

- `app_channel`: isole les frais Mike/test.
- `submission_status`: `pending`, `to_submit`, `submitted`.
- `submitted_at`: date de soumission.
- `receipt_url` / `receipt_name`: justificatif principal, conserve pour compatibilite.
- `receipt_items`: liste JSON des justificatifs d'une depense.

Indexes:

- `expenses_channel_date_idx`
- `expenses_submission_status_idx`

`api/_lib/db.js` applique aussi automatiquement l'ajout de `receipt_items` si besoin.

## Cloudflare R2

Bucket:

- `notesfrais-receipts`

Public access: disabled.

Lecture des justificatifs:

- UI: URL signee courte via `/api/receipts`.
- ZIP Finance: proxy same-origin `/api/receipts?raw=1&path=...&name=...`.

Formats valides:

- Images.
- PDF.

Les noms de fichiers ZIP sont normalises pour Windows.

## Fonctionnalites validees

Flux Mike:

- Login Mike OK.
- Ajout d'un frais sans justificatif OK.
- Ajout d'un frais avec image OK.
- Ajout d'un frais avec PDF OK.
- Ajout de plusieurs justificatifs sur une meme depense OK.
- Modification d'un frais non cloture OK.
- Preview justificatif OK.
- Preview de plusieurs justificatifs depuis `Expenses` OK.
- Persistance apres refresh OK.
- Selection de mois dans `Expenses` OK.
- Soumission mensuelle vers Finance OK:
  - email envoye;
  - ZIP des recus joint;
  - periode cloturee apres succes;
  - renvoi possible du ZIP si le mois est deja cloture.
- Statut `Already submitted` visible apres soumission OK.
- Blocage creation/modification/suppression apres cloture OK.

Flux Finance:

- Login Finance OK.
- Dashboard/inbox Finance OK.
- Ouverture d'un mois soumis OK.
- Selection de periode OK:
  - un mois;
  - de mois a mois;
  - toute l'annee.
- Ajout de frais depuis Finance OK.
- Modification de frais depuis Finance OK.
- Suppression de frais depuis Finance OK.
- Ajout de plusieurs justificatifs sur une depense OK.
- Preview individuelle de chaque justificatif OK.
- Suppression d'un justificatif precis OK.
- Persistance des justificatifs multiples apres refresh OK.
- Export CSV OK.
- Export ZIP des justificatifs OK, incluant tous les recus.
- ZIP valide sous Windows OK.
- Finance garde le controle complet sur les frais: ajout, modification, suppression.

Tests techniques effectues:

- Creation/modification/suppression d'une depense temporaire.
- Upload image temporaire.
- Upload PDF temporaire.
- Lecture URL signee R2.
- Lecture raw PDF avec `Content-Type: application/pdf`.
- Verification `receipt_items` avec deux justificatifs.
- Nettoyage des donnees temporaires de test.
- Verification navigateur Finance sans erreur console.
- Nettoyage final des frais de test effectue le 2026-05-27: 8 frais supprimes, justificatifs R2 associes supprimes, 0 frais restant en base sur 2026.
- Verification production du 2026-06-19:
  - login Mike OK;
  - login Finance avec `finance@numeriq.ch` OK;
  - juin 2026 contient 2 frais et 2 frais soumis;
  - Mike bloque en 403 lors d'un ajout sur juin 2026 cloture;
  - upload, lecture signee et suppression d'un recu R2 temporaire OK;
  - creation, modification et suppression d'un frais temporaire par Finance OK;
  - email de soumission mensuelle recu a `thomas@numeriq.ch` avec ZIP.
- Durcissement securite du 2026-06-19:
  - `npm audit --omit=dev` propre, 0 vulnerabilite;
  - `nodemailer` mis a jour en `9.0.1`;
  - limitation des tentatives login: 8 echecs par 15 minutes et par IP/email;
  - headers HTTP de securite ajoutes via `vercel.json`;
  - anciens fichiers publics de test et scripts SQL Supabase retires du build;
  - upload justificatif limite aux images/PDF connus, 5 MB max par fichier;
  - lecture des justificatifs rattachee aux depenses en base, pas seulement au prefixe R2;
  - destinataires email finance obligatoires via variables d'environnement, sans fallback personnel code en dur.
- Verification production apres durcissement du 2026-06-19:
  - deploy production OK et alias `https://notesfrais.vercel.app` mis a jour;
  - headers `nosniff`, `DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS et CSP presents;
  - `/test.html`, `/test-sw.js` et `/supabase-auth-rls.sql` retournent 404;
  - `/api/expenses` sans session retourne 401;
  - login Mike OK;
  - login Finance OK;
  - upload justificatif type interdit retourne 415;
  - upload justificatif > 5 MB retourne 413;
  - lecture d'un justificatif rattache a une depense retourne 200;
  - lecture d'un chemin R2 non rattache retourne 403;
  - rate limit login retourne 429 apres 9 echecs sur une adresse de test.
- UX soumission mensuelle du 2026-06-19:
  - le bouton affiche maintenant l'etape en cours pendant la soumission;
  - une banniere de progression indique que NotesFrais prepare le ZIP, envoie l'email puis cloture le mois;
  - le traitement reste synchrone pour eviter un mois cloture sans email envoye.
- Correction connexion mobile du 2026-06-19:
  - le timeout de chargement initial passe de 6.5 s a 20 s;
  - le message `Connection too slow - opening in local mode` est retire;
  - verification production: login Mike 200, lecture expenses 200, reponse API autour de 1.1 s depuis le poste de test.
- Preparation livraison Mike du 2026-06-19:
  - `RECEIPT_BACKUP_EMAIL` passe a `mike@numeriq.ch`;
  - l'email de soumission mensuelle Finance reste separe via `MONTHLY_SUBMISSION_EMAIL` / `FINANCE_NOTIFICATION_EMAIL`;
  - nettoyage production effectue: 4 frais supprimes, 4 justificatifs R2 rattaches supprimes;
  - verification production: login Mike 200, login Finance 200, 0 frais visibles pour Mike, 0 frais visibles pour Finance;
  - fichier local temporaire `.env.delivery-cleanup.local` supprime apres usage.

## Multi-recus

Une depense peut maintenant avoir plusieurs justificatifs.

Modele:

- `receipt_items` contient une liste de `{ path, name }`.
- `receipt_url` et `receipt_name` gardent le premier justificatif pour compatibilite.
- L'UI Finance affiche chaque justificatif comme une miniature cliquable.
- Le ZIP Finance parcourt tous les justificatifs, pas seulement le premier.

Suppression:

- Supprimer un justificatif dans l'edition Finance le retire de `receipt_items`.
- Les autres justificatifs restent rattaches.
- Le fichier R2 supprime est nettoye apres sauvegarde.

## Copie email des recus Mike

- Chaque nouveau recu ajoute par Mike est envoye par email apres la sauvegarde reussie de la depense.
- Le fichier original est joint a l'email avec le commerçant, le montant, la date et l'identifiant de la depense.
- Un ajout ulterieur envoie uniquement le nouveau recu, sans renvoyer les justificatifs deja presents.
- Les ajouts effectues par Finance ne declenchent pas cet email personnel.
- Le destinataire est `RECEIPT_BACKUP_EMAIL` si cette variable est definie, sinon l'adresse `NOTESFRAIS_USER_EMAIL`.
- L'expediteur utilise `RECEIPT_MAIL_FROM`, puis `SUBMISSION_MAIL_FROM` en fallback.
- L'envoi utilise Gmail SMTP si `GMAIL_SMTP_USER` et `GMAIL_SMTP_APP_PASSWORD` sont configures, sinon Resend.
- Une erreur email ne supprime pas la depense ni le recu deja stocke dans Neon/R2.
- Une cle d'idempotence Resend evite les doubles envois lors d'une repetition immediate de la requete.

## Soumission mensuelle Mike

Route serveur:

- `POST /api/monthly-submission`

Comportement:

- Accessible uniquement au compte Mike.
- Recoit un mois `YYYY-MM`.
- Recupere tous les frais Mike du mois.
- Recupere tous les justificatifs R2 rattaches aux frais.
- Genere un ZIP standard avec les recus.
- Envoie un email au destinataire finance avec le ZIP en piece jointe.
- Marque ensuite les frais du mois en `submission_status = submitted`.
- Si le mois est deja cloture, la route peut renvoyer le ZIP sans rouvrir le mois.

Destinataire:

- `MONTHLY_SUBMISSION_EMAIL` si defini.
- Sinon `FINANCE_NOTIFICATION_EMAIL`.
- Si aucune des deux variables n'est definie, la route echoue avant d'envoyer.

Important:

- La cloture intervient apres l'envoi email reussi.
- Mike ne peut plus ajouter, modifier ou supprimer de frais sur un mois soumis.
- Finance peut toujours corriger les frais.

## Migration depuis Supabase

Date de migration initiale: 2026-05-19

Ancien backup local:

`../../notesfrais-backup-before-mike-reset-2026-04-28T10-11-06-666Z.json`

Commande historique:

```bash
npm run seed:backup
```

Attention: les anciens liens de justificatifs du backup pointent encore vers Supabase. Si le domaine Supabase reste indisponible, il faudra recharger ces justificatifs manuellement.

## Securite restante

Rotation applicative effectuee le 2026-06-19. A faire avant usage final complet:

- Regenerer les cles R2 si elles ont ete exposees pendant la configuration.
- Regenerer le mot de passe Neon / `DATABASE_URL` si necessaire.
- Supprimer progressivement les patches runtime qui necessitent encore `unsafe-inline` / `unsafe-eval` dans la CSP.

Apres rotation R2/Neon, redeployer en production puis retester:

- Login Mike.
- Login Finance.
- Creation d'un frais avec image.
- Creation d'un frais avec PDF.
- Soumission mensuelle.
- Ajout/suppression de plusieurs recus Finance.
- Export CSV.
- Export ZIP.

Identifiants de recette connus au 2026-06-19:

- Finance: `finance@numeriq.ch`
- Mike: `Mike@numeriq.ch`

Ne pas conserver de mots de passe simples pour la mise en production finale.

## Dette technique restante

- L'interface repose encore sur `app.html` et plusieurs patches runtime JavaScript.
- Consolider progressivement les patches dans une structure plus maintenable.
- Renommer ou supprimer les anciens fichiers `notesfrais-test-*` qui sont devenus des patches fonctionnels.
- Garder les nouveaux libelles UI en anglais pour eviter de recreer un melange FR/EN.
- Donnees de test nettoyees le 2026-05-27. Verifier uniquement les nouvelles donnees creees apres cette date.
