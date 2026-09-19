# Interface Pixolud

Le portail utilise une palette ardoise et violet, avec une variante claire ivoire. Les variables `--portal-*` sont definies dans `src/app/portal.css`. La police est Geist, deja chargee par le layout.

## Elements communs

- `PortalHeading` : surtitre, titre de page et introduction.
- `PortalNavigation` : navigation principale avec indication de la page active.
- `GameArtwork` : couverture du createur prioritaire, sinon illustration originale SVG de la categorie.
- `GameCard` : cartes communautaires, emoji et categorie, auteur, statistiques et couleurs choisies par le createur.
- `WorldGallery` : galerie 3D, respect des couvertures existantes et des jeux verrouilles.
- `AuthCard` : connexion, inscription, recuperation de compte et confirmations.
- `studio-page`, `editor-workspace`, `legal-page` : habillage des espaces compte, creation et information.

Les couleurs des createurs restent visibles dans le liseret des cartes. Les six illustrations ajoutees dans `public/covers` sont dessinees pour Pixolud ; aucun asset tiers ni modele 3D supplementaire.

## Mise en page et interaction

Conteneur principal de 1200 px, cartes de rayon 18 a 24 px, boutons de 44 a 48 px. La navigation passe en menu compact sous 1190 px, le hero sur une colonne sous 800 px et la galerie 3D sur une colonne sous 540 px. Les filtres restent lisibles sur telephone.

Focus clavier visible, lien d'evitement, noms accessibles des champs, et respect de `prefers-reduced-motion`. Illustrations statiques et chargees a la demande, sauf celle du premier ecran.

## Perimetre

Les styles de presentation restent distincts des moteurs et interfaces de jeu. Les regles de plein ecran existantes sont conservees. Aucun changement des quotas Premium, autorisations, paiements ou ecritures Supabase. Les pages privees necessitent un controle visuel par le proprietaire connecte ; ne pas creer de compte de test sur la base de production.
