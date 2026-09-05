"use client";

import { useState, useTransition } from "react";
import { rateGame } from "@/app/jeu/[slug]/actions";

export default function RatingWidget({
  gameId,
  slug,
  initialRating,
}: {
  gameId: string;
  slug: string;
  initialRating: number;
}) {
  const [rating, setRating] = useState(initialRating);
  const [hover, setHover] = useState(0);
  const [pending, startTransition] = useTransition();

  function submit(stars: number) {
    setRating(stars);
    startTransition(() => {
      rateGame(gameId, slug, stars);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={pending}
            onMouseEnter={() => setHover(n)}
            onClick={() => submit(n)}
            aria-label={`Noter ${n} étoile${n > 1 ? "s" : ""}`}
            className="p-0.5 text-xl leading-none disabled:cursor-wait"
          >
            {(hover || rating) >= n ? "⭐" : "☆"}
          </button>
        ))}
      </div>
      {rating > 0 && (
        <span className="text-xs text-zinc-400">Ta note : {rating}/5</span>
      )}
    </div>
  );
}
