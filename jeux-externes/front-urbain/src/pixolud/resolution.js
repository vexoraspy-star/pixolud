import { adaptatifActif } from './reglages.js';

/**
 * Resolution adaptative (ajout Pixolud).
 *
 * Le moteur d'origine n'en avait pas. Principe volontairement simple : on
 * mesure les images/s par fenetres de 2 secondes pendant le jeu (jamais en
 * pause ni onglet cache). Si la moyenne tombe sous SEUIL_BAS, on baisse
 * l'echelle de rendu interne d'un cran ; si elle reste longtemps au-dessus de
 * SEUIL_HAUT, on remonte d'un demi-cran, sans jamais depasser le niveau choisi.
 *
 * Changer l'echelle passe par engine.resize(), exactement le chemin d'un
 * redimensionnement de fenetre : toutes les cibles de rendu sont recreees, ce
 * qui coute une image un peu longue. D'ou les attentes entre deux changements
 * et l'hysteresis large, pour ne jamais osciller.
 */

const FENETRE = 2; // secondes par mesure
const SEUIL_BAS = 30; // i/s : en dessous, on baisse
const SEUIL_HAUT = 52; // i/s : au-dessus assez longtemps, on remonte
const MESURES_HAUTES = 4; // fenetres consecutives au-dessus avant de remonter
const PAS_BAS = 0.1;
const PAS_HAUT = 0.05;
const ECHELLE_MIN = 0.5;
const ATTENTE_DEPART = 6; // secondes de jeu avant la premiere mesure
const ATTENTE_CHANGEMENT = 3; // secondes a ignorer apres un changement

export class ResolutionAdaptative {
  static id = 'resolution';
  static deps = ['render'];

  async init(ctx) {
    this.ctx = ctx;
    this.actif = adaptatifActif();
    /** Echelle du niveau de qualite choisi : le plafond. */
    this.echelleMax = ctx.config.q.renderScale;
    this.echelle = this.echelleMax;
    this._attente = ATTENTE_DEPART;
    this._t = 0;
    this._images = 0;
    this._hautes = 0;
    this._dernier = performance.now();
    this.derniereMesure = 0;
  }

  setActif(v) {
    this.actif = !!v;
    if (!this.actif && this.echelle !== this.echelleMax) this._appliquer(this.echelleMax);
    this._reinitialiser(ATTENTE_CHANGEMENT);
  }

  _reinitialiser(attente) {
    this._attente = attente;
    this._t = 0;
    this._images = 0;
  }

  _appliquer(echelle) {
    this.echelle = echelle;
    this.ctx.config.q.renderScale = echelle;
    this.ctx.engine.resize();
    console.info(`[pixolud] resolution adaptative : echelle ${echelle.toFixed(2)}`);
  }

  update(dt, ctx) {
    const maintenant = performance.now();
    const ecoule = Math.min(0.25, (maintenant - this._dernier) / 1000);
    this._dernier = maintenant;
    // Pas de mesure en pause (temps fige), menu ouvert ou onglet cache.
    const enJeu = ctx.time.scale > 0 && !document.hidden && ctx.input.pointerLocked;
    if (!enJeu) {
      this._reinitialiser(Math.max(this._attente, 1));
      return;
    }
    if (this._attente > 0) {
      this._attente -= ecoule;
      return;
    }
    this._t += ecoule;
    this._images++;
    if (this._t < FENETRE) return;

    const ips = this._images / this._t;
    this.derniereMesure = ips;
    this._t = 0;
    this._images = 0;
    if (!this.actif) return;

    if (ips < SEUIL_BAS && this.echelle > ECHELLE_MIN + 1e-3) {
      this._hautes = 0;
      this._appliquer(Math.max(ECHELLE_MIN, this.echelle - PAS_BAS));
      this._attente = ATTENTE_CHANGEMENT;
      return;
    }
    if (ips > SEUIL_HAUT && this.echelle < this.echelleMax - 1e-3) {
      if (++this._hautes >= MESURES_HAUTES) {
        this._hautes = 0;
        this._appliquer(Math.min(this.echelleMax, this.echelle + PAS_HAUT));
        this._attente = ATTENTE_CHANGEMENT;
      }
      return;
    }
    this._hautes = 0;
  }
}
