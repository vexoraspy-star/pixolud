import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { TankBonus } from "./tankCareer";
import type { BattleMode, Difficulty } from "./tankDefs";
import type { MapId } from "./tankTerrain";
import { ROOM_MAX, type NetInput, type NetSnapshot, type RoomStart } from "./tankNet";

// Le salon d'une partie en ligne de « Tonnerre d'Acier », sur un canal temps
// reel Supabase (diffusion + presence, rien n'est ecrit en base). La presence
// donne la liste des joueurs et leur char ; l'hote diffuse les reglages, le
// signal de depart puis l'etat de la bataille ; les invites envoient leurs
// commandes.

export interface RoomMember {
  key: string;
  name: string;
  tankId: string;
  camo: string | null;
  bonus: TankBonus | null;
  ready: boolean;
  host: boolean;
  joinedAt: number;
  /** Au salon, ou en bataille. */
  phase: "salon" | "bataille";
}

export interface RoomSettings {
  mode: BattleMode;
  map: MapId | "hasard";
  /** Tous ensemble contre les bots, ou les uns contre les autres. */
  teams: "coop" | "pvp";
  difficulty: Difficulty;
}

/** Ce que chaque joueur choisit lui-meme : son nom et son char. */
export type MemberChoice = Pick<RoomMember, "name" | "tankId" | "camo" | "bonus">;

