"use client";

import { useEffect, useRef, useState } from "react";
import {
  ARENA_CELL_PX,
  ARENA_GRID_H,
  ARENA_GRID_W,
  ARENA_STALE_MS,
  ARENA_CHARACTERS,
  hasGoldenName,
  type ArenaIdentity,
  type Point,
} from "@/lib/arena";
import { createClient } from "@/lib/supabase/client";

const CHANNEL = "arena-chasse";
const MOVE_MS = 130;
const GEM_COUNT = 6;
const GEM_LIFETIME_MS = 3200;

type Direction = [number, number];

const DIRECTIONS: Record<string, Direction> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

function wrap(n: number, max: number): number {
  return (n + max) % max;
}

function hash01(n: number): number {
  const x = Math.sin(n) * 10000;
  return x - Math.floor(x);
}

function gemPosition(slot: number, bucket: number): Point {
  const seed = slot * 977 + bucket * 31;
  const x = Math.floor(hash01(seed) * ARENA_GRID_W);
  const y = Math.floor(hash01(seed + 0.37) * ARENA_GRID_H);
  return [x, y];
}

function emojiHue(emoji: string): number {
  const i = ARENA_CHARACTERS.indexOf(emoji);
  return ((i < 0 ? 0 : i) * 360) / ARENA_CHARACTERS.length;
}

interface Payload {
  id: string;
  pseudo: string;
  emoji: string;
  golden: boolean;
  pos: Point;
  score: number;
  ts: number;
}

interface OtherPlayer {
  pseudo: string;
  emoji: string;
  golden: boolean;
  pos: Point;
  score: number;
  lastSeen: number;
}

