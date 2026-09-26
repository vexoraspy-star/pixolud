"use client";

import { guestName as guestNameOf } from "@/lib/guest";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LEVELS } from "@/lib/backrooms";
import { createClient } from "@/lib/supabase/client";
import { SURVIVOR_COLORS } from "@/lib/backroomsCharacters";
import {
  MAX_PARTY,
  makePartyCode,
  normalizePartyCode,
  type NetEntityState,
  type NetEvent,
  type NetPlayerState,
  type PartyLink,
} from "@/lib/backroomsNet";
import { VoiceHub, type MicState, type VoiceSignal } from "@/lib/backroomsVoice";
import BackroomsScene, { type DeathCause, type LevelStats } from "./BackroomsScene";
import BackroomsLobbyStage from "./BackroomsLobbyStage";

// Deroule des Backrooms : menu, niveaux enchaines, mort, fin.
// Le niveau le plus loin atteint est garde dans le navigateur, pour pouvoir
// reprendre sans tout refaire depuis le Hall.
//
// En groupe (code a 5 lettres) : jusqu'a quatre survivants dans le meme
// niveau, un salon vocal pair-a-pair, et une creature qui entend les voix.

type Phase = "menu" | "lobby" | "playing" | "transition" | "dead" | "ending";

interface Member {
  id: string;
  name: string;
  host: boolean;
  joinedAt: number;
}

const MIC_TEXT: Record<MicState, string> = {
  off: "Micro éteint",
  demande: "Autorise le micro dans ton navigateur…",
  actif: "Micro actif",
  refuse: "Micro refusé : autorise-le dans les réglages du navigateur (icône à gauche de l'adresse).",
  indisponible: "Ce navigateur ne donne pas accès au micro.",
};

const PROGRESS_KEY = "pixolud_backrooms_niveau";

const DEATH_TEXT: Record<DeathCause, { title: string; text: string }> = {
  lucidite: {
    title: "Tu t'es perdu",
    text: "Le bourdonnement a fini par couvrir tes pensées. Tu marches encore, quelque part dans le Hall. Tu ne te souviens plus pourquoi.",
  },
  souriant: {
    title: "Il souriait",
    text: "Dans le noir, il ne restait que ses dents. Tu aurais dû éteindre ta lampe.",
  },
  bacterie: {
    title: "Elle t'a entendu",
    text: "Des doigts trop longs, un claquement sec, et plus rien. Chaque pas fait du bruit, ici.",
  },
  voleur: {
    title: "Tu as détourné les yeux",
    text: "Une seconde, pas plus. Quand tu t'es retourné, il était là, tout près, avec ce visage d'emprunt. Demain, quelqu'un portera le tien dans les couloirs de l'hôtel.",
  },
  chiens: {
    title: "Ils t'ont entendu",
    text: "Pas une lumière, pas un bruit — sauf toi. Des griffes sur le béton, un souffle chaud dans le noir, puis plus rien.",
  },
  fetards: {
    title: "Joyeux anniversaire",
    text: "Ils t'ont fait coucou. Tu n'as pas couru assez vite. La fête continue, et maintenant, toi aussi, tu souris.",
  },
};

