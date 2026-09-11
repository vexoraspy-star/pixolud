import type { MetadataRoute } from "next";
import { getPublishedGames } from "@/lib/games";
import { GAMES_3D } from "@/lib/games3d";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const games = await getPublishedGames();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/catalogue`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/mode-3d`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/multijoueur`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/premium`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/inscription`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/cgu`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/confidentialite`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const gameRoutes: MetadataRoute.Sitemap = games.map((g) => ({
    url: `${SITE_URL}/jeu/${g.slug}`,
    lastModified: g.createdAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  // Les jeux 3D sont edites par l'equipe : leurs URL sont connues a
  // l'avance, il n'y a aucune raison de les laisser hors du sitemap.
  const routes3d: MetadataRoute.Sitemap = GAMES_3D.map((g) => ({
    url: `${SITE_URL}/mode-3d/${g.slug}`,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...routes3d, ...gameRoutes];
}
