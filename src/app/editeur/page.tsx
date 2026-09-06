import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { createDraft, deleteDraft } from "./actions";

const NEW_GAME_BUTTONS = [
  { type: "Labyrinthe", emoji: "🌀" },
  { type: "Quiz", emoji: "🧠" },
  { type: "Puzzle", emoji: "🧩" },
  { type: "Arcade", emoji: "🎯" },
  { type: "Course", emoji: "🏁" },
  { type: "Plateforme", emoji: "🎮" },
  { type: "Runner", emoji: "🦔" },
  { type: "Musique", emoji: "🎵" },
  { type: "Calcul Mental", emoji: "🧮" },
  { type: "Petit Bac", emoji: "📝" },
  { type: "Devinettes", emoji: "🔍" },
] as const;

export default async function EditeurPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/connexion");

  const { data: games } = await supabase
    .from("games")
    .select("id, title, slug, category, published, updated_at")
    .eq("author_id", user.id)
    .order("updated_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Mes jeux
        </h1>
        <div className="flex flex-wrap gap-2">
          {NEW_GAME_BUTTONS.map((b) => (
            <form key={b.type} action={createDraft}>
              <input type="hidden" name="type" value={b.type} />
              <button
                type="submit"
                className="rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {b.emoji} + {b.type}
              </button>
            </form>
          ))}
        </div>
      </div>

      {games && games.length > 0 ? (
        <ul className="mt-8 flex flex-col gap-3">
          {games.map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div>
                <p className="font-medium text-zinc-900 dark:text-white">{g.title}</p>
                <p className="text-xs text-zinc-400">
                  {g.category} · {g.published ? "✅ Publié" : "📝 Brouillon"} ·
                  modifié le {new Date(g.updated_at).toLocaleDateString("fr-FR")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {g.published && (
                  <Link
                    href={`/jeu/${g.slug}`}
                    className="text-sm font-medium text-violet-600 hover:underline"
                  >
                    Voir
                  </Link>
                )}
                <Link
                  href={`/editeur/${g.id}`}
                  className="text-sm font-medium text-violet-600 hover:underline"
                >
                  Modifier
                </Link>
                <form action={deleteDraft}>
                  <input type="hidden" name="gameId" value={g.id} />
                  <ConfirmSubmitButton
                    confirmMessage={`Supprimer « ${g.title} » définitivement ? Cette action est irréversible.`}
                    className="text-sm font-medium text-red-500 hover:underline"
                  >
                    Supprimer
                  </ConfirmSubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 text-sm text-zinc-400">
          Tu n&apos;as pas encore créé de jeu. Choisis un type ci-dessus pour
          commencer.
        </p>
      )}
    </div>
  );
}
