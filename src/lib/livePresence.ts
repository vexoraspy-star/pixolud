/**
 * Qui est en ligne en ce moment, partage entre le composant de presence du
 * site (SiteLive) et la fenetre admin : un seul canal Supabase Realtime par
 * onglet, et un petit magasin a abonnement pour les deux.
 */

export interface OnlinePlayer {
  /** « u:<id du compte> » ou « g:<numero d'invite> ». */
  key: string;
  name: string;
  guest: boolean;
  userId: string | null;
  guestNum: string | null;
  /** Ou il est : « Site », ou le jeu 3D en cours. */
  where: string;
}

type Listener = (players: OnlinePlayer[]) => void;

let players: OnlinePlayer[] = [];
const listeners = new Set<Listener>();
let pinger: ((key: string) => void) | null = null;

export function setOnlinePlayers(next: OnlinePlayer[]) {
  players = next;
  for (const l of listeners) l(players);
}

export function subscribeOnline(listener: Listener): () => void {
  listeners.add(listener);
  listener(players);
  return () => {
    listeners.delete(listener);
  };
}

/** Le canal enregistre ici de quoi faire « toc-toc » chez un joueur. */
export function setPinger(fn: ((key: string) => void) | null) {
  pinger = fn;
}

/** Previent un joueur qu'un message l'attend : il le lit aussitot. */
export function pingPlayer(key: string) {
  pinger?.(key);
}
