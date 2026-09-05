import AuthCard from "@/components/AuthCard";
import { translate } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export default async function VerifieTonEmailPage() {
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
          {t("auth.checkEmailReset")}
        </p>
      </div>
    </AuthCard>
  );
}
