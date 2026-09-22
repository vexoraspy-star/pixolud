import { tierAtLeast, type Tier } from "./tiers";

/**
 * Les cadres d'avatar.
 *
 * Un cadre, c'est l'anneau autour de la photo de profil : c'est ce qui se voit
 * partout (liste d'amis, party, profil) et ce que les joueurs comparent. Les
 * quatre premiers sont pour tout le monde ; les suivants demandent un palier,
 * parce que c'est exactement le genre de chose qu'on a envie de payer et qui
 * ne donne aucun avantage en jeu.
 *
 * Un cadre n'est que du CSS : deux couleurs et, pour certains, une rotation
 * lente. Rien a telecharger, rien a dessiner.
 */

export interface Frame {
  id: string;
  label: string;
  /** Degrade de l'anneau (valeurs CSS, utilisees dans un conic-gradient). */
  couleurs: [string, string];
  /** L'anneau tourne lentement. */
  anime?: boolean;
  minTier: Tier;
}

export const FRAMES: Frame[] = [
  { id: "aucun", label: "Aucun", couleurs: ["transparent", "transparent"], minTier: "free" },
  { id: "violet", label: "Violet", couleurs: ["#8b5cf6", "#d946ef"], minTier: "free" },
  { id: "menthe", label: "Menthe", couleurs: ["#34d399", "#06b6d4"], minTier: "free" },
  { id: "braise", label: "Braise", couleurs: ["#fb923c", "#ef4444"], minTier: "free" },
  { id: "nuit", label: "Nuit étoilée", couleurs: ["#1e3a8a", "#7c3aed"], minTier: "free" },
  { id: "arcenciel", label: "Arc-en-ciel", couleurs: ["#f472b6", "#22d3ee"], anime: true, minTier: "standard" },
  { id: "or", label: "Or massif", couleurs: ["#fbbf24", "#f59e0b"], anime: true, minTier: "standard" },
  { id: "neon", label: "Néon", couleurs: ["#22d3ee", "#a3e635"], anime: true, minTier: "standard" },
  { id: "diamant", label: "Diamant", couleurs: ["#e0f2fe", "#818cf8"], anime: true, minTier: "max" },
  { id: "couronne", label: "Couronne", couleurs: ["#fde68a", "#f43f5e"], anime: true, minTier: "max" },
  { id: "aurore", label: "Aurore", couleurs: ["#34d399", "#a78bfa"], anime: true, minTier: "studio" },
  { id: "eclipse", label: "Éclipse", couleurs: ["#f97316", "#0f172a"], anime: true, minTier: "studio" },
];

export function frameById(id: string | null | undefined): Frame {
  return FRAMES.find((f) => f.id === id) ?? FRAMES[0];
}

export function frameAllowed(id: string, tier: Tier): boolean {
  const f = FRAMES.find((x) => x.id === id);
  return Boolean(f && tierAtLeast(tier, f.minTier));
}

/** Le style inline de l'anneau, pour le composant Avatar. */
export function frameStyle(frame: Frame): React.CSSProperties {
  if (frame.id === "aucun") return {};
  return {
    background: `conic-gradient(from 0deg, ${frame.couleurs[0]}, ${frame.couleurs[1]}, ${frame.couleurs[0]})`,
    animation: frame.anime ? "avatar-frame-spin 6s linear infinite" : undefined,
  };
}
