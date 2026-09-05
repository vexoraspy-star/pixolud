import Link from "next/link";
import type { Game } from "@/lib/types";

export default function GameCard({ game }: { game: Game }) {
  return (
    <Link
      href={`/jeu/${game.slug}`}
      className={`group flex flex-col overflow-hidden rounded-xl bg-white transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-zinc-900 ${
        game.authorBadge === "👑"
          ? "border-2 border-amber-400 dark:border-amber-500"
          : "border border-zinc-200 dark:border-zinc-800"
      }`}
    >
      {game.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={game.coverUrl}
          alt={game.title}
          className="h-32 w-full object-cover"
        />
      ) : (
        <div
          className={`flex h-32 items-center justify-center bg-gradient-to-br text-5xl ${game.gradient}`}
        >
          {game.emoji}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-1 p-4">
        <span className="w-fit rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
          {game.category}
        </span>
        <h3 className="font-semibold text-zinc-900 group-hover:text-violet-600 dark:text-white">
          {game.title}
        </h3>
        <p className="line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
          {game.description}
        </p>
        <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
          <span>
            par {game.authorBadge ? `${game.authorBadge} ` : ""}
            {game.authorPseudo}
          </span>
          <span className="flex items-center gap-1">
            {game.ratingCount > 0
              ? `⭐ ${game.rating.toFixed(1)} · `
              : ""}
            {game.plays.toLocaleString("fr-FR")} parties
          </span>
        </div>
      </div>
    </Link>
  );
}
