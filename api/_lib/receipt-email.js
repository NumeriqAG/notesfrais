// Recapitulatif d'un frais envoye a l'employe (nov. 2026, Thomas : « une
// securite »). A chaque frais enregistre, l'employe recoit un email en anglais
// qui confirme l'enregistrement, reprend tous les details du frais et porte le
// ou les justificatifs en piece jointe. C'est sa copie de sauvegarde.
//
//  - kind 'created'       : frais cree (POST), avec ou sans justificatif ;
//  - kind 'receipt_added' : justificatif ajoute plus tard a un frais (PATCH),
//                           seuls les nouveaux fichiers sont joints.
// Une autre modification n'envoie rien.
//
// Destinataire : RECEIPT_BACKUP_EMAIL, sinon l'email de la session. Canal
// « test » : seulement si RECEIPT_BACKUP_TEST_EMAIL est definie, objet prefixe
// [PREPROD - ignorer]. N'est PAS concerne par USER_NOTIFICATION_EMAILS
// (api/_lib/notify.js) : cet email-ci reste toujours actif.
//
// N'echoue jamais : un email rate ne doit pas annuler l'enregistrement.

const crypto = require('crypto');

let gmailTransport;

// Gmail refuse au-dela de 25 Mo, base64 compris (+33 %) : on joint jusqu'a
// 18 Mo de fichiers bruts, le reste est cite dans l'email.
const MAX_ATTACHMENT_BYTES = 18 * 1024 * 1024;

const CATEGORY_LABELS = {
  repas: 'Meals',
  transport: 'Transport',
  hotel: 'Hotel',
  materiel: 'Equipment',
  autre: 'Other'
};

const FX_SOURCE_LABELS = {
  ecb: 'estimated at the ECB rate of the day',
  card: 'amount debited, from the card statement',
  manual: 'set by finance',
  missing: 'exchange rate not available yet'
};

const BRAND = {
  ink: '#1B2733',
  slate: '#2E3E4F',
  blue: '#0F5E92',
  bg: '#F3F6F9',
  line: '#E3E8EE',
  muted: '#66768A',
  green: '#1E7B4F',
  greenBg: '#E7F4EC',
  amber: '#8A5A00',
  amberBg: '#FFF4DC'
};

function cleanText(value, fallback = '') {
  return String(value == null || value === '' ? fallback : value).replace(/[<>]/g, '').trim();
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function safeFileName(value) {
  return String(value || 'receipt')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
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

// ---- Mise en forme -------------------------------------------------------

// Neon renvoie les colonnes date comme des objets Date (voir CLAUDE.md §5).
function isoDay(value) {
  if (!value) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function longDate(value) {
  const day = isoDay(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return cleanText(value);
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
  });
}

function shortDate(value) {
  const day = isoDay(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return cleanText(value);
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
  });
}

function monthLabel(value) {
  const day = isoDay(value);
  if (!/^\d{4}-\d{2}/.test(day)) return '';
  const [y, m] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function zurichTime(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Zurich'
  }) + ' (Zurich time)';
}

// Format suisse, comme l'app (brand.js) : 2'961.80
function money(value) {
  const n = Number(value);
  const v = Number.isFinite(n) ? n : 0;
  const parts = Math.abs(v).toFixed(2).split('.');
  return (v < 0 ? '-' : '') + parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, "'") + '.' + parts[1];
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB';
  return Math.max(1, Math.round(n / 1024)) + ' KB';
}

// La note en base porte aussi la carte et le « Avec qui ? » sur des lignes
// prefixees (formulaire actuel en anglais, anciennes notes en francais).
function parseNote(note) {
  const out = { card: '', withWhom: '', note: '' };
  const rest = [];
  String(note || '').split(/\r?\n/).forEach(raw => {
    const line = raw.trim();
    if (!line) return;
    const card = line.match(/^(?:Payment card|Card used|Carte utilis(?:e|é)e?)\s*:\s*(.+)$/i);
    if (card) {
      const value = card[1].trim().toLowerCase();
      out.card = /^(company|entreprise)/.test(value) ? 'Company card'
        : /^(personal|perso)/.test(value) ? 'Personal card'
          : card[1].trim();
      return;
    }
    const withWhom = line.match(/^(?:With|Avec)\s*:\s*(.+)$/i);
    if (withWhom) { out.withWhom = withWhom[1].trim(); return; }
    rest.push(line);
  });
  out.note = rest.join('\n');
  return out;
}

