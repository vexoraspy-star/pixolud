import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LANG_COOKIE, type Locale } from "./i18n";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const v = store.get(LANG_COOKIE)?.value;
  return isLocale(v) ? v : DEFAULT_LOCALE;
}
