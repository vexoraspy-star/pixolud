"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
