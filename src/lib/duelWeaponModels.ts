import * as THREE from "three";
import { CAMOS, type CamoId } from "./duelProfile";
import { makeCamoTexture } from "./duelTextures";

/**
 * Atelier des armes du Duel : matieres, outils de modelage et mains gantees.
 *
 * Les armes etaient des assemblages de boites. Ici on les dessine comme un
 * armurier les verrait de profil : un contour 2D (carcasse, culasse, crosse,
 * chargeur courbe) extrude sur l'epaisseur de la piece, avec un biseau sur
 * les aretes. Les pieces rondes (canons, lunettes, freins de bouche) sont
 * tournees au tour a partir de leur profil.
 *
 * Deux details font tout le realisme sous un eclairage Lambert :
 * - les aretes biseautees recoivent une couleur de sommet plus claire : c'est
 *   l'usure du bronzage ou de la peinture, la ou la main et l'etui frottent ;
 * - les coordonnees de texture sont projetees a densite constante (1 motif
 *   pour 20 cm), donc le grain de l'acier, du bois ou du polymere garde la
 *   meme taille d'une piece a l'autre, meme une fois tout fusionne.
 *
 * Les textures sont peintes au canvas une seule fois et partagees par toutes
 * les armes ; la derniere arme detruite les libere.
 */

// ---------------------------------------------------------------------------
// Textures partagees
// ---------------------------------------------------------------------------

/** Densite des coordonnees de texture : 5 motifs par unite du modele. */
const UV_DENSITY = 5;

const texCache = new Map<string, { tex: THREE.Texture; users: number }>();

function acquireTexture(key: string, make: () => THREE.Texture): { tex: THREE.Texture; release: { dispose(): void } } {
  let entry = texCache.get(key);
  if (!entry) {
    entry = { tex: make(), users: 0 };
    texCache.set(key, entry);
  }
  entry.users += 1;
  let released = false;
  const e = entry;
  return {
    tex: e.tex,
    release: {
      dispose() {
        if (released) return;
        released = true;
        e.users -= 1;
        if (e.users <= 0) {
          e.tex.dispose();
          if (texCache.get(key) === e) texCache.delete(key);
        }
      },
    },
  };
}

function paper(size: number) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return { canvas, g: canvas.getContext("2d")! };
}

function toTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Dessine aux neuf positions de tuilage : le motif se repete sans couture. */
function tiled(size: number, draw: (ox: number, oy: number) => void) {
  for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) draw(ox, oy);
}

