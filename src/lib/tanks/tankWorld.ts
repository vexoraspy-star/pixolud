import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { HEIGHT_STEP, BASE_RADIUS, type Biome, type House, type TankMap } from "./tankTerrain";
import {
  makeGroundDetailTexture,
  makeParticleTexture,
  makeRoofTexture,
  makeSkyTexture,
  makeWallTexture,
  paintTerrainTexture,
  type RoofStyle,
  type WallStyle,
} from "./tankTextures";

// Le decor de « Tonnerre d'Acier » en maillages three.js : terrain, eau
// (lac, mare ou riviere), villages, fermes, moulins, ponts, murets, rochers,
// arbres, buissons, bases et ciel, habilles selon le climat de la carte.
// Peu d'appels de rendu : tout ce qui se repete est instancie, les murs et
// les toits de tous les batiments sont fusionnes par materiau.

export interface TankWorld {
  group: THREE.Group;
  /** Se resout quand l'image du sol est entierement peinte (par tranches). */
  ready: Promise<void>;
  /** Couche un arbre dans la direction (dx, dz). */
  fellTree: (index: number, dx: number, dz: number) => void;
  /** Arbre deja couche (on passe dessus). */
  treeDown: (index: number) => boolean;
  /** Anime les arbres qui tombent, les drapeaux, les ailes des moulins et la neige autour de la camera. */
  update: (dt: number, time: number, camera?: THREE.Vector3) => void;
  dispose: () => void;
}

/** Tons du drapeau de chaque equipe (joueur : vert, adversaire : rouge). */
export const TEAM_COLORS = [0x3fbf5a, 0xd94141];

type RGB = [number, number, number];

/** Lumiere, brume et poussiere de chaque climat. */
export interface BiomeLook {
  fog: number;
  fogNear: number;
  fogFar: number;
  hemiSky: number;
  hemiGround: number;
  hemi: number;
  sun: number;
  sunI: number;
  sunDir: RGB;
  /** Poussiere des chenilles et gerbes des impacts dans le sol (0 a 1). */
  dust: RGB;
  soil: RGB;
  /** Couleur du fond de la mini-carte (0 a 255). */
  mini: RGB;
  /** Boue, sable ou neige colles au bas des chars (0 a 1). */
  grime: RGB;
}

export const BIOME_LOOK: Record<Biome, BiomeLook> = {
  mediterraneen: {
    fog: 0xc4d2da,
    fogNear: 170,
    fogFar: 1000,
    hemiSky: 0xdbe8ff,
    hemiGround: 0x5b5238,
    hemi: 1.6,
    sun: 0xfff0d6,
    sunI: 2.7,
    sunDir: [-0.45, 0.78, 0.43],
    dust: [0.66, 0.58, 0.45],
    soil: [0.42, 0.34, 0.24],
    mini: [96, 118, 72],
    grime: [0.46, 0.39, 0.29],
  },
  hiver: {
    fog: 0xd3dae2,
    fogNear: 110,
    fogFar: 760,
    hemiSky: 0xe2eaf6,
    hemiGround: 0x7d8290,
    hemi: 1.45,
    sun: 0xf0f2ff,
    sunI: 2.1,
    sunDir: [-0.6, 0.55, 0.58],
    dust: [0.9, 0.92, 0.95],
    soil: [0.78, 0.8, 0.84],
    mini: [192, 198, 208],
    grime: [0.86, 0.89, 0.93],
  },
  desert: {
    fog: 0xdccbb0,
    fogNear: 150,
    fogFar: 900,
    hemiSky: 0xf2e6d2,
    hemiGround: 0x86684a,
    hemi: 1.45,
    sun: 0xffe4b8,
    sunI: 2.8,
    sunDir: [-0.35, 0.86, 0.36],
    dust: [0.8, 0.68, 0.5],
    soil: [0.66, 0.52, 0.34],
    mini: [186, 154, 108],
    grime: [0.74, 0.62, 0.45],
  },
  bocage: {
    fog: 0xc6d4de,
    fogNear: 170,
    fogFar: 1000,
    hemiSky: 0xdce9ff,
    hemiGround: 0x4d5a34,
    hemi: 1.6,
    sun: 0xfff4e0,
    sunI: 2.6,
    sunDir: [-0.5, 0.74, 0.45],
    dust: [0.58, 0.52, 0.4],
    soil: [0.36, 0.3, 0.22],
    mini: [80, 118, 56],
    grime: [0.29, 0.24, 0.16],
  },
};

function wallStyleFor(biome: Biome, kind: number): WallStyle {
  if (biome === "hiver") return kind === 2 || kind === 3 ? "crepi" : "bois";
  if (biome === "desert") return "adobe";
  if (biome === "bocage") return kind === 0 ? "brique" : kind === 4 ? "crepi" : "pierre";
  return kind === 0 ? "crepi" : "pierre";
}

function roofStyleFor(biome: Biome, kind: number): RoofStyle {
  if (biome === "hiver") return "neige";
  if (biome === "desert") return "terre";
  if (biome === "bocage") return kind === 1 ? "tuiles" : "ardoise";
  return "tuiles";
}

/** Composantes lineaires d'une couleur (pour les couleurs par sommet). */
function lin(hex: number): RGB {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}

/** Geometrie sans index (pour fusionner des formes differentes). */
function flat(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!geo.index) return geo;
  const n = geo.toNonIndexed();
  geo.dispose();
  return n;
}

