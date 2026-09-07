"use client";

import { useEffect, useRef, useState } from "react";
import type { PythonData } from "@/lib/python";
import { getPyodide, runPython, type PythonRunResult } from "@/lib/pyodide";
import { createClient } from "@/lib/supabase/client";

export default function PythonPlayer({
  data,
  gameId,
  countsAsPlay = false,
}: {
  data: PythonData;
  gameId?: string;
  countsAsPlay?: boolean;
}) {
  const [showingIntro, setShowingIntro] = useState(!!data.intro.trim());
  const [index, setIndex] = useState(0);
  const [code, setCode] = useState(data.exercises[0]?.starterCode ?? "");
  const [result, setResult] = useState<PythonRunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [pyReady, setPyReady] = useState(false);
  const [pyLoading, setPyLoading] = useState(false);
  const [finished, setFinished] = useState(false);
  const hasCountedPlay = useRef(false);

  useEffect(() => {
    if (!countsAsPlay || !gameId || hasCountedPlay.current) return;
    hasCountedPlay.current = true;
    const supabase = createClient();
    supabase.rpc("increment_plays", { game_id: gameId });
  }, [countsAsPlay, gameId]);

  function ensurePyodide() {
    if (pyReady || pyLoading) return;
    setPyLoading(true);
    getPyodide()
      .then(() => setPyReady(true))
      .catch(() => setResult({ output: "", error: "Impossible de charger Python. Réessaie plus tard." }))
      .finally(() => setPyLoading(false));
  }

  useEffect(() => {
    if (showingIntro) return;
    const timeout = setTimeout(ensurePyodide, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showingIntro]);

  const exercise = data.exercises[index];
  const passed =
    result !== null && result.error === null && result.output.trim() === exercise.expectedOutput.trim();

  async function run() {
    setRunning(true);
    const r = await runPython(code);
    setResult(r);
    setRunning(false);
  }

  function next() {
    if (index + 1 >= data.exercises.length) {
      setFinished(true);
      return;
    }
    const nextIndex = index + 1;
    setIndex(nextIndex);
    setCode(data.exercises[nextIndex].starterCode);
    setResult(null);
  }

  if (showingIntro) {
    return (
      <div className="flex w-full max-w-xl flex-col items-center gap-4 rounded-3xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950">
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          🐍 Python
        </span>
        <p className="w-full whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
          {data.intro}
        </p>
        <button
          type="button"
          onClick={() => setShowingIntro(false)}
          className="rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/30 transition hover:scale-105 active:scale-95"
        >
          C&apos;est parti →
        </button>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 px-10 py-8 text-center shadow-inner dark:from-emerald-950/30 dark:to-teal-950/30">
        <span className="text-5xl">🐍</span>
        <p className="text-xl font-bold text-zinc-900 dark:text-white">
          Bravo, tu as terminé les {data.exercises.length} exercice{data.exercises.length > 1 ? "s" : ""} !
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-4 rounded-3xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950">
      <div className="flex w-full items-center justify-between">
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-600 shadow-sm dark:bg-zinc-800 dark:text-zinc-300">
          🐍 Exercice {index + 1} / {data.exercises.length}
        </span>
      </div>

      <p className="w-full whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-200">
        {exercise.instructions}
      </p>

      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={6}
        spellCheck={false}
        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-emerald-300 outline-none focus:border-emerald-500"
      />

      <div className="flex w-full items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={running || pyLoading}
          className="rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/30 transition hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pyLoading ? "Chargement de Python..." : running ? "Exécution..." : "▶ Exécuter"}
        </button>
        {passed && (
          <button
            type="button"
            onClick={next}
            className="rounded-full bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
          >
            {index + 1 >= data.exercises.length ? "Terminer" : "Suivant →"}
          </button>
        )}
      </div>

      {result && (
        <div className="w-full rounded-xl bg-zinc-950 px-3 py-2 font-mono text-xs">
          <p className="mb-1 text-zinc-500">Sortie :</p>
          <pre className="whitespace-pre-wrap text-emerald-300">{result.output || "(rien)"}</pre>
          {result.error && <p className="mt-2 whitespace-pre-wrap text-rose-400">{result.error}</p>}
          {!result.error && (
            <p className={`mt-2 font-sans ${passed ? "text-emerald-400" : "text-amber-400"}`}>
              {passed ? "✅ Bravo, c'est exactement ça !" : "Pas encore la bonne sortie, réessaie."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
