"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { LANG_COOKIE, LANGUAGE_META, LOCALES, translate, type Locale } from "@/lib/i18n";

export default function LanguageSwitcher({ current }: { current: Locale }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const change = useCallback(
    (loc: Locale) => {
      window.document.cookie = `${LANG_COOKIE}=${loc}; path=/; max-age=31536000`;
      setOpen(false);
      router.refresh();
    },
    [router],
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={translate(current, "lang.choose")}
        className="flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
      >
        <span>{LANGUAGE_META[current].flag}</span>
        <span className="hidden sm:inline">{LANGUAGE_META[current].label}</span>
        <span aria-hidden>▾</span>
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
          <div className="absolute end-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
            {LOCALES.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => change(l)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-start text-sm ${
                  l === current
                    ? "bg-violet-50 font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                <span>{LANGUAGE_META[l].flag}</span>
                {LANGUAGE_META[l].label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
