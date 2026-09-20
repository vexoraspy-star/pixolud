import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * « Télécharger mes données » (RGPD, droit a la portabilite) : un fichier
 * JSON avec tout ce que le site garde sur la personne connectee. Chacun ne
 * peut telecharger que ses propres donnees : la lecture passe par sa session
 * et les regles de la base.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erreur: "Connecte-toi d'abord." }, { status: 401 });

  const [profile, games, comments, ratings] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("games").select("*").eq("author_id", user.id),
    supabase.from("comments").select("*").eq("author_id", user.id),
    supabase.from("ratings").select("*").eq("user_id", user.id),
  ]);

  const dossier = {
    exporte_le: new Date().toISOString(),
    compte: {
      id: user.id,
      email: user.email,
      inscrit_le: user.created_at,
      derniere_connexion: user.last_sign_in_at,
    },
    profil: profile.data ?? null,
    mes_jeux: games.data ?? [],
    mes_commentaires: comments.data ?? [],
    mes_notes: ratings.data ?? [],
    note: "Tes sauvegardes de parties (Duel, Cubes) restent dans ton navigateur et ne figurent pas ici.",
  };

  return new NextResponse(JSON.stringify(dossier, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="mes-donnees-pixolud.json"`,
      "cache-control": "no-store",
    },
  });
}
