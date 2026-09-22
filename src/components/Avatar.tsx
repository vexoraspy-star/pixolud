import { frameById, frameStyle } from "@/lib/frames";

/**
 * L'avatar d'un joueur : sa photo (ou ses initiales) dans son cadre.
 *
 * Un seul composant pour tout le site — profil, liste d'amis, party, panneau
 * admin — sinon le cadre finit par etre dessine de quatre facons differentes.
 * L'image passe par une balise <img> ordinaire et non next/image : les photos
 * viennent du stockage Supabase, et on ne veut pas payer d'optimisation
 * d'image pour une vignette de 40 pixels.
 */
export default function Avatar({
  pseudo,
  url,
  frame,
  taille = 40,
  className = "",
}: {
  pseudo: string;
  url?: string | null;
  frame?: string | null;
  /** Diametre en pixels, cadre compris. */
  taille?: number;
  className?: string;
}) {
  const f = frameById(frame);
  const epaisseur = f.id === "aucun" ? 0 : Math.max(2, Math.round(taille * 0.07));
  const interieur = taille - epaisseur * 2;

  return (
    <span
      className={`avatar-ring ${className}`}
      style={{ width: taille, height: taille, padding: epaisseur, ...frameStyle(f) }}
      aria-hidden="true"
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" width={interieur} height={interieur} className="avatar-photo" draggable={false} />
      ) : (
        <span className="avatar-initiales" style={{ width: interieur, height: interieur, fontSize: Math.round(taille * 0.36) }}>
          {pseudo.slice(0, 2).toUpperCase()}
        </span>
      )}
    </span>
  );
}
