"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LEVELS } from "@/lib/backrooms";
import BackroomsScene, { type DeathCause, type LevelStats } from "./BackroomsScene";

// Deroule des Backrooms : menu, niveaux enchaines, mort, fin.
// Le niveau le plus loin atteint est garde dans le navigateur, pour pouvoir
// reprendre sans tout refaire depuis le Hall.

type Phase = "menu" | "playing" | "transition" | "dead" | "ending";

const PROGRESS_KEY = "pixolud_backrooms_niveau";

const DEATH_TEXT: Record<DeathCause, { title: string; text: string }> = {
  lucidite: {
    title: "Tu t'es perdu",
    text: "Le bourdonnement a fini par couvrir tes pensées. Tu marches encore, quelque part dans le Hall. Tu ne te souviens plus pourquoi.",
  },
  souriant: {
    title: "Il souriait",
    text: "Dans le noir, il ne restait que ses dents. Tu aurais dû éteindre ta lampe.",
  },
  bacterie: {
    title: "Elle t'a entendu",
    text: "Des doigts trop longs, un claquement sec, et plus rien. Chaque pas fait du bruit, ici.",
  },
};

function loadProgress(): number {
  try {
    const v = Number(window.localStorage.getItem(PROGRESS_KEY));
    return Number.isFinite(v) ? Math.max(0, Math.min(LEVELS.length - 1, Math.floor(v))) : 0;
  } catch {
    return 0;
  }
}
function saveProgress(index: number) {
  try {
    window.localStorage.setItem(PROGRESS_KEY, String(index));
  } catch {
    // stockage indisponible : on rejouera depuis le debut, rien de grave
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return `${m}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Un couloir du Hall en perspective, dessine en SVG : le fond du menu. */
function Corridor() {
  const panels = [0, 1, 2, 3, 4, 5];
  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="br-wall-l" x1="0" x2="1">
          <stop offset="0" stopColor="#6d5f26" />
          <stop offset="1" stopColor="#b9a452" />
        </linearGradient>
        <linearGradient id="br-wall-r" x1="1" x2="0">
          <stop offset="0" stopColor="#6d5f26" />
          <stop offset="1" stopColor="#b9a452" />
        </linearGradient>
        <linearGradient id="br-floor" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#3d3313" />
          <stop offset="1" stopColor="#8b7a3e" />
        </linearGradient>
        <radialGradient id="br-fog" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#d9c97a" stopOpacity="0.95" />
          <stop offset="1" stopColor="#d9c97a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="240" fill="#a8964a" />
      <polygon points="0,0 170,95 170,145 0,240" fill="url(#br-wall-l)" />
      <polygon points="400,0 230,95 230,145 400,240" fill="url(#br-wall-r)" />
      <polygon points="0,240 170,145 230,145 400,240" fill="url(#br-floor)" />
      <polygon points="0,0 170,95 230,95 400,0" fill="#cfc193" />
      {panels.map((i) => {
        const t = i / panels.length;
        const k = Math.pow(1 - t, 1.8);
        const y = 95 - 88 * k;
        const w = 12 + 70 * k;
        const h = 2 + 9 * k;
        return (
          <rect
            key={i}
            x={200 - w / 2}
            y={y}
            width={w}
            height={h}
            fill="#fffbe6"
            style={i === 2 ? { animation: "horror-flicker 3.2s steps(2) infinite" } : undefined}
          />
        );
      })}
      {/* Une porte au fond, a gauche. */}
      <polygon points="150,106 162,112 162,140 150,146" fill="#3a3218" />
      <rect x="170" y="95" width="60" height="50" fill="url(#br-fog)" />
    </svg>
  );
}

export default function BackroomsGame({ title }: { title: string }) {
  const [phase, setPhase] = useState<Phase>("menu");
  const [levelIndex, setLevelIndex] = useState(0);
  const [seed, setSeed] = useState(1);
  const [unlocked, setUnlocked] = useState(0);
  const [death, setDeath] = useState<{ cause: DeathCause; stats: LevelStats } | null>(null);
  const [run, setRun] = useState({ seconds: 0, deaths: 0, water: 0 });

  useEffect(() => {
    const t = setTimeout(() => setUnlocked(loadProgress()), 0);
    return () => clearTimeout(t);
  }, []);

  function start(index: number, fresh: boolean) {
    setLevelIndex(index);
    setSeed(Date.now());
    if (fresh) setRun({ seconds: 0, deaths: 0, water: 0 });
    setPhase("playing");
  }

  const handleDeath = useCallback((cause: DeathCause, stats: LevelStats) => {
    setDeath({ cause, stats });
    setRun((r) => ({ seconds: r.seconds + stats.seconds, deaths: r.deaths + 1, water: r.water + stats.water }));
    setPhase("dead");
  }, []);

  const handleComplete = useCallback(
    (stats: LevelStats) => {
      setRun((r) => ({ ...r, seconds: r.seconds + stats.seconds, water: r.water + stats.water }));
      const next = levelIndex + 1;
      if (next >= LEVELS.length) {
        setPhase("ending");
        return;
      }
      if (next > unlocked) {
        setUnlocked(next);
        saveProgress(next);
      }
      setPhase("transition");
      window.setTimeout(() => {
        setLevelIndex(next);
        setSeed(Date.now());
        setPhase("playing");
      }, 2600);
    },
    [levelIndex, unlocked],
  );

  if (phase === "playing") {
    return (
      <BackroomsScene
        key={`${LEVELS[levelIndex].id}-${seed}`}
        level={LEVELS[levelIndex]}
        seed={seed}
        onDeath={handleDeath}
        onComplete={handleComplete}
      />
    );
  }

  const next = LEVELS[Math.min(LEVELS.length - 1, levelIndex + 1)];

  if (phase === "transition") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-black px-6 text-center font-mono text-[#f3e3a0]">
        <p className="text-[12px] tracking-[0.5em] opacity-70" style={{ animation: "backrooms-rec 0.9s steps(1) infinite" }}>
          NO-CLIP
        </p>
        <p className="mt-4 max-w-md text-sm leading-relaxed opacity-85">
          Le sol cède sous tes pieds. Tu tombes à travers quelque chose qui n&apos;est ni du béton ni de l&apos;air.
        </p>
        <p className="mt-6 text-[11px] tracking-[0.4em] opacity-60">
          NIVEAU {next.number} · {next.name.toUpperCase()}
        </p>
      </div>
    );
  }

  if (phase === "dead" && death) {
    const d = DEATH_TEXT[death.cause];
    const lvl = LEVELS[levelIndex];
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-black px-6 text-center font-mono text-[#e9dfc0]">
        <div className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "repeating-linear-gradient(0deg, #000 0 1px, transparent 1px 3px)" }} />
        <p className="text-[11px] tracking-[0.5em] text-red-500" style={{ animation: "backrooms-rec 1s steps(1) infinite" }}>
          ■ FIN DE L&apos;ENREGISTREMENT
        </p>
        <h1 className="mt-4 text-3xl font-black tracking-[0.15em] text-balance sm:text-5xl" style={{ textShadow: "3px 0 rgba(255,0,60,0.5), -3px 0 rgba(0,200,255,0.5)" }}>
          {d.title.toUpperCase()}
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed opacity-80">{d.text}</p>
        <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-1 text-left text-[12px] tracking-wider opacity-75">
          <dt>NIVEAU</dt>
          <dd className="text-right">
            {lvl.number} · {lvl.name}
          </dd>
          <dt>TENU</dt>
          <dd className="text-right tabular-nums">{formatTime(death.stats.seconds)}</dd>
          <dt>MORTS</dt>
          <dd className="text-right tabular-nums">{run.deaths}</dd>
        </dl>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => start(levelIndex, false)}
            className="border border-[#f3e3a0] bg-[#f3e3a0] px-5 py-2.5 text-sm font-bold tracking-widest text-black transition hover:bg-transparent hover:text-[#f3e3a0]"
          >
            RÉESSAYER LE NIVEAU
          </button>
          <button
            type="button"
            onClick={() => setPhase("menu")}
            className="border border-white/30 px-5 py-2.5 text-sm tracking-widest transition hover:border-white/70"
          >
            MENU
          </button>
        </div>
      </div>
    );
  }

  if (phase === "ending") {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[#0b0a06] px-6 text-center font-mono text-[#f3e3a0]">
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <Corridor />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-black/70" />
        <div className="relative flex flex-col items-center">
          <p className="text-[11px] tracking-[0.5em] opacity-70">NIVEAU ? · SORTIE</p>
          <h1 className="mt-4 text-3xl font-black tracking-[0.12em] sm:text-5xl">TU ES SORTI.</h1>
          <p className="mt-5 max-w-lg text-sm leading-relaxed opacity-85">
            La porte donnait sur un parking, sous un vrai ciel. Tu as couru jusqu&apos;à la rue. Puis, en
            passant devant une vitrine, tu as entendu le bourdonnement d&apos;un néon. Juste un néon.
            Sûrement.
          </p>
          <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-1 text-left text-[12px] tracking-wider opacity-80">
            <dt>TEMPS TOTAL</dt>
            <dd className="text-right tabular-nums">{formatTime(run.seconds)}</dd>
            <dt>MORTS</dt>
            <dd className="text-right tabular-nums">{run.deaths}</dd>
            <dt>EAU D&apos;AMANDE BUE</dt>
            <dd className="text-right tabular-nums">{run.water}</dd>
          </dl>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => start(0, true)}
              className="border border-[#f3e3a0] bg-[#f3e3a0] px-5 py-2.5 text-sm font-bold tracking-widest text-black transition hover:bg-transparent hover:text-[#f3e3a0]"
            >
              RETOURNER DANS LE HALL
            </button>
            <button type="button" onClick={() => setPhase("menu")} className="border border-white/30 px-5 py-2.5 text-sm tracking-widest">
              MENU
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Menu ---
  return (
    <div className="relative flex h-full w-full overflow-hidden bg-[#0b0a06] font-mono text-[#f3e3a0]">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <Corridor />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/20" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "repeating-linear-gradient(0deg, #000 0 1px, transparent 1px 3px)" }} />
      <div
        className="pointer-events-none absolute inset-x-0 h-10 opacity-[0.08]"
        style={{ background: "linear-gradient(180deg, transparent, #fff, transparent)", animation: "backrooms-tracking 6s linear infinite" }}
      />

      <div className="relative flex h-full w-full flex-col overflow-y-auto px-5 py-5 sm:px-10 sm:py-8">
        <div className="flex items-center justify-between text-[12px] tracking-widest">
          <Link href="/mode-3d" className="opacity-70 transition hover:opacity-100">
            ← MODE 3D
          </Link>
          <span className="flex items-center gap-2 opacity-80">
            <span className="inline-block size-2 rounded-full bg-red-600" style={{ animation: "backrooms-rec 1.4s steps(1) infinite" }} />
            REC
          </span>
        </div>

        <div className="mt-8 max-w-xl sm:mt-14">
          <p className="text-[11px] tracking-[0.5em] opacity-60">{title.replace(/^\S+\s/, "").toUpperCase()} · PIXOLUD</p>
          <h1
            className="mt-2 text-5xl font-black leading-none tracking-[0.08em] sm:text-7xl"
            style={{ textShadow: "4px 0 rgba(255,0,60,0.45), -4px 0 rgba(0,200,255,0.45)" }}
          >
            BACKROOMS
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed opacity-85">
            Tu as traversé le sol par accident. Derrière : de la moquette humide, des néons qui bourdonnent, et des
            couloirs jaunes qui ne mènent nulle part. Trouve la sortie de chaque niveau. Ne reste pas dans le noir.
          </p>

          <div className="mt-8 flex flex-col items-start gap-3">
            <button
              type="button"
              onClick={() => start(0, true)}
              className="border border-[#f3e3a0] bg-[#f3e3a0] px-6 py-3 text-sm font-bold tracking-[0.25em] text-black transition hover:bg-transparent hover:text-[#f3e3a0]"
            >
              ▶ NOUVELLE PARTIE
            </button>
            {unlocked > 0 && (
              <button
                type="button"
                onClick={() => start(unlocked, true)}
                className="border border-[#f3e3a0]/60 px-6 py-3 text-sm tracking-[0.2em] transition hover:border-[#f3e3a0] hover:bg-[#f3e3a0]/10"
              >
                CONTINUER · NIVEAU {LEVELS[unlocked].number}
              </button>
            )}
          </div>
        </div>

        <div className="mt-10 max-w-3xl">
          <p className="text-[11px] tracking-[0.4em] opacity-60">NIVEAUX</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {LEVELS.map((lvl, i) => {
              const open = i <= unlocked;
              return (
                <li key={lvl.id}>
                  <button
                    type="button"
                    disabled={!open}
                    onClick={() => start(i, true)}
                    className="flex w-full items-start gap-4 border border-white/10 bg-black/50 p-3 text-left transition enabled:hover:border-[#f3e3a0]/60 enabled:hover:bg-black/70 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="w-8 shrink-0 text-3xl font-black leading-none">{lvl.number}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold tracking-widest">{open ? lvl.name.toUpperCase() : "???"}</span>
                      <span className="mt-1 block text-[11px] leading-snug opacity-70">
                        {open ? lvl.tagline : "Atteins le niveau précédent pour le débloquer."}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-10 grid max-w-3xl gap-6 pb-6 text-[12px] leading-relaxed sm:grid-cols-2">
          <div>
            <p className="text-[11px] tracking-[0.4em] opacity-60">COMMANDES</p>
            <ul className="mt-2 space-y-1 opacity-85">
              <li>ZQSD · se déplacer (QWERTY dans les réglages)</li>
              <li>Souris · regarder (clique dans l&apos;image)</li>
              <li>Maj · courir — C · s&apos;accroupir</li>
              <li>F · lampe — E · ramasser, ouvrir (maintenir pour une vanne)</li>
              <li>R · boire de l&apos;eau d&apos;amande</li>
            </ul>
          </div>
          <div>
            <p className="text-[11px] tracking-[0.4em] opacity-60">SURVIVRE</p>
            <ul className="mt-2 space-y-1 opacity-85">
              <li>Ta lucidité baisse, surtout dans le noir. L&apos;eau d&apos;amande la remonte.</li>
              <li>Les entités entendent tes pas. Accroupi, tu es presque silencieux.</li>
              <li>Le signal en bas à gauche grimpe près de ton objectif.</li>
              <li>Casque recommandé : les sons viennent d&apos;une direction.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
