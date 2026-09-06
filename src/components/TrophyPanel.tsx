"use client";

import { useState } from "react";
import { SECRET_CHARACTER, SHAME_BADGES, useSecretUnlocked, useUnlockedBadges } from "@/lib/fun";

export default function TrophyPanel() {
  const [open, setOpen] = useState(false);
  const unlockedBadges = useUnlockedBadges();
  const secretUnlocked = useSecretUnlocked();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Trophées"
        className="flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
      >
        🏆
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute end-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
            <p className="mb-2 text-xs font-bold text-zinc-900 dark:text-white">
              🏆 Trophées à débloquer
            </p>
            <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
              {SHAME_BADGES.map((b) => {
                const done = unlockedBadges.has(b.id);
                return (
                  <li
                    key={b.id}
                    className={`flex items-start gap-2 rounded-lg p-2 text-xs ${
                      done ? "bg-amber-50 dark:bg-amber-950/30" : "bg-zinc-50 dark:bg-zinc-800/50"
                    }`}
                  >
                    <span className="text-lg">{done ? b.emoji : "🔒"}</span>
                    <span>
                      <span
                        className={`block font-medium ${
                          done ? "text-amber-700 dark:text-amber-300" : "text-zinc-500 dark:text-zinc-400"
                        }`}
                      >
                        {b.label}
                      </span>
                      <span className="text-zinc-400">{b.description}</span>
                    </span>
                  </li>
                );
              })}
              <li
                className={`flex items-start gap-2 rounded-lg p-2 text-xs ${
                  secretUnlocked ? "bg-amber-50 dark:bg-amber-950/30" : "bg-zinc-50 dark:bg-zinc-800/50"
                }`}
              >
                <span className="text-lg">{secretUnlocked ? SECRET_CHARACTER : "🔒"}</span>
                <span>
                  <span
                    className={`block font-medium ${
                      secretUnlocked ? "text-amber-700 dark:text-amber-300" : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    Code Secret
                  </span>
                  <span className="text-zinc-400">Trouver le Konami Code (↑↑↓↓←→←→BA).</span>
                </span>
              </li>
            </ul>
            <p className="mt-2 text-[10px] text-zinc-400">
              Suivi sur cet appareil uniquement.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
