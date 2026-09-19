"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { pollMyNotices, type Notice } from "@/app/messages/actions";
import { guestNumber } from "@/lib/guest";
import { setOnlinePlayers, setPinger, type OnlinePlayer } from "@/lib/livePresence";

/**
 * Present sur toutes les pages, pour tous les visiteurs :
 *  - se signale « en ligne » (compte, ou invite avec son numero) ;
 *  - affiche les messages de l'equipe : avertissement, message, screamer.
 *
 * Les messages sont lus cote serveur (pollMyNotices). Le canal temps reel ne
 * transporte qu'un « toc-toc » sans contenu : meme falsifie, il ne peut que
 * declencher une relecture.
 */

const CHANNEL = "pixolud-en-ligne";
/** Relecture de secours, au cas ou le toc-toc se perd. */
const POLL_MS = 90_000;

function whereFor(path: string) {
  const m = /^\/mode-3d\/([^/]+)/.exec(path);
  if (!m) return "Site";
  const names: Record<string, string> = {
    "duel-1v1": "Duel",
    "manoir-maudit": "Manoir Maudit",
    backrooms: "Backrooms",
    cubes: "Cubes",
    "labyrinthe-legendaire": "Labyrinthe",
  };
  return `En jeu : ${names[m[1]] ?? m[1]}`;
}

export default function SiteLive({ me }: { me: { id: string; pseudo: string } | null }) {
  const pathname = usePathname();
  const [queue, setQueue] = useState<Notice[]>([]);
  const [guest, setGuest] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  // Le numero d'invite vit dans le navigateur : on le lit apres le montage.
  useEffect(() => {
    const t = setTimeout(() => setGuest(me ? null : guestNumber()), 0);
    return () => clearTimeout(t);
  }, [me]);

  const myKey = me ? `u:${me.id}` : guest ? `g:${guest}` : null;

  const poll = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    const list = await pollMyNotices(me ? undefined : (guest ?? undefined));
    if (list.length) setQueue((q) => [...q, ...list]);
  }, [me, guest]);

  // Presence + toc-toc.
  useEffect(() => {
    if (!myKey) return;
    const supabase = createClient();
    const channel = supabase.channel(CHANNEL, { config: { presence: { key: myKey }, broadcast: { self: false } } });
    channelRef.current = channel;
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<Omit<OnlinePlayer, "key">>();
        const list: OnlinePlayer[] = Object.entries(state).map(([key, metas]) => {
          const m = metas[metas.length - 1];
          return {
            key,
            name: String(m?.name ?? "?").slice(0, 30),
            guest: m?.guest === true,
            userId: typeof m?.userId === "string" ? m.userId : null,
            guestNum: typeof m?.guestNum === "string" ? m.guestNum : null,
            where: String(m?.where ?? "Site").slice(0, 40),
          };
        });
        setOnlinePlayers(list);
      })
      .on("broadcast", { event: "toc" }, ({ payload }: { payload: { key?: string } }) => {
        if (payload?.key === myKey) void poll();
      })
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          channel.track({
            name: me?.pseudo ?? `Joueur ${guest}`,
            guest: !me,
            userId: me?.id ?? null,
            guestNum: me ? null : guest,
            where: whereFor(window.location.pathname),
          });
        }
      });
    setPinger((key) => {
      channel.send({ type: "broadcast", event: "toc", payload: { key } });
    });
    return () => {
      setPinger(null);
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [myKey, me, guest, poll]);

  // Ou il est : mis a jour a chaque changement de page.
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !myKey) return;
    channel.track({
      name: me?.pseudo ?? `Joueur ${guest}`,
      guest: !me,
      userId: me?.id ?? null,
      guestNum: me ? null : guest,
      where: whereFor(pathname),
    });
  }, [pathname, myKey, me, guest]);

  // Relecture de secours.
  useEffect(() => {
    if (!myKey) return;
    const first = setTimeout(() => void poll(), 1500);
    const iv = setInterval(() => void poll(), POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
    };
  }, [myKey, poll]);

  const current = queue[0] ?? null;
  const next = () => setQueue((q) => q.slice(1));
  if (!current) return null;
  if (current.kind === "screamer") return <Screamer onDone={next} />;
  const warn = current.kind === "avertissement";
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true">
      <div
        className={`w-full max-w-md rounded-2xl border p-6 text-center text-white shadow-2xl ${
          warn ? "border-amber-400/60 bg-[#241a08]" : "border-violet-400/50 bg-[#15122a]"
        }`}
      >
        <p className="text-5xl" aria-hidden="true">
          {warn ? "⚠️" : "📢"}
        </p>
        <h2 className="mt-3 text-xl font-extrabold">{warn ? "Avertissement de l'équipe Pixolud" : "Message de l'équipe Pixolud"}</h2>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-200">{current.message}</p>
        {warn && <p className="mt-3 text-[11px] text-amber-200/80">Cet avertissement est visible sur ton profil.</p>}
        <button type="button" onClick={next} className="mt-5 rounded-xl bg-white px-6 py-2.5 text-sm font-extrabold text-black hover:bg-zinc-200">
          J&apos;ai compris
        </button>
      </div>
    </div>
  );
}

