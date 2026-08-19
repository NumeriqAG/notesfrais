const { sendJson, readJson, methodNotAllowed, getQuery } = require('./_lib/http');
const { requireSession } = require('./_lib/auth');
const { sql, ensureSchema, toDbExpense, normalizeReceiptItems } = require('./_lib/db');
const { receiptItemsFromRow, newReceiptItems, sendReceiptBackupEmails } = require('./_lib/receipt-email');
const { deleteObject } = require('./_lib/r2');

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
  'submitted_at'
]);

module.exports = async function handler(req, res) {
  try {
    const session = requireSession(req);
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
  const item = toDbExpense(Array.isArray(body) ? body[0] : body, session);
  if (session.role !== 'finance' && await isSubmittedMonth(item.app_channel, item.date)) {
    return sendJson(res, 403, { ok: false, error: 'This month is closed and can no longer be changed' });
  }
  const [row] = await sql()`insert into expenses (
    date, merchant, amount, amount_chf, tva, category, currency, status, note,
    ubs_label, ubs_date, amt_diff, receipt_url, receipt_name, receipt_items, app_channel,
    submission_status, submitted_at
  ) values (
    ${item.date}, ${item.merchant}, ${item.amount}, ${item.amount_chf}, ${item.tva},
    ${item.category}, ${item.currency}, ${item.status}, ${item.note}, ${item.ubs_label},
    ${item.ubs_date}, ${item.amt_diff}, ${item.receipt_url}, ${item.receipt_name}, ${JSON.stringify(item.receipt_items)}::jsonb,
    ${item.app_channel}, ${item.submission_status}, ${item.submitted_at}
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
    ? await sql()`select id, date, app_channel, submission_status, receipt_url, receipt_name, receipt_items from expenses where id = any(${ids})`
    : await sql()`select id, date, app_channel, submission_status, receipt_url, receipt_name, receipt_items from expenses where id = any(${ids}) and app_channel = ${session.app_channel}`;
  if (current.length !== ids.length) return sendJson(res, 403, { ok: false, error: 'Expense not accessible' });
  if (session.role !== 'finance') {
    const updateKeys = Object.keys(updates);
    const submissionOnly = updateKeys.length > 0 && updateKeys.every(key => key === 'submission_status' || key === 'submitted_at');
    if (!submissionOnly && current.some(row => row.submission_status === 'submitted')) {
      return sendJson(res, 403, { ok: false, error: 'This month is closed and can no longer be changed' });
    }
    if (!submissionOnly && updates.date && await isSubmittedMonth(session.app_channel, updates.date)) {
      return sendJson(res, 403, { ok: false, error: 'The destination month is closed' });
    }
  }

  const rows = await updateRows(ids, updates);
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
    submitted_at = case when ${has('submitted_at')} then ${updates.submitted_at || null}::timestamptz else submitted_at end
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
