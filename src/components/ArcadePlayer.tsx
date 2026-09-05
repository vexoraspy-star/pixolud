"use client";

import { useEffect, useRef, useState } from "react";
import type { ArcadeData } from "@/lib/arcade";
import { createClient } from "@/lib/supabase/client";

export default function ArcadePlayer({
  data,
  gameId,
  countsAsPlay = false,
}: {
  data: ArcadeData;
  gameId?: string;
  countsAsPlay?: boolean;
}) {
  const [started, setStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(data.duration);
  const [score, setScore] = useState(0);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const hasCountedPlay = useRef(false);

  useEffect(() => {
    if (!started || timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [started, timeLeft]);

  useEffect(() => {
    if (!countsAsPlay || !gameId || hasCountedPlay.current || !started) return;
    hasCountedPlay.current = true;
    const supabase = createClient();
    supabase.rpc("increment_plays", { game_id: gameId });
  }, [countsAsPlay, gameId, started]);

  function moveTarget() {
    setPos({
      x: 8 + Math.random() * 84,
      y: 8 + Math.random() * 84,
    });
  }

  function start() {
    setStarted(true);
    setTimeLeft(data.duration);
    setScore(0);
    moveTarget();
  }

  function handleHit() {
    setScore((s) => s + 1);
    moveTarget();
  }

  if (!started) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="animate-bounce text-6xl drop-shadow-sm">{data.targetEmoji}</span>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Clique un maximum de fois sur {data.targetEmoji} en {data.duration}{" "}
          secondes.
        </p>
        <button
          type="button"
          onClick={start}
          className="rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-600/30 transition hover:scale-105 hover:shadow-lg active:scale-95"
        >
          Démarrer
        </button>
      </div>
    );
  }

  if (timeLeft <= 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 px-10 py-8 text-center shadow-inner dark:from-emerald-950/30 dark:to-teal-950/30">
        <span className="text-5xl">🎉</span>
        <p className="text-xl font-bold text-zinc-900 dark:text-white">
          Score final : {score}
        </p>
        <button
          type="button"
          onClick={start}
          className="mt-1 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-600/30 transition hover:scale-105 hover:shadow-lg active:scale-95"
        >
          Rejouer
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex w-full max-w-md items-center justify-between">
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-600 shadow-sm dark:bg-zinc-800 dark:text-zinc-300">
          ⏱️ {timeLeft}s
        </span>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-violet-600 shadow-sm dark:bg-zinc-800 dark:text-violet-400">
          Score : {score}
        </span>
      </div>
      <div className="relative h-72 w-full max-w-md overflow-hidden rounded-3xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-100 shadow-inner dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950">
        <button
          type="button"
          onClick={handleHit}
          className="absolute flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center text-3xl drop-shadow transition-[left,top,transform] duration-150 hover:scale-110 active:scale-90"
          style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
        >
          <span className="absolute inset-0 -z-10 animate-pulse rounded-full bg-violet-400/20 blur-md" />
          {data.targetEmoji}
        </button>
      </div>
    </div>
  );
}
