import {
  beatSeconds,
  melodieToNotes,
  midiToFreq,
  type InstrumentId,
  type MelodieData,
} from "./melodie";

// Les huit instruments sont synthetises a la Web Audio API : aucun fichier
// audio a heberger, rien a telecharger, et aucune question de licence — la
// meme discipline que le reste du site.
//
// Chaque instrument est decrit par une recette (formes d'onde, enveloppe,
// filtre) plutot que par du code dedie : ajouter un instrument revient a
// ajouter une ligne, et on ne peut pas oublier de couper un oscillateur.

interface Voice {
  type: OscillatorType;
  /** Multiplicateur de frequence : 2 = une octave au-dessus. */
  ratio: number;
  /** Poids dans le melange. */
  gain: number;
  /** Desaccord en centiemes de demi-ton, pour epaissir le son. */
  detune?: number;
}

interface Recipe {
  voices: Voice[];
  /** Temps de montee, en secondes. */
  attack: number;
  /** Temps de chute vers le niveau tenu. */
  decay: number;
  /** Niveau tenu, en fraction du pic. 0 = son qui meurt tout seul (pince). */
  sustain: number;
  /** Temps d'extinction apres la fin de la note. */
  release: number;
  filter?: { type: BiquadFilterType; freq: number; q?: number };
  /** Vibrato : profondeur en centiemes, vitesse en Hz. */
  vibrato?: { depth: number; rate: number };
  /** Volume general de l'instrument. */
  level: number;
}

const RECIPES: Record<InstrumentId, Recipe> = {
  piano: {
    voices: [
      { type: "triangle", ratio: 1, gain: 1 },
      { type: "sine", ratio: 2, gain: 0.22 },
    ],
    attack: 0.004,
    decay: 1.1,
    sustain: 0,
    release: 0.25,
    filter: { type: "lowpass", freq: 4200 },
    level: 0.5,
  },
  violon: {
    voices: [
      { type: "sawtooth", ratio: 1, gain: 1 },
      { type: "sawtooth", ratio: 1, gain: 0.5, detune: 7 },
    ],
    attack: 0.12,
    decay: 0.2,
    sustain: 0.75,
    release: 0.2,
    filter: { type: "lowpass", freq: 2600, q: 1.2 },
    vibrato: { depth: 11, rate: 5.4 },
    level: 0.28,
  },
  flute: {
    voices: [
      { type: "sine", ratio: 1, gain: 1 },
      { type: "sine", ratio: 2, gain: 0.13 },
      { type: "triangle", ratio: 3, gain: 0.05 },
    ],
    attack: 0.09,
    decay: 0.1,
    sustain: 0.85,
    release: 0.16,
    vibrato: { depth: 6, rate: 4.6 },
    level: 0.42,
  },
  violoncelle: {
    voices: [
      { type: "sawtooth", ratio: 0.5, gain: 1 },
      { type: "sawtooth", ratio: 0.5, gain: 0.45, detune: -9 },
      { type: "sine", ratio: 1, gain: 0.3 },
    ],
    attack: 0.14,
    decay: 0.25,
    sustain: 0.7,
    release: 0.3,
    filter: { type: "lowpass", freq: 1400, q: 1.1 },
    vibrato: { depth: 8, rate: 4.2 },
    level: 0.3,
  },
  harpe: {
    voices: [
      { type: "triangle", ratio: 1, gain: 1 },
      { type: "sine", ratio: 3, gain: 0.12 },
    ],
    attack: 0.002,
    decay: 1.5,
    sustain: 0,
    release: 0.4,
    filter: { type: "lowpass", freq: 5200 },
    level: 0.45,
  },
  boite: {
    voices: [{ type: "square", ratio: 1, gain: 1 }],
    attack: 0.001,
    decay: 0.08,
    sustain: 0.5,
    release: 0.04,
    filter: { type: "lowpass", freq: 3200 },
    level: 0.2,
  },
  synthe: {
    voices: [
      { type: "sawtooth", ratio: 1, gain: 1 },
      { type: "sawtooth", ratio: 1, gain: 0.7, detune: 12 },
      { type: "square", ratio: 0.5, gain: 0.3 },
    ],
    attack: 0.02,
    decay: 0.3,
    sustain: 0.6,
    release: 0.25,
    filter: { type: "lowpass", freq: 2200, q: 3 },
    level: 0.24,
  },
  cloche: {
    voices: [
      { type: "sine", ratio: 1, gain: 1 },
      // Partiel inharmonique : c'est lui qui fait entendre « cloche »
      // plutot que « fluteau ».
      { type: "sine", ratio: 2.76, gain: 0.3 },
      { type: "sine", ratio: 5.4, gain: 0.12 },
    ],
    attack: 0.003,
    decay: 2.2,
    sustain: 0,
    release: 0.6,
    level: 0.36,
  },
};

