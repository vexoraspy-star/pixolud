// Cubes — le moteur du monde en blocs.
//
// Le monde est infini : il n'existe nulle part en entier. Il est decoupe en
// « chunks » de 16 x 16 colonnes, generes a la demande autour du joueur a
// partir d'une graine, et oublies quand on s'en eloigne. Seules les
// modifications du joueur sont conservees (dans `edits`), ce qui permet de
// sauvegarder un monde entier en quelques kilo-octets.
//
// Trois choses vivent ici et nulle part ailleurs :
//   - la table des blocs (ce qui est solide, transparent, lumineux) ;
//   - la generation du terrain (relief, biomes, grottes, minerais, arbres) ;
//   - la lumiere et le maillage, qui transforment des cubes en geometrie.
//
// Le rendu (Three.js) est dans CubesScene : ce fichier ne connait pas Three.

export const CHUNK = 16;
/** Hauteur du monde, en blocs. Le socle est en 0, le ciel en 79. */
export const WORLD_HEIGHT = 80;
export const SEA_LEVEL = 32;
/** Niveau de lumiere maximal, comme dans le jeu dont on s'inspire. */
export const MAX_LIGHT = 15;

export type BlockId = number;
export const AIR = 0;

export type BlockShape = "cube" | "croix";
export type BlockSound = "terre" | "pierre" | "bois" | "sable" | "verre" | "tissu" | "eau" | "feuille";

export interface BlockDef {
  id: BlockId;
  name: string;
  /** Tuiles dans l'atlas : dessus, cote, dessous. */
  tiles: [number, number, number];
  /** Bloque le joueur. */
  solid: boolean;
  /** Arrete la lumiere et cache la face du bloc voisin. */
  opaque: boolean;
  shape: BlockShape;
  /** Lumiere emise (torche, lampe). */
  light: number;
  /** Liquide : on le traverse, on y nage. */
  liquid: boolean;
  /** Secondes pour le casser a la main, en mode survie. */
  breakTime: number;
  sound: BlockSound;
  /** Ce qu'on recupere en le cassant (par defaut le bloc lui-meme). */
  drop?: BlockId;
}

/** Index des tuiles de l'atlas (voir voxelTextures.ts, 8 colonnes). */
export const TILE = {
  herbeDessus: 0,
  herbeCote: 1,
  terre: 2,
  pierre: 3,
  pierreTaillee: 4,
  sable: 5,
  gresDessus: 6,
  gresCote: 7,
  troncDessus: 8,
  troncCote: 9,
  planches: 10,
  feuilles: 11,
  verre: 12,
  eau: 13,
  brique: 14,
  charbon: 15,
  fer: 16,
  or: 17,
  diamant: 18,
  obsidienne: 19,
  gravier: 20,
  neige: 21,
  glace: 22,
  socle: 23,
  cactusDessus: 24,
  cactusCote: 25,
  laineBlanche: 26,
  laineRouge: 27,
  laineBleue: 28,
  laineJaune: 29,
  laineVerte: 30,
  torche: 31,
  fleurRouge: 32,
  fleurJaune: 33,
  herbeHaute: 34,
  lampe: 35,
} as const;

function def(
  id: BlockId,
  name: string,
  tiles: [number, number, number],
  extra: Partial<BlockDef> = {},
): BlockDef {
  return {
    id,
    name,
    tiles,
    solid: true,
    opaque: true,
    shape: "cube",
    light: 0,
    liquid: false,
    breakTime: 0.75,
    sound: "pierre",
    ...extra,
  };
}

export const HERBE = 1;
export const TERRE = 2;
export const PIERRE = 3;
export const PIERRE_TAILLEE = 4;
export const SABLE = 5;
export const GRES = 6;
export const TRONC = 7;
export const PLANCHES = 8;
export const FEUILLES = 9;
export const VERRE = 10;
export const EAU = 11;
export const BRIQUE = 12;
export const CHARBON = 13;
export const FER = 14;
export const OR = 15;
export const DIAMANT = 16;
export const OBSIDIENNE = 17;
export const GRAVIER = 18;
export const NEIGE = 19;
export const GLACE = 20;
export const SOCLE = 21;
export const CACTUS = 22;
export const LAINE_BLANCHE = 23;
export const LAINE_ROUGE = 24;
export const LAINE_BLEUE = 25;
export const LAINE_JAUNE = 26;
export const LAINE_VERTE = 27;
export const TORCHE = 28;
export const FLEUR_ROUGE = 29;
export const FLEUR_JAUNE = 30;
export const HERBE_HAUTE = 31;
export const LAMPE = 32;

