// Bande-son des Backrooms, entierement synthetisee (Web Audio API).
//
// Le son le plus important du jeu est aussi le plus banal : le bourdonnement
// des neons. Un 120 Hz qui ne s'arrete jamais, legerement instable. Quand il
// se coupe (panne), le silence fait plus peur que n'importe quel cri.

import type { LightingKind } from "./backrooms";
import type { MonsterKind } from "./backroomsMonsters";

export interface Spatial {
  pan?: number;
  gain?: number;
}

/** Contexte ferme (scene quittee) ou factice (Web Audio indisponible) : on ne joue rien. */
function dead(ctx: AudioContext): boolean {
  return ctx.state === "closed";
}

function out(ctx: AudioContext, master: AudioNode, opts?: Spatial): AudioNode {
  if (!opts || dead(ctx)) return master;
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
  delay = 0,
) {
  if (dead(ctx)) return;
  const size = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * shape(i / size);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, ctx.currentTime + delay);
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
  src.start(ctx.currentTime + delay);
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
  if (dead(ctx)) return;
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

/**
 * Bande-son muette quand le navigateur refuse le Web Audio : un faux contexte
 * "ferme", que toutes les fonctions play* ignorent. Le jeu reste jouable.
 */
function silentAudio(): BackroomsAudio {
  const noop = () => {};
  const ctx = {
    state: "closed",
    currentTime: 0,
    sampleRate: 44100,
    resume: () => Promise.resolve(),
    suspend: () => Promise.resolve(),
    close: () => Promise.resolve(),
  } as unknown as AudioContext;
  const master = { gain: { value: 0 }, connect: noop, disconnect: noop } as unknown as GainNode;
  return { ctx, master, setTension: noop, setPower: noop, stop: noop };
}

