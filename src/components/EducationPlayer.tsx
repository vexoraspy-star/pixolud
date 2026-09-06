"use client";

import { useEffect, useRef, useState } from "react";
import { SUBJECT_EMOJI, type EducationData } from "@/lib/education";
import { createClient } from "@/lib/supabase/client";

export default function EducationPlayer({
  data,
  gameId,
  countsAsPlay = false,
}: {
  data: EducationData;
  gameId?: string;
  countsAsPlay?: boolean;
}) {
  const [showingLesson, setShowingLesson] = useState(!!data.lesson.trim());
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

  if (showingLesson) {
    return (
      <div className="flex w-full max-w-xl flex-col items-center gap-4 rounded-3xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950">
        <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
          {SUBJECT_EMOJI[data.subject]} {data.subject}
        </span>
        <p className="w-full whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
          {data.lesson}
        </p>
        <button
          type="button"
          onClick={() => setShowingLesson(false)}
          className="rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-600/30 transition hover:scale-105 active:scale-95"
        >
          J&apos;ai lu, commencer le quiz →
        </button>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-gradient-to-br from-violet-50 to-fuchsia-50 px-10 py-8 text-center shadow-inner dark:from-violet-950/30 dark:to-fuchsia-950/30">
        <span className="text-5xl">🎓</span>
        <p className="text-xl font-bold text-zinc-900 dark:text-white">
          Score final : {score} / {data.questions.length}
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-4 rounded-3xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950">
      <div className="flex w-full items-center justify-between">
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-600 shadow-sm dark:bg-zinc-800 dark:text-zinc-300">
          {SUBJECT_EMOJI[data.subject]} Question {index + 1} / {data.questions.length}
        </span>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-violet-600 shadow-sm dark:bg-zinc-800 dark:text-violet-400">
          Score : {score}
        </span>
      </div>

      <h2 className="text-center text-lg font-semibold text-zinc-900 dark:text-white">
        {question.question}
      </h2>

      <div className="flex w-full flex-col gap-2">
        {question.options.map((opt, i) => {
          const isCorrect = i === question.correctIndex;
          const isSelected = selected === i;
          let style =
            "border-zinc-300 bg-white hover:border-violet-400 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900";
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
              key={i}
              type="button"
              onClick={() => handleAnswer(i)}
              disabled={selected !== null}
              className={`rounded-xl border px-4 py-3 text-left text-sm font-medium text-zinc-800 transition-all dark:text-zinc-100 ${style}`}
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
          className="rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-600/30 transition hover:scale-105 active:scale-95"
        >
          {index + 1 >= data.questions.length ? "Voir le score" : "Question suivante"}
        </button>
      )}
    </div>
  );
}
