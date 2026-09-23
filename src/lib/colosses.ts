/**
 * Colosses — le jeu de combat 1 contre 1.
 *
 * Un jeu de combat tient a trois chiffres : combien de temps dure un coup,
 * combien de temps l'adversaire reste sonne, et combien il encaisse. Tout est
 * ici, en un seul endroit, pour pouvoir equilibrer sans fouiller la scene.
 *
 * Le vocabulaire : un coup a trois phases — la PREPARATION (on voit le coup
 * partir, on peut encore bloquer), l'ACTIF (la ou ca touche), et la
 * RECUPERATION (on est vulnerable). C'est ce decoupage qui rend un jeu de
 * combat juste : un coup puissant doit se voir venir et punir celui qui rate.
 */

export type ColosseId = "roc" | "lame" | "eclair" | "brume";
export type CoupId = "poing" | "pied" | "special";

export interface Coup {
  id: CoupId;
  nom: string;
  /** Duree des trois phases, en secondes. */
  preparation: number;
  actif: number;
  recuperation: number;
  degats: number;
  /** Portee horizontale, en unites du monde. */
  portee: number;
  /** Hauteur du coup : bas (jambes), moyen, haut (saute). */
  hauteur: "bas" | "moyen" | "haut";
  /** Recul inflige a l'adversaire. */
  poussee: number;
  /** Energie gagnee en touchant (le special la depense). */
  energie: number;
}

export const COUPS: Record<CoupId, Coup> = {
  poing: {
    id: "poing",
    nom: "Direct",
    preparation: 0.07,
    actif: 0.08,
    recuperation: 0.14,
    degats: 6,
    portee: 1.25,
    hauteur: "haut",
    poussee: 0.5,
    energie: 7,
  },
  pied: {
    id: "pied",
    nom: "Coup de pied",
    preparation: 0.14,
    actif: 0.1,
    recuperation: 0.26,
    degats: 12,
    portee: 1.7,
    hauteur: "moyen",
    poussee: 1.6,
    energie: 11,
  },
  special: {
    id: "special",
    nom: "Spécial",
    preparation: 0.22,
    actif: 0.16,
    recuperation: 0.42,
    degats: 24,
    portee: 2.2,
    hauteur: "moyen",
    poussee: 3.2,
    energie: -100,
  },
};

export interface Colosse {
  id: ColosseId;
  nom: string;
  /** Une phrase, pas un roman : on choisit en trois secondes. */
  phrase: string;
  emoji: string;
  /** Couleurs du corps, de l'armure et de l'accent lumineux. */
  peau: number;
  armure: number;
  accent: number;
  /** Multiplicateurs : ils font toute la personnalite du personnage. */
  vitesse: number;
  force: number;
  /**
   * Points de vie. Un gros sac encaisse plus, mais avance moins vite.
   *
   * Regle de dosage : un round doit tenir une trentaine de secondes entre
   * deux joueurs actifs. Avec une quinzaine de coups pour vider une barre,
   * un debutant a le temps de comprendre ce qui le touche — et de bloquer.
   */
  vie: number;
  /** Ce que fait son coup special. */
  special: "onde" | "charge" | "uppercut" | "tourbillon";
  specialTexte: string;
}

