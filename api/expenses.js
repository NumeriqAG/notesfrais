const { sendJson, readJson, methodNotAllowed, getQuery } = require('./_lib/http');
const { requireSession, refreshSession } = require('./_lib/auth');
const { sql, ensureSchema, toDbExpense, normalizeReceiptItems } = require('./_lib/db');
const { receiptItemsFromRow, newReceiptItems, sendReceiptBackupEmails } = require('./_lib/receipt-email');
const { deleteObject } = require('./_lib/r2');
const { normalizeCurrency, ecbRate, withChfEstimate, round2 } = require('./_lib/fx');

const ALLOWED_UPDATE_FIELDS = new Set([
  'date',
  'merchant',
  'amount',
  'amount_chf',
  'tva',
  'category',
  'currency',
  'note',
  'status',
  'ubs_label',
  'ubs_date',
  'amt_diff',
  'receipt_url',
  'receipt_name',
  'receipt_items',
  'app_channel',
  'submission_status',
  'submitted_at',
  'fx_rate',
  'fx_source'
]);

module.exports = async function handler(req, res) {
  try {
    const session = requireSession(req);
    refreshSession(req, res, session);
    await ensureSchema();

    if (req.method === 'GET') return listExpenses(req, res, session);
    if (req.method === 'POST') return createExpense(req, res, session);
    if (req.method === 'PATCH') return updateExpenses(req, res, session);
    if (req.method === 'DELETE') return deleteExpense(req, res, session);

    return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE']);
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || String(error) });
  }
};

async function listExpenses(req, res, session) {
  const query = getQuery(req);
  const from = query.get('from') || `${query.get('month') || new Date().toISOString().slice(0, 7)}-01`;
  const to = query.get('to') || lastDayOfMonth(query.get('month') || from.slice(0, 7));
  const db = sql();
  const rows = session.role === 'finance'
    ? await db`select * from expenses where date >= ${from} and date <= ${to} order by date desc, id desc`
    : await db`select * from expenses where app_channel = ${session.app_channel} and date >= ${from} and date <= ${to} order by date desc, id desc`;
  return sendJson(res, 200, { ok: true, data: rows });
}

async function createExpense(req, res, session) {
  const body = await readJson(req);
  // Le montant CHF d'un frais en devise est toujours calcule ici (cours BCE du
  // jour du frais), jamais repris tel quel du navigateur.
  const item = await withChfEstimate(toDbExpense(Array.isArray(body) ? body[0] : body, session));
  if (session.role !== 'finance' && await isSubmittedMonth(item.app_channel, item.date)) {
    return sendJson(res, 403, { ok: false, error: 'This month is closed and can no longer be changed' });
  }
  const [row] = await sql()`insert into expenses (
    date, merchant, amount, amount_chf, tva, category, currency, status, note,
    ubs_label, ubs_date, amt_diff, receipt_url, receipt_name, receipt_items, app_channel,
    submission_status, submitted_at, fx_rate, fx_source, fx_date
  ) values (
    ${item.date}, ${item.merchant}, ${item.amount}, ${item.amount_chf}, ${item.tva},
    ${item.category}, ${item.currency}, ${item.status}, ${item.note}, ${item.ubs_label},
    ${item.ubs_date}, ${item.amt_diff}, ${item.receipt_url}, ${item.receipt_name}, ${JSON.stringify(item.receipt_items)}::jsonb,
    ${item.app_channel}, ${item.submission_status}, ${item.submitted_at},
    ${item.fx_rate}, ${item.fx_source}, ${item.fx_date}
  ) returning *`;
  const receiptEmail = await sendReceiptBackupEmails({
    session,
    expense: row,
    receiptItems: receiptItemsFromRow(row)
  });
  return sendJson(res, 201, { ok: true, data: row, receiptEmail });
}

