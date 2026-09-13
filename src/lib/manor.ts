import type { MazeData } from "./maze";

export interface ManorRoom {
  name: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  floor: 0 | 1;
}

// Le manoir a deux niveaux, mais la grille reste a plat : l'etage occupe des
// lignes de grille qui sont "plus loin" au sud, et l'escalier fait monter le
// sol de 0 a UPPER_Y au fil des lignes 21 a 26. Comme le mur du rez separe
// completement les deux zones, on ne voit jamais qu'elles sont cote a cote :
// on percoit un vrai etage. Avantage enorme : une seule grille, une seule
// hauteur de sol par case, donc collisions et IA restent en 2D.
//
// L'etage compte desormais deux rangees de pieces (lignes 27-32 et 34-39) :
// toutes les lignes au-dela de l'escalier sont a la hauteur UPPER_Y.
export const UPPER_Y = 3.2;
export const STAIR_X0 = 12;
export const STAIR_X1 = 14;
export const STAIR_ROW_FIRST = 21;
export const STAIR_ROW_LAST = 26;

const ROOMS: ManorRoom[] = [
  // --- Rez-de-chaussee, rangee nord ---
  { name: "Bureau", x0: 1, y0: 1, x1: 7, y1: 6, floor: 0 },
  { name: "Bibliothèque", x0: 9, y0: 1, x1: 15, y1: 6, floor: 0 },
  { name: "Chambre principale", x0: 17, y0: 1, x1: 23, y1: 6, floor: 0 },
  { name: "Serre", x0: 25, y0: 1, x1: 31, y1: 6, floor: 0 },
  { name: "Salle de bal", x0: 33, y0: 1, x1: 39, y1: 6, floor: 0 },
  { name: "Observatoire", x0: 41, y0: 1, x1: 47, y1: 6, floor: 0 },
  // --- Rez-de-chaussee, rangee du milieu ---
  { name: "Salon", x0: 1, y0: 8, x1: 7, y1: 13, floor: 0 },
  { name: "Grand hall", x0: 9, y0: 8, x1: 15, y1: 13, floor: 0 },
  { name: "Cuisine", x0: 17, y0: 8, x1: 23, y1: 13, floor: 0 },
  { name: "Galerie des portraits", x0: 25, y0: 8, x1: 31, y1: 13, floor: 0 },
  { name: "Salle des trophées", x0: 33, y0: 8, x1: 39, y1: 13, floor: 0 },
  { name: "Salon de musique", x0: 41, y0: 8, x1: 47, y1: 13, floor: 0 },
  // --- Rez-de-chaussee, rangee sud ---
  { name: "Salle à manger", x0: 1, y0: 15, x1: 7, y1: 20, floor: 0 },
  { name: "Entrée", x0: 9, y0: 15, x1: 15, y1: 20, floor: 0 },
  { name: "Cave", x0: 17, y0: 15, x1: 23, y1: 20, floor: 0 },
  { name: "Chapelle", x0: 25, y0: 15, x1: 31, y1: 20, floor: 0 },
  { name: "Crypte", x0: 33, y0: 15, x1: 39, y1: 20, floor: 0 },
  { name: "Laboratoire", x0: 41, y0: 15, x1: 47, y1: 20, floor: 0 },
  // --- Etage, premiere rangee ---
  { name: "Chambre d'enfant", x0: 2, y0: 27, x1: 8, y1: 32, floor: 1 },
  { name: "Palier", x0: 10, y0: 27, x1: 16, y1: 32, floor: 1 },
  { name: "Grenier", x0: 18, y0: 27, x1: 24, y1: 32, floor: 1 },
  { name: "Atelier", x0: 26, y0: 27, x1: 31, y1: 32, floor: 1 },
  { name: "Chambre de la gouvernante", x0: 33, y0: 27, x1: 39, y1: 32, floor: 1 },
  { name: "Archives", x0: 41, y0: 27, x1: 47, y1: 32, floor: 1 },
  // --- Etage, seconde rangee ---
  { name: "Nursery", x0: 2, y0: 34, x1: 8, y1: 39, floor: 1 },
  { name: "Salle de bain", x0: 10, y0: 34, x1: 16, y1: 39, floor: 1 },
  { name: "Chambre condamnée", x0: 18, y0: 34, x1: 24, y1: 39, floor: 1 },
  { name: "Lingerie", x0: 26, y0: 34, x1: 31, y1: 39, floor: 1 },
  { name: "Chambre du maître", x0: 33, y0: 34, x1: 39, y1: 39, floor: 1 },
  { name: "Bureau du docteur", x0: 41, y0: 34, x1: 47, y1: 39, floor: 1 },
];

