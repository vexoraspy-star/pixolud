// Cubes — les monstres, facon Minecraft : zombie, squelette, araignee et
// explosif.
//
// Ce module ne connait pas le monde directement : la scene lui donne un
// MobWorld (collisions, lumiere, jour/nuit) et un MobEvents (blesser le
// joueur, exploser, donner le butin, jouer un son). Il gere tout le reste :
// apparition selon l'heure et l'obscurite, intelligence, physique, fleches,
// animations, mort et butin.
//
// Regles du Mode 3D respectees ici :
//   - MeshLambertMaterial (corps) et MeshBasicMaterial (yeux, flammes)
//     seulement, aucune lumiere ajoutee ;
//   - textures dessinees au canvas (8x8 pixels, filtrage « au plus proche ») ;
//   - lacet calcule a la main avec atan2, jamais lookAt ;
//   - rien d'alloue a chaque image : geometries et materiaux partages, un
//     seul materiau par monstre (teinte par la lumiere de sa case), un pool
//     fixe de fleches.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createAnimatedModel, type AnimatedModel, type ModelId } from "./models3d";
import { WORLD_HEIGHT } from "./voxel";
import { CHAIR_POURRIE, FICELLE, FLECHE, OS, POUDRE } from "./voxelItems";

export type MobKind = "zombie" | "squelette" | "araignee" | "explosif";

export interface MobWorld {
  /** Collision d'une boite (pieds en y, hauteur h, rayon r) avec les blocs solides. */
  collides(x: number, y: number, z: number, h: number, r: number): boolean;
  /** Le chunk est charge. */
  isLoaded(x: number, z: number): boolean;
  /** Bloc solide dans la case entiere (x,y,z). */
  solidAt(x: number, y: number, z: number): boolean;
  /** Liquide dans la case. */
  liquidAt(x: number, y: number, z: number): boolean;
  /** Niveaux de lumiere 0..15 de la case : ciel (combine) et blocs (torches). */
  lightLevels(x: number, y: number, z: number): { sky: number; block: number };
  /** Luminosite 0..1 a appliquer aux materiaux (deja ajustee jour/nuit). */
  brightness(x: number, y: number, z: number): number;
  /** Vrai pendant la journee. */
  isDay(): boolean;
}

export interface MobEvents {
  hurtPlayer(amount: number, cause: string, fromX: number, fromZ: number): void;
  /** La scene casse les blocs et blesse le joueur. */
  explode(x: number, y: number, z: number, radius: number): void;
  drop(x: number, y: number, z: number, thing: number, count: number): void;
  sound(kind: "zombie" | "squelette" | "araignee" | "meche" | "touche" | "mort" | "fleche"): void;
}

export interface Mobs {
  /** A appeler souvent : fait apparaitre (ou non) un monstre pres du joueur selon l'heure et l'obscurite. Max 8 monstres. */
  trySpawn(player: { x: number; y: number; z: number }): void;
  spawn(kind: MobKind, x: number, y: number, z: number): void;
  update(dt: number, player: { x: number; y: number; z: number; yaw: number }): void;
  /** Coup au corps a corps : rayon depuis l'oeil. Renvoie vrai si un monstre est touche (degats, recul, eclat rouge). */
  hitMelee(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, reach: number, damage: number): boolean;
  /** Distance du monstre vise le plus proche le long du rayon (Infinity si aucun) : sert a ne pas casser le bloc derriere. */
  rayDistance(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, reach: number): number;
  /** Fleche tiree par le joueur (vitesse en blocs/s). */
  shootArrow(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, speed: number): void;
  count(): number;
  /** Retire tout (reapparition du joueur). */
  clear(): void;
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Reglages
// ---------------------------------------------------------------------------

/** Monstres en meme temps, par apparition naturelle. */
const MAX_MOBS = 8;
/** Plafond absolu, meme en les faisant apparaitre a la main. */
const HARD_CAP = 16;
/** Au-dela, un monstre est retire sans bruit. */
const DESPAWN = 64;
const GRAVITY = 22;
const ARROW_GRAVITY = 20;
const ARROW_POOL = 24;
/** Duree de vie d'une fleche plantee, puis d'une fleche en vol. */
const ARROW_STUCK = 10;
const ARROW_FLIGHT = 8;
const SKELETON_ARROW_SPEED = 18;
const SKELETON_ARROW_DAMAGE = 10;
/** Duree de la meche de l'explosif, en secondes. */
const FUSE = 1.5;
const RED = 0xff3030;
/** Duree de l'eclat rouge apres un coup. */
const HIT_FLASH = 0.35;
/** Duree de la bascule au sol a la mort. */
const FALL = 0.6;
/** Vitesse de rotation du corps (radians par seconde). */
const TURN = 9;

interface KindSpec {
  hp: number;
  /** Hauteur et rayon de la boite de collision. */
  h: number;
  r: number;
  /** Hauteur des yeux (ligne de vue, regard). */
  eye: number;
  speed: number;
  wander: number;
  /** Distance a laquelle il poursuit le joueur. */
  follow: number;
  damage: number;
  /** Portee du coup au contact (distance horizontale). */
  reach: number;
  /** Saute des obstacles de deux blocs. */
  jump2: boolean;
  /** Brule au soleil. */
  burns: boolean;
  /** Foulees : radians de cycle par bloc parcouru. */
  stride: number;
}

const SPECS: Record<MobKind, KindSpec> = {
  zombie: { hp: 20, h: 1.8, r: 0.3, eye: 1.6, speed: 1.4, wander: 0.6, follow: 32, damage: 12, reach: 1.3, jump2: false, burns: true, stride: 4.5 },
  squelette: { hp: 20, h: 1.8, r: 0.3, eye: 1.6, speed: 1.3, wander: 0.6, follow: 20, damage: 0, reach: 0, jump2: false, burns: true, stride: 4.5 },
  araignee: { hp: 16, h: 0.9, r: 0.45, eye: 0.55, speed: 2.6, wander: 0.8, follow: 20, damage: 8, reach: 1.45, jump2: true, burns: false, stride: 5 },
  explosif: { hp: 20, h: 1.6, r: 0.3, eye: 1.4, speed: 1.3, wander: 0.6, follow: 16, damage: 0, reach: 0, jump2: false, burns: false, stride: 5 },
};

/** Taille d'un « pixel » de modele, en blocs, par espece. */
const ZP = 1.8 / 32;
const CP = 1.6 / 26;
const SP = 0.055;

/** Pattes de l'araignee : position le long du corps et ecart (cote droit, de l'avant vers l'arriere). */
const LEG_Z = [2, 0.7, -0.7, -2];
const LEG_YAW = [-0.75, -0.25, 0.25, 0.75];
const LEG_DROOP = 0.6;

// Couleurs (sRGB)
const Z_SKIN = 0x5b8f45, Z_SKIN_DARK = 0x456f35, Z_SHIRT = 0x2f7fa6, Z_PANTS = 0x4a3f92, Z_SHOES = 0x3a3a3e, Z_EYE = 0x121812;
const S_BONE = 0xd8d4c5, S_BONE_DARK = 0xa9a495, S_CAVITY = 0x3b3935, S_SOCKET = 0x1c1b19, S_WOOD = 0x6b4a2b, S_STRING = 0xe9e5d8;
const A_THORAX = 0x3a3330, A_ABDO = 0x2c2622, A_PATTERN = 0x5a4c40, A_HEAD = 0x2f2926, A_LEG = 0x3b332e;
const WHITE = 0xffffff, C_FACE = 0x101410;

// ---------------------------------------------------------------------------
// Petits outils (sans allocation)
// ---------------------------------------------------------------------------

const tmpColor = new THREE.Color();
let uvShift = 0;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Angle ramene dans ]-pi, pi]. */
function wrap(a: number): number {
  return a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2));
}

/** Generateur pseudo-aleatoire a graine (textures identiques d'une partie a l'autre). */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Distance d'entree d'un rayon (direction unitaire) dans une boite alignee,
 * Infinity s'il la manque. Methode des « dalles ».
 */