/**
 * Joue une note. `when` est un instant de l'horloge du contexte audio, ce qui
 * permet de programmer tout un morceau a l'avance : la lecture ne depend plus
 * de la regularite d'un timer JavaScript, et ne bafouille pas si l'onglet
 * rame.
 */
export function playMelodieNote(
  ctx: AudioContext,
  dest: AudioNode,
  instrument: InstrumentId,
  freq: number,
  when: number,
  duration: number,
  volume = 1,
): void {
  const recipe = RECIPES[instrument] ?? RECIPES.piano;
  const start = Math.max(when, ctx.currentTime);
  const held = Math.max(0.05, duration);

  const out = ctx.createGain();
  const peak = recipe.level * volume;
  out.gain.setValueAtTime(0.0001, start);
  out.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + recipe.attack);

  const sustainLevel = Math.max(0.0001, peak * recipe.sustain);
  out.gain.exponentialRampToValueAtTime(sustainLevel, start + recipe.attack + recipe.decay);
  // Extinction : on part du niveau atteint a la fin de la note.
  const end = start + held;
  out.gain.setValueAtTime(Math.max(0.0001, sustainLevel), end);
  out.gain.exponentialRampToValueAtTime(0.0001, end + recipe.release);

  let node: AudioNode = out;
  if (recipe.filter) {
    const filter = ctx.createBiquadFilter();
    filter.type = recipe.filter.type;
    filter.frequency.value = recipe.filter.freq;
    if (recipe.filter.q !== undefined) filter.Q.value = recipe.filter.q;
    out.connect(filter);
    filter.connect(dest);
    node = filter;
  } else {
    out.connect(dest);
  }
  void node;

  const stopAt = end + recipe.release + 0.05;
  const oscillators: OscillatorNode[] = [];

  for (const voice of recipe.voices) {
    const osc = ctx.createOscillator();
    osc.type = voice.type;
    osc.frequency.value = freq * voice.ratio;
    if (voice.detune) osc.detune.value = voice.detune;

    const voiceGain = ctx.createGain();
    voiceGain.gain.value = voice.gain;
    osc.connect(voiceGain);
    voiceGain.connect(out);

    osc.start(start);
    osc.stop(stopAt);
    oscillators.push(osc);
  }

  if (recipe.vibrato) {
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = recipe.vibrato.rate;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = recipe.vibrato.depth;
    lfo.connect(lfoGain);
    for (const osc of oscillators) lfoGain.connect(osc.detune);
    lfo.start(start);
    lfo.stop(stopAt);
  }
}

/**
 * Joue un morceau entier et renvoie de quoi l'arreter.
 *
 * Toutes les notes sont programmees d'un coup sur l'horloge audio : la
 * justesse rythmique ne depend plus du timer JavaScript, qui derive des
 * qu'un onglet rame. Le timer ne sert plus qu'a bouger la tete de lecture,
 * ou une derive de quelques millisecondes ne s'entend pas.
 */
export function startMelodiePlayback(
  ctx: AudioContext,
  data: MelodieData,
  options: { onProgress?: (ratio: number) => void; onEnd?: () => void; volume?: number } = {},
): () => void {
  const { onProgress, onEnd, volume = 1 } = options;
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  const spb = beatSeconds(data.bpm);
  // Petite avance : programmer une note exactement a currentTime la fait
  // parfois sauter, le temps que le graphe soit pret.
  const startAt = ctx.currentTime + 0.06;
  for (const note of melodieToNotes(data)) {
    playMelodieNote(
      ctx,
      master,
      note.instrument,
      midiToFreq(note.midi),
      startAt + note.beat * spb,
      note.duration * spb,
      volume,
    );
  }

  const totalSeconds = data.beats * spb;
  let stopped = false;
  const timer = window.setInterval(() => {
    if (stopped) return;
    const elapsed = ctx.currentTime - startAt;
    const ratio = Math.min(1, Math.max(0, elapsed / totalSeconds));
    onProgress?.(ratio);
    if (elapsed >= totalSeconds) {
      stop();
      onEnd?.();
    }
  }, 33);

  function stop() {
    if (stopped) return;
    stopped = true;
    window.clearInterval(timer);
    // Coupure douce : a zero franc, on entendrait un clac.
    const now = ctx.currentTime;
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + 0.05);
    window.setTimeout(() => master.disconnect(), 300);
  }

  return stop;
}

/** Cree le contexte audio a la premiere interaction, jamais avant. */
export function ensureMelodieContext(
  ref: { current: AudioContext | null },
): AudioContext {
  if (!ref.current) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    ref.current = new Ctor();
  }
  // Un contexte cree avant un geste utilisateur demarre suspendu.
  if (ref.current.state === "suspended") void ref.current.resume();
  return ref.current;
}