export function createBackroomsAudio(lighting: LightingKind, flavor: AudioFlavor = null): BackroomsAudio {
  let ctx: AudioContext;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return silentAudio();
    ctx = new Ctor();
  } catch {
    return silentAudio();
  }
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
  // Lumieres eteintes : plus un seul neon, donc plus de bourdonnement du tout.
  const humBase =
    flavor === "noir"
      ? 0
      : flavor === "centrale"
        ? 0.075
        : flavor === "piscines"
          ? 0.025
          : flavor === "hotel"
            ? 0.03
            : flavor === "fete"
              ? 0.04
              : lighting === "neons"
                ? 0.07
                : lighting === "entrepot"
                  ? 0.035
                  : lighting === "alarme"
                    ? 0.02
                    : 0.012;
  const hum1 = ctx.createOscillator();
  hum1.type = "sawtooth";
  // La centrale ronfle a 50 Hz, comme un vrai transformateur.
  hum1.frequency.value = flavor === "centrale" ? 50 : lighting === "entrepot" ? 100 : 120;
  const humFilter = ctx.createBiquadFilter();
  humFilter.type = "bandpass";
  humFilter.frequency.value = flavor === "centrale" ? 150 : lighting === "entrepot" ? 200 : 240;
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

  if (flavor === "piscines") {
    // L'eau qui clapote contre le carrelage, et la reverberation d'un grand bassin.
    const lap = loopNoise(ctx, 5, true);
    const lapFilter = ctx.createBiquadFilter();
    lapFilter.type = "bandpass";
    lapFilter.frequency.value = 500;
    lapFilter.Q.value = 0.7;
    const lapGain = ctx.createGain();
    lapGain.gain.value = 0.05;
    const lapLfo = ctx.createOscillator();
    lapLfo.frequency.value = 0.23;
    const lapLfoGain = ctx.createGain();
    lapLfoGain.gain.value = 0.03;
    lapLfo.connect(lapLfoGain);
    lapLfoGain.connect(lapGain.gain);
    lap.connect(lapFilter);
    lapFilter.connect(lapGain);
    lapGain.connect(master);
    lap.start();
    lapLfo.start();
    stoppables.push(lap, lapLfo);
  }

  if (lighting === "secours" && flavor !== "centrale") {
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
        if (flavor === "centrale") {
          // Un arc electrique quelque part dans les machines, ou un relais qui claque.
          if (Math.random() < 0.55) {
            noiseBurst(ctx, out(ctx, master, { pan, gain: 0.35 + Math.random() * 0.3 }), 0.18 + Math.random() * 0.2, 0.5, () => (Math.random() < 0.35 ? 1 : 0.05), {
              type: "highpass",
              freq: 2200,
            });
          } else {
            noiseBurst(ctx, out(ctx, master, { pan, gain: 0.5 }), 0.05, 0.6, (t) => Math.pow(1 - t, 6), { type: "lowpass", freq: 1800 });
          }
        } else if (flavor === "piscines") {
          // Une goutte qui tombe du plafond dans un bassin.
          const f = 900 + Math.random() * 900;
          tone(ctx, out(ctx, master, { pan, gain: 0.4 + Math.random() * 0.4 }), "sine", f, f * 1.8, 0.09, 0.14, 0.001);
        } else if (flavor === "bureaux") {
          if (Math.random() < 0.6) {
            // Quelqu'un tape au clavier, deux rangees plus loin. Il n'y a personne.
            const dest = out(ctx, master, { pan, gain: 0.18 + Math.random() * 0.15 });
            const strokes = 4 + Math.floor(Math.random() * 10);
            for (let k = 0; k < strokes; k++) {
              timers.push(
                window.setTimeout(() => {
                  if (!stopped && ctx.state !== "closed") noiseBurst(ctx, dest, 0.03, 0.5, (t) => Math.pow(1 - t, 5), { type: "bandpass", freq: 2600 + Math.random() * 1200, q: 2 });
                }, k * (70 + Math.random() * 90)),
              );
            }
          } else {
            // Une sonnerie de telephone, etouffee, qui s'arrete net.
            const dest = out(ctx, master, { pan, gain: 0.12 });
            tone(ctx, dest, "square", 880, 880, 0.35, 0.05, 0.01);
            tone(ctx, dest, "square", 660, 660, 0.35, 0.04, 0.01);
          }
        } else if (flavor === "hotel") {
          const r = Math.random();
          if (r < 0.35) {
            // L'ascenseur s'arrete a un autre etage. Personne n'en sort.
            const dest = out(ctx, master, { pan, gain: 0.2 + Math.random() * 0.2 });
            tone(ctx, dest, "sine", 1318, 1318, 0.8, 0.08, 0.005);
            tone(ctx, dest, "sine", 1046, 1046, 1, 0.08, 0.005, 0.3);
          } else if (r < 0.65) {
            // Une porte de chambre qui se referme, tout au bout du couloir.
            const dest = out(ctx, master, { pan, gain: 0.35 + Math.random() * 0.2 });
            noiseBurst(ctx, dest, 0.12, 0.5, (t) => Math.pow(1 - t, 4), { type: "lowpass", freq: 420 });
            tone(ctx, dest, "sine", 90, 55, 0.18, 0.14, 0.003);
          } else {
            // Une television allumee derriere une porte : des voix qu'on ne comprend pas.
            const dest = out(ctx, master, { pan, gain: 0.14 });
            const n = 5 + Math.floor(Math.random() * 6);
            for (let k = 0; k < n; k++) {
              noiseBurst(ctx, dest, 0.08 + Math.random() * 0.1, 0.4, (t) => Math.sin(t * Math.PI), { type: "bandpass", freq: 450 + Math.random() * 750, q: 4 }, k * 0.16 + Math.random() * 0.05);
            }
          }
        } else if (flavor === "noir") {
          // Presque rien : une goutte, un craquement tres loin. Le silence fait le reste.
          const r = Math.random();
          if (r < 0.4) {
            const f = 700 + Math.random() * 700;
            tone(ctx, out(ctx, master, { pan, gain: 0.25 + Math.random() * 0.25 }), "sine", f, f * 1.7, 0.08, 0.1, 0.001);
          } else if (r < 0.6) {
            tone(ctx, out(ctx, master, { pan, gain: 0.35 }), "sine", 70, 48, 0.35, 0.18, 0.004);
            noiseBurst(ctx, out(ctx, master, { pan, gain: 0.25 }), 0.2, 0.3, (t) => Math.pow(1 - t, 3), { type: "lowpass", freq: 300 });
          }
        } else if (flavor === "fete") {
          // Au loin, quelqu'un fait la fete. Un ballon eclate, une trompette, un rire.
          const r = Math.random();
          if (r < 0.35) {
            noiseBurst(ctx, out(ctx, master, { pan, gain: 0.25 + Math.random() * 0.2 }), 0.06, 0.6, (t) => Math.pow(1 - t, 6), { type: "highpass", freq: 900 });
          } else if (r < 0.6) {
            partyHorn(ctx, out(ctx, master, { pan, gain: 0.12 + Math.random() * 0.08 }), 0);
          } else {
            laugh(ctx, out(ctx, master, { pan, gain: 0.12 + Math.random() * 0.1 }), 3 + Math.floor(Math.random() * 3), 330 + Math.random() * 60, 0);
          }
        } else if (lighting === "entrepot") {
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

export type Surface = "moquette" | "beton" | "metal" | "carrelage" | "eau";

/**
 * Ambiance propre a certains niveaux, en plus de celle de l'eclairage.
 * "hotel" : ascenseur, portes, television derriere une porte ; "noir" : aucun
 * bourdonnement, presque rien ; "fete" : ballons, trompettes et rires au loin
 * (la musique, elle, se lance a part avec playPartyMusic).
 */
export type AudioFlavor = "centrale" | "bureaux" | "piscines" | "hotel" | "noir" | "fete" | null;

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
  } else if (surface === "eau") {
    // On avance dans l'eau jusqu'aux chevilles : un clapotis, puis la goutte qui retombe.
    noiseBurst(ctx, dest, 0.22, g * 1.1, (t) => Math.sin(t * Math.PI) * (0.5 + Math.random() * 0.5), {
      type: "bandpass",
      freq: 900 + Math.random() * 500,
      q: 0.9,
    });
    const f = 700 + Math.random() * 500;
    tone(ctx, dest, "sine", f, f * 1.6, 0.06, g * 0.25, 0.002);
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
  if (dead(ctx)) return;
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
  if (dead(ctx)) return;
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
  if (dead(ctx)) return;
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

// ---------------------------------------------------------------------------
// Nouveaux monstres : le Voleur de peau, les Chiens, les Fetards
// ---------------------------------------------------------------------------

interface VoiceOptions {
  from: number;
  to: number;
  seconds: number;
  peak: number;
  /** Premier et deuxieme formants : la voyelle (a : 800/1250, i : 330/2300, o : 480/850). */
  f1: number;
  f2: number;
  delay?: number;
  attack?: number;
  /** Vibrato : frequence (Hz) et amplitude (Hz). */
  vibrato?: number;
  depth?: number;
}

/**
 * Une voix synthetique : une scie qui glisse d'une note a l'autre, passee dans
 * deux formants (la voyelle). Sert aux cris, aux rires et aux aboiements.
 */
function voice(ctx: AudioContext, dest: AudioNode, o: VoiceOptions) {
  if (dead(ctx)) return;
  const now = ctx.currentTime + (o.delay ?? 0);
  const end = now + o.seconds;
  const peak = Math.max(0.0002, o.peak);
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(Math.max(1, o.from), now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), end);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, now);
  env.gain.exponentialRampToValueAtTime(peak, now + Math.min(o.attack ?? 0.03, o.seconds * 0.4));
  env.gain.setValueAtTime(peak, now + o.seconds * 0.6);
  env.gain.exponentialRampToValueAtTime(0.0001, end);
  const f1 = ctx.createBiquadFilter();
  f1.type = "bandpass";
  f1.frequency.value = o.f1;
  f1.Q.value = 2.5;
  const f2 = ctx.createBiquadFilter();
  f2.type = "bandpass";
  f2.frequency.value = o.f2;
  f2.Q.value = 3.5;
  const f2Gain = ctx.createGain();
  f2Gain.gain.value = 0.6;
  osc.connect(f1);
  osc.connect(f2);
  f1.connect(env);
  f2.connect(f2Gain);
  f2Gain.connect(env);
  env.connect(dest);
  if (o.vibrato) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = o.vibrato;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = o.depth ?? 6;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start(now);
    lfo.stop(end + 0.05);
  }
  osc.start(now);
  osc.stop(end + 0.05);
}

