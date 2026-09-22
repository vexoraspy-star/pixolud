"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import "./friends.css";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { subscribeOnline, type OnlinePlayer } from "@/lib/livePresence";
import Avatar from "./Avatar";
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
  avatarUrl?: string | null;
  frame?: string | null;
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
      // La moderation peut laisser passer le message AVEC un rappel (par
      // exemple un numero de telephone masque) : il faut le montrer.
      if (r.message) setToast(r.message);
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
    <div className="portal-container portal-page friends-page">
      <div className="friends-wrap">
        <header className="friends-intro">
          <div><p className="friends-eyebrow">LE COIN DES AMIS</p><h1>Mes amis<span aria-hidden="true">.</span></h1><p>Retrouve ta bande. Prépare la prochaine partie.</p></div>
          <div className="friends-summary"><span className="friends-summary-icon" aria-hidden="true">✦</span><div><strong>{amis.length} {amis.length === 1 ? "ami" : "amis"}</strong><span><i className="friend-dot is-online" />{amis.filter(a => estEnLigne(a.userId)).length} en ligne</span></div></div>
        </header>

        {!pret && <p className="friends-notice">Le chat n&apos;est pas encore activé : lance <code>supabase/add_amis_chat.sql</code> dans Supabase (SQL Editor → New query → Run).</p>}
        {toast && <p role="status" className="friends-toast">{toast}<button type="button" onClick={() => setToast(null)} aria-label="Fermer">×</button></p>}

        <div className="friends-layout">
          <aside className="friends-sidebar" aria-label="Amis et invitations">
            <section className="friends-card friend-search">
              <div className="friends-section-title"><h2>Ajouter un ami</h2><span aria-hidden="true">＋</span></div>
              <p>Tout commence par un pseudo.</p>
              <div className="friend-search-input"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg><input value={recherche} onChange={e => chercher(e.target.value)} placeholder="Chercher un pseudo…" aria-label="Chercher un joueur" /></div>
              <ul className="friend-search-results">
                {trouves.map(p => <li key={p.id}><span className="friend-result-name">{p.pseudo} {p.verified && <span className="friend-verified" title="Compte vérifié">✓</span>}</span>{dejaVus.has(p.id) ? <span className="friend-result-status">Déjà ajouté</span> : <button type="button" disabled={pending} onClick={() => agir(() => demanderAmi(p.id))} className="portal-button small">Ajouter</button>}</li>)}
                {recherche.trim().length >= 2 && trouves.length === 0 && <li className="friends-muted">Personne de ce nom.</li>}
              </ul>
            </section>

            {recues.length > 0 && <section className="friends-card friend-invites"><div className="friends-section-title"><h2>Invitations</h2><span className="friend-count">{recues.length}</span></div><ul>{recues.map(d => <li key={d.id}><div className="friend-invite-name"><FriendAvatar pseudo={d.pseudo} url={d.avatarUrl} frame={d.frame}/><strong>{d.pseudo}</strong></div><div className="friend-invite-actions"><button type="button" disabled={pending} onClick={() => agir(() => accepterAmi(d.id))} className="portal-button small">Accepter</button><button type="button" disabled={pending} onClick={() => agir(() => retirerAmi(d.id))} className="portal-button secondary small">Refuser</button></div></li>)}</ul></section>}

            <section className="friends-card friend-list-card">
              <div className="friends-section-title"><h2>Tes conversations</h2><span className="friend-count">{amis.length}</span></div>
              {amis.length === 0 ? <div className="friend-list-empty"><span aria-hidden="true">✧</span><p>Ta bande commence ici.</p><span>Ajoute un ami grâce à son pseudo.</span></div> : <ul className="friend-list">{amis.map(a => <li key={a.id}><button type="button" onClick={() => setActif(a)} aria-current={actif?.id === a.id ? "true" : undefined} className="friend-row"><FriendAvatar pseudo={a.pseudo} online={estEnLigne(a.userId)} url={a.avatarUrl} frame={a.frame}/><span className="friend-row-copy"><strong>{a.pseudo} {a.verified && <span className="friend-verified" title="Compte vérifié">✓</span>}</strong><span>{estEnLigne(a.userId) ? "En ligne sur Pixolud" : "Hors ligne"}</span></span><span className="friend-row-arrow" aria-hidden="true">›</span></button></li>)}</ul>}
              {envoyees.length > 0 && <p className="friend-pending">En attente de réponse : <strong>{envoyees.map(e => e.pseudo).join(", ")}</strong></p>}
            </section>
            <p className="friends-presence-note"><i className="friend-dot is-online" />Le point vert indique une présence sur le site.</p>
          </aside>

          <section className="friend-chat" aria-label={actif ? `Discussion avec ${actif.pseudo}` : "Discussion"}>
            {actif ? <>
              <header className="friend-chat-heading">
                <FriendAvatar pseudo={actif.pseudo} online={estEnLigne(actif.userId)} url={actif.avatarUrl} frame={actif.frame}/>
                <div className="friend-chat-identity"><h2>{actif.pseudo} {actif.verified && <span className="friend-verified" title="Compte vérifié">✓</span>}</h2><p>{estEnLigne(actif.userId) ? "En ligne sur Pixolud" : "Hors ligne"}</p></div>
                <div className="friend-chat-actions"><Link href={`/profil/${encodeURIComponent(actif.pseudo)}`}>Son profil <span aria-hidden="true">↗</span></Link><button type="button" onClick={() => { if (window.confirm(`Retirer ${actif.pseudo} de tes amis ?`)) { agir(() => retirerAmi(actif.id)); setActif(null); } }} className="friend-remove">Retirer</button></div>
              </header>

              <div ref={fil} className="friend-chat-thread" role="log" aria-label="Messages de la conversation" aria-live="polite" aria-relevant="additions">
                {messages.length === 0 ? <div className="friend-chat-empty"><div className="friend-empty-art" aria-hidden="true"><span>✦</span><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 14h32a8 8 0 0 1 8 8v16a8 8 0 0 1-8 8H25L12 56V14Z"/><path d="M23 26h18M23 34h12" strokeLinecap="round"/></svg></div><h3>À vous d’écrire la suite.</h3><p>Un petit bonjour à {actif.pseudo},<br/>et la conversation est lancée.</p></div> : <>
                  <div className="friend-thread-label"><span>Votre conversation</span></div>
                  {messages.map(m => <div key={m.id} className={`friend-message ${m.deMoi ? "from-me" : "from-friend"}`}><div className="friend-message-body"><p>{m.texte}</p><span className="friend-message-meta"><span>{m.deMoi ? "Toi" : actif.pseudo}</span>{Number.isFinite(Date.parse(m.le)) && <time dateTime={m.le} title={new Date(m.le).toLocaleString("fr-FR")}>{new Date(m.le).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</time>}</span></div></div>)}
                </>}
              </div>

              <form onSubmit={e => { e.preventDefault(); envoyer(); }} className="friend-composer">
                <div className="friend-composer-row"><input value={texte} onChange={e => setTexte(e.target.value)} maxLength={1000} placeholder={`Ton message à ${actif.pseudo}…`} aria-label="Message" /><button type="submit" disabled={pending || !texte.trim()} className="friend-send"><span>Envoyer</span><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m4 4 17 8-17 8 3-8-3-8Z" strokeLinejoin="round"/><path d="M7 12h14"/></svg></button></div>
                <div className="friend-composer-hint"><span>Entrée pour envoyer</span><span>{texte.length} / 1 000</span></div>
              </form>
            </> : <div className="friend-chat-empty"><div className="friend-empty-art" aria-hidden="true">✦</div><h3>Une place pour ta bande.</h3><p>Choisis un ami pour discuter.<br/>Ou invite quelqu’un avec son pseudo.</p></div>}
          </section>
        </div>
      </div>
    </div>
  );
}

function FriendAvatar({ pseudo, online, url, frame }: { pseudo: string; online?: boolean; url?: string | null; frame?: string | null }) {
  // Avec une photo, on montre la photo dans son cadre ; sinon les initiales,
  // comme avant. Le point de presence reste pose par-dessus.
  return (
    <span className="friend-avatar-wrap" aria-hidden="true">
      {url ? <Avatar pseudo={pseudo} url={url} frame={frame} taille={40} /> : <span className="friend-avatar">{Array.from(pseudo).slice(0,2).join("").toUpperCase()}</span>}
      {online !== undefined && <i className={online ? "friend-dot is-online" : "friend-dot"}/>}
    </span>
  );
}
