// Cubes — le cycle du jour et de la nuit.
//
// Logique pure (aucun DOM) : a partir du temps de jeu, on calcule la position
// du soleil, les couleurs du ciel et les reglages des lumieres. La scene
// applique ces valeurs a ses lumieres, l'atmosphere (voxelAtmosphere.ts) les
// applique au ciel, et l'interface affiche l'heure.
//
// Principe d'eclairage : c'est le facteur `jour`, cuit dans le terrain (lumiere
// du ciel des sommets), qui assombrit la scene la nuit. Les lumieres
// dynamiques (soleil/lune, hemisphere) ne varient que peu : si elles
// baissaient fort, elles eteindraient aussi les zones eclairees par les torches.

import * as THREE from "three";

/** Duree d'un jour complet, en secondes de jeu (14 min). */
export const DAY_SECONDS = 840;

export interface SkyState {
  /** 0..1 dans la journee : 0 lever du soleil, 0.25 midi, 0.5 coucher, 0.75 minuit. */
  phase: number;
  /** Numero du jour (1 au depart). Change au lever du soleil. */
  day: number;
  /** Direction normalisee vers le soleil (monde, +Y en haut). La lune est a l'oppose. */
  sunDir: THREE.Vector3;
  /** Facteur de lumiere du ciel 0.16 (nuit) .. 1 (jour) : multiplie la lumiere du ciel cuite dans le terrain. */
  jour: number;
  isNight: boolean;
  /** Couleur du ciel au zenith. */
  zenith: THREE.Color;
  /** Couleur du ciel a l'horizon (aussi celle du brouillard et du fond). */
  horizon: THREE.Color;
  /** Lueur autour du soleil, intensite deja incluse (forte a l'aube et au crepuscule, noire la nuit). */
  glow: THREE.Color;
  /** Couleur de la DirectionalLight : soleil le jour, lune bleutee la nuit. */
  sunColor: THREE.Color;
  sunIntensity: number;
  /** Reglages de l'HemisphereLight. */
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  /** Opacite des etoiles 0..1. */
  starOpacity: number;
  /** Teinte des nuages (multiplie leurs couleurs de faces). */
  cloudColor: THREE.Color;
  /** Phase de la lune 0..7 : 0 pleine lune, 4 nouvelle lune. */
  moonPhase: number;
}

// Orbite du soleil decalee vers le haut : il passe plus de temps au-dessus de
// l'horizon qu'en dessous, la journee dure donc plus longtemps que la nuit
// (environ 8 min de jour, 6 min de nuit).
const ORBIT_LIFT = 0.2;
// Inclinaison vers +Z : a midi le soleil n'est pas pile au zenith, les faces
// verticales restent differenciees.
const ORBIT_TILT = 0.3;
/** Lumiere du ciel au plus noir de la nuit. */
const NIGHT_LIGHT = 0.16;
/** Elevation du soleil sous laquelle il fait « nuit » (monstres, interface). */
const NIGHT_BELOW = -0.04;

// Intensites de depart (a ajuster a l'oeil dans la scene).
const SUN_DAY = 2.2;
const MOON_NIGHT = 2.0;
const HEMI_DAY = 1.2;
const HEMI_NIGHT = 1.05;

// Palettes en sRGB, converties par THREE.Color dans l'espace lineaire de travail.
const DAY = {
  zenith: new THREE.Color("#3d86d8"),
  horizon: new THREE.Color("#bcdcf0"),
  halo: new THREE.Color("#fff3d2"),
  cloud: new THREE.Color("#ffffff"),
  light: new THREE.Color("#fff1d8"),
  hemiSky: new THREE.Color("#a9c8ff"),
  hemiGround: new THREE.Color("#6b6552"),
};
// Bleu nuit profond, jamais noir. La lumiere de lune garde une luminance proche
// de celle du soleil : seule la teinte change, le noir vient de `jour`.
const NIGHT = {
  zenith: new THREE.Color("#0b1634"),
  horizon: new THREE.Color("#1c2c52"),
  cloud: new THREE.Color("#2c3756"),
  light: new THREE.Color("#c8d6f6"),
  hemiSky: new THREE.Color("#a8bbee"),
  hemiGround: new THREE.Color("#57566a"),
};
// Aube rose-orangee, crepuscule plus orange.
const DAWN = {
  zenith: new THREE.Color("#5b73b5"),
  horizon: new THREE.Color("#f4a98c"),
  glow: new THREE.Color("#ff9f6e"),
  cloud: new THREE.Color("#ffd9cc"),
  light: new THREE.Color("#ffc79c"),
  hemiSky: new THREE.Color("#e2bcb4"),
  hemiGround: new THREE.Color("#6e5c52"),
};
const DUSK = {
  zenith: new THREE.Color("#4c5aa0"),
  horizon: new THREE.Color("#f39152"),
  glow: new THREE.Color("#ff7a2e"),
  cloud: new THREE.Color("#ffc096"),
  light: new THREE.Color("#ffad66"),
  hemiSky: new THREE.Color("#eab494"),
  hemiGround: new THREE.Color("#6e584a"),
};

// Couleur de travail reutilisee : aucune allocation par image.
const twilight = new THREE.Color();

