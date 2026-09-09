"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import HorrorScene from "./HorrorScene";

type Phase = "intro" | "cutscene" | "playing" | "caught" | "escaped";

const CUTSCENE_CAPTIONS: string[] = [
  "Ta voiture vient de lâcher en pleine nuit, sur une route de campagne perdue. Pas de réseau. Pas âme qui vive.",
  "Au loin, une seule lumière : un vieux manoir. C'est le seul bâtiment à des kilomètres à la ronde.",
  "Tu frappes. Personne ne répond... mais la porte s'entrouvre toute seule, dans un grincement.",
  "À l'intérieur, une odeur de poussière et de cire brûlée. Tu sens que tu n'es pas vraiment seul.",
  "En fouillant l'entrée, tu trouves une note à moitié brûlée, posée sur une console.",
];

function Star({ style }: { style: CSSProperties }) {
  return <span className="absolute rounded-full bg-white" style={style} />;
}

function SlideCarBreakdown() {
  return (
    <div className="relative h-56 w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800/60 bg-gradient-to-b from-[#050608] via-[#0a0d16] to-[#13151f]">
      <Star style={{ width: 2, height: 2, top: "14%", left: "20%", animation: "horror-twinkle 3.2s ease-in-out infinite" }} />
      <Star style={{ width: 2, height: 2, top: "22%", left: "62%", animation: "horror-twinkle 2.6s ease-in-out infinite 0.4s" }} />
      <Star style={{ width: 1.5, height: 1.5, top: "10%", left: "80%", animation: "horror-twinkle 4s ease-in-out infinite 1s" }} />
      <Star style={{ width: 2, height: 2, top: "30%", left: "40%", animation: "horror-twinkle 3.6s ease-in-out infinite 0.7s" }} />
      <div className="absolute inset-x-0 bottom-0 h-16 bg-[#0a0a0c]" />
      <div
        className="absolute inset-x-0 bottom-7 h-[2px] opacity-40"
        style={{ background: "repeating-linear-gradient(90deg, #3a3a3a 0 16px, transparent 16px 32px)" }}
      />
      <div className="absolute bottom-6 left-1/2 h-10 w-40 -translate-x-1/2">
        <div className="absolute inset-0 rounded-t-2xl rounded-b-md bg-[#15181f]" />
        <div className="absolute -top-4 left-8 h-6 w-20 rounded-t-xl bg-[#15181f]" />
        <div
          className="absolute -left-1 top-3 h-3 w-3 rounded-full bg-amber-200"
          style={{ boxShadow: "0 0 18px 7px rgba(255,206,120,0.5)", animation: "horror-flicker 1.9s ease-in-out infinite" }}
        />
        <div className="absolute -bottom-2 left-3 h-4 w-4 rounded-full bg-black" />
        <div className="absolute -bottom-2 right-3 h-4 w-4 rounded-full bg-black" />
      </div>
      <div
        className="absolute inset-x-[-10%] bottom-0 h-10 bg-white/5 blur-md"
        style={{ animation: "horror-fog-drift 9s ease-in-out infinite" }}
      />
    </div>
  );
}

function SlideManorDistance() {
  return (
    <div className="relative h-56 w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800/60 bg-gradient-to-b from-[#04050a] via-[#080a12] to-[#0e1018]">
      <div
        className="absolute right-8 top-6 h-8 w-8 rounded-full bg-zinc-200/90"
        style={{ boxShadow: "0 0 30px 10px rgba(220,220,255,0.25)" }}
      />
      <div
        className="absolute inset-x-0 bottom-0 flex justify-center"
        style={{ animation: "horror-rise 1.5s ease-out forwards" }}
      >
        <div className="relative h-28 w-56">
          <div className="absolute inset-x-0 bottom-0 h-28 w-56 bg-black" />
          <div
            className="absolute -top-10 left-1/2 h-10 w-44 -translate-x-1/2 bg-black"
            style={{ clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }}
          />
          <div className="absolute -top-16 left-3 h-24 w-9 bg-black">
            <div
              className="absolute -top-6 left-1/2 h-6 w-9 -translate-x-1/2 bg-black"
              style={{ clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }}
            />
          </div>
          <div
            className="absolute left-9 top-9 h-4 w-3 bg-amber-300/70"
            style={{ animation: "horror-flicker 3.4s ease-in-out infinite" }}
          />
          <div className="absolute right-10 top-9 h-4 w-3 bg-amber-200/25" />
        </div>
      </div>
      <div
        className="absolute inset-x-[-10%] bottom-0 h-14 bg-white/5 blur-lg"
        style={{ animation: "horror-fog-drift 11s ease-in-out infinite" }}
      />
    </div>
  );
}