/** Taches douces, claires ou sombres : l'usure n'est jamais uniforme. */
function mottle(g: CanvasRenderingContext2D, size: number, count: number, alpha: number) {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 14 + Math.random() * 46;
    const light = Math.random() > 0.5;
    tiled(size, (ox, oy) => {
      const grad = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      grad.addColorStop(0, light ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha * 1.2})`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    });
  }
}

/** Acier : brossage dans la longueur, rayures fines, piqures, voile d'usure. */
function drawMetal(): THREE.CanvasTexture {
  const S = 256;
  const { canvas, g } = paper(S);
  g.fillStyle = "#c8cdd2";
  g.fillRect(0, 0, S, S);
  mottle(g, S, 36, 0.06);
  // Brossage : des traits horizontaux de longueur variable (le long du canon).
  for (let y = 0; y < S; y++) {
    for (let k = 0; k < 3; k++) {
      const x0 = Math.random() * S;
      const len = 20 + Math.random() * 180;
      const light = Math.random() > 0.5;
      g.fillStyle = light ? `rgba(255,255,255,${0.02 + Math.random() * 0.05})` : `rgba(10,14,18,${0.02 + Math.random() * 0.05})`;
      g.fillRect(x0, y, len, 1);
      if (x0 + len > S) g.fillRect(x0 - S, y, len, 1);
    }
  }
  // Rayures claires : l'acier mis a nu par les frottements.
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const a = (Math.random() - 0.5) * 1.2;
    const len = 4 + Math.random() * 26;
    const alpha = 0.18 + Math.random() * 0.35;
    tiled(S, (ox, oy) => {
      g.strokeStyle = `rgba(255,255,255,${alpha})`;
      g.lineWidth = 0.6 + Math.random() * 0.6;
      g.beginPath();
      g.moveTo(x + ox, y + oy);
      g.lineTo(x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len);
      g.stroke();
    });
  }
  // Piqures et taches d'huile.
  for (let i = 0; i < 160; i++) {
    g.fillStyle = `rgba(20,24,28,${0.25 + Math.random() * 0.35})`;
    g.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random() * 1.5, 1 + Math.random() * 1.5);
  }
  return toTexture(canvas);
}

/** Polymere : grenage antiderapant, voile et eraflures. */
function drawPolymer(): THREE.CanvasTexture {
  const S = 256;
  const { canvas, g } = paper(S);
  g.fillStyle = "#c2c5c8";
  g.fillRect(0, 0, S, S);
  mottle(g, S, 28, 0.05);
  for (let i = 0; i < 9000; i++) {
    const s = Math.random() > 0.7 ? 2 : 1;
    g.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.13)";
    g.fillRect(Math.random() * S, Math.random() * S, s, s);
  }
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const a = Math.random() * Math.PI;
    const len = 6 + Math.random() * 20;
    tiled(S, (ox, oy) => {
      g.strokeStyle = "rgba(255,255,255,0.16)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x + ox, y + oy);
      g.lineTo(x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len);
      g.stroke();
    });
  }
  return toTexture(canvas);
}

/** Noyer verni : veines ondulees dans la longueur, pores, ronce et reflet. */
function drawWood(): THREE.CanvasTexture {
  const S = 256;
  const { canvas, g } = paper(S);
  g.fillStyle = "#6d4426";
  g.fillRect(0, 0, S, S);
  // Veines : des courbes periodiques en x, donc sans couture.
  const vein = (y0: number, amp: number, k: number, ph: number, style: string, width: number) => {
    for (const oy of [-S, 0, S]) {
      g.strokeStyle = style;
      g.lineWidth = width;
      g.beginPath();
      for (let x = 0; x <= S; x += 4) {
        const y = y0 + oy + amp * Math.sin((x / S) * Math.PI * 2 * k + ph) + amp * 0.35 * Math.sin((x / S) * Math.PI * 6 + ph * 2);
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
  };
  for (let i = 0; i < 7; i++) vein(Math.random() * S, 4 + Math.random() * 8, 1, Math.random() * 6, "rgba(40,20,8,0.14)", 8 + Math.random() * 10);
  for (let i = 0; i < 110; i++) {
    const dark = Math.random() > 0.3;
    vein(
      Math.random() * S,
      1 + Math.random() * 4,
      Math.random() > 0.5 ? 1 : 2,
      Math.random() * 6,
      dark ? `rgba(34,16,6,${0.12 + Math.random() * 0.3})` : `rgba(170,120,70,${0.08 + Math.random() * 0.14})`,
      0.6 + Math.random() * 1.8,
    );
  }
  for (let i = 0; i < 800; i++) {
    g.fillStyle = `rgba(24,11,4,${0.2 + Math.random() * 0.3})`;
    g.fillRect(Math.random() * S, Math.random() * S, 2 + Math.random() * 4, 1);
  }
  const shine = g.createLinearGradient(0, 0, 0, S);
  shine.addColorStop(0, "rgba(255,220,170,0.07)");
  shine.addColorStop(0.5, "rgba(255,220,170,0)");
  shine.addColorStop(1, "rgba(255,220,170,0.07)");
  g.fillStyle = shine;
  g.fillRect(0, 0, S, S);
  return toTexture(canvas);
}

/** Gant tactique : toile synthetique serree et plis du tissu. */
function drawGlove(): THREE.CanvasTexture {
  const S = 256;
  const { canvas, g } = paper(S);
  g.fillStyle = "#c0c4c8";
  g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 2) {
    for (let x = 0; x < S; x += 2) {
      if (((x + y) / 2) % 2 === 0) {
        g.fillStyle = "rgba(255,255,255,0.07)";
        g.fillRect(x, y, 2, 1);
      } else {
        g.fillStyle = "rgba(0,0,0,0.08)";
        g.fillRect(x, y + 1, 1, 1);
      }
    }
  }
  mottle(g, S, 24, 0.07);
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const a = Math.random() * Math.PI;
    const len = 20 + Math.random() * 50;
    tiled(S, (ox, oy) => {
      g.strokeStyle = "rgba(0,0,0,0.1)";
      g.lineWidth = 2 + Math.random() * 3;
      g.beginPath();
      g.moveTo(x + ox, y + oy);
      g.quadraticCurveTo(x + ox + Math.cos(a) * len * 0.5 + 6, y + oy + Math.sin(a) * len * 0.5 - 6, x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len);
      g.stroke();
    });
  }
  return toTexture(canvas);
}

/** Manche : toile ripstop (quadrillage fin) et plis. */
function drawSleeve(): THREE.CanvasTexture {
  const S = 256;
  const { canvas, g } = paper(S);
  g.fillStyle = "#c6c6c0";
  g.fillRect(0, 0, S, S);
  for (let i = -S; i < S * 2; i += 3) {
    g.strokeStyle = "rgba(0,0,0,0.05)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + S, S);
    g.stroke();
  }
  g.fillStyle = "rgba(255,255,255,0.12)";
  for (let i = 0; i < S; i += 16) {
    g.fillRect(i, 0, 1, S);
    g.fillRect(0, i, S, 1);
  }
  mottle(g, S, 30, 0.08);
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const len = 30 + Math.random() * 60;
    tiled(S, (ox, oy) => {
      g.strokeStyle = "rgba(0,0,0,0.12)";
      g.lineWidth = 3 + Math.random() * 5;
      g.beginPath();
      g.moveTo(x + ox, y + oy);
      g.quadraticCurveTo(x + ox + len * 0.5, y + oy + 8, x + ox + len, y + oy - 4);
      g.stroke();
    });
  }
  return toTexture(canvas);
}

/** Verre de lunette traite : bleu profond, reflets verts et violets. */
function drawLens(): THREE.CanvasTexture {
  const S = 128;
  const { canvas, g } = paper(S);
  const grad = g.createRadialGradient(S * 0.45, S * 0.42, 2, S / 2, S / 2, S / 2);
  grad.addColorStop(0, "#335a6e");
  grad.addColorStop(0.55, "#132833");
  grad.addColorStop(1, "#04080b");
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  g.lineWidth = 7;
  g.strokeStyle = "rgba(150,110,255,0.35)";
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - 14, Math.PI * 0.95, Math.PI * 1.4);
  g.stroke();
  g.strokeStyle = "rgba(120,255,190,0.25)";
  g.lineWidth = 4;
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - 24, Math.PI * 1.55, Math.PI * 1.85);
  g.stroke();
  g.fillStyle = "rgba(255,255,255,0.55)";
  g.beginPath();
  g.ellipse(S * 0.36, S * 0.33, 9, 5, -0.6, 0, Math.PI * 2);
  g.fill();
  const t = toTexture(canvas);
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ---------------------------------------------------------------------------
// Matieres
// ---------------------------------------------------------------------------

export type Disposer = <T extends { dispose(): void }>(x: T) => T;

export interface GunKit {
  /** Acier nu : culasses mobiles, axes, bouches polies. */
  steel: THREE.MeshLambertMaterial;
  /** Acier phosphate gris fonce : boitiers, garde-mains metalliques. */
  metal: THREE.MeshLambertMaterial;
  /** Acier bronze noir : culasses de pistolet, canons, revolver. */
  blued: THREE.MeshLambertMaterial;
  /** Petites pieces noires : organes de visee, pontets, vis. */
  dark: THREE.MeshLambertMaterial;
  polymer: THREE.MeshLambertMaterial;
  wood: THREE.MeshLambertMaterial;
  /** Polymere sable (FDE). */
  sable: THREE.MeshLambertMaterial;
  /** Vert olive militaire. */
  olive: THREE.MeshLambertMaterial;
  /** Caoutchouc : plaques de couche, oeilleton. */
  rubber: THREE.MeshLambertMaterial;
  brass: THREE.MeshLambertMaterial;
  copper: THREE.MeshLambertMaterial;
  shellRed: THREE.MeshLambertMaterial;
  cord: THREE.MeshLambertMaterial;
  glove: THREE.MeshLambertMaterial;
  gloveDark: THREE.MeshLambertMaterial;
  sleeve: THREE.MeshLambertMaterial;
  /** Point rouge et empennage : non eclaires, ils brillent. */
  accent: THREE.MeshBasicMaterial;
  /** Points blancs des organes de visee. */
  white: THREE.MeshBasicMaterial;
  /** Insert phosphorescent du guidon. */
  tritium: THREE.MeshBasicMaterial;
  /** Verre de lunette. */
  glass: THREE.MeshBasicMaterial;
  /** Vitre legerement teintee d'un viseur point rouge. */
  glassTint: THREE.MeshBasicMaterial;
  /** Interieur d'un canon ou d'une chambre : noir. */
  bore: THREE.MeshBasicMaterial;
}

/** Usure des aretes par matiere : facteur ajoute a la couleur des biseaux. */
const WEAR = new WeakMap<THREE.Material, number>();

export function createGunKit(
  look: { camo?: CamoId; sleeve?: number; glove?: number },
  keep: Disposer,
): GunKit {
  const tex = (key: string, make: () => THREE.Texture) => {
    const a = acquireTexture(key, make);
    keep(a.release);
    return a.tex;
  };
  const metalTex = tex("metal", drawMetal);
  const polyTex = tex("polymer", drawPolymer);
  const woodTex = tex("wood", drawWood);
  const gloveTex = tex("glove", drawGlove);
  const sleeveTex = tex("sleeve", drawSleeve);
  const lensTex = tex("lens", drawLens);

  const lambert = (map: THREE.Texture | null, color: number, wear: number) => {
    const m = keep(new THREE.MeshLambertMaterial({ map, color, vertexColors: true }));
    WEAR.set(m, wear);
    return m;
  };
  const basic = (p: THREE.MeshBasicMaterialParameters) => keep(new THREE.MeshBasicMaterial(p));

  const kit: GunKit = {
    steel: lambert(metalTex, 0x9ba2a9, 0.35),
    metal: lambert(metalTex, 0x4b5158, 0.9),
    blued: lambert(metalTex, 0x2b2f35, 1.9),
    dark: lambert(polyTex, 0x222529, 0.9),
    polymer: lambert(polyTex, 0x2f3237, 0.7),
    wood: lambert(woodTex, 0xffffff, 0.28),
    sable: lambert(polyTex, 0x9d8259, 0.22),
    olive: lambert(polyTex, 0x59603f, 0.35),
    rubber: lambert(polyTex, 0x1b1d1f, 0),
    brass: lambert(metalTex, 0xd0a64e, 0.25),
    copper: lambert(metalTex, 0xb8703e, 0.2),
    shellRed: lambert(polyTex, 0xa3261c, 0.2),
    cord: lambert(gloveTex, 0xd9d2c0, 0),
    glove: lambert(gloveTex, 0x5b636c, 0.12),
    gloveDark: lambert(gloveTex, 0x30363c, 0.3),
    sleeve: lambert(sleeveTex, 0x3a4038, 0),
    accent: basic({ color: 0xff3b30 }),
    white: basic({ color: 0xe8f0f5 }),
    tritium: basic({ color: 0xb6ff8f }),
    glass: basic({ map: lensTex }),
    glassTint: basic({ color: 0x9ec9ff, transparent: true, opacity: 0.16, depthWrite: false }),
    bore: basic({ color: 0x050607 }),
  };

  // --- Tenue ---
  if (look.sleeve !== undefined) kit.sleeve.color.setHex(look.sleeve);
  if (look.glove !== undefined) {
    kit.glove.color.setHex(look.glove);
    kit.gloveDark.color.copy(kit.glove.color).multiplyScalar(0.5);
  }
  // --- Camouflage : il habille la garniture (polymere, bois, crosses) ; le
  // metal reste du metal, sauf pour la finition or. ---
  const camoId = look.camo ?? "standard";
  const camo = CAMOS[camoId];
  if (camo.colors.length > 0) {
    const camoTex = tex(`camo:${camoId}`, () => {
      const t = makeCamoTexture(camo.colors);
      // Des taches a l'echelle d'une arme (8 a 16 cm), pas des confettis.
      t.repeat.set(0.5, 0.5);
      return t;
    });
    for (const m of [kit.polymer, kit.sable, kit.olive, kit.wood]) {
      m.map = camoTex;
      m.color.setHex(0xffffff);
    }
    kit.dark.map = camoTex;
    kit.dark.color.setHex(0x8a8a8a);
  }
  if (camo.goldMetal) {
    kit.steel.color.setHex(0xffd36b);
    kit.metal.color.setHex(0xd9ab3c);
    kit.blued.color.setHex(0xb88a2c);
  }
  return kit;
}

// ---------------------------------------------------------------------------
// Modelage
// ---------------------------------------------------------------------------

/** Point d'un contour : [a, b], ou [a, b, rayon] pour arrondir ce coin. */
export type Pt = readonly [number, number] | readonly [number, number, number];

/** Trace un contour ferme, coins arrondis par des courbes de Bezier. */
function tracePath(path: THREE.Path, pts: readonly Pt[]) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const r = p.length > 2 ? (p[2] ?? 0) : 0;
    if (r <= 0) {
      if (i === 0) path.moveTo(p[0], p[1]);
      else path.lineTo(p[0], p[1]);
      continue;
    }
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]) || 1;
    const lb = Math.hypot(b[0] - p[0], b[1] - p[1]) || 1;
    const ra = Math.min(r, la * 0.5);
    const rb = Math.min(r, lb * 0.5);
    const x1 = p[0] + ((a[0] - p[0]) * ra) / la;
    const y1 = p[1] + ((a[1] - p[1]) * ra) / la;
    const x2 = p[0] + ((b[0] - p[0]) * rb) / lb;
    const y2 = p[1] + ((b[1] - p[1]) * rb) / lb;
    if (i === 0) path.moveTo(x1, y1);
    else path.lineTo(x1, y1);
    path.quadraticCurveTo(p[0], p[1], x2, y2);
  }
}

export function shapeOf(pts: readonly Pt[], holes: readonly (readonly Pt[])[] = []): THREE.Shape {
  const s = new THREE.Shape();
  tracePath(s, pts);
  for (const h of holes) {
    const p = new THREE.Path();
    tracePath(p, h);
    s.holes.push(p);
  }
  return s;
}

export interface ExtrudeOpts {
  /** Biseau des aretes (0 : aretes vives). */
  bevel?: number;
  /** Nombre de facettes du biseau. */
  seg?: number;
  holes?: readonly (readonly Pt[])[];
  /** Finesse des arrondis du contour. */
  curve?: number;
}

/** Extrusion centree sur z = 0, epaisseur totale `depth` (biseaux compris). */
function extrudeShape(shape: THREE.Shape, depth: number, o: ExtrudeOpts): THREE.BufferGeometry {
  const b = Math.min(o.bevel ?? 0.004, depth * 0.45);
  const core = Math.max(1e-4, depth - 2 * b);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: core,
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelOffset: -b,
    bevelSegments: o.seg ?? 2,
    curveSegments: o.curve ?? 5,
  });
  g.translate(0, 0, -core / 2);
  return g;
}

/** Un contour : liste de points, ou forme deja tracee (arcs d'un chargeur courbe). */
export type Outline = readonly Pt[] | THREE.Shape;

function toShape(o: Outline, holes?: readonly (readonly Pt[])[]): THREE.Shape {
  return o instanceof THREE.Shape ? o : shapeOf(o, holes);
}

/**
 * Profil vu de cote : points (z, y) du repere de l'arme, extrude sur la
 * largeur x et centre en x = 0. C'est la silhouette d'une carcasse.
 */
export function side(pts: Outline, width: number, o: ExtrudeOpts = {}): THREE.BufferGeometry {
  const g = extrudeShape(toShape(pts, o.holes), width, o);
  // (x, y, z) du contour -> z de l'arme = x du contour, x de l'arme = -z.
  g.rotateY(-Math.PI / 2);
  g.userData.edgeAxis = 0;
  return g;
}

/** Profil vu de face : points (x, y), extrude sur la longueur z, centre en z = 0. */
export function front(pts: Outline, length: number, o: ExtrudeOpts = {}): THREE.BufferGeometry {
  const g = extrudeShape(toShape(pts, o.holes), length, o);
  g.userData.edgeAxis = 2;
  return g;
}

/** Profil vu de dessus : points (x, z), extrude sur la hauteur y, centre en y = 0. */
export function top(pts: Outline, height: number, o: ExtrudeOpts = {}): THREE.BufferGeometry {
  const g = extrudeShape(toShape(pts, o.holes), height, o);
  // (x, y, z) du contour -> (x, -z, y) : le second axe du contour devient z.
  g.rotateX(Math.PI / 2);
  g.userData.edgeAxis = 1;
  return g;
}

/** Retourne l'ordre des sommets de chaque triangle (apres un miroir). */
function flipWinding(g: THREE.BufferGeometry) {
  if (g.index) {
    const idx = g.index.array as Uint16Array | Uint32Array;
    for (let i = 0; i < idx.length; i += 3) {
      const t = idx[i + 1];
      idx[i + 1] = idx[i + 2];
      idx[i + 2] = t;
    }
    g.index.needsUpdate = true;
    return;
  }
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name] as THREE.BufferAttribute;
    const n = a.itemSize;
    const arr = a.array as Float32Array;
    for (let i = 0; i < a.count; i += 3) {
      for (let k = 0; k < n; k++) {
        const t = arr[(i + 1) * n + k];
        arr[(i + 1) * n + k] = arr[(i + 2) * n + k];
        arr[(i + 2) * n + k] = t;
      }
    }
    a.needsUpdate = true;
  }
}

/**
 * Piece tournee autour de l'axe z : profil de points (rayon, z). Chaque coin
 * vif ([r, z] sans rayon) garde une arete nette ; un rayon arrondit.
 * Le profil se parcourt « matiere a gauche » : de l'avant vers l'arriere sur
 * la surface exterieure (voir tube()).
 */
export function lathe(pts: readonly Pt[], segments = 16): THREE.BufferGeometry {
  // Contour ouvert : on echantillonne les arrondis, puis on coupe aux coins vifs.
  const runs: THREE.Vector2[][] = [[]];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const r = p.length > 2 ? (p[2] ?? 0) : 0;
    const cur = runs[runs.length - 1];
    if (r > 0 && i > 0 && i < n - 1) {
      const a = pts[i - 1];
      const b = pts[i + 1];
      const la = Math.hypot(a[0] - p[0], a[1] - p[1]) || 1;
      const lb = Math.hypot(b[0] - p[0], b[1] - p[1]) || 1;
      const ra = Math.min(r, la * 0.5);
      const rb = Math.min(r, lb * 0.5);
      const p1 = new THREE.Vector2(p[0] + ((a[0] - p[0]) * ra) / la, p[1] + ((a[1] - p[1]) * ra) / la);
      const p2 = new THREE.Vector2(p[0] + ((b[0] - p[0]) * rb) / lb, p[1] + ((b[1] - p[1]) * rb) / lb);
      const c = new THREE.QuadraticBezierCurve(p1, new THREE.Vector2(p[0], p[1]), p2);
      for (const q of c.getPoints(4)) cur.push(q);
    } else {
      cur.push(new THREE.Vector2(p[0], p[1]));
      if (i > 0 && i < n - 1) runs.push([new THREE.Vector2(p[0], p[1])]);
    }
  }
  const parts: THREE.BufferGeometry[] = [];
  for (const run of runs) {
    if (run.length < 2) continue;
    // Les rayons nuls genent le calcul des normales : un souffle suffit.
    const clean = run.map((v) => new THREE.Vector2(Math.max(1e-5, v.x), v.y));
    const g = new THREE.LatheGeometry(clean, segments);
    const ni = g.toNonIndexed();
    g.dispose();
    parts.push(ni);
  }
  const merged = parts.length === 1 ? parts[0] : mergeSimple(parts);
  // Axe du tour (y) -> axe de l'arme (z).
  merged.rotateX(Math.PI / 2);
  merged.userData.edgeAxis = 2;
  return merged;
}

/** Tube creux (bague, fut, carenage) : rayons interieur et exterieur. */
export function tube(rIn: number, rOut: number, z0: number, z1: number, segments = 16, chamfer = 0): THREE.BufferGeometry {
  const c = Math.min(chamfer, (rOut - rIn) * 0.45, (z1 - z0) * 0.3);
  const pts: Pt[] =
    c > 0
      ? [
          [rIn, z0],
          [rOut - c, z0],
          [rOut, z0 + c],
          [rOut, z1 - c],
          [rOut - c, z1],
          [rIn, z1],
          [rIn, z0],
        ]
      : [
          [rIn, z0],
          [rOut, z0],
          [rOut, z1],
          [rIn, z1],
          [rIn, z0],
        ];
  return lathe(pts, segments);
}

/** Cylindre plein le long de z, aretes chanfreinees. */
export function rod(r: number, z0: number, z1: number, segments = 12, chamfer = 0): THREE.BufferGeometry {
  const c = Math.min(chamfer, r * 0.5, (z1 - z0) * 0.3);
  const pts: Pt[] =
    c > 0
      ? [
          [0, z0],
          [r - c, z0],
          [r, z0 + c],
          [r, z1 - c],
          [r - c, z1],
          [0, z1],
        ]
      : [
          [0, z0],
          [r, z0],
          [r, z1],
          [0, z1],
        ];
  return lathe(pts, segments);
}

/** Boite a aretes arrondies (profil de cote rectangulaire). */
export function block(w: number, h: number, d: number, bevel = 0.003): THREE.BufferGeometry {
  return side(
    [
      [-d / 2, -h / 2],
      [d / 2, -h / 2],
      [d / 2, h / 2],
      [-d / 2, h / 2],
    ],
    w,
    { bevel: Math.min(bevel, h * 0.3, d * 0.3), seg: 1 },
  );
}

export function sphere(r: number, w = 10, h = 8): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, w, h);
  g.userData.edgeAxis = -1;
  return g;
}

/** Capsule entre deux points : phalanges, montants, tiges. */
export function capsuleBetween(a: THREE.Vector3, b: THREE.Vector3, r: number, radial = 8): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const g = new THREE.CapsuleGeometry(r, Math.max(1e-4, len), 3, radial);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tmpDir.subVectors(b, a).normalize());
  g.applyQuaternion(q);
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  g.userData.edgeAxis = -1;
  return g;
}
const tmpDir = new THREE.Vector3();

/** Fusion sans verification (memes attributs garantis par construction). */
function mergeSimple(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let count = 0;
  for (const g of geos) count += g.attributes.position.count;
  const out = new THREE.BufferGeometry();
  for (const name of ["position", "normal", "uv", "color"]) {
    if (!geos.every((g) => g.attributes[name])) continue;
    const size = (geos[0].attributes[name] as THREE.BufferAttribute).itemSize;
    const arr = new Float32Array(count * size);
    let off = 0;
    for (const g of geos) {
      const a = g.attributes[name] as THREE.BufferAttribute;
      arr.set(a.array as Float32Array, off);
      off += a.count * size;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  for (const g of geos) g.dispose();
  return out;
}

/**
 * Derniere passe sur une geometrie : triangles independants, texture
 * projetee a densite constante, et couleur de sommet (usure des biseaux).
 */
export function finishGeometry(src: THREE.BufferGeometry, wear: number): THREE.BufferGeometry {
  const axis: number = src.userData.edgeAxis ?? -1;
  const g = src.index ? src.toNonIndexed() : src;
  if (g !== src) src.dispose();
  if (!g.attributes.normal) g.computeVertexNormals();
  const count = g.attributes.position.count;
  // Lecture directe des tableaux : cette boucle passe sur chaque sommet de
  // chaque piece, c'est elle qui coutait le plus a la construction.
  const P = (g.attributes.position as THREE.BufferAttribute).array;
  const N = (g.attributes.normal as THREE.BufferAttribute).array;
  const uv = new Float32Array(count * 2);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const x = P[i3];
    const y = P[i3 + 1];
    const z = P[i3 + 2];
    const nx = Math.abs(N[i3]);
    const ny = Math.abs(N[i3 + 1]);
    const nz = Math.abs(N[i3 + 2]);
    let u: number;
    let v: number;
    if (nx >= ny && nx >= nz) {
      u = z;
      v = y;
    } else if (ny >= nz) {
      u = z;
      v = x;
    } else {
      u = x;
      v = y;
    }
    uv[i * 2] = u * UV_DENSITY;
    uv[i * 2 + 1] = v * UV_DENSITY;
    // Biseau : la normale n'est ni dans l'axe d'extrusion, ni perpendiculaire.
    let e = 0;
    if (axis >= 0 && wear > 0) {
      const c = axis === 0 ? nx : axis === 1 ? ny : nz;
      if (c > 0.12 && c < 0.93) e = 1;
    }
    const k = 1 + wear * e;
    col[i * 3] = k;
    col[i * 3 + 1] = k;
    col[i * 3 + 2] = k;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

/** Retourne une geometrie en miroir (x -> -x) : la main gauche. */
export function mirrorX(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.scale(-1, 1, 1);
  flipWinding(g);
  return g;
}

export interface Forge {
  /** Pose une piece : geometrie finie, matiere, position et rotation. */
  part(
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x?: number,
    y?: number,
    z?: number,
    rx?: number,
    ry?: number,
    rz?: number,
  ): THREE.Mesh;
  /** Un groupe (piece mobile) pose sur son parent. */
  group(parent: THREE.Object3D, x?: number, y?: number, z?: number): THREE.Group;
}

export function createForge(keep: Disposer, mirror = false): Forge {
  return {
    part(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
      const g = keep(finishGeometry(geo, WEAR.get(mat) ?? 0));
      if (mirror) mirrorX(g);
      const m = new THREE.Mesh(g, mat);
      m.position.set(mirror ? -x : x, y, z);
      m.rotation.set(rx, mirror ? -ry : ry, mirror ? -rz : rz);
      parent.add(m);
      return m;
    },
    group(parent, x = 0, y = 0, z = 0) {
      const g = new THREE.Group();
      g.position.set(mirror ? -x : x, y, z);
      parent.add(g);
      return g;
    },
  };
}

/** Marque une piece d'optique : on vise a travers, elle ne bouche pas la ligne de mire. */
export function optic<T extends THREE.Object3D>(o: T): T {
  o.userData.optic = true;
  return o;
}

// ---------------------------------------------------------------------------
// Fusion
// ---------------------------------------------------------------------------

/**
 * Toutes les matieres de l'atelier lisent la couleur de sommet : une piece
 * qui n'en a pas (primitive ajoutee ailleurs) en recoit une blanche, sinon
 * elle sortirait noire.
 */
export function ensureVertexColors(root: THREE.Object3D) {
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const g = o.geometry as THREE.BufferGeometry;
    if (g.attributes.color || !g.attributes.position) return;
    const n = g.attributes.position.count;
    const c = new Float32Array(n * 3).fill(1);
    g.setAttribute("color", new THREE.BufferAttribute(c, 3));
  });
}

/**
 * Rend un lot de geometries fusionnables : toutes indexees ou aucune, et les
 * memes attributs. Les geometries remplacees sont liberees ici ; l'appelant
 * libere celles du tableau rendu.
 */
export function prepareMerge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry[] {
  const mixed = geos.some((g) => g.index) && geos.some((g) => !g.index);
  let out = geos;
  if (mixed) {
    out = geos.map((g) => {
      if (!g.index) return g;
      const n = g.toNonIndexed();
      g.dispose();
      return n;
    });
  }
  const names = Object.keys(out[0].attributes).filter((k) => out.every((g) => g.attributes[k]));
  for (const g of out) {
    for (const k of Object.keys(g.attributes)) if (!names.includes(k)) g.deleteAttribute(k);
    const morph = g.morphAttributes as Record<string, unknown>;
    for (const k of Object.keys(morph)) delete morph[k];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Mains gantees
// ---------------------------------------------------------------------------

/**
 * Forme de la main :
 * - « poignee » : les doigts enroulent une poignee verticale (axe y du
 *   repere, poignet vers +z) ; c'est la main droite, en miroir la gauche ;
 * - « appui » : main gauche, la paume sous un garde-main d'axe z, les doigts
 *   remontent sur son flanc droit, le pouce longe le flanc gauche ;
 * - « soutien » : main gauche d'un pistolet, qui enveloppe les doigts de la
 *   main droite (meme origine, meme inclinaison), le pouce vers l'avant.
 */
export type HandShape = "poignee" | "appui" | "soutien";

interface Finger {
  /** Articulations : base (jointure), deux phalanges, bout. */
  pts: [number, number, number][];
  r: number;
}

/** Un volume charnu : centre, demi-axes, rotation. */
interface Blob {
  at: [number, number, number];
  r: [number, number, number];
  rot?: [number, number, number];
}

interface HandPlan {
  fingers: Finger[];
  /** Dos de la main. */
  back: Blob;
  /** Direction du dos de la main : la coque des jointures s'y decale. */
  out: [number, number, number];
  /** Talon de la main, eminence du pouce. */
  flesh: Blob[];
  wrist: [number, number, number];
  dir: [number, number, number];
}

const V = (p: readonly [number, number, number]) => new THREE.Vector3(p[0], p[1], p[2]);

/** Pente minimale de l'avant-bras vers le coude, dans le repere de l'arme (dy / dz). */
const ARM_SLOPE = -0.2;

const HAND_PLANS: Record<HandShape, HandPlan> = {
  // Main droite autour d'une poignee (demi-largeur 3 cm, demi-profondeur
  // 4,4 cm). L'index est plus haut que les autres doigts : le pontet passe
  // entre lui et le majeur.
  poignee: {
    fingers: [
      // Index : tendu vers la detente, la derniere phalange repliee dessus.
      { pts: [[0.05, 0.055, -0.014], [0.031, 0.058, -0.062], [0.013, 0.053, -0.088], [0.004, 0.039, -0.098]], r: 0.0102 },
      // Majeur, annulaire, auriculaire : enroules autour du devant.
      { pts: [[0.052, 0.013, -0.01], [0.012, 0.013, -0.056], [-0.024, 0.012, -0.046], [-0.04, 0.011, -0.021]], r: 0.0106 },
      { pts: [[0.051, -0.015, -0.006], [0.013, -0.016, -0.054], [-0.022, -0.017, -0.045], [-0.037, -0.018, -0.022]], r: 0.0102 },
      { pts: [[0.046, -0.041, 0.0], [0.016, -0.043, -0.049], [-0.015, -0.044, -0.045], [-0.031, -0.044, -0.027]], r: 0.0088 },
      // Pouce : du creux de la main, le long du flanc gauche, vers l'avant.
      { pts: [[0.004, 0.034, 0.058], [-0.03, 0.054, 0.036], [-0.044, 0.063, 0.004], [-0.046, 0.064, -0.026]], r: 0.0122 },
    ],
    back: { at: [0.041, 0.006, 0.036], r: [0.014, 0.046, 0.05], rot: [0, -0.2, 0] },
    out: [0.98, 0, 0.2],
    flesh: [
      { at: [0.006, -0.006, 0.064], r: [0.03, 0.046, 0.02], rot: [0, 0.3, 0] },
      { at: [-0.024, 0.03, 0.052], r: [0.019, 0.028, 0.026], rot: [0, 0, 0.3] },
    ],
    wrist: [0.024, -0.016, 0.096],
    dir: [0.1, -0.28, 1],
  },
  // Main gauche sous un garde-main (demi-largeur 3,8 cm, demi-hauteur 4,2 cm).
  appui: {
    fingers: [
      // Les doigts remontent le flanc droit en penchant vers l'avant.
      { pts: [[0.03, -0.058, -0.031], [0.048, -0.016, -0.04], [0.048, 0.012, -0.05], [0.037, 0.028, -0.057]], r: 0.0102 },
      { pts: [[0.032, -0.06, -0.009], [0.05, -0.016, -0.018], [0.05, 0.014, -0.028], [0.039, 0.031, -0.035]], r: 0.0106 },
      { pts: [[0.031, -0.06, 0.012], [0.049, -0.018, 0.004], [0.049, 0.01, -0.006], [0.038, 0.026, -0.013]], r: 0.0102 },
      { pts: [[0.028, -0.058, 0.031], [0.046, -0.022, 0.024], [0.046, 0.002, 0.016], [0.037, 0.017, 0.01]], r: 0.0088 },
      // Pouce : il longe le flanc gauche du garde-main, vers l'avant.
      { pts: [[-0.028, -0.064, 0.018], [-0.048, -0.046, -0.014], [-0.055, -0.022, -0.044], [-0.051, -0.006, -0.068]], r: 0.012 },
    ],
    back: { at: [0.004, -0.071, 0.01], r: [0.044, 0.014, 0.046], rot: [0, 0.35, 0.18] },
    out: [0.2, -0.98, 0],
    flesh: [
      { at: [-0.034, -0.058, 0.006], r: [0.022, 0.02, 0.03], rot: [0, 0, 0.4] },
      { at: [-0.012, -0.07, 0.036], r: [0.026, 0.018, 0.022] },
    ],
    wrist: [-0.022, -0.076, 0.044],
    dir: [-0.5, -0.64, 0.58],
  },
  // Main gauche d'un pistolet : les doigts passent devant ceux de la main
  // droite, la paume contre le flanc gauche de la poignee.
  soutien: {
    fingers: [
      { pts: [[-0.066, 0.002, -0.026], [-0.052, 0.0, -0.074], [-0.014, -0.002, -0.088], [0.018, -0.004, -0.078]], r: 0.0102 },
      { pts: [[-0.068, -0.023, -0.022], [-0.054, -0.025, -0.071], [-0.016, -0.027, -0.086], [0.016, -0.029, -0.076]], r: 0.0106 },
      { pts: [[-0.067, -0.047, -0.018], [-0.053, -0.049, -0.066], [-0.017, -0.051, -0.08], [0.012, -0.053, -0.071]], r: 0.0102 },
      { pts: [[-0.063, -0.069, -0.012], [-0.05, -0.071, -0.058], [-0.018, -0.073, -0.072], [0.006, -0.075, -0.064]], r: 0.0088 },
      // Pouce : sous celui de la main droite, pointe vers l'avant.
      { pts: [[-0.058, 0.012, 0.032], [-0.07, 0.03, -0.004], [-0.064, 0.042, -0.036], [-0.057, 0.046, -0.064]], r: 0.0118 },
    ],
    back: { at: [-0.078, -0.034, 0.014], r: [0.015, 0.048, 0.046], rot: [0, 0.22, 0] },
    out: [-0.97, 0, 0.22],
    flesh: [
      { at: [-0.058, -0.03, 0.02], r: [0.014, 0.045, 0.04] },
      { at: [-0.06, 0.004, 0.042], r: [0.02, 0.028, 0.024], rot: [0, 0, -0.3] },
    ],
    wrist: [-0.07, -0.066, 0.062],
    dir: [-0.28, -0.42, 1],
  },
};

/**
 * Volume charnu de la main (dos, talon, pouce) : une sphere « gonflee »
 * vers le cube (exposant < 1), plus proche d'une main que d'une balle.
 */
function ellipsoid(rx: number, ry: number, rz: number, boxy = 0.7): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 16, 11);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    pos.setXYZ(
      i,
      Math.sign(x) * Math.abs(x) ** boxy * rx,
      Math.sign(y) * Math.abs(y) ** boxy * ry,
      Math.sign(z) * Math.abs(z) ** boxy * rz,
    );
  }
  g.computeVertexNormals();
  g.userData.edgeAxis = -1;
  return g;
}

/**
 * Une main gantee, son poignet et la manche. L'origine est le centre de ce
 * qu'elle tient. Gant de toile aux volumes arrondis (dos de la main, talon,
 * pouce), coque rigide moulee sur les jointures, coussinets sur les
 * phalanges et bouts renforces ; poignet a sangle, puis la manche de treillis
 * au bord retourne, assez longue pour toujours sortir du cadre.
 */
function buildHandParts(
  kit: Pick<GunKit, "glove" | "gloveDark" | "sleeve">,
  keep: Disposer,
  shape: HandShape,
  left: boolean,
  tilt: number,
): THREE.Group {
  const h = new THREE.Group();
  // « appui » et « soutien » sont dessinees directement en main gauche.
  const mirror = shape === "poignee" && left;
  const f = createForge(keep, mirror);
  const { glove, gloveDark, sleeve } = kit;
  const plan = HAND_PLANS[shape];
  const out = V(plan.out).normalize();
  const ca = Math.cos(-tilt);
  const sa = Math.sin(-tilt);
  const blob = (b: Blob, mat: THREE.Material, grow = 1) => {
    const [rx, ry, rz] = b.rot ?? [0, 0, 0];
    f.part(h, ellipsoid(b.r[0] * grow, b.r[1] * grow, b.r[2] * grow), mat, b.at[0], b.at[1], b.at[2], rx, ry, rz);
  };

  const bases: THREE.Vector3[] = [];
  plan.fingers.forEach((fg, n) => {
    const p = fg.pts.map(V);
    if (shape === "poignee" && n === 0 && tilt !== 0) {
      // L'index pivote sur sa jointure pour compenser l'inclinaison.
      for (let i = 1; i < p.length; i++) {
        const y = p[i].y - p[0].y;
        const z = p[i].z - p[0].z;
        p[i].set(p[i].x, p[0].y + y * ca - z * sa, p[0].z + y * sa + z * ca);
      }
    }
    for (let i = 0; i < 3; i++) {
      // Les phalanges s'affinent vers le bout.
      const r = fg.r * (1 - i * 0.08);
      f.part(h, capsuleBetween(p[i], p[i + 1], r, 9), glove);
    }
    // Articulations un peu renflees : le doigt ne ressemble plus a un tuyau.
    f.part(h, sphere(fg.r * 1.06, 9, 6), glove, p[1].x, p[1].y, p[1].z);
    f.part(h, sphere(fg.r * 0.98, 9, 6), glove, p[2].x, p[2].y, p[2].z);
    if (n === 4) return;
    bases.push(p[0]);
    // Coussinet sombre sur la phalange, bout de doigt renforce.
    f.part(h, capsuleBetween(p[1].clone().lerp(p[2], 0.2), p[1].clone().lerp(p[2], 0.75), fg.r * 1.08, 8), gloveDark);
    f.part(h, capsuleBetween(p[2].clone().lerp(p[3], 0.5), p[3], fg.r * 0.97, 8), gloveDark);
    // Coque moulee sur la jointure.
    const k = p[0].clone().addScaledVector(out, fg.r * 0.35);
    f.part(h, sphere(fg.r * 1.02, 12, 9), gloveDark, k.x, k.y, k.z);
  });
  // La coque des jointures est d'un seul tenant : un bourrelet les relie.
  const k0 = bases[0].clone().addScaledVector(out, 0.003);
  const k3 = bases[3].clone().addScaledVector(out, 0.003);
  f.part(h, capsuleBetween(k0, k3, 0.0092, 10), gloveDark);

  // Dos de la main, et un renfort rembourre en son milieu.
  blob(plan.back, glove);
  const pad: Blob = {
    at: [plan.back.at[0] + out.x * 0.0035, plan.back.at[1] + out.y * 0.0035, plan.back.at[2] + out.z * 0.0035],
    r: [plan.back.r[0] * 0.8, plan.back.r[1] * 0.74, plan.back.r[2] * 0.62],
    rot: plan.back.rot,
  };
  blob(pad, gloveDark);
  for (const b of plan.flesh) blob(b, glove);

  // --- Poignet : bord du gant a sangle, puis manche ---
  const cuffGroup = new THREE.Group();
  const w = V(plan.wrist);
  const d = V(plan.dir).normalize();
  if (mirror) {
    w.x = -w.x;
    d.x = -d.x;
  }
  if (shape !== "appui") {
    // La main est posee inclinee de `tilt` sur l'arme. Sur une poignee tres
    // couchee (fusil de chasse, revolver), l'avant-bras remontait vers l'oeil
    // et, en visee, la manche bouchait la moitie de l'ecran : dans le repere
    // de l'arme, il redescend toujours un peu vers le coude.
    const c = Math.cos(tilt);
    const sn = Math.sin(tilt);
    let wy = d.y * c - d.z * sn;
    const wz = d.y * sn + d.z * c;
    wy = Math.min(wy, ARM_SLOPE * wz);
    d.set(d.x, wy * c + wz * sn, -wy * sn + wz * c).normalize();
  }
  cuffGroup.position.copy(w);
  cuffGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
  h.add(cuffGroup);
  const g2 = createForge(keep);
  // Le poignet est ovale : plus large que haut.
  const oval = (m: THREE.Mesh) => m.scale.set(1.12, 0.86, 1);
  oval(g2.part(cuffGroup, lathe([[0.0001, -0.02], [0.028, -0.016, 0.008], [0.033, 0.01, 0.01], [0.036, 0.05], [0.0001, 0.052]], 18), glove));
  // Sangle auto-agrippante et sa languette.
  oval(g2.part(cuffGroup, tube(0.033, 0.0385, 0.012, 0.038, 18, 0.004), gloveDark));
  oval(g2.part(cuffGroup, block(0.01, 0.02, 0.03, 0.004), gloveDark, 0.037, 0.004, 0.024, 0, 0, 0.2));
  // Manche : bord retourne, puis l'avant-bras qui s'evase jusqu'au coude.
  oval(
    g2.part(
      cuffGroup,
      lathe(
        [
          [0.0001, 0.046],
          [0.038, 0.046],
          [0.046, 0.05, 0.004],
          [0.048, 0.074, 0.006],
          [0.045, 0.082, 0.003],
          [0.047, 0.1, 0.008],
          [0.05, 0.17, 0.02],
          [0.049, 0.22, 0.02],
          [0.055, 0.3, 0.03],
          [0.062, 0.52],
          [0.0001, 0.52],
        ],
        20,
      ),
      sleeve,
    ),
  );
  return h;
}

/**
 * Mains deja construites, par forme : la meme main sert aux treize armes. On
 * garde ses trois maillages fusionnes (gant, renforts, manche) et chaque arme
 * les habille de ses propres matieres. La derniere arme detruite les libere.
 */
const handCache = new Map<string, { geos: [THREE.BufferGeometry, THREE.BufferGeometry, THREE.BufferGeometry]; users: number }>();

/**
 * Une main gantee, son poignet et la manche. L'origine est le centre de ce
 * qu'elle tient. Voir buildHandParts pour le detail ; ici, trois maillages.
 */
export function buildGloveHand(
  kit: Pick<GunKit, "glove" | "gloveDark" | "sleeve">,
  keep: Disposer,
  shape: HandShape,
  left: boolean,
  /** Inclinaison de la poignee : l'index reste a l'horizontale, le long de la carcasse. */
  tilt = 0,
): THREE.Group {
  const key = `${shape}|${left ? 1 : 0}|${shape === "appui" ? 0 : tilt.toFixed(4)}`;
  let entry = handCache.get(key);
  if (!entry) {
    const tmp: { dispose(): void }[] = [];
    const parts = buildHandParts(kit, (x) => (tmp.push(x), x), shape, left, tilt);
    parts.updateMatrixWorld(true);
    const lists: THREE.BufferGeometry[][] = [[], [], []];
    const mats = [kit.glove, kit.gloveDark, kit.sleeve];
    parts.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const i = mats.indexOf(o.material as THREE.MeshLambertMaterial);
      if (i < 0) return;
      lists[i].push((o.geometry as THREE.BufferGeometry).applyMatrix4(o.matrixWorld));
    });
    const geos = lists.map((l) => {
      const g = mergeSimple(l);
      g.userData.shared = true;
      return g;
    }) as [THREE.BufferGeometry, THREE.BufferGeometry, THREE.BufferGeometry];
    for (const t of tmp) t.dispose();
    entry = { geos, users: 0 };
    handCache.set(key, entry);
  }
  const e = entry;
  e.users += 1;
  let released = false;
  keep({
    dispose() {
      if (released) return;
      released = true;
      e.users -= 1;
      if (e.users <= 0) {
        for (const g of e.geos) g.dispose();
        if (handCache.get(key) === e) handCache.delete(key);
      }
    },
  });
  const h = new THREE.Group();
  h.add(new THREE.Mesh(e.geos[0], kit.glove), new THREE.Mesh(e.geos[1], kit.gloveDark), new THREE.Mesh(e.geos[2], kit.sleeve));
  return h;
}

/**
 * Bout de l'index droit dans le repere de la main, pour une poignee inclinee
 * de `tilt` : l'index pivote sur sa jointure pour rester a l'horizontale
 * (voir buildGloveHand). La queue de detente se place juste derriere.
 */
export function indexTipLocal(tilt: number): THREE.Vector3 {
  const p = HAND_PLANS.poignee.fingers[0].pts;
  const b = p[0];
  const t = p[3];
  const ca = Math.cos(-tilt);
  const sa = Math.sin(-tilt);
  const y = t[1] - b[1];
  const z = t[2] - b[2];
  return new THREE.Vector3(t[0], b[1] + y * ca - z * sa, b[2] + y * sa + z * ca);
}

/**
 * Rotations de la main gauche pour les gestes du rechargement : saisir un
 * chargeur (vertical) par son flanc gauche, et tirer un levier d'armement du
 * cote `side` (-1 gauche, +1 droite).
 */
export function leftGestureRotations(shape: HandShape, side: number, tilt = 0) {
  if (shape === "appui") {
    return {
      grab: new THREE.Vector3(Math.PI / 2, 0, -Math.PI / 2),
      handle: new THREE.Vector3(Math.PI / 2, 0, side * (Math.PI / 2)),
    };
  }
  if (shape === "soutien") {
    // La main garde sa prise et descend avec le chargeur ; pour la culasse,
    // elle passe par-dessus.
    return {
      grab: new THREE.Vector3(tilt, 0, 0),
      handle: new THREE.Vector3(tilt - 0.3, 0.35, 0.9),
    };
  }
  return {
    grab: new THREE.Vector3(-0.1, -1.25, 0),
    handle: new THREE.Vector3(-0.15, -side * 1.1, 0),
  };
}
