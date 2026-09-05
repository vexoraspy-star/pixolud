import { getGameBySlug } from "@/lib/games";
import { submitReport } from "./actions";

export default async function SignalementPage({
  searchParams,
}: {
  searchParams: Promise<{ jeu?: string; contexte?: string; error?: string }>;
}) {
  const { jeu, contexte, error } = await searchParams;
  const game = jeu ? await getGameBySlug(jeu) : null;

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
        Signaler un contenu
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Aide-nous à garder Pixolud sûr et respectueux en signalant tout
        contenu qui enfreint nos{" "}
        <a href="/cgu" className="font-medium text-violet-600 hover:underline">
          CGU
        </a>
        .
      </p>

      {game && !contexte && (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          Signalement concernant le jeu <strong>{game.title}</strong> (par{" "}
          {game.authorPseudo})
        </div>
      )}
      {contexte && (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          {contexte}
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}

      <form action={submitReport} className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="gameSlug" value={jeu ?? ""} />
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Motif du signalement
          <select
            name="motif"
            required
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-normal text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          >
            <option value="">Sélectionner un motif</option>
            <option value="violence">Violence extrême</option>
            <option value="haine">Contenu haineux ou discriminatoire</option>
            <option value="triche">Triche</option>
            <option value="plagiat">Plagiat / droits d&apos;auteur</option>
            <option value="harcelement">Harcèlement</option>
            <option value="spam">Spam / contenu malveillant</option>
            <option value="autre">Autre</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Détails (optionnel)
          <textarea
            name="details"
            rows={4}
            defaultValue={contexte ?? ""}
            placeholder="Décris le problème rencontré..."
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-normal text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          />
        </label>

        <button
          type="submit"
          className="mt-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
        >
          Envoyer le signalement
        </button>
      </form>
    </div>
  );
}
