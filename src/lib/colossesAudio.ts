/**
 * Les sons de Colosses.
 *
 * Un jeu de combat a besoin de trois choses — que le coup qui touche claque,
 * que le coup bloque sonne sourd, et que le KO s'entende de loin. Le reste
 * est du decor.
 *
 * Deux etages :
 * - de vrais bruitages enregistres (packs CC0 de Kenney, dans
 *   public/sounds/colosses/, voir public/sounds/LICENCES.txt), charges en
 *   arriere-plan des la creation de l'audio ;
 * - les sons synthetises d'origine, qui prennent le relais tant que les
 *   fichiers ne sont pas la (premier gong, reseau lent, navigateur qui ne lit
 *   pas l'Ogg, erreur de chargement). Le jeu n'est donc jamais muet.
 */

/** Ou vivent les fichiers, cote site. */
const DOSSIER = "/sounds/colosses/";

/**
 * Les familles de sons. Chaque famille a plusieurs variantes : on en tire une
 * au hasard a chaque coup, sinon l'oreille repere tout de suite la repetition.
 */
const BANQUES = {
  poing: [
    "impactPunch_medium_000.ogg",
    "impactPunch_medium_001.ogg",
    "impactPunch_medium_002.ogg",
    "impactPunch_medium_003.ogg",
    "impactPunch_medium_004.ogg",
  ],
  lourd: [
    "impactPunch_heavy_000.ogg",
    "impactPunch_heavy_001.ogg",
    "impactPunch_heavy_002.ogg",
    "impactPunch_heavy_003.ogg",
    "impactPunch_heavy_004.ogg",
  ],
  bloc: [
    "impactSoft_medium_000.ogg",
    "impactSoft_medium_001.ogg",
    "impactSoft_medium_002.ogg",
    "impactSoft_medium_003.ogg",
  ],
  chute: ["impactSoft_heavy_000.ogg", "impactSoft_heavy_001.ogg", "impactSoft_heavy_002.ogg"],
  sol: ["footstep_concrete_000.ogg", "footstep_concrete_001.ogg", "footstep_concrete_002.ogg"],
  saut: ["cloth1.ogg", "cloth2.ogg", "cloth3.ogg"],
  gong: ["impactBell_heavy_000.ogg", "impactBell_heavy_001.ogg"],
} as const;

type Banque = keyof typeof BANQUES;

export interface ColossesAudio {
  ctx: AudioContext | null;
  master: GainNode | null;
  /** Les variantes deja decodees, par famille. Vide tant que rien n'est charge. */
  sons?: Partial<Record<Banque, AudioBuffer[]>>;
  /** La derniere variante jouee par famille, pour ne jamais rejouer la meme. */
  derniers?: Partial<Record<Banque, number>>;
}

/**
 * Les octets bruts, gardes pour toute la session : une revanche ou un
 * changement de combattant recree l'audio, et on ne retelecharge pas pour ca.
 * (Le decodage, lui, est a refaire : un AudioBuffer se decode par contexte.)
 */
const octetsEnCache = new Map<string, Promise<ArrayBuffer | null>>();

function telecharger(fichier: string): Promise<ArrayBuffer | null> {
  let promesse = octetsEnCache.get(fichier);
  if (!promesse) {
    promesse = fetch(DOSSIER + fichier)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => null)
      .then((octets) => {
        // Un echec ne reste pas en cache : la prochaine partie retentera.
        if (!octets) octetsEnCache.delete(fichier);
        return octets;
      });
    octetsEnCache.set(fichier, promesse);
  }
  return promesse;
}

/** Le navigateur sait-il lire l'Ogg Vorbis ? Sinon, inutile de telecharger. */
function oggLisible(): boolean {
  try {
    return document.createElement("audio").canPlayType('audio/ogg; codecs="vorbis"') !== "";
  } catch {
    return false;
  }
}

/** Charge et decode toutes les variantes, sans jamais bloquer ni lever d'erreur. */
function chargerSons(a: ColossesAudio) {
  const { ctx } = a;
  if (!ctx || !oggLisible()) return;
  for (const banque of Object.keys(BANQUES) as Banque[]) {
    for (const fichier of BANQUES[banque]) {
      telecharger(fichier)
        .then(async (octets) => {
          if (!octets || ctx.state === "closed") return;
          // decodeAudioData detache le tampon qu'on lui donne : on passe une
          // copie pour garder l'original intact dans le cache.
          const buffer = await ctx.decodeAudioData(octets.slice(0));
          if (!buffer) return;
          const sons = (a.sons ??= {});
          (sons[banque] ??= []).push(buffer);
        })
        .catch(() => {});
    }
  }
}

export function creerAudio(volume: number): ColossesAudio {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return { ctx: null, master: null };
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    const audio: ColossesAudio = { ctx, master, sons: {}, derniers: {} };
    chargerSons(audio);
    return audio;
  } catch {
    return { ctx: null, master: null };
  }
}

