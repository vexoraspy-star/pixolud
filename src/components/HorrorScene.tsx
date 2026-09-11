"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  buildManor,
  roomAt,
  floorHeightAt,
  MANOR_ITEMS,
  CLUE_SPOTS,
  CODE_LENGTH,
  SEALS,
  CAVE_DOOR,
  ALTAR,
  HATCH,
  UPPER_Y,
  STAIR_X0,
  STAIR_X1,
  STAIR_ROW_FIRST,
  STAIR_ROW_LAST,
  type ManorItemDef,
  type ManorProp,
} from "@/lib/manor";
import { cellKey } from "@/lib/maze";
import { buildMonster, poseMonster } from "@/lib/manorMonster";
import Game3DSettings from "./Game3DSettings";
import {
  loadBrightness3D,
  loadLayout3D,
  loadSensitivity3D,
  loadVoice3D,
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
} from "@/lib/manorAudio";
import { createNarrator, type Narrator } from "@/lib/voice";

const CELL_SIZE = 1.7;
const EYE_HEIGHT = 1.5;
const PLAYER_RADIUS = 0.26;
const MOVE_SPEED = 2.6;
const BASE_LOOK_SENSITIVITY = 0.0038;
const ITEM_COUNT = MANOR_ITEMS.length;
const MONSTER_SPEED_BASE = 1.55;
const MONSTER_SPEED_HUNTING = 2.05;
const MONSTER_HUNT_RADIUS = 12;
const CAPTURE_RADIUS = 0.55;
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
// Les armoires occupent leur case, donc on s'en approche par le cote : la
// portee doit couvrir la demi-largeur du meuble plus une case.
const HIDE_REACH = 2.2;
/** Combien de temps cachee avant qu'elle perde ta trace. */
const HIDE_LOSE_SECONDS = 4;
/** Piles de rechange a trouver dans le manoir. */
const BATTERY_COUNT = 4;
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
  /** Phrase lue par le narrateur a l'ouverture de l'acte. */
  line?: string;
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
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
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

/** Chaque meuble est une petite pile de boites : une seule InstancedMesh les rend toutes. */
interface BoxEntry {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: number;
}

