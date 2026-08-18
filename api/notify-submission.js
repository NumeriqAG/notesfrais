function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

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

function formatAmount(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function sendWithResend({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { skipped: true, reason: 'RESEND_API_KEY missing' };
  }

  const from = process.env.SUBMISSION_MAIL_FROM || 'NotesFrais <onboarding@resend.dev>';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, to: [to], subject, html, text })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data && data.message ? data.message : `Resend HTTP ${response.status}`;
    throw new Error(message);
  }
  return { skipped: false, id: data.id || null };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  }

  try {
    const body = await readBody(req);
    const userName = cleanText(body.userName, 'Utilisateur');
    const userEmail = cleanText(body.userEmail, '');
    const monthLabel = cleanText(body.monthLabel, 'le mois');
    const expenseCount = Number(body.expenseCount || 0);
    const totalCHF = formatAmount(body.totalCHF);
    const submittedAt = cleanText(body.submittedAt, new Date().toISOString());
    const financeEmail = financeNotificationRecipient();

    const subject = `${userName} a soumis ses frais de ${monthLabel}`;
    const text = [
      `${userName} a soumis ses frais de ${monthLabel}.`,
      userEmail ? `Utilisateur: ${userEmail}` : '',
      `Nombre de frais: ${expenseCount}`,
      `Total: CHF ${totalCHF}`,
      `Date de soumission: ${submittedAt}`
    ].filter(Boolean).join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1a1a1a">
        <h2 style="margin:0 0 12px">Soumission de frais</h2>
        <p><strong>${escapeHtml(userName)}</strong> a soumis ses frais de <strong>${escapeHtml(monthLabel)}</strong>.</p>
        <ul>
          ${userEmail ? `<li>Utilisateur: ${escapeHtml(userEmail)}</li>` : ''}
          <li>Nombre de frais: ${expenseCount}</li>
          <li>Total: CHF ${escapeHtml(totalCHF)}</li>
          <li>Date de soumission: ${escapeHtml(submittedAt)}</li>
        </ul>
      </div>`;

    const result = await sendWithResend({ to: financeEmail, subject, html, text });
    return sendJson(res, 200, { ok: true, to: financeEmail, ...result });
  } catch (error) {
    return sendJson(res, 500, { ok: false, error: error.message || String(error) });
  }
};

function financeNotificationRecipient() {
  const recipient = cleanText(process.env.FINANCE_NOTIFICATION_EMAIL);
  if (!recipient) {
    const error = new Error('FINANCE_NOTIFICATION_EMAIL missing');
    error.statusCode = 500;
    throw error;
  }
  return recipient;
}
