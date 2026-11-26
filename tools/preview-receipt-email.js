// Rend le recapitulatif envoye a l'employe pour quelques frais types, sans
// rien envoyer : .patch-out/email/*.html (et .txt). Voir api/_lib/receipt-email.js.
//   node tools/preview-receipt-email.js
const fs = require('fs');
const path = require('path');
const { buildExpenseRecapEmail } = require('../api/_lib/receipt-email');

process.env.APP_BASE_URL = process.env.APP_BASE_URL || 'https://notesfrais.example.ch';
const out = path.join(__dirname, '..', '.patch-out', 'email');
fs.mkdirSync(out, { recursive: true });

const samples = {
  '1-chf-repas': {
    expense: {
      id: 412, created_at: '2026-11-26T11:42:00Z', date: new Date('2026-11-25T00:00:00Z'),
      merchant: 'Café de Paris', amount: 86.4, amount_chf: 86.4, tva: 6.17, currency: 'CHF', category: 'repas',
      note: 'Payment card: company\nWith: Julien Morel (client)\nLunch about the Q1 roadmap'
    },
    attachments: [{ filename: 'IMG_4821.jpg', size: 412000 }]
  },
  '2-eur-taxi': {
    expense: {
      id: 413, created_at: '2026-11-26T17:05:00Z', date: '2026-11-24', merchant: 'Taxi G7', amount: 32.5,
      amount_chf: 30.42, fx_rate: 0.936, fx_source: 'ecb', tva: 2.95, currency: 'EUR', category: 'transport',
      note: 'Payment card: personal'
    },
    attachments: [{ filename: 'taxi-g7-receipt.pdf', size: 88000 }]
  },
  '3-sans-recu': {
    expense: {
      id: 414, created_at: '2026-11-26T18:20:00Z', date: '2026-11-26', merchant: 'SBB CFF FFS', amount: 64,
      amount_chf: 64, tva: 0, currency: 'CHF', category: 'transport', note: 'Payment card: company'
    },
    attachments: []
  },
  '4-recu-ajoute': {
    kind: 'receipt_added',
    expense: {
      id: 414, created_at: '2026-11-26T18:20:00Z', date: '2026-11-26', merchant: 'SBB CFF FFS', amount: 64,
      amount_chf: 64, tva: 0, currency: 'CHF', category: 'transport', note: 'Payment card: company'
    },
    attachments: [{ filename: 'sbb-ticket.pdf', size: 145000 }]
  }
};

for (const [name, s] of Object.entries(samples)) {
  const email = buildExpenseRecapEmail({ expense: s.expense, kind: s.kind || 'created', attachments: s.attachments, skipped: [] });
  fs.writeFileSync(path.join(out, name + '.html'), email.html);
  fs.writeFileSync(path.join(out, name + '.txt'), `Subject: ${email.subject}\n\n${email.text}\n`);
  console.log(`${name}: ${email.subject}`);
}
console.log('->', out);
