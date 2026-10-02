// Les cartes de « Tonnerre d'Acier ».
//
// Quatre champs de bataille de 600 m de cote entoures de montagnes (decor
// seulement), chacun avec son relief, ses villages, ses routes, son eau et
// sa vegetation :
//  - Castelroc : village perche mediterraneen, oliveraies, lac au creux du vallon ;
//  - Col du Givre : une crete enneigee coupee par un col, sapins, lac gele ;
//  - Oasis d'Ambre : dunes, plateaux rocheux, village de terre autour de l'oasis ;
//  - Val-aux-Moulins : bocage, riviere a deux ponts et un gue, moulins sur les buttes.
//
// Tout est deterministe (une graine), et pur : ce module ne cree aucun objet
// three.js, il decrit la carte et repond aux questions de la simulation
// (hauteur du sol, obstacles, ligne de vue, chemins).

/** Demi-cote de la zone jouable, en metres. */
export const MAP_HALF = 300;
/** Demi-cote du terrain dessine (montagnes de decor comprises). */
export const WORLD_HALF = 460;
/** Pas de la grille des hauteurs, en metres. */
export const HEIGHT_STEP = 2.5;
/** Niveau de l'eau de Castelroc ; chaque carte a le sien (map.waterLevel). */
export const WATER_LEVEL = -1.6;
/** Rayon des cercles de capture. */
export const BASE_RADIUS = 26;
/** Pas de la grille de navigation des bots, en metres. */
export const NAV_STEP = 5;

export type MapId = "castelroc" | "col-givre" | "oasis-ambre" | "val-moulins";
export type Biome = "mediterraneen" | "hiver" | "desert" | "bocage";
/** Lac, lac gele (on roule dessus), mare d'oasis, ou riviere (des ponts et un gue pour passer). */
export type WaterKind = "lac" | "glace" | "oasis" | "riviere";

export interface MapInfo {
  id: MapId;
  name: string;
  biome: Biome;
  tagline: string;
}

export const MAP_LIST: MapInfo[] = [
  { id: "castelroc", name: "Castelroc", biome: "mediterraneen", tagline: "Village perché, oliveraies et lac au creux du vallon." },
  { id: "col-givre", name: "Col du Givre", biome: "hiver", tagline: "Une crête enneigée, un col au milieu et un lac gelé où l'on roule." },
  { id: "oasis-ambre", name: "Oasis d'Ambre", biome: "desert", tagline: "Dunes, plateaux rocheux et village de terre autour de l'oasis." },
  { id: "val-moulins", name: "Val-aux-Moulins", biome: "bocage", tagline: "Une rivière, deux ponts et un gué, des haies et des moulins." },
];

export function mapInfo(id: string | null | undefined): MapInfo {
  return MAP_LIST.find((m) => m.id === id) ?? MAP_LIST[0];
}

export interface House {
  x: number;
  z: number;
  /** Largeur (x), profondeur (z) et hauteur des murs. */
  w: number;
  d: number;
  h: number;
  /** Le faitage court le long de x (sinon le long de z). */
  ridgeX: boolean;
  /** 0 = maison, 1 = ferme ou grange, 2 = eglise ou caravanserail, 3 = clocher ou tour, 4 = moulin a vent. */
  kind: number;
  /** Hauteur du sol sous la maison. */
  y: number;
  /** Hauteur du toit au-dessus des murs (un toit plat a parapet : 0,5). */
  roof: number;
}

export interface Wall {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  h: number;
}

export interface Rock {
  x: number;
  z: number;
  r: number;
  y: number;
}

export interface Tree {
  x: number;
  z: number;
  /**
   * Trois essences par climat : mediterraneen (olivier, cypres, pin parasol),
   * hiver (sapin, bouleau, grand sapin), desert (palmier, acacia, grand
   * palmier), bocage (chene, peuplier, pommier).
   */
  kind: number;
  scale: number;
  y: number;
}

/** Un pont : tablier de (x0, z0) a (x1, z1), large de `w`, qui monte de y0 a y1. */
export interface Bridge {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  w: number;
  y0: number;
  y1: number;
}

export interface TankMap {
  id: MapId;
  name: string;
  biome: Biome;
  seed: number;
  /** Demi-cote de la zone jouable (MAP_HALF, plus pour une carte agrandie). */
  half: number;
  /** Demi-cote du terrain dessine, montagnes de decor comprises. */
  world: number;
  /** Hauteurs sur une grille reguliere couvrant tout le monde dessine. */
  heights: Float32Array;
  hn: number;
  houses: House[];
  walls: Wall[];
  rocks: Rock[];
  trees: Tree[];
  bushes: { x: number; z: number; s: number; y: number }[];
  /** Routes : suites de points (x, z). */
  roads: [number, number][][];
  /** Champs : rectangles colores sur le sol. */
  fields: { x: number; z: number; w: number; d: number; kind: number }[];
  bases: [{ x: number; z: number }, { x: number; z: number }];
  /** Emplacements de depart par equipe, avec le cap initial. */
  spawns: [{ x: number; z: number; yaw: number }[], { x: number; z: number; yaw: number }[]];
  waterKind: WaterKind;
  waterLevel: number;
  /** Lac, lac gele ou mare de l'oasis (r = 0 : pas de lac). */
  lake: { x: number; z: number; r: number };
  /** Riviere : son trace et sa largeur (null : pas de riviere). */
  river: { pts: [number, number][]; width: number } | null;
  bridges: Bridge[];
  /** Gues : on traverse la riviere a cet endroit, l'eau aux chenilles. */
  fords: [number, number][];
  /** Grille de navigation : 1 = infranchissable. */
  nav: Uint8Array;
  navN: number;
  /** Points de passage des trois couloirs, de la base 0 vers la base 1. */
  lanes: [number, number][][];
  /** Villages : centre et rayon de leur place (le premier est le principal). */
  villages: { x: number; z: number; r: number }[];
  /** Nom du village principal. */
  villageName: string;
}

// ------------------------------------------------------------- bruit

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Bruit de valeur lisse, 0 a 1. */
export function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Somme de plusieurs octaves, 0 a 1. */
export function fbm(x: number, y: number, seed: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x * f, y * f, seed + o * 31) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

/** Distance d'un point a une ligne brisee. */
export function distToPolyline(x: number, z: number, pts: [number, number][]): number {
  let best = Infinity;
  for (let k = 0; k + 1 < pts.length; k++) {
    const d = distToSegment(x, z, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]);
    if (d < best) best = d;
  }
  return best;
}

/** Montagnes de decor au-dela de la zone jouable. */
function outerMountains(x: number, z: number, seed: number, height: number): number {
  const edge = Math.max(Math.abs(x), Math.abs(z));
  const m = smoothstep(MAP_HALF - 10, MAP_HALF + 130, edge);
  return m * (height + (fbm(x / 90, z / 90, seed + 21) - 0.5) * 70);
}

// ------------------------------------------------------------- les plans

type Pt = { x: number; z: number };

interface Plan {
  name: string;
  biome: Biome;
  bases: [Pt, Pt];
  /** Plateaux aplanis pour poser les villages (le premier est le principal). */
  villages: { x: number; z: number; r: number }[];
  waterKind: WaterKind;
  waterLevel: number;
  lake: { x: number; z: number; r: number };
  river: { pts: [number, number][]; width: number } | null;
  /** Ponts (la riviere passe dessous) et gues (le lit remonte, l'eau reste basse). */
  bridgeAt: [number, number][];
  fords: [number, number][];
  relief: (x: number, z: number, seed: number) => number;
  villageName: string;
}

// Castelroc : la vallee d'origine.
const CASTEL_VILLAGE = { x: 30, z: -20, r: 46 };
const CASTEL_LAKE = { x: -175, z: -35, r: 38 };

function castelrocRelief(x: number, z: number, seed: number): number {
  let h = (fbm(x / 140, z / 140, seed) - 0.5) * 16;
  h += (fbm(x / 45, z / 45, seed + 7, 3) - 0.5) * 3;
  // La colline du village : un dome large et un plateau au sommet.
  const dv = Math.hypot(x - CASTEL_VILLAGE.x, z - CASTEL_VILLAGE.z);
  h += 24 * Math.exp(-(dv * dv) / (2 * 78 * 78));
  // La crete de l'est : une longue bosse orientee nord-sud.
  const dr = Math.abs(x - 170 - Math.sin(z / 60) * 18);
  h += 13 * Math.exp(-(dr * dr) / (2 * 26 * 26)) * smoothstep(-280, -60, z) * (1 - smoothstep(120, 260, z));
  // Le vallon de l'ouest, et la cuvette du lac.
  const dw = Math.abs(x + 150 + Math.sin(z / 80) * 25);
  h -= 6 * Math.exp(-(dw * dw) / (2 * 40 * 40));
  const dl = Math.hypot(x - CASTEL_LAKE.x, z - CASTEL_LAKE.z);
  h -= 9 * Math.exp(-(dl * dl) / (2 * 30 * 30));
  return h + outerMountains(x, z, seed, 55);
}

