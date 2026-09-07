"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { isPythonPlayable, newPythonExercise, type PythonData } from "@/lib/python";
import CoverPicker from "./CoverPicker";
import MultiplayerToggle from "./MultiplayerToggle";
import type { Tier } from "@/lib/tiers";
import { publishGame, saveGame } from "@/app/editeur/actions";

export default function PythonEditor({
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
  initialData: PythonData;
  initialGradient: string;
  initialEmoji: string;
  initialCoverUrl: string | null;
  initialMultiplayerMode: boolean;
  tier: Tier;
  error?: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [data, setData] = useState<PythonData>(initialData);
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
      data: PythonData;
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

  function addExercise() {
    setData((prev) => ({ ...prev, exercises: [...prev.exercises, newPythonExercise()] }));
  }

  function removeExercise(id: string) {
    setData((prev) => ({ ...prev, exercises: prev.exercises.filter((e) => e.id !== id) }));
  }

  function updateExercise(id: string, patch: Partial<PythonData["exercises"][number]>) {
    setData((prev) => ({
      ...prev,
      exercises: prev.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)),
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
        placeholder="Titre du tutoriel"
        className="mt-6 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-lg font-bold text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Décris ton tutoriel..."
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

      <div className="mt-6">
        <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Introduction (optionnel) — affichée avant le premier exercice
        </p>
        <textarea
          value={data.intro}
          onChange={(e) => setData((prev) => ({ ...prev, intro: e.target.value }))}
          placeholder="Explique ici ce qu'on va apprendre (ex : le print() sert à afficher du texte)..."
          rows={4}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
        />
      </div>

      <div className="mt-8 flex flex-col gap-6">
        {data.exercises.map((ex, i) => (
          <div key={ex.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-400">Exercice {i + 1}</span>
              <button
                type="button"
                onClick={() => removeExercise(ex.id)}
                className="text-xs font-medium text-red-500 hover:underline"
              >
                Supprimer
              </button>
            </div>
            <textarea
              value={ex.instructions}
              onChange={(e) => updateExercise(ex.id, { instructions: e.target.value })}
              placeholder="Consigne (ex : Affiche « Bonjour » avec print)"
              rows={2}
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            />
            <p className="mt-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Code de départ (optionnel)
            </p>
            <p className="mb-1 text-xs text-amber-600 dark:text-amber-500">
              ⚠️ Laisse vide, ou mets un code incomplet à corriger. Si tu écris ici la
              réponse complète, l&apos;exercice sera déjà résolu et le joueur n&apos;aura
              rien à faire !
            </p>
            <textarea
              value={ex.starterCode}
              onChange={(e) => updateExercise(ex.id, { starterCode: e.target.value })}
              placeholder="(laisse vide pour que le joueur parte d'une page blanche)"
              rows={3}
              spellCheck={false}
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-zinc-950 px-3 py-2 font-mono text-sm text-emerald-300 outline-none focus:border-violet-500 dark:border-zinc-700"
            />
            <p className="mt-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Sortie attendue (ce que le code doit afficher exactement)
            </p>
            <textarea
              value={ex.expectedOutput}
              onChange={(e) => updateExercise(ex.id, { expectedOutput: e.target.value })}
              placeholder="Bonjour"
              rows={2}
              spellCheck={false}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            />
          </div>
        ))}

        <button
          type="button"
          onClick={addExercise}
          className="rounded-xl border border-dashed border-zinc-300 py-4 text-sm font-medium text-zinc-500 hover:border-violet-400 hover:text-violet-600 dark:border-zinc-700 dark:text-zinc-400"
        >
          + Ajouter un exercice
        </button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form action={publishGame}>
          <input type="hidden" name="gameId" value={gameId} />
          <button
            type="submit"
            disabled={!isPythonPlayable(data)}
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
        {!isPythonPlayable(data) && (
          <span className="text-xs text-zinc-400">
            Ajoute au moins un exercice complet (consigne + sortie attendue) pour pouvoir publier.
          </span>
        )}
      </div>
    </div>
  );
}
