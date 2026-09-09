"use client";

import { useState } from "react";
import Link from "next/link";
import HorrorScene from "./HorrorScene";

type Phase = "intro" | "playing" | "caught" | "escaped";

export default function HorrorGame({ title }: { title: string }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [seed, setSeed] = useState(0);

  function start() {
    setSeed(Date.now());
    setPhase("playing");
  }

  if (phase === "intro") {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-6 bg-black px-4">
        <Link
          href="/mode-3d"
          className="absolute left-3 top-3 text-sm text-zinc-400 hover:text-violet-400"
        >
          ← Retour au Mode 3D
        </Link>
        <span className="text-4xl">🕯️</span>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <p className="max-w-md text-center text-sm leading-relaxed text-zinc-400">
          Cette maison n&apos;est pas vide. Retrouve les <span className="text-amber-300">5 pages</span>{" "}
          éparpillées dans le noir et rejoins la sortie — mais économise ta lampe torche : plus elle
          reste allumée près d&apos;elle, plus vite elle te retrouve.
        </p>
        <button
          type="button"
          onClick={start}
          className="rounded-full bg-red-800 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-950/50 hover:bg-red-700"
        >
          Entrer dans le manoir
        </button>
      </div>
    );
  }

  if (phase === "caught") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-black px-4">
        <span className="animate-pulse text-5xl">💀</span>
        <p className="text-xl font-bold text-red-500">Elle t&apos;a attrapé...</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={start}
            className="rounded-full bg-red-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
          >
            Réessayer
          </button>
          <Link
            href="/mode-3d"
            className="rounded-full border border-zinc-600 px-5 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-zinc-800"
          >
            Retour au Mode 3D
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
        <div className="flex gap-3">
          <button
            type="button"
            onClick={start}
            className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Rejouer
          </button>
          <Link
            href="/mode-3d"
            className="rounded-full border border-zinc-600 px-5 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-zinc-800"
          >
            Retour au Mode 3D
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