// Col du Givre : une crete nord-sud aux flancs raides, coupee par un col au
// milieu ; elle s'efface au nord (un passage) et au sud (le lac gele).
function givreRelief(x: number, z: number, seed: number): number {
  let h = (fbm(x / 150, z / 150, seed) - 0.5) * 18;
  h += (fbm(x / 50, z / 50, seed + 7, 3) - 0.5) * 4;
  const dr = Math.abs(x - Math.sin(z / 70) * 25);
  let ridge = 34 * Math.exp(-(dr * dr) / (2 * 30 * 30));
  ridge *= 1 - 0.8 * Math.exp(-((z + 10) * (z + 10)) / (2 * 34 * 34));
  ridge *= smoothstep(-160, -90, z) * (1 - smoothstep(120, 190, z));
  h += ridge;
  return h + outerMountains(x, z, seed, 80);
}

// Oasis d'Ambre : dunes, plateaux rocheux a falaises, un oued a sec.
const MESAS = [
  { x: -120, z: -80, r: 30, h: 16 },
  { x: 140, z: 90, r: 30, h: 16 },
  { x: 160, z: -120, r: 24, h: 13 },
  { x: -160, z: 120, r: 24, h: 13 },
];
const AMBRE_VILLAGE = { x: 15, z: 5, r: 60 };

function ambreRelief(x: number, z: number, seed: number): number {
  let h = (fbm(x / 130, z / 130, seed) - 0.5) * 8;
  // Dunes : des cretes paralleles, ondulees par le bruit.
  const w = Math.sin((x * 0.8 + z * 0.6) / 26 + fbm(x / 120, z / 120, seed + 3) * 5);
  h += 5.5 * w * w;
  for (const m of MESAS) {
    const d = Math.hypot(x - m.x, z - m.z) + (fbm(x / 14, z / 14, seed + 9, 2) - 0.5) * 8;
    h += m.h * (1 - smoothstep(m.r - 6, m.r + 5, d));
  }
  // L'oued : un lit de riviere a sec qui serpente d'est en ouest.
  const dw = Math.abs(z + 130 - 25 * Math.sin(x / 70));
  h -= 4 * Math.exp(-(dw * dw) / (2 * 14 * 14));
  return h + outerMountains(x, z, seed, 50);
}

// Val-aux-Moulins : collines douces, buttes des moulins, riviere en travers.
const MOULIN_HILLS = [
  { x: -170, z: -20 },
  { x: 190, z: 60 },
  { x: -40, z: 190 },
  { x: 40, z: -190 },
];
const MOULIN_RIVER: [number, number][] = [
  [-470, -440],
  [-330, -300],
  [-210, -190],
  [-120, -95],
  [-40, -40],
  [20, 30],
  [90, 95],
  [190, 185],
  [330, 300],
  [470, 440],
];

function moulinsRelief(x: number, z: number, seed: number): number {
  let h = (fbm(x / 160, z / 160, seed) - 0.5) * 16;
  h += (fbm(x / 60, z / 60, seed + 5, 3) - 0.5) * 4;
  for (const m of MOULIN_HILLS) {
    const d = Math.hypot(x - m.x, z - m.z);
    h += 10 * Math.exp(-(d * d) / (2 * 34 * 34));
  }
  // La vallee s'ouvre dans les montagnes la ou la riviere entre et sort.
  const open = 0.2 + 0.8 * smoothstep(25, 120, distToPolyline(x, z, MOULIN_RIVER));
  return h + outerMountains(x, z, seed, 45) * open;
}

function planFor(id: MapId): Plan {
  switch (id) {
    case "col-givre":
      return {
        name: "Col du Givre",
        biome: "hiver",
        bases: [
          { x: -235, z: 40 },
          { x: 235, z: -40 },
        ],
        villages: [
          { x: -80, z: -20, r: 28 },
          { x: 85, z: 5, r: 26 },
        ],
        waterKind: "glace",
        waterLevel: -1,
        lake: { x: 30, z: -200, r: 52 },
        river: null,
        bridgeAt: [],
        fords: [],
        relief: givreRelief,
        villageName: "Les Chalets",
      };
    case "oasis-ambre":
      return {
        name: "Oasis d'Ambre",
        biome: "desert",
        bases: [
          { x: 0, z: -245 },
          { x: 0, z: 245 },
        ],
        villages: [AMBRE_VILLAGE],
        waterKind: "oasis",
        waterLevel: -1.2,
        lake: { x: AMBRE_VILLAGE.x, z: AMBRE_VILLAGE.z, r: 16 },
        river: null,
        bridgeAt: [],
        fords: [],
        relief: ambreRelief,
        villageName: "El-Ambra",
      };
    case "val-moulins":
      return {
        name: "Val-aux-Moulins",
        biome: "bocage",
        bases: [
          { x: -215, z: 215 },
          { x: 215, z: -215 },
        ],
        villages: [
          { x: 60, z: -60, r: 36 },
          { x: -110, z: 70, r: 26 },
        ],
        waterKind: "riviere",
        waterLevel: -1.4,
        lake: { x: 0, z: 0, r: 0 },
        river: { pts: MOULIN_RIVER, width: 16 },
        bridgeAt: [
          [-125, -100],
          [95, 100],
        ],
        fords: [[-10, -5]],
        relief: moulinsRelief,
        villageName: "Val-aux-Moulins",
      };
    default:
      return {
        name: "Castelroc",
        biome: "mediterraneen",
        bases: [
          { x: -215, z: 215 },
          { x: 215, z: -215 },
        ],
        villages: [CASTEL_VILLAGE],
        waterKind: "lac",
        waterLevel: WATER_LEVEL,
        lake: CASTEL_LAKE,
        river: null,
        bridgeAt: [],
        fords: [],
        relief: castelrocRelief,
        villageName: "Castelroc",
      };
  }
}

/** Hauteur finale : relief, plateaux des villages et des bases, lac gele, mare, riviere. */
function heightAt(plan: Plan, x: number, z: number, seed: number, villageY: number[], baseY: [number, number]): number {
  let h = plan.relief(x, z, seed);
  plan.villages.forEach((v, k) => {
    const dv = Math.hypot(x - v.x, z - v.z);
    const kv = 1 - smoothstep(v.r - 8, v.r + 10, dv);
    h = h + (villageY[k] - h) * kv;
  });
  for (let b = 0; b < 2; b++) {
    const db = Math.hypot(x - plan.bases[b].x, z - plan.bases[b].z);
    const kb = 1 - smoothstep(40, 70, db);
    h = h + (baseY[b] - h) * kb;
  }
  const lk = plan.lake;
  if (lk.r > 0 && plan.waterKind === "glace") {
    // Lac gele : une surface plate au niveau de l'eau, des rives en pente douce.
    const d = Math.hypot(x - lk.x, z - lk.z);
    const k = 1 - smoothstep(lk.r - 4, lk.r + 18, d);
    h = h + (plan.waterLevel + 0.05 - h) * k;
  } else if (lk.r > 0 && plan.waterKind === "oasis") {
    // Mare de l'oasis : une cuvette sous le niveau de l'eau.
    const d = Math.hypot(x - lk.x, z - lk.z);
    const k = 1 - smoothstep(lk.r - 6, lk.r + 8, d);
    h = h + (plan.waterLevel - 2.2 - h) * k;
  }
  if (plan.river) {
    const d = distToPolyline(x, z, plan.river.pts);
    const half = plan.river.width / 2;
    // Berges : pres de la riviere le sol reste au-dessus de l'eau (elle ne deborde pas).
    const lift = 1 - smoothstep(half + 10, half + 30, d);
    if (lift > 0) h = h + (Math.max(h, plan.waterLevel + 0.6) - h) * lift;
    // Le lit, creuse sous l'eau ; au gue, il remonte presque a la surface.
    const carve = 1 - smoothstep(half, half + 7, d);
    if (carve > 0) {
      let shallow = 0;
      for (const [fx, fz] of plan.fords) shallow = Math.max(shallow, 1 - smoothstep(12, 26, Math.hypot(x - fx, z - fz)));
      const deep = Math.min(h, plan.waterLevel - 1.8);
      const bed = deep + (plan.waterLevel - 0.45 - deep) * shallow;
      h = h + (bed - h) * carve;
    }
  }
  return h;
}

