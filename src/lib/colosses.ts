/**
 * Colosses — le jeu de combat 1 contre 1.
 *
 * Un jeu de combat tient a trois chiffres : combien de temps dure un coup,
 * combien de temps l'adversaire reste sonne, et combien il encaisse. Tout est
 * ici, en un seul endroit, pour pouvoir equilibrer sans fouiller la scene.
 *
 * Le vocabulaire : un coup a trois phases — le DEMARRAGE (on voit le coup
 * partir, on peut encore bloquer), l'ACTIF (la ou ca touche), et la
 * RECUPERATION (on est vulnerable). C'est ce decoupage qui rend un jeu de
 * combat juste : un coup puissant doit se voir venir et punir celui qui rate.
 *
 * Les zones de touche sont mesurees sur les vraies animations du combattant
 * (ou est le poing, ou est le pied, a chaque instant) : un coup touche quand
 * on le voit toucher, et rate quand on le voit rater.
 */

export type ColosseId = "roc" | "lame" | "eclair" | "brume";

/**
 * Hauteur d'un coup, c'est-a-dire comment on le bloque :
 * - haut : garde debout ; il passe au-dessus de quelqu'un d'accroupi ;
 * - moyen : garde debout ou accroupie ;
 * - bas : garde ACCROUPIE seulement ;
 * - plongeant (coups sautes) : garde DEBOUT seulement ;
 * - imparable : les projections, qui passent toutes les gardes.
 */
export type Hauteur = "haut" | "moyen" | "bas" | "plongeant" | "imparable";

export type AttaqueId =
  // les coups de tout le monde
  | "direct"
  | "cross"
  | "retourne"
  | "pied"
  | "uppercut"
  | "coupBas"
  | "balayette"
  | "poingSaute"
  | "piedSaute"
  | "projection"
  // les pouvoirs
  | "lameVolante"
  | "ruee"
  | "envol"
  | "rocher"
  | "charge"
  | "seisme"
  | "onde"
  | "torpille"
  | "decharge"
  | "voile"
  | "tourbillon"
  | "pasDeBrume"
  // la furie (barre d'energie pleine)
  | "furie";

export type FormeProjectile = "lame" | "rocher" | "onde" | "voile";

export interface ProjectileDef {
  forme: FormeProjectile;
  vitesse: number;
  degats: number;
  hauteur: Hauteur;
  /** Hauteur de vol au-dessus des pieds du lanceur. */
  y: number;
  rayon: number;
  /** Duree de vie, en secondes. */
  vie: number;
  /** La brume sonne au lieu de faire reculer. */
  sonne?: number;
}

export interface Attaque {
  id: AttaqueId;
  nom: string;
  /** Duree des trois phases, en secondes (avant la vitesse du personnage). */
  demarrage: number;
  actif: number;
  recuperation: number;
  degats: number;
  hauteur: Hauteur;
  /**
   * Zone de touche, en metres : de x[0] a x[1] devant le combattant, de y[0]
   * a y[1] au-dessus de ses pieds. Nulle pour un projectile ou une
   * teleportation.
   */
  zone: { x: [number, number]; y: [number, number] } | null;
  /** Frappe aussi derriere (tourbillon, decharge, seisme). */
  deuxCotes?: boolean;
  /** Recul de la cible quand le coup touche, puis quand il est bloque. */
  recul: number;
  reculGarde: number;
  /** Temps pendant lequel la cible touchee ne peut rien faire. */
  etourdit: number;
  /** Idem quand elle a bloque. */
  bloque: number;
  /**
   * Ce que le coup fait de plus :
   * - chute : la cible tombe (et se releve) ;
   * - envol : la cible part en l'air, on peut la reprendre au vol ;
   * - projection : saisie puis lancee (les projections) ;
   * - furie : declenche la sequence de la furie.
   */
  effet?: "chute" | "envol" | "projection" | "furie";
  /** Vitesse verticale donnee a la cible (envol). */
  envol?: number;
  /** Nombre de touches reparties sur l'actif (tourbillon). */
  touches?: number;
  /** Coups qu'on peut enchainer apres celui-ci, s'il a touche ou ete bloque. */
  suite?: { poing?: AttaqueId; pied?: AttaqueId };
  /** Peut etre annule en pouvoir quand il touche ou est bloque. */
  annulable?: boolean;
  /** Part des degats qui passe la garde (les pouvoirs grignotent). */
  copeaux?: number;
  /** Energie gagnee quand le coup touche. */
  energie: number;
  /** Energie depensee (la furie). */
  cout?: number;
  /** Deplacement pendant le coup : vitesse au sol (m/s) de `de` a `a` (secondes). */
  elan?: { vitesse: number; de: number; a: number; saut?: number };
  /** Intouchable pendant cette fenetre (secondes depuis le debut du coup). */
  invulnerable?: [number, number];
  projectile?: ProjectileDef;
  /** Coup donne en l'air : il s'arrete quand on retouche le sol. */
  aerien?: boolean;
  pouvoir?: boolean;
}

