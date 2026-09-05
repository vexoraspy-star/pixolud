"use client";

import { useState } from "react";
import Link from "next/link";

function generateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default function InvitePartyButton({ slug }: { slug: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function invite() {
    const c = generateCode();
    setCode(c);
    const url = `${window.location.origin}/jeu/${slug}/jouer?party=${c}`;
    navigator.clipboard
      ?.writeText(url)
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
  }

  if (code) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-full bg-emerald-50 px-4 py-2.5 text-sm dark:bg-emerald-950/30">
        <span className="text-emerald-700 dark:text-emerald-400">
          {copied ? "🔗 Lien copié, envoie-le à ton ami !" : `Code : ${code}`}
        </span>
        <Link
          href={`/jeu/${slug}/jouer?party=${code}`}
          className="font-semibold text-violet-600 hover:underline"
        >
          Rejoindre la partie →
        </Link>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={invite}
      className="rounded-full border border-zinc-300 px-5 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
    >
      🎉 Inviter un ami
    </button>
  );
}
