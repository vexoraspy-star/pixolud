// Cubes — l'atlas des textures, dessine au canvas en pixel art.
//
// Palette « prairie lumineuse » : herbe tendre, bois miel, pierre aux tons
// doux. Tout est dessine ici, rectangle par rectangle : aucune image
// telechargee.
//
// Disposition (contrat avec voxel.ts, constantes ATLAS_*) : 16 x 16 cases de
// 48 px. La tuile t occupe la case (t % 16, floor(t / 16)), ligne 0 en haut du
// canvas ; son dessin de 32 px est au centre de la case, entoure d'une
// gouttiere de 8 px qui prolonge ses bords (et sa transparence). Sans elle,
// le filtrage et les mipmaps melangeraient les tuiles voisines au loin.
//
// Les mipmaps sont construites a la main : chaque pixel d'un niveau prend la
// couleur moyenne de ses pixels opaques et l'alpha MAXIMAL de ses quatre
// pixels. Avec la reduction habituelle, les plantes decoupees (alphaTest)
// s'effaceraient a quelques blocs de distance.

import * as THREE from "three";
import {
  ATLAS_CELL, ATLAS_COLS, ATLAS_GUTTER, ATLAS_ROWS, ATLAS_TILE, COULEURS, TILE,
  TILE_BETON, TILE_LAINE, TILE_LAMPE_COULEUR, TILE_TERRE_CUITE_TEINTEE, TILE_VERRE_TEINTE,
} from "./voxel";

const LARGEUR = ATLAS_COLS * ATLAS_CELL;
const HAUTEUR = ATLAS_ROWS * ATLAS_CELL;
const NB_TUILES = ATLAS_COLS * ATLAS_ROWS;
/** Cote d'une tuile : tous les dessins ci-dessous sont en coordonnees 0..31. */
const N = ATLAS_TILE;
const NB_COULEURS = COULEURS.length;
/** Etapes de la texture de fissures (bloc en train d'etre casse). */
const ETAPES_FISSURES = 8;

// ---------------------------------------------------------------------------
// Couleurs
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

