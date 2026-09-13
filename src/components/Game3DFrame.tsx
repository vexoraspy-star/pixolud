"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Cadre plein ecran des jeux 3D.
 *
 * Le jeu occupe TOUTE la page : l'en-tete, la radio et la mascotte sont
 * masques (regle `html[data-game-fullscreen]` de globals.css). Avant, le jeu
 * vivait sous l'en-tete du site et la mascotte venait parler par-dessus
 * l'ecran en pleine partie d'horreur.
 *
 * Chaque jeu garde sa propre sortie : un lien retour dans son lobby, et un
 * bouton « Quitter » dans le panneau de reglages en jeu.
 */
export default function Game3DFrame({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-game-fullscreen", "");
    window.scrollTo(0, 0);
    return () => {
      root.removeAttribute("data-game-fullscreen");
      // Quitter la page doit aussi quitter le plein ecran du navigateur.
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  // 100dvh plutot que 100vh : sur mobile, la barre d'adresse ne mange plus le
  // bas du jeu.
  return <div className="fixed inset-0 z-[70] h-[100dvh] w-full bg-black">{children}</div>;
}
