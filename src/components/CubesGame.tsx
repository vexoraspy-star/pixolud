"use client";

import { useId, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { spawnPoint, type SavedWorld } from "@/lib/voxel";
import { CUBES_SAVE_KEY, parseWorldSave } from "@/lib/voxelSave";
import CubesBlockIcon from "./CubesBlockIcon";

const CubesScene = dynamic(() => import("./CubesScene"), { ssr: false, loading: () => <div role="status" className="flex h-full flex-col items-center justify-center gap-5 bg-[#102c28] text-[#f8f2df]"><CubesBlockIcon id={1} size={64} /><p className="text-sm tracking-wide">Ton aventure prend forme…</p></div> });

function Voxel({ x, y, width = 25, height = 28, colors = ["#aad474", "#9a7552", "#72523e"] }: { x: number; y: number; width?: number; height?: number; colors?: string[] }) {
  return <g>
    <path d={`M${x - width} ${y + width / 2}l${width} ${width / 2}v${height}l-${width} -${width / 2}z`} fill={colors[1]} />
    <path d={`M${x} ${y + width}l${width} -${width / 2}v${height}l-${width} ${width / 2}z`} fill={colors[2]} />
    <path d={`M${x} ${y}l${width} ${width / 2}-${width} ${width / 2}-${width}-${width / 2}z`} fill={colors[0]} />
  </g>;
}

function CubesLandscape() {
  const sky = useId();
  const grass = ["#b6d77e", "#8b7251", "#67513c"];
  const cells = Array.from({ length: 64 }, (_, i) => ({ x: i % 8, z: Math.floor(i / 8) })).sort((a, b) => a.x + a.z - b.x - b.z);
  return <svg viewBox="0 0 560 475" className="mx-auto w-full max-w-[560px]" aria-hidden="true">
    <defs><radialGradient id={sky}><stop stopColor="#b1d994" stopOpacity=".22" /><stop offset="1" stopColor="#b1d994" stopOpacity="0" /></radialGradient></defs>
    <circle cx="294" cy="226" r="231" fill={`url(#${sky})`} />
    <circle cx="411" cy="86" r="38" fill="#edcc84" /><circle cx="411" cy="86" r="51" fill="none" stroke="#edcc84" strokeOpacity=".15" />
    <path d="M54 127h23V113h42v14h25v11H54zm310 24h24v-12h31v12h29v10h-84z" fill="#d6e9d2" fillOpacity=".38" />
    <path d="M124 58h32v-9h24v9h19v9h-75zM449 214h31v-9h23v9h20v8h-74z" fill="#d6e9d2" fillOpacity=".17" />
    <ellipse cx="280" cy="410" rx="155" ry="24" fill="#041b18" fillOpacity=".34" />
    {cells.map(({ x, z }) => {
      const river = (x === 4 && z > 2) || (x === 5 && z < 4);
      const hill = Math.max(0, 3 - Math.abs(x - 1) - Math.abs(z - 1));
      const elevation = river ? 0 : 1 + hill;
      const tone = (x * 3 + z * 7) % 4;
      return <Voxel key={`${x}-${z}`} x={280 + (x - z) * 25} y={170 + (x + z) * 12.5 - elevation * 14} height={30 + elevation * 14} colors={river ? [tone % 2 ? "#79c7cb" : "#91d3ce", "#629da1", "#467b85"] : [tone === 0 ? "#c1dc86" : tone === 1 ? "#a1c86f" : grass[0], grass[1], grass[2]]} />;
    })}
    <path d="m313 285 16 8m-7 12 11 5m-16-68 18 9m-30 73 12 6" stroke="#ddf7de" strokeOpacity=".6" strokeWidth="2" />
    <g>
      <Voxel x={259} y={271} width={14} height={7} colors={["#ddbb80", "#ac824d", "#805e36"]} />
      <Voxel x={284} y={283.5} width={14} height={7} colors={["#ddbb80", "#ac824d", "#805e36"]} />
      <Voxel x={309} y={296} width={14} height={7} colors={["#ddbb80", "#ac824d", "#805e36"]} />
    </g>
    {[{ x: 240, y: 151, s: 1.1 }, { x: 182, y: 220, s: .88 }, { x: 382, y: 246, s: .85 }, { x: 210, y: 295, s: .62 }].map((tree, i) => <g key={i} transform={`translate(${tree.x} ${tree.y}) scale(${tree.s})`}>
      <Voxel x={0} y={-19} width={7} height={43} colors={["#bc9d68", "#a0794e", "#755738"]} />
      <Voxel x={0} y={-67} width={34} height={27} colors={["#8eb969", "#659351", "#3e754b"]} />
      <Voxel x={-4} y={-91} width={25} height={26} colors={["#aacb79", "#7eaa5c", "#568d51"]} />
      <path d="m-16-76 8 4m-9 29 8 4m23-15 6-3" stroke="#cee49b" strokeOpacity=".5" strokeWidth="3" />
    </g>)}
    <g transform="translate(325 196)">
      <Voxel x={0} y={-10} width={32} height={46} colors={["#dab681", "#c9a474", "#a68257"]} />
      <path d="m-38 7 36-45L38 7 0 27z" fill="#687e73" /><path d="m-38 7 36-45L0 27z" fill="#8b9a7a" />
      <path d="m-24 23 11 6v23l-11-6z" fill="#5b6550" /><path d="m11 29 13-6v11l-13 6z" fill="#f5d58b" />
      <path d="m15-24 8-4v-18l-8 4z" fill="#ad9070" /><path d="m8-28 7 4v-18l-7-4z" fill="#cbb592" />
      <path d="M15-53h8v-8h-8zm8-16h10v-10H23z" fill="#e5ead0" fillOpacity=".35" />
    </g>
    <Voxel x={126} y={287} width={17} height={14} colors={["#c2c6ad", "#929b8a", "#73877d"]} />
    <Voxel x={415} y={303} width={13} height={12} colors={["#c2c6ad", "#929b8a", "#73877d"]} />
    <path d="M244 319v-10m-4 5h8m-82-62v-10m-4 5h8m178 56v-10m-4 5h8" stroke="#e4bd73" strokeWidth="4" />
    <path d="m89 202 3-6 3 6-3 6zm353-23 3-6 3 6-3 6zM346 50l3-6 3 6-3 6z" fill="#dec58a" fillOpacity=".65" />
  </svg>;
}

export default function CubesGame({ title }: { title: string }) {
  const [run, setRun] = useState<SavedWorld | null>(null);
  const [seed, setSeed] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<SavedWorld["mode"] | null>(null);
  const [pendingImport, setPendingImport] = useState<SavedWorld | null>(null);
  function create(mode: SavedWorld["mode"], confirmed = false) {
    try {
      if (!confirmed && localStorage.getItem(CUBES_SAVE_KEY)) { setPending(mode); return; }
    } catch { /* Le jeu peut fonctionner sans stockage local. */ }
    const seedText = seed.trim();
    let number = seedText ? 0 : Date.now() % 2147483647;
    for (const letter of seedText) number = (Math.imul(number, 31) + letter.charCodeAt(0)) | 0;
    setPending(null); setError("");
    setRun({ version: 1, seed: number, mode, player: { ...spawnPoint(number), yaw: 0, pitch: -.15 }, hotbar: [1, 3, 8, 10, 12, 28, 7, 5, 32], stock: { 28: 8 }, edits: [], savedAt: Date.now() });
  }
  function resume() {
    try { const raw = localStorage.getItem(CUBES_SAVE_KEY); if (!raw) { setError("Aucun monde sauvegardé sur cet appareil."); return; } setRun(parseWorldSave(raw)); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Impossible de lire la sauvegarde."); }
  }
  if (run) return <CubesScene initial={run} onExit={() => setRun(null)} />;
  return <div className="h-full min-h-0 overflow-y-auto bg-[#102c28] text-[#f8f2df] selection:bg-[#dcbe7c] selection:text-[#102c28] [&_button]:cursor-pointer [&_button]:transition-colors [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-4 [&_button:focus-visible]:outline-[#efce87] [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-4 [&_a:focus-visible]:outline-[#efce87]">
    <div className="mx-auto flex min-h-full max-w-6xl flex-col px-5 pb-7 pt-6 sm:px-10">
      <nav className="flex items-center justify-between border-b border-[#c9dec6]/15 pb-5 text-xs" aria-label="Navigation du jeu">
        <Link href="/mode-3d" className="flex items-center gap-2 font-bold tracking-wide text-[#c2d4bd] hover:text-white"><span aria-hidden="true">←</span> PIXOLUD <span className="ml-1 font-normal text-[#8fa99b]">/ Mode 3D</span></Link>
        <span className="rounded-full border border-[#c9dec6]/20 px-3 py-1.5 text-[#bfceb5]">Ton monde. Tes règles.</span>
      </nav>
      <div className="grid items-center gap-0 py-6 md:grid-cols-[.95fr_1.05fr] md:py-3">
        <div className="relative z-10 pt-5 md:py-9">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.25em] text-[#d9bd81]"><span className="h-1.5 w-1.5 bg-[#d9bd81]" /> L’aventure, bloc par bloc</p>
          <h1 className="mt-4 text-7xl leading-none font-black tracking-[-.06em] sm:text-8xl lg:text-9xl">{title.replace(/^[^\p{L}\p{N}]+/u, "")}<span className="text-[#e5c581]">.</span></h1>
          <p className="mt-5 max-w-sm text-base leading-7 text-[#c3d3bd]">Une cabane dans les bois. Une cité dans les nuages. <span className="text-[#f5eddb]">Et si tout commençait par un bloc ?</span></p>
          <button onClick={resume} className="mt-7 inline-flex min-h-12 items-center gap-7 rounded-xl border border-[#efd594] bg-[#e8c987] px-5 py-3 text-sm font-bold text-[#26392d] shadow-[0_5px_0_#a98b50] hover:bg-[#f2d998] active:translate-y-0.5 active:shadow-[0_3px_0_#a98b50]">Reprendre mon monde <span aria-hidden="true">→</span></button>
          <div className="mt-6 flex flex-wrap gap-4 text-[11px] text-[#a9bfab]"><span>◇ Monde infini</span><span>◇ 32 blocs à découvrir</span><span>◇ Solo</span></div>
        </div>
        <div className="pointer-events-none -my-4 max-h-[300px] overflow-hidden sm:max-h-[380px] md:-mr-8 md:max-h-none"><CubesLandscape /></div>
      </div>
      <section className="relative mt-auto rounded-2xl border border-[#d8e5c9]/15 bg-[#193830] p-4 sm:p-6" aria-labelledby="cubes-new-world">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 id="cubes-new-world" className="text-xs font-bold uppercase tracking-[.16em] text-[#e4dec6]">Une nouvelle aventure</h2><span className="text-[11px] text-[#a9bda6]">Choisis ta façon de jouer</span></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button onClick={() => create("creatif")} className="group flex items-center gap-4 rounded-xl border border-[#b8cf9f]/20 bg-[#244337] p-4 text-left hover:border-[#c8dba8]/60 hover:bg-[#2d5140] sm:p-5"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#aec780]/10"><CubesBlockIcon id={1} size={45} /></span><span className="flex-1"><strong className="block text-lg text-[#e3ecca]">Créatif</strong><span className="mt-1 block text-xs leading-5 text-[#bed0b3]">Blocs illimités, vol libre.<br />Construis sans limites.</span></span><span aria-hidden="true" className="text-[#b7cba1] transition-transform group-hover:translate-x-1">↗</span></button>
          <button onClick={() => create("survie")} className="group flex items-center gap-4 rounded-xl border border-[#d7b67d]/20 bg-[#343e30] p-4 text-left hover:border-[#d7b67d]/60 hover:bg-[#444c35] sm:p-5"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#e1b86c]/10"><CubesBlockIcon id={28} size={48} /></span><span className="flex-1"><strong className="block text-lg text-[#efdab0]">Survie</strong><span className="mt-1 block text-xs leading-5 text-[#d1c6ab]">Récolte, bâtis ton refuge.<br />Prépare-toi pour la nuit.</span></span><span aria-hidden="true" className="text-[#d7b67d] transition-transform group-hover:translate-x-1">↗</span></button>
        </div>
        <details className="mt-4 text-xs text-[#b9cbb0]"><summary className="w-fit cursor-pointer rounded py-1.5 hover:text-[#f2e4c5] focus-visible:outline-2 focus-visible:outline-[#efce87]">Personnaliser la graine du monde <span className="text-[#8eaa98]">· facultatif</span></summary><label className="mt-3 block" htmlFor="cubes-seed">Un même mot génère le même terrain.</label><input id="cubes-seed" value={seed} onChange={e => setSeed(e.target.value)} maxLength={80} placeholder="Ex. : mon petit paradis" className="mt-2 w-full max-w-md rounded-lg border border-[#b8cf9f]/25 bg-[#102c28] px-3 py-2.5 text-sm text-[#f8f2df] placeholder:text-[#8eaa98] focus:outline-2 focus:outline-[#efce87]" /></details>
      </section>
      {pending && <div role="alert" className="mt-4 rounded-xl border border-[#e4c485]/50 bg-[#3c392b] p-4 text-sm leading-6"><p>Un monde est déjà sauvegardé. Un nouveau monde remplacera cette sauvegarde. Tu peux d’abord reprendre l’ancien et l’exporter.</p><div className="mt-3 flex flex-wrap gap-4"><button onClick={() => create(pending, true)} className="rounded-lg bg-[#e8c987] px-3 py-2 font-bold text-[#26392d]">Remplacer par un nouveau monde</button><button onClick={() => setPending(null)} className="rounded-lg px-3 py-2 hover:bg-white/10">Annuler</button></div></div>}
      {pendingImport && <div role="alert" className="mt-4 rounded-xl border border-[#e4c485]/50 bg-[#3c392b] p-4 text-sm leading-6"><p>Importer ce monde remplacera la sauvegarde actuelle sur cet appareil. Reprends et exporte l’ancien monde si tu veux le conserver.</p><div className="mt-3 flex flex-wrap gap-4"><button onClick={() => { setRun(pendingImport); setPendingImport(null); }} className="rounded-lg bg-[#e8c987] px-3 py-2 font-bold text-[#26392d]">Importer et remplacer</button><button onClick={() => setPendingImport(null)} className="rounded-lg px-3 py-2 hover:bg-white/10">Annuler l’import</button></div></div>}
      {error && <p role="alert" className="mt-4 rounded-lg border border-[#e4c485]/30 bg-[#e4c485]/10 px-4 py-3 text-sm text-[#f0d59c]">{error}</p>}
      <footer className="mt-5 flex flex-wrap items-center justify-between gap-4 text-[11px] leading-5 text-[#9fb59f]">
        <p>Clavier et souris · Sauvegarde sur cet appareil<br /><span className="text-[#7f9b89]">Exporte tes mondes depuis le jeu pour les conserver.</span></p>
        <label className="cursor-pointer rounded-lg border border-[#c9dec6]/20 px-4 py-2.5 font-bold text-[#ccdbc0] transition-colors hover:border-[#c9dec6]/50 hover:bg-white/5 focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-[#efce87]">↑ Importer un monde<input type="file" accept=".json,application/json" className="sr-only" onChange={async e => {
          const file = e.target.files?.[0]; if (!file) return;
          try {
            if (file.size > 5000000) throw new Error("Fichier trop volumineux (5 Mo maximum).");
            const data = parseWorldSave(await file.text());
            let existing = false;
            try { existing = Boolean(localStorage.getItem(CUBES_SAVE_KEY)); } catch { /* Stockage indisponible. */ }
            setPending(null); setError("");
            if (existing) setPendingImport(data); else setRun(data);
          }
          catch (err) { setError(err instanceof Error ? err.message : "Import impossible."); }
          e.target.value = "";
        }} /></label>
      </footer>
    </div>
  </div>;
}
