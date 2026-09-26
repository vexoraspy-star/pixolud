// Les Backrooms : definition des niveaux et generation procedurale.
//
// Chaque niveau est une grille plate, comme le Manoir : une case est pleine
// (mur, pilier, etagere) ou libre. La grille change a chaque partie, mais un
// BFS garantit toujours qu'on peut aller du depart a la sortie et a chaque
// objectif. Tout est en coordonnees de cases ; la taille d'une case en metres
// depend du niveau (les tunnels du niveau 2 sont plus serres que l'entrepot).

export type LevelId =
  | "niveau-0"
  | "niveau-1"
  | "niveau-2"
  | "niveau-3"
  | "niveau-4"
  | "niveau-37"
  | "niveau-run"
  | "niveau-5"
  | "niveau-6"
  | "niveau-fun";

export type ObjectiveKind = "sortie" | "fusibles" | "vannes" | "course";
export type EntityKind = "aucune" | "souriant" | "bacterie" | "voleur" | "chiens" | "fetards";
/**
 * « hotel » : appliques murales et lustres ; « noir » : aucun plafonnier, seulement
 * des batons lumineux poses au sol ; « fete » : ampoules de couleur.
 */
export type LightingKind = "neons" | "entrepot" | "secours" | "alarme" | "hotel" | "noir" | "fete";

export interface LevelDef {
  id: LevelId;
  /** Ce qu'on lit sur le carton : « 0 », « 1 », « ! ». */
  number: string;
  name: string;
  /** Une ligne de lore, sous le titre. */
  tagline: string;
  objective: ObjectiveKind;
  entity: EntityKind;
  lighting: LightingKind;
  /** Metres par case. */
  cellSize: number;
  wallHeight: number;
  width: number;
  height: number;
  /** Vitesses du joueur, en metres par seconde. */
  walk: number;
  sprint: number;
  crouch: number;
  /** Endurance : points perdus par seconde de course, regagnes en marchant. */
  staminaDrain: number;
  staminaRegen: number;
  /** Vitesses de l'entite, en metres par seconde. */
  entityWander: number;
  entityInvestigate: number;
  entityChase: number;
  /** Lucidite perdue par seconde, au calme et en pleine lumiere. */
  sanityDrain: number;
  fog: { color: number; near: number; far: number };
  hemi: { sky: number; ground: number; intensity: number };
  lamp: { color: number; intensity: number; range: number };
  waterCount: number;
  batteryCount: number;
  /** Fusibles ou vannes a trouver. */
  goalCount: number;
  /**
   * Etage superieur, relie au rez par des escaliers. `height` est alors le
   * nombre de lignes du rez, et `rows` celui de l'etage.
   */
  upper?: { rows: number; stairs: number };
  /** Coupures de courant regulieres : c'est dans le noir que le Souriant sort. */
  blackouts?: boolean;
}

/** Longueur d'une cage d'escalier, en cases : la rampe monte d'une hauteur de mur. */
export const STAIR_ROWS = 8;

export const LEVELS: LevelDef[] = [
  {
    id: "niveau-0",
    number: "0",
    name: "Le Hall",
    tagline: "Moquette humide, papier peint jaune, et le bourdonnement des néons. Pour toujours.",
    objective: "sortie",
    entity: "aucune",
    lighting: "neons",
    cellSize: 2,
    wallHeight: 2.8,
    width: 70,
    height: 56,
    upper: { rows: 40, stairs: 2 },
    walk: 3.1,
    sprint: 5.4,
    crouch: 1.6,
    staminaDrain: 20,
    staminaRegen: 14,
    entityWander: 0,
    entityInvestigate: 0,
    entityChase: 0,
    sanityDrain: 0.32,
    fog: { color: 0x8a7b3c, near: 6, far: 34 },
    hemi: { sky: 0xfff1b0, ground: 0x6b5a1e, intensity: 1.05 },
    lamp: { color: 0xfff3c4, intensity: 2.6, range: 9 },
    waterCount: 10,
    batteryCount: 3,
    goalCount: 0,
  },
  {
    id: "niveau-1",
    number: "1",
    name: "Zone habitable",
    tagline: "Béton, flaques et caisses abandonnées. Quand les lumières s'éteignent, quelque chose sourit.",
    objective: "fusibles",
    entity: "souriant",
    lighting: "entrepot",
    cellSize: 2.5,
    wallHeight: 4.2,
    width: 60,
    height: 48,
    upper: { rows: 34, stairs: 2 },
    walk: 3.1,
    sprint: 5.4,
    crouch: 1.6,
    staminaDrain: 20,
    staminaRegen: 14,
    entityWander: 1.6,
    entityInvestigate: 2.6,
    entityChase: 4.1,
    sanityDrain: 0.4,
    fog: { color: 0x1d2024, near: 5, far: 38 },
    hemi: { sky: 0xb8c4cc, ground: 0x2a2620, intensity: 0.95 },
    lamp: { color: 0xffc27a, intensity: 4.6, range: 13 },
    waterCount: 8,
    batteryCount: 7,
    goalCount: 3,
    blackouts: true,
  },
  {
    id: "niveau-2",
    number: "2",
    name: "Tuyauterie",
    tagline: "Des tunnels brûlants, des tuyaux qui cognent, et une chose qui écoute dans le noir.",
    objective: "vannes",
    entity: "bacterie",
    lighting: "secours",
    cellSize: 1.9,
    wallHeight: 2.5,
    width: 51,
    height: 41,
    upper: { rows: 31, stairs: 2 },
    walk: 3,
    sprint: 5.2,
    crouch: 1.5,
    staminaDrain: 22,
    staminaRegen: 13,
    entityWander: 1.8,
    entityInvestigate: 2.9,
    entityChase: 4.3,
    sanityDrain: 0.45,
    fog: { color: 0x120605, near: 3, far: 22 },
    hemi: { sky: 0x6a2a20, ground: 0x0c0605, intensity: 0.58 },
    lamp: { color: 0xff3b24, intensity: 2.4, range: 7 },
    waterCount: 7,
    batteryCount: 8,
    goalCount: 3,
  },
  {
    // Les « vannes » sont ici des disjoncteurs a relever : meme geste, maintenir E.
    id: "niveau-3",
    number: "3",
    name: "Centrale électrique",
    tagline: "Brique noircie, machines qui grondent et courant qui saute. Dans le noir, quelque chose sourit.",
    objective: "vannes",
    entity: "souriant",
    lighting: "secours",
    blackouts: true,
    cellSize: 2.2,
    wallHeight: 3.4,
    width: 55,
    height: 45,
    upper: { rows: 33, stairs: 2 },
    walk: 3.1,
    sprint: 5.4,
    crouch: 1.6,
    staminaDrain: 20,
    staminaRegen: 14,
    entityWander: 1.7,
    entityInvestigate: 2.8,
    entityChase: 4.3,
    sanityDrain: 0.42,
    fog: { color: 0x1a130c, near: 4, far: 30 },
    hemi: { sky: 0xd9a066, ground: 0x1c140c, intensity: 0.82 },
    lamp: { color: 0xffa24a, intensity: 3.2, range: 9 },
    waterCount: 8,
    batteryCount: 8,
    goalCount: 3,
  },
  {
    // Les « fusibles » sont ici des badges d'acces : meme logique de ramassage.
    id: "niveau-4",
    number: "4",
    name: "Bureaux abandonnés",
    tagline: "Des open-spaces sans fin et des écrans allumés pour personne. Quelque chose rôde entre les box.",
    objective: "fusibles",
    entity: "bacterie",
    lighting: "neons",
    cellSize: 2,
    wallHeight: 2.9,
    width: 64,
    height: 50,
    upper: { rows: 36, stairs: 2 },
    walk: 3.1,
    sprint: 5.4,
    crouch: 1.6,
    staminaDrain: 20,
    staminaRegen: 14,
    entityWander: 1.7,
    entityInvestigate: 2.8,
    entityChase: 4.4,
    sanityDrain: 0.36,
    fog: { color: 0x6c7270, near: 6, far: 36 },
    hemi: { sky: 0xe8f0f2, ground: 0x4a4c48, intensity: 0.95 },
    lamp: { color: 0xeaf4ff, intensity: 2.4, range: 9 },
    waterCount: 8,
    batteryCount: 5,
    goalCount: 3,
  },
  {
    id: "niveau-37",
    number: "37",
    name: "Les Piscines",
    tagline: "De l'eau tiède, du carrelage blanc à perte de vue, et un calme qui n'a rien de rassurant.",
    objective: "sortie",
    entity: "aucune",
    lighting: "neons",
    cellSize: 2.4,
    wallHeight: 3.6,
    width: 58,
    height: 46,
    walk: 3.1,
    sprint: 5.4,
    crouch: 1.6,
    staminaDrain: 20,
    staminaRegen: 14,
    entityWander: 0,
    entityInvestigate: 0,
    entityChase: 0,
    sanityDrain: 0.3,
    fog: { color: 0xbfe2e4, near: 8, far: 46 },
    hemi: { sky: 0xf4ffff, ground: 0x7fb6bb, intensity: 1.12 },
    lamp: { color: 0xf2ffff, intensity: 2.2, range: 10 },
    waterCount: 9,
    batteryCount: 3,
    goalCount: 0,
  },
  {
    id: "niveau-run",
    number: "!",
    name: "Cours",
    tagline: "Un seul couloir. Une seule porte. Et elle est juste derrière toi.",
    objective: "course",
    entity: "bacterie",
    lighting: "alarme",
    cellSize: 2,
    wallHeight: 3,
    width: 35,
    height: 33,
    walk: 3.2,
    sprint: 5.8,
    crouch: 1.6,
    // Course longue : on garde de quoi sprinter, sinon la poursuite est perdue d'avance.
    staminaDrain: 8,
    staminaRegen: 22,
    entityWander: 4.5,
    entityInvestigate: 4.5,
    entityChase: 4.5,
    sanityDrain: 0,
    fog: { color: 0x2a0303, near: 4, far: 30 },
    hemi: { sky: 0xff5a4a, ground: 0x1a0202, intensity: 0.55 },
    lamp: { color: 0xff2a1a, intensity: 3.4, range: 9 },
    waterCount: 0,
    batteryCount: 0,
    goalCount: 0,
  },
  // Les niveaux suivants sont AJOUTES a la fin : la progression sauvegardee
  // est un index dans cette liste, inserer au milieu la decalerait.
  {
    // Les « fusibles » sont ici des cles du personnel : meme logique de ramassage.
    id: "niveau-5",
    number: "5",
    name: "L'Hôtel de la terreur",
    tagline: "Moquette rouge, portes numérotées et un bal sans musiciens. Quelqu'un porte le visage d'un client.",
    objective: "fusibles",
    entity: "voleur",
    lighting: "hotel",
    cellSize: 2.1,
    wallHeight: 3.1,
    width: 58,
    height: 46,
    upper: { rows: 34, stairs: 2 },
    walk: 3.1,
    sprint: 5.4,
    crouch: 1.6,
    staminaDrain: 20,
    staminaRegen: 14,
    // Il ne bouge que quand on ne le regarde pas : il peut donc aller vite.
    entityWander: 1.6,
    entityInvestigate: 2.8,
    entityChase: 5,
    sanityDrain: 0.38,
    fog: { color: 0x1c0a07, near: 4, far: 30 },
    hemi: { sky: 0xffcfa0, ground: 0x2a0d08, intensity: 0.72 },
    lamp: { color: 0xffb56a, intensity: 2.6, range: 8 },
    waterCount: 8,
    batteryCount: 6,
    goalCount: 3,
  },
  {
    id: "niveau-6",
    number: "6",
    name: "Lumières éteintes",
    tagline: "Pas un seul néon. Ta lampe, quelques bâtons lumineux, et des pattes qui grattent dans le noir.",
    objective: "sortie",
    entity: "chiens",
    lighting: "noir",
    cellSize: 2,
    wallHeight: 2.7,
    width: 56,
    height: 44,
    walk: 3,
    sprint: 5.3,
    crouch: 1.5,
    staminaDrain: 21,
    staminaRegen: 13,
    // Aveugles mais tres rapides une fois lances : marcher accroupi, c'est survivre.
    entityWander: 1.8,
    entityInvestigate: 3,
    entityChase: 5,
    // Le noir est partout : la lampe allumee compte comme de la lumiere.
    sanityDrain: 0.3,
    fog: { color: 0x020203, near: 1.5, far: 19 },
    hemi: { sky: 0x2a3040, ground: 0x050506, intensity: 0.1 },
    lamp: { color: 0x8dffa8, intensity: 1.1, range: 5 },
    waterCount: 8,
    batteryCount: 11,
    goalCount: 0,
  },
  {
    // Les « vannes » sont ici des enceintes a debrancher : meme geste, maintenir E.
    id: "niveau-fun",
    number: "Fun =)",
    name: "La Fête",
    tagline: "Des ballons, du gâteau, une musique au loin. Tout le monde sourit. Tu es l'invité d'honneur.",
    objective: "vannes",
    entity: "fetards",
    lighting: "fete",
    cellSize: 2.2,
    wallHeight: 3.2,
    width: 56,
    height: 46,
    walk: 3.1,
    sprint: 5.4,
    crouch: 1.6,
    staminaDrain: 20,
    staminaRegen: 14,
    entityWander: 1.7,
    entityInvestigate: 3,
    entityChase: 4.6,
    sanityDrain: 0.34,
    fog: { color: 0x2a1030, near: 5, far: 32 },
    hemi: { sky: 0xffd0f0, ground: 0x3a1030, intensity: 0.9 },
    lamp: { color: 0xffd9f2, intensity: 2.6, range: 9 },
    waterCount: 8,
    batteryCount: 5,
    goalCount: 3,
  },
];

export function levelById(id: string): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}

/**
 * Cases : 0 libre, 1 mur, 2 pilier, 3 etagere (niveau 1), 4 objet plein
 * (colonne, gateau geant, chaudiere, lit...). Tout sauf 0 est plein.
 * Une case « objet » n'est PAS dessinee par la scene : c'est le decor qui la
 * dessine, d'apres la liste `props` du niveau.
 */
export const CELL_OPEN = 0;
export const CELL_WALL = 1;
export const CELL_PILLAR = 2;
export const CELL_RACK = 3;
export const CELL_PROP = 4;

/**
 * Salles marquantes imprimees dans la grille : celles des niveaux 5, 6 et Fun,
 * puis sept salles ajoutees aux niveaux 0, 1, 2, 4, 37 et 5 (voir EXTRA_ROOMS).
 */
export type RoomKind =
  | "chambres"
  | "bal"
  | "chaufferie"
  | "hall-noir"
  | "couloir-infini"
  | "inondee"
  | "gateau"
  | "ballons"
  | "piste"
  | "guirlandes"
  // Niveau 0 : une chaise seule sous un seul neon ; une grande salle aux neons tous morts.
  | "chaise-seule"
  | "neons-morts"
  // Niveau 1 : un labyrinthe de caisses empilees.
  | "caisses"
  // Niveau 2 : la salle des vannes geantes.
  | "vannes"
  // Niveau 4 : une salle de reunion.
  | "reunion"
  // Niveau 37 : un bassin profond, une margelle seche tout autour.
  | "bassin-profond"
  // Niveau 5 : le hall de reception, son comptoir et ses colonnes.
  | "reception";

