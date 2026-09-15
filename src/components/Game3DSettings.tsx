"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BRIGHTNESS_MAX,
  BRIGHTNESS_MIN,
  SENSITIVITY_MAX,
  SENSITIVITY_MIN,
  loadLayout3D,
  loadQuality3D,
  loadSensitivity3D,
  loadVoice3D,
  saveLayout3D,
  saveQuality3D,
  saveSensitivity3D,
  saveVoice3D,
  type Layout3D,
  type Quality3D,
} from "@/lib/settings3d";

/**
 * Panneau de reglages commun aux jeux 3D, utilisable EN PLEINE PARTIE.
 * Avant, il fallait ressortir au menu pour changer la sensibilite, ce qui est
 * insupportable dans un jeu de tir.
 */
export default function Game3DSettings({
  onLayout,
  onSensitivity,
  onBrightness,
  brightness,
  onVoice,
  onQuality,
  className = "",
}: {
  onLayout?: (value: Layout3D) => void;
  onSensitivity?: (value: number) => void;
  /** Omettre pour masquer le reglage (inutile dans une arene bien eclairee). */
  onBrightness?: (value: number) => void;
  brightness?: number;
  /** Omettre pour masquer le reglage (un jeu sans narration n'en a pas besoin). */
  onVoice?: (value: boolean) => void;
  /** Omettre pour masquer le reglage (les jeux qui ajustent deja tout seuls n'en ont pas besoin). */
  onQuality?: (value: Quality3D) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<Layout3D>("azerty");
  const [sensitivity, setSensitivity] = useState(1.5);
  const [localBrightness, setLocalBrightness] = useState(brightness ?? 1);
  const [voice, setVoice] = useState(true);
  const [quality, setQuality] = useState<Quality3D>("eleve");

  useEffect(() => {
    const t = setTimeout(() => {
      setLayout(loadLayout3D());
      setSensitivity(loadSensitivity3D());
      setVoice(loadVoice3D());
      setQuality(loadQuality3D());
    }, 0);
    return () => clearTimeout(t);
  }, []);

  function changeLayout(value: Layout3D) {
    setLayout(value);
    saveLayout3D(value);
    onLayout?.(value);
  }
  function changeSensitivity(value: number) {
    setSensitivity(value);
    saveSensitivity3D(value);
    onSensitivity?.(value);
  }
  function changeBrightness(value: number) {
    setLocalBrightness(value);
    onBrightness?.(value);
  }
  function changeVoice(value: boolean) {
    setVoice(value);
    saveVoice3D(value);
    onVoice?.(value);
  }
  function changeQuality(value: Quality3D) {
    setQuality(value);
    saveQuality3D(value);
    onQuality?.(value);
  }

  return (
    <div className={`absolute right-3 top-3 z-30 flex flex-col items-end gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Réglages"
        className="flex size-9 items-center justify-center rounded-full bg-black/70 text-lg text-white backdrop-blur transition hover:bg-black/90"
      >
        ⚙️
      </button>

      {open && (
        <div className="w-60 rounded-xl border border-white/15 bg-zinc-950/95 p-3 text-white shadow-2xl backdrop-blur">
          <p className="mb-1.5 text-xs font-semibold text-zinc-300">Clavier</p>
          <div className="mb-3 flex gap-2">
            {(["azerty", "qwerty"] as Layout3D[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => changeLayout(l)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold uppercase transition ${
                  layout === l ? "bg-violet-600 text-white" : "bg-white/5 text-zinc-400 hover:bg-white/10"
                }`}
              >
                {l === "azerty" ? "ZQSD" : "WASD"}
              </button>
            ))}
          </div>

          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs font-semibold text-zinc-300">Sensibilité souris</p>
            <span className="font-mono text-[11px] text-zinc-500">{sensitivity.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={SENSITIVITY_MIN}
            max={SENSITIVITY_MAX}
            step={0.05}
            value={sensitivity}
            onChange={(e) => changeSensitivity(Number(e.target.value))}
            className="mb-3 w-full accent-violet-500"
          />

          {onBrightness && (
            <>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs font-semibold text-zinc-300">Luminosité</p>
                <span className="font-mono text-[11px] text-zinc-500">
                  {Math.round(localBrightness * 100)} %
                </span>
              </div>
              <input
                type="range"
                min={BRIGHTNESS_MIN}
                max={BRIGHTNESS_MAX}
                step={0.05}
                value={localBrightness}
                onChange={(e) => changeBrightness(Number(e.target.value))}
                className="w-full accent-violet-500"
              />
            </>
          )}

          {onVoice && (
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-zinc-300">Voix des cinématiques</p>
              <button
                type="button"
                onClick={() => changeVoice(!voice)}
                aria-pressed={voice}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold uppercase transition ${
                  voice ? "bg-violet-600 text-white" : "bg-white/5 text-zinc-400 hover:bg-white/10"
                }`}
              >
                {voice ? "Activée" : "Coupée"}
              </button>
            </div>
          )}

          {onQuality && (
            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="mb-1.5 text-xs font-semibold text-zinc-300">Graphismes</p>
              <div className="flex gap-2">
                {(["eleve", "performance"] as Quality3D[]).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => changeQuality(q)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold transition ${
                      quality === q ? "bg-violet-600 text-white" : "bg-white/5 text-zinc-400 hover:bg-white/10"
                    }`}
                  >
                    {q === "eleve" ? "Élevés" : "Performance"}
                  </button>
                ))}
              </div>
              {quality === "performance" && (
                <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-500">
                  Moins de détail, plus d&apos;images par seconde. Change tout de suite.
                </p>
              )}
            </div>
          )}

          <div className="mt-3 flex gap-2 border-t border-white/10 pt-3">
            <button
              type="button"
              onClick={() => {
                // Le vrai plein ecran du navigateur, qui cache aussi la barre
                // d'adresse. Il demande un geste utilisateur : d'ou le bouton.
                if (document.fullscreenElement) {
                  document.exitFullscreen?.().catch(() => {});
                } else {
                  document.documentElement.requestFullscreen?.().catch(() => {});
                }
              }}
              className="flex-1 rounded-lg bg-white/5 px-2 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-white/10"
            >
              ⛶ Plein écran
            </button>
            <Link
              href="/mode-3d"
              className="flex-1 rounded-lg bg-red-950/60 px-2 py-1.5 text-center text-xs font-semibold text-red-200 transition hover:bg-red-900/70"
            >
              Quitter
            </Link>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
            Les réglages sont conservés sur cet appareil et partagés par tous les jeux du Mode 3D.
          </p>
        </div>
      )}
    </div>
  );
}
