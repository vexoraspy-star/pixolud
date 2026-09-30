// Sons de « Tonnerre d'Acier », tous synthetises (Web Audio) : moteur,
// chenilles, tourelle, coups de canon proches ou lointains, impacts, ricochets,
// explosions. Aucun fichier audio.

export interface Spatial {
  /** Volume (0 a 1), deja attenue par la distance. */
  gain: number;
  /** Position gauche-droite (-1 a 1). */
  pan: number;
  /** Distance en metres : au loin, les aigus s'effacent et le son arrive en retard. */
  dist: number;
}

export interface TankAudio {
  ctx: AudioContext;
  master: GainNode;
  /** Regime du moteur (0 = ralenti, 1 = plein gaz) et charge (0 a 1). */
  engine: (rpm: number, load: number) => void;
  /** Vitesse des chenilles, en m/s. */
  tracks: (speed: number) => void;
  /** Rotation de la tourelle (0 a 1). */
  turret: (amount: number) => void;
  dispose: () => void;
}

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const size = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

let sharedNoise: AudioBuffer | null = null;
function noise(ctx: AudioContext): AudioBuffer {
  if (!sharedNoise || sharedNoise.sampleRate !== ctx.sampleRate) sharedNoise = noiseBuffer(ctx, 2);
  return sharedNoise;
}

/** Sortie spatialisee : volume, panoramique, filtre d'eloignement. */
function spatialOut(ctx: AudioContext, master: GainNode, s?: Spatial): AudioNode {
  if (!s) return master;
  const g = ctx.createGain();
  g.gain.value = Math.max(0, Math.min(1.5, s.gain));
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = Math.max(500, 16000 - s.dist * 40);
  lp.connect(g);
  if (typeof ctx.createStereoPanner === "function") {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, s.pan));
    g.connect(p);
    p.connect(master);
  } else {
    g.connect(master);
  }
  return lp;
}

function burst(
  ctx: AudioContext,
  dest: AudioNode,
  at: number,
  seconds: number,
  gain: number,
  type: BiquadFilterType,
  f0: number,
  f1: number,
  q = 0.7,
  attack = 0.004,
) {
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, at);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + seconds);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  src.connect(f);
  f.connect(g);
  g.connect(dest);
  src.start(at, Math.random() * 1.5);
  src.stop(at + seconds + 0.05);
}

function tone(ctx: AudioContext, dest: AudioNode, at: number, type: OscillatorType, f0: number, f1: number, seconds: number, gain: number, attack = 0.003) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, at);
  o.frequency.exponentialRampToValueAtTime(Math.max(10, f1), at + seconds);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  o.connect(g);
  g.connect(dest);
  o.start(at);
  o.stop(at + seconds + 0.05);
}

