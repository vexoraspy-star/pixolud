import * as THREE from "three";
import type { DuelTheme } from "./duel";
import type { IslandMap } from "./duelIsland";

// Textures des cartes du Duel, dessinees au canvas : aucune image externe.
//
// Chaque matiere est peinte comme un decorateur de cinema la peindrait : une
// couleur de fond, un bruit fractal pour les variations de ton, puis la
// structure (joints, planches, dalles, nervures), l'usure (eclats, fissures,
// rouille) et enfin la salissure (coulures depuis le haut, poussiere au pied).
//
// Tous les tirages sont a graine : une carte garde exactement le meme visage
// d'une partie a l'autre. Le bruit est periodique, les textures se repetent
// donc sans couture.
//
// Proportions : une face de mur fait 1,9 m de large sur 3,4 m de haut, d'ou
// les canevas de 288 x 512 (memes proportions, pixels carres).

type Ctx = CanvasRenderingContext2D;
type RGB = readonly [number, number, number];

// ---------------------------------------------------------------------------
// Outils de peinture
// ---------------------------------------------------------------------------

function canvas2d(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  // On relit souvent les pixels (bruit, ecaillage) : canevas garde en memoire vive.
  return { canvas, ctx: canvas.getContext("2d", { willReadFrequently: true })! };
}

/** Texture repetable en sRGB ; un peu de filtrage anisotrope pour les sols et les murs rasants. */
function finish(canvas: HTMLCanvasElement, rx = 1, ry = 1, aniso = 4): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

/**
 * Les textures peintes sont gardees en memoire vive pour la duree de la page :
 * rejouer une partie ne repeint rien (la ville du desert en compte une
 * trentaine). Chaque appel rend un CLONE, que la scene peut liberer sans
 * toucher a l'original ; seul le canevas est partage.
 */
const PAINTED = new Map<string, THREE.CanvasTexture>();
function memo(key: string, paint: () => THREE.CanvasTexture): THREE.CanvasTexture {
  let t = PAINTED.get(key);
  if (!t) {
    t = paint();
    PAINTED.set(key, t);
  }
  return t.clone();
}

/** Tirage pseudo-aleatoire a graine (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const css = (c: RGB, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** Transition douce de 0 a 1 entre e0 et e1 (e0 > e1 donne la transition inverse). */
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const shadeRGB = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
const jitter = (c: RGB, rand: () => number, amount: number): RGB => shadeRGB(c, 1 + (rand() - 0.5) * amount);

/**
 * Bruit fractal PERIODIQUE sur une grille w x h (octaves de bruit de valeur),
 * ramene entre 0 et 1. `cellsX` x `cellsY` mailles pour la premiere octave :
 * peu de mailles = grandes taches, beaucoup = grain fin.
 */
function fbm(w: number, h: number, seed: number, cellsX: number, cellsY: number, octaves = 4, gain = 0.5): Float32Array {
  const out = new Float32Array(w * h);
  const rand = seeded(seed);
  let amp = 1;
  for (let o = 0; o < octaves; o++) {
    const cx = cellsX << o;
    const cy = cellsY << o;
    const lat = new Float32Array(cx * cy);
    for (let i = 0; i < lat.length; i++) lat[i] = rand();
    const kx = cx / w;
    const ky = cy / h;
    for (let y = 0; y < h; y++) {
      const fy = y * ky;
      const y0 = Math.floor(fy);
      let t = fy - y0;
      const sy = t * t * (3 - 2 * t);
      const r0 = (y0 % cy) * cx;
      const r1 = ((y0 + 1) % cy) * cx;
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const fx = x * kx;
        const x0 = Math.floor(fx);
        t = fx - x0;
        const sx = t * t * (3 - 2 * t);
        const c0 = x0 % cx;
        const c1 = (x0 + 1) % cx;
        const a = lat[r0 + c0] + (lat[r0 + c1] - lat[r0 + c0]) * sx;
        const b = lat[r1 + c0] + (lat[r1 + c1] - lat[r1 + c0]) * sx;
        out[row + x] += (a + (b - a) * sy) * amp;
      }
    }
    amp *= gain;
  }
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < out.length; i++) {
    if (out[i] < min) min = out[i];
    if (out[i] > max) max = out[i];
  }
  const k = 1 / Math.max(1e-6, max - min);
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - min) * k;
  return out;
}

/** Passe pixel par pixel : `fn` modifie directement (r, g, b, a) du pixel `p`. */
function pixels(ctx: Ctx, w: number, h: number, fn: (d: Uint8ClampedArray, i: number, p: number) => void): void {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const n = w * h;
  for (let p = 0, i = 0; p < n; p++, i += 4) fn(d, i, p);
  ctx.putImageData(img, 0, 0);
}

/** Module la luminosite par un bruit : les variations de ton d'une vraie matiere. */
function tone(ctx: Ctx, w: number, h: number, field: Float32Array, amount: number): void {
  pixels(ctx, w, h, (d, i, p) => {
    const k = 1 + (field[p] - 0.5) * amount;
    d[i] *= k;
    d[i + 1] *= k;
    d[i + 2] *= k;
  });
}

/** Grain fin, pixel par pixel. */
function grain(ctx: Ctx, w: number, h: number, seed: number, amount: number): void {
  const rand = seeded(seed);
  pixels(ctx, w, h, (d, i) => {
    const n = (rand() - 0.5) * amount * 255;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  });
}

/** Tache une couleur la ou le bruit depasse un seuil (rouille, salpetre, sable). */
function stain(ctx: Ctx, w: number, h: number, field: Float32Array, from: number, to: number, c: RGB, strength: number): void {
  pixels(ctx, w, h, (d, i, p) => {
    const a = smooth(from, to, field[p]) * strength;
    if (a <= 0) return;
    d[i] += (c[0] - d[i]) * a;
    d[i + 1] += (c[1] - d[i + 1]) * a;
    d[i + 2] += (c[2] - d[i + 2]) * a;
  });
}

/** Relief : eclaire un champ de hauteur comme par une lumiere venue d'en haut a gauche. */
function emboss(ctx: Ctx, w: number, h: number, height: Float32Array, strength: number): void {
  pixels(ctx, w, h, (d, i, p) => {
    const x = p % w;
    const y = (p / w) | 0;
    const a = height[Math.max(0, y - 1) * w + ((x + w - 1) % w)];
    const b = height[Math.min(h - 1, y + 1) * w + ((x + 1) % w)];
    const k = 1 + (a - b) * strength;
    d[i] *= k;
    d[i + 1] *= k;
    d[i + 2] *= k;
  });
}

/** Fissure ramifiee : trait sombre avec un liseré clair (l'arete eclairee). */
function crack(ctx: Ctx, rand: () => number, x: number, y: number, angle: number, len: number, width: number, depth = 0, alpha = 0.72): void {
  const pts: number[] = [x, y];
  let a = angle;
  let px = x;
  let py = y;
  const steps = Math.max(3, Math.round(len / 7));
  for (let s = 0; s < steps; s++) {
    a += (rand() - 0.5) * 0.8;
    px += Math.cos(a) * (len / steps);
    py += Math.sin(a) * (len / steps);
    pts.push(px, py);
    if (depth < 2 && rand() < 0.1) {
      crack(ctx, rand, px, py, a + (rand() < 0.5 ? -1 : 1) * (0.5 + rand() * 0.6), len * (0.25 + rand() * 0.3), width * 0.7, depth + 1, alpha);
    }
  }
  const path = (ox: number, oy: number) => {
    ctx.beginPath();
    ctx.moveTo(pts[0] + ox, pts[1] + oy);
    for (let k = 2; k < pts.length; k += 2) ctx.lineTo(pts[k] + ox, pts[k + 1] + oy);
  };
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = width;
  path(0.8, 1);
  ctx.strokeStyle = `rgba(255,245,225,${alpha * 0.28})`;
  ctx.stroke();
  path(0, 0);
  ctx.strokeStyle = `rgba(38,27,17,${alpha})`;
  ctx.stroke();
}

/** Coulures verticales depuis le haut (pluie, rouille, suie). */
function streaks(ctx: Ctx, rand: () => number, w: number, count: number, c: RGB, alpha: number, maxLen: number, maxWidth: number, fromY = 0): void {
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const len = maxLen * (0.3 + rand() * 0.7);
    const sw = 1 + rand() * maxWidth;
    const g = ctx.createLinearGradient(0, fromY, 0, fromY + len);
    const a = alpha * (0.4 + rand() * 0.6);
    g.addColorStop(0, css(c, a));
    g.addColorStop(1, css(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x, fromY, sw, len);
    // Raccord : ce qui deborde a droite revient a gauche.
    if (x + sw > w) ctx.fillRect(x - w, fromY, sw, len);
  }
}

/** Salissure qui monte du sol (bas du canevas). */
function footDirt(ctx: Ctx, w: number, h: number, height: number, c: RGB, alpha: number): void {
  const g = ctx.createLinearGradient(0, h - height, 0, h);
  g.addColorStop(0, css(c, 0));
  g.addColorStop(1, css(c, alpha));
  ctx.fillStyle = g;
  ctx.fillRect(0, h - height, w, height);
}

/** Petit caillou ombre : lumiere en haut a gauche, ombre portee en bas a droite. */
function pebble(ctx: Ctx, x: number, y: number, r: number, c: RGB, rot: number): void {
  ctx.fillStyle = "rgba(40,30,20,0.35)";
  ctx.beginPath();
  ctx.ellipse(x + r * 0.35, y + r * 0.4, r, r * 0.75, rot, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, css(shadeRGB(c, 1.25)));
  g.addColorStop(1, css(shadeRGB(c, 0.7)));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.75, rot, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Aiguillage par carte
// ---------------------------------------------------------------------------

/** Mur : l'habillage depend entierement de la carte. */
export function makeArenaWallTexture(theme: DuelTheme = "arene"): THREE.CanvasTexture {
  return memo("mur:" + theme, () => {
    if (theme === "entrepot") return makeWarehouseWall();
    if (theme === "gouffre") return makeRockWall();
    if (theme === "poussiere") return paintPlaster(2, true);
    if (theme === "ile") return makeHouseWall();
    return makeTechWall();
  });
}

/** Sol : une tuile couvre deux cases (3,8 m), assez grand pour ne pas voir la repetition. */
export function makeArenaFloorTexture(width: number, height: number, theme: DuelTheme = "arene"): THREE.CanvasTexture {
  const t = memo("sol:" + theme, () => {
    // Terre battue : la ville y pose ses places dallees, avec leurs bordures.
    if (theme === "poussiere") return paintDesertGround();
    if (theme === "entrepot") return makeConcreteFloor(1, 1);
    if (theme === "gouffre") return makeRockFloor(1, 1);
    if (theme === "ile") return makeSandFloor(1, 1);
    return makeTechFloor(1, 1);
  });
  t.repeat.set(width / 2, height / 2);
  return t;
}

/** Plafond des cartes couvertes. Poussiere et l'ile sont a ciel ouvert (voir makeDuelSkyTexture). */
export function makeArenaCeilingTexture(width: number, height: number, theme: DuelTheme = "arene"): THREE.CanvasTexture {
  if (theme === "poussiere" || theme === "ile") {
    // Jamais affiche en temps normal (ciel ouvert) : une simple teinte de ciel en secours.
    const { canvas, ctx } = canvas2d(4, 4);
    ctx.fillStyle = theme === "poussiere" ? "#9dbbe0" : "#9fd4ff";
    ctx.fillRect(0, 0, 4, 4);
    return finish(canvas);
  }
  const t = memo("plafond:" + theme, () => {
    if (theme === "entrepot") return makeWarehouseCeiling(1, 1);
    if (theme === "gouffre") return makeRockCeiling(1, 1);
    return makeTechCeiling(1, 1);
  });
  t.repeat.set(width / 2, height / 2);
  return t;
}

// ---------------------------------------------------------------------------
// Arene : acier technique
// ---------------------------------------------------------------------------

function makeTechWall(): THREE.CanvasTexture {
  const W = 288;
  const H = 512;
  const rand = seeded(311);
  const { canvas, ctx } = canvas2d(W, H);
  ctx.fillStyle = "#0e1114";
  ctx.fillRect(0, 0, W, H);
  const top = 22;
  const kick = 64;
  const rows = 4;
  const rowH = (H - top - kick) / rows;
  const colW = W / 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < 2; c++) {
      const x = c * colW + 2;
      const y = top + r * rowH + 2;
      const w = colW - 4;
      const h = rowH - 4;
      const base = jitter([60, 68, 79], rand, 0.14);
      ctx.fillStyle = css(base);
      ctx.fillRect(x, y, w, h);
      // Chanfreins : lumiere en haut et a gauche, ombre en bas et a droite.
      ctx.fillStyle = "rgba(255,255,255,0.13)";
      ctx.fillRect(x, y, w, 2);
      ctx.fillRect(x, y, 2, h);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(x, y + h - 3, w, 3);
      ctx.fillRect(x + w - 3, y, 3, h);
      // Panneau interieur embouti.
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 12, y + 12, w - 24, h - 24);
      ctx.strokeStyle = "rgba(255,255,255,0.07)";
      ctx.strokeRect(x + 13, y + 13, w - 24, h - 24);
      // Boulons aux coins.
      for (const [bx, by] of [[x + 7, y + 7], [x + w - 7, y + 7], [x + 7, y + h - 7], [x + w - 7, y + h - 7]]) {
        ctx.fillStyle = "#1a1e23";
        ctx.beginPath();
        ctx.arc(bx + 0.6, by + 0.8, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#8c96a1";
        ctx.beginPath();
        ctx.arc(bx, by, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      // Une grille d'aeration, une plaque signaletique.
      if (r === 2 && c === 0) {
        for (let s = 0; s < 7; s++) {
          ctx.fillStyle = "#12161a";
          ctx.fillRect(x + 28, y + 22 + s * 9, w - 56, 5);
          ctx.fillStyle = "rgba(255,255,255,0.1)";
          ctx.fillRect(x + 28, y + 27 + s * 9, w - 56, 1);
        }
      }
      if (r === 1 && c === 1) {
        ctx.fillStyle = "#c9a23a";
        ctx.fillRect(x + 20, y + 24, 46, 22);
        ctx.fillStyle = "rgba(20,20,20,0.8)";
        for (let l = 0; l < 3; l++) ctx.fillRect(x + 24, y + 28 + l * 6, 20 + rand() * 18, 2);
      }
    }
  }
  // Soubassement en tole larmee et bande de danger.
  ctx.fillStyle = "#2b3037";
  ctx.fillRect(0, H - kick, W, kick);
  for (let y = H - kick + 4; y < H; y += 8) {
    for (let x = ((y / 8) % 2) * 6; x < W; x += 12) {
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(x, y, 5, 1.5);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(x + 1, y + 1.5, 5, 1);
    }
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, H - kick - 12, W, 10);
  ctx.clip();
  ctx.fillStyle = "#c9a23a";
  ctx.fillRect(0, H - kick - 12, W, 10);
  ctx.fillStyle = "#15171a";
  for (let x = -24; x < W + 24; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, H - kick - 2);
    ctx.lineTo(x + 12, H - kick - 12);
    ctx.lineTo(x + 24, H - kick - 12);
    ctx.lineTo(x + 12, H - kick - 2);
    ctx.fill();
  }
  ctx.restore();
  // Bandeau lumineux en haut.
  ctx.fillStyle = "#151c23";
  ctx.fillRect(0, 0, W, top);
  ctx.fillStyle = "rgba(79,216,255,0.35)";
  ctx.fillRect(0, 5, W, 11);
  ctx.fillStyle = "#6fe3ff";
  ctx.fillRect(0, 8, W, 5);
  tone(ctx, W, H, fbm(W, H, 312, 3, 5, 5), 0.3);
  // Rayures d'usure.
  for (let i = 0; i < 60; i++) {
    const x = rand() * W;
    const y = top + rand() * (H - top);
    ctx.strokeStyle = `rgba(200,215,230,${0.05 + rand() * 0.12})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 30, y + (rand() - 0.5) * 8);
    ctx.stroke();
  }
  streaks(ctx, rand, W, 10, [10, 12, 14], 0.25, H * 0.5, 4, top);
  footDirt(ctx, W, H, 90, [20, 18, 16], 0.45);
  grain(ctx, W, H, 313, 0.04);
  return finish(canvas);
}

function makeTechFloor(width: number, height: number): THREE.CanvasTexture {
  const S = 512;
  const rand = seeded(321);
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#0f1215";
  ctx.fillRect(0, 0, S, S);
  const t = S / 4;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const x = c * t + 2;
      const y = r * t + 2;
      const w = t - 4;
      const base = jitter([50, 56, 63], rand, 0.16);
      ctx.fillStyle = css(base);
      ctx.fillRect(x, y, w, w);
      if ((r + c) % 3 === 0) {
        // Tole larmee.
        for (let yy = y + 6; yy < y + w - 4; yy += 10) {
          for (let xx = x + 6 + ((yy / 10) % 2) * 7; xx < x + w - 6; xx += 14) {
            ctx.save();
            ctx.translate(xx, yy);
            ctx.rotate(((xx + yy) / 10) % 2 ? 0.7 : -0.7);
            ctx.fillStyle = "rgba(255,255,255,0.1)";
            ctx.fillRect(-4, -1, 8, 2);
            ctx.fillStyle = "rgba(0,0,0,0.3)";
            ctx.fillRect(-4, 1, 8, 1);
            ctx.restore();
          }
        }
      } else if ((r * 4 + c) % 7 === 3) {
        // Caillebotis d'aeration.
        for (let s = 0; s < 10; s++) {
          ctx.fillStyle = "#0b0d10";
          ctx.fillRect(x + 12, y + 10 + s * 11, w - 24, 6);
        }
      }
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(x, y, w, 2);
      ctx.fillRect(x, y, 2, w);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(x, y + w - 2, w, 2);
      ctx.fillRect(x + w - 2, y, 2, w);
      for (const [bx, by] of [[x + 6, y + 6], [x + w - 6, y + 6], [x + 6, y + w - 6], [x + w - 6, y + w - 6]]) {
        ctx.fillStyle = "#7d8791";
        ctx.beginPath();
        ctx.arc(bx, by, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  tone(ctx, S, S, fbm(S, S, 322, 2, 2, 5), 0.34);
  // Traces de semelles et eraflures.
  for (let i = 0; i < 70; i++) {
    const x = rand() * S;
    const y = rand() * S;
    ctx.strokeStyle = `rgba(210,220,230,${0.04 + rand() * 0.08})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 40, y + (rand() - 0.5) * 40);
    ctx.stroke();
  }
  stain(ctx, S, S, fbm(S, S, 323, 3, 3, 4), 0.62, 0.85, [22, 20, 18], 0.4);
  grain(ctx, S, S, 324, 0.05);
  return finish(canvas, width / 2, height / 2, 8);
}

