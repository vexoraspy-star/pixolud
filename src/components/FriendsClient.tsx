"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { subscribeOnline, type OnlinePlayer } from "@/lib/livePresence";
import {
  accepterAmi,
  chercherJoueurs,
  demanderAmi,
  envoyerMessage,
  lireMessages,
  retirerAmi,
  type ChatMessage,
} from "@/app/amis/actions";

export interface Ami {
  /** Identifiant de l'amitie : c'est aussi celui de la conversation. */
  id: string;
  userId: string;
  pseudo: string;
  verified: boolean;
}
export type Demande = Ami;

/**
 * Liste d'amis et discussion.
 *
 * Les messages sont lus et ecrits cote serveur (regles de la base). Le canal
 * temps reel ne sert qu'a prevenir « il y a du nouveau » : meme falsifie, il
 * ne peut pas fabriquer un message, puisque l'autre cote relit la base.
 */
export default function FriendsClient({
  amis,
  recues,
  envoyees,
  pret,
}: {
  amis: Ami[];
  recues: Demande[];
  envoyees: Demande[];
  pret: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [actif, setActif] = useState<Ami | null>(amis[0] ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [texte, setTexte] = useState("");
  const [recherche, setRecherche] = useState("");
  const [trouves, setTrouves] = useState<{ id: string; pseudo: string; verified: boolean }[]>([]);
  const [enLigne, setEnLigne] = useState<OnlinePlayer[]>([]);
  const fil = useRef<HTMLDivElement>(null);
  const canal = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  useEffect(() => subscribeOnline(setEnLigne), []);
  const estEnLigne = (userId: string) => enLigne.some((p) => p.userId === userId);

  const charger = useCallback(
    async (id: string) => {
      const list = await lireMessages(id);
      setMessages(list);
    },
    [],
  );

  // Conversation ouverte : on lit l'historique, puis on ecoute le canal.
  useEffect(() => {
    if (!actif) return;
    const premier = setTimeout(() => void charger(actif.id), 0);
    const supabase = createClient();
    const channel = supabase.channel(`amis-${actif.id}`, { config: { broadcast: { self: false } } });
    canal.current = channel;
    channel.on("broadcast", { event: "nouveau" }, () => void charger(actif.id)).subscribe();
    // Filet de secours si le signal se perd.
    const iv = setInterval(() => void charger(actif.id), 20000);
    return () => {
      clearTimeout(premier);
      clearInterval(iv);
      canal.current = null;
      supabase.removeChannel(channel);
    };
  }, [actif, charger]);

  // Toujours afficher le dernier message.
  useEffect(() => {
    fil.current?.scrollTo({ top: fil.current.scrollHeight });
  }, [messages]);

  function agir(run: () => Promise<{ ok: boolean; message: string }>) {
    start(async () => {
      const r = await run();
      if (r.message) setToast(r.message);
      if (r.ok) router.refresh();
    });
  }

  function envoyer() {
    const contenu = texte.trim();
    if (!contenu || !actif) return;
    setTexte("");
    start(async () => {
      const r = await envoyerMessage(actif.id, contenu);
      if (!r.ok) {
        setToast(r.message);
        setTexte(contenu);
        return;
      }
      await charger(actif.id);
      canal.current?.send({ type: "broadcast", event: "nouveau", payload: {} });
    });
  }

  function chercher(valeur: string) {
    setRecherche(valeur);
    start(async () => setTrouves(await chercherJoueurs(valeur)));
  }

  const dejaVus = new Set([...amis, ...recues, ...envoyees].map((a) => a.userId));

  return (
    <div className="portal-container portal-page">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--portal-accent)]">Entre joueurs</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">Mes amis</h1>
        <p className="mt-2 text-sm text-[var(--portal-muted)]">
          Ajoute tes amis par leur pseudo, puis discutez ici. Le point vert veut dire qu&apos;ils sont sur le site en ce moment.
        </p>

        {!pret && (
          <p className="mt-6 rounded-2xl border border-amber-400/50 bg-amber-400/10 p-4 text-sm">
            Le chat n&apos;est pas encore activé : lance <code>supabase/add_amis_chat.sql</code> dans Supabase (SQL Editor →
            New query → Run).
          </p>
        )}

        {toast && (
          <p role="status" className="mt-4 rounded-xl bg-[var(--portal-soft)] px-4 py-2.5 text-sm font-semibold">
            {toast}{" "}
            <button type="button" onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100" aria-label="Fermer">
              ✕
            </button>
          </p>
        )}

        <div className="mt-8 grid gap-5 lg:grid-cols-[19rem_1fr]">
          {/* --- Colonne gauche : recherche, demandes, amis --- */}
          <div className="space-y-5">
            <section className="rounded-2xl border border-[var(--portal-line)] bg-[var(--portal-surface)] p-4">
              <h2 className="text-sm font-bold">Ajouter un ami</h2>
              <input
                value={recherche}
                onChange={(e) => chercher(e.target.value)}
                placeholder="Son pseudo…"
                aria-label="Chercher un joueur"
                className="mt-2 w-full rounded-lg border border-[var(--portal-line)] bg-[var(--portal-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--portal-accent)]"
              />
              <ul className="mt-2 space-y-1">
                {trouves.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--portal-soft)]">
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {p.pseudo} {p.verified && <span className="text-sky-500">✔</span>}
                    </span>
                    {dejaVus.has(p.id) ? (
                      <span className="text-xs text-[var(--portal-muted)]">déjà ajouté</span>
                    ) : (
                      <button type="button" disabled={pending} onClick={() => agir(() => demanderAmi(p.id))} className="portal-button small">
                        Ajouter
                      </button>
                    )}
                  </li>
                ))}
                {recherche.trim().length >= 2 && trouves.length === 0 && (
                  <li className="px-2 py-1.5 text-xs text-[var(--portal-muted)]">Personne de ce nom.</li>
                )}
              </ul>
            </section>

            {recues.length > 0 && (
              <section className="rounded-2xl border border-[var(--portal-accent)] bg-[var(--portal-surface)] p-4">
                <h2 className="text-sm font-bold">Demandes reçues ({recues.length})</h2>
                <ul className="mt-2 space-y-2">
                  {recues.map((d) => (
                    <li key={d.id} className="flex items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate font-semibold">{d.pseudo}</span>
                      <button type="button" disabled={pending} onClick={() => agir(() => accepterAmi(d.id))} className="portal-button small">
                        Accepter
                      </button>
                      <button type="button" disabled={pending} onClick={() => agir(() => retirerAmi(d.id))} className="portal-button secondary small">
                        Refuser
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="rounded-2xl border border-[var(--portal-line)] bg-[var(--portal-surface)] p-4">
              <h2 className="text-sm font-bold">
                Mes amis <span className="text-[var(--portal-muted)]">({amis.length})</span>
              </h2>
              {amis.length === 0 ? (
                <p className="mt-2 text-xs text-[var(--portal-muted)]">Personne pour l&apos;instant. Cherche un pseudo juste au-dessus.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {amis.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => setActif(a)}
                        aria-current={actif?.id === a.id ? "true" : undefined}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm ${
                          actif?.id === a.id ? "bg-[var(--portal-accent)] text-white" : "hover:bg-[var(--portal-soft)]"
                        }`}
                      >
                        <span className={`size-2 shrink-0 rounded-full ${estEnLigne(a.userId) ? "bg-emerald-400" : "bg-zinc-500/50"}`} />
                        <span className="min-w-0 flex-1 truncate font-semibold">
                          {a.pseudo} {a.verified && <span className="text-sky-400">✔</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {envoyees.length > 0 && (
                <p className="mt-3 border-t border-[var(--portal-line)] pt-2 text-xs text-[var(--portal-muted)]">
                  En attente de réponse : {envoyees.map((e) => e.pseudo).join(", ")}
                </p>
              )}
            </section>
          </div>

          {/* --- Colonne droite : la discussion --- */}
          <section className="flex min-h-[28rem] flex-col rounded-2xl border border-[var(--portal-line)] bg-[var(--portal-surface)]">
            {actif ? (
              <>
                <header className="flex items-center gap-2 border-b border-[var(--portal-line)] px-4 py-3">
                  <span className={`size-2 rounded-full ${estEnLigne(actif.userId) ? "bg-emerald-400" : "bg-zinc-500/50"}`} />
                  <b className="text-sm">{actif.pseudo}</b>
                  <span className="text-xs text-[var(--portal-muted)]">{estEnLigne(actif.userId) ? "en ligne" : "hors ligne"}</span>
                  <Link href={`/profil/${encodeURIComponent(actif.pseudo)}`} className="ml-auto text-xs text-[var(--portal-accent)] underline">
                    Son profil
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Retirer ${actif.pseudo} de tes amis ?`)) {
                        agir(() => retirerAmi(actif.id));
                        setActif(null);
                      }
                    }}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Retirer
                  </button>
                </header>

                <div ref={fil} className="flex-1 space-y-2 overflow-y-auto p-4">
                  {messages.length === 0 && (
                    <p className="py-10 text-center text-xs text-[var(--portal-muted)]">
                      Aucun message. Dis bonjour à {actif.pseudo} !
                    </p>
                  )}
                  {messages.map((m) => (
                    <div key={m.id} className={`flex ${m.deMoi ? "justify-end" : "justify-start"}`}>
                      <p
                        className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
                          m.deMoi ? "bg-[var(--portal-accent)] text-white" : "bg-[var(--portal-soft)]"
                        }`}
                      >
                        {m.texte}
                      </p>
                    </div>
                  ))}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    envoyer();
                  }}
                  className="flex gap-2 border-t border-[var(--portal-line)] p-3"
                >
                  <input
                    value={texte}
                    onChange={(e) => setTexte(e.target.value)}
                    maxLength={1000}
                    placeholder={`Écris à ${actif.pseudo}…`}
                    aria-label="Message"
                    className="min-w-0 flex-1 rounded-full border border-[var(--portal-line)] bg-[var(--portal-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--portal-accent)]"
                  />
                  <button type="submit" disabled={pending || !texte.trim()} className="portal-button small">
                    Envoyer
                  </button>
                </form>
              </>
            ) : (
              <p className="m-auto p-10 text-center text-sm text-[var(--portal-muted)]">
                Choisis un ami à gauche pour discuter.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
