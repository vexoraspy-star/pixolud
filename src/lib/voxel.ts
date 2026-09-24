// Cubes — le moteur du monde en blocs.
//
// Le monde est infini : il n'existe nulle part en entier. Il est decoupe en
// « chunks » de 16 x 16 colonnes, generes a la demande autour du joueur a
// partir d'une graine, et oublies quand on s'en eloigne. Seules les
// modifications du joueur sont conservees (dans `edits`), ce qui permet de
// sauvegarder un monde entier en quelques kilo-octets.
//
// Trois choses vivent ici et nulle part ailleurs :
//   - la table des blocs (ce qui est solide, transparent, lumineux) ;
//   - la generation du terrain (relief, biomes, grottes, minerais, arbres) ;
//   - la lumiere et le maillage, qui transforment des cubes en geometrie.
//
// Le rendu (Three.js) est dans CubesScene : ce fichier ne connait pas Three.

export const CHUNK = 16;
/** Hauteur du monde, en blocs. Le socle est en 0, le ciel en 79. */
export const WORLD_HEIGHT = 80;
export const SEA_LEVEL = 32;
/** Niveau de lumiere maximal, comme dans le jeu dont on s'inspire. */
export const MAX_LIGHT = 15;

export type BlockId = number;
export const AIR = 0;

export type BlockShape = "cube" | "croix";
export type BlockSound = "terre" | "pierre" | "bois" | "sable" | "verre" | "tissu" | "eau" | "feuille";
/** Outil qui casse vite un bloc (voir voxelItems.ts). */
export type ToolType = "pioche" | "hache" | "pelle" | "houe" | "epee";

/**
 * Les 16 couleurs des blocs teints (laine, verre, beton, terre cuite, lampes)
 * et des teintures. L'ordre est fige : il sert a numeroter blocs et tuiles.
 */
export const COULEURS = [
  { cle: "blanc", m: "blanc", f: "blanche", hex: "#f1f1ec" },
  { cle: "orange", m: "orange", f: "orange", hex: "#ee8a2f" },
  { cle: "magenta", m: "magenta", f: "magenta", hex: "#c45bbf" },
  { cle: "bleuclair", m: "bleu clair", f: "bleu clair", hex: "#6db3e4" },
  { cle: "jaune", m: "jaune", f: "jaune", hex: "#f2d03f" },
  { cle: "vertclair", m: "vert clair", f: "vert clair", hex: "#86c646" },
  { cle: "rose", m: "rose", f: "rose", hex: "#ee9fba" },
  { cle: "gris", m: "gris", f: "grise", hex: "#535a5f" },
  { cle: "grisclair", m: "gris clair", f: "gris clair", hex: "#a4a49e" },
  { cle: "cyan", m: "cyan", f: "cyan", hex: "#22a0a7" },
  { cle: "violet", m: "violet", f: "violette", hex: "#8a40b8" },
  { cle: "bleu", m: "bleu", f: "bleue", hex: "#3e4fae" },
  { cle: "marron", m: "marron", f: "marron", hex: "#7c5436" },
  { cle: "vert", m: "vert", f: "verte", hex: "#5d7b2c" },
  { cle: "rouge", m: "rouge", f: "rouge", hex: "#b2342f" },
  { cle: "noir", m: "noir", f: "noire", hex: "#212126" },
] as const;

export interface BlockDef {
  id: BlockId;
  name: string;
  /** Tuiles dans l'atlas : dessus, cote, dessous. */
  tiles: [number, number, number];
  /** Bloque le joueur. */
  solid: boolean;
  /** Arrete la lumiere et cache la face du bloc voisin. */
  opaque: boolean;
  shape: BlockShape;
  /** Lumiere emise (torche, lampe). */
  light: number;
  /** Liquide : on le traverse, on y nage. */
  liquid: boolean;
  /** Secondes pour le casser a la main, en mode survie. */
  breakTime: number;
  sound: BlockSound;
  /** Ce qu'on recupere en le cassant (par defaut le bloc lui-meme). */
  drop?: BlockId;
  /** Outil qui le casse vite. */
  outil?: ToolType;
  /**
   * Niveau d'outil exige pour recuperer quelque chose (0 : la main suffit,
   * 1 : bois ou or, 2 : pierre, 3 : fer, 4 : diamant). En dessous, le bloc
   * se casse lentement et ne donne rien.
   */
  niveau?: number;
}

/**
 * Disposition de l'atlas (voxelTextures.ts la dessine, le maillage la lit) :
 * 16 x 16 cases de 48 px, chaque tuile de 32 px au centre, entouree d'une
 * gouttiere de 8 px qui prolonge ses bords (sans elle, les mipmaps melangent
 * les tuiles voisines au loin).
 */
export const ATLAS_COLS = 16;
export const ATLAS_ROWS = 16;
export const ATLAS_CELL = 48;
export const ATLAS_TILE = 32;
export const ATLAS_GUTTER = 8;

/** Premieres tuiles des familles teintes : tuile = debut + index de couleur. */
export const TILE_LAINE = 80;
export const TILE_VERRE_TEINTE = 96;
export const TILE_BETON = 112;
export const TILE_TERRE_CUITE_TEINTEE = 128;
export const TILE_LAMPE_COULEUR = 144;

/** Index des tuiles de l'atlas (voir voxelTextures.ts). */
export const TILE = {
  herbeDessus: 0,
  herbeCote: 1,
  terre: 2,
  pierre: 3,
  pierreTaillee: 4,
  sable: 5,
  gresDessus: 6,
  gresCote: 7,
  troncDessus: 8,
  troncCote: 9,
  planches: 10,
  feuilles: 11,
  verre: 12,
  eau: 13,
  brique: 14,
  charbon: 15,
  fer: 16,
  or: 17,
  diamant: 18,
  obsidienne: 19,
  gravier: 20,
  neige: 21,
  glace: 22,
  socle: 23,
  cactusDessus: 24,
  cactusCote: 25,
  laineBlanche: 26,
  laineRouge: 27,
  laineBleue: 28,
  laineJaune: 29,
  laineVerte: 30,
  torche: 31,
  fleurRouge: 32,
  fleurJaune: 33,
  herbeHaute: 34,
  lampe: 35,
  tableDessus: 36,
  tableCote: 37,
  fourFace: 38,
  fourDessus: 39,
  briquesPierre: 40,
  pierrePolie: 41,
  gresTaille: 42,
  bibliotheque: 43,
  citrouilleDessus: 44,
  citrouilleCote: 45,
  citrouilleLanterne: 46,
  melonDessus: 47,
  melonCote: 48,
  foinDessus: 49,
  foinCote: 50,
  blocFer: 51,
  blocOr: 52,
  blocDiamant: 53,
  blocCharbon: 54,
  pierreMoussue: 55,
  terreLabouree: 56,
  ble0: 57,
  ble1: 58,
  ble2: 59,
  champignonBrun: 60,
  champignonRouge: 61,
  canneASucre: 62,
  terreCuite: 63,
  pierreLumineuse: 64,
  planchesSombres: 65,
  planchesClaires: 66,
  briquesMoussues: 67,
  briquesFissurees: 68,
  blocOsDessus: 69,
  blocOsCote: 70,
  pierreCiselee: 71,
  gresRougeDessus: 72,
  gresRougeCote: 73,
  fleurBleue: 74,
} as const;

function def(
  id: BlockId,
  name: string,
  tiles: [number, number, number],
  extra: Partial<BlockDef> = {},
): BlockDef {
  return {
    id,
    name,
    tiles,
    solid: true,
    opaque: true,
    shape: "cube",
    light: 0,
    liquid: false,
    breakTime: 0.75,
    sound: "pierre",
    ...extra,
  };
}

export const HERBE = 1;
export const TERRE = 2;
export const PIERRE = 3;
export const PIERRE_TAILLEE = 4;
export const SABLE = 5;
export const GRES = 6;
export const TRONC = 7;
export const PLANCHES = 8;
export const FEUILLES = 9;
export const VERRE = 10;
export const EAU = 11;
export const BRIQUE = 12;
export const CHARBON = 13;
export const FER = 14;
export const OR = 15;
export const DIAMANT = 16;
export const OBSIDIENNE = 17;
export const GRAVIER = 18;
export const NEIGE = 19;
export const GLACE = 20;
export const SOCLE = 21;
export const CACTUS = 22;
export const LAINE_BLANCHE = 23;
export const LAINE_ROUGE = 24;
export const LAINE_BLEUE = 25;
export const LAINE_JAUNE = 26;
export const LAINE_VERTE = 27;
export const TORCHE = 28;
export const FLEUR_ROUGE = 29;
export const FLEUR_JAUNE = 30;
export const HERBE_HAUTE = 31;
export const LAMPE = 32;
// Blocs ajoutes avec la fabrication. Les numeros sont sauvegardes dans les
// mondes : on ajoute a la suite, on ne renumerote jamais.
export const TABLE_CRAFT = 33;
export const FOUR = 34;
export const BRIQUES_PIERRE = 35;
export const PIERRE_POLIE = 36;
export const GRES_TAILLE = 37;
export const BIBLIOTHEQUE = 38;
export const CITROUILLE = 39;
export const CITROUILLE_LANTERNE = 40;
export const MELON = 41;
export const BOTTE_FOIN = 42;
export const BLOC_FER = 43;
export const BLOC_OR = 44;
export const BLOC_DIAMANT = 45;
export const BLOC_CHARBON = 46;
export const PIERRE_MOUSSUE = 47;
export const TERRE_LABOUREE = 48;
export const BLE_0 = 49;
export const BLE_1 = 50;
export const BLE_2 = 51;
export const CHAMPIGNON_BRUN = 52;
export const CHAMPIGNON_ROUGE = 53;
export const CANNE_A_SUCRE = 54;
export const TERRE_CUITE = 55;
export const PIERRE_LUMINEUSE = 56;
export const PLANCHES_SOMBRES = 57;
export const PLANCHES_CLAIRES = 58;
export const BRIQUES_MOUSSUES = 59;
export const BRIQUES_FISSUREES = 60;
export const BLOC_OS = 61;
export const PIERRE_CISELEE = 62;
export const GRES_ROUGE = 63;
export const FLEUR_BLEUE = 64;
/** Laines des onze couleurs qui n'existaient pas encore (65 a 75). */
const LAINES_NOUVELLES = 65;
export const VERRE_TEINTE_0 = 76;
export const BETON_0 = 92;
export const TERRE_CUITE_TEINTEE_0 = 108;
export const LAMPE_COULEUR_0 = 124;

