/**
 * Reglages Pixolud du jeu Front Urbain.
 *
 * Le jeu est servi par le site (meme origine), il lit donc directement les
 * reglages partages de tous les jeux 3D de Pixolud (src/lib/settings3d.ts du
 * site) : disposition du clavier, sensibilite de la souris, luminosite et
 * qualite "performance". Seule la qualite fine (Basse / Moyenne / Haute /
 * Ultra) et la resolution adaptative sont propres a ce jeu.
 *
 * Chaque acces au localStorage est protege : navigation privee, stockage
 * bloque ou apercu, le jeu doit toujours demarrer avec des valeurs par defaut.
 */

// Cles partagees avec src/lib/settings3d.ts du site : ne pas les renommer.
const CLE_CLAVIER = 'pixolud-3d-layout';
const CLE_LUMINOSITE = 'pixolud-3d-brightness';
const CLE_SENSIBILITE = 'pixolud-3d-sensitivity';
const CLE_QUALITE_PIXOLUD = 'pixolud-3d-quality';

// Cles propres a Front Urbain.
const CLE_QUALITE = 'pixolud-front-urbain-qualite';
const CLE_ADAPTATIF = 'pixolud-front-urbain-adaptatif';

export const NIVEAUX = ['low', 'medium', 'high', 'ultra'];
export const NOMS_NIVEAUX = { low: 'Basse', medium: 'Moyenne', high: 'Haute', ultra: 'Ultra' };

// Memes bornes que settings3d.ts.
export const SENSIBILITE_MIN = 0.4;
export const SENSIBILITE_MAX = 3;
export const SENSIBILITE_DEFAUT = 1.5;
export const LUMINOSITE_MIN = 0.5;
export const LUMINOSITE_MAX = 1.8;

// Copie en memoire de ce qui a ete ecrit pendant la partie : si le stockage
// est bloque, un reglage change dans le menu tient au moins jusqu'a la fin.
const memoire = new Map();

function lire(cle) {
  if (memoire.has(cle)) return memoire.get(cle);
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
}

function ecrire(cle, valeur) {
  memoire.set(cle, valeur === null ? null : String(valeur));
  try {
    if (valeur === null) localStorage.removeItem(cle);
    else localStorage.setItem(cle, String(valeur));
  } catch {
    /* stockage indisponible : le reglage vaut pour cette partie seulement */
  }
}

/* ------------------------------------------------------------ qualite --- */

/** Niveau enregistre par le joueur, ou null s'il n'a jamais choisi. */
export function qualiteEnregistree() {
  const v = lire(CLE_QUALITE);
  return NIVEAUX.includes(v) ? v : null;
}

export function enregistrerQualite(niveau) {
  if (NIVEAUX.includes(niveau)) ecrire(CLE_QUALITE, niveau);
}

/**
 * Nom de la carte graphique, quand le navigateur accepte de le donner.
 * Un contexte WebGL jetable, libere tout de suite apres lecture.
 */
function nomCarteGraphique() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const nom = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return String(nom || '');
  } catch {
    return '';
  }
}

/**
 * Detection simple et prudente : "Moyenne" seulement pour une carte graphique
 * dediee (ou une puce Apple), "Basse" pour tout le reste — les PC portables a
 * puce integree sont la majorite des joueurs de Pixolud.
 */
export function detecterQualite() {
  if (lire(CLE_QUALITE_PIXOLUD) === 'performance') return 'low';
  const tactile = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  if (tactile) return 'low';
  if ((navigator.hardwareConcurrency || 4) <= 4) return 'low';
  const gpu = nomCarteGraphique().toLowerCase();
  if (/swiftshader|llvmpipe|software|basic render/.test(gpu)) return 'low';
  if (/nvidia|geforce|rtx|gtx|quadro|radeon rx|radeon pro|arc\(tm\) a|arc a\d|apple m\d|apple gpu/.test(gpu)) {
    return 'medium';
  }
  return 'low';
}

/**
 * Qualite de depart : `?q=` (outil de mesure) > choix du joueur > detection.
 * Renvoie aussi d'ou vient le choix, pour l'afficher dans le menu.
 */
