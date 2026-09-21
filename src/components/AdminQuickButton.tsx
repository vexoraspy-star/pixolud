"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ScreamerGallery from "./ScreamerGallery";
import {
  banUser,
  confirmEmail,
  deleteGame,
  deleteUser,
  getAdminPanelData,
  renameUser,
  sendGift,
  sendNotice,
  sendNoticeToAll,
  createAccount,
  deleteComment,
  setAdminRole,
  setCheatGames,
  setGamePublished,
  setPassword,
  setReportStatus,
  setTier,
  setVerified,
  unbanUser,
  type AdminResult,
} from "@/app/admin/actions";
import type { AdminData, AdminUser } from "./AdminPanel";
import { giveCubes, giveDuel } from "@/lib/adminGive";
import { pingPlayer, subscribeOnline, type OnlinePlayer } from "@/lib/livePresence";

/**
 * Bouton 🛡 flottant (admins seulement, verifie cote serveur par le layout)
 * et sa fenetre « Admin Panel », facon panneau de jeu : on la deplace a la
 * souris, elle s'ouvre par-dessus la page ou le jeu en cours. Toutes les
 * actions revérifient le droit admin cote serveur.
 */

type View =
  | "triches"
  | "give"
  | "annonce"
  | "enligne"
  | "joueurs"
  | "creer"
  | "bannis"
  | "jeux"
  | "commentaires"
  | "signalements"
  | "journal";

const NAV: { id: View; icon: string; label: string }[] = [
  { id: "triches", icon: "🎮", label: "Triches" },
  { id: "give", icon: "🎁", label: "Give" },
  { id: "annonce", icon: "📣", label: "Annonce" },
  { id: "enligne", icon: "🟢", label: "En ligne" },
  { id: "joueurs", icon: "👥", label: "Joueurs" },
  { id: "creer", icon: "➕", label: "Créer" },
  { id: "bannis", icon: "⛔", label: "Bannis" },
  { id: "jeux", icon: "🕹️", label: "Jeux" },
  { id: "commentaires", icon: "💬", label: "Commentaires" },
  { id: "signalements", icon: "🚩", label: "Signalements" },
  { id: "journal", icon: "📜", label: "Journal" },
];

const TIERS: Record<string, string> = { free: "Gratuit", standard: "Standard", max: "Max" };

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

/** Date courte, ou « — » si la valeur manque. */
function jour(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });
}

function makePassword() {
  const words = ["pixel", "cube", "fusee", "dragon", "etoile", "robot", "comete", "tigre", "vague", "orage", "lynx", "nova"];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  return `${pick()}-${pick()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

const tile =
  "admin-tile flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-2 text-xs font-bold text-white transition hover:border-violet-400/70 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-40";
const field = "admin-field min-h-9 w-full rounded-lg border border-white/10 bg-black/40 px-2.5 text-xs text-white outline-none focus:border-violet-400";

function Switch({ on, onClick, disabled, label }: { on: boolean; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`admin-switch relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${on ? "bg-fuchsia-500" : "bg-white/15"}`}
    >
      <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? "left-5" : "left-0.5"}`} />
    </button>
  );
}