// --------------------------------------------------------- carte

/**
 * Construit une carte. `scale` (1,5 pour la grande bataille a quinze contre
 * quinze) etire le meme paysage : relief, villages, routes et bases
 * s'ecartent, les maisons, arbres et rochers gardent leur taille.
 */
export function buildTankMap(seed: number, mapId: MapId = "castelroc", scale = 1): TankMap {
  const plan = planFor(mapId);
  // Castelroc garde exactement son tirage d'origine.
  const rnd = mulberry32((seed || 1) + (mapId === "castelroc" ? 0 : mapId.length * 7919));
  const villageY = plan.villages.map((v) => Math.max(plan.relief(v.x, v.z, seed) - 1.5, plan.waterLevel + 1.6));
  const baseY: [number, number] = [plan.relief(plan.bases[0].x, plan.bases[0].z, seed), plan.relief(plan.bases[1].x, plan.bases[1].z, seed)];

  const hn = Math.round((WORLD_HALF * 2) / HEIGHT_STEP) + 1;
  const heights = new Float32Array(hn * hn);
  for (let j = 0; j < hn; j++) {
    const z = -WORLD_HALF + j * HEIGHT_STEP;
    for (let i = 0; i < hn; i++) {
      const x = -WORLD_HALF + i * HEIGHT_STEP;
      heights[j * hn + i] = heightAt(plan, x, z, seed, villageY, baseY);
    }
  }
  const sample = (x: number, z: number) => heightFromGrid(heights, hn, x, z);

  const houses: House[] = [];
  const walls: Wall[] = [];
  const roads: [number, number][][] = [];
  const fields: TankMap["fields"] = [];
  const bridges: Bridge[] = [];
  let lanes: [number, number][][] = [];
  const B = plan.bases;

  const roofFor = (kind: number): number => {
    if (plan.biome === "desert") return kind === 3 ? 0.9 : 0.5;
    if (kind === 3) return 0;
    if (kind === 4) return 2.6;
    if (plan.biome === "bocage") return kind === 2 ? 4.2 : 3;
    if (plan.biome === "hiver") return kind === 2 ? 3.8 : 2.6;
    return kind === 2 ? 3.6 : 2.2;
  };
  const addHouse = (x: number, z: number, w: number, d: number, h: number, kind: number, ridgeX: boolean) => {
    houses.push({ x, z, w, d, h, kind, ridgeX, y: sample(x, z), roof: roofFor(kind) });
  };
  /** Pose une maison seulement si elle ne chevauche aucune autre. */
  const tryHouse = (x: number, z: number, w: number, d: number, h: number, kind: number, ridgeX: boolean) => {
    for (const o of houses) if (Math.abs(x - o.x) < (w + o.w) / 2 + 2 && Math.abs(z - o.z) < (d + o.d) / 2 + 2) return;
    addHouse(x, z, w, d, h, kind, ridgeX);
  };
  const addWall = (x0: number, z0: number, x1: number, z1: number, h = 1.1) => walls.push({ x0, z0, x1, z1, h });
  /**
   * Une rue droite bordee de maisons : le long de x (alongX) ou de z, centree
   * en (cx, cz). La chaussee garde 10 m libres : les chars y passent. Avec
   * `crossing`, le carrefour du centre reste degage (une rue croise celle-ci).
   */
  const street = (cx: number, cz: number, alongX: boolean, count: number, wallH: number, crossing = false) => {
    for (let k = 0; k < count; k++) {
      const s = (k - (count - 1) / 2) * 12 + (rnd() - 0.5) * 2;
      if (crossing && Math.abs(s) < 11) continue;
      for (const side of [-1, 1]) {
        if (rnd() < 0.18) continue;
        const off = side * (13 + rnd() * 1.5);
        const w = 7 + rnd() * 2;
        const d = 7 + rnd() * 2;
        const h = wallH + rnd() * 1.8;
        if (alongX) tryHouse(cx + s, cz + off, w, d, h, 0, rnd() < 0.5);
        else tryHouse(cx + off, cz + s, w, d, h, 0, rnd() < 0.5);
      }
    }
  };
  /** Un pont a travers la riviere, perpendiculaire a son cours, en (cx, cz). */
  const addBridge = (cx: number, cz: number) => {
    const pts = plan.river!.pts;
    let best = 0;
    let bestD = Infinity;
    for (let k = 0; k + 1 < pts.length; k++) {
      const d = distToSegment(cx, cz, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]);
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    const [ax, az] = pts[best];
    const [bx, bz] = pts[best + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / len;
    const nz = (bx - ax) / len;
    const half = plan.river!.width / 2 + 9;
    const x0 = cx + nx * half;
    const z0 = cz + nz * half;
    const x1 = cx - nx * half;
    const z1 = cz - nz * half;
    bridges.push({ x0, z0, x1, z1, w: 10, y0: sample(x0, z0) + 0.25, y1: sample(x1, z1) + 0.25 });
  };

  if (mapId === "castelroc") {
    // --- Le village perche : une place, deux rues, l'eglise et son clocher ---
    const vx = CASTEL_VILLAGE.x;
    const vz = CASTEL_VILLAGE.z;
    addHouse(vx + 16, vz - 2, 10, 20, 9, 2, false);
    addHouse(vx + 16, vz + 12, 5.5, 5.5, 21, 3, true);
    for (let k = 0; k < 5; k++) {
      const z = vz - 34 + k * 11 + (rnd() - 0.5) * 2;
      if (Math.abs(z - vz) < 6) continue;
      addHouse(vx - 12 - rnd() * 2, z, 8 + rnd() * 2, 8 + rnd() * 2, 5.5 + rnd() * 2.5, 0, rnd() < 0.5);
    }
    for (let k = 0; k < 4; k++) {
      const z = vz + 18 + k * 10 + (rnd() - 0.5) * 2;
      addHouse(vx + 3 + rnd() * 2, z, 8 + rnd() * 2, 7.5 + rnd() * 2, 5 + rnd() * 2.5, 0, rnd() < 0.5);
    }
    for (let k = 0; k < 4; k++) {
      const x = vx - 38 + k * 10 + (rnd() - 0.5) * 2;
      if (Math.abs(x - vx) < 18) continue;
      addHouse(x, vz + 12 + rnd() * 2, 7.5 + rnd() * 2, 8 + rnd() * 2, 5 + rnd() * 2.5, 0, rnd() < 0.5);
      addHouse(x, vz - 12 - rnd() * 2, 7.5 + rnd() * 2, 8 + rnd() * 2, 5 + rnd() * 2.5, 0, rnd() < 0.5);
    }
    // Fermes isolees : un corps de ferme et une grange.
    for (const [fx, fz] of [
      [-95, 120],
      [120, 95],
      [-120, -150],
      [175, -95],
      [-40, 190],
    ]) {
      addHouse(fx, fz, 11, 7, 5.5, 1, true);
      addHouse(fx + 14, fz + 6, 9, 13, 6.5, 1, false);
    }
    addWall(vx - 44, vz + 34, vx - 18, vz + 44);
    addWall(vx + 26, vz - 40, vx + 44, vz - 24);
    addWall(-150, 60, -100, 60);
    addWall(-100, 60, -100, 95);
    addWall(60, 120, 110, 120);
    addWall(90, -160, 140, -160);
    addWall(-60, -100, -60, -60);
    roads.push(
      // De la base ouest au village par le vallon.
      [
        [B[0].x, B[0].z],
        [-170, 150],
        [-150, 60],
        [-110, 10],
        [-40, -10],
        [vx - 20, vz],
        [vx + 30, vz + 2],
        [110, -60],
        [160, -150],
        [B[1].x, B[1].z],
      ],
      // La route du sud et de l'est, au pied de la crete.
      [
        [B[0].x, B[0].z],
        [-120, 230],
        [0, 200],
        [100, 150],
        [150, 60],
        [215, -40],
        [B[1].x, B[1].z],
      ],
      // La rue du village, nord-sud.
      [
        [vx - 5, vz - 60],
        [vx - 5, vz + 50],
        [vx - 20, 110],
        [-40, 190],
      ],
    );
    // Couloirs : ouest (vallon), centre (village), est (crete).
    lanes = [
      [
        [-200, 150],
        [-165, 60],
        [-130, -20],
        [-60, -120],
        [60, -190],
        [B[1].x - 20, B[1].z + 15],
      ],
      [
        [-150, 150],
        [-70, 60],
        [vx - 10, vz + 20],
        [vx + 20, vz - 40],
        [120, -130],
        [B[1].x - 15, B[1].z + 10],
      ],
      [
        [-120, 215],
        [0, 190],
        [110, 130],
        [160, 30],
        [205, -90],
        [B[1].x, B[1].z + 20],
      ],
    ];
  } else if (mapId === "col-givre") {
    // --- Deux hameaux de chalets le long de la route du col, une chapelle, des granges ---
    const [v1, v2] = plan.villages;
    addHouse(v1.x, v1.z - 15, 12, 7, 6.5, 2, true);
    addHouse(v1.x + 8.5, v1.z - 15, 4, 4, 14, 3, true);
    street(v1.x, v1.z, true, 5, 4.5);
    street(v2.x, v2.z, true, 4, 4.5);
    for (const [fx, fz] of [
      [-180, 170],
      [165, 150],
      [-150, -150],
      [190, -170],
      [-20, 250],
    ]) {
      addHouse(fx, fz, 12, 8, 6.5, 1, true);
      tryHouse(fx + 12, fz + 10, 7, 6, 4.5, 0, false);
    }
    // Cabane de pecheurs au bord du lac gele.
    tryHouse(plan.lake.x - 40, plan.lake.z + 58, 6, 5, 3.6, 0, true);
    addWall(-130, 60, -80, 75);
    addWall(70, -75, 120, -60);
    addWall(-60, 140, -20, 150);
    roads.push(
      // La route du col, par les deux hameaux.
      [
        [B[0].x, B[0].z],
        [-160, 20],
        [v1.x - 10, v1.z],
        [0, -12],
        [v2.x, v2.z],
        [160, -20],
        [B[1].x, B[1].z],
      ],
      // La route du nord, au pied des forets.
      [
        [B[0].x, B[0].z],
        [-170, 150],
        [-60, 235],
        [60, 235],
        [170, 140],
        [B[1].x, B[1].z],
      ],
      // La piste sur la glace.
      [
        [B[0].x, B[0].z],
        [-150, -60],
        [-100, -150],
        [-20, -195],
        [80, -195],
        [160, -110],
        [B[1].x, B[1].z],
      ],
    );
    lanes = [
      [
        [-180, 130],
        [-60, 235],
        [60, 235],
        [170, 130],
        [B[1].x - 15, B[1].z + 10],
      ],
      [
        [-170, 25],
        [v1.x - 5, v1.z + 12],
        [0, -12],
        [v2.x + 5, v2.z - 12],
        [B[1].x - 20, B[1].z],
      ],
      [
        [-160, -50],
        [-100, -150],
        [-10, -200],
        [80, -195],
        [160, -110],
        [B[1].x - 20, B[1].z - 20],
      ],
    ];
  } else if (mapId === "oasis-ambre") {
    // --- Le village de terre : maisons a toit plat autour de la mare, une tour, un caravanserail ---
    const v = AMBRE_VILLAGE;
    addHouse(v.x + 40, v.z - 38, 18, 16, 6.5, 2, true);
    addHouse(v.x - 34, v.z - 32, 5, 5, 17, 3, true);
    for (let k = 0; k < 26; k++) {
      const a = (k / 26) * Math.PI * 2 + rnd() * 0.12;
      const r = 36 + rnd() * 16;
      const x = v.x + Math.cos(a) * r;
      const z = v.z + Math.sin(a) * r;
      // Quatre rues menent a la mare.
      if (Math.abs(x - v.x) < 9 || Math.abs(z - v.z) < 9) continue;
      tryHouse(x, z, 7 + rnd() * 3, 7 + rnd() * 3, 4 + rnd() * 3.5, 0, rnd() < 0.5);
    }
    // Murets d'argile autour des jardins.
    addWall(v.x - 30, v.z + 30, v.x - 14, v.z + 34, 1.4);
    addWall(v.x + 14, v.z + 34, v.x + 30, v.z + 28, 1.4);
    // Un fortin en ruine sur la route de l'est, un puits et son abri a l'ouest.
    addHouse(215, 35, 10, 10, 5, 1, true);
    addHouse(-205, -35, 6, 6, 3.5, 0, true);
    roads.push(
      // La piste du nord, jusqu'a la mare.
      [
        [B[0].x, B[0].z],
        [-10, -150],
        [v.x - 2, v.z - 60],
        [v.x, v.z - 22],
      ],
      // La piste du sud.
      [
        [v.x, v.z + 22],
        [v.x - 2, v.z + 60],
        [-10, 150],
        [B[1].x, B[1].z],
      ],
      // La piste de l'ouest, par les dunes.
      [
        [B[0].x, B[0].z],
        [-150, -200],
        [-230, -60],
        [-240, 80],
        [-200, 200],
        [B[1].x, B[1].z],
      ],
      // La piste de l'est, au pied des plateaux.
      [
        [B[0].x, B[0].z],
        [200, -200],
        [240, -60],
        [230, 80],
        [150, 200],
        [B[1].x, B[1].z],
      ],
    );
    // Jardins irrigues autour de la mare.
    fields.push(
      { x: v.x - 24, z: v.z + 44, w: 18, d: 12, kind: 3 },
      { x: v.x + 26, z: v.z + 46, w: 18, d: 12, kind: 3 },
      { x: v.x - 26, z: v.z - 46, w: 16, d: 10, kind: 3 },
    );
    lanes = [
      [
        [-60, -200],
        [-200, -130],
        [-235, 0],
        [-215, 150],
        [-60, 215],
      ],
      [
        [0, -190],
        [-40, -80],
        [-62, v.z],
        [-40, 90],
        [0, 190],
      ],
      [
        [60, -200],
        [215, -150],
        [240, -20],
        [215, 140],
        [60, 215],
      ],
    ];
  } else {
    // --- Val-aux-Moulins : le bourg de briques au sud du gue, un hameau au nord, quatre moulins ---
    const [v1, v2] = plan.villages;
    // Le bourg : deux rues en croix, l'eglise et son clocher dans un angle.
    addHouse(v1.x + 17, v1.z + 21, 9, 16, 8, 2, false);
    addHouse(v1.x + 17, v1.z + 11, 5, 5, 19, 3, true);
    street(v1.x, v1.z, true, 6, 5, true);
    street(v1.x, v1.z, false, 6, 5, true);
    // Le hameau, le long de sa rue.
    street(v2.x, v2.z, false, 4, 5);
    for (const m of MOULIN_HILLS) addHouse(m.x, m.z, 6, 6, 12, 4, true);
    for (const [fx, fz] of [
      [-200, 20],
      [150, -130],
      [-60, 250],
      [240, 20],
    ]) {
      tryHouse(fx, fz, 12, 8, 6, 1, true);
    }
    for (const [cx, cz] of plan.bridgeAt) addBridge(cx, cz);
    const [ford] = plan.fords;
    const [sw, ne] = bridges;
    roads.push(
      // Par le pont du sud-ouest.
      [
        [B[0].x, B[0].z],
        [-190, 110],
        [v2.x, v2.z],
        [-150, -50],
        [sw.x0, sw.z0],
        [sw.x1, sw.z1],
        [-60, -170],
        [80, -210],
        [B[1].x, B[1].z],
      ],
      // Par le gue, du hameau au bourg.
      [
        [v2.x, v2.z],
        [-45, 25],
        [ford[0], ford[1]],
        [30, -35],
        [v1.x, v1.z],
        [150, -140],
        [B[1].x, B[1].z],
      ],
      // Par le pont du nord-est.
      [
        [B[0].x, B[0].z],
        [-60, 215],
        [40, 160],
        [ne.x0, ne.z0],
        [ne.x1, ne.z1],
        [140, 40],
        [170, -60],
        [B[1].x, B[1].z],
      ],
    );
    // Murets de pierre.
    addWall(-80, 120, -30, 150);
    addWall(120, -40, 170, -10);
    // Champs du bocage, loin de la riviere et des villages.
    for (let k = 0; k < 18; k++) {
      const x = (rnd() - 0.5) * 480;
      const z = (rnd() - 0.5) * 480;
      if (distToPolyline(x, z, MOULIN_RIVER) < 45) continue;
      if (plan.villages.some((vv) => Math.hypot(x - vv.x, z - vv.z) < vv.r + 30)) continue;
      if (B.some((b) => Math.hypot(x - b.x, z - b.z) < 60)) continue;
      fields.push({ x, z, w: 36 + rnd() * 30, d: 28 + rnd() * 24, kind: Math.floor(rnd() * 4) });
    }
    lanes = [
      [
        [-190, 130],
        [-150, -40],
        [sw.x0, sw.z0],
        [sw.x1, sw.z1],
        [-60, -170],
        [B[1].x - 20, B[1].z + 10],
      ],
      [
        [-150, 170],
        [-60, 45],
        [ford[0], ford[1]],
        [40, -60],
        [140, -150],
        [B[1].x - 10, B[1].z + 15],
      ],
      [
        [-120, 230],
        [30, 170],
        [ne.x0, ne.z0],
        [ne.x1, ne.z1],
        [140, 40],
        [B[1].x, B[1].z + 25],
      ],
    ];
  }

  // --- Champs de Castelroc (couleurs du sol seulement) ---
  if (plan.biome === "mediterraneen") {
    for (let k = 0; k < 14; k++) {
      const x = (rnd() - 0.5) * 480;
      const z = (rnd() - 0.5) * 480;
      if (Math.hypot(x - CASTEL_VILLAGE.x, z - CASTEL_VILLAGE.z) < 70 || Math.hypot(x - plan.lake.x, z - plan.lake.z) < 60) continue;
      fields.push({ x, z, w: 40 + rnd() * 50, d: 30 + rnd() * 40, kind: Math.floor(rnd() * 3) });
    }
  }

  // --- Occupation du sol : ce qui empeche de poser un arbre ou un rocher ---
  const nearRoad = (x: number, z: number, margin: number) => roads.some((road) => distToPolyline(x, z, road) < margin);
  const inHouse = (x: number, z: number, margin: number) =>
    houses.some((h) => Math.abs(x - h.x) < h.w / 2 + margin && Math.abs(z - h.z) < h.d / 2 + margin);
  const nearBase = (x: number, z: number, margin: number) => B.some((b) => Math.hypot(x - b.x, z - b.z) < margin);
  const inWater = (x: number, z: number, margin: number) => {
    if (plan.lake.r > 0 && Math.hypot(x - plan.lake.x, z - plan.lake.z) < plan.lake.r + margin) return true;
    return plan.river !== null && distToPolyline(x, z, plan.river.pts) < plan.river.width / 2 + margin;
  };

  // --- Rochers : sur les pentes et en amas (eboulis au pied des plateaux du desert) ---
  const rocks: Rock[] = [];
  const rockTries = plan.biome === "desert" ? 120 : plan.biome === "bocage" ? 40 : 70;
  for (let k = 0; k < rockTries; k++) {
    let x = (rnd() - 0.5) * 560;
    let z = (rnd() - 0.5) * 560;
    if (plan.biome === "desert" && rnd() < 0.6) {
      const m = MESAS[Math.floor(rnd() * MESAS.length)];
      const a = rnd() * Math.PI * 2;
      const r = m.r + 7 + rnd() * 12;
      x = m.x + Math.cos(a) * r;
      z = m.z + Math.sin(a) * r;
    }
    if (inHouse(x, z, 8) || nearRoad(x, z, 8) || nearBase(x, z, 60) || inWater(x, z, 4)) continue;
    const slope = Math.abs(sample(x + 3, z) - sample(x - 3, z)) + Math.abs(sample(x, z + 3) - sample(x, z - 3));
    if (slope < 1.2 && rnd() < 0.6) continue;
    const n = 1 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const rx = x + (rnd() - 0.5) * 9;
      const rz = z + (rnd() - 0.5) * 9;
      const r = 1.4 + rnd() * 3;
      rocks.push({ x: rx, z: rz, r, y: sample(rx, rz) });
    }
  }

  // --- Arbres : trois essences par climat, groupees comme dans la nature ---
  const trees: Tree[] = [];
  const addTree = (x: number, z: number, kind: number) => {
    if (Math.abs(x) > MAP_HALF - 8 || Math.abs(z) > MAP_HALF - 8) return;
    if (inHouse(x, z, 3) || nearBase(x, z, 55) || inWater(x, z, 3)) return;
    if (rocks.some((r) => Math.hypot(x - r.x, z - r.z) < r.r + 1.5)) return;
    trees.push({ x, z, kind, scale: 0.8 + rnd() * 0.5, y: sample(x, z) });
  };
  if (plan.biome === "mediterraneen") {
    // Oliveraies en rangs.
    for (let g = 0; g < 9; g++) {
      const cx = (rnd() - 0.5) * 460;
      const cz = (rnd() - 0.5) * 460;
      if (Math.hypot(cx - CASTEL_VILLAGE.x, cz - CASTEL_VILLAGE.z) < 60) continue;
      const a = rnd() * Math.PI;
      for (let i = -3; i <= 3; i++) {
        for (let j = -2; j <= 2; j++) {
          if (rnd() < 0.2) continue;
          const x = cx + Math.cos(a) * i * 8 - Math.sin(a) * j * 8 + (rnd() - 0.5) * 2;
          const z = cz + Math.sin(a) * i * 8 + Math.cos(a) * j * 8 + (rnd() - 0.5) * 2;
          if (!nearRoad(x, z, 6)) addTree(x, z, 0);
        }
      }
    }
    // Cypres en alignement le long des routes.
    for (const road of roads) {
      for (let k = 0; k + 1 < road.length; k++) {
        const [x0, z0] = road[k];
        const [x1, z1] = road[k + 1];
        const len = Math.hypot(x1 - x0, z1 - z0);
        const nx = -(z1 - z0) / len;
        const nz = (x1 - x0) / len;
        for (let s = 10; s < len - 10; s += 14) {
          if (rnd() < 0.45) continue;
          const side = rnd() < 0.5 ? -1 : 1;
          addTree(x0 + ((x1 - x0) * s) / len + nx * 8 * side, z0 + ((z1 - z0) * s) / len + nz * 8 * side, 1);
        }
      }
    }
    // Bosquets et pins disperses, plus denses sur les hauteurs.
    for (let k = 0; k < 420; k++) {
      const x = (rnd() - 0.5) * 580;
      const z = (rnd() - 0.5) * 580;
      const forest = fbm(x / 90, z / 90, seed + 55);
      if (forest < 0.55 && rnd() < 0.85) continue;
      if (nearRoad(x, z, 7)) continue;
      addTree(x, z, sample(x, z) > 10 ? 2 : rnd() < 0.5 ? 0 : 2);
    }
  } else if (plan.biome === "hiver") {
    // Forets de sapins, bouleaux au fond des vallees et au bord du lac.
    for (let k = 0; k < 950; k++) {
      const x = (rnd() - 0.5) * 580;
      const z = (rnd() - 0.5) * 580;
      const forest = fbm(x / 80, z / 80, seed + 55);
      if (forest < 0.52 && rnd() < 0.9) continue;
      if (nearRoad(x, z, 7)) continue;
      const h = sample(x, z);
      addTree(x, z, h < 2 ? (rnd() < 0.55 ? 1 : 0) : rnd() < 0.3 ? 2 : 0);
    }
    for (let k = 0; k < 40; k++) {
      const a = rnd() * Math.PI * 2;
      const r = plan.lake.r + 8 + rnd() * 14;
      const x = plan.lake.x + Math.cos(a) * r;
      const z = plan.lake.z + Math.sin(a) * r;
      if (!nearRoad(x, z, 7)) addTree(x, z, 1);
    }
  } else if (plan.biome === "desert") {
    // Palmeraie autour de la mare et dans les jardins, palmiers le long de l'oued, acacias isoles.
    const v = AMBRE_VILLAGE;
    for (let k = 0; k < 60; k++) {
      const a = rnd() * Math.PI * 2;
      const r = plan.lake.r + 4 + rnd() * 12;
      addTree(v.x + Math.cos(a) * r, v.z + Math.sin(a) * r, rnd() < 0.65 ? 0 : 2);
    }
    for (const f of fields) {
      for (let i = 0; i < 5; i++) addTree(f.x + (rnd() - 0.5) * f.w, f.z + (rnd() - 0.5) * f.d, 0);
    }
    for (let k = 0; k < 110; k++) {
      const x = (rnd() - 0.5) * 560;
      const z = -130 + 25 * Math.sin(x / 70) + (rnd() - 0.5) * 22;
      if (rnd() < 0.55 && !nearRoad(x, z, 6)) addTree(x, z, rnd() < 0.5 ? 0 : 2);
    }
    for (let k = 0; k < 90; k++) {
      const x = (rnd() - 0.5) * 560;
      const z = (rnd() - 0.5) * 560;
      if (!nearRoad(x, z, 6)) addTree(x, z, 1);
    }
  } else {
    // Bocage : chenes en bosquets, peupliers le long de la riviere, vergers de pommiers.
    for (let k = 0; k < 420; k++) {
      const x = (rnd() - 0.5) * 580;
      const z = (rnd() - 0.5) * 580;
      const forest = fbm(x / 100, z / 100, seed + 55);
      if (forest < 0.55 && rnd() < 0.88) continue;
      if (nearRoad(x, z, 7)) continue;
      addTree(x, z, 0);
    }
    if (plan.river) {
      const pts = plan.river.pts;
      for (let k = 0; k + 1 < pts.length; k++) {
        const [x0, z0] = pts[k];
        const [x1, z1] = pts[k + 1];
        const len = Math.hypot(x1 - x0, z1 - z0);
        const nx = -(z1 - z0) / len;
        const nz = (x1 - x0) / len;
        for (let s = 6; s < len - 6; s += 11) {
          if (rnd() < 0.35) continue;
          const side = rnd() < 0.5 ? -1 : 1;
          const off = plan.river.width / 2 + 8 + rnd() * 3;
          const x = x0 + ((x1 - x0) * s) / len + nx * off * side;
          const z = z0 + ((z1 - z0) * s) / len + nz * off * side;
          if (!nearRoad(x, z, 8) && !plan.fords.some(([fx, fz]) => Math.hypot(x - fx, z - fz) < 30)) addTree(x, z, 1);
        }
      }
    }
    for (let g = 0; g < 6; g++) {
      const cx = (rnd() - 0.5) * 420;
      const cz = (rnd() - 0.5) * 420;
      for (let i = -2; i <= 2; i++) {
        for (let j = -2; j <= 2; j++) {
          if (rnd() < 0.8 && !nearRoad(cx + i * 7, cz + j * 7, 6)) addTree(cx + i * 7, cz + j * 7, 2);
        }
      }
    }
  }

  // --- Buissons (et haies du bocage, en rangees le long des champs) ---
  const bushes: TankMap["bushes"] = [];
  const addBush = (x: number, z: number, s: number) => {
    if (inHouse(x, z, 2) || nearBase(x, z, 30) || inWater(x, z, 1) || nearRoad(x, z, 4)) return;
    bushes.push({ x, z, s, y: sample(x, z) });
  };
  const bushCount = plan.biome === "desert" ? 180 : 360;
  for (let k = 0; k < bushCount; k++) {
    const x = (rnd() - 0.5) * 580;
    const z = (rnd() - 0.5) * 580;
    addBush(x, z, 0.7 + rnd() * 0.9);
  }
  if (plan.biome === "bocage") {
    for (const f of fields) {
      for (let s = -f.w / 2; s <= f.w / 2; s += 2.6) {
        addBush(f.x + s, f.z - f.d / 2, 1.1 + rnd() * 0.5);
        addBush(f.x + s, f.z + f.d / 2, 1.1 + rnd() * 0.5);
      }
    }
  }

  // --- Departs : trois rangs de trois devant chaque base ---
  const spawns = makeSpawns(B, 3);

  if (scale > 1) {
    return enlargeMap({ mapId, plan, seed, scale, villageY, baseY, rnd, houses, walls, rocks, trees, bushes, roads, fields, bridges, lanes, bases: B });
  }

  const { nav, navN } = computeNav({
    half: MAP_HALF,
    houses,
    walls,
    rocks,
    bridges,
    waterKind: plan.waterKind,
    waterLevel: plan.waterLevel,
    lake: plan.lake,
    river: plan.river,
    base: B[0],
    sample,
  });

  return {
    id: mapId,
    name: plan.name,
    biome: plan.biome,
    seed,
    half: MAP_HALF,
    world: WORLD_HALF,
    heights,
    hn,
    houses,
    walls,
    rocks,
    trees,
    bushes,
    roads,
    fields,
    bases: B,
    spawns,
    waterKind: plan.waterKind,
    waterLevel: plan.waterLevel,
    lake: plan.lake,
    river: plan.river,
    bridges,
    fords: plan.fords,
    nav,
    navN,
    lanes,
    villages: plan.villages,
    villageName: plan.villageName,
  };
}

