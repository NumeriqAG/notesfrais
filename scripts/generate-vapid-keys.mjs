// Genere la paire de cles VAPID pour le Web Push.
// A coller dans les variables d'environnement Vercel :
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (et VAPID_SUBJECT=mailto:...)
// Changer de paire invalide tous les abonnements existants.
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
