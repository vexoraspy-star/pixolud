// Les chars de « Tonnerre d'Acier » : caracteristiques de combat et allure.
//
// Des chars inventes, inspires des blindes de la Seconde Guerre mondiale
// (aucun nom ni modele d'un jeu existant). Les regles de tir suivent le genre :
// penetration contre epaisseur effective du blindage, ricochet au-dela de 70
// degres, obus perforants qui « se redressent » un peu a l'impact.
//
// Unites : millimetres pour le blindage et le calibre, metres et secondes
// pour le reste, km/h pour les vitesses affichees.

export type TankClass = "leger" | "moyen" | "lourd" | "chasseur";
export type AmmoId = "perforant" | "sousCalibre" | "explosif";

export const TANK_CLASS_NAMES: Record<TankClass, string> = {
  leger: "Char léger",
  moyen: "Char moyen",
  lourd: "Char lourd",
  chasseur: "Chasseur de chars",
};

export interface AmmoSpec {
  /** Penetration moyenne, en mm (tirage de plus ou moins 25 %). */
  penetration: number;
  /** Degats moyens (tirage de plus ou moins 25 %). */
  damage: number;
  /** Vitesse initiale, en m/s. */
  speed: number;
  /** Obus emportes. */
  count: number;
}

export interface AmmoInfo {
  id: AmmoId;
  name: string;
  short: string;
  /** Redressement de l'obus a l'impact, en degres. */
  normalization: number;
  /** Peut ricocher (les explosifs eclatent en surface). */
  ricochet: boolean;
  explosive: boolean;
  description: string;
}

export const AMMO: Record<AmmoId, AmmoInfo> = {
  perforant: {
    id: "perforant",
    name: "Perforant",
    short: "PERF",
    normalization: 5,
    ricochet: true,
    explosive: false,
    description: "L'obus de base : bonne pénétration, dégâts normaux.",
  },
  sousCalibre: {
    id: "sousCalibre",
    name: "Sous-calibré",
    short: "SC",
    normalization: 2,
    ricochet: true,
    explosive: false,
    description: "Très rapide et très perçant, mais il supporte mal le blindage incliné.",
  },
  explosif: {
    id: "explosif",
    name: "Explosif",
    short: "EXPL",
    normalization: 0,
    ricochet: false,
    explosive: true,
    description: "Éclate au contact : gros dégâts s'il perce, quelques dégâts même s'il ne perce pas.",
  },
};

export const AMMO_ORDER: AmmoId[] = ["perforant", "sousCalibre", "explosif"];

/** Epaisseurs d'une piece (caisse ou tourelle), en mm, et inclinaison des plaques. */
export interface Armor {
  front: number;
  side: number;
  rear: number;
  top: number;
  /** Inclinaison de la plaque avant par rapport a la verticale, en degres. */
  frontSlope: number;
  /** Inclinaison des flancs, en degres (souvent faible). */
  sideSlope: number;
}

export type TurretShape = "arrondie" | "anguleuse" | "casemate";

/** Allure du modele dessine en code. */
export interface TankLook {
  /** Caisse : longueur, largeur, hauteur (sans les chenilles), en metres. */
  length: number;
  width: number;
  hullHeight: number;
  /** Garde au sol (bas de la caisse). */
  clearance: number;
  turretShape: TurretShape;
  /** Tourelle : largeur, hauteur, longueur. */
  turret: [number, number, number];
  /** Decalage de la tourelle vers l'avant (+) ou l'arriere (-). */
  turretOffset: number;
  gunLength: number;
  gunRadius: number;
  muzzleBrake: boolean;
  /** Galets de roulement par cote. */
  wheels: number;
  wheelRadius: number;
  /** Couleur de base et couleur du camouflage. */
  color: number;
  camo: number;
  camoStyle: "taches" | "bandes" | "uni";
  /** Jupes laterales (plaques au-dessus des chenilles). */
  skirts: boolean;
  /** Canon automatique : tube fin, manchon de refroidissement, chargeur sur la tourelle. */
  autocannon?: boolean;
}