export default function TreasureHuntGame({
  identity,
  onQuit,
}: {
  identity: ArenaIdentity;
  onQuit: () => void;
}) {
  const { pseudo, emoji, tier } = identity;
  const golden = hasGoldenName(tier);
  const [score, setScore] = useState(0);
  const [justScored, setJustScored] = useState(false);
  const [leaderboard, setLeaderboard] = useState<
    { pseudo: string; emoji: string; golden: boolean; score: number; self: boolean }[]
  >([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clientIdRef = useRef(crypto.randomUUID());
  const stateRef = useRef({
    pos: [Math.floor(ARENA_GRID_W / 2), Math.floor(ARENA_GRID_H / 2)] as Point,
    direction: [1, 0] as Direction,
    pendingDirection: [1, 0] as Direction,
    score: 0,
    collectedAt: new Map<number, number>(),
  });
  const othersRef = useRef<Map<string, OtherPlayer>>(new Map());

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
          pos: p.pos,
          score: p.score,
          lastSeen: Date.now(),
        });
      })
      .subscribe();

    function handleKey(e: KeyboardEvent) {
      const dir = DIRECTIONS[e.key];
      if (!dir) return;
      e.preventDefault();
      stateRef.current.pendingDirection = dir;
    }
    window.addEventListener("keydown", handleKey);

    const moveInterval = setInterval(() => {
      const st = stateRef.current;
      st.direction = st.pendingDirection;
      const [x, y] = st.pos;
      st.pos = [wrap(x + st.direction[0], ARENA_GRID_W), wrap(y + st.direction[1], ARENA_GRID_H)];

      const bucket = Math.floor(Date.now() / GEM_LIFETIME_MS);
      for (let slot = 0; slot < GEM_COUNT; slot++) {
        if (st.collectedAt.get(slot) === bucket) continue;
        const [gx, gy] = gemPosition(slot, bucket);
        if (gx === st.pos[0] && gy === st.pos[1]) {
          st.collectedAt.set(slot, bucket);
          st.score += 1;
          setScore(st.score);
          setJustScored(true);
          setTimeout(() => setJustScored(false), 300);
        }
      }

      channel.send({
        type: "broadcast",
        event: "move",
        payload: {
          id: clientIdRef.current,
          pseudo,
          emoji,
          golden,
          pos: st.pos,
          score: st.score,
          ts: Date.now(),
        } satisfies Payload,
      });

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
        bg.addColorStop(0, "#151022");
        bg.addColorStop(1, "#0a0812");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "rgba(255,255,255,0.04)";
        for (let gx = 0; gx <= ARENA_GRID_W; gx++) {
          ctx.beginPath();
          ctx.moveTo(gx * ARENA_CELL_PX, 0);
          ctx.lineTo(gx * ARENA_CELL_PX, canvas.height);
          ctx.stroke();
        }
        for (let gy = 0; gy <= ARENA_GRID_H; gy++) {
          ctx.beginPath();
          ctx.moveTo(0, gy * ARENA_CELL_PX);
          ctx.lineTo(canvas.width, gy * ARENA_CELL_PX);
          ctx.stroke();
        }

        const pulse = 0.85 + 0.15 * Math.sin(Date.now() / 180);
        for (let slot = 0; slot < GEM_COUNT; slot++) {
          if (st.collectedAt.get(slot) === bucket) continue;
          const [gx, gy] = gemPosition(slot, bucket);
          ctx.save();
          ctx.shadowColor = "rgba(217, 70, 239, 0.9)";
          ctx.shadowBlur = 14 * pulse;
          ctx.font = `${ARENA_CELL_PX * pulse}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(
            "💎",
            gx * ARENA_CELL_PX + ARENA_CELL_PX / 2,
            gy * ARENA_CELL_PX + ARENA_CELL_PX / 2,
          );
          ctx.restore();
        }

        function drawPlayer(x: number, y: number, e: string, hue: number, label: string, isSelf: boolean) {
          ctx!.save();
          ctx!.shadowColor = `hsl(${hue}, 90%, 60%)`;
          ctx!.shadowBlur = isSelf ? 16 : 8;
          ctx!.font = `${ARENA_CELL_PX}px sans-serif`;
          ctx!.textAlign = "center";
          ctx!.textBaseline = "middle";
          ctx!.fillText(e, x * ARENA_CELL_PX + ARENA_CELL_PX / 2, y * ARENA_CELL_PX + ARENA_CELL_PX / 2);
          ctx!.restore();
          ctx!.fillStyle = "rgba(255,255,255,0.7)";
          ctx!.font = "9px sans-serif";
          ctx!.textAlign = "center";
          ctx!.fillText(label, x * ARENA_CELL_PX + ARENA_CELL_PX / 2, y * ARENA_CELL_PX - 4);
        }

        for (const other of othersRef.current.values()) {
          drawPlayer(other.pos[0], other.pos[1], other.emoji, emojiHue(other.emoji), other.pseudo, false);
        }
        drawPlayer(st.pos[0], st.pos[1], emoji, emojiHue(emoji), pseudo, true);
      }
    }, MOVE_MS);

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
        score: o.score,
        self: false,
      }));
      const mine = { pseudo, emoji, golden, score: stateRef.current.score, self: true };
      setLeaderboard([mine, ...others].sort((a, b) => b.score - a.score).slice(0, 8));
    }, 500);

    return () => {
      window.removeEventListener("keydown", handleKey);
      clearInterval(moveInterval);
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
          💎 {emoji}{" "}
          <span className={golden ? "font-semibold text-amber-500" : ""}>{pseudo}</span> · Gemmes :{" "}
          <span className={justScored ? "text-fuchsia-500" : ""}>{score}</span>
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
          style={{ maxWidth: ARENA_GRID_W * ARENA_CELL_PX }}
        >
          <canvas
            ref={canvasRef}
            width={ARENA_GRID_W * ARENA_CELL_PX}
            height={ARENA_GRID_H * ARENA_CELL_PX}
            className="block h-auto w-full"
          />
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
        Flèches du clavier pour te déplacer (la carte boucle sur les bords).
        Ramasse un maximum de 💎 avant qu&apos;elles ne disparaissent !
      </p>
    </div>
  );
}
