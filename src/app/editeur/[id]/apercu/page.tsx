import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { emptyMaze, isMazePlayable, type MazeData } from "@/lib/maze";
import { emptyQuiz, isQuizPlayable, type QuizData } from "@/lib/quiz";
import { emptyPuzzle, isPuzzlePlayable, type PuzzleData } from "@/lib/puzzle";
import { emptyArcade, isArcadePlayable, type ArcadeData } from "@/lib/arcade";
import { emptyCourse, isCoursePlayable, type CourseData } from "@/lib/course";
import { emptyPlateforme, isPlateformePlayable, type PlateformeData } from "@/lib/plateforme";
import { emptyRunner, isRunnerPlayable, type RunnerData } from "@/lib/runner";
import { emptyMusique, isMusiquePlayable, type MusiqueData } from "@/lib/musique";
import { emptyCalcul, isCalculPlayable, type CalculData } from "@/lib/calcul";
import { emptyPetitBac, isPetitBacPlayable, type PetitBacData } from "@/lib/petitBac";
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

export default async function ApercuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data: game } = await supabase
    .from("games")
    .select("id, title, data, category, author_id")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      title: string;
      data: AnyData;
      category: string;
      author_id: string;
    }>();

  if (!game || game.author_id !== user.id) notFound();

  let player: React.ReactNode = null;
  let playable = false;
  let emptyMessage = "";

  switch (game.category) {
    case "Quiz": {
      const data =
        game.data && typeof game.data === "object" && "questions" in game.data
          ? (game.data as QuizData)
          : emptyQuiz();
      playable = isQuizPlayable(data);
      player = <QuizPlayer data={data} />;
      emptyMessage = "Ajoute au moins une question complète pour pouvoir tester ton quiz.";
      break;
    }
    case "Puzzle": {
      const data =
        game.data && typeof game.data === "object" && "symbols" in game.data
          ? (game.data as PuzzleData)
          : emptyPuzzle();
      playable = isPuzzlePlayable(data);
      player = <PuzzlePlayer data={data} />;
      emptyMessage = "Choisis entre 3 et 8 symboles pour pouvoir tester.";
      break;
    }
    case "Arcade": {
      const data =
        game.data && typeof game.data === "object" && "targetEmoji" in game.data
          ? (game.data as ArcadeData)
          : emptyArcade();
      playable = isArcadePlayable(data);
      player = <ArcadePlayer data={data} />;
      emptyMessage = "Configure une durée et une cible pour pouvoir tester.";
      break;
    }
    case "Course": {
      const data =
        game.data && typeof game.data === "object" && "rounds" in game.data
          ? (game.data as CourseData)
          : emptyCourse();
      playable = isCoursePlayable(data);
      player = <CoursePlayer data={data} />;
      emptyMessage = "Choisis un nombre de manches pour pouvoir tester.";
      break;
    }
    case "Plateforme": {
      const data =
        game.data && typeof game.data === "object" && "platforms" in game.data
          ? (game.data as PlateformeData)
          : emptyPlateforme();
      playable = isPlateformePlayable(data);
      player = <PlateformePlayer data={data} />;
      emptyMessage = "Place au moins une plateforme, un départ et une arrivée.";
      break;
    }
    case "Runner": {
      const data =
        game.data && typeof game.data === "object" && "obstacles" in game.data
          ? (game.data as RunnerData)
          : emptyRunner();
      playable = isRunnerPlayable(data);
      player = <RunnerPlayer data={data} />;
      emptyMessage = "Configure la longueur du parcours pour pouvoir tester.";
      break;
    }
    case "Musique": {
      const data =
        game.data && typeof game.data === "object" && "notes" in game.data
          ? (game.data as MusiqueData)
          : emptyMusique();
      playable = isMusiquePlayable(data);
      player = <MusiquePlayer data={data} />;
      emptyMessage = "Place au moins une note pour pouvoir tester ton morceau.";
      break;
    }
    case "Calcul Mental": {
      const data =
        game.data && typeof game.data === "object" && "operations" in game.data
          ? (game.data as CalculData)
          : emptyCalcul();
      playable = isCalculPlayable(data);
      player = <CalculPlayer data={data} />;
      emptyMessage = "Choisis au moins une opération pour pouvoir tester.";
      break;
    }
    case "Petit Bac": {
      const data =
        game.data && typeof game.data === "object" && "categories" in game.data
          ? (game.data as PetitBacData)
          : emptyPetitBac();
      playable = isPetitBacPlayable(data);
      player = <PetitBacPlayer data={data} />;
      emptyMessage = "Ajoute au moins 2 catégories pour pouvoir tester.";
      break;
    }
    default: {
      const data =
        game.data && typeof game.data === "object" && "walls" in game.data
          ? (game.data as MazeData)
          : emptyMaze();
      playable = isMazePlayable(data);
      player = <MazePlayer data={data} />;
      emptyMessage = "Place un départ et une arrivée pour pouvoir tester ton labyrinthe.";
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-10 sm:px-6">
      <Link
        href={`/editeur/${id}`}
        className="mb-6 self-start text-sm text-zinc-400 hover:text-violet-600"
      >
        ← Retour à l&apos;éditeur
      </Link>
      <h1 className="mb-4 text-xl font-bold text-zinc-900 dark:text-white">
        Aperçu · {game.title}
      </h1>
      {playable ? player : <p className="text-sm text-zinc-400">{emptyMessage}</p>}
    </div>
  );
}
