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

const CHANNEL = "arena-territoire";
const MOVE_MS = 140;

type Direction = [number, number];

const DIRECTIONS: Record<string, Direction> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

function emojiHue(emoji: string): number {
  const i = ARENA_CHARACTERS.indexOf(emoji);
  return ((i < 0 ? 0 : i) * 360) / ARENA_CHARACTERS.length;
}

function randomHome(): { territory: Set<string>; head: Point } {
  const cx = 5 + Math.floor(Math.random() * (ARENA_GRID_W - 10));
  const cy = 5 + Math.floor(Math.random() * (ARENA_GRID_H - 10));
  const territory = new Set<string>();
  for (let x = cx - 1; x <= cx + 1; x++) {
    for (let y = cy - 1; y <= cy + 1; y++) {
      territory.add(cellKey(x, y));
    }
  }
  return { territory, head: [cx, cy] };
}

function computeCapture(closed: Set<string>): Point[] {
  const outside = new Set<string>();
  const queue: Point[] = [];

  function seed(x: number, y: number) {
    const k = cellKey(x, y);
    if (!closed.has(k) && !outside.has(k)) {
      outside.add(k);
      queue.push([x, y]);
    }
  }

  for (let x = 0; x < ARENA_GRID_W; x++) {
    seed(x, 0);
    seed(x, ARENA_GRID_H - 1);
  }
  for (let y = 0; y < ARENA_GRID_H; y++) {
    seed(0, y);
    seed(ARENA_GRID_W - 1, y);
  }

  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= ARENA_GRID_W || ny >= ARENA_GRID_H) continue;
      const k = cellKey(nx, ny);
      if (closed.has(k) || outside.has(k)) continue;
      outside.add(k);
      queue.push([nx, ny]);
    }
  }

  const enclosed: Point[] = [];
  for (let y = 0; y < ARENA_GRID_H; y++) {
    for (let x = 0; x < ARENA_GRID_W; x++) {
      const k = cellKey(x, y);
      if (!closed.has(k) && !outside.has(k)) enclosed.push([x, y]);
    }
  }
  return enclosed;
}

interface Payload {
  id: string;
  pseudo: string;
  emoji: string;
  golden: boolean;
  head: Point;
  trail: Point[];
  territory: Point[];
  score: number;
  ts: number;
}

interface OtherPlayer {
  pseudo: string;
  emoji: string;
  golden: boolean;
  head: Point;
  trail: Point[];
  trailSet: Set<string>;
  territory: Point[];
  score: number;
  lastSeen: number;
}

