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

/** Un sceau qui cede : la pierre se fend, puis une cloche sourde sonne. */
export function playSealBreak(ctx: AudioContext, master: GainNode, remaining: number) {
  noiseBurst(ctx, master, 0.5, 0.55, (t) => Math.pow(1 - t, 2.2), {
    type: "lowpass",
    freq: 900,
  });
  tone(ctx, master, "square", 190, 48, 0.5, 0.2, 0.005);
  // La cloche monte d'un demi-ton a chaque sceau : on entend qu'on avance.
  const bell = 104 * Math.pow(2, (3 - remaining) / 12);
  window.setTimeout(() => {
    tone(ctx, master, "sine", bell, bell * 0.985, 3.2, 0.42, 0.02);
    tone(ctx, master, "triangle", bell * 3, bell * 2.96, 2.1, 0.12, 0.02);
  }, 180);
}

/** Le tic-tac des dernieres secondes de la fuite. */
export function playTick(ctx: AudioContext, master: GainNode, urgent: boolean) {
  tone(ctx, master, "square", urgent ? 1150 : 820, urgent ? 700 : 520, 0.09, urgent ? 0.3 : 0.16, 0.002);
}

/** La trappe finit de s'ouvrir : l'air froid du dehors s'engouffre. */
export function playHatchOpen(ctx: AudioContext, master: GainNode) {
  noiseBurst(ctx, master, 2.6, 0.3, (t) => Math.sin(t * Math.PI) * (1 - t * 0.3), {
    type: "highpass",
    freq: 600,
  });
  tone(ctx, master, "sine", 58, 180, 2.2, 0.4, 0.4);
}

/**
 * Nappe posee SOUS une replique du narrateur.
 *
 * La voix du navigateur ne peut pas etre traitee (elle ne passe pas par le
 * graphe Web Audio) : on ne peut ni la reverberer ni la saturer. On
 * l'entoure donc de ce qu'on sait synthetiser — un grondement tres grave
 * qui monte avec la phrase, et des chuchotements qui passent d'une oreille
 * a l'autre, comme si d'autres voix repetaient les mots autour de toi.
 */
export function playVoiceBed(ctx: AudioContext, master: GainNode, seconds: number) {
  const now = ctx.currentTime;
  const length = Math.max(1.5, Math.min(12, seconds));

  // Grondement : deux sinus graves legerement desaccordes, qui battent.
  for (const [freq, peak] of [
    [41, 0.24],
    [43.5, 0.16],
    [82, 0.05],
  ] as const) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + length * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, now + length + 1.2);
    osc.connect(g);
    g.connect(master);
    osc.start(now);
    osc.stop(now + length + 1.3);
  }

  // Chuchotements repartis sur la duree de la phrase, panoramiques au hasard.
  const whispers = Math.max(3, Math.round(length * 1.3));
  for (let i = 0; i < whispers; i++) {
    const at = (i / whispers) * length * 1000 + Math.random() * 350;
    window.setTimeout(() => {
      if (ctx.state === "closed") return;
      playWhisper(ctx, master, { pan: Math.random() * 2 - 1, gain: 0.35 + Math.random() * 0.35 });
    }, at);
  }
}

// --- Sons du joueur, de l'inventaire et des screamers ---

/** Le declic de la lampe : un clic sec, plus grave quand on l'eteint. */
export function playFlashlightClick(ctx: AudioContext, master: GainNode, on: boolean) {
  noiseBurst(ctx, master, 0.03, 0.5, (t) => Math.pow(1 - t, 4), { type: "highpass", freq: 2400 });
  tone(ctx, master, "square", on ? 2200 : 1500, on ? 1800 : 900, 0.035, 0.08, 0.001);
}

