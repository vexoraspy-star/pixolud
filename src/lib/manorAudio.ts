// Toute la bande-son du Manoir Maudit est synthetisee en direct avec la Web
// Audio API : aucun fichier audio a charger, rien a licencier.

/** Position sonore : `pan` de -1 (gauche) a 1 (droite), `gain` multiplicateur. */
export interface Spatial {
  pan?: number;
  gain?: number;
}

/**
 * Point d'entree d'un son. Quand une position est fournie, on insere un
 * StereoPanner : entendre le monstre arriver PAR LA GAUCHE fait bien plus
 * peur que le meme son au centre.
 */
function out(ctx: AudioContext, master: GainNode, opts?: Spatial): AudioNode {
  if (!opts) return master;
  const g = ctx.createGain();
  g.gain.value = opts.gain ?? 1;
  if (opts.pan !== undefined && typeof ctx.createStereoPanner === "function") {
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, opts.pan));
    g.connect(panner);
    panner.connect(master);
  } else {
    g.connect(master);
  }
  return g;
}

function noiseBurst(
  ctx: AudioContext,
  dest: AudioNode,
  seconds: number,
  gain: number,
  shape: (t: number) => number,
  filter?: { type: BiquadFilterType; freq: number; q?: number },
) {
  const size = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * shape(i / size);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, ctx.currentTime);
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = filter.type;
    f.frequency.value = filter.freq;
    if (filter.q !== undefined) f.Q.value = filter.q;
    src.connect(f);
    f.connect(g);
  } else {
    src.connect(g);
  }
  g.connect(dest);
  src.start(ctx.currentTime);
  return src;
}

function tone(
  ctx: AudioContext,
  dest: AudioNode,
  type: OscillatorType,
  from: number,
  to: number,
  seconds: number,
  peak: number,
  attack = 0.02,
) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + seconds);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(peak, now + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
  osc.connect(g);
  g.connect(dest);
  osc.start(now);
  osc.stop(now + seconds + 0.05);
}

export interface ManorAudio {
  ctx: AudioContext;
  master: GainNode;
  /** 0 = calme, 1 = terreur : desaccorde le bourdon et fait monter le vent. */
  setTension: (value: number) => void;
  stop: () => void;
}

export function createAudio(): ManorAudio {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  const ctx: AudioContext = new Ctor();

  const master = ctx.createGain();
  master.gain.value = 0.32;
  master.connect(ctx.destination);

  const osc1 = ctx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.value = 54;
  const osc2 = ctx.createOscillator();
  osc2.type = "sine";
  osc2.frequency.value = 57.5;
  const osc3 = ctx.createOscillator();
  osc3.type = "triangle";
  osc3.frequency.value = 36.7;
  // Quatrieme voix, muette au repos : c'est un triton (intervalle le plus
  // instable de la gamme) qu'on fait monter quand la tension augmente.
  const dissonance = ctx.createOscillator();
  dissonance.type = "sawtooth";
  dissonance.frequency.value = 77.8;
  const dissonanceGain = ctx.createGain();
  dissonanceGain.gain.value = 0;
  dissonance.connect(dissonanceGain);

  const droneGain = ctx.createGain();
  droneGain.gain.value = 0.16;
  osc1.connect(droneGain);
  osc2.connect(droneGain);
  osc3.connect(droneGain);
  droneGain.connect(master);
  dissonanceGain.connect(master);
  osc1.start();
  osc2.start();
  osc3.start();
  dissonance.start();

  // Souffle continu (le vent dans les murs).
  const windBuffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
  const wd = windBuffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < wd.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    wd[i] = last * 3.2;
  }
  const wind = ctx.createBufferSource();
  wind.buffer = windBuffer;
  wind.loop = true;
  const windGain = ctx.createGain();
  windGain.gain.value = 0.1;
  wind.connect(windGain);
  windGain.connect(master);
  wind.start();

  return {
    ctx,
    master,
    setTension: (value: number) => {
      const v = Math.max(0, Math.min(1, value));
      const now = ctx.currentTime;
      dissonanceGain.gain.setTargetAtTime(v * 0.075, now, 0.4);
      windGain.gain.setTargetAtTime(0.1 + v * 0.16, now, 0.5);
      droneGain.gain.setTargetAtTime(0.16 + v * 0.1, now, 0.5);
      osc3.frequency.setTargetAtTime(36.7 - v * 6, now, 0.8);
    },
    stop: () => {
      try {
        osc1.stop();
        osc2.stop();
        osc3.stop();
        dissonance.stop();
        wind.stop();
      } catch {
        // ignore
      }
    },
  };
}

export function playHeartbeat(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  tone(ctx, out(ctx, master, opts), "sine", 58, 58, 0.28, 0.55, 0.03);
}

export function playPickup(ctx: AudioContext, master: GainNode) {
  tone(ctx, master, "sine", 660, 990, 0.3, 0.3);
}

export function playStinger(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  tone(ctx, dest, "sine", 90, 30, 0.6, 0.4, 0.04);
  noiseBurst(ctx, dest, 0.35, 0.22, (t) => (1 - t) * 0.5);
}

export function playNearMiss(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  tone(ctx, dest, "sawtooth", 640, 110, 0.45, 0.5);
  noiseBurst(ctx, dest, 0.4, 0.5, (t) => (1 - t) * 0.7);
}

export function playWake(ctx: AudioContext, master: GainNode) {
  tone(ctx, master, "sawtooth", 28, 95, 2, 0.55, 0.5);
  noiseBurst(ctx, master, 1.6, 0.3, (t) => Math.sin(t * Math.PI) * 0.5);
}

