# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Le projet

Pixolud — plateforme communautaire de mini-jeux. Les joueurs créent, publient et jouent à des
mini-jeux 2D sans écrire de code. Next.js 16 (App Router) + Supabase + Tailwind v4 + TypeScript
strict. En production sur Vercel : https://pixolud.vercel.app

**Le produit est francophone.** Les libellés d'interface, les messages de commit et les
commentaires de code sont en français. Par convention les commentaires de code sont écrits **sans
accents** (voir n'importe quel fichier de `src/lib/`).

## Commandes

```
npm run dev        # serveur de dev sur :3000
npm run build      # build de production
npm run lint       # eslint (la commande est nue, sans argument)
npx tsc --noEmit   # vérification de types — le seul contrôle avant lint
```

Il n'y a **aucun framework de test** dans ce dépôt. Pour valider une logique pure (plan de niveau,
générateur, algorithme), la pratique établie est de transpiler le module puis de l'exécuter dans un
script Node jetable :

```
npx tsc src/lib/<module>.ts --outDir <scratch>/out --module esnext --target es2020 \
  --moduleResolution bundler --skipLibCheck
```

Écrire ensuite un `.mjs` qui importe le module compilé et vérifie les invariants (par exemple un BFS
qui confirme que toutes les pièces d'un plan restent accessibles). Supprimer les fichiers jetables
après usage.

## Spécificités Next.js 16

- Le middleware s'appelle **`src/proxy.ts`** et exporte `proxy()` (renommé dans Next 16). Il
  branche `updateSession` de Supabase.
- `params` et `searchParams` sont des **Promises** dans les pages : `const { slug } = await params`.
- `AGENTS.md` est régénéré par `next dev` ; le committer avec le reste garde l'arbre propre.

## Architecture : le pipeline d'une catégorie de jeu

C'est la partie qui demande de lire plusieurs fichiers pour être comprise. Chaque catégorie de
`CATEGORIES` (`src/lib/types.ts`) possède un jeu **parallèle** de fichiers, tous nécessaires :

| Rôle | Emplacement | Contrat |
| --- | --- | --- |
| Modèle de données | `src/lib/<categorie>.ts` | exporte `<X>Data`, `empty<X>()`, `is<X>Playable()` |
| Éditeur | `src/components/<X>Editor.tsx` | interface de création, sans code |
| Lecteur | `src/components/<X>Player.tsx` | exécute le jeu |
| Création | `src/app/editeur/actions.ts` | entrée dans `GAME_TYPES` + branche dans `isPublishable()` |
| Distribution | `src/app/jeu/[slug]/jouer/page.tsx` | import + branche de rendu |

Le contenu d'un jeu est stocké en **JSON dans la colonne `games.data`** — il n'y a pas de table par
catégorie. `is<X>Playable()` est la porte de publication : un jeu incomplet ne peut pas être publié.

**Ajouter une catégorie implique donc de toucher les cinq emplacements ci-dessus**, plus la liste
`CATEGORIES`. En oublier un se traduit par un jeu créable mais impossible à jouer, ou l'inverse.

## Mode 3D — section éditoriale, pas du contenu joueur

`/mode-3d` est **géré par l'équipe** et volontairement hors du pipeline ci-dessus : les joueurs ne
peuvent pas créer de jeux 3D. Le catalogue est la constante `GAMES_3D` de `src/lib/games3d.ts`, et
`src/app/mode-3d/[slug]/page.tsx` distribue vers un composant dédié. Ne pas recâbler ces jeux dans
`CATEGORIES`/`GAME_TYPES`.

Conventions Three.js à respecter — chacune vient d'une régression réelle :

- **Boucle de rendu : `setInterval(tick, 16)`, pas `requestAnimationFrame`.** Cadence fixe, et le
  delta est calculé via `performance.now()` puis plafonné (`Math.min(delta, 0.1)`) pour éviter les
  téléportations à travers les murs après une pause.
- **Peu de lumières dynamiques (~8 maximum) et `MeshLambertMaterial`, jamais `MeshStandardMaterial`.**
  Une vingtaine de lumières + des matériaux PBR avaient fait tomber le jeu à 1 FPS.
- **Aucun asset externe.** Textures dessinées au canvas (`src/lib/manorTextures.ts`) et audio
  synthétisé à la Web Audio API (`src/lib/manorAudio.ts`). C'est une discipline de licence autant
  qu'une optimisation.
- **Ne pas enchaîner `Object3D.lookAt()` puis une écriture sur `rotation.z`.** Quand la cible est à
  la même hauteur, `lookAt` produit des angles d'Euler en blocage de cardan où `x` et `z`
  s'annulent ; écraser `z` couche l'objet au sol. Calculer le lacet à la main :
  `atan2(cibleX - x, cibleZ - z)`.
- Les réglages joueur (clavier, sensibilité, luminosité) sont partagés entre tous les jeux 3D via
  `src/lib/settings3d.ts` (localStorage). Un nouveau jeu 3D doit les lire, pas réinventer les siens.

## Supabase

- Trois clients selon le contexte : `src/lib/supabase/{client,server,middleware}.ts`.
- Schéma dans `supabase/schema.sql` (tables `profiles`, `games`, `comments`, `ratings`, `reports`,
  avec RLS). Les évolutions sont des fichiers incrémentaux `supabase/add_*.sql`.
- Une seule fonction RPC : `increment_plays`.
- Variables d'environnement : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SECRET_KEY`.

⚠️ **Le développement local pointe sur la base de production.** Toute écriture depuis `localhost`
touche les vraies données des vrais joueurs. Privilégier les lectures, et ne jamais créer de compte
de test ni usurper un utilisateur pour vérifier quelque chose — demander au propriétaire de tester.

## Multijoueur

Deux mécanismes distincts, tous deux basés sur les canaux **Supabase Realtime** :

- **Arène** (`/multijoueur`) : modes propres à la plateforme définis dans `src/lib/arena.ts`
  (`ARENA_MODES`), rendus par `TerritoryGame`, `BubbleGame`, `ChessGame`, `TreasureHuntGame`,
  `PythonChatGame`.
- **Parties partagées** : `PartyLobby` permet de jouer à un jeu communautaire ordinaire à plusieurs,
  via `?party=<code>` sur la page de jeu, quand `multiplayer_mode` est activé.

## Paliers et internationalisation

- `src/lib/tiers.ts` : `free` / `standard` / `max`, avec quotas de publication, badges et dégradés
  exclusifs. **Le palier gratuit est volontairement limité** — ne pas « améliorer » ses limites sans
  demander, l'équilibre est intentionnel.
- `src/lib/i18n.ts` (+ `i18n-server.ts`) : 6 langues dont l'arabe en RTL, sélection par cookie
  `pixolud_lang`. Un dictionnaire par langue dans le même fichier.

## Livraison

Pousser sur `main` déclenche un déploiement Vercel automatique. **Toujours demander une confirmation
explicite avant de committer et de pousser** — le propriétaire valide chaque mise en ligne.
