// Cubes — les recettes de fabrication.
//
// Trois postes, comme dans le jeu dont on s'inspire :
//   - « main » : partout, depuis l'inventaire (la petite grille 2 x 2) ;
//   - « table » : pres d'une table de craft (la grande grille 3 x 3) ;
//   - « four » : pres d'un four ; chaque cuisson brule un charbon.
// Une recette ne depend pas de la disposition des ingredients : on liste ce
// qu'il faut, le joueur choisit la recette dans un livre de recettes.

import {
  BIBLIOTHEQUE, BLOC_CHARBON, BLOC_DIAMANT, BLOC_FER, BLOC_OR, BLOC_OS, BOTTE_FOIN, BRIQUE, BRIQUES_FISSUREES,
  BRIQUES_MOUSSUES, BRIQUES_PIERRE, CACTUS, CANNE_A_SUCRE, CHAMPIGNON_BRUN, CHAMPIGNON_ROUGE, CITROUILLE,
  CITROUILLE_LANTERNE, COULEURS, FEUILLES, FLEUR_BLEUE, FLEUR_JAUNE, FLEUR_ROUGE, FOUR, GRAVIER, GRES, GRES_ROUGE,
  GRES_TAILLE, LAINE_BLANCHE, LAMPE, MELON, PIERRE, PIERRE_CISELEE, PIERRE_LUMINEUSE, PIERRE_MOUSSUE, PIERRE_POLIE,
  PIERRE_TAILLEE, PLANCHES, PLANCHES_CLAIRES, PLANCHES_SOMBRES, SABLE, TABLE_CRAFT, TERRE, TERRE_CUITE, TORCHE, TRONC,
  VERRE, beton, laine, lampeCouleur, terreCuiteTeintee, verreTeinte,
} from "./voxel";
import {
  ARC, ARMOR_MATERIALS, ARMOR_SLOTS, BATON, BLE, BOL, BONBON, BOUCLIER, BOUSSOLE, BRIQUE_ITEM, BROCHETTE, CHAIR_POURRIE,
  CHARBON_ITEM, COOKIE, CUIR, DIAMANT_ITEM, EAU_SUCREE, FICELLE, FIOLE, FIOLE_EAU, FLECHE, GALETTE, GATEAU, GOURDE,
  HORLOGE, JUS_MELON, JUS_POMME, LINGOT_FER, LINGOT_OR, LIVRE, MINERAI_FER, MINERAI_OR, OS, PAIN, PAPIER, PEPITE_OR,
  POMME, POMME_CARAMEL, POMME_DOREE, POUDRE_OS, SALADE_FRUITS, SEAU, SILEX, SOUPE_CHAMPIGNONS, SUCRE, TARTE_CITROUILLE,
  THE, TOOL_MATERIALS, TOOL_TYPES, TRANCHE_MELON, armure, outil, teinture, type ArmorMaterial, type ThingId,
  type ToolMaterial,
} from "./voxelItems";

export type Station = "main" | "table" | "four";
export type Categorie = "construction" | "decoration" | "outils" | "armures" | "nourriture" | "materiaux" | "teintures";

export interface Recipe {
  /** Identifiant stable, unique. */
  id: string;
  out: ThingId;
  /** Quantite obtenue par fabrication. */
  n: number;
  /** Ingredients consommes. */
  in: [ThingId, number][];
  station: Station;
  categorie: Categorie;
}

export const STATION_LABEL: Record<Station, string> = { main: "À la main", table: "Table de craft", four: "Four" };
export const CATEGORIES: { id: Categorie; label: string }[] = [
  { id: "construction", label: "Construction" },
  { id: "decoration", label: "Décoration" },
  { id: "outils", label: "Outils et armes" },
  { id: "armures", label: "Armures" },
  { id: "nourriture", label: "Nourriture" },
  { id: "materiaux", label: "Matériaux" },
  { id: "teintures", label: "Teintures" },
];

