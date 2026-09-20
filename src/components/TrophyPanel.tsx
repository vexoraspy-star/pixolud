"use client";
import { SECRET_CHARACTER, SHAME_BADGES, useSecretUnlocked, useUnlockedBadges } from "@/lib/fun";
import useHeaderPopover from "./useHeaderPopover";
export default function TrophyPanel() {
  const { open, setOpen, root, trigger } = useHeaderPopover();
  const unlockedBadges = useUnlockedBadges();
  const secretUnlocked = useSecretUnlocked();
  const trophies = [...SHAME_BADGES.map(b => ({ ...b, done: unlockedBadges.has(b.id) })), {
    id: "secret", label: "Code Secret", emoji: SECRET_CHARACTER,
    description: "Trouver le Konami Code (↑↑↓↓←→←→BA).", done: secretUnlocked,
  }];
  const count = trophies.filter(t => t.done).length;
  return <div ref={root} className="header-popover-root">
    <button ref={trigger} type="button" className="header-popover-trigger trophy-trigger" aria-label="Trophées" aria-expanded={open} aria-controls="trophy-collection" onClick={() => setOpen(!open)}>🏆</button>
    {open && <section id="trophy-collection" className="utility-panel header-popover trophy-panel" aria-labelledby="trophy-title">
      <header className="utility-heading"><span className="utility-emblem trophy-emblem" aria-hidden="true">🏆</span><div><p className="utility-kicker">TES PETITES VICTOIRES</p><h2 id="trophy-title">Ta collection</h2></div><button type="button" className="utility-close" aria-label="Fermer les trophées" onClick={() => { setOpen(false); trigger.current?.focus(); }}>×</button></header>
      <div className="trophy-progress"><div><strong>{count} / {trophies.length}</strong><span>trophées débloqués</span></div><progress value={count} max={trophies.length} aria-label="Trophées débloqués" /></div>
      <ul className="trophy-list">{trophies.map(b => <li key={b.id} className={b.done ? "trophy-card is-unlocked" : "trophy-card"}>
        <span className="trophy-icon" aria-hidden="true">{b.done ? b.emoji : "🔒"}</span><div><span className="trophy-status">{b.done ? "DÉBLOQUÉ" : "À DÉCOUVRIR"}</span><h3>{b.label}</h3><p>{b.description}</p></div>{b.done && <span className="trophy-check" aria-hidden="true">✓</span>}
      </li>)}</ul><p className="collection-note">Ta progression est enregistrée sur cet appareil.</p>
    </section>}
  </div>;
}