function hexVersRgb(hex: string): RGB {
  const v = parseInt(hex.slice(1, 7), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function rgbVersHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Melange deux couleurs #rrggbb (t = 0 : a, t = 1 : b). */
function melange(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexVersRgb(a);
  const [br, bg, bb] = hexVersRgb(b);
  return rgbVersHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

const eclaircir = (c: string, t: number) => melange(c, "#ffffff", t);
const assombrir = (c: string, t: number) => melange(c, "#000000", t);

/** Ajoute une opacite (0..1) a une couleur #rrggbb. */
function avecAlpha(c: string, a: number): string {
  return c.slice(0, 7) + Math.round(a * 255).toString(16).padStart(2, "0");
}

const TERRE_CUITE = "#9d5e45";
/** Terre cuite teintee : la couleur ternie par le brun de l'argile. */
const teinteTerreCuite = (hex: string) => assombrir(melange(hex, TERRE_CUITE, 0.42), 0.1);
/** Fond d'une lampe coloree : la couleur eclaircie. */
const teinteLampe = (hex: string) => eclaircir(hex, 0.15);

/** Couleur de fond des tuiles dessinees a la main (0 a 74). */
const COULEURS_DE_BASE = [
  // 0 a 35 : les tuiles d'origine.
  "#78ad52", "#967352", "#967352", "#9aa4a5", "#a6afb0", "#ead5a5", "#d7bf8d", "#d2b886", "#caa16b", "#8c6748",
  "#c49a68", "#50874c", "#bce9e7", "#53b9c6", "#be7864", "#454e59", "#c89f7f", "#edc95e", "#69ded4", "#493e60",
  "#a7aaa3", "#eef4ef", "#b5dfe9", "#414953", "#81ac61", "#65965b", "#e8e3d6", "#c96668", "#759dc7", "#e8c764",
  "#87ad65", "#f2b64b", "#e97c87", "#f6cf65", "#81b65b", "#ffe3a2",
  // 36 a 74 : les blocs de la fabrication.
  "#d0a672", "#c49a68", "#8e9696", "#a2a9a9", "#98a1a2", "#aab2b2", "#d7bf8d", "#8c6748", "#d98a2b", "#dc8d2e",
  "#dc8d2e", "#8fbf45", "#8dbf45", "#c9a13a", "#cfa83e", "#d6dadb", "#f0c43c", "#5fdcd4", "#26262b", "#8f9c8a",
  "#5b412e", "#6fae4c", "#7fb64f", "#d8b64c", "#a07352", "#c8352f", "#9ccc6a", TERRE_CUITE, "#e3ad4f", "#6e4b2f",
  "#dcc793", "#8d9a8a", "#949d9e", "#e9e2cc", "#e3dbc2", "#9fa8a9", "#c8703a", "#c26a36", "#4f7fe0",
];

function couleursDesTuiles(): string[] {
  const res: string[] = [];
  for (let t = 0; t < NB_TUILES; t++) res.push(t < COULEURS_DE_BASE.length ? COULEURS_DE_BASE[t] : "#000000");
  COULEURS.forEach((c, i) => {
    res[TILE_LAINE + i] = c.hex;
    res[TILE_VERRE_TEINTE + i] = c.hex;
    res[TILE_BETON + i] = c.hex;
    res[TILE_TERRE_CUITE_TEINTEE + i] = teinteTerreCuite(c.hex);
    res[TILE_LAMPE_COULEUR + i] = teinteLampe(c.hex);
  });
  return res;
}

/**
 * Couleur de fond de chaque tuile (une par case de l'atlas, #000000 pour les
 * cases vides). Approximative : tileAverageColor donne la vraie moyenne.
 */
export const TILE_COLORS: readonly string[] = couleursDesTuiles();

// ---------------------------------------------------------------------------
// Pinceau : dessine dans une tuile, rogne a ses 32 x 32 px
// ---------------------------------------------------------------------------

interface Pinceau {
  tile: number;
  /** Couleur de fond de la tuile (TILE_COLORS). */
  color: string;
  rect(x: number, y: number, w: number, h: number, fill: string): void;
  /** Rend transparente une zone (toute la tuile par defaut). */
  clear(x?: number, y?: number, w?: number, h?: number): void;
  random(): number;
  /** Taches jointes de 2 px : du volume sans bruit pixel par pixel. */
  clusters(count: number, shades: readonly string[], size?: number): void;
}

function origine(tile: number): { ox: number; oy: number } {
  return {
    ox: (tile % ATLAS_COLS) * ATLAS_CELL + ATLAS_GUTTER,
    oy: Math.floor(tile / ATLAS_COLS) * ATLAS_CELL + ATLAS_GUTTER,
  };
}

function creerPinceau(ctx: CanvasRenderingContext2D, tile: number): Pinceau {
  const { ox, oy } = origine(tile);
  // Une graine par tuile garde les autres motifs stables lors des retouches.
  let state = 731 + tile * 9743;
  const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  // Tout est rogne a la tuile : un motif ne deborde jamais sur la gouttiere.
  const zone = (x: number, y: number, w: number, h: number): [number, number, number, number] | null => {
    const x0 = Math.max(0, x), y0 = Math.max(0, y);
    const x1 = Math.min(N, x + w), y1 = Math.min(N, y + h);
    return x1 > x0 && y1 > y0 ? [ox + x0, oy + y0, x1 - x0, y1 - y0] : null;
  };
  const rect = (x: number, y: number, w: number, h: number, fill: string) => {
    const z = zone(x, y, w, h);
    if (!z) return;
    ctx.fillStyle = fill;
    ctx.fillRect(z[0], z[1], z[2], z[3]);
  };
  const clear = (x = 0, y = 0, w = N, h = N) => {
    const z = zone(x, y, w, h);
    if (z) ctx.clearRect(z[0], z[1], z[2], z[3]);
  };
  const clusters = (count: number, shades: readonly string[], size = 4) => {
    for (let n = 0; n < count; n++) {
      const px = Math.floor(random() * 16) * 2, py = Math.floor(random() * 16) * 2;
      const shade = shades[Math.floor(random() * shades.length)];
      const width = size + Math.floor(random() * 3) * 2;
      rect(px, py, width, 2, shade);
      rect(px + 2, py + 2, Math.max(2, width - 2), 2, shade);
    }
  };
  return { tile, color: TILE_COLORS[tile], rect, clear, random, clusters };
}

/** Cadre d'un pixel : `haut` en haut et a gauche, `bas` en bas et a droite. */
function cadre(p: Pinceau, x: number, y: number, w: number, h: number, haut: string, bas: string): void {
  p.rect(x, y, w, 1, haut);
  p.rect(x, y, 1, h, haut);
  p.rect(x, y + h - 1, w, 1, bas);
  p.rect(x + w - 1, y, 1, h, bas);
}

// ---------------------------------------------------------------------------
// Motifs partages
// ---------------------------------------------------------------------------

interface Bois { fond: string; joint: string; clair: string; ombre: string; fil: string; filSombre: string }

const BOIS_MIEL: Bois = { fond: "#c49a68", joint: "#96714f", clair: "#dfb985", ombre: "#ad8557", fil: "#d4aa77", filSombre: "#b48a5b" };
const BOIS_TABLE: Bois = { fond: "#d0a672", joint: "#9c7650", clair: "#e8c592", ombre: "#b58d5c", fil: "#dcb582", filSombre: "#bb9262" };
const BOIS_SOMBRE: Bois = { fond: "#6e4b2f", joint: "#46301f", clair: "#8c6541", ombre: "#5a3d26", fil: "#7d5838", filSombre: "#5f4029" };
const BOIS_CLAIR: Bois = { fond: "#dcc793", joint: "#ad9766", clair: "#f1e4bc", ombre: "#c6b07d", fil: "#e8d6a6", filSombre: "#cdb784" };

/** Planches horizontales de 8 px, biseautees d'un pixel. */
function planches(p: Pinceau, b: Bois): void {
  const { rect } = p;
  rect(0, 0, N, N, b.fond);
  for (let row = 0; row < 4; row++) {
    const py = row * 8, join = row % 2 ? 9 : 24;
    rect(3, py + 4, 10, 1, b.fil);
    rect(18, py + 6, 11, 1, b.filSombre);
    // Biseau : chaque planche est eclairee en haut et a gauche, ombree en bas et a droite.
    rect(0, py + 1, N, 1, b.clair);
    rect(0, py + 7, N, 1, b.ombre);
    rect(join + 1, py + 1, 1, 6, b.clair);
    rect(join - 1, py + 1, 1, 7, b.ombre);
    rect(0, py, N, 1, b.joint);
    rect(join, py, 1, 8, b.joint);
  }
}

interface Appareil { joint: string; fond: string; clair: string; lumiere: string; creux: string; ombre: string; ombreDroite: string }

const APPAREIL_PIERRE: Appareil = {
  joint: "#899698", fond: "#a6afb0", clair: "#c3cac7", lumiere: "#b8c0bd", creux: "#adb6b3", ombre: "#8f9c9d", ombreDroite: "#97a3a3",
};
const APPAREIL_BRIQUE: Appareil = {
  joint: "#a16e60", fond: "#be7864", clair: "#dd9a82", lumiere: "#d18c75", creux: "#c7836d", ombre: "#ad6b5b", ombreDroite: "#b47261",
};

/** Petites briques de 16 x 8 en quinconce (pierre taillee, briques). */
function appareil(p: Pinceau, a: Appareil): void {
  const { rect } = p;
  rect(0, 0, N, N, a.joint);
  for (let row = 0; row < 4; row++) for (let col = -1; col < 3; col++) {
    const px = col * 16 + (row % 2) * 8, py = row * 8;
    rect(px + 1, py + 1, 15, 7, a.fond);
    rect(px + 3, py + 3, 7, 2, a.creux);
    // Biseau d'un pixel : lumiere en haut et a gauche, ombre en bas et a droite.
    rect(px + 1, py + 1, 15, 1, a.clair);
    rect(px + 1, py + 2, 1, 5, a.lumiere);
    rect(px + 2, py + 7, 14, 1, a.ombre);
    rect(px + 15, py + 2, 1, 6, a.ombreDroite);
  }
}

/** Grosses briques de pierre : deux rangees de 16 px, decalees d'une demi-brique. */
function grossesBriques(p: Pinceau): void {
  const { rect } = p;
  rect(0, 0, N, N, "#98a1a2");
  p.clusters(14, ["#a1aaaa", "#8f999a", "#a8b0b0", "#939d9e"], 6);
  for (let row = 0; row < 2; row++) {
    const py = row * 16;
    for (let k = -1; k < 2; k++) {
      const px = k * 32 + row * 16;
      cadre(p, px, py, 31, 15, "#bcc4c3", "#7d898a");
      rect(px + 1, py + 1, 29, 1, "#aab2b2");
      rect(px, py + 15, 32, 1, "#5f696b");
      rect(px + 31, py, 1, 16, "#5f696b");
    }
  }
}

/** Taches de mousse (plus denses en haut quand `enHaut`). */
function mousse(p: Pinceau, n: number, enHaut: boolean): void {
  const teintes = ["#5f8f45", "#6f9d4f", "#4f7d3b", "#86b05e"];
  for (let k = 0; k < n; k++) {
    const x = Math.floor(p.random() * 16) * 2;
    const r = p.random();
    const y = Math.floor((enHaut ? r * r : r) * 16) * 2;
    const c = teintes[Math.floor(p.random() * teintes.length)];
    const w = 2 + Math.floor(p.random() * 3) * 2;
    p.rect(x, y, w, 2, c);
    p.rect(x + 1, y + 2, Math.max(2, w - 2), 2, c);
    p.rect(x, y, 1, 1, "#9cc36e");
  }
}

interface Fleur { petale: string; haut: string; gauche: string; bas: string; coeur: string; coeurHaut: string }

function fleur(p: Pinceau, f: Fleur): void {
  const { rect } = p;
  rect(15, 15, 2, 17, "#548549"); rect(16, 16, 1, 16, "#8dbb64");
  rect(10, 23, 5, 2, "#7eae58"); rect(8, 21, 4, 2, "#96bf6b");
  rect(17, 20, 5, 3, "#699e50"); rect(20, 18, 4, 2, "#88b95f");
  rect(12, 4, 8, 15, f.petale); rect(8, 8, 16, 7, f.petale);
  rect(12, 4, 6, 2, f.haut);
  rect(8, 8, 4, 3, f.gauche);
  rect(12, 17, 8, 2, f.bas);
  rect(13, 9, 6, 5, f.coeur);
  rect(13, 9, 4, 2, f.coeurHaut);
}

function lampe(p: Pinceau, fond: string, centre: string, coeur: string): void {
  const { rect } = p;
  rect(0, 0, N, N, fond);
  rect(0, 0, 32, 3, "#887153"); rect(0, 29, 32, 3, "#887153");
  rect(0, 0, 3, 32, "#887153"); rect(29, 0, 3, 32, "#887153");
  rect(5, 5, 22, 22, centre); rect(8, 8, 16, 16, coeur);
  for (const px of [1, 28]) for (const py of [1, 28]) rect(px, py, 3, 3, "#bf9e65");
}

/** Terre cuite : aplat mat, marbrures douces. */
function terreCuite(p: Pinceau, fond: string): void {
  const { rect, random } = p;
  rect(0, 0, N, N, fond);
  p.clusters(12, [eclaircir(fond, 0.06), assombrir(fond, 0.07), eclaircir(fond, 0.03)], 6);
  const veine = assombrir(fond, 0.1);
  for (let v = 0; v < 3; v++) {
    let x = Math.floor(random() * 32), y = Math.floor(random() * 32);
    for (let k = 0; k < 9; k++) {
      rect(x, y, 2, 1, veine);
      x = (x + 2) % 32;
      y = (y + (random() < 0.5 ? 1 : 31)) % 32;
    }
  }
}

function metal(
  p: Pinceau,
  m: { fond: string; clair: string; eclat: string; mi: string; sombre: string; rivet: string },
): void {
  const { rect } = p;
  rect(0, 0, N, N, m.fond);
  // Reflets en diagonale sur les deux plaques.
  for (let i = 0; i < 10; i++) {
    rect(4 + i, 13 - i, 2, 1, m.clair);
    rect(18 + i, 28 - i, 2, 1, m.clair);
  }
  for (let i = 0; i < 5; i++) rect(9 + i, 13 - i, 1, 1, m.eclat);
  cadre(p, 0, 0, N, N, m.eclat, m.sombre);
  cadre(p, 1, 1, N - 2, N - 2, m.clair, m.mi);
  // Joint entre les deux plaques.
  rect(2, 15, 28, 1, m.sombre);
  rect(2, 16, 28, 1, m.clair);
  for (const [x, y] of [[3, 3], [27, 3], [3, 27], [27, 27]]) {
    rect(x, y, 2, 2, m.rivet);
    rect(x, y, 1, 1, m.eclat);
  }
}

function citrouilleCote(p: Pinceau): void {
  const { rect, random } = p;
  for (let x = 0; x < N; x++) {
    const k = (x + 3) % 8;
    rect(x, 0, 1, N, k === 0 ? "#bd661b" : k === 1 || k === 7 ? "#e0852c" : k === 3 || k === 4 ? "#fbb24c" : "#f09a32");
  }
  for (let n = 0; n < 16; n++) {
    const x = Math.floor(random() * 32), y = Math.floor(random() * 30);
    const k = (x + 3) % 8;
    if (k > 1 && k < 7) rect(x, y, 1, 2, "#ffc56a");
  }
  rect(0, 0, N, 1, "#b86d1f"); rect(0, 1, N, 1, "#c97a26"); rect(0, 31, N, 1, "#bd661b");
}

/** Visage sculpte de la citrouille-lanterne (dessine deux fois : creux, puis lumiere). */
function visage(p: Pinceau, dx: number, dy: number, feu: string, coeur: string | null): void {
  const { rect } = p;
  for (const ex of [6, 18]) {
    for (let r = 0; r < 4; r++) rect(ex + dx + 3 - r, 8 + dy + r, 2 + 2 * r, 1, feu);
    if (coeur) rect(ex + dx + 3, 10 + dy, 2, 2, coeur);
  }
  rect(15 + dx, 14 + dy, 2, 2, feu);
  rect(6 + dx, 18 + dy, 20, 5, feu);
  rect(8 + dx, 23 + dy, 16, 1, feu);
  if (coeur) rect(9 + dx, 19 + dy, 14, 3, coeur);
}

function champignon(p: Pinceau, chapeau: string, clair: string, dessous: string, points: readonly (readonly number[])[]): void {
  const { rect } = p;
  p.clear();
  rect(14, 21, 4, 11, "#e6dcc4"); rect(14, 21, 1, 11, "#f4ecd8"); rect(17, 21, 1, 11, "#c9bea4");
  rect(11, 20, 10, 1, "#c9b08e");
  rect(8, 14, 16, 6, chapeau); rect(10, 12, 12, 2, chapeau); rect(12, 11, 8, 1, chapeau);
  rect(12, 11, 4, 1, clair); rect(10, 12, 5, 1, clair); rect(8, 14, 3, 2, clair);
  rect(8, 19, 16, 1, dessous); rect(20, 14, 4, 5, assombrir(chapeau, 0.12));
  for (const [x, y, w, h] of points) rect(x, y, w, h, "#f6f1e6");
}

function tuileGres(p: Pinceau, cote: boolean, ombre: string, bande: string, lumiere: string, grain: string): void {
  const { rect, random } = p;
  p.clusters(14, ["#ffffff18", ombre], 6);
  if (cote) {
    for (let row = 6; row < 32; row += 8) {
      rect(0, row, 32, 1, bande); rect(0, row + 1, 32, 1, lumiere);
    }
  } else {
    for (let n = 0; n < 9; n++) rect(Math.floor(random() * 15) * 2, Math.floor(random() * 15) * 2, 2, 1, grain);
  }
}

// ---------------------------------------------------------------------------
// Les tuiles
// ---------------------------------------------------------------------------

function familleTeinte(tile: number, debut: number): number {
  return tile >= debut && tile < debut + NB_COULEURS ? tile - debut : -1;
}

function tuileExiste(tile: number): boolean {
  return tile <= TILE.fleurBleue
    || [TILE_LAINE, TILE_VERRE_TEINTE, TILE_BETON, TILE_TERRE_CUITE_TEINTEE, TILE_LAMPE_COULEUR].some((d) => familleTeinte(tile, d) >= 0);
}

/** Tuiles 0 a 35 : le dessin d'origine, affine (biseaux, reflets). */
function dessinerTuileOrigine(p: Pinceau): void {
  const { tile, color, rect, random, clusters } = p;
  rect(0, 0, N, N, color);

  if (tile === TILE.herbeDessus) {
    clusters(18, ["#80b558", "#73a64f", "#89b95e", "#6fa24c"]);
    for (let n = 0; n < 7; n++) {
      const px = Math.floor(random() * 15) * 2, py = Math.floor(random() * 15) * 2;
      rect(px, py, 2, 4, "#9cc774"); rect(px + 2, py + 2, 2, 2, "#8bbd61");
    }
  } else if (tile === TILE.herbeCote || tile === TILE.terre) {
    clusters(23, ["#a37e58", "#896948", "#9d7953", "#ad8962"]);
    for (let n = 0; n < 4; n++) rect(Math.floor(random() * 14) * 2, 12 + Math.floor(random() * 9) * 2, 3, 2, "#c3a281");
    if (tile === TILE.herbeCote) {
      rect(0, 0, 32, 6, "#78ad52");
      for (let px = 0; px < 32; px += 4) {
        const depth = 2 + Math.floor(random() * 3) * 2;
        rect(px, 6, 4, depth, "#67964b"); rect(px, 5, 4, depth - 1, "#78ad52");
        rect(px, 0, 4, 2, px % 8 ? "#8cbb63" : "#82b459");
      }
    }
  } else if (tile === TILE.pierre || (tile >= TILE.charbon && tile <= TILE.diamant)) {
    rect(0, 0, 32, 32, TILE_COLORS[TILE.pierre]);
    clusters(18, ["#8f9a9b", "#a5aeae", "#939fa0", "#acb4b2"], 6);
    if (tile !== TILE.pierre) {
      const charbon = tile === TILE.charbon;
      for (const [px, py] of [[4, 5], [21, 4], [13, 14], [3, 23], [23, 24]]) {
        rect(px, py + 1, 7, 5, "#778789"); rect(px + 1, py, 5, 5, color);
        rect(px + 1, py, 3, 2, charbon ? "#66717b" : "#ffffff70");
        rect(px + 4, py + 3, 2, 2, "#00000020");
        // Petit reflet d'un pixel qui accroche la lumiere.
        rect(px + 1, py, 1, 1, charbon ? "#8d97a0" : "#ffffffd8");
      }
    }
  } else if (tile === TILE.pierreTaillee || tile === TILE.brique) {
    appareil(p, tile === TILE.pierreTaillee ? APPAREIL_PIERRE : APPAREIL_BRIQUE);
  } else if (tile === TILE.sable || tile === TILE.gresDessus || tile === TILE.gresCote) {
    clusters(14, ["#ffffff18", "#b798621b"], 6);
    if (tile === TILE.sable) {
      for (let n = 0; n < 9; n++) rect(Math.floor(random() * 15) * 2, Math.floor(random() * 15) * 2, 2, 1, "#bc9e6f55");
      rect(2, 9, 8, 1, "#f4e6c3"); rect(18, 25, 10, 1, "#f4e6c3");
    } else if (tile === TILE.gresCote) {
      for (let row = 6; row < 32; row += 8) {
        rect(0, row, 32, 1, "#b3976c"); rect(0, row + 1, 32, 1, "#e6cca0");
      }
    }
  } else if (tile === TILE.troncDessus) {
    rect(0, 0, 32, 32, "#94704b"); rect(2, 2, 28, 28, color);
    for (let inset = 5; inset < 15; inset += 5) {
      rect(inset + 2, inset, 28 - inset * 2, 2, "#a78053");
      rect(inset + 2, 30 - inset, 28 - inset * 2, 2, "#e0b980");
      rect(inset, inset + 2, 2, 28 - inset * 2, "#a78053");
      rect(30 - inset, inset + 2, 2, 28 - inset * 2, "#a78053");
    }
    rect(15, 14, 3, 4, "#9c744a");
  } else if (tile === TILE.troncCote) {
    for (let col = 0; col < 32; col += 8) {
      rect(col, 0, 2, 32, "#76573f"); rect(col + 2, 0, 2, 32, "#a37b50");
      rect(col + 5, 4 + (col % 3) * 5, 2, 13, "#7d5b3f");
      rect(col + 3, 3 + (col % 4) * 5, 2, 8, "#b18a5c");
    }
    rect(19, 18, 5, 7, "#75533b"); rect(20, 20, 3, 3, "#b18a5c");
  } else if (tile === TILE.planches) {
    planches(p, BOIS_MIEL);
  } else if (tile === TILE.feuilles) {
    // Rosettes de feuillage en quinconce, avec une lumiere douce sur le dessus.
    // Les trous du feuillage ajoure sont perces plus tard (voir ajourer).
    rect(0, 0, 32, 32, "#467748");
    for (let row = -1; row < 4; row++) for (let col = -1; col < 4; col++) {
      const px = col * 10 + (row % 2) * 5, py = row * 10;
      rect(px + 2, py + 2, 6, 8, "#58924f"); rect(px, py + 4, 10, 4, "#58924f");
      rect(px + 2, py + 2, 6, 2, "#7ba95a"); rect(px + 2, py + 4, 2, 2, "#6ca153");
      rect(px + 4, py + 8, 4, 2, "#396d43");
    }
  } else if (tile === TILE.eau) {
    clusters(7, ["#64c3cc", "#4cb0c0"], 8);
    for (const [px, py, width] of [[2, 7, 9], [19, 15, 11], [6, 25, 10]]) {
      rect(px, py, width, 1, "#c1eeeb99"); rect(px + 3, py + 1, width - 3, 1, "#8ed6db88");
    }
  } else if (tile === TILE.obsidienne || tile === TILE.socle) {
    clusters(24, tile === TILE.obsidienne ? ["#584b70", "#3b3650", "#635579"] : ["#53606a", "#38424a", "#626c72"], 6);
  } else if (tile === TILE.gravier) {
    clusters(28, ["#b9bab0", "#919b96", "#c4c3b8", "#a2aaa2"], 4);
  } else if (tile === TILE.neige || tile === TILE.glace) {
    clusters(9, tile === TILE.neige ? ["#e0ebe9", "#f6f8ef"] : ["#c6e8ed", "#a8d3e0"], 6);
    if (tile === TILE.glace) {
      for (let n = 0; n < 6; n++) rect(5 + n * 2, 20 - n * 2, 2, 5, "#e6f6f3");
      rect(22, 6, 7, 2, "#e6f6f3");
    }
  } else if (tile === TILE.cactusDessus || tile === TILE.cactusCote) {
    clusters(10, ["#ffffff0c", "#173f2914"]);
    if (tile === TILE.cactusDessus) {
      rect(5, 5, 22, 22, "#91b972"); rect(9, 9, 14, 14, "#739e58"); rect(13, 13, 6, 6, "#b3c888");
    } else for (let col = 3; col < 32; col += 8) {
      rect(col, 0, 2, 32, "#4f804e"); rect(col + 2, 0, 2, 32, "#83ad65");
      for (let row = 4; row < 32; row += 10) rect(col + 3, row + (col % 3), 2, 2, "#decea0");
    }
  } else if (tile >= TILE.laineBlanche && tile <= TILE.laineVerte) {
    // Anciennes laines (plus utilisees) : un tissage discret.
    for (let row = 0; row < 32; row += 4) for (let col = 0; col < 32; col += 4) {
      rect(col, row, 3, 1, "#ffffff13"); rect(col + 3, row + 1, 1, 3, "#0000000b");
    }
  } else if (tile === TILE.verre) {
    // Le verre partage le materiau decoupe : son centre reste transparent.
    p.clear();
    rect(0, 0, 32, 1, "#e0f5ef"); rect(0, 0, 1, 32, "#e0f5ef");
    rect(31, 0, 1, 32, "#9bd5d9"); rect(0, 31, 32, 1, "#9bd5d9");
    for (let n = 0; n < 5; n++) rect(5 + n * 2, 16 - n * 2, 2, 2, "#d5eeed");
    rect(21, 24, 2, 2, "#d5eeed"); rect(23, 22, 2, 2, "#d5eeed");
  } else if (tile === TILE.torche) {
    p.clear();
    rect(13, 13, 6, 19, "#805b40"); rect(13, 13, 2, 19, "#bd945f");
    rect(11, 15, 10, 3, "#635444"); rect(10, 6, 12, 9, "#e89242");
    rect(12, 3, 8, 10, "#f8c65c"); rect(14, 6, 4, 7, "#fff1b4"); rect(16, 1, 2, 4, "#f8c65c");
  } else if (tile === TILE.herbeHaute) {
    p.clear();
    for (const [px, top, shade] of [[5, 15, "#659b4e"], [10, 9, "#91bd67"], [16, 5, "#7aaf55"], [22, 12, "#91bd67"], [27, 18, "#659b4e"]] as const) {
      rect(px, top, 2, 32 - top, shade); rect(px - 2, top - 3, 2, 8, shade);
      rect(px - 4, top - 5, 2, 4, shade); rect(px + 2, top + 7, 2, 4, "#568946");
    }
  } else if (tile === TILE.fleurRouge) {
    p.clear();
    fleur(p, { petale: color, haut: "#ffacac", gauche: "#f89a9f", bas: "#c85e73", coeur: "#ffe09a", coeurHaut: "#fff0bd" });
  } else if (tile === TILE.fleurJaune) {
    p.clear();
    fleur(p, { petale: color, haut: "#ffe699", gauche: "#ffe18a", bas: "#dbab45", coeur: "#b98845", coeurHaut: "#d4ab62" });
  } else if (tile === TILE.lampe) {
    lampe(p, color, "#fff0bd", "#fff7d6");
  }
}

/** Tuiles 36 a 74 : les blocs de la fabrication. */
function dessinerTuileFabrication(p: Pinceau): void {
  const { tile, color, rect, random, clusters } = p;
  const pixel = (x: number, y: number, c: string) => rect(x, y, 1, 1, c);
  rect(0, 0, N, N, color);

  switch (tile) {
    case TILE.tableDessus: {
      planches(p, BOIS_TABLE);
      cadre(p, 0, 0, N, N, "#8a6441", "#7a5738");
      cadre(p, 1, 1, N - 2, N - 2, "#e6c290", "#a47b4d");
      // Grille de fabrication 3 x 3.
      rect(3, 3, 19, 19, "#5b4029");
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const cx = 4 + i * 6, cy = 4 + j * 6;
        rect(cx, cy, 5, 5, "#b88b57");
        rect(cx, cy, 5, 1, "#9c7043"); rect(cx, cy, 1, 5, "#9c7043");
        rect(cx + 1, cy + 4, 4, 1, "#cfa36c"); rect(cx + 4, cy + 1, 1, 4, "#cfa36c");
      }
      // Crayon, marteau et equerre poses a cote.
      rect(25, 2, 2, 2, "#d9867a");
      rect(25, 4, 2, 13, "#e8c24a"); rect(25, 4, 1, 13, "#f6da7a");
      rect(25, 17, 2, 2, "#e8c9a0"); rect(25, 19, 2, 1, "#3b2a1c");
      rect(4, 26, 12, 2, "#8a5a33"); rect(4, 26, 12, 1, "#a8743f");
      rect(15, 23, 4, 7, "#7f878a"); rect(15, 23, 4, 1, "#b9c0c2"); rect(18, 24, 1, 6, "#5f6769");
      rect(23, 23, 2, 6, "#c3c9cb"); rect(23, 27, 6, 2, "#c3c9cb"); rect(23, 23, 1, 6, "#e6eaeb");
      rect(24, 25, 1, 1, "#7f878a"); rect(26, 28, 1, 1, "#7f878a");
      break;
    }
    case TILE.tableCote: {
      planches(p, BOIS_MIEL);
      // Bord du plateau, puis cadre clair.
      rect(0, 0, N, 4, "#8a6441"); rect(0, 0, N, 1, "#b08355"); rect(0, 3, N, 1, "#6d4c31");
      rect(0, 4, 2, 28, "#dcb683"); rect(30, 4, 2, 28, "#dcb683"); rect(0, 30, N, 2, "#dcb683");
      rect(0, 4, 1, 28, "#ecc995"); rect(31, 4, 1, 28, "#b38a5a"); rect(0, 31, N, 1, "#b38a5a");
      // Scie accrochee a gauche.
      pixel(7, 5, "#3b2a1c");
      rect(4, 6, 8, 5, "#7a4f2e"); rect(4, 6, 8, 1, "#9a6a40"); rect(6, 7, 4, 2, "#3f2a1a");
      rect(5, 11, 6, 15, "#c9cfd1"); rect(5, 11, 1, 15, "#eef2f2"); rect(10, 11, 1, 15, "#a9b1b3");
      rect(6, 25, 5, 1, "#a9b1b3");
      for (let y = 12; y < 26; y += 2) pixel(11, y, "#8f989b");
      // Marteau a droite.
      pixel(23, 5, "#3b2a1c");
      rect(18, 7, 11, 4, "#7d8588"); rect(18, 7, 11, 1, "#b7bec0"); rect(18, 10, 11, 1, "#5f6769");
      rect(27, 11, 2, 2, "#7d8588");
      rect(22, 11, 3, 16, "#8a5a33"); rect(22, 11, 1, 16, "#a8743f"); rect(24, 11, 1, 16, "#6b4527");
      break;
    }
    case TILE.fourFace: {
      clusters(16, ["#99a1a1", "#838c8d", "#a2a9a9", "#8a9293"], 4);
      cadre(p, 0, 0, N, N, "#b3baba", "#6b7475");
      cadre(p, 1, 1, N - 2, N - 2, "#a3aaaa", "#7b8485");
      // Rainure au-dessus de la bouche.
      rect(3, 11, 26, 1, "#6c7475"); rect(3, 12, 26, 1, "#aab1b1");
      // Bouche du four : encadrement, fond noir, appui clair.
      rect(7, 15, 18, 14, "#5d6566"); rect(7, 15, 18, 1, "#4b5253");
      rect(8, 16, 16, 12, "#2b2626"); rect(8, 16, 16, 2, "#1f1b1b");
      pixel(8, 16, "#5d6566"); pixel(23, 16, "#5d6566");
      rect(7, 28, 18, 1, "#b3baba");
      // Flammes et braises.
      rect(10, 21, 2, 3, "#f28c28"); rect(14, 20, 3, 4, "#f7a53a"); rect(19, 22, 2, 2, "#f28c28");
      rect(15, 21, 1, 2, "#ffe07a"); pixel(10, 22, "#ffd14a");
      rect(9, 24, 14, 4, "#7a2e18");
      for (const [x, y, c] of [
        [9, 25, "#f08a24"], [11, 24, "#ffd14a"], [13, 26, "#f08a24"], [15, 24, "#fff0a0"], [17, 25, "#f7a53a"],
        [19, 26, "#ffd14a"], [21, 24, "#f08a24"], [12, 26, "#c4451c"], [18, 24, "#c4451c"], [22, 26, "#f7a53a"],
        [14, 27, "#c4451c"], [20, 27, "#f08a24"], [10, 27, "#c4451c"],
      ] as const) rect(x, y, 2, 1, c);
      break;
    }
    case TILE.fourDessus: {
      clusters(10, ["#a8afaf", "#9aa2a2", "#abb2b1"], 6);
      cadre(p, 0, 0, N, N, "#c3c9c9", "#7b8484");
      cadre(p, 1, 1, N - 2, N - 2, "#b3b9b9", "#8e9696");
      // Plaque centrale en creux.
      rect(8, 8, 16, 16, "#9aa1a1");
      cadre(p, 8, 8, 16, 16, "#838c8c", "#bcc2c2");
      break;
    }
    case TILE.briquesPierre:
      grossesBriques(p);
      break;
    case TILE.pierrePolie:
      clusters(8, ["#b0b8b7", "#a4acac", "#b4bbba"], 8);
      cadre(p, 0, 0, N, N, "#d0d6d5", "#7f898a");
      cadre(p, 1, 1, N - 2, N - 2, "#bfc6c5", "#949e9f");
      break;
    case TILE.gresTaille: {
      clusters(12, ["#ffffff18", "#b798621b"], 6);
      rect(0, 0, N, 3, "#e6cca0"); rect(0, 3, N, 1, "#b3976c"); rect(0, 4, N, 1, "#c9b083");
      rect(0, 27, N, 1, "#e6cca0"); rect(0, 28, N, 1, "#b3976c"); rect(0, 29, N, 3, "#e6cca0"); rect(0, 31, N, 1, "#c9b083");
      // Losange sculpte : sillon sombre, arete eclairee en bas a droite.
      for (let y = 6; y < 26; y++) for (let x = 0; x < N; x++) {
        const d = Math.abs(x - 15.5) + Math.abs(y - 15.5);
        if (d === 8) pixel(x, y, "#b3976c");
        else if (d === 9) pixel(x, y, x + y > 31 ? "#e6cca0" : "#c9b083");
        else if (d < 2) pixel(x, y, "#b3976c");
        else if (d < 4) pixel(x, y, "#c9ae80");
      }
      for (const [x, y] of [[3, 7], [27, 7], [3, 23], [27, 23]]) {
        rect(x, y, 2, 2, "#b3976c"); pixel(x + 1, y + 1, "#e6cca0");
      }
      break;
    }
    case TILE.bibliotheque: {
      rect(0, 0, N, N, "#3a2a1c");
      const livres = ["#a8423a", "#3f5c9a", "#4d8446", "#8a5a36", "#b98a3a", "#7a3b5a"];
      const rangee = (bas: number, maxH: number) => {
        let x = 1;
        while (x < 31) {
          const w = Math.min(31 - x, 2 + Math.floor(random() * 2));
          const h = maxH - Math.floor(random() * 3);
          const c = livres[Math.floor(random() * livres.length)];
          const haut = bas - h + 1;
          rect(x, haut, w, h, c);
          rect(x, haut, 1, h, eclaircir(c, 0.25));
          rect(x, haut + 2, w, 1, eclaircir(c, 0.5));
          rect(x, bas - 2, w, 1, assombrir(c, 0.3));
          x += w + (random() < 0.3 ? 1 : 0);
        }
      };
      rangee(13, 10);
      rangee(28, 10);
      const etagere = (y: number, h: number) => {
        rect(0, y, N, h, "#b58656"); rect(0, y, N, 1, "#d2a26c"); rect(0, y + h - 1, N, 1, "#7c5a3a");
      };
      etagere(0, 3); etagere(14, 4); etagere(29, 3);
      rect(0, 0, 1, N, "#8c6748"); rect(31, 0, 1, N, "#6f5037");
      break;
    }
    case TILE.citrouilleDessus: {
      clusters(10, ["#e19535", "#d07f25"], 4);
      // Cotes rayonnantes autour de la tige.
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 + 0.3;
        for (let r = 6; r < 23; r += 0.5) {
          pixel(Math.floor(16 + Math.cos(a + 0.13) * r), Math.floor(16 + Math.sin(a + 0.13) * r), "#e9a24a");
        }
        for (let r = 5; r < 24; r += 0.5) {
          pixel(Math.floor(16 + Math.cos(a) * r), Math.floor(16 + Math.sin(a) * r), "#b8691d");
        }
      }
      cadre(p, 0, 0, N, N, "#c47a24", "#a95f1a");
      // Tige.
      rect(13, 13, 6, 6, "#5d5424"); rect(14, 12, 4, 8, "#5d5424"); rect(12, 14, 8, 4, "#5d5424");
      rect(14, 13, 3, 2, "#8a8436"); rect(13, 14, 1, 2, "#7a7430"); rect(16, 17, 2, 2, "#3f3915");
      break;
    }
    case TILE.citrouilleCote:
      citrouilleCote(p);
      break;
    case TILE.citrouilleLanterne: {
      citrouilleCote(p);
      // Bord de la decoupe : ombre en bas a droite, chair plus claire en haut a gauche.
      visage(p, -1, 0, "#b35e17", null);
      visage(p, 0, -1, "#b35e17", null);
      visage(p, 1, 0, "#7a3f12", null);
      visage(p, 0, 1, "#7a3f12", null);
      visage(p, 1, 1, "#6a3510", null);
      visage(p, 0, 0, "#ffd54a", "#fff3a0");
      // Dents laissees dans la bouche.
      rect(10, 18, 3, 2, "#c9792a"); rect(19, 18, 3, 2, "#c9792a"); rect(14, 21, 4, 2, "#c9792a");
      rect(10, 20, 3, 1, "#7a3f12"); rect(19, 20, 3, 1, "#7a3f12");
      break;
    }
    case TILE.melonDessus: {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const dx = x - 15.5, dy = y - 15.5, d = Math.hypot(dx, dy);
        if (d < 3) continue;
        const s = ((Math.atan2(dy, dx) / (Math.PI * 2)) * 10 + 10 + d * 0.03) % 1;
        if (s < 0.22) pixel(x, y, "#4f7d2a");
        else if (s < 0.3) pixel(x, y, "#6a9a35");
        else if (s > 0.6 && s < 0.66) pixel(x, y, "#a3cf5c");
      }
      for (let n = 0; n < 18; n++) pixel(Math.floor(random() * 32), Math.floor(random() * 32), "#b6dc72");
      rect(13, 13, 6, 6, "#6f9e38"); rect(14, 14, 4, 4, "#8a7a3a"); rect(14, 14, 2, 2, "#c9b16a");
      break;
    }
    case TILE.melonCote: {
      for (let y = 0; y < N; y++) {
        const dec = Math.round(Math.sin(y * 0.45) * 1.2);
        for (let x = 0; x < N; x++) {
          const k = (x + dec + 32) % 8;
          if (k < 2) pixel(x, y, "#4f7d2a");
          else if (k === 2) pixel(x, y, "#6a9a35");
          else if (k === 5) pixel(x, y, "#a3cf5c");
        }
      }
      for (let n = 0; n < 18; n++) pixel(Math.floor(random() * 32), Math.floor(random() * 32), "#b6dc72");
      rect(0, 0, N, 1, "#76a83c"); rect(0, 31, N, 1, "#6a9a35");
      break;
    }
    case TILE.foinDessus: {
      clusters(18, ["#d4ae44", "#bd9533", "#dcb84e"], 4);
      // Bouts de paille coupes.
      for (let n = 0; n < 70; n++) {
        const x = Math.floor(random() * 31), y = Math.floor(random() * 31);
        rect(x, y, 2, 2, "#e8c862"); pixel(x + 1, y + 1, "#8f6f1e");
      }
      cadre(p, 0, 0, N, N, "#d8b24a", "#a8842a");
      break;
    }
    case TILE.foinCote: {
      const pailles = ["#e3c25a", "#b89030", "#dab44a", "#c29a36"];
      for (let x = 0; x < N; x++) for (let k = 0; k < 3; k++) {
        const y = Math.floor(random() * 32), l = 4 + Math.floor(random() * 10);
        const c = pailles[Math.floor(random() * pailles.length)];
        rect(x, y, 1, l, c);
        // La paille repart en haut : la tuile se raccorde a la verticale.
        if (y + l > N) rect(x, 0, 1, y + l - N, c);
      }
      for (const y of [6, 23]) {
        rect(0, y, N, 3, "#8a3b26"); rect(0, y, N, 1, "#a9563a"); rect(0, y + 2, N, 1, "#5e2616");
        for (let x = 1; x < N; x += 5) pixel(x, y + 1, "#9c4a30");
      }
      break;
    }
    case TILE.blocFer:
      metal(p, { fond: "#d6dadb", clair: "#e9ecec", eclat: "#ffffff", mi: "#b5bbbc", sombre: "#949b9d", rivet: "#8a9193" });
      break;
    case TILE.blocOr:
      metal(p, { fond: "#f0c43c", clair: "#fcdc68", eclat: "#fff6c0", mi: "#d6a52e", sombre: "#b07f22", rivet: "#a0741f" });
      break;
    case TILE.blocDiamant: {
      // Facettes : damier de losanges, aretes claires dans un sens, sombres dans l'autre.
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const a = Math.floor((x + y) / 8) % 2, b = Math.floor((x - y + 32) / 8) % 2;
        let c = a !== b ? "#66e4dc" : "#4ccbc5";
        if ((x + y) % 8 === 0) c = "#b3f6ef";
        else if ((x - y + 32) % 8 === 0) c = "#2ea2a3";
        pixel(x, y, c);
      }
      cadre(p, 0, 0, N, N, "#dcfffb", "#23898c");
      cadre(p, 1, 1, N - 2, N - 2, "#98efe7", "#39b3b0");
      for (const [x, y] of [[8, 7], [23, 21]]) {
        rect(x - 1, y, 3, 1, "#ffffff"); rect(x, y - 1, 1, 3, "#ffffff");
      }
      break;
    }
    case TILE.blocCharbon: {
      clusters(16, ["#2e2e34", "#1d1d21", "#34343b"], 4);
      for (let n = 0; n < 16; n++) {
        const x = Math.floor(random() * 31), y = Math.floor(random() * 31);
        rect(x, y, 2, 1, "#4a4b51"); pixel(x, y, "#74767e");
      }
      cadre(p, 0, 0, N, N, "#3d3d45", "#141417");
      break;
    }
    case TILE.pierreMoussue:
      appareil(p, APPAREIL_PIERRE);
      mousse(p, 16, true);
      break;
    case TILE.terreLabouree: {
      clusters(16, ["#634733", "#4f3827", "#6a4d37"], 4);
      for (let row = 0; row < 4; row++) {
        const py = row * 8;
        rect(0, py, N, 2, "#3e2b1d");
        rect(0, py + 2, N, 1, "#4a3424");
        rect(0, py + 5, N, 1, "#735540");
        rect(0, py + 6, N, 1, "#684c37");
      }
      for (let n = 0; n < 14; n++) pixel(Math.floor(random() * 32), Math.floor(random() * 32), "#82644b");
      break;
    }
    case TILE.ble0: {
      p.clear();
      for (const [x, haut] of [[3, 25], [8, 23], [13, 26], [18, 22], [23, 25], [28, 24]]) {
        rect(x, haut, 1, N - haut, "#5e9c3e");
        rect(x + 1, haut + 2, 1, N - haut - 2, "#7dbb52");
        rect(x - 1, haut + 1, 1, 2, "#8fcb5e");
      }
      break;
    }
    case TILE.ble1: {
      p.clear();
      for (const [x, haut] of [[2, 12], [6, 15], [10, 10], [14, 14], [18, 11], [22, 15], [26, 12], [29, 16]]) {
        rect(x, haut, 1, N - haut, "#5f9a3a");
        rect(x + 1, haut + 3, 1, N - haut - 3, "#79b24c");
        rect(x - 1, haut + 5, 1, 3, "#8cc45a");
        rect(x + 2, haut + 9, 1, 3, "#6aa543");
        pixel(x, haut - 1, "#a6d66f");
      }
      break;
    }
    case TILE.ble2: {
      p.clear();
      for (const [x, haut] of [[3, 6], [8, 9], [13, 5], [18, 8], [23, 6], [28, 10]]) {
        rect(x, haut + 6, 1, N - haut - 6, "#b39a3c");
        rect(x + 1, haut + 12, 1, N - haut - 12, "#9a8230");
        rect(x - 1, haut + 14, 1, 3, "#c9ae4a");
        // Epi : grains en quinconce, barbes au sommet.
        rect(x - 1, haut, 3, 7, "#dcb84c");
        rect(x, haut, 1, 7, "#f2d67a");
        for (let k = 0; k < 7; k += 2) pixel(x + (k % 4 ? 1 : -1), haut + k, "#b88e2a");
        rect(x, haut - 3, 1, 3, "#ead08a");
        pixel(x - 1, haut - 2, "#ead08a"); pixel(x + 1, haut - 2, "#ead08a");
      }
      break;
    }
    case TILE.champignonBrun:
      champignon(p, "#9a6b48", "#bf8f64", "#6d4a31", []);
      break;
    case TILE.champignonRouge:
      champignon(p, "#c8352f", "#e45a4e", "#8e2420", [[11, 15, 2, 2], [16, 12, 2, 1], [19, 16, 2, 2], [14, 17, 2, 1], [9, 17, 1, 2]]);
      break;
    case TILE.canneASucre: {
      p.clear();
      for (const [x, dec] of [[4, 0], [13, 5], [20, 2], [27, 6]]) {
        rect(x, 0, 3, N, "#9ccc6a"); rect(x, 0, 1, N, "#c3e39a"); rect(x + 2, 0, 1, N, "#7fb052");
        for (let y = dec; y < N; y += 8) {
          rect(x, y, 3, 1, "#6f9e4a");
          rect(x, y + 1, 3, 1, "#b5da8a");
        }
      }
      // Quelques feuilles qui s'echappent des noeuds.
      rect(7, 9, 2, 1, "#8cc45a"); rect(9, 8, 2, 1, "#8cc45a"); pixel(11, 7, "#8cc45a");
      rect(10, 22, 3, 1, "#8cc45a"); rect(8, 21, 2, 1, "#8cc45a");
      rect(23, 11, 2, 1, "#8cc45a"); rect(25, 10, 2, 1, "#8cc45a");
      rect(17, 26, 3, 1, "#8cc45a"); rect(15, 25, 2, 1, "#8cc45a");
      break;
    }
    case TILE.terreCuite:
      terreCuite(p, color);
      break;
    case TILE.pierreLumineuse: {
      rect(0, 0, N, N, "#a8672a");
      const cristaux = ["#f2c25a", "#ffd978", "#e9ae47"];
      for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 4; gx++) {
        const x = gx * 8 + Math.floor(random() * 2), y = gy * 8 + Math.floor(random() * 2);
        const w = 5 + Math.floor(random() * 2), h = 5 + Math.floor(random() * 2);
        rect(x, y, w, h, cristaux[Math.floor(random() * cristaux.length)]);
        rect(x, y, w, 1, "#fff0b0"); rect(x, y, 1, h, "#ffe597");
        rect(x + w - 1, y + 1, 1, h - 1, "#cf8f36"); rect(x + 1, y + h - 1, w - 1, 1, "#cf8f36");
        rect(x + 1, y + 1, 2, 2, "#fff8d8");
      }
      for (let n = 0; n < 12; n++) pixel(Math.floor(random() * 32), Math.floor(random() * 32), "#ffe08a");
      break;
    }
    case TILE.planchesSombres:
      planches(p, BOIS_SOMBRE);
      break;
    case TILE.planchesClaires:
      planches(p, BOIS_CLAIR);
      // Petites marques sombres du bouleau.
      for (let n = 0; n < 7; n++) rect(Math.floor(random() * 15) * 2, Math.floor(random() * 4) * 8 + 3, 2, 1, "#a8925f");
      break;
    case TILE.briquesMoussues: {
      grossesBriques(p);
      // La mousse s'accroche aux joints puis coule sur les briques.
      for (const y of [14, 30]) for (let x = 0; x < N; x += 2) {
        if (random() < 0.55) {
          rect(x, y, 2, 2, random() < 0.5 ? "#5f8f45" : "#6f9d4f");
          if (random() < 0.4) rect(x, y + 2, 1, 1 + Math.floor(random() * 3), "#4f7d3b");
        }
      }
      mousse(p, 9, false);
      break;
    }
    case TILE.briquesFissurees: {
      grossesBriques(p);
      const fissure = (x0: number, y0: number, n: number) => {
        let x = x0;
        for (let k = 0; k < n; k++) {
          pixel(x, y0 + k, "#4a5354"); pixel(x + 1, y0 + k, "#b1b9b8");
          if (random() < 0.45) x += random() < 0.5 ? 1 : -1;
        }
      };
      fissure(6, 1, 13); fissure(22, 17, 13); fissure(27, 3, 8); fissure(10, 20, 7);
      rect(29, 16, 2, 3, "#5f696b"); rect(1, 9, 2, 2, "#6d7778");
      break;
    }
    case TILE.blocOsDessus: {
      clusters(8, ["#efe9d6", "#e1d9c0"], 4);
      cadre(p, 0, 0, N, N, "#f4efdf", "#c7bc98");
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const d = Math.hypot(x - 15.5, y - 15.5);
        if (d >= 11 && d < 12) pixel(x, y, "#bdb18d");
        else if (d >= 7 && d < 11) pixel(x, y, x + y < 31 ? "#e2d8b8" : "#d6cba7");
        else if (d >= 6 && d < 7) pixel(x, y, "#c5b995");
        else if (d < 6) pixel(x, y, "#f1ecdb");
      }
      for (const [x, y] of [[14, 13], [17, 16], [15, 18], [12, 16], [18, 12]]) pixel(x, y, "#d3c8a4");
      break;
    }
    case TILE.blocOsCote: {
      for (let x = 0; x < N; x++) {
        const k = x % 8;
        rect(x, 0, 1, N, k === 0 ? "#c9bd9a" : k === 1 ? "#d8ceae" : k === 3 || k === 4 ? "#efe9d6" : "#e3dbc2");
      }
      for (let n = 0; n < 14; n++) rect(Math.floor(random() * 32), 4 + Math.floor(random() * 22), 1, 2, "#cfc4a0");
      rect(0, 0, N, 3, "#d8ceae"); rect(0, 0, N, 1, "#efe9d6"); rect(0, 3, N, 1, "#bfb28e");
      rect(0, 28, N, 1, "#bfb28e"); rect(0, 29, N, 3, "#d8ceae"); rect(0, 31, N, 1, "#c7bc98");
      break;
    }
    case TILE.pierreCiselee: {
      clusters(12, ["#a7afaf", "#959fa0", "#aab2b1"], 6);
      cadre(p, 0, 0, N, N, "#c3cac9", "#6f797a");
      cadre(p, 1, 1, N - 2, N - 2, "#b3bbba", "#858f90");
      // Rainure gravee (ombre en haut a gauche, lumiere en bas a droite).
      cadre(p, 3, 3, N - 6, N - 6, "#7d8788", "#c0c7c6");
      for (let y = 4; y < 28; y++) for (let x = 4; x < 28; x++) {
        const d = Math.hypot(x - 15.5, y - 15.5);
        if (d >= 6.5 && d < 8) pixel(x, y, x + y < 31 ? "#6f797a" : "#858f90");
        else if (d >= 8 && d < 9 && x + y > 31) pixel(x, y, "#c6cdcc");
        else if (d < 2.5) pixel(x, y, x + y > 31 ? "#8d9798" : "#bcc4c3");
      }
      break;
    }
    case TILE.gresRougeDessus:
      tuileGres(p, false, "#8a3f1a22", "#9e4f26", "#dd8a55", "#9e4f2655");
      break;
    case TILE.gresRougeCote:
      tuileGres(p, true, "#8a3f1a22", "#9e4f26", "#dd8a55", "#9e4f2655");
      break;
    case TILE.fleurBleue: {
      p.clear();
      fleur(p, { petale: color, haut: "#9dbcff", gauche: "#86aaf5", bas: "#3456a8", coeur: "#4b3a9a", coeurHaut: "#6d5cc0" });
      // Petales dentes du bleuet.
      for (const [x, y] of [[12, 4], [19, 4], [8, 8], [23, 8], [8, 14], [23, 14], [12, 18], [19, 18]]) p.clear(x, y, 1, 1);
      break;
    }
  }
}

