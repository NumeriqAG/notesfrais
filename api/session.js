const { sendJson, readJson, methodNotAllowed } = require('./_lib/http');
const {
  authenticate,
  makeSession,
  readSession,
  clearCookie,
  serializeCookie,
  checkLoginRateLimit,
  recordLoginFailure,
  clearLoginFailures,
  currentProfile
} = require('./_lib/auth');

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      let session = readSession(req);
      // Session glissante : l'app lit sa session a chaque ouverture, on en
      // profite pour la prolonger de 14 jours. Mike n'est donc deconnecte
      // qu'apres 14 jours SANS ouvrir l'app, et non 14 jours apres sa
      // connexion. Un compte retire ou modifie dans la configuration perd sa
      // session a la prochaine ouverture.
      if (session) {
        const profile = currentProfile(session);
        if (profile) {
          res.setHeader('Set-Cookie', serializeCookie(makeSession(profile)));
        } else {
          res.setHeader('Set-Cookie', clearCookie());
          session = null;
        }
      }
      return sendJson(res, 200, {
        ok: true,
        session: session ? { user: { id: session.id, email: session.email } } : null,
        profile: session ? { role: session.role, app_channel: session.app_channel } : null
      });
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      await checkLoginRateLimit(req, body.email);
      const profile = authenticate(body.email, body.password);
      if (!profile) {
        await recordLoginFailure(req, body.email);
        return sendJson(res, 401, { ok: false, error: 'Incorrect email or password' });
      }
      await clearLoginFailures(req, body.email);
      res.setHeader('Set-Cookie', serializeCookie(makeSession(profile)));
      return sendJson(res, 200, {
        ok: true,
        session: { user: { id: profile.id, email: profile.email } },
        profile: { role: profile.role, app_channel: profile.app_channel }
      });
    }

    if (req.method === 'DELETE') {
      res.setHeader('Set-Cookie', clearCookie());
      return sendJson(res, 200, { ok: true });
    }

    return methodNotAllowed(res, ['GET', 'POST', 'DELETE']);
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || String(error) });
  }
};
