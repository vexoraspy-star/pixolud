export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export interface QuizData {
  questions: QuizQuestion[];
}

export function emptyQuiz(): QuizData {
  return { questions: [] };
}

function isQuestionValid(q: QuizQuestion): boolean {
  return (
    typeof q?.question === "string" &&
    q.question.trim() !== "" &&
    Array.isArray(q.options) &&
    q.options.length === 4 &&
    q.options.every((o) => typeof o === "string" && o.trim() !== "") &&
    typeof q.correctIndex === "number" &&
    q.correctIndex >= 0 &&
    q.correctIndex < 4
  );
}

export function isQuizPlayable(quiz: QuizData): boolean {
  return (
    Array.isArray(quiz?.questions) &&
    quiz.questions.length > 0 &&
    quiz.questions.every(isQuestionValid)
  );
}

export function newQuestion(): QuizQuestion {
  return {
    id: crypto.randomUUID(),
    question: "",
    options: ["", "", "", ""],
    correctIndex: 0,
  };
}
