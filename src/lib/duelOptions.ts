// Reglages propres au Duel : reticule, affichage technique, laser, bots.
//
// Ils sont a part de `settings3d` (clavier, sensibilite, luminosite) parce
// qu'ils ne concernent qu'un seul jeu — mais ils se conservent pareil, dans
// le navigateur, pour ne pas etre a refaire a chaque partie.

export type CrosshairStyle = "croix" | "croix-point" | "point" | "cercle" | "chevrons" | "aucun";
export type CrosshairColorId = "blanc" | "vert" | "cyan" | "jaune" | "rose" | "rouge" | "orange";
export type BotLevelId = "detente" | "normal" | "difficile" | "cauchemar";

export interface DuelOptions {
  crosshair: CrosshairStyle;
  color: CrosshairColorId;
  /** Longueur d'une branche, en pixels. */
  size: number;
  /** Trou au centre, en pixels. */
  gap: number;
  thickness: number;
  /** Le reticule s'ouvre quand on court et quand on tire. */
  dynamic: boolean;
  /** Contour noir : indispensable sur les murs clairs. */
  outline: boolean;
  showFps: boolean;
  showPing: boolean;
  laser: boolean;
  bots: BotLevelId;
}

export const CROSSHAIR_COLORS: Record<CrosshairColorId, string> = {
  blanc: "#ffffff",
  vert: "#4ef08a",
  cyan: "#4ee0ff",
  jaune: "#ffe04e",
  rose: "#ff6ad5",
  rouge: "#ff4d4d",
  orange: "#ffa64d",
};

export const CROSSHAIR_STYLES: { id: CrosshairStyle; label: string }[] = [
  { id: "croix", label: "Croix" },
  { id: "croix-point", label: "Croix + point" },
  { id: "point", label: "Point" },
  { id: "cercle", label: "Cercle" },
  { id: "chevrons", label: "Chevrons" },
  { id: "aucun", label: "Aucun" },
];

/**
 * Les quatre niveaux de bot. Tout se joue sur quatre chiffres : le temps
 * qu'ils mettent a ouvrir le feu, leur precision de base, leur cadence et
 * leurs degats. « Detente » laisse le temps de traverser a decouvert ;
 * « Cauchemar » punit une seconde d'hesitation.
 */
export interface BotLevel {
  id: BotLevelId;
  label: string;
  tagline: string;
  /** Secondes de vue avant le premier tir. */
  reaction: number;
  /** Precision de base, avant la distance et le mouvement. */
  accuracy: number;
  /** Multiplicateur du delai entre deux tirs (plus petit = plus rapide). */
  fireDelay: number;
  /** Multiplicateur de degats. */
  damage: number;
  /** Vivacite des pas de cote. */
  strafe: number;
}

export const BOT_LEVELS: Record<BotLevelId, BotLevel> = {
  detente: {
    id: "detente",
    label: "Détente",
    tagline: "Ils visent mal et prennent leur temps.",
    reaction: 0.95,
    accuracy: 0.42,
    fireDelay: 1.55,
    damage: 0.8,
    strafe: 0.7,
  },
  normal: {
    id: "normal",
    label: "Normal",
    tagline: "L'équilibre d'origine : battable en bougeant.",
    reaction: 0.5,
    accuracy: 0.62,
    fireDelay: 1,
    damage: 1,
    strafe: 1,
  },
  difficile: {
    id: "difficile",
    label: "Difficile",
    tagline: "Réaction rapide, tirs serrés. Il faut du couvert.",
    reaction: 0.32,
    accuracy: 0.74,
    fireDelay: 0.78,
    damage: 1.1,
    strafe: 1.3,
  },
  cauchemar: {
    id: "cauchemar",
    label: "Cauchemar",
    tagline: "Ils te touchent dès qu'ils te voient. Bonne chance.",
    reaction: 0.18,
    accuracy: 0.87,
    fireDelay: 0.58,
    damage: 1.25,
    strafe: 1.6,
  },
};

export const BOT_ORDER: BotLevelId[] = ["detente", "normal", "difficile", "cauchemar"];

export const DEFAULT_DUEL_OPTIONS: DuelOptions = {
  crosshair: "croix-point",
  color: "vert",
  size: 7,
  gap: 5,
  thickness: 2,
  dynamic: true,
  outline: true,
  showFps: false,
  showPing: true,
  laser: false,
  bots: "normal",
};

const KEY = "pixolud-duel-options";

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function loadDuelOptions(): DuelOptions {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_DUEL_OPTIONS };
    const saved = JSON.parse(raw) as Partial<DuelOptions>;
    return {
      crosshair: CROSSHAIR_STYLES.some((s) => s.id === saved.crosshair)
        ? (saved.crosshair as CrosshairStyle)
        : DEFAULT_DUEL_OPTIONS.crosshair,
      color: saved.color && saved.color in CROSSHAIR_COLORS ? saved.color : DEFAULT_DUEL_OPTIONS.color,
      size: clampNumber(saved.size, 0, 20, DEFAULT_DUEL_OPTIONS.size),
      gap: clampNumber(saved.gap, 0, 20, DEFAULT_DUEL_OPTIONS.gap),
      thickness: clampNumber(saved.thickness, 1, 5, DEFAULT_DUEL_OPTIONS.thickness),
      dynamic: saved.dynamic ?? DEFAULT_DUEL_OPTIONS.dynamic,
      outline: saved.outline ?? DEFAULT_DUEL_OPTIONS.outline,
      showFps: saved.showFps ?? DEFAULT_DUEL_OPTIONS.showFps,
      showPing: saved.showPing ?? DEFAULT_DUEL_OPTIONS.showPing,
      laser: saved.laser ?? DEFAULT_DUEL_OPTIONS.laser,
      bots: saved.bots && saved.bots in BOT_LEVELS ? saved.bots : DEFAULT_DUEL_OPTIONS.bots,
    };
  } catch {
    return { ...DEFAULT_DUEL_OPTIONS };
  }
}

export function saveDuelOptions(options: DuelOptions) {
  try {
    localStorage.setItem(KEY, JSON.stringify(options));
  } catch {
    // Navigation privee : on joue quand meme, sans conserver les reglages.
  }
}