const DOORS: [number, number, number, number][] = [
  // Aile principale
  [8, 3, 8, 4],
  [16, 3, 16, 4],
  [8, 10, 8, 11],
  [16, 10, 16, 11],
  [8, 17, 8, 18],
  [3, 7, 4, 7],
  [3, 14, 4, 14],
  [11, 7, 12, 7],
  [11, 14, 12, 14],
  [19, 7, 20, 7],
  // Aile est. La porte Chambre principale -> Serre etait en lignes 3-4,
  // pile derriere le lit : elle ne servait a rien. Descendue en 5-6.
  [24, 5, 24, 6],
  [24, 10, 24, 11],
  [27, 7, 28, 7],
  [27, 14, 28, 14],
  // Aile du fond
  [32, 4, 32, 5],
  [32, 9, 32, 10],
  [32, 15, 32, 16],
  [35, 7, 36, 7],
  [35, 14, 36, 14],
  // Aile de l'observatoire (le Laboratoire n'a qu'une entree : verrouillee)
  [40, 3, 40, 4],
  [40, 9, 40, 10],
  [43, 7, 44, 7],
  // Escalier : couloir montant qui relie l'Entree au Palier de l'etage.
  [STAIR_X0, STAIR_ROW_FIRST, STAIR_X1, STAIR_ROW_LAST],
  // Etage, premiere rangee
  [9, 29, 9, 30],
  [17, 29, 17, 30],
  [25, 29, 25, 30],
  [32, 29, 32, 30],
  [40, 30, 40, 31],
  // Etage : vers la seconde rangee
  [3, 33, 4, 33],
  [12, 33, 13, 33],
  [28, 33, 29, 33],
  [35, 33, 36, 33],
  // Etage, seconde rangee (la Chambre condamnee et le Bureau du docteur ne
  // communiquent avec rien d'autre que leur porte verrouillee)
  [9, 36, 9, 37],
  [32, 36, 32, 37],
];

// La seule entree de la cave, verrouillee par le code : c'est la porte de
// sortie du jeu.
export const CAVE_DOOR: { x0: number; y0: number; x1: number; y1: number } = {
  x0: 16,
  y0: 17,
  x1: 16,
  y1: 18,
};

export type KeyId = "cle-condamnee" | "cle-laboratoire" | "cle-docteur";

export interface LockedDoor {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  key: KeyId;
  /** Ce qu'on lit a l'ecran devant la porte. */
  label: string;
}

/**
 * Portes verrouillees a cle. Elles sont creusees dans la grille comme les
 * autres, mais bloquent tant qu'on n'a pas la cle : la chaine est Crypte ->
 * Chambre condamnee (obligatoire, une relique y est), et Nursery ->
 * Laboratoire -> Bureau du docteur (facultative, mais c'est la que sont la
 * boite a musique, le sel et une poupee).
 */
export const LOCKED_DOORS: LockedDoor[] = [
  { id: "condamnee", x0: 22, y0: 33, x1: 23, y1: 33, key: "cle-condamnee", label: "Chambre condamnée" },
  { id: "laboratoire", x0: 40, y0: 17, x1: 40, y1: 18, key: "cle-laboratoire", label: "Laboratoire" },
  { id: "docteur", x0: 43, y0: 33, x1: 44, y1: 33, key: "cle-docteur", label: "Bureau du docteur" },
];

export const MANOR_WIDTH = 49;
export const MANOR_HEIGHT = 41;

// Hauteur du sol pour une position continue en z (en cases).
export function floorHeightAt(z: number): number {
  if (z <= STAIR_ROW_FIRST) return 0;
  if (z >= STAIR_ROW_LAST + 1) return UPPER_Y;
  return ((z - STAIR_ROW_FIRST) / (STAIR_ROW_LAST + 1 - STAIR_ROW_FIRST)) * UPPER_Y;
}

/** L'autel de la cave : on y depose les 5 objets pour declencher la fin. */
export const ALTAR = { x0: 20, y0: 17, x1: 21, y1: 17 };
/** La trappe de sortie, revelee seulement une fois le rituel accompli. */
export const HATCH = { x: 22, y: 20 };

export type PropKind =
  | "shelf"
  | "table"
  | "seat"
  | "bed"
  | "crate"
  | "fireplace"
  | "piano"
  | "railing"
  | "altar"
  | "wardrobe";

/** Cote du mur contre lequel le meuble est adosse. */
export type Facing = "N" | "S" | "W" | "E";

export interface ManorProp {
  kind: PropKind;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Les meubles bloquent le passage, sauf ceux marques traversables. */
  walkable?: boolean;
  tint?: number;
  /** Calcule par buildManor : le dos du meuble va contre ce mur. */
  facing?: Facing;
}

/** Meubles dans lesquels on peut se cacher. */
export const HIDEOUT_KINDS: PropKind[] = ["wardrobe", "bed"];

