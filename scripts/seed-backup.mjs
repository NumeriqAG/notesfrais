import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';

const here = dirname(fileURLToPath(import.meta.url));
const backupPath = resolve(here, '../../notesfrais-backup-before-mike-reset-2026-04-28T10-11-06-666Z.json');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL missing');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const backup = JSON.parse(await readFile(backupPath, 'utf8'));
const expenses = Array.isArray(backup.expenses) ? backup.expenses : [];

for (const item of expenses) {
  await sql`insert into expenses (
    date, merchant, amount, amount_chf, tva, category, currency, status, note,
    ubs_label, ubs_date, amt_diff, receipt_url, receipt_name, app_channel,
    submission_status, submitted_at
  ) values (
    ${item.date}, ${item.merchant}, ${item.amount}, ${item.amount_chf}, ${item.tva || 0},
    ${item.category || 'autre'}, ${item.currency || 'CHF'}, ${item.status || 'pending'},
    ${item.note || ''}, ${item.ubs_label || ''}, ${item.ubs_date || null},
    ${item.amt_diff || 0}, ${item.receipt_url || null}, ${item.receipt_name || null},
    ${item.app_channel || 'mike'}, ${item.submission_status || 'pending'}, ${item.submitted_at || null}
  )`;
}

console.log(`Seeded ${expenses.length} expenses from backup.`);
