import { createClient } from "./supabase/client";

/**
 * PixoCall : la salle vocale, en pair-a-pair.
 *
 * Le son ne passe par AUCUN serveur : chaque personne est reliee directement
 * a chacune des autres (une « maille »), et Supabase ne sert qu'a se
 * presenter et a echanger les adresses. C'est ce qui rend le vocal gratuit —
 * un serveur qui relaie du son coute cher, au mois et au gigaoctet.
 *
 * La contrepartie est honnete : quand les deux reseaux sont tres fermes
 * (certaines box, un college, une 4G d'entreprise), la liaison directe
 * echoue. Il faudrait un relais, qui est payant. La salle le dit alors
 * clairement au lieu de rester muette.
 *
 * Et comme chacun envoie sa voix a tous les autres, le cout monte vite : a
 * quatre ca passe partout, a six une petite connexion sature. La salle est
 * donc plafonnee, volontairement.
 */

/** Au-dela, une connexion montante ordinaire ne suit plus. */
export const MAX_PARTICIPANTS = 6;

/** Serveurs STUN publics : ils disent juste « voila ton adresse vue de dehors ». */
const ICE: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

export type EtatLien = "connexion" | "ok" | "echec";

export interface Participant {
  userId: string;
  pseudo: string;
  avatarUrl: string | null;
  frame: string;
  /** Vrai quand cette personne parle en ce moment. */
  parle: boolean;
  /** Etat de la liaison directe avec elle. */
  etat: EtatLien;
  /** Faux quand on l'a mise en sourdine de son cote a soi. */
  entendu: boolean;
}

export interface MoiCall {
  userId: string;
  pseudo: string;
  avatarUrl: string | null;
  frame: string;
}

export interface CallControls {
  /** Couper ou remettre son micro. */
  setMuet(muet: boolean): void;
  /** Mettre en sourdine une personne, chez soi seulement. */
  setEntendu(userId: string, entendu: boolean): void;
  /** Changer de micro sans quitter la salle. */
  changerMicro(deviceId: string): Promise<void>;
  quitter(): void;
}

export interface CallEvents {
  participants(liste: Participant[]): void;
  /** Mon propre niveau de voix, de 0 a 1 : le rond vert autour de l'avatar. */
  monNiveau(niveau: number): void;
  erreur(message: string): void;
  /** La salle est pleine : on n'entre pas. */
  pleine(): void;
}

interface Pair {
  pc: RTCPeerConnection;
  flux: MediaStream | null;
  audio: HTMLAudioElement | null;
  analyser: AnalyserNode | null;
  info: Omit<Participant, "parle" | "etat" | "entendu">;
  etat: EtatLien;
  entendu: boolean;
  parle: boolean;
}

/**
 * Rejoindre une salle.
 *
 * `code` identifie la salle : deux personnes avec le meme code s'entendent.
 * Rien n'est stocke en base — une salle n'existe que tant que quelqu'un est
 * dedans.
 */
