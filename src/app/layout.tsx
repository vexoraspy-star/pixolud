import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./portal.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import Mascot from "@/components/Mascot";
import KonamiCode from "@/components/KonamiCode";
import MusicRadio from "@/components/MusicRadio";
import { LANGUAGE_META } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { getSessionProfile } from "@/lib/session";
import { logout } from "@/app/connexion/actions";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pixolud — Crée, publie et joue à des mini-jeux 2D",
  description:
    "La plateforme communautaire pour créer, publier et jouer à des mini-jeux 2D : plateforme, puzzle, arcade, labyrinthe, quiz et plus encore.",
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const dir = LANGUAGE_META[locale].dir;
  // Compte banni : le site entier laisse place a l'ecran de suspension.
  const ban = (await getSessionProfile())?.ban ?? null;

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="portal-shell min-h-full flex flex-col">
        <ServiceWorkerRegister />
        <KonamiCode />
        <Mascot />
        <MusicRadio />
        <Header />
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
      </body>
    </html>
  );
}
