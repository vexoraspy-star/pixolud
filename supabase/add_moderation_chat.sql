-- Journal de moderation du chat.
--
-- La moderation elle-meme ne coute rien et ne depend d'aucun service : ce
-- sont des regles ecrites dans src/lib/moderation.ts, appliquees cote serveur
-- avant l'enregistrement du message. Cette table garde seulement la trace de
-- ce qui a ete refuse, masque ou signale, pour que l'equipe puisse regarder
-- et sanctionner si besoin (vue « Moderation » du panneau admin).
--
-- Aucune policy : personne n'y accede avec sa session de joueur. Seule la cle
-- secrete du serveur passe au-dessus des regles RLS.

create table if not exists public.moderation_log (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users (id) on delete set null,
  endroit text not null default 'chat',
  verdict text not null,
  motif text not null default '',
  texte text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists moderation_log_date_idx on public.moderation_log (created_at desc);

alter table public.moderation_log enable row level security;
