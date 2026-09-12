// Categorie "Melodie" : on dessine une courbe, elle devient une melodie.
// La hauteur du trait donne la note, l'axe horizontal donne le temps.
//
// Deux decisions portent tout le reste :
//
//  - Les coordonnees sont NORMALISEES dans [0,1]. Le dessin doit sonner
//    pareil sur le canvas de l'editeur, sur celui du lecteur et sur un
//    telephone, qui n'ont pas la meme taille en pixels.
//  - Les notes sont QUANTIFIEES sur une gamme. Une courbe relevee en
//    frequences continues sonne faux et donne une sirene ; ramenee sur une
//    gamme, n'importe quel gribouillage reste musical. C'est ce qui fait que
//    le jeu est agreable des le premier trait.

export const MELODIE_INSTRUMENTS = [
  { id: "piano", name: "Piano", color: "#f59e0b" },
  { id: "violon", name: "Violon", color: "#ef4444" },
  { id: "flute", name: "Flûte", color: "#38bdf8" },
  { id: "violoncelle", name: "Violoncelle", color: "#a855f7" },
  { id: "harpe", name: "Harpe", color: "#22c55e" },
  { id: "boite", name: "8-Bit", color: "#ec4899" },
  { id: "synthe", name: "Synthé", color: "#14b8a6" },
  { id: "cloche", name: "Cloche", color: "#eab308" },
] as const;

export type InstrumentId = (typeof MELODIE_INSTRUMENTS)[number]["id"];

export function instrumentColor(id: InstrumentId): string {
  return MELODIE_INSTRUMENTS.find((i) => i.id === id)?.color ?? "#f59e0b";
}

export function instrumentName(id: InstrumentId): string {
  return MELODIE_INSTRUMENTS.find((i) => i.id === id)?.name ?? "Piano";
}

/** Les gammes proposees, de la plus indulgente a la plus expressive. */
export const MELODIE_SCALES = [
  { id: "pentatonique", name: "Pentatonique", degrees: [0, 2, 4, 7, 9] },
  { id: "majeure", name: "Majeure", degrees: [0, 2, 4, 5, 7, 9, 11] },
  { id: "mineure", name: "Mineure", degrees: [0, 2, 3, 5, 7, 8, 10] },
] as const;

export type ScaleId = (typeof MELODIE_SCALES)[number]["id"];

/** Sol2 : assez grave pour le violoncelle, assez clair pour la flute. */
const BASE_MIDI = 55;
const OCTAVES = 3;

/** Les notes MIDI d'une gamme, de la plus grave a la plus aigue. */
export function scaleNotes(scale: ScaleId): number[] {
  const found = MELODIE_SCALES.find((s) => s.id === scale) ?? MELODIE_SCALES[0];
  const notes: number[] = [];
  for (let octave = 0; octave < OCTAVES; octave++) {
    for (const degree of found.degrees) notes.push(BASE_MIDI + octave * 12 + degree);
  }
  notes.push(BASE_MIDI + OCTAVES * 12);
  return notes;
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** y = 0 est le haut de la zone de dessin, donc la note la plus aigue. */
export function noteIndexAt(y: number, scale: ScaleId): number {
  const notes = scaleNotes(scale);
  const clamped = Math.min(1, Math.max(0, y));
  return Math.round((1 - clamped) * (notes.length - 1));
}

export interface MelodieStroke {
  instrument: InstrumentId;
  /** Points [x, y] normalises dans [0,1], ordonnes par x croissant. */
  points: [number, number][];
}

export interface MelodieData {
  bpm: number;
  /** Duree totale du morceau, en temps (noires). */
  beats: number;
  scale: ScaleId;
  strokes: MelodieStroke[];
}

export const MELODIE_BPM_MIN = 50;
export const MELODIE_BPM_MAX = 200;

export const MELODIE_BEATS = [
  { label: "Court", value: 8 },
  { label: "Moyen", value: 16 },
  { label: "Long", value: 24 },
];

export function emptyMelodie(): MelodieData {
  return { bpm: 110, beats: 16, scale: "pentatonique", strokes: [] };
}

/** Un trait d'un seul point ne produit aucune note : il ne compte pas. */
export function isMelodiePlayable(data: MelodieData): boolean {
  return (
    !!data &&
    typeof data.bpm === "number" &&
    data.bpm >= MELODIE_BPM_MIN &&
    data.bpm <= MELODIE_BPM_MAX &&
    typeof data.beats === "number" &&
    data.beats > 0 &&
    Array.isArray(data.strokes) &&
    data.strokes.some(
      (s) =>
        Array.isArray(s?.points) &&
        s.points.length >= 2 &&
        s.points.every(
          (p) =>
            Array.isArray(p) &&
            p.length === 2 &&
            p.every((v) => typeof v === "number" && v >= 0 && v <= 1),
        ),
    )
  );
}

/** Hauteur du trait a l'abscisse x, ou null si le trait ne couvre pas x. */
export function strokeValueAt(stroke: MelodieStroke, x: number): number | null {
  const pts = stroke.points;
  if (!pts || pts.length < 2) return null;
  if (x < pts[0][0] || x > pts[pts.length - 1][0]) return null;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (x <= x1) {
      const span = x1 - x0;
      // Deux points superposes en x : on prend le second, pas une division
      // par zero qui renverrait NaN et casserait toute la lecture.
      if (span <= 1e-6) return y1;
      return y0 + ((y1 - y0) * (x - x0)) / span;
    }
  }
  return pts[pts.length - 1][1];
}

