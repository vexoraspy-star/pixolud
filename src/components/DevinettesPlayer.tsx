"use client";

import { useEffect, useRef, useState } from "react";
import { isCorrectGuess, type DevinettesData } from "@/lib/devinettes";
import { createClient } from "@/lib/supabase/client";

export default function DevinettesPlayer({
  data,
  gameId,
  countsAsPlay = false,
}: {
  data: DevinettesData;
  gameId?: string;
  countsAsPlay?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [clueIndex, setClueIndex] = useState(0);
  const [guess, setGuess] = useState("");
  const [status, setStatus] = useState<"guessing" | "correct" | "revealed">("guessing");
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const hasCountedPlay = useRef(false);

  useEffect(() => {
    if (!countsAsPlay || !gameId || hasCountedPlay.current) return;
    hasCountedPlay.current = true;
    const supabase = createClient();
    supabase.rpc("increment_plays", { game_id: gameId });
  }, [countsAsPlay, gameId]);

  const round = data.rounds[index];

  function submitGuess() {
    if (status !== "guessing" || !guess.trim()) return;
    if (isCorrectGuess(guess, round.answer)) {
      setStatus("correct");
      setScore((s) => s + 1);
    } else if (clueIndex + 1 < round.clues.length) {
      setClueIndex((i) => i + 1);
      setGuess("");
    } else {
      setStatus("revealed");
    }
  }

  function giveUp() {
    setStatus("revealed");
  }

  function next() {
    if (index + 1 >= data.rounds.length) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
    setClueIndex(0);
    setGuess("");
    setStatus("guessing");
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-gradient-to-br from-sky-50 to-indigo-50 px-10 py-8 text-center shadow-inner dark:from-sky-950/30 dark:to-indigo-950/30">
        <span className="text-5xl">🔍</span>
        <p className="text-xl font-bold text-zinc-900 dark:text-white">
          Score final : {score} / {data.rounds.length}
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-4 rounded-3xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950">
      <div className="flex w-full items-center justify-between">
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-600 shadow-sm dark:bg-zinc-800 dark:text-zinc-300">
          Devinette {index + 1} / {data.rounds.length}
        </span>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-sky-600 shadow-sm dark:bg-zinc-800 dark:text-sky-400">
          Score : {score}
        </span>
      </div>

      <div className="flex w-full flex-col gap-2">
        {round.clues.slice(0, clueIndex + 1).map((clue, i) => (
          <p
            key={i}
            className="rounded-xl bg-sky-50 px-4 py-2.5 text-sm text-zinc-700 dark:bg-sky-950/30 dark:text-zinc-200"
          >
            💡 {clue}
          </p>
        ))}
      </div>

      {status === "guessing" && (
        <>
          <input
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitGuess()}
            placeholder="Ta réponse..."
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
          />
          <div className="flex w-full gap-2">
            <button
              type="button"
              onClick={submitGuess}
              disabled={!guess.trim()}
              className="flex-1 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-600/30 transition hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Valider
            </button>
            <button
              type="button"
              onClick={giveUp}
              className="shrink-0 rounded-full border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Abandonner
            </button>
          </div>
        </>
      )}

      {status === "correct" && (
        <>
          <p className="text-lg font-bold text-emerald-600">
            🎉 Bravo ! C&apos;était bien « {round.answer} ».
          </p>
          <button
            type="button"
            onClick={next}
            className="rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-600/30 transition hover:scale-105 active:scale-95"
          >
            {index + 1 >= data.rounds.length ? "Voir le score" : "Devinette suivante"}
          </button>
        </>
      )}

      {status === "revealed" && (
        <>
          <p className="text-lg font-bold text-rose-500">
            La réponse était « {round.answer} ».
          </p>
          <button
            type="button"
            onClick={next}
            className="rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-600/30 transition hover:scale-105 active:scale-95"
          >
            {index + 1 >= data.rounds.length ? "Voir le score" : "Devinette suivante"}
          </button>
        </>
      )}
    </div>
  );
}