/** Ce qu'il faut pour calculer la grille de navigation d'une carte. */
interface NavInput {
  half: number;
  houses: House[];
  walls: Wall[];
  rocks: Rock[];
  bridges: Bridge[];
  waterKind: WaterKind;
  waterLevel: number;
  lake: { x: number; z: number; r: number };
  river: { pts: [number, number][]; width: number } | null;
  base: { x: number; z: number };
  sample: (x: number, z: number) => number;
}

/**
 * Grille de navigation des bots (1 = infranchissable) : maisons, eau profonde,
 * rochers, murets, pentes trop raides, et les poches isolees.
 */
function computeNav(o: NavInput): { nav: Uint8Array; navN: number } {
  const { half, houses, walls, rocks, bridges, sample } = o;
  const inHouse = (x: number, z: number, margin: number) =>
    houses.some((h) => Math.abs(x - h.x) < h.w / 2 + margin && Math.abs(z - h.z) < h.d / 2 + margin);
  const inWater = (x: number, z: number, margin: number) => {
    if (o.lake.r > 0 && Math.hypot(x - o.lake.x, z - o.lake.z) < o.lake.r + margin) return true;
    return o.river !== null && distToPolyline(x, z, o.river.pts) < o.river.width / 2 + margin;
  };
  const onBridge = (x: number, z: number, margin: number) =>
    bridges.some((br) => distToSegment(x, z, br.x0, br.z0, br.x1, br.z1) < br.w / 2 + margin);
  const navN = Math.round((half * 2) / NAV_STEP);
  const nav = new Uint8Array(navN * navN);
  for (let j = 0; j < navN; j++) {
    for (let i = 0; i < navN; i++) {
      const x = -half + (i + 0.5) * NAV_STEP;
      const z = -half + (j + 0.5) * NAV_STEP;
      let blocked = Math.abs(x) > half - 6 || Math.abs(z) > half - 6;
      if (!blocked && inHouse(x, z, 3.5)) blocked = true;
      // L'eau profonde bloque ; pas la glace, ni le gue, ni les ponts.
      if (!blocked && o.waterKind !== "glace" && inWater(x, z, 2) && !onBridge(x, z, 0) && sample(x, z) < o.waterLevel - 0.7) {
        blocked = true;
      }
      if (!blocked && rocks.some((r) => Math.hypot(x - r.x, z - r.z) < r.r + 2.5)) blocked = true;
      if (!blocked) {
        for (const w of walls) {
          if (distToSegment(x, z, w.x0, w.z0, w.x1, w.z1) < 3) {
            blocked = true;
            break;
          }
        }
      }
      if (!blocked && !onBridge(x, z, 3)) {
        // Pente trop raide : un char la gravit mal.
        const s = Math.max(Math.abs(sample(x + 2.5, z) - sample(x - 2.5, z)), Math.abs(sample(x, z + 2.5) - sample(x, z - 2.5))) / 5;
        if (s > 0.55) blocked = true;
      }
      nav[j * navN + i] = blocked ? 1 : 0;
    }
  }
  // Les poches isolees (sommet d'une crete, cour fermee) comptent comme bloquees :
  // un bot n'y cherche jamais un chemin qui n'existe pas.
  const seen = new Uint8Array(navN * navN);
  const bi = Math.floor((o.base.x + half) / NAV_STEP);
  const bj = Math.floor((o.base.z + half) / NAV_STEP);
  const queue = [bj * navN + bi];
  seen[queue[0]] = 1;
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q];
    const ci = c % navN;
    const cj = (c - ci) / navN;
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const i = ci + di;
      const j = cj + dj;
      if (i < 0 || j < 0 || i >= navN || j >= navN) continue;
      const n = j * navN + i;
      if (seen[n] || nav[n]) continue;
      seen[n] = 1;
      queue.push(n);
    }
  }
  for (let c = 0; c < nav.length; c++) if (!seen[c]) nav[c] = 1;
  return { nav, navN };
}

