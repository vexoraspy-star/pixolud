// La carriere du joueur de « Tonnerre d'Acier » : batailles, credits, XP,
// chars debloques, modules ameliores, commandant et ses competences,
// boosters, medailles, maitrise de chaque char et journal des dernieres
// batailles. Tout est garde dans le navigateur (localStorage).
//
// Progression rapide : les chars des rangs IV et V sont a disposition des le
// depart ; on debloque les suivants rang par rang (il faut posseder un char
// du rang d'avant) avec l'XP libre et les credits gagnes en bataille.

import { TANKS, tankById, type BattleMode, type TankDef } from "./tankDefs";

/** Les quatre modules qu'on ameliore sur chaque char. */
export type ModuleId = "canon" | "moteur" | "chenilles" | "radio";
/** Niveau de chaque module d'un char : 0 (d'origine), 1 (ameliore), 2 (elite). */
export type ModuleLevels = Record<ModuleId, number>;

export type SkillId = "sixieme" | "tireur" | "chargeur" | "pilote" | "observateur";

export interface Commander {
  name: string;
  /** XP du commandant : il en gagne autant que le char a chaque bataille. */
  xp: number;
  /** Rang atteint dans chaque competence. */
  skills: Record<SkillId, number>;
}

/** Batailles restantes avec un booster actif (gains doubles). */
export interface Boosters {
  xp: number;
  credits: number;
}

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
  /** Modules ameliores, par char. */
  modules: Record<string, ModuleLevels>;
  commander: Commander;
  boosters: Boosters;
}

/** Chars offerts des le depart : les rangs IV et V. */
export function starterTanks(): string[] {
  return TANKS.filter((t) => t.tier <= 5).map((t) => t.id);
}

const NO_SKILLS: Record<SkillId, number> = { sixieme: 0, tireur: 0, chargeur: 0, pilote: 0, observateur: 0 };
export const STOCK_MODULES: ModuleLevels = { canon: 0, moteur: 0, chenilles: 0, radio: 0 };

const FIRST_NAMES = ["Jean", "Louis", "Marcel", "Henri", "Lucien", "René", "Émile", "Gaston", "Léon", "Armand", "Simone", "Odette", "Jeanne", "Colette"];
const LAST_NAMES = ["Moreau", "Laurent", "Garnier", "Faure", "Rousseau", "Blanc", "Guérin", "Roussel", "Mercier", "Lefort", "Bertrand", "Vidal"];

