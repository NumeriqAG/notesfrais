const { sendJson, readJson, methodNotAllowed, getQuery } = require('./_lib/http');
const { requireSession } = require('./_lib/auth');
const { sql, ensureSchema, toDbExpense, normalizeReceiptItems } = require('./_lib/db');
const { receiptItemsFromRow, newReceiptItems, sendReceiptBackupEmails } = require('./_lib/receipt-email');

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
  const receiptItems = updates.receipt_items === undefined ? undefined : normalizeReceiptItems(updates.receipt_items);
  const set = {
    date: updates.date,
    merchant: updates.merchant,
    amount: updates.amount == null ? undefined : Number(updates.amount),
    amount_chf: updates.amount_chf == null ? undefined : Number(updates.amount_chf),
    tva: updates.tva == null ? undefined : Number(updates.tva),
    category: updates.category,
    currency: updates.currency,
    note: updates.note,
    status: updates.status,
    ubs_label: updates.ubs_label,
    ubs_date: updates.ubs_date,
    amt_diff: updates.amt_diff,
    receipt_url: updates.receipt_url,
    receipt_name: updates.receipt_name,
    receipt_items: receiptItems === undefined ? undefined : JSON.stringify(receiptItems),
    app_channel: updates.app_channel,
    submission_status: updates.submission_status,
    submitted_at: updates.submitted_at
  };
  return db`update expenses set
    date = coalesce(${set.date}, date),
    merchant = coalesce(${set.merchant}, merchant),
    amount = coalesce(${set.amount}, amount),
    amount_chf = coalesce(${set.amount_chf}, amount_chf),
    tva = coalesce(${set.tva}, tva),
    category = coalesce(${set.category}, category),
    currency = coalesce(${set.currency}, currency),
    note = coalesce(${set.note}, note),
    status = coalesce(${set.status}, status),
    ubs_label = coalesce(${set.ubs_label}, ubs_label),
    ubs_date = coalesce(${set.ubs_date}, ubs_date),
    amt_diff = coalesce(${set.amt_diff}, amt_diff),
    receipt_url = coalesce(${set.receipt_url}, receipt_url),
    receipt_name = coalesce(${set.receipt_name}, receipt_name),
    receipt_items = coalesce(${set.receipt_items}::jsonb, receipt_items),
    app_channel = coalesce(${set.app_channel}, app_channel),
    submission_status = coalesce(${set.submission_status}, submission_status),
    submitted_at = coalesce(${set.submitted_at}, submitted_at)
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
  return sendJson(res, 200, { ok: true, data: rows[0] });
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
