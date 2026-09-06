"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { isDevinettesPlayable, newRound, type DevinettesData } from "@/lib/devinettes";
import CoverPicker from "./CoverPicker";
import MultiplayerToggle from "./MultiplayerToggle";
import type { Tier } from "@/lib/tiers";
import { publishGame, saveGame } from "@/app/editeur/actions";

export default function DevinettesEditor({
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
  initialData: DevinettesData;
  initialGradient: string;
  initialEmoji: string;
  initialCoverUrl: string | null;
  initialMultiplayerMode: boolean;
  tier: Tier;
  error?: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [data, setData] = useState<DevinettesData>(initialData);
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
      data: DevinettesData;
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

  function addRound() {
    setData((prev) => ({ rounds: [...prev.rounds, newRound()] }));
  }

  function removeRound(id: string) {
    setData((prev) => ({ rounds: prev.rounds.filter((r) => r.id !== id) }));
  }

  function updateAnswer(id: string, answer: string) {
    setData((prev) => ({
      rounds: prev.rounds.map((r) => (r.id === id ? { ...r, answer } : r)),
    }));
  }

  function updateClue(id: string, index: number, value: string) {
    setData((prev) => ({
      rounds: prev.rounds.map((r) =>
        r.id === id ? { ...r, clues: r.clues.map((c, i) => (i === index ? value : c)) } : r,
      ),
    }));
  }

  function addClue(id: string) {
    setData((prev) => ({
      rounds: prev.rounds.map((r) => (r.id === id && r.clues.length < 5 ? { ...r, clues: [...r.clues, ""] } : r)),
    }));
  }

  function removeClue(id: string, index: number) {
    setData((prev) => ({
      rounds: prev.rounds.map((r) =>
        r.id === id && r.clues.length > 1 ? { ...r, clues: r.clues.filter((_, i) => i !== index) } : r,
      ),
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
        placeholder="Titre des devinettes"
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

      <div className="mt-8 flex flex-col gap-6">
        {data.rounds.map((r, ri) => (
          <div key={r.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-400">Devinette {ri + 1}</span>
              <button
                type="button"
                onClick={() => removeRound(r.id)}
                className="text-xs font-medium text-red-500 hover:underline"
              >
                Supprimer
              </button>
            </div>
            <input
              value={r.answer}
              onChange={(e) => updateAnswer(r.id, e.target.value)}
              placeholder="Réponse à deviner (ex: Tour Eiffel)"
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            />

            <p className="mt-3 mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Indices (du plus vague au plus précis)
            </p>
            <div className="flex flex-col gap-2">
              {r.clues.map((clue, ci) => (
                <div key={ci} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-xs text-zinc-400">{ci + 1}.</span>
                  <input
                    value={clue}
                    onChange={(e) => updateClue(r.id, ci, e.target.value)}
                    placeholder={`Indice ${ci + 1}`}
                    className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => removeClue(r.id, ci)}
                    disabled={r.clues.length <= 1}
                    className="shrink-0 text-xs font-medium text-red-500 hover:underline disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => addClue(r.id)}
              disabled={r.clues.length >= 5}
              className="mt-2 text-xs font-medium text-violet-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
            >
              + Ajouter un indice
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addRound}
          className="rounded-xl border border-dashed border-zinc-300 py-4 text-sm font-medium text-zinc-500 hover:border-violet-400 hover:text-violet-600 dark:border-zinc-700 dark:text-zinc-400"
        >
          + Ajouter une devinette
        </button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form action={publishGame}>
          <input type="hidden" name="gameId" value={gameId} />
          <button
            type="submit"
            disabled={!isDevinettesPlayable(data)}
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
        {!isDevinettesPlayable(data) && (
          <span className="text-xs text-zinc-400">
            Ajoute au moins une devinette complète (réponse + indices) pour pouvoir publier.
          </span>
        )}
      </div>
    </div>
  );
}