/** Couleur par sommet, calculee a partir de la hauteur du sommet et du numero de son triangle. */
function paint(geo: THREE.BufferGeometry, color: (y: number, face: number) => RGB): THREE.BufferGeometry {
  const g = flat(geo);
  const p = g.getAttribute("position");
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const c = color(p.getY(i), Math.floor(i / 3));
    col[i * 3] = c[0];
    col[i * 3 + 1] = c[1];
    col[i * 3 + 2] = c[2];
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const clean = parts.map(flat);
  const m = mergeGeometries(clean, false)!;
  for (const p of clean) p.dispose();
  return m;
}

/** Hachage stable d'un nombre (0 a 1), pour varier sans tirage. */
function hash(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

/** Coordonnees de texture d'une boite a l'echelle du metre (un carreau = `tile` metres). */
function tileBox(geo: THREE.BufferGeometry, sx: number, sy: number, sz: number, tile: number): THREE.BufferGeometry {
  const uv = geo.getAttribute("uv");
  const nrm = geo.getAttribute("normal");
  for (let k = 0; k < uv.count; k++) {
    const ax = Math.abs(nrm.getX(k));
    const ay = Math.abs(nrm.getY(k));
    const [su, sv] = ax > 0.5 ? [sz, sy] : ay > 0.5 ? [sx, sz] : [sx, sy];
    uv.setXY(k, (uv.getX(k) * su) / tile, (uv.getY(k) * sv) / tile);
  }
  return geo;
}

// ------------------------------------------------------------------ arbres

interface TreeKind {
  geo: THREE.BufferGeometry;
  color: number;
  vertexColors: boolean;
  doubleSide: boolean;
  trunkHeight: number;
  trunkColor: number;
}

/** Sapin : des etages de cones, la neige posee sur le haut de chaque etage. */
function firGeometry(tiers: number, height: number): THREE.BufferGeometry {
  const green = lin(0x2c4632);
  const dark = lin(0x1f3326);
  const snow = lin(0xe6ecf2);
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < tiers; k++) {
    const t = k / tiers;
    const r = 2.5 * (1 - t * 0.72);
    const h = 3.2 * (1 - t * 0.35);
    const y = 1.4 + (k * (height - 3)) / tiers + h / 2;
    const cone = new THREE.ConeGeometry(r, h, 8, 2);
    cone.translate(0, y, 0);
    parts.push(
      paint(cone, (vy) => {
        const up = (vy - (y - h / 2)) / h;
        const s = up > 0.9 ? 1 : up > 0.4 ? 0.55 : 0;
        const base = up < 0.1 ? dark : green;
        return [base[0] + (snow[0] - base[0]) * s, base[1] + (snow[1] - base[1]) * s, base[2] + (snow[2] - base[2]) * s];
      }),
    );
  }
  return merge(parts);
}

/** Des boules de feuillage aplaties (olivier, chene, pommier...). */
function blobs(list: [number, number, number, number][], squash: number): THREE.BufferGeometry[] {
  return list.map(([x, y, z, s]) => {
    const b = new THREE.IcosahedronGeometry(s, 1);
    b.scale(1, squash, 1);
    b.translate(x, y, z);
    return b;
  });
}

/** Palmier : neuf palmes arquees au sommet d'un long stipe, un regime de dattes dessous. */
function palmCrown(top: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + (k % 2) * 0.25;
    const frond = new THREE.PlaneGeometry(1, 3.9, 1, 6);
    const p = frond.getAttribute("position");
    const lift = k % 3 === 0 ? 0.5 : 0;
    for (let i = 0; i < p.count; i++) {
      const t = (p.getY(i) + 1.95) / 3.9;
      const w = p.getX(i) * (1.1 - t * 0.75);
      p.setXYZ(i, w, top + 0.25 + t * (1 + lift) - t * t * 2.3, t * 3.7);
    }
    frond.rotateY(a);
    parts.push(frond);
  }
  const dates = new THREE.IcosahedronGeometry(0.5, 0);
  dates.scale(1, 1.3, 1);
  dates.translate(0, top - 0.35, 0);
  parts.push(dates);
  const g = merge(parts);
  g.computeVertexNormals();
  return g;
}

/** Fuseau (cypres, peuplier) : un cylindre renfle au milieu. */
function spindle(rTop: number, rBottom: number, height: number, y: number, bulge: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBottom, height, 9, 4);
  const p = g.getAttribute("position");
  for (let k = 0; k < p.count; k++) {
    const b = Math.sin(((p.getY(k) + height / 2) / height) * Math.PI) * bulge;
    p.setX(k, p.getX(k) * (1 + b));
    p.setZ(k, p.getZ(k) * (1 + b));
  }
  g.translate(0, y, 0);
  g.computeVertexNormals();
  return g;
}

