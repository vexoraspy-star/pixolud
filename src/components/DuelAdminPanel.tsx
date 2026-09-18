"use client";

import { CHEAT_LIST, type DuelCheats } from "@/lib/duelCheats";

/**
 * Panneau du mode admin (touche F2) : les triches du jeu de tir, groupees,
 * et quelques actions ponctuelles. Reserve aux comptes admin.
 */
export default function DuelAdminPanel({
  cheats,
  onChange,
  onAction,
  onClose,
  island,
}: {
  cheats: DuelCheats;
  onChange: (next: DuelCheats) => void;
  onAction: (action: "tuer" | "soigner" | "zone" | "armes") => void;
  onClose: () => void;
  /** Battle royale : on peut se teleporter en cliquant sur la carte (M). */
  island: boolean;
}) {
  const groups = ["Visée", "Vision", "Survie", "Mouvement", "Partie"] as const;
  return (
    <div className="w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border border-fuchsia-400/40 bg-zinc-950/95 p-3 text-white shadow-2xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-black uppercase tracking-wider text-fuchsia-300">🛠 Mode admin</p>
        <button type="button" onClick={onClose} className="rounded px-2 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Fermer">
          ✕
        </button>
      </div>
      <p className="mb-2 text-[11px] leading-snug text-zinc-400">
        F2 pour ouvrir ou fermer. Une partie où une triche a servi ne rapporte ni pièces ni expérience.
      </p>
      <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
        {groups.map((g) => (
          <div key={g}>
            <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">{g}</p>
            <div className="grid grid-cols-2 gap-1">
              {CHEAT_LIST.filter((c) => c.group === g).map((c) => {
                const on = cheats[c.id];
                return (
                  <button
                    key={c.id}
                    type="button"
                    title={c.hint}
                    aria-pressed={on}
                    onClick={() => onChange({ ...cheats, [c.id]: !on })}
                    className={`rounded-md px-2 py-1.5 text-left text-xs font-bold ring-1 transition ${
                      on ? "bg-fuchsia-500/30 text-fuchsia-100 ring-fuchsia-400" : "bg-white/5 text-zinc-300 ring-white/10 hover:bg-white/10"
                    }`}
                  >
                    {on ? "● " : "○ "}
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <button type="button" onClick={() => onAction("tuer")} className="rounded-md bg-red-600/80 px-2 py-1.5 text-xs font-black uppercase hover:bg-red-500">
          Éliminer les bots
        </button>
        <button type="button" onClick={() => onAction("soigner")} className="rounded-md bg-emerald-600/80 px-2 py-1.5 text-xs font-black uppercase hover:bg-emerald-500">
          Vie pleine
        </button>
        <button type="button" onClick={() => onAction("armes")} className="rounded-md bg-sky-600/80 px-2 py-1.5 text-xs font-black uppercase hover:bg-sky-500">
          Meilleures armes
        </button>
        {island && (
          <button type="button" onClick={() => onAction("zone")} className="rounded-md bg-cyan-700/80 px-2 py-1.5 text-xs font-black uppercase hover:bg-cyan-600">
            Au centre de la zone
          </button>
        )}
      </div>
      {island && <p className="mt-2 text-[11px] text-zinc-400">Carte (M) : clique pour te téléporter.</p>}
    </div>
  );
}