// Meubles places a la main, colles aux murs, en laissant les passages entre
// portes degages (verifie par un BFS dans les tests).
const PROPS: ManorProp[] = [
  // --- Bureau ---
  { kind: "shelf", x0: 1, y0: 1, x1: 3, y1: 1 },
  { kind: "table", x0: 5, y0: 2, x1: 6, y1: 3 },
  { kind: "seat", x0: 5, y0: 4, x1: 5, y1: 4 },
  { kind: "shelf", x0: 7, y0: 5, x1: 7, y1: 6 },
  { kind: "wardrobe", x0: 1, y0: 5, x1: 1, y1: 5 },

  // --- Bibliotheque ---
  { kind: "shelf", x0: 9, y0: 1, x1: 11, y1: 1 },
  { kind: "shelf", x0: 13, y0: 1, x1: 15, y1: 1 },
  { kind: "table", x0: 11, y0: 3, x1: 12, y1: 4 },
  { kind: "shelf", x0: 15, y0: 5, x1: 15, y1: 6 },
  { kind: "wardrobe", x0: 9, y0: 6, x1: 9, y1: 6 },

  // --- Chambre principale ---
  { kind: "bed", x0: 21, y0: 2, x1: 23, y1: 4 },
  { kind: "shelf", x0: 17, y0: 1, x1: 18, y1: 1 },
  { kind: "table", x0: 20, y0: 2, x1: 20, y1: 2 },
  { kind: "crate", x0: 17, y0: 6, x1: 17, y1: 6 },
  { kind: "wardrobe", x0: 18, y0: 6, x1: 18, y1: 6 },

  // --- Salon ---
  { kind: "seat", x0: 1, y0: 9, x1: 3, y1: 9 },
  { kind: "fireplace", x0: 1, y0: 11, x1: 1, y1: 12 },
  { kind: "table", x0: 5, y0: 11, x1: 6, y1: 11 },
  { kind: "piano", x0: 5, y0: 13, x1: 7, y1: 13 },
  { kind: "wardrobe", x0: 7, y0: 8, x1: 7, y1: 8 },

  // --- Grand hall (on garde le centre degage) ---
  { kind: "table", x0: 9, y0: 8, x1: 9, y1: 8 },
  { kind: "table", x0: 15, y0: 8, x1: 15, y1: 8 },
  { kind: "table", x0: 14, y0: 12, x1: 15, y1: 12 },

  // --- Cuisine ---
  { kind: "table", x0: 21, y0: 8, x1: 23, y1: 8 },
  { kind: "shelf", x0: 17, y0: 8, x1: 18, y1: 8 },
  { kind: "table", x0: 21, y0: 11, x1: 22, y1: 12 },
  { kind: "crate", x0: 17, y0: 13, x1: 17, y1: 13 },
  { kind: "wardrobe", x0: 23, y0: 13, x1: 23, y1: 13 },

  // --- Salle a manger ---
  { kind: "table", x0: 2, y0: 17, x1: 5, y1: 18 },
  { kind: "shelf", x0: 1, y0: 20, x1: 2, y1: 20 },
  { kind: "seat", x0: 6, y0: 16, x1: 6, y1: 16 },
  { kind: "seat", x0: 6, y0: 19, x1: 6, y1: 19 },
  { kind: "wardrobe", x0: 7, y0: 20, x1: 7, y1: 20 },

  // --- Entree (on laisse x12..14 libre vers l'escalier) ---
  { kind: "shelf", x0: 9, y0: 15, x1: 9, y1: 15 },
  { kind: "table", x0: 9, y0: 19, x1: 10, y1: 19 },
  { kind: "shelf", x0: 15, y0: 15, x1: 15, y1: 15 },
  { kind: "seat", x0: 15, y0: 20, x1: 15, y1: 20 },

  // --- Cave (on laisse libre le chemin autel -> trappe en (22,20)) ---
  { kind: "crate", x0: 17, y0: 19, x1: 18, y1: 20 },
  { kind: "crate", x0: 22, y0: 15, x1: 23, y1: 16 },
  { kind: "altar", x0: ALTAR.x0, y0: ALTAR.y0, x1: ALTAR.x1, y1: ALTAR.y1 },

  // --- Serre (la caisse quitte (25,6) : elle bouchait la nouvelle porte) ---
  { kind: "shelf", x0: 25, y0: 1, x1: 26, y1: 1 },
  { kind: "table", x0: 30, y0: 2, x1: 31, y1: 3 },
  { kind: "seat", x0: 30, y0: 5, x1: 30, y1: 5 },
  { kind: "crate", x0: 26, y0: 6, x1: 26, y1: 6 },

  // --- Galerie des portraits ---
  { kind: "shelf", x0: 30, y0: 8, x1: 31, y1: 8 },
  { kind: "table", x0: 30, y0: 11, x1: 31, y1: 12 },
  { kind: "seat", x0: 25, y0: 13, x1: 25, y1: 13 },
  { kind: "wardrobe", x0: 31, y0: 13, x1: 31, y1: 13 },

  // --- Chapelle : bancs de part et d'autre, allee centrale libre ---
  { kind: "seat", x0: 25, y0: 17, x1: 26, y1: 17 },
  { kind: "seat", x0: 25, y0: 19, x1: 26, y1: 19 },
  { kind: "seat", x0: 30, y0: 17, x1: 31, y1: 17 },
  { kind: "seat", x0: 30, y0: 19, x1: 31, y1: 19 },
  { kind: "wardrobe", x0: 25, y0: 20, x1: 25, y1: 20 },

  // --- Salle de bal ---
  { kind: "piano", x0: 37, y0: 1, x1: 38, y1: 2 },
  { kind: "seat", x0: 33, y0: 1, x1: 34, y1: 1 },
  { kind: "seat", x0: 39, y0: 5, x1: 39, y1: 6 },
  { kind: "wardrobe", x0: 33, y0: 6, x1: 33, y1: 6 },

  // --- Salle des trophees ---
  { kind: "shelf", x0: 38, y0: 8, x1: 39, y1: 8 },
  { kind: "shelf", x0: 39, y0: 11, x1: 39, y1: 12 },
  { kind: "table", x0: 38, y0: 10, x1: 38, y1: 10 },
  { kind: "crate", x0: 33, y0: 13, x1: 33, y1: 13 },
  { kind: "wardrobe", x0: 33, y0: 8, x1: 33, y1: 8 },

  // --- Crypte : des cercueils le long des murs ---
  { kind: "crate", x0: 38, y0: 16, x1: 39, y1: 16 },
  { kind: "crate", x0: 38, y0: 19, x1: 39, y1: 19 },
  { kind: "crate", x0: 33, y0: 19, x1: 34, y1: 20 },
  { kind: "wardrobe", x0: 39, y0: 20, x1: 39, y1: 20 },

  // --- Observatoire ---
  { kind: "table", x0: 46, y0: 2, x1: 47, y1: 3 },
  { kind: "shelf", x0: 41, y0: 1, x1: 41, y1: 1 },
  { kind: "seat", x0: 45, y0: 5, x1: 45, y1: 5 },
  { kind: "wardrobe", x0: 47, y0: 5, x1: 47, y1: 5 },

  // --- Salon de musique ---
  { kind: "piano", x0: 46, y0: 9, x1: 47, y1: 10 },
  { kind: "seat", x0: 42, y0: 12, x1: 43, y1: 12 },
  { kind: "wardrobe", x0: 41, y0: 13, x1: 41, y1: 13 },

  // --- Laboratoire (verrouille) ---
  { kind: "table", x0: 43, y0: 15, x1: 45, y1: 15 },
  { kind: "table", x0: 46, y0: 19, x1: 47, y1: 20 },
  { kind: "shelf", x0: 47, y0: 16, x1: 47, y1: 17 },
  { kind: "crate", x0: 42, y0: 20, x1: 42, y1: 20 },

  // --- Palier (l'etage) ---
  { kind: "railing", x0: 10, y0: 27, x1: 11, y1: 27, walkable: true },
  { kind: "railing", x0: 15, y0: 27, x1: 16, y1: 27, walkable: true },
  { kind: "seat", x0: 10, y0: 31, x1: 10, y1: 31 },
  { kind: "table", x0: 16, y0: 31, x1: 16, y1: 32 },

  // --- Chambre d'enfant ---
  { kind: "bed", x0: 2, y0: 28, x1: 3, y1: 30 },
  { kind: "crate", x0: 5, y0: 32, x1: 5, y1: 32 },
  { kind: "seat", x0: 7, y0: 28, x1: 7, y1: 28 },
  { kind: "shelf", x0: 8, y0: 32, x1: 8, y1: 32 },
  { kind: "wardrobe", x0: 2, y0: 32, x1: 2, y1: 32 },

  // --- Grenier (l'etagere recule d'une case : elle bouchait la porte de l'Atelier) ---
  { kind: "crate", x0: 22, y0: 27, x1: 23, y1: 28 },
  { kind: "shelf", x0: 24, y0: 31, x1: 24, y1: 32 },
  { kind: "crate", x0: 19, y0: 31, x1: 20, y1: 32 },
  { kind: "table", x0: 21, y0: 30, x1: 21, y1: 30 },
  { kind: "wardrobe", x0: 18, y0: 27, x1: 18, y1: 27 },

  // --- Atelier ---
  { kind: "crate", x0: 30, y0: 27, x1: 31, y1: 28 },
  { kind: "table", x0: 26, y0: 32, x1: 27, y1: 32 },
  { kind: "shelf", x0: 31, y0: 31, x1: 31, y1: 32 },
  { kind: "wardrobe", x0: 26, y0: 27, x1: 26, y1: 27 },

  // --- Chambre de la gouvernante ---
  { kind: "bed", x0: 37, y0: 27, x1: 39, y1: 29 },
  { kind: "table", x0: 33, y0: 27, x1: 33, y1: 27 },
  { kind: "seat", x0: 34, y0: 32, x1: 34, y1: 32 },
  { kind: "shelf", x0: 39, y0: 32, x1: 39, y1: 32 },
  { kind: "wardrobe", x0: 33, y0: 31, x1: 33, y1: 31 },

  // --- Archives ---
  { kind: "shelf", x0: 41, y0: 27, x1: 43, y1: 27 },
  { kind: "shelf", x0: 45, y0: 27, x1: 47, y1: 27 },
  { kind: "table", x0: 44, y0: 30, x1: 45, y1: 30 },
  { kind: "wardrobe", x0: 47, y0: 31, x1: 47, y1: 31 },
  { kind: "crate", x0: 46, y0: 32, x1: 46, y1: 32 },

  // --- Nursery ---
  { kind: "bed", x0: 2, y0: 37, x1: 3, y1: 39 },
  { kind: "seat", x0: 7, y0: 34, x1: 7, y1: 34 },
  { kind: "wardrobe", x0: 8, y0: 39, x1: 8, y1: 39 },
  { kind: "crate", x0: 6, y0: 39, x1: 6, y1: 39 },

  // --- Salle de bain ---
  { kind: "crate", x0: 15, y0: 38, x1: 16, y1: 39 },
  { kind: "shelf", x0: 16, y0: 35, x1: 16, y1: 35 },
  { kind: "wardrobe", x0: 10, y0: 39, x1: 10, y1: 39 },
  { kind: "table", x0: 14, y0: 34, x1: 14, y1: 34 },

  // --- Chambre condamnee (verrouillee) ---
  { kind: "bed", x0: 18, y0: 37, x1: 20, y1: 39 },
  { kind: "wardrobe", x0: 24, y0: 39, x1: 24, y1: 39 },
  { kind: "seat", x0: 18, y0: 34, x1: 18, y1: 34 },
  { kind: "crate", x0: 24, y0: 35, x1: 24, y1: 35 },

  // --- Lingerie ---
  { kind: "shelf", x0: 26, y0: 35, x1: 26, y1: 37 },
  { kind: "crate", x0: 30, y0: 39, x1: 31, y1: 39 },
  { kind: "wardrobe", x0: 26, y0: 39, x1: 26, y1: 39 },
  { kind: "table", x0: 29, y0: 38, x1: 29, y1: 38 },

  // --- Chambre du maitre ---
  { kind: "bed", x0: 37, y0: 37, x1: 39, y1: 39 },
  { kind: "wardrobe", x0: 39, y0: 34, x1: 39, y1: 34 },
  { kind: "table", x0: 33, y0: 39, x1: 33, y1: 39 },
  { kind: "fireplace", x0: 39, y0: 35, x1: 39, y1: 36 },

  // --- Bureau du docteur (verrouille) ---
  { kind: "table", x0: 45, y0: 36, x1: 46, y1: 37 },
  { kind: "seat", x0: 45, y0: 38, x1: 45, y1: 38 },
  { kind: "shelf", x0: 47, y0: 35, x1: 47, y1: 37 },
  { kind: "wardrobe", x0: 41, y0: 39, x1: 41, y1: 39 },
];

