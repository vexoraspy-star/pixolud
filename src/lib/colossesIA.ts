import { ATTAQUES, COUT_BRISE, DIFFICULTES, ENERGIE_MAX, type AttaqueId, type Difficulte, type ReglageIA } from "./colosses";
import { commandeVide, type Combat, type Combattant, type Commande, type Cote } from "./colossesCombat";

/**
 * L'ordinateur de Colosses.
 *
 * Il joue avec les memes regles que le joueur : il envoie des commandes au
 * moteur, il ne deplace jamais un personnage lui-meme. Ce qui le rend humain,
 * c'est qu'il REAGIT avec un temps de retard : il voit un coup partir, et
 * decide un peu plus tard de lever la garde — trop tard parfois, du mauvais
 * cote parfois (debout contre un coup bas). Un adversaire qui reagit
 * instantanement n'est pas difficile, il est injuste.
 *
 * Il ne lit pas l'avenir non plus : il decide sur ce qu'il voit, une fois par
 * coup (pas a chaque image, sinon sa garde clignote et il pare tout).
 */
export class Ordinateur {
  private r: ReglageIA;
  /** Prochaine reflexion « offensive ». */
  private prochaineDecision = 0;
  /** Pas de nouvelle attaque avant ce moment (cadence). */
  private attenteAttaque = 0;
  private gardeJusque = -1;
  private gardeBasse = false;
  /** Une decision prise, executee apres le temps de reaction. */
  private reactions: { quand: number; faire: () => void }[] = [];
  private actionJugee: unknown = null;
  private punitionJugee: unknown = null;
  private projectilesJuges = new Set<number>();
  private sautJuge = false;
  /** Pret a contrer un saut des qu'il passe a portee. */
  private antiAerien = false;
  /** Direction de marche entre deux decisions (-1 recule, 0 reste, 1 avance). */
  private intention = 0;
  /** Coups encore a enchainer (combo en cours). */
  private plan: ("poing" | "pied")[] = [];
  /** Coup decide, a lancer des que possible. */
  private ordre: AttaqueId | "saut" | "saut-avant" | "projection" | "furie" | null = null;
  private degagementTente = false;
  private briseTente = false;
  /** « Acheve-le ! » : coup de grace (vrai) ou simple coup (faux), decide une fois. */
  private grace: boolean | null = null;
  /** Le joueur bloque souvent : on finira par le projeter. */
  private gardesVues = 0;
  /** Dernier coup vu partir en face, et prochaine decision de garde sous pression. */
  private dernierCoupVu = -10;
  private prochaineGarde = 0;
  /** Il vient de bloquer : riposter des que l'autre est en recuperation. */
  private riposte = false;

  constructor(
    public cote: Cote,
    difficulte: Difficulte,
  ) {
    this.r = DIFFICULTES[difficulte];
  }

