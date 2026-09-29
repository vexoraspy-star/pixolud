import * as THREE from "three";
import { DUEL_LIGHTING, type DuelMap } from "./duel";
import {
  makeAcUnitTexture,
  makeAwningTexture,
  makeDoorTexture,
  makeGrassTuftTexture,
  makeMeterBoxTexture,
  makePalmFrondTexture,
  makePalmTrunkTexture,
  makePavingTexture,
  makePlasterTexture,
  makePlasterTileTexture,
  makePlinthTexture,
  makeSandDriftTexture,
  makeShutterTexture,
  makeStoneTrimTexture,
  makeWindowTexture,
  makeWoodBeamTexture,
  seeded,
  type DoorStyle,
} from "./duelMapTextures";

/**
 * La ville du desert : l'habillage complet de la carte « Poussiere ».
 *
 * La grille de jeu ne change pas d'une case : collisions, lignes de tir et
 * chemins des bots restent ceux de duel.ts. Tout ce qui est pose ici est du
 * DECOR, et respecte trois regles :
 *
 * - contre un mur, rien ne depasse de plus de quelques centimetres sous
 *   2,6 m (portes, soubassements, encadrements) : un joueur colle au mur ne
 *   doit rien traverser ;
 * - au-dessus des tetes, on peut deborder (auvents, poutres, arches, fils,
 *   balcons) : c'est ce qui fait une rue ;
 * - au-dessus des murs (3,4 m), la ville continue : etages sur les murs
 *   d'enceinte, maisons, coupoles et palmiers derriere, antennes et
 *   citernes sur les toits. Personne ne voit par-dessus un mur (l'oeil
 *   plafonne a 2,3 m au sommet d'un saut), donc rien de tout ca ne change le
 *   jeu.
 *
 * Budget : une vingtaine d'appels de rendu pour toute la ville. Les pieces
 * sans texture propre (pierre, bois, enduit des etages, fer) sont fusionnees
 * en un seul maillage par matiere, avec des UV en metres ; les pieces qui
 * portent une texture entiere (portes, fenetres, volets) sont instanciees.
 *
 * Ombres portees : pas de carte d'ombres en temps reel (trop cher sur une
 * puce integree). Le soleil etant fixe, les ombres des murs sont calculees
 * une fois, peintes dans un calque pose sur le sol, et tracees sur les
 * facades en trapezes : exact pour tout ce qui ne bouge pas.
 */
export interface DesertTown {
  group: THREE.Group;
  dispose(): void;
}

// --- Mesures, en metres ---
const PLINTH_H = 0.55;
const CORNICE_H = 0.22;
const PLASTER_BOTTOM = 0.5;
const STOREY = 2.9;
/** Cases de ville dessinees autour de la carte, derriere le mur d'enceinte. */
const RING = 7;
/**
 * Ombres : elles MULTIPLIENT ce qu'elles recouvrent (le sable a l'ombre reste
 * du sable, plus sombre et bleui par le ciel) au lieu de le voiler de gris.
 * Facteur par canal, en sRGB : le rouge baisse plus que le bleu.
 */
const SHADOW_MUL = 0x96a3c6;
const SHADOW_OPACITY = 1;
/** Resolution du calque d'ombre au sol, en pixels par case. */
const SHADOW_PX = 32;

/** Teintes d'enduit (multiplient une texture creme) : ocre, blanc casse, rose sable, paille, chaux, terre. */
const PLASTER_TINTS = [0xffdcaa, 0xfff3e2, 0xffd6c2, 0xffecb8, 0xffffff, 0xeec39c, 0xf6e0c0];
/** Peintures des volets et des menuiseries. */
const PAINTS = [0x4f86c6, 0x78acd8, 0x4f9a90, 0x6a8a50, 0x86603f, 0xa4543c, 0x3f6ea6];
const WOOD_PAINT = 0x9a7552;

const ONE = new THREE.Vector3(1, 1, 1);

// ---------------------------------------------------------------------------
// Fusion de paves : un seul maillage par matiere
// ---------------------------------------------------------------------------

/**
 * Accumule des paves (et des geometries quelconques) dans un seul tampon.
 * UV en metres, multipliees par (su, sv) : la texture garde la meme echelle
 * sur une corniche de 2 m et sur un appui de 1 m.
 */
