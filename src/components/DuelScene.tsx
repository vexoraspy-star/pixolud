"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import {
  buildDuelMap,
  DUEL_CELL,
  DUEL_WALL_HEIGHT,
  DUEL_MOVE_SPEED,
  DUEL_PLAYER_RADIUS,
  DUEL_EYE_HEIGHT,
  DUEL_MAX_HP,
  DUEL_DAMAGE,
  DUEL_HEADSHOT_DAMAGE,
  DUEL_FIRE_INTERVAL,
  DUEL_MAG_SIZE,
  DUEL_RELOAD_SECONDS,
  DUEL_RESPAWN_SECONDS,
  DUEL_SCORE_TO_WIN,
  DUEL_BODY_RADIUS,
  DUEL_HEAD_Y,
  DUEL_HEAD_RADIUS,
  DUEL_NET_HZ,
  type DuelSide,
  type DuelNetState,
} from "@/lib/duel";
import {
  makeArenaWallTexture,
  makeArenaFloorTexture,
  makeArenaCeilingTexture,
} from "@/lib/duelTextures";
import {
  createDuelAudio,
  playShot,
  playImpact,
  playHitmarker,
  playHeadshot,
  playHurt,
  playDeath,
  playReload,
  playDryFire,
  playDuelStep,
  playRespawn,
  playMatchEnd,
} from "@/lib/duelAudio";
import { loadLayout3D, loadSensitivity3D } from "@/lib/settings3d";
import Game3DSettings from "./Game3DSettings";

/** Boite aux lettres partagee avec le parent : aucune mise a jour React par paquet recu. */
export interface DuelLink {
  remote: DuelNetState | null;
  inbox: { event: string; payload: Record<string, unknown> }[];
  send: (event: string, payload: Record<string, unknown>) => void;
}

interface KillFeedEntry {
  id: number;
  text: string;
  mine: boolean;
}

const LOOK_SENSITIVITY = 0.0034;
/** Temps qu'il met a te "voir" avant d'ouvrir le feu. */
const BOT_REACTION = 0.55;
/** Cadence de tir du bot, en secondes (min + aleatoire). */
const BOT_FIRE_MIN = 0.62;
const BOT_FIRE_RANDOM = 0.5;
/** Il recharge apres ce nombre de balles : c'est ta fenetre pour l'attaquer. */
const BOT_MAG = 8;
const BOT_RELOAD = 1.8;

