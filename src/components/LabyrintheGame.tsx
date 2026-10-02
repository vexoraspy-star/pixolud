"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { generateMaze, MAZE_DIFFICULTIES, type MazeDifficulty, type MazeDifficultyConfig } from "@/lib/games3d";
import type { MazeData } from "@/lib/maze";
import MazePlayer3D from "./MazePlayer3D";

/** Meilleur temps (millisecondes) de chaque difficulte, garde dans le navigateur. */
const RECORDS_KEY = "pixolud-labyrinthe-records";
type Records = Partial<Record<MazeDifficulty, number>>;

function readRecords(): Records {
  try {
    const v = JSON.parse(localStorage.getItem(RECORDS_KEY) ?? "{}") as Records;
    const out: Records = {};
    for (const d of MAZE_DIFFICULTIES) {
      const ms = v?.[d.id];
      if (typeof ms === "number" && Number.isFinite(ms) && ms > 0) out[d.id] = ms;
    }
    return out;
  } catch {
    return {};
  }
}

function fmtTime(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function LabyrintheGame({ title }: { title: string }) {
  const [config, setConfig] = useState<MazeDifficultyConfig | null>(null);
  const [run, setRun] = useState<{ data: MazeData; key: number } | null>(null);
  /** Fin de partie : le temps mis, et s'il bat le record. */
  const [finished, setFinished] = useState<{ ms: number; record: boolean; previous: number | null } | null>(null);
  const [records, setRecords] = useState<Records>({});
  const startedAt = useRef(0);

  // Records lus apres le premier rendu (le serveur ne les connait pas).
  useEffect(() => {
    const t = setTimeout(() => setRecords(readRecords()), 0);
    return () => clearTimeout(t);
  }, []);

  function start(cfg: MazeDifficultyConfig) {
    // start() n'est appelee que depuis les onClick ci-dessous, jamais pendant le rendu.
    // eslint-disable-next-line react-hooks/purity
    const seed = Date.now();
    startedAt.current = seed;
    setConfig(cfg);
    setFinished(null);
    setRun({ data: generateMaze(cfg.roomsW, cfg.roomsH, seed), key: seed });
  }

  /** Sortie trouvee : on chronometre et on garde le meilleur temps de la difficulte. */
  function win() {
    if (!config) return;
    // Appelee par le jeu quand on atteint la sortie, jamais pendant le rendu.
    const ms = Date.now() - startedAt.current;
    const previous = records[config.id] ?? null;
    const record = previous === null || ms < previous;
    if (record) {
      const next = { ...records, [config.id]: ms };
      setRecords(next);
      try {
        localStorage.setItem(RECORDS_KEY, JSON.stringify(next));
      } catch {
        // stockage indisponible : le record vaut pour cette visite
      }
    }
    setFinished({ ms, record, previous });
  }

  if (!run || !config) {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-6 bg-gradient-to-b from-stone-950 to-black px-4">
        <Link
          href="/mode-3d"
          className="absolute left-3 top-3 text-sm text-zinc-400 hover:text-violet-400"
        >
          ← Retour au Mode 3D
        </Link>
        <span className="text-4xl">🧱</span>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <p className="max-w-sm text-center text-sm text-zinc-400">
          Choisis ta difficulté. Chaque partie génère un tout nouveau labyrinthe : trouve la sortie le plus vite possible.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          {MAZE_DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => start(d)}
              className="flex w-56 flex-col items-center gap-1 rounded-2xl border border-zinc-700 bg-zinc-900 px-5 py-4 text-center transition hover:-translate-y-1 hover:border-violet-500 hover:shadow-lg hover:shadow-violet-900/30"
            >
              <span className="text-sm font-bold text-white">{d.label}</span>
              <span className="text-xs text-zinc-400">{d.description}</span>
              <span className="mt-1 font-mono text-[11px] text-amber-300">
                {records[d.id] !== undefined ? `Record : ${fmtTime(records[d.id]!)}` : "Pas encore de record"}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <MazePlayer3D
        key={run.key}
        data={run.data}
        backHref="/mode-3d"
        title={title}
        minimapRevealRadius={config.minimapRevealRadius}
        onWin={win}
      />
      {finished && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/80 backdrop-blur-sm">
          <span className="text-4xl">{finished.record ? "🏆" : "🎉"}</span>
          <p className="text-lg font-bold text-white">Labyrinthe terminé !</p>
          <p className="font-mono text-3xl font-black text-amber-300">{fmtTime(finished.ms)}</p>
          <p className="text-sm text-zinc-300">
            {finished.record
              ? finished.previous === null
                ? `Premier record en ${config.label.toLowerCase()} !`
                : `Nouveau record ! (l'ancien : ${fmtTime(finished.previous)})`
              : `Record à battre : ${fmtTime(finished.previous ?? finished.ms)}`}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => start(config)}
              className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
            >
              Rejouer ({config.label})
            </button>
            <button
              type="button"
              onClick={() => setRun(null)}
              className="rounded-full border border-zinc-600 px-5 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-zinc-800"
            >
              Changer de difficulté
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
