// Bande-son des Backrooms, entierement synthetisee (Web Audio API).
//
// Le son le plus important du jeu est aussi le plus banal : le bourdonnement
// des neons. Un 120 Hz qui ne s'arrete jamais, legerement instable. Quand il
// se coupe (panne), le silence fait plus peur que n'importe quel cri.

import type { LightingKind } from "./backrooms";

export interface Spatial {
  pan?: number;
  gain?: number;
}

function out(ctx: AudioContext, master: AudioNode, opts?: Spatial): AudioNode {
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
  delay = 0,
) {
  const now = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + seconds);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), now + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
  osc.connect(g);
  g.connect(dest);
  osc.start(now);
  osc.stop(now + seconds + 0.05);
}

/** Tampon de bruit en boucle, brun (grave) ou blanc. */
function loopNoise(ctx: AudioContext, seconds: number, brown: boolean): AudioBufferSourceNode {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.5;
    } else {
      d[i] = white;
    }
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}

export interface BackroomsAudio {
  ctx: AudioContext;
  master: GainNode;
  /** 0 calme, 1 panique : dissonance et souffle montent. */
  setTension: (value: number) => void;
  /** 1 neons allumes, 0 panne : le bourdonnement suit. */
  setPower: (value: number) => void;
  stop: () => void;
}

