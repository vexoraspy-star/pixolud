-- Les favoris : les jeux qu'un joueur veut retrouver.
--
-- Une table de liens, rien de plus : une ligne par joueur et par jeu. Chacun
-- ne voit et ne modifie que ses propres favoris ; le compteur public d'un jeu
-- (combien de personnes l'ont mis en favori) se lit par une vue, qui ne
-- revele jamais QUI a mis quoi.

create table if not exists public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

create index if not exists favorites_game_idx on public.favorites (game_id);

alter table public.favorites enable row level security;

drop policy if exists "Favoris : les miens" on public.favorites;
create policy "Favoris : les miens" on public.favorites
for select using (auth.uid() = user_id);

drop policy if exists "Favoris : j'ajoute les miens" on public.favorites;
create policy "Favoris : j'ajoute les miens" on public.favorites
for insert with check (auth.uid() = user_id);

drop policy if exists "Favoris : j'enleve les miens" on public.favorites;
create policy "Favoris : j'enleve les miens" on public.favorites
for delete using (auth.uid() = user_id);

-- Le nombre de favoris par jeu, visible par tout le monde, sans dire par qui.
-- security_invoker reste desactive ici volontairement : c'est justement ce qui
-- permet de compter des lignes qu'on n'a pas le droit de lire une par une.
create or replace view public.favorite_counts as
select game_id, count(*)::int as favoris
from public.favorites
group by game_id;

grant select on public.favorite_counts to anon, authenticated;
