"use client";

import { useEffect, useRef, useState } from "react";
import { NOTE_FREQS, RADIO_TRACKS } from "@/lib/radio";

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

  const audioCtxRef = useRef<AudioContext | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepIndexRef = useRef(0);
  const playingRef = useRef(false);
  const currentIdRef = useRef(currentId);

  function ensureAudio(): AudioContext {
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
    const step = track.steps[stepIndexRef.current % track.steps.length];
    const beatMs = 60000 / track.bpm;
    const durationSec = (step.beats * beatMs) / 1000;
    const ctx = ensureAudio();
    playTone(ctx, NOTE_FREQS[step.note], durationSec * 0.85, 0.07, track.waveform);
    stepIndexRef.current += 1;
    timeoutRef.current = setTimeout(scheduleNext, durationSec * 1000);
  }

  function stop() {
    playingRef.current = false;
    setPlaying(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }

  function play() {
    playingRef.current = true;
    setPlaying(true);
    stepIndexRef.current = 0;
    scheduleNext();
  }

  function togglePlay() {
    if (playingRef.current) stop();
    else play();
  }

  function selectTrack(id: string) {
    currentIdRef.current = id;
    setCurrentId(id);
    stepIndexRef.current = 0;
    if (playingRef.current) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      scheduleNext();
    }
  }

  useEffect(() => stop, []);

  const current = RADIO_TRACKS.find((t) => t.id === currentId) ?? RADIO_TRACKS[0];

  return (
    <div className="flex w-full max-w-xs flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-lg">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
        <span className="text-lg">📻</span>
        <span className="text-sm font-bold text-white">Radio Pixolud</span>
      </div>

      <ul className="flex flex-col gap-0.5 p-2">
        {RADIO_TRACKS.map((t) => {
          const active = t.id === currentId;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => selectTrack(t.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                  active ? "bg-violet-600/20 text-violet-300" : "text-zinc-300 hover:bg-zinc-900"
                }`}
              >
                <span className="text-base">{t.emoji}</span>
                <span className="flex-1 truncate">
                  <span className="block truncate font-medium">{t.title}</span>
                  <span className="block truncate text-[10px] text-zinc-500">{t.genre}</span>
                </span>
                {active && playing && <span className="text-xs text-violet-400">▶</span>}
              </button>
            </li>
          );
        })}

        <li className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-600">
          <span className="text-base">🔒</span>
          <span className="flex-1 truncate">
            <span className="block truncate font-medium">Classique (domaine public)</span>
            <span className="block truncate text-[10px]">Bientôt disponible</span>
          </span>
        </li>
        <li className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-600">
          <span className="text-base">🔒</span>
          <span className="flex-1 truncate">
            <span className="block truncate font-medium">Creative Commons</span>
            <span className="block truncate text-[10px]">Bientôt disponible</span>
          </span>
        </li>
      </ul>

      <div className="flex items-center gap-3 border-t border-zinc-800 bg-zinc-900 px-4 py-3">
        <button
          type="button"
          onClick={togglePlay}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white shadow-md transition hover:scale-105 active:scale-95"
        >
          {playing ? "⏸" : "▶"}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-white">{current.title}</p>
          <p className="truncate text-[10px] text-zinc-400">{current.genre} · musique générée, libre de droit</p>
        </div>
      </div>
    </div>
  );
}
