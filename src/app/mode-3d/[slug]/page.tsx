import Link from "next/link";
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
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-black">
      <div className="flex shrink-0 items-center justify-between px-3 py-1.5">
        <Link
          href="/mode-3d"
          className="text-xs text-zinc-400 hover:text-violet-400 sm:text-sm"
        >
          ← Retour au Mode 3D
        </Link>
        <h1 className="text-xs font-bold text-white sm:text-sm">
          {game.emoji} {game.title}
        </h1>
      </div>
      <div className="min-h-0 flex-1">
        <MazePlayer3D data={data} />
      </div>
    </div>
  );
}
