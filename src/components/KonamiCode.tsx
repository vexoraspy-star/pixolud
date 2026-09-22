"use client";

import { useEffect, useRef } from "react";
import { appliquerCodes, SECRET_CODES, unlockCode } from "@/lib/fun";

/**
 * Les codes secrets.
 *
 * Plusieurs codes tournent en parallele : a chaque touche, chaque code avance
 * ou repart de zero, independamment des autres. Deux facons de les taper :
 * une suite de fleches (le Konami original) ou simplement un mot ecrit au
 * clavier — plus facile a se rappeler et a se raconter entre joueurs.
 *
 * Les touches tapees dans un champ de texte sont ignorees : sinon, ecrire
 * « nuit » dans le chat declencherait le code.
 */
export default function KonamiCode() {
  const progres = useRef<number[]>(SECRET_CODES.map(() => 0));

  // Les codes deja trouves lors d'une visite precedente sont remis en place.
  useEffect(() => {
    appliquerCodes();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const cible = e.target as HTMLElement | null;
      if (cible && /^(input|textarea|select)$/i.test(cible.tagName)) return;
      if (cible?.isContentEditable) return;

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      SECRET_CODES.forEach((code, i) => {
        if (key === code.touches[progres.current[i]]) {
          progres.current[i] += 1;
          if (progres.current[i] === code.touches.length) {
            progres.current[i] = 0;
            unlockCode(code.id);
          }
        } else {
          progres.current[i] = key === code.touches[0] ? 1 : 0;
        }
      });
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return null;
}
