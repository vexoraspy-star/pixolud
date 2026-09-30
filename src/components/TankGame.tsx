"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Game3DSettings from "./Game3DSettings";
import { ShellIcon, TankClassIcon } from "./TankIcons";
import type { BattleResult } from "./TankScene";
import {
  AMMO,
  AMMO_ORDER,
  CAMO_CHOICES,
  DIFFICULTIES,
  MODES,
  TANKS,
  TANK_CLASS_NAMES,
  damagePerMinute,
  rateOfFire,
  tankById,
  tanksForMode,
  tierLabel,
  type BattleMode,
  type Difficulty,
  type TankClass,
  type TankDef,
} from "@/lib/tanks/tankDefs";
import { MAP_LIST, mapInfo, type MapId } from "@/lib/tanks/tankTerrain";
import {
  EMPTY_CAREER,
  MEDALS,
  mastery,
  medalsFor,
  readCareer,
  saveCareer,
  starterTanks,
  unlock,
  unlockCost,
  unlockState,
  type Career,
  type Medal,
} from "@/lib/tanks/tankCareer";

// « Tonnerre d'Acier » hors bataille : le garage (mode de jeu, carte,
// difficulte, char et sa fiche, camouflage), l'arbre des chars a debloquer,
// le profil (statistiques, medailles, maitrise, journal) et l'ecran de fin de
// bataille (gains, performance, tableau des scores).

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
/** Camouflage choisi pour chaque char : { idDuChar: idDuCamouflage }. */
const CAMO_KEY = "pixolud-tanks-camouflages";
/** Carte choisie au garage, ou « hasard ». */
const MAP_KEY = "pixolud-tanks-carte";
/** Mode de bataille choisi au garage. */
const MODE_KEY = "pixolud-tanks-mode";

type MapChoice = MapId | "hasard";
type Tab = "garage" | "chars" | "profil";

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

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // stockage indisponible : le choix vaut pour cette visite
  }
}

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR");

/** Le type d'arme d'un char, pour la fiche. */
function weaponKind(def: TankDef): string {
  if (def.artyAngle !== undefined) return "Obusier";
  if (def.look.gatling) return "Canon Gatling";
  if (def.look.twinMG) return "Mitrailleuses jumelées";
  if (def.look.autocannon) return "Canon automatique";
  if (def.clip) return "Canon à barillet";
  return "Canon";
}

// ------------------------------------------------------------ petits blocs

/** Un panneau : un bandeau rouge et son titre, puis le contenu. */
function Panel({ title, children, className = "", right }: { title: string; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <section className={`overflow-hidden rounded-md border border-white/10 bg-black/60 backdrop-blur-sm ${className}`}>
      <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-red-800/90 via-red-900/80 to-transparent px-3 py-1.5">
        <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-white">{title}</h2>
        {right}
      </div>
      <div className="p-2.5">{children}</div>
    </section>
  );
}

/** Une ligne de la fiche du char, avec une barre relative au meilleur de l'arsenal. */
function Stat({ label, value, ratio, unit = "" }: { label: string; value: string | number; ratio?: number; unit?: string }) {
  return (
    <div className="py-0.5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className="font-mono font-bold text-zinc-100">
          {value}
          {unit && <span className="ml-0.5 text-[10px] font-normal text-zinc-400">{unit}</span>}
        </span>
      </div>
      {ratio !== undefined && (
        <div className="mt-0.5 h-1 overflow-hidden rounded bg-white/10">
          <div className="h-full bg-gradient-to-r from-amber-500 to-amber-300" style={{ width: `${Math.max(4, Math.min(100, ratio * 100))}%` }} />
        </div>
      )}
    </div>
  );
}

/** Une medaille : un ruban et un disque de metal frappe d'un symbole. */
function MedalBadge({ medal, count, dim = false, size = 40 }: { medal: Medal; count?: number; dim?: boolean; size?: number }) {
  const id = useId();
  const [light, dark] = medal.metal === "or" ? ["#fde68a", "#b7791f"] : medal.metal === "argent" ? ["#f1f5f9", "#7c8896"] : ["#f0b07a", "#8a4f22"];
  return (
    <span className={`relative inline-block ${dim ? "opacity-30 grayscale" : ""}`} title={`${medal.name} : ${medal.description}`}>
      <svg viewBox="0 0 40 50" width={size} height={size * 1.25} aria-label={medal.name}>
        <defs>
          <radialGradient id={id} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor={light} />
            <stop offset="100%" stopColor={dark} />
          </radialGradient>
        </defs>
        <path d="M11 0h8l-3 17h-8zM21 0h8l3 17h-8z" fill="#9f1d1d" />
        <path d="M13 0h2l-3 17h-2zM25 0h2l3 17h-2z" fill="#e5e7eb" opacity=".6" />
        <circle cx="20" cy="33" r="14" fill={`url(#${id})`} stroke={dark} strokeWidth="1.5" />
        <circle cx="20" cy="33" r="10.5" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1" />
        <text x="20" y="38.5" textAnchor="middle" fontSize="14" fontWeight="bold" fill="rgba(40,24,8,.8)">
          {medal.icon}
        </text>
      </svg>
      {count !== undefined && count > 0 && (
        <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1 text-[9px] font-black text-white">×{count}</span>
      )}
    </span>
  );
}

