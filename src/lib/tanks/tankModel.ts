import * as THREE from "three";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { TankDef } from "./tankDefs";
import { makeCamoTexture, makeTrackTexture } from "./tankTextures";

// Les chars dessines en code : caisse a plaques inclinees, chenilles qui
// defilent, galets, tourelle (fonte arrondie, soudee anguleuse ou casemate
// de chasseur), canon avec frein de bouche. Quelques maillages par char :
// caisse camouflee, pieces sombres, deux chenilles, tourelle, canon.
//
// Repere du char : origine au sol sous le centre, x a droite, y en haut,
// z vers l'avant.

export interface TankModel {
  root: THREE.Group;
  /** Tourne autour de y (cap de la tourelle par rapport a la caisse). */
  turret: THREE.Group;
  /** Tourne autour de x (hausse du canon). */
  gun: THREE.Group;
  /** Bout du canon (enfant du canon). */
  muzzle: THREE.Object3D;
  /** Boite de la caisse, dans le repere du char. */
  hullCenter: THREE.Vector3;
  hullHalf: THREE.Vector3;
  /** Boite de la tourelle, dans le repere de la tourelle (ou du char pour une casemate). */
  turretCenter: THREE.Vector3;
  turretHalf: THREE.Vector3;
  /** Casemate : la « tourelle » ne tourne pas avec le canon. */
  fixedTurret: boolean;
  /** Fait defiler chaque chenille (metres parcourus par cote). */
  roll: (left: number, right: number) => void;
  /** Char detruit : acier noirci. */
  setWrecked: () => void;
  dispose: () => void;
}

// ------------------------------------------------------------- utilitaires

/** Coordonnees de texture projetees selon l'axe dominant de la normale. */
function boxUV(geo: THREE.BufferGeometry, scale: number): THREE.BufferGeometry {
  const pos = geo.getAttribute("position");
  const nor = geo.getAttribute("normal");
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    let u: number;
    let v: number;
    if (ax >= ay && ax >= az) {
      u = pos.getZ(i);
      v = pos.getY(i);
    } else if (ay >= az) {
      u = pos.getX(i);
      v = pos.getZ(i);
    } else {
      u = pos.getX(i);
      v = pos.getY(i);
    }
    uv[i * 2] = u * scale;
    uv[i * 2 + 1] = v * scale;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geo;
}

/**
 * Prepare une piece pour la fusion : non indexee, normales, coordonnees de
 * texture projetees, et une couleur de sommet (assombrie pres du sol : la
 * boue et l'ombre des chenilles).
 */
function part(geo: THREE.BufferGeometry, tint = 1, dirtBelow = -1): THREE.BufferGeometry {
  let g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  for (const name of Object.keys(g.attributes)) {
    if (name !== "position" && name !== "normal") g.deleteAttribute(name);
  }
  g = boxUV(g, 0.45);
  const pos = g.getAttribute("position");
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    let k = tint;
    if (dirtBelow > 0) k *= 0.62 + 0.38 * Math.min(1, Math.max(0, pos.getY(i) / dirtBelow));
    col[i * 3] = k;
    col[i * 3 + 1] = k * 0.98;
    col[i * 3 + 2] = k * 0.94;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx || ry || rz) g.rotateX(rx).rotateY(ry).rotateZ(rz);
  g.translate(x, y, z);
  return g;
}

/** Cylindre dont l'axe est x (roue, galet). */
function wheel(r: number, w: number, x: number, y: number, z: number, seg = 14): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, w, seg);
  g.rotateZ(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

/** Cylindre dont l'axe est z (canon, pot d'echappement), de z0 a z0 + l. */
function tubeZ(r0: number, r1: number, l: number, x: number, y: number, z0: number, seg = 14): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r1, r0, l, seg);
  g.rotateX(Math.PI / 2);
  g.translate(x, y, z0 + l / 2);
  return g;
}

