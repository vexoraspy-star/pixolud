"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  CELL_OPEN,
  CELL_PILLAR,
  CELL_RACK,
  CELL_WALL,
  DIRS,
  generateLevel,
  isSolidCell,
  mulberry32,
  type LevelDef,
  type PickupKind,
  type WallSpot,
} from "@/lib/backrooms";
import {
  makeArrowDecal,
  makeCardboard,
  makeCeilingTiles,
  makeConcreteFloor,
  makeConcreteWall,
  makeDarkCeiling,
  makeDoorTexture,
  makeExitSign,
  makeGrating,
  makeHallCarpet,
  makeHallWallpaper,
  makeLightPanel,
  makeMetalWall,
  makeTileFloor,
  makeTileWall,
  makeWaterLabel,
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
  playHeartbeat,
  playNoclip,
  playPowerOn,
  playSmilerGiggle,
  playSmilerRush,
  playStep,
  playTinnitus,
  playValveDone,
  playValveTurn,
  playWhisper,
  type Surface,
} from "@/lib/backroomsAudio";
import {
  buildBacteria,
  buildSmiler,
  buildWanderer,
  poseBacteria,
  poseSmiler,
} from "@/lib/backroomsEntities";
import { NOISE_RADIUS, pruneNoises, wallsBetween, type Noise, type NoiseKind } from "@/lib/manorNoise";
import { createBrain, thinkMonster, type BrainState, type MapQuery, type SpeedMode } from "@/lib/manorAI";
import Game3DSettings from "./Game3DSettings";
import {
  loadBrightness3D,
  loadLayout3D,
  loadSensitivity3D,
  saveBrightness3D,
  type Layout3D,
} from "@/lib/settings3d";

