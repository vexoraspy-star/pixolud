"use client";

/**
 * Tableau des scores du Duel (touche Tab maintenue, ou appui sur le score
 * en haut au doigt).
 *
 * 1 contre 1 : deux equipes face a face. Match a mort, course a l'armement,
 * battle royale : chacun pour soi, classe par points. Les points valent
 * 2 par elimination, +1 si elle s'est faite a la tete.
 */

export interface ScoreRow {
  id: number;
  name: string;
  me: boolean;
  kills: number;
  deaths: number;
  /** Eliminations a la tete. */
  heads: number;
  /** Battle royale : encore debout. */
  alive: boolean;
  /** Course a l'armement : arme atteinte (1 = la premiere). */
  level?: number;
}

export function scorePoints(r: ScoreRow): number {
  return r.kills * 2 + r.heads;
}

export default function DuelHudScoreboard({
  rows,
  versus,
  title,
  caption,
  ping,
  online,
  maxLevel,
  battleRoyale = false,
  teamScores,
  rivalLabel,
  onClose,
}: {
  rows: ScoreRow[];
  /** Un contre un : « ton equipe » contre « adversaires ». */
  versus: boolean;
  title: string;
  caption: string;
  /** Aller-retour du lien en ligne, en millisecondes. */
  ping: number | null;
  online: boolean;
  maxLevel?: number;
  battleRoyale?: boolean;
  /** Score des deux camps en 1 contre 1 (manches ou eliminations). */
  teamScores?: [number, number];
  rivalLabel?: string;
  /** Au doigt : toucher le tableau le referme. */
  onClose?: () => void;
}) {
  const sorted = [...rows].sort((a, b) => {
    if (battleRoyale && a.alive !== b.alive) return a.alive ? -1 : 1;
    if (maxLevel && (b.level ?? 0) !== (a.level ?? 0)) return (b.level ?? 0) - (a.level ?? 0);
    return scorePoints(b) - scorePoints(a) || a.deaths - b.deaths;
  });
  // Trente combattants en battle royale : les douze premiers, et soi.
  const shown = battleRoyale && sorted.length > 12 ? sorted.filter((r, i) => i < 12 || r.me) : sorted;
  const mine = shown.filter((r) => r.me);
  const others = shown.filter((r) => !r.me);

  const body = (
    <div className="w-[min(94vw,46rem)] overflow-hidden rounded-[4px] bg-zinc-950/88 text-zinc-100 shadow-[0_8px_40px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
      <div className="flex items-baseline justify-between gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-2.5">
        <p className="font-sans text-sm font-bold uppercase tracking-[0.22em] text-white">{title}</p>
        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{caption}</p>
      </div>
      <div className="max-h-[60dvh] overflow-y-auto px-2 pb-2 sm:px-3">
        {versus ? (
          <>
            <TeamBlock tone="mine" label="Ton équipe" score={teamScores?.[0]} rows={mine} ping={ping} online={online} maxLevel={maxLevel} />
            <TeamBlock
              tone="rival"
              label={rivalLabel ?? "Adversaires"}
              score={teamScores?.[1]}
              rows={others}
              ping={ping}
              online={online}
              maxLevel={maxLevel}
            />
          </>
        ) : (
          <TeamBlock
            tone="neutral"
            label={battleRoyale ? `Survivants : ${rows.filter((r) => r.alive).length}` : "Chacun pour soi"}
            rows={shown}
            ping={ping}
            online={online}
            maxLevel={maxLevel}
            battleRoyale={battleRoyale}
          />
        )}
      </div>
      <p className="border-t border-white/10 px-4 py-1.5 text-[10px] text-zinc-500">
        Points : 2 par élimination, +1 à la tête.{onClose ? " Touche le tableau pour le fermer." : " Relâche Tab pour fermer."}
      </p>
    </div>
  );

  if (onClose) {
    return (
      <div className="absolute inset-x-0 top-16 z-40 flex justify-center px-2" onClick={onClose}>
        {body}
      </div>
    );
  }
  return <div className="pointer-events-none absolute inset-x-0 top-16 z-40 flex justify-center px-2">{body}</div>;
}

function TeamBlock({
  tone,
  label,
  score,
  rows,
  ping,
  online,
  maxLevel,
  battleRoyale = false,
}: {
  tone: "mine" | "rival" | "neutral";
  label: string;
  score?: number;
  rows: ScoreRow[];
  ping: number | null;
  online: boolean;
  maxLevel?: number;
  battleRoyale?: boolean;
}) {
  const head =
    tone === "mine"
      ? "from-sky-500/30 text-sky-200"
      : tone === "rival"
        ? "from-red-500/30 text-red-200"
        : "from-white/10 text-zinc-200";
  const cols = `grid ${online ? "grid-cols-[minmax(0,1fr)_repeat(5,2.9rem)]" : "grid-cols-[minmax(0,1fr)_repeat(4,2.9rem)]"} items-center gap-x-1 sm:gap-x-2`;
  return (
    <div className="mt-2">
      <div className={`flex items-center justify-between rounded-t-[3px] bg-gradient-to-r to-transparent px-2 py-1.5 ${head}`}>
        <span className="text-[11px] font-bold uppercase tracking-[0.2em]">{label}</span>
        {score !== undefined && <span className="font-sans text-lg font-bold tabular-nums text-white">{score}</span>}
      </div>
      <div className={`${cols} px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500`}>
        <span>Joueur</span>
        <span className="text-right">{maxLevel ? "Arme" : "Élim."}</span>
        <span className="text-right">Morts</span>
        <span className="text-right">Têtes</span>
        <span className="text-right">Points</span>
        {online && <span className="text-right">Ping</span>}
      </div>
      {rows.map((r) => (
        <div
          key={r.id}
          className={`${cols} rounded-[2px] px-2 py-[5px] text-[13px] ${
            r.me ? "bg-white/[0.12] font-bold text-white" : "odd:bg-white/[0.03] text-zinc-200"
          } ${battleRoyale && !r.alive ? "opacity-45" : ""}`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              className={`size-1.5 shrink-0 rounded-full ${
                battleRoyale ? (r.alive ? "bg-emerald-400" : "bg-zinc-600") : r.me ? "bg-sky-400" : "bg-amber-400"
              }`}
            />
            <span className="truncate">{r.name}</span>
          </span>
          <span className="text-right font-sans tabular-nums">{maxLevel ? `${r.level ?? 1}/${maxLevel}` : r.kills}</span>
          <span className="text-right font-sans tabular-nums text-zinc-300">{r.deaths}</span>
          <span className="text-right font-sans tabular-nums text-zinc-300">{r.heads}</span>
          <span className="text-right font-sans font-bold tabular-nums">{scorePoints(r)}</span>
          {online && (
            <span
              className={`text-right font-sans tabular-nums ${
                ping === null ? "text-zinc-500" : ping < 80 ? "text-emerald-300" : ping < 160 ? "text-amber-300" : "text-red-400"
              }`}
            >
              {ping === null ? "—" : ping}
            </span>
          )}
        </div>
      ))}
      {rows.length === 0 && <p className="px-2 py-1.5 text-xs text-zinc-500">Personne.</p>}
    </div>
  );
}
