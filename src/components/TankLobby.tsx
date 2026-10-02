"use client";

import { useState } from "react";
import { TankClassIcon } from "./TankIcons";
import { DIFFICULTIES, MODES, TANK_CLASS_NAMES, tankById, tanksForMode, tierLabel, type BattleMode, type Difficulty, type TankDef } from "@/lib/tanks/tankDefs";
import { MAP_LIST, type MapId } from "@/lib/tanks/tankTerrain";
import { ROOM_MAX } from "@/lib/tanks/tankNet";
import type { RoomMember, RoomSettings, TankRoom } from "@/lib/tanks/tankRoom";

// L'onglet « En ligne » du garage : creer un salon ou en rejoindre un avec son
// code, voir les joueurs et leurs chars, regler la bataille (l'hote), se dire
// pret, lancer. La bataille elle-meme se joue dans TankScene.

/** Le char d'un joueur joue-t-il dans ce mode ? (le char d'admin joue partout) */
export function tankFitsMode(tankId: string, mode: BattleMode): boolean {
  return tanksForMode(mode, true).some((d) => d.id === tankId);
}

/** Equipe d'un joueur : tous ensemble, ou un sur deux de chaque cote (ordre d'arrivee). */
export function memberTeam(index: number, teams: RoomSettings["teams"]): 0 | 1 {
  return teams === "pvp" ? ((index % 2) as 0 | 1) : 0;
}

/** Ce qui manque pour lancer (null : on peut y aller). */
export function launchBlocker(room: TankRoom): string | null {
  const s = room.settings;
  const members = room.members;
  if (members.length < 2) return "Il faut au moins un autre joueur dans le salon.";
  const bad = members.find((m) => !tankFitsMode(m.tankId, s.mode));
  if (bad) return `Le char de ${bad.name} ne joue pas en ${MODES[s.mode].name}.`;
  const size = MODES[s.mode].teamSize;
  if (s.teams === "coop" && members.length > size) return `${size} joueurs au plus ensemble en ${MODES[s.mode].name}.`;
  const waiting = members.find((m) => !m.host && (!m.ready || m.phase !== "salon"));
  if (waiting) return `On attend que ${waiting.name} soit prêt.`;
  return null;
}

function MemberRow({ m, index, teams, me }: { m: RoomMember; index: number; teams: RoomSettings["teams"]; me: string }) {
  const d = tankById(m.tankId);
  const team = memberTeam(index, teams);
  return (
    <li className="flex items-center justify-between gap-2 rounded border border-white/10 bg-white/5 px-2.5 py-2">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate text-sm font-black text-white">
          {teams === "pvp" && <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${team === 0 ? "bg-sky-400" : "bg-orange-400"}`} title={team === 0 ? "Équipe bleue" : "Équipe orange"} />}
          <span className="truncate">{m.name}</span>
          {m.key === me && <span className="text-[10px] font-bold text-zinc-400">(toi)</span>}
          {m.host && <span className="rounded bg-amber-500 px-1 text-[9px] font-black uppercase text-black">Hôte</span>}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-400">
          <span className="font-mono text-amber-300">{tierLabel(d.tier)}</span>
          <TankClassIcon cls={d.cls} className="h-3 w-3 text-zinc-300" />
          {d.name} · {TANK_CLASS_NAMES[d.cls]}
        </p>
      </div>
      <span
        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black uppercase ${
          m.phase === "bataille" ? "bg-red-800 text-white" : m.host || m.ready ? "bg-green-600 text-white" : "bg-white/10 text-zinc-300"
        }`}
      >
        {m.phase === "bataille" ? "En bataille" : m.host ? "Hôte" : m.ready ? "Prêt" : "Pas prêt"}
      </span>
    </li>
  );
}

