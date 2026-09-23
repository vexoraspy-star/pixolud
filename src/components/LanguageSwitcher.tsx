"use client";
import { useRouter } from "next/navigation";
import { LANG_COOKIE, LANGUAGE_META, LOCALES, translate, type Locale } from "@/lib/i18n";
import useHeaderPopover from "./useHeaderPopover";
function saveLanguage(loc: Locale) {
  // Secure : le cookie ne voyage que sur HTTPS (localhost reste accepte par les navigateurs).
  document.cookie = LANG_COOKIE + "=" + loc + "; path=/; max-age=31536000; SameSite=Lax; Secure";
}
export default function LanguageSwitcher({ current }: { current: Locale }) {
  const { open, setOpen, root, trigger } = useHeaderPopover();
  const router = useRouter();
  const change = (loc: Locale) => {
    saveLanguage(loc);
    setOpen(false); trigger.current?.focus(); router.refresh();
  };
  return <div ref={root} className="header-popover-root">
    <button ref={trigger} type="button" className="header-popover-trigger language-trigger" aria-label={translate(current, "lang.choose")} aria-expanded={open} aria-controls="language-options" onClick={() => setOpen(!open)}><span className="language-code" aria-hidden="true">{current.toUpperCase()}</span><span className="language-current">{LANGUAGE_META[current].label}</span><span aria-hidden="true">⌄</span></button>
    {open && <section id="language-options" className="utility-panel header-popover language-panel" aria-labelledby="language-title">
      <header className="utility-heading"><span className="utility-emblem radio-emblem" aria-hidden="true">◎</span><div><p className="utility-kicker">PIXOLUD</p><h2 id="language-title">{translate(current, "lang.choose")}</h2></div><button type="button" className="utility-close" aria-label="Fermer / Close" onClick={() => { setOpen(false); trigger.current?.focus(); }}>×</button></header>
      <div className="language-list">{LOCALES.map(loc => <button key={loc} type="button" lang={loc} onClick={() => change(loc)} aria-pressed={loc === current}><span className="language-tile" aria-hidden="true">{loc.toUpperCase()}</span><span dir={LANGUAGE_META[loc].dir}>{LANGUAGE_META[loc].label}</span><span className="language-check" aria-hidden="true">{loc === current ? "✓" : ""}</span></button>)}</div>
    </section>}
  </div>;
}
