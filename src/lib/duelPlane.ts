import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { IslandMap } from "./duelIsland";

// L'avion de la battle royale et le saut en parachute.
//
// Tout le monde part dans le meme avion, qui traverse l'ile en ligne droite
// a haute altitude. Chacun saute quand il veut (Espace) : chute libre rapide,
// puis parachute, et on se pose ou l'on a su se diriger. Les bots choisissent
// un endroit et sautent quand l'avion passe au plus pres.
//
// Les distances de la route sont en cases (comme le reste du Duel), les
// hauteurs et les vitesses de chute en metres.

/** Altitude de l'avion, en metres. */
export const PLANE_ALTITUDE = 95;
/** Vitesse de l'avion, en cases par seconde (une traversee dure une demi-minute). */
export const PLANE_SPEED = 7.5;
/** Chute libre : vitesse de descente et vitesse de vol plane maximale, en m/s. */
export const FREEFALL_SINK = 16;
export const FREEFALL_GLIDE = 15;
/** Le parachute s'ouvre tout seul a cette hauteur (metres) si on ne l'a pas ouvert avant. */
export const CHUTE_AUTO_OPEN = 24;
/** Sous le parachute : descente lente, on plane moins vite. */
export const CHUTE_SINK = 5;
export const CHUTE_GLIDE = 6.5;
/** Temps d'ouverture de la voile, en secondes. */
export const CHUTE_OPEN_SECONDS = 0.6;

export interface PlaneRoute {
  /** Depart et arrivee, en cases (hors de l'ile). */
  ax: number;
  az: number;
  bx: number;
  bz: number;
  /** Longueur en cases et duree de la traversee en secondes. */
  length: number;
  duration: number;
  /** Fraction du trajet ou l'avion arrive au-dessus de l'ile, et ou il la quitte. */
  enterT: number;
  exitT: number;
  /** Cap de l'avion (0 = vers +Z), en radians. */
  yaw: number;
}

/**
 * Une route au hasard : une droite qui traverse l'ile en passant a moins d'un
 * tiers du rayon du centre, pour que tout le monde ait le temps de viser.
 */
export function makePlaneRoute(island: IslandMap, rnd: () => number): PlaneRoute {
  const cx = island.width / 2;
  const cz = island.height / 2;
  const a = rnd() * Math.PI * 2;
  const dx = Math.cos(a);
  const dz = Math.sin(a);
  const offset = (rnd() - 0.5) * island.radius * 0.66;
  const ox = cx - dz * offset;
  const oz = cz + dx * offset;
  const half = island.radius * 1.45;
  const length = half * 2;
  const chord = Math.sqrt(Math.max(1, island.radius * island.radius - offset * offset));
  return {
    ax: ox - dx * half,
    az: oz - dz * half,
    bx: ox + dx * half,
    bz: oz + dz * half,
    length,
    duration: length / PLANE_SPEED,
    enterT: (half - chord) / length,
    exitT: (half + chord) / length,
    yaw: Math.atan2(dx, dz),
  };
}

/** Position sur la route a la fraction `t` (0 = depart, 1 = arrivee), en cases. */
export function routePoint(route: PlaneRoute, t: number, out: { x: number; z: number }) {
  out.x = route.ax + (route.bx - route.ax) * t;
  out.z = route.az + (route.bz - route.az) * t;
  return out;
}

/**
 * Quand sauter pour atterrir pres de (tx, tz) : au point de la route le plus
 * proche, sans sortir de la partie au-dessus de l'ile.
 */
export function jumpParamFor(route: PlaneRoute, tx: number, tz: number): number {
  const vx = route.bx - route.ax;
  const vz = route.bz - route.az;
  const t = ((tx - route.ax) * vx + (tz - route.az) * vz) / (route.length * route.length);
  return THREE.MathUtils.clamp(t, route.enterT + 0.01, route.exitT - 0.04);
}

// ------------------------------------------------------------------ modele

