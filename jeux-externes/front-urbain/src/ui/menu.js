import { el, setText, setStyle, clamp, damp, ease } from './util.js';
import {
  NIVEAUX,
  NOMS_NIVEAUX,
  enregistrerQualite,
  adaptatifActif,
  enregistrerAdaptatif,
  sensibilite,
  enregistrerSensibilite,
  sensibiliteMoteur,
  SENSIBILITE_MIN,
  SENSIBILITE_MAX,
  SENSIBILITE_DEFAUT,
  luminosite,
  enregistrerLuminosite,
  biaisExposition,
  LUMINOSITE_MIN,
  LUMINOSITE_MAX,
  clavier,
  enregistrerClavier,
  touches,
  quitterJeu,
  basculerPleinEcran,
} from '../pixolud/reglages.js';

/**
 * Pause / settings menu.
 *
 * Pixolud : menu traduit en francais et relie aux reglages partages des jeux
 * 3D du site (sensibilite, luminosite, clavier — voir src/pixolud/reglages.js).
 * La qualite graphique ne peut pas changer a chaud (le pipeline de rendu est
 * construit une fois au demarrage) : le choix est enregistre, puis applique
 * en relancant la partie.
 *
 * Events emitted: `ui:pause` {paused}, `ui:quality` {quality},
 * `ui:sensitivity` {value}, `ui:fov` {value}, `ui:setting` {key, value}.
 */
