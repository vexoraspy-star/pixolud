"use client";

import { useEffect, useRef, useState } from "react";
import { MUSIQUE_LANE_FREQS, MUSIQUE_LANE_KEYS, MUSIQUE_LANES, type MusiqueData } from "@/lib/musique";
import { createClient } from "@/lib/supabase/client";

const TICK_MS = 500;
const HIT_TOLERANCE = 1;
const VISIBLE_STEPS_AHEAD = 5;
const ROW_HEIGHT = 40;
const LANE_HEIGHT = (VISIBLE_STEPS_AHEAD + 1) * ROW_HEIGHT;
const HIT_ZONE_Y = VISIBLE_STEPS_AHEAD * ROW_HEIGHT;

function playTone(ctx: AudioContext, freq: number, duration: number, volume: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

export default function MusiquePlayer({
  data,
  gameId,
  countsAsPlay = false,
}: {
  data: MusiqueData;
  gameId?: string;
  countsAsPlay?: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "playing" | "finished">("idle");
  const [currentStep, setCurrentStep] = useState(-VISIBLE_STEPS_AHEAD);
  const [score, setScore] = useState(0);
  const [hitKeys, setHitKeys] = useState<Set<string>>(new Set());
  const [flashLane, setFlashLane] = useState<number | null>(null);
  const currentStepRef = useRef(currentStep);
  const hitKeysRef = useRef(hitKeys);
  const hasCountedPlay = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  useEffect(() => {
    hitKeysRef.current = hitKeys;
  }, [hitKeys]);

  const totalNotes = data.notes.length;

  useEffect(() => {
    if (!countsAsPlay || !gameId || hasCountedPlay.current) return;
    hasCountedPlay.current = true;
    const supabase = createClient();
    supabase.rpc("increment_plays", { game_id: gameId });
  }, [countsAsPlay, gameId]);

  function ensureAudio(): AudioContext {
    if (!audioCtxRef.current) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new Ctor();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }

  function start() {
    ensureAudio();
    setStatus("playing");
  }

  useEffect(() => {
    if (status !== "playing") return;
    const interval = setInterval(() => {
      setCurrentStep((s) => {
        const next = s + 1;

        const ctx = audioCtxRef.current;
        if (ctx) {
          for (const [step, lane] of data.notes) {
            if (step === next) {
              playTone(ctx, MUSIQUE_LANE_FREQS[lane], 0.2, 0.15);
            }
          }
        }

        if (next > data.length + HIT_TOLERANCE) {
          setStatus("finished");
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [status, data.length, data.notes]);

  function handleLaneTap(lane: number) {
    if (status !== "playing") return;
    const step = currentStepRef.current;
    const match = data.notes.find(
      ([s, l]) =>
        l === lane &&
        Math.abs(s - step) <= HIT_TOLERANCE &&
        !hitKeysRef.current.has(`${s}-${l}`),
    );
    setFlashLane(lane);
    setTimeout(() => setFlashLane((f) => (f === lane ? null : f)), 150);
    if (match) {
      const key = `${match[0]}-${match[1]}`;
      setHitKeys((prev) => new Set(prev).add(key));
      setScore((s) => s + 1);
      const ctx = audioCtxRef.current;
      if (ctx) playTone(ctx, MUSIQUE_LANE_FREQS[lane] * 2, 0.08, 0.1);
    }
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (status !== "playing") return;
      const lane = MUSIQUE_LANE_KEYS.findIndex(
        (k) => k.toLowerCase() === e.key.toLowerCase(),
      );
      if (lane === -1) return;
      e.preventDefault();
      handleLaneTap(lane);
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, data.notes]);

  function restart() {
    setCurrentStep(-VISIBLE_STEPS_AHEAD);
    setScore(0);
    setHitKeys(new Set());
    setStatus("idle");
  }

  if (status === "idle") {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="animate-pulse text-5xl drop-shadow-sm">🎵</span>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {totalNotes} note{totalNotes > 1 ? "s" : ""} à jouer. Le son démarre
          quand tu cliques.
        </p>
        <button
          type="button"
          onClick={start}
          className="rounded-full bg-gradient-to-br from-pink-500 to-purple-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-purple-600/30 transition hover:scale-105 active:scale-95"
        >
          🔊 Commencer
        </button>
      </div>
    );
  }

  if (status === "finished") {
    const perfect = score === totalNotes;
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-gradient-to-br from-pink-50 to-purple-50 px-10 py-8 text-center shadow-inner dark:from-pink-950/30 dark:to-purple-950/30">
        <span className="text-5xl">{perfect ? "🎉" : "🎵"}</span>
        <p className="text-xl font-bold text-zinc-900 dark:text-white">
          Score : {score} / {totalNotes}
        </p>
        <button
          type="button"
          onClick={restart}
          className="rounded-full bg-gradient-to-br from-pink-500 to-purple-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-purple-600/30 transition hover:scale-105 active:scale-95"
        >
          Rejouer
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-600 shadow-sm dark:bg-zinc-800 dark:text-zinc-300">
        Score : {score} / {totalNotes}
      </span>

      <div className="flex gap-2">
        {Array.from({ length: MUSIQUE_LANES }).map((_, lane) => (
          <div
            key={lane}
            className="relative overflow-hidden rounded-xl border border-zinc-200 bg-gradient-to-b from-zinc-50 to-zinc-100 shadow-inner dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950"
            style={{ width: 56, height: LANE_HEIGHT }}
          >
            {data.notes
              .filter(([s, l]) => {
                if (l !== lane) return false;
                const stepsUntilHit = s - currentStep;
                return stepsUntilHit >= -1 && stepsUntilHit <= VISIBLE_STEPS_AHEAD;
              })
              .map(([s, l]) => {
                const stepsUntilHit = s - currentStep;
                const top = HIT_ZONE_Y - stepsUntilHit * ROW_HEIGHT;
                const hit = hitKeys.has(`${s}-${l}`);
                return (
                  <span
                    key={`${s}-${l}`}
                    className="absolute left-1/2 flex size-8 -translate-x-1/2 items-center justify-center rounded-full text-lg transition-opacity"
                    style={{ top, opacity: hit ? 0.15 : 1 }}
                  >
                    🎵
                  </span>
                );
              })}

            <button
              type="button"
              onClick={() => handleLaneTap(lane)}
              className={`absolute inset-x-0 flex items-center justify-center border-t-2 border-dashed text-xs font-bold transition-colors ${
                flashLane === lane
                  ? "border-violet-600 bg-violet-200/60 text-violet-700 dark:bg-violet-900/40"
                  : "border-zinc-300 text-zinc-400 dark:border-zinc-700"
              }`}
              style={{ top: HIT_ZONE_Y, height: ROW_HEIGHT }}
            >
              {MUSIQUE_LANE_KEYS[lane]}
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-zinc-400">
        Appuie sur {MUSIQUE_LANE_KEYS.join(" / ")} (ou tape la case) quand une
        note 🎵 atteint la ligne pointillée.
      </p>
    </div>
  );
}