export default function TankLobby({
  room,
  error,
  myTank,
  myTankOwned,
  onCreate,
  onJoin,
  onLeave,
  onSettings,
  onReady,
  onLaunch,
  onGarage,
}: {
  room: TankRoom | null;
  error: string | null;
  /** Le char choisi au garage. */
  myTank: TankDef;
  myTankOwned: boolean;
  onCreate: () => void;
  onJoin: (code: string) => void;
  onLeave: () => void;
  onSettings: (patch: Partial<RoomSettings>) => void;
  onReady: (ready: boolean) => void;
  onLaunch: () => void;
  onGarage: () => void;
}) {
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  // --- Pas encore de salon : creer ou rejoindre ---
  if (!room || room.status === "ferme") {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="mx-auto grid max-w-3xl gap-3 md:grid-cols-2">
          <section className="rounded-md border border-white/10 bg-black/60 p-4">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-red-400">Créer un salon</h2>
            <p className="mt-2 text-xs leading-relaxed text-zinc-300">
              Tu deviens l&apos;hôte : tu choisis le mode, la carte et les équipes, puis tu donnes le code du salon à tes amis. Jusqu&apos;à {ROOM_MAX} joueurs, les places
              libres sont prises par des bots.
            </p>
            <button
              type="button"
              onClick={onCreate}
              className="mt-3 w-full rounded bg-gradient-to-b from-red-600 to-red-800 py-2.5 text-sm font-black uppercase tracking-widest ring-1 ring-red-400/50 hover:from-red-500"
            >
              Créer un salon
            </button>
          </section>
          <section className="rounded-md border border-white/10 bg-black/60 p-4">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-sky-300">Rejoindre un salon</h2>
            <p className="mt-2 text-xs leading-relaxed text-zinc-300">Entre le code à 5 lettres que t&apos;a donné l&apos;hôte.</p>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                onJoin(code);
              }}
            >
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5))}
                placeholder="ABCDE"
                aria-label="Code du salon"
                className="min-w-0 flex-1 rounded border border-white/15 bg-black/80 px-3 py-2 text-center font-mono text-lg font-black tracking-[0.3em] text-white placeholder:text-zinc-600"
              />
              <button
                type="submit"
                disabled={code.length !== 5}
                className="rounded bg-sky-700 px-4 text-sm font-black uppercase enabled:hover:bg-sky-600 disabled:bg-zinc-700 disabled:text-zinc-400"
              >
                Rejoindre
              </button>
            </form>
          </section>
          {(error || room?.closedReason) && (
            <p className="rounded border border-orange-400/40 bg-orange-950/40 px-3 py-2 text-sm text-orange-200 md:col-span-2">{error ?? room?.closedReason}</p>
          )}
          <p className="text-[11px] leading-relaxed text-zinc-500 md:col-span-2">
            L&apos;hôte fait tourner la bataille sur son appareil : il doit garder la page ouverte (et visible) jusqu&apos;à la fin. Chacun joue avec son propre char, ses modules
            et son commandant, et gagne son XP et ses crédits comme en solo.
          </p>
        </div>
      </div>
    );
  }

  // --- Connexion ---
  if (room.status === "connexion") {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6">
        <p className="text-sm font-bold text-zinc-300">Connexion au salon {room.code}…</p>
        <button type="button" onClick={onLeave} className="rounded border border-white/20 px-4 py-1.5 text-xs font-bold uppercase hover:bg-white/10">
          Annuler
        </button>
      </div>
    );
  }

  // --- Dans le salon ---
  const s = room.settings;
  const me = room.mineInfo;
  const fits = tankFitsMode(myTank.id, s.mode);
  const blocker = room.isHost ? (!fits ? `Ton char ne joue pas en ${MODES[s.mode].name}.` : launchBlocker(room)) : null;
  const [lo, hi] = MODES[s.mode].tiers;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      <div className="mx-auto grid max-w-5xl gap-3 md:grid-cols-[1fr_20rem]">
        <section className="rounded-md border border-white/10 bg-black/60 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Code du salon</p>
              <p className="font-mono text-3xl font-black tracking-[0.35em] text-amber-300">{room.code}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(room.code).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                });
              }}
              className="rounded border border-white/20 px-3 py-1.5 text-xs font-bold uppercase hover:bg-white/10"
            >
              {copied ? "Copié !" : "Copier le code"}
            </button>
          </div>
          <h3 className="mt-3 text-[11px] font-black uppercase tracking-[0.2em] text-zinc-300">
            Joueurs ({room.members.length}/{ROOM_MAX})
          </h3>
          <ul className="mt-1.5 space-y-1.5">
            {room.members.map((m, i) => (
              <MemberRow key={m.key} m={m} index={i} teams={s.teams} me={room.me} />
            ))}
          </ul>
          {room.members.length < 2 && <p className="mt-2 text-xs text-zinc-400">Donne le code à tes amis : ils le tapent dans l&apos;onglet « En ligne ».</p>}
        </section>

        <div className="flex flex-col gap-3">
          <section className="rounded-md border border-white/10 bg-black/60 p-3">
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-300">La bataille</h3>
            {room.isHost ? (
              <div className="mt-2 space-y-2">
                <div className="flex overflow-hidden rounded border border-white/15">
                  {(["normale", "cent"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => onSettings({ mode: m })}
                      className={`flex-1 px-2 py-1.5 text-[10px] font-black uppercase ${s.mode === m ? "bg-red-700 text-white" : "bg-white/5 text-zinc-300 hover:bg-white/10"}`}
                    >
                      {MODES[m].name}
                    </button>
                  ))}
                </div>
                <div className="flex overflow-hidden rounded border border-white/15">
                  {(
                    [
                      ["coop", "Ensemble contre les bots"],
                      ["pvp", "Les uns contre les autres"],
                    ] as const
                  ).map(([t, label]) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => onSettings({ teams: t })}
                      className={`flex-1 px-2 py-1.5 text-[10px] font-black uppercase ${s.teams === t ? "bg-sky-700 text-white" : "bg-white/5 text-zinc-300 hover:bg-white/10"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Carte
                  <select
                    value={s.map}
                    onChange={(e) => onSettings({ map: e.target.value as MapId | "hasard" })}
                    className="mt-1 w-full rounded border border-white/15 bg-black/80 px-2 py-1.5 text-xs font-bold normal-case text-zinc-100"
                  >
                    <option value="hasard">Au hasard</option>
                    {MAP_LIST.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Bots</p>
                  <div className="mt-1 flex overflow-hidden rounded border border-white/15">
                    {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => onSettings({ difficulty: d })}
                        className={`flex-1 px-1.5 py-1.5 text-[10px] font-black uppercase ${s.difficulty === d ? "bg-red-700 text-white" : "bg-white/5 text-zinc-300 hover:bg-white/10"}`}
                      >
                        {DIFFICULTIES[d].name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <ul className="mt-2 space-y-1 text-xs text-zinc-200">
                <li>
                  Mode : <b>{MODES[s.mode].name}</b>
                </li>
                <li>
                  Équipes : <b>{s.teams === "coop" ? "ensemble contre les bots" : "les uns contre les autres"}</b>
                </li>
                <li>
                  Carte : <b>{s.map === "hasard" ? "au hasard" : (MAP_LIST.find((m) => m.id === s.map)?.name ?? s.map)}</b>
                </li>
                <li>
                  Bots : <b>{DIFFICULTIES[s.difficulty].name}</b>
                </li>
              </ul>
            )}
            <p className="mt-2 text-[10px] text-zinc-500">
              Chars de rang {tierLabel(lo)} à {tierLabel(hi)} · {MODES[s.mode].teamSize} contre {MODES[s.mode].teamSize}
            </p>
          </section>

          <section className="rounded-md border border-white/10 bg-black/60 p-3">
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-300">Ton char</h3>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm font-black text-white">
              <span className="font-mono text-amber-300">{tierLabel(myTank.tier)}</span>
              <TankClassIcon cls={myTank.cls} className="h-3.5 w-3.5 text-zinc-300" />
              {myTank.name}
            </p>
            {!fits || !myTankOwned ? (
              <p className="mt-1 text-[11px] text-orange-300">
                {!myTankOwned ? "Tu ne possèdes pas encore ce char." : `Ce char ne joue pas en ${MODES[s.mode].name} : prends un char de rang ${tierLabel(lo)} à ${tierLabel(hi)}.`}
              </p>
            ) : null}
            <button type="button" onClick={onGarage} className="mt-1 text-[11px] text-sky-300 underline hover:text-sky-200">
              Changer de char au garage
            </button>
          </section>

          {room.isHost ? (
            <>
              <button
                type="button"
                disabled={blocker !== null || !myTankOwned}
                onClick={onLaunch}
                className="rounded bg-gradient-to-b from-red-600 to-red-800 py-3 text-base font-black uppercase tracking-[0.2em] ring-1 ring-red-400/60 enabled:hover:from-red-500 disabled:from-zinc-700 disabled:to-zinc-800 disabled:text-zinc-400 disabled:ring-white/10"
              >
                Lancer la bataille
              </button>
              {blocker && <p className="-mt-1.5 text-center text-[11px] text-zinc-400">{blocker}</p>}
            </>
          ) : (
            <button
              type="button"
              disabled={!fits || !myTankOwned}
              onClick={() => onReady(!me.ready)}
              className={`rounded py-3 text-base font-black uppercase tracking-[0.2em] ring-1 disabled:bg-zinc-700 disabled:text-zinc-400 disabled:ring-white/10 ${
                me.ready ? "bg-green-600 ring-green-300/60 hover:bg-green-500" : "bg-white/10 ring-white/20 hover:bg-white/20"
              }`}
            >
              {me.ready ? "Prêt ✓" : "Je suis prêt"}
            </button>
          )}
          <button type="button" onClick={onLeave} className="rounded border border-white/20 py-1.5 text-xs font-bold uppercase hover:bg-white/10">
            Quitter le salon
          </button>
        </div>
      </div>
    </div>
  );
}
