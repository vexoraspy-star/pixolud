import type { Metadata } from "next";

// Page de service : utile une fois connecte, sans interet dans un moteur
// de recherche. `index: false` evite qu'elle sorte a la place du catalogue.
export const metadata: Metadata = {
  title: "Mon atelier — Pixolud",
  description: "Tes jeux en cours et tes brouillons.",
  robots: { index: false, follow: true },
};

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { createDraft, deleteDraft } from "./actions";
import { MODELES } from "@/lib/modeles";

const NEW_GAME_BUTTONS = [
  { type: "Labyrinthe", emoji: "🌀" },
  { type: "Quiz", emoji: "🧠" },
  { type: "Puzzle", emoji: "🧩" },
  { type: "Arcade", emoji: "🎯" },
  { type: "Course", emoji: "🏁" },
  { type: "Plateforme", emoji: "🎮" },
  { type: "Runner", emoji: "🦔" },
  { type: "Musique", emoji: "🎵" },
  { type: "Mélodie", emoji: "🎶" },
  { type: "Calcul Mental", emoji: "🧮" },
  { type: "Petit Bac", emoji: "📝" },
  { type: "Devinettes", emoji: "🔍" },
  { type: "Mots Mêlés", emoji: "🔤" },
  { type: "Éducation", emoji: "🎓" },
  { type: "Python", emoji: "🐍" },
  { type: "Game Script", emoji: "⌨️" },
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
    <div className="studio-page mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="eyebrow"><span />LE STUDIO PIXOLUD</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Ton atelier de création
        </h1>
        <Link href="/game-script" className="rounded-full bg-gradient-to-r from-zinc-700 to-violet-700 px-4 py-2 text-sm font-bold text-white hover:opacity-90">
          ⌨️ Mode Game Script
        </Link>
        <div className="editor-create">
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

      {/* Partir d'un exemple complet plutot que d'une page blanche. */}
      <section className="mt-8" aria-labelledby="modeles-titre">
        <h2 id="modeles-titre" className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          Ou pars d&apos;un exemple tout prêt, puis change ce que tu veux
        </h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {MODELES.map((m) => (
            <li key={m.id}>
              <form action={createDraft} className="h-full">
                <input type="hidden" name="type" value={m.type} />
                <input type="hidden" name="modele" value={m.id} />
                <button
                  type="submit"
                  className="flex h-full w-full items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-left transition hover:border-violet-400 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <span className="text-2xl" aria-hidden="true">
                    {m.emoji}
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-white">{m.titre}</span>
                    <span className="text-xs text-violet-600 dark:text-violet-400">{m.type}</span>
                    <span className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{m.description}</span>
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

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