/** Familles teintes (laine, verre, beton, terre cuite, lampes) : 16 couleurs chacune. */
function dessinerTuileTeinte(p: Pinceau): void {
  const { tile, rect } = p;
  let i: number;
  if ((i = familleTeinte(tile, TILE_LAINE)) >= 0) {
    const hex = COULEURS[i].hex;
    rect(0, 0, N, N, hex);
    const clair = eclaircir(hex, 0.1), sombre = assombrir(hex, 0.12), creux = assombrir(hex, 0.06);
    // Tissage : une maille de 4 px, decalee d'une rangee a l'autre.
    for (let row = 0; row < N; row += 4) for (let col = -4; col < N; col += 4) {
      const x = col + ((row / 4) % 2) * 2;
      rect(x, row, 3, 1, clair); rect(x + 3, row + 1, 1, 3, sombre); rect(x + 1, row + 2, 1, 1, creux);
    }
  } else if ((i = familleTeinte(tile, TILE_VERRE_TEINTE)) >= 0) {
    // Comme le verre : centre transparent, cadre et reflets de la couleur.
    const hex = COULEURS[i].hex;
    p.clear();
    const bord = avecAlpha(eclaircir(hex, 0.3), 0.9), ombre = avecAlpha(assombrir(hex, 0.15), 0.9);
    const liseret = avecAlpha(hex, 0.85), reflet = avecAlpha(eclaircir(hex, 0.6), 0.85);
    rect(0, 0, N, 1, bord); rect(0, 1, 1, N - 1, bord);
    rect(N - 1, 1, 1, N - 1, ombre); rect(1, N - 1, N - 2, 1, ombre);
    rect(1, 1, N - 2, 1, liseret); rect(1, 2, 1, N - 3, liseret);
    rect(N - 2, 2, 1, N - 3, liseret); rect(2, N - 2, N - 4, 1, liseret);
    for (let n = 0; n < 5; n++) rect(5 + n * 2, 16 - n * 2, 2, 2, reflet);
    rect(21, 24, 2, 2, reflet); rect(23, 22, 2, 2, reflet);
  } else if ((i = familleTeinte(tile, TILE_BETON)) >= 0) {
    rect(0, 0, N, N, COULEURS[i].hex);
    p.clusters(6, ["#ffffff08", "#00000008"], 8);
  } else if ((i = familleTeinte(tile, TILE_TERRE_CUITE_TEINTEE)) >= 0) {
    terreCuite(p, teinteTerreCuite(COULEURS[i].hex));
  } else if ((i = familleTeinte(tile, TILE_LAMPE_COULEUR)) >= 0) {
    const hex = COULEURS[i].hex;
    lampe(p, teinteLampe(hex), eclaircir(hex, 0.35), eclaircir(hex, 0.6));
  }
}