/** Les cinq laines d'origine gardent leur numero. */
const LAINES_ANCIENNES: Record<string, BlockId> = {
  blanc: LAINE_BLANCHE,
  rouge: LAINE_ROUGE,
  bleu: LAINE_BLEUE,
  jaune: LAINE_JAUNE,
  vert: LAINE_VERTE,
};

/** Numero de la laine d'une couleur (index dans COULEURS). */
export function laine(couleur: number): BlockId {
  const ancienne = LAINES_ANCIENNES[COULEURS[couleur].cle];
  if (ancienne !== undefined) return ancienne;
  let rang = 0;
  for (let i = 0; i < couleur; i++) if (LAINES_ANCIENNES[COULEURS[i].cle] === undefined) rang++;
  return LAINES_NOUVELLES + rang;
}
export const verreTeinte = (couleur: number): BlockId => VERRE_TEINTE_0 + couleur;
export const beton = (couleur: number): BlockId => BETON_0 + couleur;
export const terreCuiteTeintee = (couleur: number): BlockId => TERRE_CUITE_TEINTEE_0 + couleur;
export const lampeCouleur = (couleur: number): BlockId => LAMPE_COULEUR_0 + couleur;

const tout = (t: number): [number, number, number] => [t, t, t];
const PLANTE: Partial<BlockDef> = { solid: false, opaque: false, shape: "croix", breakTime: 0.05, sound: "feuille" };
const ROCHE: Partial<BlockDef> = { outil: "pioche", niveau: 1 };
const BOIS: Partial<BlockDef> = { sound: "bois", outil: "hache" };
const TERREUX: Partial<BlockDef> = { outil: "pelle" };

const BLOCS_DE_BASE: BlockDef[] = [
  def(AIR, "Air", [0, 0, 0], { solid: false, opaque: false, breakTime: 0 }),
  def(HERBE, "Herbe", [TILE.herbeDessus, TILE.herbeCote, TILE.terre], { breakTime: 0.5, sound: "terre", drop: TERRE, ...TERREUX }),
  def(TERRE, "Terre", tout(TILE.terre), { breakTime: 0.5, sound: "terre", ...TERREUX }),
  def(PIERRE, "Pierre", tout(TILE.pierre), { breakTime: 1.4, drop: PIERRE_TAILLEE, ...ROCHE }),
  def(PIERRE_TAILLEE, "Pierre taillée", tout(TILE.pierreTaillee), { breakTime: 1.5, ...ROCHE }),
  def(SABLE, "Sable", tout(TILE.sable), { breakTime: 0.4, sound: "sable", ...TERREUX }),
  def(GRES, "Grès", [TILE.gresDessus, TILE.gresCote, TILE.gresDessus], { breakTime: 1.1, sound: "sable", ...ROCHE }),
  def(TRONC, "Tronc", [TILE.troncDessus, TILE.troncCote, TILE.troncDessus], { breakTime: 1.6, ...BOIS }),
  def(PLANCHES, "Planches", tout(TILE.planches), { breakTime: 1.2, ...BOIS }),
  def(FEUILLES, "Feuilles", tout(TILE.feuilles), { opaque: false, breakTime: 0.25, sound: "feuille", outil: "houe" }),
  def(VERRE, "Verre", tout(TILE.verre), { opaque: false, breakTime: 0.4, sound: "verre" }),
  def(EAU, "Eau", tout(TILE.eau), { solid: false, opaque: false, liquid: true, breakTime: 0, sound: "eau" }),
  def(BRIQUE, "Briques", tout(TILE.brique), { breakTime: 1.6, ...ROCHE }),
  def(CHARBON, "Minerai de charbon", tout(TILE.charbon), { breakTime: 1.8, ...ROCHE }),
  def(FER, "Minerai de fer", tout(TILE.fer), { breakTime: 2.2, outil: "pioche", niveau: 2 }),
  def(OR, "Minerai d’or", tout(TILE.or), { breakTime: 2.4, outil: "pioche", niveau: 3 }),
  def(DIAMANT, "Minerai de diamant", tout(TILE.diamant), { breakTime: 3, outil: "pioche", niveau: 3 }),
  def(OBSIDIENNE, "Obsidienne", tout(TILE.obsidienne), { breakTime: 12, outil: "pioche", niveau: 4 }),
  def(GRAVIER, "Gravier", tout(TILE.gravier), { breakTime: 0.5, sound: "sable", ...TERREUX }),
  def(NEIGE, "Neige", tout(TILE.neige), { breakTime: 0.3, sound: "terre", ...TERREUX }),
  def(GLACE, "Glace", tout(TILE.glace), { opaque: false, breakTime: 0.6, sound: "verre", outil: "pioche" }),
  def(SOCLE, "Socle", tout(TILE.socle), { breakTime: 0 }),
  def(CACTUS, "Cactus", [TILE.cactusDessus, TILE.cactusCote, TILE.cactusDessus], { breakTime: 0.5, sound: "tissu" }),
  def(LAINE_BLANCHE, "Laine blanche", tout(TILE_LAINE + 0), { breakTime: 0.6, sound: "tissu" }),
  def(LAINE_ROUGE, "Laine rouge", tout(TILE_LAINE + 14), { breakTime: 0.6, sound: "tissu" }),
  def(LAINE_BLEUE, "Laine bleue", tout(TILE_LAINE + 11), { breakTime: 0.6, sound: "tissu" }),
  def(LAINE_JAUNE, "Laine jaune", tout(TILE_LAINE + 4), { breakTime: 0.6, sound: "tissu" }),
  def(LAINE_VERTE, "Laine verte", tout(TILE_LAINE + 13), { breakTime: 0.6, sound: "tissu" }),
  def(TORCHE, "Torche", tout(TILE.torche), { ...PLANTE, light: 14, breakTime: 0.05, sound: "bois" }),
  def(FLEUR_ROUGE, "Fleur rouge", tout(TILE.fleurRouge), PLANTE),
  def(FLEUR_JAUNE, "Fleur jaune", tout(TILE.fleurJaune), PLANTE),
  def(HERBE_HAUTE, "Herbe haute", tout(TILE.herbeHaute), PLANTE),
  def(LAMPE, "Lampe", tout(TILE.lampe), { light: 15, breakTime: 0.8, sound: "verre" }),
  def(TABLE_CRAFT, "Table de craft", [TILE.tableDessus, TILE.tableCote, TILE.planches], { breakTime: 1.4, ...BOIS }),
  def(FOUR, "Four", [TILE.fourDessus, TILE.fourFace, TILE.fourDessus], { breakTime: 2, ...ROCHE }),
  def(BRIQUES_PIERRE, "Briques de pierre", tout(TILE.briquesPierre), { breakTime: 1.6, ...ROCHE }),
  def(PIERRE_POLIE, "Pierre polie", tout(TILE.pierrePolie), { breakTime: 1.6, ...ROCHE }),
  def(GRES_TAILLE, "Grès taillé", [TILE.gresDessus, TILE.gresTaille, TILE.gresDessus], { breakTime: 1.1, sound: "sable", ...ROCHE }),
  def(BIBLIOTHEQUE, "Bibliothèque", [TILE.planches, TILE.bibliotheque, TILE.planches], { breakTime: 1.2, ...BOIS }),
  def(CITROUILLE, "Citrouille", [TILE.citrouilleDessus, TILE.citrouilleCote, TILE.citrouilleDessus], { breakTime: 0.8, ...BOIS }),
  def(CITROUILLE_LANTERNE, "Citrouille-lanterne", [TILE.citrouilleDessus, TILE.citrouilleLanterne, TILE.citrouilleDessus], { breakTime: 0.8, light: 15, ...BOIS }),
  def(MELON, "Melon", [TILE.melonDessus, TILE.melonCote, TILE.melonDessus], { breakTime: 0.8, ...BOIS }),
  def(BOTTE_FOIN, "Botte de foin", [TILE.foinDessus, TILE.foinCote, TILE.foinDessus], { breakTime: 0.5, sound: "feuille", outil: "houe" }),
  def(BLOC_FER, "Bloc de fer", tout(TILE.blocFer), { breakTime: 3, outil: "pioche", niveau: 2 }),
  def(BLOC_OR, "Bloc d’or", tout(TILE.blocOr), { breakTime: 3, outil: "pioche", niveau: 3 }),
  def(BLOC_DIAMANT, "Bloc de diamant", tout(TILE.blocDiamant), { breakTime: 3.5, outil: "pioche", niveau: 3 }),
  def(BLOC_CHARBON, "Bloc de charbon", tout(TILE.blocCharbon), { breakTime: 2.5, ...ROCHE }),
  def(PIERRE_MOUSSUE, "Pierre moussue", tout(TILE.pierreMoussue), { breakTime: 1.5, ...ROCHE }),
  def(TERRE_LABOUREE, "Terre labourée", [TILE.terreLabouree, TILE.terre, TILE.terre], { breakTime: 0.5, sound: "terre", drop: TERRE, ...TERREUX }),
  def(BLE_0, "Pousses de blé", tout(TILE.ble0), PLANTE),
  def(BLE_1, "Blé en herbe", tout(TILE.ble1), PLANTE),
  def(BLE_2, "Blé mûr", tout(TILE.ble2), PLANTE),
  def(CHAMPIGNON_BRUN, "Champignon brun", tout(TILE.champignonBrun), PLANTE),
  def(CHAMPIGNON_ROUGE, "Champignon rouge", tout(TILE.champignonRouge), PLANTE),
  def(CANNE_A_SUCRE, "Canne à sucre", tout(TILE.canneASucre), PLANTE),
  def(TERRE_CUITE, "Terre cuite", tout(TILE.terreCuite), { breakTime: 1.25, ...ROCHE }),
  def(PIERRE_LUMINEUSE, "Pierre lumineuse", tout(TILE.pierreLumineuse), { breakTime: 0.6, light: 15, sound: "verre" }),
  def(PLANCHES_SOMBRES, "Planches sombres", tout(TILE.planchesSombres), { breakTime: 1.2, ...BOIS }),
  def(PLANCHES_CLAIRES, "Planches claires", tout(TILE.planchesClaires), { breakTime: 1.2, ...BOIS }),
  def(BRIQUES_MOUSSUES, "Briques moussues", tout(TILE.briquesMoussues), { breakTime: 1.6, ...ROCHE }),
  def(BRIQUES_FISSUREES, "Briques fissurées", tout(TILE.briquesFissurees), { breakTime: 1.6, ...ROCHE }),
  def(BLOC_OS, "Bloc d’os", [TILE.blocOsDessus, TILE.blocOsCote, TILE.blocOsDessus], { breakTime: 1.5, ...ROCHE }),
  def(PIERRE_CISELEE, "Pierre ciselée", tout(TILE.pierreCiselee), { breakTime: 1.6, ...ROCHE }),
  def(GRES_ROUGE, "Grès rouge", [TILE.gresRougeDessus, TILE.gresRougeCote, TILE.gresRougeDessus], { breakTime: 1.1, sound: "sable", ...ROCHE }),
  def(FLEUR_BLEUE, "Fleur bleue", tout(TILE.fleurBleue), PLANTE),
];

