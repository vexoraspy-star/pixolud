"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { generateDuelCode, type DuelSide } from "@/lib/duel";
import { DUEL_MODES, DUEL_MODE_ORDER, type DuelModeId } from "@/lib/duelModes";
import { WEAPONS, GUN_GAME_ORDER } from "@/lib/duelWeapons";
import DuelScene, { type DuelLink } from "./DuelScene";

type Phase = "menu" | "waiting" | "playing" | "ended";

/** Accent de couleur par mode : le menu doit se lire d'un coup d'oeil. */
const MODE_STYLE: Record<DuelModeId, { ring: string; text: string; bg: string }> = {
  duel: { ring: "ring-cyan-600", text: "text-cyan-300", bg: "from-cyan-800 to-cyan-700" },
  deathmatch: { ring: "ring-orange-600", text: "text-orange-300", bg: "from-orange-800 to-orange-700" },
  armement: { ring: "ring-violet-600", text: "text-violet-300", bg: "from-violet-800 to-violet-700" },
  zone: { ring: "ring-emerald-600", text: "text-emerald-300", bg: "from-emerald-800 to-emerald-700" },
};

export default function DuelGame({ title }: { title: string }) {
  const [phase, setPhase] = useState<Phase>("menu");
  const [modeId, setModeId] = useState<DuelModeId>("duel");
  const [joinInput, setJoinInput] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [side, setSide] = useState<DuelSide>("a");
  const [bot, setBot] = useState(false);
  const [opponentName, setOpponentName] = useState("Adversaire");
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<{
    win: boolean;
    mine: number;
    theirs: number;
    rank?: number;
  } | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [matchKey, setMatchKey] = useState(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null);
  // Boite aux lettres mutable : la scene 3D la lit a chaque image, sans
  // jamais declencher de rendu React sur un paquet reseau. On passe la REF
  // elle-meme a la scene (et non son contenu) : lire `.current` pendant le
  // rendu est interdit, mais le faire dans un effet ne l'est pas.
  const link = useRef<DuelLink>({
    remote: null,
    inbox: [],
    send: () => {},
  });

  useEffect(() => {
    link.current.send = (event, payload) => {
      channelRef.current?.send({ type: "broadcast", event, payload });
    };
  }, []);

  const cleanupChannel = useCallback(() => {
    if (channelRef.current) {
      const supabase = createClient();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    link.current.remote = null;
    link.current.inbox.length = 0;
  }, []);

  useEffect(() => cleanupChannel, [cleanupChannel]);

  const connect = useCallback(
    (code: string, mySide: DuelSide) => {
      cleanupChannel();
      const supabase = createClient();
      const channel = supabase.channel(`duel-${code}`, {
        config: { broadcast: { self: false }, presence: { key: mySide } },
      });
      channelRef.current = channel;

      channel
        .on(
          "broadcast",
          { event: "state" },
          ({ payload }: { payload: NonNullable<DuelLink["remote"]> }) => {
            link.current.remote = payload;
          },
        )
        .on("broadcast", { event: "hit" }, ({ payload }: { payload: Record<string, unknown> }) => {
          link.current.inbox.push({ event: "hit", payload });
        })
        .on("broadcast", { event: "died" }, () => {
          link.current.inbox.push({ event: "died", payload: {} });
        })
        .on("broadcast", { event: "shot" }, ({ payload }: { payload: Record<string, unknown> }) => {
          link.current.inbox.push({ event: "shot", payload });
        })
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState<{ side: DuelSide }>();
          const others = Object.values(state)
            .flatMap((e) => e)
            .filter((e) => e.side !== mySide);
          if (others.length > 0) {
            setOpponentName(mySide === "a" ? "Joueur B" : "Joueur A");
            setPhase((p) => (p === "waiting" ? "playing" : p));
          }
        })
        .subscribe((status: string) => {
          if (status === "SUBSCRIBED") channel.track({ side: mySide });
        });
    },
    [cleanupChannel],
  );

  function createRoom() {
    const code = generateDuelCode();
    setRoomCode(code);
    setSide("a");
    setBot(false);
    setModeId("duel");
    setResult(null);
    setMatchKey((k) => k + 1);
    setPhase("waiting");
    connect(code, "a");
  }

  function joinRoom() {
    const code = joinInput.trim().toUpperCase();
    if (code.length < 4) {
      setJoinError("Entre le code à 5 lettres reçu de ton adversaire.");
      return;
    }
    setJoinError(null);
    setRoomCode(code);
    setSide("b");
    setBot(false);
    setModeId("duel");
    setResult(null);
    setMatchKey((k) => k + 1);
    setPhase("waiting");
    connect(code, "b");
  }

  function startSolo(id: DuelModeId) {
    cleanupChannel();
    setRoomCode("");
    setSide("a");
    setBot(true);
    setModeId(id);
    setOpponentName("Sentinelle");
    setResult(null);
    setMatchKey((k) => k + 1);
    setPhase("playing");
  }

  function backToMenu() {
    cleanupChannel();
    setPhase("menu");
    setResult(null);
  }

  if (phase === "playing") {
    return (
      <DuelScene
        key={matchKey}
        side={side}
        bot={bot}
        mode={modeId}
        opponentName={opponentName}
        link={link}
        onMatchEnd={(win, mine, theirs, rank) => {
          setResult({ win, mine, theirs, rank });
          setPhase("ended");
        }}
      />
    );
  }

  if (phase === "ended" && result) {
    const mode = DUEL_MODES[modeId];
    return (
      <div
        className={`flex h-full w-full flex-col items-center justify-center gap-4 px-4 ${
          result.win
            ? "bg-gradient-to-b from-cyan-950 to-black"
            : "bg-gradient-to-b from-red-950 to-black"
        }`}
      >
        <span className="text-5xl">{result.win ? "🏆" : "💀"}</span>
        <p className={`text-2xl font-black ${result.win ? "text-cyan-300" : "text-red-400"}`}>
          {mode.shrinkingZone
            ? result.win
              ? "Dernier debout !"
              : `${result.rank ?? "?"}ᵉ sur ${mode.bots + 1}`
            : result.win
              ? "Victoire !"
              : "Défaite"}
        </p>
        <p className="font-mono text-lg text-zinc-300">
          {mode.shrinkingZone
            ? `${result.mine} élimination${result.mine > 1 ? "s" : ""}`
            : `${result.mine} — ${result.theirs}`}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={bot ? () => startSolo(modeId) : backToMenu}
            className="rounded-full bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500"
          >
            {bot ? "Rejouer" : "Nouvelle partie"}
          </button>
          <button
            type="button"
            onClick={backToMenu}
            className="rounded-full border border-zinc-600 px-5 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-zinc-800"
          >
            Menu
          </button>
          <Link
            href="/mode-3d"
            className="rounded-full border border-zinc-700 px-5 py-2.5 text-sm font-semibold text-zinc-400 hover:bg-zinc-800"
          >
            Mode 3D
          </Link>
        </div>
      </div>
    );
  }

  if (phase === "waiting") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-5 bg-gradient-to-b from-zinc-950 to-black px-4">
        <span className="animate-pulse text-4xl">📡</span>
        <p className="text-lg font-bold text-white">En attente de ton adversaire...</p>
        <p className="max-w-sm text-center text-sm text-zinc-400">
          Envoie-lui ce code. Il doit ouvrir le même jeu et choisir « Rejoindre ».
        </p>
        <div className="flex items-center gap-2">
          {roomCode.split("").map((c, i) => (
            <span
              key={i}
              className="flex size-12 items-center justify-center rounded-xl bg-cyan-950 font-mono text-2xl font-black text-cyan-300 ring-1 ring-cyan-700"
            >
              {c}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(roomCode).then(
              () => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
              },
              () => {},
            );
          }}
          className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-zinc-200 ring-1 ring-white/20 hover:bg-white/20"
        >
          {copied ? "Code copié ✓" : "Copier le code"}
        </button>
        <button
          type="button"
          onClick={backToMenu}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Annuler
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-gradient-to-br from-[#06121a] via-[#0a0f16] to-black text-white">
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
        <Link href="/mode-3d" className="text-sm text-zinc-400 transition hover:text-cyan-300">
          ← Mode 3D
        </Link>
        <span className="text-xs uppercase tracking-[0.2em] text-zinc-600">Pixolud</span>
      </header>

      <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto p-4">
        <div className="w-full max-w-3xl pb-8">
          <div className="mb-5 text-center">
            <span className="rounded-full bg-cyan-900/60 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-cyan-200">
              Tir à la première personne
            </span>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
            <p className="mx-auto mt-2 max-w-lg text-sm text-zinc-400">
              Quatre modes, cinq armes. Choisis ton terrain.
            </p>
          </div>

          {/* --- Les modes solo --- */}
          <div className="grid gap-3 sm:grid-cols-2">
            {DUEL_MODE_ORDER.map((id) => {
              const m = DUEL_MODES[id];
              const style = MODE_STYLE[id];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => startSolo(id)}
                  className={`rounded-xl border border-white/10 bg-white/[0.04] p-4 text-left ring-1 ring-inset transition hover:bg-white/[0.09] active:scale-[0.99] ${style.ring}`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-lg font-black uppercase tracking-wide">{m.name}</p>
                    <span className={`text-[11px] font-bold uppercase ${style.text}`}>
                      {m.tagline}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-snug text-zinc-400">{m.detail}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400">
                      {m.bots} adversaire{m.bots > 1 ? "s" : ""}
                    </span>
                    <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400">
                      {m.arena === "zone" ? "Grand terrain" : "Arène"}
                    </span>
                    {!m.respawn && (
                      <span className="rounded bg-red-950/60 px-1.5 py-0.5 text-[10px] font-semibold text-red-300">
                        Une seule vie
                      </span>
                    )}
                    {m.loot && (
                      <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400">
                        Armes au sol
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* --- En ligne --- */}
          <div className="mt-4 rounded-xl border border-cyan-900/50 bg-cyan-950/20 p-4">
            <p className="text-lg font-black uppercase tracking-wide">En ligne · 1 contre 1</p>
            <p className="mt-1 text-xs text-zinc-400">
              Le mode Duel contre une vraie personne, avec un code de salon.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={createRoom}
                className="rounded-lg bg-cyan-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-cyan-600"
              >
                Créer un duel
              </button>
              <span className="text-xs text-zinc-600">ou</span>
              <input
                value={joinInput}
                onChange={(e) => {
                  setJoinInput(e.target.value.toUpperCase().slice(0, 5));
                  setJoinError(null);
                }}
                placeholder="CODE"
                className="w-32 rounded-lg bg-black/50 px-3 py-2.5 text-center font-mono text-lg font-bold uppercase tracking-widest text-cyan-300 outline-none ring-1 ring-white/15 focus:ring-cyan-500"
              />
              <button
                type="button"
                onClick={joinRoom}
                className="rounded-lg border border-white/20 px-4 py-2.5 text-sm font-bold text-zinc-200 transition hover:bg-white/10"
              >
                Rejoindre
              </button>
            </div>
            {joinError && <p className="mt-2 text-xs font-semibold text-red-400">{joinError}</p>}
          </div>

          {/* --- L'arsenal --- */}
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
              L&apos;arsenal
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {GUN_GAME_ORDER.map((id) => {
                const w = WEAPONS[id];
                return (
                  <div key={id} className="rounded-lg bg-black/40 px-3 py-2">
                    <p className="text-sm font-bold text-zinc-200">{w.name}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
                      {w.pellets > 1 ? `${w.pellets} × ${w.damage}` : w.damage} dmg ·{" "}
                      {Math.round(60 / w.fireInterval)} c/min · {w.magSize} balles
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 grid gap-2 text-xs text-zinc-500 sm:grid-cols-2">
            <p>
              <span className="font-semibold text-zinc-300">Déplacement</span> — ZQSD ou WASD, Maj
              pour sprinter
            </p>
            <p>
              <span className="font-semibold text-zinc-300">Tirer</span> — clic gauche (maintenu si
              l&apos;arme est automatique)
            </p>
            <p>
              <span className="font-semibold text-zinc-300">Viser</span> — clic droit (lunette sur le
              sniper)
            </p>
            <p>
              <span className="font-semibold text-zinc-300">Recharger</span> — touche R
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
