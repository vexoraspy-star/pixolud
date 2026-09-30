import type { AmmoId, TankClass } from "@/lib/tanks/tankDefs";

/**
 * Icone de classe de char, comme sur les panneaux d'equipe des jeux de
 * blindes : un losange pour les chars (plein pour le leger, une barre pour le
 * moyen, deux pour le lourd), un triangle pointe en bas pour le chasseur, un
 * carre pour l'artillerie.
 */
export function TankClassIcon({ cls, className = "", title }: { cls: TankClass; className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {cls === "chasseur" ? (
        <path d="M3 4h14L10 17z" fill="currentColor" />
      ) : cls === "artillerie" ? (
        <path d="M4 4h12v12H4z" fill="currentColor" />
      ) : (
        <>
          <path d="M10 2 18 10 10 18 2 10z" fill="currentColor" />
          {cls !== "leger" && <path d="M5 8.5h10v1.4H5z" fill="rgba(0,0,0,.55)" />}
          {cls === "lourd" && <path d="M5 11h10v1.4H5z" fill="rgba(0,0,0,.55)" />}
        </>
      )}
    </svg>
  );
}

/** Un obus dessine, de la couleur de son type (perforant dore, sous-calibre acier, explosif rouge). */
export function ShellIcon({ ammo, className = "" }: { ammo: AmmoId; className?: string }) {
  const color = ammo === "perforant" ? "#d6a741" : ammo === "sousCalibre" ? "#9fb6cc" : "#d9573b";
  return (
    <svg viewBox="0 0 12 28" className={className} aria-hidden>
      <path d="M2 11 Q6 0 10 11 V24 H2Z" fill={color} />
      <rect x="1.5" y="23" width="9" height="4" rx="0.6" fill="#b08a3e" />
      <rect x="2" y="15" width="8" height="1.2" fill="rgba(0,0,0,.35)" />
    </svg>
  );
}
