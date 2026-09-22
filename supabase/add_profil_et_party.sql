-- Photo de profil, cadre d'avatar, et le mode « party » entre amis.
--
-- Trois blocs :
-- 1. deux colonnes sur les profils (photo + cadre choisi) et un espace de
--    stockage pour les photos, ou chacun n'ecrit que dans son dossier ;
-- 2. les groupes (parties) : un chef, des membres, et des messages ;
-- 3. les regles d'acces : on ne lit une party que si on en est membre, et
--    seul le chef peut renommer, inviter ou exclure.

-- ------------------------------------------------------------ 1. profils

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists frame text not null default 'aucun';

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Les avatars sont publics" on storage.objects;
create policy "Les avatars sont publics"
on storage.objects for select
using (bucket_id = 'avatars');

-- Le premier dossier du chemin doit etre l'identifiant de la personne :
-- personne ne peut donc ecrire par-dessus la photo de quelqu'un d'autre.
drop policy if exists "Avatar : chacun dans son dossier" on storage.objects;
create policy "Avatar : chacun dans son dossier"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Avatar : remplacer le sien" on storage.objects;
create policy "Avatar : remplacer le sien"
on storage.objects for update
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Avatar : supprimer le sien" on storage.objects;
create policy "Avatar : supprimer le sien"
on storage.objects for delete
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- -------------------------------------------------------------- 2. party

create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  nom text not null default 'Ma party',
  leader_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.party_members (
  party_id uuid not null references public.parties (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (party_id, user_id)
);

create table if not exists public.party_messages (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists party_messages_idx on public.party_messages (party_id, created_at desc);
create index if not exists party_members_user_idx on public.party_members (user_id);

-- --------------------------------------------------------------- 3. acces

-- Fonction a part, en security definer : sans elle, la regle de lecture de
-- party_members devrait interroger party_members, et Postgres tournerait en
-- rond (recursion infinie dans la policy).
create or replace function public.est_membre_party(p uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.party_members m
    where m.party_id = p and m.user_id = auth.uid()
  );
$$;

grant execute on function public.est_membre_party(uuid) to authenticated;

alter table public.parties enable row level security;
alter table public.party_members enable row level security;
alter table public.party_messages enable row level security;

drop policy if exists "Party : visible par ses membres" on public.parties;
create policy "Party : visible par ses membres" on public.parties
for select using (public.est_membre_party(id) or leader_id = auth.uid());

drop policy if exists "Party : creee par son chef" on public.parties;
create policy "Party : creee par son chef" on public.parties
for insert with check (leader_id = auth.uid());

drop policy if exists "Party : le chef la modifie" on public.parties;
create policy "Party : le chef la modifie" on public.parties
for update using (leader_id = auth.uid());

drop policy if exists "Party : le chef la dissout" on public.parties;
create policy "Party : le chef la dissout" on public.parties
for delete using (leader_id = auth.uid());

drop policy if exists "Membres : visibles entre membres" on public.party_members;
create policy "Membres : visibles entre membres" on public.party_members
for select using (public.est_membre_party(party_id) or user_id = auth.uid());

-- On entre dans une party soit parce qu'on la cree (on est le chef), soit
-- parce que le chef nous ajoute.
drop policy if exists "Membres : ajout par le chef ou soi-meme" on public.party_members;
create policy "Membres : ajout par le chef ou soi-meme" on public.party_members
for insert with check (
  user_id = auth.uid()
  or exists (select 1 from public.parties p where p.id = party_id and p.leader_id = auth.uid())
);

-- On part quand on veut ; le chef peut exclure quelqu'un.
drop policy if exists "Membres : partir ou etre exclu" on public.party_members;
create policy "Membres : partir ou etre exclu" on public.party_members
for delete using (
  user_id = auth.uid()
  or exists (select 1 from public.parties p where p.id = party_id and p.leader_id = auth.uid())
);

drop policy if exists "Messages : lus par les membres" on public.party_messages;
create policy "Messages : lus par les membres" on public.party_messages
for select using (public.est_membre_party(party_id));

drop policy if exists "Messages : ecrits par les membres" on public.party_messages;
create policy "Messages : ecrits par les membres" on public.party_messages
for insert with check (sender_id = auth.uid() and public.est_membre_party(party_id));