function dessinerTuile(p: Pinceau): void {
  if (p.tile < TILE.tableDessus) dessinerTuileOrigine(p);
  else if (p.tile <= TILE.fleurBleue) dessinerTuileFabrication(p);
  else dessinerTuileTeinte(p);
}

// ---------------------------------------------------------------------------
// Retouches au pixel (apres le dessin) : grain, feuillage ajoure, gouttiere
// ---------------------------------------------------------------------------

/** Nombre pseudo-aleatoire stable dans [0, 1[ pour un pixel d'une tuile. */
function hachage(x: number, y: number, s: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Tuiles naturelles : grain de +/- 3 % de valeur. */
const GRAIN_NATUREL = new Set<number>([
  TILE.herbeDessus, TILE.herbeCote, TILE.terre, TILE.pierre, TILE.pierreTaillee, TILE.sable, TILE.gresDessus, TILE.gresCote,
  TILE.troncDessus, TILE.troncCote, TILE.planches, TILE.feuilles, TILE.brique, TILE.charbon, TILE.fer, TILE.or, TILE.diamant,
  TILE.obsidienne, TILE.gravier, TILE.neige, TILE.socle, TILE.cactusDessus, TILE.cactusCote,
  TILE.tableDessus, TILE.tableCote, TILE.fourFace, TILE.briquesPierre, TILE.gresTaille, TILE.bibliotheque,
  TILE.citrouilleDessus, TILE.citrouilleCote, TILE.citrouilleLanterne, TILE.melonDessus, TILE.melonCote,
  TILE.foinDessus, TILE.foinCote, TILE.blocCharbon, TILE.pierreMoussue, TILE.terreLabouree, TILE.terreCuite,
  TILE.planchesSombres, TILE.planchesClaires, TILE.briquesMoussues, TILE.briquesFissurees, TILE.blocOsDessus,
  TILE.blocOsCote, TILE.pierreCiselee, TILE.gresRougeDessus, TILE.gresRougeCote,
]);
/** Tuiles lisses : grain a peine perceptible. */
const GRAIN_LISSE = new Set<number>([TILE.fourDessus, TILE.pierrePolie, TILE.blocFer, TILE.blocOr, TILE.blocDiamant]);

function amplitudeGrain(tile: number): number {
  if (GRAIN_NATUREL.has(tile)) return 0.03;
  if (GRAIN_LISSE.has(tile) || familleTeinte(tile, TILE_BETON) >= 0) return 0.012;
  if (familleTeinte(tile, TILE_LAINE) >= 0 || familleTeinte(tile, TILE_TERRE_CUITE_TEINTEE) >= 0) return 0.02;
  return 0;
}

function grain(px: ImageData, tile: number, amplitude: number): void {
  const { ox, oy } = origine(tile);
  const d = px.data;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = ((oy + y) * LARGEUR + ox + x) * 4;
    if (d[i + 3] === 0) continue;
    const f = 1 + (hachage(x, y, tile) * 2 - 1) * amplitude;
    d[i] *= f; d[i + 1] *= f; d[i + 2] *= f;
  }
}

