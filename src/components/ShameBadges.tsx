"use client";

import { SHAME_BADGES, useUnlockedBadges } from "@/lib/fun";

export default function ShameBadges() {
  const unlocked = useUnlockedBadges();

  return (
    <div className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
        🏆 Trophées de la honte
      </h2>
      <p className="mt-1 text-xs text-zinc-400">
        Suivis sur cet appareil uniquement. L&apos;échec aussi mérite sa médaille.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SHAME_BADGES.map((b) => {
          const done = unlocked.has(b.id);
          return (
            <div
              key={b.id}
              title={b.description}
              className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center ${
                done
                  ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
                  : "border-zinc-200 bg-zinc-50 opacity-50 dark:border-zinc-800 dark:bg-zinc-900"
              }`}
            >
              <span className="text-2xl">{done ? b.emoji : "🔒"}</span>
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                {b.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
