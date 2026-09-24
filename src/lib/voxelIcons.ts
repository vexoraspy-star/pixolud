// Cubes — les icones de l'inventaire et les sprites des objets tenus en main.
//
// Trois familles, toutes dessinees au canvas (aucune image telechargee) :
//   - les blocs « cube » : un petit cube isometrique fait des vraies tuiles de
//     l'atlas (dessus, cote gauche, cote droit). Chaque carre de 32 px est
//     projete en parallelogramme par ctx.setTransform ;
//   - les blocs « croix » (fleurs, torche, ble...) : leur tuile, a plat ;
//   - les objets (numeros >= 256) : un sprite pixel art de 16 x 16 dessine
//     ici selon la silhouette et les couleurs de voxelItems.ts, entoure d'un
//     contour sombre de 1 px calcule automatiquement.
//
// Tout est calcule au premier usage puis garde en cache : un rendu React ne
// redessine jamais rien. Rien ne s'execute au chargement du module ; les
// fonctions exportees exigent `document` (cote client seulement).

import { ATLAS_CELL, ATLAS_COLS, ATLAS_GUTTER, ATLAS_TILE, BLOCKS, type BlockDef } from "./voxel";
import { ITEM_BASE, item, type IconShape } from "./voxelItems";
import { getAtlasCanvas, tileAverageColor } from "./voxelTextures";

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/** Icones deja rendues, par « numero:taille ». */
const urlCache = new Map<string, string>();
/** Sprites pixel art (16 x 16 pour les objets, 32 x 32 pour les croix), par numero. */
const baseCache = new Map<number, HTMLCanvasElement | null>();
/** Sprites 32 x 32 des objets tenus en main, par numero. */
const spriteCache = new Map<number, HTMLCanvasElement>();

/**
 * Icone d'une chose de l'inventaire (bloc, objet, ou 0 pour la main nue),
 * en dataURL PNG carree de `px` pixels. Calculee une fois par (numero, taille).
 * Renvoie une chaine vide hors navigateur.
 */
export function iconDataUrl(id: number, px = 64): string {
  if (typeof document === "undefined") return "";
  const size = Math.max(8, Math.min(512, Math.round(Number.isFinite(px) ? px : 64)));
  const key = `${id}:${size}`;
  let url = urlCache.get(key);
  if (url === undefined) {
    url = renderIcon(id, size).toDataURL("image/png");
    urlCache.set(key, url);
  }
  return url;
}

/**
 * Sprite 32 x 32 transparent d'une chose, pour l'objet tenu en main en 3D :
 * le pixel art de l'objet (agrandi 2x), la tuile d'un bloc « croix », ou la
 * tuile de cote d'un bloc cube. Le canvas est partage : ne pas le modifier.
 */
export function itemSprite(id: number): HTMLCanvasElement {
  let sprite = spriteCache.get(id);
  if (!sprite) {
    sprite = buildSprite(id);
    spriteCache.set(id, sprite);
  }
  return sprite;
}

// ---------------------------------------------------------------------------
// Aiguillage
// ---------------------------------------------------------------------------

function blockOf(id: number): BlockDef | null {
  if (!Number.isInteger(id) || id <= 0 || id >= ITEM_BASE || id >= BLOCKS.length) return null;
  return BLOCKS[id];
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.imageSmoothingEnabled = false;
  return ctx;
}

function renderIcon(id: number, size: number): HTMLCanvasElement {
  const canvas = makeCanvas(size, size);
  const ctx = context(canvas);
  if (!ctx) return canvas;
  const b = blockOf(id);
  if (b && b.shape === "cube") {
    drawCube(ctx, b, size);
  } else {
    const base = pixelBase(id);
    if (base) blitPixelArt(ctx, base, size);
  }
  return canvas;
}

function buildSprite(id: number): HTMLCanvasElement {
  const canvas = makeCanvas(ATLAS_TILE, ATLAS_TILE);
  const ctx = context(canvas);
  if (!ctx) return canvas;
  const b = blockOf(id);
  if (b) {
    const [sx, sy] = tileOrigin(b.shape === "croix" ? b.tiles[0] : b.tiles[1]);
    ctx.drawImage(getAtlasCanvas(), sx, sy, ATLAS_TILE, ATLAS_TILE, 0, 0, ATLAS_TILE, ATLAS_TILE);
  } else {
    const base = pixelBase(id);
    if (base) ctx.drawImage(base, 0, 0, ATLAS_TILE, ATLAS_TILE);
  }
  return canvas;
}

/** Sprite pixel art (avec contour) d'une chose qui n'est pas un bloc cube. */
function pixelBase(id: number): HTMLCanvasElement | null {
  const known = baseCache.get(id);
  if (known !== undefined) return known;
  let result: HTMLCanvasElement | null = null;
  const b = blockOf(id);
  if (id === 0) {
    const p = pixels(16, 16);
    grid(p, fixedPalette(), FIST);
    outline(p, 0.36, 255);
    result = toCanvas(p);
  } else if (b) {
    result = crossTile(b.tiles[0]);
  } else {
    const def = item(id);
    if (def) {
      const p = pixels(16, 16);
      SHAPES[def.icon.shape](p, palette(def.icon.colors));
      outline(p, 0.32, 255);
      result = toCanvas(p);
    }
  }
  baseCache.set(id, result);
  return result;
}

