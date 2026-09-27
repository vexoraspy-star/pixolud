// Duel 1v1 : arenes en vue a la premiere personne.
//
// Chaque carte est ecrite en ASCII pour rester lisible et modifiable a la
// main :
//   '#' mur plein      'C' caisse (meme collision, dessinee en caisses)
//   '.' sol            'A'/'B' points d'apparition
//   'a'/'b' marquage de site peint au sol (on marche dessus)
//
// Les trois premieres sont a symetrie centrale (tourner la carte a 180 degres
// la laisse identique) : aucun cote n'a un avantage de position. « Poussiere »
// assume au contraire une construction a la Counter-Strike : deux couloirs
// lateraux, un milieu ouvert, deux sites encombres de caisses.

export type DuelMapId = "arene" | "entrepot" | "gouffre" | "poussiere" | "chantier";

/** Habillage d'une carte : textures et decor changent completement avec. */
export type DuelTheme = "arene" | "entrepot" | "gouffre" | "poussiere" | "ile";

const MAPS: Record<DuelMapId, string[]> = {
  arene: [
    "###################",
    "#A...............B#",
    "#..##.........##..#",
    "#..##.........##..#",
    "#.......###.......#",
    "#..#....#.#....#..#",
    "#..#....#.#....#..#",
    "#.................#",
    "#.###.........###.#",
    "#.................#",
    "#.###.........###.#",
    "#.................#",
    "#..#....#.#....#..#",
    "#..#....#.#....#..#",
    "#.......###.......#",
    "#..##.........##..#",
    "#..##.........##..#",
    "#B...............A#",
    "###################",
  ],
  // Grande et ouverte, des ilots de caisses pour casser les lignes de vue :
  // le fusil de precision y trouve de vrais couloirs, mais jamais degages
  // de bout en bout.
  entrepot: [
    "#######################",
    "#A....................#",
    "#.......CCC...........#",
    "#..CCCC.CCC...........#",
    "#..CCCC........CC.....#",
    "#..CCCCCC......CC.....#",
    "#.....CCC.............#",
    "#.....................#",
    "#..CCC...CCCCC........#",
    "#..CCC...CCCCC...CCC..#",
    "#........CCCCC...CCC..#",
    "#.....................#",
    "#.............CCC.....#",
    "#.....CC......CCCCCC..#",
    "#.....CC........CCCC..#",
    "#...........CCC.CCCC..#",
    "#...........CCC.......#",
    "#....................B#",
    "#######################",
  ],
  // Serree, des couloirs coudes : le corps a corps et la mitraillette y
  // dominent, le sniper n'y a presque aucune ligne droite.
  gouffre: [
    "###################",
    "#A....#...........#",
    "#.....#...........#",
    "#.#####...........#",
    "#.....#.##....##..#",
    "#.......##..#.##..#",
    "#...........#.....#",
    "#..#######..#.....#",
    "#.....#.....#.....#",
    "#.....#..#######..#",
    "#.....#...........#",
    "#..##.#..##.......#",
    "#..##....##.#.....#",
    "#...........#####.#",
    "#...........#.....#",
    "#...........#....B#",
    "###################",
  ],
  // Poussiere : une carte de plan « deux sites », comme dans les jeux de tir
  // par equipes. Longs couloirs sur les cotes, milieu degage au centre, et
  // deux sites (a gauche, a droite) encombres de caisses ou l'on se bat au
  // corps a corps. Habillee en ville du desert par duelTown (facades, portes,
  // arches, etages, fils) : le decor ne touche jamais a cette grille.
  poussiere: [
    "#############################",
    "#A.......#.........#........#",
    "#........#....C....#....CC..#",
    "#..CC....#....C....#....CC..#",
    "#..CC..a.#.........#..b.....#",
    "#........####...####........#",
    "#.....C.....................#",
    "#.....C.....###.###....C....#",
    "####.####...#.....#....C....#",
    "#.......#...#.....#.........#",
    "#...CC..#...#.....#...####..#",
    "#...CC......#.....#......C..#",
    "#.......#...#.....#......C..#",
    "#....C..#...#######.........#",
    "####.####..............######",
    "#......#....CC....#.........#",
    "#......#....CC....#...CC....#",
    "#...####..........#...CC....#",
    "#.........####....#.........#",
    "#..CC.....#.......#.........#",
    "#..CC.....#.......#........B#",
    "#.........#.......#.........#",
    "#############################",
  ],
  // Chantier : un terrain presque vide, a symetrie centrale. Pour le 1v1
  // construction, les murs, c'est chacun qui les pose.
  chantier: [
    "#########################",
    "#.......................#",
    "#.A.......C.............#",
    "#.........C.........CC..#",
    "#...................CC..#",
    "#.....CC................#",
    "#.....CC........C.......#",
    "#...............C.......#",
    "#.......................#",
    "#.......C...............#",
    "#.......C........CC.....#",
    "#................CC.....#",
    "#..CC...................#",
    "#..CC.........C.........#",
    "#.............C.......B.#",
    "#.......................#",
    "#########################",
  ],
};