/**
 * Ordre fixe : la zone d'une case vaut l'index de sa salle ici, plus un (0 = aucune salle).
 * Toute nouvelle salle s'ajoute A LA FIN, sans jamais reordonner les precedentes.
 */
export const ROOM_KINDS: readonly RoomKind[] = [
  "chambres",
  "bal",
  "chaufferie",
  "hall-noir",
  "couloir-infini",
  "inondee",
  "gateau",
  "ballons",
  "piste",
  "guirlandes",
  "chaise-seule",
  "neons-morts",
  "caisses",
  "vannes",
  "reunion",
  "bassin-profond",
  "reception",
];

/** Rectangle interieur d'une salle marquante, bornes incluses, en cases. */
export interface RoomMark {
  kind: RoomKind;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Nature de la salle marquante d'une case (null hors des salles marquantes). */
export function zoneKind(zones: Uint8Array, i: number): RoomKind | null {
  const z = zones[i];
  return z > 0 ? (ROOM_KINDS[z - 1] ?? null) : null;
}

function zoneCode(kind: RoomKind): number {
  return ROOM_KINDS.indexOf(kind) + 1;
}

/**
 * Objets pleins (cases CELL_PROP) : ils bloquent le passage et la vue comme un
 * mur, mais ont leur propre forme, dessinee par le decor.
 */
export type PropKind =
  | "colonne"
  | "gateau"
  | "chaudiere"
  | "lit"
  | "chariot"
  | "table"
  | "chaise"
  | "caisse"
  | "vanne-geante"
  | "comptoir";

export interface PropItem {
  kind: PropKind;
  /** Rectangle occupe, bornes incluses, en cases. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /**
   * 0 a 3. Index dans PROP_DIRS pour les objets orientes : lit, mur de la
   * tete de lit ; chaudiere, face de la porte du foyer ; chaise, cote vers
   * lequel on regarde une fois assis ; vanne geante, face du volant ;
   * comptoir, cote des clients. Gateau, table, chariot : teinte. Caisse :
   * hauteur de la pile (0 = une caisse... 3 = quatre) et teinte.
   * Chaise, caisse, vanne geante et colonne tiennent sur une case ; table et
   * comptoir sur une rangee de plusieurs cases.
   */
  variant: number;
}

/** Decodage du `variant` d'un lit ou d'une chaudiere. */
export const PROP_DIRS: readonly Dir[] = ["N", "S", "E", "W"];

export type Dir = "N" | "S" | "E" | "W";
export const DIRS: Record<Dir, [number, number]> = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

/** Un emplacement contre un mur : la case libre, et le mur vers lequel on regarde. */
export interface WallSpot {
  x: number;
  y: number;
  dir: Dir;
}

/**
 * Forme d'un luminaire des eclairages « hotel », « noir » et « fete » :
 * applique murale (avec `wall`), lustre et ampoule nue au plafond, baton
 * lumineux pose au sol. Absent pour les eclairages plus anciens.
 */
export type LightFixture = "applique" | "lustre" | "ampoule" | "baton";

export interface LightSpot {
  x: number;
  y: number;
  /** 0 marche, 1 morte, 2 clignote. */
  state: 0 | 1 | 2;
  /** Pour l'eclairage de secours et les appliques : accrochee a un mur plutot qu'au plafond. */
  wall?: Dir;
  fixture?: LightFixture;
  /** Couleur propre du luminaire (hex), a la place de `lamp.color` du niveau. */
  tint?: number;
}

/**
 * Ou se trouve l'ampoule d'un luminaire : hauteur au-dessus du sol (m) et,
 * pour une applique, distance au mur (m). Le decor dessine le corps du
 * luminaire (bras, abat-jour, chaine) autour de ce point ; la scene y pose
 * l'ampoule qui s'allume et la lumiere.
 */
export function fixtureBulb(fixture: LightFixture, wallHeight: number): { y: number; inset: number } {
  switch (fixture) {
    case "applique":
      return { y: Math.min(2.05, wallHeight - 0.6), inset: 0.2 };
    case "lustre":
      return { y: wallHeight - 0.95, inset: 0 };
    case "ampoule":
      return { y: wallHeight - 0.55, inset: 0 };
    default:
      return { y: 0.04, inset: 0 };
  }
}

export type PickupKind = "eau" | "pile" | "fusible";

/**
 * Decor sans collision : plaque contre un mur, pose a plat au sol, ou accroche
 * au plafond. Rien de ce qui est ici ne bloque le passage — seuls les
 * obstacles du niveau « ! » (des cases pleines) sont dessines comme des objets.
 */
export type DecorKind =
  | "extincteur"
  | "affiche"
  | "gyrophare"
  | "boitier"
  | "ventilation"
  | "manometre"
  | "griffures"
  | "flaque"
  | "papiers"
  | "grille"
  | "palette"
  | "dalle"
  | "cables"
  // Niveaux 5, 6 et Fun.
  | "porte"
  | "tableau"
  | "traces"
  | "confettis"
  | "cadeau"
  | "ballon"
  | "ballons"
  | "guirlande";

export type DecorPlace = "mur" | "sol" | "plafond";

export interface DecorItem {
  kind: DecorKind;
  x: number;
  y: number;
  /** Pour un objet au mur (ou une palette) : le mur vers lequel il est tourne. */
  dir: Dir;
  /**
   * 0 a 3 : texte d'affiche, taille de flaque, orientation... Pour une porte de
   * chambre, c'est son numero (101, 102...). Pour une guirlande, la parite
   * donne le sens : pair, tendue d'est en ouest ; impair, du nord au sud.
   */
  variant: number;
}

export const DECOR_PLACE: Record<DecorKind, DecorPlace> = {
  extincteur: "mur",
  affiche: "mur",
  gyrophare: "mur",
  boitier: "mur",
  ventilation: "mur",
  manometre: "mur",
  griffures: "mur",
  flaque: "sol",
  papiers: "sol",
  grille: "sol",
  palette: "sol",
  dalle: "plafond",
  cables: "plafond",
  porte: "mur",
  tableau: "mur",
  traces: "sol",
  confettis: "sol",
  cadeau: "sol",
  ballon: "sol",
  ballons: "plafond",
  guirlande: "plafond",
};

/** Densite de chaque decor, en « un pour N cases libres », niveau par niveau. */
const DECOR_PLAN: Record<LevelId, [DecorKind, number][]> = {
  // Le Hall reste vide, c'est son horreur : juste des traces de vie.
  "niveau-0": [
    ["ventilation", 80],
    ["flaque", 110],
    ["papiers", 150],
    ["dalle", 120],
    ["affiche", 380],
  ],
  "niveau-1": [
    ["palette", 70],
    ["boitier", 130],
    ["extincteur", 160],
    ["flaque", 110],
    ["cables", 100],
    ["affiche", 300],
  ],
  "niveau-2": [
    ["manometre", 60],
    ["grille", 55],
    ["griffures", 85],
    ["boitier", 170],
    ["affiche", 260],
  ],
  // Le couloir de la course : panneaux de fuite, extincteurs, et les traces
  // de ceux qui sont passes avant.
  "niveau-3": [
    ["cables", 55],
    ["boitier", 70],
    ["manometre", 130],
    ["griffures", 120],
    ["extincteur", 150],
    ["flaque", 160],
    ["affiche", 220],
  ],
  // Bureaux : des feuilles partout, des dalles de plafond tombees.
  "niveau-4": [
    ["papiers", 40],
    ["dalle", 70],
    ["ventilation", 110],
    ["affiche", 120],
    ["extincteur", 180],
    ["flaque", 220],
  ],
  "niveau-37": [
    ["grille", 45],
    ["ventilation", 90],
    ["dalle", 150],
    ["affiche", 200],
  ],
  "niveau-run": [
    ["papiers", 11],
    ["griffures", 16],
    ["flaque", 18],
    ["affiche", 20],
    ["extincteur", 26],
    ["cables", 24],
    ["grille", 30],
  ],
  // Hotel : des tableaux partout, et les traces de ce qui rode dans les couloirs.
  // (Les portes de chambres sont posees a part, en rangees numerotees.)
  "niveau-5": [
    ["tableau", 45],
    ["affiche", 170],
    ["papiers", 140],
    ["griffures", 220],
    ["flaque", 260],
  ],
  // Lumieres eteintes : des empreintes de pattes, des griffures, rien d'autre.
  "niveau-6": [
    ["traces", 40],
    ["griffures", 55],
    ["flaque", 80],
    ["papiers", 110],
    ["cables", 90],
    ["ventilation", 130],
    ["grille", 150],
    ["affiche", 300],
  ],
  "niveau-fun": [
    ["confettis", 14],
    ["ballon", 26],
    ["ballons", 34],
    ["cadeau", 40],
    ["guirlande", 45],
    ["affiche", 90],
  ],
};

export interface ArrowDecal extends WallSpot {
  /** Sens de la fleche, vu face au mur. */
  arrow: "gauche" | "droite";
  /** Une fleche sur six ment. */
  lie: boolean;
}

export interface LevelData {
  def: LevelDef;
  width: number;
  height: number;
  cells: Uint8Array;
  start: { x: number; y: number };
  /** Lacet de depart, dans la convention de la camera (0 = regarde vers -z). */
  startYaw: number;
  exit: WallSpot;
  lights: LightSpot[];
  pickups: { kind: PickupKind; x: number; y: number }[];
  /** Vannes du niveau 2, contre les murs. */
  valves: WallSpot[];
  arrows: ArrowDecal[];
  /** Case de depart de l'entite (null au niveau 0). */
  entityStart: { x: number; y: number } | null;
  /** Distance BFS depuis le depart, -1 si inaccessible. */
  distance: Int32Array;
  /** Lignes du rez-de-chaussee. Toute la carte si le niveau n'a pas d'etage. */
  groundRows: number;
  /** Lignes de la cage d'escalier (0 sans etage) ; l'etage commence juste apres. */
  stairRows: number;
  /** Colonnes de chaque escalier (trois cases de large). */
  stairs: { x0: number; x1: number }[];
  decor: DecorItem[];
  /**
   * Bassins du niveau 37 (dont le bassin profond) et salle inondee du niveau
   * 6 : 1 = eau peu profonde (on y marche, lentement).
   */
  water: Uint8Array;
  /** Salle marquante de chaque case : 0 aucune, sinon index dans ROOM_KINDS + 1 (voir zoneKind). */
  zones: Uint8Array;
  /** Salles marquantes (vides aux niveaux 3 et « ! »). */
  rooms: RoomMark[];
  /** Objets pleins (cases CELL_PROP), dessines par le decor. */
  props: PropItem[];
  /**
   * Silhouettes decoratives immobiles (Fetards qui dansent, niveau Fun), au
   * centre de leur case. Elles ne bloquent rien et ne sont PAS l'entite.
   */
  figures: { x: number; y: number; yaw: number }[];
}

/**
 * Hauteur du sol sous une position (en cases). Comme au Manoir, la grille
 * reste plate : l'etage est « plus loin » vers le sud, et la cage d'escalier
 * fait monter le sol d'une hauteur de mur. On ne voit jamais les deux zones
 * cote a cote : un bandeau de murs pleins les separe.
 */
export function floorYAt(data: Pick<LevelData, "groundRows" | "stairRows"> & { def: Pick<LevelDef, "wallHeight"> }, z: number): number {
  if (data.stairRows <= 0 || z <= data.groundRows) return 0;
  if (z >= data.groundRows + data.stairRows) return data.def.wallHeight;
  return ((z - data.groundRows) / data.stairRows) * data.def.wallHeight;
}

/** Generateur pseudo-aleatoire a graine : une meme graine redonne le meme niveau. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function isSolidCell(cells: Uint8Array, w: number, h: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= w || y >= h) return true;
  return cells[y * w + x] !== CELL_OPEN;
}

export function bfsDistances(cells: Uint8Array, w: number, h: number, sx: number, sy: number): Int32Array {
  const dist = new Int32Array(w * h).fill(-1);
  if (isSolidCell(cells, w, h, sx, sy)) return dist;
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  dist[sy * w + sx] = 0;
  queue[tail++] = sy * w + sx;
  while (head < tail) {
    const i = queue[head++];
    const x = i % w;
    const y = (i - x) / w;
    const d = dist[i] + 1;
    if (x > 0 && cells[i - 1] === CELL_OPEN && dist[i - 1] < 0) {
      dist[i - 1] = d;
      queue[tail++] = i - 1;
    }
    if (x < w - 1 && cells[i + 1] === CELL_OPEN && dist[i + 1] < 0) {
      dist[i + 1] = d;
      queue[tail++] = i + 1;
    }
    if (y > 0 && cells[i - w] === CELL_OPEN && dist[i - w] < 0) {
      dist[i - w] = d;
      queue[tail++] = i - w;
    }
    if (y < h - 1 && cells[i + w] === CELL_OPEN && dist[i + w] < 0) {
      dist[i + w] = d;
      queue[tail++] = i + w;
    }
  }
  return dist;
}

/**
 * Relie toute case libre isolee au reste : on creuse un couloir en L jusqu'a
 * la case accessible la plus proche. Filet de securite des generateurs.
 */
function ensureConnected(cells: Uint8Array, w: number, h: number, sx: number, sy: number) {
  for (let guard = 0; guard < 400; guard++) {
    const dist = bfsDistances(cells, w, h, sx, sy);
    let lost = -1;
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] === CELL_OPEN && dist[i] < 0) {
        lost = i;
        break;
      }
    }
    if (lost < 0) return;
    const lx = lost % w;
    const ly = (lost - lx) / w;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < cells.length; i++) {
      if (dist[i] < 0) continue;
      const x = i % w;
      const y = (i - x) / w;
      const d = Math.abs(x - lx) + Math.abs(y - ly);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0) return;
    const bx = best % w;
    const by = (best - bx) / w;
    let x = lx;
    let y = ly;
    while (x !== bx) {
      x += Math.sign(bx - x);
      if (x > 0 && x < w - 1 && y > 0 && y < h - 1) cells[y * w + x] = CELL_OPEN;
    }
    while (y !== by) {
      y += Math.sign(by - y);
      if (x > 0 && x < w - 1 && y > 0 && y < h - 1) cells[y * w + x] = CELL_OPEN;
    }
  }
}

function border(cells: Uint8Array, w: number, h: number) {
  for (let x = 0; x < w; x++) {
    cells[x] = CELL_WALL;
    cells[(h - 1) * w + x] = CELL_WALL;
  }
  for (let y = 0; y < h; y++) {
    cells[y * w] = CELL_WALL;
    cells[y * w + w - 1] = CELL_WALL;
  }
}

