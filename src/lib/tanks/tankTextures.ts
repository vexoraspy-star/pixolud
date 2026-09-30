import * as THREE from "three";
import { MAP_HALF, WORLD_HALF, distToPolyline, fbm, heightFromGrid, type Biome, type TankMap } from "./tankTerrain";
import type { CamoStyle } from "./tankDefs";

/** Peinture d'un char : style et couleurs (celles d'origine ou un camouflage du garage). */
export interface CamoPaint {
  style: CamoStyle;
  color: number;
  camo: number;
  camo2?: number;
  /** Caisse rivetee : des rangees de rivets le long des plaques. */
  rivets?: boolean;
}

// Textures de « Tonnerre d'Acier », toutes dessinees au canvas : aucun
// fichier image. Le sol est peint une fois a partir de la carte (herbe,
// champs, routes, village, rives du lac), les chars recoivent un camouflage
// peint et use.

function canvas2d(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext("2d")! };
}

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function finish(canvas: HTMLCanvasElement, repeat = false, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Bruit a basse resolution (0 a 1) lu en bilineaire : le grain du sol sans calculer un fbm par pixel. */
function noiseField(n: number, scale: number, seed: number, octaves = 4): (u: number, v: number) => number {
  const f = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) f[j * n + i] = fbm((i / n) * scale, (j / n) * scale, seed, octaves);
  return (u: number, v: number) => {
    const x = Math.max(0, Math.min(n - 1.001, u * (n - 1)));
    const y = Math.max(0, Math.min(n - 1.001, v * (n - 1)));
    const i = Math.floor(x);
    const j = Math.floor(y);
    const a = f[j * n + i];
    const b = f[j * n + i + 1];
    const c = f[(j + 1) * n + i];
    const d = f[(j + 1) * n + i + 1];
    const s = x - i;
    const t = y - j;
    return a + (b - a) * s + (c - a) * t + (a - b - c + d) * s * t;
  };
}

// ------------------------------------------------------------------- sol

type RGB = [number, number, number];

/** Couleurs du sol d'un climat : herbe (ou neige, ou sable) fraiche et seche, roche, montagnes, rives. */
interface GroundPalette {
  lush: RGB;
  dry: RGB;
  patch: RGB;
  /** Le sol seche (ou se tasse) avec l'altitude. */
  heightDry: number;
  rock: RGB;
  /** Pente a partir de laquelle la roche perce. */
  rockSlope: number;
  /** Part maximale de roche (la neige en recouvre une partie). */
  rockMax: number;
  mountain: RGB;
  snowLine: number;
  shore: RGB;
  /** Champs : ble, labours, lavande ou paturage, colza ou jardins. */
  fields: string[];
  village: [string, string];
  houseFoot: string;
  road: [string, string];
  base: string;
  grain: [string, string];
}

const PALETTES: Record<Biome, GroundPalette> = {
  mediterraneen: {
    lush: [88, 116, 52],
    dry: [158, 156, 74],
    patch: [14, 10, 0],
    heightDry: 0.012,
    rock: [132, 124, 110],
    rockSlope: 0.45,
    rockMax: 1,
    mountain: [122, 118, 104],
    snowLine: 85,
    shore: [118, 104, 78],
    fields: ["rgba(196,170,92,0.78)", "rgba(126,96,64,0.72)", "rgba(142,128,168,0.6)", "rgba(110,140,70,0.6)"],
    village: ["rgba(168,150,122,0.95)", "rgba(160,140,110,0.7)"],
    houseFoot: "rgba(140,118,86,0.55)",
    road: ["rgba(150,126,92,0.9)", "rgba(118,96,68,0.55)"],
    base: "rgba(128,110,80,0.35)",
    grain: ["rgba(40,48,24,0.16)", "rgba(220,214,170,0.12)"],
  },
  hiver: {
    lush: [204, 212, 222],
    dry: [184, 192, 200],
    patch: [8, 8, 8],
    heightDry: -0.004,
    rock: [98, 98, 102],
    rockSlope: 0.4,
    rockMax: 0.78,
    mountain: [128, 130, 136],
    snowLine: 35,
    shore: [150, 144, 128],
    fields: ["rgba(190,196,204,0.5)"],
    village: ["rgba(150,140,128,0.75)", "rgba(170,166,160,0.5)"],
    houseFoot: "rgba(132,120,106,0.55)",
    road: ["rgba(170,164,156,0.85)", "rgba(120,108,96,0.6)"],
    base: "rgba(150,146,140,0.4)",
    grain: ["rgba(90,100,120,0.1)", "rgba(255,255,255,0.22)"],
  },
  desert: {
    lush: [196, 162, 112],
    dry: [178, 134, 86],
    patch: [12, 8, 2],
    heightDry: 0.004,
    rock: [146, 94, 62],
    rockSlope: 0.42,
    rockMax: 1,
    mountain: [158, 110, 78],
    snowLine: Infinity,
    shore: [112, 94, 66],
    fields: ["rgba(200,170,100,0.6)", "rgba(150,110,70,0.6)", "rgba(170,150,90,0.5)", "rgba(88,120,54,0.85)"],
    village: ["rgba(186,154,112,0.9)", "rgba(190,160,118,0.6)"],
    houseFoot: "rgba(170,136,96,0.55)",
    road: ["rgba(206,182,138,0.85)", "rgba(166,134,96,0.55)"],
    base: "rgba(160,130,90,0.35)",
    grain: ["rgba(110,70,40,0.14)", "rgba(250,236,200,0.14)"],
  },
  bocage: {
    lush: [70, 116, 44],
    dry: [118, 138, 60],
    patch: [10, 10, 0],
    heightDry: 0.01,
    rock: [120, 118, 108],
    rockSlope: 0.5,
    rockMax: 1,
    mountain: [104, 112, 92],
    snowLine: 95,
    shore: [104, 92, 66],
    fields: ["rgba(204,176,92,0.8)", "rgba(112,86,60,0.75)", "rgba(96,146,62,0.55)", "rgba(222,200,60,0.75)"],
    village: ["rgba(150,140,124,0.9)", "rgba(140,130,112,0.6)"],
    houseFoot: "rgba(120,106,84,0.55)",
    road: ["rgba(160,146,120,0.9)", "rgba(120,104,80,0.55)"],
    base: "rgba(118,104,76,0.35)",
    grain: ["rgba(30,50,20,0.16)", "rgba(220,230,170,0.1)"],
  },
};