/** Grognement : une scie grave qui rale (modulee une vingtaine de fois par seconde). */
function growl(ctx: AudioContext, dest: AudioNode, seconds: number, gain: number, delay = 0) {
  if (dead(ctx)) return;
  const now = ctx.currentTime + delay;
  const len = Math.max(0.4, seconds);
  const peak = Math.max(0.0002, gain);
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(80 + Math.random() * 15, now);
  osc.frequency.linearRampToValueAtTime(62 + Math.random() * 8, now + len);
  const rattle = ctx.createOscillator();
  rattle.type = "square";
  rattle.frequency.value = 20 + Math.random() * 9;
  const rattleDepth = ctx.createGain();
  rattleDepth.gain.value = 0.45;
  const vca = ctx.createGain();
  vca.gain.value = 0.55;
  rattle.connect(rattleDepth);
  rattleDepth.connect(vca.gain);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 480;
  lp.Q.value = 4;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, now);
  env.gain.exponentialRampToValueAtTime(peak, now + 0.15);
  env.gain.setValueAtTime(peak, now + len * 0.7);
  env.gain.exponentialRampToValueAtTime(0.0001, now + len);
  osc.connect(vca);
  vca.connect(lp);
  lp.connect(env);
  env.connect(dest);
  osc.start(now);
  rattle.start(now);
  osc.stop(now + len + 0.05);
  rattle.stop(now + len + 0.05);
  // La gorge qui racle, par-dessus.
  noiseBurst(ctx, dest, len, gain * 0.5, (t) => Math.sin(Math.PI * t) * (Math.random() < 0.5 ? 1 : 0.35), { type: "bandpass", freq: 350, q: 2 }, delay);
}