/**
 * Treillis de murs : des cloisons tous les `block` cases, percees de portes,
 * parfois supprimees pour ouvrir de grandes salles. C'est l'ossature des
 * niveaux 0 et 1 — des bureaux vides a perte de vue.
 */
function lattice(
  cells: Uint8Array,
  w: number,
  h: number,
  rng: () => number,
  block: number,
  opts: { removeChance: number; gapMin: number; gapMax: number; extraGapChance: number },
) {
  // Cloisons verticales
  for (let lx = block; lx < w - 1; lx += block) {
    for (let y0 = 1; y0 < h - 1; y0 += block) {
      const y1 = Math.min(h - 2, y0 + block - 2);
      if (rng() < opts.removeChance) continue;
      for (let y = y0 - 1; y <= y1 + 1; y++) if (y > 0 && y < h - 1) cells[y * w + lx] = CELL_WALL;
      const gaps = rng() < opts.extraGapChance ? 2 : 1;
      for (let g = 0; g < gaps; g++) {
        const size = randInt(rng, opts.gapMin, opts.gapMax);
        const at = randInt(rng, y0, Math.max(y0, y1 - size + 1));
        for (let y = at; y < at + size && y <= y1; y++) cells[y * w + lx] = CELL_OPEN;
      }
    }
  }
  // Cloisons horizontales
  for (let ly = block; ly < h - 1; ly += block) {
    for (let x0 = 1; x0 < w - 1; x0 += block) {
      const x1 = Math.min(w - 2, x0 + block - 2);
      if (rng() < opts.removeChance) continue;
      for (let x = x0 - 1; x <= x1 + 1; x++) if (x > 0 && x < w - 1) cells[ly * w + x] = CELL_WALL;
      const gaps = rng() < opts.extraGapChance ? 2 : 1;
      for (let g = 0; g < gaps; g++) {
        const size = randInt(rng, opts.gapMin, opts.gapMax);
        const at = randInt(rng, x0, Math.max(x0, x1 - size + 1));
        for (let x = at; x < at + size && x <= x1; x++) cells[ly * w + x] = CELL_OPEN;
      }
    }
  }
}

/** Toutes les cases voisines (8) sont libres : on peut y poser un pilier sans boucher un passage. */
function surroundedByOpen(cells: Uint8Array, w: number, h: number, x: number, y: number, r = 1): boolean {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (isSolidCell(cells, w, h, x + dx, y + dy)) return false;
    }
  }
  return true;
}

function genHall(w: number, h: number, rng: () => number): Uint8Array {
  const cells = new Uint8Array(w * h);
  border(cells, w, h);
  lattice(cells, w, h, rng, 7, { removeChance: 0.26, gapMin: 2, gapMax: 3, extraGapChance: 0.35 });
  // Bouts de cloison qui s'avancent dans les pieces : ce qui rend le Hall si
  // desorientant, aucune piece n'a la meme forme.
  for (let i = 0; i < w * h * 0.018; i++) {
    const x = randInt(rng, 2, w - 3);
    const y = randInt(rng, 2, h - 3);
    if (!surroundedByOpen(cells, w, h, x, y)) continue;
    const horizontal = rng() < 0.5;
    const len = randInt(rng, 2, 4);
    for (let k = 0; k < len; k++) {
      const cx = horizontal ? x + k : x;
      const cy = horizontal ? y : y + k;
      if (cx >= w - 1 || cy >= h - 1) break;
      cells[cy * w + cx] = CELL_WALL;
    }
  }
  // Piliers isoles dans les grandes salles.
  for (let y = 2; y < h - 2; y += 3) {
    for (let x = 2; x < w - 2; x += 3) {
      if (rng() < 0.22 && surroundedByOpen(cells, w, h, x, y)) cells[y * w + x] = CELL_PILLAR;
    }
  }
  return cells;
}

function genWarehouse(w: number, h: number, rng: () => number): Uint8Array {
  const cells = new Uint8Array(w * h);
  border(cells, w, h);
  lattice(cells, w, h, rng, 12, { removeChance: 0.32, gapMin: 3, gapMax: 5, extraGapChance: 0.6 });
  // Piliers de beton, en grille reguliere : c'est un entrepot.
  for (let y = 3; y < h - 2; y += 4) {
    for (let x = 3; x < w - 2; x += 4) {
      if (surroundedByOpen(cells, w, h, x, y)) cells[y * w + x] = CELL_PILLAR;
    }
  }
  // Rayonnages : des rangees d'etageres avec des allees entre elles.
  for (let i = 0; i < 18; i++) {
    const x0 = randInt(rng, 3, w - 10);
    const y0 = randInt(rng, 3, h - 10);
    const vertical = rng() < 0.5;
    const rows = randInt(rng, 2, 3);
    const len = randInt(rng, 4, 7);
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < len; k++) {
        const cx = vertical ? x0 + r * 3 : x0 + k;
        const cy = vertical ? y0 + k : y0 + r * 3;
        if (cx <= 1 || cy <= 1 || cx >= w - 2 || cy >= h - 2) continue;
        if (cells[cy * w + cx] === CELL_OPEN) cells[cy * w + cx] = CELL_RACK;
      }
    }
  }
  return cells;
}

function genPipes(w: number, h: number, rng: () => number): Uint8Array {
  // Labyrinthe parfait sur une grille grossiere (une case sur deux), puis on
  // abat des cloisons : sans boucles, la chose te coinçait a chaque cul-de-sac.
  const cells = new Uint8Array(w * h).fill(CELL_WALL);
  const mw = (w - 1) / 2;
  const mh = (h - 1) / 2;
  const seen = new Uint8Array(mw * mh);
  const stack: number[] = [0];
  seen[0] = 1;
  cells[1 * w + 1] = CELL_OPEN;
  while (stack.length > 0) {
    const cur = stack[stack.length - 1];
    const cx = cur % mw;
    const cy = (cur - cx) / mw;
    const options: [number, number][] = [];
    for (const [dx, dy] of Object.values(DIRS)) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= mw || ny >= mh || seen[ny * mw + nx]) continue;
      options.push([nx, ny]);
    }
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const [nx, ny] = options[Math.floor(rng() * options.length)];
    seen[ny * mw + nx] = 1;
    cells[(2 * ny + 1) * w + (2 * nx + 1)] = CELL_OPEN;
    cells[(cy + ny + 1) * w + (cx + nx + 1)] = CELL_OPEN;
    stack.push(ny * mw + nx);
  }
  // Boucles.
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (cells[y * w + x] !== CELL_WALL) continue;
      const horiz = !isSolidCell(cells, w, h, x - 1, y) && !isSolidCell(cells, w, h, x + 1, y);
      const vert = !isSolidCell(cells, w, h, x, y - 1) && !isSolidCell(cells, w, h, x, y + 1);
      if ((horiz || vert) && rng() < 0.14) cells[y * w + x] = CELL_OPEN;
    }
  }
  // Quelques salles des machines, pour respirer.
  for (let i = 0; i < 6; i++) {
    const x0 = randInt(rng, 2, w - 6);
    const y0 = randInt(rng, 2, h - 6);
    for (let y = y0; y < y0 + 3; y++) for (let x = x0; x < x0 + 3; x++) cells[y * w + x] = CELL_OPEN;
  }
  border(cells, w, h);
  return cells;
}

/**
 * Niveau 3 : un treillis de couloirs de brique etroits, et des machines
 * (transformateurs, generateurs) plantees au milieu des salles.
 */
function genPlant(w: number, h: number, rng: () => number): Uint8Array {
  const cells = new Uint8Array(w * h);
  border(cells, w, h);
  lattice(cells, w, h, rng, 9, { removeChance: 0.2, gapMin: 2, gapMax: 2, extraGapChance: 0.35 });
  for (let i = 0; i < w * h * 0.06; i++) {
    const bw = randInt(rng, 2, 3);
    const bh = randInt(rng, 1, 3);
    const x0 = randInt(rng, 2, w - bw - 3);
    const y0 = randInt(rng, 2, h - bh - 3);
    let free = true;
    // Une case de marge tout autour : une machine ne bouche jamais une porte.
    for (let y = y0 - 1; y <= y0 + bh && free; y++) {
      for (let x = x0 - 1; x <= x0 + bw; x++) {
        if (isSolidCell(cells, w, h, x, y)) {
          free = false;
          break;
        }
      }
    }
    if (!free) continue;
    for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) cells[y * w + x] = CELL_RACK;
  }
  return cells;
}

/**
 * Niveau 4 : de grands plateaux de bureaux. Les postes de travail vont par
 * rangees de deux (dos a dos), avec une allee entre chaque rangee.
 */
function genOffice(w: number, h: number, rng: () => number): Uint8Array {
  const cells = new Uint8Array(w * h);
  border(cells, w, h);
  lattice(cells, w, h, rng, 15, { removeChance: 0.3, gapMin: 3, gapMax: 4, extraGapChance: 0.7 });
  for (let y0 = 3; y0 < h - 4; y0 += 4) {
    for (let x0 = 3; x0 < w - 4; ) {
      const len = randInt(rng, 3, 6);
      if (rng() < 0.75 && x0 + len < w - 2) {
        let free = true;
        for (let y = y0 - 1; y <= y0 + 2 && free; y++) {
          for (let x = x0 - 1; x <= x0 + len; x++) {
            if (isSolidCell(cells, w, h, x, y)) {
              free = false;
              break;
            }
          }
        }
        if (free) {
          for (let y = y0; y < y0 + 2; y++) for (let x = x0; x < x0 + len; x++) cells[y * w + x] = CELL_RACK;
        }
      }
      x0 += len + randInt(rng, 2, 3);
    }
  }
  return cells;
}

/** Niveau 37 : de grandes salles carrelees, des arches larges et des colonnes. */
function genPools(w: number, h: number, rng: () => number): Uint8Array {
  const cells = new Uint8Array(w * h);
  border(cells, w, h);
  lattice(cells, w, h, rng, 11, { removeChance: 0.42, gapMin: 3, gapMax: 6, extraGapChance: 0.55 });
  for (let y = 3; y < h - 2; y += 4) {
    for (let x = 3; x < w - 2; x += 4) {
      if (rng() < 0.4 && surroundedByOpen(cells, w, h, x, y)) cells[y * w + x] = CELL_PILLAR;
    }
  }
  return cells;
}

/**
 * Le niveau « ! » : un couloir en serpentin de trois cases de large. Des
 * barrieres ferment deux voies sur trois : on zigzague en courant.
 */
function genRun(w: number, h: number, rng: () => number): { cells: Uint8Array; end: { x: number; y: number } } {
  const cells = new Uint8Array(w * h).fill(CELL_WALL);
  const rows: number[] = [];
  for (let y0 = 1; y0 + 2 < h - 1; y0 += 4) rows.push(y0);
  rows.forEach((y0, r) => {
    for (let y = y0; y < y0 + 3; y++) for (let x = 1; x < w - 1; x++) cells[y * w + x] = CELL_OPEN;
    // Virage vers la rangee suivante, alternativement a droite et a gauche.
    if (r < rows.length - 1) {
      const turnRight = r % 2 === 0;
      for (let x = turnRight ? w - 4 : 1; x < (turnRight ? w - 1 : 4); x++) cells[(y0 + 3) * w + x] = CELL_OPEN;
    }
    // Barrieres : deux voies sur trois, jamais trop pres des virages.
    for (let x = 6; x < w - 6; x += randInt(rng, 5, 7)) {
      const keep = randInt(rng, 0, 2);
      for (let lane = 0; lane < 3; lane++) {
        if (lane !== keep) cells[(y0 + lane) * w + x] = CELL_PILLAR;
      }
    }
  });
  const lastRow = rows[rows.length - 1];
  const endRight = (rows.length - 1) % 2 === 0;
  return { cells, end: { x: endRight ? w - 2 : 1, y: lastRow + 1 } };
}

// ---------------------------------------------------------------------------
// Salles marquantes (niveaux 5, 6 et Fun)
// ---------------------------------------------------------------------------
//
// Des gabarits imprimes dans la grille : une salle de bal, un couloir sans
// fin, une piste de danse... Chaque salle garde sa zone (pour le decor et
// l'eclairage) et ses objets pleins. Les gabarits et les objets ont chacun
// leur generateur a part : les retoucher ne deplace pas le reste du niveau.

/** Un etage genere, avec ses salles marquantes et ses objets pleins. */
interface FloorPlan {
  cells: Uint8Array;
  zones: Uint8Array;
  rooms: RoomMark[];
  props: PropItem[];
}

/**
 * Marge (en lignes) entre une salle marquante et le haut ou le bas d'un
 * etage : les paliers d'escalier y sont degages apres coup, ils ne doivent
 * rien couper.
 */
const ROOM_MARGIN = 5;

function newPlan(w: number, h: number, fill: number): FloorPlan {
  return { cells: new Uint8Array(w * h).fill(fill), zones: new Uint8Array(w * h), rooms: [], props: [] };
}

/** Le rectangle (ceinture de murs comprise, plus `gap` cases) ne touche aucune salle deja posee. */
function roomFits(plan: FloorPlan, x0: number, y0: number, x1: number, y1: number, gap: number): boolean {
  return plan.rooms.every(
    (r) => x1 + 1 + gap < r.x0 - 1 || x0 - 1 - gap > r.x1 + 1 || y1 + 1 + gap < r.y0 - 1 || y0 - 1 - gap > r.y1 + 1,
  );
}

/**
 * Cherche une place pour une salle de rw x rh cases (interieur). Si l'etage
 * est trop encombre, la salle retrecit d'une case a la fois, jusqu'au minimum.
 */
function findRoomSpot(
  plan: FloorPlan,
  w: number,
  h: number,
  rw: number,
  rh: number,
  minW: number,
  minH: number,
  rng: () => number,
): { x0: number; y0: number; rw: number; rh: number } | null {
  let cw = rw;
  let ch = rh;
  for (;;) {
    const xMax = w - 3 - cw;
    const yMax = h - ROOM_MARGIN - ch;
    if (xMax >= 3 && yMax >= ROOM_MARGIN) {
      for (let t = 0; t < 80; t++) {
        const x0 = randInt(rng, 3, xMax);
        const y0 = randInt(rng, ROOM_MARGIN, yMax);
        if (roomFits(plan, x0, y0, x0 + cw - 1, y0 + ch - 1, 2)) return { x0, y0, rw: cw, rh: ch };
      }
    }
    if (cw <= minW && ch <= minH) return null;
    cw = Math.max(minW, cw - 1);
    ch = Math.max(minH, ch - 1);
  }
}

/**
 * Depuis une ouverture percee dans la ceinture d'une salle, creuse vers
 * l'exterieur jusqu'a retrouver une case libre (au plus `max` cases) : la
 * salle est reliee au reste de l'etage sans attendre le filet de securite.
 */
function carveOut(plan: FloorPlan, w: number, h: number, x: number, y: number, dx: number, dy: number, max = 8) {
  for (let k = 0; k < max; k++) {
    x += dx;
    y += dy;
    if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1) return;
    const i = y * w + x;
    if (plan.cells[i] === CELL_OPEN || plan.zones[i] !== 0) return;
    plan.cells[i] = CELL_OPEN;
  }
}

