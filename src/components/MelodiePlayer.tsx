"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  instrumentName,
  MELODIE_SCALES,
  scoreAttempt,
  type MelodieData,
  type MelodieStroke,
} from "@/lib/melodie";
import { ensureMelodieContext, startMelodiePlayback } from "@/lib/melodieAudio";
import MelodieCanvas from "./MelodieCanvas";
import { createClient } from "@/lib/supabase/client";

/** Ce que le joueur est en train de faire. */
type Phase =
  | "menu"
  | "libre"
  /** La melodie joue, le dessin est cache : il faut la retenir a l'oreille. */
  | "ecoute"
  | "dessin"
  | "resultat";

export default function MelodiePlayer({
  data,
  gameId,
  countsAsPlay = false,
}: {
  data: MelodieData;
  gameId?: string;
  countsAsPlay?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("menu");
  const [attempt, setAttempt] = useState<MelodieStroke[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [playhead, setPlayhead] = useState<number | null>(null);
  const [listens, setListens] = useState(0);

  const audioRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const hasCountedPlay = useRef(false);

  useEffect(() => {
    if (!countsAsPlay || !gameId || hasCountedPlay.current) return;
    hasCountedPlay.current = true;
    const supabase = createClient();
    supabase.rpc("increment_plays", { game_id: gameId });
  }, [countsAsPlay, gameId]);

  useEffect(() => {
    return () => {
      stopRef.current?.();
      // Le contexte audio nait au premier clic, donc bien apres le montage :
      // on veut la valeur au demontage, pas une copie capturee a vide.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      audioRef.current?.close().catch(() => {});
    };
  }, []);

  const play = useCallback(
    (onEnd?: () => void) => {
      stopRef.current?.();
      const ctx = ensureMelodieContext(audioRef);
      stopRef.current = startMelodiePlayback(ctx, data, {
        onProgress: setPlayhead,
        onEnd: () => {
          stopRef.current = null;
          setPlayhead(null);
          onEnd?.();
        },
      });
    },
    [data],
  );

  function stopAll() {
    stopRef.current?.();
    stopRef.current = null;
    setPlayhead(null);
  }

  function startListening() {
    setListens((n) => n + 1);
    setPhase("ecoute");
    play(() => setPhase("dessin"));
  }

  function validate() {
    stopAll();
    setScore(scoreAttempt(data, attempt));
    setPhase("resultat");
  }

  function retry() {
    stopAll();
    setAttempt([]);
    setScore(null);
    setListens(0);
    setPhase("menu");
  }

  const addStroke = useCallback((stroke: MelodieStroke) => {
    setAttempt((prev) => [...prev, stroke]);
  }, []);

  const scaleName =
    MELODIE_SCALES.find((s) => s.id === data.scale)?.name ?? "Pentatonique";
  const instruments = Array.from(new Set(data.strokes.map((s) => s.instrument)));

  // Ce que le canvas montre depend de la phase : pendant l'ecoute et le
  // dessin, la reference est cachee — c'est tout le jeu.
  const showReference = phase === "menu" || phase === "libre" || phase === "resultat";
  const drawable = phase === "dessin";

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2 text-xs text-zinc-500">
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800">
          {data.bpm} BPM
        </span>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800">
          Gamme {scaleName}
        </span>
        {instruments.map((i) => (
          <span key={i} className="rounded-full bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800">
            {instrumentName(i)}
          </span>
        ))}
      </div>

      <MelodieCanvas
        strokes={drawable || phase === "resultat" ? attempt : showReference ? data.strokes : []}
        ghost={phase === "resultat" ? data.strokes : []}
        scale={data.scale}
        beats={data.beats}
        drawable={drawable}
        playhead={playhead}
        onStroke={addStroke}
      />

      {phase === "menu" && (
        <div className="mt-4 flex flex-col items-center gap-3">
          <p className="text-sm text-zinc-500">
            Écoute la mélodie, puis redessine-la de mémoire pour être noté.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={startListening}
              className="rounded-full bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
            >
              🎧 Rejouer à l&apos;oreille
            </button>
            <button
              type="button"
              onClick={() => {
                setPhase("libre");
                play(() => setPhase("libre"));
              }}
              className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              ▶ Juste écouter
            </button>
          </div>
        </div>
      )}

      {phase === "libre" && (
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => play()}
            className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
          >
            ▶ Réécouter
          </button>
          <button
            type="button"
            onClick={() => {
              stopAll();
              setPhase("menu");
            }}
            className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Retour
          </button>
        </div>
      )}

      {phase === "ecoute" && (
        <p className="mt-4 text-center text-sm font-semibold text-violet-600 dark:text-violet-400">
          🎧 Écoute bien... retiens la forme de la mélodie.
        </p>
      )}

      {phase === "dessin" && (
        <div className="mt-4 flex flex-col items-center gap-3">
          <p className="text-sm text-zinc-500">
            À toi : redessine la mélodie de gauche à droite.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={validate}
              disabled={attempt.length === 0}
              className="rounded-full bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ✓ Valider
            </button>
            <button
              type="button"
              onClick={() => setAttempt([])}
              disabled={attempt.length === 0}
              className="rounded-full border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              🗑 Effacer
            </button>
            <button
              type="button"
              onClick={startListening}
              className="rounded-full border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              🎧 Réécouter ({listens})
            </button>
          </div>
        </div>
      )}

      {phase === "resultat" && score !== null && (
        <div className="mt-4 flex flex-col items-center gap-3">
          <p className="text-4xl font-black text-violet-600 dark:text-violet-400">{score}/100</p>
          <p className="text-sm text-zinc-500">
            {score >= 90
              ? "Oreille absolue. La courbe est presque superposée."
              : score >= 70
                ? "Très proche — la forme y est."
                : score >= 45
                  ? "Le début tient, la suite dérive."
                  : "Réécoute : c'est surtout la hauteur qui change."}
          </p>
          <p className="text-xs text-zinc-400">
            En pointillé, la mélodie d&apos;origine. Écoutée {listens} fois.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => play()}
              className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
            >
              ▶ Écouter l&apos;originale
            </button>
            <button
              type="button"
              onClick={retry}
              className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Rejouer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