async function updateExpenses(req, res, session) {
  const body = await readJson(req);
  const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Boolean) : [Number(body.id)].filter(Boolean);
  if (ids.length === 0) return sendJson(res, 400, { ok: false, error: 'Missing id' });

  const updates = Object.fromEntries(Object.entries(body.values || body.update || {})
    .filter(([key]) => ALLOWED_UPDATE_FIELDS.has(key)));
  if (Object.keys(updates).length === 0) return sendJson(res, 400, { ok: false, error: 'No allowed update fields' });
  if (session.role !== 'finance') {
    delete updates.app_channel;
    const updateKeys = Object.keys(updates);
    const submissionOnly = updateKeys.length > 0 && updateKeys.every(key => key === 'submission_status' || key === 'submitted_at');
    if (!submissionOnly) {
      delete updates.submission_status;
      delete updates.submitted_at;
    }
    if (updates.submission_status && updates.submission_status !== 'submitted') {
      return sendJson(res, 403, { ok: false, error: 'Only finance can reopen a submitted month' });
    }
    if (updates.submission_status === 'submitted' && !updates.submitted_at) {
      updates.submitted_at = new Date().toISOString();
    }
  }
  if (Object.keys(updates).length === 0) return sendJson(res, 400, { ok: false, error: 'No allowed update fields' });

  const current = session.role === 'finance'
    ? await sql()`select id, date, amount, currency, fx_source, app_channel, submission_status, review_status, receipt_url, receipt_name, receipt_items from expenses where id = any(${ids})`
    : await sql()`select id, date, amount, currency, fx_source, app_channel, submission_status, review_status, receipt_url, receipt_name, receipt_items from expenses where id = any(${ids}) and app_channel = ${session.app_channel}`;
  if (current.length !== ids.length) return sendJson(res, 403, { ok: false, error: 'Expense not accessible' });
  if (session.role !== 'finance') {
    const updateKeys = Object.keys(updates);
    const submissionOnly = updateKeys.length > 0 && updateKeys.every(key => key === 'submission_status' || key === 'submitted_at');
    // Un mois soumis est clos, sauf pour un frais que la finance a marque
    // « a corriger » (api/expense-comments.js) : l'employe doit pouvoir le
    // reprendre. Il reste dans son mois — le deplacer ailleurs le ferait
    // sortir du lot deja envoye a la finance.
    const lockedRows = current.filter(row => row.submission_status === 'submitted' && row.review_status !== 'to_fix');
    if (!submissionOnly && lockedRows.length > 0) {
      return sendJson(res, 403, { ok: false, error: 'This month is closed and can no longer be changed' });
    }
    const movedOutOfClosedMonth = updates.date && current.some(row =>
      row.submission_status === 'submitted' && monthOf(row.date) !== monthOf(updates.date));
    if (!submissionOnly && movedOutOfClosedMonth) {
      return sendJson(res, 403, { ok: false, error: 'An expense of a submitted month must stay in that month' });
    }
    const staysInOwnClosedMonth = current.every(row => row.submission_status === 'submitted');
    if (!submissionOnly && updates.date && !staysInOwnClosedMonth && await isSubmittedMonth(session.app_channel, updates.date)) {
      return sendJson(res, 403, { ok: false, error: 'The destination month is closed' });
    }
  }

  const rows = await applyUpdates(current, updates, session);
  const currentById = new Map(current.map(row => [Number(row.id), row]));
  const receiptEmailResults = [];
  for (const row of rows) {
    const newItems = newReceiptItems(currentById.get(Number(row.id)), row);
    if (newItems.length > 0) {
      receiptEmailResults.push(await sendReceiptBackupEmails({
        session,
        expense: row,
        receiptItems: newItems
      }));
    }
  }
  return sendJson(res, 200, { ok: true, data: rows, receiptEmail: receiptEmailResults });
}

const FX_KEYS = ['amount_chf', 'fx_rate', 'fx_source', 'fx_date'];
const touchesFx = updates => ['amount', 'currency', 'date', 'amount_chf', 'fx_rate', 'fx_source'].some(key =>
  Object.prototype.hasOwnProperty.call(updates, key));

// Une mise a jour qui touche au montant, a la devise ou a la date se calcule
// frais par frais : le montant CHF d'un frais en devise en depend.
async function applyUpdates(current, updates, session) {
  if (!touchesFx(updates)) return updateRows(current.map(row => Number(row.id)), updates);
  const rows = [];
  for (const row of current) {
    const own = await fxUpdatesFor(row, updates, session);
    rows.push(...await updateRows([Number(row.id)], own));
  }
  return rows;
}

