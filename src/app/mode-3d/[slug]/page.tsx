import { notFound } from "next/navigation";
import { getGame3D } from "@/lib/games3d";
import LabyrintheGame from "@/components/LabyrintheGame";
import HorrorGame from "@/components/HorrorGame";
import DuelGame from "@/components/DuelGame";
import Game3DFrame from "@/components/Game3DFrame";
import { createClient } from "@/lib/supabase/server";

export default async function Play3DPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = getGame3D(slug);
  // Un jeu annonce mais pas encore construit reste inaccessible, meme en
  // tapant son adresse a la main.
  if (!game || game.locked) notFound();

  const title = `${game.emoji} ${game.title}`;

  // Outils de developpement (vol, invincibilite, traversee des murs) :
  // reserves aux comptes admin. Le drapeau est lu cote serveur, sur le profil
  // de la personne connectee — jamais pris d'un parametre d'URL ou du client.
  let devAllowed = false;
  if (slug === "manoir-maudit") {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle<{ is_admin: boolean | null }>();
      devAllowed = profile?.is_admin === true;
    }
  }

  return (
    <Game3DFrame>
      {slug === "labyrinthe-legendaire" && <LabyrintheGame title={title} />}
      {slug === "manoir-maudit" && <HorrorGame title={title} devAllowed={devAllowed} />}
      {slug === "duel-1v1" && <DuelGame title={title} />}
    </Game3DFrame>
  );
}