export default function AdminQuickButton({
  games,
  enabled,
  initialData = null,
}: {
  games: { slug: string; label: string }[];
  enabled: string[];
  /** Donnees deja chargees (sinon lues a l'ouverture de la fenetre). */
  initialData?: AdminData | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("triches");
  const [data, setData] = useState<AdminData | null>(initialData);
  const [loadError, setLoadError] = useState(false);
  const [cheats, setCheats] = useState<string[]>(enabled);
  const [toast, setToast] = useState<AdminResult | null>(null);
  const [pending, start] = useTransition();
  // Position de la fenetre (null = centree) et glisser par la barre de titre.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const win = useRef<HTMLDivElement>(null);

  const slug = /^\/mode-3d\/([^/]+)$/.exec(pathname)?.[1] ?? null;
  const game = games.find((g) => g.slug === slug) ?? null;
  const gameOn = game ? enabled.includes(game.slug) : false;

  function load() {
    start(async () => {
      const d = await getAdminPanelData();
      setData(d);
      setLoadError(d === null);
    });
  }

  useEffect(() => {
    if (open && !data) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Raccourci Alt+A : ouvrir ou fermer la fenetre, meme en pleine partie.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === "KeyA") {
        e.preventDefault();
        e.stopPropagation();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  /** Une action : message, puis donnees fraiches. */
  function act(run: () => Promise<AdminResult>) {
    start(async () => {
      const r = await run();
      setToast(r);
      if (r.ok) setData(await getAdminPanelData());
    });
  }

  function saveCheats(next: string[]) {
    start(async () => {
      const r = await setCheatGames(next);
      if (!r.ok) {
        setToast(r);
        return;
      }
      setCheats(next);
      setToast(r);
      // Pas de rechargement : on ne sort pas de la partie. Le serveur renvoie
      // le nouveau droit au jeu, qui le lit en direct.
      router.refresh();
    });
  }

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("button, a")) return;
    const rect = win.current?.getBoundingClientRect();
    if (!rect) return;
    drag.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current || !win.current) return;
    const w = win.current.offsetWidth;
    const h = win.current.offsetHeight;
    setPos({
      x: Math.min(Math.max(8, e.clientX - drag.current.dx), window.innerWidth - w - 8),
      y: Math.min(Math.max(8, e.clientY - drag.current.dy), window.innerHeight - h - 8),
    });
  }
  function onPointerUp() {
    drag.current = null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Admin Panel"
        title="Admin Panel"
        className={`admin-launcher fixed left-2 top-1/2 z-[90] flex size-10 -translate-y-1/2 items-center justify-center rounded-xl border text-lg shadow-lg backdrop-blur transition ${
          gameOn
            ? "border-fuchsia-300 bg-fuchsia-600/90"
            : open
              ? "border-violet-300 bg-violet-600/90"
              : "border-white/20 bg-black/60 opacity-70 hover:opacity-100"
        }`}
      >
        🛡️
      </button>

      {open && (
        <div
          ref={win}
          role="dialog"
          aria-label="Admin Panel"
          // Les touches tapees ici ne doivent pas piloter le jeu en dessous.
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") setOpen(false); }}
          onKeyUp={(e) => e.stopPropagation()}
          style={pos ? { left: pos.x, top: pos.y } : undefined}
          className={`admin-window fixed z-[95] flex h-[min(580px,calc(100dvh-24px))] w-[min(780px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0e0f15]/95 text-white shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl ${
            pos ? "" : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          }`}
        >
          {/* Barre de titre : on attrape la fenetre par ici */}
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="admin-window-heading flex cursor-move select-none items-center gap-2.5 border-b border-white/10 bg-gradient-to-r from-violet-600/30 to-fuchsia-600/10 px-4 py-2.5"
          >
            <span className="admin-heading-emblem">🛡️</span>
            <div className="admin-heading-copy"><span>ESPACE DE CONTRÔLE</span><h2>Administration</h2></div>
            {pending && <span className="text-[10px] font-semibold text-violet-300">chargement…</span>}
            <button
              type="button"
              onClick={load}
              disabled={pending}
              title="Recharger les données"
              aria-label="Recharger les données"
              className="ml-auto rounded-md px-2 py-1 text-sm text-zinc-300 hover:bg-white/10 hover:text-white disabled:opacity-40"
            >
              🔄
            </button>
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              title="Ouvrir le panneau complet"
              className="admin-expand rounded-md px-2 py-1 text-xs font-bold text-zinc-300 hover:bg-white/10 hover:text-white"
            >
              Plein écran ↗
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              className="utility-close rounded-md px-2 py-1 text-lg leading-none text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="admin-window-body flex min-h-0 flex-1">
            {/* Menu de gauche */}
            <aside className="admin-sidebar flex w-40 shrink-0 flex-col border-r border-white/10 bg-black/25 p-3">
              <div className="admin-identity flex items-center gap-2.5 pb-3">
                <span className="admin-avatar">
                  {initials(data?.me.pseudo ?? "AD")}
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block text-[10px] text-zinc-400">Bienvenue,</span>
                  <b className="block truncate text-sm">{data?.me.pseudo ?? "…"}</b>
                </span>
              </div>
              <nav className="admin-sidebar-nav flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
                {NAV.map((n) => {
                  const count =
                    n.id === "bannis"
                      ? data?.users.filter((u) => u.banned).length
                      : n.id === "signalements"
                        ? data?.reports.filter((r) => r.status === "ouvert").length
                        : undefined;
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        setView(n.id);
                        setToast(null);
                      }}
                      aria-current={view === n.id ? "page" : undefined}
                      className={`admin-nav-item flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-bold transition ${
                        view === n.id ? "bg-violet-600 text-white" : "text-zinc-300 hover:bg-white/10"
                      }`}
                    >
                      <span aria-hidden="true">{n.icon}</span>
                      {n.label}
                      {count ? <span className="ml-auto rounded-full bg-red-500 px-1.5 text-[10px]">{count}</span> : null}
                    </button>
                  );
                })}
              </nav>
              <div className="pt-3">
                {data && (
                  <p className="mb-1 text-[10px] leading-relaxed text-zinc-500">
                    👥 {data.users.length} joueur{data.users.length > 1 ? "s" : ""}
                    <br />
                    🕹️ {data.games.length} jeu{data.games.length > 1 ? "x" : ""}
                  </p>
                )}
                <p className="admin-sidebar-footer text-[10px] text-zinc-500">✣ Pixolud · Alt+A</p>
              </div>
            </aside>

            {/* Contenu */}
            <section className="admin-content min-w-0 flex-1 overflow-y-auto p-4">
              {loadError && (
                <p className="rounded-lg bg-red-500/15 p-3 text-xs text-red-200">
                  Impossible de charger les données : vérifie la clé secrète sur Vercel, ou ouvre le panneau complet.
                </p>
              )}
              {view === "triches" && (
                <CheatsView games={games} current={game?.slug ?? null} cheats={cheats} pending={pending} save={saveCheats} />
              )}
              {view === "give" && <GiveView data={data} act={act} pending={pending} say={setToast} />}
              {view === "annonce" && <AnnounceView me={data?.me.id ?? null} act={act} pending={pending} />}
              {view === "enligne" && <OnlineView me={data?.me.id ?? null} act={act} pending={pending} />}
              {data && view === "joueurs" && <PlayersView data={data} act={act} pending={pending} />}
              {data && view === "bannis" && <BannedView data={data} act={act} pending={pending} />}
              {data && view === "jeux" && <GamesView data={data} act={act} pending={pending} />}
              {data && view === "signalements" && <ReportsView data={data} act={act} pending={pending} />}
              {data && view === "creer" && <CreateView act={act} pending={pending} />}
              {data && view === "commentaires" && <CommentsView data={data} act={act} pending={pending} />}
              {data && view === "journal" && <LogView data={data} />}
              {!data && !loadError && !["triches", "give", "annonce", "enligne"].includes(view) && (
                <p className="text-xs text-zinc-400">Chargement…</p>
              )}
            </section>
          </div>

          {toast && (
            <div
              role="status"
              className={`flex items-center gap-2 border-t border-white/10 px-4 py-2 text-xs font-semibold ${toast.ok ? "text-emerald-300" : "text-red-300"}`}
            >
              <span className="min-w-0 flex-1">{toast.message}</span>
              <button type="button" onClick={() => setToast(null)} aria-label="Fermer le message" className="text-zinc-400 hover:text-white">
                ✕
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

type ActProps = { act: (run: () => Promise<AdminResult>) => void; pending: boolean };

// ------------------------------------------------------------------ triches

function CheatsView({
  games,
  current,
  cheats,
  pending,
  save,
}: {
  games: { slug: string; label: string }[];
  current: string | null;
  cheats: string[];
  pending: boolean;
  save: (next: string[]) => void;
}) {
  const toggle = (slug: string) => save(cheats.includes(slug) ? cheats.filter((s) => s !== slug) : [...cheats, slug]);
  const here = games.find((g) => g.slug === current);
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-extrabold">Mode triche</h3>
      {here ? (
        <div className="rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/10 p-3">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-300">Jeu en cours</p>
              <p className="text-sm font-bold">{here.label}</p>
            </div>
            <Switch on={cheats.includes(here.slug)} disabled={pending} onClick={() => toggle(here.slug)} label={`Triches dans ${here.label}`} />
          </div>
          <p className="mt-2 text-[11px] text-zinc-300">
            {cheats.includes(here.slug)
              ? "Actif : en partie, touche F2 pour ouvrir le menu de triche."
              : "Active-le, tu restes dans ta partie : ensuite F2 ouvre le menu de triche."}
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-zinc-400">Ouvre le Manoir, les Backrooms ou le Duel pour activer la triche du jeu en cours. Tu peux aussi les régler ici :</p>
      )}
      <ul className="space-y-1.5">
        {games
          .filter((g) => g.slug !== current)
          .map((g) => (
            <li key={g.slug} className="admin-game-setting flex items-center gap-3 rounded-lg bg-white/[0.05] px-3 py-2">
              <span className="min-w-0 flex-1 text-xs font-bold">{g.label}</span>
              <Switch on={cheats.includes(g.slug)} disabled={pending} onClick={() => toggle(g.slug)} label={`Triches dans ${g.label}`} />
            </li>
          ))}
      </ul>
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" disabled={pending} onClick={() => save(games.map((g) => g.slug))} className={tile}>
          ✅ Tout activer
        </button>
        <button type="button" disabled={pending} onClick={() => save([])} className={tile}>
          🚫 Tout couper
        </button>
      </div>
      <p className="text-[10px] text-zinc-500">Réglage de ce navigateur. En ligne contre de vrais joueurs, la triche reste toujours coupée.</p>
    </div>
  );
}

// --------------------------------------------------------------------- give

function GiveView({
  data,
  act,
  pending,
  say,
}: { data: AdminData | null; say: (r: AdminResult) => void } & ActProps) {
  const [busy, setBusy] = useState(false);
  const [to, setTo] = useState("");
  const [kind, setKind] = useState<"pieces" | "xp" | "tout">("pieces");
  const [amount, setAmount] = useState(1000);
  const [message, setMessage] = useState("");

  /** Give pour soi : immediat, sur cet appareil, meme en pleine partie. */
  async function self(run: () => Promise<string>) {
    setBusy(true);
    try {
      say({ ok: true, message: await run() });
    } catch {
      say({ ok: false, message: "Le give a échoué." });
    } finally {
      setBusy(false);
    }
  }

  const players = (data?.users ?? []).filter((u) => u.id !== data?.me.id);
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-extrabold">Pour moi</h3>
        <p className="text-[10px] text-zinc-400">Tout de suite, sur cet appareil, sans quitter ta partie.</p>
        <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Duel</p>
        <div className="mt-1 grid grid-cols-3 gap-1.5">
          <button type="button" disabled={busy} onClick={() => self(() => giveDuel({ coins: 1_000 }))} className={tile}>
            🪙 +1 000
          </button>
          <button type="button" disabled={busy} onClick={() => self(() => giveDuel({ coins: 10_000 }))} className={tile}>
            🪙 +10 000
          </button>
          <button type="button" disabled={busy} onClick={() => self(() => giveDuel({ coins: 100_000 }))} className={tile}>
            🪙 +100 000
          </button>
          <button type="button" disabled={busy} onClick={() => self(() => giveDuel({ xp: 5_000 }))} className={tile}>
            ⭐ +5 000 XP
          </button>
          <button type="button" disabled={busy} onClick={() => self(() => giveDuel({ xp: 50_000 }))} className={tile}>
            ⭐ +50 000 XP
          </button>
          <button type="button" disabled={busy} onClick={() => self(() => giveDuel({ all: true }))} className={tile}>
            🔓 Tout débloquer
          </button>
        </div>
        <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Cubes (survie)</p>
        <div className="mt-1 grid grid-cols-3 gap-1.5">
          <button type="button" disabled={busy} onClick={() => self(() => giveCubes(64))} className={tile}>
            🧱 +64 de chaque
          </button>
          <button type="button" disabled={busy} onClick={() => self(() => giveCubes(999))} className={tile}>
            🧱 +999 de chaque
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
        <h3 className="text-sm font-extrabold">Offrir à un joueur</h3>
        <p className="text-[10px] text-zinc-400">Il le reçoit en ouvrant le Duel, sur n&apos;importe quel appareil.</p>
        {!data ? (
          <p className="mt-2 text-[11px] text-zinc-400">Chargement des joueurs…</p>
        ) : (
          <div className="mt-2 space-y-2">
            <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="Joueur" className={field}>
              <option value="">Choisir un joueur…</option>
              {players.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.pseudo}
                </option>
              ))}
            </select>
            <div className="flex gap-1.5">
              {(
                [
                  ["pieces", "🪙 Pièces"],
                  ["xp", "⭐ XP"],
                  ["tout", "🔓 Tout débloquer"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  aria-pressed={kind === k}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-bold ${kind === k ? "bg-violet-600" : "bg-white/10 hover:bg-white/20"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {kind !== "tout" && (
              <input
                type="number"
                min={1}
                max={1000000}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                aria-label="Montant"
                className={field}
              />
            )}
            <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Petit mot (facultatif)" aria-label="Message" className={field} />
            <button
              type="button"
              disabled={pending || !to}
              onClick={() => act(() => sendGift(to, kind, amount, message))}
              className="w-full rounded-lg bg-gradient-to-r from-amber-400 to-rose-500 py-2 text-xs font-extrabold text-black disabled:opacity-40"
            >
              🎁 Envoyer le cadeau
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------- messages

/** Avertir, ecrire ou faire peur : envoye cote serveur, puis « toc-toc » au joueur. */
function NoticeButtons({
  target,
  pingKey,
  name,
  act,
  pending,
}: { target: { userId?: string; guest?: string }; pingKey: string; name: string } & ActProps) {
  function send(kind: "avertissement" | "message" | "screamer") {
    let text = "";
    if (kind !== "screamer") {
      const typed = window.prompt(kind === "avertissement" ? `Avertissement pour ${name} :` : `Message pour ${name} :`);
      if (!typed || !typed.trim()) return;
      text = typed;
    }
    act(async () => {
      const r = await sendNotice(target, kind, text);
      if (r.ok) pingPlayer(pingKey);
      return r;
    });
  }
  return (
    <div className="grid grid-cols-3 gap-1.5">
      <button type="button" disabled={pending} onClick={() => send("avertissement")} className={tile}>
        ⚠️ Avertir
      </button>
      <button type="button" disabled={pending} onClick={() => send("message")} className={tile}>
        📢 Message
      </button>
      <button type="button" disabled={pending} onClick={() => send("screamer")} className={tile}>
        😱 Screamer
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- annonce

/**
 * Parler a tout le monde d'un coup, et surtout : s'envoyer l'effet a soi-meme
 * pour voir ce que ca donne avant de le faire subir aux autres.
 */
function AnnounceView({ me, act, pending }: { me: string | null } & ActProps) {
  const [texte, setTexte] = useState("");
  const [players, setPlayers] = useState<OnlinePlayer[]>([]);
  useEffect(() => subscribeOnline(setPlayers), []);
  const invites = players.map((p) => p.guestNum).filter((n): n is string => !!n);

  function tous(kind: "avertissement" | "message" | "screamer") {
    const message = texte.trim();
    if (kind !== "screamer" && !message) return;
    const quoi = kind === "avertissement" ? "un avertissement" : kind === "screamer" ? "un SCREAMER" : "une annonce";
    if (!window.confirm(`Envoyer ${quoi} à TOUS les joueurs du site ?`)) return;
    act(async () => {
      const r = await sendNoticeToAll(kind, message, invites);
      if (r.ok) {
        setTexte("");
        for (const p of players) pingPlayer(p.key);
      }
      return r;
    });
  }

  function surMoi(kind: "avertissement" | "message" | "screamer") {
    if (!me) return;
    act(async () => {
      const r = await sendNotice({ userId: me }, kind, texte.trim() || "Ceci est un test.");
      if (r.ok) pingPlayer(`u:${me}`);
      return r;
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-extrabold">Parler à tout le monde</h3>
        <p className="text-[10px] text-zinc-400">
          Chaque compte reçoit le message, plus les {invites.length} invité{invites.length > 1 ? "s" : ""} en ligne. Ils le
          voient dans la minute.
        </p>
        <textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          maxLength={300}
          rows={3}
          placeholder="Ton message… (inutile pour un screamer)"
          aria-label="Message pour tout le monde"
          className={`${field} mt-2 resize-none py-2 leading-relaxed`}
        />
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <button type="button" disabled={pending || !texte.trim()} onClick={() => tous("avertissement")} className={tile}>
            ⚠️ Avertir tous
          </button>
          <button type="button" disabled={pending || !texte.trim()} onClick={() => tous("message")} className={tile}>
            📢 Annoncer
          </button>
          <button type="button" disabled={pending} onClick={() => tous("screamer")} className={`${tile} hover:border-red-400 hover:bg-red-500/20`}>
            😱 Screamer tous
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
        <h3 className="text-sm font-extrabold">Essayer sur moi</h3>
        <p className="text-[10px] text-zinc-400">Pour voir l&apos;effet avant de l&apos;envoyer. Personne d&apos;autre ne le reçoit.</p>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <button type="button" disabled={pending || !me} onClick={() => surMoi("avertissement")} className={tile}>
            ⚠️ Avertir
          </button>
          <button type="button" disabled={pending || !me} onClick={() => surMoi("message")} className={tile}>
            📢 Message
          </button>
          <button type="button" disabled={pending || !me} onClick={() => surMoi("screamer")} className={tile}>
            😱 Screamer
          </button>
        </div>
      </div>
      <ScreamerGallery />
    </div>
  );
}

// ---------------------------------------------------------------- en ligne

function OnlineView({ me, act, pending }: { me: string | null } & ActProps) {
  const [players, setPlayers] = useState<OnlinePlayer[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => subscribeOnline(setPlayers), []);
  const list = players.filter((p) => p.userId !== me);
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-extrabold">
        En ligne <span className="text-zinc-400">({list.length})</span>
      </h3>
      <p className="text-[10px] text-zinc-400">Les joueurs sans compte apparaissent avec leur numéro.</p>
      {list.length === 0 && <p className="text-xs text-zinc-400">Personne d&apos;autre en ce moment.</p>}
      <ul className="space-y-1.5">
        {list.map((p) => (
          <li key={p.key} className="rounded-lg bg-white/[0.05]">
            <button type="button" onClick={() => setOpen(open === p.key ? null : p.key)} className="flex w-full items-center gap-2 px-3 py-2 text-left">
              <span className="size-2 shrink-0 rounded-full bg-emerald-400" />
              <span className="min-w-0 flex-1 truncate text-xs font-bold">{p.name}</span>
              <span className={`rounded-full px-1.5 text-[9px] font-bold ${p.guest ? "bg-zinc-500/30 text-zinc-300" : "bg-violet-500/30 text-violet-200"}`}>
                {p.guest ? "invité" : "compte"}
              </span>
              <span className="shrink-0 text-[10px] text-zinc-400">{p.where}</span>
            </button>
            {open === p.key && (
              <div className="space-y-1.5 px-3 pb-3">
                <NoticeButtons
                  target={p.userId ? { userId: p.userId } : { guest: p.guestNum ?? undefined }}
                  pingKey={p.key}
                  name={p.name}
                  act={act}
                  pending={pending}
                />
                {p.userId && (
                  <div className="grid grid-cols-2 gap-1.5">
                    <Link href={`/profil/${encodeURIComponent(p.name)}`} className={tile}>
                      👤 Son profil
                    </Link>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        const motif = window.prompt(`Bannir ${p.name} pour 1 jour. Motif :`);
                        if (motif !== null) act(() => banUser(p.userId as string, "1j", motif, false));
                      }}
                      className={`${tile} hover:border-red-400 hover:bg-red-500/20`}
                    >
                      ⛔ Bannir 1 jour
                    </button>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------ joueurs

const FILTRES: { id: string; label: string; garde: (u: AdminUser) => boolean }[] = [
  { id: "tous", label: "Tous", garde: () => true },
  { id: "admins", label: "Admins", garde: (u) => u.isAdmin },
  { id: "certifies", label: "✔", garde: (u) => u.verified },
  { id: "bannis", label: "Bannis", garde: (u) => u.banned },
  { id: "attente", label: "Non activés", garde: (u) => !u.emailConfirmed },
];

function PlayersView({ data, act, pending }: { data: AdminData } & ActProps) {
  const [q, setQ] = useState("");
  const [filtre, setFiltre] = useState("tous");
  const [selId, setSelId] = useState<string | null>(null);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const garde = FILTRES.find((f) => f.id === filtre)?.garde ?? (() => true);
    return data.users.filter(
      (u) => garde(u) && (!s || u.pseudo.toLowerCase().includes(s) || u.email.toLowerCase().includes(s)),
    );
  }, [data.users, q, filtre]);
  const sel = data.users.find((u) => u.id === selId) ?? null;

  return (
    <div className="flex h-full min-h-72 gap-3">
      <div className="flex w-40 shrink-0 flex-col">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Choisir un joueur</p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" aria-label="Rechercher un joueur" className={field} />
        <div className="mt-1.5 flex flex-wrap gap-1">
          {FILTRES.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltre(f.id)}
              aria-pressed={filtre === f.id}
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${filtre === f.id ? "bg-violet-600" : "bg-white/10 hover:bg-white/20"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-zinc-500">{list.length} affiché{list.length > 1 ? "s" : ""}</p>
        <ul className="mt-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {list.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => setSelId(u.id)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
                  selId === u.id ? "bg-violet-600 text-white" : "text-zinc-200 hover:bg-white/10"
                }`}
              >
                <span className={`size-1.5 shrink-0 rounded-full ${u.banned ? "bg-red-500" : u.emailConfirmed ? "bg-emerald-400" : "bg-amber-400"}`} />
                <span className="truncate font-semibold">{u.pseudo}</span>
                {u.verified && <span className="text-sky-300">✔</span>}
                {u.isAdmin && <span className="ml-auto text-[9px] text-violet-300">ADM</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="min-w-0 flex-1">
        {sel ? (
          <PlayerCard key={sel.id} u={sel} me={data.me.id} act={act} pending={pending} />
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-zinc-500">
            Choisis un joueur dans la liste.
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerCard({ u, me, act, pending }: { u: AdminUser; me: string } & ActProps) {
  const [mode, setMode] = useState<null | "ban" | "rename" | "password">(null);
  const [duration, setDuration] = useState("7j");
  const [reason, setReason] = useState("");
  const [name, setName] = useState(u.pseudo);
  const [pwd, setPwd] = useState(makePassword);
  const [copie, setCopie] = useState<string | null>(null);
  const self = u.id === me;
  const protectedAccount = self || u.isAdmin;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-sky-500/25 to-violet-600/25 p-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-violet-600 text-sm font-black">
          {initials(u.pseudo)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold">
            {u.pseudo} {u.verified && <span className="text-sky-300">✔</span>}
          </p>
          <p className="truncate text-[10px] text-zinc-300">
            {u.email.endsWith("@sans-email.pixolud.vercel.app") ? "compte sans e-mail" : u.email}
          </p>
          <p className="text-[10px] text-zinc-400">
            {TIERS[u.tier] ?? u.tier}
            {u.isAdmin ? " · Admin" : ""}
            {u.banned ? " · BANNI" : ""}
            {!u.emailConfirmed ? " · non activé" : ""} · {u.games} jeu{u.games > 1 ? "x" : ""}
          </p>
          <p className="text-[10px] text-zinc-400">
            Inscrit le {jour(u.createdAt)} · vu {jour(u.lastSignIn)}
          </p>
        </div>
        <button
          type="button"
          title="Copier le pseudo, l'e-mail et l'identifiant"
          aria-label="Copier les informations du joueur"
          onClick={() => {
            navigator.clipboard
              ?.writeText(`${u.pseudo}\n${u.email}\n${u.id}`)
              .then(() => setCopie("copié !"))
              .catch(() => setCopie("copie refusée"));
          }}
          className="shrink-0 rounded-md px-2 py-1 text-xs text-zinc-200 hover:bg-white/15"
        >
          {copie ?? "📋"}
        </button>
      </div>

      <div>
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Modération</p>
        <div className="grid grid-cols-3 gap-1.5">
          {u.banned ? (
            <button type="button" disabled={pending} onClick={() => act(() => unbanUser(u.id))} className={tile}>
              ✅ Débannir
            </button>
          ) : (
            <button type="button" disabled={pending || protectedAccount} onClick={() => setMode(mode === "ban" ? null : "ban")} className={tile}>
              ⛔ Bannir
            </button>
          )}
          <button type="button" disabled={pending} onClick={() => act(() => setVerified(u.id, !u.verified))} className={tile}>
            {u.verified ? "✖ Décertifier" : "✔ Certifier"}
          </button>
          <button type="button" disabled={pending} onClick={() => setMode(mode === "rename" ? null : "rename")} className={tile}>
            ✏️ Renommer
          </button>
          <button type="button" disabled={pending} onClick={() => setMode(mode === "password" ? null : "password")} className={tile}>
            🔑 Mot de passe
          </button>
          <button
            type="button"
            disabled={pending || u.emailConfirmed}
            onClick={() => act(() => confirmEmail(u.id))}
            className={tile}
            title="Activer le compte sans le lien reçu par e-mail"
          >
            📨 Activer
          </button>
          <button
            type="button"
            disabled={pending || (self && u.isAdmin)}
            onClick={() => {
              if (u.isAdmin || window.confirm(`Donner TOUS les droits admin à ${u.pseudo} ?`)) act(() => setAdminRole(u.id, !u.isAdmin));
            }}
            className={tile}
          >
            {u.isAdmin ? "👤 Retirer admin" : "🛡️ Admin"}
          </button>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Messages</p>
        <NoticeButtons target={{ userId: u.id }} pingKey={`u:${u.id}`} name={u.pseudo} act={act} pending={pending} />
      </div>

      {mode === "ban" && (
        <div className="space-y-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3">
          <div className="flex gap-2">
            <select value={duration} onChange={(e) => setDuration(e.target.value)} aria-label="Durée" className={`${field} w-28`}>
              <option value="1j">1 jour</option>
              <option value="7j">7 jours</option>
              <option value="30j">30 jours</option>
              <option value="definitif">Définitif</option>
            </select>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motif (visible par lui)" aria-label="Motif" className={field} />
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              act(() => banUser(u.id, duration, reason, false));
              setMode(null);
            }}
            className="w-full rounded-lg bg-red-600 py-2 text-xs font-extrabold hover:bg-red-500"
          >
            Confirmer le bannissement
          </button>
        </div>
      )}
      {mode === "rename" && (
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Nouveau pseudo" className={field} />
          <button
            type="button"
            disabled={pending || name.trim() === u.pseudo}
            onClick={() => {
              act(() => renameUser(u.id, name));
              setMode(null);
            }}
            className={`${tile} px-3`}
          >
            OK
          </button>
        </div>
      )}
      {mode === "password" && (
        <div className="flex gap-2">
          <input value={pwd} onChange={(e) => setPwd(e.target.value)} aria-label="Nouveau mot de passe" className={field} />
          <button type="button" onClick={() => setPwd(makePassword())} className={`${tile} px-2`} title="Générer">
            🎲
          </button>
          <button
            type="button"
            disabled={pending || pwd.length < 8}
            onClick={() => {
              act(() => setPassword(u.id, pwd));
              setMode(null);
            }}
            className={`${tile} px-3`}
          >
            OK
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Palier</span>
        {(["free", "standard", "max"] as const).map((t) => (
          <button
            key={t}
            type="button"
            disabled={pending || u.tier === t}
            onClick={() => act(() => setTier(u.id, t))}
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${u.tier === t ? "bg-violet-600" : "bg-white/10 hover:bg-white/20"}`}
          >
            {TIERS[t]}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-white/10 pt-2">
        <Link href={`/profil/${encodeURIComponent(u.pseudo)}`} className="text-[11px] font-semibold text-sky-300 hover:underline">
          Voir le profil ↗
        </Link>
        <button
          type="button"
          disabled={pending || protectedAccount}
          onClick={() => {
            const typed = window.prompt(`Suppression DÉFINITIVE du compte, de ses jeux et commentaires.\nTape son pseudo pour confirmer : ${u.pseudo}`);
            if (typed !== null) act(() => deleteUser(u.id, typed));
          }}
          className="text-[11px] font-semibold text-red-300 hover:underline disabled:opacity-30"
        >
          Supprimer le compte
        </button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------- bannis

function BannedView({ data, act, pending }: { data: AdminData } & ActProps) {
  const banned = data.users.filter((u) => u.banned);
  if (banned.length === 0) return <p className="text-xs text-zinc-400">Aucun joueur banni.</p>;
  return (
    <ul className="space-y-1.5">
      {banned.map((u) => (
        <li key={u.id} className="flex items-center gap-3 rounded-lg bg-white/[0.05] px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold">{u.pseudo}</p>
            <p className="truncate text-[10px] text-zinc-400">
              {u.bannedUntil ? `jusqu'au ${new Date(u.bannedUntil).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}` : "définitif"}
              {u.banReason ? ` — ${u.banReason}` : ""}
            </p>
          </div>
          <button type="button" disabled={pending} onClick={() => act(() => unbanUser(u.id))} className={`${tile} px-3`}>
            Débannir
          </button>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------- jeux

function GamesView({ data, act, pending }: { data: AdminData } & ActProps) {
  const [q, setQ] = useState("");
  const list = data.games.filter((g) => {
    const s = q.trim().toLowerCase();
    return !s || g.title.toLowerCase().includes(s) || g.author.toLowerCase().includes(s);
  });
  return (
    <div className="space-y-2">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Titre ou auteur…" aria-label="Rechercher un jeu" className={field} />
      <ul className="space-y-1.5">
        {list.map((g) => (
          <li key={g.id} className="flex items-center gap-2 rounded-lg bg-white/[0.05] px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold">
                {g.title} {!g.published && <span className="text-[10px] text-amber-300">(retiré)</span>}
              </p>
              <p className="truncate text-[10px] text-zinc-400">
                {g.author} · {g.plays} parties
              </p>
            </div>
            <Link href={`/jeu/${g.slug}`} target="_blank" title="Ouvrir la fiche du jeu" className={`${tile} px-2`}>
              ↗
            </Link>
            <button type="button" disabled={pending} onClick={() => act(() => setGamePublished(g.id, !g.published))} className={`${tile} px-2`}>
              {g.published ? "Retirer" : "Publier"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (window.confirm(`Supprimer définitivement « ${g.title} » ?`)) act(() => deleteGame(g.id));
              }}
              className={`${tile} px-2 hover:border-red-400 hover:bg-red-500/20`}
              aria-label={`Supprimer ${g.title}`}
            >
              🗑
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// -------------------------------------------------------------------- creer

/** Ouvrir un compte a quelqu'un qui n'a pas d'adresse e-mail. */
function CreateView({ act, pending }: ActProps) {
  const [pseudo, setPseudo] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState(makePassword);
  const [verifie, setVerifie] = useState(false);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-extrabold">Créer un compte</h3>
        <p className="text-[10px] text-zinc-400">
          Sans e-mail, le compte marche quand même : la personne se connecte avec son pseudo et ce mot de passe.
        </p>
      </div>
      <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="Pseudo" aria-label="Pseudo" className={field} />
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail (facultatif)" aria-label="E-mail" className={field} />
      <div className="flex gap-2">
        <input value={pwd} onChange={(e) => setPwd(e.target.value)} aria-label="Mot de passe" className={field} />
        <button type="button" onClick={() => setPwd(makePassword())} className={`${tile} px-2`} title="Autre mot de passe">
          🎲
        </button>
      </div>
      <label className="flex items-center gap-2 text-[11px] font-semibold text-zinc-300">
        <Switch on={verifie} onClick={() => setVerifie((v) => !v)} label="Compte certifié" />
        Certifié ✔ dès la création
      </label>
      <button
        type="button"
        disabled={pending || pseudo.trim().length < 3 || pwd.length < 8}
        onClick={() => act(() => createAccount(pseudo, pwd, email, verifie))}
        className="w-full rounded-lg bg-violet-600 py-2 text-xs font-extrabold hover:bg-violet-500 disabled:opacity-40"
      >
        Créer le compte
      </button>
      <p className="text-[10px] text-zinc-500">Note le mot de passe avant de valider : il ne se réaffiche pas.</p>
    </div>
  );
}

// ------------------------------------------------------------- commentaires

function CommentsView({ data, act, pending }: { data: AdminData } & ActProps) {
  if (data.comments.length === 0) return <p className="text-xs text-zinc-400">Aucun commentaire.</p>;
  return (
    <ul className="space-y-1.5">
      {data.comments.slice(0, 40).map((c) => (
        <li key={c.id} className="flex items-start gap-2 rounded-lg bg-white/[0.05] px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-zinc-200">{c.text}</p>
            <p className="truncate text-[10px] text-zinc-500">
              {c.author} · sur {c.game} · {jour(c.createdAt)}
            </p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (window.confirm("Supprimer ce commentaire ?")) act(() => deleteComment(c.id));
            }}
            className={`${tile} px-2 hover:border-red-400 hover:bg-red-500/20`}
            aria-label="Supprimer le commentaire"
          >
            🗑
          </button>
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------ journal

/** Ce qui a ete fait depuis le panneau, du plus recent au plus ancien. */
function LogView({ data }: { data: AdminData }) {
  if (data.logError) {
    return <p className="rounded-lg bg-amber-500/15 p-3 text-xs text-amber-200">Journal illisible : {data.logError}</p>;
  }
  if (data.log.length === 0) return <p className="text-xs text-zinc-400">Rien pour l&apos;instant.</p>;
  return (
    <ul className="space-y-1">
      {data.log.slice(0, 60).map((l) => (
        <li key={l.id} className="rounded-lg bg-white/[0.05] px-3 py-2">
          <p className="text-[11px]">
            <b className="text-violet-300">{l.action}</b> <span className="text-zinc-300">{l.details}</span>
          </p>
          <p className="text-[10px] text-zinc-500">
            {l.admin} ·{" "}
            {new Date(l.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
          </p>
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------- signalements

function ReportsView({ data, act, pending }: { data: AdminData } & ActProps) {
  const open = data.reports.filter((r) => r.status === "ouvert");
  if (open.length === 0) return <p className="text-xs text-zinc-400">Aucun signalement à traiter. 🎉</p>;
  return (
    <ul className="space-y-2">
      {open.map((r) => (
        <li key={r.id} className="space-y-2 rounded-lg bg-white/[0.05] p-3">
          <p className="text-xs">
            <b>{r.reason}</b> <span className="text-zinc-400">sur {r.game} · par {r.reporter}</span>
          </p>
          {r.details && <p className="text-[11px] text-zinc-300">{r.details}</p>}
          <div className="flex flex-wrap gap-1.5">
            <button type="button" disabled={pending} onClick={() => act(() => setReportStatus(r.id, "traité"))} className={`${tile} px-2`}>
              ✅ Traité
            </button>
            <button type="button" disabled={pending} onClick={() => act(() => setReportStatus(r.id, "rejeté"))} className={`${tile} px-2`}>
              Rejeter
            </button>
            {r.gameSlug && r.gamePublished && (
              <button type="button" disabled={pending} onClick={() => act(() => setGamePublished(r.gameId, false))} className={`${tile} px-2`}>
                Retirer le jeu
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