/** Langue de belle-mere : une anche qui bourdonne, se deroule, puis retombe. */
function partyHorn(ctx: AudioContext, dest: AudioNode, delay: number) {
  if (dead(ctx)) return;
  const now = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(430, now);
  osc.frequency.linearRampToValueAtTime(470, now + 0.08);
  osc.frequency.setValueAtTime(470, now + 0.45);
  osc.frequency.linearRampToValueAtTime(380, now + 0.6);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 17;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 9;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1500;
  bp.Q.value = 1.2;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, now);
  env.gain.exponentialRampToValueAtTime(0.22, now + 0.03);
  env.gain.setValueAtTime(0.22, now + 0.5);
  env.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);
  osc.connect(bp);
  bp.connect(env);
  env.connect(dest);
  osc.start(now);
  lfo.start(now);
  osc.stop(now + 0.65);
  lfo.stop(now + 0.65);
}

/** Rire : des « ha » (ou des « hi ») qui montent, trop reguliers pour etre vrais. */
function laugh(ctx: AudioContext, dest: AudioNode, count: number, pitch: number, delay: number, vowel: "a" | "i" = "a") {
  const [f1, f2] = vowel === "a" ? [780, 1250] : [340, 2300];
  for (let i = 0; i < count; i++) {
    const at = delay + i * (vowel === "a" ? 0.16 : 0.12);
    const p = pitch * (1 + i * 0.03);
    voice(ctx, dest, { from: p * 1.08, to: p * 0.9, seconds: vowel === "a" ? 0.12 : 0.09, peak: 0.3, f1, f2, delay: at, attack: 0.012 });
    noiseBurst(ctx, dest, 0.1, 0.18, (t) => Math.sin(Math.PI * t), { type: "bandpass", freq: 1400, q: 1.5 }, at);
  }
}

/**
 * Le Voleur de peau imite une voix humaine, sans jamais tout a fait y arriver :
 * « allo ? », « y'a quelqu'un ? », « aide-moi », en syllabes soufflees, avec
 * dessous une vraie voix, a peine audible et un peu trop grave.
 */
