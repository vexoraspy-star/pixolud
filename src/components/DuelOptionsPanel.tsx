"use client";

import DuelCrosshair from "./DuelCrosshair";
import {
  BOT_LEVELS,
  BOT_ORDER,
  CROSSHAIR_COLORS,
  CROSSHAIR_STYLES,
  type CrosshairColorId,
  type DuelOptions,
} from "@/lib/duelOptions";

/**
 * Le panneau de reglages du Duel : reticule, affichage, laser, bots.
 * Il sert deux fois — dans le menu avant la partie, et en surimpression
 * pendant une partie — donc il ne fait que lire `options` et rappeler
 * `onChange`. Rien n'est stocke ici.
 */
export default function DuelOptionsPanel({
  options,
  onChange,
  onClose,
  showBots = true,
}: {
  options: DuelOptions;
  onChange: (next: DuelOptions) => void;
  onClose?: () => void;
  /** Masque la difficulte quand elle ne s'applique pas (partie en ligne). */
  showBots?: boolean;
}) {
  const set = <K extends keyof DuelOptions>(key: K, value: DuelOptions[K]) =>
    onChange({ ...options, [key]: value });

  return (
    <div className="w-full max-w-md rounded-xl border border-white/12 bg-zinc-950/95 p-4 text-white shadow-2xl backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-black uppercase tracking-widest text-cyan-300">Réglages du tir</p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold text-zinc-300 transition hover:bg-white/20"
          >
            Fermer
          </button>
        )}
      </div>

      {/* --- Réticule --- */}
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Réticule</p>
      <div className="mb-3 flex gap-3">
        <div className="relative size-24 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-[linear-gradient(135deg,#3a4652_0%,#8d9aa6_50%,#2c343c_100%)]">
          <DuelCrosshair options={options} spread={0} hit={0} />
        </div>
        <div className="flex flex-1 flex-wrap content-start gap-1.5">
          {CROSSHAIR_STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => set("crosshair", s.id)}
              className={`rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                options.crosshair === s.id ? "bg-cyan-500 text-black" : "bg-white/8 text-zinc-300 hover:bg-white/15"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {(Object.keys(CROSSHAIR_COLORS) as CrosshairColorId[]).map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            onClick={() => set("color", c)}
            className={`size-6 rounded-full border-2 transition ${
              options.color === c ? "border-white" : "border-transparent hover:border-white/40"
            }`}
            style={{ background: CROSSHAIR_COLORS[c] }}
          />
        ))}
      </div>

      {(
        [
          ["size", "Longueur", 0, 20],
          ["gap", "Écart", 0, 20],
          ["thickness", "Épaisseur", 1, 5],
        ] as const
      ).map(([key, label, min, max]) => (
        <div key={key} className="mb-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">{label}</span>
            <span className="font-mono text-[11px] text-zinc-500">{options[key]}</span>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={1}
            value={options[key]}
            onChange={(e) => set(key, Number(e.target.value))}
            className="w-full accent-cyan-400"
          />
        </div>
      ))}

      <div className="mb-4 grid grid-cols-2 gap-2">
        <Toggle label="Ouverture dynamique" value={options.dynamic} onChange={(v) => set("dynamic", v)} />
        <Toggle label="Contour noir" value={options.outline} onChange={(v) => set("outline", v)} />
      </div>

      {/* --- Affichage --- */}
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Affichage</p>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <Toggle label="Images/seconde" value={options.showFps} onChange={(v) => set("showFps", v)} />
        <Toggle label="Ping (en ligne)" value={options.showPing} onChange={(v) => set("showPing", v)} />
      </div>

      {/* --- Laser --- */}
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Viseur laser</p>
      <Toggle label="Rayon rouge depuis le canon" value={options.laser} onChange={(v) => set("laser", v)} />
      <p className="mb-4 mt-1 text-[10px] leading-relaxed text-zinc-500">
        Le point rouge se pose sur ce que tu vises, même en courant. Toi seul le vois.
      </p>

      {/* --- Bots --- */}
      {showBots && (
        <>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Difficulté des bots
          </p>
          <div className="grid grid-cols-2 gap-2">
            {BOT_ORDER.map((id) => {
              const lvl = BOT_LEVELS[id];
              const on = options.bots === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => set("bots", id)}
                  className={`rounded-lg border p-2 text-left transition ${
                    on ? "border-cyan-400 bg-cyan-500/15" : "border-white/10 bg-white/5 hover:border-white/30"
                  }`}
                >
                  <span className={`block text-xs font-bold ${on ? "text-cyan-200" : "text-zinc-200"}`}>
                    {lvl.label}
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-zinc-400">{lvl.tagline}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${
        value ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-100" : "border-white/10 bg-white/5 text-zinc-400"
      }`}
    >
      <span className="text-left leading-tight">{label}</span>
      <span className={`size-2.5 shrink-0 rounded-full ${value ? "bg-cyan-400" : "bg-zinc-600"}`} />
    </button>
  );
}