export default function TerritoryGame({
  identity,
  onQuit,
}: {
  identity: ArenaIdentity;
  onQuit: () => void;
}) {
  const { pseudo, emoji, tier } = identity;
  const golden = hasGoldenName(tier);
  const [score, setScore] = useState(9);
  const [justDied, setJustDied] = useState(false);
  const [leaderboard, setLeaderboard] = useState<
    { pseudo: string; emoji: string; golden: boolean; score: number; self: boolean }[]
  >([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clientIdRef = useRef(crypto.randomUUID());
  const stateRef = useRef(
    (() => {
      const h = randomHome();
      return {
        territory: h.territory,
        trail: [] as Point[],
        trailSet: new Set<string>(),
        head: h.head,
        direction: [1, 0] as Direction,
        pendingDirection: [1, 0] as Direction,
      };
    })(),
  );
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
          head: p.head,
          trail: p.trail,
          trailSet: new Set(p.trail.map(([x, y]) => cellKey(x, y))),
          territory: p.territory,
          score: p.score,
          lastSeen: Date.now(),
        });
      })
      .subscribe();

    function handleKey(e: KeyboardEvent) {
      const dir = DIRECTIONS[e.key];
      if (!dir) return;
      e.preventDefault();
      const current = stateRef.current.direction;
      if (dir[0] === -current[0] && dir[1] === -current[1]) return;
      stateRef.current.pendingDirection = dir;
    }
    window.addEventListener("keydown", handleKey);

    function respawn() {
      const h = randomHome();
      stateRef.current.territory = h.territory;
      stateRef.current.trail = [];
      stateRef.current.trailSet = new Set();
      stateRef.current.head = h.head;
      stateRef.current.direction = [1, 0];
      stateRef.current.pendingDirection = [1, 0];
      setScore(h.territory.size);
    }

    const moveInterval = setInterval(() => {
      const st = stateRef.current;
      st.direction = st.pendingDirection;
      const [hx, hy] = st.head;
      const newHead: Point = [hx + st.direction[0], hy + st.direction[1]];
      const [nx, ny] = newHead;
      const newKey = cellKey(nx, ny);

      const hitsWall = nx < 0 || ny < 0 || nx >= ARENA_GRID_W || ny >= ARENA_GRID_H;
      const hitsOwnTrail = !hitsWall && st.trailSet.has(newKey);
      let hitsOtherTrail = false;
      let hitsOtherHead = false;
      if (!hitsWall) {
        for (const o of othersRef.current.values()) {
          if (o.trailSet.has(newKey)) hitsOtherTrail = true;
          if (o.head[0] === nx && o.head[1] === ny) hitsOtherHead = true;
        }
      }

      if (hitsWall || hitsOwnTrail || hitsOtherTrail || hitsOtherHead) {
        setJustDied(true);
        setTimeout(() => setJustDied(false), 1200);
        respawn();
      } else {
        st.head = newHead;
        if (st.territory.has(newKey)) {
          if (st.trail.length > 0) {
            const closed = new Set(st.territory);
            for (const [tx, ty] of st.trail) closed.add(cellKey(tx, ty));
            const enclosed = computeCapture(closed);
            for (const [tx, ty] of st.trail) st.territory.add(cellKey(tx, ty));
            for (const [ex, ey] of enclosed) st.territory.add(cellKey(ex, ey));
            st.trail = [];
            st.trailSet = new Set();
          }
        } else {
          st.trail.push(newHead);
          st.trailSet.add(newKey);
        }
        setScore(st.territory.size);
      }

      channel.send({
        type: "broadcast",
        event: "move",
        payload: {
          id: clientIdRef.current,
          pseudo,
          emoji,
          golden,
          head: st.head,
          trail: st.trail,
          territory: Array.from(st.territory, (k) => k.split(",").map(Number) as Point),
          score: st.territory.size,
          ts: Date.now(),
        } satisfies Payload,
      });

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#0b0b0e";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
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

        function drawTerritory(cells: Iterable<string>, hue: number) {
          ctx!.fillStyle = `hsla(${hue}, 80%, 55%, 0.28)`;
          for (const key of cells) {
            const [x, y] = key.split(",").map(Number);
            ctx!.fillRect(x * ARENA_CELL_PX, y * ARENA_CELL_PX, ARENA_CELL_PX, ARENA_CELL_PX);
          }
        }
        function drawTrail(points: Point[], hue: number) {
          ctx!.fillStyle = `hsla(${hue}, 90%, 60%, 0.65)`;
          for (const [x, y] of points) {
            ctx!.fillRect(x * ARENA_CELL_PX + 2, y * ARENA_CELL_PX + 2, ARENA_CELL_PX - 4, ARENA_CELL_PX - 4);
          }
        }
        function drawHead(x: number, y: number, e: string, hue: number) {
          ctx!.save();
          ctx!.shadowColor = `hsl(${hue}, 90%, 60%)`;
          ctx!.shadowBlur = 10;
          ctx!.font = `${ARENA_CELL_PX}px sans-serif`;
          ctx!.textAlign = "center";
          ctx!.textBaseline = "middle";
          ctx!.fillText(e, x * ARENA_CELL_PX + ARENA_CELL_PX / 2, y * ARENA_CELL_PX + ARENA_CELL_PX / 2);
          ctx!.restore();
        }

        for (const other of othersRef.current.values()) {
          const hue = emojiHue(other.emoji);
          drawTrail(other.trail, hue);
          drawHead(other.head[0], other.head[1], other.emoji, hue);
        }
        const myHue = emojiHue(emoji);
        for (const other of othersRef.current.values()) {
          drawTerritory(
            other.territory.map(([x, y]) => cellKey(x, y)),
            emojiHue(other.emoji),
          );
        }
        drawTerritory(st.territory, myHue);
        drawTrail(st.trail, myHue);
        drawHead(st.head[0], st.head[1], emoji, myHue);
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
      const mine = { pseudo, emoji, golden, score: stateRef.current.territory.size, self: true };
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
    <div className="mx-auto flex w-full flex-col items-center gap-4 px-4">
      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          🗺️ {emoji}{" "}
          <span className={golden ? "font-semibold text-amber-500" : ""}>{pseudo}</span> · Territoire : {score}
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
          {justDied && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-lg font-bold text-white">
              💥 Éliminé ! Nouveau territoire attribué.
            </div>
          )}
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
        Flèches du clavier pour te déplacer. Sors de ta zone pour tracer une
        traînée, reviens dessus pour capturer le terrain enfermé. Ne touche
        aucune traînée (la tienne ou celle des autres) !
      </p>
    </div>
  );
}