export interface ManorData extends MazeData {
  rooms: ManorRoom[];
  props: ManorProp[];
  /** Cases occupees par un meuble : bloquantes pour l'IA et le placement. */
  blocked: [number, number][];
}

export function buildManor(): ManorData {
  const width = MANOR_WIDTH;
  const height = MANOR_HEIGHT;
  const solid: boolean[][] = Array.from({ length: height }, () => new Array(width).fill(true));

  function carve(x0: number, y0: number, x1: number, y1: number) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x >= 0 && y >= 0 && x < width && y < height) solid[y][x] = false;
      }
    }
  }
  for (const r of ROOMS) carve(r.x0, r.y0, r.x1, r.y1);
  for (const [x0, y0, x1, y1] of DOORS) carve(x0, y0, x1, y1);
  carve(CAVE_DOOR.x0, CAVE_DOOR.y0, CAVE_DOOR.x1, CAVE_DOOR.y1);
  for (const d of LOCKED_DOORS) carve(d.x0, d.y0, d.x1, d.y1);

  const walls: [number, number][] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (solid[y][x]) walls.push([x, y]);
    }
  }
  const isWall = (x: number, y: number) =>
    x < 0 || y < 0 || x >= width || y >= height || solid[y][x];

  const blocked: [number, number][] = [];
  const props: ManorProp[] = PROPS.map((p) => ({ ...p, facing: facingFor(p, isWall) }));
  for (const p of props) {
    if (p.walkable) continue;
    for (let y = p.y0; y <= p.y1; y++) {
      for (let x = p.x0; x <= p.x1; x++) blocked.push([x, y]);
    }
  }

  const entree = ROOMS.find((r) => r.name === "Entrée")!;

  return {
    width,
    height,
    walls,
    start: [Math.floor((entree.x0 + entree.x1) / 2), Math.floor((entree.y0 + entree.y1) / 2)],
    // La vraie sortie est la trappe, pas le centre de la cave (occupe par l'autel).
    end: [HATCH.x, HATCH.y],
    rooms: ROOMS,
    props,
    blocked,
  };
}

