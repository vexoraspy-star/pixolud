"use client";

import { useEffect, useRef, useState } from "react";
import { ARENA_STALE_MS, ARENA_CHARACTERS, hasGoldenName, type ArenaIdentity } from "@/lib/arena";
import { createClient } from "@/lib/supabase/client";

const CHANNEL = "arena-bulles";
const WORLD_W = 576;
const WORLD_H = 360;
const MIN_RADIUS = 14;
const BASE_SPEED = 160;
const PELLET_COUNT = 22;
const PELLET_LIFETIME_MS = 7000;
const BROADCAST_MS = 100;
const EAT_MARGIN = 1.15;

const KEY_DIRECTIONS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

function hash01(n: number): number {
  const x = Math.sin(n) * 10000;
  return x - Math.floor(x);
}

function pelletPosition(slot: number, bucket: number): [number, number] {
  const seed = slot * 977 + bucket * 31;
  const x = 20 + hash01(seed) * (WORLD_W - 40);
  const y = 20 + hash01(seed + 0.37) * (WORLD_H - 40);
  return [x, y];
}

function emojiHue(emoji: string): number {
  const i = ARENA_CHARACTERS.indexOf(emoji);
  return ((i < 0 ? 0 : i) * 360) / ARENA_CHARACTERS.length;
}

function randomSpawn(): [number, number] {
  return [40 + Math.random() * (WORLD_W - 80), 40 + Math.random() * (WORLD_H - 80)];
}

interface Payload {
  id: string;
  pseudo: string;
  emoji: string;
  golden: boolean;
  x: number;
  y: number;
  radius: number;
  ts: number;
}

interface OtherPlayer {
  pseudo: string;
  emoji: string;
  golden: boolean;
  x: number;
  y: number;
  radius: number;
  lastSeen: number;
}