export const BLOCKS: BlockDef[] = [
  def(AIR, "Air", [0, 0, 0], { solid: false, opaque: false, breakTime: 0 }),
  def(HERBE, "Herbe", [TILE.herbeDessus, TILE.herbeCote, TILE.terre], { breakTime: 0.5, sound: "terre", drop: TERRE }),
  def(TERRE, "Terre", [TILE.terre, TILE.terre, TILE.terre], { breakTime: 0.5, sound: "terre" }),
  def(PIERRE, "Pierre", [TILE.pierre, TILE.pierre, TILE.pierre], { breakTime: 1.4, drop: PIERRE_TAILLEE }),
  def(PIERRE_TAILLEE, "Pierre taillée", [TILE.pierreTaillee, TILE.pierreTaillee, TILE.pierreTaillee], { breakTime: 1.5 }),
  def(SABLE, "Sable", [TILE.sable, TILE.sable, TILE.sable], { breakTime: 0.4, sound: "sable" }),
  def(GRES, "Grès", [TILE.gresDessus, TILE.gresCote, TILE.gresDessus], { breakTime: 1.1, sound: "sable" }),
  def(TRONC, "Tronc", [TILE.troncDessus, TILE.troncCote, TILE.troncDessus], { breakTime: 1.2, sound: "bois" }),
  def(PLANCHES, "Planches", [TILE.planches, TILE.planches, TILE.planches], { breakTime: 1, sound: "bois" }),
  def(FEUILLES, "Feuilles", [TILE.feuilles, TILE.feuilles, TILE.feuilles], { opaque: false, breakTime: 0.25, sound: "feuille" }),
  def(VERRE, "Verre", [TILE.verre, TILE.verre, TILE.verre], { opaque: false, breakTime: 0.4, sound: "verre" }),
  def(EAU, "Eau", [TILE.eau, TILE.eau, TILE.eau], { solid: false, opaque: false, liquid: true, breakTime: 0, sound: "eau" }),
  def(BRIQUE, "Brique", [TILE.brique, TILE.brique, TILE.brique], { breakTime: 1.6 }),
  def(CHARBON, "Charbon", [TILE.charbon, TILE.charbon, TILE.charbon], { breakTime: 1.8 }),
  def(FER, "Fer", [TILE.fer, TILE.fer, TILE.fer], { breakTime: 2.2 }),
  def(OR, "Or", [TILE.or, TILE.or, TILE.or], { breakTime: 2.4 }),
  def(DIAMANT, "Diamant", [TILE.diamant, TILE.diamant, TILE.diamant], { breakTime: 3 }),
  def(OBSIDIENNE, "Obsidienne", [TILE.obsidienne, TILE.obsidienne, TILE.obsidienne], { breakTime: 4 }),
  def(GRAVIER, "Gravier", [TILE.gravier, TILE.gravier, TILE.gravier], { breakTime: 0.5, sound: "sable" }),
  def(NEIGE, "Neige", [TILE.neige, TILE.neige, TILE.neige], { breakTime: 0.3, sound: "terre" }),
  def(GLACE, "Glace", [TILE.glace, TILE.glace, TILE.glace], { opaque: false, breakTime: 0.6, sound: "verre" }),
  def(SOCLE, "Socle", [TILE.socle, TILE.socle, TILE.socle], { breakTime: 0 }),
  def(CACTUS, "Cactus", [TILE.cactusDessus, TILE.cactusCote, TILE.cactusDessus], { breakTime: 0.5, sound: "tissu" }),
  def(LAINE_BLANCHE, "Laine blanche", [TILE.laineBlanche, TILE.laineBlanche, TILE.laineBlanche], { breakTime: 0.6, sound: "tissu" }),
  def(LAINE_ROUGE, "Laine rouge", [TILE.laineRouge, TILE.laineRouge, TILE.laineRouge], { breakTime: 0.6, sound: "tissu" }),
  def(LAINE_BLEUE, "Laine bleue", [TILE.laineBleue, TILE.laineBleue, TILE.laineBleue], { breakTime: 0.6, sound: "tissu" }),
  def(LAINE_JAUNE, "Laine jaune", [TILE.laineJaune, TILE.laineJaune, TILE.laineJaune], { breakTime: 0.6, sound: "tissu" }),
  def(LAINE_VERTE, "Laine verte", [TILE.laineVerte, TILE.laineVerte, TILE.laineVerte], { breakTime: 0.6, sound: "tissu" }),
  def(TORCHE, "Torche", [TILE.torche, TILE.torche, TILE.torche], {
    solid: false,
    opaque: false,
    shape: "croix",
    light: 14,
    breakTime: 0.1,
    sound: "bois",
  }),
  def(FLEUR_ROUGE, "Fleur rouge", [TILE.fleurRouge, TILE.fleurRouge, TILE.fleurRouge], {
    solid: false,
    opaque: false,
    shape: "croix",
    breakTime: 0.1,
    sound: "feuille",
  }),
  def(FLEUR_JAUNE, "Fleur jaune", [TILE.fleurJaune, TILE.fleurJaune, TILE.fleurJaune], {
    solid: false,
    opaque: false,
    shape: "croix",
    breakTime: 0.1,
    sound: "feuille",
  }),
  def(HERBE_HAUTE, "Herbe haute", [TILE.herbeHaute, TILE.herbeHaute, TILE.herbeHaute], {
    solid: false,
    opaque: false,
    shape: "croix",
    breakTime: 0.1,
    sound: "feuille",
  }),
  def(LAMPE, "Lampe", [TILE.lampe, TILE.lampe, TILE.lampe], { light: 15, breakTime: 0.8, sound: "verre" }),
];

export function block(id: BlockId): BlockDef {
  return BLOCKS[id] ?? BLOCKS[0];
}

/** Blocs proposes dans l'inventaire creatif, dans l'ordre d'affichage. */
export const PALETTE: BlockId[] = [
  HERBE, TERRE, PIERRE, PIERRE_TAILLEE, BRIQUE, SABLE, GRES, GRAVIER,
  TRONC, PLANCHES, FEUILLES, VERRE, LAMPE, TORCHE, NEIGE, GLACE,
  OBSIDIENNE, CHARBON, FER, OR, DIAMANT, CACTUS, EAU, LAINE_BLANCHE,
  LAINE_ROUGE, LAINE_BLEUE, LAINE_JAUNE, LAINE_VERTE, FLEUR_ROUGE, FLEUR_JAUNE, HERBE_HAUTE,
];

// ---------------------------------------------------------------------------
// Bruit : tout le relief vient de la, et d'une seule graine
// ---------------------------------------------------------------------------

