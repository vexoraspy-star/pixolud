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
    <div className="min-h-[calc(100vh-8rem)] bg-black px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col items-center">
        <Link
          href="/mode-3d"
          className="mb-6 self-start text-sm text-zinc-400 hover:text-violet-400"
        >
          ← Retour au Mode 3D
        </Link>
        <h1 className="mb-6 text-xl font-bold text-white">
          {game.emoji} {game.title}
        </h1>
        <MazePlayer3D data={data} />
      </div>
    </div>
  );
}
