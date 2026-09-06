"use client";

import { useEffect, useRef, useState } from "react";
import type { RunnerData } from "@/lib/runner";
import { createClient } from "@/lib/supabase/client";

const TICK_MS = 550;
const JUMP_MS = 700;
const VISIBLE_CELLS = 7;

export default function RunnerPlayer({
  data,
  gameId,
  countsAsPlay = false,
}: {
  data: RunnerData;
  gameId?: string;
  countsAsPlay?: boolean;
}) {
  const [pos, setPos] = useState(0);
  const [isJumping, setIsJumping] = useState(false);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const isJumpingRef = useRef(false);
  const hasCountedPlay = useRef(false);
  const obstacleSet = new Set(data.obstacles);

  useEffect(() => {
    if (!countsAsPlay || !gameId || hasCountedPlay.current) return;
    hasCountedPlay.current = true;
    const supabase = createClient();
    supabase.rpc("increment_plays", { game_id: gameId });
  }, [countsAsPlay, gameId]);

  useEffect(() => {
    if (status !== "playing") return;
    const interval = setInterval(() => {
      setPos((p) => {
        const next = p + 1;
        if (obstacleSet.has(next) && !isJumpingRef.current) {
          setStatus("lost");
          return next;
        }
        if (next >= data.length - 1) {
          setStatus("won");
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, data.length]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (status !== "playing") return;
      if (e.key !== "ArrowUp" && e.code !== "Space") return;
      e.preventDefault();
      if (isJumpingRef.current) return;
      isJumpingRef.current = true;
      setIsJumping(true);
      setTimeout(() => {
        isJumpingRef.current = false;
        setIsJumping(false);
      }, JUMP_MS);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [status]);

  function restart() {
    setPos(0);
    setIsJumping(false);
    isJumpingRef.current = false;
    setStatus("playing");
  }

  if (status === "won") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 px-10 py-8 text-center shadow-inner dark:from-emerald-950/30 dark:to-teal-950/30">
        <span className="text-5xl">🎉</span>
        <p className="text-xl font-bold text-zinc-900 dark:text-white">
          Parcours terminé !
        </p>
        <button
          type="button"
          onClick={restart}
          className="rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-600/30 transition hover:scale-105 active:scale-95"
        >
          Rejouer
        </button>
      </div>
    );
  }

  if (status === "lost") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-gradient-to-br from-rose-50 to-red-50 px-10 py-8 text-center shadow-inner dark:from-rose-950/30 dark:to-red-950/30">
        <span className="text-5xl">💥</span>
        <p className="text-xl font-bold text-zinc-900 dark:text-white">
          Touché ! Distance parcourue : {pos}
        </p>
        <button
          type="button"
          onClick={restart}
          className="rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-600/30 transition hover:scale-105 active:scale-95"
        >
          Réessayer
        </button>
      </div>
    );
  }

  const windowCells = Array.from({ length: VISIBLE_CELLS }, (_, i) => pos + i);

  return (
    <div className="flex flex-col items-center gap-4">
      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-600 shadow-sm dark:bg-zinc-800 dark:text-zinc-300">
        Distance : {pos} / {data.length - 1}
      </span>
      <div className="relative h-40 w-full max-w-md overflow-hidden rounded-3xl border border-zinc-200 bg-gradient-to-b from-sky-100 via-sky-50 to-zinc-100 shadow-inner sm:h-48 dark:border-zinc-800 dark:from-zinc-900 dark:via-zinc-900 dark:to-black">
        <div className="absolute inset-x-2 bottom-2 flex gap-1">
          {windowCells.map((cellPos, i) => {
            const isObstacle = obstacleSet.has(cellPos);
            const isFinish = cellPos === data.length - 1;
            const isPlayerHere = i === 0;
            return (
              <div
                key={cellPos}
                className={`relative flex size-12 shrink-0 items-center justify-center rounded-md text-xl shadow-sm sm:size-14 ${
                  isFinish
                    ? "bg-gradient-to-br from-rose-100 to-rose-200 dark:from-rose-900/50 dark:to-rose-950/50"
                    : isObstacle
                      ? "bg-gradient-to-br from-zinc-600 to-zinc-800 dark:from-zinc-600 dark:to-zinc-800"
                      : "bg-white/70 dark:bg-zinc-950/70"
                }`}
              >
                {isFinish && !isPlayerHere ? "🏁" : ""}
                {isObstacle && !isPlayerHere ? "🪨" : ""}
                {isPlayerHere && (
                  <span
                    className={`absolute text-2xl drop-shadow transition-transform duration-200 ${
                      isJumping ? "-translate-y-16" : ""
                    }`}
                  >
                    🦔
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-zinc-400">
        ESPACE ou ↑ pour sauter par-dessus les obstacles 🪨.
      </p>
    </div>
  );
}
