"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateProfile(formData: FormData) {
  const bio = String(formData.get("bio") ?? "").slice(0, 280);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  await supabase.from("profiles").update({ bio }).eq("id", user.id);

  revalidatePath("/parametres");
  revalidatePath("/profil", "layout");
  redirect("/parametres?saved=1");
}

/**
 * « Supprimer mon compte » (RGPD, droit a l'effacement) : le compte, le
 * profil, les jeux, les commentaires et les notes partent ensemble, tout de
 * suite. Il faut retaper son pseudo pour eviter le clic malheureux.
 */
export async function deleteMyAccount(formData: FormData) {
  const typed = String(formData.get("confirmation") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data: profile } = await supabase.from("profiles").select("pseudo").eq("id", user.id).maybeSingle();
  if (!profile || typed !== profile.pseudo) {
    redirect("/parametres?erreur=" + encodeURIComponent("Le pseudo tapé ne correspond pas : rien n'a été supprimé."));
  }

  if (!process.env.SUPABASE_SECRET_KEY) {
    redirect("/parametres?erreur=" + encodeURIComponent("Suppression indisponible pour le moment. Écris-nous et nous le ferons."));
  }

  // La suppression du compte entraine celle du profil, des jeux, des
  // commentaires et des notes (cles etrangeres en cascade).
  const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (error) {
    redirect("/parametres?erreur=" + encodeURIComponent("La suppression a échoué. Réessaie ou écris-nous."));
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/?compte=supprime");
}
