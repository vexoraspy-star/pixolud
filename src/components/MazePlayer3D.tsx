"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { cellKey, type MazeData } from "@/lib/maze";
import { createClient } from "@/lib/supabase/client";

// 0 = Nord (-Z), 1 = Est (+X), 2 = Sud (+Z), 3 = Ouest (-X)
const DIR_VECTORS: [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

const MOVE_DURATION = 0.22;
const TURN_DURATION = 0.18;

function makeStoneWallTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#211f1c";
  ctx.fillRect(0, 0, 256, 256);

  const rows = 6;
  const rowH = 256 / rows;
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : 32;
    for (let c = -1; c <= 5; c++) {
      const x = c * 51.2 + offset;
      const y = r * rowH;
      const shade = 78 + Math.floor(Math.random() * 34);
      ctx.fillStyle = `rgb(${shade},${shade - 6},${shade - 14})`;
      ctx.fillRect(x + 2, y + 2, 51.2 - 4, rowH - 4);
      for (let i = 0; i < 10; i++) {
        const sx = x + 2 + Math.random() * (51.2 - 4);
        const sy = y + 2 + Math.random() * (rowH - 4);
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.18})`;
        ctx.fillRect(sx, sy, 2, 2);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 2.4);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeStoneFloorTexture(width: number, height: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#141311";
  ctx.fillRect(0, 0, 256, 256);

  const cols = 4;
  const tile = 256 / cols;
  for (let r = 0; r < cols; r++) {
    for (let c = 0; c < cols; c++) {
      const jitter = 3;
      const x = c * tile + jitter;
      const y = r * tile + jitter;
      const shade = 46 + Math.floor(Math.random() * 22);
      ctx.fillStyle = `rgb(${shade},${shade - 3},${shade - 6})`;
      ctx.fillRect(x, y, tile - jitter * 2, tile - jitter * 2);
      for (let i = 0; i < 14; i++) {
        const sx = x + Math.random() * (tile - jitter * 2);
        const sy = y + Math.random() * (tile - jitter * 2);
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`;
        ctx.fillRect(sx, sy, 2, 2);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(width / 1.5, height / 1.5);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export default function MazePlayer3D({
  data,
  gameId,
  countsAsPlay = false,
}: {
  data: MazeData;
  gameId?: string;
  countsAsPlay?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [won, setWon] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const hasCountedPlay = useRef(false);
  const actionsRef = useRef<{
    forward: () => void;
    back: () => void;
    turnLeft: () => void;
    turnRight: () => void;
  } | null>(null);

  useEffect(() => {
    if (!countsAsPlay || !gameId || hasCountedPlay.current) return;
    hasCountedPlay.current = true;
    const supabase = createClient();
    supabase.rpc("increment_plays", { game_id: gameId });
  }, [countsAsPlay, gameId]);

  useEffect(() => {
    if (won) return;
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [won]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const wallSet = new Set(data.walls.map(([x, y]) => cellKey(x, y)));
    const start = data.start ?? [0, 0];
    const end = data.end ?? start;

    // Choisit la direction de depart qui menne vers une case libre, de
    // preference celle qui rapproche le plus de l'arrivee (sinon le joueur
    // se retrouve a regarder un mur ou le vide des le premier instant).
    let initialFacing = 0;
    let bestDist = Infinity;
    DIR_VECTORS.forEach(([dx, dy], i) => {
      const nx = start[0] + dx;
      const ny = start[1] + dy;
      if (nx < 0 || ny < 0 || nx >= data.width || ny >= data.height) return;
      if (wallSet.has(cellKey(nx, ny))) return;
      const dist = Math.abs(nx - end[0]) + Math.abs(ny - end[1]);
      if (dist < bestDist) {
        bestDist = dist;
        initialFacing = i;
      }
    });

    const state = {
      x: start[0],
      y: start[1],
      facing: initialFacing,
      moving: false,
      posFrom: new THREE.Vector3(start[0] + 0.5, 1.5, start[1] + 0.5),
      posTo: new THREE.Vector3(start[0] + 0.5, 1.5, start[1] + 0.5),
      rotFrom: -initialFacing * (Math.PI / 2),
      rotTo: -initialFacing * (Math.PI / 2),
      t: 0,
      won: false,
    };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0d10);
    scene.fog = new THREE.Fog(0x0c0d10, 5, 16);

    const camera = new THREE.PerspectiveCamera(
      72,
      container.clientWidth / container.clientHeight,
      0.1,
      100,
    );
    camera.position.copy(state.posFrom);
    camera.rotation.y = state.rotFrom;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0x8fa3c0, 0x151412, 0.75));
    const dirLight = new THREE.DirectionalLight(0xfff4e0, 0.5);
    dirLight.position.set(6, 10, 4);
    scene.add(dirLight);
    const playerLight = new THREE.PointLight(0xffbe80, 1.3, 7.5, 2);
    scene.add(playerLight);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(data.width, data.height),
      new THREE.MeshStandardMaterial({
        map: makeStoneFloorTexture(data.width, data.height),
        roughness: 0.95,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(data.width / 2, 0, data.height / 2);
    scene.add(floor);

    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(data.width, data.height),
      new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 1 }),
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(data.width / 2, 2.6, data.height / 2);
    scene.add(ceiling);

    if (data.walls.length > 0) {
      const wallMesh = new THREE.InstancedMesh(
        new THREE.BoxGeometry(1, 2.6, 1),
        new THREE.MeshStandardMaterial({
          map: makeStoneWallTexture(),
          roughness: 0.9,
        }),
        data.walls.length,
      );
      const m = new THREE.Matrix4();
      data.walls.forEach(([wx, wy], i) => {
        m.makeTranslation(wx + 0.5, 1.3, wy + 0.5);
        wallMesh.setMatrixAt(i, m);
      });
      scene.add(wallMesh);
    }

    let endMesh: THREE.Mesh | null = null;
    if (data.end) {
      const [ex, ey] = data.end;
      endMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.32),
        new THREE.MeshStandardMaterial({
          color: 0xf43f5e,
          emissive: 0xf43f5e,
          emissiveIntensity: 0.8,
        }),
      );
      endMesh.position.set(ex + 0.5, 1.2, ey + 0.5);
      scene.add(endMesh);

      const endGlow = new THREE.PointLight(0xf43f5e, 1.6, 8, 2);
      endGlow.position.copy(endMesh.position);
      scene.add(endGlow);
    }

    function tryMove(dir: 1 | -1) {
      if (state.moving || state.won) return;
      const [dx, dy] = DIR_VECTORS[state.facing];
      const nx = state.x + dx * dir;
      const ny = state.y + dy * dir;
      if (nx < 0 || ny < 0 || nx >= data.width || ny >= data.height) return;
      if (wallSet.has(cellKey(nx, ny))) return;

      state.posFrom.copy(state.posTo);
      state.posTo.set(nx + 0.5, 1.5, ny + 0.5);
      state.x = nx;
      state.y = ny;
      state.moving = true;
      state.t = 0;

      if (data.end && cellKey(nx, ny) === cellKey(...data.end)) {
        state.won = true;
        setWon(true);
      }
    }

    function tryTurn(dir: 1 | -1) {
      if (state.moving || state.won) return;
      state.rotFrom = state.rotTo;
      state.rotTo = state.rotTo - dir * (Math.PI / 2);
      state.facing = ((state.facing + dir + 4) % 4) as 0 | 1 | 2 | 3;
      state.moving = true;
      state.t = 0;
    }

    actionsRef.current = {
      forward: () => tryMove(1),
      back: () => tryMove(-1),
      turnLeft: () => tryTurn(-1),
      turnRight: () => tryTurn(1),
    };

    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowUp" || e.key === "w") actionsRef.current?.forward();
      else if (e.key === "ArrowDown" || e.key === "s") actionsRef.current?.back();
      else if (e.key === "ArrowLeft" || e.key === "a") actionsRef.current?.turnLeft();
      else if (e.key === "ArrowRight" || e.key === "d") actionsRef.current?.turnRight();
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", handleKey);

    let lastTime = performance.now();
    function tick() {
      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      if (state.moving) {
        state.t += delta / (state.posFrom.equals(state.posTo) ? TURN_DURATION : MOVE_DURATION);
        const t = Math.min(state.t, 1);
        const eased = 1 - (1 - t) * (1 - t);
        camera.position.lerpVectors(state.posFrom, state.posTo, eased);
        camera.rotation.y = THREE.MathUtils.lerp(state.rotFrom, state.rotTo, eased);
        if (t >= 1) state.moving = false;
      }

      playerLight.position.copy(camera.position);
      if (endMesh) endMesh.rotation.y += delta * 1.4;

      renderer.render(scene, camera);
    }
    // setInterval plutot que requestAnimationFrame : rendu a cadence fixe,
    // insensible aux navigateurs/contextes qui suspendent rAF (onglets en
    // arriere-plan, webviews embarquees...).
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
      window.removeEventListener("keydown", handleKey);
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [data]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-600 shadow-sm dark:bg-zinc-800 dark:text-zinc-300">
          ⏱️ {seconds}s
        </span>
        {won && (
          <span className="animate-bounce rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 px-3 py-1 text-xs font-bold text-white shadow-md shadow-emerald-500/30">
            🎉 Gagné !
          </span>
        )}
      </div>

      <div
        ref={containerRef}
        className="aspect-video w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-800 bg-black shadow-lg"
      />

      <div className="grid grid-cols-3 gap-2">
        <div />
        <button
          type="button"
          onClick={() => actionsRef.current?.forward()}
          className="flex size-12 items-center justify-center rounded-xl bg-zinc-800 text-xl text-white shadow-md active:scale-95"
        >
          ⬆️
        </button>
        <div />
        <button
          type="button"
          onClick={() => actionsRef.current?.turnLeft()}
          className="flex size-12 items-center justify-center rounded-xl bg-zinc-800 text-xl text-white shadow-md active:scale-95"
        >
          ↩️
        </button>
        <button
          type="button"
          onClick={() => actionsRef.current?.back()}
          className="flex size-12 items-center justify-center rounded-xl bg-zinc-800 text-xl text-white shadow-md active:scale-95"
        >
          ⬇️
        </button>
        <button
          type="button"
          onClick={() => actionsRef.current?.turnRight()}
          className="flex size-12 items-center justify-center rounded-xl bg-zinc-800 text-xl text-white shadow-md active:scale-95"
        >
          ↪️
        </button>
      </div>

      <p className="text-xs text-zinc-400">
        Flèches ou WASD pour avancer/reculer/tourner. Trouve le cristal rose pour gagner.
      </p>
    </div>
  );
}
