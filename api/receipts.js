const { sendJson, readJson, methodNotAllowed, getQuery } = require('./_lib/http');
const { requireSession } = require('./_lib/auth');
const { sql, normalizeReceiptItems } = require('./_lib/db');
const { keyForUpload, uploadObject, deleteObject, getObject, signedUrl } = require('./_lib/r2');

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

module.exports = async function handler(req, res) {
  try {
    const session = requireSession(req);
    if (req.method === 'GET') return getReceipt(req, res, session);
    if (req.method === 'POST') return uploadReceipt(req, res, session);
    if (req.method === 'DELETE') return removeReceipt(req, res, session);
    return methodNotAllowed(res, ['GET', 'POST', 'DELETE']);
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || String(error) });
  }
};

async function uploadReceipt(req, res, session) {
  const body = await readJson(req);
  const channel = session.role === 'finance' ? sanitizeChannel(body.channel || 'mike') : session.app_channel;
  const fileName = body.fileName || 'receipt';
  const mimeType = body.mimeType || 'application/octet-stream';
  if (!isAllowedMime(mimeType)) {
    return sendJson(res, 415, { ok: false, error: 'Unsupported receipt type' });
  }
  const base64 = String(body.dataBase64 || body.dataUrl || '').includes(',')
    ? String(body.dataBase64 || body.dataUrl).split(',').pop()
    : String(body.dataBase64 || body.dataUrl || '');
  if (!base64) return sendJson(res, 400, { ok: false, error: 'Missing file data' });
  const content = Buffer.from(base64, 'base64');
  if (content.length > MAX_RECEIPT_BYTES) {
    return sendJson(res, 413, { ok: false, error: 'Receipt file is too large' });
  }
  const requestedPath = String(body.path || '');
  const key = requestedPath && canUsePath(requestedPath, { ...session, app_channel: channel })
    ? requestedPath
    : keyForUpload(channel, fileName);
  await uploadObject({ key, body: content, contentType: mimeType });
  return sendJson(res, 201, { ok: true, path: key, name: fileName });
}

async function getReceipt(req, res, session) {
  const query = getQuery(req);
  const path = query.get('path') || '';
  const name = query.get('name') || 'receipt';
  if (!path) return sendJson(res, 400, { ok: false, error: 'Missing path' });
  if (!await canAccessReceipt(path, session)) return sendJson(res, 403, { ok: false, error: 'Receipt not accessible' });
  if (query.get('raw') === '1') return streamReceipt(res, path, name);
  return sendJson(res, 200, { ok: true, signedUrl: await signedUrl(path, name) });
}

async function streamReceipt(res, path, name) {
  const object = await getObject(path);
  const chunks = [];
  for await (const chunk of object.Body) chunks.push(Buffer.from(chunk));
  const fileName = safeFileName(name || path.split('/').pop() || 'receipt');
  res.statusCode = 200;
  res.setHeader('Content-Type', object.ContentType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Cache-Control', 'private, max-age=60');
  return res.end(Buffer.concat(chunks));
}

async function removeReceipt(req, res, session) {
  const body = await readJson(req);
  const paths = Array.isArray(body.paths) ? body.paths : [body.path].filter(Boolean);
  for (const path of paths) {
    if (!canUsePath(path, session)) return sendJson(res, 403, { ok: false, error: 'Receipt not accessible' });
  }
  await Promise.all(paths.map(path => deleteObject(path)));
  return sendJson(res, 200, { ok: true });
}

function canUsePath(path, session) {
  if (session.role === 'finance') return true;
  return String(path || '').startsWith(`${session.app_channel}/`) || !String(path || '').includes('/');
}

async function canAccessReceipt(path, session) {
  if (!canUsePath(path, session)) return false;
  const rows = session.role === 'finance'
    ? await sql()`select receipt_url, receipt_items from expenses where receipt_url = ${path} or receipt_items @> ${JSON.stringify([{ path }])}::jsonb limit 1`
    : await sql()`select receipt_url, receipt_items from expenses where app_channel = ${session.app_channel} and (receipt_url = ${path} or receipt_items @> ${JSON.stringify([{ path }])}::jsonb) limit 1`;
  return rows.length > 0;
}

function isAllowedMime(value) {
  return ALLOWED_MIME.has(String(value || '').toLowerCase());
}

function sanitizeChannel(value) {
  return value === 'test' ? 'test' : 'mike';
}

function safeFileName(value) {
  return String(value || 'receipt')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'receipt';
}
