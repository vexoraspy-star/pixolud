"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Game3DSettings from "./Game3DSettings";
import { TankClassIcon } from "./TankIcons";
import type { BattleResult } from "./TankScene";
import {
  AMMO,
  CAMO_CHOICES,
  DIFFICULTIES,
  TANKS,
  TANK_CLASS_NAMES,
  damagePerMinute,
  rateOfFire,
  tankById,
  tierLabel,
  type Difficulty,
} from "@/lib/tanks/tankDefs";

const TankScene = dynamic(() => import("./TankScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-stone-950 text-zinc-300">
      <p className="text-lg font-black uppercase tracking-[0.3em] text-amber-300">Tonnerre d&apos;Acier</p>
      <p className="text-sm">Préparation du champ de bataille…</p>
    </div>
  ),
});
const TankGaragePreview = dynamic(() => import("./TankGaragePreview"), { ssr: false });

const CHAR_KEY = "pixolud-tanks-char";
const DIFF_KEY = "pixolud-tanks-difficulte";
const CAREER_KEY = "pixolud-tanks-carriere";
/** Camouflage choisi pour chaque char : { idDuChar: idDuCamouflage }. */
const CAMO_KEY = "pixolud-tanks-camouflages";

function readCamos(): Record<string, string> {
  try {
    const v = JSON.parse(localStorage.getItem(CAMO_KEY) ?? "{}") as unknown;
    if (!v || typeof v !== "object") return {};
    const out: Record<string, string> = {};
    for (const [k, id] of Object.entries(v as Record<string, unknown>)) {
      if (typeof id === "string" && CAMO_CHOICES.some((c) => c.id === id)) out[k] = id;
    }
    return out;
  } catch {
    return {};
  }
}

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

interface Career {
  battles: number;
  wins: number;
  xp: number;
  credits: number;
  bestDamage: number;
}

const EMPTY_CAREER: Career = { battles: 0, wins: 0, xp: 0, credits: 0, bestDamage: 0 };

function readCareer(): Career {
  try {
    const raw = localStorage.getItem(CAREER_KEY);
    if (!raw) return EMPTY_CAREER;
    const v = JSON.parse(raw) as Partial<Career>;
    return {
      battles: Number(v.battles) || 0,
      wins: Number(v.wins) || 0,
      xp: Number(v.xp) || 0,
      credits: Number(v.credits) || 0,
      bestDamage: Number(v.bestDamage) || 0,
    };
  } catch {
    return EMPTY_CAREER;
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // stockage indisponible : le choix vaut pour cette visite
  }
}

/** Une ligne de la fiche du char, avec une barre relative au meilleur de l'arsenal. */
function Stat({ label, value, ratio, unit = "" }: { label: string; value: string | number; ratio?: number; unit?: string }) {
  return (
    <div className="py-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className="font-mono font-bold text-zinc-100">
          {value}
          {unit && <span className="ml-0.5 text-[10px] font-normal text-zinc-400">{unit}</span>}
        </span>
      </div>
      {ratio !== undefined && (
        <div className="mt-0.5 h-1 overflow-hidden rounded bg-white/10">
          <div className="h-full bg-amber-400/80" style={{ width: `${Math.max(4, Math.min(100, ratio * 100))}%` }} />
        </div>
      )}
    </div>
  );
}

