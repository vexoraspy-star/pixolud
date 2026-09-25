import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { WeaponFoley } from "./duelAudio";
import type { CasingKind } from "./duelEffects";
import { CAMOS, type CamoId } from "./duelProfile";
import {
  makeCamoTexture,
  makeGloveTexture,
  makeGunMetalTexture,
  makeGunWoodTexture,
  makePolymerTexture,
  makeScopeLensTexture,
} from "./duelTextures";

/**
 * L'arsenal du Duel.
 *
 * Le jeu n'avait qu'une arme, donc un seul rythme de combat : on avancait et
 * on tirait, toujours pareil. Cinq armes aux defauts assumes creent des
 * situations differentes — le fusil a pompe force le corps a corps, le sniper
 * punit ceux qui traversent a decouvert, la mitraillette rate de loin.
 *
 * Chaque arme est definie une seule fois ici : degats, cadence, dispersion,
 * et le modele 3D tenu en main. Le reste du jeu ne connait que WeaponSpec.
 */

export type WeaponId =
  | "poings"
  | "pistolet"
  | "revolver"
  | "pm"
  | "mitraillette"
  | "pompe"
  | "fusil"
  | "carabine"
  | "mitrailleuse"
  | "sniper"
  | "rafale"
  | "double"
  | "arbalete"
  | "roquettes";

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  /** Nom court pour l'interface en jeu. */
  short: string;
  damage: number;
  /** Multiplicateur de degats sur un tir a la tete. */
  headshot: number;
  /** Secondes entre deux tirs. */
  fireInterval: number;
  /** Vrai = feu continu en gardant le bouton enfonce. */
  auto: boolean;
  magSize: number;
  reloadSeconds: number;
  /** Nombre de projectiles par tir (fusil a pompe). */
  pellets: number;
  /** Dispersion en radians, a l'arret. Elle double en mouvement. */
  spread: number;
  /** Amplitude du recul vertical de la camera. */
  recoil: number;
  /** Portee utile en cases ; au-dela, les degats tombent de moitie. */
  range: number;
  /** Facteur de vitesse de deplacement : une arme lourde ralentit. */
  moveFactor: number;
  /** Champ de vision en visee (undefined = pas de lunette). */
  zoomFov?: number;
  /** Couleur du traceur, pour distinguer les armes en combat. */
  tracer: number;
  /** Corps a corps : pas de munitions, pas de rechargement, portee d'un bras. */
  melee?: boolean;
  /** Tir en rafale : une pression envoie ce nombre de balles. */
  burst?: number;
  /** Secondes entre deux balles d'une meme rafale. */
  burstGap?: number;
  /** Pas de detonation : le tir n'apparait pas sur le radar des autres. */
  silent?: boolean;
  /** Projectile explosif : degats de zone autour de l'impact (rayon en cases). */
  explosive?: { radius: number; damage: number };
  /** Multiplicateur de degats contre les constructions (1 par defaut). */
  buildDamage?: number;
}

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  poings: {
    id: "poings",
    name: "Poings",
    short: "POINGS",
    // En battle royale on atterrit les mains vides : les poings servent a se
    // defendre le temps de trouver une arme, pas a gagner un combat.
    damage: 20,
    headshot: 1,
    fireInterval: 0.45,
    auto: false,
    magSize: 0,
    reloadSeconds: 0,
    pellets: 1,
    spread: 0,
    recoil: 0.35,
    range: 1.35,
    moveFactor: 1.12,
    tracer: 0xffffff,
    melee: true,
  },
  pistolet: {
    id: "pistolet",
    name: "Pistolet",
    short: "PIST",
    damage: 34,
    headshot: 2.2,
    fireInterval: 0.26,
    auto: false,
    magSize: 12,
    reloadSeconds: 1.2,
    pellets: 1,
    spread: 0.009,
    recoil: 0.9,
    range: 18,
    moveFactor: 1.08,
    tracer: 0xffe6a8,
  },
  mitraillette: {
    id: "mitraillette",
    name: "Mitraillette",
    short: "SMG",
    damage: 17,
    headshot: 1.9,
    fireInterval: 0.075,
    auto: true,
    magSize: 30,
    reloadSeconds: 1.6,
    pellets: 1,
    // Elle crache vite mais arrose : au-dela de dix metres, elle ne sert plus.
    spread: 0.034,
    recoil: 0.5,
    range: 11,
    moveFactor: 1.05,
    tracer: 0xfff0c0,
  },
  fusil: {
    id: "fusil",
    name: "Fusil d'assaut",
    short: "FUSIL",
    damage: 25,
    headshot: 2.1,
    fireInterval: 0.125,
    auto: true,
    magSize: 30,
    reloadSeconds: 2,
    pellets: 1,
    spread: 0.016,
    recoil: 0.8,
    range: 22,
    moveFactor: 1,
    tracer: 0xffd98a,
  },
  pompe: {
    id: "pompe",
    name: "Fusil à pompe",
    short: "POMPE",
    // Huit plombs a 14 : colle au corps c'est mortel, a dix metres c'est rien.
    damage: 14,
    headshot: 1.4,
    fireInterval: 0.85,
    auto: false,
    magSize: 6,
    reloadSeconds: 2.7,
    pellets: 8,
    spread: 0.105,
    recoil: 2.2,
    range: 8,
    moveFactor: 0.95,
    tracer: 0xffbf7a,
  },
  revolver: {
    id: "revolver",
    name: "Revolver",
    short: "REVOLVER",
    // Six coups lents qui font mal : deux au corps, ou un a la tete et un
    // de plus. Il recompense le calme.
    damage: 56,
    headshot: 2,
    fireInterval: 0.52,
    auto: false,
    magSize: 6,
    reloadSeconds: 2.4,
    pellets: 1,
    spread: 0.006,
    recoil: 2,
    range: 20,
    moveFactor: 1.06,
    tracer: 0xffd070,
  },
  pm: {
    id: "pm",
    name: "Pistolet-mitrailleur",
    short: "PM",
    // La cadence la plus folle du jeu, et les degats les plus faibles : il
    // gagne un couloir, il perd une avenue.
    damage: 13,
    headshot: 1.8,
    fireInterval: 0.055,
    auto: true,
    magSize: 32,
    reloadSeconds: 1.4,
    pellets: 1,
    spread: 0.042,
    recoil: 0.35,
    range: 9,
    moveFactor: 1.1,
    tracer: 0xfff4c8,
  },
  carabine: {
    id: "carabine",
    name: "Carabine de précision",
    short: "CARABINE",
    // Entre le fusil d'assaut et le sniper : semi-automatique, une petite
    // lunette, et trois balles au corps pour abattre quelqu'un.
    damage: 46,
    headshot: 2,
    fireInterval: 0.32,
    auto: false,
    magSize: 12,
    reloadSeconds: 2.2,
    pellets: 1,
    spread: 0.004,
    recoil: 1.5,
    range: 30,
    moveFactor: 0.95,
    zoomFov: 46,
    tracer: 0xd8f0ff,
  },
  mitrailleuse: {
    id: "mitrailleuse",
    name: "Mitrailleuse",
    short: "LMG",
    // Soixante-quinze coups et un rechargement interminable : on tient une
    // position, on ne court pas avec.
    damage: 22,
    headshot: 1.9,
    fireInterval: 0.09,
    auto: true,
    magSize: 75,
    reloadSeconds: 4.2,
    pellets: 1,
    spread: 0.024,
    recoil: 0.7,
    range: 20,
    moveFactor: 0.82,
    tracer: 0xffc870,
  },
  sniper: {
    id: "sniper",
    name: "Fusil de précision",
    short: "SNIPER",
    // Un tir au corps ne tue pas tout a fait : il reste 5 PV, donc le duel
    // continue. A la tete, c'est fini.
    damage: 95,
    headshot: 1.6,
    fireInterval: 1.25,
    auto: false,
    magSize: 5,
    reloadSeconds: 2.9,
    pellets: 1,
    spread: 0.0015,
    recoil: 3.2,
    range: 40,
    moveFactor: 0.86,
    zoomFov: 26,
    tracer: 0xbfe9ff,
  },
  rafale: {
    id: "rafale",
    name: "Fusil à rafale",
    short: "RAFALE",
    // Trois balles par pression, puis une pause : precis tant qu'on dose,
    // il ne pardonne pas de rater la premiere rafale.
    damage: 29,
    headshot: 2,
    fireInterval: 0.42,
    auto: false,
    magSize: 24,
    reloadSeconds: 2.1,
    pellets: 1,
    spread: 0.01,
    recoil: 0.75,
    range: 24,
    moveFactor: 1,
    tracer: 0xffe08a,
    burst: 3,
    burstGap: 0.075,
  },
  double: {
    id: "double",
    name: "Fusil à double canon",
    short: "DOUBLE",
    // Deux coups presque a la suite, puis un long rechargement : tout se
    // joue en une seconde, au corps a corps.
    damage: 13,
    headshot: 1.4,
    fireInterval: 0.22,
    auto: false,
    magSize: 2,
    reloadSeconds: 2.3,
    pellets: 9,
    spread: 0.12,
    recoil: 2.6,
    range: 7,
    moveFactor: 1,
    tracer: 0xffc58a,
    buildDamage: 1.3,
  },
  arbalete: {
    id: "arbalete",
    name: "Arbalète",
    short: "ARBALÈTE",
    // Un carreau a la fois, silencieux : personne ne sait d'ou il vient.
    damage: 88,
    headshot: 2,
    fireInterval: 0.3,
    auto: false,
    magSize: 1,
    reloadSeconds: 1.5,
    pellets: 1,
    spread: 0.002,
    recoil: 1.2,
    range: 32,
    moveFactor: 0.98,
    tracer: 0xb8ffb0,
    silent: true,
  },
  roquettes: {
    id: "roquettes",
    name: "Lance-roquettes",
    short: "ROQUETTES",
    // Une roquette qui explose a l'impact : elle touche autour, et reduit
    // les constructions en miettes.
    damage: 70,
    headshot: 1,
    fireInterval: 0.9,
    auto: false,
    magSize: 1,
    reloadSeconds: 2.8,
    pellets: 1,
    spread: 0.003,
    recoil: 3.4,
    range: 30,
    moveFactor: 0.84,
    tracer: 0xff8a3a,
    explosive: { radius: 2.4, damage: 75 },
    buildDamage: 8,
  },
};

/** L'ordre de progression du mode Course a l'armement. */
export const GUN_GAME_ORDER: WeaponId[] = [
  "pistolet",
  "revolver",
  "pm",
  "mitraillette",
  "pompe",
  "fusil",
  "carabine",
  "mitrailleuse",
  "sniper",
];

/**
 * L'ordre des armes dans la boutique, de la moins chere a la plus chere.
 * Touches 1 a 9 puis 0 ; Maj + chiffre pour les suivantes.
 */
export const SHOP_ORDER: WeaponId[] = [
  "pistolet",
  "revolver",
  "pm",
  "mitraillette",
  "double",
  "pompe",
  "rafale",
  "fusil",
  "arbalete",
  "carabine",
  "mitrailleuse",
  "sniper",
  "roquettes",
];

/** Touche d'une arme de la boutique : « 1 » a « 9 », « 0 », puis « Maj+1 »... */
export function shopKeyLabel(index: number): string {
  if (index < 9) return String(index + 1);
  if (index === 9) return "0";
  return `Maj+${index - 9}`;
}

/** Index dans SHOP_ORDER d'un chiffre du clavier (1..9, 0), Maj pour la suite. */
export function shopIndexFromKey(digit: number, shift: boolean): number {
  if (shift) return 9 + digit;
  return digit === 0 ? 9 : digit - 1;
}