/** Canon automatique : des rafales, puis tout le chargeur a recharger. */
export interface Clip {
  /** Obus par chargeur. */
  size: number;
  /** Secondes entre deux obus d'une rafale. */
  interval: number;
}

export interface TankDef {
  id: string;
  name: string;
  cls: TankClass;
  tier: number;
  description: string;
  hp: number;
  /** Calibre du canon, en mm. */
  caliber: number;
  ammo: Record<AmmoId, AmmoSpec>;
  /** Rechargement, en secondes (du chargeur entier pour un canon automatique). */
  reload: number;
  /** Canon automatique (tir en rafale). */
  clip?: Clip;
  /** Temps de visee : l'ecart se resserre de 90 % en ce temps. */
  aimTime: number;
  /** Rayon de dispersion a 100 m quand la visee est complete, en metres. */
  dispersion: number;
  hull: Armor;
  turret: Armor;
  /** Vitesse maximale en marche avant et arriere, en km/h. */
  speed: number;
  reverse: number;
  /** Acceleration, en m/s². */
  accel: number;
  /** Rotation de la caisse et de la tourelle, en degres par seconde. */
  hullTraverse: number;
  turretTraverse: number;
  /** Chasseur sans tourelle : debattement du canon de part et d'autre, en degres. */
  gunArc: number;
  /** Pointage vertical du canon, en degres. */
  depression: number;
  elevation: number;
  /** Portee de vue, en metres. */
  viewRange: number;
  look: TankLook;
}