class Mesher {
  private readonly pos: number[] = [];
  private readonly nor: number[] = [];
  private readonly uv: number[] = [];
  private readonly col: number[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler(0, 0, 0, "YXZ");
  private readonly v = new THREE.Vector3();
  private readonly n = new THREE.Vector3();
  private readonly nm = new THREE.Matrix3();

  constructor(
    private readonly su: number,
    private readonly sv: number,
  ) {}

  /**
   * Pave centre en (x, y, z), de tailles (sx, sy, sz) : sx le long du mur,
   * sz en profondeur une fois tourne de `yaw`. `tilt` l'incline ensuite
   * autour de son axe x (un auvent qui descend vers la rue).
   */
  box(
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    yaw: number,
    color: THREE.Color,
    tilt = 0,
    bottom = true,
  ): void {
    this.e.set(tilt, yaw, 0);
    this.q.setFromEuler(this.e);
    this.m.compose(this.v.set(x, y, z), this.q, ONE);
    const a = sx / 2;
    const b = sy / 2;
    const c = sz / 2;
    // Chaque pave decale sa texture : deux pierres voisines ne s'alignent pas.
    const off = (((x * 0.731 + z * 0.377 + y * 0.191) % 1) + 1) % 1;
    this.face([a, -b, c, a, -b, -c, a, b, -c, a, b, c], 1, 0, 0, sz, sy, color, off);
    this.face([-a, -b, -c, -a, -b, c, -a, b, c, -a, b, -c], -1, 0, 0, sz, sy, color, off);
    this.face([-a, b, c, a, b, c, a, b, -c, -a, b, -c], 0, 1, 0, sx, sz, color, off);
    if (bottom) this.face([-a, -b, -c, a, -b, -c, a, -b, c, -a, -b, c], 0, -1, 0, sx, sz, color, off);
    this.face([-a, -b, c, a, -b, c, a, b, c, -a, b, c], 0, 0, 1, sx, sy, color, off);
    this.face([a, -b, -c, -a, -b, -c, -a, b, -c, a, b, -c], 0, 0, -1, sx, sy, color, off);
  }

  /** Quatre coins (bas-gauche, bas-droite, haut-droite, haut-gauche vus de dehors), dans le repere du pave. */
  private face(c: number[], nx: number, ny: number, nz: number, w: number, h: number, color: THREE.Color, off: number): void {
    this.n.set(nx, ny, nz).applyQuaternion(this.q);
    const u0 = off;
    const u1 = off + w * this.su;
    const v1 = h * this.sv;
    const uvs = [u0, 0, u1, 0, u1, v1, u0, v1];
    for (const k of [0, 1, 2, 0, 2, 3]) {
      this.v.set(c[k * 3], c[k * 3 + 1], c[k * 3 + 2]).applyMatrix4(this.m);
      this.pos.push(this.v.x, this.v.y, this.v.z);
      this.nor.push(this.n.x, this.n.y, this.n.z);
      this.uv.push(uvs[k * 2], uvs[k * 2 + 1]);
      this.col.push(color.r, color.g, color.b);
    }
  }

  /** Ajoute une geometrie quelconque (arche, coupole, citerne), placee par `matrix`. */
  add(geo: THREE.BufferGeometry, matrix: THREE.Matrix4, color: THREE.Color): void {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.getAttribute("position");
    const n = g.getAttribute("normal");
    const t = g.getAttribute("uv");
    this.nm.getNormalMatrix(matrix);
    for (let i = 0; i < p.count; i++) {
      this.v.fromBufferAttribute(p, i).applyMatrix4(matrix);
      this.pos.push(this.v.x, this.v.y, this.v.z);
      if (n) this.n.fromBufferAttribute(n, i).applyMatrix3(this.nm).normalize();
      else this.n.set(0, 1, 0);
      this.nor.push(this.n.x, this.n.y, this.n.z);
      this.uv.push(t ? t.getX(i) : 0, t ? t.getY(i) : 0);
      this.col.push(color.r, color.g, color.b);
    }
    if (g !== geo) g.dispose();
  }

  build(): THREE.BufferGeometry | null {
    if (this.pos.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    geo.computeBoundingSphere();
    return geo;
  }
}

/** Instances d'une meme piece texturee (porte, fenetre, volet) : matrices et teintes. */
class Instances {
  private readonly mats: THREE.Matrix4[] = [];
  private readonly cols: THREE.Color[] = [];

  add(m: THREE.Matrix4, c?: THREE.Color): void {
    this.mats.push(m.clone());
    if (c) this.cols.push(c.clone());
  }

  get count(): number {
    return this.mats.length;
  }

  mesh(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.InstancedMesh | null {
    if (this.mats.length === 0) return null;
    const mesh = new THREE.InstancedMesh(geo, mat, this.mats.length);
    this.mats.forEach((m, i) => mesh.setMatrixAt(i, m));
    if (this.cols.length === this.mats.length) this.cols.forEach((c, i) => mesh.setColorAt(i, c));
    mesh.computeBoundingSphere();
    return mesh;
  }
}

// ---------------------------------------------------------------------------
// La carte vue comme une ville
// ---------------------------------------------------------------------------

/** Une face de mur donnant sur une case libre (1,9 m de large, 3,4 m de haut). */
interface Face {
  /** Case du mur, case libre devant. */
  wx: number;
  wy: number;
  fx: number;
  fy: number;
  /** Normale (vers la rue) et tangente (vers la droite de qui regarde le mur). */
  nx: number;
  nz: number;
  tx: number;
  tz: number;
  /** Centre de la face, au nu du mur. */
  x: number;
  z: number;
  yaw: number;
  border: boolean;
  /** Joue d'un passage sous arche : ni porte ni fenetre. */
  gate: boolean;
}

/** Une maison : quelques faces voisines d'une meme rue, un meme enduit. */
interface Facade {
  faces: Face[];
  plaster: boolean;
  tint: THREE.Color;
  base: THREE.Color;
  trim: THREE.Color;
  paint: THREE.Color;
  /** Mur d'enceinte : hauteur des etages poses dessus, et profondeur de la maison (cases). */
  upper: number;
  depth: number;
}

/** Passage d'une case (arche) ou de deux ou trois (poutre) dans un alignement de murs. */
interface Gate {
  x: number;
  z: number;
  /** L'arche enjambe l'axe x (passage nord-sud) ou l'axe z. */
  spanX: boolean;
  width: number;
}

/** Piece qui porte ombre sans toucher le sol (arche, poutre, auvent, balcon). */
interface Floating {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  h0: number;
  h1: number;
}

export function buildDesertTown(map: DuelMap, cell: number, wallHeight: number): DesertTown {
  const group = new THREE.Group();
  group.name = "ville-du-desert";
  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => {
    owned.push(x);
    return x;
  };
  const rand = seeded(0x5eed + map.width * 131 + map.height * 7);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
  const color = (hex: number, k = 1) => new THREE.Color(hex).multiplyScalar(k);

  const W = map.width;
  const H = map.height;
  // 0 libre, 1 mur, 2 caisse ; hors carte = mur.
  const kind = new Uint8Array(W * H);
  for (const [x, y] of map.walls) kind[y * W + x] = 1;
  for (const [x, y] of map.crates) kind[y * W + x] = 2;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 1 : kind[y * W + x]);
  const isWall = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && kind[y * W + x] === 1;
  const isFree = (x: number, y: number) => at(x, y) === 0;
  const onBorder = (x: number, y: number) => x === 0 || y === 0 || x === W - 1 || y === H - 1;

  const sun = DUEL_LIGHTING.poussiere.keyDir;
  const sunH = Math.hypot(sun[0], sun[2]);
  const sunX = sun[0] / sunH;
  const sunZ = sun[2] / sunH;
  const tanEl = sun[1] / sunH;

  // --- Matieres fusionnees ---
  const trim = new Mesher(1, 1); // pierre de taille : 1 m par tuile
  const wood = new Mesher(0.5, 2); // poutre : 2 m de fil sur 0,5 m
  const plinth = new Mesher(1 / cell, 1 / PLINTH_H);
  const plasterBld = new Mesher(0.5, 0.5); // enduit des etages : tuile de 2 m
  const metal = new Mesher(1, 1);
  const fabric = new Mesher(0.5, 0.5);

  // --- Pieces instanciees ---
  const plasterPanels = [new Instances(), new Instances()];
  const doors: Record<DoorStyle, Instances> = { bleu: new Instances(), vert: new Instances(), rideau: new Instances() };
  const windows = new Instances();
  const shutters = new Instances();
  const acUnits = new Instances();
  const meters = new Instances();
  const paving = new Instances();
  const drifts = new Instances();
  const tufts = new Instances();
  const trunks = new Instances();
  const fronds = new Instances();
  const wires: number[] = [];
  const floating: Floating[] = [];

  const mat4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const eul = new THREE.Euler(0, 0, 0, "YXZ");
  const vec = new THREE.Vector3();
  const scl = new THREE.Vector3();
  /** Matrice d'une piece plaquee sur une face : `along` vers la droite, `out` vers la rue. */
  const onFace = (f: Face, along: number, y: number, out: number, sx = 1, sy = 1, sz = 1, tilt = 0) => {
    eul.set(tilt, f.yaw, 0);
    quat.setFromEuler(eul);
    return mat4.compose(
      vec.set(f.x + f.tx * along + f.nx * out, y, f.z + f.tz * along + f.nz * out),
      quat,
      scl.set(sx, sy, sz),
    );
  };
  /** Pave pose sur une face (sx le long du mur, sz en saillie). */
  const boxOn = (m: Mesher, f: Face, along: number, y: number, out: number, sx: number, sy: number, sz: number, c: THREE.Color, tilt = 0) =>
    m.box(f.x + f.tx * along + f.nx * out, y, f.z + f.tz * along + f.nz * out, sx, sy, sz, f.yaw, c, tilt);
  /** Fil pendant entre deux points (chainette approchee par une parabole). */
  const wire = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, sag: number) => {
    const steps = 12;
    let px = ax;
    let py = ay;
    let pz = az;
    for (let i = 1; i <= steps; i++) {
      const s = i / steps;
      const x = ax + (bx - ax) * s;
      const y = ay + (by - ay) * s - 4 * sag * s * (1 - s);
      const z = az + (bz - az) * s;
      wires.push(px, py, pz, x, y, z);
      px = x;
      py = y;
      pz = z;
    }
  };

  // -------------------------------------------------------------- passages
  const gates: Gate[] = [];
  const gateCells = new Set<number>();
  // Alignements de murs perces d'une a trois cases, libres de part et d'autre.
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (!isFree(x, y)) continue;
      if (isWall(x - 1, y)) {
        let b = x;
        while (b - x < 3 && isFree(b, y) && isFree(b, y - 1) && isFree(b, y + 1)) b++;
        if (b > x && isWall(b, y) && b - x <= 3 && isFree(x, y - 1)) {
          gates.push({ x: ((x + b) / 2) * cell, z: (y + 0.5) * cell, spanX: true, width: (b - x) * cell });
          for (let k = x; k < b; k++) gateCells.add(y * W + k);
        }
      }
      if (isWall(x, y - 1)) {
        let b = y;
        while (b - y < 3 && isFree(x, b) && isFree(x - 1, b) && isFree(x + 1, b)) b++;
        if (b > y && isWall(x, b) && b - y <= 3) {
          gates.push({ x: (x + 0.5) * cell, z: ((y + b) / 2) * cell, spanX: false, width: (b - y) * cell });
          for (let k = y; k < b; k++) gateCells.add(k * W + x);
        }
      }
    }
  }

  // ----------------------------------------------------------------- faces
  const faces: Face[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!isFree(x, y)) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const wx = x + dx;
        const wy = y + dy;
        if (!isWall(wx, wy)) continue;
        const nx = -dx;
        const nz = -dy;
        faces.push({
          wx,
          wy,
          fx: x,
          fy: y,
          nx,
          nz,
          tx: nz,
          tz: -nx,
          x: (x + 0.5 + dx * 0.5) * cell,
          z: (y + 0.5 + dy * 0.5) * cell,
          yaw: Math.atan2(nx, nz),
          border: onBorder(wx, wy),
          gate: gateCells.has(y * W + x),
        });
      }
    }
  }

  // Facades : les faces alignees se suivent ; on les coupe en maisons de 1 a 4 faces.
  const lines = new Map<string, Face[]>();
  for (const f of faces) {
    const key = `${f.nx},${f.nz},${f.nz !== 0 ? f.wy : f.wx}`;
    const list = lines.get(key);
    if (list) list.push(f);
    else lines.set(key, [f]);
  }
  const facades: Facade[] = [];
  const facadeOf = new Map<Face, Facade>();
  for (const list of lines.values()) {
    list.sort((a, b) => (a.nz !== 0 ? a.wx - b.wx : a.wy - b.wy));
    let run: Face[] = [];
    const flush = () => {
      let i = 0;
      while (i < run.length) {
        let len = Math.min(run.length - i, 1 + Math.floor(rand() * 4));
        if (run.length - i - len === 1) len++;
        const part = run.slice(i, i + len);
        i += len;
        const border = part[0].border;
        const plastered = rand() < (border ? 0.85 : 0.7);
        const tint = color(pick(PLASTER_TINTS), 0.94 + rand() * 0.08);
        const r = rand();
        const fa: Facade = {
          faces: part,
          plaster: plastered,
          tint,
          base: plastered ? tint.clone().multiplyScalar(0.72) : color(0xb5a38a),
          trim: color(0xfff4e4, 0.9 + rand() * 0.12),
          paint: color(plastered ? pick(PAINTS) : WOOD_PAINT),
          upper: border ? (r < 0.25 ? 0 : r < 0.78 ? STOREY : STOREY * 2) : 0,
          depth: 2 + Math.floor(rand() * 3),
        };
        facades.push(fa);
        for (const f of part) facadeOf.set(f, fa);
      }
      run = [];
    };
    for (const f of list) {
      const prev = run[run.length - 1];
      const along = (g: Face) => (g.nz !== 0 ? g.wx : g.wy);
      if (prev && along(f) !== along(prev) + 1) flush();
      run.push(f);
    }
    flush();
  }

  // -------------------------------------------------- hauteurs (pour les ombres)
  const EW = W + RING * 2;
  const EH = H + RING * 2;
  const heights = new Float32Array(EW * EH);
  /** 0 libre, 1 carte, 2 maison d'enceinte, 3 maison du fond, 4 jardin (palmier). */
  const occ = new Uint8Array(EW * EH);
  const ext = (x: number, y: number) => (y + RING) * EW + (x + RING);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      occ[ext(x, y)] = 1;
      if (at(x, y) !== 0) heights[ext(x, y)] = wallHeight;
    }
  }
  const heightAt = (wx: number, wz: number) => {
    const x = Math.floor(wx / cell) + RING;
    const y = Math.floor(wz / cell) + RING;
    if (x < 0 || y < 0 || x >= EW || y >= EH) return 0;
    return heights[y * EW + x];
  };

  // ---------------------------------------------------- habillage des faces
  const plasterH = wallHeight - CORNICE_H - PLASTER_BOTTOM;
  const woodTone = color(0xffffff);
  const ironTone = color(0x2c2a27);
  const greyMetal = color(0x7d8387);

  /** Fenetre a volets (rez-de-chaussee ou etage), centree a la hauteur `cy`. */
  const addWindow = (f: Face, fa: Facade, along: number, cy: number, stoneLintel: boolean) => {
    const closed = rand() < 0.28;
    const paint = fa.paint.clone().multiplyScalar(0.9 + rand() * 0.15);
    if (closed) {
      for (const s of [-1, 1]) shutters.add(onFace(f, along + s * 0.21, cy, 0.045, 0.42, 1.05, 1), paint);
    } else {
      windows.add(onFace(f, along, cy, 0.03, 0.8, 1.0, 1));
      for (const s of [-1, 1]) shutters.add(onFace(f, along + s * 0.635, cy, 0.036, 0.42, 1.05, 1), paint);
    }
    boxOn(trim, f, along, cy - 0.535, 0.07, 1.0, 0.07, 0.14, fa.trim);
    if (stoneLintel) boxOn(trim, f, along, cy + 0.575, 0.05, 1.0, 0.13, 0.1, fa.trim);
    else boxOn(wood, f, along, cy + 0.575, 0.06, 1.1, 0.14, 0.12, woodTone);
  };

  const acGeo = keep(boxWithFront(0.78, 0.52, 0.32, 0.04, 0.95));
  const meterGeo = keep(boxWithFront(0.34, 0.5, 0.12, 0.03, 0.97));

  for (const fa of facades) {
    const n = fa.faces.length;
    // Une porte par maison, jamais sur la joue d'un passage.
    const doorable = fa.faces.filter((f) => !f.gate);
    const doorFace = doorable.length > 0 && rand() < (n >= 2 ? 0.6 : 0.3) ? pick(doorable) : null;
    const shop = doorFace !== null && rand() < 0.3;
    const doorStyle: DoorStyle = rand() < 0.6 ? "bleu" : "vert";
    const runLong = n >= 3 && rand() < 0.45;

    for (const f of fa.faces) {
      const gaps: [number, number][] = [];
      if (fa.plaster) plasterPanels[rand() < 0.5 ? 0 : 1].add(onFace(f, 0, PLASTER_BOTTOM + plasterH / 2, 0.02), fa.tint);

      if (f === doorFace) {
        const a = (rand() - 0.5) * 0.3;
        if (shop) {
          doors.rideau.add(onFace(f, a, 1.18, 0.03, 1.55, 2.36, 1), color(0xffffff, 0.9 + rand() * 0.15));
          for (const s of [-1, 1]) boxOn(metal, f, a + s * 0.815, 1.2, 0.04, 0.07, 2.4, 0.08, greyMetal);
          boxOn(metal, f, a, 2.52, 0.13, 1.75, 0.3, 0.26, greyMetal);
          // Auvent de toile, assez haut pour ne jamais frotter une tete.
          const tilt = 0.26;
          const depth = 1.15;
          const top = 3.12;
          boxOn(fabric, f, a, top - (depth / 2) * Math.sin(tilt), 0.03 + (depth / 2) * Math.cos(tilt), 2.1, 0.03, depth, fa.paint.clone().lerp(color(0xffffff), 0.35), tilt);
          const fx = 0.03 + depth * Math.cos(tilt);
          const fy = top - depth * Math.sin(tilt);
          boxOn(fabric, f, a, fy - 0.1, fx, 2.1, 0.2, 0.02, fa.paint.clone().lerp(color(0xffffff), 0.35));
          for (const s of [-1, 1]) boxOn(metal, f, a + s * 1.02, top - (depth / 2) * Math.sin(tilt) - 0.03, 0.03 + (depth / 2) * Math.cos(tilt), 0.03, 0.03, depth, ironTone, tilt);
          const px = f.x + f.tx * a;
          const pz = f.z + f.tz * a;
          floating.push(rectAround(px + f.nx * 0.6, pz + f.nz * 0.6, f.tx, f.tz, 1.05, 0.6, fy, top));
          gaps.push([a - 0.87, a + 0.87]);
        } else {
          doors[doorStyle].add(onFace(f, a, 1.085, 0.028, 1.05, 2.15, 1), color(0xffffff, 0.92 + rand() * 0.12));
          for (const s of [-1, 1]) boxOn(trim, f, a + s * 0.615, 1.17, 0.06, 0.18, 2.34, 0.12, fa.trim);
          boxOn(wood, f, a, 2.45, 0.075, 1.6, 0.22, 0.15, woodTone);
          boxOn(trim, f, a, 0.03, 0.14, 1.3, 0.06, 0.28, fa.trim);
          gaps.push([a - 0.72, a + 0.72]);
        }
      } else if (!f.gate) {
        const r = rand();
        if (r < 0.5) {
          addWindow(f, fa, (rand() - 0.5) * 0.2, 2.3, fa.plaster);
        } else if (r < 0.62) {
          const a = (rand() - 0.5) * 0.6;
          acUnits.add(onFace(f, a, 2.45, 0.17));
          boxOn(metal, f, a + 0.3, 1.3, 0.03, 0.025, 2.0, 0.025, greyMetal);
        } else if (r < 0.7) {
          const a = (rand() - 0.5) * 0.8;
          meters.add(onFace(f, a, 1.45, 0.065));
          boxOn(metal, f, a + 0.08, 2.45, 0.03, 0.025, 1.45, 0.025, ironTone);
        }
        // Bouts de poutres du plafond, qui sortent sous la corniche.
        if (rand() < 0.3) for (const s of [-1, 1]) boxOn(wood, f, s * 0.6, wallHeight - 0.45, 0.25, 0.15, 0.15, 0.5, woodTone);
      }

      // Soubassement, interrompu par les portes.
      let from = -cell / 2 - 0.06;
      for (const [g0, g1] of gaps.sort((p, q) => p[0] - q[0])) {
        if (g0 > from) boxOn(plinth, f, (from + g0) / 2, PLINTH_H / 2, 0.035, g0 - from, PLINTH_H, 0.07, fa.base);
        from = Math.max(from, g1);
      }
      const to = cell / 2 + 0.06;
      if (to > from) boxOn(plinth, f, (from + to) / 2, PLINTH_H / 2, 0.035, to - from, PLINTH_H, 0.07, fa.base);

      // Corniche moulée en deux ressauts.
      boxOn(trim, f, 0, wallHeight - CORNICE_H / 2, 0.07, cell + 0.28, CORNICE_H, 0.14, fa.trim);
      boxOn(trim, f, 0, wallHeight - CORNICE_H - 0.04, 0.035, cell + 0.14, 0.08, 0.07, fa.trim);

      // Acrotere (petit muret du toit) sur les murs sans etage.
      if (fa.upper === 0) {
        if (fa.plaster) boxOn(plasterBld, f, 0, wallHeight + 0.2, -0.1, cell, 0.4, 0.2, fa.tint);
        else boxOn(trim, f, 0, wallHeight + 0.2, -0.1, cell, 0.4, 0.2, fa.trim);
      }
    }

    // Fil electrique le long d'une longue facade, accroche sous la corniche.
    if (runLong) {
      const first = fa.faces[0];
      for (let i = 0; i < n; i++) {
        const f = fa.faces[i];
        const y = wallHeight - 0.5;
        const ax = f.x - f.tx * cell * 0.5 + f.nx * 0.07;
        const az = f.z - f.tz * cell * 0.5 + f.nz * 0.07;
        wire(ax, y, az, ax + f.tx * cell, y, az + f.tz * cell, 0.08 + rand() * 0.06);
      }
      boxOn(metal, first, -cell * 0.5, wallHeight - 0.5, 0.05, 0.05, 0.08, 0.08, ironTone);
    }

    // --- Etages sur le mur d'enceinte ---
    if (fa.upper > 0) {
      const f0 = fa.faces[0];
      const f1 = fa.faces[n - 1];
      const mx = (f0.x + f1.x) / 2;
      const mz = (f0.z + f1.z) / 2;
      const len = n * cell;
      const deep = (1 + fa.depth) * cell;
      const top = wallHeight + fa.upper;
      const body = fa.plaster ? fa.tint : color(0xf0dcb8);
      plasterBld.box(mx - f0.nx * deep / 2, wallHeight + fa.upper / 2, mz - f0.nz * deep / 2, len, fa.upper, deep, f0.yaw, body, 0, false);
      // Acrotere et corniche du toit, bandeau entre les etages.
      plasterBld.box(mx - f0.nx * 0.1, top + 0.25, mz - f0.nz * 0.1, len, 0.5, 0.2, f0.yaw, body);
      trim.box(mx + f0.nx * 0.05, top - 0.1, mz + f0.nz * 0.05, len + 0.1, 0.2, 0.12, f0.yaw, fa.trim);
      if (fa.upper > STOREY) trim.box(mx + f0.nx * 0.04, wallHeight + STOREY, mz + f0.nz * 0.04, len, 0.16, 0.1, f0.yaw, fa.trim);
      const storeys = Math.round(fa.upper / STOREY);
      for (const f of fa.faces) {
        for (let s = 0; s < storeys; s++) {
          const base = wallHeight + s * STOREY;
          if (rand() < (s === 0 ? 0.22 : 0.12)) {
            // Balcon : dalle sur corbeaux, garde-corps en fer, porte-fenetre.
            boxOn(trim, f, 0, base + 0.06, 0.45, 1.7, 0.12, 0.9, fa.trim);
            for (const k of [-1, 1]) boxOn(wood, f, k * 0.6, base - 0.12, 0.4, 0.14, 0.22, 0.8, woodTone);
            boxOn(metal, f, 0, base + 1.02, 0.86, 1.7, 0.05, 0.05, ironTone);
            for (const k of [-1, 1]) boxOn(metal, f, k * 0.83, base + 1.02, 0.45, 0.05, 0.05, 0.85, ironTone);
            for (let b = -0.78; b <= 0.79; b += 0.13) boxOn(metal, f, b, base + 0.57, 0.86, 0.022, 0.9, 0.022, ironTone);
            for (const k of [-1, 1]) for (let d = 0.12; d < 0.85; d += 0.15) boxOn(metal, f, k * 0.83, base + 0.57, d, 0.022, 0.9, 0.022, ironTone);
            doors[rand() < 0.5 ? "bleu" : "vert"].add(onFace(f, 0, base + 0.12 + 1.05, 0.028, 0.95, 2.1, 1), color(0xffffff));
            floating.push(rectAround(f.x + f.nx * 0.45, f.z + f.nz * 0.45, f.tx, f.tz, 0.85, 0.45, base, base + 1.05));
          } else {
            addWindow(f, fa, (rand() - 0.5) * 0.2, base + 1.45, true);
            if (rand() < 0.14) {
              acUnits.add(onFace(f, (rand() - 0.5) * 0.3, base + 0.42, 0.17));
            } else if (rand() < 0.1) {
              addDish(metal, f.x + f.tx * 0.75 + f.nx * 0.3, base + 2.35, f.z + f.tz * 0.75 + f.nz * 0.3, f.yaw);
            }
          }
        }
      }
      // Sur le toit : citerne, antenne, parabole.
      const back = 1.2 + rand() * Math.max(0.2, deep - 2.6);
      const along = (rand() - 0.5) * Math.max(0, len - 1.6);
      const rx = mx - f0.nx * back + f0.tx * along;
      const rz = mz - f0.nz * back + f0.tz * along;
      if (rand() < 0.5) addTank(metal, rx, top, rz, rand() < 0.6);
      if (rand() < 0.55) addAntenna(metal, rx + f0.tx * 1.1, top, rz + f0.tz * 1.1, rand() * Math.PI);
      else if (rand() < 0.35) addDish(metal, rx - f0.tx * 0.9, top + 0.5, rz - f0.tz * 0.9, f0.yaw + Math.PI * 0.8);
      // Hauteurs : la maison occupe le mur et les cases hors carte derriere.
      for (const f of fa.faces) {
        for (let k = 0; k <= fa.depth; k++) {
          const cx = f.wx - f.nx * k;
          const cy = f.wy - f.nz * k;
          const i = ext(cx, cy);
          if (cx < -RING || cy < -RING || cx >= W + RING || cy >= H + RING) continue;
          heights[i] = Math.max(heights[i], top);
          if (k > 0) occ[i] = 2;
        }
      }
    }
  }

  // -------------------------------------------------------- arches et poutres
  const archDepth = 0.55;
  const spring = 2.5;
  for (const g of gates) {
    const yaw = g.spanX ? 0 : Math.PI / 2;
    const hw = g.width / 2;
    if (g.width <= cell + 0.01) {
      const rise = 0.45;
      const topY = wallHeight + 0.35;
      const radius = (hw * hw + rise * rise) / (2 * rise);
      const cy = spring + rise - radius;
      const a0 = Math.atan2(spring - cy, hw);
      const shape = new THREE.Shape();
      shape.moveTo(-hw, spring);
      shape.lineTo(-hw, topY);
      shape.lineTo(hw, topY);
      shape.lineTo(hw, spring);
      shape.absarc(0, cy, radius, a0, Math.PI - a0, false);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: archDepth,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.03,
        bevelSegments: 1,
        curveSegments: 12,
      });
      geo.translate(0, 0, -archDepth / 2);
      mat4.makeRotationY(yaw).setPosition(g.x, 0, g.z);
      trim.add(geo, mat4, color(0xfff1dc));
      geo.dispose();
      // Clef de voute, impostes et chaperon.
      const ax = Math.cos(yaw);
      const az = -Math.sin(yaw);
      trim.box(g.x, spring + rise + 0.14, g.z, 0.3, 0.42, archDepth + 0.12, yaw, color(0xfff6e8));
      for (const s of [-1, 1]) trim.box(g.x + ax * s * (hw - 0.08), spring - 0.06, g.z + az * s * (hw - 0.08), 0.2, 0.12, archDepth + 0.1, yaw, color(0xf2e2c8));
      trim.box(g.x, topY + 0.06, g.z, g.width + 0.3, 0.12, archDepth + 0.2, yaw, color(0xf6e8d0));
      floating.push(boxShadow(g.x, g.z, ax, az, hw, archDepth / 2, spring, topY));
    } else {
      // Passage large : une grosse poutre de bois d'un mur a l'autre.
      wood.box(g.x, wallHeight - 0.35, g.z, g.width + 0.5, 0.28, 0.28, yaw, woodTone);
      const ax = Math.cos(yaw);
      const az = -Math.sin(yaw);
      floating.push(boxShadow(g.x, g.z, ax, az, hw, 0.14, wallHeight - 0.49, wallHeight - 0.21));
      wire(g.x - ax * hw, wallHeight - 0.45, g.z - az * hw, g.x + ax * hw, wallHeight - 0.45, g.z + az * hw, 0.3);
    }
  }

  // ------------------------------------------------------------- sol : dalles
  const paved = new Uint8Array(W * H);
  {
    // Bruit de valeur a grosses mailles : des places dallees, des rues de sable.
    const S = 5;
    const gw = Math.ceil(W / S) + 2;
    const gh = Math.ceil(H / S) + 2;
    const lat = new Float32Array(gw * gh).map(() => rand());
    const noise = (x: number, y: number) => {
      const fx = x / S;
      const fy = y / S;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const sx = fx - x0;
      const sy = fy - y0;
      const a = lat[y0 * gw + x0] + (lat[y0 * gw + x0 + 1] - lat[y0 * gw + x0]) * sx;
      const b = lat[(y0 + 1) * gw + x0] + (lat[(y0 + 1) * gw + x0 + 1] - lat[(y0 + 1) * gw + x0]) * sx;
      return a + (b - a) * sy;
    };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!isFree(x, y)) continue;
        const corridor = (!isFree(x - 1, y) && !isFree(x + 1, y)) || (!isFree(x, y - 1) && !isFree(x, y + 1));
        const v = noise(x + 0.5, y + 0.5) + (corridor ? 0.18 : 0) + (gateCells.has(y * W + x) ? 1 : 0);
        if (v > 0.56) paved[y * W + x] = 1;
      }
    }
  }
  const curbTone = color(0xe8dccb);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!paved[y * W + x]) continue;
      eul.set(0, (Math.floor(rand() * 4) * Math.PI) / 2, 0);
      quat.setFromEuler(eul);
      paving.add(mat4.compose(vec.set((x + 0.5) * cell, 0.004, (y + 0.5) * cell), quat, ONE));
      // Bordure de pierre la ou la dalle rencontre le sable.
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (!isFree(x + dx, y + dy) || paved[(y + dy) * W + x + dx]) continue;
        const cx = (x + 0.5 + dx * 0.46) * cell;
        const cz = (y + 0.5 + dy * 0.46) * cell;
        if (dx !== 0) trim.box(cx, 0.025, cz, 0.15, 0.05, cell, 0, curbTone);
        else trim.box(cx, 0.025, cz, cell, 0.05, 0.15, 0, curbTone);
      }
    }
  }

  // ----------------------------------------------- sable au pied des murs, herbes
  for (const f of faces) {
    const onPave = paved[f.fy * W + f.fx] === 1;
    if (!f.gate && rand() < (onPave ? 0.3 : 0.7)) {
      drifts.add(onFace(f, (rand() - 0.5) * 0.5, 0, 0.45, 0.85 + rand() * 0.35, 1, 0.7 + rand() * 0.5));
    }
    if (!onPave && rand() < 0.2) {
      for (let k = 0; k < 1 + Math.floor(rand() * 2); k++) {
        eul.set(0, rand() * Math.PI, 0);
        quat.setFromEuler(eul);
        const a = (rand() - 0.5) * cell * 0.8;
        const s = 0.6 + rand() * 0.6;
        tufts.add(mat4.compose(vec.set(f.x + f.tx * a + f.nx * 0.22, 0, f.z + f.tz * a + f.nz * 0.22), quat, scl.set(s, s, s)));
      }
    }
  }

  // ------------------------------------------- mats, fils et antennes des toits
  {
    // Des cases de mur interieures, bien reparties (echantillonnage du plus loin).
    const roofs: [number, number][] = [];
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++)
        if (isWall(x, y) && (isFree(x + 1, y) || isFree(x - 1, y) || isFree(x, y + 1) || isFree(x, y - 1))) roofs.push([x, y]);
    const spread = (count: number, taken: [number, number][]) => {
      const chosen: [number, number][] = [];
      if (roofs.length === 0) return chosen;
      chosen.push(roofs[Math.floor(rand() * roofs.length)]);
      while (chosen.length < count) {
        let best: [number, number] | null = null;
        let bestD = -1;
        for (const r of roofs) {
          let d = Infinity;
          for (const c of [...chosen, ...taken]) d = Math.min(d, Math.hypot(r[0] - c[0], r[1] - c[1]));
          d += rand() * 1.5;
          if (d > bestD) {
            bestD = d;
            best = r;
          }
        }
        if (!best) break;
        chosen.push(best);
      }
      return chosen;
    };
    const masts = spread(7, []);
    // Ordre de la ligne : du plus proche en plus proche.
    const chain: [number, number][] = [];
    const left = [...masts];
    let cur = left.shift();
    while (cur) {
      chain.push(cur);
      let bi = -1;
      let bd = Infinity;
      left.forEach((m, i) => {
        const d = Math.hypot(m[0] - cur![0], m[1] - cur![1]);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      });
      cur = bi >= 0 ? left.splice(bi, 1)[0] : undefined;
    }
    const poleTop = wallHeight + 2.7;
    const poleTone = color(0xb0a090);
    const arms: [number, number, number, number][] = [];
    chain.forEach(([x, y], i) => {
      const px = (x + 0.5) * cell;
      const pz = (y + 0.5) * cell;
      const next = chain[Math.min(chain.length - 1, i + 1)];
      const prev = chain[Math.max(0, i - 1)];
      // Traverse perpendiculaire a la ligne : son axe x est la normale de la ligne.
      const yaw = Math.atan2(next[0] - prev[0], next[1] - prev[1]);
      // Poteau (bois, fil vertical) et traverse.
      wood.box(px, wallHeight + 1.35, pz, 0.14, 0.14, 2.7, 0, poleTone, Math.PI / 2);
      wood.box(px, poleTop - 0.2, pz, 1.3, 0.1, 0.1, yaw, poleTone);
      arms.push([px, pz, Math.cos(yaw), -Math.sin(yaw)]);
    });
    for (let i = 0; i + 1 < arms.length; i++) {
      const [ax, az, adx, adz] = arms[i];
      const [bx, bz, bdx, bdz] = arms[i + 1];
      const flip = adx * bdx + adz * bdz < 0 ? -1 : 1;
      const dist = Math.hypot(bx - ax, bz - az);
      for (const s of [-0.55, 0.55]) {
        wire(ax + adx * s, poleTop - 0.17, az + adz * s, bx + bdx * s * flip, poleTop - 0.17, bz + bdz * s * flip, 0.35 + dist * 0.025);
      }
    }
    for (const [x, y] of spread(5, masts)) addAntenna(metal, (x + 0.5) * cell, wallHeight, (y + 0.5) * cell, rand() * Math.PI);
    for (const [x, y] of spread(4, masts)) addTank(metal, (x + 0.3 + rand() * 0.4) * cell, wallHeight, (y + 0.3 + rand() * 0.4) * cell, rand() < 0.5);
  }

  // Fils tendus en travers des rues, d'une facade a celle d'en face.
  for (const f of faces) {
    if (f.nx < 0 || f.nz < 0 || f.gate || rand() > 0.3) continue;
    let j = 0;
    while (j < 5 && isFree(f.fx + f.nx * j, f.fy + f.nz * j)) j++;
    if (j === 0 || j > 4 || !isWall(f.fx + f.nx * j, f.fy + f.nz * j)) continue;
    const a = (rand() - 0.5) * 1.2;
    const d = j * cell;
    const ya = wallHeight - 0.35 - rand() * 0.2;
    const yb = wallHeight - 0.35 - rand() * 0.2;
    const x0 = f.x + f.tx * a;
    const z0 = f.z + f.tz * a;
    const b = a + (rand() - 0.5) * 0.8;
    wire(x0, ya, z0, f.x + f.tx * b + f.nx * d, yb, f.z + f.tz * b + f.nz * d, 0.15 + d * 0.06);
    if (rand() < 0.4) wire(x0 + f.tx * 0.12, ya + 0.08, z0 + f.tz * 0.12, f.x + f.tx * (b + 0.12) + f.nx * d, yb + 0.08, f.z + f.tz * (b + 0.12) + f.nz * d, 0.18 + d * 0.07);
  }

  // ------------------------------------------------ la ville derriere l'enceinte
  const mapCx = W / 2;
  const mapCy = H / 2;
  const houses: { x0: number; y0: number; x1: number; y1: number; h: number }[] = [];
  const palms: [number, number][] = [];
  for (let ey = 0; ey < EH; ey++) {
    for (let ex = 0; ex < EW; ex++) {
      if (occ[ey * EW + ex] !== 0) continue;
      if (rand() < 0.1) {
        occ[ey * EW + ex] = 4;
        palms.push([ex - RING, ey - RING]);
        continue;
      }
      let bw = 2 + Math.floor(rand() * 3);
      let bh = 2 + Math.floor(rand() * 3);
      const free = (w: number, h: number) => {
        for (let y = ey; y < ey + h; y++)
          for (let x = ex; x < ex + w; x++) if (x >= EW || y >= EH || occ[y * EW + x] !== 0) return false;
        return true;
      };
      while (bw > 1 && !free(bw, 1)) bw--;
      while (bh > 1 && !free(bw, bh)) bh--;
      const r = rand();
      const h = wallHeight + STOREY * (r < 0.35 ? 1 : r < 0.82 ? 2 : 3) - 0.5 + rand() * 0.8;
      for (let y = ey; y < ey + bh; y++)
        for (let x = ex; x < ex + bw; x++) {
          occ[y * EW + x] = 3;
          heights[y * EW + x] = h;
        }
      houses.push({ x0: ex - RING, y0: ey - RING, x1: ex - RING + bw, y1: ey - RING + bh, h });
    }
  }
  for (const b of houses) {
    const cx = ((b.x0 + b.x1) / 2) * cell;
    const cz = ((b.y0 + b.y1) / 2) * cell;
    const sx = (b.x1 - b.x0) * cell - 0.12;
    const sz = (b.y1 - b.y0) * cell - 0.12;
    const tint = color(pick(PLASTER_TINTS), 0.86 + rand() * 0.16);
    plasterBld.box(cx, b.h / 2, cz, sx, b.h, sz, 0, tint, 0, false);
    // Acrotere sur les quatre bords du toit.
    plasterBld.box(cx, b.h + 0.22, cz - sz / 2 + 0.09, sx, 0.44, 0.18, 0, tint);
    plasterBld.box(cx, b.h + 0.22, cz + sz / 2 - 0.09, sx, 0.44, 0.18, 0, tint);
    plasterBld.box(cx - sx / 2 + 0.09, b.h + 0.22, cz, 0.18, 0.44, sz - 0.36, 0, tint);
    plasterBld.box(cx + sx / 2 - 0.09, b.h + 0.22, cz, 0.18, 0.44, sz - 0.36, 0, tint);
    // Fenetres sur les cotes tournes vers la carte, au-dessus des murs.
    const dx = mapCx - (b.x0 + b.x1) / 2;
    const dy = mapCy - (b.y0 + b.y1) / 2;
    const dl = Math.hypot(dx, dy) || 1;
    const paint = color(pick(PAINTS));
    const sides: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [nx, nz] of sides) {
      if ((nx * dx + nz * dy) / dl < 0.3) continue;
      const count = nx !== 0 ? b.y1 - b.y0 : b.x1 - b.x0;
      const f: Face = {
        wx: 0,
        wy: 0,
        fx: 0,
        fy: 0,
        nx,
        nz,
        tx: nz,
        tz: -nx,
        x: cx + (nx * sx) / 2,
        z: cz + (nz * sz) / 2,
        yaw: Math.atan2(nx, nz),
        border: false,
        gate: false,
      };
      const fa: Facade = { faces: [f], plaster: true, tint, base: tint, trim: color(0xfff0dc), paint, upper: 0, depth: 0 };
      trim.box(f.x + nx * 0.05, b.h - 0.1, f.z + nz * 0.05, nx !== 0 ? sz : sx, 0.2, 0.12, f.yaw, fa.trim);
      for (let s = 1; (s + 1) * STOREY <= b.h + 0.4; s++) {
        for (let k = 0; k < count; k++) {
          if (rand() < 0.2) continue;
          const along = (k + 0.5 - count / 2) * cell;
          addWindow(f, fa, along, s * STOREY + 1.35, true);
        }
      }
    }
    const roofX = cx + (rand() - 0.5) * (sx - 1.6);
    const roofZ = cz + (rand() - 0.5) * (sz - 1.6);
    if (b.h < wallHeight + STOREY * 2.2 && rand() < 0.12) {
      // Coupole blanche sur un tambour.
      const radius = Math.min(sx, sz) * 0.3;
      const drum = new THREE.CylinderGeometry(radius, radius, 0.5, 16, 1, true);
      mat4.makeTranslation(cx, b.h + 0.25, cz);
      plasterBld.add(drum, mat4, color(0xf4ecdc));
      drum.dispose();
      const dome = new THREE.SphereGeometry(radius, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      mat4.makeTranslation(cx, b.h + 0.5, cz);
      plasterBld.add(dome, mat4, color(0xf8f2e6));
      dome.dispose();
    } else if (rand() < 0.4) addTank(metal, roofX, b.h, roofZ, rand() < 0.5);
    if (rand() < 0.35) addAntenna(metal, cx + (rand() - 0.5) * sx * 0.6, b.h, cz + (rand() - 0.5) * sz * 0.6, rand() * Math.PI);
  }

  // Palmiers dans les jardins, entre les maisons du fond.
  for (const [px, py] of palms) {
    const x = (px + 0.2 + rand() * 0.6) * cell;
    const z = (py + 0.2 + rand() * 0.6) * cell;
    const h = 6.5 + rand() * 3.5;
    const lean = (rand() - 0.5) * 0.18;
    const leanDir = rand() * Math.PI * 2;
    eul.set(lean, leanDir, 0);
    quat.setFromEuler(eul);
    trunks.add(mat4.compose(vec.set(x, 0, z), quat, scl.set(1, h, 1)));
    // Sommet du stipe, penche comme lui.
    const topV = new THREE.Vector3(0, h, 0).applyQuaternion(quat);
    const tx = x + topV.x;
    const tz = z + topV.z;
    const count = 9 + Math.floor(rand() * 4);
    for (let k = 0; k < count; k++) {
      const yaw = (k / count) * Math.PI * 2 + rand() * 0.4;
      const pitch = 0.15 + rand() * 0.5;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), pitch));
      const s = 0.8 + rand() * 0.35;
      fronds.add(mat4.compose(vec.set(tx, topV.y - 0.05, tz), q, scl.set(s, s, s)));
    }
    floating.push({ x0: tx - 1.6, z0: tz - 1.6, x1: tx + 1.6, z1: tz + 1.6, h0: topV.y - 1.2, h1: topV.y });
  }

  // ------------------------------------------------------ materiaux et maillages
  const addMesh = (mesh: THREE.Object3D | null) => {
    if (mesh) group.add(mesh);
  };
  const lambert = (params: THREE.MeshLambertMaterialParameters) => keep(new THREE.MeshLambertMaterial(params));
  const tex = <T extends THREE.Texture>(t: T) => keep(t);

  const merged = (m: Mesher, material: THREE.Material) => {
    const geo = m.build();
    if (!geo) return null;
    keep(geo);
    return new THREE.Mesh(geo, material);
  };
  addMesh(merged(trim, lambert({ map: tex(makeStoneTrimTexture()), vertexColors: true })));
  addMesh(merged(wood, lambert({ map: tex(makeWoodBeamTexture()), vertexColors: true })));
  addMesh(merged(plinth, lambert({ map: tex(makePlinthTexture()), vertexColors: true })));
  addMesh(merged(plasterBld, lambert({ map: tex(makePlasterTileTexture()), vertexColors: true })));
  addMesh(merged(metal, lambert({ vertexColors: true, side: THREE.DoubleSide })));
  addMesh(merged(fabric, lambert({ map: tex(makeAwningTexture()), vertexColors: true, side: THREE.DoubleSide })));

  const unitPlane = keep(new THREE.PlaneGeometry(1, 1));
  const panelGeo = keep(new THREE.PlaneGeometry(cell, plasterH));
  plasterPanels.forEach((list, v) =>
    addMesh(list.mesh(panelGeo, lambert({ map: tex(makePlasterTexture(v)) }))),
  );
  for (const style of ["bleu", "vert", "rideau"] as const) {
    addMesh(doors[style].mesh(unitPlane, lambert({ map: tex(makeDoorTexture(style)) })));
  }
  addMesh(windows.mesh(unitPlane, lambert({ map: tex(makeWindowTexture()) })));
  addMesh(shutters.mesh(unitPlane, lambert({ map: tex(makeShutterTexture()) })));
  addMesh(acUnits.mesh(acGeo, lambert({ map: tex(makeAcUnitTexture()) })));
  addMesh(meters.mesh(meterGeo, lambert({ map: tex(makeMeterBoxTexture()) })));

  const paveGeo = keep(new THREE.PlaneGeometry(cell, cell).rotateX(-Math.PI / 2));
  addMesh(
    paving.mesh(
      paveGeo,
      lambert({ map: tex(makePavingTexture()), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    ),
  );
  const driftMesh = drifts.mesh(
    keep(driftGeometry(cell + 0.3, 0.9)),
    lambert({
      map: tex(makeSandDriftTexture()),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  if (driftMesh) driftMesh.renderOrder = 1;
  addMesh(driftMesh);
  addMesh(tufts.mesh(keep(tuftGeometry()), lambert({ map: tex(makeGrassTuftTexture()), alphaTest: 0.5, side: THREE.DoubleSide })));

  const trunkTex = tex(makePalmTrunkTexture());
  trunkTex.repeat.set(2, 9);
  const trunkGeo = keep(new THREE.CylinderGeometry(0.15, 0.23, 1, 8, 1, true).translate(0, 0.5, 0));
  addMesh(trunks.mesh(trunkGeo, lambert({ map: trunkTex })));
  addMesh(fronds.mesh(keep(frondGeometry()), lambert({ map: tex(makePalmFrondTexture()), alphaTest: 0.45, side: THREE.DoubleSide })));

  if (wires.length > 0) {
    const wireGeo = keep(new THREE.BufferGeometry());
    wireGeo.setAttribute("position", new THREE.Float32BufferAttribute(wires, 3));
    group.add(new THREE.LineSegments(wireGeo, keep(new THREE.LineBasicMaterial({ color: 0x1d1a17 }))));
  }

  // ---------------------------------------------------------------- les ombres
  const shadowMat = keep(
    new THREE.MeshBasicMaterial({
      color: SHADOW_MUL,
      transparent: true,
      opacity: SHADOW_OPACITY,
      // Multiplication : resultat = fond x melange(blanc, couleur, alpha).
      blending: THREE.MultiplyBlending,
      premultipliedAlpha: true,
      // Le brouillard s'applique deja au sol dessous : pas une seconde fois.
      fog: false,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    }),
  );
  const groundShadow = paintGroundShadows();
  if (groundShadow) {
    const g = keep(new THREE.PlaneGeometry(W * cell, H * cell).rotateX(-Math.PI / 2));
    const m = keep(shadowMat.clone());
    m.alphaMap = groundShadow;
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set((W * cell) / 2, 0.012, (H * cell) / 2);
    mesh.renderOrder = 2;
    group.add(mesh);
  }
  const wallShadowGeo = buildWallShadows();
  if (wallShadowGeo) {
    const mesh = new THREE.Mesh(keep(wallShadowGeo), shadowMat);
    mesh.renderOrder = 2;
    group.add(mesh);
  }

  /** Ombres au sol : chaque volume projete selon le soleil, plus une ombre de contact au pied des murs. */
  function paintGroundShadows(): THREE.CanvasTexture | null {
    if (typeof document === "undefined") return null;
    const P = SHADOW_PX;
    const cw = W * P;
    const chh = H * P;
    const raw = document.createElement("canvas");
    raw.width = cw;
    raw.height = chh;
    const ctx = raw.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cw, chh);
    const k = P / cell;
    // Ombre de contact : le pied des murs et des caisses est toujours plus sombre.
    ctx.globalCompositeOperation = "lighten";
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!isFree(x, y)) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          if (isFree(x + dx, y + dy)) continue;
          const ex = (x + 0.5 + dx * 0.5) * P;
          const ey = (y + 0.5 + dy * 0.5) * P;
          const depth = 0.5 * k;
          const g = ctx.createLinearGradient(ex, ey, ex - dx * depth, ey - dy * depth);
          g.addColorStop(0, "rgba(255,255,255,0.55)");
          g.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = g;
          if (dx !== 0) ctx.fillRect(Math.min(ex, ex - dx * depth), y * P, depth, P);
          else ctx.fillRect(x * P, Math.min(ey, ey - dy * depth), P, depth);
        }
      }
    }
    // Ombres portees du soleil.
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#fff";
    const ox = -sunX / tanEl;
    const oz = -sunZ / tanEl;
    const poly = (x0: number, z0: number, x1: number, z1: number, h0: number, h1: number) => {
      const pts: [number, number][] = [];
      for (const h of [h0, h1]) {
        for (const [px, pz] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]] as const) pts.push([(px + ox * h) * k, (pz + oz * h) * k]);
      }
      const hull = convexHull(pts);
      ctx.beginPath();
      hull.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
      ctx.closePath();
      ctx.fill();
    };
    for (let ey = 0; ey < EH; ey++) {
      for (let ex = 0; ex < EW; ex++) {
        const h = heights[ey * EW + ex];
        if (h <= 0) continue;
        const x0 = (ex - RING) * cell;
        const z0 = (ey - RING) * cell;
        poly(x0, z0, x0 + cell, z0 + cell, 0, h);
      }
    }
    for (const f of floating) poly(f.x0, f.z0, f.x1, f.z1, f.h0, f.h1);
    // Bord un peu flou : la penombre d'un vrai soleil.
    const soft = document.createElement("canvas");
    soft.width = cw;
    soft.height = chh;
    const sctx = soft.getContext("2d");
    if (!sctx) return null;
    sctx.filter = "blur(1.2px)";
    sctx.drawImage(raw, 0, 0);
    const t = new THREE.CanvasTexture(soft);
    t.anisotropy = 4;
    return keep(t);
  }

  /** Ombre des murs d'en face sur les facades au soleil : des trapezes, calcules en cinq points par face. */
  function buildWallShadows(): THREE.BufferGeometry | null {
    const pos: number[] = [];
    const samples = [-0.5, -0.25, 0, 0.25, 0.5];
    const topAt = (px: number, pz: number) => {
      let top = 0;
      for (let d = 0.05; d < 16; d += 0.1) {
        const h = heightAt(px + sunX * d, pz + sunZ * d);
        if (h > 0) top = Math.max(top, h - d * tanEl);
      }
      return Math.min(top, wallHeight);
    };
    for (const f of faces) {
      if (f.nx * sunX + f.nz * sunZ <= 0.02) continue;
      const out = 0.075;
      const pts = samples.map((s) => {
        const a = s * cell;
        const px = f.x + f.tx * a + f.nx * out;
        const pz = f.z + f.tz * a + f.nz * out;
        return [px, pz, topAt(px + f.nx * 0.02, pz + f.nz * 0.02)] as const;
      });
      for (let i = 0; i + 1 < pts.length; i++) {
        const [ax, az, ah] = pts[i];
        const [bx, bz, bh] = pts[i + 1];
        if (ah <= 0.01 && bh <= 0.01) continue;
        pos.push(ax, 0, az, bx, 0, bz, bx, bh, bz, ax, 0, az, bx, bh, bz, ax, ah, az);
      }
    }
    if (pos.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.computeBoundingSphere();
    return geo;
  }

  return {
    group,
    dispose() {
      for (const o of owned) o.dispose();
    },
  };
}