function rayBox(
  ox: number, oy: number, oz: number, dx: number, dy: number, dz: number,
  x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
): number {
  let tmin = 0, tmax = Infinity;
  if (Math.abs(dx) < 1e-9) {
    if (ox < x0 || ox > x1) return Infinity;
  } else {
    const a = (x0 - ox) / dx, b = (x1 - ox) / dx;
    tmin = Math.max(tmin, Math.min(a, b));
    tmax = Math.min(tmax, Math.max(a, b));
  }
  if (Math.abs(dy) < 1e-9) {
    if (oy < y0 || oy > y1) return Infinity;
  } else {
    const a = (y0 - oy) / dy, b = (y1 - oy) / dy;
    tmin = Math.max(tmin, Math.min(a, b));
    tmax = Math.min(tmax, Math.max(a, b));
  }
  if (Math.abs(dz) < 1e-9) {
    if (oz < z0 || oz > z1) return Infinity;
  } else {
    const a = (z0 - oz) / dz, b = (z1 - oz) / dz;
    tmin = Math.max(tmin, Math.min(a, b));
    tmax = Math.min(tmax, Math.max(a, b));
  }
  return tmin <= tmax ? tmin : Infinity;
}

// ---------------------------------------------------------------------------
// Geometries en cubes
// ---------------------------------------------------------------------------

/**
 * Pave mesure en « pixels » de modele (p : taille d'un pixel en blocs),
 * centre en (cx, cy, cz) et colore par sommet. Les UV sont a l'echelle : un
 * texel de la texture 8x8 couvre un pixel du modele, comme dans le jeu
 * d'origine, et chaque pave commence a un endroit different de la texture.
 */
function box(p: number, w: number, h: number, d: number, cx: number, cy: number, cz: number, hex: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w * p, h * p, d * p);
  g.translate(cx * p, cy * p, cz * p);
  g.clearGroups();
  // Faces dans l'ordre de BoxGeometry : +x, -x, +y, -y, +z, -z (4 sommets chacune).
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  const sizes = [d, h, d, h, w, d, w, d, w, h, w, h];
  uvShift = (uvShift + 3) % 8;
  const su = uvShift / 8, sv = ((uvShift * 5) % 8) / 8;
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, (uv.getX(i) * sizes[f * 2]) / 8 + su, (uv.getY(i) * sizes[f * 2 + 1]) / 8 + sv);
    }
  }
  tmpColor.setHex(hex);
  const n = g.getAttribute("position").count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!g) throw new Error("voxelMobs : fusion de geometries impossible");
  return g;
}

/** Arc du squelette, accroche a la main (en pixels de bras, le bras pendant vers -y). */
function bowParts(): THREE.BufferGeometry[] {
  const parts = [box(ZP, 1.4, 1.4, 2.4, 0, -9, 0, S_WOOD)];
  for (const s of [1, -1]) {
    parts.push(box(ZP, 1, 1, 3, 0, -9, 2.7 * s, S_WOOD));
    parts.push(box(ZP, 1, 1, 2.4, 0, -8.3, 5.3 * s, S_WOOD));
    parts.push(box(ZP, 1, 1, 2, 0, -7.4, 7.3 * s, S_WOOD));
  }
  // La corde, du cote du tireur (+y local quand le bras est tendu).
  parts.push(box(ZP, 0.3, 0.3, 16.4, 0, -6.9, 0, S_STRING));
  return parts;
}

function buildGeometries() {
  return {
    // Zombie : tete verte, corps bleu, jambes violettes.
    zHead: merge([
      box(ZP, 8, 8, 8, 0, 4, 0, Z_SKIN),
      box(ZP, 2, 1, 0.3, -2, 4.5, 4.15, Z_EYE),
      box(ZP, 2, 1, 0.3, 2, 4.5, 4.15, Z_EYE),
      box(ZP, 4, 1, 0.3, 0, 1.5, 4.15, Z_SKIN_DARK),
    ]),
    zBody: box(ZP, 8, 12, 4, 0, 0, 0, Z_SHIRT),
    zArm: merge([box(ZP, 4, 4, 4, 0, 0, 0, Z_SHIRT), box(ZP, 4, 8, 4, 0, -6, 0, Z_SKIN)]),
    zLeg: merge([box(ZP, 4, 10, 4, 0, -5, 0, Z_PANTS), box(ZP, 4, 2, 4, 0, -11, 0, Z_SHOES)]),
    // Squelette : os fins, cage thoracique a claire-voie, arc en main.
    sHead: merge([
      box(ZP, 8, 8, 8, 0, 4, 0, S_BONE),
      box(ZP, 2, 2, 0.3, -2, 4.5, 4.15, S_SOCKET),
      box(ZP, 2, 2, 0.3, 2, 4.5, 4.15, S_SOCKET),
      box(ZP, 1, 1, 0.3, 0, 3, 4.15, S_SOCKET),
      box(ZP, 5, 0.6, 0.3, 0, 1.4, 4.15, S_SOCKET),
    ]),
    sBody: merge([
      box(ZP, 6, 8, 2, 0, 1, 0, S_CAVITY),
      box(ZP, 2, 12, 2, 0, 0, -0.9, S_BONE_DARK),
      box(ZP, 8, 1.5, 3, 0, 5.25, 0, S_BONE),
      box(ZP, 8, 1, 3, 0, 3, 0, S_BONE),
      box(ZP, 8, 1, 3, 0, 1, 0, S_BONE),
      box(ZP, 7, 1, 3, 0, -1, 0, S_BONE),
      box(ZP, 7, 2, 3, 0, -5, 0, S_BONE),
    ]),
    sArm: box(ZP, 2, 12, 2, 0, -4, 0, S_BONE),
    sArmBow: merge([box(ZP, 2, 12, 2, 0, -4, 0, S_BONE), ...bowParts()]),
    sLeg: box(ZP, 2, 12, 2, 0, -6, 0, S_BONE),
    // Araignee : large et basse, huit pattes, yeux rouges.
    aBody: merge([
      box(SP, 6, 6, 6, 0, 0, 0, A_THORAX),
      box(SP, 10, 8, 12, 0, 1, -9, A_ABDO),
      box(SP, 4, 0.4, 8, 0, 5.2, -9, A_PATTERN),
      box(SP, 8, 0.4, 2, 0, 5.2, -6, A_PATTERN),
      box(SP, 8, 0.4, 2, 0, 5.2, -11, A_PATTERN),
    ]),
    aHead: box(SP, 8, 8, 8, 0, 0, 4, A_HEAD),
    aEyes: merge([
      box(SP, 2, 2, 0.3, -1.8, 0.5, 8.15, WHITE),
      box(SP, 2, 2, 0.3, 1.8, 0.5, 8.15, WHITE),
      box(SP, 1, 1, 0.3, -3, 2.2, 8.15, WHITE),
      box(SP, 1, 1, 0.3, 3, 2.2, 8.15, WHITE),
      box(SP, 1, 1, 0.3, -1, 2.6, 8.15, WHITE),
      box(SP, 1, 1, 0.3, 1, 2.6, 8.15, WHITE),
    ]),
    aLegR: box(SP, 16, 1.6, 1.6, 8, 0, 0, A_LEG),
    aLegL: box(SP, 16, 1.6, 1.6, -8, 0, 0, A_LEG),
    // Explosif : la texture verte tachetee fait tout, le visage est en creux sombre.
    cHead: merge([
      box(CP, 8, 8, 8, 0, 4, 0, WHITE),
      box(CP, 2, 2, 0.3, -2, 5, 4.15, C_FACE),
      box(CP, 2, 2, 0.3, 2, 5, 4.15, C_FACE),
      box(CP, 2, 1, 0.3, 0, 3.5, 4.15, C_FACE),
      box(CP, 4, 2, 0.3, 0, 2, 4.15, C_FACE),
      box(CP, 1, 1, 0.3, -1.5, 0.5, 4.15, C_FACE),
      box(CP, 1, 1, 0.3, 1.5, 0.5, 4.15, C_FACE),
    ]),
    cBody: box(CP, 8, 12, 4, 0, 0, 0, WHITE),
    cLeg: box(CP, 4, 6, 4, 0, -3, 0, WHITE),
    // Fleche : pointe en z = 0, le baton vers -z.
    arrow: merge([
      box(1, 0.035, 0.035, 0.52, 0, 0, -0.32, 0x8b6a45),
      box(1, 0.07, 0.07, 0.09, 0, 0, -0.045, 0x9a9ea3),
      box(1, 0.13, 0.012, 0.13, 0, 0, -0.52, 0xf0ece0),
      box(1, 0.012, 0.13, 0.13, 0, 0, -0.52, 0xf0ece0),
    ]),
    // Flamme : base en y = 0 pour grandir vers le haut.
    flame: new THREE.BoxGeometry(0.14, 0.26, 0.14).translate(0, 0.13, 0),
  };
}

