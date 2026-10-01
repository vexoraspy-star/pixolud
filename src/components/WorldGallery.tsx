import Link from "next/link";
import GameArtwork from "./GameArtwork";
import PortalHeading from "./PortalHeading";
import { GAMES_3D, playableGames3D, type Game3D } from "@/lib/games3d";
import "@/app/world-gallery.css";

// Direction artistique des univers, sans modifier le catalogue ni les jeux.
const UNIVERSES: Record<string, { art: string; theme: string; heading: string; action: string }> = {
  cubes: { art: "cubes", theme: "voxel", heading: "UN MONDE À CONSTRUIRE. UNE NUIT À SURVIVRE.", action: "Façonner mon monde" },
  "labyrinthe-legendaire": { art: "maze", theme: "maze", heading: "CHAQUE DÉTOUR CACHE UNE ISSUE", action: "Trouver mon chemin" },
  "tonnerre-acier": { art: "tank", theme: "steel", heading: "LA PUISSANCE DU BLINDAGE", action: "Rejoindre le front" },
  "manoir-maudit": { art: "manor", theme: "haunted", heading: "LE SILENCE EST TA SEULE CHANCE", action: "Franchir la porte" },
  backrooms: { art: "backrooms", theme: "liminal", heading: "TU N’ÉTAIS PAS CENSÉ ÊTRE ICI", action: "Entrer dans les Backrooms" },
  "duel-1v1": { art: "duel", theme: "arena", heading: "TON STYLE. TON TERRAIN. TON DUEL.", action: "Entrer dans l’arène" },
  "front-urbain": { art: "front", theme: "tactical", heading: "CHAQUE ANGLE COMPTE", action: "Lancer l’opération" },
};

function GameCard({ game }: { game: Game3D }) {
  const universe = UNIVERSES[game.slug];
  const cardClass = `world-card${universe ? ` world-universe universe-${universe.theme}` : ""}`;
  const content = <>
    <div className="world-card-art">
      {universe ? (
        // Images locales deja compressees, sans traitement a la demande.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="game-artwork" src={`/covers/univers/${universe.art}.webp`}
          srcSet={`/covers/univers/${universe.art}-640.webp 640w, /covers/univers/${universe.art}.webp 1200w`}
          sizes="(max-width: 640px) calc(100vw - 40px), (max-width: 1200px) calc(50vw - 40px), 560px"
          width={1200} height={675} alt="" aria-hidden="true" loading="lazy" decoding="async" />
      ) : <GameArtwork kind={game.slug} cover={game.cover} />}
      <span className="world-genre">{game.genre}</span>
      {universe && <div className="universe-title"><p>{universe.heading}</p><h2>{game.title}</h2></div>}
      {game.locked && <span className="world-locked">Bientôt</span>}
    </div>
    <div className="world-card-body">
      <p className="world-meta">{game.players}<span>·</span>{game.duration}</p>
      {!universe && <h2>{game.title}</h2>}
      <p className="world-description">{game.description}</p>
      {game.warning && <p className="world-warning"><span aria-hidden="true">⚠ </span>{game.warning}</p>}
      <div className="world-highlights">{game.highlights.map(h => <span key={h}>{h}</span>)}</div>
      <span className="world-cta">{game.locked ? "En préparation" : universe?.action || "Explorer ce monde"}<span aria-hidden="true">{game.locked ? "◷" : "↗"}</span></span>
    </div>
  </>;
  return game.locked
    ? <div aria-disabled="true" className={`${cardClass} is-locked`}>{content}</div>
    : <Link href={`/mode-3d/${game.slug}`} className={cardClass}>{content}</Link>;
}

export default function WorldGallery() {
  return (
    <div className="portal-container portal-page universe-gallery">
      <div className="world-intro">
        <PortalHeading eyebrow="UNE AUTRE DIMENSION" title="Des mondes à explorer." description="Construis ton refuge, défie tes amis ou ose l’inconnu. Les univers 3D de Pixolud t’attendent, directement dans ton navigateur." />
        <div className="world-count"><strong>{playableGames3D().length.toString().padStart(2, "0")}</strong><span>mondes jouables<br />sans installation</span></div>
      </div>
      <div className="section-title"><h2>Mode 3D</h2><span>La sélection Pixolud</span></div>
      <div className="world-grid">{GAMES_3D.map(game => <GameCard key={game.slug} game={game} />)}</div>
      <p className="universe-art-note">Illustrations d’ambiance originales — le rendu en jeu peut différer.</p>
      <div className="portal-note"><span>Ton prochain univers commence ici.</span><Link href="/editeur">Crée un mini-jeu 2D <span aria-hidden="true">↗</span></Link></div>
    </div>
  );
}
