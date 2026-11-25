// Notifications vers l'utilisateur d'un canal (Mike sur 'mike', le compte de
// test sur 'test') : email d'abord (meme transport que le reste : Gmail SMTP,
// sinon Resend), puis Web Push vers la PWA installee (iOS 16.4+, ecran
// d'accueil uniquement).
//
// Regle : une notification ne doit JAMAIS faire echouer l'action qui la
// declenche. Les fonctions exportees n'echouent pas ; elles rendent le resultat
// de chaque canal d'envoi pour que l'appelant puisse l'afficher.
//
// Deux points d'entree :
// - notifyUser({ channel, title, body, intro, message, tag, idempotencyKey })
//   generique, pour toute action de la finance (commentaire sur un frais...).
// - notifyMonthReview({ channel, month, action, note, reviewId })
//   pour les decisions sur un mois soumis (approve | send_back | reimburse).
// - notifyExpenseComment({ channel, expense, comment, reviewStatus })
//   pour un commentaire ou un statut pose par la finance sur un frais.
const nodemailer = require('nodemailer');
const webpush = require('web-push');
const { sql } = require('./db');
const { profilesFromEnv } = require('./auth');

let gmailTransport;
let pushSchemaReady;

async function ensurePushSchema() {
  if (!pushSchemaReady) {
    pushSchemaReady = sql()`create table if not exists push_subscriptions (
      endpoint text primary key,
      p256dh text not null,
      auth text not null,
      app_channel text not null,
      email text not null default '',
      user_agent text not null default '',
      created_at timestamptz not null default now(),
      last_success_at timestamptz
    )`.catch(error => {
      pushSchemaReady = null;
      throw error;
    });
  }
  await pushSchemaReady;
}