function makeTechCeiling(width: number, height: number): THREE.CanvasTexture {
  const S = 256;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#12151a";
  ctx.fillRect(0, 0, S, S);
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      ctx.fillStyle = "#1c2027";
      ctx.fillRect(c * 128 + 3, r * 128 + 3, 122, 122);
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(c * 128 + 3, r * 128 + 3, 122, 2);
    }
  }
  // Pave lumineux.
  ctx.fillStyle = "rgba(143,232,255,0.2)";
  ctx.fillRect(34, 98, 188, 60);
  ctx.fillStyle = "#bff3ff";
  ctx.fillRect(44, 112, 168, 32);
  ctx.fillStyle = "rgba(20,30,40,0.35)";
  for (let x = 44; x < 212; x += 21) ctx.fillRect(x, 112, 2, 32);
  tone(ctx, S, S, fbm(S, S, 331, 2, 2, 4), 0.25);
  grain(ctx, S, S, 332, 0.03);
  return finish(canvas, width / 2, height / 2);
}

// ---------------------------------------------------------------------------
// Entrepot : bardage, beton, charpente
// ---------------------------------------------------------------------------

function makeWarehouseWall(): THREE.CanvasTexture {
  const W = 288;
  const H = 512;
  const rand = seeded(411);
  const { canvas, ctx } = canvas2d(W, H);
  const base = H - 150; // 1 m de soubassement en parpaings
  // Bardage nervure : profil trapezoidal repete tous les 36 px (24 cm).
  ctx.fillStyle = "#687672";
  ctx.fillRect(0, 0, W, base);
  pixels(ctx, W, H, (d, i, p) => {
    const y = (p / W) | 0;
    if (y >= base) return;
    const u = (p % W) % 36;
    // crete claire, flancs sombres, fond plat
    const k = u < 6 ? 1.2 : u < 10 ? 0.72 : u < 30 ? 1 : 0.84;
    d[i] *= k;
    d[i + 1] *= k;
    d[i + 2] *= k;
  });
  // Lignes de fixation : une vis par nervure, la rouille coule dessous.
  for (const fy of [40, 180, base - 40]) {
    for (let x = 3; x < W; x += 36) {
      ctx.fillStyle = "#2a2e2c";
      ctx.beginPath();
      ctx.arc(x, fy, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#a7b0ab";
      ctx.beginPath();
      ctx.arc(x - 0.5, fy - 0.5, 1.4, 0, Math.PI * 2);
      ctx.fill();
      if (rand() < 0.45) {
        const len = 20 + rand() * 90;
        const g = ctx.createLinearGradient(0, fy, 0, fy + len);
        g.addColorStop(0, "rgba(128,62,24,0.55)");
        g.addColorStop(1, "rgba(128,62,24,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - 1.5, fy, 3 + rand() * 3, len);
      }
    }
  }
  const rust = fbm(W, H, 412, 4, 7, 5);
  pixels(ctx, W, H, (d, i, p) => {
    const y = (p / W) | 0;
    if (y >= base) return;
    const a = smooth(0.66, 0.86, rust[p]) * 0.7;
    if (a <= 0) return;
    d[i] += (116 - d[i]) * a;
    d[i + 1] += (64 - d[i + 1]) * a;
    d[i + 2] += (34 - d[i + 2]) * a;
  });
  // Bavette de raccord au-dessus du beton.
  ctx.fillStyle = "#7d8886";
  ctx.fillRect(0, base - 8, W, 8);
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(0, base, W, 3);
  // Soubassement : parpaings peints en gris, avec bande de securite.
  ctx.fillStyle = "#5c5f5d";
  ctx.fillRect(0, base, W, H - base);
  for (let row = 0, y = base + 3; y < H; row++, y += 30) {
    const off = row % 2 === 0 ? 0 : 30;
    for (let x = -60 + off; x < W; x += 60) {
      ctx.fillStyle = css(jitter([142, 145, 141], rand, 0.1));
      ctx.fillRect(x + 1.5, y + 1.5, 57, 27);
    }
  }
  ctx.fillStyle = "#c9a227";
  ctx.fillRect(0, base + 6, W, 14);
  ctx.fillStyle = "#1b1a17";
  for (let x = -20; x < W + 20; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, base + 6);
    ctx.lineTo(x + 11, base + 6);
    ctx.lineTo(x + 1, base + 20);
    ctx.lineTo(x - 10, base + 20);
    ctx.closePath();
    ctx.fill();
  }
  tone(ctx, W, H, fbm(W, H, 413, 3, 5, 5), 0.32);
  // La bande jaune est usee par les chariots.
  stain(ctx, W, H, fbm(W, H, 414, 10, 18, 3), 0.7, 0.9, [120, 122, 118], 0.8);
  streaks(ctx, rand, W, 14, [30, 32, 30], 0.2, 220, 5);
  footDirt(ctx, W, H, 80, [40, 36, 30], 0.5);
  grain(ctx, W, H, 415, 0.05);
  return finish(canvas);
}

function makeConcreteFloor(width: number, height: number): THREE.CanvasTexture {
  const S = 512;
  const rand = seeded(421);
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#7c7e7a";
  ctx.fillRect(0, 0, S, S);
  tone(ctx, S, S, fbm(S, S, 422, 2, 2, 6, 0.55), 0.3);
  // Nuages de talochage.
  tone(ctx, S, S, fbm(S, S, 423, 5, 5, 3), 0.12);
  // Joints scies : une dalle par case.
  for (const j of [0, S / 2]) {
    ctx.fillStyle = "rgba(20,20,18,0.7)";
    ctx.fillRect(j, 0, 2, S);
    ctx.fillRect(0, j, S, 2);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(j + 2, 0, 1, S);
    ctx.fillRect(0, j + 2, S, 1);
  }
  // Fissures de retrait partant des joints.
  for (let i = 0; i < 5; i++) {
    const vertical = rand() < 0.5;
    const j = rand() < 0.5 ? 0 : S / 2;
    const x = vertical ? j : rand() * S;
    const y = vertical ? rand() * S : j;
    crack(ctx, rand, x, y, vertical ? (rand() - 0.5) * 1.2 : Math.PI / 2 + (rand() - 0.5) * 1.2, 40 + rand() * 90, 1.2);
  }
  // Taches d'huile.
  for (let i = 0; i < 5; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const r = 14 + rand() * 40;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(28,26,22,0.42)");
    g.addColorStop(0.6, "rgba(28,26,22,0.2)");
    g.addColorStop(1, "rgba(28,26,22,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.5 + rand() * 0.5), rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Traces de pneus de chariot.
  for (let i = 0; i < 3; i++) {
    const y0 = rand() * S;
    ctx.strokeStyle = "rgba(24,24,22,0.1)";
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(-20, y0);
    ctx.bezierCurveTo(S * 0.3, y0 + (rand() - 0.5) * 200, S * 0.7, y0 + (rand() - 0.5) * 200, S + 20, y0 + (rand() - 0.5) * 60);
    ctx.stroke();
  }
  grain(ctx, S, S, 424, 0.06);
  return finish(canvas, width / 2, height / 2, 8);
}

function makeWarehouseCeiling(width: number, height: number): THREE.CanvasTexture {
  const S = 256;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#2a2e33";
  ctx.fillRect(0, 0, S, S);
  // Bac acier nervure.
  for (let y = 0; y < S; y += 16) {
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(0, y, S, 4);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(0, y + 12, S, 3);
  }
  // Lanterneau : le jour tombe du toit.
  ctx.fillStyle = "rgba(200,225,240,0.25)";
  ctx.fillRect(40, 70, 176, 76);
  ctx.fillStyle = "#d7ebf5";
  ctx.fillRect(50, 80, 156, 56);
  ctx.fillStyle = "rgba(40,50,60,0.55)";
  for (let x = 50; x < 206; x += 39) ctx.fillRect(x, 80, 3, 56);
  ctx.fillRect(50, 106, 156, 3);
  // Poutres en I.
  for (const y of [14, 180]) {
    ctx.fillStyle = "#1d2024";
    ctx.fillRect(0, y, S, 22);
    ctx.fillStyle = "#3a3f45";
    ctx.fillRect(0, y, S, 4);
    ctx.fillRect(0, y + 18, S, 4);
  }
  tone(ctx, S, S, fbm(S, S, 431, 2, 2, 4), 0.3);
  grain(ctx, S, S, 432, 0.04);
  return finish(canvas, width / 2, height / 2);
}

// ---------------------------------------------------------------------------
// Gouffre : roche
// ---------------------------------------------------------------------------

/** Champ de hauteur rocheux : strates deformees par le bruit. */
function rockHeight(w: number, h: number, seed: number, cx: number, cy: number, layers: number): Float32Array {
  const f = fbm(w, h, seed, cx, cy, 6, 0.55);
  const out = new Float32Array(w * h);
  for (let p = 0; p < out.length; p++) {
    const y = ((p / w) | 0) / h;
    const s = Math.sin(y * Math.PI * 2 * layers + f[p] * 9) * 0.5 + 0.5;
    out[p] = f[p] * 0.72 + s * 0.28;
  }
  return out;
}

/**
 * Bruit cellulaire PERIODIQUE (Worley) : un point par maille, sur une grille
 * de `cellsX` x `cellsY` mailles. Pour chaque pixel : la maille la plus
 * proche (id), la distance a son point (f1) et l'ecart avec la seconde plus
 * proche (gap = f2 - f1, en pixels : presque nul sur les frontieres).
 */
function cellular(
  w: number,
  h: number,
  seed: number,
  cellsX: number,
  cellsY: number,
  warp?: { dx: Float32Array; dy: Float32Array },
): { id: Int32Array; f1: Float32Array; gap: Float32Array } {
  const rand = seeded(seed);
  const cw = w / cellsX;
  const ch = h / cellsY;
  const fx = new Float32Array(cellsX * cellsY);
  const fy = new Float32Array(cellsX * cellsY);
  for (let j = 0; j < cellsY; j++) {
    for (let i = 0; i < cellsX; i++) {
      fx[j * cellsX + i] = (i + 0.12 + rand() * 0.76) * cw;
      fy[j * cellsX + i] = (j + 0.12 + rand() * 0.76) * ch;
    }
  }
  const id = new Int32Array(w * h);
  const f1 = new Float32Array(w * h);
  const gap = new Float32Array(w * h);
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const p = py * w + px;
      // Domaine deforme : les frontieres ondulent au lieu d'etre droites.
      let x = warp ? px + warp.dx[p] : px;
      let y = warp ? py + warp.dy[p] : py;
      x = ((x % w) + w) % w;
      y = ((y % h) + h) % h;
      const gi = Math.floor(x / cw);
      const gj = Math.floor(y / ch);
      let d1 = Infinity;
      let d2 = Infinity;
      let best = 0;
      for (let dj = -1; dj <= 1; dj++) {
        const cj = gj + dj;
        const jj = (cj + cellsY) % cellsY;
        for (let di = -1; di <= 1; di++) {
          const ci = gi + di;
          const ii = (ci + cellsX) % cellsX;
          const k = jj * cellsX + ii;
          // La maille voisine au-dela du bord est la meme, decalee d'une tuile.
          const ex = fx[k] + (ci - ii) * cw - x;
          const ey = fy[k] + (cj - jj) * ch - y;
          const d = ex * ex + ey * ey;
          if (d < d1) {
            d2 = d1;
            d1 = d;
            best = k;
          } else if (d < d2) d2 = d;
        }
      }
      id[p] = best;
      // Distances au carre pendant la recherche : une seule racine par pixel.
      f1[p] = Math.sqrt(d1);
      gap[p] = Math.sqrt(d2) - f1[p];
    }
  }
  return { id, f1, gap };
}

/**
 * Facettes de roche eclatee : chaque cellule est un plan incline au hasard,
 * eclaire depuis le haut a gauche, un peu bombe ; les frontieres sont des
 * fissures. Rend un facteur de luminosite par pixel.
 */
function rockFacets(
  w: number,
  h: number,
  seed: number,
  cellsX: number,
  cellsY: number,
  strength: number,
  crackWidth: number,
  crackShare: number,
): Float32Array {
  const size = Math.min(w / cellsX, h / cellsY);
  const wa = fbm(w, h, seed + 3, 4, 4, 3);
  const wb = fbm(w, h, seed + 4, 4, 4, 3);
  const amp = size * 0.55;
  const dx = new Float32Array(w * h);
  const dy = new Float32Array(w * h);
  for (let p = 0; p < dx.length; p++) {
    dx[p] = (wa[p] - 0.5) * amp;
    dy[p] = (wb[p] - 0.5) * amp;
  }
  const { id, f1, gap } = cellular(w, h, seed, cellsX, cellsY, { dx, dy });
  // Toutes les frontieres ne cassent pas : les fissures s'ouvrent par endroits.
  const mask = fbm(w, h, seed + 5, 3, 3, 4);
  const rand = seeded(seed + 7);
  const slope = new Float32Array(cellsX * cellsY).map(() => (rand() - 0.5) * 2);
  const out = new Float32Array(w * h);
  for (let p = 0; p < out.length; p++) {
    const s = slope[id[p]];
    // Face tournee vers la lumiere (s > 0) : plus claire ; bombee au centre.
    let k = (1 + s * strength) * (1.06 - Math.min(1, f1[p] / size) * 0.16);
    const g = gap[p];
    const open = smooth(1 - crackShare - 0.08, 1 - crackShare + 0.08, mask[p]);
    if (g < crackWidth) k *= 1 - (0.58 - 0.58 * (g / crackWidth) * (g / crackWidth)) * open;
    // Arete eclairee juste a cote de la fissure, cote lumiere.
    else if (g < crackWidth * 2.2 && s > 0.2) k *= 1 + 0.1 * open;
    out[p] = k;
  }
  return out;
}

function paintRock(
  ctx: Ctx,
  w: number,
  h: number,
  height: Float32Array,
  seed: number,
  dark: RGB,
  light: RGB,
  facets?: Float32Array,
): void {
  const tint = fbm(w, h, seed + 1, 2, 3, 3);
  const ridge = fbm(w, h, seed + 2, 5, 7, 5);
  pixels(ctx, w, h, (d, i, p) => {
    const v = height[p];
    const k = smooth(0.15, 0.9, v);
    // Teinte : brun chaud ou gris froid selon les zones.
    const cool = (tint[p] - 0.5) * 0.25;
    let r = dark[0] + (light[0] - dark[0]) * k;
    const g = dark[1] + (light[1] - dark[1]) * k;
    let b = dark[2] + (light[2] - dark[2]) * k;
    r *= 1 - cool;
    b *= 1 + cool;
    let crackK = 1;
    if (facets) crackK = facets[p];
    else {
      // Diaclases : les creux du bruit « arete » deviennent des fissures sombres.
      const c = Math.abs(ridge[p] - 0.5);
      crackK = c < 0.018 ? 0.45 : c < 0.035 ? 0.75 : 1;
    }
    d[i] = r * crackK;
    d[i + 1] = g * crackK;
    d[i + 2] = b * crackK;
    d[i + 3] = 255;
  });
  emboss(ctx, w, h, height, facets ? 3 : 5);
}

/** Deux echelles de facettes (gros eclats, petits eclats) multipliees. */
function rockFacetsMix(w: number, h: number, seed: number, big: [number, number], small: [number, number], cracks = 0.55): Float32Array {
  const a = rockFacets(w, h, seed, big[0], big[1], 0.26, 2.2, cracks);
  const b = rockFacets(w, h, seed + 31, small[0], small[1], 0.12, 1.2, cracks * 0.5);
  for (let p = 0; p < a.length; p++) a[p] *= 0.35 + 0.65 * b[p];
  // Les petits eclats assombrissent en moyenne : on recentre sur 1.
  let sum = 0;
  for (let p = 0; p < a.length; p++) sum += a[p];
  const k = a.length / sum;
  for (let p = 0; p < a.length; p++) a[p] *= k;
  return a;
}

function makeRockWall(): THREE.CanvasTexture {
  const W = 288;
  const H = 512;
  const rand = seeded(511);
  const { canvas, ctx } = canvas2d(W, H);
  paintRock(ctx, W, H, rockHeight(W, H, 512, 3, 5, 6), 513, [44, 39, 35], [140, 126, 108], rockFacetsMix(W, H, 515, [2, 6], [6, 17]));
  // Veines de mineral clair.
  ctx.strokeStyle = "rgba(170,176,180,0.22)";
  for (let i = 0; i < 6; i++) {
    ctx.lineWidth = 1 + rand() * 2;
    ctx.beginPath();
    let x = rand() * W;
    let y = rand() * H;
    ctx.moveTo(x, y);
    for (let k = 0; k < 8; k++) {
      x += (rand() - 0.3) * 40;
      y += (rand() - 0.5) * 30;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 6; i++) crack(ctx, rand, rand() * W, rand() * H * 0.6, Math.PI / 2 + (rand() - 0.5), 60 + rand() * 120, 1.6);
  // Suintements : la roche est plus sombre et humide en bas.
  footDirt(ctx, W, H, 170, [14, 16, 14], 0.55);
  streaks(ctx, rand, W, 10, [12, 14, 12], 0.25, 260, 4);
  grain(ctx, W, H, 514, 0.06);
  return finish(canvas);
}

function makeRockFloor(width: number, height: number): THREE.CanvasTexture {
  const S = 512;
  const rand = seeded(521);
  const { canvas, ctx } = canvas2d(S, S);
  paintRock(ctx, S, S, fbm(S, S, 522, 3, 3, 6, 0.55), 523, [34, 31, 28], [104, 94, 82], rockFacetsMix(S, S, 526, [4, 5], [12, 14], 0.3));
  // Gravier et cailloux, recopies sur les bords pour le raccord.
  for (let i = 0; i < 420; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const r = 1.5 + rand() * rand() * 9;
    const c = jitter([96, 88, 78], rand, 0.5);
    const rot = rand() * 3;
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      if (x + ox < -12 || x + ox > S + 12 || y + oy < -12 || y + oy > S + 12) continue;
      pebble(ctx, x + ox, y + oy, r, c, rot);
    }
  }
  for (let i = 0; i < 4; i++) crack(ctx, rand, rand() * S, rand() * S, rand() * 6, 50 + rand() * 90, 1.4);
  stain(ctx, S, S, fbm(S, S, 524, 2, 2, 4), 0.65, 0.9, [22, 20, 18], 0.5);
  grain(ctx, S, S, 525, 0.07);
  return finish(canvas, width / 2, height / 2, 8);
}

function makeRockCeiling(width: number, height: number): THREE.CanvasTexture {
  const S = 256;
  const { canvas, ctx } = canvas2d(S, S);
  paintRock(ctx, S, S, fbm(S, S, 532, 2, 2, 6, 0.55), 533, [18, 16, 14], [66, 58, 50], rockFacetsMix(S, S, 535, [3, 3], [8, 8]));
  grain(ctx, S, S, 534, 0.05);
  return finish(canvas, width / 2, height / 2);
}

/** Petite roche pour les blocs poses au sol. */
export function makeBoulderTexture(): THREE.CanvasTexture {
  return memo("rocher", () => paintBoulderTexture());
}

function paintBoulderTexture(): THREE.CanvasTexture {
  const S = 128;
  const { canvas, ctx } = canvas2d(S, S);
  paintRock(ctx, S, S, fbm(S, S, 541, 3, 3, 5, 0.55), 542, [46, 42, 38], [128, 116, 100], rockFacetsMix(S, S, 544, [3, 3], [7, 7]));
  grain(ctx, S, S, 543, 0.06);
  return finish(canvas);
}

// ---------------------------------------------------------------------------
// Poussiere : la ville du desert
// ---------------------------------------------------------------------------

/**
 * Appareil de gres : grands blocs tailles (95 x 42 cm), joints de mortier en
 * creux, aretes egrenees, salpetre qui remonte du sol. Se raccorde a gauche
 * et a droite (les rangees decalees tombent juste sur la largeur).
 *
 * Ce n'est plus une texture a part entiere : c'est la maconnerie que l'on
 * voit la ou l'enduit est tombe (voir paintPlaster). Rend les pixels du
 * canevas W x H, lus ensuite par l'enduit.
 */
function paintSandstone(W: number, H: number, seed: number): Uint8ClampedArray {
  const rand = seeded(1701 + seed);
  const { ctx } = canvas2d(W, H);
  const mortar: RGB = [138, 114, 84];
  ctx.fillStyle = css(mortar);
  ctx.fillRect(0, 0, W, H);
  const rowH = 64;
  const blockW = 144;
  const palette: RGB[] = [
    [208, 176, 130],
    [201, 166, 118],
    [214, 186, 142],
    [194, 158, 110],
    [206, 172, 124],
    [190, 160, 118],
  ];
  const block = (bx: number, by: number, bw: number, bh: number, c: RGB, blockSeed: number) => {
    const r = seeded(blockSeed);
    const j = 2;
    ctx.fillStyle = css(c);
    ctx.fillRect(bx + j, by + j, bw - 2 * j, bh - 2 * j);
    ctx.fillStyle = "rgba(255,244,220,0.22)";
    ctx.fillRect(bx + j, by + j, bw - 2 * j, 2);
    ctx.fillStyle = "rgba(255,244,220,0.1)";
    ctx.fillRect(bx + j, by + j, 2, bh - 2 * j);
    ctx.fillStyle = "rgba(70,48,26,0.32)";
    ctx.fillRect(bx + j, by + bh - j - 3, bw - 2 * j, 3);
    ctx.fillStyle = "rgba(70,48,26,0.18)";
    ctx.fillRect(bx + bw - j - 2, by + j, 2, bh - 2 * j);
    // Traces de taille : fines diagonales.
    ctx.strokeStyle = "rgba(90,64,36,0.07)";
    ctx.lineWidth = 1;
    for (let t = 0; t < 12; t++) {
      const tx = bx + j + 4 + r() * (bw - 20);
      ctx.beginPath();
      ctx.moveTo(tx, by + j + 3);
      ctx.lineTo(tx + 8, by + bh - j - 4);
      ctx.stroke();
    }
    // Coins et aretes egrenes.
    ctx.fillStyle = css(shadeRGB(mortar, 0.92));
    for (let q = 0; q < 4; q++) {
      if (r() > 0.5) continue;
      const cx = q % 2 ? bx + bw - j : bx + j;
      const cy = q < 2 ? by + j : by + bh - j;
      ctx.beginPath();
      ctx.arc(cx, cy, 2 + r() * 6, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let e = 0; e < 3; e++) {
      if (r() > 0.45) continue;
      const ex = bx + j + r() * (bw - 2 * j);
      const top = r() < 0.5;
      const ey = top ? by + j : by + bh - j;
      ctx.beginPath();
      ctx.ellipse(ex, ey, 3 + r() * 9, 2 + r() * 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  const rows = Math.ceil(H / rowH);
  for (let row = 0; row < rows; row++) {
    const y = H - (row + 1) * rowH;
    const off = row % 2 === 0 ? 0 : blockW / 2;
    for (let k = 0; k < W / blockW; k++) {
      const c = jitter(palette[Math.floor(rand() * palette.length)], rand, 0.12);
      const bs = 9000 + seed * 977 + row * 17 + k;
      const x = off + k * blockW;
      block(x, y, blockW, rowH, c, bs);
      // Le bloc qui deborde a droite revient identique a gauche.
      if (x + blockW > W) block(x - W, y, blockW, rowH, c, bs);
    }
  }
  tone(ctx, W, H, fbm(W, H, 1702 + seed, 3, 5, 5), 0.34);
  tone(ctx, W, H, fbm(W, H, 1703 + seed, 12, 21, 3), 0.12);
  // Piqures du gres.
  for (let i = 0; i < (W * H) / 350; i++) {
    ctx.fillStyle = `rgba(80,56,32,${0.12 + rand() * 0.25})`;
    ctx.fillRect(rand() * W, rand() * H, 1 + rand() * 1.5, 1 + rand() * 1.5);
  }
  // Salpetre : un voile blanchatre qui remonte du sol.
  const salt = fbm(W, H, 1704 + seed, 6, 10, 4);
  pixels(ctx, W, H, (d, i, p) => {
    const y = (p / W) | 0;
    const a = smooth(0.5, 0.78, salt[p]) * smooth(H * 0.62, H * 0.95, y) * 0.35;
    if (a <= 0) return;
    d[i] += (236 - d[i]) * a;
    d[i + 1] += (228 - d[i + 1]) * a;
    d[i + 2] += (210 - d[i + 2]) * a;
  });
  streaks(ctx, rand, W, 16, [74, 58, 40], 0.18, H * 0.45, 5);
  footDirt(ctx, W, H, 110, [104, 80, 52], 0.5);
  grain(ctx, W, H, 1705 + seed, 0.07);
  return ctx.getImageData(0, 0, W, H).data;
}

/**
 * Enduit a la chaux, plaque sur les murs de gres. Il est tombe par endroits
 * et laisse voir les blocs de gres (peints dans le trou, en retrait et dans
 * l'ombre du bord de l'enduit), il fissure, coule depuis le haut et se salit
 * en bas. Aucun pixel transparent : un trou transparent sur un materiau
 * opaque sortait NOIR a l'ecran.
 *
 * - Panneau de facade (defaut) : teinte neutre, chaque facade le teinte
 *   (ocre, creme, rose) par la couleur d'instance. Couvre de 0,5 m (au-dessus
 *   du soubassement) jusque sous la corniche : 288 x 420. Pas de trou sur
 *   les bords verticaux (la facade voisine peut etre nue ou enduite).
 * - Mur (`wall`) : la face entiere d'un mur de la grille (1,9 x 3,4 m,
 *   288 x 512), deja ocre, beaucoup plus decrepie : le bas est ronge par
 *   l'humidite et le gres apparait en larges plaques. Se raccorde a gauche et
 *   a droite (murs voisins).
 */
export function makePlasterTexture(variant = 0): THREE.CanvasTexture {
  return memo("enduit:" + variant, () => paintPlaster(variant));
}

function paintPlaster(variant: number, wall = false): THREE.CanvasTexture {
  const k = variant * 101;
  const W = 288;
  const H = wall ? 512 : 420;
  const rand = seeded(2203 + k);
  const { canvas, ctx } = canvas2d(W, H);
  ctx.fillStyle = wall ? "#dcc49c" : "#ecdfc6";
  ctx.fillRect(0, 0, W, H);
  tone(ctx, W, H, fbm(W, H, 2204 + k, 3, 4, 5), 0.24);
  tone(ctx, W, H, fbm(W, H, 2205 + k, 16, 22, 3), 0.08);
  // Coups de taloche : a peine visibles, sinon on voit des cercles.
  for (let i = 0; i < 40; i++) {
    const x = rand() * W;
    const y = rand() * H;
    ctx.strokeStyle = rand() < 0.5 ? "rgba(255,250,240,0.05)" : "rgba(120,96,64,0.035)";
    ctx.lineWidth = 3 + rand() * 6;
    ctx.beginPath();
    ctx.arc(x, y, 14 + rand() * 30, rand() * 6, rand() * 6 + 0.9);
    ctx.stroke();
  }
  // Reprises d'enduit : rectangles d'un ton un peu different.
  for (let i = 0; i < 2; i++) {
    const w = 40 + rand() * 80;
    const h = 30 + rand() * 60;
    ctx.fillStyle = rand() < 0.5 ? "rgba(255,248,232,0.14)" : "rgba(150,122,86,0.09)";
    ctx.fillRect(20 + rand() * (W - w - 40), rand() * (H - h), w, h);
  }
  // Fissures fines : les plus longues partent des angles des ouvertures.
  for (let i = 0; i < 4; i++) {
    crack(ctx, rand, 20 + rand() * (W - 40), rand() * H * 0.8, Math.PI / 2 + (rand() - 0.5) * 1.6, 40 + rand() * 120, 1, 0, 0.5);
  }
  streaks(ctx, rand, W, 14, [104, 84, 58], 0.2, H * 0.55, 6);
  footDirt(ctx, W, H, wall ? 150 : 120, [118, 88, 54], 0.42);
  grain(ctx, W, H, 2206 + k, 0.035);

  // Ce qui reste d'enduit : v < 1 dans un trou, liseré entre 1 et 1,1.
  const holes: { x: number; y: number; r: number }[] = [];
  const n = wall ? 2 + Math.floor(rand() * 2) : 1 + Math.floor(rand() * 2);
  for (let i = 0; i < n; i++) {
    holes.push({ x: W * (wall ? rand() : 0.25 + rand() * 0.5), y: H * (0.2 + rand() * 0.55), r: wall ? 30 + rand() * 46 : 26 + rand() * 40 });
  }
  holes.push({ x: W * 0.8, y: H * 0.08, r: 18 });
  const edge = fbm(W, H, 2207 + k, 6, 8, 4);
  const chips = fbm(W, H, 2208 + k, 18, 26, 3);
  const stone = paintSandstone(W, H, variant);
  pixels(ctx, W, H, (d, i, p) => {
    const x = p % W;
    const y = (p / W) | 0;
    // Bord ebreche : grandes echancrures et petits eclats.
    const wobble = (edge[p] - 0.5) * 0.75 + (chips[p] - 0.5) * 0.45;
    let v = Infinity;
    for (const hole of holes) {
      let dx = Math.abs(x - hole.x);
      if (wall) dx = Math.min(dx, W - dx);
      v = Math.min(v, Math.hypot(dx / (hole.r * 1.3), (y - hole.y) / hole.r) + wobble);
    }
    // Mur : l'humidite qui remonte du sol a ronge l'enduit sur le bas.
    if (wall) v = Math.min(v, 1.45 - 0.95 * smooth(H * 0.6, H * 0.93, y) + wobble * 1.3);
    else if (Math.min(x, W - 1 - x) < 10) v = Math.max(v, 1.2);
    if (v < 1) {
      // Le gres, en retrait : plus sombre pres du bord (ombre de l'enduit).
      const s = 0.7 + 0.3 * smooth(1, 0.86, v);
      d[i] = stone[i] * s;
      d[i + 1] = stone[i + 1] * s;
      d[i + 2] = stone[i + 2] * s;
      d[i + 3] = 255;
    } else if (v < 1.05) {
      // Tranche de l'enduit arrache : un liseré sombre autour du trou.
      d[i] *= 0.76;
      d[i + 1] *= 0.74;
      d[i + 2] *= 0.72;
    }
  });
  const t = finish(canvas, 1, 1, 4);
  if (!wall) {
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
  }
  return t;
}

/** Soubassement : enduit de ciment grossier, eclabousse par la pluie. Clair : teinte par instance. */
export function makePlinthTexture(): THREE.CanvasTexture {
  return memo("soubassement", () => paintPlinthTexture());
}

function paintPlinthTexture(): THREE.CanvasTexture {
  const W = 256;
  const H = 72;
  const rand = seeded(2301);
  const { canvas, ctx } = canvas2d(W, H);
  ctx.fillStyle = "#c2b6a2";
  ctx.fillRect(0, 0, W, H);
  tone(ctx, W, H, fbm(W, H, 2302, 6, 2, 5), 0.34);
  // Lissages horizontaux a la truelle.
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = rand() < 0.5 ? "rgba(255,255,255,0.08)" : "rgba(60,50,40,0.08)";
    ctx.fillRect(rand() * W, rand() * H, 20 + rand() * 60, 1 + rand() * 2);
  }
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(60,46,30,${0.1 + rand() * 0.3})`;
    ctx.fillRect(rand() * W, H * 0.4 + rand() * H * 0.6, 1 + rand() * 2, 1 + rand() * 2);
  }
  // Rejingot : l'arete du haut accroche la lumiere.
  ctx.fillStyle = "rgba(255,250,240,0.3)";
  ctx.fillRect(0, 0, W, 3);
  ctx.fillStyle = "rgba(40,30,20,0.25)";
  ctx.fillRect(0, 3, W, 2);
  footDirt(ctx, W, H, 40, [90, 70, 46], 0.55);
  grain(ctx, W, H, 2303, 0.06);
  return finish(canvas);
}

/** Pierre de taille claire (1 m x 1 m) : arcs, jambages, appuis, bordures. */
export function makeStoneTrimTexture(): THREE.CanvasTexture {
  return memo("pierre", () => paintStoneTrimTexture());
}

function paintStoneTrimTexture(): THREE.CanvasTexture {
  const S = 256;
  const rand = seeded(2401);
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#9c8566";
  ctx.fillRect(0, 0, S, S);
  for (let row = 0; row < 4; row++) {
    const off = row % 2 === 0 ? 0 : 64;
    for (let k = -1; k < 2; k++) {
      const x = off + k * 128;
      const c = jitter([218, 196, 158], rand, 0.14);
      ctx.fillStyle = css(c);
      ctx.fillRect(x + 2, row * 64 + 2, 124, 60);
      ctx.fillStyle = "rgba(255,248,230,0.22)";
      ctx.fillRect(x + 2, row * 64 + 2, 124, 2);
      ctx.fillStyle = "rgba(80,60,36,0.3)";
      ctx.fillRect(x + 2, row * 64 + 59, 124, 3);
    }
  }
  tone(ctx, S, S, fbm(S, S, 2402, 3, 3, 5), 0.3);
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(90,64,38,${0.1 + rand() * 0.25})`;
    ctx.fillRect(rand() * S, rand() * S, 1 + rand() * 2, 1 + rand() * 2);
  }
  grain(ctx, S, S, 2403, 0.06);
  return finish(canvas);
}

/** Bois vieilli (linteaux, poutres, palettes) : fil long, fentes, grisaille. */
export function makeWoodBeamTexture(): THREE.CanvasTexture {
  return memo("poutre", () => paintWoodBeamTexture());
}

function paintWoodBeamTexture(): THREE.CanvasTexture {
  const W = 256;
  const H = 64;
  const rand = seeded(2501);
  const { canvas, ctx } = canvas2d(W, H);
  ctx.fillStyle = "#6e4e32";
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 46; i++) {
    const y0 = rand() * H;
    ctx.strokeStyle = `rgba(${36 + rand() * 30},${22 + rand() * 16},10,${0.2 + rand() * 0.35})`;
    ctx.lineWidth = 1 + rand();
    ctx.beginPath();
    for (let x = 0; x <= W; x += 8) {
      const y = y0 + Math.sin((x / W) * Math.PI * 2 + i) * 2 + Math.sin(x * 0.11 + i) * 0.8;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Fentes de sechage.
  for (let i = 0; i < 4; i++) {
    const y = 8 + rand() * (H - 16);
    const x = rand() * W;
    ctx.fillStyle = "rgba(20,12,6,0.7)";
    ctx.fillRect(x, y, 30 + rand() * 90, 1.5);
  }
  // Grisaille du bois expose au soleil.
  stain(ctx, W, H, fbm(W, H, 2502, 4, 2, 4), 0.45, 0.8, [150, 138, 120], 0.55);
  // Noeud.
  const kx = 40 + rand() * 170;
  const g = ctx.createRadialGradient(kx, H / 2, 1, kx, H / 2, 9);
  g.addColorStop(0, "rgba(30,18,8,0.8)");
  g.addColorStop(1, "rgba(30,18,8,0)");
  ctx.fillStyle = g;
  ctx.fillRect(kx - 10, H / 2 - 10, 20, 20);
  grain(ctx, W, H, 2503, 0.05);
  return finish(canvas);
}

export type DoorStyle = "bleu" | "vert" | "rideau";

/**
 * Porte de 1,05 x 2,15 m : planches peintes et ecaillees (bleu ou vert d'eau),
 * barres cloutees, pentures en fer forge ; ou rideau metallique de boutique.
 */
export function makeDoorTexture(style: DoorStyle): THREE.CanvasTexture {
  return memo("porte:" + style, () => paintDoorTexture(style));
}

function paintDoorTexture(style: DoorStyle): THREE.CanvasTexture {
  const W = 256;
  const H = 512;
  const rand = seeded(style === "bleu" ? 811 : style === "vert" ? 812 : 813);
  const { canvas, ctx } = canvas2d(W, H);
  if (style === "rideau") {
    paintRollShutter(ctx, W, H, rand);
    return finish(canvas, 1, 1, 2);
  }
  const paint: RGB = style === "bleu" ? [44, 100, 150] : [46, 120, 112];
  // 1. Bois nu partout : il se verra la ou la peinture a saute.
  ctx.fillStyle = "#86705a";
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = `rgba(60,46,32,${0.08 + rand() * 0.16})`;
    ctx.fillRect(rand() * W, 0, 1, H);
  }
  // 2. La peinture, ecaillee pres des chants des planches et en bas.
  const plankW = W / 5;
  const chip = fbm(W, H, 814, 5, 10, 5);
  const shade = fbm(W, H, 815, 2, 4, 4);
  const plankTone = [0.96, 1.05, 0.92, 1.02, 0.98];
  pixels(ctx, W, H, (d, i, p) => {
    const x = p % W;
    const y = (p / W) | 0;
    const inPlank = x % plankW;
    const edgeDist = Math.min(inPlank, plankW - inPlank) / plankW;
    const wear = chip[p] - (edgeDist < 0.12 ? (0.12 - edgeDist) * 2.2 : 0) - smooth(0.78, 1, y / H) * 0.3;
    if (wear > 0.4) {
      const k = plankTone[Math.floor(x / plankW)] * (0.86 + shade[p] * 0.28);
      d[i] = paint[0] * k;
      d[i + 1] = paint[1] * k;
      d[i + 2] = paint[2] * k;
    } else if (wear > 0.36) {
      // Bord de l'ecaille : l'epaisseur de peinture fait une ombre.
      d[i] *= 0.62;
      d[i + 1] *= 0.62;
      d[i + 2] *= 0.62;
    }
  });
  // 3. Joints entre planches.
  for (let k = 1; k < 5; k++) {
    ctx.fillStyle = "rgba(14,10,8,0.85)";
    ctx.fillRect(k * plankW - 1.5, 0, 3, H);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(k * plankW + 1.5, 0, 1, H);
  }
  // 4. Barres horizontales cloutees et pentures.
  for (const by of [64, 408]) {
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(0, by + 36, W, 5);
    ctx.fillStyle = css(shadeRGB(paint, 0.9));
    ctx.fillRect(0, by, W, 36);
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fillRect(0, by, W, 2);
    ctx.fillStyle = "#2b2622";
    ctx.beginPath();
    ctx.moveTo(0, by + 8);
    ctx.lineTo(128, by + 12);
    ctx.lineTo(146, by + 18);
    ctx.lineTo(128, by + 24);
    ctx.lineTo(0, by + 28);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(160,150,140,0.5)";
    for (let x = 12; x < 130; x += 26) {
      ctx.beginPath();
      ctx.arc(x, by + 18, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let x = 160; x < W; x += 28) {
      ctx.fillStyle = "#2b2622";
      ctx.beginPath();
      ctx.arc(x, by + 18, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // 5. Anneau de tirage et entree de serrure.
  ctx.strokeStyle = "#221e1b";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(206, 262, 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(200,190,170,0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(205, 261, 14, Math.PI * 1.1, Math.PI * 1.6);
  ctx.stroke();
  ctx.fillStyle = "#221e1b";
  ctx.beginPath();
  ctx.arc(206, 246, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(199, 292, 14, 32);
  ctx.fillStyle = "#050404";
  ctx.fillRect(204, 300, 4, 12);
  // 6. Poussiere au pied, ombre du linteau en haut.
  footDirt(ctx, W, H, 90, [150, 120, 80], 0.55);
  const top = ctx.createLinearGradient(0, 0, 0, 40);
  top.addColorStop(0, "rgba(20,14,8,0.45)");
  top.addColorStop(1, "rgba(20,14,8,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, 40);
  grain(ctx, W, H, 816, 0.05);
  return finish(canvas, 1, 1, 2);
}

/** Rideau metallique de boutique : lames galvanisees, rouille, bosses. */
function paintRollShutter(ctx: Ctx, W: number, H: number, rand: () => number): void {
  ctx.fillStyle = "#979ca0";
  ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < H - 30; y += 18) {
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(0, y, W, 3);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(0, y + 13, W, 4);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, y + 17, W, 1);
  }
  // Glissieres et lame finale avec sa poignee.
  ctx.fillStyle = "#4a4d50";
  ctx.fillRect(0, 0, 10, H);
  ctx.fillRect(W - 10, 0, 10, H);
  ctx.fillStyle = "#6b6f72";
  ctx.fillRect(0, H - 30, W, 18);
  ctx.fillStyle = "#2e3033";
  ctx.fillRect(W / 2 - 24, H - 26, 48, 6);
  const rust = fbm(W, H, 817, 4, 8, 5);
  stain(ctx, W, H, rust, 0.64, 0.85, [118, 66, 34], 0.75);
  streaks(ctx, rand, W, 12, [110, 60, 30], 0.3, 200, 5);
  // Bosses.
  for (let i = 0; i < 5; i++) {
    const x = 20 + rand() * (W - 40);
    const y = 30 + rand() * (H - 80);
    const g = ctx.createRadialGradient(x - 4, y - 4, 1, x, y, 16);
    g.addColorStop(0, "rgba(255,255,255,0.18)");
    g.addColorStop(0.6, "rgba(0,0,0,0.2)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 18, y - 18, 36, 36);
  }
  tone(ctx, W, H, fbm(W, H, 818, 2, 4, 4), 0.26);
  footDirt(ctx, W, H, 80, [140, 112, 76], 0.5);
  grain(ctx, W, H, 819, 0.05);
}

/** Volet persienne (42 x 105 cm), peint clair : la couleur vient de l'instance. */
export function makeShutterTexture(): THREE.CanvasTexture {
  return memo("volet", () => paintShutterTexture());
}

function paintShutterTexture(): THREE.CanvasTexture {
  const W = 128;
  const H = 320;
  const rand = seeded(2601);
  const { canvas, ctx } = canvas2d(W, H);
  ctx.fillStyle = "#e4e2dc";
  ctx.fillRect(0, 0, W, H);
  // Lames inclinees : claire en haut, ombre sous chaque lame.
  for (let y = 14; y < H - 14; y += 13) {
    if (Math.abs(y - H / 2) < 8) continue;
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(12, y, W - 24, 3);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(12, y + 8, W - 24, 5);
  }
  // Cadre et traverse du milieu.
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, W - 20, H - 20);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(10, H / 2 - 6, W - 20, 12);
  // Ecaillage : le bois gris apparait.
  const chip = fbm(W, H, 2602, 3, 8, 5);
  pixels(ctx, W, H, (d, i, p) => {
    if (chip[p] < 0.3) {
      d[i] = 118;
      d[i + 1] = 104;
      d[i + 2] = 88;
    } else if (chip[p] < 0.33) {
      d[i] *= 0.7;
      d[i + 1] *= 0.7;
      d[i + 2] *= 0.7;
    }
  });
  tone(ctx, W, H, fbm(W, H, 2603, 2, 4, 3), 0.2);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(60,50,40,${0.08 + rand() * 0.15})`;
    ctx.fillRect(rand() * W, rand() * H, 1, 3 + rand() * 20);
  }
  grain(ctx, W, H, 2604, 0.04);
  return finish(canvas, 1, 1, 2);
}

/** Fenetre (80 x 100 cm) : piece sombre derriere un verre sale, croisillons et grille en fer. */
export function makeWindowTexture(): THREE.CanvasTexture {
  return memo("fenetre", () => paintWindowTexture());
}

function paintWindowTexture(): THREE.CanvasTexture {
  const W = 128;
  const H = 160;
  const rand = seeded(2701);
  const { canvas, ctx } = canvas2d(W, H);
  const room = ctx.createLinearGradient(0, 0, 0, H);
  room.addColorStop(0, "#1a1816");
  room.addColorStop(1, "#2c2723");
  ctx.fillStyle = room;
  ctx.fillRect(0, 0, W, H);
  // Rideau clair tire d'un cote.
  ctx.fillStyle = "rgba(214,200,172,0.75)";
  ctx.beginPath();
  ctx.moveTo(W * 0.62, 8);
  ctx.quadraticCurveTo(W * 0.72, H * 0.5, W * 0.66, H - 8);
  ctx.lineTo(W - 8, H - 8);
  ctx.lineTo(W - 8, 8);
  ctx.closePath();
  ctx.fill();
  for (let k = 0; k < 6; k++) {
    ctx.fillStyle = "rgba(120,100,70,0.25)";
    ctx.fillRect(W * 0.7 + k * 6, 8, 2, H - 16);
  }
  // Reflet du ciel sur la vitre.
  const sky = ctx.createLinearGradient(0, 0, W, H);
  sky.addColorStop(0, "rgba(170,200,230,0.28)");
  sky.addColorStop(0.5, "rgba(170,200,230,0.05)");
  sky.addColorStop(1, "rgba(170,200,230,0.12)");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  stain(ctx, W, H, fbm(W, H, 2702, 3, 4, 4), 0.55, 0.85, [150, 140, 120], 0.35);
  // Dormant et croisillons.
  ctx.fillStyle = "#d9d2c2";
  ctx.fillRect(0, 0, W, 8);
  ctx.fillRect(0, H - 8, W, 8);
  ctx.fillRect(0, 0, 8, H);
  ctx.fillRect(W - 8, 0, 8, H);
  ctx.fillRect(W / 2 - 3, 0, 6, H);
  ctx.fillRect(0, H * 0.42, W, 5);
  // Grille en fer forge.
  for (let k = 1; k < 6; k++) {
    const x = (k * W) / 6;
    ctx.fillStyle = "#1c1a18";
    ctx.fillRect(x - 2, 0, 4, H);
    ctx.fillStyle = "rgba(200,190,170,0.25)";
    ctx.fillRect(x - 2, 0, 1, H);
  }
  for (const y of [22, H - 26]) {
    ctx.fillStyle = "#1c1a18";
    ctx.fillRect(0, y, W, 4);
  }
  tone(ctx, W, H, fbm(W, H, 2703, 2, 2, 3), 0.2);
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = `rgba(120,70,30,${0.1 + rand() * 0.2})`;
    ctx.fillRect(rand() * W, rand() * H, 2, 4 + rand() * 12);
  }
  grain(ctx, W, H, 2704, 0.04);
  return finish(canvas, 1, 1, 2);
}

/**
 * Dallage de pierre pour une case (1,9 m) : quatre rangees de dalles de
 * longueurs variables, joints de sable tasse. Chaque bord de la tuile est un
 * joint : on peut tourner la dalle d'un quart de tour d'une case a l'autre.
 */
export function makePavingTexture(): THREE.CanvasTexture {
  return memo("dallage", () => paintPavingTexture());
}

function paintPavingTexture(): THREE.CanvasTexture {
  const S = 512;
  const rand = seeded(4409);
  const { canvas, ctx } = canvas2d(S, S);
  // Joints garnis de sable tasse, plus sombre que les dalles.
  ctx.fillStyle = "#9c7e58";
  ctx.fillRect(0, 0, S, S);
  const rowH = S / 4;
  const pal: RGB[] = [
    [194, 172, 136],
    [178, 156, 122],
    [204, 184, 150],
    [170, 148, 114],
    [190, 164, 126],
    [186, 152, 120],
  ];
  const stone = (x: number, y: number, w: number, h: number) => {
    if (rand() < 0.05) return; // dalle manquante : le sable affleure
    const c = jitter(pal[Math.floor(rand() * pal.length)], rand, 0.16);
    const j = 3;
    const e = () => j + rand() * 3;
    const x0 = x + e();
    const y0 = y + e();
    const x1 = x + w - e();
    const y1 = y + h - e();
    const r = 4 + rand() * 6;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0 + r, y0);
    ctx.lineTo(x1 - r, y0 + (rand() - 0.5) * 2);
    ctx.quadraticCurveTo(x1, y0, x1, y0 + r);
    ctx.lineTo(x1 + (rand() - 0.5) * 2, y1 - r);
    ctx.quadraticCurveTo(x1, y1, x1 - r, y1);
    ctx.lineTo(x0 + r, y1 + (rand() - 0.5) * 2);
    ctx.quadraticCurveTo(x0, y1, x0, y1 - r);
    ctx.lineTo(x0 + (rand() - 0.5) * 2, y0 + r);
    ctx.quadraticCurveTo(x0, y0, x0 + r, y0);
    ctx.closePath();
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, css(shadeRGB(c, 1.06)));
    g.addColorStop(0.5, css(c));
    g.addColorStop(1, css(shadeRGB(c, 0.9)));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.clip();
    // Arete basse ombree, arete haute eclairee : la dalle a de l'epaisseur.
    ctx.strokeStyle = "rgba(60,44,26,0.4)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,248,230,0.14)";
    ctx.fillRect(x0, y0, x1 - x0, 3);
    // Usure du passage au centre.
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const wear = ctx.createRadialGradient(cx, cy, 2, cx, cy, Math.max(x1 - x0, y1 - y0) * 0.6);
    wear.addColorStop(0, "rgba(255,250,236,0.1)");
    wear.addColorStop(1, "rgba(255,250,236,0)");
    ctx.fillStyle = wear;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    if (rand() < 0.25) crack(ctx, rand, x0 + rand() * (x1 - x0), y0, Math.PI / 2 + (rand() - 0.5), (y1 - y0) * 1.1, 1.2);
    // Coin epaufre : un eclat de dalle rempli de sable.
    if (rand() < 0.35) {
      const qx = rand() < 0.5 ? x0 : x1;
      const qy = rand() < 0.5 ? y0 : y1;
      ctx.fillStyle = "#a3845c";
      ctx.beginPath();
      ctx.ellipse(qx, qy, 6 + rand() * 12, 4 + rand() * 9, rand() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };
  for (let r = 0; r < 4; r++) {
    let sum = 0;
    while (sum < S) {
      let w = 96 + Math.floor(rand() * 96);
      if (S - sum - w < 70) w = S - sum;
      stone(sum, r * rowH, w, rowH);
      sum += w;
    }
  }
  tone(ctx, S, S, fbm(S, S, 4410, 2, 2, 5), 0.24);
  tone(ctx, S, S, fbm(S, S, 4411, 16, 16, 3), 0.1);
  // Sable souffle sur les dalles.
  stain(ctx, S, S, fbm(S, S, 4412, 3, 3, 5), 0.56, 0.8, [204, 176, 130], 0.75);
  // Salissures sombres : taches d'huile, suie, eau renversee.
  stain(ctx, S, S, fbm(S, S, 4414, 4, 4, 4), 0.7, 0.9, [96, 80, 62], 0.35);
  for (let i = 0; i < 180; i++) {
    const c = jitter([120, 104, 84], rand, 0.4);
    pebble(ctx, rand() * S, rand() * S, 1 + rand() * 2, c, rand() * 3);
  }
  grain(ctx, S, S, 4413, 0.06);
  return finish(canvas, 1, 1, 8);
}

/** Sable tasse de la ville : ondulations du vent, cailloux, traces. Une tuile pour deux cases. */
function makeSandFloor(width: number, height: number): THREE.CanvasTexture {
  const S = 512;
  const rand = seeded(5501);
  const { canvas, ctx } = canvas2d(S, S);
  const large = fbm(S, S, 5502, 2, 2, 5, 0.55);
  const warp = fbm(S, S, 5503, 3, 3, 3);
  pixels(ctx, S, S, (d, i, p) => {
    const x = p % S;
    const y = (p / S) | 0;
    const k = smooth(0.1, 0.9, large[p]);
    // Rides de sable : bandes fines deformees par le bruit.
    const ripple = Math.sin(((x * 0.93 + y * 0.37) / S) * Math.PI * 2 * 26 + warp[p] * 9) * 0.035;
    const m = 1 + ripple;
    d[i] = (176 + 40 * k) * m;
    d[i + 1] = (148 + 42 * k) * m;
    d[i + 2] = (106 + 42 * k) * m;
    d[i + 3] = 255;
  });
  tone(ctx, S, S, fbm(S, S, 5504, 8, 8, 4), 0.14);
  // Plaques de sable compacte, plus sombres, la ou l'on marche.
  stain(ctx, S, S, fbm(S, S, 5505, 3, 3, 4), 0.62, 0.85, [150, 124, 88], 0.4);
  for (let i = 0; i < 260; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const r = 1 + rand() * rand() * 5;
    const c = jitter([140, 122, 96], rand, 0.5);
    const rot = rand() * 3;
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      if (x + ox < -8 || x + ox > S + 8 || y + oy < -8 || y + oy > S + 8) continue;
      pebble(ctx, x + ox, y + oy, r, c, rot);
    }
  }
  // Brindilles seches.
  for (let i = 0; i < 30; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const a = rand() * Math.PI;
    ctx.strokeStyle = `rgba(110,86,50,${0.3 + rand() * 0.3})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * (5 + rand() * 10), y + Math.sin(a) * (5 + rand() * 10));
    ctx.stroke();
  }
  grain(ctx, S, S, 5506, 0.11);
  return finish(canvas, width / 2, height / 2, 8);
}

/**
 * Sol des rues de Poussiere (une tuile pour deux cases, 3,8 m) : terre battue
 * et sable, tasses par le passage. Plaques plus sombres la ou l'on marche,
 * rides de sable la ou le vent l'a amasse, gravier, eclats de tuile et de
 * pierre, croutes de boue sechee craquelee, traces de pneus. Periodique.
 */
function paintDesertGround(): THREE.CanvasTexture {
  const S = 512;
  const rand = seeded(5801);
  const { canvas, ctx } = canvas2d(S, S);
  const large = fbm(S, S, 5802, 2, 2, 6, 0.55);
  const sandy = fbm(S, S, 5803, 3, 3, 4);
  const warp = fbm(S, S, 5804, 4, 4, 3);
  const earth: RGB = [158, 128, 92];
  const sand: RGB = [204, 172, 124];
  pixels(ctx, S, S, (d, i, p) => {
    const x = p % S;
    const y = (p / S) | 0;
    // Sable meuble (clair, ride) ou terre tassee (plus sombre, plus rouge).
    const s = smooth(0.42, 0.7, sandy[p]);
    const k = 0.9 + large[p] * 0.2;
    const ripple = 1 + Math.sin(((x * 0.8 + y * 0.45) / S) * Math.PI * 2 * 22 + warp[p] * 10) * 0.028 * s;
    d[i] = (earth[0] + (sand[0] - earth[0]) * s) * k * ripple;
    d[i + 1] = (earth[1] + (sand[1] - earth[1]) * s) * k * ripple;
    d[i + 2] = (earth[2] + (sand[2] - earth[2]) * s) * k * ripple;
    d[i + 3] = 255;
  });
  tone(ctx, S, S, fbm(S, S, 5805, 10, 10, 4), 0.12);
  // Croutes de boue sechee : un reseau de petites fissures, par plaques.
  for (let c = 0; c < 3; c++) {
    const cx = rand() * S;
    const cy = rand() * S;
    const rad = 40 + rand() * 50;
    for (let i = 0; i < 14; i++) {
      const a = rand() * Math.PI * 2;
      const r = rand() * rad;
      crack(ctx, rand, cx + Math.cos(a) * r, cy + Math.sin(a) * r, rand() * Math.PI * 2, 12 + rand() * 22, 0.9, 1, 0.38);
    }
  }
  // Traces de pneus : deux bandes paralleles a peine plus sombres, avec leurs crampons.
  for (let t = 0; t < 2; t++) {
    const y0 = 60 + rand() * (S - 120);
    const bend = (rand() - 0.5) * 60;
    for (const off of [0, 44]) {
      ctx.strokeStyle = "rgba(70,52,32,0.07)";
      ctx.lineWidth = 13;
      ctx.beginPath();
      ctx.moveTo(-10, y0 + off);
      ctx.quadraticCurveTo(S / 2, y0 + off + bend, S + 10, y0 + off);
      ctx.stroke();
      ctx.setLineDash([3, 6]);
      ctx.strokeStyle = "rgba(60,44,26,0.08)";
      ctx.lineWidth = 11;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  // Gravier, cailloux et eclats de tuile, recopies sur les bords pour le raccord.
  const wrap = (x: number, y: number, m: number, fn: (x: number, y: number) => void) => {
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      if (x + ox < -m || x + ox > S + m || y + oy < -m || y + oy > S + m) continue;
      fn(x + ox, y + oy);
    }
  };
  for (let i = 0; i < 520; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const r = 0.8 + rand() * rand() * (i < 40 ? 9 : 3.5);
    const c = jitter([132, 112, 86], rand, 0.5);
    const rot = rand() * 3;
    wrap(x, y, 12, (px, py) => pebble(ctx, px, py, r, c, rot));
  }
  for (let i = 0; i < 26; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const w = 3 + rand() * 7;
    const h = 2 + rand() * 4;
    const rot = rand() * Math.PI;
    const c = rand() < 0.5 ? jitter([176, 96, 62], rand, 0.2) : jitter([214, 200, 172], rand, 0.15);
    wrap(x, y, 10, (px, py) => {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(rot);
      ctx.fillStyle = "rgba(50,36,22,0.35)";
      ctx.fillRect(-w / 2 + 1, -h / 2 + 1, w, h);
      ctx.fillStyle = css(c);
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    });
  }
  // Plaques tassees la ou l'on marche : plus sombres et plus lisses.
  stain(ctx, S, S, fbm(S, S, 5806, 3, 3, 4), 0.62, 0.86, [140, 112, 80], 0.35);
  grain(ctx, S, S, 5807, 0.09);
  return finish(canvas, 1, 1, 8);
}

/**
 * Sable amasse au pied d'un mur (1,9 x 0,9 m) : plein contre le mur (bas du
 * canevas), il s'effiloche vers la rue. Transparent sur les bords.
 */
export function makeSandDriftTexture(): THREE.CanvasTexture {
  return memo("congere", () => paintSandDriftTexture());
}

function paintSandDriftTexture(): THREE.CanvasTexture {
  const W = 256;
  const H = 128;
  const { canvas, ctx } = canvas2d(W, H);
  const edge = fbm(W, H, 5601, 6, 3, 5);
  const tint = fbm(W, H, 5602, 4, 2, 3);
  pixels(ctx, W, H, (d, i, p) => {
    const x = p % W;
    const y = (p / W) | 0;
    const dist = 1 - y / H; // 0 contre le mur, 1 cote rue
    const a = 1 - smooth(0.2, 0.95, dist + (edge[p] - 0.5) * 0.55);
    const ripple = 1 + Math.sin((y / H) * Math.PI * 14 + tint[p] * 6 + x * 0.01) * 0.03;
    const k = (0.92 + tint[p] * 0.16) * ripple;
    d[i] = 214 * k;
    d[i + 1] = 188 * k;
    d[i + 2] = 142 * k;
    d[i + 3] = a * 235;
  });
  grain(ctx, W, H, 5603, 0.08);
  const t = finish(canvas, 1, 1, 4);
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Touffe d'herbe seche (plans croises, decoupes par transparence). */
export function makeGrassTuftTexture(): THREE.CanvasTexture {
  return memo("herbe", () => paintGrassTuftTexture());
}

function paintGrassTuftTexture(): THREE.CanvasTexture {
  const S = 128;
  const rand = seeded(5701);
  const { canvas, ctx } = canvas2d(S, S);
  ctx.clearRect(0, 0, S, S);
  const cols: RGB[] = [
    [196, 176, 116],
    [168, 150, 92],
    [140, 132, 80],
    [120, 96, 60],
  ];
  ctx.lineCap = "round";
  for (let i = 0; i < 70; i++) {
    const x = S / 2 + (rand() - 0.5) * S * 0.35;
    const lean = (rand() - 0.5) * S * 0.9;
    const h = S * (0.35 + rand() * 0.6);
    ctx.strokeStyle = css(cols[Math.floor(rand() * cols.length)]);
    ctx.lineWidth = 1.2 + rand() * 1.8;
    ctx.beginPath();
    ctx.moveTo(x, S);
    ctx.quadraticCurveTo(x + lean * 0.2, S - h * 0.6, x + lean * 0.5, S - h);
    ctx.stroke();
  }
  const t = finish(canvas, 1, 1, 1);
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Palme : nervure centrale et folioles, vert olive poussiereux, pointes seches. */
export function makePalmFrondTexture(): THREE.CanvasTexture {
  return memo("palme", () => paintPalmFrondTexture());
}

function paintPalmFrondTexture(): THREE.CanvasTexture {
  const W = 256;
  const H = 64;
  const rand = seeded(5801);
  const { canvas, ctx } = canvas2d(W, H);
  ctx.clearRect(0, 0, W, H);
  ctx.lineCap = "round";
  for (let x = 6; x < W - 4; x += 4) {
    const t = x / W;
    const len = (H / 2 - 3) * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (0.85 + rand() * 0.15);
    const dry = t > 0.85 || rand() < 0.08;
    const c: RGB = dry ? [150, 126, 76] : jitter([92, 116, 60], rand, 0.3);
    ctx.strokeStyle = css(c);
    ctx.lineWidth = 2.2;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x, H / 2);
      ctx.lineTo(x + len * 0.55, H / 2 + s * len);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = "#8a7a4c";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();
  const t = finish(canvas, 1, 1, 1);
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Stipe de palmier : cicatrices des anciennes palmes, en anneaux. */
export function makePalmTrunkTexture(): THREE.CanvasTexture {
  return memo("stipe", () => paintPalmTrunkTexture());
}

function paintPalmTrunkTexture(): THREE.CanvasTexture {
  const W = 64;
  const H = 128;
  const { canvas, ctx } = canvas2d(W, H);
  ctx.fillStyle = "#7a6a54";
  ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 10) {
    ctx.fillStyle = "rgba(40,30,20,0.55)";
    ctx.fillRect(0, y + 6, W, 3);
    ctx.fillStyle = "rgba(255,240,210,0.16)";
    ctx.fillRect(0, y, W, 2);
  }
  tone(ctx, W, H, fbm(W, H, 5901, 2, 4, 4), 0.3);
  grain(ctx, W, H, 5902, 0.06);
  return finish(canvas);
}

/** Toile d'auvent a rayures passees par le soleil. */
export function makeAwningTexture(): THREE.CanvasTexture {
  return memo("auvent", () => paintAwningTexture());
}

function paintAwningTexture(): THREE.CanvasTexture {
  const S = 128;
  const { canvas, ctx } = canvas2d(S, S);
  for (let x = 0; x < S; x += 16) {
    ctx.fillStyle = (x / 16) % 2 === 0 ? "#a84535" : "#e0cfb0";
    ctx.fillRect(x, 0, 16, S);
  }
  stain(ctx, S, S, fbm(S, S, 6001, 2, 3, 4), 0.35, 0.9, [226, 214, 190], 0.45);
  tone(ctx, S, S, fbm(S, S, 6002, 4, 4, 3), 0.2);
  footDirt(ctx, S, S, 40, [80, 60, 40], 0.3);
  grain(ctx, S, S, 6003, 0.05);
  return finish(canvas);
}

/**
 * Climatiseur : face avant a ventilateur (le reste de la boite prend le coin
 * uni en haut a gauche du canevas, voir duelTown).
 */
export function makeAcUnitTexture(): THREE.CanvasTexture {
  return memo("climatiseur", () => paintAcUnitTexture());
}

function paintAcUnitTexture(): THREE.CanvasTexture {
  const W = 128;
  const H = 96;
  const rand = seeded(6101);
  const { canvas, ctx } = canvas2d(W, H);
  ctx.fillStyle = "#bdb9ae";
  ctx.fillRect(0, 0, W, H);
  // Grille de ventilation a gauche.
  for (let y = 14; y < H - 12; y += 6) {
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(14, y, 42, 3);
  }
  // Ventilateur.
  ctx.fillStyle = "#2a2a28";
  ctx.beginPath();
  ctx.arc(90, 48, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(200,200,190,0.55)";
  ctx.lineWidth = 1.5;
  for (const r of [10, 18, 26]) {
    ctx.beginPath();
    ctx.arc(90, 48, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let a = 0; a < 4; a++) {
    ctx.beginPath();
    ctx.moveTo(90, 48);
    ctx.lineTo(90 + Math.cos(a * 1.57) * 29, 48 + Math.sin(a * 1.57) * 29);
    ctx.stroke();
  }
  streaks(ctx, rand, W, 5, [110, 70, 40], 0.3, 60, 3, 50);
  tone(ctx, W, H, fbm(W, H, 6102, 2, 2, 4), 0.2);
  footDirt(ctx, W, H, 30, [90, 70, 50], 0.4);
  grain(ctx, W, H, 6103, 0.05);
  return finish(canvas, 1, 1, 1);
}

/** Coffret electrique : tole grise, petite fenetre du compteur, triangle de danger. */
export function makeMeterBoxTexture(): THREE.CanvasTexture {
  return memo("compteur", () => paintMeterBoxTexture());
}

function paintMeterBoxTexture(): THREE.CanvasTexture {
  const W = 64;
  const H = 96;
  const rand = seeded(6201);
  const { canvas, ctx } = canvas2d(W, H);
  ctx.fillStyle = "#9a9d98";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 2;
  ctx.strokeRect(5, 5, W - 10, H - 10);
  ctx.fillStyle = "#1e2226";
  ctx.fillRect(18, 18, 28, 16);
  ctx.fillStyle = "rgba(160,200,220,0.35)";
  ctx.fillRect(19, 19, 12, 6);
  ctx.fillStyle = "#e0b530";
  ctx.beginPath();
  ctx.moveTo(32, 50);
  ctx.lineTo(44, 70);
  ctx.lineTo(20, 70);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#1b1a17";
  ctx.beginPath();
  ctx.moveTo(33, 55);
  ctx.lineTo(29, 63);
  ctx.lineTo(33, 62);
  ctx.lineTo(31, 68);
  ctx.lineTo(36, 60);
  ctx.lineTo(32, 61);
  ctx.closePath();
  ctx.fill();
  streaks(ctx, rand, W, 4, [110, 64, 34], 0.35, 50, 3, 40);
  tone(ctx, W, H, fbm(W, H, 6202, 2, 2, 4), 0.2);
  grain(ctx, W, H, 6203, 0.05);
  return finish(canvas, 1, 1, 1);
}

/**
 * Enduit des etages et des maisons du fond (tuile de 2 m, repetee en
 * coordonnees du monde : la teinte vient des couleurs de sommets).
 */
export function makePlasterTileTexture(): THREE.CanvasTexture {
  return memo("enduit-tuile", () => paintPlasterTileTexture());
}

function paintPlasterTileTexture(): THREE.CanvasTexture {
  const S = 256;
  const rand = seeded(6301);
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#eadcc2";
  ctx.fillRect(0, 0, S, S);
  tone(ctx, S, S, fbm(S, S, 6302, 2, 2, 5), 0.24);
  tone(ctx, S, S, fbm(S, S, 6303, 12, 12, 3), 0.08);
  stain(ctx, S, S, fbm(S, S, 6304, 3, 2, 4), 0.62, 0.85, [150, 124, 90], 0.35);
  for (let i = 0; i < 4; i++) crack(ctx, rand, rand() * S, rand() * S, Math.PI / 2 + (rand() - 0.5) * 2, 30 + rand() * 60, 1);
  streaks(ctx, rand, S, 8, [110, 90, 64], 0.12, S, 5);
  grain(ctx, S, S, 6305, 0.035);
  return finish(canvas);
}

/**
 * Ciel peint en projection equirectangulaire (fond de scene) : bleu profond au
 * zenith, horizon laiteux de la meme couleur que le brouillard, soleil au bon
 * endroit (dans la direction d'ou vient la lumiere), quelques nuages.
 * Poussiere : ciel sec du desert, cirrus fins. Ile : ciel d'ete, cumulus.
 */
export function makeDuelSkyTexture(theme: DuelTheme, sun: readonly [number, number, number]): THREE.CanvasTexture | null {
  if (theme !== "poussiere" && theme !== "ile") return null;
  return memo("ciel:" + theme + ":" + sun.join(","), () => paintSky(theme, sun));
}

function paintSky(theme: DuelTheme, sun: readonly [number, number, number]): THREE.CanvasTexture {
  const W = 1024;
  const H = 512;
  const desert = theme === "poussiere";
  const horizon: RGB = desert ? [217, 210, 192] : [159, 212, 255];
  const mid: RGB = desert ? [138, 178, 224] : [110, 172, 238];
  const zenith: RGB = desert ? [58, 112, 186] : [48, 116, 206];
  // Sous l'horizon : la couleur du brouillard, sans couture avec la mer vue
  // du parachute au-dela de la distance d'affichage.
  const below: RGB = desert ? [210, 202, 184] : [159, 212, 255];
  const sl = Math.hypot(sun[0], sun[1], sun[2]) || 1;
  const sx = sun[0] / sl;
  const sy = sun[1] / sl;
  const sz = sun[2] / sl;
  const CW = 512;
  const CH = 256;
  const clouds = desert ? fbm(CW, CH, 91, 4, 6, 5, 0.55) : fbm(CW, CH, 92, 6, 4, 5, 0.5);
  const { canvas, ctx } = canvas2d(W, H);
  const img = ctx.createImageData(W, H);
  const d = img.data;
  const cosLon = new Float32Array(W);
  const sinLon = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    // Meme convention que three.js : u = atan2(z, x) / 2pi + 0.5.
    const lon = ((x + 0.5) / W - 0.5) * Math.PI * 2;
    cosLon[x] = Math.cos(lon);
    sinLon[x] = Math.sin(lon);
  }
  for (let y = 0; y < H; y++) {
    // Haut du canevas = v 1 = zenith.
    const el = (0.5 - (y + 0.5) / H) * Math.PI;
    const ce = Math.cos(el);
    const se = Math.sin(el);
    let base: [number, number, number];
    if (se >= 0) {
      const t = Math.pow(se, 0.55);
      const a = smooth(0, 0.45, t);
      const b = smooth(0.35, 1, t);
      base = [
        horizon[0] + (mid[0] - horizon[0]) * a + (zenith[0] - mid[0]) * b,
        horizon[1] + (mid[1] - horizon[1]) * a + (zenith[1] - mid[1]) * b,
        horizon[2] + (mid[2] - horizon[2]) * a + (zenith[2] - mid[2]) * b,
      ];
    } else {
      const a = smooth(0, -0.12, se);
      base = [
        horizon[0] + (below[0] - horizon[0]) * a,
        horizon[1] + (below[1] - horizon[1]) * a,
        horizon[2] + (below[2] - horizon[2]) * a,
      ];
    }
    const cloudBand = se > 0 ? smooth(0.02, 0.12, se) * smooth(0.85, 0.5, se) : 0;
    const cy = Math.min(CH - 1, (y * CH) / H) | 0;
    for (let x = 0; x < W; x++) {
      const dx = ce * cosLon[x];
      const dz = ce * sinLon[x];
      const dot = dx * sx + se * sy + dz * sz;
      let r = base[0];
      let g = base[1];
      let b = base[2];
      if (dot > 0) {
        // Halo chaud autour du soleil, plus large pres de l'horizon (diffusion).
        const halo = Math.pow(dot, 12) * 0.35 + Math.pow(dot, 90) * 0.5 + Math.pow(dot, 8) * 0.18 * (1 - Math.abs(se));
        r += (255 - r) * Math.min(1, halo);
        g += (244 - g) * Math.min(1, halo);
        b += (214 - b) * Math.min(1, halo * 0.9);
      }
      if (cloudBand > 0) {
        const c = clouds[cy * CW + ((x * CW) / W | 0)];
        const a = (desert ? smooth(0.6, 0.86, c) * 0.55 : smooth(0.52, 0.72, c) * 0.85) * cloudBand;
        if (a > 0) {
          const lit = dot > 0 ? 1 + dot * 0.08 : 0.94;
          r += (250 * lit - r) * a;
          g += (247 * lit - g) * a;
          b += (240 * lit - b) * a;
        }
      }
      // Disque du soleil.
      if (dot > 0.99975) {
        r = 255;
        g = 252;
        b = 238;
      }
      const i = (y * W + x) * 4;
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(canvas);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------------------
// Decor pose sur toutes les cartes
// ---------------------------------------------------------------------------

/**
 * Caisse en bois : planches horizontales, écharpe en diagonale, clous,
 * marquage au pochoir. La bande de 14 px sur les bords est le bois des
 * montants (les montants en relief de duelDecor y prennent leur texture).
 */
export function makeCrateTexture(): THREE.CanvasTexture {
  return memo("caisse", () => paintCrateTexture());
}

function paintCrateTexture(): THREE.CanvasTexture {
  const S = 256;
  const rand = seeded(7101);
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#6f5033";
  ctx.fillRect(0, 0, S, S);
  const planks = 5;
  const ph = (S - 28) / planks;
  for (let k = 0; k < planks; k++) {
    const y = 14 + k * ph;
    const c = jitter([184, 140, 90], rand, 0.2);
    ctx.fillStyle = css(c);
    ctx.fillRect(14, y + 1, S - 28, ph - 2);
    // Fil du bois.
    for (let g = 0; g < 14; g++) {
      const gy = y + 3 + rand() * (ph - 6);
      ctx.strokeStyle = `rgba(90,58,28,${0.12 + rand() * 0.2})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(14, gy);
      ctx.bezierCurveTo(S * 0.35, gy + (rand() - 0.5) * 4, S * 0.65, gy + (rand() - 0.5) * 4, S - 14, gy + (rand() - 0.5) * 3);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(40,24,10,0.55)";
    ctx.fillRect(14, y + ph - 2, S - 28, 2);
    ctx.fillStyle = "rgba(255,230,190,0.15)";
    ctx.fillRect(14, y + 1, S - 28, 1.5);
    // Clous aux extremites.
    ctx.fillStyle = "#4a4640";
    for (const nx of [24, S - 24]) {
      ctx.beginPath();
      ctx.arc(nx, y + ph / 2, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Echarpe diagonale.
  ctx.save();
  ctx.translate(S / 2, S / 2);
  ctx.rotate(-Math.atan2(S - 40, S - 40));
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(-S * 0.66, -9, S * 1.32, 22);
  ctx.fillStyle = css([162, 118, 72]);
  ctx.fillRect(-S * 0.66, -12, S * 1.32, 22);
  ctx.fillStyle = "rgba(255,230,190,0.18)";
  ctx.fillRect(-S * 0.66, -12, S * 1.32, 2);
  ctx.restore();
  // Montants du pourtour (et bois des aretes en relief).
  ctx.fillStyle = "#8c6440";
  ctx.fillRect(0, 0, S, 14);
  ctx.fillRect(0, S - 14, S, 14);
  ctx.fillRect(0, 0, 14, S);
  ctx.fillRect(S - 14, 0, 14, S);
  for (let g = 0; g < 30; g++) {
    ctx.fillStyle = `rgba(60,36,16,${0.15 + rand() * 0.2})`;
    ctx.fillRect(rand() * 14, rand() * S, 1, 10 + rand() * 40);
  }
  // Marquage au pochoir, a moitie efface.
  ctx.fillStyle = "rgba(34,26,20,0.55)";
  ctx.font = "bold 22px monospace";
  ctx.textAlign = "center";
  ctx.fillText("PX-" + (10 + Math.floor(rand() * 89)), S * 0.68, S * 0.3);
  ctx.beginPath();
  for (const ax of [S * 0.24, S * 0.34]) {
    ctx.moveTo(ax, S * 0.78);
    ctx.lineTo(ax + 9, S * 0.66);
    ctx.lineTo(ax + 18, S * 0.78);
    ctx.lineTo(ax + 12, S * 0.78);
    ctx.lineTo(ax + 12, S * 0.86);
    ctx.lineTo(ax + 6, S * 0.86);
    ctx.lineTo(ax + 6, S * 0.78);
    ctx.closePath();
  }
  ctx.fill();
  stain(ctx, S, S, fbm(S, S, 7102, 3, 3, 4), 0.55, 0.85, [150, 136, 116], 0.45);
  tone(ctx, S, S, fbm(S, S, 7103, 3, 3, 4), 0.2);
  footDirt(ctx, S, S, 60, [60, 44, 28], 0.35);
  grain(ctx, S, S, 7104, 0.05);
  return finish(canvas, 1, 1, 4);
}

/**
 * Mur construit (1v1 construction) : panneau de bois agglomere (OSB) dans un
 * cadre d'acier bleu, pour qu'on le distingue au premier regard des murs de
 * la carte.
 */
export function makeBuildTexture(): THREE.CanvasTexture {
  return memo("construction", () => paintBuildTexture());
}

function paintBuildTexture(): THREE.CanvasTexture {
  const S = 256;
  const rand = seeded(7201);
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#c9a36e";
  ctx.fillRect(0, 0, S, S);
  const flakes: RGB[] = [
    [214, 178, 122],
    [178, 136, 86],
    [226, 196, 142],
    [160, 118, 72],
  ];
  for (let i = 0; i < 1100; i++) {
    ctx.save();
    ctx.translate(rand() * S, rand() * S);
    ctx.rotate(rand() * Math.PI);
    ctx.fillStyle = css(flakes[Math.floor(rand() * flakes.length)], 0.55 + rand() * 0.4);
    ctx.fillRect(-4 - rand() * 8, -2 - rand() * 3, 8 + rand() * 14, 4 + rand() * 5);
    ctx.restore();
  }
  tone(ctx, S, S, fbm(S, S, 7202, 3, 3, 4), 0.18);
  // Cadre et ecusson d'acier bleu.
  ctx.strokeStyle = "#2f5d8c";
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, S - 14, S - 14);
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(14, S - 14);
  ctx.lineTo(S - 14, 14);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1.5, 1.5, S - 3, S - 3);
  ctx.fillStyle = "#1e3550";
  for (const [x, y] of [[7, 7], [S - 7, 7], [7, S - 7], [S - 7, S - 7], [S / 2, S / 2]]) {
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  grain(ctx, S, S, 7203, 0.05);
  return finish(canvas, 1, 1, 4);
}

/**
 * Bidon metallique (u autour du fut, v en hauteur) : peinture claire (la
 * couleur vient de l'instance), rouille, coulures, etiquette de danger.
 */
export function makeBarrelTexture(): THREE.CanvasTexture {
  return memo("bidon", () => paintBarrelTexture());
}

function paintBarrelTexture(): THREE.CanvasTexture {
  const W = 256;
  const H = 128;
  const rand = seeded(7301);
  const { canvas, ctx } = canvas2d(W, H);
  ctx.fillStyle = "#d6d6d0";
  ctx.fillRect(0, 0, W, H);
  tone(ctx, W, H, fbm(W, H, 7302, 4, 2, 4), 0.18);
  // Reflets verticaux du fut.
  for (let x = 0; x < W; x++) {
    const k = Math.cos((x / W) * Math.PI * 2 * 3) * 0.04;
    ctx.fillStyle = k > 0 ? `rgba(255,255,255,${k})` : `rgba(0,0,0,${-k})`;
    ctx.fillRect(x, 0, 1, H);
  }
  // Etiquette de danger generique.
  ctx.fillStyle = "#e0a83a";
  ctx.save();
  ctx.translate(64, 64);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-16, -16, 32, 32);
  ctx.restore();
  ctx.fillStyle = "#1c1a16";
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("!", 64, 65);
  // Rouille et coulures.
  const rust = fbm(W, H, 7303, 6, 3, 5);
  stain(ctx, W, H, rust, 0.6, 0.82, [96, 52, 26], 0.85);
  streaks(ctx, rand, W, 14, [90, 48, 22], 0.35, H * 0.7, 3);
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = `rgba(250,250,245,${0.1 + rand() * 0.2})`;
    ctx.lineWidth = 1;
    const x = rand() * W;
    const y = rand() * H;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 16, y + (rand() - 0.5) * 6);
    ctx.stroke();
  }
  footDirt(ctx, W, H, 34, [70, 50, 30], 0.5);
  grain(ctx, W, H, 7304, 0.05);
  const t = finish(canvas, 1, 1, 2);
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Sac de sable : toile de jute tissee, couture, poussiere. */
export function makeSandbagTexture(): THREE.CanvasTexture {
  return memo("sac", () => paintSandbagTexture());
}

function paintSandbagTexture(): THREE.CanvasTexture {
  const S = 128;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#a89770";
  ctx.fillRect(0, 0, S, S);
  pixels(ctx, S, S, (d, i, p) => {
    const x = p % S;
    const y = (p / S) | 0;
    const k = ((x >> 1) + (y >> 1)) % 2 === 0 ? 1.08 : 0.92;
    d[i] *= k;
    d[i + 1] *= k;
    d[i + 2] *= k;
  });
  tone(ctx, S, S, fbm(S, S, 7401, 3, 3, 4), 0.3);
  ctx.strokeStyle = "rgba(60,50,30,0.55)";
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, S * 0.5);
  ctx.lineTo(S, S * 0.5);
  ctx.stroke();
  ctx.setLineDash([]);
  stain(ctx, S, S, fbm(S, S, 7402, 2, 2, 4), 0.6, 0.85, [196, 176, 136], 0.5);
  grain(ctx, S, S, 7403, 0.06);
  return finish(canvas);
}

/** Lettre de site peinte a la bombe, facon « site A ». */
export function makeSiteMarkTexture(label: string): THREE.CanvasTexture {
  return memo("site:" + label, () => paintSiteMarkTexture(label));
}

function paintSiteMarkTexture(label: string): THREE.CanvasTexture {
  const S = 256;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.clearRect(0, 0, S, S);
  // Brouillard de peinture autour du trait, comme a la bombe.
  ctx.shadowColor = "rgba(220,60,40,0.6)";
  ctx.shadowBlur = 6;
  ctx.strokeStyle = "rgba(220,60,40,0.75)";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, 96, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(220,60,40,0.8)";
  ctx.font = "bold 150px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, S / 2, S / 2 + 6);
  ctx.shadowBlur = 0;
  // Peinture usee par les semelles : elle palit par plaques et s'ecaille en
  // petits eclats ronds (le sol reapparait dessous).
  const rand = seeded(label.charCodeAt(0) * 31 + 7);
  const wear = fbm(S, S, label.charCodeAt(0) * 17 + 3, 4, 4, 5);
  pixels(ctx, S, S, (d, i, p) => {
    d[i + 3] *= 0.45 + 0.55 * smooth(0.75, 0.35, wear[p]);
  });
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "rgba(0,0,0,0.9)";
  for (let i = 0; i < 420; i++) {
    ctx.beginPath();
    ctx.ellipse(rand() * S, rand() * S, 0.6 + rand() * rand() * 3.5, 0.5 + rand() * 2, rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------------------
// L'ile de la battle royale
// ---------------------------------------------------------------------------

/**
 * Mur de maison de l'ile (une face de 1,9 x 3,4 m, 256 x 458) : enduit a la
 * chaux sur un soubassement de moellons, poteaux et sabliere en chene vieilli
 * (a colombages), une fenetre a petits carreaux avec ses volets, appui de
 * pierre. Les poteaux tombent sur les bords : deux murs voisins partagent
 * leur poteau.
 */
function makeHouseWall(): THREE.CanvasTexture {
  const W = 256;
  const H = 458;
  const rand = seeded(8101);
  const { canvas, ctx } = canvas2d(W, H);
  const px = H / 3.4; // pixels par metre
  // Enduit.
  ctx.fillStyle = "#e4d9c2";
  ctx.fillRect(0, 0, W, H);
  tone(ctx, W, H, fbm(W, H, 8102, 3, 5, 5), 0.2);
  tone(ctx, W, H, fbm(W, H, 8104, 14, 24, 3), 0.07);
  stain(ctx, W, H, fbm(W, H, 8105, 4, 6, 4), 0.62, 0.85, [170, 150, 118], 0.35);
  // Soubassement de moellons (60 cm) : pierres grises irregulieres, joints clairs.
  const baseTop = H - 0.6 * px;
  ctx.fillStyle = "#b9b1a2";
  ctx.fillRect(0, baseTop, W, H - baseTop);
  for (let y = baseTop + 2; y < H; y += 18 + rand() * 6) {
    let x = -rand() * 20;
    const rowH = 16 + rand() * 6;
    while (x < W) {
      const w = 22 + rand() * 30;
      const c = jitter([128, 124, 116], rand, 0.3);
      ctx.fillStyle = css(c);
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + rowH / 2, w / 2 - 1.5, rowH / 2 - 1.5, (rand() - 0.5) * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.beginPath();
      ctx.ellipse(x + w / 2 - 2, y + rowH / 2 - 3, w / 2 - 5, rowH / 4, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      x += w;
    }
  }
  // Bois : poteaux sur les bords, sabliere en haut, lisse au pied de l'enduit.
  const wood = (x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = "#5a3f28";
    ctx.fillRect(x, y, w, h);
    const vertical = h > w;
    for (let k = 0; k < (vertical ? w : h) / 2; k++) {
      ctx.fillStyle = `rgba(${30 + rand() * 30},${20 + rand() * 16},10,${0.15 + rand() * 0.3})`;
      if (vertical) ctx.fillRect(x + rand() * w, y, 1, h);
      else ctx.fillRect(x, y + rand() * h, w, 1);
    }
    ctx.fillStyle = "rgba(255,230,190,0.1)";
    if (vertical) ctx.fillRect(x, y, 2, h);
    else ctx.fillRect(x, y, w, 2);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    if (vertical) ctx.fillRect(x + w - 2, y, 2, h);
    else ctx.fillRect(x, y + h - 2, w, 2);
  };
  wood(0, 0, W, 16);
  wood(0, baseTop - 12, W, 12);
  wood(-9, 0, 18, baseTop);
  wood(W - 9, 0, 18, baseTop);
  // Fenetre (80 x 110 cm) a hauteur d'appui (1 m).
  const ww = 0.8 * px;
  const wh = 1.1 * px;
  const wx = (W - ww) / 2;
  const wy = H - 1.0 * px - wh;
  // Tableau (ebrasement) sombre, vitres qui refletent le ciel, rideau.
  ctx.fillStyle = "#3a352e";
  ctx.fillRect(wx - 5, wy - 5, ww + 10, wh + 10);
  const glass = ctx.createLinearGradient(wx, wy, wx + ww, wy + wh);
  glass.addColorStop(0, "#9fb9cf");
  glass.addColorStop(0.45, "#4b5d6c");
  glass.addColorStop(1, "#2c3640");
  ctx.fillStyle = glass;
  ctx.fillRect(wx, wy, ww, wh);
  ctx.fillStyle = "rgba(230,222,205,0.55)";
  ctx.fillRect(wx + ww * 0.55, wy + 4, ww * 0.4, wh - 8);
  // Croisee blanche a petits carreaux.
  ctx.fillStyle = "#ece8de";
  ctx.fillRect(wx, wy, ww, 5);
  ctx.fillRect(wx, wy + wh - 5, ww, 5);
  ctx.fillRect(wx, wy, 5, wh);
  ctx.fillRect(wx + ww - 5, wy, 5, wh);
  ctx.fillRect(wx + ww / 2 - 2.5, wy, 5, wh);
  for (const f of [1 / 3, 2 / 3]) ctx.fillRect(wx, wy + wh * f - 1.5, ww, 3);
  // Volets pleins ouverts, vert sapin, planches et barres.
  for (const sx of [wx - ww / 2 - 8, wx + ww + 8]) {
    ctx.fillStyle = "#3f6a4a";
    ctx.fillRect(sx, wy - 3, ww / 2, wh + 6);
    for (let k = 1; k < 3; k++) {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(sx + (k * ww) / 6, wy - 3, 1.5, wh + 6);
    }
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(sx, wy + wh * 0.2, ww / 2, 5);
    ctx.fillRect(sx, wy + wh * 0.75, ww / 2, 5);
  }
  // Appui de pierre et linteau de bois.
  ctx.fillStyle = "#cfc6b4";
  ctx.fillRect(wx - 10, wy + wh + 4, ww + 20, 9);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(wx - 10, wy + wh + 13, ww + 20, 3);
  wood(wx - 12, wy - 16, ww + 24, 11);
  // Usure : taches, fissures, coulures, salissure au pied.
  stain(ctx, W, H, fbm(W, H, 8106, 8, 12, 4), 0.72, 0.86, [120, 110, 92], 0.6);
  for (let i = 0; i < 3; i++) crack(ctx, rand, 20 + rand() * 200, baseTop - 20 - rand() * 60, -Math.PI / 2 + (rand() - 0.5), 20 + rand() * 40, 1, 0, 0.45);
  streaks(ctx, rand, W, 10, [100, 84, 60], 0.14, 160, 4, 16);
  footDirt(ctx, W, H, 80, [74, 62, 44], 0.45);
  grain(ctx, W, H, 8103, 0.04);
  return finish(canvas);
}

/**
 * Le sol de toute l'ile, peint case par case : herbe, sable de plage, beton
 * des docks, terre des chemins, parquet des maisons, eau autour. Une seule
 * texture pour toute la carte, donc un seul appel de rendu.
 *
 * 12 pixels par case seulement (l'ile fait 150 cases) : le detail de pres
 * vient d'un second calque repete (makeGroundDetailTexture, dans duelDecor).
 * Ici, on soigne les grandes masses : frontieres irregulieres entre l'herbe,
 * le sable et la terre (le beton et les parquets gardent leurs bords droits),
 * nuances de l'herbe, sable mouille au bord de l'eau, ornieres des chemins.
 */
export function makeIslandGroundTexture(island: IslandMap): THREE.CanvasTexture {
  const P = 12;
  const W = island.width;
  const H = island.height;
  const CW = W * P;
  const CH = H * P;
  const { canvas, ctx } = canvas2d(CW, CH);
  const rand = seeded(island.width * 131 + island.trees.length * 7 + island.structures.length);
  // Champs de bruit a quatre pixels par case, lus au plus proche.
  const FW = W * 4;
  const FH = H * 4;
  const warpA = fbm(FW, FH, 9101, Math.max(2, W >> 3), Math.max(2, H >> 3), 4);
  const warpB = fbm(FW, FH, 9102, Math.max(2, W >> 3), Math.max(2, H >> 3), 4);
  const patch = fbm(FW, FH, 9103, Math.max(2, W >> 4), Math.max(2, H >> 4), 5);
  const fine = fbm(FW, FH, 9104, Math.max(2, W >> 1), Math.max(2, H >> 1), 3);
  const g = island.ground;
  const at = (x: number, y: number) => g[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
  const straight = (t: number) => t === 2 || t === 5;
  const img = ctx.createImageData(CW, CH);
  const d = img.data;
  for (let y = 0; y < CH; y++) {
    const cy = (y + 0.5) / P;
    const fy = Math.min(FH - 1, (y * 4) / P) | 0;
    for (let x = 0; x < CW; x++) {
      const cx = (x + 0.5) / P;
      const fx = Math.min(FW - 1, (x * 4) / P) | 0;
      const f = fy * FW + fx;
      const t0 = at(cx | 0, cy | 0);
      let t = t0;
      if (!straight(t0)) {
        // Frontiere ondulee : on lit la case d'un point deplace par le bruit.
        const wt = at((cx + (warpA[f] - 0.5) * 1.6) | 0, (cy + (warpB[f] - 0.5) * 1.6) | 0);
        if (!straight(wt)) t = wt;
      }
      const n = fine[f];
      const q = patch[f];
      const r = rand();
      let c0: number;
      let c1: number;
      let c2: number;
      if (t === 0) {
        // Herbe : vert franc ou jauni par plaques, brins plus clairs ou plus sombres.
        const dry = smooth(0.55, 0.8, q);
        c0 = 86 + dry * 52;
        c1 = 142 + dry * 8;
        c2 = 58 + dry * 12;
        const k = 0.86 + n * 0.24 + (r - 0.5) * 0.16;
        c0 *= k;
        c1 *= k;
        c2 *= k;
      } else if (t === 1) {
        // Sable : plus sombre et plus froid la ou l'eau l'a mouille.
        const wet = at(cx | 0, (cy | 0) + 1) === 4 || at(cx | 0, (cy | 0) - 1) === 4 || at((cx | 0) + 1, cy | 0) === 4 || at((cx | 0) - 1, cy | 0) === 4;
        const k = (0.93 + n * 0.12 + (r - 0.5) * 0.06) * (wet ? 0.82 : 1);
        c0 = 226 * k;
        c1 = 207 * k;
        c2 = (wet ? 160 : 148) * k;
      } else if (t === 2) {
        // Beton des docks : dalles de deux cases, joints, taches.
        const joint = x % (P * 2) === 0 || y % (P * 2) === 0;
        const k = (0.9 + q * 0.14 + (r - 0.5) * 0.05) * (joint ? 0.72 : 1);
        c0 = 154 * k;
        c1 = 156 * k;
        c2 = 150 * k;
      } else if (t === 3) {
        // Terre battue : ornieres plus sombres au milieu des chemins.
        const k = 0.84 + n * 0.22 + (r - 0.5) * 0.12;
        c0 = 150 * k;
        c1 = 118 * k;
        c2 = 78 * k;
      } else if (t === 4) {
        const shore = at((cx | 0) + 1, cy | 0) !== 4 || at((cx | 0) - 1, cy | 0) !== 4 || at(cx | 0, (cy | 0) + 1) !== 4 || at(cx | 0, (cy | 0) - 1) !== 4;
        c0 = shore ? 88 : 47;
        c1 = shore ? 178 : 143;
        c2 = shore ? 214 : 208;
      } else {
        // Parquet : lames de 20 cm, joints sombres.
        const k = (y % 4 === 0 ? 0.7 : 1) * (0.9 + ((Math.floor(y / 4) * 7) % 5) * 0.04 + (r - 0.5) * 0.06);
        c0 = 154 * k;
        c1 = 108 * k;
        c2 = 66 * k;
      }
      const i = (y * CW + x) * 4;
      d[i] = c0;
      d[i + 1] = c1;
      d[i + 2] = c2;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/**
 * Detail du sol vu de pres (une tuile par case, repetee sur toute l'ile) :
 * gris clair neutre qui MULTIPLIE la couleur du sol. Grain, gravillons,
 * brindilles, petites mottes : rien qui ne soit propre a une matiere, pour
 * aller sur l'herbe comme sur la terre ou le beton.
 */
export function makeGroundDetailTexture(): THREE.CanvasTexture {
  return memo("detail-sol", () => paintGroundDetail());
}

function paintGroundDetail(): THREE.CanvasTexture {
  const S = 256;
  const rand = seeded(9201);
  const { canvas, ctx } = canvas2d(S, S);
  const big = fbm(S, S, 9202, 3, 3, 4);
  const mid = fbm(S, S, 9203, 12, 12, 3);
  pixels(ctx, S, S, (d, i, p) => {
    const v = 214 + big[p] * 28 + (mid[p] - 0.5) * 30 + (rand() - 0.5) * 26;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = 255;
  });
  // Gravillons et mottes, recopies sur les bords pour le raccord.
  for (let n = 0; n < 150; n++) {
    const x = rand() * S;
    const y = rand() * S;
    const r = 0.8 + rand() * rand() * 4;
    const c = 120 + rand() * 70;
    const rot = rand() * 3;
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      if (x + ox < -8 || x + ox > S + 8 || y + oy < -8 || y + oy > S + 8) continue;
      pebble(ctx, x + ox, y + oy, r, [c, c, c], rot);
    }
  }
  // Brindilles et brins couches.
  for (let n = 0; n < 90; n++) {
    const x = rand() * S;
    const y = rand() * S;
    const a = rand() * Math.PI * 2;
    const l = 3 + rand() * 9;
    ctx.strokeStyle = `rgba(90,90,90,${0.25 + rand() * 0.35})`;
    ctx.lineWidth = 0.8 + rand() * 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  // Pas de couleur : c'est un facteur de luminosite. On garde le gris.
  return finish(canvas, 1, 1, 8);
}
