"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  banUser,
  confirmEmail,
  createAccount,
  deleteComment,
  deleteGame,
  deleteUser,
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

export interface AdminUser {
  id: string;
  pseudo: string;
  email: string;
  tier: string;
  isAdmin: boolean;
  verified: boolean;
  banned: boolean;
  banReason: string;
  bannedUntil: string;
  emailConfirmed: boolean;
  createdAt: string;
  lastSignIn: string;
  games: number;
  /** Parties jouees (0 tant que add_historique_parties.sql n'est pas lance). */
  parties: number;
  /** Date ISO de la derniere partie, vide si aucune. */
  dernierePartie: string;
  /** Titre du dernier jeu lance. */
  dernierJeu: string;
}

export interface AdminData {
  me: { id: string; pseudo: string };
  migrationReady: boolean;
  /** Le journal ne se lit pas (droits de la table) : le message de Supabase. */
  logError: string;
  users: AdminUser[];
  games: { id: string; slug: string; title: string; category: string; published: boolean; plays: number; createdAt: string; author: string }[];
  comments: { id: string; text: string; createdAt: string; author: string; game: string; gameSlug: string }[];
  reports: {
    id: string;
    reason: string;
    details: string;
    status: string;
    createdAt: string;
    gameId: string;
    game: string;
    gameSlug: string;
    gamePublished: boolean;
    reporter: string;
  }[];
  log: { id: string; action: string; details: string; createdAt: string; admin: string }[];
  /** Messages du chat refuses ou signales par la moderation. */
  moderation: { id: string; verdict: string; motif: string; texte: string; createdAt: string; auteur: string }[];
  cheatGames: { slug: string; label: string; hint: string; on: boolean }[];
}

type Tab = "tableau" | "joueurs" | "creer" | "jeux" | "commentaires" | "signalements" | "triches" | "journal";

const TIER_LABEL: Record<string, string> = { free: "Gratuit", standard: "Standard", max: "Max", studio: "Studio" };

function date(iso: string, withTime = false) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", withTime ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "short", year: "numeric" });
}