/**
 * Imprime une salle marquante : interieur degage, ceinture de murs, puis
 * `doors` ouvertures de `doorWidth` cases, chacune sur un cote different tant
 * qu'il en reste, et prolongee jusqu'au reste de l'etage.
 */
function stampRoom(
  plan: FloorPlan,
  w: number,
  h: number,
  kind: RoomKind,
  x0: number,
  y0: number,
  rw: number,
  rh: number,
  rng: () => number,
  doors: number,
  doorWidth: number,
): RoomMark {
  const x1 = x0 + rw - 1;
  const y1 = y0 + rh - 1;
  const zone = zoneCode(kind);
  for (let y = y0 - 1; y <= y1 + 1; y++) {
    for (let x = x0 - 1; x <= x1 + 1; x++) {
      const inside = x >= x0 && x <= x1 && y >= y0 && y <= y1;
      plan.cells[y * w + x] = inside ? CELL_OPEN : CELL_WALL;
      plan.zones[y * w + x] = inside ? zone : 0;
    }
  }
  const sides: Dir[] = ["N", "S", "E", "W"];
  for (let i = sides.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [sides[i], sides[j]] = [sides[j], sides[i]];
  }
  for (let d = 0; d < doors; d++) {
    const [dx, dy] = DIRS[sides[d % 4]];
    // Ouverture sur un cote nord ou sud : elle s'etend le long de x.
    const alongX = dy !== 0;
    const lo = alongX ? x0 + 1 : y0 + 1;
    const hi = (alongX ? x1 - 1 : y1 - 1) - (doorWidth - 1);
    const at = randInt(rng, lo, Math.max(lo, hi));
    for (let k = 0; k < doorWidth; k++) {
      const px = alongX ? at + k : dx > 0 ? x1 + 1 : x0 - 1;
      const py = alongX ? (dy > 0 ? y1 + 1 : y0 - 1) : at + k;
      if (alongX ? px > x1 : py > y1) break;
      plan.cells[py * w + px] = CELL_OPEN;
      carveOut(plan, w, h, px, py, dx, dy);
    }
  }
  const room: RoomMark = { kind, x0, y0, x1, y1 };
  plan.rooms.push(room);
  return room;
}

/**
 * Couloir marquant : ceinture de murs, grand ouvert a ses deux bouts, et une
 * seule porte laterale vers son milieu si `middle`.
 */
function stampCorridor(
  plan: FloorPlan,
  w: number,
  h: number,
  kind: RoomKind,
  x0: number,
  y0: number,
  rw: number,
  rh: number,
  rng: () => number,
  middle: boolean,
): RoomMark {
  const room = stampRoom(plan, w, h, kind, x0, y0, rw, rh, rng, 0, 1);
  const horizontal = rw >= rh;
  if (horizontal) {
    for (let y = room.y0; y <= room.y1; y++) {
      plan.cells[y * w + room.x0 - 1] = CELL_OPEN;
      carveOut(plan, w, h, room.x0 - 1, y, -1, 0);
      plan.cells[y * w + room.x1 + 1] = CELL_OPEN;
      carveOut(plan, w, h, room.x1 + 1, y, 1, 0);
    }
  } else {
    for (let x = room.x0; x <= room.x1; x++) {
      plan.cells[(room.y0 - 1) * w + x] = CELL_OPEN;
      carveOut(plan, w, h, x, room.y0 - 1, 0, -1);
      plan.cells[(room.y1 + 1) * w + x] = CELL_OPEN;
      carveOut(plan, w, h, x, room.y1 + 1, 0, 1);
    }
  }
  if (middle) {
    const side = rng() < 0.5 ? -1 : 1;
    if (horizontal) {
      const mx = Math.floor((room.x0 + room.x1) / 2) + randInt(rng, -2, 2);
      const py = side < 0 ? room.y0 - 1 : room.y1 + 1;
      plan.cells[py * w + mx] = CELL_OPEN;
      carveOut(plan, w, h, mx, py, 0, side);
    } else {
      const my = Math.floor((room.y0 + room.y1) / 2) + randInt(rng, -2, 2);
      const px = side < 0 ? room.x0 - 1 : room.x1 + 1;
      plan.cells[my * w + px] = CELL_OPEN;
      carveOut(plan, w, h, px, my, side, 0);
    }
  }
  return room;
}

/** Toutes les cases libres de l'etage communiquent entre elles. */
function allConnected(cells: Uint8Array, w: number, h: number): boolean {
  const first = cells.indexOf(CELL_OPEN);
  if (first < 0) return true;
  const dist = bfsDistances(cells, w, h, first % w, Math.floor(first / w));
  for (let i = 0; i < cells.length; i++) if (cells[i] === CELL_OPEN && dist[i] < 0) return false;
  return true;
}

/**
 * Pose un objet plein si toutes ses cases sont libres et si l'etage reste
 * d'un seul tenant : un lit ne bouche jamais la seule porte d'une chambre.
 */
function placeProp(plan: FloorPlan, w: number, h: number, kind: PropKind, x0: number, y0: number, pw: number, ph: number, variant: number): boolean {
  const x1 = x0 + pw - 1;
  const y1 = y0 + ph - 1;
  if (x0 < 1 || y0 < 1 || x1 > w - 2 || y1 > h - 2) return false;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (plan.cells[y * w + x] !== CELL_OPEN) return false;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) plan.cells[y * w + x] = CELL_PROP;
  if (!allConnected(plan.cells, w, h)) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) plan.cells[y * w + x] = CELL_OPEN;
    return false;
  }
  plan.props.push({ kind, x0, y0, x1, y1, variant });
  return true;
}

/** Relie tout l'etage, a partir de sa premiere case libre. */
function connectPlan(plan: FloorPlan, w: number, h: number) {
  const first = plan.cells.indexOf(CELL_OPEN);
  if (first >= 0) ensureConnected(plan.cells, w, h, first % w, Math.floor(first / w));
}

// ---------------------------------------------------------------------------
// Les sept salles ajoutees aux anciens niveaux (et au hall de l'hotel)
// ---------------------------------------------------------------------------
//
// Meme principe que les salles des niveaux 5, 6 et Fun, avec deux generateurs
// de plus : `srng` pour les gabarits, `orng` pour les objets pleins. Ils sont
// tires apres le reste de l'etage : l'ossature d'une graine ne bouge pas, les
// salles s'impriment par-dessus.

/** Salles ajoutees, niveau par niveau, de la plus grande a la plus petite. */
const EXTRA_ROOMS: Partial<Record<LevelId, RoomKind[]>> = {
  "niveau-0": ["neons-morts", "chaise-seule"],
  "niveau-1": ["caisses"],
  "niveau-2": ["vannes"],
  "niveau-4": ["reunion"],
  "niveau-37": ["bassin-profond"],
  "niveau-5": ["reception"],
};

/** Cotes de la ceinture d'une salle perces d'au moins une ouverture. */
function doorSides(cells: Uint8Array, w: number, r: RoomMark): Dir[] {
  const open = (x: number, y: number) => cells[y * w + x] === CELL_OPEN;
  const out: Dir[] = [];
  let n = false;
  let s = false;
  let e = false;
  let o = false;
  for (let x = r.x0; x <= r.x1; x++) {
    if (open(x, r.y0 - 1)) n = true;
    if (open(x, r.y1 + 1)) s = true;
  }
  for (let y = r.y0; y <= r.y1; y++) {
    if (open(r.x1 + 1, y)) e = true;
    if (open(r.x0 - 1, y)) o = true;
  }
  if (n) out.push("N");
  if (s) out.push("S");
  if (e) out.push("E");
  if (o) out.push("W");
  return out;
}

/** Imprime le gabarit d'une salle ajoutee (murs, portes, piliers), sans ses objets. */
function stampExtra(plan: FloorPlan, w: number, h: number, kind: RoomKind, srng: () => number): RoomMark | null {
  const spotFor = (rw: number, rh: number, minW: number, minH: number) => findRoomSpot(plan, w, h, rw, rh, minW, minH, srng);
  switch (kind) {
    case "chaise-seule": {
      // Petite, carree, une seule porte : la chaise est au centre exact.
      const spot = spotFor(5, 5, 5, 5);
      return spot ? stampRoom(plan, w, h, kind, spot.x0, spot.y0, spot.rw, spot.rh, srng, 1, 1) : null;
    }
    case "neons-morts": {
      const spot = spotFor(randInt(srng, 14, 18), randInt(srng, 10, 12), 10, 8);
      if (!spot) return null;
      const room = stampRoom(plan, w, h, kind, spot.x0, spot.y0, spot.rw, spot.rh, srng, 3, 2);
      // Quelques piliers, comme ailleurs dans le Hall : on ne voit jamais le fond.
      for (let y = room.y0 + 3; y <= room.y1 - 3; y += 4) {
        for (let x = room.x0 + 3; x <= room.x1 - 3; x += 4) if (srng() < 0.55) plan.cells[y * w + x] = CELL_PILLAR;
      }
      return room;
    }
    case "caisses": {
      const spot = spotFor(randInt(srng, 13, 15), randInt(srng, 11, 13), 9, 7);
      return spot ? stampRoom(plan, w, h, kind, spot.x0, spot.y0, spot.rw, spot.rh, srng, 3, 2) : null;
    }
    case "vannes": {
      const spot = spotFor(randInt(srng, 9, 11), randInt(srng, 7, 8), 7, 6);
      return spot ? stampRoom(plan, w, h, kind, spot.x0, spot.y0, spot.rw, spot.rh, srng, 2, 1) : null;
    }
    case "reunion": {
      const spot = spotFor(randInt(srng, 9, 11), 7, 7, 7);
      return spot ? stampRoom(plan, w, h, kind, spot.x0, spot.y0, spot.rw, spot.rh, srng, 2, 1) : null;
    }
    case "bassin-profond": {
      const spot = spotFor(randInt(srng, 10, 12), randInt(srng, 8, 10), 8, 7);
      return spot ? stampRoom(plan, w, h, kind, spot.x0, spot.y0, spot.rw, spot.rh, srng, 3, 2) : null;
    }
    case "reception": {
      const spot = spotFor(randInt(srng, 11, 13), randInt(srng, 8, 9), 9, 7);
      return spot ? stampRoom(plan, w, h, kind, spot.x0, spot.y0, spot.rw, spot.rh, srng, 3, 2) : null;
    }
    default:
      return null;
  }
}

/** Imprime toutes les salles ajoutees demandees sur cet etage ; renvoie celles qui ont trouve leur place. */
function stampExtras(plan: FloorPlan, w: number, h: number, kinds: readonly RoomKind[], srng: () => number): RoomMark[] {
  const out: RoomMark[] = [];
  for (const kind of kinds) {
    const room = stampExtra(plan, w, h, kind, srng);
    if (room) out.push(room);
  }
  return out;
}

/**
 * Meuble une salle ajoutee. L'etage doit deja etre d'un seul tenant :
 * placeProp refuse tout objet qui couperait un passage.
 */
function furnishExtra(plan: FloorPlan, w: number, h: number, room: RoomMark, orng: () => number) {
  const { x0, y0, x1, y1 } = room;
  const rw = x1 - x0 + 1;
  const rh = y1 - y0 + 1;
  const dirIndex = (d: Dir) => PROP_DIRS.indexOf(d);
  switch (room.kind) {
    case "chaise-seule": {
      // Une chaise au centre, tournee vers la porte : elle attend quelqu'un.
      const face = doorSides(plan.cells, w, room)[0] ?? PROP_DIRS[randInt(orng, 0, 3)];
      placeProp(plan, w, h, "chaise", x0 + Math.floor(rw / 2), y0 + Math.floor(rh / 2), 1, 1, dirIndex(face));
      break;
    }
    case "caisses": {
      // Labyrinthe parfait sur les cases paires de la salle (les allees), les
      // caisses sur les autres, puis des breches pour faire des boucles. Si la
      // salle a une largeur paire, la derniere colonne reste une allee.
      const nx = Math.floor((rw - 1) / 2) + 1;
      const ny = Math.floor((rh - 1) / 2) + 1;
      const lastX = (nx - 1) * 2;
      const lastY = (ny - 1) * 2;
      const aisle = new Uint8Array(rw * rh);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) aisle[2 * j * rw + 2 * i] = 1;
      const seen = new Uint8Array(nx * ny);
      const first = randInt(orng, 0, nx * ny - 1);
      const stack: number[] = [first];
      seen[first] = 1;
      while (stack.length > 0) {
        const cur = stack[stack.length - 1];
        const ci = cur % nx;
        const cj = (cur - ci) / nx;
        const options: number[] = [];
        for (const [dx, dy] of Object.values(DIRS)) {
          const ni = ci + dx;
          const nj = cj + dy;
          if (ni < 0 || nj < 0 || ni >= nx || nj >= ny || seen[nj * nx + ni]) continue;
          options.push(nj * nx + ni);
        }
        if (options.length === 0) {
          stack.pop();
          continue;
        }
        const next = options[Math.floor(orng() * options.length)];
        const ni = next % nx;
        const nj = (next - ni) / nx;
        seen[next] = 1;
        aisle[(cj + nj) * rw + (ci + ni)] = 1;
        stack.push(next);
      }
      for (let ry = 0; ry <= lastY; ry++) {
        for (let rx = 0; rx <= lastX; rx++) {
          if (aisle[ry * rw + rx]) continue;
          // Les poteaux (deux coordonnees impaires) restent toujours pleins.
          const post = rx % 2 === 1 && ry % 2 === 1;
          const variant = randInt(orng, 0, 3);
          if (!post && orng() < 0.18) continue;
          placeProp(plan, w, h, "caisse", x0 + rx, y0 + ry, 1, 1, variant);
        }
      }
      break;
    }
    case "vannes": {
      // Deux rangees de vannes geantes, volant tourne vers l'allee du milieu
      // (une seule rangee si la salle est trop basse).
      const rows = rh >= 7 ? [y0 + 2, y1 - 2] : [y0 + Math.floor(rh / 2)];
      rows.forEach((y, k) => {
        const face: Dir = rows.length === 1 ? (orng() < 0.5 ? "N" : "S") : k === 0 ? "S" : "N";
        for (let x = x0 + 2; x <= x1 - 2; x += 3) placeProp(plan, w, h, "vanne-geante", x, y, 1, 1, dirIndex(face));
      });
      break;
    }
    case "reunion": {
      // La grande table au milieu, des chaises tout autour (quelques-unes
      // manquent), une a chaque bout. Le tableau au mur est pose par le decor.
      const cy = y0 + Math.floor((rh - 1) / 2);
      const inset = rw >= 9 ? 3 : 2;
      const tx0 = x0 + inset;
      const tx1 = x1 - inset;
      if (tx1 < tx0 || !placeProp(plan, w, h, "table", tx0, cy, tx1 - tx0 + 1, 1, randInt(orng, 0, 3))) break;
      for (let x = tx0; x <= tx1; x++) {
        if (orng() < 0.8) placeProp(plan, w, h, "chaise", x, cy - 1, 1, 1, dirIndex("S"));
        if (orng() < 0.8) placeProp(plan, w, h, "chaise", x, cy + 1, 1, 1, dirIndex("N"));
      }
      if (orng() < 0.75) placeProp(plan, w, h, "chaise", tx0 - 1, cy, 1, 1, dirIndex("E"));
      if (orng() < 0.75) placeProp(plan, w, h, "chaise", tx1 + 1, cy, 1, 1, dirIndex("W"));
      break;
    }
    case "reception": {
      // Le comptoir court le long d'un grand mur sans porte, une rangee
      // devant lui (le personnel passe derriere par les deux bouts) ; deux
      // paires de colonnes dans le hall, et parfois un chariot a bagages.
      const doors = doorSides(plan.cells, w, room);
      const free = (["N", "S", "E", "W"] as Dir[]).filter((d) => !doors.includes(d));
      const long = free.filter((d) => (rw >= rh ? d === "N" || d === "S" : d === "E" || d === "W"));
      const pool = long.length > 0 ? long : free.length > 0 ? free : (["N"] as Dir[]);
      const back = pool[Math.floor(orng() * pool.length)];
      const along = back === "N" || back === "S" ? rw : rh;
      const depth = back === "N" || back === "S" ? rh : rw;
      // (a le long du mur du fond, d en s'en eloignant) -> case de la grille.
      const at = (a: number, d: number): [number, number] =>
        back === "N" ? [x0 + a, y0 + d] : back === "S" ? [x0 + a, y1 - d] : back === "W" ? [x0 + d, y0 + a] : [x1 - d, y0 + a];
      const opposite: Record<Dir, Dir> = { N: "S", S: "N", E: "W", W: "E" };
      if (along >= 7) {
        const [ax, ay] = at(2, 1);
        const [bx, by] = at(along - 3, 1);
        const cx0 = Math.min(ax, bx);
        const cy0 = Math.min(ay, by);
        placeProp(plan, w, h, "comptoir", cx0, cy0, Math.abs(bx - ax) + 1, Math.abs(by - ay) + 1, dirIndex(opposite[back]));
      }
      const depths = depth - 2 > 3 ? [3, depth - 2] : [3];
      for (const d of depths) {
        for (const a of [1, along - 2]) {
          const [cx, cy] = at(a, d);
          placeProp(plan, w, h, "colonne", cx, cy, 1, 1, 0);
        }
      }
      if (orng() < 0.5) {
        const [cx, cy] = at(randInt(orng, 3, Math.max(3, along - 4)), randInt(orng, 3, Math.max(3, depth - 2)));
        if (surroundedByOpen(plan.cells, w, h, cx, cy)) placeProp(plan, w, h, "chariot", cx, cy, 1, 1, randInt(orng, 0, 3));
      }
      break;
    }
    default:
      // Neons morts, bassin profond : rien de plein (piliers deja poses, eau posee plus tard).
      break;
  }
}

