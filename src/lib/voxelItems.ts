// Cubes — les objets qui ne sont pas des blocs : outils, armes, armures,
// nourriture, boissons, materiaux et teintures.
//
// Un meme numero designe une « chose » de l'inventaire :
//   - de 1 a 255 : un bloc (voir BLOCKS dans voxel.ts) ;
//   - a partir de 256 : un objet de ce fichier.
// Les numeros sont ecrits dans les sauvegardes : on AJOUTE a la fin des
// listes, on ne reordonne et ne supprime jamais rien.

import {
  BLE_0, BLE_1, BLE_2, BLOCKS, CANNE_A_SUCRE, CHAMPIGNON_BRUN, CHAMPIGNON_ROUGE, CHARBON, COULEURS, DIAMANT, FEUILLES, FER, GRAVIER,
  HERBE, HERBE_HAUTE, MELON, OR, block, type BlockId, type ToolType,
} from "./voxel";

export type ThingId = number;
export const ITEM_BASE = 256;

export type ItemKind = "materiau" | "outil" | "armure" | "nourriture" | "boisson" | "teinture" | "divers";
export type ToolMaterial = "bois" | "pierre" | "fer" | "or" | "diamant";
export type ArmorSlot = "casque" | "plastron" | "jambieres" | "bottes";
export type ArmorMaterial = "cuir" | "fer" | "or" | "diamant";

/**
 * Silhouette de l'icone (voxelIcons.ts la dessine en pixel art) et ses
 * couleurs : [principale, secondaire, accent].
 */
export type IconShape =
  | "pioche" | "hache" | "pelle" | "houe" | "epee"
  | "casque" | "plastron" | "jambieres" | "bottes"
  | "baton" | "charbon" | "minerai" | "lingot" | "pepite" | "gemme" | "silex" | "ficelle" | "cuir" | "os" | "poudre"
  | "brique" | "papier" | "livre" | "sucre" | "ble" | "graines" | "bol" | "seau" | "seauEau" | "fiole" | "fioleEau"
  | "gourde" | "gourdeEau" | "fleche" | "arc" | "bouclier" | "boussole" | "horloge" | "teinture"
  | "pomme" | "pommeDoree" | "pain" | "cookie" | "gateau" | "tarte" | "tranche" | "soupe" | "viande" | "salade"
  | "galette" | "brochette" | "bonbon" | "jus" | "the" | "pommeCaramel";

export interface IconSpec {
  shape: IconShape;
  colors: [string, string, string];
}

export interface ItemDef {
  id: ThingId;
  /** Nom technique stable (recettes, tests). */
  key: string;
  name: string;
  kind: ItemKind;
  /** Taille d'une pile (1 pour les outils et armures). */
  stack: number;
  icon: IconSpec;
  tool?: {
    type: ToolType;
    material: ToolMaterial;
    /** Niveau de minage (1 bois/or, 2 pierre, 3 fer, 4 diamant). */
    level: number;
    /** Multiplicateur de vitesse sur les blocs de son type. */
    speed: number;
    /** Degats d'un coup (la main : 1). */
    damage: number;
    /** Nombre d'utilisations avant de casser. */
    durability: number;
  };
  armor?: { slot: ArmorSlot; material: ArmorMaterial; points: number; durability: number };
  /** Ce que rapporte le fait de manger ou boire. `rend` : le recipient vide qu'on recupere. */
  food?: { faim: number; soif: number; vie?: number; rend?: ThingId };
}

// ---------------------------------------------------------------------------
// Construction de la liste (l'ordre fixe les numeros)
// ---------------------------------------------------------------------------

const ITEMS: ItemDef[] = [];

function add(key: string, name: string, kind: ItemKind, icon: IconSpec, extra: Partial<ItemDef> = {}): ThingId {
  const id = ITEM_BASE + ITEMS.length;
  ITEMS.push({ id, key, name, kind, stack: 64, icon, ...extra });
  return id;
}
const ic = (shape: IconShape, a: string, b = "#00000000", c = "#00000000"): IconSpec => ({ shape, colors: [a, b, c] });

