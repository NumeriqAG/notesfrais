const crypto = require('crypto');
const { sendJson, readJson, methodNotAllowed } = require('./_lib/http');
const { requireSession } = require('./_lib/auth');
const { sql, ensureSchema } = require('./_lib/db');
const { notifyExpenseComment } = require('./_lib/notify');

// Fil de commentaires entre la finance et l'employe sur un frais, et statut de
// controle « a corriger ».
//
//   POST /api/expense-comments  { expense_id, body?, review_status? }
//
// - body          : texte du commentaire (facultatif si on change seulement le statut)
// - review_status : 'to_fix' | 'ok' — reserve a la finance
//
// Les commentaires sont stockes dans expenses.comments (jsonb) et reviennent
// donc avec chaque lecture de /api/expenses, sans requete supplementaire.
// L'ajout est atomique (comments || nouveau) : deux messages simultanes ne
// s'ecrasent pas.
//
// Pas de RLS ici (cf. CLAUDE.md §3) : les controles sont refaits ci-dessous.
// - un 'user' ne commente que les frais de SON canal ;
// - seule la finance change review_status ;
// - commenter reste possible sur un mois soumis : c'est precisement le moment
//   ou la finance pose ses questions.
//
// La reponse ne renvoie que { id, comments, review_status } : aucune colonne
// date, donc rien a normaliser (piege des dates Neon, CLAUDE.md §5).

const MAX_BODY = 2000;
const MAX_COMMENTS = 200;
const REVIEW_STATUSES = new Set(['ok', 'to_fix']);

module.exports = async function handler(req, res) {
  try {
    const session = requireSession(req);
    await ensureSchema();
    if (req.method === 'POST') return addComment(req, res, session);
    return methodNotAllowed(res, ['POST']);
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || String(error) });
  }
};

async function addComment(req, res, session) {
  const payload = await readJson(req);
  const id = Number(payload.expense_id || payload.expenseId || payload.id);
  if (!id) return sendJson(res, 400, { ok: false, error: 'Missing expense id' });

  const text = String(payload.body || '').trim();
  if (text.length > MAX_BODY) return sendJson(res, 400, { ok: false, error: `Comment too long (max ${MAX_BODY} characters)` });

  let reviewStatus = null;
  if (payload.review_status !== undefined && payload.review_status !== null) {
    if (session.role !== 'finance') return sendJson(res, 403, { ok: false, error: 'Only finance can change the review status' });
    if (!REVIEW_STATUSES.has(payload.review_status)) return sendJson(res, 400, { ok: false, error: 'Invalid review status' });
    reviewStatus = payload.review_status;
  }
  if (!text && !reviewStatus) return sendJson(res, 400, { ok: false, error: 'Empty comment' });

  const db = sql();
  const [current] = session.role === 'finance'
    ? await db`select id, review_status, jsonb_array_length(comments) as n from expenses where id = ${id}`
    : await db`select id, review_status, jsonb_array_length(comments) as n from expenses where id = ${id} and app_channel = ${session.app_channel}`;
  if (!current) return sendJson(res, 404, { ok: false, error: 'Expense not found' });
  if (Number(current.n) >= MAX_COMMENTS) return sendJson(res, 400, { ok: false, error: 'Too many comments on this expense' });

  const entries = [];
  const now = new Date().toISOString();
  const author = {
    role: session.role === 'finance' ? 'finance' : 'user',
    email: String(session.email || '')
  };
  if (reviewStatus && reviewStatus !== current.review_status) {
    // Trace du changement de statut dans le fil : chacun voit qui a demande
    // une correction et quand elle a ete levee.
    entries.push({ id: crypto.randomUUID(), at: now, ...author, kind: 'status', review_status: reviewStatus });
  }
  if (text) entries.push({ id: crypto.randomUUID(), at: now, ...author, kind: 'comment', body: text });
  if (entries.length === 0) {
    const [row] = await db`select id, comments, review_status from expenses where id = ${id}`;
    return sendJson(res, 200, { ok: true, data: row });
  }

  const [row] = await db`update expenses set
      comments = comments || ${JSON.stringify(entries)}::jsonb,
      review_status = case when ${Boolean(reviewStatus)} then ${reviewStatus}::text else review_status end
    where id = ${id}
    returning id, comments, review_status`;

  // Commentaire ou statut pose par la finance : prevenir l'utilisateur du
  // canal (email puis Web Push). notifyExpenseComment n'echoue jamais ; le
  // commentaire est deja enregistre.
  let notification;
  if (session.role === 'finance') {
    const statusChanged = entries.some(entry => entry.kind === 'status');
    const [expense] = await db`select id, app_channel, merchant, amount, amount_chf, date from expenses where id = ${id}`;
    if (expense) {
      notification = await notifyExpenseComment({
        channel: expense.app_channel,
        expense,
        comment: text,
        reviewStatus: statusChanged ? reviewStatus : null
      }).catch(error => ({ email: { ok: false, error: error.message || String(error) }, push: { ok: false } }));
    }
  }
  return sendJson(res, 200, { ok: true, data: row, ...(notification ? { notification } : {}) });
}
