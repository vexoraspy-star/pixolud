"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  buildManor,
  roomAt,
  floorHeightAt,
  MANOR_ITEMS,
  CLUE_SPOTS,
  CODE_LENGTH,
  SEALS,
  DOLL_SPOTS,
  CAVE_DOOR,
  ALTAR,
  HATCH,
  UPPER_Y,
  STAIR_X0,
  STAIR_X1,
  STAIR_ROW_FIRST,
  STAIR_ROW_LAST,
  LOCKED_DOORS,
  LOCKED_ROOMS,
  LOCKED_RELIC_SPOT,
  HIDEOUT_KINDS,
  PICKUP_SPOTS,
  PICKUP_RANDOM_COUNT,
  MANOR_NOTES,
  propGeometry,
  type Footprint,
  type ManorItemDef,
  type ManorNote,
  type PickupKind,
  type PickupSpot,
  type PropBox,
} from "@/lib/manor";
import { cellKey } from "@/lib/maze";
import { buildMonster, poseMonster } from "@/lib/manorMonster";
import { buildDolls } from "@/lib/manorDolls";
import { NOISE_RADIUS, audibility, pruneNoises, wallsBetween, type Noise, type NoiseKind } from "@/lib/manorNoise";
import {
  createBrain,
  noteHidingSeen,
  sightRange,
  thinkMonster,
  type BrainState,
  type MapQuery,
  type SpeedMode,
} from "@/lib/manorAI";
import {
  ITEM_DEFS,
  KEY_NAMES,
  addItem,
  addKey,
  addNote,
  consumeSelected,
  emptyInventory,
  isUsable,
  selectSlot as selectInventorySlot,
  type Inventory,
  type UsableItem,
} from "@/lib/manorInventory";
import { buildGhost, makeScareFaceUrl, makeScareHandUrl } from "@/lib/manorScares";
import HorrorDevPanel, { DEV_OFF, type DevFlags, type DevSnapshot } from "./HorrorDevPanel";
import HorrorGuide from "./HorrorGuide";
import Game3DSettings from "./Game3DSettings";
import {
  loadBrightness3D,
  loadLayout3D,
  loadSensitivity3D,
  saveBrightness3D,
  type Layout3D as Layout,
} from "@/lib/settings3d";
import {
  makeManorWallTexture,
  makeManorFloorTexture,
  makeCeilingTexture,
  makePaintingTexture,
  makeRugTexture,
  makeWoodTexture,
  makeCluePlaqueTexture,
  makeDoorTexture,
} from "@/lib/manorTextures";
import {
  createAudio,
  playHeartbeat,
  playPickup,
  playStinger,
  playNearMiss,
  playWake,
  playCrash,
  playDenied,
  playUnlock,
  playDeathScream,
  playFootstep,
  playStairCreak,
  playWhisper,
  playBreath,
  playCandleOut,
  playDoorSlam,
  playRitual,
  playHatch,
  playSealBreak,
  playTick,
  playHatchOpen,
  playFlashlightClick,
  playCrouch,
  playPlayerStep,
  playCoinThrow,
  playCoinLand,
  playMusicBox,
  playSaltThrow,
  playRecoil,
  playWardrobe,
  playUnderBed,
  playLockedRattle,
  playKeyPickup,
  playPaper,
  playSlot,
  playBreathHold,
  playGasp,
  playPlayerBreath,
  playShriek,
  playGrowl,
  playScreamer,
  playEarWhisper,
  playBulbDie,
  type MusicBoxSound,
} from "@/lib/manorAudio";

const CELL_SIZE = 1.7;
const EYE_HEIGHT = 1.5;
const PLAYER_RADIUS = 0.26;
const MOVE_SPEED = 2.6;
const BASE_LOOK_SENSITIVITY = 0.0038;
const ITEM_COUNT = MANOR_ITEMS.length;
/** Elle patrouille sans rien savoir : lentement. */
const MONSTER_SPEED_WANDER = 1.15;
/** Elle va voir un bruit. */
const MONSTER_SPEED_BASE = 1.55;
/** Elle te voit. */
const MONSTER_SPEED_HUNTING = 2.05;
const CAPTURE_RADIUS = 0.55;
/** Cadence de reflexion de la chose : dix fois par seconde suffit largement. */
const THINK_INTERVAL = 0.1;
/** Accroupi : lent, silencieux, et plus bas dans son champ de vision. */
const CROUCH_SPEED = 1.35;
const CROUCH_EYE = 0.95;
/** Sous un lit, la camera frole le plancher. */
const BED_EYE = 0.3;
/** Maj : on court, mais on s'epuise et on s'entend de loin. */
const SPRINT_SPEED = 3.7;
const STAMINA_DRAIN_PER_SEC = 24;
const STAMINA_REGEN_PER_SEC = 13;
/** Apres un epuisement, il faut reprendre ce souffle-la avant de recourir. */
const STAMINA_RECOVER_AT = 35;
/** Duree maximale d'apnee dans une cachette. */
const BREATH_HOLD_SECONDS = 6;
const PICKUP_REACH = 1.05;
/** Le sel ne sert qu'a bout portant. */
const SALT_REACH = 2.4;
const SALT_STUN_SECONDS = 4.5;
const MUSICBOX_SECONDS = 12;
const COIN_RANGE = 7.5;
/** Temps minimal entre deux screamers : au-dela, on s'y habitue. */
const SCARE_COOLDOWN = 55;
/** Elle debusque le joueur quand elle arrive a portee de bras de la cachette. */
const DEBUSK_REACH = 0.9;
const REPATH_INTERVAL = 0.7;
const FLASHLIGHT_DRAIN_PER_SEC = 100 / 90;
const FLASHLIGHT_REGEN_PER_SEC = 100 / 45;
const NEAR_MISS_RADIUS = 1.8;
const NEAR_MISS_COOLDOWN = 11;
const STINGER_MIN_DELAY = 16;
const STINGER_MAX_DELAY = 42;
const ROOM_LABEL_SECONDS = 3;
const TOAST_SECONDS = 4.2;
/** Duree du carton plein ecran annoncant un nouvel acte. */
const ACT_CARD_SECONDS = 3.6;
const MONSTER_GRACE_SECONDS_IDLE = 75;
const PAINTING_FALL_SECONDS = 0.55;
const CEILING_HEIGHT = 2.6;
const DOOR_REACH = 2.4;
const CLUE_REACH = 1.7;
const ALTAR_REACH = 2.3;
const HATCH_REACH = 0.9;
// Distance au BORD du meuble (son emprise reelle), pas a son centre : un lit
// de trois cases se prend par n'importe quel cote, et un mur fait plus d'une
// case d'epaisseur, donc on ne se cache jamais a travers une cloison.
const HIDE_REACH = 0.9;
/** Distance a laquelle on ramasse une poupee assise au sol. */
const DOLL_REACH = 0.85;
/**
 * Recompense des cinq poupees. Volontairement moderee : les vitesses du final
 * ont ete calibrees par simulation, et une quete facultative doit aider, pas
 * rendre la fin gratuite. +10 % de vitesse, et une seule protection.
 */
const DOLL_SPEED_BONUS = 1.1;
/** Apres la protection, elle ne peut pas te reprendre tout de suite. */
const SHIELD_GRACE_SECONDS = 2.5;
const BATTERY_RESTORE = 45;
/** Duree du screamer avant l'ecran de mort. */
const DEATH_SEQUENCE_SECONDS = 1.45;
/** Chaque objet ramasse rend la chose plus rapide et le manoir plus sombre. */
const SPEED_PER_ITEM = 0.13;
/** Le rituel sur l'autel, avant la course finale. */
const RITUAL_SECONDS = 4.2;
/**
 * Le final se joue en trois temps, et chacun a sa propre vitesse.
 *
 * - « sceaux » : briser les 3 sceaux aux quatre coins du manoir. Elle est
 *   un peu plus lente que toi : on peut la semer, mais pas se tromper.
 * - « survie » : 45 secondes a tenir pendant que la trappe s'ouvre. Elle
 *   accelere, la lampe eteinte la ralentit encore.
 * - « fuite » : le sprint final vers la trappe, la ou elle est plus rapide.
 */
// Vitesses calibrees par simulation (le joueur avance a MOVE_SPEED = 2.6) :
// a 2.45 un joueur qui fuit correctement se fait rattraper en 31 s, donc bien
// avant la fin des 45 secondes ; a 2.3 il survit avec moins d'une case
// d'avance. On reste juste en dessous, et s'arreter reste mortel en 2 s.
const MONSTER_SPEED_SEALS = 2.15;
const MONSTER_SPEED_SURVIVE = 2.25;
const MONSTER_SPEED_FINALE = 2.45;
/** Lampe eteinte, elle te suit a l'oreille : elle perd du terrain. */
const DARK_SPEED_BONUS = 0.3;
/** Derniers instants du compte a rebours : la boussole montre la trappe. */
const HATCH_HINT_SECONDS = 12;
/** La duree de la fuite : le temps que la trappe finisse de s'ouvrir. */
const SURVIVE_SECONDS = 45;
/** Distance a laquelle un sceau cede tout seul : pas de touche a presser en pleine course. */
const SEAL_REACH = 1.15;
/** Elle reste figee pendant le rituel, puis marque un temps avant de bondir. */
const CHASE_RELEASE_SECONDS = 0.9;
const LOS_INTERVAL = 0.22;

interface Clue {
  rank: number;
  digit: number;
  room: string;
}

/**
 * L'etape courante, decrite assez richement pour que l'interface puisse la
 * mettre en scene : un acte, un titre, une consigne et un lieu.
 */
interface Quest {
  /** Identifiant stable de l'etape : sert a detecter un changement d'acte. */
  id: string;
  act: string;
  title: string;
  detail: string;
  where: string | null;
  /** "calme" pendant l'exploration, "danger" pendant la fuite finale. */
  mood: "calme" | "rituel" | "danger";
}

/** Les phases de la partie, du hall d'entree a la trappe. */
type Phase = "none" | "ritual" | "seals" | "survive" | "escape";


/** La palette du carnet : elle vire au rouge a mesure que la nuit tourne mal. */
const QUEST_MOODS = {
  calme: { accent: "#c08a3e", ink: "#f0dcae", act: "#a07a44", halo: "192,138,62", glow: 0.2 },
  rituel: { accent: "#c2410c", ink: "#fed7aa", act: "#ea580c", halo: "194,65,12", glow: 0.32 },
  danger: { accent: "#dc2626", ink: "#fecaca", act: "#ef4444", halo: "220,38,38", glow: 0.5 },
} as const;

/**
 * Bruit blanc 96x96, genere une seule fois et reutilise comme fond de grain.
 * On anime ensuite sa POSITION plutot que de redessiner du bruit a chaque
 * image : c'est la difference entre un effet gratuit et un effet qui coute
 * dix images par seconde.
 */
let grainUrl: string | null = null;
function getGrainUrl(): string {
  if (grainUrl) return grainUrl;
  const c = document.createElement("canvas");
  c.width = 96;
  c.height = 96;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(96, 96);
  // Grain CLAIRSEME et transparent, pose en fusion normale. L'ancien grain
  // plein, en mix-blend-overlay, obligeait le navigateur a refusionner le
  // canvas WebGL entier a chaque image : c'etait une partie des chutes.
  for (let i = 0; i < img.data.length; i += 4) {
    const r = Math.random();
    const light = r > 0.86;
    const dark = r < 0.14;
    const v = light ? 235 : 0;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = light || dark ? 120 + Math.random() * 110 : 0;
  }
  ctx.putImageData(img, 0, 0);
  grainUrl = c.toDataURL();
  return grainUrl;
}

