export type Operation = "addition" | "soustraction" | "multiplication" | "division";
export type Difficulty = "facile" | "moyen" | "difficile";

export interface CalculData {
  difficulty: Difficulty;
  operations: Operation[];
  questionCount: number;
}

export const OPERATIONS: Operation[] = ["addition", "soustraction", "multiplication", "division"];

export const OPERATION_META: Record<Operation, { label: string; symbol: string }> = {
  addition: { label: "Addition", symbol: "+" },
  soustraction: { label: "Soustraction", symbol: "−" },
  multiplication: { label: "Multiplication", symbol: "×" },
  division: { label: "Division", symbol: "÷" },
};

export const DIFFICULTIES: Difficulty[] = ["facile", "moyen", "difficile"];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  facile: "Facile",
  moyen: "Moyen",
  difficile: "Difficile",
};

export const QUESTION_COUNT_OPTIONS = [5, 10, 15, 20];

export function emptyCalcul(): CalculData {
  return { difficulty: "facile", operations: ["addition"], questionCount: 10 };
}

export function isCalculPlayable(data: CalculData): boolean {
  return (
    !!data &&
    DIFFICULTIES.includes(data.difficulty) &&
    Array.isArray(data.operations) &&
    data.operations.length > 0 &&
    data.operations.every((o) => OPERATIONS.includes(o)) &&
    typeof data.questionCount === "number" &&
    data.questionCount > 0
  );
}

const RANGES: Record<Difficulty, { addSub: [number, number]; multDiv: [number, number] }> = {
  facile: { addSub: [1, 10], multDiv: [1, 5] },
  moyen: { addSub: [10, 60], multDiv: [2, 12] },
  difficile: { addSub: [50, 200], multDiv: [5, 20] },
};

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface CalculQuestion {
  label: string;
  answer: number;
  options: number[];
}

export function generateQuestion(difficulty: Difficulty, operations: Operation[]): CalculQuestion {
  const op = operations[randInt(0, operations.length - 1)];
  const range = RANGES[difficulty];
  let a: number;
  let b: number;
  let answer: number;

  if (op === "addition") {
    a = randInt(...range.addSub);
    b = randInt(...range.addSub);
    answer = a + b;
  } else if (op === "soustraction") {
    a = randInt(...range.addSub);
    b = randInt(0, a);
    answer = a - b;
  } else if (op === "multiplication") {
    a = randInt(...range.multDiv);
    b = randInt(...range.multDiv);
    answer = a * b;
  } else {
    b = randInt(...range.multDiv);
    const quotient = randInt(...range.multDiv);
    a = b * quotient;
    answer = quotient;
  }

  const wrongOptions = new Set<number>();
  let guardCount = 0;
  while (wrongOptions.size < 2 && guardCount < 50) {
    guardCount += 1;
    const spread = Math.max(2, Math.round(Math.abs(answer) * 0.2) || 2);
    const delta = randInt(-spread, spread);
    const candidate = answer + (delta === 0 ? spread : delta);
    if (candidate !== answer && candidate >= 0 && !wrongOptions.has(candidate)) {
      wrongOptions.add(candidate);
    }
  }
  while (wrongOptions.size < 2) {
    wrongOptions.add(answer + wrongOptions.size + 1);
  }

  return {
    label: `${a} ${OPERATION_META[op].symbol} ${b}`,
    answer,
    options: shuffle([answer, ...wrongOptions]),
  };
}
