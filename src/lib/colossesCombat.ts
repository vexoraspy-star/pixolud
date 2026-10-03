import {
  ARENE,
  ATTAQUES,
  AU_SOL,
  COLOSSES,
  CORPS,
  COUT_BRISE,
  DUREE_ACHEVE,
  DUREE_ROUND,
  ECART_MIN,
  ECHELLE_COMBO,
  ENERGIE_MAX,
  GRAVITE,
  JONGLES_MAX,
  RELEVE,
  ROUNDS_A_GAGNER,
  SAUT,
  SAUT_ELAN,
  VITESSE,
  colosseOmbre,
  facteurVitesse,
  type Attaque,
  type AttaqueId,
  type Colosse,
  type ColosseId,
  type Hauteur,
  type ProjectileDef,
} from "./colosses";

/**
 * Colosses : le moteur de combat, sans rien a l'ecran.
 *
 * Tout ce qui decide d'un combat est ici — qui touche qui, qui bloque, qui
 * tombe, qui gagne le round — et rien d'autre : pas de Three.js, pas de
 * clavier. La scene lit l'etat des combattants pour les dessiner et ecoute
 * les evenements (un coup qui touche, un projectile qui part) pour le son et
 * les etincelles. L'ordinateur passe par la meme porte que le joueur : il
 * envoie des commandes, il n'a aucun passe-droit.
 *
 * Separer les regles de l'image permet aussi de les verifier sans navigateur :
 * on fait se battre deux ordinateurs mille fois et on regarde si un coup
 * touche quand il doit toucher.
 */

export type Cote = "A" | "B";

/**
 * Ce que le joueur demande a cette image. Les « pressee » ne valent que pour
 * l'image ou la touche vient d'etre enfoncee.
 */
export interface Commande {
  gauche: boolean;
  droite: boolean;
  haut: boolean;
  bas: boolean;
  /** Touche de garde maintenue. */
  garde: boolean;
  poing: boolean;
  pied: boolean;
  pouvoir: boolean;
  gardePressee: boolean;
  gauchePressee: boolean;
  droitePressee: boolean;
  basPresse: boolean;
  hautPresse: boolean;
  /** L'ordinateur demande directement un pouvoir (il ne tape pas les codes). */
  ordre?: AttaqueId | "grace";
}

export function commandeVide(): Commande {
  return {
    gauche: false,
    droite: false,
    haut: false,
    bas: false,
    garde: false,
    poing: false,
    pied: false,
    pouvoir: false,
    gardePressee: false,
    gauchePressee: false,
    droitePressee: false,
    basPresse: false,
    hautPresse: false,
  };
}

/**
 * Ce que vit un combattant :
 * - libre : debout, accroupi, en marche, en garde ou en saut ;
 * - attaque : un coup en cours (voir `action`) ;
 * - touche / garde : sonne par un coup recu ou bloque ;
 * - jongle : envoye en l'air, on peut encore le frapper ;
 * - chute, sol, releve : il tombe, reste a terre, se releve (intouchable) ;
 * - saisi : pris dans une projection ;
 * - sonne : etourdi (voile de brume, ou « Acheve-le ! ») ;
 * - furie, subit : la sequence de la furie, des deux cotes ;
 * - ko, victoire : la fin du round.
 */
export type Etat =
  | "libre"
  | "attaque"
  | "touche"
  | "garde"
  | "jongle"
  | "chute"
  | "sol"
  | "releve"
  | "saisi"
  | "sonne"
  | "furie"
  | "subit"
  | "ko"
  | "victoire";

export interface ActionEnCours {
  id: AttaqueId;
  /** Temps ecoule depuis le debut du coup (deja ramene a la vitesse du personnage). */
  t: number;
  /** Touches deja donnees (les coups multiples en ont plusieurs). */
  touches: number;
  contact: "rien" | "touche" | "garde";
  /** Coup demande pour la suite (enchainement ou pouvoir). */
  suite: AttaqueId | null;
  /** Projectile parti, teleportation faite, saut donne. */
  lance: boolean;
  elanDonne: boolean;
}

type Direction = "B" | "AV" | "AR" | "H";

export interface Combattant {
  cote: Cote;
  perso: Colosse;
  /** Echelle du corps (la taille du personnage). */
  taille: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Glissade au sol apres un coup (m/s), amortie. */
  glisse: number;
  /** +1 regarde a droite, -1 a gauche. */
  sens: 1 | -1;
  vie: number;
  energie: number;
  etat: Etat;
  /** Temps restant dans l'etat subi (touche, garde, sol, releve...). */
  minuteur: number;
  action: ActionEnCours | null;
  accroupi: boolean;
  /** Garde levee (sans etre en train d'encaisser). */
  enGarde: boolean;
  /** Direction de marche de l'image, dans le repere du monde. */
  marche: number;
  /** Pas rapide en cours (double appui). */
  pas: number;
  pasSens: number;
  /** Coup saute deja donne pendant ce saut. */
  coupSaute: boolean;
  invulnerable: number;
  /** Combo subi en ce moment. */
  combo: { coups: number; degats: number; jongles: number };
  /** Dernier combo subi, garde un instant pour l'affichage. */
  dernierCombo: { coups: number; degats: number; quand: number };
  /** Touche au visage (la tete part en arriere) ou au corps. */
  toucheHaut: boolean;
  /** Compteur d'impacts : chaque nouveau coup recu relance l'animation. */
  impacts: number;
  /** Projection : par qui, et le temps restant pour se degager. */
  saisiPar: Combattant | null;
  degagement: number;
  /** Disparu de l'arene (coup de grace, teleportation en cours). */
  cache: boolean;
  historique: { k: Direction; t: number }[];
  dernierAppui: { gauche: number; droite: number };
  /**
   * Memoire des boutons : un appui reste valable un dixieme de seconde. On
   * peut ainsi appuyer un poil avant la fin d'un coup, ou pendant un arret sur
   * image, sans que la touche se perde.
   */
  tampon: { poing: number; pied: number; pouvoir: number };
  /** Le brise-combo a deja servi pendant ce combo. */
  briseUtilise: boolean;
  /** Le round a ete gagne sans perdre un point de vie. */
  intact: boolean;
}

export interface Projectile {
  id: number;
  auteur: Combattant;
  attaque: AttaqueId;
  def: ProjectileDef;
  x: number;
  y: number;
  sens: 1 | -1;
  vie: number;
  rayon: number;
}

export type Phase = "annonce" | "combat" | "acheve" | "grace" | "finRound" | "fini";

export type Evenement =
  | { type: "coup"; qui: Combattant; attaque: AttaqueId }
  | { type: "pouvoir"; qui: Combattant; attaque: AttaqueId }
  | {
      type: "touche";
      attaquant: Combattant;
      cible: Combattant;
      attaque: AttaqueId;
      degats: number;
      bloque: boolean;
      contre: boolean;
      x: number;
      y: number;
      lourd: boolean;
      projectile: boolean;
    }
  | { type: "projectile"; p: Projectile }
  | { type: "projectileFin"; p: Projectile; touche: boolean }
  | { type: "choc"; x: number; y: number }
  | { type: "saut"; qui: Combattant }
  | { type: "sol"; qui: Combattant }
  | { type: "chute"; qui: Combattant }
  | { type: "seisme"; qui: Combattant; x: number }
  | { type: "decharge"; qui: Combattant }
  | { type: "teleport"; qui: Combattant; de: number; vers: number }
  | { type: "saisie"; qui: Combattant; cible: Combattant }
  | { type: "message"; cote: Cote | null; texte: string }
  | { type: "furie"; qui: Combattant; cible: Combattant }
  | { type: "furieCoup"; qui: Combattant; cible: Combattant; final: boolean; x: number; y: number }
  | { type: "acheve"; vainqueur: Combattant; perdant: Combattant }
  | { type: "grace"; qui: Combattant; cible: Combattant }
  | { type: "ko"; perdant: Combattant | null; parKo: boolean }
  | { type: "gong" }
  | { type: "fin"; vainqueur: Cote };

