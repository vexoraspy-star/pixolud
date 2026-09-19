-- MESSAGES DE L'ÉQUIPE — à exécuter une fois dans Supabase (SQL Editor → New query → Run).
--
-- Avertissements, messages et screamers envoyés depuis le panneau admin. Ils
-- attendent ici ; le joueur (avec compte, ou invité repéré par son numéro)
-- les voit dans la minute. Les avertissements s'affichent aussi sur le profil.

create table if not exists public.admin_notices (
  id bigserial primary key,
  user_id uuid references public.profiles (id) on delete cascade,
  guest_num text check (guest_num ~ '^[0-9]{6}$'),
  kind text not null check (kind in ('avertissement', 'message', 'screamer')),
  message text default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  check (user_id is not null or guest_num is not null)
);

create index if not exists admin_notices_user_idx on public.admin_notices (user_id) where seen_at is null;
create index if not exists admin_notices_guest_idx on public.admin_notices (guest_num) where seen_at is null;

alter table public.admin_notices enable row level security;
-- Aucune policy : seul le serveur (clé secrète) lit et écrit.
grant select, insert, update on public.admin_notices to service_role;
grant usage, select on sequence public.admin_notices_id_seq to service_role;
