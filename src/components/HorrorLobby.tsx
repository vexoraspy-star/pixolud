"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { buildManor, CODE_LENGTH, type ManorRoom } from "@/lib/manor";
import {
  BRIGHTNESS_MAX,
  BRIGHTNESS_MIN,
  SENSITIVITY_MAX,
  SENSITIVITY_MIN,
  loadBrightness3D,
  loadLayout3D,
  loadSensitivity3D,
  saveBrightness3D,
  saveLayout3D,
  saveSensitivity3D,
  type Layout3D,
} from "@/lib/settings3d";

export type HorrorMode = "histoire" | "rapide";

type Tab = "jouer" | "carte" | "skins" | "amis" | "parametres";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "jouer", label: "Jouer", icon: "▶" },
  { id: "carte", label: "Carte", icon: "🗺" },
  { id: "skins", label: "Apparences", icon: "🎭" },
  { id: "amis", label: "Amis", icon: "👥" },
  { id: "parametres", label: "Paramètres", icon: "⚙" },
];

const SKINS: { name: string; emoji: string; hint: string }[] = [
  { name: "L'Égaré", emoji: "🧍", hint: "Tenue par défaut" },
  { name: "Le Fossoyeur", emoji: "⛏️", hint: "Verrouillé" },
  { name: "La Gouvernante", emoji: "🕯️", hint: "Verrouillé" },
  { name: "Le Chasseur", emoji: "🏹", hint: "Verrouillé" },
  { name: "L'Exorciste", emoji: "✝️", hint: "Verrouillé" },
  { name: "L'Ombre", emoji: "👤", hint: "Verrouillé" },
];

function ManorArt() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-b from-[#05050a] via-[#0b0810] to-[#160d0d]">
      <div
        className="absolute right-10 top-6 h-10 w-10 rounded-full bg-zinc-200/90"
        style={{ boxShadow: "0 0 36px 12px rgba(220,220,255,0.22)" }}
      />
      <div className="absolute inset-x-0 bottom-0 flex justify-center">
        <div className="relative h-32 w-64">
          <div className="absolute inset-x-0 bottom-0 h-32 bg-black" />
          <div
            className="absolute -top-11 left-1/2 h-11 w-52 -translate-x-1/2 bg-black"
            style={{ clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }}
          />
          <div className="absolute -top-20 left-4 h-28 w-10 bg-black">
            <div
              className="absolute -top-7 left-1/2 h-7 w-10 -translate-x-1/2 bg-black"
              style={{ clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }}
            />
          </div>
          <div
            className="absolute left-10 top-10 h-5 w-3.5 bg-amber-300/70"
            style={{ animation: "horror-flicker 3.4s ease-in-out infinite" }}
          />
          <div className="absolute right-12 top-10 h-5 w-3.5 bg-amber-200/25" />
          <div
            className="absolute left-1/2 top-16 h-8 w-6 -translate-x-1/2 bg-amber-500/30"
            style={{ animation: "horror-flicker 5s ease-in-out infinite" }}
          />
        </div>
      </div>
      <div
        className="absolute inset-x-[-10%] bottom-0 h-16 bg-white/5 blur-lg"
        style={{ animation: "horror-fog-drift 11s ease-in-out infinite" }}
      />
    </div>
  );
}

function LockedBadge({ children = "Bientôt disponible" }: { children?: string }) {
  return (
    <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-300 ring-1 ring-amber-500/30">
      🔒 {children}
    </span>
  );
}