export interface Furie {
  auteur: Combattant;
  victime: Combattant;
  t: number;
  coups: number;
}

export interface Grace {
  auteur: Combattant;
  victime: Combattant;
  id: ColosseId;
  t: number;
}

/** Duree de la sequence de la furie, et de celle du coup de grace. */
export const DUREE_FURIE = 2.3;
/** Les instants des cinq coups de la furie. */
export const TEMPS_FURIE = [0.28, 0.55, 0.82, 1.08, 1.5];
export const DUREE_GRACE = 3.6;

/** Duree de la memoire des boutons. */
const TAMPON = 0.1;
/** Apres « Acheve-le ! », les frappes du vainqueur sont ignorees ce temps-la. */
const REPIT_ACHEVE = 0.8;

/** Fenetre des codes : entre deux directions, puis jusqu'au bouton. */
const ECART_CODE = 0.4;
const DELAI_BOUTON = 0.3;

const CODES: { suite: Direction[]; bouton: "poing" | "pied" | "pouvoir"; slot: number }[] = [
  { suite: ["B", "AV"], bouton: "poing", slot: 0 },
  { suite: ["AR", "AV"], bouton: "poing", slot: 1 },
  { suite: ["B", "AR"], bouton: "pied", slot: 2 },
];
const CODE_GRACE: Direction[] = ["B", "AV", "B"];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function nouveauCombattant(cote: Cote, perso: Colosse): Combattant {
  return {
    cote,
    perso,
    taille: perso.allure.taille,
    x: cote === "A" ? -2.6 : 2.6,
    y: 0,
    vx: 0,
    vy: 0,
    glisse: 0,
    sens: cote === "A" ? 1 : -1,
    vie: perso.vie,
    energie: 0,
    etat: "libre",
    minuteur: 0,
    action: null,
    accroupi: false,
    enGarde: false,
    marche: 0,
    pas: 0,
    pasSens: 0,
    coupSaute: false,
    invulnerable: 0,
    combo: { coups: 0, degats: 0, jongles: 0 },
    dernierCombo: { coups: 0, degats: 0, quand: -10 },
    toucheHaut: false,
    impacts: 0,
    saisiPar: null,
    degagement: 0,
    cache: false,
    historique: [],
    dernierAppui: { gauche: -10, droite: -10 },
    tampon: { poing: 0, pied: 0, pouvoir: 0 },
    briseUtilise: false,
    intact: true,
  };
}

/** Une boite : de x0 a x1, de y0 a y1 (repere du monde). */
interface Boite {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

const chevauche = (p: Boite, q: Boite) => p.x0 <= q.x1 && q.x0 <= p.x1 && p.y0 <= q.y1 && q.y0 <= p.y1;

/** La zone de touche d'un coup, dans le monde. */
export function zoneDuCoup(c: Combattant, a: Attaque): Boite | null {
  if (!a.zone) return null;
  const t = c.taille;
  const xa = c.x + c.sens * a.zone.x[0] * t;
  const xb = c.x + c.sens * a.zone.x[1] * t;
  return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), y0: c.y + a.zone.y[0] * t, y1: c.y + a.zone.y[1] * t };
}

/** Intouchable : a terre, en train de se relever, ou pendant certains coups. */
export function intouchable(c: Combattant): boolean {
  if (c.invulnerable > 0 || c.cache) return true;
  if (c.etat === "sol" || c.etat === "releve" || c.etat === "chute" || c.etat === "ko") return true;
  if (c.etat === "saisi" || c.etat === "subit" || c.etat === "furie" || c.etat === "victoire") return true;
  if (c.etat === "attaque" && c.action) {
    const inv = ATTAQUES[c.action.id].invulnerable;
    if (inv && c.action.t >= inv[0] && c.action.t <= inv[1]) return true;
  }
  return false;
}

/**
 * Le corps d'un combattant : ou on peut le toucher. Pendant un coup, le
 * membre tendu compte aussi — on peut punir une jambe qui traine.
 */
export function corpsDe(c: Combattant): Boite[] {
  if (intouchable(c)) return [];
  const t = c.taille;
  const forme =
    c.etat === "jongle" ? CORPS.jongle : c.y > 0.05 ? CORPS.saut : c.accroupi ? CORPS.accroupi : CORPS.debout;
  const boites: Boite[] = [{ x0: c.x - forme.l * t, x1: c.x + forme.l * t, y0: c.y + forme.y[0] * t, y1: c.y + forme.y[1] * t }];
  if (c.etat === "attaque" && c.action) {
    const a = ATTAQUES[c.action.id];
    const fin = a.demarrage + a.actif + a.recuperation * 0.5;
    if (a.zone && !a.deuxCotes && c.action.t >= a.demarrage && c.action.t <= fin) {
      const z = zoneDuCoup(c, a)!;
      const marge = (z.x1 - z.x0) * 0.1;
      boites.push({ x0: z.x0 + marge, x1: z.x1 - marge, y0: z.y0, y1: z.y1 });
    }
  }
  return boites;
}

/** Une partie : deux combattants, les rounds, et tout ce qui se passe entre eux. */
export class Combat {
  a: Combattant;
  b: Combattant;
  projectiles: Projectile[] = [];
  phase: Phase = "annonce";
  /** Temps passe dans la phase courante. */
  chrono = 0;
  temps = DUREE_ROUND;
  round = 1;
  roundsA = 0;
  roundsB = 0;
  annonce = "";
  vainqueur: Cote | null = null;
  gagnantRound: Cote | null = null;
  horloge = 0;
  /** Arret sur image (impact) : le temps du combat ne s'ecoule pas. */
  gel = 0;
  furie: Furie | null = null;
  grace: Grace | null = null;
  acheve: { vainqueur: Combattant; perdant: Combattant; t: number; impacts: number } | null = null;
  /** Le round s'est fini par un coup de grace (pour l'annonce). */
  parGrace = false;
  private evenements: Evenement[] = [];
  private prochainId = 1;

  constructor(persoA: ColosseId, persoB: ColosseId, boss = false) {
    this.a = nouveauCombattant("A", COLOSSES[persoA]);
    this.b = nouveauCombattant("B", boss ? colosseOmbre(persoB) : COLOSSES[persoB]);
    this.nouveauRound();
  }

  get combattants(): [Combattant, Combattant] {
    return [this.a, this.b];
  }

  autre(c: Combattant): Combattant {
    return c === this.a ? this.b : this.a;
  }

  private emettre(e: Evenement) {
    this.evenements.push(e);
  }

  // ============================================================ deroulement

  private nouveauRound() {
    for (const c of this.combattants) {
      Object.assign(c, nouveauCombattant(c.cote, c.perso));
    }
    this.projectiles = [];
    this.furie = null;
    this.grace = null;
    this.acheve = null;
    this.parGrace = false;
    this.temps = DUREE_ROUND;
    this.phase = "annonce";
    this.chrono = 0;
    this.annonce = `Round ${this.round}`;
    this.emettre({ type: "gong" });
  }

