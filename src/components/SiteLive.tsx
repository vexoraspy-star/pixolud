"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Screamer from "./Screamer";
export { Screamer };
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
  const [noticeIndex, setNoticeIndex] = useState(0);
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
  const next = () => { setQueue((q) => q.slice(1)); setNoticeIndex(n => n + 1); };
  if (!current) return null;
  if (current.kind === "screamer") return <Screamer key={noticeIndex} onDone={next} />;
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