export function playCrash(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  noiseBurst(ctx, dest, 0.5, 0.85, (t) => Math.pow(1 - t, 2.2));
  tone(ctx, dest, "sine", 140, 38, 0.4, 0.7);
}

export function playDenied(ctx: AudioContext, master: GainNode) {
  tone(ctx, master, "square", 180, 90, 0.12, 0.32);
  window.setTimeout(() => tone(ctx, master, "square", 150, 70, 0.16, 0.32), 130);
}

export function playUnlock(ctx: AudioContext, master: GainNode) {
  tone(ctx, master, "square", 420, 620, 0.1, 0.22);
  window.setTimeout(() => tone(ctx, master, "square", 620, 880, 0.14, 0.24), 110);
  window.setTimeout(() => {
    noiseBurst(ctx, master, 0.7, 0.3, (t) => Math.sin(t * Math.PI) * 0.6);
    tone(ctx, master, "sine", 70, 42, 0.8, 0.4, 0.1);
  }, 260);
}

export function playFootstep(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  noiseBurst(ctx, out(ctx, master, opts), 0.13, 0.11, (t) => Math.pow(1 - t, 3));
}

export function playStairCreak(ctx: AudioContext, master: GainNode) {
  tone(ctx, master, "sawtooth", 320 + Math.random() * 180, 120, 0.5, 0.12, 0.09);
}

/**
 * Chuchotement : bruit filtre en bande etroite autour d'une frequence de
 * voix. Le cerveau y entend des mots sans jamais les distinguer.
 */
export function playWhisper(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  const freq = 700 + Math.random() * 900;
  noiseBurst(ctx, dest, 0.8 + Math.random() * 0.6, 0.5, (t) => Math.sin(t * Math.PI) * (0.6 + Math.random() * 0.4), {
    type: "bandpass",
    freq,
    q: 14,
  });
}

/** Respiration rauque : on l'entend quand la chose est juste derriere. */
export function playBreath(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  noiseBurst(ctx, dest, 1.15, 0.55, (t) => Math.sin(t * Math.PI) * (t < 0.45 ? 1 : 0.55), {
    type: "lowpass",
    freq: 520,
    q: 3,
  });
}

/** Une bougie qu'on souffle : le manoir s'assombrit a chaque objet pris. */
export function playCandleOut(ctx: AudioContext, master: GainNode) {
  noiseBurst(ctx, master, 0.4, 0.4, (t) => Math.pow(1 - t, 1.6), { type: "highpass", freq: 900 });
  tone(ctx, master, "sine", 220, 70, 0.35, 0.14, 0.05);
}

/** Porte qui claque quelque part dans le manoir. */
export function playDoorSlam(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  noiseBurst(ctx, dest, 0.35, 0.75, (t) => Math.pow(1 - t, 3.2), { type: "lowpass", freq: 1400 });
  tone(ctx, dest, "sine", 190, 45, 0.45, 0.6, 0.006);
}

/** Le rituel : cluster ascendant, choeur inquietant, cloche grave. */
export function playRitual(ctx: AudioContext, master: GainNode) {
  const now = ctx.currentTime;
  for (const [i, f] of [110, 155.6, 233, 311].entries()) {
    const osc = ctx.createOscillator();
    osc.type = i % 2 === 0 ? "sawtooth" : "triangle";
    osc.frequency.setValueAtTime(f, now);
    osc.frequency.linearRampToValueAtTime(f * 1.5, now + 3.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.16, now + 1.4);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 3.6);
    osc.connect(g);
    g.connect(master);
    osc.start(now);
    osc.stop(now + 3.7);
  }
  noiseBurst(ctx, master, 3.4, 0.3, (t) => Math.sin(t * Math.PI) * 0.8, {
    type: "bandpass",
    freq: 1200,
    q: 6,
  });
  window.setTimeout(() => tone(ctx, master, "sine", 62, 41, 2.4, 0.75, 0.01), 2600);
}

/** La trappe de sortie s'ouvre : metal, gonds, air froid. */
export function playHatch(ctx: AudioContext, master: GainNode) {
  tone(ctx, master, "sawtooth", 240, 90, 1.1, 0.2, 0.2);
  noiseBurst(ctx, master, 1.2, 0.35, (t) => Math.sin(t * Math.PI) * 0.7, {
    type: "highpass",
    freq: 700,
  });
  tone(ctx, master, "square", 900, 1500, 0.5, 0.12, 0.05);
}

/**
 * Le screamer de mort : cluster dissonant sature, cri qui plonge et coup de
 * grosse caisse. C'est le seul son volontairement agressif du jeu.
 */
export function playDeathScream(ctx: AudioContext, master: GainNode) {
  const now = ctx.currentTime;
  noiseBurst(ctx, master, 1.4, 1, (t) => Math.pow(1 - t, 0.6));
  for (const f of [880, 933, 1174, 1245]) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(f, now);
    osc.frequency.exponentialRampToValueAtTime(f * 0.12, now + 1.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.3, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    osc.connect(g);
    g.connect(master);
    osc.start(now);
    osc.stop(now + 1.25);
  }
  tone(ctx, master, "sine", 160, 28, 1.1, 0.9, 0.008);
  window.setTimeout(() => {
    noiseBurst(ctx, master, 0.9, 0.4, (t) => Math.sin(t * Math.PI * 2) * (1 - t) * 0.8);
  }, 700);
}
