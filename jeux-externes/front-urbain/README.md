# Front Urbain

Jeu de tir tactique à la première personne de la section **Mode 3D** de Pixolud
(`/mode-3d/front-urbain`).

## Origine et licence

Ce dossier est une copie adaptée du projet libre **Claude of Duty**
(<https://github.com/mshumer/Claude-of-Duty>), Copyright (c) 2026 mshumer,
publié sous **licence MIT**. Le fichier `LICENSE` est celui du projet d'origine :
la licence impose de le conserver tel quel avec le code, ne pas le modifier ni le
supprimer. `ARCHITECTURE.md` est aussi la documentation d'origine (en anglais).

Tout est généré par le code au chargement (textures, modèles, animations, sons) :
aucun fichier d'image, de modèle ou de son. La seule dépendance est `three`.

## Ce que Pixolud a changé

- Plus aucun nom de marque visible : le jeu s'appelle « Front Urbain », les armes
  ont des noms génériques (FA-4, PM-9, PA-19).
- Tous les textes visibles en français (menu, HUD, messages, écrans).
- Qualité graphique prudente par défaut (Basse, ou Moyenne avec une carte
  graphique dédiée), choix Basse / Moyenne / Haute / Ultra dans le menu Échap,
  mémorisé dans le navigateur ; plafond de densité de pixels par niveau.
- Résolution adaptative (ajout) : l'image baisse un peu en résolution quand le
  jeu rame, et remonte quand il redevient fluide.
- Mode rapide (ajout, actif par défaut) : pas de compilation anticipée des
  shaders, matériaux allégés, textures cuites plus petites, qualité Basse.
  Mesuré sur un portable Windows : environ 2 min 45 au lieu de 5 min. Choisi sur
  l'écran de lancement du site (`?rapide=1` / `?rapide=0`) et dans le menu Échap.
- Réglages partagés avec les autres jeux 3D du site (clavier AZERTY/QWERTY,
  sensibilité, luminosité) : mêmes clés que `src/lib/settings3d.ts`.
- Déroulement de mission (ajout) : écran d'accueil avec les touches, score
  (éliminés / chrono / restants), écran « Tu es tombé » avec réapparition, écran
  de victoire.
- Ctrl ne sert plus à s'accroupir (Ctrl + W ferme l'onglet) : c'est la touche C.

Le code ajouté est dans `src/pixolud/` ; les autres retouches sont signalées par
un commentaire « Pixolud » dans le fichier concerné.

## Reconstruire

Le site ne compile pas ce dossier : il sert la version déjà construite, copiée
dans `public/jeux/front-urbain/`. Après une modification :

```bash
cd jeux-externes/front-urbain
npm install
npx vite build
```

Puis remplacer le contenu de `public/jeux/front-urbain/` par celui de `dist/`
(`index.html` et le dossier `assets/`). Ne jamais modifier
`public/jeux/front-urbain/` à la main.

Pour tester seul, sans le site : `npx vite preview` puis
<http://127.0.0.1:4173/>. Ajouter `?q=low`, `?q=medium`, `?q=high` ou `?q=ultra`
à l'adresse force un niveau de qualité.
