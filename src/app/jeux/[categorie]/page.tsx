import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import GameCard from "@/components/GameCard";
import { getPublishedGames } from "@/lib/games";
import { CATEGORIES_SEO, categorieSeoBySlug } from "@/lib/categoriesSeo";


const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://pixolud.vercel.app";

/**
 * Une page par categorie de jeu.
 *
 * Le catalogue filtre deja par categorie, mais avec un parametre d'adresse
 * (?categorie=Quiz) : un moteur de recherche n'en fait rien. Ces pages-ci ont
 * chacune leur adresse, leur titre, leur texte et leur liste — c'est ce qui
 * leur permet de sortir sur « quiz a creer gratuitement » plutot que de
 * disparaitre derriere les geants du jeu en ligne.
 */

export function generateStaticParams() {
  return CATEGORIES_SEO.map((c) => ({ categorie: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categorie: string }>;
}): Promise<Metadata> {
  const { categorie } = await params;
  const info = categorieSeoBySlug(categorie);
  if (!info) return {};
  return {
    title: `${info.titre} — Pixolud`,
    description: info.description,
    alternates: { canonical: `${SITE_URL}/jeux/${info.slug}` },
    openGraph: {
      title: info.titre,
      description: info.description,
      url: `${SITE_URL}/jeux/${info.slug}`,
    },
  };
}

export default async function CategoriePage({
  params,
}: {
  params: Promise<{ categorie: string }>;
}) {
  const { categorie } = await params;
  const info = categorieSeoBySlug(categorie);
  if (!info) notFound();

  const jeux = (await getPublishedGames()).filter((g) => g.category === info.categorie);

  // Donnees structurees : la liste des jeux de la page, pour que Google
  // comprenne qu'il s'agit d'un catalogue et non d'un article.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: info.titre,
    description: info.description,
    url: `${SITE_URL}/jeux/${info.slug}`,
    isPartOf: { "@type": "WebSite", name: "Pixolud", url: SITE_URL },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: jeux.length,
      itemListElement: jeux.slice(0, 20).map((g, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}/jeu/${g.slug}`,
        name: g.title,
      })),
    },
  };

  return (
    <div className="category-showcase portal-container portal-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="mx-auto max-w-5xl">
        <nav aria-label="Fil d'ariane" className="text-xs text-[var(--portal-muted)]">
          <Link href="/catalogue" className="hover:underline">
            Catalogue
          </Link>{" "}
          / {info.categorie}
        </nav>

        <div className="category-intro">
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight">
            <span aria-hidden="true">{info.emoji}</span> {info.titre}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--portal-muted)]">{info.intro}</p>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--portal-muted)]">{info.detail}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/editeur" className="portal-button small">
              Créer un jeu {info.categorie}
            </Link>
            <Link href="/catalogue" className="portal-button secondary small">
              Voir tout le catalogue
            </Link>
          </div>
        </div>

        <section className="category-games mode-section mt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-2xl font-bold">
              {jeux.length} jeu{jeux.length > 1 ? "x" : ""} {info.categorie}
            </h2>
          </div>

          {jeux.length === 0 ? (
            <div className="mode-empty mt-5 rounded-2xl border border-dashed border-[var(--portal-line)] p-10 text-center">
              <p className="text-4xl" aria-hidden="true">{info.emoji}</p>
              <p className="mt-3 text-sm font-semibold">Aucun jeu publié dans cette catégorie pour l&apos;instant.</p>
              <p className="mt-1 text-xs text-[var(--portal-muted)]">Le premier sera peut-être le tien.</p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {jeux.map((g) => (
                <GameCard key={g.id} game={g} />
              ))}
            </div>
          )}
        </section>

        <section className="category-discovery mt-12">
          <h2 className="text-lg font-bold">Les autres catégories</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {CATEGORIES_SEO.filter((c) => c.slug !== info.slug).map((c) => (
              <Link
                key={c.slug}
                href={`/jeux/${c.slug}`}
                className="rounded-full border border-[var(--portal-line)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--portal-accent)]"
              >
                {c.emoji} {c.categorie}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