/** Agrandit un sprite sans lissage, a l'echelle entiere la plus proche si possible. */
function blitPixelArt(ctx: CanvasRenderingContext2D, src: HTMLCanvasElement, size: number): void {
  const n = src.width;
  const whole = Math.floor(size / n) * n;
  const w = whole >= size * 0.8 ? whole : size;
  const o = Math.floor((size - w) / 2);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, o, o, w, w);
}

// ---------------------------------------------------------------------------
// Blocs : cube isometrique et croix
// ---------------------------------------------------------------------------

/** Coin haut-gauche du dessin 32 x 32 de la tuile t dans l'atlas. */
function tileOrigin(t: number): [number, number] {
  return [(t % ATLAS_COLS) * ATLAS_CELL + ATLAS_GUTTER, Math.floor(t / ATLAS_COLS) * ATLAS_CELL + ATLAS_GUTTER];
}

/**
 * Projette la tuile sur le parallelogramme (o, o + a, o + a + b, o + b), puis
 * l'assombrit (voile noir limite aux pixels deja peints de cette face).
 */
function face(
  ctx: CanvasRenderingContext2D, atlas: HTMLCanvasElement, tile: number,
  ox: number, oy: number, ax: number, ay: number, bx: number, by: number, dim: number,
): void {
  const [sx, sy] = tileOrigin(tile);
  const k = 1 / ATLAS_TILE;
  ctx.setTransform(ax * k, ay * k, bx * k, by * k, ox, oy);
  ctx.drawImage(atlas, sx, sy, ATLAS_TILE, ATLAS_TILE, 0, 0, ATLAS_TILE, ATLAS_TILE);
  if (dim > 0) {
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = `rgba(0, 0, 0, ${dim})`;
    ctx.fillRect(0, 0, ATLAS_TILE, ATLAS_TILE);
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function drawCube(ctx: CanvasRenderingContext2D, b: BlockDef, size: number): void {
  const atlas = getAtlasCanvas();
  const [top, side, bottom] = b.tiles;
  // Proportions du jeu dont on s'inspire : dessus en losange 2:1, aretes
  // verticales 1,2 fois la demi-largeur. Demi-largeur paire : sommets entiers.
  const margin = Math.max(1, Math.round(size * 0.05));
  const hw = Math.max(2, Math.floor((size - margin * 2) / 4.4) * 2);
  const th = hw / 2;
  const sh = Math.round(hw * 1.2);
  const cx = Math.round(size / 2);
  const y0 = Math.round((size - (th * 2 + sh)) / 2);
  // Sommets : T (fond), R (droite), B (avant), L (gauche) ; « b » = en bas.
  const tx = cx, ty = y0;
  const rx = cx + hw, ry = y0 + th;
  const fx = cx, fy = y0 + th * 2;
  const lx = cx - hw, ly = y0 + th;

  ctx.imageSmoothingEnabled = false;
  const silhouette = () => {
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(rx, ry);
    ctx.lineTo(rx, ry + sh);
    ctx.lineTo(fx, fy + sh);
    ctx.lineTo(lx, ly + sh);
    ctx.lineTo(lx, ly);
    ctx.closePath();
  };

  if (b.opaque) {
    // Fond de la couleur moyenne : bouche les joints anticreneles entre faces.
    const [r, g, bl] = tileAverageColor(side);
    ctx.fillStyle = `rgb(${Math.round(r * 140)}, ${Math.round(g * 140)}, ${Math.round(bl * 140)})`;
    silhouette();
    ctx.fill();
  } else if (!b.liquid) {
    // Bloc transparent (verre, feuilles, glace) : on voit les faces du fond.
    face(ctx, atlas, bottom, lx, ly + sh, hw, -th, hw, th, 0.55);
    face(ctx, atlas, side, lx, ly, hw, -th, 0, sh, 0.45);
    face(ctx, atlas, side, tx, ty, hw, th, 0, sh, 0.3);
  }
  face(ctx, atlas, side, lx, ly, hw, th, 0, sh, 0.2);
  face(ctx, atlas, side, fx, fy, hw, -th, 0, sh, 0.36);
  face(ctx, atlas, top, lx, ly, hw, -th, hw, th, 0);

  // Lisere clair sur les aretes avant du dessus, contour sombre autour.
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = Math.max(1, size / 72);
  ctx.beginPath();
  ctx.moveTo(lx + 1, ly);
  ctx.lineTo(fx, fy);
  ctx.lineTo(rx - 1, ry);
  ctx.stroke();
  ctx.strokeStyle = "rgba(12, 16, 20, 0.55)";
  ctx.lineWidth = Math.max(1, size / 40);
  silhouette();
  ctx.stroke();

  if (b.liquid) {
    // Eau : le meme cube, un peu transparent.
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = "rgba(0, 0, 0, 0.78)";
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = "source-over";
  }
}

/** Tuile d'un bloc « croix », a plat, avec un contour discret. */
function crossTile(tile: number): HTMLCanvasElement {
  const canvas = makeCanvas(ATLAS_TILE, ATLAS_TILE);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = false;
  const [sx, sy] = tileOrigin(tile);
  ctx.drawImage(getAtlasCanvas(), sx, sy, ATLAS_TILE, ATLAS_TILE, 0, 0, ATLAS_TILE, ATLAS_TILE);
  const img = ctx.getImageData(0, 0, ATLAS_TILE, ATLAS_TILE);
  const p: Pixels = { w: ATLAS_TILE, h: ATLAS_TILE, d: img.data };
  outline(p, 0.3, 190);
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// ---------------------------------------------------------------------------
// Pixel art : couleurs, grilles, contour
// ---------------------------------------------------------------------------

type RGBA = [number, number, number, number];
type Palette = Record<string, RGBA>;
type Painter = (p: Pixels, pal: Palette) => void;

interface Pixels {
  w: number;
  h: number;
  d: Uint8ClampedArray;
}

function pixels(w: number, h: number): Pixels {
  return { w, h, d: new Uint8ClampedArray(w * h * 4) };
}

function toCanvas(p: Pixels): HTMLCanvasElement {
  const canvas = makeCanvas(p.w, p.h);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const img = ctx.createImageData(p.w, p.h);
  img.data.set(p.d);
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function parseColor(hex: string): RGBA {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3 || h.length === 4) h = h.split("").map((ch) => ch + ch).join("");
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(h)) return [255, 0, 255, 255];
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
  return [n(0), n(2), n(4), h.length === 8 ? n(6) : 255];
}

const clamp8 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
const shade = (c: RGBA, f: number, add = 0): RGBA => [clamp8(c[0] * f + add), clamp8(c[1] * f + add), clamp8(c[2] * f + add), c[3]];
const light = (c: RGBA) => shade(c, 1.2, 24);
const dark = (c: RGBA) => shade(c, 0.68);
const withAlpha = (c: RGBA, a: number): RGBA => [c[0], c[1], c[2], a];

/** Couleurs fixes, communes a toutes les icones (lettres des grilles). */
const FIXED: Record<string, string> = {
  w: "#ffffff", k: "#2a2530", s: "#f1ecdc",
  m: "#9b7148", M: "#c29462", n: "#6e4d2f",
  e: "#3f8fd6", E: "#8fd0f5", N: "#27305f",
  g: "#4f8a2f", G: "#86bd52", x: "#d6453a", y: "#f5cd4a", Y: "#fff2a8",
  o: "#e3ae84", O: "#f5cda6", h: "#b27f5c",
};

let fixedCache: Palette | null = null;
function fixedPalette(): Palette {
  if (!fixedCache) {
    fixedCache = {};
    for (const [ch, hex] of Object.entries(FIXED)) fixedCache[ch] = parseColor(hex);
  }
  return fixedCache;
}

/**
 * Palette d'un objet : a/A/q = principale (normale, claire, sombre),
 * b/B/p = secondaire, c/C/r = accent, plus les couleurs fixes. Une couleur
 * transparente (« #00000000 ») est remplacee par une teinte de la principale.
 */
function palette(colors: readonly [string, string, string]): Palette {
  const a = parseColor(colors[0]);
  const b0 = parseColor(colors[1]);
  const c0 = parseColor(colors[2]);
  const b = b0[3] > 0 ? b0 : dark(a);
  const c = c0[3] > 0 ? c0 : light(a);
  return {
    ...fixedPalette(),
    a, A: light(a), q: dark(a),
    b, B: light(b), p: dark(b),
    c, C: light(c), r: dark(c),
    u: withAlpha(light(a), 95),
  };
}

function put(p: Pixels, x: number, y: number, c: RGBA | undefined): void {
  if (!c || x < 0 || y < 0 || x >= p.w || y >= p.h) return;
  const i = (y * p.w + x) * 4;
  p.d[i] = c[0];
  p.d[i + 1] = c[1];
  p.d[i + 2] = c[2];
  p.d[i + 3] = c[3];
}

/**
 * Peint une grille de lettres (« . » = rien). Sans decalage donne, les
 * pixels peints sont centres dans le sprite.
 */
function grid(p: Pixels, pal: Palette, rows: readonly string[], ox?: number, oy?: number): void {
  let x0 = ox ?? 0;
  let y0 = oy ?? 0;
  if (ox === undefined || oy === undefined) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === ".") continue;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    });
    if (minX === Infinity) return;
    if (ox === undefined) x0 = Math.floor((p.w - (maxX - minX + 1)) / 2) - minX;
    if (oy === undefined) y0 = Math.floor((p.h - (maxY - minY + 1)) / 2) - minY;
  }
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch !== ".") put(p, x0 + x, y0 + y, pal[ch]);
    }
  });
}

