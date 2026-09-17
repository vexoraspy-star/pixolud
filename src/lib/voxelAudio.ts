import type { BlockSound } from "./voxel";

// Sons originaux, crees uniquement apres une interaction du joueur.
export class VoxelAudio {
  private context: AudioContext | null = null;
  play(kind: BlockSound | "hurt" | "hit") {
    try {
      this.context ??= new AudioContext();
      const ctx = this.context;
      void ctx.resume();
      const oscillator = ctx.createOscillator(), gain = ctx.createGain();
      const frequency = kind === "verre" ? 850 : kind === "bois" ? 220 : kind === "hurt" ? 85 : 140;
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + .12);
      gain.gain.setValueAtTime(.07, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .14);
      oscillator.connect(gain); gain.connect(ctx.destination);
      oscillator.start(); oscillator.stop(ctx.currentTime + .15);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    } catch { /* Audio indisponible : le jeu reste jouable. */ }
  }
  dispose() { void this.context?.close(); }
}