export type DeathCause = "souriant" | "bacterie" | "lucidite";

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
const VALVE_SECONDS = 2.6;
const CAPTURE = 0.65;
const DEATH_SECONDS = 1.25;
const THINK_INTERVAL = 0.1;
const REPATH = 0.45;
/** Carton de titre du niveau, et temps de grace de l'entite au debut. */
const INTRO_SECONDS = 4.2;
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
}: {
  level: LevelDef;
  seed: number;
  onDeath: (cause: DeathCause, stats: LevelStats) => void;
  onComplete: (stats: LevelStats) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
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
    const radiusCells = PLAYER_RADIUS / CS;

    const reachable: [number, number][] = [];
    for (let i = 0; i < cells.length; i++) {
      if (data.distance[i] >= 0) reachable.push([i % W, Math.floor(i / W)]);
    }

    // --- Scene, camera, rendu ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(def.fog.color);
    scene.fog = new THREE.Fog(def.fog.color, def.fog.near, def.fog.far);
    const fog = scene.fog as THREE.Fog;

    const camera = new THREE.PerspectiveCamera(72, container.clientWidth / container.clientHeight, 0.05, 140);
    camera.rotation.order = "YXZ";

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    const PIXEL_RATIO_CAP = Math.min(window.devicePixelRatio || 1, 1.5);
    const PIXEL_RATIO_FLOOR = 0.6;
    let pixelRatio = PIXEL_RATIO_CAP;
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

    // --- Sol et plafond ---
    const planeGeo = own(new THREE.PlaneGeometry(W * CS, H * CS));
    const floor = new THREE.Mesh(planeGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((W * CS) / 2, 0, (H * CS) / 2);
    scene.add(floor);
    const ceiling = new THREE.Mesh(planeGeo, ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set((W * CS) / 2, WH, (H * CS) / 2);
    scene.add(ceiling);

    // --- Murs et piliers ---
    const wallCells: number[] = [];
    const rackCells: number[] = [];
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] === CELL_WALL || cells[i] === CELL_PILLAR) wallCells.push(i);
      else if (cells[i] === CELL_RACK) rackCells.push(i);
    }
    // On ne dessine que les murs qui touchent une case libre : l'interieur
    // des blocs pleins ne se voit jamais et coutait des milliers d'instances.
    const visibleWalls = wallCells.filter((i) => {
      const x = i % W;
      const y = (i - x) / W;
      return (
        (x > 0 && cells[i - 1] === CELL_OPEN) ||
        (x < W - 1 && cells[i + 1] === CELL_OPEN) ||
        (y > 0 && cells[i - W] === CELL_OPEN) ||
        (y < H - 1 && cells[i + W] === CELL_OPEN)
      );
    });
    const wallGeo = own(new THREE.BoxGeometry(CS, WH, CS));
    const m4 = new THREE.Matrix4();
    const q4 = new THREE.Quaternion();
    const v4 = new THREE.Vector3();
    const s4 = new THREE.Vector3(1, 1, 1);
    wallMats.forEach((mat, variant) => {
      const mine = visibleWalls.filter((i) => ((i * 2654435761) >>> 0) % 3 === variant);
      const mesh = new THREE.InstancedMesh(wallGeo, mat, Math.max(1, mine.length));
      mine.forEach((i, k) => {
        const x = i % W;
        const y = (i - x) / W;
        m4.makeTranslation((x + 0.5) * CS, WH / 2, (y + 0.5) * CS);
        mesh.setMatrixAt(k, m4);
      });
      mesh.count = mine.length;
      scene.add(mesh);
    });

    // --- Rayonnages du niveau 1 ---
    if (rackCells.length > 0) {
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
        const half = CS * 0.46;
        for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          put(frame, fi++, cx + ox * half, rackH / 2, cz + oz * half, 0.07, rackH, 0.07);
        }
        for (let s = 0; s < 3; s++) {
          const sy = 0.35 + s * ((rackH - 0.5) / 2);
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
        for (const [dx, dy] of Object.values(DIRS)) {
          if (!isSolid(x + dx, y + dy)) continue;
          faces.push({ x: (x + 0.5 + dx * 0.43) * CS, z: (y + 0.5 + dy * 0.43) * CS, along: dx !== 0 ? "z" : "x" });
        }
      }
      const pipes = new THREE.InstancedMesh(pipeGeo, pipeMat, faces.length * 2);
      let pi = 0;
      for (const f of faces) {
        for (const py of [WH - 0.32, WH - 0.55]) {
          q4.setFromEuler(new THREE.Euler(f.along === "x" ? 0 : Math.PI / 2, 0, f.along === "x" ? Math.PI / 2 : 0));
          m4.compose(v4.set(f.x, py, f.z), q4, s4.set(1, 1, 1));
          pipes.setMatrixAt(pi++, m4);
        }
      }
      pipes.count = pi;
      scene.add(pipes);
    }

    // --- Luminaires ---
    type Fixture = { x: number; y: number; z: number; state: 0 | 1 | 2; phase: number; index: number };
    const fixtures: Fixture[] = [];
    let fixtureMesh: THREE.InstancedMesh | null = null;
    const litColor = new THREE.Color(0xffffff);
    const deadColor = new THREE.Color(0x3a382f);
    const tmpColor = new THREE.Color();
    if (def.lighting === "neons") {
      const panelTex = tex(makeLightPanel());
      const panelMat = own(new THREE.MeshBasicMaterial({ map: panelTex }));
      const panelGeo = own(new THREE.BoxGeometry(CS * 0.62, 0.05, CS * 0.32));
      fixtureMesh = new THREE.InstancedMesh(panelGeo, panelMat, Math.max(1, data.lights.length));
      data.lights.forEach((l, k) => {
        const f: Fixture = { x: (l.x + 0.5) * CS, y: WH - 0.03, z: (l.y + 0.5) * CS, state: l.state, phase: rng() * 100, index: k };
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
        const y = WH - 1.1;
        fixtures.push({ x, y: y - 0.1, z, state: l.state, phase: rng() * 100, index: k });
        m4.makeTranslation(x, y + 0.08, z);
        shades.setMatrixAt(k, m4);
        m4.makeTranslation(x, WH - 0.45, z);
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
        const y = WH - 0.75;
        fixtures.push({ x: t.x - t.dx * 0.05, y, z: t.z - t.dy * 0.05, state: l.state, phase: rng() * 100, index: k });
        q4.setFromEuler(new THREE.Euler(0, t.yaw, 0));
        m4.compose(v4.set(t.x, y, t.z), q4, s4.set(1, 1, 1));
        cages.setMatrixAt(k, m4);
        m4.makeTranslation(t.x - t.dx * 0.06, y, t.z - t.dy * 0.06);
        fixtureMesh!.setMatrixAt(k, m4);
        fixtureMesh!.setColorAt(k, l.state === 1 ? deadColor : tmpColor.setHex(0xff2a18));
      });
      scene.add(cages);
    } else {
      const stripMat = own(new THREE.MeshBasicMaterial({ color: 0xffffff }));
      const stripGeo = own(new THREE.BoxGeometry(CS * 0.9, 0.06, 0.16));
      fixtureMesh = new THREE.InstancedMesh(stripGeo, stripMat, Math.max(1, data.lights.length));
      data.lights.forEach((l, k) => {
        const f: Fixture = { x: (l.x + 0.5) * CS, y: WH - 0.04, z: (l.y + 0.5) * CS, state: l.state, phase: rng() * 100, index: k };
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

    // Reserve de lumieres : un nombre FIXE de lampes, deplacees sur les
    // luminaires les plus proches du joueur. Des centaines de neons a
    // l'ecran, cinq lumieres calculees, et aucune recompilation de shader.
    const POOL = def.lighting === "neons" ? 5 : 4;
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
    const doorStyle = def.id === "niveau-1" ? "monte-charge" : def.id === "niveau-2" ? "trappe" : def.id === "niveau-run" ? "sortie" : "service";
    const doorW = def.id === "niveau-1" ? Math.min(CS * 0.9, 2.2) : Math.min(CS * 0.7, 1.15);
    const doorH = def.id === "niveau-1" ? 2.6 : 2.1;
    const exitGroup = new THREE.Group();
    exitGroup.position.set(exitT.x, 0, exitT.z);
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
    if (def.id === "niveau-0" || def.id === "niveau-run") {
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
        mesh.position.set(t.x, 1.45 + (rng() - 0.5) * 0.3, t.z);
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

    const pickups = data.pickups.map((p) => {
      const group = new THREE.Group();
      const px = (p.x + 0.5 + (rng() - 0.5) * 0.4) * CS;
      const pz = (p.y + 0.5 + (rng() - 0.5) * 0.4) * CS;
      group.position.set(px, 0, pz);
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
    const valves = data.valves.map((v) => {
      const t = faceTransform(v, CS, 0);
      const group = new THREE.Group();
      group.position.set(t.x, 1.25, t.z);
      group.rotation.y = t.yaw;
      scene.add(group);
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
      return { wheel, lampMat, progress: 0, done: false, face: t };
    });

    // --- Entites ---
    const bacteria = def.entity === "bacterie" ? buildBacteria() : null;
    const smiler = def.entity === "souriant" ? buildSmiler() : null;
    const wanderer = buildWanderer();
    wanderer.setOpacity(0);
    scene.add(wanderer.group);
    if (bacteria) scene.add(bacteria.group);
    if (smiler) scene.add(smiler.group);
    const entity = {
      x: (data.entityStart?.x ?? 0) + 0.5,
      z: (data.entityStart?.y ?? 0) + 0.5,
      yaw: 0,
      walk: 0,
      active: def.entity === "bacterie",
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
      bacteria.group.position.set(entity.x * CS, 0, entity.z * CS);
      // Niveau ! : elle part du point de depart, mais n'apparait qu'au signal.
      if (def.id === "niveau-run") bacteria.group.visible = false;
    }

    // --- Main et lampe ---
    scene.add(camera);
    const hand = new THREE.Group();
    const metal = own(new THREE.MeshLambertMaterial({ color: 0x2b2e31 }));
    const skin = own(new THREE.MeshLambertMaterial({ color: 0xa47e5f }));
    const torch = new THREE.Mesh(own(new THREE.CylinderGeometry(0.04, 0.045, 0.3, 10)), metal);
    torch.rotation.x = Math.PI / 2;
    torch.position.z = -0.1;
    hand.add(torch);
    const lens = new THREE.Mesh(own(new THREE.CircleGeometry(0.052, 12)), own(new THREE.MeshBasicMaterial({ color: 0x555044 })));
    lens.position.z = -0.255;
    hand.add(lens);
    const palm = new THREE.Mesh(own(new THREE.CapsuleGeometry(0.055, 0.1, 4, 8)), skin);
    palm.rotation.z = Math.PI / 2;
    palm.position.set(0, -0.03, 0.02);
    hand.add(palm);
    const HAND_BASE = new THREE.Vector3(0.28, -0.26, -0.55);
    hand.position.copy(HAND_BASE);
    hand.scale.setScalar(0.85);
    camera.add(hand);

    // --- Audio ---
    const audio = createBackroomsAudio(def.lighting);

    // --- Etat du joueur ---
    const player = { x: data.start.x + 0.5, z: data.start.y + 0.5, yaw: data.startYaw, pitch: 0 };
    let elapsed = 0;
    let sanityLevel = 100;
    let batteryLevel = 100;
    let lamp = def.lighting === "secours";
    let staminaLevel = 100;
    let exhausted = false;
    let crouching = false;
    let crouchLevel = 0;
    let waterCount = 0;
    let waterDrunk = 0;
    let fuses = 0;
    let valvesDone = 0;
    let walkPhase = 0;
    let bob = 0;
    let nextStepAt = 0;
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
    let blackoutWarnAt = def.id === "niveau-1" ? 38 + rng() * 20 : Infinity;
    let blackoutStartAt = Infinity;
    let blackoutEndAt = Infinity;

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
    function emitNoise(kind: NoiseKind, x = player.x, z = player.z, scale = 1) {
      noises.push({ kind, x, z, radius: NOISE_RADIUS[kind] * scale * (MANOR_CELL / CS), at: elapsed });
      noises = pruneNoises(noises, elapsed);
    }
    function hasLOS(ax: number, az: number, bx: number, bz: number) {
      const steps = Math.ceil(Math.hypot(bx - ax, bz - az) * 3);
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        if (isSolid(Math.floor(ax + (bx - ax) * t), Math.floor(az + (bz - az) * t))) return false;
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
        return { title: "Trouve une sortie", detail: "Les flèches taguées aident. Pas toutes." };
      }
      if (def.objective === "fusibles") {
        return fuses < def.goalCount
          ? { title: `Fusibles ${fuses}/${def.goalCount}`, detail: "Le monte-charge n'a plus de courant." }
          : { title: "Rejoins le monte-charge", detail: "Tu as les trois fusibles." };
      }
      if (def.objective === "vannes") {
        return valvesDone < def.goalCount
          ? { title: `Vannes ${valvesDone}/${def.goalCount}`, detail: "Ferme-les pour déverrouiller la trappe. Ça s'entend." }
          : { title: "Rejoins la trappe", detail: "La pression est tombée. Elle est ouverte." };
      }
      return { title: "COURS", detail: "La porte, au bout du couloir." };
    }
    let lastObjective = "";

    function toggleLamp() {
      if (dyingSince >= 0 || noclipSince >= 0) return;
      if (!lamp && batteryLevel < 5) {
        playClick(audio.ctx, audio.master, false);
        showHint("Plus de pile. Il en traîne quelque part.", 2.5);
        return;
      }
      lamp = !lamp;
      setLampOn(lamp);
      playClick(audio.ctx, audio.master, lamp);
      emitNoise("lampe");
    }
    function toggleCrouch() {
      if (dyingSince >= 0) return;
      crouching = !crouching;
      setCrouched(crouching);
    }
    function drink() {
      if (dyingSince >= 0 || noclipSince >= 0) return;
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
    function completeLevel() {
      if (noclipSince >= 0 || dyingSince >= 0) return;
      noclipSince = elapsed;
      setNoclip(true);
      if (def.id === "niveau-1") {
        playElevator(audio.ctx, audio.master);
      } else {
        playDoorOpen(audio.ctx, audio.master);
      }
      window.setTimeout(() => {
        if (!ended) playNoclip(audio.ctx, audio.master);
      }, 500);
    }

    function interact() {
      if (dyingSince >= 0 || noclipSince >= 0) return;
      const p = nearestPickup();
      if (p) {
        p.taken = true;
        scene.remove(p.group);
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
          showHint(fuses < def.goalCount ? `Fusible ${fuses}/${def.goalCount}.` : "Trois fusibles. Au monte-charge.", 3);
        }
        return;
      }
      if (distToExit() < DOOR_REACH && def.objective !== "course") {
        if (exitUnlocked()) {
          if (def.id === "niveau-1") playFuse(audio.ctx, audio.master, true);
          completeLevel();
        } else {
          playClick(audio.ctx, audio.master, false);
          const missing = def.goalCount - (def.objective === "fusibles" ? fuses : valvesDone);
          showHint(
            def.objective === "fusibles"
              ? `Pas de courant. Il manque ${missing} fusible${missing > 1 ? "s" : ""}.`
              : `Verrouillée. Encore ${missing} vanne${missing > 1 ? "s" : ""} à fermer.`,
            3,
          );
        }
      }
    }

    function resume() {
      if (document.hidden || contextIsLost) return;
      if (pausedRef.current) {
        pausedRef.current = false;
        setPaused(false);
      }
      lastTime = performance.now();
      audio.ctx.resume().catch(() => {});
    }

    apiRef.current = {
      applyBrightness: (value: number) => {
        brightness = value;
      },
      interact,
      toggleLamp,
      drink,
      toggleCrouch,
      resume,
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
      if (k === "c") toggleCrouch();
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
      if (document.hidden) {
        pausedRef.current = true;
        setPaused(true);
        releaseEverything();
        audio.ctx.suspend().catch(() => {});
      } else {
        resume();
      }
    }
    function onReturn() {
      if (pausedRef.current && !document.hidden) resume();
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
    const initialVisibility = window.setTimeout(() => {
      if (document.hidden) onVisibility();
    }, 0);

    // --- Boucle ---
    let lastTime = performance.now();
    let frameMsAvg = 16;
    let resolutionTimer = 0;
    let smoothFrames = 0;
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
      if (dyingSince >= 0 || noclipSince >= 0) return;
      dyingSince = elapsed;
      deathCause = cause;
      setDying(true);
      playDeath(audio.ctx, audio.master);
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

      // Resolution adaptative, comme au Manoir.
      if (raw < 250) frameMsAvg += (raw - frameMsAvg) * 0.08;
      resolutionTimer += delta;
      if (resolutionTimer >= 1.5) {
        resolutionTimer = 0;
        let next = pixelRatio;
        if (frameMsAvg > 21 && pixelRatio > PIXEL_RATIO_FLOOR) {
          next = Math.max(PIXEL_RATIO_FLOOR, Math.round((pixelRatio - 0.15) * 100) / 100);
          smoothFrames = 0;
        } else if (frameMsAvg < 17.5 && pixelRatio < PIXEL_RATIO_CAP) {
          smoothFrames++;
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

      if (introShown && elapsed > INTRO_SECONDS) {
        introShown = false;
        setIntro(false);
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
          bacteria.group.position.set(camera.position.x + fx * dist, -0.2 * rush, camera.position.z + fz * dist);
          bacteria.group.rotation.y = player.yaw;
          poseBacteria(bacteria, { time: elapsed, walk: entity.walk + elapsed * 8, speed: 5, headYaw: 0, lunge: 1 });
        } else if (deathCause === "souriant" && smiler) {
          smiler.group.position.set(camera.position.x + fx * dist, camera.position.y - 1.45, camera.position.z + fz * dist);
          smiler.group.rotation.y = player.yaw;
          poseSmiler(smiler, elapsed, 1, 1);
        }
        if (t >= 1 && !ended) {
          ended = true;
          onDeathRef.current(deathCause, { seconds: Math.round(elapsed), water: waterDrunk });
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
          onCompleteRef.current({ seconds: Math.round(elapsed), water: waterDrunk });
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
      const sprinting = wantsSprint && moving && !crouching && !exhausted;
      if (sprinting) {
        staminaLevel = Math.max(0, staminaLevel - def.staminaDrain * delta);
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

      if (moving) {
        const speed = (crouching ? def.crouch : sprinting ? def.sprint : def.walk) / CS;
        const sin = Math.sin(player.yaw);
        const cos = Math.cos(player.yaw);
        let mx = -sin * fwd + cos * strafe;
        let mz = -cos * fwd - sin * strafe;
        const len = Math.hypot(mx, mz) || 1;
        mx = (mx / len) * speed * delta;
        mz = (mz / len) * speed * delta;
        if (!blocked(player.x + mx, player.z, radiusCells)) player.x += mx;
        if (!blocked(player.x, player.z + mz, radiusCells)) player.z += mz;
        walkPhase += delta * (sprinting ? 12 : crouching ? 5.5 : 8.5);
        if (elapsed >= nextStepAt) {
          nextStepAt = elapsed + (sprinting ? 0.3 : crouching ? 0.62 : 0.45);
          playStep(audio.ctx, audio.master, surface, sprinting ? 1 : crouching ? 0.3 : 0.65);
          emitNoise(sprinting ? "course" : crouching ? "accroupi" : "pas");
        }
      }
      bob += ((moving ? 1 : 0) - bob) * Math.min(1, delta * 8);

      // Camera : balancement de marche + tremblement de camescope.
      const eye = THREE.MathUtils.lerp(EYE, CROUCH_EYE, crouchLevel);
      camera.position.set(player.x * CS, eye + (Math.abs(Math.sin(walkPhase)) * 0.05 - 0.02) * bob, player.z * CS);
      const handheldX = Math.sin(elapsed * 0.9) * 0.004 + Math.sin(elapsed * 2.3) * 0.002;
      const handheldY = Math.sin(elapsed * 0.7 + 1) * 0.004;
      camera.rotation.y = player.yaw + handheldY;
      camera.rotation.x = player.pitch + handheldX;
      camera.rotation.z = Math.sin(walkPhase) * 0.012 * bob;
      if (camera.fov !== 72) {
        camera.fov = 72;
        camera.updateProjectionMatrix();
      }
      hand.position.set(
        HAND_BASE.x + Math.sin(walkPhase) * 0.014 * bob,
        HAND_BASE.y + Math.abs(Math.cos(walkPhase)) * 0.016 * bob - crouchLevel * 0.02,
        HAND_BASE.z,
      );

      // --- Lampe torche ---
      if (lamp) {
        batteryLevel = Math.max(0, batteryLevel - BATTERY_DRAIN * delta);
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
      (lens.material as THREE.MeshBasicMaterial).color.setHex(lamp ? 0xfff0c8 : 0x555044);

      // --- Coupures de courant (niveau 1) ---
      if (def.id === "niveau-1") {
        if (elapsed >= blackoutWarnAt && blackoutStartAt === Infinity) {
          blackoutStartAt = elapsed + 2.2;
          playFlicker(audio.ctx, audio.master);
        }
        if (elapsed < blackoutStartAt && blackoutStartAt !== Infinity) {
          // Avertissement : tout clignote.
          powerTarget = Math.sin(elapsed * 30) > 0 ? 1 : 0.15;
        }
        if (elapsed >= blackoutStartAt && blackoutEndAt === Infinity) {
          blackoutEndAt = elapsed + 15 + rng() * 8;
          powerTarget = 0;
          setBlackout(true);
          playBlackout(audio.ctx, audio.master);
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
          window.setTimeout(() => {
            if (!ended) playSmilerGiggle(audio.ctx, audio.master, spatial(entity.x, entity.z, 40, 0.8));
          }, 900);
          showHint("Coupure. Éteins ta lampe : dans le noir, la lumière l'attire.", 4);
        }
        if (elapsed >= blackoutEndAt) {
          powerTarget = 1;
          blackoutWarnAt = elapsed + 40 + rng() * 25;
          blackoutStartAt = Infinity;
          blackoutEndAt = Infinity;
          entity.active = false;
          setBlackout(false);
          playPowerOn(audio.ctx, audio.master);
        }
        power += (powerTarget - power) * Math.min(1, delta * (powerTarget > power ? 6 : 14));
        audio.setPower(power);
      }

      // --- Luminaires qui clignotent ---
      if (fixtureMesh && (flickering.length > 0 || def.id === "niveau-1")) {
        const list = def.id === "niveau-1" ? fixtures : flickering;
        for (const f of list) {
          const k = fixtureFactor(f);
          tmpColor.copy(f.state === 1 ? deadColor : baseFixtureColors[f.index]).multiplyScalar(f.state === 1 ? 1 : 0.15 + 0.85 * k);
          fixtureMesh.setColorAt(f.index, tmpColor);
          if (f.state === 2 && k < 0.5 && elapsed >= nextFlickerSoundAt) {
            const d = Math.hypot(f.x / CS - player.x, f.z / CS - player.z) * CS;
            if (d < 9) {
              nextFlickerSoundAt = elapsed + 1.8;
              playFlicker(audio.ctx, audio.master, spatial(f.x / CS, f.z / CS, 14, 1));
            }
          }
        }
        if (fixtureMesh.instanceColor) fixtureMesh.instanceColor.needsUpdate = true;
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
          free.light.position.set(r.f.x, r.f.y - 0.15, r.f.z);
        }
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
        const k = fixtureFactor(f);
        slot.light.intensity = def.lamp.intensity * slot.level * k * brightness * (0.35 + 0.65 * falloff);
        lightHere = Math.max(lightHere, k * THREE.MathUtils.clamp(1 - d / (def.lamp.range * 0.9), 0, 1));
      }
      hemi.intensity = def.hemi.intensity * brightness * (def.id === "niveau-1" ? 0.12 + 0.88 * power : 1);

      // --- Entite ---
      const ex = entity.x;
      const ez = entity.z;
      const distCells = Math.hypot(ex - player.x, ez - player.z);
      const distM = distCells * CS;
      losTimer -= delta;
      if (losTimer <= 0) {
        losTimer = 0.2;
        los = entity.active && distM < 40 ? hasLOS(player.x, player.z, ex, ez) : false;
      }
      const introHold = elapsed < INTRO_SECONDS;
      if (def.id === "niveau-run" && !runReleased && firstMoveAt >= 0 && elapsed - firstMoveAt > 3 && !introHold) {
        runReleased = true;
        entity.x = data.start.x + 0.5;
        entity.z = data.start.y + 0.5;
        if (bacteria) bacteria.group.visible = true;
        playBacteriaScreech(audio.ctx, audio.master, spatial(ex, ez, 60, 1.2));
        showHint("ELLE ARRIVE.", 2.5);
      }
      if (entity.active && !introHold && runReleased) {
        const fwdX = Math.sin(entity.yaw);
        const fwdZ = Math.cos(entity.yaw);
        const behind = ((player.x - ex) * fwdX + (player.z - ez) * fwdZ) / (distCells || 1) < -0.25;
        let sight: number;
        if (smiler) {
          // Le Souriant est attire par la lumiere : lampe allumee, il te voit de loin.
          sight = lamp ? 22 : crouching ? 3.5 : 6;
        } else {
          sight = lamp ? 18 : crouching ? 6 : 10;
          if (behind) sight *= 0.45;
        }
        canSee = los && distM < sight;

        thinkTimer -= delta;
        if (thinkTimer <= 0) {
          thinkTimer = THINK_INTERVAL;
          noises = pruneNoises(noises, elapsed);
          const decision = thinkMonster(
            brain,
            {
              now: elapsed,
              monster: { x: ex, z: ez },
              player: { x: player.x, z: player.z, hidden: false },
              canSee,
              noises,
              noiseWalls: noises.map((n) => wallsBetween(n.x, n.z, ex, ez, isSolid)),
              forceChase: def.id === "niveau-run",
              pressure: def.objective === "vannes" ? valvesDone / def.goalCount : 0.4,
            },
            mapQuery,
            rng,
          );
          if (decision.noticed) {
            if (bacteria) playBacteriaScreech(audio.ctx, audio.master, spatial(ex, ez, 40, 1));
            else playSmilerGiggle(audio.ctx, audio.master, spatial(ex, ez, 40, 1.2));
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
              entity.path = gridPath(cells, W, H, Math.floor(ex), Math.floor(ez), gx, gy);
              entity.pathIndex = 0;
            }
          }
        }

        const speedM =
          mode === "chasse" || mode === "fuite" ? def.entityChase : mode === "marche" ? def.entityInvestigate : def.entityWander;
        const speed = speedM / CS;
        let moved = false;
        if (state === "poursuivre" && (canSee || def.id === "niveau-run") && distM < 2.2) {
          const dx = player.x - ex;
          const dz = player.z - ez;
          const d = Math.hypot(dx, dz) || 1;
          const stepLen = Math.min(speed * delta, d);
          const nx = ex + (dx / d) * stepLen;
          const nz = ez + (dz / d) * stepLen;
          if (!blocked(nx, ez, 0.2 / CS)) entity.x = nx;
          if (!blocked(entity.x, nz, 0.2 / CS)) entity.z = nz;
          entity.yaw = Math.atan2(dx, dz);
          moved = true;
        } else if (entity.path && entity.pathIndex < entity.path.length) {
          const target = entity.path[entity.pathIndex];
          const tx = (target % W) + 0.5;
          const tz = Math.floor(target / W) + 0.5;
          const dx = tx - ex;
          const dz = tz - ez;
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
        if (moved) entity.walk += speedM * delta * 2.2;

        if (bacteria) {
          bacteria.group.position.set(entity.x * CS, 0, entity.z * CS);
          bacteria.group.rotation.y = entity.yaw;
          let headYaw = Math.atan2(player.x - entity.x, player.z - entity.z) - entity.yaw;
          while (headYaw > Math.PI) headYaw -= Math.PI * 2;
          while (headYaw < -Math.PI) headYaw += Math.PI * 2;
          entity.lunge += ((distM < 2 ? 1 - distM / 2 : 0) - entity.lunge) * Math.min(1, delta * 5);
          poseBacteria(bacteria, {
            time: elapsed,
            walk: entity.walk,
            speed: moved ? speedM : 0,
            headYaw: canSee || state === "poursuivre" ? THREE.MathUtils.clamp(headYaw, -1.4, 1.4) : Math.sin(elapsed * 1.7) * 1.1,
            lunge: entity.lunge,
          });
          if (elapsed >= nextClickAt && distM < 26) {
            nextClickAt = elapsed + 1.1 + rng() * 1.8;
            playBacteriaClicks(audio.ctx, audio.master, spatial(entity.x, entity.z, 26, 1.1));
          }
          if (moved && elapsed >= nextEntityStepAt && distM < 22) {
            nextEntityStepAt = elapsed + 0.9 / Math.max(0.8, speedM / 2);
            playEntityStep(audio.ctx, audio.master, spatial(entity.x, entity.z, 22, 1.2));
          }
        }
        if (smiler) {
          entity.opacity = Math.min(1, entity.opacity + delta * 2);
          smiler.group.position.set(entity.x * CS, 0, entity.z * CS);
          smiler.group.rotation.y = Math.atan2(player.x - entity.x, player.z - entity.z);
          const rush = state === "poursuivre" ? THREE.MathUtils.clamp(1 - distM / 9, 0, 1) : 0;
          poseSmiler(smiler, elapsed, rush, entity.opacity * (1 - power * 0.95));
          if (rush > 0.4 && elapsed >= nextClickAt) {
            nextClickAt = elapsed + 2.2;
            playSmilerRush(audio.ctx, audio.master, spatial(entity.x, entity.z, 30, 1));
          }
        }

        if (distM < CAPTURE && dyingSince < 0) killPlayer(bacteria ? "bacterie" : "souriant");
      } else if (smiler) {
        // Hors coupure : il s'efface.
        entity.opacity = Math.max(0, entity.opacity - delta * 2.5);
        poseSmiler(smiler, elapsed, 0, entity.opacity);
      } else if (bacteria) {
        bacteria.group.position.set(entity.x * CS, 0, entity.z * CS);
        poseBacteria(bacteria, { time: elapsed, walk: entity.walk, speed: 0, headYaw: Math.sin(elapsed * 0.8), lunge: 0 });
      }

      // Coeur qui s'emballe quand elle approche.
      const threat = entity.active && def.entity !== "aucune" ? THREE.MathUtils.clamp(1 - distM / 18, 0, 1) * (los ? 1 : 0.5) : 0;
      if (threat > 0.15 && elapsed >= nextHeartAt) {
        nextHeartAt = elapsed + THREE.MathUtils.lerp(1.1, 0.3, threat);
        playHeartbeat(audio.ctx, audio.master, 0.5 + threat);
      }

      // --- Lucidite ---
      if (def.sanityDrain > 0) {
        const dark = lightHere < 0.25 && !lamp;
        const drain = def.sanityDrain * (dark ? 2.4 : 1) + (threat > 0.4 ? 1.6 : 0);
        sanityLevel = Math.max(0, sanityLevel - drain * delta);
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
              wanderer.group.position.set(gx * CS, 0, gz * CS);
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
      if (valve && using) {
        const before = valve.progress;
        valve.progress = Math.min(1, valve.progress + delta / VALVE_SECONDS);
        valve.wheel.rotation.z = -valve.progress * Math.PI * 3;
        valveShown = valve.progress;
        if (Math.floor(before * 7) !== Math.floor(valve.progress * 7)) {
          playValveTurn(audio.ctx, audio.master, valve.progress);
          emitNoise("porte", player.x, player.z, 0.9);
        }
        if (valve.progress >= 1) {
          valve.done = true;
          valvesDone++;
          valve.lampMat.color.setHex(0x2fd35a);
          if (indicatorMats[valvesDone - 1]) indicatorMats[valvesDone - 1].color.setHex(0x2fd35a);
          playValveDone(audio.ctx, audio.master);
          emitNoise("haletement", player.x, player.z, 1.3);
          showHint(valvesDone < def.goalCount ? `Vanne fermée. Encore ${def.goalCount - valvesDone}.` : "La dernière vanne. La trappe se déverrouille.", 3);
        }
      } else if (valve && valve.progress > 0) {
        valveShown = valve.progress;
      }

      // --- Niveau ! : la porte au bout du couloir ---
      if (def.objective === "course" && distToExit() < 1.6) completeLevel();

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
      const blackoutFog = def.id === "niveau-1" ? 1 - power : 0;
      fog.far = THREE.MathUtils.lerp(def.fog.far, def.fog.far * 0.45, Math.max(blackoutFog, sanityDread * 0.4));
      if (def.id === "niveau-1") {
        (scene.background as THREE.Color).setHex(def.fog.color).multiplyScalar(0.25 + 0.75 * power);
        fog.color.setHex(def.fog.color).multiplyScalar(0.25 + 0.75 * power);
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
          promptText = pk.kind === "eau" ? "E — Ramasser l'eau d'amande" : pk.kind === "pile" ? "E — Ramasser la pile" : "E — Ramasser le fusible";
        } else if (valve) {
          promptText = "Maintiens E — Fermer la vanne";
        } else if (distToExit() < DOOR_REACH && def.objective !== "course") {
          promptText = exitUnlocked()
            ? def.id === "niveau-1"
              ? "E — Appeler le monte-charge"
              : def.id === "niveau-2"
                ? "E — Ouvrir la trappe"
                : "E — Ouvrir la porte"
            : def.objective === "fusibles"
              ? "Pas de courant"
              : "Verrouillée";
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
      }

      renderer.render(scene, camera);
    }

    // Compilation des shaders en arriere-plan. Faite d'un bloc au premier
    // rendu, elle figeait la page plusieurs secondes au lancement d'un niveau.
    let ready = false;
    let disposed = false;
    camera.position.set(player.x * CS, EYE, player.z * CS);
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
    tick();
    // La lampe demarre allumee dans les tunnels : l'interface doit le savoir.
    const lampSync = window.setTimeout(() => setLampOn(lamp), 0);

    function onResize() {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      window.clearTimeout(initialVisibility);
      window.clearTimeout(lampSync);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseEverything);
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("pageshow", onReturn);
      document.removeEventListener("visibilitychange", onVisibility);
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
      audio.stop();
      audio.ctx.close().catch(() => {});
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
      // Liberer la carte graphique, mais jamais pendant la compilation en
      // arriere-plan : three.js interroge encore les programmes des materiaux,
      // et les detruire sous lui levait une erreur.
      const disposeGpu = () => {
        bacteria?.dispose();
        smiler?.dispose();
        wanderer.dispose();
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
  const accent = level.id === "niveau-0" ? "#f3e3a0" : level.id === "niveau-1" ? "#d9dde0" : "#ffb4a8";

  return (
    <div className="relative h-full w-full overflow-hidden bg-black font-mono select-none" onScroll={(e) => (e.currentTarget.scrollTop = 0)}>
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={
          lowSanity > 0
            ? { animation: `backrooms-warp ${(2.6 - lowSanity * 1.4).toFixed(2)}s ease-in-out infinite`, transformOrigin: "50% 50%" }
            : undefined
        }
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
          ZQSD · MAJ COURIR · C ACCROUPI · F LAMPE · E INTERAGIR · R BOIRE
        </p>
      )}

      {paused && !contextLost && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/90" style={{ color: accent }}>
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
