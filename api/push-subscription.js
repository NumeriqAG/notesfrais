// Abonnements Web Push de la PWA. Seul un compte « user » s'abonne : c'est lui
// qu'on previent quand la finance decide d'un mois. Le canal est force depuis
// la session, jamais lu dans le corps.
//
// GET    -> { publicKey } (cle VAPID publique, null si non configuree)
// POST   -> { subscription: PushSubscription.toJSON() }
// DELETE -> { endpoint }
const { sendJson, readJson, methodNotAllowed } = require('./_lib/http');
const { requireSession } = require('./_lib/auth');
const { sql } = require('./_lib/db');
const { ensurePushSchema, vapidConfig } = require('./_lib/notify');

module.exports = async function handler(req, res) {
  try {
    const session = requireSession(req);
    if (req.method === 'GET') {
      const vapid = vapidConfig();
      return sendJson(res, 200, { ok: true, publicKey: vapid ? vapid.publicKey : null });
    }
    if (session.role !== 'user' || !['mike', 'test'].includes(session.app_channel)) {
      return sendJson(res, 403, { ok: false, error: 'Only a user account can subscribe' });
    }
    await ensurePushSchema();
    const body = await readJson(req);

    if (req.method === 'POST') {
      const sub = body.subscription || body;
      const endpoint = String(sub && sub.endpoint || '');
      const p256dh = String(sub && sub.keys && sub.keys.p256dh || '');
      const auth = String(sub && sub.keys && sub.keys.auth || '');
      if (!/^https:\/\//.test(endpoint) || endpoint.length > 2000 || !p256dh || !auth) {
        return sendJson(res, 400, { ok: false, error: 'Invalid subscription' });
      }
      const userAgent = String(req.headers['user-agent'] || '').slice(0, 300);
      await sql()`insert into push_subscriptions (endpoint, p256dh, auth, app_channel, email, user_agent)
        values (${endpoint}, ${p256dh}, ${auth}, ${session.app_channel}, ${String(session.email || '')}, ${userAgent})
        on conflict (endpoint) do update set
          p256dh = excluded.p256dh,
          auth = excluded.auth,
          app_channel = excluded.app_channel,
          email = excluded.email,
          user_agent = excluded.user_agent`;
      return sendJson(res, 201, { ok: true });
    }

    if (req.method === 'DELETE') {
      const endpoint = String(body.endpoint || '');
      if (!endpoint) return sendJson(res, 400, { ok: false, error: 'Missing endpoint' });
      await sql()`delete from push_subscriptions where endpoint = ${endpoint} and app_channel = ${session.app_channel}`;
      return sendJson(res, 200, { ok: true });
    }

    return methodNotAllowed(res, ['GET', 'POST', 'DELETE']);
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || String(error) });
  }
};
