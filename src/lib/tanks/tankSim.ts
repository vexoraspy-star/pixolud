import * as THREE from "three";
import {
  AMMO,
  AMMO_ORDER,
  DIFFICULTIES,
  TANKS,
  type AmmoId,
  type Difficulty,
  type TankDef,
} from "./tankDefs";
import {
  SHELL_GRAVITY,
  dispersionOffset,
  launchAngle,
  resolveHit,
  segmentObb,
  zoneThickness,
  type ObbHit,
  type ShotResult,
  type Zone,
} from "./tankBallistics";
import {
  BASE_RADIUS,
  MAP_HALF,
  WATER_LEVEL,
  distToSegment,
  findPath,
  groundHeight,
  lineOfSight,
  segmentGround,
  segmentHouse,
  segmentRock,
  type TankMap,
} from "./tankTerrain";
import type { TankModel } from "./tankModel";

// La bataille de « Tonnerre d'Acier » : deux equipes de sept chars, le joueur
// et treize bots. Ce module fait avancer le monde (conduite, tourelles, obus,
// reperage, capture, intelligence des bots) et deplace les modeles ; la scene
// s'occupe de l'image, du son et de l'interface via les evenements.

export const TEAM_SIZE = 7;
/** Duree d'une bataille, en secondes. */
export const BATTLE_SECONDS = 420;
/** Points de capture gagnes par seconde et par char dans le cercle (trois au plus comptent). */
const CAP_RATE = 1.35;
/** Un char repere le reste encore deux secondes apres avoir disparu. */
const SPOT_MEMORY = 2;

const BOT_NAMES = [
  "Rex",
  "Brutus",
  "Hercule",
  "Bolide",
  "Grizzly",
  "Ouragan",
  "Pégase",
  "Sirocco",
  "Mistral",
  "Cobra",
  "Condor",
  "Taureau",
  "Loup",
  "Orage",
  "Tornade",
  "Castor",
  "Ferraille",
  "Bélier",
  "Tempête",
  "Vulcain",
];

export type Role = "eclaireur" | "assaut" | "soutien" | "embuscade";

export interface Brain {
  role: Role;
  lane: number;
  /** Prochain point du couloir vise (indice dans map.lanes[lane]). */
  laneIndex: number;
  path: [number, number][] | null;
  pathIndex: number;
  goalX: number;
  goalZ: number;
  repathAt: number;
  nextThink: number;
  target: SimTank | null;
  /** On ne tire pas avant cet instant (temps de reaction). */
  readyAt: number;
  /** Point vise sur la cible, dans le repere de sa caisse. */
  aimLocal: THREE.Vector3;
  holdUntil: number;
  stuckCheckAt: number;
  stuckX: number;
  stuckZ: number;
  reverseUntil: number;
  reverseSteer: number;
  lastTargetAt: number;
}

export interface SimTank {
  id: number;
  team: 0 | 1;
  def: TankDef;
  name: string;
  isPlayer: boolean;
  model: TankModel;
  x: number;
  y: number;
  z: number;
  /** Cap de la caisse : l'avant regarde (sin yaw, 0, cos yaw). */
  yaw: number;
  /** Vitesse en m/s (positive en marche avant). */
  speed: number;
  /** Vitesse de rotation de la caisse, en rad/s. */
  turnRate: number;
  turretYaw: number;
  turretRate: number;
  gunPitch: number;
  /** Ecart entre la hausse voulue et celle du canon (radians) : un bot attend qu'il soit petit. */
  pitchError: number;
  /** Le canon ne peut pas s'abaisser (ou se lever) assez pour viser la cible. */
  pitchBlocked: boolean;
  pitch: number;
  roll: number;
  hp: number;
  alive: boolean;
  reloadLeft: number;
  /** Le rechargement en cours est celui du chargeur entier (pas l'intervalle d'une rafale). */
  fullReload: boolean;
  /** Obus restant dans le chargeur (canon automatique ; 1 sinon). */
  clipLeft: number;
  ammo: AmmoId;
  ammoLeft: Record<AmmoId, number>;
  /** Dispersion courante / dispersion minimale (1 = visee complete). */
  bloom: number;
  /** Instant jusqu'auquel il est vu par l'autre equipe. */
  spottedUntil: number;
  lastHitAt: number;
  damageDealt: number;
  damageTaken: number;
  kills: number;
  shots: number;
  hits: number;
  pens: number;
  /** Recul du canon apres un tir (0 a 1). */
  recoil: number;
  /** Position de repos du canon (le recul la deplace). */
  gunBaseZ: number;
  radius: number;
  brain: Brain | null;
  // Boites de collision des obus, mises a jour a chaque image.
  hullMatrix: THREE.Matrix4;
  hullInverse: THREE.Matrix4;
  turretMatrix: THREE.Matrix4;
  turretInverse: THREE.Matrix4;
  /** Metres parcourus par chaque chenille (pour le son et la poussiere). */
  trackL: number;
  trackR: number;
  destroyedAt: number;
}

export interface Shell {
  owner: SimTank;
  ammo: AmmoId;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  penetration: number;
  damage: number;
  caliber: number;
  age: number;
  traveled: number;
}

export interface PlayerInput {
  throttle: number;
  steer: number;
  /** Point vise dans le monde (la tourelle s'y tourne), ou null (visee libre). */
  aim: THREE.Vector3 | null;
  fire: boolean;
  ammo: AmmoId;
}

export interface BattleEvents {
  shot: (t: SimTank, muzzle: THREE.Vector3, dir: THREE.Vector3) => void;
  hit: (shooter: SimTank, target: SimTank, res: ShotResult, point: THREE.Vector3, zone: Zone) => void;
  missed: (shooter: SimTank, point: THREE.Vector3, kind: "sol" | "mur") => void;
  destroyed: (target: SimTank, by: SimTank | null) => void;
  treeFell: (index: number, dx: number, dz: number) => void;
  reloaded: (t: SimTank) => void;
}

export interface CaptureState {
  /** Points de capture de la base de chaque equipe (prise par l'adversaire). */
  points: [number, number];
  /** Nombre de chars adverses dans chaque cercle. */
  cappers: [number, number];
}