// --- Materiaux (256...)
export const BATON = add("baton", "Bâton", "materiau", ic("baton", "#9b7148", "#6e4d2f"));
export const CHARBON_ITEM = add("charbon", "Charbon", "materiau", ic("charbon", "#2c2f35", "#4b5059", "#16181c"));
export const MINERAI_FER = add("minerai_fer", "Fer brut", "materiau", ic("minerai", "#c9a085", "#8f6c58", "#e8c7ae"));
export const MINERAI_OR = add("minerai_or", "Or brut", "materiau", ic("minerai", "#e8c14f", "#a88532", "#fff0a0"));
export const LINGOT_FER = add("lingot_fer", "Lingot de fer", "materiau", ic("lingot", "#d9dddf", "#9ea5a8", "#ffffff"));
export const LINGOT_OR = add("lingot_or", "Lingot d’or", "materiau", ic("lingot", "#f5cd4a", "#b88c24", "#fff4b0"));
export const PEPITE_OR = add("pepite_or", "Pépite d’or", "materiau", ic("pepite", "#f5cd4a", "#b88c24", "#fff4b0"));
export const DIAMANT_ITEM = add("diamant", "Diamant", "materiau", ic("gemme", "#6fe3d6", "#2aa7a2", "#e6fffb"));
export const SILEX = add("silex", "Silex", "materiau", ic("silex", "#4c4f55", "#2d2f33", "#8a8f97"));
export const FICELLE = add("ficelle", "Ficelle", "materiau", ic("ficelle", "#eeeeea", "#b8b8b0"));
export const CUIR = add("cuir", "Cuir", "materiau", ic("cuir", "#9a5a33", "#6b3c20", "#c07c4f"));
export const OS = add("os", "Os", "materiau", ic("os", "#f1ecdc", "#c9c1a8"));
export const POUDRE_OS = add("poudre_os", "Poudre d’os", "materiau", ic("poudre", "#f4f1e6", "#cfc9b6"));
export const POUDRE = add("poudre", "Poudre à canon", "materiau", ic("poudre", "#5c5e63", "#3a3b3f"));
export const BRIQUE_ITEM = add("brique", "Brique", "materiau", ic("brique", "#b86a4f", "#8a4a36", "#d88d70"));
export const PAPIER = add("papier", "Papier", "materiau", ic("papier", "#f6f3e8", "#d8d2bf"));
export const LIVRE = add("livre", "Livre", "materiau", ic("livre", "#7b3f2a", "#f6f3e8", "#c79a3e"));
export const SUCRE = add("sucre", "Sucre", "materiau", ic("sucre", "#fbfbf8", "#dcdcd4"));
export const BLE = add("ble", "Blé", "materiau", ic("ble", "#d9b54a", "#a8872b", "#f2da7a"));
export const GRAINES = add("graines", "Graines de blé", "materiau", ic("graines", "#7fae4c", "#51782d"));
export const BOL = add("bol", "Bol", "divers", ic("bol", "#9b7148", "#6e4d2f"));
export const SEAU = add("seau", "Seau", "divers", ic("seau", "#c9cdd0", "#8d9497"), { stack: 16 });
export const SEAU_EAU = add("seau_eau", "Seau d’eau", "divers", ic("seauEau", "#c9cdd0", "#8d9497", "#3f8fd6"), { stack: 1 });
export const FIOLE = add("fiole", "Fiole", "divers", ic("fiole", "#d8f0f4", "#9cc9d1"), { stack: 16 });
export const FIOLE_EAU = add("fiole_eau", "Fiole d’eau", "boisson", ic("fioleEau", "#d8f0f4", "#9cc9d1", "#3f8fd6"), { stack: 16, food: { faim: 0, soif: 30, rend: 0 } });
export const GOURDE = add("gourde", "Gourde", "divers", ic("gourde", "#9a5a33", "#6b3c20", "#d9c9a0"), { stack: 1 });
export const GOURDE_EAU = add("gourde_eau", "Gourde d’eau", "boisson", ic("gourdeEau", "#9a5a33", "#6b3c20", "#3f8fd6"), { stack: 1, food: { faim: 0, soif: 60, rend: 0 } });
export const FLECHE = add("fleche", "Flèche", "materiau", ic("fleche", "#9b7148", "#8a8f97", "#f1ecdc"));
export const ARC = add("arc", "Arc", "outil", ic("arc", "#9b7148", "#eeeeea", "#6e4d2f"), { stack: 1 });
export const BOUCLIER = add("bouclier", "Bouclier", "outil", ic("bouclier", "#9b7148", "#b8bcc0", "#6e4d2f"), { stack: 1 });
export const BOUSSOLE = add("boussole", "Boussole", "divers", ic("boussole", "#c9cdd0", "#d6453a", "#f6f3e8"), { stack: 1 });
export const HORLOGE = add("horloge", "Horloge", "divers", ic("horloge", "#f5cd4a", "#3a78c9", "#f6f3e8"), { stack: 1 });

