export type NoteName =
  | "C4" | "D4" | "E4" | "F4" | "G4" | "A4" | "B4"
  | "C5" | "D5" | "E5" | "F5" | "G5" | "A5" | "B5"
  | "C6"
  | "-"; // silence

export const NOTE_FREQS: Record<NoteName, number> = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77,
  C6: 1046.5,
  "-": 0,
};

export interface RadioStep {
  note: NoteName;
  beats: number;
}

export interface RadioTrack {
  id: string;
  title: string;
  genre: string;
  emoji: string;
  bpm: number;
  waveform: OscillatorType;
  steps: RadioStep[];
}

export const RADIO_TRACKS: RadioTrack[] = [
  {
    id: "pixel-dreams",
    title: "Pixel Dreams",
    genre: "Chiptune original",
    emoji: "🌙",
    bpm: 100,
    waveform: "square",
    steps: [
      { note: "C5", beats: 1 }, { note: "E5", beats: 1 }, { note: "G5", beats: 1 }, { note: "E5", beats: 1 },
      { note: "F5", beats: 1 }, { note: "A5", beats: 1 }, { note: "G5", beats: 2 },
      { note: "E5", beats: 1 }, { note: "D5", beats: 1 }, { note: "C5", beats: 2 },
      { note: "-", beats: 1 }, { note: "G4", beats: 1 }, { note: "C5", beats: 2 },
    ],
  },
  {
    id: "arcade-nights",
    title: "Arcade Nights",
    genre: "Chiptune original",
    emoji: "🕹️",
    bpm: 140,
    waveform: "square",
    steps: [
      { note: "C5", beats: 0.5 }, { note: "C5", beats: 0.5 }, { note: "D5", beats: 0.5 }, { note: "E5", beats: 0.5 },
      { note: "C5", beats: 0.5 }, { note: "C5", beats: 0.5 }, { note: "D5", beats: 0.5 }, { note: "E5", beats: 0.5 },
      { note: "F5", beats: 0.5 }, { note: "E5", beats: 0.5 }, { note: "D5", beats: 0.5 }, { note: "C5", beats: 0.5 },
      { note: "A4", beats: 1 }, { note: "-", beats: 1 },
    ],
  },
  {
    id: "retro-sunset",
    title: "Retro Sunset",
    genre: "Chiptune original",
    emoji: "🌅",
    bpm: 80,
    waveform: "triangle",
    steps: [
      { note: "E4", beats: 2 }, { note: "G4", beats: 2 }, { note: "A4", beats: 2 }, { note: "C5", beats: 2 },
      { note: "B4", beats: 2 }, { note: "G4", beats: 2 }, { note: "E4", beats: 4 },
    ],
  },
];
