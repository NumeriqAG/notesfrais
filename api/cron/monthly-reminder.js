// Rappel automatique de fin de mois a l'utilisateur (email puis Web Push, via
// api/_lib/notify.js). Appele chaque matin par Vercel Cron (vercel.json).
//
// Regles, en heure de Zurich :
// - dernier jour du mois  : rappel du mois en cours s'il contient des frais non
//   soumis (« le mois se termine aujourd'hui »).
// - le 3 et le 7 du mois  : rappel du mois precedent s'il contient des frais et
//   n'est toujours pas soumis.
// Chaque rappel mentionne les frais sans justificatif et ceux que la finance a
// marques « a corriger ».
//
// Limite connue : les lignes du releve UBS ne sont pas stockees sur le serveur
// (l'import CSV est traite dans le navigateur), on ne peut donc pas encore
// rappeler les paiements UBS sans frais correspondant.
//
// Securite : la route exige `Authorization: Bearer <CRON_SECRET>`, que Vercel
// Cron ajoute de lui-meme quand la variable CRON_SECRET est definie. Sans
// CRON_SECRET, la route refuse tout (echec ferme).
//
// Test manuel : GET /api/cron/monthly-reminder?channel=test&month=AAAA-MM&force=1
// avec le meme en-tete. `force` ignore la date du jour et le journal anti-doublon.
const crypto = require('crypto');
const { sendJson, methodNotAllowed, getQuery } = require('../_lib/http');
const { sql, ensureSchema } = require('../_lib/db');
const { notifyUser } = require('../_lib/notify');

const TIME_ZONE = 'Europe/Zurich';
let logReady;

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST']);
    const secret = String(process.env.CRON_SECRET || '');
    if (secret.length < 16) return sendJson(res, 500, { ok: false, error: 'CRON_SECRET missing or too short' });
    if (!safeEqual(String(req.headers.authorization || ''), `Bearer ${secret}`)) {
      return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    }

    await ensureSchema();
    await ensureReminderLog();

    const query = getQuery(req);
    const force = query.get('force') === '1';
    const channels = force && ['mike', 'test'].includes(query.get('channel'))
      ? [query.get('channel')]
      : configuredChannels();
    const today = zurichToday(query.get('today'));
    const plan = force && /^\d{4}-\d{2}$/.test(query.get('month') || '')
      ? [{ month: query.get('month'), kind: 'manual' }]
      : remindersFor(today);

    const results = [];
    for (const channel of channels) {
      for (const item of plan) {
        results.push(await remind(channel, item, { force, today }));
      }
    }
    return sendJson(res, 200, { ok: true, today: today.iso, plan, results });
  } catch (error) {
    console.error('Monthly reminder failed', error);
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || String(error) });
  }
};

function configuredChannels() {
  // Par defaut, Mike seulement. MONTHLY_REMINDER_CHANNELS=mike,test pour
  // inclure la preprod.
  const raw = String(process.env.MONTHLY_REMINDER_CHANNELS || 'mike');
  return Array.from(new Set(raw.split(',').map(s => s.trim()).filter(c => c === 'mike' || c === 'test')));
}

function zurichToday(override) {
  let date = new Date();
  if (override && /^\d{4}-\d{2}-\d{2}$/.test(override)) date = new Date(`${override}T12:00:00Z`);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date).map(p => [p.type, p.value]));
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  return {
    year, month, day,
    iso: `${parts.year}-${parts.month}-${parts.day}`,
    lastDay: new Date(Date.UTC(year, month, 0)).getUTCDate()
  };
}

function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function remindersFor(today) {
  const plan = [];
  if (today.day === today.lastDay) plan.push({ month: monthKey(today.year, today.month), kind: 'month_end' });
  if (today.day === 3 || today.day === 7) {
    const prevYear = today.month === 1 ? today.year - 1 : today.year;
    const prevMonth = today.month === 1 ? 12 : today.month - 1;
    plan.push({ month: monthKey(prevYear, prevMonth), kind: `overdue_day${today.day}` });
  }
  return plan;
}

function lastDayOfMonth(month) {
  const [year, m] = month.split('-').map(Number);
  return `${month}-${String(new Date(Date.UTC(year, m, 0)).getUTCDate()).padStart(2, '0')}`;
}

function monthLabelFor(month) {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function hasReceipt(row) {
  const items = Array.isArray(row.receipt_items) ? row.receipt_items : [];
  return items.length > 0 || Boolean(row.receipt_url);
}

async function remind(channel, item, { force }) {
  const { month, kind } = item;
  const rows = await sql()`select id, submission_status, receipt_url, receipt_items, review_status, amount, amount_chf
    from expenses
    where app_channel = ${channel} and date >= ${`${month}-01`} and date <= ${lastDayOfMonth(month)}`;
  if (rows.length === 0) return { channel, month, kind, skipped: 'No expenses this month' };
  const open = rows.filter(row => row.submission_status !== 'submitted');
  if (open.length === 0) return { channel, month, kind, skipped: 'Month already submitted' };

  if (!force) {
    const [logged] = await sql()`insert into reminder_log (app_channel, month, kind)
      values (${channel}, ${month}, ${kind})
      on conflict do nothing
      returning sent_at`;
    if (!logged) return { channel, month, kind, skipped: 'Already reminded' };
  }

  const missing = rows.filter(row => !hasReceipt(row)).length;
  const toFix = rows.filter(row => row.review_status === 'to_fix').length;
  const total = rows.reduce((sum, row) => sum + Math.abs(Number(row.amount_chf ?? row.amount) || 0), 0);
  const label = monthLabelFor(month);
  const details = [
    `${rows.length} expense${rows.length > 1 ? 's' : ''}, CHF ${total.toFixed(2)}`,
    missing ? `${missing} without receipt` : '',
    toFix ? `${toFix} to fix` : ''
  ].filter(Boolean).join(' · ');
  const isMonthEnd = kind === 'month_end';
  const title = isMonthEnd ? `${label} ends today` : `${label} is not submitted yet`;
  const intro = isMonthEnd
    ? `${label} ends today. When your receipts are in, submit the month to finance.`
    : `${label} has not been submitted to finance yet. Please check it and submit it.`;

  const notification = await notifyUser({
    channel,
    title,
    body: details,
    intro: `${intro} ${details}.`,
    message: '',
    tag: `notesfrais-reminder-${channel}-${month}`,
    idempotencyKey: `monthly-reminder-${channel}-${month}-${kind}${force ? `-${Date.now()}` : ''}`
  });
  return { channel, month, kind, sent: true, details, notification };
}

async function ensureReminderLog() {
  if (!logReady) {
    logReady = sql()`create table if not exists reminder_log (
      app_channel text not null,
      month text not null,
      kind text not null,
      sent_at timestamptz not null default now(),
      primary key (app_channel, month, kind)
    )`;
    logReady.catch(() => { logReady = null; });
  }
  await logReady;
}

function safeEqual(a, b) {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports.remindersFor = remindersFor;
module.exports.zurichToday = zurichToday;
