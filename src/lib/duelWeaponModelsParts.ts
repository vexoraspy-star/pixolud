import * as THREE from "three";
import type { CasingKind } from "./duelEffects";
import type { ReloadStyle, WeaponLook } from "./duelWeapons";
import {
  block,
  buildGloveHand,
  createForge,
  createGunKit,
  front,
  indexTipLocal,
  lathe,
  leftGestureRotations,
  optic,
  rod,
  side,
  tube,
  type Disposer,
  type Forge,
  type GunKit,
  type HandShape,
  type Pt,
} from "./duelWeaponModels";

/**
 * Pieces communes de l'arsenal du Duel : organes de visee, detentes,
 * poignees, rails, chargeurs, lunettes... et l'atelier (Shop) que chaque
 * arme recoit. Les armes elles-memes sont dans duelWeaponModelsArsenal et
 * duelWeaponModelsArsenal2.
 *
 * Le repere est celui de la scene : x a droite, y en haut, la bouche vers -z.
 */
export type Parent = THREE.Object3D;

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
export interface Shop {
  kit: GunKit;
  f: Forge;
  keep: Disposer;
  body: THREE.Group;
}

// ---------------------------------------------------------------------------
// Petites pieces communes
// ---------------------------------------------------------------------------

/** Pose une piece : raccourci de Forge.part. */
export function put(
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
export function rail(s: Shop, parent: Parent, z0: number, z1: number, y: number, width = 0.03, mat?: THREE.Material) {
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
export function screw(s: Shop, parent: Parent, x: number, y: number, z: number, r = 0.0045, mat?: THREE.Material) {
  const g = rod(r, -0.002, 0.002, 10, 0.0012);
  put(s, parent, g, mat ?? s.kit.steel, x, y, z, 0, Math.PI / 2, 0);
}

/** Hausse a cran : une plaque vue de face, echancree en U. */
export function rearNotch(
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
export function sightDot(s: Shop, parent: Parent, x: number, y: number, z: number, r = 0.0026, mat?: THREE.Material) {
  return optic(put(s, parent, rod(r, -0.001, 0.001, 10), mat ?? s.kit.white, x, y, z));
}

/**
 * Queue de detente en arc, pivot en (0, 0) : la lame descend et se creuse
 * vers l'avant, la ou l'index appuie.
 */
export function triggerBlade(s: Shop, parent: Parent, y: number, z: number, len = 0.042, mat?: THREE.Material) {
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
export function triggerGuard(
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
export function gripOrigin(webY: number, webZ: number, tilt: number) {
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
export function rifleGrip(s: Shop, parent: Parent, mat: THREE.Material, width = 0.054) {
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
export function muzzleBrake(s: Shop, parent: Parent, y: number, z0: number, len: number, r: number, mat?: THREE.Material) {
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
export function hands(s: Shop, leftShape: HandShape, tilt: number, leftTilt = tilt) {
  const right = buildGloveHand(s.kit, s.keep, "poignee", false, tilt);
  const left = buildGloveHand(s.kit, s.keep, leftShape, true, leftTilt);
  return { right, left };
}

/**
 * Pieces et reperes par defaut d'une arme. `leftTilt` : inclinaison de la
 * poignee avant quand la main gauche en tient une (forme « poignee »).
 */
export function rigBase(s: Shop, leftShape: HandShape, tilt: number, leftTilt = tilt): GunRig {
  const h = hands(s, leftShape, tilt, leftTilt);
  const g = leftGestureRotations(leftShape, 1, leftTilt);
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
    handleRot: (sd: number) => leftGestureRotations(leftShape, sd, leftTilt).handle,
  };
}

/** Point du repere de la main (poignee inclinee de `tilt`, origine H) dans celui de l'arme. */
export function fromHand(H: THREE.Vector3, tilt: number, x: number, y: number, z: number) {
  const c = Math.cos(tilt);
  const sn = Math.sin(tilt);
  return new THREE.Vector3(H.x + x, H.y + y * c - z * sn, H.z + y * sn + z * c);
}

/** Devant de la poignee (z) a la hauteur y de l'arme : la ou le pontet la rejoint. */
export function gripFrontZ(H: THREE.Vector3, tilt: number, y: number, front = -0.042) {
  const c = Math.cos(tilt);
  const sn = Math.sin(tilt);
  const ly = (y - H.y + front * sn) / c;
  return H.z + ly * sn + front * c;
}

/**
 * Detente et pontet places sous l'index de la main droite : la lame juste
 * derriere le bout du doigt, le pontet autour, de la carcasse (yTop) jusqu'au
 * devant de la poignee.
 */
export function triggerUnder(
  s: Shop,
  parent: Parent,
  H: THREE.Vector3,
  tilt: number,
  yTop: number,
  o: { width?: number; bar?: number; mat?: THREE.Material; bladeMat?: THREE.Material } = {},
) {
  const l = indexTipLocal(tilt);
  const tip = fromHand(H, tilt, l.x, l.y, l.z);
  const zBlade = tip.z + 0.017;
  triggerBlade(s, parent, yTop - 0.002, zBlade, Math.max(0.026, yTop - tip.y + 0.012), o.bladeMat);
  const yBot = Math.min(tip.y - 0.02, yTop - 0.04);
  const zBack = Math.max(zBlade + 0.02, gripFrontZ(H, tilt, yBot) + 0.006);
  triggerGuard(s, parent, tip.z - 0.026, zBack, yTop, yBot, o.width ?? 0.024, o.bar ?? 0.008, o.mat);
  return tip;
}

/**
 * Chargeur courbe vu de cote : deux arcs concentriques (le centre est devant
 * l'arme). Haut du dos en (zBack, yTop), profondeur `depth`, courbure `radius`,
 * ouverture `sweep` (radians). Nervures en relief et semelle.
 */
export function curvedMag(
  s: Shop,
  parent: Parent,
  mat: THREE.Material,
  zBack: number,
  yTop: number,
  depth: number,
  radius: number,
  sweep: number,
  width: number,
) {
  const cz = zBack - radius;
  const cy = yTop;
  const rb = radius;
  const rf = radius - depth;
  const shape = new THREE.Shape();
  shape.moveTo(cz + rb, cy);
  shape.absarc(cz, cy, rb, 0, -sweep, true);
  shape.lineTo(cz + rf * Math.cos(sweep), cy - rf * Math.sin(sweep));
  shape.absarc(cz, cy, rf, -sweep, 0, false);
  shape.closePath();
  put(s, parent, side(shape, width, { bevel: 0.004, seg: 2, curve: 10 }), mat);
  // Nervures de renfort : une bande en relief qui suit la courbe.
  const band = new THREE.Shape();
  const a0 = -0.05;
  const a1 = -sweep + 0.05;
  const r0 = rf + 0.013;
  const r1 = rb - 0.013;
  band.moveTo(cz + r1 * Math.cos(a0), cy + r1 * Math.sin(a0));
  band.absarc(cz, cy, r1, a0, a1, true);
  band.lineTo(cz + r0 * Math.cos(a1), cy + r0 * Math.sin(a1));
  band.absarc(cz, cy, r0, a1, a0, false);
  band.closePath();
  put(s, parent, side(band, width + 0.005, { bevel: 0.0018, seg: 1, curve: 10 }), mat);
  // Semelle, perpendiculaire a l'axe du chargeur.
  const n = new THREE.Vector2(Math.cos(sweep), -Math.sin(sweep));
  const t = new THREE.Vector2(-Math.sin(sweep), -Math.cos(sweep));
  const bb = new THREE.Vector2(cz, cy).addScaledVector(n, rb + 0.004).addScaledVector(t, -0.004);
  const fb = new THREE.Vector2(cz, cy).addScaledVector(n, rf - 0.004).addScaledVector(t, -0.004);
  const plate: Pt[] = [
    [bb.x, bb.y],
    [fb.x, fb.y],
    [fb.x + t.x * 0.016, fb.y + t.y * 0.016, 0.004],
    [bb.x + t.x * 0.016, bb.y + t.y * 0.016, 0.004],
  ];
  put(s, parent, side(plate, width + 0.006, { bevel: 0.003, seg: 1 }), s.kit.dark);
  // Cartouche du dessus, visible quand le chargeur est sorti.
  put(s, parent, rod(0.0068, zBack - depth + 0.012, zBack - 0.012, 10), s.kit.brass, 0, yTop - 0.004, 0);
}

/**
 * Viseur point rouge a tube, sur embase haute. `y` : axe optique, `z0`/`z1` :
 * les deux bouts, `railY` : le dessus du rail. Le point est nomme « dot ».
 */
export function redDotTube(s: Shop, parent: Parent, y: number, z0: number, z1: number, railY: number) {
  const k = s.kit;
  const zc = (z0 + z1) / 2;
  const r = 0.024;
  // Embase : semelle sur le rail, colonne jusqu'au tube.
  put(s, parent, block(0.04, 0.012, z1 - z0 - 0.012, 0.002), k.dark, 0, railY + 0.006, zc);
  put(
    s,
    parent,
    side([[z0 + 0.012, railY + 0.01], [z1 - 0.012, railY + 0.01], [z1 - 0.018, y - r + 0.006, 0.006], [z0 + 0.018, y - r + 0.006, 0.006]], 0.022, { bevel: 0.003 }),
    k.dark,
  );
  put(s, parent, block(0.008, 0.008, 0.014, 0.002), k.steel, 0.024, railY + 0.006, zc);
  // Tube creux, pare-soleil a l'avant, bagues.
  optic(put(s, parent, tube(r - 0.004, r, z0, z1, 24, 0.002), k.dark, 0, y, 0));
  optic(put(s, parent, tube(r - 0.003, r + 0.003, z0 - 0.002, z0 + 0.008, 24, 0.0015), k.dark, 0, y, 0));
  optic(put(s, parent, tube(r - 0.003, r + 0.003, z1 - 0.008, z1 + 0.002, 24, 0.0015), k.dark, 0, y, 0));
  // Tourelles de reglage.
  optic(put(s, parent, lathe([[0.0001, 0], [0.009, 0], [0.009, 0.012, 0.002], [0.0001, 0.012]], 14), k.dark, 0, y + r - 0.002, zc, -Math.PI / 2, 0, 0));
  optic(put(s, parent, lathe([[0.0001, 0], [0.009, 0], [0.009, 0.012, 0.002], [0.0001, 0.012]], 14), k.dark, r - 0.002, y, zc, 0, Math.PI / 2, 0));
  // Verre teinte et point lumineux.
  optic(put(s, parent, rod(r - 0.004, z0 + 0.004, z0 + 0.0045, 24), k.glassTint, 0, y, 0));
  const dot = optic(put(s, parent, rod(0.0042, -0.0004, 0.0004, 12), k.accent, 0, y, z0 + 0.012));
  dot.name = "dot";
}

/**
 * Garde-main octogonal vu de face (demi-largeur hw, demi-hauteur hh, centre
 * a (0, y)), creux, de z0 a z1, avec des lumieres de fixation sur les flancs
 * et dessous.
 */
export function octoHandguard(s: Shop, parent: Parent, mat: THREE.Material, y: number, z0: number, z1: number, hw = 0.035, hh = 0.037) {
  const c = 0.012;
  const pts: Pt[] = [
    [-hw + c, -hh],
    [hw - c, -hh],
    [hw, -hh + c],
    [hw, hh - c],
    [hw - c, hh],
    [-hw + c, hh],
    [-hw, hh - c],
    [-hw, -hh + c],
  ];
  const ri = Math.min(hw, hh) - 0.011;
  const hole: Pt[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    hole.push([Math.cos(a) * ri, Math.sin(a) * ri - 0.004]);
  }
  put(s, parent, front(pts, z1 - z0, { bevel: 0.003, seg: 2, holes: [hole] }), mat, 0, y, (z0 + z1) / 2);
  // Lumieres : des creux sombres, trois par flanc et deux dessous.
  const len = z1 - z0;
  for (let i = 0; i < 3; i++) {
    const zz = z0 + len * (0.2 + i * 0.28);
    put(s, parent, block(hw * 2 + 0.0012, 0.011, len * 0.16, 0.003), s.kit.bore, 0, y, zz);
  }
  for (let i = 0; i < 2; i++) {
    const zz = z0 + len * (0.3 + i * 0.36);
    put(s, parent, block(0.011, hh * 2 + 0.0012, len * 0.16, 0.003), s.kit.bore, 0, y, zz);
  }
}

/**
 * Lunette de tir : tube, objectif evase, oculaire, tourelles et bagues sur le
 * rail. Axe a (0, y), de zFront (objectif) a zBack (oculaire).
 */
export function scope(s: Shop, parent: Parent, y: number, zFront: number, zBack: number, railY: number, r = 0.022) {
  const k = s.kit;
  const len = zBack - zFront;
  const bell = r * 1.55;
  const eye = r * 1.3;
  put(
    s,
    parent,
    lathe(
      [
        [bell - 0.006, zFront],
        [bell, zFront],
        [bell, zFront + len * 0.16, 0.004],
        [r, zFront + len * 0.3, 0.02],
        [r, zBack - len * 0.36],
        [r + 0.002, zBack - len * 0.34, 0.002],
        [r + 0.002, zBack - len * 0.28],
        [eye, zBack - len * 0.18, 0.012],
        [eye, zBack, 0.003],
        [eye - 0.005, zBack],
      ],
      24,
    ),
    k.blued,
    0,
    y,
    0,
  );
  // Verres : l'objectif et l'oculaire, traites (reflets bleus et verts).
  put(s, parent, rod(bell - 0.006, zFront + 0.002, zFront + 0.003, 24), k.glass, 0, y, 0).name = "lens";
  put(s, parent, rod(eye - 0.005, zBack - 0.004, zBack - 0.003, 24), k.glass, 0, y, 0).name = "lens";
  // Bague de grossissement striee.
  for (let i = 0; i < 6; i++) {
    put(s, parent, tube(eye - 0.001, eye + 0.0015, zBack - len * 0.17 + i * 0.006, zBack - len * 0.17 + i * 0.006 + 0.003, 24), k.dark, 0, y, 0);
  }
  // Tourelles : hausse dessus, derive a droite, parallaxe a gauche.
  const zt = zFront + len * 0.52;
  const turret = (h: number, rr: number) =>
    lathe([[0.0001, 0], [rr, 0], [rr, h * 0.45], [rr * 1.12, h * 0.5, 0.001], [rr * 1.12, h, 0.003], [0.0001, h]], 18);
  put(s, parent, turret(0.024, 0.014), k.dark, 0, y + r - 0.003, zt, -Math.PI / 2, 0, 0);
  put(s, parent, turret(0.02, 0.012), k.dark, r - 0.003, y, zt, 0, Math.PI / 2, 0);
  put(s, parent, turret(0.016, 0.012), k.dark, -r + 0.003, y, zt, 0, -Math.PI / 2, 0);
  put(s, parent, block(r * 2.2, r * 2.2, 0.03, 0.006), k.blued, 0, y, zt);
  // Bagues et leurs embases sur le rail.
  for (const zz of [zFront + len * 0.34, zBack - len * 0.42]) {
    put(s, parent, tube(r, r + 0.006, zz - 0.009, zz + 0.009, 24, 0.002), k.dark, 0, y, 0);
    put(s, parent, side([[zz - 0.012, railY], [zz + 0.012, railY], [zz + 0.009, y - r + 0.004, 0.004], [zz - 0.009, y - r + 0.004, 0.004]], 0.03, { bevel: 0.003 }), k.dark);
    screw(s, parent, 0.016, railY + 0.012, zz, 0.004);
  }
}

/** Cartouche de fusil : culot en laiton, corps rouge, le long de z (culot vers +z). */
export function shotShell(s: Shop, parent: Parent, x: number, y: number, z: number, len = 0.058, r = 0.0115, ry = 0, rx = 0) {
  const g = s.f.group(parent, x, y, z);
  g.rotation.set(rx, ry, 0);
  put(s, g, lathe([[0.0001, len / 2], [r * 1.12, len / 2], [r * 1.12, len / 2 - 0.003], [r, len / 2 - 0.004], [r, len / 2 - 0.014], [0.0001, len / 2 - 0.014]], 14), s.kit.brass);
  put(s, g, lathe([[0.0001, -len / 2], [r * 0.9, -len / 2, 0.002], [r, -len / 2 + 0.004], [r, len / 2 - 0.014], [0.0001, len / 2 - 0.014]], 14), s.kit.shellRed);
  return g;
}

/** Dioptre : un oeilleton creux entre deux oreilles, a la hauteur `y`. */
export function apertureSight(s: Shop, parent: Parent, y: number, z: number, baseY: number, mat?: THREE.Material) {
  const k = s.kit;
  const m = mat ?? k.dark;
  optic(put(s, parent, tube(0.0042, 0.011, z - 0.007, z + 0.007, 18, 0.0015), m, 0, y, 0));
  for (const sx of [-1, 1]) {
    optic(put(s, parent, side([[z - 0.012, baseY], [z + 0.012, baseY], [z + 0.01, y + 0.016, 0.004], [z - 0.01, y + 0.016, 0.004]], 0.005, { bevel: 0.0015 }), m, sx * 0.0165, 0, 0));
  }
  optic(put(s, parent, side([[z - 0.014, baseY - 0.004], [z + 0.014, baseY - 0.004], [z + 0.012, y - 0.008, 0.003], [z - 0.012, y - 0.008, 0.003]], 0.028, { bevel: 0.002 }), m));
}

/** Guidon sous capuchon : un anneau, et le fut du guidon dont le sommet est a `y`. */
export function hoodedPost(s: Shop, parent: Parent, y: number, z: number, baseY: number, r = 0.013, mat?: THREE.Material) {
  const k = s.kit;
  const m = mat ?? k.dark;
  optic(put(s, parent, tube(r, r + 0.0035, z - 0.006, z + 0.006, 20, 0.001), m, 0, y, 0));
  optic(put(s, parent, side([[z - 0.01, baseY], [z + 0.01, baseY], [z + 0.007, y - r + 0.002, 0.003], [z - 0.007, y - r + 0.002, 0.003]], 0.026, { bevel: 0.002 }), m));
  optic(put(s, parent, side([[z - 0.0025, y - r - 0.001], [z + 0.0025, y - r - 0.001], [z + 0.0015, y], [z - 0.0015, y]], 0.0032, { bevel: 0.0005 }), m));
}

/** Prepare l'atelier d'une arme : matieres (selon le camouflage et la tenue) et outil de pose. */
export function createShop(body: THREE.Group, look: WeaponLook, keep: Disposer): Shop {
  const kit = createGunKit(look, keep);
  return { kit, f: createForge(keep), keep, body };
}
