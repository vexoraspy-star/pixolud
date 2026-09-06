"use client";

import { useEffect, useRef, useState } from "react";
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  generateQuestion,
  OPERATIONS,
  OPERATION_META,
  QUESTION_COUNT_OPTIONS,
  type CalculData,
  type CalculQuestion,
  type Difficulty,
  type Operation,
} from "@/lib/calcul";
import { createClient } from "@/lib/supabase/client";

export default function CalculPlayer({
  data,
  gameId,
  countsAsPlay = false,
}: {
  data: CalculData;
  gameId?: string;
  countsAsPlay?: boolean;
}) {
  const [started, setStarted] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>(data.difficulty ?? "facile");
  const [operations, setOperations] = useState<Operation[]>(data.operations);
  const [questionCount, setQuestionCount] = useState(data.questionCount);

  const [index, setIndex] = useState(0);
  const [question, setQuestion] = useState<CalculQuestion | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const hasCountedPlay = useRef(false);

  useEffect(() => {
    if (!countsAsPlay || !gameId || hasCountedPlay.current) return;
    hasCountedPlay.current = true;
    const supabase = createClient();
    supabase.rpc("increment_plays", { game_id: gameId });
  }, [countsAsPlay, gameId]);

  function toggleOperation(op: Operation) {
    setOperations((prev) => {
      const has = prev.includes(op);
      if (has && prev.length === 1) return prev;
      return has ? prev.filter((o) => o !== op) : [...prev, op];
    });
  }

  function start() {
    setIndex(0);
    setScore(0);
    setSelected(null);
    setFinished(false);
    setQuestion(generateQuestion(difficulty, operations));
    setStarted(true);
  }

  function handleAnswer(value: number) {
    if (selected !== null || !question) return;
    setSelected(value);
    if (value === question.answer) setScore((s) => s + 1);
  }

  function next() {
    if (index + 1 >= questionCount) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
    setQuestion(generateQuestion(difficulty, operations));
  }

  if (!started) {
    return (
      <div className="flex w-full max-w-xl flex-col items-center gap-5 rounded-3xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950">
        <span className="text-4xl">🧮</span>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Choisis ta config avant de commencer.
        </p>

        <div className="w-full">
          <p className="mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Difficulté</p>
          <div className="flex gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                  difficulty === d
                    ? "bg-lime-600 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {DIFFICULTY_LABELS[d]}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full">
          <p className="mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            Opérations (au moins une)
          </p>
          <div className="flex flex-wrap gap-2">
            {OPERATIONS.map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => toggleOperation(op)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium ${
                  operations.includes(op)
                    ? "bg-lime-600 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                <span>{OPERATION_META[op].symbol}</span>
                {OPERATION_META[op].label}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full">
          <p className="mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            Nombre de questions
          </p>
          <div className="flex gap-2">
            {QUESTION_COUNT_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setQuestionCount(n)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                  questionCount === n
                    ? "bg-lime-600 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={start}
          className="mt-2 w-full rounded-full bg-gradient-to-br from-lime-500 to-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/30 transition hover:scale-105 active:scale-95"
        >
          Commencer
        </button>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-gradient-to-br from-lime-50 to-emerald-50 px-10 py-8 text-center shadow-inner dark:from-lime-950/30 dark:to-emerald-950/30">
        <span className="text-5xl">🧮</span>
        <p className="text-xl font-bold text-zinc-900 dark:text-white">
          Score final : {score} / {questionCount}
        </p>
        <button
          type="button"
          onClick={() => setStarted(false)}
          className="mt-1 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-600/30 transition hover:scale-105 active:scale-95"
        >
          Rejouer avec une autre config
        </button>
      </div>
    );
  }

  if (!question) return null;

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-4 rounded-3xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950">
      <div className="flex w-full items-center justify-between">
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-600 shadow-sm dark:bg-zinc-800 dark:text-zinc-300">
          Question {index + 1} / {questionCount}
        </span>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-lime-600 shadow-sm dark:bg-zinc-800 dark:text-lime-400">
          Score : {score}
        </span>
      </div>

      <h2 className="text-center text-4xl font-bold text-zinc-900 dark:text-white">
        {question.label}
      </h2>

      <div className="grid w-full grid-cols-3 gap-3">
        {question.options.map((opt) => {
          const isCorrect = opt === question.answer;
          const isSelected = selected === opt;
          let style =
            "border-zinc-300 bg-white hover:border-lime-400 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900";
          if (selected !== null) {
            if (isCorrect) {
              style =
                "border-emerald-500 bg-gradient-to-r from-emerald-50 to-teal-50 shadow-md dark:from-emerald-900/30 dark:to-teal-900/30";
            } else if (isSelected) {
              style = "border-rose-500 bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-900/30 dark:to-red-900/30";
            }
          }
          return (
            <button
              key={opt}
              type="button"
              onClick={() => handleAnswer(opt)}
              disabled={selected !== null}
              className={`rounded-xl border px-4 py-4 text-center text-xl font-bold text-zinc-800 transition-all dark:text-zinc-100 ${style}`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <button
          type="button"
          onClick={next}
          className="rounded-full bg-gradient-to-br from-lime-500 to-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/30 transition hover:scale-105 active:scale-95"
        >
          {index + 1 >= questionCount ? "Voir le score" : "Question suivante"}
        </button>
      )}
    </div>
  );
}