// Regles du montant CHF (voir api/_lib/fx.js) :
//  - frais en CHF : amount_chf suit amount ;
//  - releve de carte (fx_source 'card' + amount_chf) : montant reellement
//    debite, pour l'employe comme pour la finance ;
//  - finance (fx_source 'manual' + fx_rate ou amount_chf) : correction ;
//  - fx_source 'ecb' : recalcul demande ;
//  - montant, devise ou date reellement modifies : nouvelle estimation BCE ;
//  - sinon la valeur en place est gardee, quoi qu'envoie le navigateur.
async function fxUpdatesFor(row, updates, session) {
  const has = key => Object.prototype.hasOwnProperty.call(updates, key);
  const out = { ...updates };
  FX_KEYS.forEach(key => { delete out[key]; });
  if (has('currency')) out.currency = normalizeCurrency(updates.currency);
  const currency = has('currency') ? out.currency : normalizeCurrency(row.currency);
  const amount = has('amount') ? Number(updates.amount || 0) : Number(row.amount || 0);
  const date = has('date') ? updates.date : row.date;
  const changed = (has('amount') && Math.abs(Number(updates.amount || 0) - Number(row.amount || 0)) > 0.0049)
    || (has('currency') && out.currency !== normalizeCurrency(row.currency))
    || (has('date') && String(updates.date || '').slice(0, 10) !== isoDay(row.date));

  if (currency === 'CHF') {
    if (has('amount') || has('currency') || has('amount_chf')) {
      Object.assign(out, { amount_chf: amount, fx_rate: null, fx_source: null, fx_date: null });
    }
    return out;
  }
  const chf = has('amount_chf') && updates.amount_chf !== null && updates.amount_chf !== '' ? Number(updates.amount_chf) : null;
  const rate = has('fx_rate') && updates.fx_rate !== null && updates.fx_rate !== '' ? Number(updates.fx_rate) : null;
  if (updates.fx_source === 'card' && Number.isFinite(chf) && chf > 0) {
    return Object.assign(out, {
      amount_chf: round2(chf),
      fx_rate: amount > 0 ? chf / amount : null,
      fx_source: 'card',
      fx_date: updates.ubs_date || date || null
    });
  }
  if (session.role === 'finance' && updates.fx_source === 'manual' && ((Number.isFinite(rate) && rate > 0) || (Number.isFinite(chf) && chf >= 0))) {
    const useRate = Number.isFinite(rate) && rate > 0;
    return Object.assign(out, {
      amount_chf: useRate ? round2(amount * rate) : round2(chf),
      fx_rate: useRate ? rate : (amount > 0 ? chf / amount : null),
      fx_source: 'manual',
      fx_date: date || null
    });
  }
  if (updates.fx_source === 'ecb' || changed || !row.fx_source) {
    try {
      const fresh = await ecbRate(currency, date);
      return Object.assign(out, { amount_chf: round2(amount * fresh.rate), fx_rate: fresh.rate, fx_source: 'ecb', fx_date: fresh.rateDay });
    } catch (_error) {
      return Object.assign(out, { amount_chf: amount, fx_rate: null, fx_source: 'missing', fx_date: null });
    }
  }
  return out;
}

function isoDay(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value || '').slice(0, 10);
}