function convex(points: [number, number, number][]): THREE.BufferGeometry {
  return new ConvexGeometry(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
}

/**
 * Ruban de chenille en boucle (profil en stade dans le plan y-z), coordonnee
 * u le long de la boucle : la texture defile avec la vitesse.
 */
function trackRibbon(x: number, width: number, zFront: number, zRear: number, r: number, y0: number): { geo: THREE.BufferGeometry; length: number } {
  const pts: { y: number; z: number; ny: number; nz: number }[] = [];
  const seg = 10;
  const cyF = y0 + r;
  // Brin inferieur, de l'arriere vers l'avant.
  const straight = zFront - zRear;
  const nStraight = Math.max(4, Math.round(straight / 0.25));
  for (let k = 0; k < nStraight; k++) pts.push({ z: zRear + (straight * k) / nStraight, y: y0, ny: -1, nz: 0 });
  // Galet tendeur avant (demi-cercle).
  for (let k = 0; k <= seg; k++) {
    const a = -Math.PI / 2 + (k / seg) * Math.PI;
    pts.push({ z: zFront + Math.cos(a) * r, y: cyF + Math.sin(a) * r, ny: Math.sin(a), nz: Math.cos(a) });
  }
  // Brin superieur, de l'avant vers l'arriere.
  for (let k = 1; k < nStraight; k++) pts.push({ z: zFront - (straight * k) / nStraight, y: y0 + 2 * r, ny: 1, nz: 0 });
  // Barbotin arriere.
  for (let k = 0; k <= seg; k++) {
    const a = Math.PI / 2 + (k / seg) * Math.PI;
    pts.push({ z: zRear + Math.cos(a) * r, y: cyF + Math.sin(a) * r, ny: Math.sin(a), nz: Math.cos(a) });
  }
  pts.push(pts[0]);
  const n = pts.length;
  const position = new Float32Array(n * 2 * 3);
  const normal = new Float32Array(n * 2 * 3);
  const uv = new Float32Array(n * 2 * 2);
  let acc = 0;
  for (let k = 0; k < n; k++) {
    if (k > 0) acc += Math.hypot(pts[k].z - pts[k - 1].z, pts[k].y - pts[k - 1].y);
    for (let s = 0; s < 2; s++) {
      const i = k * 2 + s;
      position[i * 3] = x + (s === 0 ? -width / 2 : width / 2);
      position[i * 3 + 1] = pts[k].y;
      position[i * 3 + 2] = pts[k].z;
      normal[i * 3] = 0;
      normal[i * 3 + 1] = pts[k].ny;
      normal[i * 3 + 2] = pts[k].nz;
      // Un patin tous les 16 cm.
      uv[i * 2] = s;
      uv[i * 2 + 1] = acc / 0.16;
    }
  }
  const index: number[] = [];
  for (let k = 0; k < n - 1; k++) {
    const a = k * 2;
    index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(index);
  return { geo, length: acc };
}

// --------------------------------------------------------------- textures

const camoCache = new Map<string, THREE.CanvasTexture>();
let trackTex: THREE.CanvasTexture | null = null;

function camoFor(def: TankDef): THREE.CanvasTexture {
  let t = camoCache.get(def.id);
  if (!t) {
    t = makeCamoTexture(def.look, def.id.length * 131 + def.tier * 17);
    camoCache.set(def.id, t);
  }
  return t;
}

// ----------------------------------------------------------------- modele

export function buildTankModel(def: TankDef): TankModel {
  const L = def.look;
  const W = L.width;
  const len = L.length;
  const H = L.hullHeight;
  const c = L.clearance;
  const tw = W * 0.22;
  const trackX = W / 2 - tw / 2;
  const r = Math.max(0.36, (c + H * 0.32) / 2);
  const deckY = c + H;
  const slope = (def.hull.frontSlope * Math.PI) / 180;
  const glacis = Math.min(len * 0.32, H * 0.55 * Math.tan(slope) + 0.2);

  const camoParts: THREE.BufferGeometry[] = [];
  const darkParts: THREE.BufferGeometry[] = [];

  // --- Caisse : une partie basse etroite entre les chenilles, une superstructure large ---
  const hl = W / 2 - tw + 0.04;
  camoParts.push(
    part(
      convex([
        [-hl, c, -len / 2 + 0.4],
        [hl, c, -len / 2 + 0.4],
        [-hl, c, len / 2 - 0.5],
        [hl, c, len / 2 - 0.5],
        [-hl, c + H * 0.5, -len / 2 + 0.15],
        [hl, c + H * 0.5, -len / 2 + 0.15],
        [-hl, c + H * 0.5, len / 2],
        [hl, c + H * 0.5, len / 2],
      ]),
      1,
      c + H * 0.6,
    ),
  );
  const hu = W / 2 - 0.02;
  const inset = Math.tan((def.hull.sideSlope * Math.PI) / 180) * H * 0.55;
  camoParts.push(
    part(
      convex([
        [-hu, c + H * 0.45, -len / 2],
        [hu, c + H * 0.45, -len / 2],
        [-hu, c + H * 0.45, len / 2],
        [hu, c + H * 0.45, len / 2],
        [-(hu - inset), deckY, len / 2 - glacis],
        [hu - inset, deckY, len / 2 - glacis],
        [-(hu - inset), deckY, -len / 2 + 0.35],
        [hu - inset, deckY, -len / 2 + 0.35],
        [-(hu - inset), c + H * 0.85, -len / 2 + 0.05],
        [hu - inset, c + H * 0.85, -len / 2 + 0.05],
      ]),
      1,
      c + H * 0.6,
    ),
  );

  // Casemate de chasseur : une superstructure haute et tres inclinee.
  const [tWid, tHei, tLen] = L.turret;
  const casemate = L.turretShape === "casemate";
  const tSlope = (def.turret.frontSlope * Math.PI) / 180;
  const cmFront = len / 2 - glacis + 0.1;
  const cmRear = cmFront - tLen;
  if (casemate) {
    const topInset = Math.tan(tSlope) * tHei;
    const sideIn = Math.tan((def.turret.sideSlope * Math.PI) / 180) * tHei;
    camoParts.push(
      part(
        convex([
          [-tWid / 2, deckY - 0.05, cmRear],
          [tWid / 2, deckY - 0.05, cmRear],
          [-tWid / 2, deckY - 0.05, cmFront],
          [tWid / 2, deckY - 0.05, cmFront],
          [-(tWid / 2 - sideIn), deckY + tHei, cmRear + 0.2],
          [tWid / 2 - sideIn, deckY + tHei, cmRear + 0.2],
          [-(tWid / 2 - sideIn), deckY + tHei, cmFront - topInset],
          [tWid / 2 - sideIn, deckY + tHei, cmFront - topInset],
        ]),
        1.03,
      ),
    );
    // Trappes et episcope sur le toit de la casemate.
    camoParts.push(part(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 14).translate(-tWid * 0.22, deckY + tHei + 0.06, cmRear + 0.9), 0.9));
    camoParts.push(part(box(0.25, 0.14, 0.18, tWid * 0.2, deckY + tHei + 0.07, cmFront - topInset - 0.3)));
  }

  // --- Chenilles, galets, garde-boue ---
  const zFront = len / 2 - r - 0.05;
  const zRear = -len / 2 + r + 0.05;
  const ribbons = [trackRibbon(-trackX, tw, zFront, zRear, r, 0.03), trackRibbon(trackX, tw, zFront, zRear, r, 0.03)];
  for (const side of [-1, 1]) {
    const x = side * trackX;
    // Barbotin et tendeur aux deux bouts.
    darkParts.push(part(wheel(r * 0.86, tw * 0.9, x, 0.03 + r, zFront), 0.75));
    darkParts.push(part(wheel(r * 0.86, tw * 0.9, x, 0.03 + r, zRear), 0.75));
    // Galets de roulement le long du brin inferieur.
    const n = L.wheels;
    const span = zFront - zRear - r * 1.6;
    for (let k = 0; k < n; k++) {
      const z = zRear + r * 0.8 + (n === 1 ? span / 2 : (span * k) / (n - 1));
      darkParts.push(part(wheel(L.wheelRadius, tw * 0.78, x, 0.05 + L.wheelRadius, z), 0.6));
      // Moyeu clair.
      darkParts.push(part(wheel(L.wheelRadius * 0.35, tw * 0.82, x, 0.05 + L.wheelRadius, z, 8), 1.1));
    }
    // Rouleaux porteurs sous le brin superieur.
    for (let k = 0; k < 3; k++) {
      darkParts.push(part(wheel(0.1, tw * 0.5, x, 0.03 + 2 * r - 0.12, zRear + ((k + 1) * (zFront - zRear)) / 4, 8), 0.7));
    }
    // Garde-boue.
    camoParts.push(part(box(tw + 0.06, 0.04, len - 0.1, x, 0.03 + 2 * r + 0.06, 0), 0.95));
    // Jupes laterales.
    if (L.skirts) {
      for (let k = 0; k < 5; k++) {
        const plate = len / 5 - 0.06;
        camoParts.push(part(box(0.03, r * 1.1, plate, side * (W / 2 + 0.03), 0.03 + r * 1.45, -len / 2 + plate / 2 + k * (plate + 0.06) + 0.08, 0, 0, side * 0.05), 1, 0.03 + 2 * r));
      }
    }
    // Outil et bidon sur le garde-boue.
    camoParts.push(part(box(0.1, 0.1, 1.4, x + side * tw * 0.2, 0.03 + 2 * r + 0.13, -len * 0.15), 0.8));
    darkParts.push(part(box(0.2, 0.34, 0.46, x, 0.03 + 2 * r + 0.25, -len / 2 + 0.55), 0.95));
  }

  // --- Details de la caisse ---
  // Phares et maillons de rechange sur le glacis.
  for (const side of [-1, 1]) {
    darkParts.push(part(tubeZ(0.09, 0.1, 0.16, side * (W / 2 - tw * 0.8), deckY - 0.08, len / 2 - glacis * 0.5), 1.4));
    // Crochets de remorquage.
    darkParts.push(part(box(0.12, 0.14, 0.2, side * 0.6, c + 0.1, len / 2 - 0.35), 0.7));
    darkParts.push(part(box(0.12, 0.14, 0.2, side * 0.6, c + 0.1, -len / 2 + 0.3), 0.7));
    // Pots d'echappement a l'arriere.
    darkParts.push(part(tubeZ(0.1, 0.1, 0.35, side * 0.55, c + H * 0.7, -len / 2 - 0.25, 10), 0.45));
  }
  // Le glacis monte de l'avant (hauteur c + 0,45 H) jusqu'au pont : les
  // maillons sont poses a plat dessus, a un peu plus d'un tiers du haut.
  const glacisRise = deckY - (c + H * 0.45);
  const glacisTilt = Math.atan2(glacisRise, glacis);
  for (let k = 0; k < 3; k++) {
    darkParts.push(
      part(box(0.42, 0.06, 0.2, (k - 1) * 0.46, deckY - glacisRise * 0.38 + 0.04, len / 2 - glacis * 0.62, glacisTilt, 0, 0), 0.6),
    );
  }
  // Grilles moteur sur le pont arriere.
  darkParts.push(part(box(W * 0.5, 0.03, len * 0.22, 0, deckY + 0.015, -len * 0.3), 0.55));
  // Trappe du pilote.
  camoParts.push(part(box(0.5, 0.08, 0.5, -W * 0.22, deckY + 0.03, len / 2 - glacis - 0.3), 0.92));

  // --- Tourelle ---
  const turret = new THREE.Group();
  const turretY = deckY - 0.02;
  const turretZ = L.turretOffset;
  const turretParts: THREE.BufferGeometry[] = [];
  const turretDark: THREE.BufferGeometry[] = [];
  let gunY: number;
  let gunZ: number;
  if (casemate) {
    // Le « canon » sort de la face avant de la casemate, dans un masque en boule.
    turret.position.set(0, 0, 0);
    gunY = deckY + tHei * 0.42;
    gunZ = cmFront - Math.tan(tSlope) * tHei * 0.42 + 0.05;
    turretParts.push(part(new THREE.SphereGeometry(0.34, 14, 10).translate(0, gunY, gunZ - 0.05), 1));
  } else if (L.turretShape === "anguleuse") {
    turret.position.set(0, turretY, turretZ);
    const fIn = Math.tan(tSlope) * tHei;
    const sIn = Math.tan((def.turret.sideSlope * Math.PI) / 180) * tHei;
    turretParts.push(
      part(
        convex([
          [-tWid / 2, 0, -tLen / 2],
          [tWid / 2, 0, -tLen / 2],
          [-tWid / 2, 0, tLen * 0.22],
          [tWid / 2, 0, tLen * 0.22],
          [-tWid * 0.34, 0, tLen / 2],
          [tWid * 0.34, 0, tLen / 2],
          [-(tWid / 2 - sIn), tHei, -tLen * 0.45],
          [tWid / 2 - sIn, tHei, -tLen * 0.45],
          [-(tWid / 2 - sIn), tHei, tLen * 0.15],
          [tWid / 2 - sIn, tHei, tLen * 0.15],
          [-(tWid * 0.34 - sIn * 0.5), tHei, tLen / 2 - fIn],
          [tWid * 0.34 - sIn * 0.5, tHei, tLen / 2 - fIn],
        ]),
        1.04,
      ),
    );
    gunY = tHei * 0.42;
    gunZ = tLen / 2 - fIn * 0.42;
    // Masque du canon, plaque soudee.
    turretParts.push(part(box(tWid * 0.42, tHei * 0.55, 0.22, 0, gunY, gunZ + 0.05), 1));
  } else {
    turret.position.set(0, turretY, turretZ);
    // Tourelle coulee : un fut elliptique et un dome.
    const base = new THREE.CylinderGeometry(1, 1.04, tHei * 0.42, 22);
    base.scale(tWid / 2, 1, tLen / 2);
    base.translate(0, tHei * 0.21, 0);
    turretParts.push(part(base, 1.03));
    const dome = new THREE.SphereGeometry(1, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.scale(tWid / 2 * 0.99, tHei * 0.6, (tLen / 2) * 0.99);
    dome.translate(0, tHei * 0.4, 0);
    turretParts.push(part(dome, 1.05));
    // Nuque a l'arriere.
    turretParts.push(part(box(tWid * 0.62, tHei * 0.42, tLen * 0.3, 0, tHei * 0.3, -tLen * 0.52), 0.98));
    gunY = tHei * 0.45;
    gunZ = tLen / 2 - 0.1;
    // Masque arrondi.
    const mantlet = new THREE.CylinderGeometry(tHei * 0.3, tHei * 0.3, tWid * 0.46, 16, 1, false, 0, Math.PI);
    // Demi-cylindre couche le long de x, bombe vers l'avant.
    mantlet.rotateZ(Math.PI / 2);
    mantlet.rotateX(Math.PI / 2);
    mantlet.translate(0, gunY, gunZ);
    turretParts.push(part(mantlet, 1));
  }
  if (!casemate) {
    // Tourelleau du chef, trappe, episcopes, antenne.
    turretParts.push(part(new THREE.CylinderGeometry(0.3, 0.33, 0.28, 14).translate(-tWid * 0.2, tHei + 0.12, -tLen * 0.15), 1));
    turretDark.push(part(new THREE.CylinderGeometry(0.27, 0.27, 0.05, 14).translate(-tWid * 0.2, tHei + 0.29, -tLen * 0.15), 0.8));
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      turretDark.push(part(box(0.07, 0.07, 0.05, -tWid * 0.2 + Math.cos(a) * 0.3, tHei + 0.2, -tLen * 0.15 + Math.sin(a) * 0.3), 0.4));
    }
    turretParts.push(part(box(0.46, 0.06, 0.5, tWid * 0.18, tHei + 0.02, -tLen * 0.08), 0.93));
    turretDark.push(part(new THREE.CylinderGeometry(0.012, 0.018, 2.3, 5).translate(tWid * 0.3, tHei + 1.15, -tLen * 0.4), 0.5));
  }

  // --- Canon : pivot de hausse devant le masque ---
  const gun = new THREE.Group();
  gun.position.set(0, gunY, gunZ);
  const gunParts: THREE.BufferGeometry[] = [];
  const gl = L.gunLength;
  const gr = L.gunRadius;
  gunParts.push(part(tubeZ(gr * 1.5, gr * 1.15, gl * 0.3, 0, 0, 0), 1));
  gunParts.push(part(tubeZ(gr * 1.15, gr, gl * 0.7, 0, 0, gl * 0.3), 1));
  // Evacuateur de fumees au milieu du tube pour les gros calibres.
  if (def.caliber >= 85) gunParts.push(part(tubeZ(gr * 1.6, gr * 1.6, gl * 0.12, 0, 0, gl * 0.55), 0.97));
  let tip = gl;
  if (L.muzzleBrake) {
    gunParts.push(part(tubeZ(gr * 1.7, gr * 1.8, 0.34, 0, 0, gl), 0.9));
    tip = gl + 0.34;
  }
  if (L.autocannon) {
    // Canon automatique : manchon de refroidissement perce, cache-flammes au bout.
    gunParts.push(part(tubeZ(gr * 2.1, gr * 2.1, gl * 0.42, 0, 0, gl * 0.08), 0.85));
    for (let k = 0; k < 6; k++) {
      gunParts.push(part(tubeZ(gr * 2.25, gr * 2.25, 0.05, 0, 0, gl * 0.12 + k * gl * 0.06), 0.55));
    }
    gunParts.push(part(tubeZ(gr * 1.5, gr * 1.9, 0.22, 0, 0, gl), 0.6));
    tip = gl + 0.22;
    // Le chargeur, pose sur la tourelle a cote de la culasse.
    turretDark.push(part(box(0.26, 0.34, 0.52, tWid * 0.16, tHei + 0.14, tLen * 0.18), 0.9));
    turretDark.push(part(box(0.3, 0.05, 0.56, tWid * 0.16, tHei + 0.32, tLen * 0.18), 0.6));
  }
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, tip + 0.05);
  gun.add(muzzle);

  // --- Materiaux et maillages ---
  const camoTex = camoFor(def);
  const camoMat = new THREE.MeshLambertMaterial({ map: camoTex, vertexColors: true });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x3c3a36, vertexColors: true });
  if (!trackTex) trackTex = makeTrackTexture();
  const trackTexL = trackTex.clone();
  const trackTexR = trackTex.clone();
  trackTexL.needsUpdate = true;
  trackTexR.needsUpdate = true;
  const trackMatL = new THREE.MeshLambertMaterial({ map: trackTexL, side: THREE.DoubleSide });
  const trackMatR = new THREE.MeshLambertMaterial({ map: trackTexR, side: THREE.DoubleSide });

  const root = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const addMesh = (parent: THREE.Object3D, list: THREE.BufferGeometry[], mat: THREE.Material) => {
    if (list.length === 0) return;
    const g = mergeGeometries(list, false)!;
    for (const p of list) p.dispose();
    geos.push(g);
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
  };
  addMesh(root, camoParts, camoMat);
  addMesh(root, darkParts, darkMat);
  for (const [k, rb] of ribbons.entries()) {
    geos.push(rb.geo);
    const m = new THREE.Mesh(rb.geo, k === 0 ? trackMatL : trackMatR);
    m.castShadow = true;
    root.add(m);
  }
  addMesh(turret, turretParts, camoMat);
  addMesh(turret, turretDark, darkMat);
  addMesh(gun, gunParts, camoMat);
  turret.add(gun);
  root.add(turret);

  // Boites de collision des obus.
  const hullCenter = new THREE.Vector3(0, (0.1 + deckY) / 2, 0);
  const hullHalf = new THREE.Vector3(W / 2, (deckY - 0.1) / 2, len / 2);
  const turretCenter = casemate
    ? new THREE.Vector3(0, deckY + tHei / 2, (cmFront + cmRear) / 2)
    : new THREE.Vector3(0, tHei / 2 + 0.05, 0);
  const turretHalf = new THREE.Vector3(tWid / 2, tHei / 2 + 0.05, tLen / 2);

  let offL = 0;
  let offR = 0;
  return {
    root,
    turret,
    gun,
    muzzle,
    hullCenter,
    hullHalf,
    turretCenter,
    turretHalf,
    fixedTurret: casemate,
    roll: (left, right) => {
      offL = (offL + left / 0.16) % 1000;
      offR = (offR + right / 0.16) % 1000;
      trackTexL.offset.y = -offL;
      trackTexR.offset.y = -offR;
    },
    setWrecked: () => {
      camoMat.color.setHex(0x2c2824);
      darkMat.color.setHex(0x1e1c1a);
      trackMatL.color.setHex(0x4a4642);
      trackMatR.color.setHex(0x4a4642);
    },
    dispose: () => {
      for (const g of geos) g.dispose();
      camoMat.dispose();
      darkMat.dispose();
      trackMatL.dispose();
      trackMatR.dispose();
      trackTexL.dispose();
      trackTexR.dispose();
    },
  };
}
