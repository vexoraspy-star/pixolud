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

export type SkinId =
  | "commando"
  | "desert"
  | "arctique"
  | "ombre"
  | "neon"
  | "magma"
  | "or"
  | "jungle"
  | "marine"
  | "pompier"
  | "cyber"
  | "vaudou"
  | "toxique"
  | "samourai"
  | "cosmonaute"
  | "pirate"
  | "arlequin"
  | "prisme";
export type CamoId =
  | "standard"
  | "foret"
  | "desert"
  | "urbain"
  | "carbone"
  | "dragon"
  | "or"
  | "tigre"
  | "neige"
  | "nuit"
  | "corail"
  | "circuit"
  | "givre"
  | "pixel"
  | "orage"
  | "prisme";

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
  jungle: {
    id: "jungle",
    name: "Traqueur",
    rarity: "commun",
    price: 400,
    tagline: "Feuilles mouillees et peinture de guerre.",
    cloth: 0x3f5233,
    gear: 0x22301c,
    accent: 0x8fd14f,
    visor: 0xc7f07a,
    sleeve: 0x3f5233,
    glove: 0x2b3a22,
  },
  marine: {
    id: "marine",
    name: "Abysse",
    rarity: "commun",
    price: 400,
    tagline: "Bleu profond, comme trois cents metres plus bas.",
    cloth: 0x1f3554,
    gear: 0x12203a,
    accent: 0x3ba7ff,
    visor: 0x9fdcff,
    sleeve: 0x1f3554,
    glove: 0x2a4a72,
  },
  pompier: {
    id: "pompier",
    name: "Brasier",
    rarity: "rare",
    price: 900,
    tagline: "Bandes reflechissantes et casque cabosse.",
    cloth: 0x8f2f1c,
    gear: 0x3a1410,
    accent: 0xffd166,
    visor: 0xffe9b0,
    sleeve: 0x8f2f1c,
    glove: 0x50201a,
  },
  cyber: {
    id: "cyber",
    name: "Cyber",
    rarity: "rare",
    price: 900,
    tagline: "Plaques noires et circuits qui respirent.",
    cloth: 0x161a26,
    gear: 0x0b0d14,
    accent: 0x00e5c8,
    visor: 0x6cfff0,
    sleeve: 0x161a26,
    glove: 0x00e5c8,
  },
  vaudou: {
    id: "vaudou",
    name: "Vaudou",
    rarity: "rare",
    price: 1000,
    tagline: "Masque de bois et plumes teintes.",
    cloth: 0x4a2c1d,
    gear: 0x2a1710,
    accent: 0xe4572e,
    visor: 0xf7c59f,
    sleeve: 0x4a2c1d,
    glove: 0x76432a,
  },
  toxique: {
    id: "toxique",
    name: "Toxique",
    rarity: "epique",
    price: 1600,
    tagline: "Combinaison etanche, verre embue.",
    cloth: 0x27351a,
    gear: 0x14200d,
    accent: 0xb6ff2f,
    visor: 0xdcff8a,
    sleeve: 0x27351a,
    glove: 0xb6ff2f,
  },
  samourai: {
    id: "samourai",
    name: "Samouraï",
    rarity: "epique",
    price: 1700,
    tagline: "Laque rouge, cordons noirs, masque de fer.",
    cloth: 0x8c1c2b,
    gear: 0x1a1013,
    accent: 0xf2e2c4,
    visor: 0xffd9a0,
    sleeve: 0x8c1c2b,
    glove: 0x33161c,
  },
  cosmonaute: {
    id: "cosmonaute",
    name: "Cosmonaute",
    rarity: "epique",
    price: 1800,
    tagline: "Blanc spatial, visiere doree.",
    cloth: 0xe8ecf1,
    gear: 0x9aa3ad,
    accent: 0xffc93c,
    visor: 0xffd86b,
    sleeve: 0xe8ecf1,
    glove: 0xb9c2cc,
  },
  pirate: {
    id: "pirate",
    name: "Corsaire",
    rarity: "epique",
    price: 1800,
    tagline: "Manteau lourd et boucle d'oreille.",
    cloth: 0x2b2138,
    gear: 0x140f1c,
    accent: 0xd94f70,
    visor: 0xffb3c6,
    sleeve: 0x2b2138,
    glove: 0x6b4a2a,
  },
  arlequin: {
    id: "arlequin",
    name: "Arlequin",
    rarity: "legendaire",
    price: 2600,
    tagline: "Deux couleurs, aucune pitie.",
    cloth: 0x1b1030,
    gear: 0x3a0d4a,
    accent: 0xff3ea5,
    visor: 0x8cf5ff,
    sleeve: 0x1b1030,
    glove: 0xff3ea5,
  },
  prisme: {
    id: "prisme",
    name: "Prisme",
    rarity: "legendaire",
    price: 3000,
    tagline: "La lumiere se casse dessus.",
    cloth: 0xdfe9ff,
    gear: 0x7a8bd0,
    accent: 0xb06bff,
    visor: 0x7cf7ff,
    sleeve: 0xdfe9ff,
    glove: 0xb06bff,
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
  tigre: {
    id: "tigre",
    name: "Tigre",
    rarity: "commun",
    price: 300,
    tagline: "Rayures chaudes sur fond fauve.",
    colors: ["#e09a3c", "#a8641d", "#3a2410", "#141008"],
  },
  neige: {
    id: "neige",
    name: "Congère",
    rarity: "commun",
    price: 300,
    tagline: "Blanc sale et ombres bleues.",
    colors: ["#eef3f7", "#c3ced8", "#8d9aa6", "#5b6873"],
  },
  nuit: {
    id: "nuit",
    name: "Minuit",
    rarity: "rare",
    price: 600,
    tagline: "Bleu nuit et taches d'encre.",
    colors: ["#2b3550", "#1a2238", "#101526", "#070a12"],
  },
  corail: {
    id: "corail",
    name: "Corail",
    rarity: "rare",
    price: 650,
    tagline: "Rose vif et bleu lagon.",
    colors: ["#ff8fab", "#f25c78", "#2ec4b6", "#0f5257"],
  },
  circuit: {
    id: "circuit",
    name: "Circuit",
    rarity: "rare",
    price: 700,
    tagline: "Pistes vertes sur plaque noire.",
    colors: ["#1b2a1f", "#0e1512", "#2fe07a", "#0b3a22"],
  },
  givre: {
    id: "givre",
    name: "Givre",
    rarity: "epique",
    price: 1200,
    tagline: "Cristaux bleus qui montent le long du canon.",
    colors: ["#dff6ff", "#9ad8f2", "#4a93c4", "#1d3f5c"],
  },
  pixel: {
    id: "pixel",
    name: "Pixel",
    rarity: "epique",
    price: 1300,
    tagline: "Carres violets, comme un vieil ecran.",
    colors: ["#c08bff", "#7a3fd6", "#3a1c66", "#150a26"],
  },
  orage: {
    id: "orage",
    name: "Orage",
    rarity: "epique",
    price: 1400,
    tagline: "Gris lourd traverse d'éclairs.",
    colors: ["#5a6472", "#39414d", "#f2e35c", "#171b21"],
  },
  prisme: {
    id: "prisme",
    name: "Prisme",
    rarity: "legendaire",
    price: 2200,
    tagline: "Toutes les couleurs, selon l'angle.",
    colors: ["#ff6ec7", "#7cf7ff", "#b06bff", "#2a1b4a"],
  },
};

export const SKIN_ORDER: SkinId[] = [
  "commando", "desert", "jungle", "marine",
  "arctique", "ombre", "pompier", "cyber", "vaudou",
  "neon", "magma", "toxique", "samourai", "cosmonaute", "pirate",
  "or", "arlequin", "prisme",
];
export const CAMO_ORDER: CamoId[] = [
  "standard", "foret", "desert", "tigre", "neige",
  "urbain", "carbone", "nuit", "corail", "circuit",
  "dragon", "givre", "pixel", "orage",
  "or", "prisme",
];

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

/** Nombre d'offres du jour, en plus des deux objets a la une. */
export const DAILY_SLOTS = 10;

/**
 * La boutique du jour : deux objets a la une (un epique ou legendaire, et une
 * danse) et dix offres, les memes pour tout le monde ce jour-la. Un tirage a
 * graine sur la date, sans serveur : deux joueurs voient la meme boutique, et
 * elle change a minuit sans que personne n'ait rien a faire.
 *
 * Avec une quarantaine d'objets au catalogue, douze places par jour laissent
 * de quoi attendre : on ne voit pas tout d'un coup, et revenir le lendemain a
 * un interet.
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
  while (daily.length < DAILY_SLOTS && pool.length > 0) {
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
