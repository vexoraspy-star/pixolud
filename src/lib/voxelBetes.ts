// Cubes — les animaux et les habitants des villages.
//
// Des creatures ORIGINALES : vache rousse a clochette, mouton a tete noire,
// poule rousse, canard colvert ; habitants vetus selon leur metier (chapeau
// de paille, toque, tablier de cuir, cape de berger, foulard), aux
// proportions et aux visages a nous. Rien ici ne reprend la silhouette, le
// visage ou la tenue des personnages d'un autre jeu.
//
// Comme voxelMobs.ts (dont il partage les petits outils de modelage), ce
// module ne connait pas le monde : la scene lui donne un BetesWorld. Memes
// regles du Mode 3D : Lambert seulement, textures au canvas, lacet calcule a
// la main, rien d'alloue a chaque image.
//
// Les animaux paissent, fuient quand on les frappe et donnent viande, cuir,
// laine ou plumes (en survie). Les habitants ne craignent rien : ils se
// promenent dans leur village le jour, rentrent chez eux la nuit, et
// proposent des echanges quand on leur parle (clic droit).

import * as THREE from "three";
import { box, grainTexture, merge, rayBox } from "./voxelMobs";
import { CITROUILLE, FEUILLES, HERBE, LAINE_BLANCHE, laine, type Biome } from "./voxel";
import {
  BLE, BOUSSOLE, CHARBON_ITEM, COOKIE, CUIR, DIAMANT_ITEM, FICELLE, GATEAU, GRAINES, HORLOGE, LINGOT_FER, LINGOT_OR, OS,
  PAIN, PEPITE_OR, PLUME, POMME, POMME_DOREE, SUCRE, TARTE_CITROUILLE, VIANDE_CRUE, armure, outil, type ThingId,
} from "./voxelItems";
import type { Porte, Village } from "./voxelVillages";

export type Espece = "vache" | "mouton" | "poule" | "canard";
export type Metier = "fermier" | "boulanger" | "forgeron" | "berger" | "marchand";
type Sorte = Espece | "habitant";

export interface BetesWorld {
  /** Collision d'une boite (pieds en y, hauteur h, rayon r) avec les blocs solides. */
  collides(x: number, y: number, z: number, h: number, r: number): boolean;
  isLoaded(x: number, z: number): boolean;
  /** Bloc de la case entiere. */
  blockAt(x: number, y: number, z: number): number;
  solidAt(x: number, y: number, z: number): boolean;
  liquidAt(x: number, y: number, z: number): boolean;
  /** Luminosite 0..1 a appliquer aux materiaux. */
  brightness(x: number, y: number, z: number): number;
  isDay(): boolean;
  biomeAt(x: number, z: number): Biome;
  /** Le village dont l'emprise, elargie de `marge`, contient le point. */
  villageA(x: number, z: number, marge: number): Village | null;
}

export type CriBete = "vache" | "mouton" | "poule" | "canard" | "habitant" | "touche";

export interface BetesEvents {
  /** Butin d'un animal (la scene ne le donne qu'en survie). */
  drop(thing: ThingId, count: number): void;
  sound(kind: CriBete): void;
}

/** Un echange : ce que le joueur donne, ce qu'il recoit. */
export interface Offre {
  donne: [ThingId, number][];
  recoit: [ThingId, number];
}

export interface Habitant {
  nom: string;
  /** Metier accorde au prenom (« Boulangere »). */
  titre: string;
  metier: Metier;
  village: string;
  /** Ce qu'il dit quand on lui parle. */
  phrase: string;
  offres: Offre[];
}

export interface Betes {
  /** A appeler souvent : fait venir des animaux autour du joueur, et les habitants du village proche. */
  peupler(player: { x: number; y: number; z: number }): void;
  update(dt: number, player: { x: number; y: number; z: number }): void;
  /** Coup au corps a corps : vrai si une creature est touchee. */
  hitMelee(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, reach: number, damage: number): boolean;
  /** Distance de la creature visee la plus proche le long du rayon (Infinity si aucune). */
  rayDistance(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, reach: number): number;
  /** Clic droit : l'habitant vise (il se tourne vers le joueur et le salue), ou null. */
  parler(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, reach: number): Habitant | null;
  count(): number;
  clear(): void;
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Reglages
// ---------------------------------------------------------------------------

const MAX_ANIMAUX = 10;
/** Au-dela, un animal est retire sans bruit (il en reviendra d'autres). */
const DISPARITION = 72;
/** Les habitants restent tant que le joueur est a moins de cette distance du centre de leur village. */
const RESTE_VILLAGE = 90;
const HABITANTS_PAR_VILLAGE = 6;
const GRAVITE = 22;
const TOURNE = 6;
const ECLAT = 0.35;
const CHUTE = 0.6;
const ROUGE = 0xff3030;
const VOISINS4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

interface Spec {
  /** Boite de collision : hauteur et rayon. */
  h: number;
  r: number;
  /** Hauteur des yeux (regard vers le joueur). */
  yeux: number;
  vitesse: number;
  fuite: number;
  pv: number;
  /** Radians de cycle de marche par bloc parcouru. */
  foulee: number;
  /** Flotte a la surface de l'eau (canard). */
  nage: boolean;
}

const SPECS: Record<Sorte, Spec> = {
  vache: { h: 1.3, r: 0.42, yeux: 1.05, vitesse: 0.9, fuite: 3.2, pv: 10, foulee: 4, nage: false },
  mouton: { h: 1.1, r: 0.38, yeux: 0.9, vitesse: 0.9, fuite: 3.4, pv: 8, foulee: 4.5, nage: false },
  poule: { h: 0.8, r: 0.22, yeux: 0.65, vitesse: 0.8, fuite: 3.6, pv: 4, foulee: 7, nage: false },
  canard: { h: 0.75, r: 0.26, yeux: 0.6, vitesse: 0.75, fuite: 3.2, pv: 4, foulee: 7, nage: true },
  habitant: { h: 1.75, r: 0.3, yeux: 1.5, vitesse: 1.25, fuite: 3.4, pv: Infinity, foulee: 4.5, nage: false },
};

/** Pixel des animaux et des habitants, en blocs. */
const P = 1 / 16;
const HP = 1.75 / 31;

// Couleurs (sRGB). Vache rousse au chanfrein blanc, pattes blanches, clochette au cou.
const V_ROUX = 0x9c4f2b, V_ROUX_SOMBRE = 0x6e3418, V_BLANC = 0xf0e8da, V_MUSEAU = 0xd9a08a, V_NARINE = 0x5a2f26;
const V_CORNE = 0xe8dcc0, V_SABOT = 0x3a2a22, V_CLOCHE = 0xe0b13a, V_COLLIER = 0x5b3a22;
// Mouton : laine creme bouclee (ou brune), tete et pattes noires.
const M_LAINE = 0xebe3cf, M_LAINE_OMBRE = 0xd2c8b0, M_LAINE_BRUNE = 0x8a6a4a, M_LAINE_BRUNE_OMBRE = 0x6f5338, M_NOIR = 0x2a2422, M_OEIL = 0xd9cfb8;
// Poule rousse a crete rouge.
const PO_ROUX = 0xb5562c, PO_AILE = 0x8e3f1f, PO_QUEUE = 0x3e2a1c, PO_CREME = 0xe8cfa0, PO_CRETE = 0xd8302a, PO_BEC = 0xe7b33a;
// Canard colvert.
const C_CORPS = 0x8b7d6b, C_DOS = 0x6e6252, C_POITRAIL = 0x7a4a32, C_VERT = 0x2e6b3d, C_COLLIER = 0xf2efe6, C_BEC = 0xe8b026, C_PATTE = 0xe58a2a, C_QUEUE = 0x3a3a3a;
const NOIR = 0x1b1b1d, BLANC_OEIL = 0xf3f1ea;

// ---------------------------------------------------------------------------
// Petits outils
// ---------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function wrap(a: number): number {
  return a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2));
}