export const COLOSSES: Record<ColosseId, Colosse> = {
  roc: {
    id: "roc",
    nom: "Roc",
    phrase: "Lent, lourd, difficile à faire tomber.",
    emoji: "🪨",
    peau: 0x8a8378,
    armure: 0x4a4740,
    accent: 0xffb454,
    vitesse: 0.82,
    force: 1.22,
    vie: 190,
    special: "charge",
    specialTexte: "Charge d'épaule : il traverse l'arène et emporte tout.",
  },
  lame: {
    id: "lame",
    nom: "Lame",
    phrase: "Équilibrée. Le bon choix pour apprendre.",
    emoji: "⚔️",
    peau: 0xc9d2da,
    armure: 0x2f3a46,
    accent: 0x4ad6ff,
    vitesse: 1,
    force: 1,
    vie: 160,
    special: "uppercut",
    specialTexte: "Uppercut ascendant : il envoie l'adversaire en l'air.",
  },
  eclair: {
    id: "eclair",
    nom: "Éclair",
    phrase: "Rapide et fragile. Frappe et recule.",
    emoji: "⚡",
    peau: 0xf4e28a,
    armure: 0x3a2f14,
    accent: 0xfff275,
    vitesse: 1.3,
    force: 0.84,
    vie: 134,
    special: "onde",
    specialTexte: "Onde de choc : une décharge qui part de loin.",
  },
  brume: {
    id: "brume",
    nom: "Brume",
    phrase: "Insaisissable : elle tourne autour de toi.",
    emoji: "🌫️",
    peau: 0xb3a7d6,
    armure: 0x2a2440,
    accent: 0xc084fc,
    vitesse: 1.12,
    force: 0.94,
    vie: 148,
    special: "tourbillon",
    specialTexte: "Tourbillon : elle frappe des deux côtés en tournant.",
  },
};

export const COLOSSE_ORDER: ColosseId[] = ["lame", "roc", "eclair", "brume"];

// --------------------------------------------------------------- reglages

/** Largeur jouable de l'arene, de -X a +X. */
export const ARENE = 9;
export const SOL = 0;
export const GRAVITE = 26;
export const SAUT = 9.2;
export const VITESSE = 5.2;
/** Distance minimale entre deux combattants : ils ne se traversent pas. */
export const ECART_MIN = 1.1;

export const ROUNDS_A_GAGNER = 2;
export const DUREE_ROUND = 60;
/** Temps sonne apres un coup encaisse (multiplie par les degats). */
export const ETOURDISSEMENT = 0.035;
/**
 * Apres un coup encaisse, on ne peut plus etre touche pendant ce temps.
 *
 * Sans cette respiration, un adversaire colle a vous enchaine les coups sans
 * jamais rendre la main : on perd un round en cinq secondes sans avoir joue
 * une seule fois. C'est le defaut le plus frequent des jeux de combat
 * amateurs, et le plus vite insupportable.
 */
export const REPIT = 0.3;

/** Part des degats encaissee quand on bloque. */
export const BLOCAGE = 0.15;
/** Energie maximale ; le special en coute 100. */
export const ENERGIE_MAX = 100;

export type Difficulte = "tranquille" | "normal" | "brutal";

export const DIFFICULTES: Record<
  Difficulte,
  { label: string; reaction: number; agressivite: number; garde: number; cadence: number; texte: string }
> = {
  tranquille: {
    label: "Tranquille",
    reaction: 0.42,
    agressivite: 0.35,
    garde: 0.2,
    cadence: 1.9,
    texte: "Il attaque peu et bloque rarement. Pour apprendre les coups.",
  },
  normal: {
    label: "Normal",
    reaction: 0.22,
    agressivite: 0.6,
    garde: 0.45,
    cadence: 1.25,
    texte: "Il alterne attaque et garde. Il faut varier pour le battre.",
  },
  brutal: {
    label: "Brutal",
    reaction: 0.12,
    agressivite: 0.85,
    garde: 0.7,
    cadence: 0.85,
    texte: "Il punit chaque coup raté et bloque presque tout. Bon courage.",
  },
};

/** Degats reels d'un coup, une fois la force du personnage appliquee. */
export function degatsDe(coup: Coup, attaquant: Colosse, bloque: boolean): number {
  const brut = coup.degats * attaquant.force;
  return Math.round(bloque ? brut * BLOCAGE : brut);
}

/** Duree totale d'un coup, une fois la vitesse du personnage appliquee. */
export function dureeCoup(coup: Coup, c: Colosse): number {
  const facteur = 1 / (0.75 + c.vitesse * 0.25);
  return (coup.preparation + coup.actif + coup.recuperation) * facteur;
}
