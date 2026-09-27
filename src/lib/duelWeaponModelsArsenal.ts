import * as THREE from "three";
import type { CasingKind } from "./duelEffects";
import type { ReloadStyle, WeaponId, WeaponLook } from "./duelWeapons";
import {
  block,
  buildGloveHand,
  createForge,
  createGunKit,
  front,
  lathe,
  leftGestureRotations,
  optic,
  rod,
  side,
  sphere,
  tube,
  type Disposer,
  type Forge,
  type GunKit,
  type HandShape,
  type Pt,
} from "./duelWeaponModels";

/**
 * L'arsenal du Duel, modele par modele.
 *
 * Chaque arme est dessinee de profil comme sur une planche d'armurier :
 * carcasse, culasse, crosse et chargeur sont des contours extrudes et
 * biseautes (voir duelWeaponModels), les canons et les optiques sont tournes.
 * Les noms et les formes sont les notres : des armes generiques, dans le
 * style des armes reelles, sans copier aucun modele existant.
 *
 * Le repere est celui de la scene : x a droite, y en haut, la bouche vers -z.
 * Les dimensions gardent l'echelle des anciens modeles (environ 1,7 fois le
 * reel) : l'arme occupe la meme place a l'ecran, les mains aussi.
 */

type Parent = THREE.Object3D;

/** Ce qu'une arme construite rend a buildWeaponModel. */
export interface GunRig {
  rightHand: THREE.Group;
  leftHand: THREE.Group;
  /** Culasse ou levier d'armement : recule a chaque coup. */
  slide: THREE.Object3D | null;
  pump: THREE.Object3D | null;
  /** Verrou : pivote autour de z, recule ; pommeau en (0.062, 0, 0.06). */
  bolt: THREE.Object3D | null;
  mag: THREE.Object3D | null;
  /** Barillet : son axe est l'axe z de ce groupe. */
  drum: THREE.Object3D | null;
  /** Canons basculants : pivot sur l'axe x de ce groupe. */
  barrels: THREE.Object3D | null;
  muzzleZ: number;
  muzzleY: number;
  /** Hauteur de la ligne de mire (haut du guidon, point rouge, axe de lunette). */
  sightY: number;
  reloadStyle: ReloadStyle;
  casing: CasingKind;
  ejectParent: THREE.Object3D;
  ejectAt: THREE.Vector3;
  dipPort: THREE.Vector3;
  carry: THREE.Object3D | null;
  rackHand: boolean;
  /** Ou se pose l'origine de la main gauche, par rapport au centre du chargeur. */
  magGrip: THREE.Vector3;
  /** Rotation de la main gauche qui saisit le chargeur. */
  grabRot: THREE.Vector3;
  /** Rotation de la main gauche sur le levier d'armement (cote -1 ou +1). */
  handleRot(side: number): THREE.Vector3;
  /** Ou la main gauche saisit le levier d'armement (sinon : a cote de la culasse). */
  handleAt?: THREE.Vector3;
}

/** Atelier : matieres, outil de pose, et le corps de l'arme. */
interface Shop {
  kit: GunKit;
  f: Forge;
  keep: Disposer;
  body: THREE.Group;
}

// ---------------------------------------------------------------------------
// Petites pieces communes
// ---------------------------------------------------------------------------

