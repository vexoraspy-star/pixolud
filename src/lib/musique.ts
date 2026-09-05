export const MUSIQUE_LANE_KEYS = ["D", "F", "J", "K"];
export const MUSIQUE_LANES = MUSIQUE_LANE_KEYS.length;

// Do-Mi-Sol-Do (accord parfait), une note par piste — permet de composer une
// petite mélodie originale, 100% libre de droits (générée par synthèse audio,
// pas un fichier de musique existant).
export const MUSIQUE_LANE_FREQS = [261.63, 329.63, 392.0, 523.25];

export const MUSIQUE_LENGTHS = [
  { label: "Court", value: 16 },
  { label: "Moyen", value: 24 },
  { label: "Long", value: 32 },
];

export const MUSIQUE_PRESETS: { label: string; length: number; notes: [number, number][] }[] = [
  {
    label: "Petite Mélodie",
    length: 16,
    notes: [
      [0, 0], [2, 1], [4, 2], [6, 3],
      [8, 3], [10, 2], [12, 1], [14, 0],
    ],
  },
  {
    label: "Rythme Rapide",
    length: 16,
    notes: [
      [0, 0], [1, 1], [2, 2], [3, 3],
      [4, 0], [5, 1], [6, 2], [7, 3],
      [8, 0], [9, 1], [10, 2], [11, 3],
      [12, 0], [13, 1], [14, 2], [15, 3],
    ],
  },
  {
    label: "Berceuse",
    length: 24,
    notes: [
      [0, 0], [4, 2], [8, 1], [12, 3], [16, 0], [20, 2],
    ],
  },
];

export interface MusiqueData {
  length: number;
  notes: [number, number][];
}

export function emptyMusique(): MusiqueData {
  return { length: 16, notes: [] };
}

export function isMusiquePlayable(data: MusiqueData): boolean {
  return (
    typeof data?.length === "number" &&
    data.length > 0 &&
    Array.isArray(data.notes) &&
    data.notes.length > 0 &&
    data.notes.every(
      (n) =>
        Array.isArray(n) &&
        n.length === 2 &&
        n[0] >= 0 &&
        n[0] < data.length &&
        n[1] >= 0 &&
        n[1] < MUSIQUE_LANES,
    )
  );
}