function SlideDoorOpens() {
  return (
    <div className="relative flex h-56 w-full max-w-md items-center justify-center overflow-hidden rounded-2xl border border-zinc-800/60 bg-[#07080b]">
      <div className="relative h-44 w-32 overflow-hidden rounded-t-full bg-[#1a1710]">
        <div
          className="absolute inset-1 rounded-t-full bg-gradient-to-b from-amber-200/70 via-amber-700/30 to-amber-950/10"
          style={{ animation: "horror-glow-in 1.8s ease-out forwards" }}
        />
        <div
          className="absolute inset-1 origin-left rounded-t-full bg-[#100c07]"
          style={{ animation: "horror-door-open 1.9s ease-in forwards" }}
        >
          <div className="absolute left-1/3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[#4a3c24]" />
        </div>
      </div>
    </div>
  );
}

function SlidePresence() {
  return (
    <div className="relative h-56 w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800/60 bg-black">
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(circle at 50% 45%, transparent 15%, black 78%)",
          animation: "horror-vignette-pulse 4s ease-in-out infinite",
        }}
      />
      <div
        className="absolute bottom-4 right-14 h-24 w-8 rounded-full bg-white/10 blur-[2px]"
        style={{ animation: "horror-ghost-flicker 7s ease-in-out infinite" }}
      />
      <div
        className="absolute inset-0 flex items-center justify-center text-4xl"
        style={{ animation: "horror-flicker 2.6s ease-in-out infinite" }}
      >
        🕯️
      </div>
    </div>
  );
}

function SlideNoteFound() {
  return (
    <div className="relative flex h-56 w-full max-w-md items-center justify-center overflow-hidden rounded-2xl border border-zinc-800/60 bg-[#0a0a0c]">
      <div
        className="relative w-64 -rotate-2 bg-[#e9dfc3] px-5 py-4 text-[#2a2115] shadow-2xl"
        style={{
          clipPath: "polygon(0 4%, 96% 0, 100% 92%, 4% 100%, 0 60%, 6% 40%)",
          animation: "horror-paper-in 0.9s ease-out forwards",
        }}
      >
        <div
          className="absolute -right-1 -top-1 h-10 w-10"
          style={{
            background: "linear-gradient(135deg, rgba(0,0,0,0.7), rgba(0,0,0,0))",
            clipPath: "polygon(100% 0, 0 0, 100% 100%)",
          }}
        />
        <p className="font-serif text-sm italic leading-snug">
          « 5 objets. Rassemble-les. Atteins la cave. Ne t&apos;arrête jamais. »
        </p>
      </div>
    </div>
  );
}

const SLIDE_VISUALS = [SlideCarBreakdown, SlideManorDistance, SlideDoorOpens, SlidePresence, SlideNoteFound];

export default function HorrorGame({ title }: { title: string }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [slide, setSlide] = useState(0);
  const [seed, setSeed] = useState(0);

  function beginCutscene() {
    setSlide(0);
    setPhase("cutscene");
  }
  function nextSlide() {
    if (slide < CUTSCENE_CAPTIONS.length - 1) {
      setSlide((s) => s + 1);
    } else {
      start();
    }
  }
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
          Un jeu d&apos;horreur solo. Explore un vrai manoir pièce par pièce, retrouve{" "}
          <span className="text-amber-300">5 objets</span> pour comprendre ce qu&apos;il s&apos;est
          passé ici, et atteins la cave — mais économise ta lampe torche : plus elle reste allumée
          près d&apos;elle, plus vite elle te retrouve.
        </p>
        <button
          type="button"
          onClick={beginCutscene}
          className="rounded-full bg-red-800 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-950/50 hover:bg-red-700"
        >
          Entrer dans le manoir
        </button>
      </div>
    );
  }

  if (phase === "cutscene") {
    const Visual = SLIDE_VISUALS[slide];
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-5 bg-black px-4">
        <Visual key={slide} />
        <p className="max-w-md text-center text-sm leading-relaxed text-zinc-300">
          {CUTSCENE_CAPTIONS[slide]}
        </p>
        <div className="flex items-center gap-2">
          {CUTSCENE_CAPTIONS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${i === slide ? "bg-red-500" : "bg-zinc-700"}`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={nextSlide}
          className="rounded-full bg-red-800 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-950/50 hover:bg-red-700"
        >
          {slide < CUTSCENE_CAPTIONS.length - 1 ? "Suivant →" : "Entrer dans le manoir"}
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
