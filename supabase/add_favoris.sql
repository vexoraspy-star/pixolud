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

-- Le compteur public (combien de personnes ont mis ce jeu de cote, jamais
-- qui) vit dans une colonne de `games`, tenue a jour par un declencheur :
-- voir supabase/compteur_favoris.sql. Une vue en SECURITY DEFINER faisait le
-- meme travail au depart, mais elle lisait les favoris de tout le monde pour
-- y arriver — un compteur deja calcule ne lit rien du tout.
