"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { AIR, BLOCKS, CHUNK, PALETTE, SOCLE, WORLD_HEIGHT, World, block, buildChunkMesh, decodeEdits, encodeEdits, raycast, spawnPoint, type MeshData, type SavedWorld } from "@/lib/voxel";
import { createVoxelAtlas } from "@/lib/voxelTextures";
import { createVoxelAtmosphere } from "@/lib/voxelAtmosphere";
import { VoxelAudio } from "@/lib/voxelAudio";
import { CUBES_SAVE_KEY } from "@/lib/voxelSave";
import { GIVE_CUBES_EVENT, type CubesGive } from "@/lib/adminGive";
import { loadBrightness3D, loadLayout3D, loadQuality3D, loadSensitivity3D, saveBrightness3D } from "@/lib/settings3d";
import { createAnimatedModel, type AnimatedModel } from "@/lib/models3d";
import Game3DSettings from "./Game3DSettings";
import CubesBlockIcon from "./CubesBlockIcon";

type Hud = { selected: number; hotbar: number[]; stock: Record<string, number>; health: number; target: string; progress: number; chunks: number; fps: number };
type Command = { resume: () => void; resumeWithoutLock: () => void; pause: () => void; save: () => boolean; export: () => void; select: (slot: number) => void; assign: (id: number) => void; respawn: () => void };
type Enemy = { group: THREE.Group; model?: AnimatedModel; hp: number; cooldown: number; vy: number };