export type BattleEnd = { winner: 0 | 1 | -1; reason: "destruction" | "capture" | "temps" };

export interface Battle {
  tanks: SimTank[];
  player: SimTank;
  shells: Shell[];
  capture: CaptureState;
  timeLeft: number;
  ended: BattleEnd | null;
  /** Fait avancer la bataille de `dt` secondes. */
  update: (dt: number, input: PlayerInput) => void;
  /** Visee du joueur : ou tomberait l'obus tire maintenant, sans dispersion. */
  gunMarker: (out: THREE.Vector3) => { tank: SimTank | null; hit: ObbHit | null; turret: boolean; dist: number };
  /** Le tank adverse est-il visible pour l'equipe `team` ? */
  visibleTo: (t: SimTank, team: 0 | 1) => boolean;
  time: () => number;
}

// --------------------------------------------------------------- creation

function pickDefs(playerDef: TankDef, rnd: () => number): TankDef[] {
  // Des chars proches du rang du joueur, et au moins un de chaque classe.
  const pool = TANKS.filter((d) => Math.abs(d.tier - playerDef.tier) <= 1);
  const list: TankDef[] = [];
  const classes = ["leger", "moyen", "lourd", "chasseur"] as const;
  for (const c of classes) {
    const options = pool.filter((d) => d.cls === c);
    if (options.length) list.push(options[Math.floor(rnd() * options.length)]);
  }
  while (list.length < TEAM_SIZE) list.push(pool[Math.floor(rnd() * pool.length)]);
  return list.slice(0, TEAM_SIZE);
}

function roleFor(def: TankDef, rnd: () => number): Role {
  if (def.cls === "leger") return "eclaireur";
  if (def.cls === "chasseur") return "embuscade";
  if (def.cls === "lourd") return "assaut";
  return rnd() < 0.5 ? "assaut" : "soutien";
}

