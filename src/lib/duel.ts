// Duel 1v1 : arene symetrique en vue a la premiere personne.
// La carte est ecrite en ASCII pour rester lisible et modifiable a la main.
// '#' = mur plein, '.' = sol, 'A'/'B' = points d'apparition des deux joueurs.

const MAP_ROWS = [
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
];

export const DUEL_WIDTH = MAP_ROWS[0].length;
export const DUEL_HEIGHT = MAP_ROWS.length;
export const DUEL_CELL = 1.9;
export const DUEL_WALL_HEIGHT = 3.4;

export type DuelSide = "a" | "b";

export interface DuelMap {
  width: number;
  height: number;
  walls: [number, number][];
  /** Deux apparitions par camp : on repart de la plus eloignee du tueur. */
  spawns: Record<DuelSide, [number, number][]>;
}

export function buildDuelMap(): DuelMap {
  const walls: [number, number][] = [];
  const spawns: Record<DuelSide, [number, number][]> = { a: [], b: [] };
  MAP_ROWS.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c === "#") walls.push([x, y]);
      else if (c === "A") spawns.a.push([x, y]);
      else if (c === "B") spawns.b.push([x, y]);
    }
  });
  return { width: DUEL_WIDTH, height: DUEL_HEIGHT, walls, spawns };
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
