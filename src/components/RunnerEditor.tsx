"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { isRunnerPlayable, RUNNER_LENGTH_MAX, RUNNER_LENGTHS, type RunnerData } from "@/lib/runner";
import CoverPicker from "./CoverPicker";
import MultiplayerToggle from "./MultiplayerToggle";
import { tierAtLeast, type Tier } from "@/lib/tiers";
import { publishGame, saveGame } from "@/app/editeur/actions";

export default function RunnerEditor({
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
  initialData: RunnerData;
  initialGradient: string;
  initialEmoji: string;
  initialCoverUrl: string | null;
  initialMultiplayerMode: boolean;
  tier: Tier;
  error?: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [runner, setRunner] = useState<RunnerData>(initialData);
  const [gradient, setGradient] = useState(initialGradient);
  const [emoji, setEmoji] = useState(initialEmoji);
  const [coverUrl, setCoverUrl] = useState(initialCoverUrl);
  const [multiplayerMode, setMultiplayerMode] = useState(initialMultiplayerMode);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  const obstacleSet = new Set(runner.obstacles);

  const scheduleSave = useCallback(
    (next: {
      title: string;
      description: string;
      data: RunnerData;
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
    scheduleSave({ title, description, data: runner, gradient, emoji, coverUrl, multiplayerMode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, runner, gradient, emoji, coverUrl, multiplayerMode]);

  function setLength(length: number) {
    setRunner((prev) => ({
      length,
      obstacles: prev.obstacles.filter((o) => o > 0 && o < length - 1),
    }));
  }

  function toggleObstacle(pos: number) {
    if (pos <= 0 || pos >= runner.length - 1) return;
    setRunner((prev) => ({
      ...prev,
      obstacles: obstacleSet.has(pos)
        ? prev.obstacles.filter((o) => o !== pos)
        : [...prev.obstacles, pos],
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
        placeholder="Titre du parcours"
        className="mt-6 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-lg font-bold text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Décris ton parcours..."
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
          Longueur du parcours
        </p>
        <div className="flex gap-2">
          {RUNNER_LENGTHS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => setLength(l.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                runner.length === l.value
                  ? "bg-violet-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300"
              }`}
            >
              {l.label}
            </button>
          ))}
          {tierAtLeast(tier, "max") ? (
            <button
              type="button"
              onClick={() => setLength(RUNNER_LENGTH_MAX.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                runner.length === RUNNER_LENGTH_MAX.value
                  ? "bg-violet-600 text-white"
                  : "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300"
              }`}
            >
              {RUNNER_LENGTH_MAX.label}
            </button>
          ) : (
            <Link
              href="/premium"
              title="Longueur exclusive Max"
              className="rounded-full bg-zinc-100 px-4 py-1.5 text-sm font-medium text-zinc-400 dark:bg-zinc-900 dark:text-zinc-600"
            >
              🔒 {RUNNER_LENGTH_MAX.label}
            </Link>
          )}
        </div>

        <p className="mt-4 mb-2 text-xs text-zinc-400">
          Clique sur les cases pour poser des obstacles 🪨 (défilement
          automatique, le joueur saute par-dessus avec ESPACE / ↑).
        </p>
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-zinc-100 p-2 shadow-inner dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex w-fit gap-1">
            {Array.from({ length: runner.length }).map((_, pos) => {
              const isObstacle = obstacleSet.has(pos);
              const isEdge = pos === 0 || pos === runner.length - 1;
              return (
                <button
                  key={pos}
                  type="button"
                  onClick={() => toggleObstacle(pos)}
                  disabled={isEdge}
                  className={`flex size-9 shrink-0 items-center justify-center rounded-md text-sm ${
                    pos === 0
                      ? "bg-emerald-100 dark:bg-emerald-900/50"
                      : pos === runner.length - 1
                        ? "bg-rose-100 dark:bg-rose-900/50"
                        : isObstacle
                          ? "bg-zinc-700 dark:bg-zinc-600"
                          : "bg-white hover:bg-violet-50 dark:bg-zinc-950 dark:hover:bg-zinc-800"
                  }`}
                >
                  {pos === 0 ? "🚩" : pos === runner.length - 1 ? "🏁" : isObstacle ? "🪨" : ""}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form action={publishGame}>
          <input type="hidden" name="gameId" value={gameId} />
          <button
            type="submit"
            disabled={!isRunnerPlayable(runner)}
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
        {!isRunnerPlayable(runner) && (
          <span className="text-xs text-zinc-400">
            Laisse au moins une case libre entre deux obstacles 🪨 pour qu&apos;ils soient tous franchissables.
          </span>
        )}
      </div>
    </div>
  );
}
