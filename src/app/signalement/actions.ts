"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function submitReport(formData: FormData) {
  const gameSlug = String(formData.get("gameSlug") ?? "");
  const reason = String(formData.get("motif") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();

  if (!reason) {
    redirect(
      `/signalement?jeu=${encodeURIComponent(gameSlug)}&error=Choisis un motif`,
    );
  }

  const supabase = await createClient();

  let gameId: string | null = null;
  if (gameSlug) {
    const { data: game } = await supabase
      .from("games")
      .select("id")
      .eq("slug", gameSlug)
      .maybeSingle();
    gameId = game?.id ?? null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("reports").insert({
    reporter_id: user?.id ?? null,
    game_id: gameId,
    reason,
    details,
  });

  redirect("/signalement/merci");
}
