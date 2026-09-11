import { notFound } from "next/navigation";
import { getGame3D } from "@/lib/games3d";
import LabyrintheGame from "@/components/LabyrintheGame";
import HorrorGame from "@/components/HorrorGame";
import DuelGame from "@/components/DuelGame";

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
    <div className="h-[calc(100vh-4rem)] bg-black">
      {slug === "labyrinthe-legendaire" && <LabyrintheGame title={title} />}
      {slug === "manoir-maudit" && <HorrorGame title={title} />}
      {slug === "duel-1v1" && <DuelGame title={title} />}
    </div>
  );
}
