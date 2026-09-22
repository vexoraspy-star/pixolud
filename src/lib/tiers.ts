export type Tier = "free" | "standard" | "max" | "studio";

/**
 * Les paliers.
 *
 * Le palier gratuit est volontairement limite : il permet d'essayer,
 * d'apprendre et de publier quelques jeux, pas de tenir un catalogue entier.
 * C'est un choix, pas un oubli.
 *
 * `scriptMax` est la longueur maximale d'un programme Game Script, en
 * caracteres. C'est la limite la plus honnete a vendre : elle ne bride pas
 * l'envie de creer (2 000 caracteres suffisent largement pour un premier
 * jeu), mais un jeu ambitieux — plusieurs ecrans, des ennemis, des niveaux —
 * demande de la place, et cette place coute du stockage et de la bande
 * passante a chaque partie jouee.
 */
export const TIERS: Record<
  Tier,
  {
    label: string;
    price: number;
    badge: string | null;
    maxPublishedGames: number;
    bigBoards: boolean;
    featured: boolean;
    /** Longueur maximale d'un programme Game Script, en caracteres. */
    scriptMax: number;
    /** Resume vendeur, affiche sur la page Premium. */
    pitch: string;
  }
> = {
  free: {
    label: "Gratuit",
    price: 0,
    badge: null,
    maxPublishedGames: 3,
    bigBoards: false,
    featured: false,
    scriptMax: 2000,
    pitch: "Pour essayer, apprendre et publier ses premiers jeux.",
  },
  standard: {
    label: "Standard",
    price: 4.99,
    badge: "⭐",
    maxPublishedGames: 15,
    bigBoards: false,
    featured: false,
    scriptMax: 10000,
    pitch: "Pour celui qui publie regulierement et veut un peu de place.",
  },
  max: {
    label: "Max",
    price: 7.99,
    badge: "👑",
    maxPublishedGames: Infinity,
    bigBoards: true,
    featured: true,
    scriptMax: 25000,
    pitch: "Pour les gros niveaux, les jeux mis en avant, et sans compter.",
  },
  studio: {
    label: "Studio",
    price: 12.99,
    badge: "🏆",
    maxPublishedGames: Infinity,
    bigBoards: true,
    featured: true,
    scriptMax: 60000,
    pitch: "Pour ceux qui programment de vrais jeux, longs et complets.",
  },
};

export const TIER_ORDER: Tier[] = ["free", "standard", "max", "studio"];

// Vignettes exclusives : disponibles seulement à partir du palier indiqué.
export const EXCLUSIVE_GRADIENTS: { value: string; minTier: Tier }[] = [
  { value: "from-yellow-300 via-pink-500 to-purple-600", minTier: "standard" },
  { value: "from-cyan-400 via-blue-500 to-indigo-700", minTier: "standard" },
  { value: "from-fuchsia-500 via-red-500 to-orange-400", minTier: "max" },
  { value: "from-emerald-400 via-cyan-500 to-blue-600", minTier: "max" },
  { value: "from-amber-200 via-rose-400 to-violet-700", minTier: "studio" },
  { value: "from-slate-900 via-violet-700 to-fuchsia-400", minTier: "studio" },
];

export const EXCLUSIVE_EMOJIS: { value: string; minTier: Tier }[] = [
  { value: "💎", minTier: "standard" },
  { value: "🔥", minTier: "standard" },
  { value: "👑", minTier: "max" },
  { value: "🌟", minTier: "max" },
  { value: "🏆", minTier: "studio" },
  { value: "🪐", minTier: "studio" },
];

export function tierAtLeast(tier: Tier, min: Tier): boolean {
  return TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(min);
}

/** Le palier d'une valeur venue de la base, toujours valide. */
export function tierOf(value: unknown): Tier {
  const t = String(value ?? "free");
  return (TIER_ORDER as string[]).includes(t) ? (t as Tier) : "free";
}

/** La limite de code du palier, pour Game Script. */
export function scriptLimit(tier: Tier): number {
  return TIERS[tier].scriptMax;
}