/** Tissu froisse et genoux qui craquent : on se baisse, ou on se releve. */
export function playCrouch(ctx: AudioContext, master: GainNode, down: boolean) {
  noiseBurst(ctx, master, 0.28, 0.16, (t) => Math.sin(t * Math.PI) * (down ? 1 : 0.7), {
    type: "bandpass",
    freq: down ? 1600 : 2100,
    q: 1.2,
  });
  if (down && Math.random() < 0.5) {
    window.setTimeout(() => tone(ctx, master, "square", 260, 180, 0.03, 0.05, 0.001), 90);
  }
}

/**
 * Pas du joueur. Accroupi on les entend a peine, en courant ils claquent :
 * c'est l'ecoute qui apprend au joueur ce que la chose entend.
 */
export function playPlayerStep(ctx: AudioContext, master: GainNode, kind: "accroupi" | "pas" | "course") {
  const gain = kind === "accroupi" ? 0.045 : kind === "course" ? 0.2 : 0.11;
  const freq = (kind === "course" ? 1800 : kind === "pas" ? 1200 : 700) * (0.85 + Math.random() * 0.3);
  noiseBurst(ctx, master, kind === "course" ? 0.1 : 0.14, gain, (t) => Math.pow(1 - t, 3), {
    type: "lowpass",
    freq,
  });
  // Le plancher repond parfois sous le poids.
  if (kind !== "accroupi" && Math.random() < (kind === "course" ? 0.3 : 0.12)) {
    tone(ctx, master, "sawtooth", 180 + Math.random() * 120, 90, 0.22, 0.035, 0.04);
  }
}

/** Une piece lancee : le sifflement, puis rien jusqu'a l'impact. */
export function playCoinThrow(ctx: AudioContext, master: GainNode) {
  noiseBurst(ctx, master, 0.12, 0.12, (t) => Math.sin(t * Math.PI), { type: "highpass", freq: 3000 });
}

/** La piece touche le sol et roule. Placee dans l'espace : on sait ou elle est tombee. */
export function playCoinLand(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  [0, 140, 250, 330, 385].forEach((at, i) => {
    window.setTimeout(() => {
      if (ctx.state === "closed") return;
      const f = 3100 + Math.random() * 500;
      tone(ctx, dest, "sine", f, f * 0.98, 0.09, 0.22 * Math.pow(0.62, i), 0.001);
      tone(ctx, dest, "triangle", f * 1.47, f * 1.45, 0.06, 0.08 * Math.pow(0.62, i), 0.001);
    }, at);
  });
}

export interface MusicBoxSound {
  stop: () => void;
  /** Le joueur bouge : la boite reste ou elle est, le son doit suivre. */
  place: (pan: number, gain: number) => void;
}

/**
 * Boite a musique : une berceuse en mineur, clochettes aigues un peu
 * desaccordees. Renvoie de quoi la couper et la replacer dans l'espace.
 */
export function playMusicBox(ctx: AudioContext, master: GainNode, seconds: number): MusicBoxSound {
  const dest = ctx.createGain();
  dest.gain.value = 1;
  let panner: StereoPannerNode | null = null;
  if (typeof ctx.createStereoPanner === "function") {
    panner = ctx.createStereoPanner();
    dest.connect(panner);
    panner.connect(master);
  } else {
    dest.connect(master);
  }
  const melody = [659, 880, 1047, 988, 880, 659, 587, 523, 494, 415, 440, 0, 523, 494, 440, 330];
  const step = 0.36;
  let stopped = false;
  const timers: number[] = [];
  const total = Math.floor(seconds / step);
  for (let i = 0; i < total; i++) {
    const f = melody[i % melody.length];
    if (!f) continue;
    // Le ressort se detend : la melodie ralentit et baisse sur la fin.
    const tired = 1 - (i / total) * 0.04;
    timers.push(
      window.setTimeout(() => {
        if (stopped || ctx.state === "closed") return;
        tone(ctx, dest, "sine", f * tired, f * tired, 0.9, 0.16, 0.003);
        tone(ctx, dest, "triangle", f * 2.01 * tired, f * 2 * tired, 0.35, 0.04, 0.002);
      }, i * step * 1000 * (1 + (i / total) * 0.25)),
    );
  }
  return {
    stop: () => {
      stopped = true;
      for (const t of timers) window.clearTimeout(t);
    },
    place: (pan: number, gain: number) => {
      if (ctx.state === "closed") return;
      const now = ctx.currentTime;
      dest.gain.setTargetAtTime(Math.max(0, gain), now, 0.1);
      panner?.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), now, 0.1);
    },
  };
}

