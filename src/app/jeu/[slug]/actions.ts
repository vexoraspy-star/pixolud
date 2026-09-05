"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const MIN_SECONDS_BETWEEN_COMMENTS = 20;

export async function postComment(formData: FormData) {
  const gameId = String(formData.get("gameId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const text = String(formData.get("text") ?? "").trim();

  if (!gameId || !slug || !text) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: lastComment } = await supabase
    .from("comments")
    .select("created_at")
    .eq("author_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastComment) {
    const secondsSinceLast =
      (Date.now() - new Date(lastComment.created_at).getTime()) / 1000;
    if (secondsSinceLast < MIN_SECONDS_BETWEEN_COMMENTS) {
      redirect(
        `/jeu/${slug}?error=${encodeURIComponent(
          "Attends un peu avant de reposter un commentaire.",
        )}`,
      );
    }
  }

  await supabase.from("comments").insert({
    game_id: gameId,
    author_id: user.id,
    text,
  });

  revalidatePath("/jeu", "layout");
  redirect(`/jeu/${slug}`);
}

export async function rateGame(gameId: string, slug: string, stars: number) {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("ratings")
    .upsert(
      { game_id: gameId, user_id: user.id, stars },
      { onConflict: "game_id,user_id" },
    );

  revalidatePath(`/jeu/${slug}`);
  revalidatePath("/catalogue");
  revalidatePath("/");
}

export async function deleteComment(formData: FormData) {
  const commentId = String(formData.get("commentId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!commentId || !slug) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // La policy RLS "Un utilisateur peut supprimer son propre commentaire"
  // empêche déjà de supprimer le commentaire d'un autre ; ce filtre est une
  // double sécurité explicite.
  await supabase.from("comments").delete().eq("id", commentId).eq("author_id", user.id);

  revalidatePath("/jeu", "layout");
  redirect(`/jeu/${slug}`);
}