const A = (a: Attaque) => a;

export const ATTAQUES: Record<AttaqueId, Attaque> = {
  // ----------------------------------------------------------- au poing
  direct: A({
    id: "direct",
    nom: "Direct",
    demarrage: 0.08,
    actif: 0.07,
    recuperation: 0.16,
    degats: 5,
    hauteur: "haut",
    zone: { x: [0.25, 1.02], y: [1.38, 1.82] },
    recul: 0.45,
    reculGarde: 0.35,
    etourdit: 0.27,
    bloque: 0.17,
    suite: { poing: "cross", pied: "pied" },
    annulable: true,
    energie: 5,
  }),
  cross: A({
    id: "cross",
    nom: "Cross",
    demarrage: 0.09,
    actif: 0.08,
    recuperation: 0.2,
    degats: 6,
    hauteur: "haut",
    zone: { x: [0.25, 0.98], y: [1.36, 1.84] },
    recul: 0.55,
    reculGarde: 0.4,
    etourdit: 0.3,
    bloque: 0.19,
    suite: { pied: "retourne" },
    annulable: true,
    energie: 6,
    elan: { vitesse: 3, de: 0, a: 0.1 },
  }),
  uppercut: A({
    id: "uppercut",
    nom: "Uppercut",
    demarrage: 0.13,
    actif: 0.1,
    recuperation: 0.3,
    degats: 13,
    hauteur: "moyen",
    zone: { x: [0.2, 0.9], y: [0.7, 2.35] },
    recul: 1.2,
    reculGarde: 0.6,
    etourdit: 0.5,
    bloque: 0.22,
    effet: "envol",
    envol: 10.2,
    energie: 10,
  }),
  poingSaute: A({
    id: "poingSaute",
    nom: "Poing sauté",
    demarrage: 0.06,
    actif: 0.3,
    recuperation: 0.08,
    degats: 7,
    hauteur: "plongeant",
    zone: { x: [0.2, 0.95], y: [0.8, 1.45] },
    recul: 0.6,
    reculGarde: 0.45,
    etourdit: 0.36,
    bloque: 0.2,
    aerien: true,
    energie: 6,
  }),
  // ------------------------------------------------------------ au pied
  pied: A({
    id: "pied",
    nom: "Coup de pied",
    demarrage: 0.13,
    actif: 0.09,
    recuperation: 0.25,
    degats: 9,
    hauteur: "moyen",
    zone: { x: [0.3, 1.16], y: [0.82, 1.38] },
    recul: 1.0,
    reculGarde: 0.6,
    etourdit: 0.32,
    bloque: 0.2,
    annulable: true,
    energie: 8,
    elan: { vitesse: 1.6, de: 0, a: 0.12 },
  }),
  retourne: A({
    id: "retourne",
    nom: "Retourné",
    demarrage: 0.17,
    actif: 0.1,
    recuperation: 0.3,
    degats: 11,
    hauteur: "moyen",
    zone: { x: [0.3, 1.2], y: [0.9, 1.45] },
    recul: 2.4,
    reculGarde: 0.9,
    etourdit: 0.42,
    bloque: 0.22,
    energie: 9,
    elan: { vitesse: 2.6, de: 0, a: 0.16 },
  }),
  coupBas: A({
    id: "coupBas",
    nom: "Coup bas",
    demarrage: 0.08,
    actif: 0.07,
    recuperation: 0.17,
    degats: 4,
    hauteur: "bas",
    zone: { x: [0.3, 1.04], y: [0, 0.5] },
    recul: 0.4,
    reculGarde: 0.3,
    etourdit: 0.25,
    bloque: 0.15,
    annulable: true,
    energie: 5,
  }),
  balayette: A({
    id: "balayette",
    nom: "Balayette",
    demarrage: 0.15,
    actif: 0.11,
    recuperation: 0.4,
    degats: 8,
    hauteur: "bas",
    zone: { x: [0.25, 1.02], y: [0, 0.36] },
    recul: 0.6,
    reculGarde: 0.5,
    etourdit: 0.4,
    bloque: 0.2,
    effet: "chute",
    energie: 8,
  }),
  piedSaute: A({
    id: "piedSaute",
    nom: "Pied sauté",
    demarrage: 0.08,
    actif: 0.32,
    recuperation: 0.08,
    degats: 9,
    hauteur: "plongeant",
    zone: { x: [0.3, 0.98], y: [0.05, 0.62] },
    recul: 0.8,
    reculGarde: 0.5,
    etourdit: 0.4,
    bloque: 0.22,
    aerien: true,
    energie: 8,
  }),
  projection: A({
    id: "projection",
    nom: "Projection",
    demarrage: 0.06,
    actif: 0.06,
    recuperation: 0.36,
    degats: 12,
    hauteur: "imparable",
    zone: { x: [0, 0.95], y: [0.2, 1.9] },
    recul: 0,
    reculGarde: 0,
    etourdit: 0,
    bloque: 0,
    effet: "projection",
    energie: 9,
  }),

  // --------------------------------------------------------- les pouvoirs
  lameVolante: A({
    id: "lameVolante",
    nom: "Lame volante",
    demarrage: 0.2,
    actif: 0.05,
    recuperation: 0.32,
    degats: 10,
    hauteur: "moyen",
    zone: null,
    recul: 0.9,
    reculGarde: 0.6,
    etourdit: 0.38,
    bloque: 0.22,
    copeaux: 0.15,
    energie: 7,
    pouvoir: true,
    projectile: { forme: "lame", vitesse: 10, degats: 10, hauteur: "moyen", y: 1.2, rayon: 0.32, vie: 2.4 },
  }),
  ruee: A({
    id: "ruee",
    nom: "Ruée de la lame",
    demarrage: 0.12,
    actif: 0.16,
    recuperation: 0.34,
    degats: 11,
    hauteur: "moyen",
    zone: { x: [0.2, 1.35], y: [0.7, 1.65] },
    recul: 2.2,
    reculGarde: 0.8,
    etourdit: 0.45,
    bloque: 0.25,
    copeaux: 0.15,
    energie: 9,
    pouvoir: true,
    elan: { vitesse: 8, de: 0.06, a: 0.28 },
  }),
  envol: A({
    id: "envol",
    nom: "Envol tranchant",
    demarrage: 0.08,
    actif: 0.22,
    recuperation: 0.42,
    degats: 13,
    hauteur: "moyen",
    zone: { x: [0.1, 0.95], y: [0.5, 2.45] },
    recul: 1,
    reculGarde: 0.5,
    etourdit: 0.5,
    bloque: 0.2,
    effet: "envol",
    envol: 9.8,
    copeaux: 0.15,
    energie: 10,
    pouvoir: true,
    invulnerable: [0, 0.16],
    elan: { vitesse: 2.6, de: 0.06, a: 0.3, saut: 8.4 },
  }),
  rocher: A({
    id: "rocher",
    nom: "Rocher",
    demarrage: 0.28,
    actif: 0.05,
    recuperation: 0.4,
    degats: 13,
    hauteur: "moyen",
    zone: null,
    recul: 1.4,
    reculGarde: 0.8,
    etourdit: 0.45,
    bloque: 0.26,
    copeaux: 0.15,
    energie: 8,
    pouvoir: true,
    projectile: { forme: "rocher", vitesse: 7.5, degats: 13, hauteur: "moyen", y: 1.0, rayon: 0.44, vie: 2.6 },
  }),
  charge: A({
    id: "charge",
    nom: "Charge d'épaule",
    demarrage: 0.18,
    actif: 0.3,
    recuperation: 0.36,
    degats: 13,
    hauteur: "moyen",
    zone: { x: [0, 1.0], y: [0.5, 1.75] },
    recul: 3.2,
    reculGarde: 1,
    etourdit: 0.5,
    bloque: 0.3,
    effet: "chute",
    copeaux: 0.15,
    energie: 10,
    pouvoir: true,
    elan: { vitesse: 11, de: 0.12, a: 0.48 },
  }),
  seisme: A({
    id: "seisme",
    nom: "Séisme",
    demarrage: 0.32,
    actif: 0.14,
    recuperation: 0.4,
    degats: 11,
    hauteur: "bas",
    zone: { x: [-0.5, 2.6], y: [0, 0.45] },
    recul: 0.8,
    reculGarde: 0.7,
    etourdit: 0.45,
    bloque: 0.26,
    effet: "chute",
    copeaux: 0.15,
    energie: 9,
    pouvoir: true,
  }),
  onde: A({
    id: "onde",
    nom: "Onde de choc",
    demarrage: 0.16,
    actif: 0.05,
    recuperation: 0.3,
    degats: 9,
    hauteur: "moyen",
    zone: null,
    recul: 0.8,
    reculGarde: 0.5,
    etourdit: 0.36,
    bloque: 0.2,
    copeaux: 0.15,
    energie: 7,
    pouvoir: true,
    projectile: { forme: "onde", vitesse: 13, degats: 9, hauteur: "moyen", y: 1.45, rayon: 0.28, vie: 2 },
  }),
  torpille: A({
    id: "torpille",
    nom: "Torpille",
    demarrage: 0.1,
    actif: 0.24,
    recuperation: 0.3,
    degats: 10,
    hauteur: "moyen",
    zone: { x: [0.2, 1.12], y: [0.55, 1.5] },
    recul: 2.6,
    reculGarde: 0.9,
    etourdit: 0.45,
    bloque: 0.24,
    copeaux: 0.15,
    energie: 9,
    pouvoir: true,
    elan: { vitesse: 13, de: 0.08, a: 0.34 },
  }),
  decharge: A({
    id: "decharge",
    nom: "Décharge",
    demarrage: 0.12,
    actif: 0.18,
    recuperation: 0.4,
    degats: 10,
    hauteur: "moyen",
    zone: { x: [-1.25, 1.3], y: [0, 2.6] },
    deuxCotes: true,
    recul: 1.2,
    reculGarde: 0.9,
    etourdit: 0.45,
    bloque: 0.25,
    effet: "envol",
    envol: 6.5,
    copeaux: 0.15,
    energie: 9,
    pouvoir: true,
    invulnerable: [0, 0.12],
  }),
  voile: A({
    id: "voile",
    nom: "Voile de brume",
    demarrage: 0.22,
    actif: 0.05,
    recuperation: 0.35,
    degats: 7,
    hauteur: "moyen",
    zone: null,
    recul: 0.3,
    reculGarde: 0.5,
    etourdit: 0.36,
    bloque: 0.22,
    copeaux: 0.15,
    energie: 7,
    pouvoir: true,
    projectile: { forme: "voile", vitesse: 5.5, degats: 7, hauteur: "moyen", y: 1.5, rayon: 0.36, vie: 3.2, sonne: 0.95 },
  }),
  tourbillon: A({
    id: "tourbillon",
    nom: "Tourbillon",
    demarrage: 0.14,
    actif: 0.42,
    recuperation: 0.3,
    degats: 4,
    hauteur: "moyen",
    zone: { x: [-1.05, 1.15], y: [0.6, 1.85] },
    deuxCotes: true,
    touches: 3,
    recul: 0.35,
    reculGarde: 0.3,
    etourdit: 0.34,
    bloque: 0.2,
    copeaux: 0.15,
    energie: 4,
    pouvoir: true,
    elan: { vitesse: 3, de: 0.14, a: 0.56 },
  }),
  pasDeBrume: A({
    id: "pasDeBrume",
    nom: "Pas de brume",
    demarrage: 0.18,
    actif: 0.04,
    recuperation: 0.24,
    degats: 0,
    hauteur: "moyen",
    zone: null,
    recul: 0,
    reculGarde: 0,
    etourdit: 0,
    bloque: 0,
    energie: 0,
    pouvoir: true,
    invulnerable: [0, 0.46],
  }),

  // ------------------------------------------------------------ la furie
  furie: A({
    id: "furie",
    nom: "Furie",
    demarrage: 0.22,
    actif: 0.14,
    recuperation: 0.6,
    degats: 0,
    hauteur: "moyen",
    zone: { x: [0, 1.25], y: [0.3, 1.95] },
    recul: 0,
    reculGarde: 1,
    etourdit: 0,
    bloque: 0.35,
    effet: "furie",
    copeaux: 0.1,
    energie: 0,
    cout: 100,
    pouvoir: true,
    invulnerable: [0, 0.3],
    elan: { vitesse: 9, de: 0.04, a: 0.3 },
  }),
};

