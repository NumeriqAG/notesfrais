create table if not exists expenses (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  date date not null,
  merchant text not null,
  amount numeric(12,2) not null,
  amount_chf numeric(12,2) not null,
  tva numeric(12,2) not null default 0,
  category text not null default 'autre',
  currency text not null default 'CHF',
  status text not null default 'pending',
  note text not null default '',
  ubs_label text not null default '',
  ubs_date date,
  amt_diff numeric(12,2) not null default 0,
  receipt_url text,
  receipt_name text,
  receipt_items jsonb not null default '[]'::jsonb,
  app_channel text not null default 'mike',
  submission_status text not null default 'pending',
  submitted_at timestamptz,
  comments jsonb not null default '[]'::jsonb,
  review_status text not null default 'ok',
  constraint expenses_status_check check (status in ('pending', 'reconciled')),
  constraint expenses_channel_check check (app_channel in ('mike', 'test')),
  constraint expenses_submission_status_check check (submission_status in ('pending', 'to_submit', 'submitted')),
  constraint expenses_review_status_check check (review_status in ('ok', 'to_fix'))
);

create index if not exists expenses_channel_date_idx
  on expenses (app_channel, date desc);

create index if not exists expenses_submission_status_idx
  on expenses (app_channel, submission_status, date desc);

create table if not exists app_profiles (
  id text primary key,
  email text not null unique,
  role text not null,
  app_channel text not null,
  created_at timestamptz not null default now(),
  constraint app_profiles_role_check check (role in ('user', 'finance')),
  constraint app_profiles_channel_check check (app_channel in ('mike', 'test', 'all'))
);

-- Decision de la finance sur un mois soumis (cree aussi a la demande par
-- api/_lib/month-review.js). Absence de ligne = soumis, en attente de controle.
create table if not exists month_reviews (
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
-- Abonnements Web Push de la PWA (iOS 16.4+, ecran d'accueil).
create table if not exists push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  app_channel text not null,
  email text not null default '',
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);
