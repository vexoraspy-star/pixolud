// Systeme de bruit du Manoir Maudit.
//
// Avant, la chose connaissait en permanence la case du joueur et fonçait
// dessus : aucune strategie possible, se cacher ou marcher doucement ne
// servait a rien. Desormais elle ENTEND. Chaque action du joueur emet un
// bruit, avec un rayon ; les murs l'etouffent ; elle va voir d'ou il vient.

export type NoiseKind =
  | "pas"
  | "course"
  | "accroupi"
  | "lampe"
  | "ramassage"
  | "armoire"
  | "respiration"
  | "haletement"
  | "piece"
  | "boite-a-musique"
  | "porte"
  | "sel"
  /** Parler au micro (Backrooms) : le rayon est module par le volume. */
  | "voix";

export interface Noise {
  kind: NoiseKind;
  /** Position, en cases. */
  x: number;
  z: number;
  /** Rayon a portee pleine, en cases, sans mur entre les deux. */
  radius: number;
  /** Instant d'emission, en secondes de partie. */
  at: number;
}

/** Rayons de base. Le joueur les voit sur la jauge de bruit. */
export const NOISE_RADIUS: Record<NoiseKind, number> = {
  accroupi: 1.3,
  pas: 4,
  course: 8.5,
  lampe: 2.2,
  ramassage: 2.5,
  armoire: 4,
  respiration: 1.8,
  "haletement": 7,
  piece: 9,
  "boite-a-musique": 13,
  porte: 5,
  sel: 4,
  voix: 9,
};

/** Combien de temps un bruit ponctuel reste « dans l'air ». */
export const NOISE_LIFETIME = 1.4;

/** Chaque mur traverse divise la portee : une piece voisine entend a peine. */
const WALL_DAMPING = 0.62;

/**
 * Nombre de cases pleines traversees entre deux points. On echantillonne la
 * ligne et on ne compte chaque case qu'une fois.
 */
export function wallsBetween(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  isSolid: (x: number, y: number) => boolean,
): number {
  const dist = Math.hypot(bx - ax, bz - az);
  const steps = Math.max(1, Math.ceil(dist * 2.5));
  let walls = 0;
  let lastKey = "";
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const cx = Math.floor(ax + (bx - ax) * t);
    const cz = Math.floor(az + (bz - az) * t);
    const key = `${cx},${cz}`;
    if (key === lastKey) continue;
    lastKey = key;
    if (isSolid(cx, cz)) walls++;
  }
  return walls;
}

/**
 * A quel point un auditeur percoit un bruit : 0 (rien) a 1 (juste a cote).
 * Le bruit s'efface lineairement sur sa duree de vie.
 */
export function audibility(noise: Noise, listenerX: number, listenerZ: number, now: number, walls: number): number {
  const age = now - noise.at;
  if (age < 0 || age > NOISE_LIFETIME) return 0;
  const effectiveRadius = noise.radius * Math.pow(WALL_DAMPING, walls);
  if (effectiveRadius <= 0.01) return 0;
  const d = Math.hypot(noise.x - listenerX, noise.z - listenerZ);
  const loud = Math.max(0, 1 - d / effectiveRadius);
  const fade = 1 - age / NOISE_LIFETIME;
  return loud * fade;
}

/** Garde une file de bruits recents, sans jamais la laisser grossir. */
export function pruneNoises(noises: Noise[], now: number): Noise[] {
  return noises.filter((n) => now - n.at <= NOISE_LIFETIME).slice(-24);
}