/** Remplit les pixels pour lesquels `pick` renvoie une lettre (centre du pixel en argument). */
function fill(p: Pixels, pal: Palette, pick: (x: number, y: number) => string | null): void {
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      const ch = pick(x + 0.5, y + 0.5);
      if (ch) put(p, x, y, pal[ch]);
    }
  }
}

/** Manche en diagonale, du bas-gauche vers le haut-droite, 2 px d'epaisseur. */
function handle(p: Pixels, pal: Palette, len: number, lightCh = "C", darkCh = "c"): void {
  for (let k = 0; k < len; k++) {
    put(p, 1 + k, 14 - k, pal[lightCh]);
    put(p, 2 + k, 14 - k, pal[darkCh]);
  }
}

/** Liste de pixels [x, y] d'une meme lettre. */
function dots(p: Pixels, pal: Palette, ch: string, list: readonly (readonly [number, number])[]): void {
  for (const [x, y] of list) put(p, x, y, pal[ch]);
}

const NEIGHBORS: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Contour de 1 px : chaque pixel vide qui touche le dessin prend sa couleur, assombrie. */
function outline(p: Pixels, factor: number, alpha: number): void {
  const src = p.d.slice();
  const { w, h } = p;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3] !== 0) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (const [dx, dy] of NEIGHBORS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = (ny * w + nx) * 4;
        if (src[j + 3] < 40) continue;
        r += src[j];
        g += src[j + 1];
        b += src[j + 2];
        n++;
      }
      if (n === 0) continue;
      p.d[i] = clamp8((r / n) * factor + 6);
      p.d[i + 1] = clamp8((g / n) * factor + 4);
      p.d[i + 2] = clamp8((b / n) * factor + 8);
      p.d[i + 3] = alpha;
    }
  }
}

