// Les Backrooms : definition des niveaux et generation procedurale.
//
// Chaque niveau est une grille plate, comme le Manoir : une case est pleine
// (mur, pilier, etagere) ou libre. La grille change a chaque partie, mais un
// BFS garantit toujours qu'on peut aller du depart a la sortie et a chaque
// objectif. Tout est en coordonnees de cases ; la taille d'une case en metres
// depend du niveau (les tunnels du niveau 2 sont plus serres que l'entrepot).

export type LevelId = "niveau-0" | "niveau-1" | "niveau-2" | "niveau-run";

export type ObjectiveKind = "sortie" | "fusibles" | "vannes" | "course";
export type EntityKind = "aucune" | "souriant" | "bacterie";
export type LightingKind = "neons" | "entrepot" | "secours" | "alarme";

export interface LevelDef {
  id: LevelId;
  /** Ce qu'on lit sur le carton : « 0 », « 1 », « ! ». */
  number: string;
  name: string;
  /** Une ligne de lore, sous le titre. */
  tagline: string;
  objective: ObjectiveKind;
  entity: EntityKind;
  lighting: LightingKind;
  /** Metres par case. */
  cellSize: number;
  wallHeight: number;
  width: number;
  height: number;
  /** Vitesses du joueur, en metres par seconde. */
  walk: number;
  sprint: number;
  crouch: number;
  /** Endurance : points perdus par seconde de course, regagnes en marchant. */
  staminaDrain: number;
  staminaRegen: number;
  /** Vitesses de l'entite, en metres par seconde. */
  entityWander: number;
  entityInvestigate: number;
  entityChase: number;
  /** Lucidite perdue par seconde, au calme et en pleine lumiere. */
  sanityDrain: number;
  fog: { color: number; near: number; far: number };
  hemi: { sky: number; ground: number; intensity: number };
  lamp: { color: number; intensity: number; range: number };
  waterCount: number;
  batteryCount: number;
  /** Fusibles ou vannes a trouver. */
  goalCount: number;
}

export const LEVELS: LevelDef[] = [
  {
    id: "niveau-0",
    number: "0",
    name: "Le Hall",
    tagline: "Moquette humide, papier peint jaune, et le bourdonnement des néons. Pour toujours.",
    objective: "sortie",
    entity: "aucune",
    lighting: "neons",
    cellSize: 2,
    wallHeight: 2.8,
    width: 70,
    height: 70,
    walk: 3.1,
    sprint: 5.4,
    crouch: 1.6,
    staminaDrain: 20,
    staminaRegen: 14,
    entityWander: 0,
    entityInvestigate: 0,
    entityChase: 0,
    sanityDrain: 0.32,
    fog: { color: 0x8a7b3c, near: 6, far: 34 },
    hemi: { sky: 0xfff1b0, ground: 0x6b5a1e, intensity: 1.05 },
    lamp: { color: 0xfff3c4, intensity: 2.6, range: 9 },
    waterCount: 10,
    batteryCount: 3,
    goalCount: 0,
  },
  {
    id: "niveau-1",
    number: "1",
    name: "Zone habitable",
    tagline: "Béton, flaques et caisses abandonnées. Quand les lumières s'éteignent, quelque chose sourit.",
    objective: "fusibles",
    entity: "souriant",
    lighting: "entrepot",
    cellSize: 2.5,
    wallHeight: 4.2,
    width: 60,
    height: 60,
    walk: 3.1,
    sprint: 5.4,
    crouch: 1.6,
    staminaDrain: 20,
    staminaRegen: 14,
    entityWander: 1.6,
    entityInvestigate: 2.6,
    entityChase: 4.1,
    sanityDrain: 0.4,
    fog: { color: 0x1d2024, near: 5, far: 38 },
    hemi: { sky: 0xb8c4cc, ground: 0x2a2620, intensity: 0.95 },
    lamp: { color: 0xffc27a, intensity: 4.6, range: 13 },
    waterCount: 8,
    batteryCount: 7,
    goalCount: 3,
  },
  {
    id: "niveau-2",
    number: "2",
    name: "Tuyauterie",
    tagline: "Des tunnels brûlants, des tuyaux qui cognent, et une chose qui écoute dans le noir.",
    objective: "vannes",
    entity: "bacterie",
    lighting: "secours",
    cellSize: 1.9,
    wallHeight: 2.5,
    width: 51,
    height: 51,
    walk: 3,
    sprint: 5.2,
    crouch: 1.5,
    staminaDrain: 22,
    staminaRegen: 13,
    entityWander: 1.8,
    entityInvestigate: 2.9,
    entityChase: 4.3,
    sanityDrain: 0.45,
    fog: { color: 0x120605, near: 3, far: 22 },
    hemi: { sky: 0x6a2a20, ground: 0x0c0605, intensity: 0.58 },
    lamp: { color: 0xff3b24, intensity: 2.4, range: 7 },
    waterCount: 7,
    batteryCount: 8,
    goalCount: 3,
  },
  {
    id: "niveau-run",
    number: "!",
    name: "Cours",
    tagline: "Un seul couloir. Une seule porte. Et elle est juste derrière toi.",
    objective: "course",
    entity: "bacterie",
    lighting: "alarme",
    cellSize: 2,
    wallHeight: 3,
    width: 35,
    height: 33,
    walk: 3.2,
    sprint: 5.8,
    crouch: 1.6,
    // Course longue : on garde de quoi sprinter, sinon la poursuite est perdue d'avance.
    staminaDrain: 8,
    staminaRegen: 22,
    entityWander: 4.5,
    entityInvestigate: 4.5,
    entityChase: 4.5,
    sanityDrain: 0,
    fog: { color: 0x2a0303, near: 4, far: 30 },
    hemi: { sky: 0xff5a4a, ground: 0x1a0202, intensity: 0.55 },
    lamp: { color: 0xff2a1a, intensity: 3.4, range: 9 },
    waterCount: 0,
    batteryCount: 0,
    goalCount: 0,
  },
];

