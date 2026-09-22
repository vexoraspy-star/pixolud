/**
 * Le bestiaire des screamers.
 *
 * Deux sont des images (dessinees pour le site), les quatre autres sont du
 * SVG trace en code : celles-la apparaissent instantanement, meme avec une
 * mauvaise connexion — et un screamer en retard ne fait pas peur.
 *
 * `son` change le cri : chaque creature a sa voix, sinon on reconnait tout de
 * suite le meme fichier et l'effet tombe.
 */
export interface Screamer {
  id: string;
  name: string;
  description: string;
  /** Image plein ecran, ou chaine vide quand la creature est dessinee en code. */
  image: string;
  /** Voix : deux glissandos (depart, arrivee) et la couleur du souffle. */
  son: { voix: [number, number][]; bruit: number };
}

export const SCREAMERS: Screamer[] = [
  {
    id: "porcelaine",
    name: "Le Brisé",
    description: "Un masque de porcelaine qui surgit de l’ombre.",
    image: "/images/screamers/porcelaine.webp",
    son: { voix: [[720, 145], [913, 190]], bruit: 2200 },
  },
  {
    id: "veilleur",
    name: "Le Veilleur",
    description: "Un regard vide. Un sourire beaucoup trop proche.",
    image: "/images/screamers/veilleur.webp",
    son: { voix: [[180, 52], [237, 71]], bruit: 800 },
  },
  {
    id: "rieur",
    name: "Le Rieur",
    description: "Un sourire d’une oreille à l’autre, collé à l’écran.",
    image: "",
    son: { voix: [[520, 96], [660, 128]], bruit: 1500 },
  },
  {
    id: "oeil",
    name: "L’Œil",
    description: "Un seul œil, immense, qui te fixe sans ciller.",
    image: "",
    son: { voix: [[1180, 240], [1490, 300]], bruit: 3000 },
  },
  {
    id: "main",
    name: "La Main",
    description: "Une main sort du noir et vient te chercher.",
    image: "",
    son: { voix: [[320, 60], [404, 84]], bruit: 520 },
  },
  {
    id: "classique",
    name: "Le Masque",
    description: "Le visage aux yeux rouges, version originale.",
    image: "",
    son: { voix: [[880, 180], [620, 140]], bruit: 1800 },
  },
];

export type ScreamerId = (typeof SCREAMERS)[number]["id"];

export function screamerById(id: string | null | undefined): Screamer {
  return SCREAMERS.find((s) => s.id === id) ?? SCREAMERS[0];
}

export function estScreamer(id: string): boolean {
  return SCREAMERS.some((s) => s.id === id);
}

let dernier = -1;
/** Une creature au hasard, jamais deux fois la meme de suite. */
export function chooseScreamer(): ScreamerId {
  let index = Math.floor(Math.random() * SCREAMERS.length);
  if (index === dernier) index = (index + 1) % SCREAMERS.length;
  dernier = index;
  return SCREAMERS[index].id;
}
