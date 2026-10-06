/**
 * Mots meles : une grille de lettres ou se cachent les mots d'un theme.
 *
 * Le createur ne dessine pas la grille : il donne un theme, ses mots, une
 * taille et un niveau. La grille est GENEREE a partir de ces reglages et d'une
 * graine (un nombre tire a la creation). Tous les joueurs voient donc
 * exactement la meme grille, et le createur la voit avant de publier ; « Nouvelle
 * grille » change seulement la graine.
 *
 * La porte de publication est la generation elle-meme : si les mots ne
 * tiennent pas tous dans la grille, le jeu n'est pas publiable.
 */

export type NiveauMotsMeles = "facile" | "moyen" | "difficile";

export interface MotsMelesData {
  theme: string;
  /** Les mots tels que le createur les a ecrits (accents, espaces compris). */
  mots: string[];
  /** Cote de la grille, en cases. */
  taille: number;
  niveau: NiveauMotsMeles;
  graine: number;
}

export const TAILLE_MIN = 8;
export const TAILLE_MAX = 15;
export const MOTS_MIN = 3;
export const MOTS_MAX = 20;
export const LETTRES_MIN = 3;

export const NIVEAUX: Record<NiveauMotsMeles, { label: string; texte: string }> = {
  facile: { label: "Facile", texte: "Mots de gauche à droite et de haut en bas." },
  moyen: { label: "Moyen", texte: "Plus les diagonales." },
  difficile: { label: "Difficile", texte: "Dans les huit directions, même à l'envers." },
};

/** Les directions autorisees selon le niveau, en (ligne, colonne). */
const DIRECTIONS: Record<NiveauMotsMeles, [number, number][]> = {
  facile: [
    [0, 1],
    [1, 0],
  ],
  moyen: [
    [0, 1],
    [1, 0],
    [1, 1],
    [-1, 1],
  ],
  difficile: [
    [0, 1],
    [1, 0],
    [1, 1],
    [-1, 1],
    [0, -1],
    [-1, 0],
    [-1, -1],
    [1, -1],
  ],
};

export function nouvelleGraine(): number {
  return Math.floor(Math.random() * 2_147_483_647);
}

export function emptyMotsMeles(): MotsMelesData {
  return { theme: "", mots: [], taille: 10, niveau: "facile", graine: nouvelleGraine() };
}

/**
 * Le mot tel qu'il se cache dans la grille : majuscules, sans accents ni
 * espaces ni tirets (« Pomme de terre » devient POMMEDETERRE, « Œuf » OEUF).
 */
export function normaliserMot(mot: string): string {
  return String(mot)
    .toUpperCase()
    .replace(/Œ/g, "OE")
    .replace(/Æ/g, "AE")
    .normalize("NFD")
    .replace(/[^A-Z]/g, "");
}

export type ProblemeMot = "court" | "long" | "doublon" | null;

export interface MotAnalyse {
  /** Le mot tel qu'ecrit (pour la liste a cocher). */
  brut: string;
  /** Le mot tel qu'il est cache dans la grille. */
  norm: string;
  probleme: ProblemeMot;
}

/** Valeurs bornees, meme si les donnees viennent abimees de la base. */
function reglages(data: MotsMelesData): { taille: number; niveau: NiveauMotsMeles; graine: number } {
  const t = Math.round(Number(data?.taille));
  const taille = Number.isFinite(t) ? Math.min(TAILLE_MAX, Math.max(TAILLE_MIN, t)) : 10;
  const niveau: NiveauMotsMeles = data?.niveau === "moyen" || data?.niveau === "difficile" ? data.niveau : "facile";
  const g = Math.floor(Number(data?.graine));
  return { taille, niveau, graine: Number.isFinite(g) ? g : 1 };
}

/** Chaque mot non vide, avec ce qui l'empeche eventuellement d'entrer dans la grille. */
export function analyserMots(data: MotsMelesData): MotAnalyse[] {
  const { taille } = reglages(data);
  const vus = new Set<string>();
  const liste = Array.isArray(data?.mots) ? data.mots : [];
  const res: MotAnalyse[] = [];
  for (const m of liste) {
    if (typeof m !== "string" || !m.trim()) continue;
    const brut = m.trim().slice(0, 40);
    const norm = normaliserMot(brut);
    let probleme: ProblemeMot = null;
    if (norm.length < LETTRES_MIN) probleme = "court";
    else if (norm.length > taille) probleme = "long";
    else if (vus.has(norm)) probleme = "doublon";
    vus.add(norm);
    res.push({ brut, norm, probleme });
  }
  return res;
}

export interface Placement {
  brut: string;
  norm: string;
  /** Les cases du mot, dans l'ordre des lettres. */
  cases: [number, number][];
}

export interface Grille {
  taille: number;
  lettres: string[][];
  placements: Placement[];
}

