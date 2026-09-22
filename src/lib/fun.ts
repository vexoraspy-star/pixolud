import { useSyncExternalStore } from "react";

export interface ShameBadge {
  id: string;
  emoji: string;
  label: string;
  description: string;
  statKey: string;
  threshold: number;
}

export const SHAME_BADGES: ShameBadge[] = [
  {
    id: "cascadeur",
    emoji: "💀",
    label: "Le Cascadeur",
    description: "Mourir 10 fois en Territoire.",
    statKey: "territoire-death",
    threshold: 10,
  },
  {
    id: "chute-libre",
    emoji: "🕳️",
    label: "Chute Libre",
    description: "Tomber 20 fois en Plateforme.",
    statKey: "plateforme-fall",
    threshold: 20,
  },
  {
    id: "pas-presse",
    emoji: "🐌",
    label: "Pas Pressé",
    description: "Perdre 15 fois au Runner.",
    statKey: "runner-lost",
    threshold: 15,
  },
  {
    id: "trop-tot",
    emoji: "⏱️",
    label: "Toujours Trop Tôt",
    description: "Démarrer 10 fois avant le signal en Course.",
    statKey: "course-too-soon",
    threshold: 10,
  },
];

export const SECRET_CHARACTER = "🥷";

/**
 * Les codes secrets.
 *
 * Un seul code (le Konami) se raconte une fois et c'est fini. Plusieurs codes
 * font durer la chasse : on en trouve un, on sait qu'il y en a d'autres, et
 * on cherche. Chacun donne quelque chose qui SE VOIT — sinon personne ne
 * croit l'avoir reussi.
 *
 * `touches` est la suite exacte de touches a taper (minuscules pour les
 * lettres, noms de touches pour les fleches). `indice` est ce qu'on affiche
 * aux joueurs pour les mettre sur la piste sans donner la reponse.
 */
export interface SecretCode {
  id: string;
  label: string;
  touches: string[];
  indice: string;
  recompense: string;
}

export const SECRET_CODES: SecretCode[] = [
  {
    id: "konami",
    label: "Le classique",
    touches: ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"],
    indice: "Le code de toutes les vieilles consoles : deux fois en haut, deux fois en bas\u2026",
    recompense: `Personnage secret ${SECRET_CHARACTER}`,
  },
  {
    id: "pixo",
    label: "L'ami robot",
    touches: ["p", "i", "x", "o"],
    indice: "Tape le nom de la mascotte du site.",
    recompense: "Pixo met son chapeau de fete \ud83c\udf89",
  },
  {
    id: "arcenciel",
    label: "Arc-en-ciel",
    touches: ["r", "a", "i", "n", "b", "o", "w"],
    indice: "Un mot anglais de sept lettres, apres la pluie.",
    recompense: "Un halo color\u00e9 autour du curseur",
  },
  {
    id: "nuit",
    label: "Nuit noire",
    touches: ["n", "u", "i", "t"],
    indice: "Quatre lettres : quand le soleil se couche.",
    recompense: "Le site s'assombrit d'un cran",
  },
  {
    id: "turbo",
    label: "Turbo",
    touches: ["t", "u", "r", "b", "o"],
    indice: "Ce qu'on crie quand on veut aller plus vite.",
    recompense: "Les animations du site acc\u00e9l\u00e8rent",
  },
  {
    id: "gravite",
    label: "Gravit\u00e9 z\u00e9ro",
    touches: ["ArrowUp", "ArrowUp", "ArrowUp", "g"],
    indice: "Trois fois vers le ciel, puis la premi\u00e8re lettre de ce qui nous retient au sol.",
    recompense: "Les cartes du catalogue se mettent \u00e0 flotter",
  },
];

const CODE_PREFIX = "pixolud_code_";

const FUN_EVENT_NAME = "pixolud:fun-event";
const STORE_CHANGED_EVENT = "pixolud:fun-store-changed";
const STAT_PREFIX = "pixolud_stat_";
const BADGE_PREFIX = "pixolud_badge_";
const SECRET_KEY = "pixolud_secret_konami";

function notifyStoreChanged() {
  if (typeof window === "undefined") return;
  refreshCodesSnapshot();
  window.dispatchEvent(new Event(STORE_CHANGED_EVENT));
}

function subscribeToStore(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(STORE_CHANGED_EVENT, callback);
  return () => window.removeEventListener(STORE_CHANGED_EVENT, callback);
}

