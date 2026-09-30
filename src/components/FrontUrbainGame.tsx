"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** Version construite du jeu (voir jeux-externes/front-urbain/README.md). */
const GAME_SRC = "/jeux/front-urbain/index.html";

type MessageJeu = { type?: unknown; action?: unknown; etat?: unknown };

// Mode rapide : meme cle que le jeu (jeux-externes/front-urbain/src/pixolud/
// reglages.js), qui peut le changer depuis son menu Echap. Actif par defaut.
const CLE_RAPIDE = "pixolud-front-urbain-rapide";
/** Valeur gardee en memoire si le stockage du navigateur est bloque. */
let rapideMemoire: boolean | null = null;
const abonnesRapide = new Set<() => void>();

function lireRapide(): boolean {
  if (rapideMemoire !== null) return rapideMemoire;
  try {
    return localStorage.getItem(CLE_RAPIDE) !== "off";
  } catch {
    return true;
  }
}

function ecrireRapide(actif: boolean) {
  rapideMemoire = actif;
  try {
    localStorage.setItem(CLE_RAPIDE, actif ? "on" : "off");
  } catch {
    /* stockage bloque : le choix vaut pour cette visite */
  }
  abonnesRapide.forEach((f) => f());
}

function abonnerRapide(f: () => void) {
  abonnesRapide.add(f);
  // Le jeu (meme origine, dans l'iframe) ecrit la meme cle depuis son menu.
  const surStockage = (e: StorageEvent) => {
    if (e.key !== CLE_RAPIDE) return;
    rapideMemoire = null;
    f();
  };
  window.addEventListener("storage", surStockage);
  return () => {
    abonnesRapide.delete(f);
    window.removeEventListener("storage", surStockage);
  };
}

/**
 * Front Urbain : jeu de tir tactique externe, d'apres Claude of Duty (licence
 * MIT). Il est construit a part avec Vite dans jeux-externes/front-urbain et
 * servi tel quel depuis public/jeux/front-urbain : on l'affiche dans une
 * iframe plein cadre, mais seulement apres un ecran de lancement (avertissement
 * pour les PC peu puissants et choix du mode rapide, passe en `?rapide=`).
 *
 * L'iframe est de meme origine et sans `sandbox` : le verrouillage de la
 * souris y fonctionne, et le jeu lit directement les reglages 3D partages du
 * site (clavier, sensibilite, luminosite) dans le localStorage.
 *
 * Le jeu parle a la page par postMessage ({ type: "front-urbain" }) :
 *   etat "jeu" / "menu"   masquer ou montrer la barre du bas
 *   action "quitter"      retour a la galerie du Mode 3D
 */