function hash2(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function hash3(x: number, y: number, z: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 1274126177) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function noise2(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const tx = smooth(x - xi);
  const ty = smooth(y - yi);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

function noise3(x: number, y: number, z: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const tx = smooth(x - xi);
  const ty = smooth(y - yi);
  const tz = smooth(z - zi);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const c000 = hash3(xi, yi, zi, seed);
  const c100 = hash3(xi + 1, yi, zi, seed);
  const c010 = hash3(xi, yi + 1, zi, seed);
  const c110 = hash3(xi + 1, yi + 1, zi, seed);
  const c001 = hash3(xi, yi, zi + 1, seed);
  const c101 = hash3(xi + 1, yi, zi + 1, seed);
  const c011 = hash3(xi, yi + 1, zi + 1, seed);
  const c111 = hash3(xi + 1, yi + 1, zi + 1, seed);
  return lerp(
    lerp(lerp(c000, c100, tx), lerp(c010, c110, tx), ty),
    lerp(lerp(c001, c101, tx), lerp(c011, c111, tx), ty),
    tz,
  );
}

function fbm2(x: number, y: number, seed: number, octaves: number): number {
  let sum = 0;
  let amp = 1;
  let total = 0;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += noise2(x * freq, y * freq, seed + i * 97) * amp;
    total += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / total;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export type Biome = "plaine" | "foret" | "desert" | "montagne" | "neige";

export interface Column {
  height: number;
  biome: Biome;
}

/** Relief et biome d'une colonne. Fonction pure : deux joueurs voient pareil. */
export function columnAt(x: number, z: number, seed: number): Column {
  const continent = fbm2(x / 260, z / 260, seed + 11, 3);
  const hills = fbm2(x / 70, z / 70, seed + 23, 4);
  const mountain = clamp01((fbm2(x / 340, z / 340, seed + 37, 2) - 0.56) / 0.3);
  const temp = fbm2(x / 200, z / 200, seed + 53, 2);
  const humid = fbm2(x / 170, z / 170, seed + 71, 2);
  let height = 24 + continent * 14 + hills * 9 + mountain * mountain * 34;
  // Les plages descendent doucement vers la mer plutot que de tomber d'un coup.
  height = Math.round(height);
  let biome: Biome;
  if (mountain > 0.55) biome = height > 56 ? "neige" : "montagne";
  else if (temp > 0.6 && humid < 0.46) biome = "desert";
  else if (humid > 0.56) biome = "foret";
  else biome = "plaine";
  return { height: Math.max(3, Math.min(WORLD_HEIGHT - 12, height)), biome };
}

function caveAt(x: number, y: number, z: number, seed: number): boolean {
  if (y < 2 || y > 54) return false;
  // Deux nappes de bruit qui se croisent : on creuse la ou les deux sont
  // hautes, ce qui donne des galeries plutot que du gruyere.
  const a = noise3(x / 26, y / 14, z / 26, seed + 101);
  const b = noise3(x / 22, y / 17, z / 22, seed + 211);
  const t = 0.62 + (y > 40 ? (y - 40) * 0.02 : 0);
  return a > t && b > t - 0.06;
}

function oreAt(x: number, y: number, z: number, seed: number): BlockId {
  if (y < 2) return PIERRE;
  const n = (s: number) => noise3(x / 7, y / 7, z / 7, seed + s);
  if (y <= 14 && n(401) > 0.855) return DIAMANT;
  if (y <= 26 && n(503) > 0.85) return OR;
  if (y <= 42 && n(607) > 0.825) return FER;
  if (y <= 52 && n(709) > 0.795) return CHARBON;
  if (n(811) > 0.86) return GRAVIER;
  return PIERRE;
}

// ---------------------------------------------------------------------------
// Chunks
// ---------------------------------------------------------------------------

export class Chunk {
  readonly cx: number;
  readonly cz: number;
  readonly blocks: Uint8Array;
  readonly light: Uint8Array;
  /** Le maillage doit etre refait. */
  dirty = true;
  /** Le chunk a ete genere (terrain + edits appliques). */
  built = false;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint8Array(CHUNK * CHUNK * WORLD_HEIGHT);
    this.light = new Uint8Array(CHUNK * CHUNK * WORLD_HEIGHT);
  }
}

export function idx(x: number, y: number, z: number): number {
  return (y * CHUNK + z) * CHUNK + x;
}

function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

export function editKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

/** Une modification du joueur, telle qu'elle est sauvegardee. */
export type Edits = Map<string, BlockId>;

export class World {
  readonly seed: number;
  readonly chunks = new Map<string, Chunk>();
  /** Tout ce que le joueur a casse ou pose : c'est la seule chose a sauver. */
  readonly edits: Edits;
  /** Chunks dont le maillage doit etre refait. */
  readonly dirty = new Set<string>();
  private trackLightChanges = false;
  /**
   * Dernier chunk trouve. La lumiere et le maillage lisent des milliers de
   * cases voisines, presque toujours dans le meme chunk : sans ce raccourci,
   * chaque lecture fabriquait une cle texte, et eclairer un chunk prenait
   * 25 ms (une saccade a chaque pas dans un terrain neuf).
   */
  private lastCx = NaN;
  private lastCz = NaN;
  private lastChunk: Chunk | undefined;

  constructor(seed: number, edits: Edits = new Map()) {
    this.seed = seed;
    this.edits = edits;
  }

  chunk(cx: number, cz: number): Chunk | undefined {
    if (cx === this.lastCx && cz === this.lastCz) return this.lastChunk;
    const c = this.chunks.get(chunkKey(cx, cz));
    // Seuls les chunks presents sont retenus : un absent peut etre cree ensuite.
    if (c) {
      this.lastCx = cx;
      this.lastCz = cz;
      this.lastChunk = c;
    }
    return c;
  }

  /** Cree et genere le chunk s'il n'existe pas encore. */
  ensureChunk(cx: number, cz: number): Chunk {
    const key = chunkKey(cx, cz);
    let c = this.chunks.get(key);
    if (!c) {
      c = new Chunk(cx, cz);
      this.chunks.set(key, c);
      this.generate(c);
    }
    return c;
  }

  unloadChunk(cx: number, cz: number) {
    this.chunks.delete(chunkKey(cx, cz));
    if (cx === this.lastCx && cz === this.lastCz) {
      this.lastCx = NaN;
      this.lastChunk = undefined;
    }
  }

  getBlock(x: number, y: number, z: number): BlockId {
    if (y < 0 || y >= WORLD_HEIGHT) return AIR;
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    const c = this.chunk(cx, cz);
    if (!c) return AIR;
    return c.blocks[idx(x - cx * CHUNK, y, z - cz * CHUNK)];
  }

  /** Comme getBlock, mais dit si le chunk existe (utile pour les collisions). */
  isLoaded(x: number, z: number): boolean {
    return this.chunk(Math.floor(x / CHUNK), Math.floor(z / CHUNK)) !== undefined;
  }

  getLight(x: number, y: number, z: number): number {
    if (y < 0) return 0;
    if (y >= WORLD_HEIGHT) return MAX_LIGHT;
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    const c = this.chunk(cx, cz);
    if (!c) return MAX_LIGHT;
    return c.light[idx(x - cx * CHUNK, y, z - cz * CHUNK)];
  }

  private setLightRaw(x: number, y: number, z: number, v: number): boolean {
    if (y < 0 || y >= WORLD_HEIGHT) return false;
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    const c = this.chunk(cx, cz);
    if (!c) return false;
    const i = idx(x - cx * CHUNK, y, z - cz * CHUNK);
    if (c.light[i] === v) return false;
    c.light[i] = v;
    if (this.trackLightChanges) this.markDirty(x, y, z);
    return true;
  }

  markDirty(x: number, y: number, z: number) {
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    const lx = x - cx * CHUNK;
    const lz = z - cz * CHUNK;
    // Les faces et leur occlusion ne debordent que d'une case du chunk.
    for (let dx = lx === 0 ? -1 : 0; dx <= (lx === CHUNK - 1 ? 1 : 0); dx++) {
      for (let dz = lz === 0 ? -1 : 0; dz <= (lz === CHUNK - 1 ? 1 : 0); dz++) {
        const c = this.chunk(cx + dx, cz + dz);
        if (c) {
          c.dirty = true;
          this.dirty.add(chunkKey(cx + dx, cz + dz));
        }
      }
    }
    void y;
  }

  // ------------------------------------------------------------- generation

  private generate(c: Chunk) {
    const { seed } = this;
    const baseX = c.cx * CHUNK;
    const baseZ = c.cz * CHUNK;
    for (let z = 0; z < CHUNK; z++) {
      for (let x = 0; x < CHUNK; x++) {
        const wx = baseX + x;
        const wz = baseZ + z;
        const { height, biome } = columnAt(wx, wz, seed);
        const beach = height <= SEA_LEVEL + 1 && height >= SEA_LEVEL - 2;
        for (let y = 0; y <= height; y++) {
          let id: BlockId;
          if (y === 0) id = SOCLE;
          else if (y > height - 4) {
            if (biome === "desert" || beach) id = y === height && height > SEA_LEVEL ? SABLE : SABLE;
            else if (biome === "neige") id = y === height ? NEIGE : PIERRE;
            else if (biome === "montagne") id = y === height ? PIERRE : PIERRE;
            else id = y === height ? (height < SEA_LEVEL ? GRAVIER : HERBE) : TERRE;
          } else {
            id = oreAt(wx, y, wz, seed);
          }
          if (y > 0 && y < height && caveAt(wx, y, wz, seed)) id = AIR;
          c.blocks[idx(x, y, z)] = id;
        }
        // Mer et lacs.
        for (let y = height + 1; y <= SEA_LEVEL; y++) c.blocks[idx(x, y, z)] = EAU;
        // Sable sous le niveau de l'eau, sur la rive.
        if (height < SEA_LEVEL && c.blocks[idx(x, height, z)] === HERBE) c.blocks[idx(x, height, z)] = SABLE;
      }
    }
    this.decorate(c);
    this.applyEdits(c);
    c.built = true;
    c.dirty = true;
  }

  /** Arbres, cactus, fleurs. Les arbres des chunks voisins debordent ici. */
  private decorate(c: Chunk) {
    const { seed } = this;
    for (let ox = -1; ox <= 1; ox++) {
      for (let oz = -1; oz <= 1; oz++) {
        const ncx = c.cx + ox;
        const ncz = c.cz + oz;
        const r = hash2(ncx, ncz, seed + 907);
        const attempts = 6;
        for (let i = 0; i < attempts; i++) {
          const h1 = hash2(ncx * 31 + i, ncz * 17 - i, seed + 1301);
          const h2 = hash2(ncx * 13 - i, ncz * 29 + i, seed + 1601);
          const wx = ncx * CHUNK + Math.floor(h1 * CHUNK);
          const wz = ncz * CHUNK + Math.floor(h2 * CHUNK);
          const { height, biome } = columnAt(wx, wz, seed);
          if (height <= SEA_LEVEL) continue;
          const chance = biome === "foret" ? 0.8 : biome === "plaine" ? 0.22 : biome === "desert" ? 0.3 : 0.12;
          if (hash2(wx, wz, seed + 1901) > chance) continue;
          if (biome === "desert") this.putCactus(c, wx, height + 1, wz);
          else if (biome !== "neige" || r > 0.5) this.putTree(c, wx, height + 1, wz, seed);
        }
        // Touffes d'herbe et fleurs, denses dans les plaines.
        for (let i = 0; i < 14; i++) {
          const hx = hash2(ncx * 7 + i, ncz * 11 + i * 3, seed + 2203);
          const hz = hash2(ncx * 19 - i, ncz * 23 + i, seed + 2309);
          const wx = ncx * CHUNK + Math.floor(hx * CHUNK);
          const wz = ncz * CHUNK + Math.floor(hz * CHUNK);
          if (Math.floor(wx / CHUNK) !== c.cx || Math.floor(wz / CHUNK) !== c.cz) continue;
          const { height, biome } = columnAt(wx, wz, seed);
          if (height <= SEA_LEVEL || biome === "desert" || biome === "neige") continue;
          const lx = wx - c.cx * CHUNK;
          const lz = wz - c.cz * CHUNK;
          if (c.blocks[idx(lx, height, lz)] !== HERBE) continue;
          if (c.blocks[idx(lx, height + 1, lz)] !== AIR) continue;
          const pick = hash2(wx * 3, wz * 5, seed + 2411);
          c.blocks[idx(lx, height + 1, lz)] = pick > 0.86 ? FLEUR_ROUGE : pick > 0.72 ? FLEUR_JAUNE : pick > 0.35 ? HERBE_HAUTE : AIR;
        }
      }
    }
  }

  private setLocal(c: Chunk, wx: number, y: number, wz: number, id: BlockId, onlyAir = true) {
    if (y < 0 || y >= WORLD_HEIGHT) return;
    const lx = wx - c.cx * CHUNK;
    const lz = wz - c.cz * CHUNK;
    if (lx < 0 || lz < 0 || lx >= CHUNK || lz >= CHUNK) return;
    const i = idx(lx, y, lz);
    if (onlyAir && c.blocks[i] !== AIR) return;
    c.blocks[i] = id;
  }

  private putTree(c: Chunk, wx: number, y: number, wz: number, seed: number) {
    const h = 4 + Math.floor(hash2(wx, wz, seed + 3001) * 3);
    for (let i = 0; i < h; i++) this.setLocal(c, wx, y + i, wz, TRONC);
    const top = y + h;
    for (let dy = -2; dy <= 1; dy++) {
      const radius = dy <= -1 ? 2 : dy === 0 ? 1 : 1;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (dy === 1 && Math.abs(dx) + Math.abs(dz) > 1) continue;
          if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          this.setLocal(c, wx + dx, top + dy, wz + dz, FEUILLES);
        }
      }
    }
  }

  private putCactus(c: Chunk, wx: number, y: number, wz: number) {
    const h = 2 + Math.floor(hash2(wx, wz, this.seed + 3301) * 3);
    for (let i = 0; i < h; i++) this.setLocal(c, wx, y + i, wz, CACTUS);
  }

  private applyEdits(c: Chunk) {
    if (this.edits.size === 0) return;
    const x0 = c.cx * CHUNK;
    const z0 = c.cz * CHUNK;
    for (const [key, id] of this.edits) {
      const parts = key.split(",");
      const x = Number(parts[0]);
      const y = Number(parts[1]);
      const z = Number(parts[2]);
      if (x < x0 || x >= x0 + CHUNK || z < z0 || z >= z0 + CHUNK) continue;
      if (y < 0 || y >= WORLD_HEIGHT) continue;
      c.blocks[idx(x - x0, y, z - z0)] = id;
    }
  }

  // ---------------------------------------------------------------- lumiere

  /**
   * Lumiere du chunk : le ciel tombe a 15 dans les colonnes degagees, les
   * torches eclairent a 14, et tout se propage de proche en proche en perdant
   * un niveau par bloc. Une seule valeur par bloc (pas de jour/nuit), ce qui
   * evite de recalculer le monde a chaque minute.
   */
  lightChunk(c: Chunk) {
    c.light.fill(0);
    const queue: number[] = [];
    const baseX = c.cx * CHUNK;
    const baseZ = c.cz * CHUNK;
    // Hauteur ou le ciel s'arrete, colonne par colonne.
    const skyFrom = new Int16Array(CHUNK * CHUNK);
    for (let z = 0; z < CHUNK; z++) {
      for (let x = 0; x < CHUNK; x++) {
        let y = WORLD_HEIGHT - 1;
        while (y >= 0) {
          const id = c.blocks[idx(x, y, z)];
          if (block(id).opaque) break;
          c.light[idx(x, y, z)] = MAX_LIGHT;
          y--;
        }
        skyFrom[z * CHUNK + x] = y + 1;
        // Sources de lumiere sous la surface.
        for (; y >= 0; y--) {
          const id = c.blocks[idx(x, y, z)];
          const emit = block(id).light;
          if (emit > 0) {
            c.light[idx(x, y, z)] = emit;
            queue.push(baseX + x, y, baseZ + z);
          }
        }
      }
    }
    // Le ciel ne se propage que la ou il peut encore eclairer quelque chose :
    // a cote d'une case couverte (sous un surplomb, une grotte) ou vers un
    // chunk voisin moins eclaire. En plein air, tout est deja a 15 : inutile
    // d'examiner des milliers de cases pour rien.
    const needsSpread = (x: number, y: number, z: number) => {
      for (let n = 0; n < 4; n++) {
        const nx = x + (n === 0 ? 1 : n === 1 ? -1 : 0);
        const nz = z + (n === 2 ? 1 : n === 3 ? -1 : 0);
        if (nx >= 0 && nx < CHUNK && nz >= 0 && nz < CHUNK) {
          if (y < skyFrom[nz * CHUNK + nx] && !block(c.blocks[idx(nx, y, nz)]).opaque) return true;
        } else {
          const wx = baseX + nx;
          const wz = baseZ + nz;
          if (this.chunk(Math.floor(wx / CHUNK), Math.floor(wz / CHUNK)) && this.getLight(wx, y, wz) < MAX_LIGHT - 1 && !block(this.getBlock(wx, y, wz)).opaque) return true;
        }
      }
      return false;
    };
    for (let z = 0; z < CHUNK; z++) {
      for (let x = 0; x < CHUNK; x++) {
        for (let y = WORLD_HEIGHT - 1; y >= skyFrom[z * CHUNK + x]; y--) {
          if (needsSpread(x, y, z)) queue.push(baseX + x, y, baseZ + z);
        }
      }
    }
    // Les bords des chunks voisins deja eclaires alimentent celui-ci (un cote
    // a la fois, pour que le raccourci de chunk serve).
    for (const [ox, oz, alongX] of [
      [-1, 0, false],
      [CHUNK, 0, false],
      [0, -1, true],
      [0, CHUNK, true],
    ] as const) {
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        for (let k = 0; k < CHUNK; k++) {
          this.seedFromNeighbour(queue, baseX + (alongX ? k : ox), y, baseZ + (alongX ? oz : k));
        }
      }
    }
    this.propagate(queue);
  }

  private seedFromNeighbour(queue: number[], x: number, y: number, z: number) {
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    const c = this.chunk(cx, cz);
    if (!c) return;
    const v = c.light[idx(x - cx * CHUNK, y, z - cz * CHUNK)];
    if (v > 1) queue.push(x, y, z);
  }

  /** File de propagation : des triplets (x, y, z) deja eclaires. */
  private propagate(queue: number[]) {
    let head = 0;
    while (head < queue.length) {
      const x = queue[head++];
      const y = queue[head++];
      const z = queue[head++];
      const level = this.getLight(x, y, z);
      if (level <= 1) continue;
      for (const [dx, dy, dz] of NEIGHBOURS) {
        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;
        if (ny < 0 || ny >= WORLD_HEIGHT) continue;
        const c = this.chunk(Math.floor(nx / CHUNK), Math.floor(nz / CHUNK));
        if (!c) continue;
        if (block(this.getBlock(nx, ny, nz)).opaque) continue;
        // Le ciel descend sans faiblir : sinon les puits sont noirs au fond.
        const next = dy === -1 && level === MAX_LIGHT ? MAX_LIGHT : level - 1;
        if (this.getLight(nx, ny, nz) >= next) continue;
        this.setLightRaw(nx, ny, nz, next);
        queue.push(nx, ny, nz);
      }
    }
  }

  /** Efface la lumiere qui venait d'une case devenue opaque, puis recalcule. */
  private removeLight(x: number, y: number, z: number) {
    const start = this.getLight(x, y, z);
    if (start === 0) return;
    this.setLightRaw(x, y, z, 0);
    const removal: number[] = [x, y, z, start];
    const refill: number[] = [];
    const sources: number[] = [];
    let head = 0;
    while (head < removal.length) {
      const cx = removal[head++];
      const cy = removal[head++];
      const cz = removal[head++];
      const level = removal[head++];
      for (const [dx, dy, dz] of NEIGHBOURS) {
        const nx = cx + dx;
        const ny = cy + dy;
        const nz = cz + dz;
        if (ny < 0 || ny >= WORLD_HEIGHT) continue;
        if (!this.chunk(Math.floor(nx / CHUNK), Math.floor(nz / CHUNK))) continue;
        const nl = this.getLight(nx, ny, nz);
        if (nl === 0) continue;
        const fromSky = dy === -1 && level === MAX_LIGHT;
        if (nl < level || fromSky) {
          this.setLightRaw(nx, ny, nz, 0);
          removal.push(nx, ny, nz, nl);
          // Une autre source conserve sa propre emission apres le retrait.
          const emit = block(this.getBlock(nx, ny, nz)).light;
          if (emit > 0) sources.push(nx, ny, nz, emit);
        } else {
          refill.push(nx, ny, nz);
        }
      }
    }
    for (let i = 0; i < sources.length; i += 4) {
      const [sx, sy, sz, emit] = sources.slice(i, i + 4);
      this.setLightRaw(sx, sy, sz, Math.max(emit, this.getLight(sx, sy, sz)));
      refill.push(sx, sy, sz);
    }
    this.propagate(refill);
  }

  /** Remet la lumiere autour d'une case qui vient de changer. */
  private relightAround(x: number, y: number, z: number) {
    const id = this.getBlock(x, y, z);
    const d = block(id);
    this.removeLight(x, y, z);
    if (d.opaque) {
      // Une lampe reste opaque, mais doit eclairer les cases voisines.
      if (d.light > 0) {
        this.setLightRaw(x, y, z, d.light);
        this.propagate([x, y, z]);
      }
    } else {
      const queue: number[] = [];
      let best = d.light;
      for (const [dx, dy, dz] of NEIGHBOURS) {
        const nl = this.getLight(x + dx, y + dy, z + dz);
        const drop = dy === 1 && nl === MAX_LIGHT ? 0 : 1;
        best = Math.max(best, nl - drop);
      }
      if (best > 0) {
        this.setLightRaw(x, y, z, best);
        queue.push(x, y, z);
      }
      this.propagate(queue);
    }
  }

  // ---------------------------------------------------------- modifications

  /** Pose ou casse un bloc, met a jour lumiere et maillages, note l'edit. */
  setBlock(x: number, y: number, z: number, id: BlockId) {
    if (![x, y, z, id].every(Number.isInteger) || id < 0 || id >= BLOCKS.length || y <= 0 || y >= WORLD_HEIGHT) return;
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    const c = this.chunk(cx, cz);
    if (!c) return;
    const i = idx(x - cx * CHUNK, y, z - cz * CHUNK);
    if (c.blocks[i] === id) return;
    c.blocks[i] = id;
    this.edits.set(editKey(x, y, z), id);
    // Seuls les chunks dont la lumiere change doivent aussi etre reconstruits.
    this.trackLightChanges = true;
    try { this.relightAround(x, y, z); }
    finally { this.trackLightChanges = false; }
    this.markDirty(x, y, z);
  }
}

