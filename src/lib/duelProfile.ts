import { DANCES, DANCE_ORDER, type DanceId } from "./duelDances";

// Profil du joueur de Duel : pieces, niveau, tenues, camouflages et danses.
//
// Tout est conserve dans le navigateur, comme les reglages : rien ne part sur
// le serveur, et rien ne s'achete avec de l'argent reel. On gagne des pieces
// en jouant (eliminations, victoires) et on les depense dans le casier.

export type Rarity = "commun" | "rare" | "epique" | "legendaire";

export const RARITY: Record<Rarity, { label: string; color: string; glow: string }> = {
  commun: { label: "Commun", color: "#9aa4ae", glow: "rgba(154,164,174,0.35)" },
  rare: { label: "Rare", color: "#3b9dff", glow: "rgba(59,157,255,0.4)" },
  epique: { label: "Épique", color: "#b45cff", glow: "rgba(180,92,255,0.45)" },
  legendaire: { label: "Légendaire", color: "#ffae3b", glow: "rgba(255,174,59,0.5)" },
};

export type SkinId = "commando" | "desert" | "arctique" | "ombre" | "neon" | "magma" | "or";
export type CamoId = "standard" | "foret" | "desert" | "urbain" | "carbone" | "dragon" | "or";

export interface Skin {
  id: SkinId;
  name: string;
  rarity: Rarity;
  price: number;
  tagline: string;
  /** Uniforme, equipement, accent (casque et gilet) et visiere. */
  cloth: number;
  gear: number;
  accent: number;
  visor: number;
  /** Manches et gants vus a la premiere personne. */
  sleeve: number;
  glove: number;
}

export interface Camo {
  id: CamoId;
  name: string;
  rarity: Rarity;
  price: number;
  tagline: string;
  /** Taches du camouflage, de la plus claire a la plus sombre. Vide : sans motif. */
  colors: string[];
  /** Metal dore pour le camouflage le plus rare. */
  goldMetal?: boolean;
}

export const SKINS: Record<SkinId, Skin> = {
  commando: {
    id: "commando",
    name: "Commando",
    rarity: "commun",
    price: 0,
    tagline: "La tenue de départ. Sobre, efficace.",
    cloth: 0x454f5c,
    gear: 0x23282f,
    accent: 0x22d3ee,
    visor: 0x6ff0ff,
    sleeve: 0x3a4038,
    glove: 0x5b636c,
  },
  desert: {
    id: "desert",
    name: "Nomade",
    rarity: "commun",
    price: 400,
    tagline: "Toile sable et visière ambrée.",
    cloth: 0xa08a62,
    gear: 0x5a4a32,
    accent: 0xd9a441,
    visor: 0xffd27a,
    sleeve: 0x8a7650,
    glove: 0x6b5a3e,
  },
  arctique: {
    id: "arctique",
    name: "Blizzard",
    rarity: "rare",
    price: 800,
    tagline: "Blanc glacier, casque bleu nuit.",
    cloth: 0xdfe6ea,
    gear: 0x8a96a0,
    accent: 0x4aa3ff,
    visor: 0x9fe8ff,
    sleeve: 0xcfd8de,
    glove: 0x8a96a0,
  },
  ombre: {
    id: "ombre",
    name: "Spectre",
    rarity: "rare",
    price: 800,
    tagline: "Noir mat. On ne le voit qu'au dernier moment.",
    cloth: 0x1d2026,
    gear: 0x0c0d10,
    accent: 0x8b5cf6,
    visor: 0xb48bff,
    sleeve: 0x1d2026,
    glove: 0x2a2d35,
  },
  neon: {
    id: "neon",
    name: "Néon",
    rarity: "epique",
    price: 1500,
    tagline: "Rose électrique et visière cyan.",
    cloth: 0x1a1f2e,
    gear: 0x10131c,
    accent: 0xff2bd6,
    visor: 0x38fff5,
    sleeve: 0x2a1f3e,
    glove: 0xff2bd6,
  },
  magma: {
    id: "magma",
    name: "Magma",
    rarity: "epique",
    price: 1500,
    tagline: "Roche noire et fissures de lave.",
    cloth: 0x3a1d16,
    gear: 0x1a0d0a,
    accent: 0xff5a1f,
    visor: 0xffb347,
    sleeve: 0x3a1d16,
    glove: 0xff5a1f,
  },
  or: {
    id: "or",
    name: "Roi Midas",
    rarity: "legendaire",
    price: 2500,
    tagline: "Tout ce qu'il touche devient or.",
    cloth: 0xc9a227,
    gear: 0x3a2f12,
    accent: 0xfff1a8,
    visor: 0xffffff,
    sleeve: 0xc9a227,
    glove: 0xe8c34a,
  },
};

