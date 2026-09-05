import Link from "next/link";

export default function Mode3DPage() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-16 sm:px-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <span className="text-4xl">🧊</span>
        <h1 className="mt-4 text-2xl font-bold text-zinc-900 dark:text-white">
          Mode 3D
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Ce mode n&apos;a pas encore été créé. Reviens lors d&apos;une prochaine
          mise à jour !
        </p>
        <Link
          href="/catalogue"
          className="mt-6 inline-block rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
        >
          Retour au catalogue
        </Link>
      </div>
    </div>
  );
}
