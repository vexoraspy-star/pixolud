// La carriere du joueur de « Tonnerre d'Acier » : batailles, credits, XP,
// chars debloques, medailles, maitrise de chaque char et journal des
// dernieres batailles. Tout est garde dans le navigateur (localStorage).
//
// Progression rapide : les chars des rangs IV et V sont a disposition des le
// depart ; on debloque les suivants rang par rang (il faut posseder un char
// du rang d'avant) avec l'XP libre et les credits gagnes en bataille.

import { TANKS, tankById, type BattleMode, type TankDef } from "./tankDefs";

export const CAREER_KEY = "pixolud-tanks-carriere";

export interface LogEntry {
  /** Horodatage (millisecondes). */
  at: number;
  mode: BattleMode;
  map: string;
  tank: string;
  /** 1 : victoire, 0 : match nul, -1 : defaite. */
  outcome: 1 | 0 | -1;
  damage: number;
  kills: number;
  xp: number;
}

export interface Career {
  battles: number;
  wins: number;
  /** XP gagnee en tout (statistique). */
  xp: number;
  /** XP libre : ce qui reste a depenser pour debloquer des chars. */
  xpFree: number;
  credits: number;
  bestDamage: number;
  damageTotal: number;
  kills: number;
  survived: number;
  /** Chars possedes (identifiants). */
  owned: string[];
  /** Medailles obtenues : identifiant -> nombre. */
  medals: Record<string, number>;
  /** Meilleurs degats en une bataille, par char. */
  bestByTank: Record<string, number>;
  log: LogEntry[];
}

/** Chars offerts des le depart : les rangs IV et V. */
export function starterTanks(): string[] {
  return TANKS.filter((t) => t.tier <= 5).map((t) => t.id);
}