const NEIGHBOURS: [number, number, number][] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

// ---------------------------------------------------------------------------
// Maillage : des cubes vers de la geometrie
// ---------------------------------------------------------------------------

/** Une face de cube : direction, coins (position + coin de tuile), et AO. */
interface Face {
  dir: [number, number, number];
  /** Coins dans l'ordre 0,1,2 / 2,1,3. */
  corners: { pos: [number, number, number]; uv: [number, number] }[];
  /** Quelle tuile du bloc (0 dessus, 1 cote, 2 dessous). */
  tile: 0 | 1 | 2;
  /** Assombrissement de la face : le dessus est clair, le dessous sombre. */
  shade: number;
}

const FACES: Face[] = [
  {
    dir: [-1, 0, 0],
    tile: 1,
    shade: 0.72,
    corners: [
      { pos: [0, 1, 0], uv: [0, 1] },
      { pos: [0, 0, 0], uv: [0, 0] },
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [0, 0, 1], uv: [1, 0] },
    ],
  },
  {
    dir: [1, 0, 0],
    tile: 1,
    shade: 0.72,
    corners: [
      { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [1, 0, 1], uv: [0, 0] },
      { pos: [1, 1, 0], uv: [1, 1] },
      { pos: [1, 0, 0], uv: [1, 0] },
    ],
  },
  {
    dir: [0, -1, 0],
    tile: 2,
    shade: 0.5,
    corners: [
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 0], uv: [1, 1] },
      { pos: [0, 0, 0], uv: [0, 1] },
    ],
  },
  {
    dir: [0, 1, 0],
    tile: 0,
    shade: 1,
    corners: [
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [0, 1, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [0, 0] },
    ],
  },
  {
    dir: [0, 0, -1],
    tile: 1,
    shade: 0.86,
    corners: [
      { pos: [1, 0, 0], uv: [0, 0] },
      { pos: [0, 0, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [0, 1] },
      { pos: [0, 1, 0], uv: [1, 1] },
    ],
  },
  {
    dir: [0, 0, 1],
    tile: 1,
    shade: 0.86,
    corners: [
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [0, 1, 1], uv: [0, 1] },
      { pos: [1, 1, 1], uv: [1, 1] },
    ],
  },
];

