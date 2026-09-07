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
  category: string;
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
  category: string;
  emoji: string;
  src: string;
  license: string;
  attribution?: string;
  sourceUrl: string;
}

export type RadioTrack = SynthTrack | AudioTrack;

export const RADIO_CATEGORIES = [
  "Piano",
  "Baroque",
  "Opéra",
  "Marche",
  "Ragtime",
  "Valse",
  "Orchestral",
] as const;

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
    category: "Piano",
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
    category: "Piano",
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
    category: "Piano",
    emoji: "🌒",
    src: "https://upload.wikimedia.org/wikipedia/commons/d/d0/Moonlight_Sonata.ogg",
    license: "Domaine public (CC0)",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Moonlight_Sonata.ogg",
  },
  {
    kind: "audio",
    id: "chopin-nocturne",
    title: "Nocturne Op. 9 n°2",
    composer: "Frédéric Chopin",
    category: "Piano",
    emoji: "✨",
    src: "https://upload.wikimedia.org/wikipedia/commons/5/5c/Frederic_Chopin_-_Nocturne_Eb_major_Opus_9%2C_number_2.ogg",
    license: "CC BY-SA 2.0",
    attribution: "Interprété par Martha Goldstein",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Frederic_Chopin_-_Nocturne_Eb_major_Opus_9,_number_2.ogg",
  },
  {
    kind: "audio",
    id: "vivaldi-spring",
    title: "Le Printemps",
    composer: "Antonio Vivaldi",
    category: "Baroque",
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
    category: "Baroque",
    emoji: "🕊️",
    src: "https://upload.wikimedia.org/wikipedia/commons/5/59/Kevin_MacLeod_-_Canon_in_D_Major.ogg",
    license: "CC BY 3.0",
    attribution: "Interprété par Kevin MacLeod",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Kevin_MacLeod_-_Canon_in_D_Major.ogg",
  },
  {
    kind: "audio",
    id: "bach-toccata",
    title: "Toccata et Fugue en Ré mineur",
    composer: "Johann Sebastian Bach",
    category: "Baroque",
    emoji: "🎻",
    src: "https://upload.wikimedia.org/wikipedia/commons/c/c3/Kevin_MacLeod_-_J_S_Bach_Toccata_and_Fugue_in_D_Minor.ogg",
    license: "CC BY 3.0",
    attribution: "Interprété par Kevin MacLeod",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Kevin_MacLeod_-_J_S_Bach_Toccata_and_Fugue_in_D_Minor.ogg",
  },
  {
    kind: "audio",
    id: "bizet-habanera",
    title: "Habanera (Carmen)",
    composer: "Georges Bizet",
    category: "Opéra",
    emoji: "💃",
    src: "https://upload.wikimedia.org/wikipedia/commons/9/9a/Kevin_MacLeod_-_Georges_Bizet_Habanera.ogg",
    license: "CC BY 3.0",
    attribution: "Interprété par Kevin MacLeod",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Kevin_MacLeod_-_Georges_Bizet_Habanera.ogg",
  },
  {
    kind: "audio",
    id: "wagner-valkyries",
    title: "La Chevauchée des Walkyries",
    composer: "Richard Wagner",
    category: "Opéra",
    emoji: "⚔️",
    src: "https://upload.wikimedia.org/wikipedia/commons/d/d2/Richard_Wagner_-_The_Valkyrie_-_Ride_of_the_Valkyries.ogg",
    license: "EFF Open Audio License",
    attribution: "Philharmonie d'Ulm, dir. James Allen Gähres",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Richard_Wagner_-_The_Valkyrie_-_Ride_of_the_Valkyries.ogg",
  },
  {
    kind: "audio",
    id: "mozart-turkish-march",
    title: "Marche turque",
    composer: "Wolfgang Amadeus Mozart",
    category: "Marche",
    emoji: "🥁",
    src: "https://upload.wikimedia.org/wikipedia/commons/b/bf/Mozart_-_Piano_Sonata_No._11_in_A_major_-_III._Allegro_%28Turkish_March%29.ogg",
    license: "CC BY-SA 3.0",
    attribution: "Interprété par Bernd Krueger",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Mozart_-_Piano_Sonata_No._11_in_A_major_-_III._Allegro_(Turkish_March).ogg",
  },
  {
    kind: "audio",
    id: "sousa-stars-stripes",
    title: "Stars and Stripes Forever",
    composer: "John Philip Sousa",
    category: "Marche",
    emoji: "🎺",
    src: "https://upload.wikimedia.org/wikipedia/commons/5/59/The_Stars_and_Stripes_Forever_-_U.S._Navy_Band.ogg",
    license: "Domaine public",
    attribution: "United States Navy Band",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:The_Stars_and_Stripes_Forever_-_U.S._Navy_Band.ogg",
  },
  {
    kind: "audio",
    id: "radetzky-march",
    title: "Marche de Radetzky",
    composer: "Johann Strauss (père)",
    category: "Marche",
    emoji: "🪖",
    src: "https://upload.wikimedia.org/wikipedia/commons/b/b4/Radetzky_March.ogg",
    license: "Domaine public",
    attribution: "United States Marine Band, dir. John R. Bourgeois",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Radetzky_March.ogg",
  },
  {
    kind: "audio",
    id: "joplin-entertainer",
    title: "The Entertainer",
    composer: "Scott Joplin",
    category: "Ragtime",
    emoji: "🎷",
    src: "https://upload.wikimedia.org/wikipedia/commons/1/1b/The_Entertainer_-_Scott_Joplin.ogg",
    license: "Domaine public (CC0)",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:The_Entertainer_-_Scott_Joplin.ogg",
  },
  {
    kind: "audio",
    id: "blue-danube",
    title: "Le Beau Danube bleu",
    composer: "Johann Strauss II",
    category: "Valse",
    emoji: "💙",
    src: "https://upload.wikimedia.org/wikipedia/commons/d/d4/%22An_der_sch%C3%B6nen%2C_blauen_Donau%22_performed_by_the_U.S._Marine_Band.mp3",
    license: "Domaine public",
    attribution: "United States Marine Band, dir. Albert F. Schoepper",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:%22An_der_sch%C3%B6nen,_blauen_Donau%22_performed_by_the_U.S._Marine_Band.mp3",
  },
  {
    kind: "audio",
    id: "grieg-mountain-king",
    title: "Dans l'antre du roi de la montagne",
    composer: "Edvard Grieg",
    category: "Orchestral",
    emoji: "🏔️",
    src: "https://upload.wikimedia.org/wikipedia/commons/b/bb/Musopen_-_In_the_Hall_Of_The_Mountain_King.ogg",
    license: "Domaine public",
    attribution: "Musopen Symphony Orchestra",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Musopen_-_In_the_Hall_Of_The_Mountain_King.ogg",
  },
  {
    kind: "audio",
    id: "saint-saens-danse-macabre",
    title: "Danse macabre",
    composer: "Camille Saint-Saëns",
    category: "Orchestral",
    emoji: "💀",
    src: "https://upload.wikimedia.org/wikipedia/commons/4/46/Kevin_MacLeod_-_Camille_Saint-Sans_Danse_Macabre.ogg",
    license: "CC BY 3.0",
    attribution: "Interprété par Kevin MacLeod",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Kevin_MacLeod_-_Camille_Saint-Sans_Danse_Macabre.ogg",
  },
  {
    kind: "audio",
    id: "tchaikovsky-sugar-plum",
    title: "Danse de la Fée Dragée",
    composer: "Piotr Ilitch Tchaïkovski",
    category: "Orchestral",
    emoji: "🍬",
    src: "https://upload.wikimedia.org/wikipedia/commons/d/de/Kevin_MacLeod_-_P_I_Tchaikovsky_Dance_of_the_Sugar_Plum_Fairy.ogg",
    license: "CC BY 3.0",
    attribution: "Interprété par Kevin MacLeod",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Kevin_MacLeod_-_P_I_Tchaikovsky_Dance_of_the_Sugar_Plum_Fairy.ogg",
  },
  {
    kind: "audio",
    id: "schubert-ave-maria",
    title: "Ave Maria",
    composer: "Franz Schubert",
    category: "Orchestral",
    emoji: "🕯️",
    src: "https://upload.wikimedia.org/wikipedia/commons/d/d7/Free_Tim_-_Schuberts_Ave_Maria.ogg",
    license: "Domaine public (CC0)",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Free_Tim_-_Schuberts_Ave_Maria.ogg",
  },
  {
    kind: "audio",
    id: "mozart-eine-kleine",
    title: "Eine kleine Nachtmusik",
    composer: "Wolfgang Amadeus Mozart",
    category: "Orchestral",
    emoji: "🎼",
    src: "https://upload.wikimedia.org/wikipedia/commons/2/24/Mozart_-_Eine_kleine_Nachtmusik_-_1._Allegro.ogg",
    license: "CC BY-SA 2.0",
    attribution: "Advent Chamber Orchestra",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Mozart_-_Eine_kleine_Nachtmusik_-_1._Allegro.ogg",
  },
  {
    kind: "audio",
    id: "beethoven-symphonie-5",
    title: "Symphonie n°5 (1er mouvement)",
    composer: "Ludwig van Beethoven",
    category: "Orchestral",
    emoji: "🎻",
    src: "https://upload.wikimedia.org/wikipedia/commons/e/e6/Ludwig_van_Beethoven_-_symphony_no._5_in_c_minor%2C_op._67_-_i._allegro_con_brio.ogg",
    license: "Domaine public",
    attribution: "Skidmore College Orchestra",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Ludwig_van_Beethoven_-_symphony_no._5_in_c_minor,_op._67_-_i._allegro_con_brio.ogg",
  },
  {
    kind: "audio",
    id: "beethoven-ode-joie",
    title: "Hymne à la joie",
    composer: "Ludwig van Beethoven",
    category: "Orchestral",
    emoji: "🎉",
    src: "https://upload.wikimedia.org/wikipedia/commons/f/f7/Ode_to_Joy.ogg",
    license: "Domaine public (CC0)",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Ode_to_Joy.ogg",
  },
  {
    kind: "audio",
    id: "rossini-guillaume-tell",
    title: "Ouverture de Guillaume Tell",
    composer: "Gioachino Rossini",
    category: "Orchestral",
    emoji: "🏹",
    src: "https://upload.wikimedia.org/wikipedia/commons/c/cf/William_Tell_Overture_-_Edison.ogg",
    license: "Domaine public",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:William_Tell_Overture_-_Edison.ogg",
  },
  {
    kind: "audio",
    id: "holst-jupiter",
    title: "Jupiter (Les Planètes)",
    composer: "Gustav Holst",
    category: "Orchestral",
    emoji: "🪐",
    src: "https://upload.wikimedia.org/wikipedia/commons/3/3f/Gustav_Holst_-_the_planets%2C_op._32_-_iv._jupiter%2C_the_bringer_of_jollity.ogg",
    license: "Domaine public",
    attribution: "Skidmore College Orchestra (Musopen)",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Gustav_Holst_-_the_planets,_op._32_-_iv._jupiter,_the_bringer_of_jollity.ogg",
  },
  {
    kind: "audio",
    id: "verdi-donna-mobile",
    title: "La donna è mobile (Rigoletto)",
    composer: "Giuseppe Verdi",
    category: "Opéra",
    emoji: "🎭",
    src: "https://upload.wikimedia.org/wikipedia/commons/5/5a/La_Donna_E_Mobile_Rigoletto.ogg",
    license: "Domaine public (CC0)",
    attribution: "Enrico Caruso (1908)",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:La_Donna_E_Mobile_Rigoletto.ogg",
  },
  {
    kind: "audio",
    id: "rimsky-bourdon",
    title: "Le Vol du bourdon",
    composer: "Nikolaï Rimski-Korsakov",
    category: "Orchestral",
    emoji: "🐝",
    src: "https://upload.wikimedia.org/wikipedia/commons/c/c0/Rimsky-Korsakov_-_flight_of_the_bumblebee.oga",
    license: "Domaine public",
    attribution: "United States Army Band",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Rimsky-Korsakov_-_flight_of_the_bumblebee.oga",
  },
  {
    kind: "audio",
    id: "offenbach-cancan",
    title: "Galop infernal (Can-can)",
    composer: "Jacques Offenbach",
    category: "Valse",
    emoji: "🎩",
    src: "https://upload.wikimedia.org/wikipedia/commons/6/63/Offenbach_-_Orpheus_in_the_Underworld_-_Overture%2C_Can_Can_section.ogg",
    license: "Domaine public",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Offenbach_-_Orpheus_in_the_Underworld_-_Overture,_Can_Can_section.ogg",
  },
  {
    kind: "audio",
    id: "elgar-pomp",
    title: "Pomp and Circumstance n°1",
    composer: "Edward Elgar",
    category: "Marche",
    emoji: "🎓",
    src: "https://upload.wikimedia.org/wikipedia/commons/e/e4/Pomp_and_circumstances_No._1.ogg",
    license: "Domaine public",
    attribution: "London Symphony Orchestra, dir. Edward Elgar",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Pomp_and_circumstances_No._1.ogg",
  },
  {
    kind: "audio",
    id: "chopin-minute-waltz",
    title: "Valse minute",
    composer: "Frédéric Chopin",
    category: "Piano",
    emoji: "⏱️",
    src: "https://upload.wikimedia.org/wikipedia/commons/e/e5/Chopin_Minute_Waltz.ogg",
    license: "Domaine public",
    attribution: "Sigrid Schneevoigt (1931)",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Chopin_Minute_Waltz.ogg",
  },
  {
    kind: "audio",
    id: "grieg-matin",
    title: "Le Matin (Peer Gynt)",
    composer: "Edvard Grieg",
    category: "Orchestral",
    emoji: "🌅",
    src: "https://upload.wikimedia.org/wikipedia/commons/1/1a/Musopen_-_Morning.ogg",
    license: "Domaine public",
    attribution: "Musopen Symphony Orchestra",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Musopen_-_Morning.ogg",
  },
];

export const RADIO_TRACKS: RadioTrack[] = [...SYNTH_TRACKS, ...AUDIO_TRACKS];
