import { type Spatial } from "./manorAudio";

// Sons du Duel 1v1, synthetises comme ceux du Manoir : aucun fichier audio.

export interface DuelAudio {
  ctx: AudioContext;
  master: GainNode;
  stop: () => void;
}

function out(ctx: AudioContext, master: GainNode, opts?: Spatial): AudioNode {
  if (!opts) return master;
  const g = ctx.createGain();
  g.gain.value = opts.gain ?? 1;
  if (opts.pan !== undefined && typeof ctx.createStereoPanner === "function") {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, opts.pan));
    g.connect(p);
    p.connect(master);
  } else {
    g.connect(master);
  }
  return g;
}

function noise(
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
}

function tone(
  ctx: AudioContext,
  dest: AudioNode,
  type: OscillatorType,
  from: number,
  to: number,
  seconds: number,
  peak: number,
  attack = 0.005,
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
  osc.stop(now + seconds + 0.03);
}

export function createDuelAudio(): DuelAudio {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  const ctx: AudioContext = new Ctor();
  const master = ctx.createGain();
  master.gain.value = 0.3;
  master.connect(ctx.destination);

  // Bourdon d'arene tres discret, pour que le silence ne soit pas mort.
  const hum = ctx.createOscillator();
  hum.type = "sine";
  hum.frequency.value = 62;
  const humGain = ctx.createGain();
  humGain.gain.value = 0.045;
  hum.connect(humGain);
  humGain.connect(master);
  hum.start();

  return {
    ctx,
    master,
    stop: () => {
      try {
        hum.stop();
      } catch {
        // ignore
      }
    },
  };
}

/** Detonation : claquement sec + corps grave + queue de reverberation. */
export function playShot(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  noise(ctx, dest, 0.09, 0.9, (t) => Math.pow(1 - t, 1.4), { type: "highpass", freq: 1400 });
  noise(ctx, dest, 0.22, 0.6, (t) => Math.pow(1 - t, 2.6), { type: "lowpass", freq: 780 });
  tone(ctx, dest, "square", 320, 70, 0.13, 0.35);
  // reverb de l'arene
  noise(ctx, dest, 0.55, 0.16, (t) => Math.pow(1 - t, 2) * 0.6, { type: "bandpass", freq: 900, q: 1.2 });
}

/** Impact sur un mur : petit eclat de beton. */
export function playImpact(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  noise(ctx, out(ctx, master, opts), 0.13, 0.4, (t) => Math.pow(1 - t, 3), {
    type: "highpass",
    freq: 2200,
  });
}

/** Touche confirmee : petit "tic" metallique, le retour le plus important du jeu. */
export function playHitmarker(ctx: AudioContext, master: GainNode) {
  tone(ctx, master, "square", 1500, 1900, 0.06, 0.22, 0.002);
}

/** Tir a la tete : deux tics montants. */
export function playHeadshot(ctx: AudioContext, master: GainNode) {
  tone(ctx, master, "square", 1600, 2100, 0.05, 0.24, 0.002);
  window.setTimeout(() => tone(ctx, master, "square", 2100, 2600, 0.07, 0.24, 0.002), 55);
}

/** On encaisse : coup sourd + souffle. */
export function playHurt(ctx: AudioContext, master: GainNode) {
  tone(ctx, master, "sine", 220, 90, 0.22, 0.5);
  noise(ctx, master, 0.3, 0.3, (t) => Math.pow(1 - t, 2));
}

/** Elimination : descente grave. */
// Spatialisee : dans un match a plusieurs, une elimination a l'autre bout
// de la carte ne doit pas sonner comme la tienne.
export function playDeath(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  tone(ctx, dest, "sawtooth", 420, 60, 0.9, 0.5, 0.01);
  noise(ctx, dest, 0.7, 0.45, (t) => Math.pow(1 - t, 1.6), { type: "lowpass", freq: 900 });
}

/** Rechargement : chargeur qui sort, qui claque, culasse. */
export function playReload(ctx: AudioContext, master: GainNode) {
  noise(ctx, master, 0.09, 0.3, (t) => Math.pow(1 - t, 2), { type: "bandpass", freq: 1700, q: 2 });
  window.setTimeout(
    () => noise(ctx, master, 0.1, 0.34, (t) => Math.pow(1 - t, 2), { type: "bandpass", freq: 1200, q: 2 }),
    620,
  );
  window.setTimeout(() => {
    tone(ctx, master, "square", 900, 500, 0.08, 0.24);
    noise(ctx, master, 0.12, 0.36, (t) => Math.pow(1 - t, 2.4), { type: "highpass", freq: 1500 });
  }, 1150);
}

/** Chargeur vide : le clic qui fait perdre les duels. */
export function playDryFire(ctx: AudioContext, master: GainNode) {
  noise(ctx, master, 0.05, 0.25, (t) => Math.pow(1 - t, 3), { type: "highpass", freq: 2600 });
}

/** Pas, spatialises : entendre l'adversaire tourner autour du pilier. */
export function playDuelStep(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  noise(ctx, out(ctx, master, opts), 0.11, 0.22, (t) => Math.pow(1 - t, 3), {
    type: "lowpass",
    freq: 1100,
  });
}

/** Reapparition : montee courte et claire. */
export function playRespawn(ctx: AudioContext, master: GainNode) {
  tone(ctx, master, "sine", 440, 880, 0.3, 0.26, 0.01);
}

/** Fin de match. */
export function playMatchEnd(ctx: AudioContext, master: GainNode, win: boolean) {
  const notes = win ? [523, 659, 784, 1047] : [523, 440, 349, 262];
  notes.forEach((f, i) => {
    window.setTimeout(() => tone(ctx, master, "triangle", f, f, 0.35, 0.3, 0.01), i * 150);
  });
}
