import { audibility, type Noise } from "./manorNoise";

// Le cerveau de la chose.
//
// Elle ne connait plus la position du joueur. Elle a quatre facons d'etre :
//
//  - ERRER : elle patrouille de piece en piece. Elle derive vers la zone ou
//    se trouve le joueur, sans connaitre sa case exacte — sinon, sur plus de
//    mille cases, on ne la croiserait jamais.
//  - ENQUETER : elle a entendu quelque chose et va voir D'OU CA VENAIT. Une
//    piece lancee au loin l'emmene loin.
//  - POURSUIVRE : elle te voit. Elle te suit tant que le contact visuel dure.
//  - FOUILLER : elle t'a perdu, ou elle est arrivee sur un bruit. Elle
//    ratisse les cases voisines quelques secondes, puis repart errer.
//
// Et un cas a part : si elle t'a VU entrer dans une cachette, elle vient
// t'en tirer.

export type BrainState = "errer" | "enqueter" | "poursuivre" | "fouiller" | "debusquer";

export type SpeedMode = "lent" | "marche" | "chasse" | "fuite";

export interface Brain {
  state: BrainState;
  /** Case visee. */
  goal: [number, number] | null;
  since: number;
  lastSeen: { x: number; z: number; at: number } | null;
  /** Force du bruit qu'elle est en train de suivre : un bruit plus faible ne l'en detourne pas. */
  following: number;
  searchCenter: { x: number; z: number } | null;
  searchUntil: number;
  /** Cachette ou elle t'a vu entrer. */
  hideout: [number, number] | null;
}

export interface Perception {
  now: number;
  monster: { x: number; z: number };
  player: { x: number; z: number; hidden: boolean };
  /** Contact visuel, calcule par la scene (ligne de vue + portee). */
  canSee: boolean;
  noises: Noise[];
  /** Nombre de murs entre chaque bruit et elle, dans le meme ordre. */
  noiseWalls: number[];
  /** Phases finales : elle sait toujours ou tu es. */
  forceChase: boolean;
  /** 0 = debut de partie, 1 = toutes les reliques volees. Rend l'errance plus pressante. */
  pressure: number;
}

export interface Decision {
  state: BrainState;
  goal: [number, number] | null;
  speed: SpeedMode;
  /** Vient juste de te reperer : de quoi jouer un cri. */
  noticed: boolean;
  /** Vient d'entendre quelque chose d'assez fort pour changer de cap. */
  alerted: boolean;
}

/** En dessous, le bruit est trop faible pour qu'elle bouge. */
export const HEARING_THRESHOLD = 0.1;
/** Au-dessus, elle court vers le bruit plutot que de marcher. */
const LOUD_THRESHOLD = 0.5;
/** Arrivee sur sa case cible. */
const ARRIVAL = 0.75;
const SEARCH_SECONDS = 8;
const SEARCH_RADIUS = 4;

export function createBrain(now: number): Brain {
  return {
    state: "errer",
    goal: null,
    since: now,
    lastSeen: null,
    following: 0,
    searchCenter: null,
    searchUntil: 0,
    hideout: null,
  };
}

export interface MapQuery {
  /** Une case libre tiree au hasard. */
  randomOpenCell(rng: () => number): [number, number];
  /** Une case libre au hasard dans un rayon, ou null s'il n'y en a pas. */
  randomOpenCellNear(x: number, z: number, radius: number, rng: () => number): [number, number] | null;
}

const cellOf = (x: number, z: number): [number, number] => [Math.floor(x), Math.floor(z)];

function setState(brain: Brain, state: BrainState, now: number) {
  if (brain.state !== state) {
    brain.state = state;
    brain.since = now;
  }
}

/** Le joueur s'est cache sous ses yeux : elle retient la cachette. */
export function noteHidingSeen(brain: Brain, hideoutCell: [number, number], now: number) {
  brain.hideout = hideoutCell;
  brain.goal = hideoutCell;
  setState(brain, "debusquer", now);
}

