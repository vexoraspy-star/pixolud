import AuthCard from "@/components/AuthCard";
import { translate } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { resendConfirmationEmail } from "../actions";

export default async function VerifieTonEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; resent?: string; resendError?: string }>;
}) {
  const { email, resent, resendError } = await searchParams;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);

  return (
    <AuthCard>
      <div className="text-center">
        <span className="text-4xl">📬</span>
        <h1 className="mt-4 text-2xl font-bold text-zinc-900 dark:text-white">
          {t("auth.checkEmailTitle")}
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {t("auth.checkEmailSignup")}
        </p>

        {resent && (
          <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-400">
            {t("auth.resendEmailSent")}
          </p>
        )}
        {resendError && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
            {resendError}
          </p>
        )}

        {email && (
          <form action={resendConfirmationEmail} className="mt-6">
            <input type="hidden" name="email" value={email} />
            <button
              type="submit"
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              {t("auth.resendEmail")}
            </button>
          </form>
        )}
      </div>
    </AuthCard>
  );
}
