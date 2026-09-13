"use client";

import type { ManorRoom } from "@/lib/manor";
import { ALTAR, HATCH, STAIR_ROW_FIRST, STAIR_ROW_LAST, STAIR_X0, STAIR_X1 } from "@/lib/manor";

/**
 * Panneau du mode developpeur du Manoir Maudit.
 *
 * Reserve aux comptes admin : c'est la page serveur qui decide, en lisant
 * `profiles.is_admin`. Ce panneau n'est jamais monte pour un joueur normal.
 *
 * A savoir : le Manoir est un jeu solo qui tourne entierement dans le
 * navigateur. Quelqu'un qui modifierait le code de sa page pourrait rouvrir
 * ces outils chez lui — mais il ne tricherait que dans sa propre partie,
 * sans effet sur personne d'autre ni sur la base.
 */

export interface DevFlags {
  /** Camera libre en hauteur, sans collision. Espace monte, C descend. */
  fly: boolean;
  /** Traverser les murs, au niveau du sol. */
  noclip: boolean;
  /** La chose ne peut pas t'attraper. */
  god: boolean;
  /** La chose ne bouge plus. */
  freeze: boolean;
  /** Deplacement x3. */
  fast: boolean;
}

export const DEV_OFF: DevFlags = {
  fly: false,
  noclip: false,
  god: false,
  freeze: false,
  fast: false,
};

export type DevPhase = "none" | "ritual" | "seals" | "survive" | "escape";

/** Instantane de la partie, pour la carte en direct. */
export interface DevSnapshot {
  player: { x: number; z: number; yaw: number };
  monster: { x: number; z: number; active: boolean };
  relics: { x: number; z: number }[];
  dolls: { x: number; z: number }[];
  plaques: { x: number; z: number; digit: number; rank: number; found: boolean }[];
  seals: { x: number; z: number; broken: boolean }[];
  /** Objets encore au sol : pieces, piles, sel, boites, cles, notes. */
  pickups: { x: number; z: number; kind: string }[];
  keyDoors: { x0: number; y0: number; x1: number; y1: number; open: boolean }[];
  /** Ce que fait la chose : errer, enqueter, poursuivre, fouiller, debusquer. */
  monsterState: string;
  phase: DevPhase;
  code: string;
  doorLocked: boolean;
  flyHeight: number;
  fps: number;
  pixelRatio: number;
}

const TOGGLES: { key: keyof DevFlags; label: string; hint: string }[] = [
  { key: "fly", label: "🕊️ Vol", hint: "Espace monte · C descend" },
  { key: "noclip", label: "👻 Traverser les murs", hint: "Au niveau du sol" },
  { key: "god", label: "🛡️ Invincible", hint: "Elle ne peut plus t'attraper" },
  { key: "freeze", label: "❄️ Figer la chose", hint: "Elle ne bouge plus" },
  { key: "fast", label: "⚡ Vitesse ×3", hint: "Aussi pour le vol" },
];

/** Ce que fait « Étape suivante » selon l'avancement. */
function nextStepLabel(snap: DevSnapshot | null): string {
  if (!snap) return "Étape suivante";
  if (snap.plaques.some((p) => !p.found)) return "Relever toutes les plaques";
  if (snap.doorLocked) return "Ouvrir la cave";
  if (snap.relics.length > 0) return "Prendre les 5 reliques";
  if (snap.phase === "none") return "Lancer le rituel";
  if (snap.phase === "ritual") return "Rituel en cours…";
  if (snap.phase === "seals") return "Briser les 3 sceaux";
  if (snap.phase === "survive") return "Finir les 45 secondes";
  return "Aller à la trappe";
}

const PICKUP_COLORS: Record<string, string> = {
  coin: "#eab308",
  battery: "#4ade80",
  salt: "#f5f5f4",
  musicbox: "#c2410c",
  key: "#fde047",
  note: "#d6d3d1",
};

const MONSTER_STATES: Record<string, string> = {
  endormie: "Endormie",
  errer: "Erre",
  enqueter: "Enquête sur un bruit",
  poursuivre: "Te poursuit",
  fouiller: "Fouille",
  debusquer: "Vient te sortir de ta cachette",
};

const PHASE_NAMES: Record<DevPhase, string> = {
  none: "Exploration",
  ritual: "Rituel",
  seals: "Sceaux",
  survive: "Survie 45 s",
  escape: "Fuite",
};