export const DUEL_MAP_ORDER: DuelMapId[] = ["arene", "entrepot", "gouffre", "poussiere", "chantier"];

export const DUEL_MAP_INFO: Record<DuelMapId, { name: string; tagline: string; theme: DuelTheme }> = {
  arene: { name: "Arène", tagline: "Symétrique, corridors serrés", theme: "arene" },
  entrepot: { name: "Entrepôt", tagline: "Hangar, caisses empilées", theme: "entrepot" },
  gouffre: { name: "Gouffre", tagline: "Roche, couloirs coudés", theme: "gouffre" },
  poussiere: { name: "Poussière", tagline: "Ville du désert, deux sites", theme: "poussiere" },
  chantier: { name: "Chantier", tagline: "Terrain ouvert, à toi de bâtir", theme: "entrepot" },
};

export const DUEL_WIDTH = MAPS.arene[0].length;
export const DUEL_HEIGHT = MAPS.arene.length;
export const DUEL_CELL = 1.9;
export const DUEL_WALL_HEIGHT = 3.4;

/**
 * Eclairage d'une carte. Quatre lumieres en tout dans la scene (ciel, soleil,
 * contre-jour, lueur du tir) : le contraste vient du rapport entre la lumiere
 * principale, chaude, et le ciel, plus froid, qui eclaire seul les faces a
 * l'ombre.
 *
 * Intensites en unites physiques de three.js (une lumiere blanche d'intensite
 * PI rend la couleur d'une texture telle quelle).
 */
export interface DuelLighting {
  /** Lumiere du ciel (faces tournees vers le haut) et rebond du sol (vers le bas). */
  sky: number;
  ground: number;
  ambient: number;
  /** Soleil ou lampes : couleur, intensite, direction VERS la lumiere. */
  key: number;
  keyPower: number;
  keyDir: readonly [number, number, number];
  /** Contre-jour froid, venu du cote oppose. */
  fill: number;
  fillPower: number;
  fillDir: readonly [number, number, number];
  /** Fond, et brouillard (en cases) de la meme couleur que l'horizon. */
  background: number;
  fogNear: number;
  fogFar: number;
  /** Ciel ouvert : pas de plafond, ciel peint, ombres portees au sol. */
  openSky: boolean;
}

/** Soleil de Poussiere : 45 degres de haut, venu du sud-ouest (lumiere rasante sur les facades). */
const DESERT_SUN = [-0.39, 0.707, 0.59] as const;
/** Soleil de l'ile : plus haut, venu du sud-est. */
const ISLAND_SUN = [0.45, 0.8, 0.4] as const;

export const DUEL_LIGHTING: Record<DuelTheme, DuelLighting> = {
  // Neons bleutes : un plafond lumineux, peu de lumiere directe.
  arene: {
    sky: 0xb9cde2,
    ground: 0x262c33,
    ambient: 2.2,
    key: 0xd8efff,
    keyPower: 1.7,
    keyDir: [0.45, 0.85, 0.3],
    fill: 0x7fa6d6,
    fillPower: 0.45,
    fillDir: [-0.55, 0.6, -0.45],
    background: 0x0d1014,
    fogNear: 16,
    fogFar: 30,
    openSky: false,
  },
  // Jour froid qui tombe des lanterneaux, lampes chaudes au-dessus des allees.
  entrepot: {
    sky: 0xd2dadd,
    ground: 0x3b3329,
    ambient: 2.0,
    key: 0xffe4bd,
    keyPower: 1.9,
    keyDir: [0.4, 0.85, 0.33],
    fill: 0x8ea7bf,
    fillPower: 0.5,
    fillDir: [-0.55, 0.55, -0.5],
    background: 0x0d1014,
    fogNear: 16,
    fogFar: 30,
    openSky: false,
  },
  // Roche : lampes de chantier orangees, ombres bleu nuit.
  gouffre: {
    sky: 0x7c8898,
    ground: 0x201913,
    ambient: 1.7,
    key: 0xffc684,
    keyPower: 2.1,
    keyDir: [0.5, 0.8, 0.3],
    fill: 0x5b7293,
    fillPower: 0.5,
    fillDir: [-0.5, 0.55, -0.55],
    background: 0x0b0d10,
    fogNear: 14,
    fogFar: 28,
    openSky: false,
  },
  // Plein soleil d'apres-midi : facades chaudes, ombres bleutees, voile de poussiere.
  poussiere: {
    sky: 0xc4d6ee,
    ground: 0x8f7a60,
    ambient: 2.4,
    key: 0xffdcaa,
    keyPower: 3.3,
    keyDir: DESERT_SUN,
    fill: 0x9cb4d8,
    fillPower: 0.4,
    fillDir: [0.55, 0.3, -0.78],
    background: 0xd9d2c0,
    fogNear: 14,
    fogFar: 75,
    openSky: true,
  },
  ile: {
    sky: 0xc8e2fb,
    ground: 0x5f7a48,
    ambient: 2.3,
    key: 0xfff0d4,
    keyPower: 3.0,
    keyDir: ISLAND_SUN,
    fill: 0xa8c4e0,
    fillPower: 0.35,
    fillDir: [-0.5, 0.35, -0.6],
    background: 0x9fd4ff,
    fogNear: 24,
    fogFar: 64,
    openSky: true,
  },
};

