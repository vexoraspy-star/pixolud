"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PuzzleData } from "@/lib/puzzle";
import { createClient } from "@/lib/supabase/client";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function PuzzlePlayer({
  data,
  gameId,
  countsAsPlay = false,
}: {
  data: PuzzleData;
  gameId?: string;
  countsAsPlay?: boolean;
}) {
  const cards = useMemo(
    () => shuffle(data.symbols.flatMap((s) => [s, s])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [moves, setMoves] = useState(0);
  const hasCountedPlay = useRef(false);

  useEffect(() => {
    if (!countsAsPlay || !gameId || hasCountedPlay.current) return;
    hasCountedPlay.current = true;
    const supabase = createClient();
    supabase.rpc("increment_plays", { game_id: gameId });
  }, [countsAsPlay, gameId]);

  const won = matched.size === cards.length;

  function handleFlip(i: number) {
    if (flipped.length === 2 || flipped.includes(i) || matched.has(i)) return;
    const next = [...flipped, i];
    setFlipped(next);

    if (next.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = next;
      if (cards[a] === cards[b]) {
        setMatched((prev) => new Set(prev).add(a).add(b));
        setFlipped([]);
      } else {
        setTimeout(() => setFlipped([]), 700);
      }
    }
  }

  if (won) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-gradient-to-br from-violet-50 to-fuchsia-50 px-10 py-8 text-center shadow-inner dark:from-violet-950/30 dark:to-fuchsia-950/30">
        <span className="text-5xl">🎉</span>
        <p className="text-xl font-bold text-zinc-900 dark:text-white">
          Gagné en {moves} coups !
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-600 shadow-sm dark:bg-zinc-800 dark:text-zinc-300">
        Coups : {moves}
      </span>
      <div
        className="grid gap-2 rounded-3xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-zinc-100 p-3 shadow-inner dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950"
        style={{ gridTemplateColumns: `repeat(${Math.min(cards.length, 6)}, minmax(0, 1fr))` }}
      >
        {cards.map((sym, i) => {
          const isVisible = flipped.includes(i) || matched.has(i);
          const isMatched = matched.has(i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleFlip(i)}
              className={`flex size-14 items-center justify-center rounded-xl text-2xl shadow-sm transition-all duration-200 sm:size-16 ${
                isMatched
                  ? "scale-95 bg-gradient-to-br from-emerald-100 to-teal-100 opacity-80 dark:from-emerald-900/40 dark:to-teal-900/40"
                  : isVisible
                    ? "scale-105 bg-gradient-to-br from-violet-100 to-fuchsia-100 shadow-md dark:from-violet-900/50 dark:to-fuchsia-900/50"
                    : "bg-gradient-to-br from-zinc-600 to-zinc-800 hover:scale-105 hover:from-zinc-500 hover:to-zinc-700 dark:from-zinc-700 dark:to-zinc-900"
              }`}
            >
              {isVisible ? sym : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}
