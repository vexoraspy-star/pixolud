import type { MazeData } from "./maze";

export interface Game3D {
  slug: string;
  title: string;
  description: string;
  emoji: string;
  gradient: string;
  /** Genre affiche sur la vignette. */
  genre: string;
  /** "Solo", "1 contre 1"... */
  players: string;
  /** Duree indicative d'une partie. */
  duration: string;
  /** Deux ou trois points forts, listes sur la vignette. */
  highlights: string[];
  /** Mis en avant en grand en haut de la galerie. */
  featured?: boolean;
  /** Illustration de la vignette (fichier de public/, dessine maison) ; sinon l'emoji. */
  cover?: string;
  /**
   * Annonce mais pas encore jouable : visible dans la galerie avec un badge
   * "Bientot", jamais cliquable, et sa page renvoie une 404. Le jeu n'existe
   * pas encore — l'entree sert juste a reserver sa place.
   */
  locked?: boolean;
}

// Jeux 3D geres par l'equipe Pixolud (pas de creation par les joueurs pour
// l'instant) : on ajoute de nouvelles entrees ici au fil du temps.
export const GAMES_3D: Game3D[] = [
  {
    slug: "cubes",
    title: "Cubes",
    description: "Explore un monde de blocs, creuse ses grottes et construis ton refuge. Fabrique plus de 200 objets, surveille ta faim et ta soif, et tiens bon quand la nuit fait sortir les monstres.",
    emoji: "🌳",
    gradient: "from-emerald-700 to-slate-950",
    genre: "Construction et exploration",
    players: "Solo",
    duration: "À ton rythme",
    highlights: ["Créatif et survie", "Table de craft et plus de 200 objets", "Jour, nuit et monstres", "Vie, faim et soif"],
  },
  {
    slug: "labyrinthe-legendaire",
    title: "Labyrinthe légendaire",
    description:
      "Un vrai labyrinthe en pierre à parcourir en vue à la première personne. Choisis ta difficulté et trouve la sortie !",
    emoji: "🧱",
    gradient: "from-amber-700 to-stone-950",
    genre: "Exploration",
    players: "Solo",
    duration: "3 à 10 min",
    highlights: ["3 difficultés", "Labyrinthe différent à chaque partie", "Mini-carte"],
  },
  {
    slug: "colosses",
    title: "Colosses",
    cover: "/covers/colosses/affiche.webp",
    description:
      "Combat 1 contre 1 : quatre combattants, trois rounds, des directs, des coups de pied et un coup sp\u00e9cial qui retourne un match. Contre l'ordinateur ou \u00e0 deux sur le m\u00eame clavier.",
    emoji: "\u2694\ufe0f",
    gradient: "from-rose-900 to-slate-950",
    genre: "Combat",
    players: "Solo ou 2 joueurs",
    duration: "3 \u00e0 6 min",
    highlights: ["4 combattants, 4 coups sp\u00e9ciaux", "\u00c0 deux sur un seul clavier", "Garde, esquive et combos"],
  },
  {
    slug: "duel-1v1",
    title: "Duel — Arène de tir",
    description:
      "Tir à la première personne : treize armes, cinq cartes et sept modes — battle royale à 30, 1v1 construction, duel en ligne avec un code, match à mort, course à l'armement, économie et stand d'entraînement.",
    emoji: "🎯",
    cover: "/covers/duel.svg",
    gradient: "from-cyan-700 to-slate-950",
    genre: "Tir",
    players: "Solo ou 1 contre 1",
    duration: "5 à 15 min",
    highlights: [
      "Battle royale à 30",
      "1v1 construction",
      "13 armes, skins et danses",
      "En ligne avec un code",
    ],
    featured: true,
  },
  {
    slug: "manoir-maudit",
    title: "Le Manoir Maudit",
    description:
      "Trente pièces sur deux étages, des portes fermées à clé, un code gravé dans les murs et cinq reliques à rassembler. Elle ne sait pas où tu es : elle t'entend. Marche courbée, cache-toi dans les armoires, lance une pièce pour l'attirer ailleurs — et prie pour qu'elle ne t'ait pas vu entrer.",
    emoji: "🕯️",
    gradient: "from-red-950 to-black",
    genre: "Horreur",
    players: "Solo",
    duration: "20 à 35 min",
    highlights: [
      "30 pièces, 2 étages",
      "Inventaire, clés et notes",
      "Elle entend chaque bruit",
      "Rituel, sceaux et fuite",
    ],
    featured: true,
  },
  {
    slug: "backrooms",
    title: "Backrooms",
    description:
      "Tu as traversé le sol par accident. Des couloirs jaunes à perte de vue, le bourdonnement des néons, et dix niveaux dont il faut trouver la sortie : le Hall, la Zone habitable, la Tuyauterie, la Centrale, les Bureaux, les Piscines, un couloir où il ne reste qu'à courir, un hôtel où quelqu'un porte un visage volé, le noir complet… et une fête où tout le monde sourit.",
    emoji: "🟨",
    gradient: "from-yellow-600 to-stone-900",
    genre: "Horreur",
    players: "Solo ou groupe de 4",
    duration: "40 à 70 min",
    highlights: ["Groupe avec code et vocal", "Elles entendent ta voix", "10 niveaux", "Style caméscope VHS"],
    featured: true,
  },
];

export type MazeDifficulty = "facile" | "difficile" | "hardcore";

export interface MazeDifficultyConfig {
  id: MazeDifficulty;
  label: string;
  description: string;
  roomsW: number;
  roomsH: number;
  minimapRevealRadius: number;
}

export const MAZE_DIFFICULTIES: MazeDifficultyConfig[] = [
  {
    id: "facile",
    label: "Facile",
    description: "Un petit labyrinthe pour s'échauffer.",
    roomsW: 5,
    roomsH: 5,
    minimapRevealRadius: 3,
  },
  {
    id: "difficile",
    label: "Difficile",
    description: "Un vrai labyrinthe, long et plein d'embranchements.",
    roomsW: 9,
    roomsH: 9,
    minimapRevealRadius: 2,
  },
  {
    id: "hardcore",
    label: "Hardcore",
    description: "Immense, et la mini-carte ne révèle presque rien autour de toi.",
    roomsW: 13,
    roomsH: 13,
    minimapRevealRadius: 1,
  },
];

// Petit generateur pseudo-aleatoire (seed variable) pour que chaque partie
// propose un vrai nouveau labyrinthe, tout en ayant vraiment plusieurs
// passages/embranchements (algorithme "recursive backtracker" classique).
function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function generateMaze(roomsW: number, roomsH: number, seed: number): MazeData {
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

export function getGame3D(slug: string): Game3D | undefined {
  return GAMES_3D.find((g) => g.slug === slug);
}

/** Les jeux reellement jouables, sans les annonces verrouillees. */
export function playableGames3D(): Game3D[] {
  return GAMES_3D.filter((g) => !g.locked);
}
