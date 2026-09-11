"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { generateDuelCode, DUEL_SCORE_TO_WIN, type DuelSide, type DuelNetState } from "@/lib/duel";
import DuelScene, { type DuelLink } from "./DuelScene";

type Phase = "menu" | "waiting" | "playing" | "ended";

export default function DuelGame({ title }: { title: string }) {
  const [phase, setPhase] = useState<Phase>("menu");
  const [joinInput, setJoinInput] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [side, setSide] = useState<DuelSide>("a");
  const [bot, setBot] = useState(false);
  const [opponentName, setOpponentName] = useState("Adversaire");
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<{ win: boolean; mine: number; theirs: number } | null>(null);
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
        .on("broadcast", { event: "state" }, ({ payload }: { payload: DuelNetState }) => {
          link.current.remote = payload;
        })
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
    setResult(null);
    setMatchKey((k) => k + 1);
    setPhase("waiting");
    connect(code, "b");
  }

  function startBot() {
    cleanupChannel();
    setRoomCode("");
    setSide("a");
    setBot(true);
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
        opponentName={opponentName}
        link={link}
        onMatchEnd={(win, mine, theirs) => {
          setResult({ win, mine, theirs });
          setPhase("ended");
        }}
      />
    );
  }

  if (phase === "ended" && result) {
    return (
      <div
        className={`flex h-full w-full flex-col items-center justify-center gap-4 px-4 ${
          result.win ? "bg-gradient-to-b from-cyan-950 to-black" : "bg-gradient-to-b from-red-950 to-black"
        }`}
      >
        <span className="text-5xl">{result.win ? "🏆" : "💀"}</span>
        <p className={`text-2xl font-black ${result.win ? "text-cyan-300" : "text-red-400"}`}>
          {result.win ? "Victoire !" : "Défaite"}
        </p>
        <p className="font-mono text-lg text-zinc-300">
          {result.mine} — {result.theirs}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={bot ? startBot : backToMenu}
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

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-4">
        <div className="w-full max-w-2xl">
          <div className="mb-5 text-center">
            <span className="rounded-full bg-cyan-900/60 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-cyan-200">
              Tir · 1 contre 1
            </span>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
              Arène symétrique, {DUEL_SCORE_TO_WIN} éliminations pour gagner. Tirs à la tête
              doublement payants, chargeur de 12 balles.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={startBot}
              className="rounded-xl bg-gradient-to-r from-cyan-700 to-cyan-600 p-4 text-left transition hover:from-cyan-600 hover:to-cyan-500 active:scale-[0.99]"
            >
              <p className="text-lg font-black uppercase tracking-wide">Entraînement</p>
              <p className="mt-1 text-xs text-cyan-100/80">
                Seul contre la Sentinelle. Idéal pour apprendre la carte.
              </p>
            </button>

            <button
              type="button"
              onClick={createRoom}
              className="rounded-xl border border-white/15 bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.09] active:scale-[0.99]"
            >
              <p className="text-lg font-black uppercase tracking-wide">Créer un duel</p>
              <p className="mt-1 text-xs text-zinc-400">
                Tu reçois un code à envoyer à ton adversaire.
              </p>
            </button>
          </div>

          <div className="mt-3 rounded-xl border border-white/15 bg-white/[0.04] p-4">
            <p className="text-lg font-black uppercase tracking-wide">Rejoindre un duel</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={joinInput}
                onChange={(e) => {
                  setJoinInput(e.target.value.toUpperCase().slice(0, 5));
                  setJoinError(null);
                }}
                placeholder="CODE"
                className="w-36 rounded-lg bg-black/50 px-3 py-2.5 text-center font-mono text-xl font-bold uppercase tracking-widest text-cyan-300 outline-none ring-1 ring-white/15 focus:ring-cyan-500"
              />
              <button
                type="button"
                onClick={joinRoom}
                className="rounded-lg bg-cyan-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-cyan-600"
              >
                Rejoindre
              </button>
            </div>
            {joinError && <p className="mt-2 text-xs font-semibold text-red-400">{joinError}</p>}
          </div>

          <div className="mt-5 grid gap-2 text-xs text-zinc-500 sm:grid-cols-2">
            <p>
              <span className="font-semibold text-zinc-300">Déplacement</span> — ZQSD ou WASD, souris
              pour viser
            </p>
            <p>
              <span className="font-semibold text-zinc-300">Tirer</span> — clic gauche (maintenu pour
              l&apos;automatique)
            </p>
            <p>
              <span className="font-semibold text-zinc-300">Recharger</span> — touche R
            </p>
            <p>
              <span className="font-semibold text-zinc-300">Libérer la souris</span> — Échap
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