/** Les trois essences d'un climat : feuillage, couleur, hauteur et teinte du tronc. */
function treeKinds(biome: Biome): TreeKind[] {
  const plain = (geo: THREE.BufferGeometry, color: number, trunkHeight: number, trunkColor: number): TreeKind => ({
    geo,
    color,
    vertexColors: false,
    doubleSide: false,
    trunkHeight,
    trunkColor,
  });
  if (biome === "hiver") {
    // Sapin, bouleau aux dernieres feuilles dorees, grand sapin.
    const birch = merge(
      blobs(
        [
          [0, 5.3, 0, 1.5],
          [0.5, 6.7, 0.3, 1.05],
          [-0.4, 4.4, -0.3, 1.1],
        ],
        1.6,
      ),
    );
    return [
      { geo: firGeometry(4, 8), color: 0xffffff, vertexColors: true, doubleSide: false, trunkHeight: 1.6, trunkColor: 0x4a3a2c },
      plain(birch, 0xb09a5c, 4.4, 0xe4e0d8),
      { geo: firGeometry(5, 11.5), color: 0xffffff, vertexColors: true, doubleSide: false, trunkHeight: 1.8, trunkColor: 0x46372a },
    ];
  }
  if (biome === "desert") {
    // Palmier-dattier, acacia en ombrelle, grand palmier.
    const acacia = merge(
      blobs(
        [
          [0, 0, 0, 1],
          [0.36, -0.15, -0.25, 0.7],
        ],
        1,
      ),
    );
    acacia.scale(3.4, 0.75, 3.1);
    acacia.translate(0, 3.7, 0);
    return [
      { geo: palmCrown(7.4), color: 0x5f7c3a, vertexColors: false, doubleSide: true, trunkHeight: 7.5, trunkColor: 0x8c7658 },
      plain(acacia, 0x7a8044, 2.8, 0x5a4636),
      { geo: palmCrown(10.6), color: 0x587636, vertexColors: false, doubleSide: true, trunkHeight: 10.7, trunkColor: 0x857054 },
    ];
  }
  if (biome === "bocage") {
    // Chene, peuplier, pommier aux fruits rouges.
    const oak = merge(
      blobs(
        [
          [0, 5.8, 0, 2.8],
          [1.9, 5.1, 0.6, 2.2],
          [-1.7, 5.3, -0.8, 2.3],
          [0.3, 7.1, 0.5, 1.9],
        ],
        0.85,
      ),
    );
    const leaf = lin(0x55823a);
    const fruit = lin(0xb5342a);
    const apple = paint(
      merge(
        blobs(
          [
            [0, 2.9, 0, 1.9],
            [0.9, 3.4, 0.5, 1.3],
            [-0.8, 3.2, -0.4, 1.2],
          ],
          0.82,
        ),
      ),
      (_y, face) => (hash(face * 7.31) < 0.1 ? fruit : leaf),
    );
    return [
      plain(oak, 0x3e6a2a, 3.4, 0x4e3d2c),
      plain(spindle(0.25, 1.55, 12, 7.6, 0.4), 0x5b8436, 1.8, 0x77756a),
      { geo: apple, color: 0xffffff, vertexColors: true, doubleSide: false, trunkHeight: 1.5, trunkColor: 0x5a4634 },
    ];
  }
  // Mediterraneen : olivier (trois masses gris-vert), cypres (fuseau sombre), pin parasol (plateau en haut d'un long fut).
  const olive = merge(
    blobs(
      [
        [0, 3.1, 0, 1.9],
        [1.1, 2.7, 0.4, 1.3],
        [-0.9, 2.8, -0.5, 1.4],
      ],
      0.72,
    ),
  );
  const pineParts = blobs([[0, 8.4, 0, 3.2]], 0.36);
  const side = new THREE.IcosahedronGeometry(1.8, 1);
  side.scale(1, 0.4, 1);
  side.translate(1.6, 7.8, 0.8);
  pineParts.push(side);
  return [
    plain(olive, 0x7c8c5c, 2.2, 0x5f4a36),
    plain(spindle(0.1, 1.05, 9, 5.5, 0.35), 0x2f4a2c, 1.4, 0x5f4a36),
    plain(merge(pineParts), 0x486a38, 7.6, 0x5f4a36),
  ];
}

// ------------------------------------------------------------------ monde