  /** Un round se termine : le perdant tombe, puis le gagnant savoure. */
  private finDeRound(gagnant: Cote | null, parKo: boolean) {
    this.gagnantRound = gagnant;
    if (gagnant === "A") this.roundsA++;
    if (gagnant === "B") this.roundsB++;
    this.phase = "finRound";
    this.chrono = 0;
    this.annonce = parKo ? "K.O. !" : gagnant === null ? "Égalité" : "Temps écoulé";
    if (this.parGrace) this.annonce = "Coup de grâce !";
    this.projectiles = [];
    this.furie = null;
    const perdant = gagnant === null ? null : gagnant === "A" ? this.b : this.a;
    for (const c of this.combattants) {
      if (parKo && (c === perdant || (perdant === null && c.vie <= 0))) {
        c.etat = "ko";
        c.action = null;
      } else if (c.etat !== "ko") {
        // Le survivant se remet en garde, quoi qu'il faisait.
        c.etat = "libre";
        c.action = null;
        c.accroupi = false;
        c.enGarde = false;
      }
    }
    this.emettre({ type: "ko", perdant, parKo });
  }

  /**
   * Une image de combat. Rend faux pendant un arret sur image : les touches
   * pressees doivent alors rester en attente, sinon elles se perdent.
   */
  etape(dt: number, cmdA: Commande, cmdB: Commande): boolean {
    if (this.gel > 0) {
      this.gel -= dt;
      return false;
    }
    this.horloge += dt;
    this.chrono += dt;

    switch (this.phase) {
      case "annonce":
        this.annonce = this.chrono < 1.2 ? `Round ${this.round}` : "Combattez !";
        if (this.chrono >= 2) {
          this.phase = "combat";
          this.annonce = "";
        }
        break;
      case "combat":
        this.temps -= dt;
        this.majCombattants(dt, cmdA, cmdB);
        this.verifierFin();
        break;
      case "acheve":
        this.majAcheve(dt, cmdA, cmdB);
        break;
      case "grace":
        this.majGrace(dt);
        break;
      case "finRound":
        this.majFinRound();
        break;
      case "fini":
        break;
    }
    this.physique(dt);
    this.majProjectiles(dt);
    return true;
  }

  /** Les evenements depuis le dernier appel (son, etincelles, messages). */
  vider(): Evenement[] {
    const e = this.evenements;
    this.evenements = [];
    return e;
  }

  private verifierFin() {
    if (this.furie) return;
    const { a, b } = this;
    if (a.vie <= 0 || b.vie <= 0) {
      if (a.vie <= 0 && b.vie <= 0) {
        this.finDeRound(null, true);
        return;
      }
      const gagnant = a.vie <= 0 ? b : a;
      const perdant = this.autre(gagnant);
      const roundsGagnant = gagnant.cote === "A" ? this.roundsA : this.roundsB;
      // Le dernier round se finit sur « Acheve-le ! » : le perdant reste
      // debout, sonne, et le vainqueur a cinq secondes pour conclure.
      if (roundsGagnant + 1 >= ROUNDS_A_GAGNER) {
        this.commencerAcheve(gagnant, perdant);
      } else {
        this.finDeRound(gagnant.cote, true);
      }
      return;
    }
    if (this.temps <= 0) {
      this.finDeRound(a.vie === b.vie ? null : a.vie > b.vie ? "A" : "B", false);
    }
  }

  private commencerAcheve(vainqueur: Combattant, perdant: Combattant) {
    this.phase = "acheve";
    this.chrono = 0;
    this.acheve = { vainqueur, perdant, t: 0, impacts: perdant.impacts };
    this.projectiles = [];
    perdant.vie = 0;
    perdant.combo = { coups: 0, degats: 0, jongles: 0 };
    perdant.action = null;
    // Encore en l'air : il se relevera sonne a l'atterrissage.
    if (perdant.y <= 0.01 && perdant.etat !== "jongle" && perdant.etat !== "chute") {
      perdant.etat = "sonne";
      perdant.minuteur = Infinity;
    }
    vainqueur.combo = { coups: 0, degats: 0, jongles: 0 };
    this.viderTampon(vainqueur);
    if (vainqueur.etat !== "attaque" && vainqueur.etat !== "libre") {
      vainqueur.etat = "libre";
      vainqueur.action = null;
    }
    this.annonce = perdant.perso.pronom === "elle" ? "Achève-la !" : "Achève-le !";
    this.gel = 0.25;
    this.emettre({ type: "acheve", vainqueur, perdant });
  }

  private majAcheve(dt: number, cmdA: Commande, cmdB: Commande) {
    const ac = this.acheve!;
    ac.t += dt;
    const { vainqueur, perdant } = ac;
    // Le perdant ne bouge plus ; il retombe s'il etait en l'air, puis se
    // releve, sonne.
    if (perdant.etat === "sol" || perdant.etat === "releve") {
      perdant.etat = "sonne";
      perdant.minuteur = Infinity;
    }
    // Un court repit : celui qui martelait ne met pas K.O. par megarde avant
    // d'avoir vu « Acheve-le ! » (les directions comptent deja pour le code).
    let brut = vainqueur === this.a ? cmdA : cmdB;
    if (ac.t < REPIT_ACHEVE) brut = { ...brut, poing: false, pied: false, pouvoir: false };
    const cmd = this.preparer(vainqueur, brut, dt);
    // Le coup de grace : ↓ → ↓ + Pouvoir, assez pres.
    const pres = Math.abs(perdant.x - vainqueur.x) < 3.2;
    const code =
      cmd.ordre === "grace" ||
      (cmd.pouvoir && this.codeTape(vainqueur, CODE_GRACE));
    if (code && pres && vainqueur.y <= 0.01 && perdant.etat === "sonne" && (vainqueur.etat === "libre" || vainqueur.etat === "attaque")) {
      this.commencerGrace(vainqueur, perdant);
      return;
    }
    if (vainqueur.etat === "libre" || vainqueur.etat === "attaque" || vainqueur.etat === "garde") {
      this.majCombattant(vainqueur, perdant, cmd, dt);
    } else {
      this.majSubi(vainqueur, cmd, dt);
    }
    if (perdant.impacts > ac.impacts) {
      // Frappe ordinaire : il tombe, le round se termine sans coup de grace.
      perdant.vie = 0;
      this.finDeRound(vainqueur.cote, true);
      return;
    }
    if (ac.t >= DUREE_ACHEVE) {
      this.finDeRound(vainqueur.cote, true);
    }
  }

  private commencerGrace(auteur: Combattant, victime: Combattant) {
    this.phase = "grace";
    this.chrono = 0;
    this.grace = { auteur, victime, id: auteur.perso.id, t: 0 };
    this.annonce = "";
    auteur.etat = "furie";
    auteur.action = null;
    auteur.sens = victime.x >= auteur.x ? 1 : -1;
    victime.etat = "subit";
    victime.sens = (-auteur.sens) as 1 | -1;
    // On rapproche les deux, a bonne distance pour le spectacle.
    const milieu = (auteur.x + victime.x) / 2;
    auteur.x = clamp(milieu - auteur.sens * 1.3, -ARENE, ARENE);
    victime.x = clamp(milieu + auteur.sens * 1.3, -ARENE, ARENE);
    this.emettre({ type: "grace", qui: auteur, cible: victime });
  }

