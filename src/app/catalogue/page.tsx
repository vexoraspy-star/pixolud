import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mini-jeux gratuits à jouer sans installation — Pixolud",
  description:
    "Des mini-jeux créés par la communauté : plateforme, puzzle, arcade, labyrinthe, quiz, calcul mental. Jouables tout de suite dans le navigateur, gratuitement, sans téléchargement ni compte.",
};

import PortalHeading from "@/components/PortalHeading";
import Link from "next/link";
import GameCard from "@/components/GameCard";
import { getPublishedGames } from "@/lib/games";
import { CATEGORIES } from "@/lib/types";
import { CATEGORIES_SEO } from "@/lib/categoriesSeo";
import { categoryLabel, translate } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

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
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
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

  const categoryHref = (value: string) => `/catalogue?${new URLSearchParams({ q, categorie: value, tri, note })}`;

  return (
    <div className="portal-container portal-page">
      <PortalHeading eyebrow={t("catalogue.eyebrow")} title={t("catalogue.title")} description={t("catalogue.description")} />
      <div className="section-title"><h2>{t("catalogue.heading")}</h2><span>{t(games.length > 1 ? "catalogue.foundMany" : "catalogue.foundOne").replace("{n}", String(games.length))}</span></div>

      <form key={[q, categorie, note, tri].join("|")} className="catalogue-filters" action="/catalogue">
        <input
          type="search"
          name="q"
          aria-label={t("catalogue.search")}
          defaultValue={q}
          placeholder={t("catalogue.searchPlaceholder")}
          className="min-w-[220px] flex-1 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <select
          name="note"
          aria-label={t("catalogue.minRating")}
          defaultValue={note}
          className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">{t("catalogue.allRatings")}</option>
          <option value="4">⭐ {t("catalogue.starsPlus").replace("{n}", "4")}</option>
          <option value="3">⭐ {t("catalogue.starsPlus").replace("{n}", "3")}</option>
          <option value="2">⭐ {t("catalogue.starsPlus").replace("{n}", "2")}</option>
        </select>
        <select
          name="categorie"
          aria-label={t("catalogue.category")}
          defaultValue={categorie}
          className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">{t("catalogue.allCategories")}</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(locale, c)}
            </option>
          ))}
        </select>
        <select
          name="tri"
          aria-label={t("catalogue.sort")}
          defaultValue={tri}
          className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="popularite">{t("catalogue.sortPopular")}</option>
          <option value="recent">{t("catalogue.sortRecent")}</option>
          <option value="note">{t("catalogue.sortRating")}</option>
        </select>
        <button
          type="submit"
          className="rounded-full bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700"
        >
          {t("catalogue.filter")}
        </button>
      </form>

      <div className="category-rail mt-5">
        <FilterPill href={categoryHref("")} active={categorie === ""}>
          {t("catalogue.all")}
        </FilterPill>
        {CATEGORIES.map((c) => (
          <FilterPill key={c} href={categoryHref(c)} active={categorie === c}>
            {categoryLabel(locale, c)}
          </FilterPill>
        ))}
      </div>

      {games.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {games.map((game) => (
            <GameCard key={game.id} game={game} locale={locale} />
          ))}
        </div>
      ) : (
        <div className="empty-panel">
          {allGames.length === 0
            ? t("catalogue.emptyAll")
            : t("catalogue.emptySearch")}
        </div>
      )}

      {/* Les pages de categorie : chacune a son adresse et son texte, c'est
          elles que les moteurs de recherche listent. Les pastilles du haut ne
          font que filtrer cette page-ci. */}
      <section className="mt-12 border-t border-[var(--portal-line)] pt-8">
        <h2 className="text-lg font-bold">{t("catalogue.byType")}</h2>
        <p className="mt-1 text-xs text-[var(--portal-muted)]">
          {t("catalogue.byTypeText")}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {CATEGORIES_SEO.map((c) => (
            <Link
              key={c.slug}
              href={`/jeux/${c.slug}`}
              className="rounded-full border border-[var(--portal-line)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--portal-accent)]"
            >
              {c.emoji} {categoryLabel(locale, c.categorie)}
            </Link>
          ))}
        </div>
      </section>
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
      aria-current={active ? "page" : undefined}
      className={`category-chip ${
        active
          ? "bg-violet-600 text-white"
          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      }`}
    >
      {children}
    </Link>
  );
}
