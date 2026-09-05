import Link from "next/link";
import { translate } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export default async function Footer() {
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);

  return (
    <footer className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:text-zinc-400">
        <p>&copy; {new Date().getFullYear()} Pixolud — {t("footer.rights")}</p>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/cgu" className="hover:text-zinc-900 dark:hover:text-white">
            {t("footer.cgu")}
          </Link>
          <Link
            href="/confidentialite"
            className="hover:text-zinc-900 dark:hover:text-white"
          >
            {t("footer.privacy")}
          </Link>
          <Link
            href="/signalement"
            className="hover:text-zinc-900 dark:hover:text-white"
          >
            {t("footer.report")}
          </Link>
          <Link href="/catalogue" className="hover:text-zinc-900 dark:hover:text-white">
            {t("footer.catalogue")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
