import * as THREE from "three";
import { AMMO, type AmmoId, type AmmoSpec, type Armor } from "./tankDefs";

// Regles de tir de « Tonnerre d'Acier ».
//
// Un obus touche une plaque : on calcule l'angle entre sa trajectoire et la
// normale de la plaque (inclinaison comprise), l'epaisseur effective
// (epaisseur / cos angle), et on la compare a la penetration tiree au sort.
// Regles du genre, publiees partout (voir le README du jeu) :
//  - au-dela de 70 degres, un perforant ou un sous-calibre ricoche ;
//  - a l'impact, l'obus se redresse de quelques degres (normalisation) ;
//  - un obus plus de deux fois plus gros que la plaque se redresse beaucoup
//    plus, et plus de trois fois plus gros, il ne ricoche jamais ;
//  - l'explosif ne ricoche pas : s'il ne perce pas, il fait quand meme un
//    peu de degats, amortis par l'epaisseur.

const DEG = Math.PI / 180;

/** Gravite appliquee aux obus, en m/s². */
export const SHELL_GRAVITY = 9.81;

export type Zone = "avant" | "flanc" | "arriere" | "toit" | "dessous";

export interface ObbHit {
  /** Fraction du segment (0 = depart) ou l'obus entre dans la boite. */
  t: number;
  zone: Zone;
  /** Normale de la plaque touchee, en coordonnees monde, inclinaison comprise. */
  normal: THREE.Vector3;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _d = new THREE.Vector3();

/**
 * Premier contact d'un segment [p0, p1] (monde) avec une boite orientee :
 * `inverse` ramene le monde dans le repere de la boite (centre a l'origine,
 * x a droite, y en haut, z vers l'avant), `half` donne ses demi-tailles.
 * `matrix` sert a remettre la normale en coordonnees monde.
 */
export function segmentObb(
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  matrix: THREE.Matrix4,
  inverse: THREE.Matrix4,
  half: THREE.Vector3,
  armor: Armor,
  out: ObbHit,
): boolean {
  _a.copy(p0).applyMatrix4(inverse);
  _b.copy(p1).applyMatrix4(inverse);
  _d.subVectors(_b, _a);
  let tNear = -Infinity;
  let tFar = Infinity;
  let axis = -1;
  let sign = 1;
  const h = [half.x, half.y, half.z];
  const a = [_a.x, _a.y, _a.z];
  const d = [_d.x, _d.y, _d.z];
  for (let k = 0; k < 3; k++) {
    if (Math.abs(d[k]) < 1e-9) {
      if (a[k] < -h[k] || a[k] > h[k]) return false;
      continue;
    }
    let t1 = (-h[k] - a[k]) / d[k];
    let t2 = (h[k] - a[k]) / d[k];
    // Face d'entree : celle dont la normale regarde l'obus.
    let s = -1;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
      s = 1;
    }
    if (t1 > tNear) {
      tNear = t1;
      axis = k;
      sign = s;
    }
    if (t2 < tFar) tFar = t2;
    if (tNear > tFar) return false;
  }
  if (axis < 0 || tNear < 0 || tNear > 1 || tFar < 0) return false;
  out.t = tNear;
  const n = out.normal;
  if (axis === 2) {
    if (sign > 0) {
      out.zone = "avant";
      n.set(0, Math.sin(armor.frontSlope * DEG), Math.cos(armor.frontSlope * DEG));
    } else {
      out.zone = "arriere";
      n.set(0, 0, -1);
    }
  } else if (axis === 0) {
    out.zone = "flanc";
    n.set(sign * Math.cos(armor.sideSlope * DEG), Math.sin(armor.sideSlope * DEG), 0);
  } else {
    out.zone = sign > 0 ? "toit" : "dessous";
    n.set(0, sign, 0);
  }
  n.transformDirection(matrix);
  return true;
}

/** Epaisseur nominale de la zone touchee. */
export function zoneThickness(armor: Armor, zone: Zone): number {
  if (zone === "avant") return armor.front;
  if (zone === "flanc") return armor.side;
  if (zone === "arriere") return armor.rear;
  return armor.top;
}

export type Outcome = "penetration" | "ricochet" | "bloque" | "eclats";

