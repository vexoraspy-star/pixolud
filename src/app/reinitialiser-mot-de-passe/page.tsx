import AuthCard from "@/components/AuthCard";
import { updatePassword } from "./actions";

export default async function ReinitialiserMotDePassePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthCard>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
        Choisis un nouveau mot de passe
      </h1>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}

      <form action={updatePassword} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Nouveau mot de passe
          <input
            name="password"
            type="password"
            placeholder="8 caractères minimum"
            required
            minLength={8}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-normal text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          />
        </label>
        <button
          type="submit"
          className="mt-2 rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
        >
          Mettre à jour le mot de passe
        </button>
      </form>
    </AuthCard>
  );
}
