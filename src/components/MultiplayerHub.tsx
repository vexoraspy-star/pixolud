"use client";

import GameArtwork from "./GameArtwork";
import PortalHeading from "./PortalHeading";
import { useState } from "react";
import { ARENA_CHARACTERS, ARENA_MODES, hasGoldenName, type ArenaMode } from "@/lib/arena";
import { useSecretUnlocked, SECRET_CHARACTER } from "@/lib/fun";
import type { Tier } from "@/lib/tiers";
import TerritoryGame from "./TerritoryGame";
import TreasureHuntGame from "./TreasureHuntGame";
import BubbleGame from "./BubbleGame";
import ChessGame from "./ChessGame";
import PythonChatGame from "./PythonChatGame";

type Phase = "identity" | "hub" | "playing";

export default function MultiplayerHub({
  initialPseudo,
  tier,
}: {
  initialPseudo: string;
  tier: Tier;
}) {
  const [phase, setPhase] = useState<Phase>("identity");
  const [pseudo, setPseudo] = useState(initialPseudo);
  const [emoji, setEmoji] = useState(ARENA_CHARACTERS[0]);
  const [mode, setMode] = useState<ArenaMode | null>(null);
  const secretUnlocked = useSecretUnlocked();
  const golden = hasGoldenName(tier);

  const characters = secretUnlocked ? [...ARENA_CHARACTERS, SECRET_CHARACTER] : ARENA_CHARACTERS;

  if (phase === "identity") {
    return (
      <div className="multiplayer-welcome">
        <div><PortalHeading eyebrow="À PLUSIEURS, C’EST ENCORE MIEUX" title="La prochaine partie se joue ensemble." description="Un nom, un personnage, et te voilà prêt à rejoindre l’arène. Fais équipe ou défie les autres joueurs." /><div className="multiplayer-art"><GameArtwork kind="arcade" /></div></div>
        <div className="identity-panel flex flex-col items-center gap-4 text-center">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Prépare ton entrée
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Choisis ton nom et ton personnage, ils te suivront dans tous les
          jeux partagés.
        </p>

        <input
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value.slice(0, 20))}
          placeholder="Ton nom"
          aria-label="Ton nom"
          className={`w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-950 ${
            golden
              ? "font-semibold text-amber-500"
              : "text-zinc-900 dark:text-white"
          }`}
        />
        {golden && (
          <p className="-mt-2 text-xs text-amber-500">
            ✨ Ton nom brille en doré grâce à ton abonnement.
          </p>
        )}

        <div className="flex flex-wrap justify-center gap-2">
          {characters.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setEmoji(c)}
              aria-label={"Personnage " + c}
              aria-pressed={emoji === c}
              className={`flex size-11 items-center justify-center rounded-full text-xl ${
                emoji === c
                  ? "bg-violet-100 ring-2 ring-violet-600 dark:bg-violet-900/50"
                  : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={!pseudo.trim()}
          onClick={() => setPhase("hub")}
          className="mt-2 w-full rounded-full bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Choisir un jeu →
        </button>
        </div>
      </div>
    );
  }

  if (phase === "hub") {
    return (
      <div className="arena-selection flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Choisis ton jeu multijoueur
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Des cartes partagées en temps réel avec les autres joueurs connectés.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {ARENA_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setMode(m.id);
                setPhase("playing");
              }}
              className="arena-card"
            >
              <GameArtwork kind={m.id} />
              <span className="arena-card-copy"><strong>{m.emoji} {m.label}</strong><span>{m.description}</span><span className="arena-card-cta">Entrer dans l’arène ↗</span></span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setPhase("identity")}
          className="self-center text-sm font-medium text-zinc-400 hover:text-violet-600"
        >
          ← Changer de nom / personnage
        </button>
      </div>
    );
  }

  const identity = { pseudo, emoji, tier };
  const back = () => setPhase("hub");

  return (
    <div className="flex flex-col gap-4">
      {mode === "territoire" && <TerritoryGame identity={identity} onQuit={back} />}
      {mode === "chasse" && <TreasureHuntGame identity={identity} onQuit={back} />}
      {mode === "bulles" && <BubbleGame identity={identity} onQuit={back} />}
      {mode === "echecs" && <ChessGame identity={identity} onQuit={back} />}
      {mode === "python-chat" && <PythonChatGame identity={identity} onQuit={back} />}
    </div>
  );
}
