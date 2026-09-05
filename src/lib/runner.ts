export const RUNNER_LENGTHS = [
  { label: "Court", value: 15 },
  { label: "Moyen", value: 25 },
  { label: "Long", value: 35 },
];

export const RUNNER_LENGTH_MAX = { label: "Épique 👑", value: 50 };

export interface RunnerData {
  length: number;
  obstacles: number[];
}

export function emptyRunner(): RunnerData {
  return { length: 15, obstacles: [] };
}

export function isRunnerPlayable(data: RunnerData): boolean {
  return (
    typeof data?.length === "number" &&
    data.length > 0 &&
    Array.isArray(data.obstacles) &&
    data.obstacles.every((o) => o > 0 && o < data.length - 1)
  );
}