export function levelById(id: string): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}

/** Cases : 0 libre, 1 mur, 2 pilier, 3 etagere (niveau 1). Tout sauf 0 est plein. */
export const CELL_OPEN = 0;
export const CELL_WALL = 1;
export const CELL_PILLAR = 2;
export const CELL_RACK = 3;

export type Dir = "N" | "S" | "E" | "W";
export const DIRS: Record<Dir, [number, number]> = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

/** Un emplacement contre un mur : la case libre, et le mur vers lequel on regarde. */
export interface WallSpot {
  x: number;
  y: number;
  dir: Dir;
}

export interface LightSpot {
  x: number;
  y: number;
  /** 0 marche, 1 morte, 2 clignote. */
  state: 0 | 1 | 2;
  /** Pour l'eclairage de secours : accrochee a un mur plutot qu'au plafond. */
  wall?: Dir;
}

export type PickupKind = "eau" | "pile" | "fusible";

export interface ArrowDecal extends WallSpot {
  /** Sens de la fleche, vu face au mur. */
  arrow: "gauche" | "droite";
  /** Une fleche sur six ment. */
  lie: boolean;
}

export interface LevelData {
  def: LevelDef;
  width: number;
  height: number;
  cells: Uint8Array;
  start: { x: number; y: number };
  /** Lacet de depart, dans la convention de la camera (0 = regarde vers -z). */
  startYaw: number;
  exit: WallSpot;
  lights: LightSpot[];
  pickups: { kind: PickupKind; x: number; y: number }[];
  /** Vannes du niveau 2, contre les murs. */
  valves: WallSpot[];
  arrows: ArrowDecal[];
  /** Case de depart de l'entite (null au niveau 0). */
  entityStart: { x: number; y: number } | null;
  /** Distance BFS depuis le depart, -1 si inaccessible. */
  distance: Int32Array;
}