/** Les familles teintes, generees couleur par couleur. */
function blocsTeints(): BlockDef[] {
  const res: BlockDef[] = [];
  COULEURS.forEach((c, i) => {
    if (LAINES_ANCIENNES[c.cle] === undefined) res.push(def(laine(i), `Laine ${c.f}`, tout(TILE_LAINE + i), { breakTime: 0.6, sound: "tissu" }));
  });
  COULEURS.forEach((c, i) => res.push(def(verreTeinte(i), `Verre ${c.m}`, tout(TILE_VERRE_TEINTE + i), { opaque: false, breakTime: 0.4, sound: "verre" })));
  COULEURS.forEach((c, i) => res.push(def(beton(i), `Béton ${c.m}`, tout(TILE_BETON + i), { breakTime: 1.4, ...ROCHE })));
  COULEURS.forEach((c, i) => res.push(def(terreCuiteTeintee(i), `Terre cuite ${c.f}`, tout(TILE_TERRE_CUITE_TEINTEE + i), { breakTime: 1.25, ...ROCHE })));
  COULEURS.forEach((c, i) => res.push(def(lampeCouleur(i), `Lampe ${c.f}`, tout(TILE_LAMPE_COULEUR + i), { light: 15, breakTime: 0.8, sound: "verre" })));
  return res;
}

export const BLOCKS: BlockDef[] = [...BLOCS_DE_BASE, ...blocsTeints()];
// Garde-fou : l'index de chaque bloc doit etre son numero.
BLOCKS.forEach((b, i) => {
  if (b.id !== i) throw new Error(`Bloc ${b.name} : numero ${b.id} a l'index ${i}`);
});

export function block(id: BlockId): BlockDef {
  return BLOCKS[id] ?? BLOCKS[0];
}

/** Plantes cultivees : un stade pousse vers le suivant. */
export const CULTURES: Record<number, BlockId> = { [BLE_0]: BLE_1, [BLE_1]: BLE_2 };

/** Blocs proposes dans l'inventaire creatif, dans l'ordre d'affichage. */
export const PALETTE: BlockId[] = [
  HERBE, TERRE, PIERRE, PIERRE_TAILLEE, PIERRE_POLIE, PIERRE_MOUSSUE, PIERRE_CISELEE, BRIQUES_PIERRE, BRIQUES_MOUSSUES, BRIQUES_FISSUREES,
  BRIQUE, SABLE, GRES, GRES_TAILLE, GRES_ROUGE, GRAVIER, TERRE_LABOUREE,
  TRONC, PLANCHES, PLANCHES_SOMBRES, PLANCHES_CLAIRES, FEUILLES, BIBLIOTHEQUE, TABLE_CRAFT, FOUR,
  VERRE, LAMPE, PIERRE_LUMINEUSE, CITROUILLE_LANTERNE, TORCHE, NEIGE, GLACE,
  OBSIDIENNE, CHARBON, FER, OR, DIAMANT, BLOC_CHARBON, BLOC_FER, BLOC_OR, BLOC_DIAMANT, BLOC_OS,
  CACTUS, CITROUILLE, MELON, BOTTE_FOIN, EAU, TERRE_CUITE,
  FLEUR_ROUGE, FLEUR_JAUNE, FLEUR_BLEUE, HERBE_HAUTE, CHAMPIGNON_BRUN, CHAMPIGNON_ROUGE, CANNE_A_SUCRE, BLE_2,
  ...COULEURS.map((_, i) => laine(i)),
  ...COULEURS.map((_, i) => verreTeinte(i)),
  ...COULEURS.map((_, i) => beton(i)),
  ...COULEURS.map((_, i) => terreCuiteTeintee(i)),
  ...COULEURS.map((_, i) => lampeCouleur(i)),
];

// ---------------------------------------------------------------------------
// Bruit : tout le relief vient de la, et d'une seule graine
// ---------------------------------------------------------------------------