  commande(combat: Combat): Commande {
    const cmd = commandeVide();
    const moi = this.cote === "A" ? combat.a : combat.b;
    const lui = combat.autre(moi);
    const t = combat.horloge;
    if (combat.phase === "acheve") return this.achever(combat, moi, lui, cmd);
    if (combat.phase !== "combat") {
      this.reinitialiser();
      return cmd;
    }
    const d = Math.abs(lui.x - moi.x);
    const versLui = lui.x >= moi.x ? 1 : -1;
    const marcher = (dir: number) => {
      if (dir > 0) cmd.droite = true;
      else if (dir < 0) cmd.gauche = true;
    };

    // --- ce qu'il subit ---
    if (moi.etat === "saisi") {
      if (!this.degagementTente) {
        this.degagementTente = true;
        if (Math.random() < this.r.lecture * 0.5) {
          cmd.poing = true;
          cmd.pied = true;
        }
      }
      return cmd;
    }
    this.degagementTente = false;
    if ((moi.etat === "touche" || moi.etat === "jongle") && moi.combo.coups >= 2 && moi.energie >= COUT_BRISE) {
      if (!this.briseTente) {
        this.briseTente = true;
        if (Math.random() < this.r.punition * 0.5) {
          cmd.garde = true;
          cmd.gardePressee = true;
          marcher(versLui);
        }
      }
      return cmd;
    }
    if (moi.combo.coups === 0) this.briseTente = false;
    if (moi.etat === "garde") {
      cmd.garde = true;
      cmd.bas = this.gardeBasse;
      this.riposte = Math.random() < this.r.punition;
      return cmd;
    }
    if (moi.etat !== "libre" && moi.etat !== "attaque") {
      this.plan = [];
      return cmd;
    }

    this.observer(combat, moi, lui, d, t);
    for (let i = this.reactions.length - 1; i >= 0; i--) {
      if (t >= this.reactions[i].quand) {
        const r = this.reactions[i];
        this.reactions.splice(i, 1);
        r.faire();
      }
    }

    // --- un coup en cours : la suite du combo ---
    if (moi.etat === "attaque") {
      const act = moi.action;
      if (act && act.contact !== "rien" && !act.suite && this.plan.length) {
        const b = this.plan.shift()!;
        cmd[b] = true;
      }
      return cmd;
    }

    // --- en l'air : le coup saute au bon moment ---
    if (moi.y > 0.05) {
      if (!moi.coupSaute && moi.vy < 2 && d < 1.7 && lui.y < 0.5) {
        if (Math.random() < 0.6) cmd.pied = true;
        else cmd.poing = true;
      }
      return cmd;
    }

    // --- contre un saut : l'uppercut, quand il descend a portee ---
    if (this.antiAerien && lui.y > 0.2 && lui.vy < 3 && d < 1.25 * moi.taille && lui.y < 1.9) {
      this.antiAerien = false;
      const special = moi.perso.pouvoirs.find((id) => id === "envol" || id === "decharge");
      if (special && Math.random() < this.r.pouvoirs) cmd.ordre = special;
      else {
        cmd.bas = true;
        cmd.poing = true;
      }
      return cmd;
    }

    // --- riposte apres un coup bloque : l'autre est en recuperation ---
    if (this.riposte && moi.etat === "libre") {
      this.riposte = false;
      const enRecup = lui.etat === "attaque" && lui.action && lui.action.t > ATTAQUES[lui.action.id].demarrage + ATTAQUES[lui.action.id].actif;
      if (enRecup && d < 1.4 * moi.taille) {
        this.gardeJusque = -1;
        this.executer(d < 1.05 * moi.taille && Math.random() < 0.5 ? "uppercut" : "direct", moi, lui, cmd);
        if (cmd.poing && !cmd.bas && Math.random() < this.r.combo) this.plan = ["poing", "pied"];
        return cmd;
      }
    }

    // --- sous pression : il frappe sans arret, de pres. On tient la garde
    // entre ses coups au lieu de s'y jeter (et d'encaisser un contre).
    const pression = d < 1.9 * moi.taille && t - this.dernierCoupVu < 0.55;
    if (pression && t >= this.prochaineGarde) {
      this.prochaineGarde = t + 0.25;
      if (Math.random() < this.r.garde) {
        this.gardeJusque = Math.max(this.gardeJusque, t + 0.3);
        this.gardeBasse = Math.random() < (lui.accroupi ? this.r.lecture : 0.15);
      }
    }

    // --- garde tenue ---
    if (t < this.gardeJusque) {
      cmd.garde = true;
      cmd.bas = this.gardeBasse;
      return cmd;
    }

    // --- un ordre en attente ---
    if (this.ordre) {
      const o = this.ordre;
      this.ordre = null;
      this.executer(o, moi, lui, cmd);
      return cmd;
    }

    // --- ne pas frapper quelqu'un a terre : on se place ---
    if (lui.etat === "sol" || lui.etat === "releve" || lui.etat === "chute") {
      if (d > 2.2) marcher(versLui);
      else if (d < 1.4) marcher(-versLui);
      return cmd;
    }

    if (t >= this.prochaineDecision) {
      this.prochaineDecision = t + this.r.reaction + Math.random() * 0.2;
      this.decider(combat, moi, lui, d, t, cmd);
      if (cmd.poing || cmd.pied || cmd.pouvoir || cmd.ordre || cmd.haut) return cmd;
    }
    if (this.intention !== 0) marcher(this.intention * versLui);
    // Garde de principe quand on recule pres de l'adversaire.
    if (this.intention < 0 && d < 2.2) cmd.garde = Math.random() < this.r.garde * 0.5;
    return cmd;
  }

  private reinitialiser() {
    this.reactions = [];
    this.plan = [];
    this.ordre = null;
    this.gardeJusque = -1;
    this.antiAerien = false;
    this.grace = null;
    this.projectilesJuges.clear();
  }