/**
 * Le screamer : un visage qui surgit avec un cri, puis s'efface. Pas de
 * flash ni de clignotement (risque pour les personnes photosensibles), et un
 * clic le ferme tout de suite.
 */
export function Screamer({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"cri" | "fin">("cri");

  useEffect(() => {
    // Le cri, synthetise : bruit + voix qui descend. Le navigateur peut le
    // bloquer si la page n'a jamais ete touchee ; le visage suffit alors.
    let ctx: AudioContext | null = null;
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        ctx = new AC();
        const now = ctx.currentTime;
        const master = ctx.createGain();
        master.gain.setValueAtTime(0.0001, now);
        master.gain.exponentialRampToValueAtTime(0.55, now + 0.03);
        master.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
        master.connect(ctx.destination);
        for (const [type, from, to] of [
          ["sawtooth", 880, 180],
          ["square", 620, 140],
        ] as const) {
          const o = ctx.createOscillator();
          o.type = type;
          o.frequency.setValueAtTime(from, now);
          o.frequency.exponentialRampToValueAtTime(to, now + 1.4);
          o.connect(master);
          o.start(now);
          o.stop(now + 1.5);
        }
        const len = Math.floor(ctx.sampleRate * 1.2);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const noise = ctx.createBufferSource();
        noise.buffer = buf;
        const ng = ctx.createGain();
        ng.gain.value = 0.35;
        noise.connect(ng);
        ng.connect(master);
        noise.start(now);
      }
    } catch {
      // ignore
    }
    const t1 = setTimeout(() => setPhase("fin"), 1900);
    return () => {
      clearTimeout(t1);
      ctx?.close().catch(() => {});
    };
  }, []);

  if (phase === "fin") {
    return (
      <button
        type="button"
        onClick={onDone}
        className="fixed bottom-6 left-1/2 z-[200] -translate-x-1/2 rounded-full bg-black/85 px-5 py-2.5 text-sm font-bold text-white shadow-2xl"
      >
        😈 Screamer offert par l&apos;équipe Pixolud — ✕
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setPhase("fin")}
      aria-label="Screamer"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black"
      style={{ animation: "pixolud-scream 0.12s linear infinite" }}
    >
      <style>{`@keyframes pixolud-scream{0%{transform:translate(0,0) scale(1.02)}25%{transform:translate(-6px,4px) scale(1.04)}50%{transform:translate(5px,-5px) scale(1.03)}75%{transform:translate(-4px,-3px) scale(1.05)}100%{transform:translate(0,0) scale(1.02)}}@keyframes pixolud-scream-in{from{transform:scale(0.25)}to{transform:scale(1)}}`}</style>
      <svg viewBox="0 0 200 240" className="h-[92vh] max-w-[92vw]" style={{ animation: "pixolud-scream-in 0.18s ease-out" }} aria-hidden="true">
        <defs>
          <radialGradient id="peau" cx="0.5" cy="0.4" r="0.6">
            <stop offset="0" stopColor="#e6e1d3" />
            <stop offset="0.7" stopColor="#8f8a7c" />
            <stop offset="1" stopColor="#2a2723" />
          </radialGradient>
          <radialGradient id="trou" cx="0.5" cy="0.4" r="0.6">
            <stop offset="0" stopColor="#000" />
            <stop offset="1" stopColor="#1a0505" />
          </radialGradient>
        </defs>
        <ellipse cx="100" cy="118" rx="84" ry="108" fill="url(#peau)" />
        <path d="M18 70 Q40 10 100 8 Q160 10 182 70 Q150 40 100 42 Q50 40 18 70Z" fill="#141210" />
        <ellipse cx="64" cy="96" rx="22" ry="27" fill="url(#trou)" />
        <ellipse cx="136" cy="96" rx="22" ry="27" fill="url(#trou)" />
        <circle cx="64" cy="100" r="4" fill="#ff2a1a" style={{ filter: "drop-shadow(0 0 6px #ff2a1a)" }} />
        <circle cx="136" cy="100" r="4" fill="#ff2a1a" style={{ filter: "drop-shadow(0 0 6px #ff2a1a)" }} />
        <path d="M52 66 L80 78 M148 66 L120 78" stroke="#1d1a17" strokeWidth="6" strokeLinecap="round" />
        <path d="M94 118 L100 134 L106 118" fill="#3a352e" />
        <ellipse cx="100" cy="180" rx="36" ry="46" fill="url(#trou)" />
        <path d="M70 160 L78 172 L86 160 L94 174 L100 160 L106 174 L114 160 L122 172 L130 160" fill="#e9e4d2" />
        <path d="M76 206 L84 196 L92 208 L100 196 L108 208 L116 196 L124 206" fill="#e9e4d2" />
        <path d="M40 150 Q52 160 56 176 M160 150 Q148 160 144 176" stroke="#5e584d" strokeWidth="3" fill="none" />
      </svg>
    </button>
  );
}
