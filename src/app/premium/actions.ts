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

  // Le palier n'est plus ecrit directement : la colonne `tier` n'est pas
  // modifiable par le client. C'est la fonction `set_my_tier` qui verifie
  // le drapeau admin cote base, hors d'atteinte du navigateur.
  const { error } = await supabase.rpc("set_my_tier", { new_tier: tier });
  if (error) {
    redirect(
      "/premium?error=" +
        encodeURIComponent("Le paiement réel n'est pas encore disponible."),
    );
  }

  revalidatePath("/", "layout");
  redirect("/premium?activated=1");
}
