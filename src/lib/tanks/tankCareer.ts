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
  /** Qui c'est (voir COMMANDERS) : « recrue » est le premier, celui qu'on nomme soi-meme. */
  id: string;
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
  /** Le commandant aux commandes : il donne ses competences et son talent, et gagne l'XP. */
  commander: Commander;
  /** Les autres commandants recrutes, au repos : chacun garde sa progression. */
  reserve: Commander[];
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
  return { id: "recrue", name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`, xp: 0, skills: { ...NO_SKILLS } };
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
  commander: { id: "recrue", name: "Commandant", xp: 0, skills: { ...NO_SKILLS } },
  reserve: [],
  boosters: { xp: 0, credits: 0 },
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const level = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.round(num(v))));

/** Un commandant lu dans la sauvegarde : un profil connu, des competences bornees. */
function readCommander(c: Partial<Commander>): Commander {
  const s = (c.skills ?? {}) as Partial<Record<SkillId, number>>;
  const id = typeof c.id === "string" && COMMANDERS.some((p) => p.id === c.id) ? c.id : "recrue";
  const profile = profileOf(id);
  return {
    id,
    // Seul le premier commandant porte le nom qu'on lui donne ; les autres ont le leur.
    name: id === "recrue" ? (typeof c.name === "string" && c.name ? c.name.slice(0, 30) : newCommander().name) : profile.name,
    xp: num(c.xp),
    skills: {
      sixieme: level(s.sixieme, 1),
      tireur: level(s.tireur, 3),
      chargeur: level(s.chargeur, 3),
      pilote: level(s.pilote, 3),
      observateur: level(s.observateur, 3),
    },
  };
}

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
    const commander: Commander = c
      ? readCommander(c)
      : // Une ancienne carriere : le commandant a deja l'XP gagnee jusqu'ici.
        { ...newCommander(), xp: num(v.xp) };
    // Les commandants au repos : connus, sans doublon, et jamais celui aux commandes.
    const reserve: Commander[] = [];
    if (Array.isArray(v.reserve)) {
      for (const r of v.reserve) {
        if (!r || typeof r !== "object") continue;
        const cmd = readCommander(r as Partial<Commander>);
        if (cmd.id !== commander.id && !reserve.some((x) => x.id === cmd.id)) reserve.push(cmd);
      }
    }
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
      reserve,
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
  return Math.max(0, commanderLevel(cmd).level - spent);
}

/**
 * Le garage d'un compte admin : tout y est deja (chars, credits, XP libre,
 * modules d'elite sur chaque char, commandant au niveau maximal avec toutes
 * ses competences, boosters actifs). Une vue calculee : la carriere
 * enregistree, elle, ne change pas.
 */
export function adminCareer(c: Career): Career {
  const elite = Object.fromEntries(MODULES.map((m) => [m.id, 2])) as ModuleLevels;
  const modules: Record<string, ModuleLevels> = {};
  for (const t of TANKS) modules[t.id] = elite;
  const skills = Object.fromEntries(SKILLS.map((s) => [s.id, s.max])) as Record<SkillId, number>;
  return {
    ...c,
    owned: TANKS.map((t) => t.id),
    credits: Math.max(c.credits, 99_999_999),
    xpFree: Math.max(c.xpFree, 9_999_999),
    modules,
    commander: { ...c.commander, xp: Math.max(c.commander.xp, LEVEL_XP[LEVEL_XP.length - 1]), skills },
    reserve: COMMANDERS.filter((p) => p.id !== c.commander.id).map((p) => {
      const mine = c.reserve.find((r) => r.id === p.id);
      return { id: p.id, name: mine?.name ?? (p.id === "recrue" ? "Commandant" : p.name), xp: LEVEL_XP[LEVEL_XP.length - 1], skills };
    }),
    boosters: { xp: Math.max(c.boosters.xp, 999), credits: Math.max(c.boosters.credits, 999) },
  };
}

export function learnSkill(c: Career, id: SkillId): Career | null {
  const info = SKILLS.find((s) => s.id === id)!;
  if (c.commander.skills[id] >= info.max || skillPointsLeft(c.commander) <= 0) return null;
  return { ...c, commander: { ...c.commander, skills: { ...c.commander.skills, [id]: c.commander.skills[id] + 1 } } };
}

// ------------------------------------------------------------- commandants

/** L'allure d'un commandant, pour son portrait dessine. */
export interface CommanderLook {
  skin: string;
  hair: string;
  hairStyle: "court" | "long" | "queue" | "chauve" | "boucles";
  hat: "beret" | "casquette" | "casque" | "bandana";
  hatColor: string;
  uniform: string;
  /** Moustache, barbe, lunettes, cicatrice, cache-oeil, peinture de camouflage. */
  extras: ("moustache" | "barbe" | "lunettes" | "cicatrice" | "cache-oeil" | "peinture")[];
}

/** Ce qu'un commandant apporte en plus, quel que soit le char (multiplicateurs). */
export type TalentBonus = Partial<Omit<TankBonus, "sixthSense">> & { sixthSense?: boolean };

export interface CommanderProfile {
  id: string;
  /** Vide pour le premier commandant : il porte le nom qu'on lui donne. */
  name: string;
  nickname: string;
  bio: string;
  talent: string;
  talentText: string;
  bonus: TalentBonus;
  /** Credits pour le recruter (0 : deja la). */
  price: number;
  /** null : allure tiree de son nom (le premier commandant). */
  look: CommanderLook | null;
}

export const COMMANDERS: CommanderProfile[] = [
  {
    id: "recrue",
    name: "",
    nickname: "Ton premier commandant",
    bio: "Il a fait ses classes avec toi : le seul à qui tu donnes le nom de ton choix.",
    talent: "Débrouillard",
    talentText: "Rechargement −2 %, portée de vue +2 %.",
    bonus: { reload: 0.98, viewRange: 1.02 },
    price: 0,
    look: null,
  },
  {
    id: "lea",
    name: "Léa Fontaine",
    nickname: "L'Œil de lynx",
    bio: "Ancienne guetteuse de montagne : elle voit un canon briller à l'autre bout de la vallée.",
    talent: "Vigie",
    talentText: "Portée de vue +8 %.",
    bonus: { viewRange: 1.08 },
    price: 25000,
    look: { skin: "#f3d6bd", hair: "#a0522d", hairStyle: "queue", hat: "casquette", hatColor: "#3f4a2e", uniform: "#4b5536", extras: [] },
  },
  {
    id: "hugo",
    name: "Hugo Lambert",
    nickname: "Le Pilote",
    bio: "Champion de rallye avant la guerre : il pousse le moteur jusqu'à la zone rouge.",
    talent: "Pied au plancher",
    talentText: "Vitesse +5 %, accélération +10 %.",
    bonus: { speed: 1.05, accel: 1.1 },
    price: 35000,
    look: { skin: "#e8bb93", hair: "#2b1d14", hairStyle: "court", hat: "casque", hatColor: "#4a3423", uniform: "#5a4a32", extras: ["moustache"] },
  },
  {
    id: "yuki",
    name: "Yuki Tanabe",
    nickname: "La Fusée",
    bio: "Elle a réglé elle-même la mécanique de sa tourelle : rien ne tourne plus vite.",
    talent: "Tourelle huilée",
    talentText: "Rotation de la tourelle +15 %, de la caisse +5 %.",
    bonus: { turret: 1.15, hullTraverse: 1.05 },
    price: 40000,
    look: { skin: "#f1d2b0", hair: "#141414", hairStyle: "long", hat: "bandana", hatColor: "#9f1d1d", uniform: "#3d4a3a", extras: [] },
  },
  {
    id: "amina",
    name: "Amina Diallo",
    nickname: "Main sûre",
    bio: "Première de sa promotion au tir : elle loge l'obus dans la fente du pilote.",
    talent: "Tireuse d'élite",
    talentText: "Dispersion −7 %, temps de visée −5 %.",
    bonus: { dispersion: 0.93, aimTime: 0.95 },
    price: 50000,
    look: { skin: "#8d5a3b", hair: "#141414", hairStyle: "boucles", hat: "beret", hatColor: "#1f3b6e", uniform: "#4b5536", extras: ["lunettes"] },
  },
  {
    id: "otto",
    name: "Otto Brenner",
    nickname: "Le Sanglier",
    bio: "Il ne contourne jamais rien : il passe au travers.",
    talent: "Fonceur",
    talentText: "Accélération +15 %, points de structure +3 %.",
    bonus: { accel: 1.15, hp: 1.03 },
    price: 55000,
    look: { skin: "#e9b48f", hair: "#b9b2a5", hairStyle: "chauve", hat: "casquette", hatColor: "#2f3326", uniform: "#55603f", extras: ["barbe"] },
  },
  {
    id: "bastien",
    name: "Bastien Roche",
    nickname: "Le Mur",
    bio: "Trois fois touché, trois fois revenu : son équipage tient sous le feu.",
    talent: "Blindé",
    talentText: "Points de structure +6 %.",
    bonus: { hp: 1.06 },
    price: 60000,
    look: { skin: "#d9a77c", hair: "#5a3b22", hairStyle: "court", hat: "casque", hatColor: "#3d4a2c", uniform: "#4b5536", extras: ["cicatrice"] },
  },
  {
    id: "zoe",
    name: "Zoé Marchal",
    nickname: "L'Ombre",
    bio: "Branches, boue et filets : elle sait faire disparaître un char de trente tonnes.",
    talent: "Camouflage",
    talentText: "Les ennemis te repèrent 10 % plus près.",
    bonus: { stealth: 0.9 },
    price: 65000,
    look: { skin: "#f1c9a5", hair: "#2b1d14", hairStyle: "court", hat: "bandana", hatColor: "#3b452b", uniform: "#3b452b", extras: ["peinture"] },
  },
  {
    id: "nadia",
    name: "Nadia Rinaldi",
    nickname: "Mains rapides",
    bio: "Elle charge un obus de 120 mm plus vite que d'autres une balle de fusil.",
    talent: "Chargeuse",
    talentText: "Rechargement −6 %.",
    bonus: { reload: 0.94 },
    price: 70000,
    look: { skin: "#d9a77c", hair: "#4a2e1a", hairStyle: "queue", hat: "beret", hatColor: "#7a1f1f", uniform: "#4b5536", extras: [] },
  },
  {
    id: "victor",
    name: "Victor Lenoir",
    nickname: "Le Vieux Lion",
    bio: "Trente ans de blindés : il sent le danger avant tout le monde.",
    talent: "Vétéran",
    talentText: "Sixième sens d'office, portée de vue +3 %.",
    bonus: { sixthSense: true, viewRange: 1.03 },
    price: 90000,
    look: { skin: "#e8bb93", hair: "#e6e2da", hairStyle: "court", hat: "casquette", hatColor: "#1e2a1a", uniform: "#2f3a24", extras: ["moustache", "cache-oeil"] },
  },
  {
    id: "ines",
    name: "Inès Carvalho",
    nickname: "La Stratège",
    bio: "Elle lit la bataille comme un échiquier et donne le bon ordre au bon moment.",
    talent: "Coordination",
    talentText: "Rechargement −3 %, dispersion −3 %, portée de vue +3 %.",
    bonus: { reload: 0.97, dispersion: 0.97, viewRange: 1.03 },
    price: 120000,
    look: { skin: "#b97f55", hair: "#2b1d14", hairStyle: "long", hat: "beret", hatColor: "#1d1e20", uniform: "#3a3f45", extras: ["lunettes"] },
  },
];

export function profileOf(id: string): CommanderProfile {
  return COMMANDERS.find((p) => p.id === id) ?? COMMANDERS[0];
}

/** Le commandant (aux commandes ou au repos) de ce profil, s'il est recrute. */
export function commanderOf(c: Career, id: string): Commander | null {
  return c.commander.id === id ? c.commander : (c.reserve.find((r) => r.id === id) ?? null);
}

/** Le nom du joueur : celui de son premier commandant. */
export function ownName(c: Career): string {
  return commanderOf(c, "recrue")?.name ?? c.commander.name;
}

/** Un commandant tout juste recrute : niveau 1, aucune competence. */
export function freshCommander(id: string): Commander {
  const p = profileOf(id);
  return p.id === "recrue" ? newCommander() : { id: p.id, name: p.name, xp: 0, skills: { ...NO_SKILLS } };
}

/** Recruter un commandant (il rejoint la reserve, au niveau 1). */
export function recruitCommander(c: Career, id: string): Career | null {
  const p = profileOf(id);
  if (p.id !== id || commanderOf(c, id) || c.credits < p.price) return null;
  return { ...c, credits: c.credits - p.price, reserve: [...c.reserve, freshCommander(id)] };
}

/** Mettre un commandant recrute aux commandes (l'ancien passe au repos). */
export function assignCommander(c: Career, id: string): Career | null {
  const next = c.reserve.find((r) => r.id === id);
  if (!next) return null;
  return { ...c, commander: next, reserve: [...c.reserve.filter((r) => r.id !== id), c.commander] };
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
  /** Temps de visee. */
  aimTime: number;
  /** Rotation de la tourelle. */
  turret: number;
  /** Points de structure. */
  hp: number;
  /** Distance a laquelle l'ennemi le repere (moins de 1 : plus discret). */
  stealth: number;
  /** Sixieme sens : le joueur sait quand il est repere. */
  sixthSense: boolean;
}

/** Bonus du char : ses modules, les competences et le talent de son commandant. */
export function bonusFor(mods: ModuleLevels, cmd: Commander): TankBonus {
  const skills = cmd.skills;
  const t = profileOf(cmd.id).bonus;
  const pick = (lv: number, a: number, b: number) => (lv >= 2 ? b : lv === 1 ? a : 0);
  return {
    reload: (1 - pick(mods.canon, 0.05, 0.1)) * (1 - 0.03 * skills.chargeur) * (t.reload ?? 1),
    dispersion: (1 - pick(mods.canon, 0.04, 0.08)) * (1 - 0.04 * skills.tireur) * (t.dispersion ?? 1),
    speed: (1 + pick(mods.moteur, 0.05, 0.1)) * (t.speed ?? 1),
    accel: (1 + pick(mods.moteur, 0.1, 0.2)) * (1 + 0.05 * skills.pilote) * (t.accel ?? 1),
    hullTraverse: (1 + pick(mods.chenilles, 0.08, 0.16)) * (1 + 0.05 * skills.pilote) * (t.hullTraverse ?? 1),
    viewRange: (1 + pick(mods.radio, 0.08, 0.15)) * (1 + 0.04 * skills.observateur) * (t.viewRange ?? 1),
    aimTime: t.aimTime ?? 1,
    turret: t.turret ?? 1,
    hp: t.hp ?? 1,
    stealth: t.stealth ?? 1,
    sixthSense: skills.sixieme > 0 || t.sixthSense === true,
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
    // Bonus plus recents : absents d'un bonus ancien, ils valent 1.
    aimTime: def.aimTime * (b.aimTime ?? 1),
    turretTraverse: def.turretTraverse * (b.turret ?? 1),
    hp: Math.round(def.hp * (b.hp ?? 1)),
    concealment: (def.concealment ?? 1) * (b.stealth ?? 1),
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
