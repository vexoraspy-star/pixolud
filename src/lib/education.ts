export type Subject = "Histoire" | "Maths" | "Français" | "Anglais" | "Sciences" | "Informatique" | "Autre";

export const SUBJECTS: Subject[] = [
  "Histoire",
  "Maths",
  "Français",
  "Anglais",
  "Sciences",
  "Informatique",
  "Autre",
];

export const SUBJECT_EMOJI: Record<Subject, string> = {
  Histoire: "🏛️",
  Maths: "➗",
  Français: "📖",
  Anglais: "🇬🇧",
  Sciences: "🔬",
  Informatique: "💻",
  Autre: "🎓",
};

export interface EducationQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export interface EducationData {
  subject: Subject;
  lesson: string;
  questions: EducationQuestion[];
}

export function emptyEducation(): EducationData {
  return { subject: "Histoire", lesson: "", questions: [] };
}

export function newEducationQuestion(): EducationQuestion {
  return {
    id: crypto.randomUUID(),
    question: "",
    options: ["", "", "", ""],
    correctIndex: 0,
  };
}

function isQuestionValid(q: EducationQuestion): boolean {
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

export function isEducationPlayable(data: EducationData): boolean {
  return (
    !!data &&
    SUBJECTS.includes(data.subject) &&
    Array.isArray(data.questions) &&
    data.questions.length > 0 &&
    data.questions.every(isQuestionValid)
  );
}
