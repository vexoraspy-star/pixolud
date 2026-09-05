"use client";

import { useRouter } from "next/navigation";
import { LANG_COOKIE, LANGUAGE_META, LOCALES, translate, type Locale } from "@/lib/i18n";

export default function LanguageSwitcher({ current }: { current: Locale }) {
  const router = useRouter();

  function change(loc: string) {
    document.cookie = `${LANG_COOKIE}=${loc}; path=/; max-age=31536000`;
    router.refresh();
  }

  return (
    <select
      value={current}
      onChange={(e) => change(e.target.value)}
      aria-label={translate(current, "lang.choose")}
      className="rounded-full border border-zinc-300 bg-white px-2 py-1.5 text-xs font-medium text-zinc-600 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
    >
      {LOCALES.map((l) => (
        <option key={l} value={l}>
          {LANGUAGE_META[l].flag} {LANGUAGE_META[l].label}
        </option>
      ))}
    </select>
  );
}
