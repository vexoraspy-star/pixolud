import { CATEGORIES, type GameCategory } from "./types";

/**
 * Une page par categorie, avec ses propres mots.
 *
 * « jeux en ligne » ou « game » sont tenus par des sites vieux de quinze ans
 * et riches de millions de liens : un site jeune n'y entrera pas, quoi qu'on
 * ecrive. Ce qui se gagne, ce sont les phrases precises que les gens tapent
 * vraiment et que les gros ignorent — « jeu de labyrinthe a faire soi-meme »,
 * « quiz a creer gratuitement », « petit bac en ligne a plusieurs ».
 *
 * Chaque categorie a donc son adresse, son titre, son texte d'introduction et
 * sa liste de jeux. Sans texte propre, ces pages seraient des coquilles vides
 * que Google ignore (ou penalise) : c'est le contenu qui les rend legitimes.
 */

export interface CategorieSeo {
  /** Morceau d'adresse : /jeux/<slug>. */
  slug: string;
  categorie: GameCategory;
  emoji: string;
  /** Titre de l'onglet et du resultat Google. */
  titre: string;
  /** La ligne sous le titre dans Google. */
  description: string;
  /** Deux paragraphes qui expliquent vraiment la categorie. */
  intro: string;
  detail: string;
}

export const CATEGORIES_SEO: CategorieSeo[] = [
  {
    slug: "plateforme",
    categorie: "Plateforme",
    emoji: "🧱",
    titre: "Jeux de plateforme gratuits, à jouer et à créer",
    description:
      "Des jeux de plateforme faits par des joueurs : cours, saute, évite les pièges. Jouables sans installation, et tu peux créer le tien sans écrire de code.",
    intro:
      "Un jeu de plateforme, c'est le plus vieux réflexe du jeu vidéo : courir, sauter, ne pas tomber. Ceux-ci sont créés par des joueurs, directement dans le navigateur.",
    detail:
      "Pour en créer un, tu poses les plateformes à la souris comme des briques, tu places un départ, une arrivée, et c'est jouable. Aucune ligne de code, aucun logiciel à installer : si ton niveau est trop dur, tu le rejoues et tu déplaces une brique.",
  },
  {
    slug: "labyrinthe",
    categorie: "Labyrinthe",
    emoji: "🌀",
    titre: "Labyrinthes en ligne : jouer ou fabriquer le tien",
    description:
      "Des labyrinthes dessinés par la communauté, jouables tout de suite. Crée le tien en quelques clics : le site vérifie qu'il a bien une sortie.",
    intro:
      "Trouver la sortie, revenir en arrière, recommencer. Les labyrinthes ci-dessous ont tous été dessinés par quelqu'un, case par case.",
    detail:
      "Quand tu fabriques le tien, le site vérifie tout seul qu'un chemin relie le départ à l'arrivée : impossible de publier un labyrinthe sans solution. Les paliers supérieurs débloquent de plus grandes grilles.",
  },
  {
    slug: "quiz",
    categorie: "Quiz",
    emoji: "🧠",
    titre: "Quiz gratuits à jouer et à créer soi-même",
    description:
      "Des quiz sur tous les sujets, faits par des joueurs. Crée le tien gratuitement : une question, quatre réponses, et c'est publié.",
    intro:
      "Un quiz se joue en deux minutes et se fabrique en cinq. Ceux-ci viennent de la communauté : culture générale, animaux, jeux vidéo, cours de collège.",
    detail:
      "Pour en écrire un, tu tapes ta question, quatre réponses, tu coches la bonne, et tu recommences. Un quiz incomplet ne peut pas être publié — c'est la règle qui garde le catalogue jouable.",
  },
  {
    slug: "arcade",
    categorie: "Arcade",
    emoji: "👾",
    titre: "Mini-jeux d'arcade, sans installation",
    description:
      "Des jeux d'arcade rapides : viser, cliquer, battre son record. Gratuits, sans téléchargement, et créables par n'importe qui.",
    intro:
      "Une cible, un chronomètre, un score à battre. L'arcade, c'est la partie qu'on relance « juste une dernière fois ».",
    detail:
      "Tu règles la durée, la taille de la cible et la difficulté, et ton jeu est prêt. C'est souvent le premier jeu que les gens créent ici, parce qu'il se termine en cinq minutes.",
  },
  {
    slug: "course",
    categorie: "Course",
    emoji: "🏁",
    titre: "Jeux de réflexes et de course en ligne",
    description:
      "Teste tes réflexes : attends le signal, clique le plus vite possible. Des jeux courts créés par la communauté, gratuits et sans compte.",
    intro:
      "Attendre le signal sans partir trop tôt : c'est plus dur qu'il n'y paraît, et ça se joue à deux sur le même écran.",
    detail:
      "Le créateur choisit le nombre de manches et le rythme. Parfait pour départager deux personnes en trente secondes.",
  },
  {
    slug: "runner",
    categorie: "Runner",
    emoji: "🦔",
    titre: "Jeux de runner : cours, saute, recommence",
    description:
      "Des parcours à traverser sans se faire avoir. Jouables aussitôt, gratuitement, et tu peux dessiner ton propre parcours.",
    intro:
      "Le personnage avance tout seul ; à toi de sauter au bon moment. Les parcours ci-dessous ont été placés obstacle par obstacle.",
    detail:
      "En créant le tien, le site refuse deux obstacles collés sans espace pour passer : un parcours impossible n'est pas un parcours difficile, c'est un parcours cassé.",
  },
  {
    slug: "puzzle",
    categorie: "Puzzle",
    emoji: "🧩",
    titre: "Puzzles et jeux de mémoire en ligne",
    description:
      "Retrouve les paires, entraîne ta mémoire. Des puzzles faits par des joueurs, gratuits et jouables sans rien installer.",
    intro:
      "Retourner les cartes, retenir où elles étaient. Un jeu simple qui marche à tout âge.",
    detail:
      "Le créateur choisit les symboles et leur nombre : de trois paires pour les plus jeunes à huit pour un vrai défi de mémoire.",
  },
  {
    slug: "musique",
    categorie: "Musique",
    emoji: "🎵",
    titre: "Jeux de musique et de rythme à créer",
    description:
      "Compose une mélodie, fais-la rejouer aux autres. Des jeux musicaux créés dans le navigateur, sans instrument ni logiciel.",
    intro:
      "Poser des notes, écouter, corriger : on compose comme on dessine, en cliquant.",
    detail:
      "Le son est fabriqué par le navigateur lui-même — rien à télécharger, et ta mélodie se partage avec un simple lien.",
  },
  {
    slug: "melodie",
    categorie: "Mélodie",
    emoji: "🎶",
    titre: "Dessiner une mélodie : jeux à créer en ligne",
    description:
      "Trace un trait, il devient une mélodie. Un jeu de création musicale gratuit, à faire et à partager.",
    intro:
      "Ici, la musique se dessine : plus le trait monte, plus la note est aiguë.",
    detail:
      "C'est la catégorie la plus étonnante du site — on comprend en trois secondes, et on y passe une demi-heure.",
  },
  {
    slug: "calcul-mental",
    categorie: "Calcul Mental",
    emoji: "🧮",
    titre: "Calcul mental en ligne : s'entraîner gratuitement",
    description:
      "Additions, soustractions, multiplications, divisions, à ton niveau. Un entraînement au calcul mental gratuit, sans inscription pour jouer.",
    intro:
      "Dix questions, trois niveaux, et un score à la fin. De quoi s'échauffer avant un contrôle.",
    detail:
      "Un parent ou un professeur peut créer une série sur mesure : choisir les opérations, la difficulté et le nombre de questions, puis envoyer le lien.",
  },
  {
    slug: "petit-bac",
    categorie: "Petit Bac",
    emoji: "📝",
    titre: "Petit bac en ligne, à plusieurs",
    description:
      "Le jeu du petit bac, avec tes propres catégories : une lettre, un chronomètre, et c'est parti. Gratuit et jouable à plusieurs.",
    intro:
      "Un prénom, un pays, un animal en « M »… Le petit bac se joue depuis toujours sur du papier ; ici, le chronomètre est intégré.",
    detail:
      "Tu choisis tes catégories — classiques ou complètement décalées — et la durée d'une manche. Idéal en famille ou en classe.",
  },
  {
    slug: "devinettes",
    categorie: "Devinettes",
    emoji: "🔍",
    titre: "Devinettes en ligne : jouer et en écrire",
    description:
      "Des devinettes avec des indices qui se dévoilent un par un. Gratuites, sans installation, et tu peux écrire les tiennes.",
    intro:
      "Un premier indice vague, puis un deuxième, puis la réponse évidente. Tout l'art est dans l'ordre.",
    detail:
      "En écrire de bonnes est plus difficile qu'il n'y paraît : c'est un excellent exercice d'écriture, et ça se partage en un lien.",
  },
  {
    slug: "education",
    categorie: "Éducation",
    emoji: "🎓",
    titre: "Fiches de révision jouables : réviser en s'amusant",
    description:
      "Une leçon courte, puis des questions dessus. Histoire, maths, français, anglais, sciences : révise ou crée ta propre fiche, gratuitement.",
    intro:
      "On lit une leçon de dix lignes, puis on répond à des questions qui portent exactement dessus.",
    detail:
      "Beaucoup d'élèves créent leur fiche pour réviser : écrire les questions est déjà une façon d'apprendre, et la fiche se partage à toute la classe.",
  },
  {
    slug: "python",
    categorie: "Python",
    emoji: "🐍",
    titre: "Apprendre Python avec des exercices en ligne",
    description:
      "Des tutoriels Python écrits par des joueurs : une consigne, un début de code, une sortie attendue. Gratuit, dans le navigateur.",
    intro:
      "Chaque exercice donne une consigne et le résultat attendu : à toi d'écrire le programme qui l'affiche.",
    detail:
      "Rien à installer : tout se passe dans la page. C'est une bonne première marche avant le mode Game Script, où l'on programme un vrai jeu.",
  },
  {
    slug: "game-script",
    categorie: "Game Script",
    emoji: "⌨️",
    titre: "Programmer son jeu dans le navigateur",
    description:
      "Écris ton jeu en quelques lignes de code et joue-y aussitôt. Gratuit, sans installation, avec des exemples à copier.",
    intro:
      "Trois fonctions suffisent pour un jeu complet : une pour démarrer, une pour animer, une pour dessiner.",
    detail:
      "Chaque jeu tourne dans un cadre isolé : il ne peut ni toucher à ton compte, ni sortir sur Internet. On peut donc jouer au programme d'un inconnu sans crainte.",
  },
];

export function categorieSeoBySlug(slug: string): CategorieSeo | null {
  return CATEGORIES_SEO.find((c) => c.slug === slug) ?? null;
}

/** Verification : chaque categorie du site doit avoir sa page. */
export const CATEGORIES_SANS_PAGE = CATEGORIES.filter(
  (c) => !CATEGORIES_SEO.some((s) => s.categorie === c),
);
