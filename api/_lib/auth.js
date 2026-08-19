const crypto = require('crypto');
const { sql } = require('./db');

const COOKIE_NAME = 'notesfrais_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 8;

function cookieSecret() {
  const secret = process.env.NOTESFRAIS_COOKIE_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error('NOTESFRAIS_COOKIE_SECRET missing or too short');
  }
  return secret;
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(value) {
  return crypto.createHmac('sha256', cookieSecret()).update(value).digest('base64url');
}

// Comparaison a duree constante : un !== classique revele la position du
// premier octet different par son temps de retour.
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(header.split(';').map(part => {
    const index = part.indexOf('=');
    if (index < 0) return null;
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(Boolean));
}

function serializeCookie(value, maxAge = MAX_AGE_SECONDS) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`
  ];
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

function loginKey(req, email) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || req.socket && req.socket.remoteAddress || 'unknown';
  return `${ip}:${String(email || '').trim().toLowerCase()}`;
}

// Persistee en base : l'ancienne Map vivait dans la memoire du process. Sur
// Vercel, chaque demarrage a froid la remettait a zero et chaque instance avait
// la sienne — la limitation ne protegeait donc rien en pratique.
let rateLimitReady;
async function ensureRateLimitTable() {
  if (!rateLimitReady) {
    rateLimitReady = sql()`create table if not exists login_attempts (
      key text primary key,
      count integer not null default 0,
      reset_at timestamptz not null
    )`;
  }
  await rateLimitReady;
}

async function checkLoginRateLimit(req, email) {
  await ensureRateLimitTable();
  const [row] = await sql()`select count from login_attempts
    where key = ${loginKey(req, email)} and reset_at > now()`;
  if (row && row.count >= LOGIN_MAX_FAILURES) {
    const error = new Error('Too many login attempts. Try again later.');
    error.statusCode = 429;
    throw error;
  }
}

async function recordLoginFailure(req, email) {
  await ensureRateLimitTable();
  const windowEnd = new Date(Date.now() + LOGIN_WINDOW_MS).toISOString();
  await sql()`insert into login_attempts (key, count, reset_at)
    values (${loginKey(req, email)}, 1, ${windowEnd})
    on conflict (key) do update set
      count = case when login_attempts.reset_at > now() then login_attempts.count + 1 else 1 end,
      reset_at = case when login_attempts.reset_at > now() then login_attempts.reset_at else ${windowEnd}::timestamptz end`;
}

async function clearLoginFailures(req, email) {
  await ensureRateLimitTable();
  await sql()`delete from login_attempts where key = ${loginKey(req, email)}`;
}

function makeSession(profile) {
  const payload = {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    app_channel: profile.app_channel,
    exp: Date.now() + MAX_AGE_SECONDS * 1000
  };
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

function readSession(req) {
  const raw = parseCookies(req)[COOKIE_NAME];
  if (!raw) return null;
  const [body, mac] = raw.split('.');
  if (!body || !mac || !safeEqual(sign(body), mac)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function clearCookie() {
  return serializeCookie('', 0);
}

// Deux facons de declarer les comptes, dans cet ordre de priorite :
//
// 1. NOTESFRAIS_USERS : un tableau JSON, autant de comptes qu'on veut, avec
//    soit "password" en clair, soit "passwordHash" au format
//    scrypt$<sel base64>$<empreinte base64> — genere par
//    `node scripts/hash-password.mjs`.
//    [{"email":"mike@x.ch","passwordHash":"scrypt$...","role":"user","app_channel":"mike"}]
//
// 2. Les quatre variables historiques NOTESFRAIS_USER_* / NOTESFRAIS_FINANCE_*,
//    conservees pour ne rien casser.
//
// Une vraie table utilisateurs reste l'objectif : ces comptes n'ont ni
// revocation, ni trace de qui fait quoi.
function profilesFromEnv() {
  const declared = parseUsersEnv();
  if (declared.length > 0) return declared;
  return [
    {
      id: 'mike',
      email: process.env.NOTESFRAIS_USER_EMAIL || '',
      password: process.env.NOTESFRAIS_USER_PASSWORD || '',
      role: 'user',
      app_channel: 'mike'
    },
    {
      id: 'finance',
      email: process.env.NOTESFRAIS_FINANCE_EMAIL || '',
      password: process.env.NOTESFRAIS_FINANCE_PASSWORD || '',
      role: 'finance',
      app_channel: 'all'
    }
  ].filter(profile => profile.email && profile.password);
}

function parseUsersEnv() {
  const raw = process.env.NOTESFRAIS_USERS;
  if (!raw) return [];
  let list;
  try {
    list = JSON.parse(raw);
  } catch (_error) {
    throw new Error('NOTESFRAIS_USERS is not valid JSON');
  }
  if (!Array.isArray(list)) throw new Error('NOTESFRAIS_USERS must be a JSON array');
  return list
    .map((item, index) => ({
      id: String(item.id || item.email || `user${index}`),
      email: String(item.email || '').trim(),
      password: item.password ? String(item.password) : '',
      passwordHash: item.passwordHash ? String(item.passwordHash) : '',
      role: item.role === 'finance' ? 'finance' : 'user',
      app_channel: item.app_channel === 'all' ? 'all' : item.app_channel === 'test' ? 'test' : 'mike'
    }))
    .filter(item => item.email && (item.password || item.passwordHash));
}

// scrypt$<sel base64>$<empreinte base64>
function verifyPasswordHash(password, stored) {
  const [scheme, saltB64, hashB64] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(String(password || ''), Buffer.from(saltB64, 'base64'), expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function authenticate(email, password) {
  const normalized = String(email || '').trim().toLowerCase();
  const profile = profilesFromEnv().find(item => item.email.toLowerCase() === normalized);
  if (!profile) return null;
  const valid = profile.passwordHash
    ? verifyPasswordHash(password, profile.passwordHash)
    : safeEqual(password, profile.password);
  if (!valid) return null;
  const { password: _password, passwordHash: _hash, ...safeProfile } = profile;
  return safeProfile;
}

function requireSession(req) {
  const session = readSession(req);
  if (!session) {
    const error = new Error('Unauthorized');
    error.statusCode = 401;
    throw error;
  }
  return session;
}

module.exports = {
  makeSession,
  readSession,
  requireSession,
  clearCookie,
  serializeCookie,
  authenticate,
  checkLoginRateLimit,
  recordLoginFailure,
  clearLoginFailures
};