/** Departs : en eventail devant chaque base, tournes vers l'adversaire, `rows` rangs de trois. */
function makeSpawns(bases: TankMap["bases"], rows: number): TankMap["spawns"] {
  const spawns: TankMap["spawns"] = [[], []];
  for (let b = 0; b < 2; b++) {
    const base = bases[b];
    const other = bases[1 - b];
    const toward = Math.atan2(other.x - base.x, other.z - base.z);
    const ax = Math.sin(toward);
    const az = Math.cos(toward);
    for (let k = 0; k < rows * 3; k++) {
      const row = Math.floor(k / 3);
      const col = (k % 3) - 1;
      spawns[b].push({ x: base.x + ax * (row * 11 + 6) + az * col * 12, z: base.z + az * (row * 11 + 6) - ax * col * 12, yaw: toward });
    }
  }
  return spawns;
}

interface SmallMap {
  mapId: MapId;
  plan: Plan;
  seed: number;
  scale: number;
  villageY: number[];
  baseY: [number, number];
  rnd: () => number;
  houses: House[];
  walls: Wall[];
  rocks: Rock[];
  trees: Tree[];
  bushes: TankMap["bushes"];
  roads: [number, number][][];
  fields: TankMap["fields"];
  bridges: Bridge[];
  lanes: [number, number][][];
  bases: TankMap["bases"];
}

