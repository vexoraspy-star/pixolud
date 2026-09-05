import Link from "next/link";
import AuthCard from "@/components/AuthCard";
import { translate } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { login } from "./actions";

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);

  return (
    <AuthCard>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
        {t("auth.loginTitle")}
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {t("auth.loginSubtitle")}
      </p>

      {message && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}

      <form action={login} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          {t("auth.email")}
          <input
            name="email"
            type="email"
            placeholder="toi@exemple.com"
            required
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-normal text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          {t("auth.password")}
          <input
            name="password"
            type="password"
            placeholder="••••••••"
            required
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-normal text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          />
        </label>

        <Link
          href="/mot-de-passe-oublie"
          className="-mt-2 self-end text-xs font-medium text-violet-600 hover:underline"
        >
          {t("auth.forgotPassword")}
        </Link>

        <button
          type="submit"
          className="mt-2 rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
        >
          {t("auth.loginButton")}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        {t("auth.noAccount")}{" "}
        <Link href="/inscription" className="font-medium text-violet-600 hover:underline">
          {t("auth.createAccount")}
        </Link>
      </p>
    </AuthCard>
  );
}
