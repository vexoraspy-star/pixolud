"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import {
  CELL_OPEN,
  CELL_PILLAR,
  CELL_PROP,
  CELL_RACK,
  CELL_WALL,
  DIRS,
  fixtureBulb,
  floorYAt,
  generateLevel,
  isSolidCell,
  mulberry32,
  zoneKind,
  type LevelDef,
  type LevelId,
  type PickupKind,
  type WallSpot,
} from "@/lib/backrooms";
import {
  makeArrowDecal,
  makeBlackConcreteWall,
  makeBlackFloor,
  makeBrickWall,
  makeCardboard,
  makeCeilingTiles,
  makeConcreteFloor,
  makeConcreteWall,
  makeDarkCeiling,
  makeDoorTexture,
  makeExitSign,
  makeFuseBoxTexture,
  makeGrating,
  makeHallCarpet,
  makeHallWallpaper,
  makeHotelCarpet,
  makeHotelCeiling,
  makeHotelWallpaper,
  makeCubicleFabric,
  makeLightPanel,
  makeMachinePanel,
  makeMetalWall,
  makeOfficeCarpet,
  makeOfficeWall,
  makePartyCarpet,
  makePartyCeiling,
  makePartyWallpaper,
  makePoolTile,
  makeScreenTexture,
  makeTileFloor,
  makeTileWall,
  makeWaterLabel,
  makeWaterSurface,
} from "@/lib/backroomsTextures";
import {
  createBackroomsAudio,
  playBacteriaClicks,
  playBacteriaScreech,
  playBlackout,
  playBottle,
  playClick,
  playDeath,
  playDistantSteps,
  playDoorOpen,
  playDrink,
  playElevator,
  playEntityStep,
  playFlicker,
  playFuse,
  playGasp,
  playGrab,
  playGripValve,
  playHandle,
  playHeartbeat,
  playMonsterCall,
  playMonsterStep,
  playNoclip,
  playPartyMusic,
  playPowerOn,
  playRunBreath,
  playRunStart,
  playRunStride,
  playSmilerGiggle,
  playSmilerRush,
  playStep,
  playTinnitus,
  playValveDone,
  playValveTurn,
  playWhisper,
  type AudioFlavor,
  type PartyMusic,
  type Surface,
} from "@/lib/backroomsAudio";
import {
  buildBacteria,
  buildSmiler,
  buildWanderer,
  poseBacteria,
  poseSmiler,
} from "@/lib/backroomsEntities";
import { buildHandRig, buildSurvivor, makeGlowTexture, SURVIVOR_COLORS, type Survivor } from "@/lib/backroomsCharacters";
import { buildDecor } from "@/lib/backroomsDecor";
import type { NetEvent, PartyLink } from "@/lib/backroomsNet";
import { VOICE_LOUD, type VoiceHub } from "@/lib/backroomsVoice";
import { NOISE_RADIUS, pruneNoises, wallsBetween, type Noise, type NoiseKind } from "@/lib/manorNoise";
import { createBrain, thinkMonster, type BrainState, type MapQuery, type SpeedMode } from "@/lib/manorAI";
import { createAnimatedModel, type AnimatedModel } from "@/lib/models3d";
import { buildMonster, isLookingAt, MONSTER_TRAITS, type Monster, type MonsterPose } from "@/lib/backroomsMonsters";
import Game3DSettings from "./Game3DSettings";
import BackroomsDevPanel, {
  BACKROOMS_DEV_OFF,
  type BackroomsDevFlags,
  type BackroomsDevSnapshot,
} from "./BackroomsDevPanel";
import {
  loadBrightness3D,
  loadLayout3D,
  loadSensitivity3D,
  loadQuality3D,
  saveBrightness3D,
  type Layout3D,
  type Quality3D,
} from "@/lib/settings3d";

/** Cause de la mort : l'entite du niveau (son `EntityKind`), ou la lucidite. */
export type DeathCause = "souriant" | "bacterie" | "lucidite" | "voleur" | "chiens" | "fetards";

export interface LevelStats {
  seconds: number;
  water: number;
}

/** Hauteur des yeux debout et accroupi, en metres. */
const EYE = 1.62;
const CROUCH_EYE = 1.02;
const PLAYER_RADIUS = 0.28;
const BASE_LOOK = 0.0038;
const BATTERY_DRAIN = 100 / 130;
const BATTERY_REGEN = 100 / 100;
const BATTERY_PICKUP = 55;
const WATER_SANITY = 38;
const PICK_REACH = 1.5;
const DOOR_REACH = 2.1;
const VALVE_REACH = 1.8;
/** Dans les bassins du niveau 37 : hauteur de l'eau, et vitesse reduite. */
const WATER_Y = 0.15;
const WADE_SPEED = 0.62;

/**
 * Vocabulaire des objectifs. Le mecanisme est partage (ramasser trois objets,
 * ou maintenir E sur trois points), mais il change de nom selon le lieu :
 * fusibles au niveau 1, vannes au 2, disjoncteurs au 3, badges au 4.
 */
interface GoalWords {
  todo: (n: number, total: number) => string;
  todoDetail: string;
  done: string;
  doneDetail: string;
  gotOne: (n: number, total: number) => string;
  friend: (n: number, total: number) => string;
  locked: (missing: number) => string;
  lockedPrompt: string;
  itemPrompt: string;
  openPrompt: string;
}
const plural = (n: number) => (n > 1 ? "s" : "");
function goalWords(id: LevelId): GoalWords {
  switch (id) {
    case "niveau-2":
      return {
        todo: (n, t) => `Vannes ${n}/${t}`,
        todoDetail: "Ferme-les pour déverrouiller la trappe. Ça s'entend.",
        done: "Rejoins la trappe",
        doneDetail: "La pression est tombée. Elle est ouverte.",
        gotOne: (n, t) => (n < t ? `Vanne fermée. Encore ${t - n}.` : "La dernière vanne. La trappe se déverrouille."),
        friend: (n, t) => `Un ami a fermé une vanne (${n}/${t}).`,
        locked: (m) => `Verrouillée. Encore ${m} vanne${plural(m)} à fermer.`,
        lockedPrompt: "Verrouillée",
        itemPrompt: "Maintiens E — Fermer la vanne",
        openPrompt: "E — Ouvrir la trappe",
      };
    case "niveau-3":
      return {
        todo: (n, t) => `Disjoncteurs ${n}/${t}`,
        todoDetail: "Relève-les pour remettre le courant de la porte. Ça claque fort.",
        done: "Rejoins la porte du local",
        doneDetail: "Le courant revient. Elle est déverrouillée.",
        gotOne: (n, t) => (n < t ? `Disjoncteur relevé. Encore ${t - n}.` : "Le dernier disjoncteur. La porte se déverrouille."),
        friend: (n, t) => `Un ami a relevé un disjoncteur (${n}/${t}).`,
        locked: (m) => `Pas de courant. Encore ${m} disjoncteur${plural(m)} à relever.`,
        lockedPrompt: "Pas de courant",
        itemPrompt: "Maintiens E — Relever le disjoncteur",
        openPrompt: "E — Ouvrir la porte",
      };
    case "niveau-4":
      return {
        todo: (n, t) => `Badges ${n}/${t}`,
        todoDetail: "La porte de sécurité en demande trois.",
        done: "Rejoins la porte de sécurité",
        doneDetail: "Tu as les trois badges.",
        gotOne: (n, t) => (n < t ? `Badge ${n}/${t}.` : "Trois badges. À la porte de sécurité."),
        friend: (n, t) => `Un ami a trouvé un badge (${n}/${t}).`,
        locked: (m) => `Accès refusé. Il manque ${m} badge${plural(m)}.`,
        lockedPrompt: "Accès refusé",
        itemPrompt: "E — Ramasser le badge",
        openPrompt: "E — Passer les badges",
      };
    case "niveau-5":
      return {
        todo: (n, t) => `Clés ${n}/${t}`,
        todoDetail: "La porte de service ne s'ouvre qu'avec les clés du personnel.",
        done: "Rejoins la porte de service",
        doneDetail: "Tu as les trois clés.",
        gotOne: (n, t) => (n < t ? `Clé ${n}/${t}.` : "Trois clés. À la porte de service."),
        friend: (n, t) => `Un ami a trouvé une clé (${n}/${t}).`,
        locked: (m) => `Fermée à clé. Il manque ${m} clé${plural(m)}.`,
        lockedPrompt: "Fermée à clé",
        itemPrompt: "E — Ramasser la clé",
        openPrompt: "E — Ouvrir la porte de service",
      };
    case "niveau-fun":
      return {
        todo: (n, t) => `Enceintes ${n}/${t}`,
        todoDetail: "Débranche-les pour faire taire la fête. Ils vont le remarquer.",
        done: "Rejoins la sortie",
        doneDetail: "La musique s'est tue. La porte est ouverte.",
        gotOne: (n, t) => (n < t ? `Enceinte débranchée. Encore ${t - n}.` : "La dernière enceinte. Silence. La porte s'ouvre."),
        friend: (n, t) => `Un ami a débranché une enceinte (${n}/${t}).`,
        locked: (m) => `Fermée. Encore ${m} enceinte${plural(m)} à débrancher.`,
        lockedPrompt: "Fermée",
        itemPrompt: "Maintiens E — Débrancher l'enceinte",
        openPrompt: "E — Ouvrir la porte",
      };
    default:
      return {
        todo: (n, t) => `Fusibles ${n}/${t}`,
        todoDetail: "Le monte-charge n'a plus de courant.",
        done: "Rejoins le monte-charge",
        doneDetail: "Tu as les trois fusibles.",
        gotOne: (n, t) => (n < t ? `Fusible ${n}/${t}.` : "Trois fusibles. Au monte-charge."),
        friend: (n, t) => `Un ami a trouvé un fusible (${n}/${t}).`,
        locked: (m) => `Pas de courant. Il manque ${m} fusible${plural(m)}.`,
        lockedPrompt: "Pas de courant",
        itemPrompt: "E — Ramasser le fusible",
        openPrompt: id === "niveau-1" ? "E — Appeler le monte-charge" : "E — Ouvrir la porte",
      };
  }
}

const AUDIO_FLAVOR: Partial<Record<LevelId, AudioFlavor>> = {
  "niveau-3": "centrale",
  "niveau-4": "bureaux",
  "niveau-37": "piscines",
  "niveau-5": "hotel",
  "niveau-6": "noir",
  "niveau-fun": "fete",
};

const HUD_ACCENT: Partial<Record<LevelId, string>> = {
  "niveau-0": "#f3e3a0",
  "niveau-1": "#d9dde0",
  "niveau-3": "#ffcf8a",
  "niveau-4": "#dfe8ee",
  "niveau-37": "#c9f3f6",
  "niveau-5": "#ffd2a0",
  "niveau-6": "#bdf5c8",
  "niveau-fun": "#ffbfe9",
};

/** Premier conseil, a la fin du carton titre, dans les niveaux des nouveaux monstres. */
const INTRO_HINT: Partial<Record<LevelId, string>> = {
  "niveau-5": "Quelqu'un porte un visage qui n'est pas le sien. Tant que tu le regardes, il ne bouge pas.",
  "niveau-6": "Ils ne voient rien. Ils entendent tout. Avance accroupi, et ne cours pas.",
  "niveau-fun": "Si quelqu'un te fait coucou… cours.",
};

/** Etat du monstre transmis au groupe et a l'animation : le coucou des Fetards s'ajoute aux etats du cerveau. */
type MonsterDisplay = BrainState | "salut";
const VALVE_SECONDS = 2.6;
const CAPTURE = 0.65;
const DEATH_SECONDS = 1.25;
const THINK_INTERVAL = 0.1;
const REPATH = 0.45;
/** Carton de titre du niveau, et temps de grace de l'entite au debut. */
const INTRO_SECONDS = 4.2;
/** Duree du clignotement des neons avant une coupure. */
const BLACKOUT_WARN_SECONDS = 2.2;
const NOCLIP_SECONDS = 1.6;
/** Metres par case du Manoir : les rayons de bruit y ont ete regles. */
const MANOR_CELL = 1.7;


type HudObjective = { title: string; detail: string };

/** Bruit fixe 128 px pour le grain VHS, genere une fois. */
let vhsGrainUrl: string | null = null;
function getVhsGrain(): string {
  if (vhsGrainUrl) return vhsGrainUrl;
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = Math.random() < 0.3 ? 70 : 0;
  }
  ctx.putImageData(img, 0, 0);
  vhsGrainUrl = c.toDataURL();
  return vhsGrainUrl;
}

/** Petite etoile radiale pour les reflets d'objets au sol. */
function makeGlintTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,240,1)");
  g.addColorStop(0.25, "rgba(255,250,210,0.55)");
  g.addColorStop(1, "rgba(255,250,210,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Degrade d'ombre de contact : noir contre le mur, transparent a 60 cm. */
function makeContactShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 8;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, "rgba(0,0,0,0.85)");
  g.addColorStop(0.35, "rgba(0,0,0,0.35)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Chemin le plus court sur la grille, en indices. */
function gridPath(cells: Uint8Array, w: number, h: number, fx: number, fy: number, tx: number, ty: number): number[] | null {
  if (fx === tx && fy === ty) return [fy * w + fx];
  if (isSolidCell(cells, w, h, tx, ty)) return null;
  const prev = new Int32Array(w * h).fill(-1);
  const start = fy * w + fx;
  const goal = ty * w + tx;
  prev[start] = start;
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  while (head < tail) {
    const i = queue[head++];
    if (i === goal) break;
    const x = i % w;
    const neighbours = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w];
    for (const n of neighbours) {
      if (n < 0 || n >= w * h || prev[n] >= 0 || cells[n] !== CELL_OPEN) continue;
      prev[n] = i;
      queue[tail++] = n;
    }
  }
  if (prev[goal] < 0) return null;
  const path: number[] = [];
  for (let i = goal; i !== start; i = prev[i]) path.push(i);
  path.push(start);
  return path.reverse();
}

/** Position et orientation d'un objet plaque contre un mur. */
function faceTransform(spot: WallSpot, cs: number, inset = 0.02) {
  const [dx, dy] = DIRS[spot.dir];
  return {
    x: (spot.x + 0.5 + dx * 0.5) * cs - dx * inset,
    z: (spot.y + 0.5 + dy * 0.5) * cs - dy * inset,
    yaw: Math.atan2(-dx, -dy),
    dx,
    dy,
  };
}

function HoldButton({ label, onHold, wide = false }: { label: string; onHold: (down: boolean) => void; wide?: boolean }) {
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
      className={`flex h-12 items-center justify-center font-mono text-sm font-bold text-white/85 active:scale-95 ${wide ? "w-16" : "w-12"}`}
      style={{ background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.18)" }}
    >
      {label}
    </button>
  );
}

