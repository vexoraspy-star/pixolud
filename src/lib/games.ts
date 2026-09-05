import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Comment, Game } from "@/lib/types";
import { TIERS, type Tier } from "@/lib/tiers";

type GameRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  author_id: string;
  gradient: string;
  emoji: string;
  cover_url: string | null;
  multiplayer_mode: boolean;
  plays: number;
  created_at: string;
  profiles: { pseudo: string; tier: string } | null;
};

function withRatings(games: GameRow[], ratingByGame: Map<string, { sum: number; count: number }>): Game[] {
  return games.map((g) => {
    const stats = ratingByGame.get(g.id);
    return {
      id: g.id,
      slug: g.slug,
      title: g.title,
      description: g.description,
      category: g.category,
      authorId: g.author_id,
      authorPseudo: g.profiles?.pseudo ?? "inconnu",
      authorBadge: TIERS[(g.profiles?.tier as Tier) ?? "free"].badge,
      gradient: g.gradient,
      emoji: g.emoji,
      coverUrl: g.cover_url,
      multiplayerMode: g.multiplayer_mode,
      plays: g.plays,
      createdAt: g.created_at,
      rating: stats ? stats.sum / stats.count : 0,
      ratingCount: stats?.count ?? 0,
    };
  });
}

async function getRatingsByGame(supabase: Awaited<ReturnType<typeof createClient>>, gameIds: string[]) {
  const ratingByGame = new Map<string, { sum: number; count: number }>();
  if (gameIds.length === 0) return ratingByGame;

  const { data: ratings } = await supabase
    .from("ratings")
    .select("game_id, stars")
    .in("game_id", gameIds);

  for (const r of ratings ?? []) {
    const entry = ratingByGame.get(r.game_id) ?? { sum: 0, count: 0 };
    entry.sum += r.stars;
    entry.count += 1;
    ratingByGame.set(r.game_id, entry);
  }
  return ratingByGame;
}

export async function getPublishedGames(): Promise<Game[]> {
  const supabase = await createClient();
  const { data: games } = await supabase
    .from("games")
    .select("id, slug, title, description, category, author_id, gradient, emoji, cover_url, multiplayer_mode, plays, created_at, profiles!games_author_id_fkey(pseudo, tier)")
    .eq("published", true)
    .order("created_at", { ascending: false })
    .returns<GameRow[]>();

  if (!games) return [];

  const ratingByGame = await getRatingsByGame(supabase, games.map((g) => g.id));
  return withRatings(games, ratingByGame);
}

export const getGameBySlug = cache(async (slug: string): Promise<Game | null> => {
  const supabase = await createClient();
  const { data: game } = await supabase
    .from("games")
    .select("id, slug, title, description, category, author_id, gradient, emoji, cover_url, multiplayer_mode, plays, created_at, profiles!games_author_id_fkey(pseudo, tier)")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle<GameRow>();

  if (!game) return null;

  const ratingByGame = await getRatingsByGame(supabase, [game.id]);
  return withRatings([game], ratingByGame)[0];
});

export async function getMemberCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true });
  return count ?? 0;
}

export async function getCommentsForGame(gameId: string): Promise<Comment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("comments")
    .select("id, game_id, author_id, text, created_at, profiles!comments_author_id_fkey(pseudo, tier)")
    .eq("game_id", gameId)
    .order("created_at", { ascending: false })
    .returns<{ id: string; game_id: string; author_id: string; text: string; created_at: string; profiles: { pseudo: string; tier: string } | null }[]>();

  return (data ?? []).map((c) => ({
    id: c.id,
    gameId: c.game_id,
    authorId: c.author_id,
    authorPseudo: c.profiles?.pseudo ?? "inconnu",
    authorBadge: TIERS[(c.profiles?.tier as Tier) ?? "free"].badge,
    text: c.text,
    createdAt: c.created_at,
  }));
}
