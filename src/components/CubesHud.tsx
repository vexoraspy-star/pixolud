"use client";

import type { ReactNode } from "react";
import { thingName, item } from "@/lib/voxelItems";
import CubesItemIcon from "./CubesItemIcon";

/** Ce que la partie montre a l'interface (instantane, rafraichi ~7 fois par seconde). */
export interface CubesHudState {
  mode: "creatif" | "survie";
  selected: number;
  hotbar: number[];
  stock: Record<string, number>;
  vie: number;
  faim: number;
  soif: number;
  /** Air restant sous l'eau, de 0 a 10 (10 : poumons pleins). */
  air: number;
  underwater: boolean;
  armure: number[];
  armurePts: number;
  usure: Record<string, number>;
  target: string;
  progress: number;
  chunks: number;
  fps: number;
  pixelRatio: number;
  jour: number;
  heure: string;
  nuit: boolean;
  stations: { table: boolean; four: boolean };
  toasts: { key: number; text: string; id: number }[];
  /** Un coup vient d'etre recu (voile rouge). */
  blesse: boolean;
  /** Angle vers le point de depart si on tient une boussole (radians, 0 = devant). */
  boussole: number | null;
  horloge: boolean;
  /** Progression du repas (0..1), de la tension de l'arc (0..1). */
  eating: number;
  bow: number;
}

export interface CubesCommands {
  resume(): void;
  resumeWithoutLock(): void;
  pause(): void;
  save(): boolean;
  export(): void;
  respawn(): void;
  select(slot: number): void;
  assign(id: number): void;
  craft(recipeId: string, times: number): number;
  equip(id: number): void;
  unequip(slot: number): void;
  consume(id: number): void;
  refreshStations(): void;
}

/** Une rangee de 10 icones (coeurs, cuisses, gouttes) remplies a moitie pres. */
function Row({ value, color, empty, shape, label, reverse = false }: { value: number; color: string; empty: string; shape: "coeur" | "cuisse" | "goutte" | "bouclier" | "bulle"; label: string; reverse?: boolean }) {
  const units = Math.max(0, Math.min(20, Math.round(value / 5)));
  return <div role="meter" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} className={`flex gap-px ${reverse ? "flex-row-reverse" : ""}`}>
    {Array.from({ length: 10 }, (_, i) => {
      const fill = Math.max(0, Math.min(2, units - i * 2));
      return <Icon key={i} shape={shape} color={color} empty={empty} fill={fill} flip={reverse} />;
    })}
  </div>;
}

const SHAPES: Record<string, string> = {
  // Silhouettes pixel art 9 x 8 (1 = plein), ligne par ligne.
  coeur: "011000110111101111111111111111111111011111110001111100000111000000010000",
  cuisse: "000011100000111110001111111001111111011111110011111100101100000110000000",
  goutte: "000010000000111000001111100011111110111111111111111111011111110001111100",
  bouclier: "110000011111111111111111111011111110011111110011111110011111110001111100",
  bulle: "001111100010000010101100001101000001100000001100000001010000010001111100",
};

function Icon({ shape, color, empty, fill, flip }: { shape: string; color: string; empty: string; fill: number; flip: boolean }) {
  const bits = SHAPES[shape];
  const rects: ReactNode[] = [];
  for (let i = 0; i < 72; i++) {
    if (bits[i] !== "1") continue;
    const x = i % 9;
    const y = Math.floor(i / 9);
    // Moitie gauche remplie pour un demi-coeur (a droite si la rangee est inversee).
    const half = flip ? x >= 4 : x <= 4;
    const on = fill === 2 || (fill === 1 && half);
    rects.push(<rect key={i} x={x} y={y} width={1.02} height={1.02} fill={on ? color : empty} />);
  }
  return <svg aria-hidden="true" viewBox="-0.5 -0.5 10 9" width={17} height={16} className="drop-shadow-[0_1px_0_rgba(0,0,0,.6)]" shapeRendering="crispEdges">
    {rects}
  </svg>;
}

