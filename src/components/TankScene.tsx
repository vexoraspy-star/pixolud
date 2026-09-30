"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import Game3DSettings from "./Game3DSettings";
import { ShellIcon, TankClassIcon } from "./TankIcons";
import { AMMO, AMMO_ORDER, MODES, camoChoice, tankById, type AmmoId, type BattleMode, type Difficulty, type TankClass } from "@/lib/tanks/tankDefs";
import { artyCharge, effectiveArmor, penetrationChance, segmentObb, zoneThickness, type ObbHit } from "@/lib/tanks/tankBallistics";
import {
  BASE_RADIUS,
  MAP_HALF,
  buildTankMap,
  deepWater,
  groundHeight,
  mapInfo,
  segmentGround,
  segmentHouse,
  segmentRock,
  type MapId,
  type TankMap,
} from "@/lib/tanks/tankTerrain";
import { buildTankModel } from "@/lib/tanks/tankModel";
import { BIOME_LOOK, buildTankWorld } from "@/lib/tanks/tankWorld";
import { createTankEffects } from "@/lib/tanks/tankEffects";
import { createBattle, type BattleEnd, type SimTank } from "@/lib/tanks/tankSim";
import {
  createTankAudio,
  playBlocked,
  playCannon,
  playCaptureAlert,
  playGroundHit,
  playHitTaken,
  playPenetration,
  playReloaded,
  playRicochet,
  playTankExplosion,
  type Spatial,
} from "@/lib/tanks/tankAudio";
import { loadBrightness3D, loadLayout3D, loadQuality3D, loadSensitivity3D, type Layout3D } from "@/lib/settings3d";

// La bataille de « Tonnerre d'Acier » : rendu three.js, commandes, camera a la
// troisieme personne et au viseur, interface facon jeu de blindes.
//
// Conventions du Mode 3D : boucle setInterval(16) avec un pas plafonne,
// MeshLambertMaterial, quelques lumieres, textures dessinees au canvas, sons
// synthetises, reglages partages (clavier, sensibilite, luminosite).

export interface BattleResult {
  winner: 0 | 1 | -1;
  reason: BattleEnd["reason"];
  tankId: string;
  damage: number;
  kills: number;
  shots: number;
  hits: number;
  pens: number;
  damageTaken: number;
  survived: boolean;
  xp: number;
  credits: number;
  seconds: number;
  mode: BattleMode;
  mapName: string;
  damageBlocked: number;
  assist: number;
  detections: number;
  /** Tableau des scores : chaque char de la bataille. */
  board: { team: number; name: string; tank: string; cls: TankClass; tier: number; damage: number; kills: number; alive: boolean; isPlayer: boolean }[];
}

interface TeamSlot {
  id: number;
  cls: TankClass;
  name: string;
  tank: string;
  alive: boolean;
  hpFrac: number;
  seen: boolean;
}

interface Hud {
  hp: number;
  maxHp: number;
  speed: number;
  ammo: AmmoId;
  ammoLeft: Record<AmmoId, number>;
  reloadLeft: number;
  reload: number;
  /** Rechargement du chargeur entier en cours (sinon : entre deux obus d'une rafale). */
  fullReload: boolean;
  clipLeft: number;
  clipSize: number;
  timeLeft: number;
  capture: [number, number];
  cappers: [number, number];
  teams: [TeamSlot[], TeamSlot[]];
  damage: number;
  kills: number;
  dead: boolean;
  spectate: string | null;
  zoom: number;
  /** Vue d'artillerie : temps de vol de l'obus jusqu'au point vise (null : hors de portee). */
  artyFlight: number | null;
  /** Schema du char : caisse et tourelle par rapport a la camera (radians). */
  hullAngle: number;
  turretAngle: number;
  /** Case de la carte ou se trouve le char (« H8 »). */
  cell: string;
}

interface Msg {
  id: number;
  text: string;
  color: string;
  until: number;
}

interface Feed {
  id: number;
  killer: string;
  victim: string;
  killerTeam: number;
  victimTeam: number;
  until: number;
}

const FEED_SECONDS = 7;

/** Lettres des lignes de la mini-carte (sans I ni J : on les confond). */
const GRID_ROWS = "ABCDEFGHKL";

/** La case de la carte (10 x 10) ou se trouve un point : « H8 ». */
function mapCell(x: number, z: number): string {
  const col = Math.max(0, Math.min(9, Math.floor(((x + MAP_HALF) / (MAP_HALF * 2)) * 10)));
  const row = Math.max(0, Math.min(9, Math.floor(((z + MAP_HALF) / (MAP_HALF * 2)) * 10)));
  return `${GRID_ROWS[row]}${(col + 1) % 10}`;
}

