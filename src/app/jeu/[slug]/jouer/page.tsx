import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isMazePlayable, type MazeData } from "@/lib/maze";
import { isQuizPlayable, type QuizData } from "@/lib/quiz";
import { isPuzzlePlayable, type PuzzleData } from "@/lib/puzzle";
import { isArcadePlayable, type ArcadeData } from "@/lib/arcade";
import { isCoursePlayable, type CourseData } from "@/lib/course";
import { isPlateformePlayable, type PlateformeData } from "@/lib/plateforme";
import { isRunnerPlayable, type RunnerData } from "@/lib/runner";
import { isMusiquePlayable, type MusiqueData } from "@/lib/musique";
import { isCalculPlayable, type CalculData } from "@/lib/calcul";
import { isPetitBacPlayable, type PetitBacData } from "@/lib/petitBac";
import MazePlayer from "@/components/MazePlayer";
import QuizPlayer from "@/components/QuizPlayer";
import PuzzlePlayer from "@/components/PuzzlePlayer";
import ArcadePlayer from "@/components/ArcadePlayer";
import CoursePlayer from "@/components/CoursePlayer";
import PlateformePlayer from "@/components/PlateformePlayer";
import RunnerPlayer from "@/components/RunnerPlayer";
import MusiquePlayer from "@/components/MusiquePlayer";
import CalculPlayer from "@/components/CalculPlayer";
import PetitBacPlayer from "@/components/PetitBacPlayer";
import PartyLobby from "@/components/PartyLobby";

type AnyData =
  | MazeData
  | QuizData
  | PuzzleData
  | ArcadeData
  | CourseData
  | PlateformeData
  | RunnerData
  | MusiqueData
  | CalculData
  | PetitBacData;

export default async function PlayGamePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ party?: string }>;
}) {
  const { slug } = await params;
  const { party } = await searchParams;

  const supabase = await createClient();
  const { data: game } = await supabase
    .from("games")
    .select("id, slug, title, category, gradient, emoji, data, multiplayer_mode")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle<{
      id: string;
      slug: string;
      title: string;
      category: string;
      gradient: string;
      emoji: string;
      data: AnyData;
      multiplayer_mode: boolean;
    }>();

  if (!game) notFound();

  let pseudo: string | null = null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("pseudo")
      .eq("id", user.id)
      .single();
    pseudo = profile?.pseudo ?? null;
  }

  let player: React.ReactNode = null;

  if (game.category === "Labyrinthe" && isMazePlayable(game.data as MazeData)) {
    player = <MazePlayer data={game.data as MazeData} gameId={game.id} countsAsPlay />;
  } else if (game.category === "Quiz" && isQuizPlayable(game.data as QuizData)) {
    player = <QuizPlayer data={game.data as QuizData} gameId={game.id} countsAsPlay />;
  } else if (game.category === "Puzzle" && isPuzzlePlayable(game.data as PuzzleData)) {
    player = <PuzzlePlayer data={game.data as PuzzleData} gameId={game.id} countsAsPlay />;
  } else if (game.category === "Arcade" && isArcadePlayable(game.data as ArcadeData)) {
    player = <ArcadePlayer data={game.data as ArcadeData} gameId={game.id} countsAsPlay />;
  } else if (game.category === "Course" && isCoursePlayable(game.data as CourseData)) {
    player = <CoursePlayer data={game.data as CourseData} gameId={game.id} countsAsPlay />;
  } else if (
    game.category === "Plateforme" &&
    isPlateformePlayable(game.data as PlateformeData)
  ) {
    player = (
      <PlateformePlayer data={game.data as PlateformeData} gameId={game.id} countsAsPlay />
    );
  } else if (game.category === "Runner" && isRunnerPlayable(game.data as RunnerData)) {
    player = <RunnerPlayer data={game.data as RunnerData} gameId={game.id} countsAsPlay />;
  } else if (game.category === "Musique" && isMusiquePlayable(game.data as MusiqueData)) {
    player = <MusiquePlayer data={game.data as MusiqueData} gameId={game.id} countsAsPlay />;
  } else if (game.category === "Calcul Mental" && isCalculPlayable(game.data as CalculData)) {
    player = <CalculPlayer data={game.data as CalculData} gameId={game.id} countsAsPlay />;
  } else if (game.category === "Petit Bac" && isPetitBacPlayable(game.data as PetitBacData)) {
    player = <PetitBacPlayer data={game.data as PetitBacData} gameId={game.id} countsAsPlay />;
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center px-4 py-10 text-center sm:px-6">
      <Link
        href={`/jeu/${game.slug}`}
        className="mb-6 self-start text-sm text-zinc-400 hover:text-violet-600"
      >
        ← Retour à la page du jeu
      </Link>

      <h1 className="mb-6 text-xl font-bold text-zinc-900 dark:text-white">
        {game.title}
      </h1>

      {party && game.multiplayer_mode && (
        <PartyLobby slug={game.slug} code={party} pseudo={pseudo} />
      )}

      {player ?? (
        <div
          className={`flex aspect-video w-full max-w-2xl flex-col items-center justify-center gap-4 rounded-2xl bg-gradient-to-br text-white ${game.gradient}`}
        >
          <span className="text-6xl">{game.emoji}</span>
          <p className="max-w-sm text-sm text-white/80">
            Ce type de jeu n&apos;a pas encore de lecteur disponible.
          </p>
        </div>
      )}
    </div>
  );
}
