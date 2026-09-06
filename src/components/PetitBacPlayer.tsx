"use client";

import { useEffect, useRef, useState } from "react";
import { answerMatchesLetter, randomLetter, type PetitBacData } from "@/lib/petitBac";
import { createClient } from "@/lib/supabase/client";

type Phase = "idle" | "playing" | "result";

export default function PetitBacPlayer({
  data,
  gameId,
  countsAsPlay = false,
}: {
  data: PetitBacData;
  gameId?: string;
  countsAsPlay?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [letter, setLetter] = useState("A");
  const [answers, setAnswers] = useState<string[]>(() => data.categories.map(() => ""));
  const [timeLeft, setTimeLeft] = useState(data.roundSeconds);
  const hasCountedPlay = useRef(false);

  useEffect(() => {
    if (!countsAsPlay || !gameId || hasCountedPlay.current) return;
    hasCountedPlay.current = true;
    const supabase = createClient();
    supabase.rpc("increment_plays", { game_id: gameId });
  }, [countsAsPlay, gameId]);

  useEffect(() => {
    if (phase !== "playing") return;
    const interval = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          setPhase("result");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  function start() {
    setLetter(randomLetter());
    setAnswers(data.categories.map(() => ""));
    setTimeLeft(data.roundSeconds);
    setPhase("playing");
  }

  function updateAnswer(index: number, value: string) {
    setAnswers((prev) => prev.map((a, i) => (i === index ? value : a)));
  }

  if (phase === "idle") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 px-10 py-8 text-center shadow-inner dark:from-amber-950/30 dark:to-orange-950/30">
        <span className="text-5xl">📝</span>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Une lettre imposée tombe au hasard. Trouve un mot par catégorie
          avant la fin du temps ({data.roundSeconds}s) !
        </p>
        <button
          type="button"
          onClick={start}
          className="rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-600/30 transition hover:scale-105 active:scale-95"
        >
          Commencer
        </button>
      </div>
    );
  }

  if (phase === "result") {
    const validCount = answers.filter((a, i) => answerMatchesLetter(a, letter) && data.categories[i]).length;
    return (
      <div className="flex w-full max-w-lg flex-col items-center gap-4 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 px-6 py-8 text-center shadow-inner dark:from-amber-950/30 dark:to-orange-950/30">
        <span className="text-5xl">🎉</span>
        <p className="text-xl font-bold text-zinc-900 dark:text-white">
          Score : {validCount} / {data.categories.length}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Lettre imposée : <span className="font-bold text-violet-600">{letter}</span>
        </p>
        <ul className="flex w-full flex-col gap-1.5 text-left text-sm">
          {data.categories.map((cat, i) => {
            const ok = answerMatchesLetter(answers[i], letter);
            return (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2 dark:bg-zinc-900/50"
              >
                <span className="text-zinc-500 dark:text-zinc-400">{cat}</span>
                <span className={ok ? "font-semibold text-emerald-600" : "text-rose-500"}>
                  {answers[i].trim() || "—"} {ok ? "✅" : "❌"}
                </span>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={start}
          className="mt-1 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-600/30 transition hover:scale-105 active:scale-95"
        >
          Rejouer (nouvelle lettre)
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-lg flex-col items-center gap-4 rounded-3xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950">
      <div className="flex w-full items-center justify-between">
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-600 shadow-sm dark:bg-zinc-800 dark:text-zinc-300">
          ⏱️ {timeLeft}s
        </span>
        <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 text-lg font-bold text-white shadow-md">
          {letter}
        </span>
      </div>

      <div className="flex w-full flex-col gap-2">
        {data.categories.map((cat, i) => (
          <label key={i} className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
            {cat}
            <input
              value={answers[i]}
              onChange={(e) => updateAnswer(i, e.target.value)}
              placeholder={`Un mot commençant par ${letter}...`}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-normal text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
            />
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setPhase("result")}
        className="rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-600/30 transition hover:scale-105 active:scale-95"
      >
        J&apos;ai terminé !
      </button>
    </div>
  );
}
