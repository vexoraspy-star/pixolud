"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  isMelodiePlayable,
  MELODIE_BEATS,
  MELODIE_BPM_MAX,
  MELODIE_BPM_MIN,
  MELODIE_INSTRUMENTS,
  MELODIE_SCALES,
  melodieToNotes,
  type InstrumentId,
  type MelodieData,
  type MelodieStroke,
  type ScaleId,
} from "@/lib/melodie";
import { ensureMelodieContext, startMelodiePlayback } from "@/lib/melodieAudio";
import MelodieCanvas from "./MelodieCanvas";
import CoverPicker from "./CoverPicker";
import MultiplayerToggle from "./MultiplayerToggle";
import type { Tier } from "@/lib/tiers";
import { publishGame, saveGame } from "@/app/editeur/actions";

export default function MelodieEditor({
  gameId,
  initialTitle,
  initialDescription,
  initialData,
  initialGradient,
  initialEmoji,
  initialCoverUrl,
  initialMultiplayerMode,
  tier,
  error,
}: {
  gameId: string;
  initialTitle: string;
  initialDescription: string;
  initialData: MelodieData;
  initialGradient: string;
  initialEmoji: string;
  initialCoverUrl: string | null;
  initialMultiplayerMode: boolean;
  tier: Tier;
  error?: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [data, setData] = useState<MelodieData>(initialData);
  const [gradient, setGradient] = useState(initialGradient);
  const [emoji, setEmoji] = useState(initialEmoji);
  const [coverUrl, setCoverUrl] = useState(initialCoverUrl);
  const [multiplayerMode, setMultiplayerMode] = useState(initialMultiplayerMode);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [instrument, setInstrument] = useState<InstrumentId>("piano");
  const [playhead, setPlayhead] = useState<number | null>(null);
  // Un ref lu pendant le rendu declenche react-hooks/refs : l etat de lecture
  // doit donc vivre dans un state, pas seulement dans stopRef.
  const [playing, setPlaying] = useState(false);

  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  const audioRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  const scheduleSave = useCallback(
    (next: {
      title: string;
      description: string;
      data: MelodieData;
      gradient: string;
      emoji: string;
      coverUrl: string | null;
      multiplayerMode: boolean;
    }) => {
      setStatus("saving");
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(async () => {
        await saveGame(gameId, next);
        setStatus("saved");
      }, 1200);
    },
    [gameId],
  );

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    scheduleSave({ title, description, data, gradient, emoji, coverUrl, multiplayerMode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, data, gradient, emoji, coverUrl, multiplayerMode]);

  // Une lecture en cours ne doit pas survivre a la fermeture de l'editeur.
  useEffect(() => {
    return () => {
      stopRef.current?.();
      // Le contexte audio nait au premier clic, donc bien apres le montage :
      // on veut la valeur au demontage, pas une copie capturee a vide.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      audioRef.current?.close().catch(() => {});
    };
  }, []);

  const addStroke = useCallback((stroke: MelodieStroke) => {
    setData((prev) => ({ ...prev, strokes: [...prev.strokes, stroke] }));
  }, []);

  function stopPlayback() {
    stopRef.current?.();
    stopRef.current = null;
    setPlaying(false);
    setPlayhead(null);
  }

  function togglePlay() {
    if (playing) {
      stopPlayback();
      return;
    }
    if (data.strokes.length === 0) return;
    const ctx = ensureMelodieContext(audioRef);
    setPlaying(true);
    stopRef.current = startMelodiePlayback(ctx, data, {
      onProgress: setPlayhead,
      onEnd: () => {
        stopRef.current = null;
        setPlaying(false);
        setPlayhead(null);
      },
    });
  }

  const noteCount = melodieToNotes(data).length;
  const playable = isMelodiePlayable(data);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/editeur" className="text-sm text-zinc-400 hover:text-violet-600">
          ← Mes jeux
        </Link>
        <span className="text-xs text-zinc-400">
          {status === "saving" && "Sauvegarde..."}
          {status === "saved" && "✓ Sauvegardé"}
        </span>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titre de ta mélodie"
        className="mt-6 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-lg font-bold text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Décris ta mélodie..."
        rows={2}
        className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
      />

      <div className="mt-6">
        <CoverPicker
          gameId={gameId}
          gradient={gradient}
          emoji={emoji}
          coverUrl={coverUrl}
          tier={tier}
          onGradientChange={setGradient}
          onEmojiChange={setEmoji}
          onCoverUrlChange={setCoverUrl}
        />
      </div>

      <MultiplayerToggle checked={multiplayerMode} onChange={setMultiplayerMode} />

      <div className="mt-8">
        <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">Instrument</p>
        <div className="flex flex-wrap gap-2">
          {MELODIE_INSTRUMENTS.map((ins) => (
            <button
              key={ins.id}
              type="button"
              onClick={() => setInstrument(ins.id)}
              className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                instrument === ins.id
                  ? "text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
              style={instrument === ins.id ? { backgroundColor: ins.color } : undefined}
            >
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: instrument === ins.id ? "#fff" : ins.color }}
              />
              {ins.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <MelodieCanvas
          strokes={data.strokes}
          scale={data.scale}
          beats={data.beats}
          instrument={instrument}
          drawable
          playhead={playhead}
          onStroke={addStroke}
        />
        <p className="mt-2 text-xs text-zinc-400">
          Dessine de gauche à droite : la hauteur du trait donne la note, l&apos;horizontale
          donne le temps. Les notes sont calées sur la gamme, ça sonne juste quoi que tu
          dessines.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          disabled={data.strokes.length === 0}
          className="rounded-full bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {playing ? "⏹ Arrêter" : "▶ Écouter"}
        </button>
        <button
          type="button"
          onClick={() => {
            stopPlayback();
            setData((prev) => ({ ...prev, strokes: prev.strokes.slice(0, -1) }));
          }}
          disabled={data.strokes.length === 0}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          ↩ Annuler le trait
        </button>
        <button
          type="button"
          onClick={() => {
            stopPlayback();
            setData((prev) => ({ ...prev, strokes: [] }));
          }}
          disabled={data.strokes.length === 0}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          🗑 Tout effacer
        </button>
        <span className="text-xs text-zinc-400">
          {data.strokes.length} trait{data.strokes.length > 1 ? "s" : ""} · {noteCount} note
          {noteCount > 1 ? "s" : ""}
        </span>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Tempo</p>
            <span className="font-mono text-xs text-zinc-400">{data.bpm} BPM</span>
          </div>
          <input
            type="range"
            min={MELODIE_BPM_MIN}
            max={MELODIE_BPM_MAX}
            step={1}
            value={data.bpm}
            onChange={(e) => setData((prev) => ({ ...prev, bpm: Number(e.target.value) }))}
            className="w-full accent-violet-500"
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">Durée</p>
          <div className="flex gap-2">
            {MELODIE_BEATS.map((b) => (
              <button
                key={b.value}
                type="button"
                onClick={() => setData((prev) => ({ ...prev, beats: b.value }))}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  data.beats === b.value
                    ? "bg-violet-600 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">Gamme</p>
        <div className="flex flex-wrap gap-2">
          {MELODIE_SCALES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setData((prev) => ({ ...prev, scale: s.id as ScaleId }))}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                data.scale === s.id
                  ? "bg-violet-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-zinc-400">
          La pentatonique ne fait jamais de fausse note. La mineure sonne plus triste.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <form action={publishGame}>
          <input type="hidden" name="gameId" value={gameId} />
          <button
            type="submit"
            disabled={!playable}
            className="rounded-full bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Publier
          </button>
        </form>
        <Link
          href={`/editeur/${gameId}/apercu`}
          className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          Tester
        </Link>
      </div>
    </div>
  );
}
