/**
 * Game Script : les jeux ecrits en code par les joueurs.
 *
 * Le jeu n'est pas une configuration mais un PROGRAMME, ecrit par la personne
 * elle-meme. Il tourne dans un bac a sable (voir scriptRuntime.ts) : une page
 * isolee, sans acces au site, sans reseau, sans compte. Ce fichier ne
 * s'occupe que des donnees et de la porte de publication.
 */

export interface ScriptData {
  /** Le code du joueur. Il definit dessiner(), et parfois demarrer() / jouer(). */
  code: string;
  /** Taille de la scene, en pixels du jeu (le bac a sable met a l'echelle). */
  width: number;
  height: number;
  /** Ce qu'il faut savoir pour jouer : touches, but du jeu. */
  aide: string;
}

/**
 * Plafond absolu, toutes offres confondues. La vraie limite d'une personne
 * vient de son palier (TIERS[...].scriptMax) : un programme plus long, c'est
 * du stockage et de la bande passante a chaque partie jouee.
 */
export const SCRIPT_MAX = 62000;
export const SCRIPT_SIZES = [
  { w: 480, h: 360, label: "480 × 360 (classique)" },
  { w: 640, h: 360, label: "640 × 360 (large)" },
  { w: 360, h: 640, label: "360 × 640 (téléphone)" },
  { w: 480, h: 480, label: "480 × 480 (carré)" },
];

export const EXEMPLE_DEFAUT = `// Ton premier jeu : attrape le carre rouge avec la souris.
// Trois fonctions suffisent : demarrer(), jouer(dt) et dessiner().

let x = 100;
let y = 100;
let score = 0;

function demarrer() {
  // Appelee une fois au debut.
  score = 0;
}

function jouer(dt) {
  // Appelee ~60 fois par seconde. dt = temps ecoule, en secondes.
  if (pixo.clic && pixo.distance(pixo.sourisX, pixo.sourisY, x, y) < 30) {
    score = score + 1;
    x = pixo.hasard(30, pixo.largeur - 30);
    y = pixo.hasard(30, pixo.hauteur - 30);
  }
}

function dessiner() {
  pixo.fond("#101423");
  pixo.rectangle(x - 20, y - 20, 40, 40, "#ff4d5e");
  pixo.texte("Score : " + score, 16, 28, "#ffffff", 18);
}
`;

export function emptyScript(): ScriptData {
  return { code: EXEMPLE_DEFAUT, width: 480, height: 360, aide: "Attrape le carré rouge à la souris." };
}

/**
 * Porte de publication.
 *
 * On ne juge pas la qualite du jeu, seulement qu'il y a un programme qui
 * dessine quelque chose : sans `dessiner`, l'ecran reste noir et personne ne
 * comprend pourquoi.
 */
export function isScriptPlayable(data: ScriptData, limite = SCRIPT_MAX): boolean {
  if (!data || typeof data.code !== "string") return false;
  const code = data.code.trim();
  if (code.length < 20 || code.length > Math.min(limite, SCRIPT_MAX)) return false;
  if (!/function\s+dessiner\s*\(/.test(code)) return false;
  return (
    Number.isFinite(data.width) &&
    Number.isFinite(data.height) &&
    data.width >= 160 &&
    data.height >= 160 &&
    data.width <= 960 &&
    data.height <= 960
  );
}

/**
 * Les mots qui n'ont rien a faire dans un jeu.
 *
 * Ce n'est PAS ce qui protege le site — la vraie protection est le bac a
 * sable, qui rend ces mots inutiles. C'est un garde-fou de plus, et surtout
 * un message clair : si quelqu'un ecrit `fetch`, il vaut mieux lui dire tout
 * de suite que ca ne marchera pas, plutot que de le laisser chercher.
 */
const INTERDITS = [
  ["fetch", "le réseau est coupé dans les jeux"],
  ["XMLHttpRequest", "le réseau est coupé dans les jeux"],
  ["WebSocket", "le réseau est coupé dans les jeux"],
  ["importScripts", "on ne charge pas de code extérieur"],
  ["localStorage", "un jeu ne peut rien enregistrer sur l'appareil"],
  ["sessionStorage", "un jeu ne peut rien enregistrer sur l'appareil"],
  ["indexedDB", "un jeu ne peut rien enregistrer sur l'appareil"],
  ["document.cookie", "un jeu ne touche pas aux cookies"],
  ["parent.", "un jeu ne sort pas de son cadre"],
  ["top.", "un jeu ne sort pas de son cadre"],
  ["postMessage", "réservé au moteur du jeu"],
] as const;

export function verifierCode(code: string): string | null {
  for (const [mot, raison] of INTERDITS) {
    if (code.includes(mot)) return `« ${mot} » est refusé : ${raison}.`;
  }
  return null;
}

/** Les briques que le joueur a sous la main, pour l'aide de l'editeur. */
export const API_DOC: { nom: string; desc: string }[] = [
  { nom: "pixo.largeur / pixo.hauteur", desc: "Taille de la scène, en pixels." },
  { nom: "pixo.fond(couleur)", desc: "Remplit tout l'écran." },
  { nom: "pixo.rectangle(x, y, l, h, couleur)", desc: "Un rectangle plein." },
  { nom: "pixo.cercle(x, y, rayon, couleur)", desc: "Un disque plein." },
  { nom: "pixo.ligne(x1, y1, x2, y2, couleur, epaisseur)", desc: "Un trait." },
  { nom: "pixo.texte(mot, x, y, couleur, taille)", desc: "Écrit du texte." },
  { nom: "pixo.image(emoji, x, y, taille)", desc: "Dessine un emoji, comme un personnage." },
  { nom: "pixo.touche(nom)", desc: "Vrai si la touche est enfoncée : \"gauche\", \"droite\", \"haut\", \"bas\", \"espace\", \"a\"…" },
  { nom: "pixo.sourisX / pixo.sourisY / pixo.clic", desc: "Position de la souris (ou du doigt) et clic." },
  { nom: "pixo.hasard(min, max)", desc: "Un nombre au hasard entre min et max." },
  { nom: "pixo.distance(x1, y1, x2, y2)", desc: "Distance entre deux points." },
  { nom: "pixo.collision(a, b)", desc: "Vrai si deux rectangles {x, y, l, h} se touchent." },
  { nom: "pixo.son(note, duree)", desc: "Un petit bip. note en hertz, durée en secondes." },
  { nom: "pixo.temps", desc: "Secondes écoulées depuis le début de la partie." },
  { nom: "pixo.ecrire(valeur)", desc: "Affiche une valeur dans la console de l'éditeur." },
];
