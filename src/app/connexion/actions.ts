"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Retrouve l'e-mail d'un compte a partir de son pseudo, pour les comptes
 * crees par un admin sans e-mail. L'adresse ne quitte jamais le serveur.
 */
async function emailForPseudo(pseudo: string): Promise<string | null> {
  try {
    const db = createAdminClient();
    const { data } = await db
      .from("profiles")
      .select("id, pseudo")
      .ilike("pseudo", pseudo.replace(/[\\%_*]/g, "\\$&"));
    const match = (data ?? []).find((p: { id: string; pseudo: string }) => p.pseudo.toLowerCase() === pseudo.toLowerCase());
    if (!match) return null;
    const { data: found } = await db.auth.admin.getUserById(match.id);
    return found.user?.email ?? null;
  } catch {
    return null;
  }
}

export async function login(formData: FormData) {
  const identifier = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!identifier || !password) {
    redirect("/connexion?error=Tous les champs sont requis");
  }

  // Un e-mail, ou un pseudo : on accepte les deux.
  const email = identifier.includes("@") ? identifier : await emailForPseudo(identifier);
  if (!email) {
    redirect(`/connexion?error=${encodeURIComponent("Identifiant ou mot de passe incorrect")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const banned = /banned/i.test(error.message);
    redirect(
      `/connexion?error=${encodeURIComponent(
        banned ? "Ce compte est suspendu par l'équipe Pixolud." : "Identifiant ou mot de passe incorrect",
      )}`,
    );
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
