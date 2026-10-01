import * as THREE from "three";
import { AMMO_ORDER, MODES, type AmmoId, type BattleMode, type TankDef } from "./tankDefs";
import type { TankModel } from "./tankModel";
import { groundHeight, type TankMap } from "./tankTerrain";
import { KINDS, NET_HZ, SHELL_FIELDS, TANK_FIELDS, endFor, outcomeAt, zoneAt, type NetEvent, type NetSnapshot } from "./tankNet";
import { gunMarkerFor, placeTank, type Battle, type BattleEnd, type BattleEvents, type CaptureState, type LineupSlot, type PlayerInput, type Shell, type SimTank } from "./tankSim";

// Chez un invite d'une partie en ligne : la bataille ne se simule pas ici, elle
// rejoue l'etat recu de l'hote. Les chars glissent d'un etat au suivant (avec un
// leger retard pour en avoir toujours deux), chaque obus suit sa trajectoire
// jusqu'a son impact, et les evenements (tirs, impacts, destructions) tombent a
// leur heure : la scene ne voit pas la difference avec une bataille locale.

/** Retard de lecture : un peu plus d'un intervalle entre deux etats. */
const DELAY = 1.6 / NET_HZ;

export interface PuppetBattle extends Battle {
  /** Un etat recu de l'hote. */
  applySnapshot: (snap: NetSnapshot) => void;
  /** Secondes depuis le dernier message de l'hote. */
  silence: () => number;
  /** L'hote attend encore des joueurs avant de lancer la bataille. */
  waiting: () => boolean;
}

/**
 * Chez le joueur, son equipe est toujours l'equipe 0 (l'interface en depend) :
 * pour un joueur de l'equipe 1, on echange les bases et les departs de la carte
 * avant de construire le decor.
 */
export function orientMapFor(map: TankMap, team: 0 | 1) {
  if (team !== 1) return;
  map.bases.reverse();
  map.spawns.reverse();
}