/** Disque ombre : clair en haut a gauche, sombre en bas a droite, anneau optionnel. */
function disc(
  p: Pixels, pal: Palette, cx: number, cy: number, r: number,
  body: string, lit: string, shadow: string, ringWidth = 1.3, face = body,
): void {
  fill(p, pal, (x, y) => {
    const dx = x - cx, dy = y - cy;
    const d = Math.hypot(dx, dy);
    if (d > r) return null;
    if (d > r - ringWidth) {
      const s = (dx + dy) / r;
      return s < -0.45 ? lit : s > 0.35 ? shadow : body;
    }
    return face;
  });
}

/**
 * Remplit une forme avec un eclairage venu du haut-gauche : bord haut/gauche
 * clair, bord bas/droit sombre, le reste de la couleur du corps.
 */
function shaded(
  p: Pixels, pal: Palette, inside: (x: number, y: number) => boolean,
  body: string, lit: string, dim: string,
): void {
  fill(p, pal, (x, y) => {
    if (!inside(x, y)) return null;
    if (!inside(x - 1, y) || !inside(x, y - 1)) return lit;
    if (!inside(x + 1, y) || !inside(x, y + 1)) return dim;
    return body;
  });
}

// Repere tourne de 45 degres, cale sur l'axe du manche (voir handle()) :
// u avance le long du manche vers le haut-droite, v s'en ecarte vers le
// haut-gauche (v = 0 au milieu du manche).
const along = (x: number, y: number) => (x - y) / Math.SQRT2;
const across = (x: number, y: number) => (16.5 - x - y) / Math.SQRT2;

/** Forme lue dans une grille (« # » = plein), pour shaded(). */
function mask(rows: readonly string[], ox = 0, oy = 0): (x: number, y: number) => boolean {
  return (x, y) => rows[Math.floor(y) - oy]?.[Math.floor(x) - ox] === "#";
}