export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
}

export interface ChunkMesh {
  solid: MeshData | null;
  water: MeshData | null;
}

const ATLAS_COLS = 8;
const ATLAS_ROWS = 8;
/** Marge a l'interieur de chaque tuile : sans elle, les tuiles voisines bavent. */
const UV_INSET = 0.0015;

function tileUV(tile: number, u: number, v: number): [number, number] {
  const col = tile % ATLAS_COLS;
  const row = Math.floor(tile / ATLAS_COLS);
  const u0 = col / ATLAS_COLS;
  const v0 = 1 - (row + 1) / ATLAS_ROWS;
  const su = 1 / ATLAS_COLS;
  const sv = 1 / ATLAS_ROWS;
  return [u0 + UV_INSET + u * (su - UV_INSET * 2), v0 + UV_INSET + v * (sv - UV_INSET * 2)];
}

class MeshBuilder {
  positions: number[] = [];
  normals: number[] = [];
  uvs: number[] = [];
  colors: number[] = [];
  indices: number[] = [];

  get empty() {
    return this.indices.length === 0;
  }

  build(): MeshData | null {
    if (this.empty) return null;
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      uvs: new Float32Array(this.uvs),
      colors: new Float32Array(this.colors),
      indices: new Uint32Array(this.indices),
    };
  }
}

