import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCommentsForGame, getGameBySlug } from "@/lib/games";
import { createClient } from "@/lib/supabase/server";
import RatingWidget from "@/components/RatingWidget";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import InvitePartyButton from "@/components/InvitePartyButton";
import { deleteComment, postComment } from "./actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) return {};

  const title = `${game.title} — Pixolud`;
  const description =
    game.description.trim() ||
    `Un mini-jeu ${game.category} créé par ${game.authorPseudo} sur Pixolud.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: game.coverUrl ? [game.coverUrl] : undefined,
    },
  };
}

export default async function GamePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const game = await getGameBySlug(slug);
  if (!game) notFound();

  const comments = await getCommentsForGame(game.id);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let myRating = 0;
  if (user) {
    const { data: existing } = await supabase
      .from("ratings")
      .select("stars")
      .eq("game_id", game.id)
      .eq("user_id", user.id)
      .maybeSingle();
    myRating = existing?.stars ?? 0;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      {game.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={game.coverUrl}
          alt={game.title}
          className="h-56 w-full rounded-2xl object-cover sm:h-72"
        />
      ) : (
        <div
          className={`flex h-56 items-center justify-center rounded-2xl bg-gradient-to-br text-7xl sm:h-72 ${game.gradient}`}
        >
          {game.emoji}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="w-fit rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            {game.category}
          </span>
          <h1 className="mt-2 text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-white">
            {game.title}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            par{" "}
            <Link
              href={`/profil/${game.authorPseudo}`}
              className="font-medium text-violet-600 hover:underline"
            >
              {game.authorBadge ? `${game.authorBadge} ` : ""}
              {game.authorPseudo}
            </Link>{" "}
            · publié le {new Date(game.createdAt).toLocaleDateString("fr-FR")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {user?.id === game.authorId && (
            <Link
              href={`/editeur/${game.id}`}
              className="rounded-full border border-zinc-300 px-5 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              ✏️ Modifier
            </Link>
          )}
          {game.multiplayerMode && <InvitePartyButton slug={game.slug} />}
          <Link
            href={`/jeu/${game.slug}/jouer`}
            className="rounded-full bg-violet-600 px-8 py-3 text-sm font-semibold text-white shadow hover:bg-violet-700"
          >
            ▶ Jouer
          </Link>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-6 text-sm text-zinc-500 dark:text-zinc-400">
        {game.ratingCount > 0 ? (
          <span>
            ⭐ {game.rating.toFixed(1)} / 5 ({game.ratingCount} avis)
          </span>
        ) : (
          <span>Pas encore noté</span>
        )}
        <span>🎮 {game.plays.toLocaleString("fr-FR")} parties jouées</span>
      </div>

      <div className="mt-3">
        {user ? (
          <RatingWidget gameId={game.id} slug={game.slug} initialRating={myRating} />
        ) : (
          <p className="text-xs text-zinc-400">
            <Link href="/connexion" className="font-medium text-violet-600 hover:underline">
              Connecte-toi
            </Link>{" "}
            pour noter ce jeu.
          </p>
        )}
      </div>

      <p className="mt-6 leading-relaxed text-zinc-700 dark:text-zinc-300">
        {game.description}
      </p>

      <div className="mt-4">
        <Link
          href={`/signalement?jeu=${game.slug}`}
          className="text-xs font-medium text-zinc-400 hover:text-red-500"
        >
          🚩 Signaler ce jeu
        </Link>
      </div>

      <section className="mt-10 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
          Commentaires ({comments.length})
        </h2>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </p>
        )}

        {user ? (
          <form action={postComment} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input type="hidden" name="gameId" value={game.id} />
            <input type="hidden" name="slug" value={game.slug} />
            <input
              type="text"
              name="text"
              placeholder="Ajouter un commentaire..."
              required
              maxLength={500}
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            />
            <button
              type="submit"
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
            >
              Publier
            </button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-zinc-400">
            <Link href="/connexion" className="font-medium text-violet-600 hover:underline">
              Connecte-toi
            </Link>{" "}
            pour laisser un commentaire.
          </p>
        )}

        <ul className="mt-6 flex flex-col gap-4">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-zinc-900 dark:text-white">
                  {c.authorBadge ? `${c.authorBadge} ` : ""}
                  {c.authorPseudo}
                </span>
                <span className="flex items-center gap-3 text-zinc-400">
                  {new Date(c.createdAt).toLocaleDateString("fr-FR")}
                  {user?.id === c.authorId ? (
                    <form action={deleteComment}>
                      <input type="hidden" name="commentId" value={c.id} />
                      <input type="hidden" name="slug" value={game.slug} />
                      <ConfirmSubmitButton
                        confirmMessage="Supprimer ce commentaire ?"
                        className="text-xs font-medium text-red-500 hover:underline"
                      >
                        Supprimer
                      </ConfirmSubmitButton>
                    </form>
                  ) : (
                    <Link
                      href={`/signalement?jeu=${game.slug}&contexte=${encodeURIComponent(
                        `Commentaire de ${c.authorPseudo} sur "${game.title}" : "${c.text}"`,
                      )}`}
                      className="text-xs font-medium hover:text-red-500"
                    >
                      🚩 Signaler
                    </Link>
                  )}
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{c.text}</p>
            </li>
          ))}
          {comments.length === 0 && (
            <p className="text-sm text-zinc-400">
              Aucun commentaire pour l&apos;instant. Sois le premier à donner ton avis !
            </p>
          )}
        </ul>
      </section>
    </div>
  );
}