/**
 * Contre quel mur le meuble est-il adosse ? Un meuble plus long que profond
 * s'aligne sur sa longueur ; un meuble d'une seule case regarde le mur voisin.
 *
 * C'etait le mur invisible : l'ancien code amincissait TOUJOURS l'axe nord-sud.
 * Pour une etagere posee le long d'un mur est ou ouest, c'est sa longueur qui
 * etait coupee de moitie a l'ecran, alors que toutes ses cases bloquaient.
 */
function facingFor(p: ManorProp, isWall: (x: number, y: number) => boolean): Facing {
  const spanX = p.x1 - p.x0 + 1;
  const spanZ = p.y1 - p.y0 + 1;
  const wallN = isWall(p.x0, p.y0 - 1);
  const wallS = isWall(p.x0, p.y1 + 1);
  const wallW = isWall(p.x0 - 1, p.y0);
  const wallE = isWall(p.x1 + 1, p.y0);
  if (spanX > spanZ) return wallS && !wallN ? "S" : "N";
  if (spanZ > spanX) return wallE && !wallW ? "E" : "W";
  if (wallN) return "N";
  if (wallS) return "S";
  if (wallW) return "W";
  if (wallE) return "E";
  return "N";
}

/** Une boite de meuble, en unites monde. */
export interface PropBox {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: number;
}