export function buildTankWorld(map: TankMap, detail: boolean): TankWorld {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(o: T): T => {
    disposables.push(o);
    return o;
  };
  const biome = map.biome;

  // --- Terrain ---
  // Un sommet tous les deux pas de la grille des hauteurs (5 m).
  const stride = 2;
  const segs = Math.floor((map.hn - 1) / stride);
  const size = segs * stride * HEIGHT_STEP;
  const terrainGeo = keep(new THREE.PlaneGeometry(size, size, segs, segs));
  terrainGeo.rotateX(-Math.PI / 2);
  const tp = terrainGeo.getAttribute("position");
  const tuv = terrainGeo.getAttribute("uv");
  for (let k = 0; k < tp.count; k++) {
    const x = tp.getX(k);
    const z = tp.getZ(k);
    const i = Math.round((x + map.world) / HEIGHT_STEP);
    const j = Math.round((z + map.world) / HEIGHT_STEP);
    tp.setY(k, map.heights[Math.min(map.hn - 1, j) * map.hn + Math.min(map.hn - 1, i)]);
    // La texture couvre tout le monde : v vers le sud comme sur le canvas.
    tuv.setXY(k, (x + map.world) / (map.world * 2), 1 - (z + map.world) / (map.world * 2));
  }
  terrainGeo.computeVertexNormals();
  const terrainPaint = paintTerrainTexture(map, detail ? 2048 : 1536);
  const terrainTex = keep(terrainPaint.texture);
  terrainTex.flipY = true;
  const groundDetail = keep(makeGroundDetailTexture());
  const terrainMat = keep(new THREE.MeshLambertMaterial({ map: terrainTex }));
  // Detail vu de pres : un carreau de 4 m qui module la couleur, qui s'efface au loin.
  terrainMat.onBeforeCompile = (shader) => {
    shader.uniforms.uDetail = { value: groundDetail };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTkWorld;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvTkWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform sampler2D uDetail;\nvarying vec3 vTkWorld;")
      .replace(
        "#include <map_fragment>",
        [
          "#include <map_fragment>",
          "float tkDist = length(vTkWorld - cameraPosition);",
          "float tkFade = 1.0 - smoothstep(25.0, 110.0, tkDist);",
          "float tkD = texture2D(uDetail, vTkWorld.xz * 0.25).r * 1.25;",
          "float tkD2 = texture2D(uDetail, vTkWorld.xz * 0.043).r * 1.25;",
          "diffuseColor.rgb *= mix(1.0, tkD, tkFade) * mix(1.0, tkD2, 0.5);",
        ].join("\n"),
      );
  };
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.receiveShadow = true;
  group.add(terrain);

  // --- L'eau : lac, mare de l'oasis ou riviere (le lac gele est peint sur le sol) ---
  if ((map.waterKind === "lac" || map.waterKind === "oasis") && map.lake.r > 0) {
    const waterGeo = keep(new THREE.CircleGeometry(map.lake.r + (map.waterKind === "oasis" ? 8 : 14), 40));
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = keep(
      new THREE.MeshLambertMaterial({
        color: map.waterKind === "oasis" ? 0x3a7f7a : 0x3f6f78,
        transparent: true,
        opacity: 0.86,
        emissive: 0x0b1a1e,
      }),
    );
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.set(map.lake.x, map.waterLevel, map.lake.z);
    group.add(water);
  }
  if (map.waterKind === "riviere" && map.river) {
    // Un ruban d'eau le long du trace, assez large pour passer sous les berges.
    const pts = map.river.pts;
    const half = map.river.width / 2 + 7;
    const pos: number[] = [];
    const idx: number[] = [];
    for (let k = 0; k < pts.length; k++) {
      const [x, z] = pts[k];
      const [xa, za] = pts[Math.max(0, k - 1)];
      const [xb, zb] = pts[Math.min(pts.length - 1, k + 1)];
      const l = Math.hypot(xb - xa, zb - za);
      const nx = -(zb - za) / l;
      const nz = (xb - xa) / l;
      pos.push(x + nx * half, 0, z + nz * half, x - nx * half, 0, z - nz * half);
      if (k > 0) {
        const a = (k - 1) * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const riverGeo = keep(new THREE.BufferGeometry());
    riverGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    riverGeo.setIndex(idx);
    riverGeo.computeVertexNormals();
    const riverMat = keep(new THREE.MeshLambertMaterial({ color: 0x46706c, transparent: true, opacity: 0.86, emissive: 0x0a1a1a }));
    const river = new THREE.Mesh(riverGeo, riverMat);
    river.position.y = map.waterLevel;
    group.add(river);
  }

  // --- Batiments : murs et toits fusionnes par style ---
  const wallGroups = new Map<WallStyle, THREE.BufferGeometry[]>();
  const roofGroups = new Map<RoofStyle, THREE.BufferGeometry[]>();
  const addTo = <K>(m: Map<K, THREE.BufferGeometry[]>, key: K, g: THREE.BufferGeometry) => {
    const list = m.get(key);
    if (list) list.push(g);
    else m.set(key, [g]);
  };
  const dark: THREE.BufferGeometry[] = [];
  const mills: { blades: THREE.Mesh; speed: number }[] = [];
  const bladeGeo = keep(makeMillBlades());
  const bladeMat = keep(new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide }));
  const overhang = biome === "hiver" ? 0.95 : 0.5;

  /** Toit a deux pans, un peu debordant (tres debordant sur les chalets). */
  const gableRoof = (h: House, style: RoofStyle) => {
    const long = h.ridgeX ? h.w + overhang * 1.6 : h.d + overhang * 1.6;
    const wide = (h.ridgeX ? h.d : h.w) / 2 + overhang;
    const shape = new THREE.Shape();
    shape.moveTo(-wide, 0);
    shape.lineTo(wide, 0);
    shape.lineTo(0, h.roof);
    shape.lineTo(-wide, 0);
    const roof = new THREE.ExtrudeGeometry(shape, { depth: long, bevelEnabled: false });
    roof.translate(0, 0, -long / 2);
    if (h.ridgeX) roof.rotateY(Math.PI / 2);
    // Tuiles : coordonnees a l'echelle du metre.
    const ruv = roof.getAttribute("uv");
    for (let k = 0; k < ruv.count; k++) ruv.setXY(k, ruv.getX(k) * 0.35, ruv.getY(k) * 0.35);
    roof.translate(h.x, h.y + h.h, h.z);
    addTo(roofGroups, style, roof);
  };

  /** Toit plat du desert : une dalle, un parapet ou des creneaux, parfois une coupole blanchie. */
  const flatRoof = (h: House, wall: WallStyle, crenel: boolean) => {
    const top = h.y + h.h;
    const slab = new THREE.BoxGeometry(h.w + 0.3, 0.35, h.d + 0.3);
    slab.translate(h.x, top + 0.17, h.z);
    addTo(roofGroups, "terre", slab);
    const para = 0.55;
    const edges: [number, number, number, number][] = [
      [h.x, h.z - h.d / 2, h.w + 0.3, 0.3],
      [h.x, h.z + h.d / 2, h.w + 0.3, 0.3],
      [h.x - h.w / 2, h.z, 0.3, h.d + 0.3],
      [h.x + h.w / 2, h.z, 0.3, h.d + 0.3],
    ];
    for (const [ex, ez, ew, ed] of edges) {
      const alongX = ew > ed;
      const along = alongX ? ew : ed;
      if (crenel) {
        // Merlons : des creneaux reguliers le long du bord.
        const n = Math.max(3, Math.round(along / 1.1));
        for (let s = 0; s < n; s += 2) {
          const t = (s + 0.5) / n - 0.5;
          const mw = alongX ? along / n : ew;
          const md = alongX ? ed : along / n;
          const m = tileBox(new THREE.BoxGeometry(mw, 0.9, md), mw, 0.9, md, 4);
          m.translate(ex + (alongX ? t * along : 0), top + 0.35 + 0.35 + 0.45, ez + (alongX ? 0 : t * along));
          addTo(wallGroups, wall, m);
        }
        const low = tileBox(new THREE.BoxGeometry(ew, 0.35, ed), ew, 0.35, ed, 4);
        low.translate(ex, top + 0.35 + 0.17, ez);
        addTo(wallGroups, wall, low);
      } else {
        const p = tileBox(new THREE.BoxGeometry(ew, para, ed), ew, para, ed, 4);
        p.translate(ex, top + 0.35 + para / 2, ez);
        addTo(wallGroups, wall, p);
      }
    }
    if (!crenel && (h.kind === 2 || hash(h.x * 3.1 + h.z) < 0.28)) {
      const r = Math.min(h.w, h.d) * (h.kind === 2 ? 0.26 : 0.3);
      const dome = new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      dome.translate(h.x + (h.kind === 2 ? h.w * 0.22 : 0), top + 0.35, h.z + (h.kind === 2 ? -h.d * 0.2 : 0));
      addTo(wallGroups, "crepi", dome);
    }
  };

  for (const h of map.houses) {
    const wall = wallStyleFor(biome, h.kind);
    const roofStyle = roofStyleFor(biome, h.kind);
    if (h.kind === 4) {
      // Moulin a vent : tour ronde blanchie, calotte, porte, et des ailes qui tournent.
      const tall = h.h + 1.5;
      const body = new THREE.CylinderGeometry(2.2, 3, tall, 14, 1);
      const buv = body.getAttribute("uv");
      for (let k = 0; k < buv.count; k++) buv.setXY(k, buv.getX(k) * 4, buv.getY(k) * Math.max(1, Math.round(tall / 3.2)));
      body.translate(h.x, h.y - 1.5 + tall / 2, h.z);
      addTo(wallGroups, wall, body);
      const cap = new THREE.ConeGeometry(2.75, h.roof, 14);
      cap.translate(h.x, h.y + h.h + h.roof / 2, h.z);
      addTo(roofGroups, roofStyle, cap);
      // Tous les moulins face au meme vent.
      const yaw = 0.6;
      const door = new THREE.BoxGeometry(1.3, 2.2, 0.3);
      door.rotateY(yaw);
      door.translate(h.x + Math.sin(yaw) * 2.85, h.y + 1.1, h.z + Math.cos(yaw) * 2.85);
      dark.push(door);
      const hub = new THREE.Group();
      hub.position.set(h.x + Math.sin(yaw) * 3, h.y + h.h + 0.3, h.z + Math.cos(yaw) * 3);
      hub.rotation.y = yaw;
      const blades = new THREE.Mesh(bladeGeo, bladeMat);
      blades.castShadow = true;
      blades.rotation.z = hash(h.x) * 6;
      hub.add(blades);
      group.add(hub);
      mills.push({ blades, speed: 0.45 + hash(h.z) * 0.3 });
      continue;
    }
    const wallGeo = new THREE.BoxGeometry(h.w, h.h + 1.5, h.d);
    // Carreaux de texture de 4 m sur 3,2 m : une fenetre par carreau.
    const uv = wallGeo.getAttribute("uv");
    const nrm = wallGeo.getAttribute("normal");
    for (let k = 0; k < uv.count; k++) {
      const alongX = Math.abs(nrm.getZ(k)) > 0.5;
      const span = alongX ? h.w : h.d;
      uv.setXY(k, uv.getX(k) * Math.max(1, Math.round(span / 4)), uv.getY(k) * Math.max(1, Math.round((h.h + 1.5) / 3.2)));
    }
    wallGeo.translate(h.x, h.y - 1.5 + (h.h + 1.5) / 2, h.z);
    addTo(wallGroups, wall, wallGeo);
    if (h.kind === 3) {
      // Clocher ou tour : baies sombres en haut, fleche pointue (ou creneaux au desert).
      const bayW = biome === "desert" ? 0.7 : 1.6;
      const bayH = biome === "desert" ? 1.6 : 2.6;
      for (const [dx, dz] of [
        [0, h.d / 2],
        [0, -h.d / 2],
        [h.w / 2, 0],
        [-h.w / 2, 0],
      ]) {
        const bay = new THREE.BoxGeometry(dx ? 0.1 : bayW, bayH, dz ? 0.1 : bayW);
        bay.translate(h.x + dx * 1.01, h.y + h.h - 2.4, h.z + dz * 1.01);
        dark.push(bay);
      }
      if (biome === "desert") {
        flatRoof(h, wall, true);
      } else {
        const spireH = biome === "bocage" ? 7.5 : biome === "hiver" ? 5.2 : 4.2;
        const spire = new THREE.ConeGeometry(h.w * (biome === "bocage" ? 0.72 : 0.78), spireH, biome === "hiver" ? 8 : 4);
        spire.rotateY(Math.PI / 4);
        spire.translate(h.x, h.y + h.h + spireH / 2, h.z);
        addTo(roofGroups, roofStyle, spire);
      }
      continue;
    }
    if (biome === "desert") flatRoof(h, wall, h.kind === 1);
    else gableRoof(h, roofStyle);
    // Porte sombre sur une facade.
    const door = new THREE.BoxGeometry(h.ridgeX ? 1.3 : 0.1, 2.2, h.ridgeX ? 0.1 : 1.3);
    door.translate(h.x + (h.ridgeX ? 0 : h.w / 2 + 0.02), h.y + 1.1, h.z + (h.ridgeX ? h.d / 2 + 0.02 : 0));
    dark.push(door);
  }
  // Murets (de pierre, ou d'argile au desert).
  const wallLine: WallStyle = biome === "desert" ? "adobe" : "pierre";
  for (const w of map.walls) {
    const len = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
    const steps = Math.ceil(len / 6);
    for (let s = 0; s < steps; s++) {
      const t0 = s / steps;
      const t1 = (s + 1) / steps;
      const x0 = w.x0 + (w.x1 - w.x0) * t0;
      const z0 = w.z0 + (w.z1 - w.z0) * t0;
      const x1 = w.x0 + (w.x1 - w.x0) * t1;
      const z1 = w.z0 + (w.z1 - w.z0) * t1;
      const seg = new THREE.BoxGeometry(0.7, w.h + 0.6, Math.hypot(x1 - x0, z1 - z0) + 0.1);
      seg.rotateY(Math.atan2(x1 - x0, z1 - z0));
      const mx = (x0 + x1) / 2;
      const mz = (z0 + z1) / 2;
      const y = heightAtWorld(map, mx, mz);
      seg.translate(mx, y + (w.h + 0.6) / 2 - 0.5, mz);
      addTo(wallGroups, wallLine, seg);
    }
  }
  // Ponts de pierre : tablier en pente douce, parapets, deux piles dans l'eau.
  const eBridge = new THREE.Euler(0, 0, 0, "YXZ");
  const mBridge = new THREE.Matrix4();
  for (const br of map.bridges) {
    const dx = br.x1 - br.x0;
    const dz = br.z1 - br.z0;
    const len = Math.hypot(dx, dz) + 1;
    eBridge.set(-Math.atan2(br.y1 - br.y0, len), Math.atan2(dx, dz), 0);
    mBridge.makeRotationFromEuler(eBridge).setPosition((br.x0 + br.x1) / 2, (br.y0 + br.y1) / 2, (br.z0 + br.z1) / 2);
    const parts: THREE.BufferGeometry[] = [];
    const deck = tileBox(new THREE.BoxGeometry(br.w, 0.9, len), br.w, 0.9, len, 4);
    deck.translate(0, -0.45, 0);
    parts.push(deck);
    for (const side of [-1, 1]) {
      const par = tileBox(new THREE.BoxGeometry(0.5, 1, len), 0.5, 1, len, 4);
      par.translate(side * (br.w / 2 - 0.25), 0.5, 0);
      parts.push(par);
    }
    for (const t of [-0.2, 0.2]) {
      const pier = tileBox(new THREE.BoxGeometry(br.w - 1.2, 6, 2.4), br.w - 1.2, 6, 2.4, 4);
      pier.translate(0, -3.8, t * len);
      parts.push(pier);
    }
    for (const g of parts) {
      g.applyMatrix4(mBridge);
      addTo(wallGroups, "pierre", g);
    }
  }
  const mergeTo = (list: THREE.BufferGeometry[], mat: THREE.Material, shadow: boolean) => {
    if (list.length === 0) return;
    const merged = keep(merge(list));
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  const wallSeeds: Record<WallStyle, number> = { crepi: 3, pierre: 5, bois: 7, adobe: 9, brique: 11 };
  for (const [style, list] of wallGroups) {
    mergeTo(list, keep(new THREE.MeshLambertMaterial({ map: keep(makeWallTexture(style, wallSeeds[style])) })), true);
  }
  for (const [style, list] of roofGroups) {
    mergeTo(list, keep(new THREE.MeshLambertMaterial({ map: keep(makeRoofTexture(style)) })), true);
  }
  mergeTo(dark, keep(new THREE.MeshLambertMaterial({ color: 0x241f1b })), false);

  // --- Rochers ---
  const rockGeo = keep(new THREE.IcosahedronGeometry(1, 1));
  {
    const p = rockGeo.getAttribute("position");
    for (let k = 0; k < p.count; k++) {
      const s = 0.82 + (Math.abs(Math.sin(k * 12.9898) * 43758.5453) % 0.36);
      p.setXYZ(k, p.getX(k) * s, p.getY(k) * s * 0.75, p.getZ(k) * s);
    }
    rockGeo.computeVertexNormals();
    if (biome === "hiver") {
      // Neige sur le dessus des rochers.
      const snowTop = lin(0xe8edf2);
      const col = new Float32Array(p.count * 3);
      for (let k = 0; k < p.count; k++) col.set(p.getY(k) > 0.28 ? snowTop : [1, 1, 1], k * 3);
      rockGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    }
  }
  const rockMat = keep(new THREE.MeshLambertMaterial({ color: 0xb8b0a2, flatShading: true, vertexColors: biome === "hiver" }));
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, Math.max(1, map.rocks.length));
  const m4 = new THREE.Matrix4();
  const q4 = new THREE.Quaternion();
  const e3 = new THREE.Euler();
  const v3 = new THREE.Vector3();
  const s3 = new THREE.Vector3();
  const tint = new THREE.Color();
  map.rocks.forEach((r, i) => {
    e3.set(0, (i * 1.7) % 6.28, 0);
    q4.setFromEuler(e3);
    m4.compose(v3.set(r.x, r.y - r.r * 0.2, r.z), q4, s3.set(r.r, r.r * 0.9, r.r * 1.1));
    rocks.setMatrixAt(i, m4);
    // Gres rouge au desert, granit gris-bleu en montagne, calcaire ailleurs.
    if (biome === "desert") tint.setHSL(0.055, 0.32 + (i % 5) * 0.03, 0.4 + (i % 7) * 0.025);
    else if (biome === "hiver") tint.setHSL(0.6, 0.04 + (i % 3) * 0.02, 0.38 + (i % 7) * 0.03);
    else if (biome === "bocage") tint.setHSL(0.14, 0.06 + (i % 4) * 0.03, 0.38 + (i % 7) * 0.03);
    else tint.setHSL(0.1, 0.05 + (i % 5) * 0.015, 0.42 + (i % 7) * 0.035);
    rocks.setColorAt(i, tint);
  });
  rocks.count = map.rocks.length;
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  group.add(rocks);

  // --- Arbres : un tronc commun (teinte par essence), trois feuillages par climat ---
  const kinds = treeKinds(biome);
  for (const k of kinds) keep(k.geo);
  const trunkGeo = keep(new THREE.CylinderGeometry(0.16, 0.3, 1, 7));
  trunkGeo.translate(0, 0.5, 0);
  const trunkMat = keep(new THREE.MeshLambertMaterial({ color: 0xffffff }));
  const foliageMats = kinds.map((k) =>
    keep(
      new THREE.MeshLambertMaterial({
        color: k.color,
        flatShading: true,
        vertexColors: k.vertexColors,
        side: k.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
      }),
    ),
  );
  const trees = map.trees;
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, Math.max(1, trees.length));
  const counts = [0, 0, 0];
  for (const t of trees) counts[t.kind]++;
  const crowns = kinds.map((k, i) => new THREE.InstancedMesh(k.geo, foliageMats[i], Math.max(1, counts[i])));
  /** Pour chaque arbre : son indice dans le maillage de son feuillage. */
  const crownIndex = new Int32Array(trees.length);
  const used = [0, 0, 0];
  const qFall = new THREE.Quaternion();
  const axisX = new THREE.Vector3(1, 0, 0);
  const treeMatrix = (i: number, fall: number, dirYaw: number, crown: boolean) => {
    const t = trees[i];
    // Couche autour de sa base, dans la direction de la poussee.
    e3.set(0, dirYaw, 0);
    q4.setFromEuler(e3);
    qFall.setFromAxisAngle(axisX, fall);
    q4.multiply(qFall);
    if (crown) m4.compose(v3.set(t.x, t.y - 0.2, t.z), q4, s3.set(t.scale, t.scale, t.scale));
    else m4.compose(v3.set(t.x, t.y - 0.2, t.z), q4, s3.set(t.scale, kinds[t.kind].trunkHeight * t.scale, t.scale));
    return m4;
  };
  trees.forEach((t, i) => {
    trunks.setMatrixAt(i, treeMatrix(i, 0, (i * 2.3) % 6.28, false));
    trunks.setColorAt(i, tint.setHex(kinds[t.kind].trunkColor));
    const k = used[t.kind]++;
    crownIndex[i] = k;
    crowns[t.kind].setMatrixAt(k, treeMatrix(i, 0, (i * 2.3) % 6.28, true));
    crowns[t.kind].setColorAt(k, tint.setRGB(0.85 + (i % 5) * 0.06, 0.85 + (i % 3) * 0.07, 0.85 + (i % 4) * 0.05));
  });
  trunks.count = trees.length;
  trunks.castShadow = true;
  if (trunks.instanceColor) trunks.instanceColor.needsUpdate = true;
  group.add(trunks);
  for (const cm of crowns) {
    cm.castShadow = true;
    cm.receiveShadow = true;
    if (cm.instanceColor) cm.instanceColor.needsUpdate = true;
    group.add(cm);
  }
  const falling: { i: number; t: number; yaw: number }[] = [];
  const down = new Uint8Array(trees.length);

  // --- Buissons (arbustes enneiges, broussailles seches, haies) ---
  const bushGeo = keep(new THREE.IcosahedronGeometry(1, 0));
  bushGeo.scale(1, 0.6, 1);
  const bushColor: Record<Biome, number> = { mediterraneen: 0x566b34, hiver: 0xb4c0c2, desert: 0x8c8450, bocage: 0x46652a };
  const bushMat = keep(new THREE.MeshLambertMaterial({ color: bushColor[biome], flatShading: true }));
  const bushes = new THREE.InstancedMesh(bushGeo, bushMat, Math.max(1, map.bushes.length));
  const bushScale = biome === "desert" ? 0.75 : 1;
  map.bushes.forEach((b, i) => {
    e3.set(0, i * 0.9, 0);
    q4.setFromEuler(e3);
    const s = b.s * bushScale;
    m4.compose(v3.set(b.x, b.y + 0.2 * s, b.z), q4, s3.set(s * 1.3, s, s * 1.1));
    bushes.setMatrixAt(i, m4);
  });
  bushes.count = map.bushes.length;
  group.add(bushes);

  // --- Bases : cercle de capture, mats et drapeaux ---
  const flags: THREE.Mesh[] = [];
  map.bases.forEach((b, team) => {
    const y = heightAtWorld(map, b.x, b.z);
    const ringGeo = keep(new THREE.RingGeometry(BASE_RADIUS - 0.8, BASE_RADIUS, 64));
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = keep(
      new THREE.MeshBasicMaterial({ color: TEAM_COLORS[team], transparent: true, opacity: 0.55, depthWrite: false }),
    );
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(b.x, y + 0.12, b.z);
    group.add(ring);
    const poleGeo = keep(new THREE.CylinderGeometry(0.07, 0.09, 9, 8));
    const poleMat = keep(new THREE.MeshLambertMaterial({ color: 0xcfcfcf }));
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(b.x, y + 4.5, b.z);
    pole.castShadow = true;
    group.add(pole);
    const flagGeo = keep(new THREE.PlaneGeometry(2.6, 1.6, 8, 1));
    flagGeo.translate(1.3, 0, 0);
    const flagMat = keep(new THREE.MeshLambertMaterial({ color: TEAM_COLORS[team], side: THREE.DoubleSide }));
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(b.x + 0.08, y + 8.1, b.z);
    group.add(flag);
    flags.push(flag);
  });

  // --- Ciel ---
  const skyTex = keep(makeSkyTexture(biome));
  const skyGeo = keep(new THREE.SphereGeometry(1400, 32, 16));
  const skyMat = keep(new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.renderOrder = -1;
  group.add(sky);

  // --- Neige qui tombe autour de la camera (carte d'hiver, qualite normale) ---
  const FLAKES = 1400;
  const SNOW_BOX = 70;
  let snow: THREE.Points | null = null;
  let flakes: Float32Array | null = null;
  if (biome === "hiver" && detail) {
    flakes = new Float32Array(FLAKES * 3);
    for (let k = 0; k < FLAKES; k++) {
      flakes[k * 3] = (hash(k * 1.3) - 0.5) * SNOW_BOX * 2;
      flakes[k * 3 + 1] = hash(k * 2.7) * 40;
      flakes[k * 3 + 2] = (hash(k * 3.9) - 0.5) * SNOW_BOX * 2;
    }
    const snowGeo = keep(new THREE.BufferGeometry());
    snowGeo.setAttribute("position", new THREE.BufferAttribute(flakes, 3));
    const snowMat = keep(
      new THREE.PointsMaterial({
        map: keep(makeParticleTexture("fumee")),
        color: 0xffffff,
        size: 0.32,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      }),
    );
    snow = new THREE.Points(snowGeo, snowMat);
    snow.frustumCulled = false;
    group.add(snow);
  }

  return {
    group,
    ready: terrainPaint.ready,
    fellTree: (index, dx, dz) => {
      if (index < 0 || index >= trees.length || down[index]) return;
      down[index] = 1;
      // Le cap vers lequel il tombe : l'axe x tourne, l'arbre bascule vers +z local.
      falling.push({ i: index, t: 0, yaw: Math.atan2(dx, dz) });
    },
    treeDown: (index) => down[index] === 1,
    update: (dt, time, cam) => {
      for (let k = falling.length - 1; k >= 0; k--) {
        const f = falling[k];
        f.t = Math.min(1, f.t + dt * 1.1);
        // Chute acceleree, qui finit couchee sur le sol.
        const angle = (f.t * f.t * Math.PI) / 2.15;
        trunks.setMatrixAt(f.i, treeMatrix(f.i, angle, f.yaw, false));
        const t = trees[f.i];
        crowns[t.kind].setMatrixAt(crownIndex[f.i], treeMatrix(f.i, angle, f.yaw, true));
        trunks.instanceMatrix.needsUpdate = true;
        crowns[t.kind].instanceMatrix.needsUpdate = true;
        if (f.t >= 1) falling.splice(k, 1);
      }
      for (let k = 0; k < flags.length; k++) {
        flags[k].rotation.y = Math.sin(time * 1.3 + k) * 0.35;
      }
      for (const m of mills) m.blades.rotation.z -= dt * m.speed;
      sky.rotation.y = time * 0.002;
      if (snow && flakes && cam) {
        // Chaque flocon descend en derivant ; sorti de la boite autour de la camera, il y revient.
        snow.position.set(cam.x, cam.y - 20, cam.z);
        for (let k = 0; k < FLAKES; k++) {
          const i = k * 3;
          flakes[i] += Math.sin(time * 0.7 + k) * dt * 0.6 + dt * 0.8;
          flakes[i + 1] -= dt * (1.4 + (k % 5) * 0.12);
          flakes[i + 2] += Math.cos(time * 0.5 + k * 1.7) * dt * 0.5;
          if (flakes[i + 1] < 0) flakes[i + 1] += 40;
          if (flakes[i] > SNOW_BOX) flakes[i] -= SNOW_BOX * 2;
          else if (flakes[i] < -SNOW_BOX) flakes[i] += SNOW_BOX * 2;
          if (flakes[i + 2] > SNOW_BOX) flakes[i + 2] -= SNOW_BOX * 2;
          else if (flakes[i + 2] < -SNOW_BOX) flakes[i + 2] += SNOW_BOX * 2;
        }
        snow.geometry.getAttribute("position").needsUpdate = true;
      }
    },
    dispose: () => {
      for (const d of disposables) d.dispose();
      rocks.dispose();
      trunks.dispose();
      for (const c of crowns) c.dispose();
      bushes.dispose();
    },
  };
}

