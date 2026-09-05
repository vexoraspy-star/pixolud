export const ARCADE_TARGET_OPTIONS = ["🎯", "👾", "🐛", "🦟", "⚡", "🍭"];
export const ARCADE_DURATIONS = [15, 30, 45, 60];

export interface ArcadeData {
  duration: number;
  targetEmoji: string;
}

export function emptyArcade(): ArcadeData {
  return { duration: 30, targetEmoji: "🎯" };
}

export function isArcadePlayable(data: ArcadeData): boolean {
  return !!data && data.duration > 0 && !!data.targetEmoji;
}
