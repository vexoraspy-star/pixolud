/**
 * Les sons de Colosses, fabriques a la volee.
 *
 * Aucun fichier audio : tout est synthetise par le navigateur, comme dans le
 * Manoir et le Duel. Un jeu de combat a besoin de trois choses — que le coup
 * qui touche claque, que le coup bloque sonne sourd, et que le KO s'entende
 * de loin. Le reste est du decor.
 */

export interface ColossesAudio {
  ctx: AudioContext | null;
  master: GainNode | null;
}

export function creerAudio(volume: number): ColossesAudio {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return { ctx: null, master: null };
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    return { ctx, master };
  } catch {
    return { ctx: null, master: null };
  }
}

/** Un bruit court filtre : la base de tous les impacts. */
function impact(a: ColossesAudio, duree: number, frequence: number, gain: number, type: BiquadFilterType = "bandpass") {
  const { ctx, master } = a;
  if (!ctx || !master) return;
  const n = Math.floor(ctx.sampleRate * duree);
  const buffer = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filtre = ctx.createBiquadFilter();
  filtre.type = type;
  filtre.frequency.value = frequence;
  filtre.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.value = gain;
  source.connect(filtre);
  filtre.connect(g);
  g.connect(master);
  source.start();
}

/** Une note courte : sert aux voix d'annonce et aux coups speciaux. */
function note(a: ColossesAudio, depart: number, arrivee: number, duree: number, gain: number, type: OscillatorType = "sawtooth") {
  const { ctx, master } = a;
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(depart, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, arrivee), t + duree);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + duree + 0.03);
}

/** Le poing : sec et court. */
export function sonPoing(a: ColossesAudio) {
  impact(a, 0.09, 1800, 0.5);
}

/** Le pied : plus grave, plus long. */
export function sonPied(a: ColossesAudio) {
  impact(a, 0.16, 900, 0.65);
  note(a, 180, 70, 0.14, 0.18, "square");
}

/** Le coup bloque : un choc mat, sans claquement. */
export function sonBloc(a: ColossesAudio) {
  impact(a, 0.12, 300, 0.4, "lowpass");
}

/** Le coup special : on doit l'entendre de l'autre bout de la piece. */
export function sonSpecial(a: ColossesAudio) {
  note(a, 620, 140, 0.45, 0.32);
  note(a, 930, 210, 0.45, 0.2, "triangle");
  impact(a, 0.3, 500, 0.5);
}

/** Le saut : un souffle discret. */
export function sonSaut(a: ColossesAudio) {
  note(a, 320, 620, 0.12, 0.09, "sine");
}

/** L'atterrissage. */
export function sonSol(a: ColossesAudio) {
  impact(a, 0.1, 220, 0.3, "lowpass");
}

/** Le KO : trois notes descendantes, et le silence. */
export function sonKo(a: ColossesAudio) {
  note(a, 440, 400, 0.18, 0.3, "square");
  setTimeout(() => note(a, 330, 300, 0.2, 0.3, "square"), 170);
  setTimeout(() => note(a, 220, 90, 0.7, 0.34, "sawtooth"), 360);
}

/** Le gong de debut de round. */
export function sonGong(a: ColossesAudio) {
  note(a, 180, 60, 1.1, 0.3, "triangle");
  impact(a, 0.5, 400, 0.35, "lowpass");
}