// Les recipients vides rendus apres avoir bu (numeros connus seulement ici).
ITEMS[FIOLE_EAU - ITEM_BASE].food!.rend = FIOLE;
ITEMS[GOURDE_EAU - ITEM_BASE].food!.rend = GOURDE;

// --- Teintures (une par couleur, dans l'ordre de COULEURS)
const TEINTURE_0 = ITEM_BASE + ITEMS.length;
for (const c of COULEURS) add(`teinture_${c.cle}`, `Teinture ${c.f}`, "teinture", ic("teinture", c.hex, "#00000000", "#ffffff"));
export const teinture = (couleur: number): ThingId => TEINTURE_0 + couleur;

// --- Outils : 5 types x 5 materiaux
export const TOOL_TYPES: ToolType[] = ["pioche", "hache", "pelle", "houe", "epee"];
export const TOOL_MATERIALS: ToolMaterial[] = ["bois", "pierre", "fer", "or", "diamant"];
const TOOL_STATS: Record<ToolMaterial, { level: number; speed: number; damage: number; durability: number; colors: [string, string, string] }> = {
  bois: { level: 1, speed: 2, damage: 2, durability: 60, colors: ["#b48a5a", "#7a5634", "#6e4d2f"] },
  pierre: { level: 2, speed: 4, damage: 3, durability: 130, colors: ["#9aa0a3", "#666c70", "#6e4d2f"] },
  fer: { level: 3, speed: 6, damage: 4, durability: 250, colors: ["#e3e6e8", "#a3aaae", "#6e4d2f"] },
  or: { level: 1, speed: 12, damage: 3, durability: 40, colors: ["#f7d451", "#c0932a", "#6e4d2f"] },
  diamant: { level: 4, speed: 8, damage: 5, durability: 1500, colors: ["#7de8dc", "#2ea6a0", "#6e4d2f"] },
};
const TOOL_NAMES: Record<ToolType, string> = { pioche: "Pioche", hache: "Hache", pelle: "Pelle", houe: "Houe", epee: "Épée" };
const EN: Record<ToolMaterial | ArmorMaterial, string> = { bois: "en bois", pierre: "en pierre", fer: "en fer", or: "en or", diamant: "en diamant", cuir: "en cuir" };
const TOOL_0 = ITEM_BASE + ITEMS.length;
for (const type of TOOL_TYPES) for (const material of TOOL_MATERIALS) {
  const s = TOOL_STATS[material];
  // L'epee frappe fort, la hache un peu moins, les autres outils peu.
  const damage = type === "epee" ? s.damage + 2 : type === "hache" ? s.damage + 1 : Math.max(1, s.damage - 1);
  add(`${type}_${material}`, `${TOOL_NAMES[type]} ${EN[material]}`, "outil", ic(type, ...s.colors), {
    stack: 1,
    tool: { type, material, level: s.level, speed: s.speed, damage, durability: s.durability },
  });
}
export const outil = (type: ToolType, material: ToolMaterial): ThingId =>
  TOOL_0 + TOOL_TYPES.indexOf(type) * TOOL_MATERIALS.length + TOOL_MATERIALS.indexOf(material);

// --- Armures : 4 pieces x 4 materiaux
export const ARMOR_SLOTS: ArmorSlot[] = ["casque", "plastron", "jambieres", "bottes"];
export const ARMOR_MATERIALS: ArmorMaterial[] = ["cuir", "fer", "or", "diamant"];
const ARMOR_POINTS: Record<ArmorMaterial, [number, number, number, number]> = {
  cuir: [1, 3, 2, 1],
  fer: [2, 6, 5, 2],
  or: [2, 5, 3, 1],
  diamant: [3, 8, 6, 3],
};
const ARMOR_COLORS: Record<ArmorMaterial, [string, string, string]> = {
  cuir: ["#a0623a", "#6b3c20", "#c9895a"],
  fer: ["#dfe3e5", "#9aa2a6", "#ffffff"],
  or: ["#f7d451", "#c0932a", "#fff4b0"],
  diamant: ["#7de8dc", "#2ea6a0", "#e6fffb"],
};
const ARMOR_DURABILITY: Record<ArmorMaterial, number> = { cuir: 80, fer: 240, or: 110, diamant: 520 };
const ARMOR_NAMES: Record<ArmorSlot, string> = { casque: "Casque", plastron: "Plastron", jambieres: "Jambières", bottes: "Bottes" };
const ARMOR_0 = ITEM_BASE + ITEMS.length;
for (const slot of ARMOR_SLOTS) for (const material of ARMOR_MATERIALS) {
  add(`${slot}_${material}`, `${ARMOR_NAMES[slot]} ${EN[material]}`, "armure", ic(slot, ...ARMOR_COLORS[material]), {
    stack: 1,
    armor: { slot, material, points: ARMOR_POINTS[material][ARMOR_SLOTS.indexOf(slot)], durability: ARMOR_DURABILITY[material] },
  });
}
export const armure = (slot: ArmorSlot, material: ArmorMaterial): ThingId =>
  ARMOR_0 + ARMOR_SLOTS.indexOf(slot) * ARMOR_MATERIALS.length + ARMOR_MATERIALS.indexOf(material);

