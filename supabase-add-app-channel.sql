-- NotesFrais - separation serveur test / Mike
-- A lancer dans Supabase SQL Editor sur le projet NotesFrais.

begin;

alter table public.expenses
  add column if not exists app_channel text not null default 'mike';

alter table public.expenses
  drop constraint if exists expenses_app_channel_check;

alter table public.expenses
  add constraint expenses_app_channel_check
  check (app_channel in ('test', 'mike'));

-- Backfill compatible avec l'historique actuel:
-- les frais de test ont l'ancienne balise [NF:test] dans la note.
-- les frais Mike existants restent en valeur par defaut 'mike'.
update public.expenses
set app_channel = 'test'
where coalesce(note, '') like '%[NF:test]%';

update public.expenses
set app_channel = 'mike'
where app_channel is null
   or app_channel not in ('test', 'mike');

create index if not exists expenses_app_channel_date_idx
  on public.expenses (app_channel, date desc);

commit;