  private majGrace(dt: number) {
    const g = this.grace!;
    g.t += dt;
    // Le rayon du ciel emporte la victime vers le haut ; le reste se joue
    // a l'ecran (statue, foudre, brume).
    if (g.id === "lame" && g.t > 1.0) {
      g.victime.y += dt * Math.min(9, (g.t - 1.0) * 6);
    }
    if (g.t >= DUREE_GRACE) {
      this.parGrace = true;
      g.victime.vie = 0;
      g.victime.cache = g.id !== "eclair";
      this.finDeRound(g.auteur.cote, true);
      g.auteur.etat = "libre";
    }
  }

  private majFinRound() {
    if (this.chrono > 1.2 && this.gagnantRound) {
      const g = this.gagnantRound === "A" ? this.a : this.b;
      if (g.etat !== "victoire") {
        g.etat = "victoire";
        g.action = null;
        this.annonce = g.intact && g.vie >= g.perso.vie ? "Victoire parfaite" : `${g.perso.nom} gagne le round`;
      }
    }
    if (this.chrono >= 3.4) {
      if (this.roundsA >= ROUNDS_A_GAGNER || this.roundsB >= ROUNDS_A_GAGNER) {
        this.vainqueur = this.roundsA >= ROUNDS_A_GAGNER ? "A" : "B";
        this.phase = "fini";
        const v = this.vainqueur === "A" ? this.a : this.b;
        v.etat = "victoire";
        this.annonce = `${v.perso.nom} l'emporte !`;
        this.emettre({ type: "fin", vainqueur: this.vainqueur });
      } else {
        this.round++;
        this.nouveauRound();
      }
    }
  }

  // ============================================================ combattants

  private majCombattants(dt: number, cmdA: Commande, cmdB: Commande) {
    if (this.furie) {
      this.majFurie(dt);
      return;
    }
    const { a, b } = this;
    // Les deux decident sur la meme image : celui qui est traite en premier
    // ne doit pas avoir d'avance. On prepare d'abord les commandes des deux.
    const effA = this.preparer(a, cmdA, dt);
    const effB = this.preparer(b, cmdB, dt);
    for (const [c, cmd] of [
      [a, effA],
      [b, effB],
    ] as const) {
      if (c.etat === "libre" || c.etat === "attaque") this.majCombattant(c, this.autre(c), cmd, dt);
      else this.majSubi(c, cmd, dt);
    }
    this.collisionCorps();
  }

  /** Note les directions et applique la memoire des boutons : la commande « effective ». */
  private preparer(c: Combattant, cmd: Commande, dt: number): Commande {
    this.noterDirections(c, cmd);
    const tp = c.tampon;
    tp.poing = cmd.poing ? TAMPON : Math.max(0, tp.poing - dt);
    tp.pied = cmd.pied ? TAMPON : Math.max(0, tp.pied - dt);
    tp.pouvoir = cmd.pouvoir ? TAMPON : Math.max(0, tp.pouvoir - dt);
    if (tp.poing <= 0 && tp.pied <= 0 && tp.pouvoir <= 0) return cmd;
    return { ...cmd, poing: tp.poing > 0, pied: tp.pied > 0, pouvoir: tp.pouvoir > 0 };
  }

  private viderTampon(c: Combattant) {
    c.tampon.poing = 0;
    c.tampon.pied = 0;
    c.tampon.pouvoir = 0;
  }

  /** Les directions pressees, relatives a l'adversaire : c'est ce que lisent les codes. */
  private noterDirections(c: Combattant, cmd: Commande) {
    const t = this.horloge;
    const avant = c.sens === 1 ? cmd.droitePressee : cmd.gauchePressee;
    const arriere = c.sens === 1 ? cmd.gauchePressee : cmd.droitePressee;
    if (cmd.basPresse) c.historique.push({ k: "B", t });
    if (avant) c.historique.push({ k: "AV", t });
    if (arriere) c.historique.push({ k: "AR", t });
    if (cmd.hautPresse) c.historique.push({ k: "H", t });
    if (c.historique.length > 8) c.historique.splice(0, c.historique.length - 8);
  }

  /** La suite de directions vient-elle d'etre tapee, assez vite ? */
  private codeTape(c: Combattant, suite: Direction[]): boolean {
    const h = c.historique;
    if (h.length < suite.length) return false;
    const fin = h.slice(h.length - suite.length);
    if (this.horloge - fin[fin.length - 1].t > DELAI_BOUTON) return false;
    for (let i = 0; i < suite.length; i++) {
      if (fin[i].k !== suite[i]) return false;
      if (i > 0 && fin[i].t - fin[i - 1].t > ECART_CODE) return false;
    }
    return true;
  }

  /** Un pouvoir tape avec un code (↓ → + Poing...) : son numero, ou -1. */
  private lireCode(c: Combattant, cmd: Commande): number {
    for (const code of CODES) {
      const presse = code.bouton === "poing" ? cmd.poing : code.bouton === "pied" ? cmd.pied : cmd.pouvoir;
      if (presse && this.codeTape(c, code.suite)) {
        c.historique.length = 0;
        return code.slot;
      }
    }
    return -1;
  }

  /** Quel coup la commande demande-t-elle ? Les pouvoirs passent avant tout. */
  private choisirAttaque(c: Combattant, cmd: Commande, auSol: boolean): AttaqueId | null {
    const avant = c.sens === 1 ? cmd.droite : cmd.gauche;
    const arriere = c.sens === 1 ? cmd.gauche : cmd.droite;
    if (cmd.ordre && cmd.ordre !== "grace") {
      const a = ATTAQUES[cmd.ordre];
      if (a.aerien ? !auSol : auSol) return cmd.ordre;
      return null;
    }
    if (auSol) {
      if (cmd.pouvoir && cmd.garde) {
        if (c.energie >= ENERGIE_MAX) return "furie";
        // Refusee : l'appui ne doit pas devenir un pouvoir ordinaire juste apres.
        this.viderTampon(c);
        this.emettre({ type: "message", cote: c.cote, texte: "Barre pas pleine" });
        return null;
      }
      if (cmd.poing || cmd.pied) {
        const slot = this.lireCode(c, cmd);
        if (slot >= 0) return c.perso.pouvoirs[slot];
      }
      if (cmd.pouvoir) return c.perso.pouvoirs[cmd.bas ? 2 : avant ? 1 : 0];
      if (cmd.poing && cmd.pied) return "projection";
      if (cmd.poing) return cmd.bas ? "uppercut" : "direct";
      if (cmd.pied) return cmd.bas ? "coupBas" : arriere ? "balayette" : avant ? "retourne" : "pied";
      return null;
    }
    if (c.coupSaute) return null;
    if (cmd.poing) return "poingSaute";
    if (cmd.pied) return "piedSaute";
    return null;
  }

