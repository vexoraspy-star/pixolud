"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { setCheatGames } from "@/app/admin/actions";

/**
 * Bouton 🛡 flottant, affiche seulement aux admins (le layout le verifie cote
 * serveur). Sur le site : raccourci vers le panneau admin. Dans un jeu qui a
 * un mode triche : l'activer ou le couper en un clic, sans passer par
 * /admin. Les actions revérifient de toute facon le droit admin.
 */
export default function AdminQuickButton({
  games,
  enabled,
}: {
  games: { slug: string; label: string }[];
  enabled: string[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const slug = /^\/mode-3d\/([^/]+)$/.exec(pathname)?.[1] ?? null;
  const game = games.find((g) => g.slug === slug) ?? null;
  const on = game ? enabled.includes(game.slug) : false;

  function toggle() {
    if (!game) return;
    const next = on ? enabled.filter((s) => s !== game.slug) : [...enabled, game.slug];
    start(async () => {
      const r = await setCheatGames(next);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      // Le jeu relit le droit au chargement : on recharge la page.
      window.location.reload();
    });
  }

  return (
    <div className="fixed left-2 top-1/2 z-[90] -translate-y-1/2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Outils admin"
        title="Outils admin"
        className={`flex size-9 items-center justify-center rounded-full border text-base shadow-lg backdrop-blur transition ${
          on ? "border-fuchsia-300 bg-fuchsia-600/90 text-white" : "border-white/20 bg-black/60 text-white opacity-60 hover:opacity-100"
        }`}
      >
        🛡
      </button>
      {open && (
        <div className="absolute left-11 top-1/2 w-64 -translate-y-1/2 rounded-2xl border border-white/15 bg-zinc-950/95 p-3 text-sm text-white shadow-2xl backdrop-blur">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-300">Admin</p>
          {game ? (
            <>
              <p className="mt-2 font-semibold">{game.label}</p>
              <button
                type="button"
                disabled={pending}
                onClick={toggle}
                className={`mt-2 w-full rounded-lg px-3 py-2 text-left text-sm font-bold transition disabled:opacity-50 ${
                  on ? "bg-fuchsia-600 hover:bg-fuchsia-500" : "bg-white/10 hover:bg-white/20"
                }`}
              >
                {pending ? "Un instant…" : on ? "✓ Mode triche activé — couper" : "Activer le mode triche"}
              </button>
              <p className="mt-2 text-[11px] leading-snug text-zinc-400">
                {on ? "En partie : touche F2 pour ouvrir le menu de triche." : "La page se recharge, puis F2 en partie ouvre le menu de triche."}
              </p>
            </>
          ) : (
            <p className="mt-2 text-[11px] text-zinc-400">Dans le Manoir, les Backrooms ou le Duel, ce bouton active le mode triche.</p>
          )}
          {error && <p className="mt-2 text-[11px] text-red-300">{error}</p>}
          <Link
            href="/admin"
            onClick={() => setOpen(false)}
            className="mt-3 block rounded-lg bg-white/10 px-3 py-2 font-semibold hover:bg-white/20"
          >
            🛡 Ouvrir le panneau admin
          </Link>
        </div>
      )}
    </div>
  );
}
