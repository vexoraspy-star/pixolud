import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import GameCard from "@/components/GameCard";
import { getPublishedGames } from "@/lib/games";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Mes favoris — Pixolud",
  description: "Les mini-jeux que tu as mis de côté pour y revenir.",
  robots: { index: false, follow: true },
};

export default async function FavorisPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?next=/favoris");

  const { data: liens, error } = await supabase
    .from("favorites")
    .select("game_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const pret = !error;
  const ordre = new Map((liens ?? []).map((l, i) => [String(l.game_id), i]));
  const jeux = (await getPublishedGames())
    .filter((g) => ordre.has(g.id))
    .sort((a, b) => (ordre.get(a.id) ?? 0) - (ordre.get(b.id) ?? 0));

  return (
    <div className="portal-container portal-page">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--portal-accent)]">Ta sélection</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">Mes favoris</h1>
        <p className="mt-2 text-sm text-[var(--portal-muted)]">
          Les jeux que tu as mis de côté. Clique sur l&apos;étoile d&apos;un jeu pour l&apos;ajouter ou l&apos;enlever.
        </p>

        {!pret && (
          <p className="mt-6 rounded-2xl border border-amber-400/50 bg-amber-400/10 p-4 text-sm">
            Les favoris ne sont pas encore activés : lance <code>supabase/add_favoris.sql</code> dans Supabase (SQL
            Editor → New query → Run).
          </p>
        )}

        {pret && jeux.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-[var(--portal-line)] p-10 text-center">
            <p className="text-4xl" aria-hidden="true">☆</p>
            <p className="mt-3 text-sm font-semibold">Aucun favori pour l&apos;instant.</p>
            <p className="mt-1 text-xs text-[var(--portal-muted)]">
              Ouvre un jeu qui te plaît et clique sur « Mettre en favori ».
            </p>
            <Link href="/catalogue" className="portal-button small mt-5 inline-flex">
              Explorer le catalogue
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {jeux.map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
          </div>
        )}

        {pret && jeux.length > 0 && (
          <p className="mt-6 text-xs text-[var(--portal-muted)]">
            {jeux.length} jeu{jeux.length > 1 ? "x" : ""} en favori. Un jeu retiré du catalogue par son auteur
            disparaît d&apos;ici aussi.
          </p>
        )}
      </div>
    </div>
  );
}
