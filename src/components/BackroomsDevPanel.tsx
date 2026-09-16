"use client";

import { useEffect, useRef } from "react";
import { CELL_OPEN, CELL_RACK, type LevelDef } from "@/lib/backrooms";

/**
 * Panneau du mode developpeur des Backrooms.
 *
 * Reserve aux comptes admin : la page serveur lit `profiles.is_admin` et ne
 * transmet le droit qu'a eux. Comme le Manoir, le jeu tourne dans le
 * navigateur : ces outils ne touchent qu'a la partie en cours, en solo.
 */

export interface BackroomsDevFlags {
  /** Camera libre, sans collision. Espace monte, C descend. */
  fly: boolean;
  /** Traverser les murs, au niveau du sol. */
  noclip: boolean;
  /** Aucune entite ne peut t'attraper. */
  god: boolean;
  /** Lucidite, pile et endurance ne baissent plus. */
  infinite: boolean;
  /** L'entite ne bouge plus. */
  freeze: boolean;
  /** Deplacement x3. */
  fast: boolean;
}

export const BACKROOMS_DEV_OFF: BackroomsDevFlags = {
  fly: false,
  noclip: false,
  god: false,
  infinite: false,
  freeze: false,
  fast: false,
};

export interface BackroomsDevSnapshot {
  player: { x: number; z: number; yaw: number };
  entity: { x: number; z: number; active: boolean; state: string } | null;
  exit: { x: number; z: number };
  pickups: { x: number; z: number; kind: string }[];
  valves: { x: number; z: number; done: boolean }[];
  sanity: number;
  battery: number;
  progress: string;
  flyHeight: number;
  fps: number;
  pixelRatio: number;
}

const TOGGLES: { key: keyof BackroomsDevFlags; label: string; hint: string }[] = [
  { key: "fly", label: "Vol", hint: "Espace monte · C descend" },
  { key: "noclip", label: "Traverser les murs", hint: "Au niveau du sol" },
  { key: "god", label: "Invincible", hint: "Aucune entité ne t'attrape" },
  { key: "infinite", label: "Lucidité et pile infinies", hint: "Endurance aussi" },
  { key: "freeze", label: "Figer l'entité", hint: "Elle ne bouge plus" },
  { key: "fast", label: "Vitesse ×3", hint: "Aussi pour le vol" },
];

const STATE_NAMES: Record<string, string> = {
  errer: "Erre",
  enqueter: "Enquête sur un bruit",
  poursuivre: "Te poursuit",
  fouiller: "Fouille",
  debusquer: "Débusque",
};

const PICKUP_COLORS: Record<string, string> = {
  eau: "#7dd3fc",
  pile: "#facc15",
  fusible: "#f97316",
};