function expenseFacts(expense) {
  const e = expense || {};
  const currency = cleanText(e.currency, 'CHF').toUpperCase();
  const foreign = currency !== 'CHF';
  const amount = Number(e.amount || 0);
  const chf = e.amount_chf == null || e.amount_chf === '' ? null : Number(e.amount_chf);
  const tva = Number(e.tva || 0);
  const parsed = parseNote(e.note);
  const merchant = cleanText(e.merchant, 'Expense');
  const rate = Number(e.fx_rate);

  const rows = [];
  rows.push(['Date', longDate(e.date)]);
  rows.push(['Merchant', merchant]);
  rows.push(['Amount', `${currency} ${money(amount)}`]);
  if (foreign) {
    const source = FX_SOURCE_LABELS[e.fx_source] || '';
    const chfText = e.fx_source === 'missing' || chf == null || !Number.isFinite(chf)
      ? 'Not available yet'
      : `CHF ${money(chf)}`;
    rows.push(['Amount in CHF', chfText, [
      source,
      Number.isFinite(rate) && rate > 0 && e.fx_source !== 'missing' ? `1 ${currency} = ${rate.toFixed(4)} CHF` : ''
    ].filter(Boolean).join(' · ')]);
  }
  rows.push(['VAT', tva > 0 ? `${currency} ${money(tva)}` : 'None entered']);
  rows.push(['Category', CATEGORY_LABELS[e.category] || cleanText(e.category, 'Other')]);
  if (parsed.card) rows.push(['Paid with', parsed.card]);
  if (parsed.withWhom) rows.push(['With', parsed.withWhom]);
  if (parsed.note) rows.push(['Note', parsed.note]);
  if (e.ubs_label) rows.push(['Statement match', `${cleanText(e.ubs_label)}${e.ubs_date ? ' · ' + shortDate(e.ubs_date) : ''}`]);
  const month = monthLabel(e.date);
  if (month) rows.push(['Expense month', month]);
  if (e.id) rows.push(['Reference', `#${e.id}`]);
  rows.push(['Saved', zurichTime(e.created_at)]);

  const headline = foreign
    ? `${currency} ${money(amount)}`
    : `CHF ${money(chf != null && Number.isFinite(chf) ? chf : amount)}`;
  const subline = foreign && chf != null && Number.isFinite(chf) && e.fx_source !== 'missing'
    ? `≈ CHF ${money(chf)}`
    : '';
  return { merchant, currency, foreign, amount, chf, headline, subline, rows };
}

function appUrlFor(channel) {
  const base = cleanText(process.env.APP_BASE_URL).replace(/\/+$/, '');
  if (!base) return '';
  return base + (channel === 'test' ? '/test' : '/mike');
}

