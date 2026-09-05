"use client";

import { useEffect, useRef, useState } from "react";
import {
  ARENA_CELL_PX,
  ARENA_CHANNEL,
  ARENA_CHARACTERS,
  ARENA_GRID_H,
  ARENA_GRID_W,
  ARENA_GROWTH_TICKS,
  ARENA_MOVE_MS,
  ARENA_STALE_MS,
  type ArenaBroadcastPayload,
  type Point,
} from "@/lib/arena";
import { createClient } from "@/lib/supabase/client";

type Direction = [number, number];

const DIRECTIONS: Record<string, Direction> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

function randomStart(): Point[] {
  const x = Math.floor(Math.random() * ARENA_GRID_W);
  const y = Math.floor(Math.random() * ARENA_GRID_H);
  return [[x, y]];
}

function wrap(n: number, max: number): number {
  return (n + max) % max;
}

interface OtherPlayer {
  pseudo: string;
  emoji: string;
  segments: Point[];
  score: number;
  lastSeen: number;
}

export default function ArenaGame({ initialPseudo }: { initialPseudo: string }) {
  const [phase, setPhase] = useState<"select" | "playing">("select");
  const [pseudo, setPseudo] = useState(initialPseudo);
  const [emoji, setEmoji] = useState(ARENA_CHARACTERS[0]);
  const [score, setScore] = useState(1);
  const [justDied, setJustDied] = useState(false);
  const [leaderboard, setLeaderboard] = useState<
    { pseudo: string; emoji: string; score: number; self: boolean }[]
  >([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clientIdRef = useRef(crypto.randomUUID());
  const stateRef = useRef({
    segments: randomStart(),
    direction: [1, 0] as Direction,
    pendingDirection: [1, 0] as Direction,
    ticksSinceGrowth: 0,
    targetLength: 3,
  });
  const othersRef = useRef<Map<string, OtherPlayer>>(new Map());

  useEffect(() => {
    if (phase !== "playing") return;

    const supabase = createClient();
    const channel = supabase.channel(ARENA_CHANNEL, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "move" }, ({ payload }) => {
        const p = payload as ArenaBroadcastPayload;
        if (p.id === clientIdRef.current) return;
        othersRef.current.set(p.id, {
          pseudo: p.pseudo,
          emoji: p.emoji,
          segments: p.segments,
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
      if (dir[0] === -current[0] && dir[1] === -current[1] && stateRef.current.segments.length > 1) {
        return;
      }
      stateRef.current.pendingDirection = dir;
    }
    window.addEventListener("keydown", handleKey);

    function respawn() {
      stateRef.current.segments = randomStart();
      stateRef.current.direction = [1, 0];
      stateRef.current.pendingDirection = [1, 0];
      stateRef.current.ticksSinceGrowth = 0;
      stateRef.current.targetLength = 3;
      setScore(1);
    }

    const moveInterval = setInterval(() => {
      const st = stateRef.current;
      st.direction = st.pendingDirection;
      const head = st.segments[0];
      const newHead: Point = [
        wrap(head[0] + st.direction[0], ARENA_GRID_W),
        wrap(head[1] + st.direction[1], ARENA_GRID_H),
      ];

      const hitsSelf = st.segments
        .slice(0, st.segments.length - 1)
        .some(([x, y]) => x === newHead[0] && y === newHead[1]);
      const hitsOther = Array.from(othersRef.current.values()).some((o) =>
        o.segments.some(([x, y]) => x === newHead[0] && y === newHead[1]),
      );

      if (hitsSelf || hitsOther) {
        setJustDied(true);
        setTimeout(() => setJustDied(false), 1200);
        respawn();
      } else {
        st.segments = [newHead, ...st.segments];
        st.ticksSinceGrowth += 1;
        if (st.ticksSinceGrowth >= ARENA_GROWTH_TICKS) {
          st.ticksSinceGrowth = 0;
          st.targetLength += 1;
        }
        if (st.segments.length > st.targetLength) {
          st.segments.pop();
        }
        setScore(st.segments.length);
      }

      channel.send({
        type: "broadcast",
        event: "move",
        payload: {
          id: clientIdRef.current,
          pseudo,
          emoji,
          segments: st.segments,
          score: st.segments.length,
          ts: Date.now(),
        } satisfies ArenaBroadcastPayload,
      });

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#18181b";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = `${ARENA_CELL_PX}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (const other of othersRef.current.values()) {
          for (const [x, y] of other.segments) {
            ctx.fillText(
              other.emoji,
              x * ARENA_CELL_PX + ARENA_CELL_PX / 2,
              y * ARENA_CELL_PX + ARENA_CELL_PX / 2,
            );
          }
        }
        for (const [x, y] of st.segments) {
          ctx.fillText(
            emoji,
            x * ARENA_CELL_PX + ARENA_CELL_PX / 2,
            y * ARENA_CELL_PX + ARENA_CELL_PX / 2,
          );
        }
      }
    }, ARENA_MOVE_MS);

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
        score: o.score,
        self: false,
      }));
      const mine = { pseudo, emoji, score: stateRef.current.segments.length, self: true };
      setLeaderboard(
        [mine, ...others].sort((a, b) => b.score - a.score).slice(0, 8),
      );
    }, 500);

    return () => {
      window.removeEventListener("keydown", handleKey);
      clearInterval(moveInterval);
      clearInterval(pruneInterval);
      clearInterval(leaderboardInterval);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (phase === "select") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          🐍 Arène multijoueur
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Une grande carte partagée avec les autres joueurs connectés en même
          temps que toi. Choisis ton personnage et ton nom.
        </p>

        <input
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value.slice(0, 20))}
          placeholder="Ton nom"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
        />

        <div className="flex flex-wrap justify-center gap-2">
          {ARENA_CHARACTERS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setEmoji(c)}
              className={`flex size-11 items-center justify-center rounded-full text-xl ${
                emoji === c
                  ? "bg-violet-100 ring-2 ring-violet-600 dark:bg-violet-900/50"
                  : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={!pseudo.trim()}
          onClick={() => setPhase("playing")}
          className="mt-2 w-full rounded-full bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Rejoindre l&apos;arène
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-4">
      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {emoji} {pseudo} · Taille : {score}
        </p>
        <button
          type="button"
          onClick={() => setPhase("select")}
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
              💥 Perdu ! On repart de zéro.
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
                <span>
                  {p.emoji} {p.pseudo}
                </span>
                <span className="font-medium">{p.score}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="text-xs text-zinc-400">
        Utilise les flèches du clavier pour te déplacer. Ton serpent grandit
        tout seul avec le temps — évite ta propre queue et celle des autres
        joueurs !
      </p>
    </div>
  );
}
