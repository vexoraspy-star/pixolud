"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tier } from "@/lib/tiers";

// Provisoire : active le palier directement, sans paiement réel, en
// attendant l'intégration Stripe (voir le statut légal nécessaire côté
// utilisateur avant de brancher de vrais paiements). À remplacer par un
// vrai flux de paiement plus tard, en gardant la même mise à jour de
// `profiles.tier` à la fin.
export async function activateTier(formData: FormData) {
  const tier = String(formData.get("tier") ?? "free") as Tier;
  if (!["free", "standard", "max"].includes(tier)) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  // Tant qu'il n'y a pas de vrai paiement, seul un compte admin peut
  // s'attribuer un palier payant gratuitement (pour tester). Les autres
  // comptes peuvent seulement repasser au palier gratuit.
  if (tier !== "free") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    if (!profile?.is_admin) {
      redirect(
        "/premium?error=" +
          encodeURIComponent("Le paiement réel n'est pas encore disponible."),
      );
    }
  }

  await supabase.from("profiles").update({ tier }).eq("id", user.id);

  revalidatePath("/", "layout");
  redirect("/premium?activated=1");
}
