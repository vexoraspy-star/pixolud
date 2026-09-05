export const ARENA_GRID_W = 32;
export const ARENA_GRID_H = 20;
export const ARENA_CELL_PX = 18;
export const ARENA_MOVE_MS = 150;
export const ARENA_GROWTH_TICKS = 15;
export const ARENA_STALE_MS = 4000;
export const ARENA_CHANNEL = "arena-global";

export const ARENA_CHARACTERS = ["🐍", "🦖", "🐲", "🚀", "👾", "🤖", "🐱", "🦊", "🐸", "🦄"];

export type Point = [number, number];

export interface ArenaBroadcastPayload {
  id: string;
  pseudo: string;
  emoji: string;
  segments: Point[];
  score: number;
  ts: number;
}
