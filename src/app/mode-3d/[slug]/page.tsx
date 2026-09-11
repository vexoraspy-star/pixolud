import { notFound } from "next/navigation";
import { getGame3D } from "@/lib/games3d";
import LabyrintheGame from "@/components/LabyrintheGame";
import HorrorGame from "@/components/HorrorGame";
import DuelGame from "@/components/DuelGame";
import Game3DFrame from "@/components/Game3DFrame";

export default async function Play3DPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = getGame3D(slug);
  if (!game) notFound();

  const title = `${game.emoji} ${game.title}`;

  return (
    <Game3DFrame>
      {slug === "labyrinthe-legendaire" && <LabyrintheGame title={title} />}
      {slug === "manoir-maudit" && <HorrorGame title={title} />}
      {slug === "duel-1v1" && <DuelGame title={title} />}
    </Game3DFrame>
  );
}
