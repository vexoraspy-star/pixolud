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
  if (maze?.start == null || maze?.end == null) return false;

  const wallSet = new Set(maze.walls.map(([x, y]) => cellKey(x, y)));
  const endKey = cellKey(...maze.end);
  if (wallSet.has(cellKey(...maze.start)) || wallSet.has(endKey)) return false;

  const visited = new Set([cellKey(...maze.start)]);
  const queue: [number, number][] = [maze.start];
  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    if (cellKey(x, y) === endKey) return true;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= maze.width || ny >= maze.height) continue;
      const key = cellKey(nx, ny);
      if (wallSet.has(key) || visited.has(key)) continue;
      visited.add(key);
      queue.push([nx, ny]);
    }
  }
  return false;
}

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}
