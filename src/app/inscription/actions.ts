"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function signup(formData: FormData) {
  const pseudo = String(formData.get("pseudo") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const acceptCgu = formData.get("accept-cgu") === "on";

  if (!pseudo || !email || !password) {
    redirect("/inscription?error=Tous les champs sont requis");
  }
  if (!acceptCgu) {
    redirect(
      "/inscription?error=Tu dois accepter les CGU et la politique de confidentialité",
    );
  }
  if (password.length < 8) {
    redirect(
      "/inscription?error=Le mot de passe doit contenir au moins 8 caractères",
    );
  }

  const origin = (await headers()).get("origin");
  const supabase = await createClient();

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .ilike("pseudo", pseudo)
    .maybeSingle();

  if (existingProfile) {
    redirect(
      `/inscription?error=${encodeURIComponent(
        "Ce pseudo est déjà pris, choisis-en un autre.",
      )}`,
    );
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { pseudo },
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });

  if (error) {
    // Le message brut de Supabase pour un échec du trigger de création de
    // profil (ex: pseudo pris en même temps par quelqu'un d'autre) n'est
    // pas compréhensible pour un utilisateur — on affiche un message clair.
    const message = error.message.includes("Database error")
      ? "Ce pseudo est déjà pris, choisis-en un autre."
      : error.message;
    redirect(`/inscription?error=${encodeURIComponent(message)}`);
  }

  redirect("/inscription/verifie-ton-email");
}
