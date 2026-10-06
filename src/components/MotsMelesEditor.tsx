"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  MOTS_MAX,
  MOTS_MIN,
  NIVEAUX,
  TAILLE_MAX,
  TAILLE_MIN,
  analyserMots,
  genererGrille,
  nouvelleGraine,
  type MotsMelesData,
  type NiveauMotsMeles,
} from "@/lib/motsMeles";
import CoverPicker from "./CoverPicker";
import MultiplayerToggle from "./MultiplayerToggle";
import type { Tier } from "@/lib/tiers";
import { publishGame, saveGame } from "@/app/editeur/actions";

const PROBLEMES = { court: "trop court", long: "trop long pour la grille", doublon: "en double" } as const;

export default function MotsMelesEditor({
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
  initialData: MotsMelesData;
  initialGradient: string;
  initialEmoji: string;
  initialCoverUrl: string | null;
  initialMultiplayerMode: boolean;
  tier: Tier;
  error?: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [theme, setTheme] = useState(initialData.theme ?? "");
  // Le texte brut de la zone de saisie : on garde les lignes vides en cours de
  // frappe, sinon on ne pourrait pas passer a la ligne suivante.
  const [texteMots, setTexteMots] = useState((initialData.mots ?? []).join("\n"));
  const [taille, setTaille] = useState(initialData.taille || 10);
  const [niveau, setNiveau] = useState<NiveauMotsMeles>(initialData.niveau ?? "facile");
  const [graine, setGraine] = useState(initialData.graine || 1);
  const [gradient, setGradient] = useState(initialGradient);
  const [emoji, setEmoji] = useState(initialEmoji);
  const [coverUrl, setCoverUrl] = useState(initialCoverUrl);
  const [multiplayerMode, setMultiplayerMode] = useState(initialMultiplayerMode);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  const data: MotsMelesData = useMemo(
    () => ({
      theme: theme.slice(0, 60),
      mots: texteMots
        .split("\n")
        .map((m) => m.trim())
        .filter(Boolean)
        .slice(0, MOTS_MAX + 5),
      taille,
      niveau,
      graine,
    }),
    [theme, texteMots, taille, niveau, graine],
  );
  const analyses = useMemo(() => analyserMots(data), [data]);
  const grille = useMemo(() => genererGrille(data), [data]);

  const scheduleSave = useCallback(
    (next: {
      title: string;
      description: string;
      data: MotsMelesData;
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

  const valides = analyses.filter((m) => !m.probleme).length;
  const enTrop = analyses.length > MOTS_MAX;
  const raison = enTrop
    ? `Maximum ${MOTS_MAX} mots.`
    : analyses.length < MOTS_MIN
      ? `Écris au moins ${MOTS_MIN} mots (un par ligne).`
      : analyses.some((m) => m.probleme)
        ? "Corrige les mots signalés en rouge."
        : !grille
          ? "Les mots ne tiennent pas tous : agrandis la grille, change de niveau ou retire un mot."
          : null;

  // Les cases de chaque mot, pour les montrer au createur dans l'apercu.
  const casesMots = new Map<number, number>();
  grille?.placements.forEach((p, i) => p.cases.forEach(([r, c]) => casesMots.set(r * grille.taille + c, i)));
  const TEINTES = ["#fde68a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#ddd6fe", "#fed7aa", "#a5f3fc", "#fecaca", "#d9f99d", "#e9d5ff"];

  const champ =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white";

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
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">{error}</p>
      )}

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titre de ta grille"
        className={`${champ} mt-6 text-lg font-bold`}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Décris ton jeu..."
        rows={2}
        className={`${champ} mt-2`}
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

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            Thème (affiché au joueur)
            <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="Ex : Les animaux de la ferme" className={champ} />
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            Mots à cacher — un par ligne ({analyses.length} / {MOTS_MAX})
            <textarea
              value={texteMots}
              onChange={(e) => setTexteMots(e.target.value)}
              placeholder={"chat\nchien\nlapin\ncheval"}
              rows={9}
              className={`${champ} font-mono`}
            />
          </label>
          {analyses.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Contrôle des mots">
              {analyses.map((m, i) => (
                <li
                  key={`${m.norm}-${i}`}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    m.probleme || i >= MOTS_MAX
                      ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  }`}
                  title={m.norm}
                >
                  {m.probleme ? `✗ ${m.brut} : ${PROBLEMES[m.probleme]}` : i >= MOTS_MAX ? `✗ ${m.brut} : en trop` : `✓ ${m.brut}`}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-zinc-400">
            Les accents, espaces et tirets disparaissent dans la grille (« pomme de terre » devient POMMEDETERRE). {valides} mot
            {valides > 1 ? "s" : ""} prêt{valides > 1 ? "s" : ""}.
          </p>

          <label className="flex flex-col gap-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            Taille de la grille : {taille} × {taille}
            <input
              type="range"
              min={TAILLE_MIN}
              max={TAILLE_MAX}
              value={taille}
              onChange={(e) => setTaille(Number(e.target.value))}
              className="accent-violet-600"
            />
          </label>

          <div className="flex flex-col gap-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            Niveau
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(NIVEAUX) as NiveauMotsMeles[]).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNiveau(n)}
                  aria-pressed={niveau === n}
                  className={`rounded-lg border px-2 py-2 text-xs font-semibold ${
                    niveau === n
                      ? "border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                      : "border-zinc-300 text-zinc-600 hover:border-violet-400 dark:border-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {NIVEAUX[n].label}
                </button>
              ))}
            </div>
            <span className="font-normal text-zinc-400">{NIVEAUX[niveau].texte}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Aperçu (les mots sont colorés pour toi)</span>
            <button
              type="button"
              onClick={() => setGraine(nouvelleGraine())}
              className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-semibold text-zinc-600 hover:border-violet-400 hover:text-violet-600 dark:border-zinc-700 dark:text-zinc-300"
            >
              🔀 Nouvelle grille
            </button>
          </div>
          {grille ? (
            <div
              className="grid gap-px rounded-xl border border-zinc-200 bg-white p-1.5 dark:border-zinc-800 dark:bg-zinc-900"
              style={{ gridTemplateColumns: `repeat(${grille.taille}, minmax(0, 1fr))` }}
              aria-hidden="true"
            >
              {grille.lettres.flatMap((ligne, r) =>
                ligne.map((lettre, c) => {
                  const i = casesMots.get(r * grille.taille + c);
                  return (
                    <span
                      key={`${r}-${c}`}
                      className="flex aspect-square items-center justify-center rounded text-[10px] font-bold text-zinc-700 dark:text-zinc-200"
                      style={i !== undefined ? { background: TEINTES[i % TEINTES.length], color: "#18181b" } : undefined}
                    >
                      {lettre}
                    </span>
                  );
                }),
              )}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-400 dark:border-zinc-700">
              {raison ?? "La grille apparaîtra ici."}
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <form action={publishGame}>
          <input type="hidden" name="gameId" value={gameId} />
          <button
            type="submit"
            disabled={!!raison}
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
        {raison && <span className="text-xs text-zinc-400">{raison}</span>}
      </div>
    </div>
  );
}
