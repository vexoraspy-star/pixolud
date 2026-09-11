import Link from "next/link";
import { GAMES_3D, type Game3D } from "@/lib/games3d";

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "accent" }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        tone === "accent"
          ? "bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/30"
          : "bg-white/10 text-zinc-300"
      }`}
    >
      {children}
    </span>
  );
}

function GameCard({ game, big }: { game: Game3D; big: boolean }) {
  return (
    <Link
      href={`/mode-3d/${game.slug}`}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60 transition hover:-translate-y-1 hover:border-violet-500/60 hover:shadow-xl hover:shadow-violet-950/40 ${
        big ? "sm:col-span-2" : ""
      }`}
    >
      <div
        className={`relative flex items-center justify-center bg-gradient-to-br ${game.gradient} ${
          big ? "h-44" : "h-32"
        }`}
      >
        <span className={big ? "text-7xl" : "text-5xl"}>{game.emoji}</span>
        <span className="absolute left-3 top-3">
          <Badge tone="accent">{game.genre}</Badge>
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-zinc-200 backdrop-blur">
          {game.players}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3
            className={`font-bold text-white transition group-hover:text-violet-300 ${
              big ? "text-xl" : "text-base"
            }`}
          >
            {game.title}
          </h3>
          <span className="shrink-0 text-[11px] text-zinc-500">⏱ {game.duration}</span>
        </div>
        <p className={`text-xs leading-relaxed text-zinc-400 ${big ? "" : "line-clamp-3"}`}>
          {game.description}
        </p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
          {game.highlights.map((h) => (
            <Badge key={h}>{h}</Badge>
          ))}
        </div>
        <span className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-xs font-bold text-white transition group-hover:bg-violet-500">
          ▶ Jouer
        </span>
      </div>
    </Link>
  );
}

export default function Mode3DPage() {
  const featured = GAMES_3D.filter((g) => g.featured);
  const others = GAMES_3D.filter((g) => !g.featured);

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-gradient-to-b from-zinc-950 via-[#0b0812] to-black px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 text-center">
          <span className="text-4xl">🧊</span>
          <h1 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">Mode 3D</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">
            Des jeux en vraie 3D à parcourir en vue à la première personne. Une sélection préparée
            par l&apos;équipe Pixolud, avec de nouveaux jeux ajoutés régulièrement.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Badge>{GAMES_3D.length} jeux</Badge>
            <Badge>Aucune installation</Badge>
            <Badge>Manette de jeu non requise</Badge>
          </div>
        </div>

        {featured.length > 0 && (
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            {featured.map((game) => (
              <GameCard key={game.slug} game={game} big={false} />
            ))}
          </div>
        )}

        {others.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((game) => (
              <GameCard key={game.slug} game={game} big={false} />
            ))}
          </div>
        )}

        <p className="mt-10 text-center text-xs text-zinc-600">
          Ces jeux sont créés et maintenus par l&apos;équipe Pixolud. Pour créer les tiens, passe par
          l&apos;
          <Link href="/editeur" className="text-violet-400 hover:underline">
            éditeur
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