/**
 * Feuillage ajoure : efface `part` des pixels par grappes de 2 x 2, de
 * preference dans l'ombre entre les rosettes.
 */
function ajourer(px: ImageData, tile: number, part: number): void {
  const { ox, oy } = origine(tile);
  const d = px.data;
  const cote = N / 2;
  const blocs: { bx: number; by: number; score: number }[] = [];
  for (let by = 0; by < cote; by++) for (let bx = 0; bx < cote; bx++) {
    const i = ((oy + by * 2) * LARGEUR + ox + bx * 2) * 4;
    const ombre = d[i] + d[i + 1] + d[i + 2] < 280;
    blocs.push({ bx, by, score: hachage(bx, by, tile * 31 + 7) - (ombre ? 0.35 : 0) });
  }
  blocs.sort((a, b) => a.score - b.score);
  const nb = Math.round(blocs.length * part);
  for (let k = 0; k < nb; k++) {
    const { bx, by } = blocs[k];
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      d[((oy + by * 2 + dy) * LARGEUR + ox + bx * 2 + dx) * 4 + 3] = 0;
    }
  }
}

/** Prolonge les bords de la tuile (couleur ET alpha) dans sa gouttiere. */
function gouttiere(px: ImageData, tile: number): void {
  const cx = (tile % ATLAS_COLS) * ATLAS_CELL, cy = Math.floor(tile / ATLAS_COLS) * ATLAS_CELL;
  const d = px.data;
  for (let y = 0; y < ATLAS_CELL; y++) {
    const sy = cy + ATLAS_GUTTER + Math.min(N - 1, Math.max(0, y - ATLAS_GUTTER));
    const dedansY = y >= ATLAS_GUTTER && y < ATLAS_GUTTER + N;
    for (let x = 0; x < ATLAS_CELL; x++) {
      if (dedansY && x >= ATLAS_GUTTER && x < ATLAS_GUTTER + N) continue;
      const sx = cx + ATLAS_GUTTER + Math.min(N - 1, Math.max(0, x - ATLAS_GUTTER));
      const i = ((cy + y) * LARGEUR + cx + x) * 4, j = (sy * LARGEUR + sx) * 4;
      d[i] = d[j]; d[i + 1] = d[j + 1]; d[i + 2] = d[j + 2]; d[i + 3] = d[j + 3];
    }
  }
}