function thiefWhisper(ctx: AudioContext, dest: AudioNode) {
  // [F1, F2, duree, consonne dure avant]
  const phrases: [number, number, number, boolean][][] = [
    [
      [750, 1200, 0.16, false],
      [480, 850, 0.34, false],
    ],
    [
      [300, 2200, 0.1, false],
      [750, 1250, 0.12, false],
      [420, 1900, 0.14, true],
      [460, 1100, 0.3, true],
    ],
    [
      [700, 1700, 0.2, false],
      [300, 2300, 0.08, true],
      [330, 750, 0.1, false],
      [650, 1100, 0.3, false],
    ],
  ];
  const phrase = phrases[Math.floor(Math.random() * phrases.length)];
  let at = 0;
  phrase.forEach(([f1, f2, dur, hard], i) => {
    if (hard) {
      noiseBurst(ctx, dest, 0.03, 0.35, (t) => Math.pow(1 - t, 3), { type: "highpass", freq: 2600 }, at);
      at += 0.03;
    }
    const shape = (t: number) => Math.sin(Math.PI * Math.min(1, t * 1.15));
    noiseBurst(ctx, dest, dur, 0.45, shape, { type: "bandpass", freq: f1, q: 6 }, at);
    noiseBurst(ctx, dest, dur, 0.3, shape, { type: "bandpass", freq: f2, q: 8 }, at);
    // La derniere syllabe monte, comme une question.
    const last = i === phrase.length - 1;
    voice(ctx, dest, { from: 112, to: last ? 150 : 104, seconds: dur, peak: 0.035, f1, f2, delay: at, attack: 0.02 });
    at += dur + 0.03;
  });
}

/** Cri du Voleur de peau : un cri humain qui se dechire en crissement. */
function thiefScream(ctx: AudioContext, dest: AudioNode) {
  voice(ctx, dest, { from: 330, to: 560, seconds: 0.5, peak: 0.3, f1: 850, f2: 1300, vibrato: 6, depth: 10 });
  voice(ctx, dest, { from: 560, to: 1400, seconds: 0.9, peak: 0.22, f1: 1900, f2: 3000, delay: 0.42, vibrato: 21, depth: 70 });
  voice(ctx, dest, { from: 587, to: 1320, seconds: 0.9, peak: 0.16, f1: 1900, f2: 3000, delay: 0.42, vibrato: 17, depth: 50 });
  noiseBurst(ctx, dest, 1, 0.35, (t) => Math.sin(Math.PI * t) * (0.5 + Math.random() * 0.5), { type: "bandpass", freq: 2600, q: 1.4 }, 0.42);
}

/** Les Chiens t'ont entendu : grognement, deux aboiements rauques, puis un hurlement qui se brise. */
function houndCall(ctx: AudioContext, dest: AudioNode) {
  growl(ctx, dest, 1.1, 0.5);
  for (const at of [0.35, 0.62]) {
    voice(ctx, dest, { from: 460, to: 250, seconds: 0.16, peak: 0.35, f1: 900, f2: 1700, delay: at, attack: 0.008 });
    noiseBurst(ctx, dest, 0.14, 0.4, (t) => Math.pow(1 - t, 2), { type: "bandpass", freq: 1100, q: 1 }, at);
  }
  voice(ctx, dest, { from: 300, to: 640, seconds: 0.5, peak: 0.22, f1: 800, f2: 1200, delay: 0.95, vibrato: 9, depth: 18 });
  voice(ctx, dest, { from: 640, to: 240, seconds: 0.9, peak: 0.2, f1: 700, f2: 1100, delay: 1.42, vibrato: 11, depth: 28 });
}

export type MonsterCallVariant = "appel" | "ambiance";

/**
 * Voix d'un monstre.
 * - « appel » (par defaut) : il t'a repere. Le Voleur crie, les Fetards
 *   soufflent dans une trompette de fete et rient, les Chiens grognent,
 *   aboient et hurlent.
 * - « ambiance » : il rode. Le Voleur chuchote en imitant une voix, les Chiens
 *   grognent bas en reniflant, un Fetard glousse ou fait couiner un ballon.
 */
