"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { spawnPoint, type SavedWorld } from "@/lib/voxel";
import { CUBES_SAVE_KEY, parseWorldSave } from "@/lib/voxelSave";

const CubesScene = dynamic(() => import("./CubesScene"), { ssr: false, loading: () => <div className="flex h-full items-center justify-center bg-slate-950 text-white">Chargement de Cubes…</div> });

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
  return <div className="relative flex h-full min-h-0 items-center justify-center overflow-y-auto bg-gradient-to-br from-emerald-950 via-slate-950 to-slate-900 p-6 text-white">
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden opacity-20"><div className="absolute -right-16 top-12 h-80 w-80 rotate-12 rounded-[4rem] border border-emerald-200/40 bg-gradient-to-br from-emerald-400 to-transparent" /><div className="absolute -left-20 bottom-12 h-60 w-60 -rotate-12 rounded-[3rem] border border-amber-200/30 bg-gradient-to-tr from-amber-300/30 to-transparent" /></div>
    <Link href="/mode-3d" className="absolute left-4 top-4 text-sm text-emerald-200">← Mode 3D</Link>
    <div className="relative my-auto w-full max-w-2xl py-12">
      <p className="text-xs font-bold uppercase tracking-[.35em] text-emerald-300">Explore · Récolte · Construis</p>
      <h1 className="mt-3 text-5xl font-black tracking-tight">{title}</h1>
      <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-300">Des forêts, des grottes et des montagnes. Un monde de blocs à transformer, une construction après l’autre.</p>
      <label className="mt-7 block text-sm text-slate-300" htmlFor="cubes-seed">Graine du monde <span className="text-slate-500">· facultatif</span></label>
      <input id="cubes-seed" value={seed} onChange={e => setSeed(e.target.value)} maxLength={80} placeholder="Un mot pour retrouver le même terrain" className="mt-2 w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3" />
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button onClick={() => create("creatif")} className="rounded-2xl border border-emerald-300/40 bg-emerald-400/10 p-5 text-left hover:bg-emerald-400/20"><strong className="text-xl text-emerald-200">Créatif</strong><span className="mt-2 block text-sm text-slate-300">Blocs illimités, vol libre et construction paisible.</span></button>
        <button onClick={() => create("survie")} className="rounded-2xl border border-amber-300/40 bg-amber-400/10 p-5 text-left hover:bg-amber-400/20"><strong className="text-xl text-amber-200">Survie</strong><span className="mt-2 block text-sm text-slate-300">Récolte tes blocs, construis un abri et repousse les zombies.</span></button>
      </div>
      {pending && <div role="alert" className="mt-4 rounded-xl border border-amber-300/40 p-4 text-sm"><p>Un monde est déjà sauvegardé. Un nouveau monde remplacera cette sauvegarde. Tu peux d’abord reprendre l’ancien et l’exporter.</p><div className="mt-3 flex gap-4"><button onClick={() => create(pending, true)} className="font-bold text-amber-200">Remplacer par un nouveau monde</button><button onClick={() => setPending(null)}>Annuler</button></div></div>}
      {pendingImport && <div role="alert" className="mt-4 rounded-xl border border-amber-300/40 p-4 text-sm"><p>Importer ce monde remplacera la sauvegarde actuelle sur cet appareil. Reprends et exporte l’ancien monde si tu veux le conserver.</p><div className="mt-3 flex gap-4"><button onClick={() => { setRun(pendingImport); setPendingImport(null); }} className="font-bold text-amber-200">Importer et remplacer</button><button onClick={() => setPendingImport(null)}>Annuler l’import</button></div></div>}
      <div className="mt-5 flex flex-wrap items-center gap-4"><button onClick={resume} className="rounded-xl bg-emerald-300 px-5 py-3 font-bold text-slate-950">Reprendre mon monde</button>
        <label className="cursor-pointer rounded-xl border border-white/20 px-4 py-3 text-sm">Importer un monde<input type="file" accept=".json,application/json" className="sr-only" onChange={async e => {
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
      </div>
      {error && <p role="alert" className="mt-4 text-amber-200">{error}</p>}
      <p className="mt-6 text-xs leading-5 text-slate-400">Solo · Clavier et souris · Sauvegarde sur cet appareil<br />Les exports permettent de conserver et de transférer tes mondes. Aucun compte requis.</p>
    </div>
  </div>;
}