function newKey(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Ce que le salon signale a l'ecran du garage. */
export interface LobbyListeners {
  /** Le salon a change (joueurs, reglages, fermeture). */
  change?: () => void;
  /** L'hote lance une bataille. */
  start?: (start: RoomStart) => void;
}

/** Ce que le salon signale pendant une bataille. */
export interface BattleListeners {
  snapshot?: (snap: NetSnapshot) => void;
  input?: (msg: NetInput) => void;
  loaded?: (key: string) => void;
  /** Un joueur s'en va (parti du salon, ou revenu au garage). */
  leave?: (key: string) => void;
}

export class TankRoom {
  readonly code: string;
  readonly me: string;
  readonly isHost: boolean;
  members: RoomMember[] = [];
  settings: RoomSettings;
  /** Connexion en cours, salon ouvert, ou ferme (voir `closedReason`). */
  status: "connexion" | "ouvert" | "ferme" = "connexion";
  closedReason: string | null = null;

  private lobby: LobbyListeners | null = null;
  private fight: BattleListeners | null = null;

  private channel: RealtimeChannel;
  private mine: RoomMember;
  private lastStart = 0;
  private hostSeen = false;
  private known = new Set<string>();
  private phases = new Map<string, RoomMember["phase"]>();
  private hostTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(code: string, host: boolean, choice: MemberChoice, settings: RoomSettings) {
    this.code = code;
    this.isHost = host;
    this.me = newKey();
    this.settings = settings;
    this.mine = { ...choice, key: this.me, ready: host, host, joinedAt: Date.now(), phase: "salon" };
    const supabase = createClient();
    this.channel = supabase.channel(`tanks-${code}`, {
      config: { broadcast: { self: false }, presence: { key: this.me } },
    });
    this.channel
      .on("presence", { event: "sync" }, () => this.syncMembers())
      .on("broadcast", { event: "reglages" }, ({ payload }: { payload: RoomSettings }) => {
        if (this.isHost) return;
        this.settings = payload;
        this.lobby?.change?.();
      })
      .on("broadcast", { event: "depart" }, ({ payload }: { payload: RoomStart }) => {
        if (this.isHost || payload.id === this.lastStart) return;
        if (!payload.lineup.some((s) => s.human === this.me)) return;
        this.lastStart = payload.id;
        this.lobby?.start?.(payload);
      })
      .on("broadcast", { event: "etat" }, ({ payload }: { payload: NetSnapshot }) => {
        if (!this.isHost) this.fight?.snapshot?.(payload);
      })
      .on("broadcast", { event: "cmd" }, ({ payload }: { payload: NetInput }) => {
        if (this.isHost) this.fight?.input?.(payload);
      })
      .on("broadcast", { event: "charge" }, ({ payload }: { payload: { k: string } }) => {
        if (this.isHost) this.fight?.loaded?.(payload.k);
      })
      .subscribe((state: string) => {
        if (state === "SUBSCRIBED") {
          void this.channel.track(this.mine);
          if (this.status === "connexion") {
            this.status = "ouvert";
            this.lobby?.change?.();
          }
        } else if ((state === "CHANNEL_ERROR" || state === "TIMED_OUT") && this.status === "connexion") {
          this.close("Connexion impossible au salon. Réessaie dans un instant.");
        }
      });
    // Un invite qui ne trouve pas d'hote : mauvais code, ou salon ferme.
    if (!host) {
      this.hostTimer = setTimeout(() => {
        if (!this.hostSeen) this.close("Aucun salon ouvert avec ce code.");
      }, 7000);
    }
  }

  private syncMembers() {
    const state = this.channel.presenceState<RoomMember>();
    const list: RoomMember[] = [];
    for (const entries of Object.values(state)) {
      // La plus recente : un joueur qui change de char met sa presence a jour.
      const m = entries[entries.length - 1];
      if (m && typeof m.key === "string") list.push({ ...m });
    }
    list.sort((a, b) => a.joinedAt - b.joinedAt || a.key.localeCompare(b.key));
    const keys = new Set(list.map((m) => m.key));
    for (const k of this.known) if (!keys.has(k) && k !== this.me) this.fight?.leave?.(k);
    // Un joueur revenu au salon pendant la bataille l'a quittee.
    for (const m of list) {
      if (m.key !== this.me && this.phases.get(m.key) === "bataille" && m.phase === "salon") this.fight?.leave?.(m.key);
      this.phases.set(m.key, m.phase);
    }
    const fresh = list.some((m) => !this.known.has(m.key));
    this.known = keys;
    this.members = list;
    const host = list.find((m) => m.host);
    if (host) this.hostSeen = true;
    if (!this.isHost && this.hostSeen && !host) {
      this.close("L'hôte a fermé le salon.");
      return;
    }
    // Les premiers arrives ont leur place : au-dela, le salon est complet.
    if (!this.isHost && list.findIndex((m) => m.key === this.me) >= ROOM_MAX) {
      this.close("Ce salon est complet.");
      return;
    }
    // Un nouveau venu recoit les reglages de l'hote.
    if (this.isHost && fresh) void this.broadcast("reglages", this.settings);
    this.lobby?.change?.();
  }

  private broadcast(event: string, payload: unknown) {
    if (this.status === "ferme") return Promise.resolve();
    return this.channel.send({ type: "broadcast", event, payload });
  }

  /** Ecoute du garage ; renvoie de quoi l'arreter. */
  listenLobby(l: LobbyListeners): () => void {
    this.lobby = l;
    return () => {
      if (this.lobby === l) this.lobby = null;
    };
  }

  /** Ecoute d'une bataille ; renvoie de quoi l'arreter. */
  listenBattle(l: BattleListeners): () => void {
    this.fight = l;
    return () => {
      if (this.fight === l) this.fight = null;
    };
  }

  /** Mon char, mon nom, et si je suis pret (presence). */
  update(patch: Partial<Omit<RoomMember, "key" | "host" | "joinedAt">>) {
    this.mine = { ...this.mine, ...patch };
    if (this.status === "ouvert") void this.channel.track(this.mine);
  }

  get mineInfo(): RoomMember {
    return this.mine;
  }

  /** Hote : nouveaux reglages pour tout le salon. */
  setSettings(settings: RoomSettings) {
    if (!this.isHost) return;
    this.settings = settings;
    void this.broadcast("reglages", settings);
    this.lobby?.change?.();
  }

  /** Hote : le signal de depart, repete pour ceux qui l'auraient manque. */
  start(start: RoomStart) {
    if (!this.isHost) return;
    this.lastStart = start.id;
    for (const delay of [0, 600, 1600]) {
      setTimeout(() => {
        if (this.lastStart === start.id) void this.broadcast("depart", start);
      }, delay);
    }
  }

  sendSnapshot(snap: NetSnapshot) {
    void this.broadcast("etat", snap);
  }

  sendInput(msg: NetInput) {
    void this.broadcast("cmd", msg);
  }

  sendLoaded() {
    void this.broadcast("charge", { k: this.me });
  }

  private close(reason: string) {
    if (this.status === "ferme") return;
    this.status = "ferme";
    this.closedReason = reason;
    if (this.hostTimer) clearTimeout(this.hostTimer);
    void this.channel.untrack().catch(() => {});
    void createClient().removeChannel(this.channel);
    this.lobby?.change?.();
  }

  /** Quitter le salon. */
  leave() {
    this.close("Tu as quitté le salon.");
  }
}
