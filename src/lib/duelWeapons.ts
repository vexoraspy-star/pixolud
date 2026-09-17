import * as THREE from "three";
import { CAMOS, type CamoId } from "./duelProfile";
import {
  makeCamoTexture,
  makeGloveTexture,
  makeGunMetalTexture,
  makeGunWoodTexture,
  makePolymerTexture,
  makeScopeLensTexture,
} from "./duelTextures";

/**
 * L'arsenal du Duel.
 *
 * Le jeu n'avait qu'une arme, donc un seul rythme de combat : on avancait et
 * on tirait, toujours pareil. Cinq armes aux defauts assumes creent des
 * situations differentes — le fusil a pompe force le corps a corps, le sniper
 * punit ceux qui traversent a decouvert, la mitraillette rate de loin.
 *
 * Chaque arme est definie une seule fois ici : degats, cadence, dispersion,
 * et le modele 3D tenu en main. Le reste du jeu ne connait que WeaponSpec.
 */

export type WeaponId =
  | "poings"
  | "pistolet"
  | "revolver"
  | "pm"
  | "mitraillette"
  | "pompe"
  | "fusil"
  | "carabine"
  | "mitrailleuse"
  | "sniper";

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  /** Nom court pour l'interface en jeu. */
  short: string;
  damage: number;
  /** Multiplicateur de degats sur un tir a la tete. */
  headshot: number;
  /** Secondes entre deux tirs. */
  fireInterval: number;
  /** Vrai = feu continu en gardant le bouton enfonce. */
  auto: boolean;
  magSize: number;
  reloadSeconds: number;
  /** Nombre de projectiles par tir (fusil a pompe). */
  pellets: number;
  /** Dispersion en radians, a l'arret. Elle double en mouvement. */
  spread: number;
  /** Amplitude du recul vertical de la camera. */
  recoil: number;
  /** Portee utile en cases ; au-dela, les degats tombent de moitie. */
  range: number;
  /** Facteur de vitesse de deplacement : une arme lourde ralentit. */
  moveFactor: number;
  /** Champ de vision en visee (undefined = pas de lunette). */
  zoomFov?: number;
  /** Couleur du traceur, pour distinguer les armes en combat. */
  tracer: number;
  /** Corps a corps : pas de munitions, pas de rechargement, portee d'un bras. */
  melee?: boolean;
}

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  poings: {
    id: "poings",
    name: "Poings",
    short: "POINGS",
    // En battle royale on atterrit les mains vides : les poings servent a se
    // defendre le temps de trouver une arme, pas a gagner un combat.
    damage: 20,
    headshot: 1,
    fireInterval: 0.45,
    auto: false,
    magSize: 0,
    reloadSeconds: 0,
    pellets: 1,
    spread: 0,
    recoil: 0.35,
    range: 1.35,
    moveFactor: 1.12,
    tracer: 0xffffff,
    melee: true,
  },
  pistolet: {
    id: "pistolet",
    name: "Pistolet",
    short: "PIST",
    damage: 34,
    headshot: 2.2,
    fireInterval: 0.26,
    auto: false,
    magSize: 12,
    reloadSeconds: 1.2,
    pellets: 1,
    spread: 0.009,
    recoil: 0.9,
    range: 18,
    moveFactor: 1.08,
    tracer: 0xffe6a8,
  },
  mitraillette: {
    id: "mitraillette",
    name: "Mitraillette",
    short: "SMG",
    damage: 17,
    headshot: 1.9,
    fireInterval: 0.075,
    auto: true,
    magSize: 30,
    reloadSeconds: 1.6,
    pellets: 1,
    // Elle crache vite mais arrose : au-dela de dix metres, elle ne sert plus.
    spread: 0.034,
    recoil: 0.5,
    range: 11,
    moveFactor: 1.05,
    tracer: 0xfff0c0,
  },
  fusil: {
    id: "fusil",
    name: "Fusil d'assaut",
    short: "FUSIL",
    damage: 25,
    headshot: 2.1,
    fireInterval: 0.125,
    auto: true,
    magSize: 30,
    reloadSeconds: 2,
    pellets: 1,
    spread: 0.016,
    recoil: 0.8,
    range: 22,
    moveFactor: 1,
    tracer: 0xffd98a,
  },
  pompe: {
    id: "pompe",
    name: "Fusil à pompe",
    short: "POMPE",
    // Huit plombs a 14 : colle au corps c'est mortel, a dix metres c'est rien.
    damage: 14,
    headshot: 1.4,
    fireInterval: 0.85,
    auto: false,
    magSize: 6,
    reloadSeconds: 2.7,
    pellets: 8,
    spread: 0.105,
    recoil: 2.2,
    range: 8,
    moveFactor: 0.95,
    tracer: 0xffbf7a,
  },
  revolver: {
    id: "revolver",
    name: "Revolver",
    short: "REVOLVER",
    // Six coups lents qui font mal : deux au corps, ou un a la tete et un
    // de plus. Il recompense le calme.
    damage: 56,
    headshot: 2,
    fireInterval: 0.52,
    auto: false,
    magSize: 6,
    reloadSeconds: 2.4,
    pellets: 1,
    spread: 0.006,
    recoil: 2,
    range: 20,
    moveFactor: 1.06,
    tracer: 0xffd070,
  },
  pm: {
    id: "pm",
    name: "Pistolet-mitrailleur",
    short: "PM",
    // La cadence la plus folle du jeu, et les degats les plus faibles : il
    // gagne un couloir, il perd une avenue.
    damage: 13,
    headshot: 1.8,
    fireInterval: 0.055,
    auto: true,
    magSize: 32,
    reloadSeconds: 1.4,
    pellets: 1,
    spread: 0.042,
    recoil: 0.35,
    range: 9,
    moveFactor: 1.1,
    tracer: 0xfff4c8,
  },
  carabine: {
    id: "carabine",
    name: "Carabine de précision",
    short: "CARABINE",
    // Entre le fusil d'assaut et le sniper : semi-automatique, une petite
    // lunette, et trois balles au corps pour abattre quelqu'un.
    damage: 46,
    headshot: 2,
    fireInterval: 0.32,
    auto: false,
    magSize: 12,
    reloadSeconds: 2.2,
    pellets: 1,
    spread: 0.004,
    recoil: 1.5,
    range: 30,
    moveFactor: 0.95,
    zoomFov: 46,
    tracer: 0xd8f0ff,
  },
  mitrailleuse: {
    id: "mitrailleuse",
    name: "Mitrailleuse",
    short: "LMG",
    // Soixante-quinze coups et un rechargement interminable : on tient une
    // position, on ne court pas avec.
    damage: 22,
    headshot: 1.9,
    fireInterval: 0.09,
    auto: true,
    magSize: 75,
    reloadSeconds: 4.2,
    pellets: 1,
    spread: 0.024,
    recoil: 0.7,
    range: 20,
    moveFactor: 0.82,
    tracer: 0xffc870,
  },
  sniper: {
    id: "sniper",
    name: "Fusil de précision",
    short: "SNIPER",
    // Un tir au corps ne tue pas tout a fait : il reste 5 PV, donc le duel
    // continue. A la tete, c'est fini.
    damage: 95,
    headshot: 1.6,
    fireInterval: 1.25,
    auto: false,
    magSize: 5,
    reloadSeconds: 2.9,
    pellets: 1,
    spread: 0.0015,
    recoil: 3.2,
    range: 40,
    moveFactor: 0.86,
    zoomFov: 26,
    tracer: 0xbfe9ff,
  },
};

