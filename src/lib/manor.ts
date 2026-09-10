import type { MazeData } from "./maze";

export interface ManorRoom {
  name: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  floor: 0 | 1;
}

// Le manoir a deux niveaux, mais la grille reste a plat : l'etage occupe des
// lignes de grille qui sont "plus loin" au sud, et l'escalier fait monter le
// sol de 0 a UPPER_Y au fil des lignes 21 a 26. Comme le mur du rez separe
// completement les deux zones, on ne voit jamais qu'elles sont cote a cote :
// on percoit un vrai etage. Avantage enorme : une seule grille, une seule
// hauteur de sol par case, donc collisions et IA restent en 2D.
export const UPPER_Y = 3.2;
export const STAIR_X0 = 12;
export const STAIR_X1 = 14;
export const STAIR_ROW_FIRST = 21;
export const STAIR_ROW_LAST = 26;

const ROOMS: ManorRoom[] = [
  { name: "Bureau", x0: 1, y0: 1, x1: 7, y1: 6, floor: 0 },
  { name: "Bibliothèque", x0: 9, y0: 1, x1: 15, y1: 6, floor: 0 },
  { name: "Chambre principale", x0: 17, y0: 1, x1: 23, y1: 6, floor: 0 },
  { name: "Salon", x0: 1, y0: 8, x1: 7, y1: 13, floor: 0 },
  { name: "Grand hall", x0: 9, y0: 8, x1: 15, y1: 13, floor: 0 },
  { name: "Cuisine", x0: 17, y0: 8, x1: 23, y1: 13, floor: 0 },
  { name: "Salle à manger", x0: 1, y0: 15, x1: 7, y1: 20, floor: 0 },
  { name: "Entrée", x0: 9, y0: 15, x1: 15, y1: 20, floor: 0 },
  { name: "Cave", x0: 17, y0: 15, x1: 23, y1: 20, floor: 0 },
  { name: "Palier", x0: 10, y0: 27, x1: 16, y1: 32, floor: 1 },
  { name: "Chambre d'enfant", x0: 2, y0: 27, x1: 8, y1: 32, floor: 1 },
  { name: "Grenier", x0: 18, y0: 27, x1: 24, y1: 32, floor: 1 },
];

const DOORS: [number, number, number, number][] = [
  [8, 3, 8, 4],
  [16, 3, 16, 4],
  [8, 10, 8, 11],
  [16, 10, 16, 11],
  [8, 17, 8, 18],
  [3, 7, 4, 7],
  [3, 14, 4, 14],
  [11, 7, 12, 7],
  [11, 14, 12, 14],
  [19, 7, 20, 7],
  // Escalier : couloir montant qui relie l'Entree au Palier de l'etage.
  [STAIR_X0, STAIR_ROW_FIRST, STAIR_X1, STAIR_ROW_LAST],
  // Portes de l'etage.
  [9, 29, 9, 30],
  [17, 29, 17, 30],
];

// La seule entree de la cave, verrouillee par un code a 3 chiffres : c'est
// la porte de sortie du jeu.
export const CAVE_DOOR: { x0: number; y0: number; x1: number; y1: number } = {
  x0: 16,
  y0: 17,
  x1: 16,
  y1: 18,
};

export const MANOR_WIDTH = 25;
export const MANOR_HEIGHT = 34;

// Hauteur du sol pour une position continue en z (en cases).
export function floorHeightAt(z: number): number {
  if (z <= STAIR_ROW_FIRST) return 0;
  if (z >= STAIR_ROW_LAST + 1) return UPPER_Y;
  return ((z - STAIR_ROW_FIRST) / (STAIR_ROW_LAST + 1 - STAIR_ROW_FIRST)) * UPPER_Y;
}

export type PropKind =
  | "shelf"
  | "table"
  | "seat"
  | "bed"
  | "crate"
  | "fireplace"
  | "piano"
  | "railing";

export interface ManorProp {
  kind: PropKind;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Les meubles bloquent le passage, sauf ceux marques traversables. */
  walkable?: boolean;
  tint?: number;
}

