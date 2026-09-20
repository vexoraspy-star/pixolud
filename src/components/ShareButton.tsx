"use client";

import { useState } from "react";

/**
 * Partager un jeu : la fenetre de partage du telephone si elle existe
 * (WhatsApp, Snap, Discord...), sinon le lien copie dans le presse-papier.
 * C'est le bouton qui fait connaitre un site : un lien colle par un joueur
 * vaut mieux que n'importe quel reglage.
 */
export default function ShareButton({
  url,
  title,
  text,
  className = "",
}: {
  url: string;
  title: string;
  text?: string;
  className?: string;
}) {
  const [state, setState] = useState<"pret" | "copie">("pret");

  async function share() {
    const data = { title, text: text ?? title, url };
    try {
      if (typeof navigator.share === "function") {
        await navigator.share(data);
        return;
      }
    } catch {
      // Partage annule : on retombe sur la copie du lien.
    }
    try {
      await navigator.clipboard.writeText(url);
      setState("copie");
      window.setTimeout(() => setState("pret"), 2200);
    } catch {
      window.prompt("Copie ce lien :", url);
    }
  }

  return (
    <button type="button" onClick={share} className={className || "portal-button secondary small"}>
      {state === "copie" ? "✅ Lien copié" : "🔗 Partager"}
    </button>
  );
}
