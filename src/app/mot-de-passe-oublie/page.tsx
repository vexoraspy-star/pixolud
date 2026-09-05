import Link from "next/link";
import AuthCard from "@/components/AuthCard";
import { requestPasswordReset } from "./actions";

export default async function MotDePasseOubliePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthCard>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
        Mot de passe oublié
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Indique ton adresse email, on t&apos;enverra un lien de
        réinitialisation.
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}

      <form action={requestPasswordReset} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Adresse email
          <input
            name="email"
            type="email"
            placeholder="toi@exemple.com"
            required
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-normal text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          />
        </label>
        <button
          type="submit"
          className="mt-2 rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
        >
          Envoyer le lien de réinitialisation
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/connexion" className="font-medium text-violet-600 hover:underline">
          ← Retour à la connexion
        </Link>
      </p>
    </AuthCard>
  );
}