export const TANKS: TankDef[] = [
  {
    id: "frelon",
    name: "Frelon",
    cls: "leger",
    tier: 5,
    description: "Un canon automatique de 20 mm : il crache des rafales de dix obus. Terrible de près, sur les flancs et l'arrière.",
    hp: 520,
    caliber: 20,
    ammo: {
      perforant: { penetration: 46, damage: 14, speed: 900, count: 400 },
      sousCalibre: { penetration: 62, damage: 14, speed: 1100, count: 150 },
      explosif: { penetration: 15, damage: 20, speed: 900, count: 200 },
    },
    reload: 5.5,
    clip: { size: 10, interval: 0.14 },
    aimTime: 1.4,
    dispersion: 0.55,
    hull: { front: 25, side: 15, rear: 15, top: 8, frontSlope: 50, sideSlope: 0 },
    turret: { front: 25, side: 15, rear: 15, top: 8, frontSlope: 15, sideSlope: 10 },
    speed: 72,
    reverse: 24,
    accel: 6,
    hullTraverse: 56,
    turretTraverse: 60,
    gunArc: 180,
    depression: 10,
    elevation: 25,
    viewRange: 380,
    look: {
      length: 5,
      width: 2.5,
      hullHeight: 1,
      clearance: 0.4,
      turretShape: "anguleuse",
      turret: [1.6, 0.7, 1.9],
      turretOffset: 0.2,
      gunLength: 2.6,
      gunRadius: 0.035,
      muzzleBrake: false,
      wheels: 4,
      wheelRadius: 0.36,
      color: 0x7a7550,
      camo: 0x4f5236,
      camoStyle: "taches",
      skirts: false,
      autocannon: true,
    },
  },
  {
    id: "guepe",
    name: "Guêpe",
    cls: "moyen",
    tier: 6,
    description: "Canon automatique de 37 mm : six obus perçants en deux secondes, puis un long rechargement. Frappe, et mets-toi à couvert.",
    hp: 900,
    caliber: 37,
    ammo: {
      perforant: { penetration: 84, damage: 40, speed: 850, count: 240 },
      sousCalibre: { penetration: 115, damage: 40, speed: 1050, count: 90 },
      explosif: { penetration: 20, damage: 55, speed: 850, count: 120 },
    },
    reload: 8,
    clip: { size: 6, interval: 0.32 },
    aimTime: 1.8,
    dispersion: 0.45,
    hull: { front: 50, side: 35, rear: 30, top: 15, frontSlope: 52, sideSlope: 0 },
    turret: { front: 60, side: 40, rear: 35, top: 15, frontSlope: 18, sideSlope: 12 },
    speed: 52,
    reverse: 18,
    accel: 4.2,
    hullTraverse: 42,
    turretTraverse: 44,
    gunArc: 180,
    depression: 9,
    elevation: 22,
    viewRange: 360,
    look: {
      length: 6,
      width: 2.9,
      hullHeight: 1.25,
      clearance: 0.45,
      turretShape: "anguleuse",
      turret: [2.1, 0.85, 2.4],
      turretOffset: 0.15,
      gunLength: 3.4,
      gunRadius: 0.05,
      muzzleBrake: false,
      wheels: 5,
      wheelRadius: 0.4,
      color: 0x6c6e4a,
      camo: 0x9a8c62,
      camoStyle: "bandes",
      skirts: false,
      autocannon: true,
    },
  },
  {
    id: "lynx",
    name: "Lynx",
    cls: "leger",
    tier: 5,
    description: "Rapide et discret : il repère l'ennemi pour toute l'équipe et harcèle les flancs.",
    hp: 560,
    caliber: 50,
    ammo: {
      perforant: { penetration: 92, damage: 75, speed: 790, count: 60 },
      sousCalibre: { penetration: 130, damage: 75, speed: 990, count: 20 },
      explosif: { penetration: 25, damage: 100, speed: 790, count: 20 },
    },
    reload: 3.2,
    aimTime: 1.7,
    dispersion: 0.4,
    hull: { front: 30, side: 20, rear: 15, top: 10, frontSlope: 55, sideSlope: 0 },
    turret: { front: 35, side: 25, rear: 20, top: 10, frontSlope: 20, sideSlope: 15 },
    speed: 68,
    reverse: 22,
    accel: 5.5,
    hullTraverse: 52,
    turretTraverse: 48,
    gunArc: 180,
    depression: 8,
    elevation: 20,
    viewRange: 390,
    look: {
      length: 5.4,
      width: 2.6,
      hullHeight: 1.05,
      clearance: 0.42,
      turretShape: "anguleuse",
      turret: [1.8, 0.75, 2.1],
      turretOffset: 0.15,
      gunLength: 3,
      gunRadius: 0.055,
      muzzleBrake: false,
      wheels: 5,
      wheelRadius: 0.34,
      color: 0x8a8a5c,
      camo: 0x5c6440,
      camoStyle: "bandes",
      skirts: false,
    },
  },
  {
    id: "bouledogue",
    name: "Bouledogue",
    cls: "moyen",
    tier: 5,
    description: "Robuste et polyvalent : un bon premier char pour apprendre à se battre.",
    hp: 780,
    caliber: 75,
    ammo: {
      perforant: { penetration: 110, damage: 110, speed: 620, count: 60 },
      sousCalibre: { penetration: 150, damage: 110, speed: 780, count: 15 },
      explosif: { penetration: 38, damage: 175, speed: 620, count: 25 },
    },
    reload: 4.6,
    aimTime: 2.1,
    dispersion: 0.44,
    hull: { front: 60, side: 38, rear: 38, top: 15, frontSlope: 50, sideSlope: 0 },
    turret: { front: 75, side: 50, rear: 50, top: 20, frontSlope: 10, sideSlope: 5 },
    speed: 45,
    reverse: 18,
    accel: 3.8,
    hullTraverse: 38,
    turretTraverse: 32,
    gunArc: 180,
    depression: 10,
    elevation: 22,
    viewRange: 350,
    look: {
      length: 6,
      width: 2.8,
      hullHeight: 1.35,
      clearance: 0.45,
      turretShape: "arrondie",
      turret: [2.1, 0.95, 2.4],
      turretOffset: 0.2,
      gunLength: 3.3,
      gunRadius: 0.07,
      muzzleBrake: false,
      wheels: 6,
      wheelRadius: 0.38,
      color: 0x5f6b45,
      camo: 0x3e4631,
      camoStyle: "uni",
      skirts: false,
    },
  },
  {
    id: "faucon",
    name: "Faucon",
    cls: "moyen",
    tier: 6,
    description: "Bon canon, bonne vitesse : il frappe vite et se replie avant la riposte.",
    hp: 950,
    caliber: 76,
    ammo: {
      perforant: { penetration: 145, damage: 135, speed: 790, count: 55 },
      sousCalibre: { penetration: 192, damage: 135, speed: 990, count: 15 },
      explosif: { penetration: 38, damage: 180, speed: 790, count: 20 },
    },
    reload: 5.4,
    aimTime: 2,
    dispersion: 0.37,
    hull: { front: 65, side: 45, rear: 38, top: 20, frontSlope: 56, sideSlope: 0 },
    turret: { front: 90, side: 65, rear: 50, top: 25, frontSlope: 25, sideSlope: 12 },
    speed: 56,
    reverse: 20,
    accel: 4.4,
    hullTraverse: 44,
    turretTraverse: 42,
    gunArc: 180,
    depression: 9,
    elevation: 20,
    viewRange: 370,
    look: {
      length: 6.4,
      width: 3,
      hullHeight: 1.3,
      clearance: 0.46,
      turretShape: "arrondie",
      turret: [2.3, 0.95, 2.7],
      turretOffset: 0.1,
      gunLength: 4.2,
      gunRadius: 0.07,
      muzzleBrake: true,
      wheels: 5,
      wheelRadius: 0.45,
      color: 0x6e7650,
      camo: 0x8f8661,
      camoStyle: "taches",
      skirts: false,
    },
  },
  {
    id: "mammouth",
    name: "Mammouth",
    cls: "lourd",
    tier: 6,
    description: "Un mur d'acier : il encaisse au premier rang et frappe très fort.",
    hp: 1400,
    caliber: 88,
    ammo: {
      perforant: { penetration: 155, damage: 220, speed: 773, count: 50 },
      sousCalibre: { penetration: 200, damage: 220, speed: 930, count: 12 },
      explosif: { penetration: 44, damage: 270, speed: 773, count: 18 },
    },
    reload: 8.2,
    aimTime: 2.5,
    dispersion: 0.38,
    hull: { front: 100, side: 80, rear: 80, top: 25, frontSlope: 10, sideSlope: 0 },
    turret: { front: 120, side: 80, rear: 80, top: 25, frontSlope: 8, sideSlope: 0 },
    speed: 38,
    reverse: 13,
    accel: 2.6,
    hullTraverse: 26,
    turretTraverse: 20,
    gunArc: 180,
    depression: 8,
    elevation: 18,
    viewRange: 360,
    look: {
      length: 6.8,
      width: 3.4,
      hullHeight: 1.55,
      clearance: 0.48,
      turretShape: "anguleuse",
      turret: [2.8, 1.15, 3.1],
      turretOffset: 0.05,
      gunLength: 4.6,
      gunRadius: 0.08,
      muzzleBrake: true,
      wheels: 8,
      wheelRadius: 0.4,
      color: 0xb9a57a,
      camo: 0x6b6446,
      camoStyle: "taches",
      skirts: true,
    },
  },
  {
    id: "vipere",
    name: "Vipère",
    cls: "chasseur",
    tier: 6,
    description: "Pas de tourelle, mais un canon redoutable et un avant très incliné : il attend et il frappe.",
    hp: 880,
    caliber: 100,
    ammo: {
      perforant: { penetration: 198, damage: 300, speed: 895, count: 40 },
      sousCalibre: { penetration: 245, damage: 300, speed: 1100, count: 10 },
      explosif: { penetration: 50, damage: 380, speed: 895, count: 12 },
    },
    reload: 10.2,
    aimTime: 2.1,
    dispersion: 0.33,
    hull: { front: 80, side: 40, rear: 40, top: 20, frontSlope: 60, sideSlope: 25 },
    turret: { front: 100, side: 40, rear: 40, top: 20, frontSlope: 55, sideSlope: 25 },
    speed: 45,
    reverse: 16,
    accel: 3.4,
    hullTraverse: 36,
    turretTraverse: 18,
    gunArc: 12,
    depression: 6,
    elevation: 16,
    viewRange: 350,
    look: {
      length: 6.6,
      width: 3,
      hullHeight: 1.25,
      clearance: 0.44,
      turretShape: "casemate",
      turret: [2.6, 1, 3.4],
      turretOffset: 0.35,
      gunLength: 5,
      gunRadius: 0.085,
      muzzleBrake: true,
      wheels: 5,
      wheelRadius: 0.45,
      color: 0x7c7a55,
      camo: 0x4e5438,
      camoStyle: "bandes",
      skirts: true,
    },
  },
  {
    id: "titan",
    name: "Titan",
    cls: "lourd",
    tier: 7,
    description: "Le plus gros de l'arsenal : tourelle quasi imperméable de face et un canon de 122 mm.",
    hp: 1750,
    caliber: 122,
    ammo: {
      perforant: { penetration: 175, damage: 390, speed: 780, count: 30 },
      sousCalibre: { penetration: 217, damage: 390, speed: 880, count: 8 },
      explosif: { penetration: 61, damage: 460, speed: 780, count: 10 },
    },
    reload: 13.5,
    aimTime: 3.2,
    dispersion: 0.46,
    hull: { front: 120, side: 90, rear: 60, top: 30, frontSlope: 55, sideSlope: 15 },
    turret: { front: 180, side: 110, rear: 80, top: 30, frontSlope: 30, sideSlope: 25 },
    speed: 34,
    reverse: 12,
    accel: 2.3,
    hullTraverse: 24,
    turretTraverse: 18,
    gunArc: 180,
    depression: 5,
    elevation: 20,
    viewRange: 340,
    look: {
      length: 7.2,
      width: 3.5,
      hullHeight: 1.45,
      clearance: 0.46,
      turretShape: "arrondie",
      turret: [3, 1.1, 3.2],
      turretOffset: 0,
      gunLength: 5.2,
      gunRadius: 0.095,
      muzzleBrake: true,
      wheels: 6,
      wheelRadius: 0.5,
      color: 0x55603f,
      camo: 0x3b422c,
      camoStyle: "uni",
      skirts: false,
    },
  },
];

