import type { BlockSound } from "./voxel";

export type VoxelSound =
  | BlockSound
  | "hurt" | "hit" | "manger" | "boire" | "explosion" | "arc" | "fleche" | "craft" | "ramasser" | "casse" | "equiper"
  | "zombie" | "squelette" | "araignee" | "meche" | "touche" | "mort";

/**
 * Sons originaux, synthetises (aucun fichier), crees seulement apres une
 * interaction du joueur. Chaque son est un petit assemblage d'oscillateurs et
 * de bruit filtre : court, discret, sans fatigue a la longue.
 */
export class VoxelAudio {
  private context: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private master: GainNode | null = null;

  private ctx(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.context.destination);
      const len = this.context.sampleRate;
      this.noise = this.context.createBuffer(1, len, this.context.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    void this.context.resume();
    return this.context;
  }

  private tone(type: OscillatorType, from: number, to: number, duration: number, volume: number, delay = 0) {
    const ctx = this.ctx();
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + duration);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g);
    g.connect(this.master!);
    o.start(t);
    o.stop(t + duration + 0.02);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  }

  private hiss(freq: number, q: number, duration: number, volume: number, delay = 0, type: BiquadFilterType = "bandpass") {
    const ctx = this.ctx();
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(f);
    f.connect(g);
    g.connect(this.master!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + duration + 0.02);
    src.onended = () => { src.disconnect(); f.disconnect(); g.disconnect(); };
  }

  play(kind: VoxelSound) {
    try {
      switch (kind) {
        case "pierre": this.hiss(900, 1.2, 0.12, 0.35); this.tone("triangle", 180, 60, 0.09, 0.05); break;
        case "terre": this.hiss(420, 0.9, 0.13, 0.3); break;
        case "sable": this.hiss(2400, 0.6, 0.16, 0.18); break;
        case "bois": this.tone("triangle", 240, 110, 0.11, 0.09); this.hiss(700, 3, 0.08, 0.15); break;
        case "verre": this.tone("sine", 1500, 900, 0.18, 0.05); this.hiss(4200, 2, 0.12, 0.12); break;
        case "tissu": this.hiss(600, 0.5, 0.12, 0.14, 0, "lowpass"); break;
        case "feuille": this.hiss(3000, 0.8, 0.1, 0.12); break;
        case "eau": this.tone("sine", 500, 900, 0.12, 0.05); this.hiss(1200, 4, 0.15, 0.1); break;
        case "hurt": this.tone("square", 180, 90, 0.16, 0.05); this.hiss(500, 1, 0.12, 0.2); break;
        case "hit": this.hiss(1100, 1.5, 0.08, 0.3); this.tone("triangle", 160, 70, 0.08, 0.06); break;
        case "manger": for (let i = 0; i < 3; i++) this.hiss(1600, 1.2, 0.07, 0.2, i * 0.13); break;
        case "boire": for (let i = 0; i < 3; i++) this.tone("sine", 380 + i * 60, 260, 0.1, 0.07, i * 0.14); break;
        case "explosion": this.hiss(180, 0.6, 1.1, 1, 0, "lowpass"); this.tone("sine", 90, 30, 0.8, 0.3); break;
        case "arc": this.tone("triangle", 520, 180, 0.12, 0.06); this.hiss(2500, 2, 0.1, 0.1); break;
        case "fleche": this.hiss(3200, 3, 0.07, 0.12); break;
        case "craft": this.tone("triangle", 660, 660, 0.06, 0.05); this.tone("triangle", 990, 990, 0.09, 0.05, 0.06); break;
        case "ramasser": this.tone("sine", 900, 1400, 0.07, 0.04); break;
        case "casse": this.hiss(2800, 1, 0.2, 0.25); this.tone("square", 700, 200, 0.18, 0.03); break;
        case "equiper": this.hiss(1500, 2, 0.12, 0.15); this.tone("triangle", 300, 420, 0.1, 0.04); break;
        case "zombie": this.tone("sawtooth", 95, 70, 0.6, 0.04); this.tone("sawtooth", 120, 85, 0.5, 0.02, 0.05); break;
        case "squelette": for (let i = 0; i < 3; i++) this.hiss(2200, 6, 0.05, 0.18, i * 0.07); break;
        case "araignee": this.hiss(1800, 8, 0.25, 0.08); this.tone("square", 70, 60, 0.2, 0.02); break;
        case "meche": this.hiss(5000, 1, 1.4, 0.12, 0, "highpass"); break;
        case "touche": this.tone("square", 260, 150, 0.1, 0.04); this.hiss(900, 2, 0.08, 0.15); break;
        case "mort": this.tone("sawtooth", 200, 50, 0.45, 0.05); break;
      }
    } catch { /* Audio indisponible : le jeu reste jouable. */ }
  }

  dispose() { void this.context?.close(); }
}