/**
 * Le sol vu de loin : une image de tout le terrain dessine (920 m). Herbe
 * plus ou moins seche (ou neige, ou sable selon la carte), roche dans les
 * pentes, champs, routes de terre, paves du village, rives, glace, montagnes
 * en bordure.
 *
 * Quatre millions de pixels : on les peint par tranches de lignes en rendant
 * la main au navigateur entre deux tranches, pour que la page ne se fige
 * jamais (l'ecran de chargement reste vivant). `ready` se resout quand
 * l'image est complete.
 */
export function paintTerrainTexture(map: TankMap, size = 2048): { texture: THREE.CanvasTexture; ready: Promise<void> } {
  const { canvas, ctx } = canvas2d(size, size);
  const texture = finish(canvas);
  texture.anisotropy = 8;
  const ready = new Promise<void>((resolve) => {
    const img = ctx.createImageData(size, size);
    const rnd = seeded(map.seed + 11);
    const dry = noiseField(256, 9, map.seed + 101);
    const patch = noiseField(256, 26, map.seed + 102, 3);
    let y = 0;
    const slice = () => {
      const end = Math.min(size, y + 40);
      paintRows(map, img.data, size, y, end, rnd, dry, patch);
      y = end;
      if (y < size) {
        setTimeout(slice, 0);
        return;
      }
      ctx.putImageData(img, 0, 0);
      paintOverlays(map, ctx, size, rnd);
      texture.needsUpdate = true;
      resolve();
    };
    slice();
  });
  return { texture, ready };
}

function paintRows(
  map: TankMap,
  d: Uint8ClampedArray,
  size: number,
  y0: number,
  y1: number,
  rnd: () => number,
  dry: (u: number, v: number) => number,
  patch: (u: number, v: number) => number,
) {
  const P = PALETTES[map.biome];
  const span = WORLD_HALF * 2;
  const px = span / size;
  const H = (x: number, z: number) => heightFromGrid(map.heights, map.hn, x, z);
  const wl = map.waterLevel;
  const lake = map.lake;
  for (let y = y0; y < y1; y++) {
    const z = -WORLD_HALF + (y + 0.5) * px;
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const wx = -WORLD_HALF + (x + 0.5) * px;
      const u = x / size;
      const h = H(wx, z);
      const sx = H(wx + 2, z) - H(wx - 2, z);
      const sz = H(wx, z + 2) - H(wx, z - 2);
      const slope = Math.hypot(sx, sz) / 4;
      const dr = dry(u, v);
      const pt = patch(u, v);
      const g = 0.86 + rnd() * 0.18;
      // Sol : frais au fond des vallons, plus sec (ou tasse) sur les hauteurs.
      const sec = Math.min(1, Math.max(0, dr * 1.4 - 0.35 + h * P.heightDry));
      let r = P.lush[0] + (P.dry[0] - P.lush[0]) * sec + pt * P.patch[0];
      let gg = P.lush[1] + (P.dry[1] - P.lush[1]) * sec + pt * P.patch[1];
      let b = P.lush[2] + (P.dry[2] - P.lush[2]) * sec + pt * P.patch[2];
      // Roche dans les pentes raides.
      const rock = Math.min(P.rockMax, Math.max(0, (slope - P.rockSlope) * 2.5));
      r += (P.rock[0] - r) * rock;
      gg += (P.rock[1] - gg) * rock;
      b += (P.rock[2] - b) * rock;
      // Montagnes de decor : plus de roche, de la neige tout en haut.
      const edge = Math.max(Math.abs(wx), Math.abs(z));
      if (edge > MAP_HALF) {
        const k = Math.min(1, (edge - MAP_HALF) / 90);
        r += (P.mountain[0] - r) * k * 0.6;
        gg += (P.mountain[1] - gg) * k * 0.6;
        b += (P.mountain[2] - b) * k * 0.6;
        if (h > P.snowLine) {
          const snow = Math.min(1, (h - P.snowLine) / 20) * (1 - Math.min(1, slope * 0.6));
          r += (236 - r) * snow;
          gg += (238 - gg) * snow;
          b += (242 - b) * snow;
        }
      }
      if (map.biome === "desert" && map.waterKind === "oasis") {
        // Herbe verte et palmeraie autour de la mare.
        const k = 1 - Math.min(1, Math.max(0, (Math.hypot(wx - lake.x, z - lake.z) - lake.r - 6) / 22));
        if (k > 0) {
          r += (92 + pt * 16 - r) * k;
          gg += (120 + pt * 10 - gg) * k;
          b += (56 - b) * k;
        }
      }
      if (map.waterKind === "glace") {
        const dl = Math.hypot(wx - lake.x, z - lake.z);
        if (dl < lake.r + 2 && h < wl + 0.4) {
          // Glace : claire et laiteuse, plus sombre et bleue la ou elle est transparente.
          const clear = Math.max(0, pt * 1.6 - 0.5);
          r = 200 - clear * 56;
          gg = 222 - clear * 38;
          b = 236 - clear * 22;
        } else if (dl < lake.r + 16 && h < wl + 1.2) {
          // Roseaux secs sur la rive.
          const k = Math.min(1, (wl + 1.2 - h) / 1.2);
          r += (P.shore[0] - r) * k;
          gg += (P.shore[1] - gg) * k;
          b += (P.shore[2] - b) * k;
        }
      } else if (h < wl + 1.2) {
        // Rives : vase sombre sous l'eau, sable a la limite (seulement au bord de l'eau).
        const nearWater =
          (lake.r > 0 && Math.hypot(wx - lake.x, z - lake.z) < lake.r + 16) ||
          (map.river !== null && distToPolyline(wx, z, map.river.pts) < map.river.width / 2 + 10);
        if (nearWater) {
          const k = Math.min(1, (wl + 1.2 - h) / 1.6);
          r += (P.shore[0] - r) * k;
          gg += (P.shore[1] - gg) * k;
          b += (P.shore[2] - b) * k;
        }
      }
      const i = (y * size + x) * 4;
      d[i] = r * g;
      d[i + 1] = gg * g;
      d[i + 2] = b * g;
      d[i + 3] = 255;
    }
  }
}

