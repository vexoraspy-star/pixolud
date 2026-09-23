"use client";

import { useState } from "react";
import ScriptStage from "./ScriptStage";
import { EXEMPLES } from "@/lib/scriptExemples";

/**
 * La vitrine du mode Game Script : trois jeux jouables tout de suite, avec
 * leur code juste en dessous.
 *
 * Montrer le code sous le jeu qu'on vient de toucher est ce qui declenche
 * l'envie : on voit la ligne qui fait bouger le carre, on comprend qu'on peut
 * la changer. Une capture d'ecran ou une liste de fonctions ne fait pas ca.
 */
export default function ScriptDemo() {
  const [index, setIndex] = useState(0);
  const [cle, setCle] = useState(1);
  const [voirCode, setVoirCode] = useState(false);
  const exemple = EXEMPLES[index];

  return (
    <div className="script-demo">
      <div className="script-demo-caption"><span>LE TERRAIN D’ESSAI</span><span>3 jeux · code ouvert</span></div>
      <div className="script-demo-tabs">
        {EXEMPLES.map((ex, i) => (
          <button
            key={ex.nom}
            type="button"
            aria-pressed={i === index}
            onClick={() => {
              setIndex(i);
              setCle((k) => k + 1);
            }}
          >
            <span className="script-demo-number" aria-hidden="true">0{i + 1}</span>{ex.nom}
          </button>
        ))}
      </div>

      <div className="script-demo-body">
        <div className="script-demo-stage">
          <ScriptStage key={index} data={{ ...exemple, aide: "" }} cle={cle} />
          <div className="script-demo-actions">
            <button type="button" onClick={() => setCle((k) => k + 1)} className="portal-button secondary small">
              ↻ Relancer
            </button>
            <button type="button" onClick={() => setVoirCode((v) => !v)} className="portal-button secondary small">
              {voirCode ? "Cacher le code" : "Voir le code"}
            </button>
            <span className="script-demo-note">{exemple.desc}</span>
          </div>
        </div>

        {voirCode && (
          <pre className="script-demo-code" aria-label={`Code de ${exemple.nom}`}>
            {exemple.code}
          </pre>
        )}
      </div>
    </div>
  );
}