const RECIPES: Recipe[] = [];
const ids = new Set<string>();

function r(id: string, out: ThingId, n: number, ingredients: [ThingId, number][], station: Station, categorie: Categorie) {
  if (ids.has(id)) throw new Error(`Recette en double : ${id}`);
  ids.add(id);
  RECIPES.push({ id, out, n, in: ingredients, station, categorie });
}
/** Cuisson au four : un charbon par fournee. */
function cuire(id: string, out: ThingId, n: number, ingredients: [ThingId, number][], categorie: Categorie) {
  r(id, out, n, [...ingredients, [CHARBON_ITEM, 1]], "four", categorie);
}

// --------------------------------------------------------------- a la main
r("planches", PLANCHES, 4, [[TRONC, 1]], "main", "construction");
r("baton", BATON, 4, [[PLANCHES, 2]], "main", "materiaux");
r("table_craft", TABLE_CRAFT, 1, [[PLANCHES, 4]], "main", "construction");
r("torche", TORCHE, 4, [[BATON, 1], [CHARBON_ITEM, 1]], "main", "decoration");
r("laine_blanche", LAINE_BLANCHE, 1, [[FICELLE, 4]], "main", "decoration");
r("sucre", SUCRE, 1, [[CANNE_A_SUCRE, 1]], "main", "materiaux");
r("poudre_os", POUDRE_OS, 3, [[OS, 1]], "main", "materiaux");
r("pepites_or", PEPITE_OR, 9, [[LINGOT_OR, 1]], "main", "materiaux");
r("lingots_fer_bloc", LINGOT_FER, 9, [[BLOC_FER, 1]], "main", "materiaux");
r("lingots_or_bloc", LINGOT_OR, 9, [[BLOC_OR, 1]], "main", "materiaux");
r("diamants_bloc", DIAMANT_ITEM, 9, [[BLOC_DIAMANT, 1]], "main", "materiaux");
r("charbon_bloc", CHARBON_ITEM, 9, [[BLOC_CHARBON, 1]], "main", "materiaux");
r("ble_botte", BLE, 9, [[BOTTE_FOIN, 1]], "main", "materiaux");
r("poudre_os_bloc", POUDRE_OS, 9, [[BLOC_OS, 1]], "main", "materiaux");
r("bonbon", BONBON, 2, [[SUCRE, 2], [teinture(6), 1]], "main", "nourriture");
r("eau_sucree", EAU_SUCREE, 1, [[FIOLE_EAU, 1], [SUCRE, 1]], "main", "nourriture");

// Teintures : des fleurs et des plantes, puis des melanges.
const T = (cle: string) => teinture(COULEURS.findIndex((c) => c.cle === cle));
r("teinture_rouge", T("rouge"), 2, [[FLEUR_ROUGE, 1]], "main", "teintures");
r("teinture_jaune", T("jaune"), 2, [[FLEUR_JAUNE, 1]], "main", "teintures");
r("teinture_bleu", T("bleu"), 2, [[FLEUR_BLEUE, 1]], "main", "teintures");
r("teinture_blanc", T("blanc"), 1, [[POUDRE_OS, 1]], "main", "teintures");
r("teinture_noir", T("noir"), 1, [[CHARBON_ITEM, 1]], "main", "teintures");
r("teinture_marron", T("marron"), 1, [[CHAMPIGNON_BRUN, 1]], "main", "teintures");
cuire("teinture_vert", T("vert"), 2, [[CACTUS, 1]], "teintures");
r("teinture_orange", T("orange"), 2, [[T("rouge"), 1], [T("jaune"), 1]], "main", "teintures");
r("teinture_rose", T("rose"), 2, [[T("rouge"), 1], [T("blanc"), 1]], "main", "teintures");
r("teinture_violet", T("violet"), 2, [[T("bleu"), 1], [T("rouge"), 1]], "main", "teintures");
r("teinture_magenta", T("magenta"), 2, [[T("violet"), 1], [T("rose"), 1]], "main", "teintures");
r("teinture_bleuclair", T("bleuclair"), 2, [[T("bleu"), 1], [T("blanc"), 1]], "main", "teintures");
r("teinture_vertclair", T("vertclair"), 2, [[T("vert"), 1], [T("blanc"), 1]], "main", "teintures");
r("teinture_gris", T("gris"), 2, [[T("noir"), 1], [T("blanc"), 1]], "main", "teintures");
r("teinture_grisclair", T("grisclair"), 2, [[T("gris"), 1], [T("blanc"), 1]], "main", "teintures");
r("teinture_cyan", T("cyan"), 2, [[T("bleu"), 1], [T("vert"), 1]], "main", "teintures");