/** Peint toute une geometrie d'une couleur (attribut de couleur de sommet). */
function paint(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const n = geo.getAttribute("position").count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

/** Garde seulement position, normale et couleur : mergeGeometries exige les memes attributs. */
function clean(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const name of Object.keys(g.attributes)) {
    if (name !== "position" && name !== "normal" && name !== "color") g.deleteAttribute(name);
  }
  return g;
}

export interface PlaneModel {
  group: THREE.Group;
  /** Fait tourner les helices. */
  update: (dt: number) => void;
  dispose: () => void;
}

/**
 * Un avion de transport a quatre helices, aile haute et rampe arriere ouverte
 * (c'est par la qu'on saute). Nez vers +Z, environ 25 m de long et 32 m
 * d'envergure. Une seule geometrie peinte pour tout le fixe, plus les helices.
 */
export function buildPlaneModel(): PlaneModel {
  const parts: THREE.BufferGeometry[] = [];
  const WHITE = 0xe9ecef;
  const GREY = 0x9aa3ab;
  const DARK = 0x3c434a;
  const STRIPE = 0x6b4de6;
  const GLASS = 0x1c2733;

  // Fuselage : un profil tourne autour de l'axe, puis couche le long de Z.
  const profile = [
    [0.05, -13.2],
    [0.55, -12.8],
    [1.1, -10.4],
    [1.6, -7.2],
    [1.85, -4],
    [1.9, 4.5],
    [1.8, 7.8],
    [1.5, 10],
    [1.02, 11.5],
    [0.4, 12.3],
    [0.02, 12.45],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.LatheGeometry(profile, 18);
  body.rotateX(Math.PI / 2);
  // Queue relevee, comme sur les vrais cargos : la rampe s'ouvre dessous.
  const pos = body.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  const col = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    const lift = z < -4 ? (-4 - z) * 0.16 : 0;
    const y = pos.getY(i) + lift;
    pos.setY(i, y);
    const rel = y - lift;
    // Dessus blanc, bande de couleur sur le flanc, ventre gris.
    if (rel > 0.95) col.set(WHITE);
    else if (rel > 0.45) col.set(STRIPE);
    else if (rel > -0.9) col.set(WHITE).multiplyScalar(0.93);
    else col.set(GREY);
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  body.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  body.computeVertexNormals();
  parts.push(clean(body));

  // Vitres du poste de pilotage et hublots.
  const cockpit = new THREE.BoxGeometry(2.3, 0.55, 1.2);
  cockpit.translate(0, 1.05, 10.6);
  parts.push(clean(paint(cockpit, GLASS)));
  for (let k = 0; k < 7; k++) {
    for (const side of [-1, 1]) {
      const win = new THREE.BoxGeometry(0.08, 0.34, 0.42);
      win.translate(side * 1.86, 0.7, 6.2 - k * 1.6);
      parts.push(clean(paint(win, GLASS)));
    }
  }

  // Aile haute, un peu en fleche, et saumons sombres.
  const wing = new THREE.BoxGeometry(32, 0.34, 3.6, 8, 1, 1);
  const wp = wing.getAttribute("position");
  for (let i = 0; i < wp.count; i++) {
    const x = wp.getX(i);
    // Le bord d'attaque recule vers le bout de l'aile, et l'aile s'affine.
    wp.setZ(i, wp.getZ(i) * (1 - Math.abs(x) * 0.018) - Math.abs(x) * 0.07);
    wp.setY(i, wp.getY(i) + Math.abs(x) * 0.025);
  }
  wing.computeVertexNormals();
  wing.translate(0, 1.72, 1.6);
  parts.push(clean(paint(wing, GREY)));
  for (const side of [-1, 1]) {
    const tip = new THREE.BoxGeometry(0.5, 0.38, 2.2);
    tip.translate(side * 16, 2.12, 0.5);
    parts.push(clean(paint(tip, DARK)));
  }

  // Quatre moteurs sous l'aile, avec leur cone d'helice.
  const engineX = [-10.2, -5.2, 5.2, 10.2];
  for (const x of engineX) {
    const nacelle = new THREE.CylinderGeometry(0.58, 0.66, 3.6, 12);
    nacelle.rotateX(Math.PI / 2);
    nacelle.translate(x, 1.25, 2.6);
    parts.push(clean(paint(nacelle, WHITE)));
    const spinner = new THREE.ConeGeometry(0.42, 0.9, 12);
    spinner.rotateX(Math.PI / 2);
    spinner.translate(x, 1.25, 4.85);
    parts.push(clean(paint(spinner, DARK)));
  }

  // Derive inclinee vers l'arriere, et empennage horizontal.
  const fin = new THREE.BoxGeometry(0.34, 4.8, 3.6);
  const fp = fin.getAttribute("position");
  for (let i = 0; i < fp.count; i++) {
    const y = fp.getY(i);
    fp.setZ(i, fp.getZ(i) - (y + 2.4) * 0.34 + (y > 0 ? 0.6 : 0));
  }
  fin.computeVertexNormals();
  fin.translate(0, 4.6, -10.2);
  parts.push(clean(paint(fin, WHITE)));
  const finStripe = new THREE.BoxGeometry(0.38, 0.7, 2.8);
  finStripe.translate(0, 5.6, -11.3);
  parts.push(clean(paint(finStripe, STRIPE)));
  const stab = new THREE.BoxGeometry(11.5, 0.24, 2.6);
  stab.translate(0, 2.9, -11.4);
  parts.push(clean(paint(stab, GREY)));

  // Rampe arriere baissee : on voit l'interieur sombre de la soute.
  const hold = new THREE.BoxGeometry(2.6, 0.1, 3.4);
  hold.rotateX(-0.42);
  hold.translate(0, -0.05, -10.6);
  parts.push(clean(paint(hold, DARK)));

  const merged = mergeGeometries(parts, false)!;
  for (const p of parts) p.dispose();
  const bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const group = new THREE.Group();
  group.add(new THREE.Mesh(merged, bodyMat));

  // Helices : trois pales, et un disque translucide qui fait le flou de rotation.
  const blade = new THREE.BoxGeometry(0.2, 3.3, 0.07);
  blade.translate(0, 1.65, 0);
  const blades: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 3; k++) {
    const b = blade.clone();
    b.rotateZ((k * Math.PI * 2) / 3);
    blades.push(b);
  }
  const propGeo = mergeGeometries(blades, false)!;
  blade.dispose();
  for (const b of blades) b.dispose();
  const propMat = new THREE.MeshLambertMaterial({ color: 0x2a2f35 });
  const discGeo = new THREE.CircleGeometry(1.75, 20);
  const discMat = new THREE.MeshBasicMaterial({
    color: 0x9aa3ab,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const props: THREE.Mesh[] = [];
  engineX.forEach((x, k) => {
    const prop = new THREE.Mesh(propGeo, propMat);
    prop.position.set(x, 1.25, 5.1);
    prop.rotation.z = k * 0.7;
    group.add(prop);
    props.push(prop);
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.set(x, 1.25, 5.12);
    group.add(disc);
  });

  return {
    group,
    update: (dt) => {
      for (let k = 0; k < props.length; k++) props[k].rotation.z += dt * (38 + k * 1.3);
    },
    dispose: () => {
      merged.dispose();
      bodyMat.dispose();
      propGeo.dispose();
      propMat.dispose();
      discGeo.dispose();
      discMat.dispose();
    },
  };
}

// --------------------------------------------------------------- parachutes

export interface Parachutes {
  mesh: THREE.InstancedMesh;
  /**
   * Pose la voile de l'instance `i` au-dessus d'un sauteur dont les pieds sont
   * en (x, y, z) (metres), cap `yaw`, ouverte a `open` (0 a 1).
   */
  place: (i: number, x: number, y: number, z: number, yaw: number, open: number) => void;
  hide: (i: number) => void;
  /** A appeler une fois par image apres les `place` / `hide`. */
  flush: () => void;
  dispose: () => void;
}

/** Couleurs vives des voiles : chacun la sienne, on se repere dans le ciel. */
const CANOPY_COLORS = [0xff5a36, 0x2f9bff, 0xffc233, 0x3fd07a, 0xb45cff, 0xff4f9a, 0x21d4c5, 0xff8f1f];

/**
 * Toutes les voiles dans un seul maillage instancie : trente sauteurs, un
 * appel de rendu. Voile rectangulaire cambree (parachute-aile), caissons en
 * bandes claires et sombres, et les suspentes jusqu'aux epaules.
 */
export function createParachutes(count: number): Parachutes {
  const parts: THREE.BufferGeometry[] = [];
  // La voile : 7 m d'envergure, 2,8 m de corde, bords qui retombent.
  const canopy = new THREE.BoxGeometry(7, 0.36, 2.8, 14, 1, 2);
  const cp = canopy.getAttribute("position");
  const cc = new Float32Array(cp.count * 3);
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i);
    cp.setY(i, cp.getY(i) - 0.085 * x * x);
    // Bandes : un caisson clair, un caisson sombre ; le dessous plus sombre.
    const cell = Math.floor((x + 3.5) / 1) % 2;
    const under = cp.getY(i) + 0.085 * x * x < 0 ? 0.78 : 1;
    const v = (cell === 0 ? 1 : 0.74) * under;
    cc[i * 3] = v;
    cc[i * 3 + 1] = v;
    cc[i * 3 + 2] = v;
  }
  canopy.setAttribute("color", new THREE.BufferAttribute(cc, 3));
  canopy.computeVertexNormals();
  canopy.translate(0, 4.6, 0);
  parts.push(clean(canopy));

  // Suspentes : de fins cordons entre le bord de la voile et les epaules.
  const harness = new THREE.Vector3(0, 0.15, 0);
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  for (const x of [-3.1, -1.6, 0, 1.6, 3.1]) {
    for (const z of [-0.9, 0.9]) {
      const top = new THREE.Vector3(x, 4.6 - 0.085 * x * x - 0.18, z);
      const dir = top.clone().sub(harness);
      const len = dir.length();
      const line = new THREE.BoxGeometry(0.035, len, 0.035);
      line.translate(0, len / 2, 0);
      q.setFromUnitVectors(up, dir.normalize());
      line.applyQuaternion(q);
      line.translate(harness.x, harness.y, harness.z);
      parts.push(clean(paint(line, 0x30343a)));
    }
  }
  const geo = mergeGeometries(parts, false)!;
  for (const p of parts) p.dispose();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, count));
  mesh.frustumCulled = false;
  mesh.count = Math.max(1, count);
  const tint = new THREE.Color();
  for (let i = 0; i < count; i++) mesh.setColorAt(i, tint.set(CANOPY_COLORS[i % CANOPY_COLORS.length]));
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  const m4 = new THREE.Matrix4();
  const q4 = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v3 = new THREE.Vector3();
  const s3 = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < count; i++) mesh.setMatrixAt(i, zero);
  let dirty = true;

  return {
    mesh,
    place: (i, x, y, z, yaw, open) => {
      if (i < 0 || i >= count) return;
      const k = THREE.MathUtils.clamp(open, 0, 1);
      // La voile se deploie : d'abord un chiffon, puis toute l'envergure.
      const sx = 0.15 + 0.85 * k * k;
      const sy = 0.4 + 0.6 * k;
      e.set(0, yaw, 0);
      q4.setFromEuler(e);
      // Les epaules sont a 1,45 m au-dessus des pieds.
      m4.compose(v3.set(x, y + 1.45, z), q4, s3.set(sx, sy, 0.3 + 0.7 * k));
      mesh.setMatrixAt(i, m4);
      dirty = true;
    },
    hide: (i) => {
      if (i < 0 || i >= count) return;
      mesh.setMatrixAt(i, zero);
      dirty = true;
    },
    flush: () => {
      if (!dirty) return;
      mesh.instanceMatrix.needsUpdate = true;
      dirty = false;
    },
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}