  /** Lance un coup. Faux s'il ne peut pas partir (barre vide, projectile deja en vol). */
  lancer(c: Combattant, id: AttaqueId): boolean {
    const a = ATTAQUES[id];
    if (a.cout && c.energie < a.cout) return false;
    // Un seul projectile a la fois, comme dans tous les jeux du genre.
    if (a.projectile && this.projectiles.some((p) => p.auteur === c)) return false;
    if (a.cout) c.energie -= a.cout;
    this.viderTampon(c);
    c.etat = "attaque";
    c.action = { id, t: 0, touches: 0, contact: "rien", suite: null, lance: false, elanDonne: false };
    c.accroupi = id === "coupBas" || id === "balayette" || id === "uppercut";
    c.enGarde = false;
    c.marche = 0;
    c.pas = 0;
    if (a.aerien) c.coupSaute = true;
    this.emettre({ type: "coup", qui: c, attaque: id });
    if (a.pouvoir) this.emettre({ type: "pouvoir", qui: c, attaque: id });
    return true;
  }

  /** Un combattant libre ou en train d'attaquer. */
  private majCombattant(c: Combattant, autre: Combattant, cmd: Commande, dt: number) {
    if (c.invulnerable > 0) c.invulnerable -= dt;
    const auSol = c.y <= 0.001 && c.vy === 0;

    if (c.etat === "attaque") {
      this.avancerAttaque(c, autre, cmd, dt);
      return;
    }

    // --- libre ---
    if (auSol) c.sens = autre.x >= c.x ? 1 : -1;
    const avant = c.sens === 1 ? cmd.droite : cmd.gauche;
    const arriere = c.sens === 1 ? cmd.gauche : cmd.droite;

    const choix = this.choisirAttaque(c, cmd, auSol);
    if (choix && this.lancer(c, choix)) return;

    if (!auSol) {
      c.enGarde = false;
      c.marche = 0;
      return;
    }

    c.accroupi = cmd.bas;
    // La garde : la touche de garde, ou reculer sans attaquer (la regle de
    // tous les jeux du genre, et elle s'apprend en trois secondes).
    c.enGarde = cmd.garde || (arriere && !avant);

    if (cmd.haut && !cmd.bas) {
      c.vy = SAUT;
      c.vx = (avant ? 1 : arriere ? -1 : 0) * c.sens * SAUT_ELAN * (0.85 + c.perso.vitesse * 0.15);
      c.y = 0.001;
      c.accroupi = false;
      c.enGarde = false;
      c.coupSaute = false;
      c.pas = 0;
      this.emettre({ type: "saut", qui: c });
      return;
    }

    // Pas rapide : deux appuis rapproches sur la meme direction.
    for (const [presse, cle, signe] of [
      [cmd.gauchePressee, "gauche", -1],
      [cmd.droitePressee, "droite", 1],
    ] as const) {
      if (!presse) continue;
      if (this.horloge - c.dernierAppui[cle] < 0.24 && !c.accroupi) {
        c.pas = signe === c.sens ? 0.2 : 0.24;
        c.pasSens = signe;
        c.dernierAppui[cle] = -10;
      } else c.dernierAppui[cle] = this.horloge;
    }

    if (c.pas > 0) {
      c.pas -= dt;
      const vitessePas = c.pasSens === c.sens ? 10 : 8.5;
      c.x += c.pasSens * vitessePas * c.perso.vitesse * dt;
      c.marche = c.pasSens;
      c.enGarde = false;
      return;
    }

    c.marche = 0;
    if (!c.accroupi && !cmd.garde) {
      const dir = (cmd.droite ? 1 : 0) - (cmd.gauche ? 1 : 0);
      if (dir !== 0) {
        const recule = dir === -c.sens;
        c.x += dir * VITESSE * c.perso.vitesse * (recule ? 0.72 : 1) * dt;
        c.marche = dir;
      }
    }
  }

  /** Le coup en cours avance : deplacement, touche, enchainement, fin. */
  private avancerAttaque(c: Combattant, autre: Combattant, cmd: Commande, dt: number) {
    const act = c.action!;
    const a = ATTAQUES[act.id];
    const avant = act.t;
    act.t += dt / facteurVitesse(c.perso);
    const debut = a.demarrage;
    const finActif = a.demarrage + a.actif;
    const total = finActif + a.recuperation;

    // Enchainements et annulations : on note la demande, elle part a la fin
    // de l'actif si le coup a porte (touche ou garde).
    if (dt > 0) this.demanderSuite(c, act, cmd);

    // Projection ratee de justesse : Poing puis Pied presque ensemble.
    if (dt > 0 && act.id === "direct" && act.t < 0.07 && cmd.pied && !act.lance) {
      c.action = null;
      c.etat = "libre";
      this.lancer(c, "projection");
      return;
    }

    // Elan : la charge, la ruee, le saut de l'envol.
    if (a.elan && act.t >= a.elan.de && avant <= a.elan.a) {
      if (a.elan.saut && !act.elanDonne) {
        c.vy = a.elan.saut;
        c.y = Math.max(c.y, 0.001);
        act.elanDonne = true;
      }
      const duree = Math.min(act.t, a.elan.a) - Math.max(avant, a.elan.de);
      if (duree > 0) c.x = clamp(c.x + c.sens * a.elan.vitesse * duree, -ARENE, ARENE);
    }

    // L'uppercut part accroupi et se deplie en frappant.
    if (act.id === "uppercut" && act.t >= debut) c.accroupi = false;

    // Phase active : la ou ca touche.
    if (act.t >= debut && avant <= finActif) {
      this.phaseActive(c, autre, a, act);
      if (c.action !== act) return;
    }

    // L'enchainement part des que l'actif est fini, si le coup a porte.
    if (act.suite && act.contact !== "rien" && act.t >= finActif) {
      const suite = act.suite;
      c.action = null;
      c.etat = "libre";
      if (!this.lancer(c, suite)) {
        c.etat = "attaque";
        c.action = act;
        act.suite = null;
      } else {
        // Un appui de cette meme image vaut pour le coup suivant.
        this.demanderSuite(c, c.action!, cmd);
        return;
      }
    }

    // Un coup saute s'arrete en touchant le sol.
    if (a.aerien && c.y <= 0.001 && c.vy === 0 && act.t > 0.02) {
      this.finAttaque(c, cmd);
      return;
    }
    if (act.t >= total) {
      // En l'air apres un envol : on retombe sans pouvoir refrapper.
      this.finAttaque(c, cmd);
    }
  }

  /** Enregistre le coup suivant demande pendant un coup (combo ou pouvoir). */
  private demanderSuite(c: Combattant, act: ActionEnCours, cmd: Commande) {
    if (act.suite) return;
    const a = ATTAQUES[act.id];
    if (a.suite) {
      if (cmd.poing && a.suite.poing) act.suite = a.suite.poing;
      else if (cmd.pied && a.suite.pied) act.suite = a.suite.pied;
    }
    if (a.annulable && (cmd.poing || cmd.pied || cmd.pouvoir)) {
      const slot = this.lireCode(c, cmd);
      if (slot >= 0) act.suite = c.perso.pouvoirs[slot];
      else if (cmd.pouvoir && !cmd.garde) {
        const avant = c.sens === 1 ? cmd.droite : cmd.gauche;
        act.suite = c.perso.pouvoirs[cmd.bas ? 2 : avant ? 1 : 0];
      }
    }
    if (cmd.ordre && cmd.ordre !== "grace") act.suite = cmd.ordre;
    if (act.suite) this.viderTampon(c);
  }

  private finAttaque(c: Combattant, cmd: Commande) {
    const id = c.action?.id;
    c.action = null;
    c.etat = "libre";
    c.accroupi = cmd.bas && (id === "coupBas" || id === "balayette");
    if (c.y > 0.001) c.coupSaute = true;
  }

