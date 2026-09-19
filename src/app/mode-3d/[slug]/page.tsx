import { notFound } from "next/navigation";
import { getGame3D } from "@/lib/games3d";
import LabyrintheGame from "@/components/LabyrintheGame";
import HorrorGame from "@/components/HorrorGame";
import DuelGame from "@/components/DuelGame";
import BackroomsGame from "@/components/BackroomsGame";
import CubesGame from "@/components/CubesGame";
import Game3DFrame from "@/components/Game3DFrame";
import { createClient } from "@/lib/supabase/server";
import { enabledCheatGames } from "@/lib/admin";

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
  // Ils n'apparaissent en jeu que si l'admin les a actives dans le panneau
  // admin (onglet « Triches en jeu »). Le pseudo sert de nom dans les
  // groupes des Backrooms.
  const cheatsOn = (await enabledCheatGames()).some((g) => g === slug);
  let devAllowed = false;
  let pseudo: string | null = null;
  if (slug === "manoir-maudit" || slug === "backrooms" || slug === "duel-1v1") {
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
      devAllowed = profile?.is_admin === true && cheatsOn;
      pseudo = profile?.pseudo ?? null;
    }
  }

  return (
    <Game3DFrame>
      {slug === "cubes" && <CubesGame title={title} />}
      {slug === "labyrinthe-legendaire" && <LabyrintheGame title={title} />}
      {slug === "manoir-maudit" && <HorrorGame title={title} devAllowed={devAllowed} />}
      {slug === "duel-1v1" && <DuelGame title={title} devAllowed={devAllowed} />}
      {slug === "backrooms" && <BackroomsGame title={title} pseudo={pseudo} devAllowed={devAllowed} />}
    </Game3DFrame>
  );
}