// Familles teintes : une teinture colore un bloc (ou une fournee).
COULEURS.forEach((c, i) => {
  if (c.cle !== "blanc") r(`laine_${c.cle}`, laine(i), 1, [[LAINE_BLANCHE, 1], [teinture(i), 1]], "main", "decoration");
  r(`verre_${c.cle}`, verreTeinte(i), 8, [[VERRE, 8], [teinture(i), 1]], "table", "decoration");
  r(`beton_${c.cle}`, beton(i), 8, [[SABLE, 4], [GRAVIER, 4], [teinture(i), 1]], "table", "decoration");
  r(`terre_cuite_${c.cle}`, terreCuiteTeintee(i), 8, [[TERRE_CUITE, 8], [teinture(i), 1]], "table", "decoration");
  r(`lampe_${c.cle}`, lampeCouleur(i), 1, [[LAMPE, 1], [teinture(i), 1]], "table", "decoration");
});

// ------------------------------------------------------------------ table
r("four", FOUR, 1, [[PIERRE_TAILLEE, 8]], "table", "construction");
r("briques_pierre", BRIQUES_PIERRE, 4, [[PIERRE, 4]], "table", "construction");
r("pierre_ciselee", PIERRE_CISELEE, 1, [[BRIQUES_PIERRE, 2]], "table", "construction");
r("briques_moussues", BRIQUES_MOUSSUES, 1, [[BRIQUES_PIERRE, 1], [FEUILLES, 1]], "table", "construction");
r("pierre_moussue", PIERRE_MOUSSUE, 1, [[PIERRE_TAILLEE, 1], [FEUILLES, 1]], "table", "construction");
r("gres", GRES, 1, [[SABLE, 4]], "table", "construction");
r("gres_taille", GRES_TAILLE, 4, [[GRES, 4]], "table", "construction");
r("gres_rouge", GRES_ROUGE, 4, [[SABLE, 4], [T("rouge"), 1]], "table", "construction");
r("briques", BRIQUE, 1, [[BRIQUE_ITEM, 4]], "table", "construction");
r("planches_sombres", PLANCHES_SOMBRES, 4, [[PLANCHES, 4], [CHARBON_ITEM, 1]], "table", "construction");
r("planches_claires", PLANCHES_CLAIRES, 4, [[PLANCHES, 4], [POUDRE_OS, 1]], "table", "construction");
r("bibliotheque", BIBLIOTHEQUE, 1, [[PLANCHES, 6], [LIVRE, 3]], "table", "decoration");
r("citrouille_lanterne", CITROUILLE_LANTERNE, 1, [[CITROUILLE, 1], [TORCHE, 1]], "table", "decoration");
r("botte_foin", BOTTE_FOIN, 1, [[BLE, 9]], "table", "construction");
r("melon", MELON, 1, [[TRANCHE_MELON, 9]], "table", "construction");
r("bloc_fer", BLOC_FER, 1, [[LINGOT_FER, 9]], "table", "construction");
r("bloc_or", BLOC_OR, 1, [[LINGOT_OR, 9]], "table", "construction");
r("bloc_diamant", BLOC_DIAMANT, 1, [[DIAMANT_ITEM, 9]], "table", "construction");
r("bloc_charbon", BLOC_CHARBON, 1, [[CHARBON_ITEM, 9]], "table", "construction");
r("bloc_os", BLOC_OS, 1, [[POUDRE_OS, 9]], "table", "construction");
r("lingot_or_pepites", LINGOT_OR, 1, [[PEPITE_OR, 9]], "table", "materiaux");
r("lampe", LAMPE, 1, [[VERRE, 1], [TORCHE, 1], [PLANCHES, 2]], "table", "decoration");
r("pierre_lumineuse", PIERRE_LUMINEUSE, 2, [[PIERRE, 2], [CHARBON_ITEM, 1], [T("jaune"), 1]], "table", "decoration");
r("papier", PAPIER, 3, [[CANNE_A_SUCRE, 3]], "table", "materiaux");
r("livre", LIVRE, 1, [[PAPIER, 3], [CUIR, 1]], "table", "materiaux");
r("bol", BOL, 4, [[PLANCHES, 3]], "table", "materiaux");
r("seau", SEAU, 1, [[LINGOT_FER, 3]], "table", "outils");
r("fiole", FIOLE, 3, [[VERRE, 3]], "table", "materiaux");
r("gourde", GOURDE, 1, [[CUIR, 3], [FICELLE, 1]], "table", "outils");
r("arc", ARC, 1, [[BATON, 3], [FICELLE, 3]], "table", "outils");
r("fleches", FLECHE, 4, [[SILEX, 1], [BATON, 1]], "table", "outils");
r("bouclier", BOUCLIER, 1, [[PLANCHES, 6], [LINGOT_FER, 1]], "table", "outils");
r("boussole", BOUSSOLE, 1, [[LINGOT_FER, 4], [T("rouge"), 1]], "table", "outils");
r("horloge", HORLOGE, 1, [[LINGOT_OR, 4], [VERRE, 1]], "table", "outils");