export function qualiteDeDepart(params) {
  const forcee = params.get('q');
  if (NIVEAUX.includes(forcee)) return { niveau: forcee, auto: false };
  const choisie = qualiteEnregistree();
  if (choisie) return { niveau: choisie, auto: false };
  return { niveau: detecterQualite(), auto: true };
}

/* -------------------------------------------------- resolution adaptative --- */

export function adaptatifActif() {
  return lire(CLE_ADAPTATIF) !== 'off';
}

export function enregistrerAdaptatif(actif) {
  ecrire(CLE_ADAPTATIF, actif ? 'on' : 'off');
}

/* --------------------------------------------- reglages partages Pixolud --- */

/** "azerty" par defaut, comme sur tout Pixolud. */
export function clavier() {
  return lire(CLE_CLAVIER) === 'qwerty' ? 'qwerty' : 'azerty';
}

export function enregistrerClavier(valeur) {
  ecrire(CLE_CLAVIER, valeur === 'qwerty' ? 'qwerty' : 'azerty');
}

/** Sensibilite Pixolud (0,4 a 3 ; 1,5 par defaut). */
export function sensibilite() {
  const v = Number(lire(CLE_SENSIBILITE));
  return v >= SENSIBILITE_MIN && v <= SENSIBILITE_MAX ? v : SENSIBILITE_DEFAUT;
}

export function enregistrerSensibilite(v) {
  ecrire(CLE_SENSIBILITE, Math.min(SENSIBILITE_MAX, Math.max(SENSIBILITE_MIN, v)));
}

/**
 * Le moteur d'origine tourne a 0.0022 rad par pixel de souris. La valeur
 * Pixolud par defaut (1,5) correspond exactement a ce reglage d'origine.
 */
export function sensibiliteMoteur(v) {
  return 0.0022 * (v / SENSIBILITE_DEFAUT);
}

/** Luminosite Pixolud (0,5 a 1,8 ; 1 par defaut). */
export function luminosite() {
  const v = Number(lire(CLE_LUMINOSITE));
  return v >= LUMINOSITE_MIN && v <= LUMINOSITE_MAX ? v : 1;
}

export function enregistrerLuminosite(v) {
  ecrire(CLE_LUMINOSITE, Math.min(LUMINOSITE_MAX, Math.max(LUMINOSITE_MIN, v)));
}

/**
 * Luminosite -> correction d'exposition du moteur, en diaphragmes
 * (+1 = un cran plus sombre). 1,8 eclaircit d'un peu moins d'un cran.
 */
export function biaisExposition(v) {
  return -Math.log2(Math.max(0.1, v));
}

/* -------------------------------------------------------------- touches --- */

/**
 * Libelles des touches selon le clavier. Le moteur lit les touches PHYSIQUES
 * (KeyboardEvent.code) : la touche "W" d'un clavier QWERTY est la touche "Z"
 * d'un clavier AZERTY. Seuls les libelles changent.
 */
export function touches() {
  const az = clavier() === 'azerty';
  return {
    avancer: az ? 'Z' : 'W',
    gauche: az ? 'Q' : 'A',
    reculer: 'S',
    droite: 'D',
    deplacement: az ? 'ZQSD' : 'WASD',
    pencherG: az ? 'A' : 'Q',
    pencherD: 'E',
    allonger: az ? 'W' : 'Z',
  };
}

/* ---------------------------------------------------------------- sortie --- */

/**
 * Retour a la galerie des jeux 3D. Dans l'iframe du site, on laisse la page
 * parente naviguer (sans rechargement complet) ; seul, on change d'adresse.
 */
export function quitterJeu() {
  try {
    document.exitPointerLock?.();
  } catch {
    /* rien a relacher */
  }
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'front-urbain', action: 'quitter' }, location.origin);
  } else {
    location.href = '/mode-3d';
  }
}

/** Previent la page du site : "jeu" (souris capturee) ou "menu". */
export function signalerEtat(etat) {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'front-urbain', etat }, location.origin);
  }
}

/** Plein ecran de la page du jeu (l'iframe du site l'autorise). */
export function basculerPleinEcran() {
  try {
    if (document.fullscreenElement) document.exitFullscreen?.()?.catch?.(() => {});
    else document.documentElement.requestFullscreen?.()?.catch?.(() => {});
  } catch {
    /* plein ecran refuse par le navigateur */
  }
}
