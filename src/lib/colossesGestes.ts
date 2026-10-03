import * as THREE from "three";
import { ATTAQUES, RELEVE, type AttaqueId } from "./colosses";
import { TEMPS_FURIE, type Combattant, type Furie, type Grace, type Phase } from "./colossesCombat";
import type { AnimatedModel } from "./models3d";

/**
 * Les gestes du combattant anime (public/models/colosse.glb).
 *
 * Le fichier n'a qu'une vingtaine d'animations : direct, cross, coup de pied,
 * garde, saut, chute... Les autres coups sont FABRIQUES a partir d'elles :
 *
 * - le TEMPS de l'animation est pilote par le jeu. Un direct dure ce que dit
 *   la fiche du coup, et le poing est tendu pile pendant la phase active :
 *   ce qu'on voit toucher est ce qui touche ;
 * - des RETOUCHES d'os s'ajoutent a la pose (une rotation par os) : la jambe
 *   qui s'allonge au ras du sol pour la balayette, le bras qui monte pour
 *   l'uppercut, le poing qui plonge en l'air. Les angles ont ete calcules sur
 *   le squelette du modele pour que le poing ou le pied arrive au bout de la
 *   zone de touche du coup ;
 * - une VRILLE fait tourner tout le corps (retourne, balayette, tourbillon).
 *
 * Rien n'est ajoute au fichier, rien n'est telecharge en plus.
 */

/** Rotation locale ajoutee a un os : quaternion [x, y, z, w]. */
type Q = [number, number, number, number];
type Retouche = Record<string, Q>;

// Calculees hors du jeu (descente sur le squelette du modele).
const BALAYETTE: Retouche = {
  thigh_l: [0.277, -0.104, 0.041, 0.954],
  calf_l: [-0.772, -0.012, 0.002, 0.635],
  foot_l: [0.464, 0.001, 0.001, 0.886],
};
const COUP_BAS: Retouche = {
  thigh_l: [0.212, -0.063, 0.069, 0.973],
  calf_l: [-0.747, -0.004, -0.023, 0.664],
  foot_l: [0.403, -0.002, -0.007, 0.915],
};
const PIED_SAUTE: Retouche = {
  thigh_r: [-0.246, -0.069, -0.173, 0.951],
  calf_r: [-0.387, -0.017, -0.061, 0.92],
  foot_r: [0.307, 0.002, -0.009, 0.952],
};
const POING_SAUTE: Retouche = {
  spine_02: [0.352, 0.484, 0.075, 0.798],
  upperarm_r: [0.2, 0.08, -0.288, 0.933],
  lowerarm_r: [-0.086, -0.002, -0.093, 0.992],
};
const UPPER_DEPART: Retouche = {
  upperarm_r: [0.346, -0.042, 0.428, 0.834],
  lowerarm_r: [0.013, -0.001, 0.047, 0.999],
};
const UPPER_FIN: Retouche = {
  upperarm_r: [-0.282, -0.038, -0.334, 0.899],
  lowerarm_r: [0.001, 0.001, -0.119, 0.993],
};
const GARDE_BASSE: Retouche = {
  upperarm_l: [0.674, 0.026, 0.406, 0.616],
  lowerarm_l: [0.575, 0.014, -0.023, 0.818],
  upperarm_r: [0.615, -0.047, -0.231, 0.752],
  lowerarm_r: [0.447, -0.008, 0.043, 0.894],
};

/** Deux poses de retouches : celle du debut de la phase, celle de la fin. */
type Passage = [Retouche | null, Retouche | null];

interface Geste {
  /** L'animation de base, et ses instants : debut, debut de l'actif, fin de l'actif, fin. */
  clip: string;
  temps: [number, number, number, number];
  /** Une autre animation pendant le demarrage (l'uppercut part accroupi). */
  demarrage?: { clip: string; t: number };
  /** Retouches pendant chaque phase. */
  retouches?: { demarrage?: Passage; actif?: Passage; recuperation?: Passage };
  /** Tours complets sur soi-meme, jusqu'a la fin du demarrage ou de l'actif. */
  vrille?: number;
  vrilleJusquA?: "demarrage" | "actif";
  /** Le corps flotte (coup de pied volant au ras du sol). */
  hauteur?: number;
}