/** Emprise au sol d'un meuble, en cases (coordonnees continues). */
export interface Footprint {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/**
 * Dessine un meuble ET renvoie son emprise reelle au sol.
 *
 * L'emprise sert a la collision du joueur : elle vient des memes boites que
 * l'affichage, donc on ne peut plus jamais heurter un mur invisible autour
 * d'un meuble. L'IA et le placement des objets, eux, restent sur les cases.
 */
export function propGeometry(
  p: ManorProp,
  cellSize: number,
): { boxes: PropBox[]; footprint: Footprint | null } {
  const facing = p.facing ?? "N";
  const along = facing === "N" || facing === "S";
  const spanX = (p.x1 - p.x0 + 1) * cellSize * 0.84;
  const spanZ = (p.y1 - p.y0 + 1) * cellSize * 0.84;
  // Repere local : X = longueur du meuble, Z = profondeur, dos en -Z.
  const L = along ? spanX : spanZ;
  const D = along ? spanZ : spanX;
  const cx = ((p.x0 + p.x1) / 2 + 0.5) * cellSize;
  const cz = ((p.y0 + p.y1) / 2 + 0.5) * cellSize;
  const baseY = floorHeightAt((p.y0 + p.y1) / 2 + 0.5);
  const dark = p.tint ?? 0x33240f;
  const mid = 0x54401d;
  const cloth = 0x4a2620;
  const boxes: PropBox[] = [];

  // Passage du repere local au monde selon le mur d'adossement.
  const place = (lx: number, y: number, lz: number, lw: number, h: number, ld: number, color: number) => {
    let wx = lx;
    let wz = lz;
    let ww = lw;
    let wd = ld;
    if (facing === "S") {
      wx = -lx;
      wz = -lz;
    } else if (facing === "W") {
      wx = lz;
      wz = -lx;
      ww = ld;
      wd = lw;
    } else if (facing === "E") {
      wx = -lz;
      wz = lx;
      ww = ld;
      wd = lw;
    }
    boxes.push({ x: cx + wx, y: baseY + y, z: cz + wz, w: ww, h, d: wd, color });
  };

  switch (p.kind) {
    case "shelf": {
      // Adossee au mur : le corps n'occupe que la moitie arriere.
      place(0, 0.95, -D * 0.25, L, 1.9, D * 0.5, dark);
      for (let i = 0; i < 3; i++) place(0, 0.45 + i * 0.5, -D * 0.12, L * 0.9, 0.05, D * 0.34, mid);
      break;
    }
    case "wardrobe": {
      // Armoire haute : on s'y cache. Deux battants a l'avant, une corniche.
      place(0, 1.07, -D * 0.16, L * 0.96, 2.14, D * 0.66, 0x2a1d0e);
      place(0, 2.18, -D * 0.16, L, 0.1, D * 0.72, mid);
      for (const side of [-1, 1]) {
        place(side * L * 0.235, 1.05, D * 0.18, L * 0.45, 1.9, 0.05, 0x3a2812);
        place(side * L * 0.05, 1.08, D * 0.21, 0.04, 0.16, 0.04, 0x9c8455);
      }
      break;
    }
    case "fireplace": {
      place(0, 0.75, -D * 0.27, L, 1.5, D * 0.45, 0x3a3733);
      place(0, 0.5, -D * 0.1, L * 0.55, 0.9, D * 0.3, 0x0a0806);
      place(0, 1.36, -D * 0.17, L * 1.02, 0.14, D * 0.6, mid);
      break;
    }
    case "table": {
      // En coordonnees monde, comme les pieds : une table n'est adossee a
      // rien, la faire pivoter tournait son plateau de 90 degres.
      boxes.push({ x: cx, y: baseY + 0.74, z: cz, w: spanX, h: 0.08, d: spanZ, color: mid });
      const lx = spanX / 2 - 0.12;
      const lz = spanZ / 2 - 0.12;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          boxes.push({ x: cx + sx * lx, y: baseY + 0.35, z: cz + sz * lz, w: 0.09, h: 0.7, d: 0.09, color: dark });
        }
      }
      break;
    }
    case "seat": {
      boxes.push({ x: cx, y: baseY + 0.42, z: cz, w: spanX, h: 0.12, d: spanZ, color: cloth });
      boxes.push({ x: cx, y: baseY + 0.68, z: cz - spanZ / 2 + 0.08, w: spanX, h: 0.52, d: 0.12, color: dark });
      const lx = spanX / 2 - 0.1;
      const lz = spanZ / 2 - 0.1;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          boxes.push({ x: cx + sx * lx, y: baseY + 0.18, z: cz + sz * lz, w: 0.07, h: 0.36, d: 0.07, color: dark });
        }
      }
      break;
    }
    case "bed": {
      boxes.push({ x: cx, y: baseY + 0.22, z: cz, w: spanX, h: 0.44, d: spanZ, color: dark });
      boxes.push({ x: cx, y: baseY + 0.52, z: cz + 0.06, w: spanX * 0.94, h: 0.18, d: spanZ * 0.92, color: 0x6d5f4c });
      boxes.push({ x: cx, y: baseY + 0.9, z: cz - spanZ / 2 + 0.06, w: spanX, h: 0.95, d: 0.12, color: dark });
      boxes.push({ x: cx, y: baseY + 0.66, z: cz - spanZ / 2 + 0.34, w: spanX * 0.55, h: 0.12, d: spanZ * 0.16, color: 0x8d8272 });
      break;
    }
    case "crate": {
      boxes.push({ x: cx, y: baseY + 0.32, z: cz, w: spanX * 0.9, h: 0.64, d: spanZ * 0.9, color: mid });
      boxes.push({ x: cx + 0.06, y: baseY + 0.86, z: cz - 0.05, w: spanX * 0.62, h: 0.44, d: spanZ * 0.62, color: dark });
      break;
    }
    case "piano": {
      boxes.push({ x: cx, y: baseY + 0.5, z: cz, w: spanX, h: 0.7, d: spanZ, color: 0x161009 });
      boxes.push({ x: cx, y: baseY + 0.88, z: cz - spanZ * 0.08, w: spanX * 0.98, h: 0.07, d: spanZ * 0.8, color: 0x241a10 });
      boxes.push({ x: cx, y: baseY + 0.78, z: cz + spanZ * 0.3, w: spanX * 0.8, h: 0.06, d: spanZ * 0.22, color: 0xcfc6b4 });
      for (const sx of [-1, 1]) {
        boxes.push({ x: cx + sx * (spanX / 2 - 0.14), y: baseY + 0.22, z: cz, w: 0.12, h: 0.44, d: 0.12, color: 0x161009 });
      }
      break;
    }
    case "railing": {
      boxes.push({ x: cx, y: baseY + 0.98, z: cz, w: spanX, h: 0.08, d: 0.09, color: mid });
      const posts = Math.max(2, Math.round(spanX / 0.42));
      for (let i = 0; i <= posts; i++) {
        boxes.push({ x: cx - spanX / 2 + (i * spanX) / posts, y: baseY + 0.5, z: cz, w: 0.06, h: 0.92, d: 0.06, color: dark });
      }
      break;
    }
    case "altar": {
      const stone = 0x3d3a35;
      boxes.push({ x: cx, y: baseY + 0.16, z: cz, w: spanX * 0.95, h: 0.32, d: spanZ * 0.95, color: 0x2a2724 });
      boxes.push({ x: cx, y: baseY + 0.52, z: cz, w: spanX * 0.8, h: 0.42, d: spanZ * 0.8, color: stone });
      boxes.push({ x: cx, y: baseY + 0.78, z: cz, w: spanX, h: 0.12, d: spanZ, color: 0x4a4640 });
      for (const sx of [-1, 1]) {
        boxes.push({ x: cx + sx * (spanX / 2 - 0.22), y: baseY + 0.98, z: cz, w: 0.13, h: 0.3, d: 0.13, color: stone });
      }
      break;
    }
  }

  if (p.walkable || boxes.length === 0) return { boxes, footprint: null };

  // Emprise = boite englobante au sol de toutes les pieces, ramenee en cases.
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (const b of boxes) {
    x0 = Math.min(x0, b.x - b.w / 2);
    x1 = Math.max(x1, b.x + b.w / 2);
    z0 = Math.min(z0, b.z - b.d / 2);
    z1 = Math.max(z1, b.z + b.d / 2);
  }
  return {
    boxes,
    footprint: { x0: x0 / cellSize, z0: z0 / cellSize, x1: x1 / cellSize, z1: z1 / cellSize },
  };
}

