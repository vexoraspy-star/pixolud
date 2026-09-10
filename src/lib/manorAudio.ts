// Toute la bande-son du Manoir Maudit est synthetisee en direct avec la Web
// Audio API : aucun fichier audio a charger, rien a licencier.

export function createAudio(): { ctx: AudioContext; master: GainNode; stop: () => void } {
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
  // Troisieme voix tres grave et desaccordee : donne ce battement sourd
  // desagreable typique des musiques d'angoisse.
  const osc3 = ctx.createOscillator();
  osc3.type = "triangle";
  osc3.frequency.value = 36.7;
  const droneGain = ctx.createGain();
  droneGain.gain.value = 0.16;
  osc1.connect(droneGain);
  osc2.connect(droneGain);
  osc3.connect(droneGain);
  droneGain.connect(master);
  osc1.start();
  osc2.start();
  osc3.start();

  // Souffle continu (le vent dans les murs) : bruit rose boucle.
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
    stop: () => {
      try {
        osc1.stop();
        osc2.stop();
        osc3.stop();
        wind.stop();
      } catch {
        // ignore
      }
    },
  };
}

function noiseBurst(
  ctx: AudioContext,
  master: GainNode,
  seconds: number,
  gain: number,
  shape: (t: number) => number,
) {
  const size = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * shape(i / size);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, ctx.currentTime);
  src.connect(g);
  g.connect(master);
  src.start(ctx.currentTime);
  return src;
}

function tone(
  ctx: AudioContext,
  master: GainNode,
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
  g.connect(master);
  osc.start(now);
  osc.stop(now + seconds + 0.05);
}

export function playHeartbeat(ctx: AudioContext, master: GainNode) {
  tone(ctx, master, "sine", 58, 58, 0.28, 0.55, 0.03);
}

export function playPickup(ctx: AudioContext, master: GainNode) {
  tone(ctx, master, "sine", 660, 990, 0.3, 0.3);
}

export function playStinger(ctx: AudioContext, master: GainNode) {
  tone(ctx, master, "sine", 90, 30, 0.6, 0.4, 0.04);
  noiseBurst(ctx, master, 0.35, 0.22, (t) => (1 - t) * 0.5);
}

export function playNearMiss(ctx: AudioContext, master: GainNode) {
  tone(ctx, master, "sawtooth", 640, 110, 0.45, 0.5);
  noiseBurst(ctx, master, 0.4, 0.5, (t) => (1 - t) * 0.7);
}

/** Le monstre se reveille : long grondement montant, tres grave. */
export function playWake(ctx: AudioContext, master: GainNode) {
  tone(ctx, master, "sawtooth", 28, 95, 2, 0.55, 0.5);
  noiseBurst(ctx, master, 1.6, 0.3, (t) => Math.sin(t * Math.PI) * 0.5);
}

/** Un tableau se decroche et s'ecrase au sol. */
export function playCrash(ctx: AudioContext, master: GainNode) {
  noiseBurst(ctx, master, 0.5, 0.85, (t) => Math.pow(1 - t, 2.2));
  tone(ctx, master, "sine", 140, 38, 0.4, 0.7);
}

/** Code refuse : deux "clac" secs et graves. */
export function playDenied(ctx: AudioContext, master: GainNode) {
  tone(ctx, master, "square", 180, 90, 0.12, 0.32);
  window.setTimeout(() => tone(ctx, master, "square", 150, 70, 0.16, 0.32), 130);
}

/** Code accepte : le pene recule, la porte se debloque. */
export function playUnlock(ctx: AudioContext, master: GainNode) {
  tone(ctx, master, "square", 420, 620, 0.1, 0.22);
  window.setTimeout(() => tone(ctx, master, "square", 620, 880, 0.14, 0.24), 110);
  window.setTimeout(() => {
    noiseBurst(ctx, master, 0.7, 0.3, (t) => Math.sin(t * Math.PI) * 0.6);
    tone(ctx, master, "sine", 70, 42, 0.8, 0.4, 0.1);
  }, 260);
}

/**
 * Le screamer de mort : cluster dissonant tres fort + cri sature + coup
 * de grosse caisse. C'est le seul son volontairement agressif du jeu.
 */
export function playDeathScream(ctx: AudioContext, master: GainNode) {
  const now = ctx.currentTime;

  // souffle sature qui claque immediatement
  noiseBurst(ctx, master, 1.4, 1, (t) => Math.pow(1 - t, 0.6));

  // cluster de quintes dissonantes qui plongent
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

  // impact grave
  tone(ctx, master, "sine", 160, 28, 1.1, 0.9, 0.008);

  // "respiration" rauque juste apres
  window.setTimeout(() => {
    noiseBurst(ctx, master, 0.9, 0.4, (t) => Math.sin(t * Math.PI * 2) * (1 - t) * 0.8);
  }, 700);
}

/** Pas etouffes du joueur, joues en alternance pendant la marche. */
export function playFootstep(ctx: AudioContext, master: GainNode) {
  noiseBurst(ctx, master, 0.13, 0.11, (t) => Math.pow(1 - t, 3));
}

/** Grincement d'une marche en bois. */
export function playStairCreak(ctx: AudioContext, master: GainNode) {
  tone(ctx, master, "sawtooth", 320 + Math.random() * 180, 120, 0.5, 0.12, 0.09);
}
