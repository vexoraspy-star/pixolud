/**
 * Narration parlee des cinematiques 3D.
 *
 * On passe par la synthese vocale du navigateur plutot que par des fichiers
 * audio : c'est la meme discipline que les textures et la musique du Manoir
 * (aucun asset externe, aucune question de licence), et la voix est deja
 * installee sur la machine du joueur.
 *
 * LIMITE A CONNAITRE : la voix du navigateur ne passe PAS par le graphe
 * Web Audio. On ne peut donc lui ajouter ni reverberation ni distorsion. Le
 * preset « horreur » joue sur ce qui reste accessible — la voix la plus
 * grave, un debit tres lent, des silences — et laisse a l'appelant le soin de
 * poser une nappe sonore dessous grace au rappel `onStart`.
 */

/** Une phrase a dire, et la maniere de la dire. */
export interface SayOptions {
  /** Coupe la phrase en cours au lieu de se mettre a la queue. */
  urgent?: boolean;
  /** 0 (tres grave) a 2. Remplace celui du preset. */
  pitch?: number;
  /** 0.1 (tres lent) a 2. Remplace celui du preset. */
  rate?: number;
  /** Appele quand la voix commence VRAIMENT a parler, file d'attente incluse. */
  onStart?: (estimatedSeconds: number) => void;
}

export interface Narrator {
  say(text: string, options?: SayOptions): void;
  /** Coupe la narration en cours (sortie de cinematique, onglet cache). */
  stop(): void;
  setEnabled(value: boolean): void;
  /** Faux quand le navigateur n'a pas de synthese vocale du tout. */
  readonly available: boolean;
}

export type NarratorPreset = "narrateur" | "horreur";

interface PresetDef {
  pitch: number;
  rate: number;
  volume: number;
  /** Etire la ponctuation en silences, pour une diction qui hesite. */
  dramatic: boolean;
}

const PRESETS: Record<NarratorPreset, PresetDef> = {
  narrateur: { pitch: 0.7, rate: 0.88, volume: 0.95, dramatic: false },
  // Tout en bas de la plage de hauteur, et presque deux fois plus lent qu'une
  // lecture normale. Grave seule, la voix fait « robot » ; c'est la lenteur
  // et les silences qui la font basculer vers quelque chose qui vous veut du mal.
  horreur: { pitch: 0.05, rate: 0.66, volume: 1, dramatic: true },
};

const SILENT: Narrator = {
  say() {},
  stop() {},
  setEnabled() {},
  available: false,
};

/**
 * Choisit la voix francaise la plus grave disponible. Les voix masculines
 * descendent plus bas une fois le pitch reduit ; a defaut, la premiere voix
 * francaise locale, qui evite un aller-retour reseau.
 */
function pickFrenchVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voices = synth.getVoices();
  if (voices.length === 0) return null;
  const french = voices.filter((v) => v.lang.toLowerCase().startsWith("fr"));
  if (french.length === 0) return null;
  const male = french.find((v) => /(male|homme|thomas|henri|paul|nicolas|claude)/i.test(v.name));
  return male ?? french.find((v) => v.localService) ?? french[0];
}

/**
 * Transforme la ponctuation en silences. Les moteurs de synthese marquent une
 * pause sur les points de suspension : on en met la ou le texte respire.
 */
function dramatize(text: string): string {
  return text
    .replace(/\s*:\s*/g, "... ")
    .replace(/,\s*/g, "... ")
    .replace(/\.(\s+|$)/g, "...$1")
    .replace(/\.{4,}/g, "...");
}

export function createNarrator(enabled = true, preset: NarratorPreset = "narrateur"): Narrator {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return SILENT;
  const synth = window.speechSynthesis;
  const def = PRESETS[preset];

  let voice = pickFrenchVoice(synth);
  // Les voix arrivent de facon asynchrone sur Chrome : on les rattrape.
  const onVoicesChanged = () => {
    voice = pickFrenchVoice(synth);
  };
  synth.addEventListener?.("voiceschanged", onVoicesChanged);

  let on = enabled;
  /** Evite qu'un declencheur repete parle en boucle. */
  let lastText = "";
  let lastAt = 0;

  return {
    available: true,
    setEnabled(value: boolean) {
      on = value;
      if (!value) synth.cancel();
    },
    stop() {
      try {
        synth.cancel();
      } catch {
        // ignore
      }
    },
    say(text: string, options: SayOptions = {}) {
      if (!on || !text) return;
      const now = Date.now();
      if (text === lastText && now - lastAt < 12000) return;
      lastText = text;
      lastAt = now;
      try {
        if (options.urgent) synth.cancel();
        const spoken = def.dramatic ? dramatize(text) : text;
        const u = new SpeechSynthesisUtterance(spoken);
        if (voice) u.voice = voice;
        u.lang = voice?.lang ?? "fr-FR";
        u.pitch = options.pitch ?? def.pitch;
        u.rate = options.rate ?? def.rate;
        u.volume = def.volume;
        // Estimation grossiere de la duree, pour caler la nappe sonore :
        // environ 14 caracteres par seconde a debit normal.
        const estimated = spoken.length / (14 * u.rate);
        if (options.onStart) u.onstart = () => options.onStart?.(estimated);
        synth.speak(u);
      } catch {
        // Une voix indisponible ne doit jamais interrompre la cinematique.
      }
    },
  };
}
