"use client";

import { useMemo, useState } from "react";
import { PALETTE } from "@/lib/voxel";
import { allThings, isBlock, item, thingName, type ItemKind } from "@/lib/voxelItems";
import { ALL_RECIPES, CATEGORIES, STATION_LABEL, maxCraft, type Categorie, type Recipe } from "@/lib/voxelRecipes";
import CubesItemIcon from "./CubesItemIcon";
import { usureLabel, type CubesCommands, type CubesHudState } from "./CubesHud";

const SLOT_LABEL = ["Casque", "Plastron", "Jambières", "Bottes"];

type Filtre = "tout" | "blocs" | ItemKind;
const FILTRES: { id: Filtre; label: string }[] = [
  { id: "tout", label: "Tout" },
  { id: "blocs", label: "Blocs" },
  { id: "outil", label: "Outils" },
  { id: "armure", label: "Armures" },
  { id: "nourriture", label: "Nourriture" },
  { id: "boisson", label: "Boissons" },
  { id: "materiau", label: "Matériaux" },
  { id: "teinture", label: "Teintures" },
];

function kindOf(id: number): Filtre {
  if (isBlock(id)) return "blocs";
  const k = item(id)?.kind;
  return k === "divers" ? "materiau" : k ?? "materiau";
}

const norm = (s: string) => s.toLocaleLowerCase("fr").normalize("NFD").replace(/[̀-ͯ]/g, "");

function Slot({ id, count, selected, onClick, label, dim }: { id: number; count?: number; selected?: boolean; onClick?: () => void; label: string; dim?: boolean }) {
  return <button onClick={onClick} title={label} aria-label={label} aria-pressed={selected} className={`relative flex size-12 shrink-0 items-center justify-center rounded-md border-2 bg-black/25 transition-colors hover:bg-white/10 ${selected ? "border-[#f3e3a8]" : "border-white/10"}`}>
    {id !== 0 && <span className={dim ? "opacity-30 grayscale" : ""}><CubesItemIcon id={id} size={30} /></span>}
    {count !== undefined && count > 1 && <span className="absolute bottom-0 right-1 text-[11px] font-bold tabular-nums [text-shadow:1px_1px_0_#000]">{count}</span>}
  </button>;
}

