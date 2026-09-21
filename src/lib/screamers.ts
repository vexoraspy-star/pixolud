export const SCREAMERS = [
  { id: "porcelaine", name: "Le Brisé", description: "Un masque de porcelaine qui surgit de l’ombre.", image: "/images/screamers/porcelaine.webp" },
  { id: "veilleur", name: "Le Veilleur", description: "Un regard vide. Un sourire beaucoup trop proche.", image: "/images/screamers/veilleur.webp" },
  { id: "classique", name: "Le Masque", description: "Le visage aux yeux rouges, version originale.", image: "" },
] as const;
export type ScreamerId = (typeof SCREAMERS)[number]["id"];

let lastChoice = -1;
export function chooseScreamer(): ScreamerId {
  // Alterne les deux nouvelles creatures, sans repetition immediate.
  const index = lastChoice < 0 ? Math.floor(Math.random() * 2) : 1 - lastChoice;
  lastChoice = index;
  return SCREAMERS[index].id;
}
