-- =====================================================================
-- NotesFrais — audit de securite de la base
--
-- A COLLER TEL QUEL dans Supabase > SQL Editor, puis Run.
-- Lecture seule : cette requete ne modifie rien.
--
-- Elle repond a la seule question qui compte : la cle anon de l'app est
-- publique (elle est en clair dans app.html, c'est normal), donc TOUTE la
-- securite repose sur les RLS. Si une ligne ci-dessous dit DANGER, n'importe
-- qui connaissant l'URL peut lire ou ecrire les frais.
-- =====================================================================

-- ---------- 1. VERDICT ------------------------------------------------
with cible(nom, reg) as (
  values ('expenses',     to_regclass('public.expenses')),
         ('app_profiles', to_regclass('public.app_profiles'))
),
rls as (
  select c.nom,
         cl.relrowsecurity as active,
         (select count(*) from pg_policies p
           where p.schemaname = 'public' and p.tablename = c.nom) as nb_policies
  from cible c left join pg_class cl on cl.oid = c.reg
)
select 1 as ordre,
       'RLS sur public.' || nom as controle,
       case
         when active is null then 'TABLE ABSENTE'
         when active is false then 'DANGER — RLS DESACTIVE, table lisible par tous'
         when nb_policies = 0 then 'DANGER — RLS actif mais AUCUNE policy'
         else 'OK — RLS actif, ' || nb_policies || ' policies'
       end as verdict
from rls

union all

-- Le bucket des justificatifs doit etre prive : l'app cree des URLs signees
-- de 300 s (notesfrais-storage-secure.js). Public = tous les recus exposes.
select 2,
       'Bucket storage receipts',
       case
         when not exists (select 1 from storage.buckets where id = 'receipts')
           then 'BUCKET ABSENT'
         when (select public from storage.buckets where id = 'receipts')
           then 'DANGER — BUCKET PUBLIC, tous les justificatifs sont accessibles sans authentification'
         else 'OK — bucket prive'
       end

union all

select 3,
       'Policies sur storage.objects',
       case count(*)
         when 0 then 'DANGER — aucune policy storage'
         else 'OK — ' || count(*) || ' policies'
       end
from pg_policies where schemaname = 'storage' and tablename = 'objects'

union all

-- Les policies du depot sont toutes "to authenticated". Un droit accorde au
-- role anon signifie qu'un visiteur non connecte peut agir sur la table.
select 4,
       'Droits accordes au role anon sur ' || table_name,
       'A VERIFIER — anon a le droit ' || string_agg(privilege_type, ', ')
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public'
  and table_name in ('expenses', 'app_profiles')
group by table_name

order by ordre, controle;


-- ---------- 2. DETAIL DES POLICIES ------------------------------------
-- A comparer avec supabase-auth-rls.sql. Les noms attendus sont :
--   expenses_finance_all, expenses_user_select_channel,
--   expenses_user_insert_channel, expenses_user_update_channel,
--   expenses_user_delete_channel,
--   profiles_select_own, profiles_finance_select_all,
--   receipts_finance_all, receipts_user_{select,insert,update,delete}_channel
select schemaname   as schema,
       tablename    as "table",
       policyname   as policy,
       cmd          as commande,
       roles        as roles,
       permissive   as permissive
from pg_policies
where (schemaname = 'public'  and tablename in ('expenses', 'app_profiles'))
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, cmd, policyname;


-- ---------- 3. QUI A UN PROFIL ----------------------------------------
-- Sans ligne dans app_profiles, un compte se connecte mais reste bloque sur
-- « Profil introuvable ou non autorise ». Utile pour retrouver les acces.
select u.email,
       p.role,
       p.app_channel,
       u.last_sign_in_at
from auth.users u
left join public.app_profiles p on p.user_id = u.id
order by u.created_at;
