import { CHEAT_GAMES, enabledCheatGames } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminData } from "@/components/AdminPanel";

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const bool = (v: unknown) => v === true;

/** Toutes les donnees du panneau, lues avec la cle secrete (apres requireAdmin). */
export async function loadAdminData(me: { id: string; pseudo: string }): Promise<AdminData> {
  const db = createAdminClient();

  const [profilesRes, usersRes, gamesRes, commentsRes, reportsRes, logRes, cheats, playsRes] = await Promise.all([
    db.from("profiles").select("*").order("created_at", { ascending: false }).limit(1000),
    db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    db
      .from("games")
      .select("id, slug, title, category, published, plays, created_at, author_id")
      .order("created_at", { ascending: false })
      .limit(1000),
    db.from("comments").select("id, text, created_at, author_id, game_id").order("created_at", { ascending: false }).limit(300),
    db.from("reports").select("*").order("created_at", { ascending: false }).limit(300),
    db.from("admin_log").select("*").order("created_at", { ascending: false }).limit(200),
    enabledCheatGames(),
    // Parties jouees par joueur : absent tant que add_historique_parties.sql
    // n'est pas lance, et le panneau s'affiche quand meme.
    db.from("play_stats").select("user_id, parties, derniere, dernier_jeu"),
  ]);

  const profiles = (profilesRes.data ?? []) as Row[];
  const authUsers = usersRes.data?.users ?? [];
  const games = (gamesRes.data ?? []) as Row[];
  const comments = (commentsRes.data ?? []) as Row[];
  const reports = (reportsRes.data ?? []) as Row[];
  const log = logRes.error ? [] : ((logRes.data ?? []) as Row[]);
  const playStats = new Map(
    (playsRes.error ? [] : ((playsRes.data ?? []) as Row[])).map((r) => [str(r.user_id), r]),
  );

  const pseudoOf = new Map(profiles.map((p) => [str(p.id), str(p.pseudo)]));
  const authOf = new Map(authUsers.map((u) => [u.id, u]));
  const gameOf = new Map(games.map((g) => [str(g.id), g]));
  const gamesBy = new Map<string, number>();
  for (const g of games) gamesBy.set(str(g.author_id), (gamesBy.get(str(g.author_id)) ?? 0) + 1);
  const now = Date.now();

  const data: AdminData = {
    me,
    // Le fichier SQL du panneau a-t-il ete lance ? (colonne « verified » presente)
    migrationReady: profiles.length === 0 || "verified" in profiles[0],
    // Le journal peut manquer a part (droits de la table) : on montre pourquoi.
    logError: logRes.error ? logRes.error.message : "",
    users: profiles.map((p) => {
      const id = str(p.id);
      const auth = authOf.get(id);
      const authBan = auth?.banned_until ? Date.parse(auth.banned_until) : 0;
      const profileBan = bool(p.banned) && (!p.banned_until || Date.parse(str(p.banned_until)) > now);
      return {
        id,
        pseudo: str(p.pseudo),
        email: auth?.email ?? "",
        tier: str(p.tier) || "free",
        isAdmin: bool(p.is_admin),
        verified: bool(p.verified),
        banned: profileBan || authBan > now,
        banReason: str(p.ban_reason),
        bannedUntil: authBan > now && authBan < now + 50 * 365 * 86_400_000 ? new Date(authBan).toISOString() : str(p.banned_until),
        emailConfirmed: Boolean(auth?.email_confirmed_at),
        createdAt: str(p.created_at),
        lastSignIn: auth?.last_sign_in_at ?? "",
        games: gamesBy.get(id) ?? 0,
        parties: typeof playStats.get(id)?.parties === "number" ? (playStats.get(id)!.parties as number) : 0,
        dernierePartie: str(playStats.get(id)?.derniere),
        dernierJeu: str(playStats.get(id)?.dernier_jeu),
      };
    }),
    games: games.map((g) => ({
      id: str(g.id),
      slug: str(g.slug),
      title: str(g.title),
      category: str(g.category),
      published: bool(g.published),
      plays: typeof g.plays === "number" ? g.plays : 0,
      createdAt: str(g.created_at),
      author: pseudoOf.get(str(g.author_id)) ?? "?",
    })),
    comments: comments.map((c) => {
      const g = gameOf.get(str(c.game_id));
      return {
        id: str(c.id),
        text: str(c.text),
        createdAt: str(c.created_at),
        author: pseudoOf.get(str(c.author_id)) ?? "?",
        game: g ? str(g.title) : "?",
        gameSlug: g ? str(g.slug) : "",
      };
    }),
    reports: reports.map((r) => {
      const g = gameOf.get(str(r.game_id));
      return {
        id: str(r.id),
        reason: str(r.reason),
        details: str(r.details),
        status: str(r.status) || "ouvert",
        createdAt: str(r.created_at),
        gameId: str(r.game_id),
        game: g ? str(g.title) : "(jeu supprimé)",
        gameSlug: g ? str(g.slug) : "",
        gamePublished: g ? bool(g.published) : false,
        reporter: pseudoOf.get(str(r.reporter_id)) ?? "anonyme",
      };
    }),
    log: log.map((l) => ({
      id: String(l.id),
      action: str(l.action),
      details: str(l.details),
      createdAt: str(l.created_at),
      admin: pseudoOf.get(str(l.admin_id)) ?? "?",
    })),
    cheatGames: CHEAT_GAMES.map((g) => ({ ...g, on: cheats.includes(g.slug) })),
  };
  return data;
}
