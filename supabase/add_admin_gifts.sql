-- CADEAUX DE L'ÉQUIPE — à exécuter une fois dans Supabase (SQL Editor → New query → Run).
--
-- Le panneau admin peut offrir des pièces, de l'expérience ou tout le casier
-- du Duel à un joueur. Le cadeau attend ici ; le joueur le reçoit la
-- prochaine fois qu'il ouvre le Duel, sur n'importe quel appareil.

create table if not exists public.admin_gifts (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  game text not null default 'duel',
  kind text not null check (kind in ('pieces', 'xp', 'tout')),
  amount integer not null default 0 check (amount between 0 and 1000000),
  message text default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);

create index if not exists admin_gifts_user_idx on public.admin_gifts (user_id) where claimed_at is null;

alter table public.admin_gifts enable row level security;
-- Aucune policy : seul le serveur (clé secrète) lit et écrit les cadeaux.
grant select, insert, update on public.admin_gifts to service_role;
grant usage, select on sequence public.admin_gifts_id_seq to service_role;
