import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { KnifeFoley } from "./duelAudio";
import type { Rarity } from "./duelProfile";
import type { WeaponAnim, WeaponLook, WeaponModel } from "./duelWeapons";

/**
 * Les couteaux du Duel.
 *
 * Ils remplacent les poings : l'arme garde l'identifiant « poings » (il est
 * sauvegarde et envoye en ligne), mais le joueur tient un couteau. Cinq
 * modeles originaux, dessines ici en code : une lame extrudee a partir de son
 * profil, avec un vrai fil (deux biseaux qui se rejoignent, plus clairs que le
 * plat de la lame), une garde, un manche texture au canvas. Aucun fichier.
 *
 * Le modele tenu en main a la meme interface que les armes a feu
 * (WeaponModel) : la scene le place, le balance et le cache comme les autres.
 * Il anime lui-meme ses coups, son inspection et sa sortie.
 */

export type KnifeId = "combat" | "chasse" | "baionnette" | "karambit" | "papillon";

export interface KnifeInfo {
  id: KnifeId;
  name: string;
  rarity: Rarity;
  /** Prix en pieces (0 : offert). */
  price: number;
  tagline: string;
}

export const KNIVES: Record<KnifeId, KnifeInfo> = {
  combat: {
    id: "combat",
    name: "Couteau de combat",
    rarity: "commun",
    price: 0,
    tagline: "Lame noire à pointe rabattue, fil poli. Le couteau de départ.",
  },
  chasse: {
    id: "chasse",
    name: "Couteau de chasse",
    rarity: "rare",
    price: 900,
    tagline: "Acier satiné, manche en noyer et garde en laiton.",
  },
  baionnette: {
    id: "baionnette",
    name: "Baïonnette",
    rarity: "rare",
    price: 1100,
    tagline: "Longue lame gorgée, anneau de canon sur la garde.",
  },
  karambit: {
    id: "karambit",
    name: "Karambit",
    rarity: "epique",
    price: 1800,
    tagline: "Lame en griffe et anneau de doigt. Il tourne autour de l'index.",
  },
  papillon: {
    id: "papillon",
    name: "Papillon",
    rarity: "legendaire",
    price: 2600,
    tagline: "Lame damassée, deux manches en titane qui s'ouvrent d'un geste.",
  },
};

/** L'ordre du casier, du couteau offert au plus rare. */
export const KNIFE_ORDER: KnifeId[] = ["combat", "chasse", "baionnette", "karambit", "papillon"];
export const DEFAULT_KNIFE: KnifeId = "combat";

export function isKnifeId(value: unknown): value is KnifeId {
  return typeof value === "string" && value in KNIVES;
}

// ------------------------------------------------------------- le combat
// Le coup rapide reprend la fiche WEAPONS.poings (degats, cadence, portee) ;
// le coup lourd et le coup dans le dos sont definis ici.

/** Coup lourd (clic droit) : plus lent, plus court, il fait tres mal. */
export const KNIFE_HEAVY_DAMAGE = 65;
/** Secondes entre deux coups lourds. */
export const KNIFE_HEAVY_INTERVAL = 1;
/** Portee du coup lourd, en cases (le rapide prend celle de la fiche). */
export const KNIFE_HEAVY_RANGE = 0.85;
/** Dans le dos : elimination, quel que soit le coup. */
export const KNIFE_BACKSTAB_DAMAGE = 999;
/** Delai entre le clic et le contact de la lame : les degats tombent avec le geste. */
export const KNIFE_HIT_DELAY: Record<KnifeStrike, number> = { rapide: 0.07, lourd: 0.2 };
/** Duree de l'inspection. */
export const KNIFE_INSPECT_SECONDS = 2.6;

/**
 * Coup dans le dos : l'attaquant se trouve derriere la cible. `fwdX/fwdZ` est
 * le regard de la cible, `toX/toZ` le vecteur de la cible vers l'attaquant.
 * Un demi-cercle arriere un peu resserre (environ 110 degres de chaque cote).
 */
export function isBackstab(fwdX: number, fwdZ: number, toX: number, toZ: number): boolean {
  const lf = Math.hypot(fwdX, fwdZ);
  const lt = Math.hypot(toX, toZ);
  if (lf < 1e-6 || lt < 1e-6) return false;
  return (fwdX * toX + fwdZ * toZ) / (lf * lt) < -0.35;
}

export type KnifeStrike = "rapide" | "lourd";

/** Le couteau tenu en main : l'interface des armes, plus ses gestes propres. */
export interface KnifeModel extends WeaponModel {
  readonly knife: KnifeId;
  /** Un coup part : l'animation se lance (les degats, eux, restent a la scene). */
  strike(kind: KnifeStrike, time: number): void;
  /** Inspection : le couteau vient devant, on le tourne, on le retourne. */
  inspect(time: number): void;
  /** Vrai tant que l'inspection est en cours. */
  inspecting(time: number): boolean;
  /** Bruit d'un geste (sortie, cliquetis du papillon...) ; null quand il n'y en a plus. */
  nextSound(): KnifeFoley | null;
}

// ------------------------------------------------------------ petits outils
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x: number) => {
  const k = clamp01(x);
  return k * k * (3 - 2 * k);
};
/** 0 avant a, 1 apres b, en douceur. */
const ramp = (t: number, a: number, b: number) => smooth((t - a) / (b - a));

// ============================================================== geometrie
// Repere du couteau : X le long de la lame (la pointe vers +X, le manche vers
// -X, la garde en x = 0), Y vers le dos (+Y) ou le fil (-Y), Z l'epaisseur.
// Les cotes sont en metres, a l'echelle d'un vrai couteau.

/** Profil d'une lame : ligne mediane, hauteur du dos et du fil, epaisseur. */
interface BladeProfile {
  /** Nombre de tranches le long de la lame. */
  n: number;
  /** Point de la ligne mediane pour t de 0 (talon) a 1 (pointe). */
  center(t: number, out: THREE.Vector2): void;
  /** Distance du dos a la ligne mediane. */
  up(t: number): number;
  /** Distance du fil a la ligne mediane. */
  down(t: number): number;
  /** Epaisseur au talon. */
  thick: number;
  /** Part de la hauteur (depuis le fil) occupee par l'emouture. */
  grind: number;
  /** Au-dela de ce t, le dos est affute lui aussi (faux tranchant). */
  swedge: number;
}

const straight = (len: number) => (t: number, out: THREE.Vector2) => {
  out.set(t * len, 0);
};

/** Les cinq lames. Les courbes restent simples : ce sont elles qui font la silhouette. */
const BLADES: Record<KnifeId, BladeProfile> = {
  // Pointe rabattue (« clip point ») : dos droit puis une descente concave
  // affutee, ventre arrondi.
  combat: {
    n: 26,
    center: straight(0.172),
    up: (t) => 0.0135 * (t < 0.6 ? 1 : Math.pow(1 - (t - 0.6) / 0.4, 1.35)),
    down: (t) => (t < 0.035 ? 0.0115 : 0.0175 * (t < 0.58 ? 1 : Math.cos(((t - 0.58) / 0.42) * (Math.PI / 2)))),
    thick: 0.0048,
    grind: 0.46,
    swedge: 0.62,
  },
  // Pointe abaissee (« drop point ») : un dos qui plonge en arrondi, un large
  // ventre pour depecer.
  chasse: {
    n: 24,
    center: straight(0.142),
    up: (t) => 0.0125 * (t < 0.5 ? 1 + t * 0.12 : 1.06 * Math.cos(((t - 0.5) / 0.5) * (Math.PI / 2))),
    down: (t) => 0.0205 * (t < 0.42 ? 1 : Math.pow(Math.cos(((t - 0.42) / 0.58) * (Math.PI / 2)), 0.8)),
    thick: 0.0042,
    grind: 0.62,
    swedge: 2,
  },
  // Longue et droite, une gorge sur le plat, pointe rabattue courte.
  baionnette: {
    n: 28,
    center: straight(0.198),
    up: (t) => 0.0118 * (t < 0.72 ? 1 : Math.pow(1 - (t - 0.72) / 0.28, 1.1)),
    down: (t) => 0.0142 * (t < 0.66 ? 1 : Math.cos(((t - 0.66) / 0.34) * (Math.PI / 2))),
    thick: 0.0056,
    grind: 0.36,
    swedge: 0.74,
  },
  // Griffe : la ligne mediane est un arc qui plonge vers le fil (le tranchant
  // est a l'interieur de la courbe).
  karambit: {
    n: 30,
    center: (t, out) => {
      const R = 0.082;
      const a = t * 1.32;
      out.set(R * Math.sin(a), -R * (1 - Math.cos(a)));
    },
    up: (t) => 0.0118 * Math.pow(1 - t, 0.75),
    down: (t) => 0.0122 * Math.pow(1 - t, 0.9),
    thick: 0.0046,
    grind: 0.52,
    swedge: 2,
  },
  // Pointe de lance, courte : elle doit tenir dans les manches fermes.
  papillon: {
    n: 24,
    center: straight(0.1),
    up: (t) => 0.0105 * (t < 0.64 ? 1 : Math.pow(1 - (t - 0.64) / 0.36, 1.2)),
    down: (t) => 0.0118 * (t < 0.6 ? 1 : Math.cos(((t - 0.6) / 0.4) * (Math.PI / 2))),
    thick: 0.0042,
    grind: 0.5,
    swedge: 0.66,
  },
};

