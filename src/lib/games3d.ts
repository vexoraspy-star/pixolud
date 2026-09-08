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

const MAZE_DATA_BY_SLUG: Record<string, MazeData> = {
  "labyrinthe-legendaire": {
    width: 8,
    height: 8,
    walls: [
      [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1],
      [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3],
      [0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5],
    ],
    start: [0, 0],
    end: [7, 7],
  },
};

export function getGame3D(slug: string): Game3D | undefined {
  return GAMES_3D.find((g) => g.slug === slug);
}

export function getMaze3DData(slug: string): MazeData | undefined {
  return MAZE_DATA_BY_SLUG[slug];
}
