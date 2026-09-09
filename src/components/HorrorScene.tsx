"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { buildManor, roomAt, MANOR_ITEMS, type ManorItemDef } from "@/lib/manor";
import { cellKey } from "@/lib/maze";
import {
  loadBrightness3D,
  loadLayout3D,
  loadSensitivity3D,
  type Layout3D as Layout,
} from "@/lib/settings3d";

const CELL_SIZE = 1.7;
const PLAYER_RADIUS = 0.26;
const MOVE_SPEED = 2.6;
const BASE_LOOK_SENSITIVITY = 0.0038;
const ITEM_COUNT = MANOR_ITEMS.length;
const MONSTER_SPEED_BASE = 1.55;
const MONSTER_SPEED_HUNTING = 2.05;
const MONSTER_HUNT_RADIUS = 12; // en cases, distance sous laquelle la lampe allumee accelere le monstre
const CAPTURE_RADIUS = 0.55;
const REPATH_INTERVAL = 0.7;
const FLASHLIGHT_DRAIN_PER_SEC = 100 / 90;
const FLASHLIGHT_REGEN_PER_SEC = 100 / 45;
const NEAR_MISS_RADIUS = 1.8; // en cases (distance de Manhattan) : "elle a failli te voir"
const NEAR_MISS_COOLDOWN = 11;
const STINGER_MIN_DELAY = 16;
const STINGER_MAX_DELAY = 42;
const ROOM_LABEL_SECONDS = 3;
const TOAST_SECONDS = 4.2;
// Le monstre dort tant que le joueur n'a pas touche a un objet. Le minuteur
// n'est plus qu'un filet de securite si le joueur ne ramasse jamais rien.
const MONSTER_GRACE_SECONDS_IDLE = 75;
const PAINTING_FALL_SECONDS = 0.55;
const CEILING_HEIGHT = 2.6;