// Meubles places a la main, colles aux murs, en laissant les passages entre
// portes degages (verifie par un BFS dans les tests).
const PROPS: ManorProp[] = [
  // --- Bureau ---
  { kind: "shelf", x0: 1, y0: 1, x1: 3, y1: 1 },
  { kind: "table", x0: 5, y0: 2, x1: 6, y1: 3 },
  { kind: "seat", x0: 5, y0: 4, x1: 5, y1: 4 },
  { kind: "shelf", x0: 7, y0: 5, x1: 7, y1: 6 },

  // --- Bibliotheque ---
  { kind: "shelf", x0: 9, y0: 1, x1: 11, y1: 1 },
  { kind: "shelf", x0: 13, y0: 1, x1: 15, y1: 1 },
  { kind: "table", x0: 11, y0: 3, x1: 12, y1: 4 },
  { kind: "shelf", x0: 15, y0: 5, x1: 15, y1: 6 },

  // --- Chambre principale ---
  { kind: "bed", x0: 21, y0: 2, x1: 23, y1: 4 },
  { kind: "shelf", x0: 17, y0: 1, x1: 18, y1: 1 },
  { kind: "table", x0: 20, y0: 2, x1: 20, y1: 2 },
  { kind: "crate", x0: 17, y0: 6, x1: 17, y1: 6 },

  // --- Salon ---
  { kind: "seat", x0: 1, y0: 9, x1: 3, y1: 9 },
  { kind: "fireplace", x0: 1, y0: 11, x1: 1, y1: 12 },
  { kind: "table", x0: 5, y0: 11, x1: 6, y1: 11 },
  { kind: "piano", x0: 5, y0: 13, x1: 7, y1: 13 },

  // --- Grand hall (on garde le centre degage) ---
  { kind: "table", x0: 9, y0: 8, x1: 9, y1: 8 },
  { kind: "table", x0: 15, y0: 8, x1: 15, y1: 8 },
  { kind: "table", x0: 14, y0: 12, x1: 15, y1: 12 },

  // --- Cuisine ---
  { kind: "table", x0: 21, y0: 8, x1: 23, y1: 8 },
  { kind: "shelf", x0: 17, y0: 8, x1: 18, y1: 8 },
  { kind: "table", x0: 21, y0: 11, x1: 22, y1: 12 },
  { kind: "crate", x0: 17, y0: 13, x1: 17, y1: 13 },

  // --- Salle a manger ---
  { kind: "table", x0: 2, y0: 17, x1: 5, y1: 18 },
  { kind: "shelf", x0: 1, y0: 20, x1: 2, y1: 20 },
  { kind: "seat", x0: 6, y0: 16, x1: 6, y1: 16 },
  { kind: "seat", x0: 6, y0: 19, x1: 6, y1: 19 },

  // --- Entree (on laisse x12..14 libre vers l'escalier) ---
  { kind: "shelf", x0: 9, y0: 15, x1: 9, y1: 15 },
  { kind: "table", x0: 9, y0: 19, x1: 10, y1: 19 },
  { kind: "shelf", x0: 15, y0: 15, x1: 15, y1: 15 },
  { kind: "seat", x0: 15, y0: 20, x1: 15, y1: 20 },

  // --- Cave ---
  { kind: "crate", x0: 17, y0: 19, x1: 18, y1: 20 },
  { kind: "crate", x0: 22, y0: 15, x1: 23, y1: 16 },
  { kind: "table", x0: 20, y0: 19, x1: 21, y1: 19 },

  // --- Palier (l'etage) ---
  { kind: "railing", x0: 10, y0: 27, x1: 11, y1: 27, walkable: true },
  { kind: "railing", x0: 15, y0: 27, x1: 16, y1: 27, walkable: true },
  { kind: "seat", x0: 10, y0: 31, x1: 10, y1: 31 },
  { kind: "table", x0: 16, y0: 31, x1: 16, y1: 32 },

  // --- Chambre d'enfant ---
  { kind: "bed", x0: 2, y0: 28, x1: 3, y1: 30 },
  { kind: "crate", x0: 5, y0: 32, x1: 5, y1: 32 },
  { kind: "seat", x0: 7, y0: 28, x1: 7, y1: 28 },
  { kind: "shelf", x0: 8, y0: 32, x1: 8, y1: 32 },

  // --- Grenier (on laisse x18 libre : c'est l'entree depuis le Palier) ---
  { kind: "crate", x0: 22, y0: 27, x1: 23, y1: 28 },
  { kind: "shelf", x0: 24, y0: 30, x1: 24, y1: 32 },
  { kind: "crate", x0: 19, y0: 31, x1: 20, y1: 32 },
  { kind: "table", x0: 21, y0: 30, x1: 21, y1: 30 },
];

