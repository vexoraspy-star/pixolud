import type { MetadataRoute } from "next";
import { CATEGORIES_SEO } from "@/lib/categoriesSeo";
import { getPublishedGames } from "@/lib/games";
import { playableGames3D } from "@/lib/games3d";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const games = await getPublishedGames();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/catalogue`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/mode-3d`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/multijoueur`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/a-propos`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/pixocall`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/game-script`, changeFrequency: "weekly", priority: 0.8 },
    // Une page par categorie : ce sont elles qui visent les recherches
    // precises (« quiz a creer », « labyrinthe en ligne »...).
    ...CATEGORIES_SEO.map((c) => ({
      url: `${SITE_URL}/jeux/${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    { url: `${SITE_URL}/premium`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/inscription`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/cgu`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/confidentialite`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/cookies`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/mentions-legales`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/remboursement`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const gameRoutes: MetadataRoute.Sitemap = games.map((g) => ({
    url: `${SITE_URL}/jeu/${g.slug}`,
    lastModified: g.createdAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  // Les jeux 3D sont edites par l'equipe : leurs URL sont connues a
  // l'avance, il n'y a aucune raison de les laisser hors du sitemap.
  const routes3d: MetadataRoute.Sitemap = playableGames3D().map((g) => ({
    url: `${SITE_URL}/mode-3d/${g.slug}`,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...routes3d, ...gameRoutes];
}