/** Le voisin cache-t-il cette face ? Deux blocs d'eau ne se dessinent pas entre eux. */
function hidesFace(self: BlockDef, neighbour: BlockDef): boolean {
  if (neighbour.opaque) return true;
  if (self.liquid && neighbour.liquid) return true;
  if (self.id === neighbour.id && (self.id === VERRE || self.id === GLACE)) return true;
  return false;
}

/**
 * Construit la geometrie d'un chunk. Chaque face porte sa lumiere et son
 * occlusion ambiante dans la couleur des sommets : le rendu n'a besoin
 * d'aucune lumiere dynamique, ce qui tient largement les 60 images/seconde.
 */
export function buildChunkMesh(world: World, c: Chunk): ChunkMesh {
  const solid = new MeshBuilder();
  const water = new MeshBuilder();
  const baseX = c.cx * CHUNK;
  const baseZ = c.cz * CHUNK;

  const at = (x: number, y: number, z: number): BlockId => {
    if (y < 0 || y >= WORLD_HEIGHT) return AIR;
    if (x >= 0 && x < CHUNK && z >= 0 && z < CHUNK) return c.blocks[idx(x, y, z)];
    return world.getBlock(baseX + x, y, baseZ + z);
  };
  const lightAt = (x: number, y: number, z: number): number => {
    if (y < 0) return 0;
    if (y >= WORLD_HEIGHT) return MAX_LIGHT;
    if (x >= 0 && x < CHUNK && z >= 0 && z < CHUNK) return c.light[idx(x, y, z)];
    return world.getLight(baseX + x, y, baseZ + z);
  };
  const opaqueAt = (x: number, y: number, z: number) => block(at(x, y, z)).opaque;

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let z = 0; z < CHUNK; z++) {
      for (let x = 0; x < CHUNK; x++) {
        const id = c.blocks[idx(x, y, z)];
        if (id === AIR) continue;
        const d = block(id);

        if (d.shape === "croix") {
          addCross(solid, x, y, z, d, lightAt(x, y, z));
          continue;
        }

        const target = d.liquid ? water : solid;
        for (const face of FACES) {
          const [dx, dy, dz] = face.dir;
          const nId = at(x + dx, y + dy, z + dz);
          if (hidesFace(d, block(nId))) continue;
          // L'eau n'affiche que sa surface vers le haut si elle est couverte.
          const light = lightAt(x + dx, y + dy, z + dz);
          const tile = d.tiles[face.tile];
          const start = target.positions.length / 3;
          const ao: number[] = [];
          for (const corner of face.corners) {
            const [px, py, pz] = corner.pos;
            // Hauteur de l'eau : la surface est legerement plus basse.
            const drop = d.liquid && py === 1 && at(x, y + 1, z) !== EAU ? 0.12 : 0;
            target.positions.push(x + px, y + py - drop, z + pz);
            target.normals.push(dx, dy, dz);
            const [u, v] = tileUV(tile, corner.uv[0], corner.uv[1]);
            target.uvs.push(u, v);
            const occ = cornerAO(opaqueAt, x, y, z, face.dir, corner.pos);
            ao.push(occ);
            const shade = face.shade * (0.32 + 0.68 * (light / MAX_LIGHT)) * occ;
            target.colors.push(shade, shade, shade);
          }
          // Le sens des deux triangles suit l'occlusion, sinon le coin sombre
          // fait un pli visible en diagonale.
          if (ao[0] + ao[3] > ao[1] + ao[2]) {
            target.indices.push(start, start + 1, start + 3, start, start + 3, start + 2);
          } else {
            target.indices.push(start, start + 1, start + 2, start + 2, start + 1, start + 3);
          }
        }
      }
    }
  }
  return { solid: solid.build(), water: water.build() };
}

