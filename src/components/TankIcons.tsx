import type { TankClass } from "@/lib/tanks/tankDefs";

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