function melange(a: number, b: number, c: number): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

// ---------------------------------------------------------------------------
// Les habitants : qui ils sont, ce qu'ils proposent
// ---------------------------------------------------------------------------

const METIERS: Metier[] = ["fermier", "boulanger", "forgeron", "berger", "marchand"];

const TITRES: Record<Metier, [string, string]> = {
  fermier: ["Fermier", "Fermière"],
  boulanger: ["Boulanger", "Boulangère"],
  forgeron: ["Forgeron", "Forgeronne"],
  berger: ["Berger", "Bergère"],
  marchand: ["Marchand", "Marchande"],
};

const PRENOMS: [string, boolean][] = [
  ["Lucie", true], ["Hugo", false], ["Manon", true], ["Jules", false], ["Chloé", true], ["Louis", false], ["Inès", true],
  ["Léo", false], ["Emma", true], ["Nathan", false], ["Jade", true], ["Gabriel", false], ["Rose", true], ["Arthur", false],
  ["Léna", true], ["Paul", false], ["Zoé", true], ["Victor", false], ["Alice", true], ["Marius", false], ["Louise", true],
  ["Théo", false], ["Margaux", true], ["Noé", false], ["Anna", true], ["Simon", false],
];

const PHRASES: Record<Metier, string[]> = {
  fermier: [
    "Laboure la terre avec une houe, puis sème tes graines : le blé pousse tout seul.",
    "Mes vaches et mes moutons broutent dans les prés autour du village.",
    "Une bonne récolte, et on ne manque jamais de pain !",
  ],
  boulanger: [
    "Le four du village chauffe dès l’aube. Ça sent bon, non ?",
    "Trois épis de blé font un pain. Avec du sucre, ça devient un gâteau !",
    "La canne à sucre pousse au bord de l’eau.",
  ],
  forgeron: [
    "Le fer se cache sous la terre. Fais-le fondre au four pour en tirer des lingots.",
    "Une bonne pioche en fer, et la montagne s’ouvre devant toi.",
    "Les lanternes du village éloignent les monstres la nuit.",
  ],
  berger: [
    "Les moutons donnent de la laine pour un bon lit bien chaud.",
    "Les bêtes s’enfuient quand on les brusque. Approche-toi doucement.",
    "Avec une plume, une flèche vole droit : on en fabrique deux fois plus.",
  ],
  marchand: [
    "J’achète et je vends un peu de tout. Fais-moi une offre !",
    "On dit que les araignées laissent de la ficelle derrière elles…",
    "Une boussole t’indique toujours le chemin de ton point de départ.",
  ],
};

/** Les echanges de chaque metier : de bonnes affaires, sans boucle qui rapporte a l'infini. */
const OFFRES: Record<Metier, Offre[]> = {
  fermier: [
    { donne: [[BLE, 6]], recoit: [PAIN, 4] },
    { donne: [[GRAINES, 10]], recoit: [POMME, 2] },
    { donne: [[BLE, 16], [POMME, 2]], recoit: [POMME_DOREE, 1] },
  ],
  boulanger: [
    { donne: [[BLE, 3], [SUCRE, 2]], recoit: [GATEAU, 1] },
    { donne: [[CITROUILLE, 1], [SUCRE, 1]], recoit: [TARTE_CITROUILLE, 2] },
    { donne: [[BLE, 4]], recoit: [COOKIE, 8] },
  ],
  forgeron: [
    { donne: [[CHARBON_ITEM, 6]], recoit: [LINGOT_FER, 1] },
    { donne: [[LINGOT_FER, 3]], recoit: [outil("pioche", "fer"), 1] },
    { donne: [[LINGOT_OR, 4]], recoit: [DIAMANT_ITEM, 1] },
  ],
  berger: [
    { donne: [[BLE, 4]], recoit: [LAINE_BLANCHE, 2] },
    { donne: [[LAINE_BLANCHE, 6]], recoit: [CUIR, 2] },
    { donne: [[CUIR, 4]], recoit: [armure("plastron", "cuir"), 1] },
  ],
  marchand: [
    { donne: [[FICELLE, 6]], recoit: [PEPITE_OR, 3] },
    { donne: [[OS, 6]], recoit: [PEPITE_OR, 3] },
    { donne: [[PEPITE_OR, 12]], recoit: [BOUSSOLE, 1] },
    { donne: [[PEPITE_OR, 18]], recoit: [HORLOGE, 1] },
  ],
};

interface Identite {
  habitant: Habitant;
  femme: boolean;
  graine: number;
}

/** L'habitant de la i-eme maison d'un village : toujours le meme, d'une visite a l'autre. */
export function habitantDe(v: Village, i: number): Identite {
  const graine = melange(v.rx, v.rz, i * 7919 + 17);
  const decalage = melange(v.rx, v.rz, 99) % METIERS.length;
  const metier = METIERS[(i + decalage) % METIERS.length];
  const [prenom, femme] = PRENOMS[graine % PRENOMS.length];
  const phrases = PHRASES[metier];
  return {
    habitant: {
      nom: prenom,
      titre: TITRES[metier][femme ? 1 : 0],
      metier,
      village: v.nom,
      phrase: phrases[(graine >>> 8) % phrases.length],
      offres: OFFRES[metier],
    },
    femme,
    graine,
  };
}

// ---------------------------------------------------------------------------
// Modeles en cubes
// ---------------------------------------------------------------------------

