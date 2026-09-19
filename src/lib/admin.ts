import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * Le droit admin se lit TOUJOURS cote serveur, sur le profil de la personne
 * connectee — jamais depuis un parametre d'URL ou le navigateur.
 */
export async function currentAdmin(): Promise<{ id: string; pseudo: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("is_admin, pseudo")
    .eq("id", user.id)
    .maybeSingle<{ is_admin: boolean | null; pseudo: string | null }>();
  if (data?.is_admin !== true) return null;
  return { id: user.id, pseudo: data.pseudo ?? "admin" };
}

/** Pour une page : un non-admin voit une page introuvable, rien de plus. */
export async function requireAdmin(): Promise<{ id: string; pseudo: string }> {
  const admin = await currentAdmin();
  if (!admin) notFound();
  return admin;
}

/**
 * Triches des jeux (modes dev du Manoir et des Backrooms, mode admin du
 * Duel) : elles ne s'affichent en jeu que si l'admin les a activees depuis
 * le panneau. Le reglage vit dans un cookie de CE navigateur ; il ne donne
 * rien a un non-admin, le droit admin etant verifie a part.
 */
export const CHEAT_GAMES = [
  { slug: "manoir-maudit", label: "Le Manoir Maudit", hint: "Vol, traverser les murs, invincible, figer la chose, vitesse ×3, choix de l'étape" },
  { slug: "backrooms", label: "Backrooms", hint: "Vol, traverser les murs, invincible, lucidité et pile infinies, figer l'entité, choix du niveau" },
  { slug: "duel-1v1", label: "Duel — Arène de tir", hint: "Touche F2 en solo : aimbot, x-ray, invincible, munitions infinies, vitesse, traverser les murs…" },
] as const;

export type CheatGame = (typeof CHEAT_GAMES)[number]["slug"];

export const CHEAT_COOKIE = "pixolud_triches";

export async function enabledCheatGames(): Promise<CheatGame[]> {
  const raw = (await cookies()).get(CHEAT_COOKIE)?.value ?? "";
  const known = new Set<string>(CHEAT_GAMES.map((g) => g.slug));
  return raw.split(",").filter((s): s is CheatGame => known.has(s));
}