/** Ce qu'on sait d'un projectile : son dernier etat connu chez l'hote. */
interface KnownShell {
  shell: Shell;
  /** Temps de l'hote de cet etat. */
  at: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  g: number;
  /** Instant du tir (on ne le montre pas avant). */
  born: number;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const lerpAngle = (a: number, b: number, f: number) => a + wrap(b - a) * f;

export function createPuppetBattle(
  map: TankMap,
  lineup: LineupSlot[],
  me: string,
  makeModel: (def: TankDef, isPlayer: boolean, camo?: string | null) => TankModel,
  events: BattleEvents,
  mode: BattleMode,
): PuppetBattle {
  const mine = lineup.find((s) => s.human === me);
  // Les equipes sont renumerotees : celle du joueur devient l'equipe 0.
  const swap = mine?.team === 1;
  const local = (team: 0 | 1): 0 | 1 => (swap ? ((1 - team) as 0 | 1) : team);

  // Les chars, dans le meme ordre que chez l'hote (equipe 0 puis equipe 1).
  const tanks: SimTank[] = [];
  for (const team of [0, 1] as const) {
    const slots = lineup.filter((s) => s.team === team);
    slots.forEach((slot, k) => {
      const lt = local(team);
      const spawns = map.spawns[lt];
      const s = spawns[k % spawns.length];
      const def = slot.def;
      const isPlayer = slot.human === me;
      const model = makeModel(def, isPlayer, slot.camo ?? null);
      tanks.push({
        id: tanks.length,
        team: lt,
        def,
        name: slot.name,
        isPlayer,
        human: slot.human,
        remote: null,
        model,
        x: s.x,
        y: groundHeight(map, s.x, s.z),
        z: s.z,
        yaw: s.yaw,
        speed: 0,
        turnRate: 0,
        turretYaw: 0,
        turretRate: 0,
        gunPitch: 0,
        pitchError: 0,
        pitchBlocked: false,
        aimPoint: new THREE.Vector3(s.x + Math.sin(s.yaw) * 100, groundHeight(map, s.x, s.z), s.z + Math.cos(s.yaw) * 100),
        pitch: 0,
        roll: 0,
        hp: def.hp,
        alive: true,
        reloadLeft: 2,
        fullReload: true,
        clipLeft: def.clip?.size ?? 1,
        ammo: "perforant",
        ammoLeft: { perforant: def.ammo.perforant.count, sousCalibre: def.ammo.sousCalibre.count, explosif: def.ammo.explosif.count },
        bloom: 3,
        spottedUntil: 0,
        lastHitAt: -100,
        damageDealt: 0,
        damageTaken: 0,
        damageBlocked: 0,
        detections: 0,
        assist: 0,
        spottedBy: null,
        kills: 0,
        shots: 0,
        hits: 0,
        pens: 0,
        recoil: 0,
        lastShotAt: -100,
        gunBaseZ: model.gun.position.z,
        radius: Math.hypot(def.look.length, def.look.width) * 0.31,
        brain: null,
        hullMatrix: new THREE.Matrix4(),
        hullInverse: new THREE.Matrix4(),
        turretMatrix: new THREE.Matrix4(),
        turretInverse: new THREE.Matrix4(),
        trackL: 0,
        trackR: 0,
        destroyedAt: -1,
      });
    });
  }
  const player = tanks.find((t) => t.isPlayer) ?? tanks[0];
  const shells: Shell[] = [];
  const known = new Map<number, KnownShell>();
  const capture: CaptureState = { points: [0, 0], cappers: [0, 0] };
  let time = 0;
  let timeLeft = MODES[mode].seconds;
  let ended: BattleEnd | null = null;
  let pendingEnd: { at: number; f: [number, string] } | null = null;
  /** Derniers etats recus, du plus ancien au plus recent. */
  const buffer: NetSnapshot[] = [];
  /** Evenements recus, joues quand le temps de lecture les atteint. */
  const queue: NetEvent[] = [];
  let sinceSnap = 0;
  let heard = 0;
  let waiting = true;
  let started = false;

  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();

  function kill(t: SimTank) {
    t.alive = false;
    t.hp = 0;
    t.speed = 0;
    t.destroyedAt = time;
    t.model.setWrecked();
  }

  /** Son rechargement, ses munitions et ses chiffres : ceux du dernier etat, tels quels. */
  function applyMine(snap: NetSnapshot) {
    for (const h of snap.h) {
      const t = tanks[h[0]];
      if (!t || !t.isPlayer) continue;
      t.reloadLeft = h[1];
      t.fullReload = h[2] === 1;
      t.clipLeft = h[3];
      t.ammo = (AMMO_ORDER[h[4]] ?? "perforant") as AmmoId;
      t.ammoLeft = { perforant: h[5], sousCalibre: h[6], explosif: h[7] };
      t.bloom = h[8];
      t.shots = h[9];
      t.hits = h[10];
      t.pens = h[11];
      t.damageTaken = h[12];
      t.damageBlocked = h[13];
      t.assist = h[14];
      t.detections = h[15];
      t.turretRate = h[16];
    }
  }

  /** Les projectiles de l'etat : on retient le plus recent de chacun. */
  function learnShells(snap: NetSnapshot) {
    const s = snap.s;
    for (let i = 0; i + SHELL_FIELDS <= s.length; i += SHELL_FIELDS) {
      const id = s[i];
      let k = known.get(id);
      if (!k) {
        const owner = tanks[s[i + 8]] ?? tanks[0];
        k = {
          shell: {
            id,
            owner,
            ammo: "perforant",
            pos: new THREE.Vector3(),
            vel: new THREE.Vector3(),
            penetration: 0,
            damage: 0,
            caliber: owner.def.caliber,
            age: 0,
            traveled: 0,
            gravity: 0,
            splash: 0,
            kind: KINDS[s[i + 7]] ?? "obus",
          },
          at: 0,
          x: 0,
          y: 0,
          z: 0,
          vx: 0,
          vy: 0,
          vz: 0,
          g: 0,
          born: snap.t - s[i + 10],
        };
        known.set(id, k);
      }
      k.at = snap.t;
      k.x = s[i + 1];
      k.y = s[i + 2];
      k.z = s[i + 3];
      k.vx = s[i + 4];
      k.vy = s[i + 5];
      k.vz = s[i + 6];
      k.g = s[i + 9];
      k.shell.gravity = k.g;
    }
  }

  function applySnapshot(snap: NetSnapshot) {
    heard = 0;
    waiting = snap.w === 1;
    for (const e of snap.e) queue.push(e);
    if (snap.f && !pendingEnd) pendingEnd = { at: snap.t, f: snap.f };
    const last = buffer[buffer.length - 1];
    if (last && snap.t <= last.t) return;
    buffer.push(snap);
    if (buffer.length > 6) buffer.shift();
    sinceSnap = 0;
    applyMine(snap);
    learnShells(snap);
  }

  /** Les evenements dont l'heure est venue, rejoues pour la scene. */
  function playEvents() {
    queue.sort((a, b) => (a[1] as number) - (b[1] as number));
    while (queue.length && (queue[0][1] as number) <= time) {
      const e = queue.shift()!;
      const n = e as number[];
      switch (e[0]) {
        case "s": {
          const t = tanks[n[2]];
          if (!t) break;
          t.lastShotAt = time;
          t.recoil = 1;
          events.shot(t, tmpA.set(n[3], n[4], n[5]), tmpB.set(n[6], n[7], n[8]));
          break;
        }
        case "h": {
          const shooter = tanks[n[2]];
          const target = tanks[n[3]];
          if (!shooter || !target) break;
          known.delete(n[12]);
          events.hit(shooter, target, { outcome: outcomeAt(n[4]), damage: n[5], effective: n[6], angle: n[7] }, tmpA.set(n[8], n[9], n[10]), zoneAt(n[11]));
          break;
        }
        case "m": {
          const shooter = tanks[n[2]];
          known.delete(n[7]);
          if (shooter) events.missed(shooter, tmpA.set(n[3], n[4], n[5]), n[6] === 1 ? "mur" : "sol");
          break;
        }
        case "d": {
          const target = tanks[n[2]];
          if (!target) break;
          if (target.alive) kill(target);
          events.destroyed(target, n[3] >= 0 ? (tanks[n[3]] ?? null) : null);
          break;
        }
        case "a":
          events.treeFell(n[2], n[3], n[4]);
          break;
        case "b":
          known.delete(n[6]);
          events.blast?.(tmpA.set(n[2], n[3], n[4]), n[5]);
          break;
        case "r": {
          const t = tanks[n[2]];
          if (t?.isPlayer) events.reloaded(t);
          break;
        }
      }
    }
  }

  function update(dt: number, input: PlayerInput) {
    heard += dt;
    sinceSnap += dt;
    const latest = buffer[buffer.length - 1];
    if (input.aim) player.aimPoint.copy(input.aim);
    if (!latest) {
      for (const t of tanks) placeTank(map, t, dt);
      return;
    }
    // Temps de lecture : un peu derriere le dernier etat, qui avance avec l'image.
    const target = latest.t + sinceSnap - DELAY;
    if (!started || Math.abs(target - time) > 1) {
      time = target;
      started = true;
    } else {
      time += dt;
      time += (target - time) * Math.min(1, dt * 3);
    }
    time = Math.min(time, latest.t + 0.3);

    // Les deux etats qui encadrent l'instant de lecture.
    let a = buffer[0];
    let b: NetSnapshot | null = null;
    for (let i = buffer.length - 1; i >= 0; i--) {
      if (buffer[i].t <= time) {
        a = buffer[i];
        b = buffer[i + 1] ?? null;
        break;
      }
    }
    const f = b ? THREE.MathUtils.clamp((time - a.t) / Math.max(1e-3, b.t - a.t), 0, 1) : 0;
    const ahead = b ? 0 : THREE.MathUtils.clamp(time - a.t, 0, 0.3);

    for (const t of tanks) {
      const o = t.id * TANK_FIELDS;
      if (o + TANK_FIELDS > a.k.length) continue;
      const prevX = t.x;
      const prevZ = t.z;
      const prevYaw = t.yaw;
      let x: number;
      let z: number;
      let yaw: number;
      let src = a;
      if (t.isPlayer) {
        // Son propre char : le dernier etat, prolonge (moins de retard), et lisse.
        src = latest;
        const ext = Math.min(0.3, sinceSnap);
        const sp = latest.k[o + 8];
        const ly = latest.k[o + 2];
        const tx = latest.k[o] + Math.sin(ly) * sp * ext;
        const tz = latest.k[o + 1] + Math.cos(ly) * sp * ext;
        const far = Math.hypot(tx - t.x, tz - t.z) > 6;
        const k = far ? 1 : Math.min(1, dt * 10);
        x = t.x + (tx - t.x) * k;
        z = t.z + (tz - t.z) * k;
        yaw = lerpAngle(t.yaw, ly, far ? 1 : Math.min(1, dt * 12));
        t.turretYaw = lerpAngle(t.turretYaw, latest.k[o + 3], Math.min(1, dt * 14));
        t.gunPitch += (latest.k[o + 4] - t.gunPitch) * Math.min(1, dt * 14);
      } else if (b) {
        x = THREE.MathUtils.lerp(a.k[o], b.k[o], f);
        z = THREE.MathUtils.lerp(a.k[o + 1], b.k[o + 1], f);
        yaw = lerpAngle(a.k[o + 2], b.k[o + 2], f);
        t.turretYaw = lerpAngle(a.k[o + 3], b.k[o + 3], f);
        t.gunPitch = THREE.MathUtils.lerp(a.k[o + 4], b.k[o + 4], f);
      } else {
        // Plus d'etat en avance : on prolonge un peu la course.
        yaw = a.k[o + 2];
        x = a.k[o] + Math.sin(yaw) * a.k[o + 8] * ahead;
        z = a.k[o + 1] + Math.cos(yaw) * a.k[o + 8] * ahead;
        t.turretYaw = a.k[o + 3];
        t.gunPitch = a.k[o + 4];
      }
      t.x = x;
      t.z = z;
      t.yaw = yaw;
      t.hp = src.k[o + 5];
      if (src.k[o + 6] === 0 && t.alive) kill(t);
      t.spottedUntil = src.t + src.k[o + 7];
      t.speed = src.k[o + 8];
      t.kills = src.k[o + 9];
      t.damageDealt = src.k[o + 10];
      if (!t.isPlayer) t.ammo = (AMMO_ORDER[src.k[o + 11]] ?? "perforant") as AmmoId;
      // Les chenilles tournent avec la distance parcourue.
      let fwd = (t.x - prevX) * Math.sin(t.yaw) + (t.z - prevZ) * Math.cos(t.yaw);
      const turn = wrap(t.yaw - prevYaw);
      if (Math.abs(fwd) > 5) fwd = 0;
      const half = t.def.look.width / 2;
      t.turnRate += ((dt > 0 ? turn / dt : 0) - t.turnRate) * Math.min(1, dt * 6);
      if (t.alive) {
        t.trackL += fwd - turn * half;
        t.trackR += fwd + turn * half;
        t.model.roll(fwd - turn * half, fwd + turn * half);
      }
      t.recoil = Math.max(0, t.recoil - dt * 3);
      placeTank(map, t, dt);
    }

    // Le rechargement du joueur file entre deux etats.
    player.reloadLeft = Math.max(0, player.reloadLeft - dt);

    // Capture, temps restant (equipes renumerotees).
    const cp = a.cp;
    capture.points[0] = swap ? cp[1] : cp[0];
    capture.points[1] = swap ? cp[0] : cp[1];
    capture.cappers[0] = swap ? cp[3] : cp[2];
    capture.cappers[1] = swap ? cp[2] : cp[3];
    timeLeft = Math.max(0, a.tl - (time - a.t));

    playEvents();

    // Projectiles : chacun sur sa trajectoire, depuis son dernier etat connu.
    shells.length = 0;
    for (const [id, k] of known) {
      const d = time - k.at;
      if (d > 2.5) {
        known.delete(id);
        continue;
      }
      if (time < k.born) continue;
      const s = k.shell;
      s.pos.set(k.x + k.vx * d, k.y + k.vy * d - 0.5 * k.g * d * d, k.z + k.vz * d);
      s.vel.set(k.vx, k.vy - k.g * d, k.vz);
      s.age = time - k.born;
      shells.push(s);
    }

    // La fin tombe a son heure, apres les derniers evenements (le dernier char detruit).
    if (pendingEnd && time >= pendingEnd.at && !ended) ended = endFor(pendingEnd.f, swap);
  }

  /** L'hote a disparu : la bataille s'arrete la. */
  function abandon() {
    if (!ended) ended = { winner: -1, reason: "hote" };
  }

  for (const t of tanks) placeTank(map, t, 1);

  return {
    tanks,
    player,
    shells,
    capture,
    get timeLeft() {
      return timeLeft;
    },
    get ended() {
      if (!ended && heard > 8 && started) abandon();
      return ended;
    },
    update,
    gunMarker: (out: THREE.Vector3) => gunMarkerFor(map, tanks, player, out),
    visibleTo: (t: SimTank, team: 0 | 1) => t.team === team || !t.alive || t.spottedUntil > time,
    time: () => time,
    applySnapshot,
    silence: () => heard,
    waiting: () => waiting,
  };
}
