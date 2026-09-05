import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TIERS, type Tier } from "@/lib/tiers";
import { activateTier } from "./actions";

export default async function PremiumPage({
  searchParams,
}: {
  searchParams: Promise<{ activated?: string; error?: string }>;
}) {
  const { activated, error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentTier: Tier = "free";
  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("tier, is_admin")
      .eq("id", user.id)
      .single();
    currentTier = (profile?.tier as Tier) ?? "free";
    isAdmin = profile?.is_admin ?? false;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
          Passe à Pixolud Premium
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-zinc-500 dark:text-zinc-400">
          Débloque des avantages exclusifs pour te démarquer et créer sans
          limites.
        </p>
      </div>

      {activated && (
        <p className="mx-auto mt-6 max-w-md rounded-lg bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
          Palier mis à jour !
        </p>
      )}
      {error && (
        <p className="mx-auto mt-6 max-w-md rounded-lg bg-red-50 px-4 py-3 text-center text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="mt-10 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
        {isAdmin
          ? "🚧 Paiement réel pas encore disponible — en tant qu'admin, tu peux activer un palier gratuitement pour tester les avantages."
          : "🚧 Le paiement réel arrive bientôt. Les paliers Standard et Max ne sont pas encore activables."}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <TierCard tier="free" current={currentTier === "free"} isAdmin={isAdmin} />
        <TierCard tier="standard" current={currentTier === "standard"} isAdmin={isAdmin} />
        <TierCard tier="max" current={currentTier === "max"} isAdmin={isAdmin} />
      </div>

      {!user && (
        <p className="mt-8 text-center text-sm text-zinc-400">
          <Link href="/connexion" className="font-medium text-violet-600 hover:underline">
            Connecte-toi
          </Link>{" "}
          pour choisir un palier.
        </p>
      )}
    </div>
  );
}

function TierCard({
  tier,
  current,
  isAdmin,
}: {
  tier: Tier;
  current: boolean;
  isAdmin: boolean;
}) {
  const config = TIERS[tier];
  const locked = tier !== "free" && !isAdmin && !current;

  const features: string[] = [];
  if (tier === "free") {
    features.push(`${config.maxPublishedGames} jeux publiés max`);
    features.push("Toutes les fonctionnalités de base");
  } else {
    features.push(
      config.maxPublishedGames === Infinity
        ? "Jeux publiés illimités"
        : `${config.maxPublishedGames} jeux publiés max`,
    );
    features.push(`Badge ${config.badge} sur ton profil et tes jeux`);
    features.push("Vignettes et couleurs exclusives");
    if (tier === "max") {
      features.push("Niveaux plus grands (labyrinthe, plateforme, parcours)");
      features.push("Jeux mis en avant dans le catalogue");
    }
  }

  return (
    <div
      className={`flex flex-col rounded-2xl border p-6 ${
        current
          ? "border-violet-500 ring-2 ring-violet-500"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
        {config.badge ? `${config.badge} ` : ""}
        {config.label}
      </h2>
      <p className="mt-1 text-2xl font-extrabold text-zinc-900 dark:text-white">
        {config.price === 0 ? "0€" : `${config.price.toFixed(2)}€`}
        <span className="text-sm font-normal text-zinc-400">
          {config.price > 0 ? " / mois" : ""}
        </span>
      </p>
      <ul className="mt-4 flex flex-1 flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-300">
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <span className="text-emerald-500">✓</span>
            {f}
          </li>
        ))}
      </ul>
      <form action={activateTier} className="mt-6">
        <input type="hidden" name="tier" value={tier} />
        <button
          type="submit"
          disabled={current || locked}
          className={`w-full rounded-full px-4 py-2 text-sm font-semibold ${
            current || locked
              ? "cursor-not-allowed bg-zinc-100 text-zinc-400 dark:bg-zinc-900"
              : "bg-violet-600 text-white hover:bg-violet-700"
          }`}
        >
          {current ? "Palier actuel" : locked ? "Bientôt disponible" : "Choisir ce palier"}
        </button>
      </form>
    </div>
  );
}
