// Cubes — les villages : une place et sa fontaine, des rues pavees, des
// maisons, des champs, un moulin, un four a pain, un lavoir...
//
// Des hameaux ORIGINAUX, dessines d'apres de vrais villages : maisons a
// colombages des plaines, maisons de terre a toit-terrasse du desert, chalets
// de pierre et de bois en montagne. Generer des villages avec le monde est
// une idee libre ; les plans, les decors et les habitants sont les notres et
// ne reprennent rien d'un autre jeu.
//
// Comme le relief, un village est une fonction pure de la graine. Le monde est
// decoupe en regions de 128 x 128 blocs ; chacune accueille au plus un
// village, entierement contenu dans la region. Son plan (place, rues, lots)
// est calcule une fois, a la premiere zone generee de la region, puis chaque
// zone y pose ce qui la traverse. Rien n'est sauvegarde : seules les
// modifications du joueur le sont, comme pour le reste du monde.
//
// Les mondes crees avant les villages gardent leurs constructions : un
// village qui tomberait sur une modification du joueur n'apparait pas (voir
// `zonesAProteger`), et cette decision est ensuite sauvegardee avec le monde.

import {
  AIR, BIBLIOTHEQUE, BLE_1, BLE_2, BOTTE_FOIN, BRIQUE, BRIQUES_PIERRE, CHUNK, CITROUILLE, CITROUILLE_LANTERNE, EAU,
  FLEUR_BLEUE, FLEUR_JAUNE, FLEUR_ROUGE, FOUR, GRAVIER, GRES, GRES_ROUGE, GRES_TAILLE, HERBE, LAINE_BLANCHE, LAMPE,
  MELON, NEIGE, PIERRE_CISELEE, PIERRE_MOUSSUE, PIERRE_POLIE, PIERRE_TAILLEE, PLANCHES, PLANCHES_CLAIRES,
  PLANCHES_SOMBRES, SABLE, SEA_LEVEL, TABLE_CRAFT, TERRE, TERRE_CUITE, TERRE_LABOUREE, TRONC, VERRE, WORLD_HEIGHT,
  beton, columnAt, lampeCouleur, laine, spawnPoint, terreCuiteTeintee, type Biome, type BlockId, type Structures,
} from "./voxel";

export type StyleVillage = "colombages" | "adobe" | "chalet";
export type Ecrire = (x: number, y: number, z: number, id: BlockId) => void;

/** Cote d'une region, en blocs (8 x 8 zones) : au plus un village chacune. */
export const REGION = 128;
/** Un village tient dans un carre de 2 x RAYON + 1 blocs autour de son centre. */
const RAYON = 34;
const COTE = 2 * RAYON + 1;
/** Part des regions qui tentent un village (le terrain doit encore s'y preter). */
const CHANCE = 0.7;
/** Rayon de la place. */
const RS = 5;
/** Sol le plus haut pour un village : les toits et le moulin doivent tenir sous le ciel. */
const SOL_MAX = WORLD_HEIGHT - 22;

/**
 * Case devant une porte de maison (y : la case ou se tenir, au-dessus du sol)
 * et direction (dx, dz) qui entre dans la maison.
 */
export interface Porte {
  x: number;
  y: number;
  z: number;
  dx: number;
  dz: number;
}

export interface Village {
  rx: number;
  rz: number;
  nom: string;
  style: StyleVillage;
  /** Centre de la place ; y : premiere case d'air au-dessus du pave. */
  x: number;
  y: number;
  z: number;
  /** Emprise de tout ce qui est pose, bornes comprises. */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  portes: Porte[];
  pieces: Piece[];
}

/** Un morceau du village (place, rue, maison...) : son emprise et ce qu'il pose. */
export interface Piece {
  sorte: "place" | "rue" | "lampadaire" | TypeLot;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  poser(e: Ecrire): void;
}

// ---------------------------------------------------------------------------
// Hasard reproductible
// ---------------------------------------------------------------------------

function melange(a: number, b: number, c: number): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Valeur fixe de 0 a 1 pour une case (motifs des paves, des cultures). */
function bruit(x: number, z: number, s: number): number {
  return melange(x, z, s) / 4294967296;
}