export function playMonsterCall(ctx: AudioContext, master: GainNode, kind: MonsterKind, opts?: Spatial, variant: MonsterCallVariant = "appel") {
  if (dead(ctx)) return;
  const dest = out(ctx, master, opts);
  if (kind === "voleur") {
    if (variant === "appel") thiefScream(ctx, dest);
    else thiefWhisper(ctx, dest);
  } else if (kind === "chiens") {
    if (variant === "appel") {
      houndCall(ctx, dest);
    } else {
      growl(ctx, dest, 0.9 + Math.random() * 0.6, 0.35);
      for (let i = 0; i < 3; i++) {
        noiseBurst(ctx, dest, 0.05, 0.12, (t) => Math.sin(Math.PI * t), { type: "highpass", freq: 1800 }, 1.2 + i * 0.11);
      }
    }
  } else if (variant === "appel") {
    partyHorn(ctx, dest, 0);
    laugh(ctx, dest, 6, 290, 0.55);
  } else if (Math.random() < 0.6) {
    laugh(ctx, dest, 3, 440, 0, "i");
  } else {
    // Un ballon qu'on tord entre les doigts.
    tone(ctx, dest, "sine", 900, 1400, 0.25, 0.08, 0.02);
    tone(ctx, dest, "sine", 1400, 1000, 0.2, 0.06, 0.02, 0.22);
  }
}

/** Un pas de monstre : pieds nus du Voleur, pattes et griffes des Chiens, semelles qui couinent des Fetards. */
export function playMonsterStep(ctx: AudioContext, master: GainNode, kind: MonsterKind, opts?: Spatial) {
  if (dead(ctx)) return;
  const dest = out(ctx, master, opts);
  if (kind === "voleur") {
    // Pieds nus sur la moquette, et parfois un lambeau de peau qui claque.
    noiseBurst(ctx, dest, 0.08, 0.14, (t) => Math.pow(1 - t, 3), { type: "lowpass", freq: 850 });
    if (Math.random() < 0.5) noiseBurst(ctx, dest, 0.05, 0.07, (t) => Math.sin(Math.PI * t), { type: "bandpass", freq: 1500, q: 2 }, 0.05);
  } else if (kind === "chiens") {
    // Quatre pattes : deux appuis rapproches, et les griffes qui cliquettent.
    for (const at of [0, 0.07]) noiseBurst(ctx, dest, 0.06, 0.16, (t) => Math.pow(1 - t, 3), { type: "lowpass", freq: 700 }, at);
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const f = 2600 + Math.random() * 1200;
      tone(ctx, dest, "square", f, f * 0.8, 0.012, 0.035, 0.001, 0.01 + i * 0.03 + Math.random() * 0.02);
    }
  } else {
    // Des semelles de caoutchouc qui couinent, comme un jouet.
    noiseBurst(ctx, dest, 0.07, 0.12, (t) => Math.pow(1 - t, 3), { type: "lowpass", freq: 600 });
    const f = 1000 + Math.random() * 300;
    tone(ctx, dest, "sine", f, f * 1.35, 0.07, 0.035, 0.005, 0.02);
  }
}

// --- Musique de fete ---------------------------------------------------------

const PARTY_RATE = 22050;
/** Boucle de musique, calculee une seule fois (echantillons bruts, 22 kHz, 4 mesures). */
let partyLoop: Float32Array | null = null;

