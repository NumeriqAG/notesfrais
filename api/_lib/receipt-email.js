const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { getObject } = require('./r2');

let gmailTransport;

function cleanText(value, fallback = '') {
  return String(value || fallback).replace(/[<>]/g, '').trim();
}

function escapeHtml(value) {
  return cleanText(value).replace(/[&"']/g, char => ({
    '&': '&amp;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function safeFileName(value) {
  return String(value || 'receipt')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'receipt';
}

function receiptItemsFromRow(row) {
  const items = Array.isArray(row && row.receipt_items) ? row.receipt_items : [];
  if (items.length > 0) {
    return items
      .map(item => ({
        path: String(item && item.path || '').trim(),
        name: String(item && item.name || 'receipt').trim() || 'receipt'
      }))
      .filter(item => item.path);
  }
  return row && row.receipt_url
    ? [{ path: String(row.receipt_url), name: row.receipt_name || 'receipt' }]
    : [];
}

function newReceiptItems(previousRow, nextRow) {
  const previousPaths = new Set(receiptItemsFromRow(previousRow).map(item => item.path));
  return receiptItemsFromRow(nextRow).filter(item => !previousPaths.has(item.path));
}

async function bodyToBuffer(body) {
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function sendReceiptBackupEmails({ session, expense, receiptItems }) {
  if (!session || session.role !== 'user' || session.app_channel !== 'mike') {
    return { skipped: true, reason: 'Not a Mike user upload', sent: 0, failed: 0 };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const gmailReady = Boolean(process.env.GMAIL_SMTP_USER && process.env.GMAIL_SMTP_APP_PASSWORD);
  const to = cleanText(process.env.RECEIPT_BACKUP_EMAIL || session.email);
  if ((!apiKey && !gmailReady) || !to) {
    return {
      skipped: true,
      reason: !to ? 'Recipient missing' : 'No email provider configured',
      sent: 0,
      failed: 0
    };
  }

  const items = Array.isArray(receiptItems) ? receiptItems.filter(item => item && item.path) : [];
  if (items.length === 0) return { skipped: true, reason: 'No new receipt', sent: 0, failed: 0 };

  const results = [];
  for (const item of items) {
    try {
      const object = await getObject(item.path);
      const content = await bodyToBuffer(object.Body);
      const result = await sendReceiptEmail({
        apiKey,
        to,
        expense,
        item,
        content,
        contentType: object.ContentType || 'application/octet-stream'
      });
      results.push({ path: item.path, ok: true, id: result.id || null });
    } catch (error) {
      console.error('Receipt backup email failed', {
        expenseId: expense && expense.id,
        path: item.path,
        error: error.message || String(error)
      });
      results.push({ path: item.path, ok: false, error: error.message || String(error) });
    }
  }

  return {
    skipped: false,
    sent: results.filter(result => result.ok).length,
    failed: results.filter(result => !result.ok).length,
    results
  };
}

async function sendReceiptEmail({ apiKey, to, expense, item, content, contentType }) {
  const merchant = cleanText(expense && expense.merchant, 'Expense');
  const date = cleanText(expense && expense.date, '');
  const amount = Number(expense && (expense.amount_chf ?? expense.amount) || 0);
  const amountLabel = Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
  const fileName = safeFileName(item.name || item.path.split('/').pop());
  const gmailUser = cleanText(process.env.GMAIL_SMTP_USER);
  const gmailPassword = String(process.env.GMAIL_SMTP_APP_PASSWORD || '').replace(/\s+/g, '');
  const from = process.env.RECEIPT_MAIL_FROM ||
    (gmailUser ? `NotesFrais Numeriq <${gmailUser}>` : process.env.SUBMISSION_MAIL_FROM || 'NotesFrais <onboarding@resend.dev>');
  const subject = `Receipt backup - ${merchant} - CHF ${amountLabel}`;
  const text = [
    'A receipt saved in NotesFrais is attached to this email.',
    `Merchant: ${merchant}`,
    `Amount: CHF ${amountLabel}`,
    date ? `Date: ${date}` : '',
    `File: ${fileName}`,
    expense && expense.id ? `Expense ID: ${expense.id}` : ''
  ].filter(Boolean).join('\n');
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1a1a1a">
      <h2 style="margin:0 0 12px">Receipt backup</h2>
      <p>The receipt saved in NotesFrais is attached to this email.</p>
      <ul>
        <li>Merchant: ${escapeHtml(merchant)}</li>
        <li>Amount: CHF ${escapeHtml(amountLabel)}</li>
        ${date ? `<li>Date: ${escapeHtml(date)}</li>` : ''}
        <li>File: ${escapeHtml(fileName)}</li>
        ${expense && expense.id ? `<li>Expense ID: ${escapeHtml(expense.id)}</li>` : ''}
      </ul>
    </div>`;
  const hash = crypto.createHash('sha256').update(`${expense && expense.id || 'new'}:${item.path}`).digest('hex').slice(0, 32);

  if (gmailUser && gmailPassword) {
    if (!gmailTransport) {
      gmailTransport = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailPassword
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000
      });
    }
    const result = await gmailTransport.sendMail({
      from,
      to,
      subject,
      html,
      text,
      attachments: [{
        filename: fileName,
        content,
        contentType: contentType || 'application/octet-stream'
      }]
    });
    return { id: result.messageId || null, provider: 'gmail' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `receipt-backup-${hash}`
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text,
        attachments: [{
          filename: fileName,
          content: content.toString('base64')
        }]
      })
    });
  } finally {
    clearTimeout(timer);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data && data.message ? data.message : `Resend HTTP ${response.status}`);
  }
  return data;
}

module.exports = {
  receiptItemsFromRow,
  newReceiptItems,
  sendReceiptBackupEmails
};
