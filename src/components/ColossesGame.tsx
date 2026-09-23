"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ColossesScene, { type ColossesEtat, type ColossesOptions } from "./ColossesScene";
import {
  COLOSSES,
  COLOSSE_ORDER,
  DIFFICULTES,
  ENERGIE_MAX,
  colosseOmbre,
  echelleTournoi,
  type ColosseId,
  type Difficulte,
} from "@/lib/colosses";

/**
 * Colosses : tout ce qui entoure le combat.
 *
 * Un jeu de combat se juge en trois secondes : on choisit un personnage et on
 * tape. Le menu tient donc sur un ecran — mode, personnage, c'est parti — et
 * les commandes restent affichees pendant le combat, parce que personne ne
 * retient sept touches du premier coup.
 *
 * Trois facons de jouer : un combat libre contre l'ordinateur, le tournoi
 * (les trois autres combattants puis son propre reflet), ou a deux sur le
 * meme clavier.
 */
type Ecran = "menu" | "echelle" | "combat" | "fin";
type Mode = "libre" | "tournoi" | "duo";

const VIDE: ColossesEtat = {
  vieA: 100,
  vieB: 100,
  energieA: 0,
  energieB: 0,
  roundsA: 0,
  roundsB: 0,
  round: 1,
  temps: 60,
  annonce: "",
  vainqueur: null,
};