/**
 * Carte agrandie (grande bataille) : le meme paysage etire d'un facteur
 * `scale`. Les positions s'ecartent, les objets gardent leur taille ; les
 * bois et les buissons sont completes pour garder leur densite.
 */
function enlargeMap(m: SmallMap): TankMap {
  const { plan, seed, villageY, baseY, rnd } = m;
  const s = m.scale;
  const half = MAP_HALF * s;
  const world = half + (WORLD_HALF - MAP_HALF) * 1.1;
  const hn = Math.round((world * 2) / HEIGHT_STEP) + 1;
  const heights = new Float32Array(hn * hn);
  for (let j = 0; j < hn; j++) {
    const z = -world + j * HEIGHT_STEP;
    for (let i = 0; i < hn; i++) {
      const x = -world + i * HEIGHT_STEP;
      heights[j * hn + i] = heightAt(plan, x / s, z / s, seed, villageY, baseY);
    }
  }
  const at = (x: number, z: number) => heightFromGrid(heights, hn, x, z);
  const P = (p: [number, number]): [number, number] => [p[0] * s, p[1] * s];

  const houses = m.houses.map((h) => ({ ...h, x: h.x * s, z: h.z * s, y: at(h.x * s, h.z * s) }));
  const walls = m.walls.map((w) => ({ ...w, x0: w.x0 * s, z0: w.z0 * s, x1: w.x1 * s, z1: w.z1 * s }));
  const rocks = m.rocks.map((r) => ({ ...r, x: r.x * s, z: r.z * s, y: at(r.x * s, r.z * s) }));
  const roads = m.roads.map((r) => r.map(P));
  const bases: TankMap["bases"] = [
    { x: m.bases[0].x * s, z: m.bases[0].z * s },
    { x: m.bases[1].x * s, z: m.bases[1].z * s },
  ];
  const lake = { x: plan.lake.x * s, z: plan.lake.z * s, r: plan.lake.r * s };
  const river = plan.river ? { pts: plan.river.pts.map(P), width: plan.river.width * s } : null;
  const bridges = m.bridges.map((br) => {
    const x0 = br.x0 * s;
    const z0 = br.z0 * s;
    const x1 = br.x1 * s;
    const z1 = br.z1 * s;
    return { ...br, x0, z0, x1, z1, y0: at(x0, z0) + 0.25, y1: at(x1, z1) + 0.25 };
  });

  // Ou poser un arbre ou un buisson de plus.
  const free = (x: number, z: number, margin: number) => {
    if (Math.abs(x) > half - 8 || Math.abs(z) > half - 8) return false;
    if (houses.some((h) => Math.abs(x - h.x) < h.w / 2 + margin && Math.abs(z - h.z) < h.d / 2 + margin)) return false;
    if (lake.r > 0 && Math.hypot(x - lake.x, z - lake.z) < lake.r + margin) return false;
    if (river && distToPolyline(x, z, river.pts) < river.width / 2 + margin) return false;
    if (bases.some((b) => Math.hypot(x - b.x, z - b.z) < 70)) return false;
    return !roads.some((r) => distToPolyline(x, z, r) < 6);
  };
  const trees: Tree[] = [];
  for (const t of m.trees) {
    const x = t.x * s;
    const z = t.z * s;
    trees.push({ ...t, x, z, y: at(x, z) });
    // Un voisin de la meme essence : le bois garde sa densite.
    if (rnd() < 0.85) {
      const a = rnd() * Math.PI * 2;
      const d = 5 + rnd() * 5;
      const nx = x + Math.cos(a) * d;
      const nz = z + Math.sin(a) * d;
      if (free(nx, nz, 3)) trees.push({ x: nx, z: nz, kind: t.kind, scale: 0.8 + rnd() * 0.5, y: at(nx, nz) });
    }
  }
  const bushes: TankMap["bushes"] = [];
  for (const b of m.bushes) {
    const x = b.x * s;
    const z = b.z * s;
    bushes.push({ ...b, x, z, y: at(x, z) });
    if (rnd() < 0.7) {
      const nx = x + (rnd() - 0.5) * 12;
      const nz = z + (rnd() - 0.5) * 12;
      if (free(nx, nz, 2)) bushes.push({ x: nx, z: nz, s: 0.7 + rnd() * 0.9, y: at(nx, nz) });
    }
  }

  const { nav, navN } = computeNav({
    half,
    houses,
    walls,
    rocks,
    bridges,
    waterKind: plan.waterKind,
    waterLevel: plan.waterLevel,
    lake,
    river,
    base: bases[0],
    sample: at,
  });

  return {
    id: m.mapId,
    name: plan.name,
    biome: plan.biome,
    seed,
    half,
    world,
    heights,
    hn,
    houses,
    walls,
    rocks,
    trees,
    bushes,
    roads,
    fields: m.fields.map((f) => ({ ...f, x: f.x * s, z: f.z * s, w: f.w * s, d: f.d * s })),
    bases,
    // Six rangs de trois devant chaque base : de quoi placer quinze chars et plus.
    spawns: makeSpawns(bases, 6),
    waterKind: plan.waterKind,
    waterLevel: plan.waterLevel,
    lake,
    river,
    bridges,
    fords: plan.fords.map(P),
    nav,
    navN,
    lanes: m.lanes.map((l) => l.map(P)),
    villages: plan.villages.map((v) => ({ x: v.x * s, z: v.z * s, r: v.r * s })),
    villageName: plan.villageName,
  };
}