/** Couleur moyenne (0..1) des pixels non transparents de chaque tuile. */
function calculerMoyennes(px: ImageData): Float32Array {
  const res = new Float32Array(NB_TUILES * 3);
  const d = px.data;
  for (let t = 0; t < NB_TUILES; t++) {
    const { ox, oy } = origine(t);
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = ((oy + y) * LARGEUR + ox + x) * 4;
      if (d[i + 3] === 0) continue;
      r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
    }
    if (n > 0) {
      res[t * 3] = r / n / 255; res[t * 3 + 1] = g / n / 255; res[t * 3 + 2] = b / n / 255;
    }
  }
  return res;
}

// ---------------------------------------------------------------------------
// Mipmaps
// ---------------------------------------------------------------------------

/**
 * Copie de l'atlas ou les pixels transparents prennent la couleur de leurs
 * voisins opaques (dans la meme case). Au passage d'un niveau de mipmap a
 * l'autre, le GPU melange deux niveaux : sans cela, le bord des plantes
 * virerait au noir.
 */
function saigner(src: ImageData, moyennes: Float32Array): ImageData {
  const w = src.width, h = src.height;
  const d = new Uint8ClampedArray(src.data);
  // 0 : couleur inconnue, 1 : opaque d'origine, k : trouvee a la passe k.
  const connu = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (d[i * 4 + 3] > 0) connu[i] = 1;
  let r = 0, g = 0, b = 0, n = 0, passe = 0;
  const ajoute = (j: number) => {
    const c = connu[j];
    if (c === 0 || c >= passe) return;
    r += d[j * 4]; g += d[j * 4 + 1]; b += d[j * 4 + 2]; n++;
  };
  for (passe = 2; passe <= 5; passe++) {
    for (let y = 0; y < h; y++) {
      const cy0 = y - (y % ATLAS_CELL);
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (connu[i] !== 0) continue;
        const cx0 = x - (x % ATLAS_CELL);
        r = g = b = n = 0;
        if (x > cx0) ajoute(i - 1);
        if (x < cx0 + ATLAS_CELL - 1) ajoute(i + 1);
        if (y > cy0) ajoute(i - w);
        if (y < cy0 + ATLAS_CELL - 1) ajoute(i + w);
        if (n === 0) continue;
        d[i * 4] = r / n; d[i * 4 + 1] = g / n; d[i * 4 + 2] = b / n;
        connu[i] = passe;
      }
    }
  }
  // Loin de tout pixel opaque : la couleur moyenne de la tuile.
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (connu[i] !== 0) continue;
    const t = Math.floor(y / ATLAS_CELL) * ATLAS_COLS + Math.floor(x / ATLAS_CELL);
    d[i * 4] = moyennes[t * 3] * 255; d[i * 4 + 1] = moyennes[t * 3 + 1] * 255; d[i * 4 + 2] = moyennes[t * 3 + 2] * 255;
  }
  return new ImageData(d, w, h);
}