// Mur "manoir bourgeois" : lambris (boiseries) en bas, papier peint fonce
// en haut, separes par une moulure (chair rail) - comme une vraie demeure
// ancienne plutot qu'un simple couloir texture. repeat.y=1 : le motif ne se
// repete PAS en hauteur, pour que le lambris reste bien pres du sol.
function makeManorWallTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const railY = 108;

  // Papier peint sombre, motif losange discret.
  ctx.fillStyle = "#221a1d";
  ctx.fillRect(0, 0, 256, railY);
  ctx.fillStyle = "rgba(110,45,52,0.3)";
  for (let y = 6, row = 0; y < railY; y += 18, row++) {
    for (let x = row % 2 === 0 ? 6 : 15; x < 256; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x + 4, y);
      ctx.lineTo(x, y + 4);
      ctx.lineTo(x - 4, y);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Lambris (panneaux de bois) sur le bas du mur.
  ctx.fillStyle = "#1c140d";
  ctx.fillRect(0, railY, 256, 256 - railY);
  const panels = 4;
  const panelW = 256 / panels;
  for (let i = 0; i < panels; i++) {
    const shade = 24 + Math.floor(Math.random() * 10);
    ctx.fillStyle = `rgb(${shade + 15},${shade + 7},${shade})`;
    ctx.fillRect(i * panelW + 6, railY + 8, panelW - 12, 256 - railY - 16);
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 2;
    ctx.strokeRect(i * panelW + 6, railY + 8, panelW - 12, 256 - railY - 16);
  }

  // Moulure (chair rail) avec un filet dore use.
  ctx.fillStyle = "#3a2a16";
  ctx.fillRect(0, railY - 5, 256, 6);
  ctx.fillStyle = "rgba(255,210,140,0.18)";
  ctx.fillRect(0, railY - 5, 256, 1);

  // Taches d'humidite sur le lambris.
  for (let i = 0; i < 8; i++) {
    const x = Math.random() * 256;
    const y = railY + Math.random() * (256 - railY);
    const r = 5 + Math.random() * 14;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(5,10,5,0.35)");
    grad.addColorStop(1, "rgba(5,10,5,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Parquet en lattes chaudes, avec veines et joints decales - plus riche que
// le sol generique precedent.
function makeManorFloorTexture(width: number, height: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#160f08";
  ctx.fillRect(0, 0, 256, 256);
  const rows = 10;
  const rowH = 256 / rows;
  for (let r = 0; r < rows; r++) {
    const shade = 22 + Math.floor(Math.random() * 12);
    ctx.fillStyle = `rgb(${shade + 16},${shade + 8},${shade})`;
    ctx.fillRect(0, r * rowH + 1, 256, rowH - 2);
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 1;
    for (let g = 0; g < 3; g++) {
      const gy = r * rowH + 2 + Math.random() * (rowH - 4);
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(256, gy + (Math.random() * 4 - 2));
      ctx.stroke();
    }
    const seamOffset = r % 2 === 0 ? 0 : 42;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    for (let x = seamOffset; x < 256; x += 84) {
      ctx.fillRect(x, r * rowH + 1, 1, rowH - 2);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(width / 2.2, height / 2.2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Petit tableau encadre, genere proceduralement (aucune image externe) :
// cadre dore + toile abstraite sombre, 3 variantes pour un peu de diversite.
function makePaintingTexture(variant: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 170;
  canvas.height = 210;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#7a5a22";
  ctx.fillRect(0, 0, 170, 210);
  ctx.fillStyle = "#c9a24a";
  ctx.fillRect(6, 6, 158, 198);
  ctx.fillStyle = "#7a5a22";
  ctx.fillRect(14, 14, 142, 182);
  const palettes: [string, string, string][] = [
    ["#3a2f22", "#6b4f2e", "#1a1410"],
    ["#2a2e22", "#54613a", "#12140d"],
    ["#341f1f", "#6b3a2e", "#160c0a"],
  ];
  const [c1, c2, c3] = palettes[variant % palettes.length];
  const grad = ctx.createLinearGradient(0, 14, 0, 196);
  grad.addColorStop(0, c1);
  grad.addColorStop(0.55, c2);
  grad.addColorStop(1, c3);
  ctx.fillStyle = grad;
  ctx.fillRect(18, 18, 134, 174);
  ctx.fillStyle = "rgba(10,8,6,0.5)";
  for (let i = 0; i < 3; i++) {
    const bx = 40 + Math.random() * 90;
    const by = 90 + Math.random() * 80;
    const r = 14 + Math.random() * 20;
    ctx.beginPath();
    ctx.ellipse(bx, by, r * 0.4, r, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Plafond a poutres apparentes : sans ca le "toit" est un aplat noir sans
// relief, ce qui casse completement l'illusion d'une vraie piece.
function makeCeilingTexture(width: number, height: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#171009";
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 3 + Math.random() * 8, 1);
  }
  // poutre
  ctx.fillStyle = "#241809";
  ctx.fillRect(0, 46, 128, 34);
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(0, 46, 128, 3);
  ctx.fillRect(0, 77, 128, 3);
  ctx.fillStyle = "rgba(120,90,50,0.12)";
  ctx.fillRect(0, 52, 128, 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(width / 6, height / 3);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Tapis rouge a bordure doree pour le grand hall.
function makeRugTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#5c1010";
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "#c99a3f";
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, 228, 228);
  ctx.strokeStyle = "#3a0a0a";
  ctx.lineWidth = 3;
  ctx.strokeRect(26, 26, 204, 204);
  ctx.fillStyle = "rgba(201,154,63,0.5)";
  for (let y = 40; y < 216; y += 34) {
    for (let x = 40; x < 216; x += 34) {
      ctx.beginPath();
      ctx.moveTo(x + 17, y);
      ctx.lineTo(x + 34, y + 17);
      ctx.lineTo(x + 17, y + 34);
      ctx.lineTo(x, y + 17);
      ctx.closePath();
      ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
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
  // Troisieme voix tres grave et desaccordee : donne ce battement sourd
  // desagreable typique des musiques d'angoisse.
  const osc3 = ctx.createOscillator();
  osc3.type = "triangle";
  osc3.frequency.value = 36.7;
  const droneGain = ctx.createGain();
  droneGain.gain.value = 0.16;
  osc1.connect(droneGain);
  osc2.connect(droneGain);
  osc3.connect(droneGain);
  droneGain.connect(master);
  osc1.start();
  osc2.start();
  osc3.start();

  // Souffle continu (le vent dans les murs) : bruit blanc passe-bas, boucle.
  const windBuffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
  const wd = windBuffer.getChannelData(0);
  let lastSample = 0;
  for (let i = 0; i < wd.length; i++) {
    lastSample = (lastSample + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    wd[i] = lastSample * 3.2;
  }
  const wind = ctx.createBufferSource();
  wind.buffer = windBuffer;
  wind.loop = true;
  const windGain = ctx.createGain();
  windGain.gain.value = 0.1;
  wind.connect(windGain);
  windGain.connect(master);
  wind.start();

  return {
    master,
    stop: () => {
      try {
        osc1.stop();
        osc2.stop();
        osc3.stop();
        wind.stop();
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
// Bruit lointain (craquement, porte, pas) : frayeur ambiante, pas de danger reel.
function playStinger(ctx: AudioContext, master: GainNode) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(90, now);
  osc.frequency.exponentialRampToValueAtTime(30, now + 0.5);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.4, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
  osc.connect(gain);
  gain.connect(master);
  osc.start(now);
  osc.stop(now + 0.65);

  const bufferSize = Math.floor(ctx.sampleRate * 0.35);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) * 0.5;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.22, now);
  noise.connect(noiseGain);
  noiseGain.connect(master);
  noise.start(now);
}
// Le monstre passe tout pres sans t'attraper : frayeur forte mais pas de fin de partie.
function playNearMiss(ctx: AudioContext, master: GainNode) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(640, now);
  osc.frequency.exponentialRampToValueAtTime(110, now + 0.35);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.5, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
  osc.connect(gain);
  gain.connect(master);
  osc.start(now);
  osc.stop(now + 0.5);

  const bufferSize = Math.floor(ctx.sampleRate * 0.4);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) * 0.7;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.5, now);
  noise.connect(noiseGain);
  noiseGain.connect(master);
  noise.start(now);
}

// Le monstre se reveille : long grondement montant, tres grave.
function playWake(ctx: AudioContext, master: GainNode) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(28, now);
  osc.frequency.exponentialRampToValueAtTime(95, now + 1.6);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.55, now + 0.5);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 2);
  osc.connect(gain);
  gain.connect(master);
  osc.start(now);
  osc.stop(now + 2.1);

  const bufferSize = Math.floor(ctx.sampleRate * 1.6);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI) * 0.5;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.3, now);
  noise.connect(noiseGain);
  noiseGain.connect(master);
  noise.start(now);
}
// Un tableau se decroche et s'ecrase au sol juste devant toi.
function playCrash(ctx: AudioContext, master: GainNode) {
  const now = ctx.currentTime;
  const bufferSize = Math.floor(ctx.sampleRate * 0.5);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2.2);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.85, now);
  noise.connect(noiseGain);
  noiseGain.connect(master);
  noise.start(now);

  const thud = ctx.createOscillator();
  thud.type = "sine";
  thud.frequency.setValueAtTime(140, now);
  thud.frequency.exponentialRampToValueAtTime(38, now + 0.3);
  const thudGain = ctx.createGain();
  thudGain.gain.setValueAtTime(0.7, now);
  thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
  thud.connect(thudGain);
  thudGain.connect(master);
  thud.start(now);
  thud.stop(now + 0.45);
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
  const [itemsFound, setItemsFound] = useState(0);
  const [battery, setBattery] = useState(100);
  const [flashlightOn, setFlashlightOn] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [roomLabel, setRoomLabel] = useState<string | null>(null);
  const [toast, setToast] = useState<ManorItemDef | null>(null);
  const [scareFlash, setScareFlash] = useState(0);
  const layoutRef = useRef<Layout>("azerty");
  const sensitivityRef = useRef(1.5);
  const heldRef = useRef({ forward: false, back: false });
  const endedRef = useRef(false);

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
    const container = containerRef.current;
    if (!container) return;

    // Le manoir a un plan fixe (de vraies pieces nommees) : seuls les objets
    // et la position du monstre changent d'une partie a l'autre.
    const data = buildManor();
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

    // --- Objets a collecter : cases ouvertes tirees au sort (loin du depart) ---
    const candidateCells = openCells.filter(
      ([x, y]) => Math.abs(x - start[0]) + Math.abs(y - start[1]) > 4,
    );
    const itemCells: [number, number][] = [];
    const pool = [...candidateCells];
    for (let i = 0; i < ITEM_COUNT && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      itemCells.push(pool[idx]);
      pool.splice(idx, 1);
    }
    const shuffledItemDefs = [...MANOR_ITEMS].sort(() => Math.random() - 0.5);

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
    scene.background = new THREE.Color(0x0a0806);
    // Brouillard plus genereux qu'avant : on voyait litteralement le noir
    // complet a deux metres.
    scene.fog = new THREE.Fog(0x0a0806, 4.5 * CELL_SIZE, 16 * CELL_SIZE);

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

    // Penombre, mais on doit VOIR le decor : l'ancien reglage rendait le jeu
    // quasiment noir. On garde 3 lumieres dynamiques cote joueur maximum
    // (hemisphere + torche + halo) pour ne pas refaire chuter les FPS.
    // Reglage de luminosite du joueur (partage avec les autres jeux 3D).
    const brightness = loadBrightness3D();
    scene.add(new THREE.HemisphereLight(0x565064, 0x1a150f, 1.05 * brightness));

    const flashlight = new THREE.SpotLight(
      0xfff4d8,
      6.5 * brightness,
      16 * CELL_SIZE,
      Math.PI / 5,
      0.45,
      1.1,
    );
    flashlight.position.set(0, 0, 0);
    const flashTarget = new THREE.Object3D();
    scene.add(flashTarget);
    flashlight.target = flashTarget;
    scene.add(flashlight);

    // Halo rapproche autour du joueur : evite le noir total dans le dos et
    // eclaire la main qui tient la lampe.
    const glowOnIntensity = 0.85 * brightness;
    const glowOffIntensity = 0.32 * brightness;
    const playerGlow = new THREE.PointLight(0xffd9a8, glowOnIntensity, 4.5 * CELL_SIZE, 2);
    scene.add(playerGlow);

    // MeshLambertMaterial plutot que Standard : beaucoup moins couteux a
    // eclairer (pas de calcul PBR), invisible a l'oeil vu la penombre ici.
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(data.width * CELL_SIZE, data.height * CELL_SIZE),
      new THREE.MeshLambertMaterial({
        map: makeManorFloorTexture(data.width, data.height),
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((data.width * CELL_SIZE) / 2, 0, (data.height * CELL_SIZE) / 2);
    scene.add(floor);

    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(data.width * CELL_SIZE, data.height * CELL_SIZE),
      new THREE.MeshLambertMaterial({ map: makeCeilingTexture(data.width, data.height) }),
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set((data.width * CELL_SIZE) / 2, CEILING_HEIGHT, (data.height * CELL_SIZE) / 2);
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
      new THREE.MeshLambertMaterial({ map: makeManorWallTexture() }),
      wallCells.length,
    );
    const m = new THREE.Matrix4();
    wallCells.forEach(([wx, wy], i) => {
      m.makeTranslation((wx + 0.5) * CELL_SIZE, 1.3, (wy + 0.5) * CELL_SIZE);
      wallMesh.setMatrixAt(i, m);
    });
    scene.add(wallMesh);

    // Quelques appliques murales chancelantes pour une orientation minimale.
    // Nombre fixe (pas proportionnel a la taille du labyrinthe) : chaque
    // lumiere dynamique est couteuse a calculer sur toute la scene, en
    // avoir trop (une par case) faisait chuter les FPS. On accroche une
    // petite lanterne visible a chaque lumiere pour qu'elle ne flotte pas
    // dans le vide (juste des meshes, aucune lumiere dynamique en plus).
    const sconces: { light: THREE.PointLight; base: number; phase: number }[] = [];
    const MAX_SCONCES = 5;
    // On ne garde que des cases collees a un mur : les appliques sont fixees
    // au mur au lieu de flotter au milieu de la piece.
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
      const py = 1.85;
      const pz = (cell[1] + 0.5 + dir[1] * 0.38) * CELL_SIZE;
      const light = new THREE.PointLight(0xff9a4d, 0, 4 * CELL_SIZE, 2);
      light.position.set(px, py, pz);
      scene.add(light);
      sconces.push({
        light,
        base: (0.75 + Math.random() * 0.25) * brightness,
        phase: Math.random() * 10,
      });

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
    }

    // Tableaux accroches sur un mur de chaque piece (positions choisies a la
    // main dans le plan fixe du manoir, loin des embrasures de porte).
    const PAINTING_SPOTS: { x: number; wallRow: number; room: string }[] = [
      { x: 4, wallRow: 0, room: "Bureau" },
      { x: 12, wallRow: 0, room: "Bibliothèque" },
      { x: 20, wallRow: 0, room: "Chambre principale" },
      { x: 6, wallRow: 7, room: "Salon" },
      { x: 14, wallRow: 7, room: "Grand hall" },
      { x: 22, wallRow: 7, room: "Cuisine" },
      { x: 6, wallRow: 14, room: "Salle à manger" },
      { x: 14, wallRow: 14, room: "Entrée" },
      { x: 22, wallRow: 14, room: "Cave" },
    ];
    const paintingTextures = [makePaintingTexture(0), makePaintingTexture(1), makePaintingTexture(2)];
    const paintingGeo = new THREE.PlaneGeometry(0.85, 1.05);
    const paintingsByRoom = new Map<string, THREE.Mesh>();
    PAINTING_SPOTS.forEach((spot, i) => {
      const mat = new THREE.MeshLambertMaterial({ map: paintingTextures[i % paintingTextures.length] });
      const painting = new THREE.Mesh(paintingGeo, mat);
      painting.position.set((spot.x + 0.5) * CELL_SIZE, 1.55, (spot.wallRow + 1) * CELL_SIZE + 0.03);
      scene.add(painting);
      paintingsByRoom.set(spot.room, painting);
    });

    // Tapis rouge + escalier : dans le grand hall ET dans l'entree, pour que
    // la premiere chose qu'on voie en arrivant soit un vrai grand salon.
    const rugTexture = makeRugTexture();
    const rugGeo = new THREE.PlaneGeometry(4.8 * CELL_SIZE, 4.6 * CELL_SIZE);
    const rugMat = new THREE.MeshLambertMaterial({ map: rugTexture });
    const stairGeo = new THREE.BoxGeometry(1.1 * CELL_SIZE, 0.16, 0.5 * CELL_SIZE);
    const stairMat = new THREE.MeshLambertMaterial({ color: 0x2a1c10 });
    const postGeo = new THREE.BoxGeometry(0.1, 1.1, 0.1);
    const postMat = new THREE.MeshLambertMaterial({ color: 0x1c1208 });
    const railGeo = new THREE.BoxGeometry(0.09, 0.09, 3.6 * 0.5 * CELL_SIZE);
    function addGrandRoomDecor(roomY0: number) {
      const rug = new THREE.Mesh(rugGeo, rugMat);
      rug.rotation.x = -Math.PI / 2;
      rug.position.set(12 * CELL_SIZE, 0.012, (roomY0 + 2.5) * CELL_SIZE);
      scene.add(rug);

      const STAIR_STEPS = 7;
      for (let i = 0; i < STAIR_STEPS; i++) {
        const step = new THREE.Mesh(stairGeo, stairMat);
        step.position.set(14.3 * CELL_SIZE, 0.08 + i * 0.16, (roomY0 + 1.3 + i * 0.5) * CELL_SIZE);
        scene.add(step);
      }
      for (const offsetX of [13.7, 14.9]) {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(offsetX * CELL_SIZE, 0.55, (roomY0 + 1.3) * CELL_SIZE);
        scene.add(post);
        const rail = new THREE.Mesh(railGeo, postMat);
        rail.position.set(offsetX * CELL_SIZE, 1.05, (roomY0 + 2.8) * CELL_SIZE);
        rail.rotation.x = -0.19;
        scene.add(rail);
      }
    }
    addGrandRoomDecor(8); // Grand hall
    addGrandRoomDecor(15); // Entrée (le joueur commence ici)

    // Objets a collecter : materiau non-eclaire (toujours visible tel quel,
    // pas besoin d'une vraie lumiere en plus qui coute cher a calculer).
    const items = itemCells.map(([nx, ny], i) => {
      const def = shuffledItemDefs[i % shuffledItemDefs.length];
      const group = new THREE.Group();
      const paper = new THREE.Mesh(
        new THREE.PlaneGeometry(0.24, 0.24),
        new THREE.MeshBasicMaterial({ color: 0xe8c98a, side: THREE.DoubleSide }),
      );
      group.add(paper);
      group.position.set((nx + 0.5) * CELL_SIZE, 1.05, (ny + 0.5) * CELL_SIZE);
      scene.add(group);
      return { x: nx + 0.5, z: ny + 0.5, group, collected: false, def };
    });

    // Monstre : silhouette encapuchonnee, longue robe qui traine, bras
    // decharnes et yeux rouges. Que des primitives simples : c'est le
    // silhouettage qui fait peur, pas le nombre de polygones.
    const monsterGroup = new THREE.Group();
    const monsterMat = new THREE.MeshLambertMaterial({ color: 0x08070a });
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.46, 1.45, 9), monsterMat);
    robe.position.y = 0.72;
    monsterGroup.add(robe);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.42, 4, 8), monsterMat);
    torso.position.y = 1.5;
    monsterGroup.add(torso);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 10), monsterMat);
    hood.position.y = 1.86;
    hood.scale.set(1, 1.15, 1.05);
    monsterGroup.add(hood);
    const armGeo = new THREE.CapsuleGeometry(0.055, 0.62, 4, 6);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(armGeo, monsterMat);
      arm.position.set(side * 0.29, 1.34, 0.05);
      arm.rotation.z = side * 0.22;
      monsterGroup.add(arm);
    }
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    const eyeGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.085, 1.87, 0.2);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.085, 1.87, 0.2);
    monsterGroup.add(leftEye, rightEye);
    monsterGroup.position.set(monster.x * CELL_SIZE, 0, monster.z * CELL_SIZE);
    monsterGroup.visible = false;
    scene.add(monsterGroup);

    // --- Main du joueur tenant la lampe torche (accrochee a la camera) ---
    // La camera doit etre dans la scene pour que ses enfants soient rendus.
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx: AudioContext = new AudioCtor();
    const ambience = makeAmbience(audioCtx);
    let elapsed = 0;
    let nextHeartbeatAt = 2;
    let nextStingerAt = 14 + Math.random() * 10;
    let nextNearMissAllowedAt = 0;
    let flashLevel = 0;
    let lastSyncedFlash = 0;
    let currentRoomName: string | null = null;
    let roomLabelHideAt = -1;
    let toastHideAt = -1;
    let collectedCount = 0;
    let walkPhase = 0;
    const visitedRooms = new Set<string>();
    let fallingPainting: THREE.Mesh | null = null;
    let fallStartAt = 0;
    let fallFromY = 0;
    let fallFromZ = 0;

    function awakenMonster() {
      if (monster.active) return;
      monster.active = true;
      monsterGroup.visible = true;
      flashLevel = Math.max(flashLevel, 0.55);
      playWake(audioCtx, ambience.master);
    }

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

      const moving = fwd !== 0 || strafe !== 0;
      camera.position.set(player.x * CELL_SIZE, 1.5, player.z * CELL_SIZE);
      camera.rotation.y = player.yaw;
      camera.rotation.x = player.pitch;

      // Balancement de la main quand on marche.
      walkPhase += moving ? delta * 8.5 : 0;
      handGroup.position.set(
        HAND_BASE.x + (moving ? Math.sin(walkPhase) * 0.014 : 0),
        HAND_BASE.y + (moving ? Math.abs(Math.cos(walkPhase)) * 0.016 : 0),
        HAND_BASE.z,
      );

      // Lampe torche : suit la camera, pile qui se vide/se recharge.
      flashlight.position.copy(camera.position);
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      flashTarget.position.copy(camera.position).add(dir);
      playerGlow.position.copy(camera.position);
      const torchOn = flashlightState.on && flashlightState.battery > 0;
      flashlight.visible = torchOn;
      torchLens.visible = torchOn;
      playerGlow.intensity = torchOn ? glowOnIntensity : glowOffIntensity;
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

      // Piece actuelle : petite annonce a chaque changement de piece.
      const room = roomAt(data.rooms, Math.floor(player.x), Math.floor(player.z));
      const roomName = room?.name ?? null;
      if (roomName && roomName !== currentRoomName) {
        currentRoomName = roomName;
        setRoomLabel(roomName);
        roomLabelHideAt = elapsed + ROOM_LABEL_SECONDS;

        // Premiere fois qu'on entre dans la cave : un tableau se decroche
        // juste devant nous et s'ecrase au sol.
        if (!visitedRooms.has(roomName)) {
          visitedRooms.add(roomName);
          const scarePainting = roomName === "Cave" ? paintingsByRoom.get(roomName) : undefined;
          if (scarePainting && !fallingPainting) {
            fallingPainting = scarePainting;
            fallStartAt = elapsed;
            fallFromY = scarePainting.position.y;
            fallFromZ = scarePainting.position.z;
            flashLevel = Math.max(flashLevel, 0.8);
            playCrash(audioCtx, ambience.master);
          }
        }
      }

      // Chute du tableau (screamer scripte).
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

      // Objets : ramassage.
      for (const item of items) {
        if (item.collected) continue;
        item.group.rotation.y += delta * 1.2;
        const dx = player.x - item.x;
        const dz = player.z - item.z;
        if (dx * dx + dz * dz < 0.4 * 0.4) {
          item.collected = true;
          collectedCount++;
          scene.remove(item.group);
          playPickup(audioCtx, ambience.master);
          setItemsFound((n) => n + 1);
          setToast(item.def);
          toastHideAt = elapsed + TOAST_SECONDS;
          // Toucher au premier objet reveille ce qui dort dans le manoir.
          if (collectedCount === 1) awakenMonster();
        }
      }

      // Frayeurs ambiantes : un bruit lointain de temps en temps, sans danger reel.
      if (elapsed >= nextStingerAt) {
        playStinger(audioCtx, ambience.master);
        flashLevel = Math.max(flashLevel, 0.22);
        nextStingerAt = elapsed + STINGER_MIN_DELAY + Math.random() * (STINGER_MAX_DELAY - STINGER_MIN_DELAY);
      }

      // Monstre : IA de poursuite (BFS recalcule periodiquement). Il dort
      // jusqu'a ce qu'on touche a un objet ; le minuteur n'est qu'un filet
      // de securite si le joueur n'y touche jamais.
      if (!monster.active && elapsed > MONSTER_GRACE_SECONDS_IDLE) awakenMonster();
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
        monsterGroup.position.set(
          monster.x * CELL_SIZE,
          Math.sin(elapsed * 3.1) * 0.035,
          monster.z * CELL_SIZE,
        );
        monsterGroup.lookAt(player.x * CELL_SIZE, 0, player.z * CELL_SIZE);
        monsterGroup.rotation.z = Math.sin(elapsed * 1.7) * 0.045;

        const capDx = monster.x - player.x;
        const capDz = monster.z - player.z;
        if (capDx * capDx + capDz * capDz < CAPTURE_RADIUS * CAPTURE_RADIUS) {
          ended = true;
          endedRef.current = true;
          flashLevel = 1;
          playJumpscare(audioCtx, ambience.master);
          onCaught();
        } else if (
          distToPlayerCells < NEAR_MISS_RADIUS &&
          elapsed >= nextNearMissAllowedAt
        ) {
          // Elle est passee tout pres sans te voir : grosse frayeur, mais on continue.
          nextNearMissAllowedAt = elapsed + NEAR_MISS_COOLDOWN;
          flashLevel = Math.max(flashLevel, 0.7);
          playNearMiss(audioCtx, ambience.master);
        }

        // Coeur qui s'accelere avec la proximite du monstre.
        const proximity = THREE.MathUtils.clamp(1 - distToPlayerCells / 14, 0, 1);
        const interval = THREE.MathUtils.lerp(1.1, 0.32, proximity);
        if (elapsed >= nextHeartbeatAt) {
          playHeartbeat(audioCtx, ambience.master);
          nextHeartbeatAt = elapsed + interval;
        }
      }

      // Flash visuel de frayeur : monte instantanement puis s'estompe.
      flashLevel = Math.max(0, flashLevel - delta * 1.1);
      if (Math.abs(flashLevel - lastSyncedFlash) > 0.02 || (flashLevel === 0 && lastSyncedFlash !== 0)) {
        lastSyncedFlash = flashLevel;
        setScareFlash(flashLevel);
      }

      // Victoire : tous les objets + sortie atteinte.
      if (!ended && items.every((it) => it.collected)) {
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
      <div
        className="pointer-events-none absolute inset-0 bg-red-700 transition-opacity"
        style={{ opacity: scareFlash * 0.32 }}
      />

      <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
        <span className="w-fit rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
          ⏱️ {seconds}s
        </span>
        <span className="w-fit rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-amber-200 backdrop-blur">
          🗝️ {itemsFound} / {ITEM_COUNT}
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

      {roomLabel && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2">
          <span className="w-fit rounded-full bg-black/70 px-4 py-1.5 text-xs font-semibold tracking-wide text-zinc-200 backdrop-blur">
            📍 {roomLabel}
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
        Marche · clique/glisse pour regarder · F pour la lampe torche · le premier objet ramassé
        réveille la présence.
      </p>
    </div>
  );
}