/** Par-dessus le sol : champs, villages, routes, bases, fissures de la glace, grain fin. */
function paintOverlays(map: TankMap, ctx: CanvasRenderingContext2D, size: number, rnd: () => number) {
  const P = PALETTES[map.biome];
  const span = WORLD_HALF * 2;
  const toPx = (w: number) => ((w + WORLD_HALF) / span) * size;
  const scale = size / span;

  // Champs, en sillons.
  for (const f of map.fields) {
    ctx.save();
    ctx.translate(toPx(f.x), toPx(f.z));
    ctx.rotate(((f.x * 7 + f.z * 3) % 10) * 0.03);
    ctx.fillStyle = P.fields[f.kind % P.fields.length];
    ctx.fillRect((-f.w / 2) * scale, (-f.d / 2) * scale, f.w * scale, f.d * scale);
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = 1;
    for (let s = -f.w / 2; s < f.w / 2; s += 2.4) {
      ctx.beginPath();
      ctx.moveTo(s * scale, (-f.d / 2) * scale);
      ctx.lineTo(s * scale, (f.d / 2) * scale);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Les villages : paves et terre battue sur les places.
  for (const v of map.villages) {
    const r = (v.r + 4) * scale;
    const grd = ctx.createRadialGradient(toPx(v.x), toPx(v.z), 4, toPx(v.x), toPx(v.z), r);
    grd.addColorStop(0, P.village[0]);
    grd.addColorStop(0.7, P.village[1]);
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(toPx(v.x), toPx(v.z), r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Terre battue au pied des maisons.
  ctx.fillStyle = P.houseFoot;
  for (const h of map.houses) {
    ctx.fillRect(toPx(h.x - h.w / 2 - 2), toPx(h.z - h.d / 2 - 2), (h.w + 4) * scale, (h.d + 4) * scale);
  }

  // Routes : une bande claire, deux ornieres sombres.
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const road of map.roads) {
    const trace = () => {
      ctx.beginPath();
      road.forEach(([x, z], k) => (k === 0 ? ctx.moveTo(toPx(x), toPx(z)) : ctx.lineTo(toPx(x), toPx(z))));
    };
    trace();
    ctx.strokeStyle = P.road[0];
    ctx.lineWidth = 7 * scale;
    ctx.stroke();
    trace();
    ctx.strokeStyle = P.road[1];
    ctx.lineWidth = 3.4 * scale;
    ctx.setLineDash([6 * scale, 3 * scale]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Bases : le sol foule par les chenilles.
  for (const b of map.bases) {
    ctx.fillStyle = P.base;
    ctx.beginPath();
    ctx.arc(toPx(b.x), toPx(b.z), 30 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // Lac gele : de longues fissures blanches et bleues.
  if (map.waterKind === "glace") {
    const lk = map.lake;
    ctx.save();
    ctx.beginPath();
    ctx.arc(toPx(lk.x), toPx(lk.z), lk.r * scale, 0, Math.PI * 2);
    ctx.clip();
    for (let k = 0; k < 70; k++) {
      let x = lk.x + (rnd() - 0.5) * lk.r * 2;
      let z = lk.z + (rnd() - 0.5) * lk.r * 2;
      let a = rnd() * Math.PI * 2;
      ctx.strokeStyle = rnd() < 0.5 ? "rgba(255,255,255,0.55)" : "rgba(90,130,170,0.4)";
      ctx.lineWidth = 0.6 + rnd() * 1.2;
      ctx.beginPath();
      ctx.moveTo(toPx(x), toPx(z));
      const n = 3 + Math.floor(rnd() * 6);
      for (let s = 0; s < n; s++) {
        a += (rnd() - 0.5) * 1.1;
        const l = 3 + rnd() * 9;
        x += Math.cos(a) * l;
        z += Math.sin(a) * l;
        ctx.lineTo(toPx(x), toPx(z));
      }
      ctx.stroke();
    }
    // Neige soufflee en plaques sur la glace.
    for (let k = 0; k < 40; k++) {
      ctx.fillStyle = "rgba(240,244,248,0.35)";
      ctx.beginPath();
      ctx.ellipse(toPx(lk.x + (rnd() - 0.5) * lk.r * 2), toPx(lk.z + (rnd() - 0.5) * lk.r * 2), (3 + rnd() * 8) * scale, (1.5 + rnd() * 3) * scale, rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Grain fin : mottes, cailloux, touffes (ou cristaux de neige, ou gravier).
  for (let k = 0; k < 26000; k++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const dark = rnd() < 0.55;
    ctx.fillStyle = dark ? P.grain[0] : P.grain[1];
    ctx.fillRect(x, y, 1 + rnd() * 2, 1 + rnd() * 2);
  }
}

/**
 * Detail du sol vu de pres : un carreau de 4 m repete, gris neutre qui
 * MULTIPLIE la couleur (brins, mottes, cailloux). Voir tankWorld.
 */
export function makeGroundDetailTexture(): THREE.CanvasTexture {
  const S = 256;
  const { canvas, ctx } = canvas2d(S, S);
  const rnd = seeded(907);
  const big = noiseField(64, 3, 911, 4);
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const v = 200 + big(x / S, y / S) * 40 + (rnd() - 0.5) * 36;
      const i = (y * S + x) * 4;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // Brins d'herbe et petits cailloux.
  for (let k = 0; k < 900; k++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const l = 2 + rnd() * 5;
    const a = -Math.PI / 2 + (rnd() - 0.5) * 1.2;
    ctx.strokeStyle = rnd() < 0.5 ? "rgba(90,90,90,0.35)" : "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  for (let k = 0; k < 120; k++) {
    ctx.fillStyle = `rgba(${rnd() < 0.5 ? "70,70,70" : "250,250,250"},0.3)`;
    ctx.beginPath();
    ctx.arc(rnd() * S, rnd() * S, 0.8 + rnd() * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(canvas, true, false);
}

// ----------------------------------------------------------------- chars

/**
 * Camouflage peint et use d'un char (repete sur la caisse et la tourelle,
 * un carreau de 512 px pour 4 m) : taches, bandes ou pixels, poussiere,
 * eclats de peinture, joints et rivets, coulures de rouille et de crasse.
 */
export function makeCamoTexture(look: CamoPaint, seed: number): THREE.CanvasTexture {
  const S = 512;
  const k = S / 256;
  const { canvas, ctx } = canvas2d(S, S);
  const rnd = seeded(seed);
  const base = new THREE.Color(look.color);
  const camo = new THREE.Color(look.camo);
  const camo2 = new THREE.Color(look.camo2 ?? look.camo);
  const css = (c: THREE.Color, a = 1) => `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
  ctx.fillStyle = css(base);
  ctx.fillRect(0, 0, S, S);
  // Teinte irreguliere de la peinture de fond : plus claire et plus sombre par plaques.
  const tone = noiseField(64, 6, seed + 1, 3);
  for (let y = 0; y < S; y += 8) {
    for (let x = 0; x < S; x += 8) {
      const v = tone(x / S, y / S) - 0.5;
      ctx.fillStyle = v > 0 ? `rgba(255,250,235,${v * 0.16})` : `rgba(20,18,12,${-v * 0.2})`;
      ctx.fillRect(x, y, 8, 8);
    }
  }
  if (look.style === "numerique") {
    // Camouflage numerique : des pixels de 3 cm, groupes en grappes par un
    // bruit a deux echelles, avec des bords en escalier.
    const cell = 4;
    const n = S / cell;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        // On lit le bruit par blocs de 2x2 sous-pixels, avec un peu de hasard : les marches.
        const bx = Math.floor(x / 2) + (rnd() < 0.18 ? (rnd() < 0.5 ? -1 : 1) : 0);
        const by = Math.floor(y / 2) + (rnd() < 0.18 ? (rnd() < 0.5 ? -1 : 1) : 0);
        const a = fbm(bx / 7, by / 7, seed + 3, 3);
        const b = fbm(bx / 4 + 40, by / 4 + 17, seed + 9, 3);
        let c: THREE.Color | null = null;
        if (a > 0.57) c = camo;
        else if (b > 0.6) c = camo2;
        else if (a < 0.36 && b < 0.42) c = camo2;
        if (c) {
          ctx.fillStyle = css(c);
          ctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }
    }
  } else if (look.style === "taches") {
    // Taches aux bords irreguliers (un demi-metre a un metre et demi) : des
    // grappes de disques. Avec une troisieme teinte, des taches plus petites
    // et plus sombres par-dessus (trois tons).
    const three = look.camo2 !== undefined && look.camo2 !== look.camo;
    const count = three ? 20 : 13;
    for (let p = 0; p < count; p++) {
      const cx = rnd() * S;
      const cy = rnd() * S;
      const second = three && p >= 13;
      const r = ((second ? 10 : 18) + rnd() * (second ? 16 : 26)) * k * 1.2;
      ctx.fillStyle = css(second ? camo2 : camo);
      for (let i = 0; i < 18; i++) {
        const a = rnd() * Math.PI * 2;
        const dist = rnd() * r;
        for (const [ox, oy] of [
          [0, 0],
          [S, 0],
          [-S, 0],
          [0, S],
          [0, -S],
        ]) {
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * dist + ox, cy + Math.sin(a) * dist + oy, r * (0.35 + rnd() * 0.3), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  } else if (look.style === "bandes") {
    // Bandes ondulees en diagonale, et une deuxieme teinte plus fine.
    const step = 90 * k;
    ctx.fillStyle = css(camo);
    for (let b = -3; b < S / step + 2; b++) {
      ctx.beginPath();
      const y0 = b * step + rnd() * 20 * k;
      ctx.moveTo(0, y0);
      for (let x = 0; x <= S; x += 16) ctx.lineTo(x, y0 + x * 0.5 + Math.sin(x * 0.025 + b) * 14 * k);
      for (let x = S; x >= 0; x -= 16) ctx.lineTo(x, y0 + 36 * k + x * 0.5 + Math.sin(x * 0.03 + b * 2) * 16 * k);
      ctx.closePath();
      ctx.fill();
    }
    if (look.camo2 !== undefined && look.camo2 !== look.camo) {
      ctx.fillStyle = css(camo2);
      for (let b = -3; b < S / step + 2; b++) {
        ctx.beginPath();
        const y0 = b * step + 56 * k + rnd() * 10 * k;
        ctx.moveTo(0, y0);
        for (let x = 0; x <= S; x += 16) ctx.lineTo(x, y0 + x * 0.5 + Math.sin(x * 0.035 + b) * 8 * k);
        for (let x = S; x >= 0; x -= 16) ctx.lineTo(x, y0 + 13 * k + x * 0.5 + Math.sin(x * 0.025 + b * 3) * 7 * k);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  // Usure : taches de boue, poussiere, eclats de peinture (le metal apparait).
  for (let p = 0; p < 5600; p++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const t = rnd();
    ctx.fillStyle = t < 0.5 ? "rgba(40,34,26,0.10)" : t < 0.85 ? "rgba(170,150,110,0.10)" : "rgba(210,200,180,0.18)";
    ctx.fillRect(x, y, 1 + rnd() * 3, 1 + rnd() * 3);
  }
  for (let p = 0; p < 60; p++) {
    // Eclats : un point d'acier nu cerne de peinture soulevee.
    const x = rnd() * S;
    const y = rnd() * S;
    const r = 1.5 + rnd() * 3;
    ctx.fillStyle = "rgba(230,222,200,0.14)";
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.4, r, rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(70,70,68,0.7)";
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.8, r * 0.55, rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Lignes de soudure et rivets : on sent les plaques d'acier. Les memes
  // positions que la carte de relief (makeReliefTexture) : la peinture et le
  // relief tombent au meme endroit.
  const seams = seamPositions(seed, S);
  ctx.strokeStyle = "rgba(20,20,16,0.28)";
  ctx.lineWidth = 1.5;
  for (const p of seams) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, S);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(S, p);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(18,18,14,0.35)";
  if (look.rivets) {
    // Caisse rivetee : des rangees regulieres le long des plaques.
    for (const p of seams) {
      for (let s = 4; s < S; s += 11) {
        ctx.beginPath();
        ctx.arc(p + 5, s, 1.8, 0, Math.PI * 2);
        ctx.arc(s, p + 5, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    for (let p = 0; p < 240; p++) {
      ctx.beginPath();
      ctx.arc(rnd() * S, rnd() * S, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Coulures de rouille sous les rivets et de crasse sous les joints.
  for (let p = 0; p < 50; p++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const l = 20 + rnd() * 26;
    const g = ctx.createLinearGradient(x, y, x, y + l);
    g.addColorStop(0, "rgba(110,62,30,0.3)");
    g.addColorStop(1, "rgba(110,62,30,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 1, y, 2 + rnd() * 2, l);
  }
  for (let p = 0; p < 40; p++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const l = 40 + rnd() * 60;
    const g = ctx.createLinearGradient(x, y, x, y + l);
    g.addColorStop(0, "rgba(30,26,20,0.16)");
    g.addColorStop(1, "rgba(30,26,20,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 3, y, 4 + rnd() * 6, l);
  }
  return finish(canvas, true);
}

/** Position des joints de plaques sur une texture de char (partagee peinture / relief), en fraction du carreau. */
function seamPositions(seed: number, S: number): number[] {
  const rnd = seeded(seed * 7 + 77);
  return [0, 1, 2].map((k) => ((k + 1) / 4 + (rnd() - 0.5) * 0.047) * S);
}

/**
 * Relief de l'acier (carte de bosses, en gris) : grain de fonte, joints de
 * plaques en creux bordes d'un cordon de soudure, rivets, coups et eraflures.
 * Meme repetition que le camouflage, pour que les joints tombent au meme endroit.
 */
export function makeReliefTexture(seed: number, rivets: boolean): THREE.CanvasTexture {
  const S = 512;
  const { canvas, ctx } = canvas2d(S, S);
  const rnd = seeded(seed + 501);
  const grain = noiseField(128, 22, seed + 502, 3);
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const v = 128 + (grain(x / S, y / S) - 0.5) * 34 + (rnd() - 0.5) * 10;
      const i = (y * S + x) * 4;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // Joints : un creux, et le cordon de soudure en relief a cote.
  for (const p of seamPositions(seed, S)) {
    ctx.fillStyle = "rgb(70,70,70)";
    ctx.fillRect(p - 1.5, 0, 3, S);
    ctx.fillRect(0, p - 1.5, S, 3);
    ctx.fillStyle = "rgb(190,190,190)";
    ctx.fillRect(p + 1.5, 0, 3, S);
    ctx.fillRect(0, p + 1.5, S, 3);
    if (rivets) {
      for (let s = 4; s < S; s += 11) {
        for (const [x, y] of [
          [p + 5, s],
          [s, p + 5],
        ]) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, 3.5);
          g.addColorStop(0, "rgb(235,235,235)");
          g.addColorStop(0.6, "rgb(180,180,180)");
          g.addColorStop(1, "rgba(128,128,128,0)");
          ctx.fillStyle = g;
          ctx.fillRect(x - 3.5, y - 3.5, 7, 7);
        }
      }
    }
  }
  // Coups d'obus et eraflures : de petits creux ronds et des traits.
  for (let p = 0; p < 40; p++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const r = 2 + rnd() * 5;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgb(60,60,60)");
    g.addColorStop(0.7, "rgb(110,110,110)");
    g.addColorStop(1, "rgba(128,128,128,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(90,90,90,0.8)";
  ctx.lineWidth = 1;
  for (let p = 0; p < 80; p++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const a = rnd() * Math.PI;
    const l = 8 + rnd() * 26;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  return finish(canvas, true, false);
}

/**
 * Crasse des chars : un bruit contraste (0 a 1) qui decoupe la boue, la
 * poussiere et les brulures des epaves en plaques irregulieres.
 */
export function makeGrimeTexture(): THREE.CanvasTexture {
  const S = 256;
  const { canvas, ctx } = canvas2d(S, S);
  const rnd = seeded(733);
  const big = noiseField(64, 5, 737, 4);
  const fine = noiseField(128, 23, 739, 3);
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n = big(x / S, y / S) * 0.7 + fine(x / S, y / S) * 0.3;
      const v = Math.max(0, Math.min(255, (n - 0.5) * 2.6 * 255 + 128 + (rnd() - 0.5) * 30));
      const i = (y * S + x) * 4;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // Eclaboussures : des gouttes plus marquees.
  for (let p = 0; p < 220; p++) {
    ctx.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.4})`;
    ctx.beginPath();
    ctx.arc(rnd() * S, rnd() * S, 0.8 + rnd() * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(canvas, true, false);
}

/**
 * Numero tactique peint au pochoir sur les flancs de tourelle (fond
 * transparent), un peu use.
 */
export function makeNumberTexture(text: string, color: string, seed: number): THREE.CanvasTexture {
  const W = 128;
  const H = 64;
  const { canvas, ctx } = canvas2d(W, H);
  const rnd = seeded(seed);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = color;
  ctx.font = "bold 46px 'Arial Black', Impact, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, W / 2, H / 2 + 2);
  // Ponts du pochoir et peinture ecaillee : on efface par endroits.
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillRect(0, H / 2 - 1, W, 2);
  for (let k = 0; k < 60; k++) {
    ctx.beginPath();
    ctx.arc(rnd() * W, rnd() * H, 0.6 + rnd() * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  return finish(canvas, false);
}

/** Maillons de chenille : patins d'acier et crampons, a faire defiler. */
export function makeTrackTexture(): THREE.CanvasTexture {
  // Un patin par carreau : largeur de la chenille en u, un maillon en v.
  const W = 128;
  const H = 64;
  const { canvas, ctx } = canvas2d(W, H);
  const rnd = seeded(41);
  ctx.fillStyle = "#1f1d1a";
  ctx.fillRect(0, 0, W, H);
  // Le patin : acier bombe, plus clair au centre.
  const g = ctx.createLinearGradient(0, 4, 0, H - 12);
  g.addColorStop(0, "#4a463f");
  g.addColorStop(0.45, "#6d675c");
  g.addColorStop(1, "#3c3833");
  ctx.fillStyle = g;
  ctx.fillRect(3, 4, W - 6, H - 16);
  // Crampons : deux barres en relief en travers du patin.
  for (const y of [12, 30]) {
    ctx.fillStyle = "#2b2824";
    ctx.fillRect(6, y + 5, W - 12, 3);
    ctx.fillStyle = "#86806f";
    ctx.fillRect(6, y, W - 12, 5);
    ctx.fillStyle = "rgba(210,200,175,0.35)";
    ctx.fillRect(6, y, W - 12, 1);
  }
  // Guides centraux et axe d'articulation.
  ctx.fillStyle = "#57524a";
  ctx.fillRect(W / 2 - 7, 6, 14, H - 20);
  ctx.fillStyle = "#2a2723";
  ctx.fillRect(0, H - 12, W, 8);
  ctx.fillStyle = "#77716a";
  for (const x of [8, W - 16]) ctx.fillRect(x, H - 11, 8, 6);
  // Terre coincee dans les patins et acier poli par le frottement.
  for (let k = 0; k < 220; k++) {
    ctx.fillStyle = rnd() < 0.7 ? "rgba(92,74,48,0.35)" : "rgba(200,192,170,0.25)";
    ctx.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 3, 1 + rnd() * 2);
  }
  const t = finish(canvas, true);
  return t;
}

// -------------------------------------------------------------- batiments

/** Murs : crepi, pierre, planches de chalet, terre crue (adobe) ou briques. */
export type WallStyle = "crepi" | "pierre" | "bois" | "adobe" | "brique";
/** Toits : tuiles canal, tuiles enneigees, ardoise, ou toit plat en terre. */
export type RoofStyle = "tuiles" | "neige" | "ardoise" | "terre";

/** Un mur avec une fenetre par carreau (4 m sur 3,2 m), selon le style. */
export function makeWallTexture(style: WallStyle, seed: number): THREE.CanvasTexture {
  const W = 128;
  const H = 128;
  const { canvas, ctx } = canvas2d(W, H);
  const rnd = seeded(seed);
  if (style === "pierre") {
    ctx.fillStyle = "#a89c86";
    ctx.fillRect(0, 0, W, H);
    // Moellons irreguliers.
    for (let row = 0; row < 10; row++) {
      let x = -rnd() * 20;
      const y = row * 13;
      while (x < W) {
        const w = 14 + rnd() * 16;
        const v = 140 + rnd() * 40;
        ctx.fillStyle = `rgb(${v},${v - 8},${v - 22})`;
        ctx.fillRect(x + 1, y + 1, w - 2, 11);
        x += w;
      }
    }
  } else if (style === "brique") {
    // Briques rouges en appareil, joints clairs, quelques briques plus sombres.
    ctx.fillStyle = "#b9ad98";
    ctx.fillRect(0, 0, W, H);
    for (let row = 0; row < 16; row++) {
      const y = row * 8;
      for (let x = row % 2 ? -8 : 0; x < W; x += 16) {
        const v = 0.78 + rnd() * 0.3;
        ctx.fillStyle = `rgb(${Math.round(150 * v)},${Math.round(70 * v)},${Math.round(50 * v)})`;
        ctx.fillRect(x + 1, y + 1, 14, 6);
      }
    }
    for (let k = 0; k < 60; k++) {
      ctx.fillStyle = "rgba(40,20,15,0.18)";
      ctx.fillRect(rnd() * W, rnd() * H, 4 + rnd() * 10, 2 + rnd() * 4);
    }
  } else if (style === "bois") {
    // Chalet : soubassement de pierre, puis des madriers horizontaux bruns.
    ctx.fillStyle = "#6a4a30";
    ctx.fillRect(0, 0, W, H);
    for (let row = 0; row < 12; row++) {
      const y = row * 9;
      const v = 0.8 + rnd() * 0.3;
      ctx.fillStyle = `rgb(${Math.round(120 * v)},${Math.round(82 * v)},${Math.round(52 * v)})`;
      ctx.fillRect(0, y + 1, W, 7);
      ctx.fillStyle = "rgba(30,18,10,0.45)";
      ctx.fillRect(0, y + 8, W, 1);
      // Veines et noeuds du bois.
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = "rgba(40,24,12,0.25)";
        ctx.fillRect(rnd() * W, y + 2 + rnd() * 4, 6 + rnd() * 18, 1);
      }
    }
    ctx.fillStyle = "#8a8680";
    ctx.fillRect(0, 108, W, 20);
    for (let x = -rnd() * 10; x < W; x += 12 + rnd() * 8) {
      const v = 120 + rnd() * 40;
      ctx.fillStyle = `rgb(${v},${v},${v - 6})`;
      ctx.fillRect(x + 1, 110, 11, 7);
      ctx.fillRect(x + 6, 119, 11, 7);
    }
  } else if (style === "adobe") {
    // Terre crue : enduit ocre, fissures, taches plus claires.
    const tones = ["#c9a574", "#d2b083", "#bf9866", "#d8bb90"];
    ctx.fillStyle = tones[Math.floor(rnd() * tones.length)];
    ctx.fillRect(0, 0, W, H);
    for (let k = 0; k < 900; k++) {
      ctx.fillStyle = rnd() < 0.5 ? "rgba(110,70,30,0.08)" : "rgba(255,240,210,0.1)";
      ctx.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 5, 2 + rnd() * 4);
    }
    ctx.strokeStyle = "rgba(90,60,30,0.35)";
    ctx.lineWidth = 1;
    for (let k = 0; k < 5; k++) {
      let x = rnd() * W;
      let y = rnd() * H;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 4; s++) {
        x += (rnd() - 0.5) * 14;
        y += 4 + rnd() * 8;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else {
    const tones = ["#d8c7a2", "#e2d4b4", "#cdb58e", "#e8d9bd"];
    ctx.fillStyle = tones[Math.floor(rnd() * tones.length)];
    ctx.fillRect(0, 0, W, H);
    for (let k = 0; k < 700; k++) {
      ctx.fillStyle = rnd() < 0.5 ? "rgba(90,70,40,0.08)" : "rgba(255,255,255,0.1)";
      ctx.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 4, 2 + rnd() * 4);
    }
    // Crepi tombe par endroits : la pierre dessous.
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = "rgba(150,130,100,0.55)";
      ctx.beginPath();
      ctx.ellipse(rnd() * W, 40 + rnd() * 80, 6 + rnd() * 10, 4 + rnd() * 6, rnd(), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (style === "adobe") {
    // Petite fenetre profonde, encadrement blanchi, sans volets.
    ctx.fillStyle = "#e6dcc8";
    ctx.fillRect(52, 40, 24, 30);
    ctx.fillStyle = "#1c1612";
    ctx.fillRect(56, 44, 16, 22);
    ctx.fillStyle = "rgba(120,80,40,0.8)";
    ctx.fillRect(56, 54, 16, 2);
    ctx.fillRect(63, 44, 2, 22);
  } else {
    // Fenetre et volets (verts ou bruns ; rouges sur les chalets).
    const shutter = style === "bois" ? (rnd() < 0.5 ? "#8a2e24" : "#2f4a38") : rnd() < 0.5 ? "#4f6b4a" : "#6e4a2e";
    ctx.fillStyle = "#1c1a18";
    ctx.fillRect(50, 38, 28, 36);
    if (style === "brique") {
      // Linteau de pierre, fenetre a petits carreaux blancs.
      ctx.fillStyle = "#d8d0c0";
      ctx.fillRect(46, 32, 36, 6);
      ctx.fillStyle = "rgba(230,230,230,0.8)";
      ctx.fillRect(63, 38, 2, 36);
      ctx.fillRect(50, 55, 28, 2);
    } else {
      ctx.fillStyle = shutter;
      ctx.fillRect(36, 38, 13, 36);
      ctx.fillRect(79, 38, 13, 36);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      for (let s = 0; s < 6; s++) {
        ctx.fillRect(36, 41 + s * 6, 13, 1);
        ctx.fillRect(79, 41 + s * 6, 13, 1);
      }
    }
    ctx.fillStyle = "#cfc2a8";
    ctx.fillRect(46, 74, 36, 4);
  }
  // Salissures en bas du mur.
  const g = ctx.createLinearGradient(0, H - 30, 0, H);
  g.addColorStop(0, "rgba(60,50,30,0)");
  g.addColorStop(1, "rgba(60,50,30,0.35)");
  ctx.fillStyle = g;
  ctx.fillRect(0, H - 30, W, 30);
  return finish(canvas, true);
}

/** Toit : tuiles canal, tuiles sous la neige, ardoises, ou terre battue d'un toit plat. */
export function makeRoofTexture(style: RoofStyle = "tuiles"): THREE.CanvasTexture {
  const W = 128;
  const H = 128;
  const { canvas, ctx } = canvas2d(W, H);
  const rnd = seeded(77);
  if (style === "ardoise") {
    ctx.fillStyle = "#3c4148";
    ctx.fillRect(0, 0, W, H);
    for (let row = 0; row < 11; row++) {
      for (let col = 0; col < 9; col++) {
        const x = col * 15 + (row % 2) * 7;
        const y = row * 12;
        const v = 0.8 + rnd() * 0.35;
        ctx.fillStyle = `rgb(${Math.round(70 * v)},${Math.round(76 * v)},${Math.round(86 * v)})`;
        ctx.fillRect(x, y, 14, 11);
        ctx.fillStyle = "rgba(10,12,16,0.5)";
        ctx.fillRect(x, y + 10, 14, 1);
      }
    }
    for (let k = 0; k < 80; k++) {
      ctx.fillStyle = "rgba(120,140,90,0.18)";
      ctx.fillRect(rnd() * W, rnd() * H, 3 + rnd() * 5, 2 + rnd() * 3);
    }
    return finish(canvas, true);
  }
  if (style === "terre") {
    ctx.fillStyle = "#b08a5e";
    ctx.fillRect(0, 0, W, H);
    for (let k = 0; k < 1200; k++) {
      ctx.fillStyle = rnd() < 0.5 ? "rgba(90,60,30,0.12)" : "rgba(240,220,180,0.12)";
      ctx.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 4, 2 + rnd() * 4);
    }
    return finish(canvas, true);
  }
  ctx.fillStyle = "#9a4a2c";
  ctx.fillRect(0, 0, W, H);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const x = col * 16 + (row % 2) * 8;
      const y = row * 16;
      const v = 0.8 + rnd() * 0.35;
      const g = ctx.createLinearGradient(x, 0, x + 16, 0);
      g.addColorStop(0, `rgb(${Math.round(120 * v)},${Math.round(52 * v)},${Math.round(32 * v)})`);
      g.addColorStop(0.5, `rgb(${Math.round(190 * v)},${Math.round(96 * v)},${Math.round(60 * v)})`);
      g.addColorStop(1, `rgb(${Math.round(120 * v)},${Math.round(52 * v)},${Math.round(32 * v)})`);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, 15, 15);
      ctx.fillStyle = "rgba(40,20,10,0.35)";
      ctx.fillRect(x, y + 13, 15, 2);
    }
  }
  // Mousse et tuiles plus claires.
  for (let k = 0; k < 160; k++) {
    ctx.fillStyle = rnd() < 0.5 ? "rgba(80,90,50,0.22)" : "rgba(230,190,150,0.18)";
    ctx.fillRect(rnd() * W, rnd() * H, 3 + rnd() * 5, 2 + rnd() * 3);
  }
  if (style === "neige") {
    // Une couche de neige epaisse, quelques tuiles qui percent au bord des rangs.
    ctx.fillStyle = "rgba(236,240,246,0.9)";
    ctx.fillRect(0, 0, W, H);
    for (let k = 0; k < 90; k++) {
      ctx.fillStyle = rnd() < 0.7 ? "rgba(150,90,70,0.35)" : "rgba(200,210,225,0.6)";
      ctx.beginPath();
      ctx.ellipse(rnd() * W, rnd() * H, 2 + rnd() * 6, 1 + rnd() * 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return finish(canvas, true);
}

// ------------------------------------------------------------------ ciel

/** Ciel selon le climat : ete clair, hiver couvert, desert voile de sable, bocage a cumulus. */
export function makeSkyTexture(biome: Biome = "mediterraneen"): THREE.CanvasTexture {
  const W = 1024;
  const H = 512;
  const { canvas, ctx } = canvas2d(W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  const stops: Record<Biome, [number, string][]> = {
    mediterraneen: [
      [0, "#3f78c4"],
      [0.36, "#78a9dc"],
      [0.5, "#c9dcea"],
      [0.52, "#d8e2e6"],
      [1, "#b7c2c4"],
    ],
    hiver: [
      [0, "#7d8ea6"],
      [0.34, "#a8b6c8"],
      [0.5, "#d4dbe3"],
      [0.52, "#dde2e8"],
      [1, "#c4cbd2"],
    ],
    desert: [
      [0, "#3b74bd"],
      [0.3, "#7fb0dc"],
      [0.47, "#d9d2bc"],
      [0.52, "#e6d4b0"],
      [1, "#c8b08a"],
    ],
    bocage: [
      [0, "#3a70c0"],
      [0.36, "#72a6de"],
      [0.5, "#c6dbec"],
      [0.52, "#d4e0e8"],
      [1, "#b0bec4"],
    ],
  };
  for (const [at, c] of stops[biome]) g.addColorStop(at, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const rnd = seeded(31);
  // Nuages : amas de disques blancs (gris sous un ciel d'hiver), ombres dessous.
  const clouds = biome === "desert" ? 8 : biome === "hiver" ? 44 : biome === "bocage" ? 34 : 26;
  const white = biome === "hiver" ? "rgba(232,236,242,0.8)" : "rgba(255,255,255,0.85)";
  const mid = biome === "hiver" ? "rgba(214,220,228,0.45)" : "rgba(245,247,250,0.45)";
  for (let c = 0; c < clouds; c++) {
    const cx = rnd() * W;
    const cy = (biome === "hiver" ? 60 : 110) + rnd() * (biome === "hiver" ? 190 : 130);
    const s = (0.5 + rnd() * 1.1) * (biome === "hiver" ? 1.5 : 1);
    const flat = biome === "desert" ? 0.35 : 1;
    for (let k = 0; k < 16; k++) {
      const x = cx + (rnd() - 0.5) * 120 * s;
      const y = cy + ((rnd() - 0.5) * 22 * s - Math.abs(x - cx) * 0.08) * flat;
      const r = (12 + rnd() * 20) * s * (biome === "desert" ? 0.7 : 1);
      for (const ox of [0, W, -W]) {
        const rg = ctx.createRadialGradient(x + ox, y, 0, x + ox, y, r);
        rg.addColorStop(0, white);
        rg.addColorStop(0.7, mid);
        rg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(x + ox, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = biome === "hiver" ? "rgba(120,130,145,0.14)" : "rgba(150,160,175,0.10)";
        ctx.beginPath();
        ctx.arc(x + ox, y + r * 0.35, r * 0.8, 0, Math.PI);
        ctx.fill();
      }
    }
  }
  return finish(canvas);
}

/** Tache douce (fumee, poussiere) ou eclair (flamme), pour les particules. */
export function makeParticleTexture(kind: "fumee" | "feu"): THREE.CanvasTexture {
  const S = 64;
  const { canvas, ctx } = canvas2d(S, S);
  const rnd = seeded(kind === "feu" ? 5 : 3);
  if (kind === "feu") {
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, "rgba(255,255,230,1)");
    g.addColorStop(0.3, "rgba(255,200,90,0.9)");
    g.addColorStop(0.65, "rgba(240,110,30,0.45)");
    g.addColorStop(1, "rgba(200,60,10,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  } else {
    for (let k = 0; k < 10; k++) {
      const x = S / 2 + (rnd() - 0.5) * 18;
      const y = S / 2 + (rnd() - 0.5) * 18;
      const r = 14 + rnd() * 14;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(255,255,255,0.35)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return finish(canvas, false, false);
}
