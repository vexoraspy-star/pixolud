"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { generateMaze } from "@/lib/games3d";
import { cellKey } from "@/lib/maze";

type Layout = "azerty" | "qwerty";

const CELL_SIZE = 1.7;
const PLAYER_RADIUS = 0.26;
const MOVE_SPEED = 2.6;
const BASE_LOOK_SENSITIVITY = 0.0038;
const NOTE_COUNT = 5;
const MONSTER_SPEED_BASE = 1.55;
const MONSTER_SPEED_HUNTING = 2.05;
const MONSTER_HUNT_RADIUS = 12; // en cases, distance sous laquelle la lampe allumee accelere le monstre
const CAPTURE_RADIUS = 0.55;
const MONSTER_GRACE_SECONDS = 14;
const REPATH_INTERVAL = 0.7;
const FLASHLIGHT_DRAIN_PER_SEC = 100 / 90;
const FLASHLIGHT_REGEN_PER_SEC = 100 / 45;

function loadLayout(): Layout {
  try {
    const v = localStorage.getItem("pixolud-3d-layout");
    return v === "qwerty" ? "qwerty" : "azerty";
  } catch {
    return "azerty";
  }
}
function loadSensitivity(): number {
  try {
    const v = Number(localStorage.getItem("pixolud-3d-sensitivity"));
    return v >= 0.4 && v <= 3 ? v : 1.5;
  } catch {
    return 1.5;
  }
}

function makeManorWallTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#1a1712";
  ctx.fillRect(0, 0, 256, 256);
  // lattes de bois verticales, sales/moisies
  const planks = 8;
  const plankW = 256 / planks;
  for (let i = 0; i < planks; i++) {
    const shade = 28 + Math.floor(Math.random() * 20);
    ctx.fillStyle = `rgb(${shade + 10},${shade},${shade - 6})`;
    ctx.fillRect(i * plankW + 1, 0, plankW - 2, 256);
    for (let s = 0; s < 6; s++) {
      const sy = Math.random() * 256;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(i * plankW + 2, sy, plankW - 4, 1 + Math.random() * 2);
    }
  }
  // taches d'humidite
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 6 + Math.random() * 18;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(10,20,10,0.4)");
    grad.addColorStop(1, "rgba(10,20,10,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(CELL_SIZE * 0.7, 2.4);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeManorFloorTexture(width: number, height: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0f0d0a";
  ctx.fillRect(0, 0, 256, 256);
  const rows = 8;
  const rowH = 256 / rows;
  for (let r = 0; r < rows; r++) {
    const shade = 20 + Math.floor(Math.random() * 14);
    ctx.fillStyle = `rgb(${shade + 8},${shade},${shade - 4})`;
    ctx.fillRect(0, r * rowH + 1, 256, rowH - 2);
  }
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(x, y, 2 + Math.random() * 3, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(width / 1.4, height / 1.4);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// --- Audio procedural (aucun fichier externe) ---
function makeAmbience(ctx: AudioContext) {
  const master = ctx.createGain();
  master.gain.value = 0.32;
  master.connect(ctx.destination);

  const osc1 = ctx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.value = 54;
  const osc2 = ctx.createOscillator();
  osc2.type = "sine";
  osc2.frequency.value = 57.5;
  const droneGain = ctx.createGain();
  droneGain.gain.value = 0.16;
  osc1.connect(droneGain);
  osc2.connect(droneGain);
  droneGain.connect(master);
  osc1.start();
  osc2.start();

  return {
    master,
    stop: () => {
      try {
        osc1.stop();
        osc2.stop();
      } catch {
        // ignore
      }
    },
  };
}
function playHeartbeat(ctx: AudioContext, master: GainNode) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(58, now);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.55, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
  osc.connect(gain);
  gain.connect(master);
  osc.start(now);
  osc.stop(now + 0.3);
}
function playPickup(ctx: AudioContext, master: GainNode) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(660, now);
  osc.frequency.exponentialRampToValueAtTime(990, now + 0.15);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.3, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
  osc.connect(gain);
  gain.connect(master);
  osc.start(now);
  osc.stop(now + 0.32);
}
function playJumpscare(ctx: AudioContext, master: GainNode) {
  const now = ctx.currentTime;
  const bufferSize = Math.floor(ctx.sampleRate * 0.6);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.9, now);
  noise.connect(noiseGain);
  noiseGain.connect(master);
  noise.start(now);

  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.8);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.6, now);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
  osc.connect(oscGain);
  oscGain.connect(master);
  osc.start(now);
  osc.stop(now + 0.9);
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
  const [notesFound, setNotesFound] = useState(0);
  const [battery, setBattery] = useState(100);
  const [flashlightOn, setFlashlightOn] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const layoutRef = useRef<Layout>("azerty");
  const sensitivityRef = useRef(1.5);
  const heldRef = useRef({ forward: false, back: false });
  const endedRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => {
      layoutRef.current = loadLayout();
      sensitivityRef.current = loadSensitivity();
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
    const container = containerRef.current;
    if (!container) return;

    const data = generateMaze(8, 8, seed);
    const wallSet = new Set(data.walls.map(([x, y]) => cellKey(x, y)));
    function isSolid(cx: number, cy: number): boolean {
      if (cx < 0 || cy < 0 || cx >= data.width || cy >= data.height) return true;
      return wallSet.has(cellKey(cx, cy));
    }
    const openCells: [number, number][] = [];
    for (let y = 0; y < data.height; y++) {
      for (let x = 0; x < data.width; x++) {
        if (!isSolid(x, y)) openCells.push([x, y]);
      }
    }

    const start = data.start ?? [1, 1];
    const end = data.end ?? [data.width - 2, data.height - 2];

    let initialYaw = 0;
    let bestDist = Infinity;
    ([[0, -1, 0], [1, 0, -Math.PI / 2], [0, 1, Math.PI], [-1, 0, Math.PI / 2]] as [number, number, number][]).forEach(
      ([dx, dy, yaw]) => {
        const nx = start[0] + dx;
        const ny = start[1] + dy;
        if (isSolid(nx, ny)) return;
        const dist = Math.abs(nx - end[0]) + Math.abs(ny - end[1]);
        if (dist < bestDist) {
          bestDist = dist;
          initialYaw = yaw;
        }
      },
    );

    const player = { x: start[0] + 0.5, z: start[1] + 0.5, yaw: initialYaw, pitch: 0 };

    // --- Notes a collecter : cases ouvertes tirees au sort (loin du depart) ---
    const candidateCells = openCells.filter(
      ([x, y]) => Math.abs(x - start[0]) + Math.abs(y - start[1]) > 4,
    );
    const noteCells: [number, number][] = [];
    const pool = [...candidateCells];
    for (let i = 0; i < NOTE_COUNT && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      noteCells.push(pool[idx]);
      pool.splice(idx, 1);
    }

    // --- Monstre : point de depart eloigne du joueur ---
    let monsterStart: [number, number] = end;
    let bestMonsterDist = -1;
    for (const [x, y] of openCells) {
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
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.Fog(0x000000, 2.5 * CELL_SIZE, 9 * CELL_SIZE);

    const camera = new THREE.PerspectiveCamera(
      74,
      container.clientWidth / container.clientHeight,
      0.1,
      100,
    );
    camera.position.set(player.x * CELL_SIZE, 1.5, player.z * CELL_SIZE);
    camera.rotation.order = "YXZ";
    camera.rotation.y = player.yaw;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Ambiance tres sombre : quasiment aucune lumiere sans la lampe.
    scene.add(new THREE.HemisphereLight(0x1a1a22, 0x030302, 0.18));

    const flashlight = new THREE.SpotLight(0xfff4d8, 3.2, 11 * CELL_SIZE, Math.PI / 7, 0.5, 1.6);
    flashlight.position.set(0, 0, 0);
    const flashTarget = new THREE.Object3D();
    scene.add(flashTarget);
    flashlight.target = flashTarget;
    scene.add(flashlight);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(data.width * CELL_SIZE, data.height * CELL_SIZE),
      new THREE.MeshStandardMaterial({
        map: makeManorFloorTexture(data.width, data.height),
        roughness: 1,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((data.width * CELL_SIZE) / 2, 0, (data.height * CELL_SIZE) / 2);
    scene.add(floor);

    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(data.width * CELL_SIZE, data.height * CELL_SIZE),
      new THREE.MeshStandardMaterial({ color: 0x030302, roughness: 1 }),
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set((data.width * CELL_SIZE) / 2, 2.6, (data.height * CELL_SIZE) / 2);
    scene.add(ceiling);

    const wallCells: [number, number][] = [...data.walls];
    for (let x = -1; x <= data.width; x++) {
      wallCells.push([x, -1]);
      wallCells.push([x, data.height]);
    }
    for (let y = 0; y < data.height; y++) {
      wallCells.push([-1, y]);
      wallCells.push([data.width, y]);
    }
    const wallMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(CELL_SIZE, 2.6, CELL_SIZE),
      new THREE.MeshStandardMaterial({ map: makeManorWallTexture(), roughness: 1 }),
      wallCells.length,
    );
    const m = new THREE.Matrix4();
    wallCells.forEach(([wx, wy], i) => {
      m.makeTranslation((wx + 0.5) * CELL_SIZE, 1.3, (wy + 0.5) * CELL_SIZE);
      wallMesh.setMatrixAt(i, m);
    });
    scene.add(wallMesh);

    // Quelques appliques murales chancelantes pour une orientation minimale.
    const sconces: { light: THREE.PointLight; base: number; phase: number }[] = [];
    const sconceCells = openCells.filter((_, i) => i % 11 === 0);
    for (const [sx, sy] of sconceCells) {
      const light = new THREE.PointLight(0xff9a4d, 0, 3 * CELL_SIZE, 2);
      light.position.set((sx + 0.5) * CELL_SIZE, 1.7, (sy + 0.5) * CELL_SIZE);
      scene.add(light);
      sconces.push({ light, base: 0.35 + Math.random() * 0.2, phase: Math.random() * 10 });
    }

    // Notes a collecter.
    const notes = noteCells.map(([nx, ny]) => {
      const group = new THREE.Group();
      const paper = new THREE.Mesh(
        new THREE.PlaneGeometry(0.22, 0.3),
        new THREE.MeshStandardMaterial({
          color: 0xe8dcc0,
          emissive: 0xe8dcc0,
          emissiveIntensity: 0.35,
          side: THREE.DoubleSide,
        }),
      );
      group.add(paper);
      const glow = new THREE.PointLight(0xffe9b0, 0.6, 2.2, 2);
      group.add(glow);
      group.position.set((nx + 0.5) * CELL_SIZE, 1.1, (ny + 0.5) * CELL_SIZE);
      scene.add(group);
      return { x: nx + 0.5, z: ny + 0.5, group, collected: false };
    });

    // Monstre : silhouette sombre avec des yeux qui brillent dans le noir.
    const monsterGroup = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.32, 1.15, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x030303, roughness: 1 }),
    );
    body.position.y = 0.95;
    monsterGroup.add(body);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xff2222,
      emissive: 0xff2222,
      emissiveIntensity: 3.5,
    });
    const eyeGeo = new THREE.SphereGeometry(0.045, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.11, 1.5, 0.28);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.11, 1.5, 0.28);
    monsterGroup.add(leftEye, rightEye);
    monsterGroup.position.set(monster.x * CELL_SIZE, 0, monster.z * CELL_SIZE);
    scene.add(monsterGroup);

    // --- Audio ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx: AudioContext = new AudioCtor();
    const ambience = makeAmbience(audioCtx);
    let elapsed = 0;
    let nextHeartbeatAt = 2;

    function resolveCollision(nx: number, nz: number): [number, number] {
      let x = player.x;
      let z = player.z;
      if (!circleHitsWall(nx, z)) x = nx;
      if (!circleHitsWall(x, nz)) z = nz;
      return [x, z];
    }
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

    function applyLook(dx: number, dy: number) {
      const s = BASE_LOOK_SENSITIVITY * sensitivityRef.current;
      player.yaw -= dx * s;
      player.pitch = THREE.MathUtils.clamp(player.pitch - dy * s, -0.7, 0.7);
    }
    function onCanvasClick() {
      if (document.pointerLockElement === renderer.domElement) return;
      try {
        renderer.domElement.requestPointerLock?.()?.catch(() => {});
      } catch {
        // ignore
      }
    }
    function onPointerLockChange() {}
    function onMouseMove(e: MouseEvent) {
      if (document.pointerLockElement !== renderer.domElement) return;
      applyLook(e.movementX, e.movementY);
    }
    renderer.domElement.addEventListener("click", onCanvasClick);
    document.addEventListener("pointerlockchange", onPointerLockChange);
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

    const keys = new Set<string>();
    function onKeyDown(e: KeyboardEvent) {
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

      const forwardKey = layoutRef.current === "azerty" ? "z" : "w";
      const leftKey = layoutRef.current === "azerty" ? "q" : "a";
      let fwd = 0;
      let strafe = 0;
      if (keys.has(forwardKey) || keys.has("arrowup") || heldRef.current.forward) fwd += 1;
      if (keys.has("s") || keys.has("arrowdown") || heldRef.current.back) fwd -= 1;
      if (keys.has(leftKey) || keys.has("arrowleft")) strafe -= 1;
      if (keys.has("d") || keys.has("arrowright")) strafe += 1;
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

      camera.position.set(player.x * CELL_SIZE, 1.5, player.z * CELL_SIZE);
      camera.rotation.y = player.yaw;
      camera.rotation.x = player.pitch;

      // Lampe torche : suit la camera, pile qui se vide/se recharge.
      flashlight.position.copy(camera.position);
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      flashTarget.position.copy(camera.position).add(dir);
      flashlight.visible = flashlightState.on && flashlightState.battery > 0;
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

      // Appliques : petit scintillement.
      for (const s of sconces) {
        s.light.intensity = s.base + Math.sin(elapsed * 6 + s.phase) * 0.08 + (Math.random() - 0.5) * 0.05;
      }

      // Notes : ramassage.
      for (const note of notes) {
        if (note.collected) continue;
        note.group.rotation.y += delta * 1.2;
        const dx = player.x - note.x;
        const dz = player.z - note.z;
        if (dx * dx + dz * dz < 0.4 * 0.4) {
          note.collected = true;
          scene.remove(note.group);
          playPickup(audioCtx, ambience.master);
          setNotesFound((n) => n + 1);
        }
      }

      // Monstre : IA de poursuite (BFS recalcule periodiquement).
      if (!monster.active && elapsed > MONSTER_GRACE_SECONDS) monster.active = true;
      if (monster.active) {
        monster.repathTimer -= delta;
        if (monster.repathTimer <= 0) {
          monster.repathTimer = REPATH_INTERVAL;
          const from: [number, number] = [Math.floor(monster.x), Math.floor(monster.z)];
          const to: [number, number] = [Math.floor(player.x), Math.floor(player.z)];
          monster.path = bfsPath(from, to, isSolid, data.width, data.height);
          monster.pathIndex = 0;
        }
        const distToPlayerCells =
          Math.abs(monster.x - player.x) + Math.abs(monster.z - player.z);
        const hunting = flashlightState.on && distToPlayerCells < MONSTER_HUNT_RADIUS;
        const speed = hunting ? MONSTER_SPEED_HUNTING : MONSTER_SPEED_BASE;
        if (monster.path && monster.pathIndex < monster.path.length) {
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
        monsterGroup.position.set(monster.x * CELL_SIZE, 0, monster.z * CELL_SIZE);
        monsterGroup.lookAt(player.x * CELL_SIZE, 0, player.z * CELL_SIZE);

        const capDx = monster.x - player.x;
        const capDz = monster.z - player.z;
        if (capDx * capDx + capDz * capDz < CAPTURE_RADIUS * CAPTURE_RADIUS) {
          ended = true;
          endedRef.current = true;
          playJumpscare(audioCtx, ambience.master);
          onCaught();
        }

        // Coeur qui s'accelere avec la proximite du monstre.
        const proximity = THREE.MathUtils.clamp(1 - distToPlayerCells / 14, 0, 1);
        const interval = THREE.MathUtils.lerp(1.1, 0.32, proximity);
        if (elapsed >= nextHeartbeatAt) {
          playHeartbeat(audioCtx, ambience.master);
          nextHeartbeatAt = elapsed + interval;
        }
      }

      // Victoire : toutes les notes + sortie atteinte.
      if (!ended && notes.every((n) => n.collected)) {
        const dex = player.x - (end[0] + 0.5);
        const dez = player.z - (end[1] + 0.5);
        if (dex * dex + dez * dez < 0.5 * 0.5) {
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

    // Boutons tactiles avancer/reculer exposes via heldRef (geres dans le JSX).
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
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      document.removeEventListener("mousemove", onMouseMove);
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock?.();
      ambience.stop();
      audioCtx.close().catch(() => {});
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-black select-none">
      <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
        <span className="w-fit rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
          ⏱️ {seconds}s
        </span>
        <span className="w-fit rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-amber-200 backdrop-blur">
          📜 {notesFound} / {NOTE_COUNT}
        </span>
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

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-1 w-1 rounded-full bg-white/50" />
      </div>

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
        Marche · clique/glisse pour regarder · F pour la lampe torche · trouve les pages, évite la
        présence.
      </p>
    </div>
  );
}