/** Generateur pseudo-aleatoire a graine : une meme graine redonne le meme niveau. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function isSolidCell(cells: Uint8Array, w: number, h: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= w || y >= h) return true;
  return cells[y * w + x] !== CELL_OPEN;
}

export function bfsDistances(cells: Uint8Array, w: number, h: number, sx: number, sy: number): Int32Array {
  const dist = new Int32Array(w * h).fill(-1);
  if (isSolidCell(cells, w, h, sx, sy)) return dist;
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  dist[sy * w + sx] = 0;
  queue[tail++] = sy * w + sx;
  while (head < tail) {
    const i = queue[head++];
    const x = i % w;
    const y = (i - x) / w;
    const d = dist[i] + 1;
    if (x > 0 && cells[i - 1] === CELL_OPEN && dist[i - 1] < 0) {
      dist[i - 1] = d;
      queue[tail++] = i - 1;
    }
    if (x < w - 1 && cells[i + 1] === CELL_OPEN && dist[i + 1] < 0) {
      dist[i + 1] = d;
      queue[tail++] = i + 1;
    }
    if (y > 0 && cells[i - w] === CELL_OPEN && dist[i - w] < 0) {
      dist[i - w] = d;
      queue[tail++] = i - w;
    }
    if (y < h - 1 && cells[i + w] === CELL_OPEN && dist[i + w] < 0) {
      dist[i + w] = d;
      queue[tail++] = i + w;
    }
  }
  return dist;
}

/**
 * Relie toute case libre isolee au reste : on creuse un couloir en L jusqu'a
 * la case accessible la plus proche. Filet de securite des generateurs.
 */
function ensureConnected(cells: Uint8Array, w: number, h: number, sx: number, sy: number) {
  for (let guard = 0; guard < 400; guard++) {
    const dist = bfsDistances(cells, w, h, sx, sy);
    let lost = -1;
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] === CELL_OPEN && dist[i] < 0) {
        lost = i;
        break;
      }
    }
    if (lost < 0) return;
    const lx = lost % w;
    const ly = (lost - lx) / w;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < cells.length; i++) {
      if (dist[i] < 0) continue;
      const x = i % w;
      const y = (i - x) / w;
      const d = Math.abs(x - lx) + Math.abs(y - ly);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0) return;
    const bx = best % w;
    const by = (best - bx) / w;
    let x = lx;
    let y = ly;
    while (x !== bx) {
      x += Math.sign(bx - x);
      if (x > 0 && x < w - 1 && y > 0 && y < h - 1) cells[y * w + x] = CELL_OPEN;
    }
    while (y !== by) {
      y += Math.sign(by - y);
      if (x > 0 && x < w - 1 && y > 0 && y < h - 1) cells[y * w + x] = CELL_OPEN;
    }
  }
}

function border(cells: Uint8Array, w: number, h: number) {
  for (let x = 0; x < w; x++) {
    cells[x] = CELL_WALL;
    cells[(h - 1) * w + x] = CELL_WALL;
  }
  for (let y = 0; y < h; y++) {
    cells[y * w] = CELL_WALL;
    cells[y * w + w - 1] = CELL_WALL;
  }
}

/**
 * Treillis de murs : des cloisons tous les `block` cases, percees de portes,
 * parfois supprimees pour ouvrir de grandes salles. C'est l'ossature des
 * niveaux 0 et 1 — des bureaux vides a perte de vue.
 */
function lattice(
  cells: Uint8Array,
  w: number,
  h: number,
  rng: () => number,
  block: number,
  opts: { removeChance: number; gapMin: number; gapMax: number; extraGapChance: number },
) {
  // Cloisons verticales
  for (let lx = block; lx < w - 1; lx += block) {
    for (let y0 = 1; y0 < h - 1; y0 += block) {
      const y1 = Math.min(h - 2, y0 + block - 2);
      if (rng() < opts.removeChance) continue;
      for (let y = y0 - 1; y <= y1 + 1; y++) if (y > 0 && y < h - 1) cells[y * w + lx] = CELL_WALL;
      const gaps = rng() < opts.extraGapChance ? 2 : 1;
      for (let g = 0; g < gaps; g++) {
        const size = randInt(rng, opts.gapMin, opts.gapMax);
        const at = randInt(rng, y0, Math.max(y0, y1 - size + 1));
        for (let y = at; y < at + size && y <= y1; y++) cells[y * w + lx] = CELL_OPEN;
      }
    }
  }
  // Cloisons horizontales
  for (let ly = block; ly < h - 1; ly += block) {
    for (let x0 = 1; x0 < w - 1; x0 += block) {
      const x1 = Math.min(w - 2, x0 + block - 2);
      if (rng() < opts.removeChance) continue;
      for (let x = x0 - 1; x <= x1 + 1; x++) if (x > 0 && x < w - 1) cells[ly * w + x] = CELL_WALL;
      const gaps = rng() < opts.extraGapChance ? 2 : 1;
      for (let g = 0; g < gaps; g++) {
        const size = randInt(rng, opts.gapMin, opts.gapMax);
        const at = randInt(rng, x0, Math.max(x0, x1 - size + 1));
        for (let x = at; x < at + size && x <= x1; x++) cells[ly * w + x] = CELL_OPEN;
      }
    }
  }
}

