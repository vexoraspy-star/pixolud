// Voix des Backrooms.
//
// Deux usages, un seul objet :
//  - le MICRO du joueur : on mesure son volume en local pour que la creature
//    l'entende parler (rien ne quitte l'ordinateur pour ca) ;
//  - la VOIX DE GROUPE : une connexion pair-a-pair (WebRTC) avec chaque ami du
//    groupe. La voix ne passe par aucun serveur de Pixolud : seuls les
//    messages de mise en relation transitent par le canal Supabase du groupe.
//
// La voix des autres est spatialisee : elle vient de leur personnage, baisse
// avec la distance et s'etouffe derriere un mur.

export type VoiceSignal =
  | { kind: "description"; description: RTCSessionDescriptionInit }
  | { kind: "candidate"; candidate: RTCIceCandidateInit };

export type MicState = "off" | "demande" | "actif" | "refuse" | "indisponible";

interface Peer {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  element: HTMLAudioElement | null;
  source: MediaStreamAudioSourceNode | null;
  analyser: AnalyserNode | null;
  filter: BiquadFilterNode;
  panner: PannerNode;
  gain: GainNode;
  level: number;
  buffer: Float32Array<ArrayBuffer>;
  pending: RTCIceCandidateInit[];
}

// Serveurs STUN publics : ils aident deux navigateurs a se trouver a travers
// leurs box internet. Ils ne voient passer aucun son.
const ICE_SERVERS: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];

function rms(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
  return Math.sqrt(sum / buffer.length);
}

export class VoiceHub {
  readonly ctx: AudioContext;
  private readonly out: GainNode;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private readonly micBuffer = new Float32Array(1024);
  private micLevel = 0;
  private muted = false;
  private spatial = false;
  private listener = { x: 0, y: 0, z: 0 };
  private readonly peers = new Map<string, Peer>();
  private closed = false;
  micState: MicState = "off";

  constructor(
    private readonly selfId: string,
    private readonly signal: (to: string, data: VoiceSignal) => void,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new Ctor();
    this.out = this.ctx.createGain();
    this.out.gain.value = 1;
    this.out.connect(this.ctx.destination);
  }

  /** A appeler depuis un clic : le navigateur n'accepte le son qu'apres un geste. */
  resume() {
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
  }

