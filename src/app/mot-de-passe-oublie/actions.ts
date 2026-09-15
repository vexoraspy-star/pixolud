"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirect("/mot-de-passe-oublie?error=Indique une adresse email");
  }

  const origin = (await headers()).get("origin");
  const supabase = await createClient();

  // Sans ce "next", le lien de l'e-mail ramenait droit a l'accueil (avec une
  // session ouverte mais sans jamais proposer de choisir un nouveau mot de
  // passe) au lieu du formulaire de reinitialisation.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/reinitialiser-mot-de-passe`,
  });

  // On répond pareil que l'email existe ou non, pour ne pas révéler
  // quels emails sont enregistrés.
  redirect("/mot-de-passe-oublie/verifie-ton-email");
}