type Geometries = ReturnType<typeof buildGeometries>;

// ---------------------------------------------------------------------------
// Textures 8x8 dessinees au canvas
// ---------------------------------------------------------------------------

function pixelTexture(seed: number, pick: (rand: () => number) => string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 8;
  const ctx = canvas.getContext("2d");
  const rand = seeded(seed);
  if (ctx) {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        ctx.fillStyle = pick(rand);
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Grain gris clair : multiplie les couleurs des sommets, donne l'aspect « pixel ». */
function grainTexture(): THREE.CanvasTexture {
  return pixelTexture(7, (rand) => {
    const r = rand();
    const v = Math.round(255 * (r < 0.12 ? 0.74 + rand() * 0.06 : 0.86 + rand() * 0.14));
    return `rgb(${v},${v},${v})`;
  });
}

/** Vert tachete de l'explosif. */
function creeperTexture(): THREE.CanvasTexture {
  const palette = ["#5dbb4b", "#4fa53f", "#58b048", "#3f8f34", "#6fcf5c", "#2f7a2a", "#8ad97a", "#9fdc92"];
  const weights = [0.24, 0.2, 0.16, 0.12, 0.1, 0.07, 0.07, 0.04];
  return pixelTexture(1337, (rand) => {
    let r = rand();
    for (let i = 0; i < palette.length; i++) {
      r -= weights[i];
      if (r <= 0) return palette[i];
    }
    return palette[0];
  });
}

// ---------------------------------------------------------------------------
// Modeles en cubes
// ---------------------------------------------------------------------------

interface Rig {
  root: THREE.Group;
  /** Un materiau par monstre : teinte par la lumiere, eclat rouge. */
  material: THREE.MeshLambertMaterial;
  head: THREE.Object3D;
  legs: THREE.Object3D[];
  arms: THREE.Object3D[];
}

function buildRig(kind: MobKind, material: THREE.MeshLambertMaterial, G: Geometries, eyeMaterial: THREE.Material): Rig {
  const root = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number, mat: THREE.Material = material, parent: THREE.Object3D = root) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  switch (kind) {
    case "zombie": {
      const legs = [add(G.zLeg, 2 * ZP, 12 * ZP, 0), add(G.zLeg, -2 * ZP, 12 * ZP, 0)];
      add(G.zBody, 0, 18 * ZP, 0);
      const arms = [add(G.zArm, 6 * ZP, 22 * ZP, 0), add(G.zArm, -6 * ZP, 22 * ZP, 0)];
      const head = add(G.zHead, 0, 24 * ZP, 0);
      head.rotation.order = "YXZ";
      for (const a of arms) a.rotation.order = "YXZ";
      return { root, material, head, legs, arms };
    }
    case "squelette": {
      const legs = [add(G.sLeg, 2 * ZP, 12 * ZP, 0), add(G.sLeg, -2 * ZP, 12 * ZP, 0)];
      add(G.sBody, 0, 18 * ZP, 0);
      // Bras gauche (+x) puis bras droit (-x), qui tient l'arc.
      const arms = [add(G.sArm, 5 * ZP, 22 * ZP, 0), add(G.sArmBow, -5 * ZP, 22 * ZP, 0)];
      const head = add(G.sHead, 0, 24 * ZP, 0);
      head.rotation.order = "YXZ";
      for (const a of arms) a.rotation.order = "YXZ";
      return { root, material, head, legs, arms };
    }
    case "araignee": {
      add(G.aBody, 0, 9 * SP, 0);
      const head = add(G.aHead, 0, 9 * SP, 3 * SP);
      head.rotation.order = "YXZ";
      add(G.aEyes, 0, 0, 0, eyeMaterial, head);
      const legs: THREE.Object3D[] = [];
      for (let side = 0; side < 2; side++) {
        for (let k = 0; k < 4; k++) {
          const leg = add(side === 0 ? G.aLegR : G.aLegL, (side === 0 ? 3 : -3) * SP, 9 * SP, LEG_Z[k] * SP);
          // Lacet puis inclinaison vers le sol, dans le repere de la patte.
          leg.rotation.order = "YZX";
          const sign = side === 0 ? 1 : -1;
          leg.rotation.y = LEG_YAW[k] * sign;
          leg.rotation.z = -sign * LEG_DROOP;
          legs.push(leg);
        }
      }
      return { root, material, head, legs, arms: [] };
    }
    case "explosif": {
      // Avant-gauche, avant-droite, arriere-gauche, arriere-droite.
      const legs = [
        add(G.cLeg, 2 * CP, 6 * CP, 4 * CP),
        add(G.cLeg, -2 * CP, 6 * CP, 4 * CP),
        add(G.cLeg, 2 * CP, 6 * CP, -4 * CP),
        add(G.cLeg, -2 * CP, 6 * CP, -4 * CP),
      ];
      add(G.cBody, 0, 12 * CP, 0);
      const head = add(G.cHead, 0, 18 * CP, 0);
      head.rotation.order = "YXZ";
      return { root, material, head, legs, arms: [] };
    }
  }
}

// ---------------------------------------------------------------------------
// Etat d'un monstre et d'une fleche
// ---------------------------------------------------------------------------

interface ClipNames {
  walk: string | null;
  idle: string | null;
  attack: string | null;
  hit: string | null;
  death: string | null;
}

interface Mob {
  kind: MobKind;
  spec: KindSpec;
  /** Position (pieds) et lacet. */
  group: THREE.Group;
  /** Bascule au sol a la mort, gonflement de l'explosif. */
  tilt: THREE.Group;
  rig: Rig;
  model: AnimatedModel | null;
  clips: ClipNames | null;
  modelMats: THREE.MeshLambertMaterial[];
  modelBase: THREE.Color[];
  flames: THREE.Group | null;
  seed: number;
  hp: number;
  vy: number;
  /** Recul (blocs/s), amorti. */
  kx: number;
  kz: number;
  grounded: boolean;
  yaw: number;
  headYaw: number;
  headPitch: number;
  walkPhase: number;
  walkAmt: number;
  dist: number;
  attackCd: number;
  /** Geste en cours (coup, tir) : temps restant. */
  gesture: number;
  /** Animation .glb non interruptible (attaque). */
  animLock: number;
  flashT: number;
  dying: boolean;
  dieT: number;
  dieDuration: number;
  killed: boolean;
  removed: boolean;
  burning: boolean;
  burnT: number;
  envT: number;
  sees: boolean;
  lastSeen: number;
  aware: boolean;
  calm: boolean;
  provoked: boolean;
  wanderT: number;
  wanderX: number;
  wanderZ: number;
  wanderSpeed: number;
  stuckT: number;
  /** Contournement d'un mur : temps restant, temps ecoule, cote (1 ou -1). */
  detourT: number;
  detourAge: number;
  detourSide: number;
  soundT: number;
  fusing: boolean;
  fuseT: number;
  shootT: number;
  strafeT: number;
  strafeDir: number;
  pounceT: number;
  bright: number;
}

interface Arrow {
  mesh: THREE.Mesh;
  active: boolean;
  fromPlayer: boolean;
  stuck: boolean;
  /** Position de la pointe. */
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Tireur (d'ou vient le recul du joueur touche). */
  ox: number;
  oz: number;
  age: number;
  life: number;
  check: number;
  /** Case du bloc ou la fleche est plantee. */
  cx: number;
  cy: number;
  cz: number;
  born: number;
}

function disposeModel(model: AnimatedModel) {
  model.dispose();
  const skeletons = new Set<THREE.Skeleton>();
  model.root.traverse((o) => {
    const skinned = o as THREE.SkinnedMesh;
    if (skinned.isSkinnedMesh) skeletons.add(skinned.skeleton);
  });
  for (const s of skeletons) s.dispose();
  model.root.removeFromParent();
}

function firstClip(model: AnimatedModel, names: string[]): string | null {
  for (const n of names) if (model.has(n)) return n;
  return null;
}

// ---------------------------------------------------------------------------
// Le gestionnaire
// ---------------------------------------------------------------------------

export function createMobs(scene: THREE.Scene, world: MobWorld, events: MobEvents): Mobs {
  const G = buildGeometries();
  const grainTex = grainTexture();
  const creeperTex = creeperTexture();
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  const arrowMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
  const flameOuter = new THREE.MeshBasicMaterial({ color: 0xff7a18, transparent: true, opacity: 0.85, depthWrite: false });
  const flameInner = new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.9, depthWrite: false });

  const mobs: Mob[] = [];
  const arrows: Arrow[] = [];
  for (let i = 0; i < ARROW_POOL; i++) {
    const mesh = new THREE.Mesh(G.arrow, arrowMaterial);
    mesh.rotation.order = "YXZ";
    mesh.visible = false;
    scene.add(mesh);
    arrows.push({
      mesh, active: false, fromPlayer: false, stuck: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
      ox: 0, oz: 0, age: 0, life: 0, check: 0, cx: 0, cy: 0, cz: 0, born: 0,
    });
  }

  let disposed = false;
  let clock = 0;
  let nextSpawnAt = performance.now() + 2000;

  // ------------------------------------------------------------ apparition
  function pickKind(): MobKind {
    const r = Math.random();
    return r < 0.4 ? "zombie" : r < 0.65 ? "squelette" : r < 0.85 ? "araignee" : "explosif";
  }

  function spawn(kind: MobKind, x: number, y: number, z: number) {
    if (disposed || mobs.length >= HARD_CAP || !world.isLoaded(x, z)) return;
    const spec = SPECS[kind];
    const material = new THREE.MeshLambertMaterial({ map: kind === "explosif" ? creeperTex : grainTex, vertexColors: true });
    const rig = buildRig(kind, material, G, eyeMaterial);
    const group = new THREE.Group();
    const tilt = new THREE.Group();
    tilt.add(rig.root);
    group.add(tilt);
    const yaw = Math.random() * Math.PI * 2;
    group.position.set(x, y, z);
    group.rotation.y = yaw;
    scene.add(group);
    const bright = world.brightness(x, y + Math.min(1.2, spec.h * 0.6), z);
    material.color.setScalar(Math.max(0.05, bright));
    const m: Mob = {
      kind, spec, group, tilt, rig, model: null, clips: null, modelMats: [], modelBase: [], flames: null,
      seed: Math.random() * 100, hp: spec.hp, vy: 0, kx: 0, kz: 0, grounded: false, yaw, headYaw: 0, headPitch: 0,
      walkPhase: 0, walkAmt: 0, dist: 0, attackCd: 0.5, gesture: 0, animLock: 0, flashT: 0,
      dying: false, dieT: 0, dieDuration: 0.95, killed: false, removed: false, burning: false, burnT: 0,
      envT: Math.random() * 0.5, sees: false, lastSeen: -100, aware: false, calm: false, provoked: false,
      wanderT: 0, wanderX: 0, wanderZ: 1, wanderSpeed: 0, stuckT: 0, detourT: 0, detourAge: 0, detourSide: 1,
      soundT: 3 + Math.random() * 7, fusing: false, fuseT: 0, shootT: 1.2, strafeT: 0, strafeDir: 1, pounceT: 1,
      bright,
    };
    mobs.push(m);
    if (kind === "zombie") loadZombieModel(m);
  }

  /** Le vrai zombie anime remplace le modele en cubes des qu'il est charge. */
  function loadZombieModel(m: Mob) {
    const id: ModelId = Math.random() < 0.5 ? "zombie-a" : "zombie-b";
    void createAnimatedModel(id, 1.8)
      .then((model) => {
        if (disposed || m.removed || m.dying) {
          disposeModel(model);
          return;
        }
        m.model = model;
        m.clips = {
          walk: firstClip(model, ["Walk", "Walking", "Run"]),
          idle: firstClip(model, ["Idle"]),
          attack: firstClip(model, ["Attack", "Punch", "Idle_Attack", "Run_Attack"]),
          hit: firstClip(model, ["HitRecieve", "HitReact", "HitReceive"]),
          death: firstClip(model, ["Death"]),
        };
        // Couleurs de base des materiaux Lambert, pour les teinter par la lumiere.
        model.root.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of list) {
            if (mat instanceof THREE.MeshLambertMaterial && !m.modelMats.includes(mat)) {
              m.modelMats.push(mat);
              m.modelBase.push(mat.color.clone());
            }
          }
        });
        m.rig.root.visible = false;
        m.tilt.add(model.root);
        if (m.clips.idle) model.play(m.clips.idle, { randomStart: true, fade: 0 });
      })
      .catch(() => {
        /* Le zombie en cubes reste en place. */
      });
  }

  function trySpawn(player: { x: number; y: number; z: number }) {
    if (disposed) return;
    const now = performance.now();
    if (now < nextSpawnAt) return;
    nextSpawnAt = now + 2000 + Math.random() * 2000;
    if (mobs.length >= MAX_MOBS) return;
    const kind = pickKind();
    const spec = SPECS[kind];
    const day = world.isDay();
    const py = Math.floor(player.y);
    for (let attempt = 0; attempt < 4; attempt++) {
      const a = Math.random() * Math.PI * 2;
      const d = 13 + Math.random() * 17;
      const bx = Math.floor(player.x + Math.sin(a) * d), bz = Math.floor(player.z + Math.cos(a) * d);
      const x = bx + 0.5, z = bz + 0.5;
      if (!world.isLoaded(x, z)) continue;
      const top = Math.min(WORLD_HEIGHT - 3, py + 20), bottom = Math.max(1, py - 20);
      let found = -1, n = 0;
      for (let y = top; y >= bottom; y--) {
        // Un sol solide, deux cases libres et seches au-dessus.
        if (world.solidAt(bx, y, bz) || world.solidAt(bx, y + 1, bz) || !world.solidAt(bx, y - 1, bz)) continue;
        if (world.liquidAt(bx, y, bz) || world.liquidAt(bx, y + 1, bz) || world.liquidAt(bx, y - 1, bz)) continue;
        const light = world.lightLevels(bx, y, bz);
        if (light.block >= 7) continue;
        // Grotte tres sombre a toute heure, ou surface la nuit, plus loin.
        const cave = light.sky < 5;
        const surface = !day && d >= 18;
        if (!cave && !surface) continue;
        if (world.collides(x, y, z, spec.h, spec.r)) continue;
        // Tirage uniforme parmi les cases valides de la colonne.
        n++;
        if (Math.random() * n < 1) found = y;
      }
      if (found >= 0) {
        spawn(kind, x, found, z);
        return;
      }
    }
  }

  // ------------------------------------------------------------ retrait
  function removeAt(i: number) {
    const m = mobs[i];
    m.removed = true;
    scene.remove(m.group);
    m.rig.material.dispose();
    if (m.model) {
      disposeModel(m.model);
      m.model = null;
    }
    mobs.splice(i, 1);
  }

  function dropLoot(m: Mob) {
    const p = m.group.position;
    const x = p.x, y = p.y + 0.5, z = p.z;
    const give = (thing: number) => {
      const n = Math.floor(Math.random() * 3);
      if (n > 0) events.drop(x, y, z, thing, n);
    };
    switch (m.kind) {
      case "zombie": give(CHAIR_POURRIE); break;
      case "squelette": give(OS); give(FLECHE); break;
      case "araignee": give(FICELLE); break;
      case "explosif": give(POUDRE); break;
    }
  }

  // ------------------------------------------------------------ degats
  function kill(m: Mob) {
    m.dying = true;
    m.dieT = 0;
    m.killed = true;
    m.fusing = false;
    m.fuseT = 0;
    m.dieDuration = FALL + 0.35;
    if (m.model && m.clips?.death) {
      m.model.play(m.clips.death, { loop: false, fade: 0.1 });
      m.dieDuration = clamp(m.model.duration(m.clips.death) + 0.2, FALL + 0.35, 1.8);
    }
    if (m.flames) m.flames.visible = false;
    if (m.dist < 24) events.sound("mort");
  }

  /** Blesse un monstre : degats, recul horizontal (direction unitaire), eclat rouge. */
  function hurt(m: Mob, amount: number, dirX: number, dirZ: number, knock: number, sound: boolean) {
    if (m.dying || amount <= 0) return;
    m.hp -= amount;
    m.flashT = HIT_FLASH;
    if (knock > 0) {
      m.kx = dirX * knock;
      m.kz = dirZ * knock;
      if (m.grounded) {
        m.vy = 4.5;
        m.grounded = false;
      }
    }
    if (m.model) {
      m.model.flash(RED);
      if (m.clips?.hit) m.model.pulse(m.clips.hit, 0.9);
    }
    // Un monstre frappe sait ou est le joueur.
    m.lastSeen = clock;
    if (m.kind === "araignee") {
      m.provoked = true;
      m.calm = false;
    }
    if (m.hp <= 0) kill(m);
    else if (sound && m.dist < 24) events.sound("touche");
  }

  function explodeMob(m: Mob) {
    const p = m.group.position;
    const cx = p.x, cy = p.y + 1, cz = p.z;
    events.explode(cx, cy, cz, 3);
    // Le souffle blesse et repousse les autres monstres.
    for (let i = 0; i < mobs.length; i++) {
      const o = mobs[i];
      if (o === m || o.dying) continue;
      const q = o.group.position;
      const dx = q.x - cx, dy = q.y + o.spec.h * 0.5 - cy, dz = q.z - cz;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d >= 6) continue;
      const f = 1 - d / 6, h = Math.sqrt(dx * dx + dz * dz) || 1;
      hurt(o, Math.round(f * 30), dx / h, dz / h, 10 * f, false);
    }
  }

  // ------------------------------------------------------------ perception
  function lineOfSight(ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const steps = Math.ceil(len / 0.35);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (world.solidAt(Math.floor(ax + dx * t), Math.floor(ay + dy * t), Math.floor(az + dz * t))) return false;
    }
    return true;
  }

  /** La case voit le ciel : lumiere du ciel a 15, sinon on remonte la colonne. */
  function exposedToSky(x: number, y: number, z: number): boolean {
    const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
    const light = world.lightLevels(bx, by, bz);
    if (light.sky < 15) return false;
    // Lumiere combinee : a 15 sans lampe a 15 a cote, c'est forcement le ciel.
    if (light.block < 15) return true;
    for (let yy = by + 1; yy < WORLD_HEIGHT; yy++) if (world.solidAt(bx, yy, bz)) return false;
    return true;
  }

  /** Controle lent (2 fois par seconde) : soleil, calme, ligne de vue, etouffement. Faux : a retirer. */
  function environment(m: Mob, px: number, py: number, pz: number): boolean {
    const s = m.spec, p = m.group.position;
    if (!world.isLoaded(p.x, p.z)) return false;
    // Loin du joueur, un monstre finit par disparaitre.
    if (m.dist > 40 && Math.random() < 0.0125) return false;
    const day = world.isDay();
    const fx = Math.floor(p.x), fz = Math.floor(p.z);
    const headY = p.y + s.h - 0.2;
    m.burning = s.burns && day && !world.liquidAt(fx, Math.floor(headY), fz) && exposedToSky(p.x, headY, p.z);
    if (m.kind === "araignee") {
      const light = world.lightLevels(fx, Math.floor(p.y + 0.5), fz);
      m.calm = day && light.sky >= 12 && !m.provoked;
    }
    m.sees = m.dist < 40 && lineOfSight(p.x, p.y + s.eye, p.z, px, py + 1.62, pz);
    if (m.sees) m.lastSeen = clock;
    // Coince dans un bloc (bloc pose dessus) : on le remonte, sinon il etouffe.
    const midY = Math.floor(p.y + Math.min(1, s.h * 0.5));
    if (world.solidAt(fx, midY, fz)) {
      let freed = false;
      for (let up = 1; up <= 2 && !freed; up++) {
        const ny = Math.floor(p.y) + up;
        if (!world.collides(p.x, ny, p.z, s.h, s.r)) {
          p.y = ny;
          m.vy = 0;
          freed = true;
        }
      }
      if (!freed) hurt(m, 1, 0, 0, 0, false);
    }
    return true;
  }

  // ------------------------------------------------------------ physique
  /** Deplacement voulu (wx, wz) + recul, gravite, sauts. Renvoie la distance horizontale parcourue. */
  function physics(m: Mob, wx: number, wz: number, dt: number): number {
    const s = m.spec, p = m.group.position;
    const x0 = p.x, z0 = p.z;
    const fx = Math.floor(p.x), fz = Math.floor(p.z);
    const inWater = world.liquidAt(fx, Math.floor(p.y + 0.3), fz);
    // Gravite, ou flottaison dans l'eau (la tete remonte a la surface).
    if (inWater) {
      const headWet = world.liquidAt(fx, Math.floor(p.y + s.h * 0.75), fz);
      m.vy = headWet ? Math.min(2.4, m.vy + 16 * dt) : Math.max(-3, m.vy - 9 * dt);
    } else m.vy = Math.max(-28, m.vy - GRAVITY * dt);
    // Horizontal, un axe a la fois pour glisser le long des murs.
    const slow = inWater ? 0.55 : 1;
    const mx = (wx * slow + m.kx) * dt, mz = (wz * slow + m.kz) * dt;
    const decay = Math.max(0, 1 - dt * (m.grounded ? 9 : 2.5));
    m.kx *= decay;
    m.kz *= decay;
    let blocked = false;
    if (mx !== 0) {
      if (!world.collides(p.x + mx, p.y, p.z, s.h, s.r)) p.x += mx;
      else blocked = true;
    }
    if (mz !== 0) {
      if (!world.collides(p.x, p.y, p.z + mz, s.h, s.r)) p.z += mz;
      else blocked = true;
    }
    // Obstacle : on saute s'il y a la place au-dessus (une marche, deux pour l'araignee).
    const want = Math.sqrt(wx * wx + wz * wz);
    if (blocked && want > 0.1 && (m.grounded || inWater)) {
      const ux = (wx / want) * 0.5, uz = (wz / want) * 0.5;
      if (!world.collides(p.x, p.y + 1.05, p.z, s.h, s.r) && !world.collides(p.x + ux, p.y + 1.05, p.z + uz, s.h, s.r)) {
        m.vy = 7.4;
        m.grounded = false;
      } else if (s.jump2 && !world.collides(p.x, p.y + 2.05, p.z, s.h, s.r) && !world.collides(p.x + ux, p.y + 2.05, p.z + uz, s.h, s.r)) {
        m.vy = 10;
        m.grounded = false;
      } else m.stuckT += dt;
    }
    // Vertical, par petits pas pour ne pas traverser un bloc en tombant vite.
    const steps = Math.max(1, Math.ceil(Math.abs(m.vy * dt) / 0.3));
    const dy = (m.vy * dt) / steps;
    m.grounded = false;
    for (let i = 0; i < steps; i++) {
      if (!world.collides(p.x, p.y + dy, p.z, s.h, s.r)) p.y += dy;
      else {
        if (m.vy < 0) m.grounded = true;
        m.vy = 0;
        break;
      }
    }
    const ddx = p.x - x0, ddz = p.z - z0;
    return Math.sqrt(ddx * ddx + ddz * ddz);
  }

  /** La route dans la direction (ux, uz) est libre, ou franchissable d'un saut. */
  function pathOpen(m: Mob, ux: number, uz: number): boolean {
    const s = m.spec, p = m.group.position;
    const ax = p.x + ux * 0.7, az = p.z + uz * 0.7;
    if (!world.collides(ax, p.y, az, s.h, s.r)) return true;
    if (!world.collides(p.x, p.y + 1.05, p.z, s.h, s.r) && !world.collides(ax, p.y + 1.05, az, s.h, s.r)) return true;
    return s.jump2 && !world.collides(p.x, p.y + 2.05, p.z, s.h, s.r) && !world.collides(ax, p.y + 2.05, az, s.h, s.r);
  }

  /** Cote du contournement : celui ou la route se degage le plus tot (sinon au hasard). */
  function chooseSide(m: Mob, ux: number, uz: number): number {
    const s = m.spec, p = m.group.position;
    let best = Math.random() < 0.5 ? -1 : 1, bestK = Infinity;
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      for (let k = 1; k <= 6; k++) {
        const qx = p.x - uz * side * k, qz = p.z + ux * side * k;
        // Le long du mur, le passage est bouche (meme en montant d'une marche).
        if (world.collides(qx, p.y, qz, s.h, s.r) && world.collides(qx, p.y + 1.05, qz, s.h, s.r)) break;
        const ax = qx + ux * 0.8, az = qz + uz * 0.8;
        if (!world.collides(ax, p.y, az, s.h, s.r) || !world.collides(ax, p.y + 1.05, az, s.h, s.r)) {
          if (k < bestK) {
            bestK = k;
            best = side;
          }
          break;
        }
      }
    }
    return best;
  }

  // ------------------------------------------------------------ tirs
  function launch(x: number, y: number, z: number, vx: number, vy: number, vz: number, fromPlayer: boolean, ox: number, oz: number) {
    // Une fleche libre, sinon la plus ancienne plantee, sinon la plus ancienne.
    let a = arrows[0];
    let best = Infinity;
    for (let i = 0; i < arrows.length; i++) {
      const c = arrows[i];
      if (!c.active) {
        a = c;
        break;
      }
      const score = (c.stuck ? 0 : 1e9) + c.born;
      if (score < best) {
        best = score;
        a = c;
      }
    }
    a.active = true;
    a.fromPlayer = fromPlayer;
    a.stuck = false;
    a.x = x; a.y = y; a.z = z;
    a.vx = vx; a.vy = vy; a.vz = vz;
    a.ox = ox; a.oz = oz;
    a.age = 0;
    a.life = 0;
    a.born = clock;
    orientArrow(a);
    a.mesh.visible = true;
  }

  function orientArrow(a: Arrow) {
    a.mesh.position.set(a.x, a.y, a.z);
    const h = Math.sqrt(a.vx * a.vx + a.vz * a.vz);
    if (h + Math.abs(a.vy) < 0.3) return;
    a.mesh.rotation.set(-Math.atan2(a.vy, h), Math.atan2(a.vx, a.vz), 0);
  }

  function release(a: Arrow) {
    a.active = false;
    a.mesh.visible = false;
  }

  /** Tir du squelette : trajectoire en cloche calculee pour la gravite, un peu imprecise. */
  function skeletonShoot(m: Mob, px: number, py: number, pz: number) {
    const p = m.group.position;
    const sx = p.x + Math.sin(m.yaw) * 0.45, sy = p.y + 1.45, sz = p.z + Math.cos(m.yaw) * 0.45;
    const dx = px - sx, dy = py + 1.1 - sy, dz = pz - sz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const v = SKELETON_ARROW_SPEED, v2 = v * v, g = ARROW_GRAVITY;
    const disc = v2 * v2 - g * (g * dist * dist + 2 * dy * v2);
    let pitch = disc >= 0 ? Math.atan2(v2 - Math.sqrt(disc), g * dist) : Math.PI / 4;
    pitch += (Math.random() - 0.5) * 0.06;
    const yaw = Math.atan2(dx, dz) + (Math.random() - 0.5) * 0.07;
    const c = Math.cos(pitch);
    launch(sx, sy, sz, Math.sin(yaw) * c * v, Math.sin(pitch) * v, Math.cos(yaw) * c * v, false, p.x, p.z);
  }

  /** Premier monstre vivant dont la boite contient le point (marge pour les fleches). */
  function mobAt(x: number, y: number, z: number): Mob | null {
    for (let i = 0; i < mobs.length; i++) {
      const m = mobs[i];
      if (m.dying) continue;
      const p = m.group.position, r = m.spec.r + 0.15;
      if (x > p.x - r && x < p.x + r && z > p.z - r && z < p.z + r && y > p.y - 0.05 && y < p.y + m.spec.h + 0.1) return m;
    }
    return null;
  }

  function updateArrows(dt: number, px: number, py: number, pz: number) {
    arrowMaterial.color.setScalar(Math.max(0.08, world.brightness(px, py + 1.6, pz)));
    for (let i = 0; i < arrows.length; i++) {
      const a = arrows[i];
      if (!a.active) continue;
      if (a.stuck) {
        a.life -= dt;
        a.check -= dt;
        // Le bloc a ete casse : la fleche retombe.
        if (a.check <= 0) {
          a.check = 0.25;
          if (!world.solidAt(a.cx, a.cy, a.cz)) {
            a.stuck = false;
            a.vx = 0; a.vy = 0; a.vz = 0;
            a.age = 0;
            continue;
          }
        }
        // Le joueur ramasse ses propres fleches en passant dessus.
        if (a.fromPlayer) {
          const dx = a.x - px, dy = a.y - (py + 0.6), dz = a.z - pz;
          if (dx * dx + dy * dy + dz * dz < 1.6) {
            events.drop(a.x, a.y, a.z, FLECHE, 1);
            release(a);
            continue;
          }
        }
        if (a.life <= 0) release(a);
        continue;
      }
      a.age += dt;
      if (a.age > ARROW_FLIGHT || a.y < -10) {
        release(a);
        continue;
      }
      if (world.liquidAt(Math.floor(a.x), Math.floor(a.y), Math.floor(a.z))) {
        const drag = Math.max(0, 1 - dt * 3);
        a.vx *= drag; a.vy *= drag; a.vz *= drag;
      }
      const speed = Math.sqrt(a.vx * a.vx + a.vy * a.vy + a.vz * a.vz);
      const steps = Math.max(1, Math.ceil((speed * dt) / 0.2));
      const h = dt / steps;
      for (let s = 0; s < steps && a.active && !a.stuck; s++) {
        a.vy -= ARROW_GRAVITY * h;
        const nx = a.x + a.vx * h, ny = a.y + a.vy * h, nz = a.z + a.vz * h;
        const bx = Math.floor(nx), by = Math.floor(ny), bz = Math.floor(nz);
        if (world.solidAt(bx, by, bz)) {
          // Plantee : la pointe entre un peu dans le bloc.
          a.x = nx; a.y = ny; a.z = nz;
          a.stuck = true;
          a.life = ARROW_STUCK;
          a.check = 0.25;
          a.cx = bx; a.cy = by; a.cz = bz;
          break;
        }
        a.x = nx; a.y = ny; a.z = nz;
        if (a.fromPlayer) {
          const m = mobAt(a.x, a.y, a.z);
          if (m) {
            const sp = Math.sqrt(a.vx * a.vx + a.vy * a.vy + a.vz * a.vz);
            const hs = Math.sqrt(a.vx * a.vx + a.vz * a.vz) || 1;
            const dmg = Math.round(6 + 4 * clamp((sp - 12) / 30, 0, 1));
            hurt(m, dmg, a.vx / hs, a.vz / hs, 4, true);
            release(a);
          }
        } else if (a.x > px - 0.35 && a.x < px + 0.35 && a.z > pz - 0.35 && a.z < pz + 0.35 && a.y > py && a.y < py + 1.85) {
          events.hurtPlayer(SKELETON_ARROW_DAMAGE, "squelette", a.ox, a.oz);
          release(a);
        }
      }
      if (a.active) orientArrow(a);
    }
  }

  // ------------------------------------------------------------ rendu
  function ensureFlames(m: Mob): THREE.Group {
    if (m.flames) return m.flames;
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const f = new THREE.Mesh(G.flame, i % 2 ? flameInner : flameOuter);
      const a = (i / 5) * Math.PI * 2;
      f.position.set(Math.sin(a) * m.spec.r * 0.9, m.spec.h * (0.1 + 0.17 * i), Math.cos(a) * m.spec.r * 0.9);
      g.add(f);
    }
    m.group.add(g);
    m.flames = g;
    return g;
  }

  function animateRig(m: Mob) {
    const r = m.rig;
    r.head.rotation.y = m.headYaw;
    r.head.rotation.x = m.headPitch;
    const sw = Math.sin(m.walkPhase) * m.walkAmt;
    switch (m.kind) {
      case "zombie": {
        r.legs[0].rotation.x = sw * 0.8;
        r.legs[1].rotation.x = -sw * 0.8;
        // Bras tendus, qui retombent un instant pour frapper.
        const hit = m.gesture > 0 ? Math.sin((1 - m.gesture / 0.35) * Math.PI) * 0.7 : 0;
        const idle = Math.sin(clock * 1.7 + m.seed) * 0.05;
        r.arms[0].rotation.x = -Math.PI / 2 + idle + hit + sw * 0.08;
        r.arms[1].rotation.x = -Math.PI / 2 - idle + hit - sw * 0.08;
        break;
      }
      case "squelette": {
        r.legs[0].rotation.x = sw * 0.8;
        r.legs[1].rotation.x = -sw * 0.8;
        if (m.aware) {
          // Arc tendu vers le joueur ; petit recul au tir.
          const recoil = m.gesture > 0 ? (m.gesture / 0.3) * 0.25 : 0;
          r.arms[0].rotation.set(-Math.PI / 2 + m.headPitch * 0.8 - recoil, -0.35, 0);
          r.arms[1].rotation.set(-Math.PI / 2 + m.headPitch * 0.8, 0.12, 0);
        } else {
          r.arms[0].rotation.set(-sw * 0.6, 0, 0);
          r.arms[1].rotation.set(sw * 0.6 - 0.2, 0, 0);
        }
        break;
      }
      case "araignee": {
        for (let i = 0; i < 8; i++) {
          const side = i < 4 ? 0 : 1, k = i & 3, sign = side === 0 ? 1 : -1;
          const ph = m.walkPhase + (k & 1 ? Math.PI : 0) + (side ? Math.PI : 0);
          const swing = Math.sin(ph) * 0.35 * m.walkAmt;
          const lift = Math.max(0, Math.cos(ph)) * 0.3 * m.walkAmt;
          r.legs[i].rotation.y = LEG_YAW[k] * sign + swing;
          r.legs[i].rotation.z = -sign * (LEG_DROOP - lift);
        }
        break;
      }
      case "explosif": {
        r.legs[0].rotation.x = sw * 0.7;
        r.legs[3].rotation.x = sw * 0.7;
        r.legs[1].rotation.x = -sw * 0.7;
        r.legs[2].rotation.x = -sw * 0.7;
        // Meche : il gonfle et clignote de plus en plus vite.
        if (m.fusing) {
          const k = m.fuseT / FUSE;
          const s = 1 + k * 0.2 + Math.sin(clock * 40) * 0.02 * k;
          r.root.scale.set(s, 1 + k * 0.12, s);
        } else r.root.scale.set(1, 1, 1);
        break;
      }
    }
  }

  /** Teinte par la lumiere de la case (pas de monstre qui brille dans le noir) et eclats. */
  function shade(m: Mob, dt: number) {
    const s = m.spec, p = m.group.position;
    const target = world.brightness(p.x, p.y + Math.min(1.2, s.h * 0.6), p.z);
    m.bright += (target - m.bright) * Math.min(1, dt * 8);
    let b = Math.max(0.05, m.bright);
    if (m.burning && !m.dying) b = Math.max(b, 0.85);
    if (m.model) {
      for (let i = 0; i < m.modelMats.length; i++) m.modelMats[i].color.copy(m.modelBase[i]).multiplyScalar(b);
      if (m.dying) {
        for (let i = 0; i < m.modelMats.length; i++) {
          m.modelMats[i].emissive.setHex(RED);
          m.modelMats[i].emissiveIntensity = 0.45;
        }
      }
      return;
    }
    const mat = m.rig.material;
    mat.color.setScalar(b);
    if (m.dying) {
      mat.emissive.setHex(RED);
      mat.emissiveIntensity = 0.45;
    } else if (m.fusing && Math.floor(m.fuseT * (3 + (m.fuseT / FUSE) * 9)) % 2 === 0) {
      mat.emissive.setHex(0xffffff);
      mat.emissiveIntensity = 0.75;
    } else if (m.flashT > 0) {
      mat.emissive.setHex(RED);
      mat.emissiveIntensity = (m.flashT / HIT_FLASH) * 0.6;
    } else mat.emissiveIntensity = 0;
  }

  // ------------------------------------------------------------ intelligence
  /** Une image d'un monstre. Faux : a retirer. */
  function updateMob(m: Mob, dt: number, px: number, py: number, pz: number): boolean {
    const s = m.spec, p = m.group.position;
    const dxp = px - p.x, dzp = pz - p.z, dyp = py - p.y;
    const distH = Math.sqrt(dxp * dxp + dzp * dzp);
    const dist = Math.sqrt(distH * distH + dyp * dyp);
    m.dist = dist;
    m.flashT = Math.max(0, m.flashT - dt);
    m.gesture = Math.max(0, m.gesture - dt);
    m.attackCd -= dt;

    // Mort : il bascule au sol, reste un instant, puis disparait en lachant son butin.
    if (m.dying) {
      m.dieT += dt;
      physics(m, 0, 0, dt);
      if (!m.model || !m.clips?.death) {
        const k = Math.min(1, m.dieT / FALL);
        m.tilt.rotation.z = (1 - (1 - k) * (1 - k)) * (Math.PI / 2);
      }
      const left = m.dieDuration - m.dieT;
      if (left < 0.15) m.tilt.scale.setScalar(Math.max(0.01, left / 0.15));
      if (m.model) m.model.update(dt);
      shade(m, dt);
      if (m.dieT >= m.dieDuration) {
        if (m.killed) dropLoot(m);
        return false;
      }
      return true;
    }
    if (dist > DESPAWN || p.y < -10) return false;

    m.envT -= dt;
    if (m.envT <= 0) {
      m.envT = 0.5;
      if (!environment(m, px, py, pz)) return false;
      if (m.dying) return true;
    }

    // Soleil : -2 PV par seconde.
    if (m.burning) {
      m.burnT += dt;
      if (m.burnT >= 1) {
        m.burnT -= 1;
        hurt(m, 2, 0, 0, 0, false);
        if (m.dying) return true;
      }
    } else m.burnT = 0;

    // Cris de temps en temps (l'explosif est silencieux).
    m.soundT -= dt;
    if (m.soundT <= 0) {
      m.soundT = 6 + Math.random() * 8;
      if (dist < 16 && m.kind !== "explosif") events.sound(m.kind);
    }

    // Il poursuit s'il voit le joueur, s'en souvient (6 s), ou le sent tout pres.
    const aware = !m.calm && dist < s.follow && Math.abs(dyp) < 16 &&
      (m.sees || clock - m.lastSeen < 6 || (dist < 8 && Math.abs(dyp) < 3));
    m.aware = aware;
    const nxp = distH > 1e-6 ? dxp / distH : 0, nzp = distH > 1e-6 ? dzp / distH : 0;
    const toPlayer = Math.atan2(dxp, dzp);
    let wx = 0, wz = 0;
    let face = NaN;
    let wandering = false;

    switch (m.kind) {
      case "zombie":
      case "araignee": {
        if (!aware) {
          wandering = true;
          break;
        }
        face = toPlayer;
        if (distH > 0.75) {
          wx = nxp * s.speed;
          wz = nzp * s.speed;
        }
        if (distH < s.reach && dyp > -1.5 && dyp < 1.7 && m.attackCd <= 0) {
          m.attackCd = 1;
          m.gesture = 0.35;
          events.hurtPlayer(s.damage, m.kind, p.x, p.z);
          if (m.model && m.clips?.attack) {
            m.model.play(m.clips.attack, { loop: false, restart: true, fade: 0.08 });
            m.animLock = Math.min(0.9, m.model.duration(m.clips.attack));
          }
        }
        // L'araignee bondit sur le joueur.
        if (m.kind === "araignee") {
          m.pounceT -= dt;
          if (m.grounded && m.pounceT <= 0 && distH > 1.8 && distH < 4.5 && m.sees) {
            m.pounceT = 2.5 + Math.random() * 1.5;
            m.vy = 6.2;
            m.kx += nxp * 4.5;
            m.kz += nzp * 4.5;
            m.grounded = false;
          }
        }
        break;
      }
      case "squelette": {
        if (!aware) {
          m.shootT = Math.max(m.shootT, 1);
          wandering = true;
          break;
        }
        face = toPlayer;
        m.strafeT -= dt;
        if (m.strafeT <= 0) {
          m.strafeT = 1.5 + Math.random() * 1.5;
          m.strafeDir = Math.random() < 0.5 ? -1 : 1;
        }
        // Garde ses distances : approche de loin, recule de pres, tourne autour entre les deux.
        if (!m.sees || distH > 10) {
          wx = nxp * s.speed;
          wz = nzp * s.speed;
        } else if (distH < 6) {
          wx = -nxp * 1.2 + nzp * m.strafeDir * 0.3;
          wz = -nzp * 1.2 - nxp * m.strafeDir * 0.3;
        } else {
          wx = nzp * m.strafeDir * 0.7;
          wz = -nxp * m.strafeDir * 0.7;
        }
        m.shootT -= dt;
        if (m.shootT <= 0 && m.sees && dist <= 16) {
          m.shootT = 1.8 + Math.random() * 0.6;
          m.gesture = 0.3;
          skeletonShoot(m, px, py, pz);
          if (dist < 24) events.sound("fleche");
        }
        break;
      }
      case "explosif": {
        if (m.fusing) {
          face = toPlayer;
          m.fuseT += dt;
          if (dist > 5) {
            m.fusing = false;
            m.fuseT = 0;
          } else if (m.fuseT >= FUSE) {
            explodeMob(m);
            return false;
          }
          break;
        }
        if (!aware) {
          wandering = true;
          break;
        }
        face = toPlayer;
        if (dist < 2.5 && m.sees) {
          m.fusing = true;
          m.fuseT = 0;
          events.sound("meche");
        } else if (distH > 1) {
          wx = nxp * s.speed;
          wz = nzp * s.speed;
        }
        break;
      }
    }

    // Promenade : pause ou marche lente dans une direction au hasard.
    if (wandering) {
      m.wanderT -= dt;
      if (m.wanderT <= 0) {
        m.wanderT = 2 + Math.random() * 4;
        if (Math.random() < 0.45) m.wanderSpeed = 0;
        else {
          const a = Math.random() * Math.PI * 2;
          m.wanderX = Math.sin(a);
          m.wanderZ = Math.cos(a);
          m.wanderSpeed = s.wander;
        }
      }
      wx = m.wanderX * m.wanderSpeed;
      wz = m.wanderZ * m.wanderSpeed;
    }

    // Mur trop haut : on le longe du cote choisi jusqu'a ce que la route se degage.
    const goal = Math.sqrt(wx * wx + wz * wz);
    const gx = goal > 1e-6 ? wx / goal : 0, gz = goal > 1e-6 ? wz / goal : 0;
    if (m.detourT > 0) {
      m.detourT -= dt;
      m.detourAge += dt;
      if (goal < 0.05 || (m.detourAge > 0.3 && pathOpen(m, gx, gz))) m.detourT = 0;
      else {
        wx = -gz * m.detourSide * goal;
        wz = gx * m.detourSide * goal;
        if (m.kind !== "squelette") face = NaN;
      }
    }

    const moved = physics(m, wx, wz, dt);
    const want = Math.sqrt(wx * wx + wz * wz);
    if (want > 0.2 && m.grounded && moved < want * dt * 0.3) {
      m.stuckT += dt;
      if (m.stuckT > 0.5) {
        m.stuckT = 0;
        if (wandering) m.wanderT = 0;
        else if (m.kind === "squelette" && m.sees && distH <= 12 && distH >= 6) m.strafeDir = -m.strafeDir;
        else if (m.detourT > 0) {
          // Coince aussi sur le cote (un coin) : on repart de l'autre cote.
          m.detourSide = -m.detourSide;
          m.detourT = 4;
          m.detourAge = 0;
        } else {
          m.detourSide = chooseSide(m, gx, gz);
          m.detourT = 4;
          m.detourAge = 0;
        }
      }
    } else m.stuckT = Math.max(0, m.stuckT - dt * 0.5);

    // Corps : vers le joueur, sinon dans le sens de la marche.
    const speedNow = moved / Math.max(dt, 1e-4);
    let targetYaw = face;
    if (Number.isNaN(targetYaw) && want > 0.05 && speedNow > 0.2) targetYaw = Math.atan2(wx, wz);
    if (!Number.isNaN(targetYaw)) m.yaw = wrap(m.yaw + clamp(wrap(targetYaw - m.yaw), -TURN * dt, TURN * dt));
    m.group.rotation.y = m.yaw;

    // Tete : suit le joueur s'il est proche.
    let hy = 0, hp = 0;
    if (dist < 14) {
      hy = clamp(wrap(toPlayer - m.yaw), -1.1, 1.1);
      hp = clamp(-Math.atan2(py + 1.62 - (p.y + s.eye), distH), -0.7, 0.7);
    }
    const ease = Math.min(1, dt * 8);
    m.headYaw += (hy - m.headYaw) * ease;
    m.headPitch += (hp - m.headPitch) * ease;

    // Foulees au rythme de la vitesse reelle.
    m.walkAmt += (Math.min(1, speedNow / 1.4) - m.walkAmt) * Math.min(1, dt * 8);
    m.walkPhase += dt * Math.min(speedNow, 4) * s.stride;

    // Flammes.
    if (m.burning) {
      const f = ensureFlames(m);
      f.visible = true;
      for (let i = 0; i < f.children.length; i++) {
        const c = f.children[i];
        c.scale.set(1, 0.6 + 0.7 * Math.abs(Math.sin(clock * 11 + i * 1.9)), 1);
        c.rotation.y = clock * 2 + i;
      }
    } else if (m.flames) m.flames.visible = false;

    if (m.model && m.clips) {
      m.animLock = Math.max(0, m.animLock - dt);
      if (m.animLock <= 0) {
        if (m.walkAmt > 0.25 && m.clips.walk) m.model.play(m.clips.walk, { speed: clamp(speedNow / 1.3, 0.5, 1.8), fade: 0.2 });
        else if (m.clips.idle) m.model.play(m.clips.idle, { fade: 0.3 });
      }
      m.model.update(dt);
    } else animateRig(m);
    shade(m, dt);
    return true;
  }

  /** Les monstres s'ecartent les uns des autres au lieu de se superposer. */
  function separate() {
    for (let i = 0; i < mobs.length; i++) {
      const a = mobs[i];
      if (a.dying) continue;
      const pa = a.group.position;
      for (let j = i + 1; j < mobs.length; j++) {
        const b = mobs[j];
        if (b.dying) continue;
        const pb = b.group.position;
        if (Math.abs(pa.y - pb.y) > 1.5) continue;
        const dx = pb.x - pa.x, dz = pb.z - pa.z;
        const min = a.spec.r + b.spec.r;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min || d2 < 1e-8) continue;
        const d = Math.sqrt(d2), push = (min - d) * 3;
        a.kx -= (dx / d) * push;
        a.kz -= (dz / d) * push;
        b.kx += (dx / d) * push;
        b.kz += (dz / d) * push;
      }
    }
  }

  // ------------------------------------------------------------ visee du joueur
  let hitIndex = -1;
  function nearestAlongRay(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, reach: number): number {
    hitIndex = -1;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 1e-9) return Infinity;
    const ux = dx / len, uy = dy / len, uz = dz / len;
    let best = Infinity;
    for (let i = 0; i < mobs.length; i++) {
      const m = mobs[i];
      if (m.dying) continue;
      const p = m.group.position, r = m.spec.r + 0.1;
      const t = rayBox(ox, oy, oz, ux, uy, uz, p.x - r, p.y, p.z - r, p.x + r, p.y + m.spec.h + 0.05, p.z + r);
      if (t <= reach && t < best) {
        best = t;
        hitIndex = i;
      }
    }
    return best;
  }

  // ------------------------------------------------------------ interface
  return {
    trySpawn,
    spawn,
    update(dt, player) {
      if (disposed) return;
      clock += dt;
      separate();
      for (let i = mobs.length - 1; i >= 0; i--) {
        // Un evenement (explosion, mort du joueur) peut avoir tout vide entre-temps.
        if (disposed) return;
        if (i >= mobs.length) continue;
        if (!updateMob(mobs[i], dt, player.x, player.y, player.z)) removeAt(i);
      }
      updateArrows(dt, player.x, player.y, player.z);
    },
    hitMelee(ox, oy, oz, dx, dy, dz, reach, damage) {
      if (disposed) return false;
      nearestAlongRay(ox, oy, oz, dx, dy, dz, reach);
      if (hitIndex < 0) return false;
      const m = mobs[hitIndex];
      const p = m.group.position;
      // Recul : du joueur vers le monstre (a defaut, le sens du regard).
      let kx = p.x - ox, kz = p.z - oz;
      let h = Math.sqrt(kx * kx + kz * kz);
      if (h < 1e-3) {
        kx = dx;
        kz = dz;
        h = Math.sqrt(kx * kx + kz * kz) || 1;
      }
      hurt(m, damage, kx / h, kz / h, 5.5, false);
      return true;
    },
    rayDistance(ox, oy, oz, dx, dy, dz, reach) {
      if (disposed) return Infinity;
      return nearestAlongRay(ox, oy, oz, dx, dy, dz, reach);
    },
    shootArrow(ox, oy, oz, dx, dy, dz, speed) {
      if (disposed) return;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len < 1e-9) return;
      const ux = dx / len, uy = dy / len, uz = dz / len;
      launch(ox + ux * 0.25, oy + uy * 0.25, oz + uz * 0.25, ux * speed, uy * speed, uz * speed, true, ox, oz);
    },
    count: () => mobs.length,
    clear() {
      for (let i = mobs.length - 1; i >= 0; i--) removeAt(i);
      for (const a of arrows) release(a);
      nextSpawnAt = performance.now() + 2000;
    },
    dispose() {
      if (disposed) return;
      for (let i = mobs.length - 1; i >= 0; i--) removeAt(i);
      disposed = true;
      for (const a of arrows) scene.remove(a.mesh);
      arrows.length = 0;
      for (const g of Object.values(G)) g.dispose();
      grainTex.dispose();
      creeperTex.dispose();
      eyeMaterial.dispose();
      arrowMaterial.dispose();
      flameOuter.dispose();
      flameInner.dispose();
    },
  };
}
