"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { subscribeOnline, type OnlinePlayer } from "@/lib/livePresence";
import Avatar from "./Avatar";
import {
  accepterAmi,
  chercherJoueurs,
  demanderAmi,
  envoyerMessage,
  lireMessages,
  mesAmis,
  retirerAmi,
  type AmiLigne,
  type ChatMessage,
} from "@/app/amis/actions";
import {
  creerParty,
  envoyerAuParty,
  inviterAuParty,
  lireParty,
  monParty,
  quitterParty,
  renommerParty,
  type PartyEtat,
  type PartyMessage,
} from "@/app/amis/party";

/**
 * Le panneau d'amis flottant, sur le cote.
 *
 * Meme idee que la radio et Pixo : un bouton toujours la, et un panneau qui
 * s'ouvre par-dessus la page. On peut donc parler a ses amis sans quitter sa
 * partie — c'etait tout l'interet de le sortir de la page /amis.
 *
 * Deux onglets : les amis (chercher, accepter, discuter) et la party, un
 * groupe avec un chef, ou tout le monde parle meme si personne ne joue au
 * meme jeu.
 */
type Onglet = "amis" | "party";

export default function FriendsDock() {
  const [ouvert, setOuvert] = useState(false);
  const [onglet, setOnglet] = useState<Onglet>("amis");
  const [amis, setAmis] = useState<AmiLigne[]>([]);
  const [recues, setRecues] = useState<AmiLigne[]>([]);
  const [pret, setPret] = useState(true);
  const [enLigne, setEnLigne] = useState<OnlinePlayer[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // --- Conversation privee
  const [actif, setActif] = useState<AmiLigne | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [texte, setTexte] = useState("");

  // --- Party
  const [party, setParty] = useState<PartyEtat>({ party: null, membres: [], pret: true });
  const [partyMessages, setPartyMessages] = useState<PartyMessage[]>([]);
  const [partyTexte, setPartyTexte] = useState("");

  const fil = useRef<HTMLDivElement>(null);
  const canal = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  useEffect(() => subscribeOnline(setEnLigne), []);
  const estEnLigne = (userId: string) => enLigne.some((p) => p.userId === userId);

  const chargerListes = useCallback(async () => {
    const [a, p] = await Promise.all([mesAmis(), monParty()]);
    setAmis(a.amis);
    setRecues(a.recues);
    setPret(a.pret);
    setParty(p);
  }, []);

  // A l'ouverture : on lit les listes. Puis toutes les 60 secondes, pour voir
  // arriver une demande d'ami ou une invitation de party.
  useEffect(() => {
    if (!ouvert) return;
    const premier = setTimeout(() => void chargerListes(), 0);
    const iv = setInterval(() => void chargerListes(), 60000);
    return () => {
      clearTimeout(premier);
      clearInterval(iv);
    };
  }, [ouvert, chargerListes]);

  // Conversation ouverte : historique, canal temps reel, filet de secours.
  useEffect(() => {
    if (!actif) return;
    const charger = () => void lireMessages(actif.id).then(setMessages);
    const premier = setTimeout(charger, 0);
    const supabase = createClient();
    const channel = supabase.channel(`amis-${actif.id}`, { config: { broadcast: { self: false } } });
    canal.current = channel;
    channel.on("broadcast", { event: "nouveau" }, charger).subscribe();
    const iv = setInterval(charger, 20000);
    return () => {
      clearTimeout(premier);
      clearInterval(iv);
      canal.current = null;
      supabase.removeChannel(channel);
    };
  }, [actif]);

  // Party ouverte : pareil, sur son propre canal.
  const partyId = party.party?.id ?? null;
  useEffect(() => {
    if (!partyId || onglet !== "party") return;
    const charger = () => void lireParty(partyId).then(setPartyMessages);
    const premier = setTimeout(charger, 0);
    const supabase = createClient();
    const channel = supabase.channel(`party-${partyId}`, { config: { broadcast: { self: false } } });
    canal.current = channel;
    channel.on("broadcast", { event: "nouveau" }, charger).subscribe();
    const iv = setInterval(charger, 20000);
    return () => {
      clearTimeout(premier);
      clearInterval(iv);
      supabase.removeChannel(channel);
    };
  }, [partyId, onglet]);

  useEffect(() => {
    fil.current?.scrollTo({ top: fil.current.scrollHeight });
  }, [messages, partyMessages]);

  function agir(run: () => Promise<{ ok: boolean; message: string }>) {
    start(async () => {
      const r = await run();
      if (r.message) setNote(r.message);
      if (r.ok) await chargerListes();
    });
  }

  function envoyer() {
    const contenu = texte.trim();
    if (!contenu || !actif) return;
    setTexte("");
    start(async () => {
      const r = await envoyerMessage(actif.id, contenu);
      if (!r.ok) {
        setNote(r.message);
        setTexte(contenu);
        return;
      }
      if (r.message) setNote(r.message);
      setMessages(await lireMessages(actif.id));
      canal.current?.send({ type: "broadcast", event: "nouveau", payload: {} });
    });
  }

  function envoyerParty() {
    const contenu = partyTexte.trim();
    if (!contenu || !partyId) return;
    setPartyTexte("");
    start(async () => {
      const r = await envoyerAuParty(partyId, contenu);
      if (!r.ok) {
        setNote(r.message);
        setPartyTexte(contenu);
        return;
      }
      if (r.message) setNote(r.message);
      setPartyMessages(await lireParty(partyId));
      canal.current?.send({ type: "broadcast", event: "nouveau", payload: {} });
    });
  }

  const dansLaParty = new Set(party.membres.map((m) => m.userId));

  return (
    <div data-site-chrome className="friends-dock">
      {ouvert && (
        <section className="utility-panel friends-panel" aria-label="Mes amis">
          <header className="utility-heading">
            <span className="utility-emblem friends-emblem" aria-hidden="true">👥</span>
            <div>
              <p className="utility-kicker">ENTRE JOUEURS</p>
              <h2>Mes amis</h2>
            </div>
            <button type="button" onClick={() => setOuvert(false)} aria-label="Fermer le panneau des amis" className="utility-close">
              ×
            </button>
          </header>

          <div className="friends-tabs">
            {(
              [
                ["amis", `Amis (${amis.length})`],
                ["party", party.party ? `Party (${party.membres.length})` : "Party"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setOnglet(id)} aria-pressed={onglet === id}>
                {label}
              </button>
            ))}
          </div>

          {!pret && (
            <p className="friends-dock-note">
              Le chat n&apos;est pas encore activé : lance <code>supabase/add_amis_chat.sql</code> dans Supabase.
            </p>
          )}
          {note && (
            <p role="status" className="friends-dock-note">
              {note}
              <button type="button" onClick={() => setNote(null)} aria-label="Fermer">×</button>
            </p>
          )}

          {onglet === "amis" ? (
            actif ? (
              <ChatPrive
                ami={actif}
                messages={messages}
                texte={texte}
                setTexte={setTexte}
                envoyer={envoyer}
                retour={() => setActif(null)}
                enLigne={estEnLigne(actif.userId)}
                fil={fil}
                pending={pending}
              />
            ) : (
              <ListeAmis
                amis={amis}
                recues={recues}
                estEnLigne={estEnLigne}
                ouvrir={setActif}
                agir={agir}
                pending={pending}
              />
            )
          ) : (
            <Party
              etat={party}
              amis={amis}
              dansLaParty={dansLaParty}
              messages={partyMessages}
              texte={partyTexte}
              setTexte={setPartyTexte}
              envoyer={envoyerParty}
              agir={agir}
              pending={pending}
              fil={fil}
            />
          )}

          <footer className="pixo-footer">
            <span className="pixo-status-dot" />
            <Link href="/amis">Ouvrir la grande page ↗</Link>
          </footer>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-label="Mes amis"
        title="Mes amis et ma party"
        className="utility-launcher friends-launcher"
      >
        <span aria-hidden="true">👥</span>
        <span>Amis</span>
        {recues.length > 0 && <b className="friends-badge">{recues.length}</b>}
      </button>
    </div>
  );
}

// ------------------------------------------------------------ liste d'amis

function ListeAmis({
  amis,
  recues,
  estEnLigne,
  ouvrir,
  agir,
  pending,
}: {
  amis: AmiLigne[];
  recues: AmiLigne[];
  estEnLigne: (id: string) => boolean;
  ouvrir: (a: AmiLigne) => void;
  agir: (run: () => Promise<{ ok: boolean; message: string }>) => void;
  pending: boolean;
}) {
  const [recherche, setRecherche] = useState("");
  const [trouves, setTrouves] = useState<{ id: string; pseudo: string; verified: boolean }[]>([]);
  const [, start] = useTransition();
  const dejaVus = new Set(amis.concat(recues).map((a) => a.userId));

  return (
    <div className="friends-dock-scroll">
      <div className="friends-dock-add">
        <input
          value={recherche}
          onChange={(e) => {
            setRecherche(e.target.value);
            start(async () => setTrouves(await chercherJoueurs(e.target.value)));
          }}
          placeholder="Ajouter un ami : son pseudo…"
          aria-label="Chercher un joueur"
        />
        {trouves.length > 0 && (
          <ul className="friends-dock-results">
            {trouves.map((p) => (
              <li key={p.id}>
                <span>{p.pseudo} {p.verified && <b className="friend-verified">✓</b>}</span>
                {dejaVus.has(p.id) ? (
                  <em>déjà ajouté</em>
                ) : (
                  <button type="button" disabled={pending} onClick={() => agir(() => demanderAmi(p.id))}>
                    Ajouter
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {recues.length > 0 && (
        <section className="friends-dock-section">
          <h3>Invitations reçues<span>{recues.length}</span></h3>
          <ul className="friends-dock-invites">
            {recues.map((d) => (
              <li key={d.id}>
                <Avatar pseudo={d.pseudo} url={d.avatarUrl} frame={d.frame} taille={30} />
                <strong>{d.pseudo}</strong>
                <button type="button" disabled={pending} onClick={() => agir(() => accepterAmi(d.id))}>Accepter</button>
                <button type="button" disabled={pending} onClick={() => agir(() => retirerAmi(d.id))} className="is-soft">Refuser</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="friends-dock-section">
        <h3>Mes amis<span>{amis.length}</span></h3>
        {amis.length === 0 ? (
          <p className="friends-dock-empty">Personne pour l&apos;instant. Cherche un pseudo juste au-dessus.</p>
        ) : (
          <ul className="friends-dock-list">
            {amis.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => ouvrir(a)}>
                  <Avatar pseudo={a.pseudo} url={a.avatarUrl} frame={a.frame} taille={34} />
                  <span>
                    <strong>{a.pseudo} {a.verified && <b className="friend-verified">✓</b>}</strong>
                    <em>{estEnLigne(a.userId) ? "En ligne" : "Hors ligne"}</em>
                  </span>
                  <i className={estEnLigne(a.userId) ? "friend-dot is-online" : "friend-dot"} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ------------------------------------------------------- conversation a deux

function ChatPrive({
  ami,
  messages,
  texte,
  setTexte,
  envoyer,
  retour,
  enLigne,
  fil,
  pending,
}: {
  ami: AmiLigne;
  messages: ChatMessage[];
  texte: string;
  setTexte: (v: string) => void;
  envoyer: () => void;
  retour: () => void;
  enLigne: boolean;
  fil: React.RefObject<HTMLDivElement | null>;
  pending: boolean;
}) {
  return (
    <div className="friends-dock-chat">
      <div className="friends-dock-chat-head">
        <button type="button" onClick={retour} aria-label="Revenir à la liste">‹</button>
        <Avatar pseudo={ami.pseudo} url={ami.avatarUrl} frame={ami.frame} taille={30} />
        <span>
          <strong>{ami.pseudo}</strong>
          <em>{enLigne ? "En ligne" : "Hors ligne"}</em>
        </span>
      </div>
      <div ref={fil} className="friends-dock-thread" role="log" aria-live="polite">
        {messages.length === 0 && <p className="friends-dock-empty">Dis bonjour à {ami.pseudo} !</p>}
        {messages.map((m) => (
          <p key={m.id} className={m.deMoi ? "pixo-bubble from-me" : "pixo-bubble from-pixo"}>
            {m.texte}
          </p>
        ))}
      </div>
      <form
        className="pixo-chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          envoyer();
        }}
      >
        <input value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={1000} placeholder={`Message à ${ami.pseudo}…`} aria-label="Message" />
        <button type="submit" disabled={pending || !texte.trim()}>Envoyer</button>
      </form>
    </div>
  );
}

// ------------------------------------------------------------------- party

function Party({
  etat,
  amis,
  dansLaParty,
  messages,
  texte,
  setTexte,
  envoyer,
  agir,
  pending,
  fil,
}: {
  etat: PartyEtat;
  amis: AmiLigne[];
  dansLaParty: Set<string>;
  messages: PartyMessage[];
  texte: string;
  setTexte: (v: string) => void;
  envoyer: () => void;
  agir: (run: () => Promise<{ ok: boolean; message: string }>) => void;
  pending: boolean;
  fil: React.RefObject<HTMLDivElement | null>;
}) {
  const [nom, setNom] = useState("");

  if (!etat.pret) {
    return (
      <p className="friends-dock-note">
        Le mode party n&apos;est pas encore activé : lance <code>supabase/add_profil_et_party.sql</code> dans Supabase.
      </p>
    );
  }

  if (!etat.party) {
    return (
      <div className="friends-dock-scroll">
        <section className="friends-dock-section">
          <h3>Créer une party</h3>
          <p className="friends-dock-empty">
            Une party, c&apos;est un salon entre amis : vous discutez tous ensemble, même si vous n&apos;êtes pas dans le
            même jeu. Celui qui la crée en est le chef.
          </p>
          <form
            className="pixo-chat-form"
            onSubmit={(e) => {
              e.preventDefault();
              agir(() => creerParty(nom));
              setNom("");
            }}
          >
            <input value={nom} onChange={(e) => setNom(e.target.value)} maxLength={40} placeholder="Nom de la party…" aria-label="Nom de la party" />
            <button type="submit" disabled={pending}>Créer</button>
          </form>
        </section>
      </div>
    );
  }

  const { party, membres } = etat;
  const invitables = amis.filter((a) => !dansLaParty.has(a.userId));

  return (
    <div className="friends-dock-chat">
      <div className="friends-dock-chat-head">
        <span className="utility-emblem friends-emblem" aria-hidden="true">🎉</span>
        <span>
          <strong>{party.nom}</strong>
          <em>{membres.length} membre{membres.length > 1 ? "s" : ""}{party.jeSuisChef ? " · tu es le chef" : ""}</em>
        </span>
        <Link
          href={`/pixocall?salon=${party.id.slice(0, 8).toUpperCase()}`}
          title="Ouvrir un salon vocal pour la party"
          className="friends-dock-call"
        >
          🎙️ Vocal
        </Link>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const question = party.jeSuisChef
              ? `Dissoudre « ${party.nom} » ? Tous les membres en sortent.`
              : `Quitter « ${party.nom} » ?`;
            if (window.confirm(question)) agir(() => quitterParty(party.id));
          }}
          className="friends-dock-leave"
        >
          {party.jeSuisChef ? "Dissoudre" : "Quitter"}
        </button>
      </div>

      <ul className="friends-dock-members">
        {membres.map((m) => (
          <li key={m.userId}>
            <Avatar pseudo={m.pseudo} url={m.avatarUrl} frame={m.frame} taille={28} />
            <span>{m.pseudo}</span>
            {m.chef && <b title="Chef de la party">👑</b>}
            {party.jeSuisChef && !m.chef && (
              <button
                type="button"
                disabled={pending}
                aria-label={`Exclure ${m.pseudo}`}
                title={`Exclure ${m.pseudo}`}
                onClick={() => {
                  if (window.confirm(`Exclure ${m.pseudo} de la party ?`)) agir(() => quitterParty(party.id, m.userId));
                }}
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>

      {party.jeSuisChef && (
        <div className="friends-dock-chef">
          {invitables.length > 0 ? (
            <label>
              Inviter un ami
              <select
                defaultValue=""
                disabled={pending}
                onChange={(e) => {
                  if (e.target.value) agir(() => inviterAuParty(party.id, e.target.value));
                  e.currentTarget.value = "";
                }}
              >
                <option value="">Choisir…</option>
                {invitables.map((a) => (
                  <option key={a.userId} value={a.userId}>{a.pseudo}</option>
                ))}
              </select>
            </label>
          ) : (
            <p className="friends-dock-empty">Tous tes amis sont déjà dans la party.</p>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const n = window.prompt("Nouveau nom de la party :", party.nom);
              if (n) agir(() => renommerParty(party.id, n));
            }}
          >
            Renommer
          </button>
        </div>
      )}

      <div ref={fil} className="friends-dock-thread" role="log" aria-live="polite">
        {messages.length === 0 && <p className="friends-dock-empty">Personne n&apos;a encore parlé ici.</p>}
        {messages.map((m) => (
          <p key={m.id} className={m.deMoi ? "pixo-bubble from-me" : "pixo-bubble from-pixo"}>
            {!m.deMoi && <b className="friends-dock-author">{m.auteur}</b>}
            {m.texte}
          </p>
        ))}
      </div>

      <form
        className="pixo-chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          envoyer();
        }}
      >
        <input value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={1000} placeholder="Parler à la party…" aria-label="Message à la party" />
        <button type="submit" disabled={pending || !texte.trim()}>Envoyer</button>
      </form>
    </div>
  );
}