export const CAMOS: Record<CamoId, Camo> = {
  standard: { id: "standard", name: "Standard", rarity: "commun", price: 0, tagline: "Finition d'usine.", colors: [] },
  foret: {
    id: "foret",
    name: "Forêt",
    rarity: "commun",
    price: 300,
    tagline: "Vert mousse et brun écorce.",
    colors: ["#6b7a45", "#4a5a30", "#3a2e1e", "#252a1a"],
  },
  desert: {
    id: "desert",
    name: "Dune",
    rarity: "commun",
    price: 300,
    tagline: "Sable chaud, taches de terre.",
    colors: ["#d2b98a", "#b39565", "#8a6d45", "#6b5234"],
  },
  urbain: {
    id: "urbain",
    name: "Urbain",
    rarity: "rare",
    price: 600,
    tagline: "Gris béton, pixels cassés.",
    colors: ["#b6bcc2", "#80878f", "#50565d", "#2b2f33"],
  },
  carbone: {
    id: "carbone",
    name: "Carbone",
    rarity: "rare",
    price: 600,
    tagline: "Fibre tressée noire et reflets.",
    colors: ["#2c2f34", "#1b1d21", "#3c4047", "#121315"],
  },
  dragon: {
    id: "dragon",
    name: "Dragon",
    rarity: "epique",
    price: 1200,
    tagline: "Écailles rouges, braises orange.",
    colors: ["#ff6a2a", "#c4261c", "#6e0f12", "#2a0708"],
  },
  or: {
    id: "or",
    name: "Or massif",
    rarity: "legendaire",
    price: 2000,
    tagline: "Pour ceux qui veulent être vus.",
    colors: ["#ffe07a", "#e0b43a", "#b88a1c", "#8a6512"],
    goldMetal: true,
  },
};

export const SKIN_ORDER: SkinId[] = ["commando", "desert", "arctique", "ombre", "neon", "magma", "or"];
export const CAMO_ORDER: CamoId[] = ["standard", "foret", "desert", "urbain", "carbone", "dragon", "or"];

export interface DuelProfile {
  coins: number;
  xp: number;
  /** Objets possedes, prefixes : « skin:neon », « camo:dragon », « dance:floss ». */
  owned: string[];
  skin: SkinId;
  camo: CamoId;
  /** Jour du dernier cadeau recupere (AAAA-MM-JJ), vide s'il n'a jamais ete pris. */
  lastGift: string;
}

export const DEFAULT_PROFILE: DuelProfile = {
  // De quoi s'offrir un premier objet tout de suite : un casier vide ne donne
  // pas envie de jouer pour le remplir.
  coins: 500,
  xp: 0,
  owned: ["skin:commando", "camo:standard", "dance:salut"],
  skin: "commando",
  camo: "standard",
  lastGift: "",
};

const KEY = "pixolud-duel-profil";

export function loadProfile(): DuelProfile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PROFILE, owned: [...DEFAULT_PROFILE.owned] };
    const p = JSON.parse(raw) as Partial<DuelProfile>;
    const owned = Array.isArray(p.owned) ? p.owned.filter((o) => typeof o === "string") : [];
    for (const base of DEFAULT_PROFILE.owned) if (!owned.includes(base)) owned.push(base);
    const skin = p.skin && p.skin in SKINS && owned.includes(`skin:${p.skin}`) ? p.skin : "commando";
    const camo = p.camo && p.camo in CAMOS && owned.includes(`camo:${p.camo}`) ? p.camo : "standard";
    return {
      coins: Number.isFinite(p.coins) ? Math.max(0, Math.floor(p.coins as number)) : DEFAULT_PROFILE.coins,
      xp: Number.isFinite(p.xp) ? Math.max(0, Math.floor(p.xp as number)) : 0,
      owned,
      skin,
      camo,
      lastGift: typeof p.lastGift === "string" ? p.lastGift : "",
    };
  } catch {
    return { ...DEFAULT_PROFILE, owned: [...DEFAULT_PROFILE.owned] };
  }
}

export function saveProfile(profile: DuelProfile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // ignore
  }
}

/** Niveau a partir de l'experience : chaque niveau coute un peu plus que le precedent. */
export function levelInfo(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let need = 200;
  let rest = xp;
  while (rest >= need) {
    rest -= need;
    level++;
    need = 200 + (level - 1) * 60;
  }
  return { level, into: rest, need };
}

