-- NotesFrais - Auth + RLS stricte
-- IMPORTANT:
-- 1. Creer d'abord les utilisateurs dans Supabase > Authentication > Users.
-- 2. Remplacer les deux emails ci-dessous.
-- 3. Lancer ce SQL seulement quand l'app affiche bien le login "Compte".

begin;

-- Profils applicatifs: le JWT Supabase donne auth.uid(), cette table dit
-- si l'utilisateur est Mike ou Finance.
create table if not exists public.app_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'finance')),
  app_channel text not null check (app_channel in ('mike', 'test', 'all')),
  created_at timestamptz not null default now()
);

alter table public.app_profiles enable row level security;

drop policy if exists "profiles_select_own" on public.app_profiles;
drop policy if exists "profiles_finance_select_all" on public.app_profiles;

create policy "profiles_select_own"
on public.app_profiles
for select
to authenticated
using (user_id = auth.uid());

create policy "profiles_finance_select_all"
on public.app_profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.app_profiles p
    where p.user_id = auth.uid()
      and p.role = 'finance'
  )
);

-- Remplacer ces emails par les comptes Auth reels.
insert into public.app_profiles (user_id, role, app_channel)
select id, 'user', 'mike'
from auth.users
where email = 'MIKE_EMAIL_A_REMPLACER'
on conflict (user_id) do update
set role = excluded.role,
    app_channel = excluded.app_channel;

insert into public.app_profiles (user_id, role, app_channel)
select id, 'finance', 'all'
from auth.users
where email = 'FINANCE_EMAIL_A_REMPLACER'
on conflict (user_id) do update
set role = excluded.role,
    app_channel = excluded.app_channel;

-- Table expenses: finance voit tout, Mike voit uniquement son canal.
alter table public.expenses enable row level security;

drop policy if exists "expenses_finance_all" on public.expenses;
drop policy if exists "expenses_user_select_channel" on public.expenses;
drop policy if exists "expenses_user_insert_channel" on public.expenses;
drop policy if exists "expenses_user_update_channel" on public.expenses;
drop policy if exists "expenses_user_delete_channel" on public.expenses;

create policy "expenses_finance_all"
on public.expenses
for all
to authenticated
using (
  exists (
    select 1 from public.app_profiles p
    where p.user_id = auth.uid()
      and p.role = 'finance'
  )
)
with check (
  exists (
    select 1 from public.app_profiles p
    where p.user_id = auth.uid()
      and p.role = 'finance'
  )
);

create policy "expenses_user_select_channel"
on public.expenses
for select
to authenticated
using (
  app_channel = (
    select p.app_channel
    from public.app_profiles p
    where p.user_id = auth.uid()
      and p.role = 'user'
  )
);

create policy "expenses_user_insert_channel"
on public.expenses
for insert
to authenticated
with check (
  app_channel = (
    select p.app_channel
    from public.app_profiles p
    where p.user_id = auth.uid()
      and p.role = 'user'
  )
);

create policy "expenses_user_update_channel"
on public.expenses
for update
to authenticated
using (
  app_channel = (
    select p.app_channel
    from public.app_profiles p
    where p.user_id = auth.uid()
      and p.role = 'user'
  )
)
with check (
  app_channel = (
    select p.app_channel
    from public.app_profiles p
    where p.user_id = auth.uid()
      and p.role = 'user'
  )
);

create policy "expenses_user_delete_channel"
on public.expenses
for delete
to authenticated
using (
  app_channel = (
    select p.app_channel
    from public.app_profiles p
    where p.user_id = auth.uid()
      and p.role = 'user'
  )
);

-- Storage receipts: finance tout, Mike uniquement son dossier/canal.
-- Les anciens recus de Mike etaient parfois a la racine du bucket: on les
-- traite comme canal 'mike' avec coalesce(folder, 'mike').
drop policy if exists "receipts_finance_all" on storage.objects;
drop policy if exists "receipts_user_select_channel" on storage.objects;
drop policy if exists "receipts_user_insert_channel" on storage.objects;
drop policy if exists "receipts_user_update_channel" on storage.objects;
drop policy if exists "receipts_user_delete_channel" on storage.objects;

create policy "receipts_finance_all"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'receipts'
  and exists (
    select 1 from public.app_profiles p
    where p.user_id = auth.uid()
      and p.role = 'finance'
  )
)
with check (
  bucket_id = 'receipts'
  and exists (
    select 1 from public.app_profiles p
    where p.user_id = auth.uid()
      and p.role = 'finance'
  )
);

create policy "receipts_user_select_channel"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'receipts'
  and coalesce((storage.foldername(name))[1], 'mike') = (
    select p.app_channel
    from public.app_profiles p
    where p.user_id = auth.uid()
      and p.role = 'user'
  )
);

create policy "receipts_user_insert_channel"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'receipts'
  and coalesce((storage.foldername(name))[1], 'mike') = (
    select p.app_channel
    from public.app_profiles p
    where p.user_id = auth.uid()
      and p.role = 'user'
  )
);

create policy "receipts_user_update_channel"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'receipts'
  and coalesce((storage.foldername(name))[1], 'mike') = (
    select p.app_channel
    from public.app_profiles p
    where p.user_id = auth.uid()
      and p.role = 'user'
  )
)
with check (
  bucket_id = 'receipts'
  and coalesce((storage.foldername(name))[1], 'mike') = (
    select p.app_channel
    from public.app_profiles p
    where p.user_id = auth.uid()
      and p.role = 'user'
  )
);

create policy "receipts_user_delete_channel"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'receipts'
  and coalesce((storage.foldername(name))[1], 'mike') = (
    select p.app_channel
    from public.app_profiles p
    where p.user_id = auth.uid()
      and p.role = 'user'
  )
);

commit;