// Construit l'email (sujet, texte, HTML) sans rien envoyer. Exporte pour
// tools/preview-receipt-email.js.
function buildExpenseRecapEmail({ expense, kind = 'created', attachments = [], skipped = [], channel = 'mike' }) {
  const facts = expenseFacts(expense);
  const added = kind === 'receipt_added';
  const prefix = channel === 'test' ? '[PREPROD - ignorer] ' : '';
  const when = shortDate(expense && expense.date);
  const subject = `${prefix}${added ? 'Receipt added' : 'Expense saved'}: ${facts.merchant}, ${facts.headline}${when ? ` (${when})` : ''}`;
  const title = added ? 'Receipt added to your expense' : 'Your expense has been saved';
  const intro = added
    ? `We confirm that a new receipt was added to your expense at ${facts.merchant}. The new file is attached to this email.`
    : `We confirm that your expense at ${facts.merchant} has been recorded in Numeriq Payroll. Here is everything that was saved.`;
  const appUrl = appUrlFor(channel);
  const noReceipt = attachments.length === 0 && skipped.length === 0;

  const receiptLines = attachments.map(a => `${a.filename} (${formatBytes(a.size)})`);
  const skippedLines = skipped.map(s => `${s.name} (${s.reason})`);

  const text = [
    title,
    '',
    intro,
    '',
    ...facts.rows.map(([label, value, hint]) => `${label}: ${String(value).replace(/\n/g, ' / ')}${hint ? ` (${hint})` : ''}`),
    '',
    noReceipt
      ? 'No receipt is attached to this expense yet. Add one in the app before you submit the month.'
      : `${added ? 'New receipt' : 'Receipt'}${receiptLines.length > 1 ? 's' : ''} attached: ${receiptLines.join(', ') || 'none'}`,
    skippedLines.length ? `Not attached (still safe in the app): ${skippedLines.join(', ')}` : '',
    '',
    'Keep this email as your backup copy. If something is wrong, edit the expense in the app.',
    "If you did not record this expense, let finance know.",
    appUrl ? `Open the app: ${appUrl}` : ''
  ].filter(line => line !== null && line !== undefined).join('\n').replace(/\n{3,}/g, '\n\n').trim();

  const detailRows = facts.rows.map(([label, value, hint], index) => `
          <tr>
            <td style="padding:10px 0;border-top:${index ? `1px solid ${BRAND.line}` : '0'};color:${BRAND.muted};font-size:13px;width:38%;vertical-align:top">${escapeHtml(label)}</td>
            <td style="padding:10px 0;border-top:${index ? `1px solid ${BRAND.line}` : '0'};color:${BRAND.ink};font-size:14px;font-weight:600;vertical-align:top">${escapeHtml(value).replace(/\n/g, '<br>')}${hint ? `<div style="font-weight:400;font-size:12px;color:${BRAND.muted};margin-top:2px">${escapeHtml(hint)}</div>` : ''}</td>
          </tr>`).join('');

  const receiptBlock = noReceipt
    ? `<div style="background:${BRAND.amberBg};color:${BRAND.amber};border-radius:10px;padding:12px 14px;font-size:14px;line-height:1.45">
          <strong>No receipt attached yet.</strong> Add one in the app before you submit the month.
        </div>`
    : `<div style="background:${BRAND.bg};border-radius:10px;padding:12px 14px">
          <div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${BRAND.muted};font-weight:700;margin-bottom:6px">📎 ${added ? 'New receipt' : 'Receipt'}${attachments.length > 1 ? 's' : ''} attached</div>
          ${attachments.map(a => `<div style="font-size:14px;color:${BRAND.ink};padding:2px 0">${escapeHtml(a.filename)} <span style="color:${BRAND.muted}">· ${escapeHtml(formatBytes(a.size))}</span></div>`).join('')}
          ${skipped.map(s => `<div style="font-size:13px;color:${BRAND.amber};padding:2px 0">${escapeHtml(s.name)} · not attached (${escapeHtml(s.reason)}), still safe in the app</div>`).join('')}
        </div>`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.bg}">
  <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(`${facts.merchant} · ${facts.headline} · ${longDate(expense && expense.date)}`)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${BRAND.line}">
        <tr><td style="background:${BRAND.slate};padding:16px 24px;color:#ffffff;font-size:13px;letter-spacing:.08em;text-transform:uppercase;font-weight:700">Numeriq Payroll</td></tr>
        <tr><td style="padding:24px 24px 8px">
          <div style="display:inline-block;background:${BRAND.greenBg};color:${BRAND.green};border-radius:999px;padding:4px 12px;font-size:13px;font-weight:700">✓ ${added ? 'Receipt added' : 'Saved'}</div>
          <h1 style="margin:14px 0 6px;font-size:22px;line-height:1.25;color:${BRAND.ink}">${escapeHtml(title)}</h1>
          <p style="margin:0;color:${BRAND.muted};font-size:15px;line-height:1.5">${escapeHtml(intro)}</p>
        </td></tr>
        <tr><td style="padding:16px 24px 4px">
          <div style="font-size:15px;color:${BRAND.muted}">${escapeHtml(facts.merchant)}</div>
          <div style="font-size:30px;font-weight:800;color:${BRAND.ink};letter-spacing:-.01em;margin-top:2px">${escapeHtml(facts.headline)}</div>
          ${facts.subline ? `<div style="font-size:14px;color:${BRAND.muted};margin-top:2px">${escapeHtml(facts.subline)}</div>` : ''}
        </td></tr>
        <tr><td style="padding:12px 24px 8px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detailRows}
          </table>
        </td></tr>
        <tr><td style="padding:8px 24px 20px">${receiptBlock}</td></tr>
        ${appUrl ? `<tr><td style="padding:0 24px 20px"><a href="${escapeHtml(appUrl)}" style="display:inline-block;background:${BRAND.blue};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 20px;border-radius:10px">Open the app</a></td></tr>` : ''}
        <tr><td style="padding:16px 24px 22px;border-top:1px solid ${BRAND.line};color:${BRAND.muted};font-size:12px;line-height:1.5">
          Keep this email as your backup copy. If something is wrong, edit the expense in the app.<br>
          If you did not record this expense, let finance know.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, text, html };
}

// ---- Envoi ---------------------------------------------------------------