async function updateRows(ids, updates) {
  const db = sql();
  // coalesce(valeur, colonne) rendait impossible de remettre un champ a NULL :
  // on ne pouvait donc pas detacher un justificatif d'une depense. Le motif
  // "case when <fourni> then <valeur> else <colonne> end" distingue « champ
  // absent de la requete » de « champ explicitement vide ».
  const has = key => Object.prototype.hasOwnProperty.call(updates, key);
  const num = key => (has(key) && updates[key] !== null && updates[key] !== '' ? Number(updates[key]) : null);
  const items = has('receipt_items') ? JSON.stringify(normalizeReceiptItems(updates.receipt_items)) : null;
  return db`update expenses set
    date = case when ${has('date')} then ${updates.date ?? null}::date else date end,
    merchant = case when ${has('merchant')} then ${updates.merchant ?? null}::text else merchant end,
    amount = case when ${has('amount')} then ${num('amount')}::numeric else amount end,
    amount_chf = case when ${has('amount_chf')} then ${num('amount_chf')}::numeric else amount_chf end,
    tva = case when ${has('tva')} then ${num('tva')}::numeric else tva end,
    category = case when ${has('category')} then ${updates.category ?? null}::text else category end,
    currency = case when ${has('currency')} then ${updates.currency ?? null}::text else currency end,
    note = case when ${has('note')} then ${updates.note ?? null}::text else note end,
    status = case when ${has('status')} then ${updates.status ?? null}::text else status end,
    ubs_label = case when ${has('ubs_label')} then ${updates.ubs_label ?? null}::text else ubs_label end,
    ubs_date = case when ${has('ubs_date')} then ${updates.ubs_date || null}::date else ubs_date end,
    amt_diff = case when ${has('amt_diff')} then ${num('amt_diff')}::numeric else amt_diff end,
    receipt_url = case when ${has('receipt_url')} then ${updates.receipt_url ?? null}::text else receipt_url end,
    receipt_name = case when ${has('receipt_name')} then ${updates.receipt_name ?? null}::text else receipt_name end,
    receipt_items = case when ${has('receipt_items')} then ${items}::jsonb else receipt_items end,
    app_channel = case when ${has('app_channel')} then ${updates.app_channel ?? null}::text else app_channel end,
    submission_status = case when ${has('submission_status')} then ${updates.submission_status ?? null}::text else submission_status end,
    submitted_at = case when ${has('submitted_at')} then ${updates.submitted_at || null}::timestamptz else submitted_at end,
    fx_rate = case when ${has('fx_rate')} then ${num('fx_rate')}::numeric else fx_rate end,
    fx_source = case when ${has('fx_source')} then ${updates.fx_source ?? null}::text else fx_source end,
    fx_date = case when ${has('fx_date')} then ${updates.fx_date || null}::date else fx_date end
    where id = any(${ids})
    returning *`;
}

async function deleteExpense(req, res, session) {
  const query = getQuery(req);
  const id = Number(query.get('id'));
  if (!id) return sendJson(res, 400, { ok: false, error: 'Missing id' });
  if (session.role !== 'finance') {
    const [current] = await sql()`select id, submission_status from expenses where id = ${id} and app_channel = ${session.app_channel}`;
    if (!current) return sendJson(res, 404, { ok: false, error: 'Expense not found' });
    if (current.submission_status === 'submitted') {
      return sendJson(res, 403, { ok: false, error: 'This month is closed and can no longer be changed' });
    }
  }
  const rows = session.role === 'finance'
    ? await sql()`delete from expenses where id = ${id} returning *`
    : await sql()`delete from expenses where id = ${id} and app_channel = ${session.app_channel} returning *`;
  if (rows.length === 0) return sendJson(res, 404, { ok: false, error: 'Expense not found' });

  // Supprimer aussi les justificatifs du stockage. Sans ca ils restent dans R2
  // sans que plus rien ne les reference : ni l'app ni /api/receipts ne peuvent
  // les atteindre, puisque l'acces exige une ligne en base. On le fait apres le
  // DELETE, qui renvoie la ligne et donc les chemins ; un echec de suppression
  // de fichier ne doit pas annuler la suppression du frais.
  const orphaned = receiptItemsFromRow(rows[0]).map(item => item.path).filter(Boolean);
  const receiptCleanup = { removed: 0, failed: [] };
  for (const path of orphaned) {
    try {
      await deleteObject(path);
      receiptCleanup.removed += 1;
    } catch (error) {
      receiptCleanup.failed.push(path);
    }
  }
  return sendJson(res, 200, { ok: true, data: rows[0], receiptCleanup });
}

function monthOf(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 7);
  return String(value || '').slice(0, 7);
}

function lastDayOfMonth(month) {
  const [year, m] = month.split('-').map(Number);
  const day = new Date(year, m, 0).getDate();
  return `${year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

async function isSubmittedMonth(appChannel, date) {
  const month = String(date || '').slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return false;
  const from = `${month}-01`;
  const to = lastDayOfMonth(month);
  const [row] = await sql()`select 1 from expenses
    where app_channel = ${appChannel}
      and date >= ${from}
      and date <= ${to}
      and submission_status = 'submitted'
    limit 1`;
  return Boolean(row);
}