const FIGE = (clip: string, t: number): Pick<Geste, "clip" | "temps"> => ({ clip, temps: [t, t, t, t] });
const TENU = (r: Retouche): Geste["retouches"] => ({ demarrage: [null, r], actif: [r, r], recuperation: [r, null] });
const LANCER: Geste = { ...FIGE("Blast", 0.2), demarrage: { clip: "PowerUp", t: 0.35 } };
const UPPERCUT: Geste = {
  clip: "Cross",
  temps: [0.47, 0.47, 0.47, 1.15],
  demarrage: { clip: "Accroupi", t: 1.0 },
  retouches: { actif: [UPPER_DEPART, UPPER_FIN], recuperation: [UPPER_FIN, null] },
};

const GESTES: Record<AttaqueId, Geste> = {
  direct: { clip: "Direct", temps: [0.1, 0.25, 0.42, 0.95] },
  cross: { clip: "Cross", temps: [0.12, 0.3, 0.55, 1.15] },
  pied: { clip: "Pied", temps: [0.05, 0.28, 0.46, 0.79] },
  retourne: { clip: "Pied", temps: [0.05, 0.28, 0.46, 0.79], vrille: 1, vrilleJusquA: "demarrage" },
  uppercut: UPPERCUT,
  coupBas: { ...FIGE("Accroupi", 1.0), retouches: TENU(COUP_BAS) },
  balayette: { ...FIGE("Accroupi", 1.0), retouches: TENU(BALAYETTE), vrille: 1, vrilleJusquA: "actif" },
  poingSaute: { ...FIGE("Saut", 1.0), retouches: TENU(POING_SAUTE) },
  piedSaute: { ...FIGE("Saut", 1.0), retouches: TENU(PIED_SAUTE) },
  projection: FIGE("Blast", 0.2),
  lameVolante: LANCER,
  rocher: LANCER,
  onde: LANCER,
  voile: LANCER,
  ruee: { clip: "Crochet", temps: [0.0, 0.2, 0.32, 0.417] },
  charge: { clip: "Charge", temps: [0.0, 0.07, 0.4, 1.0] },
  torpille: { ...FIGE("Saut", 1.0), retouches: TENU(PIED_SAUTE), hauteur: 0.38 },
  envol: UPPERCUT,
  seisme: { ...FIGE("Accroupi", 1.0), demarrage: { clip: "PowerUp", t: 0.35 } },
  decharge: FIGE("PowerUp", 0.35),
  tourbillon: { ...FIGE("Blast", 0.2), vrille: 2, vrilleJusquA: "actif" },
  pasDeBrume: FIGE("PowerUp", 0.35),
  furie: { clip: "Crochet", temps: [0.0, 0.2, 0.32, 0.417] },
};

/** Les coups enchaines pendant la furie, un par touche, et l'instant ou chacun frappe. */
const CLIPS_FURIE: { clip: string; impact: number }[] = [
  { clip: "Direct", impact: 0.3 },
  { clip: "Cross", impact: 0.36 },
  { clip: "Pied", impact: 0.33 },
  { clip: "Cross", impact: 0.36 },
  { clip: "Crochet", impact: 0.28 },
];

/** Ce que la scene garde pour chaque combattant anime. */
export interface Visuel {
  /** Ce qui est joue en ce moment : une animation n'est relancee que si la cle change. */
  cle: unknown;
  clipKo: string;
  etat: string;
  /** Debut de l'etat courant, en temps de combat. */
  depuis: number;
  os: Map<string, THREE.Object3D | null>;
}

export function nouveauVisuel(): Visuel {
  return { cle: null, clipKo: "KO_A", etat: "", depuis: 0, os: new Map() };
}

export interface Contexte {
  phase: Phase;
  chrono: number;
  horloge: number;
  furie: Furie | null;
  grace: Grace | null;
}

const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();
const qr = new THREE.Quaternion();
const lisse = (u: number) => u * u * (3 - 2 * u);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/** Une cle propre au demarrage de chaque coup (le coup lui-meme sert de cle a la suite). */
const demarrages = new WeakMap<object, object>();
function cleDemarrage(act: object): object {
  let k = demarrages.get(act);
  if (!k) {
    k = {};
    demarrages.set(act, k);
  }
  return k;
}

function os(m: AnimatedModel, v: Visuel, nom: string): THREE.Object3D | null {
  let b = v.os.get(nom);
  if (b === undefined) {
    b = m.bone(nom);
    v.os.set(nom, b);
  }
  return b;
}

