import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { emptyMaze, type MazeData } from "@/lib/maze";
import { emptyQuiz, type QuizData } from "@/lib/quiz";
import { emptyPuzzle, type PuzzleData } from "@/lib/puzzle";
import { emptyArcade, type ArcadeData } from "@/lib/arcade";
import { emptyCourse, type CourseData } from "@/lib/course";
import { emptyPlateforme, type PlateformeData } from "@/lib/plateforme";
import { emptyRunner, type RunnerData } from "@/lib/runner";
import { emptyMusique, type MusiqueData } from "@/lib/musique";
import { emptyCalcul, type CalculData } from "@/lib/calcul";
import { emptyPetitBac, type PetitBacData } from "@/lib/petitBac";
import { emptyDevinettes, type DevinettesData } from "@/lib/devinettes";
import MazeEditor from "@/components/MazeEditor";
import QuizEditor from "@/components/QuizEditor";
import PuzzleEditor from "@/components/PuzzleEditor";
import ArcadeEditor from "@/components/ArcadeEditor";
import CourseEditor from "@/components/CourseEditor";
import PlateformeEditor from "@/components/PlateformeEditor";
import RunnerEditor from "@/components/RunnerEditor";
import MusiqueEditor from "@/components/MusiqueEditor";
import CalculEditor from "@/components/CalculEditor";
import PetitBacEditor from "@/components/PetitBacEditor";
import DevinettesEditor from "@/components/DevinettesEditor";
import { type Tier } from "@/lib/tiers";

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
  | PetitBacData
  | DevinettesData;

export default async function EditeurJeuPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data: game } = await supabase
    .from("games")
    .select(
      "id, title, description, data, gradient, emoji, cover_url, multiplayer_mode, category, author_id",
    )
    .eq("id", id)
    .maybeSingle<{
      id: string;
      title: string;
      description: string;
      data: AnyData;
      gradient: string;
      emoji: string;
      cover_url: string | null;
      multiplayer_mode: boolean;
      category: string;
      author_id: string;
    }>();

  if (!game || game.author_id !== user.id) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();
  const tier = (profile?.tier as Tier) ?? "free";

  const common = {
    gameId: game.id,
    initialTitle: game.title,
    initialDescription: game.description,
    initialGradient: game.gradient,
    initialEmoji: game.emoji,
    initialCoverUrl: game.cover_url,
    initialMultiplayerMode: game.multiplayer_mode,
    tier,
    error,
  };

  if (game.category === "Quiz") {
    const data =
      game.data && typeof game.data === "object" && "questions" in game.data
        ? (game.data as QuizData)
        : emptyQuiz();
    return <QuizEditor {...common} initialData={data} />;
  }

  if (game.category === "Puzzle") {
    const data =
      game.data && typeof game.data === "object" && "symbols" in game.data
        ? (game.data as PuzzleData)
        : emptyPuzzle();
    return <PuzzleEditor {...common} initialData={data} />;
  }

  if (game.category === "Arcade") {
    const data =
      game.data && typeof game.data === "object" && "targetEmoji" in game.data
        ? (game.data as ArcadeData)
        : emptyArcade();
    return <ArcadeEditor {...common} initialData={data} />;
  }

  if (game.category === "Course") {
    const data =
      game.data && typeof game.data === "object" && "rounds" in game.data
        ? (game.data as CourseData)
        : emptyCourse();
    return <CourseEditor {...common} initialData={data} />;
  }

  if (game.category === "Plateforme") {
    const data =
      game.data && typeof game.data === "object" && "platforms" in game.data
        ? (game.data as PlateformeData)
        : emptyPlateforme();
    return <PlateformeEditor {...common} initialData={data} />;
  }

  if (game.category === "Runner") {
    const data =
      game.data && typeof game.data === "object" && "obstacles" in game.data
        ? (game.data as RunnerData)
        : emptyRunner();
    return <RunnerEditor {...common} initialData={data} />;
  }

  if (game.category === "Musique") {
    const data =
      game.data && typeof game.data === "object" && "notes" in game.data
        ? (game.data as MusiqueData)
        : emptyMusique();
    return <MusiqueEditor {...common} initialData={data} />;
  }

  if (game.category === "Calcul Mental") {
    const data =
      game.data && typeof game.data === "object" && "operations" in game.data
        ? (game.data as CalculData)
        : emptyCalcul();
    return <CalculEditor {...common} initialData={data} />;
  }

  if (game.category === "Petit Bac") {
    const data =
      game.data && typeof game.data === "object" && "categories" in game.data
        ? (game.data as PetitBacData)
        : emptyPetitBac();
    return <PetitBacEditor {...common} initialData={data} />;
  }

  if (game.category === "Devinettes") {
    const data =
      game.data && typeof game.data === "object" && "rounds" in game.data
        ? (game.data as DevinettesData)
        : emptyDevinettes();
    return <DevinettesEditor {...common} initialData={data} />;
  }

  const data =
    game.data && typeof game.data === "object" && "walls" in game.data
      ? (game.data as MazeData)
      : emptyMaze();
  return <MazeEditor {...common} initialData={data} />;
}