/** L'ordre de progression du mode Course a l'armement. */
export const GUN_GAME_ORDER: WeaponId[] = [
  "pistolet",
  "revolver",
  "pm",
  "mitraillette",
  "pompe",
  "fusil",
  "carabine",
  "mitrailleuse",
  "sniper",
];

/** L'ordre des armes dans la boutique : touches 1 a 9, de la moins chere a la plus chere. */
export const SHOP_ORDER: WeaponId[] = [
  "pistolet",
  "revolver",
  "pm",
  "mitraillette",
  "pompe",
  "fusil",
  "carabine",
  "mitrailleuse",
  "sniper",
];

/**
 * Rarete au sol en battle royale : elle colore le faisceau de l'arme (gris,
 * bleu, violet, or) et fixe sa frequence. Un sniper doit rester une trouvaille.
 */
export type WeaponRarity = "commun" | "rare" | "epique" | "legendaire";
export const WEAPON_RARITY: Record<WeaponId, WeaponRarity> = {
  poings: "commun",
  pistolet: "commun",
  pm: "commun",
  mitraillette: "commun",
  revolver: "rare",
  pompe: "rare",
  fusil: "rare",
  carabine: "epique",
  mitrailleuse: "epique",
  sniper: "legendaire",
};

/** Tirage d'une arme au sol : commune 46 %, rare 32 %, epique 16 %, legendaire 6 %. */
export function rollLootWeapon(rand: () => number): WeaponId {
  const r = rand();
  const tier: WeaponRarity = r < 0.46 ? "commun" : r < 0.78 ? "rare" : r < 0.94 ? "epique" : "legendaire";
  const pool = SHOP_ORDER.filter((id) => WEAPON_RARITY[id] === tier);
  return pool[Math.floor(rand() * pool.length)];
}

/** Ce qu'on trouve au sol en Battle Royale, du plus commun au plus rare. */
export const LOOT_TABLE: WeaponId[] = [
  "pm",
  "mitraillette",
  "mitraillette",
  "revolver",
  "fusil",
  "fusil",
  "pompe",
  "carabine",
  "mitrailleuse",
  "sniper",
];

export interface WeaponModel {
  group: THREE.Group;
  /** Sphere de l'eclair de bouche, deja placee au bout du canon. */
  flash: THREE.Mesh;
  /** Anime les pieces mobiles et les mains. A appeler a chaque image. */
  update(anim: WeaponAnim): void;
  dispose(): void;
}

/** Etat de l'arme a une image donnee, tel que la scene le connait. */
export interface WeaponAnim {
  /** Horloge de la partie, pour le balancement au repos. */
  time: number;
  /** 1 juste apres un tir, retombe vers 0. */
  recoil: number;
  /** Avancement du rechargement, de 0 (aucun) a 1 (fini). */
  reload: number;
  /** 1 quand on vise. */
  aim: number;
  /** 1 en sprint. */
  sprint: number;
}

/**
 * Le modele tenu en main, a la premiere personne.
 *
 * Trois exigences : reconnaitre l'arme a sa silhouette sans lire l'interface,
 * VOIR qu'on la tient (deux mains gantees, pas une capsule flottante), et
 * comprendre ce qui se passe (la culasse recule, la pompe fait son
 * aller-retour, le chargeur tombe au rechargement).
 *
 * Tout est dessine ici en boites et cylindres, avec quatre textures peintes
 * au canvas : aucun fichier de modele, aucune image.
 */
/** Habillage d'une arme : camouflage, et couleurs de la tenue sur les mains. */
export interface WeaponLook {
  camo?: CamoId;
  sleeve?: number;
  glove?: number;
  /** Faux : l'arme seule, sans les mains (vitrine du casier). */
  hands?: boolean;
}