export function InventoryPanel({ hud, commands }: { hud: CubesHudState; commands: CubesCommands }) {
  const survie = hud.mode === "survie";
  const [search, setSearch] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("tout");
  const all = useMemo(() => allThings(PALETTE), []);
  const owned = survie ? all.filter((id) => (hud.stock[id] ?? 0) > 0) : all;
  const q = norm(search.trim());
  const visible = owned.filter((id) => (filtre === "tout" || kindOf(id) === filtre) && (!q || norm(thingName(id)).includes(q)));
  const held = hud.hotbar[hud.selected];
  return <div className="mt-4">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[.2em] text-[#c8dba8]">Barre d’objets · choisis une case</p>
        <div className="flex gap-1">{hud.hotbar.map((id, slot) => <Slot key={slot} id={id} count={survie ? hud.stock[id] : undefined} dim={survie && id !== 0 && !(hud.stock[id] > 0)} selected={hud.selected === slot} onClick={() => commands.select(slot)} label={`Case ${slot + 1} : ${thingName(id)}`} />)}</div>
        <p className="mt-1.5 text-xs text-[#b9c9b9]">Case {hud.selected + 1} : <strong className="text-white">{thingName(held)}</strong>{held !== 0 && <button onClick={() => commands.assign(0)} className="ml-2 rounded border border-white/15 px-1.5 py-0.5 text-[10px] hover:bg-white/10">Vider</button>}</p>
      </div>
      {survie && <div>
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[.2em] text-[#c8dba8]">Armure · {hud.armurePts} point{hud.armurePts > 1 ? "s" : ""}</p>
        <div className="flex gap-1">{hud.armure.map((id, slot) => <div key={slot} className="flex flex-col items-center gap-0.5">
          <Slot id={id} onClick={() => id && commands.unequip(slot)} label={id ? `${thingName(id)} (cliquer pour retirer)` : `${SLOT_LABEL[slot]} : vide`} />
          <span className="text-[9px] text-white/45">{id ? usureLabel(id, hud.usure) : SLOT_LABEL[slot]}</span>
        </div>)}</div>
      </div>}
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-1.5">
      {FILTRES.map((f) => <button key={f.id} onClick={() => setFiltre(f.id)} aria-pressed={filtre === f.id} className={`rounded-full border px-2.5 py-1 text-[11px] ${filtre === f.id ? "border-amber-200 bg-amber-100/15 text-amber-100" : "border-white/10 text-white/70 hover:bg-white/10"}`}>{f.label}</button>)}
      <input aria-label="Rechercher un objet" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className="ml-auto w-36 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs outline-none focus:border-amber-200" />
    </div>
    <div className="mt-3 grid max-h-64 grid-cols-3 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-5">
      {visible.map((id) => {
        const it = item(id);
        const count = hud.stock[id] ?? 0;
        const food = it?.food;
        return <div key={id} className="flex flex-col items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-2 text-center text-[11px] leading-tight">
          <button onClick={() => commands.assign(id)} className="flex w-full flex-col items-center gap-1 rounded hover:bg-white/10" title="Mettre dans la case choisie">
            <CubesItemIcon id={id} size={34} />
            <span>{thingName(id)}</span>
            {survie && <span className="text-amber-200 tabular-nums">× {count}</span>}
          </button>
          {survie && it?.armor && <button onClick={() => commands.equip(id)} className="rounded bg-sky-300/20 px-2 py-0.5 text-[10px] text-sky-100 hover:bg-sky-300/30">Porter</button>}
          {survie && food && <button onClick={() => commands.consume(id)} className="rounded bg-amber-200/20 px-2 py-0.5 text-[10px] text-amber-100 hover:bg-amber-200/30">{it?.kind === "boisson" ? "Boire" : "Manger"}</button>}
        </div>;
      })}
    </div>
    {visible.length === 0 && <p className="mt-3 text-sm text-white/60">{survie && owned.length === 0 ? "Ton inventaire est vide : casse des blocs pour récolter." : "Rien ne correspond."}</p>}
  </div>;
}

function stationOk(r: Recipe, hud: CubesHudState) {
  return r.station === "main" || (r.station === "table" ? hud.stations.table : hud.stations.four);
}

export function CraftPanel({ hud, commands }: { hud: CubesHudState; commands: CubesCommands }) {
  const survie = hud.mode === "survie";
  const [categorie, setCategorie] = useState<Categorie | "tout">("tout");
  const [search, setSearch] = useState("");
  const [possibles, setPossibles] = useState(false);
  const [dernier, setDernier] = useState("");
  const q = norm(search.trim());
  const list = ALL_RECIPES.filter((r) => (categorie === "tout" || r.categorie === categorie)
    && (!q || norm(thingName(r.out)).includes(q) || r.in.some(([id]) => norm(thingName(id)).includes(q)))
    && (!possibles || !survie || (stationOk(r, hud) && maxCraft(r, hud.stock) > 0)));
  const faisables = survie ? ALL_RECIPES.filter((r) => stationOk(r, hud) && maxCraft(r, hud.stock) > 0).length : ALL_RECIPES.length;
  function lancer(r: Recipe, fois: number) {
    const n = commands.craft(r.id, fois);
    setDernier(n > 0 ? `+${n} ${thingName(r.out)}` : "Impossible pour l’instant.");
  }
  return <div className="mt-4">
    <div className="flex flex-wrap gap-2 text-[11px]">
      <span className="rounded-full bg-emerald-300/15 px-2.5 py-1 text-emerald-100">✋ À la main : toujours</span>
      <span className={`rounded-full px-2.5 py-1 ${hud.stations.table ? "bg-emerald-300/15 text-emerald-100" : "bg-white/5 text-white/50"}`}>🪚 Table de craft : {hud.stations.table ? "à portée" : "approche-toi d’une table"}</span>
      <span className={`rounded-full px-2.5 py-1 ${hud.stations.four ? "bg-emerald-300/15 text-emerald-100" : "bg-white/5 text-white/50"}`}>🔥 Four : {hud.stations.four ? "à portée" : "approche-toi d’un four"}</span>
      <span className="ml-auto self-center text-white/60">{faisables} recette{faisables > 1 ? "s" : ""} faisable{faisables > 1 ? "s" : ""} · {ALL_RECIPES.length} au total</span>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <button onClick={() => setCategorie("tout")} aria-pressed={categorie === "tout"} className={`rounded-full border px-2.5 py-1 text-[11px] ${categorie === "tout" ? "border-amber-200 bg-amber-100/15 text-amber-100" : "border-white/10 text-white/70 hover:bg-white/10"}`}>Tout</button>
      {CATEGORIES.map((c) => <button key={c.id} onClick={() => setCategorie(c.id)} aria-pressed={categorie === c.id} className={`rounded-full border px-2.5 py-1 text-[11px] ${categorie === c.id ? "border-amber-200 bg-amber-100/15 text-amber-100" : "border-white/10 text-white/70 hover:bg-white/10"}`}>{c.label}</button>)}
    </div>
    <div className="mt-2 flex flex-wrap items-center gap-3">
      {survie && <label className="flex items-center gap-1.5 text-[11px] text-white/80"><input type="checkbox" checked={possibles} onChange={(e) => setPossibles(e.target.checked)} className="accent-amber-200" /> Seulement ce que je peux fabriquer</label>}
      <input aria-label="Rechercher une recette" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher (objet ou ingrédient)…" className="ml-auto w-56 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs outline-none focus:border-amber-200" />
    </div>
    <p role="status" className="mt-2 h-4 text-xs text-amber-100">{dernier}</p>
    <div className="mt-1 grid max-h-72 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
      {list.map((r) => {
        const ok = stationOk(r, hud);
        const max = survie ? maxCraft(r, hud.stock) : 99;
        const can = ok && max > 0;
        return <div key={r.id} className={`flex items-center gap-2.5 rounded-lg border p-2 ${can ? "border-emerald-200/25 bg-emerald-200/5" : "border-white/10 bg-white/5"}`}>
          <CubesItemIcon id={r.out} size={38} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{thingName(r.out)}{r.n > 1 && <span className="ml-1 text-white/60">×{r.n}</span>}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {r.in.map(([id, n]) => {
                const have = hud.stock[id] ?? 0;
                return <span key={id} title={thingName(id)} className={`flex items-center gap-0.5 rounded bg-black/25 py-0.5 pl-0.5 pr-1 text-[10px] tabular-nums ${!survie || have >= n ? "text-white/85" : "text-rose-300"}`}><CubesItemIcon id={id} size={16} />{survie ? `${have}/${n}` : `×${n}`}</span>;
              })}
              <span className={`text-[10px] ${ok ? "text-white/45" : "text-amber-300"}`}>{r.station === "main" ? "" : `· ${STATION_LABEL[r.station]}`}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <button disabled={!can} onClick={() => lancer(r, 1)} className="rounded bg-[#e4d39a] px-2 py-1 text-[11px] font-bold text-[#172d20] hover:bg-[#f4e4ac] disabled:cursor-not-allowed disabled:opacity-30">Fabriquer</button>
            {survie && max > 1 && ok && <button onClick={() => lancer(r, max)} className="rounded border border-white/20 px-2 py-0.5 text-[10px] hover:bg-white/10">Tout (×{max})</button>}
          </div>
        </div>;
      })}
    </div>
    {list.length === 0 && <p className="mt-3 text-sm text-white/60">Aucune recette ne correspond.</p>}
    <p className="mt-3 text-[10px] leading-4 text-white/50">Astuce : clic droit sur une table de craft ou un four pour ouvrir ce livre directement. Le four brûle un charbon par fournée (le charbon de bois se fait avec deux troncs).</p>
  </div>;
}

