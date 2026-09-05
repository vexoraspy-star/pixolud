"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  isMusiquePlayable,
  MUSIQUE_LANE_KEYS,
  MUSIQUE_LANES,
  MUSIQUE_LENGTHS,
  MUSIQUE_PRESETS,
  type MusiqueData,
} from "@/lib/musique";
import CoverPicker from "./CoverPicker";
import MultiplayerToggle from "./MultiplayerToggle";
import type { Tier } from "@/lib/tiers";
import { publishGame, saveGame } from "@/app/editeur/actions";

export default function MusiqueEditor({
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
  initialData: MusiqueData;
  initialGradient: string;
  initialEmoji: string;
  initialCoverUrl: string | null;
  initialMultiplayerMode: boolean;
  tier: Tier;
  error?: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [track, setTrack] = useState<MusiqueData>(initialData);
  const [gradient, setGradient] = useState(initialGradient);
  const [emoji, setEmoji] = useState(initialEmoji);
  const [coverUrl, setCoverUrl] = useState(initialCoverUrl);
  const [multiplayerMode, setMultiplayerMode] = useState(initialMultiplayerMode);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  const noteSet = new Set(track.notes.map(([s, l]) => `${s}-${l}`));

  const scheduleSave = useCallback(
    (next: {
      title: string;
      description: string;
      data: MusiqueData;
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
    scheduleSave({ title, description, data: track, gradient, emoji, coverUrl, multiplayerMode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, track, gradient, emoji, coverUrl, multiplayerMode]);

  function setLength(length: number) {
    setTrack((prev) => ({
      length,
      notes: prev.notes.filter(([s]) => s < length),
    }));
  }

  function loadPreset(preset: (typeof MUSIQUE_PRESETS)[number]) {
    setTrack({ length: preset.length, notes: preset.notes.map(([s, l]) => [s, l]) });
  }

  function toggleNote(step: number, lane: number) {
    const key = `${step}-${lane}`;
    setTrack((prev) => ({
      ...prev,
      notes: noteSet.has(key)
        ? prev.notes.filter(([s, l]) => !(s === step && l === lane))
        : [...prev.notes, [step, lane]],
    }));
  }

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
        placeholder="Titre du morceau"
        className="mt-6 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-lg font-bold text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Décris ton morceau..."
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
        <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Modèles de chansons (libres de droit, générées par synthèse audio)
        </p>
        <div className="flex flex-wrap gap-2">
          {MUSIQUE_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => loadPreset(p)}
              className="rounded-full bg-pink-100 px-4 py-1.5 text-sm font-medium text-pink-700 hover:bg-pink-200 dark:bg-pink-900/40 dark:text-pink-300"
            >
              🎼 {p.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-zinc-400">
          Charge un modèle pour démarrer, puis modifie-le comme tu veux.
        </p>
      </div>

      <div className="mt-8">
        <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Longueur du morceau
        </p>
        <div className="flex gap-2">
          {MUSIQUE_LENGTHS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => setLength(l.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                track.length === l.value
                  ? "bg-violet-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        <p className="mt-4 mb-2 text-xs text-zinc-400">
          Clique sur les cases pour placer des notes 🎵 sur chaque piste. Le
          joueur devra appuyer sur la bonne touche ({MUSIQUE_LANE_KEYS.join(", ")}) au
          bon moment.
        </p>
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-zinc-100 p-2 shadow-inner dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex w-fit flex-col gap-1">
            {Array.from({ length: MUSIQUE_LANES }).map((_, lane) => (
              <div key={lane} className="flex items-center gap-1">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-zinc-200 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {MUSIQUE_LANE_KEYS[lane]}
                </span>
                {Array.from({ length: track.length }).map((_, step) => {
                  const active = noteSet.has(`${step}-${lane}`);
                  return (
                    <button
                      key={step}
                      type="button"
                      onClick={() => toggleNote(step, lane)}
                      className={`flex size-9 shrink-0 items-center justify-center rounded-md text-sm ${
                        active
                          ? "bg-violet-600"
                          : "bg-white hover:bg-violet-50 dark:bg-zinc-950 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {active ? "🎵" : ""}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form action={publishGame}>
          <input type="hidden" name="gameId" value={gameId} />
          <button
            type="submit"
            disabled={!isMusiquePlayable(track)}
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