export const EMPTY_CAREER: Career = {
  battles: 0,
  wins: 0,
  xp: 0,
  xpFree: 0,
  credits: 0,
  bestDamage: 0,
  damageTotal: 0,
  kills: 0,
  survived: 0,
  owned: [],
  medals: {},
  bestByTank: {},
  log: [],
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Lit la carriere (et complete une ancienne carriere : son XP devient de l'XP libre). */
export function readCareer(): Career {
  try {
    const raw = localStorage.getItem(CAREER_KEY);
    const v = raw ? (JSON.parse(raw) as Partial<Career>) : {};
    const owned = Array.isArray(v.owned) ? v.owned.filter((id): id is string => typeof id === "string" && TANKS.some((t) => t.id === id)) : [];
    for (const id of starterTanks()) if (!owned.includes(id)) owned.push(id);
    const medals: Record<string, number> = {};
    if (v.medals && typeof v.medals === "object") for (const [k, n] of Object.entries(v.medals)) medals[k] = num(n);
    const bestByTank: Record<string, number> = {};
    if (v.bestByTank && typeof v.bestByTank === "object") for (const [k, n] of Object.entries(v.bestByTank)) bestByTank[k] = num(n);
    const log = Array.isArray(v.log) ? (v.log.filter((e) => e && typeof e === "object") as LogEntry[]).slice(0, 12) : [];
    return {
      battles: num(v.battles),
      wins: num(v.wins),
      xp: num(v.xp),
      xpFree: v.xpFree === undefined ? num(v.xp) : num(v.xpFree),
      credits: num(v.credits),
      bestDamage: num(v.bestDamage),
      damageTotal: num(v.damageTotal),
      kills: num(v.kills),
      survived: num(v.survived),
      owned,
      medals,
      bestByTank,
      log,
    };
  } catch {
    return { ...EMPTY_CAREER, owned: starterTanks() };
  }
}

export function saveCareer(c: Career) {
  try {
    localStorage.setItem(CAREER_KEY, JSON.stringify(c));
  } catch {
    // stockage indisponible : la carriere vaut pour cette visite
  }
}

// ------------------------------------------------------------ deblocage

/** Cout d'un char : XP libre et credits (progression rapide). */
export function unlockCost(def: TankDef): { xp: number; credits: number } {
  const table: Record<number, [number, number]> = {
    6: [400, 8000],
    7: [900, 15000],
    8: [1750, 28000],
    9: [3000, 45000],
    10: [4500, 70000],
  };
  const [xp, credits] = table[def.tier] ?? [0, 0];
  return { xp, credits };
}

export type UnlockState = "possede" | "disponible" | "trop-cher" | "verrouille";

/** Ou en est un char : possede, achetable, trop cher, ou verrouille (pas de char du rang d'avant). */
export function unlockState(c: Career, def: TankDef): UnlockState {
  if (c.owned.includes(def.id)) return "possede";
  const prev = c.owned.some((id) => tankById(id).tier >= def.tier - 1);
  if (!prev) return "verrouille";
  const cost = unlockCost(def);
  return c.xpFree >= cost.xp && c.credits >= cost.credits ? "disponible" : "trop-cher";
}

export function unlock(c: Career, def: TankDef): Career | null {
  if (unlockState(c, def) !== "disponible") return null;
  const cost = unlockCost(def);
  return { ...c, xpFree: c.xpFree - cost.xp, credits: c.credits - cost.credits, owned: [...c.owned, def.id] };
}

// ------------------------------------------------------------- medailles

export interface Medal {
  id: string;
  name: string;
  description: string;
  /** Symbole dessine sur la medaille. */
  icon: string;
  /** Teinte du metal : bronze, argent, or. */
  metal: "bronze" | "argent" | "or";
}

export const MEDALS: Medal[] = [
  { id: "heros", name: "Héros de la bataille", description: "Le plus de dégâts de toute la bataille.", icon: "★", metal: "or" },
  { id: "carnage", name: "Carnage", description: "Détruire au moins 5 chars en une bataille.", icon: "✠", metal: "or" },
  { id: "invincible", name: "Invincible", description: "Gagner sans subir le moindre dégât.", icon: "⛨", metal: "or" },
  { id: "ravageur", name: "Ravageur", description: "Infliger au moins deux fois les points de structure de son char.", icon: "✹", metal: "argent" },
  { id: "tireur", name: "Tireur d'élite", description: "Au moins 8 tirs et 85 % au but.", icon: "◎", metal: "argent" },
  { id: "mur", name: "Mur d'acier", description: "Arrêter au moins 1 500 points de dégâts avec son blindage.", icon: "▣", metal: "argent" },
  { id: "lynx", name: "Œil de lynx", description: "Repérer 5 ennemis ou aider ses alliés à infliger 1 000 dégâts.", icon: "◉", metal: "bronze" },
  { id: "survivant", name: "Survivant", description: "Gagner la bataille et en sortir vivant.", icon: "✚", metal: "bronze" },
];

export interface BattleStats {
  winner: 0 | 1 | -1;
  damage: number;
  kills: number;
  shots: number;
  hits: number;
  damageTaken: number;
  damageBlocked: number;
  assist: number;
  detections: number;
  survived: boolean;
  /** Plus gros total de degats de la bataille, tous chars confondus. */
  topDamage: number;
}

/** Les medailles gagnees dans une bataille. */
export function medalsFor(s: BattleStats, def: TankDef): string[] {
  const out: string[] = [];
  const win = s.winner === 0;
  if (s.damage > 0 && s.damage >= s.topDamage) out.push("heros");
  if (s.kills >= 5) out.push("carnage");
  if (win && s.damageTaken === 0) out.push("invincible");
  if (s.damage >= def.hp * 2) out.push("ravageur");
  if (s.shots >= 8 && s.hits / s.shots >= 0.85) out.push("tireur");
  if (s.damageBlocked >= 1500) out.push("mur");
  if (s.detections >= 5 || s.assist >= 1000) out.push("lynx");
  if (win && s.survived) out.push("survivant");
  return out;
}

// -------------------------------------------------------------- maitrise

/** Badge de maitrise d'un char, selon ses meilleurs degats rapportes a ses points de structure. */
export function mastery(best: number, def: TankDef): { label: string; rank: number } | null {
  const r = best / def.hp;
  if (r >= 3) return { label: "As", rank: 4 };
  if (r >= 2) return { label: "Classe I", rank: 3 };
  if (r >= 1.5) return { label: "Classe II", rank: 2 };
  if (r >= 1) return { label: "Classe III", rank: 1 };
  return null;
}