/** Suite pseudo-aleatoire a graine : le meme village a chaque partie. */
function hasard(graine: number): () => number {
  let s = graine >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function choisir<T>(rand: () => number, liste: readonly T[]): T {
  return liste[Math.floor(rand() * liste.length)];
}

// ---------------------------------------------------------------------------
// Reperes et terrain
// ---------------------------------------------------------------------------

/**
 * Repere d'un lot : origine (u = 0, v = 0) au coin avant du lot, U le long de
 * la rue, V vers le fond du lot. La facade (v = 0) regarde la rue.
 */
interface Repere {
  ox: number;
  oz: number;
  ux: number;
  uz: number;
  vx: number;
  vz: number;
}

const xDe = (r: Repere, u: number, v: number) => r.ox + r.ux * u + r.vx * v;
const zDe = (r: Repere, u: number, v: number) => r.oz + r.uz * u + r.vz * v;

/** Emprise monde d'un rectangle local, bornes comprises. */
function emprise(r: Repere, u0: number, v0: number, u1: number, v1: number) {
  const ax = xDe(r, u0, v0), az = zDe(r, u0, v0), bx = xDe(r, u1, v1), bz = zDe(r, u1, v1);
  return { x0: Math.min(ax, bx), z0: Math.min(az, bz), x1: Math.max(ax, bx), z1: Math.max(az, bz) };
}

type Local = (u: number, y: number, v: number, id: BlockId) => void;

function local(e: Ecrire, r: Repere): Local {
  return (u, y, v, id) => e(xDe(r, u, v), y, zDe(r, u, v), id);
}

type Hauteur = (x: number, z: number) => number;

/**
 * Prepare une colonne : remblai sous le sol s'il manque de la terre, sol en y,
 * et vide au-dessus sur `degage` cases (ou jusqu'au haut de la colline).
 */
function aplanir(e: Ecrire, h: Hauteur, x: number, z: number, y: number, remblai: BlockId, sol: BlockId, degage: number) {
  const t = h(x, z);
  for (let k = t + 1; k < y; k++) e(x, k, z, remblai);
  e(x, y, z, sol);
  const haut = Math.max(t + 1, y + degage);
  for (let k = y + 1; k <= haut; k++) e(x, k, z, AIR);
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

interface Materiaux {
  /** Paves des rues et de la place, tires au hasard case par case. */
  pave: BlockId[];
  bordure: BlockId;
  remblai: BlockId;
  /** Sol devant les portes. */
  chemin: BlockId;
  /** Sol naturel autour des maisons. */
  nature: BlockId;
  poteauLampe: BlockId;
  lampe: BlockId;
  margelle: BlockId;
  colonne: BlockId;
}

function materiaux(style: StyleVillage, neige: boolean): Materiaux {
  switch (style) {
    case "adobe":
      return {
        pave: [GRES, GRES, GRES_TAILLE], bordure: GRES_ROUGE, remblai: GRES, chemin: GRES_TAILLE, nature: SABLE,
        poteauLampe: GRES_TAILLE, lampe: lampeCouleur(1), margelle: GRES_TAILLE, colonne: GRES_ROUGE,
      };
    case "chalet":
      return {
        pave: [PIERRE_TAILLEE, PIERRE_TAILLEE, GRAVIER], bordure: BRIQUES_PIERRE, remblai: PIERRE_TAILLEE, chemin: GRAVIER,
        nature: neige ? NEIGE : HERBE, poteauLampe: TRONC, lampe: LAMPE, margelle: BRIQUES_PIERRE, colonne: TRONC,
      };
    default:
      return {
        pave: [PIERRE_TAILLEE, PIERRE_TAILLEE, PIERRE_POLIE, PIERRE_MOUSSUE], bordure: BRIQUES_PIERRE, remblai: PIERRE_TAILLEE,
        chemin: PIERRE_POLIE, nature: HERBE, poteauLampe: PLANCHES_SOMBRES, lampe: LAMPE, margelle: PIERRE_CISELEE,
        colonne: PIERRE_CISELEE,
      };
  }
}

const pave = (m: Materiaux, x: number, z: number) => m.pave[Math.floor(bruit(x, z, 11) * m.pave.length)];

function styleDuBiome(b: Biome): StyleVillage {
  return b === "desert" ? "adobe" : b === "montagne" || b === "neige" ? "chalet" : "colombages";
}

const NOMS: Record<StyleVillage, { debut: string[]; fin: string[]; colle: boolean }> = {
  colombages: {
    debut: ["Beau", "Clair", "Bel", "Grand", "Vert", "Bon", "Joli", "Doux", "Franc", "Haut"],
    fin: ["val", "pré", "champ", "mont", "bois", "lieu", "fond", "clos", "ru", "verger"],
    colle: true,
  },
  adobe: {
    debut: ["Oasis", "Puits", "Dune", "Source", "Palmeraie", "Sable"],
    fin: ["d’Or", "Rouge", "du Midi", "des Vents", "aux Palmes", "du Soleil"],
    colle: false,
  },
  chalet: {
    debut: ["Roche", "Val", "Col", "Pré", "Pierre", "Combe"],
    fin: ["des Cimes", "du Lac", "aux Sapins", "des Neiges", "du Glacier", "aux Marmottes"],
    colle: false,
  },
};

function nommer(style: StyleVillage, rand: () => number): string {
  const n = NOMS[style];
  const a = choisir(rand, n.debut), b = choisir(rand, n.fin);
  return n.colle ? a + b : `${a}-${b.replace(/ /g, "-")}`;
}

// ---------------------------------------------------------------------------
// Le chantier : terrain et occupation du sol autour du centre
// ---------------------------------------------------------------------------

const LIBRE = 0, RUE = 1, LOT = 2, HORS = 255;

class Chantier {
  readonly occ = new Uint8Array(COTE * COTE);
  private readonly hauteurs = new Int16Array(COTE * COTE).fill(-1);
  readonly pieces: Piece[] = [];
  readonly portes: Porte[] = [];
  readonly seed: number;
  readonly cx: number;
  readonly cz: number;

  constructor(seed: number, cx: number, cz: number) {
    this.seed = seed;
    this.cx = cx;
    this.cz = cz;
  }

  dans(x: number, z: number) {
    return Math.abs(x - this.cx) <= RAYON && Math.abs(z - this.cz) <= RAYON;
  }

  private index(x: number, z: number) {
    return (z - this.cz + RAYON) * COTE + (x - this.cx + RAYON);
  }

  /** Hauteur du terrain naturel (memorisee : le plan la relit souvent). */
  readonly h: Hauteur = (x, z) => {
    if (!this.dans(x, z)) return columnAt(x, z, this.seed).height;
    const i = this.index(x, z);
    if (this.hauteurs[i] < 0) this.hauteurs[i] = columnAt(x, z, this.seed).height;
    return this.hauteurs[i];
  };

  code(x: number, z: number) {
    return this.dans(x, z) ? this.occ[this.index(x, z)] : HORS;
  }

  /** Reserve une case libre (une rue ou un lot ne sont jamais ecrases). */
  reserver(x: number, z: number, c: number) {
    if (this.code(x, z) === LIBRE) this.occ[this.index(x, z)] = c;
  }
}

/** Le terrain convient-il a un village centre ici ? Renvoie son style. */
function site(seed: number, cx: number, cz: number): StyleVillage | null {
  const c = columnAt(cx, cz, seed);
  if (c.height <= SEA_LEVEL + 1 || c.height > SOL_MAX) return null;
  let eau = 0, n = 0, bas = Infinity, haut = -Infinity;
  for (let dz = -24; dz <= 24; dz += 6) {
    for (let dx = -24; dx <= 24; dx += 6) {
      const t = columnAt(cx + dx, cz + dz, seed).height;
      n++;
      if (t <= SEA_LEVEL + 1) {
        eau++;
        continue;
      }
      if (Math.abs(dx) <= 12 && Math.abs(dz) <= 12) {
        bas = Math.min(bas, t);
        haut = Math.max(haut, t);
      }
    }
  }
  if (eau > n * 0.2 || haut - bas > 6) return null;
  return styleDuBiome(c.biome);
}

// ---------------------------------------------------------------------------
// Rues
// ---------------------------------------------------------------------------

interface Rue {
  /** Direction de la rue, et sa perpendiculaire. */
  dx: number;
  dz: number;
  px: number;
  pz: number;
  /** Niveau du pave, case par case depuis la place. */
  prof: number[];
}

/**
 * Trace une rue droite depuis la place : son niveau suit le terrain mais ne
 * monte ou ne descend que d'une case a la fois (toujours franchissable). Elle
 * s'arrete quand le terrain s'en ecarte trop, et passe l'eau sur un pont.
 */
function tracer(ch: Chantier, ys: number, dx: number, dz: number, longueur: number): Rue | null {
  const prof: number[] = [];
  let prec = ys;
  for (let i = 0; i < longueur; i++) {
    const x = ch.cx + dx * (RS + 1 + i), z = ch.cz + dz * (RS + 1 + i);
    let t = ch.h(x, z);
    if (t <= SEA_LEVEL) t = SEA_LEVEL + 1;
    const y = Math.max(prec - 1, Math.min(prec + 1, t));
    if (Math.abs(y - t) > 3 || y > SOL_MAX) break;
    prof.push(y);
    prec = y;
  }
  if (prof.length < 8) return null;
  const rue = { dx, dz, px: -dz, pz: dx, prof };
  for (let i = 0; i < prof.length; i++) {
    for (let w = -1; w <= 1; w++) ch.reserver(ch.cx + dx * (RS + 1 + i) + rue.px * w, ch.cz + dz * (RS + 1 + i) + rue.pz * w, RUE);
  }
  return rue;
}

function pieceRue(ch: Chantier, m: Materiaux, rue: Rue): Piece {
  const { cx, cz, h } = ch;
  const L = rue.prof.length;
  const ax = cx + rue.dx * (RS + 1), az = cz + rue.dz * (RS + 1);
  const bx = cx + rue.dx * (RS + L), bz = cz + rue.dz * (RS + L);
  return {
    sorte: "rue",
    x0: Math.min(ax, bx) - Math.abs(rue.px),
    z0: Math.min(az, bz) - Math.abs(rue.pz),
    x1: Math.max(ax, bx) + Math.abs(rue.px),
    z1: Math.max(az, bz) + Math.abs(rue.pz),
    poser(e) {
      for (let i = 0; i < L; i++) {
        const y = rue.prof[i];
        for (let w = -1; w <= 1; w++) {
          const x = cx + rue.dx * (RS + 1 + i) + rue.px * w, z = cz + rue.dz * (RS + 1 + i) + rue.pz * w;
          const t = h(x, z);
          if (t <= SEA_LEVEL) {
            // Pont de planches, sur pilotis de rondins au bord.
            e(x, y, z, PLANCHES);
            for (let k = y + 1; k <= y + 3; k++) e(x, k, z, AIR);
            if (w !== 0 && i % 4 === 0) for (let k = y - 1; k > t; k--) e(x, k, z, TRONC);
          } else {
            aplanir(e, h, x, z, y, m.remblai, w === 0 || bruit(x, z, 5) < 0.85 ? pave(m, x, z) : m.bordure, 3);
          }
        }
      }
    },
  };
}

// ---------------------------------------------------------------------------
// La place et sa fontaine
// ---------------------------------------------------------------------------

function place(ch: Chantier, m: Materiaux, ys: number): Piece {
  const { cx, cz, h } = ch;
  const r2 = (RS + 0.5) * (RS + 0.5), bord2 = (RS - 0.5) * (RS - 0.5);
  return {
    sorte: "place",
    x0: cx - RS, z0: cz - RS, x1: cx + RS, z1: cz + RS,
    poser(e) {
      for (let dz = -RS; dz <= RS; dz++) {
        for (let dx = -RS; dx <= RS; dx++) {
          const d2 = dx * dx + dz * dz;
          if (d2 > r2) continue;
          aplanir(e, h, cx + dx, cz + dz, ys, m.remblai, d2 > bord2 ? m.bordure : pave(m, cx + dx, cz + dz), 6);
        }
      }
      // Fontaine : un bassin carre, une colonne au milieu, une lanterne au sommet.
      for (let dz = -2; dz <= 2; dz++) {
        for (let dx = -2; dx <= 2; dx++) {
          const x = cx + dx, z = cz + dz;
          if (Math.abs(dx) === 2 || Math.abs(dz) === 2) e(x, ys + 1, z, m.margelle);
          else if (dx === 0 && dz === 0) {
            e(x, ys + 1, z, m.colonne);
            e(x, ys + 2, z, m.colonne);
            e(x, ys + 3, z, m.lampe);
          } else {
            e(x, ys, z, m.margelle);
            e(x, ys + 1, z, EAU);
          }
        }
      }
      // Quatre lanternes autour.
      for (const [dx, dz] of [[3, 3], [3, -3], [-3, 3], [-3, -3]]) {
        e(cx + dx, ys + 1, cz + dz, m.poteauLampe);
        e(cx + dx, ys + 2, cz + dz, m.poteauLampe);
        e(cx + dx, ys + 3, cz + dz, m.lampe);
      }
    },
  };
}

function lampadaire(ch: Chantier, m: Materiaux, x: number, z: number, y: number): Piece {
  return {
    sorte: "lampadaire",
    x0: x, z0: z, x1: x, z1: z,
    poser(e) {
      aplanir(e, ch.h, x, z, y, m.remblai, m.chemin, 4);
      e(x, y + 1, z, m.poteauLampe);
      e(x, y + 2, z, m.poteauLampe);
      e(x, y + 3, z, m.lampe);
    },
  };
}

// ---------------------------------------------------------------------------
// Lots
// ---------------------------------------------------------------------------

type TypeLot = "maison" | "moulin" | "fournil" | "lavoir" | "champ" | "etal" | "grange";

interface Choix {
  type: TypeLot;
  w: number;
  d: number;
}

/** Un batiment avant qu'on lui donne sa sorte. */
type Batiment = Omit<Piece, "sorte">;

interface Lot {
  r: Repere;
  w: number;
  d: number;
  /** Niveau du sol : celui de la rue devant la porte. */
  y0: number;
}

/** Batiments uniques (ou presque) de chaque style ; les maisons remplissent le reste. */
const QUOTAS: Record<StyleVillage, Partial<Record<TypeLot, number>>> = {
  colombages: { moulin: 1, fournil: 1, lavoir: 1, champ: 3, etal: 2 },
  adobe: { fournil: 1, lavoir: 1, champ: 2, etal: 3 },
  chalet: { grange: 1, fournil: 1, champ: 2, etal: 1 },
};

/** Ce qu'on essaie de batir a la case k d'une rue de longueur L, du plus souhaite au plus modeste. */
function candidats(k: number, L: number, quotas: Partial<Record<TypeLot, number>>, rand: () => number): Choix[] {
  const reste = (t: TypeLot) => (quotas[t] ?? 0) > 0;
  const res: Choix[] = [];
  if (k <= 4 && reste("etal") && rand() < 0.55) res.push({ type: "etal", w: 3, d: 2 });
  if (k >= L * 0.45 && reste("moulin") && rand() < 0.5) res.push({ type: "moulin", w: 9, d: 5 });
  if (k >= L * 0.35 && reste("champ") && rand() < 0.4) res.push({ type: "champ", w: rand() < 0.5 ? 7 : 9, d: 6 + Math.floor(rand() * 3) });
  if (reste("grange") && rand() < 0.3) res.push({ type: "grange", w: 7, d: 8 });
  if (reste("fournil") && rand() < 0.25) res.push({ type: "fournil", w: 5, d: 4 });
  if (reste("lavoir") && rand() < 0.2) res.push({ type: "lavoir", w: 7, d: 5 });
  res.push({ type: "maison", w: rand() < 0.5 ? 5 : 7, d: 5 + Math.floor(rand() * 3) });
  res.push({ type: "maison", w: 5, d: 5 });
  return res;
}

/**
 * Le lot (w x d) a la case k de la rue, du cote `cote`, est-il libre ? La
 * facade est a trois cases de l'axe de la rue (la rue, puis un passage).
 * Autour, une marge d'une case (deux devant le moulin, pour ses ailes) que
 * les autres lots ne peuvent pas prendre : deux maisons gardent toujours au
 * moins deux cases entre elles, et leurs avancees de toit ne se touchent pas.
 */
function lotLibre(ch: Chantier, rue: Rue, k: number, cote: number, w: number, d: number, devant: number): Lot | null {
  if (k + w > rue.prof.length) return null;
  const vx = rue.px * cote, vz = rue.pz * cote;
  const ax = ch.cx + rue.dx * (RS + 1 + k), az = ch.cz + rue.dz * (RS + 1 + k);
  const r: Repere = { ox: ax + vx * 3, oz: az + vz * 3, ux: rue.dx, uz: rue.dz, vx, vz };
  const y0 = rue.prof[k + (w >> 1)];
  for (let v = -devant; v <= d; v++) {
    for (let u = -1; u <= w; u++) {
      const x = xDe(r, u, v), z = zDe(r, u, v);
      const c = ch.code(x, z);
      if (u >= 0 && u < w && v >= 0 && v < d) {
        if (c !== LIBRE) return null;
        const t = ch.h(x, z);
        if (t <= SEA_LEVEL || Math.abs(t - y0) > 4) return null;
      } else if (c === LOT || c === HORS) return null;
    }
  }
  return { r, w, d, y0 };
}

function reserverLot(ch: Chantier, lot: Lot, devant: number) {
  for (let v = -devant; v <= lot.d; v++) {
    for (let u = -1; u <= lot.w; u++) ch.reserver(xDe(lot.r, u, v), zDe(lot.r, u, v), LOT);
  }
}

/** Fenetres d'un mur de longueur L (positions le long du mur). */
function fenetres(L: number, facade: boolean): number[] {
  if (L <= 5) return facade ? [1, L - 2] : [L >> 1];
  if (L === 6) return [2, 3];
  return [2, L - 3];
}

const estPoteau = (p: number, L: number) => p === 0 || p === L - 1 || (L >= 7 && p === L >> 1);

/**
 * Toit a deux pans, en gradins de 45 degres, debordant d'une case tout
 * autour. Faitage le long de u (`faitageU`) ou de v. Les murs pignons sont
 * fermes par `pignon` ; le comble reste vide. Avec `neige`, chaque tuile
 * porte sa couche de neige.
 */
function toit(put: Local, w: number, d: number, yBase: number, faitageU: boolean, tuile: BlockId, pignon: BlockId, neige: boolean) {
  const n = faitageU ? d : w;
  const m = faitageU ? w : d;
  for (let k = 0; k - 1 <= n - k; k++) {
    const y = yBase + k, b1 = k - 1, b2 = n - k;
    for (let a = -1; a <= m; a++) {
      for (let b = b1; b <= b2; b++) {
        const u = faitageU ? a : b, v = faitageU ? b : a;
        if (b === b1 || b === b2) {
          put(u, y, v, tuile);
          if (neige) put(u, y + 1, v, NEIGE);
        } else if (a === 0 || a === m - 1) put(u, y, v, pignon);
        else if (a > 0 && a < m - 1) put(u, y, v, AIR);
      }
    }
  }
}

/** Hauteur du faitage au-dessus de yBase. */
const hauteurToit = (w: number, d: number, faitageU: boolean) => ((faitageU ? d : w) + 1) >> 1;

/** Sol du lot, puis passage devant la facade (chemin devant la porte). */
function terrasser(e: Ecrire, ch: Chantier, m: Materiaux, lot: Lot, sol: BlockId, degage: number, porteU: number) {
  const { r, w, d, y0 } = lot;
  for (let v = 0; v < d; v++) {
    for (let u = 0; u < w; u++) aplanir(e, ch.h, xDe(r, u, v), zDe(r, u, v), y0, m.remblai, sol, degage);
  }
  for (let u = 0; u < w; u++) aplanir(e, ch.h, xDe(r, u, -1), zDe(r, u, -1), y0, m.remblai, u === porteU ? m.chemin : m.nature, 3);
}

// ---------------------------------------------------------------------------
// Maisons a pignon : colombages (plaines, forets) et chalets (montagne)
// ---------------------------------------------------------------------------

function maisonPignon(ch: Chantier, m: Materiaux, chalet: boolean, neige: boolean, lot: Lot, rand: () => number): Batiment {
  const { r, w, d, y0 } = lot;
  const etages = (w >= 7 || d >= 6) && rand() < 0.4 ? 2 : 1;
  // Rez-de-chaussee de quatre rangs (socle, fenetres, enduit, poutre), etage de trois (enduit, fenetres, poutre).
  const haut = etages === 2 ? 7 : 4;
  const faitageU = w >= d;
  const yToit = y0 + haut + 1;
  const sommet = yToit + hauteurToit(w, d, faitageU);
  const tuile = chalet ? BRIQUES_PIERRE : choisir(rand, [terreCuiteTeintee(14), terreCuiteTeintee(1), TERRE_CUITE, terreCuiteTeintee(12)]);
  const volet = beton(choisir(rand, chalet ? [14, 13, 11] : [3, 13, 11, 14, 4]));
  const lit = laine(choisir(rand, [14, 11, 13, 1, 10]));
  const lanterne = rand() < 0.6;
  const fleurs = !neige && rand() < 0.75;
  const porteU = w >> 1;
  const sol = chalet ? PLANCHES_SOMBRES : PLANCHES;
  // Murs : enduit blanc et pans de bois sombre, ou pierre en bas et bois en haut pour le chalet.
  const murDe = (f: number) =>
    chalet
      ? f === 0 && etages === 2
        ? { mur: PIERRE_TAILLEE, poteau: BRIQUES_PIERRE, poutre: PLANCHES_SOMBRES }
        : { mur: PLANCHES_SOMBRES, poteau: TRONC, poutre: PLANCHES_SOMBRES }
      : { mur: beton(0), poteau: PLANCHES_SOMBRES, poutre: PLANCHES_SOMBRES };
  ch.portes.push({ x: xDe(r, porteU, -1), y: y0 + 1, z: zDe(r, porteU, -1), dx: r.vx, dz: r.vz });

  return {
    ...emprise(r, -1, -1, w, d),
    poser(e) {
      const put = local(e, r);
      terrasser(e, ch, m, lot, sol, sommet - y0 + 2, porteU);
      for (let y = 1; y <= haut; y++) {
        const f = y <= 4 ? 0 : 1, ry = f === 0 ? y : y - 4, poutre = f === 0 ? 4 : 3;
        const mat = murDe(f);
        for (let v = 0; v < d; v++) {
          for (let u = 0; u < w; u++) {
            const bordU = u === 0 || u === w - 1, bordV = v === 0 || v === d - 1;
            if (!bordU && !bordV) continue;
            const facade = v === 0 && !bordU;
            const p = bordV ? u : v, L = bordV ? w : d;
            const fen = fenetres(L, facade);
            let id: BlockId;
            if (f === 0 && ry <= 2 && v === 0 && u === porteU) id = AIR;
            else if (f === 0 && ry === 1) id = PIERRE_TAILLEE;
            else if (ry === poutre) id = mat.poutre;
            else if ((bordU && bordV) || estPoteau(p, L)) id = mat.poteau;
            else if (ry === 2 && fen.includes(p)) id = VERRE;
            else if (ry === 2 && fen.includes(p - 1) !== fen.includes(p + 1)) id = volet;
            else id = mat.mur;
            put(u, y0 + y, v, id);
          }
        }
      }
      if (etages === 2) {
        // Plancher de l'etage, ouvert au-dessus d'un escalier de trois marches.
        for (let v = 1; v < d - 1; v++) {
          for (let u = 1; u < w - 1; u++) put(u, y0 + 4, v, u === 1 && (v === d - 2 || v === d - 3) ? AIR : sol);
        }
        for (let k = 1; k <= 3; k++) for (let y = 1; y <= k; y++) put(1, y0 + y, d - 5 + k, sol);
      }
      toit(put, w, d, yToit, faitageU, tuile, chalet ? PLANCHES_SOMBRES : beton(0), neige);
      // Cheminee au-dessus de l'atre.
      put(w - 2, y0 + 1, d - 2, FOUR);
      for (let y = y0 + 2; y <= sommet + 1; y++) put(w - 2, y, d - 2, chalet ? PIERRE_TAILLEE : BRIQUE);
      // Meubles et lumieres.
      put(w - 2, y0 + 1, 1, TABLE_CRAFT);
      put(porteU, y0 + 4, d >> 1, LAMPE);
      if (etages === 1) {
        put(1, y0 + 1, d - 2, lit);
        put(1, y0 + 1, d - 3, lit);
        put(1, y0 + 1, 1, BIBLIOTHEQUE);
      } else {
        put(w - 2, y0 + 5, 1, lit);
        put(w - 2, y0 + 5, 2, lit);
        put(1, y0 + 5, 1, BIBLIOTHEQUE);
        put(porteU, y0 + 7, d >> 1, LAMPE);
      }
      // Devant : lanterne au-dessus de la porte, fleurs sous les fenetres.
      if (lanterne) put(porteU, y0 + 3, -1, LAMPE);
      if (fleurs) {
        const fl = [FLEUR_ROUGE, FLEUR_JAUNE, FLEUR_BLEUE];
        for (const p of fenetres(w, true)) put(p, y0 + 1, -1, fl[(p + w + d) % 3]);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Maisons de terre du desert : toit-terrasse, poutres saillantes, store raye
// ---------------------------------------------------------------------------

function parapet(put: Local, u0: number, v0: number, u1: number, v1: number, y: number, bloc: BlockId) {
  for (let v = v0; v <= v1; v++) {
    for (let u = u0; u <= u1; u++) {
      if (u !== u0 && u !== u1 && v !== v0 && v !== v1) continue;
      if ((u + v) % 2 === 0) put(u, y, v, bloc);
    }
  }
}

function maisonAdobe(ch: Chantier, m: Materiaux, lot: Lot, rand: () => number): Batiment {
  const { r, w, d, y0 } = lot;
  const etages = (w >= 7 || d >= 6) && rand() < 0.45 ? 2 : 1;
  const store = choisir(rand, [14, 1, 11, 9]);
  const lit = laine(choisir(rand, [1, 14, 4, 9]));
  // Enduit : terre beige rose, chaux blanche ou terre rose, d'une maison a l'autre.
  const mur = choisir(rand, [terreCuiteTeintee(0), terreCuiteTeintee(0), beton(0), terreCuiteTeintee(6)]);
  const porteU = w >> 1;
  const vb = Math.ceil(d / 2);
  const sommet = y0 + (etages === 2 ? 9 : 5);
  ch.portes.push({ x: xDe(r, porteU, -1), y: y0 + 1, z: zDe(r, porteU, -1), dx: r.vx, dz: r.vz });

  return {
    ...emprise(r, -1, -1, w, d),
    poser(e) {
      const put = local(e, r);
      terrasser(e, ch, m, lot, GRES_TAILLE, sommet - y0 + 2, porteU);
      for (let y = 1; y <= 3; y++) {
        for (let v = 0; v < d; v++) {
          for (let u = 0; u < w; u++) {
            const bordU = u === 0 || u === w - 1, bordV = v === 0 || v === d - 1;
            if (!bordU && !bordV) continue;
            const p = bordV ? u : v, L = bordV ? w : d;
            let id: BlockId = mur;
            if (y <= 2 && v === 0 && u === porteU) id = AIR;
            else if (y === 2 && !(bordU && bordV) && fenetres(L, v === 0 && !bordU).includes(p)) id = VERRE;
            put(u, y0 + y, v, id);
          }
        }
      }
      // Poutres qui depassent des murs, et store raye au-dessus de la porte.
      for (let u = 0; u < w; u += 2) {
        put(u, y0 + 3, -1, TRONC);
        put(u, y0 + 3, d, TRONC);
      }
      for (let u = porteU - 1; u <= porteU + 1; u++) put(u, y0 + 3, -1, laine(u % 2 ? 0 : store));
      // Toit-terrasse, ouvert au-dessus de l'escalier.
      for (let v = 0; v < d; v++) {
        for (let u = 0; u < w; u++) put(u, y0 + 4, v, u === 1 && (v === 1 || v === 2) ? AIR : GRES_TAILLE);
      }
      if (etages === 1) parapet(put, 0, 0, w - 1, d - 1, y0 + 5, mur);
      else {
        // Terrasse devant, petite piece au fond.
        for (let v = 0; v < vb; v++) {
          for (let u = 0; u < w; u++) if ((u === 0 || u === w - 1 || v === 0) && (u + v) % 2 === 0) put(u, y0 + 5, v, mur);
        }
        for (let y = 5; y <= 7; y++) {
          for (let v = vb; v < d; v++) {
            for (let u = 0; u < w; u++) {
              const bordU = u === 0 || u === w - 1, bordV = v === vb || v === d - 1;
              if (!bordU && !bordV) continue;
              let id: BlockId = mur;
              if (v === vb && u === porteU && y <= 6) id = AIR;
              else if (y === 6 && v === d - 1 && !bordU && u !== porteU) id = VERRE;
              put(u, y0 + y, v, id);
            }
          }
        }
        for (let v = vb; v < d; v++) for (let u = 0; u < w; u++) put(u, y0 + 8, v, GRES_TAILLE);
        parapet(put, 0, vb, w - 1, d - 1, y0 + 9, mur);
        if (vb + 1 < d - 1) put(porteU, y0 + 7, vb + 1, lampeCouleur(1));
      }
      // Escalier interieur vers la terrasse.
      put(1, y0 + 1, 3, GRES_TAILLE);
      put(1, y0 + 1, 2, GRES_TAILLE);
      put(1, y0 + 2, 2, GRES_TAILLE);
      for (let y = 1; y <= 3; y++) put(1, y0 + y, 1, GRES_TAILLE);
      // Meubles et lumiere.
      put(w - 2, y0 + 1, 1, lit);
      put(w - 2, y0 + 1, 2, lit);
      put(w - 2, y0 + 1, d - 2, FOUR);
      put(porteU, y0 + 3, d >> 1, lampeCouleur(1));
    },
  };
}

// ---------------------------------------------------------------------------
// Batiments uniques
// ---------------------------------------------------------------------------

/** Grange de montagne : grande porte, foin, toit de lauzes. */
function grange(ch: Chantier, m: Materiaux, neige: boolean, lot: Lot): Batiment {
  const { r, w, d, y0 } = lot;
  const yToit = y0 + 5;
  const sommet = yToit + hauteurToit(w, d, false);
  const porteU = w >> 1;
  return {
    ...emprise(r, -1, -1, w, d),
    poser(e) {
      const put = local(e, r);
      terrasser(e, ch, m, lot, PLANCHES, sommet - y0 + 2, porteU);
      for (let y = 1; y <= 4; y++) {
        for (let v = 0; v < d; v++) {
          for (let u = 0; u < w; u++) {
            const bordU = u === 0 || u === w - 1, bordV = v === 0 || v === d - 1;
            if (!bordU && !bordV) continue;
            let id: BlockId;
            if (v === 0 && Math.abs(u - porteU) <= 1 && y <= 3) id = AIR;
            else if (y === 1) id = PIERRE_TAILLEE;
            else if (bordU && bordV) id = TRONC;
            else if (y === 4) id = PLANCHES_SOMBRES;
            else if (y === 3 && bordU && fenetres(d, false).includes(v)) id = VERRE;
            else id = PLANCHES;
            put(u, y0 + y, v, id);
          }
        }
      }
      toit(put, w, d, yToit, false, BRIQUES_PIERRE, PLANCHES_SOMBRES, neige);
      for (const u of [1, w - 2]) {
        put(u, y0 + 1, d - 2, BOTTE_FOIN);
        put(u, y0 + 2, d - 2, BOTTE_FOIN);
        put(u, y0 + 1, d - 3, BOTTE_FOIN);
      }
      put(1, y0 + 1, d - 4, BOTTE_FOIN);
      put(w - 2, y0 + 1, 1, TABLE_CRAFT);
      put(porteU, y0 + 4, d >> 1, LAMPE);
    },
  };
}

/** Moulin a vent : tour blanche aux angles abattus, ailes de toile face a la rue. */
function moulin(ch: Chantier, m: Materiaux, lot: Lot): Batiment {
  const { r, y0 } = lot;
  const tour = (u: number, v: number) => u >= 2 && u <= 6 && v >= 0 && v <= 4 && !((u === 2 || u === 6) && (v === 0 || v === 4));
  return {
    ...emprise(r, -1, -2, 9, 5),
    poser(e) {
      const put = local(e, r);
      terrasser(e, ch, m, lot, HERBE, 14, 4);
      for (let v = 0; v <= 4; v++) for (let u = 2; u <= 6; u++) if (tour(u, v)) put(u, y0, v, PLANCHES);
      for (let y = 1; y <= 9; y++) {
        for (let v = 0; v <= 4; v++) {
          for (let u = 2; u <= 6; u++) {
            if (!tour(u, v) || (u > 2 && u < 6 && v > 0 && v < 4)) continue;
            let id: BlockId = beton(0);
            if (v === 0 && u === 4 && y <= 2) id = AIR;
            else if (y === 1) id = PIERRE_TAILLEE;
            else if ((y === 4 || y === 7) && (u === 4 || v === 2)) id = VERRE;
            put(u, y0 + y, v, id);
          }
        }
      }
      // Toit en cone.
      for (let v = 0; v <= 4; v++) for (let u = 2; u <= 6; u++) if (tour(u, v)) put(u, y0 + 10, v, PLANCHES_SOMBRES);
      for (let v = 1; v <= 3; v++) for (let u = 3; u <= 5; u++) put(u, y0 + 11, v, PLANCHES_SOMBRES);
      put(4, y0 + 12, 2, PLANCHES_SOMBRES);
      // Axe, moyeu et quatre ailes en moulinet, dans un plan devant la tour.
      put(4, y0 + 8, -1, TRONC);
      put(4, y0 + 8, -2, PLANCHES_SOMBRES);
      for (let k = 1; k <= 4; k++) {
        put(4, y0 + 8 + k, -2, PLANCHES_SOMBRES);
        put(5, y0 + 8 + k, -2, LAINE_BLANCHE);
        put(4, y0 + 8 - k, -2, PLANCHES_SOMBRES);
        put(3, y0 + 8 - k, -2, LAINE_BLANCHE);
        put(4 + k, y0 + 8, -2, PLANCHES_SOMBRES);
        put(4 + k, y0 + 7, -2, LAINE_BLANCHE);
        put(4 - k, y0 + 8, -2, PLANCHES_SOMBRES);
        put(4 - k, y0 + 9, -2, LAINE_BLANCHE);
      }
      // Sacs de grain dedans, foin dehors.
      put(3, y0 + 1, 3, BOTTE_FOIN);
      put(5, y0 + 1, 3, BOTTE_FOIN);
      put(3, y0 + 2, 3, BOTTE_FOIN);
      put(4, y0 + 4, 2, LAMPE);
      put(0, y0 + 1, 1, BOTTE_FOIN);
      put(0, y0 + 1, 2, BOTTE_FOIN);
      put(0, y0 + 2, 1, BOTTE_FOIN);
      put(8, y0 + 1, 3, BOTTE_FOIN);
    },
  };
}

/** Four a pain du village : un dome de briques, sa cheminee, du bois a cote. */
function fournil(ch: Chantier, m: Materiaux, style: StyleVillage, lot: Lot): Batiment {
  const { r, w, d, y0 } = lot;
  const corps = style === "adobe" ? TERRE_CUITE : style === "chalet" ? PIERRE_TAILLEE : BRIQUE;
  return {
    ...emprise(r, -1, -1, w, d),
    poser(e) {
      const put = local(e, r);
      terrasser(e, ch, m, lot, m.chemin, 6, 2);
      for (let v = 1; v <= 3; v++) {
        for (let u = 1; u <= 3; u++) {
          put(u, y0 + 1, v, corps);
          put(u, y0 + 2, v, corps);
        }
      }
      for (const [u, v] of [[2, 2], [1, 2], [3, 2], [2, 1], [2, 3]]) put(u, y0 + 3, v, corps);
      put(2, y0 + 4, 3, corps);
      put(2, y0 + 5, 3, corps);
      put(2, y0 + 1, 1, FOUR);
      put(0, y0 + 1, 1, TRONC);
      put(0, y0 + 1, 2, TRONC);
      put(0, y0 + 2, 1, TRONC);
      put(4, y0 + 1, 3, TABLE_CRAFT);
      put(4, y0 + 1, 1, BOTTE_FOIN);
    },
  };
}

/** Lavoir couvert (bassin a ciel ouvert dans le desert). */
function lavoir(ch: Chantier, m: Materiaux, style: StyleVillage, lot: Lot): Batiment {
  const { r, w, d, y0 } = lot;
  const adobe = style === "adobe";
  return {
    ...emprise(r, -1, -1, w, d),
    poser(e) {
      const put = local(e, r);
      terrasser(e, ch, m, lot, adobe ? GRES_TAILLE : PIERRE_POLIE, 7, 3);
      for (let v = 1; v <= 3; v++) {
        for (let u = 1; u <= 5; u++) {
          put(u, y0, v, EAU);
          put(u, y0 - 1, v, PIERRE_TAILLEE);
        }
      }
      if (adobe) {
        for (const [u, v] of [[0, 0], [6, 0], [0, 4], [6, 4]]) {
          put(u, y0 + 1, v, GRES_TAILLE);
          put(u, y0 + 2, v, lampeCouleur(1));
        }
        return;
      }
      for (const [u, v] of [[0, 0], [6, 0], [0, 4], [6, 4], [3, 0], [3, 4]]) {
        for (let y = 1; y <= 3; y++) put(u, y0 + y, v, TRONC);
      }
      toit(put, w, d, y0 + 4, true, terreCuiteTeintee(14), PLANCHES_SOMBRES, false);
      put(3, y0 + 4, 2, LAMPE);
    },
  };
}

/** Champ borde de rondins, cultures en rangs, epouvantail a tete de citrouille. */
function champ(ch: Chantier, style: StyleVillage, lot: Lot, rand: () => number): Batiment {
  const { r, w, d, y0 } = lot;
  const choixRangs = style === "adobe" ? [BLE_2, MELON, BLE_1, BLE_2] : [BLE_2, BLE_2, BLE_1, CITROUILLE];
  const rangs: BlockId[] = [];
  for (let v = 1; v < d - 1; v++) rangs.push(choisir(rand, choixRangs));
  const lanterne = rand() < 0.5;
  const mu = w >> 1, mv = d >> 1;
  return {
    ...emprise(r, 0, 0, w - 1, d - 1),
    poser(e) {
      const put = local(e, r);
      for (let v = 0; v < d; v++) {
        for (let u = 0; u < w; u++) {
          const x = xDe(r, u, v), z = zDe(r, u, v);
          const bord = u === 0 || u === w - 1 || v === 0 || v === d - 1;
          aplanir(e, ch.h, x, z, y0, TERRE, bord ? TRONC : TERRE_LABOUREE, 4);
          if (bord) continue;
          const rang = rangs[v - 1];
          put(u, y0 + 1, v, rang === BLE_2 && bruit(x, z, 3) < 0.25 ? BLE_1 : rang);
        }
      }
      put(mu, y0 + 1, mv, TRONC);
      put(mu, y0 + 2, mv, TRONC);
      put(mu - 1, y0 + 2, mv, PLANCHES_SOMBRES);
      put(mu + 1, y0 + 2, mv, PLANCHES_SOMBRES);
      put(mu, y0 + 3, mv, lanterne ? CITROUILLE_LANTERNE : CITROUILLE);
    },
  };
}

/** Etal de marche : quatre poteaux, un store raye, un comptoir et sa marchandise. */
function etal(ch: Chantier, m: Materiaux, lot: Lot, rand: () => number): Batiment {
  const { r, w, d, y0 } = lot;
  const couleur = choisir(rand, [14, 11, 13, 1, 10]);
  const marchandise = choisir(rand, [CITROUILLE, MELON, BOTTE_FOIN]);
  return {
    ...emprise(r, -1, -1, w, d),
    poser(e) {
      const put = local(e, r);
      for (let v = 0; v < d; v++) for (let u = 0; u < w; u++) aplanir(e, ch.h, xDe(r, u, v), zDe(r, u, v), y0, m.remblai, m.chemin, 4);
      for (const [u, v] of [[0, 0], [2, 0], [0, 1], [2, 1]]) {
        put(u, y0 + 1, v, TRONC);
        put(u, y0 + 2, v, TRONC);
      }
      for (let v = -1; v <= 1; v++) for (let u = 0; u <= 2; u++) put(u, y0 + 3, v, laine(u % 2 ? 0 : couleur));
      put(1, y0 + 1, 0, PLANCHES_CLAIRES);
      put(1, y0 + 1, 1, marchandise);
    },
  };
}

function batir(ch: Chantier, m: Materiaux, style: StyleVillage, neige: boolean, c: Choix, lot: Lot, rand: () => number): Batiment {
  switch (c.type) {
    case "maison":
      return style === "adobe" ? maisonAdobe(ch, m, lot, rand) : maisonPignon(ch, m, style === "chalet", neige, lot, rand);
    case "grange":
      return grange(ch, m, neige, lot);
    case "moulin":
      return moulin(ch, m, lot);
    case "fournil":
      return fournil(ch, m, style, lot);
    case "lavoir":
      return lavoir(ch, m, style, lot);
    case "champ":
      return champ(ch, style, lot, rand);
    case "etal":
      return etal(ch, m, lot, rand);
  }
}

// ---------------------------------------------------------------------------
// Plan d'un village
// ---------------------------------------------------------------------------

function construire(seed: number, rx: number, rz: number, cx: number, cz: number, style: StyleVillage, neige: boolean, rand: () => number): Village | null {
  const ch = new Chantier(seed, cx, cz);
  const m = materiaux(style, neige);
  // La place, au niveau moyen de son disque.
  let somme = 0, n = 0;
  for (let dz = -RS; dz <= RS; dz++) {
    for (let dx = -RS; dx <= RS; dx++) {
      if (dx * dx + dz * dz > (RS + 0.5) * (RS + 0.5)) continue;
      somme += Math.max(ch.h(cx + dx, cz + dz), SEA_LEVEL + 1);
      n++;
      ch.reserver(cx + dx, cz + dz, RUE);
    }
  }
  const ys = Math.round(somme / n);
  if (ys > SOL_MAX) return null;
  ch.pieces.push(place(ch, m, ys));

  // Deux a quatre rues, dans des directions tirees au hasard.
  const directions: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let i = directions.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [directions[i], directions[j]] = [directions[j], directions[i]];
  }
  const voulues = 2 + Math.floor(rand() * 3);
  const rues: Rue[] = [];
  for (const [dx, dz] of directions) {
    if (rues.length >= voulues) break;
    const rue = tracer(ch, ys, dx, dz, 14 + Math.floor(rand() * (RAYON - RS - 14)));
    if (!rue) continue;
    rues.push(rue);
    ch.pieces.push(pieceRue(ch, m, rue));
  }
  if (rues.length < 2) return null;

  // Les lots, de part et d'autre de chaque rue.
  const quotas = { ...QUOTAS[style] };
  let maisons = 0;
  for (const rue of rues) {
    for (const cote of [1, -1]) {
      let k = 1;
      while (k < rue.prof.length - 3) {
        let bati = false;
        for (const c of candidats(k, rue.prof.length, quotas, rand)) {
          const devant = c.type === "moulin" ? 2 : 1;
          const lot = lotLibre(ch, rue, k, cote, c.w, c.d, devant);
          if (!lot) continue;
          reserverLot(ch, lot, devant);
          ch.pieces.push({ ...batir(ch, m, style, neige, c, lot, rand), sorte: c.type });
          if (c.type === "maison") maisons++;
          else quotas[c.type] = (quotas[c.type] ?? 1) - 1;
          k += c.w + 2 + Math.floor(rand() * 2);
          bati = true;
          break;
        }
        if (!bati) k++;
      }
    }
  }
  if (maisons < 3) return null;

  // Lampadaires le long des rues, entre les lots.
  for (const rue of rues) {
    for (let i = 3; i < rue.prof.length; i += 7) {
      for (const cote of i % 2 ? [1, -1] : [-1, 1]) {
        const x = cx + rue.dx * (RS + 1 + i) + rue.px * cote * 2;
        const z = cz + rue.dz * (RS + 1 + i) + rue.pz * cote * 2;
        if (ch.code(x, z) !== LIBRE) continue;
        ch.reserver(x, z, LOT);
        ch.pieces.push(lampadaire(ch, m, x, z, rue.prof[i]));
        break;
      }
    }
  }

  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const p of ch.pieces) {
    x0 = Math.min(x0, p.x0);
    z0 = Math.min(z0, p.z0);
    x1 = Math.max(x1, p.x1);
    z1 = Math.max(z1, p.z1);
  }
  return { rx, rz, nom: nommer(style, rand), style, x: cx, y: ys + 1, z: cz, x0, z0, x1, z1, portes: ch.portes, pieces: ch.pieces };
}

function planifier(seed: number, rx: number, rz: number, depart: { x: number; z: number }): Village | null {
  if (melange(rx, rz, seed + 7001) / 4294967296 >= CHANCE) return null;
  const rand = hasard(melange(rx, rz, seed + 7013));
  const marge = RAYON + 2;
  for (let essai = 0; essai < 5; essai++) {
    const cx = rx * REGION + marge + Math.floor(rand() * (REGION - 2 * marge));
    const cz = rz * REGION + marge + Math.floor(rand() * (REGION - 2 * marge));
    // Jamais sur le point de depart d'un monde : le joueur n'apparait pas dans un mur.
    if (Math.abs(cx - depart.x) <= RAYON + 6 && Math.abs(cz - depart.z) <= RAYON + 6) continue;
    const style = site(seed, cx, cz);
    if (!style) continue;
    const v = construire(seed, rx, rz, cx, cz, style, columnAt(cx, cz, seed).biome === "neige", rand);
    if (v) return v;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Les villages d'un monde
// ---------------------------------------------------------------------------

export class Villages implements Structures {
  readonly seed: number;
  private readonly cache = new Map<string, Village | null>();
  private readonly bloquees = new Set<string>();
  private readonly depart: { x: number; z: number };

  /** `zonesSansVillage` : regions (rx, rz a la suite) ou aucun village ne doit apparaitre. */
  constructor(seed: number, zonesSansVillage: readonly number[] = []) {
    this.seed = seed;
    for (let i = 0; i + 1 < zonesSansVillage.length; i += 2) this.bloquees.add(`${zonesSansVillage[i]},${zonesSansVillage[i + 1]}`);
    const p = spawnPoint(seed);
    this.depart = { x: Math.floor(p.x), z: Math.floor(p.z) };
  }

  /** Le village d'une region (null : aucun). */
  village(rx: number, rz: number): Village | null {
    const cle = `${rx},${rz}`;
    let v = this.cache.get(cle);
    if (v === undefined) {
      v = this.bloquees.has(cle) ? null : planifier(this.seed, rx, rz, this.depart);
      this.cache.set(cle, v);
    }
    return v;
  }

  /** Le village dont l'emprise, elargie de `marge`, contient le point. */
  villageA(x: number, z: number, marge = 0): Village | null {
    const v = this.village(Math.floor(x / REGION), Math.floor(z / REGION));
    return v && x >= v.x0 - marge && x <= v.x1 + marge && z >= v.z0 - marge && z <= v.z1 + marge ? v : null;
  }

  sansArbre(x: number, z: number): boolean {
    return this.villageA(x, z, 3) !== null;
  }

  poser(cx: number, cz: number, ecrire: Ecrire): void {
    const x0 = cx * CHUNK, z0 = cz * CHUNK, x1 = x0 + CHUNK - 1, z1 = z0 + CHUNK - 1;
    const v = this.village(Math.floor(x0 / REGION), Math.floor(z0 / REGION));
    if (!v || v.x1 < x0 || v.x0 > x1 || v.z1 < z0 || v.z0 > z1) return;
    for (const p of v.pieces) if (p.x1 >= x0 && p.x0 <= x1 && p.z1 >= z0 && p.z0 <= z1) p.poser(ecrire);
  }

  /** Les regions sans village, a sauvegarder avec le monde. */
  zones(): number[] {
    const res: number[] = [];
    for (const cle of this.bloquees) {
      const [rx, rz] = cle.split(",").map(Number);
      res.push(rx, rz);
    }
    return res;
  }
}

/**
 * Mondes crees avant les villages : les regions dont le village toucherait
 * une modification du joueur (a 4 blocs pres) restent sans village, pour ne
 * jamais pousser une maison au milieu de ses constructions.
 */
export function zonesAProteger(seed: number, editKeys: Iterable<string>): number[] {
  const villages = new Villages(seed);
  const bloquees = new Set<string>();
  const res: number[] = [];
  for (const key of editKeys) {
    const parts = key.split(",");
    const x = Number(parts[0]), z = Number(parts[2]);
    const rx = Math.floor(x / REGION), rz = Math.floor(z / REGION);
    const cle = `${rx},${rz}`;
    if (bloquees.has(cle) || !villages.villageA(x, z, 4)) continue;
    bloquees.add(cle);
    res.push(rx, rz);
  }
  return res;
}
