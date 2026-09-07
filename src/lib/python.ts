export interface PythonExercise {
  id: string;
  instructions: string;
  starterCode: string;
  expectedOutput: string;
}

export interface PythonData {
  intro: string;
  exercises: PythonExercise[];
}

export function emptyPython(): PythonData {
  return { intro: "", exercises: [] };
}

export function newPythonExercise(): PythonExercise {
  return {
    id: crypto.randomUUID(),
    instructions: "",
    starterCode: "",
    expectedOutput: "",
  };
}

function isExerciseValid(e: PythonExercise): boolean {
  return (
    typeof e?.instructions === "string" &&
    e.instructions.trim() !== "" &&
    typeof e.expectedOutput === "string" &&
    e.expectedOutput.trim() !== ""
  );
}

export function isPythonPlayable(data: PythonData): boolean {
  return (
    !!data &&
    Array.isArray(data.exercises) &&
    data.exercises.length > 0 &&
    data.exercises.every(isExerciseValid)
  );
}
