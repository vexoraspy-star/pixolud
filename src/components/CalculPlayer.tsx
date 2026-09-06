"use client";

import { useEffect, useRef, useState } from "react";
import { generateQuestion, type CalculData, type CalculQuestion } from "@/lib/calcul";
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
  const [index, setIndex] = useState(0);
  const [question, setQuestion] = useState<CalculQuestion>(() =>
    generateQuestion(data.difficulty, data.operations),
  );
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

  function handleAnswer(value: number) {
    if (selected !== null) return;
    setSelected(value);
    if (value === question.answer) setScore((s) => s + 1);
  }

  function next() {
    if (index + 1 >= data.questionCount) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
    setQuestion(generateQuestion(data.difficulty, data.operations));
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-gradient-to-br from-lime-50 to-emerald-50 px-10 py-8 text-center shadow-inner dark:from-lime-950/30 dark:to-emerald-950/30">
        <span className="text-5xl">🧮</span>
        <p className="text-xl font-bold text-zinc-900 dark:text-white">
          Score final : {score} / {data.questionCount}
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-4 rounded-3xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950">
      <div className="flex w-full items-center justify-between">
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-600 shadow-sm dark:bg-zinc-800 dark:text-zinc-300">
          Question {index + 1} / {data.questionCount}
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
          {index + 1 >= data.questionCount ? "Voir le score" : "Question suivante"}
        </button>
      )}
    </div>
  );
}