  private phaseActive(c: Combattant, autre: Combattant, a: Attaque, act: ActionEnCours) {
    if (a.projectile) {
      if (!act.lance) {
        act.lance = true;
        this.lancerProjectile(c, a);
      }
      return;
    }
    if (act.id === "pasDeBrume") {
      if (!act.lance) {
        act.lance = true;
        this.teleporter(c, autre);
      }
      return;
    }
    if (act.id === "seisme" && !act.lance) {
      act.lance = true;
      this.emettre({ type: "seisme", qui: c, x: c.x + c.sens * 1.2 * c.taille });
    }
    if (act.id === "decharge" && !act.lance) {
      act.lance = true;
      this.emettre({ type: "decharge", qui: c });
    }
    const n = a.touches ?? 1;
    if (act.touches >= n) return;
    // Les coups multiples se repartissent sur l'actif.
    const prochaine = a.demarrage + (a.actif * act.touches) / n;
    if (act.t < prochaine) return;
    if (this.essayerToucher(c, autre, a)) {
      act.touches++;
    } else if (n > 1) {
      act.touches++;
    }
  }

  /** Le coup touche-t-il ? Zone du coup contre corps de la cible. */
  private essayerToucher(c: Combattant, cible: Combattant, a: Attaque): boolean {
    if (a.effet === "projection") return this.essayerSaisir(c, cible);
    const zone = zoneDuCoup(c, a);
    if (!zone) return false;
    const corps = corpsDe(cible);
    if (!corps.some((b) => chevauche(zone, b))) return false;
    this.appliquerCoup(c, cible, a, c.x, false);
    return true;
  }

  private essayerSaisir(c: Combattant, cible: Combattant): boolean {
    if (intouchable(cible) || cible.y > 0.05) return false;
    if (cible.etat === "touche" || cible.etat === "jongle" || cible.etat === "sonne" || cible.etat === "garde") return false;
    const dx = (cible.x - c.x) * c.sens;
    if (dx < 0 || dx > 1.32 * Math.max(c.taille, cible.taille)) return false;
    cible.etat = "saisi";
    cible.minuteur = 0.42;
    cible.saisiPar = c;
    cible.degagement = 0.22;
    cible.action = null;
    cible.accroupi = false;
    cible.enGarde = false;
    c.action!.contact = "touche";
    this.emettre({ type: "saisie", qui: c, cible });
    return true;
  }

  /** La cible peut-elle bloquer ce coup, venu de `depuisX` ? */
  private bloque(cible: Combattant, hauteur: Hauteur, depuisX: number): boolean {
    if (hauteur === "imparable") return false;
    const enGarde = (cible.etat === "libre" && cible.enGarde) || cible.etat === "garde";
    if (!enGarde || cible.y > 0.05) return false;
    // Un coup qui arrive dans le dos ne se bloque pas.
    const cote = Math.sign(depuisX - cible.x);
    if (cote !== 0 && cote !== cible.sens) return false;
    if (hauteur === "bas" && !cible.accroupi) return false;
    if (hauteur === "plongeant" && cible.accroupi) return false;
    return true;
  }

  /** Pousse la cible en arriere ; contre le mur, c'est l'attaquant qui recule. */
  private pousser(cible: Combattant, depuisX: number, recul: number, attaquant: Combattant | null) {
    const sens = Math.sign(cible.x - depuisX) || -cible.sens;
    const distance = recul * 0.55;
    const libre = sens > 0 ? ARENE - cible.x : cible.x + ARENE;
    cible.glisse = sens * Math.min(distance, Math.max(0, libre)) * 10;
    const reste = distance - Math.max(0, libre);
    if (reste > 0 && attaquant) attaquant.glisse = -sens * reste * 10;
  }

  appliquerCoup(att: Combattant, cible: Combattant, a: Attaque, depuisX: number, projectile: boolean) {
    const bloque = this.bloque(cible, projectile && a.projectile ? a.projectile.hauteur : a.hauteur, depuisX);
    const contre =
      !bloque &&
      cible.etat === "attaque" &&
      cible.action !== null &&
      cible.action.t < ATTAQUES[cible.action.id].demarrage;
    const xImpact = cible.x - Math.sign(cible.x - depuisX || 1) * 0.3 * cible.taille;
    const yImpact = cible.y + (cible.accroupi ? 0.85 : cible.etat === "jongle" ? 0.7 : 1.45) * cible.taille;
    const brut = (projectile && a.projectile ? a.projectile.degats : a.degats) * att.perso.force;

    if (att.action && !projectile) att.action.contact = bloque ? "garde" : "touche";

    if (bloque) {
      const degats = brut * (a.copeaux ?? 0);
      cible.vie -= degats;
      if (degats > 0) cible.intact = false;
      cible.etat = "garde";
      cible.minuteur = a.bloque;
      cible.action = null;
      this.pousser(cible, depuisX, a.reculGarde, projectile ? null : att);
      att.energie = Math.min(ENERGIE_MAX, att.energie + 2);
      cible.energie = Math.min(ENERGIE_MAX, cible.energie + 3);
      this.gel = Math.max(this.gel, 0.035);
      this.emettre({ type: "touche", attaquant: att, cible, attaque: a.id, degats, bloque: true, contre: false, x: xImpact, y: yImpact, lourd: false, projectile });
      return;
    }

    // Un nouveau combo commence si la cible n'etait pas deja sonnee.
    const enCombo = cible.etat === "touche" || cible.etat === "jongle" || cible.etat === "sonne";
    if (!enCombo) {
      cible.combo = { coups: 0, degats: 0, jongles: 0 };
      cible.briseUtilise = false;
    }
    const echelle = Math.max(0.45, 1 - ECHELLE_COMBO * cible.combo.coups);
    let degats = brut * echelle * (contre ? 1.25 : 1);
    if (a.effet === "furie") degats = 0;
    cible.vie -= degats;
    cible.intact = false;
    cible.combo.coups++;
    cible.combo.degats += degats;
    cible.dernierCombo = { coups: cible.combo.coups, degats: cible.combo.degats, quand: this.horloge };
    cible.impacts++;
    cible.action = null;
    cible.enGarde = false;
    cible.toucheHaut = a.hauteur === "haut" || a.hauteur === "plongeant";
    const sens = (Math.sign(cible.x - depuisX) || att.sens) as 1 | -1;
    const enLAir = cible.y > 0.05 || cible.etat === "jongle";

    if (a.effet === "furie") {
      this.commencerFurie(att, cible);
    } else if (a.effet === "projection") {
      // (les projections passent par essayerSaisir)
    } else if (a.effet === "envol" || enLAir) {
      cible.etat = "jongle";
      cible.accroupi = false;
      const relance = Math.max(3.2, 6.6 - 1.1 * cible.combo.jongles);
      cible.vy = a.effet === "envol" ? (a.envol ?? 8) : cible.combo.jongles >= JONGLES_MAX ? Math.min(cible.vy, 0) : Math.max(cible.vy, relance);
      // Un uppercut envoie surtout vers le haut : on peut le suivre et le reprendre.
      cible.vx = sens * (a.effet === "envol" ? 0.8 : 0.9 + a.recul * 0.3);
      cible.y = Math.max(cible.y, 0.02);
      cible.combo.jongles++;
    } else if (a.effet === "chute") {
      cible.etat = "chute";
      cible.accroupi = false;
      cible.vy = 4.2;
      cible.vx = sens * (2 + a.recul * 0.5);
      cible.y = Math.max(cible.y, 0.02);
    } else if (projectile && a.projectile?.sonne) {
      cible.etat = "sonne";
      cible.minuteur = a.projectile.sonne;
      cible.accroupi = false;
    } else {
      cible.etat = "touche";
      // Plus le combo est long, plus la cible se remet vite : pas de boucle infinie.
      cible.minuteur = a.etourdit * (contre ? 1.25 : 1) * Math.max(0.6, 1 - 0.06 * (cible.combo.coups - 1));
      this.pousser(cible, depuisX, a.recul, projectile ? null : att);
    }

    att.energie = Math.min(ENERGIE_MAX, att.energie + a.energie);
    cible.energie = Math.min(ENERGIE_MAX, cible.energie + degats * 0.5);
    const lourd = degats >= 10 || a.effet === "chute" || a.effet === "envol";
    this.gel = Math.max(this.gel, a.pouvoir ? 0.1 : lourd ? 0.08 : 0.055);
    this.emettre({ type: "touche", attaquant: att, cible, attaque: a.id, degats, bloque: false, contre, x: xImpact, y: yImpact, lourd, projectile });
    if (contre) this.emettre({ type: "message", cote: att.cote, texte: "Contre !" });
  }

