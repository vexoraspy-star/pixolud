"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface Gift {
  kind: "pieces" | "xp" | "tout";
  amount: number;
  message: string;
}

/**
 * Les cadeaux de l'equipe en attente pour la personne connectee. Ils sont
 * marques « recus » dans la meme requete : un cadeau ne se recoit qu'une
 * fois, meme si deux onglets s'ouvrent en meme temps.
 */
export async function claimMyGifts(): Promise<Gift[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !process.env.SUPABASE_SECRET_KEY) return [];
    const db = createAdminClient();
    const { data } = await db
      .from("admin_gifts")
      .update({ claimed_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("game", "duel")
      .is("claimed_at", null)
      .select("kind, amount, message");
    return (data ?? [])
      .filter((g): g is Gift => g.kind === "pieces" || g.kind === "xp" || g.kind === "tout")
      .map((g) => ({ kind: g.kind, amount: Math.max(0, Math.min(1_000_000, Number(g.amount) || 0)), message: String(g.message ?? "").slice(0, 200) }));
  } catch {
    return [];
  }
}
