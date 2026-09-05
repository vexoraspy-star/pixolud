"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CourseData } from "@/lib/course";
import { createClient } from "@/lib/supabase/client";

type Phase = "idle" | "waiting" | "go" | "tooSoon" | "result" | "finished";

export default function CoursePlayer({
  data,
  gameId,
  countsAsPlay = false,
}: {
  data: CourseData;
  gameId?: string;
  countsAsPlay?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const goAt = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasCountedPlay = useRef(false);

  useEffect(() => {
    if (!countsAsPlay || !gameId || hasCountedPlay.current) return;
    hasCountedPlay.current = true;
    const supabase = createClient();
    supabase.rpc("increment_plays", { game_id: gameId });
  }, [countsAsPlay, gameId]);

  const startRound = useCallback(() => {
    setPhase("waiting");
    const delay = 1000 + Math.random() * 2500;
    timeoutRef.current = setTimeout(() => {
      goAt.current = Date.now();
      setPhase("go");
    }, delay);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      e.preventDefault();

      if (phase === "idle" || phase === "result") {
        startRound();
      } else if (phase === "waiting") {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setPhase("tooSoon");
      } else if (phase === "go") {
        const reaction = Date.now() - goAt.current;
        setTimes((t) => [...t, reaction]);
        setPhase("result");
      } else if (phase === "tooSoon") {
        startRound();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [phase, startRound]);

  function nextOrFinish() {
    if (round + 1 >= data.rounds) {
      setPhase("finished");
    } else {
      setRound((r) => r + 1);
      startRound();
    }
  }

  if (phase === "finished") {
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    const medal = avg < 300 ? "🥇" : avg < 500 ? "🥈" : "🥉";
    return (
      <div className="flex flex-col items-center gap-2 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 px-10 py-8 text-center shadow-inner dark:from-amber-950/30 dark:to-orange-950/30">
        <span className="text-5xl">{medal}</span>
        <p className="text-xl font-bold text-zinc-900 dark:text-white">
          Temps de réaction moyen : {avg} ms
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          sur {data.rounds} manches
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-600 shadow-sm dark:bg-zinc-800 dark:text-zinc-300">
        Manche {round + 1} / {data.rounds}
      </span>

      <div
        className={`flex size-48 items-center justify-center rounded-full text-lg font-bold text-white shadow-lg transition-all duration-150 ${
          phase === "go"
            ? "scale-105 bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/40"
            : phase === "tooSoon"
              ? "bg-gradient-to-br from-rose-400 to-rose-600 shadow-rose-500/40"
              : "bg-gradient-to-br from-zinc-400 to-zinc-500 dark:from-zinc-700 dark:to-zinc-800"
        }`}
      >
        {phase === "idle" && "Espace pour commencer"}
        {phase === "waiting" && "Attends..."}
        {phase === "go" && "GO !"}
        {phase === "tooSoon" && "Trop tôt !"}
        {phase === "result" && `${times[times.length - 1]} ms`}
      </div>

      <p className="max-w-xs text-xs text-zinc-400">
        {phase === "tooSoon" && "Appuie sur ESPACE pour réessayer."}
        {phase === "result" && (
          <button
            type="button"
            onClick={nextOrFinish}
            className="mt-2 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-violet-600/30 transition hover:scale-105 active:scale-95"
          >
            {round + 1 >= data.rounds ? "Voir le résultat" : "Manche suivante"}
          </button>
        )}
        {(phase === "idle" || phase === "waiting" || phase === "go") &&
          "Appuie sur la barre ESPACE dès que le cercle passe au vert."}
      </p>
    </div>
  );
}
