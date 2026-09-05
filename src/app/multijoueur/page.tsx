import { createClient } from "@/lib/supabase/server";
import ArenaGame from "@/components/ArenaGame";

export default async function MultijoueurPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let pseudo = "";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("pseudo")
      .eq("id", user.id)
      .single();
    pseudo = profile?.pseudo ?? "";
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <ArenaGame initialPseudo={pseudo} />
    </div>
  );
}