/** Generateur pseudo-aleatoire a graine (mulberry32) : meme graine, meme grille. */
function aleatoire(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Les lettres de remplissage, a peu pres a la frequence du francais : les mots
 * caches ne sautent pas aux yeux par une lettre rare autour d'eux.
 */
const REMPLISSAGE = "EEEEEEEEEEEEESSSSSSSAAAAAAAIIIIIIITTTTTTNNNNNNRRRRRRUUUUUULLLLLOOOOODDDCCCMMMPPPGGBBVVHHFFQJXYZK";

/** Combien d'essais avant de declarer que les mots ne tiennent pas. */
const ESSAIS = 40;

/**
 * Fabrique la grille. Rend null si les mots ne tiennent pas tous (ou s'il y en
 * a trop peu, ou s'il en reste un invalide) : le jeu n'est alors pas publiable.
 */
export function genererGrille(data: MotsMelesData): Grille | null {
  const { taille, niveau, graine } = reglages(data);
  const analyses = analyserMots(data);
  if (analyses.length < MOTS_MIN || analyses.length > MOTS_MAX) return null;
  if (analyses.some((m) => m.probleme)) return null;
  // Les plus longs d'abord : ce sont eux qui ont le moins de places possibles.
  const ordre = [...analyses].sort((x, y) => y.norm.length - x.norm.length);
  const directions = DIRECTIONS[niveau];

  for (let essai = 0; essai < ESSAIS; essai++) {
    const rnd = aleatoire((graine ^ Math.imul(essai + 1, 0x9e3779b1)) >>> 0);
    const lettres: string[][] = Array.from({ length: taille }, () => Array<string>(taille).fill(""));
    const placements: Placement[] = [];
    let rate = false;

    for (const mot of ordre) {
      const L = mot.norm.length;
      // Toutes les positions possibles pour ce mot, puis une au hasard.
      const possibles: { r: number; c: number; dr: number; dc: number }[] = [];
      for (const [dr, dc] of directions) {
        for (let r = 0; r < taille; r++) {
          for (let c = 0; c < taille; c++) {
            const rf = r + dr * (L - 1);
            const cf = c + dc * (L - 1);
            if (rf < 0 || rf >= taille || cf < 0 || cf >= taille) continue;
            let croisements = 0;
            let ok = true;
            for (let i = 0; i < L; i++) {
              const x = lettres[r + dr * i][c + dc * i];
              if (x === "") continue;
              if (x !== mot.norm[i]) {
                ok = false;
                break;
              }
              croisements++;
            }
            // Un mot entierement pose sur un autre ne cacherait rien.
            if (ok && croisements < L) possibles.push({ r, c, dr, dc });
          }
        }
      }
      if (possibles.length === 0) {
        rate = true;
        break;
      }
      const p = possibles[Math.floor(rnd() * possibles.length)];
      const cases: [number, number][] = [];
      for (let i = 0; i < L; i++) {
        const r = p.r + p.dr * i;
        const c = p.c + p.dc * i;
        lettres[r][c] = mot.norm[i];
        cases.push([r, c]);
      }
      placements.push({ brut: mot.brut, norm: mot.norm, cases });
    }
    if (rate) continue;

    for (let r = 0; r < taille; r++) {
      for (let c = 0; c < taille; c++) {
        if (lettres[r][c] === "") lettres[r][c] = REMPLISSAGE[Math.floor(rnd() * REMPLISSAGE.length)];
      }
    }
    // On rend les mots dans l'ordre ou le createur les a ecrits (la liste a cocher).
    const rang = new Map(analyses.map((m, i) => [m.norm, i]));
    placements.sort((x, y) => (rang.get(x.norm) ?? 0) - (rang.get(y.norm) ?? 0));
    return { taille, lettres, placements };
  }
  return null;
}

export function isMotsMelesPlayable(data: MotsMelesData): boolean {
  return genererGrille(data) !== null;
}

/**
 * Les cases d'un trait tire de `debut` vers `vers`, ramene sur la direction
 * la plus proche (horizontale, verticale ou diagonale) : on n'a pas besoin de
 * viser au pixel pres pour tracer une diagonale.
 */
export function traceSelection(
  debut: [number, number],
  vers: [number, number],
  taille: number,
): [number, number][] {
  const dy = vers[0] - debut[0];
  const dx = vers[1] - debut[1];
  if (dy === 0 && dx === 0) return [debut];
  const angle = Math.atan2(dy, dx);
  const huitieme = Math.round(angle / (Math.PI / 4));
  const dr = Math.round(Math.sin((huitieme * Math.PI) / 4));
  const dc = Math.round(Math.cos((huitieme * Math.PI) / 4));
  const longueur = Math.max(Math.abs(dy), Math.abs(dx));
  const cases: [number, number][] = [];
  for (let i = 0; i <= longueur; i++) {
    const r = debut[0] + dr * i;
    const c = debut[1] + dc * i;
    if (r < 0 || r >= taille || c < 0 || c >= taille) break;
    cases.push([r, c]);
  }
  return cases;
}

/**
 * Le trait trace correspond-il a un mot encore a trouver ? Lu dans un sens ou
 * dans l'autre. Rend le mot trouve, ou null.
 */
export function motDuTrait(grille: Grille, cases: [number, number][], dejaTrouves: Set<string>): Placement | null {
  if (cases.length < LETTRES_MIN) return null;
  const texte = cases.map(([r, c]) => grille.lettres[r]?.[c] ?? "").join("");
  const envers = texte.split("").reverse().join("");
  for (const p of grille.placements) {
    if (dejaTrouves.has(p.norm)) continue;
    if (p.norm === texte || p.norm === envers) return p;
  }
  return null;
}
