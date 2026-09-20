"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Bandeau d'information sur les cookies.
 *
 * Le site ne depose que des cookies necessaires (session, langue) et
 * n'utilise ni publicite ni traceur : la loi n'impose donc pas de demander un
 * consentement, mais elle impose d'informer. D'ou ce bandeau discret, qu'on
 * ferme une fois pour toutes — et surtout pas un mur qui bloque la page.
 */
const KEY = "pixolud-cookies-vu";

export default function CookieNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (localStorage.getItem(KEY) !== "1") setShow(true);
      } catch {
        // Stockage bloque : on n'affiche rien plutot que de revenir sans cesse.
      }
    }, 800);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  function close() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // ignore
    }
    setShow(false);
  }

  return (
    <div
      role="region"
      aria-label="Information sur les cookies"
      className="fixed bottom-3 left-1/2 z-[120] w-[min(38rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-2xl border border-[var(--portal-line)] bg-[var(--portal-surface)] p-4 text-[var(--portal-ink)] shadow-2xl"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xl" aria-hidden="true">
          🍪
        </span>
        <p className="min-w-40 flex-1 text-xs leading-5 text-[var(--portal-muted)]">
          Pixolud n&apos;utilise que des cookies nécessaires : rester connecté et retenir ta langue. Aucune publicité, aucun
          traceur, aucune revente de données.{" "}
          <Link href="/cookies" className="text-[var(--portal-accent)] underline">
            En savoir plus
          </Link>
        </p>
        <button type="button" onClick={close} className="portal-button small">
          J&apos;ai compris
        </button>
      </div>
    </div>
  );
}
