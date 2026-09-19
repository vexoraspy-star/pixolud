import Link from "next/link";
import { getSessionProfile } from "@/lib/session";
import { logout } from "@/app/connexion/actions";
import { TIERS, type Tier } from "@/lib/tiers";
import { translate } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import MobileMenu from "./MobileMenu";
import LanguageSwitcher from "./LanguageSwitcher";
import TrophyPanel from "./TrophyPanel";
import PortalNavigation from "./PortalNavigation";

export default async function Header() {
  const session = await getSessionProfile();
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);

  const pseudo = session?.pseudo ?? null;
  const badge = session ? TIERS[(session.tier as Tier) ?? "free"]?.badge ?? TIERS.free.badge : null;
  const isAdmin = session?.isAdmin === true;

  return (
    <header data-site-chrome className="site-header">
      <a href="#contenu" className="skip-link">Aller au contenu</a>
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="Pixolud, accueil">
          <span className="brand-mark" aria-hidden="true">✣</span>
          <span>Pixolud<span className="brand-caption">Made by Tarendra</span></span>
        </Link>
        <PortalNavigation locale={locale} />
        <div className="header-tools">
          <div className="desktop-account">
            {pseudo ? <details className="account-menu">
              <summary>{badge} {pseudo}<span aria-hidden="true">⌄</span></summary>
              <div className="account-dropdown">
                <Link href={"/profil/" + pseudo}>{pseudo}</Link>
                {isAdmin && <Link href="/admin">🛡 Panneau admin</Link>}
                <Link href="/parametres">{t("nav.settings")}</Link>
                <form action={logout}><button type="submit">{t("nav.logout")}</button></form>
              </div>
            </details> : <Link href="/connexion" className="portal-button small">{t("nav.login")}</Link>}
          </div>
          <TrophyPanel />
          <LanguageSwitcher current={locale} />
          <MobileMenu pseudo={pseudo} locale={locale} isAdmin={isAdmin} />
        </div>
      </div>
    </header>
  );
}