  /** Ce qu'il voit partir en face : un coup, un projectile, un saut. */
  private observer(combat: Combat, moi: Combattant, lui: Combattant, d: number, t: number) {
    const r = this.r;
    // Un coup qui part.
    if (lui.etat === "attaque" && lui.action && lui.action !== this.actionJugee) {
      this.actionJugee = lui.action;
      this.dernierCoupVu = t;
      const a = ATTAQUES[lui.action.id];
      if (a.zone && !a.aerien) {
        const elan = a.elan ? a.elan.vitesse * Math.max(0, a.elan.a - a.elan.de) : 0;
        const portee = (a.zone.x[1] + 0.4) * lui.taille + elan;
        if (d < portee + 0.3 || (a.deuxCotes && d < 1.8)) {
          const delai = r.reaction * (0.7 + Math.random() * 0.6);
          this.reactions.push({
            quand: t + delai,
            faire: () => {
              if (Math.random() >= r.garde) return;
              this.gardeJusque = combat.horloge + this.restant(lui) + 0.12;
              this.gardeBasse = this.hauteurDeGarde(a.hauteur);
              this.plan = [];
            },
          });
        }
      }
    }
    // Une fois le coup du joueur rate ou bloque : punir pendant sa recuperation.
    if (lui.etat === "attaque" && lui.action && lui.action !== this.punitionJugee) {
      const a = ATTAQUES[lui.action.id];
      const finActif = a.demarrage + a.actif;
      if (lui.action.t > finActif && lui.action.contact !== "touche") {
        this.punitionJugee = lui.action;
        const reste = this.restant(lui);
        if (reste > 0.16 && d < 1.6 * moi.taille && Math.random() < r.punition) {
          this.reactions.push({
            quand: t + r.reaction * 0.6,
            faire: () => {
              this.gardeJusque = -1;
              this.ordre = d < 1.05 * moi.taille ? "uppercut" : "pied";
              if (Math.random() < r.combo) this.ordre = "direct";
            },
          });
        }
        if (lui.action.contact === "garde") this.gardesVues = Math.max(0, this.gardesVues - 1);
      }
    }
    if (lui.etat === "garde") this.gardesVues = Math.min(6, this.gardesVues + 0.02);
    // Les projectiles qui arrivent.
    for (const p of combat.projectiles) {
      if (p.auteur !== lui || this.projectilesJuges.has(p.id)) continue;
      const approche = Math.sign(moi.x - p.x) === p.sens;
      const dist = Math.abs(p.x - moi.x);
      if (!approche || dist > 7) continue;
      this.projectilesJuges.add(p.id);
      const arrivee = dist / p.def.vitesse;
      this.reactions.push({
        quand: t + r.reaction,
        faire: () => {
          const dessous = p.y - p.rayon > 1.12 * moi.taille;
          if (dessous && Math.random() < r.lecture) {
            this.gardeJusque = combat.horloge + arrivee + 0.3;
            this.gardeBasse = true;
          } else if (Math.random() < r.garde) {
            this.gardeJusque = combat.horloge + arrivee + 0.25;
            this.gardeBasse = false;
          } else if (dist > 3.2 && Math.random() < 0.5) {
            this.ordre = "saut-avant";
          }
        },
      });
    }
    // Un saut vers lui.
    if (lui.y > 0.3 && lui.etat === "libre" && !this.sautJuge && d < 3.8) {
      this.sautJuge = true;
      this.reactions.push({
        quand: t + r.reaction * 0.8,
        faire: () => {
          if (Math.random() < r.antiAerien) this.antiAerien = true;
          else if (Math.random() < r.garde) {
            this.gardeJusque = combat.horloge + 0.7;
            this.gardeBasse = false;
          }
        },
      });
    }
    if (lui.y <= 0.05) {
      this.sautJuge = false;
      this.antiAerien = false;
    }
  }

  /** Temps reel restant dans le coup en cours de l'adversaire. */
  private restant(lui: Combattant): number {
    if (!lui.action) return 0;
    const a = ATTAQUES[lui.action.id];
    const total = a.demarrage + a.actif + a.recuperation;
    const fv = 1 / (0.75 + lui.perso.vitesse * 0.25);
    return Math.max(0, (total - lui.action.t) * fv);
  }

  /** Garde debout ou accroupie : il lit bien, ou il se trompe. */
  private hauteurDeGarde(h: string): boolean {
    const bien = Math.random() < this.r.lecture;
    if (h === "bas") return bien;
    if (h === "plongeant") return !bien;
    if (h === "haut") return bien && Math.random() < 0.5; // s'accroupir l'esquive
    return Math.random() < 0.2;
  }

