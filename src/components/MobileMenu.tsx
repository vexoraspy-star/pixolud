"use client";

import { useState } from "react";
import Link from "next/link";
import { logout } from "@/app/connexion/actions";

export default function MobileMenu({ pseudo }: { pseudo: string | null }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu"
        className="flex size-9 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        {open ? "✕" : "☰"}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full border-b border-zinc-200 bg-white px-4 py-3 shadow-lg dark:border-zinc-800 dark:bg-black">
          <form action="/catalogue" className="mb-3 flex items-center">
            <input
              type="search"
              name="q"
              placeholder="Rechercher un jeu..."
              className="w-full rounded-full border border-zinc-300 bg-zinc-50 px-4 py-1.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            />
          </form>
          <nav className="flex flex-col gap-1 text-sm font-medium">
            <Link
              href="/catalogue"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Catalogue
            </Link>
            <Link
              href="/mode-3d"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Mode 3D
            </Link>
            <Link
              href="/multijoueur"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Multijoueur
            </Link>
            <Link
              href="/editeur"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Créer un jeu
            </Link>
            <Link
              href="/premium"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 font-semibold text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
            >
              ✨ Premium
            </Link>
            {pseudo ? (
              <>
                <Link
                  href={`/profil/${pseudo}`}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  {pseudo}
                </Link>
                <Link
                  href="/parametres"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Paramètres
                </Link>
                <form action={logout}>
                  <button
                    type="submit"
                    className="w-full rounded-lg px-3 py-2 text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    Se déconnecter
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link
                  href="/connexion"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Se connecter
                </Link>
                <Link
                  href="/inscription"
                  onClick={() => setOpen(false)}
                  className="rounded-lg bg-violet-600 px-3 py-2 text-white hover:bg-violet-700"
                >
                  Créer un compte
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}
