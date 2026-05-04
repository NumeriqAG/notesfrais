begin;

alter table public.expenses
  add column if not exists submission_status text not null default 'pending';

alter table public.expenses
  add column if not exists submitted_at timestamptz null;

alter table public.expenses
  drop constraint if exists expenses_submission_status_check;

alter table public.expenses
  add constraint expenses_submission_status_check
  check (submission_status in ('pending', 'to_submit', 'submitted'));

update public.expenses
set submission_status = 'to_submit'
where submission_status = 'pending'
  and date < date_trunc('month', current_date)::date;

update public.expenses
set submission_status = 'pending'
where submission_status = 'to_submit'
  and date >= date_trunc('month', current_date)::date;

create index if not exists expenses_submission_status_idx
  on public.expenses (app_channel, submission_status, date desc);

commit;
