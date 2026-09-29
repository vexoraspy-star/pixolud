"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { WeaponId } from "@/lib/duelWeapons";
import { HudIcon, type HudIconId } from "./DuelHudIcons";

/**
 * L'interface en jeu du Duel, facon jeu de tir tactique : chiffres nets,
 * fonds sombres semi-transparents, silhouettes d'armes au lieu d'emoji.
 *
 * Chaque morceau est un composant sans logique de jeu : DuelScene garde la
 * partie et lui passe des nombres. Aucun flou d'arriere-plan (backdrop-blur)
 * sur les elements toujours affiches : sur une puce graphique integree, il
 * se recalcule a chaque image par-dessus la scene 3D et coute cher.
 */

/** Une ligne du fil des eliminations. */
export interface KillFeedEntry {
  id: number;
  /** Nom du tireur ; null quand personne n'a tire (la zone). */
  killer: string | null;
  victim: string;
  /** Arme, grenade ou zone. */
  icon: HudIconId;
  /** Tir a la tete. */
  head: boolean;
  killerMe: boolean;
  victimMe: boolean;
}

/** Ce que l'ecran de mort affiche sur celui qui nous a eu. */
export interface KilledBy {
  name: string;
  icon: HudIconId | null;
  head: boolean;
}

/** 83 s -> « 1:23 ». */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Couleur d'un nom : le joueur en bleu clair, les autres en ambre. */
function nameTone(me: boolean) {
  return me ? "text-sky-300" : "text-amber-300";
}

// ------------------------------------------------------------ haut, centre
export interface TopBarSide {
  value: string | number;
  label: string;
}

/**
 * Score et minuterie en haut au centre : son score a gauche (bleu), celui
 * de l'adversaire a droite (rouge), le temps au milieu. Au doigt, un appui
 * ouvre le tableau des scores (pas de touche Tab sur un telephone).
 */
export function DuelTopBar({
  left,
  right,
  clock,
  tone = "normal",
  caption,
  onPress,
}: {
  left: TopBarSide;
  right: TopBarSide;
  clock: string;
  /** « buy » : phase d'achat (ambre) ; « urgent » : dernieres secondes (rouge). */
  tone?: "normal" | "buy" | "urgent";
  caption?: string;
  onPress?: () => void;
}) {
  const clockColor = tone === "buy" ? "text-amber-300" : tone === "urgent" ? "text-red-400" : "text-zinc-50";
  const body = (
    <>
      <div className="flex min-w-[3.6rem] flex-col items-center justify-center bg-gradient-to-b from-sky-500/45 to-sky-950/60 px-2.5 py-1 sm:min-w-[4.5rem]">
        <span className="font-sans text-xl font-bold leading-none tabular-nums text-white sm:text-2xl">{left.value}</span>
        <span className="mt-0.5 max-w-[5.5rem] truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-sky-100/80">
          {left.label}
        </span>
      </div>
      <div className="flex min-w-[4.6rem] flex-col items-center justify-center bg-black/70 px-3 py-1 sm:min-w-[5.6rem]">
        <span className={`font-sans text-lg font-semibold leading-none tabular-nums sm:text-xl ${clockColor}`}>{clock}</span>
        {caption && (
          <span className="mt-0.5 max-w-[8rem] truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {caption}
          </span>
        )}
      </div>
      <div className="flex min-w-[3.6rem] flex-col items-center justify-center bg-gradient-to-b from-red-500/45 to-red-950/60 px-2.5 py-1 sm:min-w-[4.5rem]">
        <span className="font-sans text-xl font-bold leading-none tabular-nums text-white sm:text-2xl">{right.value}</span>
        <span className="mt-0.5 max-w-[5.5rem] truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-red-100/80">
          {right.label}
        </span>
      </div>
    </>
  );
  const frame =
    "absolute left-1/2 top-2 z-20 flex -translate-x-1/2 items-stretch overflow-hidden rounded-[3px] shadow-[0_2px_10px_rgba(0,0,0,0.45)] ring-1 ring-white/10";
  if (onPress) {
    return (
      <button type="button" onClick={onPress} aria-label="Tableau des scores" className={frame}>
        {body}
      </button>
    );
  }
  return <div className={`pointer-events-none ${frame}`}>{body}</div>;
}