function hash2(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function hash3(x: number, y: number, z: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 1274126177) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function noise2(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const tx = smooth(x - xi);
  const ty = smooth(y - yi);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

function noise3(x: number, y: number, z: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const tx = smooth(x - xi);
  const ty = smooth(y - yi);
  const tz = smooth(z - zi);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const c000 = hash3(xi, yi, zi, seed);
  const c100 = hash3(xi + 1, yi, zi, seed);
  const c010 = hash3(xi, yi + 1, zi, seed);
  const c110 = hash3(xi + 1, yi + 1, zi, seed);
  const c001 = hash3(xi, yi, zi + 1, seed);
  const c101 = hash3(xi + 1, yi, zi + 1, seed);
  const c011 = hash3(xi, yi + 1, zi + 1, seed);
  const c111 = hash3(xi + 1, yi + 1, zi + 1, seed);
  return lerp(
    lerp(lerp(c000, c100, tx), lerp(c010, c110, tx), ty),
    lerp(lerp(c001, c101, tx), lerp(c011, c111, tx), ty),
    tz,
  );
}

function fbm2(x: number, y: number, seed: number, octaves: number): number {
  let sum = 0;
  let amp = 1;
  let total = 0;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += noise2(x * freq, y * freq, seed + i * 97) * amp;
    total += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / total;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export type Biome = "plaine" | "foret" | "desert" | "montagne" | "neige";

export interface Column {
  height: number;
  biome: Biome;
}

/** Relief et biome d'une colonne. Fonction pure : deux joueurs voient pareil. */
export function columnAt(x: number, z: number, seed: number): Column {
  const continent = fbm2(x / 260, z / 260, seed + 11, 3);
  const hills = fbm2(x / 70, z / 70, seed + 23, 4);
  const mountain = clamp01((fbm2(x / 340, z / 340, seed + 37, 2) - 0.56) / 0.3);
  const temp = fbm2(x / 200, z / 200, seed + 53, 2);
  const humid = fbm2(x / 170, z / 170, seed + 71, 2);
  let height = 24 + continent * 14 + hills * 9 + mountain * mountain * 34;
  // Les plages descendent doucement vers la mer plutot que de tomber d'un coup.
  height = Math.round(height);
  let biome: Biome;
  if (mountain > 0.55) biome = height > 56 ? "neige" : "montagne";
  else if (temp > 0.6 && humid < 0.46) biome = "desert";
  else if (humid > 0.56) biome = "foret";
  else biome = "plaine";
  return { height: Math.max(3, Math.min(WORLD_HEIGHT - 12, height)), biome };
}

function caveAt(x: number, y: number, z: number, seed: number): boolean {
  if (y < 2 || y > 54) return false;
  // Deux nappes de bruit qui se croisent : on creuse la ou les deux sont
  // hautes, ce qui donne des galeries plutot que du gruyere.
  const a = noise3(x / 26, y / 14, z / 26, seed + 101);
  const b = noise3(x / 22, y / 17, z / 22, seed + 211);
  const t = 0.62 + (y > 40 ? (y - 40) * 0.02 : 0);
  return a > t && b > t - 0.06;
}

function oreAt(x: number, y: number, z: number, seed: number): BlockId {
  if (y < 2) return PIERRE;
  const n = (s: number) => noise3(x / 7, y / 7, z / 7, seed + s);
  if (y <= 14 && n(401) > 0.855) return DIAMANT;
  if (y <= 26 && n(503) > 0.85) return OR;
  if (y <= 42 && n(607) > 0.825) return FER;
  if (y <= 52 && n(709) > 0.795) return CHARBON;
  if (n(811) > 0.86) return GRAVIER;
  return PIERRE;
}

// ---------------------------------------------------------------------------
// Chunks
// ---------------------------------------------------------------------------

/** Tables rapides par numero de bloc (la lumiere en lit des millions). */
const OPAQUE = Uint8Array.from(BLOCKS, (b) => (b.opaque ? 1 : 0));
const EMIT = Uint8Array.from(BLOCKS, (b) => b.light);

/**
 * Courbe de lumiere perceptive : chaque niveau perdu divise la luminosite par
 * 1,25. Une grotte devient vraiment sombre et une torche compte.
 */
export const COURBE_LUMIERE = Float32Array.from({ length: 16 }, (_, l) => Math.max(0.035, Math.pow(0.8, MAX_LIGHT - l)));

/** La courbe, pour un niveau moyen non entier (eclairage lisse des coins). */
export function courbe(level: number): number {
  const l = Math.max(0, Math.min(MAX_LIGHT, level));
  const i = Math.floor(l);
  if (i >= MAX_LIGHT) return 1;
  return COURBE_LUMIERE[i] + (COURBE_LUMIERE[i + 1] - COURBE_LUMIERE[i]) * (l - i);
}

/** Canal de lumiere : 0 = ciel et blocs melanges (le jour), 1 = blocs seuls (la nuit). */
type Canal = 0 | 1;

export class Chunk {
  readonly cx: number;
  readonly cz: number;
  readonly blocks: Uint8Array;
  readonly light: Uint8Array;
  /**
   * Lumiere des blocs seule (torches, lampes), sans le ciel. La nuit, le rendu
   * garde max(ciel x jour, blocs) : les torches restent vives quand le ciel
   * s'eteint, sans recalculer le monde a chaque minute.
   */
  readonly bloc: Uint8Array;
  /** Le maillage doit etre refait. */
  dirty = true;
  /** Le chunk a ete genere (terrain + edits appliques). */
  built = false;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint8Array(CHUNK * CHUNK * WORLD_HEIGHT);
    this.light = new Uint8Array(CHUNK * CHUNK * WORLD_HEIGHT);
    this.bloc = new Uint8Array(CHUNK * CHUNK * WORLD_HEIGHT);
  }
}

export function idx(x: number, y: number, z: number): number {
  return (y * CHUNK + z) * CHUNK + x;
}

function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

export function editKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

/** Une modification du joueur, telle qu'elle est sauvegardee. */
export type Edits = Map<string, BlockId>;

export class World {
  readonly seed: number;
  readonly chunks = new Map<string, Chunk>();
  /** Tout ce que le joueur a casse ou pose : c'est la seule chose a sauver. */
  readonly edits: Edits;
  /** Chunks dont le maillage doit etre refait. */
  readonly dirty = new Set<string>();
  private trackLightChanges = false;
  /**
   * Dernier chunk trouve. La lumiere et le maillage lisent des milliers de
   * cases voisines, presque toujours dans le meme chunk : sans ce raccourci,
   * chaque lecture fabriquait une cle texte, et eclairer un chunk prenait
   * 25 ms (une saccade a chaque pas dans un terrain neuf).
   */
  private lastCx = NaN;
  private lastCz = NaN;
  private lastChunk: Chunk | undefined;

  constructor(seed: number, edits: Edits = new Map()) {
    this.seed = seed;
    this.edits = edits;
  }

  chunk(cx: number, cz: number): Chunk | undefined {
    if (cx === this.lastCx && cz === this.lastCz) return this.lastChunk;
    const c = this.chunks.get(chunkKey(cx, cz));
    // Seuls les chunks presents sont retenus : un absent peut etre cree ensuite.
    if (c) {
      this.lastCx = cx;
      this.lastCz = cz;
      this.lastChunk = c;
    }
    return c;
  }

  /** Cree et genere le chunk s'il n'existe pas encore. */
  ensureChunk(cx: number, cz: number): Chunk {
    const key = chunkKey(cx, cz);
    let c = this.chunks.get(key);
    if (!c) {
      c = new Chunk(cx, cz);
      this.chunks.set(key, c);
      this.generate(c);
    }
    return c;
  }

  unloadChunk(cx: number, cz: number) {
    this.chunks.delete(chunkKey(cx, cz));
    if (cx === this.lastCx && cz === this.lastCz) {
      this.lastCx = NaN;
      this.lastChunk = undefined;
    }
  }

  getBlock(x: number, y: number, z: number): BlockId {
    if (y < 0 || y >= WORLD_HEIGHT) return AIR;
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    const c = this.chunk(cx, cz);
    if (!c) return AIR;
    return c.blocks[idx(x - cx * CHUNK, y, z - cz * CHUNK)];
  }

  /** Comme getBlock, mais dit si le chunk existe (utile pour les collisions). */
  isLoaded(x: number, z: number): boolean {
    return this.chunk(Math.floor(x / CHUNK), Math.floor(z / CHUNK)) !== undefined;
  }

  getLight(x: number, y: number, z: number): number {
    return this.level(x, y, z, 0);
  }

  /** Lumiere des torches et lampes seule (0 si le chunk n'est pas charge). */
  getBlockLight(x: number, y: number, z: number): number {
    return this.level(x, y, z, 1);
  }

  private level(x: number, y: number, z: number, canal: Canal): number {
    if (y < 0) return 0;
    if (y >= WORLD_HEIGHT) return canal === 0 ? MAX_LIGHT : 0;
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    const c = this.chunk(cx, cz);
    if (!c) return canal === 0 ? MAX_LIGHT : 0;
    return (canal === 0 ? c.light : c.bloc)[idx(x - cx * CHUNK, y, z - cz * CHUNK)];
  }

  private setLightRaw(x: number, y: number, z: number, v: number, canal: Canal): boolean {
    if (y < 0 || y >= WORLD_HEIGHT) return false;
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    const c = this.chunk(cx, cz);
    if (!c) return false;
    const arr = canal === 0 ? c.light : c.bloc;
    const i = idx(x - cx * CHUNK, y, z - cz * CHUNK);
    if (arr[i] === v) return false;
    arr[i] = v;
    if (this.trackLightChanges) this.markDirty(x, y, z);
    return true;
  }

  markDirty(x: number, y: number, z: number) {
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    const lx = x - cx * CHUNK;
    const lz = z - cz * CHUNK;
    // Les faces et leur occlusion ne debordent que d'une case du chunk.
    for (let dx = lx === 0 ? -1 : 0; dx <= (lx === CHUNK - 1 ? 1 : 0); dx++) {
      for (let dz = lz === 0 ? -1 : 0; dz <= (lz === CHUNK - 1 ? 1 : 0); dz++) {
        const c = this.chunk(cx + dx, cz + dz);
        if (c) {
          c.dirty = true;
          this.dirty.add(chunkKey(cx + dx, cz + dz));
        }
      }
    }
    void y;
  }

  // ------------------------------------------------------------- generation

  private generate(c: Chunk) {
    const { seed } = this;
    const baseX = c.cx * CHUNK;
    const baseZ = c.cz * CHUNK;
    for (let z = 0; z < CHUNK; z++) {
      for (let x = 0; x < CHUNK; x++) {
        const wx = baseX + x;
        const wz = baseZ + z;
        const { height, biome } = columnAt(wx, wz, seed);
        const beach = height <= SEA_LEVEL + 1 && height >= SEA_LEVEL - 2;
        for (let y = 0; y <= height; y++) {
          let id: BlockId;
          if (y === 0) id = SOCLE;
          else if (y > height - 4) {
            if (biome === "desert" || beach) id = y === height && height > SEA_LEVEL ? SABLE : SABLE;
            else if (biome === "neige") id = y === height ? NEIGE : PIERRE;
            else if (biome === "montagne") id = y === height ? PIERRE : PIERRE;
            else id = y === height ? (height < SEA_LEVEL ? GRAVIER : HERBE) : TERRE;
          } else {
            id = oreAt(wx, y, wz, seed);
          }
          if (y > 0 && y < height && caveAt(wx, y, wz, seed)) id = AIR;
          c.blocks[idx(x, y, z)] = id;
        }
        // Mer et lacs.
        for (let y = height + 1; y <= SEA_LEVEL; y++) c.blocks[idx(x, y, z)] = EAU;
        // Sable sous le niveau de l'eau, sur la rive.
        if (height < SEA_LEVEL && c.blocks[idx(x, height, z)] === HERBE) c.blocks[idx(x, height, z)] = SABLE;
      }
    }
    this.decorate(c);
    this.applyEdits(c);
    c.built = true;
    c.dirty = true;
  }

  /** Arbres, cactus, fleurs. Les arbres des chunks voisins debordent ici. */
  private decorate(c: Chunk) {
    const { seed } = this;
    for (let ox = -1; ox <= 1; ox++) {
      for (let oz = -1; oz <= 1; oz++) {
        const ncx = c.cx + ox;
        const ncz = c.cz + oz;
        const r = hash2(ncx, ncz, seed + 907);
        const attempts = 6;
        for (let i = 0; i < attempts; i++) {
          const h1 = hash2(ncx * 31 + i, ncz * 17 - i, seed + 1301);
          const h2 = hash2(ncx * 13 - i, ncz * 29 + i, seed + 1601);
          const wx = ncx * CHUNK + Math.floor(h1 * CHUNK);
          const wz = ncz * CHUNK + Math.floor(h2 * CHUNK);
          const { height, biome } = columnAt(wx, wz, seed);
          if (height <= SEA_LEVEL) continue;
          const chance = biome === "foret" ? 0.8 : biome === "plaine" ? 0.22 : biome === "desert" ? 0.3 : 0.12;
          if (hash2(wx, wz, seed + 1901) > chance) continue;
          if (biome === "desert") this.putCactus(c, wx, height + 1, wz);
          else if (biome !== "neige" || r > 0.5) this.putTree(c, wx, height + 1, wz, seed);
        }
        // Touffes d'herbe et fleurs, denses dans les plaines.
        for (let i = 0; i < 14; i++) {
          const hx = hash2(ncx * 7 + i, ncz * 11 + i * 3, seed + 2203);
          const hz = hash2(ncx * 19 - i, ncz * 23 + i, seed + 2309);
          const wx = ncx * CHUNK + Math.floor(hx * CHUNK);
          const wz = ncz * CHUNK + Math.floor(hz * CHUNK);
          if (Math.floor(wx / CHUNK) !== c.cx || Math.floor(wz / CHUNK) !== c.cz) continue;
          const { height, biome } = columnAt(wx, wz, seed);
          if (height <= SEA_LEVEL || biome === "desert" || biome === "neige") continue;
          const lx = wx - c.cx * CHUNK;
          const lz = wz - c.cz * CHUNK;
          if (c.blocks[idx(lx, height, lz)] !== HERBE) continue;
          if (c.blocks[idx(lx, height + 1, lz)] !== AIR) continue;
          const pick = hash2(wx * 3, wz * 5, seed + 2411);
          c.blocks[idx(lx, height + 1, lz)] = pick > 0.86 ? FLEUR_ROUGE : pick > 0.72 ? FLEUR_JAUNE : pick > 0.66 ? FLEUR_BLEUE : pick > 0.35 ? HERBE_HAUTE : AIR;
        }
      }
    }
    this.decorateFood(c);
  }

  /**
   * De quoi se nourrir : citrouilles et melons, champignons en foret, cannes
   * a sucre au bord de l'eau. Graines a part pour ne rien deplacer dans les
   * mondes deja crees.
   */
  private decorateFood(c: Chunk) {
    const { seed } = this;
    for (let i = 0; i < 10; i++) {
      const lx = Math.floor(hash2(c.cx * 41 + i, c.cz * 43 - i, seed + 4001) * CHUNK);
      const lz = Math.floor(hash2(c.cx * 47 - i, c.cz * 53 + i, seed + 4003) * CHUNK);
      const wx = c.cx * CHUNK + lx;
      const wz = c.cz * CHUNK + lz;
      const { height, biome } = columnAt(wx, wz, seed);
      if (height + 1 >= WORLD_HEIGHT) continue;
      const ground = c.blocks[idx(lx, height, lz)];
      const above = idx(lx, height + 1, lz);
      if (c.blocks[above] !== AIR && c.blocks[above] !== HERBE_HAUTE) continue;
      const roll = hash2(wx * 7, wz * 11, seed + 4007);
      if (ground === HERBE) {
        if (biome === "plaine" && roll < 0.05) c.blocks[above] = CITROUILLE;
        else if (biome === "foret" && roll < 0.04) c.blocks[above] = MELON;
        else if (biome === "foret" && roll < 0.2) c.blocks[above] = roll < 0.12 ? CHAMPIGNON_BRUN : CHAMPIGNON_ROUGE;
      }
      // Canne a sucre : sur le sable ou l'herbe, juste au-dessus de la mer, a cote de l'eau.
      if ((ground === SABLE || ground === HERBE) && height === SEA_LEVEL + 1 && roll > 0.55) {
        let eau = false;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          if (columnAt(wx + dx, wz + dz, seed).height <= SEA_LEVEL) eau = true;
        }
        if (eau) {
          const h = 1 + Math.floor(roll * 10) % 3;
          for (let k = 1; k <= h && height + k < WORLD_HEIGHT; k++) {
            const j = idx(lx, height + k, lz);
            if (c.blocks[j] === AIR || c.blocks[j] === HERBE_HAUTE) c.blocks[j] = CANNE_A_SUCRE;
          }
        }
      }
    }
  }

  private setLocal(c: Chunk, wx: number, y: number, wz: number, id: BlockId, onlyAir = true) {
    if (y < 0 || y >= WORLD_HEIGHT) return;
    const lx = wx - c.cx * CHUNK;
    const lz = wz - c.cz * CHUNK;
    if (lx < 0 || lz < 0 || lx >= CHUNK || lz >= CHUNK) return;
    const i = idx(lx, y, lz);
    if (onlyAir && c.blocks[i] !== AIR) return;
    c.blocks[i] = id;
  }

  private putTree(c: Chunk, wx: number, y: number, wz: number, seed: number) {
    const h = 4 + Math.floor(hash2(wx, wz, seed + 3001) * 3);
    for (let i = 0; i < h; i++) this.setLocal(c, wx, y + i, wz, TRONC);
    const top = y + h;
    for (let dy = -2; dy <= 1; dy++) {
      const radius = dy <= -1 ? 2 : dy === 0 ? 1 : 1;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (dy === 1 && Math.abs(dx) + Math.abs(dz) > 1) continue;
          if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          this.setLocal(c, wx + dx, top + dy, wz + dz, FEUILLES);
        }
      }
    }
  }

  private putCactus(c: Chunk, wx: number, y: number, wz: number) {
    const h = 2 + Math.floor(hash2(wx, wz, this.seed + 3301) * 3);
    for (let i = 0; i < h; i++) this.setLocal(c, wx, y + i, wz, CACTUS);
  }

  private applyEdits(c: Chunk) {
    if (this.edits.size === 0) return;
    const x0 = c.cx * CHUNK;
    const z0 = c.cz * CHUNK;
    for (const [key, id] of this.edits) {
      const parts = key.split(",");
      const x = Number(parts[0]);
      const y = Number(parts[1]);
      const z = Number(parts[2]);
      if (x < x0 || x >= x0 + CHUNK || z < z0 || z >= z0 + CHUNK) continue;
      if (y < 0 || y >= WORLD_HEIGHT) continue;
      c.blocks[idx(x - x0, y, z - z0)] = id;
    }
  }

  // ---------------------------------------------------------------- lumiere

  /**
   * Lumiere du chunk : le ciel tombe a 15 dans les colonnes degagees, les
   * torches eclairent a 14, et tout se propage de proche en proche en perdant
   * un niveau par bloc. Une seule valeur par bloc (pas de jour/nuit), ce qui
   * evite de recalculer le monde a chaque minute.
   */
  lightChunk(c: Chunk) {
    c.light.fill(0);
    const queue: number[] = [];
    const baseX = c.cx * CHUNK;
    const baseZ = c.cz * CHUNK;
    // Hauteur ou le ciel s'arrete, colonne par colonne.
    const skyFrom = new Int16Array(CHUNK * CHUNK);
    for (let z = 0; z < CHUNK; z++) {
      for (let x = 0; x < CHUNK; x++) {
        let y = WORLD_HEIGHT - 1;
        while (y >= 0) {
          const id = c.blocks[idx(x, y, z)];
          if (block(id).opaque) break;
          c.light[idx(x, y, z)] = MAX_LIGHT;
          y--;
        }
        skyFrom[z * CHUNK + x] = y + 1;
        // Sources de lumiere sous la surface.
        for (; y >= 0; y--) {
          const id = c.blocks[idx(x, y, z)];
          const emit = block(id).light;
          if (emit > 0) {
            c.light[idx(x, y, z)] = emit;
            queue.push(baseX + x, y, baseZ + z);
          }
        }
      }
    }
    // Le ciel ne se propage que la ou il peut encore eclairer quelque chose :
    // a cote d'une case couverte (sous un surplomb, une grotte) ou vers un
    // chunk voisin moins eclaire. En plein air, tout est deja a 15 : inutile
    // d'examiner des milliers de cases pour rien.
    const needsSpread = (x: number, y: number, z: number) => {
      for (let n = 0; n < 4; n++) {
        const nx = x + (n === 0 ? 1 : n === 1 ? -1 : 0);
        const nz = z + (n === 2 ? 1 : n === 3 ? -1 : 0);
        if (nx >= 0 && nx < CHUNK && nz >= 0 && nz < CHUNK) {
          if (y < skyFrom[nz * CHUNK + nx] && !block(c.blocks[idx(nx, y, nz)]).opaque) return true;
        } else {
          const wx = baseX + nx;
          const wz = baseZ + nz;
          if (this.chunk(Math.floor(wx / CHUNK), Math.floor(wz / CHUNK)) && this.getLight(wx, y, wz) < MAX_LIGHT - 1 && !block(this.getBlock(wx, y, wz)).opaque) return true;
        }
      }
      return false;
    };
    for (let z = 0; z < CHUNK; z++) {
      for (let x = 0; x < CHUNK; x++) {
        for (let y = WORLD_HEIGHT - 1; y >= skyFrom[z * CHUNK + x]; y--) {
          if (needsSpread(x, y, z)) queue.push(baseX + x, y, baseZ + z);
        }
      }
    }
    // Les bords des chunks voisins deja eclaires alimentent celui-ci (un cote
    // a la fois, pour que le raccourci de chunk serve).
    this.seedEdges(c, queue, 0);
    this.propagate(queue, 0);

    // Deuxieme canal : la lumiere des blocs seule, partie de chaque source.
    c.bloc.fill(0);
    const sources: number[] = [];
    for (let i = 0; i < c.blocks.length; i++) {
      const emit = EMIT[c.blocks[i]];
      if (emit === 0) continue;
      c.bloc[i] = emit;
      const x = i % CHUNK;
      const z = Math.floor(i / CHUNK) % CHUNK;
      const y = Math.floor(i / (CHUNK * CHUNK));
      sources.push(baseX + x, y, baseZ + z);
    }
    this.seedEdges(c, sources, 1);
    this.propagate(sources, 1);
  }

  private seedEdges(c: Chunk, queue: number[], canal: Canal) {
    const baseX = c.cx * CHUNK;
    const baseZ = c.cz * CHUNK;
    for (const [ox, oz, alongX] of [
      [-1, 0, false],
      [CHUNK, 0, false],
      [0, -1, true],
      [0, CHUNK, true],
    ] as const) {
      const n = this.chunk(Math.floor((baseX + (alongX ? 0 : ox)) / CHUNK), Math.floor((baseZ + (alongX ? oz : 0)) / CHUNK));
      if (!n) continue;
      const arr = canal === 0 ? n.light : n.bloc;
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        for (let k = 0; k < CHUNK; k++) {
          const x = baseX + (alongX ? k : ox);
          const z = baseZ + (alongX ? oz : k);
          if (arr[idx(x - n.cx * CHUNK, y, z - n.cz * CHUNK)] > 1) queue.push(x, y, z);
        }
      }
    }
  }

  /** File de propagation : des triplets (x, y, z) deja eclaires. */
  private propagate(queue: number[], canal: Canal) {
    let head = 0;
    while (head < queue.length) {
      const x = queue[head++];
      const y = queue[head++];
      const z = queue[head++];
      const level = this.level(x, y, z, canal);
      if (level <= 1) continue;
      for (const [dx, dy, dz] of NEIGHBOURS) {
        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;
        if (ny < 0 || ny >= WORLD_HEIGHT) continue;
        const c = this.chunk(Math.floor(nx / CHUNK), Math.floor(nz / CHUNK));
        if (!c) continue;
        if (OPAQUE[this.getBlock(nx, ny, nz)]) continue;
        // Le ciel descend sans faiblir : sinon les puits sont noirs au fond.
        const next = canal === 0 && dy === -1 && level === MAX_LIGHT ? MAX_LIGHT : level - 1;
        if (this.level(nx, ny, nz, canal) >= next) continue;
        this.setLightRaw(nx, ny, nz, next, canal);
        queue.push(nx, ny, nz);
      }
    }
  }

  /** Efface la lumiere qui venait d'une case devenue opaque, puis recalcule. */
  private removeLight(x: number, y: number, z: number, canal: Canal) {
    const start = this.level(x, y, z, canal);
    if (start === 0) return;
    this.setLightRaw(x, y, z, 0, canal);
    const removal: number[] = [x, y, z, start];
    const refill: number[] = [];
    const sources: number[] = [];
    let head = 0;
    while (head < removal.length) {
      const cx = removal[head++];
      const cy = removal[head++];
      const cz = removal[head++];
      const level = removal[head++];
      for (const [dx, dy, dz] of NEIGHBOURS) {
        const nx = cx + dx;
        const ny = cy + dy;
        const nz = cz + dz;
        if (ny < 0 || ny >= WORLD_HEIGHT) continue;
        if (!this.chunk(Math.floor(nx / CHUNK), Math.floor(nz / CHUNK))) continue;
        const nl = this.level(nx, ny, nz, canal);
        if (nl === 0) continue;
        const fromSky = canal === 0 && dy === -1 && level === MAX_LIGHT;
        if (nl < level || fromSky) {
          this.setLightRaw(nx, ny, nz, 0, canal);
          removal.push(nx, ny, nz, nl);
          // Une autre source conserve sa propre emission apres le retrait.
          const emit = EMIT[this.getBlock(nx, ny, nz)];
          if (emit > 0) sources.push(nx, ny, nz, emit);
        } else {
          refill.push(nx, ny, nz);
        }
      }
    }
    for (let i = 0; i < sources.length; i += 4) {
      const sx = sources[i];
      const sy = sources[i + 1];
      const sz = sources[i + 2];
      this.setLightRaw(sx, sy, sz, Math.max(sources[i + 3], this.level(sx, sy, sz, canal)), canal);
      refill.push(sx, sy, sz);
    }
    this.propagate(refill, canal);
  }

  /** Remet la lumiere autour d'une case qui vient de changer. */
  private relightAround(x: number, y: number, z: number, canal: Canal) {
    const id = this.getBlock(x, y, z);
    const emit = EMIT[id];
    this.removeLight(x, y, z, canal);
    if (OPAQUE[id]) {
      // Une lampe reste opaque, mais doit eclairer les cases voisines.
      if (emit > 0) {
        this.setLightRaw(x, y, z, emit, canal);
        this.propagate([x, y, z], canal);
      }
    } else {
      const queue: number[] = [];
      let best = emit;
      for (const [dx, dy, dz] of NEIGHBOURS) {
        const nl = this.level(x + dx, y + dy, z + dz, canal);
        const drop = canal === 0 && dy === 1 && nl === MAX_LIGHT ? 0 : 1;
        best = Math.max(best, nl - drop);
      }
      if (best > 0) {
        this.setLightRaw(x, y, z, best, canal);
        queue.push(x, y, z);
      }
      this.propagate(queue, canal);
    }
  }

  // ---------------------------------------------------------- modifications

  /** Pose ou casse un bloc, met a jour lumiere et maillages, note l'edit. */
  setBlock(x: number, y: number, z: number, id: BlockId) {
    if (![x, y, z, id].every(Number.isInteger) || id < 0 || id >= BLOCKS.length || y <= 0 || y >= WORLD_HEIGHT) return;
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    const c = this.chunk(cx, cz);
    if (!c) return;
    const i = idx(x - cx * CHUNK, y, z - cz * CHUNK);
    if (c.blocks[i] === id) return;
    c.blocks[i] = id;
    this.edits.set(editKey(x, y, z), id);
    // Seuls les chunks dont la lumiere change doivent aussi etre reconstruits.
    this.trackLightChanges = true;
    try {
      this.relightAround(x, y, z, 0);
      this.relightAround(x, y, z, 1);
    } finally { this.trackLightChanges = false; }
    this.markDirty(x, y, z);
  }

  /**
   * Beaucoup de blocs d'un coup (explosion) : on change tout, puis on
   * reeclaire une seule fois les chunks touches, au lieu d'une propagation de
   * lumiere par bloc.
   */
  setBlocks(changes: [number, number, number, BlockId][]) {
    const touched = new Map<string, Chunk>();
    for (const [x, y, z, id] of changes) {
      if (![x, y, z, id].every(Number.isInteger) || id < 0 || id >= BLOCKS.length || y <= 0 || y >= WORLD_HEIGHT) continue;
      const cx = Math.floor(x / CHUNK);
      const cz = Math.floor(z / CHUNK);
      const c = this.chunk(cx, cz);
      if (!c) continue;
      const i = idx(x - cx * CHUNK, y, z - cz * CHUNK);
      if (c.blocks[i] === id) continue;
      c.blocks[i] = id;
      this.edits.set(editKey(x, y, z), id);
      touched.set(chunkKey(cx, cz), c);
      this.markDirty(x, y, z);
    }
    for (const c of touched.values()) this.lightChunk(c);
    // Les voisins recoivent la nouvelle lumiere par leurs bords.
    for (const c of touched.values()) {
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const n = this.chunk(c.cx + dx, c.cz + dz);
        if (n) { n.dirty = true; this.dirty.add(chunkKey(n.cx, n.cz)); }
      }
    }
  }
}

