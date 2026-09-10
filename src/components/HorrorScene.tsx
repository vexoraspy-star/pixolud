"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  buildManor,
  roomAt,
  floorHeightAt,
  MANOR_ITEMS,
  CLUE_SPOTS,
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
import {
  loadBrightness3D,
  loadLayout3D,
  loadSensitivity3D,
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
  makeMonsterFaceTexture,
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
} from "@/lib/manorAudio";

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
const MONSTER_GRACE_SECONDS_IDLE = 75;
const PAINTING_FALL_SECONDS = 0.55;
const CEILING_HEIGHT = 2.6;
const DOOR_REACH = 2.4;
const CLUE_REACH = 1.7;
const ALTAR_REACH = 2.3;
const HATCH_REACH = 0.9;
/** Duree du screamer avant l'ecran de mort. */
const DEATH_SEQUENCE_SECONDS = 1.45;
/** Chaque objet ramasse rend la chose plus rapide et le manoir plus sombre. */
const SPEED_PER_ITEM = 0.13;
/** Le rituel sur l'autel, avant la course finale. */
const RITUAL_SECONDS = 4.2;
/** Pendant la fuite finale, elle court plus vite que toi : ne t'arrete pas. */
const MONSTER_SPEED_FINALE = 2.95;
/** Elle reste figee pendant le rituel, puis marque un temps avant de bondir. */
const CHASE_RELEASE_SECONDS = 0.9;
const LOS_INTERVAL = 0.22;

