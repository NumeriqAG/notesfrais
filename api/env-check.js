/*
 * Diagnostic TEMPORAIRE de configuration.
 *
 * Ne renvoie que des booleens de presence, jamais une valeur. Inerte en
 * production (VERCEL_ENV === 'production') pour qu'un oubli de suppression ne
 * puisse pas renseigner un tiers sur la configuration reelle.
 *
 * A SUPPRIMER une fois le deploiement valide.
 */
const NAMES = [
  'DATABASE_URL',
  'NOTESFRAIS_COOKIE_SECRET',
  'NOTESFRAIS_USERS',
  'NOTESFRAIS_USER_EMAIL',
  'NOTESFRAIS_FINANCE_EMAIL',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'MONTHLY_SUBMISSION_EMAIL',
  'FINANCE_NOTIFICATION_EMAIL',
  'GMAIL_SMTP_USER',
  'GMAIL_SMTP_APP_PASSWORD',
  'RESEND_API_KEY'
];

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (process.env.VERCEL_ENV === 'production') {
    res.statusCode = 404;
    return res.end(JSON.stringify({ ok: false, error: 'Not found' }));
  }

  const present = {};
  for (const name of NAMES) {
    const value = process.env[name];
    present[name] = value ? { set: true, length: String(value).length } : { set: false };
  }

  // NOTESFRAIS_USERS : verifier qu'il parse et compter les comptes, sans rien
  // divulguer d'autre que les canaux declares.
  let users = { set: false };
  if (process.env.NOTESFRAIS_USERS) {
    try {
      const list = JSON.parse(process.env.NOTESFRAIS_USERS);
      users = {
        set: true,
        valid: Array.isArray(list),
        count: Array.isArray(list) ? list.length : 0,
        channels: Array.isArray(list) ? list.map(u => `${u.role}:${u.app_channel}`) : []
      };
    } catch (error) {
      users = { set: true, valid: false, parseError: error.message };
    }
  }

  res.statusCode = 200;
  return res.end(JSON.stringify({
    ok: true,
    vercelEnv: process.env.VERCEL_ENV || null,
    commit: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || null,
    branch: process.env.VERCEL_GIT_COMMIT_REF || null,
    env: present,
    notesfraisUsers: users
  }, null, 2));
};