const NEIGHBOURS: [number, number, number][] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

// ---------------------------------------------------------------------------
// Maillage : des cubes vers de la geometrie
// ---------------------------------------------------------------------------

/** Une face de cube : direction, coins (position + coin de tuile), et AO. */
interface Face {
  dir: [number, number, number];
  /** Coins dans l'ordre 0,1,2 / 2,1,3. */
  corners: { pos: [number, number, number]; uv: [number, number] }[];
  /** Quelle tuile du bloc (0 dessus, 1 cote, 2 dessous). */
  tile: 0 | 1 | 2;
  /** Assombrissement de la face : le dessus est clair, le dessous sombre. */
  shade: number;
}

const FACES: Face[] = [
  {
    dir: [-1, 0, 0],
    tile: 1,
    shade: 0.62,
    corners: [
      { pos: [0, 1, 0], uv: [0, 1] },
      { pos: [0, 0, 0], uv: [0, 0] },
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [0, 0, 1], uv: [1, 0] },
    ],
  },
  {
    dir: [1, 0, 0],
    tile: 1,
    shade: 0.62,
    corners: [
      { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [1, 0, 1], uv: [0, 0] },
      { pos: [1, 1, 0], uv: [1, 1] },
      { pos: [1, 0, 0], uv: [1, 0] },
    ],
  },
  {
    dir: [0, -1, 0],
    tile: 2,
    shade: 0.42,
    corners: [
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 0], uv: [1, 1] },
      { pos: [0, 0, 0], uv: [0, 1] },
    ],
  },
  {
    dir: [0, 1, 0],
    tile: 0,
    shade: 1,
    corners: [
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [0, 1, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [0, 0] },
    ],
  },
  {
    dir: [0, 0, -1],
    tile: 1,
    shade: 0.8,
    corners: [
      { pos: [1, 0, 0], uv: [0, 0] },
      { pos: [0, 0, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [0, 1] },
      { pos: [0, 1, 0], uv: [1, 1] },
    ],
  },
  {
    dir: [0, 0, 1],
    tile: 1,
    shade: 0.8,
    corners: [
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [0, 1, 1], uv: [0, 1] },
      { pos: [1, 1, 1], uv: [1, 1] },
    ],
  },
];

