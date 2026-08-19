const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { sendJson, readJson, methodNotAllowed } = require('./_lib/http');
const { requireSession } = require('./_lib/auth');
const { sql, ensureSchema, normalizeReceiptItems } = require('./_lib/db');
const { getObject } = require('./_lib/r2');

let gmailTransport;

module.exports = async function handler(req, res) {
  try {
    const session = requireSession(req);
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    if (session.role !== 'user' || !['mike', 'test'].includes(session.app_channel)) {
      return sendJson(res, 403, { ok: false, error: 'Only a user channel can submit its month' });
    }

    await ensureSchema();
    const body = await readJson(req);
    const month = String(body.month || '').trim();
    if (!/^\d{4}-\d{2}$/.test(month)) return sendJson(res, 400, { ok: false, error: 'Invalid month' });

    const from = `${month}-01`;
    const to = lastDayOfMonth(month);
    const db = sql();
    const rows = await db`
      select * from expenses
      where app_channel = ${session.app_channel}
        and date >= ${from}
        and date <= ${to}
      order by date asc, id asc`;

    if (rows.length === 0) {
      return sendJson(res, 400, { ok: false, error: 'No expenses to submit for this month' });
    }
    const alreadySubmitted = rows.every(row => row.submission_status === 'submitted');

    const receiptEntries = await collectReceipts(rows, month);
    if (receiptEntries.length === 0) {
      return sendJson(res, 400, { ok: false, error: 'No receipt available for this month' });
    }

    const zip = createZip(receiptEntries);
    const submittedAt = new Date().toISOString();
    const monthLabel = monthLabelFor(month);
    const totalCHF = rows.reduce((sum, row) => sum + Math.abs(Number(row.amount_chf || row.amount || 0)), 0);
    const recipient = monthlySubmissionRecipient(session.app_channel);

    const mail = await sendSubmissionEmail({
      to: recipient,
      session,
      month,
      monthLabel,
      rows,
      totalCHF,
      submittedAt,
      zip
    });

    const ids = rows.map(row => Number(row.id)).filter(Boolean);
    const updated = alreadySubmitted
      ? rows
      : await db`
        update expenses
        set submission_status = 'submitted',
            submitted_at = ${submittedAt}
        where id = any(${ids})
          and app_channel = ${session.app_channel}
        returning *`;

    return sendJson(res, 200, {
      ok: true,
      month,
      monthLabel,
      submittedAt,
      expenseCount: updated.length,
      receiptCount: receiptEntries.length,
      totalCHF,
      to: recipient,
      mail,
      resent: alreadySubmitted,
      data: updated
    });
  } catch (error) {
    console.error('Monthly submission failed', error);
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || String(error) });
  }
};

async function collectReceipts(rows, month) {
  const entries = [];
  const usedNames = new Set();
  for (const row of rows) {
    const items = receiptItemsFor(row);
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const object = await getObject(item.path);
      const content = await bodyToBuffer(object.Body);
      const original = item.name || item.path.split('/').pop() || 'receipt';
      const name = uniqueName(usedNames, [
        String(row.date || month),
        safeFileName(row.merchant || 'expense'),
        items.length > 1 ? `receipt-${index + 1}` : '',
        safeFileName(original)
      ].filter(Boolean).join('_'));
      entries.push({
        name,
        content,
        contentType: object.ContentType || 'application/octet-stream'
      });
    }
  }
  return entries;
}

function receiptItemsFor(row) {
  const items = normalizeReceiptItems(row && row.receipt_items);
  if (items.length > 0) return items;
  return row && row.receipt_url
    ? [{ path: String(row.receipt_url), name: row.receipt_name || 'receipt' }]
    : [];
}

