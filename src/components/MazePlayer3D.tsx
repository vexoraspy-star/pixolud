"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as THREE from "three";
import { cellKey, type MazeData } from "@/lib/maze";
import { createClient } from "@/lib/supabase/client";

type Layout = "azerty" | "qwerty";

const PLAYER_RADIUS = 0.26;
const MOVE_SPEED = 2.6;
const BASE_LOOK_SENSITIVITY = 0.0038;
const MINIMAP_SIZE = 220;
// Les couloirs vivent en unites "logiques" (1 case = 1 unite) pour toute la
// physique/collision, mais sont affiches plus larges a l'ecran en
// multipliant leurs positions par CELL_SIZE au rendu : les couloirs
// paraissent plus spacieux sans toucher au deplacement/collisions.
const CELL_SIZE = 1.7;

function loadLayout(): Layout {
  try {
    const v = localStorage.getItem("pixolud-3d-layout");
    return v === "qwerty" ? "qwerty" : "azerty";
  } catch {
    return "azerty";
  }
}

function loadBrightness(): number {
  try {
    const v = Number(localStorage.getItem("pixolud-3d-brightness"));
    return v >= 0.5 && v <= 1.8 ? v : 1;
  } catch {
    return 1;
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
  texture.repeat.set(CELL_SIZE, 2.4);
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
  backHref,
  title,
  minimapRevealRadius = 2,
  onWin,
}: {
  data: MazeData;
  gameId?: string;
  countsAsPlay?: boolean;
  backHref?: string;
  title?: string;
  minimapRevealRadius?: number;
  onWin?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onWinRef = useRef(onWin);
  useEffect(() => {
    onWinRef.current = onWin;
  }, [onWin]);
  const [won, setWon] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [layout, setLayoutState] = useState<Layout>("azerty");
  const [brightness, setBrightnessState] = useState(1);
  const [sensitivity, setSensitivityState] = useState(1.5);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [lookActive, setLookActive] = useState(false);
  const layoutRef = useRef<Layout>("azerty");
  const brightnessRef = useRef(1);
  const sensitivityRef = useRef(1.5);
  const lightsRef = useRef<{ apply: (b: number) => void } | null>(null);
  const heldRef = useRef({ forward: false, back: false });
  const minimapRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const l = loadLayout();
      const b = loadBrightness();
      const s = loadSensitivity();
      layoutRef.current = l;
      brightnessRef.current = b;
      sensitivityRef.current = s;
      setLayoutState(l);
      setBrightnessState(b);
      setSensitivityState(s);
      lightsRef.current?.apply(b);
    }, 0);
    return () => clearTimeout(timeout);
  }, []);

  function changeLayout(next: Layout) {
    layoutRef.current = next;
    setLayoutState(next);
    try {
      localStorage.setItem("pixolud-3d-layout", next);
    } catch {
      // ignore
    }
  }

  function changeBrightness(next: number) {
    brightnessRef.current = next;
    setBrightnessState(next);
    lightsRef.current?.apply(next);
    try {
      localStorage.setItem("pixolud-3d-brightness", String(next));
    } catch {
      // ignore
    }
  }

  function changeSensitivity(next: number) {
    sensitivityRef.current = next;
    setSensitivityState(next);
    try {
      localStorage.setItem("pixolud-3d-sensitivity", String(next));
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!countsAsPlay || !gameId) return;
    const supabase = createClient();
    supabase.rpc("increment_plays", { game_id: gameId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (won) return;
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [won]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const wallSet = new Set(data.walls.map(([x, y]) => cellKey(x, y)));
    function isSolid(cx: number, cy: number): boolean {
      if (cx < 0 || cy < 0 || cx >= data.width || cy >= data.height) return true;
      return wallSet.has(cellKey(cx, cy));
    }

    const start = data.start ?? [0, 0];
    const end = data.end ?? start;

    let initialYaw = 0;
    let bestDist = Infinity;
    const dirCandidates: [number, number, number][] = [
      [0, -1, 0],
      [1, 0, -Math.PI / 2],
      [0, 1, Math.PI],
      [-1, 0, Math.PI / 2],
    ];
    dirCandidates.forEach(([dx, dy, yaw]) => {
      const nx = start[0] + dx;
      const ny = start[1] + dy;
      if (isSolid(nx, ny)) return;
      const dist = Math.abs(nx - end[0]) + Math.abs(ny - end[1]);
      if (dist < bestDist) {
        bestDist = dist;
        initialYaw = yaw;
      }
    });

    const player = {
      x: start[0] + 0.5,
      z: start[1] + 0.5,
      yaw: initialYaw,
      pitch: 0,
      won: false,
    };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0d10);
    scene.fog = new THREE.Fog(0x0c0d10, 5 * CELL_SIZE, 16 * CELL_SIZE);

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

    const hemi = new THREE.HemisphereLight(0x8fa3c0, 0x151412, 0.75);
    scene.add(hemi);
    const dirLight = new THREE.DirectionalLight(0xfff4e0, 0.5);
    dirLight.position.set(6, 10, 4);
    scene.add(dirLight);
    const playerLight = new THREE.PointLight(0xffbe80, 1.3, 7.5 * CELL_SIZE, 2);
    scene.add(playerLight);

    lightsRef.current = {
      apply: (b: number) => {
        hemi.intensity = 0.75 * b;
        dirLight.intensity = 0.5 * b;
        playerLight.intensity = 1.3 * b;
      },
    };
    lightsRef.current.apply(brightnessRef.current);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(data.width * CELL_SIZE, data.height * CELL_SIZE),
      new THREE.MeshStandardMaterial({
        map: makeStoneFloorTexture(data.width * CELL_SIZE, data.height * CELL_SIZE),
        roughness: 0.95,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((data.width * CELL_SIZE) / 2, 0, (data.height * CELL_SIZE) / 2);
    scene.add(floor);

    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(data.width * CELL_SIZE, data.height * CELL_SIZE),
      new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 1 }),
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set((data.width * CELL_SIZE) / 2, 2.6, (data.height * CELL_SIZE) / 2);
    scene.add(ceiling);

    // Murs du niveau + un anneau de murs juste hors de la grille : sans ce
    // pourtour, regarder au-dela du bord (ou le sol/plafond s'arretent)
    // laissait voir le vide derriere, d'ou l'impression de "trou" signalee.
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
      new THREE.MeshStandardMaterial({
        map: makeStoneWallTexture(),
        roughness: 0.9,
      }),
      wallCells.length,
    );
    const m = new THREE.Matrix4();
    wallCells.forEach(([wx, wy], i) => {
      m.makeTranslation((wx + 0.5) * CELL_SIZE, 1.3, (wy + 0.5) * CELL_SIZE);
      wallMesh.setMatrixAt(i, m);
    });
    scene.add(wallMesh);

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
      endMesh.position.set((ex + 0.5) * CELL_SIZE, 1.2, (ey + 0.5) * CELL_SIZE);
      scene.add(endMesh);

      const endGlow = new THREE.PointLight(0xf43f5e, 1.6, 8 * CELL_SIZE, 2);
      endGlow.position.copy(endMesh.position);
      scene.add(endGlow);
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

    // --- Mini-carte : brouillard de guerre, remis a zero a chaque partie ---
    const discovered = new Set<string>();
    const minimapCanvas = minimapRef.current;
    const minimapCtx = minimapCanvas?.getContext("2d") ?? null;
    const minimapDpr = Math.min(window.devicePixelRatio, 2);
    if (minimapCanvas) {
      minimapCanvas.width = MINIMAP_SIZE * minimapDpr;
      minimapCanvas.height = MINIMAP_SIZE * minimapDpr;
      minimapCtx?.scale(minimapDpr, minimapDpr);
    }
    const minimapCellPx = MINIMAP_SIZE / Math.max(data.width, data.height);

    function revealAround(cx: number, cz: number) {
      for (let dx = -minimapRevealRadius; dx <= minimapRevealRadius; dx++) {
        for (let dz = -minimapRevealRadius; dz <= minimapRevealRadius; dz++) {
          discovered.add(cellKey(cx + dx, cz + dz));
        }
      }
    }

    function drawMinimap() {
      if (!minimapCtx) return;
      minimapCtx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
      minimapCtx.fillStyle = "rgba(0,0,0,0.55)";
      minimapCtx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

      for (let y = 0; y < data.height; y++) {
        for (let x = 0; x < data.width; x++) {
          if (!discovered.has(cellKey(x, y))) continue;
          minimapCtx.fillStyle = isSolid(x, y) ? "#3f3f46" : "#d4d4d8";
          minimapCtx.fillRect(
            x * minimapCellPx,
            y * minimapCellPx,
            minimapCellPx - 0.5,
            minimapCellPx - 0.5,
          );
        }
      }

      if (data.end && discovered.has(cellKey(data.end[0], data.end[1]))) {
        minimapCtx.fillStyle = "#f43f5e";
        minimapCtx.beginPath();
        minimapCtx.arc(
          (data.end[0] + 0.5) * minimapCellPx,
          (data.end[1] + 0.5) * minimapCellPx,
          Math.max(minimapCellPx * 0.4, 2),
          0,
          Math.PI * 2,
        );
        minimapCtx.fill();
      }

      const px = player.x * minimapCellPx;
      const pz = player.z * minimapCellPx;
      const dirLen = minimapCellPx * 1.3;
      const fx = -Math.sin(player.yaw);
      const fz = -Math.cos(player.yaw);
      minimapCtx.strokeStyle = "#c4b5fd";
      minimapCtx.lineWidth = 2;
      minimapCtx.beginPath();
      minimapCtx.moveTo(px, pz);
      minimapCtx.lineTo(px + fx * dirLen, pz + fz * dirLen);
      minimapCtx.stroke();
      minimapCtx.fillStyle = "#8b5cf6";
      minimapCtx.beginPath();
      minimapCtx.arc(px, pz, Math.max(minimapCellPx * 0.45, 3), 0, Math.PI * 2);
      minimapCtx.fill();
    }

    // --- Regarder autour ---
    // Souris : vrai pointer lock (le curseur reste fixe/cache, comme dans un
    // FPS) pour ne plus jamais sortir de l'ecran pendant qu'on tourne la tete.
    // Tactile : pas de pointer lock la-dessus, on garde le glisser-doigt direct.
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
        // ignore : le pointer lock n'est pas toujours disponible (iframe,
        // navigateur...). Le glisser manuel ci-dessous prend le relais.
      }
    }
    function onPointerLockChange() {
      const locked = document.pointerLockElement === renderer.domElement;
      setPointerLocked(locked);
      if (locked) setLookActive(true);
    }
    function onMouseMove(e: MouseEvent) {
      if (document.pointerLockElement !== renderer.domElement) return;
      applyLook(e.movementX, e.movementY);
    }
    renderer.domElement.addEventListener("click", onCanvasClick);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    document.addEventListener("mousemove", onMouseMove);

    // Glisser manuel : filet de secours pour tous les pointeurs (tactile,
    // ou souris si le pointer lock echoue/n'est pas dispo dans le
    // navigateur/contexte). Ignore quand le pointer lock est deja actif
    // pour ne pas cumuler les deux sources de rotation.
    let dragging = false;
    let lastDragX = 0;
    let lastDragY = 0;
    function onPointerDown(e: PointerEvent) {
      if (document.pointerLockElement === renderer.domElement) return;
      dragging = true;
      lastDragX = e.clientX;
      lastDragY = e.clientY;
      setLookActive(true);
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

    // --- Clavier : ZQSD ou WASD selon le reglage, + fleches ---
    const keys = new Set<string>();
    function onKeyDown(e: KeyboardEvent) {
      keys.add(e.key.toLowerCase());
      // Maj : verrouille/deverrouille la vue sans avoir a cliquer.
      if (e.key === "Shift") {
        if (document.pointerLockElement === renderer.domElement) {
          document.exitPointerLock?.();
        } else {
          try {
            renderer.domElement.requestPointerLock?.()?.catch(() => {});
          } catch {
            // ignore
          }
        }
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      keys.delete(e.key.toLowerCase());
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    let lastTime = performance.now();
    function tick() {
      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      if (!player.won) {
        const forwardKey = layoutRef.current === "azerty" ? "z" : "w";
        const backKey = "s";
        const leftKey = layoutRef.current === "azerty" ? "q" : "a";
        const rightKey = "d";

        let fwd = 0;
        let strafe = 0;
        if (keys.has(forwardKey) || keys.has("arrowup") || heldRef.current.forward) fwd += 1;
        if (keys.has(backKey) || keys.has("arrowdown") || heldRef.current.back) fwd -= 1;
        if (keys.has(leftKey) || keys.has("arrowleft")) strafe -= 1;
        if (keys.has(rightKey) || keys.has("arrowright")) strafe += 1;

        if (fwd !== 0 || strafe !== 0) {
          const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            player.yaw,
          );
          const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            player.yaw,
          );
          const move = new THREE.Vector3()
            .addScaledVector(forward, fwd)
            .addScaledVector(right, strafe);
          if (move.lengthSq() > 0) {
            move.normalize().multiplyScalar(MOVE_SPEED * delta);
            const [nx, nz] = resolveCollision(player.x + move.x, player.z + move.z);
            player.x = nx;
            player.z = nz;
          }
        }

        if (data.end) {
          const [ex, ey] = data.end;
          const ddx = player.x - (ex + 0.5);
          const ddz = player.z - (ey + 0.5);
          if (ddx * ddx + ddz * ddz < 0.4 * 0.4) {
            player.won = true;
            setWon(true);
            onWinRef.current?.();
          }
        }
      }

      camera.position.set(player.x * CELL_SIZE, 1.5, player.z * CELL_SIZE);
      camera.rotation.y = player.yaw;
      camera.rotation.x = player.pitch;

      playerLight.position.copy(camera.position);
      if (endMesh) endMesh.rotation.y += delta * 1.4;

      revealAround(Math.floor(player.x), Math.floor(player.z));
      drawMinimap();

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
      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock?.();
      }
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [data, minimapRevealRadius]);

  const forwardLabel = layout === "azerty" ? "Z" : "W";
  const leftLabel = layout === "azerty" ? "Q" : "A";

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      containerRef.current?.requestFullscreen?.();
    }
  }

  return (
    <div className="h-full w-full">
      <div
        ref={containerRef}
        className="relative h-full w-full overflow-hidden bg-black select-none"
      >
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {backHref && (
            <Link
              href={backHref}
              className="pointer-events-auto rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-zinc-300 backdrop-blur hover:bg-black/80 hover:text-white"
            >
              ← Retour{title ? ` · ${title}` : ""}
            </Link>
          )}
          <div className="pointer-events-none flex items-center gap-2">
            <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              ⏱️ {seconds}s
            </span>
            {won && (
              <span className="animate-bounce rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 px-3 py-1 text-xs font-bold text-white shadow-md shadow-emerald-500/30">
                🎉 Gagné !
              </span>
            )}
          </div>
        </div>

        {!pointerLocked && !lookActive && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-black/70 px-4 py-2 text-center text-xs font-medium text-white backdrop-blur">
              🖱️ Clique sur la vue pour regarder autour
              <br className="sm:hidden" /> (ou glisse avec le doigt)
            </span>
          </div>
        )}

        <div className="absolute right-3 top-3 flex gap-2">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex size-9 items-center justify-center rounded-full bg-black/60 text-lg text-white backdrop-blur hover:bg-black/80"
            aria-label="Plein écran"
          >
            ⛶
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen((o) => !o)}
            className="flex size-9 items-center justify-center rounded-full bg-black/60 text-lg text-white backdrop-blur hover:bg-black/80"
            aria-label="Réglages"
          >
            ⚙️
          </button>
        </div>

        {settingsOpen && (
          <div className="absolute right-3 top-14 w-56 rounded-xl border border-zinc-700 bg-zinc-900/95 p-3 text-white shadow-xl backdrop-blur">
            <p className="mb-1 text-xs font-semibold text-zinc-300">Touches</p>
            <div className="mb-3 flex gap-2">
              <button
                type="button"
                onClick={() => changeLayout("azerty")}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium ${
                  layout === "azerty" ? "bg-violet-600" : "bg-zinc-800 text-zinc-300"
                }`}
              >
                ZQSD (FR)
              </button>
              <button
                type="button"
                onClick={() => changeLayout("qwerty")}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium ${
                  layout === "qwerty" ? "bg-violet-600" : "bg-zinc-800 text-zinc-300"
                }`}
              >
                WASD (EN)
              </button>
            </div>
            <p className="mb-1 text-xs font-semibold text-zinc-300">Sensibilité souris</p>
            <input
              type="range"
              min={0.4}
              max={3}
              step={0.1}
              value={sensitivity}
              onChange={(e) => changeSensitivity(Number(e.target.value))}
              className="mb-3 w-full accent-violet-500"
            />
            <p className="mb-1 text-xs font-semibold text-zinc-300">Luminosité</p>
            <input
              type="range"
              min={0.5}
              max={1.8}
              step={0.05}
              value={brightness}
              onChange={(e) => changeBrightness(Number(e.target.value))}
              className="w-full accent-violet-500"
            />
          </div>
        )}

        <canvas
          ref={minimapRef}
          style={{ width: MINIMAP_SIZE, height: MINIMAP_SIZE }}
          className="pointer-events-none absolute bottom-3 right-3 rounded-lg border border-white/20 shadow-lg"
        />

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

        <p className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-zinc-400">
          {forwardLabel}/{leftLabel}/S/D ou flèches pour marcher · clique/glisse pour tourner la
          tête · Maj pour verrouiller/libérer la vue.
        </p>
      </div>
    </div>
  );
}