/** Les quatre ailes d'un moulin : un longeron de bois et une toile tendue sur un cadre. */
function makeMillBlades(): THREE.BufferGeometry {
  const wood = lin(0x4a3726);
  const cloth = lin(0xd9d0bc);
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const spar = paint(new THREE.BoxGeometry(0.24, 9.6, 0.2), () => wood);
    spar.translate(0, 4.9, 0);
    spar.rotateZ(a);
    parts.push(spar);
    const sail = paint(new THREE.BoxGeometry(1.7, 7.4, 0.06), () => cloth);
    sail.translate(0.98, 5.7, 0.08);
    sail.rotateZ(a);
    parts.push(sail);
    // Traverses du cadre.
    for (let s = 0; s < 5; s++) {
      const bar = paint(new THREE.BoxGeometry(1.9, 0.1, 0.1), () => wood);
      bar.translate(0.95, 2.4 + s * 1.7, 0.12);
      bar.rotateZ(a);
      parts.push(bar);
    }
  }
  const hub = paint(new THREE.CylinderGeometry(0.35, 0.45, 0.8, 8), () => wood);
  hub.rotateX(Math.PI / 2);
  parts.push(hub);
  return merge(parts);
}

function heightAtWorld(map: TankMap, x: number, z: number): number {
  const fx = (x + map.world) / HEIGHT_STEP;
  const fz = (z + map.world) / HEIGHT_STEP;
  const i = Math.max(0, Math.min(map.hn - 2, Math.floor(fx)));
  const j = Math.max(0, Math.min(map.hn - 2, Math.floor(fz)));
  const u = fx - i;
  const v = fz - j;
  const h = map.heights;
  const n = map.hn;
  return (
    h[j * n + i] * (1 - u) * (1 - v) + h[j * n + i + 1] * u * (1 - v) + h[(j + 1) * n + i] * (1 - u) * v + h[(j + 1) * n + i + 1] * u * v
  );
}
