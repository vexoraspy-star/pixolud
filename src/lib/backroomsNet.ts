// Partie a plusieurs dans les Backrooms : ce qui transite entre les joueurs.
//
// Un groupe = un canal Supabase Realtime `backrooms-<CODE>`. Celui qui cree le
// groupe est l'HOTE : il fait penser la creature, decide des coupures de
// courant et des captures, et choisit le niveau. Les autres envoient leur
// position, leurs bruits et leurs actions ; ils affichent la creature telle que
// l'hote la voit. Le niveau lui-meme n'est jamais envoye : meme graine, meme
// carte chez tout le monde.

import type { DeathCause } from "@/components/BackroomsScene";

export const MAX_PARTY = 4;

const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export function makePartyCode(): string {
  let code = "";
  for (let i = 0; i < 5; i++) code += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)];
  return code;
}

export function normalizePartyCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
}

/** Etat d'un joueur, envoye une dizaine de fois par seconde. */
export interface NetPlayerState {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  lamp: boolean;
  crouch: boolean;
  speed: number;
  dead: boolean;
  /** Seed du niveau en cours : on ignore les paquets d'un autre niveau. */
  seed: number;
}

/** La creature telle que l'hote la voit. */
export interface NetEntityState {
  x: number;
  z: number;
  yaw: number;
  walk: number;
  speed: number;
  state: string;
  active: boolean;
  visible: boolean;
  lunge: number;
  opacity: number;
}

export type NetEvent =
  /** Un objet ramasse : il disparait chez tout le monde (les fusibles comptent pour le groupe). */
  | { type: "pickup"; index: number }
  | { type: "valve"; index: number }
  /** Bruit d'un joueur, pour l'IA de l'hote. */
  | { type: "noise"; x: number; z: number; radius: number }
  | { type: "blackout"; on: boolean }
  /** L'hote annonce une coupure imminente : les neons clignotent 2,2 s chez tout le monde. */
  | { type: "blackout-warn" }
  /** L'hote annonce qu'un joueur est pris. */
  | { type: "caught"; id: string; cause: DeathCause }
  /** Quelqu'un a franchi la sortie : tout le groupe passe au niveau suivant. */
  | { type: "complete" }
  /** Tout le groupe est mort. */
  | { type: "wipe"; cause: DeathCause }
  /** Niveau ! : la poursuite commence. */
  | { type: "run" };

export interface RemotePlayer {
  id: string;
  name: string;
  color: number;
  state: NetPlayerState | null;
  /** Instant (performance.now) du dernier paquet, pour cacher les joueurs figes. */
  seenAt: number;
}

/**
 * Boite aux lettres partagee entre le salon (React) et la scene 3D. La scene
 * la lit a chaque image, sans jamais declencher de rendu React.
 */
export interface PartyLink {
  selfId: string;
  isHost: boolean;
  players: Map<string, RemotePlayer>;
  entity: NetEntityState | null;
  inbox: (NetEvent & { from: string })[];
  sendState: (state: NetPlayerState, entity?: NetEntityState) => void;
  sendEvent: (event: NetEvent) => void;
}
