"use client";

import type { ReactNode } from "react";
import { SHOP_ORDER, WEAPONS, shopKeyLabel, type WeaponId } from "@/lib/duelWeapons";
import { WEAPON_PRICES, type DuelEconomy } from "@/lib/duelModes";
import { HudIcon, type HudIconId } from "./DuelHudIcons";

/**
 * Menu d'achat du mode Economie, pendant la phase d'achat.
 *
 * Un grand panneau par categories, facon jeu de tir tactique : silhouette
 * de chaque arme, prix, touche du clavier. Les cases trop cheres sont
 * grisees. L'achat lui-meme reste celui de DuelScene (`onBuy`) : ce panneau
 * n'invente ni prix ni regle, il les affiche.
 */

const CATEGORIES: { title: string; items: WeaponId[] }[] = [
  { title: "Pistolets", items: ["pistolet", "revolver"] },
  // Comme dans les jeux du genre : pistolets-mitrailleurs, fusils a pompe
  // et armes lourdes sont les armes « intermediaires ».
  { title: "Intermédiaires", items: ["pm", "mitraillette", "double", "pompe", "mitrailleuse", "roquettes"] },
  { title: "Fusils", items: ["rafale", "fusil", "arbalete", "carabine", "sniper"] },
];

/** Une arme ajoutee un jour a la boutique sans categorie tombe ici. */
function categories() {
  const listed = new Set(CATEGORIES.flatMap((c) => c.items));
  const rest = SHOP_ORDER.filter((id) => !listed.has(id));
  const base = CATEGORIES.map((c) => ({ ...c, items: c.items.filter((id) => SHOP_ORDER.includes(id)) }));
  return rest.length > 0 ? [...base, { title: "Autres", items: rest }] : base;
}