export interface MelodieNote {
  /** Debut, en temps depuis le debut du morceau. */
  beat: number;
  duration: number;
  midi: number;
  instrument: InstrumentId;
}

/** Combien de fois par temps on releve la courbe. */
const SAMPLES_PER_BEAT = 4;

/**
 * Traduit les traits en notes.
 *
 * On releve la courbe quatre fois par temps, mais on n'emet une note que
 * lorsque la hauteur CHANGE de palier : sinon un trait horizontal
 * deviendrait une mitraillette de croches identiques au lieu d'une tenue.
 */
export function melodieToNotes(data: MelodieData): MelodieNote[] {
  const notes = scaleNotes(data.scale);
  const out: MelodieNote[] = [];
  const totalSamples = Math.max(1, Math.round(data.beats * SAMPLES_PER_BEAT));

  for (const stroke of data.strokes) {
    if (!stroke.points || stroke.points.length < 2) continue;
    let currentIndex: number | null = null;
    let startSample = 0;

    const flush = (endSample: number) => {
      if (currentIndex === null) return;
      out.push({
        beat: startSample / SAMPLES_PER_BEAT,
        duration: Math.max(1, endSample - startSample) / SAMPLES_PER_BEAT,
        midi: notes[currentIndex],
        instrument: stroke.instrument,
      });
      currentIndex = null;
    };

    for (let s = 0; s <= totalSamples; s++) {
      const y = strokeValueAt(stroke, s / totalSamples);
      if (y === null) {
        flush(s);
        continue;
      }
      const index = noteIndexAt(y, data.scale);
      if (currentIndex === null) {
        currentIndex = index;
        startSample = s;
      } else if (index !== currentIndex) {
        flush(s);
        currentIndex = index;
        startSample = s;
      }
    }
    flush(totalSamples);
  }

  return out.sort((a, b) => a.beat - b.beat);
}

/** Duree d'un temps, en secondes. */
export function beatSeconds(bpm: number): number {
  return 60 / bpm;
}

/** Combien de points on compare pour noter une tentative. */
const SCORE_SAMPLES = 64;

/**
 * Note une tentative sur 100, en comparant les hauteurs relevees aux memes
 * abscisses. Une note d'ecart est pardonnee, au-dela le point decroit ; un
 * endroit ou le joueur n'a rien dessine compte comme un echec complet.
 */
export function scoreAttempt(target: MelodieData, attempt: MelodieStroke[]): number {
  const span = Math.max(1, scaleNotes(target.scale).length - 1);
  const tolerance = Math.max(2, span * 0.25);
  let checked = 0;
  let total = 0;

  for (let i = 0; i <= SCORE_SAMPLES; i++) {
    const x = i / SCORE_SAMPLES;

    let expected: number | null = null;
    for (const stroke of target.strokes) {
      const y = strokeValueAt(stroke, x);
      if (y !== null) {
        expected = y;
        break;
      }
    }
    if (expected === null) continue;
    checked++;

    let got: number | null = null;
    for (const stroke of attempt) {
      const y = strokeValueAt(stroke, x);
      if (y !== null) {
        got = y;
        break;
      }
    }
    if (got === null) continue;

    const errorInNotes = Math.abs(
      noteIndexAt(expected, target.scale) - noteIndexAt(got, target.scale),
    );
    total += Math.max(0, 1 - Math.max(0, errorInNotes - 1) / tolerance);
  }

  if (checked === 0) return 0;
  return Math.round((total / checked) * 100);
}