export function createBackroomsAudio(lighting: LightingKind): BackroomsAudio {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  const ctx: AudioContext = new Ctor();
  const master = ctx.createGain();
  master.gain.value = 0.34;
  master.connect(ctx.destination);

  const stoppables: (OscillatorNode | AudioBufferSourceNode)[] = [];
  const timers: number[] = [];
  let stopped = false;

  // --- Bourdonnement electrique (suit l'alimentation) ---
  const humGain = ctx.createGain();
  humGain.gain.value = 0;
  humGain.connect(master);
  const humBase = lighting === "neons" ? 0.07 : lighting === "entrepot" ? 0.035 : lighting === "alarme" ? 0.02 : 0.012;
  const hum1 = ctx.createOscillator();
  hum1.type = "sawtooth";
  hum1.frequency.value = lighting === "entrepot" ? 100 : 120;
  const humFilter = ctx.createBiquadFilter();
  humFilter.type = "bandpass";
  humFilter.frequency.value = lighting === "entrepot" ? 200 : 240;
  humFilter.Q.value = 1.6;
  hum1.connect(humFilter);
  humFilter.connect(humGain);
  const hum2 = ctx.createOscillator();
  hum2.type = "square";
  hum2.frequency.value = hum1.frequency.value * 3;
  const hum2Gain = ctx.createGain();
  hum2Gain.gain.value = 0.08;
  hum2.connect(hum2Gain);
  hum2Gain.connect(humFilter);
  // Sifflement aigu des ballasts, a peine audible mais toujours la.
  const whine = ctx.createOscillator();
  whine.type = "sine";
  whine.frequency.value = 9100;
  const whineGain = ctx.createGain();
  whineGain.gain.value = lighting === "neons" ? 0.05 : 0.01;
  whine.connect(whineGain);
  whineGain.connect(humGain);
  // Instabilite : le bourdonnement respire.
  const wobble = ctx.createOscillator();
  wobble.frequency.value = 0.37;
  const wobbleGain = ctx.createGain();
  wobbleGain.gain.value = humBase * 0.25;
  wobble.connect(wobbleGain);
  wobbleGain.connect(humGain.gain);
  for (const o of [hum1, hum2, whine, wobble]) {
    o.start();
    stoppables.push(o);
  }

  // --- Ambiance propre au niveau ---
  const room = loopNoise(ctx, 4, true);
  const roomFilter = ctx.createBiquadFilter();
  roomFilter.type = "lowpass";
  roomFilter.frequency.value = lighting === "secours" ? 900 : lighting === "entrepot" ? 160 : 420;
  const roomGain = ctx.createGain();
  roomGain.gain.value = lighting === "entrepot" ? 0.16 : lighting === "secours" ? 0.08 : 0.06;
  room.connect(roomFilter);
  roomFilter.connect(roomGain);
  roomGain.connect(master);
  room.start();
  stoppables.push(room);

  if (lighting === "secours") {
    // Vapeur qui fuit quelque part.
    const hiss = loopNoise(ctx, 3, false);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 3200;
    const hg = ctx.createGain();
    hg.gain.value = 0.018;
    hiss.connect(hp);
    hp.connect(hg);
    hg.connect(master);
    hiss.start();
    stoppables.push(hiss);
  }

  const drone = ctx.createOscillator();
  drone.type = "sine";
  drone.frequency.value = lighting === "alarme" ? 49 : 41;
  const droneGain = ctx.createGain();
  droneGain.gain.value = lighting === "alarme" ? 0.1 : 0.05;
  drone.connect(droneGain);
  droneGain.connect(master);
  drone.start();
  stoppables.push(drone);

  // Dissonance de tension.
  const dis = ctx.createOscillator();
  dis.type = "sawtooth";
  dis.frequency.value = lighting === "alarme" ? 233 : 58.3;
  const disGain = ctx.createGain();
  disGain.gain.value = 0;
  dis.connect(disGain);
  disGain.connect(master);
  dis.start();
  stoppables.push(dis);

  if (lighting === "alarme") {
    // Sirene lente : deux scies qui battent, modulees.
    const siren = ctx.createOscillator();
    siren.type = "sawtooth";
    siren.frequency.value = 220;
    const sirenFilter = ctx.createBiquadFilter();
    sirenFilter.type = "lowpass";
    sirenFilter.frequency.value = 900;
    const sirenGain = ctx.createGain();
    sirenGain.gain.value = 0.012;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.9;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 40;
    lfo.connect(lfoGain);
    lfoGain.connect(siren.frequency);
    siren.connect(sirenFilter);
    sirenFilter.connect(sirenGain);
    sirenGain.connect(master);
    siren.start();
    lfo.start();
    stoppables.push(siren, lfo);
  }

  // Evenements d'ambiance aleatoires : gouttes, coups dans les tuyaux, craquements.
  function schedule() {
    if (stopped) return;
    const delay = 2500 + Math.random() * 6000;
    timers.push(
      window.setTimeout(() => {
        if (stopped || ctx.state === "closed") return;
        const pan = Math.random() * 2 - 1;
        if (lighting === "entrepot") {
          const f = 1400 + Math.random() * 1600;
          tone(ctx, out(ctx, master, { pan, gain: 0.5 + Math.random() * 0.4 }), "sine", f, f * 0.6, 0.12, 0.12, 0.002);
        } else if (lighting === "secours") {
          playPipeKnock(ctx, master, { pan, gain: 0.3 + Math.random() * 0.5 });
        } else if (lighting === "neons" && Math.random() < 0.4) {
          noiseBurst(ctx, out(ctx, master, { pan, gain: 0.25 }), 0.08, 0.4, () => (Math.random() < 0.5 ? 1 : 0), {
            type: "bandpass",
            freq: 3500,
            q: 2,
          });
        }
        schedule();
      }, delay),
    );
  }
  schedule();

  let power = 1;
  const applyHum = () => {
    humGain.gain.setTargetAtTime(humBase * power, ctx.currentTime, power > 0.5 ? 0.25 : 0.08);
  };
  applyHum();

  return {
    ctx,
    master,
    setTension: (value: number) => {
      const v = Math.max(0, Math.min(1, value));
      const now = ctx.currentTime;
      disGain.gain.setTargetAtTime(v * (lighting === "alarme" ? 0.025 : 0.05), now, 0.4);
      roomGain.gain.setTargetAtTime((lighting === "entrepot" ? 0.16 : 0.06) + v * 0.08, now, 0.5);
    },
    setPower: (value: number) => {
      const v = Math.max(0, Math.min(1, value));
      if (Math.abs(v - power) < 0.02) return;
      power = v;
      applyHum();
    },
    stop: () => {
      stopped = true;
      for (const t of timers) window.clearTimeout(t);
      for (const n of stoppables) {
        try {
          n.stop();
        } catch {
          // deja arrete
        }
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Sons ponctuels
// ---------------------------------------------------------------------------

export type Surface = "moquette" | "beton" | "metal" | "carrelage";

/** Un pas. La moquette detrempee fait « scrouitch », le metal sonne creux. */
export function playStep(ctx: AudioContext, master: GainNode, surface: Surface, intensity: number, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  const g = 0.05 + intensity * 0.16;
  if (surface === "moquette") {
    noiseBurst(ctx, dest, 0.16, g, (t) => Math.pow(1 - t, 2) * (0.6 + Math.random() * 0.4), {
      type: "lowpass",
      freq: 700 + Math.random() * 300,
    });
    // Le mouille : un petit bruit de succion juste apres.
    if (Math.random() < 0.5) {
      noiseBurst(ctx, dest, 0.08, g * 0.5, (t) => Math.sin(t * Math.PI), { type: "bandpass", freq: 1800, q: 3 });
    }
  } else if (surface === "metal") {
    noiseBurst(ctx, dest, 0.09, g, (t) => Math.pow(1 - t, 3), { type: "bandpass", freq: 1200, q: 1.5 });
    const f = 380 + Math.random() * 160;
    tone(ctx, dest, "triangle", f, f * 0.94, 0.18, g * 0.35, 0.002);
  } else if (surface === "carrelage") {
    noiseBurst(ctx, dest, 0.07, g * 1.1, (t) => Math.pow(1 - t, 4), { type: "highpass", freq: 900 });
  } else {
    noiseBurst(ctx, dest, 0.11, g, (t) => Math.pow(1 - t, 3), { type: "lowpass", freq: 1300 });
  }
}

/** Elan au depart d'une course : la veste qui claque, le poids qui bascule. */
export function playRunStart(ctx: AudioContext, master: GainNode) {
  noiseBurst(ctx, master, 0.22, 0.2, (t) => Math.sin(t * Math.PI) * (1 - t * 0.5), { type: "bandpass", freq: 1400, q: 0.7 });
  tone(ctx, master, "sine", 120, 60, 0.14, 0.12, 0.004);
}

/**
 * Une foulee de course, par-dessus le bruit du sol : talon lourd, veste qui
 * frotte, et parfois le sac a dos qui cogne. `side` alterne gauche et droite.
 */
export function playRunStride(ctx: AudioContext, master: GainNode, side: number) {
  const dest = out(ctx, master, { pan: side * 0.18, gain: 1 });
  tone(ctx, dest, "sine", 95 + Math.random() * 20, 48, 0.13, 0.2, 0.003);
  noiseBurst(ctx, dest, 0.16, 0.075, (t) => Math.sin(t * Math.PI), { type: "bandpass", freq: 2300 + Math.random() * 600, q: 0.8 });
  if (Math.random() < 0.3) {
    const f = 1500 + Math.random() * 500;
    tone(ctx, dest, "triangle", f, f * 0.9, 0.05, 0.03, 0.002, 0.06);
  }
}

/**
 * Souffle de course. Inspiration breve, expiration plus longue ; quand
 * l'endurance fond (`strain` vers 1), le souffle devient rauque et s'entend.
 */
export function playRunBreath(ctx: AudioContext, master: GainNode, exhale: boolean, strain: number) {
  const k = Math.max(0, Math.min(1, strain));
  const gain = 0.05 + k * 0.13;
  if (exhale) {
    noiseBurst(ctx, master, 0.3 + k * 0.08, gain, (t) => Math.pow(1 - t, 1.4) * Math.min(1, t * 12), {
      type: "bandpass",
      freq: 950 - k * 200,
      q: 0.9,
    });
    // A bout de souffle, la gorge vibre un peu a l'expiration.
    if (k > 0.6) tone(ctx, master, "sawtooth", 140, 105, 0.26, 0.02 * k, 0.03);
  } else {
    noiseBurst(ctx, master, 0.2, gain * 0.8, (t) => Math.sin(t * Math.PI), { type: "bandpass", freq: 1500 + k * 300, q: 1.1 });
  }
}

/** Tendre la main et saisir : froissement de manche, doigts qui se referment. */
export function playGrab(ctx: AudioContext, master: GainNode) {
  noiseBurst(ctx, master, 0.14, 0.16, (t) => Math.sin(t * Math.PI), { type: "bandpass", freq: 1900, q: 0.9 });
  tone(ctx, master, "triangle", 320, 210, 0.06, 0.05, 0.002, 0.09);
}

/** Poignee de porte : le loquet claque ; verrouillee, elle resiste et cogne. */
export function playHandle(ctx: AudioContext, master: GainNode, locked: boolean) {
  noiseBurst(ctx, master, 0.05, 0.35, (t) => Math.pow(1 - t, 3), { type: "highpass", freq: 1600 });
  tone(ctx, master, "square", 540, 380, 0.045, 0.07, 0.001);
  if (locked) {
    for (const at of [140, 250]) {
      window.setTimeout(() => {
        if (ctx.state === "closed") return;
        noiseBurst(ctx, master, 0.06, 0.3, (t) => Math.pow(1 - t, 2), { type: "bandpass", freq: 1100, q: 2 });
        tone(ctx, master, "square", 300, 230, 0.05, 0.05, 0.001);
      }, at);
    }
  }
}

/** Les mains se referment sur le volant d'une vanne : metal froid, un premier grincement. */
export function playGripValve(ctx: AudioContext, master: GainNode) {
  tone(ctx, master, "triangle", 720, 660, 0.22, 0.07, 0.004);
  noiseBurst(ctx, master, 0.1, 0.2, (t) => Math.pow(1 - t, 2), { type: "bandpass", freq: 900, q: 1.2 });
}

/** Ramasser une bouteille : le verre qui tinte. */
export function playBottle(ctx: AudioContext, master: GainNode) {
  tone(ctx, master, "sine", 2400, 2380, 0.4, 0.14, 0.002);
  tone(ctx, master, "sine", 3610, 3590, 0.3, 0.06, 0.002, 0.03);
}

/** Boire : trois gorgees. */
export function playDrink(ctx: AudioContext, master: GainNode) {
  for (let i = 0; i < 3; i++) {
    noiseBurst(
      ctx,
      master,
      0.18,
      0.25,
      (t) => Math.sin(t * Math.PI),
      { type: "bandpass", freq: 520 + i * 60, q: 4 },
    );
    tone(ctx, master, "sine", 180, 120, 0.12, 0.08, 0.01, i * 0.32);
  }
}

export function playClick(ctx: AudioContext, master: GainNode, high = true) {
  noiseBurst(ctx, master, 0.03, 0.5, (t) => Math.pow(1 - t, 4), { type: "highpass", freq: 2400 });
  tone(ctx, master, "square", high ? 2000 : 1300, high ? 1600 : 800, 0.035, 0.08, 0.001);
}

/** Ramasser un fusible, ou le visser dans l'armoire. */
export function playFuse(ctx: AudioContext, master: GainNode, inserted: boolean) {
  if (inserted) {
    noiseBurst(ctx, master, 0.15, 0.6, (t) => Math.pow(1 - t, 3), { type: "lowpass", freq: 1200 });
    tone(ctx, master, "square", 140, 90, 0.15, 0.2, 0.002);
    tone(ctx, master, "sine", 880, 880, 0.25, 0.1, 0.002, 0.15);
  } else {
    tone(ctx, master, "triangle", 1200, 900, 0.1, 0.12, 0.002);
    noiseBurst(ctx, master, 0.05, 0.3, (t) => 1 - t, { type: "highpass", freq: 2000 });
  }
}

/** La vanne grince pendant qu'on la tourne. `progress` de 0 a 1 fait monter la note. */
export function playValveTurn(ctx: AudioContext, master: GainNode, progress: number) {
  const f = 260 + progress * 220 + Math.random() * 30;
  tone(ctx, master, "sawtooth", f, f * 1.08, 0.35, 0.05, 0.08);
  tone(ctx, master, "sawtooth", f * 1.01, f * 1.1, 0.35, 0.035, 0.08);
}

export function playValveDone(ctx: AudioContext, master: GainNode) {
  noiseBurst(ctx, master, 0.25, 0.7, (t) => Math.pow(1 - t, 2.5), { type: "lowpass", freq: 900 });
  tone(ctx, master, "sine", 110, 55, 0.5, 0.3, 0.005);
  noiseBurst(ctx, master, 1.6, 0.25, (t) => (1 - t) * Math.min(1, t * 8), { type: "highpass", freq: 2800 });
}

/** Coup sourd dans les canalisations. */
export function playPipeKnock(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  const n = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const f = 90 + Math.random() * 60;
    tone(ctx, dest, "triangle", f, f * 0.8, 0.35, 0.25, 0.003, i * 0.18);
    tone(ctx, dest, "sine", f * 4.2, f * 4, 0.5, 0.05, 0.003, i * 0.18);
  }
}

/** Neon qui gresille. */
export function playFlicker(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  for (let i = 0; i < 4; i++) {
    window.setTimeout(() => {
      if (ctx.state === "closed") return;
      noiseBurst(ctx, dest, 0.03 + Math.random() * 0.05, 0.35, () => 1, { type: "bandpass", freq: 3200, q: 2.5 });
    }, i * 55 + Math.random() * 40);
  }
}

/** Coupure generale : le bourdonnement s'effondre, un claquement dans le noir. */
export function playBlackout(ctx: AudioContext, master: GainNode) {
  tone(ctx, master, "sawtooth", 120, 30, 1.2, 0.12, 0.01);
  noiseBurst(ctx, master, 0.3, 0.7, (t) => Math.pow(1 - t, 3), { type: "lowpass", freq: 600 });
}

export function playPowerOn(ctx: AudioContext, master: GainNode) {
  noiseBurst(ctx, master, 0.2, 0.5, (t) => Math.pow(1 - t, 3), { type: "lowpass", freq: 900 });
  tone(ctx, master, "sawtooth", 40, 120, 0.8, 0.08, 0.2, 0.1);
  for (let i = 0; i < 6; i++) {
    tone(ctx, master, "square", 3000, 2800, 0.03, 0.03, 0.001, 0.15 + i * 0.07 + Math.random() * 0.05);
  }
}

/** Porte metallique lourde. */
export function playDoorOpen(ctx: AudioContext, master: GainNode) {
  noiseBurst(ctx, master, 0.18, 0.7, (t) => Math.pow(1 - t, 3), { type: "lowpass", freq: 700 });
  tone(ctx, master, "sawtooth", 180, 260, 0.9, 0.05, 0.3, 0.1);
  tone(ctx, master, "sine", 70, 45, 0.6, 0.3, 0.005, 0.95);
}

/** Monte-charge : sonnette, puis le moteur. */
export function playElevator(ctx: AudioContext, master: GainNode) {
  tone(ctx, master, "sine", 1318, 1318, 0.9, 0.18, 0.005);
  tone(ctx, master, "sine", 1046, 1046, 1.1, 0.18, 0.005, 0.35);
  tone(ctx, master, "sawtooth", 55, 70, 2.5, 0.06, 0.6, 0.6);
}

/** Le sourire qui glousse dans le noir : bruit en bande etroite, rythme d'enfant. */
export function playSmilerGiggle(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  const base = 900 + Math.random() * 300;
  for (let i = 0; i < 5; i++) {
    const f = base * (1 + (i % 2) * 0.12);
    noiseBurst(ctx, dest, 0.09, 0.4, (t) => Math.sin(t * Math.PI), { type: "bandpass", freq: f, q: 9 });
    tone(ctx, dest, "triangle", f / 2, f / 2.3, 0.08, 0.05, 0.005, i * 0.11);
  }
}

/** Il fonce sur toi. */
export function playSmilerRush(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  tone(ctx, dest, "sawtooth", 400, 1800, 0.7, 0.2, 0.05);
  tone(ctx, dest, "sawtooth", 413, 1650, 0.7, 0.16, 0.05);
  noiseBurst(ctx, dest, 0.8, 0.4, (t) => t, { type: "bandpass", freq: 2000, q: 1.5 });
}

/** Cliquetis de la Bacterie : des dizaines de petits claquements secs. */
export function playBacteriaClicks(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  const n = 8 + Math.floor(Math.random() * 10);
  for (let i = 0; i < n; i++) {
    const at = i * (0.025 + Math.random() * 0.04);
    const f = 1800 + Math.random() * 2500;
    tone(ctx, dest, "square", f, f * 0.7, 0.015, 0.06, 0.001, at);
  }
}

export function playBacteriaScreech(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  const now = ctx.currentTime;
  for (const f of [520, 553, 780, 1170]) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(f * 0.6, now);
    osc.frequency.exponentialRampToValueAtTime(f * 1.4, now + 0.25);
    osc.frequency.exponentialRampToValueAtTime(f * 0.5, now + 1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.14, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.05);
    osc.connect(g);
    g.connect(dest);
    osc.start(now);
    osc.stop(now + 1.1);
  }
  noiseBurst(ctx, dest, 0.9, 0.45, (t) => Math.pow(1 - t, 1.2), { type: "bandpass", freq: 2600, q: 1.2 });
}

/** Pas lourds et irreguliers de la chose. */
export function playEntityStep(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  noiseBurst(ctx, dest, 0.12, 0.22, (t) => Math.pow(1 - t, 3), { type: "lowpass", freq: 500 });
  tone(ctx, dest, "sine", 80, 50, 0.12, 0.12, 0.003);
}

/** Chuchotement : on y entend des mots sans jamais les comprendre. */
export function playWhisper(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  const freq = 700 + Math.random() * 900;
  noiseBurst(ctx, dest, 0.9 + Math.random() * 0.6, 0.45, (t) => Math.sin(t * Math.PI) * (0.6 + Math.random() * 0.4), {
    type: "bandpass",
    freq,
    q: 14,
  });
}

/** Pas lointains, qui ne sont pas les tiens. */
export function playDistantSteps(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  for (let i = 0; i < 4; i++) {
    window.setTimeout(() => {
      if (ctx.state === "closed") return;
      noiseBurst(ctx, dest, 0.12, 0.12, (t) => Math.pow(1 - t, 3), { type: "lowpass", freq: 600 });
    }, i * (480 + Math.random() * 80));
  }
}

export function playHeartbeat(ctx: AudioContext, master: GainNode, gain: number) {
  tone(ctx, master, "sine", 58, 50, 0.22, 0.45 * gain, 0.02);
  tone(ctx, master, "sine", 54, 46, 0.2, 0.35 * gain, 0.02, 0.24);
}

/** A bout de souffle. */
export function playGasp(ctx: AudioContext, master: GainNode) {
  noiseBurst(ctx, master, 0.8, 0.45, (t) => Math.pow(1 - t, 1.3), { type: "bandpass", freq: 900, q: 0.9 });
}

/**
 * No-clip : on passe a travers la realite. Un souffle aspire, une note qui
 * s'effondre, et le bourdonnement du niveau suivant qui arrive.
 */
export function playNoclip(ctx: AudioContext, master: GainNode) {
  noiseBurst(ctx, master, 1.8, 0.6, (t) => Math.pow(t, 2) * (1 - Math.pow(t, 8)), { type: "bandpass", freq: 700, q: 0.8 });
  tone(ctx, master, "sawtooth", 880, 40, 1.6, 0.18, 0.4);
  tone(ctx, master, "sine", 30, 30, 1.8, 0.5, 1, 0.2);
}

/** Capture : sature, sans attaque douce. */
export function playDeath(ctx: AudioContext, master: GainNode) {
  const now = ctx.currentTime;
  noiseBurst(ctx, master, 1.3, 1, (t) => Math.pow(1 - t, 0.7));
  for (const f of [700, 742, 990, 1485]) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(f, now);
    osc.frequency.exponentialRampToValueAtTime(f * 0.15, now + 1.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    osc.connect(g);
    g.connect(master);
    osc.start(now);
    osc.stop(now + 1.25);
  }
  tone(ctx, master, "sine", 140, 25, 1.1, 0.9, 0.004);
}

/** La lucidite qui lache : une note aigue qui siffle dans les oreilles. */
export function playTinnitus(ctx: AudioContext, master: GainNode) {
  tone(ctx, master, "sine", 6200, 6000, 3, 0.03, 1.2);
}
