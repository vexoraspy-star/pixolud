/**
 * Le stand d'entrainement du Duel.
 *
 * Quatre exercices d'une minute, chacun pour une qualite precise :
 *  - Cibles fixes  : le « flick », passer d'une cible a l'autre d'un geste sec.
 *  - Cibles mobiles: le suivi, garder le reticule sur quelqu'un qui bouge.
 *  - Reflexes      : une cible a la fois, qui disparait vite. Temps de reaction.
 *  - Precision     : seuls les tirs a la tete comptent.
 *
 * Les cibles ne tirent pas. Munitions illimitees, on change d'arme avec 1 a 9 :
 * on travaille la visee, pas la gestion du chargeur.
 */

export type DrillId = "fixes" | "mobiles" | "reflexes" | "precision";

export interface Drill {
  id: DrillId;
  name: string;
  tagline: string;
  detail: string;
  /** Duree de l'exercice, en secondes. */
  seconds: number;
  /** Cibles presentes en meme temps. */
  targets: number;
  /** Points de vie d'une cible (1 = tombe au premier coup). */
  hp: number;
  /** Les cibles font des pas de cote. */
  moving: boolean;
  /** Une cible non touchee disparait apres ce delai (secondes). */
  lifetime?: number;
  /** Seuls les tirs a la tete font des degats. */
  headOnly?: boolean;
  /** Distance d'apparition, en cases. */
  minDist: number;
  maxDist: number;
}

export const DRILLS: Record<DrillId, Drill> = {
  fixes: {
    id: "fixes",
    name: "Cibles fixes",
    tagline: "Flick",
    detail: "Quatre cibles immobiles, un seul coup chacune. Dès qu'une tombe, une autre apparaît ailleurs.",
    seconds: 60,
    targets: 4,
    hp: 1,
    moving: false,
    minDist: 4,
    maxDist: 14,
  },
  mobiles: {
    id: "mobiles",
    name: "Cibles mobiles",
    tagline: "Suivi",
    detail: "Trois cibles qui font des pas de côté et changent de sens. Garde le réticule dessus.",
    seconds: 60,
    targets: 3,
    hp: 100,
    moving: true,
    minDist: 5,
    maxDist: 13,
  },
  reflexes: {
    id: "reflexes",
    name: "Réflexes",
    tagline: "Réaction",
    detail: "Une cible à la fois, n'importe où autour de toi. Elle disparaît au bout d'une seconde et demie.",
    seconds: 60,
    targets: 1,
    hp: 1,
    moving: false,
    lifetime: 1.5,
    minDist: 4,
    maxDist: 12,
  },
  precision: {
    id: "precision",
    name: "Précision",
    tagline: "Tête",
    detail: "Trois cibles immobiles. Seuls les tirs à la tête comptent : le corps ne fait rien.",
    seconds: 60,
    targets: 3,
    hp: 1,
    moving: false,
    headOnly: true,
    minDist: 5,
    maxDist: 15,
  },
};

export const DRILL_ORDER: DrillId[] = ["fixes", "mobiles", "reflexes", "precision"];

export interface TrainingResult {
  drill: DrillId;
  /** Cibles abattues. */
  kills: number;
  shots: number;
  hits: number;
  headshots: number;
  /** Cibles disparues sans avoir ete touchees (reflexes). */
  missedTargets: number;
  /** Temps moyen entre l'apparition d'une cible et sa chute, en millisecondes. */
  avgReactionMs: number | null;
  /** Score : cibles abattues, bonus de precision. */
  score: number;
}

export function trainingScore(r: Omit<TrainingResult, "score">): number {
  const accuracy = r.shots > 0 ? r.hits / r.shots : 0;
  return Math.round(r.kills * 100 * (0.5 + accuracy * 0.5) + r.headshots * 20);
}

const BEST_KEY = "pixolud-duel-entrainement";

export function loadTrainingBests(): Partial<Record<DrillId, number>> {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    const data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const out: Partial<Record<DrillId, number>> = {};
    for (const id of DRILL_ORDER) {
      const v = data[id];
      if (typeof v === "number" && Number.isFinite(v)) out[id] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** Enregistre le score s'il bat le record. Renvoie vrai si c'est un record. */
export function saveTrainingBest(drill: DrillId, score: number): boolean {
  const bests = loadTrainingBests();
  if ((bests[drill] ?? -1) >= score) return false;
  bests[drill] = score;
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(bests));
  } catch {
    // stockage indisponible : le record ne sera pas garde, rien de grave
  }
  return true;
}
