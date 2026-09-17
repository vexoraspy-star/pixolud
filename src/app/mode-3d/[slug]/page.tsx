import { notFound } from "next/navigation";
import { getGame3D } from "@/lib/games3d";
import LabyrintheGame from "@/components/LabyrintheGame";
import HorrorGame from "@/components/HorrorGame";
import DuelGame from "@/components/DuelGame";
import BackroomsGame from "@/components/BackroomsGame";
import CubesGame from "@/components/CubesGame";
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
  // Le pseudo sert de nom dans les groupes des Backrooms.
  let devAllowed = false;
  let pseudo: string | null = null;
  if (slug === "manoir-maudit" || slug === "backrooms") {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin, pseudo")
        .eq("id", user.id)
        .maybeSingle<{ is_admin: boolean | null; pseudo: string | null }>();
      devAllowed = profile?.is_admin === true;
      pseudo = profile?.pseudo ?? null;
    }
  }

  return (
    <Game3DFrame>
      {slug === "cubes" && <CubesGame title={title} />}
      {slug === "labyrinthe-legendaire" && <LabyrintheGame title={title} />}
      {slug === "manoir-maudit" && <HorrorGame title={title} devAllowed={devAllowed} />}
      {slug === "duel-1v1" && <DuelGame title={title} />}
      {slug === "backrooms" && <BackroomsGame title={title} pseudo={pseudo} devAllowed={devAllowed} />}
    </Game3DFrame>
  );
}
