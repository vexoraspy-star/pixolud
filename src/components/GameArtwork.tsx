const covers: Record<string, string> = {
  cubes: "cubes", "labyrinthe-legendaire": "maze", "manoir-maudit": "manor", backrooms: "backrooms",
  Labyrinthe: "maze", Puzzle: "puzzle", Quiz: "puzzle", Éducation: "puzzle",
  "Calcul Mental": "puzzle", "Petit Bac": "puzzle", Devinettes: "puzzle",
  territoire: "arcade", chasse: "maze", bulles: "puzzle", echecs: "puzzle", "python-chat": "arcade",
};

/** Illustrations maison, statiques pour ne pas charger la carte graphique. */
export default function GameArtwork({ kind, cover, className = "", priority = false }: {
  kind: string; cover?: string | null; className?: string; priority?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={cover || `/covers/${covers[kind] || "arcade"}.svg`} alt="" aria-hidden="true"
      width={1200} height={750} loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined} className={`game-artwork ${className}`} />
  );
}
