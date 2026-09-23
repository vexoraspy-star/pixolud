import Link from "next/link";
import { translate } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export default async function Footer() {
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);

  return (
    <footer className="site-footer">
      <div className="portal-container footer-content">
        <p><Link href="/" className="footer-wordmark">✣ Pixolud</Link>&copy; {new Date().getFullYear()} Pixolud — {t("footer.rights")}</p>
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
          <Link href="/a-propos" className="hover:text-zinc-900 dark:hover:text-white">
            {t("nav.about")}
          </Link>
          <Link href="/cookies" className="hover:text-zinc-900 dark:hover:text-white">
            {t("footer.cookies")}
          </Link>
          <Link href="/mentions-legales" className="hover:text-zinc-900 dark:hover:text-white">
            {t("footer.legal")}
          </Link>
          <Link href="/remboursement" className="hover:text-zinc-900 dark:hover:text-white">
            {t("footer.payments")}
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
