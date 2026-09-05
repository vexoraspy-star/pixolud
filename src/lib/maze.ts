export const MAZE_WIDTH = 10;
export const MAZE_HEIGHT = 10;
export const MAZE_WIDTH_MAX = 16;
export const MAZE_HEIGHT_MAX = 14;

export interface MazeData {
  width: number;
  height: number;
  walls: [number, number][];
  start: [number, number] | null;
  end: [number, number] | null;
}

export function emptyMaze(big = false): MazeData {
  return {
    width: big ? MAZE_WIDTH_MAX : MAZE_WIDTH,
    height: big ? MAZE_HEIGHT_MAX : MAZE_HEIGHT,
    walls: [],
    start: null,
    end: null,
  };
}

export function isMazePlayable(maze: MazeData): boolean {
  return maze?.start != null && maze?.end != null;
}

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}
