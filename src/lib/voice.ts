/**
 * Narration parlee des jeux 3D.
 *
 * On passe par la synthese vocale du navigateur plutot que par des fichiers
 * audio : c'est la meme discipline que les textures et la musique du Manoir
 * (aucun asset externe, aucune question de licence), et la voix est deja
 * installee sur la machine du joueur.
 *
 * La voix est volontairement grave et lente : c'est un narrateur, pas un GPS.
 */

/** Une phrase a dire, et l'importance qu'on lui accorde. */
export interface SayOptions {
  /** Coupe la phrase en cours au lieu de se mettre a la queue. */
  urgent?: boolean;
  /** 0.5 (tres grave) a 2. Defaut 0.7. */
  pitch?: number;
  /** 0.5 (tres lent) a 2. Defaut 0.88. */
  rate?: number;
}

export interface Narrator {
  say(text: string, options?: SayOptions): void;
  /** Coupe la narration en cours (mort, sortie de partie, onglet cache). */
  stop(): void;
  setEnabled(value: boolean): void;
  /** Faux quand le navigateur n'a pas de synthese vocale du tout. */
  readonly available: boolean;
}

const SILENT: Narrator = {
  say() {},
  stop() {},
  setEnabled() {},
  available: false,
};

/** Choisit la voix francaise la plus grave disponible, sinon la voix par defaut. */
function pickFrenchVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voices = synth.getVoices();
  if (voices.length === 0) return null;
  const french = voices.filter((v) => v.lang.toLowerCase().startsWith("fr"));
  if (french.length === 0) return null;
  // Les voix masculines rendent mieux le narrateur ; a defaut, la premiere
  // voix francaise locale, qui evite un aller-retour reseau.
  const male = french.find((v) => /(male|homme|thomas|henri|paul|nicolas)/i.test(v.name));
  return male ?? french.find((v) => v.localService) ?? french[0];
}

export function createNarrator(enabled = true): Narrator {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return SILENT;
  const synth = window.speechSynthesis;

  let voice = pickFrenchVoice(synth);
  // Les voix arrivent de facon asynchrone sur Chrome : on les rattrape.
  const onVoicesChanged = () => {
    voice = pickFrenchVoice(synth);
  };
  synth.addEventListener?.("voiceschanged", onVoicesChanged);

  let on = enabled;
  /** Evite qu'un declencheur repete (une piece revisitee) parle en boucle. */
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
        const u = new SpeechSynthesisUtterance(text);
        if (voice) u.voice = voice;
        u.lang = voice?.lang ?? "fr-FR";
        u.pitch = options.pitch ?? 0.7;
        u.rate = options.rate ?? 0.88;
        u.volume = 0.95;
        synth.speak(u);
      } catch {
        // Une voix indisponible ne doit jamais interrompre la partie.
      }
    },
  };
}