export function createTankAudio(): TankAudio {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  const ctx: AudioContext = new Ctor();
  const master = ctx.createGain();
  master.gain.value = 0.5;
  // Un compresseur : un coup de canon a cote ne sature pas les haut-parleurs.
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 5;
  master.connect(comp);
  comp.connect(ctx.destination);

  // --- Moteur : deux dents de scie graves et un grondement filtre ---
  const engineOut = ctx.createGain();
  engineOut.gain.value = 0.0001;
  const engineLp = ctx.createBiquadFilter();
  engineLp.type = "lowpass";
  engineLp.frequency.value = 300;
  engineLp.connect(engineOut);
  engineOut.connect(master);
  const osc1 = ctx.createOscillator();
  osc1.type = "sawtooth";
  const osc2 = ctx.createOscillator();
  osc2.type = "sawtooth";
  const o1g = ctx.createGain();
  o1g.gain.value = 0.55;
  const o2g = ctx.createGain();
  o2g.gain.value = 0.35;
  osc1.connect(o1g);
  osc2.connect(o2g);
  o1g.connect(engineLp);
  o2g.connect(engineLp);
  osc1.frequency.value = 34;
  osc2.frequency.value = 51.3;
  osc1.start();
  osc2.start();
  const rumble = ctx.createBufferSource();
  rumble.buffer = noise(ctx);
  rumble.loop = true;
  const rumbleLp = ctx.createBiquadFilter();
  rumbleLp.type = "lowpass";
  rumbleLp.frequency.value = 180;
  const rumbleG = ctx.createGain();
  rumbleG.gain.value = 0.6;
  rumble.connect(rumbleLp);
  rumbleLp.connect(rumbleG);
  rumbleG.connect(engineOut);
  rumble.start();

  // --- Chenilles : cliquetis d'acier, un bruit filtre module ---
  const trackOut = ctx.createGain();
  trackOut.gain.value = 0.0001;
  trackOut.connect(master);
  const trackSrc = ctx.createBufferSource();
  trackSrc.buffer = noise(ctx);
  trackSrc.loop = true;
  const trackBp = ctx.createBiquadFilter();
  trackBp.type = "bandpass";
  trackBp.frequency.value = 1400;
  trackBp.Q.value = 1.4;
  const trackAm = ctx.createGain();
  trackAm.gain.value = 0.5;
  const trackLfo = ctx.createOscillator();
  trackLfo.type = "square";
  trackLfo.frequency.value = 6;
  const trackLfoG = ctx.createGain();
  trackLfoG.gain.value = 0.5;
  trackLfo.connect(trackLfoG);
  trackLfoG.connect(trackAm.gain);
  trackSrc.connect(trackBp);
  trackBp.connect(trackAm);
  trackAm.connect(trackOut);
  trackSrc.start();
  trackLfo.start();

  // --- Tourelle : le sifflement du moteur electrique de rotation ---
  const turretOut = ctx.createGain();
  turretOut.gain.value = 0.0001;
  turretOut.connect(master);
  const turretOsc = ctx.createOscillator();
  turretOsc.type = "triangle";
  turretOsc.frequency.value = 420;
  const turretBp = ctx.createBiquadFilter();
  turretBp.type = "bandpass";
  turretBp.frequency.value = 900;
  turretOsc.connect(turretBp);
  turretBp.connect(turretOut);
  turretOsc.start();

  let disposed = false;
  return {
    ctx,
    master,
    engine: (rpm, load) => {
      if (disposed) return;
      const t = ctx.currentTime;
      osc1.frequency.setTargetAtTime(30 + rpm * 36, t, 0.25);
      osc2.frequency.setTargetAtTime(45 + rpm * 55, t, 0.25);
      engineLp.frequency.setTargetAtTime(220 + rpm * 520 + load * 200, t, 0.2);
      engineOut.gain.setTargetAtTime(0.16 + rpm * 0.22 + load * 0.08, t, 0.2);
    },
    tracks: (speed) => {
      if (disposed) return;
      const t = ctx.currentTime;
      const s = Math.min(1, Math.abs(speed) / 15);
      trackOut.gain.setTargetAtTime(s * 0.35, t, 0.15);
      trackLfo.frequency.setTargetAtTime(3 + Math.abs(speed) * 1.7, t, 0.2);
      trackBp.frequency.setTargetAtTime(900 + s * 1400, t, 0.2);
    },
    turret: (amount) => {
      if (disposed) return;
      const t = ctx.currentTime;
      turretOut.gain.setTargetAtTime(Math.min(1, amount) * 0.05, t, 0.08);
      turretOsc.frequency.setTargetAtTime(380 + amount * 160, t, 0.1);
    },
    dispose: () => {
      disposed = true;
      try {
        osc1.stop();
        osc2.stop();
        rumble.stop();
        trackSrc.stop();
        trackLfo.stop();
        turretOsc.stop();
      } catch {
        // deja arretes
      }
      ctx.close().catch(() => {});
    },
  };
}

/**
 * Coup de canon : le claquement, le souffle grave, et la queue qui roule dans
 * la vallee. Au loin, arrive en retard (le son va a 340 m/s) et sourd.
 */
export function playCannon(a: TankAudio, caliber: number, s?: Spatial) {
  const { ctx } = a;
  const out = spatialOut(ctx, a.master, s);
  const at = ctx.currentTime + (s ? Math.min(1.2, s.dist / 340) : 0);
  const big = Math.min(1.4, caliber / 80);
  burst(ctx, out, at, 0.18, 0.9, "highpass", 2400, 600, 0.5, 0.001);
  burst(ctx, out, at, 0.7 * big, 1.1, "lowpass", 1800, 90, 0.8, 0.002);
  tone(ctx, out, at, "sine", 70 * (1.2 - big * 0.2), 28, 0.55 * big, 1.1, 0.002);
  burst(ctx, out, at + 0.12, 1.8 * big, 0.28, "lowpass", 600, 60, 0.5, 0.05);
}