/** Une animation figee a un instant donne ; elle n'est relancee que si `cle` change. */
function fige(m: AnimatedModel, v: Visuel, clip: string, t: number, cle: unknown, fondu = 0.06) {
  if (v.cle !== cle || m.current !== clip) {
    m.play(clip, { loop: false, fade: fondu, speed: 0, restart: true });
    v.cle = cle;
  }
  m.seek(t);
}

/** Une animation qui tourne en boucle (garde, marche, accroupi...). */
function boucle(m: AnimatedModel, v: Visuel, clip: string, fondu: number, vitesse = 1) {
  const cle = `boucle:${clip}`;
  // Si la meme animation etait figee (un coup accroupi), on la relance en boucle.
  m.play(clip, { fade: fondu, speed: vitesse, restart: v.cle !== cle && m.current === clip });
  v.cle = cle;
}

/** Une animation jouee une fois, a son rythme (touche, K.O., entree). */
function uneFois(m: AnimatedModel, v: Visuel, clip: string, cle: unknown, fondu: number, vitesse = 1) {
  if (v.cle === cle) return;
  m.play(clip, { loop: false, fade: fondu, speed: vitesse, restart: true });
  v.cle = cle;
}

/** Applique les retouches d'une phase (de -> a, au point u). */
function retoucher(m: AnimatedModel, v: Visuel, passage: Passage, u: number) {
  const [de, a] = passage;
  const noms = new Set([...Object.keys(de ?? {}), ...Object.keys(a ?? {})]);
  for (const nom of noms) {
    const b = os(m, v, nom);
    if (!b) continue;
    const x = de?.[nom];
    const y = a?.[nom];
    if (x) qa.set(x[0], x[1], x[2], x[3]);
    else qa.identity();
    if (y) qb.set(y[0], y[1], y[2], y[3]);
    else qb.identity();
    qr.slerpQuaternions(qa, qb, u);
    b.quaternion.multiply(qr);
  }
}

/**
 * Anime le combattant d'apres l'etat du moteur. Rend la vrille (tours sur
 * soi-meme, en radians) et le decalage vertical a ajouter au corps.
 */
