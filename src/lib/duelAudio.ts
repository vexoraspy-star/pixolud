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

/** `delay` : decalage en secondes, programme par l'horloge audio (pas de setTimeout). */
function noise(
  ctx: AudioContext,
  dest: AudioNode,
  seconds: number,
  gain: number,
  shape: (t: number) => number,
  filter?: { type: BiquadFilterType; freq: number; q?: number },
  delay = 0,
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
  attack = 0.005,
  delay = 0,
) {
  const now = ctx.currentTime + delay;
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

/** Roquette : un souffle grave et un long grondement. */
export function playExplosion(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  noise(ctx, dest, 1.1, 1.1, (t) => Math.pow(1 - t, 1.7), { type: "lowpass", freq: 380 });
  noise(ctx, dest, 0.3, 0.7, (t) => Math.pow(1 - t, 2.4), { type: "highpass", freq: 900 });
  tone(ctx, dest, "sine", 95, 30, 0.8, 0.8);
}

/** Grenade qu'on degoupille : le petit anneau metallique, puis la cuillere. */
export function playGrenadePin(ctx: AudioContext, master: GainNode) {
  tone(ctx, master, "triangle", 2600, 2300, 0.05, 0.1, 0.002);
  noise(ctx, master, 0.04, 0.2, (t) => Math.pow(1 - t, 3), { type: "highpass", freq: 3000 }, 0.03);
}

/** Le lancer : un souffle de bras. */
export function playGrenadeThrow(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  noise(ctx, dest, 0.22, 0.3, (t) => Math.sin(t * Math.PI) * (1 - t * 0.5), { type: "bandpass", freq: 700, q: 0.9 });
}

/** Rebond : le metal qui claque sur le beton, plus fort si le choc est violent. */
export function playGrenadeBounce(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  tone(ctx, dest, "triangle", 1850, 1500, 0.05, 0.12, 0.002);
  tone(ctx, dest, "square", 620, 380, 0.04, 0.05, 0.002);
  noise(ctx, dest, 0.05, 0.22, (t) => Math.pow(1 - t, 3), { type: "bandpass", freq: 1400, q: 1.5 });
}

/**
 * Grenade : plus seche et plus lourde que la roquette. Le claquement, le
 * souffle grave, puis la pluie d'eclats et de gravats qui retombe.
 */
export function playGrenadeBlast(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  noise(ctx, dest, 0.12, 1.1, (t) => Math.pow(1 - t, 1.2), { type: "highpass", freq: 1200 });
  noise(ctx, dest, 1.4, 1.2, (t) => Math.pow(1 - t, 1.9), { type: "lowpass", freq: 320 });
  tone(ctx, dest, "sine", 80, 26, 1, 0.95);
  noise(ctx, dest, 0.8, 0.22, (t) => Math.pow(1 - t, 2) * (0.6 + 0.4 * Math.sin(t * 90)), { type: "bandpass", freq: 2400, q: 1.2 }, 0.18);
}

/** Fumigene : un « pop », puis un long sifflement qui s'essouffle. */
export function playSmokePop(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  tone(ctx, dest, "sine", 240, 110, 0.12, 0.35);
  noise(ctx, dest, 2.6, 0.28, (t) => Math.min(1, t * 20) * Math.pow(1 - t, 1.3), { type: "highpass", freq: 2200 });
}

/**
 * Annonce de serie (« Double ! », « En feu »...) : un petit arpege montant,
 * d'autant plus long que l'exploit est grand (niveau 1 a 4).
 */
export function playStreak(ctx: AudioContext, master: GainNode, level: number) {
  const notes = [659, 784, 988, 1175, 1319];
  const count = Math.max(2, Math.min(notes.length, level + 1));
  for (let i = 0; i < count; i++) {
    tone(ctx, master, "triangle", notes[i], notes[i], 0.16, 0.2, 0.005, i * 0.075);
  }
  // Les grands exploits finissent sur un accord.
  if (level >= 3) {
    const at = count * 0.075;
    tone(ctx, master, "square", notes[count - 1], notes[count - 1], 0.4, 0.08, 0.01, at);
    tone(ctx, master, "triangle", notes[count - 3], notes[count - 3], 0.4, 0.14, 0.01, at);
  }
}

/** Arbalete : claquement de corde, sans detonation. */
export function playCrossbow(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  tone(ctx, dest, "triangle", 240, 80, 0.14, 0.4);
  noise(ctx, dest, 0.09, 0.35, (t) => Math.pow(1 - t, 2), { type: "bandpass", freq: 1800, q: 2 });
}

/** Construction : un panneau qui se pose d'un coup. */
export function playBuild(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  tone(ctx, dest, "square", 190, 110, 0.09, 0.22);
  noise(ctx, dest, 0.14, 0.4, (t) => Math.pow(1 - t, 2.5), { type: "lowpass", freq: 1300 });
}

/** Panneau detruit : craquement de bois. */
export function playBreak(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  noise(ctx, dest, 0.4, 0.7, (t) => Math.pow(1 - t, 1.8), { type: "bandpass", freq: 700, q: 0.8 });
  tone(ctx, dest, "sawtooth", 150, 55, 0.25, 0.25);
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

/**
 * Les bruits mecaniques de l'arme tenue. Le rechargement n'est plus un son
 * unique cale sur des delais fixes : la scene joue chaque geste au moment ou
 * l'animation le montre, que le rechargement dure 1,2 s ou 4,2 s.
 */
export type WeaponFoley =
  | "magOut"
  | "magIn"
  | "rack"
  | "shellIn"
  | "pumpBack"
  | "pumpFwd"
  | "boltOpen"
  | "boltClose"
  | "breakOpen"
  | "breakClose"
  | "drumOpen"
  | "drumClose"
  | "arrowLoad"
  | "rocketLoad";

const bruit = (k: number) => (t: number) => Math.pow(1 - t, k);

export function playWeaponFoley(ctx: AudioContext, master: GainNode, sound: WeaponFoley) {
  switch (sound) {
    case "magOut":
      // Le bouton d'arretoir, puis le chargeur qui glisse hors du puits.
      noise(ctx, master, 0.02, 0.22, bruit(3), { type: "highpass", freq: 3200 });
      noise(ctx, master, 0.09, 0.3, bruit(2), { type: "bandpass", freq: 1700, q: 2 }, 0.015);
      break;
    case "magIn":
      noise(ctx, master, 0.1, 0.34, bruit(2), { type: "bandpass", freq: 1200, q: 2 });
      tone(ctx, master, "square", 260, 140, 0.05, 0.16, 0.003, 0.02);
      break;
    case "rack":
      // On tire la culasse, puis elle claque en avant.
      noise(ctx, master, 0.06, 0.18, bruit(2), { type: "bandpass", freq: 2400, q: 1.5 });
      tone(ctx, master, "square", 900, 500, 0.08, 0.24, 0.005, 0.07);
      noise(ctx, master, 0.12, 0.36, bruit(2.4), { type: "highpass", freq: 1500 }, 0.07);
      break;
    case "shellIn":
      noise(ctx, master, 0.05, 0.28, bruit(2.5), { type: "bandpass", freq: 2000, q: 3 });
      tone(ctx, master, "triangle", 520, 380, 0.04, 0.12);
      break;
    case "pumpBack":
      noise(ctx, master, 0.08, 0.42, bruit(2), { type: "bandpass", freq: 900, q: 1.2 });
      tone(ctx, master, "square", 240, 160, 0.05, 0.16);
      break;
    case "pumpFwd":
      noise(ctx, master, 0.07, 0.44, bruit(2), { type: "bandpass", freq: 1300, q: 1.2 });
      tone(ctx, master, "square", 330, 200, 0.05, 0.2);
      break;
    case "boltOpen":
      // Le levier se leve (clic), puis la culasse glisse en arriere.
      tone(ctx, master, "square", 700, 520, 0.03, 0.14);
      noise(ctx, master, 0.12, 0.26, bruit(1.6), { type: "bandpass", freq: 1600, q: 1.4 }, 0.04);
      break;
    case "boltClose":
      noise(ctx, master, 0.1, 0.26, bruit(1.6), { type: "bandpass", freq: 1400, q: 1.4 });
      tone(ctx, master, "square", 820, 460, 0.05, 0.22, 0.004, 0.08);
      break;
    case "breakOpen":
      tone(ctx, master, "square", 500, 260, 0.07, 0.22);
      noise(ctx, master, 0.12, 0.35, bruit(2), { type: "bandpass", freq: 800, q: 1 });
      break;
    case "breakClose":
      tone(ctx, master, "square", 380, 200, 0.08, 0.28);
      noise(ctx, master, 0.1, 0.4, bruit(2.2), { type: "lowpass", freq: 1200 });
      break;
    case "drumOpen":
      tone(ctx, master, "triangle", 1400, 1100, 0.03, 0.14);
      noise(ctx, master, 0.05, 0.2, bruit(2), { type: "bandpass", freq: 2600, q: 2 });
      break;
    case "drumClose":
      noise(ctx, master, 0.06, 0.25, bruit(2), { type: "bandpass", freq: 1800, q: 2 });
      // Le cliquet du barillet qui tourne librement.
      for (const d of [0.05, 0.09, 0.13]) tone(ctx, master, "square", 2400, 2200, 0.015, 0.07, 0.002, d);
      break;
    case "arrowLoad":
      // La corde qu'on arme (grincement), puis le carreau qui se cale.
      noise(ctx, master, 0.24, 0.2, (t) => t * (1 - t) * 4, { type: "bandpass", freq: 520, q: 4 });
      tone(ctx, master, "square", 1200, 900, 0.03, 0.18, 0.003, 0.24);
      break;
    case "rocketLoad":
      noise(ctx, master, 0.2, 0.4, bruit(1.4), { type: "lowpass", freq: 600 });
      tone(ctx, master, "sine", 140, 70, 0.12, 0.4, 0.005, 0.18);
      break;
  }
}

/** Une douille qui touche le sol : tintement de laiton, ou « toc » d'une cartouche de chasse. */
export function playCasingTink(ctx: AudioContext, master: GainNode, kind: "laiton" | "long" | "coque") {
  if (kind === "coque") {
    noise(ctx, master, 0.04, 0.12, bruit(3), { type: "lowpass", freq: 900 });
    tone(ctx, master, "sine", 700, 480, 0.035, 0.06);
    return;
  }
  const f = kind === "long" ? 2700 : 3200;
  tone(ctx, master, "triangle", f, f * 0.81, 0.04, 0.08, 0.002);
  tone(ctx, master, "triangle", f * 0.9, f * 0.75, 0.03, 0.04, 0.002, 0.07);
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

// ---------------------------------------------------------------- couteaux
// Tout est synthetise, comme le reste : un souffle filtre dont la frequence
// glisse fait le sifflement d'une lame, un choc grave et mouille fait la
// chair, deux notes metalliques tres courtes font l'acier sur la pierre.

/**
 * Souffle dont le filtre balaie f0 -> f1 -> f2 : le son d'un objet fin qui
 * fend l'air. L'enveloppe monte puis retombe (la lame passe pres de l'oreille).
 */
function whoosh(
  ctx: AudioContext,
  dest: AudioNode,
  seconds: number,
  gain: number,
  f0: number,
  f1: number,
  f2: number,
  q = 1.4,
  delay = 0,
) {
  const size = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) {
    const t = i / size;
    data[i] = (Math.random() * 2 - 1) * Math.pow(Math.sin(Math.PI * t), 1.6) * (1 - t * 0.35);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = q;
  const now = ctx.currentTime + delay;
  f.frequency.setValueAtTime(f0, now);
  f.frequency.linearRampToValueAtTime(f1, now + seconds * 0.45);
  f.frequency.exponentialRampToValueAtTime(Math.max(40, f2), now + seconds);
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(f);
  f.connect(g);
  g.connect(dest);
  src.start(now);
}

/** La lame fend l'air : bref et aigu pour le coup rapide, plus ample pour le coup lourd. */
export function playKnifeSwing(ctx: AudioContext, master: GainNode, heavy = false, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  if (heavy) {
    whoosh(ctx, dest, 0.3, 0.5, 500, 1900, 700, 1.1);
    whoosh(ctx, dest, 0.22, 0.18, 2600, 5200, 2400, 3, 0.04);
  } else {
    whoosh(ctx, dest, 0.17, 0.42, 900, 3200, 1300, 1.5);
    whoosh(ctx, dest, 0.12, 0.14, 3800, 6400, 3000, 3.5, 0.02);
  }
}

/** La lame entre dans la chair : un choc sourd, un bruit mouille, et c'est tout. */
export function playKnifeFlesh(ctx: AudioContext, master: GainNode, heavy = false, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  const k = heavy ? 1.35 : 1;
  tone(ctx, dest, "sine", 150 * (heavy ? 0.85 : 1), 55, 0.13 * k, 0.42 * k, 0.003);
  noise(ctx, dest, 0.08 * k, 0.5 * k, (t) => Math.pow(1 - t, 2.4), { type: "lowpass", freq: 950 });
  // Le « schlac » : une bande etroite qui s'eteint vite.
  noise(ctx, dest, 0.07 * k, 0.34 * k, (t) => Math.pow(1 - t, 3) * (0.6 + 0.4 * Math.sin(t * 60)), { type: "bandpass", freq: 420, q: 3 }, 0.012);
  noise(ctx, dest, 0.05, 0.12, (t) => Math.pow(1 - t, 3), { type: "highpass", freq: 2600 }, 0.004);
}

/** La lame ripe sur un mur : deux notes d'acier tres breves et un grattement. */
export function playKnifeWall(ctx: AudioContext, master: GainNode, opts?: Spatial) {
  const dest = out(ctx, master, opts);
  noise(ctx, dest, 0.045, 0.4, (t) => Math.pow(1 - t, 3), { type: "highpass", freq: 3400 });
  tone(ctx, dest, "triangle", 3150, 2700, 0.2, 0.13, 0.001);
  tone(ctx, dest, "triangle", 4750, 4300, 0.13, 0.07, 0.001, 0.004);
  noise(ctx, dest, 0.14, 0.16, (t) => (1 - t) * (0.5 + 0.5 * Math.sin(t * 90)), { type: "bandpass", freq: 1900, q: 2 }, 0.015);
}

/** Les gestes du couteau tenu en main (voir duelKnives). */
export type KnifeFoley = "sortie" | "clac" | "tour" | "frottement";

export function playKnifeFoley(ctx: AudioContext, master: GainNode, sound: KnifeFoley) {
  switch (sound) {
    case "sortie":
      // La lame glisse hors de l'etui, puis l'acier chante un instant.
      whoosh(ctx, master, 0.22, 0.14, 2200, 5200, 3600, 2.5);
      tone(ctx, master, "triangle", 3350, 3180, 0.42, 0.045, 0.004, 0.16);
      tone(ctx, master, "sine", 5100, 4950, 0.3, 0.02, 0.004, 0.17);
      break;
    case "clac":
      // Loquet du papillon : deux pieces de metal qui se referment.
      tone(ctx, master, "square", 1900, 1400, 0.03, 0.11, 0.001);
      noise(ctx, master, 0.03, 0.22, (t) => Math.pow(1 - t, 3), { type: "highpass", freq: 3000 });
      tone(ctx, master, "triangle", 2900, 2700, 0.07, 0.04, 0.001, 0.012);
      break;
    case "tour":
      whoosh(ctx, master, 0.13, 0.1, 900, 2400, 1000, 1.8);
      break;
    case "frottement":
      // Le pouce glisse sur le plat de la lame.
      noise(ctx, master, 0.32, 0.07, (t) => Math.sin(Math.PI * t), { type: "bandpass", freq: 2600, q: 4 });
      break;
  }
}
