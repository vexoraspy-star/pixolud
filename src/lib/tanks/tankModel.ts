import * as THREE from "three";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { CamoChoice, TankDef } from "./tankDefs";
import { makeCamoTexture, makeGrimeTexture, makeNumberTexture, makeReliefTexture, makeSharkTexture, makeTrackTexture, type CamoPaint } from "./tankTextures";

// Les chars dessines en code : caisse a plaques inclinees, chenilles
// epaisses qui defilent, roues a pneus et jantes boulonnees, tourelle (fonte
// arrondie, soudee anguleuse, casemate de chasseur, ou moderne en coin ou
// plate), canon avec frein de bouche ou manchon thermique, mitrailleuses,
// lance-fumigenes, capteurs, cables, numeros peints, paquetage (baches,
// bidons, caisses, filets). Quelques maillages par char : caisse camouflee,
// pieces sombres, equipement, deux chenilles, tourelle, canon, numeros.
//
// Le Lambert des chars est enrichi (voir `enhance`) : boue, poussiere ou
// neige de la carte sur le bas de caisse, reflet du soleil sur l'acier peint,
// lisere de ciel sur les aretes, acier brule des epaves.
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
  /** Sorties d'echappement, dans le repere du char. */
  exhausts: THREE.Vector3[];
  /** Fait tourner le faisceau d'un canon Gatling (il accelere pendant la rafale). */
  spin: (dt: number, firing: boolean) => void;
  /** Fait defiler chaque chenille (metres parcourus par cote). */
  roll: (left: number, right: number) => void;
  /** Char detruit : acier noirci. */
  setWrecked: () => void;
  dispose: () => void;
}