// Outils : tete dans le materiau, manche en batons.
const TETE: Record<ToolMaterial, ThingId> = { bois: PLANCHES, pierre: PIERRE_TAILLEE, fer: LINGOT_FER, or: LINGOT_OR, diamant: DIAMANT_ITEM };
const FORME: Record<(typeof TOOL_TYPES)[number], [number, number]> = { pioche: [3, 2], hache: [3, 2], pelle: [1, 2], houe: [2, 2], epee: [2, 1] };
for (const type of TOOL_TYPES) for (const m of TOOL_MATERIALS) {
  const [tete, manche] = FORME[type];
  r(`${type}_${m}`, outil(type, m), 1, [[TETE[m], tete], [BATON, manche]], "table", "outils");
}

// Armures : le nombre de pieces du jeu d'origine.
const PIECE: Record<ArmorMaterial, ThingId> = { cuir: CUIR, fer: LINGOT_FER, or: LINGOT_OR, diamant: DIAMANT_ITEM };
const TAILLE = { casque: 5, plastron: 8, jambieres: 7, bottes: 4 } as const;
for (const slot of ARMOR_SLOTS) for (const m of ARMOR_MATERIALS) {
  r(`${slot}_${m}`, armure(slot, m), 1, [[PIECE[m], TAILLE[slot]]], "table", "armures");
}