/** Toutes les cases voisines (8) sont libres : on peut y poser un pilier sans boucher un passage. */
function surroundedByOpen(cells: Uint8Array, w: number, h: number, x: number, y: number, r = 1): boolean {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (isSolidCell(cells, w, h, x + dx, y + dy)) return false;
    }
  }
  return true;
}

function genHall(w: number, h: number, rng: () => number): Uint8Array {
  const cells = new Uint8Array(w * h);
  border(cells, w, h);
  lattice(cells, w, h, rng, 7, { removeChance: 0.26, gapMin: 2, gapMax: 3, extraGapChance: 0.35 });
  // Bouts de cloison qui s'avancent dans les pieces : ce qui rend le Hall si
  // desorientant, aucune piece n'a la meme forme.
  for (let i = 0; i < w * h * 0.018; i++) {
    const x = randInt(rng, 2, w - 3);
    const y = randInt(rng, 2, h - 3);
    if (!surroundedByOpen(cells, w, h, x, y)) continue;
    const horizontal = rng() < 0.5;
    const len = randInt(rng, 2, 4);
    for (let k = 0; k < len; k++) {
      const cx = horizontal ? x + k : x;
      const cy = horizontal ? y : y + k;
      if (cx >= w - 1 || cy >= h - 1) break;
      cells[cy * w + cx] = CELL_WALL;
    }
  }
  // Piliers isoles dans les grandes salles.
  for (let y = 2; y < h - 2; y += 3) {
    for (let x = 2; x < w - 2; x += 3) {
      if (rng() < 0.22 && surroundedByOpen(cells, w, h, x, y)) cells[y * w + x] = CELL_PILLAR;
    }
  }
  return cells;
}

function genWarehouse(w: number, h: number, rng: () => number): Uint8Array {
  const cells = new Uint8Array(w * h);
  border(cells, w, h);
  lattice(cells, w, h, rng, 12, { removeChance: 0.32, gapMin: 3, gapMax: 5, extraGapChance: 0.6 });
  // Piliers de beton, en grille reguliere : c'est un entrepot.
  for (let y = 3; y < h - 2; y += 4) {
    for (let x = 3; x < w - 2; x += 4) {
      if (surroundedByOpen(cells, w, h, x, y)) cells[y * w + x] = CELL_PILLAR;
    }
  }
  // Rayonnages : des rangees d'etageres avec des allees entre elles.
  for (let i = 0; i < 18; i++) {
    const x0 = randInt(rng, 3, w - 10);
    const y0 = randInt(rng, 3, h - 10);
    const vertical = rng() < 0.5;
    const rows = randInt(rng, 2, 3);
    const len = randInt(rng, 4, 7);
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < len; k++) {
        const cx = vertical ? x0 + r * 3 : x0 + k;
        const cy = vertical ? y0 + k : y0 + r * 3;
        if (cx <= 1 || cy <= 1 || cx >= w - 2 || cy >= h - 2) continue;
        if (cells[cy * w + cx] === CELL_OPEN) cells[cy * w + cx] = CELL_RACK;
      }
    }
  }
  return cells;
}

