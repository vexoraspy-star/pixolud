-- Ajouts nécessaires à l'éditeur de mini-jeux (labyrinthe) :
-- 1. une colonne pour stocker les données du niveau (grille, murs, départ, arrivée)
-- 2. une fonction sécurisée pour incrémenter le compteur de parties jouées
--    sans donner à n'importe qui le droit de modifier un jeu (RLS n'autorise
--    que l'auteur à faire un UPDATE sur ses propres jeux).

alter table public.games
  add column if not exists data jsonb not null default '{}'::jsonb;

create or replace function public.increment_plays(game_id uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.games set plays = plays + 1 where id = game_id and published = true;
$$;

grant execute on function public.increment_plays(uuid) to anon, authenticated;