export function createBattle(
  map: TankMap,
  playerDef: TankDef,
  difficulty: Difficulty,
  makeModel: (def: TankDef) => TankModel,
  events: BattleEvents,
): Battle {
  let seed = (map.seed * 7919) >>> 0;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const diff = DIFFICULTIES[difficulty];
  const tanks: SimTank[] = [];
  const names = [...BOT_NAMES].sort(() => rnd() - 0.5);
  let nameIndex = 0;

  const teamDefs: TankDef[][] = [pickDefs(playerDef, rnd), pickDefs(playerDef, rnd)];
  // Le joueur prend la premiere place de son equipe avec son char.
  teamDefs[0][0] = playerDef;
  for (let team = 0 as 0 | 1; team < 2; team = (team + 1) as 0 | 1) {
    const spawns = [...map.spawns[team]].sort(() => rnd() - 0.5);
    // Le joueur part au premier rang, au milieu.
    if (team === 0) {
      const center = map.spawns[0][1];
      spawns.splice(spawns.indexOf(center), 1);
      spawns.unshift(center);
    }
    for (let k = 0; k < TEAM_SIZE; k++) {
      const def = teamDefs[team][k];
      const s = spawns[k];
      const isPlayer = team === 0 && k === 0;
      const model = makeModel(def);
      const ammoLeft = { perforant: def.ammo.perforant.count, sousCalibre: def.ammo.sousCalibre.count, explosif: def.ammo.explosif.count };
      const lane = Math.floor(rnd() * map.lanes.length);
      const brain: Brain | null = isPlayer
        ? null
        : {
            role: roleFor(def, rnd),
            lane,
            laneIndex: 0,
            path: null,
            pathIndex: 0,
            goalX: s.x,
            goalZ: s.z,
            repathAt: rnd() * 2,
            nextThink: rnd() * 0.5,
            target: null,
            readyAt: 0,
            aimLocal: new THREE.Vector3(),
            holdUntil: 0,
            stuckCheckAt: 3,
            stuckX: s.x,
            stuckZ: s.z,
            reverseUntil: 0,
            reverseSteer: 0,
            lastTargetAt: 0,
          };
      tanks.push({
        id: tanks.length,
        team,
        def,
        name: isPlayer ? "Toi" : names[nameIndex++ % names.length],
        isPlayer,
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
        pitchError: 1,
        pitchBlocked: false,
        pitch: 0,
        roll: 0,
        hp: def.hp,
        alive: true,
        reloadLeft: 1.5 + rnd() * 2,
        fullReload: true,
        clipLeft: def.clip?.size ?? 1,
        ammo: "perforant",
        ammoLeft,
        bloom: 3,
        spottedUntil: 0,
        lastHitAt: -100,
        damageDealt: 0,
        damageTaken: 0,
        kills: 0,
        shots: 0,
        hits: 0,
        pens: 0,
        recoil: 0,
        gunBaseZ: model.gun.position.z,
        radius: Math.hypot(def.look.length, def.look.width) * 0.31,
        brain,
        hullMatrix: new THREE.Matrix4(),
        hullInverse: new THREE.Matrix4(),
        turretMatrix: new THREE.Matrix4(),
        turretInverse: new THREE.Matrix4(),
        trackL: 0,
        trackR: 0,
        destroyedAt: -1,
      });
    }
  }
  const player = tanks[0];
  const shells: Shell[] = [];
  const capture: CaptureState = { points: [0, 0], cappers: [0, 0] };
  let time = 0;
  let timeLeft = BATTLE_SECONDS;
  let ended: BattleEnd | null = null;
  let spotAt = 0;
  /** Un calcul de chemin par image au plus : pas d'a-coup. */
  let pathBudget = 1;

  // --- objets temporaires (aucune allocation par image) ---
  const tmpV = new THREE.Vector3();
  const tmpV2 = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();
  const tmpRight = new THREE.Vector3();
  const tmpUp = new THREE.Vector3();
  const tmpM = new THREE.Matrix4();
  const tmpHit: ObbHit = { t: 0, zone: "avant", normal: new THREE.Vector3() };
  const bestNormal = new THREE.Vector3();
  const p0 = new THREE.Vector3();
  const p1 = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  // Reserves a la visee (aimAt ne doit pas ecraser le point vise).
  const localPt = new THREE.Vector3();
  const gunPos = new THREE.Vector3();
  const botAim = new THREE.Vector3();
  const botGunPos = new THREE.Vector3();
  const botDir = new THREE.Vector3();

  const deg = Math.PI / 180;
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

  // ----------------------------------------------------------- transformations

  function place(t: SimTank, dt: number) {
    const L = t.def.look.length * 0.45;
    const W = t.def.look.width * 0.45;
    const fx = Math.sin(t.yaw);
    const fz = Math.cos(t.yaw);
    const hF = groundHeight(map, t.x + fx * L, t.z + fz * L);
    const hB = groundHeight(map, t.x - fx * L, t.z - fz * L);
    const hR = groundHeight(map, t.x + fz * W, t.z - fx * W);
    const hL = groundHeight(map, t.x - fz * W, t.z + fx * W);
    const targetPitch = Math.atan2(hF - hB, L * 2);
    const targetRoll = Math.atan2(hR - hL, W * 2);
    const k = Math.min(1, dt * 8);
    t.pitch += (targetPitch - t.pitch) * k;
    t.roll += (targetRoll - t.roll) * k;
    const center = groundHeight(map, t.x, t.z);
    t.y = Math.max(center, (hF + hB + hL + hR) / 4);
    const m = t.model;
    m.root.position.set(t.x, t.y, t.z);
    m.root.rotation.order = "YXZ";
    // Le recul du tir cabre un peu la caisse.
    m.root.rotation.set(-t.pitch - t.recoil * 0.035, t.yaw, t.roll);
    m.turret.rotation.y = t.turretYaw;
    m.gun.rotation.x = -t.gunPitch;
    // Le tube recule au tir puis revient.
    m.gun.position.z = t.gunBaseZ - t.recoil * 0.45;
    m.root.updateMatrixWorld(true);
    // Boites des obus.
    t.hullMatrix.copy(m.root.matrixWorld).multiply(tmpM.makeTranslation(m.hullCenter.x, m.hullCenter.y, m.hullCenter.z));
    t.hullInverse.copy(t.hullMatrix).invert();
    const turretBase = m.fixedTurret ? m.root.matrixWorld : m.turret.matrixWorld;
    t.turretMatrix.copy(turretBase).multiply(tmpM.makeTranslation(m.turretCenter.x, m.turretCenter.y, m.turretCenter.z));
    t.turretInverse.copy(t.turretMatrix).invert();
  }

  // --------------------------------------------------------------- conduite

  function drive(t: SimTank, throttle: number, steer: number, dt: number) {
    const def = t.def;
    const vmax = def.speed / 3.6;
    const vrev = def.reverse / 3.6;
    const fx = Math.sin(t.yaw);
    const fz = Math.cos(t.yaw);
    // La pente freine en montee, un peu moins en descente.
    const ahead = groundHeight(map, t.x + fx * 3, t.z + fz * 3) - groundHeight(map, t.x - fx * 3, t.z - fz * 3);
    const grade = ahead / 6;
    const slopeK = THREE.MathUtils.clamp(1 - grade * Math.sign(t.speed || throttle) * 1.8, 0.35, 1.2);
    let target = throttle > 0 ? throttle * vmax : throttle * vrev;
    target *= slopeK;
    const rate = Math.sign(target - t.speed) === Math.sign(t.speed) || t.speed === 0 ? def.accel : def.accel * 2.2;
    const dv = target - t.speed;
    t.speed += THREE.MathUtils.clamp(dv, -rate * dt, rate * dt);
    // Un char qui roule vite tourne moins sec.
    const turn = steer * def.hullTraverse * deg * (1 - 0.35 * Math.min(1, Math.abs(t.speed) / vmax));
    t.turnRate += (turn - t.turnRate) * Math.min(1, dt * 6);
    t.yaw = wrap(t.yaw + t.turnRate * dt);
    const nx = t.x + Math.sin(t.yaw) * t.speed * dt;
    const nz = t.z + Math.cos(t.yaw) * t.speed * dt;
    // Pas dans l'eau profonde (seulement dans le lac : ailleurs, un creux reste du sol).
    if (Math.hypot(nx - map.lake.x, nz - map.lake.z) < map.lake.r + 12 && groundHeight(map, nx, nz) < WATER_LEVEL - 0.9) {
      t.speed *= -0.2;
    } else {
      t.x = nx;
      t.z = nz;
    }
    // Chenilles : la difference de vitesse fait tourner.
    const half = def.look.width / 2;
    const dl = (t.speed - t.turnRate * half) * dt;
    const dr = (t.speed + t.turnRate * half) * dt;
    t.trackL += dl;
    t.trackR += dr;
    t.model.roll(dl, dr);
    collide(t);
  }

  function collide(t: SimTank) {
    const r = t.radius;
    // Bords de la carte.
    const lim = MAP_HALF - 6;
    if (t.x < -lim || t.x > lim || t.z < -lim || t.z > lim) {
      t.x = THREE.MathUtils.clamp(t.x, -lim, lim);
      t.z = THREE.MathUtils.clamp(t.z, -lim, lim);
      t.speed *= 0.5;
    }
    // Maisons : on repousse le long de l'axe le moins enfonce.
    for (const h of map.houses) {
      const hx = h.w / 2 + r * 0.8;
      const hz = h.d / 2 + r * 0.8;
      const dx = t.x - h.x;
      const dz = t.z - h.z;
      if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
        const px = hx - Math.abs(dx);
        const pz = hz - Math.abs(dz);
        if (px < pz) t.x += Math.sign(dx || 1) * px;
        else t.z += Math.sign(dz || 1) * pz;
        t.speed *= 0.4;
      }
    }
    // Murets.
    for (const w of map.walls) {
      const d = distToSegment(t.x, t.z, w.x0, w.z0, w.x1, w.z1);
      if (d < r * 0.75) {
        const len = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
        const s = Math.max(0, Math.min(1, ((t.x - w.x0) * (w.x1 - w.x0) + (t.z - w.z0) * (w.z1 - w.z0)) / (len * len)));
        const cx = w.x0 + (w.x1 - w.x0) * s;
        const cz = w.z0 + (w.z1 - w.z0) * s;
        const nx = (t.x - cx) / (d || 1);
        const nz = (t.z - cz) / (d || 1);
        t.x = cx + nx * r * 0.75;
        t.z = cz + nz * r * 0.75;
        t.speed *= 0.5;
      }
    }
    // Rochers.
    for (const rk of map.rocks) {
      const dx = t.x - rk.x;
      const dz = t.z - rk.z;
      const d = Math.hypot(dx, dz);
      const min = rk.r * 0.85 + r * 0.7;
      if (d < min && d > 0.001) {
        t.x = rk.x + (dx / d) * min;
        t.z = rk.z + (dz / d) * min;
        t.speed *= 0.5;
      }
    }
    // Arbres : a plus de 5 km/h, on les couche ; sinon ils bloquent.
    for (let i = 0; i < map.trees.length; i++) {
      const tr = map.trees[i];
      const dx = t.x - tr.x;
      const dz = t.z - tr.z;
      if (Math.abs(dx) > r + 2 || Math.abs(dz) > r + 2) continue;
      if (treeDown[i]) continue;
      const d = Math.hypot(dx, dz);
      const min = r * 0.75 + 0.4;
      if (d < min) {
        if (Math.abs(t.speed) > 1.4) {
          treeDown[i] = 1;
          events.treeFell(i, Math.sin(t.yaw) * Math.sign(t.speed), Math.cos(t.yaw) * Math.sign(t.speed));
          t.speed *= 0.82;
        } else if (d > 0.001) {
          t.x = tr.x + (dx / d) * min;
          t.z = tr.z + (dz / d) * min;
        }
      }
    }
    // Les autres chars (et les epaves).
    for (const o of tanks) {
      if (o === t) continue;
      const dx = t.x - o.x;
      const dz = t.z - o.z;
      const d = Math.hypot(dx, dz);
      const min = (r + o.radius) * 0.82;
      if (d < min && d > 0.001) {
        const push = (min - d) * (o.alive ? 0.5 : 1);
        t.x += (dx / d) * push;
        t.z += (dz / d) * push;
        if (o.alive) {
          o.x -= (dx / d) * push;
          o.z -= (dz / d) * push;
        }
        t.speed *= 0.6;
      }
    }
  }
  const treeDown = new Uint8Array(map.trees.length);

  // --------------------------------------------------------------- tourelle

  /**
   * Tourne la tourelle et leve le canon vers un point du monde. `point` n'est
   * jamais modifie (il peut etre un vecteur partage du joueur ou d'un bot).
   */
  function aimAt(t: SimTank, point: THREE.Vector3, dt: number) {
    const m = t.model;
    // Le point dans le repere de la caisse : cap de tourelle voulu.
    localPt.copy(point).applyMatrix4(tmpM.copy(m.root.matrixWorld).invert());
    let want = Math.atan2(localPt.x, localPt.z);
    const arc = t.def.gunArc * deg;
    if (arc < Math.PI) want = THREE.MathUtils.clamp(want, -arc, arc);
    const maxTurn = t.def.turretTraverse * deg * dt;
    const diff = wrap(want - t.turretYaw);
    const turn = THREE.MathUtils.clamp(diff, -maxTurn, maxTurn);
    t.turretYaw = wrap(t.turretYaw + turn);
    t.turretRate = Math.abs(turn) / Math.max(dt, 1e-4);
    // Hausse : angle balistique vers le point, dans le repere du canon.
    m.gun.getWorldPosition(gunPos);
    const dx = point.x - gunPos.x;
    const dz = point.z - gunPos.z;
    const horiz = Math.hypot(dx, dz);
    const dy = point.y - gunPos.y;
    const v = t.def.ammo[t.ammo].speed;
    const ballistic = launchAngle(horiz, dy, v) ?? t.def.elevation * deg;
    const geometric = Math.atan2(dy, horiz);
    // Le canon est incline avec la caisse : on corrige de l'inclinaison locale.
    localPt.copy(point).applyMatrix4(tmpM.copy(m.turret.matrixWorld).invert());
    const localGeom = Math.atan2(localPt.y - m.gun.position.y, Math.hypot(localPt.x, localPt.z - m.gun.position.z));
    const rawPitch = localGeom + (ballistic - geometric);
    const wantPitch = THREE.MathUtils.clamp(rawPitch, -t.def.depression * deg, t.def.elevation * deg);
    const pitchRate = 22 * deg * dt;
    t.gunPitch += THREE.MathUtils.clamp(wantPitch - t.gunPitch, -pitchRate, pitchRate);
    // L'ecart se mesure a la hausse VRAIMENT voulue : si elle est hors des
    // butees du canon, l'ecart reste grand et un bot ne tire pas dans le vide.
    t.pitchError = Math.abs(rawPitch - t.gunPitch);
    t.pitchBlocked = rawPitch !== wantPitch;
  }

  // ---------------------------------------------------------------- tir

  /** Nouvel obus (ou nouveau chargeur) a mettre en place : rechargement complet. */
  function startFullReload(t: SimTank) {
    t.reloadLeft = t.def.reload;
    t.fullReload = true;
    t.clipLeft = t.def.clip?.size ?? 1;
  }

  function fire(t: SimTank, aimFactor: number) {
    if (t.reloadLeft > 0 || !t.alive) return;
    if (t.ammoLeft[t.ammo] <= 0) {
      const next = AMMO_ORDER.find((a) => t.ammoLeft[a] > 0);
      if (!next) return;
      t.ammo = next;
      startFullReload(t);
      return;
    }
    const m = t.model;
    m.muzzle.getWorldPosition(p0);
    tmpDir.set(0, 0, 1).transformDirection(m.gun.matrixWorld);
    // Dispersion : un point du cercle, plus souvent pres du centre.
    const radius = t.def.dispersion * t.bloom * aimFactor;
    const off = dispersionOffset(radius, rnd);
    tmpRight.crossVectors(tmpDir, up).normalize();
    tmpUp.crossVectors(tmpRight, tmpDir).normalize();
    tmpDir.addScaledVector(tmpRight, off.dx / 100).addScaledVector(tmpUp, off.dy / 100).normalize();
    const spec = t.def.ammo[t.ammo];
    shells.push({
      owner: t,
      ammo: t.ammo,
      pos: p0.clone(),
      vel: tmpDir.clone().multiplyScalar(spec.speed),
      penetration: spec.penetration,
      damage: spec.damage,
      caliber: t.def.caliber,
      age: 0,
      traveled: 0,
    });
    t.ammoLeft[t.ammo]--;
    const clip = t.def.clip;
    if (clip) {
      // Rafale : l'obus suivant arrive vite, puis tout le chargeur a recharger.
      t.clipLeft--;
      if (t.clipLeft > 0) {
        t.reloadLeft = clip.interval;
        t.fullReload = false;
      } else startFullReload(t);
      t.bloom += 0.45;
      t.recoil = 0.5;
    } else {
      startFullReload(t);
      t.bloom += 2.2;
      t.recoil = 1;
    }
    t.shots++;
    // Un char qui tire se devoile a moins de 400 m de l'ennemi.
    for (const o of tanks) {
      if (o.team !== t.team && o.alive && Math.hypot(o.x - t.x, o.z - t.z) < 400) {
        t.spottedUntil = Math.max(t.spottedUntil, time + 3);
        break;
      }
    }
    events.shot(t, p0, tmpDir);
  }

  /** Perte de penetration avec la distance (les sous-calibres perdent plus). */
  function penAt(s: Shell): number {
    if (AMMO[s.ammo].explosive) return s.penetration;
    const loss = s.ammo === "sousCalibre" ? 0.28 : 0.16;
    return s.penetration * (1 - loss * Math.min(1, Math.max(0, s.traveled - 100) / 400));
  }

  function updateShells(dt: number) {
    for (let i = shells.length - 1; i >= 0; i--) {
      const s = shells[i];
      s.age += dt;
      p0.copy(s.pos);
      s.vel.y -= SHELL_GRAVITY * dt;
      p1.copy(s.pos).addScaledVector(s.vel, dt);
      // Contact le plus proche : chars, maisons, rochers, sol.
      let bestT = 2;
      let bestTank: SimTank | null = null;
      let bestZone: Zone = "avant";
      let bestTurret = false;
      for (const t of tanks) {
        if (t === s.owner && s.age < 0.15) continue;
        const dx = t.x - p0.x;
        const dz = t.z - p0.z;
        const reach = s.vel.length() * dt + 8;
        if (dx * dx + dz * dz > reach * reach) continue;
        if (segmentObb(p0, p1, t.turretMatrix, t.turretInverse, t.model.turretHalf, t.def.turret, tmpHit) && tmpHit.t < bestT) {
          bestT = tmpHit.t;
          bestTank = t;
          bestZone = tmpHit.zone;
          bestTurret = true;
          bestNormal.copy(tmpHit.normal);
        }
        if (segmentObb(p0, p1, t.hullMatrix, t.hullInverse, t.model.hullHalf, t.def.hull, tmpHit) && tmpHit.t < bestT) {
          bestT = tmpHit.t;
          bestTank = t;
          bestZone = tmpHit.zone;
          bestTurret = false;
          bestNormal.copy(tmpHit.normal);
        }
      }
      let wall = false;
      const th = segmentHouse(map, p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
      if (th >= 0 && th < bestT) {
        bestT = th;
        bestTank = null;
        wall = true;
      }
      const tr = segmentRock(map, p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
      if (tr >= 0 && tr < bestT) {
        bestT = tr;
        bestTank = null;
        wall = true;
      }
      const tg = segmentGround(map, p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
      if (tg >= 0 && tg < bestT) {
        bestT = tg;
        bestTank = null;
        wall = false;
      }
      if (bestT <= 1) {
        tmpV.copy(p0).lerp(p1, bestT);
        s.traveled += p0.distanceTo(tmpV);
        if (bestTank) {
          const armor = bestTurret ? bestTank.def.turret : bestTank.def.hull;
          const thick = zoneThickness(armor, bestZone);
          tmpDir.copy(s.vel).normalize();
          const res = resolveHit(tmpDir, bestNormal, thick, s.caliber, s.ammo, { penetration: penAt(s), damage: s.damage, speed: 0, count: 0 }, rnd);
          applyHit(s.owner, bestTank, res, tmpV, bestZone);
        } else {
          events.missed(s.owner, tmpV, wall ? "mur" : "sol");
        }
        shells.splice(i, 1);
        continue;
      }
      s.traveled += p0.distanceTo(p1);
      s.pos.copy(p1);
      if (s.age > 5 || Math.abs(s.pos.x) > MAP_HALF + 200 || Math.abs(s.pos.z) > MAP_HALF + 200) shells.splice(i, 1);
    }
  }

  function applyHit(shooter: SimTank, target: SimTank, res: ShotResult, point: THREE.Vector3, zone: Zone) {
    if (!target.alive) {
      // Une epave arrete l'obus, sans plus.
      events.hit(shooter, target, { ...res, damage: 0 }, point, zone);
      return;
    }
    const friendly = shooter.team === target.team;
    // Tir ami : pas de degats (on garde l'impact).
    const dmg = friendly ? 0 : Math.min(target.hp, res.damage);
    shooter.hits++;
    if (res.outcome === "penetration") shooter.pens++;
    target.hp -= dmg;
    target.damageTaken += dmg;
    shooter.damageDealt += dmg;
    if (dmg > 0) target.lastHitAt = time;
    // Touche : on voit le tireur un instant (le bruit, l'eclair).
    shooter.spottedUntil = Math.max(shooter.spottedUntil, time + 2);
    // Un bot touche riposte vers son agresseur.
    if (target.brain && !friendly && target.brain.target === null) {
      target.brain.target = shooter;
      target.brain.readyAt = time + diff.reaction;
    }
    // Capture : un char touche dans le cercle fait perdre des points.
    if (dmg > 0) {
      const base = map.bases[1 - target.team];
      if (Math.hypot(target.x - base.x, target.z - base.z) < BASE_RADIUS) {
        capture.points[1 - target.team] = Math.max(0, capture.points[1 - target.team] - 25);
      }
    }
    events.hit(shooter, target, { ...res, damage: dmg }, point, zone);
    if (target.hp <= 0) {
      target.hp = 0;
      target.alive = false;
      target.destroyedAt = time;
      target.speed = 0;
      shooter.kills++;
      target.model.setWrecked();
      events.destroyed(target, shooter);
    }
  }

  // ----------------------------------------------------------- reperage

  function updateSpotting() {
    for (const e of tanks) {
      if (!e.alive) continue;
      for (const a of tanks) {
        if (a.team === e.team || !a.alive) continue;
        const d = Math.hypot(a.x - e.x, a.z - e.z);
        if (d > a.def.viewRange) continue;
        const eyeA = a.y + a.def.look.clearance + a.def.look.hullHeight + 1.3;
        const bodyE = e.y + e.def.look.clearance + e.def.look.hullHeight * 0.8;
        // Tres pres, on se voit toujours.
        if (d < 50 || lineOfSight(map, a.x, eyeA, a.z, e.x, bodyE, e.z) || lineOfSight(map, a.x, eyeA, a.z, e.x, bodyE + 1.2, e.z)) {
          e.spottedUntil = Math.max(e.spottedUntil, time + SPOT_MEMORY);
          break;
        }
      }
    }
  }

  function visibleTo(t: SimTank, team: 0 | 1): boolean {
    return t.team === team || !t.alive || t.spottedUntil > time;
  }

  // ---------------------------------------------------------------- bots

  function setGoal(t: SimTank, x: number, z: number) {
    const b = t.brain!;
    if (Math.hypot(b.goalX - x, b.goalZ - z) < 6 && b.path) return;
    b.goalX = x;
    b.goalZ = z;
    b.path = null;
    b.repathAt = 0;
  }

  /** Le couloir se lit de la base 0 vers la base 1 ; l'equipe 1 le parcourt a l'envers. */
  function lanePoint(t: SimTank, index: number): [number, number] {
    const lane = map.lanes[t.brain!.lane];
    return t.team === 0 ? lane[Math.min(index, lane.length - 1)] : lane[Math.max(0, lane.length - 1 - index)];
  }

  function think(t: SimTank) {
    const b = t.brain!;
    b.nextThink = time + 0.35 + rnd() * 0.2;
    // --- Cible : l'ennemi repere, visible depuis le canon, le plus interessant ---
    const eye = t.y + t.def.look.clearance + t.def.look.hullHeight + 1.1;
    let best: SimTank | null = null;
    let bestScore = Infinity;
    for (const e of tanks) {
      if (e.team === t.team || !e.alive || e.spottedUntil <= time) continue;
      const d = Math.hypot(e.x - t.x, e.z - t.z);
      if (d > 480) continue;
      const body = e.y + e.def.look.clearance + e.def.look.hullHeight * 0.7;
      if (!lineOfSight(map, t.x, eye, t.z, e.x, body, e.z)) continue;
      // Les plus proches et les plus abimes d'abord.
      const score = d * (0.35 + e.hp / e.def.hp) * (e === b.target ? 0.7 : 1);
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    if (best !== b.target) {
      b.target = best;
      if (best) {
        b.readyAt = time + diff.reaction * (0.8 + rnd() * 0.5);
        // Ou viser sur la cible : le centre, ou les points faibles au niveau As.
        const hx = best.model.hullHalf;
        if (diff.weakspots) b.aimLocal.set((rnd() - 0.5) * hx.x * 0.8, -hx.y * 0.12, (rnd() - 0.5) * hx.z * 0.4);
        else b.aimLocal.set((rnd() - 0.5) * hx.x * 0.8, (rnd() - 0.3) * hx.y * 0.8, (rnd() - 0.5) * hx.z * 0.5);
      }
    }
    if (b.target) b.lastTargetAt = time;
    // Munition : explosif contre les legers, sous-calibre contre les lourds (a partir de Veteran).
    if (b.target) {
      let want: AmmoId = "perforant";
      if (b.target.def.cls === "leger" && t.ammoLeft.explosif > 0 && t.def.caliber >= 75) want = "explosif";
      else if (b.target.def.cls === "lourd" && difficulty !== "recrue" && t.ammoLeft.sousCalibre > 0) want = "sousCalibre";
      if (want !== t.ammo && t.reloadLeft <= 0.2 && (!t.def.clip || t.clipLeft === t.def.clip.size)) {
        t.ammo = want;
        startFullReload(t);
        t.reloadLeft = t.def.reload * 0.5;
      }
    }

    // --- Ou aller ---
    const ownBase = map.bases[t.team];
    const enemyBase = map.bases[1 - t.team];
    const threat = capture.points[t.team];
    const dOwn = Math.hypot(t.x - ownBase.x, t.z - ownBase.z);
    if (threat > 15 && (dOwn < 260 || b.role === "soutien")) {
      // La base est prise : on rentre la defendre.
      setGoal(t, ownBase.x + (rnd() - 0.5) * 20, ownBase.z + (rnd() - 0.5) * 20);
      return;
    }
    const enemiesAlive = tanks.some((e) => e.team !== t.team && e.alive);
    if (!enemiesAlive) return;
    // Au contact : les lourds et les chasseurs s'arretent pour tirer, les autres continuent.
    if (b.target) {
      const d = Math.hypot(b.target.x - t.x, b.target.z - t.z);
      const hold = b.role === "embuscade" || b.role === "soutien" ? 420 : b.role === "assaut" ? 260 : 120;
      // Canon en butee (cible trop bas sous une crete) : on avance au lieu d'attendre.
      if (d < hold && !t.pitchBlocked) {
        b.holdUntil = time + 1.5;
        return;
      }
    }
    // Embuscade : le chasseur tient une position a mi-chemin tant qu'il a des cibles recentes.
    if (b.role === "embuscade" && b.laneIndex >= 2 && time - b.lastTargetAt < 35) return;
    // Pres de la base ennemie et plus personne en vue : on capture.
    const dEnemy = Math.hypot(t.x - enemyBase.x, t.z - enemyBase.z);
    if (dEnemy < 90) {
      setGoal(t, enemyBase.x + (rnd() - 0.5) * 16, enemyBase.z + (rnd() - 0.5) * 16);
      return;
    }
    // Sinon, on suit son couloir.
    const [lx, lz] = lanePoint(t, b.laneIndex);
    if (Math.hypot(t.x - lx, t.z - lz) < 25 && b.laneIndex < map.lanes[b.lane].length - 1) b.laneIndex++;
    const [gx, gz] = lanePoint(t, b.laneIndex);
    setGoal(t, gx, gz);
  }

  function botDrive(t: SimTank, dt: number) {
    const b = t.brain!;
    let throttle = 0;
    let steer = 0;
    if (time < b.reverseUntil) {
      throttle = -1;
      steer = b.reverseSteer;
    } else if (time > b.holdUntil) {
      // Chemin vers l'objectif (recalcule de temps en temps, un par image au plus).
      if ((!b.path || time > b.repathAt) && pathBudget > 0) {
        pathBudget--;
        b.path = findPath(map, t.x, t.z, b.goalX, b.goalZ);
        b.pathIndex = 0;
        b.repathAt = time + 6 + rnd() * 3;
      }
      if (b.path && b.pathIndex < b.path.length) {
        const [px, pz] = b.path[b.pathIndex];
        const dx = px - t.x;
        const dz = pz - t.z;
        const d = Math.hypot(dx, dz);
        if (d < 7) b.pathIndex++;
        const want = Math.atan2(dx, dz);
        const diffA = wrap(want - t.yaw);
        steer = THREE.MathUtils.clamp(diffA * 2.2, -1, 1);
        throttle = Math.abs(diffA) < 0.6 ? 1 : Math.abs(diffA) < 1.4 ? 0.45 : 0.1;
        // Ralentir derriere un allie.
        for (const o of tanks) {
          if (o === t || o.team !== t.team || !o.alive) continue;
          const ox = o.x - t.x;
          const oz = o.z - t.z;
          const od = Math.hypot(ox, oz);
          if (od < 12 && ox * Math.sin(t.yaw) + oz * Math.cos(t.yaw) > 0) {
            throttle *= 0.3;
            steer += Math.sign(ox * Math.cos(t.yaw) - oz * Math.sin(t.yaw)) * -0.5;
          }
        }
        // L'eclaireur ralentit quand il tire.
        if (b.target && b.role === "eclaireur") throttle *= 0.6;
      }
      // Coince : on recule en braquant.
      if (time > b.stuckCheckAt) {
        const moved = Math.hypot(t.x - b.stuckX, t.z - b.stuckZ);
        if (throttle > 0.4 && moved < 1.2) {
          b.reverseUntil = time + 1.6;
          b.reverseSteer = rnd() < 0.5 ? -1 : 1;
          b.path = null;
        }
        b.stuckCheckAt = time + 2.5;
        b.stuckX = t.x;
        b.stuckZ = t.z;
      }
    }
    drive(t, throttle, THREE.MathUtils.clamp(steer, -1, 1), dt);
  }

  function botGun(t: SimTank, dt: number) {
    const b = t.brain!;
    if (b.target && b.target.alive) {
      botAim.copy(b.aimLocal).applyMatrix4(b.target.hullMatrix);
      // On anticipe un peu la course de la cible.
      const lead = Math.hypot(botAim.x - t.x, botAim.z - t.z) / t.def.ammo[t.ammo].speed;
      botAim.x += Math.sin(b.target.yaw) * b.target.speed * lead;
      botAim.z += Math.cos(b.target.yaw) * b.target.speed * lead;
      aimAt(t, botAim, dt);
      // On tire quand la reaction est passee, le canon a peu pres pointe et la visee assez serree.
      if (time >= b.readyAt && t.reloadLeft <= 0) {
        t.model.gun.getWorldPosition(botGunPos);
        botDir.set(0, 0, 1).transformDirection(t.model.gun.matrixWorld);
        const dist = botGunPos.distanceTo(botAim);
        // Ecart horizontal seulement : la hausse balistique leve le canon au-dessus de la ligne droite.
        const flatAim = Math.atan2(botAim.x - botGunPos.x, botAim.z - botGunPos.z);
        const flatGun = Math.atan2(botDir.x, botDir.z);
        const off = Math.abs(wrap(flatAim - flatGun));
        const tolerance = Math.max(0.012, 3 / Math.max(30, dist));
        const settled = t.bloom < 1.5 || time - b.readyAt > t.def.aimTime * 1.6;
        if (off < tolerance && t.pitchError < tolerance && settled) {
          // Le bout du canon doit voir la cible : une crete peut cacher le tube
          // alors que le chef de char, plus haut, voit l'ennemi.
          t.model.muzzle.getWorldPosition(botGunPos);
          if (lineOfSight(map, botGunPos.x, botGunPos.y, botGunPos.z, botAim.x, botAim.y, botAim.z)) fire(t, diff.aimFactor);
          else b.readyAt = time + 0.6;
        }
      }
    } else {
      // Pas de cible : le canon regarde devant, vers l'objectif.
      botAim.set(t.x + Math.sin(t.yaw) * 60, t.y + 3, t.z + Math.cos(t.yaw) * 60);
      aimAt(t, botAim, dt);
      b.target = null;
    }
  }

  // --------------------------------------------------------------- capture

  function updateCapture(dt: number) {
    for (let b = 0; b < 2; b++) {
      const base = map.bases[b];
      let cappers = 0;
      let defenders = 0;
      for (const t of tanks) {
        if (!t.alive) continue;
        if (Math.hypot(t.x - base.x, t.z - base.z) > BASE_RADIUS) continue;
        if (t.team === b) defenders++;
        else cappers++;
      }
      capture.cappers[b] = cappers;
      if (cappers > 0 && defenders === 0) capture.points[b] = Math.min(100, capture.points[b] + Math.min(3, cappers) * CAP_RATE * dt);
      else if (cappers === 0) capture.points[b] = Math.max(0, capture.points[b] - 2 * dt);
    }
  }

  // ---------------------------------------------------------------- boucle

  function update(dt: number, input: PlayerInput) {
    if (ended) {
      // Les epaves continuent de fumer, les bots s'arretent.
      for (const t of tanks) place(t, dt);
      return;
    }
    time += dt;
    timeLeft = Math.max(0, BATTLE_SECONDS - time);
    pathBudget = 1;

    const playerWasLoading = player.reloadLeft > 0;
    for (const t of tanks) {
      t.reloadLeft = Math.max(0, t.reloadLeft - dt);
      t.recoil = Math.max(0, t.recoil - dt * 3);
    }

    // Joueur.
    if (player.alive) {
      // Le « clac » de la culasse : seulement a la fin d'un rechargement complet.
      if (playerWasLoading && player.reloadLeft === 0 && player.fullReload) {
        player.fullReload = false;
        events.reloaded(player);
      }
      if (input.ammo !== player.ammo && player.ammoLeft[input.ammo] > 0) {
        // Changer d'obus : il faut recharger (tout le chargeur pour un canon automatique).
        player.ammo = input.ammo;
        startFullReload(player);
      }
      drive(player, input.throttle, input.steer, dt);
      if (input.aim) aimAt(player, input.aim, dt);
      else player.turretRate = 0;
      if (input.fire) fire(player, 1);
    }

    // Bots.
    for (const t of tanks) {
      if (t.isPlayer || !t.alive) continue;
      if (time >= t.brain!.nextThink) think(t);
      botDrive(t, dt);
      botGun(t, dt);
    }

    // Dispersion : elle grandit en mouvement et se resserre a l'arret.
    for (const t of tanks) {
      if (!t.alive) continue;
      const vmax = t.def.speed / 3.6;
      const moving = 1 + (Math.abs(t.speed) / vmax) * 2.4 + Math.abs(t.turnRate) * 1.6 + t.turretRate * 0.9;
      const decay = Math.exp((-dt * 2.3) / t.def.aimTime);
      t.bloom = Math.max(moving, 1 + (t.bloom - 1) * decay);
    }

    for (const t of tanks) place(t, dt);
    updateShells(dt);

    spotAt -= dt;
    if (spotAt <= 0) {
      spotAt = 0.3;
      updateSpotting();
    }
    updateCapture(dt);

    // Fin de bataille.
    const alive0 = tanks.some((t) => t.team === 0 && t.alive);
    const alive1 = tanks.some((t) => t.team === 1 && t.alive);
    if (!alive1) ended = { winner: 0, reason: "destruction" };
    else if (!alive0) ended = { winner: 1, reason: "destruction" };
    else if (capture.points[1] >= 100) ended = { winner: 0, reason: "capture" };
    else if (capture.points[0] >= 100) ended = { winner: 1, reason: "capture" };
    else if (timeLeft <= 0) ended = { winner: -1, reason: "temps" };
  }

  // --------------------------------------------------------- marqueur de visee

  function gunMarker(out: THREE.Vector3): { tank: SimTank | null; hit: ObbHit | null; turret: boolean; dist: number } {
    const t = player;
    const m = t.model;
    m.muzzle.getWorldPosition(p0);
    tmpDir.set(0, 0, 1).transformDirection(m.gun.matrixWorld);
    const v = t.def.ammo[t.ammo].speed;
    const vel = tmpV2.copy(tmpDir).multiplyScalar(v);
    // On suit la trajectoire par pas de 0,05 s (40 m environ).
    const dt = 0.05;
    for (let k = 0; k < 40; k++) {
      p1.copy(p0).addScaledVector(vel, dt);
      vel.y -= SHELL_GRAVITY * dt;
      let bestT = 2;
      let bestTank: SimTank | null = null;
      let turret = false;
      let hit: ObbHit | null = null;
      for (const o of tanks) {
        if (o === t) continue;
        if (segmentObb(p0, p1, o.turretMatrix, o.turretInverse, o.model.turretHalf, o.def.turret, tmpHit) && tmpHit.t < bestT) {
          bestT = tmpHit.t;
          bestTank = o;
          turret = true;
          hit = { t: tmpHit.t, zone: tmpHit.zone, normal: bestNormal.copy(tmpHit.normal) };
        }
        if (segmentObb(p0, p1, o.hullMatrix, o.hullInverse, o.model.hullHalf, o.def.hull, tmpHit) && tmpHit.t < bestT) {
          bestT = tmpHit.t;
          bestTank = o;
          turret = false;
          hit = { t: tmpHit.t, zone: tmpHit.zone, normal: bestNormal.copy(tmpHit.normal) };
        }
      }
      const th = segmentHouse(map, p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
      if (th >= 0 && th < bestT) {
        bestT = th;
        bestTank = null;
        hit = null;
      }
      const tg = segmentGround(map, p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
      if (tg >= 0 && tg < bestT) {
        bestT = tg;
        bestTank = null;
        hit = null;
      }
      if (bestT <= 1) {
        out.copy(p0).lerp(p1, bestT);
        m.muzzle.getWorldPosition(tmpV);
        return { tank: bestTank, hit, turret, dist: out.distanceTo(tmpV) };
      }
      p0.copy(p1);
    }
    out.copy(p0);
    m.muzzle.getWorldPosition(tmpV);
    return { tank: null, hit: null, turret: false, dist: out.distanceTo(tmpV) };
  }

  for (const t of tanks) place(t, 1);

  return {
    tanks,
    player,
    shells,
    capture,
    get timeLeft() {
      return timeLeft;
    },
    get ended() {
      return ended;
    },
    update,
    gunMarker,
    visibleTo,
    time: () => time,
  } as Battle;
}
