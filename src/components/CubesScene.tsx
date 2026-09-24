"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  AIR, BLE_0, CACTUS, CHUNK, CULTURES, EAU, FOUR, GRES, HERBE, SABLE, SOCLE, TABLE_CRAFT, TERRE, TERRE_LABOUREE, WORLD_HEIGHT, World, block,
  buildChunkMesh, courbe, decodeEdits, encodeEdits, raycast, spawnPoint, type MeshData, type SavedWorld,
} from "@/lib/voxel";
import {
  ARC, ARMOR_SLOTS, BOUCLIER, BOUSSOLE, FIOLE, FIOLE_EAU, FLECHE, GOURDE, GOURDE_EAU, GRAINES, HORLOGE, POUDRE_OS, SEAU, SEAU_EAU,
  armorPoints, breakSeconds, dropsFor, isBlock, item, thingName,
} from "@/lib/voxelItems";
import { ALL_RECIPES, craft as fabriquer } from "@/lib/voxelRecipes";
import { createVoxelAtlas } from "@/lib/voxelTextures";
import { createVoxelAtmosphere } from "@/lib/voxelAtmosphere";
import { clockLabel, skyState, type SkyState } from "@/lib/voxelSky";
import { createHand } from "@/lib/voxelHand";
import { createVoxelEffects } from "@/lib/voxelEffects";
import { createMobs } from "@/lib/voxelMobs";
import { VoxelAudio, type VoxelSound } from "@/lib/voxelAudio";
import { CUBES_SAVE_KEY } from "@/lib/voxelSave";
import { GIVE_CUBES_EVENT, type CubesGive } from "@/lib/adminGive";
import { loadBrightness3D, loadLayout3D, loadQuality3D, loadSensitivity3D, saveBrightness3D } from "@/lib/settings3d";
import Game3DSettings from "./Game3DSettings";
import { CubesHud, type CubesCommands, type CubesHudState } from "./CubesHud";
import { CraftPanel, InventoryPanel } from "./CubesPanels";

type Panel = "pause" | "inventaire" | "fabrication";

/** Duree d'un stade de pousse du ble, en secondes de jeu. */
const POUSSE = 150;
/** Debut de la partie : le matin du premier jour. */
const MATIN = 40;

