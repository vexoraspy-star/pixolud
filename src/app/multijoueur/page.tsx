import { createClient } from "@/lib/supabase/server";
import MultiplayerHub from "@/components/MultiplayerHub";
import type { Tier } from "@/lib/tiers";

export default async function MultijoueurPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let pseudo = "";
  let tier: Tier = "free";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("pseudo, tier")
      .eq("id", user.id)
      .single();
    pseudo = profile?.pseudo ?? "";
    tier = (profile?.tier as Tier) ?? "free";
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <MultiplayerHub initialPseudo={pseudo} tier={tier} />
    </div>
  );
}