// ---------------------------------------------------------------------------
// Petites pieces
// ---------------------------------------------------------------------------

/** Emprise d'une piece plaquee sur un mur, vue de dessus (demi-largeur, demi-profondeur). */
function rectAround(cx: number, cz: number, tx: number, tz: number, halfAlong: number, halfOut: number, h0: number, h1: number): Floating {
  const ax = Math.abs(tx) * halfAlong + Math.abs(tz) * halfOut;
  const az = Math.abs(tz) * halfAlong + Math.abs(tx) * halfOut;
  return { x0: cx - ax, z0: cz - az, x1: cx + ax, z1: cz + az, h0, h1 };
}

/** Emprise d'une arche ou d'une poutre : `hw` le long de (ax, az), `hd` en travers. */
function boxShadow(cx: number, cz: number, ax: number, az: number, hw: number, hd: number, h0: number, h1: number): Floating {
  const ex = Math.abs(ax) * hw + Math.abs(az) * hd;
  const ez = Math.abs(az) * hw + Math.abs(ax) * hd;
  return { x0: cx - ex, z0: cz - ez, x1: cx + ex, z1: cz + ez, h0, h1 };
}

/** Enveloppe convexe (chaine monotone). */
function convexHull(points: [number, number][]): [number, number][] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/**
 * Boite dont seule la face avant (+z) porte la texture ; les autres faces
 * prennent la couleur unie du coin (u, v) du canevas (climatiseur, compteur).
 */