/** Tablier d'un pont sous (x, z) : sa hauteur, ou -Infinity hors des ponts. */
export function bridgeDeck(map: TankMap, x: number, z: number): number {
  for (const br of map.bridges) {
    const dx = br.x1 - br.x0;
    const dz = br.z1 - br.z0;
    const t = ((x - br.x0) * dx + (z - br.z0) * dz) / (dx * dx + dz * dz);
    if (t < 0 || t > 1) continue;
    const px = br.x0 + dx * t - x;
    const pz = br.z0 + dz * t - z;
    if (px * px + pz * pz > (br.w * br.w) / 4) continue;
    return br.y0 + (br.y1 - br.y0) * t;
  }
  return -Infinity;
}

/** L'eau est-elle trop profonde ici pour un char (lac, mare, riviere hors des ponts et du gue) ? */
export function deepWater(map: TankMap, x: number, z: number): boolean {
  if (map.waterKind === "glace") return false;
  if (groundHeight(map, x, z) > map.waterLevel - 0.9) return false;
  if (map.lake.r > 0 && Math.hypot(x - map.lake.x, z - map.lake.z) < map.lake.r + 12) return true;
  return map.river !== null && distToPolyline(x, z, map.river.pts) < map.river.width / 2 + 7;
}

// ---------------------------------------------------------- requetes