export function roomAt(rooms: ManorRoom[], x: number, y: number): ManorRoom | null {
  for (const r of rooms) {
    if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return r;
  }
  return null;
}

export interface ManorItemDef {
  name: string;
  flavor: string;
  emoji: string;
}

export const MANOR_ITEMS: ManorItemDef[] = [
  { name: "Une clé rouillée", flavor: "Elle semble très vieille. À quoi ouvre-t-elle ?", emoji: "🗝️" },
  { name: "Un médaillon brisé", flavor: "Une photo à l'intérieur, trop abîmée pour la reconnaître.", emoji: "📿" },
  { name: "Un journal intime", flavor: "Les dernières pages parlent d'une « présence » dans les murs.", emoji: "📔" },
  { name: "Une bougie éteinte", flavor: "Encore tiède. Quelqu'un l'a soufflée il y a peu...", emoji: "🕯️" },
  { name: "Une photo de famille déchirée", flavor: "Un visage a été grossièrement rayé.", emoji: "🖼️" },
];

/**
 * Une des cinq reliques est toujours dans la Chambre condamnee : c'est ce qui
 * rend la cle de la Crypte obligatoire. Les quatre autres restent tirees au
 * sort hors des pieces verrouillees.
 */
export const LOCKED_RELIC_SPOT = { room: "Chambre condamnée", x: 21, y: 37 };

/** Les pieces verrouillees : aucun objet aleatoire n'y tombe. */
export const LOCKED_ROOMS = ["Chambre condamnée", "Laboratoire", "Bureau du docteur"];

/** Les indices du code de la cave : un par piece, dont un a l'etage. */
export const CLUE_SPOTS: { room: string; x: number; wallRow: number }[] = [
  { room: "Bureau", x: 4, wallRow: 0 },
  { room: "Chambre principale", x: 22, wallRow: 0 },
  { room: "Observatoire", x: 44, wallRow: 0 },
  { room: "Grenier", x: 20, wallRow: 26 },
];

/**
 * Quete secondaire : cinq poupees cachees aux quatre coins du manoir. La
 * derniere est au bout de la chaine de cles, dans le Bureau du docteur.
 */
export const DOLL_SPOTS: { room: string; x: number; y: number }[] = [
  { room: "Nursery", x: 5, y: 37 },
  { room: "Salon", x: 3, y: 12 },
  { room: "Salle de bal", x: 36, y: 3 },
  { room: "Salon de musique", x: 44, y: 11 },
  { room: "Bureau du docteur", x: 44, y: 37 },
];

/** Longueur du code de la cave : une plaque = un chiffre. */
export const CODE_LENGTH = CLUE_SPOTS.length;

/**
 * Les trois sceaux qui verrouillent la trappe apres le rituel. Leurs vitesses
 * de poursuite ont ete calibrees par simulation sur ces trois positions : on
 * ne les deplace pas sans refaire la simulation.
 */
export const SEALS: { room: string; x: number; y: number }[] = [
  { room: "Chapelle", x: 28, y: 18 },
  { room: "Bibliothèque", x: 12, y: 5 },
  { room: "Chambre d'enfant", x: 5, y: 29 },
];

export type PickupKind = "coin" | "battery" | "salt" | "musicbox" | KeyId | "note";

