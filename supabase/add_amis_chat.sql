-- AMIS ET MESSAGES — à exécuter une fois dans Supabase (SQL Editor → New query → Run).
--
-- Deux tables : les amitiés (demande, puis acceptation) et les messages
-- échangés entre deux amis. Les règles ci-dessous font le gros du travail :
-- personne ne peut lire une conversation dont il ne fait pas partie, même en
-- passant par la console du navigateur.
--
-- Ce fichier a besoin de la fonction public.is_banned, créée par
-- supabase/add_admin_panel.sql : lance celui-là d'abord.

-- 1. Amitiés ------------------------------------------------------------
-- Une seule ligne par paire : on range toujours le plus petit identifiant
-- dans a_id, ce qui empêche les doublons « A→B » et « B→A ».
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  a_id uuid not null references public.profiles (id) on delete cascade,
  b_id uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'en_attente' check (status in ('en_attente', 'acceptee')),
  created_at timestamptz not null default now(),
  constraint friendships_ordre check (a_id < b_id),
  constraint friendships_paire unique (a_id, b_id)
);

alter table public.friendships enable row level security;

drop policy if exists "Voir ses amities" on public.friendships;
create policy "Voir ses amities"
  on public.friendships for select
  using (auth.uid() = a_id or auth.uid() = b_id);

drop policy if exists "Demander en ami" on public.friendships;
create policy "Demander en ami"
  on public.friendships for insert
  with check (
    (auth.uid() = a_id or auth.uid() = b_id)
    and auth.uid() = requested_by
    and status = 'en_attente'
    and not public.is_banned(auth.uid())
  );

-- Répondre à une demande : seulement celui qui l'a reçue.
drop policy if exists "Repondre a une demande" on public.friendships;
create policy "Repondre a une demande"
  on public.friendships for update
  using ((auth.uid() = a_id or auth.uid() = b_id) and auth.uid() <> requested_by)
  with check (status = 'acceptee');

drop policy if exists "Retirer un ami" on public.friendships;
create policy "Retirer un ami"
  on public.friendships for delete
  using (auth.uid() = a_id or auth.uid() = b_id);

grant select, insert, update, delete on public.friendships to authenticated;

-- 2. Messages -----------------------------------------------------------
create table if not exists public.messages (
  id bigserial primary key,
  friendship_id uuid not null references public.friendships (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx on public.messages (friendship_id, created_at);

alter table public.messages enable row level security;

drop policy if exists "Lire ses conversations" on public.messages;
create policy "Lire ses conversations"
  on public.messages for select
  using (
    exists (
      select 1 from public.friendships f
      where f.id = friendship_id
        and f.status = 'acceptee'
        and (auth.uid() = f.a_id or auth.uid() = f.b_id)
    )
  );

drop policy if exists "Ecrire a un ami" on public.messages;
create policy "Ecrire a un ami"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and not public.is_banned(auth.uid())
    and exists (
      select 1 from public.friendships f
      where f.id = friendship_id
        and f.status = 'acceptee'
        and (auth.uid() = f.a_id or auth.uid() = f.b_id)
    )
  );

drop policy if exists "Supprimer son message" on public.messages;
create policy "Supprimer son message"
  on public.messages for delete
  using (auth.uid() = sender_id);

grant select, insert, delete on public.messages to authenticated;
grant usage, select on sequence public.messages_id_seq to authenticated;
