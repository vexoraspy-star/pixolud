import { el, FONT_STACK, FONT_DISPLAY } from '../ui/util.js';
import { NOMS_NIVEAUX, touches, quitterJeu, signalerEtat } from './reglages.js';

/**
 * Deroulement d'une partie (ajout Pixolud).
 *
 * Le moteur d'origine est un bac a sable : la ville, deux escouades ennemies,
 * et rien d'autre — pas d'ecran de depart, pas de fin, et un joueur mort le
 * restait. Ce systeme ajoute le strict necessaire pour en faire une mission :
 *
 *   accueil   briefing + touches ; le temps est fige jusqu'au premier clic
 *   score     barre du haut : eliminations | chrono | ennemis restants
 *   mort      "Tu es tombe" : reapparaitre, recommencer ou quitter
 *   victoire  tous les ennemis a terre : rejouer ou quitter
 *
 * Pendant un ecran, `input.frozen` bloque la visee, le tir et le menu pause
 * du HUD (voir ui/index.js) et le temps du jeu est a zero.
 */

const CSS = `
.fu-ecran {
  position: fixed; inset: 0; z-index: 30;
  display: flex; align-items: center; justify-content: center;
  padding: 24px; overflow-y: auto; cursor: default;
  background: linear-gradient(105deg, rgba(4,6,8,.92) 0%, rgba(4,6,8,.78) 55%, rgba(4,6,8,.55) 100%);
  color: rgba(238,244,247,.95);
  font-family: ${FONT_STACK};
  -webkit-font-smoothing: antialiased;
}
.fu-ecran[hidden] { display: none; }
.fu-carte {
  width: min(560px, 100%);
  border-left: 2px solid #ffb02a; padding: 6px 0 6px 22px;
}
.fu-surtitre { font-size: 12px; letter-spacing: .28em; color: #ffb02a; text-transform: uppercase; font-weight: 700; }
.fu-titre {
  margin-top: 8px; font-family: ${FONT_DISPLAY}; font-weight: 700;
  font-size: clamp(34px, 6vw, 54px); letter-spacing: .16em; line-height: 1.05; text-transform: uppercase;
}
.fu-texte { margin-top: 14px; font-size: 16px; line-height: 1.5; color: rgba(214,227,234,.85); }
.fu-touches {
  margin-top: 18px; display: grid; grid-template-columns: max-content 1fr; gap: 6px 14px;
  font-size: 14px; color: rgba(214,227,234,.8);
}
.fu-touches kbd {
  font-family: inherit; font-weight: 700; color: #eef4f7; letter-spacing: .06em;
  border: 1px solid rgba(255,255,255,.22); border-radius: 4px; padding: 1px 7px; background: rgba(255,255,255,.06);
  white-space: nowrap;
}
.fu-stats { margin-top: 16px; display: flex; gap: 28px; flex-wrap: wrap; }
.fu-stats div { font-size: 12px; letter-spacing: .2em; color: rgba(214,227,234,.6); text-transform: uppercase; }
.fu-stats b { display: block; font-family: ${FONT_DISPLAY}; font-size: 30px; letter-spacing: .04em; color: #eef4f7; }
.fu-boutons { margin-top: 22px; display: flex; gap: 10px; flex-wrap: wrap; }
.fu-bouton {
  appearance: none; cursor: pointer; font-family: inherit; font-weight: 700; font-size: 14px;
  letter-spacing: .14em; text-transform: uppercase;
  padding: 11px 20px; border: 1px solid rgba(255,255,255,.25); background: rgba(255,255,255,.05); color: #eef4f7;
}
.fu-bouton:hover { background: rgba(255,255,255,.12); border-color: rgba(255,255,255,.45); }
.fu-bouton:focus-visible { outline: 2px solid #ffb02a; outline-offset: 3px; }
.fu-bouton.principal { background: #ffb02a; border-color: #ffb02a; color: #100b02; }
.fu-bouton.principal:hover { background: #ffc251; }
.fu-note { margin-top: 16px; font-size: 12.5px; line-height: 1.5; color: rgba(196,210,219,.55); }
/* Ecran large : les touches sur deux colonnes, pour tenir sur un portable 1366x768. */
@media (min-width: 900px) {
  .fu-carte { width: min(780px, 100%); }
  .fu-touches { grid-template-columns: max-content 1fr max-content 1fr; column-gap: 14px; }
}
`;