/** Une poignee de sel jetee : un crepitement sec. */
export function playSaltThrow(ctx: AudioContext, master: GainNode) {
  noiseBurst(ctx, master, 0.45, 0.4, (t) => (Math.random() < 0.3 ? 1 : 0.2) * (1 - t), {
    type: "highpass",
    freq: 2600,
  });
}

/** Elle recule, brulee par le sel : un cri etrangle qui monte. */
export function playRecoil(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  tone(ctx, dest, "sawtooth", 300, 1300, 0.55, 0.3, 0.02);
  tone(ctx, dest, "sawtooth", 313, 1190, 0.55, 0.22, 0.02);
  noiseBurst(ctx, dest, 0.7, 0.3, (t) => Math.sin(t * Math.PI), { type: "bandpass", freq: 1400, q: 3 });
}

/** Gonds d'armoire : un grincement long, puis le battant qui claque doucement. */
export function playWardrobe(ctx: AudioContext, master: GainNode, opening: boolean) {
  tone(ctx, master, "sawtooth", opening ? 420 : 520, opening ? 610 : 300, 0.45, 0.06, 0.12);
  tone(ctx, master, "sawtooth", opening ? 432 : 540, opening ? 590 : 310, 0.45, 0.04, 0.12);
  window.setTimeout(() => {
    if (ctx.state === "closed") return;
    noiseBurst(ctx, master, 0.12, 0.3, (t) => Math.pow(1 - t, 3), { type: "lowpass", freq: 900 });
  }, opening ? 380 : 420);
}

/** Se glisser sous un lit : parquet et draps. */
export function playUnderBed(ctx: AudioContext, master: GainNode) {
  noiseBurst(ctx, master, 0.5, 0.2, (t) => Math.sin(t * Math.PI), { type: "bandpass", freq: 900, q: 0.8 });
}

/** La poignee d'une porte verrouillee qu'on secoue. */
export function playLockedRattle(ctx: AudioContext, master: GainNode) {
  for (let i = 0; i < 3; i++) {
    window.setTimeout(() => {
      if (ctx.state === "closed") return;
      noiseBurst(ctx, master, 0.06, 0.35, (t) => Math.pow(1 - t, 2), { type: "bandpass", freq: 1900, q: 2 });
      tone(ctx, master, "square", 340, 260, 0.05, 0.06, 0.001);
    }, i * 95);
  }
}

/** Un trousseau : ramasser une cle. */
export function playKeyPickup(ctx: AudioContext, master: GainNode) {
  [2900, 3600, 3300].forEach((f, i) => {
    window.setTimeout(() => {
      if (ctx.state === "closed") return;
      tone(ctx, master, "sine", f, f * 0.99, 0.18, 0.12, 0.001);
    }, i * 70);
  });
}

/** Papier qu'on deplie. */
export function playPaper(ctx: AudioContext, master: GainNode) {
  noiseBurst(ctx, master, 0.35, 0.22, (t) => (Math.random() < 0.5 ? 1 : 0.3) * Math.sin(t * Math.PI), {
    type: "highpass",
    freq: 1800,
  });
}

/** Changer d'objet dans la main. */
export function playSlot(ctx: AudioContext, master: GainNode) {
  tone(ctx, master, "triangle", 520, 480, 0.05, 0.05, 0.002);
}

/** Retenir son souffle : une inspiration coupee net. */
export function playBreathHold(ctx: AudioContext, master: GainNode) {
  noiseBurst(ctx, master, 0.4, 0.2, (t) => (t < 0.8 ? t : (1 - t) * 4), { type: "bandpass", freq: 1100, q: 1 });
}

