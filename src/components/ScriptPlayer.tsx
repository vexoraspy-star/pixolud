"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ScriptStage from "./ScriptStage";
import type { ScriptData } from "@/lib/script";

/**
 * Jouer a un jeu Game Script.
 *
 * Le jeu est le programme de quelqu'un d'autre : il tourne dans le meme bac a
 * sable que dans l'editeur (origine opaque, reseau coupe). On ajoute juste de
 * quoi le relancer, et un mot pour dire d'ou vient ce qui s'affiche.
 */
export default function ScriptPlayer({
  data,
  gameId,
  countsAsPlay = false,
}: {
  data: ScriptData;
  gameId?: string;
  countsAsPlay?: boolean;
}) {
  const [cle, setCle] = useState(1);
  const compte = useRef(false);

  useEffect(() => {
    if (!countsAsPlay || !gameId || compte.current) return;
    compte.current = true;
    const supabase = createClient();
    supabase.rpc("increment_plays", { game_id: gameId });
  }, [countsAsPlay, gameId]);

  return (
    <div className="w-full">
      <ScriptStage data={data} cle={cle} />

      {data.aide && <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">{data.aide}</p>}

      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={() => setCle((k) => k + 1)} className="portal-button small">
          ↻ Recommencer
        </button>
        <span className="text-xs text-zinc-400">
          Jeu programmé par un joueur, exécuté dans un cadre isolé : il n&apos;a accès ni à ton compte ni à Internet.
        </span>
      </div>
    </div>
  );
}