export class PauseMenu {
  constructor(parent, ctx) {
    this.ctx = ctx;
    this.root = el('div', 'ow-menu', parent);
    const inner = el('div', 'ow-menu-inner', this.root);

    el('h1', null, inner, 'Pause');
    el('div', 'sub', inner, 'Front Urbain');
    el('div', 'rule', inner);

    this.rows = el('div', null, inner);

    // ---- qualite graphique ------------------------------------------------
    /** Niveau choisi mais pas encore applique (il faut relancer). */
    this.pending = null;
    this.qBtns = [];
    const qRow = this._row('Qualité');
    const seg = el('div', 'ow-seg', qRow);
    for (const p of NIVEAUX) {
      const b = el('button', null, seg, NOMS_NIVEAUX[p]);
      b.type = 'button';
      b.addEventListener('click', () => this.setQuality(p));
      this.qBtns.push(b);
    }
    this.qNote = el('div', 'ow-note', this.rows);
    this.qNoteTxt = el('span', null, this.qNote, '');
    const relancer = el('button', 'ow-btn small', this.qNote, 'Relancer');
    relancer.type = 'button';
    relancer.addEventListener('click', () => location.reload());

    // ---- resolution adaptative --------------------------------------------
    this.adaptBtns = this._toggle('Résolution adaptative', (v) => {
      enregistrerAdaptatif(v);
      this.ctx.peek('resolution')?.setActif?.(v);
      this.ctx.events.emit('ui:setting', { key: 'adaptiveResolution', value: v });
    });

    // ---- sensibilite (reglage partage Pixolud) ------------------------------
    this.sens = this._slider('Sensibilité', SENSIBILITE_MIN, SENSIBILITE_MAX, 0.05, (v, parUtilisateur) => {
      this.ctx.config.sensitivity = sensibiliteMoteur(v);
      if (parUtilisateur) enregistrerSensibilite(v);
      this.ctx.events.emit('ui:sensitivity', { value: this.ctx.config.sensitivity, multiplier: v });
      return v.toFixed(2).replace('.', ',');
    });

    // ---- luminosite (reglage partage Pixolud) ------------------------------
    this.lum = this._slider('Luminosité', LUMINOSITE_MIN, LUMINOSITE_MAX, 0.05, (v, parUtilisateur) => {
      this.ctx.peek('render')?.setExposureBias?.(biaisExposition(v));
      if (parUtilisateur) enregistrerLuminosite(v);
      return Math.round(v * 100) + ' %';
    });

    // ---- field of view ---------------------------------------------------
    this.fov = this._slider('Champ de vision', 65, 120, 1, (v) => {
      this.ctx.config.fov = v;
      const cam = this.ctx.camera;
      if (cam) {
        cam.fov = v;
        cam.updateProjectionMatrix();
      }
      this.ctx.events.emit('ui:fov', { value: v });
      return String(v | 0) + '°';
    });

    // ---- invert look -----------------------------------------------------
    this.invBtns = this._toggle('Inverser la vue', (v) => {
      this.ctx.config.invertY = v;
      this.ctx.events.emit('ui:setting', { key: 'invertY', value: v });
    });

    // ---- clavier (reglage partage Pixolud) --------------------------------
    const kRow = this._row('Clavier');
    const kSeg = el('div', 'ow-seg', kRow);
    this.kBtns = [];
    for (const k of ['azerty', 'qwerty']) {
      const b = el('button', null, kSeg, k.toUpperCase());
      b.type = 'button';
      b.addEventListener('click', () => {
        enregistrerClavier(k);
        this.syncFromConfig();
      });
      this.kBtns.push([b, k]);
    }

    // ---- buttons ---------------------------------------------------------
    const btns = el('div', 'ow-btns', inner);
    this.resumeBtn = el('button', 'ow-btn primary', btns, 'Reprendre');
    this.resumeBtn.type = 'button';
    this.resumeBtn.addEventListener('click', () => this.close());
    const plein = el('button', 'ow-btn', btns, 'Plein écran');
    plein.type = 'button';
    plein.addEventListener('click', () => basculerPleinEcran());
    const reset = el('button', 'ow-btn', btns, 'Par défaut');
    reset.type = 'button';
    reset.addEventListener('click', () => {
      this.sens.set(SENSIBILITE_DEFAUT, true);
      this.lum.set(1, true);
      this.fov.set(80);
      this.ctx.config.invertY = false;
      this.syncFromConfig();
    });
    const quitter = el('button', 'ow-btn', btns, 'Quitter');
    quitter.type = 'button';
    quitter.addEventListener('click', () => quitterJeu());

    this.hint = el('div', 'hint', inner, '');
    el('div', 'hint', inner, 'D’après Claude of Duty de mshumer · licence MIT');

    this.open = false;
    this.shown = 0;
    setStyle(this.root, 'display', 'none');
    setStyle(this.root, 'cursor', 'default');
    this.syncFromConfig();
  }

  _row(name) {
    const r = el('div', 'ow-row', this.rows);
    el('div', 'name', r, name.toUpperCase());
    return r;
  }

  /** Ligne Non / Oui. Renvoie [[bouton, valeur], ...]. */
  _toggle(name, apply) {
    const row = this._row(name);
    const seg = el('div', 'ow-seg', row);
    const list = [];
    for (const [label, val] of [
      ['Non', false],
      ['Oui', true],
    ]) {
      const b = el('button', null, seg, label);
      b.type = 'button';
      b.addEventListener('click', () => {
        apply(val);
        this.syncFromConfig();
      });
      list.push([b, val]);
    }
    return list;
  }

  _slider(name, min, max, step, apply) {
    const row = this._row(name);
    const wrap = el('div', 'ow-slider', row);
    el('div', 'track', wrap);
    const fill = el('div', 'fill', wrap);
    const knob = el('div', 'knob', wrap);
    const input = el('input', null, wrap);
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.setAttribute('aria-label', name);
    const val = el('div', 'val', row, '');

    const paint = (v, parUtilisateur) => {
      const t = (v - min) / (max - min);
      setStyle(fill, 'width', (t * 100).toFixed(2) + '%');
      setStyle(knob, 'left', (t * 100).toFixed(2) + '%');
      setText(val, apply(v, parUtilisateur) ?? String(v));
    };
    input.addEventListener('input', () => paint(parseFloat(input.value), true));
    const api = {
      /** `parUtilisateur` : enregistrer aussi le reglage partage. */
      set: (v, parUtilisateur = false) => {
        const c = clamp(v, min, max);
        input.value = String(c);
        paint(c, parUtilisateur);
      },
    };
    return api;
  }