function smooth(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Melange nuit -> jour selon `dayF`, puis vers la palette de crepuscule selon
 * `tw`, assombrie par `dim` quand le soleil est deja couche (le brouillard,
 * couleur horizon, ne doit pas rester vif sur un terrain presque noir).
 */
function blend(out: THREE.Color, night: THREE.Color, day: THREE.Color, dayF: number, dusk: THREE.Color, dawn: THREE.Color, morning: number, tw: number, dim = 1) {
  out.lerpColors(night, day, dayF);
  if (tw > 0) out.lerp(twilight.lerpColors(dusk, dawn, morning).multiplyScalar(dim), tw);
  return out;
}

/** Etat neuf (a creer une fois, puis a passer a skyState pour le mettre a jour). */
export function createSkyState(): SkyState {
  return {
    phase: 0, day: 1, sunDir: new THREE.Vector3(1, 0, 0), jour: 1, isNight: false,
    zenith: new THREE.Color(), horizon: new THREE.Color(), glow: new THREE.Color(),
    sunColor: new THREE.Color(), sunIntensity: SUN_DAY,
    hemiSky: new THREE.Color(), hemiGround: new THREE.Color(), hemiIntensity: HEMI_DAY,
    starOpacity: 0, cloudColor: new THREE.Color(), moonPhase: 0,
  };
}

/**
 * Etat du ciel a l'instant `time` (secondes de jeu depuis la creation du monde).
 * Passer `out` pour le reutiliser : rien n'est alloue dans ce cas.
 */
export function skyState(time: number, out: SkyState = createSkyState()): SkyState {
  const t = Number.isFinite(time) ? time : 0;
  const cycles = t / DAY_SECONDS;
  const whole = Math.floor(cycles);
  const phase = cycles - whole;
  out.phase = phase;
  out.day = Math.max(1, whole + 1);

  // Le soleil se leve a l'est (+X), culmine vers midi et se couche a l'ouest (-X).
  const angle = phase * Math.PI * 2;
  out.sunDir.set(Math.cos(angle), Math.sin(angle) + ORBIT_LIFT, ORBIT_TILT).normalize();
  const e = out.sunDir.y;

  // Poids : jour franc, crepuscule (cloche autour de l'horizon), matin ou soir.
  const dayF = smooth(-0.12, 0.3, e);
  const tw = smooth(-0.24, -0.01, e) * (1 - smooth(0.04, 0.36, e));
  const dim = 0.3 + 0.7 * smooth(-0.2, 0.02, e);
  const morning = smooth(-0.3, 0.3, out.sunDir.x);

  out.jour = NIGHT_LIGHT + (1 - NIGHT_LIGHT) * smooth(-0.15, 0.35, e);
  out.isNight = e < NIGHT_BELOW;

  blend(out.zenith, NIGHT.zenith, DAY.zenith, dayF, DUSK.zenith, DAWN.zenith, morning, tw * 0.55, dim);
  blend(out.horizon, NIGHT.horizon, DAY.horizon, dayF, DUSK.horizon, DAWN.horizon, morning, tw * 0.9, dim);
  blend(out.cloudColor, NIGHT.cloud, DAY.cloud, dayF, DUSK.cloud, DAWN.cloud, morning, tw * 0.8, dim);
  blend(out.sunColor, NIGHT.light, DAY.light, dayF, DUSK.light, DAWN.light, morning, tw * 0.85);
  blend(out.hemiSky, NIGHT.hemiSky, DAY.hemiSky, dayF, DUSK.hemiSky, DAWN.hemiSky, morning, tw * 0.5);
  blend(out.hemiGround, NIGHT.hemiGround, DAY.hemiGround, dayF, DUSK.hemiGround, DAWN.hemiGround, morning, tw * 0.4);

  // Lueur : forte au crepuscule, simple halo pale en plein jour, nulle la nuit.
  out.glow.lerpColors(DUSK.glow, DAWN.glow, morning).multiplyScalar(tw * dim);
  const halo = 0.12 * dayF * (1 - tw);
  out.glow.r += DAY.halo.r * halo; out.glow.g += DAY.halo.g * halo; out.glow.b += DAY.halo.b * halo;

  // Lumiere directionnelle : la scene la place sur le soleil, puis sur la lune
  // quand le soleil passe sous l'horizon. Ce basculement inverse les faces
  // eclairees : on attenue la lumiere autour de l'horizon pour l'adoucir.
  const dip = 0.45 + 0.55 * smooth(0, 0.12, Math.abs(e));
  out.sunIntensity = (MOON_NIGHT + (SUN_DAY - MOON_NIGHT) * dayF) * dip;
  out.hemiIntensity = HEMI_NIGHT + (HEMI_DAY - HEMI_NIGHT) * dayF;

  out.starOpacity = 1 - smooth(-0.24, -0.02, e);
  out.moonPhase = (out.day - 1) % 8;
  return out;
}

/** Heure affichee, « 08:30 » : 06:00 au lever du soleil (phase 0). */
export function clockLabel(time: number): string {
  const t = Number.isFinite(time) ? time : 0;
  const cycles = t / DAY_SECONDS;
  const minutes = (Math.floor((cycles - Math.floor(cycles)) * 1440) + 360) % 1440;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return `${h < 10 ? "0" : ""}${h}:${m < 10 ? "0" : ""}${m}`;
}
