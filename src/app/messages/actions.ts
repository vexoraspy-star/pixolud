"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface Notice {
  kind: "avertissement" | "message" | "screamer";
  message: string;
}

/**
 * Les messages de l'equipe en attente pour la personne qui visite : le compte
 * connecte, ou l'invite par son numero. Marques « vus » dans la meme requete.
 */
export async function pollMyNotices(guest?: string): Promise<Notice[]> {
  try {
    if (!process.env.SUPABASE_SECRET_KEY) return [];
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const db = createAdminClient();
    let query = db.from("admin_notices").update({ seen_at: new Date().toISOString() }).is("seen_at", null);
    if (user) query = query.eq("user_id", user.id);
    else if (guest && /^\d{6}$/.test(guest)) query = query.eq("guest_num", guest);
    else return [];
    const { data } = await query.select("kind, message, created_at").order("created_at", { ascending: true });
    return (data ?? [])
      .filter((n): n is Notice & { created_at: string } => ["avertissement", "message", "screamer"].includes(n.kind))
      .map((n) => ({ kind: n.kind, message: String(n.message ?? "").slice(0, 300) }));
  } catch {
    return [];
  }
}
