const { sendJson, readJson, methodNotAllowed, getQuery } = require('./_lib/http');
const { requireSession } = require('./_lib/auth');
const { sql, ensureSchema, sanitizeChannel } = require('./_lib/db');
const { ensureMonthReviewTable } = require('./_lib/month-review');

// Circuit de validation au niveau du MOIS (choix de Thomas, nov. 2026) :
// la finance approuve, renvoie (ce qui rouvre le mois) ou marque rembourse.
//
// GET  /api/month-review?from=2026-01&to=2026-12[&channel=test]
//      user : son canal seulement. finance : tous les canaux, ou celui demande.
// POST /api/month-review  { month, channel, action, note }
//      finance seulement. action = approve | send_back | reimburse | undo
//
// Pas de RLS : tous les controles sont ici (voir CLAUDE.md §3).

const ACTIONS = new Set(['approve', 'send_back', 'reimburse', 'undo']);

module.exports = async function handler(req, res) {
  try {
    const session = requireSession(req);
    await ensureSchema();
    await ensureMonthReviewTable();
    if (req.method === 'GET') return listReviews(req, res, session);
    if (req.method === 'POST') return decide(req, res, session);
    return methodNotAllowed(res, ['GET', 'POST']);
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || String(error) });
  }
};

async function listReviews(req, res, session) {
  const query = getQuery(req);
  const from = validMonth(query.get('from')) || '0000-00';
  const to = validMonth(query.get('to')) || '9999-99';
  const db = sql();
  let rows;
  if (session.role === 'finance') {
    const channel = query.get('channel');
    rows = channel
      ? await db`select * from month_reviews where app_channel = ${sanitizeChannel(channel)} and month >= ${from} and month <= ${to} order by month desc`
      : await db`select * from month_reviews where month >= ${from} and month <= ${to} order by month desc`;
  } else {
    rows = await db`select * from month_reviews where app_channel = ${session.app_channel} and month >= ${from} and month <= ${to} order by month desc`;
  }
  return sendJson(res, 200, { ok: true, data: rows.map(publicRow) });
}

async function decide(req, res, session) {
  if (session.role !== 'finance') {
    return sendJson(res, 403, { ok: false, error: 'Only finance can decide on a month' });
  }
  const body = await readJson(req);
  const month = validMonth(body.month);
  if (!month) return sendJson(res, 400, { ok: false, error: 'Invalid month' });
  const channel = sanitizeChannel(body.channel || body.app_channel);
  const action = String(body.action || '');
  if (!ACTIONS.has(action)) return sendJson(res, 400, { ok: false, error: 'Invalid action' });
  const note = String(body.note || '').trim().slice(0, 2000);

  const db = sql();
  const from = `${month}-01`;
  const to = lastDayOfMonth(month);
  const [counts] = await db`select
      count(*)::int as total,
      count(*) filter (where submission_status = 'submitted')::int as submitted
    from expenses
    where app_channel = ${channel} and date >= ${from} and date <= ${to}`;
  const isSubmitted = counts.total > 0 && counts.submitted === counts.total;
  const [current] = await db`select * from month_reviews where app_channel = ${channel} and month = ${month}`;
  const currentStatus = current ? current.status : null;

  if (action === 'approve') {
    if (!isSubmitted) return conflict(res, 'Only a submitted month can be approved');
    if (currentStatus === 'reimbursed') return conflict(res, 'This month is already reimbursed');
    const row = await upsert(channel, month, 'approved', note, session);
    return done(res, { month, channel, action, review: row });
  }

  if (action === 'reimburse') {
    if (!isSubmitted || currentStatus !== 'approved') return conflict(res, 'Approve the month before marking it reimbursed');
    const row = await upsert(channel, month, 'reimbursed', note || (current && current.note) || '', session);
    return done(res, { month, channel, action, review: row });
  }

  if (action === 'send_back') {
    if (!isSubmitted) return conflict(res, 'Only a submitted month can be sent back');
    if (currentStatus === 'reimbursed') return conflict(res, 'A reimbursed month cannot be sent back');
    // Rouvrir le mois : c'est exactement ce que PATCH /api/expenses autorise
    // deja a la finance (submission_status -> pending), fait ici en une fois.
    const reopened = await db`update expenses
      set submission_status = 'pending', submitted_at = null
      where app_channel = ${channel} and date >= ${from} and date <= ${to}
        and submission_status = 'submitted'
      returning id`;
    const row = await upsert(channel, month, 'sent_back', note, session);
    return done(res, { month, channel, action, review: row, reopened: reopened.length });
  }

  // undo : annule une approbation ou un remboursement saisi par erreur, le mois
  // redevient « soumis, en attente de controle ». Un renvoi ne s'annule pas :
  // le mois est rouvert, c'est a l'utilisateur de le soumettre a nouveau.
  if (!currentStatus || currentStatus === 'sent_back') return conflict(res, 'Nothing to undo');
  if (currentStatus === 'reimbursed') {
    const row = await upsert(channel, month, 'approved', current.note || '', session);
    return done(res, { month, channel, action, review: row });
  }
  await db`delete from month_reviews where app_channel = ${channel} and month = ${month}`;
  return done(res, { month, channel, action, review: null });
}

async function upsert(channel, month, status, note, session) {
  const [row] = await sql()`insert into month_reviews (app_channel, month, status, note, decided_at, decided_by)
    values (${channel}, ${month}, ${status}, ${note}, now(), ${session.email || ''})
    on conflict (app_channel, month) do update set
      status = excluded.status,
      note = excluded.note,
      decided_at = excluded.decided_at,
      decided_by = excluded.decided_by
    returning *`;
  return publicRow(row);
}

function publicRow(row) {
  if (!row) return null;
  return {
    app_channel: row.app_channel,
    month: row.month,
    status: row.status,
    note: row.note || '',
    decided_at: row.decided_at instanceof Date ? row.decided_at.toISOString() : row.decided_at,
    decided_by: row.decided_by || ''
  };
}

function done(res, payload) {
  return sendJson(res, 200, { ok: true, ...payload });
}

function conflict(res, error) {
  return sendJson(res, 409, { ok: false, error });
}

function validMonth(value) {
  const text = String(value || '').trim();
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(text) ? text : null;
}

function lastDayOfMonth(month) {
  const [year, m] = month.split('-').map(Number);
  const day = new Date(year, m, 0).getDate();
  return `${year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
