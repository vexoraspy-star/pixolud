-- CORRECTIFS DE SÉCURITÉ (octobre 2026) — à exécuter dans Supabase :
-- Project → SQL Editor → New query → colle tout → Run.
--
-- Trouvés lors d'une revue du code. Rien ici ne change l'équilibre des
-- paliers ni le fonctionnement normal du site : ce sont des verrous.

-- ---------------------------------------------------------------------------
-- 1. Amitiés : empêcher de « forcer » une amitié acceptée.
--
-- En acceptant une demande, un joueur ne modifie QUE le statut. L'ancienne
-- règle ne revérifiait pas qu'il restait membre de la paire et n'empêchait
-- pas de réécrire a_id / b_id / requested_by : on pouvait fabriquer une
-- amitié « acceptée » avec quelqu'un qui n'a rien demandé, et lui envoyer des
-- messages (spam / harcèlement). On verrouille les participants et on exige
-- que celui qui accepte reste dans la paire.
-- ---------------------------------------------------------------------------

create or replace function public.friendships_participants_figes()
returns trigger
language plpgsql
as $$
begin
  if new.a_id <> old.a_id
     or new.b_id <> old.b_id
     or new.requested_by <> old.requested_by then
    raise exception 'Les participants d''une amitié ne peuvent pas changer.';
  end if;
  return new;
end;
$$;

drop trigger if exists friendships_participants_figes on public.friendships;
create trigger friendships_participants_figes
  before update on public.friendships
  for each row execute function public.friendships_participants_figes();

drop policy if exists "Repondre a une demande" on public.friendships;
create policy "Repondre a une demande"
  on public.friendships for update
  using ((auth.uid() = a_id or auth.uid() = b_id) and auth.uid() <> requested_by)
  with check (status = 'acceptee' and (auth.uid() = a_id or auth.uid() = b_id));


-- ---------------------------------------------------------------------------
-- 2. VÉRIFICATION (ne modifie rien) — le correctif anti-auto-admin est-il en
--    place ? C'est le plus important : il empêche un joueur de se donner
--    « is_admin » ou le palier « max » depuis la console de son navigateur.
--
-- Sélectionne le bloc ci-dessous et lance-le SEUL. Résultat attendu :
-- UNIQUEMENT les lignes pseudo / bio / avatar_url. Si tu vois « is_admin »,
-- « tier », « verified » ou « banned » dans la liste, le trou est ouvert :
-- lance alors le fichier supabase/fix_profile_privileges.sql.
-- ---------------------------------------------------------------------------

-- select column_name
--   from information_schema.column_privileges
--  where table_schema = 'public'
--    and table_name = 'profiles'
--    and grantee = 'authenticated'
--    and privilege_type = 'UPDATE'
--  order by column_name;


-- ---------------------------------------------------------------------------
-- 3. Jeux : empêcher de dépasser le quota de publication de son palier.
--
-- La limite (3 jeux pour le palier gratuit, 15 pour Standard, illimité au-
-- dessus) n'était vérifiée que dans le bouton « Publier ». Or la colonne
-- `published` était modifiable directement (console du navigateur, aussi bien
-- en UPDATE qu'en INSERT) : on pouvait donc publier plus de jeux que son
-- palier ne l'autorise. On verrouille la colonne et on fait passer la
-- publication par une fonction qui recompte, côté base, hors d'atteinte du
-- navigateur.
--
-- (Le code du site appelle déjà cette fonction, avec un repli sur l'ancien
-- comportement tant qu'elle n'existe pas — donc rien ne casse si tu lances ce
-- fichier plus tard.)
--
-- Dépend de la fonction public.is_banned (fichier add_admin_panel.sql) :
-- lance celui-là d'abord si ce n'est pas déjà fait.
--
-- Pourquoi un déclencheur et pas « revoke update (published) » : Supabase
-- donne aux joueurs des droits sur TOUTE la table, et dans ce cas retirer le
-- droit d'une seule colonne ne change rien. Le déclencheur, lui, refuse tout
-- changement de `published` venant directement d'un joueur. La fonction
-- ci-dessous (security definer) et les actions admin (clé serveur) ne
-- tournent pas sous le rôle des joueurs : elles passent.
-- ---------------------------------------------------------------------------

create or replace function public.games_published_verrou()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.published := false;
    elsif new.published is distinct from old.published then
      raise exception 'Pour publier un jeu, utilise le bouton Publier.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists games_published_verrou on public.games;
create trigger games_published_verrou
  before insert or update on public.games
  for each row execute function public.games_published_verrou();

create or replace function public.set_game_published(p_game_id uuid, p_public boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_author uuid;
  v_tier   text;
  v_limit  int;
  v_count  int;
begin
  if v_uid is null then
    raise exception 'Connecte-toi d''abord.';
  end if;

  select author_id into v_author from public.games where id = p_game_id;
  if v_author is null or v_author <> v_uid then
    raise exception 'Ce jeu n''est pas le tien.';
  end if;

  if p_public then
    if public.is_banned(v_uid) then
      raise exception 'Compte suspendu.';
    end if;

    select tier into v_tier from public.profiles where id = v_uid;
    v_limit := case v_tier
                 when 'standard' then 15
                 when 'max'      then 1000000
                 when 'studio'   then 1000000
                 else 3            -- gratuit, ou palier inconnu : le plus prudent
               end;

    select count(*) into v_count
      from public.games
     where author_id = v_uid and published = true and id <> p_game_id;

    if v_count >= v_limit then
      raise exception 'Limite de jeux publiés atteinte pour ton palier.';
    end if;
  end if;

  update public.games set published = p_public where id = p_game_id;
end;
$$;

grant execute on function public.set_game_published(uuid, boolean) to authenticated;