function furnishExtras(plan: FloorPlan, w: number, h: number, rooms: readonly RoomMark[], orng: () => number) {
  for (const room of rooms) furnishExtra(plan, w, h, room, orng);
}

/**
 * Habille un etage genere a l'ancienne (grille seule) des salles ajoutees :
 * gabarits, reliage, puis objets. Sans salle a poser, l'etage est rendu tel quel.
 */
function withExtraRooms(cells: Uint8Array, w: number, h: number, kinds: readonly RoomKind[], srng: () => number, orng: () => number): FloorPlan {
  const plan: FloorPlan = { cells, zones: new Uint8Array(w * h), rooms: [], props: [] };
  if (kinds.length === 0) return plan;
  const marks = stampExtras(plan, w, h, kinds, srng);
  if (marks.length === 0) return plan;
  connectPlan(plan, w, h);
  furnishExtras(plan, w, h, marks, orng);
  return plan;
}

/**
 * Niveau 5 : un hotel. Des couloirs etroits en grille, des chambres fermees
 * (les portes numerotees sont posees par le decor), quelques chambres
 * ouvertes et des salons. Sur chaque etage, un grand couloir de chambres
 * presque sans croisement ; au rez, la salle de bal a colonnes ; a l'etage,
 * la chaufferie et ses chaudieres. Le hall de reception (salle ajoutee,
 * `extras`) est imprime apres eux, avec ses propres generateurs.
 */
function genHotel(
  w: number,
  h: number,
  rng: () => number,
  trng: () => number,
  prng: () => number,
  floor: number,
  extras: readonly RoomKind[],
  srng: () => number,
  orng: () => number,
): FloorPlan {
  const plan = newPlan(w, h, CELL_WALL);
  const { cells, zones } = plan;
  const cols: number[] = [];
  for (let x = 2; x <= w - 3; x += randInt(rng, 6, 8)) cols.push(x);
  const rows: number[] = [];
  for (let y = 2; y <= h - 3; y += randInt(rng, 5, 7)) rows.push(y);
  const xa = cols[0];
  const xb = cols[cols.length - 1];
  const ya = rows[0];
  const yb = rows[rows.length - 1];
  for (const x of cols) for (let y = ya; y <= yb; y++) cells[y * w + x] = CELL_OPEN;
  for (const y of rows) for (let x = xa; x <= xb; x++) cells[y * w + x] = CELL_OPEN;
  // Quelques troncons condamnes : des culs-de-sac, comme dans un vrai hotel.
  for (const x of cols) {
    for (let r = 0; r + 1 < rows.length; r++) {
      if (rng() < 0.1) for (let y = rows[r] + 1; y < rows[r + 1]; y++) cells[y * w + x] = CELL_WALL;
    }
  }
  for (const y of rows) {
    for (let c = 0; c + 1 < cols.length; c++) {
      if (rng() < 0.1) for (let x = cols[c] + 1; x < cols[c + 1]; x++) cells[y * w + x] = CELL_WALL;
    }
  }

  // Le grand couloir des chambres : une rangee entiere, trois passages
  // seulement (aux bouts et vers le milieu). Ailleurs, les couloirs
  // perpendiculaires butent contre une porte.
  const eligible = rows.filter((y, r) => r > 0 && r < rows.length - 1 && y >= ROOM_MARGIN && y <= h - 1 - ROOM_MARGIN);
  let longRow = -1;
  if (eligible.length > 0) {
    longRow = eligible[Math.floor(trng() * eligible.length)];
    const zone = zoneCode("chambres");
    for (let x = xa; x <= xb; x++) {
      cells[longRow * w + x] = CELL_OPEN;
      zones[longRow * w + x] = zone;
    }
    const crossings = new Set([xa, xb, cols[1 + Math.floor(trng() * Math.max(1, cols.length - 2))]]);
    for (const x of cols) {
      const cross = crossings.has(x);
      cells[(longRow - 1) * w + x] = cross ? CELL_OPEN : CELL_WALL;
      cells[(longRow + 1) * w + x] = cross ? CELL_OPEN : CELL_WALL;
    }
    plan.rooms.push({ kind: "chambres", x0: xa, y0: longRow, x1: xb, y1: longRow });
  }

  // Les blocs entre les couloirs : chambres fermees, chambres ouvertes, salons.
  const openRooms: { x0: number; y0: number; x1: number; y1: number; door: Dir }[] = [];
  const salons: { x0: number; y0: number; x1: number; y1: number }[] = [];
  for (let c = 0; c + 1 < cols.length; c++) {
    for (let r = 0; r + 1 < rows.length; r++) {
      const bx0 = cols[c] + 1;
      const bx1 = cols[c + 1] - 1;
      const by0 = rows[r] + 1;
      const by1 = rows[r + 1] - 1;
      const roll = rng();
      if (roll < 0.18) {
        // Salon : tout le bloc s'ouvre sur les couloirs (sauf sur le grand couloir, qui garde ses murs).
        for (let y = by0; y <= by1; y++) {
          if (longRow >= 0 && (y === longRow - 1 || y === longRow + 1)) continue;
          for (let x = bx0; x <= bx1; x++) cells[y * w + x] = CELL_OPEN;
        }
        salons.push({ x0: bx0, y0: by0, x1: bx1, y1: by1 });
      } else if (roll < 0.5) {
        // Chambre ouverte : une piece au milieu du bloc, une seule porte.
        const rx0 = bx0 + 1;
        const rx1 = bx1 - 1;
        const ry0 = by0 + 1;
        const ry1 = by1 - 1;
        if (rx1 < rx0 || ry1 < ry0) continue;
        for (let y = ry0; y <= ry1; y++) for (let x = rx0; x <= rx1; x++) cells[y * w + x] = CELL_OPEN;
        const door = (["N", "S", "E", "W"] as Dir[])[Math.floor(rng() * 4)];
        if (door === "N") cells[by0 * w + randInt(rng, rx0, rx1)] = CELL_OPEN;
        else if (door === "S") cells[by1 * w + randInt(rng, rx0, rx1)] = CELL_OPEN;
        else if (door === "W") cells[randInt(rng, ry0, ry1) * w + bx0] = CELL_OPEN;
        else cells[randInt(rng, ry0, ry1) * w + bx1] = CELL_OPEN;
        openRooms.push({ x0: rx0, y0: ry0, x1: rx1, y1: ry1, door });
      }
    }
  }

  // Au rez, la salle de bal ; a l'etage, la chaufferie.
  let ballroom: RoomMark | null = null;
  let boilerRoom: RoomMark | null = null;
  if (floor === 0) {
    const spot = findRoomSpot(plan, w, h, randInt(trng, 12, 15), randInt(trng, 9, 11), 9, 8, trng);
    if (spot) ballroom = stampRoom(plan, w, h, "bal", spot.x0, spot.y0, spot.rw, spot.rh, trng, 4, 2);
  } else {
    const spot = findRoomSpot(plan, w, h, randInt(trng, 9, 11), randInt(trng, 7, 8), 8, 7, trng);
    if (spot) boilerRoom = stampRoom(plan, w, h, "chaufferie", spot.x0, spot.y0, spot.rw, spot.rh, trng, 2, 1);
  }
  const extraRooms = stampExtras(plan, w, h, extras, srng);
  connectPlan(plan, w, h);

  // --- Objets pleins ---
  if (ballroom) {
    // Deux rangees de colonnes, et des chariots a bagages oublies dans les coins.
    for (const y of [ballroom.y0 + 2, ballroom.y1 - 2]) {
      for (let x = ballroom.x0 + 2; x <= ballroom.x1 - 2; x += 3) placeProp(plan, w, h, "colonne", x, y, 1, 1, 0);
    }
    for (const [x, y] of [
      [ballroom.x0, ballroom.y0],
      [ballroom.x1, ballroom.y0],
      [ballroom.x0, ballroom.y1],
      [ballroom.x1, ballroom.y1],
    ]) {
      if (prng() < 0.45) placeProp(plan, w, h, "chariot", x, y, 1, 1, randInt(prng, 0, 3));
    }
  }
  if (boilerRoom) {
    // Chaudieres de deux cases sur deux, la porte du foyer tournee vers le sud.
    const by = boilerRoom.y0 + 1;
    for (let x = boilerRoom.x0 + 1; x + 1 <= boilerRoom.x1 - 1; x += 4) placeProp(plan, w, h, "chaudiere", x, by, 2, 2, 1);
  }
  const dirIndex: Record<Dir, number> = { N: 0, S: 1, E: 2, W: 3 };
  const opposite: Record<Dir, Dir> = { N: "S", S: "N", E: "W", W: "E" };
  for (const room of openRooms) {
    if (prng() > 0.7) continue;
    // Le lit, contre le mur oppose a la porte ; la tete de lit contre ce mur.
    const head = opposite[room.door];
    const x = head === "E" ? room.x1 : head === "W" ? room.x0 : randInt(prng, room.x0, room.x1);
    const y = head === "S" ? room.y1 : head === "N" ? room.y0 : randInt(prng, room.y0, room.y1);
    if (zones[y * w + x] !== 0) continue;
    placeProp(plan, w, h, "lit", x, y, 1, 1, dirIndex[head]);
  }
  for (const s of salons) {
    if (prng() > 0.4) continue;
    const x = randInt(prng, s.x0, s.x1);
    const y = randInt(prng, s.y0, s.y1);
    if (zones[y * w + x] !== 0 || !surroundedByOpen(cells, w, h, x, y)) continue;
    placeProp(plan, w, h, "chariot", x, y, 1, 1, randInt(prng, 0, 3));
  }
  furnishExtras(plan, w, h, extraRooms, orng);
  return plan;
}

/**
 * Niveau 6 : des bureaux et des reserves sans une seule lampe. Un grand hall
 * vide a piliers, un couloir qui traverse tout l'etage presque sans porte, et
 * une salle inondee ou chaque pas s'entend.
 */
function genDark(w: number, h: number, rng: () => number, trng: () => number): FloorPlan {
  const plan = newPlan(w, h, CELL_OPEN);
  const { cells } = plan;
  border(cells, w, h);
  lattice(cells, w, h, rng, 6, { removeChance: 0.2, gapMin: 1, gapMax: 2, extraGapChance: 0.3 });
  // Bouts de cloison : dans le noir, on s'y cogne.
  for (let i = 0; i < w * h * 0.012; i++) {
    const x = randInt(rng, 2, w - 3);
    const y = randInt(rng, 2, h - 3);
    if (!surroundedByOpen(cells, w, h, x, y)) continue;
    const horizontal = rng() < 0.5;
    const len = randInt(rng, 2, 3);
    for (let k = 0; k < len; k++) {
      const cx = horizontal ? x + k : x;
      const cy = horizontal ? y : y + k;
      if (cx >= w - 1 || cy >= h - 1) break;
      cells[cy * w + cx] = CELL_WALL;
    }
  }
  // Le couloir infini, d'un bout a l'autre de l'etage.
  {
    const spot = findRoomSpot(plan, w, h, w - 10, 2, w - 16, 2, trng);
    if (spot) stampCorridor(plan, w, h, "couloir-infini", spot.x0, spot.y0, spot.rw, 2, trng, true);
  }
  // Le grand hall noir, et ses piliers ou l'on se cache.
  {
    const spot = findRoomSpot(plan, w, h, randInt(trng, 16, 19), randInt(trng, 11, 13), 11, 9, trng);
    if (spot) {
      const hall = stampRoom(plan, w, h, "hall-noir", spot.x0, spot.y0, spot.rw, spot.rh, trng, 4, 2);
      for (let y = hall.y0 + 3; y <= hall.y1 - 3; y += 4) {
        for (let x = hall.x0 + 3; x <= hall.x1 - 3; x += 4) if (trng() < 0.6) cells[y * w + x] = CELL_PILLAR;
      }
    }
  }
  // La salle inondee.
  {
    const spot = findRoomSpot(plan, w, h, randInt(trng, 9, 11), randInt(trng, 7, 9), 6, 5, trng);
    if (spot) stampRoom(plan, w, h, "inondee", spot.x0, spot.y0, spot.rw, spot.rh, trng, 3, randInt(trng, 1, 2));
  }
  connectPlan(plan, w, h);
  return plan;
}

