import GameArtwork from "./GameArtwork";
import Link from "next/link";
import type { Game } from "@/lib/types";
import { categoryLabel, translate, type Locale } from "@/lib/i18n";

export default function GameCard({ game, locale = "fr" }: { game: Game; locale?: Locale }) {
  const t = (key: string) => translate(locale, key);
  return (
    <Link
      href={`/jeu/${game.slug}`}
      className={"portal-game-card group " + (game.authorBadge === "👑" ? "is-featured" : "")}
    >
      <div className={"card-cover bg-gradient-to-br " + game.gradient}><GameArtwork kind={game.category} cover={game.coverUrl} />
        <span className="card-play" aria-hidden="true">↗</span>
        <span className="cover-label">{game.emoji} {categoryLabel(locale, game.category)}</span>
      </div>
      <div className="card-body flex flex-1 flex-col gap-2 p-5">
        <span className="w-fit rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
          {categoryLabel(locale, game.category)}
        </span>
        <h3 className="font-semibold text-zinc-900 group-hover:text-violet-600 dark:text-white">
          {game.title}
        </h3>
        <p className="line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
          {game.description}
        </p>
        <div className="card-meta mt-auto flex flex-wrap items-center justify-between gap-2 pt-4 text-xs text-zinc-500 dark:text-zinc-400">
          <span>
            {t("common.by")} {game.authorBadge ? `${game.authorBadge} ` : ""}
            {game.authorPseudo}
          </span>
          <span className="flex items-center gap-1">
            {game.ratingCount > 0
              ? `⭐ ${game.rating.toFixed(1)} · `
              : ""}
            {game.plays.toLocaleString(locale)}{" "}
            {t(game.plays !== 1 ? "home.statsPlays" : "home.statsPlay")}
          </span>
        </div>
      </div>
    </Link>
  );
}