/** Les trois pouvoirs, dans l'ordre : la combinaison et le raccourci. */
export const CODES_POUVOIRS = [
  { code: "↓ → + Poing", raccourci: "Pouvoir" },
  { code: "← → + Poing", raccourci: "→ + Pouvoir" },
  { code: "↓ ← + Pied", raccourci: "↓ + Pouvoir" },
] as const;

export interface Colosse {
  id: ColosseId;
  nom: string;
  /** « il » ou « elle » : « Achève-le ! » ou « Achève-la ! ». */
  pronom: "il" | "elle";
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
  /** Le style du coup signature : il sert aux poses du modele de secours. */
  special: "onde" | "charge" | "uppercut" | "tourbillon";
  specialTexte: string;
  /** Les trois pouvoirs, dans l'ordre des codes (CODES_POUVOIRS). */
  pouvoirs: [AttaqueId, AttaqueId, AttaqueId];
  /** La furie : son nom et ce qu'elle fait. */
  furie: { nom: string; texte: string };
  /** Le coup de grace, apres « Acheve-le ! ». Aucune goutte de sang : c'est la regle. */
  grace: { nom: string; texte: string };
  /**
   * La silhouette. Un jeu de combat se lit de loin : on doit reconnaitre
   * chaque personnage a sa forme, avant meme sa couleur.
   */
  allure: {
    /** Carrure : multiplie la largeur des epaules et du torse. */
    carrure: number;
    /** Taille generale. */
    taille: number;
    /** Ce qu'il porte sur la tete. */
    tete: "masque" | "capuche" | "crane" | "casque";
    /** Cape dans le dos. */
    cape: boolean;
    /** Epaulieres massives. */
    epaulieres: boolean;
    /** Couleur du tissu (masque, capuche, ceinture, cape). */
    tissu: number;
  };
}

