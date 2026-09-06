"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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
import { emptyDevinettes, isDevinettesPlayable, type DevinettesData } from "@/lib/devinettes";
import { emptyEducation, isEducationPlayable, type EducationData } from "@/lib/education";
import { TIERS, type Tier } from "@/lib/tiers";

type AnyGameData =
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
  | DevinettesData
  | EducationData;

const GAME_TYPES = {
  Labyrinthe: {
    defaultTitle: "Nouveau labyrinthe",
    gradient: "from-slate-700 to-slate-900",
    emoji: "🌀",
    emptyData: emptyMaze,
  },
  Quiz: {
    defaultTitle: "Nouveau quiz",
    gradient: "from-amber-400 to-orange-500",
    emoji: "🧠",
    emptyData: emptyQuiz,
  },
  Puzzle: {
    defaultTitle: "Nouveau puzzle",
    gradient: "from-sky-400 to-cyan-500",
    emoji: "🧩",
    emptyData: emptyPuzzle,
  },
  Arcade: {
    defaultTitle: "Nouveau jeu arcade",
    gradient: "from-emerald-400 to-teal-500",
    emoji: "🎯",
    emptyData: emptyArcade,
  },
  Course: {
    defaultTitle: "Nouveau test de réflexes",
    gradient: "from-red-500 to-rose-600",
    emoji: "🏁",
    emptyData: emptyCourse,
  },
  Plateforme: {
    defaultTitle: "Nouveau niveau",
    gradient: "from-violet-500 to-fuchsia-500",
    emoji: "🎮",
    emptyData: emptyPlateforme,
  },
  Runner: {
    defaultTitle: "Nouveau parcours",
    gradient: "from-indigo-500 to-blue-600",
    emoji: "🦔",
    emptyData: emptyRunner,
  },
  Musique: {
    defaultTitle: "Nouveau morceau",
    gradient: "from-pink-500 to-purple-600",
    emoji: "🎵",
    emptyData: emptyMusique,
  },
  "Calcul Mental": {
    defaultTitle: "Nouveau calcul mental",
    gradient: "from-lime-400 to-emerald-600",
    emoji: "🧮",
    emptyData: emptyCalcul,
  },
  "Petit Bac": {
    defaultTitle: "Nouveau petit bac",
    gradient: "from-amber-400 to-rose-500",
    emoji: "📝",
    emptyData: emptyPetitBac,
  },
  Devinettes: {
    defaultTitle: "Nouvelles devinettes",
    gradient: "from-sky-500 to-indigo-600",
    emoji: "🔍",
    emptyData: emptyDevinettes,
  },
  Éducation: {
    defaultTitle: "Nouvelle fiche de révision",
    gradient: "from-blue-600 to-violet-700",
    emoji: "🎓",
    emptyData: emptyEducation,
  },
} as const;

type GameType = keyof typeof GAME_TYPES;

function isPublishable(category: string, data: unknown): boolean {
  if (category === "Labyrinthe") return isMazePlayable(data as MazeData);
  if (category === "Quiz") return isQuizPlayable(data as QuizData);
  if (category === "Puzzle") return isPuzzlePlayable(data as PuzzleData);
  if (category === "Arcade") return isArcadePlayable(data as ArcadeData);
  if (category === "Course") return isCoursePlayable(data as CourseData);
  if (category === "Plateforme") return isPlateformePlayable(data as PlateformeData);
  if (category === "Runner") return isRunnerPlayable(data as RunnerData);
  if (category === "Musique") return isMusiquePlayable(data as MusiqueData);
  if (category === "Calcul Mental") return isCalculPlayable(data as CalculData);
  if (category === "Petit Bac") return isPetitBacPlayable(data as PetitBacData);
  if (category === "Devinettes") return isDevinettesPlayable(data as DevinettesData);
  if (category === "Éducation") return isEducationPlayable(data as EducationData);
  return false;
}