function renderPartyLoop(): Float32Array {
  const rate = PARTY_RATE;
  const beat = 60 / 124;
  const bars = 4;
  const total = Math.floor(bars * 4 * beat * rate);
  const d = new Float32Array(total);
  // Les notes qui depassent la fin reviennent au debut : la boucle ne claque pas.
  const add = (start: number, seconds: number, fn: (t: number) => number) => {
    const i0 = Math.floor(start * rate);
    const n = Math.floor(seconds * rate);
    for (let i = 0; i < n; i++) d[(i0 + i) % total] += fn(i / rate);
  };
  const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
  const TAU = Math.PI * 2;
  // Do, sol, la mineur, fa : la suite d'accords de toutes les fetes.
  const chords = [
    [60, 64, 67],
    [59, 62, 67],
    [57, 60, 64],
    [57, 60, 65],
  ];
  const roots = [36, 43, 45, 41];
  // Une ritournelle de boite a musique, en arpeges (-1 : silence).
  const tune = [
    [76, 79, 84, 79, 76, 79, 72, -1],
    [74, 79, 83, 79, 74, 71, 74, -1],
    [72, 76, 81, 76, 72, 76, 69, -1],
    [72, 77, 81, 77, 74, 72, 71, 74],
  ];
  for (let bar = 0; bar < bars; bar++) {
    const root = hz(roots[bar]);
    for (let b = 0; b < 4; b++) {
      const t0 = (bar * 4 + b) * beat;
      // Grosse caisse sur chaque temps : c'est elle qui traverse les murs.
      add(t0, 0.3, (t) => Math.sin(TAU * (45 * t + (90 / 22) * (1 - Math.exp(-22 * t)))) * Math.exp(-t * 11) * 0.9);
      // Basse « poum-pa » : la fondamentale, puis l'octave.
      add(t0, beat * 0.45, (t) => (Math.sin(TAU * root * t) > 0 ? 1 : -1) * 0.16 * Math.exp(-t * 6));
      add(t0 + beat / 2, beat * 0.4, (t) => (Math.sin(TAU * root * 2 * t) > 0 ? 1 : -1) * 0.1 * Math.exp(-t * 7));
      // Accord plaque a contretemps.
      for (const m of chords[bar]) {
        const f = hz(m);
        add(t0 + beat / 2, 0.2, (t) => (2 * ((f * t) % 1) - 1) * 0.05 * Math.exp(-t * 10));
      }
      // Claquement de mains sur 2 et 4.
      if (b % 2 === 1) add(t0, 0.15, (t) => (Math.random() * 2 - 1) * 0.3 * Math.exp(-t * 28));
      // La ritournelle, en croches.
      for (let e = 0; e < 2; e++) {
        const m = tune[bar][b * 2 + e];
        if (m < 0) continue;
        const f = hz(m);
        add(t0 + (e * beat) / 2, 0.35, (t) => (Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * f * 2 * t)) * 0.11 * Math.exp(-t * 7));
      }
    }
  }
  let peak = 0;
  for (let i = 0; i < total; i++) peak = Math.max(peak, Math.abs(d[i]));
  if (peak > 0) for (let i = 0; i < total; i++) d[i] *= 0.85 / peak;
  return d;
}

export interface PartyMusic {
  /** Volume (0 a 1 environ) et panoramique (-1 a 1), avec un fondu. */
  setLevel: (gain: number, pan?: number) => void;
  stop: () => void;
}

/**
 * Musique de fete en boucle, comme entendue a travers les murs : seuls les
 * graves passent (la grosse caisse, la basse), et la bande magnetique ondule
 * juste assez pour mettre mal a l'aise. Volume de depart : `opts.gain`
 * (0,35 par defaut). A arreter en quittant le niveau (fermer le contexte
 * audio l'arrete aussi).
 */
export function playPartyMusic(ctx: AudioContext, master: GainNode, opts?: Spatial): PartyMusic {
  const silent: PartyMusic = { setLevel: () => {}, stop: () => {} };
  if (dead(ctx)) return silent;
  try {
    if (!partyLoop) partyLoop = renderPartyLoop();
    const buffer = ctx.createBuffer(1, partyLoop.length, PARTY_RATE);
    buffer.getChannelData(0).set(partyLoop);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const wow = ctx.createOscillator();
    wow.frequency.value = 0.21;
    const wowDepth = ctx.createGain();
    wowDepth.gain.value = 0.012;
    wow.connect(wowDepth);
    wowDepth.connect(src.playbackRate);
    const wall = ctx.createBiquadFilter();
    wall.type = "lowpass";
    wall.frequency.value = 700;
    wall.Q.value = 0.9;
    const level = ctx.createGain();
    level.gain.value = Math.max(0, opts?.gain ?? 0.35);
    const panner = typeof ctx.createStereoPanner === "function" ? ctx.createStereoPanner() : null;
    src.connect(wall);
    wall.connect(level);
    if (panner) {
      panner.pan.value = Math.max(-1, Math.min(1, opts?.pan ?? 0));
      level.connect(panner);
      panner.connect(master);
    } else {
      level.connect(master);
    }
    src.start();
    wow.start();
    let stopped = false;
    return {
      setLevel: (gain, pan) => {
        if (stopped || dead(ctx)) return;
        level.gain.setTargetAtTime(Math.max(0, gain), ctx.currentTime, 0.4);
        if (panner && pan !== undefined) panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), ctx.currentTime, 0.4);
      },
      stop: () => {
        if (stopped) return;
        stopped = true;
        try {
          src.stop();
          wow.stop();
          level.disconnect();
        } catch {
          // deja arrete, ou contexte ferme
        }
      },
    };
  } catch {
    return silent;
  }
}
