import Link from "next/link";
import { GAMES_3D } from "@/lib/games3d";

export default function Mode3DPage() {
  return (
    <div className="min-h-[calc(100vh-8rem)] bg-gradient-to-b from-zinc-950 to-black px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <span className="text-4xl">🧊</span>
          <h1 className="mt-3 text-3xl font-extrabold text-white">Mode 3D</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">
            Des jeux en vraie 3D à parcourir en vue à la première personne. Une
            sélection préparée par l&apos;équipe Pixolud, avec de nouveaux jeux
            ajoutés régulièrement.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {GAMES_3D.map((game) => (
            <Link
              key={game.slug}
              href={`/mode-3d/${game.slug}`}
              className="group flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 transition hover:-translate-y-1 hover:border-violet-500 hover:shadow-lg hover:shadow-violet-900/30"
            >
              <div
                className={`flex h-32 items-center justify-center bg-gradient-to-br text-5xl ${game.gradient}`}
              >
                {game.emoji}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <h3 className="text-sm font-semibold text-white group-hover:text-violet-400">
                  {game.title}
                </h3>
                <p className="line-clamp-2 text-xs text-zinc-400">{game.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
