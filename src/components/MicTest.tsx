"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Test du micro, avant une partie a plusieurs.
 *
 * Trois choses a verifier, et c'est tout : le navigateur a-t-il la
 * permission, quel micro est choisi, et est-ce qu'on t'entend. Le niveau
 * s'affiche en direct, et l'enregistrement de trois secondes se reecoute :
 * c'est la seule facon d'etre sur d'etre audible.
 *
 * Rien ne quitte l'appareil : aucun son n'est envoye nulle part.
 */
type Etat = "repos" | "ecoute" | "enregistre" | "pret";

export default function MicTest() {
  const [etat, setEtat] = useState<Etat>("repos");
  const [erreur, setErreur] = useState<string | null>(null);
  const [niveau, setNiveau] = useState(0);
  const [pic, setPic] = useState(0);
  const [micros, setMicros] = useState<MediaDeviceInfo[]>([]);
  const [choisi, setChoisi] = useState<string>("");
  const [extrait, setExtrait] = useState<string | null>(null);

  const flux = useRef<MediaStream | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const boucle = useRef<number | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);

  // Tout couper quand on quitte la page : le voyant du micro doit s'eteindre.
  useEffect(() => stop, []);

  function stop() {
    if (boucle.current) cancelAnimationFrame(boucle.current);
    boucle.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
    flux.current?.getTracks().forEach((t) => t.stop());
    flux.current = null;
    ctx.current?.close().catch(() => {});
    ctx.current = null;
  }

  function arreter() {
    stop();
    setEtat("repos");
    setNiveau(0);
  }

  async function demarrer(deviceId?: string) {
    setErreur(null);
    stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      });
      flux.current = stream;

      // La liste des micros n'a de vrais noms qu'apres l'autorisation.
      const liste = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput");
      setMicros(liste);
      const actif = stream.getAudioTracks()[0]?.getSettings().deviceId ?? liste[0]?.deviceId ?? "";
      setChoisi(actif);

      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const audio = new AC();
      ctx.current = audio;
      const source = audio.createMediaStreamSource(stream);
      const analyser = audio.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);

      setEtat("ecoute");
      setPic(0);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let somme = 0;
        for (const v of data) {
          const x = (v - 128) / 128;
          somme += x * x;
        }
        // Moyenne quadratique, remontee sur une echelle lisible.
        const rms = Math.sqrt(somme / data.length);
        const valeur = Math.min(1, rms * 3.2);
        setNiveau(valeur);
        setPic((p) => Math.max(p * 0.995, valeur));
        boucle.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      const nom = e instanceof DOMException ? e.name : "";
      setErreur(
        nom === "NotAllowedError"
          ? "Le micro est bloqué. Clique sur le cadenas à gauche de l'adresse du site, puis autorise le micro."
          : nom === "NotFoundError"
            ? "Aucun micro trouvé. Branche un casque ou un micro, puis réessaie."
            : "Impossible d'ouvrir le micro. Ferme les autres applications qui l'utilisent (Discord, Zoom…) et réessaie.",
      );
      setEtat("repos");
    }
  }

  function enregistrer() {
    if (!flux.current) return;
    setExtrait(null);
    const morceaux: BlobPart[] = [];
    const rec = new MediaRecorder(flux.current);
    recorder.current = rec;
    rec.ondataavailable = (e) => morceaux.push(e.data);
    rec.onstop = () => {
      setExtrait(URL.createObjectURL(new Blob(morceaux, { type: rec.mimeType })));
      setEtat("pret");
    };
    rec.start();
    setEtat("enregistre");
    window.setTimeout(() => rec.state === "recording" && rec.stop(), 3000);
  }

  const barres = 24;
  const allumees = Math.round(niveau * barres);
  const verdict =
    pic < 0.06 ? { texte: "On ne t'entend pas encore. Parle normalement.", ton: "text-amber-500" } : pic > 0.85 ? { texte: "C'est trop fort, ça sature. Éloigne un peu le micro.", ton: "text-amber-500" } : { texte: "Parfait, on t'entend bien.", ton: "text-emerald-500" };

  return (
    <section className="rounded-2xl border border-[var(--portal-line)] bg-[var(--portal-surface)] p-5">
      <h2 className="text-lg font-bold">🎙️ Tester mon micro</h2>
      <p className="mt-1 text-sm text-[var(--portal-muted)]">
        À faire avant une partie à plusieurs. Rien n&apos;est envoyé : le son reste sur ton appareil.
      </p>

      {erreur && <p className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-600 dark:text-red-300">{erreur}</p>}

      {etat === "repos" ? (
        <button type="button" onClick={() => demarrer()} className="portal-button small mt-4">
          Autoriser et tester
        </button>
      ) : (
        <>
          {micros.length > 1 && (
            <label className="mt-4 block text-xs font-semibold text-[var(--portal-muted)]">
              Micro utilisé
              <select
                value={choisi}
                onChange={(e) => {
                  setChoisi(e.target.value);
                  demarrer(e.target.value);
                }}
                className="mt-1 block w-full rounded-lg border border-[var(--portal-line)] bg-[var(--portal-bg)] px-3 py-2 text-sm font-normal text-[var(--portal-ink)]"
              >
                {micros.map((m, i) => (
                  <option key={m.deviceId} value={m.deviceId}>
                    {m.label || `Micro ${i + 1}`}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="mt-4 flex gap-1" aria-hidden="true">
            {Array.from({ length: barres }).map((_, i) => (
              <span
                key={i}
                className={`h-8 flex-1 rounded-sm transition-colors ${
                  i < allumees ? (i > barres * 0.85 ? "bg-red-500" : i > barres * 0.6 ? "bg-amber-400" : "bg-emerald-500") : "bg-[var(--portal-soft)]"
                }`}
              />
            ))}
          </div>
          <p role="status" className={`mt-2 text-sm font-semibold ${verdict.ton}`}>
            {verdict.texte}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={enregistrer} disabled={etat === "enregistre"} className="portal-button small">
              {etat === "enregistre" ? "Enregistrement… parle !" : "🔴 M'enregistrer 3 secondes"}
            </button>
            <button type="button" onClick={arreter} className="portal-button secondary small">
              Arrêter le micro
            </button>
          </div>

          {extrait && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-[var(--portal-muted)]">Réécoute-toi : c&apos;est ce que les autres entendent.</p>
              <audio controls src={extrait} className="mt-2 w-full" />
            </div>
          )}
        </>
      )}
    </section>
  );
}