/** Pose une piece : raccourci de Forge.part. */
function put(
  s: Shop,
  parent: Parent,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.Mesh {
  return s.f.part(parent, geo, mat, x, y, z, rx, ry, rz);
}

/**
 * Rail a encoches vu de cote : un peigne extrude sur la largeur, pose sur
 * une semelle. `y` est le dessous du rail.
 */
function rail(s: Shop, parent: Parent, z0: number, z1: number, y: number, width = 0.03, mat?: THREE.Material) {
  const pitch = 0.019;
  const tooth = 0.0105;
  const h = 0.011;
  const base = 0.0045;
  const n = Math.max(1, Math.floor((z1 - z0) / pitch));
  const m = (z1 - z0 - n * pitch) / 2 + (pitch - tooth) / 2;
  const top: Pt[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const a = z0 + m + i * pitch;
    top.push([a + tooth, base], [a + tooth, h], [a, h], [a, base]);
  }
  const pts: Pt[] = [[z0, 0], [z1, 0], [z1, base + 0.001], ...top, [z0, base + 0.001]];
  put(s, parent, side(pts, width, { bevel: 0.0012, seg: 1 }), mat ?? s.kit.dark, 0, y, 0);
}

/** Vis a tete ronde, vue sur le flanc (x = +-) : un petit disque d'acier. */
function screw(s: Shop, parent: Parent, x: number, y: number, z: number, r = 0.0045, mat?: THREE.Material) {
  const g = rod(r, -0.002, 0.002, 10, 0.0012);
  put(s, parent, g, mat ?? s.kit.steel, x, y, z, 0, Math.PI / 2, 0);
}

/** Hausse a cran : une plaque vue de face, echancree en U. */
function rearNotch(
  s: Shop,
  parent: Parent,
  z: number,
  y: number,
  w: number,
  h: number,
  notchW: number,
  notchH: number,
  depth: number,
  mat?: THREE.Material,
) {
  const pts: Pt[] = [
    [-w / 2, 0],
    [w / 2, 0],
    [w / 2, h, 0.002],
    [notchW / 2, h],
    [notchW / 2, h - notchH, 0.0015],
    [-notchW / 2, h - notchH, 0.0015],
    [-notchW / 2, h],
    [-w / 2, h, 0.002],
  ];
  return optic(put(s, parent, front(pts, depth, { bevel: 0.0012, seg: 1 }), mat ?? s.kit.dark, 0, y, z));
}

/** Point blanc (ou lumineux) sur la face arriere d'un organe de visee. */
function sightDot(s: Shop, parent: Parent, x: number, y: number, z: number, r = 0.0026, mat?: THREE.Material) {
  return optic(put(s, parent, rod(r, -0.001, 0.001, 10), mat ?? s.kit.white, x, y, z));
}

/**
 * Queue de detente en arc, pivot en (0, 0) : la lame descend et se creuse
 * vers l'avant, la ou l'index appuie.
 */
function triggerBlade(s: Shop, parent: Parent, y: number, z: number, len = 0.042, mat?: THREE.Material) {
  const pts: Pt[] = [
    [-0.004, 0.004],
    [0.005, 0.004],
    [0.004, -len * 0.45, 0.012],
    [-0.004, -len, 0.004],
    [-0.011, -len + 0.002, 0.003],
    [-0.006, -len * 0.5, 0.012],
  ];
  put(s, parent, side(pts, 0.011, { bevel: 0.002, seg: 1 }), mat ?? s.kit.dark, 0, y, z);
}

/**
 * Pontet vu de cote : une boucle percee. Le trou va du dessous de la
 * carcasse (yTop) au fond (yBot), du devant (zFront) jusqu'a la poignee
 * (zBack). Le haut et l'arriere de la boucle rentrent dans la carcasse et la
 * poignee. Chaque barreau doit rester plus epais que deux biseaux, sinon la
 * face se retourne.
 */
function triggerGuard(
  s: Shop,
  parent: Parent,
  zFront: number,
  zBack: number,
  yTop: number,
  yBot: number,
  width = 0.024,
  bar = 0.008,
  mat?: THREE.Material,
) {
  const outer: Pt[] = [
    [zFront - bar, yTop + 0.012],
    [zFront - bar, yBot + 0.006, 0.02],
    [zFront + 0.022, yBot - bar, 0.014],
    [zBack + 0.012, yBot - bar, 0.004],
    [zBack + 0.012, yTop + 0.012],
  ];
  const hole: Pt[] = [
    [zFront, yTop],
    [zFront, yBot + 0.01, 0.014],
    [zFront + 0.022, yBot, 0.01],
    [zBack, yBot],
    [zBack, yTop],
  ];
  const b = Math.min(0.003, bar * 0.35);
  put(s, parent, side(outer, width, { bevel: b, seg: 2, holes: [hole] }), mat ?? s.kit.polymer, 0, 0, 0);
}

/**
 * Origine de la main droite : la ou il faut la poser pour que la palmure
 * (entre le pouce et l'index) tombe sous la carcasse au point (webY, webZ),
 * la poignee inclinee de `tilt`.
 */
function gripOrigin(webY: number, webZ: number, tilt: number) {
  const ly = 0.066;
  const lz = 0.034;
  const c = Math.cos(tilt);
  const sn = Math.sin(tilt);
  return new THREE.Vector3(0, webY - (ly * c - lz * sn), webZ - (ly * sn + lz * c));
}

/**
 * Poignee pistolet d'arme d'epaule, dessinee dans le repere de la main :
 * axe vertical, dos vers +z. Busc de doigts devant, renflement de paume.
 */
function rifleGrip(s: Shop, parent: Parent, mat: THREE.Material, width = 0.054) {
  const pts: Pt[] = [
    [-0.036, 0.1],
    [-0.04, 0.052, 0.01],
    [-0.046, 0.036, 0.008],
    [-0.04, 0.022, 0.008],
    [-0.046, 0.006, 0.008],
    [-0.04, -0.012, 0.008],
    [-0.045, -0.03, 0.008],
    [-0.044, -0.07, 0.012],
    [-0.036, -0.08, 0.008],
    [0.04, -0.084, 0.01],
    [0.05, -0.068, 0.012],
    [0.05, -0.03, 0.03],
    [0.043, 0.03, 0.02],
    [0.048, 0.07, 0.012],
    [0.05, 0.1],
  ];
  put(s, parent, side(pts, width, { bevel: 0.009, seg: 3 }), mat);
  // Capot de fond de poignee.
  put(s, parent, side([[-0.036, -0.074], [0.04, -0.078], [0.04, -0.09, 0.006], [-0.034, -0.086, 0.006]], width - 0.004, { bevel: 0.003 }), s.kit.dark);
}

/** Frein de bouche : bague tournee et fentes laterales. */
function muzzleBrake(s: Shop, parent: Parent, y: number, z0: number, len: number, r: number, mat?: THREE.Material) {
  const k = s.kit;
  put(
    s,
    parent,
    lathe(
      [
        [r * 0.55, z0],
        [r * 0.92, z0],
        [r, z0 + 0.004],
        [r, z0 + len - 0.004],
        [r * 0.9, z0 + len, 0.002],
        [r * 0.62, z0 + len],
      ],
      16,
    ),
    mat ?? k.blued,
    0,
    y,
    0,
  );
  // Bouche noire.
  put(s, parent, rod(r * 0.55, z0 - 0.0005, z0 + 0.01, 12), k.bore, 0, y, 0);
  // Fentes : des creux sombres sur les deux flancs.
  for (let i = 0; i < 3; i++) {
    const zz = z0 + len * (0.22 + i * 0.24);
    put(s, parent, block(r * 2.04, r * 0.8, len * 0.12, 0.001), k.bore, 0, y, zz);
  }
}

/** Mains : la droite sur la poignee, la gauche selon la prise. */
function hands(s: Shop, leftShape: HandShape, tilt: number) {
  const right = buildGloveHand(s.kit, s.keep, "poignee", false, tilt);
  const left = buildGloveHand(s.kit, s.keep, leftShape, true, tilt);
  return { right, left };
}

function rigBase(s: Shop, leftShape: HandShape, tilt: number): GunRig {
  const h = hands(s, leftShape, tilt);
  const g = leftGestureRotations(leftShape, 1, tilt);
  return {
    rightHand: h.right,
    leftHand: h.left,
    slide: null,
    pump: null,
    bolt: null,
    mag: null,
    drum: null,
    barrels: null,
    muzzleZ: -0.6,
    muzzleY: 0.014,
    sightY: 0.07,
    reloadStyle: "chargeur",
    casing: "laiton",
    ejectParent: s.body,
    ejectAt: new THREE.Vector3(0.045, 0.02, 0),
    dipPort: new THREE.Vector3(),
    carry: null,
    rackHand: false,
    magGrip: new THREE.Vector3(-0.01, -0.02, 0),
    grabRot: g.grab,
    handleRot: (sd: number) => leftGestureRotations(leftShape, sd, tilt).handle,
  };
}

// ---------------------------------------------------------------------------
// Pistolet : carcasse polymere, culasse acier noir, organes a trois points
// ---------------------------------------------------------------------------

function pistolet(s: Shop): GunRig {
  const { kit, body, f } = s;
  const tilt = -0.2;
  const rig = rigBase(s, "soutien", tilt);
  const H = gripOrigin(-0.022, 0.038, tilt);

  // --- Culasse mobile ---
  const slide = f.group(body);
  rig.slide = slide;
  put(
    s,
    slide,
    side(
      [
        [-0.236, 0.008, 0.003],
        [0.066, 0.008, 0.003],
        [0.07, 0.052, 0.004],
        [0.065, 0.062, 0.004],
        [-0.212, 0.062, 0.004],
        [-0.236, 0.044, 0.008],
      ],
      0.046,
      { bevel: 0.0055, seg: 2 },
    ),
    kit.blued,
  );
  // Stries de prise, a l'arriere et a l'avant.
  for (let i = 0; i < 8; i++) put(s, slide, block(0.0472, 0.034, 0.0026, 0.0005), kit.dark, 0, 0.034, 0.018 + i * 0.0058);
  for (let i = 0; i < 5; i++) put(s, slide, block(0.0472, 0.026, 0.0026, 0.0005), kit.dark, 0, 0.03, -0.2 + i * 0.0058);
  // Fenetre d'ejection a droite, et la chambre du canon qui y apparait.
  put(s, slide, block(0.0178, 0.031, 0.066, 0.001), kit.bore, 0.0148, 0.0472, -0.046);
  put(s, slide, block(0.026, 0.012, 0.062, 0.0015), kit.steel, 0, 0.0568, -0.046);
  put(s, slide, rod(0.0075, -0.074, -0.02, 10), kit.brass, 0.012, 0.042, 0);
  // Bout du canon, dans la culasse.
  put(s, slide, tube(0.0085, 0.0125, -0.2385, -0.225, 14, 0.0015), kit.steel, 0, 0.03, 0);
  put(s, slide, rod(0.0086, -0.2388, -0.23, 12), kit.bore, 0, 0.03, 0);
  // Organes de visee : hausse a cran, guidon, trois points.
  rearNotch(s, slide, 0.052, 0.0615, 0.034, 0.012, 0.0085, 0.006, 0.014);
  sightDot(s, slide, -0.011, 0.0675, 0.0443);
  sightDot(s, slide, 0.011, 0.0675, 0.0443);
  optic(put(s, slide, side([[-0.009, 0], [0.009, 0], [0.006, 0.011, 0.002], [-0.006, 0.011, 0.002]], 0.0075, { bevel: 0.001 }), kit.dark, 0, 0.0615, -0.212));
  sightDot(s, slide, 0, 0.068, -0.2055, 0.0024, kit.tritium);
  rig.ejectParent = slide;
  rig.ejectAt.set(0.03, 0.05, -0.046);
  rig.rackHand = true;

  // --- Carcasse ---
  put(
    s,
    body,
    side(
      [
        [-0.228, 0.014],
        [0.066, 0.014],
        [0.066, -0.01, 0.006],
        [0.044, -0.024],
        [-0.222, -0.024, 0.004],
        [-0.228, -0.014, 0.004],
      ],
      0.044,
      { bevel: 0.004, seg: 2 },
    ),
    kit.polymer,
  );
  // Rail sous le canon : trois encoches.
  for (let i = 0; i < 3; i++) put(s, body, block(0.046, 0.005, 0.007, 0.0008), kit.dark, 0, -0.0225, -0.205 + i * 0.022);
  // Levier d'arret de culasse et bouton de demontage, a gauche.
  put(s, body, side([[-0.07, 0.004], [0.008, 0.006], [0.012, 0.013, 0.003], [-0.03, 0.012], [-0.074, 0.01, 0.003]], 0.005, { bevel: 0.0012 }), kit.dark, -0.024, 0, 0);
  put(s, body, block(0.004, 0.008, 0.018, 0.001), kit.steel, -0.0225, 0.001, -0.108);
  // Axe et goupilles.
  screw(s, body, 0.0222, -0.006, -0.086, 0.0032);
  screw(s, body, -0.0222, -0.006, -0.086, 0.0032);
  screw(s, body, 0.0222, -0.004, 0.034, 0.003);

  // --- Pontet et detente ---
  triggerGuard(s, body, -0.126, -0.03, -0.022, -0.066, 0.026, 0.008);
  triggerBlade(s, body, -0.024, -0.07, 0.034);

  // --- Poignee (dans le repere de la main) ---
  const grip = f.group(body, H.x, H.y, H.z);
  grip.rotation.x = tilt;
  put(
    s,
    grip,
    side(
      [
        [-0.04, 0.086],
        [-0.042, 0.04, 0.012],
        [-0.047, 0.026, 0.008],
        [-0.042, 0.01, 0.008],
        [-0.047, -0.008, 0.008],
        [-0.042, -0.026, 0.008],
        [-0.046, -0.046, 0.008],
        [-0.045, -0.072, 0.01],
        [0.042, -0.074, 0.01],
        [0.046, -0.02, 0.03],
        [0.043, 0.04, 0.012],
        [0.05, 0.068, 0.008],
        [0.066, 0.08, 0.006],
        [0.062, 0.088, 0.004],
        [0.036, 0.1],
        [-0.04, 0.1],
      ],
      0.058,
      { bevel: 0.01, seg: 3 },
    ),
    kit.polymer,
  );
  // Plaquettes granitees : un panneau sombre de chaque cote.
  put(
    s,
    grip,
    side([[-0.034, 0.024], [0.034, 0.024], [0.037, -0.058, 0.01], [-0.036, -0.058, 0.01]], 0.0602, { bevel: 0.002, seg: 1 }),
    kit.dark,
  );
  // Bouton d'arretoir de chargeur, a gauche.
  put(s, grip, block(0.006, 0.012, 0.012, 0.002), kit.dark, -0.029, 0.07, -0.036);

  // --- Chargeur : il tombe au rechargement ---
  const mag = f.group(body);
  rig.mag = mag;
  const magFrame = f.group(mag, H.x, H.y, H.z);
  magFrame.rotation.x = tilt;
  put(s, magFrame, block(0.034, 0.16, 0.06, 0.004), kit.metal, 0, 0.008, 0.002);
  put(s, magFrame, side([[-0.046, -0.072], [0.044, -0.074], [0.042, -0.088, 0.006], [-0.044, -0.086, 0.006]], 0.058, { bevel: 0.003, seg: 1 }), kit.dark);
  put(s, magFrame, rod(0.0045, -0.012, 0.004, 8), kit.brass, 0, 0.09, 0.0);

  rig.muzzleZ = -0.24;
  rig.muzzleY = 0.03;
  rig.sightY = 0.0725;
  // Deux mains : la gauche enveloppe la droite, comme au stand.
  rig.rightHand.position.copy(H);
  rig.rightHand.rotation.set(tilt, 0, 0);
  body.add(rig.rightHand);
  rig.leftHand.position.copy(H);
  rig.leftHand.rotation.set(tilt, 0, 0);
  body.add(rig.leftHand);
  // Au rechargement, la main gauche garde sa prise et descend avec le chargeur.
  rig.magGrip.set(0, 0.004, 0);
  rig.handleAt = new THREE.Vector3(-0.012, -0.03, 0.09);
  return rig;
}

// ---------------------------------------------------------------------------
// Distribution
// ---------------------------------------------------------------------------

const BUILDERS: Partial<Record<WeaponId, (s: Shop) => GunRig>> = {
  pistolet,
};

/** Vrai si l'arme a son modele realiste dans cet arsenal. */
export function hasGunModel(id: WeaponId): boolean {
  return BUILDERS[id] !== undefined;
}

/**
 * Construit l'arme `id` dans `body` (le sous-groupe anime de WeaponModel) et
 * rend ses pieces mobiles et ses reperes.
 */
export function buildGunRig(id: WeaponId, body: THREE.Group, look: WeaponLook, keep: Disposer): GunRig {
  const builder = BUILDERS[id];
  if (!builder) throw new Error(`Arme sans modele : ${id}`);
  const kit = createGunKit(look, keep);
  const s: Shop = { kit, f: createForge(keep), keep, body };
  return builder(s);
}

// Pieces encore inutilisees par certaines armes, gardees pour les suivantes.
void sphere;