  /** Les etats subis : touche, garde, au sol, saisi, sonne... */
  private majSubi(c: Combattant, cmd: Commande, dt: number) {
    if (c.invulnerable > 0) c.invulnerable -= dt;
    const autre = this.autre(c);
    switch (c.etat) {
      case "touche":
      case "jongle":
        // Brise-combo : Garde + Avant, la moitie de la barre.
        if (c.combo.coups >= 2 && !c.briseUtilise && c.energie >= COUT_BRISE) {
          const avant = c.sens === 1 ? cmd.droite : cmd.gauche;
          const avantPresse = c.sens === 1 ? cmd.droitePressee : cmd.gauchePressee;
          if ((cmd.gardePressee && avant) || (cmd.garde && avantPresse)) {
            this.briser(c, autre);
            return;
          }
        }
        if (c.etat === "touche") {
          c.minuteur -= dt;
          if (c.minuteur <= 0) this.liberer(c);
        }
        break;
      case "garde":
        c.minuteur -= dt;
        // On peut passer de la garde debout a la garde basse en encaissant.
        c.accroupi = cmd.bas;
        if (c.minuteur <= 0) this.liberer(c);
        break;
      case "sol":
        c.minuteur -= dt;
        if (c.minuteur <= 0) {
          c.etat = "releve";
          c.minuteur = RELEVE;
        }
        break;
      case "releve":
        c.minuteur -= dt;
        if (c.minuteur <= 0) {
          this.liberer(c);
          c.invulnerable = 0.1;
        }
        break;
      case "saisi": {
        const t = c.saisiPar;
        if (!t) {
          this.liberer(c);
          break;
        }
        c.degagement -= dt;
        // Se degager : Poing + Pied a temps.
        if (c.degagement > 0 && cmd.poing && cmd.pied) {
          this.degager(c, t);
          break;
        }
        c.x = clamp(t.x + t.sens * 0.78 * t.taille, -ARENE, ARENE);
        c.sens = (-t.sens) as 1 | -1;
        c.minuteur -= dt;
        if (c.minuteur <= 0) this.lancerSaisi(t, c);
        break;
      }
      case "sonne":
        c.minuteur -= dt;
        if (c.minuteur <= 0) this.liberer(c);
        break;
      default:
        break;
    }
  }

  private liberer(c: Combattant) {
    c.etat = "libre";
    c.minuteur = 0;
    c.action = null;
    if (c.combo.coups > 0) {
      c.dernierCombo = { coups: c.combo.coups, degats: c.combo.degats, quand: this.horloge };
    }
    c.combo = { coups: 0, degats: 0, jongles: 0 };
    c.saisiPar = null;
  }

  private briser(c: Combattant, att: Combattant) {
    c.energie -= COUT_BRISE;
    c.briseUtilise = true;
    this.liberer(c);
    c.invulnerable = 0.25;
    if (c.y > 0.05) c.vy = Math.min(c.vy, 0);
    att.etat = "touche";
    att.action = null;
    att.minuteur = 0.45;
    this.pousser(att, c.x, 3.4, null);
    this.gel = 0.12;
    this.emettre({ type: "message", cote: c.cote, texte: "Brise-combo !" });
    this.emettre({
      type: "touche",
      attaquant: c,
      cible: att,
      attaque: "direct",
      degats: 0,
      bloque: false,
      contre: false,
      x: (c.x + att.x) / 2,
      y: c.y + 1.3,
      lourd: true,
      projectile: false,
    });
  }

  private degager(c: Combattant, t: Combattant) {
    this.liberer(c);
    if (t.etat === "attaque") {
      t.etat = "libre";
      t.action = null;
    }
    this.pousser(c, t.x, 2, null);
    this.pousser(t, c.x, 2, null);
    this.emettre({ type: "message", cote: c.cote, texte: "Dégagé !" });
  }

  /** La projection : la victime est lancee devant et tombe. */
  private lancerSaisi(att: Combattant, c: Combattant) {
    const a = ATTAQUES.projection;
    const degats = a.degats * att.perso.force;
    c.vie -= degats;
    c.intact = false;
    c.saisiPar = null;
    c.combo = { coups: 1, degats, jongles: 0 };
    c.dernierCombo = { coups: 1, degats, quand: this.horloge };
    c.etat = "chute";
    c.vy = 6.5;
    c.vx = att.sens * 4.6;
    c.y = 0.05;
    c.impacts++;
    att.energie = Math.min(ENERGIE_MAX, att.energie + a.energie);
    c.energie = Math.min(ENERGIE_MAX, c.energie + degats * 0.5);
    this.gel = 0.08;
    this.emettre({
      type: "touche",
      attaquant: att,
      cible: c,
      attaque: "projection",
      degats,
      bloque: false,
      contre: false,
      x: c.x,
      y: c.y + 1.2,
      lourd: true,
      projectile: false,
    });
    this.emettre({ type: "message", cote: att.cote, texte: "Projection !" });
  }

  private teleporter(c: Combattant, autre: Combattant) {
    const de = c.x;
    // Dans le dos de l'adversaire ; contre un mur, on reste devant lui.
    let vers = autre.x - autre.sens * 1.25 * autre.taille;
    if (vers < -ARENE || vers > ARENE) vers = autre.x + autre.sens * 1.25 * autre.taille;
    c.x = clamp(vers, -ARENE, ARENE);
    c.y = 0;
    c.vy = 0;
    c.sens = autre.x >= c.x ? 1 : -1;
    this.emettre({ type: "teleport", qui: c, de, vers: c.x });
  }

  // ================================================================ la furie

  private commencerFurie(att: Combattant, cible: Combattant) {
    this.furie = { auteur: att, victime: cible, t: 0, coups: 0 };
    att.etat = "furie";
    att.action = null;
    cible.etat = "subit";
    cible.action = null;
    cible.accroupi = false;
    cible.y = 0;
    cible.vy = 0;
    cible.vx = 0;
    att.y = 0;
    att.vy = 0;
    this.projectiles = [];
    this.emettre({ type: "furie", qui: att, cible });
  }