async function sendSubmissionEmail({ to, session, monthLabel, rows, totalCHF, submittedAt, zip }) {
  const isTest = session && session.app_channel === 'test';
  if (!to) throw new Error('Finance email missing');

  const gmailUser = cleanText(process.env.GMAIL_SMTP_USER);
  const gmailPassword = String(process.env.GMAIL_SMTP_APP_PASSWORD || '').replace(/\s+/g, '');
  const from = process.env.MONTHLY_SUBMISSION_FROM ||
    process.env.RECEIPT_MAIL_FROM ||
    (gmailUser ? `NotesFrais Numeriq <${gmailUser}>` : process.env.SUBMISSION_MAIL_FROM || 'NotesFrais <onboarding@resend.dev>');
  const subject = `${isTest ? '[PREPROD - ignorer] ' : ''}Mike submitted expenses for ${monthLabel}`;
  const totalLabel = formatAmount(totalCHF);
  const text = [
    `Mike submitted his expenses for ${monthLabel}.`,
    `User: ${session.email}`,
    `Expenses: ${rows.length}`,
    `Total: CHF ${totalLabel}`,
    `Submitted at: ${submittedAt}`,
    '',
    'All available receipts are attached in the ZIP file.'
  ].join('\n');
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1a1a1a">
      <h2 style="margin:0 0 12px">Monthly expenses submitted</h2>
      <p>Mike submitted his expenses for <strong>${escapeHtml(monthLabel)}</strong>.</p>
      <ul>
        <li>User: ${escapeHtml(session.email)}</li>
        <li>Expenses: ${rows.length}</li>
        <li>Total: CHF ${escapeHtml(totalLabel)}</li>
        <li>Submitted at: ${escapeHtml(submittedAt)}</li>
      </ul>
      <p>All available receipts are attached in the ZIP file.</p>
    </div>`;

  const attachment = {
    filename: `receipts_${safeFileName(monthLabel)}.zip`,
    content: zip,
    contentType: 'application/zip'
  };

  if (gmailUser && gmailPassword) {
    if (!gmailTransport) {
      gmailTransport = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailPassword },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 25000
      });
    }
    const result = await gmailTransport.sendMail({
      from,
      to,
      subject,
      html,
      text,
      attachments: [attachment]
    });
    return { provider: 'gmail', id: result.messageId || null };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('No email provider configured');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `monthly-submission-${crypto.createHash('sha256').update(`${session.id}:${monthLabel}:${submittedAt}`).digest('hex').slice(0, 32)}`
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
      attachments: [{
        filename: attachment.filename,
        content: zip.toString('base64')
      }]
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data && data.message ? data.message : `Resend HTTP ${response.status}`);
  return { provider: 'resend', id: data.id || null };
}

function createZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of entries) {
    const nameBuffer = Buffer.from(safeZipPath(entry.name), 'utf8');
    const content = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(entry.content || '');
    const crc = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBuffer, content);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + content.length;
  }
  const central = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, central, end]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let c = index;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function bodyToBuffer(body) {
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function lastDayOfMonth(month) {
  const [year, m] = month.split('-').map(Number);
  const day = new Date(year, m, 0).getDate();
  return `${year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function monthLabelFor(month) {
  const [year, m] = month.split('-').map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function cleanText(value, fallback = '') {
  return String(value || fallback).replace(/[<>]/g, '').trim();
}

function monthlySubmissionRecipient(channel) {
  // Une soumission de preprod part de preference vers une autre adresse ; a
  // defaut elle rejoint la boite finance, mais son objet la signale (cf. subject).
  const testRecipient = channel === 'test' ? cleanText(process.env.MONTHLY_SUBMISSION_TEST_EMAIL) : '';
  const recipient = testRecipient || cleanText(process.env.MONTHLY_SUBMISSION_EMAIL || process.env.FINANCE_NOTIFICATION_EMAIL);
  if (!recipient) {
    const error = new Error('MONTHLY_SUBMISSION_EMAIL missing');
    error.statusCode = 500;
    throw error;
  }
  return recipient;
}

function escapeHtml(value) {
  return cleanText(value).replace(/[&"']/g, char => ({ '&': '&amp;', '"': '&quot;', "'": '&#39;' }[char]));
}

function formatAmount(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
}

function safeFileName(value) {
  return String(value || 'file')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'file';
}

function safeZipPath(value) {
  return safeFileName(value).replace(/^-+|-+$/g, '') || 'receipt';
}

function uniqueName(used, name) {
  const clean = safeZipPath(name);
  if (!used.has(clean)) {
    used.add(clean);
    return clean;
  }
  const dot = clean.lastIndexOf('.');
  const base = dot > 0 ? clean.slice(0, dot) : clean;
  const ext = dot > 0 ? clean.slice(dot) : '';
  let index = 2;
  while (used.has(`${base}-${index}${ext}`)) index += 1;
  const next = `${base}-${index}${ext}`;
  used.add(next);
  return next;
}