/** Hauteur du sol (interpolation bilineaire de la grille). */
export function heightFromGrid(heights: Float32Array, hn: number, x: number, z: number): number {
  const world = ((hn - 1) * HEIGHT_STEP) / 2;
  const fx = (x + world) / HEIGHT_STEP;
  const fz = (z + world) / HEIGHT_STEP;
  const i = Math.max(0, Math.min(hn - 2, Math.floor(fx)));
  const j = Math.max(0, Math.min(hn - 2, Math.floor(fz)));
  const u = Math.max(0, Math.min(1, fx - i));
  const v = Math.max(0, Math.min(1, fz - j));
  const a = heights[j * hn + i];
  const b = heights[j * hn + i + 1];
  const c = heights[(j + 1) * hn + i];
  const d = heights[(j + 1) * hn + i + 1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Hauteur du sol, tablier des ponts compris. */
export function groundHeight(map: TankMap, x: number, z: number): number {
  const h = heightFromGrid(map.heights, map.hn, x, z);
  return map.bridges.length > 0 ? Math.max(h, bridgeDeck(map, x, z)) : h;
}

/** Normale du sol (vecteur unitaire), sans allocation. */
export function groundNormal(map: TankMap, x: number, z: number, out: { x: number; y: number; z: number }) {
  const e = 1.5;
  const hx = groundHeight(map, x + e, z) - groundHeight(map, x - e, z);
  const hz = groundHeight(map, x, z + e) - groundHeight(map, x, z - e);
  const nx = -hx;
  const ny = 2 * e;
  const nz = -hz;
  const l = Math.hypot(nx, ny, nz);
  out.x = nx / l;
  out.y = ny / l;
  out.z = nz / l;
  return out;
}

export function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

/**
 * Le segment [a, b] traverse-t-il une maison (boite pleine) ? Renvoie la
 * fraction du premier contact, ou -1.
 */
export function segmentHouse(map: TankMap, ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  let best = -1;
  for (const h of map.houses) {
    const t = segmentAabb(ax, ay, az, bx, by, bz, h.x - h.w / 2, h.y - 1, h.z - h.d / 2, h.x + h.w / 2, h.y + h.h + h.roof, h.z + h.d / 2);
    if (t >= 0 && (best < 0 || t < best)) best = t;
  }
  return best;
}

export function segmentAabb(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
): number {
  let tNear = 0;
  let tFar = 1;
  const o = [ax, ay, az];
  const d = [bx - ax, by - ay, bz - az];
  const lo = [x0, y0, z0];
  const hi = [x1, y1, z1];
  for (let k = 0; k < 3; k++) {
    if (Math.abs(d[k]) < 1e-9) {
      if (o[k] < lo[k] || o[k] > hi[k]) return -1;
      continue;
    }
    let t1 = (lo[k] - o[k]) / d[k];
    let t2 = (hi[k] - o[k]) / d[k];
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tNear) tNear = t1;
    if (t2 < tFar) tFar = t2;
    if (tNear > tFar) return -1;
  }
  return tNear;
}

/**
 * Premier contact du segment avec le sol : on avance par pas de 2 m et on
 * affine par dichotomie. Renvoie la fraction du segment, ou -1.
 */
export function segmentGround(map: TankMap, ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  const len = Math.hypot(bx - ax, by - ay, bz - az);
  const steps = Math.max(1, Math.ceil(len / 2));
  let prevT = 0;
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    const z = az + (bz - az) * t;
    if (y < groundHeight(map, x, z)) {
      let lo = prevT;
      let hi = t;
      for (let k = 0; k < 6; k++) {
        const mid = (lo + hi) / 2;
        const mx = ax + (bx - ax) * mid;
        const my = ay + (by - ay) * mid;
        const mz = az + (bz - az) * mid;
        if (my < groundHeight(map, mx, mz)) hi = mid;
        else lo = mid;
      }
      return hi;
    }
    prevT = t;
  }
  return -1;
}

/** Le segment traverse-t-il un rocher (sphere aplatie) ? Fraction ou -1. */
export function segmentRock(map: TankMap, ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  let best = -1;
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const l2 = dx * dx + dy * dy + dz * dz;
  if (l2 < 1e-9) return -1;
  for (const r of map.rocks) {
    const cy = r.y + r.r * 0.35;
    const t = Math.max(0, Math.min(1, ((r.x - ax) * dx + (cy - ay) * dy + (r.z - az) * dz) / l2));
    const px = ax + dx * t - r.x;
    const py = ay + dy * t - cy;
    const pz = az + dz * t - r.z;
    if (px * px + py * py * 2.2 + pz * pz < r.r * r.r * 0.8 && (best < 0 || t < best)) best = t;
  }
  return best;
}

/** Ligne de vue entre deux points (sol, maisons, rochers). */
export function lineOfSight(map: TankMap, ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
  if (segmentGround(map, ax, ay, az, bx, by, bz) >= 0) return false;
  if (segmentHouse(map, ax, ay, az, bx, by, bz) >= 0) return false;
  return segmentRock(map, ax, ay, az, bx, by, bz) < 0;
}

// ---------------------------------------------------------- chemins

export function navCell(map: TankMap, x: number, z: number): number {
  const i = Math.floor((x + map.half) / NAV_STEP);
  const j = Math.floor((z + map.half) / NAV_STEP);
  if (i < 0 || j < 0 || i >= map.navN || j >= map.navN) return -1;
  return j * map.navN + i;
}

function cellCenter(map: TankMap, c: number): [number, number] {
  const i = c % map.navN;
  const j = (c - i) / map.navN;
  return [-map.half + (i + 0.5) * NAV_STEP, -map.half + (j + 0.5) * NAV_STEP];
}

/** La case libre la plus proche (spirale). */
function nearestFree(map: TankMap, c: number): number {
  if (c >= 0 && map.nav[c] === 0) return c;
  if (c < 0) return -1;
  const i0 = c % map.navN;
  const j0 = (c - i0) / map.navN;
  for (let r = 1; r < 12; r++) {
    for (let dj = -r; dj <= r; dj++) {
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const i = i0 + di;
        const j = j0 + dj;
        if (i < 0 || j < 0 || i >= map.navN || j >= map.navN) continue;
        const k = j * map.navN + i;
        if (map.nav[k] === 0) return k;
      }
    }
  }
  return -1;
}

/**
 * Chemin A* (8 directions) entre deux points, lisse en ligne droite quand la
 * grille le permet. Renvoie des points (x, z) ou null.
 */
export function findPath(map: TankMap, ax: number, az: number, bx: number, bz: number): [number, number][] | null {
  const start = nearestFree(map, navCell(map, ax, az));
  const goal = nearestFree(map, navCell(map, bx, bz));
  if (start < 0 || goal < 0) return null;
  if (start === goal) return [[bx, bz]];
  const N = map.navN;
  const total = N * N;
  const g = new Float32Array(total).fill(Infinity);
  const from = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);
  // Tas binaire de (f, case).
  const heapF: number[] = [];
  const heapC: number[] = [];
  const push = (f: number, c: number) => {
    heapF.push(f);
    heapC.push(c);
    let k = heapF.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heapF[p] <= heapF[k]) break;
      [heapF[p], heapF[k]] = [heapF[k], heapF[p]];
      [heapC[p], heapC[k]] = [heapC[k], heapC[p]];
      k = p;
    }
  };
  const pop = (): number => {
    const top = heapC[0];
    const lastF = heapF.pop()!;
    const lastC = heapC.pop()!;
    if (heapF.length > 0) {
      heapF[0] = lastF;
      heapC[0] = lastC;
      let k = 0;
      for (;;) {
        const l = k * 2 + 1;
        const r = l + 1;
        let m = k;
        if (l < heapF.length && heapF[l] < heapF[m]) m = l;
        if (r < heapF.length && heapF[r] < heapF[m]) m = r;
        if (m === k) break;
        [heapF[m], heapF[k]] = [heapF[k], heapF[m]];
        [heapC[m], heapC[k]] = [heapC[k], heapC[m]];
        k = m;
      }
    }
    return top;
  };
  const gi = goal % N;
  const gj = (goal - gi) / N;
  const h = (c: number) => {
    const i = c % N;
    const j = (c - i) / N;
    const dx = Math.abs(i - gi);
    const dy = Math.abs(j - gj);
    return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
  };
  g[start] = 0;
  push(h(start), start);
  let found = false;
  let guard = 0;
  while (heapF.length > 0 && guard++ < 16000) {
    const c = pop();
    if (closed[c]) continue;
    if (c === goal) {
      found = true;
      break;
    }
    closed[c] = 1;
    const ci = c % N;
    const cj = (c - ci) / N;
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const i = ci + di;
        const j = cj + dj;
        if (i < 0 || j < 0 || i >= N || j >= N) continue;
        const n = j * N + i;
        if (map.nav[n] || closed[n]) continue;
        // En diagonale, pas de coin coupe contre un obstacle.
        if (di && dj && (map.nav[cj * N + i] || map.nav[j * N + ci])) continue;
        const cost = g[c] + (di && dj ? 1.414 : 1);
        if (cost < g[n]) {
          g[n] = cost;
          from[n] = c;
          push(cost + h(n), n);
        }
      }
    }
  }
  if (!found) return null;
  const cells: number[] = [];
  for (let c = goal; c >= 0; c = from[c]) cells.push(c);
  cells.reverse();
  // Lissage : on saute les cases tant qu'une ligne droite reste libre.
  const pts: [number, number][] = [];
  let k = 0;
  while (k < cells.length - 1) {
    let far = k + 1;
    // On ne regarde pas plus de 24 cases devant : le lissage reste bon marche.
    for (let m = Math.min(cells.length - 1, k + 24); m > k + 1; m--) {
      if (gridClear(map, cells[k], cells[m])) {
        far = m;
        break;
      }
    }
    pts.push(cellCenter(map, cells[far]));
    k = far;
  }
  if (pts.length > 0) pts[pts.length - 1] = [bx, bz];
  return pts;
}

/** Ligne droite libre entre deux cases (on echantillonne la grille). */
function gridClear(map: TankMap, c0: number, c1: number): boolean {
  const [x0, z0] = cellCenter(map, c0);
  const [x1, z1] = cellCenter(map, c1);
  const len = Math.hypot(x1 - x0, z1 - z0);
  const steps = Math.ceil(len / (NAV_STEP * 0.5));
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const c = navCell(map, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t);
    if (c < 0 || map.nav[c]) return false;
  }
  return true;
}
