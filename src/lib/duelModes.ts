import type { WeaponId } from "./duelWeapons";

/**
 * Les modes de jeu du Duel, et la grande carte de la Battle Royale.
 *
 * Le jeu n'avait qu'un mode : 1 contre 1 jusqu'a huit eliminations. C'est
 * tres bien pour se mesurer a quelqu'un, et ca ne vaut rien quand on est
 * seul. Les quatre modes ci-dessous couvrent des envies differentes :
 *
 *  - Duel        : le 1 contre 1 d'origine, en ligne ou contre la Sentinelle.
 *  - Match a mort: chacun pour soi contre quatre bots, sur la meme arene.
 *  - Armement    : chaque elimination change ton arme ; le premier a finir
 *                  les cinq armes gagne. Une seule mort ne coute rien, mais
 *                  se tromper d'arme au mauvais moment, si.
 *  - Zone        : personne ne reapparait, on ramasse ses armes au sol, et
 *                  le terrain se referme. Le dernier debout gagne.
 */

export type DuelModeId = "duel" | "deathmatch" | "armement" | "zone";

export interface DuelMode {
  id: DuelModeId;
  name: string;
  tagline: string;
  /** Description longue, affichee dans le menu. */
  detail: string;
  /** Quelle carte : l'arene symetrique ou le grand terrain. */
  arena: "duel" | "zone";
  /** Nombre d'adversaires controles par l'ordinateur. */
  bots: number;
  /** Eliminations pour gagner. 0 = la victoire ne se compte pas en frags. */
  scoreToWin: number;
  /** Faux en Battle Royale : une mort est definitive. */
  respawn: boolean;
  startWeapon: WeaponId;
  /** Chaque elimination fait passer a l'arme suivante. */
  gunGame: boolean;
  /** Le terrain se referme et blesse ceux qui restent dehors. */
  shrinkingZone: boolean;
  /** Des armes trainent au sol et se ramassent. */
  loot: boolean;
  /** Accessible en ligne avec un code de salon. */
  online: boolean;
}

export const DUEL_MODES: Record<DuelModeId, DuelMode> = {
  duel: {
    id: "duel",
    name: "Duel",
    tagline: "1 contre 1",
    detail:
      "L'arène symétrique, 8 éliminations pour gagner. Réapparition immédiate, fusil d'assaut pour tout le monde.",
    arena: "duel",
    bots: 1,
    scoreToWin: 8,
    respawn: true,
    startWeapon: "fusil",
    gunGame: false,
    shrinkingZone: false,
    loot: false,
    online: true,
  },
  deathmatch: {
    id: "deathmatch",
    name: "Match à mort",
    tagline: "Chacun pour soi",
    detail:
      "Toi contre quatre Sentinelles, toutes ennemies entre elles aussi. 15 éliminations. Des armes traînent au sol.",
    arena: "duel",
    bots: 4,
    scoreToWin: 15,
    respawn: true,
    startWeapon: "fusil",
    gunGame: false,
    shrinkingZone: false,
    loot: true,
    online: false,
  },
  armement: {
    id: "armement",
    name: "Course à l'armement",
    tagline: "Cinq armes à enchaîner",
    detail:
      "Chaque élimination te fait passer à l'arme suivante : pistolet, mitraillette, fusil, pompe, sniper. Le premier à finir les cinq gagne.",
    arena: "duel",
    bots: 3,
    scoreToWin: 5,
    respawn: true,
    startWeapon: "pistolet",
    gunGame: true,
    shrinkingZone: false,
    loot: false,
    online: false,
  },
  zone: {
    id: "zone",
    name: "Zone",
    tagline: "Battle royale",
    detail:
      "Grand terrain, cinq adversaires, aucune réapparition. Tu commences au pistolet et tu ramasses mieux au sol. La zone se referme et brûle ceux qui restent dehors.",
    arena: "zone",
    bots: 5,
    scoreToWin: 0,
    respawn: false,
    startWeapon: "pistolet",
    gunGame: false,
    shrinkingZone: true,
    loot: true,
    online: false,
  },
};

export const DUEL_MODE_ORDER: DuelModeId[] = ["duel", "deathmatch", "armement", "zone"];

/**
 * Le terrain de la Zone : 31x31, quatre fois l'arene du duel.
 *
 * Il est dessine autour de trois idees : des batiments fermes ou se planquer,
 * de longues avenues qui recompensent le sniper, et assez de diagonales pour
 * qu'on ne puisse jamais surveiller tout le monde. '$' marque un point
 * d'apparition, '*' un coffre d'armes.
 */
const ZONE_ROWS = [
  "###############################",
  "#$...........................$#",
  "#..####...........####........#",
  "#..#..#...*.......#..#...*....#",
  "#..#..#...##...##.#..#...###..#",
  "#..#.##...##...##.#.##...###..#",
  "#.........................#...#",
  "#...###.......#.#.......#####.#",
  "#...#..*......#.#.............#",
  "#...#..#####..#.#....####.....#",
  "#......#...#..#.#....#..#..*..#",
  "#..##..#...#..###....#..#..##.#",
  "#..##..##.##.........#.##..##.#",
  "#$...........*...............$#",
  "#..####....###.###....####....#",
  "#..#..#....#..*..#....#..#....#",
  "#..#..#....#.....#....#..#....#",
  "#..#.##....#..#..#....#.##....#",
  "#..........#.....#............#",
  "#....##.....##.##.......##....#",
  "#....##...*.............##..*.#",
  "#.............................#",
  "#..###...####.....####...###..#",
  "#....#...#..#..*..#..#...#....#",
  "#....#...#..#.....#..#...#....#",
  "#....#...#.##.....#.##...#....#",
  "#..###.................###....#",
  "#........*...........*........#",
  "#...#.##...........#.##.......#",
  "#$..#..#...........#..#......$#",
  "###############################",
];

export interface ZoneMap {
  width: number;
  height: number;
  walls: [number, number][];
  /** Apparitions dispersees aux quatre coins et sur les cotes. */
  spawns: [number, number][];
  /** Emplacements des armes a ramasser. */
  loot: [number, number][];
}

export function buildZoneMap(): ZoneMap {
  const walls: [number, number][] = [];
  const spawns: [number, number][] = [];
  const loot: [number, number][] = [];
  ZONE_ROWS.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c === "#") walls.push([x, y]);
      else if (c === "$") spawns.push([x, y]);
      else if (c === "*") loot.push([x, y]);
    }
  });
  return { width: ZONE_ROWS[0].length, height: ZONE_ROWS.length, walls, spawns, loot };
}

/** Duree totale du retrecissement de la zone, en secondes. */
export const ZONE_SHRINK_SECONDS = 165;
/** Le premier palier ne bouge pas : le temps de trouver une arme. */
export const ZONE_GRACE_SECONDS = 22;
/** Degats par seconde hors de la zone. Ca ne tue pas d'un coup, ca presse. */
export const ZONE_DAMAGE_PER_SECOND = 9;
/** Rayon final, en cases : assez petit pour forcer le dernier affrontement. */
export const ZONE_FINAL_RADIUS = 4.5;
