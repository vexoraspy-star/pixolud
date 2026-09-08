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
    <div className="min-h-[calc(100vh-4rem)] bg-black px-2 py-3 sm:px-4">
      <div className="mx-auto flex max-w-6xl flex-col items-center">
        <div className="mb-2 flex w-full items-center justify-between">
          <Link
            href="/mode-3d"
            className="text-sm text-zinc-400 hover:text-violet-400"
          >
            ← Retour au Mode 3D
          </Link>
          <h1 className="text-sm font-bold text-white sm:text-base">
            {game.emoji} {game.title}
          </h1>
        </div>
        <MazePlayer3D data={data} />
      </div>
    </div>
  );
}
