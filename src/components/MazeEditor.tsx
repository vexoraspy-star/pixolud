"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cellKey, isMazePlayable, type MazeData } from "@/lib/maze";
import CoverPicker from "./CoverPicker";
import MultiplayerToggle from "./MultiplayerToggle";
import type { Tier } from "@/lib/tiers";
import { publishGame, saveGame } from "@/app/editeur/actions";

type Tool = "mur" | "depart" | "arrivee" | "effacer";

const TOOLS: { id: Tool; label: string; emoji: string }[] = [
  { id: "mur", label: "Mur", emoji: "🧱" },
  { id: "depart", label: "Départ", emoji: "🚩" },
  { id: "arrivee", label: "Arrivée", emoji: "🏁" },
  { id: "effacer", label: "Effacer", emoji: "🧹" },
];

export default function MazeEditor({
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
  initialData: MazeData;
  initialGradient: string;
  initialEmoji: string;
  initialCoverUrl: string | null;
  initialMultiplayerMode: boolean;
  tier: Tier;
  error?: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [maze, setMaze] = useState<MazeData>(initialData);
  const [gradient, setGradient] = useState(initialGradient);
  const [emoji, setEmoji] = useState(initialEmoji);
  const [coverUrl, setCoverUrl] = useState(initialCoverUrl);
  const [multiplayerMode, setMultiplayerMode] = useState(initialMultiplayerMode);
  const [tool, setTool] = useState<Tool>("mur");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  const wallSet = new Set(maze.walls.map(([x, y]) => cellKey(x, y)));

  const scheduleSave = useCallback(
    (next: {
      title: string;
      description: string;
      data: MazeData;
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
    scheduleSave({ title, description, data: maze, gradient, emoji, coverUrl, multiplayerMode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, maze, gradient, emoji, coverUrl, multiplayerMode]);

  function handleCellClick(x: number, y: number) {
    setMaze((prev) => {
      const key = cellKey(x, y);
      const walls = prev.walls.filter(([wx, wy]) => cellKey(wx, wy) !== key);
      let { start, end } = prev;

      if (tool === "mur") {
        walls.push([x, y]);
        if (start && cellKey(...start) === key) start = null;
        if (end && cellKey(...end) === key) end = null;
      } else if (tool === "depart") {
        start = [x, y];
        if (end && cellKey(...end) === key) end = null;
      } else if (tool === "arrivee") {
        end = [x, y];
        if (start && cellKey(...start) === key) start = null;
      } else if (tool === "effacer") {
        if (start && cellKey(...start) === key) start = null;
        if (end && cellKey(...end) === key) end = null;
      }

      return { ...prev, walls, start, end };
    });
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
        placeholder="Titre du jeu"
        className="mt-6 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-lg font-bold text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Décris ton labyrinthe..."
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

      <div className="mt-6 flex flex-wrap gap-2">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTool(t.id)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium ${
              tool === t.id
                ? "bg-violet-600 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            <span>{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div
        className="mt-4 grid w-fit gap-1 rounded-2xl border border-zinc-200 bg-zinc-100 p-2 shadow-inner dark:border-zinc-800 dark:bg-zinc-900"
        style={{ gridTemplateColumns: `repeat(${maze.width}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: maze.height }).map((_, y) =>
          Array.from({ length: maze.width }).map((_, x) => {
            const key = cellKey(x, y);
            const isWall = wallSet.has(key);
            const isStart = maze.start && cellKey(...maze.start) === key;
            const isEnd = maze.end && cellKey(...maze.end) === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleCellClick(x, y)}
                className={`flex size-8 items-center justify-center rounded-md text-sm transition-colors sm:size-10 sm:text-base ${
                  isWall
                    ? "bg-gradient-to-br from-zinc-600 to-zinc-800 shadow-sm dark:from-zinc-500 dark:to-zinc-700"
                    : isStart
                      ? "bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:hover:bg-emerald-900"
                      : isEnd
                        ? "bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/50 dark:hover:bg-rose-900"
                        : "bg-white hover:bg-violet-50 dark:bg-zinc-950 dark:hover:bg-zinc-800"
                }`}
              >
                {isStart ? "🚩" : isEnd ? "🏁" : ""}
              </button>
            );
          }),
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form action={publishGame}>
          <input type="hidden" name="gameId" value={gameId} />
          <button
            type="submit"
            disabled={!isMazePlayable(maze)}
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
        {!isMazePlayable(maze) && (
          <span className="text-xs text-zinc-400">
            Place un 🚩 départ et une 🏁 arrivée pour pouvoir publier.
          </span>
        )}
      </div>
    </div>
  );
}