export default function BubbleGame({
  identity,
  onQuit,
}: {
  identity: ArenaIdentity;
  onQuit: () => void;
}) {
  const { pseudo, emoji, tier } = identity;
  const golden = hasGoldenName(tier);
  const [size, setSize] = useState(Math.round(MIN_RADIUS));
  const [justAte, setJustAte] = useState(false);
  const [leaderboard, setLeaderboard] = useState<
    { pseudo: string; emoji: string; golden: boolean; score: number; self: boolean }[]
  >([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clientIdRef = useRef(crypto.randomUUID());
  const spawn = randomSpawn();
  const stateRef = useRef({ x: spawn[0], y: spawn[1], radius: MIN_RADIUS });
  const pressedRef = useRef(new Set<string>());
  const othersRef = useRef<Map<string, OtherPlayer>>(new Map());
  const eatenRef = useRef(new Map<number, number>());

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(CHANNEL, { config: { broadcast: { self: false } } });

    channel
      .on("broadcast", { event: "move" }, ({ payload }) => {
        const p = payload as Payload;
        if (p.id === clientIdRef.current) return;
        othersRef.current.set(p.id, {
          pseudo: p.pseudo,
          emoji: p.emoji,
          golden: p.golden,
          x: p.x,
          y: p.y,
          radius: p.radius,
          lastSeen: Date.now(),
        });
      })
      .subscribe();

    function handleKeyDown(e: KeyboardEvent) {
      if (!KEY_DIRECTIONS[e.key]) return;
      e.preventDefault();
      pressedRef.current.add(e.key);
    }
    function handleKeyUp(e: KeyboardEvent) {
      pressedRef.current.delete(e.key);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    function respawn() {
      const [x, y] = randomSpawn();
      stateRef.current = { x, y, radius: MIN_RADIUS };
      setSize(Math.round(MIN_RADIUS));
    }

    let raf = 0;
    let last = performance.now();

    function frame(now: number) {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const st = stateRef.current;

      let dx = 0;
      let dy = 0;
      for (const key of pressedRef.current) {
        const d = KEY_DIRECTIONS[key];
        if (d) {
          dx += d[0];
          dy += d[1];
        }
      }
      const len = Math.hypot(dx, dy);
      if (len > 0) {
        const speed = BASE_SPEED * (MIN_RADIUS / st.radius);
        st.x = Math.max(st.radius, Math.min(WORLD_W - st.radius, st.x + (dx / len) * speed * dt));
        st.y = Math.max(st.radius, Math.min(WORLD_H - st.radius, st.y + (dy / len) * speed * dt));
      }

      const bucket = Math.floor(now / PELLET_LIFETIME_MS);
      for (let slot = 0; slot < PELLET_COUNT; slot++) {
        if (eatenRef.current.get(slot) === bucket) continue;
        const [px, py] = pelletPosition(slot, bucket);
        if (Math.hypot(px - st.x, py - st.y) < st.radius) {
          eatenRef.current.set(slot, bucket);
          st.radius = Math.sqrt(st.radius * st.radius + 24);
          setSize(Math.round(st.radius));
        }
      }

      let died = false;
      for (const other of othersRef.current.values()) {
        const dist = Math.hypot(other.x - st.x, other.y - st.y);
        if (other.radius > st.radius * EAT_MARGIN && dist < other.radius * 0.7) {
          died = true;
        } else if (st.radius > other.radius * EAT_MARGIN && dist < st.radius * 0.7) {
          st.radius = Math.sqrt(st.radius * st.radius + other.radius * other.radius * 0.5);
          setSize(Math.round(st.radius));
          setJustAte(true);
          setTimeout(() => setJustAte(false), 300);
        }
      }
      if (died) respawn();

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const bg = ctx.createRadialGradient(
          WORLD_W / 2,
          WORLD_H / 2,
          0,
          WORLD_W / 2,
          WORLD_H / 2,
          WORLD_W * 0.7,
        );
        bg.addColorStop(0, "#1a1330");
        bg.addColorStop(1, "#07050d");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let slot = 0; slot < PELLET_COUNT; slot++) {
          if (eatenRef.current.get(slot) === bucket) continue;
          const [px, py] = pelletPosition(slot, bucket);
          ctx.beginPath();
          ctx.fillStyle = "rgba(232, 121, 249, 0.85)";
          ctx.shadowColor = "rgba(232, 121, 249, 0.9)";
          ctx.shadowBlur = 8;
          ctx.arc(px, py, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        function drawBubble(x: number, y: number, r: number, e: string, hue: number, label: string, self: boolean) {
          ctx!.save();
          const grad = ctx!.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
          grad.addColorStop(0, `hsla(${hue}, 90%, 75%, 0.95)`);
          grad.addColorStop(1, `hsla(${hue}, 85%, 45%, 0.85)`);
          ctx!.fillStyle = grad;
          ctx!.shadowColor = `hsla(${hue}, 90%, 60%, 0.8)`;
          ctx!.shadowBlur = self ? 18 : 8;
          ctx!.beginPath();
          ctx!.arc(x, y, r, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.lineWidth = self ? 2 : 1;
          ctx!.strokeStyle = `hsla(${hue}, 90%, 85%, 0.9)`;
          ctx!.stroke();
          ctx!.restore();

          ctx!.font = `${Math.max(12, r)}px sans-serif`;
          ctx!.textAlign = "center";
          ctx!.textBaseline = "middle";
          ctx!.fillText(e, x, y);

          ctx!.fillStyle = "rgba(255,255,255,0.85)";
          ctx!.font = "10px sans-serif";
          ctx!.fillText(label, x, y - r - 8);
        }

        for (const other of othersRef.current.values()) {
          drawBubble(other.x, other.y, other.radius, other.emoji, emojiHue(other.emoji), other.pseudo, false);
        }
        drawBubble(st.x, st.y, st.radius, emoji, emojiHue(emoji), pseudo, true);
      }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    const broadcastInterval = setInterval(() => {
      channel.send({
        type: "broadcast",
        event: "move",
        payload: {
          id: clientIdRef.current,
          pseudo,
          emoji,
          golden,
          x: stateRef.current.x,
          y: stateRef.current.y,
          radius: stateRef.current.radius,
          ts: Date.now(),
        } satisfies Payload,
      });
    }, BROADCAST_MS);

    const pruneInterval = setInterval(() => {
      const now = Date.now();
      for (const [id, p] of othersRef.current) {
        if (now - p.lastSeen > ARENA_STALE_MS) othersRef.current.delete(id);
      }
    }, 2000);

    const leaderboardInterval = setInterval(() => {
      const others = Array.from(othersRef.current.values()).map((o) => ({
        pseudo: o.pseudo,
        emoji: o.emoji,
        golden: o.golden,
        score: Math.round(o.radius),
        self: false,
      }));
      const mine = {
        pseudo,
        emoji,
        golden,
        score: Math.round(stateRef.current.radius),
        self: true,
      };
      setLeaderboard([mine, ...others].sort((a, b) => b.score - a.score).slice(0, 8));
    }, 500);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      cancelAnimationFrame(raf);
      clearInterval(broadcastInterval);
      clearInterval(pruneInterval);
      clearInterval(leaderboardInterval);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-4">
      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          🫧 {emoji}{" "}
          <span className={golden ? "font-semibold text-amber-500" : ""}>{pseudo}</span> · Taille :{" "}
          <span className={justAte ? "text-fuchsia-500" : ""}>{size}</span>
        </p>
        <button
          type="button"
          onClick={onQuit}
          className="text-sm font-medium text-zinc-400 hover:text-violet-600"
        >
          Quitter
        </button>
      </div>

      <div className="flex w-full flex-col gap-4 lg:flex-row">
        <div
          className="relative mx-auto w-full overflow-hidden rounded-2xl border border-zinc-200 shadow-inner dark:border-zinc-800"
          style={{ maxWidth: WORLD_W }}
        >
          <canvas ref={canvasRef} width={WORLD_W} height={WORLD_H} className="block h-auto w-full" />
        </div>

        <div className="w-full max-w-xs shrink-0 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="mb-2 text-sm font-bold text-zinc-900 dark:text-white">
            🏆 Classement
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {leaderboard.map((p, i) => (
              <li
                key={`${p.pseudo}-${i}`}
                className={`flex items-center justify-between rounded-lg px-2 py-1 ${
                  p.self ? "bg-violet-100 dark:bg-violet-900/40" : ""
                }`}
              >
                <span className={p.golden ? "font-semibold text-amber-500" : ""}>
                  {p.emoji} {p.pseudo}
                </span>
                <span className="font-medium">{p.score}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="text-xs text-zinc-400">
        Flèches du clavier pour te déplacer. Absorbe les bulles 🫧 et les
        joueurs plus petits que toi, évite ceux qui sont plus gros !
      </p>
    </div>
  );
}
