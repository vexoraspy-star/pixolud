"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  banUser,
  confirmEmail,
  deleteGame,
  deleteUser,
  getAdminPanelData,
  renameUser,
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

/**
 * Bouton 🛡 flottant (admins seulement, verifie cote serveur par le layout)
 * et sa fenetre « Admin Panel », facon panneau de jeu : on la deplace a la
 * souris, elle s'ouvre par-dessus la page ou le jeu en cours. Toutes les
 * actions revérifient le droit admin cote serveur.
 */

type View = "triches" | "joueurs" | "bannis" | "jeux" | "signalements";

const NAV: { id: View; icon: string; label: string }[] = [
  { id: "triches", icon: "🎮", label: "Triches" },
  { id: "joueurs", icon: "👥", label: "Joueurs" },
  { id: "bannis", icon: "⛔", label: "Bannis" },
  { id: "jeux", icon: "🕹️", label: "Jeux" },
  { id: "signalements", icon: "🚩", label: "Signalements" },
];

const TIERS: Record<string, string> = { free: "Gratuit", standard: "Standard", max: "Max" };

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function makePassword() {
  const words = ["pixel", "cube", "fusee", "dragon", "etoile", "robot", "comete", "tigre", "vague", "orage", "lynx", "nova"];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  return `${pick()}-${pick()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

const tile =
  "flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-2 text-xs font-bold text-white transition hover:border-violet-400/70 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-40";
const field = "min-h-9 w-full rounded-lg border border-white/10 bg-black/40 px-2.5 text-xs text-white outline-none focus:border-violet-400";

function Switch({ on, onClick, disabled, label }: { on: boolean; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${on ? "bg-fuchsia-500" : "bg-white/15"}`}
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
      // Le jeu en cours lit le droit au chargement : il faut recharger.
      if (game && next.includes(game.slug) !== gameOn) window.location.reload();
      else setToast(r);
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
        className={`fixed left-2 top-1/2 z-[90] flex size-10 -translate-y-1/2 items-center justify-center rounded-xl border text-lg shadow-lg backdrop-blur transition ${
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
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
          style={pos ? { left: pos.x, top: pos.y } : undefined}
          className={`fixed z-[95] flex h-[min(480px,calc(100dvh-24px))] w-[min(620px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0e0f15]/95 text-white shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl ${
            pos ? "" : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          }`}
        >
          {/* Barre de titre : on attrape la fenetre par ici */}
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="flex cursor-move select-none items-center gap-2.5 border-b border-white/10 bg-gradient-to-r from-violet-600/30 to-fuchsia-600/10 px-4 py-2.5"
          >
            <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 text-sm shadow">🛡️</span>
            <span className="text-sm font-extrabold tracking-wide">Admin Panel</span>
            {pending && <span className="text-[10px] font-semibold text-violet-300">chargement…</span>}
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              title="Ouvrir le panneau complet"
              className="ml-auto rounded-md px-2 py-1 text-xs font-bold text-zinc-300 hover:bg-white/10 hover:text-white"
            >
              Plein écran ↗
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              className="rounded-md px-2 py-1 text-lg leading-none text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="flex min-h-0 flex-1">
            {/* Menu de gauche */}
            <aside className="flex w-40 shrink-0 flex-col border-r border-white/10 bg-black/25 p-3">
              <div className="flex items-center gap-2.5 pb-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-violet-600 text-sm font-black">
                  {initials(data?.me.pseudo ?? "AD")}
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block text-[10px] text-zinc-400">Bienvenue,</span>
                  <b className="block truncate text-sm">{data?.me.pseudo ?? "…"}</b>
                </span>
              </div>
              <nav className="flex flex-col gap-1">
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
                      className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-bold transition ${
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
              <p className="mt-auto pt-3 text-[10px] text-zinc-500">Pixolud · Admin v1.0</p>
            </aside>

            {/* Contenu */}
            <section className="min-w-0 flex-1 overflow-y-auto p-4">
              {loadError && (
                <p className="rounded-lg bg-red-500/15 p-3 text-xs text-red-200">
                  Impossible de charger les données : vérifie la clé secrète sur Vercel, ou ouvre le panneau complet.
                </p>
              )}
              {view === "triches" && (
                <CheatsView games={games} current={game?.slug ?? null} cheats={cheats} pending={pending} save={saveCheats} />
              )}
              {data && view === "joueurs" && <PlayersView data={data} act={act} pending={pending} />}
              {data && view === "bannis" && <BannedView data={data} act={act} pending={pending} />}
              {data && view === "jeux" && <GamesView data={data} act={act} pending={pending} />}
              {data && view === "signalements" && <ReportsView data={data} act={act} pending={pending} />}
              {!data && !loadError && view !== "triches" && <p className="text-xs text-zinc-400">Chargement…</p>}
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
            {cheats.includes(here.slug) ? "Actif : en partie, touche F2 pour ouvrir le menu de triche." : "Active-le : la page se recharge, puis F2 en partie."}
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-zinc-400">Ouvre le Manoir, les Backrooms ou le Duel pour activer la triche du jeu en cours. Tu peux aussi les régler ici :</p>
      )}
      <ul className="space-y-1.5">
        {games
          .filter((g) => g.slug !== current)
          .map((g) => (
            <li key={g.slug} className="flex items-center gap-3 rounded-lg bg-white/[0.05] px-3 py-2">
              <span className="min-w-0 flex-1 text-xs font-bold">{g.label}</span>
              <Switch on={cheats.includes(g.slug)} disabled={pending} onClick={() => toggle(g.slug)} label={`Triches dans ${g.label}`} />
            </li>
          ))}
      </ul>
      <p className="text-[10px] text-zinc-500">Réglage de ce navigateur. En ligne contre de vrais joueurs, la triche reste toujours coupée.</p>
    </div>
  );
}

// ------------------------------------------------------------------ joueurs

function PlayersView({ data, act, pending }: { data: AdminData } & ActProps) {
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.users.filter((u) => !s || u.pseudo.toLowerCase().includes(s) || u.email.toLowerCase().includes(s));
  }, [data.users, q]);
  const sel = data.users.find((u) => u.id === selId) ?? null;

  return (
    <div className="flex h-full min-h-72 gap-3">
      <div className="flex w-40 shrink-0 flex-col">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Choisir un joueur</p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" aria-label="Rechercher un joueur" className={field} />
        <ul className="mt-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto">
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
        </div>
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
            {u.verified ? "✖ Retirer ✔" : "✔ Vérifier"}
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