export interface PickupSpot {
  kind: PickupKind;
  x: number;
  y: number;
  /** Toujours present. Sinon, tire au sort parmi les emplacements du meme type. */
  fixed?: boolean;
  /** Pour une note : son identifiant dans MANOR_NOTES. */
  note?: string;
}

/**
 * Emplacements des objets ramassables. Les cles, les notes et les objets des
 * pieces verrouillees sont fixes ; pieces, piles et le reste sont tires au
 * sort a chaque partie parmi leurs emplacements.
 */
export const PICKUP_SPOTS: PickupSpot[] = [
  // Cles : la chaine
  { kind: "cle-condamnee", x: 35, y: 17, fixed: true },
  { kind: "cle-laboratoire", x: 6, y: 35, fixed: true },
  { kind: "cle-docteur", x: 44, y: 18, fixed: true },
  // Sel : deux au Laboratoire, un autre quelque part
  { kind: "salt", x: 43, y: 17, fixed: true },
  { kind: "salt", x: 45, y: 17, fixed: true },
  { kind: "salt", x: 30, y: 37 },
  { kind: "salt", x: 4, y: 10 },
  { kind: "salt", x: 45, y: 12 },
  // Boite a musique
  { kind: "musicbox", x: 42, y: 36, fixed: true },
  { kind: "musicbox", x: 42, y: 10 },
  { kind: "musicbox", x: 13, y: 10 },
  // Pieces a lancer
  { kind: "coin", x: 5, y: 5 },
  { kind: "coin", x: 13, y: 5 },
  { kind: "coin", x: 19, y: 4 },
  { kind: "coin", x: 5, y: 9 },
  { kind: "coin", x: 12, y: 10 },
  { kind: "coin", x: 19, y: 12 },
  { kind: "coin", x: 3, y: 19 },
  { kind: "coin", x: 28, y: 3 },
  { kind: "coin", x: 28, y: 11 },
  { kind: "coin", x: 35, y: 11 },
  { kind: "coin", x: 42, y: 5 },
  { kind: "coin", x: 13, y: 30 },
  { kind: "coin", x: 20, y: 28 },
  { kind: "coin", x: 12, y: 37 },
  { kind: "coin", x: 28, y: 36 },
  { kind: "coin", x: 35, y: 37 },
  // Piles
  { kind: "battery", x: 3, y: 3 },
  { kind: "battery", x: 21, y: 10 },
  { kind: "battery", x: 10, y: 12 },
  { kind: "battery", x: 29, y: 16 },
  { kind: "battery", x: 36, y: 19 },
  { kind: "battery", x: 6, y: 29 },
  { kind: "battery", x: 28, y: 30 },
  { kind: "battery", x: 43, y: 29 },
  { kind: "battery", x: 15, y: 37 },
  // Notes : l'histoire, et quelques indices
  { kind: "note", x: 2, y: 3, fixed: true, note: "pere" },
  { kind: "note", x: 20, y: 29, fixed: true, note: "grenier" },
  { kind: "note", x: 4, y: 38, fixed: true, note: "berceuse" },
  { kind: "note", x: 19, y: 35, fixed: true, note: "condamnee" },
  { kind: "note", x: 46, y: 16, fixed: true, note: "laboratoire" },
  { kind: "note", x: 46, y: 39, fixed: true, note: "docteur" },
];

/** Combien d'objets de chaque type tirer au sort (en plus des fixes). */
export const PICKUP_RANDOM_COUNT: Partial<Record<PickupKind, number>> = {
  coin: 10,
  battery: 6,
  salt: 1,
  musicbox: 1,
};

export interface ManorNote {
  id: string;
  title: string;
  text: string;
}

/** Les pages qu'on trouve dans le manoir. Certaines disent ou chercher. */
export const MANOR_NOTES: ManorNote[] = [
  {
    id: "pere",
    title: "Journal du père — 3 novembre",
    text: "Elle ne dort plus. Elle dit qu'une dame marche dans les couloirs quand la maison se tait. J'ai fait graver les chiffres de la cave dans quatre pièces différentes, pour que personne ne puisse y descendre seul.",
  },
  {
    id: "grenier",
    title: "Mot griffonné",
    text: "Elle entend tout. Marche courbée, ne cours jamais, et ne rallume pas ta lampe quand elle est près. Si tu dois te cacher, fais-le avant qu'elle te voie — après, c'est trop tard.",
  },
  {
    id: "berceuse",
    title: "Berceuse, écrite au crayon",
    text: "Dors, petite, la dame est passée... La clé du docteur n'est pas ici. Il l'a enfermée avec le reste, au Laboratoire. La mienne, je l'ai cachée dans le coffre à jouets.",
  },
  {
    id: "condamnee",
    title: "Lettre non envoyée",
    text: "Ils ont muré cette chambre après l'accident. Ils disent que je suis partie. Je n'ai jamais quitté la maison. Je compte les poupées, une par une, pour ne pas oublier leurs noms.",
  },
  {
    id: "laboratoire",
    title: "Notes du docteur Aubert",
    text: "Le sel la fait reculer quelques secondes, rien de plus. Le bruit l'attire bien plus sûrement que la lumière. Une boîte à musique posée loin de soi suffit à l'éloigner le temps de passer.",
  },
  {
    id: "docteur",
    title: "Dernière page du registre",
    text: "Cinq reliques sur l'autel la réveilleront tout à fait. Je ne sais pas si quelqu'un sortira par la trappe. Je sais seulement qu'elle attendait quelqu'un. Elle a toujours attendu quelqu'un.",
  },
];