export default function CubesScene({ initial, onExit }: { initial: SavedWorld; onExit: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const commands = useRef<CubesCommands | null>(null);
  // Relais stable vers la partie en cours : l'interface l'appelle, la partie repond.
  const [cmd] = useState<CubesCommands>(() => ({
    resume: () => commands.current?.resume(),
    resumeWithoutLock: () => commands.current?.resumeWithoutLock(),
    pause: () => commands.current?.pause(),
    save: () => commands.current?.save() ?? false,
    export: () => commands.current?.export(),
    respawn: () => commands.current?.respawn(),
    select: (slot) => commands.current?.select(slot),
    assign: (id) => commands.current?.assign(id),
    craft: (recipeId, times) => commands.current?.craft(recipeId, times) ?? 0,
    equip: (id) => commands.current?.equip(id),
    unequip: (slot) => commands.current?.unequip(slot),
    consume: (id) => commands.current?.consume(id),
    refreshStations: () => commands.current?.refreshStations(),
  }));
  const [paused, setPaused] = useState(true);
  const [panel, setPanel] = useState<Panel>("pause");
  const [message, setMessage] = useState("Préparation du terrain…");
  const [fatal, setFatal] = useState(false);
  const [lockFailed, setLockFailed] = useState(false);
  const [terrainReady, setTerrainReady] = useState(false);
  const [hud, setHud] = useState<CubesHudState>(() => ({
    mode: initial.mode, selected: 0, hotbar: initial.hotbar, stock: initial.stock,
    vie: initial.survie?.vie ?? 100, faim: initial.survie?.faim ?? 100, soif: initial.survie?.soif ?? 100, air: 10, underwater: false,
    armure: initial.armure ?? [0, 0, 0, 0], armurePts: armorPoints(initial.armure ?? []), usure: initial.usure ?? {},
    target: "", progress: 0, chunks: 0, fps: 0, pixelRatio: 1, jour: 1, heure: "06:00", nuit: false,
    stations: { table: false, four: false }, toasts: [], blesse: false, boussole: null, horloge: false, eating: 0, bow: 0,
  }));

  useEffect(() => {
    const mount = host.current!;
    const survie = initial.mode === "survie";
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" }); }
    catch { queueMicrotask(() => { setFatal(true); setMessage("WebGL n’est pas disponible. Active l’accélération graphique du navigateur pour jouer."); }); return; }
    // Resolution de rendu adaptee a la machine : elle monte si tout est fluide, descend sinon.
    let pixelRatio = Math.min(devicePixelRatio, 1.5);
    renderer.setPixelRatio(pixelRatio);
    renderer.autoClear = false;
    mount.appendChild(renderer.domElement);
    const canvas = renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute("aria-label", "Monde Cubes : clavier pour se déplacer, flèches pour regarder sans capture de souris");
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#cfe2ef");
    scene.fog = new THREE.Fog("#cfe2ef", 20, 36);
    const camera = new THREE.PerspectiveCamera(72, 1, .07, 190);
    camera.rotation.order = "YXZ";
    const ambient = new THREE.HemisphereLight("#a9c8ff", "#6b6552", 1.2);
    scene.add(ambient);
    const sunlight = new THREE.DirectionalLight("#ffe0b0", 2.2);
    sunlight.position.set(-60, 90, -45); scene.add(sunlight);
    const atmosphere = createVoxelAtmosphere(scene);
    const atlas = createVoxelAtlas(renderer);

    // Lumiere cuite dans les sommets : r = ciel, g = torches. Le shader garde
    // le plus fort des deux, le ciel etant multiplie par l'heure (uJour) et
    // les torches par un leger vacillement (uFlamme), teintees d'orange.
    const uJour = { value: 1 }, uFlamme = { value: 1 };
    function nuitEtTorches(m: THREE.MeshLambertMaterial) {
      m.onBeforeCompile = (shader) => {
        shader.uniforms.uJour = uJour; shader.uniforms.uFlamme = uFlamme;
        shader.fragmentShader = "uniform float uJour;\nuniform float uFlamme;\n" + shader.fragmentShader.replace("#include <color_fragment>", `
          #if defined( USE_COLOR )
            float cielL = vColor.r * uJour;
            float feuL = vColor.g * uFlamme;
            vec3 chaud = mix(vec3(1.0), vec3(1.0, 0.8, 0.58), clamp((feuL - cielL) * 2.5, 0.0, 1.0));
            diffuseColor.rgb *= max(cielL, feuL) * chaud;
          #endif`);
      };
      m.customProgramCacheKey = () => "cubes-jour-nuit";
      return m;
    }
    const material = nuitEtTorches(new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true }));
    const cutoutMaterial = nuitEtTorches(new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true, alphaTest: .15 }));
    const waterMaterial = nuitEtTorches(new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true, color: "#b7fff0", transparent: true, opacity: .72, depthWrite: false, side: THREE.DoubleSide }));

    const world = new World(initial.seed, decodeEdits(initial.edits));
    const meshes = new Map<string, THREE.Group>();
    const player = { ...initial.player };
    const home = spawnPoint(initial.seed);
    const hotbar = [...initial.hotbar], stock: Record<string, number> = { ...initial.stock };
    const usure: Record<string, number> = { ...(initial.usure ?? {}) };
    const armure = [...(initial.armure ?? [0, 0, 0, 0])];
    const cultures = new Map<string, number>();
    for (let i = 0; i + 3 < (initial.cultures?.length ?? 0); i += 4) {
      const c = initial.cultures!;
      cultures.set(`${c[i]},${c[i + 1]},${c[i + 2]}`, c[i + 3]);
    }
    let temps = initial.temps ?? MATIN;
    let vie = initial.survie?.vie ?? 100, faim = initial.survie?.faim ?? 100, soif = initial.survie?.soif ?? 100, air = 10;
    const audio = new VoxelAudio();
    const play = (s: VoxelSound) => audio.play(s);
    const keys = new Set<string>();
    let selected = 0, vy = 0, grounded = false, flying = false, knockX = 0, knockZ = 0, shake = 0;
    const GRACE = 40;
    let hurtAt = 0, lastHurt = -100, regenAt = 0, faimDegatsAt = 0, airDegatsAt = 0, sinceStart = 0;
    let active = false, disposed = false, ready = false, held = false, rightHeld = false, mining = "", progress = 0, chipAt = 0;
    let eatT = 0, bowT = 0, attackAt = 0;
    let withoutLock = false;
    let frameCount = 0, fps = 0, metricsAt = performance.now(), lastHud = 0, saveAt = performance.now(), fastSince = 0, ratioAt = 0;
    let spawnChecked = false, settingsAt = 0, cropsAt = 0, stationsAt = 0;
    let stations = { table: false, four: false };
    let layout = loadLayout3D(), quality = loadQuality3D(), sensitivity = loadSensitivity3D(), brightness = loadBrightness3D();
    let prevYaw = player.yaw, prevPitch = player.pitch;
    const toasts: { key: number; text: string; id: number; at: number }[] = [];
    let toastKey = 0;
    const direction = new THREE.Vector3();
    const sky: SkyState = skyState(temps);

    // Contour du bloc vise : douze aretes fusionnees, un seul appel de rendu.
    const edges: THREE.BoxGeometry[] = [];
    for (const a of [-.5075, .5075]) for (const b of [-.5075, .5075]) {
      edges.push(new THREE.BoxGeometry(1.03, .014, .014).translate(0, a, b));
      edges.push(new THREE.BoxGeometry(.014, 1.03, .014).translate(a, 0, b));
      edges.push(new THREE.BoxGeometry(.014, .014, 1.03).translate(a, b, 0));
    }
    const outlineGeometry = mergeGeometries(edges)!;
    for (const edge of edges) edge.dispose();
    const outlineMaterial = new THREE.MeshBasicMaterial({ color: "#111111", transparent: true, opacity: .55 });
    const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
    scene.add(outline); outline.visible = false;

    const hand = createHand(atlas);
    const effects = createVoxelEffects(scene, (x, y, z) => block(world.getBlock(x, y, z)).solid);

    // ------------------------------------------------------------ lumieres
    function brightnessAt(x: number, y: number, z: number) {
      const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
      if (by >= WORLD_HEIGHT) return uJour.value;
      return Math.max(courbe(world.getLight(bx, by, bz)) * uJour.value, courbe(world.getBlockLight(bx, by, bz)) * uFlamme.value);
    }

    // ------------------------------------------------------------ monstres
    const mobs = createMobs(scene, {
      collides: (x, y, z, h, r) => collides(x, y, z, h, r),
      isLoaded: (x, z) => world.isLoaded(x, z),
      solidAt: (x, y, z) => block(world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z))).solid,
      liquidAt: (x, y, z) => block(world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z))).liquid,
      lightLevels: (x, y, z) => ({ sky: world.getLight(Math.floor(x), Math.floor(y), Math.floor(z)), block: world.getBlockLight(Math.floor(x), Math.floor(y), Math.floor(z)) }),
      brightness: brightnessAt,
      isDay: () => !sky.isNight,
    }, {
      hurtPlayer: (amount, cause, fx, fz) => blesser(amount, cause, fx, fz),
      explode: (x, y, z, radius) => exploser(x, y, z, radius),
      drop: (_x, _y, _z, thing, count) => { if (survie && count > 0) donner(thing, count); },
      sound: (kind) => play(kind),
    });

    // ------------------------------------------------------------ terrain
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
      if (data.cutout) group.add(new THREE.Mesh(geometry(data.cutout), cutoutMaterial));
      if (data.water) group.add(new THREE.Mesh(geometry(data.water), waterMaterial));
      scene.add(group); meshes.set(key, group);
      c.dirty = false; world.dirty.delete(key);
    }
    function terrainStep() {
      const cx = Math.floor(player.x / CHUNK), cz = Math.floor(player.z / CHUNK);
      const radius = quality === "performance" ? 1 : 2;
      const fog = scene.fog as THREE.Fog;
      fog.far = radius * CHUNK + 4;
      fog.near = fog.far * .55;
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

    // ------------------------------------------------------------ sauvegarde
    function snapshot(): SavedWorld {
      const flat: number[] = [];
      for (const [key, t] of cultures) { const [x, y, z] = key.split(",").map(Number); flat.push(x, y, z, Math.round(t)); }
      return {
        version: 2, seed: initial.seed, mode: initial.mode, player: { ...player }, hotbar: [...hotbar], stock: { ...stock },
        edits: encodeEdits(world.edits), savedAt: Date.now(),
        survie: { vie: Math.round(vie), faim: Math.round(faim), soif: Math.round(soif) }, temps: Math.round(temps),
        usure: { ...usure }, armure: [...armure], cultures: flat,
      };
    }
    function save() {
      try { localStorage.setItem(CUBES_SAVE_KEY, JSON.stringify(snapshot())); setMessage("Monde sauvegardé sur cet appareil."); return true; }
      catch { setMessage("Sauvegarde locale impossible. Exporte ton monde pour conserver tes constructions."); return false; }
    }

    // ------------------------------------------------------------ inventaire
    function heldId() { return hotbar[selected]; }
    function has(id: number) { return !survie || (stock[id] ?? 0) > 0; }
    function toast(id: number, text: string) {
      toasts.push({ key: ++toastKey, id, text, at: performance.now() });
      if (toasts.length > 5) toasts.shift();
    }
    function donner(id: number, n: number, silencieux = false) {
      stock[id] = Math.min(1_000_000, (stock[id] ?? 0) + n);
      // Comme dans le jeu d'origine : ce qu'on ramasse arrive dans une case libre de la barre.
      if (survie && !hotbar.includes(id)) {
        const libre = hotbar.findIndex(h => h === 0 || !(stock[h] > 0));
        if (libre >= 0) { hotbar[libre] = id; if (libre === selected) hand.setHeld(visibleHeld()); }
      }
      if (!silencieux) { toast(id, `+${n} ${thingName(id)}`); play("ramasser"); }
    }
    function retirer(id: number, n = 1) {
      if (!survie) return;
      stock[id] = (stock[id] ?? 0) - n;
      if (stock[id] <= 0) delete stock[id];
    }
    /** Use d'un outil ou d'une piece d'armure : il casse au bout de sa durabilite. */
    function user(id: number, n = 1) {
      if (!survie || !id) return;
      const it = item(id);
      const d = it?.tool?.durability ?? it?.armor?.durability;
      if (!d) return;
      usure[id] = (usure[id] ?? 0) + n;
      if (usure[id] >= d) {
        usure[id] = 0;
        const worn = armure.indexOf(id);
        if (worn >= 0 && it?.armor) armure[worn] = 0;
        else retirer(id);
        toast(id, `${thingName(id)} s’est cassé${it?.armor?.slot === "bottes" || it?.armor?.slot === "jambieres" ? "es" : ""}`);
        play("casse");
      }
    }
    function stationsNear() {
      let table = false, four = false;
      const px = Math.floor(player.x), py = Math.floor(player.y), pz = Math.floor(player.z);
      for (let y = py - 2; y <= py + 3; y++) for (let z = pz - 4; z <= pz + 4; z++) for (let x = px - 4; x <= px + 4; x++) {
        const id = world.getBlock(x, y, z);
        if (id === TABLE_CRAFT) table = true;
        else if (id === FOUR) four = true;
      }
      stations = { table, four };
    }

    // ------------------------------------------------------------ survie
    function blesser(amount: number, cause: string, fromX?: number, fromZ?: number) {
      if (!survie || vie <= 0 || amount <= 0) return;
      let degats = amount;
      const pts = armorPoints(armure);
      if (cause !== "faim" && cause !== "soif" && cause !== "noyade") {
        degats *= 1 - Math.min(.8, pts * .04);
        if (heldId() === BOUCLIER && has(BOUCLIER)) { degats *= .6; user(BOUCLIER); }
        for (const id of armure) if (id) user(id);
      }
      vie = Math.max(0, vie - degats);
      hurtAt = performance.now(); lastHurt = sinceStart;
      shake = Math.min(1, shake + .5);
      play("hurt");
      syncHud();
      if (fromX !== undefined && fromZ !== undefined) {
        const dx = player.x - fromX, dz = player.z - fromZ, d = Math.hypot(dx, dz) || 1;
        knockX += dx / d * 6; knockZ += dz / d * 6;
        if (grounded) vy = 4.5;
      }
      if (vie <= 0) {
        pause(); play("mort");
        setMessage(cause === "faim" ? "Tu es mort de faim. Pense à cultiver du blé et à cueillir des pommes." : cause === "soif" ? "Tu es mort de soif. Clic droit sur l’eau pour boire, ou remplis une gourde." : cause === "noyade" ? "Tu t’es noyé. Surveille les bulles d’air sous l’eau." : cause === "chute" ? "Chute fatale. Tes constructions et ton inventaire sont conservés." : cause === "explosion" ? "Boum. Un explosif t’a eu. Tes constructions et ton inventaire sont conservés." : "Les monstres t’ont eu. Tes constructions et ton inventaire sont conservés.");
        syncHud();
      }
    }
    function exploser(x: number, y: number, z: number, radius: number) {
      const changes: [number, number, number, number][] = [];
      for (let dy = -radius; dy <= radius; dy++) for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy + dz * dz > radius * radius + .5) continue;
        const bx = Math.floor(x) + dx, by = Math.floor(y) + dy, bz = Math.floor(z) + dz;
        const id = world.getBlock(bx, by, bz);
        if (id === AIR || id === SOCLE || id === EAU || by <= 0) continue;
        // Un peu d'aleatoire au bord : le cratere n'est pas une boule parfaite.
        if (dx * dx + dy * dy + dz * dz > (radius - 1) * (radius - 1) && Math.random() < .4) continue;
        changes.push([bx, by, bz, AIR]);
      }
      world.setBlocks(changes);
      effects.explosion(x, y, z, radius);
      play("explosion");
      const d = Math.hypot(player.x - x, player.y + .9 - y, player.z - z);
      shake = 1;
      if (d < radius * 2.2) blesser(Math.round((1 - d / (radius * 2.2)) * 75), "explosion", x, z);
    }
    function consumeItem(id: number) {
      const f = item(id)?.food;
      if (!f || !has(id)) return false;
      const boisson = item(id)?.kind === "boisson";
      faim = Math.min(100, faim + f.faim); soif = Math.max(0, Math.min(100, soif + f.soif));
      if (f.vie) vie = Math.min(100, vie + f.vie);
      retirer(id);
      if (f.rend) donner(f.rend, 1, true);
      play(boisson ? "boire" : "manger");
      toast(id, boisson ? `Tu bois : ${thingName(id)}` : `Miam : ${thingName(id)}`);
      return true;
    }
    function respawn() {
      Object.assign(player, spawnPoint(initial.seed)); vy = 0; vie = 100; faim = 100; soif = 100; air = 10; spawnChecked = false; flying = false;
      knockX = knockZ = 0; sinceStart = 0;
      mobs.clear();
      syncHud(); setMessage("Tu es de retour au point de départ. Tes constructions et ton inventaire sont conservés.");
    }

    // ------------------------------------------------------------ interface
    function syncHud(target = "") {
      const now = performance.now();
      while (toasts.length && now - toasts[0].at > 2600) toasts.shift();
      const id = heldId();
      let boussole: number | null = null;
      if (id === BOUSSOLE && has(BOUSSOLE)) {
        // Angle entre le regard et la direction du point de depart.
        const toHome = Math.atan2(-(home.x - player.x), -(home.z - player.z));
        boussole = toHome - player.yaw;
      }
      setHud({
        mode: initial.mode, selected, hotbar: [...hotbar], stock: { ...stock }, vie, faim, soif, air,
        underwater: headInWater(), armure: [...armure], armurePts: armorPoints(armure), usure: { ...usure },
        target, progress, chunks: world.chunks.size, fps, pixelRatio,
        jour: sky.day, heure: clockLabel(temps), nuit: sky.isNight, stations: { ...stations },
        toasts: toasts.map(t => ({ key: t.key, text: t.text, id: t.id })), blesse: now - hurtAt < 400, boussole, horloge: id === HORLOGE && has(HORLOGE),
        eating: eatT > 0 ? Math.min(1, eatT / 1.2) : 0, bow: bowT > 0 ? Math.min(1, bowT / 1) : 0,
      });
    }
    function headInWater() {
      return block(world.getBlock(Math.floor(player.x), Math.floor(player.y + 1.62), Math.floor(player.z))).liquid;
    }
    function resume() {
      if (!ready || vie <= 0) return;
      setPanel("pause");
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
      active = false; setPaused(true); keys.clear(); mouseUp(); rightHeld = false; eatT = 0; bowT = 0; save();
    }
    function ouvrir(p: Panel) { stationsNear(); setPanel(p); pause(); syncHud(); }
    commands.current = {
      resume, save, respawn, pause,
      resumeWithoutLock() { if (!ready || vie <= 0) return; withoutLock = true; active = true; setPanel("pause"); setPaused(false); canvas.focus(); },
      select(slot) { selected = slot; hand.setHeld(visibleHeld()); syncHud(); },
      assign(id) { hotbar[selected] = id; hand.setHeld(visibleHeld()); syncHud(); },
      export() {
        const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot())], { type: "application/json" }));
        const a = document.createElement("a"); a.href = url; a.download = `cubes-${initial.seed}.json`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      craft(recipeId, times) {
        const r = ALL_RECIPES.find(x => x.id === recipeId);
        if (!r) return 0;
        stationsNear();
        if (r.station === "table" && !stations.table) return 0;
        if (r.station === "four" && !stations.four) return 0;
        let n: number;
        if (survie) n = fabriquer(r, stock, times);
        else { n = r.n * times; stock[r.out] = (stock[r.out] ?? 0) + n; }
        if (n > 0) {
          play("craft");
          // Un objet tout neuf va dans une case vide de la barre, s'il y en a une.
          if (!hotbar.includes(r.out)) {
            const vide = hotbar.findIndex(id => id === 0 || (survie && !(stock[id] > 0)));
            if (vide >= 0) hotbar[vide] = r.out;
          }
          hand.setHeld(visibleHeld());
        }
        syncHud();
        return n;
      },
      equip(id) {
        const slot = ARMOR_SLOTS.indexOf(item(id)?.armor?.slot ?? "casque");
        if (!item(id)?.armor || !has(id)) return;
        if (armure[slot]) donner(armure[slot], 1, true);
        retirer(id); armure[slot] = id; play("equiper"); syncHud();
      },
      unequip(slot) {
        if (!armure[slot]) return;
        donner(armure[slot], 1, true); armure[slot] = 0; play("equiper"); syncHud();
      },
      consume(id) { if (consumeItem(id)) syncHud(); },
      refreshStations() { stationsNear(); syncHud(); },
    };
    function visibleHeld() { const id = heldId(); return has(id) ? id : 0; }

    // ------------------------------------------------------------ actions
    function targetBlock(liquid = false) {
      camera.getWorldDirection(direction);
      return raycast(world, camera.position.x, camera.position.y, camera.position.z, direction.x, direction.y, direction.z, 5.5, liquid);
    }
    /** Pose un bloc sur la face visee ; `fromStock` : le prendre dans l'inventaire. */
    function placeBlock(id: number, fromStock = true) {
      const hit = targetBlock();
      if (!hit || hit.ny <= 0 || hit.ny >= WORLD_HEIGHT || !world.isLoaded(hit.nx, hit.nz)) return false;
      if (block(world.getBlock(hit.nx, hit.ny, hit.nz)).solid) return false;
      if (block(id).solid && hit.nx + 1 > player.x - .29 && hit.nx < player.x + .29 && hit.nz + 1 > player.z - .29 && hit.nz < player.z + .29 && hit.ny + 1 > player.y && hit.ny < player.y + 1.75) return false;
      if (fromStock && !has(id)) { setMessage("Récolte ou fabrique ce bloc avant de le poser."); return false; }
      world.setBlock(hit.nx, hit.ny, hit.nz, id);
      if (fromStock) retirer(id);
      play(block(id).sound); hand.swing();
      return true;
    }
    /** Clic droit : table, four, eau, culture, nourriture, puis poser. */
    function clicDroit() {
      const hit = targetBlock();
      const id = heldId();
      if (hit && (hit.id === TABLE_CRAFT || hit.id === FOUR)) { ouvrir("fabrication"); return; }
      const it = item(id);
      // Recipients vides : on puise dans l'eau.
      if ((id === FIOLE || id === GOURDE || id === SEAU) && has(id)) {
        const w = targetBlock(true);
        if (w && w.id === EAU) {
          retirer(id);
          donner(id === FIOLE ? FIOLE_EAU : id === GOURDE ? GOURDE_EAU : SEAU_EAU, 1, true);
          if (!survie) stock[id === FIOLE ? FIOLE_EAU : id === GOURDE ? GOURDE_EAU : SEAU_EAU] = 1;
          hotbar[selected] = id === FIOLE ? FIOLE_EAU : id === GOURDE ? GOURDE_EAU : SEAU_EAU;
          hand.setHeld(visibleHeld()); play("eau"); hand.swing(); syncHud();
          return;
        }
      }
      if (id === SEAU_EAU && has(id) && hit) {
        if (placeBlock(EAU, false)) {
          retirer(SEAU_EAU); donner(SEAU, 1, true); hotbar[selected] = SEAU; hand.setHeld(visibleHeld()); syncHud();
        }
        return;
      }
      // Main nue sur l'eau : on boit a la source.
      if (id === 0 || !has(id)) {
        const w = targetBlock(true);
        if (survie && w && w.id === EAU && w.distance < 3.5 && soif < 100) { soif = Math.min(100, soif + 12); play("boire"); hand.swing(); return; }
      }
      if (!hit) return;
      const above = world.getBlock(hit.x, hit.y + 1, hit.z);
      // Houe : labourer l'herbe ou la terre.
      if (it?.tool?.type === "houe" && has(id) && (hit.id === HERBE || hit.id === TERRE) && above === AIR && hit.ny === hit.y + 1) {
        world.setBlock(hit.x, hit.y, hit.z, TERRE_LABOUREE); user(id); play("terre"); hand.swing(); return;
      }
      // Graines sur terre labouree.
      if (id === GRAINES && has(id) && hit.id === TERRE_LABOUREE && above === AIR) {
        world.setBlock(hit.x, hit.y + 1, hit.z, BLE_0); cultures.set(`${hit.x},${hit.y + 1},${hit.z}`, temps);
        retirer(GRAINES); play("feuille"); hand.swing(); syncHud(); return;
      }
      // Poudre d'os : la culture pousse d'un coup.
      if (id === POUDRE_OS && has(id) && CULTURES[hit.id] !== undefined) {
        world.setBlock(hit.x, hit.y, hit.z, CULTURES[hit.id]); cultures.set(`${hit.x},${hit.y},${hit.z}`, temps);
        effects.chip(hit.x, hit.y, hit.z, hit.id); retirer(POUDRE_OS); play("feuille"); hand.swing(); syncHud(); return;
      }
      if (isBlock(id)) { if (placeBlock(id)) syncHud(); }
    }
    function breakBlock(hitX: number, hitY: number, hitZ: number, id: number) {
      world.setBlock(hitX, hitY, hitZ, AIR);
      cultures.delete(`${hitX},${hitY},${hitZ}`);
      effects.burst(hitX, hitY, hitZ, id);
      play(block(id).sound);
      if (survie) {
        const tool = heldId();
        for (const [thing, n] of dropsFor(id, has(tool) ? tool : 0, Math.random)) donner(thing, n);
        if (item(tool)?.tool && has(tool)) user(tool);
        faim = Math.max(0, faim - .15);
      }
      // Une plante posee sur le bloc casse tombe avec lui.
      const above = world.getBlock(hitX, hitY + 1, hitZ);
      if (above !== AIR && block(above).shape === "croix") breakBlock(hitX, hitY + 1, hitZ, above);
    }

    // ------------------------------------------------------------ entrees
    function mouseDown(e: MouseEvent) {
      if (!active) return;
      if (e.button === 2) {
        rightHeld = true;
        const id = heldId(), it = item(id);
        // Nourriture et arc : on maintient le clic.
        if ((it?.food && has(id)) || (id === ARC && has(ARC))) return;
        clicDroit();
      }
      if (e.button === 0) held = true;
    }
    function mouseUp(e?: MouseEvent) {
      if (!e || e.button === 0) { held = false; progress = 0; mining = ""; effects.hideCrack(); }
      if (e && e.button === 2) {
        rightHeld = false;
        // L'arc tire au relachement.
        if (bowT > .15 && heldId() === ARC && has(ARC) && (!survie || (stock[FLECHE] ?? 0) > 0)) {
          camera.getWorldDirection(direction);
          const power = Math.min(1, bowT);
          mobs.shootArrow(camera.position.x, camera.position.y - .1, camera.position.z, direction.x, direction.y, direction.z, 12 + 30 * power);
          retirer(FLECHE); user(ARC); play("arc"); hand.swing();
        }
        eatT = 0; bowT = 0;
      }
    }
    function mouseMove(e: MouseEvent) {
      if (!active || withoutLock) return;
      player.yaw -= e.movementX * .0015 * sensitivity;
      player.pitch = THREE.MathUtils.clamp(player.pitch - e.movementY * .0015 * sensitivity, -1.5, 1.5);
    }
    function lockChange() {
      active = document.pointerLockElement === canvas;
      setPaused(!active); keys.clear(); mouseUp(); rightHeld = false;
      if (!active) save();
    }
    function keyDown(e: KeyboardEvent) {
      if (!active) return;
      e.preventDefault(); keys.add(e.code); keys.add(e.key.toLowerCase());
      if (/^Digit[1-9]$/.test(e.code)) { selected = Number(e.code.slice(-1)) - 1; hand.setHeld(visibleHeld()); syncHud(); }
      if (e.code === "KeyE" && !e.repeat) ouvrir("inventaire");
      if (e.code === "KeyC" && !e.repeat) ouvrir("fabrication");
      if (e.code === "Escape") pause();
      if (e.code === "KeyF" && !e.repeat && !survie) { flying = !flying; vy = 0; setMessage(flying ? "Vol activé · Espace : monter · Maj : descendre" : "Vol désactivé"); }
    }
    function keyUp(e: KeyboardEvent) { keys.delete(e.code); keys.delete(e.key.toLowerCase()); }
    function wheel(e: WheelEvent) { if (active) { e.preventDefault(); selected = (selected + (e.deltaY > 0 ? 1 : 8)) % 9; hand.setHeld(visibleHeld()); syncHud(); } }
    function blur() { if (active) pause(); }
    function contextMenu(e: Event) { e.preventDefault(); }
    function resize() {
      const { width, height } = mount.getBoundingClientRect();
      renderer.setSize(width, height); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix();
      hand.resize(camera.aspect);
    }
    const observer = new ResizeObserver(resize); observer.observe(mount); resize();
    document.addEventListener("pointerlockchange", lockChange);
    document.addEventListener("pointerlockerror", lockError);
    document.addEventListener("mousemove", mouseMove);
    document.addEventListener("mouseup", mouseUp);
    window.addEventListener("keydown", keyDown); window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", blur); window.addEventListener("pagehide", save);
    // Give admin (bouton 🛡) : des objets ajoutes en pleine partie de survie.
    function adminGive(e: Event) {
      const detail = (e as CustomEvent<CubesGive>).detail;
      if (!survie || !detail) return;
      for (const [id, n] of Object.entries(detail.blocks)) stock[id] = Math.min(1_000_000, (stock[id] ?? 0) + n);
      detail.handled = true;
      hand.setHeld(visibleHeld()); syncHud(); save();
    }
    window.addEventListener(GIVE_CUBES_EVENT, adminGive);
    canvas.addEventListener("mousedown", mouseDown); canvas.addEventListener("contextmenu", contextMenu); canvas.addEventListener("wheel", wheel, { passive: false });
    hand.setHeld(visibleHeld());

    // ------------------------------------------------------------ boucle
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now(), dt = Math.min((now - last) / 1000, .05); last = now;
      // Les reglages restent reactifs sans lire le stockage a chaque mouvement de souris.
      if (now - settingsAt > 500) {
        layout = loadLayout3D(); quality = loadQuality3D(); sensitivity = loadSensitivity3D(); brightness = loadBrightness3D(); settingsAt = now;
      }
      const playing = active && ready && vie > 0;
      if (playing) { temps += dt; sinceStart += dt; }

      // Ciel, heure et lumieres.
      skyState(temps, sky);
      uJour.value = Math.min(1, sky.jour * (.85 + .15 * brightness));
      uFlamme.value = .94 + .06 * Math.sin(now * .011) * Math.sin(now * .0037 + 1.3);
      ambient.color.copy(sky.hemiSky); ambient.groundColor.copy(sky.hemiGround);
      ambient.intensity = sky.hemiIntensity * brightness;
      sunlight.color.copy(sky.sunColor); sunlight.intensity = sky.sunIntensity;
      sunlight.position.copy(sky.sunDir).multiplyScalar(sky.sunDir.y >= 0 ? 100 : -100);

      // Un seul chunk genere et un seul maillage par tick pour repartir le cout.
      terrainStep();
      let hit: ReturnType<typeof targetBlock> = null;
      if (playing) {
        if (withoutLock) {
          player.yaw += (Number(keys.has("ArrowLeft")) - Number(keys.has("ArrowRight"))) * dt * 1.6;
          player.pitch = THREE.MathUtils.clamp(player.pitch + (Number(keys.has("ArrowUp")) - Number(keys.has("ArrowDown"))) * dt * 1.2, -1.5, 1.5);
        }
        const forward = Number(keys.has(layout === "azerty" ? "z" : "w")) - Number(keys.has("s"));
        const strafe = Number(keys.has("d")) - Number(keys.has(layout === "azerty" ? "q" : "a"));
        const norm = Math.hypot(forward, strafe) || 1;
        const inWater = block(world.getBlock(Math.floor(player.x), Math.floor(player.y + 1), Math.floor(player.z))).liquid;
        const shift = keys.has("ShiftLeft") || keys.has("ShiftRight");
        // Courir fatigue : impossible le ventre vide.
        const sprint = shift && !flying && (!survie || faim > 12) && forward > 0;
        const lent = eatT > 0 || bowT > 0;
        const speed = flying ? 9 : inWater ? 2.8 : sprint ? 6 : lent ? 2 : 4.2;
        const moving = forward !== 0 || strafe !== 0;
        const dx = (strafe * Math.cos(player.yaw) - forward * Math.sin(player.yaw)) / norm * speed * dt + knockX * dt;
        const dz = (-forward * Math.cos(player.yaw) - strafe * Math.sin(player.yaw)) / norm * speed * dt + knockZ * dt;
        knockX *= Math.max(0, 1 - dt * 8); knockZ *= Math.max(0, 1 - dt * 8);
        if (!collides(player.x + dx, player.y, player.z)) player.x += dx;
        if (!collides(player.x, player.y, player.z + dz)) player.z += dz;
        if (flying) vy = (Number(keys.has("Space")) - Number(shift)) * 7;
        else {
          if (keys.has("Space") && (grounded || inWater)) {
            vy = inWater ? 4 : 7.5; grounded = false;
            if (survie && !inWater) { faim = Math.max(0, faim - .08); soif = Math.max(0, soif - .05); }
          }
          vy = Math.max(inWater ? -3 : -28, vy - (inWater ? 6 : 22) * dt);
        }
        const steps = Math.max(1, Math.ceil(Math.abs(vy * dt) / .15));
        grounded = false;
        for (let s = 0; s < steps; s++) {
          const dy = vy * dt / steps;
          if (player.y + dy < WORLD_HEIGHT + 3 && !collides(player.x, player.y + dy, player.z)) player.y += dy;
          else {
            grounded = vy < 0;
            if (grounded && vy < -13) blesser(Math.round((-vy - 12) * 3.2), "chute");
            vy = 0; break;
          }
        }
        if (player.y < -20) { player.y = WORLD_HEIGHT; blesser(100, "chute"); }
        camera.position.set(player.x, player.y + 1.62, player.z); camera.rotation.set(player.pitch, player.yaw, 0);

        // Survie : faim, soif, air, regeneration.
        if (survie) {
          const effort = (sprint && moving ? .09 : moving ? .02 : 0) + (held ? .02 : 0);
          faim = Math.max(0, faim - dt * (.075 + effort));
          const chaud = columnHot(player.x, player.z) ? .05 : 0;
          soif = Math.max(0, soif - dt * (.11 + effort * 1.2 + chaud));
          const submerged = headInWater();
          if (submerged) {
            air = Math.max(0, air - dt);
            if (air <= 0 && sinceStart - airDegatsAt > 1) { airDegatsAt = sinceStart; blesser(8, "noyade"); }
          } else air = Math.min(10, air + dt * 5);
          if ((faim <= 0 || soif <= 0) && sinceStart - faimDegatsAt > 3) { faimDegatsAt = sinceStart; blesser(4, faim <= 0 ? "faim" : "soif"); }
          if (vie > 0 && vie < 100 && faim >= 60 && soif >= 50 && sinceStart - lastHurt > 5 && sinceStart - regenAt > 1) {
            regenAt = sinceStart; vie = Math.min(100, vie + 2); faim = Math.max(0, faim - .35); soif = Math.max(0, soif - .2);
          }
        }

        // Manger, boire, tendre l'arc (clic droit maintenu).
        const id = heldId(), it = item(id);
        if (rightHeld && it?.food && has(id) && (faim < 100 || soif < 100 || !!it.food.vie)) {
          eatT += dt;
          if (eatT >= 1.2) { consumeItem(id); eatT = 0; hand.setHeld(visibleHeld()); syncHud(); }
        } else eatT = 0;
        if (rightHeld && id === ARC && has(ARC)) bowT += dt; else if (!rightHeld) bowT = 0;

        // Visee, combat, minage.
        hit = targetBlock();
        outline.visible = !!hit;
        if (hit) outline.position.set(hit.x + .5, hit.y + .5, hit.z + .5);
        let attacked = false;
        if (held) {
          camera.getWorldDirection(direction);
          const mobDistance = mobs.rayDistance(camera.position.x, camera.position.y, camera.position.z, direction.x, direction.y, direction.z, 3.6);
          if (mobDistance < (hit ? hit.distance + .3 : Infinity)) {
            attacked = true;
            const tool = has(id) ? item(id)?.tool : undefined;
            const cooldown = tool?.type === "epee" ? .45 : .55;
            if (sinceStart - attackAt > cooldown) {
              attackAt = sinceStart; hand.swing();
              if (mobs.hitMelee(camera.position.x, camera.position.y, camera.position.z, direction.x, direction.y, direction.z, 3.6, tool?.damage ?? 1)) {
                play("hit"); if (tool) user(id, tool.type === "epee" ? 1 : 2);
                faim = Math.max(0, faim - .1);
              }
            }
          }
        }
        if (held && hit && hit.id !== SOCLE && !attacked) {
          const key = `${hit.x},${hit.y},${hit.z}`;
          if (mining !== key) { mining = key; progress = 0; }
          const seconds = survie ? Math.max(.05, breakSeconds(hit.id, has(id) ? id : 0)) : .18;
          progress += dt / seconds;
          effects.crack(hit.x, hit.y, hit.z, progress);
          if (now - chipAt > 140) { chipAt = now; effects.chip(hit.x, hit.y, hit.z, hit.id); play(block(hit.id).sound); }
          if (progress >= 1) {
            breakBlock(hit.x, hit.y, hit.z, hit.id);
            progress = 0; mining = ""; effects.hideCrack();
            hand.setHeld(visibleHeld());
          }
        } else if (progress > 0 || mining) { progress = 0; mining = ""; effects.hideCrack(); }

        // Monstres (survie seulement), apres un moment de calme.
        if (survie && sinceStart > GRACE) mobs.trySpawn(player);
        mobs.update(dt, player);

        // Cultures : le ble pousse avec le temps de jeu.
        if (now - cropsAt > 1000) {
          cropsAt = now;
          for (const [key, t] of cultures) {
            const [x, y, z] = key.split(",").map(Number);
            if (!world.isLoaded(x, z)) continue;
            const idc = world.getBlock(x, y, z);
            if (CULTURES[idc] === undefined) { if (block(idc).shape !== "croix") cultures.delete(key); continue; }
            if (temps - t > POUSSE) { world.setBlock(x, y, z, CULTURES[idc]); cultures.set(key, temps); }
          }
        }
        if (now - stationsAt > 1500) { stationsAt = now; stationsNear(); }
        if (vie <= 0) syncHud();
        if (now - lastHud > 140) { syncHud(hit ? block(hit.id).name : ""); lastHud = now; }
      } else {
        camera.position.set(player.x, player.y + 1.62, player.z); camera.rotation.set(player.pitch, player.yaw, 0);
      }
      // Tremblement (coup, explosion).
      if (shake > 0) {
        shake = Math.max(0, shake - dt * 2.5);
        camera.position.x += (Math.random() - .5) * shake * .12;
        camera.position.y += (Math.random() - .5) * shake * .12;
      }
      if (now - saveAt > 20000 && ready) { save(); saveAt = now; }
      frameCount++;
      if (now - metricsAt >= 1000) { fps = Math.round(frameCount * 1000 / (now - metricsAt)); frameCount = 0; metricsAt = now; }
      // Echelle de rendu dynamique, avec hysteresis.
      if (playing && now - ratioAt > 2000) {
        ratioAt = now;
        const plafond = quality === "performance" ? 1 : Math.min(devicePixelRatio, 2);
        if (fps < 48 && pixelRatio > .75) { pixelRatio = Math.max(.75, pixelRatio - .125); renderer.setPixelRatio(pixelRatio); resize(); fastSince = now; }
        else if (fps >= 58) {
          if (!fastSince) fastSince = now;
          if (now - fastSince > 4000 && pixelRatio < plafond) { pixelRatio = Math.min(plafond, pixelRatio + .125); renderer.setPixelRatio(pixelRatio); resize(); fastSince = now; }
        } else fastSince = now;
      }

      atmosphere.update(camera, dt, sky);
      // Sous l'eau : brouillard bleu serre.
      const underwater = headInWater();
      if (underwater) {
        const fog = scene.fog as THREE.Fog;
        fog.color.set("#1d5877"); fog.near = .5; fog.far = 11;
        (scene.background as THREE.Color).set("#1d5877");
      }
      const here = brightnessAt(player.x, player.y + 1.62, player.z);
      effects.update(dt, here);
      waterMaterial.opacity = .7 + Math.sin(now * .0007) * .035;

      // Main : suit le regard avec un leger retard.
      const yawSpeed = (player.yaw - prevYaw) / Math.max(dt, .001), pitchSpeed = (player.pitch - prevPitch) / Math.max(dt, .001);
      prevYaw = player.yaw; prevPitch = player.pitch;
      const walking = playing && grounded && (keys.has(layout === "azerty" ? "z" : "w") || keys.has("s") || keys.has("d") || keys.has(layout === "azerty" ? "q" : "a"));
      hand.update(dt, {
        mining: playing && held && !!hit && progress > 0, walk: walking ? (keys.has("ShiftLeft") ? 1.4 : 1) : 0,
        yawSpeed, pitchSpeed, brightness: here, eating: eatT > 0,
      });

      renderer.clear();
      renderer.render(scene, camera);
      if (playing) {
        renderer.clearDepth();
        renderer.render(hand.scene, hand.camera);
      }
    }, 16);

    function columnHot(x: number, z: number) {
      const id = world.getBlock(Math.floor(x), Math.floor(player.y - .5), Math.floor(z));
      return id === SABLE || id === GRES || id === CACTUS;
    }

    return () => {
      disposed = true; clearInterval(timer); if (ready) save(); commands.current = null;
      document.removeEventListener("pointerlockchange", lockChange); document.removeEventListener("mousemove", mouseMove); document.removeEventListener("mouseup", mouseUp);
      document.removeEventListener("pointerlockerror", lockError);
      window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); window.removeEventListener("blur", blur); window.removeEventListener("pagehide", save);
      window.removeEventListener(GIVE_CUBES_EVENT, adminGive);
      canvas.removeEventListener("mousedown", mouseDown); canvas.removeEventListener("contextmenu", contextMenu); canvas.removeEventListener("wheel", wheel);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      observer.disconnect(); for (const key of meshes.keys()) removeMesh(key);
      mobs.dispose(); effects.dispose(); hand.dispose(); atmosphere.dispose();
      outlineGeometry.dispose(); outlineMaterial.dispose(); atlas.dispose();
      material.dispose(); cutoutMaterial.dispose(); waterMaterial.dispose(); audio.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    };
  }, [initial]);

  // Fermer un panneau au clavier (E, C ou Echap) et reprendre la partie.
  useEffect(() => {
    if (!paused || panel === "pause") return;
    function onKey(e: KeyboardEvent) {
      if ((e.code === "KeyE" && panel === "inventaire") || (e.code === "KeyC" && panel === "fabrication")) { e.preventDefault(); commands.current?.resume(); }
      else if (e.code === "Escape") setPanel("pause");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paused, panel]);

  const dead = hud.vie <= 0 && hud.mode === "survie";
  return <div className="relative h-full w-full select-none bg-[#152b23] text-[#faf7e8]">
    <div ref={host} className="absolute inset-0" />
    {!paused && <>
      <CubesHud hud={hud} onSelect={(slot) => commands.current?.select(slot)} />
      <button className="absolute right-4 top-4 rounded-xl border border-white/20 bg-[#101c17]/70 px-4 py-2 text-sm shadow-lg hover:bg-[#101c17]" onClick={() => commands.current?.pause()}>Ⅱ <span className="ml-1">Pause</span><kbd className="ml-3 hidden rounded border border-white/20 px-1.5 text-[10px] text-white/60 sm:inline">Échap</kbd></button>
    </>}
    {paused && <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-[#081c14]/60 p-4 backdrop-blur-sm">
      <div className="relative my-auto w-full max-w-3xl rounded-3xl border border-[#d1ddb8]/20 bg-[#142a20]/95 p-5 shadow-2xl sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[.3em] text-[#c8dba8]">Cubes · {hud.mode === "creatif" ? "Mode créatif" : "Mode survie"} · Jour {hud.jour}</p>
          {!dead && <div role="tablist" aria-label="Panneaux" className="flex gap-1 rounded-xl bg-black/25 p-1">
            {([["pause", "Partie"], ["inventaire", "Inventaire"], ["fabrication", "Fabrication"]] as const).map(([id, label]) => <button key={id} role="tab" aria-selected={panel === id} onClick={() => { setPanel(id); if (id === "fabrication") commands.current?.refreshStations(); }} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${panel === id ? "bg-[#e4d39a] text-[#172d20]" : "text-white/75 hover:bg-white/10"}`}>{label}</button>)}
          </div>}
        </div>
        {panel === "pause" || dead ? <>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">{dead ? "Fin de l’expédition" : "L’aventure t’attend."}</h2>
          <p role="status" className="mt-3 text-xs leading-5 text-[#b9c9b9]">{message}</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">{[
            ["ZQSD / WASD", "Se déplacer"], ["Souris", "Regarder autour de soi"], ["Espace", "Sauter / nager"], ["Clic gauche", "Creuser, frapper"],
            ["Clic droit", "Poser, utiliser, ouvrir une table"], ["Clic droit maintenu", "Manger, boire, tirer à l’arc"], ["E · C", "Inventaire · Fabrication"], ["1–9 / molette", "Changer d’objet"],
            hud.mode === "creatif" ? ["F · Espace / Maj", "Vol · monter / descendre"] : ["Maj", "Courir (donne faim)"], ["Clic droit sur l’eau", hud.mode === "survie" ? "Boire (main vide)" : "Remplir un seau"],
          ].map(([key, action]) => <div key={key} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2.5 text-xs"><span className="text-[#b9c9b9]">{action}</span><kbd className="rounded border border-white/15 bg-black/10 px-2 py-1 text-[10px] text-[#f2df9f]">{key}</kbd></div>)}</div>
        </> : panel === "inventaire" ? <InventoryPanel hud={hud} commands={cmd} /> : <CraftPanel hud={hud} commands={cmd} />}
        <div className="mt-5 flex flex-wrap gap-2">
          {!fatal && <button disabled={!terrainReady} onClick={() => { if (dead) commands.current?.respawn(); else commands.current?.resume(); }} className="rounded-xl bg-[#e4d39a] px-6 py-3 font-bold text-[#172d20] shadow-lg hover:bg-[#f4e4ac] disabled:cursor-wait disabled:opacity-50">{!terrainReady ? "Préparation…" : dead ? "Réapparaître" : "Jouer"}</button>}
          {lockFailed && !dead && <button onClick={() => commands.current?.resumeWithoutLock()} className="rounded-xl bg-sky-300 px-4 py-2 font-semibold text-slate-950">Jouer sans capture</button>}
          <button onClick={() => { commands.current?.save(); }} className="rounded-xl border border-white/20 px-3 py-2">Sauvegarder</button>
          <button onClick={() => commands.current?.export()} className="rounded-xl border border-white/20 px-3 py-2">Exporter le monde</button>
          <button onClick={onExit} className="rounded-xl border border-white/20 px-3 py-2">Menu</button>
        </div>
        {panel === "pause" && <Game3DSettings onQuality={() => {}} onBrightness={saveBrightness3D} />}
        <p className="mt-5 border-t border-white/10 pt-3 text-[10px] leading-5 text-[#9bae9f]">Sauvegarde automatique sur cet appareil · Exporte ton monde pour le conserver.<br />Clavier et souris requis · {hud.fps} i/s · {hud.chunks} zones chargées</p>
      </div>
    </div>}
  </div>;
}

