import GameArtwork from "@/components/GameArtwork";
import Link from "next/link";
import GameCard from "@/components/GameCard";
import { getMemberCount, getPublishedGames } from "@/lib/games";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, type Game } from "@/lib/types";
import { categoryLabel, translate, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

function pickGameOfTheDay(games: Game[]): Game | null {
  if (games.length === 0) return null;
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  return games[dayIndex % games.length];
}

const CATEGORY_EMOJI: Record<string, string> = {
  Plateforme: "🧱",
  Puzzle: "🧩",
  Arcade: "👾",
  Labyrinthe: "🌀",
  Quiz: "🧠",
  Course: "🏁",
  Runner: "🦔",
  Musique: "🎵",
  Mélodie: "🎶",
  "Calcul Mental": "🧮",
  "Petit Bac": "📝",
  Devinettes: "🔍",
  Éducation: "🎓",
  Python: "🐍",
  "Game Script": "⌨️",
};

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);

  const games = await getPublishedGames();
  const memberCount = await getMemberCount();
  const totalPlays = games.reduce((sum, g) => sum + g.plays, 0);
  const gameOfTheDay = pickGameOfTheDay(games);

  const featured = [...games]
    .filter((g) => g.authorBadge === "👑")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);
  const featuredIds = new Set(featured.map((g) => g.id));
  if (gameOfTheDay) featuredIds.add(gameOfTheDay.id);
  const rest = games.filter((g) => !featuredIds.has(g.id));
  const recent = [...rest]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);
  const popular = [...rest].sort((a, b) => b.plays - a.plays).slice(0, 4);
  const topRated = [...rest]
    .filter((g) => g.ratingCount > 0)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 4);

  return (
    <div className="flex flex-col">
      <section className="home-hero portal-container">
        <div className="home-hero-copy">
          <p className="eyebrow"><span />{t("home.eyebrow")}</p>
          <h1>{t("home.title")}</h1>
          <p className="portal-description">{t("home.subtitle")}</p>
          <div className="hero-actions">
            <Link href="/catalogue" className="portal-button">{t("home.ctaExplore")} <span aria-hidden="true">↗</span></Link>
            <Link href={user ? "/editeur" : "/inscription"} className="portal-button secondary">{user ? t("home.ctaCreateGame") : t("home.ctaSignup")}</Link>
          </div>
          <form action="/catalogue" className="hero-search">
            <span aria-hidden="true">⌕</span>
            <input type="search" name="q" aria-label={t("home.searchPlaceholder")} placeholder={t("home.searchPlaceholder")} />
            <button type="submit" aria-label={t("home.searchButton")}>→</button>
          </form>
          <Link href={"/catalogue?categorie=" + encodeURIComponent("Éducation")} className="education-link">{t("home.ctaEducation")} <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="hero-showcase">
          <Link href="/mode-3d/cubes" className="showcase-main">
            <GameArtwork kind="cubes" priority />
            <span className="showcase-tag">{t("home.showcaseTag")}</span>
            <div className="showcase-caption"><div><span>{t("home.cubesCaption")}</span><h2>Cubes</h2></div><span className="showcase-arrow" aria-hidden="true">↗</span></div>
          </Link>
          <Link href="/mode-3d/backrooms" className="showcase-small"><GameArtwork kind="backrooms" /><span>{t("home.backroomsCaption")}<strong>Backrooms <span aria-hidden="true">↗</span></strong></span></Link>
          <span className="showcase-note">{t("home.showcaseNote")}</span>
        </div>
      </section>
      <div className="portal-container">
        <div className="community-strip">
          <span className="community-label"><span className="live-dot" /> {t("home.community")}</span>
          <span><strong>{games.length}</strong> {t(games.length !== 1 ? "home.statsGames" : "home.statsGame")}</span>
          <span><strong>{memberCount}</strong> {t(memberCount !== 1 ? "home.statsMembers" : "home.statsMember")}</span>
          <span><strong>{totalPlays.toLocaleString(locale)}</strong> {t(totalPlays !== 1 ? "home.statsPlays" : "home.statsPlay")}</span>
        </div>
      </div>

      {/* Catégories */}
      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="category-rail">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat}
              href={`/catalogue?categorie=${encodeURIComponent(cat)}`}
              className="category-chip"
            >
              <span>{CATEGORY_EMOJI[cat]}</span>
              {categoryLabel(locale, cat)}
            </Link>
          ))}
        </div>
      </section>

      {games.length === 0 ? (
        <section className="mx-auto w-full max-w-6xl px-4 py-16 text-center sm:px-6">
          <p className="text-zinc-500 dark:text-zinc-400">{t("home.emptyState")}</p>
        </section>
      ) : (
        <>
          {gameOfTheDay && <GameOfTheDay game={gameOfTheDay} locale={locale} t={t} />}
          <Section title={t("home.featured")} games={featured} seeAll={t("home.seeAll")} locale={locale} />
          <Section title={t("home.recent")} games={recent} seeAll={t("home.seeAll")} locale={locale} />
          <Section title={t("home.popular")} games={popular} seeAll={t("home.seeAll")} locale={locale} />
          <Section title={t("home.topRated")} games={topRated} seeAll={t("home.seeAll")} locale={locale} />
        </>
      )}

      {/* CTA bas de page */}
      <section className="creator-banner portal-container">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("home.bottomTitle")}</h2>
        <p className="mx-auto mt-2 max-w-xl text-zinc-500 dark:text-zinc-400">
          {user ? t("home.bottomTextLoggedIn") : t("home.bottomTextLoggedOut")}
        </p>
        <Link
          href={user ? "/editeur" : "/inscription"}
          className="mt-6 inline-block rounded-full bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
        >
          {user ? t("home.ctaCreateGame") : t("home.bottomButton")}
        </Link>
      </section>
    </div>
  );
}

function GameOfTheDay({
  game,
  locale,
  t,
}: {
  game: Game;
  locale: Locale;
  t: (key: string) => string;
}) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <h2 className="mb-4 text-xl font-bold text-zinc-900 dark:text-white">{t("home.gameOfDay")}</h2>
      <Link
        href={`/jeu/${game.slug}`}
        className="daily-game flex flex-col sm:flex-row"
      >
        <div className="daily-art"><GameArtwork kind={game.category} cover={game.coverUrl} /></div>
        <div className="flex flex-1 flex-col justify-center gap-2 p-6">
          <span className="w-fit rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            {categoryLabel(locale, game.category)}
          </span>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
            {game.title}
          </h3>
          <p className="line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
            {game.description || "—"}
          </p>
          <span className="mt-1 text-xs text-zinc-400">
            {t("common.by")} {game.authorBadge ? `${game.authorBadge} ` : ""}
            {game.authorPseudo} · {game.plays.toLocaleString(locale)}{" "}
            {t(game.plays !== 1 ? "home.statsPlays" : "home.statsPlay")}
          </span>
        </div>
      </Link>
    </section>
  );
}

function Section({
  title,
  games,
  seeAll,
  locale,
}: {
  title: string;
  games: Game[];
  seeAll: string;
  locale: Locale;
}) {
  if (games.length === 0) return null;
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
          {title}
        </h2>
        <Link
          href="/catalogue"
          className="text-sm font-medium text-violet-600 hover:underline"
        >
          {seeAll}
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {games.map((game) => (
          <GameCard key={game.id} game={game} locale={locale} />
        ))}
      </div>
    </section>
  );
}
