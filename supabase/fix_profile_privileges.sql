-- CORRECTIF DE SÉCURITÉ — à exécuter dans Supabase (SQL Editor → New query).
--
-- Le problème
-- -----------
-- `grant update on public.profiles to authenticated` donnait le droit
-- d'écrire TOUTES les colonnes de sa propre ligne. La politique RLS
-- (`auth.uid() = id`) vérifie seulement QUELLE ligne on modifie, jamais
-- QUELLES colonnes. N'importe quel joueur connecté pouvait donc exécuter,
-- depuis la console de son navigateur :
--
--   supabase.from('profiles').update({ tier: 'max', is_admin: true })
--                            .eq('id', <son id>)
--
-- et s'offrir l'abonnement Max plus les droits admin. La vérification
-- `is_admin` faite dans /premium ne protégeait rien, puisqu'on pouvait
-- écrire la colonne directement sans passer par cette page.
--
-- Le correctif
-- ------------
-- On retire le droit d'écriture global et on ne le redonne que sur les
-- colonnes qu'un joueur a le droit de modifier. Le changement de palier
-- passe ensuite par une fonction `security definer`, qui décide elle-même,
-- côté serveur, hors d'atteinte du client.

-- 1. Seules ces colonnes restent modifiables par le joueur.
revoke update on public.profiles from authenticated;
grant update (pseudo, bio, avatar_url) on public.profiles to authenticated;

-- 2. Le changement de palier devient une opération contrôlée.
create or replace function public.set_my_tier(new_tier text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_admin boolean;
begin
  if new_tier not in ('free', 'standard', 'max') then
    raise exception 'Palier invalide';
  end if;

  -- Revenir au palier gratuit est toujours autorisé. Prendre un palier
  -- payant reste réservé aux comptes admin tant que le paiement réel
  -- n'est pas branché.
  if new_tier <> 'free' then
    select is_admin into caller_is_admin
      from public.profiles
      where id = auth.uid();

    if not coalesce(caller_is_admin, false) then
      raise exception 'Le paiement réel n''est pas encore disponible.';
    end if;
  end if;

  update public.profiles
    set tier = new_tier
    where id = auth.uid();
end;
$$;

grant execute on function public.set_my_tier(text) to authenticated;

-- 3. Même problème, plus discret, sur les jeux : un auteur pouvait écrire
--    n'importe quelle colonne de SON jeu, y compris `plays`, et se placer
--    en tête des jeux populaires. On limite aux colonnes d'édition.
revoke update on public.games from authenticated;
grant update (
  slug, title, description, category, gradient, emoji,
  cover_url, multiplayer_mode, data, published
) on public.games to authenticated;
