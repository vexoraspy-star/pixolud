"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Les favoris d'un joueur.
 *
 * Les regles de la base font le travail : on ne peut ajouter, lire ou
 * supprimer que ses propres favoris (supabase/add_favoris.sql). Ces actions
 * n'ont donc pas a verifier a qui appartient quoi.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MANQUE = "Les favoris ne sont pas encore activés : lance supabase/add_favoris.sql dans Supabase.";

function absent(message: string) {
  return /relation|schema cache|does not exist/i.test(message);
}

export interface FavoriResult {
  ok: boolean;
  /** L'etat apres l'action : vrai = c'est un favori. */
  favori: boolean;
  message: string;
}

/** Mettre ou enlever un jeu de ses favoris. */
export async function basculerFavori(gameId: string, actuel: boolean): Promise<FavoriResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, favori: actuel, message: "Connecte-toi pour garder tes jeux préférés." };
  if (!UUID_RE.test(gameId)) return { ok: false, favori: actuel, message: "Jeu introuvable." };

  if (actuel) {
    const { error } = await supabase.from("favorites").delete().eq("game_id", gameId).eq("user_id", user.id);
    if (error) return { ok: false, favori: true, message: absent(error.message) ? MANQUE : "Impossible." };
    revalidatePath("/favoris");
    return { ok: true, favori: false, message: "Retiré de tes favoris." };
  }

  const { error } = await supabase.from("favorites").insert({ game_id: gameId, user_id: user.id });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { ok: true, favori: true, message: "Déjà dans tes favoris." };
    return { ok: false, favori: false, message: absent(error.message) ? MANQUE : "Impossible." };
  }
  revalidatePath("/favoris");
  return { ok: true, favori: true, message: "★ Ajouté à tes favoris." };
}

/** Les identifiants de jeux mis en favori, pour cocher les cœurs d'une liste. */
export async function mesFavoris(): Promise<string[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from("favorites").select("game_id").eq("user_id", user.id);
  return (data ?? []).map((f) => String(f.game_id));
}