function genPipes(w: number, h: number, rng: () => number): Uint8Array {
  // Labyrinthe parfait sur une grille grossiere (une case sur deux), puis on
  // abat des cloisons : sans boucles, la chose te coinçait a chaque cul-de-sac.
  const cells = new Uint8Array(w * h).fill(CELL_WALL);
  const mw = (w - 1) / 2;
  const mh = (h - 1) / 2;
  const seen = new Uint8Array(mw * mh);
  const stack: number[] = [0];
  seen[0] = 1;
  cells[1 * w + 1] = CELL_OPEN;
  while (stack.length > 0) {
    const cur = stack[stack.length - 1];
    const cx = cur % mw;
    const cy = (cur - cx) / mw;
    const options: [number, number][] = [];
    for (const [dx, dy] of Object.values(DIRS)) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= mw || ny >= mh || seen[ny * mw + nx]) continue;
      options.push([nx, ny]);
    }
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const [nx, ny] = options[Math.floor(rng() * options.length)];
    seen[ny * mw + nx] = 1;
    cells[(2 * ny + 1) * w + (2 * nx + 1)] = CELL_OPEN;
    cells[(cy + ny + 1) * w + (cx + nx + 1)] = CELL_OPEN;
    stack.push(ny * mw + nx);
  }
  // Boucles.
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (cells[y * w + x] !== CELL_WALL) continue;
      const horiz = !isSolidCell(cells, w, h, x - 1, y) && !isSolidCell(cells, w, h, x + 1, y);
      const vert = !isSolidCell(cells, w, h, x, y - 1) && !isSolidCell(cells, w, h, x, y + 1);
      if ((horiz || vert) && rng() < 0.14) cells[y * w + x] = CELL_OPEN;
    }
  }
  // Quelques salles des machines, pour respirer.
  for (let i = 0; i < 6; i++) {
    const x0 = randInt(rng, 2, w - 6);
    const y0 = randInt(rng, 2, h - 6);
    for (let y = y0; y < y0 + 3; y++) for (let x = x0; x < x0 + 3; x++) cells[y * w + x] = CELL_OPEN;
  }
  border(cells, w, h);
  return cells;
}

/**
 * Le niveau « ! » : un couloir en serpentin de trois cases de large. Des
 * barrieres ferment deux voies sur trois : on zigzague en courant.
 */
function genRun(w: number, h: number, rng: () => number): { cells: Uint8Array; end: { x: number; y: number } } {
  const cells = new Uint8Array(w * h).fill(CELL_WALL);
  const rows: number[] = [];
  for (let y0 = 1; y0 + 2 < h - 1; y0 += 4) rows.push(y0);
  rows.forEach((y0, r) => {
    for (let y = y0; y < y0 + 3; y++) for (let x = 1; x < w - 1; x++) cells[y * w + x] = CELL_OPEN;
    // Virage vers la rangee suivante, alternativement a droite et a gauche.
    if (r < rows.length - 1) {
      const turnRight = r % 2 === 0;
      for (let x = turnRight ? w - 4 : 1; x < (turnRight ? w - 1 : 4); x++) cells[(y0 + 3) * w + x] = CELL_OPEN;
    }
    // Barrieres : deux voies sur trois, jamais trop pres des virages.
    for (let x = 6; x < w - 6; x += randInt(rng, 5, 7)) {
      const keep = randInt(rng, 0, 2);
      for (let lane = 0; lane < 3; lane++) {
        if (lane !== keep) cells[(y0 + lane) * w + x] = CELL_PILLAR;
      }
    }
  });
  const lastRow = rows[rows.length - 1];
  const endRight = (rows.length - 1) % 2 === 0;
  return { cells, end: { x: endRight ? w - 2 : 1, y: lastRow + 1 } };
}

/** Emplacements contre un mur autour d'une case libre. */
function wallDirs(cells: Uint8Array, w: number, h: number, x: number, y: number): Dir[] {
  return (Object.keys(DIRS) as Dir[]).filter((d) => {
    const [dx, dy] = DIRS[d];
    return isSolidCell(cells, w, h, x + dx, y + dy) && cells[(y + dy) * w + (x + dx)] !== CELL_RACK;
  });
}

/** Choisit `count` cases libres eloignees les unes des autres et du depart. */
function spreadCells(
  rng: () => number,
  candidates: number[],
  count: number,
  w: number,
  minGap: number,
  avoid: { x: number; y: number }[],
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const pool = [...candidates];
  for (let gap = minGap; out.length < count && gap >= 2; gap = Math.floor(gap * 0.7)) {
    for (let tries = 0; tries < pool.length * 2 && out.length < count; tries++) {
      const i = pool[Math.floor(rng() * pool.length)];
      const x = i % w;
      const y = (i - x) / w;
      const near = [...out, ...avoid].some((p) => Math.abs(p.x - x) + Math.abs(p.y - y) < gap);
      if (!near) out.push({ x, y });
    }
  }
  return out;
}

