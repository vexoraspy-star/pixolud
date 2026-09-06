export interface PetitBacData {
  categories: string[];
  roundSeconds: number;
}

export const ROUND_SECONDS_OPTIONS = [30, 60, 90, 120];

export const DEFAULT_CATEGORIES = [
  "Prénom",
  "Pays",
  "Animal",
  "Fruit ou légume",
  "Métier",
  "Objet",
];

export const MIN_CATEGORIES = 2;
export const MAX_CATEGORIES = 8;

export function emptyPetitBac(): PetitBacData {
  return { categories: [...DEFAULT_CATEGORIES], roundSeconds: 60 };
}

export function isPetitBacPlayable(data: PetitBacData): boolean {
  return (
    !!data &&
    Array.isArray(data.categories) &&
    data.categories.length >= MIN_CATEGORIES &&
    data.categories.every((c) => typeof c === "string" && c.trim() !== "") &&
    typeof data.roundSeconds === "number" &&
    data.roundSeconds > 0
  );
}

// Lettres courantes uniquement : evite de tomber sur K, Q, W, X, Y, Z qui
// rendent la plupart des categories trop difficiles a remplir.
const COMMON_LETTERS = "ABCDEFGHIJLMNOPRSTV".split("");

export function randomLetter(): string {
  return COMMON_LETTERS[Math.floor(Math.random() * COMMON_LETTERS.length)];
}

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function answerMatchesLetter(answer: string, letter: string): boolean {
  const trimmed = answer.trim();
  if (!trimmed) return false;
  return stripAccents(trimmed[0]).toUpperCase() === letter.toUpperCase();
}