let foundCodesSnapshot: string[] = [];
let badgesSnapshot = new Set<string>();
function refreshBadgesSnapshot() {
  badgesSnapshot = new Set(SHAME_BADGES.filter((b) => isBadgeUnlocked(b.id)).map((b) => b.id));
}
refreshBadgesSnapshot();

function refreshCodesSnapshot() {
  foundCodesSnapshot = SECRET_CODES.filter((c) => isCodeFound(c.id)).map((c) => c.id);
}

export function fireFunEvent(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(FUN_EVENT_NAME, { detail: { message } }));
}

export function onFunEvent(handler: (message: string) => void): () => void {
  if (typeof window === "undefined") return () => {};
  function listener(e: Event) {
    const detail = (e as CustomEvent<{ message: string }>).detail;
    handler(detail.message);
  }
  window.addEventListener(FUN_EVENT_NAME, listener);
  return () => window.removeEventListener(FUN_EVENT_NAME, listener);
}

export function recordEvent(statKey: string) {
  if (typeof window === "undefined") return;
  const key = STAT_PREFIX + statKey;
  const current = Number(localStorage.getItem(key) ?? "0") + 1;
  localStorage.setItem(key, String(current));

  for (const badge of SHAME_BADGES) {
    if (badge.statKey !== statKey || current !== badge.threshold) continue;
    const unlockKey = BADGE_PREFIX + badge.id;
    if (localStorage.getItem(unlockKey)) continue;
    localStorage.setItem(unlockKey, "1");
    refreshBadgesSnapshot();
    notifyStoreChanged();
    fireFunEvent(`🏆 Trophée débloqué : ${badge.emoji} ${badge.label} — ${badge.description}`);
  }
}

export function isBadgeUnlocked(id: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(BADGE_PREFIX + id) === "1";
}

export function isSecretUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SECRET_KEY) === "1";
}

export function unlockSecret() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(SECRET_KEY) === "1") return;
  localStorage.setItem(SECRET_KEY, "1");
  notifyStoreChanged();
  fireFunEvent(`🥷 Code secret activé ! Nouveau personnage débloqué : ${SECRET_CHARACTER}`);
}

/**
 * Un code vient d'etre tape.
 *
 * L'effet visuel passe par un attribut sur <html> : le CSS s'en occupe, et
 * l'effet survit aux changements de page sans qu'aucun composant n'ait besoin
 * de le savoir. Le Konami garde son ancienne cle, pour que les joueurs qui
 * l'avaient deja trouve ne perdent pas leur personnage.
 */
export function unlockCode(id: string) {
  if (typeof window === "undefined") return;
  const code = SECRET_CODES.find((c) => c.id === id);
  if (!code) return;
  if (id === "konami") {
    unlockSecret();
    appliquerCodes();
    return;
  }
  const key = CODE_PREFIX + id;
  if (localStorage.getItem(key) === "1") {
    // Deja trouve : on le retire, ca sert d'interrupteur.
    localStorage.removeItem(key);
    appliquerCodes();
    notifyStoreChanged();
    fireFunEvent(`✨ Code « ${code.label} » désactivé. Retape-le pour le remettre.`);
    return;
  }
  localStorage.setItem(key, "1");
  appliquerCodes();
  notifyStoreChanged();
  fireFunEvent(`✨ Code secret trouvé : « ${code.label} » — ${code.recompense} !`);
}

export function isCodeFound(id: string): boolean {
  if (typeof window === "undefined") return false;
  if (id === "konami") return isSecretUnlocked();
  return localStorage.getItem(CODE_PREFIX + id) === "1";
}

export function foundCodes(): string[] {
  return SECRET_CODES.filter((c) => isCodeFound(c.id)).map((c) => c.id);
}

/** Recopie les codes actifs sur <html>, la ou le CSS peut les voir. */
export function appliquerCodes() {
  if (typeof window === "undefined") return;
  const actifs = SECRET_CODES.filter((c) => c.id !== "konami" && isCodeFound(c.id)).map((c) => c.id);
  const racine = document.documentElement;
  if (actifs.length) racine.setAttribute("data-codes", actifs.join(" "));
  else racine.removeAttribute("data-codes");
}

export function useFoundCodes(): string[] {
  return useSyncExternalStore(subscribeToStore, () => foundCodesSnapshot, () => foundCodesSnapshot);
}

export function useSecretUnlocked(): boolean {
  return useSyncExternalStore(subscribeToStore, isSecretUnlocked, () => false);
}

export function useUnlockedBadges(): Set<string> {
  return useSyncExternalStore(subscribeToStore, () => badgesSnapshot, () => badgesSnapshot);
}