/**
 * Niveau suivant : pour chaque bloc de 2 x 2, couleur = moyenne des pixels
 * non transparents, alpha = le plus grand des quatre.
 */
function reduire(src: ImageData): ImageData {
  const sw = src.width, sh = src.height;
  const w = Math.max(1, sw >> 1), h = Math.max(1, sh >> 1);
  const s = src.data;
  const res = new ImageData(w, h);
  const o = res.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0, n = 0, a = 0, rt = 0, gt = 0, bt = 0;
    for (let k = 0; k < 4; k++) {
      const sx = Math.min(sw - 1, x * 2 + (k & 1)), sy = Math.min(sh - 1, y * 2 + (k >> 1));
      const i = (sy * sw + sx) * 4;
      rt += s[i]; gt += s[i + 1]; bt += s[i + 2];
      if (s[i + 3] > 0) {
        r += s[i]; g += s[i + 1]; b += s[i + 2]; n++;
        if (s[i + 3] > a) a = s[i + 3];
      }
    }
    const j = (y * w + x) * 4;
    if (n > 0) {
      o[j] = r / n; o[j + 1] = g / n; o[j + 2] = b / n; o[j + 3] = a;
    } else {
      o[j] = rt / 4; o[j + 1] = gt / 4; o[j + 2] = bt / 4; o[j + 3] = 0;
    }
  }
  return res;
}