/**
 * La lame en volume. Chaque tranche a cinq points : dos gauche, ligne
 * d'emouture gauche, fil, emouture droite, dos droit. Le plat (entre le dos et
 * l'emouture) et le biseau (de l'emouture au fil) sont deux geometries : le
 * biseau recoit un materiau plus clair, c'est le fil poli qu'on voit briller.
 */
function bladeGeometries(p: BladeProfile): { flat: THREE.BufferGeometry; edge: THREE.BufferGeometry } {
  const c = new THREE.Vector2();
  const c2 = new THREE.Vector2();
  const n = p.n;
  // Cinq anneaux de points : x, y, z pour chaque tranche.
  const ring: number[][] = [[], [], [], [], []];
  const vFrac: number[][] = [[], [], [], [], []];
  const us: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    p.center(t, c);
    // Normale cote dos : la tangente tournee d'un quart de tour.
    const ta = Math.max(0, t - 0.01);
    const tb = Math.min(1, t + 0.01);
    p.center(tb, c2);
    const tx0 = c2.x;
    const ty0 = c2.y;
    p.center(ta, c2);
    let tx = tx0 - c2.x;
    let ty = ty0 - c2.y;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    const nx = -ty;
    const ny = tx;
    const s = t >= 1 ? 0 : p.up(t);
    const e = t >= 1 ? 0 : p.down(t);
    const h = s + e;
    // Epaisseur : elle s'amincit vers la pointe ; le dos s'affute au-dela du
    // faux tranchant.
    const thG = p.thick * Math.pow(1 - t, 0.38);
    const thS = t > p.swedge ? thG * Math.max(0.14, 1 - ((t - p.swedge) / (1 - p.swedge)) * 1.7) : thG;
    const sx = c.x + nx * s;
    const sy = c.y + ny * s;
    const ex = c.x - nx * e;
    const ey = c.y - ny * e;
    const gx = ex + nx * p.grind * h;
    const gy = ey + ny * p.grind * h;
    ring[0].push(sx, sy, thS / 2);
    ring[1].push(gx, gy, thG / 2);
    ring[2].push(ex, ey, 0);
    ring[3].push(gx, gy, -thG / 2);
    ring[4].push(sx, sy, -thS / 2);
    vFrac[0].push(1);
    vFrac[1].push(p.grind);
    vFrac[2].push(0);
    vFrac[3].push(p.grind);
    vFrac[4].push(1);
    us.push(t);
  }
  /** Une bande entre deux anneaux, orientee vers l'exterieur. */
  const strip = (a: number, b: number, capBase = false): THREE.BufferGeometry => {
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= n; i++) {
      pos.push(ring[a][i * 3], ring[a][i * 3 + 1], ring[a][i * 3 + 2]);
      pos.push(ring[b][i * 3], ring[b][i * 3 + 1], ring[b][i * 3 + 2]);
      uv.push(us[i], a === 4 && b === 0 ? 0.99 : vFrac[a][i], us[i], a === 4 && b === 0 ? 1 : vFrac[b][i]);
    }
    for (let i = 0; i < n; i++) {
      const a0 = i * 2;
      const b0 = i * 2 + 1;
      const a1 = a0 + 2;
      const b1 = b0 + 2;
      idx.push(a0, b0, a1, b0, b1, a1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    if (capBase) {
      // Talon : une face plate tournee vers le manche (cachee par la garde).
      const cap = new THREE.BufferGeometry();
      const cp: number[] = [];
      for (let k = 0; k < 5; k++) cp.push(ring[k][0], ring[k][1], ring[k][2]);
      cap.setAttribute("position", new THREE.Float32BufferAttribute(cp, 3));
      cap.setAttribute("uv", new THREE.Float32BufferAttribute([0, 1, 0, 0.5, 0, 0, 0, 0.5, 0, 1], 2));
      cap.setIndex([0, 4, 3, 0, 3, 2, 0, 2, 1]);
      cap.computeVertexNormals();
      const merged = mergeGeometries([g, cap], false)!;
      g.dispose();
      cap.dispose();
      return merged;
    }
    return g;
  };
  const flatParts = [strip(0, 1, true), strip(3, 4), strip(4, 0)];
  const edgeParts = [strip(1, 2), strip(2, 3)];
  const flat = mergeGeometries(flatParts, false)!;
  const edge = mergeGeometries(edgeParts, false)!;
  for (const g of [...flatParts, ...edgeParts]) g.dispose();
  return { flat, edge };
}

/** Extrusion d'un profil (plan XY) sur l'epaisseur Z, centree, aux aretes arrondies. */
function extrude(shape: THREE.Shape, depth: number, bevel: number, curveSegments = 10): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.0005, depth - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * 0.9,
    bevelSegments: 3,
    curveSegments,
  });
  g.translate(0, 0, -(depth - bevel * 2) / 2);
  return g;
}

/** Piece de revolution autour de l'axe X : `prof` donne [x, rayon] du debut a la fin. */
function lathe(prof: [number, number][], segments = 16, squashZ = 1): THREE.BufferGeometry {
  const pts = prof.map(([x, r]) => new THREE.Vector2(Math.max(0.0001, r), x));
  const g = new THREE.LatheGeometry(pts, segments);
  // L'axe du tour (Y) devient l'axe X du couteau.
  g.rotateZ(-Math.PI / 2);
  if (squashZ !== 1) g.scale(1, 1, squashZ);
  return g;
}

/**
 * Fusionne des geometries (indexees ou non) en une seule, non indexee, avec
 * position, normale et coordonnees de texture. Les sources sont liberees.
 */
function mergeAll(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const flat = geos.map((g) => {
    const f = g.index ? g.toNonIndexed() : g;
    if (f !== g) g.dispose();
    for (const name of Object.keys(f.attributes)) {
      if (name !== "position" && name !== "normal" && name !== "uv") f.deleteAttribute(name);
    }
    if (!f.getAttribute("normal")) f.computeVertexNormals();
    if (!f.getAttribute("uv")) f.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(f.getAttribute("position").count * 2), 2));
    return f;
  });
  if (flat.length === 1) return flat[0];
  const merged = mergeGeometries(flat, false)!;
  for (const g of flat) g.dispose();
  return merged;
}