export const COLOSSES: Record<ColosseId, Colosse> = {
  roc: {
    id: "roc",
    nom: "Roc",
    pronom: "il",
    phrase: "Lent, lourd, difficile à faire tomber.",
    emoji: "🪨",
    peau: 0x8a8378,
    armure: 0x4a4740,
    accent: 0xffb454,
    vitesse: 0.82,
    force: 1.22,
    vie: 190,
    special: "charge",
    specialTexte: "Charge d'épaule, rocher lancé et séisme qui fait tomber.",
    pouvoirs: ["rocher", "charge", "seisme"],
    furie: { nom: "Avalanche", texte: "Il fonce, soulève l'adversaire et l'écrase au sol." },
    grace: { nom: "Pétrification", texte: "L'adversaire se change en statue… qui s'effondre en gravats." },
    allure: { carrure: 1.28, taille: 1.08, tete: "crane", cape: false, epaulieres: true, tissu: 0x7a3b12 },
  },
  lame: {
    id: "lame",
    nom: "Lame",
    pronom: "il",
    phrase: "Équilibré. Le bon choix pour apprendre.",
    emoji: "⚔️",
    peau: 0xc9d2da,
    armure: 0x2f3a46,
    accent: 0x4ad6ff,
    vitesse: 1,
    force: 1,
    vie: 160,
    special: "uppercut",
    specialTexte: "Lame volante, ruée et envol tranchant contre les sauts.",
    pouvoirs: ["lameVolante", "ruee", "envol"],
    furie: { nom: "Jugement", texte: "Une volée de coups de lame, puis un uppercut qui envoie au ciel." },
    grace: { nom: "Rayon du ciel", texte: "Un rayon de lumière emporte l'adversaire jusqu'aux étoiles." },
    allure: { carrure: 1, taille: 1, tete: "casque", cape: true, epaulieres: false, tissu: 0x1d4e7a },
  },
  eclair: {
    id: "eclair",
    nom: "Éclair",
    pronom: "il",
    phrase: "Rapide et fragile. Frappe et recule.",
    emoji: "⚡",
    peau: 0xf4e28a,
    armure: 0x3a2f14,
    accent: 0xfff275,
    vitesse: 1.3,
    force: 0.84,
    vie: 134,
    special: "onde",
    specialTexte: "Onde de choc, torpille fulgurante et décharge autour de lui.",
    pouvoirs: ["onde", "torpille", "decharge"],
    furie: { nom: "Tempête", texte: "Il traverse l'adversaire dans tous les sens, plus vite que l'œil." },
    grace: { nom: "Foudre", texte: "La foudre tombe trois fois : l'adversaire finit noirci et fumant." },
    allure: { carrure: 0.9, taille: 0.97, tete: "masque", cape: false, epaulieres: false, tissu: 0x2b2b2b },
  },
  brume: {
    id: "brume",
    nom: "Brume",
    pronom: "elle",
    phrase: "Insaisissable : elle tourne autour de toi.",
    emoji: "🌫️",
    peau: 0xb3a7d6,
    armure: 0x2a2440,
    accent: 0xc084fc,
    vitesse: 1.12,
    force: 0.94,
    vie: 148,
    special: "tourbillon",
    specialTexte: "Voile qui étourdit, tourbillon et téléportation dans ton dos.",
    pouvoirs: ["voile", "tourbillon", "pasDeBrume"],
    furie: { nom: "Cauchemar", texte: "Elle disparaît et frappe de partout à la fois." },
    grace: { nom: "Dissipation", texte: "La brume enveloppe l'adversaire, qui s'efface comme un mauvais rêve." },
    allure: { carrure: 0.94, taille: 1.02, tete: "capuche", cape: true, epaulieres: false, tissu: 0x3b2a5e },
  },
};

