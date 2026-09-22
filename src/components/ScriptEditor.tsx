"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import CoverPicker from "./CoverPicker";
import ScriptStage from "./ScriptStage";
import type { Tier } from "@/lib/tiers";
import { publishGame, saveGame } from "@/app/editeur/actions";
import {
  API_DOC,
  EXEMPLE_DEFAUT,
  isScriptPlayable,
  SCRIPT_MAX,
  SCRIPT_SIZES,
  verifierCode,
  type ScriptData,
} from "@/lib/script";
import { EXEMPLES } from "@/lib/scriptExemples";

/**
 * L'editeur de Game Script : on ecrit, on lance, on regarde.
 *
 * Le programme n'est PAS relance a chaque frappe — sinon un jeu clignote
 * pendant qu'on ecrit et la moindre ligne a moitie tapee jette une erreur.
 * On relance sur demande (bouton ou Ctrl+Entree), comme dans un vrai atelier.
 */
export default function ScriptEditor({
  gameId,
  initialTitle,
  initialDescription,
  initialData,
  initialGradient,
  initialEmoji,
  initialCoverUrl,
  tier,
  error,
}: {
  gameId: string;
  initialTitle: string;
  initialDescription: string;
  initialData: ScriptData;
  initialGradient: string;
  initialEmoji: string;
  initialCoverUrl: string | null;
  tier: Tier;
  error?: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [data, setData] = useState<ScriptData>(initialData);
  const [gradient, setGradient] = useState(initialGradient);
  const [emoji, setEmoji] = useState(initialEmoji);
  const [coverUrl, setCoverUrl] = useState(initialCoverUrl);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [lance, setLance] = useState<ScriptData>(initialData);
  const [cle, setCle] = useState(1);
  const [journal, setJournal] = useState<string[]>([]);
  const [onglet, setOnglet] = useState<"aide" | "exemples">("aide");

  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const premierRendu = useRef(true);

  const scheduleSave = useCallback(
    (next: {
      title: string;
      description: string;
      data: ScriptData;
      gradient: string;
      emoji: string;
      coverUrl: string | null;
      multiplayerMode: boolean;
    }) => {
      setStatus("saving");
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(async () => {
        await saveGame(gameId, next);
        setStatus("saved");
      }, 1200);
    },
    [gameId],
  );

  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    scheduleSave({ title, description, data, gradient, emoji, coverUrl, multiplayerMode: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, data, gradient, emoji, coverUrl]);

  const souci = verifierCode(data.code);

  function lancer() {
    if (souci) return;
    setJournal([]);
    setLance(data);
    setCle((k) => k + 1);
  }

  const ajouterJournal = useCallback((texte: string) => {
    setJournal((j) => [...j.slice(-40), texte]);
  }, []);
  const ajouterErreur = useCallback((texte: string) => {
    setJournal((j) => [...j.slice(-40), `⚠️ ${texte}`]);
  }, []);

  const jouable = isScriptPlayable(data) && !souci;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/editeur" className="text-sm text-zinc-400 hover:text-violet-600">
          ← Mes jeux
        </Link>
        <span className="text-xs text-zinc-400">
          {status === "saving" && "Sauvegarde..."}
          {status === "saved" && "✓ Sauvegardé"}
        </span>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titre de ton jeu"
        className="mt-6 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-lg font-bold text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Décris ton jeu…"
        rows={2}
        className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
      />

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        {/* --- Le code --- */}
        <section className="script-panel">
          <header className="script-panel-head">
            <h2>Ton programme</h2>
            <span>
              {data.code.length} / {SCRIPT_MAX}
            </span>
          </header>
          <textarea
            value={data.code}
            onChange={(e) => setData((d) => ({ ...d, code: e.target.value.slice(0, SCRIPT_MAX) }))}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                lancer();
              }
              // Tabulation : on indente au lieu de sauter au champ suivant.
              if (e.key === "Tab") {
                e.preventDefault();
                const zone = e.currentTarget;
                const debut = zone.selectionStart;
                const fin = zone.selectionEnd;
                const avant = zone.value.slice(0, debut);
                const apres = zone.value.slice(fin);
                setData((d) => ({ ...d, code: `${avant}  ${apres}` }));
                requestAnimationFrame(() => zone.setSelectionRange(debut + 2, debut + 2));
              }
            }}
            spellCheck={false}
            aria-label="Code du jeu"
            className="script-code"
          />
          <div className="script-actions">
            <button type="button" onClick={lancer} disabled={Boolean(souci)} className="portal-button small">
              ▶ Lancer <span className="script-raccourci">Ctrl + Entrée</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Remplacer ton code par l'exemple de départ ?")) {
                  setData((d) => ({ ...d, code: EXEMPLE_DEFAUT }));
                }
              }}
              className="portal-button secondary small"
            >
              Repartir de l&apos;exemple
            </button>
          </div>
          {souci && <p className="script-souci">{souci}</p>}
        </section>

        {/* --- L'apercu et la console --- */}
        <section className="script-panel">
          <header className="script-panel-head">
            <h2>Aperçu</h2>
            <select
              value={`${data.width}x${data.height}`}
              onChange={(e) => {
                const [w, h] = e.target.value.split("x").map(Number);
                setData((d) => ({ ...d, width: w, height: h }));
              }}
              aria-label="Taille de la scène"
              className="script-select"
            >
              {SCRIPT_SIZES.map((s) => (
                <option key={`${s.w}x${s.h}`} value={`${s.w}x${s.h}`}>
                  {s.label}
                </option>
              ))}
            </select>
          </header>

          <ScriptStage data={lance} cle={cle} onLog={ajouterJournal} onErreur={ajouterErreur} />

          <div className="script-console" aria-label="Console">
            {journal.length === 0 ? (
              <p className="script-console-vide">
                Ce que tu affiches avec <code>pixo.ecrire(...)</code> apparaît ici, ainsi que les erreurs.
              </p>
            ) : (
              journal.map((l, i) => <p key={i}>{l}</p>)
            )}
          </div>

          <label className="script-aide">
            Comment on joue ?
            <input
              value={data.aide}
              onChange={(e) => setData((d) => ({ ...d, aide: e.target.value.slice(0, 200) }))}
              placeholder="Flèches pour bouger, espace pour tirer…"
            />
          </label>
        </section>
      </div>

      {/* --- Aide et exemples --- */}
      <section className="script-panel mt-5">
        <div className="script-tabs">
          {(
            [
              ["aide", "Les briques du jeu"],
              ["exemples", "Exemples à copier"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setOnglet(id)} aria-pressed={onglet === id}>
              {label}
            </button>
          ))}
        </div>

        {onglet === "aide" ? (
          <ul className="script-api">
            {API_DOC.map((a) => (
              <li key={a.nom}>
                <code>{a.nom}</code>
                <span>{a.desc}</span>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="script-exemples">
            {EXEMPLES.map((ex) => (
              <li key={ex.nom}>
                <div>
                  <strong>{ex.nom}</strong>
                  <span>{ex.desc}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Remplacer ton code par l'exemple « ${ex.nom} » ?`)) {
                      setData((d) => ({ ...d, code: ex.code, width: ex.width, height: ex.height }));
                    }
                  }}
                  className="portal-button secondary small"
                >
                  Utiliser
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6">
        <CoverPicker
          gameId={gameId}
          gradient={gradient}
          emoji={emoji}
          coverUrl={coverUrl}
          tier={tier}
          onGradientChange={setGradient}
          onEmojiChange={setEmoji}
          onCoverUrlChange={setCoverUrl}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form action={publishGame}>
          <input type="hidden" name="gameId" value={gameId} />
          <button
            type="submit"
            disabled={!jouable}
            className="rounded-full bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Publier
          </button>
        </form>
        <Link
          href={`/editeur/${gameId}/apercu`}
          className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          Tester en grand
        </Link>
        {!jouable && (
          <span className="text-xs text-zinc-400">
            Il faut une fonction <code>dessiner()</code> et au moins quelques lignes de code pour publier.
          </span>
        )}
      </div>
    </div>
  );
}
