const crypto = require('crypto');

const COOKIE_NAME = 'notesfrais_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 8;
const loginFailures = new Map();

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

function checkLoginRateLimit(req, email) {
  const key = loginKey(req, email);
  const now = Date.now();
  const entry = loginFailures.get(key);
  if (!entry || entry.resetAt <= now) {
    loginFailures.set(key, { count: 0, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  if (entry.count >= LOGIN_MAX_FAILURES) {
    const error = new Error('Too many login attempts. Try again later.');
    error.statusCode = 429;
    throw error;
  }
}

function recordLoginFailure(req, email) {
  const key = loginKey(req, email);
  const now = Date.now();
  const entry = loginFailures.get(key);
  if (!entry || entry.resetAt <= now) {
    loginFailures.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

function clearLoginFailures(req, email) {
  loginFailures.delete(loginKey(req, email));
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
  if (!body || !mac || sign(body) !== mac) return null;
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

function profilesFromEnv() {
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

function authenticate(email, password) {
  const normalized = String(email || '').trim().toLowerCase();
  const profile = profilesFromEnv().find(item => item.email.toLowerCase() === normalized);
  if (!profile || String(password || '') !== profile.password) return null;
  const { password: _password, ...safeProfile } = profile;
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