export type DuelSide = "a" | "b";

export interface DuelMap {
  width: number;
  height: number;
  /** Toutes les cases pleines : murs ET caisses (c'est la collision). */
  walls: [number, number][];
  /** Les cases pleines a dessiner en caisses empilees plutot qu'en mur. */
  crates: [number, number][];
  /** Lettres peintes au sol, comme les sites d'un jeu par equipes. */
  marks: { x: number; y: number; label: string }[];
  /** Arbres (battle royale) : des cases pleines dessinees en arbres. */
  trees?: [number, number][];
  /** Deux apparitions par camp : on repart de la plus eloignee du tueur. */
  spawns: Record<DuelSide, [number, number][]>;
  theme: DuelTheme;
}

export function buildDuelMap(mapId: DuelMapId = "arene"): DuelMap {
  const rows = MAPS[mapId];
  const walls: [number, number][] = [];
  const crates: [number, number][] = [];
  const marks: { x: number; y: number; label: string }[] = [];
  const spawns: Record<DuelSide, [number, number][]> = { a: [], b: [] };
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c === "#") walls.push([x, y]);
      else if (c === "C") {
        walls.push([x, y]);
        crates.push([x, y]);
      } else if (c === "A") spawns.a.push([x, y]);
      else if (c === "B") spawns.b.push([x, y]);
      else if (c === "a" || c === "b") marks.push({ x, y, label: c.toUpperCase() });
    }
  });
  return {
    width: rows[0].length,
    height: rows.length,
    walls,
    crates,
    marks,
    spawns,
    theme: DUEL_MAP_INFO[mapId].theme,
  };
}

// --- Reglages de jeu ---
export const DUEL_MOVE_SPEED = 4.2;
export const DUEL_PLAYER_RADIUS = 0.3;
export const DUEL_EYE_HEIGHT = 1.55;
/**
 * Saut : vitesse au decollage et gravite.
 *
 * 5.2 m/s contre 18 m/s² donnent un saut d'environ 75 cm qui retombe en
 * 0,6 seconde. Une gravite plus faible ferait flotter le personnage comme sur
 * la Lune, et un saut plus haut permettrait de passer par-dessus les murs
 * bas de certaines cartes.
 */
export const DUEL_JUMP_SPEED = 5.2;
export const DUEL_GRAVITY = 18;
export const DUEL_MAX_HP = 100;
export const DUEL_DAMAGE = 25;
export const DUEL_HEADSHOT_DAMAGE = 55;
export const DUEL_FIRE_INTERVAL = 0.17;
export const DUEL_MAG_SIZE = 12;
export const DUEL_RELOAD_SECONDS = 1.5;
export const DUEL_RESPAWN_SECONDS = 2.6;
export const DUEL_SCORE_TO_WIN = 8;
/** Rayon du buste et hauteur de la tete pour les tirs a la tete. */
export const DUEL_BODY_RADIUS = 0.42;
export const DUEL_HEAD_Y = 1.62;
export const DUEL_HEAD_RADIUS = 0.24;
/** Frequence d'envoi de notre position a l'adversaire. */
export const DUEL_NET_HZ = 15;

export function generateDuelCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

/** Etat d'un joueur transmis sur le reseau (volontairement minimal). */
export interface DuelNetState {
  x: number;
  z: number;
  yaw: number;
  hp: number;
  dead: boolean;
  moving: boolean;
}
