"use client";

import { useState } from "react";
import Link from "next/link";
import { generateMaze, MAZE_DIFFICULTIES, type MazeDifficultyConfig } from "@/lib/games3d";
import type { MazeData } from "@/lib/maze";
import MazePlayer3D from "./MazePlayer3D";

export default function LabyrintheGame({ title }: { title: string }) {
  const [config, setConfig] = useState<MazeDifficultyConfig | null>(null);
  const [run, setRun] = useState<{ data: MazeData; key: number } | null>(null);
  const [finished, setFinished] = useState(false);

  function start(cfg: MazeDifficultyConfig) {
    // start() n'est appelee que depuis les onClick ci-dessous, jamais pendant le rendu.
    // eslint-disable-next-line react-hooks/purity
    const seed = Date.now();
    setConfig(cfg);
    setFinished(false);
    setRun({ data: generateMaze(cfg.roomsW, cfg.roomsH, seed), key: seed });
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
          Choisis ta difficulté. Chaque partie génère un tout nouveau labyrinthe.
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
        onWin={() => setFinished(true)}
      />
      {finished && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/80 backdrop-blur-sm">
          <span className="text-4xl">🎉</span>
          <p className="text-lg font-bold text-white">Labyrinthe terminé !</p>
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