export const COLOSSE_ORDER: ColosseId[] = ["lame", "roc", "eclair", "brume"];

/**
 * Le dernier adversaire du tournoi : le double sombre du personnage choisi.
 * Meme style de combat, mais plus grand et plus resistant — on finit contre
 * son propre reflet, ce qui oblige a connaitre son personnage par coeur.
 */
export function colosseOmbre(id: ColosseId): Colosse {
  const c = COLOSSES[id];
  return {
    ...c,
    nom: `${c.nom} d'Ombre`,
    phrase: "Ton reflet. Il connaît tous tes coups.",
    emoji: "👤",
    peau: 0x2a2632,
    armure: 0x0d0c12,
    accent: 0xff3b4a,
    vie: Math.round(c.vie * 1.3),
    force: c.force * 1.08,
    allure: { ...c.allure, taille: c.allure.taille * 1.12, tissu: 0x3a0c14 },
  };
}

/** Un combat du tournoi : qui, a quel niveau, et s'il s'agit du boss. */
export interface EtapeTournoi {
  adversaire: ColosseId;
  difficulte: Difficulte;
  boss: boolean;
}

/**
 * Le tournoi : les trois autres combattants, du plus facile au plus dur,
 * puis le reflet. La marche monte doucement — un joueur qui perd au premier
 * combat ne revient pas.
 */