/** Badge de maitrise d'un char. */
function MasteryBadge({ rank, label }: { rank: number; label: string }) {
  const colors = ["", "bg-orange-900/70 text-orange-200", "bg-zinc-600/70 text-zinc-100", "bg-amber-500/80 text-black", "bg-red-600 text-white"];
  return <span className={`rounded px-1 text-[9px] font-black uppercase tracking-wide ${colors[rank]}`}>{label}</span>;
}

function Cost({ def }: { def: TankDef }) {
  const cost = unlockCost(def);
  return (
    <span className="font-mono">
      {fmt(cost.xp)} <span className="text-sky-300">XP</span> · {fmt(cost.credits)} <span className="text-amber-300">cr.</span>
    </span>
  );
}

// ------------------------------------------------------------------ jeu

export default function TankGame({ title, admin = false }: { title: string; /** Compte admin : tous les chars sont au garage. */ admin?: boolean }) {
  const [tankId, setTankId] = useState("bouledogue");
  const [difficulty, setDifficulty] = useState<Difficulty>("veteran");
  const [screen, setScreen] = useState<"garage" | "bataille" | "resultats">("garage");
  const [tab, setTab] = useState<Tab>("garage");
  const [battleKey, setBattleKey] = useState(0);
  const [result, setResult] = useState<BattleResult | null>(null);
  const [earned, setEarned] = useState<string[]>([]);
  const [career, setCareer] = useState<Career>({ ...EMPTY_CAREER, owned: starterTanks() });
  const [camos, setCamos] = useState<Record<string, string>>({});
  const [mapChoice, setMapChoice] = useState<MapChoice>("hasard");
  const [mode, setMode] = useState<BattleMode>("normale");
  /** Carte de la bataille en cours (tiree au sort au lancement si « hasard »). */
  const [battleMap, setBattleMap] = useState<MapId | null>(null);
  const [resultTab, setResultTab] = useState<"perso" | "scores">("perso");
  const [flash, setFlash] = useState<string | null>(null);

  // Choix memorises (lus apres le premier rendu : le serveur ne les connait pas).
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const c = localStorage.getItem(CHAR_KEY);
        if (c && TANKS.some((d) => d.id === c)) setTankId(c);
        const d = localStorage.getItem(DIFF_KEY);
        if (d === "recrue" || d === "veteran" || d === "as") setDifficulty(d);
        const m = localStorage.getItem(MAP_KEY);
        if (m && (m === "hasard" || MAP_LIST.some((x) => x.id === m))) setMapChoice(m as MapChoice);
        const md = localStorage.getItem(MODE_KEY);
        if (md === "normale" || md === "cent") setMode(md);
      } catch {
        // stockage indisponible
      }
      setCareer(readCareer());
      setCamos(readCamos());
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 3200);
    return () => clearTimeout(t);
  }, [flash]);

  const maxOf = (f: (d: TankDef) => number) => Math.max(...TANKS.map(f));
  // Un admin possede tous les chars (sans rien changer a la carriere enregistree).
  const garage: Career = admin ? { ...career, owned: TANKS.map((t) => t.id) } : career;
  const modeTanks = tanksForMode(mode);
  // Un char d'un autre mode (memorise) : on montre le premier du mode.
  const shownId = modeTanks.some((d) => d.id === tankId) ? tankId : modeTanks[0].id;
  const def = tankById(shownId);
  const camo = camos[shownId] ?? null;
  const state = unlockState(garage, def);
  const mast = mastery(career.bestByTank[def.id] ?? 0, def);

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
    if (id) next[shownId] = id;
    else delete next[shownId];
    setCamos(next);
    save(CAMO_KEY, JSON.stringify(next));
  }

  function pickMap(m: MapChoice) {
    setMapChoice(m);
    save(MAP_KEY, m);
  }

  /** Changer de mode : si le char choisi n'y joue pas, on prend le meilleur char possede du mode. */
  function pickMode(m: BattleMode) {
    setMode(m);
    save(MODE_KEY, m);
    const list = tanksForMode(m);
    if (!list.some((d) => d.id === tankId)) {
      const owned = list.filter((d) => garage.owned.includes(d.id)).sort((a, b) => b.tier - a.tier);
      pickTank((owned[0] ?? list[0]).id);
    }
  }

  /** Depuis l'arbre des chars : on choisit le char (et son mode) et on revient au garage. */
  function openTank(d: TankDef) {
    if (!tanksForMode(mode).some((x) => x.id === d.id)) {
      const m: BattleMode = d.tier >= MODES.cent.tiers[0] && d.tier > MODES.normale.tiers[1] ? "cent" : "normale";
      setMode(m);
      save(MODE_KEY, m);
    }
    pickTank(d.id);
    setTab("garage");
  }

  function buy(d: TankDef) {
    const next = unlock(career, d);
    if (!next) return;
    setCareer(next);
    saveCareer(next);
    setFlash(`${d.name} rejoint ton garage !`);
  }

  function startBattle() {
    if (!garage.owned.includes(shownId)) return;
    // Au hasard : jamais deux fois de suite la meme carte.
    const pool = MAP_LIST.filter((m) => m.id !== battleMap);
    setBattleMap(mapChoice === "hasard" ? pool[Math.floor(Math.random() * pool.length)].id : mapChoice);
    setResult(null);
    setBattleKey((k) => k + 1);
    setScreen("bataille");
  }

  function endBattle(r: BattleResult) {
    const d = tankById(r.tankId);
    const medals = medalsFor(
      {
        winner: r.winner,
        damage: r.damage,
        kills: r.kills,
        shots: r.shots,
        hits: r.hits,
        damageTaken: r.damageTaken,
        damageBlocked: r.damageBlocked,
        assist: r.assist,
        detections: r.detections,
        survived: r.survived,
        topDamage: Math.max(0, ...r.board.map((b) => b.damage)),
      },
      d,
    );
    const nextMedals = { ...career.medals };
    for (const m of medals) nextMedals[m] = (nextMedals[m] ?? 0) + 1;
    const next: Career = {
      ...career,
      battles: career.battles + 1,
      wins: career.wins + (r.winner === 0 ? 1 : 0),
      xp: career.xp + r.xp,
      xpFree: career.xpFree + r.xp,
      credits: career.credits + r.credits,
      bestDamage: Math.max(career.bestDamage, r.damage),
      damageTotal: career.damageTotal + r.damage,
      kills: career.kills + r.kills,
      survived: career.survived + (r.survived ? 1 : 0),
      medals: nextMedals,
      bestByTank: { ...career.bestByTank, [d.id]: Math.max(career.bestByTank[d.id] ?? 0, r.damage) },
      log: [
        {
          at: Date.now(),
          mode: r.mode,
          map: r.mapName,
          tank: d.name,
          outcome: r.winner === 0 ? 1 : r.winner === -1 ? 0 : -1,
          damage: r.damage,
          kills: r.kills,
          xp: r.xp,
        } as const,
        ...career.log,
      ].slice(0, 12),
    };
    setCareer(next);
    saveCareer(next);
    setEarned(medals);
    setResult(r);
    setResultTab("perso");
    setScreen("resultats");
  }

  // ------------------------------------------------------------ bataille

  if (screen === "bataille" && battleMap) {
    return (
      <TankScene
        key={battleKey}
        tankId={shownId}
        camo={camos[shownId] ?? null}
        mapId={battleMap}
        mode={mode}
        difficulty={difficulty}
        onEnd={endBattle}
        onQuit={() => setScreen("garage")}
      />
    );
  }

  // ------------------------------------------------------------ resultats

  if (screen === "resultats" && result) {
    const win = result.winner === 0;
    const draw = result.winner === -1;
    const d = tankById(result.tankId);
    const newMastery = mastery(result.damage, d);
    const perf: [string, string | number, string][] = [
      ["Détruits", result.kills, "✠"],
      ["Dégâts", fmt(result.damage), "✹"],
      ["Tirs au but", `${result.hits}/${result.shots}`, "◎"],
      ["Aide au repérage", fmt(result.assist), "◉"],
      ["Bloqués", fmt(result.damageBlocked), "▣"],
      ["Repérages", result.detections, "👁"],
    ];
    const teams = [0, 1].map((team) => result.board.filter((b) => b.team === team).sort((a, b) => b.damage - a.damage));
    return (
      <div className="flex h-full w-full flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top,#2a0f0f_0%,#0b0b0a_60%)] text-white">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-red-900/60 bg-black/60 px-4 pb-2 pt-3">
          <div>
            <p className={`text-3xl font-black uppercase tracking-[0.25em] sm:text-4xl ${win ? "text-green-400" : draw ? "text-zinc-200" : "text-red-500"}`}>
              {win ? "Victoire" : draw ? "Match nul" : "Défaite"}
            </p>
            <p className="text-xs text-zinc-400">
              {result.reason === "capture"
                ? win
                  ? "Ton équipe a capturé la base ennemie."
                  : "L'ennemi a capturé notre base."
                : result.reason === "destruction"
                  ? win
                    ? "Tous les chars ennemis ont été détruits."
                    : "Toute ton équipe a été détruite."
                  : "Le temps est écoulé."}
            </p>
          </div>
          <div className="flex overflow-hidden rounded border border-white/15">
            {(
              [
                ["perso", "Personnel"],
                ["scores", "Tableau des scores"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setResultTab(k)}
                className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-wider ${resultTab === k ? "bg-red-700 text-white" : "bg-white/5 text-zinc-300 hover:bg-white/10"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {resultTab === "perso" ? (
            <div className="mx-auto grid max-w-4xl gap-3">
              <div className="grid grid-cols-2 gap-2 rounded-md border border-white/10 bg-black/50 p-3 text-center sm:grid-cols-4">
                {[
                  ["Carte", result.mapName],
                  ["Mode", MODES[result.mode].name],
                  ["Durée", `${Math.floor(result.seconds / 60)} min ${String(result.seconds % 60).padStart(2, "0")} s`],
                  ["Char", d.name],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{k}</p>
                    <p className="text-sm font-black text-zinc-100">{v}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_1.4fr]">
                <Panel title="Gains">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded bg-white/5 px-3 py-2">
                      <span className="text-xs uppercase tracking-wider text-zinc-400">Crédits</span>
                      <span className="font-mono text-lg font-black text-amber-300">+{fmt(result.credits)}</span>
                    </div>
                    <div className="flex items-center justify-between rounded bg-white/5 px-3 py-2">
                      <span className="text-xs uppercase tracking-wider text-zinc-400">Expérience</span>
                      <span className="font-mono text-lg font-black text-sky-300">+{fmt(result.xp)}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Total : {fmt(career.credits)} crédits · {fmt(career.xpFree)} XP libre
                    </p>
                  </div>
                </Panel>
                <Panel title="Performance">
                  <div className="grid grid-cols-3 gap-2">
                    {perf.map(([k, v, icon]) => (
                      <div key={k} className="rounded bg-white/5 p-2 text-center">
                        <p className="text-lg leading-none text-zinc-300">{icon}</p>
                        <p className="mt-1 font-mono text-base font-black text-white">{v}</p>
                        <p className="text-[10px] uppercase tracking-wide text-zinc-500">{k}</p>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
              <Panel title="Médailles de la bataille">
                {earned.length === 0 ? (
                  <p className="text-xs text-zinc-400">Aucune médaille cette fois. Vise les points faibles, et reste en vie !</p>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {earned.map((id) => {
                      const m = MEDALS.find((x) => x.id === id)!;
                      return (
                        <div key={id} className="flex items-center gap-2">
                          <MedalBadge medal={m} size={34} />
                          <div>
                            <p className="text-xs font-black text-white">{m.name}</p>
                            <p className="max-w-[12rem] text-[10px] text-zinc-400">{m.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {newMastery && (career.bestByTank[d.id] ?? 0) <= result.damage && (
                  <p className="mt-2 flex items-center gap-2 text-xs text-zinc-300">
                    Maîtrise du {d.name} : <MasteryBadge rank={newMastery.rank} label={newMastery.label} />
                  </p>
                )}
              </Panel>
            </div>
          ) : (
            <div className="mx-auto grid max-w-5xl gap-3 md:grid-cols-2">
              {teams.map((list, team) => (
                <Panel key={team} title={team === 0 ? "Ton équipe" : "Ennemis"}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-zinc-500">
                        <th className="pb-1 text-left">Char</th>
                        <th className="pb-1 text-left">Équipage</th>
                        <th className="pb-1 text-right">Dégâts</th>
                        <th className="pb-1 text-right">Détr.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((b, i) => (
                        <tr key={i} className={`border-t border-white/5 ${b.isPlayer ? "bg-amber-400/15" : ""} ${b.alive ? "" : "text-zinc-500"}`}>
                          <td className="py-1">
                            <span className="flex items-center gap-1.5">
                              <TankClassIcon cls={b.cls} className={`h-3 w-3 ${team === 0 ? "text-green-400" : "text-red-400"}`} />
                              <span className="font-mono text-[10px] text-amber-300">{tierLabel(b.tier)}</span>
                              <span className={b.alive ? "font-bold text-white" : "line-through"}>{b.tank}</span>
                            </span>
                          </td>
                          <td className="py-1">{b.name}</td>
                          <td className="py-1 text-right font-mono">{fmt(b.damage)}</td>
                          <td className="py-1 text-right font-mono">{b.kills}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Panel>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-center gap-3 border-t border-white/10 bg-black/60 p-3">
          <button
            type="button"
            onClick={startBattle}
            className="rounded bg-gradient-to-b from-red-600 to-red-800 px-6 py-2.5 text-sm font-black uppercase tracking-widest shadow-lg shadow-red-950/60 ring-1 ring-red-400/50 hover:from-red-500"
          >
            Nouvelle bataille
          </button>
          <button
            type="button"
            onClick={() => setScreen("garage")}
            className="rounded border border-white/25 px-6 py-2.5 text-sm font-bold uppercase tracking-widest hover:bg-white/10"
          >
            Garage
          </button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------- garage

  const winRate = career.battles > 0 ? Math.round((career.wins / career.battles) * 100) : 0;
  const tabs: [Tab, string][] = [
    ["garage", "Garage"],
    ["chars", "Chars"],
    ["profil", "Profil"],
  ];

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0d0e0c] text-white">
      {/* Barre du haut : onglets et ressources */}
      <div className="z-10 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-red-900/70 bg-gradient-to-b from-black to-[#1b0d0c] px-3 py-1.5 pr-14">
        <Link href="/mode-3d" className="text-xs text-zinc-400 hover:text-red-300">
          ← Mode 3D
        </Link>
        <p className="text-sm font-black uppercase tracking-[0.25em] text-red-500">{title}</p>
        <nav className="flex gap-1">
          {tabs.map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`border-b-2 px-2.5 py-1 text-xs font-black uppercase tracking-widest ${tab === k ? "border-red-500 text-white" : "border-transparent text-zinc-400 hover:text-zinc-200"}`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="flex gap-3 font-mono text-[11px] text-zinc-300 sm:ml-auto">
          <span title="Crédits : ils servent à acheter les chars">
            <b className="text-amber-300">{fmt(career.credits)}</b> cr.
          </span>
          <span title="Expérience libre : elle sert à débloquer les chars">
            <b className="text-sky-300">{fmt(career.xpFree)}</b> XP
          </span>
          <span className="hidden sm:inline">
            {career.battles} batailles · {winRate} % victoires
          </span>
          {admin && (
            <span className="rounded bg-red-700 px-1.5 font-sans text-[10px] font-black uppercase tracking-wider text-white" title="Compte admin : tous les chars sont débloqués">
              Admin · tous les chars
            </span>
          )}
        </div>
      </div>

      {flash && (
        <p className="absolute left-1/2 top-12 z-30 -translate-x-1/2 rounded bg-green-600 px-4 py-2 text-sm font-black text-white shadow-lg">{flash}</p>
      )}

      {tab === "garage" && (
        <>
          <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
            {/* Gauche : mode de jeu et bataille */}
            <div className="order-2 flex shrink-0 flex-col gap-2 p-2 md:order-1 md:w-60 md:overflow-y-auto">
              <Panel title="Mode de jeu">
                <div className="flex gap-2 md:flex-col">
                  {(["cent", "normale"] as const).map((m) => {
                    const info = MODES[m];
                    const hasTank = tanksForMode(m).some((d) => garage.owned.includes(d.id));
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => pickMode(m)}
                        className={`flex-1 rounded border p-2 text-left transition ${
                          mode === m ? "border-red-500 ring-1 ring-red-500" : "border-white/10 hover:border-white/30"
                        } ${m === "cent" ? "bg-gradient-to-br from-red-900/80 to-black" : "bg-gradient-to-br from-stone-700/60 to-black"}`}
                      >
                        <p className="text-xs font-black uppercase tracking-widest text-white">{info.name}</p>
                        <p className="mt-0.5 text-[10px] leading-snug text-zinc-300">
                          Rangs {tierLabel(info.tiers[0])} à {tierLabel(info.tiers[1])} · {info.teamSize} contre {info.teamSize}
                        </p>
                        {!hasTank && <p className="mt-1 text-[10px] font-bold text-orange-300">Débloque un char de rang {tierLabel(info.tiers[0])}</p>}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 hidden text-[10px] leading-snug text-zinc-400 md:block">{MODES[mode].tagline}</p>
              </Panel>
              <Panel title="Bataille">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Carte
                  <select
                    value={mapChoice}
                    onChange={(e) => pickMap(e.target.value as MapChoice)}
                    title={mapChoice === "hasard" ? "Une carte différente à chaque bataille" : mapInfo(mapChoice).tagline}
                    className="mt-1 w-full rounded border border-white/15 bg-black/80 px-2 py-1.5 text-xs font-bold normal-case text-zinc-100"
                  >
                    <option value="hasard">Au hasard</option>
                    {MAP_LIST.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Difficulté</p>
                <div className="mt-1 flex overflow-hidden rounded border border-white/15">
                  {(Object.keys(DIFFICULTIES) as Difficulty[]).map((dd) => (
                    <button
                      key={dd}
                      type="button"
                      title={DIFFICULTIES[dd].tagline}
                      onClick={() => pickDifficulty(dd)}
                      className={`flex-1 px-1.5 py-1.5 text-[10px] font-black uppercase ${
                        difficulty === dd ? "bg-red-700 text-white" : "bg-white/5 text-zinc-300 hover:bg-white/10"
                      }`}
                    >
                      {DIFFICULTIES[dd].name}
                    </button>
                  ))}
                </div>
              </Panel>
            </div>

            {/* Centre : le char dans le hangar */}
            <div className="relative order-1 h-[46vh] min-h-[220px] shrink-0 overflow-hidden md:order-2 md:h-auto md:flex-1 md:shrink">
              <TankGaragePreview tankId={shownId} camo={camo} />
              <div className="pointer-events-none absolute left-3 top-3">
                <p className="flex items-center gap-2 text-xl font-black sm:text-2xl">
                  <span className="font-mono text-lg text-amber-300">{tierLabel(def.tier)}</span>
                  <TankClassIcon cls={def.cls} className="h-5 w-5 text-amber-300" />
                  {def.name}
                  {mast && <MasteryBadge rank={mast.rank} label={mast.label} />}
                </p>
                <p className="text-xs uppercase tracking-wider text-zinc-400">
                  {TANK_CLASS_NAMES[def.cls]} · {weaponKind(def)} de {def.caliber} mm
                </p>
              </div>
              {/* Camouflages */}
              <div className="absolute bottom-2 left-2 flex max-w-[calc(100%-11rem)] flex-wrap items-center gap-1.5 rounded bg-black/60 p-1.5">
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
              {/* Combat, ou deblocage du char */}
              <div className="absolute bottom-2 right-2 flex flex-col items-end gap-1">
                {state === "possede" ? (
                  <button
                    type="button"
                    onClick={startBattle}
                    className="rounded bg-gradient-to-b from-red-600 to-red-800 px-6 py-3 text-base font-black uppercase tracking-[0.2em] shadow-xl shadow-red-950/70 ring-1 ring-red-400/60 hover:from-red-500 sm:px-9 sm:text-lg"
                  >
                    Combat !
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={state !== "disponible"}
                      onClick={() => buy(def)}
                      className="rounded bg-gradient-to-b from-green-600 to-green-800 px-5 py-2.5 text-sm font-black uppercase tracking-widest ring-1 ring-green-300/50 enabled:hover:from-green-500 disabled:from-zinc-700 disabled:to-zinc-800 disabled:text-zinc-400 disabled:ring-white/10"
                    >
                      Débloquer
                    </button>
                    <p className="rounded bg-black/70 px-2 py-1 text-[10px] text-zinc-200">
                      {state === "verrouille" ? `Il faut d'abord un char de rang ${tierLabel(def.tier - 1)}` : <Cost def={def} />}
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Droite : la fiche du char */}
            <div className="order-3 shrink-0 p-2 md:w-72 md:overflow-y-auto">
              <Panel title="Caractéristiques">
                <Stat label="Pénétration" value={`${def.ammo.perforant.penetration} / ${def.ammo.sousCalibre.penetration} / ${def.ammo.explosif.penetration}`} unit="mm" ratio={def.ammo.perforant.penetration / maxOf((d) => d.ammo.perforant.penetration)} />
                <Stat label="Dégâts" value={def.ammo.perforant.damage} ratio={def.ammo.perforant.damage / maxOf((d) => d.ammo.perforant.damage)} />
                <Stat label="Points de structure" value={def.hp} ratio={def.hp / maxOf((d) => d.hp)} />
                <Stat label="Vitesse maximale" value={def.speed} unit="km/h" ratio={def.speed / maxOf((d) => d.speed)} />
                <Stat label="Portée de vue" value={def.viewRange} unit="m" ratio={def.viewRange / maxOf((d) => d.viewRange)} />
              </Panel>
              <Panel title="Armement" className="mt-2">
                <p className="mb-1 text-xs font-bold text-zinc-100">
                  {weaponKind(def)} de {def.caliber} mm
                </p>
                <Stat label="Cadence de tir" value={rateOfFire(def).toFixed(1)} unit="coups/min" ratio={rateOfFire(def) / maxOf(rateOfFire)} />
                {def.clip && <Stat label="Chargeur" value={`${def.clip.size} obus, ${def.clip.interval.toFixed(2).replace(".", ",")} s`} />}
                <Stat label="Dégâts par minute" value={Math.round(damagePerMinute(def))} ratio={damagePerMinute(def) / maxOf(damagePerMinute)} />
                <Stat label="Temps de visée" value={def.aimTime.toFixed(1)} unit="s" ratio={1 - def.aimTime / 5.5} />
                <Stat label="Dispersion à 100 m" value={def.dispersion.toFixed(2)} unit="m" ratio={1 - def.dispersion / 1} />
                {def.artyRange && <Stat label="Portée de l'obusier" value={def.artyRange} unit="m" />}
                {def.splash && <Stat label="Rayon d'explosion" value={def.splash} unit="m" />}
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {AMMO_ORDER.map((a) => (
                    <div key={a} className="rounded border border-white/10 bg-white/5 p-1.5 text-center" title={AMMO[a].description}>
                      <ShellIcon ammo={a} className="mx-auto h-7 w-3" />
                      <p className="mt-0.5 text-[9px] font-black uppercase text-zinc-200">{AMMO[a].short}</p>
                      <p className="font-mono text-[9px] text-zinc-400">
                        {def.ammo[a].penetration} mm · {def.ammo[a].damage}
                      </p>
                      <p className="font-mono text-[9px] text-zinc-500">×{def.ammo[a].count}</p>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel title="Blindage et mobilité" className="mt-2">
                <Stat label="Caisse (av. / flanc / arr.)" value={`${def.hull.front} / ${def.hull.side} / ${def.hull.rear}`} unit="mm" ratio={def.hull.front / maxOf((d) => d.hull.front)} />
                <Stat label="Tourelle (av. / flanc / arr.)" value={`${def.turret.front} / ${def.turret.side} / ${def.turret.rear}`} unit="mm" ratio={def.turret.front / maxOf((d) => d.turret.front)} />
                <Stat label="Rotation de la caisse" value={def.hullTraverse} unit="°/s" ratio={def.hullTraverse / maxOf((d) => d.hullTraverse)} />
                <p className="mt-2 text-[11px] leading-snug text-zinc-400">{def.description}</p>
              </Panel>
            </div>
          </div>

          {/* Bas : les chars du mode */}
          <div className="flex gap-2 overflow-x-auto border-t border-red-900/50 bg-black/80 p-2">
            {modeTanks.map((d) => {
              const st = unlockState(garage, d);
              const m = mastery(career.bestByTank[d.id] ?? 0, d);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => pickTank(d.id)}
                  className={`relative min-w-[136px] rounded border p-2 text-left transition ${
                    d.id === shownId ? "border-red-500 bg-red-900/30" : "border-white/10 bg-white/5 hover:bg-white/10"
                  } ${st === "possede" ? "" : "opacity-75"}`}
                >
                  <p className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                    <span className="font-mono text-amber-300">{tierLabel(d.tier)}</span>
                    <TankClassIcon cls={d.cls} className="h-3.5 w-3.5 text-zinc-300" />
                    {TANK_CLASS_NAMES[d.cls]}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm font-black">
                    {d.name}
                    {d.look.gatling ? (
                      <span className="rounded bg-red-600/85 px-1 text-[9px] font-bold uppercase tracking-wide text-white">Gatling</span>
                    ) : d.clip ? (
                      <span className="rounded bg-orange-500/80 px-1 text-[9px] font-bold uppercase tracking-wide text-white">Rafale</span>
                    ) : null}
                  </p>
                  <p className="font-mono text-[10px] text-zinc-400">
                    {st === "possede" ? `${d.hp} PS · ${d.ammo.perforant.damage} dég.` : st === "verrouille" ? "🔒 Verrouillé" : <Cost def={d} />}
                  </p>
                  {m && (
                    <span className="absolute right-1 top-1">
                      <MasteryBadge rank={m.rank} label={m.label} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {tab === "chars" && <TechTree career={garage} onOpen={openTank} onBuy={buy} />}

      {tab === "profil" && <Profile career={garage} />}

      <Game3DSettings />
    </div>
  );
}

// ------------------------------------------------------------- l'arbre

const CLASS_ORDER: TankClass[] = ["leger", "moyen", "lourd", "chasseur", "artillerie"];

/** Les chars rang par rang, de IV a X : ce qu'on possede, ce qu'on peut debloquer. */
function TechTree({ career, onOpen, onBuy }: { career: Career; onOpen: (d: TankDef) => void; onBuy: (d: TankDef) => void }) {
  const tiers = [4, 5, 6, 7, 8, 9, 10];
  return (
    <div className="min-h-0 flex-1 overflow-auto p-3">
      <p className="mb-2 text-xs text-zinc-400">
        Débloque les chars rang par rang avec l&apos;XP libre et les crédits gagnés en bataille. Il faut posséder un char du rang précédent. Les rangs VIII à X jouent en{" "}
        <b className="text-red-400">Guerre de 100</b>.
      </p>
      <div className="flex min-w-max gap-2">
        {tiers.map((tier) => {
          const list = TANKS.filter((t) => t.tier === tier).sort((a, b) => CLASS_ORDER.indexOf(a.cls) - CLASS_ORDER.indexOf(b.cls));
          return (
            <div key={tier} className="w-44 shrink-0">
              <p className={`mb-1.5 rounded px-2 py-1 text-center text-xs font-black uppercase tracking-widest ${tier >= 9 ? "bg-red-800" : tier === 8 ? "bg-red-900/70" : "bg-white/10"}`}>
                Rang {tierLabel(tier)}
              </p>
              <div className="flex flex-col gap-1.5">
                {list.map((d) => {
                  const st = unlockState(career, d);
                  const m = mastery(career.bestByTank[d.id] ?? 0, d);
                  return (
                    <div
                      key={d.id}
                      className={`rounded border p-2 ${
                        st === "possede" ? "border-green-600/60 bg-green-900/20" : st === "disponible" ? "border-amber-400/70 bg-amber-900/20" : "border-white/10 bg-white/5"
                      }`}
                    >
                      <button type="button" onClick={() => onOpen(d)} className="w-full text-left">
                        <p className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                          <TankClassIcon cls={d.cls} className="h-3 w-3 text-zinc-300" />
                          {TANK_CLASS_NAMES[d.cls]}
                        </p>
                        <p className="flex items-center gap-1 text-sm font-black text-white">
                          {d.name}
                          {m && <MasteryBadge rank={m.rank} label={m.label} />}
                        </p>
                      </button>
                      {st === "possede" ? (
                        <p className="text-[10px] font-bold text-green-400">✔ Dans ton garage</p>
                      ) : st === "verrouille" ? (
                        <p className="text-[10px] text-zinc-500">🔒 Rang {tierLabel(tier - 1)} requis</p>
                      ) : (
                        <div className="mt-1 flex items-center justify-between gap-1">
                          <span className="text-[10px] text-zinc-300">
                            <Cost def={d} />
                          </span>
                          <button
                            type="button"
                            disabled={st !== "disponible"}
                            onClick={() => onBuy(d)}
                            className="rounded bg-green-700 px-1.5 py-0.5 text-[9px] font-black uppercase enabled:hover:bg-green-600 disabled:bg-zinc-700 disabled:text-zinc-400"
                          >
                            Débloquer
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------- le profil

function Profile({ career }: { career: Career }) {
  const b = Math.max(1, career.battles);
  const stats: [string, string][] = [
    ["Batailles", fmt(career.battles)],
    ["Victoires", `${career.battles ? Math.round((career.wins / b) * 100) : 0} %`],
    ["Dégâts moyens", fmt(career.battles ? career.damageTotal / b : 0)],
    ["Destructions par bataille", career.battles ? (career.kills / b).toFixed(2).replace(".", ",") : "0"],
    ["Survie", `${career.battles ? Math.round((career.survived / b) * 100) : 0} %`],
    ["Meilleurs dégâts", fmt(career.bestDamage)],
    ["XP gagnée", fmt(career.xp)],
    ["Chars possédés", `${career.owned.length} / ${TANKS.length}`],
  ];
  const masteries = TANKS.map((d) => ({ d, m: mastery(career.bestByTank[d.id] ?? 0, d) })).filter((x) => x.m);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      <div className="mx-auto grid max-w-5xl gap-3 md:grid-cols-2">
        <Panel title="Carrière">
          <div className="grid grid-cols-2 gap-2">
            {stats.map(([k, v]) => (
              <div key={k} className="rounded bg-white/5 px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">{k}</p>
                <p className="font-mono text-lg font-black text-white">{v}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Médailles">
          <div className="grid grid-cols-4 gap-2">
            {MEDALS.map((m) => (
              <div key={m.id} className="flex flex-col items-center text-center">
                <MedalBadge medal={m} count={career.medals[m.id] ?? 0} dim={!career.medals[m.id]} size={36} />
                <p className="mt-0.5 text-[9px] font-bold leading-tight text-zinc-300">{m.name}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Maîtrise des chars">
          {masteries.length === 0 ? (
            <p className="text-xs text-zinc-400">Inflige autant de dégâts que les points de structure de ton char pour obtenir sa première maîtrise (Classe III, puis II, I et As).</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {masteries.map(({ d, m }) => (
                <span key={d.id} className="flex items-center gap-1.5 rounded bg-white/5 px-2 py-1 text-xs">
                  <TankClassIcon cls={d.cls} className="h-3 w-3 text-zinc-300" />
                  {d.name} <MasteryBadge rank={m!.rank} label={m!.label} />
                </span>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Journal">
          {career.log.length === 0 ? (
            <p className="text-xs text-zinc-400">Tes dernières batailles s&apos;afficheront ici.</p>
          ) : (
            <ul className="space-y-1">
              {career.log.map((e, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded bg-white/5 px-2 py-1 text-[11px]">
                  <span className={`w-16 font-black uppercase ${e.outcome === 1 ? "text-green-400" : e.outcome === 0 ? "text-zinc-300" : "text-red-400"}`}>
                    {e.outcome === 1 ? "Victoire" : e.outcome === 0 ? "Nul" : "Défaite"}
                  </span>
                  <span className="flex-1 truncate text-zinc-300">
                    {e.tank} · {e.map} · {MODES[e.mode]?.name ?? ""}
                  </span>
                  <span className="font-mono text-zinc-400">
                    {fmt(e.damage)} dég. · +{fmt(e.xp)} XP
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