export default function CubesScene({ initial, onExit }: { initial: SavedWorld; onExit: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const commands = useRef<Command | null>(null);
  const [paused, setPaused] = useState(true);
  const [inventory, setInventory] = useState(false);
  const [message, setMessage] = useState("Préparation du terrain…");
  const [fatal, setFatal] = useState(false);
  const [lockFailed, setLockFailed] = useState(false);
  const [terrainReady, setTerrainReady] = useState(false);
  const [inventorySearch, setInventorySearch] = useState("");
  const [hud, setHud] = useState<Hud>({ selected: 0, hotbar: initial.hotbar, stock: initial.stock, health: 100, target: "", progress: 0, chunks: 0, fps: 0 });

  useEffect(() => {
    const mount = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "low-power" }); }
    catch { queueMicrotask(() => { setFatal(true); setMessage("WebGL n’est pas disponible. Active l’accélération graphique du navigateur pour jouer."); }); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
    mount.appendChild(renderer.domElement);
    const canvas = renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute("aria-label", "Monde Cubes : clavier pour se déplacer, flèches pour regarder sans capture de souris");
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#d7e8da");
    scene.fog = new THREE.Fog("#d7e8da", 25, 48);
    const camera = new THREE.PerspectiveCamera(72, 1, .07, 190);
    camera.rotation.order = "YXZ";
    const ambient = new THREE.HemisphereLight("#dceeff", "#889765", loadBrightness3D() * 1.65);
    scene.add(ambient);
    const sunlight = new THREE.DirectionalLight("#fff0cb", .95);
    sunlight.position.set(-60, 90, -45); scene.add(sunlight);
    const atmosphere = createVoxelAtmosphere(scene);
    const atlas = createVoxelAtlas();
    const material = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true, alphaTest: .15 });
    const waterMaterial = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true, color: "#b7fff0", transparent: true, opacity: .7, depthWrite: false, side: THREE.DoubleSide });
    const world = new World(initial.seed, decodeEdits(initial.edits));
    const meshes = new Map<string, THREE.Group>();
    const player = { ...initial.player };
    const hotbar = [...initial.hotbar], stock = { ...initial.stock };
    const audio = new VoxelAudio();
    const keys = new Set<string>();
    let selected = 0, health = 100, vy = 0, grounded = false, flying = false;
    // Survie : un moment de calme avant le premier zombie, et la vie remonte
    // doucement quand on ne prend plus de coups (sinon chaque blessure etait
    // definitive, et un nouveau joueur mourait avant d'avoir construit un abri).
    const GRACE_MS = 45000, SPAWN_EVERY_MS = 15000;
    let hurtAt = 0, regenAt = 0;
    let active = false, disposed = false, ready = false, held = false, mining = "", progress = 0;
    let withoutLock = false;
    let frameCount = 0, fps = 0, metricsAt = performance.now(), lastHud = 0, saveAt = performance.now(), attackAt = 0;
    let spawnChecked = false;
    let settingsAt = 0;
    let layout = loadLayout3D(), quality = loadQuality3D(), sensitivity = loadSensitivity3D();
    const direction = new THREE.Vector3();
    const attackRay = new THREE.Ray(camera.position, direction), enemyCenter = new THREE.Vector3();
    // Douze aretes fusionnees : un seul appel de rendu, sans les diagonales du wireframe.
    const edges: THREE.BoxGeometry[] = [];
    for (const a of [-.5075, .5075]) for (const b of [-.5075, .5075]) {
      edges.push(new THREE.BoxGeometry(1.03, .018, .018).translate(0, a, b));
      edges.push(new THREE.BoxGeometry(.018, 1.03, .018).translate(a, 0, b));
      edges.push(new THREE.BoxGeometry(.018, .018, 1.03).translate(a, b, 0));
    }
    const outlineGeometry = mergeGeometries(edges)!;
    for (const edge of edges) edge.dispose();
    const outlineMaterial = new THREE.MeshLambertMaterial({ color: "#fff1ad", emissive: "#8d713b" });
    const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
    scene.add(outline); outline.visible = false;
    const enemies: Enemy[] = [];
    const enemyGeo = new THREE.BoxGeometry(.6, 1.65, .4);
    const enemyMat = new THREE.MeshLambertMaterial({ color: "#567447" });

    function geometry(data: MeshData) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
      g.setAttribute("normal", new THREE.BufferAttribute(data.normals, 3));
      g.setAttribute("uv", new THREE.BufferAttribute(data.uvs, 2));
      g.setAttribute("color", new THREE.BufferAttribute(data.colors, 3));
      g.setIndex(new THREE.BufferAttribute(data.indices, 1));
      g.computeBoundingSphere(); return g;
    }
    function removeMesh(key: string) {
      const group = meshes.get(key);
      if (!group) return;
      group.traverse(obj => { if (obj instanceof THREE.Mesh) obj.geometry.dispose(); });
      scene.remove(group); meshes.delete(key);
    }
    function rebuild(key: string) {
      const c = world.chunks.get(key);
      if (!c) return;
      removeMesh(key);
      const data = buildChunkMesh(world, c), group = new THREE.Group();
      group.position.set(c.cx * CHUNK, 0, c.cz * CHUNK);
      if (data.solid) group.add(new THREE.Mesh(geometry(data.solid), material));
      if (data.water) group.add(new THREE.Mesh(geometry(data.water), waterMaterial));
      scene.add(group); meshes.set(key, group);
      c.dirty = false; world.dirty.delete(key);
    }
    function terrainStep() {
      const cx = Math.floor(player.x / CHUNK), cz = Math.floor(player.z / CHUNK);
      const radius = quality === "performance" ? 1 : 2;
      const fog = scene.fog as THREE.Fog;
      fog.near = radius === 1 ? 12 : 25;
      fog.far = radius === 1 ? 23 : 42;
      const candidates: { x: number; z: number; distance: number }[] = [];
      for (let z = -radius; z <= radius; z++) for (let x = -radius; x <= radius; x++) candidates.push({ x: cx + x, z: cz + z, distance: x * x + z * z });
      candidates.sort((a, b) => a.distance - b.distance);
      const missing = candidates.find(c => !world.chunk(c.x, c.z));
      if (missing) {
        const c = world.ensureChunk(missing.x, missing.z);
        world.lightChunk(c);
        for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) {
          const neighbor = world.chunk(c.cx + x, c.cz + z);
          if (neighbor) neighbor.dirty = true;
        }
      }
      // Generer puis mailler dans la meme image depassait parfois 16 ms : un seul des deux par image.
      const dirty = missing ? undefined : candidates.find(c => world.chunk(c.x, c.z)?.dirty);
      if (dirty) rebuild(`${dirty.x},${dirty.z}`);
      for (const [key, c] of world.chunks) if (Math.abs(c.cx - cx) > radius + 1 || Math.abs(c.cz - cz) > radius + 1) {
        removeMesh(key); world.unloadChunk(c.cx, c.cz); world.dirty.delete(key);
      }
      if (!ready && candidates.filter(c => c.distance <= 1).every(c => meshes.has(`${c.x},${c.z}`))) {
        ready = true; setTerrainReady(true); setMessage("Terrain prêt. Clique sur Jouer pour commencer.");
      }
      const spawnAreaLoaded = [-.29, .29].every(x => [-.29, .29].every(z => world.isLoaded(player.x + x, player.z + z)));
      if (!spawnChecked && spawnAreaLoaded) {
        // Une graine peut deposer le joueur au milieu d'un arbre.
        while (collides(player.x, player.y, player.z) && player.y < WORLD_HEIGHT) player.y++;
        spawnChecked = true;
      }
    }
    function collides(x: number, y: number, z: number, height = 1.75, radius = .29) {
      for (let bx = Math.floor(x - radius); bx <= Math.floor(x + radius); bx++) for (let bz = Math.floor(z - radius); bz <= Math.floor(z + radius); bz++) {
        if (!world.isLoaded(bx, bz)) return true;
        for (let by = Math.floor(y); by <= Math.floor(y + height - .0001); by++) if (by < 0 || block(world.getBlock(bx, by, bz)).solid) return true;
      }
      return false;
    }
    function snapshot(): SavedWorld {
      return { version: 1, seed: initial.seed, mode: initial.mode, player: { ...player }, hotbar: [...hotbar], stock: { ...stock }, edits: encodeEdits(world.edits), savedAt: Date.now() };
    }
    function save() {
      try { localStorage.setItem(CUBES_SAVE_KEY, JSON.stringify(snapshot())); setMessage("Monde sauvegardé sur cet appareil."); return true; }
      catch { setMessage("Sauvegarde locale impossible. Exporte ton monde pour conserver tes constructions."); return false; }
    }
    function resume() {
      if (!ready || health <= 0) return;
      setInventory(false);
      withoutLock = false;
      try { const result = canvas.requestPointerLock(); result?.catch(lockError); }
      catch { lockError(); }
    }
    function lockError() {
      if (disposed) return;
      setLockFailed(true); setMessage("Ce navigateur refuse la capture de souris. Tu peux jouer sans capture : utilise les flèches pour regarder.");
    }
    function pause() {
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      active = false; setPaused(true); keys.clear(); mouseUp(); save();
    }
    function syncHud(target = "") {
      setHud({ selected, hotbar: [...hotbar], stock: { ...stock }, health, target, progress, chunks: world.chunks.size, fps });
    }
    function respawn() {
      Object.assign(player, spawnPoint(initial.seed)); vy = 0; health = 100; spawnChecked = false; flying = false;
      for (const enemy of enemies) removeEnemy(enemy);
      enemies.length = 0;
      spawnAt = performance.now() + GRACE_MS;
      syncHud(); setMessage("Tu es de retour au point de départ. Tes constructions sont conservées.");
    }
    commands.current = {
      resume, save, respawn, pause,
      resumeWithoutLock() { if (!ready || health <= 0) return; withoutLock = true; active = true; setInventory(false); setPaused(false); canvas.focus(); },
      select(slot) { selected = slot; syncHud(); },
      assign(id) { hotbar[selected] = id; syncHud(); },
      export() {
        const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot())], { type: "application/json" }));
        const a = document.createElement("a"); a.href = url; a.download = `cubes-${initial.seed}.json`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
    };
    function targetBlock() {
      camera.getWorldDirection(direction);
      return raycast(world, camera.position.x, camera.position.y, camera.position.z, direction.x, direction.y, direction.z, 6);
    }
    function place() {
      const hit = targetBlock(), id = hotbar[selected];
      if (!hit || hit.ny <= 0 || hit.ny >= WORLD_HEIGHT || !world.isLoaded(hit.nx, hit.nz)) return;
      if (block(world.getBlock(hit.nx, hit.ny, hit.nz)).solid) return;
      if (block(id).solid && hit.nx + 1 > player.x - .29 && hit.nx < player.x + .29 && hit.nz + 1 > player.z - .29 && hit.nz < player.z + .29 && hit.ny + 1 > player.y && hit.ny < player.y + 1.75) return;
      if (initial.mode === "survie" && !(stock[id] > 0)) { setMessage("Récolte ce bloc avant de le poser."); return; }
      world.setBlock(hit.nx, hit.ny, hit.nz, id);
      if (initial.mode === "survie") stock[id]--;
      audio.play(block(id).sound); syncHud();
    }
    function mouseDown(e: MouseEvent) {
      if (!active) return;
      if (e.button === 2) place();
      if (e.button === 0) { held = true; }
    }
    function mouseUp() { held = false; progress = 0; mining = ""; }
    function mouseMove(e: MouseEvent) {
      if (!active || withoutLock) return;
      player.yaw -= e.movementX * .0015 * sensitivity;
      player.pitch = THREE.MathUtils.clamp(player.pitch - e.movementY * .0015 * sensitivity, -1.5, 1.5);
    }
    function lockChange() {
      active = document.pointerLockElement === canvas;
      setPaused(!active); keys.clear(); mouseUp();
      if (!active) save();
    }
    function keyDown(e: KeyboardEvent) {
      if (!active) return;
      e.preventDefault(); keys.add(e.code); keys.add(e.key.toLowerCase());
      if (/^Digit[1-9]$/.test(e.code)) { selected = Number(e.code.slice(-1)) - 1; syncHud(); }
      if (e.code === "KeyE" && !e.repeat) { setInventory(true); pause(); }
      if (e.code === "Escape") pause();
      if (e.code === "KeyF" && !e.repeat && initial.mode === "creatif") { flying = !flying; vy = 0; setMessage(flying ? "Vol activé · Espace : monter · Maj : descendre" : "Vol désactivé"); }
    }
    function keyUp(e: KeyboardEvent) { keys.delete(e.code); keys.delete(e.key.toLowerCase()); }
    function wheel(e: WheelEvent) { if (active) { e.preventDefault(); selected = (selected + (e.deltaY > 0 ? 1 : 8)) % 9; syncHud(); } }
    function blur() { if (active) pause(); }
    function contextMenu(e: Event) { e.preventDefault(); }
    function resize() { const { width, height } = mount.getBoundingClientRect(); renderer.setSize(width, height); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix(); }
    const observer = new ResizeObserver(resize); observer.observe(mount); resize();
    document.addEventListener("pointerlockchange", lockChange);
    document.addEventListener("pointerlockerror", lockError);
    document.addEventListener("mousemove", mouseMove);
    document.addEventListener("mouseup", mouseUp);
    window.addEventListener("keydown", keyDown); window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", blur); window.addEventListener("pagehide", save);
    // Give admin (bouton 🛡) : des blocs ajoutes en pleine partie de survie.
    function adminGive(e: Event) {
      const detail = (e as CustomEvent<CubesGive>).detail;
      if (initial.mode !== "survie" || !detail) return;
      for (const [id, n] of Object.entries(detail.blocks)) stock[id] = Math.min(1_000_000, (stock[id] ?? 0) + n);
      detail.handled = true;
      syncHud(); save();
    }
    window.addEventListener(GIVE_CUBES_EVENT, adminGive);
    canvas.addEventListener("mousedown", mouseDown); canvas.addEventListener("contextmenu", contextMenu); canvas.addEventListener("wheel", wheel, { passive: false });

    function disposeModel(model: AnimatedModel) {
      model.dispose();
      const skeletons = new Set<THREE.Skeleton>();
      model.root.traverse(object => { if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton); });
      for (const skeleton of skeletons) skeleton.dispose();
    }
    function removeEnemy(enemy: Enemy) {
      enemy.hp = 0;
      scene.remove(enemy.group);
      if (enemy.model) { disposeModel(enemy.model); enemy.model = undefined; }
    }
    function animateEnemy(enemy: Enemy, names: string[]) {
      const name = names.find(candidate => enemy.model?.has(candidate));
      if (name) enemy.model?.play(name);
    }
    function spawnEnemy() {
      if (initial.mode !== "survie" || enemies.length >= 4) return;
      const angle = Math.random() * Math.PI * 2;
      const x = player.x + Math.cos(angle) * 14, z = player.z + Math.sin(angle) * 14;
      if (!world.isLoaded(x, z)) return;
      let y = WORLD_HEIGHT - 3;
      while (y > 1 && !block(world.getBlock(Math.floor(x), y - 1, Math.floor(z))).solid) y--;
      if (collides(x, y, z) || Math.abs(y - player.y) > 8) return;
      const group = new THREE.Group(); group.position.set(x, y, z);
      const fallback = new THREE.Mesh(enemyGeo, enemyMat); fallback.position.y = .825; group.add(fallback); scene.add(group);
      const enemy = { group, hp: 3, cooldown: 0, vy: 0, model: undefined as AnimatedModel | undefined }; enemies.push(enemy);
      void createAnimatedModel("zombie-b", 1.7).then(model => {
        if (disposed || enemy.hp <= 0) { disposeModel(model); return; }
        enemy.model = model; group.remove(fallback); group.add(model.root);
        model.play(model.has("Walk") ? "Walk" : "Walking");
      }).catch(() => { /* Le personnage en cubes reste visible. */ });
    }
    let last = performance.now(), spawnAt = last + GRACE_MS;
    const timer = window.setInterval(() => {
      const now = performance.now(), dt = Math.min((now - last) / 1000, .05); last = now;
      // Les reglages restent reactifs sans lire le stockage a chaque mouvement de souris.
      if (now - settingsAt > 500) {
        layout = loadLayout3D(); quality = loadQuality3D(); sensitivity = loadSensitivity3D();
        ambient.intensity = loadBrightness3D() * 1.65; settingsAt = now;
      }
      // Un seul chunk genere et un seul maillage par tick pour repartir le cout.
      terrainStep();
      if (active && ready && health > 0) {
        if (withoutLock) {
          player.yaw += (Number(keys.has("ArrowLeft")) - Number(keys.has("ArrowRight"))) * dt * 1.6;
          player.pitch = THREE.MathUtils.clamp(player.pitch + (Number(keys.has("ArrowUp")) - Number(keys.has("ArrowDown"))) * dt * 1.2, -1.5, 1.5);
        }
        const forward = Number(keys.has(layout === "azerty" ? "z" : "w")) - Number(keys.has("s"));
        const strafe = Number(keys.has("d")) - Number(keys.has(layout === "azerty" ? "q" : "a"));
        const norm = Math.hypot(forward, strafe) || 1;
        const inWater = block(world.getBlock(Math.floor(player.x), Math.floor(player.y + 1), Math.floor(player.z))).liquid;
        const shift = keys.has("ShiftLeft") || keys.has("ShiftRight");
        const speed = (flying ? 8 : inWater ? 2.8 : shift ? 6 : 4.2);
        const dx = (strafe * Math.cos(player.yaw) - forward * Math.sin(player.yaw)) / norm * speed * dt;
        const dz = (-forward * Math.cos(player.yaw) - strafe * Math.sin(player.yaw)) / norm * speed * dt;
        if (!collides(player.x + dx, player.y, player.z)) player.x += dx;
        if (!collides(player.x, player.y, player.z + dz)) player.z += dz;
        if (flying) vy = (Number(keys.has("Space")) - Number(shift)) * 7;
        else {
          if (keys.has("Space") && (grounded || inWater)) { vy = inWater ? 4 : 7.5; grounded = false; }
          vy = Math.max(inWater ? -3 : -28, vy - (inWater ? 6 : 22) * dt);
        }
        const steps = Math.max(1, Math.ceil(Math.abs(vy * dt) / .15));
        grounded = false;
        for (let s = 0; s < steps; s++) {
          const dy = vy * dt / steps;
          if (player.y + dy < WORLD_HEIGHT + 3 && !collides(player.x, player.y + dy, player.z)) player.y += dy;
          else { grounded = vy < 0; if (grounded && vy < -13 && initial.mode === "survie") { health = Math.max(0, health - Math.round((-vy - 12) * 3)); hurtAt = now; audio.play("hurt"); } vy = 0; break; }
        }
        camera.position.set(player.x, player.y + 1.6, player.z); camera.rotation.set(player.pitch, player.yaw, 0);
        const hit = targetBlock();
        outline.visible = !!hit;
        if (hit) outline.position.set(hit.x + .5, hit.y + .5, hit.z + .5);
        let attacked = false;
        if (held) {
          let target: Enemy | undefined, nearest = 3.2;
          for (const enemy of enemies) {
            const distance = enemy.group.position.distanceTo(camera.position);
            enemyCenter.copy(enemy.group.position); enemyCenter.y++;
            if (enemy.hp > 0 && distance < nearest && attackRay.distanceToPoint(enemyCenter) < .75 && (!hit || hit.distance > distance - .8)) { target = enemy; nearest = distance; }
          }
          // Le delai entre deux coups ne doit pas creuser le terrain derriere la creature.
          attacked = !!target;
          if (target && now - attackAt > 350) { target.hp--; attackAt = now; audio.play("hit"); if (target.hp <= 0) removeEnemy(target); }
        }
        if (held && hit && hit.id !== SOCLE && !attacked) {
          const key = `${hit.x},${hit.y},${hit.z}`;
          if (mining !== key) { mining = key; progress = 0; }
          progress += dt / (initial.mode === "creatif" ? .18 : Math.max(.1, block(hit.id).breakTime));
          if (progress >= 1) {
            world.setBlock(hit.x, hit.y, hit.z, AIR);
            const drop = block(hit.id).drop ?? hit.id; stock[drop] = (stock[drop] ?? 0) + 1;
            audio.play(block(hit.id).sound); progress = 0;
          }
        } else { progress = 0; mining = ""; }
        for (let i = enemies.length - 1; i >= 0; i--) {
          const enemy = enemies[i], p = enemy.group.position;
          if (enemy.hp <= 0 || p.distanceTo(camera.position) > 55) { removeEnemy(enemy); enemies.splice(i, 1); continue; }
          const distance = Math.hypot(player.x - p.x, player.z - p.z);
          enemy.group.rotation.y = Math.atan2(player.x - p.x, player.z - p.z);
          let moving = false;
          if (distance > 1.1) {
            const ex = (player.x - p.x) / distance * dt * 1.4, ez = (player.z - p.z) / distance * dt * 1.4;
            if (!collides(p.x + ex, p.y, p.z + ez, 1.7)) { p.x += ex; p.z += ez; moving = true; }
            else if (collides(p.x, p.y - .08, p.z, 1.7) && !collides(p.x, p.y + 1, p.z, 1.7) && !collides(p.x + ex, p.y + 1, p.z + ez, 1.7)) {
              // Une marche d'un bloc doit etre franchie avant que la gravite ramene au sol.
              p.set(p.x + ex, p.y + 1, p.z + ez); enemy.vy = 0; moving = true;
            } else {
              if (ex !== 0 && !collides(p.x + ex, p.y, p.z, 1.7)) { p.x += ex; moving = true; }
              if (ez !== 0 && !collides(p.x, p.y, p.z + ez, 1.7)) { p.z += ez; moving = true; }
            }
          } else if (now > enemy.cooldown && Math.abs(p.y - player.y) < 2) {
            health = Math.max(0, health - 10); enemy.cooldown = now + 1000; hurtAt = now; audio.play("hurt");
          }
          animateEnemy(enemy, distance <= 1.1 && Math.abs(p.y - player.y) < 2 ? ["Attack", "Idle"] : moving ? ["Walk", "Walking", "Run"] : ["Idle", "Walk"]);
          enemy.vy = Math.max(-8, enemy.vy - dt * 15);
          if (!collides(p.x, p.y + enemy.vy * dt, p.z, 1.7)) p.y += enemy.vy * dt; else enemy.vy = 0;
          enemy.model?.update(dt);
        }
        if (now - spawnAt > SPAWN_EVERY_MS) { spawnEnemy(); spawnAt = now; }
        if (initial.mode === "survie" && health > 0 && health < 100 && now - hurtAt > 6000 && now - regenAt > 1500) { health = Math.min(100, health + 2); regenAt = now; }
        if (health <= 0) { pause(); setMessage("Les créatures t’ont rattrapé. Tes constructions et ton inventaire sont conservés."); syncHud(); }
        if (now - lastHud > 150) { syncHud(hit ? block(hit.id).name : ""); lastHud = now; }
      } else {
        camera.position.set(player.x, player.y + 1.6, player.z); camera.rotation.set(player.pitch, player.yaw, 0);
      }
      if (now - saveAt > 20000 && ready) { save(); saveAt = now; }
      frameCount++;
      if (now - metricsAt >= 1000) { fps = Math.round(frameCount * 1000 / (now - metricsAt)); frameCount = 0; metricsAt = now; }
      atmosphere.update(camera, dt);
      waterMaterial.opacity = .68 + Math.sin(now * .0007) * .035;
      renderer.render(scene, camera);
    }, 16);
    return () => {
      disposed = true; clearInterval(timer); if (ready) save(); commands.current = null;
      document.removeEventListener("pointerlockchange", lockChange); document.removeEventListener("mousemove", mouseMove); document.removeEventListener("mouseup", mouseUp);
      document.removeEventListener("pointerlockerror", lockError);
      window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); window.removeEventListener("blur", blur); window.removeEventListener("pagehide", save);
      window.removeEventListener(GIVE_CUBES_EVENT, adminGive);
      canvas.removeEventListener("mousedown", mouseDown); canvas.removeEventListener("contextmenu", contextMenu); canvas.removeEventListener("wheel", wheel);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      observer.disconnect(); for (const key of meshes.keys()) removeMesh(key);
      for (const enemy of enemies) removeEnemy(enemy);
      atmosphere.dispose();
      enemyGeo.dispose(); enemyMat.dispose(); outlineGeometry.dispose(); outlineMaterial.dispose(); atlas.dispose(); material.dispose(); waterMaterial.dispose(); audio.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    };
  }, [initial]);

  const visibleBlocks = PALETTE.filter(id => block(id).name.toLocaleLowerCase("fr").includes(inventorySearch.toLocaleLowerCase("fr")));
  return <div className="relative h-full w-full bg-[#152b23] text-[#faf7e8]">
    <div ref={host} className="absolute inset-0" />
    {!paused && <>
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 drop-shadow"><span className="absolute left-2 top-0 h-5 w-px bg-white/90" /><span className="absolute left-0 top-2 h-px w-5 bg-white/90" /></div>
      <div className="pointer-events-none absolute left-4 top-4 rounded-2xl border border-white/15 bg-[#13251e]/80 px-4 py-3 shadow-lg">
        <p className="text-[10px] font-bold uppercase tracking-[.25em] text-[#d4e7b9]">Cubes <span className="ml-2 font-normal tracking-normal text-white/70">{initial.mode === "creatif" ? "Exploration créative" : "Survie"}</span></p>
        {initial.mode === "survie" && <div className="mt-2 flex items-center gap-2"><span aria-hidden="true" className="text-rose-300">♥</span><div role="meter" aria-label="Vie" aria-valuenow={hud.health} aria-valuemin={0} aria-valuemax={100} className="h-1.5 w-28 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-amber-200 transition-[width]" style={{ width: `${hud.health}%` }} /></div><span className="text-xs tabular-nums">{hud.health}</span></div>}
      </div>
      <button className="absolute right-4 top-4 rounded-xl border border-white/20 bg-[#13251e]/80 px-4 py-2 text-sm shadow-lg hover:bg-[#13251e]" onClick={() => commands.current?.pause()}>Ⅱ <span className="ml-1">Pause</span><kbd className="ml-3 hidden rounded border border-white/20 px-1.5 text-[10px] text-white/60 sm:inline">Échap</kbd></button>
      {hud.target && <div className="pointer-events-none absolute left-1/2 top-[56%] -translate-x-1/2 rounded-lg bg-[#142c21]/75 px-3 py-1.5 text-center text-xs shadow">{hud.target}{hud.progress > 0 && <div className="mt-1.5 h-1 w-28 overflow-hidden rounded bg-white/20"><div className="h-full bg-amber-200" style={{ width: `${Math.min(100, hud.progress * 100)}%` }} /></div>}</div>}
      <div className="pointer-events-none absolute bottom-3 left-3 hidden text-[10px] text-white/75 drop-shadow sm:block">{hud.fps} i/s</div>
      <div className="pointer-events-none absolute bottom-3 right-3 hidden text-[10px] text-white/75 drop-shadow lg:block">E · Inventaire &nbsp; {initial.mode === "creatif" ? "F · Vol" : "Maj · Courir"}</div>
    </>}
    {!paused && <div className="absolute bottom-5 left-1/2 max-w-full -translate-x-1/2">
      <p className="mb-2 text-center text-xs font-medium text-white drop-shadow">{block(hud.hotbar[hud.selected]).name}</p>
      <div className="flex gap-1 rounded-2xl border border-white/15 bg-[#14261d]/90 p-1.5 shadow-2xl sm:gap-1.5 sm:p-2">
      {hud.hotbar.map((id, slot) => <button key={slot} title={`${slot + 1} · ${block(id).name}`} aria-label={`Case ${slot + 1} : ${block(id).name}`} aria-pressed={hud.selected === slot} onClick={() => commands.current?.select(slot)} className={`relative flex h-12 w-9 items-center justify-center rounded-lg border transition-colors sm:h-14 sm:w-12 ${hud.selected === slot ? "border-[#eed896] bg-[#eed896]/20 shadow-[inset_0_0_12px_#eed89620]" : "border-white/5 bg-white/5 hover:bg-white/10"}`}>
        <span className="absolute left-1 top-0.5 text-[9px] text-white/50">{slot + 1}</span><CubesBlockIcon id={id} size={30} />
        {initial.mode === "survie" && <span className="absolute bottom-0.5 right-1 text-[10px] tabular-nums">{hud.stock[id] ?? 0}</span>}
      </button>)}
      </div>
    </div>}
    {paused && <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-[#081c14]/60 p-4 backdrop-blur-sm">
      <div className="relative my-auto w-full max-w-2xl rounded-3xl border border-[#d1ddb8]/20 bg-[#142a20]/95 p-5 shadow-2xl sm:p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[.3em] text-[#c8dba8]">Cubes · {initial.mode === "creatif" ? "Mode créatif" : "Mode survie"}</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight">{inventory ? "À toi de construire." : healthLabel(hud.health)}</h2>
        <p role="status" className="mt-3 text-xs leading-5 text-[#b9c9b9]">{message}</p>
        {inventory ? <>
          <div className="mt-4 flex items-center justify-between gap-3"><p className="text-xs text-[#b9c9b9]">Choisis une case, puis un bloc.</p><input aria-label="Rechercher un bloc" value={inventorySearch} onChange={e => setInventorySearch(e.target.value)} placeholder="Rechercher…" className="w-40 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs outline-none focus:border-amber-200" /></div>
          <div className="mt-3 flex gap-1">{hud.hotbar.map((id, slot) => <button key={slot} aria-label={`Modifier la case ${slot + 1}`} aria-pressed={hud.selected === slot} onClick={() => commands.current?.select(slot)} className={`flex flex-1 flex-col items-center rounded-lg border py-2 ${hud.selected === slot ? "border-amber-200 bg-amber-100/15" : "border-white/10 bg-white/5"}`}><CubesBlockIcon id={id} size={24} /><span className="text-[9px] text-white/50">{slot + 1}</span></button>)}</div>
          <div className="mt-3 grid max-h-56 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-5">{visibleBlocks.map(id => <button key={id} onClick={() => commands.current?.assign(id)} className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-2 text-[11px] transition-colors hover:border-amber-200/60 hover:bg-white/10"><CubesBlockIcon id={id} size={34} />{BLOCKS[id].name}{initial.mode === "survie" && <span className="text-amber-200">{hud.stock[id] ?? 0} en réserve</span>}</button>)}</div>
          {visibleBlocks.length === 0 && <p className="mt-3 text-sm text-white/60">Aucun bloc trouvé.</p>}
        </> : <div className="mt-5 grid gap-2 sm:grid-cols-2">{[
          ["ZQSD / WASD", "Se déplacer"], ["Souris", "Regarder autour de soi"], ["Espace", "Sauter / nager"], ["Clic gauche", "Maintenir pour creuser"], ["Clic droit", "Poser un bloc"], ["E", "Ouvrir l’inventaire"], ["1–9 / molette", "Changer de bloc"], initial.mode === "creatif" ? ["F · Espace / Maj", "Vol · monter / descendre"] : ["Maj", "Courir"],
        ].map(([key, action]) => <div key={key} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2.5 text-xs"><span className="text-[#b9c9b9]">{action}</span><kbd className="rounded border border-white/15 bg-black/10 px-2 py-1 text-[10px] text-[#f2df9f]">{key}</kbd></div>)}</div>}
        <div className="mt-5 flex flex-wrap gap-2">
          {!fatal && <button disabled={!terrainReady} onClick={() => { if (hud.health <= 0) commands.current?.respawn(); else commands.current?.resume(); }} className="rounded-xl bg-[#e4d39a] px-6 py-3 font-bold text-[#172d20] shadow-lg hover:bg-[#f4e4ac] disabled:cursor-wait disabled:opacity-50">{!terrainReady ? "Préparation…" : hud.health <= 0 ? "Réapparaître" : "Jouer"}</button>}
          {lockFailed && hud.health > 0 && <button onClick={() => commands.current?.resumeWithoutLock()} className="rounded-xl bg-sky-300 px-4 py-2 font-semibold text-slate-950">Jouer sans capture</button>}
          <button onClick={() => { commands.current?.save(); }} className="rounded-xl border border-white/20 px-3 py-2">Sauvegarder</button>
          <button onClick={() => commands.current?.export()} className="rounded-xl border border-white/20 px-3 py-2">Exporter le monde</button>
          <button onClick={onExit} className="rounded-xl border border-white/20 px-3 py-2">Menu</button>
        </div>
        <Game3DSettings onQuality={() => {}} onBrightness={saveBrightness3D} />
        <p className="mt-5 border-t border-white/10 pt-3 text-[10px] leading-5 text-[#9bae9f]">Sauvegarde automatique sur cet appareil · Exporte ton monde pour le conserver.<br />Clavier et souris requis · {hud.fps} i/s · {hud.chunks} zones chargées</p>
      </div>
    </div>}
  </div>;
}

function healthLabel(health: number) { return health <= 0 ? "Fin de l’expédition" : "L’aventure t’attend."; }
