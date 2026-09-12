export const CATEGORIES = [
  "Plateforme",
  "Puzzle",
  "Arcade",
  "Labyrinthe",
  "Quiz",
  "Course",
  "Runner",
  "Musique",
  "Mélodie",
  "Calcul Mental",
  "Petit Bac",
  "Devinettes",
  "Éducation",
  "Python",
] as const;

export type GameCategory = (typeof CATEGORIES)[number];

export interface Game {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  authorId: string;
  authorPseudo: string;
  authorBadge: string | null;
  gradient: string;
  emoji: string;
  coverUrl: string | null;
  multiplayerMode: boolean;
  plays: number;
  createdAt: string;
  rating: number;
  ratingCount: number;
}

export interface Comment {
  id: string;
  gameId: string;
  authorId: string;
  authorPseudo: string;
  authorBadge: string | null;
  text: string;
  createdAt: string;
}