/** Plan d'un etage, dessine directement a partir des donnees du manoir. */
function FloorPlan({ rooms, label }: { rooms: ManorRoom[]; label: string }) {
  const minX = Math.min(...rooms.map((r) => r.x0)) - 1;
  const maxX = Math.max(...rooms.map((r) => r.x1)) + 2;
  const minY = Math.min(...rooms.map((r) => r.y0)) - 1;
  const maxY = Math.max(...rooms.map((r) => r.y1)) + 2;
  const w = maxX - minX;
  const h = maxY - minY;

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">{label}</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full rounded-xl bg-black/40 ring-1 ring-white/10">
        <rect x={0} y={0} width={w} height={h} fill="#0b0a0c" />
        {rooms.map((r) => {
          const special =
            r.name === "Entrée" ? "#3f2d13" : r.name === "Cave" ? "#3c1616" : "#1c1a20";
          const stroke =
            r.name === "Entrée" ? "#c9a24a" : r.name === "Cave" ? "#c05353" : "#3b3742";
          return (
            <g key={r.name}>
              <rect
                x={r.x0 - minX}
                y={r.y0 - minY}
                width={r.x1 - r.x0 + 1}
                height={r.y1 - r.y0 + 1}
                fill={special}
                stroke={stroke}
                strokeWidth={0.18}
                rx={0.3}
              />
              <text
                x={r.x0 - minX + (r.x1 - r.x0 + 1) / 2}
                y={r.y0 - minY + (r.y1 - r.y0 + 1) / 2 + 0.35}
                textAnchor="middle"
                fill="#cfc9d6"
                style={{ fontSize: 0.92, fontWeight: 600 }}
              >
                {r.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function HorrorLobby({
  title,
  onPlay,
}: {
  title: string;
  onPlay: (mode: HorrorMode) => void;
}) {
  const [tab, setTab] = useState<Tab>("jouer");
  const [layout, setLayout] = useState<Layout3D>("azerty");
  const [brightness, setBrightness] = useState(1);
  const [sensitivity, setSensitivity] = useState(1.5);

  const rooms = useMemo(() => buildManor().rooms, []);
  const ground = rooms.filter((r) => r.floor === 0);
  const upstairs = rooms.filter((r) => r.floor === 1);

  useEffect(() => {
    const t = setTimeout(() => {
      setLayout(loadLayout3D());
      setBrightness(loadBrightness3D());
      setSensitivity(loadSensitivity3D());
    }, 0);
    return () => clearTimeout(t);
  }, []);

  function changeLayout(next: Layout3D) {
    setLayout(next);
    saveLayout3D(next);
  }
  function changeBrightness(next: number) {
    setBrightness(next);
    saveBrightness3D(next);
  }
  function changeSensitivity(next: number) {
    setSensitivity(next);
    saveSensitivity3D(next);
  }

  return (
    <div className="flex h-full w-full flex-col bg-gradient-to-br from-[#0b0509] via-[#0d0a12] to-[#050406] text-white">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/mode-3d" className="text-sm text-zinc-400 transition hover:text-violet-300">
            ← Mode 3D
          </Link>
          <span className="hidden text-xs uppercase tracking-[0.2em] text-zinc-600 sm:inline">
            Pixolud
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-white/5 py-1 pl-1 pr-3 ring-1 ring-white/10">
          <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 text-sm">
            🎮
          </span>
          <span className="text-xs font-semibold text-zinc-300">Joueur</span>
        </div>
      </header>

      <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 px-3 py-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
              tab === t.id
                ? "bg-white/10 text-white ring-1 ring-white/20"
                : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
            }`}
          >
            <span className="text-xs">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "jouer" && (
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            <div className="relative h-52 overflow-hidden rounded-2xl ring-1 ring-white/10">
              <div className="absolute inset-0">
                <ManorArt />
              </div>
              <div className="relative flex h-full flex-col justify-end gap-2 bg-gradient-to-t from-black/85 via-black/30 to-transparent p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-red-900/70 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-red-200">
                    Horreur
                  </span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-zinc-300">
                    Solo
                  </span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-zinc-300">
                    {rooms.length} pièces · 2 étages
                  </span>
                </div>
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
                <p className="max-w-lg text-sm text-zinc-400">
                  Relève les {CODE_LENGTH} chiffres du code, ouvre la cave, rassemble 5 reliques et
                  accomplis le rituel. Puis brise trois sceaux, tiens 45 secondes, et fuis.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onPlay("histoire")}
                className="group rounded-xl bg-gradient-to-r from-red-800 to-red-700 p-4 text-left transition hover:from-red-700 hover:to-red-600 active:scale-[0.99]"
              >
                <p className="text-lg font-black uppercase tracking-wide">Histoire</p>
                <p className="mt-1 text-xs text-red-100/80">
                  Cinématique d&apos;introduction en 3D, puis la partie complète.
                </p>
              </button>
              <button
                type="button"
                onClick={() => onPlay("rapide")}
                className="rounded-xl border border-white/15 bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.09] active:scale-[0.99]"
              >
                <p className="text-lg font-black uppercase tracking-wide">Partie rapide</p>
                <p className="mt-1 text-xs text-zinc-400">
                  Directement dans le manoir, sans la cinématique.
                </p>
              </button>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 opacity-60">
                <div className="flex items-center gap-2">
                  <p className="text-lg font-black uppercase tracking-wide text-zinc-400">
                    Multijoueur
                  </p>
                  <LockedBadge>Bientôt</LockedBadge>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  Explorer le manoir à plusieurs avec un code de salon.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTab("carte")}
                className="rounded-xl border border-white/15 bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.09]"
              >
                <p className="text-lg font-black uppercase tracking-wide">Carte</p>
                <p className="mt-1 text-xs text-zinc-400">
                  Le plan des deux étages, à étudier avant d&apos;entrer.
                </p>
              </button>
            </div>
          </div>
        )}

        {tab === "carte" && (
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-1 text-lg font-bold">Plan du manoir</h2>
            <p className="mb-4 text-sm text-zinc-500">
              L&apos;escalier de l&apos;Entrée monte au Palier. La cave est verrouillée par un code
              à {CODE_LENGTH} chiffres, gravé sur autant de plaques réparties dans le manoir — dont
              une à l&apos;étage.
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              <FloorPlan rooms={ground} label="Rez-de-chaussée" />
              <FloorPlan rooms={upstairs} label="Étage" />
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-zinc-500">
              <span>
                <span className="mr-1.5 inline-block size-3 rounded-sm bg-[#3f2d13] ring-1 ring-[#c9a24a]" />
                Départ
              </span>
              <span>
                <span className="mr-1.5 inline-block size-3 rounded-sm bg-[#3c1616] ring-1 ring-[#c05353]" />
                Sortie (verrouillée)
              </span>
            </div>
          </div>
        )}

        {tab === "skins" && (
          <div className="mx-auto max-w-3xl">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-bold">Apparences</h2>
              <LockedBadge />
            </div>
            <p className="mb-4 text-sm text-zinc-500">
              Les apparences ne sont pas encore jouables : elles n&apos;ont pour l&apos;instant aucun
              effet dans la partie. Elles arriveront dans une prochaine mise à jour.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {SKINS.map((skin, i) => (
                <div
                  key={skin.name}
                  className={`relative flex flex-col items-center gap-2 rounded-xl border p-4 ${
                    i === 0
                      ? "border-violet-500/40 bg-violet-500/5"
                      : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  <span className={`text-3xl ${i === 0 ? "" : "opacity-30 grayscale"}`}>
                    {skin.emoji}
                  </span>
                  <span className="text-center text-sm font-semibold">{skin.name}</span>
                  <span className="text-[11px] text-zinc-500">
                    {i === 0 ? skin.hint : "🔒 " + skin.hint}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "amis" && (
          <div className="mx-auto max-w-2xl">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-bold">Jouer avec des amis</h2>
              <LockedBadge />
            </div>
            <p className="mb-5 text-sm text-zinc-500">
              Le Manoir Maudit est un jeu <strong className="text-zinc-300">solo</strong> pour le
              moment. Le mode à plusieurs avec code de salon est prévu, mais il n&apos;est pas encore
              actif — le code ci-dessous est un aperçu et ne fonctionne pas.
            </p>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 opacity-70">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Code du salon
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-1.5">
                  {"MANOIR".split("").map((c, i) => (
                    <span
                      key={i}
                      className="flex size-9 items-center justify-center rounded-lg bg-black/50 font-mono text-lg font-bold text-zinc-500 ring-1 ring-white/10"
                    >
                      {c}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-500 ring-1 ring-white/10"
                >
                  Copier
                </button>
              </div>
              <button
                type="button"
                disabled
                className="mt-4 w-full cursor-not-allowed rounded-lg bg-white/5 py-2.5 text-sm font-bold text-zinc-500 ring-1 ring-white/10"
              >
                Inviter des amis — bientôt
              </button>
            </div>
          </div>
        )}

        {tab === "parametres" && (
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-1 text-lg font-bold">Paramètres</h2>
            <p className="mb-5 text-sm text-zinc-500">
              Ces réglages s&apos;appliquent à tous les jeux du Mode 3D et sont conservés sur cet
              appareil.
            </p>

            <div className="space-y-5">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="mb-3 text-sm font-semibold">Clavier</p>
                <div className="flex gap-2">
                  {(["azerty", "qwerty"] as Layout3D[]).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => changeLayout(l)}
                      className={`flex-1 rounded-lg py-2.5 text-sm font-bold uppercase transition ${
                        layout === l
                          ? "bg-violet-600 text-white"
                          : "bg-white/5 text-zinc-400 ring-1 ring-white/10 hover:bg-white/10"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  {layout === "azerty" ? "Déplacement : Z Q S D" : "Déplacement : W A S D"}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold">Luminosité</p>
                  <span className="font-mono text-xs text-zinc-400">
                    {Math.round(brightness * 100)} %
                  </span>
                </div>
                <input
                  type="range"
                  min={BRIGHTNESS_MIN}
                  max={BRIGHTNESS_MAX}
                  step={0.05}
                  value={brightness}
                  onChange={(e) => changeBrightness(Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
                <p className="mt-2 text-xs text-zinc-500">
                  Monte-la si le manoir est trop sombre sur ton écran.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold">Sensibilité de la souris</p>
                  <span className="font-mono text-xs text-zinc-400">{sensitivity.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={SENSITIVITY_MIN}
                  max={SENSITIVITY_MAX}
                  step={0.05}
                  value={sensitivity}
                  onChange={(e) => changeSensitivity(Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