// Cuisine.
r("pain", PAIN, 1, [[BLE, 3]], "table", "nourriture");
r("cookie", COOKIE, 8, [[BLE, 2], [T("marron"), 1]], "table", "nourriture");
r("gateau", GATEAU, 1, [[BLE, 3], [SUCRE, 2], [POMME, 1]], "table", "nourriture");
r("tarte_citrouille", TARTE_CITROUILLE, 1, [[CITROUILLE, 1], [SUCRE, 1], [BLE, 1]], "table", "nourriture");
r("pomme_doree", POMME_DOREE, 1, [[POMME, 1], [LINGOT_OR, 8]], "table", "nourriture");
r("soupe_champignons", SOUPE_CHAMPIGNONS, 1, [[CHAMPIGNON_BRUN, 1], [CHAMPIGNON_ROUGE, 1], [BOL, 1]], "table", "nourriture");
r("salade_fruits", SALADE_FRUITS, 1, [[POMME, 1], [TRANCHE_MELON, 2], [BOL, 1]], "table", "nourriture");
r("galette", GALETTE, 2, [[BLE, 2], [SUCRE, 1]], "table", "nourriture");
r("pomme_caramel", POMME_CARAMEL, 1, [[POMME, 1], [SUCRE, 2], [BATON, 1]], "table", "nourriture");
r("jus_pomme", JUS_POMME, 1, [[POMME, 2], [FIOLE, 1]], "table", "nourriture");
r("jus_melon", JUS_MELON, 1, [[TRANCHE_MELON, 3], [FIOLE, 1]], "table", "nourriture");

// ------------------------------------------------------------------- four
cuire("lingot_fer", LINGOT_FER, 1, [[MINERAI_FER, 1]], "materiaux");
cuire("lingot_or", LINGOT_OR, 1, [[MINERAI_OR, 1]], "materiaux");
cuire("verre", VERRE, 4, [[SABLE, 4]], "construction");
cuire("pierre", PIERRE, 4, [[PIERRE_TAILLEE, 4]], "construction");
cuire("pierre_polie", PIERRE_POLIE, 4, [[PIERRE, 4]], "construction");
cuire("briques_fissurees", BRIQUES_FISSUREES, 4, [[BRIQUES_PIERRE, 4]], "construction");
cuire("brique", BRIQUE_ITEM, 4, [[TERRE, 4]], "materiaux");
cuire("terre_cuite", TERRE_CUITE, 4, [[TERRE, 2], [SABLE, 2]], "construction");
cuire("cuir", CUIR, 1, [[CHAIR_POURRIE, 3]], "materiaux");
cuire("brochette", BROCHETTE, 1, [[CHAMPIGNON_BRUN, 2], [BATON, 1]], "nourriture");
cuire("the", THE, 1, [[FIOLE_EAU, 1], [FEUILLES, 2]], "nourriture");
// Charbon de bois : le seul qui ne demande pas de charbon (pour demarrer).
r("charbon_bois", CHARBON_ITEM, 1, [[TRONC, 2]], "four", "materiaux");

export const ALL_RECIPES: readonly Recipe[] = RECIPES;

/** Toutes les choses differentes qu'on peut fabriquer. */
export const CRAFTABLE: ReadonlySet<ThingId> = new Set(RECIPES.map((x) => x.out));

/** Combien de fois on peut lancer cette recette avec ce stock. */
export function maxCraft(recipe: Recipe, stock: Record<string, number>): number {
  let max = Infinity;
  for (const [id, n] of recipe.in) max = Math.min(max, Math.floor((stock[id] ?? 0) / n));
  return Number.isFinite(max) ? max : 0;
}

/** Fabrique `fois` fois : retire les ingredients et ajoute le resultat. Renvoie le nombre obtenu. */
export function craft(recipe: Recipe, stock: Record<string, number>, fois: number): number {
  const k = Math.min(fois, maxCraft(recipe, stock));
  if (k <= 0) return 0;
  for (const [id, n] of recipe.in) {
    stock[id] = (stock[id] ?? 0) - n * k;
    if (stock[id] <= 0) delete stock[id];
  }
  stock[recipe.out] = Math.min(1_000_000, (stock[recipe.out] ?? 0) + recipe.n * k);
  return recipe.n * k;
}

/** Nom affichable d'une recette (le resultat, avec sa quantite). */
export function recipeLabel(recipe: Recipe, name: (id: ThingId) => string): string {
  return recipe.n > 1 ? `${name(recipe.out)} ×${recipe.n}` : name(recipe.out);
}