export async function rejoindreSalon(
  code: string,
  moi: MoiCall,
  events: CallEvents,
): Promise<CallControls> {
  const supabase = createClient();
  const pairs = new Map<string, Pair>();
  let micro: MediaStream | null = null;
  let ctx: AudioContext | null = null;
  let monAnalyser: AnalyserNode | null = null;
  let boucle: number | null = null;
  let muet = false;
  let vivant = true;

  // 1. Le micro d'abord : sans permission, inutile d'entrer dans la salle.
  try {
    micro = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (e) {
    const nom = e instanceof DOMException ? e.name : "";
    throw new Error(
      nom === "NotAllowedError"
        ? "Le micro est bloqué. Clique sur le cadenas à gauche de l'adresse du site, puis autorise le micro."
        : nom === "NotFoundError"
          ? "Aucun micro trouvé. Branche un casque ou un micro, puis réessaie."
          : "Impossible d'ouvrir le micro. Ferme les autres applications qui l'utilisent (Discord, Zoom…).",
    );
  }

  // 2. La mesure du niveau de voix, pour le rond vert autour des avatars.
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (AC) {
    ctx = new AC();
    monAnalyser = brancherAnalyser(ctx, micro);
  }

  const canal = supabase.channel(`pixocall-${code}`, {
    config: { presence: { key: moi.userId }, broadcast: { self: false } },
  });

  function publier() {
    if (!vivant) return;
    events.participants(
      [...pairs.values()].map((p) => ({
        ...p.info,
        parle: p.parle && p.entendu,
        etat: p.etat,
        entendu: p.entendu,
      })),
    );
  }

  /** Un analyseur branche sur un flux : il sert a savoir qui parle. */
  function brancherAnalyser(audio: AudioContext, flux: MediaStream): AnalyserNode {
    const source = audio.createMediaStreamSource(flux);
    const analyser = audio.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    return analyser;
  }

  function niveauDe(analyser: AnalyserNode, tampon: Uint8Array<ArrayBuffer>): number {
    analyser.getByteTimeDomainData(tampon);
    let somme = 0;
    for (const v of tampon) {
      const x = (v - 128) / 128;
      somme += x * x;
    }
    return Math.min(1, Math.sqrt(somme / tampon.length) * 3.2);
  }

  // 3. La boucle qui regarde qui parle. Un seul minuteur pour tout le monde.
  const tampon = new Uint8Array(new ArrayBuffer(256));
  function tick() {
    if (!vivant) return;
    if (monAnalyser) events.monNiveau(muet ? 0 : niveauDe(monAnalyser, tampon));
    let change = false;
    for (const p of pairs.values()) {
      if (!p.analyser) continue;
      const parle = niveauDe(p.analyser, tampon) > 0.06;
      if (parle !== p.parle) {
        p.parle = parle;
        change = true;
      }
    }
    if (change) publier();
    boucle = window.setTimeout(tick, 120);
  }
  tick();

  /** Le lien direct avec une personne. */
  function creerPair(autreId: string, info: Pair["info"], jeLance: boolean): Pair {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const pair: Pair = { pc, flux: null, audio: null, analyser: null, info, etat: "connexion", entendu: true, parle: false };
    pairs.set(autreId, pair);

    if (micro) for (const piste of micro.getTracks()) pc.addTrack(piste, micro);

    pc.onicecandidate = (e) => {
      if (e.candidate) envoyer(autreId, { type: "ice", candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      const flux = e.streams[0];
      pair.flux = flux;
      // Un element audio par personne : c'est lui qui fait sortir le son, et
      // c'est aussi lui qu'on coupe quand on met quelqu'un en sourdine.
      const audio = new Audio();
      audio.srcObject = flux;
      audio.autoplay = true;
      audio.muted = !pair.entendu;
      void audio.play().catch(() => {});
      pair.audio = audio;
      if (ctx) pair.analyser = brancherAnalyser(ctx, flux);
      publier();
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "connected") pair.etat = "ok";
      else if (s === "failed" || s === "closed") pair.etat = "echec";
      else if (s === "disconnected") pair.etat = "connexion";
      publier();
    };

    if (jeLance) {
      void (async () => {
        try {
          const offre = await pc.createOffer();
          await pc.setLocalDescription(offre);
          envoyer(autreId, { type: "offre", sdp: pc.localDescription?.sdp ?? "" });
        } catch {
          pair.etat = "echec";
          publier();
        }
      })();
    }
    return pair;
  }

  function envoyer(a: string, corps: Record<string, unknown>) {
    void canal.send({ type: "broadcast", event: "signal", payload: { de: moi.userId, a, ...corps } });
  }

  function fermerPair(id: string) {
    const p = pairs.get(id);
    if (!p) return;
    p.pc.onicecandidate = null;
    p.pc.ontrack = null;
    p.pc.onconnectionstatechange = null;
    p.pc.close();
    if (p.audio) {
      p.audio.pause();
      p.audio.srcObject = null;
    }
    pairs.delete(id);
    publier();
  }

  // 4. Les messages de mise en relation.
  canal.on("broadcast", { event: "signal" }, async ({ payload }) => {
    const p = payload as Record<string, string>;
    if (p.a !== moi.userId) return;
    const de = p.de;
    // Une offre peut arriver AVANT que la presence n'ait signale la personne
    // (les deux messages ne voyagent pas a la meme vitesse). Sans ce
    // rattrapage, l'offre tombait dans le vide et la liaison ne se faisait
    // jamais : chacun attendait l'autre.
    let pair = pairs.get(de);
    if (!pair && p.type === "offre") {
      const etat = canal.presenceState<MoiCall>();
      const info = (etat[de] as unknown as MoiCall[] | undefined)?.[0];
      pair = creerPair(
        de,
        {
          userId: de,
          pseudo: info?.pseudo ?? "Joueur",
          avatarUrl: info?.avatarUrl ?? null,
          frame: info?.frame ?? "aucun",
        },
        false,
      );
    }
    if (!pair) return;
    try {
      if (p.type === "offre") {
        await pair.pc.setRemoteDescription({ type: "offer", sdp: p.sdp });
        const reponse = await pair.pc.createAnswer();
        await pair.pc.setLocalDescription(reponse);
        envoyer(de, { type: "reponse", sdp: pair.pc.localDescription?.sdp ?? "" });
      } else if (p.type === "reponse") {
        await pair.pc.setRemoteDescription({ type: "answer", sdp: p.sdp });
      } else if (p.type === "ice") {
        await pair.pc.addIceCandidate(p.candidate as unknown as RTCIceCandidateInit);
      }
    } catch {
      pair.etat = "echec";
      publier();
    }
  });

  // 5. Qui est la : on ouvre un lien avec les nouveaux, on ferme avec ceux
  //    qui partent. Celui dont l'identifiant est le plus petit lance l'appel,
  //    sinon les deux cotes s'appelleraient en meme temps.
  canal.on("presence", { event: "sync" }, () => {
    const etat = canal.presenceState<MoiCall>();
    const presents = new Map<string, MoiCall>();
    for (const [cle, valeurs] of Object.entries(etat)) {
      const v = (valeurs as unknown as MoiCall[])[0];
      if (v && cle !== moi.userId) presents.set(cle, v);
    }

    if (presents.size + 1 > MAX_PARTICIPANTS && !pairs.size) {
      events.pleine();
      return;
    }

    for (const [id, info] of presents) {
      if (pairs.has(id)) continue;
      creerPair(
        id,
        { userId: id, pseudo: info.pseudo, avatarUrl: info.avatarUrl ?? null, frame: info.frame ?? "aucun" },
        moi.userId < id,
      );
    }
    for (const id of [...pairs.keys()]) if (!presents.has(id)) fermerPair(id);
    publier();
  });

  await canal.subscribe(async (statut) => {
    if (statut === "SUBSCRIBED") {
      await canal.track(moi);
    } else if (statut === "CHANNEL_ERROR" || statut === "TIMED_OUT") {
      events.erreur("La salle ne répond pas. Vérifie ta connexion et réessaie.");
    }
  });

  return {
    setMuet(v: boolean) {
      muet = v;
      if (micro) for (const piste of micro.getAudioTracks()) piste.enabled = !v;
    },
    setEntendu(userId: string, entendu: boolean) {
      const p = pairs.get(userId);
      if (!p) return;
      p.entendu = entendu;
      if (p.audio) p.audio.muted = !entendu;
      publier();
    },
    async changerMicro(deviceId: string) {
      const nouveau = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const piste = nouveau.getAudioTracks()[0];
      if (!piste) return;
      piste.enabled = !muet;
      // On remplace la piste dans chaque liaison deja ouverte : personne ne
      // se deconnecte, la voix change de micro en plein vol.
      for (const p of pairs.values()) {
        const envoi = p.pc.getSenders().find((s) => s.track?.kind === "audio");
        if (envoi) await envoi.replaceTrack(piste);
      }
      micro?.getTracks().forEach((t) => t.stop());
      micro = nouveau;
      if (ctx) monAnalyser = brancherAnalyser(ctx, nouveau);
    },
    quitter() {
      vivant = false;
      if (boucle) clearTimeout(boucle);
      for (const id of [...pairs.keys()]) fermerPair(id);
      micro?.getTracks().forEach((t) => t.stop());
      micro = null;
      void ctx?.close().catch(() => {});
      ctx = null;
      void canal.untrack();
      supabase.removeChannel(canal);
    },
  };
}

/** Un code de salon lisible a dicter : six caracteres sans ambiguite. */
export function codeSalon(): string {
  const lettres = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += lettres[Math.floor(Math.random() * lettres.length)];
  return out;
}

export function nettoyerCode(v: string): string {
  return v.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 40);
}
