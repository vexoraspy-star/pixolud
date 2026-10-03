"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import "@/app/colosses-polish.css";
import ColossesScene, { type ColossesEtat, type ColossesOptions } from "./ColossesScene";
import {
  COLOSSES,
  COLOSSE_ORDER,
  COUT_BRISE,
  DIFFICULTES,
  ENERGIE_MAX,
  colosseOmbre,
  echelleTournoi,
  listeDesCoups,
  type Colosse,
  type ColosseId,
  type Difficulte,
} from "@/lib/colosses";

/**
 * Colosses : tout ce qui entoure le combat.
 *
 * Un jeu de combat se juge en trois secondes : on choisit un personnage et on
 * tape. Le menu tient donc sur un ecran — mode, personnage, c'est parti — et
 * les commandes restent affichees pendant le combat, parce que personne ne
 * retient huit touches du premier coup. La liste complete des coups (combos,
 * pouvoirs, furie, coup de grace) est dans le menu et dans la pause (Echap).
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
  comboA: null,
  comboB: null,
  indice: "",
};

/** Les touches de chaque joueur, pour l'aide a l'ecran. */
const TOUCHES_AIDE = {
  solo: { bouger: "Q D / ← →", sauter: "Z / ↑", baisser: "S / ↓", poing: "F", pied: "G", pouvoir: "H", garde: "Espace" },
  j1: { bouger: "Q D", sauter: "Z", baisser: "S", poing: "F", pied: "G", pouvoir: "H", garde: "Espace" },
  j2: { bouger: "← →", sauter: "↑", baisser: "↓", poing: "O", pied: "P", pouvoir: "M", garde: "L" },
};

