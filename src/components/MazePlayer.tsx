"use client";

import { useEffect, useRef, useState } from "react";
import { cellKey, type MazeData } from "@/lib/maze";
import { createClient } from "@/lib/supabase/client";

export default function MazePlayer({
  data,
  gameId,
  countsAsPlay = false,
}: {
  data: MazeData;
  gameId?: string;
  countsAsPlay?: boolean;
}) {
  const start = data.start ?? [0, 0];
  const [pos, setPos] = useState<[number, number]>(start);
  const [won, setWon] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const hasCountedPlay = useRef(false);
  const wallSet = new Set(data.walls.map(([x, y]) => cellKey(x, y)));

  useEffect(() => {
    if (won) return;
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [won]);

  useEffect(() => {
    if (!countsAsPlay || !gameId || hasCountedPlay.current) return;
    hasCountedPlay.current = true;
    const supabase = createClient();
    supabase.rpc("increment_plays", { game_id: gameId });
  }, [countsAsPlay, gameId]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (won) return;
      const [x, y] = pos;
      let next: [number, number] | null = null;
      if (e.key === "ArrowUp") next = [x, y - 1];
      else if (e.key === "ArrowDown") next = [x, y + 1];
      else if (e.key === "ArrowLeft") next = [x - 1, y];
      else if (e.key === "ArrowRight") next = [x + 1, y];
      if (!next) return;

      const [nx, ny] = next;
      if (nx < 0 || ny < 0 || nx >= data.width || ny >= data.height) return;
      if (wallSet.has(cellKey(nx, ny))) return;

      e.preventDefault();
      setPos(next);
      if (data.end && cellKey(nx, ny) === cellKey(...data.end)) {
        setWon(true);
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, won, data]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-600 shadow-sm dark:bg-zinc-800 dark:text-zinc-300">
          ⏱️ {seconds}s
        </span>
        {won && (
          <span className="animate-bounce rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 px-3 py-1 text-xs font-bold text-white shadow-md shadow-emerald-500/30">
            🎉 Gagné !
          </span>
        )}
      </div>

      <div
        className="grid gap-1 rounded-3xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-zinc-200 p-2 shadow-inner dark:border-zinc-800 dark:from-zinc-900 dark:to-black"
        style={{ gridTemplateColumns: `repeat(${data.width}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: data.height }).map((_, y) =>
          Array.from({ length: data.width }).map((_, x) => {
            const key = cellKey(x, y);
            const isWall = wallSet.has(key);
            const isPlayer = pos[0] === x && pos[1] === y;
            const isEnd = data.end && cellKey(...data.end) === key;
            return (
              <div
                key={key}
                className={`flex size-8 items-center justify-center rounded-md text-base transition-colors duration-150 sm:size-10 sm:text-lg ${
                  isWall
                    ? "bg-gradient-to-br from-zinc-600 to-zinc-800 shadow-sm dark:from-zinc-500 dark:to-zinc-700"
                    : isEnd
                      ? "bg-gradient-to-br from-rose-100 to-rose-200 shadow-inner dark:from-rose-900/50 dark:to-rose-950/50"
                      : "bg-white shadow-sm dark:bg-zinc-950"
                }`}
              >
                {isPlayer ? (
                  <span className="block size-4 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 shadow-[0_0_10px_rgba(139,92,246,0.8)] transition-transform duration-150 sm:size-5" />
                ) : isEnd ? (
                  "🏁"
                ) : (
                  ""
                )}
              </div>
            );
          }),
        )}
      </div>

      <p className="text-xs text-zinc-400">Utilise les flèches du clavier pour te déplacer.</p>
    </div>
  );
}