function boxWithFront(w: number, h: number, d: number, u: number, v: number): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.getAttribute("uv");
  // Ordre des faces de BoxGeometry : +x, -x, +y, -y, +z, -z (quatre sommets chacune).
  for (let i = 0; i < uv.count; i++) {
    if (i >= 16 && i < 20) continue;
    uv.setXY(i, u, v);
  }
  return geo;
}

/** Sable amasse contre un mur : plus haut cote mur (v = 0), s'effile vers la rue. */
function driftGeometry(w: number, d: number): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const x = w / 2;
  const z = d / 2;
  geo.setAttribute("position", new THREE.Float32BufferAttribute([-x, 0.13, -z, -x, 0.01, z, x, 0.01, z, x, 0.13, -z], 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 1, 1, 0], 2));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.computeVertexNormals();
  return geo;
}

/** Touffe d'herbe seche : deux plans croises. */
function tuftGeometry(): THREE.BufferGeometry {
  const a = new THREE.PlaneGeometry(0.7, 0.5).translate(0, 0.25, 0);
  const b = a.clone().rotateY(Math.PI / 2);
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  for (const g of [a, b]) {
    const n = g.toNonIndexed();
    pos.push(...(n.getAttribute("position").array as Float32Array));
    nor.push(...(n.getAttribute("normal").array as Float32Array));
    uv.push(...(n.getAttribute("uv").array as Float32Array));
    n.dispose();
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  // Normales vers le haut : l'herbe s'eclaire comme le sol, sans face noire.
  const n = geo.getAttribute("normal");
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return geo;
}

/** Palme : un plan de 3 m, plie en V le long de sa nervure et qui retombe vers sa pointe. */
function frondGeometry(): THREE.BufferGeometry {
  const L = 3;
  const geo = new THREE.PlaneGeometry(L, 0.9, 10, 2);
  const p = geo.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + L / 2;
    const across = p.getY(i);
    const t = x / L;
    p.setXYZ(i, x, -1.3 * t * t - Math.abs(across) * 0.35, across);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Citerne d'eau sur le toit (plastique noir ou blanc), sur un petit socle. */
function addTank(m: Mesher, x: number, roof: number, z: number, dark: boolean): void {
  const c = new THREE.Color(dark ? 0x2b2927 : 0xd8d3c8);
  const body = new THREE.CylinderGeometry(0.5, 0.5, 1.1, 14);
  const mat = new THREE.Matrix4().makeTranslation(x, roof + 0.35 + 0.55, z);
  m.add(body, mat, c);
  body.dispose();
  const lid = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 10);
  mat.makeTranslation(x, roof + 0.35 + 1.15, z);
  m.add(lid, mat, c);
  lid.dispose();
  m.box(x, roof + 0.17, z, 1.1, 0.34, 1.1, 0, new THREE.Color(0x6b6660));
}

/** Antenne de television : mat et trois traverses. */
function addAntenna(m: Mesher, x: number, roof: number, z: number, yaw: number): void {
  const c = new THREE.Color(0x74787b);
  m.box(x, roof + 0.95, z, 0.04, 1.9, 0.04, yaw, c);
  for (const [y, w] of [[1.3, 0.9], [1.6, 0.7], [1.85, 0.5]] as const) m.box(x, roof + y, z, w, 0.025, 0.025, yaw, c);
  m.box(x, roof + 1.6, z, 0.02, 0.02, 0.8, yaw, c);
}

/** Parabole : une calotte de sphere tournee vers le ciel du sud, sur son bras. */
function addDish(m: Mesher, x: number, y: number, z: number, yaw: number): void {
  const c = new THREE.Color(0xd9d9d4);
  const cap = new THREE.SphereGeometry(0.42, 12, 4, 0, Math.PI * 2, 0, 0.5);
  cap.translate(0, -0.42, 0);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.0, yaw, 0, "YXZ"));
  const mat = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, ONE);
  m.add(cap, mat, c);
  cap.dispose();
  m.box(x, y - 0.25, z, 0.04, 0.5, 0.04, yaw, new THREE.Color(0x55595c));
}
