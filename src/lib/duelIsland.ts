// L'ile de la battle royale.
//
// Une grande ile generee a chaque partie : une cote irreguliere bordee de
// sable, sept lieux nommes (village, docks, ferme, chantier, villa, marche et
// une place centrale), des chemins de terre qui les relient et des bosquets
// d'arbres entre les deux. On choisit ou atterrir sur la carte, on descend en
// parachute, et la zone se referme sur l'ile.
//
// Tout est en cases, comme les autres cartes du Duel. Un BFS garantit qu'on
// peut aller de n'importe quelle case libre a n'importe quelle autre.

/** Contenu d'une case : libre, mur, caisse, arbre, eau. */
export const ILE_LIBRE = 0;
export const ILE_MUR = 1;
export const ILE_CAISSE = 2;
export const ILE_ARBRE = 3;
export const ILE_EAU = 4;

/** Nature du sol, pour la texture : herbe, sable, beton, terre, eau, parquet. */
export const SOL_HERBE = 0;
export const SOL_SABLE = 1;
export const SOL_BETON = 2;
export const SOL_TERRE = 3;
export const SOL_EAU = 4;
export const SOL_PARQUET = 5;

export type PoiKind = "place" | "village" | "docks" | "ferme" | "chantier" | "villa" | "marche";

export interface IslandPoi {
  name: string;
  kind: PoiKind;
  x: number;
  y: number;
}

export interface IslandMap {
  width: number;
  height: number;
  cells: Uint8Array;
  ground: Uint8Array;
  /** Toutes les cases qui bloquent : murs, caisses, arbres et eau. */
  walls: [number, number][];
  /** Les murs de batiments, seuls dessines en murs. */
  structures: [number, number][];
  crates: [number, number][];
  trees: [number, number][];
  loot: [number, number][];
  spawns: [number, number][];
  pois: IslandPoi[];
  /** Rayon approximatif de l'ile, en cases (pour la zone de depart). */
  radius: number;
}

export const ISLAND_SIZE = 76;
/** Duree totale de la fermeture de la zone, a partir de l'atterrissage. */
export const ISLAND_SHRINK_SECONDS = 330;
/** La zone ne bouge pas pendant ce temps : on s'equipe. */
export const ISLAND_GRACE_SECONDS = 50;
export const ISLAND_FINAL_RADIUS = 5;
/** Au-dela, on saute automatiquement sur un lieu au hasard. */
export const ISLAND_DROP_SECONDS = 20;
/** Hauteur du saut, en metres. */
export const ISLAND_DROP_HEIGHT = 55;

const POI_NAMES: Record<PoiKind, string> = {
  place: "Place Centrale",
  village: "Les Hameaux",
  docks: "Docks Rouillés",
  ferme: "Ferme Tranquille",
  chantier: "Chantier Nord",
  villa: "Villa des Pins",
  marche: "Marché Couvert",
};

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

