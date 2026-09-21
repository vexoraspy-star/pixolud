"use client";
import { useState } from "react";
import { SCREAMERS, type ScreamerId } from "@/lib/screamers";
import Screamer from "./Screamer";
import "./screamers.css";

export default function ScreamerGallery() {
  const [preview, setPreview] = useState<ScreamerId | null>(null);
  return <section className="screamer-gallery">
    <div><h3>La collection des frissons</h3><p>Les deux nouvelles créatures alternent à chaque screamer. Essaie-les ici, uniquement sur ton écran.</p></div>
    <div className="screamer-options">{SCREAMERS.map(s => <button key={s.id} type="button" onClick={() => setPreview(s.id)} aria-label={`Essayer ${s.name} sur mon écran`}>
      <span className="screamer-thumbnail" style={s.image ? {backgroundImage:`url(${s.image})`} : undefined}>{!s.image && <span aria-hidden="true">☠</span>}</span>
      <strong>{s.name}</strong><span>{s.description}</span><b>Essayer sur moi ↗</b>
    </button>)}</div>
    {preview && <Screamer key={preview} variant={preview} onDone={() => setPreview(null)}/>}
  </section>;
}
