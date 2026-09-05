"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");

  if (password.length < 8) {
    redirect(
      "/reinitialiser-mot-de-passe?error=Le mot de passe doit contenir au moins 8 caractères",
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/mot-de-passe-oublie?error=Le lien a expiré, merci de refaire une demande",
    );
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/reinitialiser-mot-de-passe?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/connexion?message=Mot de passe mis à jour, tu peux te connecter");
}
