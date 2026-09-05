import Link from "next/link";
import type { Metadata } from "next";
import GameCard from "@/components/GameCard";
import { getPublishedGames } from "@/lib/games";
import { createClient } from "@/lib/supabase/server";
import { TIERS, type Tier } from "@/lib/tiers";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pseudo: string }>;
}): Promise<Metadata> {
  const { pseudo } = await params;
  return {
    title: `${pseudo} — Pixolud`,
    description: `Découvre les mini-jeux créés par ${pseudo} sur Pixolud.`,
  };
}

export default async function ProfilPage({
  params,
}: {
  params: Promise<{ pseudo: string }>;
}) {
  const { pseudo } = await params;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("pseudo, bio, tier, created_at")
    .ilike("pseudo", pseudo)
    .maybeSingle();
  const badge = TIERS[(profile?.tier as Tier) ?? "free"].badge;

  const allGames = await getPublishedGames();
  const createdGames = allGames.filter(
    (g) => g.authorPseudo.toLowerCase() === pseudo.toLowerCase(),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex items-center gap-4">
        <div className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-3xl font-bold text-white">
          {pseudo.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {badge ? `${badge} ` : ""}
            {profile?.pseudo ?? pseudo}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Membre de Pixolud · {createdGames.length} jeu
            {createdGames.length > 1 ? "x" : ""} publié
            {createdGames.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <p className="mt-6 max-w-xl text-sm text-zinc-600 dark:text-zinc-300">
        {profile?.bio || "Cette personne n'a pas encore rédigé de bio."}
      </p>

      <Link
        href={`/signalement?contexte=${encodeURIComponent(`Profil de ${pseudo}`)}`}
        className="mt-2 inline-block text-xs font-medium text-zinc-400 hover:text-red-500"
      >
        🚩 Signaler ce profil
      </Link>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
          Jeux créés
        </h2>
        {createdGames.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {createdGames.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-400">
            {pseudo} n&apos;a encore publié aucun jeu.
          </p>
        )}
      </section>
    </div>
  );
}
