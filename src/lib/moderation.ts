/**
 * Moderation du chat — ferme, mais pas censuree.
 *
 * Le principe, voulu par le proprietaire : on ne lave pas la bouche des
 * joueurs. Un « putain » ou un « t'es nul » passe : c'est du jeu, pas une
 * agression. Ce qui ne passe pas, c'est ce qui fait du mal pour de vrai ou
 * qui met quelqu'un en danger :
 *
 * - `bloquer` : haine (racisme, homophobie…), menaces de mort ou de
 *   violence, contenu sexuel, incitation au suicide. Le message n'est pas
 *   envoye, et l'equipe le voit dans le panneau.
 * - `masquer` : le message part, mais un numero de telephone, une adresse
 *   e-mail ou une adresse postale est remplace par des points. Beaucoup de
 *   joueurs sont jeunes : leurs coordonnees n'ont rien a faire dans un chat.
 * - `avertir` : harcelement insistant ou hurlement en majuscules. Le message
 *   part quand meme, avec un rappel pour l'auteur.
 * - `ok` : tout le reste, insultes ordinaires comprises.
 *
 * Tout est fait ici, sans appel a l'IA : c'est instantane, gratuit, et le
 * texte des joueurs ne part chez personne.
 */

export type Verdict = "ok" | "avertir" | "masquer" | "bloquer";

export interface Moderation {
  verdict: Verdict;
  /** Le texte a enregistrer (identique, ou avec les coordonnees masquees). */
  texte: string;
  /** Ce qu'on dit a l'auteur. Vide quand il n'y a rien a dire. */
  message: string;
  /** Etiquette courte pour le journal de moderation. */
  motif: string;
}

/**
 * Enleve accents, doublons de lettres et deguisements en chiffres, pour que
 * « c0nn4rd », « coooonnard » et « connard » se lisent pareil. Sans ca, la
 * liste ne servirait a rien : tout le monde contourne en une seconde.
 */
function aplatir(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[4@]/g, "a")
    .replace(/[0]/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[5$]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/(.)\1{2,}/g, "$1$1")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Un mot entier (ou presque : les suffixes francais sont acceptes). */
function contient(plat: string, mots: string[]): string | null {
  for (const mot of mots) {
    const re = new RegExp(`(^|\\s)${mot}(s|es|e|es|x)?($|\\s)`);
    if (re.test(plat)) return mot;
  }
  return null;
}

function contientSuite(plat: string, suites: [string, string][]): string | null {
  for (const [a, b] of suites) {
    if (plat.includes(a) && plat.includes(b)) return `${a}+${b}`;
  }
  return null;
}

// --- Ce qui bloque : atteinte a une personne ou a un groupe --------------

// Insultes qui visent une origine, une religion, une orientation ou un
// handicap. Elles ne sont pas « fortes » : elles designent quelqu'un pour ce
// qu'il est, et c'est la ligne qu'on ne laisse pas passer.
const HAINE = [
  "negre", "negro", "bougnoule", "youpin", "sale arabe", "sale juif", "sale noir",
  "sale blanc", "sale chinois", "pd", "pede", "pedale", "tarlouze", "gouine",
  "tranny", "travelo", "mongol", "mongolien", "trisomique", "nique ta race",
  "nique les arabes", "nique les noirs", "nique les juifs", "heil hitler",
  "sieg heil", "hitler avait raison", "chambre a gaz", "retourne dans ton pays",
];

/**
 * Menaces qui sortent du jeu : elles visent la vraie vie de quelqu'un. Celles
 * la sont bloquees sans discussion.
 */
const MENACES_REELLES = [
  "je vais te violer", "je sais ou tu habites", "je sais ou tu vis",
  "je vais te retrouver", "je viens chez toi", "je t attends devant chez toi",
  "je vais bruler ta maison", "je vais venir a ton ecole", "je vais te planter",
  "je vais te poignarder", "j ai ton adresse",
];

/**
 * Les memes mots, mais dans le feu d'une partie : « je vais te tuer » en duel,
 * tout le monde le dit. On ne bloque pas — on rappelle juste que ca peut etre
 * mal pris. Sauf si la phrase parle de la vraie vie (voir VRAIE_VIE) : la, ce
 * n'est plus du jeu, et ca redevient une menace.
 */
const MENACES_JEU = [
  "je vais te tuer", "je te tue", "je vais te crever", "je vais te buter",
  "je vais te frapper", "je vais te defoncer", "tu vas mourir", "i will kill you",
];

const VRAIE_VIE = [
  "chez toi", "ton ecole", "ton college", "ton lycee", "ton adresse",
  "dans la vraie vie", "irl", "en vrai dehors", "a la sortie",
];