/**
 * Niveau Fun : des salles de fete en enfilade. La salle au gateau geant, la
 * salle des ballons, la piste de danse a damier et le couloir des guirlandes.
 */
function genParty(w: number, h: number, rng: () => number, trng: () => number, prng: () => number): FloorPlan {
  const plan = newPlan(w, h, CELL_OPEN);
  const { cells, zones } = plan;
  border(cells, w, h);
  lattice(cells, w, h, rng, 8, { removeChance: 0.24, gapMin: 2, gapMax: 3, extraGapChance: 0.5 });
  {
    const len = randInt(trng, 18, 24);
    const horizontal = trng() < 0.5;
    const spot = findRoomSpot(plan, w, h, horizontal ? len : 2, horizontal ? 2 : len, horizontal ? 12 : 2, horizontal ? 2 : 12, trng);
    if (spot) stampCorridor(plan, w, h, "guirlandes", spot.x0, spot.y0, spot.rw, spot.rh, trng, false);
  }
  let cakeRoom: RoomMark | null = null;
  {
    const spot = findRoomSpot(plan, w, h, randInt(trng, 11, 13), randInt(trng, 9, 11), 7, 7, trng);
    if (spot) cakeRoom = stampRoom(plan, w, h, "gateau", spot.x0, spot.y0, spot.rw, spot.rh, trng, 3, 2);
  }
  {
    const spot = findRoomSpot(plan, w, h, randInt(trng, 11, 13), randInt(trng, 9, 11), 7, 6, trng);
    if (spot) stampRoom(plan, w, h, "piste", spot.x0, spot.y0, spot.rw, spot.rh, trng, 3, 2);
  }
  {
    const spot = findRoomSpot(plan, w, h, randInt(trng, 9, 11), randInt(trng, 7, 9), 6, 5, trng);
    if (spot) stampRoom(plan, w, h, "ballons", spot.x0, spot.y0, spot.rw, spot.rh, trng, 2, 2);
  }
  connectPlan(plan, w, h);

  if (cakeRoom) {
    // Le gateau (trois cases sur trois) au centre, les tables du buffet contre les murs.
    const rw = cakeRoom.x1 - cakeRoom.x0 + 1;
    const rh = cakeRoom.y1 - cakeRoom.y0 + 1;
    placeProp(plan, w, h, "gateau", cakeRoom.x0 + Math.floor((rw - 3) / 2), cakeRoom.y0 + Math.floor((rh - 3) / 2), 3, 3, randInt(prng, 0, 3));
    let tables = 0;
    for (let t = 0; t < 10 && tables < 3; t++) {
      const north = prng() < 0.5;
      const x = randInt(prng, cakeRoom.x0 + 1, cakeRoom.x1 - 2);
      const y = north ? cakeRoom.y0 : cakeRoom.y1;
      if (placeProp(plan, w, h, "table", x, y, 2, 1, randInt(prng, 0, 3))) tables++;
    }
  }
  // Quelques tables de buffet oubliees dans les autres salles.
  let tables = 0;
  for (let t = 0; t < 40 && tables < 5; t++) {
    const x = randInt(prng, 2, w - 4);
    const y = randInt(prng, 2, h - 3);
    if (zones[y * w + x] !== 0 || zones[y * w + x + 1] !== 0) continue;
    if (!surroundedByOpen(cells, w, h, x, y) || !surroundedByOpen(cells, w, h, x + 1, y)) continue;
    if (placeProp(plan, w, h, "table", x, y, 2, 1, randInt(prng, 0, 3))) tables++;
  }
  return plan;
}

/**
 * Retire les objets entames par un couloir de secours : jamais de case pleine
 * sans forme dessinee, ni d'objet dessine sans collision.
 */
function sanitizeProps(cells: Uint8Array, w: number, props: PropItem[]): PropItem[] {
  const kept: PropItem[] = [];
  const mark = new Uint8Array(cells.length);
  for (const p of props) {
    let whole = true;
    for (let y = p.y0; y <= p.y1 && whole; y++) for (let x = p.x0; x <= p.x1; x++) if (cells[y * w + x] !== CELL_PROP) whole = false;
    if (!whole) continue;
    kept.push(p);
    for (let y = p.y0; y <= p.y1; y++) for (let x = p.x0; x <= p.x1; x++) mark[y * w + x] = 1;
  }
  for (let i = 0; i < cells.length; i++) if (cells[i] === CELL_PROP && !mark[i]) cells[i] = CELL_OPEN;
  return kept;
}

/** Emplacements contre un mur autour d'une case libre (ni etagere, ni objet plein). */
function wallDirs(cells: Uint8Array, w: number, h: number, x: number, y: number): Dir[] {
  return (Object.keys(DIRS) as Dir[]).filter((d) => {
    const [dx, dy] = DIRS[d];
    if (!isSolidCell(cells, w, h, x + dx, y + dy)) return false;
    const c = cells[(y + dy) * w + (x + dx)];
    return c !== CELL_RACK && c !== CELL_PROP;
  });
}

/** Faces d'une case libre qui donnent sur un vrai mur (ni pilier, ni objet). */
function solidWallDirs(cells: Uint8Array, w: number, x: number, y: number): Dir[] {
  return (Object.keys(DIRS) as Dir[]).filter((d) => {
    const [dx, dy] = DIRS[d];
    return cells[(y + dy) * w + (x + dx)] === CELL_WALL;
  });
}

const BATON_TINTS = [0x7dff8a, 0x6ae8ff, 0xff6ad5, 0xfff06a];
const PARTY_TINTS = [0xff5fa2, 0x5fd4ff, 0xffe45c, 0x8cff6a, 0xc58cff, 0xff9a4a];

/**
 * Luminaires des eclairages « hotel », « noir » et « fete ». Generateur a
 * part : une meme graine redonne les memes lampes, sans toucher au reste.
 */
function themedLights(ctx: {
  lighting: LightingKind;
  cells: Uint8Array;
  w: number;
  reachable: number[];
  distance: Int32Array;
  zones: Uint8Array;
  rooms: RoomMark[];
  water: Uint8Array;
  start: { x: number; y: number };
  exit: WallSpot;
  inStairwell: (y: number) => boolean;
  rng: () => number;
}): LightSpot[] {
  const { cells, w, zones, rng } = ctx;
  const lights: LightSpot[] = [];
  const state = (dead: number, flicker: number): 0 | 1 | 2 => {
    const r = rng();
    return r < dead ? 1 : r < dead + flicker ? 2 : 0;
  };
  const isExitFace = (x: number, y: number, d: Dir) => x === ctx.exit.x && y === ctx.exit.y && d === ctx.exit.dir;

  if (ctx.lighting === "hotel") {
    for (const i of ctx.reachable) {
      const x = i % w;
      const y = (i - x) / w;
      if (ctx.inStairwell(y)) continue;
      const kind = zoneKind(zones, i);
      if (kind === "bal") continue;
      if (kind === "chaufferie") {
        if (x % 3 === 1 && y % 3 === 1) lights.push({ x, y, state: state(0.1, 0.3), fixture: "ampoule", tint: 0xff8a3a });
        continue;
      }
      const walls = solidWallDirs(cells, w, x, y).filter((d) => !isExitFace(x, y, d));
      if (kind === "chambres") {
        // Une applique toutes les trois portes, d'un cote puis de l'autre.
        if (x % 3 !== 0) continue;
        const want: Dir = (x / 3) % 2 === 0 ? "N" : "S";
        const dir = walls.includes(want) ? want : walls.find((d) => d === "N" || d === "S");
        if (dir) lights.push({ x, y, state: state(0.1, 0.12), wall: dir, fixture: "applique", tint: 0xffc27a });
        continue;
      }
      if (walls.length === 0) {
        // Salon, grande piece : un plafonnier de loin en loin. Le hall de
        // reception a ses lustres, poses plus bas.
        if (kind === "reception") continue;
        if (x % 3 === 0 && y % 3 === 0) lights.push({ x, y, state: state(0.12, 0.1), fixture: "ampoule", tint: 0xffd49a });
        continue;
      }
      if ((x * 7 + y * 13) % 4 !== 0) continue;
      lights.push({ x, y, state: state(0.14, 0.12), wall: walls[Math.floor(rng() * walls.length)], fixture: "applique", tint: 0xffc27a });
    }
    // Les lustres de la salle de bal, dans l'allee entre les colonnes.
    for (const r of ctx.rooms) {
      if (r.kind !== "bal") continue;
      const y = Math.floor((r.y0 + r.y1) / 2);
      for (let x = r.x0 + 2; x <= r.x1 - 2; x += 4) {
        if (cells[y * w + x] === CELL_OPEN) lights.push({ x, y, state: state(0.06, 0.1), fixture: "lustre", tint: 0xffe2a8 });
      }
    }
    // Le hall de reception : deux lustres dans l'axe de la piece, dont un qui
    // tremble toujours un peu.
    for (const r of ctx.rooms) {
      if (r.kind !== "reception") continue;
      const horizontal = r.x1 - r.x0 >= r.y1 - r.y0;
      const cx = Math.floor((r.x0 + r.x1) / 2);
      const cy = Math.floor((r.y0 + r.y1) / 2);
      const spots: [number, number][] = horizontal
        ? [
            [cx - 2, cy],
            [cx + 2, cy],
          ]
        : [
            [cx, cy - 2],
            [cx, cy + 2],
          ];
      spots.forEach(([x, y], k) => {
        if (cells[y * w + x] === CELL_OPEN) lights.push({ x, y, state: k === 0 ? 0 : 2, fixture: "lustre", tint: 0xffe2a8 });
      });
    }
  } else if (ctx.lighting === "noir") {
    const taken = new Set<number>();
    const add = (i: number, s: 0 | 1 | 2, tint: number) => {
      if (taken.has(i)) return;
      taken.add(i);
      lights.push({ x: i % w, y: Math.floor(i / w), state: s, fixture: "baton", tint });
    };
    // Des batons lumineux laisses par ceux qui sont passes avant, jamais dans
    // le grand hall ni dans le couloir infini.
    for (const i of ctx.reachable) {
      const y = Math.floor(i / w);
      if (ctx.inStairwell(y) || ctx.water[i]) continue;
      const kind = zoneKind(zones, i);
      if (kind === "hall-noir" || kind === "couloir-infini") continue;
      if (rng() >= 1 / 55) continue;
      add(i, rng() < 0.3 ? 2 : 0, BATON_TINTS[Math.floor(rng() * BATON_TINTS.length)]);
    }
    // Un premier baton a deux pas du depart : on comprend a quoi ils servent.
    const first = ctx.reachable.find((i) => ctx.distance[i] === 2 && !ctx.water[i]);
    if (first !== undefined) add(first, 0, BATON_TINTS[0]);
    // Tout au bout du couloir infini, une lueur qui tremble.
    for (const r of ctx.rooms) {
      if (r.kind !== "couloir-infini") continue;
      const a = r.y0 * w + r.x0;
      const b = r.y1 * w + r.x1;
      const far = ctx.distance[a] > ctx.distance[b] ? a : b;
      if (ctx.distance[far] > 0) add(far, 2, BATON_TINTS[1]);
    }
  } else if (ctx.lighting === "fete") {
    for (const i of ctx.reachable) {
      const x = i % w;
      const y = (i - x) / w;
      if (ctx.inStairwell(y)) continue;
      const kind = zoneKind(zones, i);
      if (kind === "piste") continue;
      if (kind === "guirlandes") {
        if ((x + y) % 4 === 0) lights.push({ x, y, state: state(0.04, 0.1), fixture: "ampoule", tint: PARTY_TINTS[((x + y) / 4) % PARTY_TINTS.length] });
        continue;
      }
      if (x % 3 !== 1 || y % 3 !== 1) continue;
      if (kind === null && rng() < 0.3) continue;
      const tint = kind === "gateau" ? 0xffd9a0 : kind === "ballons" ? 0xff8fd0 : PARTY_TINTS[Math.floor(rng() * PARTY_TINTS.length)];
      lights.push({ x, y, state: state(0.05, 0.1), fixture: "ampoule", tint });
    }
    // La piste : un projecteur de couleur a chaque coin (au centre pend la
    // boule a facettes, dessinee par le decor).
    for (const r of ctx.rooms) {
      if (r.kind !== "piste") continue;
      const spots: [number, number, number][] = [
        [r.x0 + 1, r.y0 + 1, 0xff5fa2],
        [r.x1 - 1, r.y0 + 1, 0x5fd4ff],
        [r.x0 + 1, r.y1 - 1, 0xffe45c],
        [r.x1 - 1, r.y1 - 1, 0x8cff6a],
      ];
      for (const [x, y, tint] of spots) {
        if (cells[y * w + x] === CELL_OPEN) lights.push({ x, y, state: 0, fixture: "ampoule", tint });
      }
    }
  }
  return lights;
}

/** Choisit `count` cases libres eloignees les unes des autres et du depart. */
function spreadCells(
  rng: () => number,
  candidates: number[],
  count: number,
  w: number,
  minGap: number,
  avoid: { x: number; y: number }[],
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const pool = [...candidates];
  for (let gap = minGap; out.length < count && gap >= 2; gap = Math.floor(gap * 0.7)) {
    for (let tries = 0; tries < pool.length * 2 && out.length < count; tries++) {
      const i = pool[Math.floor(rng() * pool.length)];
      const x = i % w;
      const y = (i - x) / w;
      const near = [...out, ...avoid].some((p) => Math.abs(p.x - x) + Math.abs(p.y - y) < gap);
      if (!near) out.push({ x, y });
    }
  }
  return out;
}

