export interface DevinetteRound {
  id: string;
  answer: string;
  clues: string[];
}

export interface DevinettesData {
  rounds: DevinetteRound[];
}

export function emptyDevinettes(): DevinettesData {
  return { rounds: [] };
}

export function newRound(): DevinetteRound {
  return { id: crypto.randomUUID(), answer: "", clues: [""] };
}

function isRoundValid(r: DevinetteRound): boolean {
  return (
    typeof r?.answer === "string" &&
    r.answer.trim() !== "" &&
    Array.isArray(r.clues) &&
    r.clues.length > 0 &&
    r.clues.every((c) => typeof c === "string" && c.trim() !== "")
  );
}

export function isDevinettesPlayable(data: DevinettesData): boolean {
  return Array.isArray(data?.rounds) && data.rounds.length > 0 && data.rounds.every(isRoundValid);
}

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function isCorrectGuess(guess: string, answer: string): boolean {
  const g = normalize(guess);
  return g !== "" && g === normalize(answer);
}