/** Melange deux couleurs #rrggbb. Sert a faire saigner l'interface. */
function mixHex(from: string, to: string, t: number): string {
  const channels = [1, 3, 5].map((i) => {
    const a = parseInt(from.slice(i, i + 2), 16);
    const b = parseInt(to.slice(i, i + 2), 16);
    return Math.round(a + (b - a) * t);
  });
  return `#${channels.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

const FIRST_QUEST: Quest = {
  id: "plaques",
  act: "Acte I",
  title: "Les plaques gravées",
  detail: `${CODE_LENGTH} chiffres sont gravés dans le manoir.`,
  where: null,
  mood: "calme",
};

function bfsPath(
  from: [number, number],
  to: [number, number],
  isSolid: (x: number, y: number) => boolean,
  width: number,
  height: number,
): [number, number][] | null {
  if (from[0] === to[0] && from[1] === to[1]) return [from];
  const visited = new Set([cellKey(...from)]);
  const prev = new Map<string, [number, number]>();
  const queue: [number, number][] = [from];
  let qi = 0;
  while (qi < queue.length) {
    const [x, y] = queue[qi++];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (isSolid(nx, ny)) continue;
      const nk = cellKey(nx, ny);
      if (visited.has(nk)) continue;
      visited.add(nk);
      prev.set(nk, [x, y]);
      if (nx === to[0] && ny === to[1]) {
        const path: [number, number][] = [[nx, ny]];
        let k = nk;
        while (prev.has(k)) {
          const p = prev.get(k)!;
          path.unshift(p);
          k = cellKey(...p);
        }
        return path;
      }
      queue.push([nx, ny]);
    }
  }
  return null;
}

/** Distance d'un point au rectangle d'une emprise de meuble, en cases. */
function distToFootprint(px: number, pz: number, fp: Footprint): number {
  const cx = Math.max(fp.x0, Math.min(px, fp.x1));
  const cz = Math.max(fp.z0, Math.min(pz, fp.z1));
  return Math.hypot(px - cx, pz - cz);
}

/** Ce qu'on voit d'un objet ramassable : les trois cles partagent un modele. */
type PickupVisual = "coin" | "battery" | "salt" | "musicbox" | "key" | "note";
function visualOf(kind: PickupKind): PickupVisual {
  if (kind === "cle-condamnee" || kind === "cle-laboratoire" || kind === "cle-docteur") return "key";
  return kind;
}

/** Bouton tactile maintenu : il pilote une direction tant que le doigt reste. */
function HoldButton({ label, onHold }: { label: string; onHold: (down: boolean) => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      onPointerLeave={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
      className="flex size-12 items-center justify-center text-lg text-zinc-300 active:scale-95"
      style={{ background: "rgba(0,0,0,0.62)", border: "1px solid rgba(255,255,255,0.14)" }}
    >
      {label}
    </button>
  );
}

/** Bouton tactile a impulsion : l'equivalent d'une pression sur E ou F. */
function TapButton({
  label,
  accent,
  highlight = false,
  onTap,
}: {
  label: string;
  accent: string;
  highlight?: boolean;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        onTap();
      }}
      className="flex size-14 items-center justify-center text-lg font-bold text-zinc-200 active:scale-95"
      style={{
        background: "rgba(0,0,0,0.68)",
        border: `1px solid ${highlight ? accent : "rgba(255,255,255,0.14)"}`,
        boxShadow: highlight ? `0 0 16px ${accent}` : undefined,
      }}
    >
      {label}
    </button>
  );
}

export default function HorrorScene({
  seed,
  onCaught,
  onEscape,
  devAllowed = false,
  devOpenAtStart = false,
}: {
  seed: number;
  onCaught: () => void;
  onEscape: () => void;
  /** Compte admin, verifie cote serveur : outils de developpement disponibles. */
  devAllowed?: boolean;
  /** Lance depuis la carte « Mode developpeur » : panneau ouvert d'entree. */
  devOpenAtStart?: boolean;
}) {
  const startsInDev = devAllowed && devOpenAtStart;
  const [devOpen, setDevOpen] = useState(startsInDev);
  // Lance en mode dev : invincible d'office, sinon on meurt en regardant la carte.
  const [devFlags, setDevFlags] = useState<DevFlags>(startsInDev ? { ...DEV_OFF, god: true } : DEV_OFF);
  const [devSnap, setDevSnap] = useState<DevSnapshot | null>(null);
  const devRef = useRef<DevFlags>(DEV_OFF);
  const devOpenRef = useRef(false);
  useEffect(() => {
    // Sans le droit, les interrupteurs restent coupes quoi qu'il arrive.
    devRef.current = devAllowed ? devFlags : DEV_OFF;
  }, [devAllowed, devFlags]);
  useEffect(() => {
    devOpenRef.current = devAllowed && devOpen;
  }, [devAllowed, devOpen]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [itemsFound, setItemsFound] = useState(0);
  const [battery, setBattery] = useState(100);
  const [flashlightOn, setFlashlightOn] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [roomLabel, setRoomLabel] = useState<string | null>(null);
  const [toast, setToast] = useState<ManorItemDef | null>(null);
  const [scareFlash, setScareFlash] = useState(0);
  const [clues, setClues] = useState<Clue[]>([]);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [entry, setEntry] = useState("");
  const [entryError, setEntryError] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  /** 0 = tranquille, 1 = elle est sur toi. Pilote la vignette et le grain. */
  const [dread, setDread] = useState(0);
  const [finale, setFinale] = useState<Phase>("none");
  /** Ce que le joueur doit faire maintenant : sans ca, on erre sans savoir. */
  const [quest, setQuest] = useState<Quest>(FIRST_QUEST);
  /** Carton d'acte plein ecran, affiche a chaque changement d'etape. */
  const [actCard, setActCard] = useState<Quest | null>(null);
  /** Reliques deja ramassees, dans l'ordre : l'interface en fait des cases. */
  const [relics, setRelics] = useState<ManorItemDef[]>([]);
  /** Quete secondaire : poupees trouvees, et protection encore disponible. */
  const [dollsFound, setDollsFound] = useState(0);
  const [dollShield, setDollShield] = useState(false);
  /** Ou l'on est cache : dans une armoire, sous un lit, ou nulle part. */
  const [hideKind, setHideKind] = useState<"wardrobe" | "bed" | null>(null);
  const hidden = hideKind !== null;
  const [crouched, setCrouched] = useState(false);
  const [stamina, setStamina] = useState(100);
  /** Le bruit que tu fais, de 0 a 1 : la jauge qui apprend a marcher doucement. */
  const [noiseMeter, setNoiseMeter] = useState(0);
  /** Apnee restante dans la cachette, de 0 a 1. */
  const [breath, setBreath] = useState(1);
  const [holdingBreath, setHoldingBreath] = useState(false);
  const [inventory, setInventory] = useState<Inventory>(emptyInventory);
  /** Le carnet complet (Tab) : objets, cles et pages lues. */
  const [bagOpen, setBagOpen] = useState(false);
  /** Guide du manoir (H ou « ? ») : il met la partie en pause. */
  const [guideOpen, setGuideOpen] = useState(false);
  const guideOpenRef = useRef(false);
  useEffect(() => {
    guideOpenRef.current = guideOpen;
  }, [guideOpen]);
  const [readingNote, setReadingNote] = useState<ManorNote | null>(null);
  /** Image plein ecran d'un screamer, le temps d'un battement de coeur. */
  const [screamer, setScreamer] = useState<"face" | "hand" | null>(null);
  const [scareImages, setScareImages] = useState<{ face: string; hand: string } | null>(null);
  /** Le navigateur a repris la carte graphique : sans ca, ecran noir et rien a faire. */
  const [contextLost, setContextLost] = useState(false);
  /** Sceaux restants pendant l'acte V, secondes restantes pendant l'acte VI. */
  const [sealsLeft, setSealsLeft] = useState(SEALS.length);
  const [surviveLeft, setSurviveLeft] = useState(SURVIVE_SECONDS);
  /** Cap et distance vers le prochain objectif du final, pour la boussole. */
  const [guide, setGuide] = useState<{
    angle: number;
    distance: number;
    kind: "seal" | "monster" | "hatch";
  } | null>(null);
  const [loadedBrightness, setLoadedBrightness] = useState(1);
  /** Elle t'a dans son champ de vision : l'image se met a decrocher. */
  const [seen, setSeen] = useState(false);
  const [grain, setGrain] = useState<string | null>(null);
  /** Mise en pause quand l'onglet passe en arriere-plan. */
  const [paused, setPaused] = useState(false);
  /** Ecran tactile : sans clavier, il faut des boutons pour E et F. */
  const [isTouch, setIsTouch] = useState(false);
  /** Le carnet deplie mange un tiers d'un ecran de telephone : on le replie. */
  const [questOpen, setQuestOpen] = useState(true);

  const layoutRef = useRef<Layout>("azerty");
  const sensitivityRef = useRef(1.5);
  const heldRef = useRef({
    forward: false,
    back: false,
    left: false,
    right: false,
    sprint: false,
    breath: false,
  });
  const endedRef = useRef(false);
  const pausedRef = useRef(false);
  const keypadOpenRef = useRef(false);
  const bagOpenRef = useRef(false);
  const readingRef = useRef(false);
  const codeRef = useRef<number[]>([]);
  const apiRef = useRef<{
    unlock: () => void;
    deny: () => void;
    applyBrightness: (value: number) => void;
    /** Les memes actions que E, F, C et le clic, pour les boutons tactiles. */
    interact: () => void;
    toggleFlashlight: () => void;
    toggleCrouch: () => void;
    applyHeldItem: () => void;
    selectSlot: (index: number) => void;
    /** Reprendre apres une pause, meme si le navigateur a rate l'evenement de retour. */
    resume: () => void;
    readNote: (id: string) => void;
    /** Mode dev : se placer sur une case, sauter a l'etape suivante, tout recevoir. */
    devTeleport: (x: number, z: number) => void;
    devAdvance: () => void;
    devGiveAll: () => void;
  } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      layoutRef.current = loadLayout3D();
      sensitivityRef.current = loadSensitivity3D();
      setLoadedBrightness(loadBrightness3D());
      // Une tablette fait plus de 640 px de large : seul le type de pointeur
      // dit vraiment s'il faut afficher les commandes tactiles.
      const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
      setIsTouch(coarse);
      setQuestOpen(!coarse);
      setGrain(getGrainUrl());
      setScareImages({ face: makeScareFaceUrl(), hand: makeScareHandUrl() });
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    bagOpenRef.current = bagOpen;
  }, [bagOpen]);
  useEffect(() => {
    readingRef.current = readingNote !== null;
  }, [readingNote]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!endedRef.current && !pausedRef.current && !guideOpenRef.current) setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    keypadOpenRef.current = keypadOpen;
  }, [keypadOpen]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const data = buildManor();
    const wallSet = new Set(data.walls.map(([x, y]) => cellKey(x, y)));
    const propSet = new Set(data.blocked.map(([x, y]) => cellKey(x, y)));
    const doorCells = new Set<string>();
    for (let y = CAVE_DOOR.y0; y <= CAVE_DOOR.y1; y++) {
      for (let x = CAVE_DOOR.x0; x <= CAVE_DOOR.x1; x++) doorCells.add(cellKey(x, y));
    }
    let doorLocked = true;
    // Portes a cle : case -> identifiant de la porte, et celles deja ouvertes.
    const lockedDoorCells = new Map<string, string>();
    for (const ld of LOCKED_DOORS) {
      for (let y = ld.y0; y <= ld.y1; y++) {
        for (let x = ld.x0; x <= ld.x1; x++) lockedDoorCells.set(cellKey(x, y), ld.id);
      }
    }
    const openedDoorIds = new Set<string>();

    /** Murs et portes fermees : ce qui bloque tout le monde, sur toute la case. */
    function isHardSolid(cx: number, cy: number): boolean {
      if (cx < 0 || cy < 0 || cx >= data.width || cy >= data.height) return true;
      const k = cellKey(cx, cy);
      if (wallSet.has(k)) return true;
      if (doorLocked && doorCells.has(k)) return true;
      const door = lockedDoorCells.get(k);
      return door !== undefined && !openedDoorIds.has(door);
    }
    /**
     * Grille de l'IA et du placement : un meuble bloque toute sa case. Le
     * joueur, lui, ne heurte que l'emprise reelle du meuble (voir plus bas) —
     * c'etait la cause du mur invisible.
     */
    function isSolid(cx: number, cy: number): boolean {
      return isHardSolid(cx, cy) || propSet.has(cellKey(cx, cy));
    }

    // --- Meubles : geometrie affichee ET emprise au sol, tirees des memes boites ---
    const propInfo = data.props.map((prop) => ({ prop, ...propGeometry(prop, CELL_SIZE) }));
    const footprintsByCell = new Map<string, Footprint[]>();
    for (const { footprint } of propInfo) {
      if (!footprint) continue;
      for (let cz = Math.floor(footprint.z0); cz <= Math.floor(footprint.z1); cz++) {
        for (let cx = Math.floor(footprint.x0); cx <= Math.floor(footprint.x1); cx++) {
          const k = cellKey(cx, cz);
          const list = footprintsByCell.get(k);
          if (list) list.push(footprint);
          else footprintsByCell.set(k, [footprint]);
        }
      }
    }

    const openCells: [number, number][] = [];
    for (let y = 0; y < data.height; y++) {
      for (let x = 0; x < data.width; x++) {
        if (!isSolid(x, y)) openCells.push([x, y]);
      }
    }

    const start = data.start ?? [1, 1];
    const end = data.end ?? [data.width - 2, data.height - 2];

    // Cases atteignables depuis l'entree avec les portes dans leur etat
    // actuel. La chose n'erre que la-dedans : sans ca, elle choisissait une
    // case derriere une porte fermee et restait plantee devant.
    let reachableCells: [number, number][] = [];
    let reachableSet = new Set<string>();
    function refreshReachable() {
      const seen = new Set<string>([cellKey(start[0], start[1])]);
      const queue: [number, number][] = [[start[0], start[1]]];
      for (let qi = 0; qi < queue.length; qi++) {
        const [x, y] = queue[qi];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = x + dx;
          const ny = y + dy;
          const k = cellKey(nx, ny);
          if (seen.has(k) || isSolid(nx, ny)) continue;
          seen.add(k);
          queue.push([nx, ny]);
        }
      }
      reachableSet = seen;
      reachableCells = queue;
    }
    refreshReachable();

    /** La case libre la plus proche : un but d'IA tombe parfois dans un meuble. */
    function nearestOpenCell(cx: number, cy: number, maxRadius = 4): [number, number] | null {
      if (!isSolid(cx, cy)) return [cx, cy];
      for (let r = 1; r <= maxRadius; r++) {
        let best: [number, number] | null = null;
        let bestD = Infinity;
        for (let y = cy - r; y <= cy + r; y++) {
          for (let x = cx - r; x <= cx + r; x++) {
            if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r || isSolid(x, y)) continue;
            const d = (x - cx) ** 2 + (y - cy) ** 2;
            if (d < bestD) {
              bestD = d;
              best = [x, y];
            }
          }
        }
        if (best) return best;
      }
      return null;
    }

    // Le joueur regarde vers l'escalier en arrivant (la piece maitresse).
    const player = { x: start[0] + 0.5, z: start[1] + 0.5, yaw: Math.PI, pitch: 0 };

    // --- Code de la cave : un chiffre tire au sort par plaque ---
    const code = CLUE_SPOTS.map(() => 1 + Math.floor(Math.random() * 9));
    codeRef.current = code;

    // --- Objets ramassables : les fixes, plus un tirage parmi les emplacements ---
    const chosenPickups: PickupSpot[] = PICKUP_SPOTS.filter((s) => s.fixed);
    for (const [kind, count] of Object.entries(PICKUP_RANDOM_COUNT) as [PickupKind, number][]) {
      const pool = PICKUP_SPOTS.filter((s) => !s.fixed && s.kind === kind);
      for (let i = 0; i < count && pool.length > 0; i++) {
        chosenPickups.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      }
    }
    const pickupCellKeys = new Set(PICKUP_SPOTS.map((s) => cellKey(s.x, s.y)));

    // --- Reliques : une toujours dans la Chambre condamnee (la cle de la
    // Crypte devient indispensable), les autres au hasard hors des pieces
    // fermees et de la cave. ---
    const lockedRoomRects = data.rooms.filter((r) => LOCKED_ROOMS.includes(r.name));
    const candidateCells = reachableCells.filter(([x, y]) => {
      if (Math.abs(x - start[0]) + Math.abs(y - start[1]) <= 4) return false;
      if (pickupCellKeys.has(cellKey(x, y))) return false;
      if (DOLL_SPOTS.some((d) => Math.abs(d.x - x) + Math.abs(d.y - y) <= 1)) return false;
      return !lockedRoomRects.some((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);
    });
    const itemCells: [number, number][] = [[LOCKED_RELIC_SPOT.x, LOCKED_RELIC_SPOT.y]];
    const pool = [...candidateCells];
    while (itemCells.length < ITEM_COUNT && pool.length > 0) {
      const [x, y] = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      // Pas deux reliques dans la meme piece : on veut faire le tour du manoir.
      const room = roomAt(data.rooms, x, y);
      if (itemCells.some(([ix, iy]) => roomAt(data.rooms, ix, iy) === room) && pool.length > 12) continue;
      itemCells.push([x, y]);
    }
    const shuffledItemDefs = [...MANOR_ITEMS].sort(() => Math.random() - 0.5);

    // --- Monstre : la case atteignable la plus eloignee du joueur ---
    let monsterStart: [number, number] = end;
    let bestMonsterDist = -1;
    for (const [x, y] of candidateCells) {
      const d = Math.abs(x - start[0]) + Math.abs(y - start[1]);
      if (d > bestMonsterDist) {
        bestMonsterDist = d;
        monsterStart = [x, y];
      }
    }
    const monster = {
      x: monsterStart[0] + 0.5,
      z: monsterStart[1] + 0.5,
      path: null as [number, number][] | null,
      pathIndex: 0,
      repathTimer: 0,
      goalKey: "",
      active: false,
    };
    const brain = createBrain(0);
    const mapQuery: MapQuery = {
      randomOpenCell: (rng) => reachableCells[Math.floor(rng() * reachableCells.length)],
      randomOpenCellNear: (x, z, radius, rng) => {
        const near = reachableCells.filter(
          ([cx, cy]) => Math.hypot(cx + 0.5 - x, cy + 0.5 - z) <= radius,
        );
        return near.length > 0 ? near[Math.floor(rng() * near.length)] : null;
      },
    };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0806);
    scene.fog = new THREE.Fog(0x0a0806, 4.5 * CELL_SIZE, 16 * CELL_SIZE);

    const camera = new THREE.PerspectiveCamera(
      74,
      container.clientWidth / container.clientHeight,
      0.1,
      120,
    );
    camera.rotation.order = "YXZ";
    camera.position.set(player.x * CELL_SIZE, EYE_HEIGHT, player.z * CELL_SIZE);
    camera.rotation.y = player.yaw;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    // Plafond 1.5 : au-dela, sur un ecran haute densite on dessine 4x plus de
    // pixels pour une difference a peine visible dans un manoir aussi sombre.
    const PIXEL_RATIO_CAP = Math.min(window.devicePixelRatio || 1, 1.5);
    const PIXEL_RATIO_FLOOR = 0.6;
    let pixelRatio = PIXEL_RATIO_CAP;
    renderer.setPixelRatio(pixelRatio);
    container.appendChild(renderer.domElement);

    // Luminosite : modifiable en pleine partie via le panneau de reglages,
    // sans avoir a ressortir au lobby.
    let brightness = loadBrightness3D();
    // Lumiere d'ambiance (bon marche : aucune ombre a calculer). C'est elle
    // qui evite le noir total dans les pieces sans bougie.
    const hemi = new THREE.HemisphereLight(0x6a6478, 0x231c12, 1.3 * brightness);
    scene.add(hemi);

    const flashlight = new THREE.SpotLight(
      0xfff4d8,
      6.5 * brightness,
      16 * CELL_SIZE,
      Math.PI / 5,
      0.45,
      1.1,
    );
    const flashTarget = new THREE.Object3D();
    scene.add(flashTarget);
    flashlight.target = flashTarget;
    scene.add(flashlight);

    let glowOnIntensity = 0.85 * brightness;
    let glowOffIntensity = 0.32 * brightness;
    const playerGlow = new THREE.PointLight(0xffd9a8, glowOnIntensity, 4.5 * CELL_SIZE, 2);
    scene.add(playerGlow);

    // --- Poussiere en suspension ---
    // Un seul nuage de points qui suit le joueur en s'enroulant autour de lui
    // (modulo sur chaque axe) : ca donne l'impression d'une maison entiere
    // pleine de poussiere pour un seul appel de rendu. C'est surtout ce qui
    // rend le faisceau de la lampe VISIBLE, faute de volumetrique.
    const DUST_COUNT = 420;
    const DUST_BOX = 9 * CELL_SIZE;
    const DUST_HEIGHT = 3.4;
    const dustPositions = new Float32Array(DUST_COUNT * 3);
    const dustDrift = new Float32Array(DUST_COUNT);
    // Le nuage naît deja centre sur le joueur : sinon il met plusieurs
    // secondes a le rattraper case par case au demarrage.
    for (let i = 0; i < DUST_COUNT; i++) {
      dustPositions[i * 3] = player.x * CELL_SIZE + (Math.random() - 0.5) * DUST_BOX;
      dustPositions[i * 3 + 1] = Math.random() * DUST_HEIGHT;
      dustPositions[i * 3 + 2] = player.z * CELL_SIZE + (Math.random() - 0.5) * DUST_BOX;
      dustDrift[i] = 0.02 + Math.random() * 0.07;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xd8c9ac,
      size: 0.022,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    dust.frustumCulled = false;
    scene.add(dust);

    const GROUND_ROWS = STAIR_ROW_FIRST; // lignes 0..20 : rez-de-chaussee
    const UPPER_ROW_FIRST = STAIR_ROW_LAST + 1; // ligne 27 : palier

    // --- Sols ---
    const floorMat = new THREE.MeshLambertMaterial({
      map: makeManorFloorTexture(data.width, GROUND_ROWS),
    });
    const groundFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(data.width * CELL_SIZE, GROUND_ROWS * CELL_SIZE),
      floorMat,
    );
    groundFloor.rotation.x = -Math.PI / 2;
    groundFloor.position.set((data.width * CELL_SIZE) / 2, 0, (GROUND_ROWS * CELL_SIZE) / 2);
    scene.add(groundFloor);

    const upperRows = data.height - UPPER_ROW_FIRST;
    const upperFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(data.width * CELL_SIZE, upperRows * CELL_SIZE),
      new THREE.MeshLambertMaterial({ map: makeManorFloorTexture(data.width, upperRows) }),
    );
    upperFloor.rotation.x = -Math.PI / 2;
    upperFloor.position.set(
      (data.width * CELL_SIZE) / 2,
      UPPER_Y,
      (UPPER_ROW_FIRST + upperRows / 2) * CELL_SIZE,
    );
    scene.add(upperFloor);

    // --- Marches de l'escalier (vraies boites : on monte dessus pour de bon) ---
    const STEP_COUNT = 14;
    const stairSpan = UPPER_ROW_FIRST - STAIR_ROW_FIRST;
    const stairWidth = (STAIR_X1 - STAIR_X0 + 1) * CELL_SIZE;
    const stepDepth = (stairSpan * CELL_SIZE) / STEP_COUNT;
    const stepMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(stairWidth, 1, stepDepth),
      new THREE.MeshLambertMaterial({ color: 0x2f2113 }),
      STEP_COUNT,
    );
    const stepMatrix = new THREE.Matrix4();
    for (let i = 0; i < STEP_COUNT; i++) {
      const zFront = STAIR_ROW_FIRST + ((i + 1) * stairSpan) / STEP_COUNT;
      const top = floorHeightAt(zFront);
      const zCenter = (STAIR_ROW_FIRST + ((i + 0.5) * stairSpan) / STEP_COUNT) * CELL_SIZE;
      stepMatrix.compose(
        new THREE.Vector3(((STAIR_X0 + STAIR_X1 + 1) / 2) * CELL_SIZE, top / 2, zCenter),
        new THREE.Quaternion(),
        new THREE.Vector3(1, Math.max(top, 0.02), 1),
      );
      stepMesh.setMatrixAt(i, stepMatrix);
    }
    scene.add(stepMesh);

    // Rampes de l'escalier
    const railMat = new THREE.MeshLambertMaterial({ color: 0x33240f });
    for (const side of [STAIR_X0, STAIR_X1 + 1]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.1, Math.hypot(stairSpan * CELL_SIZE, UPPER_Y)),
        railMat,
      );
      rail.position.set(
        side * CELL_SIZE,
        UPPER_Y / 2 + 0.95,
        (STAIR_ROW_FIRST + stairSpan / 2) * CELL_SIZE,
      );
      rail.rotation.x = -Math.atan2(UPPER_Y, stairSpan * CELL_SIZE);
      scene.add(rail);
    }

    // --- Plafonds : un au rez, un plus haut au-dessus de la cage d'escalier ---
    const groundCeiling = new THREE.Mesh(
      new THREE.PlaneGeometry(data.width * CELL_SIZE, GROUND_ROWS * CELL_SIZE),
      new THREE.MeshLambertMaterial({ map: makeCeilingTexture(data.width, GROUND_ROWS) }),
    );
    groundCeiling.rotation.x = Math.PI / 2;
    groundCeiling.position.set(
      (data.width * CELL_SIZE) / 2,
      CEILING_HEIGHT,
      (GROUND_ROWS * CELL_SIZE) / 2,
    );
    scene.add(groundCeiling);

    const upperCeilRows = data.height - STAIR_ROW_FIRST;
    const upperCeiling = new THREE.Mesh(
      new THREE.PlaneGeometry(data.width * CELL_SIZE, upperCeilRows * CELL_SIZE),
      new THREE.MeshLambertMaterial({ map: makeCeilingTexture(data.width, upperCeilRows) }),
    );
    upperCeiling.rotation.x = Math.PI / 2;
    upperCeiling.position.set(
      (data.width * CELL_SIZE) / 2,
      UPPER_Y + CEILING_HEIGHT,
      (STAIR_ROW_FIRST + upperCeilRows / 2) * CELL_SIZE,
    );
    scene.add(upperCeiling);

    // --- Murs : empiles en hauteur au-dela de la ligne de l'escalier pour
    // fermer la cage et l'etage sans etirer la texture. ---
    const wallCells: [number, number][] = [...data.walls];
    for (let x = -1; x <= data.width; x++) {
      wallCells.push([x, -1]);
      wallCells.push([x, data.height]);
    }
    for (let y = 0; y < data.height; y++) {
      wallCells.push([-1, y]);
      wallCells.push([data.width, y]);
    }
    const wallPlacements: [number, number, number][] = [];
    for (const [wx, wy] of wallCells) {
      const stacks = wy >= STAIR_ROW_FIRST ? 3 : 1;
      for (let s = 0; s < stacks; s++) {
        wallPlacements.push([wx, wy, 1.3 + s * CEILING_HEIGHT]);
      }
    }
    const wallMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(CELL_SIZE, CEILING_HEIGHT, CELL_SIZE),
      new THREE.MeshLambertMaterial({ map: makeManorWallTexture() }),
      wallPlacements.length,
    );
    const m = new THREE.Matrix4();
    wallPlacements.forEach(([wx, wy, wyPos], i) => {
      m.makeTranslation((wx + 0.5) * CELL_SIZE, wyPos, (wy + 0.5) * CELL_SIZE);
      wallMesh.setMatrixAt(i, m);
    });
    scene.add(wallMesh);

    // --- Meubles : une seule InstancedMesh teintee par instance ---
    const propBoxes: PropBox[] = propInfo.flatMap((info) => info.boxes);
    const furnitureMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ map: makeWoodTexture() }),
      propBoxes.length,
    );
    const tmpColor = new THREE.Color();
    propBoxes.forEach((b, i) => {
      m.compose(
        new THREE.Vector3(b.x, b.y, b.z),
        new THREE.Quaternion(),
        new THREE.Vector3(b.w, b.h, b.d),
      );
      furnitureMesh.setMatrixAt(i, m);
      furnitureMesh.setColorAt(i, tmpColor.setHex(b.color));
    });
    scene.add(furnitureMesh);

    // --- Bougies murales (peu nombreuses : chaque lumiere coute cher) ---
    const sconces: {
      light: THREE.PointLight;
      flame: THREE.Mesh;
      base: number;
      phase: number;
      dead: boolean;
    }[] = [];
    const MAX_SCONCES = 5;
    const wallAdjacent: { cell: [number, number]; dir: [number, number] }[] = [];
    for (const [cx, cy] of openCells) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
        if (isSolid(cx + dx, cy + dy)) {
          wallAdjacent.push({ cell: [cx, cy], dir: [dx, dy] });
          break;
        }
      }
    }
    const sconceStep = Math.max(1, Math.floor(wallAdjacent.length / MAX_SCONCES));
    const sconceSpots = wallAdjacent.filter((_, i) => i % sconceStep === 0).slice(0, MAX_SCONCES);
    const bracketGeo = new THREE.BoxGeometry(0.08, 0.08, 0.3);
    const bracketMat = new THREE.MeshLambertMaterial({ color: 0x120d08 });
    const candleGeo = new THREE.CylinderGeometry(0.035, 0.04, 0.22, 6);
    const candleMat = new THREE.MeshLambertMaterial({ color: 0xd9cba8 });
    const flameGeo = new THREE.SphereGeometry(0.055, 8, 8);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffc06a });
    for (const { cell, dir } of sconceSpots) {
      const px = (cell[0] + 0.5 + dir[0] * 0.38) * CELL_SIZE;
      const py = floorHeightAt(cell[1] + 0.5) + 1.85;
      const pz = (cell[1] + 0.5 + dir[1] * 0.38) * CELL_SIZE;
      const light = new THREE.PointLight(0xff9a4d, 0, 4 * CELL_SIZE, 2);
      light.position.set(px, py, pz);
      scene.add(light);
      const bracket = new THREE.Mesh(bracketGeo, bracketMat);
      bracket.position.set(px, py - 0.16, pz);
      if (dir[0] !== 0) bracket.rotation.y = Math.PI / 2;
      scene.add(bracket);
      const candle = new THREE.Mesh(candleGeo, candleMat);
      candle.position.set(px, py - 0.02, pz);
      scene.add(candle);
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(px, py + 0.15, pz);
      scene.add(flame);
      sconces.push({
        light,
        flame,
        base: (0.75 + Math.random() * 0.25) * brightness,
        phase: Math.random() * 10,
        dead: false,
      });
    }

    // --- Tableaux ---
    const PAINTING_SPOTS: { x: number; wallRow: number; room: string }[] = [
      { x: 6, wallRow: 0, room: "Bureau" },
      { x: 12, wallRow: 0, room: "Bibliothèque" },
      { x: 19, wallRow: 0, room: "Chambre principale" },
      { x: 6, wallRow: 7, room: "Salon" },
      { x: 14, wallRow: 7, room: "Grand hall" },
      { x: 22, wallRow: 7, room: "Cuisine" },
      { x: 6, wallRow: 14, room: "Salle à manger" },
      { x: 10, wallRow: 14, room: "Entrée" },
      { x: 22, wallRow: 14, room: "Cave" },
      // x 13 tombait pile dans l'ouverture de l'escalier : le tableau flottait.
      { x: 15, wallRow: 26, room: "Palier" },
      { x: 5, wallRow: 26, room: "Chambre d'enfant" },
    ];
    const paintingTextures = [makePaintingTexture(0), makePaintingTexture(1), makePaintingTexture(2)];
    const paintingGeo = new THREE.PlaneGeometry(0.85, 1.05);
    const paintingsByRoom = new Map<string, THREE.Mesh>();
    PAINTING_SPOTS.forEach((spot, i) => {
      const mat = new THREE.MeshLambertMaterial({
        map: paintingTextures[i % paintingTextures.length],
      });
      const painting = new THREE.Mesh(paintingGeo, mat);
      const baseY = floorHeightAt(spot.wallRow + 1.5);
      painting.position.set(
        (spot.x + 0.5) * CELL_SIZE,
        baseY + 1.55,
        (spot.wallRow + 1) * CELL_SIZE + 0.03,
      );
      scene.add(painting);
      paintingsByRoom.set(spot.room, painting);
    });

    // --- Plaques gravees : les 3 chiffres du code ---
    const plaqueGeo = new THREE.PlaneGeometry(0.62, 0.47);
    const cluePlaques = CLUE_SPOTS.map((spot, i) => {
      const mesh = new THREE.Mesh(
        plaqueGeo,
        // Non eclairee : lisible meme lampe eteinte, sinon on ne les trouve jamais.
        new THREE.MeshBasicMaterial({ map: makeCluePlaqueTexture(i, code[i]) }),
      );
      const baseY = floorHeightAt(spot.wallRow + 1.5);
      mesh.position.set(
        (spot.x + 0.5) * CELL_SIZE,
        baseY + 1.5,
        (spot.wallRow + 1) * CELL_SIZE + 0.04,
      );
      scene.add(mesh);
      return { mesh, x: spot.x + 0.5, z: spot.wallRow + 1.5, rank: i, digit: code[i], room: spot.room, found: false };
    });

    // --- Porte verrouillee de la cave (deux battants sur charnieres) ---
    const doorTex = makeDoorTexture();
    const doorMat = new THREE.MeshLambertMaterial({ map: doorTex });
    const doorLeafGeo = new THREE.BoxGeometry(0.14, 2.35, CELL_SIZE);
    const doorHinges: THREE.Group[] = [];
    [CAVE_DOOR.y0, CAVE_DOOR.y1 + 1].forEach((hingeRow, i) => {
      const hinge = new THREE.Group();
      hinge.position.set((CAVE_DOOR.x0 + 0.5) * CELL_SIZE, 1.18, hingeRow * CELL_SIZE);
      const leaf = new THREE.Mesh(doorLeafGeo, doorMat);
      leaf.position.z = (i === 0 ? 1 : -1) * (CELL_SIZE / 2);
      hinge.add(leaf);
      scene.add(hinge);
      doorHinges.push(hinge);
    });
    const doorCenter = { x: CAVE_DOOR.x0 + 0.5, z: (CAVE_DOOR.y0 + CAVE_DOOR.y1 + 1) / 2 };
    let doorSwing = 0;

    // --- Portes fermees a cle : memes battants, et un cadenas qui brille ---
    const doorLeafGeoX = new THREE.BoxGeometry(CELL_SIZE, 2.35, 0.14);
    const padlockGeo = new THREE.BoxGeometry(0.16, 0.2, 0.26);
    const padlockMat = new THREE.MeshBasicMaterial({ color: 0xb8892f });
    const keyDoors = LOCKED_DOORS.map((def) => {
      const vertical = def.x0 === def.x1;
      const baseY = floorHeightAt((def.y0 + def.y1) / 2 + 0.5);
      const hinges: THREE.Group[] = [];
      if (vertical) {
        [def.y0, def.y1 + 1].forEach((row, i) => {
          const hinge = new THREE.Group();
          hinge.position.set((def.x0 + 0.5) * CELL_SIZE, baseY + 1.18, row * CELL_SIZE);
          const leaf = new THREE.Mesh(doorLeafGeo, doorMat);
          leaf.position.z = (i === 0 ? 1 : -1) * (CELL_SIZE / 2);
          hinge.add(leaf);
          scene.add(hinge);
          hinges.push(hinge);
        });
      } else {
        [def.x0, def.x1 + 1].forEach((col, i) => {
          const hinge = new THREE.Group();
          hinge.position.set(col * CELL_SIZE, baseY + 1.18, (def.y0 + 0.5) * CELL_SIZE);
          const leaf = new THREE.Mesh(doorLeafGeoX, doorMat);
          leaf.position.x = (i === 0 ? 1 : -1) * (CELL_SIZE / 2);
          hinge.add(leaf);
          scene.add(hinge);
          hinges.push(hinge);
        });
      }
      const center = vertical
        ? { x: def.x0 + 0.5, z: (def.y0 + def.y1 + 1) / 2 }
        : { x: (def.x0 + def.x1 + 1) / 2, z: def.y0 + 0.5 };
      const padlock = new THREE.Mesh(padlockGeo, padlockMat);
      padlock.position.set(center.x * CELL_SIZE, baseY + 1.05, center.z * CELL_SIZE);
      // Le cadenas doit depasser des deux faces du battant, donc suivre son epaisseur.
      if (vertical) padlock.rotation.y = Math.PI / 2;
      scene.add(padlock);
      return { def, hinges, center, padlock, swing: 0, open: false };
    });

    // --- Tapis ---
    const rugTexture = makeRugTexture();
    const rugGeo = new THREE.PlaneGeometry(4.8 * CELL_SIZE, 4.6 * CELL_SIZE);
    const rugMat = new THREE.MeshLambertMaterial({ map: rugTexture });
    for (const roomY0 of [8, 15]) {
      const rug = new THREE.Mesh(rugGeo, rugMat);
      rug.rotation.x = -Math.PI / 2;
      rug.position.set(12 * CELL_SIZE, 0.012, (roomY0 + 2.5) * CELL_SIZE);
      scene.add(rug);
    }

    // --- Trappe de sortie : invisible jusqu'au rituel ---
    const hatchGroup = new THREE.Group();
    const hatchFrame = new THREE.Mesh(
      new THREE.BoxGeometry(CELL_SIZE * 0.9, 0.1, CELL_SIZE * 0.9),
      new THREE.MeshLambertMaterial({ color: 0x2a2118 }),
    );
    hatchGroup.add(hatchFrame);
    // Rectangle non eclaire : dans le noir de la cave, c'est le seul repere.
    const hatchGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(CELL_SIZE * 0.66, CELL_SIZE * 0.66),
      new THREE.MeshBasicMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.75 }),
    );
    hatchGlow.rotation.x = -Math.PI / 2;
    hatchGlow.position.y = 0.07;
    hatchGroup.add(hatchGlow);
    hatchGroup.position.set((HATCH.x + 0.5) * CELL_SIZE, 0.03, (HATCH.y + 0.5) * CELL_SIZE);
    hatchGroup.visible = false;
    scene.add(hatchGroup);
    // Chaines qui scellent la trappe : elles tombent une par une avec les sceaux.
    const hatchChains = [-1, 0, 1].map((i) => {
      const chain = new THREE.Mesh(
        new THREE.BoxGeometry(CELL_SIZE * 1.05, 0.09, 0.14),
        new THREE.MeshLambertMaterial({ color: 0x5a5148 }),
      );
      chain.position.set(0, 0.14, i * 0.4);
      hatchGroup.add(chain);
      return chain;
    });

    // --- Les trois sceaux : braseros de pierre aux quatre coins du manoir ---
    // Ils n'apparaissent qu'apres le rituel, quand les bougies sont mortes :
    // leurs 3 lumieres reprennent exactement le budget libere.
    const sealStoneMat = new THREE.MeshLambertMaterial({ color: 0x38332d });
    const sealGlowGeo = new THREE.SphereGeometry(0.2, 10, 10);
    const seals = SEALS.map((spot) => {
      const group = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5), sealStoneMat);
      base.position.y = 0.08;
      group.add(base);
      const column = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.85, 0.3), sealStoneMat);
      column.position.y = 0.58;
      group.add(column);
      const bowl = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.46), sealStoneMat);
      bowl.position.y = 1.06;
      group.add(bowl);
      const glowMat = new THREE.MeshBasicMaterial({ color: 0x8be9ff });
      const glow = new THREE.Mesh(sealGlowGeo, glowMat);
      glow.position.y = 1.22;
      group.add(glow);
      group.position.set(
        (spot.x + 0.5) * CELL_SIZE,
        floorHeightAt(spot.y + 0.5),
        (spot.y + 0.5) * CELL_SIZE,
      );
      group.visible = false;
      scene.add(group);
      return {
        group,
        glow,
        glowMat,
        /** Lumiere empruntee a une bougie morte, attribuee a l'acte V. */
        light: null as THREE.PointLight | null,
        x: spot.x + 0.5,
        z: spot.y + 0.5,
        room: spot.room,
        broken: false,
      };
    });

    // --- Les 5 objets offerts sur l'autel pendant le rituel ---
    const altarCenter = {
      x: (ALTAR.x0 + ALTAR.x1 + 1) / 2,
      z: (ALTAR.y0 + ALTAR.y1 + 1) / 2,
    };
    const offeringGroup = new THREE.Group();
    const offeringMat = new THREE.MeshBasicMaterial({ color: 0xffd79a, side: THREE.DoubleSide });
    for (let i = 0; i < ITEM_COUNT; i++) {
      const a = (i / ITEM_COUNT) * Math.PI * 2;
      const offering = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), offeringMat);
      offering.position.set(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5);
      offeringGroup.add(offering);
    }
    offeringGroup.position.set(altarCenter.x * CELL_SIZE, 1.1, altarCenter.z * CELL_SIZE);
    offeringGroup.visible = false;
    scene.add(offeringGroup);

    // --- Poupees de la quete secondaire ---
    const dolls = buildDolls(
      DOLL_SPOTS.map((spot) => ({
        x: spot.x + 0.5,
        z: spot.y + 0.5,
        floorY: floorHeightAt(spot.y + 0.5),
      })),
      CELL_SIZE,
    );
    scene.add(dolls.group);
    const dollTaken = DOLL_SPOTS.map(() => false);
    let dollCount = 0;
    /** Les cinq trouvees : plus rapide, et protege une fois. */
    let dollBlessing = false;
    let shieldReady = false;
    let shieldGraceUntil = -1;

    // --- Objets a ramasser ---
    const items = itemCells.map(([nx, ny], i) => {
      const def = shuffledItemDefs[i % shuffledItemDefs.length];
      const group = new THREE.Group();
      const paper = new THREE.Mesh(
        new THREE.PlaneGeometry(0.24, 0.24),
        new THREE.MeshBasicMaterial({ color: 0xe8c98a, side: THREE.DoubleSide }),
      );
      group.add(paper);
      group.position.set(
        (nx + 0.5) * CELL_SIZE,
        floorHeightAt(ny + 0.5) + 1.05,
        (ny + 0.5) * CELL_SIZE,
      );
      scene.add(group);
      return { x: nx + 0.5, z: ny + 0.5, group, collected: false, def };
    });

    // --- Objets ramassables ---
    // Une InstancedMesh par apparence : trente objets, six appels de rendu.
    // Materiaux non eclaires : un objet qu'on ne voit pas dans le noir est un
    // objet qu'on ne trouve jamais.
    const pickupLooks: Record<PickupVisual, { geo: THREE.BufferGeometry; mat: THREE.Material }> = {
      coin: {
        geo: new THREE.CylinderGeometry(0.075, 0.075, 0.018, 14).rotateX(Math.PI / 2),
        mat: new THREE.MeshBasicMaterial({ color: 0xd9a93f }),
      },
      battery: {
        geo: new THREE.CylinderGeometry(0.05, 0.05, 0.17, 8),
        mat: new THREE.MeshBasicMaterial({ color: 0x86e57f }),
      },
      salt: {
        geo: new THREE.SphereGeometry(0.08, 8, 6).scale(1, 0.8, 1),
        mat: new THREE.MeshBasicMaterial({ color: 0xe9e4d6 }),
      },
      musicbox: {
        geo: new THREE.BoxGeometry(0.22, 0.13, 0.15),
        mat: new THREE.MeshBasicMaterial({ color: 0x9a6534 }),
      },
      key: {
        geo: new THREE.BoxGeometry(0.22, 0.04, 0.06),
        mat: new THREE.MeshBasicMaterial({ color: 0xf0c75a }),
      },
      note: {
        geo: new THREE.PlaneGeometry(0.2, 0.26),
        mat: new THREE.MeshBasicMaterial({ color: 0xeadcb8, side: THREE.DoubleSide }),
      },
    };
    const pickups = chosenPickups.map((spot, i) => ({
      spot,
      visual: visualOf(spot.kind),
      x: spot.x + 0.5,
      z: spot.y + 0.5,
      phase: i * 0.7,
      taken: false,
      /** Index dans l'InstancedMesh de son apparence. */
      slot: 0,
    }));
    const pickupMeshes = {} as Record<PickupVisual, THREE.InstancedMesh>;
    for (const visual of Object.keys(pickupLooks) as PickupVisual[]) {
      const own = pickups.filter((p) => p.visual === visual);
      own.forEach((p, k) => (p.slot = k));
      const mesh = new THREE.InstancedMesh(pickupLooks[visual].geo, pickupLooks[visual].mat, Math.max(1, own.length));
      mesh.count = own.length;
      // Les objets tournent sur place : la sphere englobante de depart ne suffit pas.
      mesh.frustumCulled = false;
      scene.add(mesh);
      pickupMeshes[visual] = mesh;
    }
    const pickupMatrix = new THREE.Matrix4();
    const pickupQuat = new THREE.Quaternion();
    const pickupEuler = new THREE.Euler();
    const pickupPos = new THREE.Vector3();
    const pickupScale = new THREE.Vector3();
    function writePickup(p: (typeof pickups)[number]) {
      const floor = floorHeightAt(p.z);
      if (p.taken) {
        pickupMatrix.compose(pickupPos.set(0, -20, 0), pickupQuat.identity(), pickupScale.set(0, 0, 0));
      } else {
        const bob = Math.sin(elapsed * 2 + p.phase) * 0.035;
        // La note se presente de face et se balance ; le reste tourne.
        if (p.visual === "note") pickupEuler.set(-0.35, Math.sin(elapsed * 0.8 + p.phase) * 0.6, 0);
        else pickupEuler.set(p.visual === "key" ? 0.4 : 0, elapsed * 1.4 + p.phase, 0);
        pickupQuat.setFromEuler(pickupEuler);
        pickupMatrix.compose(
          pickupPos.set(p.x * CELL_SIZE, floor + 0.82 + bob, p.z * CELL_SIZE),
          pickupQuat,
          pickupScale.set(1, 1, 1),
        );
      }
      pickupMeshes[p.visual].setMatrixAt(p.slot, pickupMatrix);
    }

    // --- Cachettes : armoires (debout) et lits (on se glisse dessous) ---
    const hideouts = propInfo
      .filter((info) => info.footprint && HIDEOUT_KINDS.includes(info.prop.kind))
      .map(({ prop, footprint }) => ({
        kind: (prop.kind === "bed" ? "bed" : "wardrobe") as "wardrobe" | "bed",
        prop,
        fp: footprint!,
        x: (prop.x0 + prop.x1) / 2 + 0.5,
        z: (prop.y0 + prop.y1) / 2 + 0.5,
      }));
    type Hideout = (typeof hideouts)[number];

    // --- Monstre ---
    const beast = buildMonster();
    const monsterGroup = beast.group;
    const face = beast.face;
    monsterGroup.position.set(monster.x * CELL_SIZE, 0, monster.z * CELL_SIZE);
    monsterGroup.visible = false;
    scene.add(monsterGroup);
    /** Lacet du corps : il suit la marche, pas le joueur. La tete, si. */
    let bodyYaw = 0;
    let monsterWalk = 0;
    let lungeLevel = 0;

    // --- Main tenant la lampe torche ---
    scene.add(camera);
    const handGroup = new THREE.Group();
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xb08968 });
    const metalMat = new THREE.MeshLambertMaterial({ color: 0x2e3236 });
    const torchBody = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.34, 10), metalMat);
    torchBody.rotation.x = Math.PI / 2;
    torchBody.position.set(0, 0, -0.1);
    handGroup.add(torchBody);
    const torchHead = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.05, 0.11, 10), metalMat);
    torchHead.rotation.x = Math.PI / 2;
    torchHead.position.set(0, 0, -0.32);
    handGroup.add(torchHead);
    const torchLens = new THREE.Mesh(
      new THREE.CircleGeometry(0.068, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff0c8 }),
    );
    torchLens.position.set(0, 0, -0.375);
    handGroup.add(torchLens);
    const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.11, 4, 8), skinMat);
    palm.rotation.z = Math.PI / 2;
    palm.position.set(0.005, -0.035, 0.02);
    handGroup.add(palm);
    const fingerGeo = new THREE.CapsuleGeometry(0.019, 0.075, 4, 6);
    for (let i = 0; i < 4; i++) {
      const finger = new THREE.Mesh(fingerGeo, skinMat);
      finger.rotation.x = Math.PI / 2;
      finger.rotation.z = 0.15;
      finger.position.set(-0.035 + i * 0.028, 0.012, -0.01);
      handGroup.add(finger);
    }
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.021, 0.06, 4, 6), skinMat);
    thumb.rotation.z = Math.PI / 2.6;
    thumb.position.set(0.055, -0.03, -0.05);
    handGroup.add(thumb);
    const HAND_BASE = new THREE.Vector3(0.3, -0.27, -0.62);
    handGroup.position.copy(HAND_BASE);
    handGroup.rotation.set(0.06, -0.12, 0.05);
    handGroup.scale.setScalar(0.82);
    camera.add(handGroup);

    // --- Audio ---
    const audio = createAudio();
    // Le narrateur : il annonce chaque acte et commente le final. Coupable
    // depuis le panneau de reglages, et muet si le navigateur n'a pas de voix.
    let elapsed = 0;
    let nextHeartbeatAt = 2;
    let nextStingerAt = 14 + Math.random() * 10;
    let nextNearMissAllowedAt = 0;
    let nextFootstepAt = 0;
    let nextCreakAt = 0;
    let flashLevel = 0;
    let lastSyncedFlash = 0;
    let currentRoomName: string | null = null;
    let roomLabelHideAt = -1;
    let toastHideAt = -1;
    let hintHideAt = -1;
    let collectedCount = 0;
    let walkPhase = 0;

    // --- Animations ---
    /** Balancement de la marche, lisse : il monte et redescend au lieu de claquer. */
    let bobAmount = 0;
    /** Instants des gestes de la main ; -1 quand aucun geste n'est en cours. */
    let torchToggleAt = -1;
    let reachAt = -1;
    /** Glissement de la camera quand on entre dans une armoire ou qu'on en sort. */
    let camSlideFrom: { x: number; z: number } | null = null;
    let camSlideAt = -1;
    /** Objets ramasses qui volent jusqu'a la main avant de disparaitre. */
    const flyers: { obj: THREE.Object3D; from: THREE.Vector3; at: number; baseScale: number }[] = [];
    /** Eclats des sceaux brises, soumis a la gravite. */
    const shards: { mesh: THREE.Mesh; vx: number; vy: number; vz: number; at: number }[] = [];
    /** Chaines qui glissent de la trappe quand un sceau cede. */
    const fallingChains: { mesh: THREE.Mesh; at: number; side: number }[] = [];
    const shardGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
    const shardMat = new THREE.MeshBasicMaterial({ color: 0x8be9ff });
    const handTarget = new THREE.Vector3();

    /** Au lieu de faire disparaitre un objet, on le laisse voler jusqu'a la main. */
    function flyToHand(obj: THREE.Object3D) {
      flyers.push({ obj, from: obj.position.clone(), at: elapsed, baseScale: obj.scale.x });
      reachAt = elapsed;
    }
    let lastPromptText: string | null = null;
    const visitedRooms = new Set<string>();
    let fallingPainting: THREE.Mesh | null = null;
    let fallStartAt = 0;
    let fallFromY = 0;
    let fallFromZ = 0;
    let dyingSince = -1;

    // --- Terreur : elle t'entend, tu l'entends, et la lampe le sait ---
    let losToMonster = false;
    let losTimer = 0;
    let distToMonster = 99;
    let nextWhisperAt = 0;
    let nextBreathAt = 0;
    let nextMonsterStepAt = 0;
    let nextSlamAt = 22 + Math.random() * 18;
    let nextGlimpseAt = 18 + Math.random() * 14;
    let glimpseUntil = -1;
    let dreadLevel = 0;
    let lastSyncedDread = 0;
    let lastSeen = false;
    let candlesOut = 0;
    let ritualStartedAt = -1;
    let chaseStartedAt = -1;
    let surviveStartedAt = -1;
    let escapeStartedAt = -1;
    let lastSurviveShown = -1;
    let guideTimer = 0;
    let lastGuideKind: "seal" | "monster" | "hatch" | null = null;
    /** Mode dev : hauteur de vol au-dessus du sol, et cadence de la carte. */
    let devFlyHeight = 0;
    let devSnapTimer = 0;
    const fog = scene.fog as THREE.Fog;
    const FOG_NEAR = fog.near;
    const FOG_FAR = fog.far;
    let phase: Phase = "none";
    let isHiding = false;
    let beforeHide = { x: 0, z: 0 };
    let lastQuestId = "";
    let lastQuestWhere: string | null = null;
    let actCardHideAt = -1;
    let torchFlicker = 1;

    // --- Corps du joueur : accroupi, course, souffle ---
    let crouching = false;
    /** 0 debout, 1 accroupi : lisse, pour que la camera descende au lieu de sauter. */
    let crouchLevel = 0;
    let staminaLevel = 100;
    let exhausted = false;
    let sprinting = false;
    let lastSyncedStamina = 100;
    let currentHideout: Hideout | null = null;
    let breathLeft = 1;
    let breathLocked = false;
    let wasHoldingBreath = false;
    let nextPlayerBreathAt = 0;
    let lastSyncedBreath = 1;
    let hideHintShown = false;

    // --- Bruit et cerveau de la chose ---
    let noises: Noise[] = [];
    let noiseLevel = 0;
    let lastSyncedNoise = 0;
    let thinkTimer = 0;
    let monsterMode: SpeedMode = "lent";
    let monsterState: BrainState = "errer";
    let monsterCanSee = false;
    let monsterStunUntil = -1;
    let nextGrowlAt = 0;

    // --- Inventaire et objets en jeu ---
    let inv: Inventory = emptyInventory();
    const thrownCoins: {
      mesh: THREE.Mesh;
      fromX: number;
      fromZ: number;
      fromY: number;
      toX: number;
      toZ: number;
      at: number;
      duration: number;
      landed: boolean;
    }[] = [];
    const musicBoxes: {
      mesh: THREE.Mesh;
      x: number;
      z: number;
      until: number;
      nextNoiseAt: number;
      sound: MusicBoxSound;
    }[] = [];
    const saltMat = new THREE.MeshBasicMaterial({ color: 0xf4f1ea });

    // --- Screamers ---
    const ghost = buildGhost();
    ghost.setOpacity(0);
    scene.add(ghost.group);
    let nextScareAt = 70 + Math.random() * 40;
    let ghostMode: "none" | "behind" | "front" = "none";
    let ghostSince = 0;
    let ghostX = 0;
    let ghostZ = 0;
    let ghostRushAt = -1;
    let lightsOutUntil = -1;
    let lightsOutWhisperAt = -1;
    let screamerHideAt = -1;
    let pendingHandScareAt = -1;
    const scaredRooms = new Set<string>();

    /** Rien entre nous deux ? C'est la qu'elle chuchote et qu'elle te voit. */
    function hasLineOfSight(ax: number, az: number, bx: number, bz: number): boolean {
      const steps = Math.ceil(Math.hypot(bx - ax, bz - az) * 2.5);
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        if (isSolid(Math.floor(ax + (bx - ax) * t), Math.floor(az + (bz - az) * t))) return false;
      }
      return true;
    }

    /** -1 a gauche, +1 a droite, relatif au regard du joueur. */
    function panFor(x: number, z: number): number {
      const dx = x - player.x;
      const dz = z - player.z;
      const len = Math.hypot(dx, dz) || 1;
      return THREE.MathUtils.clamp(
        (dx / len) * Math.cos(player.yaw) - (dz / len) * Math.sin(player.yaw),
        -1,
        1,
      );
    }
    function spatialFor(x: number, z: number, reach: number, loudness = 1) {
      const d = Math.hypot(x - player.x, z - player.z);
      return { pan: panFor(x, z), gain: Math.max(0, 1 - d / reach) * loudness };
    }
    function monsterSpatial(reach: number, loudness = 1) {
      return spatialFor(monster.x, monster.z, reach, loudness);
    }

    function showHint(text: string, seconds = 3.5) {
      setHint(text);
      hintHideAt = elapsed + seconds;
    }

    function awakenMonster() {
      if (monster.active) return;
      monster.active = true;
      monsterGroup.visible = true;
      flashLevel = Math.max(flashLevel, 0.55);
      playWake(audio.ctx, audio.master);
    }

    /** Applique une nouvelle luminosite a toutes les lumieres de la scene. */
    function applyBrightness(value: number) {
      const ratio = value / brightness;
      brightness = value;
      hemi.intensity = 1.3 * value;
      glowOnIntensity = 0.85 * value;
      glowOffIntensity = 0.32 * value;
      for (const s of sconces) s.base *= ratio;
    }

    // --- Screamers ---
    let frontGhostPending = false;

    /** Visage plein ecran, le temps d'un clignement. */
    function triggerFaceScare() {
      setScreamer("face");
      screamerHideAt = elapsed + 0.2;
      flashLevel = Math.max(flashLevel, 0.9);
      playScreamer(audio.ctx, audio.master);
      nextScareAt = Math.max(nextScareAt, elapsed + SCARE_COOLDOWN);
    }

    /** Un point libre, visible depuis le joueur, a `dist` cases dans une direction. */
    function spotAlong(dirX: number, dirZ: number, dist: number): { x: number; z: number } | null {
      const gx = player.x + dirX * dist;
      const gz = player.z + dirZ * dist;
      if (isSolid(Math.floor(gx), Math.floor(gz)) || circleBlocked(gx, gz, 0.3)) return null;
      if (!hasLineOfSight(player.x, player.z, gx, gz)) return null;
      return { x: gx, z: gz };
    }

    function placeGhost(x: number, z: number, rush: number) {
      ghostX = x;
      ghostZ = z;
      ghostSince = elapsed;
      ghost.setRush(rush);
      ghost.group.position.set(x * CELL_SIZE, floorHeightAt(z), z * CELL_SIZE);
      ghost.group.rotation.y = Math.atan2(player.x - x, player.z - z);
    }

    /**
     * Trois screamers qui tournent : la dame dans ton dos (quand tu te
     * retournes), la lampe qui meurt puis la dame devant toi, et le visage.
     * Jamais pendant le final, jamais cache, jamais avec la chose a moins de
     * neuf cases : ils ne doivent pas se meler a une vraie menace.
     */
    function updateScares(delta: number) {
      if (screamerHideAt >= 0 && elapsed > screamerHideAt) {
        screamerHideAt = -1;
        setScreamer(null);
      }
      if (pendingHandScareAt >= 0 && elapsed >= pendingHandScareAt) {
        pendingHandScareAt = -1;
        if (isHiding && currentHideout?.kind === "wardrobe") {
          setScreamer("hand");
          screamerHideAt = elapsed + 1.15;
          flashLevel = Math.max(flashLevel, 0.55);
          playScreamer(audio.ctx, audio.master);
        }
      }

      const lookX = -Math.sin(player.yaw);
      const lookZ = -Math.cos(player.yaw);

      if (ghostMode !== "none") {
        if (ghostRushAt >= 0) {
          // Elle se jette sur la camera, bras leves, bouche ouverte.
          const t = Math.min(1, (elapsed - ghostRushAt) / 0.3);
          const k = t * t;
          const gx = THREE.MathUtils.lerp(ghostX, player.x + lookX * 0.32, k);
          const gz = THREE.MathUtils.lerp(ghostZ, player.z + lookZ * 0.32, k);
          ghost.group.position.set(gx * CELL_SIZE, floorHeightAt(gz) - 0.4 * k, gz * CELL_SIZE);
          ghost.group.rotation.y = Math.atan2(-lookX, -lookZ);
          ghost.setRush(t);
          ghost.setOpacity(1);
          if (t >= 1) {
            ghostMode = "none";
            ghostRushAt = -1;
            ghost.setOpacity(0);
            flashLevel = 1;
          }
        } else if (ghostMode === "behind") {
          const age = elapsed - ghostSince;
          const dx = ghostX - player.x;
          const dz = ghostZ - player.z;
          const d = Math.hypot(dx, dz) || 1;
          const watched = (dx * lookX + dz * lookZ) / d > 0.78;
          ghost.setOpacity(Math.min(1, age / 0.5));
          ghost.group.rotation.y = Math.atan2(player.x - ghostX, player.z - ghostZ);
          if (watched && age > 0.35) {
            ghostRushAt = elapsed;
            playScreamer(audio.ctx, audio.master);
            flashLevel = Math.max(flashLevel, 0.8);
          } else if (age > 7 || isHiding || phase !== "none" || distToMonster < 6 || d > 4) {
            // Elle s'en va sans que tu l'aies vue. Tu ne sauras jamais.
            ghostMode = "none";
            ghost.setOpacity(0);
          }
        } else if (ghostMode === "front" && elapsed - ghostSince > 0.34) {
          ghostMode = "none";
          ghost.setOpacity(0);
        }
      }

      if (lightsOutWhisperAt >= 0 && elapsed >= lightsOutWhisperAt) {
        lightsOutWhisperAt = -1;
        playEarWhisper(audio.ctx, audio.master, Math.random() < 0.5 ? -0.9 : 0.9);
      }
      if (frontGhostPending && elapsed >= lightsOutUntil) {
        // La lumiere revient... et elle est la, juste devant.
        frontGhostPending = false;
        const spot = spotAlong(lookX, lookZ, 2.1);
        if (spot && !isHiding && dyingSince < 0) {
          placeGhost(spot.x, spot.z, 0.45);
          ghost.setOpacity(1);
          ghostMode = "front";
          playScreamer(audio.ctx, audio.master);
          flashLevel = Math.max(flashLevel, 0.85);
        }
      }

      const calm =
        phase === "none" &&
        !isHiding &&
        dyingSince < 0 &&
        !devRef.current.fly &&
        ghostMode === "none" &&
        elapsed >= lightsOutUntil &&
        !keypadOpenRef.current &&
        distToMonster > 9;
      if (!calm || elapsed < nextScareAt) return;
      const roll = Math.random();
      if (roll < 0.5) {
        const spot = spotAlong(-lookX, -lookZ, 1.7);
        if (!spot) {
          nextScareAt = elapsed + 3;
          return;
        }
        placeGhost(spot.x, spot.z, 0);
        ghost.setOpacity(0);
        ghostMode = "behind";
        // Un souffle dans ton dos : de quoi donner envie de se retourner.
        playWhisper(audio.ctx, audio.master, spatialFor(spot.x, spot.z, 6, 0.9));
      } else if (roll < 0.85 && flashlightState.on && flashlightState.battery > 10) {
        lightsOutUntil = elapsed + 2.6;
        lightsOutWhisperAt = elapsed + 1.1;
        frontGhostPending = true;
        playBulbDie(audio.ctx, audio.master);
      } else {
        triggerFaceScare();
      }
      nextScareAt = elapsed + SCARE_COOLDOWN + Math.random() * 45 + delta;
    }

    apiRef.current = {
      applyBrightness,
      interact,
      toggleFlashlight,
      toggleCrouch,
      applyHeldItem,
      selectSlot,
      resume,
      readNote: (id: string) => {
        const note = MANOR_NOTES.find((n) => n.id === id);
        if (note) setReadingNote(note);
      },
      devGiveAll: () => {
        if (!devAllowed) return;
        let next = inv;
        for (const [item, def] of Object.entries(ITEM_DEFS) as [UsableItem, (typeof ITEM_DEFS)[UsableItem]][]) {
          next = addItem(next, item, def.stack) ?? next;
        }
        for (const ld of LOCKED_DOORS) next = addKey(next, ld.key);
        for (const note of MANOR_NOTES) next = addNote(next, note.id);
        commitInventory(next);
        showHint("[DEV] Toutes les clés, les notes et des objets plein les poches.", 2.5);
      },
      devTeleport: (x: number, z: number) => {
        // Une carte pas encore mesuree renvoie NaN : la camera partait dans
        // le vide et l'ecran devenait noir.
        if (!devAllowed || !Number.isFinite(x) || !Number.isFinite(z)) return;
        let tx = Math.floor(x);
        let tz = Math.floor(z);
        // Case pleine (mur, meuble) : on prend la case libre la plus proche,
        // sauf si on traverse les murs de toute facon.
        if (isSolid(tx, tz) && !devRef.current.noclip && !devRef.current.fly) {
          let best: [number, number] | null = null;
          let bestD = Infinity;
          for (let cy = 0; cy < data.height; cy++) {
            for (let cx = 0; cx < data.width; cx++) {
              if (isSolid(cx, cy)) continue;
              const d = (cx - tx) ** 2 + (cy - tz) ** 2;
              if (d < bestD) {
                bestD = d;
                best = [cx, cy];
              }
            }
          }
          if (best) [tx, tz] = best;
        }
        if (isHiding) toggleHide();
        player.x = tx + 0.5;
        player.z = tz + 0.5;
      },
      devAdvance: () => {
        if (!devAllowed) return;
        // Une etape a la fois, dans l'ordre de la partie.
        if (cluePlaques.some((pl) => !pl.found)) {
          for (const pl of cluePlaques) pl.found = true;
          setClues(
            cluePlaques.map((pl) => ({ rank: pl.rank, digit: pl.digit, room: pl.room })),
          );
          showHint("[DEV] Toutes les plaques relevées.", 2.5);
        } else if (doorLocked) {
          apiRef.current?.unlock();
        } else if (collectedCount < ITEM_COUNT) {
          for (const item of items) {
            if (item.collected) continue;
            item.collected = true;
            collectedCount++;
            scene.remove(item.group);
          }
          for (const sc of sconces) {
            sc.dead = true;
            sc.light.intensity = 0;
            sc.flame.visible = false;
          }
          candlesOut = sconces.length;
          setItemsFound(collectedCount);
          setRelics(items.map((i) => i.def));
          awakenMonster();
          showHint("[DEV] Les 5 reliques en poche.", 2.5);
        } else if (phase === "none") {
          player.x = altarCenter.x;
          player.z = altarCenter.z - 1.2;
          startRitual();
        } else if (phase === "seals") {
          for (const seal of seals) {
            seal.broken = true;
            if (seal.light) seal.light.intensity = 0;
            seal.glowMat.color.setHex(0x2b2724);
          }
          for (const chain of hatchChains) chain.scale.set(1, 0.001, 1);
          setSealsLeft(0);
        } else if (phase === "survive") {
          surviveStartedAt = elapsed - SURVIVE_SECONDS;
        } else if (phase === "escape") {
          player.x = HATCH.x + 0.5;
          player.z = HATCH.y + 0.5;
        }
      },
      unlock: () => {
        if (!doorLocked) return;
        doorLocked = false;
        refreshReachable();
        setDoorOpen(true);
        playUnlock(audio.ctx, audio.master);
        emitNoise("porte", doorCenter.x, doorCenter.z);
        showHint("La porte de la cave s'ouvre en grinçant.", 4);
      },
      deny: () => playDenied(audio.ctx, audio.master),
    };

    /**
     * Collision d'un cercle : cases pleines pour les murs et les portes, mais
     * emprise REELLE pour les meubles. On ne heurte que ce qu'on voit.
     */
    function circleBlocked(px: number, pz: number, radius: number): boolean {
      const minX = Math.floor(px - radius);
      const maxX = Math.floor(px + radius);
      const minZ = Math.floor(pz - radius);
      const maxZ = Math.floor(pz + radius);
      const r2 = radius * radius;
      for (let cx = minX; cx <= maxX; cx++) {
        for (let cz = minZ; cz <= maxZ; cz++) {
          if (isHardSolid(cx, cz)) {
            const closestX = Math.max(cx, Math.min(px, cx + 1));
            const closestZ = Math.max(cz, Math.min(pz, cz + 1));
            if ((px - closestX) ** 2 + (pz - closestZ) ** 2 < r2) return true;
          }
          const fps = footprintsByCell.get(cellKey(cx, cz));
          if (!fps) continue;
          for (const fp of fps) {
            const closestX = Math.max(fp.x0, Math.min(px, fp.x1));
            const closestZ = Math.max(fp.z0, Math.min(pz, fp.z1));
            if ((px - closestX) ** 2 + (pz - closestZ) ** 2 < r2) return true;
          }
        }
      }
      return false;
    }
    function resolveCollision(nx: number, nz: number): [number, number] {
      let x = player.x;
      let z = player.z;
      if (!circleBlocked(nx, z, PLAYER_RADIUS)) x = nx;
      if (!circleBlocked(x, nz, PLAYER_RADIUS)) z = nz;
      return [x, z];
    }

    /** Un bruit dans le manoir. Elle l'entendra peut-etre. */
    function emitNoise(kind: NoiseKind, x = player.x, z = player.z, scale = 1) {
      const radius = NOISE_RADIUS[kind] * scale;
      noises.push({ kind, x, z, radius, at: elapsed });
      noises = pruneNoises(noises, elapsed);
      // La jauge ne montre que les bruits du joueur, pas la piece lancee au loin.
      if (Math.hypot(x - player.x, z - player.z) < 1.5) {
        noiseLevel = Math.max(noiseLevel, Math.min(1, radius / 9));
      }
    }

    function commitInventory(next: Inventory) {
      inv = next;
      setInventory(next);
    }
    function selectSlot(index: number) {
      if (index === inv.selected) return;
      commitInventory(selectInventorySlot(inv, index));
      playSlot(audio.ctx, audio.master);
    }

    function toggleCrouch() {
      if (isHiding || dyingSince >= 0) return;
      crouching = !crouching;
      setCrouched(crouching);
      playCrouch(audio.ctx, audio.master, crouching);
    }

    /** Reprendre la partie : l'evenement de retour sur l'onglet n'arrive pas toujours. */
    function resume() {
      if (document.hidden || contextIsLost) return;
      if (pausedRef.current) {
        pausedRef.current = false;
        setPaused(false);
      }
      lastTime = performance.now();
      audio.ctx.resume().catch(() => {});
    }

    function applyLook(dx: number, dy: number) {
      if (keypadOpenRef.current) return;
      const s = BASE_LOOK_SENSITIVITY * sensitivityRef.current;
      player.yaw -= dx * s;
      const pitchLimit = devRef.current.fly ? 1.5 : 0.7;
      player.pitch = THREE.MathUtils.clamp(player.pitch - dy * s, -pitchLimit, pitchLimit);
    }
    function onCanvasClick() {
      if (keypadOpenRef.current) return;
      if (pausedRef.current) resume();
      // Souris capturee : le clic sert l'objet en main (ou ferme la page lue).
      if (document.pointerLockElement === renderer.domElement) {
        if (readingRef.current) setReadingNote(null);
        else applyHeldItem();
        return;
      }
      try {
        renderer.domElement.requestPointerLock?.()?.catch(() => {});
      } catch {
        // ignore
      }
    }
    function onMouseMove(e: MouseEvent) {
      if (document.pointerLockElement !== renderer.domElement) return;
      applyLook(e.movementX, e.movementY);
    }
    renderer.domElement.addEventListener("click", onCanvasClick);
    document.addEventListener("mousemove", onMouseMove);

    let dragging = false;
    let lastDragX = 0;
    let lastDragY = 0;
    function onPointerDown(e: PointerEvent) {
      // Le navigateur suspend parfois le son en arriere-plan : un clic le relance.
      if (audio.ctx.state === "suspended" && !pausedRef.current) audio.ctx.resume().catch(() => {});
      if (document.pointerLockElement === renderer.domElement) return;
      dragging = true;
      lastDragX = e.clientX;
      lastDragY = e.clientY;
      try {
        renderer.domElement.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    function onPointerMove(e: PointerEvent) {
      if (!dragging || document.pointerLockElement === renderer.domElement) return;
      const dx = e.clientX - lastDragX;
      const dy = e.clientY - lastDragY;
      lastDragX = e.clientX;
      lastDragY = e.clientY;
      applyLook(dx, dy);
    }
    function onPointerUp(e: PointerEvent) {
      dragging = false;
      try {
        renderer.domElement.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    function onContextMenu(e: MouseEvent) {
      e.preventDefault();
    }
    let lastWheelAt = 0;
    function onWheel(e: WheelEvent) {
      const now = performance.now();
      if (now - lastWheelAt < 110 || Math.abs(e.deltaY) < 1) return;
      lastWheelAt = now;
      selectSlot(inv.selected + (e.deltaY > 0 ? 1 : -1));
    }
    renderer.domElement.addEventListener("wheel", onWheel, { passive: true });
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);
    renderer.domElement.addEventListener("contextmenu", onContextMenu);

    const flashlightState = { on: true, battery: 100 };
    function toggleFlashlight() {
      if (dyingSince >= 0) return;
      if (!flashlightState.on && flashlightState.battery < 8) {
        playFlashlightClick(audio.ctx, audio.master, false);
        showHint("La lampe est vide. Utilise une pile 🔋 ou attends qu'elle se recharge.", 3);
        return;
      }
      flashlightState.on = !flashlightState.on;
      setFlashlightOn(flashlightState.on);
      torchToggleAt = elapsed;
      playFlashlightClick(audio.ctx, audio.master, flashlightState.on);
      emitNoise("lampe");
    }

    // --- Objets : ramasser et utiliser ---
    function nearestPickup() {
      let best: (typeof pickups)[number] | null = null;
      let bestD = PICKUP_REACH;
      for (const p of pickups) {
        if (p.taken) continue;
        const d = Math.hypot(player.x - p.x, player.z - p.z);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      return best;
    }
    function pickupLabel(kind: PickupKind): string {
      if (kind === "note") return "📜 une page";
      if (isUsable(kind)) return `${ITEM_DEFS[kind].emoji} ${ITEM_DEFS[kind].name}`;
      return `${KEY_NAMES[kind].emoji} ${KEY_NAMES[kind].name}`;
    }
    function takePickup(p: (typeof pickups)[number]) {
      const kind = p.spot.kind;
      if (isUsable(kind)) {
        const next = addItem(inv, kind);
        if (!next) {
          playDenied(audio.ctx, audio.master);
          showHint("Tes poches sont pleines : utilise un objet avant d'en prendre un autre.", 3);
          return;
        }
        // Main vide : on prend directement l'objet ramasse.
        const selectedEmpty = !inv.slots[inv.selected];
        const landed = next.slots.findIndex((s) => s?.item === kind);
        commitInventory(selectedEmpty && landed >= 0 ? { ...next, selected: landed } : next);
        playPickup(audio.ctx, audio.master);
        showHint(`${ITEM_DEFS[kind].emoji} ${ITEM_DEFS[kind].name} — ${ITEM_DEFS[kind].description}`, 3.4);
      } else if (kind === "note") {
        const note = MANOR_NOTES.find((n) => n.id === p.spot.note);
        if (note) {
          commitInventory(addNote(inv, note.id));
          setReadingNote(note);
        }
        playPaper(audio.ctx, audio.master);
      } else {
        commitInventory(addKey(inv, kind));
        playKeyPickup(audio.ctx, audio.master);
        const door = LOCKED_DOORS.find((d) => d.key === kind);
        showHint(`${KEY_NAMES[kind].emoji} ${KEY_NAMES[kind].name}${door ? ` — elle ouvre : ${door.label}` : ""}.`, 4.5);
      }
      p.taken = true;
      writePickup(p);
      pickupMeshes[p.visual].instanceMatrix.needsUpdate = true;
      const flyer = new THREE.Mesh(pickupLooks[p.visual].geo, pickupLooks[p.visual].mat);
      flyer.position.set(p.x * CELL_SIZE, floorHeightAt(p.z) + 0.82, p.z * CELL_SIZE);
      scene.add(flyer);
      flyToHand(flyer);
      emitNoise("ramassage");
    }

    function nearestKeyDoor() {
      let best: (typeof keyDoors)[number] | null = null;
      let bestD = DOOR_REACH;
      for (const door of keyDoors) {
        if (door.open) continue;
        const d = Math.hypot(player.x - door.center.x, player.z - door.center.z);
        if (d < bestD) {
          bestD = d;
          best = door;
        }
      }
      return best;
    }
    function tryKeyDoor(door: (typeof keyDoors)[number]) {
      if (!inv.keys.includes(door.def.key)) {
        playLockedRattle(audio.ctx, audio.master);
        emitNoise("porte", door.center.x, door.center.z, 0.5);
        showHint(`🔒 ${door.def.label} : fermée à clé. Il te faut la ${KEY_NAMES[door.def.key].name.toLowerCase()}.`, 3.5);
        return;
      }
      door.open = true;
      openedDoorIds.add(door.def.id);
      door.padlock.visible = false;
      refreshReachable();
      playUnlock(audio.ctx, audio.master);
      emitNoise("porte", door.center.x, door.center.z);
      reachAt = elapsed;
      showHint(`🗝️ La porte de la ${door.def.label.toLowerCase()} s'ouvre.`, 3.5);
    }

    function applyHeldItem() {
      if (dyingSince >= 0 || keypadOpenRef.current || isHiding) return;
      const slot = inv.slots[inv.selected];
      if (!slot) {
        showHint("Main vide. Choisis un objet avec 1-5 ou la molette.", 2.4);
        return;
      }
      const item = slot.item;
      if (item === "battery") {
        if (flashlightState.battery >= 97) {
          showHint("La lampe est déjà chargée.", 2);
          return;
        }
        flashlightState.battery = Math.min(100, flashlightState.battery + BATTERY_RESTORE);
        playFlashlightClick(audio.ctx, audio.master, true);
        showHint(`🔋 Lampe rechargée (${Math.round(flashlightState.battery)} %).`, 2.4);
      } else if (item === "salt") {
        if (!monster.active || distToMonster > SALT_REACH) {
          showHint("Garde ton sel : il ne sert que lorsqu'elle est sur toi.", 2.6);
          return;
        }
        monsterStunUntil = elapsed + SALT_STUN_SECONDS;
        // Elle recule d'un pas, si rien ne l'en empeche.
        const away = Math.hypot(monster.x - player.x, monster.z - player.z) || 1;
        const bx = monster.x + ((monster.x - player.x) / away) * 0.8;
        const bz = monster.z + ((monster.z - player.z) / away) * 0.8;
        if (!circleBlocked(bx, bz, 0.22)) {
          monster.x = bx;
          monster.z = bz;
        }
        monster.path = null;
        playSaltThrow(audio.ctx, audio.master);
        playRecoil(audio.ctx, audio.master, monsterSpatial(10, 1.3));
        emitNoise("sel");
        flashLevel = Math.max(flashLevel, 0.4);
        for (let k = 0; k < 14; k++) {
          const grain = new THREE.Mesh(shardGeo, saltMat);
          grain.scale.setScalar(0.5);
          grain.position.copy(camera.position).add(new THREE.Vector3(0.15, -0.25, -0.4).applyQuaternion(camera.quaternion));
          scene.add(grain);
          const dirX = -Math.sin(player.yaw);
          const dirZ = -Math.cos(player.yaw);
          shards.push({
            mesh: grain,
            vx: dirX * (3 + Math.random() * 2) + (Math.random() - 0.5),
            vy: 1 + Math.random() * 1.5,
            vz: dirZ * (3 + Math.random() * 2) + (Math.random() - 0.5),
            at: elapsed,
          });
        }
        showHint("🧂 Elle recule en hurlant. Quelques secondes : fuis.", 3);
      } else if (item === "coin") {
        throwCoin();
      } else if (item === "musicbox") {
        const mesh = new THREE.Mesh(pickupLooks.musicbox.geo, pickupLooks.musicbox.mat);
        mesh.position.set(player.x * CELL_SIZE, floorHeightAt(player.z) + 0.07, player.z * CELL_SIZE);
        mesh.rotation.y = player.yaw;
        scene.add(mesh);
        musicBoxes.push({
          mesh,
          x: player.x,
          z: player.z,
          until: elapsed + MUSICBOX_SECONDS,
          nextNoiseAt: elapsed,
          sound: playMusicBox(audio.ctx, audio.master, MUSICBOX_SECONDS),
        });
        showHint("🎶 La boîte joue. Éloigne-toi avant qu'elle arrive.", 3.4);
      }
      commitInventory(consumeSelected(inv).inv);
      reachAt = elapsed;
    }

    /** La piece part dans l'axe du regard, rebondit sur le premier obstacle. */
    function throwCoin() {
      const dirX = -Math.sin(player.yaw);
      const dirZ = -Math.cos(player.yaw);
      // Viser haut lance plus loin, viser le sol lache la piece a ses pieds.
      const range = COIN_RANGE * THREE.MathUtils.clamp(0.75 + player.pitch * 0.6, 0.25, 1.15);
      let lx = player.x;
      let lz = player.z;
      for (let t = 0.12; t <= range; t += 0.12) {
        const nx = player.x + dirX * t;
        const nz = player.z + dirZ * t;
        if (circleBlocked(nx, nz, 0.06)) break;
        lx = nx;
        lz = nz;
      }
      const mesh = new THREE.Mesh(pickupLooks.coin.geo, pickupLooks.coin.mat);
      mesh.position.copy(camera.position);
      scene.add(mesh);
      const dist = Math.hypot(lx - player.x, lz - player.z);
      thrownCoins.push({
        mesh,
        fromX: player.x,
        fromZ: player.z,
        fromY: camera.position.y - 0.2,
        toX: lx,
        toZ: lz,
        at: elapsed,
        duration: 0.2 + dist * 0.07,
        landed: false,
      });
      playCoinThrow(audio.ctx, audio.master);
    }

    /** Distance (en cases) du joueur a la porte de la cave. */
    function distanceToDoor() {
      return Math.hypot(player.x - doorCenter.x, player.z - doorCenter.z);
    }
    function distanceToAltar() {
      return Math.hypot(player.x - altarCenter.x, player.z - altarCenter.z);
    }
    function nearestHideout(): Hideout | null {
      let best: Hideout | null = null;
      let bestD = HIDE_REACH;
      for (const h of hideouts) {
        const d = distToFootprint(player.x, player.z, h.fp);
        if (d < bestD) {
          bestD = d;
          best = h;
        }
      }
      return best;
    }
    /** La case libre d'ou elle viendra te tirer de la cachette. */
    function approachCell(h: Hideout): [number, number] {
      let best: [number, number] | null = null;
      let bestD = Infinity;
      for (let y = h.prop.y0 - 1; y <= h.prop.y1 + 1; y++) {
        for (let x = h.prop.x0 - 1; x <= h.prop.x1 + 1; x++) {
          if (isSolid(x, y) || !reachableSet.has(cellKey(x, y))) continue;
          const d = Math.hypot(x + 0.5 - beforeHide.x, y + 0.5 - beforeHide.z);
          if (d < bestD) {
            bestD = d;
            best = [x, y];
          }
        }
      }
      return best ?? [Math.floor(beforeHide.x), Math.floor(beforeHide.z)];
    }
    /** Elle te voit, maintenant, sans attendre le prochain calcul de ligne de vue. */
    function monsterSeesPlayerNow(): boolean {
      if (!monster.active || dyingSince >= 0) return false;
      const d = Math.hypot(monster.x - player.x, monster.z - player.z);
      if (d < 1.1) return true;
      const fwdX = Math.sin(bodyYaw);
      const fwdZ = Math.cos(bodyYaw);
      const behind = ((player.x - monster.x) * fwdX + (player.z - monster.z) * fwdZ) / (d || 1) < -0.25;
      const torchOn = flashlightState.on && flashlightState.battery > 0 && elapsed >= lightsOutUntil;
      const range = sightRange({ flashlightOn: torchOn, crouched: crouching, behind });
      return d < range && hasLineOfSight(monster.x, monster.z, player.x, player.z);
    }
    /** Se glisser dans une armoire ou sous un lit. Invisible — pas inaudible. */
    function toggleHide() {
      // Sortir reste toujours possible, quelle que soit la phase : sinon se
      // cacher pendant le rituel bloquait la partie pour de bon.
      if (isHiding) {
        const wasBed = currentHideout?.kind === "bed";
        isHiding = false;
        currentHideout = null;
        camSlideFrom = { x: player.x, z: player.z };
        camSlideAt = elapsed;
        player.x = beforeHide.x;
        player.z = beforeHide.z;
        setHideKind(null);
        breathLeft = 1;
        breathLocked = false;
        wasHoldingBreath = false;
        setHoldingBreath(false);
        setBreath(1);
        if (wasBed) playUnderBed(audio.ctx, audio.master);
        else playWardrobe(audio.ctx, audio.master, true);
        emitNoise("armoire", player.x, player.z, wasBed ? 0.6 : 1);
        return;
      }
      // On peut encore se cacher pendant la course aux sceaux : c'est une
      // vraie tactique, qui coute du temps mais pas la partie. Interdit en
      // revanche pendant la survie et la fuite, qui sont chronometrees.
      if (phase !== "none" && phase !== "seals") return;
      const spot = nearestHideout();
      if (!spot) return;
      // Elle te regarde entrer : la cachette ne sert plus a rien.
      const seenHiding = monsterSeesPlayerNow();
      beforeHide = { x: player.x, z: player.z };

      isHiding = true;
      currentHideout = spot;
      if (crouching) {
        crouching = false;
        setCrouched(false);
      }
      camSlideFrom = { x: player.x, z: player.z };
      camSlideAt = elapsed;
      player.x = spot.x;
      player.z = spot.z;
      // On se retourne dans la cachette : on regarde la piece par la fente,
      // pas le fond de l'armoire. Sous un lit, vers le cote par ou on est venu.
      {
        let outX = beforeHide.x - spot.x;
        let outZ = beforeHide.z - spot.z;
        if (spot.kind === "wardrobe") {
          const front = { N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0] }[spot.prop.facing ?? "N"];
          outX = front[0];
          outZ = front[1];
        }
        player.yaw = Math.atan2(-outX, -outZ);
        player.pitch = spot.kind === "bed" ? 0.05 : 0;
      }
      setHideKind(spot.kind);
      if (spot.kind === "bed") playUnderBed(audio.ctx, audio.master);
      else playWardrobe(audio.ctx, audio.master, false);
      emitNoise("armoire", beforeHide.x, beforeHide.z, spot.kind === "bed" ? 0.6 : 1);
      if (seenHiding) {
        noteHidingSeen(brain, approachCell(spot), elapsed);
        playShriek(audio.ctx, audio.master, monsterSpatial(16, 1.1));
      }
      if (!hideHintShown) {
        hideHintShown = true;
        showHint(
          "Cachée. Si elle rôde tout près, retiens ton souffle (Espace). Si elle t'a vue entrer, sors et cours.",
          5.5,
        );
      }
      // Une fois de temps en temps, l'armoire n'etait pas vide.
      if (
        spot.kind === "wardrobe" &&
        !seenHiding &&
        elapsed >= nextScareAt &&
        distToMonster > 9 &&
        Math.random() < 0.3
      ) {
        pendingHandScareAt = elapsed + 1.3 + Math.random() * 1.2;
        nextScareAt = elapsed + SCARE_COOLDOWN + Math.random() * 40;
      }
    }
    /** L'etape courante, mise en scene par l'interface de quete. */
    function computeQuest(): Quest {
      if (phase === "escape") {
        return {
          id: "fuite",
          act: "Acte VII",
          title: "Elle est derrière toi",
          detail: "Ne t'arrête pas. Ne te retourne pas.",
          where: "La trappe, au fond de la cave",
          mood: "danger",
        };
      }
      if (phase === "survive") {
        return {
          id: "survie",
          act: "Acte VI",
          title: "Quarante-cinq secondes",
          detail: "La trappe s'ouvre lentement. Tiens jusque-là, et ne t'arrête jamais.",
          where: "N'importe où, sauf près d'elle",
          mood: "danger",
        };
      }
      if (phase === "seals") {
        const left = seals.filter((s) => !s.broken);
        return {
          id: "sceaux",
          act: "Acte V",
          title: "Les trois sceaux",
          detail: `La trappe est scellée. Brise les sceaux : ${
            seals.length - left.length
          }/${seals.length}. Elle te chasse.`,
          where: left.map((s) => s.room).join(" · ") || null,
          mood: "danger",
        };
      }
      if (phase === "ritual") {
        return {
          id: "rituel",
          act: "Acte IV",
          title: "Le rituel",
          detail: "Les reliques s'élèvent. Quelque chose se réveille dessous.",
          where: null,
          mood: "rituel",
        };
      }
      if (doorLocked) {
        // Les pieces ne sont pas ecrites en dur : elles viennent des plaques,
        // pour que deplacer un indice ne mente jamais au joueur.
        const missing = cluePlaques.filter((p) => !p.found).map((p) => p.room);
        if (missing.length > 0) {
          return {
            id: "plaques",
            act: "Acte I",
            title: "Les plaques gravées",
            detail: `${CODE_LENGTH} chiffres sont gravés dans les murs. Approche-toi pour les relever.`,
            where: missing.join(" · "),
            mood: "calme",
          };
        }
        return {
          id: "serrure",
          act: "Acte II",
          title: "La serrure à code",
          detail: `Tu as les  chiffres. Compose-les sur la porte.`,
          where: "La porte noire de la cave",
          mood: "calme",
        };
      }
      if (collectedCount < ITEM_COUNT) {
        // La relique enfermee est la seule qui demande une cle : on le dit,
        // sinon on fait le tour du manoir sans comprendre ce qui manque.
        const lockedRelic = items.find(
          (i) => i.x === LOCKED_RELIC_SPOT.x + 0.5 && i.z === LOCKED_RELIC_SPOT.y + 0.5,
        );
        const condemned = keyDoors.find((d) => d.def.id === "condamnee");
        let where = "Partout, sauf la cave";
        if (lockedRelic && !lockedRelic.collected && condemned && !condemned.open) {
          where = inv.keys.includes(condemned.def.key)
            ? "Une t'attend dans la Chambre condamnée — tu as la clé"
            : "L'une est dans la Chambre condamnée, fermée à clé";
        }
        return {
          id: "reliques",
          act: "Acte III",
          title: "Les cinq reliques",
          detail: "Chaque relique volée la rend plus rapide, et souffle une bougie.",
          where,
          mood: "calme",
        };
      }
      return {
        id: "autel",
        act: "Acte III",
        title: "L'autel",
        detail: "Dépose les cinq reliques sur la pierre.",
        where: "Au centre de la cave",
        mood: "rituel",
      };
    }
    function canOfferAtAltar() {
      return (
        phase === "none" &&
        collectedCount >= ITEM_COUNT &&
        !doorLocked &&
        distanceToAltar() < ALTAR_REACH
      );
    }
    /** Le rituel : on rend les objets, et le manoir se retourne contre toi. */
    function startRitual() {
      if (phase !== "none") return;
      phase = "ritual";
      ritualStartedAt = elapsed;
      setFinale("ritual");
      offeringGroup.visible = true;
      playRitual(audio.ctx, audio.master);
      showHint("Les reliques s'élèvent. Quelque chose se réveille en dessous.", 4.5);
      // Toutes les bougies s'eteignent d'un coup.
      for (const s of sconces) {
        s.dead = true;
        s.light.intensity = 0;
        s.flame.visible = false;
      }
      // Elle revient par la porte de la cave, et elle ne marche plus.
      monster.x = doorCenter.x;
      monster.z = doorCenter.z;
      monster.path = null;
      monster.pathIndex = 0;
      monster.repathTimer = 0;
      awakenMonster();
    }

    /**
     * L'action « E » : elle sert a tout (serrure, autel, armoire), et le
     * bouton tactile doit pouvoir la declencher exactement pareil.
     */
    function interact() {
      if (keypadOpenRef.current || dyingSince >= 0) return;
      if (readingRef.current) {
        setReadingNote(null);
        return;
      }
      if (isHiding) {
        toggleHide();
        return;
      }
      const pickup = nearestPickup();
      const keyDoor = nearestKeyDoor();
      if (pickup) {
        takePickup(pickup);
      } else if (doorLocked && distanceToDoor() < DOOR_REACH) {
        try {
          document.exitPointerLock?.();
        } catch {
          // ignore
        }
        keys.clear();
        setKeypadOpen(true);
      } else if (keyDoor) {
        tryKeyDoor(keyDoor);
      } else if (canOfferAtAltar()) {
        startRitual();
      } else if (nearestHideout()) {
        toggleHide();
      }
    }

    const keys = new Set<string>();
    function onKeyDown(e: KeyboardEvent) {
      // Guide ouvert : la partie est en pause, seules H et Echap le referment.
      if (guideOpenRef.current) {
        if (e.key === "Escape" || e.key.toLowerCase() === "h") setGuideOpen(false);
        return;
      }
      if (e.key.toLowerCase() === "h" && !keypadOpenRef.current) {
        releaseEverything();
        try {
          document.exitPointerLock?.();
        } catch {
          // ignore
        }
        setGuideOpen(true);
        return;
      }
      if (keypadOpenRef.current) {
        if (e.key === "Escape") setKeypadOpen(false);
        return;
      }
      const k = e.key.toLowerCase();
      // Tab ouvre le carnet ; le navigateur, lui, voudrait changer de champ.
      if (e.key === "Tab") {
        e.preventDefault();
        const open = !bagOpenRef.current;
        setBagOpen(open);
        if (open) {
          releaseEverything();
          try {
            document.exitPointerLock?.();
          } catch {
            // ignore
          }
        }
        return;
      }
      if (e.key === "Escape") {
        if (readingRef.current) setReadingNote(null);
        if (bagOpenRef.current) setBagOpen(false);
      }
      if (e.repeat) return;
      keys.add(k);
      if (/^[1-5]$/.test(e.key)) selectSlot(Number(e.key) - 1);
      if (k === "f") toggleFlashlight();
      if (k === "e") interact();
      if (k === "g") applyHeldItem();
      // En vol, C sert a descendre : on ne s'accroupit pas en plein ciel.
      if (k === "c" && !devRef.current.fly) toggleCrouch();
      if (e.key === "F2" && devAllowed) {
        e.preventDefault();
        setDevOpen((open) => !open);
      }
      // Espace : monter en vol, ou retenir son souffle. Jamais faire defiler la page.
      if (e.key === " ") e.preventDefault();
    }
    function onKeyUp(e: KeyboardEvent) {
      keys.delete(e.key.toLowerCase());
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // Sans ca, une touche enfoncee au moment d'un Alt+Tab reste "enfoncee" :
    // on revient dans le manoir en train de marcher droit dans un mur.
    function releaseEverything() {
      keys.clear();
      heldRef.current.forward = false;
      heldRef.current.back = false;
      heldRef.current.left = false;
      heldRef.current.right = false;
      heldRef.current.sprint = false;
      heldRef.current.breath = false;
      dragging = false;
    }
    function onBlur() {
      releaseEverything();
    }
    // L'onglet passe en arriere-plan : on gele la partie et on coupe le son.
    // Sinon la chose continue de te traquer pendant que tu regardes ailleurs.
    function onVisibility() {
      if (document.hidden) {
        pausedRef.current = true;
        setPaused(true);
        releaseEverything();
        audio.ctx.suspend().catch(() => {});
      } else {
        resume();
      }
    }
    // Filets de securite pour le retour : selon le navigateur (retour arriere,
    // fenetre masquee puis rendue, veille), « visibilitychange » peut ne pas
    // arriver. La partie restait alors gelee derriere un ecran noir.
    function onReturn() {
      if (pausedRef.current && !document.hidden) resume();
    }
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onReturn);
    window.addEventListener("pageshow", onReturn);
    document.addEventListener("visibilitychange", onVisibility);
    // Onglet deja en arriere-plan au montage : on demarre en pause.
    const initialVisibility = window.setTimeout(() => {
      if (document.hidden) onVisibility();
    }, 0);

    // Contexte WebGL perdu (pilote, trop d'onglets 3D, veille) : on l'annonce,
    // et on laisse Three.js le reconstruire quand le navigateur le rend.
    let contextIsLost = false;
    function onContextLost(e: Event) {
      e.preventDefault();
      contextIsLost = true;
      pausedRef.current = true;
      setContextLost(true);
    }
    function onContextRestored() {
      contextIsLost = false;
      setContextLost(false);
      resume();
    }
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);
    renderer.domElement.addEventListener("webglcontextrestored", onContextRestored);

    let ended = false;
    let lastTime = performance.now();
    let frameMsAvg = 16;
    let resolutionTimer = 0;
    let smoothFrames = 0;
    let batteryUiTimer = 0;

    function step() {
      const now = performance.now();
      const rawFrameMs = now - lastTime;
      const delta = Math.min(rawFrameMs / 1000, 0.1);
      lastTime = now;
      if (contextIsLost) return;
      if (ended || pausedRef.current || guideOpenRef.current) {
        renderer.render(scene, camera);
        return;
      }
      elapsed += delta;

      // --- Resolution adaptative ---
      // La boucle tourne a setInterval(16) : tant que le rendu tient, l'image
      // arrive toutes les 16 ms. Si le GPU peine (lampe allumee sur un
      // portable, plein ecran), l'intervalle s'allonge. On le mesure, et on
      // baisse la resolution plutot que de laisser le jeu saccader ; on la
      // remonte, plus prudemment, quand ca respire de nouveau.
      if (rawFrameMs < 250) frameMsAvg += (rawFrameMs - frameMsAvg) * 0.08;
      resolutionTimer += delta;
      if (resolutionTimer >= 1.5) {
        resolutionTimer = 0;
        let next = pixelRatio;
        if (frameMsAvg > 21 && pixelRatio > PIXEL_RATIO_FLOOR) {
          next = Math.max(PIXEL_RATIO_FLOOR, Math.round((pixelRatio - 0.15) * 100) / 100);
          smoothFrames = 0;
        } else if (frameMsAvg < 17.5 && pixelRatio < PIXEL_RATIO_CAP) {
          // On attend 6 s de fluidite avant de remonter : sinon on oscille
          // entre deux resolutions et l'image clignote.
          smoothFrames += 1;
          if (smoothFrames >= 4) {
            next = Math.min(PIXEL_RATIO_CAP, Math.round((pixelRatio + 0.1) * 100) / 100);
            smoothFrames = 0;
          }
        } else {
          smoothFrames = 0;
        }
        if (Math.abs(next - pixelRatio) > 0.001) {
          pixelRatio = next;
          renderer.setPixelRatio(pixelRatio);
        }
      }

      // --- Screamer de mort : le visage fonce sur la camera ---
      if (dyingSince >= 0) {
        const t = (elapsed - dyingSince) / DEATH_SEQUENCE_SECONDS;
        const rush = Math.min(1, t * 2.1);
        const dirToPlayer = new THREE.Vector3(0, 0, -1).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          player.yaw,
        );
        const targetDist = THREE.MathUtils.lerp(2.1, 0.3, rush);
        // Elle se redresse de toute sa hauteur en arrivant : la tete finit
        // AU-DESSUS de la camera, et c'est ce qui fait qu'on leve les yeux.
        monsterGroup.position.set(
          (player.x + dirToPlayer.x * targetDist) * CELL_SIZE,
          floorHeightAt(player.z) - THREE.MathUtils.lerp(0, 0.55, rush),
          (player.z + dirToPlayer.z * targetDist) * CELL_SIZE,
        );
        // Il est place devant la camera : pour nous faire face, son +Z doit
        // pointer vers le joueur, ce qui correspond exactement au lacet du joueur.
        monsterGroup.rotation.set(0, player.yaw, Math.sin(elapsed * 26) * 0.05 * (1 - t));
        monsterGroup.scale.setScalar(THREE.MathUtils.lerp(1, 1.3, rush));
        // Bond complet : machoire decrochee, bras ecartes, yeux au maximum.
        poseMonster(beast, {
          time: elapsed,
          walk: monsterWalk + elapsed * 6,
          speed: 2.4,
          headYaw: 0,
          headPitch: 0.55 * rush,
          lunge: rush,
        });
        // Elle penche la tete pour te regarder par en dessous ses cheveux.
        beast.head.rotation.z = Math.sin(elapsed * 3) * 0.5;
        face.scale.setScalar(THREE.MathUtils.lerp(1, 1.45, rush));
        // La camera est arrachee vers le haut, vers son visage.
        const shake = 0.07 * (1 - t * 0.5);
        camera.rotation.y = player.yaw + (Math.random() - 0.5) * shake * 3;
        camera.rotation.x =
          player.pitch + rush * 0.5 + (Math.random() - 0.5) * shake * 3;
        camera.rotation.z = (Math.random() - 0.5) * shake * 2.5;
        if (t >= 1) {
          ended = true;
          endedRef.current = true;
          onCaught();
        }
        renderer.render(scene, camera);
        return;
      }

      const blockedByUi = keypadOpenRef.current || isHiding;
      const forwardKey = layoutRef.current === "azerty" ? "z" : "w";
      const leftKey = layoutRef.current === "azerty" ? "q" : "a";
      let fwd = 0;
      let strafe = 0;
      if (!blockedByUi) {
        if (keys.has(forwardKey) || keys.has("arrowup") || heldRef.current.forward) fwd += 1;
        if (keys.has("s") || keys.has("arrowdown") || heldRef.current.back) fwd -= 1;
        if (keys.has(leftKey) || keys.has("arrowleft") || heldRef.current.left) strafe -= 1;
        if (keys.has("d") || keys.has("arrowright") || heldRef.current.right) strafe += 1;
      }

      // Course et endurance. On ne court ni accroupi, ni cache, ni epuise.
      const wantsSprint = keys.has("shift") || heldRef.current.sprint;
      sprinting =
        wantsSprint && (fwd !== 0 || strafe !== 0) && !crouching && !exhausted && !devRef.current.fly;
      if (sprinting) {
        staminaLevel = Math.max(0, staminaLevel - STAMINA_DRAIN_PER_SEC * delta);
        if (staminaLevel <= 0) {
          exhausted = true;
          sprinting = false;
          // A bout de souffle : on halete, et ca s'entend loin.
          playGasp(audio.ctx, audio.master);
          emitNoise("haletement");
          showHint("À bout de souffle… elle t'a peut-être entendue.", 2.6);
        }
      } else {
        const still = fwd === 0 && strafe === 0;
        staminaLevel = Math.min(100, staminaLevel + STAMINA_REGEN_PER_SEC * (still ? 1.6 : 1) * delta);
        if (exhausted && staminaLevel >= STAMINA_RECOVER_AT) exhausted = false;
      }
      if (Math.abs(staminaLevel - lastSyncedStamina) >= 2 || (staminaLevel === 100 && lastSyncedStamina !== 100)) {
        lastSyncedStamina = staminaLevel;
        setStamina(Math.round(staminaLevel));
      }
      crouchLevel += ((crouching ? 1 : 0) - crouchLevel) * Math.min(1, delta * 9);

      if (fwd !== 0 || strafe !== 0) {
        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw);
        const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw);
        const move = new THREE.Vector3().addScaledVector(forward, fwd).addScaledVector(right, strafe);
        if (move.lengthSq() > 0) {
          const dev = devRef.current;
          const gait = crouching ? CROUCH_SPEED : sprinting ? SPRINT_SPEED : MOVE_SPEED;
          move
            .normalize()
            .multiplyScalar(
              gait * (dollBlessing ? DOLL_SPEED_BONUS : 1) * (dev.fast ? 3 : 1) * delta,
            );
          if (dev.noclip || dev.fly) {
            // Sans collision, mais on reste dans les limites du manoir.
            player.x = THREE.MathUtils.clamp(player.x + move.x, 0.3, data.width - 0.3);
            player.z = THREE.MathUtils.clamp(player.z + move.z, 0.3, data.height - 0.3);
          } else {
            const [nx, nz] = resolveCollision(player.x + move.x, player.z + move.z);
            player.x = nx;
            player.z = nz;
          }
        }
      }

      const moving = fwd !== 0 || strafe !== 0;
      const playerFloor = floorHeightAt(player.z);
      {
        const dev = devRef.current;
        if (dev.fly) {
          const up = (keys.has(" ") ? 1 : 0) - (keys.has("c") ? 1 : 0);
          devFlyHeight = THREE.MathUtils.clamp(devFlyHeight + up * (dev.fast ? 18 : 7) * delta, -1.2, 42);
        } else if (devFlyHeight !== 0) {
          devFlyHeight = 0;
        }
        // Vu d'en haut, le brouillard et la penombre rendraient la carte
        // illisible. Les plafonds, eux, ne sont visibles que par-dessous :
        // on voit a travers, comme une carte en rayons X.
        const high = dev.fly && devFlyHeight > 2;
        fog.near = high ? 60 : FOG_NEAR;
        fog.far = high ? 260 : FOG_FAR;
        hemi.intensity = (high ? 6.5 : 1.3) * brightness;
        // La main et la lampe masquaient la carte vue d'en haut.
        // Cache sous un lit, la main traverserait le plancher : on la range.
        handGroup.visible = !dev.fly && !(isHiding && currentHideout?.kind === "bed");
      }
      // Hauteur des yeux : debout, accroupi, ou a plat ventre sous un lit.
      const eye = isHiding
        ? currentHideout?.kind === "bed"
          ? BED_EYE
          : EYE_HEIGHT - 0.08
        : THREE.MathUtils.lerp(EYE_HEIGHT, CROUCH_EYE, crouchLevel);
      camera.position.set(
        player.x * CELL_SIZE,
        playerFloor + eye + devFlyHeight,
        player.z * CELL_SIZE,
      );
      camera.rotation.y = player.yaw;
      camera.rotation.x = player.pitch;
      camera.rotation.z = 0;

      // Tete qui oscille a la marche : deux bosses par foulee et un leger
      // roulis. Coupe en vol et dans l'armoire.
      bobAmount +=
        ((moving && !isHiding && !devRef.current.fly ? 1 : 0) - bobAmount) * Math.min(1, delta * 8);
      if (bobAmount > 0.001) {
        const sway = Math.sin(walkPhase) * 0.025 * bobAmount;
        camera.position.y += (Math.abs(Math.sin(walkPhase)) * 0.045 - 0.02) * bobAmount;
        camera.position.x += Math.cos(player.yaw) * sway;
        camera.position.z -= Math.sin(player.yaw) * sway;
        camera.rotation.z += Math.sin(walkPhase) * 0.011 * bobAmount;
      }
      // Entrer dans une armoire ou en sortir fait glisser la camera au lieu de
      // la teleporter : la logique, elle, a deja change de case.
      if (camSlideAt >= 0 && camSlideFrom) {
        const t = Math.min(1, (elapsed - camSlideAt) / 0.45);
        const k = t * t * (3 - 2 * t);
        camera.position.x = THREE.MathUtils.lerp(camSlideFrom.x * CELL_SIZE, player.x * CELL_SIZE, k);
        camera.position.z = THREE.MathUtils.lerp(camSlideFrom.z * CELL_SIZE, player.z * CELL_SIZE, k);
        if (t >= 1) {
          camSlideAt = -1;
          camSlideFrom = null;
        }
      }

      // Distance et ligne de vue vers la chose : tout le reste en depend.
      // La ligne de vue est recalculee 5 fois par seconde, pas a chaque image.
      distToMonster = Math.hypot(monster.x - player.x, monster.z - player.z);
      losTimer -= delta;
      if (losTimer <= 0) {
        losTimer = LOS_INTERVAL;
        losToMonster =
          monster.active && distToMonster < 14
            ? hasLineOfSight(player.x, player.z, monster.x, monster.z)
            : false;
      }
      // Ce qu'ELLE voit : la portee depend de la lampe, de la posture, et de
      // ce que tu sois devant ou derriere elle.
      {
        const torchNow = flashlightState.on && flashlightState.battery > 0 && elapsed >= lightsOutUntil;
        const fwdX = Math.sin(bodyYaw);
        const fwdZ = Math.cos(bodyYaw);
        const behind =
          ((player.x - monster.x) * fwdX + (player.z - monster.z) * fwdZ) / (distToMonster || 1) < -0.25;
        const range = sightRange({ flashlightOn: torchNow, crouched: crouching, behind });
        monsterCanSee =
          monster.active &&
          !isHiding &&
          dyingSince < 0 &&
          !devRef.current.fly &&
          (distToMonster < 1.1 || (distToMonster < range && losToMonster));
      }

      // Pas + grincements de marches. Chaque pas est un bruit qu'elle peut
      // entendre : accroupi presque rien, en courant a l'autre bout du couloir.
      if (moving && !devRef.current.fly && elapsed >= nextFootstepAt) {
        const gait = crouching ? "accroupi" : sprinting ? "course" : "pas";
        playPlayerStep(audio.ctx, audio.master, gait);
        emitNoise(gait);
        nextFootstepAt = elapsed + (crouching ? 0.62 : sprinting ? 0.3 : 0.44);
        const onStairs = player.z > STAIR_ROW_FIRST && player.z < STAIR_ROW_LAST + 1;
        if (onStairs && !crouching && elapsed >= nextCreakAt) {
          playStairCreak(audio.ctx, audio.master);
          emitNoise("pas", player.x, player.z, 1.2);
          nextCreakAt = elapsed + 0.9 + Math.random();
        }
      }

      walkPhase += moving ? delta * (crouching ? 5.5 : sprinting ? 11.5 : 8.5) : 0;
      handGroup.position.set(
        HAND_BASE.x + (moving ? Math.sin(walkPhase) * 0.014 : 0),
        HAND_BASE.y + (moving ? Math.abs(Math.cos(walkPhase)) * 0.016 : 0),
        HAND_BASE.z,
      );
      {
        // Gestes de la main : elle plonge pour cliquer la lampe, et se tend
        // pour attraper un objet.
        let dip = 0;
        if (torchToggleAt >= 0) {
          const t = (elapsed - torchToggleAt) / 0.34;
          if (t >= 1) torchToggleAt = -1;
          else dip = Math.sin(t * Math.PI);
        }
        let reach = 0;
        if (reachAt >= 0) {
          const t = (elapsed - reachAt) / 0.42;
          if (t >= 1) reachAt = -1;
          else reach = Math.sin(t * Math.PI);
        }
        handGroup.position.y += reach * 0.05 - dip * 0.075;
        handGroup.position.z -= reach * 0.13;
        handGroup.rotation.x = 0.06 + dip * 0.42 - reach * 0.25;
      }
      for (let i = flyers.length - 1; i >= 0; i--) {
        const f = flyers[i];
        const t = Math.min(1, (elapsed - f.at) / 0.38);
        const k = t * t;
        handTarget.set(0.18, -0.25, -0.55).applyQuaternion(camera.quaternion).add(camera.position);
        f.obj.position.lerpVectors(f.from, handTarget, k);
        f.obj.scale.setScalar(f.baseScale * (1 - k * 0.92));
        if (t >= 1) {
          scene.remove(f.obj);
          flyers.splice(i, 1);
        }
      }
      for (let i = shards.length - 1; i >= 0; i--) {
        const sh = shards[i];
        const age = elapsed - sh.at;
        sh.vy -= 9.8 * delta;
        sh.mesh.position.x += sh.vx * delta;
        sh.mesh.position.y += sh.vy * delta;
        sh.mesh.position.z += sh.vz * delta;
        sh.mesh.rotation.x += delta * 8;
        sh.mesh.rotation.y += delta * 6;
        const ground = floorHeightAt(sh.mesh.position.z / CELL_SIZE) + 0.035;
        if (sh.mesh.position.y < ground) {
          sh.mesh.position.y = ground;
          sh.vy *= -0.3;
          sh.vx *= 0.6;
          sh.vz *= 0.6;
        }
        sh.mesh.scale.setScalar(Math.max(0.01, 1 - age / 1.6));
        if (age > 1.6) {
          scene.remove(sh.mesh);
          shards.splice(i, 1);
        }
      }
      for (let i = fallingChains.length - 1; i >= 0; i--) {
        const c = fallingChains[i];
        const t = Math.min(1, (elapsed - c.at) / 0.55);
        const k = t * t;
        c.mesh.position.y = THREE.MathUtils.lerp(0.14, 0.02, k);
        c.mesh.position.x = c.side * k * 0.35;
        c.mesh.rotation.z = c.side * k * 0.9;
        if (t >= 1) fallingChains.splice(i, 1);
      }

      // Poussiere : elle tombe lentement et s'enroule autour du joueur, si
      // bien qu'on ne sort jamais du nuage sans jamais le voir se deplacer.
      {
        const cx = player.x * CELL_SIZE;
        const cz = player.z * CELL_SIZE;
        const half = DUST_BOX / 2;
        for (let i = 0; i < DUST_COUNT; i++) {
          const k = i * 3;
          dustPositions[k + 1] -= dustDrift[i] * delta;
          dustPositions[k] += Math.sin(elapsed * 0.5 + i) * 0.004;
          if (dustPositions[k + 1] < 0) dustPositions[k + 1] += DUST_HEIGHT;
          // Recentrage modulo autour du joueur : la poussiere qui sort d'un
          // cote du cube reapparait de l'autre, on ne la voit jamais bouger.
          const rx = dustPositions[k] - cx;
          if (rx > half) dustPositions[k] -= DUST_BOX;
          else if (rx < -half) dustPositions[k] += DUST_BOX;
          const rz = dustPositions[k + 2] - cz;
          if (rz > half) dustPositions[k + 2] -= DUST_BOX;
          else if (rz < -half) dustPositions[k + 2] += DUST_BOX;
        }
        dustGeo.attributes.position.needsUpdate = true;
      }

      flashlight.position.copy(camera.position);
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      flashTarget.position.copy(camera.position).add(dir);
      playerGlow.position.copy(camera.position);
      // La lampe grésille quand elle est proche, et lâche carrément quand
      // elle est presque sur toi : tu SAIS qu'elle arrive avant de la voir.
      if (monster.active && distToMonster < 7) {
        const panic = 1 - distToMonster / 7;
        torchFlicker = Math.random() < 0.1 + panic * 0.4 ? 0.08 + Math.random() * 0.3 : 1;
      } else {
        torchFlicker = 1;
      }
      // Screamer « la lampe meurt » : elle se coupe toute seule quelques secondes.
      const blackout = elapsed < lightsOutUntil;
      const torchOn = flashlightState.on && flashlightState.battery > 0 && !blackout;
      // La poussiere n'existe que dans le faisceau. Laissee visible lampe
      // eteinte, elle remplissait le noir de points blancs et noyait la
      // seule chose qu'on doit y voir : ses yeux.
      dustMat.opacity = torchOn ? 0.34 * torchFlicker : 0.04;
      // Eteinte = intensite nulle, la lumiere reste dans la scene : sinon
      // chaque F recompilait les shaders et faisait sauter une image.
      // Cache, on garde la lampe contre soi : sinon elle eblouit l'interieur
      // des battants a quelques centimetres.
      flashlight.intensity = torchOn ? 6.5 * brightness * torchFlicker * (isHiding ? 0.1 : 1) : 0;
      torchLens.visible = torchOn && torchFlicker > 0.5;
      playerGlow.intensity =
        (torchOn ? glowOnIntensity : glowOffIntensity) *
        (0.4 + torchFlicker * 0.6) *
        (blackout ? 0.35 : 1) *
        (isHiding ? 0.06 : 1);
      if (flashlightState.on) {
        flashlightState.battery = Math.max(0, flashlightState.battery - FLASHLIGHT_DRAIN_PER_SEC * delta);
        if (flashlightState.battery <= 0) {
          flashlightState.on = false;
          setFlashlightOn(false);
        }
      } else {
        flashlightState.battery = Math.min(100, flashlightState.battery + FLASHLIGHT_REGEN_PER_SEC * delta);
      }
      batteryUiTimer += delta;
      if (batteryUiTimer > 0.15) {
        batteryUiTimer = 0;
        setBattery(Math.round(flashlightState.battery));
      }

      for (const s of sconces) {
        if (s.dead) continue;
        s.light.intensity = s.base + Math.sin(elapsed * 6 + s.phase) * 0.08 + (Math.random() - 0.5) * 0.05;
      }

      // Ouverture progressive de la porte de la cave.
      if (!doorLocked && doorSwing < 1) {
        doorSwing = Math.min(1, doorSwing + delta * 0.9);
        doorHinges[0].rotation.y = -doorSwing * 1.5;
        doorHinges[1].rotation.y = doorSwing * 1.5;
      }
      for (const door of keyDoors) {
        if (!door.open || door.swing >= 1) continue;
        door.swing = Math.min(1, door.swing + delta * 0.9);
        door.hinges[0].rotation.y = -door.swing * 1.5;
        door.hinges[1].rotation.y = door.swing * 1.5;
      }

      // Objets au sol : ils tournent doucement sur eux-memes.
      for (const p of pickups) if (!p.taken) writePickup(p);
      for (const mesh of Object.values(pickupMeshes)) mesh.instanceMatrix.needsUpdate = true;

      // Pieces lancees : une parabole, puis le bruit la ou elles tombent.
      for (let i = thrownCoins.length - 1; i >= 0; i--) {
        const c = thrownCoins[i];
        const t = Math.min(1, (elapsed - c.at) / c.duration);
        if (!c.landed) {
          const x = THREE.MathUtils.lerp(c.fromX, c.toX, t);
          const z = THREE.MathUtils.lerp(c.fromZ, c.toZ, t);
          const ground = floorHeightAt(z) + 0.02;
          const y = THREE.MathUtils.lerp(c.fromY, ground, t) + Math.sin(t * Math.PI) * 0.7;
          c.mesh.position.set(x * CELL_SIZE, y, z * CELL_SIZE);
          c.mesh.rotation.x += delta * 18;
          if (t >= 1) {
            c.landed = true;
            c.mesh.rotation.set(-Math.PI / 2, 0, Math.random() * 3);
            emitNoise("piece", c.toX, c.toZ);
            playCoinLand(audio.ctx, audio.master, spatialFor(c.toX, c.toZ, 22, 1));
          }
        } else if (elapsed - c.at > 30) {
          scene.remove(c.mesh);
          thrownCoins.splice(i, 1);
        }
      }

      // Boites a musique posees : elles appellent la chose tant qu'elles jouent.
      for (let i = musicBoxes.length - 1; i >= 0; i--) {
        const box = musicBoxes[i];
        if (elapsed < box.until) {
          if (elapsed >= box.nextNoiseAt) {
            box.nextNoiseAt = elapsed + 0.6;
            emitNoise("boite-a-musique", box.x, box.z);
          }
          const place = spatialFor(box.x, box.z, 24, 1);
          box.sound.place(place.pan, place.gain);
          box.mesh.rotation.y += delta * 0.6;
        } else if (elapsed - box.until > 20) {
          scene.remove(box.mesh);
          musicBoxes.splice(i, 1);
        } else {
          box.sound.stop();
        }
      }

      // Le bruit que fait le joueur, pour la jauge : il retombe tout seul.
      noiseLevel = Math.max(0, noiseLevel - delta * 0.9);
      if (Math.abs(noiseLevel - lastSyncedNoise) > 0.04 || (noiseLevel === 0 && lastSyncedNoise !== 0)) {
        lastSyncedNoise = noiseLevel;
        setNoiseMeter(noiseLevel);
      }

      // Cache : on retient son souffle (Espace), ou elle t'entend respirer.
      if (isHiding) {
        const holding = (keys.has(" ") || heldRef.current.breath) && !breathLocked;
        if (holding) {
          if (!wasHoldingBreath) playBreathHold(audio.ctx, audio.master);
          breathLeft = Math.max(0, breathLeft - delta / BREATH_HOLD_SECONDS);
          if (breathLeft <= 0) {
            // On ne tient plus : le souffle repart d'un coup.
            breathLocked = true;
            playGasp(audio.ctx, audio.master);
            emitNoise("haletement");
            flashLevel = Math.max(flashLevel, 0.25);
          }
        } else {
          breathLeft = Math.min(1, breathLeft + delta / (BREATH_HOLD_SECONDS * 0.7));
          if (breathLocked && breathLeft >= 0.5) breathLocked = false;
          // Elle rode : ta respiration s'emballe et s'entend a travers la porte.
          if (monster.active && distToMonster < 4 && elapsed >= nextPlayerBreathAt) {
            nextPlayerBreathAt = elapsed + 1.4 + Math.random() * 0.4;
            playPlayerBreath(audio.ctx, audio.master);
            emitNoise("respiration");
          }
        }
        if (holding !== wasHoldingBreath) {
          wasHoldingBreath = holding;
          setHoldingBreath(holding);
        }
        if (Math.abs(breathLeft - lastSyncedBreath) > 0.03 || (breathLeft === 1 && lastSyncedBreath !== 1)) {
          lastSyncedBreath = breathLeft;
          setBreath(breathLeft);
        }
      }

      // Piece actuelle.
      const room = roomAt(data.rooms, Math.floor(player.x), Math.floor(player.z));
      const roomName = room?.name ?? null;
      if (roomName && roomName !== currentRoomName) {
        currentRoomName = roomName;
        setRoomLabel(roomName);
        roomLabelHideAt = elapsed + ROOM_LABEL_SECONDS;
        if (!visitedRooms.has(roomName)) {
          visitedRooms.add(roomName);
          const scarePainting = roomName === "Cave" ? paintingsByRoom.get(roomName) : undefined;
          if (scarePainting && !fallingPainting) {
            fallingPainting = scarePainting;
            fallStartAt = elapsed;
            fallFromY = scarePainting.position.y;
            fallFromZ = scarePainting.position.z;
            flashLevel = Math.max(flashLevel, 0.8);
            playCrash(audio.ctx, audio.master);
          }
          // Premiere fois dans la chambre murée : elle etait la, juste une image.
          if (roomName === "Chambre condamnée" && !scaredRooms.has(roomName) && phase === "none") {
            scaredRooms.add(roomName);
            triggerFaceScare();
          }
        }
      }

      if (fallingPainting) {
        const p = Math.min(1, (elapsed - fallStartAt) / PAINTING_FALL_SECONDS);
        const eased = p * p;
        fallingPainting.position.y = THREE.MathUtils.lerp(fallFromY, 0.06, eased);
        fallingPainting.position.z = THREE.MathUtils.lerp(fallFromZ, fallFromZ + 0.42, eased);
        fallingPainting.rotation.x = THREE.MathUtils.lerp(0, -Math.PI / 2, eased);
        if (p >= 1) fallingPainting = null;
      }
      if (roomLabelHideAt >= 0 && elapsed > roomLabelHideAt) {
        roomLabelHideAt = -1;
        setRoomLabel(null);
      }
      if (toastHideAt >= 0 && elapsed > toastHideAt) {
        toastHideAt = -1;
        setToast(null);
      }
      if (hintHideAt >= 0 && elapsed > hintHideAt) {
        hintHideAt = -1;
        setHint(null);
      }

      // Plaques : notees automatiquement quand on s'en approche.
      for (const plaque of cluePlaques) {
        if (plaque.found) continue;
        if (Math.hypot(player.x - plaque.x, player.z - plaque.z) < CLUE_REACH) {
          plaque.found = true;
          playPickup(audio.ctx, audio.master);
          setClues((c) =>
            [...c, { rank: plaque.rank, digit: plaque.digit, room: plaque.room }].sort(
              (a, b) => a.rank - b.rank,
            ),
          );
          showHint(`Chiffre noté : ${plaque.digit} (position ${plaque.rank + 1})`, 4);
        }
      }

      // Objets.
      for (const item of items) {
        if (item.collected) continue;
        item.group.rotation.y += delta * 1.2;
        const dx = player.x - item.x;
        const dz = player.z - item.z;
        if (dx * dx + dz * dz < 0.4 * 0.4) {
          item.collected = true;
          collectedCount++;
          flyToHand(item.group);
          playPickup(audio.ctx, audio.master);
          setItemsFound((n) => n + 1);
          setRelics((r) => [...r, item.def]);
          setToast(item.def);
          toastHideAt = elapsed + TOAST_SECONDS;
          if (collectedCount === 1) awakenMonster();
          if (collectedCount === ITEM_COUNT) {
            // Avec les 5 objets elle court plus vite que toi lampe allumee :
            // sans cet avertissement, la mecanique reste invisible.
            window.setTimeout(
              () =>
                showHint(
                  "Elle est plus rapide que toi. Coupe ta lampe, casse sa ligne de vue et cache-toi pour la semer.",
                  6,
                ),
              1400,
            );
          }
          // Le manoir souffle une bougie a chaque objet vole : plus tu
          // avances, moins tu vois.
          const doomed = sconces[candlesOut];
          if (doomed) {
            doomed.dead = true;
            // Intensite a zero et PAS visible=false : changer le nombre de
            // lumieres visibles force la recompilation de tous les shaders,
            // d'ou une saccade a chaque relique.
            doomed.light.intensity = 0;
            doomed.flame.visible = false;
            candlesOut++;
            window.setTimeout(() => playCandleOut(audio.ctx, audio.master), 420);
          }
        }
      }

      // Poupees : la tete suit le joueur, et on les ramasse au contact.
      {
        const look = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw);
        dolls.update({ playerX: player.x, playerZ: player.z, lookX: look.x, lookZ: look.z, time: elapsed });
      }
      for (let i = 0; i < DOLL_SPOTS.length; i++) {
        if (dollTaken[i]) continue;
        const spot = DOLL_SPOTS[i];
        if (Math.hypot(player.x - (spot.x + 0.5), player.z - (spot.y + 0.5)) >= DOLL_REACH) continue;
        dollTaken[i] = true;
        dolls.hide(i);
        reachAt = elapsed;
        dollCount++;
        setDollsFound(dollCount);
        playPickup(audio.ctx, audio.master);
        playWhisper(audio.ctx, audio.master, { pan: Math.random() * 2 - 1, gain: 0.7 });
        flashLevel = Math.max(flashLevel, 0.25);
        if (dollCount < DOLL_SPOTS.length) {
          showHint(`🧸 Poupée ${dollCount}/${DOLL_SPOTS.length}. Elle est encore tiède.`, 3);
        } else {
          dollBlessing = true;
          shieldReady = true;
          setDollShield(true);
          flashLevel = Math.max(flashLevel, 0.7);
          playRitual(audio.ctx, audio.master);
          showHint("🧸 Les cinq poupées. Tu cours plus vite — et elles te sauveront une fois.", 6);
        }
      }

      updateScares(delta);

      // Objectif courant. Un changement d'etape declenche le carton d'acte ;
      // un simple changement de detail (une plaque trouvee) ne le rejoue pas.
      const nextQuest = computeQuest();
      if (nextQuest.id !== lastQuestId || nextQuest.where !== lastQuestWhere) {
        const isNewAct = nextQuest.id !== lastQuestId;
        lastQuestId = nextQuest.id;
        lastQuestWhere = nextQuest.where;
        setQuest(nextQuest);
        if (isNewAct) {
          setActCard(nextQuest);
          actCardHideAt = elapsed + ACT_CARD_SECONDS;
        }
      }
      if (actCardHideAt >= 0 && elapsed > actCardHideAt) {
        actCardHideAt = -1;
        setActCard(null);
      }

      // Carte du mode developpeur. Rien n'est calcule tant que le panneau est
      // ferme : un joueur normal ne paie pas un octet de ce mode.
      if (devOpenRef.current) {
        devSnapTimer -= delta;
        if (devSnapTimer <= 0) {
          devSnapTimer = 0.25;
          setDevSnap({
            player: { x: player.x, z: player.z, yaw: player.yaw },
            monster: { x: monster.x, z: monster.z, active: monster.active },
            relics: items.filter((i) => !i.collected).map((i) => ({ x: i.x, z: i.z })),
            dolls: DOLL_SPOTS.filter((_, i) => !dollTaken[i]).map((d) => ({ x: d.x + 0.5, z: d.y + 0.5 })),
            plaques: cluePlaques.map((pl) => ({
              x: pl.x,
              z: pl.z,
              digit: pl.digit,
              rank: pl.rank,
              found: pl.found,
            })),
            seals: phase === "seals" ? seals.map((sl) => ({ x: sl.x, z: sl.z, broken: sl.broken })) : [],
            pickups: pickups
              .filter((p) => !p.taken)
              .map((p) => ({ x: p.x, z: p.z, kind: p.visual })),
            keyDoors: keyDoors.map((d) => ({
              x0: d.def.x0,
              y0: d.def.y0,
              x1: d.def.x1,
              y1: d.def.y1,
              open: d.open,
            })),
            monsterState: monster.active ? monsterState : "endormie",
            phase,
            code: codeRef.current.join(""),
            doorLocked,
            flyHeight: devFlyHeight,
            fps: Math.round(1000 / Math.max(1, frameMsAvg)),
            pixelRatio,
          });
        }
      }

      // Boussole du final. Le manoir est trop grand pour chercher un sceau au
      // hasard avec elle aux trousses : pendant la survie, elle pointe la
      // chose elle-meme, ce qui est encore pire a regarder.
      guideTimer -= delta;
      if (guideTimer <= 0) {
        guideTimer = 0.12;
        let target: { x: number; z: number; kind: "seal" | "monster" | "hatch" } | null = null;
        if (phase === "seals") {
          let bestD = Infinity;
          for (const s of seals) {
            if (s.broken) continue;
            const d = Math.hypot(player.x - s.x, player.z - s.z);
            if (d < bestD) {
              bestD = d;
              target = { x: s.x, z: s.z, kind: "seal" };
            }
          }
        } else if (phase === "survive") {
          // Sur la fin, on cesse de montrer la chose pour montrer la trappe :
          // sans ca, on se retrouve a l'autre bout du manoir au top depart.
          target =
            SURVIVE_SECONDS - (elapsed - surviveStartedAt) <= HATCH_HINT_SECONDS
              ? { x: HATCH.x + 0.5, z: HATCH.y + 0.5, kind: "hatch" }
              : { x: monster.x, z: monster.z, kind: "monster" };
        } else if (phase === "escape") {
          target = { x: HATCH.x + 0.5, z: HATCH.y + 0.5, kind: "hatch" };
        }
        if (target) {
          // La camera regarde vers son -Z local : son cap, dans la meme
          // convention que atan2(dx, dz), vaut donc yaw + PI. L'angle rendu
          // est l'oppose de l'ecart (une cible a droite se lit en rotation
          // horaire, sens positif en CSS).
          const bearing = Math.atan2(target.x - player.x, target.z - player.z);
          let angle = player.yaw + Math.PI - bearing;
          while (angle > Math.PI) angle -= Math.PI * 2;
          while (angle < -Math.PI) angle += Math.PI * 2;
          setGuide({
            angle,
            distance: Math.hypot(target.x - player.x, target.z - player.z) * CELL_SIZE,
            kind: target.kind,
          });
        } else if (lastGuideKind !== null) {
          setGuide(null);
        }
        lastGuideKind = target?.kind ?? null;
      }

      // Invite d'interaction.
      let promptText: string | null = null;
      const pickupHere = isHiding ? null : nearestPickup();
      const keyDoorHere = isHiding || pickupHere ? null : nearestKeyDoor();
      if (isHiding) {
        promptText = "E — Sortir de la cachette";
      } else if (pickupHere) {
        promptText = `E — Ramasser ${pickupLabel(pickupHere.spot.kind)}`;
      } else if (doorLocked && distanceToDoor() < DOOR_REACH) {
        promptText = "E — Examiner la serrure";
      } else if (keyDoorHere) {
        promptText = inv.keys.includes(keyDoorHere.def.key)
          ? `E — Ouvrir : ${keyDoorHere.def.label} (${KEY_NAMES[keyDoorHere.def.key].emoji})`
          : `🔒 ${keyDoorHere.def.label} — fermée à clé`;
      } else if (canOfferAtAltar()) {
        promptText = "E — Déposer les 5 objets";
      } else if (phase === "none" && !doorLocked && distanceToAltar() < ALTAR_REACH) {
        const missing = ITEM_COUNT - collectedCount;
        promptText = `Il manque ${missing} objet${missing > 1 ? "s" : ""} sur l'autel`;
      } else if (phase === "none" || phase === "seals") {
        const spot = nearestHideout();
        if (spot) promptText = spot.kind === "bed" ? "E — Se glisser sous le lit" : "E — Se cacher dans l'armoire";
      }
      if (promptText !== lastPromptText) {
        lastPromptText = promptText;
        setPrompt(promptText);
      }

      if (elapsed >= nextStingerAt) {
        // Le bruit vient d'une direction precise, jamais du centre.
        const a = Math.random() * Math.PI * 2;
        playStinger(audio.ctx, audio.master, { pan: Math.sin(a) * 0.9, gain: 0.85 });
        flashLevel = Math.max(flashLevel, 0.22);
        nextStingerAt = elapsed + STINGER_MIN_DELAY + Math.random() * (STINGER_MAX_DELAY - STINGER_MIN_DELAY);
      }

      // Une porte claque quelque part. Il n'y a personne. Enfin, si.
      if (elapsed >= nextSlamAt) {
        nextSlamAt = elapsed + 26 + Math.random() * 24;
        playDoorSlam(audio.ctx, audio.master, {
          pan: (Math.random() * 2 - 1) * 0.85,
          gain: 0.5 + Math.random() * 0.3,
        });
        flashLevel = Math.max(flashLevel, 0.3);
      }

      // Avant qu'elle ne se reveille : de breves apparitions au loin, juste
      // assez longues pour que tu doutes de les avoir vues.
      if (!monster.active && elapsed >= nextGlimpseAt && glimpseUntil < 0) {
        nextGlimpseAt = elapsed + 26 + Math.random() * 20;
        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw);
        for (let attempt = 0; attempt < 30; attempt++) {
          const [cx, cy] = openCells[Math.floor(Math.random() * openCells.length)];
          const gx = cx + 0.5;
          const gz = cy + 0.5;
          const dx = gx - player.x;
          const dz = gz - player.z;
          const d = Math.hypot(dx, dz);
          if (d < 5 || d > 11) continue;
          if ((dx / d) * forward.x + (dz / d) * forward.z < 0.55) continue;
          if (!hasLineOfSight(player.x, player.z, gx, gz)) continue;
          monsterGroup.position.set(gx * CELL_SIZE, floorHeightAt(gz), gz * CELL_SIZE);
          // Elle est de dos ou de trois quarts, et seule la tete est tournee
          // vers toi. Une apparition qui te fixe sans bouger le corps est plus
          // derangeante qu'une silhouette qui te fait face.
          bodyYaw = Math.atan2(player.x - gx, player.z - gz) + (Math.random() < 0.5 ? 1.5 : -1.5);
          monsterGroup.rotation.set(0, bodyYaw, 0);
          monsterWalk = 0;
          lungeLevel = 0;
          let glimpseYaw = Math.atan2(player.x - gx, player.z - gz) - bodyYaw;
          while (glimpseYaw > Math.PI) glimpseYaw -= Math.PI * 2;
          while (glimpseYaw < -Math.PI) glimpseYaw += Math.PI * 2;
          beast.neck.rotation.y = glimpseYaw;
          poseMonster(beast, {
            time: elapsed,
            walk: 0,
            speed: 0,
            headYaw: glimpseYaw,
            headPitch: 0,
            lunge: 0,
          });
          monsterGroup.visible = true;
          glimpseUntil = elapsed + 0.9;
          playWhisper(audio.ctx, audio.master, spatialFor(gx, gz, 14, 0.9));
          break;
        }
      }
      if (glimpseUntil > 0 && elapsed > glimpseUntil) {
        glimpseUntil = -1;
        if (!monster.active) monsterGroup.visible = false;
      }

      if (!monster.active && elapsed > MONSTER_GRACE_SECONDS_IDLE) awakenMonster();
      if (monster.active) {
        // Pendant le rituel elle attend sur le seuil, immobile, et te fixe.
        // Elle ne bondit qu'une fois la trappe ouverte, apres un temps mort.
        const held =
          phase === "ritual" ||
          (phase === "seals" && elapsed - chaseStartedAt < CHASE_RELEASE_SECONDS) ||
          (phase === "escape" && elapsed - escapeStartedAt < 0.5);
        const stunned = elapsed < monsterStunUntil;
        let moved = false;

        // --- Le cerveau : elle ne sait plus ou tu es, elle voit et elle entend. ---
        thinkTimer -= delta;
        if (thinkTimer <= 0) {
          thinkTimer = THINK_INTERVAL;
          noises = pruneNoises(noises, elapsed);
          // Le final reste une vraie poursuite : elle sait. Sauf si tu t'es
          // cache pendant les sceaux, ou la ruse redevient possible.
          const forceChase = phase === "survive" || phase === "escape" || (phase === "seals" && !isHiding);
          const decision = thinkMonster(
            brain,
            {
              now: elapsed,
              monster: { x: monster.x, z: monster.z },
              player: { x: player.x, z: player.z, hidden: isHiding },
              canSee: monsterCanSee,
              noises,
              noiseWalls: noises.map((n) => wallsBetween(n.x, n.z, monster.x, monster.z, isSolid)),
              forceChase,
              pressure: collectedCount / ITEM_COUNT,
            },
            mapQuery,
            Math.random,
          );
          monsterMode = decision.speed;
          monsterState = decision.state;
          if (decision.noticed && !forceChase && !held) {
            playShriek(audio.ctx, audio.master, monsterSpatial(18, 1.2));
            flashLevel = Math.max(flashLevel, 0.45);
          } else if (decision.alerted && distToMonster < 16 && elapsed >= nextGrowlAt) {
            nextGrowlAt = elapsed + 5;
            playGrowl(audio.ctx, audio.master, monsterSpatial(16, 1));
          }

          // Cache, mais elle t'entend respirer tout contre la porte : elle sait.
          if (isHiding && currentHideout && brain.state !== "debusquer") {
            for (const n of noises) {
              if (n.kind !== "respiration" && n.kind !== "haletement") continue;
              const walls = wallsBetween(n.x, n.z, monster.x, monster.z, isSolid);
              const level = audibility(n, monster.x, monster.z, elapsed, walls);
              if (level >= (n.kind === "haletement" ? 0.12 : 0.35)) {
                noteHidingSeen(brain, approachCell(currentHideout), elapsed);
                monsterState = "debusquer";
                playShriek(audio.ctx, audio.master, monsterSpatial(12, 1.2));
                break;
              }
            }
          }

          const goal = decision.goal ? nearestOpenCell(decision.goal[0], decision.goal[1]) : null;
          const goalKey = goal ? cellKey(goal[0], goal[1]) : "";
          monster.repathTimer -= THINK_INTERVAL;
          if (
            goal &&
            (goalKey !== monster.goalKey ||
              monster.repathTimer <= 0 ||
              !monster.path ||
              monster.pathIndex >= monster.path.length)
          ) {
            monster.goalKey = goalKey;
            monster.repathTimer = REPATH_INTERVAL;
            monster.path = bfsPath(
              [Math.floor(monster.x), Math.floor(monster.z)],
              goal,
              isSolid,
              data.width,
              data.height,
            );
            monster.pathIndex = 0;
          }
        }

        const itemBonus = collectedCount * SPEED_PER_ITEM;
        // Chaque objet vole la rend plus rapide. Pendant les sceaux et la
        // survie elle est un peu plus lente que toi : fuir marche, s'arreter
        // non. Lampe eteinte, elle perd encore du terrain.
        const finaleBase =
          phase === "escape"
            ? MONSTER_SPEED_FINALE
            : phase === "survive"
              ? MONSTER_SPEED_SURVIVE
              : phase === "seals"
                ? MONSTER_SPEED_SEALS
                : 0;
        const torchLit = flashlightState.on && flashlightState.battery > 0;
        const speed =
          monsterMode === "fuite" && finaleBase > 0
            ? finaleBase - (torchLit || phase === "escape" ? 0 : DARK_SPEED_BONUS)
            : monsterMode === "chasse"
              ? Math.max(MONSTER_SPEED_HUNTING + itemBonus, finaleBase)
              : monsterMode === "marche"
                ? MONSTER_SPEED_BASE + itemBonus * 0.6
                : MONSTER_SPEED_WANDER + itemBonus * 0.4;

        // Ses pas, sa respiration, ses chuchotements : tous places dans
        // l'espace. C'est ce qui rend la traque insupportable.
        if (elapsed >= nextMonsterStepAt && distToMonster < 13 && !stunned) {
          nextMonsterStepAt = elapsed + 0.52 / Math.max(0.6, speed / MONSTER_SPEED_BASE);
          playFootstep(audio.ctx, audio.master, monsterSpatial(13, 1.6));
        }
        if (losToMonster && distToMonster < 11 && elapsed >= nextWhisperAt) {
          nextWhisperAt = elapsed + 2.6 + Math.random() * 3;
          playWhisper(audio.ctx, audio.master, monsterSpatial(12, 1.1));
        }
        if (distToMonster < 4.5 && elapsed >= nextBreathAt) {
          nextBreathAt = elapsed + 2.2 + Math.random() * 1.6;
          playBreath(audio.ctx, audio.master, monsterSpatial(5, 1.3));
        }

        const canMove = !held && !stunned && !devRef.current.freeze;
        // Dernier metre : elle vient droit sur toi, meme si tu t'es colle a un
        // meuble dont la case est pleine pour son chemin.
        const lunging =
          canMove &&
          monsterState === "poursuivre" &&
          (monsterCanSee || monsterMode === "fuite") &&
          !isHiding &&
          distToMonster < 1.6;
        if (lunging) {
          const dx = player.x - monster.x;
          const dz = player.z - monster.z;
          const d = Math.hypot(dx, dz);
          if (d > 0.2) {
            const stepLen = Math.min(speed * delta, d - 0.2);
            const nx = monster.x + (dx / d) * stepLen;
            const nz = monster.z + (dz / d) * stepLen;
            if (!circleBlocked(nx, monster.z, 0.2)) monster.x = nx;
            if (!circleBlocked(monster.x, nz, 0.2)) monster.z = nz;
            let turn = Math.atan2(dx, dz) - bodyYaw;
            while (turn > Math.PI) turn -= Math.PI * 2;
            while (turn < -Math.PI) turn += Math.PI * 2;
            bodyYaw += turn * Math.min(1, delta * 6);
            monsterWalk += (speed / 1.2) * delta * Math.PI;
            moved = true;
          }
        } else if (canMove && monster.path && monster.pathIndex < monster.path.length) {
          const [tx, ty] = monster.path[monster.pathIndex];
          const targetX = tx + 0.5;
          const targetZ = ty + 0.5;
          const dx = targetX - monster.x;
          const dz = targetZ - monster.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.08) {
            monster.pathIndex++;
          } else {
            const stepLen = Math.min(speed * delta, dist);
            monster.x += (dx / dist) * stepLen;
            monster.z += (dz / dist) * stepLen;
            // Le corps regarde LA OU IL VA, pas le joueur : c'est ce qui
            // permet a la tete de rester braquee sur toi de travers.
            const wantBody = Math.atan2(dx, dz);
            let turn = wantBody - bodyYaw;
            while (turn > Math.PI) turn -= Math.PI * 2;
            while (turn < -Math.PI) turn += Math.PI * 2;
            bodyYaw += turn * Math.min(1, delta * 4.5);
            monsterWalk += (speed / 1.2) * delta * Math.PI;
            moved = true;
          }
        }
        monsterGroup.position.set(
          monster.x * CELL_SIZE,
          floorHeightAt(monster.z) + Math.abs(Math.sin(monsterWalk)) * 0.03,
          monster.z * CELL_SIZE,
        );
        // Orientation calculee a la main plutot que lookAt() : lookAt renvoie
        // des angles d'Euler en blocage de cardan quand la cible est a la meme
        // hauteur, et ecraser rotation.z ensuite couchait le monstre au sol.
        // Brulee par le sel, elle se tord sur place.
        monsterGroup.rotation.set(0, bodyYaw + (stunned ? Math.sin(elapsed * 22) * 0.12 : 0), 0);

        // Elle se ramasse quand elle est SUR toi, pas des qu'elle approche :
        // reservee au dernier metre et demi, la pose de saisie garde sa force.
        const lungeTarget = distToMonster < 1.5 && !held && !stunned && !isHiding ? 1 - distToMonster / 1.5 : 0;
        lungeLevel += (lungeTarget - lungeLevel) * Math.min(1, delta * 5);

        // Lacet vers le joueur, exprime dans le repere du corps.
        let headYaw = Math.atan2(player.x - monster.x, player.z - monster.z) - bodyYaw;
        while (headYaw > Math.PI) headYaw -= Math.PI * 2;
        while (headYaw < -Math.PI) headYaw += Math.PI * 2;
        // Elle ne te fixe que si elle te voit (ou te sait la). Sinon elle
        // cherche : la tete balaie la piece, ou se tourne vers le bruit.
        const knows = monsterCanSee || monsterState === "debusquer" || monsterMode === "fuite";
        let lookYaw = knows ? headYaw : Math.sin(elapsed * 1.3) * (monsterState === "errer" ? 0.8 : 1.5);
        if (!knows && monsterState === "enqueter" && brain.goal) {
          let toGoal = Math.atan2(brain.goal[0] + 0.5 - monster.x, brain.goal[1] + 0.5 - monster.z) - bodyYaw;
          while (toGoal > Math.PI) toGoal -= Math.PI * 2;
          while (toGoal < -Math.PI) toGoal += Math.PI * 2;
          lookYaw = THREE.MathUtils.clamp(toGoal, -1.3, 1.3);
        }
        poseMonster(beast, {
          time: elapsed,
          walk: monsterWalk,
          speed: moved ? speed : 0,
          headYaw: lookYaw,
          headPitch: stunned
            ? 0.65
            : THREE.MathUtils.clamp((EYE_HEIGHT - 2.1) / Math.max(1, distToMonster), -0.5, 0.7),
          lunge: lungeLevel,
        });

        // Elle t'a vue entrer, ou entendue respirer : elle ouvre la cachette.
        const debusked =
          isHiding &&
          currentHideout !== null &&
          monsterState === "debusquer" &&
          !held &&
          !stunned &&
          distToFootprint(monster.x, monster.z, currentHideout.fp) < DEBUSK_REACH;

        const capDx = monster.x - player.x;
        const capDz = monster.z - player.z;
        const touched =
          debusked ||
          (!held && !stunned && !isHiding && capDx * capDx + capDz * capDz < CAPTURE_RADIUS * CAPTURE_RADIUS);
        if (touched && (devRef.current.god || elapsed < shieldGraceUntil)) {
          // Invincible, ou juste protege : on ne meurt pas une seconde plus tard.
        } else if (touched && shieldReady) {
          // Les poupees hurlent, elle est rejetee a l'autre bout du manoir.
          if (isHiding) toggleHide();
          shieldReady = false;
          setDollShield(false);
          shieldGraceUntil = elapsed + SHIELD_GRACE_SECONDS;
          let far: [number, number] = monsterStart;
          let farD = -1;
          for (const [cx, cy] of reachableCells) {
            const dd = Math.abs(cx - player.x) + Math.abs(cy - player.z);
            if (dd > farD) {
              farD = dd;
              far = [cx, cy];
            }
          }
          monster.x = far[0] + 0.5;
          monster.z = far[1] + 0.5;
          monster.path = null;
          monster.pathIndex = 0;
          monster.repathTimer = 1.2;
          brain.state = "errer";
          brain.goal = null;
          brain.hideout = null;
          flashLevel = 1;
          setScareFlash(1);
          playDeathScream(audio.ctx, audio.master);
          showHint("Les poupées hurlent. Elle est rejetée — tu ne seras plus protégé.", 5);
        } else if (touched) {
          // Tiree de la cachette : on ressort face a elle pour le screamer.
          if (isHiding) toggleHide();
          dyingSince = elapsed;
          endedRef.current = true;
          flashLevel = 1;
          setScareFlash(1);
          setKeypadOpen(false);
          setBagOpen(false);
          setReadingNote(null);
          setScreamer(null);
          ghost.setOpacity(0);
          ghostMode = "none";
          playDeathScream(audio.ctx, audio.master);
          try {
            document.exitPointerLock?.();
          } catch {
            // ignore
          }
        } else if (distToMonster < NEAR_MISS_RADIUS && !isHiding && elapsed >= nextNearMissAllowedAt) {
          nextNearMissAllowedAt = elapsed + NEAR_MISS_COOLDOWN;
          flashLevel = Math.max(flashLevel, 0.7);
          playNearMiss(audio.ctx, audio.master);
        }

        const proximity = THREE.MathUtils.clamp(1 - distToMonster / 14, 0, 1);
        const interval = THREE.MathUtils.lerp(1.1, 0.26, proximity);
        if (elapsed >= nextHeartbeatAt) {
          playHeartbeat(audio.ctx, audio.master, { gain: 0.7 + proximity * 0.9 });
          nextHeartbeatAt = elapsed + interval;
        }
      }

      // Angoisse : la proximite compte double quand elle te voit. C'est ce
      // niveau qui pilote la vignette, le tremblement et la dissonance.
      const proximityDread = monster.active
        ? THREE.MathUtils.clamp(1 - distToMonster / 11, 0, 1) * (losToMonster ? 1 : 0.55)
        : 0;
      const progressDread = collectedCount / (ITEM_COUNT * 2);
      // Le final gardait l'angoisse bloquee a 1 : vignette fermee, voile rouge
      // et grain au maximum pendant plusieurs minutes, on ne voyait plus rien
      // (juste apres l'autel, toutes les bougies etant deja mortes). Le final
      // pose maintenant un fond de tension ; c'est SA proximite qui fait le reste.
      const finaleDread = phase === "none" || phase === "ritual" ? 0 : 0.42;
      const flyingHigh = devRef.current.fly && devFlyHeight > 2;
      const target = flyingHigh ? 0 : Math.min(1, Math.max(proximityDread, progressDread, finaleDread));
      dreadLevel += (target - dreadLevel) * Math.min(1, delta * 3.2);
      audio.setTension(dreadLevel);
      // Elle te voit vraiment : l'image decroche. On ne le synchronise que
      // sur changement, pas a chaque image.
      const seesYou = monster.active && losToMonster && distToMonster < 9 && dyingSince < 0;
      if (seesYou !== lastSeen) {
        lastSeen = seesYou;
        setSeen(seesYou);
      }
      if (Math.abs(dreadLevel - lastSyncedDread) > 0.03) {
        lastSyncedDread = dreadLevel;
        setDread(dreadLevel);
      }
      // Le souffle du joueur fait trembler la camera quand la terreur monte.
      if (dreadLevel > 0.25 && dyingSince < 0) {
        const shake = (dreadLevel - 0.25) * 0.028;
        camera.rotation.x += Math.sin(elapsed * 13.7) * shake;
        camera.rotation.z += Math.sin(elapsed * 9.1) * shake;
      }

      flashLevel = Math.max(0, flashLevel - delta * 1.1);
      if (Math.abs(flashLevel - lastSyncedFlash) > 0.02 || (flashLevel === 0 && lastSyncedFlash !== 0)) {
        lastSyncedFlash = flashLevel;
        setScareFlash(flashLevel);
      }

      // --- Rituel : les objets tournent au-dessus de l'autel, puis la
      // trappe s'ouvre et la course commence. ---
      if (phase === "ritual") {
        const t = (elapsed - ritualStartedAt) / RITUAL_SECONDS;
        offeringGroup.rotation.y += delta * (1.2 + t * 5);
        offeringGroup.position.y = 1.1 + t * 0.55;
        offeringGroup.scale.setScalar(1 + t * 0.5);
        flashLevel = Math.max(flashLevel, Math.min(0.75, t * 0.9));
        if (t >= 1) {
          // Le rituel ne libere plus la sortie : il revele une trappe scellee
          // par trois chaines. La vraie fin commence ici.
          phase = "seals";
          chaseStartedAt = elapsed;
          setFinale("seals");
          offeringGroup.visible = false;
          hatchGroup.visible = true;
          seals.forEach((seal, i) => {
            seal.group.visible = true;
            // Les bougies sont toutes mortes depuis le rituel : leurs lumieres
            // sont libres. On les deplace sur les sceaux plutot que d'en creer
            // de nouvelles, pour que le nombre de lumieres reste FIXE toute la
            // partie (8) — aucune recompilation, aucune saccade.
            const borrowed = sconces[i]?.light;
            if (borrowed) {
              borrowed.color.setHex(0x7fd4ff);
              borrowed.distance = 6 * CELL_SIZE;
              borrowed.position.set(
                seal.x * CELL_SIZE,
                floorHeightAt(seal.z) + 1.3,
                seal.z * CELL_SIZE,
              );
              seal.light = borrowed;
            }
          });
          // Pendant le rituel elle bloque la porte de la cave, qui est la
          // seule issue : la laisser la rendait l'acte V immediatement perdu.
          // Le manoir se reveille, elle repart chasser depuis l'autre bout.
          monster.x = monsterStart[0] + 0.5;
          monster.z = monsterStart[1] + 0.5;
          monster.path = null;
          monster.pathIndex = 0;
          monster.repathTimer = 0;
          setSealsLeft(seals.length);
          playHatch(audio.ctx, audio.master);
          playWake(audio.ctx, audio.master);
          flashLevel = 1;
          showHint("La trappe est scellée. Trois sceaux, trois pièces. Cours.", 5);
        }
      }

      // --- Sceaux : ils cedent au contact, pas besoin de viser en pleine course ---
      if (phase === "seals") {
        for (const s of seals) {
          if (s.broken) continue;
          s.glow.position.y = 1.22 + Math.sin(elapsed * 2.4) * 0.06;
          if (s.light) s.light.intensity = (1.2 + Math.sin(elapsed * 5.5) * 0.35) * brightness;
          if (Math.hypot(player.x - s.x, player.z - s.z) >= SEAL_REACH) continue;
          s.broken = true;
          if (s.light) s.light.intensity = 0;
          s.glowMat.color.setHex(0x2b2724);
          const left = seals.filter((k) => !k.broken).length;
          setSealsLeft(left);
          const chain = hatchChains[left];
          if (chain) fallingChains.push({ mesh: chain, at: elapsed, side: left % 2 === 0 ? 1 : -1 });
          // L'orbe eclate : quelques eclats qui retombent et rebondissent.
          s.glow.visible = false;
          for (let k = 0; k < 9; k++) {
            const shard = new THREE.Mesh(shardGeo, shardMat);
            shard.position.set(s.group.position.x, s.group.position.y + 1.22, s.group.position.z);
            scene.add(shard);
            const a = Math.random() * Math.PI * 2;
            const force = 1.4 + Math.random() * 2.2;
            shards.push({
              mesh: shard,
              vx: Math.cos(a) * force,
              vy: 2 + Math.random() * 2.5,
              vz: Math.sin(a) * force,
              at: elapsed,
            });
          }
          playSealBreak(audio.ctx, audio.master, left);
          flashLevel = Math.max(flashLevel, 0.65);
          if (left > 0) {
            showHint(`Sceau brisé. Encore ${left}.`, 3);
          }
        }
        if (seals.every((s) => s.broken)) {
          phase = "survive";
          // Filet de securite : on ne demarre jamais un compte a rebours
          // enferme dans une armoire, la partie serait perdue d'avance.
          if (isHiding) toggleHide();
          surviveStartedAt = elapsed;
          setFinale("survive");
          flashLevel = 1;
          playHatchOpen(audio.ctx, audio.master);
          showHint("La trappe s'ouvre. Tiens 45 secondes.", 4);
        }
      }

      // --- Survie : la trappe s'ouvre lentement, elle ne lache plus rien ---
      if (phase === "survive") {
        const left = Math.max(0, SURVIVE_SECONDS - (elapsed - surviveStartedAt));
        const shown = Math.ceil(left);
        if (shown !== lastSurviveShown) {
          lastSurviveShown = shown;
          setSurviveLeft(shown);
          if (shown <= 10) playTick(audio.ctx, audio.master, shown <= 3);
          if (shown === HATCH_HINT_SECONDS) {
            showHint("Reviens vers la trappe : elle s'ouvre dans quelques secondes.", 4);
          }
        }
        // Le battant se souleve au fil du compte a rebours : on le voit venir.
        const opened = 1 - left / SURVIVE_SECONDS;
        hatchGlow.material.opacity = 0.2 + opened * 0.55;
        hatchGroup.scale.setScalar(1 + opened * 0.12);
        if (left <= 0) {
          phase = "escape";
          escapeStartedAt = elapsed;
          setFinale("escape");
          flashLevel = 1;
          playWake(audio.ctx, audio.master);
          showHint("LA TRAPPE ! COURS !", 3.5);
        }
      }

      if (phase === "escape") {
        hatchGlow.material.opacity = 0.55 + Math.sin(elapsed * 7) * 0.3;
        if (!ended && Math.hypot(player.x - (HATCH.x + 0.5), player.z - (HATCH.y + 0.5)) < HATCH_REACH) {
          ended = true;
          endedRef.current = true;
          onEscape();
        }
      }

      renderer.render(scene, camera);
    }

    // Une erreur dans une image ne doit jamais geler la partie : on la
    // signale une fois, on redessine quand meme, et on continue.
    let tickErrors = 0;
    function tick() {
      try {
        step();
        tickErrors = 0;
      } catch (err) {
        tickErrors++;
        if (tickErrors === 1) console.error("[Manoir Maudit] image ignorée :", err);
        // Une erreur qui se repete pendant le screamer de mort bloquerait
        // l'ecran de fin : on termine la sequence de force.
        if (dyingSince >= 0 && tickErrors > 30 && !ended) {
          ended = true;
          endedRef.current = true;
          onCaught();
        }
        try {
          if (!contextIsLost) renderer.render(scene, camera);
        } catch {
          // contexte graphique indisponible : l'ecran « image perdue » s'en charge
        }
      }
    }
    const intervalId = window.setInterval(tick, 16);
    tick();

    function handleResize() {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }
    window.addEventListener("resize", handleResize);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(initialVisibility);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("pageshow", onReturn);
      document.removeEventListener("visibilitychange", onVisibility);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      renderer.domElement.removeEventListener("contextmenu", onContextMenu);
      renderer.domElement.removeEventListener("click", onCanvasClick);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);
      document.removeEventListener("mousemove", onMouseMove);
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock?.();
      apiRef.current = null;
      for (const box of musicBoxes) box.sound.stop();
      audio.stop();
      audio.ctx.close().catch(() => {});
      beast.dispose();
      dolls.dispose();
      ghost.dispose();
      shardGeo.dispose();
      shardMat.dispose();
      saltMat.dispose();
      dustGeo.dispose();
      dustMat.dispose();
      doorLeafGeoX.dispose();
      padlockGeo.dispose();
      padlockMat.dispose();
      for (const look of Object.values(pickupLooks)) {
        look.geo.dispose();
        look.mat.dispose();
      }
      // Rendre la carte graphique TOUT DE SUITE. Sans ca, chaque aller-retour
      // sur la page laissait un contexte WebGL vivant ; au bout de quelques-uns
      // le navigateur tuait le plus vieux… parfois celui qu'on regardait :
      // ecran noir.
      renderer.forceContextLoss();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  const pressDigit = useCallback((d: string) => {
    setEntryError(false);
    setEntry((e) => (e.length >= CODE_LENGTH ? e : e + d));
  }, []);

  const submitCode = useCallback(() => {
    if (entry.length < CODE_LENGTH) return;
    const expected = codeRef.current.join("");
    if (entry === expected) {
      apiRef.current?.unlock();
      setKeypadOpen(false);
      setEntry("");
    } else {
      setEntryError(true);
      setEntry("");
      apiRef.current?.deny();
    }
  }, [entry]);

  // Le pave s'utilisait uniquement a la souris : au clavier, taper le code
  // ne faisait rien du tout.
  useEffect(() => {
    if (!keypadOpen) return;
    function onKey(e: KeyboardEvent) {
      if (/^[1-9]$/.test(e.key)) {
        e.preventDefault();
        pressDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setEntry((prev) => prev.slice(0, -1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        submitCode();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keypadOpen, pressDigit, submitCode]);

  // Plan du manoir pour la carte du mode developpeur (calcule une seule fois).
  const devManor = useMemo(() => buildManor(), []);
  const devCheatsOn = devAllowed && Object.values(devFlags).some(Boolean);

  const clueDisplay = Array.from(
    { length: CODE_LENGTH },
    (_, rank) => clues.find((c) => c.rank === rank)?.digit ?? null,
  );
  // Le carnet n'est pas un decor fixe : plus elle approche, plus l'encre
  // vire au sang. C'est un avertissement qu'on lit du coin de l'oeil.
  const baseMood = QUEST_MOODS[quest.mood];
  const alarm =
    quest.mood === "danger" ? 0 : Math.min(1, Math.max(0, (dread - 0.3) / 0.55));
  const danger = QUEST_MOODS.danger;
  const mood = {
    accent: mixHex(baseMood.accent, danger.accent, alarm),
    ink: mixHex(baseMood.ink, danger.ink, alarm),
    act: mixHex(baseMood.act, danger.act, alarm),
    halo: `rgba(${alarm > 0.5 ? danger.halo : baseMood.halo}, ${(
      baseMood.glow +
      (danger.glow - baseMood.glow) * alarm
    ).toFixed(2)})`,
  };
  /** Au-dela de ce seuil, le carnet lui-meme se met a trembler. */
  const tense = dread > 0.55 || quest.mood === "danger";
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const selectedSlot = inventory.slots[inventory.selected];

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-black select-none"
      // « overflow-hidden » n'empeche pas un defilement force par le focus
      // d'un bouton : l'image remontait et laissait une bande noire en bas.
      onScroll={(e) => {
        e.currentTarget.scrollTop = 0;
        e.currentTarget.scrollLeft = 0;
      }}
    >
      {/* Vignette d'angoisse : le champ de vision se referme quand elle approche. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 50%, transparent ${Math.max(
            10,
            48 - dread * 34,
          )}%, rgba(0,0,0,${(0.3 + dread * 0.55).toFixed(2)}) ${Math.max(42, 94 - dread * 32)}%)`,
        }}
      />
      {dread > 0.55 && (
        <div
          className="pointer-events-none absolute inset-0 bg-red-950"
          style={{ opacity: (dread - 0.55) * 0.8 }}
        />
      )}
      <div
        className="pointer-events-none absolute inset-0 bg-red-700 transition-opacity"
        style={{ opacity: scareFlash * 0.32 }}
      />

      {/* Mode developpeur : panneau, ou simple rappel quand il est ferme mais
          que des triches restent actives (sinon on oublie qu'on est invincible). */}
      {devAllowed && devOpen && (
        <HorrorDevPanel
          flags={devFlags}
          onFlags={setDevFlags}
          snap={devSnap}
          rooms={devManor.rooms}
          width={devManor.width}
          height={devManor.height}
          onTeleport={(x, z) => apiRef.current?.devTeleport(x, z)}
          onAdvance={() => apiRef.current?.devAdvance()}
          onGiveAll={() => apiRef.current?.devGiveAll()}
          onClose={() => setDevOpen(false)}
        />
      )}
      {devAllowed && !devOpen && (
        <button
          type="button"
          onClick={() => setDevOpen(true)}
          className={`absolute bottom-3 left-3 z-30 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wider ${
            devCheatsOn
              ? "bg-amber-500 text-black"
              : "bg-black/70 text-amber-300 ring-1 ring-amber-500/40"
          }`}
        >
          🛠️ Dev{devCheatsOn ? " · actif" : ""}
        </button>
      )}

      {/* Grain de pellicule : il monte avec l'angoisse. C'est lui qui empeche
          l'image d'etre « propre », et une image propre n'a jamais fait peur. */}
      {grain && (
        <div
          className="pointer-events-none absolute -inset-[10%]"
          style={{
            backgroundImage: `url(${grain})`,
            backgroundRepeat: "repeat",
            opacity: 0.16 + dread * 0.22,
            animation: "horror-grain 0.72s steps(10) infinite",
          }}
        />
      )}

      {/* Elle t'a vu : la bande se decroche et glisse en travers de l'ecran. */}
      {seen && (
        <>
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-20"
            style={{
              background:
                "linear-gradient(180deg, transparent, rgba(255,70,50,0.18), rgba(255,255,255,0.06), transparent)",
              animation: "horror-tear 2.4s ease-in infinite",
            }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              boxShadow: "inset 0 0 120px rgba(150,10,10,0.45)",
              animation: "horror-breathe 1.6s ease-in-out infinite",
            }}
          />
        </>
      )}

      <button
        type="button"
        onClick={() => {
          try {
            document.exitPointerLock?.();
          } catch {
            // ignore
          }
          setGuideOpen(true);
        }}
        aria-label="Ouvrir le guide du manoir"
        title="Guide (H)"
        className="absolute right-14 top-28 z-30 flex size-9 items-center justify-center rounded-full bg-black/70 font-serif text-lg font-bold text-amber-200 backdrop-blur transition hover:bg-black/90"
      >
        ?
      </button>
      {guideOpen && <HorrorGuide inGame onClose={() => setGuideOpen(false)} />}
      <Game3DSettings
        className="top-28"
        onLayout={(l) => {
          layoutRef.current = l;
        }}
        onSensitivity={(s) => {
          sensitivityRef.current = s;
        }}
        onBrightness={(b) => {
          saveBrightness3D(b);
          apiRef.current?.applyBrightness(b);
        }}
        // Le jeu n'a plus de voix : le reglage ne sert qu'aux cinematiques,
        // et Game3DSettings l'enregistre deja lui-meme.
        onVoice={() => {}}
        brightness={loadedBrightness}
      />

      {/* --- Le carnet : page brulee epinglee dans le coin de l'ecran. --- */}
      <div className="pointer-events-none absolute left-2 top-2 w-[14.5rem] max-w-[64vw] sm:left-3 sm:top-3 sm:w-[17rem]">
        <div
          className="relative overflow-hidden px-3 py-2.5"
          style={{
            background: "linear-gradient(155deg, rgba(14,10,8,0.94), rgba(5,3,3,0.9))",
            borderLeft: `2px solid ${mood.accent}`,
            boxShadow: `inset 0 0 46px rgba(0,0,0,0.95), 0 0 22px ${mood.halo}`,
            // Bord droit dechire : ce n'est pas une boite, c'est une page arrachee.
            clipPath:
              "polygon(0 0, 100% 0, 97.5% 9%, 100% 26%, 98% 52%, 100% 74%, 96.5% 92%, 100% 100%, 0 100%)",
            animation: tense ? "horror-jitter 0.3s steps(2) infinite" : undefined,
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: "repeating-linear-gradient(0deg, #fff 0 1px, transparent 1px 3px)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 h-8 opacity-20"
            style={{
              background: `linear-gradient(180deg, transparent, ${mood.accent}, transparent)`,
              animation: "horror-scanline 5.5s linear infinite",
            }}
          />

          <button
            type="button"
            onClick={() => setQuestOpen((o) => !o)}
            aria-expanded={questOpen}
            className="pointer-events-auto relative flex w-full items-baseline justify-between gap-2 text-left"
          >
            <span
              className="text-[0.6rem] font-black uppercase tracking-[0.3em]"
              style={{ color: mood.act }}
            >
              {quest.act}
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="font-mono text-[0.65rem] text-zinc-500">{clock}</span>
              <span className="text-[0.55rem] text-zinc-600">{questOpen ? "▾" : "▸"}</span>
            </span>
          </button>

          <p
            className="relative mt-0.5 font-serif text-[0.98rem] leading-tight"
            style={{
              color: mood.ink,
              textShadow: `0 0 12px ${mood.halo}`,
              animation: "horror-flicker 7s infinite",
            }}
          >
            {quest.title}
          </p>
          {questOpen && (
            <p className="relative mt-1 text-[0.68rem] italic leading-snug text-zinc-400">
              {quest.detail}
            </p>
          )}
          {quest.where && (
            <p
              className={`relative mt-1 text-[0.66rem] font-semibold leading-snug ${
                questOpen ? "" : "truncate"
              }`}
              style={{ color: mood.act }}
            >
              ↳ {quest.where}
            </p>
          )}

          <div
            className="relative my-2 h-px"
            style={{ background: `linear-gradient(90deg, ${mood.accent}, transparent)` }}
          />

          {questOpen && (
            <p className="relative text-[0.55rem] font-bold uppercase tracking-[0.25em] text-zinc-600">
              Le code
            </p>
          )}
          <div className="relative mt-1 flex gap-1.5">
            {clueDisplay.map((digit, i) => (
              <div key={i} className="min-w-0 flex-1">
                <div
                  className={`flex items-center justify-center font-mono font-bold ${
                    questOpen ? "h-7 text-sm" : "h-5 text-xs"
                  }`}
                  style={
                    digit === null
                      ? {
                          color: "#4b4440",
                          border: "1px solid #2a2522",
                          background: "rgba(0,0,0,0.5)",
                          animation: "horror-breathe 3.4s ease-in-out infinite",
                        }
                      : {
                          color: mood.ink,
                          border: `1px solid ${mood.accent}`,
                          background: "rgba(0,0,0,0.6)",
                          boxShadow: `inset 0 0 10px ${mood.halo}`,
                          animation: "horror-burn 0.9s ease-out",
                        }
                  }
                >
                  {digit ?? "?"}
                </div>
                {questOpen && (
                  <p
                    className={`mt-0.5 truncate text-center text-[0.5rem] ${
                      digit === null ? "text-zinc-600" : "text-zinc-500 line-through"
                    }`}
                  >
                    {CLUE_SPOTS[i]?.room}
                  </p>
                )}
              </div>
            ))}
          </div>

          {questOpen && (
            <p className="relative mt-2.5 text-[0.55rem] font-bold uppercase tracking-[0.25em] text-zinc-600">
              Les reliques{" "}
              <span style={{ color: mood.act }}>
                {itemsFound}/{ITEM_COUNT}
              </span>
            </p>
          )}
          <div className="relative mt-1 flex gap-1.5">
            {Array.from({ length: ITEM_COUNT }, (_, i) => {
              const relic = relics[i];
              return (
                <div
                  key={i}
                  className={`flex items-center justify-center ${
                    questOpen ? "size-7 text-[0.8rem] sm:size-8" : "size-5 text-[0.6rem]"
                  }`}
                  style={
                    relic
                      ? {
                          border: `1px solid ${mood.accent}`,
                          background: "rgba(0,0,0,0.6)",
                          boxShadow: `inset 0 0 10px ${mood.halo}`,
                          animation: "horror-burn 0.9s ease-out",
                        }
                      : { border: "1px dashed #2a2522", background: "rgba(0,0,0,0.45)" }
                  }
                >
                  {relic ? relic.emoji : <span className="text-[0.6rem] text-zinc-700">·</span>}
                </div>
              );
            })}
          </div>

          {/* Quete secondaire : discrete, elle ne doit pas voler la vedette
              a la quete principale. */}
          <div className="relative mt-2.5 flex items-center justify-between gap-2">
            <span className="text-[0.55rem] font-bold uppercase tracking-[0.25em] text-zinc-600">
              Poupées
            </span>
            <span className="flex items-center gap-1">
              {DOLL_SPOTS.map((_, i) => (
                <span
                  key={i}
                  className={`text-[0.7rem] leading-none transition ${
                    i < dollsFound ? "opacity-100" : "opacity-20 grayscale"
                  }`}
                >
                  🧸
                </span>
              ))}
            </span>
          </div>
          {dollShield && (
            <p className="relative mt-1 text-[0.6rem] font-semibold text-sky-300/90">
              🛡️ Protégé une fois · +10 % de vitesse
            </p>
          )}

          {doorOpen && finale === "none" && (
            <p className="relative mt-2 text-[0.6rem] font-semibold text-emerald-500/80">
              🚪 La cave est ouverte.
            </p>
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute right-3 top-3 flex w-28 flex-col items-end gap-1">
        <span className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-zinc-500">
          {flashlightOn ? "Lampe" : "Éteinte"}
        </span>
        <div
          className="h-1.5 w-24 overflow-hidden"
          style={{ background: "rgba(0,0,0,0.7)", border: "1px solid #2a2522" }}
        >
          <div
            className="h-full transition-all"
            style={{
              width: `${battery}%`,
              background: battery < 20 ? "#dc2626" : mood.accent,
              boxShadow: `0 0 8px ${battery < 20 ? "rgba(220,38,38,0.7)" : mood.halo}`,
            }}
          />
        </div>
        {/* Endurance : n'apparait que quand on l'entame. */}
        <span
          className="mt-1 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-zinc-500 transition-opacity"
          style={{ opacity: stamina < 100 ? 1 : 0 }}
        >
          Souffle
        </span>
        <div
          className="h-1 w-24 overflow-hidden transition-opacity"
          style={{
            background: "rgba(0,0,0,0.7)",
            border: "1px solid #2a2522",
            opacity: stamina < 100 ? 1 : 0,
          }}
        >
          <div
            className="h-full"
            style={{ width: `${stamina}%`, background: stamina < 35 ? "#b91c1c" : "#a8a29e" }}
          />
        </div>
        {/* Le bruit que tu fais : ce qu'ELLE entend. */}
        <span className="mt-1 flex items-center gap-1.5 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-zinc-500">
          {crouched && <span className="text-zinc-300">Accroupie ·</span>}
          Bruit
        </span>
        <div className="flex h-3 items-end gap-[3px]">
          {Array.from({ length: 8 }, (_, i) => {
            const lit = noiseMeter * 8 > i;
            return (
              <span
                key={i}
                className="w-[7px]"
                style={{
                  height: `${30 + i * 10}%`,
                  background: lit ? (i >= 5 ? "#dc2626" : i >= 3 ? "#d97706" : "#a8a29e") : "rgba(255,255,255,0.08)",
                  boxShadow: lit && i >= 5 ? "0 0 6px rgba(220,38,38,0.8)" : undefined,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Vue depuis l'armoire. Les battants restent montes : ils se referment
          d'un coup en laissant une fente, puis se rouvrent en glissant quand on
          ressort, au lieu d'apparaitre et de disparaitre d'une image a l'autre. */}
      <div className="pointer-events-none absolute inset-0 z-[5]">
        {(["left", "right"] as const).map((side) => (
          <div
            key={side}
            className={`absolute inset-y-0 ${side === "left" ? "left-0" : "right-0"} bg-[#050302]`}
            style={{
              width: hideKind === "wardrobe" ? "34%" : "0%",
              transition: hideKind === "wardrobe" ? undefined : "width 0.42s ease-in",
              animation: hideKind === "wardrobe" ? "horror-door-close 0.5s cubic-bezier(.2,.9,.3,1)" : undefined,
              // Liseré de lumiere sur le bord des planches.
              boxShadow:
                hideKind === "wardrobe"
                  ? `inset ${side === "left" ? "-" : ""}14px 0 22px rgba(90,60,30,0.28)`
                  : "none",
            }}
          />
        ))}
        {/* Sous un lit : le sommier ecrase le haut de l'image, on voit a ras du sol. */}
        <div
          className="absolute inset-x-0 top-0"
          style={{
            height: hideKind === "bed" ? "58%" : hideKind === "wardrobe" ? "12%" : "0%",
            transition: "height 0.35s ease-out",
            background:
              hideKind === "bed"
                ? "linear-gradient(180deg, #050302 0%, #050302 82%, rgba(40,28,18,0.85) 92%, transparent 100%)"
                : "#050302",
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 bg-[#050302]"
          style={{ height: hideKind === "wardrobe" ? "12%" : hideKind === "bed" ? "6%" : "0%", transition: "height 0.35s ease-out" }}
        />
        {hidden && (
          <div className="absolute left-1/2 top-4 flex -translate-x-1/2 flex-col items-center gap-1.5">
            <span className="rounded-full bg-black/80 px-3 py-1 text-xs font-semibold text-zinc-300">
              {hideKind === "bed" ? "🛏️ Sous le lit" : "🚪 Dans l'armoire"}
            </span>
            <div className="flex items-center gap-2 rounded-full bg-black/80 px-3 py-1">
              <span className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-zinc-400">
                {holdingBreath ? "Apnée" : "Espace — retenir ton souffle"}
              </span>
              <span className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
                <span
                  className="block h-full"
                  style={{
                    width: `${Math.round(breath * 100)}%`,
                    background: breath < 0.3 ? "#dc2626" : holdingBreath ? "#7dd3fc" : "#a8a29e",
                  }}
                />
              </span>
            </div>
          </div>
        )}
        {/* Screamer de la cachette : une main sort de l'ombre, a cote de toi. */}
        {screamer === "hand" && scareImages && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={scareImages.hand}
            alt=""
            className="absolute bottom-0 left-[26%] h-[85%] w-auto"
            style={{ animation: "horror-hand 1.15s cubic-bezier(.15,.9,.3,1) forwards" }}
          />
        )}
      </div>

      {/* Nom de la piece : grave dans l'air, pas dans une pastille. */}
      {roomLabel && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2">
          <span
            className="font-serif text-[0.7rem] uppercase tracking-[0.4em] text-zinc-400/80 sm:text-xs"
            style={{ textShadow: "0 0 16px #000, 0 0 4px #000" }}
          >
            {roomLabel}
          </span>
        </div>
      )}

      {/* Un acte s'ouvre : tout le manoir s'arrete une seconde pour l'annoncer. */}
      {actCard && (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-6"
          style={{ animation: `horror-act-in ${ACT_CARD_SECONDS}s ease-in-out forwards` }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.45) 55%, transparent 80%)",
            }}
          />
          <span
            className="relative text-[0.6rem] font-black uppercase tracking-[0.5em] sm:text-xs"
            style={{ color: QUEST_MOODS[actCard.mood].act }}
          >
            {actCard.act}
          </span>
          <span
            className="relative mt-2 text-center font-serif text-2xl font-bold sm:text-4xl"
            style={{
              color: QUEST_MOODS[actCard.mood].ink,
              textShadow: `0 0 30px rgba(${QUEST_MOODS[actCard.mood].halo},0.55), 0 0 6px #000`,
              animation: "horror-act-title 1.4s ease-out both",
            }}
          >
            {actCard.title}
          </span>
          <span
            className="relative mt-3 h-px w-44 origin-center sm:w-64"
            style={{
              background: `linear-gradient(90deg, transparent, ${QUEST_MOODS[actCard.mood].accent}, transparent)`,
              animation: "horror-rule-grow 1.6s ease-out both",
            }}
          />
          <span className="relative mt-3 max-w-sm text-center text-xs italic text-zinc-400 sm:text-sm">
            {actCard.detail}
          </span>
        </div>
      )}

      {/* La fuite finale : un seul mot, et il tremble. */}
      {finale === "escape" && (
        <div className="pointer-events-none absolute left-1/2 top-12 -translate-x-1/2 sm:top-14">
          <span
            className="font-serif text-xl font-black uppercase tracking-[0.35em] text-red-500 sm:text-3xl"
            style={{
              textShadow: "0 0 28px rgba(220,38,38,0.9), 0 0 6px #000",
              animation: "horror-jitter 0.22s steps(2) infinite",
            }}
          >
            Cours
          </span>
        </div>
      )}

      {/* Acte V : combien de sceaux tiennent encore la trappe. */}
      {finale === "seals" && (
        <div className="pointer-events-none absolute left-1/2 top-12 flex -translate-x-1/2 items-center gap-2 sm:top-14">
          {Array.from({ length: SEALS.length }, (_, i) => (
            <span
              key={i}
              className="size-3 rotate-45"
              style={
                i < sealsLeft
                  ? { background: "#7fd4ff", boxShadow: "0 0 14px rgba(127,212,255,0.9)" }
                  : { border: "1px solid #3f3a35" }
              }
            />
          ))}
          <span className="ml-1 font-serif text-xs uppercase tracking-[0.3em] text-sky-200/80">
            {sealsLeft} sceau{sealsLeft > 1 ? "x" : ""}
          </span>
        </div>
      )}

      {/* Acte VI : le compte a rebours, et rien d'autre a l'ecran. */}
      {finale === "survive" && (
        <div className="pointer-events-none absolute left-1/2 top-10 flex -translate-x-1/2 flex-col items-center sm:top-12">
          <span
            className="font-mono text-5xl font-black tabular-nums sm:text-7xl"
            style={{
              color: surviveLeft <= 10 ? "#ef4444" : "#fecaca",
              textShadow: `0 0 ${surviveLeft <= 10 ? 40 : 22}px rgba(220,38,38,0.85), 0 0 8px #000`,
              animation: surviveLeft <= 10 ? "horror-jitter 0.2s steps(2) infinite" : undefined,
            }}
          >
            {surviveLeft}
          </span>
          <span className="font-serif text-[0.65rem] uppercase tracking-[0.4em] text-red-400/80 sm:text-xs">
            Tiens bon
          </span>
        </div>
      )}

      {/* Boussole du final : une aiguille sous le reticule. */}
      {guide && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-10 flex flex-col items-center gap-1">
          <span
            className="text-2xl leading-none"
            style={{
              display: "inline-block",
              transform: `rotate(${guide.angle}rad)`,
              color: guide.kind === "monster" ? "#ef4444" : "#7fd4ff",
              textShadow: `0 0 16px ${
                guide.kind === "monster" ? "rgba(239,68,68,0.9)" : "rgba(127,212,255,0.9)"
              }`,
            }}
          >
            ▲
          </span>
          <span
            className="font-mono text-[0.6rem] tracking-widest"
            style={{ color: guide.kind === "monster" ? "#fca5a5" : "#bae6fd" }}
          >
            {guide.kind === "monster" ? "ELLE" : guide.kind === "hatch" ? "TRAPPE" : "SCEAU"} ·{" "}
            {Math.round(guide.distance)} m
          </span>
        </div>
      )}

      {hint && (
        <div className="pointer-events-none absolute left-1/2 top-24 w-72 max-w-[80vw] -translate-x-1/2">
          <p
            className="px-4 py-2 text-center text-xs font-semibold italic leading-snug"
            style={{
              color: mood.ink,
              background: "linear-gradient(90deg, transparent, rgba(0,0,0,0.88), transparent)",
              textShadow: "0 0 10px #000",
            }}
          >
            {hint}
          </p>
        </div>
      )}

      {toast && (
        <div
          className="pointer-events-none absolute bottom-24 left-1/2 w-72 max-w-[86vw] -translate-x-1/2 px-4 py-3 text-center"
          style={{
            background: "linear-gradient(155deg, rgba(14,10,8,0.95), rgba(5,3,3,0.92))",
            borderTop: `1px solid ${mood.accent}`,
            borderBottom: `1px solid ${mood.accent}`,
            boxShadow: `inset 0 0 40px rgba(0,0,0,0.9), 0 0 26px ${mood.halo}`,
            animation: "horror-quest-in 0.5s ease-out",
          }}
        >
          <p className="font-serif text-sm font-bold" style={{ color: mood.ink }}>
            {toast.emoji} {toast.name}
          </p>
          <p className="mt-1 text-xs italic leading-snug text-zinc-400">{toast.flavor}</p>
        </div>
      )}

      {prompt && !keypadOpen && (
        <div className="pointer-events-none absolute bottom-40 left-1/2 -translate-x-1/2">
          <span
            className="px-4 py-1.5 text-sm font-semibold tracking-wide text-white"
            style={{
              background: "rgba(0,0,0,0.82)",
              borderLeft: `2px solid ${mood.accent}`,
              textShadow: "0 0 10px #000",
            }}
          >
            {prompt}
          </span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-1 w-1 rounded-full bg-white/50" />
      </div>

      {/* --- Barre d'objets : cinq emplacements, les cles a cote --- */}
      {!hidden && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 sm:bottom-7">
          {selectedSlot && (
            <span
              className="text-[0.62rem] font-semibold tracking-wide text-zinc-400"
              style={{ textShadow: "0 0 8px #000" }}
            >
              {ITEM_DEFS[selectedSlot.item].name} ·{" "}
              <span style={{ color: mood.ink }}>
                {isTouch ? "✋" : "Clic ou G"} — {ITEM_DEFS[selectedSlot.item].verb}
              </span>
            </span>
          )}
          <div className="flex items-end gap-1.5">
            {inventory.slots.map((slot, i) => {
              const active = i === inventory.selected;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => apiRef.current?.selectSlot(i)}
                  className="pointer-events-auto relative flex size-11 items-center justify-center text-xl sm:size-12"
                  style={{
                    background: active ? "rgba(20,14,10,0.92)" : "rgba(0,0,0,0.62)",
                    border: `1px solid ${active ? mood.accent : "rgba(255,255,255,0.12)"}`,
                    boxShadow: active ? `0 0 14px ${mood.halo}, inset 0 0 12px rgba(0,0,0,0.9)` : undefined,
                    transform: active ? "translateY(-3px)" : undefined,
                    transition: "transform 0.12s, border-color 0.12s",
                  }}
                  aria-label={slot ? ITEM_DEFS[slot.item].name : `Emplacement ${i + 1} vide`}
                >
                  {!isTouch && (
                    <span className="absolute left-1 top-0.5 font-mono text-[0.55rem] text-zinc-600">{i + 1}</span>
                  )}
                  {slot ? (
                    <>
                      <span>{ITEM_DEFS[slot.item].emoji}</span>
                      {slot.count > 1 && (
                        <span className="absolute bottom-0.5 right-1 font-mono text-[0.6rem] font-bold text-zinc-300">
                          {slot.count}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-zinc-700">·</span>
                  )}
                </button>
              );
            })}
            {inventory.keys.length > 0 && (
              <div
                className="ml-1 flex h-11 items-center gap-0.5 px-2 sm:h-12"
                style={{ background: "rgba(0,0,0,0.62)", border: "1px solid rgba(255,255,255,0.12)" }}
                title={inventory.keys.map((k) => KEY_NAMES[k].name).join(", ")}
              >
                {inventory.keys.map((k) => (
                  <span key={k} className="text-base">
                    {KEY_NAMES[k].emoji}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Le carnet complet (Tab) --- */}
      {bagOpen && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
          <div
            className="max-h-full w-[26rem] max-w-full overflow-y-auto p-4"
            style={{
              background: "linear-gradient(155deg, rgba(18,13,10,0.97), rgba(6,4,3,0.97))",
              borderLeft: `2px solid ${mood.accent}`,
              boxShadow: `inset 0 0 50px rgba(0,0,0,0.9), 0 0 30px ${mood.halo}`,
            }}
          >
            <div className="flex items-baseline justify-between">
              <p className="font-serif text-lg" style={{ color: mood.ink }}>
                Tes poches
              </p>
              <button
                type="button"
                onClick={() => setBagOpen(false)}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                Fermer (Tab)
              </button>
            </div>
            <p className="mt-0.5 text-[0.65rem] italic text-zinc-500">Le temps ne s&apos;arrête pas pendant que tu fouilles.</p>

            <div className="mt-3 flex flex-col gap-1.5">
              {inventory.slots.map((slot, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => apiRef.current?.selectSlot(i)}
                  className="flex items-center gap-3 px-2 py-1.5 text-left"
                  style={{
                    background: i === inventory.selected ? "rgba(255,255,255,0.06)" : "transparent",
                    border: `1px solid ${i === inventory.selected ? mood.accent : "rgba(255,255,255,0.06)"}`,
                  }}
                >
                  <span className="w-6 text-center text-lg">{slot ? ITEM_DEFS[slot.item].emoji : "·"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-zinc-200">
                      {slot ? `${ITEM_DEFS[slot.item].name}${slot.count > 1 ? ` ×${slot.count}` : ""}` : "Vide"}
                    </span>
                    {slot && (
                      <span className="block text-[0.65rem] leading-snug text-zinc-500">
                        {ITEM_DEFS[slot.item].description}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>

            <p className="mt-4 text-[0.55rem] font-bold uppercase tracking-[0.25em] text-zinc-600">Clés</p>
            {inventory.keys.length === 0 ? (
              <p className="mt-1 text-xs italic text-zinc-600">Aucune. Certaines portes ne s&apos;ouvrent qu&apos;avec elles.</p>
            ) : (
              <ul className="mt-1 flex flex-col gap-1">
                {inventory.keys.map((k) => (
                  <li key={k} className="text-xs text-zinc-300">
                    {KEY_NAMES[k].emoji} {KEY_NAMES[k].name}
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-4 text-[0.55rem] font-bold uppercase tracking-[0.25em] text-zinc-600">
              Pages trouvées {inventory.notes.length}/{MANOR_NOTES.length}
            </p>
            {inventory.notes.length === 0 ? (
              <p className="mt-1 text-xs italic text-zinc-600">Des pages traînent dans le manoir. Lis-les.</p>
            ) : (
              <ul className="mt-1 flex flex-col gap-1">
                {inventory.notes.map((id) => {
                  const note = MANOR_NOTES.find((n) => n.id === id);
                  if (!note) return null;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => apiRef.current?.readNote(id)}
                        className="text-left text-xs text-zinc-300 underline decoration-zinc-700 underline-offset-2 hover:text-white"
                      >
                        📜 {note.title}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* --- Une page lue : papier jauni, encre qui bave --- */}
      {readingNote && (
        <div className="absolute inset-0 z-[25] flex items-center justify-center bg-black/55 p-4">
          <div
            className="relative w-[24rem] max-w-full px-6 py-5"
            style={{
              background: "linear-gradient(170deg, #d9c9a3, #b9a57a 70%, #8f7c55)",
              boxShadow: "inset 0 0 60px rgba(60,35,10,0.55), 0 20px 60px rgba(0,0,0,0.8)",
              transform: "rotate(-1.2deg)",
              animation: "horror-quest-in 0.35s ease-out",
            }}
          >
            <p className="font-serif text-base font-bold text-[#2a1a0c]">{readingNote.title}</p>
            <p className="mt-3 font-serif text-sm italic leading-relaxed text-[#3b2812]">{readingNote.text}</p>
            <button
              type="button"
              onClick={() => setReadingNote(null)}
              className="mt-4 text-xs font-semibold text-[#5a4020] underline underline-offset-2"
            >
              {isTouch ? "Fermer" : "Fermer (E ou Échap)"}
            </button>
          </div>
        </div>
      )}

      {/* --- Screamer : le visage, une fraction de seconde --- */}
      {screamer === "face" && scareImages && (
        <div className="pointer-events-none absolute inset-0 z-[35] flex items-center justify-center bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={scareImages.face}
            alt=""
            className="h-[115%] w-auto max-w-none"
            style={{ animation: "horror-face 0.2s steps(3) forwards", filter: "contrast(1.4)" }}
          />
        </div>
      )}

      {keypadOpen && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-[19rem] rounded-2xl border border-amber-900/50 bg-zinc-950 p-5 text-center">
            <p className="text-sm font-bold text-amber-200">Serrure à code</p>
            <p className="mt-1 text-xs text-zinc-500">
              {CODE_LENGTH} chiffres sont gravés sur des plaques dans le manoir.
            </p>
            <div
              className={`mx-auto mt-4 flex w-fit gap-2 ${entryError ? "animate-pulse" : ""}`}
            >
              {Array.from({ length: CODE_LENGTH }, (_, i) => i).map((i) => (
                <span
                  key={i}
                  className={`flex size-12 items-center justify-center rounded-lg font-mono text-2xl font-bold ring-1 ${
                    entryError
                      ? "bg-red-950 text-red-300 ring-red-700"
                      : "bg-black text-amber-300 ring-white/15"
                  }`}
                >
                  {entry[i] ?? "·"}
                </span>
              ))}
            </div>
            {entryError && <p className="mt-2 text-xs font-semibold text-red-400">Code refusé.</p>}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => pressDigit(d)}
                  className="rounded-lg bg-white/5 py-3 font-mono text-lg font-bold text-zinc-200 ring-1 ring-white/10 transition hover:bg-white/10"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setEntry("")}
                className="rounded-lg bg-white/5 py-3 text-sm font-semibold text-zinc-400 ring-1 ring-white/10 hover:bg-white/10"
              >
                ⌫
              </button>
              <button
                type="button"
                onClick={submitCode}
                disabled={entry.length < CODE_LENGTH}
                className="col-span-2 rounded-lg bg-amber-700 py-3 text-sm font-bold text-white transition hover:bg-amber-600 disabled:opacity-40"
              >
                Ouvrir
              </button>
            </div>
            <button
              type="button"
              onClick={() => setKeypadOpen(false)}
              className="mt-3 text-xs text-zinc-500 hover:text-zinc-300"
            >
              Reculer (Échap)
            </button>
          </div>
        </div>
      )}

      {/* Commandes tactiles. Sans elles, le jeu etait infinissable au doigt :
          impossible d'ouvrir la cave, de faire le rituel ou de se cacher.
          Elles sont remontees pour laisser passer la radio et la mascotte. */}
      {isTouch && (
        <>
          <div className="absolute bottom-32 left-3 grid grid-cols-3 gap-1.5 sm:bottom-16">
            <span />
            <HoldButton label="⬆" onHold={(v) => (heldRef.current.forward = v)} />
            <span />
            <HoldButton label="⬅" onHold={(v) => (heldRef.current.left = v)} />
            <HoldButton label="⬇" onHold={(v) => (heldRef.current.back = v)} />
            <HoldButton label="➡" onHold={(v) => (heldRef.current.right = v)} />
          </div>
          <div className="absolute bottom-32 right-3 flex flex-col items-end gap-2 sm:bottom-16">
            <div className="flex gap-2">
              <TapButton label="🎒" accent={mood.accent} onTap={() => setBagOpen((o) => !o)} />
              <TapButton label="🔦" accent={mood.accent} onTap={() => apiRef.current?.toggleFlashlight()} />
            </div>
            <div className="flex gap-2">
              {hidden ? (
                <HoldButton label="🤐" onHold={(v) => (heldRef.current.breath = v)} />
              ) : (
                <>
                  <HoldButton label="🏃" onHold={(v) => (heldRef.current.sprint = v)} />
                  <TapButton
                    label="🧎"
                    accent={mood.accent}
                    highlight={crouched}
                    onTap={() => apiRef.current?.toggleCrouch()}
                  />
                </>
              )}
            </div>
            <div className="flex gap-2">
              <TapButton label="✋" accent={mood.accent} onTap={() => apiRef.current?.applyHeldItem()} />
              <TapButton
                label="E"
                accent={mood.accent}
                highlight={Boolean(prompt)}
                onTap={() => apiRef.current?.interact()}
              />
            </div>
          </div>
        </>
      )}

      {!isTouch && (
        <p className="pointer-events-none absolute bottom-0.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-zinc-600">
          ZQSD · Maj courir · C s&apos;accroupir · F lampe · E interagir · 1-5 objets · clic utiliser · Tab poches
        </p>
      )}

      {/* Onglet en arriere-plan : la partie est gelee, pas perdue. On peut
          aussi reprendre d'un clic si le navigateur a rate le retour. */}
      {paused && !contextLost && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/90">
          <span className="font-serif text-2xl text-zinc-300">Le manoir attend</span>
          <button
            type="button"
            onClick={() => apiRef.current?.resume()}
            className="border border-zinc-600 px-5 py-2 text-sm font-semibold text-zinc-200 transition hover:border-zinc-400 hover:text-white"
          >
            Reprendre
          </button>
        </div>
      )}
      {contextLost && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black px-6 text-center">
          <span className="font-serif text-2xl text-zinc-300">L&apos;image s&apos;est éteinte</span>
          <span className="max-w-sm text-xs text-zinc-500">
            Le navigateur a repris la carte graphique (veille, trop d&apos;onglets 3D ouverts…). Elle revient
            d&apos;habitude toute seule en quelques secondes.
          </span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="border border-zinc-600 px-5 py-2 text-sm font-semibold text-zinc-200 transition hover:border-zinc-400 hover:text-white"
          >
            Recharger la page
          </button>
        </div>
      )}
    </div>
  );
}