export default function DuelScene({
  side,
  opponentName,
  bot,
  link,
  onMatchEnd,
}: {
  side: DuelSide;
  opponentName: string;
  bot: boolean;
  /** Ref vers la boite aux lettres reseau : on ne la lit que dans l'effet. */
  link: RefObject<DuelLink>;
  onMatchEnd: (win: boolean, myScore: number, oppScore: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hp, setHp] = useState(DUEL_MAX_HP);
  const [ammo, setAmmo] = useState(DUEL_MAG_SIZE);
  const [reloading, setReloading] = useState(false);
  const [myScore, setMyScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [respawnIn, setRespawnIn] = useState(0);
  const [hitMarker, setHitMarker] = useState(0);
  const [damageFlash, setDamageFlash] = useState(0);
  const [feed, setFeed] = useState<KillFeedEntry[]>([]);
  const [locked, setLocked] = useState(false);

  const [touchDevice, setTouchDevice] = useState(false);

  const onMatchEndRef = useRef(onMatchEnd);
  // Reglages modifiables en pleine partie via le panneau ⚙️.
  const sensitivityRef = useRef(1.5);
  const layoutRef = useRef<{ current: "azerty" | "qwerty" } | null>(null);
  // Commandes tactiles : le joystick et les boutons ecrivent ici, la boucle
  // de jeu les lit. Sans ca, le jeu est totalement injouable au telephone.
  const touchRef = useRef({ moveX: 0, moveZ: 0, firing: false });
  const sceneApiRef = useRef<{ reload: () => void } | null>(null);
  const stickOrigin = useRef<{ x: number; y: number } | null>(null);
  const [stickOffset, setStickOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const t = setTimeout(() => {
      setTouchDevice(
        typeof window !== "undefined" &&
          (window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window),
      );
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    onMatchEndRef.current = onMatchEnd;
  }, [onMatchEnd]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const layout = { current: loadLayout3D() };
    layoutRef.current = layout;
    const sensitivity = sensitivityRef;
    sensitivity.current = loadSensitivity3D();
    const map = buildDuelMap();
    const wallSet = new Set(map.walls.map(([x, y]) => `${x},${y}`));
    const isSolid = (cx: number, cy: number) =>
      cx < 0 || cy < 0 || cx >= map.width || cy >= map.height || wallSet.has(`${cx},${cy}`);

    const mySpawns = map.spawns[side];
    const oppSpawns = map.spawns[side === "a" ? "b" : "a"];

    const me = {
      x: mySpawns[0][0] + 0.5,
      z: mySpawns[0][1] + 0.5,
      yaw: side === "a" ? -Math.PI * 0.75 : Math.PI * 0.25,
      pitch: 0,
      hp: DUEL_MAX_HP,
      dead: false,
      respawnAt: 0,
      mag: DUEL_MAG_SIZE,
      reloadUntil: 0,
      nextShotAt: 0,
      score: 0,
    };
    const opp = {
      x: oppSpawns[0][0] + 0.5,
      z: oppSpawns[0][1] + 0.5,
      yaw: 0,
      hp: DUEL_MAX_HP,
      dead: false,
      moving: false,
      score: 0,
      // cible reseau vers laquelle on interpole
      tx: oppSpawns[0][0] + 0.5,
      tz: oppSpawns[0][1] + 0.5,
      tyaw: 0,
      // IA du mode entrainement
      path: null as [number, number][] | null,
      pathIndex: 0,
      repathTimer: 0,
      nextBotShotAt: 2,
      seenFor: 0,
      respawnAt: 0,
      mag: BOT_MAG,
    };

    // --- Scene ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1014);
    scene.fog = new THREE.Fog(0x0d1014, 14 * DUEL_CELL, 30 * DUEL_CELL);

    const camera = new THREE.PerspectiveCamera(
      82,
      container.clientWidth / container.clientHeight,
      0.05,
      160,
    );
    camera.rotation.order = "YXZ";

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    scene.add(camera);

    // Eclairage volontairement simple : l'arene doit rester LISIBLE, c'est
    // un jeu de tir, pas un jeu d'ambiance.
    scene.add(new THREE.HemisphereLight(0xb6c9dd, 0x2a3138, 2.7));
    const key = new THREE.DirectionalLight(0xd6f0ff, 0.9);
    key.position.set(12, 24, 8);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x8fb4d8, 0.5);
    fill.position.set(-14, 18, -10);
    scene.add(fill);

    const worldW = map.width * DUEL_CELL;
    const worldH = map.height * DUEL_CELL;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(worldW, worldH),
      new THREE.MeshLambertMaterial({ map: makeArenaFloorTexture(map.width, map.height) }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(worldW / 2, 0, worldH / 2);
    scene.add(floor);

    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(worldW, worldH),
      new THREE.MeshLambertMaterial({ map: makeArenaCeilingTexture(map.width, map.height) }),
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(worldW / 2, DUEL_WALL_HEIGHT, worldH / 2);
    scene.add(ceiling);

    const wallMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(DUEL_CELL, DUEL_WALL_HEIGHT, DUEL_CELL),
      new THREE.MeshLambertMaterial({ map: makeArenaWallTexture() }),
      map.walls.length,
    );
    const mat4 = new THREE.Matrix4();
    map.walls.forEach(([wx, wy], i) => {
      mat4.makeTranslation(
        (wx + 0.5) * DUEL_CELL,
        DUEL_WALL_HEIGHT / 2,
        (wy + 0.5) * DUEL_CELL,
      );
      wallMesh.setMatrixAt(i, mat4);
    });
    scene.add(wallMesh);

    // --- Adversaire ---
    const oppGroup = new THREE.Group();
    const enemyMat = new THREE.MeshLambertMaterial({ color: 0xc9402f });
    const enemyDark = new THREE.MeshLambertMaterial({ color: 0x2a1512 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.33, 0.8, 4, 10), enemyMat);
    body.position.y = 0.82;
    oppGroup.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(DUEL_HEAD_RADIUS, 12, 12), enemyDark);
    head.position.y = DUEL_HEAD_Y;
    oppGroup.add(head);
    const visor = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xff5a3c }),
    );
    visor.position.set(0, DUEL_HEAD_Y + 0.02, DUEL_HEAD_RADIUS + 0.01);
    oppGroup.add(visor);
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.5, 4, 6), enemyDark);
      arm.position.set(s * 0.38, 0.95, 0.08);
      oppGroup.add(arm);
    }
    const oppGun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.62), enemyDark);
    oppGun.position.set(0.2, 1.02, 0.36);
    oppGroup.add(oppGun);
    scene.add(oppGroup);

    // --- Arme du joueur (attachee a la camera) ---
    const gun = new THREE.Group();
    const gunMetal = new THREE.MeshLambertMaterial({ color: 0x3a4048 });
    const gunDark = new THREE.MeshLambertMaterial({ color: 0x191d22 });
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.44), gunMetal);
    gun.add(receiver);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.42, 8), gunDark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.015, -0.4);
    gun.add(barrel);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.1), gunDark);
    grip.position.set(0, -0.16, 0.12);
    grip.rotation.x = -0.22;
    gun.add(grip);
    const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.09), gunDark);
    magazine.position.set(0, -0.17, -0.06);
    gun.add(magazine);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.02), gunDark);
    sight.position.set(0, 0.09, -0.18);
    gun.add(sight);
    const hand = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.09, 4, 8), new THREE.MeshLambertMaterial({ color: 0xa87c58 }));
    hand.rotation.z = Math.PI / 2;
    hand.position.set(0, -0.09, 0.08);
    gun.add(hand);
    const muzzle = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95 }),
    );
    muzzle.position.set(0, 0.015, -0.62);
    muzzle.visible = false;
    gun.add(muzzle);
    const GUN_BASE = new THREE.Vector3(0.23, -0.19, -0.66);
    gun.position.copy(GUN_BASE);
    gun.rotation.y = -0.06;
    gun.scale.setScalar(0.58);
    camera.add(gun);

    // Traceur reutilise pour chaque tir.
    const tracer = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.035, 1),
      new THREE.MeshBasicMaterial({ color: 0xffe6a8, transparent: true, opacity: 0.85 }),
    );
    tracer.visible = false;
    scene.add(tracer);
    const oppTracer = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.035, 1),
      new THREE.MeshBasicMaterial({ color: 0xff9a7a, transparent: true, opacity: 0.85 }),
    );
    oppTracer.visible = false;
    scene.add(oppTracer);

    const audio = createDuelAudio();

    let elapsed = 0;
    let lastTime = performance.now();
    let tracerUntil = 0;
    let oppTracerUntil = 0;
    let muzzleUntil = 0;
    let recoil = 0;
    let walkPhase = 0;
    let nextStepAt = 0;
    let nextOppStepAt = 0;
    let nextNetAt = 0;
    let uiTimer = 0;
    let hitMarkerLevel = 0;
    let damageLevel = 0;
    let feedId = 0;
    let ended = false;
    const keys = new Set<string>();
    let firing = false;

    function addFeed(text: string, mine: boolean) {
      feedId += 1;
      const id = feedId;
      setFeed((f) => [...f.slice(-2), { id, text, mine }]);
      window.setTimeout(() => setFeed((f) => f.filter((e) => e.id !== id)), 4000);
    }

    function circleHitsWall(px: number, pz: number): boolean {
      const minX = Math.floor(px - DUEL_PLAYER_RADIUS);
      const maxX = Math.floor(px + DUEL_PLAYER_RADIUS);
      const minZ = Math.floor(pz - DUEL_PLAYER_RADIUS);
      const maxZ = Math.floor(pz + DUEL_PLAYER_RADIUS);
      for (let cx = minX; cx <= maxX; cx++) {
        for (let cz = minZ; cz <= maxZ; cz++) {
          if (!isSolid(cx, cz)) continue;
          const clx = Math.max(cx, Math.min(px, cx + 1));
          const clz = Math.max(cz, Math.min(pz, cz + 1));
          const dx = px - clx;
          const dz = pz - clz;
          if (dx * dx + dz * dz < DUEL_PLAYER_RADIUS * DUEL_PLAYER_RADIUS) return true;
        }
      }
      return false;
    }

    /** Distance jusqu'au premier mur le long d'un rayon (echantillonnage fin). */
    function rayWallDistance(ox: number, oz: number, dx: number, dz: number, max: number): number {
      const step = 0.07;
      for (let d = step; d < max; d += step) {
        if (isSolid(Math.floor(ox + dx * d), Math.floor(oz + dz * d))) return d;
      }
      return max;
    }

    function hasLineOfSight(ax: number, az: number, bx: number, bz: number): boolean {
      const dist = Math.hypot(bx - ax, bz - az);
      const steps = Math.ceil(dist * 4);
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        if (isSolid(Math.floor(ax + (bx - ax) * t), Math.floor(az + (bz - az) * t))) return false;
      }
      return true;
    }

    function farthestSpawn(spawns: [number, number][], fromX: number, fromZ: number) {
      let best = spawns[0];
      let bestD = -1;
      for (const s of spawns) {
        const d = Math.hypot(s[0] + 0.5 - fromX, s[1] + 0.5 - fromZ);
        if (d > bestD) {
          bestD = d;
          best = s;
        }
      }
      return best;
    }

    function bfsPath(from: [number, number], to: [number, number]): [number, number][] | null {
      if (from[0] === to[0] && from[1] === to[1]) return [from];
      const key = (x: number, y: number) => `${x},${y}`;
      const visited = new Set([key(...from)]);
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
          if (isSolid(nx, ny)) continue;
          const nk = key(nx, ny);
          if (visited.has(nk)) continue;
          visited.add(nk);
          prev.set(nk, [x, y]);
          if (nx === to[0] && ny === to[1]) {
            const path: [number, number][] = [[nx, ny]];
            let k = nk;
            while (prev.has(k)) {
              const p = prev.get(k)!;
              path.unshift(p);
              k = key(...p);
            }
            return path;
          }
          queue.push([nx, ny]);
        }
      }
      return null;
    }

    function panFor(x: number, z: number) {
      const dx = x - me.x;
      const dz = z - me.z;
      const len = Math.hypot(dx, dz) || 1;
      const pan = (dx / len) * Math.cos(me.yaw) - (dz / len) * Math.sin(me.yaw);
      return {
        pan: Math.max(-1, Math.min(1, pan)),
        gain: Math.max(0.05, 1 - len / 22),
      };
    }

    function myRespawn() {
      const s = farthestSpawn(mySpawns, opp.x, opp.z);
      me.x = s[0] + 0.5;
      me.z = s[1] + 0.5;
      me.hp = DUEL_MAX_HP;
      me.dead = false;
      me.mag = DUEL_MAG_SIZE;
      me.reloadUntil = 0;
      playRespawn(audio.ctx, audio.master);
      setHp(DUEL_MAX_HP);
      setAmmo(DUEL_MAG_SIZE);
      setReloading(false);
    }

    function registerMyDeath() {
      me.dead = true;
      me.respawnAt = elapsed + DUEL_RESPAWN_SECONDS;
      me.hp = 0;
      setHp(0);
      playDeath(audio.ctx, audio.master);
      damageLevel = 1;
      opp.score += 1;
      setOppScore(opp.score);
      addFeed(`${opponentName} t'a éliminé`, false);
      if (!bot) link.current.send("died", {});
      if (opp.score >= DUEL_SCORE_TO_WIN && !ended) {
        ended = true;
        playMatchEnd(audio.ctx, audio.master, false);
        window.setTimeout(() => onMatchEndRef.current(false, me.score, opp.score), 1200);
      }
    }

    function registerOppDeath() {
      opp.dead = true;
      opp.respawnAt = elapsed + DUEL_RESPAWN_SECONDS;
      opp.hp = 0;
      me.score += 1;
      setMyScore(me.score);
      addFeed(`Tu as éliminé ${opponentName}`, true);
      if (me.score >= DUEL_SCORE_TO_WIN && !ended) {
        ended = true;
        playMatchEnd(audio.ctx, audio.master, true);
        window.setTimeout(() => onMatchEndRef.current(true, me.score, opp.score), 1200);
      }
    }

    function applyDamageToMe(amount: number) {
      if (me.dead || ended) return;
      me.hp = Math.max(0, me.hp - amount);
      setHp(me.hp);
      damageLevel = Math.min(1, damageLevel + 0.7);
      playHurt(audio.ctx, audio.master);
      if (me.hp <= 0) registerMyDeath();
    }

    /** Tir du joueur : hitscan, mur d'abord, puis buste et tete. */
    function fire() {
      if (me.dead || ended) return;
      if (elapsed < me.nextShotAt) return;
      if (me.reloadUntil > 0) return;
      if (me.mag <= 0) {
        playDryFire(audio.ctx, audio.master);
        me.nextShotAt = elapsed + 0.3;
        return;
      }
      me.mag -= 1;
      me.nextShotAt = elapsed + DUEL_FIRE_INTERVAL;
      setAmmo(me.mag);
      playShot(audio.ctx, audio.master);
      recoil = 1;
      muzzle.visible = true;
      muzzleUntil = elapsed + 0.05;

      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const eyeY = DUEL_EYE_HEIGHT;
      const maxRange = 34;
      const wallDist = rayWallDistance(me.x, me.z, dir.x, dir.z, maxRange);

      let hitDist = wallDist;
      let hitOpponent = false;
      let headshot = false;
      if (!opp.dead) {
        // intersection rayon / cylindre vertical du buste
        const fx = me.x - opp.x;
        const fz = me.z - opp.z;
        const a = dir.x * dir.x + dir.z * dir.z;
        const b = 2 * (fx * dir.x + fz * dir.z);
        const c = fx * fx + fz * fz - DUEL_BODY_RADIUS * DUEL_BODY_RADIUS;
        const disc = b * b - 4 * a * c;
        if (a > 1e-6 && disc >= 0) {
          const t = (-b - Math.sqrt(disc)) / (2 * a);
          if (t > 0 && t < wallDist) {
            const y = eyeY + dir.y * t;
            if (y > 0.05 && y < DUEL_HEAD_Y + DUEL_HEAD_RADIUS) {
              hitOpponent = true;
              hitDist = t;
              headshot = Math.abs(y - DUEL_HEAD_Y) < DUEL_HEAD_RADIUS;
            }
          }
        }
      }

      // traceur visuel
      const start = new THREE.Vector3(me.x * DUEL_CELL, eyeY, me.z * DUEL_CELL).add(
        dir.clone().multiplyScalar(0.5),
      );
      const end = new THREE.Vector3(me.x * DUEL_CELL, eyeY, me.z * DUEL_CELL).add(
        dir.clone().multiplyScalar(hitDist * (hitOpponent ? 1 : 1)),
      );
      tracer.position.copy(start).lerp(end, 0.5);
      tracer.scale.set(1, 1, Math.max(0.2, start.distanceTo(end)));
      tracer.lookAt(end);
      tracer.visible = true;
      tracerUntil = elapsed + 0.06;

      if (hitOpponent) {
        const dmg = headshot ? DUEL_HEADSHOT_DAMAGE : DUEL_DAMAGE;
        hitMarkerLevel = 1;
        if (headshot) playHeadshot(audio.ctx, audio.master);
        else playHitmarker(audio.ctx, audio.master);
        if (bot) {
          opp.hp = Math.max(0, opp.hp - dmg);
          if (opp.hp <= 0) registerOppDeath();
        } else {
          link.current.send("hit", { damage: dmg });
        }
      } else {
        playImpact(audio.ctx, audio.master, panFor(me.x + dir.x * hitDist, me.z + dir.z * hitDist));
      }

      if (!bot) {
        link.current.send("shot", {
          x: me.x,
          z: me.z,
          dx: dir.x,
          dy: dir.y,
          dz: dir.z,
          dist: hitDist,
        });
      }
    }

    function startReload() {
      if (me.dead || me.reloadUntil > 0 || me.mag >= DUEL_MAG_SIZE) return;
      me.reloadUntil = elapsed + DUEL_RELOAD_SECONDS;
      setReloading(true);
      playReload(audio.ctx, audio.master);
    }

    // --- Entrees ---
    function applyLook(dx: number, dy: number) {
      const s = LOOK_SENSITIVITY * sensitivity.current;
      me.yaw -= dx * s;
      me.pitch = THREE.MathUtils.clamp(me.pitch - dy * s, -1.2, 1.2);
    }
    function onMouseMove(e: MouseEvent) {
      if (document.pointerLockElement !== renderer.domElement) return;
      applyLook(e.movementX, e.movementY);
    }
    function onPointerLockChange() {
      setLocked(document.pointerLockElement === renderer.domElement);
    }
    function onMouseDown(e: MouseEvent) {
      if (e.button !== 0) return;
      if (document.pointerLockElement !== renderer.domElement) {
        try {
          renderer.domElement.requestPointerLock?.()?.catch(() => {});
        } catch {
          // ignore
        }
        return;
      }
      firing = true;
      fire();
    }
    function onMouseUp() {
      firing = false;
    }
    function onKeyDown(e: KeyboardEvent) {
      keys.add(e.key.toLowerCase());
      if (e.key.toLowerCase() === "r") startReload();
    }
    function onKeyUp(e: KeyboardEvent) {
      keys.delete(e.key.toLowerCase());
    }
    function onContextMenu(e: MouseEvent) {
      e.preventDefault();
    }
    // --- Visee tactile : glisser sur la moitie droite de l'ecran ---
    // (la moitie gauche est reservee au joystick de deplacement)
    let lookPointerId = -1;
    let lookLastX = 0;
    let lookLastY = 0;
    function onTouchPointerDown(e: PointerEvent) {
      if (e.pointerType !== "touch" || lookPointerId !== -1) return;
      const rect = renderer.domElement.getBoundingClientRect();
      if (e.clientX - rect.left < rect.width * 0.42) return;
      lookPointerId = e.pointerId;
      lookLastX = e.clientX;
      lookLastY = e.clientY;
      try {
        renderer.domElement.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    function onTouchPointerMove(e: PointerEvent) {
      if (e.pointerId !== lookPointerId) return;
      applyLook((e.clientX - lookLastX) * 1.5, (e.clientY - lookLastY) * 1.5);
      lookLastX = e.clientX;
      lookLastY = e.clientY;
    }
    function onTouchPointerUp(e: PointerEvent) {
      if (e.pointerId !== lookPointerId) return;
      lookPointerId = -1;
      try {
        renderer.domElement.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.addEventListener("pointerdown", onTouchPointerDown);
    renderer.domElement.addEventListener("pointermove", onTouchPointerMove);
    renderer.domElement.addEventListener("pointerup", onTouchPointerUp);
    renderer.domElement.addEventListener("pointercancel", onTouchPointerUp);

    sceneApiRef.current = { reload: () => startReload() };

    renderer.domElement.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    renderer.domElement.addEventListener("contextmenu", onContextMenu);

    // --- Reception reseau ---
    function drainInbox() {
      const box = link.current.inbox;
      while (box.length) {
        const msg = box.shift()!;
        if (msg.event === "hit") {
          applyDamageToMe(Number(msg.payload.damage) || DUEL_DAMAGE);
        } else if (msg.event === "died") {
          if (!opp.dead) registerOppDeath();
        } else if (msg.event === "shot") {
          const p = msg.payload as Record<string, number>;
          playShot(audio.ctx, audio.master, panFor(p.x, p.z));
          const s = new THREE.Vector3(p.x * DUEL_CELL, DUEL_EYE_HEIGHT, p.z * DUEL_CELL);
          const e = s
            .clone()
            .add(new THREE.Vector3(p.dx, p.dy, p.dz).multiplyScalar(p.dist ?? 10));
          oppTracer.position.copy(s).lerp(e, 0.5);
          oppTracer.scale.set(1, 1, Math.max(0.2, s.distanceTo(e)));
          oppTracer.lookAt(e);
          oppTracer.visible = true;
          oppTracerUntil = elapsed + 0.06;
        }
      }
      const r = link.current.remote;
      if (r) {
        opp.tx = r.x;
        opp.tz = r.z;
        opp.tyaw = r.yaw;
        opp.moving = r.moving;
        if (r.dead && !opp.dead) {
          opp.dead = true;
        } else if (!r.dead && opp.dead) {
          opp.dead = false;
        }
      }
    }

    /** IA d'entrainement : avance vers toi, tire quand elle te voit. */
    function updateBot(delta: number) {
      if (opp.dead) {
        if (elapsed >= opp.respawnAt) {
          const s = farthestSpawn(oppSpawns, me.x, me.z);
          opp.x = s[0] + 0.5;
          opp.z = s[1] + 0.5;
          opp.hp = DUEL_MAX_HP;
          opp.dead = false;
        }
        return;
      }
      opp.repathTimer -= delta;
      if (opp.repathTimer <= 0) {
        opp.repathTimer = 0.55;
        opp.path = bfsPath(
          [Math.floor(opp.x), Math.floor(opp.z)],
          [Math.floor(me.x), Math.floor(me.z)],
        );
        opp.pathIndex = 0;
      }
      const dist = Math.hypot(me.x - opp.x, me.z - opp.z);
      const sees = !me.dead && dist < 16 && hasLineOfSight(opp.x, opp.z, me.x, me.z);
      opp.seenFor = sees ? opp.seenFor + delta : 0;

      // il garde ses distances : il s'approche de loin, recule si colle
      const wantCloser = dist > 6;
      const speed = DUEL_MOVE_SPEED * 0.78;
      if (!sees || wantCloser) {
        if (opp.path && opp.pathIndex < opp.path.length) {
          const [tx, ty] = opp.path[opp.pathIndex];
          const dx = tx + 0.5 - opp.x;
          const dz = ty + 0.5 - opp.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.12) opp.pathIndex++;
          else {
            opp.x += (dx / d) * speed * delta;
            opp.z += (dz / d) * speed * delta;
          }
        }
      } else if (dist < 4) {
        const dx = opp.x - me.x;
        const dz = opp.z - me.z;
        const d = Math.hypot(dx, dz) || 1;
        const nx = opp.x + (dx / d) * speed * delta;
        const nz = opp.z + (dz / d) * speed * delta;
        if (!isSolid(Math.floor(nx), Math.floor(nz))) {
          opp.x = nx;
          opp.z = nz;
        }
      }
      opp.yaw = Math.atan2(me.x - opp.x, me.z - opp.z);

      if (sees && opp.seenFor > BOT_REACTION && elapsed >= opp.nextBotShotAt && !me.dead) {
        if (opp.mag <= 0) {
          // Il recharge : c'est le moment de sortir du couvert.
          opp.mag = BOT_MAG;
          opp.nextBotShotAt = elapsed + BOT_RELOAD;
          return;
        }
        opp.mag -= 1;
        opp.nextBotShotAt = elapsed + BOT_FIRE_MIN + Math.random() * BOT_FIRE_RANDOM;
        playShot(audio.ctx, audio.master, panFor(opp.x, opp.z));
        const s = new THREE.Vector3(opp.x * DUEL_CELL, DUEL_EYE_HEIGHT, opp.z * DUEL_CELL);
        const e = new THREE.Vector3(me.x * DUEL_CELL, DUEL_EYE_HEIGHT - 0.15, me.z * DUEL_CELL);
        oppTracer.position.copy(s).lerp(e, 0.5);
        oppTracer.scale.set(1, 1, Math.max(0.2, s.distanceTo(e)));
        oppTracer.lookAt(e);
        oppTracer.visible = true;
        oppTracerUntil = elapsed + 0.06;
        // Sa precision chute avec la distance : rester loin et bouger paie.
        const accuracy = Math.max(0.15, Math.min(0.8, 0.8 - dist * 0.06));
        if (Math.random() < accuracy) applyDamageToMe(DUEL_DAMAGE);
      }
    }

    function tick() {
      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      elapsed += delta;

      if (!bot) drainInbox();

      // Rechargement / reapparition
      if (me.reloadUntil > 0 && elapsed >= me.reloadUntil) {
        me.reloadUntil = 0;
        me.mag = DUEL_MAG_SIZE;
        setAmmo(DUEL_MAG_SIZE);
        setReloading(false);
      }
      if (me.dead && elapsed >= me.respawnAt) myRespawn();

      // Deplacement
      const forwardKey = layout.current === "azerty" ? "z" : "w";
      const leftKey = layout.current === "azerty" ? "q" : "a";
      let fwd = 0;
      let strafe = 0;
      if (!me.dead && !ended) {
        if (keys.has(forwardKey) || keys.has("arrowup")) fwd += 1;
        if (keys.has("s") || keys.has("arrowdown")) fwd -= 1;
        if (keys.has(leftKey) || keys.has("arrowleft")) strafe -= 1;
        if (keys.has("d") || keys.has("arrowright")) strafe += 1;
      }
      // Joystick tactile : s'ajoute au clavier, avec une amplitude analogique.
      if (!me.dead && !ended) {
        fwd += touchRef.current.moveZ;
        strafe += touchRef.current.moveX;
      }

      const moving = Math.abs(fwd) > 0.03 || Math.abs(strafe) > 0.03;
      // Sprint : seulement vers l'avant, et tirer l'interrompt. C'est ce qui
      // donne du rythme aux deplacements entre deux couverts.
      const sprinting = moving && fwd > 0 && keys.has("shift") && elapsed > me.nextShotAt - 0.05;
      if (moving) {
        const f = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), me.yaw);
        const r = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), me.yaw);
        const mv = new THREE.Vector3().addScaledVector(f, fwd).addScaledVector(r, strafe);
        // On borne a 1 au lieu de normaliser : le joystick garde son dosage,
        // le clavier reste a pleine vitesse.
        if (mv.length() > 1) mv.normalize();
        mv.multiplyScalar(DUEL_MOVE_SPEED * (sprinting ? 1.5 : 1) * delta);
        if (!circleHitsWall(me.x + mv.x, me.z)) me.x += mv.x;
        if (!circleHitsWall(me.x, me.z + mv.z)) me.z += mv.z;
        if (elapsed >= nextStepAt) {
          nextStepAt = elapsed + (sprinting ? 0.26 : 0.34);
          playDuelStep(audio.ctx, audio.master, { gain: sprinting ? 0.7 : 0.5 });
        }
      }

      // Tir automatique tant que le bouton (souris ou tactile) est maintenu
      if (firing || touchRef.current.firing) fire();

      // Camera : recul + balancement
      walkPhase += moving ? delta * 9 : 0;
      recoil = Math.max(0, recoil - delta * 7);
      camera.position.set(
        me.x * DUEL_CELL,
        DUEL_EYE_HEIGHT + (moving ? Math.sin(walkPhase * 2) * 0.022 : 0),
        me.z * DUEL_CELL,
      );
      camera.rotation.y = me.yaw;
      camera.rotation.x = me.pitch + recoil * 0.045;
      camera.rotation.z = moving ? Math.sin(walkPhase) * 0.008 : 0;
      // En sprint, l'arme s'abaisse et s'incline : lecture immediate de l'etat.
      gun.position.set(
        GUN_BASE.x + (moving ? Math.sin(walkPhase) * 0.012 : 0),
        GUN_BASE.y + (moving ? Math.abs(Math.cos(walkPhase)) * 0.012 : 0) - recoil * 0.02 -
          (sprinting ? 0.09 : 0),
        GUN_BASE.z + recoil * 0.07,
      );
      gun.rotation.x = recoil * 0.28 + (sprinting ? 0.38 : 0);
      gun.rotation.z = sprinting ? 0.3 : 0;
      gun.visible = !me.dead;

      if (elapsed > muzzleUntil) muzzle.visible = false;
      if (elapsed > tracerUntil) tracer.visible = false;
      if (elapsed > oppTracerUntil) oppTracer.visible = false;

      // Adversaire : IA locale ou interpolation reseau
      if (bot) {
        updateBot(delta);
      } else {
        const k = Math.min(1, delta * 12);
        opp.x += (opp.tx - opp.x) * k;
        opp.z += (opp.tz - opp.z) * k;
        let dy = opp.tyaw - opp.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        opp.yaw += dy * k;
        if (opp.moving && elapsed >= nextOppStepAt && !opp.dead) {
          nextOppStepAt = elapsed + 0.34;
          playDuelStep(audio.ctx, audio.master, panFor(opp.x, opp.z));
        }
      }
      oppGroup.position.set(opp.x * DUEL_CELL, 0, opp.z * DUEL_CELL);
      oppGroup.rotation.y = opp.yaw;
      oppGroup.visible = !opp.dead;

      // Envoi reseau a cadence fixe
      if (!bot && elapsed >= nextNetAt) {
        nextNetAt = elapsed + 1 / DUEL_NET_HZ;
        link.current.send("state", {
          x: me.x,
          z: me.z,
          yaw: me.yaw,
          hp: me.hp,
          dead: me.dead,
          moving,
        });
      }

      // Retours visuels (synchronises avec React a 20 Hz)
      hitMarkerLevel = Math.max(0, hitMarkerLevel - delta * 3.4);
      damageLevel = Math.max(0, damageLevel - delta * 1.5);
      uiTimer += delta;
      if (uiTimer > 0.05) {
        uiTimer = 0;
        setHitMarker(hitMarkerLevel);
        setDamageFlash(damageLevel);
        setRespawnIn(me.dead ? Math.max(0, me.respawnAt - elapsed) : 0);
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
      window.removeEventListener("mouseup", onMouseUp);
      renderer.domElement.removeEventListener("pointerdown", onTouchPointerDown);
      renderer.domElement.removeEventListener("pointermove", onTouchPointerMove);
      renderer.domElement.removeEventListener("pointerup", onTouchPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onTouchPointerUp);
      sceneApiRef.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      renderer.domElement.removeEventListener("contextmenu", onContextMenu);
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock?.();
      audio.stop();
      audio.ctx.close().catch(() => {});
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [side, bot, opponentName, link]);

  const hpPct = Math.max(0, Math.min(100, hp));

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-black select-none">
      {/* Dégâts reçus */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 50%, transparent 42%, rgba(190,20,20,${(
            damageFlash * 0.55
          ).toFixed(2)}) 100%)`,
        }}
      />

      <Game3DSettings
        onLayout={(l) => {
          if (layoutRef.current) layoutRef.current.current = l;
        }}
        onSensitivity={(s) => {
          sensitivityRef.current = s;
        }}
        className="top-14"
      />

      {/* Score */}
      <div className="pointer-events-none absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/70 px-4 py-1.5 backdrop-blur">
        <span className="text-lg font-black text-cyan-300">{myScore}</span>
        <span className="text-xs text-zinc-500">— {DUEL_SCORE_TO_WIN} —</span>
        <span className="text-lg font-black text-red-400">{oppScore}</span>
      </div>

      {/* Vie + munitions */}
      <div className="pointer-events-none absolute bottom-4 left-4 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-400">♥</span>
          <div className="h-2.5 w-44 overflow-hidden rounded-full bg-black/70">
            <div
              className={`h-full rounded-full transition-all ${
                hpPct < 30 ? "bg-red-500" : hpPct < 60 ? "bg-amber-400" : "bg-emerald-400"
              }`}
              style={{ width: `${hpPct}%` }}
            />
          </div>
          <span className="font-mono text-sm font-bold text-white">{hpPct}</span>
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-16 right-4 text-right sm:bottom-4">
        <p className="font-mono text-3xl font-black text-white">
          {reloading ? "—" : ammo}
          <span className="ml-1 text-base text-zinc-500">/ {DUEL_MAG_SIZE}</span>
        </p>
        <p className="text-xs font-semibold text-zinc-400">
          {reloading ? "Rechargement..." : ammo === 0 ? "R pour recharger" : "R : recharger"}
        </p>
      </div>

      {/* Réticule + marqueur de touche */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative">
          <div className="absolute left-1/2 top-1/2 h-0.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90" />
          {[0, 90, 180, 270].map((deg) => (
            <div
              key={deg}
              className="absolute left-1/2 top-1/2 h-2 w-0.5 bg-white/60"
              style={{ transform: `translate(-50%,-50%) rotate(${deg}deg) translateY(-7px)` }}
            />
          ))}
          {hitMarker > 0.02 && (
            <div style={{ opacity: hitMarker }}>
              {[45, 135, 225, 315].map((deg) => (
                <div
                  key={deg}
                  className="absolute left-1/2 top-1/2 h-2.5 w-0.5 bg-red-400"
                  style={{ transform: `translate(-50%,-50%) rotate(${deg}deg) translateY(-9px)` }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Journal des éliminations */}
      <div className="pointer-events-none absolute right-4 top-14 flex flex-col items-end gap-1">
        {feed.map((f) => (
          <span
            key={f.id}
            className={`rounded px-2.5 py-1 text-xs font-semibold backdrop-blur ${
              f.mine ? "bg-cyan-900/70 text-cyan-200" : "bg-red-950/70 text-red-200"
            }`}
          >
            {f.text}
          </span>
        ))}
      </div>

      {/* Écran de mort */}
      {respawnIn > 0 && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55">
          <p className="text-2xl font-black text-red-400">Éliminé</p>
          <p className="text-sm text-zinc-300">
            Réapparition dans {respawnIn.toFixed(1)}s
          </p>
        </div>
      )}

      {/* Commandes tactiles : joystick a gauche, tir a droite. */}
      {touchDevice && (
        <>
          <div
            // Remonte pour ne pas passer sous le bouton Radio du site.
            className="absolute bottom-32 left-4 size-32 touch-none rounded-full border border-white/20 bg-black/40 sm:bottom-16 sm:left-5"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              stickOrigin.current = { x: e.clientX, y: e.clientY };
              setStickOffset({ x: 0, y: 0 });
            }}
            onPointerMove={(e) => {
              const o = stickOrigin.current;
              if (!o) return;
              const dx = e.clientX - o.x;
              const dy = e.clientY - o.y;
              const max = 52;
              const len = Math.hypot(dx, dy);
              const k = len > max ? max / len : 1;
              const ox = dx * k;
              const oy = dy * k;
              setStickOffset({ x: ox, y: oy });
              touchRef.current.moveX = ox / max;
              touchRef.current.moveZ = -oy / max;
            }}
            onPointerUp={(e) => {
              try {
                e.currentTarget.releasePointerCapture(e.pointerId);
              } catch {
                // ignore
              }
              stickOrigin.current = null;
              setStickOffset({ x: 0, y: 0 });
              touchRef.current.moveX = 0;
              touchRef.current.moveZ = 0;
            }}
            onPointerCancel={() => {
              stickOrigin.current = null;
              setStickOffset({ x: 0, y: 0 });
              touchRef.current.moveX = 0;
              touchRef.current.moveZ = 0;
            }}
          >
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 size-14 rounded-full bg-white/25"
              style={{
                transform: `translate(calc(-50% + ${stickOffset.x}px), calc(-50% + ${stickOffset.y}px))`,
              }}
            />
          </div>

          <button
            type="button"
            aria-label="Tirer"
            className="absolute bottom-32 right-5 size-20 touch-none rounded-full border border-red-400/40 bg-red-600/70 text-2xl text-white active:scale-95 sm:bottom-24 sm:right-6"
            onPointerDown={() => (touchRef.current.firing = true)}
            onPointerUp={() => (touchRef.current.firing = false)}
            onPointerLeave={() => (touchRef.current.firing = false)}
            onPointerCancel={() => (touchRef.current.firing = false)}
          >
            🔥
          </button>
          <button
            type="button"
            aria-label="Recharger"
            onClick={() => sceneApiRef.current?.reload()}
            className="absolute bottom-56 right-8 size-14 touch-none rounded-full border border-white/20 bg-black/60 text-lg font-bold text-white active:scale-95 sm:bottom-24 sm:right-28"
          >
            ⟳
          </button>
        </>
      )}

      {/* Invite de verrouillage souris (inutile au doigt) */}
      {!locked && respawnIn === 0 && !touchDevice && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-lg bg-black/80 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/20">
            Clique pour jouer · ZQSD/WASD · clic gauche : tirer · Maj : sprint · R : recharger ·
            Échap : libérer la souris
          </span>
        </div>
      )}
    </div>
  );
}
