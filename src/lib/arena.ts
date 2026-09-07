import type { Tier } from "@/lib/tiers";

export const ARENA_GRID_W = 32;
export const ARENA_GRID_H = 20;
export const ARENA_CELL_PX = 32;
export const ARENA_STALE_MS = 4000;

export const ARENA_CHARACTERS = ["🐍", "🦖", "🐲", "🚀", "👾", "🤖", "🐱", "🦊", "🐸", "🦄"];

export type Point = [number, number];

export type ArenaMode = "territoire" | "chasse" | "bulles" | "echecs" | "python-chat";

export interface ArenaModeInfo {
  id: ArenaMode;
  label: string;
  emoji: string;
  description: string;
  gradient: string;
}

export const ARENA_MODES: ArenaModeInfo[] = [
  {
    id: "territoire",
    label: "Territoire",
    emoji: "🗺️",
    description:
      "Trace une traînée et reviens sur ta zone pour la capturer. Évite les traînées adverses !",
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    id: "chasse",
    label: "Chasse aux objets",
    emoji: "💎",
    description:
      "Ramasse un maximum de gemmes avant les autres joueurs sur la carte partagée.",
    gradient: "from-amber-400 to-orange-500",
  },
  {
    id: "bulles",
    label: "Bulles géantes",
    emoji: "🫧",
    description:
      "Absorbe les bulles plus petites que toi pour grossir, évite les plus grosses !",
    gradient: "from-fuchsia-500 to-purple-600",
  },
  {
    id: "echecs",
    label: "Échecs",
    emoji: "♟️",
    description:
      "Une partie à deux en temps réel. Crée une partie et partage le code avec un ami.",
    gradient: "from-zinc-600 to-zinc-800",
  },
  {
    id: "python-chat",
    label: "Chat en Python",
    emoji: "🐍",
    description:
      "Pour parler, écris du code Python avec print(...) ! Le résultat de ton code devient ton message.",
    gradient: "from-emerald-600 to-teal-700",
  },
];

/** Un pseudo doré, ça ne change aucune règle du jeu : juste un cosmétique pour les abonnés. */
export function hasGoldenName(tier: Tier): boolean {
  return tier === "standard" || tier === "max";
}

export interface ArenaIdentity {
  pseudo: string;
  emoji: string;
  tier: Tier;
}