export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
}

export interface ChunkMesh {
  /** Blocs pleins : materiau sans decoupe (le GPU peut rejeter tot ce qui est cache). */
  solid: MeshData | null;
  /** Feuilles, verres, plantes, torches : materiau a decoupe (alphaTest). */
  cutout: MeshData | null;
  water: MeshData | null;
}

/** Marge a l'interieur de chaque tuile (la gouttiere de l'atlas fait le reste). */
const UV_INSET = 0.0004;
const ATLAS_SIZE = ATLAS_COLS * ATLAS_CELL;

/** Coordonnees de texture d'un point (u, v de 0 a 1) d'une tuile de l'atlas. */
export function tileUV(tile: number, u: number, v: number): [number, number] {
  const col = tile % ATLAS_COLS;
  const row = Math.floor(tile / ATLAS_COLS);
  const u0 = (col * ATLAS_CELL + ATLAS_GUTTER) / ATLAS_SIZE;
  const v0 = 1 - (row * ATLAS_CELL + ATLAS_GUTTER + ATLAS_TILE) / ATLAS_SIZE;
  const s = ATLAS_TILE / ATLAS_SIZE;
  return [u0 + UV_INSET + u * (s - UV_INSET * 2), v0 + UV_INSET + v * (s - UV_INSET * 2)];
}
void ATLAS_ROWS;