const SUICIDE = [
  "tue toi", "tu devrais te tuer", "va te tuer", "suicide toi", "va te pendre",
  "kill yourself", "kys", "pends toi",
];

const SEXUEL = [
  "suce ma", "suce moi", "nudes", "nude pic", "envoie ta chatte", "envoie ton penis",
  "tu veux baiser", "on baise", "sexe cam", "porn", "porno", "pornhub", "xvideos",
];

// --- Ce qui declenche seulement un avertissement -------------------------

const HARCELEMENT = [
  "casse toi du site", "personne t aime", "t es qu une merde", "degage de ta vie",
  "tout le monde te deteste", "va t en pour toujours",
];

// --- Coordonnees a masquer ----------------------------------------------

const TELEPHONE = /(?:(?:\+|00)\d{1,3}[\s.-]?)?(?:\d[\s.-]?){9,13}\d/g;
const EMAIL = /[\w.+-]+@[\w-]+\.[a-z]{2,10}/gi;
const ADRESSE = /\b\d{1,4}\s?(?:bis|ter)?\s?(?:rue|avenue|av\.?|boulevard|bd\.?|impasse|chemin|allee|allée|place)\s+[\p{L}'-]+/giu;
const IBAN = /\b[A-Z]{2}\d{2}[\sA-Z0-9]{10,30}\b/g;

const POINTS = "●●●●●";

/** Regarde un message et dit ce qu'on en fait. */
export function moderer(brut: string): Moderation {
  const texte = brut.trim();
  const plat = aplatir(texte);

  const haine = contient(plat, HAINE);
  if (haine) {
    return {
      verdict: "bloquer",
      texte,
      motif: "haine",
      message:
        "Message non envoyé : les insultes qui visent l'origine, la religion, le handicap ou l'orientation de quelqu'un sont interdites ici. Le reste, tu peux le dire.",
    };
  }

  const menaceReelle = MENACES_REELLES.find((m) => plat.includes(aplatir(m)));
  const menaceJeu = MENACES_JEU.find((m) => plat.includes(aplatir(m)));
  const vraieVie = VRAIE_VIE.some((v) => plat.includes(aplatir(v)));
  if (menaceReelle || (menaceJeu && vraieVie)) {
    return {
      verdict: "bloquer",
      texte,
      motif: "menace",
      message:
        "Message non envoyé : menacer quelqu'un en dehors du jeu, c'est interdit ici, et c'est aussi interdit par la loi.",
    };
  }
  if (menaceJeu) {
    return {
      verdict: "avertir",
      texte,
      motif: "menace-de-jeu",
      message: "C'est envoyé — mais « je vais te tuer », même en duel, ça peut être mal pris. Garde ça pour le score 😉",
    };
  }

  if (contient(plat, SUICIDE)) {
    return {
      verdict: "bloquer",
      texte,
      motif: "suicide",
      message:
        "Message non envoyé : dire à quelqu'un de se faire du mal n'est jamais une blague. Si toi tu ne vas pas bien, le 3114 répond gratuitement, jour et nuit.",
    };
  }

  if (contient(plat, SEXUEL) || contientSuite(plat, [["envoie", "nudes"]])) {
    return {
      verdict: "bloquer",
      texte,
      motif: "sexuel",
      message: "Message non envoyé : pas de contenu sexuel ici, il y a des enfants sur le site.",
    };
  }

  // --- Coordonnees : le message part, mais nettoye.
  let masque = texte
    .replace(EMAIL, POINTS)
    .replace(IBAN, POINTS)
    .replace(ADRESSE, POINTS);
  masque = masque.replace(TELEPHONE, (m) => (m.replace(/\D/g, "").length >= 9 ? POINTS : m));
  if (masque !== texte) {
    return {
      verdict: "masquer",
      texte: masque,
      motif: "coordonnees",
      message:
        "Ton numéro, ton adresse ou ton e-mail a été masqué : ne donne jamais tes coordonnées dans un chat, même à un ami du site.",
    };
  }

  if (contient(plat, HARCELEMENT)) {
    return {
      verdict: "avertir",
      texte,
      motif: "harcelement",
      message: "C'est envoyé, mais attention : s'acharner sur quelqu'un peut mener à un bannissement.",
    };
  }

  const lettres = texte.replace(/[^\p{L}]/gu, "");
  if (lettres.length >= 12 && lettres === lettres.toUpperCase()) {
    return {
      verdict: "avertir",
      texte,
      motif: "majuscules",
      message: "C'est envoyé. Petit conseil : tout en majuscules, on a l'impression que tu cries.",
    };
  }

  return { verdict: "ok", texte, motif: "", message: "" };
}