function buildPropBoxes(p: ManorProp): BoxEntry[] {
  const cx = ((p.x0 + p.x1) / 2 + 0.5) * CELL_SIZE;
  const cz = ((p.y0 + p.y1) / 2 + 0.5) * CELL_SIZE;
  const baseY = floorHeightAt((p.y0 + p.y1) / 2 + 0.5);
  const w = (p.x1 - p.x0 + 1) * CELL_SIZE * 0.84;
  const d = (p.y1 - p.y0 + 1) * CELL_SIZE * 0.84;
  const dark = p.tint ?? 0x33240f;
  const mid = 0x54401d;
  const cloth = 0x4a2620;
  const out: BoxEntry[] = [];
  const box = (
    dx: number,
    y: number,
    dz: number,
    bw: number,
    bh: number,
    bd: number,
    color: number,
  ) => out.push({ x: cx + dx, y: baseY + y, z: cz + dz, w: bw, h: bh, d: bd, color });

  switch (p.kind) {
    case "shelf": {
      box(0, 0.95, 0, w, 1.9, d * 0.5, dark);
      for (let i = 0; i < 3; i++) {
        box(0, 0.45 + i * 0.5, d * 0.12, w * 0.9, 0.05, d * 0.34, mid);
      }
      break;
    }
    case "table": {
      box(0, 0.74, 0, w, 0.08, d, mid);
      const lx = w / 2 - 0.12;
      const lz = d / 2 - 0.12;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          box(sx * lx, 0.35, sz * lz, 0.09, 0.7, 0.09, dark);
        }
      }
      break;
    }
    case "seat": {
      box(0, 0.42, 0, w, 0.12, d, cloth);
      box(0, 0.68, -d / 2 + 0.08, w, 0.52, 0.12, dark);
      const lx = w / 2 - 0.1;
      const lz = d / 2 - 0.1;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          box(sx * lx, 0.18, sz * lz, 0.07, 0.36, 0.07, dark);
        }
      }
      break;
    }
    case "bed": {
      box(0, 0.22, 0, w, 0.44, d, dark);
      box(0, 0.52, 0.06, w * 0.94, 0.18, d * 0.92, 0x6d5f4c);
      box(0, 0.9, -d / 2 + 0.06, w, 0.95, 0.12, dark);
      box(0, 0.66, -d / 2 + 0.34, w * 0.55, 0.12, d * 0.16, 0x8d8272);
      break;
    }
    case "crate": {
      box(0, 0.32, 0, w * 0.9, 0.64, d * 0.9, mid);
      box(0.06, 0.86, -0.05, w * 0.62, 0.44, d * 0.62, dark);
      break;
    }
    case "fireplace": {
      box(0, 0.75, 0, w, 1.5, d * 0.45, 0x3a3733);
      box(0, 0.5, d * 0.12, w * 0.55, 0.9, d * 0.3, 0x0a0806);
      box(0, 1.36, d * 0.1, w * 1.08, 0.14, d * 0.6, mid);
      break;
    }
    case "piano": {
      box(0, 0.5, 0, w, 0.7, d, 0x161009);
      box(0, 0.88, -d * 0.08, w * 0.98, 0.07, d * 0.8, 0x241a10);
      box(0, 0.78, d * 0.3, w * 0.8, 0.06, d * 0.22, 0xcfc6b4);
      for (const sx of [-1, 1]) box(sx * (w / 2 - 0.14), 0.22, 0, 0.12, 0.44, 0.12, 0x161009);
      break;
    }
    case "railing": {
      box(0, 0.98, 0, w, 0.08, 0.09, mid);
      const posts = Math.max(2, Math.round(w / 0.42));
      for (let i = 0; i <= posts; i++) {
        box(-w / 2 + (i * w) / posts, 0.5, 0, 0.06, 0.92, 0.06, dark);
      }
      break;
    }
    case "altar": {
      const stone = 0x3d3a35;
      box(0, 0.16, 0, w * 0.95, 0.32, d * 0.95, 0x2a2724);
      box(0, 0.52, 0, w * 0.8, 0.42, d * 0.8, stone);
      box(0, 0.78, 0, w, 0.12, d, 0x4a4640);
      // deux chandeliers de pierre aux extremites
      for (const sx of [-1, 1]) {
        box(sx * (w / 2 - 0.22), 0.98, 0, 0.13, 0.3, 0.13, stone);
      }
      break;
    }
  }
  return out;
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
}: {
  seed: number;
  onCaught: () => void;
  onEscape: () => void;
}) {
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
  const [hidden, setHidden] = useState(false);
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
  const heldRef = useRef({ forward: false, back: false, left: false, right: false });
  const endedRef = useRef(false);
  const pausedRef = useRef(false);
  const narratorRef = useRef<Narrator | null>(null);
  const keypadOpenRef = useRef(false);
  const codeRef = useRef<number[]>([]);
  const apiRef = useRef<{
    unlock: () => void;
    deny: () => void;
    applyBrightness: (value: number) => void;
    /** Les memes actions que E et F, pour les boutons tactiles. */
    interact: () => void;
    toggleFlashlight: () => void;
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
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!endedRef.current && !pausedRef.current) setSeconds((s) => s + 1);
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

    function isSolid(cx: number, cy: number): boolean {
      if (cx < 0 || cy < 0 || cx >= data.width || cy >= data.height) return true;
      const k = cellKey(cx, cy);
      if (wallSet.has(k) || propSet.has(k)) return true;
      return doorLocked && doorCells.has(k);
    }

    const openCells: [number, number][] = [];
    for (let y = 0; y < data.height; y++) {
      for (let x = 0; x < data.width; x++) {
        if (!isSolid(x, y)) openCells.push([x, y]);
      }
    }

    const start = data.start ?? [1, 1];
    const end = data.end ?? [data.width - 2, data.height - 2];

    // Le joueur regarde vers l'escalier en arrivant (la piece maitresse).
    const player = { x: start[0] + 0.5, z: start[1] + 0.5, yaw: Math.PI, pitch: 0 };

    // --- Code de la cave : 3 chiffres tires au sort, un indice par piece ---
    const code = CLUE_SPOTS.map(() => 1 + Math.floor(Math.random() * 9));
    codeRef.current = code;

    // --- Objets a collecter (jamais dans la cave, elle est verrouillee) ---
    const caveRoom = data.rooms.find((r) => r.name === "Cave")!;
    const candidateCells = openCells.filter(([x, y]) => {
      if (Math.abs(x - start[0]) + Math.abs(y - start[1]) <= 4) return false;
      const inCave = x >= caveRoom.x0 && x <= caveRoom.x1 && y >= caveRoom.y0 && y <= caveRoom.y1;
      return !inCave;
    });
    const itemCells: [number, number][] = [];
    const pool = [...candidateCells];
    for (let i = 0; i < ITEM_COUNT && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      itemCells.push(pool[idx]);
      pool.splice(idx, 1);
    }
    const shuffledItemDefs = [...MANOR_ITEMS].sort(() => Math.random() - 0.5);

    // --- Monstre : la case ouverte la plus eloignee du joueur ---
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
      active: false,
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    const propBoxes: BoxEntry[] = [];
    for (const p of data.props) propBoxes.push(...buildPropBoxes(p));
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
      { x: 13, wallRow: 26, room: "Palier" },
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
      const light = new THREE.PointLight(0x7fd4ff, 1.5 * brightness, 6 * CELL_SIZE, 2);
      light.position.y = 1.3;
      group.add(light);
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
        light,
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

    // --- Piles de rechange : la lampe devient une ressource a gerer ---
    const batteryCells: [number, number][] = [];
    const batteryPool = candidateCells.filter(
      ([x, y]) => !itemCells.some(([ix, iy]) => ix === x && iy === y),
    );
    for (let i = 0; i < BATTERY_COUNT && batteryPool.length > 0; i++) {
      const idx = Math.floor(Math.random() * batteryPool.length);
      batteryCells.push(batteryPool[idx]);
      batteryPool.splice(idx, 1);
    }
    const batteryGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.2, 8);
    const batteryMat = new THREE.MeshBasicMaterial({ color: 0x86e57f });
    const batteries = batteryCells.map(([bx, by]) => {
      const mesh = new THREE.Mesh(batteryGeo, batteryMat);
      mesh.position.set((bx + 0.5) * CELL_SIZE, floorHeightAt(by + 0.5) + 0.95, (by + 0.5) * CELL_SIZE);
      scene.add(mesh);
      return { x: bx + 0.5, z: by + 0.5, mesh, taken: false };
    });

    // --- Cachettes : les armoires des pieces, ou l'on peut se glisser ---
    const hideouts = data.props
      .filter((p) => p.kind === "shelf")
      .map((p) => ({
        x: (p.x0 + p.x1) / 2 + 0.5,
        z: (p.y0 + p.y1) / 2 + 0.5,
      }));

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
    const narrator = createNarrator(loadVoice3D());
    narratorRef.current = narrator;
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
    let phase: Phase = "none";
    let isHiding = false;
    let hidingSince = 0;
    let beforeHide = { x: 0, z: 0 };
    let lastQuestId = "";
    let lastQuestWhere: string | null = null;
    let actCardHideAt = -1;
    let torchFlicker = 1;

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

    apiRef.current = {
      applyBrightness,
      interact,
      toggleFlashlight,
      unlock: () => {
        if (!doorLocked) return;
        doorLocked = false;
        setDoorOpen(true);
        playUnlock(audio.ctx, audio.master);
        showHint("La porte de la cave s'ouvre en grinçant.", 4);
        narratorRef.current?.say("La cave est ouverte. Rien ne t'attend en bas. Rien de vivant.");
      },
      deny: () => playDenied(audio.ctx, audio.master),
    };

    function circleHitsWall(px: number, pz: number): boolean {
      const minX = Math.floor(px - PLAYER_RADIUS);
      const maxX = Math.floor(px + PLAYER_RADIUS);
      const minZ = Math.floor(pz - PLAYER_RADIUS);
      const maxZ = Math.floor(pz + PLAYER_RADIUS);
      for (let cx = minX; cx <= maxX; cx++) {
        for (let cz = minZ; cz <= maxZ; cz++) {
          if (!isSolid(cx, cz)) continue;
          const closestX = Math.max(cx, Math.min(px, cx + 1));
          const closestZ = Math.max(cz, Math.min(pz, cz + 1));
          const dx = px - closestX;
          const dz = pz - closestZ;
          if (dx * dx + dz * dz < PLAYER_RADIUS * PLAYER_RADIUS) return true;
        }
      }
      return false;
    }
    function resolveCollision(nx: number, nz: number): [number, number] {
      let x = player.x;
      let z = player.z;
      if (!circleHitsWall(nx, z)) x = nx;
      if (!circleHitsWall(x, nz)) z = nz;
      return [x, z];
    }

    function applyLook(dx: number, dy: number) {
      if (keypadOpenRef.current) return;
      const s = BASE_LOOK_SENSITIVITY * sensitivityRef.current;
      player.yaw -= dx * s;
      player.pitch = THREE.MathUtils.clamp(player.pitch - dy * s, -0.7, 0.7);
    }
    function onCanvasClick() {
      if (keypadOpenRef.current) return;
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
    renderer.domElement.addEventListener("click", onCanvasClick);
    document.addEventListener("mousemove", onMouseMove);

    let dragging = false;
    let lastDragX = 0;
    let lastDragY = 0;
    function onPointerDown(e: PointerEvent) {
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
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);
    renderer.domElement.addEventListener("contextmenu", onContextMenu);

    const flashlightState = { on: true, battery: 100 };
    function toggleFlashlight() {
      if (!flashlightState.on && flashlightState.battery < 8) return;
      flashlightState.on = !flashlightState.on;
      setFlashlightOn(flashlightState.on);
    }

    /** Distance (en cases) du joueur a la porte de la cave. */
    function distanceToDoor() {
      return Math.hypot(player.x - doorCenter.x, player.z - doorCenter.z);
    }
    function distanceToAltar() {
      return Math.hypot(player.x - altarCenter.x, player.z - altarCenter.z);
    }
    function nearestHideout() {
      let best: { x: number; z: number } | null = null;
      let bestD = HIDE_REACH;
      for (const h of hideouts) {
        const d = Math.hypot(player.x - h.x, player.z - h.z);
        if (d < bestD) {
          bestD = d;
          best = h;
        }
      }
      return best;
    }
    /** Se glisser dans une armoire : elle ne peut plus t'attraper. */
    function toggleHide() {
      // Sortir reste toujours possible, quelle que soit la phase : sinon se
      // cacher pendant le rituel bloquait la partie pour de bon.
      if (isHiding) {
        isHiding = false;

        player.x = beforeHide.x;
        player.z = beforeHide.z;
        setHidden(false);
        return;
      }
      // On peut encore se cacher pendant la course aux sceaux : c'est une
      // vraie tactique, qui coute du temps mais pas la partie. Interdit en
      // revanche pendant la survie et la fuite, qui sont chronometrees.
      if (phase !== "none" && phase !== "seals") return;
      const spot = nearestHideout();
      if (!spot) return;
      beforeHide = { x: player.x, z: player.z };

      isHiding = true;
      hidingSince = elapsed;
      player.x = spot.x;
      player.z = spot.z;
      setHidden(true);
      showHint("Cachée. Reste immobile et attends qu'Elle s'éloigne.", 3.5);
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
          line: "La trappe est ouverte. Cours.",
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
          line: "La trappe s'ouvre. Quarante-cinq secondes. Ne t'arrête pas.",
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
          line: "Trois sceaux verrouillent la trappe. Brise-les. Elle te cherche déjà.",
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
          line: "Les reliques s'élèvent. Quelque chose se réveille sous la pierre.",
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
          line: "Tu as les chiffres. La cave t'attend.",
        };
      }
      if (collectedCount < ITEM_COUNT) {
        return {
          id: "reliques",
          act: "Acte III",
          title: "Les cinq reliques",
          detail: "Chaque relique volée la rend plus rapide, et souffle une bougie.",
          where: "Partout, sauf la cave",
          mood: "calme",
          line: "Cinq reliques dorment dans le manoir. Chacune la rendra plus rapide.",
        };
      }
      return {
        id: "autel",
        act: "Acte III",
        title: "L'autel",
        detail: "Dépose les cinq reliques sur la pierre.",
        where: "Au centre de la cave",
        mood: "rituel",
        line: "Tout est là. Descends à la cave, et pose-les sur l'autel.",
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
        s.light.visible = false;
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
      if (doorLocked && distanceToDoor() < DOOR_REACH) {
        try {
          document.exitPointerLock?.();
        } catch {
          // ignore
        }
        keys.clear();
        setKeypadOpen(true);
      } else if (canOfferAtAltar()) {
        startRitual();
      } else if (isHiding || nearestHideout()) {
        toggleHide();
      }
    }

    const keys = new Set<string>();
    function onKeyDown(e: KeyboardEvent) {
      if (keypadOpenRef.current) {
        if (e.key === "Escape") setKeypadOpen(false);
        return;
      }
      keys.add(e.key.toLowerCase());
      if (e.key === "Shift") {
        if (document.pointerLockElement === renderer.domElement) document.exitPointerLock?.();
        else {
          try {
            renderer.domElement.requestPointerLock?.()?.catch(() => {});
          } catch {
            // ignore
          }
        }
      }
      if (e.key.toLowerCase() === "f") toggleFlashlight();
      if (e.key.toLowerCase() === "e") interact();
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
      dragging = false;
    }
    function onBlur() {
      releaseEverything();
    }
    // L'onglet passe en arriere-plan : on gele la partie et on coupe le son.
    // Sinon la chose continue de te traquer pendant que tu regardes ailleurs.
    function onVisibility() {
      const away = document.hidden;
      pausedRef.current = away;
      setPaused(away);
      if (away) {
        releaseEverything();
        narrator.stop();
        audio.ctx.suspend().catch(() => {});
      } else {
        lastTime = performance.now();
        audio.ctx.resume().catch(() => {});
      }
    }
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);

    let ended = false;
    let lastTime = performance.now();
    let batteryUiTimer = 0;

    function tick() {
      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      if (ended || pausedRef.current) {
        renderer.render(scene, camera);
        return;
      }
      elapsed += delta;

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
      if (fwd !== 0 || strafe !== 0) {
        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw);
        const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw);
        const move = new THREE.Vector3().addScaledVector(forward, fwd).addScaledVector(right, strafe);
        if (move.lengthSq() > 0) {
          move.normalize().multiplyScalar(MOVE_SPEED * delta);
          const [nx, nz] = resolveCollision(player.x + move.x, player.z + move.z);
          player.x = nx;
          player.z = nz;
        }
      }

      const moving = fwd !== 0 || strafe !== 0;
      const playerFloor = floorHeightAt(player.z);
      camera.position.set(player.x * CELL_SIZE, playerFloor + EYE_HEIGHT, player.z * CELL_SIZE);
      camera.rotation.y = player.yaw;
      camera.rotation.x = player.pitch;
      camera.rotation.z = 0;

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

      // Pas + grincements de marches.
      if (moving && elapsed >= nextFootstepAt) {
        playFootstep(audio.ctx, audio.master);
        nextFootstepAt = elapsed + 0.44;
        const onStairs = player.z > STAIR_ROW_FIRST && player.z < STAIR_ROW_LAST + 1;
        if (onStairs && elapsed >= nextCreakAt) {
          playStairCreak(audio.ctx, audio.master);
          nextCreakAt = elapsed + 0.9 + Math.random();
        }
      }

      walkPhase += moving ? delta * 8.5 : 0;
      handGroup.position.set(
        HAND_BASE.x + (moving ? Math.sin(walkPhase) * 0.014 : 0),
        HAND_BASE.y + (moving ? Math.abs(Math.cos(walkPhase)) * 0.016 : 0),
        HAND_BASE.z,
      );

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
      const torchOn = flashlightState.on && flashlightState.battery > 0;
      // La poussiere n'existe que dans le faisceau. Laissee visible lampe
      // eteinte, elle remplissait le noir de points blancs et noyait la
      // seule chose qu'on doit y voir : ses yeux.
      dustMat.opacity = torchOn ? 0.34 * torchFlicker : 0.04;
      flashlight.visible = torchOn;
      flashlight.intensity = 6.5 * brightness * torchFlicker;
      torchLens.visible = torchOn && torchFlicker > 0.5;
      playerGlow.intensity = (torchOn ? glowOnIntensity : glowOffIntensity) * (0.4 + torchFlicker * 0.6);
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
          narrator.say(`${plaque.digit}. Position ${plaque.rank + 1}.`);
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
          scene.remove(item.group);
          playPickup(audio.ctx, audio.master);
          setItemsFound((n) => n + 1);
          setRelics((r) => [...r, item.def]);
          setToast(item.def);
          toastHideAt = elapsed + TOAST_SECONDS;
          narrator.say(
            collectedCount === ITEM_COUNT
              ? "La dernière. Le manoir le sait déjà."
              : `${item.def.name}. Il en reste ${ITEM_COUNT - collectedCount}.`,
          );
          if (collectedCount === 1) awakenMonster();
          if (collectedCount === ITEM_COUNT) {
            // Avec les 5 objets elle court plus vite que toi lampe allumee :
            // sans cet avertissement, la mecanique reste invisible.
            window.setTimeout(
              () => showHint("Elle est plus rapide que toi. Éteins ta lampe (F) pour la semer.", 6),
              1400,
            );
          }
          // Le manoir souffle une bougie a chaque objet vole : plus tu
          // avances, moins tu vois.
          const doomed = sconces[candlesOut];
          if (doomed) {
            doomed.dead = true;
            doomed.light.visible = false;
            doomed.flame.visible = false;
            candlesOut++;
            window.setTimeout(() => playCandleOut(audio.ctx, audio.master), 420);
          }
        }
      }

      // Piles de rechange.
      for (const b of batteries) {
        if (b.taken) continue;
        b.mesh.rotation.y += delta * 2;
        if (Math.hypot(player.x - b.x, player.z - b.z) < 0.45) {
          b.taken = true;
          scene.remove(b.mesh);
          flashlightState.battery = Math.min(100, flashlightState.battery + BATTERY_RESTORE);
          playPickup(audio.ctx, audio.master);
          showHint("🔋 Pile de rechange (+45 %)", 2.6);
        }
      }

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
          if (nextQuest.line) {
            narrator.say(nextQuest.line, { urgent: nextQuest.mood === "danger" });
          }
        }
      }
      if (actCardHideAt >= 0 && elapsed > actCardHideAt) {
        actCardHideAt = -1;
        setActCard(null);
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
      if (isHiding) {
        promptText = "E — Sortir de la cachette";
      } else if (doorLocked && distanceToDoor() < DOOR_REACH) {
        promptText = "E — Examiner la serrure";
      } else if (canOfferAtAltar()) {
        promptText = "E — Déposer les 5 objets";
      } else if (phase === "none" && !doorLocked && distanceToAltar() < ALTAR_REACH) {
        const missing = ITEM_COUNT - collectedCount;
        promptText = `Il manque ${missing} objet${missing > 1 ? "s" : ""} sur l'autel`;
      } else if ((phase === "none" || phase === "seals") && nearestHideout()) {
        promptText = "E — Se cacher";
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
        // Cache depuis assez longtemps : elle perd ta trace et part fouiller
        // ailleurs. C'est ce qui rend l'armoire vraiment utile.
        const lostYou = isHiding && elapsed - hidingSince > HIDE_LOSE_SECONDS;
        let moved = false;
        monster.repathTimer -= delta;
        if (monster.repathTimer <= 0) {
          monster.repathTimer = REPATH_INTERVAL;
          const from: [number, number] = [Math.floor(monster.x), Math.floor(monster.z)];
          let target: [number, number] = [Math.floor(player.x), Math.floor(player.z)];
          if (lostYou) {
            const wander = openCells[Math.floor(Math.random() * openCells.length)];
            target = [wander[0], wander[1]];
          } else if (isHiding) {
            // Elle se dirige vers l'endroit ou tu etais avant de te cacher.
            target = [Math.floor(beforeHide.x), Math.floor(beforeHide.z)];
          }
          monster.path = bfsPath(from, target, isSolid, data.width, data.height);
          monster.pathIndex = 0;
        }
        const distToPlayerCells = Math.abs(monster.x - player.x) + Math.abs(monster.z - player.z);
        const hunting = flashlightState.on && distToPlayerCells < MONSTER_HUNT_RADIUS;
        // Chaque objet vole la rend plus rapide ; pendant la fuite finale,
        // elle est plus rapide que toi.
        // Pendant les sceaux et la survie elle est un peu plus lente que toi :
        // fuir marche, s'arreter non. Lampe eteinte, elle perd encore du
        // terrain — c'est le seul levier qui te reste dans le final.
        const finaleBase =
          phase === "escape"
            ? MONSTER_SPEED_FINALE
            : phase === "survive"
              ? MONSTER_SPEED_SURVIVE
              : phase === "seals"
                ? MONSTER_SPEED_SEALS
                : 0;
        const speed =
          finaleBase > 0
            ? finaleBase - (flashlightState.on || phase === "escape" ? 0 : DARK_SPEED_BONUS)
            : (hunting ? MONSTER_SPEED_HUNTING : MONSTER_SPEED_BASE) +
              collectedCount * SPEED_PER_ITEM;

        // Ses pas, sa respiration, ses chuchotements : tous places dans
        // l'espace. C'est ce qui rend la traque insupportable.
        if (elapsed >= nextMonsterStepAt && distToMonster < 13) {
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
        if (!held && monster.path && monster.pathIndex < monster.path.length) {
          const [tx, ty] = monster.path[monster.pathIndex];
          const targetX = tx + 0.5;
          const targetZ = ty + 0.5;
          const dx = targetX - monster.x;
          const dz = targetZ - monster.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.08) {
            monster.pathIndex++;
          } else {
            const stepX = (dx / dist) * speed * delta;
            const stepZ = (dz / dist) * speed * delta;
            monster.x += stepX;
            monster.z += stepZ;
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
        monsterGroup.rotation.set(0, bodyYaw, 0);

        // Elle se ramasse quand elle est SUR toi, pas des qu'elle approche :
        // reservee au dernier metre et demi, la pose de saisie garde sa force.
        const lungeTarget = distToMonster < 1.5 && !held ? 1 - distToMonster / 1.5 : 0;
        lungeLevel += (lungeTarget - lungeLevel) * Math.min(1, delta * 5);

        // Lacet vers le joueur, exprime dans le repere du corps.
        let headYaw = Math.atan2(player.x - monster.x, player.z - monster.z) - bodyYaw;
        while (headYaw > Math.PI) headYaw -= Math.PI * 2;
        while (headYaw < -Math.PI) headYaw += Math.PI * 2;
        poseMonster(beast, {
          time: elapsed,
          walk: monsterWalk,
          speed: moved ? speed : 0,
          headYaw,
          headPitch: THREE.MathUtils.clamp((EYE_HEIGHT - 2.1) / Math.max(1, distToMonster), -0.5, 0.7),
          lunge: lungeLevel,
        });

        const capDx = monster.x - player.x;
        const capDz = monster.z - player.z;
        if (!held && !isHiding && capDx * capDx + capDz * capDz < CAPTURE_RADIUS * CAPTURE_RADIUS) {
          dyingSince = elapsed;
          endedRef.current = true;
          flashLevel = 1;
          setScareFlash(1);
          setKeypadOpen(false);
          narrator.stop();
          playDeathScream(audio.ctx, audio.master);
          try {
            document.exitPointerLock?.();
          } catch {
            // ignore
          }
        } else if (distToPlayerCells < NEAR_MISS_RADIUS && elapsed >= nextNearMissAllowedAt) {
          nextNearMissAllowedAt = elapsed + NEAR_MISS_COOLDOWN;
          flashLevel = Math.max(flashLevel, 0.7);
          playNearMiss(audio.ctx, audio.master);
        }

        const proximity = THREE.MathUtils.clamp(1 - distToPlayerCells / 14, 0, 1);
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
      const target = Math.min(
        1,
        Math.max(proximityDread, progressDread, phase === "none" || phase === "ritual" ? 0 : 1),
      );
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
        camera.rotation.z = Math.sin(elapsed * 9.1) * shake;
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
          for (const s of seals) s.group.visible = true;
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
          s.light.intensity = (1.2 + Math.sin(elapsed * 5.5) * 0.35) * brightness;
          if (Math.hypot(player.x - s.x, player.z - s.z) >= SEAL_REACH) continue;
          s.broken = true;
          s.light.visible = false;
          s.glowMat.color.setHex(0x2b2724);
          const left = seals.filter((k) => !k.broken).length;
          setSealsLeft(left);
          hatchChains[left]?.scale.set(1, 0.001, 1);
          playSealBreak(audio.ctx, audio.master, left);
          flashLevel = Math.max(flashLevel, 0.65);
          if (left > 0) {
            showHint(`Sceau brisé. Encore ${left}.`, 3);
            narrator.say(left === 1 ? "Encore un." : `Encore ${left} sceaux.`);
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
          if (shown === 30) narrator.say("Trente secondes.");
          if (shown === HATCH_HINT_SECONDS) {
            narrator.say("Redescends vers la cave. Maintenant.", { urgent: true });
            showHint("Reviens vers la trappe : elle s'ouvre dans quelques secondes.", 4);
          }
          if (shown === 5) narrator.say("Cinq secondes.", { urgent: true });
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
          narrator.stop();
          onEscape();
        }
      }

      renderer.render(scene, camera);
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
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      renderer.domElement.removeEventListener("contextmenu", onContextMenu);
      renderer.domElement.removeEventListener("click", onCanvasClick);
      document.removeEventListener("mousemove", onMouseMove);
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock?.();
      apiRef.current = null;
      narrator.stop();
      narratorRef.current = null;
      audio.stop();
      audio.ctx.close().catch(() => {});
      beast.dispose();
      dustGeo.dispose();
      dustMat.dispose();
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

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-black select-none">
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

      {/* Grain de pellicule : il monte avec l'angoisse. C'est lui qui empeche
          l'image d'etre « propre », et une image propre n'a jamais fait peur. */}
      {grain && (
        <div
          className="pointer-events-none absolute -inset-[10%] mix-blend-overlay"
          style={{
            backgroundImage: `url(${grain})`,
            backgroundRepeat: "repeat",
            opacity: 0.1 + dread * 0.16,
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

      <Game3DSettings
        className="top-14"
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
        onVoice={(v) => narratorRef.current?.setEnabled(v)}
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
      </div>

      {/* Vue depuis l'armoire : on regarde par l'entrebaillement des portes. */}
      {hidden && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-y-0 left-0 w-[34%] bg-black" />
          <div className="absolute inset-y-0 right-0 w-[34%] bg-black" />
          <div className="absolute inset-x-0 top-0 h-[12%] bg-black" />
          <div className="absolute inset-x-0 bottom-0 h-[12%] bg-black" />
          <span className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/80 px-3 py-1 text-xs font-semibold text-zinc-300">
            🚪 Cachée
          </span>
        </div>
      )}

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
            <TapButton
              label="🔦"
              accent={mood.accent}
              onTap={() => apiRef.current?.toggleFlashlight()}
            />
            <TapButton
              label="E"
              accent={mood.accent}
              highlight={Boolean(prompt)}
              onTap={() => apiRef.current?.interact()}
            />
          </div>
        </>
      )}

      {!isTouch && (
        <p className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-zinc-600">
          ZQSD · souris pour regarder · F lampe · E interagir et se cacher · ramasse les piles 🔋
        </p>
      )}

      {/* Onglet en arriere-plan : la partie est gelee, pas perdue. */}
      {paused && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-black/90">
          <span className="font-serif text-2xl text-zinc-300">Le manoir attend</span>
          <span className="text-xs text-zinc-500">Reviens sur l&apos;onglet pour reprendre.</span>
        </div>
      )}
    </div>
  );
}
