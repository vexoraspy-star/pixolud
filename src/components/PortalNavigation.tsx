"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { translate, type Locale } from "@/lib/i18n";

const links = [["/catalogue", "nav.catalogue"], ["/mode-3d", "nav.mode3d"], ["/multijoueur", "nav.multiplayer"], ["/pixocall", "nav.pixocall"], ["/game-script", "nav.gamescript"], ["/editeur", "nav.createGame"], ["/a-propos", "nav.about"], ["/premium", "nav.premium"]];

export default function PortalNavigation({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  return <nav className="desktop-navigation" aria-label={translate(locale, "a11y.mainNav")}>
    {links.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href || pathname.startsWith(href + "/") ? "page" : undefined} className={href === "/premium" ? "premium-link" : undefined}>{translate(locale, label)}</Link>)}
  </nav>;
}