// ------------------------------------------------------------ bas, gauche
/** Vie (et armure si le mode en donne une) : gros chiffres et barre fine. */
export function DuelVitals({ hp, armor = null }: { hp: number; armor?: number | null }) {
  const value = Math.max(0, Math.round(hp));
  const low = value <= 25;
  return (
    <div className="pointer-events-none flex items-end gap-5 rounded-[3px] bg-gradient-to-r from-black/70 via-black/45 to-transparent py-2 pl-3 pr-8">
      <Vital icon="vie" value={value} low={low} label="Vie" />
      {armor !== null && <Vital icon="armure" value={Math.max(0, Math.round(armor))} low={false} label="Armure" />}
    </div>
  );
}

function Vital({ icon, value, low, label }: { icon: HudIconId; value: number; low: boolean; label: string }) {
  return (
    <div className="flex flex-col gap-1" aria-label={`${label} : ${value}`}>
      <div className="flex items-center gap-2">
        <HudIcon id={icon} height={18} className={low ? "text-red-400" : "text-zinc-200"} />
        <span
          className={`font-sans text-3xl font-semibold leading-none tabular-nums sm:text-4xl ${low ? "text-red-400" : "text-white"}`}
          style={low ? { animation: "horror-breathe 0.9s ease-in-out infinite" } : undefined}
        >
          {value}
        </span>
      </div>
      <div className="h-[3px] w-24 bg-white/15 sm:w-28">
        <div
          className={`h-full transition-[width] duration-200 ${low ? "bg-red-500" : "bg-zinc-100"}`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}

// ------------------------------------------------------------- l'argent
/**
 * Argent du mode Economie. Chaque gain ou depense s'affiche un instant a
 * cote (« +$300 » en vert, « -$2700 » en rouge), puis s'efface.
 */
export function DuelMoney({ money }: { money: number }) {
  const [prev, setPrev] = useState(money);
  const [delta, setDelta] = useState<{ id: number; amount: number } | null>(null);
  // L'ecart se calcule au rendu ou l'argent change (motif « etat derive
  // du rendu precedent ») : pas d'effet qui redessine une deuxieme fois.
  if (money !== prev) {
    setPrev(money);
    setDelta((d) => ({ id: (d?.id ?? 0) + 1, amount: money - prev }));
  }
  useEffect(() => {
    if (!delta) return;
    const t = window.setTimeout(() => setDelta(null), 2300);
    return () => window.clearTimeout(t);
  }, [delta]);

  return (
    <div className="pointer-events-none flex items-center gap-2">
      <div className="flex items-baseline gap-1 rounded-[3px] bg-black/60 px-2.5 py-1 ring-1 ring-emerald-400/25">
        <span className="font-sans text-lg font-bold leading-none text-emerald-300">$</span>
        <span className="font-sans text-xl font-bold leading-none tabular-nums text-emerald-200">{money}</span>
      </div>
      {delta && delta.amount !== 0 && (
        <span
          key={delta.id}
          className={`font-sans text-sm font-bold tabular-nums ${delta.amount > 0 ? "text-emerald-300" : "text-red-400"}`}
          style={{ animation: "horror-act-in 2.3s ease-out forwards", textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
        >
          {delta.amount > 0 ? `+$${delta.amount}` : `-$${-delta.amount}`}
        </span>
      )}
    </div>
  );
}

// ------------------------------------------------------ fil des eliminations
/** Tueur, silhouette de l'arme, tete si tir a la tete, victime. */
export function DuelKillFeed({ entries }: { entries: KillFeedEntry[] }) {
  return (
    <div className="pointer-events-none flex max-w-[92vw] flex-col items-end gap-1">
      {entries.map((e) => (
        <div
          key={e.id}
          className={`flex items-center gap-2 rounded-[3px] px-2 py-[5px] text-[12px] font-semibold leading-none sm:text-[13px] ${
            e.killerMe
              ? "bg-black/70 ring-2 ring-inset ring-red-600/90"
              : e.victimMe
                ? "bg-red-950/80 ring-1 ring-inset ring-red-500/40"
                : "bg-black/55"
          }`}
          style={{ animation: "horror-quest-in 0.22s ease-out" }}
        >
          {e.killer && <span className={`max-w-[8.5rem] truncate ${nameTone(e.killerMe)}`}>{e.killer}</span>}
          <HudIcon id={e.icon} height={16} className="text-zinc-100" />
          {e.head && <HudIcon id="tete" height={14} className="text-zinc-100" title="Tir à la tête" />}
          <span className={`max-w-[8.5rem] truncate ${nameTone(e.victimMe)}`}>{e.victim}</span>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------ bas, droite
/** Emplacements portes, facon liste d'armes : la tenue en main ressort. */
export function DuelLoadout({
  slots,
  cur,
  knifeIcon,
  knifeColor,
  slotColors,
  showGuns,
  nades,
}: {
  slots: WeaponId[];
  /** Emplacement en main ; -1 : le couteau. */
  cur: number;
  knifeIcon: HudIconId;
  knifeColor: string;
  /** Couleur de rarete de chaque arme portee (liseré). */
  slotColors: string[];
  showGuns: boolean;
  nades: { grenade: number; fumigene: number; aiming: "grenade" | "fumigene" | null; key: string } | null;
}) {
  return (
    <div className="pointer-events-none flex flex-col items-end gap-[3px]">
      {showGuns &&
        slots.map((w, i) => (
          <LoadoutRow key={`${i}-${w}`} active={i === cur} keyLabel={String(i + 1)} color={slotColors[i]}>
            <HudIcon id={w} height={15} />
          </LoadoutRow>
        ))}
      {showGuns && (
        <LoadoutRow active={cur < 0} keyLabel="4" color={knifeColor}>
          <HudIcon id={knifeIcon} height={13} />
        </LoadoutRow>
      )}
      {nades && (
        <div className="flex items-center gap-1">
          {(["grenade", "fumigene"] as const).map((k) => {
            const held = nades.aiming === k;
            const count = nades[k];
            return (
              <div
                key={k}
                className={`flex h-6 items-center gap-1 rounded-[3px] px-1.5 ${
                  held ? "bg-lime-400/25 text-lime-100 ring-1 ring-inset ring-lime-300/70" : "bg-black/50 text-zinc-200"
                } ${count === 0 && !held ? "opacity-35" : ""}`}
                aria-label={`${k === "grenade" ? "Grenades" : "Fumigènes"} : ${count}`}
              >
                <HudIcon id={k} height={16} />
                <span className="font-sans text-[12px] font-bold tabular-nums">{count}</span>
                <span className="rounded-[2px] bg-white/10 px-1 font-mono text-[9px] font-bold leading-[14px] text-zinc-400">
                  {k === "grenade" ? nades.key : "X"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LoadoutRow({
  active,
  keyLabel,
  color,
  children,
}: {
  active: boolean;
  keyLabel: string;
  color?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex h-6 min-w-[5.5rem] items-center justify-end gap-2 rounded-[3px] pl-2 pr-1.5 ${
        active ? "bg-white/[0.14] text-white" : "bg-black/35 text-zinc-400/80"
      }`}
      style={{ boxShadow: color ? `inset 2px 0 0 ${color}` : undefined }}
    >
      {children}
      <span className={`font-mono text-[10px] font-bold ${active ? "text-zinc-200" : "text-zinc-500"}`}>{keyLabel}</span>
    </div>
  );
}

/**
 * Munitions : chargeur en gros, reserve a cote, silhouette et nom de l'arme.
 * La reserve n'existe pas dans ce jeu (les rechargements sont illimites) :
 * « ∞ », sauf si un mode en donne une un jour.
 */
export function DuelAmmo({
  icon,
  name,
  ammo,
  magSize,
  reserve = null,
  reloading,
  hint,
}: {
  icon: HudIconId;
  name: string;
  ammo: number;
  magSize: number;
  reserve?: number | null;
  reloading: boolean;
  hint?: string;
}) {
  const melee = magSize <= 0;
  const low = !melee && ammo <= Math.max(1, Math.floor(magSize * 0.25));
  const fill = melee ? 0 : Math.max(0, Math.min(1, ammo / magSize));
  return (
    <div className="pointer-events-none flex flex-col items-end gap-1">
      <div className="flex items-end gap-3 rounded-[3px] bg-gradient-to-l from-black/70 via-black/45 to-transparent py-2 pl-8 pr-3">
        <div className="flex flex-col items-end gap-1">
          <HudIcon id={icon} height={22} className="text-zinc-100" />
          <span className="max-w-[9rem] truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300">{name}</span>
        </div>
        {!melee && (
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-baseline gap-1.5 font-sans font-semibold tabular-nums leading-none">
              <span className={`text-3xl sm:text-4xl ${reloading ? "text-zinc-500" : low ? "text-red-400" : "text-white"}`}>
                {reloading ? "--" : ammo}
              </span>
              <span className="text-base text-zinc-400 sm:text-lg">/ {reserve ?? "∞"}</span>
            </div>
            <div className="h-[3px] w-20 bg-white/15 sm:w-24">
              <div
                className={`ml-auto h-full ${low ? "bg-red-500" : "bg-zinc-100"}`}
                style={{ width: `${reloading ? 0 : fill * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
      {hint && (
        <p className="text-[10px] font-semibold text-zinc-300/90" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.9)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

// --------------------------------------------------- degats directionnels
/**
 * Arc rouge autour du centre, du cote d'ou vient le tir. `angle` : radians,
 * sens des aiguilles d'une montre, 0 = devant (en haut de l'ecran).
 */
export function DuelDamageIndicator({ angle, fade }: { angle: number; fade: number }) {
  if (fade <= 0.02) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <svg
        viewBox="0 0 240 240"
        className="size-[200px] sm:size-[240px]"
        style={{ transform: `rotate(${angle}rad)`, opacity: Math.min(1, fade * 1.2) }}
        aria-hidden
      >
        <path d="M82.9 27.1 A100 100 0 0 1 157.1 27.1" fill="none" stroke="rgba(235,45,30,0.9)" strokeWidth="9" />
        <path d="M95.5 38 A88 88 0 0 1 144.5 38" fill="none" stroke="rgba(255,120,90,0.55)" strokeWidth="2" />
      </svg>
    </div>
  );
}

// ------------------------------------------------------------ mort
/** Ecran de mort : qui, avec quoi, et le temps avant de revenir. */
export function DuelDeathCard({ killedBy, respawnIn, total }: { killedBy: KilledBy | null; respawnIn: number; total: number }) {
  const progress = total > 0 ? 1 - respawnIn / total : 0;
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/45">
      <div className="flex min-w-[16rem] flex-col items-center gap-2 rounded-[3px] bg-black/75 px-6 py-4 ring-1 ring-red-500/30">
        <p className="font-sans text-2xl font-bold uppercase tracking-[0.3em] text-red-400">Éliminé</p>
        {killedBy && (
          <p className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <span className="text-zinc-400">par</span>
            <span className="text-amber-300">{killedBy.name}</span>
            {killedBy.icon && <HudIcon id={killedBy.icon} height={16} className="text-zinc-100" />}
            {killedBy.head && <HudIcon id="tete" height={14} className="text-zinc-100" title="Tir à la tête" />}
          </p>
        )}
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
          Réapparition <span className="tabular-nums text-white">{respawnIn.toFixed(1)} s</span>
        </p>
        <div className="h-[3px] w-full bg-white/10">
          <div className="h-full bg-red-500/80" style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
