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
  constraint expenses_status_check check (status in ('pending', 'reconciled')),
  constraint expenses_channel_check check (app_channel in ('mike', 'test')),
  constraint expenses_submission_status_check check (submission_status in ('pending', 'to_submit', 'submitted'))
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
