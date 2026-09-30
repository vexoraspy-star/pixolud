// La carte de « Tonnerre d'Acier » : la vallee de Castelroc.
//
// Un terrain de 600 m de cote entoure de montagnes (decor seulement) : une
// colline au centre portant un village perche et son clocher, un vallon a
// l'ouest avec une route et un lac, une crete a l'est, des fermes, des
// oliveraies et des cypres. Les deux bases se font face aux coins opposes.
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
/** Niveau de l'eau du lac. */
export const WATER_LEVEL = -1.6;
/** Rayon des cercles de capture. */
export const BASE_RADIUS = 26;
/** Pas de la grille de navigation des bots, en metres. */
export const NAV_STEP = 5;

export interface House {
  x: number;
  z: number;
  /** Largeur (x), profondeur (z) et hauteur des murs. */
  w: number;
  d: number;
  h: number;
  /** Le faitage court le long de x (sinon le long de z). */
  ridgeX: boolean;
  /** 0 = maison crepie, 1 = ferme en pierre, 2 = eglise, 3 = clocher. */
  kind: number;
  /** Hauteur du sol sous la maison. */
  y: number;
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
  /** 0 = olivier, 1 = cypres, 2 = pin parasol. */
  kind: number;
  scale: number;
  y: number;
}

export interface TankMap {
  seed: number;
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
  lake: { x: number; z: number; r: number };
  /** Grille de navigation : 1 = infranchissable. */
  nav: Uint8Array;
  navN: number;
  /** Points de passage des trois couloirs (ouest, centre, est), de la base 0 vers la base 1. */
  lanes: [number, number][][];
  /** Nom du village. */
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

// --------------------------------------------------------- relief

const VILLAGE = { x: 30, z: -20, r: 46 };
const LAKE = { x: -175, z: -35, r: 38 };
const BASES: [{ x: number; z: number }, { x: number; z: number }] = [
  { x: -215, z: 215 },
  { x: 215, z: -215 },
];

/** Hauteur « brute » du terrain, avant le lissage des bases et du village. */
function rawHeight(x: number, z: number, seed: number): number {
  let h = (fbm(x / 140, z / 140, seed) - 0.5) * 16;
  h += (fbm(x / 45, z / 45, seed + 7, 3) - 0.5) * 3;
  // La colline du village : un dome large et un plateau au sommet.
  const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
  h += 24 * Math.exp(-(dv * dv) / (2 * 78 * 78));
  // La crete de l'est : une longue bosse orientee nord-sud.
  const dr = Math.abs(x - 170 - Math.sin(z / 60) * 18);
  h += 13 * Math.exp(-(dr * dr) / (2 * 26 * 26)) * smoothstep(-280, -60, z) * (1 - smoothstep(120, 260, z));
  // Le vallon de l'ouest, et la cuvette du lac.
  const dw = Math.abs(x + 150 + Math.sin(z / 80) * 25);
  h -= 6 * Math.exp(-(dw * dw) / (2 * 40 * 40));
  const dl = Math.hypot(x - LAKE.x, z - LAKE.z);
  h -= 9 * Math.exp(-(dl * dl) / (2 * 30 * 30));
  // Montagnes de decor au-dela de la zone jouable.
  const edge = Math.max(Math.abs(x), Math.abs(z));
  const m = smoothstep(MAP_HALF - 10, MAP_HALF + 130, edge);
  h += m * (55 + (fbm(x / 90, z / 90, seed + 21) - 0.5) * 70);
  return h;
}

function heightAt(x: number, z: number, seed: number, villageY: number, baseY: [number, number]): number {
  let h = rawHeight(x, z, seed);
  // Plateau du village : on aplanit le sommet pour poser les maisons.
  const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
  const kv = 1 - smoothstep(VILLAGE.r - 8, VILLAGE.r + 10, dv);
  h = h + (villageY - h) * kv;
  // Bases : un terrain plat pour se regrouper au depart.
  for (let b = 0; b < 2; b++) {
    const db = Math.hypot(x - BASES[b].x, z - BASES[b].z);
    const kb = 1 - smoothstep(40, 70, db);
    h = h + (baseY[b] - h) * kb;
  }
  return h;
}

// --------------------------------------------------------- carte

export function buildTankMap(seed: number): TankMap {
  const rnd = mulberry32(seed || 1);
  const villageY = rawHeight(VILLAGE.x, VILLAGE.z, seed) - 1.5;
  const baseY: [number, number] = [rawHeight(BASES[0].x, BASES[0].z, seed), rawHeight(BASES[1].x, BASES[1].z, seed)];

  const hn = Math.round((WORLD_HALF * 2) / HEIGHT_STEP) + 1;
  const heights = new Float32Array(hn * hn);
  for (let j = 0; j < hn; j++) {
    const z = -WORLD_HALF + j * HEIGHT_STEP;
    for (let i = 0; i < hn; i++) {
      const x = -WORLD_HALF + i * HEIGHT_STEP;
      heights[j * hn + i] = heightAt(x, z, seed, villageY, baseY);
    }
  }
  const sample = (x: number, z: number) => heightFromGrid(heights, hn, x, z);

  // --- Le village perche : une place, deux rues, l'eglise et son clocher ---
  const houses: House[] = [];
  const addHouse = (x: number, z: number, w: number, d: number, h: number, kind: number, ridgeX: boolean) => {
    houses.push({ x, z, w, d, h, kind, ridgeX, y: sample(x, z) });
  };
  const vx = VILLAGE.x;
  const vz = VILLAGE.z;
  // Eglise a l'est de la place, clocher accole.
  addHouse(vx + 16, vz - 2, 10, 20, 9, 2, false);
  addHouse(vx + 16, vz + 12, 5.5, 5.5, 21, 3, true);
  // Deux rangees de maisons le long de la rue principale (nord-sud)...
  for (let k = 0; k < 5; k++) {
    const z = vz - 34 + k * 11 + (rnd() - 0.5) * 2;
    if (Math.abs(z - vz) < 6) continue;
    addHouse(vx - 12 - rnd() * 2, z, 8 + rnd() * 2, 8 + rnd() * 2, 5.5 + rnd() * 2.5, 0, rnd() < 0.5);
  }
  for (let k = 0; k < 4; k++) {
    const z = vz + 18 + k * 10 + (rnd() - 0.5) * 2;
    addHouse(vx + 3 + rnd() * 2, z, 8 + rnd() * 2, 7.5 + rnd() * 2, 5 + rnd() * 2.5, 0, rnd() < 0.5);
  }
  // ... et le long de la rue transversale (est-ouest).
  for (let k = 0; k < 4; k++) {
    const x = vx - 38 + k * 10 + (rnd() - 0.5) * 2;
    if (Math.abs(x - vx) < 18) continue;
    addHouse(x, vz + 12 + rnd() * 2, 7.5 + rnd() * 2, 8 + rnd() * 2, 5 + rnd() * 2.5, 0, rnd() < 0.5);
    addHouse(x, vz - 12 - rnd() * 2, 7.5 + rnd() * 2, 8 + rnd() * 2, 5 + rnd() * 2.5, 0, rnd() < 0.5);
  }
  // Fermes isolees : un corps de ferme et une grange.
  const farms: [number, number][] = [
    [-95, 120],
    [120, 95],
    [-120, -150],
    [175, -95],
    [-40, 190],
  ];
  for (const [fx, fz] of farms) {
    addHouse(fx, fz, 11, 7, 5.5, 1, true);
    addHouse(fx + 14, fz + 6, 9, 13, 6.5, 1, false);
  }

  // --- Murets de pierre autour des champs et du village ---
  const walls: Wall[] = [];
  const addWall = (x0: number, z0: number, x1: number, z1: number) => walls.push({ x0, z0, x1, z1, h: 1.1 });
  addWall(vx - 44, vz + 34, vx - 18, vz + 44);
  addWall(vx + 26, vz - 40, vx + 44, vz - 24);
  addWall(-150, 60, -100, 60);
  addWall(-100, 60, -100, 95);
  addWall(60, 120, 110, 120);
  addWall(90, -160, 140, -160);
  addWall(-60, -100, -60, -60);

  // --- Routes ---
  const roads: [number, number][][] = [
    // De la base ouest au village par le vallon.
    [
      [BASES[0].x, BASES[0].z],
      [-170, 150],
      [-150, 60],
      [-110, 10],
      [-40, -10],
      [vx - 20, vz],
      [vx + 30, vz + 2],
      [110, -60],
      [160, -150],
      [BASES[1].x, BASES[1].z],
    ],
    // La route du sud et de l'est, au pied de la crete.
    [
      [BASES[0].x, BASES[0].z],
      [-120, 230],
      [0, 200],
      [100, 150],
      [150, 60],
      [215, -40],
      [BASES[1].x, BASES[1].z],
    ],
    // La rue du village, nord-sud.
    [
      [vx - 5, vz - 60],
      [vx - 5, vz + 50],
      [vx - 20, 110],
      [-40, 190],
    ],
  ];

  // --- Champs (couleurs du sol seulement) ---
  const fields: TankMap["fields"] = [];
  for (let k = 0; k < 14; k++) {
    const x = (rnd() - 0.5) * 480;
    const z = (rnd() - 0.5) * 480;
    if (Math.hypot(x - vx, z - vz) < 70 || Math.hypot(x - LAKE.x, z - LAKE.z) < 60) continue;
    fields.push({ x, z, w: 40 + rnd() * 50, d: 30 + rnd() * 40, kind: Math.floor(rnd() * 3) });
  }

  // --- Occupation du sol : ce qui empeche de poser un arbre ou un rocher ---
  const nearRoad = (x: number, z: number, margin: number) => {
    for (const road of roads) {
      for (let k = 0; k + 1 < road.length; k++) {
        if (distToSegment(x, z, road[k][0], road[k][1], road[k + 1][0], road[k + 1][1]) < margin) return true;
      }
    }
    return false;
  };
  const inHouse = (x: number, z: number, margin: number) =>
    houses.some((h) => Math.abs(x - h.x) < h.w / 2 + margin && Math.abs(z - h.z) < h.d / 2 + margin);
  const nearBase = (x: number, z: number, margin: number) =>
    BASES.some((b) => Math.hypot(x - b.x, z - b.z) < margin);
  const inLake = (x: number, z: number, margin: number) => Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + margin;

  // --- Rochers : sur les pentes et en amas ---
  const rocks: Rock[] = [];
  for (let k = 0; k < 70; k++) {
    const x = (rnd() - 0.5) * 560;
    const z = (rnd() - 0.5) * 560;
    if (inHouse(x, z, 8) || nearRoad(x, z, 8) || nearBase(x, z, 60) || inLake(x, z, 4)) continue;
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

  // --- Arbres : oliveraies, cypres le long des routes, pins sur la crete ---
  const trees: Tree[] = [];
  const addTree = (x: number, z: number, kind: number) => {
    if (Math.abs(x) > MAP_HALF - 8 || Math.abs(z) > MAP_HALF - 8) return;
    if (inHouse(x, z, 3) || nearBase(x, z, 55) || inLake(x, z, 3)) return;
    if (rocks.some((r) => Math.hypot(x - r.x, z - r.z) < r.r + 1.5)) return;
    trees.push({ x, z, kind, scale: 0.8 + rnd() * 0.5, y: sample(x, z) });
  };
  // Oliveraies : des vergers en rangs.
  for (let g = 0; g < 9; g++) {
    const cx = (rnd() - 0.5) * 460;
    const cz = (rnd() - 0.5) * 460;
    if (Math.hypot(cx - vx, cz - vz) < 60) continue;
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

  // --- Buissons : du decor, on les traverse ---
  const bushes: TankMap["bushes"] = [];
  for (let k = 0; k < 360; k++) {
    const x = (rnd() - 0.5) * 580;
    const z = (rnd() - 0.5) * 580;
    if (inHouse(x, z, 2) || nearBase(x, z, 30) || inLake(x, z, 1) || nearRoad(x, z, 4)) continue;
    bushes.push({ x, z, s: 0.7 + rnd() * 0.9, y: sample(x, z) });
  }

  // --- Departs : en eventail devant chaque base, tournes vers l'adversaire ---
  const spawns: TankMap["spawns"] = [[], []];
  for (let b = 0; b < 2; b++) {
    const base = BASES[b];
    const other = BASES[1 - b];
    const toward = Math.atan2(other.x - base.x, other.z - base.z);
    for (let k = 0; k < 9; k++) {
      const row = Math.floor(k / 3);
      const col = (k % 3) - 1;
      const ax = Math.sin(toward);
      const az = Math.cos(toward);
      const x = base.x + ax * (row * 11 + 6) + az * col * 12;
      const z = base.z + az * (row * 11 + 6) - ax * col * 12;
      spawns[b].push({ x, z, yaw: toward });
    }
  }

  // --- Navigation ---
  const navN = Math.round((MAP_HALF * 2) / NAV_STEP);
  const nav = new Uint8Array(navN * navN);
  for (let j = 0; j < navN; j++) {
    for (let i = 0; i < navN; i++) {
      const x = -MAP_HALF + (i + 0.5) * NAV_STEP;
      const z = -MAP_HALF + (j + 0.5) * NAV_STEP;
      let blocked = Math.abs(x) > MAP_HALF - 6 || Math.abs(z) > MAP_HALF - 6;
      if (!blocked && inHouse(x, z, 3.5)) blocked = true;
      if (!blocked && inLake(x, z, -2)) blocked = true;
      if (!blocked && rocks.some((r) => Math.hypot(x - r.x, z - r.z) < r.r + 2.5)) blocked = true;
      if (!blocked) {
        for (const w of walls) {
          if (distToSegment(x, z, w.x0, w.z0, w.x1, w.z1) < 3) {
            blocked = true;
            break;
          }
        }
      }
      if (!blocked) {
        // Pente trop raide : un char la gravit mal.
        const s = Math.max(Math.abs(sample(x + 2.5, z) - sample(x - 2.5, z)), Math.abs(sample(x, z + 2.5) - sample(x, z - 2.5))) / 5;
        if (s > 0.55) blocked = true;
      }
      nav[j * navN + i] = blocked ? 1 : 0;
    }
  }

  // --- Couloirs pour les bots : ouest (vallon), centre (village), est (crete) ---
  const lanes: [number, number][][] = [
    [
      [-200, 150],
      [-165, 60],
      [-130, -20],
      [-60, -120],
      [60, -190],
      [BASES[1].x - 20, BASES[1].z + 15],
    ],
    [
      [-150, 150],
      [-70, 60],
      [vx - 10, vz + 20],
      [vx + 20, vz - 40],
      [120, -130],
      [BASES[1].x - 15, BASES[1].z + 10],
    ],
    [
      [-120, 215],
      [0, 190],
      [110, 130],
      [160, 30],
      [205, -90],
      [BASES[1].x, BASES[1].z + 20],
    ],
  ];

  return {
    seed,
    heights,
    hn,
    houses,
    walls,
    rocks,
    trees,
    bushes,
    roads,
    fields,
    bases: BASES,
    spawns,
    lake: LAKE,
    nav,
    navN,
    lanes,
    villageName: "Castelroc",
  };
}

// ---------------------------------------------------------- requetes

/** Hauteur du sol (interpolation bilineaire de la grille). */
export function heightFromGrid(heights: Float32Array, hn: number, x: number, z: number): number {
  const fx = (x + WORLD_HALF) / HEIGHT_STEP;
  const fz = (z + WORLD_HALF) / HEIGHT_STEP;
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

export function groundHeight(map: TankMap, x: number, z: number): number {
  return heightFromGrid(map.heights, map.hn, x, z);
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
    const t = segmentAabb(ax, ay, az, bx, by, bz, h.x - h.w / 2, h.y - 1, h.z - h.d / 2, h.x + h.w / 2, h.y + h.h + (h.kind === 3 ? 0 : 2.4), h.z + h.d / 2);
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
  const i = Math.floor((x + MAP_HALF) / NAV_STEP);
  const j = Math.floor((z + MAP_HALF) / NAV_STEP);
  if (i < 0 || j < 0 || i >= map.navN || j >= map.navN) return -1;
  return j * map.navN + i;
}

function cellCenter(map: TankMap, c: number): [number, number] {
  const i = c % map.navN;
  const j = (c - i) / map.navN;
  return [-MAP_HALF + (i + 0.5) * NAV_STEP, -MAP_HALF + (j + 0.5) * NAV_STEP];
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
