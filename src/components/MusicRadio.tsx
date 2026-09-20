"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { NOTE_FREQS, RADIO_CATEGORIES, RADIO_TRACKS, type RadioTrack } from "@/lib/radio";

function playTone(ctx: AudioContext, freq: number, duration: number, volume: number, waveform: OscillatorType) {
  if (freq <= 0) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = waveform;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

export default function MusicRadio() {
  const [currentId, setCurrentId] = useState(RADIO_TRACKS[0].id);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string | null>(null);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepIndexRef = useRef(0);
  const playingRef = useRef(false);
  const mutedRef = useRef(false);
  const volumeRef = useRef(0.7);
  const currentIdRef = useRef(currentId);

  function ensureAudioCtx(): AudioContext {
    if (!audioCtxRef.current) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new Ctor();
    }
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    return audioCtxRef.current;
  }

  function scheduleNext() {
    if (!playingRef.current) return;
    const track = RADIO_TRACKS.find((t) => t.id === currentIdRef.current) ?? RADIO_TRACKS[0];
    if (track.kind !== "synth") return;
    const step = track.steps[stepIndexRef.current % track.steps.length];
    const beatMs = 60000 / track.bpm;
    const durationSec = (step.beats * beatMs) / 1000;
    const ctx = ensureAudioCtx();
    const gainLevel = mutedRef.current ? 0 : 0.07 * volumeRef.current;
    playTone(ctx, NOTE_FREQS[step.note], durationSec * 0.85, gainLevel, track.waveform);
    stepIndexRef.current += 1;
    timeoutRef.current = setTimeout(scheduleNext, durationSec * 1000);
  }

  function stop() {
    playingRef.current = false;
    setPlaying(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    audioElRef.current?.pause();
  }

  function playTrack(track: RadioTrack) {
    playingRef.current = true;
    setPlaying(true);
    if (track.kind === "audio") {
      if (audioElRef.current) {
        audioElRef.current.src = track.src;
        audioElRef.current.volume = volumeRef.current;
        audioElRef.current.play().catch(() => {});
      }
    } else {
      stepIndexRef.current = 0;
      scheduleNext();
    }
  }

  function togglePlay() {
    const track = RADIO_TRACKS.find((t) => t.id === currentId) ?? RADIO_TRACKS[0];
    if (playingRef.current) stop();
    else playTrack(track);
  }

  function toggleMute() {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (audioElRef.current) audioElRef.current.muted = next;
  }

  function changeVolume(next: number) {
    volumeRef.current = next;
    setVolume(next);
    if (audioElRef.current) audioElRef.current.volume = next;
  }

  function selectTrack(track: RadioTrack) {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    audioElRef.current?.pause();
    currentIdRef.current = track.id;
    setCurrentId(track.id);
    stepIndexRef.current = 0;
    if (playingRef.current) playTrack(track);
  }

  useEffect(() => stop, []);

  const current = RADIO_TRACKS.find((t) => t.id === currentId) ?? RADIO_TRACKS[0];
  const visibleTracks = useMemo(
    () => (category ? RADIO_TRACKS.filter((t) => t.category === category) : RADIO_TRACKS),
    [category],
  );

  return (
    <div data-site-chrome className="radio-dock">
      <audio ref={audioElRef} onEnded={stop} />
      {open && (
        <section id="pixolud-radio" role="dialog" aria-labelledby="radio-title" className="utility-panel radio-panel"
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
          <header className="utility-heading">
            <span className="utility-emblem radio-emblem" aria-hidden="true">♫</span>
            <div><p className="utility-kicker">LA BANDE-SON DE TES PARTIES</p><h2 id="radio-title">Radio Pixolud</h2></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fermer la radio" className="utility-close">×</button>
          </header>

          <div className="radio-current">
            <div className="radio-record" aria-hidden="true"><span>{current.emoji}</span></div>
            <div className="radio-current-copy">
              <span className="radio-state"><i className={playing ? "is-playing" : ""} />{playing ? "À L’ÉCOUTE" : "PRÊT À JOUER"}</span>
              <h3>{current.title}</h3>
              <p>{current.kind === "audio" ? current.composer : current.category}</p>
            </div>
          </div>

          <div className="radio-library-header"><h3>Ta sélection musicale</h3><span>{RADIO_TRACKS.length} titres</span></div>
          <div className="radio-filters" aria-label="Styles musicaux">
            <button type="button" onClick={() => setCategory(null)} aria-pressed={category === null}>Tout</button>
            {RADIO_CATEGORIES.map(cat => <button key={cat} type="button" onClick={() => setCategory(cat)} aria-pressed={category === cat}>{cat}</button>)}
          </div>
          <ul className="radio-tracks" aria-label="Morceaux disponibles">
            {visibleTracks.map((track, index) => (
              <li key={track.id}>
                <button type="button" onClick={() => selectTrack(track)} aria-pressed={track.id === currentId} className="radio-track">
                  <span className="radio-track-number" aria-hidden="true">{track.id === currentId ? "♫" : String(index + 1).padStart(2, "0")}</span>
                  <span className="radio-track-copy"><strong>{track.title}</strong><span>{track.kind === "audio" ? track.composer : track.category}</span></span>
                  <span className="radio-track-style">{track.category}</span>
                </button>
              </li>
            ))}
          </ul>

          <footer className="radio-player">
            <div className="radio-transport">
              <button type="button" onClick={togglePlay} aria-label={playing ? "Mettre en pause" : "Écouter le morceau"} className="radio-play">{playing ? "Ⅱ" : "▶"}</button>
              <div className="radio-volume">
                <div><span>Volume</span><output>{muted ? "Muet" : Math.round(volume * 100) + " %"}</output></div>
                <input type="range" min={0} max={100} value={Math.round(volume * 100)} onChange={e => changeVolume(Number(e.target.value) / 100)} aria-label="Volume" />
              </div>
              <button type="button" onClick={toggleMute} aria-pressed={muted} aria-label={muted ? "Réactiver le son" : "Couper le son"} className="radio-mute">{muted ? "🔇" : "🔊"}</button>
            </div>
            <p className="radio-credit">{current.kind === "audio" ? current.license + (current.attribution ? " · " + current.attribution : "") : "Musique générée, libre de droit"}</p>
          </footer>
        </section>
      )}
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="pixolud-radio" className="utility-launcher radio-launcher">
        <span className="launcher-note" aria-hidden="true">♫</span><span>{playing ? current.title : "Radio"}</span>
        {playing && <span className="radio-equalizer" aria-hidden="true"><i /><i /><i /></span>}
      </button>
    </div>
  );
}