export default function ColossesGame({ title }: { title: string }) {
  const [ecran, setEcran] = useState<Ecran>("menu");
  const [mode, setMode] = useState<Mode>("libre");
  const [persoA, setPersoA] = useState<ColosseId>("lame");
  const [persoB, setPersoB] = useState<ColosseId>("roc");
  // Tranquille par defaut : un premier combat doit se gagner, sinon on ne
  // revient pas. Les deux autres niveaux sont a un clic.
  const [difficulte, setDifficulte] = useState<Difficulte>("tranquille");
  const [volume, setVolume] = useState(0.6);
  const [etat, setEtat] = useState<ColossesEtat>(VIDE);
  const [vainqueur, setVainqueur] = useState<"A" | "B" | null>(null);
  const [manche, setManche] = useState(0);
  /** Position dans le tournoi (0 = premier combat). */
  const [etape, setEtape] = useState(0);

  // Le moteur appelle onEtat ~60 fois par seconde : on ne redessine que
  // lorsqu'un chiffre affiche change vraiment, sinon React travaille pour rien.
  const dernier = useRef("");
  function recevoirEtat(e: ColossesEtat) {
    const signature = `${Math.ceil(e.vieA)}|${Math.ceil(e.vieB)}|${Math.round(e.energieA)}|${Math.round(
      e.energieB,
    )}|${e.roundsA}|${e.roundsB}|${e.round}|${e.temps}|${e.annonce}`;
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

  const echelle = echelleTournoi(persoA);
  const etapeCourante = echelle[Math.min(etape, echelle.length - 1)];
  const enTournoi = mode === "tournoi";
  const contreOrdinateur = mode !== "duo";

  // Qui est en face, et a quel niveau : en tournoi, c'est l'echelle qui decide.
  const adversaire = enTournoi ? etapeCourante.adversaire : persoB;
  const boss = enTournoi && etapeCourante.boss;
  const niveau = enTournoi ? etapeCourante.difficulte : difficulte;

  function combattre() {
    setVainqueur(null);
    setEtat(VIDE);
    dernier.current = "";
    setManche((m) => m + 1);
    setEcran("combat");
  }

  function commencer() {
    if (enTournoi) {
      setEtape(0);
      setEcran("echelle");
    } else {
      combattre();
    }
  }

  const options: ColossesOptions = { contreOrdinateur, difficulte: niveau, volume, boss };
  const a = COLOSSES[persoA];
  const b = boss ? colosseOmbre(adversaire) : COLOSSES[adversaire];
  const dernierCombat = etape >= echelle.length - 1;

  // ================================================================= menu
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
              <button type="button" aria-pressed={mode === "libre"} onClick={() => setMode("libre")}>
                🤖 Combat libre
              </button>
              <button type="button" aria-pressed={mode === "tournoi"} onClick={() => setMode("tournoi")}>
                🏆 Tournoi
              </button>
              <button type="button" aria-pressed={mode === "duo"} onClick={() => setMode("duo")}>
                👥 À deux sur ce clavier
              </button>
            </div>
            {mode === "libre" && (
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
            {mode === "tournoi" && (
              <p className="colosses-note">
                Quatre combats d&apos;affilée : les trois autres combattants, de plus en plus coriaces, puis{" "}
                <b>ton propre reflet</b> — plus grand, plus solide, et il connaît tous tes coups. Une défaite ? Tu
                retentes le même combat.
              </p>
            )}
          </section>

          <section className="colosses-bloc">
            <h2>Les combattants</h2>
            <div className="colosses-grille">
              {COLOSSE_ORDER.map((id) => {
                const c = COLOSSES[id];
                const estA = persoA === id;
                const estB = !enTournoi && persoB === id;
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
                        {enTournoi ? (estA ? "Choisi ✓" : "Choisir") : estA ? "Joueur 1 ✓" : "Joueur 1"}
                      </button>
                      {!enTournoi && (
                        <button type="button" onClick={() => setPersoB(id)} disabled={estB}>
                          {estB ? (contreOrdinateur ? "Ordinateur ✓" : "Joueur 2 ✓") : contreOrdinateur ? "Ordinateur" : "Joueur 2"}
                        </button>
                      )}
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
                  <b>Q</b> / <b>D</b>
                  {contreOrdinateur && (
                    <>
                      {" "}
                      ou <b>←</b> / <b>→</b>
                    </>
                  )}{" "}
                  se déplacer · <b>Z</b>
                  {contreOrdinateur && (
                    <>
                      {" "}
                      ou <b>↑</b>
                    </>
                  )}{" "}
                  sauter · <b>S</b>
                  {contreOrdinateur && (
                    <>
                      {" "}
                      ou <b>↓</b>
                    </>
                  )}{" "}
                  s&apos;accroupir
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
              rien. Un direct passe au-dessus d&apos;un adversaire accroupi, l&apos;onde de choc s&apos;évite en sautant
              ou en se baissant, et le spécial ne part qu&apos;avec la barre d&apos;énergie pleine.
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
            <button type="button" onClick={commencer} className="colosses-jouer">
              {enTournoi ? "🏆 Lancer le tournoi" : "⚔️ Combattre"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =============================================================== echelle
  // Entre deux combats du tournoi : la tour des adversaires, du bas (premier
  // combat) vers le haut (le reflet). On voit d'ou l'on vient et ce qui reste.
  if (ecran === "echelle") {
    return (
      <div className="colosses-menu">
        <div className="colosses-menu-inner colosses-echelle">
          <button type="button" className="colosses-retour" onClick={() => setEcran("menu")}>
            ← Quitter le tournoi
          </button>
          <h1 className="colosses-titre">Tournoi</h1>
          <p className="colosses-sous-titre">
            Combat {etape + 1} sur {echelle.length} · {a.emoji} {a.nom} contre {b.emoji} {b.nom}
          </p>
          <ol className="colosses-tour">
            {[...echelle].reverse().map((e, iInverse) => {
              const i = echelle.length - 1 - iInverse;
              const c = e.boss ? colosseOmbre(e.adversaire) : COLOSSES[e.adversaire];
              const statut = i < etape ? "battu" : i === etape ? "actuel" : "a-venir";
              return (
                <li key={i} className={`est-${statut}${e.boss ? " est-boss" : ""}`}>
                  <span className="colosses-tour-num">{i + 1}</span>
                  <span className="colosses-emoji" aria-hidden="true">
                    {c.emoji}
                  </span>
                  <span className="colosses-tour-nom">
                    <strong>{c.nom}</strong>
                    <small>{DIFFICULTES[e.difficulte].label}</small>
                  </span>
                  <span className="colosses-tour-statut">
                    {statut === "battu" ? "✓ Battu" : statut === "actuel" ? "▶ À toi" : e.boss ? "Boss" : ""}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="colosses-bas">
            <button type="button" onClick={combattre} className="colosses-jouer">
              ⚔️ {boss ? "Affronter ton reflet" : "Combattre"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ================================================================ combat
  const gagne = vainqueur === "A";
  const champion = enTournoi && gagne && dernierCombat;
  const annonceKo = etat.annonce.startsWith("K.O.");
  const annonceGo = etat.annonce === "Combattez !";

  return (
    <div className="colosses-arene">
      <ColossesScene
        key={manche}
        persoA={persoA}
        persoB={adversaire}
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
          <span>{enTournoi ? `Combat ${etape + 1}/${echelle.length} · ` : ""}Round {etat.round}</span>
        </div>
        <Jauge
          nom={contreOrdinateur && !boss ? `${b.nom} (ordi)` : b.nom}
          emoji={b.emoji}
          vie={etat.vieB}
          vieMax={b.vie}
          energie={etat.energieB}
          rounds={etat.roundsB}
          couleur={b.accent}
          droite
        />
      </div>

      {etat.annonce && ecran === "combat" && (
        <div
          key={etat.annonce}
          className={`colosses-annonce${annonceKo ? " est-ko" : ""}${annonceGo ? " est-go" : ""}`}
        >
          {etat.annonce}
        </div>
      )}

      {/* --- Les touches, sous les yeux pendant tout le combat --- */}
      {ecran === "combat" && (
        <div className="colosses-aide" aria-label="Commandes">
          <AideTouches
            titre={contreOrdinateur ? null : "J1"}
            bouger={contreOrdinateur ? "Q D / ← →" : "Q D"}
            sauter={contreOrdinateur ? "Z / ↑" : "Z"}
            baisser={contreOrdinateur ? "S / ↓" : "S"}
            poing="F"
            pied="G"
            special="H"
          />
          {!contreOrdinateur && (
            <AideTouches titre="J2" bouger="← →" sauter="↑" baisser="↓" poing="O" pied="P" special="M" />
          )}
          <p className="colosses-aide-astuce">Reculer = bloquer</p>
        </div>
      )}

      {ecran === "fin" && (
        <div className="colosses-fin">
          <div>
            <p className="colosses-fin-titre">
              {champion
                ? "🏆 Champion du tournoi !"
                : vainqueur === "A"
                  ? `${a.emoji} ${a.nom} l'emporte !`
                  : `${b.emoji} ${b.nom} l'emporte !`}
            </p>
            <p className="colosses-fin-score">
              {etat.roundsA} — {etat.roundsB}
            </p>
            {champion && (
              <p className="colosses-fin-texte">
                Tu as battu les trois combattants, puis ton propre reflet. Essaie maintenant avec un autre personnage.
              </p>
            )}
            {enTournoi && !gagne && (
              <p className="colosses-fin-texte">
                Pas grave : tu reprends au combat {etape + 1}, pas depuis le début.
              </p>
            )}
            <div className="colosses-fin-boutons">
              {enTournoi && gagne && !dernierCombat && (
                <button
                  type="button"
                  onClick={() => {
                    setEtape((e) => e + 1);
                    setEcran("echelle");
                  }}
                >
                  Combat suivant →
                </button>
              )}
              {enTournoi && !gagne && (
                <button type="button" onClick={combattre}>
                  ↻ Retenter ce combat
                </button>
              )}
              {!enTournoi && (
                <button type="button" onClick={combattre}>
                  ↻ Revanche
                </button>
              )}
              <button type="button" onClick={() => setEcran("menu")}>
                {champion ? "Nouveau tournoi" : enTournoi ? "Quitter le tournoi" : "Changer de combattant"}
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

function AideTouches({
  titre,
  bouger,
  sauter,
  baisser,
  poing,
  pied,
  special,
}: {
  titre: string | null;
  bouger: string;
  sauter: string;
  baisser: string;
  poing: string;
  pied: string;
  special: string;
}) {
  return (
    <div className="colosses-aide-ligne">
      {titre && <strong>{titre}</strong>}
      <span>
        <b>{bouger}</b> bouger
      </span>
      <span>
        <b>{sauter}</b> sauter
      </span>
      <span>
        <b>{baisser}</b> se baisser
      </span>
      <span>
        <b>{poing}</b> direct
      </span>
      <span>
        <b>{pied}</b> pied
      </span>
      <span>
        <b>{special}</b> spécial
      </span>
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