export default function DuelBuyMenu({
  money,
  buyLeft,
  round,
  slots,
  cur,
  knifeName,
  knifeIcon,
  nades,
  nadeKey,
  economy,
  touch,
  onBuy,
  onClose,
}: {
  money: number;
  /** Secondes restantes de la phase d'achat. */
  buyLeft: number;
  round: number;
  /** Armes portees, et celle en main (-1 : le couteau). */
  slots: WeaponId[];
  cur: number;
  knifeName: string;
  knifeIcon: HudIconId;
  nades: { grenade: number; fumigene: number };
  nadeKey: string;
  economy: DuelEconomy;
  touch: boolean;
  onBuy: (id: WeaponId) => void;
  onClose: () => void;
}) {
  const inHand = cur >= 0 ? slots[cur] : null;
  return (
    <div className="absolute inset-x-0 bottom-3 top-[4.75rem] z-20 flex justify-center px-2 sm:bottom-6 sm:px-4">
      <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-[4px] bg-zinc-950/90 text-zinc-100 shadow-[0_10px_50px_rgba(0,0,0,0.65)] ring-1 ring-white/10">
        {/* En-tete : argent restant, temps d'achat, fermeture */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-white/10 bg-white/[0.04] px-3 py-2 sm:px-4">
          <div className="flex items-baseline gap-3">
            <p className="font-sans text-sm font-bold uppercase tracking-[0.24em] text-white">Achats</p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
              Manche {round} · <span className="tabular-nums text-amber-300">{buyLeft.toFixed(1)} s</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p className="flex items-baseline gap-1 font-sans font-bold leading-none">
              <span className="text-lg text-emerald-300">$</span>
              <span className="text-2xl tabular-nums text-emerald-200">{money}</span>
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[3px] bg-white/10 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-200 ring-1 ring-white/15 transition hover:bg-white/20"
            >
              Fermer{touch ? "" : " · Échap"}
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-2 gap-x-3 gap-y-4 overflow-y-auto p-3 sm:grid-cols-3 sm:p-4 lg:grid-cols-5">
          {categories().map((cat) => (
            <section key={cat.title} className="flex flex-col gap-1.5">
              <h3 className="border-b border-white/10 pb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                {cat.title}
              </h3>
              {cat.items.map((id) => {
                const price = WEAPON_PRICES[id];
                const owned = slots.includes(id);
                const holding = inHand === id;
                const affordable = price <= money;
                const disabled = holding || (!owned && !affordable);
                const status = holding ? "En main" : owned ? "Possédée" : price === 0 ? "Gratuit" : `$${price}`;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onBuy(id)}
                    disabled={disabled}
                    aria-label={`${WEAPONS[id].name}, ${status}`}
                    className={`flex h-[3.9rem] flex-col justify-between rounded-[3px] px-2 py-1.5 text-left ring-1 ring-inset transition ${
                      holding
                        ? "bg-sky-500/15 ring-sky-400/70"
                        : owned
                          ? "bg-white/[0.06] ring-sky-400/35 hover:bg-white/[0.1]"
                          : affordable
                            ? "bg-white/[0.05] ring-white/10 hover:bg-white/[0.11] hover:ring-white/35"
                            : "cursor-not-allowed bg-white/[0.02] opacity-40 ring-white/5 grayscale"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-1 text-[10px] font-bold leading-none">
                      <span className="rounded-[2px] bg-white/10 px-1 py-[1px] font-mono text-zinc-300">{shopKeyLabel(SHOP_ORDER.indexOf(id))}</span>
                      <span
                        className={`tabular-nums ${
                          holding || owned ? "text-sky-300" : !affordable ? "text-red-400" : price === 0 ? "text-zinc-300" : "text-emerald-300"
                        }`}
                      >
                        {status}
                      </span>
                    </span>
                    <span className="flex min-h-0 flex-1 items-center justify-center">
                      <HudIcon id={id} height={17} className="max-w-full text-zinc-100" />
                    </span>
                    <span className="truncate text-[10px] font-semibold uppercase leading-none tracking-wide text-zinc-300">
                      {WEAPONS[id].name}
                    </span>
                  </button>
                );
              })}
            </section>
          ))}

          {/* Equipement : le couteau du casier suit a chaque manche. */}
          <section className="flex flex-col gap-1.5">
            <h3 className="border-b border-white/10 pb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
              Équipement
            </h3>
            <InfoCard label={knifeName} status="Équipé" keyLabel="4">
              <HudIcon id={knifeIcon} height={15} className="text-zinc-100" />
            </InfoCard>
            <p className="px-0.5 text-[10px] leading-snug text-zinc-500">Ton couteau du casier, offert à chaque manche.</p>
          </section>

          {/* Grenades : fournies a chaque manche, rien a acheter. */}
          <section className="flex flex-col gap-1.5">
            <h3 className="border-b border-white/10 pb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
              Grenades
            </h3>
            <InfoCard label="Grenade" status={`× ${nades.grenade}`} keyLabel={nadeKey} dim={nades.grenade === 0}>
              <HudIcon id="grenade" height={20} className="text-zinc-100" />
            </InfoCard>
            <InfoCard label="Fumigène" status={`× ${nades.fumigene}`} keyLabel="X" dim={nades.fumigene === 0}>
              <HudIcon id="fumigene" height={20} className="text-zinc-100" />
            </InfoCard>
            <p className="px-0.5 text-[10px] leading-snug text-zinc-500">Fournies à chaque manche.</p>
          </section>
        </div>

        <p className="border-t border-white/10 px-3 py-1.5 text-[10px] leading-relaxed text-zinc-500 sm:px-4">
          Manche gagnée : +${economy.killReward + economy.winReward} · perdue : +${economy.lossReward}. Si tu meurs, tu repars au
          pistolet.{touch ? "" : " Touches 1 à 9, 0, Maj + chiffre : acheter · B : ouvrir ou fermer."}
        </p>
      </div>
    </div>
  );
}

function InfoCard({
  label,
  status,
  keyLabel,
  dim = false,
  children,
}: {
  label: string;
  status: string;
  keyLabel: string;
  dim?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex h-[3.9rem] flex-col justify-between rounded-[3px] bg-white/[0.04] px-2 py-1.5 ring-1 ring-inset ring-white/10 ${
        dim ? "opacity-40" : ""
      }`}
    >
      <span className="flex items-center justify-between gap-1 text-[10px] font-bold leading-none">
        <span className="rounded-[2px] bg-white/10 px-1 py-[1px] font-mono text-zinc-300">{keyLabel}</span>
        <span className="text-sky-300">{status}</span>
      </span>
      <span className="flex min-h-0 flex-1 items-center justify-center">{children}</span>
      <span className="truncate text-[10px] font-semibold uppercase leading-none tracking-wide text-zinc-300">{label}</span>
    </div>
  );
}
