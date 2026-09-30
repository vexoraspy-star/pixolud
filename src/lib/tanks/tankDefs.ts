// Les chars de « Tonnerre d'Acier » : caracteristiques de combat et allure.
//
// Des chars inventes, inspires des blindes de la Seconde Guerre mondiale et
// de la guerre froide (aucun nom ni modele d'un jeu existant). Deux modes :
// la guerre normale (rangs IV a VIII) et la « Guerre de 100 » (rangs VIII a X,
// super-lourds, canons Gatling, artillerie). Les regles de tir suivent le genre :
// penetration contre epaisseur effective du blindage, ricochet au-dela de 70
// degres, obus perforants qui « se redressent » un peu a l'impact.
//
// Unites : millimetres pour le blindage et le calibre, metres et secondes
// pour le reste, km/h pour les vitesses affichees.

export type TankClass = "leger" | "moyen" | "lourd" | "chasseur" | "artillerie";
export type AmmoId = "perforant" | "sousCalibre" | "explosif";

export const TANK_CLASS_NAMES: Record<TankClass, string> = {
  leger: "Char léger",
  moyen: "Char moyen",
  lourd: "Char lourd",
  chasseur: "Chasseur de chars",
  artillerie: "Artillerie",
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

/**
 * Formes de tourelle : fonte arrondie, soudee anguleuse, casemate de chasseur,
 * et deux formes modernes : en coin (blindage en fleche a l'avant) et plate
 * (large, basse, grosse nuque).
 */
export type TurretShape = "arrondie" | "anguleuse" | "casemate" | "coin" | "plate";

/** Camouflage : a taches, a bandes, uni, ou numerique (des pixels en grappes). */
export type CamoStyle = "taches" | "bandes" | "uni" | "numerique";

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
  /** Couleur de base et couleur du camouflage (et une troisieme pour le numerique). */
  color: number;
  camo: number;
  camo2?: number;
  camoStyle: CamoStyle;
  /** Jupes laterales (plaques au-dessus des chenilles). */
  skirts: boolean;
  /** Canon automatique : tube fin, manchon de refroidissement, chargeur sur la tourelle. */
  autocannon?: boolean;
  /**
   * Char moderne : canon lisse long a manchon thermique, viseurs et capteurs
   * sur la tourelle, lance-fumigenes, jupes a modules.
   */
  modern?: boolean;
  /** Mitrailleuse de caisse (rotule sur la plaque avant). */
  hullMG?: boolean;
  /** Mitrailleuse du chef, sur affut au-dessus du tourelleau. */
  aaMG?: boolean;
  /** Tube double : deux mitrailleuses lourdes jumelees (pas de canon). */
  twinMG?: boolean;
  /** Caisse rivetee (annees trente). */
  rivets?: boolean;
  /** Caisse haute et longue d'un blinde d'infanterie. */
  ifv?: boolean;
  /** Canon Gatling : un faisceau de six tubes qui tourne pendant la rafale. */
  gatling?: boolean;
  /** Antenne radar en parabole sur la tourelle. */
  radar?: boolean;
  /** Deux petites tourelles de mitrailleuse a l'avant de la caisse (super-lourd). */
  miniTurrets?: boolean;
  /** Obusier : beche de recul a l'arriere, verrou de route sur le glacis. */
  howitzer?: boolean;
  /** Casemate a l'arriere de la caisse (le canon passe au-dessus du moteur). */
  rearCasemate?: boolean;
  /** Casemate ouverte sur le dessus. */
  openTop?: boolean;
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
  /**
   * Artillerie : le canon tire a hausse fixe (degres) et la charge varie avec
   * la distance ; l'obus monte haut et retombe sur le toit des chars.
   */
  artyAngle?: number;
  /** Pesanteur des obus d'artillerie (plus forte : des vols courts et hauts). */
  shellGravity?: number;
  /** Portee maximale de l'artillerie, en metres. */
  artyRange?: number;
  /** Rayon d'eclatement de l'obus explosif, en metres (artillerie). */
  splash?: number;
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
      hullMG: true,
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
      hullMG: true,
      aaMG: true,
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
      hullMG: true,
      aaMG: true,
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
      aaMG: true,
    },
  },
  {
    id: "moustique",
    name: "Moustique",
    cls: "leger",
    tier: 4,
    description: "Une petite automitrailleuse des années trente : deux mitrailleuses lourdes jumelées qui crachent quarante balles d'affilée.",
    hp: 400,
    caliber: 13,
    ammo: {
      perforant: { penetration: 28, damage: 6, speed: 880, count: 1200 },
      sousCalibre: { penetration: 36, damage: 6, speed: 1000, count: 400 },
      explosif: { penetration: 10, damage: 8, speed: 880, count: 400 },
    },
    reload: 6,
    clip: { size: 40, interval: 0.075 },
    aimTime: 1.2,
    dispersion: 0.62,
    hull: { front: 16, side: 12, rear: 12, top: 6, frontSlope: 35, sideSlope: 0 },
    turret: { front: 16, side: 12, rear: 12, top: 6, frontSlope: 10, sideSlope: 0 },
    speed: 76,
    reverse: 26,
    accel: 6.4,
    hullTraverse: 60,
    turretTraverse: 70,
    gunArc: 180,
    depression: 12,
    elevation: 30,
    viewRange: 370,
    look: {
      length: 4.6,
      width: 2.4,
      hullHeight: 1.1,
      clearance: 0.42,
      turretShape: "anguleuse",
      turret: [1.35, 0.72, 1.55],
      turretOffset: -0.1,
      gunLength: 1.25,
      gunRadius: 0.022,
      muzzleBrake: false,
      wheels: 4,
      wheelRadius: 0.44,
      color: 0x3f4441,
      camo: 0x49a04a,
      camo2: 0x262a28,
      camoStyle: "numerique",
      skirts: false,
      twinMG: true,
      rivets: true,
      hullMG: true,
    },
  },
  {
    id: "sentinelle",
    name: "Sentinelle",
    cls: "leger",
    tier: 7,
    description: "Un blindé d'infanterie moderne : caisse haute, petite tourelle et canon automatique de 30 mm. Il arrose tout ce qui bouge.",
    hp: 1150,
    caliber: 30,
    ammo: {
      perforant: { penetration: 82, damage: 28, speed: 1080, count: 480 },
      sousCalibre: { penetration: 112, damage: 28, speed: 1300, count: 160 },
      explosif: { penetration: 18, damage: 40, speed: 1080, count: 240 },
    },
    reload: 7,
    clip: { size: 12, interval: 0.18 },
    aimTime: 1.6,
    dispersion: 0.38,
    hull: { front: 50, side: 30, rear: 25, top: 12, frontSlope: 65, sideSlope: 8 },
    turret: { front: 45, side: 30, rear: 25, top: 12, frontSlope: 30, sideSlope: 15 },
    speed: 66,
    reverse: 26,
    accel: 5.2,
    hullTraverse: 50,
    turretTraverse: 58,
    gunArc: 180,
    depression: 10,
    elevation: 40,
    viewRange: 410,
    look: {
      length: 6.8,
      width: 3.2,
      hullHeight: 1.45,
      clearance: 0.45,
      turretShape: "anguleuse",
      turret: [1.7, 0.7, 2.1],
      turretOffset: 0.9,
      gunLength: 2.6,
      gunRadius: 0.04,
      muzzleBrake: false,
      wheels: 6,
      wheelRadius: 0.36,
      color: 0x44484a,
      camo: 0x2c3032,
      camo2: 0x5d6264,
      camoStyle: "numerique",
      skirts: true,
      autocannon: true,
      modern: true,
      ifv: true,
    },
  },
  {
    id: "guepard",
    name: "Guépard",
    cls: "moyen",
    tier: 8,
    description: "Char de combat moderne à tourelle en coin : canon lisse de 120 mm, vitesse et précision redoutables.",
    hp: 1900,
    caliber: 120,
    ammo: {
      perforant: { penetration: 290, damage: 330, speed: 1650, count: 30 },
      sousCalibre: { penetration: 370, damage: 330, speed: 1750, count: 10 },
      explosif: { penetration: 62, damage: 430, speed: 1140, count: 12 },
    },
    reload: 7,
    aimTime: 1.9,
    dispersion: 0.28,
    hull: { front: 150, side: 60, rear: 40, top: 30, frontSlope: 70, sideSlope: 0 },
    turret: { front: 250, side: 100, rear: 50, top: 35, frontSlope: 55, sideSlope: 10 },
    speed: 68,
    reverse: 30,
    accel: 5,
    hullTraverse: 44,
    turretTraverse: 42,
    gunArc: 180,
    depression: 9,
    elevation: 20,
    viewRange: 440,
    look: {
      length: 7.7,
      width: 3.7,
      hullHeight: 1.25,
      clearance: 0.5,
      turretShape: "coin",
      turret: [3.3, 0.95, 3.8],
      turretOffset: -0.1,
      gunLength: 6,
      gunRadius: 0.085,
      muzzleBrake: false,
      wheels: 7,
      wheelRadius: 0.42,
      color: 0x5a6446,
      camo: 0x2d3326,
      camo2: 0x7a5c3f,
      camoStyle: "taches",
      skirts: true,
      modern: true,
      aaMG: true,
    },
  },
  {
    id: "bastion",
    name: "Bastion",
    cls: "lourd",
    tier: 8,
    description: "Char lourd moderne : une énorme tourelle plate presque imperméable de face et une turbine qui le rend étonnamment vif.",
    hp: 2150,
    caliber: 120,
    ammo: {
      perforant: { penetration: 280, damage: 360, speed: 1575, count: 30 },
      sousCalibre: { penetration: 360, damage: 360, speed: 1680, count: 10 },
      explosif: { penetration: 60, damage: 460, speed: 1140, count: 12 },
    },
    reload: 8,
    aimTime: 2.2,
    dispersion: 0.31,
    hull: { front: 190, side: 75, rear: 45, top: 35, frontSlope: 75, sideSlope: 0 },
    turret: { front: 300, side: 110, rear: 60, top: 40, frontSlope: 20, sideSlope: 12 },
    speed: 62,
    reverse: 32,
    accel: 4.6,
    hullTraverse: 38,
    turretTraverse: 36,
    gunArc: 180,
    depression: 9,
    elevation: 20,
    viewRange: 420,
    look: {
      length: 7.9,
      width: 3.7,
      hullHeight: 1.3,
      clearance: 0.48,
      turretShape: "plate",
      turret: [3.6, 0.85, 4.4],
      turretOffset: -0.35,
      gunLength: 5.6,
      gunRadius: 0.085,
      muzzleBrake: false,
      wheels: 7,
      wheelRadius: 0.42,
      color: 0xc2a878,
      camo: 0x9c8660,
      camo2: 0xd8c29a,
      camoStyle: "uni",
      skirts: true,
      modern: true,
      aaMG: true,
    },
  },
  {
    id: "aquilon",
    name: "Aquilon",
    cls: "moyen",
    tier: 8,
    description: "Char moderne à chargeur automatique : trois obus de 120 mm en quatre secondes, puis il faut recharger le barillet.",
    hp: 1750,
    caliber: 120,
    ammo: {
      perforant: { penetration: 275, damage: 300, speed: 1620, count: 30 },
      sousCalibre: { penetration: 355, damage: 300, speed: 1720, count: 12 },
      explosif: { penetration: 60, damage: 400, speed: 1140, count: 12 },
    },
    reload: 13,
    clip: { size: 3, interval: 2 },
    aimTime: 1.8,
    dispersion: 0.3,
    hull: { front: 140, side: 55, rear: 35, top: 30, frontSlope: 72, sideSlope: 0 },
    turret: { front: 230, side: 90, rear: 45, top: 30, frontSlope: 35, sideSlope: 14 },
    speed: 71,
    reverse: 38,
    accel: 5.4,
    hullTraverse: 46,
    turretTraverse: 44,
    gunArc: 180,
    depression: 8,
    elevation: 20,
    viewRange: 430,
    look: {
      length: 7.2,
      width: 3.6,
      hullHeight: 1.2,
      clearance: 0.5,
      turretShape: "coin",
      turret: [3.1, 0.9, 3.5],
      turretOffset: -0.2,
      gunLength: 5.4,
      gunRadius: 0.085,
      muzzleBrake: false,
      wheels: 6,
      wheelRadius: 0.44,
      color: 0x5f6a4c,
      camo: 0x3b4430,
      camo2: 0x8b7a55,
      camoStyle: "bandes",
      skirts: true,
      modern: true,
      aaMG: true,
    },
  },
  // ------------------------------------------------ Guerre de 100 (rangs IX et X)
  {
    id: "furet",
    name: "Furet",
    cls: "leger",
    tier: 9,
    description: "Char léger moderne : canon de 105 mm, tourelleau téléopéré, chenilles vives. Il repère tout, tire vite et disparaît.",
    hp: 1350,
    caliber: 105,
    ammo: {
      perforant: { penetration: 220, damage: 320, speed: 1400, count: 30 },
      sousCalibre: { penetration: 290, damage: 320, speed: 1500, count: 10 },
      explosif: { penetration: 55, damage: 420, speed: 1100, count: 10 },
    },
    reload: 7,
    aimTime: 1.7,
    dispersion: 0.33,
    hull: { front: 50, side: 30, rear: 25, top: 15, frontSlope: 62, sideSlope: 0 },
    turret: { front: 60, side: 30, rear: 25, top: 15, frontSlope: 50, sideSlope: 12 },
    speed: 72,
    reverse: 30,
    accel: 6,
    hullTraverse: 58,
    turretTraverse: 50,
    gunArc: 180,
    depression: 10,
    elevation: 20,
    viewRange: 460,
    look: {
      length: 6.2,
      width: 3.1,
      hullHeight: 1.15,
      clearance: 0.45,
      turretShape: "coin",
      turret: [2.5, 0.85, 2.9],
      turretOffset: 0.1,
      gunLength: 4.6,
      gunRadius: 0.07,
      muzzleBrake: true,
      wheels: 6,
      wheelRadius: 0.38,
      color: 0x7c8676,
      camo: 0x566052,
      camo2: 0x9aa393,
      camoStyle: "numerique",
      skirts: true,
      modern: true,
      aaMG: true,
    },
  },
  {
    id: "crecelle",
    name: "Crécelle",
    cls: "leger",
    tier: 9,
    description: "Un blindé léger armé d'un canon Gatling de 20 mm guidé par radar : cent obus en trois secondes et demie. Il déchire les flancs.",
    hp: 1200,
    caliber: 20,
    ammo: {
      perforant: { penetration: 62, damage: 11, speed: 1030, count: 2000 },
      sousCalibre: { penetration: 82, damage: 11, speed: 1200, count: 600 },
      explosif: { penetration: 16, damage: 15, speed: 1030, count: 800 },
    },
    reload: 7.5,
    clip: { size: 100, interval: 0.035 },
    aimTime: 1,
    dispersion: 0.6,
    hull: { front: 38, side: 32, rear: 32, top: 12, frontSlope: 45, sideSlope: 0 },
    turret: { front: 20, side: 15, rear: 15, top: 8, frontSlope: 10, sideSlope: 5 },
    speed: 68,
    reverse: 24,
    accel: 5.6,
    hullTraverse: 56,
    turretTraverse: 70,
    gunArc: 180,
    depression: 8,
    elevation: 60,
    viewRange: 450,
    look: {
      length: 5,
      width: 2.7,
      hullHeight: 1.55,
      clearance: 0.42,
      turretShape: "anguleuse",
      turret: [1.5, 0.75, 1.6],
      turretOffset: -0.3,
      gunLength: 2.2,
      gunRadius: 0.03,
      muzzleBrake: false,
      wheels: 5,
      wheelRadius: 0.33,
      color: 0x6b6f57,
      camo: 0x4b4f3c,
      camoStyle: "taches",
      skirts: false,
      ifv: true,
      gatling: true,
      radar: true,
    },
  },
  {
    id: "moissonneuse",
    name: "Moissonneuse",
    cls: "moyen",
    tier: 9,
    description: "Char moyen à canon Gatling de 37 mm : quatre-vingts obus perçants à la suite. Rien ne résiste longtemps à la moisson, sauf le rechargement.",
    hp: 1600,
    caliber: 37,
    ammo: {
      perforant: { penetration: 100, damage: 22, speed: 1100, count: 1200 },
      sousCalibre: { penetration: 135, damage: 22, speed: 1300, count: 400 },
      explosif: { penetration: 22, damage: 30, speed: 1100, count: 400 },
    },
    reload: 9,
    clip: { size: 80, interval: 0.05 },
    aimTime: 1.2,
    dispersion: 0.5,
    hull: { front: 60, side: 45, rear: 30, top: 15, frontSlope: 60, sideSlope: 5 },
    turret: { front: 80, side: 50, rear: 40, top: 15, frontSlope: 25, sideSlope: 10 },
    speed: 60,
    reverse: 22,
    accel: 4.6,
    hullTraverse: 44,
    turretTraverse: 45,
    gunArc: 180,
    depression: 8,
    elevation: 25,
    viewRange: 400,
    look: {
      length: 6.4,
      width: 3.2,
      hullHeight: 1.4,
      clearance: 0.45,
      turretShape: "anguleuse",
      turret: [2.3, 1, 2.6],
      turretOffset: 0.2,
      gunLength: 3,
      gunRadius: 0.05,
      muzzleBrake: false,
      wheels: 5,
      wheelRadius: 0.4,
      color: 0x2c2e2d,
      camo: 0x1b1c1c,
      camo2: 0x3e4040,
      camoStyle: "bandes",
      skirts: true,
      gatling: true,
    },
  },
  {
    id: "albatros",
    name: "Albatros",
    cls: "moyen",
    tier: 10,
    description: "Char moyen de la guerre froide : peu de blindage, mais un canon de 105 mm précis et une vitesse qui lui permet d'être partout.",
    hp: 2000,
    caliber: 105,
    ammo: {
      perforant: { penetration: 268, damage: 390, speed: 1480, count: 50 },
      sousCalibre: { penetration: 330, damage: 390, speed: 1560, count: 15 },
      explosif: { penetration: 60, damage: 480, speed: 1150, count: 12 },
    },
    reload: 8.5,
    aimTime: 1.6,
    dispersion: 0.28,
    hull: { front: 70, side: 35, rear: 25, top: 15, frontSlope: 60, sideSlope: 0 },
    turret: { front: 110, side: 60, rear: 40, top: 20, frontSlope: 45, sideSlope: 15 },
    speed: 65,
    reverse: 26,
    accel: 5.4,
    hullTraverse: 48,
    turretTraverse: 44,
    gunArc: 180,
    depression: 9,
    elevation: 20,
    viewRange: 430,
    look: {
      length: 7.1,
      width: 3.3,
      hullHeight: 1.2,
      clearance: 0.46,
      turretShape: "plate",
      turret: [2.9, 0.95, 3.4],
      turretOffset: 0.1,
      gunLength: 5.4,
      gunRadius: 0.075,
      muzzleBrake: false,
      wheels: 7,
      wheelRadius: 0.4,
      color: 0x55603f,
      camo: 0x363d28,
      camo2: 0x6d5a3a,
      camoStyle: "taches",
      skirts: true,
      modern: true,
      aaMG: true,
    },
  },
  {
    id: "mastodonte",
    name: "Mastodonte",
    cls: "lourd",
    tier: 10,
    description: "Super-lourd de cent tonnes : un canon de 150 mm qui arrache 750 points par obus et une caisse immense. Lent, mais il faut l'arrêter.",
    hp: 2700,
    caliber: 150,
    ammo: {
      perforant: { penetration: 235, damage: 750, speed: 880, count: 40 },
      sousCalibre: { penetration: 320, damage: 750, speed: 1100, count: 8 },
      explosif: { penetration: 90, damage: 1000, speed: 880, count: 12 },
    },
    reload: 17,
    aimTime: 2.6,
    dispersion: 0.4,
    hull: { front: 200, side: 120, rear: 150, top: 40, frontSlope: 60, sideSlope: 0 },
    turret: { front: 200, side: 120, rear: 150, top: 40, frontSlope: 15, sideSlope: 20 },
    speed: 30,
    reverse: 12,
    accel: 2.2,
    hullTraverse: 20,
    turretTraverse: 18,
    gunArc: 180,
    depression: 7,
    elevation: 15,
    viewRange: 380,
    look: {
      length: 9.2,
      width: 4.2,
      hullHeight: 1.6,
      clearance: 0.52,
      turretShape: "anguleuse",
      turret: [3.4, 1.35, 4.6],
      turretOffset: -0.9,
      gunLength: 6.2,
      gunRadius: 0.1,
      muzzleBrake: true,
      wheels: 8,
      wheelRadius: 0.5,
      color: 0x72746b,
      camo: 0x5b5d55,
      camo2: 0x8a8c80,
      camoStyle: "uni",
      skirts: true,
    },
  },
  {
    id: "monolithe",
    name: "Monolithe",
    cls: "lourd",
    tier: 10,
    description: "La forteresse roulante : un blindage de 240 mm, 3200 points de structure et une tourelle énorme. Il avance au pas, et rien ne le traverse de face.",
    hp: 3200,
    caliber: 128,
    ammo: {
      perforant: { penetration: 246, damage: 490, speed: 920, count: 68 },
      sousCalibre: { penetration: 311, damage: 490, speed: 1150, count: 10 },
      explosif: { penetration: 65, damage: 630, speed: 920, count: 12 },
    },
    reload: 12.5,
    aimTime: 2.3,
    dispersion: 0.38,
    hull: { front: 220, side: 185, rear: 160, top: 60, frontSlope: 55, sideSlope: 0 },
    turret: { front: 240, side: 200, rear: 200, top: 60, frontSlope: 10, sideSlope: 15 },
    speed: 20,
    reverse: 12,
    accel: 1.6,
    hullTraverse: 16,
    turretTraverse: 16,
    gunArc: 180,
    depression: 7,
    elevation: 20,
    viewRange: 390,
    look: {
      length: 9.6,
      width: 4.1,
      hullHeight: 1.9,
      clearance: 0.5,
      turretShape: "arrondie",
      turret: [3.3, 1.5, 3.9],
      turretOffset: -1.2,
      gunLength: 5.2,
      gunRadius: 0.1,
      muzzleBrake: false,
      wheels: 8,
      wheelRadius: 0.36,
      color: 0x8a8466,
      camo: 0x5d5a45,
      camo2: 0x7b6a4b,
      camoStyle: "taches",
      skirts: true,
    },
  },
  {
    id: "tourmente",
    name: "Tourmente",
    cls: "lourd",
    tier: 10,
    description: "Char lourd à barillet : quatre obus de 120 mm tirés en dix secondes, puis trente secondes pour recharger. Il vide son barillet et se met à l'abri.",
    hp: 2250,
    caliber: 120,
    ammo: {
      perforant: { penetration: 258, damage: 400, speed: 1000, count: 40 },
      sousCalibre: { penetration: 340, damage: 400, speed: 1250, count: 12 },
      explosif: { penetration: 60, damage: 515, speed: 1000, count: 12 },
    },
    reload: 30,
    clip: { size: 4, interval: 2.5 },
    aimTime: 2.3,
    dispersion: 0.35,
    hull: { front: 127, side: 76, rear: 25, top: 25, frontSlope: 60, sideSlope: 0 },
    turret: { front: 203, side: 137, rear: 51, top: 40, frontSlope: 10, sideSlope: 20 },
    speed: 35,
    reverse: 16,
    accel: 3,
    hullTraverse: 28,
    turretTraverse: 26,
    gunArc: 180,
    depression: 10,
    elevation: 15,
    viewRange: 390,
    look: {
      length: 7.4,
      width: 3.7,
      hullHeight: 1.35,
      clearance: 0.5,
      turretShape: "arrondie",
      turret: [3, 1.2, 5.2],
      turretOffset: -1.4,
      gunLength: 6.4,
      gunRadius: 0.085,
      muzzleBrake: false,
      wheels: 7,
      wheelRadius: 0.44,
      color: 0x5d6146,
      camo: 0x3e4230,
      camo2: 0x777a5c,
      camoStyle: "taches",
      skirts: false,
      aaMG: true,
    },
  },
  {
    id: "donjon",
    name: "Donjon",
    cls: "lourd",
    tier: 10,
    description: "Une tour de 3000 points de structure : caisse haute comme un mur, 260 mm de blindage droit, deux tourelles de mitrailleuses. Très lent, très dur.",
    hp: 3000,
    caliber: 140,
    ammo: {
      perforant: { penetration: 225, damage: 560, speed: 850, count: 40 },
      sousCalibre: { penetration: 295, damage: 560, speed: 1050, count: 10 },
      explosif: { penetration: 70, damage: 800, speed: 850, count: 12 },
    },
    reload: 15,
    aimTime: 2.7,
    dispersion: 0.42,
    hull: { front: 260, side: 200, rear: 150, top: 50, frontSlope: 25, sideSlope: 0 },
    turret: { front: 260, side: 200, rear: 180, top: 50, frontSlope: 5, sideSlope: 5 },
    speed: 25,
    reverse: 10,
    accel: 1.8,
    hullTraverse: 18,
    turretTraverse: 16,
    gunArc: 180,
    depression: 8,
    elevation: 15,
    viewRange: 370,
    look: {
      length: 8.6,
      width: 4,
      hullHeight: 2.3,
      clearance: 0.55,
      turretShape: "anguleuse",
      turret: [3.1, 1.6, 3.6],
      turretOffset: -0.2,
      gunLength: 5.6,
      gunRadius: 0.1,
      muzzleBrake: false,
      wheels: 7,
      wheelRadius: 0.4,
      color: 0x57614a,
      camo: 0x3d4535,
      camoStyle: "uni",
      skirts: false,
      miniTurrets: true,
    },
  },
  {
    id: "lancefoudre",
    name: "Lance-Foudre",
    cls: "chasseur",
    tier: 10,
    description: "Chasseur à casemate ouverte, posée à l'arrière : un canon de 150 mm immense et d'une précision chirurgicale. Mais un rien le perce.",
    hp: 1950,
    caliber: 150,
    ammo: {
      perforant: { penetration: 330, damage: 750, speed: 1050, count: 30 },
      sousCalibre: { penetration: 390, damage: 750, speed: 1400, count: 10 },
      explosif: { penetration: 90, damage: 950, speed: 1050, count: 10 },
    },
    reload: 14,
    aimTime: 1.8,
    dispersion: 0.24,
    hull: { front: 50, side: 40, rear: 30, top: 15, frontSlope: 60, sideSlope: 0 },
    turret: { front: 30, side: 20, rear: 16, top: 0, frontSlope: 20, sideSlope: 10 },
    speed: 50,
    reverse: 20,
    accel: 3.8,
    hullTraverse: 40,
    turretTraverse: 12,
    gunArc: 15,
    depression: 8,
    elevation: 15,
    viewRange: 440,
    look: {
      length: 7.4,
      width: 3.4,
      hullHeight: 1.2,
      clearance: 0.45,
      turretShape: "casemate",
      turret: [2.8, 1.5, 3],
      turretOffset: 0,
      gunLength: 8.5,
      gunRadius: 0.1,
      muzzleBrake: true,
      wheels: 5,
      wheelRadius: 0.5,
      color: 0x6d6f6a,
      camo: 0x4e504c,
      camoStyle: "uni",
      skirts: false,
      rearCasemate: true,
      openTop: true,
    },
  },
  {
    id: "fracas",
    name: "Fracas",
    cls: "artillerie",
    tier: 10,
    description: "Artillerie autotractée : son obusier de 155 mm tire en cloche, de très loin, sur tout ce que l'équipe repère. Vue du dessus avec Maj.",
    hp: 1450,
    caliber: 155,
    ammo: {
      perforant: { penetration: 150, damage: 780, speed: 200, count: 10 },
      sousCalibre: { penetration: 110, damage: 600, speed: 200, count: 10 },
      explosif: { penetration: 90, damage: 780, speed: 200, count: 40 },
    },
    reload: 28,
    aimTime: 5,
    dispersion: 0.9,
    hull: { front: 30, side: 20, rear: 20, top: 15, frontSlope: 50, sideSlope: 0 },
    turret: { front: 30, side: 20, rear: 15, top: 15, frontSlope: 10, sideSlope: 10 },
    speed: 50,
    reverse: 18,
    accel: 3.6,
    hullTraverse: 36,
    turretTraverse: 18,
    gunArc: 180,
    depression: 0,
    elevation: 65,
    viewRange: 320,
    artyAngle: 48,
    shellGravity: 60,
    artyRange: 650,
    splash: 9,
    look: {
      length: 8.2,
      width: 3.5,
      hullHeight: 1.2,
      clearance: 0.5,
      turretShape: "anguleuse",
      turret: [3.3, 1.8, 3.6],
      turretOffset: -1.2,
      gunLength: 7.4,
      gunRadius: 0.11,
      muzzleBrake: true,
      wheels: 6,
      wheelRadius: 0.5,
      color: 0x4f5a3c,
      camo: 0x384128,
      camo2: 0x6a6040,
      camoStyle: "bandes",
      skirts: false,
      howitzer: true,
    },
  },
];