/** Occlusion ambiante d'un coin : plus il y a de blocs autour, plus c'est sombre. */
function cornerAO(
  opaqueAt: (x: number, y: number, z: number) => boolean,
  x: number,
  y: number,
  z: number,
  dir: [number, number, number],
  corner: [number, number, number],
): number {
  const [dx, dy, dz] = dir;
  // Les deux axes qui ne sont pas celui de la face.
  const axes: [0 | 1 | 2, 0 | 1 | 2] = dx !== 0 ? [1, 2] : dy !== 0 ? [0, 2] : [0, 1];
  const off = [0, 0, 0];
  const sign = (a: 0 | 1 | 2) => (corner[a] === 1 ? 1 : -1);
  const at = (a: number, b: number) => {
    off[0] = dx;
    off[1] = dy;
    off[2] = dz;
    off[axes[0]] += a;
    off[axes[1]] += b;
    return opaqueAt(x + off[0], y + off[1], z + off[2]);
  };
  const s1 = at(sign(axes[0]), 0);
  const s2 = at(0, sign(axes[1]));
  const cor = at(sign(axes[0]), sign(axes[1]));
  const blocked = (s1 && s2 ? 3 : (s1 ? 1 : 0) + (s2 ? 1 : 0) + (cor ? 1 : 0));
  return [1, 0.82, 0.68, 0.55][blocked];
}