/** Pieces et experience gagnees a la fin d'une partie. */
export function matchReward(win: boolean, kills: number): { coins: number; xp: number } {
  const k = Math.max(0, Math.min(40, kills));
  return {
    coins: 25 + k * 12 + (win ? 90 : 0),
    xp: 60 + k * 25 + (win ? 150 : 0),
  };
}

// ---------------------------------------------------------------- boutique

export type ShopKind = "skin" | "camo" | "dance";

export interface ShopItem {
  key: string;
  kind: ShopKind;
  id: string;
  name: string;
  rarity: Rarity;
  price: number;
  tagline: string;
}

/** Tout objet du casier, a partir de sa cle (« skin:neon », « dance:floss »). */
export function shopItem(key: string): ShopItem | null {
  const [kind, id] = key.split(":");
  if (kind === "skin" && id in SKINS) {
    const s = SKINS[id as SkinId];
    return { key, kind, id, name: s.name, rarity: s.rarity, price: s.price, tagline: s.tagline };
  }
  if (kind === "camo" && id in CAMOS) {
    const c = CAMOS[id as CamoId];
    return { key, kind, id, name: c.name, rarity: c.rarity, price: c.price, tagline: c.tagline };
  }
  if (kind === "dance" && id in DANCES) {
    const d = DANCES[id as DanceId];
    return { key, kind, id, name: d.name, rarity: d.rarity, price: d.price, tagline: d.tagline };
  }
  return null;
}

/** Tous les objets payants, dans l'ordre du casier. */
export function allShopKeys(): string[] {
  return [
    ...SKIN_ORDER.filter((s) => SKINS[s].price > 0).map((s) => `skin:${s}`),
    ...CAMO_ORDER.filter((c) => CAMOS[c].price > 0).map((c) => `camo:${c}`),
    ...DANCE_ORDER.filter((d) => DANCES[d].price > 0).map((d) => `dance:${d}`),
  ];
}

export function dayKey(date = new Date()): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

/**
 * La boutique du jour : deux objets a la une (un epique ou legendaire, et une
 * danse) et six offres, les memes pour tout le monde ce jour-la. Un tirage a
 * graine sur la date, sans serveur.
 */
export function dailyShop(date = new Date()): { featured: string[]; daily: string[] } {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  let seed = (day * 2654435761) >>> 0;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pool = allShopKeys();
  const take = (filter: (k: string) => boolean) => {
    const candidates = pool.filter(filter);
    if (candidates.length === 0) return null;
    const pick = candidates[Math.floor(rand() * candidates.length)];
    pool.splice(pool.indexOf(pick), 1);
    return pick;
  };
  const featured = [
    take((k) => {
      const item = shopItem(k);
      return item !== null && (item.rarity === "legendaire" || item.rarity === "epique");
    }),
    take((k) => k.startsWith("dance:")),
  ].filter((k): k is string => k !== null);
  const daily: string[] = [];
  while (daily.length < 6 && pool.length > 0) {
    const pick = take(() => true);
    if (pick) daily.push(pick);
  }
  return { featured, daily };
}

export interface ShopPack {
  id: string;
  name: string;
  tagline: string;
  items: string[];
  /** Reduction sur le prix des objets qu'on n'a pas encore. */
  discount: number;
}

/** Les packs : un theme complet, moins cher que les objets un par un. */
export const SHOP_PACKS: ShopPack[] = [
  {
    id: "neon",
    name: "Pack Néon",
    tagline: "Tenue Néon, camouflage Carbone et la danse Disco.",
    items: ["skin:neon", "camo:carbone", "dance:disco"],
    discount: 0.3,
  },
  {
    id: "volcan",
    name: "Pack Volcan",
    tagline: "Tenue Magma, camouflage Dragon et la danse Robot.",
    items: ["skin:magma", "camo:dragon", "dance:robot"],
    discount: 0.3,
  },
  {
    id: "legende",
    name: "Pack Légende",
    tagline: "Roi Midas, Or massif et la danse Champion. Tout en or.",
    items: ["skin:or", "camo:or", "dance:champion"],
    discount: 0.35,
  },
];

/** Prix d'un pack pour ce joueur : les objets deja possedes ne se paient pas. */
export function packPrice(pack: ShopPack, owned: string[]): number {
  const rest = pack.items.filter((k) => !owned.includes(k));
  const full = rest.reduce((sum, k) => sum + (shopItem(k)?.price ?? 0), 0);
  return Math.round((full * (1 - pack.discount)) / 10) * 10;
}

/** Pieces offertes une fois par jour, en passant par la boutique. */
export const DAILY_GIFT = 120;

export function giftAvailable(profile: DuelProfile, date = new Date()): boolean {
  return profile.lastGift !== dayKey(date);
}