/** Mot de passe lisible a dicter : deux mots et quatre chiffres. */
function makePassword() {
  const words = ["pixel", "cube", "fusee", "dragon", "etoile", "robot", "comete", "tigre", "vague", "orage", "lynx", "nova"];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  return `${pick()}-${pick()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

const card = "rounded-2xl border border-[var(--portal-line)] bg-[var(--portal-surface)]";
const input =
  "min-h-10 rounded-lg border border-[var(--portal-line)] bg-[var(--portal-bg)] px-3 text-sm text-[var(--portal-ink)] outline-none focus:border-[var(--portal-accent)]";
const btn = "min-h-10 rounded-lg px-3.5 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-50";
const btnMain = `${btn} bg-[#7050d9] text-white hover:bg-[#5e3bc8]`;
const btnSoft = `${btn} border border-[var(--portal-line)] bg-[var(--portal-soft)] text-[var(--portal-ink)] hover:border-[var(--portal-accent)]`;
const btnDanger = `${btn} bg-red-600 text-white hover:bg-red-700`;

function Pill({ tone, children }: { tone: "violet" | "vert" | "rouge" | "ambre" | "gris"; children: React.ReactNode }) {
  const tones = {
    violet: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
    vert: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    rouge: "bg-red-500/15 text-red-700 dark:text-red-300",
    ambre: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    gris: "bg-zinc-500/15 text-[var(--portal-muted)]",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${tones[tone]}`}>{children}</span>;
}

/**
 * Le panneau admin. `compact` : dans la petite fenetre du bouton 🛡 ; la mise
 * en page suit alors la largeur de la fenetre (requetes de conteneur), pas
 * celle de l'ecran. `onChanged` recharge les donnees apres une action.
 */
export default function AdminPanel({
  data,
  compact = false,
  onChanged,
}: {
  data: AdminData;
  compact?: boolean;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("tableau");
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<AdminResult | null>(null);

  /** Lance une action serveur, affiche son message, recharge les donnees. */
  function act(run: () => Promise<AdminResult>) {
    start(async () => {
      const r = await run();
      setToast(r);
      if (!r.ok) return;
      if (onChanged) onChanged();
      else router.refresh();
    });
  }

  const openReports = data.reports.filter((r) => r.status === "ouvert").length;
  const banned = data.users.filter((u) => u.banned).length;
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "tableau", label: "Tableau de bord" },
    { id: "joueurs", label: "Joueurs", count: data.users.length },
    { id: "creer", label: "Créer un compte" },
    { id: "jeux", label: "Jeux", count: data.games.length },
    { id: "commentaires", label: "Commentaires", count: data.comments.length },
    { id: "signalements", label: "Signalements", count: openReports },
    { id: "triches", label: "Triches en jeu" },
    { id: "journal", label: "Journal" },
  ];

  return (
    <div className={compact ? "admin-management @container p-4" : "admin-management @container portal-container portal-page"}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {!compact && <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--portal-accent)]">🛡 Administration</p>}
          {compact ? (
            <h2 className="text-xl font-extrabold tracking-tight">Panneau admin</h2>
          ) : (
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight">Panneau admin</h1>
          )}
          <p className="mt-1 text-xs text-[var(--portal-muted)]">
            Connecté en tant que <b className="text-[var(--portal-ink)]">{data.me.pseudo}</b>. Tout ce que tu fais ici est réel.
          </p>
        </div>
        {pending && <span className="text-sm font-semibold text-[var(--portal-accent)]">Action en cours…</span>}
      </div>

      {!data.migrationReady && (
        <div className="mt-6 rounded-2xl border border-amber-400/50 bg-amber-400/10 p-4 text-sm">
          <b>Une étape à faire une seule fois :</b> dans Supabase, ouvre <i>SQL Editor → New query</i>, colle le contenu du fichier{" "}
          <code className="rounded bg-black/10 px-1">supabase/add_admin_panel.sql</code> et clique sur <i>Run</i>. Ça active le badge vérifié,
          le motif des bannissements, le journal et empêche un compte banni de publier. Le bannissement de connexion marche déjà sans.
        </div>
      )}
      {data.migrationReady && data.logError && (
        <div className="mt-4 rounded-2xl border border-amber-400/50 bg-amber-400/10 p-4 text-xs leading-5">
          <b>Le journal est inaccessible</b> ({data.logError}). Tout le reste marche. Pour le réparer, lance dans Supabase (SQL Editor) :
          <code className="mt-2 block rounded bg-black/20 p-2 font-mono">
            grant select, insert on public.admin_log to service_role;
            <br />
            grant usage, select on sequence public.admin_log_id_seq to service_role;
          </code>
        </div>
      )}

      <div role="status" aria-live="polite" className="min-h-0">
        {toast && (
          <div
            className={`mt-6 flex items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold ${
              toast.ok ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200" : "bg-red-500/15 text-red-800 dark:text-red-200"
            }`}
          >
            <span>{toast.message}</span>
            <button type="button" onClick={() => setToast(null)} aria-label="Fermer le message" className="opacity-70 hover:opacity-100">
              ✕
            </button>
          </div>
        )}
      </div>

      <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-[var(--portal-line)] pb-px" aria-label="Sections du panneau">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`shrink-0 rounded-t-lg px-3.5 py-2.5 text-sm font-semibold transition ${
              tab === t.id
                ? "border-b-2 border-[var(--portal-accent)] text-[var(--portal-accent)]"
                : "text-[var(--portal-muted)] hover:text-[var(--portal-ink)]"
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="ml-1.5 rounded-full bg-[var(--portal-soft)] px-1.5 py-0.5 text-[11px]">{t.count}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {tab === "tableau" && (
          <Dashboard data={data} banned={banned} openReports={openReports} go={setTab} />
        )}
        {tab === "joueurs" && <Users data={data} act={act} pending={pending} />}
        {tab === "creer" && <CreateAccount act={act} pending={pending} />}
        {tab === "jeux" && <Games data={data} act={act} pending={pending} />}
        {tab === "commentaires" && <Comments data={data} act={act} pending={pending} />}
        {tab === "signalements" && <Reports data={data} act={act} pending={pending} />}
        {tab === "triches" && <Cheats data={data} act={act} pending={pending} />}
        {tab === "journal" && <Log data={data} />}
      </div>
    </div>
  );
}

type ActProps = { act: (run: () => Promise<AdminResult>) => void; pending: boolean };

// ------------------------------------------------------------ tableau de bord

function Dashboard({ data, banned, openReports, go }: { data: AdminData; banned: number; openReports: number; go: (t: Tab) => void }) {
  const published = data.games.filter((g) => g.published).length;
  const plays = data.games.reduce((s, g) => s + g.plays, 0);
  const unconfirmed = data.users.filter((u) => !u.emailConfirmed).length;
  const stats: { label: string; value: number; tab: Tab; alert?: boolean }[] = [
    { label: "Joueurs", value: data.users.length, tab: "joueurs" },
    { label: "Comptes bannis", value: banned, tab: "joueurs" },
    { label: "Comptes non activés", value: unconfirmed, tab: "joueurs", alert: unconfirmed > 0 },
    { label: "Jeux publiés", value: published, tab: "jeux" },
    { label: "Brouillons", value: data.games.length - published, tab: "jeux" },
    { label: "Parties jouées", value: plays, tab: "jeux" },
    { label: "Commentaires", value: data.comments.length, tab: "commentaires" },
    { label: "Signalements ouverts", value: openReports, tab: "signalements", alert: openReports > 0 },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
        {stats.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => go(s.tab)}
            className={`${card} p-4 text-left transition hover:border-[var(--portal-accent)] ${s.alert ? "ring-2 ring-amber-400/60" : ""}`}
          >
            <p className="text-3xl font-extrabold tabular-nums">{s.value.toLocaleString("fr-FR")}</p>
            <p className="mt-1 text-xs font-semibold text-[var(--portal-muted)]">{s.label}</p>
          </button>
        ))}
      </div>
      <div className={`${card} p-5`}>
        <h2 className="text-lg font-bold">Derniers inscrits</h2>
        <ul className="mt-3 divide-y divide-[var(--portal-line)]">
          {data.users.slice(0, 6).map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="font-semibold">{u.pseudo}</span>
              <span className="text-[var(--portal-muted)]">{date(u.createdAt)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ joueurs

function Users({ data, act, pending }: { data: AdminData } & ActProps) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"tous" | "bannis" | "admins" | "inactifs" | "verifies">("tous");
  const [open, setOpen] = useState<string | null>(null);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.users.filter((u) => {
      if (s && !u.pseudo.toLowerCase().includes(s) && !u.email.toLowerCase().includes(s)) return false;
      if (filter === "bannis") return u.banned;
      if (filter === "admins") return u.isAdmin;
      if (filter === "inactifs") return !u.emailConfirmed;
      if (filter === "verifies") return u.verified;
      return true;
    });
  }, [data.users, q, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Chercher un pseudo ou un e-mail…"
          aria-label="Chercher un joueur"
          className={`${input} w-full @lg:w-80`}
        />
        {(["tous", "bannis", "admins", "inactifs", "verifies"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${filter === f ? "bg-[var(--portal-accent)] text-white" : "bg-[var(--portal-soft)] text-[var(--portal-muted)]"}`}
          >
            {{ tous: "Tous", bannis: "Bannis", admins: "Admins", inactifs: "Non activés", verifies: "Certifiés" }[f]}
          </button>
        ))}
      </div>
      {list.length === 0 && <p className="text-sm text-[var(--portal-muted)]">Aucun joueur ne correspond.</p>}
      <ul className="space-y-2">
        {list.map((u) => (
          <li key={u.id} className={card}>
            <button
              type="button"
              onClick={() => setOpen(open === u.id ? null : u.id)}
              aria-expanded={open === u.id}
              className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 p-4 text-left"
            >
              <span className="text-base font-bold">{u.pseudo}</span>
              {u.isAdmin && <Pill tone="violet">Admin</Pill>}
              {u.verified && <Pill tone="vert">✔ Certifié</Pill>}
              {u.banned && <Pill tone="rouge">Banni</Pill>}
              {!u.emailConfirmed && <Pill tone="ambre">Non activé</Pill>}
              <Pill tone="gris">{TIER_LABEL[u.tier] ?? u.tier}</Pill>
              <span className="ml-auto text-xs text-[var(--portal-muted)]">
                {u.email.endsWith("@sans-email.pixolud.vercel.app") ? "sans e-mail" : u.email} · inscrit le {date(u.createdAt)} · {u.games} jeu
                {u.games > 1 ? "x" : ""}
              </span>
            </button>
            {open === u.id && <UserActions u={u} me={data.me.id} act={act} pending={pending} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function UserActions({ u, me, act, pending }: { u: AdminUser; me: string } & ActProps) {
  const [pseudo, setPseudo] = useState(u.pseudo);
  const [tier, setTierValue] = useState(u.tier);
  const [password, setPasswordValue] = useState("");
  const [duration, setDuration] = useState("7j");
  const [reason, setReason] = useState("");
  const [unpublish, setUnpublish] = useState(false);
  const self = u.id === me;

  return (
    <div className="grid gap-4 border-t border-[var(--portal-line)] p-4 @3xl:grid-cols-2">
      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--portal-muted)]">Identité</h3>
        <div className="flex flex-wrap gap-2">
          <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} aria-label="Nouveau pseudo" className={`${input} flex-1`} />
          <button type="button" disabled={pending || pseudo.trim() === u.pseudo} onClick={() => act(() => renameUser(u.id, pseudo))} className={btnSoft}>
            Renommer
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={() => act(() => setVerified(u.id, !u.verified))} className={btnSoft}>
            {u.verified ? "Retirer la certification" : "✔ Certifier ce joueur"}
          </button>
          {!u.emailConfirmed && (
            <button type="button" disabled={pending} onClick={() => act(() => confirmEmail(u.id))} className={btnSoft}>
              Activer le compte sans e-mail
            </button>
          )}
          <Link href={`/profil/${encodeURIComponent(u.pseudo)}`} className={`${btnSoft} inline-flex items-center`}>
            Voir le profil ↗
          </Link>
        </div>
        <p className="text-xs text-[var(--portal-muted)]">
          Dernière connexion : {date(u.lastSignIn, true)} · e-mail {u.emailConfirmed ? "confirmé" : "non confirmé"}
        </p>
        <p className="text-xs text-[var(--portal-muted)]">
          🎮 {u.parties} partie{u.parties > 1 ? "s" : ""} jouée{u.parties > 1 ? "s" : ""}
          {u.dernierePartie ? ` · dernière : ${u.dernierJeu || "?"}, le ${date(u.dernierePartie, true)}` : " · n'a encore jamais joué"}
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--portal-muted)]">Compte</h3>
        <div className="flex flex-wrap gap-2">
          <select value={tier} onChange={(e) => setTierValue(e.target.value)} aria-label="Palier" className={input}>
            <option value="free">Gratuit</option>
            <option value="standard">Standard</option>
            <option value="max">Max</option>
          </select>
          <button type="button" disabled={pending || tier === u.tier} onClick={() => act(() => setTier(u.id, tier))} className={btnSoft}>
            Changer le palier
          </button>
          <button
            type="button"
            disabled={pending || (self && u.isAdmin)}
            onClick={() => {
              if (u.isAdmin || window.confirm(`Donner TOUS les droits admin à ${u.pseudo} ?`)) act(() => setAdminRole(u.id, !u.isAdmin));
            }}
            className={btnSoft}
          >
            {u.isAdmin ? "Retirer admin" : "Rendre admin"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={password}
            onChange={(e) => setPasswordValue(e.target.value)}
            placeholder="Nouveau mot de passe"
            aria-label="Nouveau mot de passe"
            className={`${input} flex-1`}
          />
          <button type="button" onClick={() => setPasswordValue(makePassword())} className={btnSoft}>
            Générer
          </button>
          <button type="button" disabled={pending || password.length < 8} onClick={() => act(() => setPassword(u.id, password))} className={btnSoft}>
            Changer
          </button>
        </div>
      </section>

      <section className="space-y-2 rounded-xl border border-red-500/30 p-3 @3xl:col-span-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-300">Sanctions</h3>
        {u.banned ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm">
              Banni {u.bannedUntil ? `jusqu'au ${date(u.bannedUntil, true)}` : "définitivement"}
              {u.banReason ? ` — « ${u.banReason} »` : ""}
            </span>
            <button type="button" disabled={pending} onClick={() => act(() => unbanUser(u.id))} className={btnMain}>
              Débannir
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select value={duration} onChange={(e) => setDuration(e.target.value)} aria-label="Durée du bannissement" className={input}>
              <option value="1j">1 jour</option>
              <option value="7j">7 jours</option>
              <option value="30j">30 jours</option>
              <option value="definitif">Définitif</option>
            </select>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motif (visible par le joueur)" aria-label="Motif" className={`${input} min-w-48 flex-1`} />
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={unpublish} onChange={(e) => setUnpublish(e.target.checked)} /> Retirer ses jeux
            </label>
            <button
              type="button"
              disabled={pending || self || u.isAdmin}
              onClick={() => {
                if (window.confirm(`Bannir ${u.pseudo} ?`)) act(() => banUser(u.id, duration, reason, unpublish));
              }}
              className={btnDanger}
            >
              Bannir
            </button>
          </div>
        )}
        <button
          type="button"
          disabled={pending || self || u.isAdmin}
          onClick={() => {
            const typed = window.prompt(`Suppression DÉFINITIVE du compte, de ses jeux et commentaires.\nTape son pseudo pour confirmer : ${u.pseudo}`);
            if (typed !== null) act(() => deleteUser(u.id, typed));
          }}
          className="text-sm font-semibold text-red-600 underline-offset-2 hover:underline disabled:opacity-40 dark:text-red-300"
        >
          Supprimer le compte définitivement…
        </button>
        {(self || u.isAdmin) && <p className="text-xs text-[var(--portal-muted)]">Un compte admin ne peut pas être banni ni supprimé : retire d&apos;abord ses droits.</p>}
      </section>
    </div>
  );
}

// ---------------------------------------------------------- creer un compte

function CreateAccount({ act, pending }: ActProps) {
  const [pseudo, setPseudo] = useState("");
  const [password, setPasswordValue] = useState(makePassword);
  const [email, setEmail] = useState("");
  const [verified, setVerifiedValue] = useState(true);
  return (
    <form
      className={`${card} max-w-xl space-y-4 p-5`}
      onSubmit={(e) => {
        e.preventDefault();
        act(() => createAccount(pseudo, password, email, verified));
      }}
    >
      <div>
        <h2 className="text-lg font-bold">Créer un compte pour quelqu&apos;un</h2>
        <p className="mt-1 text-sm text-[var(--portal-muted)]">
          Le compte est activé tout de suite, sans lien par e-mail. Sans e-mail, la personne se connecte avec son <b>pseudo</b> et le mot de
          passe que tu lui donnes.
        </p>
      </div>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Pseudo
        <input required value={pseudo} onChange={(e) => setPseudo(e.target.value)} className={input} placeholder="3 à 24 caractères" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Mot de passe
        <span className="flex gap-2">
          <input required minLength={8} value={password} onChange={(e) => setPasswordValue(e.target.value)} className={`${input} flex-1`} />
          <button type="button" onClick={() => setPasswordValue(makePassword())} className={btnSoft}>
            Générer
          </button>
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        <span>
          E-mail <span className="font-normal text-[var(--portal-muted)]">(facultatif)</span>
        </span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} placeholder="laisser vide = connexion par pseudo" />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={verified} onChange={(e) => setVerifiedValue(e.target.checked)} /> Certifier ce compte
      </label>
      <button type="submit" disabled={pending} className={btnMain}>
        Créer le compte
      </button>
      <p className="text-xs text-[var(--portal-muted)]">Note le pseudo et le mot de passe avant de valider : ils ne s&apos;affichent plus ensuite.</p>
    </form>
  );
}

// --------------------------------------------------------------------- jeux

function Games({ data, act, pending }: { data: AdminData } & ActProps) {
  const [q, setQ] = useState("");
  const list = data.games.filter((g) => {
    const s = q.trim().toLowerCase();
    return !s || g.title.toLowerCase().includes(s) || g.author.toLowerCase().includes(s) || g.category.toLowerCase().includes(s);
  });
  return (
    <div className="space-y-4">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Titre, auteur ou catégorie…" aria-label="Chercher un jeu" className={`${input} w-full @lg:w-80`} />
      <ul className="space-y-2">
        {list.map((g) => (
          <li key={g.id} className={`${card} flex flex-wrap items-center gap-3 p-4`}>
            <div className="min-w-0 flex-1">
              <p className="font-bold">
                {g.title} {!g.published && <Pill tone="ambre">Brouillon / retiré</Pill>}
              </p>
              <p className="text-xs text-[var(--portal-muted)]">
                par {g.author} · {g.category} · {g.plays.toLocaleString("fr-FR")} parties · {date(g.createdAt)}
              </p>
            </div>
            {g.published && (
              <Link href={`/jeu/${g.slug}`} className={`${btnSoft} inline-flex items-center`}>
                Voir ↗
              </Link>
            )}
            <button type="button" disabled={pending} onClick={() => act(() => setGamePublished(g.id, !g.published))} className={btnSoft}>
              {g.published ? "Retirer du catalogue" : "Publier"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (window.confirm(`Supprimer définitivement « ${g.title} » ?`)) act(() => deleteGame(g.id));
              }}
              className={btnDanger}
            >
              Supprimer
            </button>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="text-sm text-[var(--portal-muted)]">Aucun jeu.</p>}
    </div>
  );
}

// ------------------------------------------------------------ commentaires

function Comments({ data, act, pending }: { data: AdminData } & ActProps) {
  const [q, setQ] = useState("");
  const list = data.comments.filter((c) => {
    const s = q.trim().toLowerCase();
    return !s || c.text.toLowerCase().includes(s) || c.author.toLowerCase().includes(s);
  });
  return (
    <div className="space-y-4">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Texte ou auteur…" aria-label="Chercher un commentaire" className={`${input} w-full @lg:w-80`} />
      <ul className="space-y-2">
        {list.map((c) => (
          <li key={c.id} className={`${card} flex flex-wrap items-start gap-3 p-4`}>
            <div className="min-w-0 flex-1">
              <p className="whitespace-pre-wrap break-words text-sm">{c.text}</p>
              <p className="mt-1 text-xs text-[var(--portal-muted)]">
                {c.author} sur{" "}
                {c.gameSlug ? (
                  <Link href={`/jeu/${c.gameSlug}`} className="underline">
                    {c.game}
                  </Link>
                ) : (
                  c.game
                )}{" "}
                · {date(c.createdAt, true)}
              </p>
            </div>
            <button type="button" disabled={pending} onClick={() => act(() => deleteComment(c.id))} className={btnDanger}>
              Supprimer
            </button>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="text-sm text-[var(--portal-muted)]">Aucun commentaire.</p>}
    </div>
  );
}

// ------------------------------------------------------------- signalements

function Reports({ data, act, pending }: { data: AdminData } & ActProps) {
  const [status, setStatus] = useState<"ouvert" | "tous">("ouvert");
  const list = data.reports.filter((r) => status === "tous" || r.status === "ouvert");
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["ouvert", "tous"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            aria-pressed={status === s}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${status === s ? "bg-[var(--portal-accent)] text-white" : "bg-[var(--portal-soft)] text-[var(--portal-muted)]"}`}
          >
            {s === "ouvert" ? "À traiter" : "Tous"}
          </button>
        ))}
      </div>
      <ul className="space-y-2">
        {list.map((r) => (
          <li key={r.id} className={`${card} space-y-2 p-4`}>
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={r.status === "ouvert" ? "rouge" : r.status === "traité" ? "vert" : "gris"}>{r.status}</Pill>
              <b>{r.reason}</b>
              <span className="text-sm text-[var(--portal-muted)]">
                sur{" "}
                {r.gameSlug ? (
                  <Link href={`/jeu/${r.gameSlug}`} className="underline">
                    {r.game}
                  </Link>
                ) : (
                  r.game
                )}{" "}
                · par {r.reporter} · {date(r.createdAt, true)}
              </span>
            </div>
            {r.details && <p className="whitespace-pre-wrap break-words text-sm">{r.details}</p>}
            <div className="flex flex-wrap gap-2">
              {r.status !== "traité" && (
                <button type="button" disabled={pending} onClick={() => act(() => setReportStatus(r.id, "traité"))} className={btnMain}>
                  Marquer traité
                </button>
              )}
              {r.status === "ouvert" && (
                <button type="button" disabled={pending} onClick={() => act(() => setReportStatus(r.id, "rejeté"))} className={btnSoft}>
                  Rejeter
                </button>
              )}
              {r.status !== "ouvert" && (
                <button type="button" disabled={pending} onClick={() => act(() => setReportStatus(r.id, "ouvert"))} className={btnSoft}>
                  Rouvrir
                </button>
              )}
              {r.gameSlug && r.gamePublished && (
                <button type="button" disabled={pending} onClick={() => act(() => setGamePublished(r.gameId, false))} className={btnSoft}>
                  Retirer le jeu du catalogue
                </button>
              )}
              {r.gameSlug && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm(`Supprimer définitivement « ${r.game} » ?`)) act(() => deleteGame(r.gameId));
                  }}
                  className={btnDanger}
                >
                  Supprimer le jeu
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="text-sm text-[var(--portal-muted)]">Aucun signalement {status === "ouvert" ? "à traiter" : ""}.</p>}
    </div>
  );
}

// ------------------------------------------------------------ triches en jeu

function Cheats({ data, act, pending }: { data: AdminData } & ActProps) {
  const [on, setOn] = useState(() => new Set(data.cheatGames.filter((g) => g.on).map((g) => g.slug)));
  return (
    <div className={`${card} max-w-2xl space-y-4 p-5`}>
      <div>
        <h2 className="text-lg font-bold">Triches en jeu</h2>
        <p className="mt-1 text-sm text-[var(--portal-muted)]">
          Les modes développeur des jeux n&apos;apparaissent plus en jeu tant que tu ne les actives pas ici. Réglage valable sur <b>ce</b>{" "}
          navigateur, pour ton compte admin uniquement. En ligne contre de vrais joueurs, les triches restent toujours coupées, et une partie
          trichée ne rapporte rien.
        </p>
      </div>
      <ul className="space-y-2">
        {data.cheatGames.map((g) => (
          <li key={g.slug}>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--portal-line)] p-3 hover:border-[var(--portal-accent)]">
              <input
                type="checkbox"
                className="mt-1"
                checked={on.has(g.slug)}
                onChange={(e) => {
                  const next = new Set(on);
                  if (e.target.checked) next.add(g.slug);
                  else next.delete(g.slug);
                  setOn(next);
                }}
              />
              <span>
                <b>{g.label}</b>
                <span className="block text-xs text-[var(--portal-muted)]">{g.hint}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <button type="button" disabled={pending} onClick={() => act(() => setCheatGames([...on]))} className={btnMain}>
        Enregistrer
      </button>
    </div>
  );
}

// -------------------------------------------------------------------- journal

function Log({ data }: { data: AdminData }) {
  if (!data.migrationReady) {
    return <p className="text-sm text-[var(--portal-muted)]">Le journal apparaît une fois le fichier SQL du panneau lancé dans Supabase.</p>;
  }
  if (data.log.length === 0) return <p className="text-sm text-[var(--portal-muted)]">Aucune action pour l&apos;instant.</p>;
  return (
    <ul className={`${card} divide-y divide-[var(--portal-line)]`}>
      {data.log.map((l) => (
        <li key={l.id} className="flex flex-wrap gap-x-3 gap-y-1 p-3 text-sm">
          <span className="w-32 shrink-0 text-[var(--portal-muted)]">{date(l.createdAt, true)}</span>
          <b className="shrink-0">{l.admin}</b>
          <span className="min-w-0 flex-1">{l.details || l.action}</span>
        </li>
      ))}
    </ul>
  );
}
