-- CORRECTIF — « Ce pseudo est déjà pris » alors qu'on vient de le choisir.
-- À exécuter dans Supabase (SQL Editor → New query).
--
-- Le problème
-- -----------
-- Le trigger `on_auth_user_created` crée la ligne `profiles` dès l'appel à
-- signUp(), donc AVANT la confirmation de l'e-mail. Conséquences :
--   * une inscription jamais confirmée réserve le pseudo pour toujours ;
--   * la personne qui recommence est bloquée par son propre pseudo, car
--     l'inscription ne peut pas savoir que cette ligne lui appartient.
--
-- Le correctif
-- ------------
-- Une fonction qui répond à la seule question utile : « ce pseudo est-il
-- libre, pris par quelqu'un d'autre, ou bloqué par TA propre inscription
-- pas encore confirmée ? ». Elle doit lire `auth.users`, d'où le
-- `security definer`. Elle ne renvoie jamais d'adresse e-mail ni d'identifiant.

create or replace function public.signup_pseudo_status(p_pseudo text, p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  owner_email text;
  owner_confirmed timestamptz;
begin
  select id into owner_id
    from public.profiles
    where lower(pseudo) = lower(trim(p_pseudo));

  if owner_id is null then
    return 'free';
  end if;

  select email, email_confirmed_at
    into owner_email, owner_confirmed
    from auth.users
    where id = owner_id;

  -- Même pseudo, même adresse, inscription jamais confirmée : c'est la
  -- même personne qui recommence. On la laisse passer, signUp() lui
  -- renverra simplement un nouveau lien de confirmation.
  if owner_confirmed is null
     and lower(coalesce(owner_email, '')) = lower(trim(p_email)) then
    return 'retry';
  end if;

  return 'taken';
end;
$$;

grant execute on function public.signup_pseudo_status(text, text) to anon, authenticated;


-- -------------------------------------------------------------------------
-- MÉNAGE : libérer les pseudos des inscriptions abandonnées.
--
-- 1) D'abord REGARDER ce qui serait supprimé (comptes jamais confirmés,
--    créés il y a plus de 24 h) :
--
--    select u.id, u.email, u.created_at, p.pseudo
--      from auth.users u
--      join public.profiles p on p.id = u.id
--     where u.email_confirmed_at is null
--       and u.created_at < now() - interval '24 hours'
--     order by u.created_at;
--
-- 2) Si la liste te convient, SUPPRIMER (le profil part en cascade) :
--
--    delete from auth.users
--     where email_confirmed_at is null
--       and created_at < now() - interval '24 hours';
--
-- Pour débloquer « Skibidi » tout de suite, le plus simple reste de
-- passer par Authentication → Users, de chercher le compte et de le
-- supprimer : la ligne `profiles` disparaît avec lui.