export default function TankGame({ title }: { title: string }) {
  const [tankId, setTankId] = useState("bouledogue");
  const [difficulty, setDifficulty] = useState<Difficulty>("veteran");
  const [screen, setScreen] = useState<"garage" | "bataille" | "resultats">("garage");
  const [battleKey, setBattleKey] = useState(0);
  const [result, setResult] = useState<BattleResult | null>(null);
  const [career, setCareer] = useState<Career>(EMPTY_CAREER);
  const [camos, setCamos] = useState<Record<string, string>>({});

  // Choix memorises (lus apres le premier rendu : le serveur ne les connait pas).
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const c = localStorage.getItem(CHAR_KEY);
        if (c && TANKS.some((d) => d.id === c)) setTankId(c);
        const d = localStorage.getItem(DIFF_KEY);
        if (d === "recrue" || d === "veteran" || d === "as") setDifficulty(d);
      } catch {
        // stockage indisponible
      }
      setCareer(readCareer());
      setCamos(readCamos());
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const def = tankById(tankId);
  const maxOf = (f: (d: (typeof TANKS)[number]) => number) => Math.max(...TANKS.map(f));

  function pickTank(id: string) {
    setTankId(id);
    save(CHAR_KEY, id);
  }

  function pickDifficulty(d: Difficulty) {
    setDifficulty(d);
    save(DIFF_KEY, d);
  }

  function pickCamo(id: string | null) {
    const next = { ...camos };
    if (id) next[tankId] = id;
    else delete next[tankId];
    setCamos(next);
    save(CAMO_KEY, JSON.stringify(next));
  }

  const camo = camos[tankId] ?? null;

  function startBattle() {
    setResult(null);
    setBattleKey((k) => k + 1);
    setScreen("bataille");
  }

  function endBattle(r: BattleResult) {
    const next: Career = {
      battles: career.battles + 1,
      wins: career.wins + (r.winner === 0 ? 1 : 0),
      xp: career.xp + r.xp,
      credits: career.credits + r.credits,
      bestDamage: Math.max(career.bestDamage, r.damage),
    };
    setCareer(next);
    save(CAREER_KEY, JSON.stringify(next));
    setResult(r);
    setScreen("resultats");
  }

  if (screen === "bataille") {
    return (
      <TankScene
        key={battleKey}
        tankId={tankId}
        camo={camo}
        difficulty={difficulty}
        onEnd={endBattle}
        onQuit={() => setScreen("garage")}
      />
    );
  }

  if (screen === "resultats" && result) {
    const win = result.winner === 0;
    const draw = result.winner === -1;
    return (
      <div className="flex h-full w-full flex-col items-center justify-center overflow-y-auto bg-gradient-to-b from-stone-900 to-black px-4 py-8 text-white">
        <p className={`text-5xl font-black uppercase tracking-widest ${win ? "text-green-400" : draw ? "text-zinc-200" : "text-red-400"}`}>
          {win ? "Victoire" : draw ? "Match nul" : "Défaite"}
        </p>
        <p className="mt-2 text-sm text-zinc-300">
          {result.reason === "capture"
            ? win
              ? "Ton équipe a capturé la base ennemie."
              : "L'ennemi a capturé notre base."
            : result.reason === "destruction"
              ? win
                ? "Tous les chars ennemis ont été détruits."
                : "Toute ton équipe a été détruite."
              : "Le temps est écoulé."}{" "}
          · {Math.floor(result.seconds / 60)} min {result.seconds % 60} s
        </p>
        <div className="mt-6 grid w-full max-w-lg grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Dégâts infligés", result.damage],
            ["Chars détruits", result.kills],
            ["Tirs au but", `${result.hits}/${result.shots}`],
            ["Pénétrations", result.pens],
            ["Dégâts reçus", result.damageTaken],
            ["Survie", result.survived ? "Oui" : "Non"],
            ["Expérience", `+${result.xp}`],
            ["Crédits", `+${result.credits}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
              <p className="text-[11px] text-zinc-400">{label}</p>
              <p className="mt-1 font-mono text-lg font-bold text-amber-200">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={startBattle}
            className="rounded-lg bg-amber-400 px-6 py-3 font-black uppercase tracking-wide text-black hover:bg-amber-300"
          >
            Nouvelle bataille
          </button>
          <button
            type="button"
            onClick={() => setScreen("garage")}
            className="rounded-lg border border-white/25 px-6 py-3 font-bold uppercase tracking-wide hover:bg-white/10"
          >
            Garage
          </button>
        </div>
      </div>
    );
  }

  // --- Garage ---
  const winRate = career.battles > 0 ? Math.round((career.wins / career.battles) * 100) : 0;
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#141512] text-white">
      {/* Barre du haut */}
      <div className="z-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/10 bg-black/60 px-3 py-2">
        <Link href="/mode-3d" className="text-xs text-zinc-400 hover:text-amber-300">
          ← Mode 3D
        </Link>
        <p className="text-sm font-black uppercase tracking-[0.25em] text-amber-300">{title}</p>
        <div className="flex gap-3 font-mono text-[11px] text-zinc-300">
          <span>
            Batailles <b className="text-white">{career.battles}</b>
          </span>
          <span>
            Victoires <b className="text-white">{winRate}%</b>
          </span>
          <span>
            XP <b className="text-amber-200">{career.xp}</b>
          </span>
          <span>
            Crédits <b className="text-amber-200">{career.credits}</b>
          </span>
        </div>
        <div className="flex w-full flex-wrap items-center justify-between gap-2 pr-12 sm:ml-auto sm:w-auto sm:justify-end">
          <div className="flex overflow-hidden rounded-md border border-white/15">
            {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
              <button
                key={d}
                type="button"
                title={DIFFICULTIES[d].tagline}
                onClick={() => pickDifficulty(d)}
                className={`px-2.5 py-1.5 text-[11px] font-bold uppercase ${
                  difficulty === d ? "bg-amber-400 text-black" : "bg-white/5 text-zinc-300 hover:bg-white/10"
                }`}
              >
                {DIFFICULTIES[d].name}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={startBattle}
            className="whitespace-nowrap rounded-md bg-gradient-to-b from-orange-500 to-red-700 px-4 py-2 text-sm font-black uppercase tracking-widest shadow-lg shadow-red-900/40 ring-1 ring-orange-300/60 hover:from-orange-400 sm:px-6 sm:text-base"
          >
            Combat !
          </button>
        </div>
      </div>

      {/* Centre : le char et sa fiche */}
      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="relative min-h-[180px] flex-1 overflow-hidden">
          <TankGaragePreview tankId={tankId} camo={camo} />
          {/* Camouflages : l'origine et six peintures, dont quatre numeriques. */}
          <div className="absolute inset-x-2 bottom-2 flex flex-wrap items-center gap-1.5 rounded-md bg-black/55 p-1.5 sm:inset-x-auto sm:left-3">
            <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-300">Camouflage</span>
            <button
              type="button"
              onClick={() => pickCamo(null)}
              className={`rounded px-2 py-1 text-[10px] font-bold ${camo === null ? "bg-amber-400 text-black" : "bg-white/10 text-zinc-200 hover:bg-white/20"}`}
            >
              Origine
            </button>
            {CAMO_CHOICES.map((c) => (
              <button
                key={c.id}
                type="button"
                title={c.name}
                aria-label={c.name}
                onClick={() => pickCamo(c.id)}
                className={`h-7 w-7 overflow-hidden rounded ring-2 ${camo === c.id ? "ring-amber-400" : "ring-white/15 hover:ring-white/50"}`}
                style={{
                  background:
                    c.style === "numerique"
                      ? `conic-gradient(${hex(c.camo)} 0 25%, ${hex(c.color)} 0 50%, ${hex(c.camo2)} 0 75%, ${hex(c.color)} 0) 0 0 / 50% 50%`
                      : `linear-gradient(135deg, ${hex(c.color)} 0 40%, ${hex(c.camo)} 40% 70%, ${hex(c.camo2)} 70%)`,
                }}
              />
            ))}
          </div>
          <div className="pointer-events-none absolute left-3 top-3 sm:left-4 sm:top-4">
            <p className="flex items-center gap-2 text-xl font-black sm:text-2xl">
              <span className="font-mono text-lg text-amber-300">{tierLabel(def.tier)}</span>
              <TankClassIcon cls={def.cls} className="h-5 w-5 text-amber-300" />
              {def.name}
            </p>
            <p className="text-xs uppercase tracking-wider text-zinc-400">{TANK_CLASS_NAMES[def.cls]}</p>
            <p className="mt-2 hidden max-w-xs text-xs text-zinc-300 sm:block">{def.description}</p>
          </div>
        </div>
        <div className="max-h-[36vh] w-full shrink-0 overflow-y-auto border-t border-white/10 bg-black/55 p-3 md:max-h-none md:w-72 md:border-l md:border-t-0">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-amber-300">Caractéristiques</p>
          <Stat label="Points de structure" value={def.hp} ratio={def.hp / maxOf((d) => d.hp)} />
          <Stat label="Dégâts (perforant)" value={def.ammo.perforant.damage} ratio={def.ammo.perforant.damage / maxOf((d) => d.ammo.perforant.damage)} />
          <Stat
            label="Pénétration"
            value={`${def.ammo.perforant.penetration} / ${def.ammo.sousCalibre.penetration} / ${def.ammo.explosif.penetration}`}
            unit="mm"
            ratio={def.ammo.perforant.penetration / maxOf((d) => d.ammo.perforant.penetration)}
          />
          <Stat label="Calibre" value={def.caliber} unit="mm" />
          <Stat label="Cadence de tir" value={rateOfFire(def).toFixed(1)} unit="coups/min" ratio={rateOfFire(def) / maxOf(rateOfFire)} />
          {def.clip && (
            <Stat
              label="Canon automatique"
              value={`${def.clip.size} obus, ${def.clip.interval.toFixed(2).replace(".", ",")} s`}
            />
          )}
          <Stat
            label="Dégâts par minute"
            value={Math.round(damagePerMinute(def))}
            ratio={damagePerMinute(def) / maxOf(damagePerMinute)}
          />
          <Stat label="Temps de visée" value={def.aimTime.toFixed(1)} unit="s" ratio={1 - def.aimTime / 4} />
          <Stat label="Dispersion à 100 m" value={def.dispersion.toFixed(2)} unit="m" ratio={1 - def.dispersion / 0.6} />
          <Stat label="Vitesse maximale" value={def.speed} unit="km/h" ratio={def.speed / maxOf((d) => d.speed)} />
          <Stat label="Rotation de la caisse" value={def.hullTraverse} unit="°/s" ratio={def.hullTraverse / maxOf((d) => d.hullTraverse)} />
          <Stat
            label="Blindage caisse"
            value={`${def.hull.front} / ${def.hull.side} / ${def.hull.rear}`}
            unit="mm"
            ratio={def.hull.front / maxOf((d) => d.hull.front)}
          />
          <Stat
            label="Blindage tourelle"
            value={`${def.turret.front} / ${def.turret.side} / ${def.turret.rear}`}
            unit="mm"
            ratio={def.turret.front / maxOf((d) => d.turret.front)}
          />
          <Stat label="Portée de vue" value={def.viewRange} unit="m" ratio={def.viewRange / maxOf((d) => d.viewRange)} />
          <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-amber-300">Obus</p>
          {(["perforant", "sousCalibre", "explosif"] as const).map((a) => (
            <p key={a} className="mt-1 text-[11px] text-zinc-300">
              <b className="text-white">{AMMO[a].name}</b> : {def.ammo[a].penetration} mm, {def.ammo[a].damage} dégâts, {def.ammo[a].count} obus.{" "}
              <span className="text-zinc-500">{AMMO[a].description}</span>
            </p>
          ))}
        </div>
      </div>

      {/* Bas : le carrousel des chars */}
      <div className="flex gap-2 overflow-x-auto border-t border-white/10 bg-black/70 p-2">
        {TANKS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => pickTank(d.id)}
            className={`min-w-[132px] rounded-md border p-2 text-left transition ${
              d.id === tankId ? "border-amber-300 bg-amber-300/15" : "border-white/10 bg-white/5 hover:bg-white/10"
            }`}
          >
            <p className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <span className="font-mono text-amber-300">{tierLabel(d.tier)}</span>
              <TankClassIcon cls={d.cls} className="h-3.5 w-3.5 text-zinc-300" />
              {TANK_CLASS_NAMES[d.cls]}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-black">
              {d.name}
              {d.clip && (
                <span className="rounded bg-orange-500/80 px-1 text-[9px] font-bold uppercase tracking-wide text-white">Rafale</span>
              )}
            </p>
            <p className="font-mono text-[10px] text-zinc-400">
              {d.hp} PS · {d.ammo.perforant.damage} dég.
            </p>
          </button>
        ))}
      </div>

      <Game3DSettings />
    </div>
  );
}