class MeshBuilder {
  positions: number[] = [];
  normals: number[] = [];
  uvs: number[] = [];
  colors: number[] = [];
  indices: number[] = [];

  get empty() {
    return this.indices.length === 0;
  }

  build(): MeshData | null {
    if (this.empty) return null;
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      uvs: new Float32Array(this.uvs),
      colors: new Float32Array(this.colors),
      indices: new Uint32Array(this.indices),
    };
  }
}

/** Le voisin cache-t-il cette face ? Deux blocs d'eau ne se dessinent pas entre eux. */
function hidesFace(self: BlockDef, neighbour: BlockDef): boolean {
  if (neighbour.opaque) return true;
  if (self.liquid && neighbour.liquid) return true;
  // Deux verres (ou deux glaces) cote a cote : une seule vitre.
  if (self.id === neighbour.id && !self.opaque && !self.liquid && self.id !== FEUILLES) return true;
  return false;
}

/** Tuiles naturelles : tournees au hasard sur le dessus pour casser le damier. */
const NATURELLES = new Set<number>([
  TILE.herbeDessus, TILE.terre, TILE.pierre, TILE.sable, TILE.gravier, TILE.neige, TILE.feuilles, TILE.terreLabouree,
]);

function hash3i(x: number, y: number, z: number): number {
  let h = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Construit la geometrie d'un chunk. Chaque sommet porte sa lumiere dans sa
 * couleur : r = lumiere du ciel, g = lumiere des blocs, b = ombrage seul
 * (face et occlusion). Le materiau (CubesScene) combine r et g selon l'heure,
 * sans lumiere dynamique ni remaillage quand la nuit tombe.
 *
 * La lumiere est lissee par coin (moyenne des cases qui touchent le coin),
 * comme l'« eclairage doux » du jeu dont on s'inspire.
 */
export function buildChunkMesh(world: World, c: Chunk): ChunkMesh {
  const solid = new MeshBuilder();
  const cutout = new MeshBuilder();
  const water = new MeshBuilder();
  const baseX = c.cx * CHUNK;
  const baseZ = c.cz * CHUNK;
  remplirBordure(world, c);
  const brightness: number[] = [0, 0, 0, 0];

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let z = 0; z < CHUNK; z++) {
      for (let x = 0; x < CHUNK; x++) {
        const i = ((y + 1) * P + (z + 1)) * P + (x + 1);
        const id = PB[i];
        if (id === AIR) continue;
        const d = BLOCKS[id];

        if (d.shape === "croix") {
          addCross(cutout, x, y, z, d, courbe(PS[i]), courbe(PL[i]));
          continue;
        }

        const target = d.liquid ? water : d.opaque ? solid : cutout;
        const h = hash3i(baseX + x, y, baseZ + z);
        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const ni = i + FACE_D[f];
          if (hidesFace(d, BLOCKS[PB[ni]])) continue;
          const [dx, dy, dz] = face.dir;
          const tile = d.tiles[face.tile];
          // Variation douce par bloc : les grandes surfaces ne font plus damier.
          const naturelle = NATURELLES.has(tile);
          const nuance = naturelle ? 0.92 + 0.08 * ((h >>> 3) & 7) / 7 : 1;
          const tourne = naturelle && dy === 1 ? h & 3 : 0;
          const start = target.positions.length / 3;
          const coins = CORNER_D[f];
          for (let k = 0; k < 4; k++) {
            const corner = face.corners[k];
            const [px, py, pz] = corner.pos;
            // Hauteur de l'eau : la surface est legerement plus basse.
            const drop = d.liquid && py === 1 && PB[i + PP] !== EAU ? 0.12 : 0;
            target.positions.push(x + px, y + py - drop, z + pz);
            target.normals.push(dx, dy, dz);
            let cu = corner.uv[0];
            let cv = corner.uv[1];
            for (let r = 0; r < tourne; r++) { const t = cu; cu = cv; cv = 1 - t; }
            const [u, v] = tileUV(tile, cu, cv);
            target.uvs.push(u, v);
            // Occlusion et lumiere lissee du coin : la case en face, deux cases
            // de cote et la diagonale. Plus il y a de blocs, plus c'est sombre ;
            // la lumiere est la moyenne des cases ouvertes.
            const i1 = ni + coins[k * 3];
            const i2 = ni + coins[k * 3 + 1];
            const i3 = ni + coins[k * 3 + 2];
            const o1 = OPAQUE[PB[i1]] === 1;
            const o2 = OPAQUE[PB[i2]] === 1;
            const o3 = o1 && o2 ? true : OPAQUE[PB[i3]] === 1;
            const ao = AO[o1 && o2 ? 3 : (o1 ? 1 : 0) + (o2 ? 1 : 0) + (o3 ? 1 : 0)];
            let n = 1;
            let sky = PS[ni];
            let blk = PL[ni];
            if (!o1) { sky += PS[i1]; blk += PL[i1]; n++; }
            if (!o2) { sky += PS[i2]; blk += PL[i2]; n++; }
            if (!o3) { sky += PS[i3]; blk += PL[i3]; n++; }
            const shade = face.shade * ao * nuance;
            const cs = courbe(sky / n);
            const cb = courbe(blk / n);
            target.colors.push(shade * cs, shade * cb, shade);
            brightness[k] = shade * Math.max(cs, cb);
          }
          // Le sens des deux triangles suit la lumiere des coins, sinon le coin
          // sombre fait un pli visible en diagonale.
          if (brightness[0] + brightness[3] > brightness[1] + brightness[2]) {
            target.indices.push(start, start + 1, start + 3, start, start + 3, start + 2);
          } else {
            target.indices.push(start, start + 1, start + 2, start + 2, start + 1, start + 3);
          }
        }
      }
    }
  }
  return { solid: solid.build(), cutout: cutout.build(), water: water.build() };
}

const AO = [1, 0.76, 0.6, 0.46];

