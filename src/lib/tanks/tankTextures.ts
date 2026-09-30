import * as THREE from "three";
import { MAP_HALF, WORLD_HALF, WATER_LEVEL, fbm, groundHeight, type TankMap } from "./tankTerrain";
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

/**
 * Le sol vu de loin : une image de tout le terrain dessine (920 m). Herbe
 * plus ou moins seche, roche dans les pentes, champs, routes de terre,
 * paves du village, vase autour du lac, montagnes en bordure.
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
  const span = WORLD_HALF * 2;
  const px = span / size;
  for (let y = y0; y < y1; y++) {
    const z = -WORLD_HALF + (y + 0.5) * px;
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const wx = -WORLD_HALF + (x + 0.5) * px;
      const u = x / size;
      const h = groundHeight(map, wx, z);
      const sx = groundHeight(map, wx + 2, z) - groundHeight(map, wx - 2, z);
      const sz = groundHeight(map, wx, z + 2) - groundHeight(map, wx, z - 2);
      const slope = Math.hypot(sx, sz) / 4;
      const dr = dry(u, v);
      const pt = patch(u, v);
      const g = 0.86 + rnd() * 0.18;
      // Herbe : vert franc au fond des vallons, jaunie sur les hauteurs.
      const sec = Math.min(1, Math.max(0, dr * 1.4 - 0.35 + h * 0.012));
      let r = 88 + sec * 70 + pt * 14;
      let gg = 116 + sec * 40 + pt * 10;
      let b = 52 + sec * 22;
      // Roche dans les pentes raides.
      const rock = Math.min(1, Math.max(0, (slope - 0.45) * 2.5));
      r += (132 - r) * rock;
      gg += (124 - gg) * rock;
      b += (110 - b) * rock;
      // Montagnes de decor : plus de roche, un peu de neige tout en haut.
      const edge = Math.max(Math.abs(wx), Math.abs(z));
      if (edge > MAP_HALF) {
        const k = Math.min(1, (edge - MAP_HALF) / 90);
        r += (122 - r) * k * 0.6;
        gg += (118 - gg) * k * 0.6;
        b += (104 - b) * k * 0.6;
        if (h > 85) {
          const snow = Math.min(1, (h - 85) / 20);
          r += (236 - r) * snow;
          gg += (238 - gg) * snow;
          b += (242 - b) * snow;
        }
      }
      // Rives du lac : vase sombre sous l'eau, sable a la limite (seulement autour du lac).
      if (h < WATER_LEVEL + 1.2 && Math.hypot(wx - map.lake.x, z - map.lake.z) < map.lake.r + 16) {
        const k = Math.min(1, (WATER_LEVEL + 1.2 - h) / 1.6);
        r += (118 - r) * k;
        gg += (104 - gg) * k;
        b += (78 - b) * k;
      }
      const i = (y * size + x) * 4;
      d[i] = r * g;
      d[i + 1] = gg * g;
      d[i + 2] = b * g;
      d[i + 3] = 255;
    }
  }
}

/** Par-dessus l'herbe : champs, village, routes, bases, grain fin. */
function paintOverlays(map: TankMap, ctx: CanvasRenderingContext2D, size: number, rnd: () => number) {
  const span = WORLD_HALF * 2;
  const toPx = (w: number) => ((w + WORLD_HALF) / span) * size;
  const scale = size / span;

  // Champs : bles dores, labours bruns, lavande, en sillons.
  const fieldColors = ["rgba(196,170,92,0.78)", "rgba(126,96,64,0.72)", "rgba(142,128,168,0.6)"];
  for (const f of map.fields) {
    ctx.save();
    ctx.translate(toPx(f.x), toPx(f.z));
    ctx.rotate(((f.x * 7 + f.z * 3) % 10) * 0.03);
    ctx.fillStyle = fieldColors[f.kind % fieldColors.length];
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

  // Le village : paves et terre battue sur le plateau.
  const village = map.houses.find((h) => h.kind === 2);
  if (village) {
    const grd = ctx.createRadialGradient(toPx(village.x - 16), toPx(village.z + 2), 4, toPx(village.x - 16), toPx(village.z + 2), 50 * scale);
    grd.addColorStop(0, "rgba(168,150,122,0.95)");
    grd.addColorStop(0.7, "rgba(160,140,110,0.7)");
    grd.addColorStop(1, "rgba(160,140,110,0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(toPx(village.x - 16), toPx(village.z + 2), 50 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  // Terre battue au pied des maisons.
  ctx.fillStyle = "rgba(140,118,86,0.55)";
  for (const h of map.houses) {
    ctx.fillRect(toPx(h.x - h.w / 2 - 2), toPx(h.z - h.d / 2 - 2), (h.w + 4) * scale, (h.d + 4) * scale);
  }

  // Routes de terre : une bande claire, deux ornieres sombres.
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const road of map.roads) {
    const trace = () => {
      ctx.beginPath();
      road.forEach(([x, z], k) => (k === 0 ? ctx.moveTo(toPx(x), toPx(z)) : ctx.lineTo(toPx(x), toPx(z))));
    };
    trace();
    ctx.strokeStyle = "rgba(150,126,92,0.9)";
    ctx.lineWidth = 7 * scale;
    ctx.stroke();
    trace();
    ctx.strokeStyle = "rgba(118,96,68,0.55)";
    ctx.lineWidth = 3.4 * scale;
    ctx.setLineDash([6 * scale, 3 * scale]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Bases : l'herbe foulee par les chenilles.
  for (const b of map.bases) {
    ctx.fillStyle = "rgba(128,110,80,0.35)";
    ctx.beginPath();
    ctx.arc(toPx(b.x), toPx(b.z), 30 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // Grain fin : mottes, cailloux, touffes.
  for (let k = 0; k < 26000; k++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const dark = rnd() < 0.55;
    ctx.fillStyle = dark ? "rgba(40,48,24,0.16)" : "rgba(220,214,170,0.12)";
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

/** Camouflage peint et use d'un char (repete sur la caisse et la tourelle). */
export function makeCamoTexture(look: CamoPaint, seed: number): THREE.CanvasTexture {
  const S = 256;
  const { canvas, ctx } = canvas2d(S, S);
  const rnd = seeded(seed);
  const base = new THREE.Color(look.color);
  const camo = new THREE.Color(look.camo);
  const camo2 = new THREE.Color(look.camo2 ?? look.camo);
  const css = (c: THREE.Color, a = 1) => `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
  ctx.fillStyle = css(base);
  ctx.fillRect(0, 0, S, S);
  if (look.style === "numerique") {
    // Camouflage numerique : des pixels de 8 px, groupes en grappes par un
    // bruit a deux echelles, avec des bords en escalier (sous-pixels de 4 px).
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
    // Taches aux bords irreguliers : des grappes de disques. Avec une troisieme
    // teinte, des taches plus petites et plus sombres par-dessus (trois tons).
    const three = look.camo2 !== undefined && look.camo2 !== look.camo;
    for (let k = 0; k < (three ? 14 : 9); k++) {
      const cx = rnd() * S;
      const cy = rnd() * S;
      const second = three && k >= 9;
      const r = (second ? 10 : 18) + rnd() * (second ? 16 : 26);
      ctx.fillStyle = css(second ? camo2 : camo);
      for (let i = 0; i < 14; i++) {
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
    ctx.fillStyle = css(camo);
    for (let k = -2; k < 6; k++) {
      ctx.beginPath();
      const y0 = k * 60 + rnd() * 20;
      ctx.moveTo(0, y0);
      for (let x = 0; x <= S; x += 16) ctx.lineTo(x, y0 + x * 0.5 + Math.sin(x * 0.05 + k) * 10);
      for (let x = S; x >= 0; x -= 16) ctx.lineTo(x, y0 + 26 + x * 0.5 + Math.sin(x * 0.06 + k * 2) * 12);
      ctx.closePath();
      ctx.fill();
    }
    if (look.camo2 !== undefined && look.camo2 !== look.camo) {
      ctx.fillStyle = css(camo2);
      for (let k = -2; k < 6; k++) {
        ctx.beginPath();
        const y0 = k * 60 + 38 + rnd() * 10;
        ctx.moveTo(0, y0);
        for (let x = 0; x <= S; x += 16) ctx.lineTo(x, y0 + x * 0.5 + Math.sin(x * 0.07 + k) * 6);
        for (let x = S; x >= 0; x -= 16) ctx.lineTo(x, y0 + 9 + x * 0.5 + Math.sin(x * 0.05 + k * 3) * 5);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  // Usure : taches de boue, poussiere, eclats de peinture.
  for (let k = 0; k < 1400; k++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const t = rnd();
    ctx.fillStyle = t < 0.5 ? "rgba(40,34,26,0.10)" : t < 0.85 ? "rgba(170,150,110,0.10)" : "rgba(210,200,180,0.18)";
    ctx.fillRect(x, y, 1 + rnd() * 3, 1 + rnd() * 3);
  }
  // Lignes de soudure et rivets : on sent les plaques d'acier. Les memes
  // positions que la carte de relief (makeReliefTexture) : la peinture et le
  // relief tombent au meme endroit.
  const seams = seamPositions(seed, S);
  ctx.strokeStyle = "rgba(20,20,16,0.25)";
  ctx.lineWidth = 1;
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
        ctx.arc(p + 4, s, 1.6, 0, Math.PI * 2);
        ctx.arc(s, p + 4, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    for (let k = 0; k < 60; k++) {
      ctx.beginPath();
      ctx.arc(rnd() * S, rnd() * S, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Coulures de rouille sous les rivets.
  for (let k = 0; k < 18; k++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const g = ctx.createLinearGradient(x, y, x, y + 16);
    g.addColorStop(0, "rgba(110,62,30,0.28)");
    g.addColorStop(1, "rgba(110,62,30,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 1, y, 2 + rnd() * 2, 16);
  }
  return finish(canvas, true);
}

/** Position des joints de plaques sur une texture de char (partagee peinture / relief). */
function seamPositions(seed: number, S: number): number[] {
  const rnd = seeded(seed * 7 + 77);
  return [0, 1, 2].map((k) => (k + 1) * (S / 4) + (rnd() - 0.5) * 12);
}

/**
 * Relief de l'acier (carte de bosses, en gris) : grain de fonte, joints de
 * plaques en creux bordes d'un cordon de soudure, rivets, coups et eraflures.
 * Meme repetition que le camouflage, pour que les joints tombent au meme endroit.
 */
export function makeReliefTexture(seed: number, rivets: boolean): THREE.CanvasTexture {
  const S = 256;
  const { canvas, ctx } = canvas2d(S, S);
  const rnd = seeded(seed + 501);
  const grain = noiseField(64, 12, seed + 502, 3);
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
    ctx.fillRect(p - 1, 0, 2, S);
    ctx.fillRect(0, p - 1, S, 2);
    ctx.fillStyle = "rgb(190,190,190)";
    ctx.fillRect(p + 1, 0, 2, S);
    ctx.fillRect(0, p + 1, S, 2);
    if (rivets) {
      for (let s = 4; s < S; s += 11) {
        for (const [x, y] of [
          [p + 4, s],
          [s, p + 4],
        ]) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, 3);
          g.addColorStop(0, "rgb(235,235,235)");
          g.addColorStop(0.6, "rgb(180,180,180)");
          g.addColorStop(1, "rgba(128,128,128,0)");
          ctx.fillStyle = g;
          ctx.fillRect(x - 3, y - 3, 6, 6);
        }
      }
    }
  }
  // Coups d'obus et eraflures : de petits creux ronds et des traits.
  for (let k = 0; k < 14; k++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const r = 2 + rnd() * 4;
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
  for (let k = 0; k < 24; k++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const a = rnd() * Math.PI;
    const l = 6 + rnd() * 18;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
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

/** Mur crepi (maisons) ou en pierre (fermes, eglise) avec une fenetre a volets par carreau. */
export function makeWallTexture(stone: boolean, seed: number): THREE.CanvasTexture {
  const W = 128;
  const H = 128;
  const { canvas, ctx } = canvas2d(W, H);
  const rnd = seeded(seed);
  if (stone) {
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
  // Fenetre et volets verts ou bruns.
  const shutter = rnd() < 0.5 ? "#4f6b4a" : "#6e4a2e";
  ctx.fillStyle = "#1c1a18";
  ctx.fillRect(50, 38, 28, 36);
  ctx.fillStyle = shutter;
  ctx.fillRect(36, 38, 13, 36);
  ctx.fillRect(79, 38, 13, 36);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  for (let s = 0; s < 6; s++) {
    ctx.fillRect(36, 41 + s * 6, 13, 1);
    ctx.fillRect(79, 41 + s * 6, 13, 1);
  }
  ctx.fillStyle = "#cfc2a8";
  ctx.fillRect(46, 74, 36, 4);
  // Salissures en bas du mur.
  const g = ctx.createLinearGradient(0, H - 30, 0, H);
  g.addColorStop(0, "rgba(60,50,30,0)");
  g.addColorStop(1, "rgba(60,50,30,0.35)");
  ctx.fillStyle = g;
  ctx.fillRect(0, H - 30, W, 30);
  return finish(canvas, true);
}

/** Tuiles canal en terre cuite. */
export function makeRoofTexture(): THREE.CanvasTexture {
  const W = 128;
  const H = 128;
  const { canvas, ctx } = canvas2d(W, H);
  const rnd = seeded(77);
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
  return finish(canvas, true);
}

// ------------------------------------------------------------------ ciel

/** Ciel d'ete : bleu profond en haut, voile clair a l'horizon, cumulus epars. */
export function makeSkyTexture(): THREE.CanvasTexture {
  const W = 1024;
  const H = 512;
  const { canvas, ctx } = canvas2d(W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#3f78c4");
  g.addColorStop(0.36, "#78a9dc");
  g.addColorStop(0.5, "#c9dcea");
  g.addColorStop(0.52, "#d8e2e6");
  g.addColorStop(1, "#b7c2c4");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const rnd = seeded(31);
  // Nuages : amas de disques blancs, ombres grises dessous.
  for (let c = 0; c < 26; c++) {
    const cx = rnd() * W;
    const cy = 110 + rnd() * 130;
    const s = 0.5 + rnd() * 1.1;
    for (let k = 0; k < 16; k++) {
      const x = cx + (rnd() - 0.5) * 120 * s;
      const y = cy + (rnd() - 0.5) * 22 * s - Math.abs(x - cx) * 0.08;
      const r = (12 + rnd() * 20) * s;
      for (const ox of [0, W, -W]) {
        const rg = ctx.createRadialGradient(x + ox, y, 0, x + ox, y, r);
        rg.addColorStop(0, "rgba(255,255,255,0.85)");
        rg.addColorStop(0.7, "rgba(245,247,250,0.45)");
        rg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(x + ox, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(150,160,175,0.10)";
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