export function tankById(id: string): TankDef {
  return TANKS.find((t) => t.id === id) ?? TANKS.find((t) => t.id === "bouledogue") ?? TANKS[0];
}

/** Chiffre romain du rang (V, VI, VII). */
export function tierLabel(tier: number): string {
  return ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][tier] ?? String(tier);
}

/** Coups par minute, pour la fiche du garage (rafales et rechargement compris). */
export function rateOfFire(def: TankDef): number {
  if (def.clip) return (def.clip.size * 60) / (def.reload + (def.clip.size - 1) * def.clip.interval);
  return 60 / def.reload;
}

/** Degats moyens par minute avec l'obus perforant. */
export function damagePerMinute(def: TankDef): number {
  return rateOfFire(def) * def.ammo.perforant.damage;
}

export type Difficulty = "recrue" | "veteran" | "as";

/** Niveau des bots : temps de reaction et precision. */
export const DIFFICULTIES: Record<Difficulty, { name: string; tagline: string; reaction: number; aimFactor: number; weakspots: boolean }> = {
  recrue: { name: "Recrue", tagline: "Des tireurs lents et imprécis.", reaction: 1.4, aimFactor: 1.8, weakspots: false },
  veteran: { name: "Vétéran", tagline: "Ils visent correctement et se couvrent.", reaction: 0.9, aimFactor: 1.25, weakspots: false },
  as: { name: "As", tagline: "Ils réagissent vite et visent les points faibles.", reaction: 0.55, aimFactor: 1, weakspots: true },
};