const PUBLISH_ERROR_MESSAGES: Record<string, string> = {
  Labyrinthe:
    "Place un départ et une arrivée reliés par un chemin libre (sans mur qui bloque tout) avant de publier.",
  Quiz: "Ajoute au moins une question complète (avec ses 4 réponses et la bonne cochée) avant de publier.",
  Puzzle: "Choisis entre 3 et 8 symboles avant de publier.",
  Arcade: "Configure une durée et une cible avant de publier.",
  Course: "Choisis un nombre de manches avant de publier.",
  Plateforme: "Place au moins une plateforme, un départ et une arrivée.",
  Runner:
    "Configure la longueur du parcours et laisse au moins une case libre entre deux obstacles avant de publier.",
  Musique: "Place au moins une note avant de publier.",
  "Calcul Mental": "Choisis au moins une opération avant de publier.",
  "Petit Bac": "Ajoute au moins 2 catégories non vides avant de publier.",
  Devinettes: "Ajoute au moins une devinette complète (réponse + indices) avant de publier.",
  Éducation: "Ajoute au moins une question complète avant de publier.",
};

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "jeu"}-${suffix}`;
}

export async function createDraft(formData: FormData) {
  const typeInput = String(formData.get("type") ?? "Labyrinthe");
  const type: GameType = typeInput in GAME_TYPES ? (typeInput as GameType) : "Labyrinthe";
  const config = GAME_TYPES[type];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();
  const isBig = TIERS[(profile?.tier as Tier) ?? "free"].bigBoards;

  let data: AnyGameData = config.emptyData();
  if (isBig && type === "Labyrinthe") data = emptyMaze(true);
  if (isBig && type === "Plateforme") data = emptyPlateforme(true);

  const { data: game, error } = await supabase
    .from("games")
    .insert({
      title: config.defaultTitle,
      slug: slugify(config.defaultTitle),
      description: "",
      category: type,
      author_id: user.id,
      gradient: config.gradient,
      emoji: config.emoji,
      published: false,
      data,
    })
    .select("id")
    .single();

  if (error || !game) {
    redirect("/editeur?error=Impossible de créer le brouillon");
  }

  redirect(`/editeur/${game.id}`);
}

export async function saveGame(
  gameId: string,
  values: {
    title: string;
    description: string;
    data: AnyGameData;
    gradient: string;
    emoji: string;
    coverUrl: string | null;
    multiplayerMode: boolean;
  },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const };

  const { error } = await supabase
    .from("games")
    .update({
      title: values.title.slice(0, 80) || "Sans titre",
      description: values.description.slice(0, 500),
      data: values.data,
      gradient: values.gradient,
      emoji: values.emoji,
      cover_url: values.coverUrl,
      multiplayer_mode: values.multiplayerMode,
      updated_at: new Date().toISOString(),
    })
    .eq("id", gameId)
    .eq("author_id", user.id);

  return { ok: !error };
}

export async function publishGame(formData: FormData) {
  const gameId = String(formData.get("gameId") ?? "");
  if (!gameId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data: game } = await supabase
    .from("games")
    .select("data, slug, category")
    .eq("id", gameId)
    .eq("author_id", user.id)
    .maybeSingle<{ data: AnyGameData; slug: string; category: string }>();

  if (!game || !isPublishable(game.category, game.data)) {
    redirect(
      `/editeur/${gameId}?error=${encodeURIComponent(
        PUBLISH_ERROR_MESSAGES[game?.category ?? ""] ??
          "Complète ton jeu avant de publier.",
      )}`,
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();
  const tier = (profile?.tier as Tier) ?? "free";

  const { count: alreadyPublished } = await supabase
    .from("games")
    .select("id", { count: "exact", head: true })
    .eq("author_id", user.id)
    .eq("published", true)
    .neq("id", gameId);

  if ((alreadyPublished ?? 0) >= TIERS[tier].maxPublishedGames) {
    redirect(
      `/editeur/${gameId}?error=${encodeURIComponent(
        `Tu as atteint la limite de ${TIERS[tier].maxPublishedGames} jeux publiés de ton palier ${TIERS[tier].label}. Passe à un palier supérieur sur la page Premium pour publier plus de jeux.`,
      )}`,
    );
  }

  await supabase
    .from("games")
    .update({ published: true })
    .eq("id", gameId)
    .eq("author_id", user.id);

  revalidatePath("/catalogue");
  revalidatePath("/");
  redirect(`/jeu/${game.slug}`);
}

export async function deleteDraft(formData: FormData) {
  const gameId = String(formData.get("gameId") ?? "");
  if (!gameId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("games").delete().eq("id", gameId).eq("author_id", user.id);

  revalidatePath("/editeur");
}
