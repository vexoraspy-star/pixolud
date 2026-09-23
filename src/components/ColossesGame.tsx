"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ColossesScene, { type ColossesEtat, type ColossesOptions } from "./ColossesScene";
import {
  COLOSSES,
  COLOSSE_ORDER,
  DIFFICULTES,
  ENERGIE_MAX,
  type ColosseId,
  type Difficulte,
} from "@/lib/colosses";

/**
 * Colosses : tout ce qui entoure le combat.
 *
 * Un jeu de combat se juge en trois secondes : on choisit un personnage et on
 * tape. Le menu tient donc sur un ecran — mode, personnage, c'est parti — et
 * les commandes restent affichees pendant le combat pour les deux joueurs,
 * parce que personne ne retient six touches du premier coup.
 */
type Ecran = "menu" | "combat" | "fin";

const VIDE: ColossesEtat = {
  vieA: 100,
  vieB: 100,
  energieA: 0,
  energieB: 0,
  roundsA: 0,
  roundsB: 0,
  temps: 60,
  annonce: "",
  vainqueur: null,
};

export default function ColossesGame({ title }: { title: string }) {
  const [ecran, setEcran] = useState<Ecran>("menu");
  const [persoA, setPersoA] = useState<ColosseId>("lame");
  const [persoB, setPersoB] = useState<ColosseId>("roc");
  const [contreOrdinateur, setContreOrdinateur] = useState(true);
  // Tranquille par defaut : un premier combat doit se gagner, sinon on ne
  // revient pas. Les deux autres niveaux sont a un clic.
  const [difficulte, setDifficulte] = useState<Difficulte>("tranquille");
  const [volume, setVolume] = useState(0.6);
  const [etat, setEtat] = useState<ColossesEtat>(VIDE);
  const [vainqueur, setVainqueur] = useState<"A" | "B" | null>(null);
  const [manche, setManche] = useState(0);

  // Le moteur appelle onEtat ~60 fois par seconde : on ne redessine que
  // lorsqu'un chiffre affiche change vraiment, sinon React travaille pour rien.
  const dernier = useRef("");
  function recevoirEtat(e: ColossesEtat) {
    const signature = `${Math.ceil(e.vieA)}|${Math.ceil(e.vieB)}|${Math.round(e.energieA)}|${Math.round(
      e.energieB,
    )}|${e.roundsA}|${e.roundsB}|${e.temps}|${e.annonce}`;
    if (signature === dernier.current) return;
    dernier.current = signature;
    setEtat(e);
  }

  // Echap : revenir au menu depuis le combat.
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape" && ecran === "combat") setEcran("menu");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ecran]);

  function lancer() {
    setVainqueur(null);
    setEtat(VIDE);
    dernier.current = "";
    setManche((m) => m + 1);
    setEcran("combat");
  }

  const options: ColossesOptions = { contreOrdinateur, difficulte, volume };
  const a = COLOSSES[persoA];
  const b = COLOSSES[persoB];

  if (ecran === "menu") {
    return (
      <div className="colosses-menu">
        <div className="colosses-menu-inner">
          <Link href="/mode-3d" className="colosses-retour">
            ← Mode 3D
          </Link>

          <h1 className="colosses-titre">{title}</h1>
          <p className="colosses-sous-titre">
            Deux combattants, trois rounds, un seul debout. Frappe, bloque, saute — et garde ton coup spécial pour le
            bon moment.
          </p>

          <section className="colosses-bloc">
            <h2>Mode de jeu</h2>
            <div className="colosses-choix">
              <button type="button" aria-pressed={contreOrdinateur} onClick={() => setContreOrdinateur(true)}>
                🤖 Contre l&apos;ordinateur
              </button>
              <button type="button" aria-pressed={!contreOrdinateur} onClick={() => setContreOrdinateur(false)}>
                👥 À deux sur ce clavier
              </button>
            </div>
            {contreOrdinateur && (
              <>
                <div className="colosses-choix colosses-choix-petit">
                  {(Object.keys(DIFFICULTES) as Difficulte[]).map((d) => (
                    <button key={d} type="button" aria-pressed={difficulte === d} onClick={() => setDifficulte(d)}>
                      {DIFFICULTES[d].label}
                    </button>
                  ))}
                </div>
                <p className="colosses-note">{DIFFICULTES[difficulte].texte}</p>
              </>
            )}
          </section>

          <section className="colosses-bloc">
            <h2>Les combattants</h2>
            <div className="colosses-grille">
              {COLOSSE_ORDER.map((id) => {
                const c = COLOSSES[id];
                const estA = persoA === id;
                const estB = persoB === id;
                return (
                  <div key={id} className={`colosses-carte${estA ? " est-a" : ""}${estB ? " est-b" : ""}`}>
                    <span className="colosses-emoji" aria-hidden="true">
                      {c.emoji}
                    </span>
                    <strong>{c.nom}</strong>
                    <span className="colosses-phrase">{c.phrase}</span>
                    <ul className="colosses-stats">
                      <li>
                        Vie <i style={{ width: `${(c.vie / 190) * 100}%` }} />
                      </li>
                      <li>
                        Force <i style={{ width: `${(c.force / 1.25) * 100}%` }} />
                      </li>
                      <li>
                        Vitesse <i style={{ width: `${(c.vitesse / 1.3) * 100}%` }} />
                      </li>
                    </ul>
                    <span className="colosses-special">✨ {c.specialTexte}</span>
                    <div className="colosses-prendre">
                      <button type="button" onClick={() => setPersoA(id)} disabled={estA}>
                        {estA ? "Joueur 1 ✓" : "Joueur 1"}
                      </button>
                      <button type="button" onClick={() => setPersoB(id)} disabled={estB}>
                        {estB ? (contreOrdinateur ? "Ordinateur ✓" : "Joueur 2 ✓") : contreOrdinateur ? "Ordinateur" : "Joueur 2"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="colosses-bloc">
            <h2>Les commandes</h2>
            <div className="colosses-touches">
              <div>
                <h3>Joueur 1</h3>
                <p>
                  <b>Q</b> / <b>D</b> se déplacer · <b>Z</b> sauter · <b>S</b> s&apos;accroupir
                </p>
                <p>
                  <b>F</b> direct · <b>G</b> coup de pied · <b>H</b> spécial
                </p>
              </div>
              <div>
                <h3>{contreOrdinateur ? "Ordinateur" : "Joueur 2"}</h3>
                {contreOrdinateur ? (
                  <p>Il réagit avec un temps de retard, comme un vrai adversaire.</p>
                ) : (
                  <>
                    <p>
                      <b>←</b> / <b>→</b> se déplacer · <b>↑</b> sauter · <b>↓</b> s&apos;accroupir
                    </p>
                    <p>
                      <b>O</b> direct · <b>P</b> coup de pied · <b>M</b> spécial
                    </p>
                  </>
                )}
              </div>
            </div>
            <p className="colosses-note">
              Pour <b>bloquer</b>, recule sans frapper : ton personnage lève la garde et n&apos;encaisse presque plus
              rien. Un coup haut passe au-dessus d&apos;un adversaire accroupi, et le spécial ne part qu&apos;avec la
              barre d&apos;énergie pleine.
            </p>
          </section>

          <div className="colosses-bas">
            <label className="colosses-volume">
              Volume
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
              />
            </label>
            <button type="button" onClick={lancer} className="colosses-jouer">
              ⚔️ Combattre
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="colosses-arene">
      <ColossesScene
        key={manche}
        persoA={persoA}
        persoB={persoB}
        options={options}
        onEtat={recevoirEtat}
        onFin={(v) => {
          setVainqueur(v);
          setEcran("fin");
        }}
      />

      {/* --- Barres de vie --- */}
      <div className="colosses-hud">
        <Jauge
          nom={a.nom}
          emoji={a.emoji}
          vie={etat.vieA}
          vieMax={a.vie}
          energie={etat.energieA}
          rounds={etat.roundsA}
          couleur={a.accent}
        />
        <div className="colosses-chrono">
          <b>{etat.temps}</b>
          <span>Round {Math.min(3, etat.roundsA + etat.roundsB + 1)}</span>
        </div>
        <Jauge
          nom={contreOrdinateur ? `${b.nom} (ordi)` : b.nom}
          emoji={b.emoji}
          vie={etat.vieB}
          vieMax={b.vie}
          energie={etat.energieB}
          rounds={etat.roundsB}
          couleur={b.accent}
          droite
        />
      </div>

      {etat.annonce && ecran === "combat" && <div className="colosses-annonce">{etat.annonce}</div>}

      {ecran === "fin" && (
        <div className="colosses-fin">
          <div>
            <p className="colosses-fin-titre">
              {vainqueur === "A" ? `${a.emoji} ${a.nom} l'emporte !` : `${b.emoji} ${b.nom} l'emporte !`}
            </p>
            <p className="colosses-fin-score">
              {etat.roundsA} — {etat.roundsB}
            </p>
            <div className="colosses-fin-boutons">
              <button type="button" onClick={lancer}>
                ↻ Revanche
              </button>
              <button type="button" onClick={() => setEcran("menu")}>
                Changer de combattant
              </button>
              <Link href="/mode-3d">Quitter</Link>
            </div>
          </div>
        </div>
      )}

      {ecran === "combat" && (
        <button type="button" onClick={() => setEcran("menu")} className="colosses-quitter">
          Échap — menu
        </button>
      )}
    </div>
  );
}

function Jauge({
  nom,
  emoji,
  vie,
  vieMax,
  energie,
  rounds,
  couleur,
  droite = false,
}: {
  nom: string;
  emoji: string;
  vie: number;
  vieMax: number;
  energie: number;
  rounds: number;
  couleur: number;
  droite?: boolean;
}) {
  const part = Math.max(0, Math.min(1, vie / vieMax));
  const teinte = `#${couleur.toString(16).padStart(6, "0")}`;
  return (
    <div className={`colosses-jauge${droite ? " est-droite" : ""}`}>
      <div className="colosses-jauge-nom">
        <span aria-hidden="true">{emoji}</span>
        <b>{nom}</b>
        <span className="colosses-rounds" aria-label={`${rounds} round gagné`}>
          {"●".repeat(rounds)}
          {"○".repeat(Math.max(0, 2 - rounds))}
        </span>
      </div>
      <div className="colosses-vie" role="progressbar" aria-valuenow={Math.round(part * 100)} aria-valuemin={0} aria-valuemax={100}>
        <i style={{ width: `${part * 100}%`, background: part > 0.3 ? undefined : "#e0473c" }} />
      </div>
      <div className="colosses-energie">
        <i style={{ width: `${(energie / ENERGIE_MAX) * 100}%`, background: teinte }} />
        {energie >= ENERGIE_MAX && <span>SPÉCIAL PRÊT</span>}
      </div>
    </div>
  );
}