export function echelleTournoi(joueur: ColosseId): EtapeTournoi[] {
  const niveaux: Difficulte[] = ["tranquille", "normal", "normal"];
  const autres = COLOSSE_ORDER.filter((id) => id !== joueur);
  return [
    ...autres.map((adversaire, i) => ({ adversaire, difficulte: niveaux[i] ?? "normal", boss: false })),
    { adversaire: joueur, difficulte: "brutal", boss: true },
  ];
}

// --------------------------------------------------------------- reglages

/** Largeur jouable de l'arene, de -X a +X. */
export const ARENE = 9;
export const GRAVITE = 26;
export const SAUT = 9.2;
/** Vitesse horizontale d'un saut en avant ou en arriere. */
export const SAUT_ELAN = 3.6;
export const VITESSE = 5.2;
/** Distance minimale entre deux combattants : ils ne se traversent pas. */
export const ECART_MIN = 1.0;

export const ROUNDS_A_GAGNER = 2;
export const DUREE_ROUND = 60;

/**
 * Corps a corps : la place que prend un combattant, selon sa posture (demi
 * largeur, puis bas et haut au-dessus de ses pieds). Mesure sur le modele.
 */
export const CORPS = {
  debout: { l: 0.34, y: [0, 1.96] as [number, number] },
  accroupi: { l: 0.4, y: [0, 1.12] as [number, number] },
  saut: { l: 0.32, y: [0.15, 1.86] as [number, number] },
  jongle: { l: 0.46, y: [0.1, 1.35] as [number, number] },
};

