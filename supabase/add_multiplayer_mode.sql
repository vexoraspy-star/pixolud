-- Réglage "mode multijoueur" sur un jeu : pour l'instant juste un drapeau
-- affiché dans l'éditeur ("bientôt disponible"), sans logique de jeu réelle.
-- Sert aussi à activer le bouton "Inviter un ami" (mode Party) sur la page
-- du jeu, qui lui est réellement fonctionnel (lobby en temps réel).

alter table public.games
  add column if not exists multiplayer_mode boolean not null default false;
