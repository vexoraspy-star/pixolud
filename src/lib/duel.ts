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

export type DuelMapId = "arene" | "entrepot" | "gouffre" | "poussiere";

/** Habillage d'une carte : textures et decor changent completement avec. */
export type DuelTheme = "arene" | "entrepot" | "gouffre" | "poussiere";

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
  // corps a corps.
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
};

export const DUEL_MAP_ORDER: DuelMapId[] = ["arene", "entrepot", "gouffre", "poussiere"];

export const DUEL_MAP_INFO: Record<DuelMapId, { name: string; tagline: string; theme: DuelTheme }> = {
  arene: { name: "Arène", tagline: "Symétrique, corridors serrés", theme: "arene" },
  entrepot: { name: "Entrepôt", tagline: "Hangar, caisses empilées", theme: "entrepot" },
  gouffre: { name: "Gouffre", tagline: "Roche, couloirs coudés", theme: "gouffre" },
  poussiere: { name: "Poussière", tagline: "Deux sites, milieu ouvert", theme: "poussiere" },
};

export const DUEL_WIDTH = MAPS.arene[0].length;
export const DUEL_HEIGHT = MAPS.arene.length;
export const DUEL_CELL = 1.9;
export const DUEL_WALL_HEIGHT = 3.4;

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