/** Distance du point (x, y) au segment [(ax, ay), (bx, by)]. */
function segmentDistance(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

// ---------------------------------------------------------------------------
// Les dessins (16 x 16). Lettres : voir palette() et FIXED.
// ---------------------------------------------------------------------------

const FIST = [
  "...OOOOOOOO..",
  "..OooooooooO.",
  "..Oohoohoohoo",
  "..Oohoohoohoo",
  "..ooooooooooh",
  "OOOOOOOoooooh",
  "Ooooooohooooh",
  "hhhhhhhoooooh",
  "..hoooooooooh",
  "...ooooooooh.",
  "...ooooooooh.",
  "...hhhhhhhh..",
];

/** Lame de hache en « D » : dos contre le manche, tranchant a gauche. */
const HACHE = [
  "................",
  "........###.....",
  "......######....",
  ".....#######....",
  "....#######.....",
  "....######......",
  "....#####.......",
  "....####........",
  ".....##.........",
];

const PIOCHE = [
  "................",
  "......AAAA......",
  "....AAaaaaAA....",
  "...AbbbbbbaaA...",
  "..Ab......bbaA..",
  ".Ab........baA..",
  "............baA.",
  "............baA.",
  "............baA.",
  "............baA.",
  "............ba..",
  "............ba..",
  "...........ba...",
  "..........ba....",
  "..........a.....",
];

const HOUE = [
  "................",
  "................",
  ".....AAAAAAAA...",
  ".....aaaaaaaab..",
  ".....ab.........",
  ".....b..........",
];

const EPEE = [
  "................",
  ".............Aa.",
  "............Aab.",
  "...........Aab..",
  "..........Aab...",
  ".........Aab....",
  "........Aab.....",
  ".......Aab......",
  "..pp..Aab.......",
  "...ppAab........",
  "....pp..........",
  "...Ccpp.........",
  "..Cc..pp........",
  ".qq.............",
  ".q..............",
];

const CASQUE = [
  "..cccccccccc..",
  ".caaaaaaaaaab.",
  ".caAaaaaaaaab.",
  ".caabbbbbbaab.",
  ".cab......bab.",
  ".cab......bab.",
  ".bbb......bbb.",
];

const PLASTRON = [
  ".cccc....cccc.",
  "caaaab..caaaab",
  "caAaaacccaaaab",
  "caaaaaaaaaaaab",
  "cabbaaaaaaabab",
  ".bb.caaaaab.bb",
  "....caAaaab...",
  "....caaaaab...",
  "....caaaaab...",
  "....cabbbab...",
  "....bbbbbbb...",
];

const JAMBIERES = [
  "cccccccccc",
  "caaaaaaaab",
  "caAaaaaaab",
  "caabbbbaab",
  "caab..caab",
  "caab..caab",
  "caab..caab",
  "caab..caab",
  "caab..caab",
  "cabb..cabb",
  "bbbb..bbbb",
];

const BOTTES = [
  "..ccc....ccc",
  "..cab....cab",
  "..cab....cab",
  "..cab....cab",
  "..cab....cab",
  ".caab...caab",
  "caaab..caaab",
  "caAab..caAab",
  "bbbbb..bbbbb",
];

const CHARBON = [
  "....bbbq....",
  "..bbBBbaaq..",
  ".bBBbaaaaaq.",
  ".bBbaaabbaaq",
  "baaaaabBbaaq",
  "baabaaaabaqq",
  ".aabbaaaaaqq",
  ".aaaaaqaaqq.",
  "..qaaqqqqq..",
  "....qqqq....",
];

const MINERAI = [
  "....cc.......",
  "...cCac..cc..",
  "..cCaaab.cab.",
  ".cCaaaaabaaab",
  ".caaaCaaaaaab",
  "caaaaaaabaaab",
  "caaabaaaaaabb",
  ".aaaaaaCaaab.",
  ".baaaaaaaabb.",
  "..bbaaaaabb..",
  "....bbbbb....",
];

const LINGOT = [
  ".........c.....",
  ".......ccacc...",
  ".....ccaaaaaaa.",
  "...ccaaaaaaabb.",
  ".ccaaaaaaabbbb.",
  ".ppaaaaabbbbbb.",
  ".ppppabbbbbb...",
  ".ppppbbbbb.....",
  "...ppbbb.......",
  ".....b.........",
];

const PEPITE = [
  "......cc....",
  ".....cCab...",
  "..cc.aaab...",
  ".cCab.bb.cc.",
  ".aaab...cCab",
  "..bb....aaab",
  "....cc...bb.",
  "...cCab.....",
  "...aaab.....",
  "....bb......",
];

const GEMME = [
  "...cccccc...",
  "..cCCcCCab..",
  ".cCaacaaabb.",
  "cccccccccbbb",
  "aaaaaaaaabbb",
  ".aaaaaaaabb.",
  "..aaaaaabb..",
  "...aaaabb...",
  "....aabb....",
  ".....ab.....",
];

const SILEX = [
  ".....cc.....",
  "....cCab....",
  "...cCaaab...",
  "...cCaaaab..",
  "..cCaaaaabb.",
  "..caaaaaaabb",
  ".caaaaabaabb",
  ".aaaaabbaabb",
  ".aaaabbbabbb",
  "..abbbbbbbb.",
  "...bbbbbb...",
];

const FICELLE = [
  "......aab....",
  ".....a...b...",
  "....a.....b..",
  "....a.....b..",
  ".....b...a...",
  "......bba....",
  "....aa.......",
  "...a.........",
  "..a..........",
  "..b..........",
  "...b....a....",
  "....bbaa.....",
];

const CUIR = [
  "..cc......cc..",
  "..caaaaaaaab..",
  "...aaaaaaaab..",
  "...aaCaaaaab..",
  "..caaaaabaab..",
  "..caaaaaaaaab.",
  "...aaaaaaaab..",
  "...aabaaaaab..",
  "..caaaaaaaab..",
  "..caaaaaaaaab.",
  "..bb......bb..",
];

const POUDRE = [
  "......A......",
  "....A.aa.a...",
  "...aaAaaaa...",
  "..aAaabaaba..",
  ".aaaaabaaaab.",
  "aaAabaaaabbbb",
  ".bbbbbbbbbbb.",
];

const BRIQUE = [
  "...cccccccccc",
  "..cCccccCcccp",
  ".ccccccCcccpp",
  "aaaaaaaaaabpp",
  "aaqaaaaqaabpp",
  "aaaaaaaaaabp.",
  "aaaaqaaaaab..",
  "bbbbbbbbbb...",
];

const PAPIER = [
  "aaaaaaaaaq..",
  "aAAAAAAAaaq.",
  "abbbbbbbaaaq",
  "aaaaaaaaaaab",
  "abbbbbbbbbab",
  "aaaaaaaaaaab",
  "abbbbbbbbbab",
  "aaaaaaaaaaab",
  "abbbbbbaaaab",
  "aaaaaaaaaaab",
  "bbbbbbbbbbbb",
];

const LIVRE = [
  "..qaaaaaaaa.",
  ".qqAAAAAAAAb",
  ".qqaccccccab",
  ".qqacaaaacab",
  ".qqaccccccab",
  ".qqaaaaaaaab",
  ".qqaaaaaaaab",
  ".qqaaaaaaaab",
  ".qqaaaaaaaab",
  ".qqaaaaaaaab",
  ".qqqqqqqqqqp",
  "..bpbpbpbpbp",
  "...ppppppppp",
];

const SUCRE = [
  "...wwwwa...",
  "...waaab...",
  "...aaaab...",
  "...aaaab...",
  "...bbbbp...",
  "wwwwa.wwwwa",
  "waaab.waaab",
  "aaaab.aaaab",
  "aaaab.aaaab",
  "bbbbp.bbbbp",
];

const BLE = [
  ".c...c...c.",
  "cac.cac.cac",
  "aca.aca.aca",
  "cac.cac.cac",
  "aca.aca.aca",
  ".b...b...b.",
  "..b..b..b..",
  "...b.b.b...",
  "....bbb....",
  "....ppp....",
  "....bbb....",
  "...b.b.b...",
  "..b..b..b..",
];

const GRAINES = [
  "....ab.......",
  ".............",
  ".ab......ab..",
  ".............",
  "......ab.....",
  "..........ab.",
  "..ab.........",
  ".............",
  ".......ab....",
  "...ab........",
];

/** Bol : I = interieur, J = reflet de l'interieur. */
const BOL = [
  "...AAAAAAA...",
  ".AAIIIIIIIAA.",
  "AaIIJIIIIIIqa",
  "aAAIIIIIIAAaq",
  "aaaAAAAAAAaaq",
  ".aaaaaaaaaaq.",
  "..aaaaaaaaq..",
  "...qqqqqqq...",
];

const SOUPE = [
  "...BBBBBBB...",
  ".BBaacaaAaBB.",
  "BaaxwaaacaaaB",
  "bBaaaaAaxaaBp",
  "bbBBBBBBBBBbp",
  ".bbbbbbbbbbp.",
  "..bbbbbbbbp..",
  "...ppppppp...",
];

const SALADE = [
  ".....gg......",
  "..aa.gGcc....",
  ".aAaaGccCcaa.",
  "BaaaCcaaaaAaB",
  "bBBBBBBBBBBbp",
  ".bbbbbbbbbbp.",
  "..bbbbbbbbp..",
  "...ppppppp...",
];

/** Seau : I = interieur, J = reflet de l'interieur. */
const SEAU = [
  ".AAAAAAAAAAA.",
  "AIIIIIIIIIIIa",
  "aAIJJIIIIIAaq",
  "aaAAAAAAAAaaq",
  ".aaaaaaaaaaq.",
  ".aAaaaaaaaaq.",
  ".aAaaaaaaaaq.",
  "..aAaaaaaaq..",
  "..aAaaaaaaq..",
  "..aaaaaaaaq..",
  "..bbbbbbbbb..",
];

/** Fiole : G/H = verre, u = vide, L/l = liquide, K = bouchon. */
const FIOLE = [
  "....KKK....",
  "....GuH....",
  "....GuH....",
  "...GuuuH...",
  "..GuuuuuH..",
  ".GllllllwH.",
  "GwLLLLLLLLH",
  "GwLLLLLLLLH",
  "GLLLLLLLLLH",
  "GLLLLLLLLLH",
  ".GLLLLLLLH.",
  "..HHHHHHH..",
];

const GOURDE = [
  ".....cc.....",
  ".....pp.....",
  "...aaaaaa...",
  "..aAAaaaab..",
  ".aAaaaaaaab.",
  ".aAacacacab.",
  ".aaaaaaaaab.",
  ".aaaaaaaabb.",
  "..aaaaaabb..",
  "...bbbbbb...",
];

const FLECHE = [
  "................",
  "..........BBBBB.",
  "...........bbbb.",
  "............bpb.",
  "...........a.pb.",
  "..........a...p.",
  ".........a......",
  "........a.......",
  ".......a........",
  "......a.........",
  ".c...a..........",
  ".cc.a...........",
  "..ca............",
  "..acc...........",
  ".n..cc..........",
];

const ARC = [
  "................",
  "..........aaab..",
  "........aaccb...",
  "......aacc.b....",
  ".....rcc..b.....",
  "....rr...b......",
  "...ac...b.......",
  "...ac..b........",
  "..ac..b.........",
  "..ac.b..........",
  ".acb............",
  ".acb............",
  ".ab.............",
  ".b..............",
];

const BOUCLIER = [
  "BBBBBBBBBBBb",
  "BAaacaacaaap",
  "BAaacaacaaap",
  "BaaacaacaaAp",
  "BaaacBbcaaap",
  "BaaaBBbpaaap",
  "BaaacbpcaaAp",
  "BaaacaacaaAp",
  ".Baacaacaap.",
  ".Baacaacaap.",
  "..Bacaacap..",
  "...Bcaacp...",
  "....bppp....",
];

const TEINTURE = [
  "....aa....",
  "....aa....",
  "...aaaa...",
  "..aAaaaa..",
  ".aAaaaaaq.",
  ".acaaaaaq.",
  "aAcaaaaaaq",
  "aAAaaaaaaq",
  "aaAaaaaaqq",
  ".aaaaaaqq.",
  "..qqqqqq..",
];

/** Pomme : L = feuille. */
const POMME = [
  "......n.....",
  "......nLL...",
  "..aaa.nLLL..",
  ".aAAaaaaaaa.",
  "aAAaaaaaaaab",
  "aAaaaaaaaaab",
  "aaaaaaaaaaab",
  "aaaaaaaaaabb",
  ".aaaaaaaaab.",
  ".aaaaaaaabb.",
  "..abbbbbbb..",
  "...bb..bb...",
];

const POMME_CARAMEL = [
  ".....mM.....",
  ".....mM.....",
  ".....mn.....",
  "..aaamnaaa..",
  ".acCaaaaaaq.",
  "acCaaaaaaaaq",
  "acaaaaaaaaaq",
  "aaaaaaaaaaaq",
  "aaaaaaaaaaqq",
  ".aaaaaaaaqq.",
  "..aqqaqqqq..",
  "...q..q.....",
];

const GATEAU = [
  "......aa......",
  "....aacaaa....",
  "..aaaaaaacaa..",
  "aacaaaaaaaaaaa",
  "aaaaacaaaaaaqq",
  "baaaaaaaaaqqqp",
  "bbbbaaaaqqpppp",
  "bbbbbaaqqppppp",
  "bbbbbbbppppppp",
  "..bbbbbppppp..",
  "....bbbppp....",
  "......bp......",
];

const TARTE = [
  "...ccccccc...",
  ".ccCaaaaaCcc.",
  "cCaaAAaaaaaCc",
  "cCaaaaaaaaaCc",
  ".ccCaaaaaCcc.",
  "bcccccccccccb",
  "bbcbcbcbcbcbb",
  ".bbbbbbbbbbb.",
  "...ppppppp...",
];

const TRANCHE = [
  "AAAAAAAAAAAAA",
  "GaaaacaaacaaG",
  ".GaaaaaaaaaG.",
  ".bGacaacaaGb.",
  "..bGaaaaaGb..",
  "...bGGGGGb...",
  "....bbbbb....",
];

const VIANDE = [
  "...cccc......",
  ".ccaaaacc....",
  "caaabbaaac...",
  "caabbbaaaacc.",
  ".caabaaacaaac",
  "..caaaaaaabaq",
  "...qaacaabbaq",
  "....qaaaaaaq.",
  ".....qqaaqq..",
  ".......qq....",
];

const SHAPES: Record<IconShape, Painter> = {
  pioche: (p, pal) => { handle(p, pal, 10); grid(p, pal, PIOCHE, 0, 0); },
  hache: (p, pal) => {
    handle(p, pal, 11);
    shaded(p, pal, mask(HACHE), "a", "A", "b");
  },
  pelle: (p, pal) => {
    handle(p, pal, 9);
    shaded(p, pal, (x, y) => {
      const u = (along(x, y) - 6.3) / 3.3, v = across(x, y) / 2.3;
      return u * u + v * v <= 1;
    }, "a", "A", "b");
  },
  houe: (p, pal) => { handle(p, pal, 11); grid(p, pal, HOUE, 0, 0); },
  epee: (p, pal) => grid(p, pal, EPEE, 0, 0),
  casque: (p, pal) => grid(p, pal, CASQUE),
  plastron: (p, pal) => grid(p, pal, PLASTRON),
  jambieres: (p, pal) => grid(p, pal, JAMBIERES),
  bottes: (p, pal) => grid(p, pal, BOTTES),
  baton: (p, pal) => {
    handle(p, pal, 12, "a", "b");
    dots(p, pal, "p", [[6, 9], [10, 5]]);
  },
  charbon: (p, pal) => grid(p, pal, CHARBON),
  minerai: (p, pal) => grid(p, pal, MINERAI),
  lingot: (p, pal) => grid(p, pal, LINGOT),
  pepite: (p, pal) => grid(p, pal, PEPITE),
  gemme: (p, pal) => grid(p, pal, GEMME),
  silex: (p, pal) => grid(p, pal, SILEX),
  ficelle: (p, pal) => grid(p, pal, FICELLE),
  cuir: (p, pal) => grid(p, pal, CUIR),
  os: (p, pal) => shaded(p, pal, (x, y) => {
    if (segmentDistance(x, y, 4.5, 11.5, 11.5, 4.5) <= 1.05) return true;
    for (const [kx, ky] of [[12.4, 5.4], [10.6, 3.6], [5.4, 12.4], [3.6, 10.6]]) {
      if (Math.hypot(x - kx, y - ky) <= 1.6) return true;
    }
    return false;
  }, "a", "A", "b"),
  poudre: (p, pal) => grid(p, pal, POUDRE),
  brique: (p, pal) => grid(p, pal, BRIQUE),
  papier: (p, pal) => grid(p, pal, PAPIER),
  livre: (p, pal) => grid(p, pal, LIVRE),
  sucre: (p, pal) => grid(p, pal, SUCRE),
  ble: (p, pal) => grid(p, pal, BLE),
  graines: (p, pal) => grid(p, pal, GRAINES),
  bol: (p, pal) => grid(p, { ...pal, I: pal.p, J: pal.q }, BOL),
  seau: (p, pal) => grid(p, { ...pal, I: dark(pal.b), J: pal.p }, SEAU),
  seauEau: (p, pal) => grid(p, { ...pal, I: pal.c, J: pal.C }, SEAU),
  fiole: (p, pal) => grid(p, { ...pal, G: pal.a, H: pal.b, K: pal.a, L: pal.u, l: pal.u }, FIOLE, 2, 2),
  fioleEau: (p, pal) => grid(p, { ...pal, G: pal.a, H: pal.b, K: pal.m, L: pal.c, l: pal.C }, FIOLE, 2, 2),
  gourde: (p, pal) => grid(p, pal, GOURDE),
  gourdeEau: (p, pal) => {
    grid(p, pal, GOURDE, 1, 3);
    grid(p, pal, ["..c.", ".cC.", "cCcc", ".cc."], 11, 1);
  },
  fleche: (p, pal) => grid(p, pal, FLECHE, 0, 0),
  arc: (p, pal) => grid(p, pal, ARC, 0, 0),
  bouclier: (p, pal) => grid(p, pal, BOUCLIER),
  boussole: (p, pal) => {
    disc(p, pal, 8, 8, 6.4, "a", "A", "q", 1.8, "c");
    dots(p, pal, "b", [[8, 7], [9, 6], [10, 5]]);
    dots(p, pal, "k", [[7, 8], [6, 9], [5, 10]]);
    dots(p, pal, "q", [[7, 7], [8, 8]]);
  },
  horloge: (p, pal) => {
    disc(p, pal, 8, 8, 6.4, "a", "A", "q", 1.8, "b");
    fill(p, pal, (x, y) => (Math.hypot(x - 8, y - 8) <= 4.6 && y > 8 ? "N" : null));
    dots(p, pal, "Y", [[5, 6], [6, 6], [5, 5], [6, 5]]);
    dots(p, pal, "w", [[10, 10]]);
    dots(p, pal, "k", [[8, 3], [8, 4]]);
  },
  teinture: (p, pal) => grid(p, pal, TEINTURE),
  pomme: (p, pal) => grid(p, { ...pal, L: pal.c }, POMME),
  pommeDoree: (p, pal) => {
    grid(p, { ...pal, L: pal.c }, POMME);
    dots(p, pal, "w", [[4, 6], [11, 9]]);
  },
  pain: (p, pal) => fill(p, pal, (x, y) => {
    const u = ((x - 8) - (y - 8)) / Math.SQRT2;
    const v = ((x - 8) + (y - 8)) / Math.SQRT2;
    if ((u / 6.6) ** 2 + (v / 3.1) ** 2 > 1) return null;
    for (const s of [-3, 0, 3]) if (Math.abs(u - s) < 0.75 && v < 0.2 && v > -2.4) return "b";
    return v < -1.3 ? "c" : v > 1.5 ? "b" : "a";
  }),
  cookie: (p, pal) => {
    disc(p, pal, 8, 8, 6.2, "a", "A", "q", 1.3);
    dots(p, pal, "b", [[6, 5], [10, 5], [5, 8], [8, 8], [9, 8], [11, 9], [6, 11], [9, 11], [7, 4]]);
  },
  gateau: (p, pal) => grid(p, pal, GATEAU),
  tarte: (p, pal) => grid(p, pal, TARTE),
  tranche: (p, pal) => grid(p, pal, TRANCHE),
  soupe: (p, pal) => grid(p, pal, SOUPE),
  viande: (p, pal) => grid(p, pal, VIANDE),
  salade: (p, pal) => grid(p, pal, SALADE),
  galette: (p, pal) => fill(p, pal, (x, y) => {
    const dx = (x - 8) / 6.8, dy = (y - 8.5) / 4.4;
    if (dx * dx + dy * dy > 1) return null;
    if (dy < -0.6) return "A";
    if (dy > 0.6) return "b";
    return (Math.round(x + y) % 4 === 0 && Math.abs(dx) < 0.8) ? "b" : "a";
  }),
  brochette: (p, pal) => {
    for (let k = 0; k < 14; k++) put(p, 1 + k, 14 - k, pal.a);
    disc(p, pal, 4.5, 11.5, 2.4, "b", "B", "p", 1);
    disc(p, pal, 8, 8, 2.4, "c", "C", "r", 1);
    disc(p, pal, 11.5, 4.5, 2.4, "b", "B", "p", 1);
    dots(p, pal, "w", [[7, 7], [9, 8]]);
  },
  bonbon: (p, pal) => {
    fill(p, pal, (x, y) => {
      const d = Math.hypot(x - 8, y - 8);
      if (d > 3.6) return null;
      return (Math.floor(x) + Math.floor(y)) % 4 < 2 ? "b" : "a";
    });
    dots(p, pal, "r", [[3, 7], [3, 8], [12, 7], [12, 8]]);
    dots(p, pal, "c", [[2, 6], [2, 7], [2, 8], [2, 9], [13, 6], [13, 7], [13, 8], [13, 9], [1, 5], [1, 7], [1, 9], [14, 5], [14, 7], [14, 9]]);
    dots(p, pal, "C", [[1, 6], [1, 8], [1, 10], [14, 6], [14, 8], [14, 10]]);
  },
  jus: (p, pal) => {
    grid(p, { ...pal, G: pal.b, H: dark(pal.b), K: pal.m, L: pal.a, l: pal.A }, FIOLE, 2, 2);
    dots(p, pal, "s", [[4, 10], [5, 10], [6, 10], [7, 10], [8, 10], [9, 10], [10, 10], [4, 11], [5, 11], [9, 11], [10, 11]]);
    dots(p, pal, "q", [[6, 11], [7, 11], [8, 11]]);
  },
  the: (p, pal) => {
    grid(p, { ...pal, G: pal.b, H: dark(pal.b), K: pal.m, L: pal.a, l: pal.A }, FIOLE, 2, 2);
    dots(p, pal, "k", [[7, 5], [7, 6], [7, 7], [8, 8]]);
    dots(p, pal, "c", [[7, 9], [8, 9], [9, 9], [7, 10], [8, 10], [9, 10], [7, 11], [8, 11], [9, 11]]);
    dots(p, pal, "w", [[8, 10]]);
  },
  pommeCaramel: (p, pal) => grid(p, pal, POMME_CARAMEL),
};