function geometriesAnimaux() {
  const mouton = (laineC: number, ombre: number) => ({
    corps: merge([
      box(P, 10, 8.5, 13, 0, 0, 0, laineC),
      box(P, 3, 1, 3, -2.2, 4.6, 2.5, ombre),
      box(P, 3, 1, 3.5, 2.4, 4.6, -2.8, ombre),
      box(P, 2.5, 1, 2.5, 0.2, 4.6, -0.2, ombre),
      box(P, 1, 3, 3, 5.4, 0.5, 1, ombre),
      box(P, 1, 3, 3, -5.4, -0.8, -2.5, ombre),
    ]),
    tete: merge([
      box(P, 5, 6, 5, 0, 0, 2.5, M_NOIR),
      box(P, 6, 2, 4, 0, 3.4, 1.2, laineC),
      box(P, 2.4, 1, 1.6, -3.4, 1.4, 1.6, M_NOIR),
      box(P, 2.4, 1, 1.6, 3.4, 1.4, 1.6, M_NOIR),
      box(P, 1, 0.8, 0.3, -1.3, 1, 5.15, M_OEIL),
      box(P, 1, 0.8, 0.3, 1.3, 1, 5.15, M_OEIL),
    ]),
    queue: box(P, 2.2, 2.2, 2, 0, -1, 0, laineC),
  });
  return {
    vCorps: merge([
      box(P, 10, 10, 18, 0, 0, 0, V_ROUX),
      box(P, 10.2, 3, 16, 0, -3.6, 0, V_BLANC),
      box(P, 8, 1, 12, 0, -5.2, 0, V_BLANC),
    ]),
    vPatte: merge([box(P, 3, 7, 3, 0, -3.5, 0, V_BLANC), box(P, 3.2, 1.2, 3.2, 0, -7.4, 0, V_SABOT)]),
    vTete: merge([
      box(P, 7, 7, 6, 0, 0, 3, V_ROUX),
      box(P, 3, 5.5, 0.4, 0, 0.6, 6.2, V_BLANC),
      box(P, 5, 3, 2, 0, -2.2, 6.6, V_MUSEAU),
      box(P, 1, 1, 0.3, -1.2, -2.2, 7.7, V_NARINE),
      box(P, 1, 1, 0.3, 1.2, -2.2, 7.7, V_NARINE),
      box(P, 1.2, 1.2, 0.3, -2.4, 1.4, 6.15, NOIR),
      box(P, 1.2, 1.2, 0.3, 2.4, 1.4, 6.15, NOIR),
      box(P, 1, 2.4, 1, -2.8, 4.4, 2, V_CORNE),
      box(P, 1, 2.4, 1, 2.8, 4.4, 2, V_CORNE),
      box(P, 2.4, 1.2, 1.2, -4.4, 1.8, 2, V_ROUX_SOMBRE),
      box(P, 2.4, 1.2, 1.2, 4.4, 1.8, 2, V_ROUX_SOMBRE),
      // Collier de cuir et clochette.
      box(P, 7.4, 1, 1.4, 0, -3.8, 1.6, V_COLLIER),
      box(P, 2.2, 2.4, 2.2, 0, -5.4, 2.2, V_CLOCHE),
    ]),
    vQueue: merge([box(P, 1, 7, 1, 0, -3.5, 0, V_ROUX_SOMBRE), box(P, 1.8, 2, 1.8, 0, -7.6, 0, V_ROUX_SOMBRE)]),
    mPatte: box(P, 2.5, 6, 2.5, 0, -3, 0, M_NOIR),
    mBlanc: mouton(M_LAINE, M_LAINE_OMBRE),
    mBrun: mouton(M_LAINE_BRUNE, M_LAINE_BRUNE_OMBRE),
    poCorps: merge([
      box(P, 6, 6, 7, 0, 0, 0, PO_ROUX),
      box(P, 1, 4, 5, -3.4, 0.3, -0.5, PO_AILE),
      box(P, 1, 4, 5, 3.4, 0.3, -0.5, PO_AILE),
      box(P, 5, 1, 5, 0, -3.2, 0.5, PO_CREME),
    ]),
    poPatte: merge([box(P, 1, 3, 1, 0, -1.5, 0, PO_BEC), box(P, 2, 0.6, 2.4, 0, -2.9, 0.4, PO_BEC)]),
    poTete: merge([
      box(P, 4, 5, 4, 0, 2, 1, PO_ROUX),
      box(P, 1.2, 2, 3, 0, 5.2, 1, PO_CRETE),
      box(P, 2, 1, 2, 0, 2, 3.9, PO_BEC),
      box(P, 1.2, 1.6, 1, 0, 0.6, 3.3, PO_CRETE),
      box(P, 0.3, 1, 1, -2.15, 2.9, 2, NOIR),
      box(P, 0.3, 1, 1, 2.15, 2.9, 2, NOIR),
    ]),
    poQueue: merge([box(P, 4, 5, 1.6, 0, 2.5, 0, PO_QUEUE), box(P, 3, 2, 1.6, 0, 5.5, -0.4, PO_QUEUE)]),
    cCorps: merge([
      box(P, 6, 5, 9, 0, 0, 0, C_CORPS),
      box(P, 5, 0.6, 6.5, 0, 2.6, -0.8, C_DOS),
      box(P, 5, 4, 2, 0, -0.2, 4.4, C_POITRAIL),
      box(P, 3, 2, 2.4, 0, 1.6, -5.4, C_QUEUE),
      box(P, 1, 3, 5, -3.4, 0.3, -1, C_DOS),
      box(P, 1, 3, 5, 3.4, 0.3, -1, C_DOS),
    ]),
    cPatte: merge([box(P, 1, 2, 1, 0, -1, 0, C_PATTE), box(P, 2.2, 0.5, 2.6, 0, -2, 0.6, C_PATTE)]),
    cTete: merge([
      box(P, 2.6, 3, 2.6, 0, 0.5, 0.4, C_VERT),
      box(P, 3, 0.8, 3, 0, -0.9, 0.4, C_COLLIER),
      box(P, 4, 4, 4.4, 0, 3.6, 1.2, C_VERT),
      box(P, 2.6, 1, 3, 0, 2.8, 4.6, C_BEC),
      box(P, 0.3, 0.9, 0.9, -2.15, 4.2, 2, NOIR),
      box(P, 0.3, 0.9, 0.9, 2.15, 4.2, 2, NOIR),
    ]),
  };
}

type GeosAnimaux = ReturnType<typeof geometriesAnimaux>;

const PEAUX = [0xf1c9a5, 0xe2b48c, 0xc68a5e, 0x9a6440, 0x6e4529];
const CHEVEUX = [0x2b2018, 0x5a3a22, 0x8a5a2b, 0xc9a25a, 0x3a3a3a, 0xa8432a];

/** Tenue d'un metier : haut, manches, bas, chaussures, et une couleur de piece distinctive. */
const TENUES: Record<Metier, { haut: number; manche: number; bas: number; pied: number; piece: number }> = {
  fermier: { haut: 0xe8dcc0, manche: 0xe8dcc0, bas: 0x3d5a8a, pied: 0x5a3a24, piece: 0x3d5a8a },
  boulanger: { haut: 0xd9c7a3, manche: 0xd9c7a3, bas: 0x6b5b4b, pied: 0x3a2a22, piece: 0xf4f1e8 },
  forgeron: { haut: 0x4a4a52, manche: 0x4a4a52, bas: 0x2e2e33, pied: 0x1f1f22, piece: 0x6b4423 },
  berger: { haut: 0x7a5a3a, manche: 0x7a5a3a, bas: 0x4f5a34, pied: 0x5a3a24, piece: 0x3f6b3a },
  marchand: { haut: 0xe8c547, manche: 0xe8c547, bas: 0x7a3f8a, pied: 0x5a2a1a, piece: 0xc4402f },
};