function construireMipmaps(px: ImageData, moyennes: Float32Array): ImageData[] {
  const niveaux = [saigner(px, moyennes)];
  let courant = niveaux[0];
  while (courant.width > 1 || courant.height > 1) {
    courant = reduire(courant);
    niveaux.push(courant);
  }
  return niveaux;
}

// ---------------------------------------------------------------------------
// L'atlas (dessine une seule fois, garde en cache)
// ---------------------------------------------------------------------------

interface Atlas {
  canvas: HTMLCanvasElement;
  /** Pixels de l'atlas, gouttieres comprises, non premultiplies. */
  pixels: ImageData;
  moyennes: Float32Array;
  mipmaps: ImageData[] | null;
}

let atlas: Atlas | null = null;

function obtenirAtlas(): Atlas {
  if (atlas) return atlas;
  const canvas = document.createElement("canvas");
  canvas.width = LARGEUR;
  canvas.height = HAUTEUR;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  for (let t = 0; t < NB_TUILES; t++) if (tuileExiste(t)) dessinerTuile(creerPinceau(ctx, t));

  const pixels = ctx.getImageData(0, 0, LARGEUR, HAUTEUR);
  ajourer(pixels, TILE.feuilles, 0.18);
  for (let t = 0; t < NB_TUILES; t++) {
    const amplitude = amplitudeGrain(t);
    if (amplitude > 0) grain(pixels, t, amplitude);
  }
  for (let t = 0; t < NB_TUILES; t++) if (tuileExiste(t)) gouttiere(pixels, t);
  ctx.putImageData(pixels, 0, 0);

  atlas = { canvas, pixels, moyennes: calculerMoyennes(pixels), mipmaps: null };
  return atlas;
}

/** L'atlas 768 x 768 (dessine une seule fois). Sert aussi aux icones. */
export function getAtlasCanvas(): HTMLCanvasElement {
  return obtenirAtlas().canvas;
}

/**
 * Texture de l'atlas pour les blocs. Les mipmaps sont fournies a la main
 * (alpha maximal preserve) : ne pas remettre generateMipmaps a true.
 */
export function createVoxelAtlas(renderer?: THREE.WebGLRenderer): THREE.CanvasTexture {
  const a = obtenirAtlas();
  if (!a.mipmaps) a.mipmaps = construireMipmaps(a.pixels, a.moyennes);
  const texture = new THREE.CanvasTexture(a.canvas);
  texture.name = "Cubes - atlas";
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapLinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  // three r185 envoie chaque niveau a texSubImage2D, qui accepte une ImageData
  // comme un canvas. Une ImageData n'est pas premultipliee : la couleur
  // saignee sous les pixels transparents arrive intacte au GPU.
  texture.mipmaps = a.mipmaps.slice() as unknown as HTMLCanvasElement[];
  if (renderer) texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

const moyennesEnCache: ([number, number, number] | undefined)[] = [];

/**
 * Couleur moyenne (sRGB, 0..1) des pixels opaques d'une tuile, pour les
 * eclats de bloc et les icones. Le tableau renvoye est partage : ne pas le
 * modifier.
 */
export function tileAverageColor(tile: number): [number, number, number] {
  if (!(tile >= 0 && tile < NB_TUILES)) return [0, 0, 0];
  const t = Math.floor(tile);
  const deja = moyennesEnCache[t];
  if (deja) return deja;
  if (typeof document === "undefined") {
    // Cote serveur : pas de canvas, la couleur de fond suffit.
    const [r, g, b] = hexVersRgb(TILE_COLORS[t]);
    return [r / 255, g / 255, b / 255];
  }
  const m = obtenirAtlas().moyennes;
  const c: [number, number, number] = [m[t * 3], m[t * 3 + 1], m[t * 3 + 2]];
  moyennesEnCache[t] = c;
  return c;
}

// ---------------------------------------------------------------------------
// Fissures du bloc qu'on casse
// ---------------------------------------------------------------------------

/**
 * Pixels des fissures, etape par etape (chaque etape AJOUTE ses pixels a la
 * precedente). Des pointes partent du centre, puis d'autres germes, et
 * avancent en zigzag en gardant leur cap.
 */
function tracerFissures(): number[][] {
  let s = 90211;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const pris = new Uint8Array(N * N);
  const pointes: { x: number; y: number; cap: number; vivante: boolean; neuve: boolean }[] = [];
  const germe = (x: number, y: number, caps: number[]) => {
    for (const cap of caps) pointes.push({ x, y, cap, vivante: true, neuve: true });
  };
  const GERMES: Record<number, [number, number, number[]]> = {
    0: [15, 16, [0, 3, 6]],
    2: [15, 16, [1, 4]],
    3: [6, 25, [7, 2]],
    4: [26, 6, [3, 6]],
    5: [24, 26, [5, 0]],
    6: [6, 7, [1, 4]],
  };
  const res: number[][] = [];
  for (let e = 0; e < ETAPES_FISSURES; e++) {
    const nouveaux: number[] = [];
    const marque = (x: number, y: number) => {
      const i = y * N + x;
      if (!pris[i]) { pris[i] = 1; nouveaux.push(i); }
    };
    const g = GERMES[e];
    if (g) { germe(g[0], g[1], g[2]); marque(g[0], g[1]); }
    const pas = e === 0 ? 3 : 4;
    for (const t of pointes.slice()) {
      if (!t.vivante) continue;
      let d = t.cap;
      for (let k = 0; k < pas; k++) {
        const r = rnd();
        d = r < 0.25 ? (t.cap + 1) % 8 : r < 0.5 ? (t.cap + 7) % 8 : t.cap;
        const nx = t.x + DIRS[d][0], ny = t.y + DIRS[d][1];
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) { t.vivante = false; break; }
        // Une fissure qui en rejoint une autre s'arrete (pas de paquets de pixels).
        const rejoint = pris[ny * N + nx] === 1 && !t.neuve;
        t.neuve = false;
        t.x = nx; t.y = ny;
        if (rejoint) { t.vivante = false; break; }
        marque(nx, ny);
      }
      if (t.vivante && pointes.length < 18 && rnd() < 0.35) {
        pointes.push({ x: t.x, y: t.y, cap: (t.cap + (rnd() < 0.5 ? 2 : 6)) % 8, vivante: true, neuve: true });
      }
    }
    res.push(nouveaux);
  }
  return res;
}

/**
 * Bande de 8 etapes x 32 px (256 x 32), fond transparent, fissures sombres de
 * plus en plus nombreuses. En surimpression sur le bloc qu'on casse :
 * map.offset.x = etape / 8, map.repeat.x = 1 / 8.
 */
export function createCrackTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = N * ETAPES_FISSURES;
  canvas.height = N;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#00000099";
  const traces = tracerFissures();
  for (let e = 0; e < ETAPES_FISSURES; e++) {
    for (let k = 0; k <= e; k++) for (const i of traces[k]) ctx.fillRect(e * N + (i % N), Math.floor(i / N), 1, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = "Cubes - fissures";
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  return texture;
}