function cleanText(value, fallback = '') {
  return String(value == null ? fallback : value).replace(/[<>]/g, '').trim();
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function sanitizeChannel(channel) {
  return channel === 'test' ? 'test' : 'mike';
}

// Destinataire des emails d'un canal. Par ordre de priorite :
// USER_NOTIFICATION_EMAIL (USER_NOTIFICATION_TEST_EMAIL pour la preprod),
// puis l'email du compte « user » declare pour ce canal.
function recipientForChannel(channel) {
  const override = channel === 'test'
    ? cleanText(process.env.USER_NOTIFICATION_TEST_EMAIL)
    : cleanText(process.env.USER_NOTIFICATION_EMAIL);
  if (override) return override;
  try {
    const profile = profilesFromEnv().find(item => item.role === 'user' && item.app_channel === channel);
    return profile ? cleanText(profile.email) : '';
  } catch (_error) {
    return '';
  }
}

function appPathFor(channel) {
  return channel === 'test' ? '/test' : '/mike';
}

function appUrlFor(channel) {
  const base = cleanText(process.env.APP_BASE_URL).replace(/\/+$/, '');
  return base ? base + appPathFor(channel) : '';
}

function monthLabelFor(month) {
  const [year, m] = String(month || '').split('-').map(Number);
  if (!year || !m) return String(month || '');
  return new Date(Date.UTC(year, m - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

async function sendEmail({ channel, title, intro, message, idempotencyKey }) {
  const to = recipientForChannel(channel);
  const apiKey = process.env.RESEND_API_KEY;
  const gmailUser = cleanText(process.env.GMAIL_SMTP_USER);
  const gmailPassword = String(process.env.GMAIL_SMTP_APP_PASSWORD || '').replace(/\s+/g, '');
  if (!to) return { ok: false, skipped: true, reason: 'Recipient missing' };
  if (!apiKey && !(gmailUser && gmailPassword)) return { ok: false, skipped: true, reason: 'No email provider configured' };

  const note = String(message || '').trim();
  const prefix = channel === 'test' ? '[PREPROD - ignorer] ' : '';
  const subject = `${prefix}NotesFrais - ${title}`;
  const url = appUrlFor(channel);
  const from = process.env.USER_NOTIFICATION_FROM ||
    process.env.RECEIPT_MAIL_FROM ||
    (gmailUser ? `NotesFrais Numeriq <${gmailUser}>` : process.env.SUBMISSION_MAIL_FROM || 'NotesFrais <onboarding@resend.dev>');
  const text = [
    intro,
    note ? `\nMessage from finance:\n${note}` : '',
    url ? `\nOpen NotesFrais: ${url}` : ''
  ].filter(Boolean).join('\n');
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1a1a1a">
      <h2 style="margin:0 0 12px">${escapeHtml(title)}</h2>
      <p>${escapeHtml(intro)}</p>
      ${note ? `<blockquote style="margin:12px 0;padding:10px 14px;border-left:3px solid #1A3FB5;background:#F5F3EF;white-space:pre-wrap">${escapeHtml(note)}</blockquote>` : ''}
      ${url ? `<p><a href="${escapeHtml(url)}">Open NotesFrais</a></p>` : ''}
    </div>`;

  try {
    if (gmailUser && gmailPassword) {
      if (!gmailTransport) {
        gmailTransport = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: gmailUser, pass: gmailPassword },
          connectionTimeout: 15000,
          greetingTimeout: 15000,
          socketTimeout: 20000
        });
      }
      const result = await gmailTransport.sendMail({ from, to, subject, html, text });
      return { ok: true, provider: 'gmail', to, id: result.messageId || null };
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
          ...(idempotencyKey ? { 'Idempotency-Key': String(idempotencyKey).slice(0, 256) } : {})
        },
        body: JSON.stringify({ from, to: [to], subject, html, text })
      });
    } finally {
      clearTimeout(timer);
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data && data.message ? data.message : `Resend HTTP ${response.status}`);
    return { ok: true, provider: 'resend', to, id: data.id || null };
  } catch (error) {
    console.error('User notification email failed', { channel, title, error: error.message || String(error) });
    return { ok: false, to, error: error.message || String(error) };
  }
}

function vapidConfig() {
  const publicKey = cleanText(process.env.VAPID_PUBLIC_KEY);
  const privateKey = cleanText(process.env.VAPID_PRIVATE_KEY);
  // Apple refuse le jeton VAPID sans sujet mailto: ou https: valide.
  const subject = cleanText(process.env.VAPID_SUBJECT) || 'mailto:notesfrais@example.com';
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

async function sendPush({ channel, title, body, tag }) {
  const vapid = vapidConfig();
  if (!vapid) return { ok: false, skipped: true, reason: 'VAPID keys missing', sent: 0, failed: 0 };
  await ensurePushSchema();
  const subscriptions = await sql()`select endpoint, p256dh, auth from push_subscriptions where app_channel = ${channel}`;
  if (subscriptions.length === 0) return { ok: false, skipped: true, reason: 'No device subscribed', sent: 0, failed: 0 };

  const payload = JSON.stringify({ title, body, url: appPathFor(channel), tag: tag || 'notesfrais-finance' });
  let sent = 0;
  let failed = 0;
  let removed = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { vapidDetails: vapid, TTL: 60 * 60 * 24 * 7, urgency: 'normal', timeout: 10000 }
      );
      sent += 1;
      await sql()`update push_subscriptions set last_success_at = now() where endpoint = ${sub.endpoint}`;
    } catch (error) {
      failed += 1;
      // 404/410 : l'abonnement n'existe plus (PWA supprimee, permission retiree).
      if (error && (error.statusCode === 404 || error.statusCode === 410)) {
        removed += 1;
        await sql()`delete from push_subscriptions where endpoint = ${sub.endpoint}`.catch(() => undefined);
      } else {
        console.error('User notification push failed', { channel, status: error && error.statusCode, error: error && (error.body || error.message) });
      }
    }
  }
  return { ok: sent > 0, sent, failed, removed };
}

async function notifyUser({ channel, title, body, intro, message, tag, idempotencyKey }) {
  // Canal inconnu : ne rien envoyer plutot que de retomber sur 'mike'. Une
  // action sur le canal 'test' ne doit jamais atteindre Mike.
  if (channel !== 'mike' && channel !== 'test') {
    const skipped = { ok: false, skipped: true, reason: 'Unknown channel' };
    return { email: skipped, push: skipped };
  }
  const target = channel;
  const safeTitle = cleanText(title, 'NotesFrais');
  const email = await sendEmail({
    channel: target,
    title: safeTitle,
    intro: cleanText(intro || body),
    message,
    idempotencyKey
  }).catch(error => ({ ok: false, error: error.message || String(error) }));
  const push = await sendPush({
    channel: target,
    title: safeTitle,
    body: String(body || message || '').trim().slice(0, 300),
    tag
  }).catch(error => ({ ok: false, error: error.message || String(error) }));
  return { email, push };
}

// Decisions de la finance sur un mois soumis. Les actions suivent la route
// /api/month-review : approve | send_back | reimburse. 'undo' et toute action
// inconnue ne notifient rien.
function describeMonthReview({ month, action, note }) {
  const label = monthLabelFor(month);
  const quoted = String(note || '').trim();
  if (action === 'approve') {
    return {
      title: `${label} approved`,
      body: quoted ? `Finance approved your expenses: "${quoted}"` : 'Finance approved your expenses.',
      intro: `Finance approved your expenses for ${label}.`
    };
  }
  if (action === 'send_back') {
    return {
      title: `${label} sent back`,
      body: quoted ? `Finance reopened the month: "${quoted}"` : 'Finance reopened the month. Please check it and submit again.',
      intro: `Finance sent ${label} back to you. The month is open again: correct what is asked, then submit it again.`
    };
  }
  if (action === 'reimburse') {
    return {
      title: `${label} reimbursed`,
      body: quoted ? `Your expenses were reimbursed: "${quoted}"` : 'Your expenses for the month were reimbursed.',
      intro: `Finance marked your expenses for ${label} as reimbursed.`
    };
  }
  return null;
}

async function notifyMonthReview({ channel, month, action, note, reviewId }) {
  const text = describeMonthReview({ month, action, note });
  if (!text) return { email: { ok: false, skipped: true, reason: 'Nothing to notify' }, push: { ok: false, skipped: true, reason: 'Nothing to notify' } };
  return notifyUser({
    channel,
    ...text,
    message: note,
    tag: `notesfrais-month-${sanitizeChannel(channel)}-${month}`,
    idempotencyKey: `month-review-${sanitizeChannel(channel)}-${month}-${action}-${reviewId || Date.now()}`
  });
}

// Commentaire ou statut pose par la finance sur un frais (route
// /api/expense-comments). reviewStatus : 'to_fix' | 'ok' | null.
async function notifyExpenseComment({ channel, expense, comment, reviewStatus }) {
  const row = expense || {};
  const merchant = cleanText(row.merchant, 'an expense');
  const amount = Number(row.amount_chf ?? row.amount);
  const what = Number.isFinite(amount) && amount ? `${merchant} (CHF ${Math.abs(amount).toFixed(2)})` : merchant;
  const body = String(comment || '').trim();
  const title = reviewStatus === 'to_fix'
    ? `Finance asks you to fix ${merchant}`
    : reviewStatus === 'ok'
      ? `Finance checked ${merchant}`
      : `Finance commented on ${merchant}`;
  const intro = reviewStatus === 'to_fix'
    ? `Finance asks you to correct ${what}.`
    : reviewStatus === 'ok'
      ? `Finance marked ${what} as OK.`
      : `Finance left a comment on ${what}.`;
  return notifyUser({
    channel,
    title,
    body: body || intro,
    intro,
    message: body,
    tag: `notesfrais-expense-${row.id || 'x'}`,
    idempotencyKey: `expense-comment-${row.id || 'x'}-${Date.now()}`
  });
}

module.exports = {
  ensurePushSchema,
  notifyUser,
  notifyMonthReview,
  notifyExpenseComment,
  describeMonthReview,
  vapidConfig,
  recipientForChannel
};