export interface ShotResult {
  outcome: Outcome;
  damage: number;
  /** Epaisseur effective, en mm (pour le message « 187 mm »). */
  effective: number;
  /** Angle d'impact, en degres. */
  angle: number;
}

/** Degats tires au sort a plus ou moins 25 %. */
export function rollDamage(mean: number, rnd: () => number): number {
  return Math.round(mean * (0.75 + rnd() * 0.5));
}

/**
 * L'angle et l'epaisseur effective, sans tirage : sert au tir et a la couleur
 * du viseur. `dir` et `normal` sont unitaires ; `dir` va vers la cible.
 */
export function effectiveArmor(
  dir: THREE.Vector3,
  normal: THREE.Vector3,
  thickness: number,
  caliber: number,
  ammo: AmmoId,
): { angle: number; effective: number; ricochet: boolean } {
  const info = AMMO[ammo];
  const cos = THREE.MathUtils.clamp(-dir.dot(normal), 0, 1);
  const angle = Math.acos(cos) / DEG;
  if (info.explosive) {
    return { angle, effective: thickness / Math.max(0.08, cos), ricochet: false };
  }
  const over2 = caliber > thickness * 2;
  const over3 = caliber > thickness * 3;
  if (info.ricochet && angle > 70 && !over3) {
    return { angle, effective: thickness / Math.max(0.08, cos), ricochet: true };
  }
  const norm = over2 ? (info.normalization * 1.4 * caliber) / Math.max(1, thickness) : info.normalization;
  const a = Math.max(0, angle - norm);
  return { angle, effective: thickness / Math.max(0.08, Math.cos(a * DEG)), ricochet: false };
}

/** Resultat complet d'un impact, avec les tirages de penetration et de degats. */
export function resolveHit(
  dir: THREE.Vector3,
  normal: THREE.Vector3,
  thickness: number,
  caliber: number,
  ammo: AmmoId,
  spec: AmmoSpec,
  rnd: () => number,
): ShotResult {
  const e = effectiveArmor(dir, normal, thickness, caliber, ammo);
  if (e.ricochet) return { outcome: "ricochet", damage: 0, effective: e.effective, angle: e.angle };
  const pen = spec.penetration * (0.75 + rnd() * 0.5);
  if (pen >= e.effective) {
    return { outcome: "penetration", damage: rollDamage(spec.damage, rnd), effective: e.effective, angle: e.angle };
  }
  if (AMMO[ammo].explosive) {
    // L'eclat traverse mal : moitie des degats, moins ce que la plaque arrete.
    const dmg = Math.max(0, Math.round(rollDamage(spec.damage, rnd) * 0.5 - e.effective * 1.1));
    return { outcome: dmg > 0 ? "eclats" : "bloque", damage: dmg, effective: e.effective, angle: e.angle };
  }
  return { outcome: "bloque", damage: 0, effective: e.effective, angle: e.angle };
}

/** Chance de percer (0 a 1) : penetration tiree entre 75 % et 125 %. */
export function penetrationChance(penetration: number, effective: number): number {
  return THREE.MathUtils.clamp((penetration * 1.25 - effective) / (penetration * 0.5), 0, 1);
}

/**
 * Angle de tir au-dessus de l'horizontale (radians) pour toucher un point a
 * `x` metres a l'horizontale et `y` metres plus haut, obus a `v` m/s : le tir
 * tendu. `null` si le point est hors de portee.
 */
export function launchAngle(x: number, y: number, v: number, g = SHELL_GRAVITY): number | null {
  const v2 = v * v;
  const disc = v2 * v2 - g * (g * x * x + 2 * y * v2);
  if (disc < 0) return null;
  return Math.atan2(v2 - Math.sqrt(disc), g * Math.max(0.001, x));
}

/**
 * Ecart d'un tir : un point au hasard dans le cercle de dispersion, plus
 * souvent pres du centre (loi normale tronquee a deux ecarts-types).
 */
export function dispersionOffset(radius: number, rnd: () => number): { dx: number; dy: number } {
  let r = 0;
  // Box-Muller : un rayon distribue normalement, ramene dans le cercle.
  const u = Math.max(1e-6, rnd());
  const gauss = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
  r = Math.min(1, Math.abs(gauss) / 2) * radius;
  const a = rnd() * Math.PI * 2;
  return { dx: Math.cos(a) * r, dy: Math.sin(a) * r };
}
