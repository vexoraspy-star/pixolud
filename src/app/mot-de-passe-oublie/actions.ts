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

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm`,
  });

  // On répond pareil que l'email existe ou non, pour ne pas révéler
  // quels emails sont enregistrés.
  redirect("/mot-de-passe-oublie/verifie-ton-email");
}