export default function BackroomsDevPanel({
  level,
  cells,
  width,
  height,
  flags,
  onFlags,
  snap,
  onTeleport,
  onAdvance,
  onClose,
}: {
  level: LevelDef;
  cells: Uint8Array;
  width: number;
  height: number;
  flags: BackroomsDevFlags;
  onFlags: (next: BackroomsDevFlags) => void;
  snap: BackroomsDevSnapshot | null;
  onTeleport: (x: number, z: number) => void;
  onAdvance: () => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Le plan est dessine une fois par niveau sur un canvas : 5 000 cases en
  // SVG ralentiraient le panneau a chaque rafraichissement de la carte.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scale = 4;
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const c = cells[y * width + x];
        if (c === CELL_OPEN) ctx.fillStyle = "#3a3522";
        else if (c === CELL_RACK) ctx.fillStyle = "#1e3350";
        else continue;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }, [cells, width, height]);

  function onMapClick(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    onTeleport(((e.clientX - r.left) / r.width) * width, ((e.clientY - r.top) / r.height) * height);
  }

  const advanceLabel =
    level.objective === "fusibles" && snap && snap.progress !== "fini"
      ? "Donner les fusibles"
      : level.objective === "vannes" && snap && snap.progress !== "fini"
        ? level.id === "niveau-3"
          ? "Relever tous les disjoncteurs"
          : "Fermer toutes les vannes"
        : "Passer au niveau suivant";

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute bottom-0 left-0 top-0 z-40 flex w-[21rem] max-w-[92vw] flex-col gap-3 overflow-y-auto border-r border-amber-500/30 bg-zinc-950/92 p-3 font-sans text-white shadow-2xl backdrop-blur"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wider text-amber-300">Mode développeur</p>
          <p className="text-[10px] text-zinc-500">F2 pour fermer · Échap pour libérer la souris</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-white/5 px-2.5 py-1 text-xs font-semibold text-zinc-300 hover:bg-white/10"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-lg bg-white/5 px-1 py-1.5">
          <p className="text-[9px] uppercase tracking-wider text-zinc-500">Niveau</p>
          <p className="text-[11px] font-bold text-zinc-200">{level.number}</p>
        </div>
        <div className="rounded-lg bg-white/5 px-1 py-1.5">
          <p className="text-[9px] uppercase tracking-wider text-zinc-500">Objectif</p>
          <p className="text-[11px] font-bold text-zinc-200">{snap?.progress ?? "—"}</p>
        </div>
        <div className="rounded-lg bg-white/5 px-1 py-1.5">
          <p className="text-[9px] uppercase tracking-wider text-zinc-500">Images/s</p>
          <p className="text-[11px] font-bold tabular-nums text-zinc-200">
            {snap ? `${snap.fps} · ×${snap.pixelRatio.toFixed(2)}` : "—"}
          </p>
        </div>
      </div>

      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Carte en direct — clique pour t&apos;y téléporter
        </p>
        <div
          onClick={onMapClick}
          className="relative w-full cursor-crosshair overflow-hidden rounded-lg ring-1 ring-white/10"
          style={{ aspectRatio: `${width} / ${height}` }}
        >
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ imageRendering: "pixelated" }} />
          <svg viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 h-full w-full">
            {snap?.pickups.map((p, i) => (
              <circle key={`p${i}`} cx={p.x} cy={p.z} r={p.kind === "fusible" ? 0.9 : 0.55} fill={PICKUP_COLORS[p.kind] ?? "#fff"} />
            ))}
            {snap?.valves.map((v, i) => (
              <rect key={`v${i}`} x={v.x - 0.8} y={v.z - 0.8} width={1.6} height={1.6} fill={v.done ? "#22c55e" : "#dc2626"} />
            ))}
            {snap && (
              <rect x={snap.exit.x - 1} y={snap.exit.z - 1} width={2} height={2} fill="#4ade80" stroke="#000" strokeWidth={0.3} />
            )}
            {snap?.entity?.active && (
              <circle cx={snap.entity.x} cy={snap.entity.z} r={1.3} fill="#ef4444">
                <animate attributeName="r" values="1;1.8;1" dur="1s" repeatCount="indefinite" />
              </circle>
            )}
            {snap && (
              <g transform={`translate(${snap.player.x} ${snap.player.z}) rotate(${(-snap.player.yaw * 180) / Math.PI})`}>
                <polygon points="0,-1.6 1.1,1.1 0,0.4 -1.1,1.1" fill="#ffffff" stroke="#000" strokeWidth={0.2} />
              </g>
            )}
          </svg>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-zinc-400">
          <span><span className="text-white">▲</span> toi</span>
          <span><span className="text-red-400">●</span> entité</span>
          <span><span className="text-green-400">■</span> sortie</span>
          <span><span className="text-sky-300">●</span> eau</span>
          <span><span className="text-yellow-400">●</span> pile</span>
          <span><span className="text-orange-500">●</span> fusible</span>
          <span><span className="text-red-600">■</span> vanne</span>
        </div>
        {snap && (
          <p className="mt-1.5 text-[11px] text-zinc-400">
            Entité :{" "}
            <span className="font-semibold text-red-300">
              {snap.entity ? (snap.entity.active ? STATE_NAMES[snap.entity.state] ?? snap.entity.state : "Absente") : "Aucune"}
            </span>
            {" · "}Lucidité {snap.sanity}% · Pile {snap.battery}%
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {TOGGLES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onFlags({ ...flags, [t.key]: !flags[t.key] })}
            aria-pressed={flags[t.key]}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-left transition ${
              flags[t.key] ? "bg-amber-500/20 ring-1 ring-amber-400/60" : "bg-white/5 hover:bg-white/10"
            }`}
          >
            <span>
              <span className="block text-xs font-bold text-zinc-100">{t.label}</span>
              <span className="block text-[10px] text-zinc-500">{t.hint}</span>
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                flags[t.key] ? "bg-amber-400 text-black" : "bg-zinc-800 text-zinc-500"
              }`}
            >
              {flags[t.key] ? "On" : "Off"}
            </span>
          </button>
        ))}
      </div>

      {flags.fly && snap && (
        <p className="text-center text-[11px] text-zinc-400">
          Altitude : {snap.flyHeight.toFixed(1)} m · monte au-dessus du plafond pour voir tout le niveau
        </p>
      )}

      <button
        type="button"
        onClick={onAdvance}
        className="rounded-lg bg-amber-500 px-3 py-2.5 text-sm font-black text-black transition hover:bg-amber-400"
      >
        ⏭ {advanceLabel}
      </button>

      <p className="text-[10px] leading-relaxed text-zinc-600">
        Visible uniquement par les comptes admin, et seulement en solo. Rien n&apos;est enregistré.
      </p>
    </div>
  );
}