/**
 * Un contexte cree avant un geste du joueur peut rester en pause (politique
 * d'autoplay des navigateurs) : on le relance au premier son.
 */
function reveiller(ctx: AudioContext) {
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
}

/** Vrai si au moins une variante de la famille est prete a jouer. */
function pret(a: ColossesAudio, banque: Banque): boolean {
  return (a.sons?.[banque]?.length ?? 0) > 0;
}

/** Tire une variante au hasard, jamais la meme que la fois precedente. */
function choisir(a: ColossesAudio, banque: Banque): AudioBuffer | null {
  const liste = a.sons?.[banque];
  if (!liste || liste.length === 0) return null;
  const n = liste.length;
  const derniers = (a.derniers ??= {});
  const dernier = derniers[banque] ?? -1;
  let i: number;
  if (n > 1 && dernier >= 0 && dernier < n) {
    // On tire parmi les n - 1 autres, puis on saute par-dessus la derniere.
    i = Math.floor(Math.random() * (n - 1));
    if (i >= dernier) i++;
  } else {
    i = Math.floor(Math.random() * n);
  }
  derniers[banque] = i;
  return liste[i];
}

/**
 * Joue une variante enregistree de la famille, avec une hauteur qui bouge un
 * peu a chaque fois (0.92 a 1.08) pour que deux coups ne sonnent jamais pareil.
 * Rend faux si rien n'est charge : l'appelant bascule alors sur le synthetise.
 */
function jouer(a: ColossesAudio, banque: Banque, gain: number, delai = 0): boolean {
  const { ctx, master } = a;
  if (!ctx || !master) return false;
  const buffer = choisir(a, banque);
  if (!buffer) return false;
  try {
    reveiller(ctx);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = 0.92 + Math.random() * 0.16;
    const g = ctx.createGain();
    g.gain.value = gain;
    source.connect(g);
    g.connect(master);
    source.onended = () => g.disconnect();
    source.start(ctx.currentTime + delai);
    return true;
  } catch {
    return false;
  }
}

/** Un bruit court filtre : la base de tous les impacts synthetises. */
function impact(a: ColossesAudio, duree: number, frequence: number, gain: number, type: BiquadFilterType = "bandpass") {
  const { ctx, master } = a;
  if (!ctx || !master) return;
  reveiller(ctx);
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
  reveiller(ctx);
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
  if (jouer(a, "poing", 0.7)) return;
  impact(a, 0.09, 1800, 0.5);
}

/** Le pied : plus grave, plus long. */
export function sonPied(a: ColossesAudio) {
  if (jouer(a, "lourd", 0.85)) return;
  impact(a, 0.16, 900, 0.65);
  note(a, 180, 70, 0.14, 0.18, "square");
}

/** Le coup bloque : un choc mat, sans claquement. */
export function sonBloc(a: ColossesAudio) {
  if (jouer(a, "bloc", 0.55)) return;
  impact(a, 0.12, 300, 0.4, "lowpass");
}

/**
 * Le coup special : on doit l'entendre de l'autre bout de la piece. La
 * charge synthetisee reste (c'est sa signature), un impact lourd s'y ajoute
 * quand il est charge.
 */
export function sonSpecial(a: ColossesAudio) {
  note(a, 620, 140, 0.45, 0.32);
  note(a, 930, 210, 0.45, 0.2, "triangle");
  impact(a, 0.3, 500, 0.5);
  jouer(a, "lourd", 0.8);
}

/** Le saut : un froissement de tissu, ou un souffle discret. */
export function sonSaut(a: ColossesAudio) {
  if (jouer(a, "saut", 0.7)) return;
  note(a, 320, 620, 0.12, 0.09, "sine");
}

/** L'atterrissage. */
export function sonSol(a: ColossesAudio) {
  if (jouer(a, "sol", 0.5)) return;
  impact(a, 0.1, 220, 0.3, "lowpass");
}

/**
 * Le KO : le dernier coup, le corps qui tombe, et le rebond. Faute de
 * fichiers, trois notes descendantes, et le silence.
 */
export function sonKo(a: ColossesAudio) {
  if (pret(a, "lourd") && pret(a, "chute")) {
    jouer(a, "lourd", 0.95);
    jouer(a, "chute", 0.85, 0.32);
    jouer(a, "chute", 0.4, 0.55);
    return;
  }
  note(a, 440, 400, 0.18, 0.3, "square");
  setTimeout(() => note(a, 330, 300, 0.2, 0.3, "square"), 170);
  setTimeout(() => note(a, 220, 90, 0.7, 0.34, "sawtooth"), 360);
}

/** Le gong de debut de round. */
export function sonGong(a: ColossesAudio) {
  if (jouer(a, "gong", 0.6)) return;
  note(a, 180, 60, 1.1, 0.3, "triangle");
  impact(a, 0.5, 400, 0.35, "lowpass");
}
