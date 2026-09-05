-- Site.Jeux — schéma initial (comptes, jeux, commentaires, notes, signalements)
-- À coller dans Supabase : Project → SQL Editor → New query → Run

-- 1. Profils utilisateurs -----------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  pseudo text unique not null,
  bio text default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Les profils sont visibles par tous"
  on public.profiles for select
  using (true);

create policy "Un utilisateur modifie uniquement son propre profil"
  on public.profiles for update
  using (auth.uid() = id);

-- Crée automatiquement un profil quand un compte est créé, à partir du
-- pseudo fourni lors de l'inscription (voir metadata "pseudo").
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, pseudo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'pseudo', 'joueur_' || substr(new.id::text, 1, 8))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Jeux -----------------------------------------------------------------
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text not null default '',
  category text not null,
  author_id uuid not null references public.profiles (id) on delete cascade,
  gradient text not null default 'from-violet-500 to-fuchsia-500',
  emoji text not null default '🎮',
  published boolean not null default false,
  plays integer not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.games enable row level security;

create policy "Les jeux publiés sont visibles par tous, les brouillons par leur auteur"
  on public.games for select
  using (published = true or auth.uid() = author_id);

create policy "Un utilisateur connecté peut créer un jeu"
  on public.games for insert
  with check (auth.uid() = author_id);

create policy "Un auteur peut modifier ou supprimer son propre jeu"
  on public.games for update
  using (auth.uid() = author_id);

create policy "Un auteur peut supprimer son propre jeu"
  on public.games for delete
  using (auth.uid() = author_id);

-- 3. Commentaires -----------------------------------------------------------
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

alter table public.comments enable row level security;

create policy "Les commentaires sont visibles par tous"
  on public.comments for select
  using (true);

create policy "Un utilisateur connecté peut commenter"
  on public.comments for insert
  with check (auth.uid() = author_id);

create policy "Un utilisateur peut supprimer son propre commentaire"
  on public.comments for delete
  using (auth.uid() = author_id);

-- 4. Notes (étoiles) ---------------------------------------------------------
create table if not exists public.ratings (
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (game_id, user_id)
);

alter table public.ratings enable row level security;

create policy "Les notes sont visibles par tous"
  on public.ratings for select
  using (true);

create policy "Un utilisateur connecté peut noter un jeu"
  on public.ratings for insert
  with check (auth.uid() = user_id);

create policy "Un utilisateur peut modifier sa propre note"
  on public.ratings for update
  using (auth.uid() = user_id);

-- 5. Signalements -------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  game_id uuid references public.games (id) on delete cascade,
  reason text not null,
  details text default '',
  status text not null default 'ouvert',
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

create policy "Tout le monde peut envoyer un signalement"
  on public.reports for insert
  with check (true);

-- Seuls les administrateurs (via le dashboard Supabase, clé service_role)
-- peuvent lire les signalements pour l'instant : aucune policy "select"
-- n'est créée pour les utilisateurs normaux.

-- 6. Permissions de base ------------------------------------------------------
-- Indispensable : sans ces GRANT, les rôles anon/authenticated n'ont même
-- pas le droit d'interroger les tables, quelles que soient les policies RLS
-- ci-dessus (RLS restreint l'accès, il ne l'accorde pas).
grant usage on schema public to anon, authenticated;

grant select on public.profiles to anon, authenticated;
grant update on public.profiles to authenticated;

grant select on public.games to anon, authenticated;
grant insert, update, delete on public.games to authenticated;

grant select on public.comments to anon, authenticated;
grant insert, delete on public.comments to authenticated;

grant select on public.ratings to anon, authenticated;
grant insert, update on public.ratings to authenticated;

grant insert on public.reports to anon, authenticated;

-- La clé secrète (service_role) bypass RLS mais a quand même besoin des
-- GRANT de base, comme les autres rôles sur ce projet créé via SQL Editor.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;

-- 7. Compteur de parties jouées ------------------------------------------
-- RLS n'autorise que l'auteur à modifier son propre jeu (UPDATE), donc un
-- joueur quelconque ne peut pas incrémenter "plays" directement. Cette
-- fonction sécurisée fait exactement ça et rien d'autre.
create or replace function public.increment_plays(game_id uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.games set plays = plays + 1 where id = game_id and published = true;
$$;

grant execute on function public.increment_plays(uuid) to anon, authenticated;