export function generateLevel(def: LevelDef, seed: number): LevelData {
  const rng = mulberry32(seed ^ (def.width * 7919));
  const w = def.width;
  const h = def.height;
  let cells: Uint8Array;
  let start = { x: Math.floor(w / 2), y: Math.floor(h / 2) };
  let runEnd: { x: number; y: number } | null = null;

  if (def.id === "niveau-run") {
    const run = genRun(w, h, rng);
    cells = run.cells;
    start = { x: 2, y: 2 };
    runEnd = run.end;
  } else {
    cells = def.id === "niveau-1" ? genWarehouse(w, h, rng) : def.id === "niveau-2" ? genPipes(w, h, rng) : genHall(w, h, rng);
    // Le depart est la case libre la plus proche du centre.
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] !== CELL_OPEN) continue;
      const x = i % w;
      const y = (i - x) / w;
      const d = Math.abs(x - w / 2) + Math.abs(y - h / 2);
      if (d < bestD && surroundedByOpen(cells, w, h, x, y, def.id === "niveau-2" ? 0 : 1)) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0) best = cells.indexOf(CELL_OPEN);
    start = { x: best % w, y: Math.floor(best / w) };
  }
  cells[start.y * w + start.x] = CELL_OPEN;
  ensureConnected(cells, w, h, start.x, start.y);
  const distance = bfsDistances(cells, w, h, start.x, start.y);

  const reachable: number[] = [];
  let maxDist = 0;
  for (let i = 0; i < cells.length; i++) {
    if (distance[i] > 0) {
      reachable.push(i);
      if (distance[i] > maxDist) maxDist = distance[i];
    }
  }

  // --- Sortie : une porte dans un mur, parmi les cases les plus eloignees ---
  let exit: WallSpot = { x: start.x, y: start.y, dir: "N" };
  if (runEnd) {
    exit = { x: runEnd.x, y: runEnd.y, dir: runEnd.x === 1 ? "W" : "E" };
  } else {
    const far = reachable
      .filter((i) => distance[i] >= maxDist * 0.82)
      .map((i) => ({ x: i % w, y: Math.floor(i / w) }))
      .map((c) => ({ ...c, dirs: wallDirs(cells, w, h, c.x, c.y) }))
      .filter((c) => c.dirs.length > 0);
    const pick = far[Math.floor(rng() * far.length)] ?? { x: start.x, y: start.y, dirs: ["N" as Dir] };
    exit = { x: pick.x, y: pick.y, dir: pick.dirs[Math.floor(rng() * pick.dirs.length)] };
  }

  // --- Lumieres ---
  const lights: LightSpot[] = [];
  const lightState = (deadChance: number, flickerChance: number): 0 | 1 | 2 => {
    const r = rng();
    return r < deadChance ? 1 : r < deadChance + flickerChance ? 2 : 0;
  };
  if (def.lighting === "neons") {
    for (let y = 1; y < h - 1; y += 3) {
      for (let x = 1; x < w - 1; x += 2) {
        if (cells[y * w + x] === CELL_OPEN) lights.push({ x, y, state: lightState(0.07, 0.06) });
      }
    }
  } else if (def.lighting === "entrepot") {
    for (let y = 2; y < h - 1; y += 4) {
      for (let x = 2; x < w - 1; x += 4) {
        if (cells[y * w + x] === CELL_OPEN) lights.push({ x, y, state: lightState(0.22, 0.1) });
      }
    }
  } else if (def.lighting === "secours") {
    // Ampoules rouges accrochees aux murs, rares : la lampe est indispensable.
    for (const i of reachable) {
      const x = i % w;
      const y = (i - x) / w;
      if ((x * 7 + y * 13) % 9 !== 0) continue;
      const dirs = wallDirs(cells, w, h, x, y);
      if (dirs.length === 0 || rng() < 0.35) continue;
      lights.push({ x, y, state: lightState(0.15, 0.2), wall: dirs[0] });
    }
  } else {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x += 3) {
        if (cells[y * w + x] === CELL_OPEN && (y - 1) % 4 === 1) lights.push({ x, y, state: lightState(0.05, 0.25) });
      }
    }
  }

  // --- Objets et objectifs ---
  const openReachable = reachable.filter((i) => {
    const x = i % w;
    const y = (i - x) / w;
    return Math.abs(x - start.x) + Math.abs(y - start.y) > 3 && !(x === exit.x && y === exit.y);
  });
  const pickups: LevelData["pickups"] = [];
  const valves: WallSpot[] = [];
  const taken: { x: number; y: number }[] = [start, exit];

  if (def.objective === "fusibles") {
    const farPool = openReachable.filter((i) => distance[i] > maxDist * 0.35);
    for (const c of spreadCells(rng, farPool, def.goalCount, w, 14, taken)) {
      pickups.push({ kind: "fusible", ...c });
      taken.push(c);
    }
  }
  if (def.objective === "vannes") {
    const wallPool = openReachable.filter((i) => {
      const x = i % w;
      const y = (i - x) / w;
      return distance[i] > maxDist * 0.3 && wallDirs(cells, w, h, x, y).length >= 2;
    });
    for (const c of spreadCells(rng, wallPool, def.goalCount, w, 12, taken)) {
      const dirs = wallDirs(cells, w, h, c.x, c.y);
      valves.push({ ...c, dir: dirs[Math.floor(rng() * dirs.length)] });
      taken.push(c);
    }
  }
  for (const c of spreadCells(rng, openReachable, def.waterCount, w, 9, taken)) {
    pickups.push({ kind: "eau", ...c });
    taken.push(c);
  }
  for (const c of spreadCells(rng, openReachable, def.batteryCount, w, 8, taken)) {
    pickups.push({ kind: "pile", ...c });
    taken.push(c);
  }

  // --- Fleches taguees le long du bon chemin (niveau 0) ---
  const arrows: ArrowDecal[] = [];
  if (def.objective === "sortie") {
    // Chemin : on redescend les distances depuis la sortie.
    const path: { x: number; y: number }[] = [{ x: exit.x, y: exit.y }];
    let cur = { x: exit.x, y: exit.y };
    for (let guard = 0; guard < w * h && distance[cur.y * w + cur.x] > 0; guard++) {
      const d = distance[cur.y * w + cur.x];
      const next = Object.values(DIRS)
        .map(([dx, dy]) => ({ x: cur.x + dx, y: cur.y + dy }))
        .find((n) => !isSolidCell(cells, w, h, n.x, n.y) && distance[n.y * w + n.x] === d - 1);
      if (!next) break;
      path.push(next);
      cur = next;
    }
    path.reverse();
    for (let i = 3; i < path.length - 1; i += randInt(rng, 4, 7)) {
      const p = path[i];
      const go: [number, number] = [path[i + 1].x - p.x, path[i + 1].y - p.y];
      for (const d of wallDirs(cells, w, h, p.x, p.y)) {
        const [wx, wy] = DIRS[d];
        // Vu face au mur, la droite du joueur est (-wy, wx).
        const rx = -wy;
        const ry = wx;
        let arrow: "gauche" | "droite" | null = null;
        if (go[0] === rx && go[1] === ry) arrow = "droite";
        else if (go[0] === -rx && go[1] === -ry) arrow = "gauche";
        if (!arrow) continue;
        const lie = rng() < 1 / 6;
        arrows.push({ x: p.x, y: p.y, dir: d, arrow: lie ? (arrow === "droite" ? "gauche" : "droite") : arrow, lie });
        break;
      }
    }
  }

  // --- Entite ---
  let entityStart: { x: number; y: number } | null = null;
  if (def.entity === "bacterie") {
    if (def.id === "niveau-run") {
      entityStart = { ...start };
    } else {
      const far = openReachable.filter((i) => distance[i] > maxDist * 0.6);
      const i = far[Math.floor(rng() * far.length)] ?? openReachable[0];
      entityStart = { x: i % w, y: Math.floor(i / w) };
    }
  } else if (def.entity === "souriant") {
    const i = openReachable[Math.floor(rng() * openReachable.length)];
    entityStart = { x: i % w, y: Math.floor(i / w) };
  }

  // Regard de depart : vers la plus longue ligne droite libre.
  let startYaw = 0;
  let longest = -1;
  for (const d of Object.keys(DIRS) as Dir[]) {
    const [dx, dy] = DIRS[d];
    let len = 0;
    while (!isSolidCell(cells, w, h, start.x + dx * (len + 1), start.y + dy * (len + 1))) len++;
    if (len > longest) {
      longest = len;
      startYaw = Math.atan2(-dx, -dy);
    }
  }

  return { def, width: w, height: h, cells, start, startYaw, exit, lights, pickups, valves, arrows, entityStart, distance };
}