  setQuality(name) {
    const cfg = this.ctx.config;
    enregistrerQualite(name);
    this.pending = name === cfg.quality ? null : name;
    // Le joueur a choisi lui-meme : ce n'est plus un choix automatique.
    if (name === cfg.quality) cfg.qualityAuto = false;
    this.ctx.events.emit('ui:quality', { quality: name, pending: this.pending !== null });
    this.syncFromConfig();
  }

  syncFromConfig() {
    const cfg = this.ctx.config;
    const shownQ = this.pending ?? cfg.quality;
    for (let i = 0; i < this.qBtns.length; i++) this.qBtns[i].classList.toggle('on', NIVEAUX[i] === shownQ);
    if (this.pending) {
      setText(this.qNoteTxt, `${NOMS_NIVEAUX[this.pending]} enregistrée : relance la partie pour l’appliquer.`);
      setStyle(this.qNote, 'display', '');
    } else if (cfg.qualityAuto) {
      setText(this.qNoteTxt, `${NOMS_NIVEAUX[cfg.quality]} : choisie automatiquement pour ton ordinateur.`);
      setStyle(this.qNote, 'display', '');
    } else {
      setStyle(this.qNote, 'display', 'none');
    }
    const relancer = this.qNote.querySelector('button');
    if (relancer) setStyle(relancer, 'display', this.pending ? '' : 'none');

    const adapt = this.ctx.peek('resolution')?.actif ?? adaptatifActif();
    for (const [b, v] of this.adaptBtns) b.classList.toggle('on', adapt === v);
    for (const [b, v] of this.invBtns) b.classList.toggle('on', !!cfg.invertY === v);
    const k = clavier();
    for (const [b, v] of this.kBtns) b.classList.toggle('on', k === v);

    this.sens?.set(sensibilite());
    this.lum?.set(luminosite());
    this.fov?.set(cfg.fov ?? 80);

    const t = touches();
    setText(
      this.hint,
      `Échap reprendre · ${t.deplacement} se déplacer · Maj sprinter · C s’accroupir · R recharger · 1 2 3 armes`
    );
  }

  toggle() {
    this.open ? this.close() : this.show();
  }

  show() {
    if (this.open) return;
    this.open = true;
    this.syncFromConfig();
    setStyle(this.root, 'display', '');
    document.exitPointerLock?.();
    const t = this.ctx.time;
    if (t) {
      this._prevScale = t.scale;
      t.scale = 0;
    }
    this.ctx.peek('player')?.setControlEnabled?.(false);
    this.ctx.events.emit('ui:pause', { paused: true });
  }

  close() {
    if (!this.open) return;
    this.open = false;
    const t = this.ctx.time;
    if (t) t.scale = this._prevScale ?? 1;
    this.ctx.peek('player')?.setControlEnabled?.(true);
    this.ctx.input?.requestPointerLock?.();
    this.ctx.events.emit('ui:pause', { paused: false });
  }

  /** Driven with unscaled time so the fade still runs while the game is frozen. */
  update(rawDt) {
    this.shown = damp(this.shown, this.open ? 1 : 0, 14, rawDt);
    if (this.shown < 0.004) {
      setStyle(this.root, 'display', 'none');
      setStyle(this.root, 'pointer-events', 'none');
      return;
    }
    setStyle(this.root, 'display', '');
    setStyle(this.root, 'pointer-events', this.open ? 'auto' : 'none');
    setStyle(this.root, 'opacity', ease.outQuad(this.shown).toFixed(3));
  }

  dispose() {
    this.root.remove();
  }
}