export interface ManorData extends MazeData {
  rooms: ManorRoom[];
  props: ManorProp[];
  /** Cases occupees par un meuble : bloquantes pour le joueur et le monstre. */
  blocked: [number, number][];
}

export function buildManor(): ManorData {
  const width = MANOR_WIDTH;
  const height = MANOR_HEIGHT;
  const solid: boolean[][] = Array.from({ length: height }, () => new Array(width).fill(true));

  function carve(x0: number, y0: number, x1: number, y1: number) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x >= 0 && y >= 0 && x < width && y < height) solid[y][x] = false;
      }
    }
  }
  for (const r of ROOMS) carve(r.x0, r.y0, r.x1, r.y1);
  for (const [x0, y0, x1, y1] of DOORS) carve(x0, y0, x1, y1);
  carve(CAVE_DOOR.x0, CAVE_DOOR.y0, CAVE_DOOR.x1, CAVE_DOOR.y1);

  const walls: [number, number][] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (solid[y][x]) walls.push([x, y]);
    }
  }

  const blocked: [number, number][] = [];
  for (const p of PROPS) {
    if (p.walkable) continue;
    for (let y = p.y0; y <= p.y1; y++) {
      for (let x = p.x0; x <= p.x1; x++) blocked.push([x, y]);
    }
  }

  const entree = ROOMS.find((r) => r.name === "Entrée")!;
  const cave = ROOMS.find((r) => r.name === "Cave")!;

  return {
    width,
    height,
    walls,
    start: [Math.floor((entree.x0 + entree.x1) / 2), Math.floor((entree.y0 + entree.y1) / 2)],
    end: [Math.floor((cave.x0 + cave.x1) / 2), Math.floor((cave.y0 + cave.y1) / 2)],
    rooms: ROOMS,
    props: PROPS,
    blocked,
  };
}

export function roomAt(rooms: ManorRoom[], x: number, y: number): ManorRoom | null {
  for (const r of rooms) {
    if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return r;
  }
  return null;
}

export interface ManorItemDef {
  name: string;
  flavor: string;
  emoji: string;
}

export const MANOR_ITEMS: ManorItemDef[] = [
  { name: "Une clé rouillée", flavor: "Elle semble très vieille. À quoi ouvre-t-elle ?", emoji: "🗝️" },
  { name: "Un médaillon brisé", flavor: "Une photo à l'intérieur, trop abîmée pour la reconnaître.", emoji: "📿" },
  { name: "Un journal intime", flavor: "Les dernières pages parlent d'une « présence » dans les murs.", emoji: "📔" },
  { name: "Une bougie éteinte", flavor: "Encore tiède. Quelqu'un l'a soufflée il y a peu...", emoji: "🕯️" },
  { name: "Une photo de famille déchirée", flavor: "Un visage a été grossièrement rayé.", emoji: "🖼️" },
];

/** Les 3 indices du code de la cave : un par piece, dont une a l'etage. */
export const CLUE_SPOTS: { room: string; x: number; wallRow: number }[] = [
  { room: "Bureau", x: 4, wallRow: 0 },
  { room: "Chambre principale", x: 22, wallRow: 0 },
  { room: "Grenier", x: 20, wallRow: 26 },
];