/** Obus qui perce : choc metallique grave et fracas. */
export function playPenetration(a: TankAudio, s?: Spatial) {
  const { ctx } = a;
  const out = spatialOut(ctx, a.master, s);
  const at = ctx.currentTime;
  burst(ctx, out, at, 0.35, 0.8, "bandpass", 1600, 400, 1.2, 0.001);
  tone(ctx, out, at, "triangle", 420, 160, 0.3, 0.45);
  tone(ctx, out, at, "square", 190, 70, 0.2, 0.15);
}

/** Ricochet : le « ping » de l'acier et le sifflement de l'obus qui repart. */
export function playRicochet(a: TankAudio, s?: Spatial) {
  const { ctx } = a;
  const out = spatialOut(ctx, a.master, s);
  const at = ctx.currentTime;
  tone(ctx, out, at, "sine", 2600, 1500, 0.35, 0.35, 0.001);
  tone(ctx, out, at, "triangle", 1800, 900, 0.5, 0.18);
  burst(ctx, out, at + 0.04, 0.6, 0.18, "bandpass", 3000, 1200, 3);
}

/** Obus qui ne perce pas : un « bong » sourd. */
export function playBlocked(a: TankAudio, s?: Spatial) {
  const { ctx } = a;
  const out = spatialOut(ctx, a.master, s);
  const at = ctx.currentTime;
  tone(ctx, out, at, "sine", 240, 120, 0.6, 0.5, 0.001);
  tone(ctx, out, at, "triangle", 610, 380, 0.4, 0.18);
  burst(ctx, out, at, 0.15, 0.3, "bandpass", 1100, 600, 2);
}

/** Obus dans le sol ou un mur : terre projetee. */
export function playGroundHit(a: TankAudio, s?: Spatial) {
  const { ctx } = a;
  const out = spatialOut(ctx, a.master, s);
  const at = ctx.currentTime;
  burst(ctx, out, at, 0.45, 0.6, "lowpass", 900, 120, 0.7, 0.002);
  tone(ctx, out, at, "sine", 90, 40, 0.3, 0.4);
}

/** Char detruit : les munitions sautent. */
export function playTankExplosion(a: TankAudio, s?: Spatial) {
  const { ctx } = a;
  const out = spatialOut(ctx, a.master, s);
  const at = ctx.currentTime + (s ? Math.min(1, s.dist / 340) : 0);
  burst(ctx, out, at, 1.6, 1.2, "lowpass", 2400, 60, 0.6, 0.004);
  tone(ctx, out, at, "sine", 60, 24, 1.2, 1.2, 0.004);
  // Crepitements du feu qui prend.
  for (let k = 0; k < 7; k++) burst(ctx, out, at + 0.3 + k * 0.17, 0.12, 0.2, "bandpass", 2000 + k * 200, 900, 2);
}

/** Obus en place : la culasse se ferme. */
export function playReloaded(a: TankAudio) {
  const { ctx } = a;
  const at = ctx.currentTime;
  burst(ctx, a.master, at, 0.08, 0.35, "bandpass", 1800, 1200, 3, 0.001);
  burst(ctx, a.master, at + 0.11, 0.1, 0.5, "bandpass", 1200, 700, 3, 0.001);
  tone(ctx, a.master, at + 0.11, "square", 180, 120, 0.08, 0.08);
}

/** On est touche : l'equipage entend l'impact de l'interieur. */
export function playHitTaken(a: TankAudio, pierced: boolean) {
  const { ctx } = a;
  const at = ctx.currentTime;
  tone(ctx, a.master, at, "sine", pierced ? 150 : 320, pierced ? 50 : 180, pierced ? 0.7 : 0.5, pierced ? 1 : 0.6, 0.001);
  burst(ctx, a.master, at, pierced ? 0.6 : 0.3, pierced ? 0.9 : 0.5, "bandpass", pierced ? 900 : 2000, 300, 1);
}

/** Capture : la cloche qui previent. */
export function playCaptureAlert(a: TankAudio) {
  const { ctx } = a;
  const at = ctx.currentTime;
  tone(ctx, a.master, at, "triangle", 880, 880, 0.25, 0.2);
  tone(ctx, a.master, at + 0.28, "triangle", 660, 660, 0.3, 0.2);
}
