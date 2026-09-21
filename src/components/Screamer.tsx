"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { chooseScreamer, SCREAMERS, type ScreamerId } from "@/lib/screamers";
import ClassicScare from "./ClassicScare";
import "./screamers.css";

export default function Screamer({ onDone, variant }: { onDone: () => void; variant?: ScreamerId }) {
  const [selected] = useState<ScreamerId>(() => variant ?? chooseScreamer());
  const creature = SCREAMERS.find(s => s.id === selected) ?? SCREAMERS[0];
  const [ready, setReady] = useState(!creature.image);
  const [failed, setFailed] = useState(false);
  const [finished, setFinished] = useState(false);
  const closeRef = useRef(onDone);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current = onDone; }, [onDone]);

  useEffect(() => {
    const previous = document.activeElement;
    closeButton.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); closeRef.current(); }
    };
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("keydown", escape, true);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => {
    // Une image indisponible ne doit jamais bloquer l'ecran noir.
    if (ready) return;
    const timer = setTimeout(() => { setFailed(true); setReady(true); }, 2500);
    return () => clearTimeout(timer);
  }, [ready]);

  useEffect(() => {
    if (!ready || finished) return;
    let ctx: AudioContext | null = null;
    try {
      ctx = new AudioContext();
      const now = ctx.currentTime;
      const master = ctx.createGain();
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -16;
      limiter.ratio.value = 8;
      master.gain.setValueAtTime(0.001, now);
      master.gain.exponentialRampToValueAtTime(0.24, now + 0.035);
      master.gain.exponentialRampToValueAtTime(0.001, now + 1.35);
      master.connect(limiter); limiter.connect(ctx.destination);
      const voices = selected === "veilleur" ? [[180,52],[237,71]] : [[720,145],[913,190]];
      for (const [from,to] of voices) {
        const oscillator = ctx.createOscillator();
        oscillator.type = "sawtooth";
        oscillator.frequency.setValueAtTime(from, now);
        oscillator.frequency.exponentialRampToValueAtTime(to, now + 1.3);
        oscillator.connect(master); oscillator.start(now); oscillator.stop(now + 1.4);
      }
      const buffer = ctx.createBuffer(1,Math.floor(ctx.sampleRate * 1.3),ctx.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i=0; i<samples.length; i++) samples[i] = (Math.random()*2-1) * (1-i/samples.length);
      const noise = ctx.createBufferSource(); noise.buffer = buffer;
      const filter = ctx.createBiquadFilter(); filter.type = "bandpass"; filter.frequency.value = selected === "veilleur" ? 800 : 2200;
      noise.connect(filter); filter.connect(master); noise.start(now);
      void ctx.resume().catch(() => {});
    } catch { /* Le visuel reste disponible sans audio. */ }
    const timer = setTimeout(() => setFinished(true), 1900);
    return () => { clearTimeout(timer); void ctx?.close().catch(() => {}); };
  }, [ready, finished, selected]);

  useEffect(() => {
    if (!finished) return;
    const timer = setTimeout(() => closeRef.current(), 3500);
    return () => clearTimeout(timer);
  }, [finished]);

  if (typeof document === "undefined") return null;
  // Le portail reste au-dessus du jeu, meme dans sa vue plein ecran.
  const host = document.fullscreenElement ?? document.body;
  return createPortal(finished ? <button type="button" className="screamer-credit" onClick={() => closeRef.current()}>✦ {creature.name} · Pixolud <span aria-hidden="true">×</span></button> :
    <div className="screamer-stage" role="dialog" aria-label={`Screamer : ${creature.name}`} aria-modal="true">
      <button ref={closeButton} type="button" className="screamer-close" onClick={() => closeRef.current()} aria-label="Fermer le screamer">Fermer <span aria-hidden="true">×</span></button>
      <button type="button" className="screamer-surface" aria-label="Fermer le screamer en cliquant sur l’image" onClick={() => closeRef.current()}>
        <div className={ready ? "screamer-portrait is-ready" : "screamer-portrait"}>
          {creature.image && !failed ?
            // Chargement direct du petit fichier local pour un affichage immediat.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={creature.image} width={1024} height={1024} alt="" draggable={false} onLoad={() => setReady(true)} onError={() => { setFailed(true); setReady(true); }} /> : <ClassicScare/>}
        </div>
      </button>
    </div>, host);
}
