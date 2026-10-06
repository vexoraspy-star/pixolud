"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { genererGrille, motDuTrait, traceSelection, type MotsMelesData } from "@/lib/motsMeles";
import { createClient } from "@/lib/supabase/client";

/**
 * Mots meles, cote joueur.
 *
 * On trace un trait sur la grille (souris ou doigt) : il se cale tout seul sur
 * la direction la plus proche, on n'a pas besoin de viser au pixel pres. Sans
 * glisser, on peut aussi cliquer la premiere lettre puis la derniere (et au
 * clavier : Entree sur une lettre, puis sur une autre).
 */

/** Une couleur par mot trouve, lisible en theme clair comme en sombre. */
const COULEURS = ["#fde68a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#ddd6fe", "#fed7aa", "#a5f3fc", "#fecaca", "#d9f99d", "#e9d5ff"];

type Case = [number, number];

const memeCase = (a: Case | null, b: Case | null) => !!a && !!b && a[0] === b[0] && a[1] === b[1];

function duree(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export default function MotsMelesPlayer({
  data,
  gameId,
  countsAsPlay = false,
}: {
  data: MotsMelesData;
  gameId?: string;
  countsAsPlay?: boolean;
}) {
  const grille = useMemo(() => genererGrille(data), [data]);
  const [trouves, setTrouves] = useState<{ norm: string; cases: Case[]; couleur: string }[]>([]);
  const [devoiles, setDevoiles] = useState(false);
  /** Le trait en cours : premiere case, case sous le doigt, et s'il est trace en glissant. */
  const [debut, setDebut] = useState<Case | null>(null);
  const [courant, setCourant] = useState<Case | null>(null);
  const [glisse, setGlisse] = useState(false);
  const [rate, setRate] = useState(false);
  const [secondes, setSecondes] = useState(0);
  const [record, setRecord] = useState<{ ancien: number | null; nouveau: boolean } | null>(null);
  const depart = useRef<number | null>(null);
  const hasCountedPlay = useRef(false);

  useEffect(() => {
    if (!countsAsPlay || !gameId || hasCountedPlay.current) return;
    hasCountedPlay.current = true;
    const supabase = createClient();
    supabase.rpc("increment_plays", { game_id: gameId });
  }, [countsAsPlay, gameId]);

  const total = grille?.placements.length ?? 0;
  const fini = devoiles || (total > 0 && trouves.length === total);

  // Le chrono tourne des la premiere lettre touchee, et s'arrete a la fin.
  useEffect(() => {
    if (fini) return;
    const id = window.setInterval(() => {
      if (depart.current !== null) setSecondes((performance.now() - depart.current) / 1000);
    }, 250);
    return () => window.clearInterval(id);
  }, [fini]);

  if (!grille) {
    return <p className="text-sm text-zinc-500">Cette grille n&apos;a pas pu être construite.</p>;
  }

  const taille = grille.taille;
  const trouvesSet = new Set(trouves.map((t) => t.norm));
  const trait = debut ? traceSelection(debut, courant ?? debut, taille) : [];
  const dansTrait = new Set(trait.map(([r, c]) => r * taille + c));
  const couleurCase = new Map<number, string>();
  for (const t of trouves) for (const [r, c] of t.cases) couleurCase.set(r * taille + c, t.couleur);
  const restants = new Set<number>();
  if (devoiles) {
    for (const p of grille.placements) if (!trouvesSet.has(p.norm)) for (const [r, c] of p.cases) restants.add(r * taille + c);
  }

  // Les temps viennent des evenements (e.timeStamp, meme horloge que
  // performance.now) : rien d'impur n'est lu pendant le rendu.
  function demarrer(t: number) {
    if (depart.current === null) depart.current = t;
  }

  function valider(a: Case, b: Case, t: number) {
    const cases = traceSelection(a, b, taille);
    const mot = motDuTrait(grille!, cases, trouvesSet);
    setDebut(null);
    setCourant(null);
    if (!mot) {
      if (cases.length > 1) {
        setRate(true);
        window.setTimeout(() => setRate(false), 450);
      }
      return;
    }
    const suite = [...trouves, { norm: mot.norm, cases, couleur: COULEURS[trouves.length % COULEURS.length] }];
    setTrouves(suite);
    if (suite.length === total && depart.current !== null) {
      const temps = Math.max(0, (t - depart.current) / 1000);
      setSecondes(temps);
      // Le record de cette grille, garde dans ce navigateur.
      if (gameId) {
        const cle = `pixolud-motsmeles-${gameId}`;
        let ancien: number | null = null;
        try {
          const v = Number(window.localStorage.getItem(cle));
          ancien = Number.isFinite(v) && v > 0 ? v : null;
          if (ancien === null || temps < ancien) window.localStorage.setItem(cle, String(Math.round(temps * 10) / 10));
        } catch {
          // Stockage indisponible (navigation privee) : pas de record, pas grave.
        }
        setRecord({ ancien, nouveau: ancien === null || temps < ancien });
      }
    }
  }

  function caseSous(x: number, y: number): Case | null {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-r]");
    if (!el) return null;
    return [Number(el.dataset.r), Number(el.dataset.c)];
  }

  function appui(e: React.PointerEvent<HTMLDivElement>) {
    if (fini) return;
    const c = caseSous(e.clientX, e.clientY);
    if (!c) return;
    e.preventDefault();
    demarrer(e.timeStamp);
    // Deuxieme clic du mode « premiere lettre, puis derniere ».
    if (debut && !glisse && !memeCase(debut, c)) {
      valider(debut, c, e.timeStamp);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setDebut(c);
    setCourant(c);
    setGlisse(true);
  }

  function deplacement(e: React.PointerEvent<HTMLDivElement>) {
    if (!glisse) return;
    const c = caseSous(e.clientX, e.clientY);
    if (c && !memeCase(c, courant)) setCourant(c);
  }

  function relache(e: React.PointerEvent<HTMLDivElement>) {
    if (!glisse) return;
    setGlisse(false);
    // Relache sur la case de depart : on attend la derniere lettre (deux clics).
    if (debut && courant && !memeCase(debut, courant)) valider(debut, courant, e.timeStamp);
  }

  function clavier(e: React.KeyboardEvent<HTMLButtonElement>, c: Case) {
    if (fini || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    demarrer(e.timeStamp);
    if (debut && !memeCase(debut, c)) valider(debut, c, e.timeStamp);
    else {
      setDebut(c);
      setCourant(c);
    }
  }

  function rejouer() {
    setTrouves([]);
    setDevoiles(false);
    setDebut(null);
    setCourant(null);
    setSecondes(0);
    setRecord(null);
    depart.current = null;
  }

  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-4">
      {data.theme?.trim() && (
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">Thème : {data.theme.trim()}</p>
      )}

      <div className="flex w-full items-center justify-between text-xs font-semibold">
        <span className="rounded-full bg-white px-3 py-1 text-zinc-600 shadow-sm dark:bg-zinc-800 dark:text-zinc-300">
          {trouves.length} / {total} mots
        </span>
        <span className="rounded-full bg-white px-3 py-1 tabular-nums text-teal-600 shadow-sm dark:bg-zinc-800 dark:text-teal-400">
          ⏱ {duree(secondes)}
        </span>
      </div>

      <div
        role="grid"
        aria-label="Grille de mots mêlés"
        onPointerDown={appui}
        onPointerMove={deplacement}
        onPointerUp={relache}
        onPointerCancel={relache}
        className={`grid w-full max-w-[min(92vw,560px)] select-none gap-0.5 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm transition dark:border-zinc-800 dark:bg-zinc-900 ${rate ? "animate-pulse ring-2 ring-rose-400" : ""}`}
        style={{ gridTemplateColumns: `repeat(${taille}, minmax(0, 1fr))`, touchAction: "none" }}
      >
        {grille.lettres.map((ligne, r) =>
          ligne.map((lettre, c) => {
            const k = r * taille + c;
            const couleur = couleurCase.get(k);
            const enTrait = dansTrait.has(k);
            const fond = enTrait ? "#8b5cf6" : couleur ?? (restants.has(k) ? "#d4d4d8" : undefined);
            return (
              <button
                key={k}
                type="button"
                data-r={r}
                data-c={c}
                onKeyDown={(e) => clavier(e, [r, c])}
                aria-label={`Ligne ${r + 1}, colonne ${c + 1} : ${lettre}`}
                className="flex aspect-square items-center justify-center rounded-md text-[clamp(11px,3.2vw,20px)] font-bold text-zinc-800 outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-zinc-100"
                style={fond ? { background: fond, color: enTrait ? "#fff" : "#18181b" } : undefined}
              >
                {lettre}
              </button>
            );
          }),
        )}
      </div>

      <ul className="flex flex-wrap justify-center gap-2" aria-label="Mots à trouver">
        {grille.placements.map((p) => {
          const t = trouves.find((x) => x.norm === p.norm);
          return (
            <li
              key={p.norm}
              className={`rounded-full px-3 py-1 text-sm font-medium ${t ? "line-through" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"}`}
              style={t ? { background: t.couleur, color: "#18181b" } : undefined}
            >
              {p.brut}
            </li>
          );
        })}
      </ul>

      {fini ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-gradient-to-br from-teal-50 to-cyan-50 px-8 py-5 text-center dark:from-teal-950/30 dark:to-cyan-950/30">
          {devoiles && trouves.length < total ? (
            <p className="font-bold text-zinc-800 dark:text-zinc-100">
              Les mots restants sont en gris. Tu en avais trouvé {trouves.length} sur {total}.
            </p>
          ) : (
            <>
              <p className="text-lg font-bold text-emerald-600">🎉 Tous les mots trouvés en {duree(secondes)} !</p>
              {record && (
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  {record.nouveau
                    ? record.ancien === null
                      ? "Premier record sur cette grille."
                      : `Nouveau record ! (avant : ${duree(record.ancien)})`
                    : `Ton record reste ${duree(record.ancien!)}.`}
                </p>
              )}
            </>
          )}
          <button
            type="button"
            onClick={rejouer}
            className="mt-1 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-600/30 transition hover:scale-105 active:scale-95"
          >
            Rejouer
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setDevoiles(true)}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Je donne ma langue au chat
        </button>
      )}
    </div>
  );
}
