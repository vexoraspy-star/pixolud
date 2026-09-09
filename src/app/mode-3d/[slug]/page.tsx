import { notFound } from "next/navigation";
import { getGame3D, getMaze3DData } from "@/lib/games3d";
import MazePlayer3D from "@/components/MazePlayer3D";

export default async function Play3DPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = getGame3D(slug);
  const data = getMaze3DData(slug);
  if (!game || !data) notFound();

  return (
    <div className="h-[calc(100vh-4rem)] bg-black">
      <MazePlayer3D data={data} backHref="/mode-3d" title={`${game.emoji} ${game.title}`} />
    </div>
  );
}
