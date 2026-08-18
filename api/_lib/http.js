function sendJson(res, status, payload, headers) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [key, value] of Object.entries(headers || {})) {
    res.setHeader(key, value);
  }
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
}

function getQuery(req) {
  const host = req.headers.host || 'localhost';
  return new URL(req.url, `https://${host}`).searchParams;
}

module.exports = { sendJson, readJson, methodNotAllowed, getQuery };