/** On ne tient plus : le souffle repart d'un coup, beaucoup trop fort. */
export function playGasp(ctx: AudioContext, master: GainNode) {
  noiseBurst(ctx, master, 0.9, 0.55, (t) => Math.pow(1 - t, 1.3), { type: "bandpass", freq: 900, q: 0.9 });
  window.setTimeout(() => {
    if (ctx.state === "closed") return;
    noiseBurst(ctx, master, 0.7, 0.3, (t) => Math.sin(t * Math.PI), { type: "bandpass", freq: 800, q: 1 });
  }, 850);
}

/** Respiration du joueur, tremblante, quand elle rode pres de la cachette. */
export function playPlayerBreath(ctx: AudioContext, master: GainNode) {
  noiseBurst(ctx, master, 0.75, 0.12, (t) => Math.sin(t * Math.PI) * (0.7 + Math.random() * 0.3), {
    type: "bandpass",
    freq: 1000,
    q: 1.1,
  });
}

/** Elle te repere : un cri aigu, bref, qui vient de sa direction. */
export function playShriek(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  const now = ctx.currentTime;
  for (const f of [620, 655, 930]) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(f * 0.7, now);
    osc.frequency.exponentialRampToValueAtTime(f * 1.6, now + 0.18);
    osc.frequency.exponentialRampToValueAtTime(f * 0.9, now + 0.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.18, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
    osc.connect(g);
    g.connect(dest);
    osc.start(now);
    osc.stop(now + 0.9);
  }
  noiseBurst(ctx, dest, 0.6, 0.35, (t) => Math.pow(1 - t, 1.5), { type: "bandpass", freq: 2200, q: 2 });
}

/** Elle a entendu quelque chose : grognement grave, venu de sa direction. */
export function playGrowl(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  tone(ctx, dest, "sawtooth", 72, 58, 1.1, 0.22, 0.2);
  noiseBurst(ctx, dest, 1.1, 0.25, (t) => Math.sin(t * Math.PI) * (0.6 + Math.random() * 0.4), {
    type: "lowpass",
    freq: 320,
    q: 4,
  });
}

/**
 * Screamer en pleine partie. Plus court que le cri de mort, mais sans
 * attaque douce : le son arrive plein pot des la premiere milliseconde.
 */
export function playScreamer(ctx: AudioContext, master: GainNode) {
  const now = ctx.currentTime;
  noiseBurst(ctx, master, 0.7, 0.9, (t) => Math.pow(1 - t, 0.9));
  for (const f of [1046, 1108, 1480, 740]) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(f, now);
    osc.frequency.exponentialRampToValueAtTime(f * 0.45, now + 0.65);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.26, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
    osc.connect(g);
    g.connect(master);
    osc.start(now);
    osc.stop(now + 0.75);
  }
  tone(ctx, master, "sine", 120, 30, 0.6, 0.8, 0.002);
}

/** Juste a cote de l'oreille : un souffle, puis un mot qu'on ne comprend pas. */
export function playEarWhisper(ctx: AudioContext, master: GainNode, pan: number) {
  playBreath(ctx, master, { pan, gain: 1.4 });
  window.setTimeout(() => {
    if (ctx.state === "closed") return;
    playWhisper(ctx, master, { pan, gain: 1.6 });
  }, 500);
}

/** La lampe qui meurt : un gresillement electrique. */
export function playBulbDie(ctx: AudioContext, master: GainNode) {
  for (let i = 0; i < 5; i++) {
    window.setTimeout(() => {
      if (ctx.state === "closed") return;
      noiseBurst(ctx, master, 0.04 + Math.random() * 0.05, 0.25, () => 1, { type: "bandpass", freq: 4000, q: 3 });
    }, i * 60 + Math.random() * 40);
  }
  window.setTimeout(() => {
    if (ctx.state === "closed") return;
    tone(ctx, master, "sine", 120, 60, 0.3, 0.1, 0.005);
  }, 340);
}