/** Energie maximale ; la furie en coute 100, le brise-combo 50. */
export const ENERGIE_MAX = 100;
export const COUT_BRISE = 50;
/** Reduction des degats a chaque coup d'un meme combo (10 % par coup). */
export const ECHELLE_COMBO = 0.1;
/** Au-dela, un adversaire en l'air n'est plus relance : il retombe. */
export const JONGLES_MAX = 4;
/** Temps au sol apres une chute, puis le temps de se relever (intouchable). */
export const AU_SOL = 0.55;
export const RELEVE = 0.4;
/** Temps pour achever l'adversaire apres « Acheve-le ! ». */
export const DUREE_ACHEVE = 5;

export type Difficulte = "tranquille" | "normal" | "brutal";

export interface ReglageIA {
  label: string;
  /** Temps de reaction, en secondes. */
  reaction: number;
  /** Envie d'attaquer (0 a 1). */
  agressivite: number;
  /** Chance de lever la garde a temps. */
  garde: number;
  /** Chance de choisir la bonne garde (debout ou accroupie). */
  lecture: number;
  /** Temps minimal entre deux attaques. */
  cadence: number;
  /** Chance d'enchainer un combo complet. */
  combo: number;
  /** Chance de contrer un saut par un uppercut. */
  antiAerien: number;
  /** Chance d'utiliser un pouvoir quand c'est le bon moment. */
  pouvoirs: number;
  /** Chance de punir un coup rate ou bloque. */
  punition: number;
  texte: string;
}

export const DIFFICULTES: Record<Difficulte, ReglageIA> = {
  tranquille: {
    label: "Tranquille",
    reaction: 0.45,
    agressivite: 0.45,
    garde: 0.25,
    lecture: 0.35,
    cadence: 1.3,
    combo: 0.15,
    antiAerien: 0.08,
    pouvoirs: 0.25,
    punition: 0.1,
    texte: "Il attaque peu et bloque rarement. Pour apprendre les coups.",
  },
  normal: {
    label: "Normal",
    reaction: 0.25,
    agressivite: 0.6,
    garde: 0.5,
    lecture: 0.6,
    cadence: 1.0,
    combo: 0.45,
    antiAerien: 0.3,
    pouvoirs: 0.5,
    punition: 0.4,
    texte: "Il alterne attaque et garde, et sort ses pouvoirs. Il faut varier pour le battre.",
  },
  brutal: {
    label: "Brutal",
    reaction: 0.14,
    agressivite: 0.85,
    garde: 0.75,
    lecture: 0.85,
    cadence: 0.6,
    combo: 0.8,
    antiAerien: 0.6,
    pouvoirs: 0.75,
    punition: 0.75,
    texte: "Il punit chaque coup raté, contre les sauts et enchaîne les combos. Bon courage.",
  },
};

