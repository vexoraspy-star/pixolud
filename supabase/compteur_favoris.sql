-- Le compteur de favoris devient une colonne, au lieu d'une vue.
--
-- Avant : une vue `favorite_counts` en SECURITY DEFINER comptait les lignes
-- de `favorites`, que personne n'a le droit de lire chez les autres. Ca
-- marchait, mais l'Advisor de Supabase la signalait en CRITIQUE : une vue
-- definer peut, en general, laisser fuir ce qu'elle lit.
--
-- Maintenant : chaque jeu porte son propre compteur, tenu a jour par deux
-- declencheurs. Personne ne lit la table des favoris pour l'afficher — donc
-- plus rien a faire fuir, et la lecture est aussi plus rapide (un nombre deja
-- calcule, au lieu d'un comptage a chaque affichage).
--
-- La fonction est en SECURITY DEFINER, et c'est necessaire : un joueur n'a
-- pas le droit de modifier le jeu de quelqu'un d'autre, alors qu'ajouter un
-- favori doit bien incrementer le compteur de ce jeu. Elle ne fait que ca,
-- sur une seule colonne, avec un search_path fixe.

alter table public.games add column if not exists favoris integer not null default 0;

create or replace function public.maj_compteur_favoris()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.games set favoris = favoris + 1 where id = new.game_id;
  elsif (tg_op = 'DELETE') then
    update public.games set favoris = greatest(0, favoris - 1) where id = old.game_id;
  end if;
  return null;
end;
$$;

drop trigger if exists favoris_ajoute on public.favorites;
create trigger favoris_ajoute
after insert on public.favorites
for each row execute function public.maj_compteur_favoris();

drop trigger if exists favoris_retire on public.favorites;
create trigger favoris_retire
after delete on public.favorites
for each row execute function public.maj_compteur_favoris();

-- Remise a niveau : on recompte une fois ce qui existe deja.
update public.games g
set favoris = coalesce(f.n, 0)
from (select game_id, count(*)::int as n from public.favorites group by game_id) f
where f.game_id = g.id;

update public.games
set favoris = 0
where favoris <> 0
  and id not in (select game_id from public.favorites);

-- La vue n'a plus de raison d'etre.
drop view if exists public.favorite_counts;