function recipientFor(session) {
  if (session.app_channel === 'test') return cleanText(process.env.RECEIPT_BACKUP_TEST_EMAIL);
  return cleanText(process.env.RECEIPT_BACKUP_EMAIL || session.email);
}

async function loadAttachments(items, expense) {
  const { getObject } = require('./r2');
  const attachments = [];
  const skipped = [];
  let total = 0;
  const usedNames = new Set();
  for (const item of items) {
    const name = item.name || item.path.split('/').pop();
    try {
      const object = await getObject(item.path);
      const content = await bodyToBuffer(object.Body);
      if (total + content.length > MAX_ATTACHMENT_BYTES) {
        skipped.push({ name, reason: 'too large for email' });
        continue;
      }
      total += content.length;
      let filename = safeFileName(name);
      if (usedNames.has(filename)) filename = `${attachments.length + 1}-${filename}`;
      usedNames.add(filename);
      attachments.push({
        path: item.path,
        filename,
        content,
        size: content.length,
        contentType: object.ContentType || 'application/octet-stream'
      });
    } catch (error) {
      console.error('Receipt recap: could not read receipt', {
        expenseId: expense && expense.id,
        path: item.path,
        error: error.message || String(error)
      });
      skipped.push({ name, reason: 'could not be read' });
    }
  }
  return { attachments, skipped };
}

async function sendReceiptBackupEmails({ session, expense, receiptItems, kind = 'created' }) {
  try {
    if (!session || session.role !== 'user' || !['mike', 'test'].includes(session.app_channel)) {
      return { skipped: true, reason: 'Not an employee save', sent: 0, failed: 0 };
    }
    const to = recipientFor(session);
    const apiKey = process.env.RESEND_API_KEY;
    const gmailReady = Boolean(process.env.GMAIL_SMTP_USER && process.env.GMAIL_SMTP_APP_PASSWORD);
    if (!to) return { skipped: true, reason: 'Recipient missing', sent: 0, failed: 0 };
    if (!apiKey && !gmailReady) return { skipped: true, reason: 'No email provider configured', sent: 0, failed: 0 };

    const items = Array.isArray(receiptItems) ? receiptItems.filter(item => item && item.path) : [];
    if (kind === 'receipt_added' && items.length === 0) {
      return { skipped: true, reason: 'No new receipt', sent: 0, failed: 0 };
    }

    const { attachments, skipped } = await loadAttachments(items, expense);
    const email = buildExpenseRecapEmail({ expense, kind, attachments, skipped, channel: session.app_channel });
    const hash = crypto.createHash('sha256')
      .update(`${kind}:${expense && expense.id || 'new'}:${items.map(item => item.path).join('|')}`)
      .digest('hex').slice(0, 32);
    const result = await deliver({ apiKey, to, email, attachments, idempotencyKey: `expense-recap-${hash}` });
    return {
      skipped: false,
      sent: 1,
      failed: 0,
      attached: attachments.length,
      notAttached: skipped.length,
      id: result.id || null
    };
  } catch (error) {
    console.error('Expense recap email failed', {
      expenseId: expense && expense.id,
      error: error.message || String(error)
    });
    return { skipped: false, sent: 0, failed: 1, error: error.message || String(error) };
  }
}

async function deliver({ apiKey, to, email, attachments, idempotencyKey }) {
  const gmailUser = cleanText(process.env.GMAIL_SMTP_USER);
  const gmailPassword = String(process.env.GMAIL_SMTP_APP_PASSWORD || '').replace(/\s+/g, '');
  const from = process.env.RECEIPT_MAIL_FROM ||
    (gmailUser ? `NotesFrais Numeriq <${gmailUser}>` : process.env.SUBMISSION_MAIL_FROM || 'NotesFrais <onboarding@resend.dev>');

  if (gmailUser && gmailPassword) {
    if (!gmailTransport) {
      const nodemailer = require('nodemailer');
      gmailTransport = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailPassword },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 30000
      });
    }
    const result = await gmailTransport.sendMail({
      from,
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      attachments: attachments.map(a => ({ filename: a.filename, content: a.content, contentType: a.contentType }))
    });
    return { id: result.messageId || null, provider: 'gmail' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        attachments: attachments.map(a => ({ filename: a.filename, content: a.content.toString('base64') }))
      })
    });
  } finally {
    clearTimeout(timer);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data && data.message ? data.message : `Resend HTTP ${response.status}`);
  return data;
}

module.exports = {
  receiptItemsFromRow,
  newReceiptItems,
  sendReceiptBackupEmails,
  buildExpenseRecapEmail,
  parseNote
};