  private majFurie(dt: number) {
    const f = this.furie!;
    f.t += dt;
    const { auteur, victime } = f;
    const id = auteur.perso.id;
    // La victime reste plantee la ou la furie l'a prise ; l'auteur tourne
    // autour pour Eclair et Brume, la souleve pour Roc.
    if (id === "roc") {
      victime.y = f.t < 1.25 ? Math.min(1.6, Math.max(0, (f.t - 0.3) * 3)) : Math.max(0, victime.y - dt * 14);
    }
    while (f.coups < TEMPS_FURIE.length && f.t >= TEMPS_FURIE[f.coups]) {
      const final = f.coups === TEMPS_FURIE.length - 1;
      if (id === "eclair" || id === "brume") {
        // De part et d'autre, a chaque coup.
        const cote = f.coups % 2 === 0 ? -1 : 1;
        auteur.x = clamp(victime.x + cote * 1.05, -ARENE, ARENE);
        auteur.sens = victime.x >= auteur.x ? 1 : -1;
      }
      const degats = (final ? 14 : 5) * auteur.perso.force;
      victime.vie -= degats;
      victime.intact = false;
      victime.combo.coups++;
      victime.combo.degats += degats;
      victime.dernierCombo = { coups: victime.combo.coups, degats: victime.combo.degats, quand: this.horloge };
      victime.impacts++;
      this.gel = final ? 0.16 : 0.05;
      this.emettre({
        type: "furieCoup",
        qui: auteur,
        cible: victime,
        final,
        x: victime.x,
        y: victime.y + 1.3 * victime.taille,
      });
      f.coups++;
    }
    if (f.t >= DUREE_FURIE) {
      this.furie = null;
      auteur.etat = "libre";
      auteur.invulnerable = 0.2;
      const sens = (Math.sign(victime.x - auteur.x) || auteur.sens) as 1 | -1;
      victime.etat = "chute";
      victime.vy = id === "lame" ? 9 : 5;
      victime.vx = sens * 3.5;
      victime.y = Math.max(victime.y, 0.05);
      this.emettre({ type: "message", cote: auteur.cote, texte: auteur.perso.furie.nom + " !" });
    }
  }

  // ============================================================== physique

  private physique(dt: number) {
    for (const c of this.combattants) {
      if (c.etat === "saisi" || c.etat === "subit" || (c.etat === "furie" && this.furie)) continue;
      if (this.phase === "grace" && c === this.grace?.victime) continue;
      if (c.y > 0 || c.vy !== 0) {
        const lourdeur = c.etat === "jongle" ? 1 + 0.12 * c.combo.jongles : 1;
        c.vy -= GRAVITE * lourdeur * dt;
        c.y += c.vy * dt;
        c.x += c.vx * dt;
        if (c.y <= 0) this.atterrir(c);
      }
      if (c.glisse !== 0) {
        c.x += c.glisse * dt;
        c.glisse *= Math.exp(-10 * dt);
        if (Math.abs(c.glisse) < 0.05) c.glisse = 0;
      }
      c.x = clamp(c.x, -ARENE, ARENE);
    }
  }

  private atterrir(c: Combattant) {
    const fort = c.vy < -2;
    c.y = 0;
    c.vy = 0;
    c.vx = 0;
    switch (c.etat) {
      case "jongle":
      case "chute":
        if (this.phase === "acheve" && this.acheve?.perdant === c) {
          c.etat = "sonne";
          c.minuteur = Infinity;
        } else if (c.vie <= 0 && this.phase !== "combat") {
          c.etat = "ko";
        } else {
          c.etat = "sol";
          c.minuteur = AU_SOL;
        }
        c.dernierCombo = { coups: c.combo.coups, degats: c.combo.degats, quand: this.horloge };
        this.emettre({ type: "chute", qui: c });
        break;
      case "attaque":
        if (c.action && ATTAQUES[c.action.id].aerien) {
          c.action = null;
          c.etat = "libre";
        }
        if (fort) this.emettre({ type: "sol", qui: c });
        break;
      default:
        c.coupSaute = false;
        if (fort) this.emettre({ type: "sol", qui: c });
    }
  }

  /** Les deux corps ne se traversent pas (sauf par-dessus, en sautant). */
  private collisionCorps() {
    const { a, b } = this;
    if (a.cache || b.cache) return;
    const couches = (c: Combattant) => c.etat === "sol" || c.etat === "releve" || c.etat === "chute" || c.etat === "ko";
    if (couches(a) || couches(b)) return;
    if (Math.abs(a.y - b.y) > 1.2) return;
    const ecart = b.x - a.x;
    const min = ECART_MIN * (a.taille + b.taille) * 0.5;
    if (Math.abs(ecart) >= min) return;
    const signe = ecart >= 0 ? 1 : -1;
    const correction = (min - Math.abs(ecart)) / 2;
    a.x -= correction * signe;
    b.x += correction * signe;
    // Contre le mur, l'autre prend tout le decalage.
    if (a.x < -ARENE || a.x > ARENE) {
      const d = a.x - clamp(a.x, -ARENE, ARENE);
      a.x -= d;
      b.x -= d;
    }
    if (b.x < -ARENE || b.x > ARENE) {
      const d = b.x - clamp(b.x, -ARENE, ARENE);
      b.x -= d;
      a.x -= d;
    }
  }

  // ============================================================ projectiles

  private lancerProjectile(c: Combattant, a: Attaque) {
    const def = a.projectile!;
    const p: Projectile = {
      id: this.prochainId++,
      auteur: c,
      attaque: a.id,
      def,
      x: c.x + c.sens * 0.85 * c.taille,
      y: c.y + def.y * c.taille,
      sens: c.sens,
      vie: def.vie,
      rayon: def.rayon,
    };
    this.projectiles.push(p);
    this.emettre({ type: "projectile", p });
  }

  private majProjectiles(dt: number) {
    if (this.gel > 0) return;
    const morts = new Set<Projectile>();
    for (const p of this.projectiles) {
      p.x += p.sens * p.def.vitesse * dt;
      p.vie -= dt;
    }
    // Deux projectiles qui se croisent s'annulent.
    for (let i = 0; i < this.projectiles.length; i++) {
      for (let j = i + 1; j < this.projectiles.length; j++) {
        const p = this.projectiles[i];
        const q = this.projectiles[j];
        if (p.auteur === q.auteur) continue;
        if (Math.abs(p.x - q.x) < p.rayon + q.rayon && Math.abs(p.y - q.y) < p.rayon + q.rayon) {
          morts.add(p);
          morts.add(q);
          this.emettre({ type: "choc", x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
        }
      }
    }
    for (const p of this.projectiles) {
      if (morts.has(p)) continue;
      const cible = this.autre(p.auteur);
      const boite: Boite = { x0: p.x - p.rayon, x1: p.x + p.rayon, y0: p.y - p.rayon, y1: p.y + p.rayon };
      const actif = this.phase === "combat" || this.phase === "acheve";
      if (actif && corpsDe(cible).some((b) => chevauche(boite, b))) {
        this.appliquerCoup(p.auteur, cible, ATTAQUES[p.attaque], p.x - p.sens * 0.5, true);
        morts.add(p);
        this.emettre({ type: "projectileFin", p, touche: true });
        continue;
      }
      if (p.vie <= 0 || Math.abs(p.x) > ARENE + 3) {
        morts.add(p);
        this.emettre({ type: "projectileFin", p, touche: false });
      }
    }
    if (morts.size) this.projectiles = this.projectiles.filter((p) => !morts.has(p));
  }
}
