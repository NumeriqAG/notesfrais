const { sql } = require('./db');

// Decision de la finance sur un mois soumis. Une ligne par (canal, mois).
// Absence de ligne = « soumis, en attente de controle » si les frais du mois
// sont soumis, « en cours » sinon.
//   approved   : la finance a valide le mois.
//   sent_back  : la finance a renvoye le mois a l'utilisateur ; les frais sont
//                repasses en 'pending', le mois est donc rouvert.
//   reimbursed : le mois approuve a ete rembourse.
const MONTH_REVIEW_STATUSES = ['approved', 'sent_back', 'reimbursed'];

let tableReady;

async function ensureMonthReviewTable() {
  if (!tableReady) {
    tableReady = sql()`create table if not exists month_reviews (
      app_channel text not null,
      month text not null,
      status text not null,
      note text not null default '',
      decided_at timestamptz not null default now(),
      decided_by text not null default '',
      primary key (app_channel, month),
      constraint month_reviews_status_check check (status in ('approved', 'sent_back', 'reimbursed')),
      constraint month_reviews_channel_check check (app_channel in ('mike', 'test')),
      constraint month_reviews_month_check check (month ~ '^[0-9]{4}-[0-9]{2}$')
    )`;
    tableReady.catch(() => { tableReady = null; });
  }
  await tableReady;
}

// Appele a la (re)soumission d'un mois par l'utilisateur : un mois renvoye
// puis soumis a nouveau redevient « en attente de controle ».
async function clearSentBack(appChannel, month) {
  await ensureMonthReviewTable();
  await sql()`delete from month_reviews
    where app_channel = ${appChannel} and month = ${month} and status = 'sent_back'`;
}

module.exports = { MONTH_REVIEW_STATUSES, ensureMonthReviewTable, clearSentBack };