export function generateLevel(def: LevelDef, seed: number): LevelData {
  const rng = mulberry32(seed ^ (def.width * 7919));
  const w = def.width;
  const h = def.height + (def.upper ? STAIR_ROWS + def.upper.rows : 0);
  let cells: Uint8Array;
  let start = { x: Math.floor(w / 2), y: Math.floor(h / 2) };
  let runEnd: { x: number; y: number } | null = null;

  const groundRows = def.height;
  const stairRows = def.upper ? STAIR_ROWS : 0;
  const stairs: { x0: number; x1: number }[] = [];
  // Niveaux a salles marquantes : les gabarits (trng) et les objets pleins
  // (prng) ont leur propre generateur, pour ne jamais decaler le reste.
  const trng = mulberry32((seed ^ 0x7a11e5) + def.width * 131);
  const prng = mulberry32((seed ^ 0x9209b3) + def.width * 197);
  // Les sept salles ajoutees apres coup : gabarits (srng) et objets (orng) a part.
  const srng = mulberry32((seed ^ 0x5a1e57) + def.width * 211);
  const orng = mulberry32((seed ^ 0x0b7ec7) + def.width * 227);
  /** Plans des etages generes avec des salles marquantes : rez d'abord, puis etage. */
  const plans: FloorPlan[] = [];
  const keep = (plan: FloorPlan) => {
    plans.push(plan);
    return plan.cells;
  };
  const genFloor = (fw: number, fh: number) => {
    // Les salles ajoutees vont au rez ; celles qui n'y ont pas trouve de place
    // retentent leur chance a l'etage.
    const extras = (EXTRA_ROOMS[def.id] ?? []).filter((k) => !plans.some((p) => p.rooms.some((r) => r.kind === k)));
    const withRooms = (floorCells: Uint8Array) => keep(withExtraRooms(floorCells, fw, fh, extras, srng, orng));
    switch (def.id) {
      case "niveau-1":
        return withRooms(genWarehouse(fw, fh, rng));
      case "niveau-2":
        return withRooms(genPipes(fw, fh, rng));
      case "niveau-3":
        return genPlant(fw, fh, rng);
      case "niveau-4":
        return withRooms(genOffice(fw, fh, rng));
      case "niveau-37":
        return withRooms(genPools(fw, fh, rng));
      case "niveau-5":
        return keep(genHotel(fw, fh, rng, trng, prng, plans.length, extras, srng, orng));
      case "niveau-6":
        return keep(genDark(fw, fh, rng, trng));
      case "niveau-fun":
        return keep(genParty(fw, fh, rng, trng, prng));
      default:
        return withRooms(genHall(fw, fh, rng));
    }
  };

  if (def.id === "niveau-run") {
    const run = genRun(w, h, rng);
    cells = run.cells;
    start = { x: 2, y: 2 };
    runEnd = run.end;
  } else {
    const ground = genFloor(w, groundRows);
    // Le depart est la case libre du rez la plus proche de son centre (jamais
    // dans une salle marquante : on ne commence pas au milieu du bal).
    const groundZones = plans.length > 0 ? plans[0].zones : null;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < ground.length; i++) {
      if (ground[i] !== CELL_OPEN) continue;
      if (groundZones && groundZones[i] !== 0) continue;
      const x = i % w;
      const y = (i - x) / w;
      const d = Math.abs(x - w / 2) + Math.abs(y - groundRows / 2);
      if (d < bestD && surroundedByOpen(ground, w, groundRows, x, y, def.id === "niveau-2" ? 0 : 1)) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0 && groundZones) {
      // Aucune piece assez large hors des salles marquantes : un couloir fera l'affaire.
      for (let i = 0; i < ground.length; i++) {
        if (ground[i] !== CELL_OPEN || groundZones[i] !== 0) continue;
        const x = i % w;
        const y = (i - x) / w;
        const d = Math.abs(x - w / 2) + Math.abs(y - groundRows / 2);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    }
    if (best < 0) best = ground.indexOf(CELL_OPEN);
    start = { x: best % w, y: Math.floor(best / w) };

    if (!def.upper) {
      cells = ground;
    } else {
      // Escaliers repartis sur la largeur, jamais colles au bord.
      for (let k = 0; k < def.upper.stairs; k++) {
        const center = Math.round(((k + 1) / (def.upper.stairs + 1)) * w) + randInt(rng, -3, 3);
        const xc = Math.max(3, Math.min(w - 4, center));
        stairs.push({ x0: xc - 1, x1: xc + 1 });
      }
      const upper = genFloor(w, def.upper.rows);
      // Paliers : trois lignes degagees de chaque cote de la cage, bords compris.
      for (const st of stairs) {
        for (let x = st.x0; x <= st.x1; x++) {
          for (let y = groundRows - 3; y < groundRows; y++) ground[y * w + x] = CELL_OPEN;
          for (let y = 0; y < 3; y++) upper[y * w + x] = CELL_OPEN;
        }
      }
      // Chaque etage est relie en interne AVANT l'assemblage : un couloir de
      // secours ne doit jamais traverser le bandeau entre les deux etages.
      ground[start.y * w + start.x] = CELL_OPEN;
      ensureConnected(ground, w, groundRows, start.x, start.y);
      ensureConnected(upper, w, def.upper.rows, stairs[0].x0 + 1, 1);

      cells = new Uint8Array(w * h).fill(CELL_WALL);
      cells.set(ground, 0);
      cells.set(upper, (groundRows + stairRows) * w);
      for (const st of stairs) {
        for (let y = groundRows; y < groundRows + stairRows; y++) {
          for (let x = st.x0; x <= st.x1; x++) cells[y * w + x] = CELL_OPEN;
        }
      }
    }
  }
  cells[start.y * w + start.x] = CELL_OPEN;
  ensureConnected(cells, w, h, start.x, start.y);

  // --- Salles marquantes et objets pleins, recales sur la grille complete ---
  const zones = new Uint8Array(w * h);
  const rooms: RoomMark[] = [];
  let props: PropItem[] = [];
  plans.forEach((plan, k) => {
    const off = k === 0 ? 0 : groundRows + stairRows;
    zones.set(plan.zones, off * w);
    for (const r of plan.rooms) rooms.push({ ...r, y0: r.y0 + off, y1: r.y1 + off });
    for (const p of plan.props) props.push({ ...p, y0: p.y0 + off, y1: p.y1 + off });
  });
  if (plans.length > 0) {
    props = sanitizeProps(cells, w, props);
    ensureConnected(cells, w, h, start.x, start.y);
  }
  const distance = bfsDistances(cells, w, h, start.x, start.y);

  const reachable: number[] = [];
  let maxDist = 0;
  for (let i = 0; i < cells.length; i++) {
    if (distance[i] > 0) {
      reachable.push(i);
      if (distance[i] > maxDist) maxDist = distance[i];
    }
  }

  // --- Bassins (niveau 37) : des rectangles d'eau peu profonde, jamais sur le depart ---
  const water = new Uint8Array(w * h);
  if (def.id === "niveau-37") {
    const target = Math.round(reachable.length * 0.17);
    let filled = 0;
    // Le bassin profond d'abord : toute la salle sauf une margelle seche
    // d'une case tout autour (le plongeoir s'y pose). Il compte dans le total.
    for (const r of rooms) {
      if (r.kind !== "bassin-profond") continue;
      for (let y = r.y0 + 1; y <= r.y1 - 1; y++) {
        for (let x = r.x0 + 1; x <= r.x1 - 1; x++) {
          const i = y * w + x;
          if (cells[i] !== CELL_OPEN || distance[i] < 0) continue;
          water[i] = 1;
          filled++;
        }
      }
    }
    for (let tries = 0; tries < 500 && filled < target; tries++) {
      const pw = randInt(rng, 3, 7);
      const ph = randInt(rng, 3, 6);
      const x0 = randInt(rng, 1, w - pw - 1);
      const y0 = randInt(rng, 1, h - ph - 1);
      if (Math.abs(x0 + pw / 2 - start.x) + Math.abs(y0 + ph / 2 - start.y) < 7) continue;
      let ok = true;
      for (let y = y0; y < y0 + ph && ok; y++) {
        for (let x = x0; x < x0 + pw; x++) {
          const i = y * w + x;
          // Jamais de flaque ordinaire dans une salle marquante : la margelle du bassin reste seche.
          if (cells[i] !== CELL_OPEN || distance[i] < 0 || water[i] || zones[i] !== 0) {
            ok = false;
            break;
          }
        }
      }
      if (!ok) continue;
      for (let y = y0; y < y0 + ph; y++) {
        for (let x = x0; x < x0 + pw; x++) {
          water[y * w + x] = 1;
          filled++;
        }
      }
    }
  }
  // --- Salle inondee (niveau 6) : toute la piece a de l'eau jusqu'aux chevilles ---
  for (const r of rooms) {
    if (r.kind !== "inondee") continue;
    for (let y = r.y0; y <= r.y1; y++) {
      for (let x = r.x0; x <= r.x1; x++) {
        const i = y * w + x;
        if (cells[i] === CELL_OPEN && distance[i] >= 0 && !(x === start.x && y === start.y)) water[i] = 1;
      }
    }
  }

  // La salle a la chaise reste vide : ni sortie, ni objet a ramasser, ni decor seme.
  const lonelyChair = (i: number) => zones[i] !== 0 && zoneKind(zones, i) === "chaise-seule";

  // --- Sortie : une porte dans un mur, parmi les cases les plus eloignees ---
  let exit: WallSpot = { x: start.x, y: start.y, dir: "N" };
  if (runEnd) {
    exit = { x: runEnd.x, y: runEnd.y, dir: runEnd.x === 1 ? "W" : "E" };
  } else {
    const far = reachable
      .filter(
        (i) =>
          distance[i] >= maxDist * 0.82 &&
          !water[i] &&
          !lonelyChair(i) &&
          !(stairRows > 0 && Math.floor(i / w) >= groundRows && Math.floor(i / w) < groundRows + stairRows),
      )
      .map((i) => ({ x: i % w, y: Math.floor(i / w) }))
      .map((c) => ({ ...c, dirs: wallDirs(cells, w, h, c.x, c.y) }))
      .filter((c) => c.dirs.length > 0);
    const pick = far[Math.floor(rng() * far.length)] ?? { x: start.x, y: start.y, dirs: ["N" as Dir] };
    exit = { x: pick.x, y: pick.y, dir: pick.dirs[Math.floor(rng() * pick.dirs.length)] };
  }

  // --- Lumieres ---
  const lights: LightSpot[] = [];
  const inStairwell = (y: number) => stairRows > 0 && y >= groundRows && y < groundRows + stairRows;
  const lightState = (deadChance: number, flickerChance: number): 0 | 1 | 2 => {
    const r = rng();
    return r < deadChance ? 1 : r < deadChance + flickerChance ? 2 : 0;
  };
  if (def.lighting === "neons") {
    // Salle aux neons morts : ils sont la, mais tous eteints. Salle a la
    // chaise : aucun, sauf celui pose au-dessus d'elle. La ceinture de murs
    // (et ses portes) compte avec la salle.
    const darkRooms = rooms.filter((r) => r.kind === "neons-morts" || r.kind === "chaise-seule");
    const darkAt = (x: number, y: number): RoomKind | null => {
      for (const r of darkRooms) if (x >= r.x0 - 1 && x <= r.x1 + 1 && y >= r.y0 - 1 && y <= r.y1 + 1) return r.kind;
      return null;
    };
    for (let y = 1; y < h - 1; y += 3) {
      for (let x = 1; x < w - 1; x += 2) {
        if (cells[y * w + x] !== CELL_OPEN || inStairwell(y)) continue;
        const state = lightState(0.07, 0.06);
        const dark = darkRooms.length > 0 ? darkAt(x, y) : null;
        if (dark === "chaise-seule") continue;
        lights.push({ x, y, state: dark === "neons-morts" ? 1 : state });
      }
    }
    for (const r of darkRooms) {
      if (r.kind !== "chaise-seule") continue;
      const chair = props.find((p) => p.kind === "chaise" && p.x0 >= r.x0 && p.x1 <= r.x1 && p.y0 >= r.y0 && p.y1 <= r.y1);
      lights.push({ x: chair ? chair.x0 : Math.floor((r.x0 + r.x1) / 2), y: chair ? chair.y0 : Math.floor((r.y0 + r.y1) / 2), state: 0 });
    }
  } else if (def.lighting === "entrepot") {
    for (let y = 2; y < h - 1; y += 4) {
      for (let x = 2; x < w - 1; x += 4) {
        if (cells[y * w + x] === CELL_OPEN && !inStairwell(y)) lights.push({ x, y, state: lightState(0.22, 0.1) });
      }
    }
  } else if (def.lighting === "secours") {
    // Ampoules rouges accrochees aux murs, rares : la lampe est indispensable.
    for (const i of reachable) {
      const x = i % w;
      const y = (i - x) / w;
      if ((x * 7 + y * 13) % 9 !== 0 || inStairwell(y)) continue;
      const dirs = wallDirs(cells, w, h, x, y);
      if (dirs.length === 0 || rng() < 0.35) continue;
      lights.push({ x, y, state: lightState(0.15, 0.2), wall: dirs[0] });
    }
  } else if (def.lighting === "alarme") {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x += 3) {
        if (cells[y * w + x] === CELL_OPEN && (y - 1) % 4 === 1) lights.push({ x, y, state: lightState(0.05, 0.25) });
      }
    }
  } else {
    lights.push(
      ...themedLights({
        lighting: def.lighting,
        cells,
        w,
        reachable,
        distance,
        zones,
        rooms,
        water,
        start,
        exit,
        inStairwell,
        rng: mulberry32((seed ^ 0x11a7e5) + def.width * 53),
      }),
    );
  }

  // --- Objets et objectifs ---
  const openReachable = reachable.filter((i) => {
    const x = i % w;
    const y = (i - x) / w;
    return Math.abs(x - start.x) + Math.abs(y - start.y) > 3 && !(x === exit.x && y === exit.y) && !inStairwell(y) && !water[i] && !lonelyChair(i);
  });
  const pickups: LevelData["pickups"] = [];
  const valves: WallSpot[] = [];
  const taken: { x: number; y: number }[] = [start, exit];

  if (def.objective === "fusibles") {
    const farPool = openReachable.filter((i) => distance[i] > maxDist * 0.35);
    for (const c of spreadCells(rng, farPool, def.goalCount, w, 14, taken)) {
      pickups.push({ kind: "fusible", ...c });
      taken.push(c);
    }
  }
  if (def.objective === "vannes") {
    const wallPool = openReachable.filter((i) => {
      const x = i % w;
      const y = (i - x) / w;
      return distance[i] > maxDist * 0.3 && wallDirs(cells, w, h, x, y).length >= 2;
    });
    for (const c of spreadCells(rng, wallPool, def.goalCount, w, 12, taken)) {
      const dirs = wallDirs(cells, w, h, c.x, c.y);
      valves.push({ ...c, dir: dirs[Math.floor(rng() * dirs.length)] });
      taken.push(c);
    }
  }
  for (const c of spreadCells(rng, openReachable, def.waterCount, w, 9, taken)) {
    pickups.push({ kind: "eau", ...c });
    taken.push(c);
  }
  for (const c of spreadCells(rng, openReachable, def.batteryCount, w, 8, taken)) {
    pickups.push({ kind: "pile", ...c });
    taken.push(c);
  }

  // --- Fleches taguees le long du bon chemin (niveau 0) ---
  const arrows: ArrowDecal[] = [];
  if (def.objective === "sortie") {
    // Chemin : on redescend les distances depuis la sortie.
    const path: { x: number; y: number }[] = [{ x: exit.x, y: exit.y }];
    let cur = { x: exit.x, y: exit.y };
    for (let guard = 0; guard < w * h && distance[cur.y * w + cur.x] > 0; guard++) {
      const d = distance[cur.y * w + cur.x];
      const next = Object.values(DIRS)
        .map(([dx, dy]) => ({ x: cur.x + dx, y: cur.y + dy }))
        .find((n) => !isSolidCell(cells, w, h, n.x, n.y) && distance[n.y * w + n.x] === d - 1);
      if (!next) break;
      path.push(next);
      cur = next;
    }
    path.reverse();
    for (let i = 3; i < path.length - 1; i += randInt(rng, 4, 7)) {
      const p = path[i];
      const go: [number, number] = [path[i + 1].x - p.x, path[i + 1].y - p.y];
      for (const d of wallDirs(cells, w, h, p.x, p.y)) {
        const [wx, wy] = DIRS[d];
        // Vu face au mur, la droite du joueur est (-wy, wx).
        const rx = -wy;
        const ry = wx;
        let arrow: "gauche" | "droite" | null = null;
        if (go[0] === rx && go[1] === ry) arrow = "droite";
        else if (go[0] === -rx && go[1] === -ry) arrow = "gauche";
        if (!arrow) continue;
        const lie = rng() < 1 / 6;
        arrows.push({ x: p.x, y: p.y, dir: d, arrow: lie ? (arrow === "droite" ? "gauche" : "droite") : arrow, lie });
        break;
      }
    }
  }

  // --- Entite ---
  let entityStart: { x: number; y: number } | null = null;
  if (def.entity === "bacterie") {
    if (def.id === "niveau-run") {
      entityStart = { ...start };
    } else {
      const far = openReachable.filter((i) => distance[i] > maxDist * 0.6);
      const i = far[Math.floor(rng() * far.length)] ?? openReachable[0];
      entityStart = { x: i % w, y: Math.floor(i / w) };
    }
  } else if (def.entity === "souriant") {
    const i = openReachable[Math.floor(rng() * openReachable.length)];
    entityStart = { x: i % w, y: Math.floor(i / w) };
  } else if (def.entity === "voleur" || def.entity === "chiens" || def.entity === "fetards") {
    // Loin du depart. Les Fetards attendent sur la piste, parmi les danseurs
    // immobiles ; les Chiens dans le grand hall noir, s'il est assez loin.
    const lair: RoomKind | null = def.entity === "fetards" ? "piste" : def.entity === "chiens" ? "hall-noir" : null;
    let spawn = openReachable.filter((i) => distance[i] > maxDist * 0.6);
    if (lair) {
      const inLair = openReachable.filter((i) => zoneKind(zones, i) === lair && distance[i] > maxDist * 0.3);
      if (inLair.length > 0) spawn = inLair;
    }
    const i = spawn[Math.floor(rng() * spawn.length)] ?? openReachable[0];
    entityStart = { x: i % w, y: Math.floor(i / w) };
  }

  // --- Silhouettes decoratives (niveau Fun) : des Fetards qui dansent sans bouger ---
  const figures: LevelData["figures"] = [];
  if (def.id === "niveau-fun") {
    const frng = mulberry32((seed ^ 0x0f16a5) + def.width * 23);
    const busy = new Set<number>([start.y * w + start.x, exit.y * w + exit.x]);
    for (const p of pickups) busy.add(p.y * w + p.x);
    for (const v of valves) busy.add(v.y * w + v.x);
    if (entityStart) busy.add(entityStart.y * w + entityStart.x);
    for (const r of rooms) {
      if (r.kind !== "piste" && r.kind !== "gateau") continue;
      const candidates: number[] = [];
      for (let y = r.y0 + 1; y < r.y1; y++) {
        for (let x = r.x0 + 1; x < r.x1; x++) {
          const i = y * w + x;
          if (cells[i] === CELL_OPEN && distance[i] >= 0 && !busy.has(i)) candidates.push(i);
        }
      }
      for (const c of spreadCells(frng, candidates, r.kind === "piste" ? 5 : 2, w, 3, [])) {
        figures.push({ x: c.x + 0.5, y: c.y + 0.5, yaw: frng() * Math.PI * 2 });
        busy.add(c.y * w + c.x);
      }
    }
  }

  // --- Decor ---
  // Generateur a part : ajouter du decor ne deplace ni la sortie ni les objets
  // d'une graine donnee, et tout le groupe voit exactement le meme niveau.
  const decor: DecorItem[] = [];
  {
    const drng = mulberry32((seed ^ 0x5eed1e) + def.width * 31);
    const faceKey = (x: number, y: number, d: Dir) => `${x},${y},${d}`;
    const usedFaces = new Set<string>([faceKey(exit.x, exit.y, exit.dir)]);
    for (const v of valves) usedFaces.add(faceKey(v.x, v.y, v.dir));
    for (const a of arrows) usedFaces.add(faceKey(a.x, a.y, a.dir));
    for (const l of lights) if (l.wall) usedFaces.add(faceKey(l.x, l.y, l.wall));
    const usedFloor = new Set<number>([start.y * w + start.x, exit.y * w + exit.x]);
    for (const pk of pickups) usedFloor.add(pk.y * w + pk.x);
    for (const v of valves) usedFloor.add(v.y * w + v.x);
    for (const f of figures) usedFloor.add(Math.floor(f.y) * w + Math.floor(f.x));
    const usedCeiling = new Set<number>();
    // Luminaires des niveaux 5, 6 et Fun : rien pose sur un baton, rien accroche a un lustre.
    for (const l of lights) {
      if (l.fixture === "baton") usedFloor.add(l.y * w + l.x);
      else if (l.fixture === "lustre" || l.fixture === "ampoule") usedCeiling.add(l.y * w + l.x);
    }
    const pool = reachable.filter((i) => !inStairwell(Math.floor(i / w)) && !lonelyChair(i));

    // Gyrophares du couloir de la course : reguliers, un tous les huit metres.
    if (def.id === "niveau-run") {
      for (const i of pool) {
        const x = i % w;
        const y = (i - x) / w;
        if (x % 5 !== 2) continue;
        for (const d of ["N", "S"] as Dir[]) {
          const [dx, dy] = DIRS[d];
          if (cells[(y + dy) * w + (x + dx)] !== CELL_WALL) continue;
          if (usedFaces.has(faceKey(x, y, d))) continue;
          usedFaces.add(faceKey(x, y, d));
          decor.push({ kind: "gyrophare", x, y, dir: d, variant: randInt(drng, 0, 3) });
        }
      }
    }

    // Portes de chambres numerotees (niveau 5) : une sur deux de chaque cote du
    // grand couloir, impaires au nord et paires au sud ; ailleurs, de loin en
    // loin dans les couloirs etroits. Generateur a part.
    if (def.id === "niveau-5") {
      const hrng = mulberry32((seed ^ 0x4077e5) + def.width * 59);
      const isSolidAt = (x: number, y: number) => isSolidCell(cells, w, h, x, y);
      for (const i of pool) {
        const x = i % w;
        const y = (i - x) / w;
        const kind = zoneKind(zones, i);
        const floorNo = stairRows > 0 && y >= groundRows + stairRows ? 2 : 1;
        if (kind === "chambres") {
          for (const d of ["N", "S"] as Dir[]) {
            const [dx, dy] = DIRS[d];
            if (cells[(y + dy) * w + (x + dx)] !== CELL_WALL) continue;
            if ((x + (d === "N" ? 0 : 1)) % 2 !== 0) continue;
            if (usedFaces.has(faceKey(x, y, d))) continue;
            usedFaces.add(faceKey(x, y, d));
            decor.push({ kind: "porte", x, y, dir: d, variant: floorNo * 100 + (x % 99) + 1 });
          }
          continue;
        }
        if (kind !== null) continue;
        const alongX = !isSolidAt(x - 1, y) && !isSolidAt(x + 1, y) && isSolidAt(x, y - 1) && isSolidAt(x, y + 1);
        const alongY = !isSolidAt(x, y - 1) && !isSolidAt(x, y + 1) && isSolidAt(x - 1, y) && isSolidAt(x + 1, y);
        if (!alongX && !alongY) continue;
        for (const d of (alongX ? ["N", "S"] : ["E", "W"]) as Dir[]) {
          const [dx, dy] = DIRS[d];
          if (cells[(y + dy) * w + (x + dx)] !== CELL_WALL) continue;
          if (hrng() > 0.25 || usedFaces.has(faceKey(x, y, d))) continue;
          usedFaces.add(faceKey(x, y, d));
          decor.push({ kind: "porte", x, y, dir: d, variant: floorNo * 100 + randInt(hrng, 1, 60) });
        }
      }
    }

    // Decor propre aux salles marquantes, avant le decor seme au hasard.
    if (rooms.length > 0) {
      const zrng = mulberry32((seed ^ 0x2d0e5a) + def.width * 71);
      const onFloor = (kind: DecorKind, i: number, variant: number) => {
        if (usedFloor.has(i) || water[i]) return;
        usedFloor.add(i);
        decor.push({ kind, x: i % w, y: Math.floor(i / w), dir: "N", variant });
      };
      const onCeiling = (kind: DecorKind, i: number, variant: number) => {
        if (usedCeiling.has(i)) return;
        usedCeiling.add(i);
        decor.push({ kind, x: i % w, y: Math.floor(i / w), dir: "N", variant });
      };
      for (const r of rooms) {
        const horizontal = r.x1 - r.x0 >= r.y1 - r.y0;
        for (let y = r.y0; y <= r.y1; y++) {
          for (let x = r.x0; x <= r.x1; x++) {
            const i = y * w + x;
            if (cells[i] !== CELL_OPEN || distance[i] < 0 || inStairwell(y)) continue;
            if (r.kind === "guirlandes") {
              // Une guirlande par case, tendue en travers du couloir.
              onCeiling("guirlande", i, horizontal ? 1 : 0);
            } else if (r.kind === "ballons") {
              if (zrng() < 0.7) onCeiling("ballons", i, randInt(zrng, 0, 3));
              if (zrng() < 0.35) onFloor("ballon", i, randInt(zrng, 0, 3));
            } else if (r.kind === "gateau") {
              const roll = zrng();
              if (roll < 0.3) onFloor("cadeau", i, randInt(zrng, 0, 3));
              else if (roll < 0.55) onFloor("confettis", i, randInt(zrng, 0, 3));
            } else if (r.kind === "hall-noir") {
              if (zrng() < 0.22) onFloor("traces", i, randInt(zrng, 0, 3));
            } else if (r.kind === "chaufferie" || r.kind === "vannes") {
              if (zrng() < (r.kind === "vannes" ? 0.14 : 0.18)) onFloor("flaque", i, randInt(zrng, 0, 3));
            } else if (r.kind === "neons-morts") {
              // Des dalles de plafond tombees, quelques feuilles : personne n'a rallume.
              const roll = zrng();
              if (roll < 0.1) onCeiling("dalle", i, randInt(zrng, 0, 3));
              else if (roll < 0.15) onFloor("papiers", i, randInt(zrng, 0, 3));
            } else if (r.kind === "reunion") {
              if (zrng() < 0.22) onFloor("papiers", i, randInt(zrng, 0, 3));
            } else if (r.kind === "reception") {
              if (zrng() < 0.05) onFloor("papiers", i, randInt(zrng, 0, 3));
            } else if (r.kind === "caisses") {
              if (zrng() < 0.05) onFloor("flaque", i, randInt(zrng, 0, 3));
            }
            // Aux murs : manometres dans la chaufferie et chez les vannes,
            // griffures dans le hall des Chiens, tableaux a la reception.
            const wallKind: DecorKind | null =
              r.kind === "chaufferie" || r.kind === "vannes"
                ? "manometre"
                : r.kind === "hall-noir"
                  ? "griffures"
                  : r.kind === "reception"
                    ? "tableau"
                    : null;
            if (!wallKind) continue;
            const chance = wallKind === "tableau" ? 0.12 : 0.3;
            for (const d of wallDirs(cells, w, h, x, y)) {
              if (zrng() > chance || usedFaces.has(faceKey(x, y, d))) continue;
              usedFaces.add(faceKey(x, y, d));
              decor.push({ kind: wallKind, x, y, dir: d, variant: randInt(zrng, 0, 3) });
            }
          }
        }
        // Salle de reunion : le tableau au mur du bout de la table (sinon, au
        // premier mur libre de la salle).
        if (r.kind === "reunion") {
          const table = props.find((p) => p.kind === "table" && p.x0 >= r.x0 && p.x1 <= r.x1 && p.y0 >= r.y0 && p.y1 <= r.y1);
          const ty = table ? table.y0 : Math.floor((r.y0 + r.y1) / 2);
          const faces: WallSpot[] = [
            { x: r.x0, y: ty, dir: "W" },
            { x: r.x1, y: ty, dir: "E" },
          ];
          for (let y = r.y0; y <= r.y1; y++) {
            for (let x = r.x0; x <= r.x1; x++) {
              if (x === r.x0 || x === r.x1 || y === r.y0 || y === r.y1) for (const d of wallDirs(cells, w, h, x, y)) faces.push({ x, y, dir: d });
            }
          }
          const board = faces.find(
            (f) =>
              cells[f.y * w + f.x] === CELL_OPEN &&
              wallDirs(cells, w, h, f.x, f.y).includes(f.dir) &&
              !usedFaces.has(faceKey(f.x, f.y, f.dir)),
          );
          if (board) {
            usedFaces.add(faceKey(board.x, board.y, board.dir));
            decor.push({ kind: "tableau", x: board.x, y: board.y, dir: board.dir, variant: randInt(zrng, 0, 3) });
          }
        }
      }
    }

    for (const [kind, every] of DECOR_PLAN[def.id]) {
      const count = Math.round(pool.length / every);
      const place = DECOR_PLACE[kind];
      for (let n = 0; n < count; n++) {
        for (let attempt = 0; attempt < 8; attempt++) {
          const i = pool[Math.floor(drng() * pool.length)];
          const x = i % w;
          const y = (i - x) / w;
          const dirs = wallDirs(cells, w, h, x, y).filter((d) => !usedFaces.has(faceKey(x, y, d)));
          if (place === "mur" || kind === "palette") {
            if (dirs.length === 0) continue;
            if (kind === "palette" && usedFloor.has(i)) continue;
            const dir = dirs[Math.floor(drng() * dirs.length)];
            usedFaces.add(faceKey(x, y, dir));
            if (kind === "palette") usedFloor.add(i);
            decor.push({ kind, x, y, dir, variant: randInt(drng, 0, 3) });
            break;
          }
          // Rien a plat au fond des bassins : ni flaque dans l'eau, ni grille.
          if (place === "sol" && water[i]) continue;
          const used = place === "sol" ? usedFloor : usedCeiling;
          if (used.has(i)) continue;
          used.add(i);
          decor.push({ kind, x, y, dir: "N", variant: randInt(drng, 0, 3) });
          break;
        }
      }
    }
  }

  // Regard de depart : vers la plus longue ligne droite libre.
  let startYaw = 0;
  let longest = -1;
  for (const d of Object.keys(DIRS) as Dir[]) {
    const [dx, dy] = DIRS[d];
    let len = 0;
    while (!isSolidCell(cells, w, h, start.x + dx * (len + 1), start.y + dy * (len + 1))) len++;
    if (len > longest) {
      longest = len;
      startYaw = Math.atan2(-dx, -dy);
    }
  }

  return {
    def,
    width: w,
    height: h,
    cells,
    start,
    startYaw,
    exit,
    lights,
    pickups,
    valves,
    arrows,
    entityStart,
    distance,
    groundRows: stairRows > 0 ? groundRows : h,
    stairRows,
    stairs,
    decor,
    water,
    zones,
    rooms,
    props,
    figures,
  };
}