export function CubesHud({ hud, onSelect }: { hud: CubesHudState; onSelect: (slot: number) => void }) {
  const survie = hud.mode === "survie";
  const held = hud.hotbar[hud.selected];
  const hurt = hud.blesse;
  return <>
    {/* Voiles : sous l'eau, coup recu, faim/soif critiques */}
    {hud.underwater && <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#0d4a6b]/35" />}
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${hurt ? "opacity-100" : "opacity-0"}`} style={{ background: "radial-gradient(circle, transparent 45%, rgba(190,20,20,.55))" }} />
    {survie && (hud.faim <= 10 || hud.soif <= 10) && <div aria-hidden="true" className="pointer-events-none absolute inset-0 animate-pulse" style={{ background: "radial-gradient(circle, transparent 60%, rgba(120,60,0,.35))" }} />}

    {/* Viseur */}
    <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 mix-blend-difference"><span className="absolute left-[9px] top-0 h-5 w-[2px] bg-white" /><span className="absolute left-0 top-[9px] h-[2px] w-5 bg-white" /></div>
    {(hud.eating > 0 || hud.bow > 0) && <div className="pointer-events-none absolute left-1/2 top-[54%] h-1.5 w-24 -translate-x-1/2 overflow-hidden rounded-full bg-black/40"><div className="h-full rounded-full bg-amber-200" style={{ width: `${Math.round((hud.eating || hud.bow) * 100)}%` }} /></div>}

    {/* Cartouche : jour, heure, boussole */}
    <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-3 rounded-xl border border-white/10 bg-[#101c17]/70 px-3.5 py-2.5 shadow-lg backdrop-blur-sm">
      <span aria-hidden="true" className="text-xl leading-none">{hud.nuit ? "🌙" : "☀️"}</span>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#d4e7b9]">Jour {hud.jour}{hud.horloge && <span className="ml-2 font-mono tracking-normal text-white">{hud.heure}</span>}</p>
        <p className="text-[11px] text-white/70">{survie ? "Survie" : "Créatif"}{hud.nuit && survie ? " · les monstres rôdent" : ""}</p>
      </div>
      {hud.boussole !== null && <svg aria-label="Boussole : direction du point de départ" viewBox="-10 -10 20 20" width={34} height={34} className="ml-1"><circle r={9} fill="#e8e2d0" stroke="#6b5a3a" strokeWidth={1.5} /><g transform={`rotate(${(hud.boussole * 180) / Math.PI})`}><path d="M0 -7 L2 0 L-2 0 Z" fill="#d6453a" /><path d="M0 7 L2 0 L-2 0 Z" fill="#555" /></g></svg>}
    </div>

    {/* Objets ramasses */}
    <div className="pointer-events-none absolute right-4 top-16 flex flex-col items-end gap-1">
      {hud.toasts.map((t) => <div key={t.key} className="flex items-center gap-2 rounded-lg bg-[#101c17]/75 px-2.5 py-1 text-xs text-white shadow"><CubesItemIcon id={t.id} size={18} />{t.text}</div>)}
    </div>

    {hud.target && <div className="pointer-events-none absolute left-1/2 top-[57%] -translate-x-1/2 rounded-lg bg-[#101c17]/70 px-3 py-1.5 text-center text-xs shadow">{hud.target}{hud.progress > 0 && <div className="mt-1.5 h-1 w-28 overflow-hidden rounded bg-white/20"><div className="h-full bg-amber-200" style={{ width: `${Math.min(100, hud.progress * 100)}%` }} /></div>}</div>}
    <div className="pointer-events-none absolute bottom-3 left-3 hidden text-[10px] text-white/75 drop-shadow sm:block">{hud.fps} i/s · rendu ×{hud.pixelRatio.toFixed(2).replace(/0$/, "")}</div>
    <div className="pointer-events-none absolute bottom-3 right-3 hidden text-right text-[10px] leading-4 text-white/75 drop-shadow lg:block">E · Inventaire &nbsp; C · Fabrication<br />{survie ? "Clic droit maintenu · manger, boire, tirer" : "F · Vol"}</div>

    {/* Barres de survie + barre d'objets */}
    <div className="absolute bottom-4 left-1/2 max-w-full -translate-x-1/2">
      {survie && <div className="pointer-events-none mb-1.5 flex items-end justify-between gap-6 px-1">
        <div className="flex flex-col gap-0.5">
          {hud.armurePts > 0 && <Row value={hud.armurePts * 5} color="#dfe6ea" empty="#3b4146" shape="bouclier" label="Armure" />}
          <Row value={hud.vie} color="#e8403c" empty="#3d1a1a" shape="coeur" label="Vie" />
        </div>
        <div className="flex flex-col items-end gap-0.5">
          {hud.underwater && <Row value={hud.air * 10} color="#bfe8ff" empty="transparent" shape="bulle" label="Air" reverse />}
          <Row value={hud.soif} color="#3f9be6" empty="#16283a" shape="goutte" label="Soif" reverse />
          <Row value={hud.faim} color="#c9823c" empty="#33230f" shape="cuisse" label="Faim" reverse />
        </div>
      </div>}
      <p className="mb-1.5 text-center text-xs font-medium text-white drop-shadow">{thingName(held)}{survie && item(held)?.tool && <span className="ml-2 text-white/60">{usureLabel(held, hud.usure)}</span>}</p>
      <div className="flex gap-1 rounded-xl border border-black/40 bg-[#1b1f1d]/85 p-1 shadow-2xl sm:gap-1">
        {hud.hotbar.map((id, slot) => {
          const count = hud.stock[id] ?? 0;
          const missing = survie && id !== 0 && count <= 0;
          const tool = item(id)?.tool;
          const wear = tool ? (hud.usure[id] ?? 0) / tool.durability : 0;
          return <button key={slot} title={`${slot + 1} · ${thingName(id)}`} aria-label={`Case ${slot + 1} : ${thingName(id)}`} aria-pressed={hud.selected === slot} onClick={() => onSelect(slot)} className={`relative flex h-12 w-11 items-center justify-center rounded-md border-2 transition-colors sm:h-14 sm:w-13 ${hud.selected === slot ? "border-[#f3e3a8] bg-white/15" : "border-white/5 bg-black/25 hover:bg-white/10"}`}>
            <span className="absolute left-1 top-0.5 text-[9px] text-white/45">{slot + 1}</span>
            {id !== 0 && <span className={missing ? "opacity-30 grayscale" : ""}><CubesItemIcon id={id} size={32} /></span>}
            {survie && id !== 0 && count > 1 && <span className="absolute bottom-0.5 right-1 text-[11px] font-bold tabular-nums text-white [text-shadow:1px_1px_0_#000]">{count}</span>}
            {survie && tool && wear > 0 && count > 0 && <span className="absolute bottom-1 left-1.5 right-1.5 h-[3px] bg-black/60"><span className="block h-full" style={{ width: `${Math.max(0, 100 - wear * 100)}%`, background: `hsl(${Math.round(120 * (1 - wear))} 80% 50%)` }} /></span>}
          </button>;
        })}
      </div>
    </div>
  </>;
}

export function usureLabel(id: number, usure: Record<string, number>): string {
  const d = item(id)?.tool?.durability ?? item(id)?.armor?.durability;
  if (!d) return "";
  return `${Math.max(0, d - (usure[id] ?? 0))}/${d}`;
}