interface Message {
  id: number;
  cote: "A" | "B" | null;
  texte: string;
}

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
  const [pause, setPause] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  /** Le combattant dont on lit la liste des coups (menu et pause). */
  const [fiche, setFiche] = useState<ColosseId | null>(null);
  const prochainMessage = useRef(1);

  // Le moteur appelle onEtat ~60 fois par seconde : on ne redessine que
  // lorsqu'un chiffre affiche change vraiment, sinon React travaille pour rien.
  const dernier = useRef("");
  function recevoirEtat(e: ColossesEtat) {
    const signature = [
      Math.ceil(e.vieA),
      Math.ceil(e.vieB),
      Math.round(e.energieA),
      Math.round(e.energieB),
      e.roundsA,
      e.roundsB,
      e.round,
      e.temps,
      e.annonce,
      e.comboA ? `${e.comboA.coups}/${e.comboA.pourcent}` : "",
      e.comboB ? `${e.comboB.coups}/${e.comboB.pourcent}` : "",
      e.indice,
    ].join("|");
    if (signature === dernier.current) return;
    dernier.current = signature;
    setEtat(e);
  }

  function recevoirMessage(cote: "A" | "B" | null, texte: string) {
    const id = prochainMessage.current++;
    setMessages((m) => [...m.filter((x) => x.cote !== cote || x.texte !== texte), { id, cote, texte }].slice(-4));
    window.setTimeout(() => setMessages((m) => m.filter((x) => x.id !== id)), 1400);
  }

  // Echap : pause pendant le combat (et reprise).
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape" && ecran === "combat") setPause((p) => !p);
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
    setPause(false);
    setMessages([]);
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

  const options: ColossesOptions = { contreOrdinateur, difficulte: niveau, volume, boss, pause };
  const a = COLOSSES[persoA];
  const b = boss ? colosseOmbre(adversaire) : COLOSSES[adversaire];
  const dernierCombat = etape >= echelle.length - 1;
  const touchesJ1 = contreOrdinateur ? TOUCHES_AIDE.solo : TOUCHES_AIDE.j1;

  // ================================================================= menu
  if (ecran === "menu") {
    const lue = COLOSSES[fiche ?? persoA];
    return (
      <div className="colosses-menu colosses-selection">
        <div className="colosses-menu-inner">
          <Link href="/mode-3d" className="colosses-retour">
            ← Mode 3D
          </Link>

          <header className="colosses-hero">
          <div className="colosses-hero-copy">
          <p className="colosses-kicker">PIXOLUD ORIGINAL · COMBAT 1 CONTRE 1</p>
          <h1 className="colosses-titre" aria-label={title}>COLOSSES<span>Entre dans l’arène.</span></h1>
          <p className="colosses-sous-titre">
            Deux combattants, trois rounds, un seul debout. Bloque, enchaîne les combos, lance tes pouvoirs, déchaîne
            ta furie — et achève ton adversaire d&apos;un coup de grâce.
          </p>
          <div className="colosses-reperes"><span>04 combattants</span><span>12 pouvoirs</span><span>04 coups de grâce</span></div>
          <a className="colosses-decouvrir" href="#colosses-combattants">Choisis ton combattant <span aria-hidden="true">↘</span></a>
          </div>
          <div className="colosses-affiche" aria-hidden="true">
            <span className="colosses-affiche-label">LE FACE-À-FACE</span>
            <Image className="colosses-affiche-a" src={`/covers/colosses/${persoA}.webp`} alt="" width={560} height={640} priority unoptimized />
            <b className="colosses-vs">VS</b>
            <Image className="colosses-affiche-b" src={`/covers/colosses/${adversaire}.webp`} alt="" width={560} height={640} priority unoptimized />
            <div className="colosses-affiche-noms"><span>{a.nom}</span><span>{b.nom}</span></div>
          </div>
          </header>

          <section className="colosses-bloc colosses-modes">
            <h2><span>01</span> Ton terrain de jeu</h2>
            <div className="colosses-choix">
              <button type="button" aria-pressed={mode === "libre"} onClick={() => setMode("libre")}>
                <span className="colosses-mode-icon" aria-hidden="true">↗</span><span>Combat libre<small>Un duel, à ton rythme</small></span>
              </button>
              <button type="button" aria-pressed={mode === "tournoi"} onClick={() => setMode("tournoi")}>
                <span className="colosses-mode-icon" aria-hidden="true">♜</span><span>Tournoi<small>Gravis les quatre échelons</small></span>
              </button>
              <button type="button" aria-pressed={mode === "duo"} onClick={() => setMode("duo")}>
                <span className="colosses-mode-icon" aria-hidden="true">Ⅱ</span><span>À deux sur ce clavier<small>Défie quelqu’un à tes côtés</small></span>
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

          <section className="colosses-bloc" id="colosses-combattants">
            <h2><span>02</span> Choisis ton camp</h2>
            <div className="colosses-grille">
              {COLOSSE_ORDER.map((id) => {
                const c = COLOSSES[id];
                const estA = persoA === id;
                const estB = !enTournoi && persoB === id;
                return (
                  <div key={id} data-combattant={id} className={`colosses-carte${estA ? " est-a" : ""}${estB ? " est-b" : ""}`}>
                    <div className="colosses-portrait">
                      <span className="colosses-portrait-num" aria-hidden="true">0{COLOSSE_ORDER.indexOf(id) + 1}</span>
                      <Image src={`/covers/colosses/${id}.webp`} alt={`Portrait de ${c.nom}`} width={560} height={640} unoptimized />
                      <span className="colosses-emoji" aria-hidden="true">{c.emoji}</span>
                      <div className="colosses-selection-label">{estA && <span>JOUEUR 1</span>}{estB && <span>{contreOrdinateur ? "ORDINATEUR" : "JOUEUR 2"}</span>}</div>
                    </div>
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
            <h2><span>03</span> Prends le dessus</h2>
            <div className="colosses-touches">
              <div>
                <h3>Joueur 1</h3>
                <ToucheLigne t={touchesJ1} />
              </div>
              <div>
                <h3>{contreOrdinateur ? "Ordinateur" : "Joueur 2"}</h3>
                {contreOrdinateur ? (
                  <p>Il réagit avec un temps de retard, comme un vrai adversaire : il lève la garde, contre tes sauts et punit tes coups ratés.</p>
                ) : (
                  <ToucheLigne t={TOUCHES_AIDE.j2} />
                )}
              </div>
            </div>
            <p className="colosses-note">
              <b>Bloquer</b> : garde (ou recule sans frapper). Debout contre les coups hauts et sautés, <b>accroupi</b> contre
              les coups bas et la balayette. <b>Pouvoirs</b> : ↓ → + Poing, ← → + Poing, ↓ ← + Pied — ou plus simple, la
              touche Pouvoir (seule, avec →, avec ↓). Barre pleine : <b>Garde + Pouvoir</b> déclenche la furie. Au dernier
              round, « Achève-le ! » : <b>↓ → ↓ + Pouvoir</b> pour le coup de grâce.
            </p>
          </section>

          <section className="colosses-bloc">
            <h2><span>04</span> Liste des coups</h2>
            <div className="colosses-onglets" role="tablist" aria-label="Combattant">
              {COLOSSE_ORDER.map((id) => (
                <button key={id} type="button" role="tab" aria-selected={lue.id === id} onClick={() => setFiche(id)}>
                  {COLOSSES[id].emoji} {COLOSSES[id].nom}
                </button>
              ))}
            </div>
            <ListeCoups perso={lue} />
          </section>

          <div className="colosses-bas">
            <div className="colosses-match"><small>{enTournoi ? "TON PARCOURS COMMENCE" : "LE DUEL EST PRÊT"}</small><strong>{a.nom} <span>vs</span> {b.nom}</strong></div>
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
  const annonceKo = etat.annonce.startsWith("K.O.") || etat.annonce.startsWith("Coup de grâce");
  const annonceGo = etat.annonce === "Combattez !";
  const annonceAcheve = etat.annonce.startsWith("Achève");
  const lueEnPause = COLOSSES[fiche ?? persoA];

  return (
    <div className="colosses-arene">
      <ColossesScene
        key={manche}
        persoA={persoA}
        persoB={adversaire}
        options={options}
        onEtat={recevoirEtat}
        onMessage={recevoirMessage}
        onFin={(v) => {
          setVainqueur(v);
          setPause(false);
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
          combo={etat.comboA}
          messages={messages.filter((m) => m.cote === "A")}
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
          combo={etat.comboB}
          messages={messages.filter((m) => m.cote === "B")}
          droite
        />
      </div>

      {etat.annonce && ecran === "combat" && (
        <div
          key={etat.annonce}
          className={`colosses-annonce${annonceKo ? " est-ko" : ""}${annonceGo ? " est-go" : ""}${annonceAcheve ? " est-acheve" : ""}`}
        >
          <span>{etat.annonce}</span>
          {etat.indice && <small className="colosses-indice">{etat.indice}</small>}
        </div>
      )}

      {/* --- Les touches, sous les yeux pendant tout le combat --- */}
      {ecran === "combat" && !pause && (
        <div className="colosses-aide" aria-label="Commandes">
          <AideTouches titre={contreOrdinateur ? null : "J1"} t={touchesJ1} />
          {!contreOrdinateur && <AideTouches titre="J2" t={TOUCHES_AIDE.j2} />}
          <p className="colosses-aide-astuce">Échap : pause et liste des coups</p>
        </div>
      )}

      {pause && ecran === "combat" && (
        <div className="colosses-pause" role="dialog" aria-modal="true" aria-label="Pause">
          <div className="colosses-pause-boite">
            <p className="colosses-pause-titre">Pause</p>
            <div className="colosses-onglets" role="tablist" aria-label="Combattant">
              {[persoA, adversaire]
                .filter((id, i, l) => l.indexOf(id) === i)
                .map((id) => (
                  <button key={id} type="button" role="tab" aria-selected={lueEnPause.id === id} onClick={() => setFiche(id)}>
                    {COLOSSES[id].emoji} {COLOSSES[id].nom}
                  </button>
                ))}
            </div>
            <ListeCoups perso={lueEnPause} />
            <div className="colosses-fin-boutons">
              <button type="button" onClick={() => setPause(false)}>
                ▶ Reprendre (Échap)
              </button>
              <button
                type="button"
                onClick={() => {
                  setPause(false);
                  setEcran("menu");
                }}
              >
                Quitter le combat
              </button>
            </div>
          </div>
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

      {ecran === "combat" && !pause && (
        <button type="button" onClick={() => setPause(true)} className="colosses-quitter">
          Échap — pause
        </button>
      )}
    </div>
  );
}

type TouchesAide = (typeof TOUCHES_AIDE)["solo"];

function ToucheLigne({ t }: { t: TouchesAide }) {
  return (
    <>
      <p>
        <b>{t.bouger}</b> se déplacer · <b>{t.sauter}</b> sauter · <b>{t.baisser}</b> s&apos;accroupir
      </p>
      <p>
        <b>{t.poing}</b> poing · <b>{t.pied}</b> pied · <b>{t.pouvoir}</b> pouvoir · <b>{t.garde}</b> garde
      </p>
    </>
  );
}

function AideTouches({ titre, t }: { titre: string | null; t: TouchesAide }) {
  return (
    <div className="colosses-aide-ligne">
      {titre && <strong>{titre}</strong>}
      <span>
        <b>{t.bouger}</b> bouger
      </span>
      <span>
        <b>{t.sauter}</b> sauter
      </span>
      <span>
        <b>{t.baisser}</b> se baisser
      </span>
      <span>
        <b>{t.poing}</b> poing
      </span>
      <span>
        <b>{t.pied}</b> pied
      </span>
      <span>
        <b>{t.pouvoir}</b> pouvoir
      </span>
      <span>
        <b>{t.garde}</b> garde
      </span>
    </div>
  );
}

/** La liste des coups d'un combattant : les bases, ses pouvoirs, sa furie, son coup de grace. */
function ListeCoups({ perso }: { perso: Colosse }) {
  const l = listeDesCoups(perso);
  const ligne = (c: { touches: string; nom: string; detail: string }, cle: string, classe = "") => (
    <li key={cle} className={classe}>
      <span className="colosses-coup-touches">{c.touches}</span>
      <span className="colosses-coup-nom">{c.nom}</span>
      <span className="colosses-coup-detail">{c.detail}</span>
    </li>
  );
  return (
    <div className="colosses-coups" data-combattant={perso.id}>
      <div>
        <h3>Pouvoirs de {perso.nom}</h3>
        <ul>
          {l.pouvoirs.map((c, i) => ligne(c, `p${i}`, "est-pouvoir"))}
          {ligne(l.furie, "furie", "est-furie")}
          {ligne(l.grace, "grace", "est-grace")}
        </ul>
      </div>
      <div>
        <h3>Coups de base</h3>
        <ul>{l.base.map((c, i) => ligne(c, `b${i}`))}</ul>
      </div>
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
  combo,
  messages,
  droite = false,
}: {
  nom: string;
  emoji: string;
  vie: number;
  vieMax: number;
  energie: number;
  rounds: number;
  couleur: number;
  combo: { coups: number; pourcent: number } | null;
  messages: Message[];
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
      <div className={`colosses-energie${energie >= ENERGIE_MAX ? " est-pleine" : ""}`}>
        <i style={{ width: `${(energie / ENERGIE_MAX) * 100}%`, background: teinte }} />
        <em style={{ insetInlineStart: `${(COUT_BRISE / ENERGIE_MAX) * 100}%` }} aria-hidden="true" />
        {energie >= ENERGIE_MAX && <span>FURIE PRÊTE</span>}
      </div>
      <div className="colosses-flux" aria-live="polite">
        {combo && (
          <p className="colosses-combo">
            <b>{combo.coups}</b> coups · {combo.pourcent} %
          </p>
        )}
        {messages.map((m) => (
          <p key={m.id} className="colosses-message">
            {m.texte}
          </p>
        ))}
      </div>
    </div>
  );
}