/**
 * Rarete au sol en battle royale : elle colore le faisceau de l'arme (gris,
 * bleu, violet, or) et fixe sa frequence. Un sniper doit rester une trouvaille.
 */
export type WeaponRarity = "commun" | "rare" | "epique" | "legendaire";
export const WEAPON_RARITY: Record<WeaponId, WeaponRarity> = {
  poings: "commun",
  pistolet: "commun",
  pm: "commun",
  mitraillette: "commun",
  revolver: "rare",
  pompe: "rare",
  fusil: "rare",
  carabine: "epique",
  mitrailleuse: "epique",
  sniper: "legendaire",
  double: "rare",
  rafale: "rare",
  arbalete: "epique",
  roquettes: "legendaire",
};

/** Tirage d'une arme au sol : commune 46 %, rare 32 %, epique 16 %, legendaire 6 %. */
export function rollLootWeapon(rand: () => number): WeaponId {
  const r = rand();
  const tier: WeaponRarity = r < 0.46 ? "commun" : r < 0.78 ? "rare" : r < 0.94 ? "epique" : "legendaire";
  const pool = SHOP_ORDER.filter((id) => WEAPON_RARITY[id] === tier);
  return pool[Math.floor(rand() * pool.length)];
}

/** Ce qu'on trouve au sol en Battle Royale, du plus commun au plus rare. */
export const LOOT_TABLE: WeaponId[] = [
  "pm",
  "mitraillette",
  "mitraillette",
  "revolver",
  "fusil",
  "fusil",
  "pompe",
  "carabine",
  "mitrailleuse",
  "sniper",
  "rafale",
  "double",
  "arbalete",
  "roquettes",
];

/**
 * Un evenement mecanique cale sur une animation : un bruit, des douilles qui
 * sortent. `at` est une fraction du cycle de tir ou du rechargement : la
 * scene le declenche quand l'avancement franchit ce seuil, donc le son tombe
 * toujours pile sur le geste, quelle que soit la duree.
 */
export interface MechCue {
  at: number;
  sound?: WeaponFoley;
  /** Vrai : les douilles vides sortent a cet instant. */
  eject?: boolean;
}

/** Comment l'arme se recharge : chaque style a ses gestes et ses bruits. */
export type ReloadStyle = "chargeur" | "cartouches" | "barillet" | "bascule" | "projectile";

export interface WeaponModel {
  group: THREE.Group;
  /** Point d'attache de l'eclair, au bout du canon : le laser en part aussi. */
  flash: THREE.Object3D;
  /** Fenetre d'ejection : c'est de la que sortent les douilles. */
  ejectPort: THREE.Object3D;
  /** Allure des douilles de cette arme. */
  casing: CasingKind;
  /**
   * Vrai : une douille sort a chaque coup. Sinon elle sort au cycle (pompe,
   * verrou : voir cycleCues), au rechargement (revolver, fusil double) ou
   * jamais (arbalete, roquettes, poings).
   */
  ejectOnShot: boolean;
  /** Force de la lueur que le tir jette autour de lui (0 : aucune). */
  flashLight: number;
  reloadStyle: ReloadStyle;
  /** Bruits et douilles entre deux coups (pompe, verrou), en fraction de la cadence. */
  cycleCues: readonly MechCue[];
  /** Bruits et douilles du rechargement, en fraction de sa duree. */
  reloadCues(shells: number, empty: boolean): MechCue[];
  /** Allume l'eclair de bouche (aim : 0 a la hanche, 1 en visee). */
  fireFlash(time: number, aim: number): void;
  /** Anime les pieces mobiles et les mains. A appeler a chaque image. */
  update(anim: WeaponAnim): void;
  dispose(): void;
}

/** Etat de l'arme a une image donnee, tel que la scene le connait. */
export interface WeaponAnim {
  /** Horloge de la partie, pour le balancement au repos. */
  time: number;
  /** 1 juste apres un tir, retombe vers 0. */
  recoil: number;
  /** Avancement du rechargement, de 0 (aucun) a 1 (fini). */
  reload: number;
  /** 1 quand on vise. */
  aim: number;
  /** 1 en sprint. */
  sprint: number;
  /** Avancement du cycle depuis le dernier coup : 0 au coup, 1 arme prete. */
  cycle?: number;
  /** Chargeur vide : culasse bloquee ouverte, projectile absent. */
  empty?: boolean;
  /** Cartouches a remettre pendant ce rechargement. */
  shells?: number;
}

/** Eclair de bouche de chaque arme : etoile, flamme, teinte, jets du frein de bouche, lueur. */
const MUZZLE: Record<WeaponId, { star: number; flame: number; color: number; jets: boolean; light: number }> = {
  poings: { star: 0, flame: 0, color: 0xffffff, jets: false, light: 0 },
  pistolet: { star: 0.1, flame: 0.14, color: 0xffd79a, jets: false, light: 0.8 },
  revolver: { star: 0.13, flame: 0.2, color: 0xffc27a, jets: false, light: 1 },
  pm: { star: 0.08, flame: 0.11, color: 0xffe2a8, jets: false, light: 0.55 },
  mitraillette: { star: 0.09, flame: 0.13, color: 0xffdca0, jets: false, light: 0.6 },
  fusil: { star: 0.1, flame: 0.16, color: 0xffd08a, jets: true, light: 0.75 },
  carabine: { star: 0.1, flame: 0.16, color: 0xffd8a0, jets: true, light: 0.8 },
  mitrailleuse: { star: 0.13, flame: 0.24, color: 0xffc47a, jets: false, light: 0.9 },
  sniper: { star: 0.13, flame: 0.18, color: 0xffcf8f, jets: true, light: 1.1 },
  rafale: { star: 0.1, flame: 0.15, color: 0xffd694, jets: false, light: 0.7 },
  pompe: { star: 0.2, flame: 0.3, color: 0xffb566, jets: false, light: 1.3 },
  double: { star: 0.21, flame: 0.32, color: 0xffb066, jets: false, light: 1.4 },
  arbalete: { star: 0, flame: 0, color: 0xffffff, jets: false, light: 0 },
  roquettes: { star: 0.24, flame: 0.34, color: 0xffa050, jets: false, light: 1.5 },
};

/** Duree de l'eclair : deux ou trois images, pas plus. */
const FLASH_SECONDS = 0.04;

// --- Textures de l'eclair, partagees par les quatorze armes ---
// Dessinees une seule fois au canvas ; la derniere arme detruite les libere.
let flashTextures: { star: THREE.CanvasTexture; flame: THREE.CanvasTexture } | null = null;
let flashTextureUsers = 0;

