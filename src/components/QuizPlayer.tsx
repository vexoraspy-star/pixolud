"use client";

import { useEffect, useRef, useState } from "react";
import type { QuizData } from "@/lib/quiz";
import { createClient } from "@/lib/supabase/client";

export default function QuizPlayer({
  data,
  gameId,
  countsAsPlay = false,
}: {
  data: QuizData;
  gameId?: string;
  countsAsPlay?: boolean;
}) {
  const [index, setIndex] = useState(0);
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

  const question = data.questions[index];

  function handleAnswer(i: number) {
    if (selected !== null) return;
    setSelected(i);
    if (i === question.correctIndex) setScore((s) => s + 1);
  }

  function next() {
    if (index + 1 >= data.questions.length) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="text-4xl">🎉</span>
        <p className="text-lg font-bold text-zinc-900 dark:text-white">
          Score final : {score} / {data.questions.length}
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
        <span>
          Question {index + 1} / {data.questions.length}
        </span>
        <span>Score : {score}</span>
      </div>

      <h2 className="text-center text-lg font-semibold text-zinc-900 dark:text-white">
        {question.question}
      </h2>

      <div className="flex w-full flex-col gap-2">
        {question.options.map((opt, i) => {
          const isCorrect = i === question.correctIndex;
          const isSelected = selected === i;
          let style =
            "border-zinc-300 bg-white hover:border-violet-400 dark:border-zinc-700 dark:bg-zinc-900";
          if (selected !== null) {
            if (isCorrect) {
              style = "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30";
            } else if (isSelected) {
              style = "border-rose-500 bg-rose-50 dark:bg-rose-900/30";
            }
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleAnswer(i)}
              disabled={selected !== null}
              className={`rounded-lg border px-4 py-3 text-left text-sm font-medium text-zinc-800 transition-colors dark:text-zinc-100 ${style}`}
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
          className="rounded-full bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
        >
          {index + 1 >= data.questions.length ? "Voir le score" : "Question suivante"}
        </button>
      )}
    </div>
  );
}