  /** La decision offensive : se placer, frapper, ou sortir un pouvoir. */
  private decider(combat: Combat, moi: Combattant, lui: Combattant, d: number, t: number, cmd: Commande) {
    const r = this.r;
    const pv = moi.perso.pouvoirs;
    const proche = d < 1.45 * moi.taille;
    const moyen = d < 3.4;
    const projectile = pv.find((id) => ATTAQUES[id].projectile);
    const fonce = pv.find((id) => id === "ruee" || id === "charge" || id === "torpille" || id === "tourbillon");
    const autour = pv.find((id) => id === "decharge" || id === "seisme" || id === "tourbillon");
    const peutFrapper = t >= this.attenteAttaque;

    this.intention = d > 1.6 ? 1 : Math.random() < 0.25 ? -1 : 0;
    // Eclair aime la distance : il recule pour lancer ses ondes.
    if (moi.perso.id === "eclair" && d < 3 && Math.random() < 0.3) this.intention = -1;
    if (!peutFrapper) return;
    // Son coup part deja : frapper maintenant, c'est encaisser un contre.
    if (lui.etat === "attaque" && lui.action && proche) {
      const a = ATTAQUES[lui.action.id];
      if (lui.action.t < a.demarrage + a.actif) return;
    }

    const frappe = (o: NonNullable<Ordinateur["ordre"]>) => {
      this.attenteAttaque = t + r.cadence * (0.6 + Math.random() * 0.8);
      this.executer(o, moi, lui, cmd);
    };

    if (proche) {
      if (Math.random() > r.agressivite) return;
      if (moi.energie >= ENERGIE_MAX && Math.random() < r.pouvoirs * 0.6) return frappe("furie");
      if (lui.enGarde && this.gardesVues > 2 && Math.random() < 0.4) {
        this.gardesVues = 0;
        return frappe("projection");
      }
      const x = Math.random();
      if (x < r.combo * 0.5) {
        this.plan = Math.random() < r.combo ? ["poing", "pied"] : ["poing"];
        return frappe("direct");
      }
      if (x < 0.55) return frappe("pied");
      if (x < 0.68) return frappe(Math.random() < 0.5 ? "coupBas" : "balayette");
      if (x < 0.8 && d < 1.05 * moi.taille) return frappe("uppercut");
      if (x < 0.9 && autour && Math.random() < r.pouvoirs) return frappe(autour);
      return frappe("retourne");
    }
    if (moyen) {
      if (fonce && Math.random() < r.pouvoirs * 0.35) return frappe(fonce);
      if (projectile && Math.random() < r.pouvoirs * 0.2) return frappe(projectile);
      if (Math.random() < 0.12 * r.agressivite) return frappe("saut-avant");
      this.intention = 1;
      return;
    }
    if (projectile && Math.random() < r.pouvoirs) return frappe(projectile);
    if (fonce && moi.perso.id !== "eclair" && Math.random() < r.pouvoirs * 0.2) return frappe(fonce);
    this.intention = 1;
  }

  /** Traduit une decision en commande pour le moteur. */
  private executer(o: NonNullable<Ordinateur["ordre"]>, moi: Combattant, lui: Combattant, cmd: Commande) {
    const versLui = lui.x >= moi.x ? 1 : -1;
    const avant = () => (versLui > 0 ? (cmd.droite = true) : (cmd.gauche = true));
    const arriere = () => (versLui > 0 ? (cmd.gauche = true) : (cmd.droite = true));
    switch (o) {
      case "saut":
        cmd.haut = true;
        break;
      case "saut-avant":
        cmd.haut = true;
        avant();
        break;
      case "projection":
        cmd.poing = true;
        cmd.pied = true;
        break;
      case "furie":
        cmd.garde = true;
        cmd.pouvoir = true;
        break;
      case "direct":
        cmd.poing = true;
        break;
      case "pied":
        cmd.pied = true;
        break;
      case "retourne":
        cmd.pied = true;
        avant();
        break;
      case "uppercut":
        cmd.bas = true;
        cmd.poing = true;
        break;
      case "coupBas":
        cmd.bas = true;
        cmd.pied = true;
        break;
      case "balayette":
        cmd.pied = true;
        arriere();
        break;
      default:
        cmd.ordre = o;
    }
  }

  /** « Acheve-le ! » : il s'approche, puis conclut — avec style, s'il y pense. */
  private achever(combat: Combat, moi: Combattant, lui: Combattant, cmd: Commande): Commande {
    const ac = combat.acheve;
    if (!ac || ac.vainqueur !== moi || moi.etat !== "libre") return cmd;
    const d = Math.abs(lui.x - moi.x);
    const versLui = lui.x >= moi.x ? 1 : -1;
    if (ac.t < 0.9) return cmd;
    if (this.grace === null) {
      const envie = this.r === DIFFICULTES.brutal ? 0.85 : this.r === DIFFICULTES.normal ? 0.55 : 0.3;
      this.grace = Math.random() < envie;
    }
    // Le coup de grace se donne a deux pas ; un simple coup, au contact.
    const portee = this.grace ? 2.4 : 1.2 * moi.taille;
    if (d > portee) {
      if (versLui > 0) cmd.droite = true;
      else cmd.gauche = true;
      return cmd;
    }
    if (this.grace) cmd.ordre = "grace";
    else cmd.poing = true;
    return cmd;
  }
}