/** Multiplicateur de duree des coups selon la vitesse du personnage. */
export function facteurVitesse(c: Colosse): number {
  return 1 / (0.75 + c.vitesse * 0.25);
}

/** Duree totale d'un coup, une fois la vitesse du personnage appliquee. */
export function dureeAttaque(a: Attaque, c: Colosse): number {
  return (a.demarrage + a.actif + a.recuperation) * facteurVitesse(c);
}

/** La liste des coups d'un personnage, pour l'aide et la pause. */
export interface LigneCoup {
  touches: string;
  nom: string;
  detail: string;
}

export function listeDesCoups(c: Colosse): { base: LigneCoup[]; pouvoirs: LigneCoup[]; furie: LigneCoup; grace: LigneCoup } {
  const base: LigneCoup[] = [
    { touches: "Poing", nom: "Direct", detail: "Rapide, en haut : passe au-dessus d'un adversaire accroupi." },
    { touches: "Poing, Poing, Pied", nom: "Enchaînement", detail: "Direct, cross puis retourné : trois coups d'affilée." },
    { touches: "Pied", nom: "Coup de pied", detail: "Au milieu : touche même un adversaire accroupi." },
    { touches: "→ + Pied", nom: "Retourné", detail: "Plus lent, mais il repousse loin." },
    { touches: "↓ + Poing", nom: "Uppercut", detail: "Envoie en l'air : relance-le au vol ! Arrête aussi les sauts." },
    { touches: "↓ + Pied", nom: "Coup bas", detail: "Rapide, au ras du sol : à bloquer accroupi." },
    { touches: "← + Pied", nom: "Balayette", detail: "Fait tomber. À bloquer accroupi." },
    { touches: "Saut + Poing / Pied", nom: "Coups sautés", detail: "Plongeants : à bloquer debout." },
    { touches: "Poing + Pied (collé)", nom: "Projection", detail: "Passe toutes les gardes. Poing + Pied à temps pour se dégager." },
    { touches: "Garde (ou reculer)", nom: "Garde", detail: "Debout contre le haut et le milieu, accroupie contre le bas." },
    { touches: "Garde + → (en plein combo)", nom: "Brise-combo", detail: "Coûte la moitié de la barre : repousse l'attaquant." },
  ];
  const pouvoirs = c.pouvoirs.map((id, i) => ({
    touches: `${CODES_POUVOIRS[i].code}  ou  ${CODES_POUVOIRS[i].raccourci}`,
    nom: ATTAQUES[id].nom,
    detail: DETAIL_POUVOIR[id] ?? "",
  }));
  return {
    base,
    pouvoirs,
    furie: { touches: "Garde + Pouvoir (barre pleine)", nom: c.furie.nom, detail: c.furie.texte },
    grace: { touches: "↓ → ↓ + Pouvoir (après « Achève-le ! »)", nom: c.grace.nom, detail: c.grace.texte },
  };
}

const DETAIL_POUVOIR: Partial<Record<AttaqueId, string>> = {
  lameVolante: "Une lame d'énergie qui file droit devant.",
  ruee: "Il traverse la moitié de l'arène, lame en avant.",
  envol: "Uppercut sauté, intouchable au départ : parfait contre les sauts.",
  rocher: "Un bloc énorme, lent : impossible de passer dessous.",
  charge: "Il fonce épaule en avant et renverse tout.",
  seisme: "Le sol tremble devant lui : à bloquer accroupi, sinon on tombe.",
  onde: "Très rapide. Elle passe au-dessus d'un adversaire accroupi.",
  torpille: "Un coup de pied volant qui traverse l'arène.",
  decharge: "L'électricité jaillit tout autour de lui et envoie en l'air.",
  voile: "Une boule de brume lente : qui la prend reste étourdi.",
  tourbillon: "Trois coups en tournant, devant et derrière.",
  pasDeBrume: "Elle disparaît et réapparaît dans ton dos.",
};