// --- Nourriture
const food = (faim: number, soif: number, vie?: number, rend?: ThingId) => ({ food: { faim, soif, vie, rend } });
export const POMME = add("pomme", "Pomme", "nourriture", ic("pomme", "#d8403a", "#8a2a25", "#5c8a2f"), food(15, 5));
export const POMME_DOREE = add("pomme_doree", "Pomme dorée", "nourriture", ic("pommeDoree", "#f5cd4a", "#b88c24", "#fff4b0"), food(20, 5, 40));
export const PAIN = add("pain", "Pain", "nourriture", ic("pain", "#c98a3e", "#8f5b24", "#e8b36b"), food(25, 0));
export const COOKIE = add("cookie", "Cookie", "nourriture", ic("cookie", "#c88a4a", "#5a3620"), food(8, 0));
export const GATEAU = add("gateau", "Gâteau", "nourriture", ic("gateau", "#f6efe2", "#c98a3e", "#d8403a"), { ...food(50, 5), stack: 4 });
export const TARTE_CITROUILLE = add("tarte_citrouille", "Tarte à la citrouille", "nourriture", ic("tarte", "#e38a2c", "#b0662a", "#f2c27a"), food(40, 0));
export const TRANCHE_MELON = add("tranche_melon", "Tranche de melon", "nourriture", ic("tranche", "#e0454f", "#5c9a3a", "#2a2a2a"), food(8, 12));
export const SOUPE_CHAMPIGNONS = add("soupe_champignons", "Soupe de champignons", "nourriture", ic("soupe", "#b88a5a", "#9b7148", "#d8c3a0"), { ...food(30, 10), stack: 1 });
export const CHAIR_POURRIE = add("chair_pourrie", "Chair pourrie", "nourriture", ic("viande", "#8a6a3f", "#5c7a3a", "#b5905a"), food(10, -5));
export const SALADE_FRUITS = add("salade_fruits", "Salade de fruits", "nourriture", ic("salade", "#d8403a", "#9b7148", "#e0454f"), { ...food(30, 20), stack: 1 });
export const GALETTE = add("galette", "Galette", "nourriture", ic("galette", "#d9a45a", "#a8752f"), food(18, 0));
export const BROCHETTE = add("brochette", "Brochette de champignons", "nourriture", ic("brochette", "#9b7148", "#b88a5a", "#d8403a"), food(20, 0));
export const BONBON = add("bonbon", "Bonbon", "nourriture", ic("bonbon", "#ee9fba", "#ffffff", "#c45bbf"), food(4, 0, 5));
export const POMME_CARAMEL = add("pomme_caramel", "Pomme d’amour", "nourriture", ic("pommeCaramel", "#c0282a", "#9b7148", "#ff8a7a"), food(20, 0, 5));

// --- Boissons
export const JUS_POMME = add("jus_pomme", "Jus de pomme", "boisson", ic("jus", "#f0b43a", "#d8f0f4"), { ...food(5, 40), stack: 16 });
export const JUS_MELON = add("jus_melon", "Jus de melon", "boisson", ic("jus", "#e8505a", "#d8f0f4"), { ...food(5, 45), stack: 16 });
export const THE = add("the", "Thé des bois", "boisson", ic("the", "#7a9a3a", "#d8f0f4", "#c9a45a"), { ...food(0, 50, 10), stack: 16 });
export const EAU_SUCREE = add("eau_sucree", "Eau sucrée", "boisson", ic("jus", "#bfe6f0", "#d8f0f4"), { ...food(5, 35), stack: 16 });
for (const id of [JUS_POMME, JUS_MELON, THE, EAU_SUCREE]) ITEMS[id - ITEM_BASE].food!.rend = FIOLE;
ITEMS[SOUPE_CHAMPIGNONS - ITEM_BASE].food!.rend = BOL;
ITEMS[SALADE_FRUITS - ITEM_BASE].food!.rend = BOL;

