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
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Clique un maximum de fois sur {data.targetEmoji} en {data.duration}{" "}
          secondes.
        </p>
        <button
          type="button"
          onClick={start}
          className="rounded-full bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
        >
          Démarrer
        </button>
      </div>
    );
  }

  if (timeLeft <= 0) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="text-4xl">🎉</span>
        <p className="text-lg font-bold text-zinc-900 dark:text-white">
          Score final : {score}
        </p>
        <button
          type="button"
          onClick={start}
          className="rounded-full bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
        >
          Rejouer
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex w-full max-w-md items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
        <span>⏱️ {timeLeft}s</span>
        <span>Score : {score}</span>
      </div>
      <div className="relative h-72 w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
        <button
          type="button"
          onClick={handleHit}
          className="absolute flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center text-3xl transition-[left,top] duration-150"
          style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
        >
          {data.targetEmoji}
        </button>
      </div>
    </div>
  );
}
