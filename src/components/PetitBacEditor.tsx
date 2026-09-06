"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  isPetitBacPlayable,
  MAX_CATEGORIES,
  MIN_CATEGORIES,
  ROUND_SECONDS_OPTIONS,
  type PetitBacData,
} from "@/lib/petitBac";
import CoverPicker from "./CoverPicker";
import MultiplayerToggle from "./MultiplayerToggle";
import type { Tier } from "@/lib/tiers";
import { publishGame, saveGame } from "@/app/editeur/actions";

export default function PetitBacEditor({
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
  initialData: PetitBacData;
  initialGradient: string;
  initialEmoji: string;
  initialCoverUrl: string | null;
  initialMultiplayerMode: boolean;
  tier: Tier;
  error?: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [petitBac, setPetitBac] = useState<PetitBacData>(initialData);
  const [gradient, setGradient] = useState(initialGradient);
  const [emoji, setEmoji] = useState(initialEmoji);
  const [coverUrl, setCoverUrl] = useState(initialCoverUrl);
  const [multiplayerMode, setMultiplayerMode] = useState(initialMultiplayerMode);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  const scheduleSave = useCallback(
    (next: {
      title: string;
      description: string;
      data: PetitBacData;
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
    scheduleSave({ title, description, data: petitBac, gradient, emoji, coverUrl, multiplayerMode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, petitBac, gradient, emoji, coverUrl, multiplayerMode]);

  function updateCategory(index: number, value: string) {
    setPetitBac((prev) => ({
      ...prev,
      categories: prev.categories.map((c, i) => (i === index ? value : c)),
    }));
  }

  function addCategory() {
    setPetitBac((prev) =>
      prev.categories.length >= MAX_CATEGORIES ? prev : { ...prev, categories: [...prev.categories, ""] },
    );
  }

  function removeCategory(index: number) {
    setPetitBac((prev) => ({
      ...prev,
      categories: prev.categories.filter((_, i) => i !== index),
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
        placeholder="Titre du petit bac"
        className="mt-6 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-lg font-bold text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Décris ton jeu..."
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
          Durée d&apos;une partie
        </p>
        <div className="flex gap-2">
          {ROUND_SECONDS_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setPetitBac((prev) => ({ ...prev, roundSeconds: s }))}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                petitBac.roundSeconds === s
                  ? "bg-violet-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300"
              }`}
            >
              {s}s
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Catégories ({petitBac.categories.length}/{MAX_CATEGORIES})
        </p>
        <div className="flex flex-col gap-2">
          {petitBac.categories.map((cat, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={cat}
                onChange={(e) => updateCategory(i, e.target.value)}
                placeholder={`Catégorie ${i + 1}`}
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => removeCategory(i)}
                disabled={petitBac.categories.length <= MIN_CATEGORIES}
                className="shrink-0 text-xs font-medium text-red-500 hover:underline disabled:cursor-not-allowed disabled:opacity-30"
              >
                Supprimer
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addCategory}
          disabled={petitBac.categories.length >= MAX_CATEGORIES}
          className="mt-3 w-full rounded-xl border border-dashed border-zinc-300 py-2.5 text-sm font-medium text-zinc-500 hover:border-violet-400 hover:text-violet-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-400"
        >
          + Ajouter une catégorie
        </button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form action={publishGame}>
          <input type="hidden" name="gameId" value={gameId} />
          <button
            type="submit"
            disabled={!isPetitBacPlayable(petitBac)}
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
        {!isPetitBacPlayable(petitBac) && (
          <span className="text-xs text-zinc-400">
            Ajoute au moins {MIN_CATEGORIES} catégories non vides avant de publier.
          </span>
        )}
      </div>
    </div>
  );
}
