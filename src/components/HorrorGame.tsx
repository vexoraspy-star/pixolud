"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import HorrorScene from "./HorrorScene";
import HorrorLobby, { type HorrorMode } from "./HorrorLobby";
import HorrorCutscene from "./HorrorCutscene";
import HorrorEnding from "./HorrorEnding";

type Phase = "lobby" | "cutscene" | "playing" | "caught" | "ending" | "escaped";

/** Tentatives, evasions et meilleur temps d'evasion, gardes dans le navigateur. */
const STATS_KEY = "pixolud-manoir-stats";
interface ManorStats {
  attempts: number;
  escapes: number;
  /** Meilleur temps d'evasion en millisecondes (0 : aucun). */
  best: number;
}

function readStats(): ManorStats {
  try {
    const v = JSON.parse(localStorage.getItem(STATS_KEY) ?? "{}") as Partial<ManorStats>;
    const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x > 0 ? x : 0);
    return { attempts: n(v.attempts), escapes: n(v.escapes), best: n(v.best) };
  } catch {
    return { attempts: 0, escapes: 0, best: 0 };
  }
}

function saveStats(s: ManorStats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(s));
  } catch {
    // stockage indisponible : les chiffres valent pour cette visite
  }
}

function fmtTime(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m}:${String(s % 60).padStart(2, "0")}`;
}

export default function HorrorGame({
  title,
  devAllowed = false,
}: {
  title: string;
  /** Compte admin : acces au mode developpeur. Decide cote serveur. */
  devAllowed?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("lobby");
  const [seed, setSeed] = useState(0);
  /** Partie lancee depuis la carte « Mode developpeur » : panneau deja ouvert. */
  const [devLaunch, setDevLaunch] = useState(false);
  const [stats, setStats] = useState<ManorStats>({ attempts: 0, escapes: 0, best: 0 });
  /** Derniere evasion : le temps mis, et l'ancien record (0 : aucun). */
  const [lastRun, setLastRun] = useState<{ ms: number; previous: number } | null>(null);
  /** Debut de la partie en cours (on chronometre a partir de l'entree dans le manoir). */
  const startedAt = useRef(0);

  // Chiffres lus apres le premier rendu (le serveur ne les connait pas).
  useEffect(() => {
    const t = setTimeout(() => setStats(readStats()), 0);
    return () => clearTimeout(t);
  }, []);

  /** On entre dans le manoir : le chronometre part, une tentative de plus (hors mode developpeur). */
  function enter(dev: boolean) {
    startedAt.current = Date.now();
    if (!dev) {
      const next = { ...readStats(), attempts: readStats().attempts + 1 };
      setStats(next);
      saveStats(next);
    }
    setPhase("playing");
  }

  function launch(mode: HorrorMode) {
    setSeed(Date.now());
    // Ceinture et bretelles : meme si la carte etait forcee cote client, le
    // mode dev ne s'ouvre que si le serveur a reconnu un admin.
    const dev = mode === "developpeur" && devAllowed;
    setDevLaunch(dev);
    if (mode === "histoire") setPhase("cutscene");
    else enter(dev);
  }
  function replay() {
    setSeed(Date.now());
    enter(devLaunch);
  }

  /** Sortie du manoir : temps d'evasion et record (le mode developpeur ne compte pas). */
  function escaped() {
    const ms = Date.now() - startedAt.current;
    if (!devLaunch) {
      const cur = readStats();
      const next = { ...cur, escapes: cur.escapes + 1, best: cur.best === 0 || ms < cur.best ? ms : cur.best };
      setStats(next);
      saveStats(next);
      setLastRun({ ms, previous: cur.best });
    } else {
      setLastRun(null);
    }
    setPhase("ending");
  }

  if (phase === "lobby") {
    return <HorrorLobby title={title} onPlay={launch} devAllowed={devAllowed} />;
  }

  if (phase === "cutscene") {
    return <HorrorCutscene onDone={() => enter(devLaunch)} />;
  }

  if (phase === "ending") {
    return <HorrorEnding onDone={() => setPhase("escaped")} />;
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
        {stats.attempts > 0 && (
          <p className="relative text-xs text-zinc-500">
            {stats.escapes > 0
              ? `${stats.escapes} évasion${stats.escapes > 1 ? "s" : ""} sur ${stats.attempts} tentative${stats.attempts > 1 ? "s" : ""} · record ${fmtTime(stats.best)}`
              : `Tentative n°${stats.attempts} : personne ne s'est encore échappé.`}
          </p>
        )}
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
    const record = lastRun !== null && (lastRun.previous === 0 || lastRun.ms < lastRun.previous);
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-gradient-to-b from-emerald-950 to-black px-4">
        <span className="text-5xl">{record ? "🏆" : "🕊️"}</span>
        <p className="text-xl font-bold text-emerald-400">Tu t&apos;es échappé du manoir !</p>
        {lastRun && (
          <>
            <p className="font-mono text-3xl font-black text-amber-300">{fmtTime(lastRun.ms)}</p>
            <p className="text-sm text-zinc-300">
              {record
                ? lastRun.previous === 0
                  ? "Ta première évasion : c'est ton record."
                  : `Nouveau record ! (l'ancien : ${fmtTime(lastRun.previous)})`
                : `Record à battre : ${fmtTime(lastRun.previous)}`}
            </p>
            <p className="text-xs text-zinc-500">
              {stats.escapes} évasion{stats.escapes > 1 ? "s" : ""} sur {stats.attempts} tentative{stats.attempts > 1 ? "s" : ""}
            </p>
          </>
        )}
        <p className="max-w-sm text-center text-sm text-zinc-400">
          Le code, les reliques, le rituel, les trois sceaux et quarante-cinq secondes. Tu ne
          sauras jamais qui t&apos;a ouvert la porte.
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
      onEscape={escaped}
      devAllowed={devAllowed}
      devOpenAtStart={devLaunch}
    />
  );
}
