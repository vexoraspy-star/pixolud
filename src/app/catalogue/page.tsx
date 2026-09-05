import Link from "next/link";
import GameCard from "@/components/GameCard";
import { getPublishedGames } from "@/lib/games";
import { CATEGORIES } from "@/lib/types";

type SearchParams = Promise<{
  q?: string;
  categorie?: string;
  tri?: string;
  note?: string;
}>;

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q = "", categorie = "", tri = "popularite", note = "" } = await searchParams;
  const allGames = await getPublishedGames();
  const minNote = Number(note) || 0;

  const keywords = q.toLowerCase().trim().split(/\s+/).filter(Boolean);

  let games = allGames.filter((g) => {
    const haystack =
      `${g.title} ${g.description} ${g.authorPseudo} ${g.category}`.toLowerCase();
    const matchesQuery = keywords.every((kw) => haystack.includes(kw));
    const matchesCategory = categorie === "" || g.category === categorie;
    const matchesNote = minNote === 0 || g.rating >= minNote;
    return matchesQuery && matchesCategory && matchesNote;
  });

  games = [...games].sort((a, b) => {
    const featuredBoost = Number(b.authorBadge === "👑") - Number(a.authorBadge === "👑");
    if (featuredBoost !== 0) return featuredBoost;
    if (tri === "recent") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (tri === "note") {
      return b.rating - a.rating;
    }
    return b.plays - a.plays;
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
        Catalogue de jeux
      </h1>
      <p className="mt-1 text-zinc-500 dark:text-zinc-400">
        {games.length} jeu{games.length > 1 ? "x" : ""} trouvé
        {games.length > 1 ? "s" : ""}
      </p>

      <form className="mt-6 flex flex-wrap items-center gap-3" action="/catalogue">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Rechercher un jeu, un créateur, un mot-clé..."
          className="min-w-[220px] flex-1 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <select
          name="note"
          defaultValue={note}
          className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Toutes les notes</option>
          <option value="4">⭐ 4+ étoiles</option>
          <option value="3">⭐ 3+ étoiles</option>
          <option value="2">⭐ 2+ étoiles</option>
        </select>
        <select
          name="categorie"
          defaultValue={categorie}
          className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Toutes catégories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          name="tri"
          defaultValue={tri}
          className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="popularite">Popularité</option>
          <option value="recent">Plus récents</option>
          <option value="note">Mieux notés</option>
        </select>
        <button
          type="submit"
          className="rounded-full bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700"
        >
          Filtrer
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        <FilterPill href="/catalogue" active={categorie === ""}>
          Toutes
        </FilterPill>
        {CATEGORIES.map((c) => (
          <FilterPill key={c} href={`/catalogue?categorie=${c}`} active={categorie === c}>
            {c}
          </FilterPill>
        ))}
      </div>

      {games.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      ) : (
        <div className="mt-16 text-center text-zinc-500 dark:text-zinc-400">
          {allGames.length === 0
            ? "Aucun jeu publié pour l'instant."
            : "Aucun jeu ne correspond à ta recherche."}
        </div>
      )}
    </div>
  );
}

function FilterPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        active
          ? "bg-violet-600 text-white"
          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      }`}
    >
      {children}
    </Link>
  );
}
