import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./portal.css";
import "./panels.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import Mascot from "@/components/Mascot";
import FriendsDock from "@/components/FriendsDock";
import KonamiCode from "@/components/KonamiCode";
import MusicRadio from "@/components/MusicRadio";
import { LANGUAGE_META } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { getSessionProfile } from "@/lib/session";
import { logout } from "@/app/connexion/actions";
import { CHEAT_GAMES, enabledCheatGames } from "@/lib/admin";
import AdminQuickButton from "@/components/AdminQuickButton";
import SiteLive from "@/components/SiteLive";
import CookieNotice from "@/components/CookieNotice";
import SiteJsonLd from "@/components/SiteJsonLd";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://pixolud.vercel.app";
const SITE_TITLE = "Pixolud — Crée, publie et joue à des mini-jeux 2D";
const SITE_DESCRIPTION =
  "La plateforme communautaire pour créer, publier et jouer à des mini-jeux 2D : plateforme, puzzle, arcade, labyrinthe, quiz et plus encore. Et des jeux 3D dans le navigateur : Cubes, Backrooms, Manoir Maudit, Duel.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: "Pixolud",
  keywords: ["mini-jeux", "créer un jeu", "jeux en ligne", "jeux 2D", "jeux 3D", "sans code", "Pixolud"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Pixolud",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "fr_FR",
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
  // Code donne par Google Search Console pour prouver que le site est a nous.
  // Il est public (il s'affiche dans la page) : il vit dans une variable
  // NEXT_PUBLIC_, ou on l'ecrit ici directement.
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION || "mFEDuRnnHB74bfj3-k3T_fgaYhHiyVm5xKbda-3ike8",
  },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const dir = LANGUAGE_META[locale].dir;
  // Compte banni : le site entier laisse place a l'ecran de suspension.
  const session = await getSessionProfile();
  const ban = session?.ban ?? null;
  // Bouton admin flottant : le droit est lu cote serveur, sur le profil.
  const adminCheats = session?.isAdmin ? await enabledCheatGames() : null;

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="portal-shell min-h-full flex flex-col">
        <SiteJsonLd siteUrl={SITE_URL} />
        <ServiceWorkerRegister />
        <KonamiCode />
        <Mascot />
        {session?.id && <FriendsDock />}
        <MusicRadio />
        <Header />
        <SiteLive me={session?.pseudo ? { id: session.id, pseudo: session.pseudo } : null} />
        {adminCheats && (
          <AdminQuickButton games={CHEAT_GAMES.map(({ slug, label }) => ({ slug, label }))} enabled={adminCheats} />
        )}
        <main id="contenu" tabIndex={-1} className="flex-1">
          {ban ? (
            <div className="portal-container portal-page">
              <div className="mx-auto max-w-lg rounded-2xl border border-red-500/40 bg-[var(--portal-surface)] p-8 text-center">
                <p className="text-5xl" aria-hidden="true">⛔</p>
                <h1 className="mt-4 text-2xl font-extrabold">Compte suspendu</h1>
                <p className="mt-3 text-sm text-[var(--portal-muted)]">
                  L&apos;équipe Pixolud a suspendu ce compte
                  {ban.until
                    ? ` jusqu'au ${new Date(ban.until).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}`
                    : " définitivement"}
                  .
                </p>
                {ban.reason && <p className="mt-3 rounded-lg bg-[var(--portal-soft)] px-3 py-2 text-sm">Motif : {ban.reason}</p>}
                <form action={logout} className="mt-6">
                  <button type="submit" className="portal-button small">Se déconnecter</button>
                </form>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
        <Footer />
        <CookieNotice />
      </body>
    </html>
  );
}
