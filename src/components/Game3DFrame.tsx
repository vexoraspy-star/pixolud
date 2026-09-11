"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Cadre plein ecran des jeux 3D.
 *
 * Sans lui, le pied de page depasse sous la zone de jeu : la page devient
 * defilante, l'en-tete colle en haut vient recouvrir le haut de l'interface
 * (le carnet de quete, le chrono) et les commandes du bas sortent de l'ecran.
 * L'attribut pose ici declenche la regle `html[data-game-fullscreen]` de
 * globals.css, qui masque le pied de page et bloque le defilement.
 */
export default function Game3DFrame({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-game-fullscreen", "");
    window.scrollTo(0, 0);
    return () => {
      root.removeAttribute("data-game-fullscreen");
    };
  }, []);

  // 100dvh plutot que 100vh : sur mobile, la barre d'adresse ne mange plus le
  // bas du jeu. Le -1px compense la bordure basse de l'en-tete.
  return <div className="h-[calc(100dvh-4rem-1px)] bg-black">{children}</div>;
}