function formatDuree(s) {
  const t = Math.max(0, Math.floor(s));
  const m = Math.floor(t / 60);
  const r = t % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export class Partie {
  static id = 'partie';
  static deps = ['ui', 'player', 'ai', 'world'];

  async init(ctx) {
    this.ctx = ctx;
    this.qualite = { niveau: ctx.config.quality, auto: false };
    this.etat = 'chargement'; // chargement | accueil | jeu | mort | victoire
    this.tempsJeu = 0;
    this.morts = 0;
    this._total = 0;
    this._attenteFin = -1;
    this._verrou = null;

    this._style = el('style', null, document.head);
    this._style.textContent = CSS;

    this._offMort = ctx.events.on('player:death', () => this._surMort());
  }

  /** Appele par main.js juste avant engine.start(). */
  afficherAccueil(qualite) {
    if (qualite) this.qualite = qualite;
    // Le HUD d'origine affiche des compteurs de grenades, mais aucune touche ne
    // permet d'en lancer : on les masque plutot que de promettre du vide.
    const equip = this.ctx.peek('ui')?.ammo?.equip;
    if (equip) equip.style.display = 'none';
    const t = touches();
    const nomQualite = NOMS_NIVEAUX[this.qualite.niveau] ?? this.qualite.niveau;
    const ecran = this._ecran();
    const carte = el('div', 'fu-carte', ecran);
    el('div', 'fu-surtitre', carte, 'Mission · Rue du marché');
    el('h1', 'fu-titre', carte, 'Front Urbain');
    el(
      'p',
      'fu-texte',
      carte,
      `${this._totalEnnemis() || 'Des'} soldats ennemis tiennent la rue du marché. ` +
        'Trouve-les et mets-les tous hors de combat. Reste à couvert : ta santé remonte toute seule.'
    );

    const liste = el('div', 'fu-touches', carte);
    const ligne = (k, texte) => {
      const d = el('div', null, liste);
      for (const [i, morceau] of k.entries()) {
        if (i) d.appendChild(document.createTextNode(' '));
        el('kbd', null, d, morceau);
      }
      el('div', null, liste, texte);
    };
    ligne([t.deplacement], 'se déplacer (souris : regarder)');
    ligne(['Clic gauche'], 'tirer');
    ligne(['Clic droit'], 'viser dans le viseur');
    ligne(['Maj'], 'sprinter');
    ligne(['Espace'], 'sauter, escalader un muret');
    ligne(['C'], 's’accroupir (en sprint : glissade)');
    ligne([t.allonger], 's’allonger');
    ligne([t.pencherG, t.pencherD], 'se pencher à gauche / à droite');
    ligne(['R'], 'recharger');
    ligne(['1', '2', '3'], 'fusil, mitraillette, pistolet (ou molette)');
    ligne(['B'], 'changer le mode de tir');
    ligne(['Échap'], 'pause et réglages');

    el(
      'p',
      'fu-note',
      carte,
      'En haut de l’écran : à gauche tes éliminations, au centre le chrono, à droite les ennemis restants.'
    );

    const boutons = el('div', 'fu-boutons', carte);
    const go = el('button', 'fu-bouton principal', boutons, 'Commencer la mission');
    go.type = 'button';
    go.addEventListener('click', () => this._commencer());
    const q = el('button', 'fu-bouton', boutons, 'Quitter');
    q.type = 'button';
    q.addEventListener('click', () => quitterJeu());

    el(
      'p',
      'fu-note',
      carte,
      (this.ctx.config?.rapide
        ? 'Mode rapide : qualité Basse et effets simplifiés pour démarrer plus vite — ' +
          'désactivable dans le menu Échap. '
        : `Qualité graphique : ${nomQualite}${this.qualite.auto ? ' (choisie automatiquement)' : ''} — ` +
          'modifiable dans le menu Échap. ') + 'D’après Claude of Duty de mshumer (licence MIT).'
    );

    this.etat = 'accueil';
    this._figer();
    signalerEtat('menu');
    go.focus();
  }

  /* ------------------------------------------------------------ ecrans --- */

  _ecran() {
    this._fermerEcran();
    this._el = el('div', 'fu-ecran', document.body);
    this._el.setAttribute('role', 'dialog');
    this._el.setAttribute('aria-modal', 'true');
    // Un clic ou une touche sur l'ecran ne doit pas atteindre le jeu : Input
    // ecoute window et annule l'action par defaut de chaque touche, ce qui
    // empecherait Entree/Espace d'activer le bouton qui a le focus.
    this._el.addEventListener('mousedown', (e) => e.stopPropagation());
    this._el.addEventListener('keydown', (e) => e.stopPropagation());
    return this._el;
  }

  _fermerEcran() {
    this._el?.remove();
    this._el = null;
  }

  _stats(parent) {
    const s = el('div', 'fu-stats', parent);
    const bloc = (titre, valeur) => {
      const d = el('div', null, s, titre);
      el('b', null, d, valeur);
    };
    bloc('Éliminés', `${this._elimines()} / ${this._totalEnnemis()}`);
    bloc('Temps', formatDuree(this.tempsJeu));
    bloc('Chutes', String(this.morts));
  }

  _figer() {
    const { ctx } = this;
    // Le menu pause du HUD a pu s'ouvrir juste avant (Echap pendant la chute) :
    // le refermer d'abord, sinon il reapparaitrait apres notre ecran.
    const ui = ctx.peek('ui');
    if (ui?.menu?.open) ui.menu.close();
    ctx.input.frozen = true;
    ctx.time.scale = 0;
    ctx.peek('player')?.setControlEnabled?.(false);
    try {
      document.exitPointerLock?.();
    } catch {
      /* deja relachee */
    }
  }

  _reprendre() {
    const { ctx } = this;
    this._fermerEcran();
    ctx.input.frozen = false;
    ctx.time.scale = 1;
    ctx.peek('player')?.setControlEnabled?.(true);
    // Appele depuis un clic : le navigateur accepte de capturer la souris.
    ctx.input.requestPointerLock?.();
    this.etat = 'jeu';
  }

  _commencer() {
    if (this.etat !== 'accueil') return;
    this._reprendre();
  }

  _surMort() {
    if (this.etat !== 'jeu') return;
    this.morts++;
    this.etat = 'mort';
    // Laisser voir la chute une seconde avant l'ecran.
    this._attenteFin = 1.2;
  }

  _afficherMort() {
    this._figer();
    const ecran = this._ecran();
    const carte = el('div', 'fu-carte', ecran);
    el('div', 'fu-surtitre', carte, 'Hors de combat');
    el('h1', 'fu-titre', carte, 'Tu es tombé');
    el(
      'p',
      'fu-texte',
      carte,
      'Les ennemis encore debout t’attendent. Repars du point de départ le plus éloigné d’eux, ou recommence la mission depuis le début.'
    );
    this._stats(carte);
    const boutons = el('div', 'fu-boutons', carte);
    const r = el('button', 'fu-bouton principal', boutons, 'Réapparaître');
    r.type = 'button';
    r.addEventListener('click', () => this._reapparaitre());
    const n = el('button', 'fu-bouton', boutons, 'Recommencer');
    n.type = 'button';
    n.addEventListener('click', () => location.reload());
    const q = el('button', 'fu-bouton', boutons, 'Quitter');
    q.type = 'button';
    q.addEventListener('click', () => quitterJeu());
    signalerEtat('menu');
    r.focus();
  }

  _afficherVictoire() {
    this._figer();
    const ecran = this._ecran();
    const carte = el('div', 'fu-carte', ecran);
    el('div', 'fu-surtitre', carte, 'Mission accomplie');
    el('h1', 'fu-titre', carte, 'Zone sécurisée');
    el(
      'p',
      'fu-texte',
      carte,
      this.morts === 0
        ? 'Tous les ennemis sont hors de combat, et sans une seule chute. Du travail propre.'
        : 'Tous les ennemis sont hors de combat. La rue du marché est à nous.'
    );
    this._stats(carte);
    const boutons = el('div', 'fu-boutons', carte);
    const n = el('button', 'fu-bouton principal', boutons, 'Rejouer');
    n.type = 'button';
    n.addEventListener('click', () => location.reload());
    const q = el('button', 'fu-bouton', boutons, 'Quitter');
    q.type = 'button';
    q.addEventListener('click', () => quitterJeu());
    signalerEtat('menu');
    n.focus();
  }

  /** Point de depart le plus eloigne des ennemis encore debout. */
  _meilleurDepart() {
    const world = this.ctx.peek('world');
    const points = world?.spawnPoints ?? [];
    const agents = this.ctx.peek('ai')?.agents ?? [];
    let meilleur = 0;
    let record = -1;
    for (let i = 0; i < points.length; i++) {
      const p = points[i].position;
      let proche = Infinity;
      for (const a of agents) {
        if (!a.alive || !a.position) continue;
        proche = Math.min(proche, Math.hypot(a.position.x - p.x, a.position.z - p.z));
      }
      if (proche > record) {
        record = proche;
        meilleur = i;
      }
    }
    return meilleur;
  }

  _reapparaitre() {
    if (this.etat !== 'mort') return;
    this.ctx.peek('player')?.respawn?.(this._meilleurDepart());
    this._reprendre();
  }

  /* ------------------------------------------------------------- score --- */

  _totalEnnemis() {
    const n = this.ctx.peek('ai')?.agents?.length ?? 0;
    if (n > this._total) this._total = n;
    return this._total;
  }

  _elimines() {
    const agents = this.ctx.peek('ai')?.agents ?? [];
    let n = 0;
    for (const a of agents) if (!a.alive) n++;
    return n;
  }

  update(dt, ctx) {
    // Previent la page du site quand la souris est capturee ou relachee
    // (elle masque sa barre d'outils pendant le jeu).
    const verrou = ctx.input.pointerLocked;
    if (verrou !== this._verrou) {
      this._verrou = verrou;
      if (this.etat === 'jeu') signalerEtat(verrou ? 'jeu' : 'menu');
    }

    if (this.etat === 'chargement') return;

    if (this.etat === 'jeu' && ctx.time.scale > 0) this.tempsJeu += dt;

    const total = this._totalEnnemis();
    const elimines = this._elimines();
    ctx.peek('ui')?.setMatch?.({
      scoreUs: elimines,
      scoreThem: total - elimines,
      timeLeft: this.tempsJeu,
      mode: 'Mission',
    });

    if (this.etat === 'jeu' && total > 0 && elimines >= total) {
      this.etat = 'victoire';
      this._attenteFin = 1.8;
    }

    // Petite attente (temps reel) avant d'afficher l'ecran de fin.
    if (this._attenteFin >= 0) {
      this._attenteFin -= Math.min(0.1, ctx.time.dt || 1 / 60);
      if (this._attenteFin < 0) {
        if (this.etat === 'mort') this._afficherMort();
        else if (this.etat === 'victoire') this._afficherVictoire();
      }
    }
  }

  dispose() {
    this._offMort?.();
    this._fermerEcran();
    this._style?.remove();
  }
}
