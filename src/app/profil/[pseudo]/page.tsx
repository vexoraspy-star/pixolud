import Link from "next/link";
import type { Metadata } from "next";
import GameCard from "@/components/GameCard";
import { getPublishedGames } from "@/lib/games";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
    .select("*")
    .ilike("pseudo", pseudo)
    .maybeSingle();
  const badge = TIERS[(profile?.tier as Tier) ?? "free"].badge;

  // Avertissements de l'equipe : ils restent visibles sur le profil.
  let warnings: { count: number; last: string } | null = null;
  if (profile?.id && process.env.SUPABASE_SECRET_KEY) {
    const { data, count } = await createAdminClient()
      .from("admin_notices")
      .select("message", { count: "exact" })
      .eq("user_id", profile.id)
      .eq("kind", "avertissement")
      .order("created_at", { ascending: false })
      .limit(1);
    if (count) warnings = { count, last: String(data?.[0]?.message ?? "") };
  }

  const allGames = await getPublishedGames();
  const createdGames = allGames.filter(
    (g) => g.authorPseudo.toLowerCase() === pseudo.toLowerCase(),
  );

  return (
    <div className="studio-page mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="profile-banner flex items-center gap-4">
        <div className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-3xl font-bold text-white">
          {pseudo.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {badge ? `${badge} ` : ""}
            {profile?.pseudo ?? pseudo}
            {profile?.verified === true && (
              <span
                title="Compte certifié par l'équipe Pixolud"
                className="ml-2 inline-flex translate-y-[-2px] items-center rounded-full bg-sky-500 px-2 py-0.5 align-middle text-xs font-bold text-white"
              >
                ✔ Certifié
              </span>
            )}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Membre de Pixolud · {createdGames.length} jeu
            {createdGames.length > 1 ? "x" : ""} publié
            {createdGames.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {warnings && (
        <div className="mt-5 max-w-xl rounded-xl border border-amber-400/50 bg-amber-400/10 px-4 py-3 text-sm">
          <b>
            ⚠️ {warnings.count} avertissement{warnings.count > 1 ? "s" : ""} de l&apos;équipe Pixolud
          </b>
          {warnings.last && <p className="mt-1 text-xs opacity-80">Dernier : « {warnings.last} »</p>}
        </div>
      )}

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