export default function FrontUrbainGame({ title }: { title: string }) {
  const router = useRouter();
  const cadreRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [enJeu, setEnJeu] = useState(false);
  const [pleinEcran, setPleinEcran] = useState(false);
  const rapide = useSyncExternalStore(abonnerRapide, lireRapide, () => true);
  // Adresse figee au lancement : si le jeu change le mode rapide depuis son
  // menu, il se relance lui-meme ; l'iframe ne doit pas recharger en double.
  // Le jeu ne demarre qu'au clic : ouvrir la page ne doit jamais bloquer un
  // petit PC.
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    function surMessage(e: MessageEvent) {
      // Seulement notre propre iframe, sur notre propre origine.
      if (e.origin !== window.location.origin) return;
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return;
      if (!e.data || typeof e.data !== "object") return;
      const msg = e.data as MessageJeu;
      if (msg.type !== "front-urbain") return;
      if (msg.action === "quitter") router.push("/mode-3d");
      else if (msg.etat === "jeu") setEnJeu(true);
      else if (msg.etat === "menu") setEnJeu(false);
    }
    window.addEventListener("message", surMessage);
    return () => window.removeEventListener("message", surMessage);
  }, [router]);

  useEffect(() => {
    const maj = () => setPleinEcran(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", maj);
    return () => document.removeEventListener("fullscreenchange", maj);
  }, []);

  const basculerPleinEcran = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else {
      cadreRef.current?.requestFullscreen?.().catch(() => {});
    }
    // Rendre le clavier au jeu apres le clic sur le bouton.
    iframeRef.current?.focus();
  }, []);

  if (!src) {
    return (
      <div className="relative flex h-full w-full items-center justify-center overflow-y-auto bg-gradient-to-b from-stone-900 to-black px-4 py-8 text-zinc-200">
        <div className="w-full max-w-md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-300/80">Tir tactique · Solo</p>
          <h1 className="mt-1 text-3xl font-black tracking-wide text-white">{title}</h1>

          <div role="note" className="mt-5 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm leading-relaxed text-amber-100">
            <p className="font-bold text-amber-300">⚠ Jeu très exigeant</p>
            <p className="mt-1">
              Sur un PC peu puissant, le chargement peut prendre plusieurs minutes et la page peut ralentir ou se
              bloquer. Ferme les autres onglets lourds avant de lancer.
            </p>
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3 hover:border-white/25">
            <input
              type="checkbox"
              checked={rapide}
              onChange={(e) => ecrireRapide(e.target.checked)}
              className="mt-1 h-4 w-4 accent-amber-400"
            />
            <span className="text-sm leading-relaxed">
              <span className="font-bold text-white">Mode rapide</span>{" "}
              <span className="text-amber-300">(conseillé)</span>
              <span className="block text-xs text-zinc-400">
                Démarrage environ deux fois plus court : qualité Basse et effets simplifiés. Tu peux l’enlever
                ensuite dans le menu Échap du jeu.
              </span>
            </span>
          </label>

          <button
            type="button"
            onClick={() => setSrc(`${GAME_SRC}?rapide=${rapide ? 1 : 0}`)}
            className="mt-5 w-full rounded-lg bg-amber-400 px-4 py-3 text-base font-black uppercase tracking-wide text-black transition hover:bg-amber-300"
          >
            Lancer le jeu
          </button>

          <p className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-zinc-400">
            <Link href="/mode-3d" className="font-semibold hover:text-amber-300">
              ← Mode 3D
            </Link>
            <span aria-hidden="true" className="text-zinc-600">
              ·
            </span>
            <span>
              D’après{" "}
              <a
                href="https://github.com/mshumer/Claude-of-Duty"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-zinc-600 underline-offset-2 hover:text-amber-300"
              >
                Claude of Duty
              </a>{" "}
              (licence MIT)
            </span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={cadreRef} className="relative h-full w-full bg-black">
      <iframe
        ref={iframeRef}
        src={src}
        title={title}
        allow="fullscreen; autoplay"
        allowFullScreen
        className="absolute inset-0 h-full w-full border-0"
        onLoad={() => iframeRef.current?.focus()}
      />
      {/* Barre discrete en bas au centre (zone libre du HUD), masquee pendant le jeu. */}
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3 transition-opacity duration-300 ${
          enJeu ? "opacity-0" : "opacity-100"
        }`}
      >
        <div
          className={`${
            enJeu ? "" : "pointer-events-auto"
          } flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border border-white/15 bg-black/65 px-4 py-2 text-xs text-zinc-300 backdrop-blur-sm`}
        >
          <Link href="/mode-3d" className="font-semibold hover:text-amber-300">
            ← Mode 3D
          </Link>
          <span aria-hidden="true" className="text-zinc-600">
            ·
          </span>
          <button type="button" onClick={basculerPleinEcran} className="font-semibold hover:text-amber-300">
            {pleinEcran ? "Quitter le plein écran" : "Plein écran"}
          </button>
          <span aria-hidden="true" className="text-zinc-600">
            ·
          </span>
          <span className="text-zinc-400">
            D’après{" "}
            <a
              href="https://github.com/mshumer/Claude-of-Duty"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-zinc-600 underline-offset-2 hover:text-amber-300"
            >
              Claude of Duty
            </a>{" "}
            (licence MIT)
          </span>
        </div>
      </div>
    </div>
  );
}