export function buildIsland(seed: number): IslandMap {
  const W = ISLAND_SIZE;
  const H = ISLAND_SIZE;
  const rng = mulberry32(seed || 1);
  const randInt = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
  const cells = new Uint8Array(W * H);
  const ground = new Uint8Array(W * H);
  const idx = (x: number, y: number) => y * W + x;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const cx = W / 2;
  const cy = H / 2;

  // --- La cote : un cercle bossele par trois sinusoides ---
  const ph = [rng() * 6.28, rng() * 6.28, rng() * 6.28];
  const radius = 31;
  const coastAt = (a: number) => radius + Math.sin(a * 3 + ph[0]) * 2.2 + Math.sin(a * 5 + ph[1]) * 1.3 + Math.sin(a * 2 + ph[2]) * 1.8;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const r = coastAt(Math.atan2(y + 0.5 - cy, x + 0.5 - cx));
      if (d > r || x === 0 || y === 0 || x === W - 1 || y === H - 1) {
        cells[idx(x, y)] = ILE_EAU;
        ground[idx(x, y)] = SOL_EAU;
      } else if (d > r - 2.3) {
        ground[idx(x, y)] = SOL_SABLE;
      }
    }
  }

  const loot: [number, number][] = [];
  const pois: IslandPoi[] = [];
  /** Emprise des lieux : pas d'arbres dedans. */
  const reserved: { x0: number; y0: number; x1: number; y1: number }[] = [];

  const setCell = (x: number, y: number, v: number) => {
    if (!inside(x, y) || cells[idx(x, y)] === ILE_EAU) return;
    cells[idx(x, y)] = v;
  };
  const setGround = (x: number, y: number, v: number) => {
    if (!inside(x, y) || ground[idx(x, y)] === SOL_EAU) return;
    ground[idx(x, y)] = v;
  };
  const addLoot = (x: number, y: number) => {
    if (inside(x, y) && cells[idx(x, y)] === ILE_LIBRE) loot.push([x, y]);
  };

  /** Un batiment : quatre murs, des portes de deux ou trois cases, un sol. */
  function building(x0: number, y0: number, w: number, h: number, floor: number, doors: number) {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
        setCell(x, y, edge ? ILE_MUR : ILE_LIBRE);
        setGround(x, y, floor);
      }
    }
    const sides = [0, 1, 2, 3].sort(() => rng() - 0.5).slice(0, doors);
    for (const side of sides) {
      const size = randInt(2, 3);
      if (side === 0 || side === 2) {
        const at = randInt(x0 + 1, x0 + w - 1 - size);
        const y = side === 0 ? y0 : y0 + h - 1;
        for (let x = at; x < at + size; x++) setCell(x, y, ILE_LIBRE);
      } else {
        const at = randInt(y0 + 1, y0 + h - 1 - size);
        const x = side === 1 ? x0 + w - 1 : x0;
        for (let y = at; y < at + size; y++) setCell(x, y, ILE_LIBRE);
      }
    }
    reserved.push({ x0: x0 - 2, y0: y0 - 2, x1: x0 + w + 1, y1: y0 + h + 1 });
  }

  /** Un bloc de caisses, jamais colle a un mur (une case de marge). */
  function crateBlock(x0: number, y0: number, w: number, h: number) {
    for (let y = y0 - 1; y <= y0 + h; y++) {
      for (let x = x0 - 1; x <= x0 + w; x++) {
        if (!inside(x, y) || cells[idx(x, y)] !== ILE_LIBRE) return;
      }
    }
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setCell(x, y, ILE_CAISSE);
  }

  const stamp: Record<PoiKind, (px: number, py: number) => void> = {
    place(px, py) {
      // Un anneau de murs perce aux quatre points cardinaux, sol de terre battue.
      const r = 7;
      for (let y = py - r - 1; y <= py + r + 1; y++) {
        for (let x = px - r - 1; x <= px + r + 1; x++) {
          const d = Math.hypot(x - px, y - py);
          if (d <= r + 0.5) setGround(x, y, SOL_TERRE);
          if (Math.abs(d - r) < 0.55) {
            const gap = Math.abs(x - px) <= 1 || Math.abs(y - py) <= 1;
            setCell(x, y, gap ? ILE_LIBRE : ILE_MUR);
          }
        }
      }
      crateBlock(px - 3, py - 3, 2, 1);
      crateBlock(px + 2, py + 3, 2, 1);
      crateBlock(px + 3, py - 3, 1, 2);
      crateBlock(px - 4, py + 2, 1, 2);
      addLoot(px, py);
      addLoot(px + 1, py - 1);
      addLoot(px - 2, py + 1);
      reserved.push({ x0: px - r - 2, y0: py - r - 2, x1: px + r + 2, y1: py + r + 2 });
    },
    village(px, py) {
      // Quatre maisons autour d'une petite place.
      for (const [dx, dy] of [
        [-9, -8],
        [2, -8],
        [-9, 2],
        [2, 2],
      ]) {
        const w = randInt(6, 7);
        const h = randInt(5, 6);
        building(px + dx, py + dy, w, h, SOL_PARQUET, randInt(1, 2));
        addLoot(px + dx + Math.floor(w / 2), py + dy + Math.floor(h / 2));
      }
      for (let y = py - 1; y <= py + 1; y++) for (let x = px - 10; x <= px + 10; x++) setGround(x, y, SOL_TERRE);
    },
    docks(px, py) {
      building(px - 9, py - 4, 8, 7, SOL_BETON, 2);
      building(px + 1, py - 4, 8, 7, SOL_BETON, 2);
      for (let y = py - 6; y <= py + 6; y++) for (let x = px - 11; x <= px + 11; x++) {
        if (inside(x, y) && ground[idx(x, y)] !== SOL_EAU && ground[idx(x, y)] !== SOL_BETON) setGround(x, y, SOL_BETON);
      }
      crateBlock(px - 6, py - 1, 2, 2);
      crateBlock(px + 4, py, 2, 1);
      crateBlock(px - 2, py + 5, 3, 1);
      crateBlock(px + 3, py - 7, 2, 1);
      addLoot(px - 5, py + 1);
      addLoot(px + 5, py - 2);
      addLoot(px, py + 4);
    },
    ferme(px, py) {
      // Une grange, un champ de terre et des bottes de foin (caisses).
      building(px - 5, py - 7, 10, 7, SOL_PARQUET, 2);
      for (let y = py + 1; y <= py + 8; y++) for (let x = px - 7; x <= px + 7; x++) setGround(x, y, SOL_TERRE);
      crateBlock(px - 4, py + 3, 2, 1);
      crateBlock(px + 2, py + 5, 2, 1);
      crateBlock(px - 1, py + 7, 1, 1);
      addLoot(px, py - 4);
      addLoot(px - 3, py - 3);
      addLoot(px + 4, py + 2);
      reserved.push({ x0: px - 8, y0: py, x1: px + 8, y1: py + 9 });
    },
    chantier(px, py) {
      for (let y = py - 7; y <= py + 7; y++) for (let x = px - 8; x <= px + 8; x++) setGround(x, y, SOL_BETON);
      // Murs en L a moitie construits, et des palettes de caisses.
      for (let k = 0; k < 5; k++) {
        const x0 = px + randInt(-6, 4);
        const y0 = py + randInt(-6, 4);
        const len = randInt(3, 5);
        for (let i = 0; i < len; i++) setCell(x0 + i, y0, ILE_MUR);
        for (let i = 1; i < 3; i++) setCell(x0, y0 + i, ILE_MUR);
      }
      crateBlock(px - 2, py + 2, 2, 2);
      crateBlock(px + 4, py - 4, 1, 2);
      addLoot(px, py);
      addLoot(px + 3, py + 3);
      addLoot(px - 5, py - 2);
      reserved.push({ x0: px - 9, y0: py - 8, x1: px + 9, y1: py + 8 });
    },
    villa(px, py) {
      building(px - 6, py - 5, 12, 10, SOL_PARQUET, 2);
      // Cloison interieure percee : deux pieces.
      for (let y = py - 4; y <= py + 3; y++) setCell(px, y, y === py || y === py - 1 ? ILE_LIBRE : ILE_MUR);
      crateBlock(px - 4, py + 2, 1, 1);
      addLoot(px - 3, py - 2);
      addLoot(px + 3, py + 1);
      addLoot(px + 2, py - 3);
    },
    marche(px, py) {
      building(px - 7, py - 5, 14, 10, SOL_BETON, 3);
      // Etals : deux rangees de caisses avec une allee au milieu.
      crateBlock(px - 4, py - 2, 3, 1);
      crateBlock(px + 1, py - 2, 3, 1);
      crateBlock(px - 4, py + 2, 3, 1);
      crateBlock(px + 1, py + 2, 3, 1);
      addLoot(px, py);
      addLoot(px - 5, py);
      addLoot(px + 5, py - 3);
    },
  };

  // --- Les lieux : la place au centre, six autres en couronne ---
  stamp.place(Math.floor(cx), Math.floor(cy));
  pois.push({ name: POI_NAMES.place, kind: "place", x: Math.floor(cx), y: Math.floor(cy) });
  const ring: PoiKind[] = ["village", "docks", "ferme", "chantier", "villa", "marche"].sort(() => rng() - 0.5) as PoiKind[];
  const base = rng() * Math.PI * 2;
  ring.forEach((kind, k) => {
    const a = base + (k * Math.PI * 2) / ring.length + (rng() - 0.5) * 0.3;
    const dist = 19 + rng() * 2.5;
    const px = Math.floor(cx + Math.cos(a) * dist);
    const py = Math.floor(cy + Math.sin(a) * dist);
    stamp[kind](px, py);
    pois.push({ name: POI_NAMES[kind], kind, x: px, y: py });
  });

  // --- Chemins de terre de la place vers chaque lieu ---
  for (const poi of pois.slice(1)) {
    const steps = Math.ceil(Math.hypot(poi.x - cx, poi.y - cy));
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(cx + ((poi.x - cx) * s) / steps);
      const y = Math.round(cy + ((poi.y - cy) * s) / steps);
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [0, 1],
      ]) {
        const gx = x + dx;
        const gy = y + dy;
        if (inside(gx, gy) && ground[idx(gx, gy)] === SOL_HERBE) ground[idx(gx, gy)] = SOL_TERRE;
      }
    }
  }

  // --- Bosquets d'arbres entre les lieux ---
  const fx = rng() * 10;
  const fy = rng() * 10;
  const isReserved = (x: number, y: number) => reserved.some((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);
  for (let y = 2; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      if (cells[idx(x, y)] !== ILE_LIBRE || ground[idx(x, y)] !== SOL_HERBE || isReserved(x, y)) continue;
      const forest = Math.sin(x * 0.23 + fx) * Math.sin(y * 0.19 + fy);
      const chance = forest > 0.12 ? 0.5 : 0.05;
      if (rng() > chance) continue;
      // Un arbre n'a que des voisins libres : il ne peut jamais couper un passage.
      let free = true;
      for (let dy = -1; dy <= 1 && free; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (cells[idx(x + dx, y + dy)] !== ILE_LIBRE) {
            free = false;
            break;
          }
        }
      }
      if (free) cells[idx(x, y)] = ILE_ARBRE;
    }
  }

  // --- Connexite : tout ce qui est libre doit etre atteignable depuis la place ---
  const start = idx(Math.floor(cx), Math.floor(cy));
  cells[start] = ILE_LIBRE;
  const bfs = () => {
    const dist = new Int32Array(W * H).fill(-1);
    const queue = new Int32Array(W * H);
    let head = 0;
    let tail = 0;
    dist[start] = 0;
    queue[tail++] = start;
    while (head < tail) {
      const i = queue[head++];
      const x = i % W;
      const y = (i - x) / W;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inside(nx, ny)) continue;
        const ni = idx(nx, ny);
        if (cells[ni] === ILE_LIBRE && dist[ni] < 0) {
          dist[ni] = dist[i] + 1;
          queue[tail++] = ni;
        }
      }
    }
    return dist;
  };
  for (let guard = 0; guard < 300; guard++) {
    const dist = bfs();
    let lost = -1;
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] === ILE_LIBRE && dist[i] < 0) {
        lost = i;
        break;
      }
    }
    if (lost < 0) break;
    const lx = lost % W;
    const ly = (lost - lx) / W;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < cells.length; i++) {
      if (dist[i] < 0) continue;
      const x = i % W;
      const y = (i - x) / W;
      const d = Math.abs(x - lx) + Math.abs(y - ly);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0) break;
    let x = lx;
    let y = ly;
    const bx = best % W;
    const by = (best - bx) / W;
    // On perce jusqu'a la zone atteignable, sans jamais creuser dans l'eau.
    while (x !== bx) {
      x += Math.sign(bx - x);
      if (cells[idx(x, y)] !== ILE_EAU) cells[idx(x, y)] = ILE_LIBRE;
    }
    while (y !== by) {
      y += Math.sign(by - y);
      if (cells[idx(x, y)] !== ILE_EAU) cells[idx(x, y)] = ILE_LIBRE;
    }
  }

  // --- Listes pour le rendu et le jeu ---
  const walls: [number, number][] = [];
  const structures: [number, number][] = [];
  const crates: [number, number][] = [];
  const trees: [number, number][] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = cells[idx(x, y)];
      if (c === ILE_LIBRE) continue;
      walls.push([x, y]);
      if (c === ILE_MUR) structures.push([x, y]);
      else if (c === ILE_CAISSE) crates.push([x, y]);
      else if (c === ILE_ARBRE) trees.push([x, y]);
    }
  }

  // Butin encore sur une case libre (un couloir perce a pu en deplacer), plus
  // quelques armes perdues en pleine nature.
  const finalLoot = loot.filter(([x, y]) => cells[idx(x, y)] === ILE_LIBRE);
  const nearestOpen = (x: number, y: number): [number, number] => {
    for (let r = 0; r < 12; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (inside(nx, ny) && cells[idx(nx, ny)] === ILE_LIBRE) return [nx, ny];
        }
      }
    }
    return [Math.floor(cx), Math.floor(cy)];
  };
  for (let k = 0; k < 8; k++) {
    const a = rng() * Math.PI * 2;
    const d = 8 + rng() * 20;
    finalLoot.push(nearestOpen(Math.floor(cx + Math.cos(a) * d), Math.floor(cy + Math.sin(a) * d)));
  }

  const spawns: [number, number][] = pois.map((p) => nearestOpen(p.x, p.y));
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    spawns.push(nearestOpen(Math.floor(cx + Math.cos(a) * 25), Math.floor(cy + Math.sin(a) * 25)));
  }

  return {
    width: W,
    height: H,
    cells,
    ground,
    walls,
    structures,
    crates,
    trees,
    loot: finalLoot,
    spawns,
    pois,
    radius,
  };
}

/** La case libre la plus proche d'un point (pour poser un joueur apres un saut). */
export function nearestOpenCell(map: IslandMap, x: number, y: number): [number, number] {
  const W = map.width;
  for (let r = 0; r < 20; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = Math.floor(x) + dx;
        const ny = Math.floor(y) + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= map.height) continue;
        if (map.cells[ny * W + nx] === ILE_LIBRE) return [nx, ny];
      }
    }
  }
  return [Math.floor(W / 2), Math.floor(map.height / 2)];
}