/** Fleurs, herbes hautes et torches : deux plans croises. */
function addCross(b: MeshBuilder, x: number, y: number, z: number, d: BlockDef, light: number) {
  const tile = d.tiles[0];
  const torch = d.id === TORCHE;
  const w = torch ? 0.12 : 0.42;
  const h = torch ? 0.62 : 0.9;
  const shade = 0.42 + 0.58 * (light / MAX_LIGHT);
  const quads: [number, number, number, number][] = [
    [-w, -w, w, w],
    [-w, w, w, -w],
  ];
  for (const [x1, z1, x2, z2] of quads) {
    const start = b.positions.length / 3;
    const pts: [number, number, number][] = [
      [0.5 + x1, 0, 0.5 + z1],
      [0.5 + x2, 0, 0.5 + z2],
      [0.5 + x1, h, 0.5 + z1],
      [0.5 + x2, h, 0.5 + z2],
    ];
    const uv: [number, number][] = [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ];
    for (let i = 0; i < 4; i++) {
      b.positions.push(x + pts[i][0], y + pts[i][1], z + pts[i][2]);
      b.normals.push(0, 1, 0);
      const [u, v] = tileUV(tile, uv[i][0], uv[i][1]);
      b.uvs.push(u, v);
      b.colors.push(shade, shade, shade);
    }
    // Visible des deux cotes : on pousse les deux sens de triangles.
    b.indices.push(start, start + 1, start + 2, start + 2, start + 1, start + 3);
    b.indices.push(start + 2, start + 1, start, start + 3, start + 1, start + 2);
  }
}

// ---------------------------------------------------------------------------
// Visee : quel bloc regarde-t-on ?
// ---------------------------------------------------------------------------

export interface RayHit {
  /** Bloc touche. */
  x: number;
  y: number;
  z: number;
  /** Face touchee : la case ou l'on poserait un bloc. */
  nx: number;
  ny: number;
  nz: number;
  id: BlockId;
  distance: number;
}

/**
 * Parcours de grille facon Amanatides & Woo : on avance de frontiere en
 * frontiere plutot qu'a petits pas, donc aucun bloc n'est saute meme en
 * regardant en biais.
 */
export function raycast(
  world: World,
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDistance: number,
  hitLiquid = false,
): RayHit | null {
  let x = Math.floor(ox);
  let y = Math.floor(oy);
  let z = Math.floor(oz);
  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const stepZ = dz > 0 ? 1 : -1;
  if (dx === 0 && dy === 0 && dz === 0) return null;
  const tDeltaX = dx === 0 ? Infinity : Math.abs(1 / dx);
  const tDeltaY = dy === 0 ? Infinity : Math.abs(1 / dy);
  const tDeltaZ = dz === 0 ? Infinity : Math.abs(1 / dz);
  let tMaxX = dx === 0 ? Infinity : tDeltaX * (dx > 0 ? 1 - (ox - x) : ox - x);
  let tMaxY = dy === 0 ? Infinity : tDeltaY * (dy > 0 ? 1 - (oy - y) : oy - y);
  let tMaxZ = dz === 0 ? Infinity : tDeltaZ * (dz > 0 ? 1 - (oz - z) : oz - z);
  let nx = 0;
  let ny = 0;
  let nz = 0;
  let t = 0;
  for (let guard = 0; guard < 512 && t <= maxDistance; guard++) {
    const id = world.getBlock(x, y, z);
    const d = block(id);
    if (id !== AIR && (hitLiquid || !d.liquid)) {
      return { x, y, z, nx: x + nx, ny: y + ny, nz: z + nz, id, distance: t };
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX;
      t = tMaxX;
      tMaxX += tDeltaX;
      nx = -stepX;
      ny = 0;
      nz = 0;
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      t = tMaxY;
      tMaxY += tDeltaY;
      nx = 0;
      ny = -stepY;
      nz = 0;
    } else {
      z += stepZ;
      t = tMaxZ;
      tMaxZ += tDeltaZ;
      nx = 0;
      ny = 0;
      nz = -stepZ;
    }
    if ((y < 0 && dy <= 0) || (y >= WORLD_HEIGHT && dy >= 0)) return null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sauvegarde
// ---------------------------------------------------------------------------

export interface SavedWorld {
  version: 1;
  seed: number;
  mode: "creatif" | "survie";
  /** Position et regard du joueur. */
  player: { x: number; y: number; z: number; yaw: number; pitch: number };
  /** Barre d'objets : un bloc par case. */
  hotbar: BlockId[];
  /** Quantites en survie, par bloc. */
  stock: Record<string, number>;
  /** Modifications : x,y,z,id a la suite. */
  edits: number[];
  savedAt: number;
}

export function encodeEdits(edits: Edits): number[] {
  const out: number[] = [];
  for (const [key, id] of edits) {
    const parts = key.split(",");
    out.push(Number(parts[0]), Number(parts[1]), Number(parts[2]), id);
  }
  return out;
}

export function decodeEdits(flat: number[] | undefined): Edits {
  const map: Edits = new Map();
  if (!flat) return map;
  for (let i = 0; i + 3 < flat.length; i += 4) {
    map.set(editKey(flat[i], flat[i + 1], flat[i + 2]), flat[i + 3]);
  }
  return map;
}

/** Endroit sur, au-dessus du sol, pour deposer le joueur au depart. */
export function spawnPoint(seed: number): { x: number; y: number; z: number } {
  for (let r = 0; r < 64; r++) {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const x = Math.round(Math.cos(angle) * r * 4);
      const z = Math.round(Math.sin(angle) * r * 4);
      const { height, biome } = columnAt(x, z, seed);
      if (height > SEA_LEVEL + 1 && biome !== "montagne" && biome !== "neige") {
        return { x: x + 0.5, y: height + 2, z: z + 0.5 };
      }
    }
  }
  return { x: 0.5, y: SEA_LEVEL + 6, z: 0.5 };
}