  async enableMic(): Promise<MicState> {
    if (this.micStream || this.closed) return this.micState;
    if (!navigator.mediaDevices?.getUserMedia) {
      this.micState = "indisponible";
      return this.micState;
    }
    this.micState = "demande";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      if (this.closed) {
        for (const t of stream.getTracks()) t.stop();
        return this.micState;
      }
      this.micStream = stream;
      this.micSource = this.ctx.createMediaStreamSource(stream);
      this.micAnalyser = this.ctx.createAnalyser();
      this.micAnalyser.fftSize = 1024;
      // Le micro n'est JAMAIS relie aux haut-parleurs : seulement a l'analyseur.
      this.micSource.connect(this.micAnalyser);
      const track = stream.getAudioTracks()[0];
      track.enabled = !this.muted;
      for (const peer of this.peers.values()) {
        if (!peer.pc.getSenders().some((s) => s.track === track)) peer.pc.addTrack(track, stream);
      }
      this.micState = "actif";
    } catch {
      this.micState = "refuse";
    }
    return this.micState;
  }

  setMuted(value: boolean) {
    this.muted = value;
    const track = this.micStream?.getAudioTracks()[0];
    if (track) track.enabled = !value;
  }

  isMuted(): boolean {
    return this.muted;
  }

  hasMic(): boolean {
    return this.micStream !== null;
  }

  /** Volume du micro, de 0 (silence) a 1 (cri). 0 si coupe. */
  level(): number {
    if (!this.micAnalyser || this.muted) {
      this.micLevel = 0;
      return 0;
    }
    this.micAnalyser.getFloatTimeDomainData(this.micBuffer);
    const target = Math.min(1, Math.max(0, (rms(this.micBuffer) - 0.012) / 0.14));
    // Montee immediate, descente lente : la jauge ne clignote pas entre deux syllabes.
    this.micLevel = target > this.micLevel ? target : this.micLevel + (target - this.micLevel) * 0.12;
    return this.micLevel;
  }

  /** Volume d'un ami, pour l'indicateur « il parle ». */
  peerLevel(id: string): number {
    const peer = this.peers.get(id);
    if (!peer?.analyser) return 0;
    peer.analyser.getFloatTimeDomainData(peer.buffer);
    const target = Math.min(1, Math.max(0, (rms(peer.buffer) - 0.008) / 0.12));
    peer.level = target > peer.level ? target : peer.level + (target - peer.level) * 0.15;
    return peer.level;
  }

  /** En jeu : voix positionnees. Au salon : tout le monde a volume plein. */
  setSpatial(value: boolean) {
    this.spatial = value;
    if (!value) {
      for (const peer of this.peers.values()) {
        peer.panner.positionX.value = this.listener.x;
        peer.panner.positionY.value = this.listener.y;
        peer.panner.positionZ.value = this.listener.z;
        peer.filter.frequency.value = 20000;
      }
    }
  }

  setListener(x: number, y: number, z: number, fx: number, fy: number, fz: number) {
    this.listener = { x, y, z };
    const l = this.ctx.listener;
    if (l.positionX) {
      const t = this.ctx.currentTime;
      l.positionX.setTargetAtTime(x, t, 0.02);
      l.positionY.setTargetAtTime(y, t, 0.02);
      l.positionZ.setTargetAtTime(z, t, 0.02);
      l.forwardX.setTargetAtTime(fx, t, 0.02);
      l.forwardY.setTargetAtTime(fy, t, 0.02);
      l.forwardZ.setTargetAtTime(fz, t, 0.02);
      l.upX.value = 0;
      l.upY.value = 1;
      l.upZ.value = 0;
    } else {
      l.setPosition(x, y, z);
      l.setOrientation(fx, fy, fz, 0, 1, 0);
    }
  }

  /** `occluded` : un mur entre les deux, la voix devient sourde. `silent` : ami mort ou hors du niveau. */
  setPeerPosition(id: string, x: number, y: number, z: number, occluded: boolean, silent = false) {
    const peer = this.peers.get(id);
    if (!peer || !this.spatial) return;
    const t = this.ctx.currentTime;
    peer.panner.positionX.setTargetAtTime(x, t, 0.05);
    peer.panner.positionY.setTargetAtTime(y, t, 0.05);
    peer.panner.positionZ.setTargetAtTime(z, t, 0.05);
    peer.filter.frequency.setTargetAtTime(occluded ? 750 : 18000, t, 0.15);
    peer.gain.gain.setTargetAtTime(silent ? 0.35 : 1, t, 0.2);
  }

  peerIds(): string[] {
    return [...this.peers.keys()];
  }

  /** Ouvre (ou garde) une connexion avec un ami qui vient d'arriver dans le groupe. */
  connectPeer(id: string) {
    if (this.closed || id === this.selfId || this.peers.has(id)) return;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 20000;
    const panner = this.ctx.createPanner();
    panner.panningModel = "HRTF";
    panner.distanceModel = "inverse";
    panner.refDistance = 2;
    panner.maxDistance = 60;
    panner.rolloffFactor = 1.1;
    const gain = this.ctx.createGain();
    filter.connect(panner);
    panner.connect(gain);
    gain.connect(this.out);
    const peer: Peer = {
      pc,
      polite: this.selfId < id,
      makingOffer: false,
      ignoreOffer: false,
      element: null,
      source: null,
      analyser: null,
      filter,
      panner,
      gain,
      level: 0,
      buffer: new Float32Array(512),
      pending: [],
    };
    this.peers.set(id, peer);
    this.setSpatial(this.spatial);

    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        if (pc.localDescription) this.signal(id, { kind: "description", description: pc.localDescription.toJSON() });
      } catch {
        // la negociation reprendra au prochain echange
      } finally {
        peer.makingOffer = false;
      }
    };
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.signal(id, { kind: "candidate", candidate: candidate.toJSON() });
    };
    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      this.attachRemote(peer, stream);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") pc.restartIce();
    };

    const track = this.micStream?.getAudioTracks()[0];
    if (track && this.micStream) {
      pc.addTrack(track, this.micStream);
    } else {
      // Sans micro on ecoute quand meme : le cote qui en a un enverra sa voix.
      pc.addTransceiver("audio", { direction: "recvonly" });
    }
  }

  private attachRemote(peer: Peer, stream: MediaStream) {
    peer.source?.disconnect();
    // Chrome ne fait couler un flux distant dans Web Audio que s'il est aussi
    // branche sur un element audio (muet) : sans lui, on n'entend rien.
    if (!peer.element) {
      peer.element = new Audio();
      peer.element.muted = true;
    }
    peer.element.srcObject = stream;
    peer.element.play().catch(() => {});
    peer.source = this.ctx.createMediaStreamSource(stream);
    peer.analyser = this.ctx.createAnalyser();
    peer.analyser.fftSize = 512;
    peer.source.connect(peer.analyser);
    peer.source.connect(peer.filter);
  }

  async handleSignal(from: string, data: VoiceSignal) {
    if (this.closed) return;
    if (!this.peers.has(from)) this.connectPeer(from);
    const peer = this.peers.get(from);
    if (!peer) return;
    const { pc } = peer;
    try {
      if (data.kind === "description") {
        const description = data.description;
        const collision = description.type === "offer" && (peer.makingOffer || pc.signalingState !== "stable");
        peer.ignoreOffer = !peer.polite && collision;
        if (peer.ignoreOffer) return;
        await pc.setRemoteDescription(description);
        for (const c of peer.pending.splice(0)) await pc.addIceCandidate(c).catch(() => {});
        if (description.type === "offer") {
          await pc.setLocalDescription();
          if (pc.localDescription) this.signal(from, { kind: "description", description: pc.localDescription.toJSON() });
        }
      } else if (pc.remoteDescription) {
        await pc.addIceCandidate(data.candidate).catch(() => {
          // une candidate d'une offre ignoree : sans importance
        });
      } else {
        peer.pending.push(data.candidate);
      }
    } catch {
      // echange desordonne : la negociation parfaite s'en remet au suivant
    }
  }

  removePeer(id: string) {
    const peer = this.peers.get(id);
    if (!peer) return;
    this.peers.delete(id);
    peer.pc.close();
    peer.source?.disconnect();
    peer.gain.disconnect();
    if (peer.element) {
      peer.element.srcObject = null;
    }
  }

  close() {
    this.closed = true;
    for (const id of [...this.peers.keys()]) this.removePeer(id);
    for (const t of this.micStream?.getTracks() ?? []) t.stop();
    this.micSource?.disconnect();
    this.micStream = null;
    this.ctx.close().catch(() => {});
  }
}
