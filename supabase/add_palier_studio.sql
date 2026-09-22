-- Le quatrieme palier : Studio.
--
-- La colonne `tier` n'acceptait que trois valeurs. On remplace la contrainte
-- pour en accepter une quatrieme. Aucun profil n'est modifie : ceux qui sont
-- en gratuit, standard ou max le restent.

alter table public.profiles drop constraint if exists profiles_tier_check;

alter table public.profiles
  add constraint profiles_tier_check
  check (tier in ('free', 'standard', 'max', 'studio'));
