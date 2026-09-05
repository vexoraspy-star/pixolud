"use client";

import { useEffect, useRef, useState } from "react";
import { cellKey, type PlateformeData } from "@/lib/plateforme";
import { createClient } from "@/lib/supabase/client";

const TICK_MS = 220;

export default function PlateformePlayer({
  data,
  gameId,
  countsAsPlay = false,
}: {
  data: PlateformeData;
  gameId?: string;
  countsAsPlay?: boolean;
}) {
  const start = data.start ?? [0, 0];
  const [pos, setPos] = useState<[number, number]>(start);
  const [won, setWon] = useState(false);
  const [falls, setFalls] = useState(0);
  const hasCountedPlay = useRef(false);
  const platformSet = new Set(data.platforms.map(([x, y]) => cellKey(x, y)));

  useEffect(() => {
    if (!countsAsPlay || !gameId || hasCountedPlay.current) return;
    hasCountedPlay.current = true;
    const supabase = createClient();
    supabase.rpc("increment_plays", { game_id: gameId });
  }, [countsAsPlay, gameId]);

  // Gravité : à chaque tick, si aucune plateforme sous le joueur, il tombe.
  useEffect(() => {
    if (won) return;
    const interval = setInterval(() => {
      setPos(([x, y]) => {
        const below = cellKey(x, y + 1);
        if (y + 1 >= data.height) {
          setFalls((f) => f + 1);
          return start;
        }
        if (!platformSet.has(below)) {
          return [x, y + 1];
        }
        return [x, y];
      });
    }, TICK_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won, data.height]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (won) return;
      const [x, y] = pos;

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const nx = e.key === "ArrowLeft" ? x - 1 : x + 1;
        if (nx < 0 || nx >= data.width) return;
        if (platformSet.has(cellKey(nx, y))) return;
        e.preventDefault();
        setPos([nx, y]);
        if (data.end && cellKey(nx, y) === cellKey(...data.end)) setWon(true);
      } else if (e.key === "ArrowUp" || e.code === "Space") {
        const grounded = y + 1 < data.height && platformSet.has(cellKey(x, y + 1));
        if (!grounded) return;
        const ny = y - 1;
        if (ny < 0 || platformSet.has(cellKey(x, ny))) return;
        e.preventDefault();
        setPos([x, ny]);
        if (data.end && cellKey(x, ny) === cellKey(...data.end)) setWon(true);
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, won, data]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
        <span>💀 {falls} chute{falls > 1 ? "s" : ""}</span>
        {won && <span className="font-semibold text-emerald-500">🎉 Gagné !</span>}
      </div>

      <div
        className="grid gap-1 rounded-2xl border border-zinc-200 bg-zinc-100 p-2 shadow-inner dark:border-zinc-800 dark:bg-zinc-900"
        style={{ gridTemplateColumns: `repeat(${data.width}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: data.height }).map((_, y) =>
          Array.from({ length: data.width }).map((_, x) => {
            const key = cellKey(x, y);
            const isPlatform = platformSet.has(key);
            const isPlayer = pos[0] === x && pos[1] === y;
            const isEnd = data.end && cellKey(...data.end) === key;
            return (
              <div
                key={key}
                className={`flex size-8 items-center justify-center rounded-md text-base transition-colors sm:size-10 sm:text-lg ${
                  isPlatform
                    ? "bg-gradient-to-br from-amber-700 to-amber-900 shadow-sm"
                    : isEnd
                      ? "bg-rose-100 dark:bg-rose-900/50"
                      : "bg-white dark:bg-zinc-950"
                }`}
              >
                {isPlayer ? "🟣" : isEnd ? "🏁" : ""}
              </div>
            );
          }),
        )}
      </div>

      <p className="text-xs text-zinc-400">
        ← → pour te déplacer, ↑ ou Espace pour sauter.
      </p>
    </div>
  );
}