/** Camouflages au choix du garage (en plus de celui d'origine). */
export interface CamoChoice {
  id: string;
  name: string;
  style: CamoStyle;
  color: number;
  camo: number;
  camo2: number;
}

export const CAMO_CHOICES: CamoChoice[] = [
  { id: "foret", name: "Numérique forêt", style: "numerique", color: 0x3b403c, camo: 0x3fa045, camo2: 0x1f2320 },
  { id: "ocean", name: "Numérique océan", style: "numerique", color: 0x2b2f35, camo: 0x2f7fe0, camo2: 0x14171b },
  { id: "braise", name: "Numérique braise", style: "numerique", color: 0x2e2c2a, camo: 0xe0622a, camo2: 0x161514 },
  { id: "hiver", name: "Numérique hiver", style: "numerique", color: 0xc9ccd0, camo: 0x5b6066, camo2: 0x2c2f33 },
  { id: "desert", name: "Désert", style: "taches", color: 0xc8b084, camo: 0x9c7d52, camo2: 0x6b5638 },
  { id: "urbain", name: "Urbain", style: "bandes", color: 0x7c8185, camo: 0x3e4246, camo2: 0xb5b9bd },
];

export function camoChoice(id: string | null | undefined): CamoChoice | null {
  return CAMO_CHOICES.find((c) => c.id === id) ?? null;
}

