const { neon } = require('@neondatabase/serverless');

let sqlClient;
let schemaReady;

function sql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing');
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL);
  return sqlClient;
}

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = sql()`alter table expenses add column if not exists receipt_items jsonb not null default '[]'::jsonb`;
  }
  await schemaReady;
}

function normalizeReceiptItems(input) {
  const raw = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? safeJsonArray(input)
      : [];
  return raw
    .map(item => ({
      path: String(item && (item.path || item.url || item.receiptPath || item.receipt_url) || '').trim(),
      name: String(item && (item.name || item.receiptName || item.receipt_name) || 'justificatif').trim() || 'justificatif'
    }))
    .filter(item => item.path);
}

function safeJsonArray(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function toDbExpense(input, session) {
  const channel = session.role === 'finance'
    ? sanitizeChannel(input.app_channel || input.appChannel || 'mike')
    : session.app_channel;
  const receiptItems = normalizeReceiptItems(input.receipt_items || input.receiptItems);
  const receiptPath = input.receipt_url || input.receiptPath || input.receiptUrl || (receiptItems[0] && receiptItems[0].path) || null;
  const receiptName = input.receipt_name || input.receiptName || (receiptItems[0] && receiptItems[0].name) || null;
  const finalReceiptItems = receiptItems.length > 0
    ? receiptItems
    : receiptPath
      ? [{ path: receiptPath, name: receiptName || 'justificatif' }]
      : [];
  return {
    date: input.date,
    merchant: input.merchant,
    amount: Number(input.amount || 0),
    amount_chf: Number(input.amount_chf || input.amountCHF || input.amount || 0),
    tva: Number(input.tva || 0),
    category: input.category || 'autre',
    currency: input.currency || 'CHF',
    status: input.status || 'pending',
    note: input.note || '',
    ubs_label: input.ubs_label || (input.ubsRow && input.ubsRow.label) || '',
    ubs_date: input.ubs_date || (input.ubsRow && input.ubsRow.date) || null,
    amt_diff: Number(input.amt_diff || input.amtDiff || 0),
    receipt_url: receiptPath,
    receipt_name: receiptName,
    receipt_items: finalReceiptItems,
    app_channel: channel,
    submission_status: input.submission_status || input.submissionStatus || 'pending',
    submitted_at: input.submitted_at || input.submittedAt || null
  };
}

function sanitizeChannel(value) {
  return value === 'test' ? 'test' : 'mike';
}

function canAccess(row, session) {
  return session.role === 'finance' || row.app_channel === session.app_channel;
}

module.exports = { sql, ensureSchema, toDbExpense, sanitizeChannel, canAccess, normalizeReceiptItems };
