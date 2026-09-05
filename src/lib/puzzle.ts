export const PUZZLE_EMOJI_POOL = [
  "🍎", "🍌", "🍇", "🍉", "🍓", "🍒", "🥝", "🍍",
  "🥕", "🌽", "🍕", "🍔", "⚽", "🏀", "🎈", "🎲",
];

export interface PuzzleData {
  symbols: string[];
}

export function emptyPuzzle(): PuzzleData {
  return { symbols: [] };
}

export function isPuzzlePlayable(data: PuzzleData): boolean {
  return (
    Array.isArray(data?.symbols) && data.symbols.length >= 3 && data.symbols.length <= 8
  );
}