// ---------------------------------------------------------------------------
// Acces communs aux blocs et aux objets
// ---------------------------------------------------------------------------

export const ALL_ITEMS: readonly ItemDef[] = ITEMS;

export function item(id: ThingId): ItemDef | undefined {
  return id >= ITEM_BASE ? ITEMS[id - ITEM_BASE] : undefined;
}

export function isBlock(id: ThingId): boolean {
  return Number.isInteger(id) && id > 0 && id < ITEM_BASE && id < BLOCKS.length;
}

/** Numero valide dans un inventaire (bloc ou objet connu). */
export function isKnownThing(id: ThingId): boolean {
  return isBlock(id) || (Number.isInteger(id) && id >= ITEM_BASE && id < ITEM_BASE + ITEMS.length);
}

export function thingName(id: ThingId): string {
  if (id === 0) return "Main nue";
  return item(id)?.name ?? block(id).name;
}

export function maxStack(id: ThingId): number {
  return item(id)?.stack ?? 64;
}

/** Tout ce qui existe, pour l'inventaire creatif et le « give » admin. */
export function allThings(palette: BlockId[]): ThingId[] {
  return [...palette, ...ITEMS.map((i) => i.id)];
}

/** Points d'armure (0 a 20) de ce qui est porte. */
export function armorPoints(worn: ThingId[]): number {
  return worn.reduce((sum, id) => sum + (item(id)?.armor?.points ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Minage : vitesse, outil exige, butin
// ---------------------------------------------------------------------------

/** Temps (secondes) pour casser un bloc avec ce qu'on a en main. */
export function breakSeconds(blockId: BlockId, held: ThingId): number {
  const b = block(blockId);
  const t = item(held)?.tool;
  const good = !!t && !!b.outil && t.type === b.outil;
  let seconds = b.breakTime / (good ? t!.speed : 1);
  // Sans le bon niveau d'outil, un bloc dur est tres long a casser.
  if ((b.niveau ?? 0) > 0 && !(good && t!.level >= b.niveau!)) seconds *= 3.3;
  return seconds;
}

/** Ce que rapporte un bloc casse (vide si l'outil ne convient pas). */
export function dropsFor(blockId: BlockId, held: ThingId, rand: () => number): [ThingId, number][] {
  const b = block(blockId);
  const t = item(held)?.tool;
  if ((b.niveau ?? 0) > 0 && !(t && t.type === b.outil && t.level >= b.niveau!)) return [];
  switch (blockId) {
    case CHARBON: return [[CHARBON_ITEM, 1]];
    case FER: return [[MINERAI_FER, 1]];
    case OR: return [[MINERAI_OR, 1]];
    case DIAMANT: return [[DIAMANT_ITEM, 1]];
    case FEUILLES: {
      const res: [ThingId, number][] = [];
      if (rand() < 0.08) res.push([POMME, 1]);
      if (rand() < 0.06) res.push([BATON, 1]);
      // Une houe ramasse les feuilles elles-memes.
      if (t?.type === "houe") res.push([FEUILLES, 1]);
      return res;
    }
    case GRAVIER: return rand() < 0.12 ? [[SILEX, 1]] : [[GRAVIER, 1]];
    case HERBE: return rand() < 0.1 ? [[b.drop ?? blockId, 1], [GRAINES, 1]] : [[b.drop ?? blockId, 1]];
    case HERBE_HAUTE: return rand() < 0.2 ? [[GRAINES, 1]] : [];
    case BLE_2: return [[BLE, 1], [GRAINES, 1 + Math.floor(rand() * 2)]];
    case MELON: return [[TRANCHE_MELON, 3 + Math.floor(rand() * 3)]];
    case CANNE_A_SUCRE: return [[CANNE_A_SUCRE, 1]];
    case CHAMPIGNON_BRUN:
    case CHAMPIGNON_ROUGE: return [[blockId, 1]];
    case BLE_0:
    case BLE_1: return [[GRAINES, 1]];
    default: return [[b.drop ?? blockId, 1]];
  }
}
