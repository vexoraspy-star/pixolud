import Link from "next/link";
import GameArtwork from "@/components/GameArtwork";

export default function NotFound() {
  return <div className="portal-container portal-page missing-page">
    <div><p className="eyebrow"><span />404 · HORS DU TERRAIN</p><h1>Ce chemin ne mène nulle part.</h1><p className="portal-description">Cette page n’existe pas ou ce jeu n’est plus disponible. Il reste plein d’autres mondes à découvrir.</p><Link href="/catalogue" className="portal-button">Retour au catalogue ↗</Link></div>
    <div className="missing-art"><GameArtwork kind="Labyrinthe" /></div>
  </div>;
}
