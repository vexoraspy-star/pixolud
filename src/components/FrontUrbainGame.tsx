"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** Version construite du jeu (voir jeux-externes/front-urbain/README.md). */
const GAME_SRC = "/jeux/front-urbain/index.html";

type MessageJeu = { type?: unknown; action?: unknown; etat?: unknown };

/**
 * Front Urbain : jeu de tir tactique externe, d'apres Claude of Duty (licence
 * MIT). Il est construit a part avec Vite dans jeux-externes/front-urbain et
 * servi tel quel depuis public/jeux/front-urbain : on l'affiche dans une
 * iframe plein cadre.
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

  return (
    <div ref={cadreRef} className="relative h-full w-full bg-black">
      <iframe
        ref={iframeRef}
        src={GAME_SRC}
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