/** Un habitant a ses propres couleurs : ses geometries lui appartiennent (liberees a son depart). */
function geometriesHabitant(metier: Metier, femme: boolean, graine: number) {
  const t = TENUES[metier];
  const peau = PEAUX[graine % PEAUX.length];
  const ombre = new THREE.Color(peau).multiplyScalar(0.82).getHex();
  const cheveux = CHEVEUX[(graine >>> 4) % CHEVEUX.length];
  const longs = femme ? (graine >>> 9) % 3 !== 0 : (graine >>> 9) % 9 === 0;
  const tete = [
    box(HP, 8, 8, 8, 0, 4, 0, peau),
    box(HP, 1.6, 1.4, 0.3, -1.9, 4.3, 4.15, BLANC_OEIL),
    box(HP, 1.6, 1.4, 0.3, 1.9, 4.3, 4.15, BLANC_OEIL),
    box(HP, 0.8, 1.2, 0.3, -1.6, 4.3, 4.3, NOIR),
    box(HP, 0.8, 1.2, 0.3, 1.6, 4.3, 4.3, NOIR),
    box(HP, 1, 1.2, 0.6, 0, 3.1, 4.3, ombre),
    box(HP, 2.4, 0.5, 0.3, 0, 1.7, 4.15, 0x8a4a3a),
    box(HP, 8.4, 2.2, 8.4, 0, 7.5, -0.2, cheveux),
    box(HP, 8.4, longs ? 9 : 5, 1.4, 0, longs ? 3 : 5, -3.7, cheveux),
    box(HP, 1.2, 3, 7, -4.3, 5.6, -0.6, cheveux),
    box(HP, 1.2, 3, 7, 4.3, 5.6, -0.6, cheveux),
  ];
  const corps = [box(HP, 8, 11, 4.5, 0, 0, 0, t.haut)];
  const bras = (droit: boolean) => {
    const parts = metier === "forgeron"
      ? [box(HP, 3, 5, 3, 0, -2.5, 0, t.manche), box(HP, 3, 6, 3, 0, -8, 0, peau)]
      : [box(HP, 3, 10, 3, 0, -5, 0, t.manche), box(HP, 3.1, 2, 3.1, 0, -11, 0, peau)];
    // Le baton du berger, dans la main droite.
    if (droit && metier === "berger") parts.push(box(HP, 1, 24, 1, 0, -10, 2.2, 0x8a6a45));
    return merge(parts);
  };
  switch (metier) {
    case "fermier":
      // Chapeau de paille a ruban, salopette a bretelles.
      tete.push(box(HP, 13, 0.8, 13, 0, 8.4, 0, 0xd9b54a), box(HP, 8.6, 3, 8.6, 0, 10.2, 0, 0xd9b54a), box(HP, 8.8, 0.9, 8.8, 0, 9.2, 0, 0xb5342c));
      corps.push(box(HP, 8.2, 5.5, 4.7, 0, -2.75, 0, t.piece), box(HP, 1.2, 5.5, 4.7, -2.4, 2.75, 0, t.piece), box(HP, 1.2, 5.5, 4.7, 2.4, 2.75, 0, t.piece));
      break;
    case "boulanger":
      // Toque blanche, tablier, moustache pour les messieurs.
      tete.push(box(HP, 7.6, 4.5, 7.6, 0, 10.4, 0, t.piece), box(HP, 8.8, 2.2, 8.8, 0, 13.6, 0, t.piece));
      if (!femme) tete.push(box(HP, 4, 0.9, 0.3, 0, 2.4, 4.25, cheveux));
      corps.push(box(HP, 6.5, 9.5, 0.5, 0, -1.2, 2.5, t.piece));
      break;
    case "forgeron":
      // Bandeau rouge, grand tablier de cuir, manches retroussees.
      tete.push(box(HP, 8.7, 1.8, 8.7, 0, 7.4, 0, 0xb5342c), box(HP, 1.6, 1.6, 1.6, 0, 7, -4.8, 0xb5342c));
      corps.push(box(HP, 7, 10, 0.6, 0, -0.8, 2.55, t.piece));
      break;
    case "berger":
      // Capuche et cape vertes, ceinture.
      tete.push(
        box(HP, 9.2, 1.4, 9.2, 0, 8.8, -0.3, t.piece),
        box(HP, 9.2, 8.6, 1.4, 0, 4.5, -4.7, t.piece),
        box(HP, 1.4, 8.6, 9, -4.7, 4.5, -0.4, t.piece),
        box(HP, 1.4, 8.6, 9, 4.7, 4.5, -0.4, t.piece),
      );
      corps.push(box(HP, 8.6, 12, 1, 0, -0.6, -2.8, t.piece), box(HP, 8.3, 1, 4.8, 0, -3.2, 0, 0x4a3020));
      break;
    case "marchand":
      // Foulard rouge, ceinture doree, jupe longue pour les dames.
      tete.push(box(HP, 8.7, 2.2, 8.7, 0, 7.6, 0, t.piece), box(HP, 5, 3.5, 1.2, 0, 5.4, -4.6, t.piece));
      corps.push(box(HP, 8.3, 1, 4.8, 0, -3.5, 0, 0xc9a13a));
      if (femme) corps.push(box(HP, 9, 8, 5.6, 0, -9.3, 0, t.bas));
      break;
  }
  return {
    tete: merge(tete),
    corps: merge(corps),
    brasDroit: bras(true),
    brasGauche: bras(false),
    jambe: merge([box(HP, 3.5, 10, 3.5, 0, -5, 0, t.bas), box(HP, 3.7, 2, 4.4, 0, -9.2, 0.4, t.pied)]),
  };
}

interface Rig {
  root: THREE.Group;
  tete: THREE.Object3D;
  pattes: THREE.Object3D[];
  bras: THREE.Object3D[];
  queue: THREE.Object3D | null;
  /** Geometries propres a cette creature (habitants), a liberer. */
  propres: THREE.BufferGeometry[];
}

function rigAnimal(espece: Espece, brun: boolean, mat: THREE.Material, G: GeosAnimaux): Rig {
  const root = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x * P, y * P, z * P);
    root.add(m);
    return m;
  };
  let rig: Rig;
  switch (espece) {
    case "vache": {
      const pattes = [[3.3, 6], [-3.3, 6], [3.3, -6], [-3.3, -6]].map(([x, z]) => add(G.vPatte, x, 8, z));
      add(G.vCorps, 0, 13, 0);
      const queue = add(G.vQueue, 0, 17, -9.2);
      queue.rotation.x = 0.25;
      rig = { root, tete: add(G.vTete, 0, 15.5, 9), pattes, bras: [], queue, propres: [] };
      break;
    }
    case "mouton": {
      const g = brun ? G.mBrun : G.mBlanc;
      const pattes = [[2.8, 4.3], [-2.8, 4.3], [2.8, -4.3], [-2.8, -4.3]].map(([x, z]) => add(G.mPatte, x, 6, z));
      add(g.corps, 0, 10.3, 0);
      rig = { root, tete: add(g.tete, 0, 12.5, 6.5), pattes, bras: [], queue: add(g.queue, 0, 13, -6.6), propres: [] };
      break;
    }
    case "poule": {
      const pattes = [add(G.poPatte, 1.2, 3, 0.3), add(G.poPatte, -1.2, 3, 0.3)];
      add(G.poCorps, 0, 6, 0);
      const queue = add(G.poQueue, 0, 7.5, -3.6);
      queue.rotation.x = -0.5;
      rig = { root, tete: add(G.poTete, 0, 8.5, 2.6), pattes, bras: [], queue, propres: [] };
      break;
    }
    case "canard": {
      const pattes = [add(G.cPatte, 1.3, 2, 0), add(G.cPatte, -1.3, 2, 0)];
      add(G.cCorps, 0, 4.5, 0);
      rig = { root, tete: add(G.cTete, 0, 7, 4), pattes, bras: [], queue: null, propres: [] };
      break;
    }
  }
  rig.tete.rotation.order = "YXZ";
  return rig;
}

function rigHabitant(id: Identite, mat: THREE.Material): Rig {
  const g = geometriesHabitant(id.habitant.metier, id.femme, id.graine);
  const root = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x * HP, y * HP, z * HP);
    root.add(m);
    return m;
  };
  const pattes = [add(g.jambe, 2, 10, 0), add(g.jambe, -2, 10, 0)];
  add(g.corps, 0, 15.5, 0);
  // Bras droit (cote -x quand il regarde vers +z), puis bras gauche.
  const bras = [add(g.brasDroit, -5.5, 20.5, 0), add(g.brasGauche, 5.5, 20.5, 0)];
  const tete = add(g.tete, 0, 21, 0);
  tete.rotation.order = "YXZ";
  for (const b of bras) b.rotation.order = "XYZ";
  return { root, tete, pattes, bras, queue: null, propres: [g.tete, g.corps, g.brasDroit, g.brasGauche, g.jambe] };
}

// ---------------------------------------------------------------------------
// Etat d'une creature
// ---------------------------------------------------------------------------

interface Creature {
  sorte: Sorte;
  spec: Spec;
  group: THREE.Group;
  tilt: THREE.Group;
  rig: Rig;
  material: THREE.MeshLambertMaterial;
  graine: number;
  pv: number;
  vy: number;
  kx: number;
  kz: number;
  sol: boolean;
  lacet: number;
  teteLacet: number;
  teteTangage: number;
  pas: number;
  allure: number;
  eclat: number;
  lumiere: number;
  /** Promenade : temps restant, direction, vitesse. */
  promT: number;
  dirX: number;
  dirZ: number;
  vitesse: number;
  /** Tete baissee (broute, picore) : temps restant. */
  broute: number;
  fuiteT: number;
  fuiteX: number;
  fuiteZ: number;
  cri: number;
  coince: number;
  detourT: number;
  detourCote: number;
  mort: boolean;
  mortT: number;
  /** Mouton : la laine qu'il donne. */
  laine: number;
  // Habitants.
  identite: Identite | null;
  village: Village | null;
  porte: Porte | null;
  cle: string;
  /** Se tourne vers le joueur qui lui parle : temps restant. */
  parleT: number;
  /** Chemin a suivre (cases x, z a la suite) et etape en cours. */
  chemin: number[];
  etape: number;
  /** Temps avant de choisir un nouveau but de promenade. */
  cibleT: number;
  arrive: boolean;
  /** Le but a ete choisi de nuit (rentrer chez soi). */
  nuit: boolean;
}

