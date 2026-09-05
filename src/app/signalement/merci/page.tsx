import Link from "next/link";

export default function SignalementMerciPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center sm:px-6">
      <span className="text-4xl">✅</span>
      <h1 className="mt-4 text-2xl font-bold text-zinc-900 dark:text-white">
        Signalement envoyé
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Merci, notre équipe va l&apos;examiner rapidement.
      </p>
      <Link
        href="/catalogue"
        className="mt-6 inline-block rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
      >
        Retour au catalogue
      </Link>
    </div>
  );
}
