-- Marque un compte comme administrateur. Seul un compte admin peut
-- s'attribuer gratuitement un palier payant (Standard/Max) depuis la page
-- /premium, en attendant que le vrai paiement soit branché.
--
-- Pour te donner les droits admin : va dans Table Editor -> profiles,
-- trouve ta ligne (par ton pseudo), et coche la case "is_admin" à true.

alter table public.profiles
  add column if not exists is_admin boolean not null default false;