export function animerCombattant(
  c: Combattant,
  m: AnimatedModel,
  v: Visuel,
  ctx: Contexte,
  dt: number,
): { vrille: number; hauteur: number } {
  if (c.etat !== v.etat) {
    v.etat = c.etat;
    v.depuis = ctx.horloge;
    if (c.etat === "ko") v.clipKo = ["KO_A", "KO_B", "KO_C"][Math.floor(Math.random() * 3)];
  }
  const depuis = ctx.horloge - v.depuis;
  let vrille = 0;
  let hauteur = 0;
  let passage: Passage | undefined;
  let u = 0;

  switch (c.etat) {
    case "attaque": {
      const act = c.action!;
      const a = ATTAQUES[act.id];
      const g = GESTES[act.id];
      const p1 = a.demarrage;
      const p2 = p1 + a.actif;
      const t = act.t;
      const phase = t < p1 ? 0 : t < p2 ? 1 : 2;
      u = phase === 0 ? t / p1 : phase === 1 ? (t - p1) / a.actif : Math.min(1, (t - p2) / a.recuperation);
      if (phase === 0 && g.demarrage) {
        fige(m, v, g.demarrage.clip, g.demarrage.t, cleDemarrage(act));
      } else {
        const [c0, c1, c2, c3] = g.temps;
        const tc = phase === 0 ? lerp(c0, c1, u) : phase === 1 ? lerp(c1, c2, u) : lerp(c2, c3, u);
        fige(m, v, g.clip, tc, act, g.demarrage ? 0.09 : 0.06);
      }
      const r = g.retouches;
      passage = phase === 0 ? r?.demarrage : phase === 1 ? r?.actif : r?.recuperation;
      u = lisse(u);
      if (g.vrille) {
        const fin = g.vrilleJusquA === "actif" ? p2 : p1;
        const debut = act.id === "tourbillon" ? p1 : 0;
        const w = Math.max(0, Math.min(1, (t - debut) / (fin - debut)));
        vrille = lisse(w) * g.vrille * Math.PI * 2;
      }
      if (g.hauteur) hauteur = phase < 2 ? g.hauteur * Math.sin(Math.min(1, t / p1) * Math.PI * 0.5) : g.hauteur * (1 - u);
      break;
    }
    case "subit":
      if (ctx.grace && ctx.grace.victime === c) {
        boucle(m, v, "Etourdi", 0.3);
        break;
      }
    // la victime de la furie encaisse chaque coup, comme une touche
    // falls through
    case "touche":
    case "saisi":
      uneFois(m, v, c.toucheHaut ? "ToucheTete" : "Touche", `touche-${c.impacts}`, 0.05, 1.35);
      break;
    case "garde":
      if (c.accroupi) {
        boucle(m, v, "Accroupi", 0.06);
        passage = [GARDE_BASSE, GARDE_BASSE];
      } else boucle(m, v, "Bloc", 0.06);
      break;
    case "jongle":
      fige(m, v, "Projete", c.vy > 0 ? 0.14 : 0.24, "jongle", 0.1);
      break;
    case "chute":
      fige(m, v, "Projete", Math.min(0.3, 0.06 + depuis * 0.8), "chute", 0.08);
      break;
    case "sol":
      fige(m, v, "Projete", Math.min(0.47, 0.34 + depuis * 0.5), "chute", 0.08);
      break;
    case "releve": {
      const w = 1 - Math.max(0, c.minuteur) / RELEVE;
      fige(m, v, "Projete", lerp(0.58, 0.83, w), "chute", 0.08);
      break;
    }
    case "sonne":
      boucle(m, v, "Etourdi", 0.25);
      break;
    case "ko":
      uneFois(m, v, v.clipKo, "ko", 0.12);
      break;
    case "victoire":
      boucle(m, v, ctx.phase === "fini" ? "Victoire" : "VictoirePoing", 0.3);
      break;
    case "furie": {
      if (ctx.furie && ctx.furie.auteur === c) {
        // Un coup par touche de la furie, cale pour frapper a l'instant voulu.
        const f = ctx.furie;
        const k = Math.min(CLIPS_FURIE.length - 1, f.coups);
        const quand = TEMPS_FURIE[Math.min(k, TEMPS_FURIE.length - 1)];
        const { clip, impact } = CLIPS_FURIE[k];
        const tc = Math.max(0, impact - (quand - f.t) * 1.6);
        fige(m, v, clip, Math.min(tc, impact + 0.15), `furie${k}`, 0.05);
      } else if (ctx.grace && ctx.grace.auteur === c) {
        const g = ctx.grace;
        const geste = c.perso.id === "lame" || c.perso.id === "roc" ? "Crochet" : "Blast";
        if (g.t < 0.6) fige(m, v, "PowerUp", 0.35, "grace0", 0.2);
        else if (g.t < 1.7) fige(m, v, geste, geste === "Crochet" ? Math.min(0.32, (g.t - 0.6) * 0.9) : 0.2, "grace1", 0.08);
        else boucle(m, v, "Idle", 0.4);
      } else boucle(m, v, "Idle", 0.2);
      break;
    }
    default: {
      // libre
      if (c.y > 0.05) boucle(m, v, "Saut", 0.15);
      else if (c.accroupi) {
        boucle(m, v, "Accroupi", 0.12);
        if (c.enGarde) passage = [GARDE_BASSE, GARDE_BASSE];
      } else if (c.enGarde) boucle(m, v, "Bloc", 0.08);
      else if (c.pas > 0) boucle(m, v, "Marche", 0.08, 2.2);
      else if (c.marche !== 0) {
        if (Math.sign(c.marche) === c.sens) boucle(m, v, "Marche", 0.2, 1.15 * c.perso.vitesse);
        else boucle(m, v, "Recul", 0.2, c.perso.vitesse);
      } else if (ctx.phase === "annonce" && ctx.chrono < 1.5) uneFois(m, v, "PowerUp", "entree", 0.25);
      else boucle(m, v, "Idle", 0.18);
    }
  }

  m.update(dt);
  // Les retouches s'ajoutent APRES l'animation : le mixeur reecrit les os a
  // chaque image, elles ne s'accumulent donc pas.
  if (passage) retoucher(m, v, passage, u);
  return { vrille, hauteur };
}

/** La famille d'un coup, pour le modele de secours : poing, pied ou special. */
export function familleDuCoup(id: AttaqueId): "poing" | "pied" | "special" {
  if (id === "direct" || id === "cross" || id === "poingSaute" || id === "projection") return "poing";
  if (id === "pied" || id === "retourne" || id === "coupBas" || id === "balayette" || id === "piedSaute" || id === "torpille")
    return "pied";
  return "special";
}
