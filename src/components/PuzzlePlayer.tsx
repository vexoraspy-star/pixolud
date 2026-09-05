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
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="text-4xl">🎉</span>
        <p className="text-lg font-bold text-zinc-900 dark:text-white">
          Gagné en {moves} coups !
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Coups : {moves}</p>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${Math.min(cards.length, 6)}, minmax(0, 1fr))` }}
      >
        {cards.map((sym, i) => {
          const isVisible = flipped.includes(i) || matched.has(i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleFlip(i)}
              className={`flex size-14 items-center justify-center rounded-lg text-2xl transition-colors sm:size-16 ${
                isVisible
                  ? "bg-violet-100 dark:bg-violet-900/50"
                  : "bg-zinc-700 hover:bg-zinc-600 dark:bg-zinc-800"
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
