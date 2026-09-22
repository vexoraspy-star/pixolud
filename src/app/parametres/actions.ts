"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { frameAllowed } from "@/lib/frames";
import { TIERS, type Tier } from "@/lib/tiers";

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
 * Photo de profil et cadre.
 *
 * La photo est deja dans le stockage Supabase quand on arrive ici (l'envoi se
 * fait depuis le navigateur, dans le dossier de la personne) : cette action ne
 * fait qu'enregistrer son adresse, apres avoir verifie qu'elle vient bien de
 * NOTRE stockage et du dossier de cette personne. Sinon n'importe qui
 * pourrait mettre l'adresse d'un site exterieur dans son avatar — un
 * traqueur, ou une image qui change dans le dos de tout le monde.
 */
export async function saveAvatar(urlIn: string | null, frameIn: string): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Connecte-toi d'abord." };

  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/avatars/${user.id}/`;
  const url = urlIn ? String(urlIn).slice(0, 500) : null;
  if (url && !url.startsWith(base)) {
    return { ok: false, message: "Cette image ne vient pas du site." };
  }

  const { data: profil } = await supabase.from("profiles").select("tier").eq("id", user.id).maybeSingle();
  const brut = String(profil?.tier ?? "free");
  const tier = (brut in TIERS ? brut : "free") as Tier;
  if (!frameAllowed(frameIn, tier)) {
    return { ok: false, message: "Ce cadre est réservé à un palier supérieur." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: url, frame: frameIn })
    .eq("id", user.id);
  if (error) {
    return {
      ok: false,
      message: /column|schema cache/i.test(error.message)
        ? "Lance d'abord supabase/add_profil_et_party.sql dans Supabase."
        : "Enregistrement impossible.",
    };
  }

  revalidatePath("/parametres");
  revalidatePath("/profil", "layout");
  revalidatePath("/amis");
  return { ok: true, message: "C'est enregistré." };
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
