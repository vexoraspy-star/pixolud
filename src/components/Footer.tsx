import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:text-zinc-400">
        <p>&copy; {new Date().getFullYear()} Pixolud — Fait par la communauté.</p>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/cgu" className="hover:text-zinc-900 dark:hover:text-white">
            CGU
          </Link>
          <Link
            href="/confidentialite"
            className="hover:text-zinc-900 dark:hover:text-white"
          >
            Confidentialité
          </Link>
          <Link
            href="/signalement"
            className="hover:text-zinc-900 dark:hover:text-white"
          >
            Signaler un contenu
          </Link>
          <Link href="/catalogue" className="hover:text-zinc-900 dark:hover:text-white">
            Catalogue
          </Link>
        </nav>
      </div>
    </footer>
  );
}