/** Etoile vue de face : un coeur blanc-jaune et sept rayons effiles. */
function drawFlashStar(): THREE.CanvasTexture {
  const S = 128;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const g = canvas.getContext("2d")!;
  const c = S / 2;
  g.globalCompositeOperation = "lighter";
  const rays = 7;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + (i % 2) * 0.22;
    const len = i % 2 === 0 ? 62 : 42;
    const base = i % 2 === 0 ? 8 : 6;
    const grad = g.createLinearGradient(c, c, c + Math.cos(a) * len, c + Math.sin(a) * len);
    grad.addColorStop(0, "rgba(255,240,200,0.95)");
    grad.addColorStop(0.45, "rgba(255,170,60,0.55)");
    grad.addColorStop(1, "rgba(255,110,20,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(c + Math.cos(a - Math.PI / 2) * base, c + Math.sin(a - Math.PI / 2) * base);
    g.lineTo(c + Math.cos(a) * len, c + Math.sin(a) * len);
    g.lineTo(c + Math.cos(a + Math.PI / 2) * base, c + Math.sin(a + Math.PI / 2) * base);
    g.closePath();
    g.fill();
  }
  const core = g.createRadialGradient(c, c, 0, c, c, 34);
  core.addColorStop(0, "rgba(255,255,245,1)");
  core.addColorStop(0.3, "rgba(255,230,150,0.9)");
  core.addColorStop(0.7, "rgba(255,150,40,0.35)");
  core.addColorStop(1, "rgba(255,120,20,0)");
  g.fillStyle = core;
  g.beginPath();
  g.arc(c, c, 34, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Flamme vue de profil : la base (a gauche) au canon, la pointe vers la droite. */
function drawFlashFlame(): THREE.CanvasTexture {
  const W = 128;
  const H = 64;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, "rgba(255,250,225,1)");
  grad.addColorStop(0.25, "rgba(255,215,120,0.9)");
  grad.addColorStop(0.6, "rgba(255,140,40,0.5)");
  grad.addColorStop(1, "rgba(255,90,20,0)");
  g.fillStyle = grad;
  // Une goutte allongee : large au canon, effilee au bout.
  g.beginPath();
  g.moveTo(0, H / 2);
  g.bezierCurveTo(W * 0.1, 4, W * 0.55, H * 0.28, W, H / 2);
  g.bezierCurveTo(W * 0.55, H * 0.72, W * 0.1, H - 4, 0, H / 2);
  g.fill();
  // Coeur plus blanc le long de l'axe.
  g.globalCompositeOperation = "lighter";
  const core = g.createLinearGradient(0, 0, W * 0.6, 0);
  core.addColorStop(0, "rgba(255,255,240,0.8)");
  core.addColorStop(1, "rgba(255,200,120,0)");
  g.fillStyle = core;
  g.fillRect(0, H * 0.42, W * 0.6, H * 0.16);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function acquireFlashTextures() {
  if (!flashTextures) flashTextures = { star: drawFlashStar(), flame: drawFlashFlame() };
  flashTextureUsers += 1;
  return flashTextures;
}

function releaseFlashTextures() {
  flashTextureUsers -= 1;
  if (flashTextureUsers <= 0 && flashTextures) {
    flashTextures.star.dispose();
    flashTextures.flame.dispose();
    flashTextures = null;
    flashTextureUsers = 0;
  }
}

// --- Petites courbes d'animation ---
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** 0 avant a, 1 apres b, et une transition douce entre les deux. */
function ramp(t: number, a: number, b: number) {
  const k = clamp01((t - a) / (b - a));
  return k * k * (3 - 2 * k);
}
/** Aller-retour : monte entre a et b, redescend entre c et d. */
function hump(t: number, a: number, b: number, c: number, d: number) {
  return ramp(t, a, b) - ramp(t, c, d);
}

/**
 * Rechargement au coup par coup : combien d'allers-retours de la main, a
 * partir de quand, et combien de temps chacun. Partage par l'animation et par
 * les bruits, pour qu'ils tombent ensemble.
 */
interface DipPlan {
  n: number;
  t0: number;
  len: number;
}
/** Ecrit dans `out` (reutilise a chaque image : rien d'alloue). */
function dipPlan(style: ReloadStyle, shells: number, magSize: number, out: DipPlan): DipPlan {
  if (style === "cartouches") {
    // Autant de cartouches que de coups tires : une seule, c'est un seul geste.
    out.n = Math.max(1, Math.min(magSize, Math.round(shells)));
    out.len = 0.7 / Math.max(out.n, 3);
    out.t0 = 0.1 + (0.7 - out.n * out.len) / 2;
  } else if (style === "bascule") {
    out.n = Math.max(1, Math.min(2, Math.round(shells)));
    out.len = 0.23;
    out.t0 = 0.26 + (0.46 - out.n * out.len) / 2;
  } else if (style === "barillet") {
    out.n = 1;
    out.t0 = 0.36;
    out.len = 0.3;
  } else {
    out.n = 1;
    out.t0 = 0.14;
    out.len = 0.52;
  }
  return out;
}

/** Ou la main gauche plonge chercher une munition : sous l'arme, hors champ. */
const DIP_DOWN = new THREE.Vector3(-0.04, -0.34, 0.12);

/**
 * Le modele tenu en main, a la premiere personne.
 *
 * Trois exigences : reconnaitre l'arme a sa silhouette sans lire l'interface,
 * VOIR qu'on la tient (deux mains gantees, pas une capsule flottante), et
 * comprendre ce qui se passe (la culasse recule, la pompe fait son
 * aller-retour, le chargeur tombe au rechargement).
 *
 * Tout est dessine ici en boites et cylindres, avec quatre textures peintes
 * au canvas : aucun fichier de modele, aucune image.
 */
/** Habillage d'une arme : camouflage, et couleurs de la tenue sur les mains. */
export interface WeaponLook {
  camo?: CamoId;
  sleeve?: number;
  glove?: number;
  /** Faux : l'arme seule, sans les mains (vitrine du casier). */
  hands?: boolean;
}

/**
 * Hauteur, dans le modele, a laquelle le viseur se retrouve pile sur l'axe de
 * la camera en visee. La scene pose l'arme a y = -0.12 avec une echelle de
 * 0.66 (DuelScene) : 0.12 / 0.66. Avec l'ancienne valeur, le point rouge
 * flottait au-dessus du centre de l'ecran et on tirait en dessous.
 */
const AIM_SIGHT_Y = 0.12 / 0.66;

export function buildWeaponModel(id: WeaponId, look: WeaponLook = {}): WeaponModel {
  const group = new THREE.Group();
  // Les pieces vivent dans un sous-groupe : la scene pilote `group` (position
  // a l'ecran, visee, sprint), l'animation pilote `body` — sans se marcher
  // dessus.
  const body = new THREE.Group();
  group.add(body);

  const owned: { dispose(): void }[] = [];
  function keep<T extends { dispose(): void }>(x: T): T {
    owned.push(x);
    return x;
  }

  const metalTex = keep(makeGunMetalTexture());
  metalTex.repeat.set(2, 2);
  const polymerTex = keep(makePolymerTexture());
  polymerTex.repeat.set(2, 2);
  const woodTex = keep(makeGunWoodTexture());
  const gloveTex = keep(makeGloveTexture());

  const steel = keep(new THREE.MeshLambertMaterial({ map: metalTex, color: 0x8b939d }));
  const metal = keep(new THREE.MeshLambertMaterial({ map: metalTex, color: 0x555c65 }));
  const dark = keep(new THREE.MeshLambertMaterial({ map: polymerTex, color: 0x2a2e33 }));
  const polymer = keep(new THREE.MeshLambertMaterial({ map: polymerTex, color: 0x3b4046 }));
  const wood = keep(new THREE.MeshLambertMaterial({ map: woodTex }));
  const glove = keep(new THREE.MeshLambertMaterial({ map: gloveTex, color: 0x5b636c }));
  const gloveDark = keep(new THREE.MeshLambertMaterial({ map: gloveTex, color: 0x30363c }));
  const sleeve = keep(new THREE.MeshLambertMaterial({ map: gloveTex, color: 0x3a4038 }));
  const sable = keep(new THREE.MeshLambertMaterial({ map: polymerTex, color: 0x9c8155 }));
  const olive = keep(new THREE.MeshLambertMaterial({ map: polymerTex, color: 0x5d6349 }));
  const brass = keep(new THREE.MeshLambertMaterial({ color: 0xb08d3a }));
  const shellRed = keep(new THREE.MeshLambertMaterial({ color: 0xa3261c }));
  const accent = keep(new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
  const white = keep(new THREE.MeshBasicMaterial({ color: 0xe8f0f5 }));

  // --- Tenue et camouflage ---
  if (look.sleeve !== undefined) sleeve.color.setHex(look.sleeve);
  if (look.glove !== undefined) {
    glove.color.setHex(look.glove);
    gloveDark.color.copy(glove.color).multiplyScalar(0.55);
  }
  const camo = CAMOS[look.camo ?? "standard"];
  if (camo.colors.length > 0) {
    // Le motif recouvre toute la garniture (polymere, bois, crosses) ; le
    // metal reste du metal, sauf pour l'or.
    const camoTex = keep(makeCamoTexture(camo.colors));
    camoTex.repeat.set(2, 2);
    for (const m of [polymer, sable, olive, wood]) {
      m.map = camoTex;
      m.color.setHex(0xffffff);
    }
    dark.map = camoTex;
    dark.color.setHex(0x8a8a8a);
  }
  if (camo.goldMetal) {
    steel.color.setHex(0xffd36b);
    metal.color.setHex(0xd9ab3c);
  }

  function box(w: number, h: number, d: number, mat: THREE.Material) {
    return new THREE.Mesh(keep(new THREE.BoxGeometry(w, h, d)), mat);
  }
  /** Cylindre couche le long de l'axe de tir. */
  function tube(r: number, len: number, mat: THREE.Material, seg = 8, r2 = r) {
    const m = new THREE.Mesh(keep(new THREE.CylinderGeometry(r, r2, len, seg)), mat);
    m.rotation.x = Math.PI / 2;
    return m;
  }
  function ring(r: number, thick: number, mat: THREE.Material) {
    const m = new THREE.Mesh(keep(new THREE.TorusGeometry(r, thick, 6, 14)), mat);
    return m;
  }
  function put(parent: THREE.Object3D, mesh: THREE.Object3D, x: number, y: number, z: number) {
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  /** Raccourci : une piece posee directement sur l'arme. */
  function add(mesh: THREE.Object3D, x: number, y: number, z: number) {
    return put(body, mesh, x, y, z);
  }

  /**
   * Une main gantee, doigts replies autour de ce qu'elle tient, avec le
   * poignet et la manche qui repartent vers l'epaule. L'origine est le centre
   * de la prise ; les doigts s'enroulent autour de l'axe Y (une poignee
   * verticale). Pour un garde-main horizontal, on tourne la main d'un quart
   * de tour autour de X.
   */
  function buildHand(): THREE.Group {
    const h = new THREE.Group();
    put(h, box(0.088, 0.12, 0.055, glove), 0.012, 0, 0.06); // dos de la main
    put(h, box(0.076, 0.105, 0.055, glove), 0.004, -0.004, 0.008); // paume
    for (let i = 0; i < 4; i++) {
      const y = 0.042 - i * 0.031;
      const seg = put(h, box(0.058, 0.028, 0.088, glove), 0.014, y, -0.012);
      seg.rotation.x = -0.26 - i * 0.05;
      const tip = put(h, box(0.052, 0.026, 0.05, glove), 0.014, y - 0.026, -0.058);
      tip.rotation.x = -1.05;
      // Fente sombre entre deux doigts : sans elle, la main est un bloc.
      if (i < 3) put(h, box(0.06, 0.005, 0.09, gloveDark), 0.014, y - 0.016, -0.014);
    }
    const thumb = put(h, box(0.032, 0.03, 0.095, glove), -0.032, 0.032, 0.005);
    thumb.rotation.set(-0.3, 0, 0.45);
    const wrist = put(h, tube(0.046, 0.08, gloveDark, 8), 0.02, -0.02, 0.1);
    wrist.rotation.x = Math.PI / 2 + 0.2;
    // Manche : courte et sombre. Un avant-bras long occupait la moitie de
    // l'ecran en visee — on n'en garde que le depart, comme dans un vrai FPS.
    const cuff = put(h, tube(0.056, 0.04, gloveDark, 8), 0.024, -0.04, 0.145);
    cuff.rotation.x = Math.PI / 2 + 0.25;
    const arm = put(h, tube(0.05, 0.18, sleeve, 8, 0.058), 0.03, -0.075, 0.24);
    arm.rotation.x = Math.PI / 2 + 0.28;
    return h;
  }

  /** Longueur du canon : elle fixe ou se place l'eclair de bouche. */
  let muzzleZ = -0.6;
  /** Hauteur de la ligne de mire : en visee, on l'amene au centre de l'ecran. */
  let sightY = 0.07;
  /** Rechargement : chargeur, cartouches une a une, barillet, bascule, projectile. */
  let reloadStyle: ReloadStyle = "chargeur";

  // Pieces mobiles, remplies par chaque arme.
  let slide: THREE.Object3D | null = null;
  let pump: THREE.Object3D | null = null;
  let bolt: THREE.Object3D | null = null;
  let mag: THREE.Object3D | null = null;
  /** Barillet du revolver : il tourne d'un sixieme de tour a chaque coup. */
  let drum: THREE.Object3D | null = null;
  /** Canons du fusil double : ils basculent autour de la charniere. */
  let barrels: THREE.Object3D | null = null;
  /** Hauteur du canon, la ou part l'eclair de bouche. */
  let muzzleY = 0.014;
  const rightHand = buildHand();
  const leftHand = buildHand();

  // Fenetre d'ejection : chaque arme la place (et la rattache a sa culasse
  // quand celle-ci bouge), la scene y fait naitre les douilles.
  const ejectPort = new THREE.Object3D();
  let ejectParent: THREE.Object3D = body;
  ejectPort.position.set(0.045, 0.02, 0);
  let casing: CasingKind = "laiton";
  /**
   * Rechargement au coup par coup : ou la main gauche apporte les munitions,
   * dans le repere de son parent (la pompe, les canons ou l'arme).
   */
  const dipPort = new THREE.Vector3();
  /** Ce que la main gauche tient en revenant : cartouche, chargeur rapide. */
  let carry: THREE.Object3D | null = null;
  /** La culasse se manoeuvre a la main gauche en fin de rechargement. */
  let rackHand = false;

  /** Pontet et queue de detente, communs a toutes les armes. */
  function triggerGuard(y: number, z: number) {
    add(box(0.052, 0.014, 0.085, dark), 0, y - 0.05, z);
    add(box(0.05, 0.05, 0.014, dark), 0, y - 0.028, z - 0.04);
    add(box(0.014, 0.042, 0.016, metal), 0, y - 0.022, z + 0.012);
  }
  /** Crosse pistolet : le bloc que la main droite empoigne. */
  function pistolGrip(x: number, y: number, z: number, tilt: number, mat: THREE.Material, w = 0.07, h = 0.2) {
    const g = add(box(w, h, 0.095, mat), x, y, z);
    g.rotation.x = tilt;
    return g;
  }

  switch (id) {
    case "poings": {
      // Deux poings en garde, le droit devant : c'est lui qui frappe.
      put(body, rightHand, 0.02, -0.06, -0.08).rotation.set(0.35, -0.25, -0.2);
      put(body, leftHand, -0.34, -0.1, 0.02).rotation.set(0.45, 0.35, 0.25);
      muzzleZ = -0.2;
      sightY = 0.05;
      break;
    }

    case "pistolet": {
      // --- Culasse mobile ---
      slide = new THREE.Group();
      add(slide as THREE.Group, 0, 0, 0);
      put(slide, box(0.072, 0.075, 0.3, steel), 0, 0.028, -0.05);
      for (let i = 0; i < 5; i++) put(slide, box(0.076, 0.05, 0.008, metal), 0, 0.028, 0.05 + i * 0.016);
      put(slide, box(0.03, 0.038, 0.085, dark), 0.038, 0.035, -0.02); // fenetre d'ejection
      // La douille sort de la fenetre, qui recule avec la culasse.
      ejectParent = slide;
      ejectPort.position.set(0.05, 0.04, -0.02);
      rackHand = true;
      put(slide, box(0.014, 0.024, 0.014, dark), 0, 0.075, -0.185); // guidon
      put(slide, box(0.006, 0.008, 0.006, white), 0, 0.082, -0.19);
      for (const sx of [-0.024, 0.024]) {
        put(slide, box(0.014, 0.022, 0.018, dark), sx, 0.073, 0.075);
        put(slide, box(0.005, 0.007, 0.005, white), sx, 0.079, 0.066);
      }
      put(slide, tube(0.015, 0.06, dark), 0, 0.028, -0.2);
      // --- Carcasse ---
      add(box(0.066, 0.055, 0.26, polymer), 0, -0.03, -0.02);
      add(box(0.05, 0.03, 0.09, dark), 0, -0.05, -0.16); // rail sous le canon
      triggerGuard(-0.03, 0.005);
      pistolGrip(0, -0.145, 0.055, -0.16, polymer);
      // --- Chargeur (tombe au rechargement) ---
      mag = new THREE.Group();
      add(mag as THREE.Group, 0, 0, 0);
      const pmag = put(mag, box(0.052, 0.2, 0.08, metal), 0, -0.15, 0.055);
      pmag.rotation.x = -0.16;
      const pbase = put(mag, box(0.066, 0.02, 0.095, dark), 0, -0.248, 0.07);
      pbase.rotation.x = -0.16;
      muzzleZ = -0.24;
      sightY = 0.075;
      // Deux mains : la gauche vient soutenir la droite, comme au stand.
      put(body, rightHand, 0.01, -0.15, 0.06).rotation.set(-0.16, 0, 0);
      put(body, leftHand, -0.062, -0.185, 0.02).rotation.set(-0.16, 0.6, 0.4);
      break;
    }

    case "mitraillette": {
      add(box(0.082, 0.1, 0.36, polymer), 0, 0, 0);
      add(box(0.036, 0.018, 0.3, dark), 0, 0.058, -0.02); // rail
      for (let i = 0; i < 7; i++) add(box(0.04, 0.026, 0.012, metal), 0, 0.06, -0.14 + i * 0.045);
      // Poignee d'armement, qui recule avec la culasse.
      slide = new THREE.Group();
      add(slide as THREE.Group, 0, 0, 0);
      put(slide, box(0.022, 0.022, 0.06, steel), -0.052, 0.035, 0.05);
      put(slide, box(0.05, 0.03, 0.02, metal), -0.03, 0.035, 0.07);
      // Garde-main ajoure.
      add(box(0.08, 0.078, 0.2, metal), 0, -0.018, -0.25);
      for (let i = 0; i < 3; i++) {
        add(box(0.086, 0.02, 0.05, dark), 0, 0.005, -0.31 + i * 0.06);
      }
      add(tube(0.016, 0.26, steel), 0, 0.012, -0.3);
      add(tube(0.023, 0.06, metal, 10), 0, 0.012, -0.45);
      put(body, ring(0.028, 0.006, dark), 0, 0.055, -0.36); // guidon annulaire
      put(body, ring(0.022, 0.006, dark), 0, 0.06, 0.13); // dioptre arriere
      // Chargeur droit et long, legerement incline.
      mag = new THREE.Group();
      add(mag as THREE.Group, 0, 0, 0);
      const smag = put(mag, box(0.058, 0.3, 0.078, metal), 0, -0.2, -0.05);
      smag.rotation.x = 0.2;
      for (let i = 0; i < 4; i++) {
        const rib = put(mag, box(0.062, 0.012, 0.082, dark), 0, -0.1 - i * 0.06, -0.038 - i * 0.012);
        rib.rotation.x = 0.2;
      }
      pistolGrip(0, -0.15, 0.09, -0.2, polymer, 0.068, 0.185);
      triggerGuard(-0.04, 0.05);
      // Crosse telescopique.
      for (const sx of [-0.032, 0.032]) add(tube(0.011, 0.22, metal), sx, 0.005, 0.25);
      add(box(0.09, 0.115, 0.03, polymer), 0, -0.005, 0.36);
      muzzleZ = -0.47;
      sightY = 0.06;
      ejectPort.position.set(0.048, 0.02, -0.02);
      rackHand = true;
      put(body, rightHand, 0.01, -0.15, 0.1).rotation.set(-0.2, 0, 0);
      put(body, leftHand, -0.01, -0.075, -0.25).rotation.set(Math.PI / 2 - 0.15, 0.2, 0.25);
      break;
    }

    case "fusil": {
      add(box(0.088, 0.105, 0.42, metal), 0, 0, -0.02);
      add(box(0.038, 0.018, 0.44, dark), 0, 0.062, -0.04);
      for (let i = 0; i < 9; i++) add(box(0.042, 0.026, 0.012, dark), 0, 0.064, -0.22 + i * 0.045);
      // Viseur point rouge : c'est lui qu'on amene au centre en visee. Son
      // embase reste basse, sinon elle bouchait le bas de l'anneau et on ne
      // voyait plus rien a travers.
      add(box(0.05, 0.024, 0.075, dark), 0, 0.078, 0.06);
      put(body, ring(0.032, 0.006, dark), 0, 0.128, 0.03);
      put(body, ring(0.032, 0.006, dark), 0, 0.128, 0.09);
      const dot = add(new THREE.Mesh(keep(new THREE.SphereGeometry(0.009, 6, 5)), accent), 0, 0.128, 0.055);
      dot.name = "dot";
      // Garde-main ajoure et bloc de gaz.
      add(box(0.076, 0.082, 0.26, sable), 0, -0.012, -0.32);
      for (let i = 0; i < 4; i++) add(box(0.082, 0.018, 0.045, dark), 0, -0.012, -0.42 + i * 0.058);
      add(box(0.032, 0.032, 0.05, metal), 0, 0.05, -0.43);
      add(tube(0.015, 0.22, steel), 0, 0.012, -0.5);
      const brake = add(tube(0.026, 0.08, metal, 10), 0, 0.012, -0.62);
      brake.name = "brake";
      for (let i = 0; i < 3; i++) add(box(0.056, 0.012, 0.012, dark), 0, 0.012, -0.6 + i * 0.022);
      // Chargeur courbe : deux troncons legerement inclines.
      mag = new THREE.Group();
      add(mag as THREE.Group, 0, 0, 0);
      const m1 = put(mag, box(0.056, 0.18, 0.078, sable), 0, -0.13, -0.02);
      m1.rotation.x = 0.12;
      const m2 = put(mag, box(0.052, 0.14, 0.072, sable), 0, -0.27, -0.055);
      m2.rotation.x = 0.4;
      pistolGrip(0, -0.16, 0.12, -0.22, sable, 0.072, 0.2);
      triggerGuard(-0.05, 0.08);
      // Poignee d'armement laterale, solidaire de la culasse.
      slide = new THREE.Group();
      add(slide as THREE.Group, 0, 0, 0);
      put(slide, box(0.06, 0.022, 0.024, metal), -0.02, 0.056, 0.185);
      // Crosse reglable avec appui-joue.
      add(tube(0.028, 0.24, metal), 0, -0.01, 0.28);
      // Crosse ajouree : deux montants et un appui-joue, pas un pave.
      add(box(0.056, 0.036, 0.16, sable), 0, 0.048, 0.34);
      add(box(0.056, 0.036, 0.16, sable), 0, -0.078, 0.34);
      add(box(0.02, 0.09, 0.03, sable), 0, -0.015, 0.29);
      add(box(0.062, 0.145, 0.032, dark), 0, -0.015, 0.425);
      muzzleZ = -0.67;
      sightY = 0.128;
      ejectPort.position.set(0.05, 0.02, 0.02);
      rackHand = true;
      put(body, rightHand, 0.01, -0.16, 0.13).rotation.set(-0.22, 0, 0);
      put(body, leftHand, -0.012, -0.075, -0.33).rotation.set(Math.PI / 2 - 0.1, 0.25, 0.3);
      break;
    }

    case "pompe": {
      add(box(0.1, 0.12, 0.26, metal), 0, 0, 0.03);
      add(box(0.104, 0.03, 0.26, steel), 0, 0.05, 0.03); // nervure superieure
      add(box(0.034, 0.045, 0.1, dark), 0.052, 0.01, 0.02); // fenetre d'ejection
      add(tube(0.032, 0.52, metal, 10), 0, 0.04, -0.42);
      add(tube(0.024, 0.44, steel), 0, -0.018, -0.38); // tube magasin
      // La pompe : elle coulisse apres chaque coup, la main gauche dessus.
      pump = new THREE.Group();
      add(pump as THREE.Group, 0, -0.015, -0.3);
      put(pump, box(0.082, 0.088, 0.17, wood), 0, 0, 0);
      for (let i = 0; i < 5; i++) put(pump, box(0.086, 0.012, 0.014, dark), 0, 0.01 - i * 0.022, 0);
      // Crosse en noyer, avec cartouches de rechange sur le cote.
      const stock = add(box(0.085, 0.115, 0.28, wood), 0, -0.07, 0.3);
      stock.rotation.x = 0.12;
      add(box(0.072, 0.105, 0.13, wood), 0, -0.06, 0.16);
      add(box(0.095, 0.13, 0.035, dark), 0, -0.095, 0.44);
      for (let i = 0; i < 4; i++) {
        const shell = add(tube(0.016, 0.055, i % 2 === 0 ? brass : accent), 0.056, -0.03 - i * 0.008, 0.24 + i * 0.05);
        shell.rotation.x = Math.PI / 2 + 0.1;
      }
      triggerGuard(-0.03, 0.12);
      add(new THREE.Mesh(keep(new THREE.SphereGeometry(0.012, 6, 5)), brass), 0, 0.078, -0.66); // guidon bille
      muzzleZ = -0.74;
      sightY = 0.078;
      reloadStyle = "cartouches";
      casing = "coque";
      ejectPort.position.set(0.058, 0.01, 0.02);
      // Les cartouches entrent par la trappe sous la carcasse ; la main est
      // fille de la pompe, d'ou le decalage.
      dipPort.set(0, -0.1, 0.02).sub(pump.position);
      carry = put(leftHand, tube(0.016, 0.06, shellRed), 0, -0.012, -0.035);
      put(body, rightHand, 0.01, -0.125, 0.16).rotation.set(-0.12, 0, 0);
      // La main gauche est fille de la pompe : elle coulisse avec elle.
      put(pump, leftHand, -0.012, -0.055, 0.01).rotation.set(Math.PI / 2 - 0.12, 0.2, 0.2);
      break;
    }

    case "revolver": {
      add(box(0.062, 0.075, 0.15, steel), 0, 0.02, 0);
      add(tube(0.022, 0.27, steel, 10), 0, 0.034, -0.2);
      add(box(0.02, 0.022, 0.27, metal), 0, 0.064, -0.2); // nervure du canon
      add(box(0.012, 0.028, 0.014, dark), 0, 0.085, -0.32); // guidon
      add(box(0.006, 0.008, 0.006, white), 0, 0.094, -0.325);
      add(box(0.032, 0.014, 0.02, dark), 0, 0.068, 0.06); // cran de mire
      add(tube(0.012, 0.2, metal), 0, 0.002, -0.18); // tige d'ejecteur
      drum = new THREE.Group();
      add(drum as THREE.Group, 0, 0.022, -0.02);
      put(drum, tube(0.05, 0.1, metal, 6), 0, 0, 0);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        put(drum, box(0.014, 0.014, 0.102, dark), Math.cos(a) * 0.046, Math.sin(a) * 0.046, 0);
      }
      const hammer = add(box(0.016, 0.042, 0.03, dark), 0, 0.066, 0.078);
      hammer.rotation.x = -0.45;
      triggerGuard(-0.005, 0.02);
      pistolGrip(0, -0.115, 0.09, -0.38, wood, 0.058, 0.17);
      muzzleZ = -0.35;
      muzzleY = 0.034;
      sightY = 0.09;
      // Le barillet bascule a gauche, les douilles tombent, un chargeur rapide
      // remet les six balles d'un coup.
      reloadStyle = "barillet";
      ejectParent = drum;
      ejectPort.position.set(0, 0, 0.055);
      dipPort.set(-0.075, -0.01, 0.075);
      carry = put(leftHand, tube(0.042, 0.035, brass, 6), 0, -0.012, -0.04);
      put(body, rightHand, 0.01, -0.125, 0.1).rotation.set(-0.38, 0, 0);
      put(body, leftHand, -0.062, -0.155, 0.06).rotation.set(-0.32, 0.6, 0.4);
      break;
    }

    case "pm": {
      add(box(0.078, 0.1, 0.26, metal), 0, 0, -0.02);
      add(box(0.07, 0.03, 0.2, dark), 0, 0.062, -0.02);
      add(tube(0.015, 0.1, steel), 0, 0.01, -0.2);
      add(tube(0.022, 0.04, dark, 8), 0, 0.01, -0.255);
      put(body, ring(0.02, 0.005, dark), 0, 0.09, -0.12);
      add(box(0.03, 0.02, 0.02, dark), 0, 0.086, 0.08);
      // Levier d'armement sur le dessus : il claque en arriere a chaque coup.
      slide = new THREE.Group();
      add(slide as THREE.Group, 0, 0, 0);
      put(slide, box(0.024, 0.022, 0.04, steel), 0, 0.087, 0.02);
      pistolGrip(0, -0.12, 0.03, -0.08, polymer, 0.066, 0.17);
      // Chargeur dans la poignee, qui depasse longuement dessous.
      mag = new THREE.Group();
      add(mag as THREE.Group, 0, 0, 0);
      put(mag, box(0.05, 0.3, 0.06, steel), 0, -0.2, 0.036).rotation.x = -0.08;
      put(mag, box(0.058, 0.022, 0.07, dark), 0, -0.352, 0.048).rotation.x = -0.08;
      triggerGuard(-0.04, -0.04);
      // Crosse en fil d'acier, repliee le long du boitier.
      for (const sx of [-0.046, 0.046]) add(tube(0.007, 0.26, steel), sx, 0.01, 0.1);
      add(box(0.1, 0.012, 0.02, steel), 0, 0.01, 0.23);
      muzzleZ = -0.29;
      muzzleY = 0.01;
      sightY = 0.095;
      ejectPort.position.set(0.045, 0.03, -0.02);
      rackHand = true;
      put(body, rightHand, 0.01, -0.12, 0.035).rotation.set(-0.08, 0, 0);
      put(body, leftHand, -0.012, -0.07, -0.13).rotation.set(Math.PI / 2 - 0.15, 0.2, 0.25);
      break;
    }

    case "mitrailleuse": {
      add(box(0.11, 0.13, 0.48, metal), 0, 0, 0);
      add(box(0.115, 0.03, 0.3, steel), 0, 0.078, 0.02); // couvercle d'alimentation
      add(tube(0.03, 0.62, metal, 10), 0, 0.02, -0.52);
      // Ailettes de refroidissement autour du canon.
      for (let i = 0; i < 5; i++) add(tube(0.038, 0.02, dark, 10), 0, 0.02, -0.34 - i * 0.06);
      add(tube(0.035, 0.08, dark, 10), 0, 0.02, -0.86);
      // Poignee de transport.
      add(box(0.02, 0.07, 0.02, dark), 0, 0.12, -0.24);
      add(box(0.02, 0.07, 0.02, dark), 0, 0.12, -0.08);
      add(box(0.024, 0.02, 0.2, polymer), 0, 0.158, -0.16);
      add(box(0.014, 0.05, 0.016, dark), 0, 0.075, -0.8); // guidon
      add(box(0.036, 0.03, 0.02, dark), 0, 0.105, 0.15); // hausse
      add(box(0.092, 0.075, 0.24, polymer), 0, -0.04, -0.3);
      for (const sx of [-0.032, 0.032]) {
        const leg = add(tube(0.01, 0.3, dark), sx, -0.055, -0.62);
        leg.rotation.x = Math.PI / 2 + 0.12;
      }
      // Boite a munitions a gauche, et la bande de cartouches qui entre.
      mag = new THREE.Group();
      add(mag as THREE.Group, 0, 0, 0);
      put(mag, box(0.13, 0.17, 0.15, olive), -0.03, -0.15, 0.02);
      for (let i = 0; i < 6; i++) put(mag, box(0.012, 0.012, 0.05, brass), -0.1 + i * 0.013, -0.045, 0.02);
      slide = new THREE.Group();
      add(slide as THREE.Group, 0, 0, 0);
      put(slide, box(0.05, 0.022, 0.026, steel), 0.07, 0.02, -0.05);
      pistolGrip(0, -0.17, 0.17, -0.22, polymer, 0.074, 0.2);
      triggerGuard(-0.065, 0.12);
      add(box(0.08, 0.14, 0.28, polymer), 0, -0.03, 0.4);
      add(box(0.086, 0.15, 0.03, dark), 0, -0.03, 0.555);
      muzzleZ = -0.92;
      muzzleY = 0.02;
      sightY = 0.105;
      reloadStyle = "chargeur";
      casing = "long";
      ejectPort.position.set(0.062, -0.01, -0.02);
      rackHand = true;
      put(body, rightHand, 0.01, -0.17, 0.18).rotation.set(-0.22, 0, 0);
      put(body, leftHand, -0.012, -0.1, -0.3).rotation.set(Math.PI / 2 - 0.1, 0.25, 0.3);
      break;
    }

    case "carabine": {
      add(box(0.08, 0.1, 0.4, metal), 0, 0, 0);
      add(tube(0.018, 0.5, steel, 10), 0, 0.012, -0.44);
      add(tube(0.028, 0.06, dark, 10), 0, 0.012, -0.72);
      // Lunette compacte, grossissement x2.
      add(tube(0.034, 0.22, dark, 12), 0, 0.12, -0.02);
      add(tube(0.043, 0.05, dark, 12), 0, 0.12, -0.14);
      for (const z of [-0.07, 0.04]) add(box(0.026, 0.05, 0.026, metal), 0, 0.075, z);
      const smallLens = keep(new THREE.MeshBasicMaterial({ map: keep(makeScopeLensTexture()) }));
      add(new THREE.Mesh(keep(new THREE.CircleGeometry(0.032, 14)), smallLens), 0, 0.12, 0.092);
      // Bois pour le garde-main et la crosse : c'est une arme de chasseur.
      add(box(0.074, 0.08, 0.3, wood), 0, -0.015, -0.3);
      const dstock = add(box(0.07, 0.13, 0.32, wood), 0, -0.05, 0.36);
      dstock.rotation.x = 0.1;
      add(box(0.074, 0.14, 0.03, dark), 0, -0.07, 0.52);
      slide = new THREE.Group();
      add(slide as THREE.Group, 0, 0, 0);
      put(slide, box(0.05, 0.02, 0.022, steel), 0.05, 0.03, 0.08);
      mag = new THREE.Group();
      add(mag as THREE.Group, 0, 0, 0);
      put(mag, box(0.05, 0.14, 0.09, metal), 0, -0.11, -0.04);
      pistolGrip(0, -0.15, 0.15, -0.3, wood, 0.068, 0.18);
      triggerGuard(-0.05, 0.1);
      muzzleZ = -0.76;
      muzzleY = 0.012;
      sightY = 0.12;
      casing = "long";
      ejectPort.position.set(0.046, 0.02, 0.04);
      rackHand = true;
      put(body, rightHand, 0.01, -0.15, 0.16).rotation.set(-0.3, 0, 0);
      put(body, leftHand, -0.012, -0.07, -0.3).rotation.set(Math.PI / 2 - 0.1, 0.22, 0.28);
      break;
    }

    case "sniper": {
      add(box(0.085, 0.11, 0.42, dark), 0, 0, 0.02);
      add(tube(0.026, 0.62, metal, 10), 0, 0.012, -0.5);
      for (let i = 0; i < 4; i++) {
        const flute = add(box(0.01, 0.01, 0.4, steel), Math.cos((i / 4) * Math.PI * 2) * 0.024, 0.012 + Math.sin((i / 4) * Math.PI * 2) * 0.024, -0.46);
        flute.name = "flute";
      }
      add(tube(0.036, 0.09, steel, 10), 0, 0.012, -0.86);
      for (let i = 0; i < 3; i++) add(box(0.078, 0.012, 0.014, dark), 0, 0.012, -0.84 + i * 0.024);
      // Lunette : corps, cloche avant, bagues, et le verre avec son reticule.
      add(tube(0.042, 0.34, dark, 12), 0, 0.14, -0.08);
      add(tube(0.052, 0.08, dark, 12), 0, 0.14, -0.26);
      add(tube(0.046, 0.06, dark, 12), 0, 0.14, 0.07);
      for (const z of [-0.02, 0.06]) {
        const r = put(body, ring(0.05, 0.012, metal), 0, 0.14, z);
        r.rotation.y = Math.PI / 2;
        r.rotation.x = Math.PI / 2;
      }
      add(box(0.03, 0.06, 0.03, metal), 0, 0.1, -0.02);
      add(box(0.03, 0.06, 0.03, metal), 0, 0.1, 0.06);
      add(tube(0.022, 0.05, metal), 0.045, 0.16, -0.08).rotation.z = Math.PI / 2; // tourelle
      const lensMat = keep(new THREE.MeshBasicMaterial({ map: keep(makeScopeLensTexture()) }));
      const lens = add(new THREE.Mesh(keep(new THREE.CircleGeometry(0.042, 16)), lensMat), 0, 0.14, 0.1);
      lens.name = "lens";
      const front = add(new THREE.Mesh(keep(new THREE.CircleGeometry(0.048, 16)), lensMat), 0, 0.14, -0.3);
      front.rotation.y = Math.PI;
      // Levier de culasse : il se releve et recule apres chaque tir.
      bolt = new THREE.Group();
      add(bolt as THREE.Group, 0.042, 0.02, 0.14);
      const lever = put(bolt, box(0.02, 0.02, 0.1, steel), 0.03, 0, 0.02);
      lever.rotation.y = -0.35;
      put(bolt, new THREE.Mesh(keep(new THREE.SphereGeometry(0.024, 8, 6)), steel), 0.062, 0, 0.06);
      // Crosse a trou de pouce, appui-joue reglable.
      // Crosse a trou de pouce : deux branches et un appui-joue.
      add(box(0.075, 0.05, 0.36, olive), 0, 0.02, 0.32);
      add(box(0.075, 0.055, 0.3, olive), 0, -0.115, 0.34);
      add(box(0.07, 0.11, 0.05, olive), 0, -0.05, 0.47);
      add(box(0.062, 0.05, 0.2, dark), 0, 0.055, 0.3);
      add(box(0.085, 0.17, 0.035, dark), 0, -0.05, 0.5);
      add(box(0.05, 0.06, 0.1, olive), 0, -0.135, 0.2);
      pistolGrip(0, -0.17, 0.17, -0.22, olive, 0.074, 0.21);
      triggerGuard(-0.06, 0.13);
      mag = new THREE.Group();
      add(mag as THREE.Group, 0, 0, 0);
      put(mag, box(0.052, 0.14, 0.11, metal), 0, -0.12, -0.05);
      // Bipied replie sous le canon.
      for (const sx of [-0.028, 0.028]) {
        const leg = add(tube(0.009, 0.22, dark), sx, -0.035, -0.5);
        leg.rotation.x = Math.PI / 2 + 0.25;
      }
      muzzleZ = -0.92;
      sightY = 0.14;
      casing = "long";
      ejectPort.position.set(0.048, 0.025, 0.08);
      put(body, rightHand, 0.01, -0.17, 0.18).rotation.set(-0.22, 0, 0);
      put(body, leftHand, -0.012, -0.07, -0.26).rotation.set(Math.PI / 2 - 0.1, 0.22, 0.28);
      break;
    }

    case "rafale": {
      // Boitier carene et compact, viseur holographique : un fusil moderne.
      add(box(0.09, 0.115, 0.44, polymer), 0, 0, 0.02);
      add(box(0.094, 0.028, 0.42, dark), 0, 0.068, 0);
      add(box(0.05, 0.024, 0.1, dark), 0, 0.082, 0.04); // embase du viseur
      put(body, ring(0.028, 0.006, dark), 0, 0.132, 0.04);
      add(new THREE.Mesh(keep(new THREE.SphereGeometry(0.008, 6, 5)), accent), 0, 0.132, 0.06).name = "dot";
      add(box(0.08, 0.085, 0.16, dark), 0, -0.01, -0.28);
      for (let i = 0; i < 3; i++) add(box(0.086, 0.014, 0.03, metal), 0, -0.01, -0.33 + i * 0.05);
      add(tube(0.017, 0.2, steel), 0, 0.012, -0.36);
      add(tube(0.026, 0.07, dark, 10), 0, 0.012, -0.48);
      slide = new THREE.Group();
      add(slide as THREE.Group, 0, 0, 0);
      put(slide, box(0.05, 0.02, 0.022, steel), -0.05, 0.03, -0.1);
      // Chargeur derriere la poignee (bullpup).
      mag = new THREE.Group();
      add(mag as THREE.Group, 0, 0, 0);
      put(mag, box(0.056, 0.19, 0.075, metal), 0, -0.13, 0.15).rotation.x = 0.1;
      pistolGrip(0, -0.15, -0.02, -0.2, polymer, 0.07, 0.19);
      triggerGuard(-0.05, -0.06);
      add(box(0.092, 0.14, 0.04, dark), 0, -0.02, 0.26);
      muzzleZ = -0.52;
      muzzleY = 0.012;
      sightY = 0.132;
      // Bullpup : la fenetre d'ejection est derriere la poignee.
      ejectPort.position.set(0.05, 0.02, 0.12);
      rackHand = true;
      put(body, rightHand, 0.01, -0.15, -0.01).rotation.set(-0.2, 0, 0);
      put(body, leftHand, -0.012, -0.075, -0.29).rotation.set(Math.PI / 2 - 0.1, 0.22, 0.28);
      break;
    }

    case "double": {
      // Deux canons cote a cote, bois vernis, deux chiens : l'arme de ferme.
      add(box(0.1, 0.1, 0.2, metal), 0, 0, 0.05);
      // Canons, bande et devant forment un bloc qui bascule autour de la
      // charniere, a l'avant de la bascule : c'est ainsi qu'on le recharge.
      const hy = -0.03;
      const hz = -0.05;
      const bar = new THREE.Group();
      barrels = bar;
      add(bar, 0, hy, hz);
      for (const sx of [-0.024, 0.024]) put(bar, tube(0.024, 0.62, steel, 10), sx, 0.035 - hy, -0.37 - hz);
      put(bar, box(0.02, 0.012, 0.6, metal), 0, 0.064 - hy, -0.36 - hz); // bande de visee
      put(bar, new THREE.Mesh(keep(new THREE.SphereGeometry(0.012, 6, 5)), brass), 0, 0.075 - hy, -0.66 - hz);
      put(bar, box(0.09, 0.07, 0.3, wood), 0, -0.012 - hy, -0.25 - hz); // devant
      // Les douilles sautent de la culasse ouverte, au-dessus de la charniere.
      ejectParent = bar;
      ejectPort.position.set(0, 0.035 - hy, -0.03 - hz);
      dipPort.set(0, 0.075 - hy, 0.02 - hz);
      add(box(0.066, 0.09, 0.14, wood), 0, -0.04, 0.17); // poignee anglaise
      const dstock = add(box(0.08, 0.12, 0.34, wood), 0, -0.075, 0.34);
      dstock.rotation.x = 0.14;
      add(box(0.09, 0.14, 0.03, dark), 0, -0.1, 0.5);
      for (const sx of [-0.028, 0.028]) {
        const hammer = add(box(0.014, 0.04, 0.026, dark), sx, 0.06, 0.13);
        hammer.rotation.x = -0.4;
      }
      triggerGuard(-0.03, 0.12);
      muzzleZ = -0.69;
      muzzleY = 0.035;
      sightY = 0.075;
      reloadStyle = "bascule";
      casing = "coque";
      carry = put(leftHand, tube(0.016, 0.06, shellRed), 0, -0.012, -0.035);
      put(body, rightHand, 0.01, -0.12, 0.17).rotation.set(-0.14, 0, 0);
      // La main gauche tient le devant : elle suit les canons quand ils basculent.
      put(bar, leftHand, -0.012, -0.075 - hy, -0.25 - hz).rotation.set(Math.PI / 2 - 0.12, 0.2, 0.2);
      break;
    }

    case "arbalete": {
      // Fut en bois, arc en travers, corde tendue et carreau pose dessus.
      add(box(0.07, 0.08, 0.62, wood), 0, 0, -0.1);
      add(box(0.03, 0.02, 0.5, metal), 0, 0.05, -0.15); // rail du carreau
      add(box(0.09, 0.05, 0.06, metal), 0, 0.02, -0.4); // etrier de l'arc
      // Les branches reculent vers le tireur : la corde est armee.
      add(box(0.34, 0.03, 0.045, dark), -0.17, 0.03, -0.4).rotation.y = 0.35;
      add(box(0.34, 0.03, 0.045, dark), 0.17, 0.03, -0.4).rotation.y = -0.35;
      const cord = keep(new THREE.MeshLambertMaterial({ color: 0xd9d2c0 }));
      add(box(0.46, 0.006, 0.006, cord), 0.165, 0.04, -0.18).rotation.y = 0.773;
      add(box(0.46, 0.006, 0.006, cord), -0.165, 0.04, -0.18).rotation.y = -0.773;
      // Le carreau : il part au tir et un neuf revient au rechargement.
      mag = new THREE.Group();
      add(mag as THREE.Group, 0, 0, 0);
      put(mag, tube(0.008, 0.42, steel), 0, 0.072, -0.22);
      put(mag, box(0.02, 0.02, 0.05, metal), 0, 0.072, -0.45);
      put(mag, box(0.002, 0.03, 0.06, accent), 0, 0.09, -0.02);
      put(mag, box(0.03, 0.002, 0.06, accent), 0, 0.072, -0.02);
      // Petit viseur et crosse.
      add(box(0.02, 0.04, 0.02, dark), 0, 0.08, 0.08);
      put(body, ring(0.022, 0.005, dark), 0, 0.11, 0.08);
      const cstock = add(box(0.07, 0.13, 0.26, wood), 0, -0.06, 0.33);
      cstock.rotation.x = 0.12;
      add(box(0.074, 0.14, 0.03, dark), 0, -0.08, 0.47);
      pistolGrip(0, -0.13, 0.13, -0.25, wood, 0.064, 0.17);
      triggerGuard(-0.04, 0.1);
      muzzleZ = -0.45;
      muzzleY = 0.07;
      sightY = 0.11;
      // Un carreau neuf, pose a la main sur le rail.
      reloadStyle = "projectile";
      dipPort.set(-0.02, -0.03, 0.02);
      put(body, rightHand, 0.01, -0.13, 0.13).rotation.set(-0.25, 0, 0);
      put(body, leftHand, -0.012, -0.065, -0.3).rotation.set(Math.PI / 2 - 0.1, 0.2, 0.25);
      break;
    }

    case "roquettes": {
      // Un tube sur l'epaule, deux poignees, la roquette depasse devant.
      // Le tube est avance : son culot pres de l'oeil bouchait le coin de l'ecran.
      add(tube(0.075, 0.95, olive, 14), 0, 0.02, -0.3);
      add(tube(0.085, 0.08, dark, 14), 0, 0.02, -0.76);
      add(tube(0.088, 0.08, dark, 14, 0.072), 0, 0.02, 0.18);
      for (const z of [-0.5, -0.1]) add(tube(0.08, 0.03, dark, 14), 0, 0.02, z);
      add(box(0.04, 0.07, 0.09, dark), -0.1, 0.07, -0.22); // viseur lateral
      add(box(0.012, 0.012, 0.012, accent), -0.1, 0.11, -0.22);
      add(box(0.05, 0.15, 0.05, dark), 0, -0.12, -0.26); // poignee avant
      pistolGrip(0, -0.14, 0.03, -0.15, dark, 0.07, 0.18);
      triggerGuard(-0.07, -0.01);
      mag = new THREE.Group();
      add(mag as THREE.Group, 0, 0, 0);
      put(mag, tube(0.052, 0.14, sable, 12), 0, 0.02, -0.82);
      const tip = put(mag, new THREE.Mesh(keep(new THREE.ConeGeometry(0.055, 0.17, 12)), olive), 0, 0.02, -0.97);
      tip.rotation.x = -Math.PI / 2;
      muzzleZ = -0.82;
      muzzleY = 0.02;
      sightY = 0.11;
      // Une roquette neuve, enfoncee par l'avant du tube.
      reloadStyle = "projectile";
      dipPort.set(-0.05, -0.07, 0.05);
      put(body, rightHand, 0.01, -0.14, 0.03).rotation.set(-0.15, 0, 0);
      put(body, leftHand, 0, -0.12, -0.26).rotation.set(-0.1, 0, 0);
      break;
    }
  }

  if (look.hands === false) {
    rightHand.visible = false;
    leftHand.visible = false;
  }

  // Visee sans lunette : la ligne de mire passe juste au-dessus de tout ce
  // qui se trouve dans l'axe (hausse, rail, poignee de transport). Sinon une
  // piece de l'arme bouchait le centre de l'ecran, la ou l'on vise. Les
  // anneaux de viseur sont creux : on regarde a travers.
  const bounds = new THREE.Box3();
  const isHandPart = (o: THREE.Object3D) => {
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === rightHand || p === leftHand) return true;
    return false;
  };
  group.updateMatrixWorld(true);
  if (!WEAPONS[id].zoomFov && !WEAPONS[id].melee) {
    let top = -Infinity;
    const optic: THREE.Object3D[] = [];
    body.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || isHandPart(o)) return;
      if (o.geometry instanceof THREE.TorusGeometry || o.name === "dot") {
        optic.push(o);
        return;
      }
      bounds.setFromObject(o);
      if (bounds.max.x < -0.025 || bounds.min.x > 0.025) return;
      top = Math.max(top, bounds.max.y);
    });
    // Le viseur doit rester AU-DESSUS de ce qui le porte : sinon on regardait
    // a travers l'anneau... et on ne voyait que le boitier de l'arme.
    const clair = top + 0.012;
    if (clair > sightY) {
      for (const o of optic) o.position.y += clair - sightY;
      sightY = clair;
    }
  }
  // En visee, la crosse passait juste devant l'oeil et bouchait le bas de
  // l'ecran : tout ce qui est derriere la poignee s'efface quand on epaule.
  const stockParts: THREE.Object3D[] = [];
  if (!WEAPONS[id].melee) {
    body.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || isHandPart(o)) return;
      bounds.setFromObject(o);
      if ((bounds.min.z + bounds.max.z) / 2 > 0.22) stockParts.push(o);
    });
  }

  // --- Eclair de bouche ---
  // Une etoile face a nous, deux flammes croisees le long du canon, et deux
  // jets lateraux pour les armes a frein de bouche. Melange additif : il
  // eclaire sans masquer, et ne coute rien quand il est eteint.
  const muzzle = MUZZLE[id];
  const flash = new THREE.Group();
  flash.position.set(0, id === "pistolet" ? 0.028 : muzzleY, muzzleZ);
  flash.visible = false;
  body.add(flash);
  /** Etoile et flammes : elles tournent au hasard a chaque coup. */
  const spin = new THREE.Group();
  flash.add(spin);
  /** Jets du frein de bouche : toujours sur les cotes. */
  const jets = new THREE.Group();
  flash.add(jets);
  const flashTex = acquireFlashTextures();
  let disposed = false;
  const starMat = keep(
    new THREE.MeshBasicMaterial({
      map: flashTex.star,
      color: muzzle.color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const flameMat = keep(
    new THREE.MeshBasicMaterial({
      map: flashTex.flame,
      color: muzzle.color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  // L'arbalete et les poings n'ont pas d'eclair : la corde claque, c'est tout.
  if (muzzle.star > 0) {
    const quad = keep(new THREE.PlaneGeometry(1, 1));
    // Flamme : sa base au canon, elle s'etire vers l'avant.
    const flameGeo = keep(new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0));
    const star = new THREE.Mesh(quad, starMat);
    star.scale.set(muzzle.star * 2, muzzle.star * 2, 1);
    star.position.z = -0.01;
    spin.add(star);
    for (let i = 0; i < 2; i++) {
      // Deux plans croises contenant l'axe du canon : une flamme en volume.
      const holder = new THREE.Group();
      holder.rotation.z = (i * Math.PI) / 2;
      const f = new THREE.Mesh(flameGeo, flameMat);
      f.rotation.y = Math.PI / 2;
      f.scale.set(muzzle.flame, muzzle.flame * 0.45, 1);
      holder.add(f);
      spin.add(holder);
    }
    if (muzzle.jets) {
      for (const side of [0, Math.PI]) {
        const j = new THREE.Mesh(flameGeo, flameMat);
        j.rotation.z = side;
        j.scale.set(muzzle.star * 1.3, muzzle.star * 0.45, 1);
        j.position.z = 0.045;
        jets.add(j);
      }
    }
  }
  let flashUntil = -1;
  let flashScale = 1;
  let flameStretch = 1;
  function fireFlash(time: number, aim: number) {
    if (muzzle.star <= 0) return;
    flashUntil = time + FLASH_SECONDS;
    spin.rotation.z = Math.random() * Math.PI * 2;
    // Jamais deux eclairs identiques ; en visee il se fait petit pour ne pas
    // cacher le point rouge.
    flashScale = (0.8 + Math.random() * 0.5) * (1 - aim * 0.5);
    flameStretch = 0.75 + Math.random() * 0.55;
  }

  // --- Reperes des gestes, pris sur l'arme au repos (repere du corps) ---
  group.updateMatrixWorld(true);
  const magCenter = new THREE.Vector3();
  if (mag) bounds.setFromObject(mag).getCenter(magCenter);
  const slideCenter = new THREE.Vector3();
  if (slide) bounds.setFromObject(slide).getCenter(slideCenter);
  // Projectile : la main l'apporte a sa place, sur le rail ou dans le tube.
  if (reloadStyle === "projectile") dipPort.add(magCenter);
  ejectParent.add(ejectPort);
  if (carry) carry.visible = false;

  // --- Fusion des pieces fixes ---
  // Chaque boite etait un appel de rendu : 50 a 90 par arme. On regroupe par
  // materiau tout ce qui bouge ensemble (le corps de l'arme, chaque piece
  // mobile, chaque main) : il en reste une quinzaine. La crosse, qui s'efface
  // en visee, est fusionnee a part.
  const units: THREE.Object3D[] = [body, rightHand, leftHand];
  for (const p of [slide, pump, bolt, mag, drum, barrels]) if (p) units.push(p);
  const unitSet = new Set(units);
  const stockSet = new Set(stockParts);
  const loose = new Set<THREE.Object3D>([flash, ejectPort]);
  if (carry) loose.add(carry);
  const stockGroup = new THREE.Group();
  const inv = new THREE.Matrix4();
  const rel = new THREE.Matrix4();
  function mergeInto(buckets: Map<THREE.Material, THREE.Mesh[]>, target: THREE.Object3D) {
    for (const [mat, meshes] of buckets) {
      if (meshes.length < 2) continue;
      const geos: THREE.BufferGeometry[] = [];
      for (const m of meshes) {
        rel.multiplyMatrices(inv, m.matrixWorld);
        geos.push(m.geometry.clone().applyMatrix4(rel));
      }
      const merged = mergeGeometries(geos, false);
      for (const g of geos) g.dispose();
      if (!merged) continue;
      target.add(new THREE.Mesh(keep(merged), mat));
      for (const m of meshes) m.removeFromParent();
    }
  }
  for (const unit of units) {
    inv.copy(unit.matrixWorld).invert();
    const buckets = new Map<THREE.Material, THREE.Mesh[]>();
    const stockBuckets = new Map<THREE.Material, THREE.Mesh[]>();
    const visit = (o: THREE.Object3D) => {
      for (const c of o.children) {
        if (unitSet.has(c) || loose.has(c)) continue;
        if (c instanceof THREE.Mesh && !Array.isArray(c.material) && c.children.length === 0) {
          const inStock = stockSet.has(c);
          // Une piece de crosse accrochee a une piece mobile reste a part.
          if (inStock && unit !== body) continue;
          const b = inStock ? stockBuckets : buckets;
          const list = b.get(c.material);
          if (list) list.push(c);
          else b.set(c.material, [c]);
        } else {
          visit(c);
        }
      }
    };
    visit(unit);
    mergeInto(buckets, unit);
    if (unit === body) mergeInto(stockBuckets, stockGroup);
  }
  body.add(stockGroup);
  // Ce qui s'efface en visee : la crosse fusionnee, et les pieces restees seules.
  const stockToggles: THREE.Object3D[] = [stockGroup];
  for (const p of stockParts) if (p.parent) stockToggles.push(p);

  // --- Bruits et douilles ---
  const spec = WEAPONS[id];
  const magSize = spec.magSize;
  const cycleCues: MechCue[] = pump
    ? [
        { at: 0.38, sound: "pumpBack" },
        { at: 0.42, eject: true },
        { at: 0.68, sound: "pumpFwd" },
      ]
    : bolt
      ? [
          { at: 0.26, sound: "boltOpen" },
          { at: 0.5, eject: true },
          { at: 0.72, sound: "boltClose" },
        ]
      : [];
  const ejectOnShot = !pump && !bolt && reloadStyle === "chargeur" && !spec.melee;
  /** Rechargement du sniper : la culasse s'ouvre et se referme sur cette fenetre. */
  const BOLT_T0 = 0.66;
  const BOLT_LEN = 0.24;

  function reloadCues(shells: number, empty: boolean): MechCue[] {
    const cues: MechCue[] = [];
    if (reloadStyle === "chargeur") {
      cues.push({ at: 0.2, sound: "magOut" }, { at: 0.62, sound: "magIn" });
      if (bolt) {
        cues.push({ at: BOLT_T0 + 0.26 * BOLT_LEN, sound: "boltOpen" }, { at: BOLT_T0 + 0.72 * BOLT_LEN, sound: "boltClose" });
      } else if (rackHand && slide) {
        cues.push({ at: 0.82, sound: "rack" });
      }
      return cues;
    }
    const plan = dipPlan(reloadStyle, shells, magSize, { n: 1, t0: 0, len: 1 });
    if (reloadStyle === "barillet") {
      cues.push({ at: 0.15, sound: "drumOpen" }, { at: 0.3, eject: true }, { at: 0.78, sound: "drumClose" });
    } else if (reloadStyle === "bascule") {
      cues.push({ at: 0.13, sound: "breakOpen" }, { at: 0.22, eject: true }, { at: 0.8, sound: "breakClose" });
    }
    if (reloadStyle === "projectile") {
      // Ces deux bruits commencent avant le geste final : le clic tombe dessus.
      const rocket = id === "roquettes";
      cues.push({ at: plan.t0 + (rocket ? 0.72 : 0.55) * plan.len, sound: rocket ? "rocketLoad" : "arrowLoad" });
    } else {
      for (let i = 0; i < plan.n; i++) cues.push({ at: plan.t0 + (i + 0.85) * plan.len, sound: "shellIn" });
    }
    // Pompe vide : il faut encore chambrer la premiere cartouche.
    if (reloadStyle === "cartouches" && empty && pump) {
      cues.push({ at: 0.875, sound: "pumpBack" }, { at: 0.945, sound: "pumpFwd" });
    }
    cues.sort((a, b) => a.at - b.at);
    return cues;
  }

  // --- Etat de l'animation ---
  // Positions de repos des pieces mobiles : l'animation repart toujours d'ici.
  const slideZ = slide?.position.z ?? 0;
  const pumpZ = pump?.position.z ?? 0;
  const boltZ = bolt?.position.z ?? 0;
  const magRest = mag ? mag.position.clone() : new THREE.Vector3();
  const drumRest = drum ? drum.position.clone() : new THREE.Vector3();
  const leftBase = leftHand.position.clone();
  const leftRot = new THREE.Vector3(leftHand.rotation.x, leftHand.rotation.y, leftHand.rotation.z);
  const rightBase = rightHand.position.clone();
  const rightRot = new THREE.Vector3(rightHand.rotation.x, rightHand.rotation.y, rightHand.rotation.z);
  let drumTarget = 0;
  let drumSpun = false;
  let lastRecoil = 0;
  let lastTime = -1;
  let tiltShown = 0;
  // Vecteurs de travail : rien n'est alloue pendant la partie.
  const handPos = new THREE.Vector3();
  const handRot = new THREE.Vector3();
  const dipDown = new THREE.Vector3();
  const knob = new THREE.Vector3();
  const planTmp: DipPlan = { n: 1, t0: 0, len: 1 };

  /**
   * Chargeur : la main gauche va au chargeur, le tire vers le bas (hors
   * champ), revient avec un neuf, le claque en place, puis manoeuvre la
   * culasse s'il y en a une. Des positions-cles, reliees en douceur.
   */
  interface HandKey {
    t: number;
    p: THREE.Vector3;
    r: THREE.Vector3;
  }
  const magKeys: HandKey[] = [];
  const magGrip = magCenter.clone().add(new THREE.Vector3(-0.045, -0.02, 0.02));
  if (reloadStyle === "chargeur" && mag && !spec.melee) {
    const gripRot = new THREE.Vector3(-0.15, 0.9, 0.25);
    const down = magGrip.clone().add(new THREE.Vector3(-0.08, -0.45, 0.16));
    const under = magGrip.clone().add(new THREE.Vector3(0, -0.08, 0.01));
    const k = (t: number, p: THREE.Vector3, r: THREE.Vector3) => magKeys.push({ t, p, r });
    k(0, leftBase, leftRot);
    k(0.06, leftBase, leftRot);
    k(0.16, magGrip, gripRot);
    k(0.33, down, gripRot);
    k(0.41, down, gripRot);
    k(0.55, under, gripRot);
    k(0.63, magGrip, gripRot);
    if (rackHand && slide) {
      // La poignee d'armement, du cote ou elle se trouve sur l'arme.
      const side = slideCenter.x > 0.01 ? 1 : -1;
      const handle = slideCenter.clone().add(new THREE.Vector3(side * 0.05, 0, 0.03));
      const pulled = handle.clone().add(new THREE.Vector3(0, 0, 0.055));
      const handleRot = new THREE.Vector3(-0.15, -side * 0.9, -side * 0.25);
      k(0.72, handle, handleRot);
      k(0.78, handle, handleRot);
      k(0.8, pulled, handleRot);
      k(0.84, handle, handleRot);
      k(0.95, leftBase, leftRot);
    } else {
      k(0.8, leftBase, leftRot);
    }
    k(1, leftBase, leftRot);
  }

  function samplePath(keys: HandKey[], t: number) {
    const last = keys[keys.length - 1];
    if (t <= keys[0].t) {
      handPos.copy(keys[0].p);
      handRot.copy(keys[0].r);
      return;
    }
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i];
      const b = keys[i + 1];
      if (t < b.t) {
        const k = ramp(t, a.t, b.t);
        handPos.lerpVectors(a.p, b.p, k);
        handRot.lerpVectors(a.r, b.r, k);
        return;
      }
    }
    handPos.copy(last.p);
    handRot.copy(last.r);
  }

  /**
   * Coup par coup : `n` allers-retours de la main gauche, chacun va chercher
   * une munition sous l'arme puis la pousse au point `dipPort`. Vrai tant
   * que la main tient quelque chose.
   */
  function dip(t: number, n: number, t0: number, len: number): boolean {
    if (t < t0) return false;
    const i = Math.floor((t - t0) / len);
    if (i >= n) {
      const end = t0 + n * len;
      handPos.lerpVectors(dipPort, leftBase, ramp(t, end, end + 0.08));
      return false;
    }
    const u = (t - t0) / len - i;
    dipDown.copy(dipPort).add(DIP_DOWN);
    const from = i === 0 ? leftBase : dipPort;
    if (u < 0.45) {
      handPos.lerpVectors(from, dipDown, ramp(u, 0, 0.45));
      return false;
    }
    if (u < 0.85) {
      handPos.lerpVectors(dipDown, dipPort, ramp(u, 0.45, 0.85));
      return true;
    }
    handPos.copy(dipPort);
    handPos.z -= 0.025 * Math.sin(((u - 0.85) / 0.15) * Math.PI);
    return u < 0.9;
  }

  function update(anim: WeaponAnim) {
    const dt = lastTime < 0 ? 0 : Math.min(0.1, Math.max(0, anim.time - lastTime));
    lastTime = anim.time;
    const rec = clamp01(anim.recoil);
    const cyc = clamp01(anim.cycle ?? 1);
    const empty = anim.empty === true;
    const r = clamp01(anim.reload);
    const reloading = r > 0;
    const shells = anim.shells ?? magSize;
    const showStock = anim.aim < 0.5;
    for (const p of stockToggles) p.visible = showStock;

    // --- Eclair : trois images, de plus en plus petit ---
    const fk = flashUntil > anim.time ? (flashUntil - anim.time) / FLASH_SECONDS : 0;
    flash.visible = fk > 0;
    if (fk > 0) {
      const s = flashScale * (0.6 + 0.4 * fk);
      spin.scale.set(s, s, s * flameStretch);
      jets.scale.setScalar(s);
      const o = Math.min(1, 0.35 + fk);
      starMat.opacity = o;
      flameMat.opacity = o;
    }

    // --- L'arme bascule vers l'interieur pendant le rechargement ---
    // Un rechargement interrompu (changement d'arme) revient en douceur.
    const tiltTarget = reloading ? hump(r, 0, 0.12, 0.85, 1) : 0;
    tiltShown = tiltTarget >= tiltShown ? tiltTarget : Math.max(tiltTarget, tiltShown - dt * 5);
    const tilt = tiltShown;
    let rx = 0;
    let rz = 0;
    let py = 0;

    // --- Culasse : recul a chaque coup, bloquee ouverte a vide (pistolet),
    // tiree puis relachee en fin de rechargement ---
    if (slide) {
      let back = rec * 0.055;
      if (reloading && reloadStyle === "chargeur") {
        back =
          empty && id === "pistolet"
            ? 0.055 * (1 - ramp(r, 0.81, 0.84))
            : 0.055 * hump(r, 0.78, 0.8, 0.81, 0.84);
      } else if (empty && id === "pistolet") {
        back = 0.055;
      }
      slide.position.z = slideZ + back;
    }

    // --- Barillet : un sixieme de tour par coup ; au rechargement il
    // bascule a gauche, l'arme se cabre, puis il se referme et tourne ---
    if (drum) {
      if (rec > lastRecoil + 0.5) drumTarget += Math.PI / 3;
      let open = 0;
      if (reloading && reloadStyle === "barillet") {
        open = hump(r, 0.12, 0.22, 0.7, 0.8);
        if (r > 0.76 && !drumSpun) {
          drumTarget += Math.PI * 2;
          drumSpun = true;
        }
        rx += 0.55 * hump(r, 0.2, 0.27, 0.32, 0.4);
      } else {
        drumSpun = false;
      }
      drum.rotation.z += (drumTarget - drum.rotation.z) * (1 - Math.exp(-dt * 22));
      drum.position.set(drumRest.x - open * 0.075, drumRest.y - open * 0.02, drumRest.z);
    }
    lastRecoil = rec;

    // --- Fusil double : les canons basculent autour de la charniere ---
    if (barrels) {
      barrels.rotation.x = reloading && reloadStyle === "bascule" ? -0.55 * hump(r, 0.1, 0.2, 0.74, 0.82) : 0;
    }

    // --- Pompe : un vrai aller-retour entre deux coups, cale sur la cadence ---
    if (pump) {
      let back = hump(cyc, 0.22, 0.42, 0.5, 0.72);
      if (reloading && empty) back = hump(r, 0.84, 0.88, 0.9, 0.95);
      pump.position.z = pumpZ + back * 0.15;
      rz -= back * 0.05;
      py -= back * 0.008;
    }

    // --- Verrou : leve, tire, repousse, rabattu ; la main droite le manoeuvre ---
    let onBolt = 0;
    if (bolt) {
      const c = reloading ? clamp01((r - BOLT_T0) / BOLT_LEN) : cyc;
      const lift = hump(c, 0.18, 0.3, 0.76, 0.86);
      const back = hump(c, 0.32, 0.5, 0.55, 0.74);
      bolt.rotation.z = lift * 1.1;
      bolt.position.z = boltZ + back * 0.11;
      onBolt = hump(c, 0.06, 0.18, 0.86, 0.97);
      if (onBolt > 0) {
        // Le pommeau du levier, la ou la main vient le saisir.
        knob.set(
          bolt.position.x + 0.062 * Math.cos(bolt.rotation.z),
          bolt.position.y + 0.062 * Math.sin(bolt.rotation.z),
          bolt.position.z + 0.06,
        );
        knob.y -= 0.045;
        knob.z += 0.035;
      }
      rz += onBolt * 0.08;
    }

    // --- Main gauche et munitions ---
    let holding = false;
    handPos.copy(leftBase);
    handRot.copy(leftRot);
    if (mag) {
      mag.position.copy(magRest);
      mag.visible = !(empty && reloadStyle === "projectile");
    }
    if (reloading) {
      if (reloadStyle === "chargeur") {
        if (magKeys.length > 0) samplePath(magKeys, r);
        if (mag && r > 0.16 && r < 0.63) {
          // Le chargeur suit la main : l'ancien sort, le neuf remonte. Il
          // disparait tout en bas, hors champ, le temps de l'echange.
          mag.position.set(
            magRest.x + handPos.x - magGrip.x,
            magRest.y + handPos.y - magGrip.y,
            magRest.z + handPos.z - magGrip.z,
          );
          mag.visible = handPos.y - magGrip.y > -0.3;
        }
        // Le chargeur neuf claque en place : l'arme sursaute un peu.
        const jolt = hump(r, 0.6, 0.63, 0.64, 0.7);
        py += 0.015 * jolt;
        rx += 0.05 * jolt;
      } else {
        const plan = dipPlan(reloadStyle, shells, magSize, planTmp);
        holding = dip(r, plan.n, plan.t0, plan.len);
        if (reloadStyle === "projectile" && mag) {
          // Pas de cartouche en main : c'est le carreau ou la roquette qui voyage.
          holding = false;
          const tCarry = plan.t0 + 0.45 * plan.len;
          const tSeat = plan.t0 + 0.85 * plan.len;
          if (r >= tCarry) {
            mag.visible = true;
            if (r < tSeat) {
              mag.position.set(
                magRest.x + handPos.x - dipPort.x,
                magRest.y + handPos.y - dipPort.y,
                magRest.z + handPos.z - dipPort.z,
              );
            }
          }
        }
      }
    }
    leftHand.position.copy(handPos);
    leftHand.rotation.set(handRot.x, handRot.y, handRot.z);
    if (carry) carry.visible = holding;

    // --- Main droite : sur la poignee, sauf pour manoeuvrer le verrou ---
    rightHand.position.copy(rightBase);
    rightHand.rotation.set(rightRot.x, rightRot.y, rightRot.z + onBolt * 0.35);
    if (onBolt > 0) rightHand.position.lerp(knob, onBolt);
    if (id === "poings") {
      // Le coup part en avant et un peu vers le centre, puis revient en garde.
      const punch = Math.sin((1 - rec) * Math.PI);
      rightHand.position.set(rightBase.x - punch * 0.12, rightBase.y + punch * 0.06, rightBase.z - punch * 0.34);
      leftHand.position.set(leftBase.x, leftBase.y + Math.sin(anim.time * 3) * 0.01, leftBase.z);
    }

    // --- Pose de l'arme : respiration et visee au repos, bascule en rechargement ---
    const calm = 1 - anim.aim * 0.85;
    const still = 1 - tilt;
    body.rotation.set(
      Math.sin(anim.time * 0.9) * 0.012 * calm * still + 0.16 * tilt + rx,
      Math.sin(anim.time * 0.7 + 1) * 0.016 * calm * still + 0.34 * tilt,
      -0.55 * tilt + rz,
    );
    // En visee, on monte l'arme pour poser la ligne de mire pile au centre
    // de l'ecran : AIM_SIGHT_Y est la hauteur, dans le modele, ou le viseur
    // tombe exactement sur l'axe de la camera (voir la constante). Elle
    // remonte un peu en rechargement : baissee, elle sortait du cadre.
    body.position.set(
      -0.06 * tilt,
      (Math.sin(anim.time * 1.3) * 0.004 * calm + anim.aim * (AIM_SIGHT_Y - sightY)) * still + 0.04 * tilt + py,
      0.07 * tilt,
    );
  }
  update({ time: 0, recoil: 0, reload: 0, aim: 0, sprint: 0 });

  return {
    group,
    flash,
    ejectPort,
    casing,
    ejectOnShot,
    flashLight: muzzle.light,
    reloadStyle,
    cycleCues,
    reloadCues,
    fireFlash,
    update,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const o of owned) o.dispose();
      releaseFlashTextures();
    },
  };
}