/** Un commandant tout neuf, au nom tire au sort. */
export function newCommander(): Commander {
  const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];
  return { name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`, xp: 0, skills: { ...NO_SKILLS } };
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
  modules: {},
  commander: { name: "Commandant", xp: 0, skills: { ...NO_SKILLS } },
  boosters: { xp: 0, credits: 0 },
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const level = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.round(num(v))));

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
    const modules: Record<string, ModuleLevels> = {};
    if (v.modules && typeof v.modules === "object") {
      for (const [id, m] of Object.entries(v.modules)) {
        if (!TANKS.some((t) => t.id === id) || !m || typeof m !== "object") continue;
        const o = m as Partial<ModuleLevels>;
        modules[id] = { canon: level(o.canon, 2), moteur: level(o.moteur, 2), chenilles: level(o.chenilles, 2), radio: level(o.radio, 2) };
      }
    }
    const c = v.commander && typeof v.commander === "object" ? (v.commander as Partial<Commander>) : null;
    const s = (c?.skills ?? {}) as Partial<Record<SkillId, number>>;
    const commander: Commander = c
      ? {
          name: typeof c.name === "string" && c.name ? c.name.slice(0, 30) : newCommander().name,
          xp: num(c.xp),
          skills: {
            sixieme: level(s.sixieme, 1),
            tireur: level(s.tireur, 3),
            chargeur: level(s.chargeur, 3),
            pilote: level(s.pilote, 3),
            observateur: level(s.observateur, 3),
          },
        }
      : // Une ancienne carriere : le commandant a deja l'XP gagnee jusqu'ici.
        { ...newCommander(), xp: num(v.xp) };
    const b = v.boosters && typeof v.boosters === "object" ? (v.boosters as Partial<Boosters>) : {};
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
      modules,
      commander,
      boosters: { xp: level(b.xp, 99), credits: level(b.credits, 99) },
    };
  } catch {
    return { ...EMPTY_CAREER, owned: starterTanks(), commander: newCommander() };
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

// --------------------------------------------------------------- modules

export interface ModuleInfo {
  id: ModuleId;
  name: string;
  /** Ce que donne chaque niveau (1 : ameliore, 2 : elite). */
  effects: [string, string];
}

export const MODULES: ModuleInfo[] = [
  { id: "canon", name: "Canon", effects: ["Rechargement −5 %, dispersion −4 %", "Rechargement −10 %, dispersion −8 %"] },
  { id: "moteur", name: "Moteur", effects: ["Vitesse +5 %, accélération +10 %", "Vitesse +10 %, accélération +20 %"] },
  { id: "chenilles", name: "Chenilles", effects: ["Rotation de la caisse +8 %", "Rotation de la caisse +16 %"] },
  { id: "radio", name: "Optique et radio", effects: ["Portée de vue +8 %", "Portée de vue +15 %"] },
];

export function modulesOf(c: Career, tankId: string): ModuleLevels {
  return c.modules[tankId] ?? STOCK_MODULES;
}

/** Credits pour monter un module au niveau `next` (1 ou 2), selon le rang du char. */
export function moduleCost(def: TankDef, next: number): number {
  return def.tier * (next === 1 ? 1500 : 4000);
}

export function upgradeModule(c: Career, def: TankDef, id: ModuleId): Career | null {
  const mods = modulesOf(c, def.id);
  const next = mods[id] + 1;
  if (next > 2 || !c.owned.includes(def.id)) return null;
  const cost = moduleCost(def, next);
  if (c.credits < cost) return null;
  return { ...c, credits: c.credits - cost, modules: { ...c.modules, [def.id]: { ...mods, [id]: next } } };
}

// ------------------------------------------------------------- commandant

export interface SkillInfo {
  id: SkillId;
  name: string;
  description: string;
  max: number;
}

export const SKILLS: SkillInfo[] = [
  { id: "sixieme", name: "Sixième sens", description: "Une lampe s'allume quand l'ennemi te repère.", max: 1 },
  { id: "tireur", name: "Tireur d'élite", description: "Dispersion −4 % par rang.", max: 3 },
  { id: "chargeur", name: "Chargeur rapide", description: "Rechargement −3 % par rang.", max: 3 },
  { id: "pilote", name: "Pilote expert", description: "Accélération et rotation de la caisse +5 % par rang.", max: 3 },
  { id: "observateur", name: "Observateur", description: "Portée de vue +4 % par rang.", max: 3 },
];

/** XP du commandant pour atteindre chaque niveau (1 a 10). */
const LEVEL_XP = [0, 400, 1200, 2400, 4000, 6000, 8400, 11200, 14400, 18000];

export function commanderLevel(cmd: Commander): { level: number; into: number; span: number } {
  let lv = 1;
  while (lv < LEVEL_XP.length && cmd.xp >= LEVEL_XP[lv]) lv++;
  const into = cmd.xp - LEVEL_XP[lv - 1];
  const span = lv < LEVEL_XP.length ? LEVEL_XP[lv] - LEVEL_XP[lv - 1] : 0;
  return { level: lv, into, span };
}

/** Grade du commandant selon son niveau. */
export function commanderRank(levelNumber: number): string {
  if (levelNumber >= 9) return "Commandant";
  if (levelNumber >= 7) return "Capitaine";
  if (levelNumber >= 5) return "Lieutenant";
  if (levelNumber >= 3) return "Adjudant";
  return "Sergent";
}

/** Un point de competence par niveau ; on retire ceux deja places. */
export function skillPointsLeft(cmd: Commander): number {
  const spent = SKILLS.reduce((n, s) => n + cmd.skills[s.id], 0);
  return commanderLevel(cmd).level - spent;
}

export function learnSkill(c: Career, id: SkillId): Career | null {
  const info = SKILLS.find((s) => s.id === id)!;
  if (c.commander.skills[id] >= info.max || skillPointsLeft(c.commander) <= 0) return null;
  return { ...c, commander: { ...c.commander, skills: { ...c.commander.skills, [id]: c.commander.skills[id] + 1 } } };
}

// --------------------------------------------------------------- boosters

export interface BoosterInfo {
  id: keyof Boosters;
  name: string;
  description: string;
  /** Ce qu'il coute : en credits pour l'XP, en XP libre pour les credits. */
  price: number;
  currency: "credits" | "xp";
  battles: number;
}

export const BOOSTERS: BoosterInfo[] = [
  { id: "xp", name: "Expérience ×2", description: "Double l'XP gagnée pendant 3 batailles.", price: 20000, currency: "credits", battles: 3 },
  { id: "credits", name: "Crédits ×2", description: "Double les crédits gagnés pendant 3 batailles.", price: 800, currency: "xp", battles: 3 },
];

export function buyBooster(c: Career, id: keyof Boosters): Career | null {
  const info = BOOSTERS.find((b) => b.id === id)!;
  if (info.currency === "credits" ? c.credits < info.price : c.xpFree < info.price) return null;
  return {
    ...c,
    credits: info.currency === "credits" ? c.credits - info.price : c.credits,
    xpFree: info.currency === "xp" ? c.xpFree - info.price : c.xpFree,
    boosters: { ...c.boosters, [id]: c.boosters[id] + info.battles },
  };
}

// ------------------------------------------------------------- bonus en jeu

/** Multiplicateurs appliques au char du joueur (modules et competences). */
export interface TankBonus {
  reload: number;
  dispersion: number;
  speed: number;
  accel: number;
  hullTraverse: number;
  viewRange: number;
  /** Sixieme sens : le joueur sait quand il est repere. */
  sixthSense: boolean;
}

export function bonusFor(mods: ModuleLevels, skills: Record<SkillId, number>): TankBonus {
  const pick = (lv: number, a: number, b: number) => (lv >= 2 ? b : lv === 1 ? a : 0);
  return {
    reload: (1 - pick(mods.canon, 0.05, 0.1)) * (1 - 0.03 * skills.chargeur),
    dispersion: (1 - pick(mods.canon, 0.04, 0.08)) * (1 - 0.04 * skills.tireur),
    speed: 1 + pick(mods.moteur, 0.05, 0.1),
    accel: (1 + pick(mods.moteur, 0.1, 0.2)) * (1 + 0.05 * skills.pilote),
    hullTraverse: (1 + pick(mods.chenilles, 0.08, 0.16)) * (1 + 0.05 * skills.pilote),
    viewRange: (1 + pick(mods.radio, 0.08, 0.15)) * (1 + 0.04 * skills.observateur),
    sixthSense: skills.sixieme > 0,
  };
}

/** Le char du joueur, ameliore : une copie de sa fiche avec les bonus. */
export function withBonus(def: TankDef, b: TankBonus | null | undefined): TankDef {
  if (!b) return def;
  return {
    ...def,
    reload: def.reload * b.reload,
    dispersion: def.dispersion * b.dispersion,
    speed: def.speed * b.speed,
    accel: def.accel * b.accel,
    hullTraverse: def.hullTraverse * b.hullTraverse,
    viewRange: Math.round(def.viewRange * b.viewRange),
  };
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
