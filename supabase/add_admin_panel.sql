-- PANNEAU ADMIN — à exécuter une fois dans Supabase (SQL Editor → New query → Run).
--
-- Ajoute ce dont le panneau /admin a besoin :
--   1. le bannissement (motif, date de fin) et le badge « vérifié » sur les profils ;
--   2. un journal des actions admin ;
--   3. des règles qui empêchent un compte banni de publier, commenter, noter
--      ou modifier son profil, même en passant par la console du navigateur.
--
-- Le panneau fonctionne déjà sans ce fichier (le bannissement bloque aussi la
-- connexion côté Supabase Auth), mais le badge, le motif et le journal en ont
-- besoin.

-- 1. Colonnes du profil ------------------------------------------------------
alter table public.profiles
  add column if not exists banned boolean not null default false,
  add column if not exists ban_reason text,
  add column if not exists banned_until timestamptz,
  add column if not exists verified boolean not null default false;

-- Ces colonnes ne sont PAS modifiables par les joueurs : la permission
-- d'écriture reste limitée à (pseudo, bio, avatar_url) — voir
-- fix_profile_privileges.sql. Seul le serveur (clé secrète) les écrit.

-- 2. Journal des actions admin ----------------------------------------------
create table if not exists public.admin_log (
  id bigserial primary key,
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target text,
  details text default '',
  created_at timestamptz not null default now()
);

alter table public.admin_log enable row level security;
-- Aucune policy : personne ne le lit ni ne l'écrit depuis le navigateur.
-- Seul le serveur (clé secrète, rôle service_role) y accède.
grant select, insert on public.admin_log to service_role;
grant usage, select on sequence public.admin_log_id_seq to service_role;

-- 3. Un compte banni ne peut plus rien écrire -------------------------------
create or replace function public.is_banned(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select banned and (banned_until is null or banned_until > now())
       from public.profiles where id = uid),
    false
  );
$$;

grant execute on function public.is_banned(uuid) to anon, authenticated;

drop policy if exists "Un utilisateur connecté peut créer un jeu" on public.games;
create policy "Un utilisateur connecté peut créer un jeu"
  on public.games for insert
  with check (auth.uid() = author_id and not public.is_banned(auth.uid()));

drop policy if exists "Un auteur peut modifier ou supprimer son propre jeu" on public.games;
create policy "Un auteur peut modifier ou supprimer son propre jeu"
  on public.games for update
  using (auth.uid() = author_id and not public.is_banned(auth.uid()));

drop policy if exists "Un utilisateur connecté peut commenter" on public.comments;
create policy "Un utilisateur connecté peut commenter"
  on public.comments for insert
  with check (auth.uid() = author_id and not public.is_banned(auth.uid()));

drop policy if exists "Un utilisateur connecté peut noter un jeu" on public.ratings;
create policy "Un utilisateur connecté peut noter un jeu"
  on public.ratings for insert
  with check (auth.uid() = user_id and not public.is_banned(auth.uid()));

drop policy if exists "Un utilisateur peut modifier sa propre note" on public.ratings;
create policy "Un utilisateur peut modifier sa propre note"
  on public.ratings for update
  using (auth.uid() = user_id and not public.is_banned(auth.uid()));

drop policy if exists "Un utilisateur modifie uniquement son propre profil" on public.profiles;
create policy "Un utilisateur modifie uniquement son propre profil"
  on public.profiles for update
  using (auth.uid() = id and not public.is_banned(auth.uid()));