function loadProgress(): number {
  try {
    const v = Number(window.localStorage.getItem(PROGRESS_KEY));
    return Number.isFinite(v) ? Math.max(0, Math.min(LEVELS.length - 1, Math.floor(v))) : 0;
  } catch {
    return 0;
  }
}
function saveProgress(index: number) {
  try {
    window.localStorage.setItem(PROGRESS_KEY, String(index));
  } catch {
    // stockage indisponible : on rejouera depuis le debut, rien de grave
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return `${m}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Un couloir du Hall en perspective, dessine en SVG : le fond du menu. */
function Corridor() {
  const panels = [0, 1, 2, 3, 4, 5];
  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="br-wall-l" x1="0" x2="1">
          <stop offset="0" stopColor="#6d5f26" />
          <stop offset="1" stopColor="#b9a452" />
        </linearGradient>
        <linearGradient id="br-wall-r" x1="1" x2="0">
          <stop offset="0" stopColor="#6d5f26" />
          <stop offset="1" stopColor="#b9a452" />
        </linearGradient>
        <linearGradient id="br-floor" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#3d3313" />
          <stop offset="1" stopColor="#8b7a3e" />
        </linearGradient>
        <radialGradient id="br-fog" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#d9c97a" stopOpacity="0.95" />
          <stop offset="1" stopColor="#d9c97a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="240" fill="#a8964a" />
      <polygon points="0,0 170,95 170,145 0,240" fill="url(#br-wall-l)" />
      <polygon points="400,0 230,95 230,145 400,240" fill="url(#br-wall-r)" />
      <polygon points="0,240 170,145 230,145 400,240" fill="url(#br-floor)" />
      <polygon points="0,0 170,95 230,95 400,0" fill="#cfc193" />
      {panels.map((i) => {
        const t = i / panels.length;
        const k = Math.pow(1 - t, 1.8);
        const y = 95 - 88 * k;
        const w = 12 + 70 * k;
        const h = 2 + 9 * k;
        return (
          <rect
            key={i}
            x={200 - w / 2}
            y={y}
            width={w}
            height={h}
            fill="#fffbe6"
            style={i === 2 ? { animation: "horror-flicker 3.2s steps(2) infinite" } : undefined}
          />
        );
      })}
      {/* Une porte au fond, a gauche. */}
      <polygon points="150,106 162,112 162,140 150,146" fill="#3a3218" />
      <rect x="170" y="95" width="60" height="50" fill="url(#br-fog)" />
    </svg>
  );
}

export default function BackroomsGame({
  title,
  pseudo = null,
  devAllowed = false,
}: {
  title: string;
  /** Pseudo du compte connecte ; sinon un nom d'invite. */
  pseudo?: string | null;
  /** Compte admin, verifie cote serveur. */
  devAllowed?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("menu");
  const [levelIndex, setLevelIndex] = useState(0);
  const [seed, setSeed] = useState(1);
  const [unlocked, setUnlocked] = useState(0);
  const [death, setDeath] = useState<{ cause: DeathCause; stats: LevelStats } | null>(null);
  const [run, setRun] = useState({ seconds: 0, deaths: 0, water: 0 });
  const [devLaunch, setDevLaunch] = useState(false);

  // --- Voix et groupe ---
  const [selfId] = useState(() => `j${Math.random().toString(36).slice(2, 10)}`);
  // Sans compte : le meme numero que partout sur le site (« Joueur 482193 »).
  const [guestName] = useState(() => (typeof window === "undefined" ? "Joueur" : guestNameOf()));
  const myName = (pseudo ?? guestName).slice(0, 18);
  const [voice, setVoice] = useState<VoiceHub | null>(null);
  const [micState, setMicState] = useState<MicState>("off");
  const [muted, setMuted] = useState(false);
  const [talkSolo, setTalkSolo] = useState(false);
  const [party, setParty] = useState<{ code: string; isHost: boolean } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [speaking, setSpeaking] = useState<Record<string, boolean>>({});
  const [joinInput, setJoinInput] = useState("");
  const [partyError, setPartyError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [lobbyLevel, setLobbyLevel] = useState(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null);
  const voiceRef = useRef<VoiceHub | null>(null);
  const linkRef = useRef<PartyLink | null>(null);
  const partyRef = useRef<{ code: string; isHost: boolean } | null>(null);
  const levelIndexRef = useRef(0);
  useEffect(() => {
    levelIndexRef.current = levelIndex;
  }, [levelIndex]);

  useEffect(() => {
    const t = setTimeout(() => setUnlocked(loadProgress()), 0);
    return () => clearTimeout(t);
  }, []);

  const leaveParty = useCallback((message: string | null = null) => {
    if (channelRef.current) {
      createClient().removeChannel(channelRef.current);
      channelRef.current = null;
    }
    linkRef.current = null;
    partyRef.current = null;
    voiceRef.current?.close();
    voiceRef.current = null;
    setVoice(null);
    setMicState("off");
    setMuted(false);
    setTalkSolo(false);
    setParty(null);
    setMembers([]);
    setSpeaking({});
    setPartyError(message);
    setPhase("menu");
  }, []);

  // Tout couper en quittant la page : canal, micro, connexions vocales.
  useEffect(
    () => () => {
      if (channelRef.current) createClient().removeChannel(channelRef.current);
      voiceRef.current?.close();
    },
    [],
  );

  // Qui parle, au salon : l'indicateur s'allume a cote du nom.
  useEffect(() => {
    if (phase !== "lobby" || !voice) return;
    const id = window.setInterval(() => {
      const next: Record<string, boolean> = {};
      for (const peer of voice.peerIds()) next[peer] = voice.peerLevel(peer) > 0.12;
      next[selfId] = voice.level() > 0.2;
      setSpeaking((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    }, 150);
    return () => window.clearInterval(id);
  }, [phase, voice, selfId]);

  function start(index: number, fresh: boolean, dev = false) {
    setDevLaunch(dev && devAllowed);
    setLevelIndex(index);
    setSeed(Date.now());
    if (fresh) setRun({ seconds: 0, deaths: 0, water: 0 });
    setPhase("playing");
  }

  /** Lance un niveau pour tout le groupe (hote seulement), ou le recoit. */
  const beginGroupLevel = useCallback((index: number, levelSeed: number) => {
    const link = linkRef.current;
    if (link) {
      link.inbox.length = 0;
      link.entity = null;
    }
    setDevLaunch(false);
    setDeath(null);
    setLevelIndex(index);
    setSeed(levelSeed);
    setPhase("playing");
  }, []);

  function hostStart(index: number, fresh: boolean) {
    const levelSeed = Date.now();
    channelRef.current?.send({ type: "broadcast", event: "start", payload: { index, seed: levelSeed } });
    if (fresh) setRun({ seconds: 0, deaths: 0, water: 0 });
    beginGroupLevel(index, levelSeed);
  }

  function hostBackToLobby() {
    channelRef.current?.send({ type: "broadcast", event: "lobby", payload: {} });
    setPhase("lobby");
  }

  async function enableMic(hub: VoiceHub) {
    hub.resume();
    const state = await hub.enableMic();
    setMicState(state);
    return state;
  }

  async function toggleTalkSolo() {
    if (talkSolo) {
      voiceRef.current?.close();
      voiceRef.current = null;
      setVoice(null);
      setTalkSolo(false);
      setMicState("off");
      return;
    }
    const hub = new VoiceHub("solo", () => {});
    voiceRef.current = hub;
    setVoice(hub);
    const state = await enableMic(hub);
    if (state === "actif") {
      setTalkSolo(true);
    } else {
      hub.close();
      voiceRef.current = null;
      setVoice(null);
    }
  }

  function joinChannel(code: string, host: boolean) {
    leaveParty();
    setPartyError(null);
    const supabase = createClient();
    const channel = supabase.channel(`backrooms-${code}`, {
      config: { broadcast: { self: false }, presence: { key: selfId } },
    });
    channelRef.current = channel;

    const hub = new VoiceHub(selfId, (to: string, data: VoiceSignal) => {
      channel.send({ type: "broadcast", event: "signal", payload: { to, from: selfId, data } });
    });
    hub.resume();
    voiceRef.current = hub;
    setVoice(hub);

    const link: PartyLink = {
      selfId,
      isHost: host,
      players: new Map(),
      entity: null,
      inbox: [],
      sendState: (state: NetPlayerState, entity?: NetEntityState) => {
        channel.send({ type: "broadcast", event: "state", payload: { id: selfId, state, entity } });
      },
      sendEvent: (event: NetEvent) => {
        channel.send({ type: "broadcast", event: "event", payload: { from: selfId, event } });
      },
    };
    linkRef.current = link;
    const info = { code, isHost: host };
    partyRef.current = info;
    setParty(info);
    setMembers([{ id: selfId, name: myName, host, joinedAt: Date.now() }]);
    setPhase("lobby");

    let sawHost = host;
    let joinedAt = Date.now();

    channel
      .on("broadcast", { event: "state" }, ({ payload }: { payload: { id: string; state: NetPlayerState; entity?: NetEntityState } }) => {
        const player = link.players.get(payload.id);
        if (!player) return;
        player.state = payload.state;
        player.seenAt = performance.now();
        if (payload.entity && !link.isHost) link.entity = payload.entity;
      })
      .on("broadcast", { event: "event" }, ({ payload }: { payload: { from: string; event: NetEvent } }) => {
        if (link.inbox.length < 200) link.inbox.push({ ...payload.event, from: payload.from });
      })
      .on("broadcast", { event: "signal" }, ({ payload }: { payload: { to: string; from: string; data: VoiceSignal } }) => {
        if (payload.to === selfId) void hub.handleSignal(payload.from, payload.data);
      })
      .on("broadcast", { event: "start" }, ({ payload }: { payload: { index: number; seed: number } }) => {
        if (link.isHost) return;
        const index = Math.max(0, Math.min(LEVELS.length - 1, Math.floor(payload.index)));
        beginGroupLevel(index, payload.seed);
      })
      .on("broadcast", { event: "lobby" }, () => {
        if (!link.isHost) setPhase("lobby");
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, Member[]>;
        const list = Object.values(state)
          .flatMap((entries) => entries)
          .filter((m) => m && typeof m.id === "string")
          .sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
        // Un seul exemplaire par joueur (reconnexions).
        const unique = list.filter((m, i) => list.findIndex((o) => o.id === m.id) === i);
        const myIndex = unique.findIndex((m) => m.id === selfId);
        if (myIndex >= MAX_PARTY) {
          leaveParty(`Ce groupe est complet (${MAX_PARTY} survivants maximum).`);
          return;
        }
        const hostHere = unique.some((m) => m.host);
        if (hostHere) sawHost = true;
        if (!host && sawHost && !hostHere) {
          leaveParty("L'hôte a quitté le groupe.");
          return;
        }
        const kept = unique.slice(0, MAX_PARTY);
        const ids = new Set(kept.map((m) => m.id));
        kept.forEach((m, index) => {
          if (m.id === selfId) return;
          const existing = link.players.get(m.id);
          if (existing) {
            existing.name = m.name;
            existing.color = index;
          } else {
            link.players.set(m.id, { id: m.id, name: m.name, color: index, state: null, seenAt: 0 });
          }
          hub.connectPeer(m.id);
        });
        for (const id of [...link.players.keys()]) {
          if (!ids.has(id)) {
            link.players.delete(id);
            hub.removePeer(id);
          }
        }
        setMembers(kept);
      })
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          joinedAt = Date.now();
          channel.track({ id: selfId, name: myName, host, joinedAt });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          leaveParty("Connexion au groupe impossible. Vérifie ta connexion et réessaie.");
        }
      });
  }

  function createParty() {
    joinChannel(makePartyCode(), true);
  }

  function joinParty() {
    const code = normalizePartyCode(joinInput);
    if (code.length !== 5) {
      setPartyError("Le code fait 5 lettres. Demande-le à la personne qui a créé le groupe.");
      return;
    }
    joinChannel(code, false);
  }

  const handleDeath = useCallback((cause: DeathCause, stats: LevelStats) => {
    setDeath({ cause, stats });
    setRun((r) => ({ seconds: r.seconds + stats.seconds, deaths: r.deaths + 1, water: r.water + stats.water }));
    setPhase("dead");
  }, []);

  const handleComplete = useCallback(
    (stats: LevelStats) => {
      setRun((r) => ({ ...r, seconds: r.seconds + stats.seconds, water: r.water + stats.water }));
      const next = levelIndexRef.current + 1;
      const inParty = partyRef.current;
      if (next >= LEVELS.length) {
        setPhase("ending");
        return;
      }
      if (next > unlocked && !devLaunch) {
        setUnlocked(next);
        saveProgress(next);
      }
      setPhase("transition");
      // En groupe, seul l'hote enchaine : les autres attendent son signal.
      if (inParty && !inParty.isHost) return;
      window.setTimeout(() => {
        if (inParty) {
          const levelSeed = Date.now();
          channelRef.current?.send({ type: "broadcast", event: "start", payload: { index: next, seed: levelSeed } });
          beginGroupLevel(next, levelSeed);
        } else {
          setLevelIndex(next);
          setSeed(Date.now());
          setPhase("playing");
        }
      }, 2600);
    },
    [unlocked, devLaunch, beginGroupLevel],
  );

  if (phase === "playing") {
    return (
      <BackroomsScene
        key={`${LEVELS[levelIndex].id}-${seed}`}
        level={LEVELS[levelIndex]}
        seed={seed}
        onDeath={handleDeath}
        onComplete={handleComplete}
        party={party ? linkRef : null}
        voice={voice}
        micEnabled={talkSolo}
        devAllowed={devAllowed && !party}
        devOpenAtStart={devLaunch}
      />
    );
  }

  if (phase === "lobby" && party) {
    const isHost = party.isHost;
    return (
      <div className="relative flex h-full w-full overflow-hidden bg-[#0b0a06] font-mono text-[#f3e3a0]">
        <div className="pointer-events-none absolute inset-0 opacity-35">
          <Corridor />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-black/75" />
        <div className="relative mx-auto flex h-full w-full max-w-2xl flex-col overflow-y-auto px-5 py-6">
          <div className="flex items-center justify-between text-[12px] tracking-widest">
            <button type="button" onClick={() => leaveParty()} className="opacity-70 transition hover:opacity-100">
              ← QUITTER LE GROUPE
            </button>
            <span className="opacity-70">{isHost ? "TU ES L'HÔTE" : "INVITÉ"}</span>
          </div>

          <p className="mt-8 text-[11px] tracking-[0.5em] opacity-60">CODE DU GROUPE</p>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <span className="text-5xl font-black tracking-[0.3em] sm:text-6xl" style={{ textShadow: "3px 0 rgba(255,0,60,0.45), -3px 0 rgba(0,200,255,0.45)" }}>
              {party.code}
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(party.code).then(
                  () => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  },
                  () => {},
                );
              }}
              className="border border-[#f3e3a0]/50 px-3 py-1.5 text-[11px] tracking-widest transition hover:border-[#f3e3a0]"
            >
              {copied ? "COPIÉ" : "COPIER"}
            </button>
          </div>
          <p className="mt-2 text-[12px] opacity-70">Donne ce code à tes amis : ils le tapent dans « Rejoindre un groupe ».</p>

          {/* Les personnages du groupe : chaque nouveau entre par la porte. */}
          <div className="mt-6">
            <BackroomsLobbyStage
              members={members.map((m, i) => ({ id: m.id, name: m.id === selfId ? `${m.name} (toi)` : m.name, color: i }))}
              speaking={speaking}
            />
          </div>

          <p className="mt-6 text-[11px] tracking-[0.4em] opacity-60">
            SURVIVANTS {members.length}/{MAX_PARTY}
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {members.map((m, i) => (
              <li key={m.id} className="flex items-center gap-3 border border-white/10 bg-black/50 px-3 py-2.5">
                <span className="inline-block size-3" style={{ background: SURVIVOR_COLORS[i % SURVIVOR_COLORS.length].jacket }} />
                <span className="text-sm font-bold tracking-wider">{m.name}</span>
                {m.id === selfId && <span className="text-[10px] opacity-60">(toi)</span>}
                {m.host && <span className="border border-[#f3e3a0]/40 px-1.5 py-0.5 text-[9px] tracking-widest opacity-80">HÔTE</span>}
                <span className="ml-auto flex h-4 items-end gap-[3px]" aria-label={speaking[m.id] ? "parle" : "silencieux"}>
                  {[6, 12, 8].map((h, k) => (
                    <span key={k} className="w-[3px]" style={{ height: speaking[m.id] ? h : 3, background: speaking[m.id] ? "#6ee7a0" : "rgba(255,255,255,0.2)", transition: "height 0.1s" }} />
                  ))}
                </span>
              </li>
            ))}
            {members.length < 2 && (
              <li className="border border-dashed border-white/15 px-3 py-2.5 text-[12px] opacity-60">
                {isHost ? "En attente de tes amis…" : "Connexion au groupe… si personne n'apparaît, vérifie le code."}
              </li>
            )}
          </ul>

          <div className="mt-8 border border-white/10 bg-black/50 p-4">
            <p className="text-[11px] tracking-[0.4em] opacity-60">SALON VOCAL</p>
            <p className="mt-2 text-[12px] leading-relaxed opacity-80">
              Parlez-vous au salon et en jeu. En jeu, la voix de chacun sort de son personnage : plus il est loin,
              moins tu l&apos;entends, et un mur l&apos;étouffe.{" "}
              <span className="text-red-400">Si vous parlez trop fort, la créature vous entend.</span>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {micState !== "actif" ? (
                <button
                  type="button"
                  onClick={() => voice && void enableMic(voice)}
                  className="border border-[#f3e3a0] bg-[#f3e3a0] px-4 py-2 text-[12px] font-bold tracking-widest text-black transition hover:bg-transparent hover:text-[#f3e3a0]"
                >
                  🎙 ACTIVER MON MICRO
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const next = !muted;
                    voice?.setMuted(next);
                    setMuted(next);
                  }}
                  className={`border px-4 py-2 text-[12px] font-bold tracking-widest transition ${muted ? "border-red-400 text-red-400" : "border-[#f3e3a0]"}`}
                >
                  {muted ? "MICRO COUPÉ — RÉACTIVER" : "COUPER MON MICRO (M EN JEU)"}
                </button>
              )}
              <span className={`text-[11px] ${micState === "refuse" || micState === "indisponible" ? "text-red-400" : "opacity-70"}`}>
                {MIC_TEXT[micState]}
              </span>
            </div>
            <p className="mt-3 text-[10px] leading-relaxed opacity-55">
              Sans micro, tu entends quand même les autres. La voix passe directement d&apos;un navigateur à l&apos;autre et
              n&apos;est jamais enregistrée.
            </p>
          </div>

          {isHost ? (
            <div className="mt-8 pb-6">
              <p className="text-[11px] tracking-[0.4em] opacity-60">NIVEAU DE DÉPART</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {LEVELS.map((lvl, i) => {
                  const open = i <= unlocked;
                  return (
                    <button
                      key={lvl.id}
                      type="button"
                      disabled={!open}
                      onClick={() => setLobbyLevel(i)}
                      className={`border px-3 py-2 text-[12px] tracking-widest transition disabled:cursor-not-allowed disabled:opacity-30 ${
                        lobbyLevel === i ? "border-[#f3e3a0] bg-[#f3e3a0] text-black" : "border-white/20 hover:border-[#f3e3a0]/60"
                      }`}
                    >
                      {lvl.number} · {open ? lvl.name.toUpperCase() : "???"}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => hostStart(lobbyLevel, true)}
                className="mt-5 border border-[#f3e3a0] bg-[#f3e3a0] px-6 py-3 text-sm font-bold tracking-[0.25em] text-black transition hover:bg-transparent hover:text-[#f3e3a0]"
              >
                ▶ LANCER POUR TOUT LE GROUPE
              </button>
            </div>
          ) : (
            <p className="mt-8 pb-6 text-[12px] tracking-widest opacity-75" style={{ animation: "backrooms-rec 1.6s steps(1) infinite" }}>
              EN ATTENTE QUE L&apos;HÔTE LANCE LA PARTIE…
            </p>
          )}
        </div>
      </div>
    );
  }

  const next = LEVELS[Math.min(LEVELS.length - 1, levelIndex + 1)];

  if (phase === "transition") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-black px-6 text-center font-mono text-[#f3e3a0]">
        <p className="text-[12px] tracking-[0.5em] opacity-70" style={{ animation: "backrooms-rec 0.9s steps(1) infinite" }}>
          NO-CLIP
        </p>
        <p className="mt-4 max-w-md text-sm leading-relaxed opacity-85">
          Le sol cède sous tes pieds. Tu tombes à travers quelque chose qui n&apos;est ni du béton ni de l&apos;air.
        </p>
        <p className="mt-6 text-[11px] tracking-[0.4em] opacity-60">
          NIVEAU {next.number} · {next.name.toUpperCase()}
        </p>
        {party && !party.isHost && <p className="mt-3 text-[10px] tracking-[0.3em] opacity-50">LE GROUPE TOMBE AVEC TOI…</p>}
      </div>
    );
  }

  if (phase === "dead" && death) {
    const d = DEATH_TEXT[death.cause];
    const lvl = LEVELS[levelIndex];
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-black px-6 text-center font-mono text-[#e9dfc0]">
        <div className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "repeating-linear-gradient(0deg, #000 0 1px, transparent 1px 3px)" }} />
        <p className="text-[11px] tracking-[0.5em] text-red-500" style={{ animation: "backrooms-rec 1s steps(1) infinite" }}>
          ■ FIN DE L&apos;ENREGISTREMENT
        </p>
        <h1 className="mt-4 text-3xl font-black tracking-[0.15em] text-balance sm:text-5xl" style={{ textShadow: "3px 0 rgba(255,0,60,0.5), -3px 0 rgba(0,200,255,0.5)" }}>
          {d.title.toUpperCase()}
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed opacity-80">{d.text}</p>
        <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-1 text-left text-[12px] tracking-wider opacity-75">
          <dt>NIVEAU</dt>
          <dd className="text-right">
            {lvl.number} · {lvl.name}
          </dd>
          <dt>TENU</dt>
          <dd className="text-right tabular-nums">{formatTime(death.stats.seconds)}</dd>
          <dt>MORTS</dt>
          <dd className="text-right tabular-nums">{run.deaths}</dd>
        </dl>
        {party ? (
          <div className="mt-8 flex flex-col items-center gap-3">
            <p className="text-[12px] opacity-75">Tout le groupe a été pris.</p>
            {party.isHost ? (
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => hostStart(levelIndex, false)}
                  className="border border-[#f3e3a0] bg-[#f3e3a0] px-5 py-2.5 text-sm font-bold tracking-widest text-black transition hover:bg-transparent hover:text-[#f3e3a0]"
                >
                  RÉESSAYER ENSEMBLE
                </button>
                <button type="button" onClick={hostBackToLobby} className="border border-white/30 px-5 py-2.5 text-sm tracking-widest transition hover:border-white/70">
                  SALON DU GROUPE
                </button>
              </div>
            ) : (
              <p className="text-[12px] tracking-widest opacity-70" style={{ animation: "backrooms-rec 1.6s steps(1) infinite" }}>
                EN ATTENTE DE L&apos;HÔTE…
              </p>
            )}
            <button type="button" onClick={() => leaveParty()} className="text-[11px] tracking-widest opacity-60 hover:opacity-100">
              QUITTER LE GROUPE
            </button>
          </div>
        ) : (
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => start(levelIndex, false, devLaunch)}
              className="border border-[#f3e3a0] bg-[#f3e3a0] px-5 py-2.5 text-sm font-bold tracking-widest text-black transition hover:bg-transparent hover:text-[#f3e3a0]"
            >
              RÉESSAYER LE NIVEAU
            </button>
            <button
              type="button"
              onClick={() => setPhase("menu")}
              className="border border-white/30 px-5 py-2.5 text-sm tracking-widest transition hover:border-white/70"
            >
              MENU
            </button>
          </div>
        )}
      </div>
    );
  }

  if (phase === "ending") {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[#0b0a06] px-6 text-center font-mono text-[#f3e3a0]">
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <Corridor />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-black/70" />
        <div className="relative flex flex-col items-center">
          <p className="text-[11px] tracking-[0.5em] opacity-70">NIVEAU ? · SORTIE</p>
          <h1 className="mt-4 text-3xl font-black tracking-[0.12em] sm:text-5xl">TU ES SORTI.</h1>
          <p className="mt-5 max-w-lg text-sm leading-relaxed opacity-85">
            La porte donnait sur un parking, sous un vrai ciel. Tu as couru jusqu&apos;à la rue. Puis, en
            passant devant une vitrine, tu as entendu le bourdonnement d&apos;un néon. Juste un néon.
            Sûrement.
          </p>
          <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-1 text-left text-[12px] tracking-wider opacity-80">
            <dt>TEMPS TOTAL</dt>
            <dd className="text-right tabular-nums">{formatTime(run.seconds)}</dd>
            <dt>MORTS</dt>
            <dd className="text-right tabular-nums">{run.deaths}</dd>
            <dt>EAU D&apos;AMANDE BUE</dt>
            <dd className="text-right tabular-nums">{run.water}</dd>
          </dl>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {party ? (
              party.isHost ? (
                <button type="button" onClick={hostBackToLobby} className="border border-[#f3e3a0] bg-[#f3e3a0] px-5 py-2.5 text-sm font-bold tracking-widest text-black">
                  SALON DU GROUPE
                </button>
              ) : (
                <button type="button" onClick={() => leaveParty()} className="border border-white/30 px-5 py-2.5 text-sm tracking-widest">
                  QUITTER LE GROUPE
                </button>
              )
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => start(0, true)}
                  className="border border-[#f3e3a0] bg-[#f3e3a0] px-5 py-2.5 text-sm font-bold tracking-widest text-black transition hover:bg-transparent hover:text-[#f3e3a0]"
                >
                  RETOURNER DANS LE HALL
                </button>
                <button type="button" onClick={() => setPhase("menu")} className="border border-white/30 px-5 py-2.5 text-sm tracking-widest">
                  MENU
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- Menu ---
  return (
    <div className="relative flex h-full w-full overflow-hidden bg-[#0b0a06] font-mono text-[#f3e3a0]">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <Corridor />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/20" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "repeating-linear-gradient(0deg, #000 0 1px, transparent 1px 3px)" }} />
      <div
        className="pointer-events-none absolute inset-x-0 h-10 opacity-[0.08]"
        style={{ background: "linear-gradient(180deg, transparent, #fff, transparent)", animation: "backrooms-tracking 6s linear infinite" }}
      />

      <div className="relative flex h-full w-full flex-col overflow-y-auto px-5 py-5 sm:px-10 sm:py-8">
        <div className="flex items-center justify-between text-[12px] tracking-widest">
          <Link href="/mode-3d" className="opacity-70 transition hover:opacity-100">
            ← MODE 3D
          </Link>
          <span className="flex items-center gap-2 opacity-80">
            <span className="inline-block size-2 rounded-full bg-red-600" style={{ animation: "backrooms-rec 1.4s steps(1) infinite" }} />
            REC
          </span>
        </div>

        <div className="mt-8 max-w-xl sm:mt-14">
          <p className="text-[11px] tracking-[0.5em] opacity-60">{title.replace(/^\S+\s/, "").toUpperCase()} · PIXOLUD</p>
          <h1
            className="mt-2 text-5xl font-black leading-none tracking-[0.08em] sm:text-7xl"
            style={{ textShadow: "4px 0 rgba(255,0,60,0.45), -4px 0 rgba(0,200,255,0.45)" }}
          >
            BACKROOMS
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed opacity-85">
            Tu as traversé le sol par accident. Derrière : de la moquette humide, des néons qui bourdonnent, et des
            couloirs jaunes, parfois sur plusieurs étages, qui ne mènent nulle part. Dix niveaux, chacun avec sa sortie
            — quand il y a un étage, elle est souvent en haut des escaliers. Ne reste pas dans le noir.
          </p>

          <div className="mt-8 flex flex-col items-start gap-3">
            <button
              type="button"
              onClick={() => start(0, true)}
              className="border border-[#f3e3a0] bg-[#f3e3a0] px-6 py-3 text-sm font-bold tracking-[0.25em] text-black transition hover:bg-transparent hover:text-[#f3e3a0]"
            >
              ▶ NOUVELLE PARTIE
            </button>
            {unlocked > 0 && (
              <button
                type="button"
                onClick={() => start(unlocked, true)}
                className="border border-[#f3e3a0]/60 px-6 py-3 text-sm tracking-[0.2em] transition hover:border-[#f3e3a0] hover:bg-[#f3e3a0]/10"
              >
                CONTINUER · NIVEAU {LEVELS[unlocked].number}
              </button>
            )}
            <button
              type="button"
              onClick={() => void toggleTalkSolo()}
              aria-pressed={talkSolo}
              className={`flex items-center gap-3 border px-4 py-2.5 text-left text-[12px] tracking-widest transition ${
                talkSolo ? "border-red-400 bg-red-500/10 text-red-300" : "border-white/25 hover:border-[#f3e3a0]/60"
              }`}
            >
              <span className="text-base">🎙</span>
              <span>
                <span className="block font-bold">{talkSolo ? "PARLER EN JEU : ACTIVÉ" : "PARLER EN JEU"}</span>
                <span className="block text-[10px] normal-case tracking-normal opacity-75">
                  {talkSolo ? "Micro ouvert : parle bas, si tu parles trop fort elle t'entend." : "Active ton micro : si tu parles trop fort ou si tu cries, elle t'entend."}
                </span>
              </span>
            </button>
            {!talkSolo && (micState === "refuse" || micState === "indisponible") && (
              <p className="max-w-md text-[11px] text-red-400">{MIC_TEXT[micState]}</p>
            )}
          </div>
        </div>

        <div className="mt-10 max-w-3xl border border-white/10 bg-black/55 p-4">
          <p className="text-[11px] tracking-[0.4em] opacity-60">JOUER EN GROUPE · VOCAL</p>
          <p className="mt-2 max-w-xl text-[12px] leading-relaxed opacity-80">
            Jusqu&apos;à {MAX_PARTY} survivants avec un code. Vous vous parlez au micro, en jeu la voix vient du personnage — et la
            créature entend ceux qui parlent trop fort.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={createParty}
              className="border border-[#f3e3a0] bg-[#f3e3a0] px-5 py-2.5 text-[12px] font-bold tracking-[0.2em] text-black transition hover:bg-transparent hover:text-[#f3e3a0]"
            >
              CRÉER UN GROUPE
            </button>
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                joinParty();
              }}
            >
              <label htmlFor="br-code" className="sr-only">
                Code du groupe
              </label>
              <input
                id="br-code"
                value={joinInput}
                onChange={(e) => setJoinInput(normalizePartyCode(e.target.value))}
                placeholder="CODE"
                autoComplete="off"
                className="w-28 border border-white/25 bg-black/60 px-3 py-2.5 text-center text-[13px] font-bold tracking-[0.35em] text-[#f3e3a0] placeholder:text-white/30 focus:border-[#f3e3a0] focus:outline-none"
              />
              <button type="submit" className="border border-white/30 px-4 py-2.5 text-[12px] tracking-widest transition hover:border-[#f3e3a0]/70">
                REJOINDRE
              </button>
            </form>
          </div>
          {partyError && <p className="mt-3 text-[11px] text-red-400">{partyError}</p>}
        </div>

        {devAllowed && (
          <div className="mt-6 max-w-3xl border border-amber-500/40 bg-amber-500/[0.07] p-4 font-sans">
            <div className="flex items-center gap-2">
              <p className="text-sm font-black uppercase tracking-wide text-amber-200">🛠️ Mode développeur</p>
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">Admin</span>
            </div>
            <p className="mt-1 text-xs text-amber-100/70">
              Vol, invincibilité, traversée des murs, lucidité infinie, entité figée, carte en direct avec téléportation, et passage
              au niveau suivant. Tous les niveaux, sans rien débloquer. F2 ouvre le panneau en partie.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {LEVELS.map((lvl, i) => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => start(i, true, true)}
                  className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs font-bold text-amber-100 transition hover:bg-amber-500/20"
                >
                  {lvl.number} · {lvl.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 max-w-3xl">
          <p className="text-[11px] tracking-[0.4em] opacity-60">NIVEAUX</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {LEVELS.map((lvl, i) => {
              const open = i <= unlocked;
              return (
                <li key={lvl.id}>
                  <button
                    type="button"
                    disabled={!open}
                    onClick={() => start(i, true)}
                    className="flex w-full items-start gap-4 border border-white/10 bg-black/50 p-3 text-left transition enabled:hover:border-[#f3e3a0]/60 enabled:hover:bg-black/70 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {/* « Fun =) » ne tient pas dans la colonne des chiffres : plus petit, sur sa propre largeur. */}
                    <span
                      className={`shrink-0 font-black leading-none ${lvl.number.length > 2 ? "w-14 whitespace-nowrap pt-1.5 text-base" : "w-8 text-3xl"}`}
                    >
                      {lvl.number}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold tracking-widest">{open ? lvl.name.toUpperCase() : "???"}</span>
                      <span className="mt-1 block text-[11px] leading-snug opacity-70">
                        {open ? lvl.tagline : "Atteins le niveau précédent pour le débloquer."}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-10 grid max-w-3xl gap-6 pb-6 text-[12px] leading-relaxed sm:grid-cols-2">
          <div>
            <p className="text-[11px] tracking-[0.4em] opacity-60">COMMANDES</p>
            <ul className="mt-2 space-y-1 opacity-85">
              <li>ZQSD · se déplacer (QWERTY dans les réglages)</li>
              <li>Souris · regarder (clique dans l&apos;image)</li>
              <li>Maj · courir — C · s&apos;accroupir</li>
              <li>F · lampe — E · ramasser, ouvrir (maintenir pour une vanne ou un disjoncteur)</li>
              <li>R · boire de l&apos;eau d&apos;amande — M · couper le micro</li>
            </ul>
          </div>
          <div>
            <p className="text-[11px] tracking-[0.4em] opacity-60">SURVIVRE</p>
            <ul className="mt-2 space-y-1 opacity-85">
              <li>Ta lucidité baisse, surtout dans le noir. L&apos;eau d&apos;amande la remonte.</li>
              <li>Les entités entendent tes pas. Accroupi, tu es presque silencieux.</li>
              <li>Chaque créature a sa règle : le conseil qui s&apos;affiche au début du niveau te la donne.</li>
              <li>Le signal en bas à gauche grimpe près de ton objectif.</li>
              <li>Casque recommandé : les sons viennent d&apos;une direction.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