export default function BackroomsScene({
  level,
  seed,
  onDeath,
  onComplete,
  party = null,
  voice = null,
  micEnabled = false,
  devAllowed = false,
  devOpenAtStart = false,
}: {
  level: LevelDef;
  seed: number;
  onDeath: (cause: DeathCause, stats: LevelStats) => void;
  onComplete: (stats: LevelStats) => void;
  /** Groupe avec code. Absent en solo. */
  party?: RefObject<PartyLink | null> | null;
  /** Micro et voix du groupe. */
  voice?: VoiceHub | null;
  /** En solo : « elle entend ta voix » est active. */
  micEnabled?: boolean;
  /** Compte admin, verifie cote serveur. Jamais en groupe. */
  devAllowed?: boolean;
  /** Lance depuis « Mode developpeur » : panneau ouvert et invincible d'office. */
  devOpenAtStart?: boolean;
}) {
  const devEnabled = devAllowed && !party;
  const startsInDev = devEnabled && devOpenAtStart;
  const [devOpen, setDevOpen] = useState(startsInDev);
  const [devFlags, setDevFlags] = useState<BackroomsDevFlags>(
    startsInDev ? { ...BACKROOMS_DEV_OFF, god: true, infinite: true } : BACKROOMS_DEV_OFF,
  );
  const [devSnap, setDevSnap] = useState<BackroomsDevSnapshot | null>(null);
  const devRef = useRef<BackroomsDevFlags>(BACKROOMS_DEV_OFF);
  const devOpenRef = useRef(false);
  useEffect(() => {
    devRef.current = devEnabled ? devFlags : BACKROOMS_DEV_OFF;
  }, [devEnabled, devFlags]);
  useEffect(() => {
    devOpenRef.current = devEnabled && devOpen;
  }, [devEnabled, devOpen]);
  // Le mode triche s'active ou se coupe en pleine partie (bouton 🛡) : la
  // boucle du jeu, lancee une seule fois, lit donc le droit en direct.
  const devLiveRef = useRef(devEnabled);
  useEffect(() => {
    devLiveRef.current = devEnabled;
  }, [devEnabled]);
  // Plan du niveau pour la carte du panneau : meme graine, meme carte.
  const devLevel = useMemo(() => (devEnabled ? generateLevel(level, seed) : null), [devEnabled, level, seed]);
  const containerRef = useRef<HTMLDivElement>(null);
  const voiceRef = useRef(voice);
  const micEnabledRef = useRef(micEnabled);
  useEffect(() => {
    voiceRef.current = voice;
    micEnabledRef.current = micEnabled;
  }, [voice, micEnabled]);
  const onDeathRef = useRef(onDeath);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onDeathRef.current = onDeath;
    onCompleteRef.current = onComplete;
  }, [onDeath, onComplete]);

  const [sanity, setSanity] = useState(100);
  const [battery, setBattery] = useState(100);
  const [lampOn, setLampOn] = useState(false);
  const [stamina, setStamina] = useState(100);
  const [water, setWater] = useState(0);
  const [objective, setObjective] = useState<HudObjective>({ title: "", detail: "" });
  const [signal, setSignal] = useState(0);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [intro, setIntro] = useState(true);
  const [dread, setDread] = useState(0);
  const [blackout, setBlackout] = useState(false);
  const [noclip, setNoclip] = useState(false);
  const [dying, setDying] = useState(false);
  const [valveProgress, setValveProgress] = useState<number | null>(null);
  const [clock, setClock] = useState(0);
  const [paused, setPaused] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [grain, setGrain] = useState<string | null>(null);
  const [brightnessLoaded, setBrightnessLoaded] = useState(1);
  const [crouched, setCrouched] = useState(false);
  /** Shaders en cours de compilation : ecran de chargement au lieu d'une page figee. */
  const [loading, setLoading] = useState(true);
  const [micLevel, setMicLevel] = useState(0);
  const [muted, setMuted] = useState(false);
  /** Mort en groupe : on continue a regarder (et a parler) jusqu'a la fin du niveau. */
  const [spectating, setSpectating] = useState(false);
  const [team, setTeam] = useState<{ id: string; name: string; color: string; dead: boolean; speaking: boolean }[]>([]);

  const layoutRef = useRef<Layout3D>("azerty");
  const sensitivityRef = useRef(1.5);
  const pausedRef = useRef(false);
  const heldRef = useRef({ forward: false, back: false, left: false, right: false, sprint: false, use: false });
  const apiRef = useRef<{
    applyBrightness: (v: number) => void;
    interact: () => void;
    toggleLamp: () => void;
    drink: () => void;
    toggleCrouch: () => void;
    resume: () => void;
    setSettingsOpen: (open: boolean) => void;
    applyQuality: (q: Quality3D) => void;
    devTeleport: (x: number, z: number) => void;
    devAdvance: () => void;
  } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      layoutRef.current = loadLayout3D();
      sensitivityRef.current = loadSensitivity3D();
      setBrightnessLoaded(loadBrightness3D());
      setIsTouch(window.matchMedia?.("(pointer: coarse)").matches ?? false);
      setGrain(getVhsGrain());
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const def = level;
    const data = generateLevel(def, seed);
    const { width: W, height: H, cells } = data;
    const CS = def.cellSize;
    const WH = def.wallHeight;
    const rng = mulberry32(seed + 17);
    const isSolid = (x: number, y: number) => isSolidCell(cells, W, H, x, y);
    /** Objet plein (chaise, caisse, comptoir...) : solide, mais dessine par le decor, pas un mur. */
    const isPropCell = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && cells[y * W + x] === CELL_PROP;
    // Objets bas (chaise, table, comptoir, lit, chariot, caisse seule) : ils
    // bloquent le passage, pas le regard. Sans ca, le Voleur de peau vu
    // par-dessus un comptoir ne se figeait pas, et personne ne se voyait
    // d'un bout a l'autre d'une table.
    const lowProp = new Uint8Array(cells.length);
    for (const p of data.props) {
      const low = p.kind === "chaise" || p.kind === "table" || p.kind === "comptoir" || p.kind === "lit" || p.kind === "chariot" || (p.kind === "caisse" && p.variant % 4 === 0);
      if (!low) continue;
      for (let y = p.y0; y <= p.y1; y++) for (let x = p.x0; x <= p.x1; x++) lowProp[y * W + x] = 1;
    }
    const blocksSight = (x: number, y: number) => isSolid(x, y) && !(x >= 0 && y >= 0 && x < W && y < H && lowProp[y * W + x] === 1);
    const radiusCells = PLAYER_RADIUS / CS;
    const words = goalWords(def.id);

    const reachable: [number, number][] = [];
    for (let i = 0; i < cells.length; i++) {
      if (data.distance[i] >= 0) reachable.push([i % W, Math.floor(i / W)]);
    }

    // --- Scene, camera, rendu ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(def.fog.color);
    scene.fog = new THREE.Fog(def.fog.color, def.fog.near, def.fog.far);
    const fog = scene.fog as THREE.Fog;

    // Rien n'est visible au-dela du brouillard : inutile de le dessiner.
    // Exception : le sourire du Souriant ignore le brouillard (il doit rester
    // visible au bout d'un couloir noir), on lui garde un peu plus de portee.
    // (Le vol du mode developpeur repousse cette limite, voir la boucle.)
    const VIEW_FAR = def.entity === "souriant" ? Math.max(60, def.fog.far + 6) : def.fog.far + 6;
    const camera = new THREE.PerspectiveCamera(72, container.clientWidth / container.clientHeight, 0.05, VIEW_FAR);
    camera.rotation.order = "YXZ";

    // Reglage "Qualite" partage : en "performance", pas d'anticrenelage,
    // resolution plafonnee a 1 et moins de lampes. L'anticrenelage et les
    // lampes ne changent qu'au niveau suivant (scene recreee).
    let quality: Quality3D = loadQuality3D();
    const renderer = new THREE.WebGLRenderer({ antialias: quality !== "performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    const PIXEL_RATIO_MAX = Math.min(window.devicePixelRatio || 1, 1.5);
    const PIXEL_RATIO_FLOOR = 0.6;
    const pixelCap = () => (quality === "performance" ? Math.min(1, PIXEL_RATIO_MAX) : PIXEL_RATIO_MAX);
    let pixelRatio = pixelCap();
    renderer.setPixelRatio(pixelRatio);
    container.appendChild(renderer.domElement);
    const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    let brightness = loadBrightness3D();
    const hemi = new THREE.HemisphereLight(def.hemi.sky, def.hemi.ground, def.hemi.intensity * brightness);
    scene.add(hemi);

    const owned: { dispose: () => void }[] = [];
    function own<T extends { dispose: () => void }>(thing: T): T {
      owned.push(thing);
      return thing;
    }
    function tex(t: THREE.Texture, rx = 1, ry = 1) {
      t.anisotropy = anisotropy;
      t.repeat.set(rx, ry);
      return own(t);
    }

    // --- Materiaux par niveau ---
    let makeWall: () => THREE.Texture;
    let floorTex: THREE.Texture;
    let ceilTex: THREE.Texture;
    let surface: Surface;
    if (def.id === "niveau-0") {
      makeWall = makeHallWallpaper;
      floorTex = tex(makeHallCarpet(), (W * CS) / 3.2, (H * CS) / 3.2);
      ceilTex = tex(makeCeilingTiles(), (W * CS) / 2.4, (H * CS) / 2.4);
      surface = "moquette";
    } else if (def.id === "niveau-1") {
      makeWall = makeConcreteWall;
      floorTex = tex(makeConcreteFloor(), (W * CS) / 6, (H * CS) / 6);
      ceilTex = tex(makeDarkCeiling("#24231f"), (W * CS) / 8, (H * CS) / 8);
      surface = "beton";
    } else if (def.id === "niveau-2") {
      makeWall = makeMetalWall;
      floorTex = tex(makeGrating(), (W * CS) / 1.4, (H * CS) / 1.4);
      ceilTex = tex(makeDarkCeiling("#15110f"), (W * CS) / 4, (H * CS) / 4);
      surface = "metal";
    } else if (def.id === "niveau-3") {
      makeWall = makeBrickWall;
      floorTex = tex(makeConcreteFloor(), (W * CS) / 5, (H * CS) / 5);
      ceilTex = tex(makeDarkCeiling("#1e1914"), (W * CS) / 4, (H * CS) / 4);
      surface = "beton";
    } else if (def.id === "niveau-4") {
      makeWall = makeOfficeWall;
      floorTex = tex(makeOfficeCarpet(), (W * CS) / 2, (H * CS) / 2);
      ceilTex = tex(makeCeilingTiles("#d3d6d0", 1), (W * CS) / 2.4, (H * CS) / 2.4);
      surface = "moquette";
    } else if (def.id === "niveau-37") {
      makeWall = () => makePoolTile(false);
      floorTex = tex(makePoolTile(false), (W * CS) / 2.4, (H * CS) / 2.4);
      ceilTex = tex(makeCeilingTiles("#e4ecea", 0), (W * CS) / 2.4, (H * CS) / 2.4);
      surface = "carrelage";
    } else if (def.id === "niveau-5") {
      // Hotel : damas rouge, moquette a losanges, plafond a caissons.
      makeWall = makeHotelWallpaper;
      floorTex = tex(makeHotelCarpet(), (W * CS) / 3, (H * CS) / 3);
      ceilTex = tex(makeHotelCeiling(), (W * CS) / 2.4, (H * CS) / 2.4);
      surface = "moquette";
    } else if (def.id === "niveau-6") {
      // Lumieres eteintes : beton noir, sol mouille, plafond qu'on ne voit pas.
      makeWall = makeBlackConcreteWall;
      floorTex = tex(makeBlackFloor(), (W * CS) / 4, (H * CS) / 4);
      ceilTex = tex(makeDarkCeiling("#0d0d0f"), (W * CS) / 4, (H * CS) / 4);
      surface = "beton";
    } else if (def.id === "niveau-fun") {
      // La Fete : papier peint a pois, moquette criarde, dalles pastel.
      makeWall = makePartyWallpaper;
      floorTex = tex(makePartyCarpet(), (W * CS) / 3, (H * CS) / 3);
      ceilTex = tex(makePartyCeiling(), (W * CS) / 2.4, (H * CS) / 2.4);
      surface = "moquette";
    } else {
      makeWall = makeTileWall;
      floorTex = tex(makeTileFloor(), (W * CS) / 2.4, (H * CS) / 2.4);
      ceilTex = tex(makeDarkCeiling("#1a1414"), (W * CS) / 4, (H * CS) / 4);
      surface = "carrelage";
    }
    // Trois variantes de chaque mur (taches, coulures, raccords differents) :
    // avec une seule texture, la repetition sautait aux yeux d'un couloir a l'autre.
    const wallMats = [0, 1, 2].map(() => own(new THREE.MeshLambertMaterial({ map: tex(makeWall()) })));
    const floorMat = own(new THREE.MeshLambertMaterial({ map: floorTex }));
    const ceilMat = own(new THREE.MeshLambertMaterial({ map: ceilTex }));

    // --- Etages ---
    // Hauteur du sol sous une ligne de la grille. Le rez va jusqu'a
    // `GROUND`, la cage d'escalier jusqu'a `UPPER`, puis l'etage.
    const floorY = (z: number) => floorYAt(data, z);
    const multiFloor = data.stairRows > 0;
    const GROUND = data.groundRows;
    const UPPER = data.groundRows + data.stairRows;
    const inStairwell = (row: number) => multiFloor && row >= GROUND && row < UPPER;

    // --- Sol et plafond ---
    function slab(mat: THREE.MeshLambertMaterial, z0: number, z1: number, y: number, up: boolean) {
      const rows = z1 - z0;
      if (rows <= 0) return;
      let material = mat;
      if (rows !== H && mat.map) {
        // Meme densite de motif que sur toute la carte : on reduit la repetition.
        const t = own(mat.map.clone());
        t.repeat.set(mat.map.repeat.x, (mat.map.repeat.y * rows) / H);
        t.needsUpdate = true;
        material = own(new THREE.MeshLambertMaterial({ map: t }));
      }
      const mesh = new THREE.Mesh(own(new THREE.PlaneGeometry(W * CS, rows * CS)), material);
      mesh.rotation.x = up ? -Math.PI / 2 : Math.PI / 2;
      mesh.position.set((W * CS) / 2, y, (z0 + rows / 2) * CS);
      scene.add(mesh);
    }
    if (!multiFloor) {
      slab(floorMat, 0, H, 0, true);
      slab(ceilMat, 0, H, WH, false);
    } else {
      slab(floorMat, 0, GROUND, 0, true);
      slab(floorMat, UPPER, H, WH, true);
      slab(ceilMat, 0, GROUND, WH, false);
      // Au-dessus de la cage d'escalier et de l'etage, le plafond est une hauteur plus haut.
      slab(ceilMat, GROUND, H, WH * 2, false);
    }

    // --- Murs et piliers ---
    const wallCells: number[] = [];
    const rackCells: number[] = [];
    for (let i = 0; i < cells.length; i++) {
      // Au niveau « ! », les obstacles sont dessines en objets par le decor.
      if (cells[i] === CELL_WALL || (cells[i] === CELL_PILLAR && def.id !== "niveau-run")) wallCells.push(i);
      else if (cells[i] === CELL_RACK) rackCells.push(i);
    }
    // On ne dessine que les murs qui touchent une case libre : l'interieur
    // des blocs pleins ne se voit jamais et coutait des milliers d'instances.
    // Un objet plein (caisse, lit, chaise...) ne monte pas au plafond : le mur
    // derriere lui se voit par-dessus, il compte comme une case libre.
    const seenFrom = (c: number) => c === CELL_OPEN || c === CELL_PROP;
    const visibleWalls = wallCells.filter((i) => {
      const x = i % W;
      const y = (i - x) / W;
      return (
        (x > 0 && seenFrom(cells[i - 1])) ||
        (x < W - 1 && seenFrom(cells[i + 1])) ||
        (y > 0 && seenFrom(cells[i - W])) ||
        (y < H - 1 && seenFrom(cells[i + W]))
      );
    });
    const wallGeo = own(new THREE.BoxGeometry(CS, WH, CS));
    const m4 = new THREE.Matrix4();
    const q4 = new THREE.Quaternion();
    const v4 = new THREE.Vector3();
    const s4 = new THREE.Vector3(1, 1, 1);
    wallMats.forEach((mat, variant) => {
      const mine = visibleWalls.filter((i) => ((i * 2654435761) >>> 0) % 3 === variant);
      const mesh = new THREE.InstancedMesh(wallGeo, mat, Math.max(1, mine.length * (multiFloor ? 2 : 1)));
      let k = 0;
      mine.forEach((i) => {
        const x = i % W;
        const y = (i - x) / W;
        // Deux murs empiles plutot qu'un mur etire : le papier peint garde ses proportions.
        if (!multiFloor || y < UPPER) {
          m4.makeTranslation((x + 0.5) * CS, WH / 2, (y + 0.5) * CS);
          mesh.setMatrixAt(k++, m4);
        }
        if (multiFloor && y >= GROUND) {
          m4.makeTranslation((x + 0.5) * CS, WH + WH / 2, (y + 0.5) * CS);
          mesh.setMatrixAt(k++, m4);
        }
      });
      mesh.count = k;
      scene.add(mesh);
    });

    // --- Decor : affiches, extincteurs, flaques, gyrophares, obstacles du niveau « ! » ---
    const decor = buildDecor({ data, cellSize: CS, wallHeight: WH, floorY });
    scene.add(decor.group);

    // --- Escaliers : de vraies marches, on monte dessus pour de bon ---
    if (multiFloor) {
      const stepColor =
        { "niveau-1": 0x55524c, "niveau-2": 0x35302c, "niveau-3": 0x4a4038, "niveau-4": 0x6a6e70, "niveau-5": 0x5e1418 }[def.id as string] ?? 0x8a7a42;
      const stepMat = own(new THREE.MeshLambertMaterial({ color: stepColor }));
      // Hotel : nez de marche en laiton, sur la moquette rouge.
      const noseColor = def.id === "niveau-0" ? 0x5e5128 : def.id === "niveau-4" ? 0x3a3d40 : def.id === "niveau-5" ? 0x9a7a34 : 0x24211e;
      const noseMat = own(new THREE.MeshLambertMaterial({ color: noseColor }));
      const STEPS = data.stairRows * 2;
      const stepDepth = (data.stairRows * CS) / STEPS;
      const railMat = own(new THREE.MeshLambertMaterial({ color: 0x2b2a26 }));
      const railLength = Math.hypot(data.stairRows * CS, WH);
      const railGeo = own(new THREE.BoxGeometry(0.07, 0.07, railLength));
      for (const st of data.stairs) {
        const stairWidth = (st.x1 - st.x0 + 1) * CS;
        const stepGeo = own(new THREE.BoxGeometry(stairWidth, 1, stepDepth));
        const noseGeo = own(new THREE.BoxGeometry(stairWidth, 0.04, 0.06));
        const steps = new THREE.InstancedMesh(stepGeo, stepMat, STEPS);
        const noses = new THREE.InstancedMesh(noseGeo, noseMat, STEPS);
        const cx = ((st.x0 + st.x1 + 1) / 2) * CS;
        for (let i = 0; i < STEPS; i++) {
          const zFront = GROUND + ((i + 1) * data.stairRows) / STEPS;
          const top = floorY(zFront);
          const zCenter = (GROUND + ((i + 0.5) * data.stairRows) / STEPS) * CS;
          m4.compose(v4.set(cx, top / 2, zCenter), q4.identity(), s4.set(1, Math.max(top, 0.02), 1));
          steps.setMatrixAt(i, m4);
          // Nez de marche plus sombre : on lit chaque marche, meme sans lampe.
          m4.compose(v4.set(cx, top + 0.005, (GROUND + (i * data.stairRows) / STEPS) * CS + 0.03), q4.identity(), s4.set(1, 1, 1));
          noses.setMatrixAt(i, m4);
        }
        scene.add(steps, noses);
        for (const side of [st.x0, st.x1 + 1]) {
          const rail = new THREE.Mesh(railGeo, railMat);
          rail.position.set(side * CS + (side === st.x0 ? 0.12 : -0.12), WH / 2 + 0.95, (GROUND + data.stairRows / 2) * CS);
          rail.rotation.x = -Math.atan2(WH, data.stairRows * CS);
          scene.add(rail);
        }
      }
    }

    // --- Machines de la centrale (niveau 3) : armoires, isolateurs, voyants ---
    let machineBlink: ((time: number) => void) | null = null;
    if (rackCells.length > 0 && def.id === "niveau-3") {
      const panelMat = own(new THREE.MeshLambertMaterial({ map: tex(makeMachinePanel()) }));
      const topMat = own(new THREE.MeshLambertMaterial({ color: 0x3a403c }));
      const machineH = Math.min(2.3, WH - 0.7);
      const body = new THREE.InstancedMesh(own(new THREE.BoxGeometry(CS, machineH, CS)), [panelMat, panelMat, topMat, topMat, panelMat, panelMat], rackCells.length);
      const insulatorMat = own(new THREE.MeshLambertMaterial({ color: 0x7a3f22 }));
      const insulators = new THREE.InstancedMesh(own(new THREE.CylinderGeometry(0.06, 0.1, 0.42, 8)), insulatorMat, rackCells.length * 3);
      const cableMat = own(new THREE.MeshLambertMaterial({ color: 0x151412 }));
      const cables = new THREE.InstancedMesh(own(new THREE.BoxGeometry(0.05, 1, 0.05)), cableMat, rackCells.length * 3);
      const lampGeo = own(new THREE.SphereGeometry(0.045, 6, 5));
      const redMat = own(new THREE.MeshBasicMaterial({ color: 0xff3020 }));
      const greenMat = own(new THREE.MeshBasicMaterial({ color: 0x30ff70 }));
      const redLamps = new THREE.InstancedMesh(lampGeo, redMat, rackCells.length * 4);
      const greenLamps = new THREE.InstancedMesh(lampGeo, greenMat, rackCells.length * 4);
      let ii = 0;
      let ci = 0;
      let ri = 0;
      let gi = 0;
      rackCells.forEach((i, k) => {
        const x = i % W;
        const y = (i - x) / W;
        const cx = (x + 0.5) * CS;
        const cz = (y + 0.5) * CS;
        const baseY = floorY(y + 0.5);
        m4.makeTranslation(cx, baseY + machineH / 2, cz);
        body.setMatrixAt(k, m4);
        const top = baseY + machineH;
        if (((i * 2654435761) >>> 0) % 2 === 0) {
          for (let n = -1; n <= 1; n++) {
            m4.makeTranslation(cx + n * CS * 0.28, top + 0.21, cz);
            insulators.setMatrixAt(ii++, m4);
            // Cable qui monte de chaque isolateur jusqu'au plafond.
            const len = Math.max(0.1, baseY + WH - (top + 0.42));
            m4.compose(v4.set(cx + n * CS * 0.28, top + 0.42 + len / 2, cz), q4.identity(), s4.set(1, len, 1));
            cables.setMatrixAt(ci++, m4);
          }
        }
        // Voyants sur les faces qui donnent sur un passage.
        for (const [dx, dy] of Object.values(DIRS)) {
          if (cells[(y + dy) * W + (x + dx)] !== CELL_OPEN) continue;
          const px = cx + dx * (CS / 2 + 0.02);
          const pz = cz + dy * (CS / 2 + 0.02);
          const side = dx !== 0 ? [0, 1] : [1, 0];
          m4.makeTranslation(px + side[0] * 0.25, baseY + 1.55, pz + side[1] * 0.25);
          redLamps.setMatrixAt(ri++, m4);
          m4.makeTranslation(px - side[0] * 0.25, baseY + 1.55, pz - side[1] * 0.25);
          greenLamps.setMatrixAt(gi++, m4);
        }
      });
      insulators.count = ii;
      cables.count = ci;
      redLamps.count = ri;
      greenLamps.count = gi;
      scene.add(body, insulators, cables, redLamps, greenLamps);
      machineBlink = (time) => {
        redLamps.visible = Math.sin(time * 3.1) > -0.2 && power > 0.5;
        greenLamps.visible = Math.sin(time * 1.7 + 1) > 0.1 && power > 0.5;
      };
    }

    // --- Postes de travail du niveau 4 : bureaux, cloisons, ecrans, chaises ---
    if (rackCells.length > 0 && def.id === "niveau-4") {
      const unit = own(new THREE.BoxGeometry(1, 1, 1));
      const n = rackCells.length;
      const deskMat = own(new THREE.MeshLambertMaterial({ color: 0xb8aa8c }));
      const metalMat = own(new THREE.MeshLambertMaterial({ color: 0x3c3f42 }));
      const fabricMat = own(new THREE.MeshLambertMaterial({ map: tex(makeCubicleFabric()) }));
      const chairMat = own(new THREE.MeshLambertMaterial({ color: 0x25282e }));
      const screenMat = own(new THREE.MeshBasicMaterial({ map: tex(makeScreenTexture()) }));
      const desks = new THREE.InstancedMesh(unit, deskMat, n);
      const metal = new THREE.InstancedMesh(unit, metalMat, n * 3);
      const panels = new THREE.InstancedMesh(unit, fabricMat, n * 3);
      const chairs = new THREE.InstancedMesh(unit, chairMat, n * 3);
      const screens = new THREE.InstancedMesh(own(new THREE.PlaneGeometry(0.46, 0.28)), screenMat, n);
      const e = new THREE.Euler();
      const put = (mesh: THREE.InstancedMesh, idx: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, yaw = 0) => {
        q4.setFromEuler(e.set(0, yaw, 0));
        m4.compose(v4.set(x, y, z), q4, s4.set(sx, sy, sz));
        mesh.setMatrixAt(idx, m4);
      };
      let di = 0;
      let mi = 0;
      let pi = 0;
      let chi = 0;
      let si = 0;
      const off = new THREE.Color(0x06080a);
      const on = new THREE.Color();
      for (const i of rackCells) {
        const x = i % W;
        const y = (i - x) / W;
        const cx = (x + 0.5) * CS;
        const cz = (y + 0.5) * CS;
        const baseY = floorY(y + 0.5);
        const upRack = y > 0 && cells[i - W] === CELL_RACK;
        const downRack = y < H - 1 && cells[i + W] === CELL_RACK;
        // -1 : on s'assoit au nord du bureau ; +1 : au sud.
        const facing = upRack && !downRack ? 1 : -1;
        const backZ = cz - facing * (CS / 2);
        const deskZ = backZ + facing * 0.42;
        put(desks, di++, cx, baseY + 0.74, deskZ, CS * 0.96, 0.04, 0.8);
        put(metal, mi++, cx, baseY + 0.4, backZ + facing * 0.06, CS * 0.9, 0.62, 0.03);
        // Cloison centrale, posee une seule fois par paire de bureaux.
        if (facing === -1 || !upRack) put(panels, pi++, cx, baseY + 0.7, backZ, CS, 1.4, 0.06);
        if (x > 0 && cells[i - 1] !== CELL_RACK) put(panels, pi++, cx - CS / 2, baseY + 0.62, cz - facing * 0.5, 0.05, 1.24, CS - 1);
        if (x < W - 1 && cells[i + 1] !== CELL_RACK) put(panels, pi++, cx + CS / 2, baseY + 0.62, cz - facing * 0.5, 0.05, 1.24, CS - 1);
        // Ecran : dos metallique, pied, et la dalle allumee (ou pas) tournee vers la chaise.
        const r = ((i * 2654435761) >>> 0) / 4294967296;
        const monX = cx + (r - 0.5) * CS * 0.3;
        const monZ = backZ + facing * 0.2;
        put(metal, mi++, monX, baseY + 1.08, monZ, 0.52, 0.34, 0.04);
        put(metal, mi++, monX, baseY + 0.85, monZ, 0.05, 0.2, 0.05);
        q4.setFromEuler(e.set(0, facing === -1 ? Math.PI : 0, 0));
        m4.compose(v4.set(monX, baseY + 1.08, monZ + facing * 0.025), q4, s4.set(1, 1, 1));
        screens.setMatrixAt(si, m4);
        screens.setColorAt(si, r < 0.55 ? on.setScalar(0.65 + r * 0.6) : off);
        si++;
        // Chaise de bureau, repoussee de travers.
        const chairZ = cz + facing * 0.45;
        const yaw = (r - 0.5) * 1.4;
        put(chairs, chi++, cx + (r - 0.5) * 0.5, baseY + 0.47, chairZ, 0.46, 0.08, 0.46, yaw);
        put(chairs, chi++, cx + (r - 0.5) * 0.5 + Math.sin(yaw) * facing * 0.22, baseY + 0.8, chairZ + Math.cos(yaw) * facing * 0.22, 0.44, 0.52, 0.06, yaw);
        put(chairs, chi++, cx + (r - 0.5) * 0.5, baseY + 0.24, chairZ, 0.06, 0.42, 0.06);
      }
      desks.count = di;
      metal.count = mi;
      panels.count = pi;
      chairs.count = chi;
      screens.count = si;
      scene.add(desks, metal, panels, chairs, screens);
    }

    // --- Bassins du niveau 37 : fond carrele bleu, margelle, eau qui ondule ---
    let waterTex: THREE.Texture | null = null;
    const hasWater = data.water.includes(1);
    /** Case du bassin profond (niveau 37) : eau sombre, on s'y enfonce davantage. */
    const isDeepWater = (i: number) => data.water[i] === 1 && data.zones[i] !== 0 && zoneKind(data.zones, i) === "bassin-profond";
    if (hasWater) {
      const waterCells: [number, number][] = [];
      for (let i = 0; i < cells.length; i++) if (data.water[i]) waterCells.push([i % W, Math.floor(i / W)]);
      const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
      const cellGeo = own(new THREE.PlaneGeometry(CS, CS));
      // Niveau 6 : pas un bassin mais une salle inondee — beton noir sous une
      // eau croupie, et pas de margelle.
      const flooded = def.id === "niveau-6";
      const poolTile = tex(makePoolTile(true));
      const bottomMat = own(
        flooded
          ? new THREE.MeshLambertMaterial({ color: 0x141416, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
          : new THREE.MeshLambertMaterial({ map: poolTile, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      );
      waterTex = tex(makeWaterSurface());
      const waterMat = own(
        flooded
          ? new THREE.MeshLambertMaterial({ map: waterTex, color: 0x4a5a56, emissive: 0x010202, transparent: true, opacity: 0.72, depthWrite: false })
          : new THREE.MeshLambertMaterial({ map: waterTex, color: 0xc4f1f5, emissive: 0x0b3a44, transparent: true, opacity: 0.62, depthWrite: false }),
      );
      // Bassin profond : le sol reste plat (une seule dalle pour tout le
      // niveau), alors on joue l'illusion — fond bleu nuit, eau presque
      // opaque, et on ne voit plus le carrelage du fond.
      const deepBottomMat = own(
        new THREE.MeshLambertMaterial({ map: poolTile, color: 0x24405a, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      );
      const deepWaterMat = own(
        new THREE.MeshLambertMaterial({ map: waterTex, color: 0x5d98aa, emissive: 0x03141c, transparent: true, opacity: 0.86, depthWrite: false }),
      );
      const deepCount = waterCells.reduce((n, [x, y]) => n + (isDeepWater(y * W + x) ? 1 : 0), 0);
      const shallowCount = waterCells.length - deepCount;
      const bottoms = new THREE.InstancedMesh(cellGeo, bottomMat, Math.max(1, shallowCount));
      const surfaces = new THREE.InstancedMesh(cellGeo, waterMat, Math.max(1, shallowCount));
      const deepBottoms = new THREE.InstancedMesh(cellGeo, deepBottomMat, Math.max(1, deepCount));
      const deepSurfaces = new THREE.InstancedMesh(cellGeo, deepWaterMat, Math.max(1, deepCount));
      const rims: { x: number; z: number; alongZ: boolean }[] = [];
      let si = 0;
      let di = 0;
      waterCells.forEach(([x, y]) => {
        const baseY = floorY(y + 0.5);
        const deep = isDeepWater(y * W + x);
        const k = deep ? di++ : si++;
        m4.compose(v4.set((x + 0.5) * CS, baseY + 0.006, (y + 0.5) * CS), flat, s4.set(1, 1, 1));
        (deep ? deepBottoms : bottoms).setMatrixAt(k, m4);
        m4.compose(v4.set((x + 0.5) * CS, baseY + WATER_Y, (y + 0.5) * CS), flat, s4.set(1, 1, 1));
        (deep ? deepSurfaces : surfaces).setMatrixAt(k, m4);
        if (flooded) return;
        for (const [dx, dy] of Object.values(DIRS)) {
          const nx = x + dx;
          const ny = y + dy;
          if (isSolid(nx, ny) || data.water[ny * W + nx]) continue;
          rims.push({ x: (x + 0.5 + dx * 0.5) * CS, z: (y + 0.5 + dy * 0.5) * CS, alongZ: dx !== 0 });
        }
      });
      bottoms.count = shallowCount;
      surfaces.count = shallowCount;
      deepBottoms.count = deepCount;
      deepSurfaces.count = deepCount;
      if (deepCount > 0) scene.add(deepBottoms, deepSurfaces);
      const rimMesh = new THREE.InstancedMesh(
        own(new THREE.BoxGeometry(CS + 0.22, 0.2, 0.22)),
        own(new THREE.MeshLambertMaterial({ color: 0xeef5f3 })),
        Math.max(1, rims.length),
      );
      const qAlongZ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
      rims.forEach((rim, k) => {
        m4.compose(v4.set(rim.x, floorY(rim.z / CS) + 0.1, rim.z), rim.alongZ ? qAlongZ : q4.identity(), s4.set(1, 1, 1));
        rimMesh.setMatrixAt(k, m4);
      });
      rimMesh.count = rims.length;
      scene.add(bottoms, surfaces, rimMesh);
    }

    // --- Rayonnages du niveau 1 ---
    if (rackCells.length > 0 && def.id !== "niveau-3" && def.id !== "niveau-4") {
      const frameMat = own(new THREE.MeshLambertMaterial({ color: 0x2f4f7a }));
      const boxMat = own(new THREE.MeshLambertMaterial({ map: tex(makeCardboard()) }));
      const unit = own(new THREE.BoxGeometry(1, 1, 1));
      const frame = new THREE.InstancedMesh(unit, frameMat, rackCells.length * 7);
      const boxes = new THREE.InstancedMesh(unit, boxMat, rackCells.length * 8);
      let fi = 0;
      let bi = 0;
      const put = (mesh: THREE.InstancedMesh, idx: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, yaw = 0) => {
        q4.setFromEuler(new THREE.Euler(0, yaw, 0));
        m4.compose(v4.set(x, y, z), q4, s4.set(sx, sy, sz));
        mesh.setMatrixAt(idx, m4);
      };
      const rackH = Math.min(3.2, WH - 0.4);
      for (const i of rackCells) {
        const cx = ((i % W) + 0.5) * CS;
        const cz = (Math.floor(i / W) + 0.5) * CS;
        const baseY = floorY(Math.floor(i / W) + 0.5);
        const half = CS * 0.46;
        for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          put(frame, fi++, cx + ox * half, baseY + rackH / 2, cz + oz * half, 0.07, rackH, 0.07);
        }
        for (let s = 0; s < 3; s++) {
          const sy = baseY + 0.35 + s * ((rackH - 0.5) / 2);
          put(frame, fi++, cx, sy, cz, CS * 0.96, 0.05, CS * 0.96);
          for (let b = 0; b < 3 && bi < rackCells.length * 8; b++) {
            if (rng() < 0.3) continue;
            const bw = 0.4 + rng() * 0.5;
            const bh = 0.3 + rng() * 0.45;
            put(boxes, bi++, cx + (rng() - 0.5) * CS * 0.5, sy + 0.03 + bh / 2, cz + (rng() - 0.5) * CS * 0.5, bw, bh, bw * (0.7 + rng() * 0.5), rng() * 0.5);
          }
        }
      }
      frame.count = fi;
      boxes.count = bi;
      scene.add(frame, boxes);
    }

    // --- Tuyaux du niveau 2, le long des murs ---
    if (def.id === "niveau-2") {
      const pipeMat = own(new THREE.MeshLambertMaterial({ color: 0x5a3b2a }));
      const pipeGeo = own(new THREE.CylinderGeometry(0.06, 0.06, CS, 8));
      const faces: { x: number; z: number; along: "x" | "z" }[] = [];
      for (const [x, y] of reachable) {
        if (inStairwell(y)) continue;
        for (const [dx, dy] of Object.values(DIRS)) {
          // Pas le long des objets pleins (vannes geantes) : les tuyaux flotteraient.
          if (!isSolid(x + dx, y + dy) || isPropCell(x + dx, y + dy)) continue;
          faces.push({ x: (x + 0.5 + dx * 0.43) * CS, z: (y + 0.5 + dy * 0.43) * CS, along: dx !== 0 ? "z" : "x" });
        }
      }
      const pipes = new THREE.InstancedMesh(pipeGeo, pipeMat, faces.length * 2);
      let pi = 0;
      for (const f of faces) {
        const baseY = floorY(f.z / CS);
        for (const py of [baseY + WH - 0.32, baseY + WH - 0.55]) {
          q4.setFromEuler(new THREE.Euler(f.along === "x" ? 0 : Math.PI / 2, 0, f.along === "x" ? Math.PI / 2 : 0));
          m4.compose(v4.set(f.x, py, f.z), q4, s4.set(1, 1, 1));
          pipes.setMatrixAt(pi++, m4);
        }
      }
      pipes.count = pi;
      scene.add(pipes);
    }

    // --- Luminaires ---
    /** `ly` : hauteur de la lumiere quand elle n'est pas juste sous l'ampoule (baton pose au sol). */
    type Fixture = { x: number; y: number; z: number; state: 0 | 1 | 2; phase: number; index: number; ly?: number };
    const fixtures: Fixture[] = [];
    let fixtureMesh: THREE.InstancedMesh | null = null;
    const litColor = new THREE.Color(0xffffff);
    const deadColor = new THREE.Color(0x3a382f);
    const tmpColor = new THREE.Color();
    // Eclairages des niveaux 5, 6 et Fun : chaque luminaire a sa couleur.
    const themedLighting = def.lighting === "hotel" || def.lighting === "noir" || def.lighting === "fete";
    /** Couleur de la lumiere de chaque luminaire (celle du niveau, ou la teinte propre du luminaire). */
    const lightColors = data.lights.map((l) => new THREE.Color(themedLighting && l.tint !== undefined ? l.tint : def.lamp.color));
    if (def.lighting === "neons") {
      const panelTex = tex(
        def.id === "niveau-4" ? makeLightPanel("#f6fbff", "#d8e2e6") : def.id === "niveau-37" ? makeLightPanel("#ffffff", "#e0f1f1") : makeLightPanel(),
      );
      const panelMat = own(new THREE.MeshBasicMaterial({ map: panelTex }));
      const panelGeo = own(new THREE.BoxGeometry(CS * 0.62, 0.05, CS * 0.32));
      fixtureMesh = new THREE.InstancedMesh(panelGeo, panelMat, Math.max(1, data.lights.length));
      data.lights.forEach((l, k) => {
        const f: Fixture = { x: (l.x + 0.5) * CS, y: floorY(l.y + 0.5) + WH - 0.03, z: (l.y + 0.5) * CS, state: l.state, phase: rng() * 100, index: k };
        fixtures.push(f);
        m4.makeTranslation(f.x, f.y, f.z);
        fixtureMesh!.setMatrixAt(k, m4);
        fixtureMesh!.setColorAt(k, l.state === 1 ? deadColor : litColor);
      });
    } else if (def.lighting === "entrepot") {
      // Lampes suspendues : abat-jour, cable, et le globe qui eclaire.
      const shadeMat = own(new THREE.MeshLambertMaterial({ color: 0x2a2c2a }));
      const shadeGeo = own(new THREE.ConeGeometry(0.42, 0.3, 12, 1, true));
      const cableGeo = own(new THREE.BoxGeometry(0.02, 0.9, 0.02));
      const bulbMat = own(new THREE.MeshBasicMaterial({ color: 0xffffff }));
      const bulbGeo = own(new THREE.SphereGeometry(0.13, 10, 8));
      const n = Math.max(1, data.lights.length);
      const shades = new THREE.InstancedMesh(shadeGeo, shadeMat, n);
      const cables = new THREE.InstancedMesh(cableGeo, shadeMat, n);
      fixtureMesh = new THREE.InstancedMesh(bulbGeo, bulbMat, n);
      data.lights.forEach((l, k) => {
        const x = (l.x + 0.5) * CS;
        const z = (l.y + 0.5) * CS;
        const baseY = floorY(l.y + 0.5);
        const y = baseY + WH - 1.1;
        fixtures.push({ x, y: y - 0.1, z, state: l.state, phase: rng() * 100, index: k });
        m4.makeTranslation(x, y + 0.08, z);
        shades.setMatrixAt(k, m4);
        m4.makeTranslation(x, baseY + WH - 0.45, z);
        cables.setMatrixAt(k, m4);
        m4.makeTranslation(x, y - 0.02, z);
        fixtureMesh!.setMatrixAt(k, m4);
        fixtureMesh!.setColorAt(k, l.state === 1 ? deadColor : tmpColor.setHex(0xffb86a));
      });
      scene.add(shades, cables);
    } else if (def.lighting === "secours") {
      const cageMat = own(new THREE.MeshLambertMaterial({ color: 0x1d1a18 }));
      const cageGeo = own(new THREE.BoxGeometry(0.24, 0.22, 0.14));
      const bulbMat = own(new THREE.MeshBasicMaterial({ color: 0xffffff }));
      const bulbGeo = own(new THREE.SphereGeometry(0.075, 8, 6));
      const n = Math.max(1, data.lights.length);
      const cages = new THREE.InstancedMesh(cageGeo, cageMat, n);
      fixtureMesh = new THREE.InstancedMesh(bulbGeo, bulbMat, n);
      data.lights.forEach((l, k) => {
        const t = faceTransform({ x: l.x, y: l.y, dir: l.wall ?? "N" }, CS, 0.08);
        const y = floorY(l.y + 0.5) + WH - 0.75;
        fixtures.push({ x: t.x - t.dx * 0.05, y, z: t.z - t.dy * 0.05, state: l.state, phase: rng() * 100, index: k });
        q4.setFromEuler(new THREE.Euler(0, t.yaw, 0));
        m4.compose(v4.set(t.x, y, t.z), q4, s4.set(1, 1, 1));
        cages.setMatrixAt(k, m4);
        m4.makeTranslation(t.x - t.dx * 0.06, y, t.z - t.dy * 0.06);
        fixtureMesh!.setMatrixAt(k, m4);
        fixtureMesh!.setColorAt(k, l.state === 1 ? deadColor : tmpColor.setHex(def.id === "niveau-3" ? 0xffa040 : 0xff2a18));
      });
      scene.add(cages);
    } else if (themedLighting) {
      // Appliques, lustres, ampoules nues, batons lumineux : le decor dessine
      // le corps du luminaire autour du point donne par fixtureBulb ; ici,
      // seulement ce qui s'allume (une sphere, etiree en baton au sol).
      const bulbMat = own(new THREE.MeshBasicMaterial({ color: 0xffffff }));
      const bulbGeo = own(new THREE.SphereGeometry(1, 12, 8));
      fixtureMesh = new THREE.InstancedMesh(bulbGeo, bulbMat, Math.max(1, data.lights.length));
      const e = new THREE.Euler();
      data.lights.forEach((l, k) => {
        const kind = l.fixture ?? "ampoule";
        const bulb = fixtureBulb(kind, WH);
        const baseY = floorY(l.y + 0.5);
        let x = (l.x + 0.5) * CS;
        let z = (l.y + 0.5) * CS;
        let yaw = 0;
        if (kind === "applique" && l.wall) {
          const t = faceTransform({ x: l.x, y: l.y, dir: l.wall }, CS, bulb.inset);
          x = t.x;
          z = t.z;
          yaw = t.yaw;
        } else if (kind === "baton") {
          // Tombe de travers : un lacet tire de la case, le meme chez tout le groupe.
          yaw = ((((l.x * 73856093) ^ (l.y * 19349663)) >>> 0) % 628) / 100;
        }
        const y = baseY + bulb.y;
        if (kind === "baton") s4.set(0.024, 0.024, 0.1);
        else if (kind === "lustre") s4.set(0.065, 0.075, 0.065);
        else if (kind === "applique") s4.set(0.06, 0.08, 0.06);
        else s4.set(0.07, 0.09, 0.07);
        q4.setFromEuler(e.set(0, yaw, 0));
        m4.compose(v4.set(x, y, z), q4, s4);
        fixtureMesh!.setMatrixAt(k, m4);
        fixtureMesh!.setColorAt(k, l.state === 1 ? deadColor : tmpColor.setHex(l.tint ?? def.lamp.color));
        // Baton : la lumiere monte un peu au-dessus du sol, sinon elle n'eclairerait que le dessous du plancher.
        const ly = kind === "baton" ? baseY + 0.35 : kind === "applique" ? y - 0.05 : y - 0.12;
        fixtures.push({ x, y, z, state: l.state, phase: rng() * 100, index: k, ly });
      });
      s4.set(1, 1, 1);
    } else {
      const stripMat = own(new THREE.MeshBasicMaterial({ color: 0xffffff }));
      const stripGeo = own(new THREE.BoxGeometry(CS * 0.9, 0.06, 0.16));
      fixtureMesh = new THREE.InstancedMesh(stripGeo, stripMat, Math.max(1, data.lights.length));
      data.lights.forEach((l, k) => {
        const f: Fixture = { x: (l.x + 0.5) * CS, y: floorY(l.y + 0.5) + WH - 0.04, z: (l.y + 0.5) * CS, state: l.state, phase: rng() * 100, index: k };
        fixtures.push(f);
        m4.makeTranslation(f.x, f.y, f.z);
        fixtureMesh!.setMatrixAt(k, m4);
        fixtureMesh!.setColorAt(k, l.state === 1 ? deadColor : tmpColor.setHex(0xff3322));
      });
    }
    const baseFixtureColors = fixtures.map((f) => {
      const c = new THREE.Color();
      fixtureMesh?.getColorAt(f.index, c);
      return c;
    });
    if (fixtureMesh) {
      fixtureMesh.count = data.lights.length;
      scene.add(fixtureMesh);
    }
    const flickering = fixtures.filter((f) => f.state === 2);

    // --- Halos autour des luminaires ---
    // Un faux « bloom » : chaque lampe allumee recoit une lueur douce qui bave
    // dans le brouillard. Un seul nuage de points additifs pour tout le niveau.
    const glowTex = own(makeGlowTexture());
    const lit = fixtures.filter((f) => f.state !== 1);
    const glowTint = def.id === "niveau-0" ? new THREE.Color(1, 0.95, 0.72) : def.lighting === "neons" ? new THREE.Color(0.9, 0.97, 1) : new THREE.Color(1, 1, 1);
    const glowBase = lit.map((f) => baseFixtureColors[f.index].clone().multiply(glowTint));
    const glowPositions = new Float32Array(Math.max(1, lit.length) * 3);
    const glowColors = new Float32Array(Math.max(1, lit.length) * 3);
    lit.forEach((f, i) => {
      glowPositions[i * 3] = f.x;
      // Baton pose au sol (lumiere plus haute que lui) : le halo flotte juste au-dessus, pas a moitie sous le plancher.
      glowPositions[i * 3 + 1] = f.ly !== undefined && f.ly > f.y ? f.y + 0.1 : f.y - (def.lighting === "neons" ? 0.1 : 0.02);
      glowPositions[i * 3 + 2] = f.z;
      glowColors[i * 3] = glowBase[i].r;
      glowColors[i * 3 + 1] = glowBase[i].g;
      glowColors[i * 3 + 2] = glowBase[i].b;
    });
    const glowGeo = own(new THREE.BufferGeometry());
    glowGeo.setAttribute("position", new THREE.BufferAttribute(glowPositions, 3));
    const glowColorAttr = new THREE.BufferAttribute(glowColors, 3);
    glowGeo.setAttribute("color", glowColorAttr);
    glowGeo.setDrawRange(0, lit.length);
    const glowMat = own(
      new THREE.PointsMaterial({
        map: glowTex,
        size:
          def.lighting === "neons"
            ? 1.7
            : def.lighting === "entrepot"
              ? 2.4
              : def.lighting === "secours"
                ? 1.2
                : def.lighting === "hotel"
                  ? 1.3
                  : def.lighting === "noir"
                    ? 0.9
                    : 1.5,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        // Dans le noir complet, le halo d'un baton est tout ce qu'on voit de loin.
        opacity: def.lighting === "neons" ? 0.38 : def.lighting === "noir" ? 0.7 : 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const glowPoints = new THREE.Points(glowGeo, glowMat);
    glowPoints.frustumCulled = false;
    scene.add(glowPoints);
    const litIndex = new Map(lit.map((f, i) => [f.index, i]));

    // La Fete : chaque ampoule garde sa saturation et sa clarte, mais sa
    // teinte tourne doucement (un tour en une demi-minute environ).
    const partyHue = def.lighting === "fete" ? new Float32Array(fixtures.length * 3) : null;
    if (partyHue) {
      const hsl = { h: 0, s: 0, l: 0 };
      fixtures.forEach((f, i) => {
        baseFixtureColors[f.index].getHSL(hsl);
        partyHue[i * 3] = hsl.h;
        partyHue[i * 3 + 1] = Math.max(0.75, hsl.s);
        partyHue[i * 3 + 2] = THREE.MathUtils.clamp(hsl.l, 0.45, 0.62);
      });
    }
    const partyHemi = new THREE.Color();
    let partyTimer = 0;

    // --- Ombres de contact au pied des murs et sous le plafond ---
    // Sans elles, les murs semblaient poses sur le sol sans jamais le toucher.
    // Des bandes degradees a plat, instanciees : deux appels de rendu.
    {
      const aoTex = own(makeContactShadowTexture());
      const aoMat = own(
        new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, opacity: def.id === "niveau-37" ? 0.3 : def.id === "niveau-0" || def.id === "niveau-4" ? 0.5 : 0.65, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }),
      );
      const depth = 0.65;
      const aoGeo = own(new THREE.PlaneGeometry(CS, depth));
      const faces: { x: number; z: number; dx: number; dz: number }[] = [];
      for (const [x, y] of reachable) {
        // Pas dans la cage d'escalier : une bande a plat flotterait au-dessus des marches.
        if (inStairwell(y)) continue;
        for (const [dx, dz] of Object.values(DIRS)) {
          // Murs seulement : une bande sombre au plafond au-dessus d'une chaise n'aurait aucun sens.
          if (isSolid(x + dx, y + dz) && !isPropCell(x + dx, y + dz)) faces.push({ x, z: y, dx, dz });
        }
      }
      const floorAo = new THREE.InstancedMesh(aoGeo, aoMat, Math.max(1, faces.length));
      const ceilAo = new THREE.InstancedMesh(aoGeo, aoMat, Math.max(1, faces.length));
      const qFlatFloor = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
      const qFlatCeil = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
      const qYaw = new THREE.Quaternion();
      const yAxis = new THREE.Vector3(0, 1, 0);
      const mat4 = new THREE.Matrix4();
      const pos = new THREE.Vector3();
      const one = new THREE.Vector3(1, 1, 1);
      faces.forEach((f, i) => {
        const cx = (f.x + 0.5 + f.dx * (0.5 - depth / 2 / CS)) * CS;
        const cz = (f.z + 0.5 + f.dz * (0.5 - depth / 2 / CS)) * CS;
        // Sol : le bord sombre (+Y local, qui devient -Z) tourne vers le mur.
        qYaw.setFromAxisAngle(yAxis, Math.atan2(-f.dx, -f.dz));
        const baseY = floorY(f.z + 0.5);
        mat4.compose(pos.set(cx, baseY + 0.004, cz), qYaw.clone().multiply(qFlatFloor), one);
        floorAo.setMatrixAt(i, mat4);
        qYaw.setFromAxisAngle(yAxis, Math.atan2(f.dx, f.dz));
        mat4.compose(pos.set(cx, baseY + WH - 0.004, cz), qYaw.clone().multiply(qFlatCeil), one);
        ceilAo.setMatrixAt(i, mat4);
      });
      floorAo.count = faces.length;
      ceilAo.count = faces.length;
      scene.add(floorAo, ceilAo);
    }

    // Reserve de lumieres : un nombre FIXE de lampes, deplacees sur les
    // luminaires les plus proches du joueur. Des centaines de neons a
    // l'ecran, cinq lumieres calculees, et aucune recompilation de shader.
    // Au plus 8 lumieres dynamiques en tout : la reserve, la torche et l'ambiance.
    // Dans le noir (niveau 6), seulement les quelques batons les plus proches.
    const POOL =
      quality === "performance" ? 3 : def.lighting === "noir" ? 3 : def.lighting === "neons" || def.lighting === "hotel" || def.lighting === "fete" ? 5 : 4;
    const pool = Array.from({ length: POOL }, () => {
      const light = new THREE.PointLight(def.lamp.color, 0, def.lamp.range, 1.4);
      scene.add(light);
      return { light, fixture: -1, level: 0 };
    });

    // Lampe torche.
    const flashlight = new THREE.SpotLight(0xfff2d6, 0, 26, Math.PI / 6.5, 0.5, 1.2);
    const flashTarget = new THREE.Object3D();
    scene.add(flashTarget, flashlight);
    flashlight.target = flashTarget;

    // --- Porte de sortie ---
    const exitT = faceTransform(data.exit, CS, 0.03);
    const doorStyle = (
      {
        "niveau-1": "monte-charge",
        "niveau-2": "trappe",
        "niveau-3": "centrale",
        "niveau-4": "securite",
        "niveau-37": "piscine",
        "niveau-run": "sortie",
        "niveau-5": "hotel",
        "niveau-6": "noir",
        "niveau-fun": "fete",
      } as const
    )[def.id as string] ?? "service";
    const doorW = def.id === "niveau-1" ? Math.min(CS * 0.9, 2.2) : Math.min(CS * 0.7, 1.15);
    const doorH = def.id === "niveau-1" ? 2.6 : 2.1;
    const exitGroup = new THREE.Group();
    exitGroup.position.set(exitT.x, floorY(data.exit.y + 0.5), exitT.z);
    exitGroup.rotation.y = exitT.yaw;
    scene.add(exitGroup);
    const doorTex = own(makeDoorTexture(doorStyle));
    const doorMat = own(new THREE.MeshLambertMaterial({ map: doorTex }));
    const frameDark = own(new THREE.MeshLambertMaterial({ color: 0x1c1b18 }));
    const doorHinge = new THREE.Group();
    doorHinge.position.set(-doorW / 2, 0, 0.02);
    exitGroup.add(doorHinge);
    const doorLeaf = new THREE.Mesh(own(new THREE.BoxGeometry(doorW, doorH, 0.05)), doorMat);
    doorLeaf.position.set(doorW / 2, doorH / 2, 0);
    doorHinge.add(doorLeaf);
    for (const [fx, fy, fw, fh] of [
      [-doorW / 2 - 0.05, doorH / 2, 0.1, doorH + 0.1],
      [doorW / 2 + 0.05, doorH / 2, 0.1, doorH + 0.1],
      [0, doorH + 0.05, doorW + 0.2, 0.1],
    ] as const) {
      const frameMesh = new THREE.Mesh(own(new THREE.BoxGeometry(fw, fh, 0.09)), frameDark);
      frameMesh.position.set(fx, fy, 0.01);
      exitGroup.add(frameMesh);
    }
    // Voyants au-dessus de la porte : un par objectif, rouges puis verts.
    const indicatorMats: THREE.MeshBasicMaterial[] = [];
    if (def.goalCount > 0) {
      const indGeo = own(new THREE.SphereGeometry(0.06, 8, 6));
      for (let i = 0; i < def.goalCount; i++) {
        const mat = own(new THREE.MeshBasicMaterial({ color: 0xb01a10 }));
        indicatorMats.push(mat);
        const ind = new THREE.Mesh(indGeo, mat);
        ind.position.set((i - (def.goalCount - 1) / 2) * 0.22, doorH + 0.28, 0.05);
        exitGroup.add(ind);
      }
    }
    // Niveau 6 : le panneau de secours, sur batterie, est la seule chose allumee au fond du noir.
    if (def.id === "niveau-0" || def.id === "niveau-run" || def.id === "niveau-37" || def.id === "niveau-6") {
      const sign = new THREE.Mesh(own(new THREE.PlaneGeometry(0.62, 0.23)), own(new THREE.MeshBasicMaterial({ map: own(makeExitSign()) })));
      sign.position.set(0, doorH + 0.3, 0.06);
      exitGroup.add(sign);
    }

    // --- Fleches taguees ---
    if (data.arrows.length > 0) {
      const arrowTex = own(makeArrowDecal());
      const arrowMat = own(
        new THREE.MeshLambertMaterial({ map: arrowTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }),
      );
      const arrowGeo = own(new THREE.PlaneGeometry(0.95, 0.95));
      for (const a of data.arrows) {
        const t = faceTransform(a, CS, 0.015);
        const mesh = new THREE.Mesh(arrowGeo, arrowMat);
        mesh.position.set(t.x, floorY(a.y + 0.5) + 1.45 + (rng() - 0.5) * 0.3, t.z);
        mesh.rotation.set(0, t.yaw, (rng() - 0.5) * 0.25);
        if (a.arrow === "gauche") mesh.scale.x = -1;
        scene.add(mesh);
      }
    }

    // --- Objets ---
    const glintTex = own(makeGlintTexture());
    const labelTex = own(makeWaterLabel());
    const bottleGeo = own(new THREE.CylinderGeometry(0.055, 0.06, 0.26, 12));
    const bottleMat = own(new THREE.MeshLambertMaterial({ color: 0xcfdcd6, transparent: true, opacity: 0.85 }));
    const labelGeo = own(new THREE.CylinderGeometry(0.062, 0.062, 0.1, 12, 1, true));
    const labelMat = own(new THREE.MeshLambertMaterial({ map: labelTex }));
    const capGeo = own(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 8));
    const capMat = own(new THREE.MeshLambertMaterial({ color: 0x3b6fa8 }));
    const batGeo = own(new THREE.BoxGeometry(0.07, 0.14, 0.07));
    const batMat = own(new THREE.MeshLambertMaterial({ color: 0x2c2c2a }));
    const batTopMat = own(new THREE.MeshLambertMaterial({ color: 0xc9a227 }));
    const fuseGeo = own(new THREE.CylinderGeometry(0.045, 0.045, 0.2, 10));
    const fuseMat = own(new THREE.MeshLambertMaterial({ color: 0xd8d2bd }));
    const fuseBandMat = own(new THREE.MeshLambertMaterial({ color: 0xb0281c }));
    const badgeGeo = own(new THREE.BoxGeometry(0.12, 0.01, 0.08));
    const badgeMat = own(new THREE.MeshLambertMaterial({ color: 0xf2f2ee }));
    const badgeStripeGeo = own(new THREE.BoxGeometry(0.12, 0.004, 0.024));
    const badgeStripeMat = own(new THREE.MeshLambertMaterial({ color: 0x2a6f9e }));
    const cordGeo = own(new THREE.TorusGeometry(0.075, 0.006, 6, 18));
    // Cle du personnel de l'hotel : tige, anneau et panneton en laiton, porte-cle en bois.
    const keyShaftGeo = own(new THREE.BoxGeometry(0.13, 0.012, 0.018));
    const keyBowGeo = own(new THREE.TorusGeometry(0.028, 0.008, 6, 14));
    const keyBitGeo = own(new THREE.BoxGeometry(0.014, 0.012, 0.032));
    const keyTagGeo = own(new THREE.BoxGeometry(0.075, 0.014, 0.042));
    const keyTagMat = own(new THREE.MeshLambertMaterial({ color: 0x6a3a1e }));

    const pickups = data.pickups.map((p) => {
      const group = new THREE.Group();
      const px = (p.x + 0.5 + (rng() - 0.5) * 0.4) * CS;
      const pz = (p.y + 0.5 + (rng() - 0.5) * 0.4) * CS;
      group.position.set(px, floorY(pz / CS), pz);
      group.rotation.y = rng() * Math.PI * 2;
      if (p.kind === "eau") {
        const body = new THREE.Mesh(bottleGeo, bottleMat);
        body.position.y = 0.13;
        const label = new THREE.Mesh(labelGeo, labelMat);
        label.position.y = 0.12;
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.position.y = 0.28;
        group.add(body, label, cap);
      } else if (p.kind === "pile") {
        // Couchee au sol.
        const body = new THREE.Mesh(batGeo, batMat);
        body.rotation.z = Math.PI / 2;
        body.position.y = 0.035;
        const top = new THREE.Mesh(batGeo, batTopMat);
        top.scale.set(0.5, 0.25, 0.5);
        top.rotation.z = Math.PI / 2;
        top.position.set(0.085, 0.035, 0);
        group.add(body, top);
      } else if (def.id === "niveau-4") {
        // Badge d'acces tombe par terre, avec son cordon rouge.
        const card = new THREE.Mesh(badgeGeo, badgeMat);
        card.position.y = 0.006;
        const stripe = new THREE.Mesh(badgeStripeGeo, badgeStripeMat);
        stripe.position.set(0, 0.012, -0.022);
        const cord = new THREE.Mesh(cordGeo, fuseBandMat);
        cord.rotation.x = -Math.PI / 2;
        cord.position.set(0, 0.004, 0.1);
        group.add(card, stripe, cord);
      } else if (def.id === "niveau-5") {
        const shaft = new THREE.Mesh(keyShaftGeo, batTopMat);
        shaft.position.y = 0.008;
        const bow = new THREE.Mesh(keyBowGeo, batTopMat);
        bow.rotation.x = -Math.PI / 2;
        bow.position.set(-0.09, 0.008, 0);
        const bit = new THREE.Mesh(keyBitGeo, batTopMat);
        bit.position.set(0.05, 0.008, 0.022);
        const tag = new THREE.Mesh(keyTagGeo, keyTagMat);
        tag.position.set(-0.16, 0.008, 0.012);
        tag.rotation.y = 0.4;
        group.add(shaft, bow, bit, tag);
      } else {
        const body = new THREE.Mesh(fuseGeo, fuseMat);
        body.position.y = 0.1;
        const band = new THREE.Mesh(fuseGeo, fuseBandMat);
        band.scale.set(1.05, 0.25, 1.05);
        band.position.y = 0.1;
        group.add(body, band);
      }
      const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTex, transparent: true, depthWrite: false, color: p.kind === "fusible" ? 0xffd27a : 0xfff6d8 }));
      own(glint.material);
      glint.scale.setScalar(0.35);
      glint.position.y = 0.3;
      group.add(glint);
      scene.add(group);
      return { kind: p.kind as PickupKind, x: px / CS, z: pz / CS, group, glint, taken: false, phase: rng() * 10 };
    });

    // --- Vannes du niveau 2 ---
    const wheelMat = own(new THREE.MeshLambertMaterial({ color: 0x9a2418 }));
    const pipeStubMat = own(new THREE.MeshLambertMaterial({ color: 0x3a3532 }));
    const breakerTex = def.id === "niveau-3" ? own(makeFuseBoxTexture(0)) : null;
    // Niveau Fun : les « vannes » sont des enceintes accrochees au mur, branchees
    // a une prise pres du sol. Maintenir E tire la fiche.
    const speakers = def.id === "niveau-fun";
    const speakerCabGeo = speakers ? own(new THREE.BoxGeometry(0.5, 0.72, 0.34)) : null;
    const speakerConeGeo = speakers ? own(new THREE.CylinderGeometry(1, 0.55, 0.05, 18)) : null;
    const speakerCabMat = speakers ? own(new THREE.MeshLambertMaterial({ color: 0x1b1a20 })) : null;
    const speakerConeMat = speakers ? own(new THREE.MeshLambertMaterial({ color: 0x0b0b0d })) : null;
    const speakerRimMat = speakers ? own(new THREE.MeshLambertMaterial({ color: 0xff5fa2 })) : null;
    const plugMat = speakers ? own(new THREE.MeshLambertMaterial({ color: 0xe8e4da })) : null;
    const valves = data.valves.map((v) => {
      const t = faceTransform(v, CS, 0);
      const group = new THREE.Group();
      group.position.set(t.x, floorY(v.y + 0.5) + 1.25, t.z);
      group.rotation.y = t.yaw;
      scene.add(group);
      if (speakers && speakerCabGeo && speakerConeGeo && speakerCabMat && speakerConeMat && speakerRimMat && plugMat) {
        const cabinet = new THREE.Mesh(speakerCabGeo, speakerCabMat);
        cabinet.position.set(0, 0.1, 0.18);
        group.add(cabinet);
        // Boomer (il bat la mesure tant que l'enceinte est branchee) et tweeter.
        const woofer = new THREE.Group();
        woofer.position.set(0, -0.02, 0.355);
        woofer.rotation.x = Math.PI / 2;
        group.add(woofer);
        const rim = new THREE.Mesh(speakerConeGeo, speakerRimMat);
        rim.scale.set(0.17, 0.4, 0.17);
        woofer.add(rim);
        const cone = new THREE.Mesh(speakerConeGeo, speakerConeMat);
        cone.scale.set(0.145, 1, 0.145);
        cone.position.y = 0.012;
        woofer.add(cone);
        const tweeter = new THREE.Mesh(speakerConeGeo, speakerConeMat);
        tweeter.scale.set(0.05, 1, 0.05);
        tweeter.rotation.x = Math.PI / 2;
        tweeter.position.set(0, 0.3, 0.355);
        group.add(tweeter);
        // Le cable descend le long du mur jusqu'a la prise, a 30 cm du sol.
        const socketY = 0.3 - 1.25;
        const cableLen = Math.max(0.2, -0.26 - socketY);
        const cable = new THREE.Mesh(own(new THREE.BoxGeometry(0.02, cableLen, 0.02)), speakerConeMat);
        cable.position.set(0.16, -0.26 - cableLen / 2, 0.03);
        group.add(cable);
        const socket = new THREE.Mesh(own(new THREE.BoxGeometry(0.09, 0.09, 0.02)), plugMat);
        socket.position.set(0.16, socketY, 0.012);
        group.add(socket);
        const plug = new THREE.Mesh(own(new THREE.BoxGeometry(0.05, 0.06, 0.07)), plugMat);
        group.add(plug);
        const lampMat = own(new THREE.MeshBasicMaterial({ color: 0xc0231a }));
        const lamp = new THREE.Mesh(own(new THREE.SphereGeometry(0.025, 8, 6)), lampMat);
        lamp.position.set(0.19, 0.4, 0.355);
        group.add(lamp);
        const setTurn = (p: number) => {
          // La fiche sort de la prise, puis retombe au bout de son cable.
          plug.position.set(0.16, socketY - Math.max(0, p - 0.7) * 0.5, 0.05 + Math.min(p, 0.7) * 0.25);
          plug.rotation.x = Math.max(0, p - 0.6) * 1.4;
        };
        setTurn(0);
        let unplugged = false;
        const pulse = (time: number) => {
          if (unplugged) return;
          const beat = Math.max(0, Math.sin(time * Math.PI * 2 * (124 / 60)));
          woofer.position.z = 0.355 + beat ** 6 * 0.025;
        };
        const cut = () => {
          unplugged = true;
          woofer.position.z = 0.355;
        };
        return { setTurn, lampMat, progress: 0, done: false, face: t, pulse, cut };
      }
      if (breakerTex) {
        // Disjoncteur : caisson, gaine jusqu'au plafond, et le gros levier a relever.
        const cabinet = new THREE.Mesh(own(new THREE.BoxGeometry(0.46, 0.7, 0.2)), own(new THREE.MeshLambertMaterial({ map: breakerTex })));
        cabinet.position.z = 0.1;
        group.add(cabinet);
        const conduitLen = Math.max(0.2, WH - 1.25 - 0.35);
        const conduit = new THREE.Mesh(own(new THREE.CylinderGeometry(0.04, 0.04, conduitLen, 8)), pipeStubMat);
        conduit.position.set(-0.12, 0.35 + conduitLen / 2, 0.06);
        group.add(conduit);
        const pivot = new THREE.Group();
        pivot.position.set(0, -0.05, 0.22);
        group.add(pivot);
        const handle = new THREE.Mesh(own(new THREE.BoxGeometry(0.05, 0.32, 0.05)), pipeStubMat);
        handle.position.y = 0.16;
        const grip = new THREE.Mesh(own(new THREE.BoxGeometry(0.12, 0.08, 0.09)), wheelMat);
        grip.position.y = 0.34;
        pivot.add(handle, grip);
        const lampMat = own(new THREE.MeshBasicMaterial({ color: 0xc0231a }));
        const lamp = new THREE.Mesh(own(new THREE.SphereGeometry(0.04, 8, 6)), lampMat);
        lamp.position.set(0.17, 0.28, 0.21);
        group.add(lamp);
        // Levier en bas (pointe vers le sol), il remonte en passant devant soi.
        const setTurn = (p: number) => {
          pivot.rotation.x = Math.PI * (1 - p);
        };
        setTurn(0);
        return { setTurn, lampMat, progress: 0, done: false, face: t, pulse: null, cut: null };
      }
      const stub = new THREE.Mesh(own(new THREE.CylinderGeometry(0.09, 0.09, 0.35, 10)), pipeStubMat);
      stub.rotation.x = Math.PI / 2;
      stub.position.z = 0.17;
      group.add(stub);
      const vertical = new THREE.Mesh(own(new THREE.CylinderGeometry(0.1, 0.1, WH, 10)), pipeStubMat);
      vertical.position.set(0, WH / 2 - 1.25, 0.08);
      group.add(vertical);
      const wheel = new THREE.Group();
      wheel.position.z = 0.36;
      group.add(wheel);
      wheel.add(new THREE.Mesh(own(new THREE.TorusGeometry(0.26, 0.035, 8, 20)), wheelMat));
      for (let k = 0; k < 3; k++) {
        const spoke = new THREE.Mesh(own(new THREE.BoxGeometry(0.5, 0.03, 0.03)), wheelMat);
        spoke.rotation.z = (k * Math.PI) / 3;
        wheel.add(spoke);
      }
      const lampMat = own(new THREE.MeshBasicMaterial({ color: 0xc0231a }));
      const lamp = new THREE.Mesh(own(new THREE.SphereGeometry(0.05, 8, 6)), lampMat);
      lamp.position.set(0.38, 0.32, 0.08);
      group.add(lamp);
      const setTurn = (p: number) => {
        wheel.rotation.z = -p * Math.PI * 3;
      };
      return { setTurn, lampMat, progress: 0, done: false, face: t, pulse: null, cut: null };
    });

    // --- Entites ---
    const bacteria = def.entity === "bacterie" ? buildBacteria() : null;
    const smiler = def.entity === "souriant" ? buildSmiler() : null;
    // Nouveaux niveaux : Voleur de peau, Chiens, Fetards. Meme cerveau que la
    // Bacterie, plus leurs regles propres (MONSTER_TRAITS) : le Voleur se fige
    // quand on le regarde, les Chiens sont aveugles et entendent de loin, les
    // Fetards font coucou avant de courir.
    const monster: Monster | null = def.entity === "voleur" || def.entity === "chiens" || def.entity === "fetards" ? buildMonster(def.entity) : null;
    const traits = monster ? MONSTER_TRAITS[monster.kind] : null;
    if (monster) scene.add(monster.group);
    // Vitesses : celles du niveau, sinon celles conseillees pour le monstre.
    const wanderSpeed = def.entityWander || traits?.wander || 0;
    const investigateSpeed = def.entityInvestigate || traits?.investigate || 0;
    const chaseSpeed = def.entityChase || traits?.chase || 0;
    /** Les Chiens entendent plus loin : les bruits du joueur portent d'autant. */
    const hearingScale = traits?.hearing ?? 1;
    // Niveau Fun : des Fetards immobiles qui dansent (decor, pas l'entite). On
    // n'anime que ceux qui sont a portee du brouillard.
    const figures = data.figures.map((f) => {
      const body = buildMonster("fetards");
      body.group.position.set(f.x * CS, floorY(f.y), f.y * CS);
      body.group.rotation.y = f.yaw;
      scene.add(body.group);
      return { body, x: f.x, z: f.y };
    });
    const figurePose: MonsterPose = { time: 0, delta: 0, speed: 0, state: "danse", lunge: 0, scream: 0, headYaw: 0, watched: false };
    const monsterPose: MonsterPose = { time: 0, delta: 0, speed: 0, state: "errer", lunge: 0, scream: 0, headYaw: 0, watched: false };
    const wanderer = buildWanderer();
    wanderer.setOpacity(0);
    scene.add(wanderer.group);
    if (bacteria) scene.add(bacteria.group);
    if (smiler) scene.add(smiler.group);
    // Corps de la Bacterie en vrai modele anime (Mesh2Motion CC0, etire dans
    // Blender). Il se charge en fond : le corps dessine en code reste affiche
    // en attendant, ou si le fichier ne charge pas.
    let bacteriaModel: AnimatedModel | null = null;
    let bacteriaClip = "";
    let lastScreamPulse = -1;
    if (bacteria) {
      createAnimatedModel("bacterie", 2.35)
        .then((m) => {
          if (disposed) {
            m.dispose();
            return;
          }
          m.tint(() => true, 0x1d191b);
          // Le modele n'a pas de tete (retiree dans Blender) : on y pose la
          // tete dessinee en code (crane, dents, machoire qui claque), qui suit
          // l'os de la tete dans toutes les animations.
          const pivot = new THREE.Group();
          if (m.attach("head", pivot)) {
            bacteria.head.position.set(0, -0.02, 0.02);
            pivot.add(bacteria.head);
          }
          bacteria.body.visible = false;
          bacteria.group.add(m.root);
          m.play("Rode", { randomStart: true });
          bacteriaModel = m;
        })
        .catch(() => {
          /* Le corps en code reste affiche. */
        });
    }
    /** Choisit l'animation du corps selon ce que fait la Bacterie. */
    function animateBacteriaModel(delta: number, speed: number, lunge: number, scream: number, brainState: string) {
      const m = bacteriaModel;
      if (!m) return;
      const clip = lunge > 0.45 ? "Attaque" : speed > 2.2 ? "Course" : speed > 0.12 ? "Rode" : brainState === "enqueter" || brainState === "fouiller" ? "Ecoute" : "Tapie";
      const rate = clip === "Course" ? THREE.MathUtils.clamp(speed / 4.2, 0.75, 1.6) : clip === "Rode" ? THREE.MathUtils.clamp(speed / 1.1, 0.6, 1.8) : 1;
      m.play(clip, { fade: clip === "Attaque" ? 0.12 : 0.3, speed: rate, syncPhase: (clip === "Rode" || clip === "Course") && (bacteriaClip === "Rode" || bacteriaClip === "Course") });
      bacteriaClip = clip;
      // Le cri : une seule fois par hurlement, par-dessus la marche (haut du corps).
      if (scream > 0.6 && elapsed - lastScreamPulse > 1.2) {
        lastScreamPulse = elapsed;
        m.pulse("Cri", 0.85);
      }
      m.update(delta);
    }
    const entity = {
      x: (data.entityStart?.x ?? 0) + 0.5,
      z: (data.entityStart?.y ?? 0) + 0.5,
      yaw: 0,
      walk: 0,
      active: def.entity === "bacterie" || monster !== null,
      path: null as number[] | null,
      pathIndex: 0,
      goalKey: -1,
      repath: 0,
      lunge: 0,
      opacity: def.entity === "souriant" ? 0 : 1,
    };
    const brain = createBrain(0);
    const mapQuery: MapQuery = {
      randomOpenCell: (r) => reachable[Math.floor(r() * reachable.length)],
      randomOpenCellNear: (x, z, radius, r) => {
        const near = reachable.filter(([cx, cy]) => Math.hypot(cx + 0.5 - x, cy + 0.5 - z) <= radius);
        return near.length ? near[Math.floor(r() * near.length)] : null;
      },
    };
    if (bacteria) {
      bacteria.group.position.set(entity.x * CS, floorY(entity.z), entity.z * CS);
      // Niveau ! : elle part du point de depart, mais n'apparait qu'au signal.
      if (def.id === "niveau-run") bacteria.group.visible = false;
    }
    if (monster) monster.group.position.set(entity.x * CS, floorY(entity.z), entity.z * CS);

    // --- Main et lampe ---
    scene.add(camera);
    const handRig = buildHandRig();
    handRig.group.position.set(0.19, -0.2, -0.36);
    camera.add(handRig.group);

    // --- Audio ---
    const audio = createBackroomsAudio(def.lighting, AUDIO_FLAVOR[def.id] ?? null);
    // La Fete : une musique en boucle, qui vient des enceintes encore branchees.
    let partyMusic: PartyMusic | null = def.lighting === "fete" ? playPartyMusic(audio.ctx, audio.master, { gain: 0.25 }) : null;
    let partyMusicTimer = 0;
    function stopPartyMusic() {
      partyMusic?.stop();
      partyMusic = null;
    }

    // --- Etat du joueur ---
    const player = { x: data.start.x + 0.5, z: data.start.y + 0.5, yaw: data.startYaw, pitch: 0 };
    let elapsed = 0;
    let sanityLevel = 100;
    let batteryLevel = 100;
    // Dans les tunnels et dans le noir complet on part lampe allumee ; a la
    // centrale, mieux vaut attendre.
    let lamp = (def.lighting === "secours" && !def.blackouts) || def.lighting === "noir";
    let staminaLevel = 100;
    let exhausted = false;
    let crouching = false;
    let crouchLevel = 0;
    let waterSink = 0;
    let waterCount = 0;
    let waterDrunk = 0;
    let fuses = 0;
    let valvesDone = 0;
    let walkPhase = 0;
    let bob = 0;
    let nextStepAt = 0;
    // Course : pied d'appel, souffle, et la vanne qu'on vient d'agripper.
    let wasSprinting = false;
    let strideSide = 1;
    let nextRunBreathAt = 0;
    let runBreathExhale = false;
    let gripping = false;
    let dyingSince = -1;
    let deathCause: DeathCause = "lucidite";
    let noclipSince = -1;
    let ended = false;
    let noises: Noise[] = [];
    let thinkTimer = 0;
    let mode: SpeedMode = "lent";
    let state: BrainState = "errer";
    let canSee = false;
    let losTimer = 0;
    let los = false;
    let nextClickAt = 3;
    let nextEntityStepAt = 0;
    let nextHeartAt = 0;
    let nextWhisperAt = 20 + rng() * 20;
    let nextWandererAt = 25 + rng() * 20;
    let wandererSince = -1;
    let wandererX = 0;
    let wandererZ = 0;
    let nextFlickerSoundAt = 0;
    let tinnitusPlayed = false;
    let hintHideAt = -1;
    let runReleased = def.id !== "niveau-run";
    let firstMoveAt = -1;
    // Coupures du niveau 1.
    let power = 1;
    let powerTarget = 1;
    let blackoutWarnAt = def.blackouts ? 38 + rng() * 20 : Infinity;
    let blackoutStartAt = Infinity;
    /** Invite en groupe : fin du clignotement d'avertissement annonce par l'hote (-1 : aucun). */
    let guestWarnEnd = -1;
    let blackoutEndAt = Infinity;
    let devFlyHeight = 0;
    let devSnapTimer = 0;
    let lampClickAt = -1;
    let handReachAt = -1;
    let lastYaw = NaN;
    let lastPitch = NaN;
    let screamUntil = -1;
    let netEntitySpeed = 0;
    let hostEntitySpeed = 0;
    // Nouveaux monstres : Voleur fige sous un regard, coucou des Fetards, cris.
    let monsterFrozen = false;
    let greetUntil = -1;
    let monsterDisplay: MonsterDisplay = "errer";
    /** Cris du monstre depuis le debut du niveau : les invites en rejouent un a chaque changement. */
    let monsterCalls = 0;
    let lastNetCalls = -1;
    let nextMonsterCallAt = 0;
    let nextMonsterMurmurAt = 14 + rng() * 10;
    /** Cosinus du demi-champ horizontal de la camera : au-dela, le Voleur est hors de l'ecran. */
    let watchCos = 0.6;
    // Salles marquantes sombres (neons morts, chaise seule) : l'ambiance baisse quand on y entre.
    let zoneDark = 0;
    let ambientShown = 1;
    let nextVoiceNoiseAt = 0;
    let micShown = 0;
    let spectating = false;
    let lastTeamKey = "";

    // --- Groupe ---
    const link = party?.current ?? null;
    const isHost = !link || link.isHost;
    const selfKey = link?.selfId ?? "moi";
    let netTimer = 0;
    let noiseBudget = 4;
    type Avatar = {
      survivor: Survivor;
      x: number;
      z: number;
      yaw: number;
      pitch: number;
      walk: number;
      speed: number;
      crouch: number;
      lamp: boolean;
      dead: boolean;
      caught: boolean;
      fresh: boolean;
      los: boolean;
      entityLos: boolean;
      losTimer: number;
    };
    const avatars = new Map<string, Avatar>();
    if (!isHost) {
      // Seul l'hote programme les coupures : les autres les recoivent.
      blackoutWarnAt = Infinity;
    }

    function showHint(text: string, seconds = 3.5) {
      setHint(text);
      hintHideAt = elapsed + seconds;
    }
    function spatial(x: number, z: number, reach: number, loud = 1) {
      const dx = x - player.x;
      const dz = z - player.z;
      const d = Math.hypot(dx, dz) * CS;
      const len = Math.hypot(dx, dz) || 1;
      const pan = THREE.MathUtils.clamp((dx / len) * Math.cos(player.yaw) - (dz / len) * Math.sin(player.yaw), -1, 1);
      return { pan, gain: Math.max(0, 1 - d / reach) * loud };
    }
    /** Le monstre t'a repere (ou, pour les Chiens, entendu) : son cri, compte pour les invites. */
    function monsterCall() {
      if (!monster) return;
      monsterCalls++;
      nextMonsterCallAt = elapsed + 4;
      playMonsterCall(audio.ctx, audio.master, monster.kind, spatial(entity.x, entity.z, 45, 1.2));
    }
    function updateWatchCos() {
      // Demi-champ horizontal, plus une marge pour la largeur du corps.
      const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
      watchCos = Math.cos(Math.min(1.45, half + 0.08));
    }
    updateWatchCos();
    function emitNoise(kind: NoiseKind, x = player.x, z = player.z, scale = 1) {
      if (spectating) return;
      const radius = NOISE_RADIUS[kind] * scale * (MANOR_CELL / CS) * hearingScale;
      noises.push({ kind, x, z, radius, at: elapsed });
      noises = pruneNoises(noises, elapsed);
      // En groupe, c'est l'hote qui fait penser la creature : il doit entendre nos bruits.
      if (link && !link.isHost && radius >= 1.5 && noiseBudget >= 1) {
        noiseBudget -= 1;
        link.sendEvent({ type: "noise", x, z, radius });
      }
    }
    function hasLOS(ax: number, az: number, bx: number, bz: number) {
      const steps = Math.ceil(Math.hypot(bx - ax, bz - az) * 3);
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        if (blocksSight(Math.floor(ax + (bx - ax) * t), Math.floor(az + (bz - az) * t))) return false;
      }
      return true;
    }
    function blocked(px: number, pz: number, r: number) {
      const minX = Math.floor(px - r);
      const maxX = Math.floor(px + r);
      const minZ = Math.floor(pz - r);
      const maxZ = Math.floor(pz + r);
      for (let cx = minX; cx <= maxX; cx++) {
        for (let cz = minZ; cz <= maxZ; cz++) {
          if (!isSolid(cx, cz)) continue;
          const nx = Math.max(cx, Math.min(px, cx + 1));
          const nz = Math.max(cz, Math.min(pz, cz + 1));
          if ((px - nx) ** 2 + (pz - nz) ** 2 < r * r) return true;
        }
      }
      return false;
    }

    function computeObjective(): HudObjective {
      if (def.objective === "sortie") {
        return def.id === "niveau-37"
          ? { title: "Trouve une sortie", detail: "L'eau ralentit. Les flèches aident, pas toutes." }
          : def.id === "niveau-6"
            ? { title: "Trouve la sortie de secours", detail: "Les flèches aident, à la lampe. Pas un bruit." }
            : { title: "Trouve une sortie", detail: "Les flèches taguées aident. Pas toutes." };
      }
      if (def.objective === "fusibles" || def.objective === "vannes") {
        const got = def.objective === "fusibles" ? fuses : valvesDone;
        return got < def.goalCount
          ? { title: words.todo(got, def.goalCount), detail: words.todoDetail }
          : { title: words.done, detail: words.doneDetail };
      }
      return { title: "COURS", detail: "La porte, au bout du couloir." };
    }
    let lastObjective = "";

    function toggleLamp() {
      if (dyingSince >= 0 || noclipSince >= 0 || spectating) return;
      if (!lamp && batteryLevel < 5) {
        playClick(audio.ctx, audio.master, false);
        showHint("Plus de pile. Il en traîne quelque part.", 2.5);
        return;
      }
      lamp = !lamp;
      setLampOn(lamp);
      lampClickAt = elapsed;
      playClick(audio.ctx, audio.master, lamp);
      emitNoise("lampe");
    }
    function toggleCrouch() {
      if (dyingSince >= 0) return;
      crouching = !crouching;
      setCrouched(crouching);
    }
    function drink() {
      if (dyingSince >= 0 || noclipSince >= 0 || spectating) return;
      if (waterCount <= 0) {
        showHint("Tu n'as pas d'eau d'amande.", 2);
        return;
      }
      if (sanityLevel >= 98) {
        showHint("Tu as encore les idées claires.", 2);
        return;
      }
      waterCount--;
      waterDrunk++;
      setWater(waterCount);
      sanityLevel = Math.min(100, sanityLevel + WATER_SANITY);
      playDrink(audio.ctx, audio.master);
      emitNoise("ramassage");
      showHint("L'eau d'amande calme le bourdonnement dans ta tête.", 2.6);
    }

    function nearestPickup() {
      let best: (typeof pickups)[number] | null = null;
      let bestD = PICK_REACH;
      for (const p of pickups) {
        if (p.taken) continue;
        const d = Math.hypot(p.x - player.x, p.z - player.z) * CS;
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      return best;
    }
    function nearValve() {
      for (const v of valves) {
        if (v.done) continue;
        const d = Math.hypot(v.face.x / CS - player.x, v.face.z / CS - player.z) * CS;
        if (d < VALVE_REACH) return v;
      }
      return null;
    }
    function distToExit() {
      return Math.hypot(exitT.x / CS - player.x, exitT.z / CS - player.z) * CS;
    }
    function exitUnlocked() {
      if (def.objective === "fusibles") return fuses >= def.goalCount;
      if (def.objective === "vannes") return valvesDone >= def.goalCount;
      return true;
    }
    // Minuteries ponctuelles (sons differes), annulees quand on quitte la scene.
    const pendingTimers = new Set<number>();
    function later(ms: number, fn: () => void) {
      const id = window.setTimeout(() => {
        pendingTimers.delete(id);
        fn();
      }, ms);
      pendingTimers.add(id);
    }
    function completeLevel(broadcast = true) {
      if (noclipSince >= 0 || dyingSince >= 0 || ended) return;
      if (broadcast) link?.sendEvent({ type: "complete" });
      noclipSince = elapsed;
      setNoclip(true);
      stopPartyMusic();
      if (def.id === "niveau-1") {
        playElevator(audio.ctx, audio.master);
      } else {
        playDoorOpen(audio.ctx, audio.master);
      }
      later(500, () => {
        if (!ended) playNoclip(audio.ctx, audio.master);
      });
    }

    function interact() {
      if (dyingSince >= 0 || noclipSince >= 0 || spectating) return;
      const p = nearestPickup();
      if (p) {
        p.taken = true;
        scene.remove(p.group);
        handReachAt = elapsed;
        playGrab(audio.ctx, audio.master);
        link?.sendEvent({ type: "pickup", index: pickups.indexOf(p) });
        emitNoise("ramassage");
        if (p.kind === "eau") {
          waterCount++;
          setWater(waterCount);
          playBottle(audio.ctx, audio.master);
          showHint("Eau d'amande. R pour boire quand ta tête lâche.", 3);
        } else if (p.kind === "pile") {
          batteryLevel = Math.min(100, batteryLevel + BATTERY_PICKUP);
          playClick(audio.ctx, audio.master, true);
          showHint("Pile : la lampe tiendra plus longtemps.", 2.4);
        } else {
          fuses++;
          playFuse(audio.ctx, audio.master, false);
          if (indicatorMats[fuses - 1]) indicatorMats[fuses - 1].color.setHex(0x2fd35a);
          showHint(words.gotOne(fuses, def.goalCount), 3);
        }
        return;
      }
      if (distToExit() < DOOR_REACH && def.objective !== "course") {
        handReachAt = elapsed;
        if (exitUnlocked()) {
          if (def.id === "niveau-1") playFuse(audio.ctx, audio.master, true);
          else if (def.id === "niveau-4") playClick(audio.ctx, audio.master, true);
          else playHandle(audio.ctx, audio.master, false);
          completeLevel();
        } else {
          playHandle(audio.ctx, audio.master, true);
          const missing = def.goalCount - (def.objective === "fusibles" ? fuses : valvesDone);
          showHint(words.locked(missing), 3);
        }
      }
    }

    function markValveDone(v: (typeof valves)[number], local: boolean) {
      if (v.done) return;
      v.done = true;
      v.progress = 1;
      v.setTurn(1);
      valvesDone++;
      v.lampMat.color.setHex(0x2fd35a);
      v.cut?.();
      if (indicatorMats[valvesDone - 1]) indicatorMats[valvesDone - 1].color.setHex(0x2fd35a);
      if (def.id === "niveau-3") playPowerOn(audio.ctx, audio.master);
      // Enceinte debranchee : le son s'effondre d'un coup.
      else if (speakers) playBlackout(audio.ctx, audio.master);
      else playValveDone(audio.ctx, audio.master);
      if (speakers && valvesDone >= def.goalCount && partyMusic) {
        // La derniere enceinte : la musique s'eteint en fondu, puis s'arrete.
        partyMusic.setLevel(0);
        later(1600, stopPartyMusic);
      }
      if (local) {
        emitNoise("haletement", player.x, player.z, 1.3);
        link?.sendEvent({ type: "valve", index: valves.indexOf(v) });
        showHint(words.gotOne(valvesDone, def.goalCount), 3);
      } else {
        showHint(words.friend(valvesDone, def.goalCount), 3);
      }
    }

    function startBlackout(spawn: boolean) {
      blackoutStartAt = Math.min(blackoutStartAt, elapsed);
      guestWarnEnd = -1;
      powerTarget = 0;
      setBlackout(true);
      playBlackout(audio.ctx, audio.master);
      if (spawn) {
        // Il apparait loin, hors de vue, dans le noir.
        const candidates = reachable.filter(([cx, cy]) => {
          const d = Math.hypot(cx + 0.5 - player.x, cy + 0.5 - player.z) * CS;
          return d > 14 && d < 26 && !hasLOS(player.x, player.z, cx + 0.5, cy + 0.5);
        });
        const spot = candidates[Math.floor(rng() * candidates.length)] ?? reachable[Math.floor(rng() * reachable.length)];
        entity.x = spot[0] + 0.5;
        entity.z = spot[1] + 0.5;
        entity.active = true;
        entity.path = null;
        brain.state = "errer";
        brain.goal = null;
      }
      later(900, () => {
        if (!ended) playSmilerGiggle(audio.ctx, audio.master, spatial(entity.x, entity.z, 40, 0.8));
      });
      showHint("Coupure. Éteins ta lampe : dans le noir, la lumière l'attire.", 4);
    }
    function endBlackout() {
      powerTarget = 1;
      blackoutStartAt = Infinity;
      blackoutEndAt = Infinity;
      if (isHost) entity.active = false;
      setBlackout(false);
      playPowerOn(audio.ctx, audio.master);
    }

    function releaseRun() {
      if (runReleased) return;
      runReleased = true;
      entity.x = data.start.x + 0.5;
      entity.z = data.start.y + 0.5;
      if (bacteria) bacteria.group.visible = true;
      playBacteriaScreech(audio.ctx, audio.master, spatial(entity.x, entity.z, 60, 1.2));
      screamUntil = elapsed + 1;
      showHint("ELLE ARRIVE.", 2.5);
      if (isHost) link?.sendEvent({ type: "run" });
    }

    function stats(): LevelStats {
      return { seconds: Math.round(elapsed), water: waterDrunk };
    }

    function handleNet(ev: NetEvent & { from: string }) {
      switch (ev.type) {
        case "pickup": {
          const p = pickups[ev.index];
          if (!p || p.taken) break;
          p.taken = true;
          scene.remove(p.group);
          if (p.kind === "fusible") {
            fuses++;
            if (indicatorMats[fuses - 1]) indicatorMats[fuses - 1].color.setHex(0x2fd35a);
            playFuse(audio.ctx, audio.master, false);
            showHint(words.friend(fuses, def.goalCount), 3);
          }
          break;
        }
        case "valve": {
          const v = valves[ev.index];
          if (v) markValveDone(v, false);
          break;
        }
        case "noise":
          if (isHost) {
            noises.push({ kind: "voix", x: ev.x, z: ev.z, radius: ev.radius, at: elapsed });
            noises = pruneNoises(noises, elapsed);
          }
          break;
        case "blackout-warn":
          if (!isHost && def.blackouts && blackoutStartAt === Infinity && guestWarnEnd < 0) {
            guestWarnEnd = elapsed + BLACKOUT_WARN_SECONDS;
            playFlicker(audio.ctx, audio.master);
          }
          break;
        case "blackout":
          if (!isHost) {
            if (ev.on) startBlackout(false);
            else endBlackout();
          }
          break;
        case "caught":
          if (ev.id === selfKey) killPlayer(ev.cause);
          else {
            const av = avatars.get(ev.id);
            if (av) av.caught = true;
          }
          break;
        case "complete":
          completeLevel(false);
          break;
        case "wipe":
          if (!ended) {
            ended = true;
            onDeathRef.current(ev.cause, stats());
          }
          break;
        case "run":
          releaseRun();
          break;
      }
    }

    function resume() {
      if (document.hidden || contextIsLost) return;
      menuPaused = false;
      settingsPaused = false;
      if (pausedRef.current) {
        pausedRef.current = false;
        setPaused(false);
      }
      lastTime = performance.now();
      audio.ctx.resume().catch(() => {});
    }

    // Pause "menu" en solo : souris liberee (Echap) ou reglages ouverts. Elle ne
    // se leve qu'au clic, pas au simple retour sur l'onglet. En groupe le monde
    // est partage : jamais de pause. Sur ecran tactile la souris n'est jamais
    // capturee, donc la pause par Echap ne s'y declenche pas.
    const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    let menuPaused = false;
    let settingsPaused = false;
    function pauseForMenu(): boolean {
      if (link || ended || pausedRef.current || contextIsLost) return false;
      if (dyingSince >= 0 || noclipSince >= 0 || devOpenRef.current) return false;
      menuPaused = true;
      pausedRef.current = true;
      setPaused(true);
      releaseEverything();
      audio.ctx.suspend().catch(() => {});
      return true;
    }
    function requestLock() {
      if (coarsePointer || document.pointerLockElement === renderer.domElement) return;
      try {
        renderer.domElement.requestPointerLock?.()?.catch(() => {});
      } catch {
        // ignore
      }
    }

    apiRef.current = {
      applyBrightness: (value: number) => {
        brightness = value;
      },
      interact,
      toggleLamp,
      drink,
      toggleCrouch,
      resume: () => {
        resume();
        requestLock();
      },
      setSettingsOpen: (open: boolean) => {
        if (open) {
          if (!coarsePointer && pauseForMenu()) settingsPaused = true;
        } else if (settingsPaused) {
          // Pause due aux seuls reglages (jeu a la souris sans capture) : on repart.
          resume();
        }
      },
      applyQuality: (q: Quality3D) => {
        quality = q;
        // Resolution : tout de suite. Lampes et anticrenelage : au niveau suivant.
        const next = q === "performance" ? Math.min(pixelRatio, pixelCap()) : pixelCap();
        if (next !== pixelRatio) {
          pixelRatio = next;
          renderer.setPixelRatio(pixelRatio);
        }
      },
      devTeleport: (x: number, z: number) => {
        if (!devLiveRef.current || !Number.isFinite(x) || !Number.isFinite(z)) return;
        let tx = Math.floor(x);
        let tz = Math.floor(z);
        const free = devRef.current.noclip || devRef.current.fly;
        if (!free && isSolid(tx, tz)) {
          let best: [number, number] | null = null;
          let bestD = Infinity;
          for (const [cx, cy] of reachable) {
            const d = (cx - tx) ** 2 + (cy - tz) ** 2;
            if (d < bestD) {
              bestD = d;
              best = [cx, cy];
            }
          }
          if (best) [tx, tz] = best;
        }
        player.x = THREE.MathUtils.clamp(tx + 0.5, 0.5, W - 0.5);
        player.z = THREE.MathUtils.clamp(tz + 0.5, 0.5, H - 0.5);
      },
      devAdvance: () => {
        if (!devLiveRef.current || noclipSince >= 0 || dyingSince >= 0) return;
        if (def.objective === "fusibles" && fuses < def.goalCount) {
          for (const pk of pickups) {
            if (pk.taken || pk.kind !== "fusible") continue;
            pk.taken = true;
            scene.remove(pk.group);
            fuses++;
            if (indicatorMats[fuses - 1]) indicatorMats[fuses - 1].color.setHex(0x2fd35a);
          }
          playFuse(audio.ctx, audio.master, false);
          showHint("[DEV] Fusibles en poche.", 2.5);
        } else if (def.objective === "vannes" && valvesDone < def.goalCount) {
          for (const v of valves) markValveDone(v, false);
          showHint("[DEV] Toutes les vannes fermées.", 2.5);
        } else {
          if (!runReleased) releaseRun();
          completeLevel(false);
        }
      },
    };

    // --- Entrees ---
    const keys = new Set<string>();
    function onKeyDown(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      if (e.key === " " || e.key === "Tab") e.preventDefault();
      if (e.repeat) return;
      keys.add(k);
      if (k === "e") interact();
      if (k === "f") toggleLamp();
      if (k === "r") drink();
      if (k === "c" && !devRef.current.fly) toggleCrouch();
      if (e.key === "F2" && devLiveRef.current) {
        e.preventDefault();
        setDevOpen((open) => !open);
      }
      if (k === "m" && voiceRef.current) {
        const next = !voiceRef.current.isMuted();
        voiceRef.current.setMuted(next);
        setMuted(next);
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      keys.delete(e.key.toLowerCase());
    }
    function applyLook(dx: number, dy: number) {
      const s = BASE_LOOK * sensitivityRef.current;
      player.yaw -= dx * s;
      player.pitch = THREE.MathUtils.clamp(player.pitch - dy * s, -1.2, 1.2);
    }
    function onCanvasClick() {
      if (pausedRef.current) resume();
      if (document.pointerLockElement === renderer.domElement) return;
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
    let dragging = false;
    let lastDragX = 0;
    let lastDragY = 0;
    function onPointerDown(e: PointerEvent) {
      if (audio.ctx.state === "suspended" && !pausedRef.current) audio.ctx.resume().catch(() => {});
      if (document.pointerLockElement === renderer.domElement) return;
      dragging = true;
      lastDragX = e.clientX;
      lastDragY = e.clientY;
    }
    function onPointerMove(e: PointerEvent) {
      if (!dragging || document.pointerLockElement === renderer.domElement) return;
      applyLook(e.clientX - lastDragX, e.clientY - lastDragY);
      lastDragX = e.clientX;
      lastDragY = e.clientY;
    }
    function onPointerUp() {
      dragging = false;
    }
    function releaseEverything() {
      keys.clear();
      const held = heldRef.current;
      held.forward = held.back = held.left = held.right = held.sprint = held.use = false;
      dragging = false;
    }
    function onVisibility() {
      if (link) {
        releaseEverything();
        return;
      }
      if (document.hidden) {
        pausedRef.current = true;
        setPaused(true);
        releaseEverything();
        audio.ctx.suspend().catch(() => {});
      } else if (!menuPaused) {
        resume();
      }
    }
    function onReturn() {
      if (pausedRef.current && !document.hidden && !menuPaused) resume();
    }
    let wasLocked = false;
    function onPointerLockChange() {
      const locked = document.pointerLockElement === renderer.domElement;
      if (wasLocked && !locked) pauseForMenu();
      wasLocked = locked;
    }
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
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.addEventListener("click", onCanvasClick);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);
    renderer.domElement.addEventListener("webglcontextrestored", onContextRestored);
    document.addEventListener("mousemove", onMouseMove);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", releaseEverything);
    window.addEventListener("focus", onReturn);
    window.addEventListener("pageshow", onReturn);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    const initialVisibility = window.setTimeout(() => {
      if (document.hidden) onVisibility();
    }, 0);

    // --- Boucle ---
    let lastTime = performance.now();
    let frameMsAvg = 16;
    let resolutionTimer = 0;
    let slowChecks = 0;
    let resolutionChangedAt = -Infinity;
    let uiTimer = 0;
    let poolTimer = 0;
    let lastSanity = -1;
    let lastBattery = -1;
    let lastStamina = -1;
    let lastSignal = -1;
    let lastDread = -1;
    let lastPrompt: string | null = null;
    let lastValve: number | null = null;
    let lastClock = -1;
    let introShown = true;
    let dreadLevel = 0;
    const lookDir = new THREE.Vector3();

    function fixtureFactor(f: Fixture): number {
      if (f.state === 1) return 0;
      let v = 1;
      if (f.state === 2) {
        // Rafales de clignotement, puis quelques secondes de repit.
        const burst = Math.sin(elapsed * 0.7 + f.phase) > 0.55;
        if (burst) v = Math.sin(elapsed * 38 + f.phase * 3) + Math.sin(elapsed * 23 + f.phase) > 0.2 ? 1 : 0.08;
      }
      return v * power;
    }

    function killPlayer(cause: DeathCause) {
      if (dyingSince >= 0 || noclipSince >= 0 || spectating || ended) return;
      if (devRef.current.god) return;
      dyingSince = elapsed;
      deathCause = cause;
      setDying(true);
      playDeath(audio.ctx, audio.master);
      stopPartyMusic();
      // Le cri du monstre, a bout portant.
      if (monster && cause === monster.kind) playMonsterCall(audio.ctx, audio.master, monster.kind, { gain: 1.3 });
      try {
        document.exitPointerLock?.();
      } catch {
        // ignore
      }
    }

    function step() {
      const now = performance.now();
      const raw = now - lastTime;
      const delta = Math.min(raw / 1000, 0.1);
      lastTime = now;
      if (contextIsLost || !ready) return;
      if (ended || pausedRef.current) {
        renderer.render(scene, camera);
        return;
      }
      elapsed += delta;
      noiseBudget = Math.min(4, noiseBudget + delta * 4);
      if (link && link.inbox.length > 0) {
        for (const ev of link.inbox.splice(0)) handleNet(ev);
        if (ended) {
          renderer.render(scene, camera);
          return;
        }
      }

      // Resolution adaptative. Changer la taille du canvas fige l'image (plus
      // d'une seconde sur une puce Intel sous Windows) : l'ancienne version
      // montait et descendait toutes les quelques secondes, et chaque palier
      // gelait le jeu. On regle librement pendant le carton titre.
      // Ensuite on ne baisse qu'en cas de vraie peine, au plus une fois toutes
      // les 45 s, et on ne remonte plus.
      if (raw < 250) frameMsAvg += (raw - frameMsAvg) * 0.08;
      resolutionTimer += delta;
      const calibrating = elapsed < INTRO_SECONDS;
      if (resolutionTimer >= (calibrating ? 1 : 1.5)) {
        resolutionTimer = 0;
        slowChecks = frameMsAvg > (calibrating ? 21 : 24) ? slowChecks + 1 : 0;
        const lower = calibrating ? slowChecks >= 1 : slowChecks >= 3 && elapsed - resolutionChangedAt > 45;
        if (lower && pixelRatio > PIXEL_RATIO_FLOOR) {
          pixelRatio = Math.max(PIXEL_RATIO_FLOOR, Math.round((pixelRatio - (calibrating ? 0.2 : 0.15)) * 100) / 100);
          renderer.setPixelRatio(pixelRatio);
          resolutionChangedAt = elapsed;
          slowChecks = 0;
          frameMsAvg = 16;
        }
      }

      if (introShown && elapsed > INTRO_SECONDS) {
        introShown = false;
        setIntro(false);
        const firstHint = INTRO_HINT[def.id];
        if (firstHint) showHint(firstHint, 5.5);
      }

      // --- Mort : l'entite fonce sur la camera ---
      if (dyingSince >= 0) {
        const t = (elapsed - dyingSince) / DEATH_SECONDS;
        const rush = Math.min(1, t * 2.2);
        const fx = -Math.sin(player.yaw);
        const fz = -Math.cos(player.yaw);
        const dist = THREE.MathUtils.lerp(1.6, 0.25, rush);
        const shake = 0.06 * (1 - t * 0.4);
        camera.rotation.y = player.yaw + (Math.random() - 0.5) * shake * 3;
        camera.rotation.x = player.pitch * (1 - rush) + rush * 0.25 + (Math.random() - 0.5) * shake * 3;
        camera.rotation.z = (Math.random() - 0.5) * shake * 2;
        if (deathCause === "bacterie" && bacteria) {
          bacteria.group.position.set(camera.position.x + fx * dist, floorY(player.z) - 0.2 * rush, camera.position.z + fz * dist);
          bacteria.group.rotation.y = player.yaw;
          poseBacteria(bacteria, { time: elapsed, walk: entity.walk + elapsed * 8, speed: 5, headYaw: 0, lunge: 1 });
          animateBacteriaModel(delta, 5, 1, 1, "poursuivre");
        } else if (monster && deathCause === monster.kind) {
          // Le Chien bondit a hauteur de visage ; les autres sont assez grands.
          const leap = monster.kind === "chiens" ? 0.75 * rush : 0;
          monster.group.position.set(camera.position.x + fx * dist, floorY(player.z) + leap, camera.position.z + fz * dist);
          monster.group.rotation.y = player.yaw;
          monsterPose.time = elapsed;
          monsterPose.delta = delta;
          monsterPose.speed = 5;
          monsterPose.state = "poursuivre";
          monsterPose.lunge = 1;
          monsterPose.scream = 1;
          monsterPose.headYaw = 0;
          monsterPose.watched = false;
          monster.animate(monsterPose);
        } else if (deathCause === "souriant" && smiler) {
          smiler.group.position.set(camera.position.x + fx * dist, camera.position.y - 1.45, camera.position.z + fz * dist);
          smiler.group.rotation.y = player.yaw;
          poseSmiler(smiler, elapsed, 1, 1);
        }
        if (t >= 1 && !ended) {
          if (link) {
            // En groupe on ne quitte pas la partie : on erre en fantome, on
            // parle encore, et si les autres sortent on revient avec eux.
            dyingSince = -1;
            spectating = true;
            setSpectating(true);
            setDying(false);
            lamp = false;
            setLampOn(false);
            handRig.group.visible = false;
            showHint("Tu es mort. Tes amis t'entendent encore. S'ils trouvent la sortie, tu reviens avec eux.", 6);
          } else {
            ended = true;
            onDeathRef.current(deathCause, stats());
          }
        }
        renderer.render(scene, camera);
        return;
      }

      // --- No-clip : la porte s'ouvre, l'image se tord, niveau suivant ---
      if (noclipSince >= 0) {
        const t = (elapsed - noclipSince) / NOCLIP_SECONDS;
        if (def.id === "niveau-1") {
          doorLeaf.scale.x = Math.max(0.02, 1 - t * 1.4);
        } else {
          doorHinge.rotation.y = -Math.min(1, t * 1.6) * 1.4;
        }
        camera.fov = 72 + Math.pow(Math.min(1, t), 2) * 55;
        camera.updateProjectionMatrix();
        camera.rotation.z = Math.sin(elapsed * 9) * 0.05 * t;
        if (t >= 1 && !ended) {
          ended = true;
          onCompleteRef.current(stats());
        }
        renderer.render(scene, camera);
        return;
      }

      // --- Deplacement ---
      const forwardKey = layoutRef.current === "azerty" ? "z" : "w";
      const leftKey = layoutRef.current === "azerty" ? "q" : "a";
      const held = heldRef.current;
      let fwd = 0;
      let strafe = 0;
      if (keys.has(forwardKey) || keys.has("arrowup") || held.forward) fwd += 1;
      if (keys.has("s") || keys.has("arrowdown") || held.back) fwd -= 1;
      if (keys.has(leftKey) || keys.has("arrowleft") || held.left) strafe -= 1;
      if (keys.has("d") || keys.has("arrowright") || held.right) strafe += 1;
      const moving = fwd !== 0 || strafe !== 0;
      if (moving && firstMoveAt < 0) firstMoveAt = elapsed;

      const wantsSprint = keys.has("shift") || held.sprint;
      // Courir en etant accroupi : on se releve d'abord, comme dans les autres jeux.
      if (wantsSprint && moving && crouching && !devRef.current.fly && dyingSince < 0) {
        crouching = false;
        setCrouched(false);
      }
      const sprinting = wantsSprint && moving && !crouching && !exhausted;
      if (sprinting) {
        if (!devRef.current.infinite) staminaLevel = Math.max(0, staminaLevel - def.staminaDrain * delta);
        if (staminaLevel <= 0) {
          exhausted = true;
          playGasp(audio.ctx, audio.master);
          emitNoise("haletement");
        }
      } else {
        staminaLevel = Math.min(100, staminaLevel + def.staminaRegen * (moving ? 1 : 1.5) * delta);
        if (exhausted && staminaLevel > 35) exhausted = false;
      }
      crouchLevel += ((crouching ? 1 : 0) - crouchLevel) * Math.min(1, delta * 9);

      const dev = devRef.current;
      if (dev.fly) {
        const up = (keys.has(" ") ? 1 : 0) - (keys.has("c") ? 1 : 0);
        devFlyHeight = THREE.MathUtils.clamp(devFlyHeight + up * (dev.fast ? 18 : 7) * delta, -1, 60);
      } else if (devFlyHeight !== 0) {
        devFlyHeight = 0;
      }
      const waterCell = Math.floor(player.z) * W + Math.floor(player.x);
      const wading = hasWater && !dev.fly && data.water[waterCell] === 1;
      // Bassin profond : on s'y enfonce plus, et on y avance plus lentement.
      const deepWading = wading && isDeepWater(waterCell);
      waterSink += ((wading ? (deepWading ? 2.2 : 1) : 0) - waterSink) * Math.min(1, delta * 5);
      if (moving) {
        const wade = wading ? WADE_SPEED * (deepWading ? 0.75 : 1) : 1;
        const speed = ((crouching ? def.crouch : sprinting ? def.sprint : def.walk) / CS) * (dev.fast ? 3 : 1) * wade;
        const sin = Math.sin(player.yaw);
        const cos = Math.cos(player.yaw);
        let mx = -sin * fwd + cos * strafe;
        let mz = -cos * fwd - sin * strafe;
        const len = Math.hypot(mx, mz) || 1;
        mx = (mx / len) * speed * delta;
        mz = (mz / len) * speed * delta;
        if (dev.noclip || dev.fly) {
          player.x = THREE.MathUtils.clamp(player.x + mx, 0.3, W - 0.3);
          player.z = THREE.MathUtils.clamp(player.z + mz, 0.3, H - 0.3);
        } else {
          if (!blocked(player.x + mx, player.z, radiusCells)) player.x += mx;
          if (!blocked(player.x, player.z + mz, radiusCells)) player.z += mz;
        }
        walkPhase += delta * (sprinting ? 12 : crouching ? 5.5 : 8.5);
        if (sprinting && !wasSprinting && !dev.fly) {
          playRunStart(audio.ctx, audio.master);
          nextStepAt = Math.min(nextStepAt, elapsed + 0.08);
        }
        if (elapsed >= nextStepAt && !dev.fly) {
          nextStepAt = elapsed + (sprinting ? 0.3 : crouching ? 0.62 : 0.45);
          playStep(audio.ctx, audio.master, wading ? "eau" : surface, sprinting ? 1 : crouching ? 0.3 : 0.65);
          if (sprinting) {
            strideSide = -strideSide;
            playRunStride(audio.ctx, audio.master, strideSide);
          }
          emitNoise(sprinting ? "course" : crouching ? "accroupi" : "pas");
        }
      }
      wasSprinting = sprinting && moving;
      // Souffle : il suit la course, puis se calme a mesure que l'endurance remonte.
      {
        const strain = 1 - staminaLevel / 100;
        const breathing = !spectating && dyingSince < 0 && (sprinting || strain > 0.3);
        if (breathing && elapsed >= nextRunBreathAt) {
          runBreathExhale = !runBreathExhale;
          playRunBreath(audio.ctx, audio.master, runBreathExhale, strain);
          const pace = sprinting ? 0.34 - strain * 0.08 : 0.55 + (1 - strain) * 0.4;
          nextRunBreathAt = elapsed + (runBreathExhale ? pace * 1.25 : pace);
        }
      }
      bob += ((moving ? 1 : 0) - bob) * Math.min(1, delta * 8);

      // Camera : balancement de marche + tremblement de camescope.
      const eye = THREE.MathUtils.lerp(EYE, CROUCH_EYE, crouchLevel) - waterSink * 0.12;
      camera.position.set(player.x * CS, floorY(player.z) + eye + devFlyHeight + (Math.abs(Math.sin(walkPhase)) * 0.05 - 0.02) * bob, player.z * CS);
      const handheldX = Math.sin(elapsed * 0.9) * 0.004 + Math.sin(elapsed * 2.3) * 0.002;
      const handheldY = Math.sin(elapsed * 0.7 + 1) * 0.004;
      camera.rotation.y = player.yaw + handheldY;
      camera.rotation.x = player.pitch + handheldX;
      camera.rotation.z = Math.sin(walkPhase) * 0.012 * bob;
      if (camera.fov !== 72) {
        camera.fov = 72;
        camera.updateProjectionMatrix();
      }
      {
        const yawSpeed = Number.isNaN(lastYaw) ? 0 : (player.yaw - lastYaw) / Math.max(delta, 0.001);
        const pitchSpeed = Number.isNaN(lastPitch) ? 0 : (player.pitch - lastPitch) / Math.max(delta, 0.001);
        lastYaw = player.yaw;
        lastPitch = player.pitch;
        handRig.update({
          time: elapsed,
          delta,
          walkPhase,
          bob,
          sprint: sprinting ? 1 : 0,
          crouch: crouchLevel,
          lampOn: lamp && batteryLevel > 0,
          yawSpeed,
          pitchSpeed,
          clickAt: lampClickAt,
          reachAt: handReachAt,
        });
      }

      // --- Les amis : positions lissees, animation, voix placee sur leur tete ---
      const hub = voiceRef.current;
      if (link) {
        const nowMs = performance.now();
        for (const [id, remote] of link.players) {
          if (id === selfKey) continue;
          const st = remote.state;
          const fresh = !!st && st.seed === seed && nowMs - remote.seenAt < 5000;
          let av = avatars.get(id);
          if (!av) {
            if (!fresh || !st) continue;
            av = {
              survivor: buildSurvivor(remote.color, remote.name),
              x: st.x,
              z: st.z,
              yaw: st.yaw,
              pitch: st.pitch,
              walk: 0,
              speed: 0,
              crouch: 0,
              lamp: st.lamp,
              dead: st.dead,
              caught: false,
              fresh: true,
              los: false,
              entityLos: false,
              losTimer: 0,
            };
            avatars.set(id, av);
            scene.add(av.survivor.group);
          }
          av.fresh = fresh;
          av.survivor.group.visible = fresh;
          if (!fresh || !st) continue;
          av.survivor.setName(remote.name);
          const k = Math.min(1, delta * 12);
          const px = av.x;
          const pz = av.z;
          if (Math.hypot(st.x - av.x, st.z - av.z) > 3) {
            av.x = st.x;
            av.z = st.z;
          } else {
            av.x += (st.x - av.x) * k;
            av.z += (st.z - av.z) * k;
          }
          let dyaw = st.yaw - av.yaw;
          while (dyaw > Math.PI) dyaw -= Math.PI * 2;
          while (dyaw < -Math.PI) dyaw += Math.PI * 2;
          av.yaw += dyaw * k;
          av.pitch += (st.pitch - av.pitch) * k;
          const moved = (Math.hypot(av.x - px, av.z - pz) * CS) / Math.max(delta, 0.001);
          av.speed += (Math.min(7, moved) - av.speed) * Math.min(1, delta * 8);
          av.walk += av.speed * delta * 2.6;
          av.crouch += ((st.crouch ? 1 : 0) - av.crouch) * Math.min(1, delta * 8);
          av.lamp = st.lamp;
          av.dead = st.dead || av.caught;
          av.survivor.group.position.set(av.x * CS, floorY(av.z), av.z * CS);
          // La camera regarde vers -Z a lacet nul, le personnage vers +Z.
          av.survivor.group.rotation.y = av.yaw + Math.PI;
          av.losTimer -= delta;
          if (av.losTimer <= 0) {
            av.losTimer = 0.2;
            av.los = hasLOS(player.x, player.z, av.x, av.z);
            av.entityLos = isHost && entity.active ? hasLOS(av.x, av.z, entity.x, entity.z) : false;
          }
          const speaking = hub ? hub.peerLevel(id) : 0;
          av.survivor.update({
            time: elapsed,
            walkPhase: av.walk,
            speed: av.speed,
            crouch: av.crouch,
            pitch: av.pitch,
            lampOn: av.lamp,
            dead: av.dead,
            speaking,
          });
          hub?.setPeerPosition(id, av.x * CS, floorY(av.z) + 1.55 - av.crouch * 0.4, av.z * CS, !av.los);
        }
        for (const [id, av] of avatars) {
          if (link.players.has(id)) continue;
          scene.remove(av.survivor.group);
          av.survivor.dispose();
          avatars.delete(id);
        }
      }

      // --- Lampe torche ---
      if (lamp) {
        if (!devRef.current.infinite) batteryLevel = Math.max(0, batteryLevel - BATTERY_DRAIN * delta);
        if (batteryLevel <= 0) {
          lamp = false;
          setLampOn(false);
          showHint("La lampe s'éteint. Plus de pile.", 2.5);
        }
      } else {
        batteryLevel = Math.min(100, batteryLevel + BATTERY_REGEN * delta * 0.25);
      }
      camera.getWorldDirection(lookDir);
      flashlight.position.copy(camera.position);
      flashTarget.position.copy(camera.position).add(lookDir);
      const lampFlicker = batteryLevel < 12 && Math.random() < 0.12 ? 0.2 : 1;
      flashlight.intensity = lamp ? 14 * lampFlicker * brightness : 0;
      hub?.setListener(camera.position.x, camera.position.y, camera.position.z, lookDir.x, lookDir.y, lookDir.z);

      // --- Coupures de courant (niveaux 1 et 3) ---
      if (def.blackouts) {
        if (elapsed >= blackoutWarnAt && blackoutStartAt === Infinity) {
          blackoutStartAt = elapsed + BLACKOUT_WARN_SECONDS;
          playFlicker(audio.ctx, audio.master);
          // Les invites clignotent aussi : sinon la coupure leur tombe dessus sans prevenir.
          link?.sendEvent({ type: "blackout-warn" });
        }
        if (elapsed < blackoutStartAt && blackoutStartAt !== Infinity) {
          // Avertissement : tout clignote.
          powerTarget = Math.sin(elapsed * 30) > 0 ? 1 : 0.15;
        }
        if (guestWarnEnd >= 0) {
          // Invite : meme clignotement, en attendant l'annonce de l'hote.
          if (elapsed < guestWarnEnd) {
            powerTarget = Math.sin(elapsed * 30) > 0 ? 1 : 0.15;
          } else {
            guestWarnEnd = -1;
            // Annonce en retard (ou perdue) : on rallume en attendant.
            if (blackoutStartAt === Infinity) powerTarget = 1;
          }
        }
        if (isHost && elapsed >= blackoutStartAt && blackoutEndAt === Infinity) {
          blackoutEndAt = elapsed + 15 + rng() * 8;
          startBlackout(true);
          link?.sendEvent({ type: "blackout", on: true });
        }
        if (isHost && elapsed >= blackoutEndAt) {
          blackoutWarnAt = elapsed + 40 + rng() * 25;
          endBlackout();
          link?.sendEvent({ type: "blackout", on: false });
        }
        power += (powerTarget - power) * Math.min(1, delta * (powerTarget > power ? 6 : 14));
        audio.setPower(power);
      }

      decor.update(elapsed);
      machineBlink?.(elapsed);
      if (waterTex) waterTex.offset.set(elapsed * 0.035, elapsed * 0.021);

      // --- La Fete : couleurs qui tournent, enceintes qui battent, musique ---
      if (partyHue && fixtureMesh) {
        partyTimer -= delta;
        if (partyTimer <= 0) {
          partyTimer = 0.1;
          const shift = elapsed * 0.03;
          for (const f of fixtures) {
            if (f.state === 1) continue;
            const i = f.index;
            const c = baseFixtureColors[i];
            c.setHSL((partyHue[i * 3] + shift) % 1, partyHue[i * 3 + 1], partyHue[i * 3 + 2]);
            lightColors[i].copy(c);
            const gi = litIndex.get(i);
            if (gi !== undefined) glowBase[gi].copy(c).multiply(glowTint);
            // Les ampoules qui clignotent sont recolorees plus bas, a chaque image.
            if (f.state === 2) continue;
            fixtureMesh.setColorAt(i, c);
            if (gi !== undefined) {
              glowColors[gi * 3] = glowBase[gi].r;
              glowColors[gi * 3 + 1] = glowBase[gi].g;
              glowColors[gi * 3 + 2] = glowBase[gi].b;
            }
          }
          for (const slot of pool) if (slot.fixture >= 0) slot.light.color.copy(lightColors[slot.fixture]);
          if (fixtureMesh.instanceColor) fixtureMesh.instanceColor.needsUpdate = true;
          glowColorAttr.needsUpdate = true;
          // L'ambiance suit, de loin : un tiers de la couleur qui tourne.
          partyHemi.setHSL((0.92 + shift) % 1, 0.7, 0.72);
          hemi.color.setHex(def.hemi.sky).lerp(partyHemi, 0.35);
        }
      }
      if (speakers) for (const v of valves) v.pulse?.(elapsed);
      if (partyMusic) {
        partyMusicTimer -= delta;
        if (partyMusicTimer <= 0) {
          partyMusicTimer = 0.25;
          // Elle vient de l'enceinte encore branchee la plus proche : plus fort
          // a mesure qu'on s'en approche, et du bon cote.
          let best = Infinity;
          let bx = 0;
          let bz = 0;
          for (const v of valves) {
            if (v.done) continue;
            const d = Math.hypot(v.face.x / CS - player.x, v.face.z / CS - player.z) * CS;
            if (d < best) {
              best = d;
              bx = v.face.x / CS;
              bz = v.face.z / CS;
            }
          }
          if (best < Infinity) {
            const near = THREE.MathUtils.clamp(1 - best / 34, 0, 1);
            partyMusic.setLevel(0.08 + 0.42 * near * near, spatial(bx, bz, 1).pan * 0.6);
          }
        }
      }

      // --- Luminaires qui clignotent ---
      if (fixtureMesh && (flickering.length > 0 || def.blackouts)) {
        const list = def.blackouts ? fixtures : flickering;
        for (const f of list) {
          const k = fixtureFactor(f);
          tmpColor.copy(f.state === 1 ? deadColor : baseFixtureColors[f.index]).multiplyScalar(f.state === 1 ? 1 : 0.15 + 0.85 * k);
          fixtureMesh.setColorAt(f.index, tmpColor);
          const gi = litIndex.get(f.index);
          if (gi !== undefined) {
            glowColors[gi * 3] = glowBase[gi].r * k;
            glowColors[gi * 3 + 1] = glowBase[gi].g * k;
            glowColors[gi * 3 + 2] = glowBase[gi].b * k;
          }
          if (f.state === 2 && k < 0.5 && elapsed >= nextFlickerSoundAt) {
            const d = Math.hypot(f.x / CS - player.x, f.z / CS - player.z) * CS;
            if (d < 9) {
              nextFlickerSoundAt = elapsed + 1.8;
              playFlicker(audio.ctx, audio.master, spatial(f.x / CS, f.z / CS, 14, 1));
            }
          }
        }
        if (fixtureMesh.instanceColor) fixtureMesh.instanceColor.needsUpdate = true;
        glowColorAttr.needsUpdate = true;
      }

      // --- Reserve de lumieres : les plus proches du joueur ---
      poolTimer -= delta;
      if (poolTimer <= 0) {
        poolTimer = 0.1;
        const px = player.x * CS;
        const pz = player.z * CS;
        const ranked = fixtures
          .filter((f) => f.state !== 1)
          .map((f) => ({ f, d: (f.x - px) ** 2 + (f.z - pz) ** 2 }))
          .sort((a, b) => a.d - b.d)
          .slice(0, POOL);
        const wanted = new Set(ranked.map((r) => r.f.index));
        // Garder les lampes deja placees sur un luminaire encore voulu.
        for (const slot of pool) if (!wanted.has(slot.fixture)) slot.fixture = -1;
        for (const r of ranked) {
          if (pool.some((s) => s.fixture === r.f.index)) continue;
          const free = pool.find((s) => s.fixture === -1);
          if (!free) break;
          free.fixture = r.f.index;
          free.level = 0;
          free.light.position.set(r.f.x, r.f.ly ?? r.f.y - 0.15, r.f.z);
          free.light.color.copy(lightColors[r.f.index]);
        }
      }
      // Salle aux neons morts : ils sont tous eteints, et l'ambiance s'eteint
      // aussi quand on y entre. Sous la chaise seule, a moitie : son unique
      // neon doit se detacher du noir.
      {
        const ci = Math.floor(player.z) * W + Math.floor(player.x);
        const here = ci >= 0 && ci < data.zones.length && data.zones[ci] !== 0 ? zoneKind(data.zones, ci) : null;
        const target = here === "neons-morts" ? 1 : here === "chaise-seule" ? 0.55 : 0;
        zoneDark += (target - zoneDark) * Math.min(1, delta * 1.6);
        if (zoneDark < 0.002 && target === 0) zoneDark = 0;
        // Les lampes de la reserve eclairent a travers les murs : dans ces
        // deux salles, celles du dehors s'effacent (seul le neon de la chaise reste).
        if (here === "neons-morts" || here === "chaise-seule") darkRoomCode = data.zones[ci];
        const dimTarget = here === "neons-morts" || here === "chaise-seule" ? 1 : 0;
        roomDim += (dimTarget - roomDim) * Math.min(1, delta * 1.6);
        if (roomDim < 0.002 && dimTarget === 0) roomDim = 0;
      }
      let lightHere = 0;
      for (const slot of pool) {
        if (slot.fixture < 0) {
          slot.level = 0;
          slot.light.intensity = 0;
          continue;
        }
        const f = fixtures[slot.fixture];
        slot.level = Math.min(1, slot.level + delta * 6);
        const d = Math.hypot(f.x - player.x * CS, f.z - player.z * CS);
        const falloff = THREE.MathUtils.clamp(1 - d / (def.lamp.range * 2.2), 0, 1);
        const outside = roomDim > 0 && fixtureZone[f.index] !== darkRoomCode ? 1 - roomDim : 1;
        const k = fixtureFactor(f) * outside;
        slot.light.intensity = def.lamp.intensity * slot.level * k * brightness * (0.35 + 0.65 * falloff);
        lightHere = Math.max(lightHere, k * THREE.MathUtils.clamp(1 - d / (def.lamp.range * 0.9), 0, 1));
      }
      hemi.intensity = def.hemi.intensity * brightness * (def.blackouts ? 0.12 + 0.88 * power : 1) * (1 - 0.85 * zoneDark);

      // --- Entite ---
      const introHold = elapsed < INTRO_SECONDS;
      losTimer -= delta;
      if (losTimer <= 0) {
        losTimer = 0.2;
        const d = Math.hypot(entity.x - player.x, entity.z - player.z) * CS;
        los = entity.active && d < 40 ? hasLOS(player.x, player.z, entity.x, entity.z) : false;
      }

      if (
        isHost &&
        def.id === "niveau-run" &&
        !runReleased &&
        !introHold &&
        ((firstMoveAt >= 0 && elapsed - firstMoveAt > 3) || (link !== null && elapsed > INTRO_SECONDS + 8))
      ) {
        releaseRun();
      }

      let moved = false;
      if (isHost && entity.active && !introHold && runReleased && !devRef.current.freeze) {
        // Cibles : moi si je suis vivant, et les amis vivants.
        type Target = { id: string; x: number; z: number; lamp: boolean; crouch: boolean; los: boolean };
        const targets: Target[] = [];
        if (!spectating) targets.push({ id: selfKey, x: player.x, z: player.z, lamp, crouch: crouching, los });
        for (const [id, av] of avatars) {
          if (av.fresh && !av.dead) targets.push({ id, x: av.x, z: av.z, lamp: av.lamp, crouch: av.crouch > 0.5, los: av.entityLos });
        }
        let target: Target | null = null;
        let bestScore = Infinity;
        canSee = false;
        for (const t of targets) {
          const dCells = Math.hypot(t.x - entity.x, t.z - entity.z);
          const dM = dCells * CS;
          const behind = ((t.x - entity.x) * Math.sin(entity.yaw) + (t.z - entity.z) * Math.cos(entity.yaw)) / (dCells || 1) < -0.25;
          let sight: number;
          if (smiler) {
            // Le Souriant est attire par la lumiere : lampe allumee, il te voit de loin.
            sight = t.lamp ? 22 : t.crouch ? 3.5 : 6;
          } else {
            sight = t.lamp ? 18 : t.crouch ? 6 : 10;
            if (behind) sight *= 0.45;
          }
          // Les Chiens sont aveugles : ni la vue ni la lampe ne comptent, seulement les bruits.
          const seen = (!traits || traits.sees) && t.los && dM < sight;
          // Quelqu'un qu'elle voit passe toujours avant quelqu'un qu'elle ne voit pas.
          const score = dM - (seen ? 1000 : 0);
          if (score < bestScore) {
            bestScore = score;
            target = t;
            canSee = seen;
          }
        }

        // Voleur de peau : fige tant qu'un vivant le regarde (a l'ecran, sans
        // mur entre eux, en deca du brouillard). Personne ne regarde : il file.
        monsterFrozen = false;
        if (traits?.freezesWhenWatched) {
          const reach = fog.far + 2;
          if (
            !spectating &&
            los &&
            Math.hypot(entity.x - player.x, entity.z - player.z) * CS < reach &&
            isLookingAt(player.x, player.z, player.yaw, entity.x, entity.z, watchCos)
          ) {
            monsterFrozen = true;
          }
          if (!monsterFrozen) {
            for (const av of avatars.values()) {
              if (!av.fresh || av.dead || !av.entityLos) continue;
              if (Math.hypot(entity.x - av.x, entity.z - av.z) * CS < reach && isLookingAt(av.x, av.z, av.yaw, entity.x, entity.z, watchCos)) {
                monsterFrozen = true;
                break;
              }
            }
          }
        }

        if (target) {
          thinkTimer -= delta;
          if (thinkTimer <= 0) {
            thinkTimer = THINK_INTERVAL;
            noises = pruneNoises(noises, elapsed);
            const decision = thinkMonster(
              brain,
              {
                now: elapsed,
                monster: { x: entity.x, z: entity.z },
                player: { x: target.x, z: target.z, hidden: false },
                canSee,
                noises,
                noiseWalls: noises.map((n) => wallsBetween(n.x, n.z, entity.x, entity.z, isSolid)),
                forceChase: def.id === "niveau-run",
                // Elle se rapproche a mesure que l'objectif avance (vannes, fusibles, badges).
                pressure:
                  def.objective === "vannes"
                    ? valvesDone / def.goalCount
                    : def.objective === "fusibles" && def.goalCount > 0
                      ? fuses / def.goalCount
                      : 0.4,
              },
              mapQuery,
              rng,
            );
            if (decision.noticed) {
              screamUntil = elapsed + 0.9;
              if (bacteria) playBacteriaScreech(audio.ctx, audio.master, spatial(entity.x, entity.z, 40, 1));
              else if (monster) {
                monsterCall();
                // Fetards : coucou d'abord, la course ensuite.
                if (traits && traits.greetSeconds > 0) greetUntil = elapsed + traits.greetSeconds;
              } else playSmilerGiggle(audio.ctx, audio.master, spatial(entity.x, entity.z, 40, 1.2));
            } else if (monster && traits && !traits.sees && decision.alerted && decision.speed === "chasse" && elapsed >= nextMonsterCallAt) {
              // Les Chiens ne voient rien : c'est un bruit fort qui les lance.
              screamUntil = elapsed + 0.9;
              monsterCall();
            }
            mode = decision.speed;
            state = decision.state;
            if (decision.goal) {
              const [gx, gy] = decision.goal;
              const key = gy * W + gx;
              entity.repath -= THINK_INTERVAL;
              if (key !== entity.goalKey || entity.repath <= 0 || !entity.path || entity.pathIndex >= entity.path.length) {
                entity.goalKey = key;
                entity.repath = REPATH;
                entity.path = gridPath(cells, W, H, Math.floor(entity.x), Math.floor(entity.z), gx, gy);
                // Le chemin commence par sa propre case : la viser la ramenait au
                // centre a chaque recalcul (toutes les 0,45 s). En marche, elle
                // n'en sortait jamais et faisait demi-tour sur place. On vise
                // directement la case suivante, ce qui reste entre deux cases libres.
                entity.pathIndex = entity.path && entity.path.length > 1 ? 1 : 0;
              }
            }
          }

          const speedM = mode === "chasse" || mode === "fuite" ? chaseSpeed : mode === "marche" ? investigateSpeed : wanderSpeed;
          const speed = speedM / CS;
          const tDist = Math.hypot(target.x - entity.x, target.z - entity.z) * CS;
          if (monsterFrozen) {
            // Regarde, il ne bouge plus du tout : ni un pas, ni un tour de tete.
          } else if (greetUntil > elapsed) {
            // Coucou : il se tourne vers toi et agite la main, sans avancer.
            let turn = Math.atan2(target.x - entity.x, target.z - entity.z) - entity.yaw;
            while (turn > Math.PI) turn -= Math.PI * 2;
            while (turn < -Math.PI) turn += Math.PI * 2;
            entity.yaw += turn * Math.min(1, delta * 6);
          } else if (
            (state === "poursuivre" && (canSee || def.id === "niveau-run") && tDist < 2.2) ||
            // Chiens : aveugles, mais a deux pas d'un bruit fort, ils sautent dessus.
            (traits !== null && !traits.sees && state === "enqueter" && mode === "chasse" && tDist < 2.2)
          ) {
            const dx = target.x - entity.x;
            const dz = target.z - entity.z;
            const d = Math.hypot(dx, dz) || 1;
            const stepLen = Math.min(speed * delta, d);
            const nx = entity.x + (dx / d) * stepLen;
            const nz = entity.z + (dz / d) * stepLen;
            if (!blocked(nx, entity.z, 0.2 / CS)) entity.x = nx;
            if (!blocked(entity.x, nz, 0.2 / CS)) entity.z = nz;
            entity.yaw = Math.atan2(dx, dz);
            moved = true;
          } else if (entity.path && entity.pathIndex < entity.path.length) {
            // Case atteinte : on vise aussitot la suivante, sans marquer d'arret
            // (un arret d'une image a chaque case faisait saccader la foulee).
            const nodeX = (i: number) => (entity.path![i] % W) + 0.5;
            const nodeZ = (i: number) => Math.floor(entity.path![i] / W) + 0.5;
            while (
              entity.pathIndex < entity.path.length - 1 &&
              Math.hypot(nodeX(entity.pathIndex) - entity.x, nodeZ(entity.pathIndex) - entity.z) < 0.08
            ) {
              entity.pathIndex++;
            }
            const tx = nodeX(entity.pathIndex);
            const tz = nodeZ(entity.pathIndex);
            const dx = tx - entity.x;
            const dz = tz - entity.z;
            const d = Math.hypot(dx, dz);
            if (d < 0.08) {
              entity.pathIndex++;
            } else {
              const stepLen = Math.min(speed * delta, d);
              entity.x += (dx / d) * stepLen;
              entity.z += (dz / d) * stepLen;
              let turn = Math.atan2(dx, dz) - entity.yaw;
              while (turn > Math.PI) turn -= Math.PI * 2;
              while (turn < -Math.PI) turn += Math.PI * 2;
              entity.yaw += turn * Math.min(1, delta * 7);
              moved = true;
            }
          }
          hostEntitySpeed = moved ? speedM : 0;
          if (moved) entity.walk += speedM * delta * 2.2;
          entity.lunge += ((tDist < 2 ? 1 - tDist / 2 : 0) - entity.lunge) * Math.min(1, delta * 5);

          // Captures : l'hote seul en decide, pour tout le monde. Fige, le
          // Voleur ne peut prendre personne.
          for (const t of targets) {
            if (monsterFrozen || Math.hypot(t.x - entity.x, t.z - entity.z) * CS >= CAPTURE) continue;
            const cause: DeathCause = monster ? monster.kind : bacteria ? "bacterie" : "souriant";
            if (t.id === selfKey) killPlayer(cause);
            else {
              const av = avatars.get(t.id);
              if (av && !av.caught) {
                av.caught = true;
                link?.sendEvent({ type: "caught", id: t.id, cause });
              }
            }
          }
        } else {
          hostEntitySpeed = 0;
        }
      } else if (isHost) {
        hostEntitySpeed = 0;
      }

      // En groupe, les autres joueurs recoivent la creature de l'hote.
      if (!isHost && link?.entity) {
        const net = link.entity;
        const k = Math.min(1, delta * 10);
        if (Math.hypot(net.x - entity.x, net.z - entity.z) > 4) {
          entity.x = net.x;
          entity.z = net.z;
        } else {
          entity.x += (net.x - entity.x) * k;
          entity.z += (net.z - entity.z) * k;
        }
        let dyaw = net.yaw - entity.yaw;
        while (dyaw > Math.PI) dyaw -= Math.PI * 2;
        while (dyaw < -Math.PI) dyaw += Math.PI * 2;
        entity.yaw += dyaw * k;
        entity.walk = net.walk;
        entity.active = net.active;
        entity.lunge = net.lunge;
        entity.opacity = net.opacity;
        if (!monster && net.state === "poursuivre" && state !== "poursuivre") {
          screamUntil = elapsed + 0.9;
          if (bacteria) playBacteriaScreech(audio.ctx, audio.master, spatial(entity.x, entity.z, 40, 1));
          else playSmilerGiggle(audio.ctx, audio.master, spatial(entity.x, entity.z, 40, 1.2));
        }
        state = net.state as BrainState;
        netEntitySpeed = net.speed;
        if (bacteria) bacteria.group.visible = net.visible;
        if (monster) {
          monster.group.visible = net.visible;
          // Fige, coucou et cris : tels que l'hote les decide.
          monsterFrozen = net.frozen === true;
          monsterDisplay = net.pose === "salut" ? "salut" : state;
          if (typeof net.calls === "number" && net.calls !== lastNetCalls) {
            if (lastNetCalls >= 0 && net.calls > lastNetCalls) {
              screamUntil = elapsed + 0.9;
              playMonsterCall(audio.ctx, audio.master, monster.kind, spatial(entity.x, entity.z, 45, 1.2));
            }
            lastNetCalls = net.calls;
          }
        }
      }
      if (monster && isHost) monsterDisplay = greetUntil > elapsed ? "salut" : state;

      // Affichage et sons, pareils pour l'hote et les invites.
      const renderSpeed = isHost ? hostEntitySpeed : netEntitySpeed;
      const distCells = Math.hypot(entity.x - player.x, entity.z - player.z);
      const distM = distCells * CS;
      if (bacteria) {
        bacteria.group.position.set(entity.x * CS, floorY(entity.z), entity.z * CS);
        bacteria.group.rotation.y = entity.yaw;
        let headYaw = Math.atan2(player.x - entity.x, player.z - entity.z) - entity.yaw;
        while (headYaw > Math.PI) headYaw -= Math.PI * 2;
        while (headYaw < -Math.PI) headYaw += Math.PI * 2;
        const hunting = state === "poursuivre";
        poseBacteria(bacteria, {
          time: elapsed,
          walk: entity.walk,
          speed: renderSpeed,
          headYaw: hunting ? THREE.MathUtils.clamp(headYaw, -1.4, 1.4) : Math.sin(elapsed * 1.7) * 1.1,
          lunge: entity.lunge,
          scream: THREE.MathUtils.clamp((screamUntil - elapsed) / 0.9, 0, 1),
        });
        animateBacteriaModel(delta, renderSpeed, entity.lunge, THREE.MathUtils.clamp((screamUntil - elapsed) / 0.9, 0, 1), state);
        if (entity.active && runReleased && !introHold) {
          if (elapsed >= nextClickAt && distM < 26) {
            nextClickAt = elapsed + 1.1 + rng() * 1.8;
            playBacteriaClicks(audio.ctx, audio.master, spatial(entity.x, entity.z, 26, 1.1));
          }
          if (renderSpeed > 0.1 && elapsed >= nextEntityStepAt && distM < 22) {
            nextEntityStepAt = elapsed + 0.9 / Math.max(0.8, renderSpeed / 2);
            playEntityStep(audio.ctx, audio.master, spatial(entity.x, entity.z, 22, 1.2));
          }
        }
      }
      if (monster) {
        monster.group.position.set(entity.x * CS, floorY(entity.z), entity.z * CS);
        monster.group.rotation.y = entity.yaw;
        let headYaw = Math.atan2(player.x - entity.x, player.z - entity.z) - entity.yaw;
        while (headYaw > Math.PI) headYaw -= Math.PI * 2;
        while (headYaw < -Math.PI) headYaw += Math.PI * 2;
        // Le Voleur te suit toujours des yeux ; les Chiens reniflent a droite,
        // a gauche ; un Fetard ne tourne la tete vers toi que s'il t'a vu.
        const facing = monster.kind === "voleur" || monsterDisplay === "salut" || state === "poursuivre";
        monsterPose.time = elapsed;
        monsterPose.delta = delta;
        monsterPose.speed = renderSpeed;
        monsterPose.state = monsterDisplay;
        monsterPose.lunge = entity.lunge;
        monsterPose.scream = THREE.MathUtils.clamp((screamUntil - elapsed) / 0.9, 0, 1);
        monsterPose.headYaw =
          monster.kind === "chiens" ? Math.sin(elapsed * 1.3) * 0.6 : facing ? THREE.MathUtils.clamp(headYaw, -1.2, 1.2) : Math.sin(elapsed * 0.8) * 0.5;
        monsterPose.watched = monsterFrozen;
        monster.animate(monsterPose);
        if (entity.active && !introHold && monster.group.visible) {
          // Il rode : chuchotements du Voleur (jamais quand on le regarde),
          // grognements des Chiens, gloussements des Fetards.
          if (elapsed >= nextMonsterMurmurAt) {
            nextMonsterMurmurAt = elapsed + 7 + rng() * 8;
            if (distM < 26 && !monsterFrozen) {
              playMonsterCall(audio.ctx, audio.master, monster.kind, spatial(entity.x, entity.z, 26, 0.9), "ambiance");
            }
          }
          if (renderSpeed > 0.1 && elapsed >= nextEntityStepAt && distM < 22) {
            // Une foulee par longueur de pas : les Chiens trottinent, le Voleur allonge.
            const stride = monster.kind === "chiens" ? 0.8 : monster.kind === "voleur" ? 1.15 : 1;
            nextEntityStepAt = elapsed + THREE.MathUtils.clamp(stride / renderSpeed, 0.16, 0.9);
            playMonsterStep(audio.ctx, audio.master, monster.kind, spatial(entity.x, entity.z, 22, 1.2));
          }
        }
      }
      // Les danseurs immobiles de la Fete : animes seulement a portee de vue.
      if (figures.length > 0) {
        figurePose.time = elapsed;
        figurePose.delta = delta;
        const reach = fog.far + 4;
        for (const fig of figures) {
          const near = Math.hypot(fig.x - player.x, fig.z - player.z) * CS < reach;
          fig.body.group.visible = near;
          if (near) fig.body.animate(figurePose);
        }
      }
      if (smiler) {
        if (isHost) {
          entity.opacity = entity.active
            ? Math.min(1, entity.opacity + delta * 2)
            : Math.max(0, entity.opacity - delta * 2.5);
        }
        smiler.group.position.set(entity.x * CS, floorY(entity.z), entity.z * CS);
        smiler.group.rotation.y = Math.atan2(player.x - entity.x, player.z - entity.z);
        const rush = state === "poursuivre" && entity.active ? THREE.MathUtils.clamp(1 - distM / 9, 0, 1) : 0;
        poseSmiler(smiler, elapsed, rush, entity.opacity * (1 - power * 0.95));
        if (rush > 0.4 && elapsed >= nextClickAt) {
          nextClickAt = elapsed + 2.2;
          playSmilerRush(audio.ctx, audio.master, spatial(entity.x, entity.z, 30, 1));
        }
      }

      // Voix : parler fait du bruit, et la creature l'entend.
      {
        const voiceOn = !!hub && (link !== null || micEnabledRef.current);
        const level = voiceOn && hub ? hub.level() : 0;
        // On parle normalement : rien. On parle trop fort : elle entend, et
        // d'autant plus loin qu'on crie.
        if (level > VOICE_LOUD && !spectating && !introHold && elapsed >= nextVoiceNoiseAt) {
          nextVoiceNoiseAt = elapsed + 0.35;
          emitNoise("voix", player.x, player.z, 0.4 + ((level - VOICE_LOUD) / (1 - VOICE_LOUD)) * 1.1);
        }
        micShown += (level - micShown) * Math.min(1, delta * 10);
      }

      // Coeur qui s'emballe quand elle approche.
      const threat = entity.active && def.entity !== "aucune" ? THREE.MathUtils.clamp(1 - distM / 18, 0, 1) * (los ? 1 : 0.5) : 0;
      if (threat > 0.15 && elapsed >= nextHeartAt) {
        nextHeartAt = elapsed + THREE.MathUtils.lerp(1.1, 0.3, threat);
        playHeartbeat(audio.ctx, audio.master, 0.5 + threat);
      }

      // --- Lucidite ---
      if (def.sanityDrain > 0 && !spectating) {
        const dark = lightHere < 0.25 && !lamp;
        // Rien ne baisse pendant le carton titre : l'entite aussi est figee.
        const drain = elapsed < INTRO_SECONDS ? 0 : def.sanityDrain * (dark ? 2.4 : 1) + (threat > 0.4 ? 1.6 : 0);
        sanityLevel = devRef.current.infinite ? 100 : Math.max(0, sanityLevel - drain * delta);
        if (sanityLevel <= 0) killPlayer("lucidite");
        const lost = 1 - sanityLevel / 100;
        if (sanityLevel < 45 && elapsed >= nextWhisperAt) {
          nextWhisperAt = elapsed + 6 + rng() * 10 * (sanityLevel / 45);
          const a = rng() * Math.PI * 2;
          playWhisper(audio.ctx, audio.master, { pan: Math.sin(a), gain: 0.4 + lost * 0.6 });
          if (rng() < 0.3) playDistantSteps(audio.ctx, audio.master, { pan: Math.cos(a), gain: 0.5 });
        }
        if (sanityLevel < 18 && !tinnitusPlayed) {
          tinnitusPlayed = true;
          playTinnitus(audio.ctx, audio.master);
        }
        if (sanityLevel > 30) tinnitusPlayed = false;
        // L'Egare : au bout du couloir, quand la tete lache.
        if (sanityLevel < 32 && wandererSince < 0 && elapsed >= nextWandererAt) {
          nextWandererAt = elapsed + 18 + rng() * 22;
          const fx = -Math.sin(player.yaw);
          const fz = -Math.cos(player.yaw);
          for (let dist = 12 / CS; dist > 5 / CS; dist -= 0.5) {
            const gx = player.x + fx * dist;
            const gz = player.z + fz * dist;
            if (!isSolid(Math.floor(gx), Math.floor(gz)) && hasLOS(player.x, player.z, gx, gz)) {
              wandererX = gx;
              wandererZ = gz;
              wandererSince = elapsed;
              wanderer.group.position.set(gx * CS, floorY(gz), gz * CS);
              wanderer.group.rotation.y = Math.atan2(player.x - gx, player.z - gz);
              break;
            }
          }
        }
      }
      if (wandererSince >= 0) {
        const age = elapsed - wandererSince;
        const dx = wandererX - player.x;
        const dz = wandererZ - player.z;
        const d = Math.hypot(dx, dz) || 1;
        const lookX = -Math.sin(player.yaw);
        const lookZ = -Math.cos(player.yaw);
        const stared = (dx * lookX + dz * lookZ) / d > 0.97 && age > 0.6;
        wanderer.setOpacity(Math.min(1, age * 2) * (stared ? 0.3 : 0.9));
        if (stared || age > 4 || d * CS < 3) {
          wanderer.setOpacity(0);
          wandererSince = -1;
          playWhisper(audio.ctx, audio.master, spatial(wandererX, wandererZ, 20, 1));
        }
      }

      // --- Vannes : maintenir E ---
      const valve = nearValve();
      const using = keys.has("e") || held.use;
      let valveShown: number | null = null;
      if (valve && using && !spectating && !gripping) playGripValve(audio.ctx, audio.master);
      gripping = !!valve && using && !spectating;
      if (valve && using && !spectating) {
        const before = valve.progress;
        valve.progress = Math.min(1, valve.progress + delta / VALVE_SECONDS);
        valve.setTurn(valve.progress);
        valveShown = valve.progress;
        if (Math.floor(before * 7) !== Math.floor(valve.progress * 7)) {
          // Disjoncteur et fiche d'enceinte : des declics ; vanne : elle grince.
          if (def.id === "niveau-3" || speakers) playClick(audio.ctx, audio.master, valve.progress > 0.5);
          else playValveTurn(audio.ctx, audio.master, valve.progress);
          emitNoise("porte", player.x, player.z, 0.9);
          handReachAt = elapsed;
        }
        if (valve.progress >= 1) markValveDone(valve, true);
      } else if (valve && valve.progress > 0) {
        valveShown = valve.progress;
      }

      // --- Niveau ! : la porte au bout du couloir ---
      if (def.objective === "course" && distToExit() < 1.6 && !spectating) completeLevel();

      // Tout le groupe est mort : l'hote siffle la fin.
      if (link && isHost && spectating && !ended && noclipSince < 0) {
        const someoneAlive = [...avatars.values()].some((a) => a.fresh && !a.dead);
        if (!someoneAlive) {
          link.sendEvent({ type: "wipe", cause: deathCause });
          ended = true;
          onDeathRef.current(deathCause, stats());
          renderer.render(scene, camera);
          return;
        }
      }

      // Etat envoye au groupe dix fois par seconde.
      if (link) {
        netTimer -= delta;
        if (netTimer <= 0) {
          // ~7 envois par seconde : fluide avec le lissage, et econome en messages Realtime.
          netTimer = 0.14;
          link.sendState(
            {
              x: player.x,
              z: player.z,
              yaw: player.yaw,
              pitch: player.pitch,
              lamp: lamp && batteryLevel > 0,
              crouch: crouching,
              speed: moving ? (sprinting ? 2 : 1) : 0,
              dead: spectating,
              seed,
            },
            isHost
              ? {
                  x: entity.x,
                  z: entity.z,
                  yaw: entity.yaw,
                  walk: entity.walk,
                  speed: hostEntitySpeed,
                  state,
                  active: entity.active,
                  visible: bacteria ? bacteria.group.visible : true,
                  lunge: entity.lunge,
                  opacity: entity.opacity,
                  ...(monster ? { pose: monsterDisplay, frozen: monsterFrozen, calls: monsterCalls } : {}),
                }
              : undefined,
          );
        }
      }

      // Objets : reflets qui palpitent.
      for (const p of pickups) {
        if (p.taken) continue;
        (p.glint.material as THREE.SpriteMaterial).opacity = 0.35 + Math.sin(elapsed * 3 + p.phase) * 0.3;
      }

      // --- Angoisse et brouillard ---
      const sanityDread = def.sanityDrain > 0 ? THREE.MathUtils.clamp((50 - sanityLevel) / 50, 0, 1) : 0;
      const targetDread = Math.max(threat, sanityDread * 0.8, def.id === "niveau-run" && runReleased ? 0.35 : 0);
      dreadLevel += (targetDread - dreadLevel) * Math.min(1, delta * 3);
      audio.setTension(dreadLevel);
      const blackoutFog = def.blackouts ? 1 - power : 0;
      fog.far = THREE.MathUtils.lerp(def.fog.far, def.fog.far * 0.45, Math.max(blackoutFog, sanityDread * 0.4, zoneDark * 0.5));
      // Mode dev, au-dessus du plafond : on voit le niveau comme une carte.
      const flyingHigh = devRef.current.fly && camera.position.y > floorY(player.z) + WH + 0.3;
      if (flyingHigh) {
        fog.near = 120;
        fog.far = 600;
        hemi.intensity = 3 * brightness;
      } else if (fog.near !== def.fog.near) {
        fog.near = def.fog.near;
      }
      const wantFar = devRef.current.fly ? 600 : VIEW_FAR;
      if (camera.far !== wantFar) {
        camera.far = wantFar;
        camera.updateProjectionMatrix();
      }
      handRig.group.visible = !devRef.current.fly && !spectating;

      // Instantane du mode developpeur, quatre fois par seconde, panneau ouvert seulement.
      if (devOpenRef.current) {
        devSnapTimer -= delta;
        if (devSnapTimer <= 0) {
          devSnapTimer = 0.25;
          setDevSnap({
            player: { x: player.x, z: player.z, yaw: player.yaw },
            entity: def.entity === "aucune" ? null : { x: entity.x, z: entity.z, active: entity.active, state },
            exit: { x: exitT.x / CS, z: exitT.z / CS },
            pickups: pickups.filter((pk) => !pk.taken).map((pk) => ({ x: pk.x, z: pk.z, kind: pk.kind })),
            valves: valves.map((v) => ({ x: v.face.x / CS, z: v.face.z / CS, done: v.done })),
            sanity: Math.round(sanityLevel),
            battery: Math.round(batteryLevel),
            progress:
              def.objective === "fusibles"
                ? fuses >= def.goalCount
                  ? "fini"
                  : `${fuses}/${def.goalCount}`
                : def.objective === "vannes"
                  ? valvesDone >= def.goalCount
                    ? "fini"
                    : `${valvesDone}/${def.goalCount}`
                  : "sortie",
            flyHeight: devFlyHeight,
            fps: Math.round(1000 / Math.max(1, frameMsAvg)),
            pixelRatio,
          });
        }
      }
      // Brouillard assombri par les coupures et par les salles aux neons morts.
      const ambient = (def.blackouts ? 0.25 + 0.75 * power : 1) * (1 - 0.75 * zoneDark);
      if (def.blackouts || ambient !== ambientShown) {
        ambientShown = ambient;
        (scene.background as THREE.Color).setHex(def.fog.color).multiplyScalar(ambient);
        fog.color.setHex(def.fog.color).multiplyScalar(ambient);
      }

      // --- Interface (synchronisee par paliers) ---
      uiTimer += delta;
      if (uiTimer > 0.12) {
        uiTimer = 0;
        const s = Math.round(sanityLevel);
        if (s !== lastSanity) {
          lastSanity = s;
          setSanity(s);
        }
        const b = Math.round(batteryLevel);
        if (b !== lastBattery) {
          lastBattery = b;
          setBattery(b);
        }
        const st = Math.round(staminaLevel / 5) * 5;
        if (st !== lastStamina) {
          lastStamina = st;
          setStamina(st);
        }
        const dr = Math.round(dreadLevel * 20) / 20;
        if (dr !== lastDread) {
          lastDread = dr;
          setDread(dr);
        }
        const secs = Math.floor(elapsed);
        if (secs !== lastClock) {
          lastClock = secs;
          setClock(secs);
        }
        const obj = computeObjective();
        const objKey = obj.title + obj.detail;
        if (objKey !== lastObjective) {
          lastObjective = objKey;
          setObjective(obj);
        }
        // Signal : l'objectif le plus proche, a vol d'oiseau.
        let targetD = Infinity;
        const consider = (x: number, z: number) => {
          targetD = Math.min(targetD, Math.hypot(x - player.x, z - player.z) * CS);
        };
        if (def.objective === "fusibles" && fuses < def.goalCount) {
          for (const p of pickups) if (!p.taken && p.kind === "fusible") consider(p.x, p.z);
        } else if (def.objective === "vannes" && valvesDone < def.goalCount) {
          for (const v of valves) if (!v.done) consider(v.face.x / CS, v.face.z / CS);
        } else {
          consider(exitT.x / CS, exitT.z / CS);
        }
        const sig = Math.round(THREE.MathUtils.clamp(1 - targetD / 30, 0, 1) * 5);
        if (sig !== lastSignal) {
          lastSignal = sig;
          setSignal(sig);
        }
        let promptText: string | null = null;
        const pk = nearestPickup();
        if (pk) {
          promptText = pk.kind === "eau" ? "E — Ramasser l'eau d'amande" : pk.kind === "pile" ? "E — Ramasser la pile" : words.itemPrompt;
        } else if (valve) {
          promptText = words.itemPrompt;
        } else if (distToExit() < DOOR_REACH && def.objective !== "course") {
          promptText = exitUnlocked()
            ? def.objective === "fusibles" || def.objective === "vannes"
              ? words.openPrompt
              : "E — Ouvrir la porte"
            : words.lockedPrompt;
        }
        if (promptText !== lastPrompt) {
          lastPrompt = promptText;
          setPrompt(promptText);
        }
        if (valveShown !== lastValve) {
          lastValve = valveShown;
          setValveProgress(valveShown === null ? null : Math.round(valveShown * 20) / 20);
        }
        if (hintHideAt >= 0 && elapsed > hintHideAt) {
          hintHideAt = -1;
          setHint(null);
        }
        const mic = Math.round(micShown * 10) / 10;
        setMicLevel((prev) => (prev === mic ? prev : mic));
        if (link) {
          const members = [...link.players.values()]
            .filter((r) => r.id !== selfKey)
            .map((r) => {
              const av = avatars.get(r.id);
              return {
                id: r.id,
                name: r.name,
                color: SURVIVOR_COLORS[r.color % SURVIVOR_COLORS.length].jacket,
                dead: av ? av.dead : false,
                speaking: hub ? hub.peerLevel(r.id) > 0.12 : false,
              };
            });
          const key = JSON.stringify(members);
          if (key !== lastTeamKey) {
            lastTeamKey = key;
            setTeam(members);
          }
        }
      }

      renderer.render(scene, camera);
    }

    // Compilation des shaders en arriere-plan. Faite d'un bloc au premier
    // rendu, elle figeait la page plusieurs secondes au lancement d'un niveau.
    let ready = false;
    let disposed = false;
    camera.position.set(player.x * CS, floorY(player.z) + EYE, player.z * CS);
    camera.rotation.set(0, player.yaw, 0);
    const compiling = renderer
      .compileAsync(scene, camera)
      .catch(() => undefined)
      .then(() => {
        if (disposed) return;
        ready = true;
        lastTime = performance.now();
        setLoading(false);
      });

    let tickErrors = 0;
    function tick() {
      try {
        step();
        tickErrors = 0;
      } catch (err) {
        tickErrors++;
        if (tickErrors === 1) console.error("[Backrooms] image ignorée :", err);
        if (dyingSince >= 0 && tickErrors > 30 && !ended) {
          ended = true;
          onDeathRef.current(deathCause, { seconds: Math.round(elapsed), water: waterDrunk });
        }
        try {
          if (!contextIsLost) renderer.render(scene, camera);
        } catch {
          // contexte indisponible
        }
      }
    }
    const intervalId = window.setInterval(tick, 16);
    voiceRef.current?.setSpatial(true);
    if (voiceRef.current?.hasMic() && (link || micEnabledRef.current)) {
      showHint(link ? "Micro ouvert : tes amis t'entendent… et elle aussi. M pour couper." : "Micro ouvert : elle entend ta voix. M pour couper.", 5);
    }
    tick();
    // La lampe demarre allumee dans les tunnels : l'interface doit le savoir.
    const lampSync = window.setTimeout(() => setLampOn(lamp), 0);

    function onResize() {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
      updateWatchCos();
    }
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      window.clearTimeout(initialVisibility);
      window.clearTimeout(lampSync);
      for (const id of pendingTimers) window.clearTimeout(id);
      pendingTimers.clear();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseEverything);
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("pageshow", onReturn);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      document.removeEventListener("mousemove", onMouseMove);
      renderer.domElement.removeEventListener("click", onCanvasClick);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock?.();
      apiRef.current = null;
      voiceRef.current?.setSpatial(false);
      stopPartyMusic();
      audio.stop();
      audio.ctx.close().catch(() => {});
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
      // Liberer la carte graphique, mais jamais pendant la compilation en
      // arriere-plan : three.js interroge encore les programmes des materiaux,
      // et les detruire sous lui levait une erreur.
      const disposeGpu = () => {
        bacteria?.dispose();
        monster?.dispose();
        for (const fig of figures) fig.body.dispose();
        smiler?.dispose();
        wanderer.dispose();
        handRig.dispose();
        decor.dispose();
        for (const av of avatars.values()) av.survivor.dispose();
        for (const o of owned) o.dispose();
        renderer.forceContextLoss();
        renderer.dispose();
      };
      if (ready) disposeGpu();
      else void compiling.then(disposeGpu);
    };
    // Une partie = un niveau et une graine ; le reste passe par des refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level.id, seed]);

  // --- Interface camescope ---
  const lowSanity = level.sanityDrain > 0 ? Math.max(0, (40 - sanity) / 40) : 0;
  const stamp = new Date(Date.UTC(1996, 8, 14, 3, 12, 0) + clock * 1000);
  const hh = String(stamp.getUTCHours()).padStart(2, "0");
  const mm = String(stamp.getUTCMinutes()).padStart(2, "0");
  const ss = String(stamp.getUTCSeconds()).padStart(2, "0");
  const accent = HUD_ACCENT[level.id] ?? "#ffb4a8";

  return (
    <div className="relative h-full w-full overflow-hidden bg-black font-mono select-none" onScroll={(e) => (e.currentTarget.scrollTop = 0)}>
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{
          ...(lowSanity > 0 && !spectating
            ? { animation: `backrooms-warp ${(2.6 - lowSanity * 1.4).toFixed(2)}s ease-in-out infinite`, transformOrigin: "50% 50%" }
            : {}),
          // Fantome : le monde perd ses couleurs.
          filter: spectating ? "grayscale(0.9) brightness(0.8) contrast(1.1)" : undefined,
        }}
      />

      {/* Pellicule VHS : vignette, lignes de balayage, grain, bande de tracking. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 50%, transparent ${Math.round(58 - dread * 26)}%, rgba(0,0,0,${(0.45 + dread * 0.45).toFixed(2)}) 100%)`,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.1]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.9) 0 1px, transparent 1px 3px)" }}
      />
      {grain && (
        <div
          className="pointer-events-none absolute -inset-[10%]"
          style={{
            backgroundImage: `url(${grain})`,
            opacity: 0.18 + dread * 0.2 + lowSanity * 0.2,
            animation: "horror-grain 0.5s steps(8) infinite",
          }}
        />
      )}
      <div
        className="pointer-events-none absolute inset-x-0 h-10 opacity-[0.07]"
        style={{ background: "linear-gradient(180deg, transparent, #fff, transparent)", animation: "backrooms-tracking 7s linear infinite" }}
      />
      {lowSanity > 0.35 && (
        <div
          className="pointer-events-none absolute inset-0 mix-blend-screen"
          style={{
            boxShadow: `inset 12px 0 60px rgba(255,0,60,${(lowSanity * 0.25).toFixed(2)}), inset -12px 0 60px rgba(0,200,255,${(lowSanity * 0.25).toFixed(2)})`,
          }}
        />
      )}
      {dying && <div className="pointer-events-none absolute inset-0 bg-red-900/40" style={{ animation: "horror-jitter 0.12s steps(2) infinite" }} />}
      {noclip && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(circle, transparent 20%, #000 75%)", animation: "backrooms-noclip 1.6s ease-in forwards" }}
        />
      )}

      {/* En haut a gauche : REC et le niveau. */}
      <div className="pointer-events-none absolute left-4 top-3 flex flex-col gap-1 text-[13px] tracking-widest sm:left-6 sm:top-5" style={{ color: accent, textShadow: "0 0 6px rgba(0,0,0,0.9), 1px 0 rgba(255,0,60,0.35), -1px 0 rgba(0,200,255,0.35)" }}>
        <span className="flex items-center gap-2 font-bold">
          <span className="inline-block size-2.5 rounded-full bg-red-600" style={{ animation: "backrooms-rec 1.4s steps(1) infinite" }} />
          REC
        </span>
        <span className="text-[11px] opacity-80">
          NIVEAU {level.number} · {level.name.toUpperCase()}
        </span>
        {team.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1 text-[11px]">
            {team.map((m) => (
              <li key={m.id} className="flex items-center gap-2" style={{ opacity: m.dead ? 0.5 : 1 }}>
                <span className="inline-block size-2" style={{ background: m.color }} />
                <span className={m.dead ? "line-through" : ""}>{m.name}</span>
                {m.dead && <span className="text-red-400">✝</span>}
                {m.speaking && (
                  <span className="flex items-end gap-[2px]" aria-label="parle">
                    {[4, 7, 5].map((h, i) => (
                      <span key={i} className="w-[2px] bg-emerald-400" style={{ height: h }} />
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* En haut a droite : horodatage et pile. */}
      <div className="pointer-events-none absolute right-16 top-3 flex flex-col items-end gap-1 text-[12px] tracking-widest sm:top-5" style={{ color: accent, textShadow: "0 0 6px rgba(0,0,0,0.9)" }}>
        <span>SEP 14 1996</span>
        <span className="tabular-nums">
          {hh}:{mm}:{ss}
        </span>
        <span className="mt-1 flex items-center gap-1.5 text-[10px] opacity-85">
          {lampOn ? "LAMPE" : "LAMPE OFF"}
          <span className="flex h-3 w-9 items-center gap-[2px] border px-[2px]" style={{ borderColor: accent }}>
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i} className="h-1.5 flex-1" style={{ background: battery > i * 25 + 5 ? (battery < 20 ? "#ef4444" : accent) : "transparent" }} />
            ))}
          </span>
        </span>
      </div>

      {devEnabled && devOpen && devLevel && (
        <BackroomsDevPanel
          level={level}
          cells={devLevel.cells}
          width={devLevel.width}
          height={devLevel.height}
          flags={devFlags}
          onFlags={setDevFlags}
          snap={devSnap}
          onTeleport={(x, z) => apiRef.current?.devTeleport(x, z)}
          onAdvance={() => apiRef.current?.devAdvance()}
          onClose={() => setDevOpen(false)}
        />
      )}
      {devEnabled && !devOpen && (
        <button
          type="button"
          onClick={() => setDevOpen(true)}
          className={`absolute bottom-3 left-3 z-30 px-3 py-1.5 font-sans text-[11px] font-black uppercase tracking-wider ${
            Object.values(devFlags).some(Boolean) ? "bg-amber-500 text-black" : "bg-black/70 text-amber-300 ring-1 ring-amber-500/40"
          }`}
        >
          Dev{Object.values(devFlags).some(Boolean) ? " · actif" : ""}
        </button>
      )}
      <Game3DSettings
        className="top-3 sm:top-5"
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
        brightness={brightnessLoaded}
        onQuality={(q) => apiRef.current?.applyQuality(q)}
        onOpenChange={(open) => apiRef.current?.setSettingsOpen(open)}
      />

      {/* En bas a gauche : objectif et signal. */}
      {!intro && (
        <div className="pointer-events-none absolute bottom-24 left-4 max-w-[60vw] text-[12px] tracking-wider sm:bottom-6 sm:left-6" style={{ color: accent, textShadow: "0 0 6px rgba(0,0,0,0.95)" }}>
          <p className={`text-[15px] font-bold ${level.objective === "course" ? "text-red-400" : ""}`}>{objective.title}</p>
          <p className="mt-0.5 opacity-75">{objective.detail}</p>
          {level.objective !== "course" && (
            <p className="mt-2 flex items-center gap-2 text-[10px] opacity-85">
              SIGNAL
              <span className="flex items-end gap-[3px]">
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} className="w-1.5" style={{ height: `${5 + i * 3}px`, background: i < signal ? accent : "rgba(255,255,255,0.15)" }} />
                ))}
              </span>
            </p>
          )}
        </div>
      )}

      {/* En bas a droite : lucidite, eau, souffle. */}
      {!intro && (
        <div className="pointer-events-none absolute bottom-24 right-4 flex w-44 flex-col items-end gap-1.5 text-[10px] tracking-widest sm:bottom-6 sm:right-6" style={{ color: accent, textShadow: "0 0 6px rgba(0,0,0,0.95)" }}>
          {level.sanityDrain > 0 && (
            <>
              <span className={sanity < 30 ? "text-red-400" : ""} style={sanity < 30 ? { animation: "backrooms-rec 0.8s steps(1) infinite" } : undefined}>
                LUCIDITÉ {sanity}%
              </span>
              <span className="h-1.5 w-full border" style={{ borderColor: accent }}>
                <span className="block h-full" style={{ width: `${sanity}%`, background: sanity < 30 ? "#ef4444" : accent }} />
              </span>
              <span className="opacity-85">
                EAU D&apos;AMANDE ×{water} {water > 0 && !isTouch ? "· R" : ""}
              </span>
            </>
          )}
          <span className="h-1 w-full" style={{ opacity: stamina < 100 ? 1 : 0, background: "rgba(255,255,255,0.12)" }}>
            <span className="block h-full" style={{ width: `${stamina}%`, background: stamina < 35 ? "#ef4444" : "rgba(255,255,255,0.7)" }} />
          </span>
          {crouched && <span className="opacity-70">ACCROUPI</span>}
          {voice?.hasMic() && (
            <span className="flex items-center gap-1.5">
              <span className={muted ? "text-red-400" : ""}>{muted ? "MICRO COUPÉ" : "MICRO"}</span>
              {!muted && (
                <span className="flex h-2.5 items-end gap-[2px]">
                  {Array.from({ length: 8 }, (_, i) => {
                    // Les barres au-dela du seuil sont rouges : c'est la zone ou elle entend.
                    const loudBar = (i + 1) / 8 > VOICE_LOUD;
                    return (
                      <span
                        key={i}
                        className="w-[3px]"
                        style={{
                          height: `${3 + i}px`,
                          background: micLevel * 8 > i ? (loudBar ? "#ef4444" : accent) : loudBar ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.15)",
                        }}
                      />
                    );
                  })}
                </span>
              )}
            </span>
          )}
          {voice?.hasMic() && !muted && micLevel > VOICE_LOUD && (
            <span className="font-bold text-red-400" style={{ animation: "backrooms-rec 0.5s steps(1) infinite" }}>
              TROP FORT · {level.entity === "chiens" || level.entity === "fetards" ? "ILS T'ENTENDENT" : level.entity === "voleur" ? "IL T'ENTEND" : "ELLE T'ENTEND"}
            </span>
          )}
          {blackout && (
            <span className="text-[12px] font-bold text-red-400" style={{ animation: "backrooms-rec 1s steps(1) infinite" }}>
              COUPURE DE COURANT
            </span>
          )}
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="size-1 rounded-full bg-white/60" />
      </div>

      {spectating && (
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 text-center" style={{ color: accent }}>
          <p className="text-[13px] font-bold tracking-[0.35em] text-red-400">✝ SPECTATEUR</p>
          <p className="mt-1 text-[11px] opacity-75">Si ton groupe trouve la sortie, tu reviens avec lui.</p>
        </div>
      )}

      {prompt && !intro && (
        <div className="pointer-events-none absolute bottom-40 left-1/2 -translate-x-1/2 text-center">
          <span className="bg-black/70 px-3 py-1.5 text-[13px] tracking-wider" style={{ color: accent }}>
            {prompt}
          </span>
          {valveProgress !== null && (
            <span className="mx-auto mt-2 block h-1.5 w-40 border" style={{ borderColor: accent }}>
              <span className="block h-full" style={{ width: `${valveProgress * 100}%`, background: accent }} />
            </span>
          )}
        </div>
      )}

      {hint && (
        <div className="pointer-events-none absolute left-1/2 top-24 w-80 max-w-[86vw] -translate-x-1/2 text-center">
          <p className="bg-black/60 px-3 py-2 text-[12px] leading-snug tracking-wide" style={{ color: accent }}>
            {hint}
          </p>
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black" style={{ color: accent }}>
          <span className="text-[13px] tracking-[0.5em]" style={{ animation: "backrooms-rec 0.9s steps(1) infinite" }}>
            ▶ LECTURE
          </span>
          <span className="text-[11px] tracking-[0.3em] opacity-60">REMBOBINAGE DE LA CASSETTE…</span>
        </div>
      )}

      {/* Carton de niveau, facon generique de VHS. */}
      {intro && !loading && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/55 px-6 text-center" style={{ animation: `backrooms-intro ${INTRO_SECONDS}s ease-in-out forwards` }}>
          <span className="text-[12px] tracking-[0.6em] opacity-80" style={{ color: accent }}>
            NIVEAU
          </span>
          <span className="mt-1 text-7xl font-black leading-none sm:text-8xl" style={{ color: accent, textShadow: "3px 0 rgba(255,0,60,0.45), -3px 0 rgba(0,200,255,0.45)" }}>
            {level.number}
          </span>
          <span className="mt-3 text-lg font-bold tracking-[0.3em] sm:text-2xl" style={{ color: accent }}>
            {level.name.toUpperCase()}
          </span>
          <span className="mt-3 max-w-md text-[12px] leading-relaxed tracking-wide opacity-80" style={{ color: accent }}>
            {level.tagline}
          </span>
        </div>
      )}

      {isTouch && (
        <>
          <div className="absolute bottom-6 left-4 grid grid-cols-3 gap-1.5">
            <span />
            <HoldButton label="▲" onHold={(v) => (heldRef.current.forward = v)} />
            <span />
            <HoldButton label="◀" onHold={(v) => (heldRef.current.left = v)} />
            <HoldButton label="▼" onHold={(v) => (heldRef.current.back = v)} />
            <HoldButton label="▶" onHold={(v) => (heldRef.current.right = v)} />
          </div>
          <div className="absolute bottom-40 right-4 flex flex-col items-end gap-2">
            <div className="flex gap-2">
              <HoldButton label="COURIR" wide onHold={(v) => (heldRef.current.sprint = v)} />
              <HoldButton
                label="E"
                onHold={(v) => {
                  heldRef.current.use = v;
                  if (v) apiRef.current?.interact();
                }}
              />
            </div>
            <div className="flex gap-2">
              <HoldButton label="LAMPE" wide onHold={(v) => v && apiRef.current?.toggleLamp()} />
              <HoldButton label="BOIRE" wide onHold={(v) => v && apiRef.current?.drink()} />
              <HoldButton label="C" onHold={(v) => v && apiRef.current?.toggleCrouch()} />
            </div>
          </div>
        </>
      )}

      {!isTouch && !intro && (
        <p className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] tracking-wider text-white/35">
          ZQSD · MAJ COURIR · C ACCROUPI · F LAMPE · E INTERAGIR · R BOIRE{voice?.hasMic() ? " · M MICRO" : ""}
        </p>
      )}

      {/* z-20 : sous le bouton des reglages (z-30), qu'on doit pouvoir ouvrir en pause. */}
      {paused && !contextLost && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/90" style={{ color: accent }}>
          <span className="text-2xl tracking-[0.4em]">⏸ PAUSE</span>
          <button type="button" onClick={() => apiRef.current?.resume()} className="border px-5 py-2 text-sm tracking-widest" style={{ borderColor: accent }}>
            REPRENDRE
          </button>
        </div>
      )}
      {contextLost && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black px-6 text-center" style={{ color: accent }}>
          <span className="text-xl tracking-[0.3em]">SIGNAL PERDU</span>
          <span className="max-w-sm text-xs opacity-70">
            Le navigateur a repris la carte graphique. L&apos;image revient d&apos;habitude seule en quelques secondes.
          </span>
          <button type="button" onClick={() => window.location.reload()} className="border px-5 py-2 text-sm tracking-widest" style={{ borderColor: accent }}>
            RECHARGER
          </button>
        </div>
      )}
    </div>
  );
}