// Copie du chunk et d'une case de ses voisins (et d'une couche au-dessus et
// au-dessous) : le maillage lit ensuite des tableaux, sans chercher de chunk
// a chaque case. Partagee entre les appels (un seul maillage a la fois).
const P = CHUNK + 2;
const PP = P * P;
const PB = new Uint8Array(PP * (WORLD_HEIGHT + 2));
const PS = new Uint8Array(PP * (WORLD_HEIGHT + 2));
const PL = new Uint8Array(PP * (WORLD_HEIGHT + 2));
/** Decalage d'index vers la case voisine de chaque face. */
const FACE_D = FACES.map((f) => f.dir[0] + f.dir[2] * P + f.dir[1] * PP);
/** Pour chaque face et chaque coin : decalages des deux cases de cote et de la diagonale. */
const CORNER_D = FACES.map((f) => {
  const [dx, , dz] = f.dir;
  const a0 = dx !== 0 ? 1 : 0;
  const a1 = dz !== 0 ? 1 : 2;
  const pas = [1, PP, P];
  const res: number[] = [];
  for (const corner of f.corners) {
    const s0 = corner.pos[a0] === 1 ? 1 : -1;
    const s1 = corner.pos[a1] === 1 ? 1 : -1;
    res.push(s0 * pas[a0], s1 * pas[a1], s0 * pas[a0] + s1 * pas[a1]);
  }
  return res;
});

function remplirBordure(world: World, c: Chunk) {
  const voisins: (Chunk | undefined)[] = [];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) voisins.push(dx === 0 && dz === 0 ? c : world.chunk(c.cx + dx, c.cz + dz));
  const top = (WORLD_HEIGHT + 1) * PP;
  for (let k = 0; k < PP; k++) {
    // Sous le monde : noir ; au-dessus : le ciel.
    PB[k] = AIR; PS[k] = 0; PL[k] = 0;
    PB[top + k] = AIR; PS[top + k] = MAX_LIGHT; PL[top + k] = 0;
  }
  for (let z = -1; z <= CHUNK; z++) {
    const vz = z < 0 ? 0 : z >= CHUNK ? 2 : 1;
    const lz = z < 0 ? CHUNK - 1 : z >= CHUNK ? 0 : z;
    for (let x = -1; x <= CHUNK; x++) {
      const vx = x < 0 ? 0 : x >= CHUNK ? 2 : 1;
      const lx = x < 0 ? CHUNK - 1 : x >= CHUNK ? 0 : x;
      const n = voisins[vz * 3 + vx];
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        const i = ((y + 1) * P + (z + 1)) * P + (x + 1);
        if (n) {
          const j = idx(lx, y, lz);
          PB[i] = n.blocks[j]; PS[i] = n.light[j]; PL[i] = n.bloc[j];
        } else {
          // Chunk absent : comme getBlock/getLight (de l'air en plein jour).
          PB[i] = AIR; PS[i] = MAX_LIGHT; PL[i] = 0;
        }
      }
    }
  }
}

/** Fleurs, herbes hautes, cultures et torches : deux plans croises. */
function addCross(b: MeshBuilder, x: number, y: number, z: number, d: BlockDef, sky: number, blk: number) {
  const tile = d.tiles[0];
  const torch = d.id === TORCHE;
  const w = torch ? 0.12 : 0.42;
  const h = torch ? 0.62 : d.id === CANNE_A_SUCRE ? 1 : 0.9;
  // Une torche brille par elle-meme.
  const shade = torch ? 1 : 0.9;
  const s = torch ? 1 : sky;
  const g = torch ? 1 : blk;
  const quads: [number, number, number, number][] = [
    [-w, -w, w, w],
    [-w, w, w, -w],
  ];
  for (const [x1, z1, x2, z2] of quads) {
    const start = b.positions.length / 3;
    const pts: [number, number, number][] = [
      [0.5 + x1, 0, 0.5 + z1],
      [0.5 + x2, 0, 0.5 + z2],
      [0.5 + x1, h, 0.5 + z1],
      [0.5 + x2, h, 0.5 + z2],
    ];
    const uv: [number, number][] = [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ];
    for (let i = 0; i < 4; i++) {
      b.positions.push(x + pts[i][0], y + pts[i][1], z + pts[i][2]);
      b.normals.push(0, 1, 0);
      const [u, v] = tileUV(tile, uv[i][0], uv[i][1]);
      b.uvs.push(u, v);
      b.colors.push(shade * s, shade * g, shade);
    }
    // Visible des deux cotes : on pousse les deux sens de triangles.
    b.indices.push(start, start + 1, start + 2, start + 2, start + 1, start + 3);
    b.indices.push(start + 2, start + 1, start, start + 3, start + 1, start + 2);
  }
}

// ---------------------------------------------------------------------------
// Visee : quel bloc regarde-t-on ?
// ---------------------------------------------------------------------------

export interface RayHit {
  /** Bloc touche. */
  x: number;
  y: number;
  z: number;
  /** Face touchee : la case ou l'on poserait un bloc. */
  nx: number;
  ny: number;
  nz: number;
  id: BlockId;
  distance: number;
}

/**
 * Parcours de grille facon Amanatides & Woo : on avance de frontiere en
 * frontiere plutot qu'a petits pas, donc aucun bloc n'est saute meme en
 * regardant en biais.
 */
export function raycast(
  world: World,
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDistance: number,
  hitLiquid = false,
): RayHit | null {
  let x = Math.floor(ox);
  let y = Math.floor(oy);
  let z = Math.floor(oz);
  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const stepZ = dz > 0 ? 1 : -1;
  if (dx === 0 && dy === 0 && dz === 0) return null;
  const tDeltaX = dx === 0 ? Infinity : Math.abs(1 / dx);
  const tDeltaY = dy === 0 ? Infinity : Math.abs(1 / dy);
  const tDeltaZ = dz === 0 ? Infinity : Math.abs(1 / dz);
  let tMaxX = dx === 0 ? Infinity : tDeltaX * (dx > 0 ? 1 - (ox - x) : ox - x);
  let tMaxY = dy === 0 ? Infinity : tDeltaY * (dy > 0 ? 1 - (oy - y) : oy - y);
  let tMaxZ = dz === 0 ? Infinity : tDeltaZ * (dz > 0 ? 1 - (oz - z) : oz - z);
  let nx = 0;
  let ny = 0;
  let nz = 0;
  let t = 0;
  for (let guard = 0; guard < 512 && t <= maxDistance; guard++) {
    const id = world.getBlock(x, y, z);
    const d = block(id);
    if (id !== AIR && (hitLiquid || !d.liquid)) {
      return { x, y, z, nx: x + nx, ny: y + ny, nz: z + nz, id, distance: t };
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX;
      t = tMaxX;
      tMaxX += tDeltaX;
      nx = -stepX;
      ny = 0;
      nz = 0;
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      t = tMaxY;
      tMaxY += tDeltaY;
      nx = 0;
      ny = -stepY;
      nz = 0;
    } else {
      z += stepZ;
      t = tMaxZ;
      tMaxZ += tDeltaZ;
      nx = 0;
      ny = 0;
      nz = -stepZ;
    }
    if ((y < 0 && dy <= 0) || (y >= WORLD_HEIGHT && dy >= 0)) return null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sauvegarde
// ---------------------------------------------------------------------------

export interface SavedWorld {
  /** 1 : mondes d'avant la fabrication (toujours lisibles), 2 : actuel. */
  version: 1 | 2;
  seed: number;
  mode: "creatif" | "survie";
  /** Position et regard du joueur. */
  player: { x: number; y: number; z: number; yaw: number; pitch: number };
  /** Barre d'objets : un bloc ou un objet (>= 256) par case, 0 = main nue. */
  hotbar: number[];
  /** Quantites en survie, par bloc ou objet. */
  stock: Record<string, number>;
  /** Modifications : x,y,z,id a la suite. */
  edits: number[];
  savedAt: number;
  /** Survie : vie, faim et soif, de 0 a 100 (absent : tout plein). */
  survie?: { vie: number; faim: number; soif: number };
  /** Secondes de jeu ecoulees : l'heure du jour (absent : le matin). */
  temps?: number;
  /** Usure de l'exemplaire en cours de chaque outil ou armure. */
  usure?: Record<string, number>;
  /** Armure portee : casque, plastron, jambieres, bottes (0 = rien). */
  armure?: number[];
  /** Cultures plantees : x,y,z,heure de plantation (secondes de jeu) a la suite. */
  cultures?: number[];
}

export function encodeEdits(edits: Edits): number[] {
  const out: number[] = [];
  for (const [key, id] of edits) {
    const parts = key.split(",");
    out.push(Number(parts[0]), Number(parts[1]), Number(parts[2]), id);
  }
  return out;
}

export function decodeEdits(flat: number[] | undefined): Edits {
  const map: Edits = new Map();
  if (!flat) return map;
  for (let i = 0; i + 3 < flat.length; i += 4) {
    map.set(editKey(flat[i], flat[i + 1], flat[i + 2]), flat[i + 3]);
  }
  return map;
}

/** Endroit sur, au-dessus du sol, pour deposer le joueur au depart. */
export function spawnPoint(seed: number): { x: number; y: number; z: number } {
  for (let r = 0; r < 64; r++) {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const x = Math.round(Math.cos(angle) * r * 4);
      const z = Math.round(Math.sin(angle) * r * 4);
      const { height, biome } = columnAt(x, z, seed);
      if (height > SEA_LEVEL + 1 && biome !== "montagne" && biome !== "neige") {
        return { x: x + 0.5, y: height + 2, z: z + 0.5 };
      }
    }
  }
  return { x: 0.5, y: SEA_LEVEL + 6, z: 0.5 };
}
