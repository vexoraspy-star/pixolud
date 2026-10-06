import type { CalculData } from "./calcul";
import type { DevinettesData } from "./devinettes";
import type { EducationData } from "./education";
import { nouvelleGraine, type MotsMelesData } from "./motsMeles";
import type { PetitBacData } from "./petitBac";
import type { QuizData } from "./quiz";
import type { GameCategory } from "./types";

/**
 * Les modeles de l'atelier : des jeux d'exemple, complets et publiables tels
 * quels, pour ne pas commencer devant une page blanche. Le joueur part de l'un
 * d'eux, puis change ce qu'il veut.
 *
 * Seuls ces modeles-ci peuvent etre crees : l'action serveur recoit un
 * identifiant, jamais des donnees venues du navigateur.
 */

export interface Modele {
  id: string;
  /** La categorie du jeu : une faute de frappe ici ne compile pas. */
  type: GameCategory;
  titre: string;
  description: string;
  emoji: string;
  /** Les donnees du jeu, fabriquees a chaque creation (identifiants neufs). */
  donnees: () => unknown;
}

const id = () => crypto.randomUUID();

/** Une question a quatre reponses ; `bonne` est l'indice de la bonne reponse. */
const question = (texte: string, reponses: [string, string, string, string], bonne: number) => ({
  id: id(),
  question: texte,
  options: reponses,
  correctIndex: bonne,
});

export const MODELES: Modele[] = [
  {
    id: "mots-meles-ferme",
    type: "Mots Mêlés",
    titre: "Les animaux de la ferme",
    description: "Dix animaux de la ferme cachés dans la grille, même en diagonale.",
    emoji: "🐄",
    donnees: (): MotsMelesData => ({
      theme: "Les animaux de la ferme",
      mots: ["Cheval", "Vache", "Mouton", "Cochon", "Poule", "Canard", "Lapin", "Chèvre", "Âne", "Dindon"],
      taille: 11,
      niveau: "moyen",
      graine: nouvelleGraine(),
    }),
  },
  {
    id: "mots-meles-fruits",
    type: "Mots Mêlés",
    titre: "Les fruits",
    description: "Une grille facile pour les plus jeunes : les mots vont de gauche à droite et de haut en bas.",
    emoji: "🍎",
    donnees: (): MotsMelesData => ({
      theme: "Les fruits",
      mots: ["Pomme", "Poire", "Banane", "Cerise", "Fraise", "Orange", "Kiwi", "Mangue", "Prune", "Raisin"],
      taille: 10,
      niveau: "facile",
      graine: nouvelleGraine(),
    }),
  },
  {
    id: "quiz-capitales",
    type: "Quiz",
    titre: "Capitales d'Europe",
    description: "Six capitales européennes : sauras-tu toutes les retrouver ?",
    emoji: "🗺️",
    donnees: (): QuizData => ({
      difficulty: "facile",
      questions: [
        question("Quelle est la capitale de l'Espagne ?", ["Barcelone", "Madrid", "Séville", "Valence"], 1),
        question("Quelle est la capitale de l'Italie ?", ["Rome", "Milan", "Naples", "Venise"], 0),
        question("Quelle est la capitale du Portugal ?", ["Porto", "Lisbonne", "Faro", "Braga"], 1),
        question("Quelle est la capitale de l'Allemagne ?", ["Munich", "Hambourg", "Berlin", "Francfort"], 2),
        question("Quelle est la capitale de la Belgique ?", ["Bruxelles", "Anvers", "Liège", "Gand"], 0),
        question("Quelle est la capitale de la Suisse ?", ["Zurich", "Genève", "Lausanne", "Berne"], 3),
      ],
    }),
  },
  {
    id: "devinettes-animaux",
    type: "Devinettes",
    titre: "Qui suis-je ? Les animaux",
    description: "Trois indices, du plus vague au plus évident : trouve l'animal le plus vite possible.",
    emoji: "🦒",
    donnees: (): DevinettesData => ({
      rounds: [
        { id: id(), answer: "Girafe", clues: ["J'habite dans la savane.", "Je mange les feuilles en haut des arbres.", "Je suis l'animal le plus haut du monde."] },
        { id: id(), answer: "Pieuvre", clues: ["Je vis dans la mer.", "J'ai huit bras.", "Je crache de l'encre pour me cacher."] },
        { id: id(), answer: "Hérisson", clues: ["Je sors surtout la nuit.", "Je mange des insectes et des limaces.", "Mon dos est couvert de piquants."] },
        { id: id(), answer: "Chameau", clues: ["Je peux rester longtemps sans boire.", "Je vis dans le désert.", "J'ai deux bosses sur le dos."] },
      ],
    }),
  },
  {
    id: "petit-bac-vacances",
    type: "Petit Bac",
    titre: "Petit bac des vacances",
    description: "Des catégories pour l'été : à jouer en famille ou entre amis.",
    emoji: "🏖️",
    donnees: (): PetitBacData => ({
      categories: ["Pays", "Ville", "Sport", "Plat", "Chose qu'on met dans sa valise", "Animal de la mer"],
      roundSeconds: 90,
    }),
  },
  {
    id: "calcul-tables",
    type: "Calcul Mental",
    titre: "Tables de multiplication",
    description: "Quinze multiplications pour réviser ses tables sans s'ennuyer.",
    emoji: "✖️",
    donnees: (): CalculData => ({ difficulty: "moyen", operations: ["multiplication"], questionCount: 15 }),
  },
  {
    id: "education-systeme-solaire",
    type: "Éducation",
    titre: "Le système solaire",
    description: "Une petite leçon sur les planètes, puis cinq questions pour vérifier.",
    emoji: "🪐",
    donnees: (): EducationData => ({
      subject: "Sciences",
      lesson:
        "Le système solaire est formé du Soleil et de tout ce qui tourne autour de lui : huit planètes, leurs lunes, des astéroïdes et des comètes. Dans l'ordre, en partant du Soleil : Mercure, Vénus, la Terre, Mars, Jupiter, Saturne, Uranus et Neptune. Les quatre premières sont rocheuses ; les quatre autres sont des planètes géantes. Jupiter est la plus grosse, et Mars est surnommée la planète rouge.",
      questions: [
        question("Combien de planètes compte le système solaire ?", ["7", "8", "9", "10"], 1),
        question("Quelle est la planète la plus proche du Soleil ?", ["Vénus", "Mars", "Mercure", "La Terre"], 2),
        question("Quelle est la plus grosse planète ?", ["Saturne", "Jupiter", "Neptune", "Uranus"], 1),
        question("Quelle planète est surnommée la planète rouge ?", ["Mars", "Vénus", "Jupiter", "Mercure"], 0),
        question("Autour de quoi tourne la Lune ?", ["Le Soleil", "Mars", "La Terre", "Jupiter"], 2),
      ],
    }),
  },
];

export function modeleParId(idModele: string): Modele | null {
  return MODELES.find((m) => m.id === idModele) ?? null;
}
