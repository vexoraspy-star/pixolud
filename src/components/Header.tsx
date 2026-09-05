import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/connexion/actions";
import { TIERS, type Tier } from "@/lib/tiers";
import MobileMenu from "./MobileMenu";

export default async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let pseudo: string | null = null;
  let badge: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("pseudo, tier")
      .eq("id", user.id)
      .single();
    pseudo = profile?.pseudo ?? null;
    badge = TIERS[(profile?.tier as Tier) ?? "free"].badge;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-black/80 relative">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-2xl">🎮</span>
          <span className="flex flex-col leading-tight">
            <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
              Pixolud
            </span>
            <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
              Made by Tarendra
            </span>
          </span>
        </Link>

        <form
          action="/catalogue"
          className="hidden flex-1 items-center sm:flex"
        >
          <input
            type="search"
            name="q"
            placeholder="Rechercher un jeu..."
            className="w-full rounded-full border border-zinc-300 bg-zinc-50 px-4 py-1.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          />
        </form>

        <nav className="ml-auto flex items-center gap-1 text-sm font-medium">
          <MobileMenu pseudo={pseudo} />
          <Link
            href="/catalogue"
            className="hidden rounded-full px-3 py-1.5 text-zinc-600 hover:bg-zinc-100 sm:block dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Catalogue
          </Link>
          <Link
            href="/mode-3d"
            className="hidden rounded-full px-3 py-1.5 text-zinc-600 hover:bg-zinc-100 sm:block dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Mode 3D
          </Link>
          <Link
            href="/multijoueur"
            className="hidden rounded-full px-3 py-1.5 text-zinc-600 hover:bg-zinc-100 sm:block dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Multijoueur
          </Link>
          <Link
            href="/editeur"
            className="hidden rounded-full px-3 py-1.5 text-zinc-600 hover:bg-zinc-100 sm:block dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Créer un jeu
          </Link>
          <Link
            href="/premium"
            className="hidden rounded-full px-3 py-1.5 font-semibold text-amber-600 hover:bg-amber-50 sm:block dark:text-amber-400 dark:hover:bg-amber-950/30"
          >
            ✨ Premium
          </Link>

          {pseudo ? (
            <>
              <Link
                href={`/profil/${pseudo}`}
                className="hidden rounded-full px-3 py-1.5 text-zinc-600 hover:bg-zinc-100 sm:block dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                {badge ? `${badge} ` : ""}
                {pseudo}
              </Link>
              <Link
                href="/parametres"
                className="hidden rounded-full px-3 py-1.5 text-zinc-600 hover:bg-zinc-100 sm:block dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Paramètres
              </Link>
              <form action={logout} className="hidden sm:block">
                <button
                  type="submit"
                  className="rounded-full bg-zinc-900 px-4 py-1.5 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Se déconnecter
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/connexion"
                className="hidden rounded-full px-3 py-1.5 text-zinc-600 hover:bg-zinc-100 sm:block dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Se connecter
              </Link>
              <Link
                href="/inscription"
                className="hidden rounded-full bg-violet-600 px-4 py-1.5 text-white hover:bg-violet-700 sm:block"
              >
                Créer un compte
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