/** Contour lisse passant par des points (spline fermee). */
function smoothShape(points: [number, number][], divisions = 60): THREE.Shape {
  const curve = new THREE.SplineCurve(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const pts = curve.getPoints(divisions);
  const s = new THREE.Shape(pts);
  s.closePath();
  return s;
}

function holeFrom(points: [number, number][], divisions = 24): THREE.Path {
  const curve = new THREE.SplineCurve(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const p = new THREE.Path(curve.getPoints(divisions));
  p.closePath();
  return p;
}

/** Trou oblong (ajourage des manches du papillon). */
function slot(x0: number, x1: number, y: number, r: number): THREE.Path {
  const p = new THREE.Path();
  p.moveTo(x0, y - r);
  p.lineTo(x1, y - r);
  p.absarc(x1, y, r, -Math.PI / 2, Math.PI / 2, false);
  p.lineTo(x0, y + r);
  p.absarc(x0, y, r, Math.PI / 2, (Math.PI * 3) / 2, false);
  return p;
}

// ------------------------------------------------------------- les pieces
/** Role d'une piece : il fixe son materiau (et sa couleur en vue lointaine). */
type Role = "lame" | "fil" | "garde" | "manche" | "accent" | "sombre";
/** Ce qui bouge ensemble : tout, sauf sur le papillon (la lame et un manche pivotent). */
type Unit = "fixe" | "lame" | "mancheB";

interface Part {
  geo: THREE.BufferGeometry;
  role: Role;
  unit: Unit;
}

type BladeFinish = "noir" | "satin" | "parkerise" | "stonewash" | "damas";
type HandleFinish = "caoutchouc" | "noyer" | "polymere" | "g10" | "titane";

interface KnifeStyle {
  blade: BladeFinish;
  handle: HandleFinish;
  /** Teintes de chaque role (multipliees par la texture). */
  colors: Record<Role, number>;
  /** Couleur moyenne de chaque role, pour le couteau vu de loin (sans texture). */
  far: Record<Role, number>;
}

const STYLES: Record<KnifeId, KnifeStyle> = {
  combat: {
    blade: "noir",
    handle: "caoutchouc",
    colors: { lame: 0xffffff, fil: 0xf2f6fa, garde: 0x5a5f66, manche: 0xffffff, accent: 0x6d737a, sombre: 0x16181b },
    far: { lame: 0x2b2e33, fil: 0xd8dde2, garde: 0x44484e, manche: 0x1d1f22, accent: 0x5a5f66, sombre: 0x111214 },
  },
  chasse: {
    blade: "satin",
    handle: "noyer",
    colors: { lame: 0xffffff, fil: 0xffffff, garde: 0xd6a646, manche: 0xffffff, accent: 0xe0b457, sombre: 0x2a1c10 },
    far: { lame: 0xb8bfc6, fil: 0xeef2f5, garde: 0xc4963c, manche: 0x6e4527, accent: 0xd0a24a, sombre: 0x2a1c10 },
  },
  baionnette: {
    blade: "parkerise",
    handle: "polymere",
    colors: { lame: 0xffffff, fil: 0xe8edf2, garde: 0x6a7077, manche: 0x5b4a36, accent: 0x7c838b, sombre: 0x141517 },
    far: { lame: 0x50555b, fil: 0xd0d6dc, garde: 0x5d6269, manche: 0x3b3024, accent: 0x6c7279, sombre: 0x141517 },
  },
  karambit: {
    blade: "stonewash",
    handle: "g10",
    colors: { lame: 0xffffff, fil: 0xf4f7fa, garde: 0x8a9199, manche: 0xffffff, accent: 0x9aa1a9, sombre: 0x121314 },
    far: { lame: 0x979ea6, fil: 0xe6ebf0, garde: 0x7d848c, manche: 0x2f4a36, accent: 0x8d949c, sombre: 0x121314 },
  },
  papillon: {
    blade: "damas",
    handle: "titane",
    colors: { lame: 0xffffff, fil: 0xffffff, garde: 0x9aa3ad, manche: 0xffffff, accent: 0xc9a54a, sombre: 0x191b1f },
    far: { lame: 0x8e969f, fil: 0xeef2f6, garde: 0x8a929b, manche: 0x5a6a9a, accent: 0xc9a54a, sombre: 0x191b1f },
  },
};

/** Ce qu'il faut savoir pour tenir le couteau et l'animer. */
interface KnifeBuild {
  parts: Part[];
  /** Abscisse (repere du couteau) du point tenu au centre du poing. */
  gripX: number;
  /** Vrai : prise inversee, la lame sort cote auriculaire (karambit). */
  reverse: boolean;
  /** Pointe de la lame (repere du couteau, ou de la lame pour le papillon). */
  tip: THREE.Vector3;
  /** Centre de rotation de l'inspection (l'anneau du karambit). */
  spin: THREE.Vector3 | null;
}

function buildParts(id: KnifeId): KnifeBuild {
  const parts: Part[] = [];
  const add = (geo: THREE.BufferGeometry, role: Role, unit: Unit = "fixe") => {
    parts.push({ geo, role, unit });
    return geo;
  };
  const profile = BLADES[id];
  const blade = bladeGeometries(profile);
  const tip2 = new THREE.Vector2();
  profile.center(1, tip2);
  const bladeUnit: Unit = id === "papillon" ? "lame" : "fixe";
  add(blade.flat, "lame", bladeUnit);
  add(blade.edge, "fil", bladeUnit);
  let gripX = -0.058;
  let reverse = false;
  let spin: THREE.Vector3 | null = null;

  switch (id) {
    case "combat": {
      // Garde a double quillon, un peu recourbee vers la lame.
      add(
        extrude(
          smoothShape([
            [-0.0075, 0.024],
            [-0.002, 0.027],
            [0.0012, 0.02],
            [0.0005, 0.004],
            [0.0005, -0.012],
            [0.004, -0.026],
            [0.001, -0.033],
            [-0.0055, -0.031],
            [-0.0078, -0.014],
            [-0.0078, 0.008],
          ]),
          0.0125,
          0.0016,
        ),
        "garde",
      );
      // Manche en caoutchouc a anneaux : un leger renflement au milieu.
      const prof: [number, number][] = [];
      for (let x = -0.0072; x >= -0.119; x -= 0.0028) {
        const k = (-x - 0.0072) / 0.112;
        const swell = 0.0122 + 0.0026 * Math.sin(k * Math.PI) - 0.0012 * k;
        const groove = Math.pow(Math.max(0, Math.cos(((-x - 0.0072) / 0.0112) * Math.PI * 2)), 6) * 0.0011;
        prof.unshift([x, swell - groove]);
      }
      add(lathe(prof, 18, 0.8), "manche");
      // Pommeau d'acier, avec son trou de dragonne suggere par un anneau sombre.
      add(
        lathe(
          [
            [-0.1335, 0.0005],
            [-0.1332, 0.006],
            [-0.1318, 0.0105],
            [-0.1285, 0.0128],
            [-0.1205, 0.0126],
            [-0.119, 0.0112],
          ],
          18,
          0.8,
        ),
        "accent",
      );
      add(new THREE.TorusGeometry(0.0042, 0.0012, 6, 14).translate(-0.126, 0, 0), "sombre");
      break;
    }

    case "chasse": {
      // Garde en laiton, simple et arrondie.
      add(
        extrude(
          smoothShape([
            [-0.006, 0.017],
            [0.0006, 0.018],
            [0.001, 0.0],
            [0.0015, -0.022],
            [-0.002, -0.027],
            [-0.0065, -0.022],
            [-0.0068, 0.0],
          ]),
          0.022,
          0.002,
        ),
        "garde",
      );
      // Manche en noyer, creuse pour les doigts.
      add(
        extrude(
          smoothShape(
            [
              [-0.006, 0.0135],
              [-0.04, 0.0142],
              [-0.075, 0.015],
              [-0.102, 0.0152],
              [-0.111, 0.009],
              [-0.112, -0.004],
              [-0.107, -0.0178],
              [-0.093, -0.0158],
              [-0.078, -0.019],
              [-0.06, -0.0152],
              [-0.043, -0.0188],
              [-0.024, -0.0148],
              [-0.009, -0.0172],
            ],
            80,
          ),
          0.0205,
          0.0042,
        ),
        "manche",
      );
      // Rivets de laiton, qui traversent le manche.
      for (const x of [-0.034, -0.083]) {
        add(new THREE.CylinderGeometry(0.0028, 0.0028, 0.0214, 10).rotateX(Math.PI / 2).translate(x, -0.0005, 0), "accent");
      }
      // Pommeau en laiton.
      add(
        extrude(
          smoothShape([
            [-0.1085, 0.0152],
            [-0.1145, 0.0132],
            [-0.1185, 0.004],
            [-0.1175, -0.009],
            [-0.1125, -0.0185],
            [-0.1065, -0.0178],
            [-0.1098, -0.004],
          ]),
          0.0215,
          0.0025,
        ),
        "accent",
      );
      break;
    }

    case "baionnette": {
      // Garde : la plaque et l'anneau qui se glisse sur le canon.
      add(
        extrude(
          smoothShape([
            [-0.0085, 0.028],
            [-0.0035, 0.031],
            [0.0005, 0.026],
            [0.0008, 0.0],
            [0.0005, -0.018],
            [-0.004, -0.021],
            [-0.0085, -0.018],
            [-0.009, 0.004],
          ]),
          0.0105,
          0.0015,
        ),
        "garde",
      );
      add(new THREE.TorusGeometry(0.0082, 0.0026, 8, 18).rotateY(Math.PI / 2).translate(-0.0042, 0.0355, 0), "garde");
      // Manche en polymere, a peine galbe.
      add(
        extrude(
          smoothShape(
            [
              [-0.008, 0.0128],
              [-0.06, 0.0136],
              [-0.112, 0.013],
              [-0.116, 0.0],
              [-0.112, -0.0145],
              [-0.06, -0.0162],
              [-0.008, -0.0148],
            ],
            60,
          ),
          0.0215,
          0.0045,
        ),
        "manche",
      );
      // Pommeau d'acier : bouton de verrou et rainure en T.
      add(new RoundedBoxGeometry(0.016, 0.031, 0.021, 2, 0.003).translate(-0.121, -0.0008, 0), "accent");
      add(new RoundedBoxGeometry(0.007, 0.006, 0.009, 2, 0.0018).translate(-0.118, 0.0165, 0), "accent");
      add(new THREE.BoxGeometry(0.013, 0.0035, 0.0215).translate(-0.123, -0.004, 0), "sombre");
      break;
    }

    case "karambit": {
      // Mitre d'acier au talon.
      add(new RoundedBoxGeometry(0.009, 0.026, 0.0115, 2, 0.002).translate(-0.004, -0.0005, 0), "garde");
      // Manche courbe qui plonge vers l'anneau.
      const handle = smoothShape(
        [
          [-0.007, 0.012],
          [-0.035, 0.0118],
          [-0.058, 0.006],
          [-0.072, -0.005],
          [-0.079, -0.018],
          [-0.069, -0.024],
          [-0.058, -0.014],
          [-0.04, -0.0108],
          [-0.02, -0.0118],
          [-0.007, -0.0125],
        ],
        70,
      );
      add(extrude(handle, 0.0185, 0.0038), "manche");
      // L'anneau : l'index passe dedans, le couteau tourne autour.
      const ringX = -0.0835;
      const ringY = -0.0285;
      add(new THREE.TorusGeometry(0.0158, 0.0052, 10, 26).translate(ringX, ringY, 0), "manche");
      // Vis du manche.
      for (const x of [-0.02, -0.052]) {
        add(new THREE.CylinderGeometry(0.0024, 0.0024, 0.0192, 8).rotateX(Math.PI / 2).translate(x, x < -0.04 ? -0.0015 : 0, 0), "accent");
      }
      gripX = -0.045;
      reverse = true;
      spin = new THREE.Vector3(ringX, ringY, 0);
      break;
    }

    case "papillon": {
      // Deux manches ajoures en titane, chacun sur son pivot. Le manche A
      // reste dans la main ; le manche B tourne avec la lame, puis autour
      // d'elle (voir l'animation).
      const L = 0.104;
      const bar = (): THREE.Shape => {
        const s = new THREE.Shape();
        s.moveTo(0.004, -0.0112);
        s.lineTo(-L + 0.006, -0.0112);
        s.absarc(-L + 0.006, 0, 0.0112, -Math.PI / 2, Math.PI / 2, true);
        s.lineTo(0.004, 0.0112);
        s.absarc(0.004, 0, 0.0112, Math.PI / 2, -Math.PI / 2, true);
        s.holes.push(slot(-0.03, -0.018, 0, 0.0042), slot(-0.058, -0.04, 0, 0.0042), slot(-0.086, -0.068, 0, 0.0042));
        return s;
      };
      add(extrude(bar(), 0.0062, 0.0014, 12).translate(0, 0, -0.0055), "manche", "fixe");
      add(extrude(bar(), 0.0062, 0.0014, 12).translate(0, 0, 0.0055), "manche", "mancheB");
      // Goupilles des pivots et vis de la lame.
      add(new THREE.CylinderGeometry(0.0034, 0.0034, 0.02, 12).rotateX(Math.PI / 2), "accent", "lame");
      for (const x of [-0.052, -0.1]) {
        add(new THREE.CylinderGeometry(0.0022, 0.0022, 0.0088, 8).rotateX(Math.PI / 2).translate(x, 0, -0.0055), "accent", "fixe");
        add(new THREE.CylinderGeometry(0.0022, 0.0022, 0.0088, 8).rotateX(Math.PI / 2).translate(x, 0, 0.0055), "accent", "mancheB");
      }
      // Loquet au bout du manche B : il vient se clipser sur le manche A.
      add(new RoundedBoxGeometry(0.012, 0.004, 0.017, 2, 0.0012).translate(-L + 0.004, 0.0122, 0.001), "garde", "mancheB");
      gripX = -0.056;
      break;
    }
  }

  const tip = new THREE.Vector3(tip2.x, tip2.y, 0);
  return { parts, gripX, reverse, tip, spin };
}

// ============================================================== textures
function canvas2d(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return { canvas, g: canvas.getContext("2d")! };
}

function finish(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/**
 * Plat de la lame. u va du talon (0) a la pointe (1), v du fil (0) au dos
 * (1) : la gorge et les motifs se dessinent directement a leur place.
 */
function bladeTexture(kind: BladeFinish): THREE.CanvasTexture {
  const W = 256;
  const H = 64;
  const { canvas, g } = canvas2d(W, H);
  const yOf = (v: number) => (1 - v) * H;
  const base: Record<BladeFinish, string> = {
    noir: "#2c2f34",
    satin: "#b9c0c7",
    parkerise: "#4d5258",
    stonewash: "#9aa1a8",
    damas: "#8e959d",
  };
  g.fillStyle = base[kind];
  g.fillRect(0, 0, W, H);
  if (kind === "damas") {
    // Acier damasse : des couches claires et sombres qui ondulent.
    for (let k = 0; k < 26; k++) {
      g.strokeStyle = k % 2 === 0 ? "rgba(225,232,240,0.55)" : "rgba(40,44,50,0.55)";
      g.lineWidth = 2.2;
      g.beginPath();
      for (let x = 0; x <= W; x += 4) {
        const y = (k / 26) * H * 1.6 - H * 0.3 + Math.sin(x * 0.045 + k * 0.7) * 7 + Math.sin(x * 0.11 + k) * 2.5;
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
  } else if (kind === "stonewash") {
    // Stonewash : une myriade de petites taches claires et sombres.
    for (let i = 0; i < 900; i++) {
      g.fillStyle = Math.random() < 0.5 ? "rgba(235,240,245,0.22)" : "rgba(40,44,50,0.22)";
      g.beginPath();
      g.ellipse(Math.random() * W, Math.random() * H, 1 + Math.random() * 3, 0.6 + Math.random() * 1.6, Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    // Brossage dans la longueur (le revetement noir le laisse a peine voir).
    const a = kind === "noir" ? 0.035 : kind === "parkerise" ? 0.05 : 0.09;
    for (let y = 0; y < H; y++) {
      g.fillStyle = `rgba(255,255,255,${a * Math.random()})`;
      g.fillRect(0, y, W, 1);
    }
    if (kind === "parkerise") {
      for (let i = 0; i < 600; i++) {
        g.fillStyle = "rgba(20,22,24,0.18)";
        g.fillRect(Math.random() * W, Math.random() * H, 1, 1);
      }
    }
  }
  if (kind === "noir") {
    // Revetement use sur le dos et pres de la garde.
    g.fillStyle = "rgba(160,168,176,0.18)";
    for (let i = 0; i < 60; i++) g.fillRect(Math.random() * W * 0.3, yOf(0.85 + Math.random() * 0.15), 2 + Math.random() * 8, 1);
  }
  // Gorge de la baionnette : une rainure sombre bordee d'un liseré clair.
  if (kind === "parkerise") {
    const y0 = yOf(0.68);
    const grad = g.createLinearGradient(0, y0 - 5, 0, y0 + 5);
    grad.addColorStop(0, "rgba(220,226,232,0.35)");
    grad.addColorStop(0.35, "rgba(18,20,22,0.8)");
    grad.addColorStop(0.7, "rgba(18,20,22,0.55)");
    grad.addColorStop(1, "rgba(220,226,232,0.3)");
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(W * 0.05, y0 - 3);
    g.lineTo(W * 0.66, y0 - 3);
    g.quadraticCurveTo(W * 0.7, y0, W * 0.66, y0 + 3);
    g.lineTo(W * 0.05, y0 + 3);
    g.closePath();
    g.fill();
  }
  // Quelques rayures fines, toutes dans le sens de la coupe.
  g.strokeStyle = kind === "noir" ? "rgba(190,196,204,0.2)" : "rgba(255,255,255,0.25)";
  g.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 6 + Math.random() * 20, y + (Math.random() - 0.5) * 2);
    g.stroke();
  }
  return finish(canvas);
}

/** Le fil : acier poli, des stries de meule tres fines et un reflet vif. */
function edgeTexture(): THREE.CanvasTexture {
  const W = 256;
  const H = 32;
  const { canvas, g } = canvas2d(W, H);
  const grad = g.createLinearGradient(0, H, 0, 0);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.35, "#dfe6ed");
  grad.addColorStop(1, "#aab3bc");
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  // Stries de meule, legerement obliques.
  for (let x = -H; x < W; x += 2) {
    g.strokeStyle = `rgba(${Math.random() < 0.5 ? "255,255,255" : "120,130,140"},${0.08 + Math.random() * 0.12})`;
    g.beginPath();
    g.moveTo(x, H);
    g.lineTo(x + H * 0.4, 0);
    g.stroke();
  }
  return finish(canvas);
}

/** Manches : chaque matiere a son grain. */
function handleTexture(kind: HandleFinish): THREE.CanvasTexture {
  const S = 128;
  const { canvas, g } = canvas2d(S, S);
  switch (kind) {
    case "caoutchouc": {
      g.fillStyle = "#1f2124";
      g.fillRect(0, 0, S, S);
      // Grain du caoutchouc moule.
      for (let i = 0; i < 1400; i++) {
        g.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.18)";
        g.fillRect(Math.random() * S, Math.random() * S, 1, 1);
      }
      break;
    }
    case "noyer": {
      const base = g.createLinearGradient(0, 0, 0, S);
      base.addColorStop(0, "#7a4a28");
      base.addColorStop(0.5, "#6a3f22");
      base.addColorStop(1, "#80502c");
      g.fillStyle = base;
      g.fillRect(0, 0, S, S);
      g.lineWidth = 1;
      for (let i = 0; i < 46; i++) {
        const y0 = Math.random() * S;
        g.strokeStyle = `rgba(${30 + Math.random() * 30},${16 + Math.random() * 14},8,${0.25 + Math.random() * 0.35})`;
        g.beginPath();
        for (let x = 0; x <= S; x += 6) {
          const y = y0 + Math.sin((x / S) * Math.PI * 2 + i) * 4 + Math.sin(x * 0.25 + i) * 1.2;
          if (x === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
      }
      // Loupe du bois : un noeud ou deux.
      for (let k = 0; k < 2; k++) {
        const cx = Math.random() * S;
        const cy = Math.random() * S;
        for (let r = 2; r < 12; r += 2.5) {
          g.strokeStyle = "rgba(40,20,8,0.3)";
          g.beginPath();
          g.ellipse(cx, cy, r * 1.8, r, 0, 0, Math.PI * 2);
          g.stroke();
        }
      }
      const shine = g.createLinearGradient(0, 0, S, S);
      shine.addColorStop(0, "rgba(255,220,170,0.14)");
      shine.addColorStop(0.5, "rgba(255,220,170,0)");
      shine.addColorStop(1, "rgba(255,220,170,0.1)");
      g.fillStyle = shine;
      g.fillRect(0, 0, S, S);
      break;
    }
    case "polymere": {
      g.fillStyle = "#b4b0a8";
      g.fillRect(0, 0, S, S);
      // Quadrillage antiderapant.
      g.strokeStyle = "rgba(20,18,14,0.45)";
      g.lineWidth = 1.2;
      for (let k = -S; k < S * 2; k += 6) {
        g.beginPath();
        g.moveTo(k, 0);
        g.lineTo(k + S, S);
        g.stroke();
        g.beginPath();
        g.moveTo(k, S);
        g.lineTo(k + S, 0);
        g.stroke();
      }
      break;
    }
    case "g10": {
      // Stratifie G10 : couches vert sombre et noires, poncees en vagues.
      g.fillStyle = "#23352a";
      g.fillRect(0, 0, S, S);
      for (let k = 0; k < 18; k++) {
        g.strokeStyle = k % 2 === 0 ? "rgba(70,110,80,0.55)" : "rgba(8,12,10,0.6)";
        g.lineWidth = 2.5;
        g.beginPath();
        for (let x = 0; x <= S; x += 4) {
          const y = (k / 18) * S + Math.sin(x * 0.07 + k * 1.3) * 5;
          if (x === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
      }
      break;
    }
    case "titane": {
      // Titane anodise : degrade bleu - violet - bronze, finition sablee.
      const grad = g.createLinearGradient(0, 0, S, S * 0.4);
      grad.addColorStop(0, "#3d5fb8");
      grad.addColorStop(0.45, "#7a4fb0");
      grad.addColorStop(0.75, "#b0784a");
      grad.addColorStop(1, "#d9a55a");
      g.fillStyle = grad;
      g.fillRect(0, 0, S, S);
      for (let i = 0; i < 1600; i++) {
        g.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.1)";
        g.fillRect(Math.random() * S, Math.random() * S, 1, 1);
      }
      break;
    }
  }
  return finish(canvas);
}

/** Acier des gardes et pommeaux : usinage fin et aretes plus claires. */
function metalTexture(): THREE.CanvasTexture {
  const S = 64;
  const { canvas, g } = canvas2d(S, S);
  g.fillStyle = "#a7afb8";
  g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 2) {
    g.fillStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.08})`;
    g.fillRect(0, y, S, 1);
  }
  g.fillStyle = "rgba(30,34,40,0.35)";
  for (let i = 0; i < 20; i++) g.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random() * 2, 1);
  return finish(canvas);
}

/** Gant tactique : tissu tresse, coutures, renforts plus sombres. */
function gloveTexture(): THREE.CanvasTexture {
  const S = 128;
  const { canvas, g } = canvas2d(S, S);
  g.fillStyle = "#a3a9af";
  g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 3) {
    for (let x = 0; x < S; x += 3) {
      g.fillStyle = (x / 3 + y / 3) % 2 === 0 ? "rgba(255,255,255,0.12)" : "rgba(20,22,26,0.2)";
      g.fillRect(x, y, 3, 3);
    }
  }
  g.strokeStyle = "rgba(15,17,20,0.55)";
  g.setLineDash([3, 3]);
  g.lineWidth = 1.4;
  for (const y of [20, 64, 108]) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(S, y);
    g.stroke();
  }
  g.setLineDash([]);
  return finish(canvas);
}

// ================================================================= la main
/**
 * Une main droite gantee, fermee sur un manche. Repere de la main : l'axe du
 * manche est X (l'index vers +X, l'auriculaire vers -X), le dos de la main
 * regarde +Z, les phalanges passent devant le manche (-Y) et le poignet part
 * vers l'arriere (+Y). Le manche passe par l'origine.
 */
interface HandParts {
  glove: THREE.BufferGeometry[];
  dark: THREE.BufferGeometry[];
  sleeve: THREE.BufferGeometry[];
}

/** Direction de l'avant-bras dans le repere de la main (vers le coude). */
const FOREARM_DIR = new THREE.Vector3(-0.62, 0.72, 0.3).normalize();

function buildHandParts(): HandParts {
  const glove: THREE.BufferGeometry[] = [];
  const dark: THREE.BufferGeometry[] = [];
  const sleeve: THREE.BufferGeometry[] = [];
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  /** Un doigt : un tube le long de ses phalanges, un bout arrondi. */
  const finger = (pts: THREE.Vector3[], r: number, knuckle = true) => {
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    glove.push(new THREE.TubeGeometry(curve, 14, r, 8, false));
    const end = pts[pts.length - 1];
    glove.push(new THREE.SphereGeometry(r, 10, 8).translate(end.x, end.y, end.z));
    if (knuckle) {
      // Articulation renforcee, un peu plus sombre (coque de protection).
      const k = pts[0];
      dark.push(new THREE.SphereGeometry(r * 1.2, 10, 8).translate(k.x, k.y, k.z));
    }
  };
  // Quatre doigts enroules autour du manche : phalange, phalangine, phalangette.
  const fingers: [number, number][] = [
    [0.03, 0.0098],
    [0.0095, 0.0102],
    [-0.0105, 0.0095],
    [-0.0288, 0.0084],
  ];
  fingers.forEach(([x, r], i) => {
    const drift = i * 0.0012;
    finger(
      [
        v(x, -0.024 + drift, 0.024),
        v(x, -0.031, 0.006),
        v(x - 0.001, -0.026, -0.013),
        v(x - 0.002, -0.009, -0.024),
        v(x - 0.002, 0.008, -0.02),
        v(x - 0.002, 0.016, -0.008),
      ],
      r,
    );
  });
  // Pouce : il part de la base de la paume et vient se poser sur l'index.
  finger(
    [v(0.028, 0.045, 0.012), v(0.045, 0.028, -0.004), v(0.05, 0.008, -0.022), v(0.046, -0.012, -0.028), v(0.04, -0.022, -0.024)],
    0.0112,
    false,
  );
  // Dos de la main, de la ligne des jointures au poignet.
  glove.push(new RoundedBoxGeometry(0.086, 0.078, 0.03, 3, 0.012).translate(0.0005, 0.011, 0.029));
  // Paume et eminence thenar : elles comblent l'arriere du manche.
  glove.push(new RoundedBoxGeometry(0.08, 0.034, 0.03, 3, 0.012).translate(0.002, 0.033, 0.006));
  glove.push(new THREE.SphereGeometry(0.02, 12, 10).scale(1.1, 1, 0.9).translate(0.026, 0.042, 0.004));
  // Renfort sur les jointures.
  dark.push(new RoundedBoxGeometry(0.078, 0.02, 0.012, 2, 0.005).translate(0, -0.018, 0.042));
  // Poignet, manchette du gant, puis la manche qui file vers le coude.
  const wrist = v(-0.012, 0.06, 0.02);
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(up, FOREARM_DIR);
  const along = (geo: THREE.BufferGeometry, from: number, to: number) => {
    geo.translate(0, (from + to) / 2, 0);
    geo.applyQuaternion(q);
    geo.translate(wrist.x, wrist.y, wrist.z);
    return geo;
  };
  glove.push(along(new THREE.CylinderGeometry(0.029, 0.027, 0.05, 14), -0.012, 0.038));
  dark.push(along(new THREE.CylinderGeometry(0.034, 0.033, 0.03, 14), 0.035, 0.065));
  sleeve.push(along(new THREE.CylinderGeometry(0.047, 0.04, 0.34, 14), 0.06, 0.4));
  // Revers de la manche : un bourrelet de tissu.
  sleeve.push(along(new THREE.TorusGeometry(0.041, 0.008, 8, 18).rotateX(Math.PI / 2), 0.064, 0.064));
  return { glove, dark, sleeve };
}

// ============================================================ l'animation
/**
 * Poses-cles : [t, px, py, pz, rx, ry, rz] a la suite. t va de 0 a 1 sur la
 * duree du geste ; positions en unites du modele, angles en radians.
 */
type Keys = readonly number[];
const STRIDE = 7;

/** Lit la pose a l'instant t (0..1), interpolee en douceur, dans `out`. */
function sampleKeys(keys: Keys, t: number, out: Float32Array) {
  const n = keys.length / STRIDE;
  if (t <= keys[0]) {
    for (let k = 0; k < 6; k++) out[k] = keys[k + 1];
    return;
  }
  for (let i = 0; i < n - 1; i++) {
    const a = i * STRIDE;
    const b = a + STRIDE;
    if (t < keys[b]) {
      const u = smooth((t - keys[a]) / (keys[b] - keys[a]));
      for (let k = 0; k < 6; k++) out[k] = keys[a + 1 + k] + (keys[b + 1 + k] - keys[a + 1 + k]) * u;
      return;
    }
  }
  const last = (n - 1) * STRIDE;
  for (let k = 0; k < 6; k++) out[k] = keys[last + 1 + k];
}

// Coup rapide : un revers de droite a gauche en diagonale (miroir un coup sur deux).
const QUICK_SECONDS = 0.42;
const QUICK_KEYS: Keys = [
  0, 0, 0, 0, 0, 0, 0,
  0.1, 0.07, 0.05, 0.03, 0.05, -0.3, -0.35,
  0.36, -0.2, -0.1, -0.13, -0.18, 0.62, 0.55,
  0.55, -0.24, -0.13, -0.07, -0.22, 0.7, 0.62,
  1, 0, 0, 0, 0, 0, 0,
];
// Coup lourd : on arme en arriere, on plonge vers le centre, on retire.
const HEAVY_SECONDS = 0.9;
const HEAVY_KEYS: Keys = [
  0, 0, 0, 0, 0, 0, 0,
  0.16, 0.035, 0.085, 0.15, 0.4, -0.1, 0.05,
  0.27, -0.13, 0.03, -0.36, -0.28, 0.24, -0.08,
  0.44, -0.12, 0.01, -0.32, -0.24, 0.22, -0.06,
  1, 0, 0, 0, 0, 0, 0,
];
// Inspection : le bras amene le couteau devant soi...
const INSPECT_ARM: Keys = [
  0, 0, 0, 0, 0, 0, 0,
  0.14, -0.11, 0.075, 0.02, 0.1, 0.36, 0.2,
  0.84, -0.12, 0.08, 0.02, 0.12, 0.4, 0.24,
  1, 0, 0, 0, 0, 0, 0,
];
// ... et le poignet le tourne : le plat vers soi, puis l'autre face.
const INSPECT_WRIST: Keys = [
  0, 0, 0, 0, 0, 0, 0,
  0.16, 0, 0, 0, 1.1, 0.12, 0,
  0.4, 0, 0, 0, 1.2, 0.2, 0.08,
  0.56, 0, 0, 0, -1.95, 0.1, -0.1,
  0.8, 0, 0, 0, -2.0, 0.0, -0.08,
  1, 0, 0, 0, 0, 0, 0,
];
// Sortie : le couteau monte du bas de l'ecran en se redressant.
const DRAW_SECONDS = 0.62;
const DRAW_KEYS: Keys = [
  0, 0.06, -0.24, 0.12, -0.7, 0.2, 0.5,
  0.55, 0.005, 0.01, 0.0, 0.05, 0, -0.03,
  1, 0, 0, 0, 0, 0, 0,
];

// Pose de repos, dans le repere du modele (voir DuelScene : l'arme est posee
// en bas a droite, echelle 0.66). Reglee a l'oeil.
const VM_SCALE = 1.5;
const REST_POS = new THREE.Vector3(0, 0.08, 0.3);
/** Ou pointe la lame au repos : vers l'avant, un peu a gauche et vers le haut. */
const REST_BLADE = new THREE.Vector3(-0.25, 0.5, -0.83).normalize();
/** Ou part l'avant-bras : vers le bas de l'ecran, a droite, vers soi. */
const REST_ARM = new THREE.Vector3(0.45, -0.55, 0.7).normalize();

/**
 * Orientation de repos de la main : la lame (axe X de la main) vise
 * REST_BLADE, et l'avant-bras (FOREARM_DIR) tombe dans le plan de REST_ARM.
 * Deux directions suffisent a fixer la rotation, sans angle a deviner.
 */
function restQuaternion(): THREE.Quaternion {
  const x = new THREE.Vector3(1, 0, 0);
  const f = FOREARM_DIR.clone().addScaledVector(x, -FOREARM_DIR.x).normalize();
  const from = new THREE.Matrix4().makeBasis(x, f, new THREE.Vector3().crossVectors(x, f));
  const d = REST_BLADE.clone();
  const a = REST_ARM.clone().addScaledVector(d, -REST_ARM.dot(d)).normalize();
  const to = new THREE.Matrix4().makeBasis(d, a, new THREE.Vector3().crossVectors(d, a));
  return new THREE.Quaternion().setFromRotationMatrix(to.multiply(from.transpose()));
}

/** Etat du papillon : 1 ouvert, 0 ferme ; entre les deux, les deux temps du geste. */
function butterflyAngles(open: number, out: { blade: number; handle: number }) {
  // Premier temps : la lame et le manche B tournent ensemble par-dessus
  // (pi -> 0). Second temps : le manche B finit son tour par-dessous et
  // revient se coller au manche A (pi -> 0).
  const a = ramp(open, 0, 0.5);
  const b = ramp(open, 0.5, 1);
  out.blade = Math.PI * (1 - a);
  out.handle = Math.PI * (1 - b);
}

// ======================================================= couteau en main
export function buildKnifeModel(id: KnifeId, look: WeaponLook = {}): KnifeModel {
  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => {
    owned.push(x);
    return x;
  };
  const style = STYLES[id];
  const build = buildParts(id);

  // --- Materiaux ---
  const bladeTex = keep(bladeTexture(style.blade));
  const edgeTex = keep(edgeTexture());
  const handleTex = keep(handleTexture(style.handle));
  const metalTex = keep(metalTexture());
  const gloveTex = keep(gloveTexture());
  if (style.handle === "caoutchouc") handleTex.repeat.set(2, 2);
  const mats: Record<Role, THREE.MeshLambertMaterial> = {
    lame: keep(new THREE.MeshLambertMaterial({ map: bladeTex, color: style.colors.lame })),
    // Le fil prend la lumiere : une pointe d'emission le garde clair meme
    // dans les coins sombres de l'arene.
    fil: keep(new THREE.MeshLambertMaterial({ map: edgeTex, color: style.colors.fil, emissive: 0x2c3034 })),
    garde: keep(new THREE.MeshLambertMaterial({ map: metalTex, color: style.colors.garde })),
    manche: keep(new THREE.MeshLambertMaterial({ map: handleTex, color: style.colors.manche })),
    accent: keep(new THREE.MeshLambertMaterial({ map: metalTex, color: style.colors.accent })),
    sombre: keep(new THREE.MeshLambertMaterial({ color: style.colors.sombre })),
  };
  const gloveMat = keep(new THREE.MeshLambertMaterial({ map: gloveTex, color: look.glove ?? 0x5b636c }));
  const gloveDarkMat = keep(
    new THREE.MeshLambertMaterial({ map: gloveTex, color: new THREE.Color(look.glove ?? 0x5b636c).multiplyScalar(0.55) }),
  );
  const sleeveMat = keep(new THREE.MeshLambertMaterial({ map: gloveTex, color: look.sleeve ?? 0x3a4038 }));

  // --- Hierarchie ---
  // group (place par la scene) > arm (mouvements du bras) > body (pose de
  // repos) > wrist (rotations du poignet) > main + couteau.
  const group = new THREE.Group();
  const arm = new THREE.Group();
  group.add(arm);
  const body = new THREE.Group();
  arm.add(body);
  body.scale.setScalar(VM_SCALE);
  body.quaternion.copy(restQuaternion());
  const wrist = new THREE.Group();
  body.add(wrist);

  // Main : fusionnee par materiau (trois appels de rendu).
  const hand = new THREE.Group();
  wrist.add(hand);
  const handParts = buildHandParts();
  const mergeKeep = (geos: THREE.BufferGeometry[]) => keep(mergeAll(geos));
  // Le gant garde une texture : on projette ses coordonnees depuis le dos de la main.
  const planarUv = (geo: THREE.BufferGeometry, scale: number) => {
    const p = geo.getAttribute("position");
    const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * scale + p.getZ(i) * scale * 0.5, p.getY(i) * scale);
    uv.needsUpdate = true;
  };
  const gloveGeo = mergeKeep(handParts.glove);
  planarUv(gloveGeo, 26);
  const darkGeo = mergeKeep(handParts.dark);
  planarUv(darkGeo, 26);
  const sleeveGeo = mergeKeep(handParts.sleeve);
  planarUv(sleeveGeo, 14);
  hand.add(new THREE.Mesh(gloveGeo, gloveMat), new THREE.Mesh(darkGeo, gloveDarkMat), new THREE.Mesh(sleeveGeo, sleeveMat));
  if (look.hands === false) hand.visible = false;

  // Couteau : son repere est pose dans la main (prise normale ou inversee).
  const knifeRoot = new THREE.Group();
  wrist.add(knifeRoot);
  if (build.reverse) knifeRoot.rotation.y = Math.PI;
  knifeRoot.position.set(build.reverse ? build.gripX : -build.gripX, 0, 0);
  // Pivot de l'inspection (anneau du karambit) : le couteau tourne autour.
  const spinPivot = new THREE.Group();
  knifeRoot.add(spinPivot);
  const knifeBody = new THREE.Group();
  spinPivot.add(knifeBody);
  if (build.spin) {
    spinPivot.position.copy(build.spin);
    knifeBody.position.copy(build.spin).multiplyScalar(-1);
  }
  // Papillon : la lame et le manche B pivotent (voir butterflyAngles).
  const bladeSwing = new THREE.Group();
  knifeBody.add(bladeSwing);
  const handleSwing = new THREE.Group();
  bladeSwing.add(handleSwing);
  const units: Record<Unit, THREE.Object3D> = { fixe: knifeBody, lame: bladeSwing, mancheB: handleSwing };
  // Fusion par materiau et par piece mobile : cinq a huit appels de rendu.
  for (const unit of ["fixe", "lame", "mancheB"] as Unit[]) {
    for (const role of Object.keys(mats) as Role[]) {
      const geos = build.parts.filter((p) => p.unit === unit && p.role === role).map((p) => p.geo);
      if (geos.length === 0) continue;
      const merged = mergeAll(geos);
      if (role !== "lame" && role !== "fil") {
        // Garde et manche : texture projetee sur le cote, dans la longueur.
        const p = merged.getAttribute("position");
        const uv = merged.getAttribute("uv") as THREE.BufferAttribute | undefined;
        if (uv) {
          for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * 9, p.getY(i) * 9 + p.getZ(i) * 4);
          uv.needsUpdate = true;
        }
      }
      units[unit].add(new THREE.Mesh(keep(merged), mats[role]));
    }
  }
  // Pointe de la lame : c'est de la que part le laser, s'il est allume.
  const flash = new THREE.Object3D();
  flash.position.copy(build.tip);
  (id === "papillon" ? bladeSwing : knifeBody).add(flash);
  const ejectPort = new THREE.Object3D();
  knifeBody.add(ejectPort);

  // --- Etat de l'animation ---
  const pose = new Float32Array(6);
  const wristPose = new Float32Array(6);
  const bfly = { blade: 0, handle: 0 };
  let lastTime = -1;
  let drawAt = -10;
  let strikeAt = -10;
  let strikeKind: KnifeStrike = "rapide";
  let strikeSide = 1;
  let inspectAt = -10;
  // File des bruits (quatre places, sans allocation).
  const sounds: (KnifeFoley | null)[] = [null, null, null, null];
  let soundHead = 0;
  let soundCount = 0;
  const pushSound = (s: KnifeFoley) => {
    if (soundCount >= sounds.length) return;
    sounds[(soundHead + soundCount) % sounds.length] = s;
    soundCount += 1;
  };
  /** Ouverture du papillon a l'instant precedent, pour caler les cliquetis. */
  let lastOpen = 1;
  let spinSoundDone = false;

  function strike(kind: KnifeStrike, time: number) {
    // Deux coups rapides de suite partent de cotes opposes.
    const chained = strikeKind === "rapide" && time - strikeAt < QUICK_SECONDS + 0.35;
    strikeSide = kind === "rapide" && chained ? -strikeSide : 1;
    strikeKind = kind;
    strikeAt = time;
    inspectAt = -10;
  }

  function inspect(time: number) {
    if (time - strikeAt < (strikeKind === "lourd" ? HEAVY_SECONDS : QUICK_SECONDS)) return;
    if (time - inspectAt < KNIFE_INSPECT_SECONDS) return;
    inspectAt = time;
    spinSoundDone = false;
    pushSound("frottement");
  }

  function update(anim: WeaponAnim) {
    const t = anim.time;
    // Revenu a l'ecran apres un moment cache : on vient de sortir le couteau.
    if (lastTime < 0 || t - lastTime > 0.25 || t < lastTime) {
      drawAt = t;
      inspectAt = -10;
      strikeAt = -10;
      lastOpen = id === "papillon" ? 0 : 1;
      pushSound("sortie");
    }
    lastTime = t;

    // --- Bras : repos, sortie, coups, inspection ---
    for (let k = 0; k < 6; k++) pose[k] = 0;
    for (let k = 0; k < 6; k++) wristPose[k] = 0;
    const sinceDraw = t - drawAt;
    const drawSpan = id === "papillon" ? DRAW_SECONDS + 0.25 : DRAW_SECONDS;
    if (sinceDraw < drawSpan) {
      sampleKeys(DRAW_KEYS, sinceDraw / drawSpan, pose);
    }
    const sinceStrike = t - strikeAt;
    const strikeSpan = strikeKind === "lourd" ? HEAVY_SECONDS : QUICK_SECONDS;
    if (sinceStrike < strikeSpan) {
      sampleKeys(strikeKind === "lourd" ? HEAVY_KEYS : QUICK_KEYS, sinceStrike / strikeSpan, pose);
      if (strikeKind === "rapide" && strikeSide < 0) {
        // Le revers : meme geste, en miroir.
        pose[0] = -pose[0] * 0.9;
        pose[4] = -pose[4];
        pose[5] = -pose[5];
      }
      // Le poignet casse dans le sens du coup : la lame mene.
      const k = Math.sin(clamp01(sinceStrike / strikeSpan) * Math.PI);
      wristPose[3] = (strikeKind === "lourd" ? -0.5 : 0.35 * strikeSide) * k;
    }
    const sinceInspect = t - inspectAt;
    const inspectOn = sinceInspect < KNIFE_INSPECT_SECONDS;
    if (inspectOn) {
      const u = sinceInspect / KNIFE_INSPECT_SECONDS;
      sampleKeys(INSPECT_ARM, u, pose);
      if (id !== "karambit") sampleKeys(INSPECT_WRIST, u, wristPose);
      else {
        // Le karambit se montre d'abord de profil, puis tourne autour de l'index.
        wristPose[3] = 0.9 * ramp(u, 0.05, 0.18) * (1 - ramp(u, 0.86, 1));
        wristPose[4] = 0.25 * ramp(u, 0.05, 0.18) * (1 - ramp(u, 0.86, 1));
      }
    }
    // Respiration, et la lame qui s'abaisse en sprint.
    const breath = Math.sin(t * 1.25);
    pose[0] += Math.sin(t * 0.8) * 0.003;
    pose[1] += breath * 0.004 - anim.sprint * 0.07;
    pose[2] += anim.sprint * 0.04;
    pose[3] += breath * 0.012 + anim.sprint * 0.55;
    pose[4] += anim.sprint * 0.25;
    pose[5] += anim.sprint * -0.35;
    arm.position.set(REST_POS.x + pose[0], REST_POS.y + pose[1], REST_POS.z + pose[2]);
    arm.rotation.set(pose[3], pose[4], pose[5]);
    wrist.rotation.set(wristPose[3], wristPose[4], wristPose[5]);

    // --- Karambit : un tour complet autour de l'anneau pendant l'inspection ---
    if (build.spin) {
      let spin = 0;
      if (inspectOn) {
        const u = sinceInspect / KNIFE_INSPECT_SECONDS;
        spin = -Math.PI * 2 * ramp(u, 0.3, 0.52) - Math.PI * 2 * ramp(u, 0.6, 0.8);
        if (!spinSoundDone && u > 0.3) {
          spinSoundDone = true;
          pushSound("tour");
          pushSound("tour");
        }
      }
      spinPivot.rotation.z = spin;
    }

    // --- Papillon : ouverture a la sortie, fermeture et reouverture a l'inspection ---
    if (id === "papillon") {
      let open = 1;
      if (sinceDraw < drawSpan) open = ramp(sinceDraw / drawSpan, 0.08, 0.7);
      if (inspectOn) {
        const u = sinceInspect / KNIFE_INSPECT_SECONDS;
        open = 1 - ramp(u, 0.2, 0.4) + ramp(u, 0.46, 0.68);
      }
      // Un « clac » a chaque fois que les manches se rejoignent, un
      // sifflement quand la lame passe par-dessus.
      if ((lastOpen < 0.985 && open >= 0.985) || (lastOpen > 0.015 && open <= 0.015)) pushSound("clac");
      if ((lastOpen < 0.25 && open >= 0.25) || (lastOpen > 0.75 && open <= 0.75)) pushSound("tour");
      lastOpen = open;
      butterflyAngles(open, bfly);
      bladeSwing.rotation.z = bfly.blade;
      handleSwing.rotation.z = bfly.handle;
    }
  }

  function nextSound(): KnifeFoley | null {
    if (soundCount === 0) return null;
    const s = sounds[soundHead];
    sounds[soundHead] = null;
    soundHead = (soundHead + 1) % sounds.length;
    soundCount -= 1;
    return s;
  }

  update({ time: 0, recoil: 0, reload: 0, aim: 0, sprint: 0 });
  // La construction n'est pas une sortie : on vide la file.
  while (nextSound()) {
    // rien
  }
  lastTime = -1;

  let disposed = false;
  return {
    knife: id,
    group,
    flash,
    ejectPort,
    casing: "laiton",
    ejectOnShot: false,
    flashLight: 0,
    reloadStyle: "chargeur",
    cycleCues: [],
    reloadCues: () => [],
    fireFlash: () => {},
    update,
    strike,
    inspect,
    inspecting: (time: number) => time - inspectAt < KNIFE_INSPECT_SECONDS,
    nextSound,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const o of owned) o.dispose();
    },
  };
}

// ================================================ couteau vu de loin (bots)
/**
 * Les couteaux des autres combattants, accroches a l'os de la main (Wrist.R)
 * du soldat anime. Vus a quelques metres : une seule geometrie par couteau,
 * couleurs dans les sommets, un seul materiau partage — un appel de rendu par
 * soldat, et rien de recree quand un bot reapparait.
 */
export interface KnifeProps {
  /** Un couteau pret a accrocher (m.attach("Wrist.R", objet, "Idle_Gun_Pointing")). */
  make(id: KnifeId): THREE.Group;
  dispose(): void;
}

/**
 * Ou tombe le manche dans la main du soldat, dans le repere de l'os du
 * poignet tel que `attach` le presente (pose « Idle_Gun_Pointing » : +Z
 * devant, +Y en haut). Mesure dans Blender sur les os des doigts du SWAT.
 */
const PROP_GRIP = new THREE.Vector3(0.016, -0.02, 0.165);
/** La lame penche un peu vers l'avant quand le bras vise. */
const PROP_TILT = 0.3;
const PROP_SCALE = 1.12;

export function createKnifeProps(): KnifeProps {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const geos = new Map<KnifeId, THREE.BufferGeometry>();
  const color = new THREE.Color();

  function geometryFor(id: KnifeId): THREE.BufferGeometry {
    const cached = geos.get(id);
    if (cached) return cached;
    const build = buildParts(id);
    const far = STYLES[id].far;
    const flat: THREE.BufferGeometry[] = [];
    for (const p of build.parts) {
      const g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
      if (g !== p.geo) p.geo.dispose();
      for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal") g.deleteAttribute(name);
      if (!g.getAttribute("normal")) g.computeVertexNormals();
      color.setHex(far[p.role]);
      // Les teintes de sommet sont lues en espace lineaire.
      color.convertSRGBToLinear();
      const count = g.getAttribute("position").count;
      const col = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        col[i * 3] = color.r;
        col[i * 3 + 1] = color.g;
        col[i * 3 + 2] = color.b;
      }
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      flat.push(g);
    }
    const merged = mergeGeometries(flat, false)!;
    for (const g of flat) g.dispose();
    // Repere du couteau -> repere de la main : la lame monte (un peu vers
    // l'avant), le fil regarde devant, comme un poing ferme sur le manche.
    const c = Math.cos(PROP_TILT);
    const s = Math.sin(PROP_TILT);
    const dir = build.reverse ? -1 : 1;
    const m = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(0, c * dir, s * dir),
      new THREE.Vector3(0, s, -c),
      new THREE.Vector3(-dir, 0, 0),
    );
    merged.translate(-build.gripX, 0, 0);
    merged.scale(PROP_SCALE, PROP_SCALE, PROP_SCALE);
    merged.applyMatrix4(m);
    merged.translate(PROP_GRIP.x, PROP_GRIP.y, PROP_GRIP.z);
    merged.computeBoundingSphere();
    geos.set(id, merged);
    return merged;
  }

  return {
    make(id) {
      const holder = new THREE.Group();
      const mesh = new THREE.Mesh(geometryFor(id), material);
      // Le soldat anime sort de sa boite de depart : pas d'elimination hors champ.
      mesh.frustumCulled = false;
      holder.add(mesh);
      return holder;
    },
    dispose() {
      for (const g of geos.values()) g.dispose();
      geos.clear();
      material.dispose();
    },
  };
}

// ==================================================== icone du casier (SVG)
export interface KnifeIcon {
  viewBox: string;
  blade: string;
  edge: string;
  guard: string;
  handle: string;
  rings: { cx: number; cy: number; r: number; w: number }[];
  colors: { blade: string; edge: string; guard: string; handle: string };
}

const hexCss = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

/**
 * La silhouette du couteau, tiree des memes profils que le modele 3D : ce
 * qu'on voit dans le casier est ce qu'on tient en partie. Aucun DOM ici.
 */
export function knifeIcon(id: KnifeId): KnifeIcon {
  const p = BLADES[id];
  const c = new THREE.Vector2();
  const c2 = new THREE.Vector2();
  const spine: [number, number][] = [];
  const edge: [number, number][] = [];
  const grind: [number, number][] = [];
  for (let i = 0; i <= p.n; i++) {
    const t = i / p.n;
    p.center(Math.min(1, t + 0.01), c2);
    const bx = c2.x;
    const by = c2.y;
    p.center(Math.max(0, t - 0.01), c2);
    let tx = bx - c2.x;
    let ty = by - c2.y;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    p.center(t, c);
    const s = t >= 1 ? 0 : p.up(t);
    const e = t >= 1 ? 0 : p.down(t);
    spine.push([c.x - ty * s, c.y + tx * s]);
    edge.push([c.x + ty * e, c.y - tx * e]);
    grind.push([c.x + ty * e - ty * p.grind * (s + e), c.y - tx * e + tx * p.grind * (s + e)]);
  }
  // Manche et garde : les contours des pieces, vus de cote.
  const outline: Record<KnifeId, { guard: [number, number][]; handle: [number, number][]; rings: [number, number, number, number][] }> = {
    combat: {
      guard: [[-0.0075, 0.025], [0.001, 0.025], [0.004, -0.03], [-0.007, -0.031]],
      handle: [[-0.007, 0.0125], [-0.06, 0.015], [-0.119, 0.013], [-0.1335, 0.009], [-0.1335, -0.009], [-0.119, -0.013], [-0.06, -0.015], [-0.007, -0.0125]],
      rings: [],
    },
    chasse: {
      guard: [[-0.0065, 0.017], [0.001, 0.018], [0.0015, -0.024], [-0.0065, -0.024]],
      handle: [[-0.006, 0.0135], [-0.102, 0.0152], [-0.118, 0.006], [-0.114, -0.016], [-0.093, -0.0158], [-0.078, -0.019], [-0.06, -0.0152], [-0.043, -0.0188], [-0.024, -0.0148], [-0.006, -0.0172]],
      rings: [],
    },
    baionnette: {
      guard: [[-0.0085, 0.028], [0.0008, 0.028], [0.0008, -0.02], [-0.0085, -0.02]],
      handle: [[-0.008, 0.0128], [-0.112, 0.013], [-0.129, 0.015], [-0.129, -0.016], [-0.112, -0.0145], [-0.008, -0.0148]],
      rings: [[-0.0042, 0.0355, 0.0082, 0.0026]],
    },
    karambit: {
      guard: [[-0.0085, 0.013], [0.0005, 0.013], [0.0005, -0.0135], [-0.0085, -0.0135]],
      handle: [[-0.007, 0.012], [-0.035, 0.0118], [-0.058, 0.006], [-0.072, -0.005], [-0.079, -0.018], [-0.069, -0.024], [-0.058, -0.014], [-0.04, -0.0108], [-0.02, -0.0118], [-0.007, -0.0125]],
      rings: [[-0.0835, -0.0285, 0.0158, 0.0052]],
    },
    papillon: {
      guard: [[-0.003, 0.0035], [0.003, 0.0035], [0.003, -0.0035], [-0.003, -0.0035]],
      handle: [[0.004, 0.0112], [-0.098, 0.0112], [-0.108, 0], [-0.098, -0.0112], [0.004, -0.0112]],
      rings: [],
    },
  };
  const o = outline[id];
  const all = [...spine, ...edge, ...o.guard, ...o.handle];
  for (const [x, y, r] of o.rings) all.push([x - r, y - r], [x + r, y + r]);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of all) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  // Unites SVG : 1 = 1 mm, et 2 mm de marge.
  const k = 1000;
  const X = (x: number) => ((x - minX) * k + 2).toFixed(1);
  const Y = (y: number) => ((maxY - y) * k + 2).toFixed(1);
  const path = (pts: [number, number][]) => `M${pts.map(([x, y]) => `${X(x)} ${Y(y)}`).join(" L")} Z`;
  const style = STYLES[id];
  return {
    viewBox: `0 0 ${((maxX - minX) * k + 4).toFixed(1)} ${((maxY - minY) * k + 4).toFixed(1)}`,
    blade: path([...spine, ...edge.slice().reverse()]),
    edge: path([...edge, ...grind.slice().reverse()]),
    guard: path(o.guard),
    handle: path(o.handle),
    rings: o.rings.map(([x, y, r, w]) => ({ cx: Number(X(x)), cy: Number(Y(y)), r: r * k, w: w * k * 2 })),
    colors: {
      blade: hexCss(style.far.lame),
      edge: hexCss(style.far.fil),
      guard: hexCss(style.far.garde),
      handle: hexCss(style.far.manche),
    },
  };
}
