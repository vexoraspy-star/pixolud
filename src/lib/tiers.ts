export type Tier = "free" | "standard" | "max";

export const TIERS: Record<
  Tier,
  {
    label: string;
    price: number;
    badge: string | null;
    maxPublishedGames: number;
    bigBoards: boolean;
    featured: boolean;
  }
> = {
  free: {
    label: "Gratuit",
    price: 0,
    badge: null,
    maxPublishedGames: 3,
    bigBoards: false,
    featured: false,
  },
  standard: {
    label: "Standard",
    price: 1.99,
    badge: "⭐",
    maxPublishedGames: 15,
    bigBoards: false,
    featured: false,
  },
  max: {
    label: "Max",
    price: 4.99,
    badge: "👑",
    maxPublishedGames: Infinity,
    bigBoards: true,
    featured: true,
  },
};

// Vignettes exclusives : disponibles seulement à partir du palier indiqué.
export const EXCLUSIVE_GRADIENTS: { value: string; minTier: Tier }[] = [
  { value: "from-yellow-300 via-pink-500 to-purple-600", minTier: "standard" },
  { value: "from-cyan-400 via-blue-500 to-indigo-700", minTier: "standard" },
  { value: "from-fuchsia-500 via-red-500 to-orange-400", minTier: "max" },
  { value: "from-emerald-400 via-cyan-500 to-blue-600", minTier: "max" },
];

export const EXCLUSIVE_EMOJIS: { value: string; minTier: Tier }[] = [
  { value: "💎", minTier: "standard" },
  { value: "🔥", minTier: "standard" },
  { value: "👑", minTier: "max" },
  { value: "🌟", minTier: "max" },
];

export function tierAtLeast(tier: Tier, min: Tier): boolean {
  const order: Tier[] = ["free", "standard", "max"];
  return order.indexOf(tier) >= order.indexOf(min);
}
