import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase avec la cle secrete : il passe outre toutes les regles
 * RLS et peut gerer les comptes (bannir, confirmer un e-mail, supprimer).
 *
 * A n'utiliser QUE dans du code serveur, APRES avoir verifie que la personne
 * connectee est admin (voir requireAdmin dans lib/admin.ts). La cle ne doit
 * jamais partir vers le navigateur : elle n'a pas le prefixe NEXT_PUBLIC_.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("Le client admin ne s'utilise que cote serveur.");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_SECRET_KEY manquante sur le serveur.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
