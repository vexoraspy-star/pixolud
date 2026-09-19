import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface SessionProfile {
  id: string;
  pseudo: string | null;
  tier: string | null;
  isAdmin: boolean;
  /** Bannissement en cours (colonnes du fichier supabase/add_admin_panel.sql). */
  ban: { reason: string; until: string } | null;
}

/**
 * La personne connectee et son profil, lus UNE fois par requete : l'en-tete
 * et la verification du bannissement s'en servent tous les deux.
 */
export const getSessionProfile = cache(async (): Promise<SessionProfile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle<Record<string, unknown>>();
  const until = typeof data?.banned_until === "string" ? data.banned_until : "";
  const banned = data?.banned === true && (!until || Date.parse(until) > Date.now());
  return {
    id: user.id,
    pseudo: typeof data?.pseudo === "string" ? data.pseudo : null,
    tier: typeof data?.tier === "string" ? data.tier : null,
    isAdmin: data?.is_admin === true,
    ban: banned ? { reason: typeof data?.ban_reason === "string" ? data.ban_reason : "", until } : null,
  };
});
