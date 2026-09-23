"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Avatar from "./Avatar";
import {
  codeSalon,
  MAX_PARTICIPANTS,
  nettoyerCode,
  rejoindreSalon,
  type CallControls,
  type MoiCall,
  type Participant,
} from "@/lib/pixocall";

/**
 * La salle de PixoCall.
 *
 * Trois etats seulement : on choisit un salon, on est dedans, ou ca a rate.
 * Tout le reste (micro, liaisons, qui parle) est gere par src/lib/pixocall.ts
 * — ce fichier ne fait que montrer et cliquer.
 */
type Etat = "accueil" | "connexion" | "dedans";

export default function PixoCallRoom({ moi }: { moi: MoiCall }) {
  const router = useRouter();
  const params = useSearchParams();
  const salonDeLUrl = params.get("salon") ?? "";

  const [etat, setEtat] = useState<Etat>("accueil");
  const [code, setCode] = useState(nettoyerCode(salonDeLUrl));
  const [saisie, setSaisie] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [monNiveau, setMonNiveau] = useState(0);
  const [muet, setMuet] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [micros, setMicros] = useState<MediaDeviceInfo[]>([]);
  const [micro, setMicro] = useState("");
  const [copie, setCopie] = useState(false);

  const controls = useRef<CallControls | null>(null);

  // Quitter proprement : le micro doit s'eteindre quand on ferme l'onglet.
  useEffect(() => {
    return () => {
      controls.current?.quitter();
      controls.current = null;
    };
  }, []);

  // Volontairement une fonction ordinaire : elle n'est appelee que depuis des
  // clics, et la memoriser ferait plus de bruit que de bien.
  async function entrer(salon: string) {
    {
      const propre = nettoyerCode(salon);
      if (propre.length < 4) {
        setErreur("Un code de salon fait au moins 4 caractères.");
        return;
      }
      setErreur(null);
      setEtat("connexion");
      try {
        const c = await rejoindreSalon(propre, moi, {
          participants: setParticipants,
          monNiveau: setMonNiveau,
          erreur: (m) => setErreur(m),
          pleine: () => {
            setErreur(`Ce salon est plein (${MAX_PARTICIPANTS} personnes maximum).`);
            controls.current?.quitter();
            controls.current = null;
            setEtat("accueil");
          },
        });
        controls.current = c;
        setCode(propre);
        setEtat("dedans");
        // Les vrais noms des micros n'apparaissent qu'apres l'autorisation.
        const liste = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput");
        setMicros(liste);
        setMicro(liste[0]?.deviceId ?? "");
        router.replace(`/pixocall?salon=${propre}`, { scroll: false });
      } catch (e) {
        setErreur((e as Error)?.message ?? "Impossible d'entrer dans le salon.");
        setEtat("accueil");
      }
    }
  }

  function partir() {
    controls.current?.quitter();
    controls.current = null;
    setParticipants([]);
    setEtat("accueil");
    router.replace("/pixocall", { scroll: false });
  }

  function basculerMicro() {
    const v = !muet;
    setMuet(v);
    controls.current?.setMuet(v);
  }

  const lien = typeof window !== "undefined" ? `${window.location.origin}/pixocall?salon=${code}` : "";
  const total = participants.length + 1;

  if (etat !== "dedans") {
    return (
      <div className="call-lobby mt-8 space-y-5">
        <section className="rounded-2xl border border-[var(--portal-line)] bg-[var(--portal-surface)] p-5">
          <span className="call-option-icon" aria-hidden="true">＋</span><h2 className="text-sm font-bold">Ouvrir un salon</h2>
          <p className="mt-1 text-xs text-[var(--portal-muted)]">
            Tu obtiens un code à envoyer à tes amis. Tant que personne n&apos;est dedans, le salon n&apos;existe pas :
            rien n&apos;est enregistré nulle part.
          </p>
          <button
            type="button"
            disabled={etat === "connexion"}
            onClick={() => void entrer(codeSalon())}
            className="portal-button mt-4"
          >
            {etat === "connexion" ? "Connexion…" : "🎙️ Créer mon salon"}
          </button>
        </section>

        <section className="rounded-2xl border border-[var(--portal-line)] bg-[var(--portal-surface)] p-5">
          <span className="call-option-icon" aria-hidden="true">↗</span><h2 className="text-sm font-bold">Rejoindre un salon</h2>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void entrer(saisie);
            }}
          >
            <input
              value={saisie}
              onChange={(e) => setSaisie(nettoyerCode(e.target.value))}
              placeholder="Code du salon"
              aria-label="Code du salon"
              className="min-w-0 flex-1 rounded-lg border border-[var(--portal-line)] bg-[var(--portal-bg)] px-3 py-2.5 text-sm font-bold tracking-[0.2em] outline-none focus:border-[var(--portal-accent)]"
            />
            <button type="submit" disabled={etat === "connexion" || saisie.length < 4} className="portal-button small">
              Entrer
            </button>
          </form>
          {salonDeLUrl && (
            <button type="button" onClick={() => void entrer(salonDeLUrl)} className="portal-button secondary small mt-3">
              Rejoindre « {nettoyerCode(salonDeLUrl)} »
            </button>
          )}
        </section>

        {erreur && (
          <p role="status" className="rounded-xl bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-300">
            {erreur}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="call-room mt-8 space-y-5">
      <section className="rounded-2xl border border-[var(--portal-accent)] bg-[var(--portal-surface)] p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-[var(--portal-accent)] px-3 py-1 text-xs font-extrabold tracking-[0.2em] text-white">
            {code}
          </span>
          <span className="text-xs text-[var(--portal-muted)]">
            {total} / {MAX_PARTICIPANTS} dans le salon
          </span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard
                ?.writeText(lien)
                .then(() => setCopie(true))
                .catch(() => setCopie(false));
            }}
            className="portal-button secondary small ml-auto"
          >
            {copie ? "Lien copié ✓" : "Copier le lien d'invitation"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--portal-line)] bg-[var(--portal-surface)] p-5">
        <ul className="call-participants grid gap-3 sm:grid-cols-2">
          <li className="flex items-center gap-3 rounded-xl bg-[var(--portal-soft)] p-3">
            <span
              className="rounded-full transition-shadow"
              style={{ boxShadow: monNiveau > 0.06 ? `0 0 0 ${2 + monNiveau * 8}px rgba(101,178,148,0.35)` : "none" }}
            >
              <Avatar pseudo={moi.pseudo} url={moi.avatarUrl} frame={moi.frame} taille={44} />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block truncate text-sm">{moi.pseudo} (toi)</b>
              <span className="text-xs text-[var(--portal-muted)]">{muet ? "Micro coupé" : "Micro ouvert"}</span>
            </span>
          </li>

          {participants.map((p) => (
            <li key={p.userId} className="flex items-center gap-3 rounded-xl bg-[var(--portal-soft)] p-3">
              <span
                className="rounded-full transition-shadow"
                style={{ boxShadow: p.parle ? "0 0 0 6px rgba(101,178,148,0.35)" : "none" }}
              >
                <Avatar pseudo={p.pseudo} url={p.avatarUrl} frame={p.frame} taille={44} />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-sm">{p.pseudo}</b>
                <span className="text-xs text-[var(--portal-muted)]">
                  {p.etat === "ok"
                    ? p.entendu
                      ? p.parle
                        ? "Parle…"
                        : "Connecté"
                      : "En sourdine"
                    : p.etat === "connexion"
                      ? "Connexion…"
                      : "Liaison impossible"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => controls.current?.setEntendu(p.userId, !p.entendu)}
                aria-pressed={!p.entendu}
                title={p.entendu ? `Mettre ${p.pseudo} en sourdine` : `Réécouter ${p.pseudo}`}
                className="rounded-lg px-2 py-1 text-lg hover:bg-[var(--portal-bg)]"
              >
                {p.entendu ? "🔊" : "🔇"}
              </button>
            </li>
          ))}

          {participants.length === 0 && (
            <li className="flex items-center rounded-xl border border-dashed border-[var(--portal-line)] p-4 text-xs text-[var(--portal-muted)]">
              Tu es seul pour l&apos;instant. Envoie le lien ou le code à quelqu&apos;un.
            </li>
          )}
        </ul>

        {participants.some((p) => p.etat === "echec") && (
          <p className="mt-4 rounded-xl bg-amber-500/15 px-4 py-3 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
            Une liaison n&apos;a pas pu s&apos;établir. PixoCall relie les ordinateurs directement, sans serveur qui
            relaie le son (c&apos;est ce qui le rend gratuit) : certains réseaux très fermés — collège, entreprise,
            certaines box — bloquent ce type de liaison. Essayez depuis une autre connexion, ou en partage de
            connexion du téléphone.
          </p>
        )}
      </section>

      <section className="call-controls flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--portal-line)] bg-[var(--portal-surface)] p-4">
        <button type="button" onClick={basculerMicro} aria-pressed={muet} className="portal-button small">
          {muet ? "🔇 Micro coupé" : "🎙️ Micro ouvert"}
        </button>

        {micros.length > 1 && (
          <label className="text-xs font-semibold text-[var(--portal-muted)]">
            Micro
            <select
              value={micro}
              onChange={(e) => {
                setMicro(e.target.value);
                void controls.current?.changerMicro(e.target.value).catch(() => setErreur("Ce micro n'a pas pu être ouvert."));
              }}
              className="ml-2 rounded-lg border border-[var(--portal-line)] bg-[var(--portal-bg)] px-2 py-1.5 text-xs font-normal text-[var(--portal-ink)]"
            >
              {micros.map((m, i) => (
                <option key={m.deviceId} value={m.deviceId}>
                  {m.label || `Micro ${i + 1}`}
                </option>
              ))}
            </select>
          </label>
        )}

        <button type="button" onClick={partir} className="ml-auto rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500">
          Quitter le salon
        </button>
      </section>

      {erreur && (
        <p role="status" className="rounded-xl bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-300">
          {erreur}
        </p>
      )}
    </div>
  );
}
