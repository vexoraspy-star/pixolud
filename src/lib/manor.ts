import type { MazeData } from "./maze";

export interface ManorRoom {
  name: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ManorData extends MazeData {
  rooms: ManorRoom[];
}

// Plan fixe (pas regenere a chaque partie) : un vrai manoir a 9 pieces
// distinctes reliees par des portes, plutot qu'un labyrinthe procedural.
const ROOMS: ManorRoom[] = [
  { name: "Bureau", x0: 1, y0: 1, x1: 7, y1: 6 },
  { name: "Bibliothèque", x0: 9, y0: 1, x1: 15, y1: 6 },
  { name: "Chambre principale", x0: 17, y0: 1, x1: 23, y1: 6 },
  { name: "Salon", x0: 1, y0: 8, x1: 7, y1: 13 },
  { name: "Grand hall", x0: 9, y0: 8, x1: 15, y1: 13 },
  { name: "Cuisine", x0: 17, y0: 8, x1: 23, y1: 13 },
  { name: "Salle à manger", x0: 1, y0: 15, x1: 7, y1: 20 },
  { name: "Entrée", x0: 9, y0: 15, x1: 15, y1: 20 },
  { name: "Cave", x0: 17, y0: 15, x1: 23, y1: 20 },
];

const DOORS: [number, number, number, number][] = [
  [8, 3, 8, 4], [16, 3, 16, 4],
  [8, 10, 8, 11], [16, 10, 16, 11],
  [8, 17, 8, 18], [16, 17, 16, 18],
  [3, 7, 4, 7], [3, 14, 4, 14],
  [11, 7, 12, 7], [11, 14, 12, 14],
  [19, 7, 20, 7], [19, 14, 20, 14],
];

export function buildManor(): ManorData {
  const width = 25;
  const height = 22;
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

  const walls: [number, number][] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (solid[y][x]) walls.push([x, y]);
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