export interface TankModelOptions {
  /** Camouflage choisi au garage (sinon celui d'origine). */
  camo?: CamoChoice | null;
  /** Numero tactique peint sur la tourelle. */
  number?: string;
  /** Boue, poussiere ou neige collee au char : couleur (0 a 1) et quantite (0 a 1). */
  dirt?: { color: [number, number, number]; amount: number };
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
  // Un carreau de texture (512 px) pour 4 m.
  g = boxUV(g, 0.25);
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

/** Hachage stable (0 a 1), pour varier les details sans tirage. */
function hash01(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

/** Une piece d'equipement de sa propre couleur (toile, bois, bidon, feu arriere...). */
function gear(geo: THREE.BufferGeometry, hex: number, shade = 1): THREE.BufferGeometry {
  const g = part(geo, 1);
  const c = new THREE.Color(hex);
  const col = g.getAttribute("color") as THREE.BufferAttribute;
  for (let i = 0; i < col.count; i++) col.setXYZ(i, c.r * shade, c.g * shade, c.b * shade);
  return g;
}

/** Couleur par triangle tiree d'une palette (filet de camouflage, feuillage). */
function mottle(g: THREE.BufferGeometry, palette: number[], seed: number): THREE.BufferGeometry {
  const col = g.getAttribute("color") as THREE.BufferAttribute;
  const cols = palette.map((h) => new THREE.Color(h));
  for (let i = 0; i + 2 < col.count; i += 3) {
    const c = cols[Math.floor(hash01(i * 0.37 + seed) * cols.length)];
    for (let v = 0; v < 3; v++) col.setXYZ(i + v, c.r, c.g, c.b);
  }
  return g;
}

/** Deforme une forme centree sur l'origine : toile froissee, sac bourre, filet. */
function lumpy(geo: THREE.BufferGeometry, amount: number, seed: number): THREE.BufferGeometry {
  const p = geo.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const f = (hash01(x * 7.13 + y * 13.7 + z * 3.91 + seed) - 0.5) * amount;
    p.setXYZ(i, x * (1 + f), y * (1 + f * 0.6), z * (1 + f));
  }
  geo.computeVertexNormals();
  return geo;
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

/** Tube quelconque entre deux points (cable, mat, suspente). */
function rod(r: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, seg = 6): THREE.BufferGeometry {
  const a = new THREE.Vector3(ax, ay, az);
  const b = new THREE.Vector3(bx, by, bz);
  const dir = b.clone().sub(a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
  g.translate(ax, ay, az);
  return g;
}

function convex(points: [number, number, number][]): THREE.BufferGeometry {
  return new ConvexGeometry(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
}

/**
 * Ruban de chenille en boucle (profil en stade dans le plan y-z), coordonnee
 * v le long de la boucle : la texture defile avec la vitesse.
 */
function trackRibbon(x: number, width: number, zFront: number, zRear: number, r: number, y0: number): THREE.BufferGeometry {
  const pts: { y: number; z: number; ny: number; nz: number }[] = [];
  const seg = 10;
  const cyF = y0 + r;
  const straight = zFront - zRear;
  const nStraight = Math.max(4, Math.round(straight / 0.25));
  // Brin inferieur, de l'arriere vers l'avant.
  for (let k = 0; k < nStraight; k++) pts.push({ z: zRear + (straight * k) / nStraight, y: y0, ny: -1, nz: 0 });
  // Galet tendeur avant (demi-cercle).
  for (let k = 0; k <= seg; k++) {
    const a = -Math.PI / 2 + (k / seg) * Math.PI;
    pts.push({ z: zFront + Math.cos(a) * r, y: cyF + Math.sin(a) * r, ny: Math.sin(a), nz: Math.cos(a) });
  }
  // Brin superieur, de l'avant vers l'arriere, qui s'affaisse un peu entre les rouleaux.
  for (let k = 1; k < nStraight; k++) {
    const t = k / nStraight;
    const sag = Math.abs(Math.sin(t * Math.PI * 3)) * 0.035;
    pts.push({ z: zFront - straight * t, y: y0 + 2 * r - sag, ny: 1, nz: 0 });
  }
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
  return geo;
}

/** Une chenille epaisse : le ruban exterieur et un ruban interieur un peu plus petit. */
function trackLoop(x: number, width: number, zFront: number, zRear: number, r: number, y0: number): THREE.BufferGeometry {
  const outer = trackRibbon(x, width, zFront, zRear, r, y0);
  const inner = trackRibbon(x, width * 0.96, zFront, zRear, r - 0.06, y0 + 0.06);
  const merged = mergeGeometries([outer, inner], false)!;
  outer.dispose();
  inner.dispose();
  return merged;
}

// --------------------------------------------------------------- textures

const camoCache = new Map<string, THREE.CanvasTexture>();
const reliefCache = new Map<string, THREE.CanvasTexture>();
let trackTex: THREE.CanvasTexture | null = null;

function paintFor(def: TankDef, camo: CamoChoice | null | undefined): CamoPaint {
  const L = def.look;
  if (camo) return { style: camo.style, color: camo.color, camo: camo.camo, camo2: camo.camo2, rivets: L.rivets };
  return { style: L.camoStyle, color: L.color, camo: L.camo, camo2: L.camo2, rivets: L.rivets };
}

function camoFor(def: TankDef, camo: CamoChoice | null | undefined): THREE.CanvasTexture {
  const key = `${def.id}|${camo?.id ?? "origine"}`;
  let t = camoCache.get(key);
  if (!t) {
    t = makeCamoTexture(paintFor(def, camo), def.id.length * 131 + def.tier * 17);
    camoCache.set(key, t);
  }
  return t;
}

function reliefFor(def: TankDef): THREE.CanvasTexture {
  let t = reliefCache.get(def.id);
  if (!t) {
    t = makeReliefTexture(def.id.length * 131 + def.tier * 17, def.look.rivets === true);
    reliefCache.set(def.id, t);
  }
  return t;
}

/** Reglages communs aux materiaux d'un char (un jeu par char). */
interface TankShading {
  uDirt: { value: THREE.Color };
  uDirtAmount: { value: number };
  uWreck: { value: number };
  uNoise: { value: THREE.Texture };
}

let grimeTex: THREE.CanvasTexture | null = null;

/**
 * Le Lambert des chars, enrichi par quelques lignes de shader :
 *  - boue, poussiere ou neige (couleur de la carte) sur le bas de caisse, le
 *    train de roulement et les chenilles, un voile de poussiere sur ce qui
 *    est a plat, decoupes en plaques par une texture de crasse ;
 *  - un reflet du soleil discret sur l'acier peint (plus vif sur le metal
 *    nu), qui s'eteint dans l'ombre et sous la boue ;
 *  - un lisere de ciel sur les aretes, qui detache le char du decor ;
 *  - l'acier brule, noirci et rouille, des epaves.
 * `shine` : force du reflet (0 : toile mate, 0,45 : metal).
 */
function enhance(mat: THREE.MeshLambertMaterial, look: TankShading, shine: number) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uDirt = look.uDirt;
    shader.uniforms.uDirtAmount = look.uDirtAmount;
    shader.uniforms.uWreck = look.uWreck;
    shader.uniforms.uNoise = look.uNoise;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float dirt;\nvarying float vTkDirt;\nvarying vec3 vTkPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTkDirt = dirt;\nvTkPos = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform vec3 uDirt;\nuniform float uDirtAmount;\nuniform float uWreck;\nuniform sampler2D uNoise;\nvarying float vTkDirt;\nvarying vec3 vTkPos;",
      )
      .replace(
        "#include <color_fragment>",
        [
          "#include <color_fragment>",
          "float tkN = texture2D(uNoise, vTkPos.xz * 0.37 + vec2(vTkPos.y * 0.29, vTkPos.y * 0.11)).r;",
          "float tkD = clamp((vTkDirt * 1.3 - 0.08) * (0.3 + tkN * 1.4) * uDirtAmount, 0.0, 0.93);",
          "diffuseColor.rgb = mix(diffuseColor.rgb, uDirt * (0.78 + tkN * 0.44), tkD);",
          "float tkBurn = uWreck * (0.74 + tkN * 0.26);",
          "vec3 tkBurnt = mix(vec3(0.03, 0.027, 0.024), vec3(0.17, 0.075, 0.03), smoothstep(0.6, 0.85, tkN));",
          "diffuseColor.rgb = mix(diffuseColor.rgb, tkBurnt, tkBurn);",
        ].join("\n"),
      )
      .replace(
        "#include <envmap_fragment>",
        [
          "#if NUM_DIR_LIGHTS > 0",
          "{",
          "  vec3 tkH = normalize(directionalLights[0].direction + geometryViewDir);",
          "  float tkLit = clamp(dot(reflectedLight.directDiffuse, vec3(1.0)) / max(0.03, dot(diffuseColor.rgb, vec3(1.0))), 0.0, 2.0);",
          `  float tkSpec = pow(max(dot(normal, tkH), 0.0), 34.0) * ${shine.toFixed(3)} * (1.0 - tkD) * (1.0 - uWreck) * (0.55 + tkN * 0.9);`,
          "  outgoingLight += directionalLights[0].color * tkSpec * tkLit * 0.25;",
          "}",
          "#endif",
          "#if NUM_HEMI_LIGHTS > 0",
          "  outgoingLight += hemisphereLights[0].skyColor * pow(1.0 - saturate(dot(normal, geometryViewDir)), 3.0) * 0.035 * (1.0 - uWreck);",
          "#endif",
          "#include <envmap_fragment>",
        ].join("\n"),
      );
  };
  // Un programme par force de reflet : tous les chars le partagent.
  mat.customProgramCacheKey = () => `char-${shine.toFixed(3)}`;
}

// ----------------------------------------------------------------- modele

export function buildTankModel(def: TankDef, opts: TankModelOptions = {}): TankModel {
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
  const glacis = Math.min(len * 0.34, H * 0.55 * Math.tan(slope) + 0.2);
  const modern = L.modern === true;

  const camoParts: THREE.BufferGeometry[] = [];
  const darkParts: THREE.BufferGeometry[] = [];
  /** Equipement de sa propre couleur : toile, bois, bidons, feux. */
  const gearParts: THREE.BufferGeometry[] = [];
  const CANVAS = 0x857b5c;
  const CANVAS_DARK = 0x5f5a45;
  const WOOD = 0x7b5d3c;
  const JERRY = 0x4d5338;
  const NET = [0x4a5634, 0x5d5c3b, 0x3b452b, 0x6a6344, 0x2f3a24];

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
  // Blinde d'infanterie : le compartiment arriere est plus haut (les soldats y sont assis).
  const rearDeck = L.ifv ? deckY + 0.28 : deckY;
  camoParts.push(
    part(
      convex([
        [-hu, c + H * 0.45, -len / 2],
        [hu, c + H * 0.45, -len / 2],
        [-hu, c + H * 0.45, len / 2],
        [hu, c + H * 0.45, len / 2],
        [-(hu - inset), deckY, len / 2 - glacis],
        [hu - inset, deckY, len / 2 - glacis],
        [-(hu - inset), rearDeck, -len / 2 + 0.35],
        [hu - inset, rearDeck, -len / 2 + 0.35],
        [-(hu - inset), (L.ifv ? rearDeck : c + H * 0.85) - 0.02, -len / 2 + 0.05],
        [hu - inset, (L.ifv ? rearDeck : c + H * 0.85) - 0.02, -len / 2 + 0.05],
      ]),
      1,
      c + H * 0.6,
    ),
  );
  if (L.ifv) {
    // Porte arriere (rampe) et hublots de tir sur les flancs.
    darkParts.push(part(box(1.1, 1.1, 0.05, 0, c + H * 0.55, -len / 2 - 0.01), 0.55));
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        darkParts.push(part(box(0.04, 0.16, 0.24, side * (hu - inset * 0.6), c + H * 0.82, -len * 0.05 - k * 0.8), 0.25));
      }
    }
  }

  // Casemate de chasseur : une superstructure haute et tres inclinee.
  const [tWid, tHei, tLen] = L.turret;
  const casemate = L.turretShape === "casemate";
  const tSlope = (def.turret.frontSlope * Math.PI) / 180;
  // Casemate a l'avant (chasseur classique) ou posee a l'arriere, le canon au-dessus du moteur.
  const cmFront = L.rearCasemate ? -len / 2 + 0.25 + tLen : len / 2 - glacis + 0.1;
  const cmRear = cmFront - tLen;
  if (casemate && L.openTop) {
    // Casemate ouverte : des plaques fines, un plancher sombre et des casiers a obus.
    const topInset = Math.tan(tSlope) * tHei;
    const sideIn = Math.tan((def.turret.sideSlope * Math.PI) / 180) * tHei;
    const th = 0.09;
    camoParts.push(
      part(
        convex([
          [-tWid / 2, deckY - 0.05, cmFront],
          [tWid / 2, deckY - 0.05, cmFront],
          [-tWid / 2, deckY - 0.05, cmFront - th * 1.6],
          [tWid / 2, deckY - 0.05, cmFront - th * 1.6],
          [-(tWid / 2 - sideIn), deckY + tHei, cmFront - topInset],
          [tWid / 2 - sideIn, deckY + tHei, cmFront - topInset],
          [-(tWid / 2 - sideIn), deckY + tHei, cmFront - topInset - th * 1.6],
          [tWid / 2 - sideIn, deckY + tHei, cmFront - topInset - th * 1.6],
        ]),
        1.03,
      ),
    );
    for (const side of [-1, 1]) {
      camoParts.push(
        part(
          convex([
            [side * (tWid / 2), deckY - 0.05, cmRear],
            [side * (tWid / 2 - th), deckY - 0.05, cmRear],
            [side * (tWid / 2), deckY - 0.05, cmFront],
            [side * (tWid / 2 - th), deckY - 0.05, cmFront],
            [side * (tWid / 2 - sideIn), deckY + tHei * 0.85, cmRear + 0.15],
            [side * (tWid / 2 - sideIn - th), deckY + tHei * 0.85, cmRear + 0.15],
            [side * (tWid / 2 - sideIn), deckY + tHei, cmFront - topInset],
            [side * (tWid / 2 - sideIn - th), deckY + tHei, cmFront - topInset],
          ]),
          1.03,
        ),
      );
    }
    camoParts.push(part(box(tWid - 0.1, tHei * 0.5, th, 0, deckY + tHei * 0.25, cmRear + 0.06), 1));
    darkParts.push(part(box(tWid - 0.25, 0.05, tLen - 0.3, 0, deckY + 0.02, (cmFront + cmRear) / 2), 0.45));
    for (const side of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        darkParts.push(part(tubeZ(0.08, 0.08, 0.5, side * (tWid / 2 - 0.3), deckY + 0.2 + (k % 2) * 0.18, cmRear + 0.3 + Math.floor(k / 2) * 0.2, 8), 0.9));
      }
    }
  } else if (casemate) {
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
    // Trappes, episcope et tourelleau du chef sur le toit de la casemate.
    camoParts.push(part(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 14).translate(-tWid * 0.22, deckY + tHei + 0.06, cmRear + 0.9), 0.9));
    camoParts.push(part(box(0.25, 0.14, 0.18, tWid * 0.2, deckY + tHei + 0.07, cmFront - topInset - 0.3)));
  }

  // --- Chenilles, roues, garde-boue ---
  const zFront = len / 2 - r - 0.05;
  const zRear = -len / 2 + r + 0.05;
  const tracks = [trackLoop(-trackX, tw, zFront, zRear, r, 0.03), trackLoop(trackX, tw, zFront, zRear, r, 0.03)];
  const fenderY = 0.03 + 2 * r + 0.06;
  for (const side of [-1, 1]) {
    const x = side * trackX;
    const outer = side * (trackX + tw * 0.46);
    // Barbotin a dents (avant pour les chars modernes, arriere pour les anciens) et tendeur.
    const sprocketZ = modern ? zRear : zFront;
    const idlerZ = modern ? zFront : zRear;
    darkParts.push(part(wheel(r * 0.84, tw * 0.9, x, 0.03 + r, sprocketZ, 18), 0.7));
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      darkParts.push(part(box(tw * 0.5, 0.1, 0.1, x, 0.03 + r + Math.sin(a) * r * 0.9, sprocketZ + Math.cos(a) * r * 0.9, a), 0.55));
    }
    darkParts.push(part(wheel(r * 0.82, tw * 0.88, x, 0.03 + r, idlerZ, 18), 0.62));
    camoParts.push(part(wheel(r * 0.5, tw * 0.94, x, 0.03 + r, idlerZ, 14), 0.9));
    // Roues de route : pneu de caoutchouc, jante peinte, moyeu et boulons.
    const n = L.wheels;
    const span = zFront - zRear - r * 1.6;
    const wr = L.wheelRadius;
    for (let k = 0; k < n; k++) {
      const z = zRear + r * 0.8 + (n === 1 ? span / 2 : (span * k) / (n - 1));
      const y = 0.05 + wr;
      darkParts.push(part(wheel(wr, tw * 0.78, x, y, z, 18), 0.32));
      camoParts.push(part(wheel(wr * 0.84, tw * 0.82, x, y, z, 18), 0.92));
      camoParts.push(part(wheel(wr * 0.62, tw * 0.86, x, y, z, 14), 0.8));
      darkParts.push(part(wheel(wr * 0.24, tw * 0.92, x, y, z, 10), 1.2));
      for (let b = 0; b < 6; b++) {
        const a = (b / 6) * Math.PI * 2;
        darkParts.push(part(box(0.04, 0.04, 0.04, outer, y + Math.sin(a) * wr * 0.4, z + Math.cos(a) * wr * 0.4), 1.4));
      }
      // Bras de suspension : du moyeu vers son pivot sur la caisse.
      darkParts.push(part(rod(0.05, x - side * tw * 0.4, y, z, side * (hl - 0.03), y + 0.18, z + 0.4, 6), 0.5));
    }
    // Rouleaux porteurs sous le brin superieur.
    for (let k = 0; k < 3; k++) {
      darkParts.push(part(wheel(0.1, tw * 0.5, x, 0.03 + 2 * r - 0.12, zRear + ((k + 1) * (zFront - zRear)) / 4, 8), 0.7));
    }
    // Garde-boue, avec une bavette de caoutchouc au bout.
    camoParts.push(part(box(tw + 0.06, 0.04, len - 0.1, x, fenderY, 0), 0.95));
    darkParts.push(part(box(tw + 0.02, 0.28, 0.03, x, fenderY - 0.16, len / 2 - 0.08), 0.35));
    // Jupes laterales : plaques (modernes : modules epais devant, bas en caoutchouc).
    if (L.skirts) {
      const panels = modern ? 6 : 5;
      for (let k = 0; k < panels; k++) {
        const plate = len / panels - 0.05;
        const z = -len / 2 + plate / 2 + k * (plate + 0.05) + 0.06;
        const thick = modern && k >= panels - 2 ? 0.1 : 0.035;
        camoParts.push(part(box(thick, r * 1.15, plate, side * (W / 2 + thick / 2), 0.03 + r * 1.45, z, 0, 0, side * 0.04), 1, 0.03 + 2 * r));
        if (modern) darkParts.push(part(box(thick * 0.8, 0.14, plate, side * (W / 2 + thick / 2), 0.03 + r * 0.8, z), 0.3));
      }
    }
    // Cable de remorquage le long du flanc, avec ses boucles.
    const cableX = side * (hu - 0.12);
    darkParts.push(part(rod(0.028, cableX, deckY - 0.02, -len * 0.32, cableX, deckY - 0.02, len * 0.18), 0.5));
    for (const z of [-len * 0.32, len * 0.18]) {
      darkParts.push(part(new THREE.TorusGeometry(0.07, 0.022, 6, 12).rotateY(Math.PI / 2).translate(cableX, deckY - 0.02, z), 0.5));
    }
    // Outils et bidon sur le garde-boue.
    camoParts.push(part(box(0.1, 0.1, 1.4, x + side * tw * 0.2, fenderY + 0.07, -len * 0.15), 0.8));
    darkParts.push(part(box(0.2, 0.34, 0.46, x, fenderY + 0.19, -len / 2 + 0.55), 0.95));
    // Phare et sa grille de protection.
    darkParts.push(part(tubeZ(0.09, 0.1, 0.16, side * (W / 2 - tw * 0.8), deckY - 0.08, len / 2 - glacis * 0.5), 1.4));
    darkParts.push(part(box(0.24, 0.02, 0.03, side * (W / 2 - tw * 0.8), deckY + 0.05, len / 2 - glacis * 0.5 + 0.18), 0.5));
    gearParts.push(gear(tubeZ(0.075, 0.075, 0.02, side * (W / 2 - tw * 0.8), deckY - 0.08, len / 2 - glacis * 0.5 + 0.16, 12), 0xd9d6c4));
    // Crochets de remorquage.
    darkParts.push(part(box(0.12, 0.14, 0.2, side * 0.6, c + 0.1, len / 2 - 0.35), 0.7));
    darkParts.push(part(box(0.12, 0.14, 0.2, side * 0.6, c + 0.1, -len / 2 + 0.3), 0.7));
    // Echappement : silencieux et pot a l'arriere (les modernes soufflent par une grille).
    if (!modern) {
      darkParts.push(part(box(0.5, 0.22, 0.2, side * 0.55, c + H * 0.62, -len / 2 - 0.12), 0.5));
      darkParts.push(part(tubeZ(0.07, 0.07, 0.25, side * 0.55 + side * 0.18, c + H * 0.62, -len / 2 - 0.35, 10), 0.3));
    }
    // Paquetage du garde-boue : un bidon de plus a l'arriere, une caisse de munitions a l'avant.
    gearParts.push(gear(box(0.18, 0.44, 0.34, x, fenderY + 0.24, -len / 2 + 1.0), JERRY));
    gearParts.push(gear(box(0.05, 0.05, 0.16, x, fenderY + 0.48, -len / 2 + 1.0), 0x2a2c22));
    if (side === 1 && !modern) gearParts.push(gear(box(tw * 0.8, 0.26, 0.62, x, fenderY + 0.15, len / 2 - 1.05), WOOD));
    // Feux arriere.
    gearParts.push(gear(box(0.13, 0.09, 0.05, side * (W / 2 - 0.3), c + H * 0.78, -len / 2 + 0.07), 0x9e2016));
  }

  // --- Details de la caisse ---
  // Maillons de rechange poses a plat sur le glacis.
  const glacisRise = deckY - (c + H * 0.45);
  const glacisTilt = Math.atan2(glacisRise, glacis);
  if (!modern) {
    for (let k = 0; k < 3; k++) {
      darkParts.push(part(box(0.42, 0.06, 0.2, (k - 1) * 0.46, deckY - glacisRise * 0.38 + 0.04, len / 2 - glacis * 0.62, glacisTilt, 0, 0), 0.6));
    }
  }
  // Grilles moteur sur le pont arriere (deux pour les modernes).
  darkParts.push(part(box(W * 0.5, 0.03, len * 0.22, 0, rearDeck + 0.015, -len * 0.3), 0.55));
  if (modern) darkParts.push(part(box(W * 0.3, 0.03, 0.4, 0, rearDeck + 0.015, -len * 0.46), 0.4));
  // Trappe du pilote, avec ses episcopes.
  camoParts.push(part(box(0.5, 0.08, 0.5, -W * 0.22, deckY + 0.03, len / 2 - glacis - 0.3), 0.92));
  darkParts.push(part(box(0.3, 0.06, 0.06, -W * 0.22, deckY + 0.08, len / 2 - glacis - 0.05), 0.3));
  // Mitrailleuse de caisse dans sa rotule, sur la plaque avant.
  if (L.hullMG) {
    const mgZ = len / 2 - glacis * 0.45;
    const mgY = deckY - glacisRise * 0.45;
    camoParts.push(part(new THREE.SphereGeometry(0.14, 12, 8).translate(W * 0.2, mgY, mgZ), 0.95));
    darkParts.push(part(tubeZ(0.022, 0.022, 0.45, W * 0.2, mgY, mgZ + 0.1, 8), 0.3));
  }
  // Rivets de la caisse (annees trente) : des rangees le long du pont.
  if (L.rivets) {
    for (const side of [-1, 1]) {
      for (let k = 0; k < 14; k++) {
        darkParts.push(part(box(0.035, 0.03, 0.035, side * (hu - inset - 0.06), deckY + 0.01, -len / 2 + 0.4 + k * ((len - 0.8) / 13)), 1.25));
      }
    }
  }

  // Super-lourd : deux petites tourelles de mitrailleuse aux coins avant du pont.
  if (L.miniTurrets) {
    for (const side of [-1, 1]) {
      const mx = side * W * 0.37;
      const mz = len / 2 - glacis - 0.4;
      camoParts.push(part(new THREE.CylinderGeometry(0.36, 0.4, 0.34, 14).translate(mx, deckY + 0.17, mz), 1.02));
      camoParts.push(part(new THREE.SphereGeometry(0.36, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(mx, deckY + 0.34, mz), 1.02));
      darkParts.push(part(tubeZ(0.025, 0.025, 0.6, mx, deckY + 0.24, mz + 0.3, 8), 0.3));
      darkParts.push(part(box(0.14, 0.05, 0.05, mx, deckY + 0.46, mz + 0.18), 0.3));
    }
  }
  // Obusier : beche de recul repliee a l'arriere, caisses de gargousses sur le pont.
  if (L.howitzer) {
    const spade = box(W * 0.72, 0.9, 0.09, 0, c + H * 0.45, -len / 2 - 0.18);
    spade.rotateX(-0.28);
    camoParts.push(part(spade, 0.95));
    for (const side of [-1, 1]) darkParts.push(part(rod(0.05, side * W * 0.3, c + H * 0.3, -len / 2 + 0.1, side * W * 0.3, c + H * 0.7, -len / 2 - 0.25, 6), 0.45));
    for (let k = 0; k < 3; k++) gearParts.push(gear(box(0.5, 0.3, 0.7, (k - 1) * 0.6, deckY + 0.15, len / 2 - glacis - 0.6), WOOD, 0.9 + k * 0.05));
  }

  // --- Paquetage du pont arriere ---
  if (!modern) {
    // Bache roulee en travers du pont arriere, tenue par deux sangles.
    const tarpZ = -len / 2 + 0.62;
    const tarp = lumpy(new THREE.CylinderGeometry(0.17, 0.17, W * 0.52, 12, 3), 0.08, 3);
    tarp.rotateZ(Math.PI / 2);
    tarp.translate(0, rearDeck + 0.17, tarpZ);
    gearParts.push(gear(tarp, CANVAS));
    for (const sx of [-0.3, 0.3]) {
      const strap = new THREE.TorusGeometry(0.176, 0.022, 5, 14);
      strap.rotateY(Math.PI / 2);
      strap.translate(W * sx * 0.52, rearDeck + 0.17, tarpZ);
      gearParts.push(gear(strap, 0x2a2620));
    }
  } else {
    // Filet de camouflage roule sur le pont arriere.
    const net = lumpy(new THREE.CylinderGeometry(0.21, 0.21, W * 0.6, 10, 4), 0.16, 7);
    net.rotateZ(Math.PI / 2);
    net.translate(0, rearDeck + 0.21, -len / 2 + 0.6);
    gearParts.push(mottle(gear(net, NET[0]), NET, 7));
  }
  if (casemate) {
    // Chasseur : un filet jete sur l'arriere de la casemate, des branchages plantes dedans.
    const net = lumpy(new THREE.IcosahedronGeometry(1, 2), 0.4, 11);
    net.scale(tWid * 0.36, 0.17, tLen * 0.24);
    net.translate(tWid * 0.1, deckY + tHei + 0.05, cmRear + 0.35);
    gearParts.push(mottle(gear(net, NET[0]), NET, 11));
    for (let b = 0; b < 6; b++) {
      const branch = new THREE.ConeGeometry(0.1, 0.8 + hash01(b + 3) * 0.4, 5);
      branch.rotateZ((hash01(b * 5.1) - 0.5) * 1.2);
      branch.rotateX((hash01(b * 2.3) - 0.5) * 0.8);
      branch.translate(tWid * (hash01(b * 1.7) - 0.4) * 0.6, deckY + tHei + 0.4, cmRear + 0.1 + hash01(b * 3.3) * tLen * 0.45);
      gearParts.push(gear(branch, b % 2 ? 0x3f5a2c : 0x55642f));
    }
  }

  // --- Tourelle ---
  const turret = new THREE.Group();
  const turretY = deckY - 0.02;
  const turretZ = L.turretOffset;
  const turretParts: THREE.BufferGeometry[] = [];
  const turretDark: THREE.BufferGeometry[] = [];
  const turretGear: THREE.BufferGeometry[] = [];
  let gunY: number;
  let gunZ: number;
  let roofY = tHei;
  const sIn = Math.tan((def.turret.sideSlope * Math.PI) / 180) * tHei;
  if (casemate) {
    // Le « canon » sort de la face avant de la casemate, dans un masque en boule.
    turret.position.set(0, 0, 0);
    gunY = deckY + tHei * 0.42;
    gunZ = cmFront - Math.tan(tSlope) * tHei * 0.42 + 0.05;
    turretParts.push(part(new THREE.SphereGeometry(0.34, 14, 10).translate(0, gunY, gunZ - 0.05), 1));
    // Casemate ouverte : on voit le berceau et la culasse du canon.
    if (L.openTop) turretDark.push(part(box(0.55, 0.5, 1.7, 0, gunY - 0.05, gunZ - 0.95), 0.6));
  } else if (L.turretShape === "coin") {
    // Tourelle moderne en coin : un corps en boite et deux coins de blindage
    // en fleche de part et d'autre du masque du canon.
    turret.position.set(0, turretY, turretZ);
    turretParts.push(
      part(
        convex([
          [-tWid / 2, 0, -tLen / 2],
          [tWid / 2, 0, -tLen / 2],
          [-tWid / 2, 0, tLen * 0.18],
          [tWid / 2, 0, tLen * 0.18],
          [-(tWid / 2 - sIn), tHei, -tLen * 0.47],
          [tWid / 2 - sIn, tHei, -tLen * 0.47],
          [-(tWid / 2 - sIn), tHei, tLen * 0.18],
          [tWid / 2 - sIn, tHei, tLen * 0.18],
        ]),
        1.03,
      ),
    );
    for (const side of [-1, 1]) {
      turretParts.push(
        part(
          convex([
            [side * tWid / 2, 0.05, tLen * 0.18],
            [side * (tWid / 2 - sIn), tHei * 0.96, tLen * 0.18],
            [side * tWid * 0.15, 0.05, tLen * 0.18],
            [side * tWid * 0.15, tHei * 0.96, tLen * 0.18],
            [side * tWid * 0.17, 0.1, tLen / 2],
            [side * tWid * 0.17, tHei * 0.88, tLen / 2 - 0.1],
          ]),
          1.05,
        ),
      );
    }
    gunY = tHei * 0.46;
    gunZ = tLen * 0.3;
    turretParts.push(part(box(tWid * 0.3, tHei * 0.7, 0.34, 0, gunY, tLen * 0.24), 0.95));
  } else if (L.turretShape === "plate") {
    // Tourelle moderne large et basse, grosse nuque, masque en retrait.
    turret.position.set(0, turretY, turretZ);
    turretParts.push(
      part(
        convex([
          [-tWid / 2, 0, -tLen / 2],
          [tWid / 2, 0, -tLen / 2],
          [-tWid / 2, 0, tLen * 0.3],
          [tWid / 2, 0, tLen * 0.3],
          [-tWid * 0.36, 0, tLen / 2],
          [tWid * 0.36, 0, tLen / 2],
          [-(tWid / 2 - sIn), tHei, -tLen * 0.46],
          [tWid / 2 - sIn, tHei, -tLen * 0.46],
          [-(tWid / 2 - sIn), tHei, tLen * 0.2],
          [tWid / 2 - sIn, tHei, tLen * 0.2],
          [-tWid * 0.28, tHei, tLen * 0.36],
          [tWid * 0.28, tHei, tLen * 0.36],
        ]),
        1.04,
      ),
    );
    gunY = tHei * 0.44;
    gunZ = tLen / 2 - 0.05;
    turretParts.push(part(box(tWid * 0.26, tHei * 0.62, 0.3, 0, gunY, tLen / 2 - 0.1), 0.9));
  } else if (L.turretShape === "anguleuse") {
    turret.position.set(0, turretY, turretZ);
    const fIn = Math.tan(tSlope) * tHei;
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
    dome.scale((tWid / 2) * 0.99, tHei * 0.6, (tLen / 2) * 0.99);
    dome.translate(0, tHei * 0.4, 0);
    turretParts.push(part(dome, 1.05));
    roofY = tHei;
    // Nuque a l'arriere.
    turretParts.push(part(box(tWid * 0.62, tHei * 0.42, tLen * 0.3, 0, tHei * 0.3, -tLen * 0.52), 0.98));
    gunY = tHei * 0.45;
    gunZ = tLen / 2 - 0.1;
    // Masque arrondi : demi-cylindre couche le long de x, bombe vers l'avant.
    const mantlet = new THREE.CylinderGeometry(tHei * 0.3, tHei * 0.3, tWid * 0.46, 16, 1, false, 0, Math.PI);
    mantlet.rotateZ(Math.PI / 2);
    mantlet.rotateX(Math.PI / 2);
    mantlet.translate(0, gunY, gunZ);
    turretParts.push(part(mantlet, 1));
  }
  if (!casemate) {
    // Tourelleau du chef, trappe, episcopes.
    const cx = -tWid * 0.2;
    const cz = -tLen * 0.15;
    turretParts.push(part(new THREE.CylinderGeometry(0.3, 0.33, 0.28, 14).translate(cx, roofY + 0.12, cz), 1));
    turretDark.push(part(new THREE.CylinderGeometry(0.27, 0.27, 0.05, 14).translate(cx, roofY + 0.29, cz), 0.8));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      turretDark.push(part(box(0.08, 0.07, 0.05, cx + Math.cos(a) * 0.3, roofY + 0.2, cz + Math.sin(a) * 0.3, 0, -a, 0), 0.35));
    }
    // Trappe du chargeur.
    turretParts.push(part(box(0.46, 0.06, 0.5, tWid * 0.18, roofY + 0.02, -tLen * 0.08), 0.93));
    // Antenne (et une deuxieme, plus courte, sur les modernes).
    turretDark.push(part(new THREE.CylinderGeometry(0.012, 0.018, 2.3, 5).translate(tWid * 0.3, roofY + 1.15, -tLen * 0.4), 0.5));
    if (modern) turretDark.push(part(new THREE.CylinderGeometry(0.01, 0.016, 1.5, 5).translate(-tWid * 0.34, roofY + 0.75, -tLen * 0.42), 0.5));
    // Crochets de levage.
    for (const side of [-1, 1]) {
      turretDark.push(part(new THREE.TorusGeometry(0.06, 0.018, 5, 10).translate(side * tWid * 0.3, roofY + 0.05, tLen * 0.1), 0.5));
    }
    // Radar de conduite de tir : une parabole sur un mat, a l'arriere de la tourelle.
    if (L.radar) {
      turretDark.push(part(rod(0.04, 0, roofY, -tLen * 0.3, 0, roofY + 0.55, -tLen * 0.3, 6), 0.5));
      const dish = new THREE.SphereGeometry(0.5, 14, 6, 0, Math.PI * 2, 0, 1.0);
      dish.scale(1, 0.4, 1);
      dish.rotateX(-1.25);
      dish.translate(0, roofY + 0.75, -tLen * 0.3 + 0.08);
      turretDark.push(part(dish, 1.1));
    }
    // Boule de capteurs sur un mat, a l'arriere gauche de la tourelle.
    if (L.sensorDome) {
      turretDark.push(part(rod(0.035, -tWid * 0.26, roofY, -tLen * 0.24, -tWid * 0.26, roofY + 0.42, -tLen * 0.24, 6), 0.5));
      turretGear.push(gear(new THREE.SphereGeometry(0.3, 16, 10).translate(-tWid * 0.26, roofY + 0.62, -tLen * 0.24), 0xc9cdd1));
    }
    // Coffre de rangement a l'arriere de la tourelle.
    if (!modern) {
      turretParts.push(part(box(tWid * 0.55, tHei * 0.45, 0.35, 0, tHei * 0.42, -tLen / 2 - 0.16), 0.9));
      // Une couverture roulee, sanglee sur le coffre.
      const roll = lumpy(new THREE.CylinderGeometry(0.13, 0.13, tWid * 0.5, 10, 2), 0.1, 5);
      roll.rotateZ(Math.PI / 2);
      roll.translate(0, tHei * 0.645 + 0.12, -tLen / 2 - 0.16);
      turretGear.push(gear(roll, CANVAS_DARK));
    }
    // Mitrailleuse du chef sur son affut.
    if (L.aaMG) {
      turretDark.push(part(rod(0.02, cx, roofY + 0.3, cz, cx, roofY + 0.62, cz), 0.5));
      turretDark.push(part(box(0.11, 0.12, 0.42, cx, roofY + 0.68, cz + 0.08), 0.42));
      turretDark.push(part(tubeZ(0.016, 0.02, 0.62, cx, roofY + 0.7, cz + 0.28, 8), 0.3));
      turretDark.push(part(box(0.14, 0.12, 0.14, cx + 0.12, roofY + 0.64, cz + 0.02), 0.6));
    }
    // Char moderne : viseurs, capteur de vent, panier arriere, lance-fumigenes.
    if (modern) {
      turretParts.push(part(box(0.36, 0.3, 0.46, tWid * 0.26, roofY + 0.15, tLen * 0.08), 0.95));
      turretDark.push(part(box(0.3, 0.2, 0.04, tWid * 0.26, roofY + 0.18, tLen * 0.08 + 0.24), 0.2));
      turretParts.push(part(new THREE.CylinderGeometry(0.1, 0.12, 0.3, 10).translate(cx - 0.35, roofY + 0.15, cz - 0.25), 0.9));
      turretParts.push(part(box(0.34, 0.26, 0.34, cx - 0.35, roofY + 0.42, cz - 0.25), 0.95));
      turretDark.push(part(box(0.26, 0.16, 0.03, cx - 0.35, roofY + 0.44, cz - 0.07), 0.2));
      turretDark.push(part(new THREE.CylinderGeometry(0.012, 0.012, 0.8, 5).translate(tWid * 0.05, roofY + 0.4, -tLen * 0.46), 0.5));
      // Panier arriere : un cadre de tubes et un filet sombre.
      const basketZ = -tLen / 2 - 0.35;
      turretDark.push(part(box(tWid * 0.86, tHei * 0.55, 0.6, 0, tHei * 0.5, basketZ), 0.28));
      turretParts.push(part(box(tWid * 0.88, 0.04, 0.64, 0, tHei * 0.78, basketZ), 0.8));
      // Sacs et paquetage entasses dans le panier.
      for (let b = 0; b < 3; b++) {
        const bag = lumpy(new THREE.BoxGeometry(0.5, 0.36, 0.44, 2, 2, 2), 0.14, b * 3 + 1);
        bag.translate((b - 1) * tWid * 0.27, tHei * 0.62, basketZ + (b % 2) * 0.06);
        turretGear.push(gear(bag, b === 1 ? CANVAS_DARK : CANVAS, 0.9 + b * 0.06));
      }
      // Deux grappes de quatre lance-fumigenes, tournees vers l'avant.
      for (const side of [-1, 1]) {
        for (let k = 0; k < 4; k++) {
          const g = new THREE.CylinderGeometry(0.045, 0.045, 0.3, 8);
          g.rotateX(Math.PI / 2 - 0.4);
          g.rotateY(side * (0.25 + k * 0.18));
          g.translate(side * (tWid / 2 - sIn - 0.05), roofY - 0.08 + (k % 2) * 0.1, tLen * 0.05 + Math.floor(k / 2) * 0.14);
          turretDark.push(part(g, 0.45));
        }
      }
    } else if (!L.twinMG && !L.autocannon && def.caliber >= 70) {
      // Maillons de rechange accroches au flanc de la tourelle.
      for (const side of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          turretDark.push(part(box(0.03, 0.18, 0.3, side * (tWid / 2 - sIn * 0.5 + 0.02), tHei * 0.5, -tLen * 0.25 + k * 0.33), 0.55));
        }
      }
    }
  }

  // --- Canon : pivot de hausse devant le masque ---
  const gun = new THREE.Group();
  gun.position.set(0, gunY, gunZ);
  const gunParts: THREE.BufferGeometry[] = [];
  const gunDark: THREE.BufferGeometry[] = [];
  const gl = L.gunLength;
  const gr = L.gunRadius;
  let tip = gl;
  /** Faisceau tournant d'un canon Gatling. */
  const barrels = new THREE.Group();
  const barrelParts: THREE.BufferGeometry[] = [];
  if (L.gatling) {
    // Canon Gatling : six tubes en faisceau autour de l'axe, trois colliers, un carter a l'arriere.
    gunParts.push(part(box(0.55, 0.46, 0.55, 0, 0, 0.1), 0.95));
    const ring = gr * 2.3;
    const nb = L.barrels ?? 6;
    for (let k = 0; k < nb; k++) {
      const a = (k / nb) * Math.PI * 2;
      barrelParts.push(part(tubeZ(gr, gr, gl, Math.cos(a) * ring, Math.sin(a) * ring, 0.3, 8), 0.35));
    }
    for (const z of [0.36, gl * 0.55, gl + 0.22]) barrelParts.push(part(tubeZ(ring + gr * 1.4, ring + gr * 1.4, 0.07, 0, 0, z, 12), 0.5));
    // Tambour de munitions contre la tourelle.
    turretDark.push(part(new THREE.CylinderGeometry(0.34, 0.34, 0.5, 14).rotateZ(Math.PI / 2).translate(tWid * 0.34, tHei * 0.45, tLen * 0.1), 0.8));
    tip = gl + 0.32;
  } else if (L.twinMG) {
    // Deux mitrailleuses lourdes jumelees : deux tubes a manchon perce.
    for (const side of [-1, 1]) {
      gunDark.push(part(tubeZ(gr * 3, gr * 3, gl * 0.55, side * 0.12, 0, 0.05, 10), 0.4));
      for (let k = 0; k < 5; k++) gunDark.push(part(tubeZ(gr * 3.3, gr * 3.3, 0.03, side * 0.12, 0, 0.12 + k * gl * 0.1, 10), 0.3));
      gunDark.push(part(tubeZ(gr, gr, gl, side * 0.12, 0, 0.05, 8), 0.3));
      gunDark.push(part(tubeZ(gr * 1.8, gr * 1.4, 0.12, side * 0.12, 0, gl, 8), 0.35));
    }
    gunParts.push(part(box(0.5, 0.3, 0.2, 0, 0, 0), 1));
    tip = gl + 0.12;
  } else {
    gunParts.push(part(tubeZ(gr * 1.5, gr * 1.15, gl * 0.3, 0, 0, 0), 1));
    gunParts.push(part(tubeZ(gr * 1.15, gr, gl * 0.7, 0, 0, gl * 0.3), 1));
    if (modern) {
      // Canon lisse moderne : manchon thermique en troncons, evacuateur au milieu, capteur au bout.
      for (let k = 0; k < 4; k++) gunParts.push(part(tubeZ(gr * 1.28, gr * 1.28, gl * 0.18, 0, 0, gl * 0.12 + k * gl * 0.2, 16), 0.93 - (k % 2) * 0.05));
      gunParts.push(part(tubeZ(gr * 1.75, gr * 1.75, gl * 0.12, 0, 0, gl * 0.42), 0.96));
      gunDark.push(part(box(0.12, 0.1, 0.16, 0, gr * 1.6, gl - 0.12), 0.35));
      // Mitrailleuse coaxiale a cote du canon.
      gunDark.push(part(tubeZ(0.02, 0.02, 0.35, 0.28, 0.02, 0.1, 8), 0.3));
    } else if (def.caliber >= 85) {
      // Evacuateur de fumees au milieu du tube pour les gros calibres.
      gunParts.push(part(tubeZ(gr * 1.6, gr * 1.6, gl * 0.12, 0, 0, gl * 0.55), 0.97));
    }
    if (L.muzzleBrake) {
      gunParts.push(part(tubeZ(gr * 1.7, gr * 1.8, 0.34, 0, 0, gl), 0.9));
      // Les events du frein de bouche.
      for (const side of [-1, 1]) gunDark.push(part(box(0.02, gr * 1.8, 0.16, side * gr * 1.78, 0, gl + 0.17), 0.25));
      tip = gl + 0.34;
    }
    if (L.autocannon) {
      // Canon automatique : manchon de refroidissement perce, cache-flammes au bout.
      gunParts.push(part(tubeZ(gr * 2.1, gr * 2.1, gl * 0.42, 0, 0, gl * 0.08), 0.85));
      for (let k = 0; k < 6; k++) gunParts.push(part(tubeZ(gr * 2.25, gr * 2.25, 0.05, 0, 0, gl * 0.12 + k * gl * 0.06), 0.55));
      gunParts.push(part(tubeZ(gr * 1.5, gr * 1.9, 0.22, 0, 0, gl), 0.6));
      tip = gl + 0.22;
      // Le chargeur, pose sur la tourelle a cote de la culasse.
      turretDark.push(part(box(0.26, 0.34, 0.52, tWid * 0.16, roofY + 0.14, tLen * 0.18), 0.9));
      turretDark.push(part(box(0.3, 0.05, 0.56, tWid * 0.16, roofY + 0.32, tLen * 0.18), 0.6));
    }
  }
  // Housse de toile au pied du canon (chars anciens a tourelle).
  const gunGear: THREE.BufferGeometry[] = [];
  if (!modern && !casemate && !L.twinMG && !L.autocannon) {
    const cover = lumpy(new THREE.CylinderGeometry(gr * 1.75, gr * 2.6, 0.44, 12, 3), 0.1, 5);
    cover.rotateX(Math.PI / 2);
    cover.translate(0, 0, 0.2);
    gunGear.push(gear(cover, CANVAS_DARK));
  }
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, tip + 0.05);
  gun.add(muzzle);

  // --- Materiaux et maillages ---
  const camoTex = camoFor(def, opts.camo);
  const relief = reliefFor(def);
  const camoMat = new THREE.MeshLambertMaterial({ map: camoTex, vertexColors: true, bumpMap: relief, bumpScale: 2.2 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x3c3a36, vertexColors: true, bumpMap: relief, bumpScale: 1.2 });
  const gearMat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, bumpMap: relief, bumpScale: 0.8 });
  if (!trackTex) trackTex = makeTrackTexture();
  const trackTexL = trackTex.clone();
  const trackTexR = trackTex.clone();
  trackTexL.needsUpdate = true;
  trackTexR.needsUpdate = true;
  const trackMatL = new THREE.MeshLambertMaterial({ map: trackTexL, side: THREE.DoubleSide });
  const trackMatR = new THREE.MeshLambertMaterial({ map: trackTexR, side: THREE.DoubleSide });
  // Boue de la carte, crasse, epave : des reglages partages par tous les materiaux du char.
  if (!grimeTex) grimeTex = makeGrimeTexture();
  const dirt = opts.dirt ?? { color: [0.42, 0.37, 0.29] as [number, number, number], amount: 0.45 };
  const shading: TankShading = {
    uDirt: { value: new THREE.Color().setRGB(dirt.color[0], dirt.color[1], dirt.color[2], THREE.SRGBColorSpace) },
    uDirtAmount: { value: dirt.amount },
    uWreck: { value: 0 },
    uNoise: { value: grimeTex },
  };
  enhance(camoMat, shading, 0.22);
  enhance(darkMat, shading, 0.42);
  enhance(gearMat, shading, 0.06);
  // Chenilles : acier plus sombre et boue plus foncee (humide, tassee dans les patins).
  const trackShading: TankShading = { ...shading, uDirt: { value: shading.uDirt.value.clone().multiplyScalar(0.55) } };
  trackMatL.color.setHex(0x8a8a8a);
  trackMatR.color.setHex(0x8a8a8a);
  enhance(trackMatL, trackShading, 0.14);
  enhance(trackMatR, trackShading, 0.14);

  const root = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  // Boue : pleine au ras du sol, plus rien au-dessus du milieu de la caisse ;
  // un voile de poussiere sur tout ce qui est a plat.
  const dirtTop = c + H * 0.85;
  const addMesh = (parent: THREE.Object3D, list: THREE.BufferGeometry[], mat: THREE.Material, yOffset: number) => {
    if (list.length === 0) return;
    const g = mergeGeometries(list, false)!;
    for (const p of list) p.dispose();
    const pos = g.getAttribute("position");
    const nor = g.getAttribute("normal");
    const grime = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      let d = Math.pow(Math.max(0, 1 - (pos.getY(i) + yOffset) / dirtTop), 1.5);
      if (nor.getY(i) > 0.8) d = Math.max(d, 0.3);
      grime[i] = d;
    }
    g.setAttribute("dirt", new THREE.BufferAttribute(grime, 1));
    geos.push(g);
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
  };
  addMesh(root, camoParts, camoMat, 0);
  addMesh(root, darkParts, darkMat, 0);
  addMesh(root, gearParts, gearMat, 0);
  for (const [k, tg] of tracks.entries()) {
    // Les chenilles sont crottees par plaques.
    tg.setAttribute("dirt", new THREE.BufferAttribute(new Float32Array(tg.getAttribute("position").count).fill(0.48), 1));
    geos.push(tg);
    const m = new THREE.Mesh(tg, k === 0 ? trackMatL : trackMatR);
    m.castShadow = true;
    root.add(m);
  }
  const turretLift = turret.position.y;
  addMesh(turret, turretParts, camoMat, turretLift);
  addMesh(turret, turretDark, darkMat, turretLift);
  addMesh(turret, turretGear, gearMat, turretLift);
  addMesh(gun, gunParts, camoMat, turretLift + gun.position.y);
  addMesh(gun, gunDark, darkMat, turretLift + gun.position.y);
  addMesh(gun, gunGear, gearMat, turretLift + gun.position.y);
  if (barrelParts.length) {
    addMesh(barrels, barrelParts, darkMat, turretLift + gun.position.y);
    gun.add(barrels);
  }
  turret.add(gun);
  // La tourelle repose sur un support : l'explosion d'une epave peut la deloger.
  const mount = new THREE.Group();
  mount.add(turret);
  root.add(mount);

  // Numeros tactiques peints sur les flancs de la tourelle (ou de la casemate).
  const number = opts.number ?? String(100 + ((def.id.charCodeAt(0) * 37 + def.tier * 11) % 800));
  const numberTex = makeNumberTexture(number, modern ? "rgba(20,22,20,0.85)" : "rgba(236,232,214,0.9)", number.length * 97 + def.tier);
  const numberMat = new THREE.MeshLambertMaterial({
    map: numberTex,
    transparent: true,
    alphaTest: 0.35,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  {
    const planes: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      const p = new THREE.PlaneGeometry(0.62, 0.31);
      p.rotateY(side * Math.PI / 2);
      if (casemate) p.translate(side * (tWid / 2 - sIn * 0.5 + 0.03), deckY + tHei * 0.5, (cmFront + cmRear) / 2);
      else p.translate(side * (tWid / 2 - sIn * 0.5 + 0.03), tHei * 0.52, -tLen * 0.12);
      planes.push(p);
    }
    const g = mergeGeometries(planes, false)!;
    for (const p of planes) p.dispose();
    geos.push(g);
    const mesh = new THREE.Mesh(g, numberMat);
    (casemate ? root : turret).add(mesh);
  }

  // Gueule de requin peinte sur le fut arrondi de la tourelle, de chaque cote de l'avant.
  let sharkMat: THREE.MeshLambertMaterial | null = null;
  let sharkTex: THREE.CanvasTexture | null = null;
  if (L.sharkMouth && L.turretShape === "arrondie") {
    sharkTex = makeSharkTexture();
    sharkMat = new THREE.MeshLambertMaterial({
      map: sharkTex,
      transparent: true,
      alphaTest: 0.3,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
    });
    const bands: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      // Une bande du fut elliptique, un peu decollee ; la gueule s'ouvre vers l'avant des deux cotes (u = 1 devant).
      const start = side > 0 ? 0.18 : -1.5;
      const band = new THREE.CylinderGeometry(1.012, 1.052, tHei * 0.36, 16, 1, true, start, 1.32);
      band.scale(tWid / 2, 1, tLen / 2);
      band.translate(0, tHei * 0.21, 0);
      const uv = band.getAttribute("uv");
      for (let k = 0; k < uv.count; k++) if (side > 0) uv.setX(k, 1 - uv.getX(k));
      bands.push(band);
    }
    const g = mergeGeometries(bands, false)!;
    for (const b of bands) b.dispose();
    geos.push(g);
    turret.add(new THREE.Mesh(g, sharkMat));
  }

  // Boites de collision des obus.
  const hullCenter = new THREE.Vector3(0, (0.1 + deckY) / 2, 0);
  const hullHalf = new THREE.Vector3(W / 2, (deckY - 0.1) / 2, len / 2);
  const turretCenter = casemate
    ? new THREE.Vector3(0, deckY + tHei / 2, (cmFront + cmRear) / 2)
    : new THREE.Vector3(0, tHei / 2 + 0.05, 0);
  const turretHalf = new THREE.Vector3(tWid / 2, tHei / 2 + 0.05, tLen / 2);

  // Echappement : le bout des pots (anciens) ou la grille du pont arriere (modernes).
  const exhausts = modern
    ? [new THREE.Vector3(-W * 0.18, rearDeck + 0.12, -len * 0.46), new THREE.Vector3(W * 0.18, rearDeck + 0.12, -len * 0.46)]
    : [-1, 1].map((side) => new THREE.Vector3(side * 0.73, c + H * 0.62, -len / 2 - 0.38));

  let offL = 0;
  let offR = 0;
  let spinRate = 0;
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
    exhausts,
    spin: (dt, firing) => {
      if (!barrelParts.length) return;
      spinRate += ((firing ? 34 : 0) - spinRate) * Math.min(1, dt * (firing ? 6 : 1.2));
      barrels.rotation.z += spinRate * dt;
    },
    roll: (left, right) => {
      offL = (offL + left / 0.16) % 1000;
      offR = (offR + right / 0.16) % 1000;
      trackTexL.offset.y = -offL;
      trackTexR.offset.y = -offR;
    },
    setWrecked: () => {
      shading.uWreck.value = 1;
      trackMatL.color.setHex(0x5a5650);
      trackMatR.color.setHex(0x5a5650);
      numberMat.color.setHex(0x3a3632);
      // Une fois sur trois, l'explosion des munitions deloge la tourelle.
      if (casemate) return;
      const roll = Math.random();
      if (roll < 0.17) {
        // Projetee a cote du char, couchee de travers au sol.
        const side = Math.random() < 0.5 ? -1 : 1;
        mount.rotation.set((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 1.6, side * (0.4 + Math.random() * 0.25));
        mount.position.set(side * (W / 2 + tWid * 0.9), -turret.position.y * 0.9 + 0.2, (Math.random() - 0.5) * len * 0.4);
      } else if (roll < 0.34) {
        // Soulevee et de travers sur son anneau.
        mount.rotation.set((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.4);
        mount.position.set((Math.random() - 0.5) * 0.4, 0.3 + Math.random() * 0.2, (Math.random() - 0.5) * 0.4);
      }
    },
    dispose: () => {
      for (const g of geos) g.dispose();
      camoMat.dispose();
      darkMat.dispose();
      gearMat.dispose();
      trackMatL.dispose();
      trackMatR.dispose();
      trackTexL.dispose();
      trackTexR.dispose();
      numberMat.dispose();
      numberTex.dispose();
      sharkMat?.dispose();
      sharkTex?.dispose();
    },
  };
}
