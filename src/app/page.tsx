import Link from "next/link";
import GameCard from "@/components/GameCard";
import { getMemberCount, getPublishedGames } from "@/lib/games";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, type Game } from "@/lib/types";

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
};

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
      {/* Bannière */}
      <section className="border-b border-zinc-200 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-orange-500 dark:border-zinc-800">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            Crée, publie et joue à des mini-jeux 2D
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white/90 sm:text-lg">
            Pixolud est la plateforme communautaire où n&apos;importe qui peut
            imaginer un mini-jeu — plateforme, puzzle, arcade, labyrinthe,
            quiz — le publier et le faire découvrir à d&apos;autres joueurs.
            Sans écrire une ligne de code.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={user ? "/editeur" : "/inscription"}
              className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-violet-700 shadow hover:bg-zinc-100"
            >
              {user ? "Créer un jeu" : "Créer un compte gratuitement"}
            </Link>
            <Link
              href="/catalogue"
              className="rounded-full border border-white/60 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
            >
              Explorer le catalogue
            </Link>
          </div>

          <form
            action="/catalogue"
            className="mx-auto mt-10 flex max-w-lg items-center overflow-hidden rounded-full bg-white shadow-lg"
          >
            <input
              type="search"
              name="q"
              placeholder="Rechercher un jeu, un créateur..."
              className="flex-1 px-5 py-3 text-sm text-zinc-900 outline-none"
            />
            <button
              type="submit"
              className="m-1 rounded-full bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              Rechercher
            </button>
          </form>

          {games.length > 0 && (
            <div className="mx-auto mt-8 flex max-w-lg flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm font-medium text-white/90">
              <span>🎮 {games.length} jeu{games.length > 1 ? "x" : ""} publié{games.length > 1 ? "s" : ""}</span>
              <span>👥 {memberCount} membre{memberCount > 1 ? "s" : ""}</span>
              <span>▶ {totalPlays.toLocaleString("fr-FR")} partie{totalPlays > 1 ? "s" : ""} jouée{totalPlays > 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
      </section>

      {/* Catégories */}
      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap justify-center gap-3">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat}
              href={`/catalogue?categorie=${encodeURIComponent(cat)}`}
              className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:border-violet-400 hover:text-violet-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:text-violet-400"
            >
              <span>{CATEGORY_EMOJI[cat]}</span>
              {cat}
            </Link>
          ))}
        </div>
      </section>

      {games.length === 0 ? (
        <section className="mx-auto w-full max-w-6xl px-4 py-16 text-center sm:px-6">
          <p className="text-zinc-500 dark:text-zinc-400">
            Aucun jeu publié pour l&apos;instant — sois le premier à en créer un !
          </p>
        </section>
      ) : (
        <>
          {gameOfTheDay && <GameOfTheDay game={gameOfTheDay} />}
          <Section title="👑 Mis en avant" games={featured} />
          <Section title="🆕 Ajoutés récemment" games={recent} />
          <Section title="🔥 Jeux populaires" games={popular} />
          <Section title="⭐ Les mieux notés" games={topRated} />
        </>
      )}

      {/* CTA bas de page */}
      <section className="border-t border-zinc-200 bg-zinc-50 py-16 text-center dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Envie de créer ton propre jeu ?
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-zinc-500 dark:text-zinc-400">
          {user
            ? "Direction l'éditeur pour créer et publier ton prochain mini-jeu."
            : "Rejoins la communauté et publie ton premier mini-jeu en quelques minutes grâce à notre éditeur simple, sans code."}
        </p>
        <Link
          href={user ? "/editeur" : "/inscription"}
          className="mt-6 inline-block rounded-full bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
        >
          {user ? "Créer un jeu" : "Commencer maintenant"}
        </Link>
      </section>
    </div>
  );
}

function GameOfTheDay({ game }: { game: Game }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <h2 className="mb-4 text-xl font-bold text-zinc-900 dark:text-white">
        🎲 Jeu du jour
      </h2>
      <Link
        href={`/jeu/${game.slug}`}
        className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white transition hover:-translate-y-0.5 hover:shadow-lg sm:flex-row dark:border-zinc-800 dark:bg-zinc-900"
      >
        {game.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={game.coverUrl}
            alt={game.title}
            className="h-48 w-full object-cover sm:h-auto sm:w-64"
          />
        ) : (
          <div
            className={`flex h-48 w-full items-center justify-center bg-gradient-to-br text-7xl sm:h-auto sm:w-64 ${game.gradient}`}
          >
            {game.emoji}
          </div>
        )}
        <div className="flex flex-1 flex-col justify-center gap-2 p-6">
          <span className="w-fit rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            {game.category}
          </span>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
            {game.title}
          </h3>
          <p className="line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
            {game.description || "Aucune description."}
          </p>
          <span className="mt-1 text-xs text-zinc-400">
            par {game.authorBadge ? `${game.authorBadge} ` : ""}
            {game.authorPseudo} · {game.plays.toLocaleString("fr-FR")} parties
          </span>
        </div>
      </Link>
    </section>
  );
}

function Section({ title, games }: { title: string; games: Game[] }) {
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
          Voir tout →
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {games.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    </section>
  );
}