export function thinkMonster(brain: Brain, p: Perception, map: MapQuery, rng: () => number): Decision {
  const { now, monster, player } = p;
  let noticed = false;
  let alerted = false;
  const arrived =
    brain.goal !== null &&
    Math.hypot(monster.x - (brain.goal[0] + 0.5), monster.z - (brain.goal[1] + 0.5)) < ARRIVAL;

  // --- Final : plus de cache-cache, elle sait. ---
  if (p.forceChase) {
    setState(brain, "poursuivre", now);
    brain.goal = cellOf(player.x, player.z);
    brain.lastSeen = { x: player.x, z: player.z, at: now };
    return { state: brain.state, goal: brain.goal, speed: "fuite", noticed: false, alerted: false };
  }

  // --- Elle t'a vu te cacher : elle vient te chercher, rien ne l'en detourne. ---
  if (brain.state === "debusquer" && brain.hideout) {
    if (!player.hidden) {
      // Sorti avant qu'elle arrive : elle retombe sur une poursuite classique.
      brain.hideout = null;
      setState(brain, p.canSee ? "poursuivre" : "fouiller", now);
      brain.searchCenter = { x: player.x, z: player.z };
      brain.searchUntil = now + SEARCH_SECONDS;
    } else {
      brain.goal = brain.hideout;
      return { state: brain.state, goal: brain.goal, speed: "chasse", noticed: false, alerted: false };
    }
  }

  // --- Contact visuel : poursuite. ---
  if (p.canSee && !player.hidden) {
    noticed = brain.state !== "poursuivre";
    setState(brain, "poursuivre", now);
    brain.lastSeen = { x: player.x, z: player.z, at: now };
    brain.goal = cellOf(player.x, player.z);
    brain.following = 1;
    return { state: brain.state, goal: brain.goal, speed: "chasse", noticed, alerted: false };
  }

  // --- Elle vient de te perdre de vue : direction ta derniere position. ---
  if (brain.state === "poursuivre") {
    setState(brain, "fouiller", now);
    const last = brain.lastSeen ?? { x: player.x, z: player.z, at: now };
    brain.searchCenter = { x: last.x, z: last.z };
    brain.searchUntil = now + SEARCH_SECONDS + 3;
    brain.goal = cellOf(last.x, last.z);
    brain.following = 0.6;
  }

  // --- L'ouie : le bruit le plus fort qu'elle percoit. ---
  let best: Noise | null = null;
  let bestLevel = 0;
  p.noises.forEach((n, i) => {
    const level = audibility(n, monster.x, monster.z, now, p.noiseWalls[i] ?? 0);
    if (level > bestLevel) {
      bestLevel = level;
      best = n;
    }
  });
  // Un bruit plus fort que celui qu'elle suit la fait changer de cap ; un
  // bruit plus faible ne la detourne pas d'une piste deja chaude.
  if (best && bestLevel >= HEARING_THRESHOLD && bestLevel >= brain.following * 0.7) {
    const noise = best as Noise;
    alerted = brain.state === "errer" || bestLevel > brain.following + 0.15;
    setState(brain, "enqueter", now);
    brain.goal = cellOf(noise.x, noise.z);
    brain.following = bestLevel;
    brain.searchCenter = { x: noise.x, z: noise.z };
    return {
      state: brain.state,
      goal: brain.goal,
      speed: bestLevel >= LOUD_THRESHOLD ? "chasse" : "marche",
      noticed,
      alerted,
    };
  }
  // La piste refroidit avec le temps.
  brain.following = Math.max(0, brain.following - 0.02);

  // --- Arrivee : sur un bruit, on fouille ; en fouille, on change de case. ---
  if (brain.state === "enqueter" && arrived) {
    setState(brain, "fouiller", now);
    brain.searchUntil = now + SEARCH_SECONDS;
    brain.goal = null;
  }
  if (brain.state === "fouiller") {
    if (now > brain.searchUntil) {
      setState(brain, "errer", now);
      brain.goal = null;
      brain.searchCenter = null;
      brain.following = 0;
    } else if (!brain.goal || arrived) {
      const c = brain.searchCenter ?? { x: monster.x, z: monster.z };
      brain.goal = map.randomOpenCellNear(c.x, c.z, SEARCH_RADIUS, rng) ?? cellOf(c.x, c.z);
    }
    if (brain.state === "fouiller") {
      return { state: brain.state, goal: brain.goal, speed: "marche", noticed, alerted };
    }
  }

  // --- Errance : un nouveau but a chaque arrivee. ---
  if (brain.state !== "errer") setState(brain, "errer", now);
  if (!brain.goal || arrived) {
    // Elle derive vers le joueur : de plus en plus a mesure que les reliques
    // disparaissent. Jamais vers sa case exacte, vers sa region.
    const drift = 0.3 + 0.4 * Math.min(1, Math.max(0, p.pressure));
    brain.goal =
      rng() < drift
        ? map.randomOpenCellNear(player.x, player.z, 9, rng) ?? map.randomOpenCell(rng)
        : map.randomOpenCell(rng);
  }
  return { state: brain.state, goal: brain.goal, speed: "lent", noticed, alerted };
}

/** Portee de vue, en cases, selon ce que fait le joueur. */
export function sightRange(opts: { flashlightOn: boolean; crouched: boolean; behind: boolean }): number {
  let range = opts.flashlightOn ? 11 : 6.5;
  if (opts.crouched && !opts.flashlightOn) range = 4;
  // Dans son dos, elle ne voit presque rien.
  if (opts.behind) range *= 0.45;
  return range;
}