export default function TankScene({
  tankId,
  camo = null,
  mapId,
  mode = "normale",
  difficulty,
  onEnd,
  onQuit,
}: {
  tankId: string;
  /** Champ de bataille choisi au garage. */
  mapId: MapId;
  /** Guerre normale ou Guerre de 100. */
  mode?: BattleMode;
  /** Camouflage choisi au garage pour le char du joueur (null : celui d'origine). */
  camo?: string | null;
  difficulty: Difficulty;
  onEnd: (result: BattleResult) => void;
  onQuit: () => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const reloadRef = useRef<SVGCircleElement>(null);
  const hitDirRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const platesRef = useRef<(HTMLDivElement | null)[]>([]);
  const plateBarsRef = useRef<(HTMLDivElement | null)[]>([]);
  const apiRef = useRef<{
    resume: () => void;
    setPaused: (p: boolean) => void;
    setBrightness: (v: number) => void;
    setLayout: (v: Layout3D) => void;
    setSensitivity: (v: number) => void;
    touchMove: (throttle: number, steer: number) => void;
    touchLook: (dx: number, dy: number) => void;
    touchFire: (on: boolean) => void;
    toggleSniper: () => void;
    setAmmo: (a: AmmoId) => void;
  } | null>(null);
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [paused, setPaused] = useState(false);
  const [touch] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true);
  const [hud, setHud] = useState<Hud | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [feed, setFeed] = useState<Feed[]>([]);
  const [sniper, setSniper] = useState(false);
  const [artyView, setArtyView] = useState(false);
  const [ended, setEnded] = useState<BattleEnd | null>(null);
  const [plates, setPlates] = useState<{ id: number; team: number; name: string; tank: string }[]>([]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    let disposed = false;
    const def = tankById(tankId);
    const quality = loadQuality3D();
    const detail = quality !== "performance";
    let brightness = loadBrightness3D();
    let layout: Layout3D = loadLayout3D();
    let sensitivity = loadSensitivity3D();

    // --- Rendu ---
    const renderer = new THREE.WebGLRenderer({ antialias: detail, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, detail ? 1.5 : 1));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = detail;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    // Lumiere et brume du climat de la carte.
    const ambiance = BIOME_LOOK[mapInfo(mapId).biome];
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(ambiance.fog, ambiance.fogNear, ambiance.fogFar);
    const camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.3, 2600);
    camera.rotation.order = "YXZ";

    const hemi = new THREE.HemisphereLight(ambiance.hemiSky, ambiance.hemiGround, ambiance.hemi);
    const sun = new THREE.DirectionalLight(ambiance.sun, ambiance.sunI);
    const sunDir = new THREE.Vector3(...ambiance.sunDir).normalize();
    sun.castShadow = detail;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -75;
    sun.shadow.camera.right = 75;
    sun.shadow.camera.top = 75;
    sun.shadow.camera.bottom = -75;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 420;
    sun.shadow.bias = -0.0006;
    scene.add(hemi, sun, sun.target);
    const applyBrightness = () => {
      hemi.intensity = ambiance.hemi * brightness;
      sun.intensity = ambiance.sunI * brightness;
    };
    applyBrightness();

    // --- Carte, decor, effets, son ---
    const seed = Math.floor(Math.random() * 1e9);
    const map: TankMap = buildTankMap(seed, mapId);
    const world = buildTankWorld(map, detail);
    scene.add(world.group);
    const effects = createTankEffects({ dust: ambiance.dust, soil: ambiance.soil });
    scene.add(effects.group);
    const audio = createTankAudio();

    // --- Messages et fil des destructions ---
    let msgId = 0;
    let clock = 0;
    const pushMsg = (text: string, color: string) => {
      const id = ++msgId;
      setMessages((list) => [...list.slice(-2), { id, text, color, until: clock + 2.4 }]);
    };
    const pushFeed = (killer: SimTank | null, victim: SimTank) => {
      const id = ++msgId;
      setFeed((list) => [
        ...list.slice(-4),
        {
          id,
          killer: killer ? `${killer.name} (${killer.def.name})` : "—",
          victim: `${victim.name} (${victim.def.name})`,
          killerTeam: killer?.team ?? -1,
          victimTeam: victim.team,
          until: clock + FEED_SECONDS,
        },
      ]);
    };

    // --- Son spatialise : volume et cote selon la camera ---
    let camYaw = 0;
    const spatial = (x: number, z: number): Spatial => {
      const dx = x - camera.position.x;
      const dz = z - camera.position.z;
      const d = Math.hypot(dx, dz);
      const gain = Math.pow(Math.max(0, 1 - d / 1200), 1.6) * 1.1;
      const rx = -Math.cos(camYaw);
      const rz = Math.sin(camYaw);
      const pan = d > 0.5 ? ((dx * rx + dz * rz) / d) * 0.85 : 0;
      return { gain, pan, dist: d };
    };

    let lastHitAt = -10;
    let lastHitAngle = 0;
    let shake = 0;

    // --- La bataille ---
    const center = new THREE.Vector3();
    const exhaustPos = new THREE.Vector3();
    const battle = createBattle(
      map,
      def,
      difficulty,
      (d, isPlayer) => {
        // Le joueur roule avec son camouflage ; chaque char a son numero.
        const m = buildTankModel(d, {
          camo: isPlayer ? camoChoice(camo) : null,
          number: isPlayer ? "101" : String(200 + Math.floor(Math.random() * 700)),
          // La boue (ou le sable, ou la neige) de la carte sur le bas des chars.
          dirt: { color: ambiance.grime, amount: 1 },
        });
        scene.add(m.root);
        return m;
      },
      {
        shot: (t, muzzle, dir) => {
          effects.muzzle(muzzle, dir, t.def.caliber, groundHeight(map, muzzle.x, muzzle.z));
          if (t.isPlayer) {
            playCannon(audio, t.def.caliber);
            shake = Math.max(shake, 0.6);
          } else {
            playCannon(audio, t.def.caliber, spatial(muzzle.x, muzzle.z));
          }
        },
        hit: (shooter, target, res, point) => {
          const kind = res.outcome === "penetration" ? "perce" : res.outcome === "ricochet" ? "ricochet" : "acier";
          effects.impact(point, kind);
          const sp = target.isPlayer ? undefined : spatial(point.x, point.z);
          if (res.outcome === "penetration" || res.outcome === "eclats") playPenetration(audio, sp);
          else if (res.outcome === "ricochet") playRicochet(audio, sp);
          else playBlocked(audio, sp);
          if (shooter.isPlayer && target.team !== shooter.team) {
            // Le coup fatal arrive avant que le char passe a l'etat d'epave.
            if (!target.alive) pushMsg("Épave", "#a1a1aa");
            else if (res.outcome === "penetration") pushMsg(`Pénétration !  −${res.damage}`, "#4ade80");
            else if (res.outcome === "eclats") pushMsg(`Dégâts d'éclats  −${res.damage}`, "#facc15");
            else if (res.outcome === "ricochet") pushMsg("Ricochet !", "#d4d4d8");
            else pushMsg(`Non pénétré (${Math.round(res.effective)} mm)`, "#d4d4d8");
          }
          if (target.isPlayer && shooter.team !== target.team) {
            playHitTaken(audio, res.damage > 0);
            lastHitAt = clock;
            lastHitAngle = Math.atan2(shooter.x - target.x, shooter.z - target.z);
            shake = Math.max(shake, res.damage > 0 ? 0.9 : 0.4);
            if (res.damage > 0) pushMsg(`Touché !  −${res.damage}`, "#f87171");
            else if (res.outcome === "ricochet") pushMsg("Ricochet sur ton blindage", "#93c5fd");
            else pushMsg("Ton blindage a tenu", "#93c5fd");
          }
        },
        missed: (_shooter, point, kind) => {
          effects.impact(point, kind);
          const sp = spatial(point.x, point.z);
          if (sp.dist < 320) playGroundHit(audio, sp);
        },
        destroyed: (target, by) => {
          center.set(target.x, target.y + 1.6, target.z);
          effects.explosion(center);
          effects.burn(center, 70);
          playTankExplosion(audio, target.isPlayer ? undefined : spatial(target.x, target.z));
          pushFeed(by, target);
          if (by?.isPlayer && target.team !== 0) pushMsg(`${target.def.name} détruit !`, "#fbbf24");
          if (target.isPlayer) {
            shake = 1.2;
            pushMsg("Ton char est détruit", "#f87171");
          }
        },
        treeFell: (index, dx, dz) => {
          world.fellTree(index, dx, dz);
          const t = map.trees[index];
          const sp = spatial(t.x, t.z);
          if (sp.dist < 120) playGroundHit(audio, { ...sp, gain: sp.gain * 0.4 });
        },
        reloaded: () => playReloaded(audio),
        blast: (point) => {
          effects.explosion(point);
          const sp = spatial(point.x, point.z);
          playTankExplosion(audio, sp);
          if (sp.dist < 40) shake = Math.max(shake, 0.8 * (1 - sp.dist / 40));
        },
      },
      mode,
    );
    const player = battle.player;
    const plateList = battle.tanks.filter((t) => !t.isPlayer).map((t) => ({ id: t.id, team: t.team, name: t.name, tank: t.def.name }));

    // --- Mini-carte : le fond est dessine une fois ---
    const miniBg = document.createElement("canvas");
    miniBg.width = 256;
    miniBg.height = 256;
    {
      const g = miniBg.getContext("2d")!;
      const img = g.createImageData(256, 256);
      for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 256; x++) {
          const wx = -MAP_HALF + ((x + 0.5) / 256) * MAP_HALF * 2;
          const wz = -MAP_HALF + ((y + 0.5) / 256) * MAP_HALF * 2;
          const h = groundHeight(map, wx, wz);
          const hx = groundHeight(map, wx + 3, wz) - groundHeight(map, wx - 3, wz);
          const shade = 0.82 + Math.max(-0.2, Math.min(0.2, -hx * 0.12)) + h * 0.004;
          const ice = map.waterKind === "glace" && Math.hypot(wx - map.lake.x, wz - map.lake.z) < map.lake.r;
          const water = !ice && h < map.waterLevel && deepWater(map, wx, wz);
          const i = (y * 256 + x) * 4;
          img.data[i] = ice ? 196 : water ? 60 : ambiance.mini[0] * shade;
          img.data[i + 1] = ice ? 220 : water ? 110 : ambiance.mini[1] * shade;
          img.data[i + 2] = ice ? 234 : water ? 140 : ambiance.mini[2] * shade;
          img.data[i + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
      const k = 256 / (MAP_HALF * 2);
      const px = (w: number) => (w + MAP_HALF) * k;
      g.strokeStyle = "rgba(200,176,130,0.8)";
      g.lineWidth = 2;
      for (const road of map.roads) {
        g.beginPath();
        road.forEach(([x, z], i) => (i === 0 ? g.moveTo(px(x), px(z)) : g.lineTo(px(x), px(z))));
        g.stroke();
      }
      // Ponts : un trait clair au-dessus de la riviere.
      g.strokeStyle = "rgba(214,200,170,0.95)";
      g.lineWidth = 3;
      for (const br of map.bridges) {
        g.beginPath();
        g.moveTo(px(br.x0), px(br.z0));
        g.lineTo(px(br.x1), px(br.z1));
        g.stroke();
      }
      g.fillStyle = "rgba(40,34,30,0.85)";
      for (const h of map.houses) g.fillRect(px(h.x - h.w / 2), px(h.z - h.d / 2), h.w * k + 0.5, h.d * k + 0.5);
      g.strokeStyle = "rgba(0,0,0,0.25)";
      g.lineWidth = 1;
      for (let s = 1; s < 10; s++) {
        g.beginPath();
        g.moveTo((s * 256) / 10, 0);
        g.lineTo((s * 256) / 10, 256);
        g.moveTo(0, (s * 256) / 10);
        g.lineTo(256, (s * 256) / 10);
        g.stroke();
      }
      // Reperes des cases : lettres en ligne, chiffres en colonne.
      g.font = "bold 9px sans-serif";
      g.fillStyle = "rgba(255,255,255,0.55)";
      for (let s = 0; s < 10; s++) {
        g.fillText(GRID_ROWS[s], 2, (s * 256) / 10 + 10);
        g.fillText(String((s + 1) % 10), (s * 256) / 10 + 16, 10);
      }
    }

    // --- Commandes ---
    const keys = new Set<string>();
    let camPitch = 0.22;
    let camDist = 13;
    let sniperMode = false;
    let zoom = 2;
    // Artillerie : Maj passe en vue du dessus ; la souris deplace le point de chute.
    const isArty = def.artyAngle !== undefined;
    let artyMode = false;
    const artyTarget = new THREE.Vector3();
    let artyHeight = 170;
    let freeLook = false;
    let firePressed = false;
    /** Bouton de tir tenu : un canon automatique tire toute sa rafale. */
    let fireHeld = false;
    let ammo: AmmoId = "perforant";
    // Au clavier, la bataille attend le premier clic (on lit les commandes) ;
    // au doigt, elle part tout de suite.
    let pausedNow = !touch;
    /** Sol peint et programmes compiles : on peut dessiner sans rien figer. */
    let ready = false;
    let touchThrottle = 0;
    let touchSteer = 0;
    camYaw = player.yaw;
    const keyFor = () => ({
      fwd: layout === "azerty" ? "z" : "w",
      left: layout === "azerty" ? "q" : "a",
    });
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keys.add(k);
      if (e.code === "Space" || e.key === "Tab") e.preventDefault();
      if (e.key === "Shift" && !e.repeat) {
        if (isArty) setArtyMode(!artyMode);
        else setSniperMode(!sniperMode);
      }
      const digit = /^Digit([1-3])$/.exec(e.code);
      if (digit) ammo = AMMO_ORDER[Number(digit[1]) - 1];
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const onBlur = () => keys.clear();
    const setSniperMode = (on: boolean) => {
      sniperMode = on;
      setSniper(on);
    };
    const setArtyMode = (on: boolean) => {
      if (on && !artyMode) {
        // Le point de chute part de 200 m devant la camera.
        artyTarget.set(player.x + Math.sin(camYaw) * 200, 0, player.z + Math.cos(camYaw) * 200);
      }
      artyMode = on;
      setArtyView(on);
    };
    const look = (dx: number, dy: number) => {
      if (artyMode) {
        const k = artyHeight * 0.0016 * (sensitivity / 1.5);
        const fx = Math.sin(camYaw);
        const fz = Math.cos(camYaw);
        // Vue du dessus, le haut de l'ecran vers l'avant : la droite de l'ecran est (-cos, sin).
        artyTarget.x = THREE.MathUtils.clamp(artyTarget.x - Math.cos(camYaw) * dx * k - fx * dy * k, -MAP_HALF, MAP_HALF);
        artyTarget.z = THREE.MathUtils.clamp(artyTarget.z + Math.sin(camYaw) * dx * k - fz * dy * k, -MAP_HALF, MAP_HALF);
        return;
      }
      const s = 0.0022 * (sensitivity / 1.5) * (sniperMode ? 1 / zoom : 1);
      camYaw -= dx * s;
      camPitch = THREE.MathUtils.clamp(camPitch + dy * s, sniperMode ? -0.45 : -0.35, sniperMode ? 0.5 : 1.15);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) return;
      look(e.movementX, e.movementY);
    };
    const onMouseDown = (e: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) {
        if (e.button === 0 && !touch) renderer.domElement.requestPointerLock?.()?.catch?.(() => {});
        return;
      }
      if (e.button === 0) {
        firePressed = true;
        fireHeld = true;
      }
      if (e.button === 2) freeLook = true;
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) fireHeld = false;
      if (e.button === 2) freeLook = false;
    };
    const onWheel = (e: WheelEvent) => {
      if (document.pointerLockElement !== renderer.domElement) return;
      const inward = e.deltaY < 0;
      if (artyMode) {
        artyHeight = THREE.MathUtils.clamp(artyHeight * (inward ? 0.85 : 1.18), 70, 320);
        return;
      }
      if (sniperMode) {
        if (inward) zoom = Math.min(8, zoom * 2);
        else if (zoom <= 2) setSniperMode(false);
        else zoom = zoom / 2;
      } else {
        camDist = THREE.MathUtils.clamp(camDist * (inward ? 0.85 : 1.18), 6, 30);
        if (inward && camDist <= 6.01) {
          zoom = 2;
          setSniperMode(true);
        }
      }
    };
    const onContext = (e: Event) => e.preventDefault();
    const onLockChange = () => {
      const on = document.pointerLockElement === renderer.domElement;
      setLocked(on);
      if (!on && !touch && !battle.ended) {
        pausedNow = true;
        setPaused(true);
        keys.clear();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    document.addEventListener("mousemove", onMouseMove);
    renderer.domElement.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: true });
    renderer.domElement.addEventListener("contextmenu", onContext);
    document.addEventListener("pointerlockchange", onLockChange);

    apiRef.current = {
      resume: () => {
        pausedNow = false;
        setPaused(false);
        if (!touch) renderer.domElement.requestPointerLock?.()?.catch?.(() => {});
      },
      setPaused: (p) => {
        pausedNow = p;
        setPaused(p);
      },
      setBrightness: (v) => {
        brightness = v;
        applyBrightness();
      },
      setLayout: (v) => {
        layout = v;
      },
      setSensitivity: (v) => {
        sensitivity = v;
      },
      touchMove: (t, s) => {
        touchThrottle = t;
        touchSteer = s;
      },
      touchLook: (dx, dy) => look(dx * 1.6, dy * 1.6),
      touchFire: (on) => {
        if (on) firePressed = true;
        fireHeld = on;
      },
      toggleSniper: () => {
        if (isArty) {
          setArtyMode(!artyMode);
          return;
        }
        zoom = 2;
        setSniperMode(!sniperMode);
      },
      setAmmo: (a) => {
        ammo = a;
      },
    };

    // --- Visee : ou regarde la camera ---
    const aimPoint = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    const rayEnd = new THREE.Vector3();
    const obbHit: ObbHit = { t: 0, zone: "avant", normal: new THREE.Vector3() };
    const findAim = () => {
      camera.getWorldDirection(camDir);
      const len = 1400;
      rayEnd.copy(camera.position).addScaledVector(camDir, len);
      let best = 1;
      for (const t of battle.tanks) {
        if (t === player || !battle.visibleTo(t, 0)) continue;
        if (segmentObb(camera.position, rayEnd, t.turretMatrix, t.turretInverse, t.model.turretHalf, t.def.turret, obbHit) && obbHit.t < best) best = obbHit.t;
        if (segmentObb(camera.position, rayEnd, t.hullMatrix, t.hullInverse, t.model.hullHalf, t.def.hull, obbHit) && obbHit.t < best) best = obbHit.t;
      }
      const p = camera.position;
      const th = segmentHouse(map, p.x, p.y, p.z, rayEnd.x, rayEnd.y, rayEnd.z);
      if (th >= 0 && th < best) best = th;
      const tr = segmentRock(map, p.x, p.y, p.z, rayEnd.x, rayEnd.y, rayEnd.z);
      if (tr >= 0 && tr < best) best = tr;
      // Le sol : on cherche d'abord a 300 m, puis plus loin si rien.
      const near = segmentGround(map, p.x, p.y, p.z, p.x + camDir.x * 300, p.y + camDir.y * 300, p.z + camDir.z * 300);
      if (near >= 0) best = Math.min(best, (near * 300) / len);
      else {
        const far = segmentGround(map, p.x + camDir.x * 300, p.y + camDir.y * 300, p.z + camDir.z * 300, rayEnd.x, rayEnd.y, rayEnd.z);
        if (far >= 0) best = Math.min(best, (300 + far * (len - 300)) / len);
      }
      aimPoint.copy(camera.position).addScaledVector(camDir, best * len);
      return aimPoint;
    };

    /** Temps de vol de l'obus d'artillerie jusqu'au point vise (null : hors de portee). */
    const artyFlightTime = (): number | null => {
      const range = Math.hypot(artyTarget.x - player.x, artyTarget.z - player.z);
      if (range > (def.artyRange ?? 600)) return null;
      const angle = def.artyAngle ?? 45;
      const v = artyCharge(range, artyTarget.y - player.y - 2, angle, def.shellGravity ?? 9.81);
      if (!v) return null;
      return range / (v * Math.cos((angle * Math.PI) / 180));
    };

    // --- Boucle ---
    const marker = new THREE.Vector3();
    const proj = new THREE.Vector3();
    const plateTank = battle.tanks.filter((t) => !t.isPlayer);
    const pivot = new THREE.Vector3();
    const lookDir = new THREE.Vector3();
    const gunPos = new THREE.Vector3();
    let spectate: SimTank | null = null;
    let hudAt = 0;
    let miniAt = 0;
    let endShownAt = -1;
    let captureWarned = false;
    let lastTime = performance.now();
    let tracksDust = 0;

    const input = { throttle: 0, steer: 0, aim: null as THREE.Vector3 | null, fire: false, ammo: "perforant" as AmmoId };

    const tick = () => {
      // Tant que tout n'est pas pret, on ne dessine rien (un dessin forcerait
      // la compilation d'un bloc et figerait la page).
      if (disposed || !ready) return;
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      clock += dt;

      // --- Commandes du joueur ---
      const kf = keyFor();
      let throttle = 0;
      let steer = 0;
      if (keys.has(kf.fwd) || keys.has("arrowup")) throttle += 1;
      if (keys.has("s") || keys.has("arrowdown")) throttle -= 1;
      if (keys.has(kf.left) || keys.has("arrowleft")) steer += 1;
      if (keys.has("d") || keys.has("arrowright")) steer -= 1;
      throttle = THREE.MathUtils.clamp(throttle + touchThrottle, -1, 1);
      steer = THREE.MathUtils.clamp(steer + touchSteer, -1, 1);
      const active = !pausedNow && player.alive && !battle.ended;
      input.throttle = active ? throttle : 0;
      input.steer = active ? steer : 0;
      input.fire = active && (firePressed || (fireHeld && player.def.clip !== undefined));
      input.ammo = ammo;
      firePressed = false;

      // --- Camera (avant la simulation : la visee part de la camera de l'image d'avant) ---
      const focus = player.alive ? player : spectate && spectate.alive ? spectate : null;
      if (!player.alive && (!spectate || !spectate.alive)) {
        spectate = battle.tanks.find((t) => t.team === 0 && t.alive) ?? null;
        if (sniperMode) setSniperMode(false);
        if (artyMode) setArtyMode(false);
      }
      const target = focus ?? player;
      lookDir.set(Math.sin(camYaw) * Math.cos(camPitch), -Math.sin(camPitch), Math.cos(camYaw) * Math.cos(camPitch));
      const deck = target.def.look.clearance + target.def.look.hullHeight;
      if (artyMode && player.alive) {
        // Vue d'artillerie : haut au-dessus du point de chute, un peu inclinee vers l'avant.
        const gy = groundHeight(map, artyTarget.x, artyTarget.z);
        artyTarget.y = gy + 1;
        camera.position.set(artyTarget.x - Math.sin(camYaw) * artyHeight * 0.3, gy + artyHeight, artyTarget.z - Math.cos(camYaw) * artyHeight * 0.3);
        camera.fov = 50;
        player.model.root.visible = true;
      } else if (sniperMode && player.alive) {
        player.model.gun.getWorldPosition(gunPos);
        camera.position.copy(gunPos).addScaledVector(lookDir, 0.6);
        camera.position.y += 0.35;
        camera.fov = 70 / zoom;
        player.model.root.visible = false;
      } else {
        player.model.root.visible = true;
        pivot.set(target.x, target.y + deck + 1.6, target.z);
        camera.position.copy(pivot).addScaledVector(lookDir, -camDist);
        camera.position.y += 1.2;
        // Jamais sous le sol, ni derriere une colline.
        const gh = groundHeight(map, camera.position.x, camera.position.z) + 1.4;
        if (camera.position.y < gh) camera.position.y = gh;
        camera.fov = 70;
      }
      camera.updateProjectionMatrix();
      if (artyMode && player.alive) camera.lookAt(artyTarget.x, artyTarget.y - 1, artyTarget.z);
      else if (sniperMode && player.alive) camera.lookAt(camera.position.x + lookDir.x, camera.position.y + lookDir.y, camera.position.z + lookDir.z);
      else camera.lookAt(pivot.x + lookDir.x * 30, pivot.y + lookDir.y * 30 + 1.5, pivot.z + lookDir.z * 30);
      if (shake > 0) {
        shake = Math.max(0, shake - dt * 2.2);
        camera.rotation.x += (Math.random() - 0.5) * shake * 0.012;
        camera.rotation.y += (Math.random() - 0.5) * shake * 0.012;
      }
      camera.updateMatrixWorld();
      input.aim = !player.alive ? null : artyMode ? artyTarget : freeLook ? null : findAim();

      // --- Simulation ---
      if (!pausedNow) {
        battle.update(dt, input);
        world.update(dt, clock, camera.position);
        // Le faisceau des canons Gatling tourne pendant la rafale.
        const now = battle.time();
        for (const t of battle.tanks) if (t.def.look.gatling) t.model.spin(dt, t.alive && now - t.lastShotAt < 0.25);
        effects.update(dt);
        // Poussiere derriere les chenilles quand on roule.
        tracksDust += dt;
        if (tracksDust > 0.05) {
          tracksDust = 0;
          for (const t of battle.tanks) {
            if (!t.alive) continue;
            // Fumee d'echappement des chars proches : legere au ralenti, epaisse en pleine charge.
            if (Math.hypot(t.x - camera.position.x, t.z - camera.position.z) < 110) {
              const load = Math.min(1, Math.abs(t.speed) / 6 + (t.isPlayer ? Math.abs(input.throttle) * 0.5 : 0));
              for (const e of t.model.exhausts) {
                exhaustPos.copy(e).applyMatrix4(t.model.root.matrixWorld);
                effects.exhaust(exhaustPos, load);
              }
            }
            if (Math.abs(t.speed) < 2) continue;
            const back = -t.def.look.length * 0.45;
            const fx = Math.sin(t.yaw);
            const fz = Math.cos(t.yaw);
            const amount = Math.min(0.9, Math.abs(t.speed) / 12);
            for (const side of [-1, 1]) {
              const x = t.x + fx * back + fz * side * t.def.look.width * 0.4;
              const z = t.z + fz * back - fx * side * t.def.look.width * 0.4;
              effects.dust(x, groundHeight(map, x, z), z, amount);
            }
          }
        }
      }

      // Tracantes des obus en vol.
      effects.beginTracers();
      for (const s of battle.shells) effects.addTracer(s.pos, s.vel);
      effects.endTracers();

      // Ombres : la zone couverte suit le char regarde.
      sun.target.position.set(target.x, target.y, target.z);
      sun.position.copy(sun.target.position).addScaledVector(sunDir, 200);

      // --- Son du moteur ---
      if (player.alive && !pausedNow) {
        const vmax = player.def.speed / 3.6;
        const rpm = Math.min(1, Math.abs(player.speed) / vmax * 0.8 + Math.abs(input.throttle) * 0.25 + Math.abs(player.turnRate) * 0.3);
        audio.engine(rpm, Math.abs(input.throttle));
        audio.tracks(Math.max(Math.abs(player.speed), Math.abs(player.turnRate) * 2));
        audio.turret(Math.min(1, player.turretRate * 1.2));
      } else {
        audio.engine(0, 0);
        audio.tracks(0);
        audio.turret(0);
      }

      renderer.render(scene, camera);

      // --- Interface a chaque image : marqueur de visee, anneau de rechargement, etiquettes ---
      const w = container.clientWidth;
      const h = container.clientHeight;
      const markerEl = markerRef.current;
      if (markerEl) {
        if (player.alive) {
          const mk = battle.gunMarker(marker);
          proj.copy(marker).project(camera);
          const visible = proj.z < 1;
          const sx = (proj.x * 0.5 + 0.5) * w;
          const sy = (-proj.y * 0.5 + 0.5) * h;
          // Rayon du cercle : l'ecart angulaire ne depend pas de la distance.
          const tanHalf = Math.tan(((camera.fov / 2) * Math.PI) / 180);
          let radius = THREE.MathUtils.clamp(((player.def.dispersion * player.bloom) / 100 / tanHalf) * (h / 2), 10, h * 0.45);
          if (artyMode) {
            // Vue du dessus : le cercle ou l'obus peut tomber, dessine a sa vraie taille au sol.
            const range = Math.hypot(marker.x - player.x, marker.z - player.z);
            const worldR = (player.def.dispersion * player.bloom * Math.max(60, range)) / 100;
            radius = THREE.MathUtils.clamp((worldR / (camera.position.distanceTo(marker) * tanHalf)) * (h / 2), 8, h * 0.45);
          }
          let color = "rgba(255,255,255,0.9)";
          if (mk.tank && mk.hit && mk.tank.team !== 0 && mk.tank.alive) {
            const armor = mk.turret ? mk.tank.def.turret : mk.tank.def.hull;
            player.model.muzzle.getWorldPosition(gunPos);
            camDir.copy(marker).sub(gunPos).normalize();
            const e = effectiveArmor(camDir, mk.hit.normal, zoneThickness(armor, mk.hit.zone), player.def.caliber, player.ammo);
            const pen = player.def.ammo[player.ammo].penetration;
            const chance = e.ricochet ? 0 : penetrationChance(pen, e.effective);
            color = chance > 0.7 ? "rgba(74,222,128,0.95)" : chance > 0.25 ? "rgba(250,204,21,0.95)" : "rgba(248,113,113,0.95)";
          }
          markerEl.style.display = visible ? "block" : "none";
          markerEl.style.transform = `translate(${sx - radius}px, ${sy - radius}px)`;
          markerEl.style.width = `${radius * 2}px`;
          markerEl.style.height = `${radius * 2}px`;
          markerEl.style.borderColor = color;
        } else {
          markerEl.style.display = "none";
        }
      }
      const ring = reloadRef.current;
      if (ring) {
        // Entre deux obus d'une rafale, l'anneau reste plein : seul le chargeur compte.
        const p = player.reloadLeft > 0 && player.fullReload ? 1 - player.reloadLeft / player.def.reload : 1;
        ring.style.strokeDashoffset = String(100 - p * 100);
        ring.style.stroke = p >= 1 ? "rgba(74,222,128,0.95)" : "rgba(250,204,21,0.9)";
      }
      // Indicateur de coup recu : un arc rouge du cote du tireur.
      const hitEl = hitDirRef.current;
      if (hitEl) {
        const age = clock - lastHitAt;
        if (age < 1.6) {
          hitEl.style.display = "block";
          hitEl.style.opacity = String(1 - age / 1.6);
          hitEl.style.transform = `rotate(${((camYaw - lastHitAngle) * 180) / Math.PI}deg)`;
        } else hitEl.style.display = "none";
      }
      // Etiquettes au-dessus des chars reperes.
      for (let i = 0; i < plateTank.length; i++) {
        const t = plateTank[i];
        const el = platesRef.current[i];
        if (!el) continue;
        const show = t.alive && battle.visibleTo(t, 0) && Math.hypot(t.x - camera.position.x, t.z - camera.position.z) < 700;
        if (!show) {
          el.style.display = "none";
          continue;
        }
        proj.set(t.x, t.y + t.def.look.clearance + t.def.look.hullHeight + t.def.look.turret[1] + 2.4, t.z).project(camera);
        if (proj.z > 1 || Math.abs(proj.x) > 1.1 || Math.abs(proj.y) > 1.1) {
          el.style.display = "none";
          continue;
        }
        el.style.display = "block";
        el.style.transform = `translate(${(proj.x * 0.5 + 0.5) * w}px, ${(-proj.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
        const bar = plateBarsRef.current[i];
        if (bar) bar.style.width = `${Math.max(0, (t.hp / t.def.hp) * 100)}%`;
      }

      // --- Interface a 8 Hz ---
      hudAt -= dt;
      if (hudAt <= 0) {
        hudAt = 0.125;
        const teams: [TeamSlot[], TeamSlot[]] = [[], []];
        for (const t of battle.tanks) {
          teams[t.team].push({
            id: t.id,
            cls: t.def.cls,
            name: t.name,
            tank: t.def.name,
            alive: t.alive,
            hpFrac: t.hp / t.def.hp,
            seen: battle.visibleTo(t, 0),
          });
        }
        setHud({
          hp: Math.round(player.hp),
          maxHp: player.def.hp,
          speed: Math.round(Math.abs(player.speed) * 3.6),
          ammo: player.ammo,
          ammoLeft: { ...player.ammoLeft },
          reloadLeft: player.reloadLeft,
          reload: player.def.reload,
          fullReload: player.fullReload || !player.def.clip,
          clipLeft: player.clipLeft,
          clipSize: player.def.clip?.size ?? 1,
          timeLeft: battle.timeLeft,
          capture: [battle.capture.points[0], battle.capture.points[1]],
          cappers: [battle.capture.cappers[0], battle.capture.cappers[1]],
          teams,
          damage: player.damageDealt,
          kills: player.kills,
          dead: !player.alive,
          spectate: !player.alive && spectate ? `${spectate.name} (${spectate.def.name})` : null,
          zoom,
          artyFlight: artyMode ? artyFlightTime() : null,
          hullAngle: player.yaw - camYaw,
          turretAngle: player.yaw + (player.model.fixedTurret ? 0 : player.turretYaw) - camYaw,
          cell: mapCell(player.x, player.z),
        });
        setMessages((list) => (list.some((m) => m.until < clock) ? list.filter((m) => m.until >= clock) : list));
        setFeed((list) => (list.some((f) => f.until < clock) ? list.filter((f) => f.until >= clock) : list));
        if (battle.capture.points[0] > 5 && !captureWarned) {
          captureWarned = true;
          playCaptureAlert(audio);
          pushMsg("Notre base est en train d'être capturée !", "#f87171");
        }
        if (battle.capture.points[0] === 0) captureWarned = false;
      }

      // --- Mini-carte a 6 Hz ---
      miniAt -= dt;
      const mini = minimapRef.current;
      if (miniAt <= 0 && mini) {
        miniAt = 0.16;
        const g = mini.getContext("2d");
        if (g) {
          const S = mini.width;
          const k = S / (MAP_HALF * 2);
          const px = (v: number) => (v + MAP_HALF) * k;
          g.drawImage(miniBg, 0, 0, S, S);
          // Bases.
          map.bases.forEach((b, team) => {
            g.strokeStyle = team === 0 ? "#4ade80" : "#f87171";
            g.lineWidth = 2;
            g.beginPath();
            g.arc(px(b.x), px(b.z), BASE_RADIUS * k, 0, Math.PI * 2);
            g.stroke();
          });
          // Point de chute de l'artillerie.
          if (artyMode && player.alive) {
            g.strokeStyle = "#f97316";
            g.lineWidth = 2;
            g.beginPath();
            g.arc(px(artyTarget.x), px(artyTarget.z), 5, 0, Math.PI * 2);
            g.moveTo(px(artyTarget.x) - 8, px(artyTarget.z));
            g.lineTo(px(artyTarget.x) + 8, px(artyTarget.z));
            g.moveTo(px(artyTarget.x), px(artyTarget.z) - 8);
            g.lineTo(px(artyTarget.x), px(artyTarget.z) + 8);
            g.stroke();
          }
          // Portee de vue.
          if (player.alive) {
            g.strokeStyle = "rgba(255,255,255,0.35)";
            g.lineWidth = 1;
            g.beginPath();
            g.arc(px(player.x), px(player.z), player.def.viewRange * k, 0, Math.PI * 2);
            g.stroke();
          }
          for (const t of battle.tanks) {
            if (t.isPlayer) continue;
            if (!battle.visibleTo(t, 0)) continue;
            const x = px(t.x);
            const y = px(t.z);
            if (!t.alive) {
              g.strokeStyle = "rgba(160,160,160,0.8)";
              g.lineWidth = 1.5;
              g.beginPath();
              g.moveTo(x - 3, y - 3);
              g.lineTo(x + 3, y + 3);
              g.moveTo(x + 3, y - 3);
              g.lineTo(x - 3, y + 3);
              g.stroke();
              continue;
            }
            g.fillStyle = t.team === 0 ? "#4ade80" : "#f87171";
            g.beginPath();
            g.arc(x, y, 3.4, 0, Math.PI * 2);
            g.fill();
          }
          // Mon char : une fleche, et la direction de la camera.
          const me = player.alive ? player : (spectate ?? player);
          const mx = px(me.x);
          const my = px(me.z);
          g.strokeStyle = "rgba(255,255,255,0.7)";
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(mx, my);
          g.lineTo(mx + Math.sin(camYaw) * 40, my + Math.cos(camYaw) * 40);
          g.stroke();
          g.save();
          g.translate(mx, my);
          g.rotate(-me.yaw + Math.PI);
          g.fillStyle = "#fff";
          g.beginPath();
          g.moveTo(0, -6);
          g.lineTo(4.5, 5);
          g.lineTo(-4.5, 5);
          g.closePath();
          g.fill();
          g.restore();
        }
      }

      // --- Fin de bataille ---
      if (battle.ended && endShownAt < 0) {
        endShownAt = clock;
        setEnded(battle.ended);
        if (document.pointerLockElement) document.exitPointerLock?.();
      }
      if (endShownAt >= 0 && clock - endShownAt > 4) {
        endShownAt = Infinity;
        const e = battle.ended!;
        const win = e.winner === 0;
        const xp = Math.round(
          100 + player.damageDealt * 0.6 + player.kills * 140 + player.hits * 6 + (win ? 350 : e.winner === -1 ? 120 : 0),
        );
        onEndRef.current({
          winner: e.winner,
          reason: e.reason,
          tankId,
          damage: player.damageDealt,
          kills: player.kills,
          shots: player.shots,
          hits: player.hits,
          pens: player.pens,
          damageTaken: player.damageTaken,
          survived: player.alive,
          xp,
          credits: Math.round(xp * 12 + (win ? 4000 : 1500)),
          seconds: Math.round(battle.time()),
          mode,
          mapName: map.name,
          damageBlocked: player.damageBlocked,
          assist: player.assist,
          detections: player.detections,
          board: battle.tanks.map((t) => ({
            team: t.team,
            name: t.name,
            tank: t.def.name,
            cls: t.def.cls,
            tier: t.def.tier,
            damage: t.damageDealt,
            kills: t.kills,
            alive: t.alive,
            isPlayer: t.isPlayer,
          })),
        });
      }
    };

    // Tout preparer AVANT la premiere image, sans figer la page : le sol se
    // peint par tranches, et les programmes des materiaux (effets compris) se
    // compilent en arriere-plan (compileAsync). Sur un portable lent, les
    // compiler d'un bloc gelait la page de longues secondes ; les compiler a
    // la volee figeait la bataille a la premiere explosion.
    camera.position.set(player.x, player.y + 8, player.z - 14);
    camera.lookAt(player.x, player.y + 2, player.z);
    Promise.all([world.ready, renderer.compileAsync(scene, camera)])
      .catch(() => {})
      .then(() => {
        if (disposed) return;
        // Une image cachee derriere l'ecran de chargement : les ombres se preparent aussi.
        renderer.render(scene, camera);
        ready = true;
        lastTime = performance.now();
        setPlates(plateList);
        setLoading(false);
      });
    const interval = window.setInterval(tick, 16);

    const onResize = () => {
      camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("mousemove", onMouseMove);
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("contextmenu", onContext);
      document.removeEventListener("pointerlockchange", onLockChange);
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock?.();
      apiRef.current = null;
      for (const t of battle.tanks) t.model.dispose();
      world.dispose();
      effects.dispose();
      audio.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [tankId, camo, mapId, mode, difficulty, touch]);

  const def = tankById(tankId);
  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const alive = hud ? [hud.teams[0].filter((t) => t.alive).length, hud.teams[1].filter((t) => t.alive).length] : [7, 7];

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-black text-white">
      <div ref={mountRef} className="absolute inset-0" />

      {/* Chargement */}
      {loading && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-stone-950">
          <p className="text-lg font-black uppercase tracking-[0.3em] text-amber-300">Tonnerre d&apos;Acier</p>
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">{MODES[mode].name}</p>
          <p className="text-base font-bold text-zinc-100">{mapInfo(mapId).name}</p>
          <p className="max-w-xs text-center text-xs text-zinc-400">{mapInfo(mapId).tagline}</p>
          <p className="text-sm text-zinc-400">Préparation du champ de bataille…</p>
        </div>
      )}

      {/* Vue d'artillerie : vignette legere et temps de vol */}
      {artyView && (
        <div className="pointer-events-none absolute inset-0 z-10">
          <div className="absolute inset-0" style={{ background: "radial-gradient(circle at center, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
          <p className="absolute left-1/2 top-16 -translate-x-1/2 rounded bg-black/65 px-3 py-1 text-xs font-bold uppercase tracking-widest text-orange-300">
            Vue d&apos;artillerie ·{" "}
            {hud?.artyFlight == null ? "hors de portée" : `vol ${hud.artyFlight.toFixed(1)} s`}
          </p>
        </div>
      )}

      {/* Viseur de precision */}
      {sniper && (
        <div className="pointer-events-none absolute inset-0 z-10">
          <div className="absolute inset-0" style={{ background: "radial-gradient(circle at center, transparent 34%, rgba(0,0,0,0.92) 36%)" }} />
          <svg className="absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2" viewBox="0 0 200 200">
            <g stroke="rgba(10,10,10,0.85)" strokeWidth="0.8" fill="none">
              <path d="M0 100h88M112 100h88M100 112v88" />
              <path d="M100 0v88" strokeWidth="0.5" />
              {[20, 40, 60].map((d) => (
                <path key={d} d={`M${100 - d} 97v6M${100 + d} 97v6M97 ${100 + d}h6`} />
              ))}
            </g>
          </svg>
          <p className="absolute bottom-[18%] left-1/2 -translate-x-1/2 rounded bg-black/60 px-2 py-0.5 font-mono text-xs text-amber-200">
            x{hud?.zoom ?? 2}
          </p>
        </div>
      )}

      {/* Marqueur de visee (cercle de dispersion) et anneau de rechargement */}
      <div
        ref={markerRef}
        className="pointer-events-none absolute left-0 top-0 z-20 rounded-full border-2"
        style={{ display: "none", boxShadow: "0 0 3px rgba(0,0,0,0.8), inset 0 0 3px rgba(0,0,0,0.6)" }}
      >
        <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow" />
      </div>
      <svg className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-16 w-16 -translate-x-1/2 -translate-y-1/2" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="1.2" />
        <circle
          ref={reloadRef}
          cx="18"
          cy="18"
          r="15.9"
          fill="none"
          strokeWidth="1.4"
          pathLength={100}
          strokeDasharray="100"
          strokeDashoffset="0"
          transform="rotate(-90 18 18)"
        />
        <path d="M18 14v2.5M18 19.5V22M14 18h2.5M19.5 18H22" stroke="rgba(255,255,255,0.8)" strokeWidth="0.9" />
      </svg>

      {/* Coup recu : arc rouge du cote du tireur */}
      <div ref={hitDirRef} className="pointer-events-none absolute left-1/2 top-1/2 z-20 -ml-40 -mt-40 h-80 w-80" style={{ display: "none" }}>
        <div className="absolute left-1/2 top-0 h-10 w-28 -translate-x-1/2 rounded-t-full border-t-4 border-red-500/90" />
      </div>

      {/* Etiquettes des chars */}
      {plates.map((p, i) => (
        <div
          key={p.id}
          ref={(el) => {
            platesRef.current[i] = el;
          }}
          className="pointer-events-none absolute left-0 top-0 z-10 whitespace-nowrap text-center"
          style={{ display: "none" }}
        >
          <p className={`text-[11px] font-bold drop-shadow ${p.team === 0 ? "text-green-300" : "text-red-300"}`}>
            {p.name} <span className="font-normal opacity-80">{p.tank}</span>
          </p>
          <div className="mx-auto mt-0.5 h-1.5 w-16 overflow-hidden rounded-sm bg-black/60">
            <div
              ref={(el) => {
                plateBarsRef.current[i] = el;
              }}
              className={`h-full ${p.team === 0 ? "bg-green-400" : "bg-red-500"}`}
            />
          </div>
        </div>
      ))}

      {/* Haut : equipes, score et chrono */}
      {hud && (
        <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex items-start justify-center gap-3 px-2">
          <div className="flex flex-wrap justify-end gap-0.5 rounded-l bg-gradient-to-l from-black/70 to-transparent py-1 pl-3 pr-1">
            {hud.teams[0].map((t) => (
              <TankClassIcon
                key={t.id}
                cls={t.cls}
                className={`h-4 w-4 drop-shadow ${t.alive ? "text-green-400" : "text-zinc-600"}`}
                title={`${t.name} (${t.tank})`}
              />
            ))}
          </div>
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-3 rounded bg-black/75 px-3 py-0.5 font-mono font-black shadow">
              <span className="text-xl text-green-400">{hud.teams[1].length - alive[1]}</span>
              <span className="text-xs text-zinc-300">{fmtTime(hud.timeLeft)}</span>
              <span className="text-xl text-red-400">{hud.teams[0].length - alive[0]}</span>
            </div>
            {/* Drapeaux des bases : le cercle se remplit pendant la capture. */}
            <div className="mt-1 flex gap-2">
              {[0, 1].map((b) => (
                <span
                  key={b}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-black text-white shadow"
                  style={{
                    background: `conic-gradient(${b === 0 ? "#ef4444" : "#22c55e"} ${hud.capture[b]}%, ${b === 0 ? "#166534" : "#991b1b"} 0)`,
                  }}
                  title={b === 0 ? "Notre base" : "Base ennemie"}
                >
                  ⚑
                </span>
              ))}
            </div>
            <p className="mt-0.5 rounded bg-black/55 px-2 text-[10px] font-bold text-zinc-200">
              Ennemis restants : <span className="text-red-300">{alive[1]}</span> · Alliés : <span className="text-green-300">{alive[0]}</span>
            </p>
            {[1, 0].map((b) =>
              hud.capture[b] > 0.5 ? (
                <div key={b} className="mt-1 w-48 rounded bg-black/70 px-2 py-1">
                  <p className={`text-[10px] font-bold uppercase ${b === 1 ? "text-green-300" : "text-red-300"}`}>
                    {b === 1 ? "Capture de la base ennemie" : "Notre base est capturée !"} · {Math.floor(hud.capture[b])}%
                  </p>
                  <div className="mt-0.5 h-1.5 overflow-hidden rounded bg-white/15">
                    <div className={`h-full ${b === 1 ? "bg-green-400" : "bg-red-500"}`} style={{ width: `${hud.capture[b]}%` }} />
                  </div>
                </div>
              ) : null,
            )}
          </div>
          <div className="flex flex-wrap gap-0.5 rounded-r bg-gradient-to-r from-black/70 to-transparent py-1 pl-1 pr-3">
            {hud.teams[1].map((t) => (
              <TankClassIcon
                key={t.id}
                cls={t.cls}
                className={`h-4 w-4 drop-shadow ${!t.alive ? "text-zinc-600" : t.seen ? "text-red-400" : "text-red-400/40"}`}
                title={`${t.name} (${t.tank})`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Fil des destructions */}
      <div className="pointer-events-none absolute right-3 top-14 z-20 flex flex-col items-end gap-1">
        {feed.map((f) => (
          <p key={f.id} className="rounded bg-black/60 px-2 py-0.5 text-[11px]">
            <span className={f.killerTeam === 0 ? "text-green-300" : "text-red-300"}>{f.killer}</span>
            <span className="mx-1 text-zinc-400">a détruit</span>
            <span className={f.victimTeam === 0 ? "text-green-300" : "text-red-300"}>{f.victim}</span>
          </p>
        ))}
      </div>

      {/* Messages de tir */}
      <div className="pointer-events-none absolute inset-x-0 bottom-36 z-20 flex flex-col items-center gap-1">
        {messages.map((m) => (
          <p key={m.id} className="rounded bg-black/55 px-3 py-0.5 text-sm font-bold drop-shadow" style={{ color: m.color }}>
            {m.text}
          </p>
        ))}
      </div>

      {/* Bas gauche : mon char */}
      {hud && (
        <div className="pointer-events-none absolute left-2 top-[60px] z-20 w-44 rounded-md border-l-2 border-green-500 bg-black/65 p-1.5 sm:bottom-3 sm:left-3 sm:top-auto sm:w-64 sm:p-2">
          <div className="flex items-center gap-2">
            <TankClassIcon cls={def.cls} className="h-4 w-4 text-green-400" />
            <p className="text-sm font-bold">
              <span className="mr-1 font-mono text-xs text-amber-300">{["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][def.tier]}</span>
              {def.name}
            </p>
            <p className="ml-auto font-mono text-xs text-zinc-300">{hud.speed} km/h</p>
          </div>
          {/* Schema vu de dessus : la caisse et la tourelle par rapport a la camera. */}
          <svg viewBox="-20 -20 40 40" className="mx-auto my-1 hidden h-16 w-16 sm:block" aria-hidden>
            <g transform={`rotate(${(-hud.hullAngle * 180) / Math.PI})`}>
              <rect x="-7" y="-11" width="14" height="22" rx="1.5" fill="none" stroke="rgba(255,255,255,.75)" strokeWidth="1.4" />
              <path d="M-7 -8h-2v16h2M7 -8h2v16h-2" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="1.2" />
            </g>
            <g transform={`rotate(${(-hud.turretAngle * 180) / Math.PI})`}>
              <circle r="4.5" fill="rgba(74,222,128,.25)" stroke="#4ade80" strokeWidth="1.2" />
              <path d="M0 -4.5V-17" stroke="#4ade80" strokeWidth="1.6" />
            </g>
          </svg>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded bg-white/15">
            <div
              className={`h-full ${hud.hp / hud.maxHp > 0.5 ? "bg-green-500" : hud.hp / hud.maxHp > 0.25 ? "bg-yellow-400" : "bg-red-500"}`}
              style={{ width: `${(hud.hp / hud.maxHp) * 100}%` }}
            />
          </div>
          <p className="mt-0.5 font-mono text-xs text-zinc-200">
            {hud.hp} / {hud.maxHp}
            <span className="float-right hidden text-amber-300 sm:inline">
              {hud.damage} dégâts · {hud.kills} détruit{hud.kills > 1 ? "s" : ""}
            </span>
          </p>
        </div>
      )}

      {/* Bas centre : obus */}
      {hud && !hud.dead && (
        <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
          {AMMO_ORDER.map((a, i) => (
            <button
              key={a}
              type="button"
              onClick={() => apiRef.current?.setAmmo(a)}
              className={`w-14 rounded-md border px-1.5 py-1 text-left sm:w-20 sm:px-2 ${
                hud.ammo === a ? "border-amber-300 bg-amber-300/20" : "border-white/15 bg-black/65"
              }`}
            >
              <p className="flex items-center justify-between text-[10px] text-zinc-400">
                <span className="flex items-center gap-1">
                  <ShellIcon ammo={a} className="h-4 w-2" />
                  {i + 1}
                </span>
                <span className="font-mono text-zinc-100">{hud.ammoLeft[a]}</span>
              </p>
              <p className="text-xs font-bold">
                <span className="sm:hidden">{AMMO[a].short}</span>
                <span className="hidden sm:inline">{AMMO[a].name}</span>
              </p>
              <p className="hidden font-mono text-[10px] text-zinc-400 sm:block">{def.ammo[a].penetration} mm</p>
            </button>
          ))}
          <div className="flex w-14 flex-col items-center justify-center rounded-md border border-white/15 bg-black/65 px-1.5 py-1 sm:w-16 sm:px-2">
            <p className="text-[10px] text-zinc-400">{hud.clipSize > 1 ? "Chargeur" : "Rechargement"}</p>
            {hud.clipSize > 1 && (
              <p className="font-mono text-xs font-bold text-zinc-100">
                {hud.clipLeft}/{hud.clipSize}
              </p>
            )}
            <p
              className={`font-mono text-sm font-bold ${
                hud.reloadLeft > 0 && hud.fullReload ? "text-amber-300" : "text-green-400"
              }`}
            >
              {hud.reloadLeft > 0 && hud.fullReload ? `${hud.reloadLeft.toFixed(1)} s` : "Prêt"}
            </p>
          </div>
        </div>
      )}

      {/* Bas droite : mini-carte */}
      <div className="pointer-events-none absolute left-2 top-[124px] z-20 rounded-md border border-white/20 bg-black/60 p-1 sm:bottom-3 sm:left-auto sm:right-3 sm:top-auto">
        <canvas ref={minimapRef} width={200} height={200} className="block h-[110px] w-[110px] sm:h-[200px] sm:w-[200px]" />
        {hud && <p className="mt-0.5 text-center font-mono text-[10px] font-bold text-zinc-300">Case {hud.cell}</p>}
      </div>

      {/* Char detruit : spectateur */}
      {hud?.dead && !ended && (
        <div className="absolute inset-x-0 top-24 z-20 flex flex-col items-center gap-2">
          <p className="rounded bg-black/70 px-4 py-1 text-lg font-black uppercase text-red-400">Ton char est détruit</p>
          {hud.spectate && <p className="text-xs text-zinc-300">Tu regardes {hud.spectate}</p>}
          <button type="button" onClick={onQuit} className="rounded bg-white/15 px-3 py-1 text-xs font-bold hover:bg-white/25">
            Quitter la bataille
          </button>
        </div>
      )}

      {/* Fin de bataille */}
      {ended && (
        <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/40">
          <p
            className={`text-5xl font-black uppercase tracking-widest drop-shadow-lg ${
              ended.winner === 0 ? "text-green-400" : ended.winner === 1 ? "text-red-400" : "text-zinc-200"
            }`}
          >
            {ended.winner === 0 ? "Victoire !" : ended.winner === 1 ? "Défaite" : "Match nul"}
          </p>
          <p className="mt-2 text-sm text-zinc-200">
            {ended.reason === "capture"
              ? ended.winner === 0
                ? "La base ennemie est capturée."
                : "Notre base est tombée."
              : ended.reason === "destruction"
                ? ended.winner === 0
                  ? "Tous les chars ennemis sont détruits."
                  : "Toute l'équipe est détruite."
                : "Le temps est écoulé."}
          </p>
        </div>
      )}

      {/* Clic pour jouer / pause */}
      {!loading && !locked && !touch && !ended && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/55">
          <p className="text-2xl font-black uppercase tracking-wider text-amber-300">{paused ? "Pause" : "Prêt au combat"}</p>
          <button
            type="button"
            onClick={() => apiRef.current?.resume()}
            className="rounded-lg bg-amber-400 px-6 py-2.5 font-black uppercase text-black hover:bg-amber-300"
          >
            {paused ? "Reprendre" : "Cliquer pour jouer"}
          </button>
          <div className="mt-2 grid max-w-md grid-cols-2 gap-x-6 gap-y-1 text-xs text-zinc-300">
            <span>
              <b>{loadLayout3DLabel()}</b> rouler et tourner
            </span>
            <span>
              <b>Souris</b> viser (la tourelle suit)
            </span>
            <span>
              <b>Clic gauche</b> tirer (maintenu : rafale)
            </span>
            <span>
              <b>Clic droit maintenu</b> regarder librement
            </span>
            <span>
              <b>Maj</b> ou <b>molette</b> viseur de précision
            </span>
            <span>
              <b>1 2 3</b> perforant, sous-calibré, explosif
            </span>
          </div>
          <p className="max-w-md text-center text-[11px] text-zinc-400">
            Cercle vert : tu perces sûrement. Jaune : c&apos;est possible. Rouge : ton obus rebondira ou ne percera pas. Vise les
            flancs et l&apos;arrière, et présente ton blindage en biais.
          </p>
          <button type="button" onClick={onQuit} className="mt-1 text-xs text-zinc-400 underline hover:text-white">
            Quitter la bataille
          </button>
        </div>
      )}

      {/* Reglages partages */}
      {!loading && (
        <Game3DSettings
          onLayout={(v) => apiRef.current?.setLayout(v)}
          onSensitivity={(v) => apiRef.current?.setSensitivity(v)}
          onBrightness={(v) => apiRef.current?.setBrightness(v)}
          brightness={1}
          onOpenChange={(open) => {
            if (open) apiRef.current?.setPaused(true);
          }}
        />
      )}

      {/* Commandes tactiles */}
      {touch && !loading && !ended && <TouchControls api={apiRef} />}
    </div>
  );
}

function loadLayout3DLabel(): string {
  return loadLayout3D() === "qwerty" ? "WASD" : "ZQSD";
}

/** Joystick a gauche pour rouler, glisser ailleurs pour viser, boutons de tir. */
function TouchControls({
  api,
}: {
  api: RefObject<{
    touchMove: (throttle: number, steer: number) => void;
    touchLook: (dx: number, dy: number) => void;
    touchFire: (on: boolean) => void;
    toggleSniper: () => void;
  } | null>;
}) {
  const stickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const lookRef = useRef<{ id: number; x: number; y: number } | null>(null);

  const moveStick = (e: React.PointerEvent) => {
    const el = stickRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.min(1, Math.hypot(dx, dy));
    const a = Math.atan2(dy, dx);
    const x = Math.cos(a) * l;
    const y = Math.sin(a) * l;
    if (knobRef.current) knobRef.current.style.transform = `translate(${x * 40}px, ${y * 40}px)`;
    api.current?.touchMove(-y, -x);
  };
  const endStick = () => {
    if (knobRef.current) knobRef.current.style.transform = "translate(0, 0)";
    api.current?.touchMove(0, 0);
  };

  return (
    <>
      <div
        className="absolute inset-0 z-[15]"
        style={{ touchAction: "none" }}
        onPointerDown={(e) => {
          lookRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          const l = lookRef.current;
          if (!l || l.id !== e.pointerId) return;
          api.current?.touchLook(e.clientX - l.x, e.clientY - l.y);
          l.x = e.clientX;
          l.y = e.clientY;
        }}
        onPointerUp={() => {
          lookRef.current = null;
        }}
      />
      <div
        ref={stickRef}
        className="absolute bottom-24 left-6 z-30 h-28 w-28 rounded-full border border-white/25 bg-black/30"
        style={{ touchAction: "none" }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          moveStick(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons || e.pointerType === "touch") moveStick(e);
        }}
        onPointerUp={endStick}
        onPointerCancel={endStick}
      >
        <div ref={knobRef} className="absolute left-1/2 top-1/2 -ml-6 -mt-6 h-12 w-12 rounded-full bg-white/40" />
      </div>
      <div className="absolute bottom-28 right-6 z-30 flex flex-col items-center gap-3">
        <button
          type="button"
          onPointerDown={() => api.current?.toggleSniper()}
          className="h-12 w-12 rounded-full border border-white/30 bg-black/50 text-[10px] font-bold"
        >
          VISEUR
        </button>
        <button
          type="button"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            api.current?.touchFire(true);
          }}
          onPointerUp={() => api.current?.touchFire(false)}
          onPointerCancel={() => api.current?.touchFire(false)}
          className="h-20 w-20 rounded-full border-2 border-amber-300 bg-amber-400/40 text-sm font-black"
        >
          FEU
        </button>
      </div>
    </>
  );
}