interface Clue {
  rank: number;
  digit: number;
  room: string;
}

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
  const [finale, setFinale] = useState<"none" | "ritual" | "chase">("none");

  const layoutRef = useRef<Layout>("azerty");
  const sensitivityRef = useRef(1.5);
  const heldRef = useRef({ forward: false, back: false });
  const endedRef = useRef(false);
  const keypadOpenRef = useRef(false);
  const codeRef = useRef<number[]>([]);
  const apiRef = useRef<{ unlock: () => void; deny: () => void } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      layoutRef.current = loadLayout3D();
      sensitivityRef.current = loadSensitivity3D();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!endedRef.current) setSeconds((s) => s + 1);
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

    const brightness = loadBrightness3D();
    // Lumiere d'ambiance (bon marche : aucune ombre a calculer). C'est elle
    // qui evite le noir total dans les pieces sans bougie.
    scene.add(new THREE.HemisphereLight(0x6a6478, 0x231c12, 1.3 * brightness));

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

    const glowOnIntensity = 0.85 * brightness;
    const glowOffIntensity = 0.32 * brightness;
    const playerGlow = new THREE.PointLight(0xffd9a8, glowOnIntensity, 4.5 * CELL_SIZE, 2);
    scene.add(playerGlow);

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

    // --- Monstre ---
    const monsterGroup = new THREE.Group();
    const monsterMat = new THREE.MeshLambertMaterial({ color: 0x08070a });
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.55, 9), monsterMat);
    robe.position.y = 0.76;
    monsterGroup.add(robe);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.44, 4, 8), monsterMat);
    torso.position.y = 1.55;
    monsterGroup.add(torso);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 12), monsterMat);
    hood.position.y = 1.94;
    hood.scale.set(1, 1.16, 1.05);
    monsterGroup.add(hood);
    // Le visage : plan non eclaire, il "brille" faiblement dans le noir.
    const faceMat = new THREE.MeshBasicMaterial({
      map: makeMonsterFaceTexture(),
      transparent: true,
      depthWrite: false,
    });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.42), faceMat);
    // Juste devant la surface de la capuche (rayon 0.27 x 1.05) : plus pres,
    // le visage serait enferme dans la sphere et invisible.
    face.position.set(0, 1.95, 0.3);
    monsterGroup.add(face);
    const armGroups: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const armGroup = new THREE.Group();
      armGroup.position.set(side * 0.3, 1.62, 0);
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.5, 4, 6), monsterMat);
      upper.position.y = -0.28;
      armGroup.add(upper);
      const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.44, 4, 6), monsterMat);
      fore.position.set(0, -0.72, 0.1);
      fore.rotation.x = -0.5;
      armGroup.add(fore);
      for (let f = 0; f < 3; f++) {
        const claw = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.18, 3, 4), monsterMat);
        claw.position.set((f - 1) * 0.035, -0.99, 0.26);
        claw.rotation.x = -0.75;
        armGroup.add(claw);
      }
      armGroup.rotation.z = side * 0.2;
      monsterGroup.add(armGroup);
      armGroups.push(armGroup);
    }
    monsterGroup.position.set(monster.x * CELL_SIZE, 0, monster.z * CELL_SIZE);
    monsterGroup.visible = false;
    scene.add(monsterGroup);

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
    let candlesOut = 0;
    let ritualStartedAt = -1;
    let chaseStartedAt = -1;
    let phase: "none" | "ritual" | "chase" = "none";
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

    apiRef.current = {
      unlock: () => {
        if (!doorLocked) return;
        doorLocked = false;
        setDoorOpen(true);
        playUnlock(audio.ctx, audio.master);
        showHint("La porte de la cave s'ouvre en grinçant.", 4);
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
      showHint("Les objets s'élèvent. Quelque chose se réveille en dessous.", 4.5);
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
      if (e.key.toLowerCase() === "e") {
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
        }
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      keys.delete(e.key.toLowerCase());
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    let ended = false;
    let lastTime = performance.now();
    let batteryUiTimer = 0;

    function tick() {
      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      if (ended) {
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
        const targetDist = THREE.MathUtils.lerp(1.9, 0.42, rush);
        monsterGroup.position.set(
          (player.x + dirToPlayer.x * targetDist) * CELL_SIZE,
          floorHeightAt(player.z) + THREE.MathUtils.lerp(0, 0.35, rush),
          (player.z + dirToPlayer.z * targetDist) * CELL_SIZE,
        );
        // Il est place devant la camera : pour nous faire face, son +Z doit
        // pointer vers le joueur, ce qui correspond exactement au lacet du joueur.
        monsterGroup.rotation.set(0, player.yaw, Math.sin(elapsed * 26) * 0.06 * (1 - t));
        monsterGroup.scale.setScalar(THREE.MathUtils.lerp(1, 1.5, rush));
        face.scale.setScalar(THREE.MathUtils.lerp(1, 1.35, rush));
        const shake = 0.05 * (1 - t);
        camera.rotation.y = player.yaw + (Math.random() - 0.5) * shake * 3;
        camera.rotation.x = player.pitch + (Math.random() - 0.5) * shake * 3;
        camera.rotation.z = (Math.random() - 0.5) * shake * 2;
        if (t >= 1) {
          ended = true;
          endedRef.current = true;
          onCaught();
        }
        renderer.render(scene, camera);
        return;
      }

      const blockedByUi = keypadOpenRef.current;
      const forwardKey = layoutRef.current === "azerty" ? "z" : "w";
      const leftKey = layoutRef.current === "azerty" ? "q" : "a";
      let fwd = 0;
      let strafe = 0;
      if (!blockedByUi) {
        if (keys.has(forwardKey) || keys.has("arrowup") || heldRef.current.forward) fwd += 1;
        if (keys.has("s") || keys.has("arrowdown") || heldRef.current.back) fwd -= 1;
        if (keys.has(leftKey) || keys.has("arrowleft")) strafe -= 1;
        if (keys.has("d") || keys.has("arrowright")) strafe += 1;
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
          setToast(item.def);
          toastHideAt = elapsed + TOAST_SECONDS;
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

      // Invite d'interaction.
      let promptText: string | null = null;
      if (doorLocked && distanceToDoor() < DOOR_REACH) {
        promptText = "E — Examiner la serrure";
      } else if (canOfferAtAltar()) {
        promptText = "E — Déposer les 5 objets";
      } else if (phase === "none" && !doorLocked && distanceToAltar() < ALTAR_REACH) {
        const missing = ITEM_COUNT - collectedCount;
        promptText = `Il manque ${missing} objet${missing > 1 ? "s" : ""} sur l'autel`;
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
          monsterGroup.rotation.set(0, Math.atan2(player.x - gx, player.z - gz), 0);
          monsterGroup.visible = true;
          glimpseUntil = elapsed + 0.75;
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
          phase === "ritual" || (phase === "chase" && elapsed - chaseStartedAt < CHASE_RELEASE_SECONDS);
        monster.repathTimer -= delta;
        if (monster.repathTimer <= 0) {
          monster.repathTimer = REPATH_INTERVAL;
          const from: [number, number] = [Math.floor(monster.x), Math.floor(monster.z)];
          const to: [number, number] = [Math.floor(player.x), Math.floor(player.z)];
          monster.path = bfsPath(from, to, isSolid, data.width, data.height);
          monster.pathIndex = 0;
        }
        const distToPlayerCells = Math.abs(monster.x - player.x) + Math.abs(monster.z - player.z);
        const hunting = flashlightState.on && distToPlayerCells < MONSTER_HUNT_RADIUS;
        // Chaque objet vole la rend plus rapide ; pendant la fuite finale,
        // elle est plus rapide que toi.
        const speed =
          phase === "chase"
            ? MONSTER_SPEED_FINALE
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
            monster.x += (dx / dist) * speed * delta;
            monster.z += (dz / dist) * speed * delta;
          }
        }
        monsterGroup.position.set(
          monster.x * CELL_SIZE,
          floorHeightAt(monster.z) + Math.sin(elapsed * 3.1) * 0.035,
          monster.z * CELL_SIZE,
        );
        // Orientation calculee a la main plutot que lookAt() : lookAt renvoie
        // des angles d'Euler en blocage de cardan quand la cible est a la meme
        // hauteur, et ecraser rotation.z ensuite couchait le monstre au sol.
        monsterGroup.rotation.set(
          0,
          Math.atan2(player.x - monster.x, player.z - monster.z),
          Math.sin(elapsed * 1.7) * 0.045,
        );
        // Bras qui se balancent : le monstre a l'air de marcher, pas de glisser.
        armGroups.forEach((arm, i) => {
          arm.rotation.x = Math.sin(elapsed * 2.6 + i * Math.PI) * 0.35;
        });

        const capDx = monster.x - player.x;
        const capDz = monster.z - player.z;
        if (!held && capDx * capDx + capDz * capDz < CAPTURE_RADIUS * CAPTURE_RADIUS) {
          dyingSince = elapsed;
          endedRef.current = true;
          flashLevel = 1;
          setScareFlash(1);
          setKeypadOpen(false);
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
      const target = Math.min(1, Math.max(proximityDread, progressDread, phase === "chase" ? 1 : 0));
      dreadLevel += (target - dreadLevel) * Math.min(1, delta * 3.2);
      audio.setTension(dreadLevel);
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
          phase = "chase";
          chaseStartedAt = elapsed;
          setFinale("chase");
          offeringGroup.visible = false;
          hatchGroup.visible = true;
          playHatch(audio.ctx, audio.master);
          playWake(audio.ctx, audio.master);
          flashLevel = 1;
          showHint("La trappe ! COURS !", 3.5);
        }
      }

      if (phase === "chase") {
        hatchGlow.material.opacity = 0.55 + Math.sin(elapsed * 7) * 0.3;
        if (!ended && Math.hypot(player.x - (HATCH.x + 0.5), player.z - (HATCH.y + 0.5)) < HATCH_REACH) {
          ended = true;
          endedRef.current = true;
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
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      renderer.domElement.removeEventListener("contextmenu", onContextMenu);
      renderer.domElement.removeEventListener("click", onCanvasClick);
      document.removeEventListener("mousemove", onMouseMove);
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock?.();
      apiRef.current = null;
      audio.stop();
      audio.ctx.close().catch(() => {});
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  function pressDigit(d: string) {
    setEntryError(false);
    setEntry((e) => (e.length >= 3 ? e : e + d));
  }
  function submitCode() {
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
  }

  const clueDisplay = [0, 1, 2].map((rank) => clues.find((c) => c.rank === rank)?.digit ?? null);

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

      <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
        <span className="rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
          ⏱️ {seconds}s
        </span>
        <span className="rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-amber-200 backdrop-blur">
          🗝️ {itemsFound} / {ITEM_COUNT}
        </span>
        <span className="rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-zinc-300 backdrop-blur">
          🔢 Code :{" "}
          <span className="font-mono tracking-widest text-amber-300">
            {clueDisplay.map((d) => d ?? "_").join(" ")}
          </span>
        </span>
        {doorOpen && finale === "none" && (
          <span className="rounded-full bg-emerald-900/70 px-3 py-1 text-xs font-semibold text-emerald-200 backdrop-blur">
            🚪 Cave ouverte
          </span>
        )}
        {finale === "chase" && (
          <span className="animate-pulse rounded-full bg-red-800 px-3 py-1 text-xs font-black uppercase tracking-widest text-white">
            Cours vers la trappe
          </span>
        )}
      </div>

      <div className="pointer-events-none absolute right-3 top-3 flex w-32 flex-col items-end gap-1">
        <span className="text-xs font-semibold text-white">{flashlightOn ? "🔦" : "🔦 (off)"}</span>
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-black/60">
          <div
            className={`h-full rounded-full transition-all ${battery < 20 ? "bg-red-500" : "bg-amber-400"}`}
            style={{ width: `${battery}%` }}
          />
        </div>
      </div>

      {roomLabel && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2">
          <span className="rounded-full bg-black/70 px-4 py-1.5 text-xs font-semibold tracking-wide text-zinc-200 backdrop-blur">
            📍 {roomLabel}
          </span>
        </div>
      )}

      {hint && (
        <div className="pointer-events-none absolute left-1/2 top-14 -translate-x-1/2">
          <span className="rounded-lg bg-black/80 px-4 py-2 text-center text-xs font-semibold text-amber-200 backdrop-blur">
            {hint}
          </span>
        </div>
      )}

      {toast && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 w-72 -translate-x-1/2 rounded-xl border border-amber-900/60 bg-black/85 px-4 py-3 text-center backdrop-blur">
          <p className="text-sm font-bold text-amber-200">
            {toast.emoji} {toast.name}
          </p>
          <p className="mt-1 text-xs leading-snug text-zinc-400">{toast.flavor}</p>
        </div>
      )}

      {prompt && !keypadOpen && (
        <div className="pointer-events-none absolute bottom-40 left-1/2 -translate-x-1/2">
          <span className="rounded-lg bg-black/80 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur">
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
              Trois chiffres sont gravés sur des plaques dans le manoir.
            </p>
            <div
              className={`mx-auto mt-4 flex w-fit gap-2 ${entryError ? "animate-pulse" : ""}`}
            >
              {[0, 1, 2].map((i) => (
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
                disabled={entry.length < 3}
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

      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-3">
        <button
          type="button"
          onPointerDown={() => (heldRef.current.forward = true)}
          onPointerUp={() => (heldRef.current.forward = false)}
          onPointerLeave={() => (heldRef.current.forward = false)}
          className="flex size-14 items-center justify-center rounded-full bg-black/60 text-2xl text-white backdrop-blur active:scale-95"
        >
          ⬆️
        </button>
        <button
          type="button"
          onPointerDown={() => (heldRef.current.back = true)}
          onPointerUp={() => (heldRef.current.back = false)}
          onPointerLeave={() => (heldRef.current.back = false)}
          className="flex size-14 items-center justify-center rounded-full bg-black/60 text-2xl text-white backdrop-blur active:scale-95"
        >
          ⬇️
        </button>
      </div>

      <p className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-zinc-500">
        Marche · souris pour regarder · F lampe · E interagir · monte à l&apos;étage pour le 3e
        chiffre.
      </p>
    </div>
  );
}
