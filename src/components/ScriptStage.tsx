"use client";

import { useEffect, useRef, useState } from "react";
import { sandboxHtml } from "@/lib/scriptRuntime";
import { HEARTBEAT_TIMEOUT_MS } from "@/lib/scriptRuntime";
import type { ScriptData } from "@/lib/script";

/**
 * La scene d'un jeu Game Script : le cadre isole ou le programme tourne.
 *
 * Le meme composant sert a l'apercu de l'editeur et a la page de jeu. Il ne
 * fait que trois choses : poser le cadre, ecouter ce que le jeu raconte
 * (erreurs, console, signal de vie) et le relancer a la demande.
 *
 * `sandbox="allow-scripts"` sans `allow-same-origin` : le jeu est sur une
 * origine opaque. Il ne peut donc rien lire du site, ni la session, ni les
 * cookies. C'est ce qui permet de faire tourner du code que personne n'a relu.
 */
export default function ScriptStage({
  data,
  cle,
  onLog,
  onErreur,
}: {
  data: ScriptData;
  /** Change cette valeur pour relancer le jeu. */
  cle: number;
  onLog?: (texte: string) => void;
  onErreur?: (texte: string) => void;
}) {
  const cadre = useRef<HTMLIFrameElement>(null);
  const [bloque, setBloque] = useState(false);
  // 0 = pas encore de signal. La valeur est posee dans l'effet : lire
  // l'horloge pendant le rendu rendrait le composant imprevisible.
  const dernierSigne = useRef(0);

  useEffect(() => {
    dernierSigne.current = Date.now();

    function onMessage(e: MessageEvent) {
      // On n'ecoute que NOTRE cadre : n'importe quelle page peut poster un
      // message, et il ne faut pas confondre.
      if (!cadre.current || e.source !== cadre.current.contentWindow) return;
      const m = e.data as { pixoscript?: boolean; type?: string; texte?: string };
      if (!m?.pixoscript) return;
      dernierSigne.current = Date.now();
      if (m.type === "log" && onLog) onLog(String(m.texte ?? ""));
      if (m.type === "erreur" && onErreur) onErreur(String(m.texte ?? ""));
    }
    window.addEventListener("message", onMessage);

    // Un programme parti en boucle infinie ne repond plus : on ne peut pas
    // l'interrompre de l'exterieur, mais on peut le DIRE, et proposer de
    // jeter la page.
    const veille = setInterval(() => {
      setBloque(dernierSigne.current > 0 && Date.now() - dernierSigne.current > HEARTBEAT_TIMEOUT_MS);
    }, 1000);

    return () => {
      window.removeEventListener("message", onMessage);
      clearInterval(veille);
    };
  }, [cle, onLog, onErreur]);

  return (
    <div className="script-stage">
      <iframe
        key={cle}
        ref={cadre}
        title="Jeu"
        sandbox="allow-scripts"
        srcDoc={sandboxHtml(data)}
        style={{ aspectRatio: `${data.width} / ${data.height}` }}
        className="script-frame"
      />
      {bloque && (
        <p className="script-bloque" role="status">
          Le programme ne répond plus — souvent une boucle qui ne s&apos;arrête jamais (un <code>while</code> sans
          condition de sortie). Relance-le et vérifie tes boucles.
        </p>
      )}
    </div>
  );
}
