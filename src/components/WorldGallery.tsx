import Link from "next/link";
import GameArtwork from "./GameArtwork";
import PortalHeading from "./PortalHeading";
import { GAMES_3D, playableGames3D, type Game3D } from "@/lib/games3d";

function GameCard({ game }: { game: Game3D }) {
  const content = <>
    <div className="world-card-art">
      <GameArtwork kind={game.slug} cover={game.cover} />
      <span className="world-genre">{game.genre}</span>
      {game.locked && <span className="world-locked">Bientôt</span>}
    </div>
    <div className="world-card-body">
      <p className="world-meta">{game.players}<span>·</span>{game.duration}</p>
      <h2>{game.title}</h2>
      <p className="world-description">{game.description}</p>
      <div className="world-highlights">{game.highlights.map(h => <span key={h}>{h}</span>)}</div>
      <span className="world-cta">{game.locked ? "En préparation" : "Explorer ce monde"}<span aria-hidden="true">{game.locked ? "◷" : "↗"}</span></span>
    </div>
  </>;
  return game.locked
    ? <div aria-disabled="true" className="world-card is-locked">{content}</div>
    : <Link href={`/mode-3d/${game.slug}`} className="world-card">{content}</Link>;
}

export default function WorldGallery() {
  return (
    <div className="portal-container portal-page">
      <div className="world-intro">
        <PortalHeading eyebrow="UNE AUTRE DIMENSION" title="Des mondes à explorer." description="Construis ton refuge, défie tes amis ou ose l’inconnu. Les univers 3D de Pixolud t’attendent, directement dans ton navigateur." />
        <div className="world-count"><strong>{playableGames3D().length.toString().padStart(2, "0")}</strong><span>mondes jouables<br />sans installation</span></div>
      </div>
      <div className="section-title"><h2>Mode 3D</h2><span>La sélection Pixolud</span></div>
      <div className="world-grid">{GAMES_3D.map(game => <GameCard key={game.slug} game={game} />)}</div>
      <div className="portal-note"><span>Ton prochain univers commence ici.</span><Link href="/editeur">Crée un mini-jeu 2D <span aria-hidden="true">↗</span></Link></div>
    </div>
  );
}
