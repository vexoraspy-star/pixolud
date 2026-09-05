"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { isQuizPlayable, newQuestion, type QuizData } from "@/lib/quiz";
import CoverPicker from "./CoverPicker";
import MultiplayerToggle from "./MultiplayerToggle";
import type { Tier } from "@/lib/tiers";
import { publishGame, saveGame } from "@/app/editeur/actions";

export default function QuizEditor({
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
  initialData: QuizData;
  initialGradient: string;
  initialEmoji: string;
  initialCoverUrl: string | null;
  initialMultiplayerMode: boolean;
  tier: Tier;
  error?: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [quiz, setQuiz] = useState<QuizData>(initialData);
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
      data: QuizData;
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
    scheduleSave({ title, description, data: quiz, gradient, emoji, coverUrl, multiplayerMode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, quiz, gradient, emoji, coverUrl, multiplayerMode]);

  function addQuestion() {
    setQuiz((prev) => ({ questions: [...prev.questions, newQuestion()] }));
  }

  function removeQuestion(id: string) {
    setQuiz((prev) => ({ questions: prev.questions.filter((q) => q.id !== id) }));
  }

  function updateQuestion(id: string, text: string) {
    setQuiz((prev) => ({
      questions: prev.questions.map((q) => (q.id === id ? { ...q, question: text } : q)),
    }));
  }

  function updateOption(id: string, index: number, text: string) {
    setQuiz((prev) => ({
      questions: prev.questions.map((q) =>
        q.id === id
          ? { ...q, options: q.options.map((o, i) => (i === index ? text : o)) }
          : q,
      ),
    }));
  }

  function setCorrect(id: string, index: number) {
    setQuiz((prev) => ({
      questions: prev.questions.map((q) =>
        q.id === id ? { ...q, correctIndex: index } : q,
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
        placeholder="Titre du quiz"
        className="mt-6 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-lg font-bold text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Décris ton quiz..."
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
        {quiz.questions.map((q, qi) => (
          <div
            key={q.id}
            className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-400">
                Question {qi + 1}
              </span>
              <button
                type="button"
                onClick={() => removeQuestion(q.id)}
                className="text-xs font-medium text-red-500 hover:underline"
              >
                Supprimer
              </button>
            </div>
            <input
              value={q.question}
              onChange={(e) => updateQuestion(q.id, e.target.value)}
              placeholder="Intitulé de la question"
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            />
            <div className="mt-3 flex flex-col gap-2">
              {q.options.map((opt, oi) => (
                <label key={oi} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${q.id}`}
                    checked={q.correctIndex === oi}
                    onChange={() => setCorrect(q.id, oi)}
                    className="size-4 text-violet-600"
                  />
                  <input
                    value={opt}
                    onChange={(e) => updateOption(q.id, oi, e.target.value)}
                    placeholder={`Réponse ${oi + 1}`}
                    className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  />
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-400">
              Coche la bonne réponse à gauche.
            </p>
          </div>
        ))}

        <button
          type="button"
          onClick={addQuestion}
          className="rounded-xl border border-dashed border-zinc-300 py-4 text-sm font-medium text-zinc-500 hover:border-violet-400 hover:text-violet-600 dark:border-zinc-700 dark:text-zinc-400"
        >
          + Ajouter une question
        </button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form action={publishGame}>
          <input type="hidden" name="gameId" value={gameId} />
          <button
            type="submit"
            disabled={!isQuizPlayable(quiz)}
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
        {!isQuizPlayable(quiz) && (
          <span className="text-xs text-zinc-400">
            Ajoute au moins une question complète pour pouvoir publier.
          </span>
        )}
      </div>
    </div>
  );
}
