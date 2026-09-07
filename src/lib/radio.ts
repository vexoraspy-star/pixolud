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

export interface SynthTrack {
  kind: "synth";
  id: string;
  title: string;
  genre: string;
  emoji: string;
  bpm: number;
  waveform: OscillatorType;
  steps: RadioStep[];
}

export interface AudioTrack {
  kind: "audio";
  id: string;
  title: string;
  composer: string;
  genre: string;
  emoji: string;
  src: string;
  license: string;
  attribution?: string;
  sourceUrl: string;
}

export type RadioTrack = SynthTrack | AudioTrack;

// Plus de pistes chiptune pour l'instant : la radio ne propose que de vrais
// morceaux verifies (domaine public / Creative Commons). Le moteur de
// synthese reste disponible si on veut en rajouter plus tard.
const SYNTH_TRACKS: SynthTrack[] = [];

// Verifie manuellement : chaque fichier est bien du domaine public / Creative
// Commons sur sa page Wikimedia Commons (voir sourceUrl) avant tout ajout.
const AUDIO_TRACKS: AudioTrack[] = [
  {
    kind: "audio",
    id: "fur-elise",
    title: "Für Elise",
    composer: "Ludwig van Beethoven",
    genre: "Classique · domaine public",
    emoji: "🎹",
    src: "https://upload.wikimedia.org/wikipedia/commons/7/7b/FurElise.ogg",
    license: "Domaine public (CC0)",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:FurElise.ogg",
  },
  {
    kind: "audio",
    id: "clair-de-lune",
    title: "Clair de Lune",
    composer: "Claude Debussy",
    genre: "Classique · Creative Commons",
    emoji: "🌌",
    src: "https://upload.wikimedia.org/wikipedia/commons/b/be/Clair_de_lune_%28Claude_Debussy%29_Suite_bergamasque.ogg",
    license: "CC BY 3.0",
    attribution: "Interprété par Laurens Goedhart",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Clair_de_lune_(Claude_Debussy)_Suite_bergamasque.ogg",
  },
  {
    kind: "audio",
    id: "moonlight-sonata",
    title: "Sonate au clair de lune",
    composer: "Ludwig van Beethoven",
    genre: "Classique · domaine public",
    emoji: "🌒",
    src: "https://upload.wikimedia.org/wikipedia/commons/d/d0/Moonlight_Sonata.ogg",
    license: "Domaine public (CC0)",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Moonlight_Sonata.ogg",
  },
  {
    kind: "audio",
    id: "vivaldi-spring",
    title: "Le Printemps",
    composer: "Antonio Vivaldi",
    genre: "Classique · Creative Commons",
    emoji: "🌸",
    src: "https://upload.wikimedia.org/wikipedia/commons/f/ff/Vivaldi_-_Four_Seasons_1_Spring_mvt_1_Allegro_-_John_Harrison_violin.oga",
    license: "CC BY-SA 4.0",
    attribution: "John Harrison (violon), Wichita State University Chamber Players",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:01_-_Vivaldi_Spring_mvt_1_Allegro_-_John_Harrison_violin.ogg",
  },
  {
    kind: "audio",
    id: "canon-pachelbel",
    title: "Canon en Ré",
    composer: "Johann Pachelbel",
    genre: "Classique · Creative Commons",
    emoji: "🕊️",
    src: "https://upload.wikimedia.org/wikipedia/commons/5/59/Kevin_MacLeod_-_Canon_in_D_Major.ogg",
    license: "CC BY 3.0",
    attribution: "Interprété par Kevin MacLeod",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Kevin_MacLeod_-_Canon_in_D_Major.ogg",
  },
  {
    kind: "audio",
    id: "chopin-nocturne",
    title: "Nocturne Op. 9 n°2",
    composer: "Frédéric Chopin",
    genre: "Classique · Creative Commons",
    emoji: "✨",
    src: "https://upload.wikimedia.org/wikipedia/commons/5/5c/Frederic_Chopin_-_Nocturne_Eb_major_Opus_9%2C_number_2.ogg",
    license: "CC BY-SA 2.0",
    attribution: "Interprété par Martha Goldstein",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Frederic_Chopin_-_Nocturne_Eb_major_Opus_9,_number_2.ogg",
  },
  {
    kind: "audio",
    id: "mozart-turkish-march",
    title: "Marche turque",
    composer: "Wolfgang Amadeus Mozart",
    genre: "Classique · Creative Commons",
    emoji: "🥁",
    src: "https://upload.wikimedia.org/wikipedia/commons/b/bf/Mozart_-_Piano_Sonata_No._11_in_A_major_-_III._Allegro_%28Turkish_March%29.ogg",
    license: "CC BY-SA 3.0",
    attribution: "Interprété par Bernd Krueger",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Mozart_-_Piano_Sonata_No._11_in_A_major_-_III._Allegro_(Turkish_March).ogg",
  },
];

export const RADIO_TRACKS: RadioTrack[] = [...SYNTH_TRACKS, ...AUDIO_TRACKS];
