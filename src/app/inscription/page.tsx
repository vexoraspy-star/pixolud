import Link from "next/link";
import AuthCard from "@/components/AuthCard";
import { translate } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { signup } from "./actions";

export default async function InscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);

  return (
    <AuthCard>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
        {t("auth.signupTitle")}
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {t("auth.signupSubtitle")}
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}

      <form action={signup} className="mt-8 flex flex-col gap-4">
        <Field label={t("auth.pseudo")} name="pseudo" type="text" placeholder={t("auth.pseudoPlaceholder")} />
        <Field label={t("auth.email")} name="email" type="email" placeholder="toi@exemple.com" />
        <Field
          label={t("auth.password")}
          name="password"
          type="password"
          placeholder={t("auth.passwordPlaceholder")}
          minLength={8}
        />

        <label className="mt-2 flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-300">
          <input
            type="checkbox"
            name="accept-cgu"
            required
            className="mt-0.5 size-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
          />
          <span>
            {t("auth.acceptCguPrefix")}{" "}
            <Link href="/cgu" className="font-medium text-violet-600 hover:underline">
              {t("auth.cguLink")}
            </Link>{" "}
            {t("auth.and")}{" "}
            <Link
              href="/confidentialite"
              className="font-medium text-violet-600 hover:underline"
            >
              {t("auth.privacyLink")}
            </Link>
            .
          </span>
        </label>

        <button
          type="submit"
          className="mt-2 rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
        >
          {t("auth.signupButton")}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        {t("auth.haveAccount")}{" "}
        <Link href="/connexion" className="font-medium text-violet-600 hover:underline">
          {t("auth.loginTitle")}
        </Link>
      </p>
    </AuthCard>
  );
}

function Field({
  label,
  name,
  type,
  placeholder,
  minLength,
}: {
  label: string;
  name: string;
  type: string;
  placeholder: string;
  minLength?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-200">
      {label}
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required
        minLength={minLength}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-normal text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
      />
    </label>
  );
}