export function tankById(id: string): TankDef {
  return TANKS.find((t) => t.id === id) ?? TANKS.find((t) => t.id === "bouledogue") ?? TANKS[0];
}

/** Chiffre romain du rang (V, VI, VII). */
export function tierLabel(tier: number): string {
  return ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][tier] ?? String(tier);
}

// ------------------------------------------------------------------- modes

export type BattleMode = "normale" | "cent";

export interface ModeInfo {
  id: BattleMode;
  name: string;
  tagline: string;
  /** Rangs des chars de ce mode (inclus). */
  tiers: [number, number];
  teamSize: number;
  /** Duree de la bataille, en secondes. */
  seconds: number;
  /** Bots plus rapides, plus precis, qui visent toujours les points faibles. */
  hard: boolean;
}

export const MODES: Record<BattleMode, ModeInfo> = {
  normale: {
    id: "normale",
    name: "Guerre normale",
    tagline: "Chars des rangs IV à VIII, sept contre sept.",
    tiers: [4, 8],
    teamSize: 7,
    seconds: 420,
    hard: false,
  },
  cent: {
    id: "cent",
    name: "Guerre de 100",
    tagline: "Le mode le plus dur : rangs VIII à X, super-lourds, canons Gatling et artillerie, huit contre huit, des bots redoutables.",
    tiers: [8, 10],
    teamSize: 8,
    seconds: 480,
    hard: true,
  },
};

/** Les chars jouables dans un mode. */
export function tanksForMode(mode: BattleMode): TankDef[] {
  const [lo, hi] = MODES[mode].tiers;
  return TANKS.filter((t) => t.tier >= lo && t.tier <= hi);
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
