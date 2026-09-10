"use client";

import { useState } from "react";
import Link from "next/link";
import HorrorScene from "./HorrorScene";
import HorrorLobby, { type HorrorMode } from "./HorrorLobby";
import HorrorCutscene from "./HorrorCutscene";

type Phase = "lobby" | "cutscene" | "playing" | "caught" | "escaped";

export default function HorrorGame({ title }: { title: string }) {
  const [phase, setPhase] = useState<Phase>("lobby");
  const [seed, setSeed] = useState(0);

  function launch(mode: HorrorMode) {
    setSeed(Date.now());
    setPhase(mode === "histoire" ? "cutscene" : "playing");
  }
  function replay() {
    setSeed(Date.now());
    setPhase("playing");
  }

  if (phase === "lobby") {
    return <HorrorLobby title={title} onPlay={launch} />;
  }

  if (phase === "cutscene") {
    return <HorrorCutscene onDone={() => setPhase("playing")} />;
  }

  if (phase === "caught") {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-4 bg-black px-4">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(circle at 50% 45%, rgba(120,0,0,0.35), transparent 62%)" }}
        />
        <span className="animate-pulse text-5xl">💀</span>
        <p className="text-xl font-bold text-red-500">Elle t&apos;a attrapé...</p>
        <p className="max-w-sm text-center text-sm text-zinc-500">
          Le manoir garde ceux qui s&apos;y attardent. Le code de la cave change à chaque tentative.
        </p>
        <div className="relative flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={replay}
            className="rounded-full bg-red-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
          >
            Réessayer
          </button>
          <button
            type="button"
            onClick={() => setPhase("lobby")}
            className="rounded-full border border-zinc-600 px-5 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-zinc-800"
          >
            Retour au lobby
          </button>
          <Link
            href="/mode-3d"
            className="rounded-full border border-zinc-700 px-5 py-2.5 text-sm font-semibold text-zinc-400 hover:bg-zinc-800"
          >
            Mode 3D
          </Link>
        </div>
      </div>
    );
  }

  if (phase === "escaped") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-gradient-to-b from-emerald-950 to-black px-4">
        <span className="text-5xl">🕊️</span>
        <p className="text-xl font-bold text-emerald-400">Tu t&apos;es échappé du manoir !</p>
        <p className="max-w-sm text-center text-sm text-zinc-400">
          Cinq objets, un code, et la cave. Tu ne sauras jamais qui t&apos;a ouvert la porte.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={replay}
            className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Rejouer
          </button>
          <button
            type="button"
            onClick={() => setPhase("lobby")}
            className="rounded-full border border-zinc-600 px-5 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-zinc-800"
          >
            Retour au lobby
          </button>
          <Link
            href="/mode-3d"
            className="rounded-full border border-zinc-700 px-5 py-2.5 text-sm font-semibold text-zinc-400 hover:bg-zinc-800"
          >
            Mode 3D
          </Link>
        </div>
      </div>
    );
  }

  return (
    <HorrorScene
      seed={seed}
      onCaught={() => setPhase("caught")}
      onEscape={() => setPhase("escaped")}
    />
  );
}