// ---------------------------------------------------------------------------
// Le gestionnaire
// ---------------------------------------------------------------------------

export function createBetes(scene: THREE.Scene, world: BetesWorld, events: BetesEvents): Betes {
  const G = geometriesAnimaux();
  const grain = grainTexture();
  const liste: Creature[] = [];
  /** Habitants presents (village et maison), pour ne jamais les doubler. */
  const presents = new Set<string>();
  let disposed = false;
  let clock = 0;
  let prochainAnimal = performance.now() + 1500;
  let prochainVillage = 0;

  // ------------------------------------------------------------ apparition
  function creer(sorte: Sorte, x: number, y: number, z: number, rig: Rig, material: THREE.MeshLambertMaterial, identite: Identite | null): Creature {
    const spec = SPECS[sorte];
    const group = new THREE.Group();
    const tilt = new THREE.Group();
    tilt.add(rig.root);
    group.add(tilt);
    const lacet = Math.random() * Math.PI * 2;
    group.position.set(x, y, z);
    group.rotation.y = lacet;
    // Pour s'y retrouver dans la scene (outils de developpement, essais).
    group.userData.sorte = sorte;
    scene.add(group);
    const lumiere = world.brightness(x, y + spec.h * 0.6, z);
    material.color.setScalar(Math.max(0.05, lumiere));
    const c: Creature = {
      sorte, spec, group, tilt, rig, material, graine: Math.random() * 100, pv: spec.pv, vy: 0, kx: 0, kz: 0, sol: false,
      lacet, teteLacet: 0, teteTangage: 0, pas: 0, allure: 0, eclat: 0, lumiere,
      promT: Math.random() * 2, dirX: 0, dirZ: 1, vitesse: 0, broute: 0, fuiteT: 0, fuiteX: 0, fuiteZ: 0,
      cri: 4 + Math.random() * 10, coince: 0, detourT: 0, detourCote: 1, mort: false, mortT: 0, laine: LAINE_BLANCHE,
      identite, village: null, porte: null, cle: "", parleT: 0, chemin: [], etape: 0, cibleT: 0, arrive: true, nuit: false,
    };
    liste.push(c);
    return c;
  }

  function animal(espece: Espece, x: number, y: number, z: number) {
    const brun = espece === "mouton" && Math.random() < 0.25;
    const material = new THREE.MeshLambertMaterial({ map: grain, vertexColors: true });
    const c = creer(espece, x, y, z, rigAnimal(espece, brun, material, G), material, null);
    if (brun) c.laine = laine(12);
  }

  /** Premiere case libre au-dessus d'un sol solide, en descendant (null s'il n'y en a pas). */
  function solA(bx: number, bz: number, yHaut: number, yBas: number): number | null {
    for (let y = yHaut; y >= yBas; y--) {
      if (!world.solidAt(bx, y - 1, bz) || world.solidAt(bx, y, bz) || world.solidAt(bx, y + 1, bz)) continue;
      if (world.liquidAt(bx, y, bz)) continue;
      return world.blockAt(bx, y - 1, bz) === FEUILLES ? null : y;
    }
    return null;
  }

  function presDeLEau(bx: number, y: number, bz: number): boolean {
    for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2], [3, 3], [-3, 3], [3, -3], [-3, -3]]) {
      if (world.liquidAt(bx + dx, y - 1, bz + dz) || world.liquidAt(bx + dx, y - 2, bz + dz)) return true;
    }
    return false;
  }

  function especeDu(biome: Biome, eau: boolean): Espece | null {
    const r = Math.random();
    switch (biome) {
      case "plaine": return eau && r < 0.35 ? "canard" : r < 0.4 ? "vache" : r < 0.7 ? "mouton" : "poule";
      case "foret": return eau && r < 0.35 ? "canard" : r < 0.45 ? "poule" : r < 0.75 ? "mouton" : "vache";
      case "montagne": return r < 0.6 ? "mouton" : "vache";
      case "neige": return "mouton";
      default: return null;
    }
  }

  function nbAnimaux() {
    let n = 0;
    for (const c of liste) if (c.sorte !== "habitant") n++;
    return n;
  }

  function peuplerAnimaux(px: number, py: number, pz: number) {
    if (nbAnimaux() >= MAX_ANIMAUX) return;
    const v = world.villageA(px, pz, 24);
    for (let essai = 0; essai < 4; essai++) {
      // Pres d'un village, des poules picorent autour de la place.
      const autourDuVillage = v && Math.random() < 0.35;
      const a = Math.random() * Math.PI * 2;
      const d = autourDuVillage ? 6 + Math.random() * 10 : 18 + Math.random() * 16;
      const cx = autourDuVillage ? v.x : px, cz = autourDuVillage ? v.z : pz;
      const bx = Math.floor(cx + Math.sin(a) * d), bz = Math.floor(cz + Math.cos(a) * d);
      if (!world.isLoaded(bx, bz) || (autourDuVillage && Math.hypot(bx + 0.5 - px, bz + 0.5 - pz) < 10)) continue;
      const y = solA(bx, bz, Math.floor(py) + 14, Math.max(1, Math.floor(py) - 16));
      if (y === null) continue;
      const herbe = world.blockAt(bx, y - 1, bz) === HERBE;
      const eau = presDeLEau(bx, y, bz);
      const espece = autourDuVillage ? "poule" : herbe ? especeDu(world.biomeAt(bx, bz), eau) : null;
      if (!espece) continue;
      const nombre = espece === "mouton" ? 2 + Math.floor(Math.random() * 3) : 2 + Math.floor(Math.random() * 2);
      let poses = 0;
      for (let k = 0; k < nombre * 3 && poses < nombre && nbAnimaux() < MAX_ANIMAUX; k++) {
        const qx = bx + Math.floor(Math.random() * 5) - 2, qz = bz + Math.floor(Math.random() * 5) - 2;
        if (!world.isLoaded(qx, qz)) continue;
        const qy = solA(qx, qz, y + 3, y - 3);
        if (qy === null) continue;
        const sp = SPECS[espece];
        if (world.collides(qx + 0.5, qy, qz + 0.5, sp.h, sp.r)) continue;
        animal(espece, qx + 0.5, qy, qz + 0.5);
        poses++;
      }
      if (poses) return;
    }
  }

  function peuplerVillage(px: number, pz: number) {
    const v = world.villageA(px, pz, 40);
    if (!v) return;
    const n = Math.min(HABITANTS_PAR_VILLAGE, v.portes.length);
    const nuit = !world.isDay();
    for (let i = 0; i < n; i++) {
      const cle = `${v.rx},${v.rz},${i}`;
      if (presents.has(cle)) continue;
      const p = v.portes[i];
      if (!world.isLoaded(p.x, p.z) || !world.isLoaded(p.x + p.dx * 2, p.z + p.dz * 2)) continue;
      // Le jour devant sa porte, la nuit dans sa maison.
      const x = p.x + 0.5 + (nuit ? p.dx * 2 : 0), z = p.z + 0.5 + (nuit ? p.dz * 2 : 0);
      if (world.collides(x, p.y, z, SPECS.habitant.h, SPECS.habitant.r)) continue;
      const identite = habitantDe(v, i);
      const material = new THREE.MeshLambertMaterial({ map: grain, vertexColors: true });
      const c = creer("habitant", x, p.y, z, rigHabitant(identite, material), material, identite);
      c.village = v;
      c.porte = p;
      c.cle = cle;
      c.cibleT = 2 + Math.random() * 4;
      presents.add(cle);
    }
  }

  // ------------------------------------------------------------ retrait
  function retirer(i: number) {
    const c = liste[i];
    scene.remove(c.group);
    c.material.dispose();
    for (const g of c.rig.propres) g.dispose();
    if (c.cle) presents.delete(c.cle);
    liste.splice(i, 1);
  }

  function butin(c: Creature) {
    const n = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
    const donner = (thing: ThingId, k: number) => { if (k > 0) events.drop(thing, k); };
    switch (c.sorte) {
      case "vache": donner(VIANDE_CRUE, n(1, 3)); donner(CUIR, n(0, 2)); break;
      case "mouton": donner(c.laine, 1); donner(VIANDE_CRUE, n(1, 2)); break;
      case "poule": donner(VIANDE_CRUE, 1); donner(PLUME, n(1, 2)); break;
      case "canard": donner(VIANDE_CRUE, 1); donner(PLUME, n(0, 2)); break;
      case "habitant": break;
    }
  }

  // ------------------------------------------------------------ physique
  /** Deplacement voulu (wx, wz) + recul, gravite, petits sauts. Renvoie la distance horizontale parcourue. */
  function physique(c: Creature, wx: number, wz: number, dt: number): number {
    const s = c.spec, p = c.group.position;
    const x0 = p.x, z0 = p.z;
    const fx = Math.floor(p.x), fz = Math.floor(p.z);
    const dansLEau = world.liquidAt(fx, Math.floor(p.y + 0.2), fz);
    if (dansLEau) {
      // Tout le monde flotte ; le canard nage a la surface, le corps a moitie dans l'eau.
      const mouille = world.liquidAt(fx, Math.floor(p.y + (s.nage ? 0.35 : s.h * 0.7)), fz);
      c.vy = mouille ? Math.min(2, c.vy + 14 * dt) : Math.max(-2, c.vy - 8 * dt);
    } else c.vy = Math.max(-28, c.vy - GRAVITE * dt);
    const lent = dansLEau && !s.nage ? 0.55 : 1;
    const mx = (wx * lent + c.kx) * dt, mz = (wz * lent + c.kz) * dt;
    const amorti = Math.max(0, 1 - dt * (c.sol ? 9 : 2.5));
    c.kx *= amorti;
    c.kz *= amorti;
    let bloque = false;
    if (mx !== 0) {
      if (!world.collides(p.x + mx, p.y, p.z, s.h, s.r)) p.x += mx;
      else bloque = true;
    }
    if (mz !== 0) {
      if (!world.collides(p.x, p.y, p.z + mz, s.h, s.r)) p.z += mz;
      else bloque = true;
    }
    const voulu = Math.sqrt(wx * wx + wz * wz);
    if (bloque && voulu > 0.1 && (c.sol || dansLEau)) {
      const ux = (wx / voulu) * 0.5, uz = (wz / voulu) * 0.5;
      if (!world.collides(p.x, p.y + 1.05, p.z, s.h, s.r) && !world.collides(p.x + ux, p.y + 1.05, p.z + uz, s.h, s.r)) {
        c.vy = 7.4;
        c.sol = false;
      } else c.coince += dt;
    }
    const pas = Math.max(1, Math.ceil(Math.abs(c.vy * dt) / 0.3));
    const dy = (c.vy * dt) / pas;
    c.sol = false;
    for (let i = 0; i < pas; i++) {
      if (!world.collides(p.x, p.y + dy, p.z, s.h, s.r)) p.y += dy;
      else {
        if (c.vy < 0) c.sol = true;
        c.vy = 0;
        break;
      }
    }
    const ddx = p.x - x0, ddz = p.z - z0;
    return Math.sqrt(ddx * ddx + ddz * ddz);
  }

  /** De l'eau devant (a eviter pour les animaux qui ne nagent pas). */
  function eauDevant(c: Creature, ux: number, uz: number): boolean {
    const p = c.group.position;
    const ax = Math.floor(p.x + ux * 1.2), az = Math.floor(p.z + uz * 1.2), y = Math.floor(p.y);
    return world.liquidAt(ax, y, az) || world.liquidAt(ax, y - 1, az);
  }

  /** La route est libre (ou franchissable d'un saut) dans la direction (ux, uz). */
  function routeLibre(c: Creature, ux: number, uz: number): boolean {
    const s = c.spec, p = c.group.position;
    const ax = p.x + ux * 0.7, az = p.z + uz * 0.7;
    if (!world.collides(ax, p.y, az, s.h, s.r)) return true;
    return !world.collides(p.x, p.y + 1.05, p.z, s.h, s.r) && !world.collides(ax, p.y + 1.05, az, s.h, s.r);
  }

  // ------------------------------------------------------------ animation
  function animer(c: Creature) {
    const r = c.rig;
    r.tete.rotation.y = c.teteLacet;
    r.tete.rotation.x = c.teteTangage;
    const sw = Math.sin(c.pas) * c.allure;
    if (c.sorte === "habitant") {
      r.pattes[0].rotation.x = sw * 0.7;
      r.pattes[1].rotation.x = -sw * 0.7;
      const repos = Math.sin(clock * 1.6 + c.graine) * 0.04;
      r.bras[0].rotation.x = -sw * 0.6 + repos;
      r.bras[1].rotation.x = sw * 0.6 - repos;
      r.bras[0].rotation.z = 0;
      // Il salue de la main droite quand on lui parle.
      if (c.parleT > 4.5) {
        r.bras[0].rotation.x = -2.6 + Math.sin(clock * 9) * 0.25;
        r.bras[0].rotation.z = -0.3;
      }
      return;
    }
    if (r.pattes.length === 4) {
      r.pattes[0].rotation.x = sw * 0.6;
      r.pattes[3].rotation.x = sw * 0.6;
      r.pattes[1].rotation.x = -sw * 0.6;
      r.pattes[2].rotation.x = -sw * 0.6;
    } else {
      r.pattes[0].rotation.x = sw * 0.8;
      r.pattes[1].rotation.x = -sw * 0.8;
    }
    if (r.queue) r.queue.rotation.z = Math.sin(clock * 2.2 + c.graine) * 0.18;
  }

  /** Teinte par la lumiere de la case, eclat rouge apres un coup. */
  function teinter(c: Creature, dt: number) {
    const p = c.group.position;
    const cible = world.brightness(p.x, p.y + Math.min(1.2, c.spec.h * 0.6), p.z);
    c.lumiere += (cible - c.lumiere) * Math.min(1, dt * 8);
    c.material.color.setScalar(Math.max(0.05, c.lumiere));
    if (c.mort) {
      c.material.emissive.setHex(ROUGE);
      c.material.emissiveIntensity = 0.45;
    } else if (c.eclat > 0) {
      c.material.emissive.setHex(ROUGE);
      c.material.emissiveIntensity = (c.eclat / ECLAT) * 0.6;
    } else c.material.emissiveIntensity = 0;
  }

  // ------------------------------------------------------------ intelligence
  /**
   * Chemin a pied, case par case, de l'habitant a la case (bx, bz) : par les
   * rues et les portes, en montant ou descendant d'une marche a la fois.
   * Recherche en largeur sur l'emprise du village (quelques milliers de
   * cases), puis on coupe les detours en ligne droite quand le sol est plat
   * et degage. Null si le but est inaccessible.
   */
  function chemin(c: Creature, bx: number, bz: number): number[] | null {
    const v = c.village!, p = c.group.position;
    const x0 = v.x0 - 3, z0 = v.z0 - 3, x1 = v.x1 + 3, z1 = v.z1 + 3;
    const W = x1 - x0 + 1, H = z1 - z0 + 1;
    const sx = Math.floor(p.x), sz = Math.floor(p.z);
    if (sx < x0 || sx > x1 || sz < z0 || sz > z1 || bx < x0 || bx > x1 || bz < z0 || bz > z1) return null;
    const pied = new Int16Array(W * H);
    const avant = new Int32Array(W * H).fill(-1);
    const file = new Int32Array(W * H);
    const libre = (x: number, y: number, z: number) => !world.solidAt(x, y, z) && !world.solidAt(x, y + 1, z) && !world.liquidAt(x, y, z);
    const depart = (sz - z0) * W + (sx - x0), arrivee = (bz - z0) * W + (bx - x0);
    pied[depart] = Math.floor(p.y + 0.01);
    avant[depart] = depart;
    let tete = 0, fin = 0;
    file[fin++] = depart;
    while (tete < fin && avant[arrivee] < 0) {
      const i = file[tete++];
      const x = x0 + (i % W), z = z0 + Math.floor(i / W), y = pied[i];
      for (const [dx, dz] of VOISINS4) {
        const nx = x + dx, nz = z + dz;
        if (nx < x0 || nx > x1 || nz < z0 || nz > z1) continue;
        const j = (nz - z0) * W + (nx - x0);
        if (avant[j] >= 0 || !world.isLoaded(nx, nz)) continue;
        let ny = -1;
        if (libre(nx, y, nz) && world.solidAt(nx, y - 1, nz)) ny = y;
        else if (libre(nx, y + 1, nz) && world.solidAt(nx, y, nz) && !world.solidAt(x, y + 2, z)) ny = y + 1;
        else if (libre(nx, y - 1, nz) && libre(nx, y, nz) && world.solidAt(nx, y - 2, nz)) ny = y - 1;
        if (ny < 0) continue;
        pied[j] = ny;
        avant[j] = i;
        file[fin++] = j;
      }
    }
    if (avant[arrivee] < 0) return null;
    const cases: number[] = [];
    for (let i = arrivee; i !== depart; i = avant[i]) cases.push(i);
    cases.push(depart);
    cases.reverse();
    // Ligne droite possible entre deux cases : sol plat, et toute la largeur du corps passe.
    const dejaVu = (x: number, z: number, y: number) => {
      const cx = Math.floor(x), cz = Math.floor(z);
      if (cx < x0 || cx > x1 || cz < z0 || cz > z1) return false;
      const k = (cz - z0) * W + (cx - x0);
      return avant[k] >= 0 && pied[k] === y;
    };
    const droit = (a: number, b: number) => {
      const y = pied[a];
      const ax = (a % W) + 0.5, az = Math.floor(a / W) + 0.5, bxx = (b % W) + 0.5, bzz = Math.floor(b / W) + 0.5;
      const n = Math.ceil(Math.hypot(bxx - ax, bzz - az) / 0.25);
      for (let k = 0; k <= n; k++) {
        const x = x0 + ax + ((bxx - ax) * k) / n, z = z0 + az + ((bzz - az) * k) / n;
        for (const [ox, oz] of [[0, 0], [0.32, 0.32], [-0.32, 0.32], [0.32, -0.32], [-0.32, -0.32]]) if (!dejaVu(x + ox, z + oz, y)) return false;
      }
      return true;
    };
    const res: number[] = [];
    let i = 0;
    while (i < cases.length - 1) {
      let j = cases.length - 1;
      while (j > i + 1 && !droit(cases[i], cases[j])) j--;
      res.push(x0 + (cases[j] % W), z0 + Math.floor(cases[j] / W));
      i = j;
    }
    return res;
  }

  /** Choisit ou va un habitant et trace son chemin : la place, sa porte, ou chez lui la nuit. */
  function butHabitant(c: Creature) {
    const v = c.village!, p = c.porte!;
    const nuit = !world.isDay();
    const buts: [number, number][] = [];
    if (nuit) buts.push([p.x + p.dx * 2, p.z + p.dz * 2]);
    else {
      for (let k = 0; k < 3; k++) {
        if (Math.random() < 0.6) {
          // Autour de la fontaine.
          const a = Math.random() * Math.PI * 2, d = 3.5 + Math.random() * 1.5;
          buts.push([Math.floor(v.x + 0.5 + Math.sin(a) * d), Math.floor(v.z + 0.5 + Math.cos(a) * d)]);
        } else buts.push([p.x, p.z]);
      }
    }
    c.nuit = nuit;
    c.etape = 0;
    for (const [bx, bz] of buts) {
      const ch = chemin(c, bx, bz);
      if (!ch) continue;
      c.chemin = ch;
      c.arrive = ch.length === 0;
      c.cibleT = 14 + Math.random() * 10;
      return;
    }
    // Rien d'accessible pour l'instant : il patiente sur place.
    c.chemin = [];
    c.arrive = true;
    c.cibleT = 3 + Math.random() * 3;
  }

  /** Une image d'une creature. Faux : a retirer. */
  function maj(c: Creature, dt: number, px: number, py: number, pz: number): boolean {
    const s = c.spec, p = c.group.position;
    const dxp = px - p.x, dzp = pz - p.z, dyp = py - p.y;
    const distH = Math.sqrt(dxp * dxp + dzp * dzp);
    c.eclat = Math.max(0, c.eclat - dt);

    if (c.mort) {
      c.mortT += dt;
      physique(c, 0, 0, dt);
      const k = Math.min(1, c.mortT / CHUTE);
      c.tilt.rotation.z = (1 - (1 - k) * (1 - k)) * (Math.PI / 2);
      const reste = CHUTE + 0.35 - c.mortT;
      if (reste < 0.15) c.tilt.scale.setScalar(Math.max(0.01, reste / 0.15));
      teinter(c, dt);
      if (c.mortT >= CHUTE + 0.35) {
        butin(c);
        return false;
      }
      return true;
    }
    if (!world.isLoaded(p.x, p.z) || p.y < -10) return false;
    if (c.sorte === "habitant") {
      const v = c.village!;
      if (Math.hypot(v.x - px, v.z - pz) > RESTE_VILLAGE) return false;
    } else if (distH > DISPARITION) return false;

    let wx = 0, wz = 0;
    let regard = NaN;
    c.fuiteT = Math.max(0, c.fuiteT - dt);
    c.broute = Math.max(0, c.broute - dt);
    c.parleT = Math.max(0, c.parleT - dt);

    if (c.fuiteT > 0) {
      // Fuite : on s'eloigne de celui qui a frappe.
      let fx = p.x - c.fuiteX, fz = p.z - c.fuiteZ;
      const fd = Math.sqrt(fx * fx + fz * fz) || 1;
      fx /= fd;
      fz /= fd;
      wx = fx * s.fuite;
      wz = fz * s.fuite;
    } else if (c.sorte === "habitant") {
      if (c.parleT > 0) regard = Math.atan2(dxp, dzp);
      else {
        c.cibleT -= dt;
        // Fin de la promenade, ou la nuit tombe (chacun rentre chez soi), ou le jour se leve.
        if (c.cibleT <= 0 || c.nuit !== !world.isDay()) butHabitant(c);
        if (!c.arrive && c.etape < c.chemin.length) {
          const tx = c.chemin[c.etape] + 0.5 - p.x, tz = c.chemin[c.etape + 1] + 0.5 - p.z;
          const td = Math.sqrt(tx * tx + tz * tz);
          if (td < 0.3) {
            c.etape += 2;
            if (c.etape >= c.chemin.length) {
              c.arrive = true;
              c.cibleT = Math.min(c.cibleT, 3 + Math.random() * 5);
            }
          } else {
            const lent = c.etape >= c.chemin.length - 2 && td < 1 ? 0.6 : 1;
            wx = (tx / td) * s.vitesse * lent;
            wz = (tz / td) * s.vitesse * lent;
          }
        }
      }
    } else {
      c.promT -= dt;
      if (c.promT <= 0) {
        c.promT = 2.5 + Math.random() * 5;
        const r = Math.random();
        if (r < 0.35) {
          c.vitesse = 0;
          // Les herbivores broutent, la poule picore.
          if (c.sorte !== "canard" || r < 0.15) c.broute = 1.5 + Math.random() * 2.5;
        } else {
          for (let k = 0; k < 3; k++) {
            const a = Math.random() * Math.PI * 2;
            c.dirX = Math.sin(a);
            c.dirZ = Math.cos(a);
            if (s.nage || !eauDevant(c, c.dirX, c.dirZ)) break;
          }
          c.vitesse = s.vitesse * (0.6 + Math.random() * 0.4);
        }
      }
      if (!s.nage && c.vitesse > 0 && eauDevant(c, c.dirX, c.dirZ)) c.vitesse = 0;
      wx = c.dirX * c.vitesse;
      wz = c.dirZ * c.vitesse;
    }

    // Mur trop haut : on le longe du cote qui se degage, comme les monstres.
    const voulu = Math.sqrt(wx * wx + wz * wz);
    const gx = voulu > 1e-6 ? wx / voulu : 0, gz = voulu > 1e-6 ? wz / voulu : 0;
    if (c.detourT > 0) {
      c.detourT -= dt;
      if (voulu < 0.05 || routeLibre(c, gx, gz)) c.detourT = 0;
      else {
        wx = -gz * c.detourCote * voulu;
        wz = gx * c.detourCote * voulu;
      }
    }
    const bouge = physique(c, wx, wz, dt);
    if (voulu > 0.2 && c.sol && bouge < voulu * dt * 0.3) {
      c.coince += dt;
      if (c.coince > 0.6) {
        c.coince = 0;
        // Un habitant bloque (une bete sur son chemin, un bloc pose) refait son chemin.
        if (c.sorte === "habitant" && c.fuiteT <= 0) butHabitant(c);
        else if (c.sorte !== "habitant" && c.fuiteT <= 0) c.promT = 0;
        else {
          c.detourCote = c.detourT > 0 ? -c.detourCote : Math.random() < 0.5 ? -1 : 1;
          c.detourT = 2.5;
        }
      }
    } else c.coince = Math.max(0, c.coince - dt * 0.5);

    // Corps dans le sens de la marche (ou vers le joueur qui lui parle).
    const vitesse = bouge / Math.max(dt, 1e-4);
    let but = regard;
    if (Number.isNaN(but) && voulu > 0.05 && vitesse > 0.15) but = Math.atan2(wx, wz);
    if (!Number.isNaN(but)) c.lacet = wrap(c.lacet + clamp(wrap(but - c.lacet), -TOURNE * dt, TOURNE * dt));
    c.group.rotation.y = c.lacet;

    // Tete : broute, ou regarde le joueur s'il est tout pres.
    let hy = 0, hp = 0;
    if (c.broute > 0 && c.fuiteT <= 0) {
      hp = c.sorte === "poule" ? 0.6 + Math.max(0, Math.sin(clock * 14 + c.graine)) * 0.5 : 0.85;
    } else if (distH < 8 && c.fuiteT <= 0) {
      hy = clamp(wrap(Math.atan2(dxp, dzp) - c.lacet), -1, 1);
      hp = clamp(-Math.atan2(dyp + 1.62 - s.yeux, distH), -0.6, 0.6);
    }
    const doux = Math.min(1, dt * 7);
    c.teteLacet += (hy - c.teteLacet) * doux;
    c.teteTangage += (hp - c.teteTangage) * doux;

    c.allure += (Math.min(1, vitesse / 1.2) - c.allure) * Math.min(1, dt * 8);
    c.pas += dt * Math.min(vitesse, 4) * s.foulee;

    // Un cri de temps en temps, s'il est assez pres pour l'entendre.
    c.cri -= dt;
    if (c.cri <= 0) {
      c.cri = 8 + Math.random() * 10;
      if (distH < 14 && c.sorte !== "habitant") events.sound(c.sorte);
    }

    animer(c);
    teinter(c, dt);
    return true;
  }

  /** Les creatures s'ecartent les unes des autres au lieu de se superposer. */
  function ecarter() {
    for (let i = 0; i < liste.length; i++) {
      const a = liste[i];
      if (a.mort) continue;
      const pa = a.group.position;
      for (let j = i + 1; j < liste.length; j++) {
        const b = liste[j];
        if (b.mort) continue;
        const pb = b.group.position;
        if (Math.abs(pa.y - pb.y) > 1.5) continue;
        const dx = pb.x - pa.x, dz = pb.z - pa.z;
        const min = a.spec.r + b.spec.r;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min || d2 < 1e-8) continue;
        const d = Math.sqrt(d2), pousse = (min - d) * 3;
        a.kx -= (dx / d) * pousse;
        a.kz -= (dz / d) * pousse;
        b.kx += (dx / d) * pousse;
        b.kz += (dz / d) * pousse;
      }
    }
  }

  // ------------------------------------------------------------ visee du joueur
  let vise = -1;
  function lePlusProche(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, reach: number): number {
    vise = -1;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 1e-9) return Infinity;
    const ux = dx / len, uy = dy / len, uz = dz / len;
    let best = Infinity;
    for (let i = 0; i < liste.length; i++) {
      const c = liste[i];
      if (c.mort) continue;
      const p = c.group.position, r = c.spec.r + 0.1;
      const t = rayBox(ox, oy, oz, ux, uy, uz, p.x - r, p.y, p.z - r, p.x + r, p.y + c.spec.h + 0.05, p.z + r);
      if (t <= reach && t < best) {
        best = t;
        vise = i;
      }
    }
    return best;
  }

  return {
    peupler(player) {
      if (disposed) return;
      const now = performance.now();
      if (now >= prochainAnimal) {
        prochainAnimal = now + 2500 + Math.random() * 2500;
        peuplerAnimaux(player.x, player.y, player.z);
      }
      if (now >= prochainVillage) {
        prochainVillage = now + 1000;
        peuplerVillage(player.x, player.z);
      }
    },
    update(dt, player) {
      if (disposed) return;
      clock += dt;
      ecarter();
      for (let i = liste.length - 1; i >= 0; i--) if (!maj(liste[i], dt, player.x, player.y, player.z)) retirer(i);
    },
    hitMelee(ox, oy, oz, dx, dy, dz, reach, damage) {
      if (disposed) return false;
      lePlusProche(ox, oy, oz, dx, dy, dz, reach);
      if (vise < 0) return false;
      const c = liste[vise], p = c.group.position;
      let kx = p.x - ox, kz = p.z - oz;
      const h = Math.sqrt(kx * kx + kz * kz) || 1;
      kx /= h;
      kz /= h;
      c.kx = kx * 4.5;
      c.kz = kz * 4.5;
      if (c.sol) {
        c.vy = 4;
        c.sol = false;
      }
      c.fuiteT = c.sorte === "habitant" ? 1.5 : 4;
      // Apres s'etre ecarte, l'habitant refait son chemin.
      c.cibleT = 0;
      c.fuiteX = ox;
      c.fuiteZ = oz;
      c.broute = 0;
      events.sound("touche");
      // Les habitants ne sont jamais blesses : ils s'ecartent, un peu vexes.
      if (c.sorte !== "habitant") {
        c.pv -= damage;
        c.eclat = ECLAT;
        if (c.pv <= 0) {
          c.mort = true;
          c.mortT = 0;
        }
      }
      return true;
    },
    rayDistance(ox, oy, oz, dx, dy, dz, reach) {
      if (disposed) return Infinity;
      return lePlusProche(ox, oy, oz, dx, dy, dz, reach);
    },
    parler(ox, oy, oz, dx, dy, dz, reach) {
      if (disposed) return null;
      lePlusProche(ox, oy, oz, dx, dy, dz, reach);
      if (vise < 0) return null;
      const c = liste[vise];
      if (c.sorte !== "habitant" || !c.identite) return null;
      c.parleT = 6;
      c.fuiteT = 0;
      events.sound("habitant");
      return c.identite.habitant;
    },
    count: () => liste.length,
    clear() {
      for (let i = liste.length - 1; i >= 0; i--) retirer(i);
    },
    dispose() {
      if (disposed) return;
      for (let i = liste.length - 1; i >= 0; i--) retirer(i);
      disposed = true;
      for (const v of Object.values(G)) {
        if (v instanceof THREE.BufferGeometry) v.dispose();
        else for (const g of Object.values(v)) g.dispose();
      }
      grain.dispose();
    },
  };
}
