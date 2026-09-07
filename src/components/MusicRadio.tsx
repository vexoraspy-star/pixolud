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
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string | null>(null);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepIndexRef = useRef(0);
  const playingRef = useRef(false);
  const mutedRef = useRef(false);
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
    playTone(ctx, NOTE_FREQS[step.note], durationSec * 0.85, mutedRef.current ? 0 : 0.07, track.waveform);
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
    <div className="fixed bottom-20 start-4 z-40 flex flex-col items-start gap-2 sm:bottom-4 sm:start-20">
      <audio ref={audioElRef} onEnded={stop} />

      {open && (
        <div className="flex max-h-[75vh] w-72 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-bold text-white">
              <span className="text-lg">📻</span> Radio Pixolud
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer la radio"
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-zinc-800 px-3 py-2">
            <button
              type="button"
              onClick={() => setCategory(null)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                category === null
                  ? "bg-violet-600 text-white"
                  : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Tout
            </button>
            {RADIO_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                  category === cat
                    ? "bg-violet-600 text-white"
                    : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
            {visibleTracks.map((t) => {
              const active = t.id === currentId;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => selectTrack(t)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      active ? "bg-violet-600/20 text-violet-300" : "text-zinc-300 hover:bg-zinc-900"
                    }`}
                  >
                    <span className="text-base">{t.emoji}</span>
                    <span className="flex-1 truncate">
                      <span className="block truncate font-medium">{t.title}</span>
                      <span className="block truncate text-[10px] text-zinc-500">
                        {t.kind === "audio" ? `${t.composer} · ${t.category}` : t.category}
                      </span>
                    </span>
                    {active && playing && <span className="text-xs text-violet-400">▶</span>}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center gap-3 border-t border-zinc-800 bg-zinc-900 px-4 py-3">
            <button
              type="button"
              onClick={togglePlay}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white shadow-md transition hover:scale-105 active:scale-95"
            >
              {playing ? "⏸" : "▶"}
            </button>
            <button
              type="button"
              onClick={toggleMute}
              title={muted ? "Réactiver le son" : "Couper le son"}
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-zinc-300 hover:bg-zinc-800"
            >
              {muted ? "🔇" : "🔊"}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{current.title}</p>
              <p className="truncate text-[10px] text-zinc-400">
                {current.kind === "audio"
                  ? `${current.license}${current.attribution ? ` · ${current.attribution}` : ""}`
                  : "Musique générée, libre de droit"}
              </p>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-white/20 bg-gradient-to-br from-violet-600 to-fuchsia-600 px-3 py-2 text-white shadow-lg transition hover:scale-105 active:scale-95"
      >
        <span className="text-lg">{playing ? current.emoji : "📻"}</span>
        <span className="max-w-[8rem] truncate text-xs font-semibold">
          {playing ? current.title : "Radio"}
        </span>
      </button>
    </div>
  );
}