export default function HorrorDevPanel({
  flags,
  onFlags,
  snap,
  rooms,
  width,
  height,
  onTeleport,
  onAdvance,
  onGiveAll,
  onClose,
}: {
  flags: DevFlags;
  onFlags: (next: DevFlags) => void;
  snap: DevSnapshot | null;
  rooms: ManorRoom[];
  width: number;
  height: number;
  onTeleport: (x: number, z: number) => void;
  onAdvance: () => void;
  onGiveAll: () => void;
  onClose: () => void;
}) {
  function onMapClick(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * width;
    const z = ((e.clientY - r.top) / r.height) * height;
    onTeleport(x, z);
  }

  const stepDisabled = snap?.phase === "ritual";

  return (
    <div
      // La souris ne doit pas traverser le panneau jusqu'au canvas, sinon
      // chaque clic sur un bouton recapture le pointeur et fait tourner la vue.
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute bottom-0 left-0 top-0 z-40 flex w-[22rem] max-w-[92vw] flex-col gap-3 overflow-y-auto border-r border-amber-500/30 bg-zinc-950/92 p-3 text-white shadow-2xl backdrop-blur"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wider text-amber-300">
            🛠️ Mode développeur
          </p>
          <p className="text-[10px] text-zinc-500">
            F2 pour fermer · Échap pour libérer la souris
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-white/5 px-2.5 py-1 text-xs font-semibold text-zinc-300 hover:bg-white/10"
        >
          ✕
        </button>
      </div>

      {/* Etat de la partie */}
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-lg bg-white/5 px-1 py-1.5">
          <p className="text-[9px] uppercase tracking-wider text-zinc-500">Étape</p>
          <p className="text-[11px] font-bold text-zinc-200">
            {snap ? PHASE_NAMES[snap.phase] : "—"}
          </p>
        </div>
        <div className="rounded-lg bg-white/5 px-1 py-1.5">
          <p className="text-[9px] uppercase tracking-wider text-zinc-500">Code</p>
          <p className="font-mono text-sm font-black tracking-widest text-amber-300">
            {snap?.code ?? "—"}
          </p>
        </div>
        <div className="rounded-lg bg-white/5 px-1 py-1.5">
          <p className="text-[9px] uppercase tracking-wider text-zinc-500">Images/s</p>
          <p className="text-[11px] font-bold text-zinc-200">
            {snap ? `${snap.fps} · ×${snap.pixelRatio.toFixed(2)}` : "—"}
          </p>
        </div>
      </div>

      {/* Carte en direct : cliquer y teleporte */}
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Carte en direct — clique pour t&apos;y téléporter
        </p>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          onClick={onMapClick}
          className="w-full cursor-crosshair rounded-lg bg-black ring-1 ring-white/10"
        >
          <rect x={0} y={0} width={width} height={height} fill="#070608" />
          {rooms.map((r) => (
            <g key={r.name}>
              <rect
                x={r.x0}
                y={r.y0}
                width={r.x1 - r.x0 + 1}
                height={r.y1 - r.y0 + 1}
                fill={r.name === "Cave" ? "#2a1212" : r.floor === 1 ? "#14161f" : "#17151a"}
                stroke="#3b3742"
                strokeWidth={0.12}
              />
              <text
                x={r.x0 + (r.x1 - r.x0 + 1) / 2}
                y={r.y0 + 0.9}
                textAnchor="middle"
                fill="#6b6573"
                style={{ fontSize: 0.62 }}
                {...(r.name.length * 0.34 > r.x1 - r.x0 + 0.6
                  ? { textLength: r.x1 - r.x0 + 0.4, lengthAdjust: "spacingAndGlyphs" as const }
                  : {})}
              >
                {r.name}
              </text>
            </g>
          ))}
          {/* Escalier */}
          <rect
            x={STAIR_X0}
            y={STAIR_ROW_FIRST}
            width={STAIR_X1 - STAIR_X0 + 1}
            height={STAIR_ROW_LAST - STAIR_ROW_FIRST + 1}
            fill="#1d1a14"
            stroke="#4a4232"
            strokeWidth={0.12}
          />
          {/* Autel et trappe */}
          <rect
            x={ALTAR.x0}
            y={ALTAR.y0}
            width={ALTAR.x1 - ALTAR.x0 + 1}
            height={ALTAR.y1 - ALTAR.y0 + 1}
            fill="#5b5550"
          />
          <rect
            x={HATCH.x + 0.15}
            y={HATCH.y + 0.15}
            width={0.7}
            height={0.7}
            fill="#38bdf8"
            opacity={snap && snap.phase !== "none" ? 1 : 0.35}
          />

          {snap?.keyDoors.map((d, i) => (
            <rect
              key={`k${i}`}
              x={d.x0}
              y={d.y0}
              width={d.x1 - d.x0 + 1}
              height={d.y1 - d.y0 + 1}
              fill={d.open ? "#166534" : "#991b1b"}
            />
          ))}
          {snap?.pickups.map((p, i) => (
            <circle
              key={`o${i}`}
              cx={p.x}
              cy={p.z}
              r={p.kind === "key" ? 0.42 : 0.24}
              fill={PICKUP_COLORS[p.kind] ?? "#fff"}
              stroke={p.kind === "key" ? "#000" : "none"}
              strokeWidth={0.08}
            />
          ))}
          {snap?.plaques.map((p) => (
            <g key={`p${p.rank}`} opacity={p.found ? 0.4 : 1}>
              <rect x={p.x - 0.42} y={p.z - 0.42} width={0.84} height={0.84} fill="#b45309" rx={0.12} />
              <text x={p.x} y={p.z + 0.28} textAnchor="middle" fill="#fff" style={{ fontSize: 0.72, fontWeight: 800 }}>
                {p.digit}
              </text>
            </g>
          ))}
          {snap?.relics.map((r, i) => (
            <rect
              key={`r${i}`}
              x={r.x - 0.3}
              y={r.z - 0.3}
              width={0.6}
              height={0.6}
              fill="#facc15"
              transform={`rotate(45 ${r.x} ${r.z})`}
            />
          ))}
          {snap?.dolls.map((d, i) => (
            <circle key={`d${i}`} cx={d.x} cy={d.z} r={0.36} fill="#f472b6" stroke="#fff" strokeWidth={0.08} />
          ))}
          {snap?.seals.map((s, i) => (
            <circle
              key={`s${i}`}
              cx={s.x}
              cy={s.z}
              r={0.45}
              fill={s.broken ? "#334155" : "#22d3ee"}
            />
          ))}
          {snap?.monster.active && (
            <circle cx={snap.monster.x} cy={snap.monster.z} r={0.55} fill="#ef4444">
              <animate attributeName="r" values="0.45;0.75;0.45" dur="1s" repeatCount="indefinite" />
            </circle>
          )}
          {snap && (
            <g transform={`translate(${snap.player.x} ${snap.player.z}) rotate(${(-snap.player.yaw * 180) / Math.PI})`}>
              <polygon points="0,-0.75 0.5,0.5 0,0.2 -0.5,0.5" fill="#ffffff" stroke="#000" strokeWidth={0.06} />
            </g>
          )}
        </svg>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-zinc-400">
          <span><span className="text-white">▲</span> toi</span>
          <span><span className="text-red-400">●</span> elle</span>
          <span><span className="text-amber-500">■</span> plaque</span>
          <span><span className="text-yellow-400">◆</span> relique</span>
          <span><span className="text-pink-400">●</span> poupée</span>
          <span><span className="text-cyan-400">●</span> sceau</span>
          <span><span className="text-sky-400">■</span> trappe</span>
          <span><span className="text-yellow-300">●</span> clé</span>
          <span><span className="text-red-700">■</span> porte fermée</span>
          <span><span className="text-green-500">●</span> pile</span>
          <span><span className="text-orange-600">●</span> boîte à musique</span>
        </div>
        {snap && (
          <p className="mt-1.5 text-[11px] text-zinc-400">
            La chose : <span className="font-semibold text-red-300">{MONSTER_STATES[snap.monsterState] ?? snap.monsterState}</span>
          </p>
        )}
      </div>

      {/* Interrupteurs */}
      <div className="flex flex-col gap-1.5">
        {TOGGLES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onFlags({ ...flags, [t.key]: !flags[t.key] })}
            aria-pressed={flags[t.key]}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-left transition ${
              flags[t.key]
                ? "bg-amber-500/20 ring-1 ring-amber-400/60"
                : "bg-white/5 hover:bg-white/10"
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
          Altitude : {snap.flyHeight.toFixed(1)} m · baisse les yeux pour voir la carte à travers
          les plafonds
        </p>
      )}

      <button
        type="button"
        onClick={onAdvance}
        disabled={stepDisabled}
        className="rounded-lg bg-amber-500 px-3 py-2.5 text-sm font-black text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        ⏭️ {nextStepLabel(snap)}
      </button>
      <button
        type="button"
        onClick={onGiveAll}
        className="rounded-lg bg-white/5 px-3 py-2 text-xs font-bold text-amber-200 ring-1 ring-amber-500/30 transition hover:bg-white/10"
      >
        🎒 Toutes les clés, notes et objets
      </button>

      <p className="text-[10px] leading-relaxed text-zinc-600">
        Visible uniquement par les comptes admin. Ces outils ne touchent qu&apos;à ta partie en
        cours : rien n&apos;est enregistré.
      </p>
    </div>
  );
}
