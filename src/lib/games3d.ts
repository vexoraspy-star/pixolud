import type { MazeData } from "./maze";

export interface Game3D {
  slug: string;
  title: string;
  description: string;
  emoji: string;
  gradient: string;
}

// Jeux 3D geres par l'equipe Pixolud (pas de creation par les joueurs pour
// l'instant) : on ajoute de nouvelles entrees ici au fil du temps.
export const GAMES_3D: Game3D[] = [
  {
    slug: "labyrinthe-legendaire",
    title: "Labyrinthe légendaire",
    description:
      "Un vrai labyrinthe en pierre à parcourir en vue à la première personne. Trouve la sortie !",
    emoji: "🧱",
    gradient: "from-amber-700 to-stone-950",
  },
];

// Petit generateur pseudo-aleatoire (seed fixe) pour que le labyrinthe soit
// toujours le meme d'une partie a l'autre, tout en ayant vraiment plusieurs
// passages/embranchements (algorithme "recursive backtracker" classique).
function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function generateMaze(roomsW: number, roomsH: number, seed: number): MazeData {
  const rand = seededRandom(seed);
  const visited: boolean[][] = Array.from({ length: roomsH }, () =>
    new Array(roomsW).fill(false),
  );
  const passages = new Set<string>();

  function key(x1: number, y1: number, x2: number, y2: number): string {
    return x1 < x2 || (x1 === x2 && y1 < y2)
      ? `${x1},${y1}-${x2},${y2}`
      : `${x2},${y2}-${x1},${y1}`;
  }

  function shuffled<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // DFS iteratif (pas de recursion) pour rester sûr sur de grandes grilles.
  const stack: [number, number][] = [[0, 0]];
  visited[0][0] = true;
  while (stack.length > 0) {
    const [x, y] = stack[stack.length - 1];
    const neighbors = shuffled([
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]).filter(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < roomsW && ny < roomsH && !visited[ny][nx];
    });
    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }
    const [dx, dy] = neighbors[0];
    const nx = x + dx;
    const ny = y + dy;
    visited[ny][nx] = true;
    passages.add(key(x, y, nx, ny));
    stack.push([nx, ny]);
  }

  const width = roomsW * 2 + 1;
  const height = roomsH * 2 + 1;
  const walls: [number, number][] = [];
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const isRoomCol = px % 2 === 1;
      const isRoomRow = py % 2 === 1;
      if (isRoomCol && isRoomRow) continue;
      if (isRoomCol && !isRoomRow) {
        const rx = (px - 1) / 2;
        const ry1 = py / 2 - 1;
        const ry2 = py / 2;
        if (ry1 >= 0 && ry2 < roomsH && passages.has(key(rx, ry1, rx, ry2))) continue;
        walls.push([px, py]);
        continue;
      }
      if (!isRoomCol && isRoomRow) {
        const ry = (py - 1) / 2;
        const rx1 = px / 2 - 1;
        const rx2 = px / 2;
        if (rx1 >= 0 && rx2 < roomsW && passages.has(key(rx1, ry, rx2, ry))) continue;
        walls.push([px, py]);
        continue;
      }
      walls.push([px, py]);
    }
  }

  return {
    width,
    height,
    walls,
    start: [1, 1],
    end: [width - 2, height - 2],
  };
}

const MAZE_DATA_BY_SLUG: Record<string, MazeData> = {
  "labyrinthe-legendaire": generateMaze(9, 9, 20260908),
};

export function getGame3D(slug: string): Game3D | undefined {
  return GAMES_3D.find((g) => g.slug === slug);
}

export function getMaze3DData(slug: string): MazeData | undefined {
  return MAZE_DATA_BY_SLUG[slug];
}
