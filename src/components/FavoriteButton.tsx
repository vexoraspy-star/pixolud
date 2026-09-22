"use client";

import { useState, useTransition } from "react";
import { basculerFavori } from "@/app/favoris/actions";

/**
 * L'etoile « favori ».
 *
 * L'etat change tout de suite a l'ecran, puis le serveur confirme : cliquer
 * une etoile doit repondre instantanement, meme sur une connexion lente. Si
 * le serveur refuse, on remet l'etoile comme avant et on dit pourquoi.
 */
export default function FavoriteButton({
  gameId,
  initial,
  connecte,
  compteur,
}: {
  gameId: string;
  initial: boolean;
  connecte: boolean;
  /** Nombre de personnes qui ont ce jeu en favori (facultatif). */
  compteur?: number;
}) {
  const [favori, setFavori] = useState(initial);
  const [total, setTotal] = useState(compteur ?? 0);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function cliquer() {
    if (!connecte) {
      setNote("Connecte-toi pour garder tes jeux préférés.");
      return;
    }
    const avant = favori;
    setFavori(!avant);
    setTotal((t) => Math.max(0, t + (avant ? -1 : 1)));
    start(async () => {
      const r = await basculerFavori(gameId, avant);
      setFavori(r.favori);
      if (!r.ok) {
        setTotal((t) => Math.max(0, t + (avant ? 1 : -1)));
        setNote(r.message);
      } else {
        setNote(null);
      }
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={cliquer}
        disabled={pending}
        aria-pressed={favori}
        title={favori ? "Retirer de mes favoris" : "Ajouter à mes favoris"}
        className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${
          favori
            ? "border-amber-400 bg-amber-400/15 text-amber-600 dark:text-amber-300"
            : "border-zinc-300 text-zinc-700 hover:border-amber-400 dark:border-zinc-700 dark:text-zinc-200"
        }`}
      >
        <span aria-hidden="true">{favori ? "★" : "☆"}</span>
        {favori ? "Dans mes favoris" : "Mettre en favori"}
        {compteur !== undefined && total > 0 && <span className="text-xs font-normal opacity-70">({total})</span>}
      </button>
      {note && <span className="text-xs text-zinc-500 dark:text-zinc-400">{note}</span>}
    </span>
  );
}