export function buildWeaponModel(id: WeaponId, look: WeaponLook = {}): WeaponModel {
  const group = new THREE.Group();
  // Les pieces vivent dans un sous-groupe : la scene pilote `group` (position
  // a l'ecran, visee, sprint), l'animation pilote `body` — sans se marcher
  // dessus.
  const body = new THREE.Group();
  group.add(body);

  const owned: { dispose(): void }[] = [];
  function keep<T extends { dispose(): void }>(x: T): T {
    owned.push(x);
    return x;
  }

  const metalTex = keep(makeGunMetalTexture());
  metalTex.repeat.set(2, 2);
  const polymerTex = keep(makePolymerTexture());
  polymerTex.repeat.set(2, 2);
  const woodTex = keep(makeGunWoodTexture());
  const gloveTex = keep(makeGloveTexture());

  const steel = keep(new THREE.MeshLambertMaterial({ map: metalTex, color: 0x8b939d }));
  const metal = keep(new THREE.MeshLambertMaterial({ map: metalTex, color: 0x555c65 }));
  const dark = keep(new THREE.MeshLambertMaterial({ map: polymerTex, color: 0x2a2e33 }));
  const polymer = keep(new THREE.MeshLambertMaterial({ map: polymerTex, color: 0x3b4046 }));
  const wood = keep(new THREE.MeshLambertMaterial({ map: woodTex }));
  const glove = keep(new THREE.MeshLambertMaterial({ map: gloveTex, color: 0x5b636c }));
  const gloveDark = keep(new THREE.MeshLambertMaterial({ map: gloveTex, color: 0x30363c }));
  const sleeve = keep(new THREE.MeshLambertMaterial({ map: gloveTex, color: 0x3a4038 }));
  const sable = keep(new THREE.MeshLambertMaterial({ map: polymerTex, color: 0x9c8155 }));
  const olive = keep(new THREE.MeshLambertMaterial({ map: polymerTex, color: 0x5d6349 }));
  const brass = keep(new THREE.MeshLambertMaterial({ color: 0xb08d3a }));
  const accent = keep(new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
  const white = keep(new THREE.MeshBasicMaterial({ color: 0xe8f0f5 }));

  // --- Tenue et camouflage ---
  if (look.sleeve !== undefined) sleeve.color.setHex(look.sleeve);
  if (look.glove !== undefined) {
    glove.color.setHex(look.glove);
    gloveDark.color.copy(glove.color).multiplyScalar(0.55);
  }
  const camo = CAMOS[look.camo ?? "standard"];
  if (camo.colors.length > 0) {
    // Le motif recouvre toute la garniture (polymere, bois, crosses) ; le
    // metal reste du metal, sauf pour l'or.
    const camoTex = keep(makeCamoTexture(camo.colors));
    camoTex.repeat.set(2, 2);
    for (const m of [polymer, sable, olive, wood]) {
      m.map = camoTex;
      m.color.setHex(0xffffff);
    }
    dark.map = camoTex;
    dark.color.setHex(0x8a8a8a);
  }
  if (camo.goldMetal) {
    steel.color.setHex(0xffd36b);
    metal.color.setHex(0xd9ab3c);
  }

  function box(w: number, h: number, d: number, mat: THREE.Material) {
    return new THREE.Mesh(keep(new THREE.BoxGeometry(w, h, d)), mat);
  }
  /** Cylindre couche le long de l'axe de tir. */
  function tube(r: number, len: number, mat: THREE.Material, seg = 8, r2 = r) {
    const m = new THREE.Mesh(keep(new THREE.CylinderGeometry(r, r2, len, seg)), mat);
    m.rotation.x = Math.PI / 2;
    return m;
  }
  function ring(r: number, thick: number, mat: THREE.Material) {
    const m = new THREE.Mesh(keep(new THREE.TorusGeometry(r, thick, 6, 14)), mat);
    return m;
  }
  function put(parent: THREE.Object3D, mesh: THREE.Object3D, x: number, y: number, z: number) {
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  /** Raccourci : une piece posee directement sur l'arme. */
  function add(mesh: THREE.Object3D, x: number, y: number, z: number) {
    return put(body, mesh, x, y, z);
  }

  /**
   * Une main gantee, doigts replies autour de ce qu'elle tient, avec le
   * poignet et la manche qui repartent vers l'epaule. L'origine est le centre
   * de la prise ; les doigts s'enroulent autour de l'axe Y (une poignee
   * verticale). Pour un garde-main horizontal, on tourne la main d'un quart
   * de tour autour de X.
   */
  function buildHand(): THREE.Group {
    const h = new THREE.Group();
    put(h, box(0.088, 0.12, 0.055, glove), 0.012, 0, 0.06); // dos de la main
    put(h, box(0.076, 0.105, 0.055, glove), 0.004, -0.004, 0.008); // paume
    for (let i = 0; i < 4; i++) {
      const y = 0.042 - i * 0.031;
      const seg = put(h, box(0.058, 0.028, 0.088, glove), 0.014, y, -0.012);
      seg.rotation.x = -0.26 - i * 0.05;
      const tip = put(h, box(0.052, 0.026, 0.05, glove), 0.014, y - 0.026, -0.058);
      tip.rotation.x = -1.05;
      // Fente sombre entre deux doigts : sans elle, la main est un bloc.
      if (i < 3) put(h, box(0.06, 0.005, 0.09, gloveDark), 0.014, y - 0.016, -0.014);
    }
    const thumb = put(h, box(0.032, 0.03, 0.095, glove), -0.032, 0.032, 0.005);
    thumb.rotation.set(-0.3, 0, 0.45);
    const wrist = put(h, tube(0.046, 0.08, gloveDark, 8), 0.02, -0.02, 0.1);
    wrist.rotation.x = Math.PI / 2 + 0.2;
    // Manche : courte et sombre. Un avant-bras long occupait la moitie de
    // l'ecran en visee — on n'en garde que le depart, comme dans un vrai FPS.
    const cuff = put(h, tube(0.056, 0.04, gloveDark, 8), 0.024, -0.04, 0.145);
    cuff.rotation.x = Math.PI / 2 + 0.25;
    const arm = put(h, tube(0.05, 0.18, sleeve, 8, 0.058), 0.03, -0.075, 0.24);
    arm.rotation.x = Math.PI / 2 + 0.28;
    return h;
  }

  /** Longueur du canon : elle fixe ou se place l'eclair de bouche. */
  let muzzleZ = -0.6;
  /** Hauteur de la ligne de mire : en visee, on l'amene au centre de l'ecran. */
  let sightY = 0.07;
  /** Rechargement : chargeur qui tombe, ou cartouches glissees une a une. */
  let reloadStyle: "chargeur" | "cartouches" = "chargeur";

  // Pieces mobiles, remplies par chaque arme.
  let slide: THREE.Object3D | null = null;
  let pump: THREE.Object3D | null = null;
  let bolt: THREE.Object3D | null = null;
  let mag: THREE.Object3D | null = null;
  /** Barillet du revolver : il tourne d'un sixieme de tour a chaque coup. */
  let drum: THREE.Object3D | null = null;
  /** Hauteur du canon, la ou part l'eclair de bouche. */
  let muzzleY = 0.014;
  const rightHand = buildHand();
  const leftHand = buildHand();

  /** Pontet et queue de detente, communs a toutes les armes. */
  function triggerGuard(y: number, z: number) {
    add(box(0.052, 0.014, 0.085, dark), 0, y - 0.05, z);
    add(box(0.05, 0.05, 0.014, dark), 0, y - 0.028, z - 0.04);
    add(box(0.014, 0.042, 0.016, metal), 0, y - 0.022, z + 0.012);
  }
  /** Crosse pistolet : le bloc que la main droite empoigne. */
  function pistolGrip(x: number, y: number, z: number, tilt: number, mat: THREE.Material, w = 0.07, h = 0.2) {
    const g = add(box(w, h, 0.095, mat), x, y, z);
    g.rotation.x = tilt;
    return g;
  }

  switch (id) {
    case "poings": {
      // Deux poings en garde, le droit devant : c'est lui qui frappe.
      put(body, rightHand, 0.02, -0.06, -0.08).rotation.set(0.35, -0.25, -0.2);
      put(body, leftHand, -0.34, -0.1, 0.02).rotation.set(0.45, 0.35, 0.25);
      muzzleZ = -0.2;
      sightY = 0.05;
      break;
    }

    case "pistolet": {
      // --- Culasse mobile ---
      slide = new THREE.Group();
      add(slide as THREE.Group, 0, 0, 0);
      put(slide, box(0.072, 0.075, 0.3, steel), 0, 0.028, -0.05);
      for (let i = 0; i < 5; i++) put(slide, box(0.076, 0.05, 0.008, metal), 0, 0.028, 0.05 + i * 0.016);
      put(slide, box(0.03, 0.038, 0.085, dark), 0.038, 0.035, -0.02); // fenetre d'ejection
      put(slide, box(0.014, 0.024, 0.014, dark), 0, 0.075, -0.185); // guidon
      put(slide, box(0.006, 0.008, 0.006, white), 0, 0.082, -0.19);
      for (const sx of [-0.024, 0.024]) {
        put(slide, box(0.014, 0.022, 0.018, dark), sx, 0.073, 0.075);
        put(slide, box(0.005, 0.007, 0.005, white), sx, 0.079, 0.066);
      }
      put(slide, tube(0.015, 0.06, dark), 0, 0.028, -0.2);
      // --- Carcasse ---
      add(box(0.066, 0.055, 0.26, polymer), 0, -0.03, -0.02);
      add(box(0.05, 0.03, 0.09, dark), 0, -0.05, -0.16); // rail sous le canon
      triggerGuard(-0.03, 0.005);
      pistolGrip(0, -0.145, 0.055, -0.16, polymer);
      // --- Chargeur (tombe au rechargement) ---
      mag = new THREE.Group();
      add(mag as THREE.Group, 0, 0, 0);
      const pmag = put(mag, box(0.052, 0.2, 0.08, metal), 0, -0.15, 0.055);
      pmag.rotation.x = -0.16;
      const pbase = put(mag, box(0.066, 0.02, 0.095, dark), 0, -0.248, 0.07);
      pbase.rotation.x = -0.16;
      muzzleZ = -0.24;
      sightY = 0.075;
      // Deux mains : la gauche vient soutenir la droite, comme au stand.
      put(body, rightHand, 0.01, -0.15, 0.06).rotation.set(-0.16, 0, 0);
      put(body, leftHand, -0.062, -0.185, 0.02).rotation.set(-0.16, 0.6, 0.4);
      break;
    }

    case "mitraillette": {
      add(box(0.082, 0.1, 0.36, polymer), 0, 0, 0);
      add(box(0.036, 0.018, 0.3, dark), 0, 0.058, -0.02); // rail
      for (let i = 0; i < 7; i++) add(box(0.04, 0.026, 0.012, metal), 0, 0.06, -0.14 + i * 0.045);
      // Poignee d'armement, qui recule avec la culasse.
      slide = new THREE.Group();
      add(slide as THREE.Group, 0, 0, 0);
      put(slide, box(0.022, 0.022, 0.06, steel), -0.052, 0.035, 0.05);
      put(slide, box(0.05, 0.03, 0.02, metal), -0.03, 0.035, 0.07);
      // Garde-main ajoure.
      add(box(0.08, 0.078, 0.2, metal), 0, -0.018, -0.25);
      for (let i = 0; i < 3; i++) {
        add(box(0.086, 0.02, 0.05, dark), 0, 0.005, -0.31 + i * 0.06);
      }
      add(tube(0.016, 0.26, steel), 0, 0.012, -0.3);
      add(tube(0.023, 0.06, metal, 10), 0, 0.012, -0.45);
      put(body, ring(0.028, 0.006, dark), 0, 0.055, -0.36); // guidon annulaire
      put(body, ring(0.022, 0.006, dark), 0, 0.06, 0.13); // dioptre arriere
      // Chargeur droit et long, legerement incline.
      mag = new THREE.Group();
      add(mag as THREE.Group, 0, 0, 0);
      const smag = put(mag, box(0.058, 0.3, 0.078, metal), 0, -0.2, -0.05);
      smag.rotation.x = 0.2;
      for (let i = 0; i < 4; i++) {
        const rib = put(mag, box(0.062, 0.012, 0.082, dark), 0, -0.1 - i * 0.06, -0.038 - i * 0.012);
        rib.rotation.x = 0.2;
      }
      pistolGrip(0, -0.15, 0.09, -0.2, polymer, 0.068, 0.185);
      triggerGuard(-0.04, 0.05);
      // Crosse telescopique.
      for (const sx of [-0.032, 0.032]) add(tube(0.011, 0.22, metal), sx, 0.005, 0.25);
      add(box(0.09, 0.115, 0.03, polymer), 0, -0.005, 0.36);
      muzzleZ = -0.47;
      sightY = 0.06;
      put(body, rightHand, 0.01, -0.15, 0.1).rotation.set(-0.2, 0, 0);
      put(body, leftHand, -0.01, -0.075, -0.25).rotation.set(Math.PI / 2 - 0.15, 0.2, 0.25);
      break;
    }

    case "fusil": {
      add(box(0.088, 0.105, 0.42, metal), 0, 0, -0.02);
      add(box(0.038, 0.018, 0.44, dark), 0, 0.062, -0.04);
      for (let i = 0; i < 9; i++) add(box(0.042, 0.026, 0.012, dark), 0, 0.064, -0.22 + i * 0.045);
      // Viseur point rouge : c'est lui qu'on amene au centre en visee.
      add(box(0.05, 0.055, 0.075, dark), 0, 0.09, 0.06);
      put(body, ring(0.036, 0.007, dark), 0, 0.115, 0.03);
      put(body, ring(0.036, 0.007, dark), 0, 0.115, 0.09);
      const dot = add(new THREE.Mesh(keep(new THREE.SphereGeometry(0.009, 6, 5)), accent), 0, 0.115, 0.055);
      dot.name = "dot";
      // Garde-main ajoure et bloc de gaz.
      add(box(0.076, 0.082, 0.26, sable), 0, -0.012, -0.32);
      for (let i = 0; i < 4; i++) add(box(0.082, 0.018, 0.045, dark), 0, -0.012, -0.42 + i * 0.058);
      add(box(0.032, 0.032, 0.05, metal), 0, 0.05, -0.43);
      add(tube(0.015, 0.22, steel), 0, 0.012, -0.5);
      const brake = add(tube(0.026, 0.08, metal, 10), 0, 0.012, -0.62);
      brake.name = "brake";
      for (let i = 0; i < 3; i++) add(box(0.056, 0.012, 0.012, dark), 0, 0.012, -0.6 + i * 0.022);
      // Chargeur courbe : deux troncons legerement inclines.
      mag = new THREE.Group();
      add(mag as THREE.Group, 0, 0, 0);
      const m1 = put(mag, box(0.056, 0.18, 0.078, sable), 0, -0.13, -0.02);
      m1.rotation.x = 0.12;
      const m2 = put(mag, box(0.052, 0.14, 0.072, sable), 0, -0.27, -0.055);
      m2.rotation.x = 0.4;
      pistolGrip(0, -0.16, 0.12, -0.22, sable, 0.072, 0.2);
      triggerGuard(-0.05, 0.08);
      // Poignee d'armement laterale, solidaire de la culasse.
      slide = new THREE.Group();
      add(slide as THREE.Group, 0, 0, 0);
      put(slide, box(0.06, 0.022, 0.024, metal), -0.02, 0.056, 0.185);
      // Crosse reglable avec appui-joue.
      add(tube(0.028, 0.24, metal), 0, -0.01, 0.28);
      // Crosse ajouree : deux montants et un appui-joue, pas un pave.
      add(box(0.056, 0.036, 0.16, sable), 0, 0.048, 0.34);
      add(box(0.056, 0.036, 0.16, sable), 0, -0.078, 0.34);
      add(box(0.02, 0.09, 0.03, sable), 0, -0.015, 0.29);
      add(box(0.062, 0.145, 0.032, dark), 0, -0.015, 0.425);
      muzzleZ = -0.67;
      sightY = 0.115;
      put(body, rightHand, 0.01, -0.16, 0.13).rotation.set(-0.22, 0, 0);
      put(body, leftHand, -0.012, -0.075, -0.33).rotation.set(Math.PI / 2 - 0.1, 0.25, 0.3);
      break;
    }

    case "pompe": {
      add(box(0.1, 0.12, 0.26, metal), 0, 0, 0.03);
      add(box(0.104, 0.03, 0.26, steel), 0, 0.05, 0.03); // nervure superieure
      add(box(0.034, 0.045, 0.1, dark), 0.052, 0.01, 0.02); // fenetre d'ejection
      add(tube(0.032, 0.52, metal, 10), 0, 0.04, -0.42);
      add(tube(0.024, 0.44, steel), 0, -0.018, -0.38); // tube magasin
      // La pompe : elle coulisse apres chaque coup, la main gauche dessus.
      pump = new THREE.Group();
      add(pump as THREE.Group, 0, -0.015, -0.3);
      put(pump, box(0.082, 0.088, 0.17, wood), 0, 0, 0);
      for (let i = 0; i < 5; i++) put(pump, box(0.086, 0.012, 0.014, dark), 0, 0.01 - i * 0.022, 0);
      // Crosse en noyer, avec cartouches de rechange sur le cote.
      const stock = add(box(0.085, 0.115, 0.28, wood), 0, -0.07, 0.3);
      stock.rotation.x = 0.12;
      add(box(0.072, 0.105, 0.13, wood), 0, -0.06, 0.16);
      add(box(0.095, 0.13, 0.035, dark), 0, -0.095, 0.44);
      for (let i = 0; i < 4; i++) {
        const shell = add(tube(0.016, 0.055, i % 2 === 0 ? brass : accent), 0.056, -0.03 - i * 0.008, 0.24 + i * 0.05);
        shell.rotation.x = Math.PI / 2 + 0.1;
      }
      triggerGuard(-0.03, 0.12);
      add(new THREE.Mesh(keep(new THREE.SphereGeometry(0.012, 6, 5)), brass), 0, 0.078, -0.66); // guidon bille
      muzzleZ = -0.74;
      sightY = 0.078;
      reloadStyle = "cartouches";
      put(body, rightHand, 0.01, -0.125, 0.16).rotation.set(-0.12, 0, 0);
      // La main gauche est fille de la pompe : elle coulisse avec elle.
      put(pump, leftHand, -0.012, -0.055, 0.01).rotation.set(Math.PI / 2 - 0.12, 0.2, 0.2);
      break;
    }

    case "revolver": {
      add(box(0.062, 0.075, 0.15, steel), 0, 0.02, 0);
      add(tube(0.022, 0.27, steel, 10), 0, 0.034, -0.2);
      add(box(0.02, 0.022, 0.27, metal), 0, 0.064, -0.2); // nervure du canon
      add(box(0.012, 0.028, 0.014, dark), 0, 0.085, -0.32); // guidon
      add(box(0.006, 0.008, 0.006, white), 0, 0.094, -0.325);
      add(box(0.032, 0.014, 0.02, dark), 0, 0.068, 0.06); // cran de mire
      add(tube(0.012, 0.2, metal), 0, 0.002, -0.18); // tige d'ejecteur
      drum = new THREE.Group();
      add(drum as THREE.Group, 0, 0.022, -0.02);
      put(drum, tube(0.05, 0.1, metal, 6), 0, 0, 0);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        put(drum, box(0.014, 0.014, 0.102, dark), Math.cos(a) * 0.046, Math.sin(a) * 0.046, 0);
      }
      const hammer = add(box(0.016, 0.042, 0.03, dark), 0, 0.066, 0.078);
      hammer.rotation.x = -0.45;
      triggerGuard(-0.005, 0.02);
      pistolGrip(0, -0.115, 0.09, -0.38, wood, 0.058, 0.17);
      muzzleZ = -0.35;
      muzzleY = 0.034;
      sightY = 0.09;
      reloadStyle = "cartouches";
      put(body, rightHand, 0.01, -0.125, 0.1).rotation.set(-0.38, 0, 0);
      put(body, leftHand, -0.062, -0.155, 0.06).rotation.set(-0.32, 0.6, 0.4);
      break;
    }

    case "pm": {
      add(box(0.078, 0.1, 0.26, metal), 0, 0, -0.02);
      add(box(0.07, 0.03, 0.2, dark), 0, 0.062, -0.02);
      add(tube(0.015, 0.1, steel), 0, 0.01, -0.2);
      add(tube(0.022, 0.04, dark, 8), 0, 0.01, -0.255);
      put(body, ring(0.02, 0.005, dark), 0, 0.09, -0.12);
      add(box(0.03, 0.02, 0.02, dark), 0, 0.086, 0.08);
      // Levier d'armement sur le dessus : il claque en arriere a chaque coup.
      slide = new THREE.Group();
      add(slide as THREE.Group, 0, 0, 0);
      put(slide, box(0.024, 0.022, 0.04, steel), 0, 0.087, 0.02);
      pistolGrip(0, -0.12, 0.03, -0.08, polymer, 0.066, 0.17);
      // Chargeur dans la poignee, qui depasse longuement dessous.
      mag = new THREE.Group();
      add(mag as THREE.Group, 0, 0, 0);
      put(mag, box(0.05, 0.3, 0.06, steel), 0, -0.2, 0.036).rotation.x = -0.08;
      put(mag, box(0.058, 0.022, 0.07, dark), 0, -0.352, 0.048).rotation.x = -0.08;
      triggerGuard(-0.04, -0.04);
      // Crosse en fil d'acier, repliee le long du boitier.
      for (const sx of [-0.046, 0.046]) add(tube(0.007, 0.26, steel), sx, 0.01, 0.1);
      add(box(0.1, 0.012, 0.02, steel), 0, 0.01, 0.23);
      muzzleZ = -0.29;
      muzzleY = 0.01;
      sightY = 0.095;
      put(body, rightHand, 0.01, -0.12, 0.035).rotation.set(-0.08, 0, 0);
      put(body, leftHand, -0.012, -0.07, -0.13).rotation.set(Math.PI / 2 - 0.15, 0.2, 0.25);
      break;
    }

    case "mitrailleuse": {
      add(box(0.11, 0.13, 0.48, metal), 0, 0, 0);
      add(box(0.115, 0.03, 0.3, steel), 0, 0.078, 0.02); // couvercle d'alimentation
      add(tube(0.03, 0.62, metal, 10), 0, 0.02, -0.52);
      // Ailettes de refroidissement autour du canon.
      for (let i = 0; i < 5; i++) add(tube(0.038, 0.02, dark, 10), 0, 0.02, -0.34 - i * 0.06);
      add(tube(0.035, 0.08, dark, 10), 0, 0.02, -0.86);
      // Poignee de transport.
      add(box(0.02, 0.07, 0.02, dark), 0, 0.12, -0.24);
      add(box(0.02, 0.07, 0.02, dark), 0, 0.12, -0.08);
      add(box(0.024, 0.02, 0.2, polymer), 0, 0.158, -0.16);
      add(box(0.014, 0.05, 0.016, dark), 0, 0.075, -0.8); // guidon
      add(box(0.036, 0.03, 0.02, dark), 0, 0.105, 0.15); // hausse
      add(box(0.092, 0.075, 0.24, polymer), 0, -0.04, -0.3);
      for (const sx of [-0.032, 0.032]) {
        const leg = add(tube(0.01, 0.3, dark), sx, -0.055, -0.62);
        leg.rotation.x = Math.PI / 2 + 0.12;
      }
      // Boite a munitions a gauche, et la bande de cartouches qui entre.
      mag = new THREE.Group();
      add(mag as THREE.Group, 0, 0, 0);
      put(mag, box(0.13, 0.17, 0.15, olive), -0.03, -0.15, 0.02);
      for (let i = 0; i < 6; i++) put(mag, box(0.012, 0.012, 0.05, brass), -0.1 + i * 0.013, -0.045, 0.02);
      slide = new THREE.Group();
      add(slide as THREE.Group, 0, 0, 0);
      put(slide, box(0.05, 0.022, 0.026, steel), 0.07, 0.02, -0.05);
      pistolGrip(0, -0.17, 0.17, -0.22, polymer, 0.074, 0.2);
      triggerGuard(-0.065, 0.12);
      add(box(0.08, 0.14, 0.28, polymer), 0, -0.03, 0.4);
      add(box(0.086, 0.15, 0.03, dark), 0, -0.03, 0.555);
      muzzleZ = -0.92;
      muzzleY = 0.02;
      sightY = 0.105;
      reloadStyle = "chargeur";
      put(body, rightHand, 0.01, -0.17, 0.18).rotation.set(-0.22, 0, 0);
      put(body, leftHand, -0.012, -0.1, -0.3).rotation.set(Math.PI / 2 - 0.1, 0.25, 0.3);
      break;
    }

    case "carabine": {
      add(box(0.08, 0.1, 0.4, metal), 0, 0, 0);
      add(tube(0.018, 0.5, steel, 10), 0, 0.012, -0.44);
      add(tube(0.028, 0.06, dark, 10), 0, 0.012, -0.72);
      // Lunette compacte, grossissement x2.
      add(tube(0.034, 0.22, dark, 12), 0, 0.12, -0.02);
      add(tube(0.043, 0.05, dark, 12), 0, 0.12, -0.14);
      for (const z of [-0.07, 0.04]) add(box(0.026, 0.05, 0.026, metal), 0, 0.075, z);
      const smallLens = keep(new THREE.MeshBasicMaterial({ map: keep(makeScopeLensTexture()) }));
      add(new THREE.Mesh(keep(new THREE.CircleGeometry(0.032, 14)), smallLens), 0, 0.12, 0.092);
      // Bois pour le garde-main et la crosse : c'est une arme de chasseur.
      add(box(0.074, 0.08, 0.3, wood), 0, -0.015, -0.3);
      const dstock = add(box(0.07, 0.13, 0.32, wood), 0, -0.05, 0.36);
      dstock.rotation.x = 0.1;
      add(box(0.074, 0.14, 0.03, dark), 0, -0.07, 0.52);
      slide = new THREE.Group();
      add(slide as THREE.Group, 0, 0, 0);
      put(slide, box(0.05, 0.02, 0.022, steel), 0.05, 0.03, 0.08);
      mag = new THREE.Group();
      add(mag as THREE.Group, 0, 0, 0);
      put(mag, box(0.05, 0.14, 0.09, metal), 0, -0.11, -0.04);
      pistolGrip(0, -0.15, 0.15, -0.3, wood, 0.068, 0.18);
      triggerGuard(-0.05, 0.1);
      muzzleZ = -0.76;
      muzzleY = 0.012;
      sightY = 0.12;
      put(body, rightHand, 0.01, -0.15, 0.16).rotation.set(-0.3, 0, 0);
      put(body, leftHand, -0.012, -0.07, -0.3).rotation.set(Math.PI / 2 - 0.1, 0.22, 0.28);
      break;
    }

    case "sniper": {
      add(box(0.085, 0.11, 0.42, dark), 0, 0, 0.02);
      add(tube(0.026, 0.62, metal, 10), 0, 0.012, -0.5);
      for (let i = 0; i < 4; i++) {
        const flute = add(box(0.01, 0.01, 0.4, steel), Math.cos((i / 4) * Math.PI * 2) * 0.024, 0.012 + Math.sin((i / 4) * Math.PI * 2) * 0.024, -0.46);
        flute.name = "flute";
      }
      add(tube(0.036, 0.09, steel, 10), 0, 0.012, -0.86);
      for (let i = 0; i < 3; i++) add(box(0.078, 0.012, 0.014, dark), 0, 0.012, -0.84 + i * 0.024);
      // Lunette : corps, cloche avant, bagues, et le verre avec son reticule.
      add(tube(0.042, 0.34, dark, 12), 0, 0.14, -0.08);
      add(tube(0.052, 0.08, dark, 12), 0, 0.14, -0.26);
      add(tube(0.046, 0.06, dark, 12), 0, 0.14, 0.07);
      for (const z of [-0.02, 0.06]) {
        const r = put(body, ring(0.05, 0.012, metal), 0, 0.14, z);
        r.rotation.y = Math.PI / 2;
        r.rotation.x = Math.PI / 2;
      }
      add(box(0.03, 0.06, 0.03, metal), 0, 0.1, -0.02);
      add(box(0.03, 0.06, 0.03, metal), 0, 0.1, 0.06);
      add(tube(0.022, 0.05, metal), 0.045, 0.16, -0.08).rotation.z = Math.PI / 2; // tourelle
      const lensMat = keep(new THREE.MeshBasicMaterial({ map: keep(makeScopeLensTexture()) }));
      const lens = add(new THREE.Mesh(keep(new THREE.CircleGeometry(0.042, 16)), lensMat), 0, 0.14, 0.1);
      lens.name = "lens";
      const front = add(new THREE.Mesh(keep(new THREE.CircleGeometry(0.048, 16)), lensMat), 0, 0.14, -0.3);
      front.rotation.y = Math.PI;
      // Levier de culasse : il se releve et recule apres chaque tir.
      bolt = new THREE.Group();
      add(bolt as THREE.Group, 0.042, 0.02, 0.14);
      const lever = put(bolt, box(0.02, 0.02, 0.1, steel), 0.03, 0, 0.02);
      lever.rotation.y = -0.35;
      put(bolt, new THREE.Mesh(keep(new THREE.SphereGeometry(0.024, 8, 6)), steel), 0.062, 0, 0.06);
      // Crosse a trou de pouce, appui-joue reglable.
      // Crosse a trou de pouce : deux branches et un appui-joue.
      add(box(0.075, 0.05, 0.36, olive), 0, 0.02, 0.32);
      add(box(0.075, 0.055, 0.3, olive), 0, -0.115, 0.34);
      add(box(0.07, 0.11, 0.05, olive), 0, -0.05, 0.47);
      add(box(0.062, 0.05, 0.2, dark), 0, 0.055, 0.3);
      add(box(0.085, 0.17, 0.035, dark), 0, -0.05, 0.5);
      add(box(0.05, 0.06, 0.1, olive), 0, -0.135, 0.2);
      pistolGrip(0, -0.17, 0.17, -0.22, olive, 0.074, 0.21);
      triggerGuard(-0.06, 0.13);
      mag = new THREE.Group();
      add(mag as THREE.Group, 0, 0, 0);
      put(mag, box(0.052, 0.14, 0.11, metal), 0, -0.12, -0.05);
      // Bipied replie sous le canon.
      for (const sx of [-0.028, 0.028]) {
        const leg = add(tube(0.009, 0.22, dark), sx, -0.035, -0.5);
        leg.rotation.x = Math.PI / 2 + 0.25;
      }
      muzzleZ = -0.92;
      sightY = 0.14;
      put(body, rightHand, 0.01, -0.17, 0.18).rotation.set(-0.22, 0, 0);
      put(body, leftHand, -0.012, -0.07, -0.26).rotation.set(Math.PI / 2 - 0.1, 0.22, 0.28);
      break;
    }
  }

  if (look.hands === false) {
    rightHand.visible = false;
    leftHand.visible = false;
  }

  const flashMat = keep(
    new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95 }),
  );
  const flash = new THREE.Mesh(keep(new THREE.SphereGeometry(id === "pompe" ? 0.14 : 0.09, 8, 8)), flashMat);
  flash.position.set(0, id === "pistolet" ? 0.028 : muzzleY, muzzleZ);
  flash.visible = false;
  body.add(flash);

  // Positions de repos des pieces mobiles : l'animation repart toujours d'ici.
  const slideZ = slide?.position.z ?? 0;
  const pumpZ = pump?.position.z ?? 0;
  const boltZ = bolt?.position.z ?? 0;
  const magY = mag?.position.y ?? 0;
  const leftBase = leftHand.position.clone();
  let drumTarget = 0;
  let lastRecoil = 0;
  const rightBase = rightHand.position.clone();

  function update(anim: WeaponAnim) {
    const rec = Math.min(1, Math.max(0, anim.recoil));
    // Un tir vient de partir quand `rec` vaut 1 ; il retombe vers 0. Le
    // cycle (aller-retour) se lit donc a l'envers : sin((1 - rec) * PI).
    const cycle = Math.sin((1 - rec) * Math.PI);

    if (slide) slide.position.z = slideZ + rec * 0.055;
    if (drum) {
      // Un nouveau coup : le recul remonte d'un bond.
      if (rec > lastRecoil + 0.5) drumTarget += Math.PI / 3;
      drum.rotation.z += (drumTarget - drum.rotation.z) * 0.35;
    }
    lastRecoil = rec;
    if (pump) pump.position.z = pumpZ + cycle * 0.15;
    if (bolt) {
      bolt.rotation.x = -cycle * 1.0;
      bolt.position.z = boltZ + cycle * 0.11;
    }

    // --- Rechargement ---
    const r = Math.min(1, Math.max(0, anim.reload));
    const bell = Math.sin(r * Math.PI);
    if (r > 0) {
      if (reloadStyle === "chargeur" && mag) {
        // Le chargeur tombe, puis un neuf remonte en place.
        const out = Math.min(1, r / 0.34) - Math.max(0, (r - 0.62) / 0.38);
        mag.position.y = magY - out * 0.46;
        mag.visible = out < 0.94;
        leftHand.position.set(leftBase.x - out * 0.1, leftBase.y - out * 0.34, leftBase.z + out * 0.26);
      } else {
        // Fusil a pompe : la main gauche va chercher les cartouches sous
        // l'arme, trois fois de suite.
        const dip = Math.abs(Math.sin(r * Math.PI * 3)) * bell;
        leftHand.position.set(leftBase.x, leftBase.y - dip * 0.3, leftBase.z + dip * 0.2);
      }
      // L'arme bascule vers l'interieur, comme quand on regarde ce qu'on fait.
      // Elle remonte un peu au passage : baissee, elle sortait du cadre.
      body.rotation.set(0.16 * bell, 0.34 * bell, -0.55 * bell);
      body.position.set(-0.06 * bell, 0.04 * bell, 0.07 * bell);
    } else {
      if (mag) {
        mag.position.y = magY;
        mag.visible = true;
      }
      leftHand.position.copy(leftBase);
      // Respiration : un balancement lent, presque arrete en visee.
      const calm = 1 - anim.aim * 0.85;
      body.rotation.set(Math.sin(anim.time * 0.9) * 0.012 * calm, Math.sin(anim.time * 0.7 + 1) * 0.016 * calm, 0);
      // En visee, on monte l'arme pour amener la ligne de mire au centre.
      body.position.set(0, Math.sin(anim.time * 1.3) * 0.004 * calm + anim.aim * (0.2069 - sightY), 0);
    }
    rightHand.position.copy(rightBase);
    if (id === "poings") {
      // Le coup part en avant et un peu vers le centre, puis revient en garde.
      rightHand.position.set(rightBase.x - cycle * 0.12, rightBase.y + cycle * 0.06, rightBase.z - cycle * 0.34);
      leftHand.position.set(leftBase.x, leftBase.y + Math.sin(anim.time * 3) * 0.01, leftBase.z);
    }
  }
  update({ time: 0, recoil: 0, reload: 0, aim: 0, sprint: 0 });

  return {
    group,
    flash,
    update,
    dispose() {
      for (const o of owned) o.dispose();
    },
  };
}
