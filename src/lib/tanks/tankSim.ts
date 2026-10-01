import * as THREE from "three";
import {
  AMMO,
  AMMO_ORDER,
  DIFFICULTIES,
  MODES,
  projectileOf,
  tanksForMode,
  type BattleMode,
  type AmmoId,
  type Difficulty,
  type ProjectileKind,
  type TankDef,
} from "./tankDefs";
import {
  SHELL_GRAVITY,
  dispersionOffset,
  effectiveArmor,
  artyCharge,
  launchAngle,
  penetrationChance,
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
  deepWater,
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

// La bataille de « Tonnerre d'Acier » : deux equipes de sept chars (huit en
// Guerre de 100), le joueur et les bots, artillerie comprise. Ce module fait
// avancer le monde (conduite, tourelles, obus,
// reperage, capture, intelligence des bots) et deplace les modeles ; la scene
// s'occupe de l'image, du son et de l'interface via les evenements.

// La taille des equipes et la duree d'une bataille dependent du mode (MODES, tankDefs).
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

export type Role = "eclaireur" | "assaut" | "soutien" | "embuscade" | "artillerie";

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
  /** Chance estimee de percer la cible avec l'obus en place (0 a 1). */
  pen: number;
  /** Cote vers lequel il presente sa caisse en biais (-1 ou 1). */
  angleSide: number;
  /** Recule a couvert pendant le rechargement jusqu'a cet instant. */
  retreatUntil: number;
  /** Contourne la cible (tir impossible de face) jusqu'a cet instant. */
  flankUntil: number;
  flankDir: number;
  /** Artillerie : sa position de tir, en retrait (NaN : a choisir), et quand elle l'a choisie. */
  artyX: number;
  artyZ: number;
  artyAt: number;
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
  /** Dernier point vise (l'artillerie en tire sa charge). */
  aimPoint: THREE.Vector3;
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
  /** Degats arretes par le blindage (obus bloques ou ricoches). */
  damageBlocked: number;
  /** Ennemis reperes le premier. */
  detections: number;
  /** Degats infliges par les allies aux ennemis qu'il a reperes. */
  assist: number;
  /** Le dernier char ennemi qui l'a repere (pour l'aide au reperage). */
  spottedBy: SimTank | null;
  kills: number;
  shots: number;
  hits: number;
  pens: number;
  /** Recul du canon apres un tir (0 a 1). */
  recoil: number;
  /** Instant du dernier tir (le faisceau d'un canon Gatling tourne pendant la rafale). */
  lastShotAt: number;
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
  /** Pesanteur (plus forte pour l'artillerie). */
  gravity: number;
  /** Rayon d'eclatement (0 : pas d'eclats autour de l'impact). */
  splash: number;
  /** Obus, roquette ou missile guide (il suit le point vise par son tireur). */
  kind: ProjectileKind;
}

/** Virage maximal d'un missile filoguide, en radians par seconde. */
const MISSILE_TURN = 0.9;

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
  /** Un obus d'artillerie eclate (grande explosion, degats autour). */
  blast?: (point: THREE.Vector3, radius: number) => void;
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

function pickDefs(playerDef: TankDef, rnd: () => number, mode: BattleMode, size: number): TankDef[] {
  // Des chars du mode, proches du rang du joueur, au moins un de chaque classe
  // (une seule artillerie par equipe).
  // Le char d'admin se mesure aux chars du plus haut rang du mode.
  const tier = playerDef.adminOnly ? MODES[mode].tiers[1] : playerDef.tier;
  let pool = tanksForMode(mode).filter((d) => Math.abs(d.tier - tier) <= 1);
  if (pool.length === 0) pool = [playerDef];
  const list: TankDef[] = [];
  const classes = ["leger", "moyen", "lourd", "chasseur", "artillerie"] as const;
  for (const c of classes) {
    const options = pool.filter((d) => d.cls === c);
    if (options.length) list.push(options[Math.floor(rnd() * options.length)]);
  }
  const direct = pool.filter((d) => d.cls !== "artillerie");
  const fill = direct.length ? direct : pool;
  while (list.length < size) list.push(fill[Math.floor(rnd() * fill.length)]);
  return list.slice(0, size);
}

function roleFor(def: TankDef, rnd: () => number): Role {
  if (def.cls === "artillerie") return "artillerie";
  if (def.cls === "leger") return "eclaireur";
  if (def.cls === "chasseur") return "embuscade";
  if (def.cls === "lourd") return "assaut";
  return rnd() < 0.5 ? "assaut" : "soutien";
}

export function createBattle(
  map: TankMap,
  playerDef: TankDef,
  difficulty: Difficulty,
  /** Construit le modele d'un char (le joueur peut avoir son camouflage). */
  makeModel: (def: TankDef, isPlayer: boolean) => TankModel,
  events: BattleEvents,
  mode: BattleMode = "normale",
): Battle {
  const modeInfo = MODES[mode];
  const teamSize = modeInfo.teamSize;
  const battleSeconds = modeInfo.seconds;
  let seed = (map.seed * 7919) >>> 0;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Guerre de 100 : des bots plus vifs et plus precis, qui visent les points faibles.
  const baseDiff = DIFFICULTIES[difficulty];
  const diff = modeInfo.hard ? { ...baseDiff, reaction: baseDiff.reaction * 0.72, aimFactor: baseDiff.aimFactor * 0.85, weakspots: true } : baseDiff;
  /** Les bots choisissent leur obus et contournent (tout sauf la recrue du mode normal). */
  const skilled = difficulty !== "recrue" || modeInfo.hard;
  const tanks: SimTank[] = [];
  const names = [...BOT_NAMES].sort(() => rnd() - 0.5);
  let nameIndex = 0;

  const teamDefs: TankDef[][] = [pickDefs(playerDef, rnd, mode, teamSize), pickDefs(playerDef, rnd, mode, teamSize)];
  // Le joueur prend la premiere place de son equipe avec son char (et reste
  // la seule artillerie de son equipe s'il en conduit une).
  teamDefs[0][0] = playerDef;
  if (playerDef.cls === "artillerie") {
    const others = tanksForMode(mode).filter((d) => d.cls !== "artillerie" && Math.abs(d.tier - Math.min(playerDef.tier, MODES[mode].tiers[1])) <= 1);
    for (let k = 1; k < teamDefs[0].length; k++) {
      if (teamDefs[0][k].cls === "artillerie" && others.length) teamDefs[0][k] = others[Math.floor(rnd() * others.length)];
    }
  }
  for (let team = 0 as 0 | 1; team < 2; team = (team + 1) as 0 | 1) {
    const spawns = [...map.spawns[team]].sort(() => rnd() - 0.5);
    // Le joueur part au premier rang, au milieu.
    if (team === 0) {
      const center = map.spawns[0][1];
      spawns.splice(spawns.indexOf(center), 1);
      spawns.unshift(center);
    }
    for (let k = 0; k < teamSize; k++) {
      const def = teamDefs[team][k];
      const s = spawns[k];
      const isPlayer = team === 0 && k === 0;
      const model = makeModel(def, isPlayer);
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
            pen: 1,
            angleSide: rnd() < 0.5 ? -1 : 1,
            retreatUntil: 0,
            flankUntil: 0,
            flankDir: rnd() < 0.5 ? -1 : 1,
            artyX: NaN,
            artyZ: NaN,
            artyAt: 0,
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
        aimPoint: new THREE.Vector3(s.x + Math.sin(s.yaw) * 100, groundHeight(map, s.x, s.z), s.z + Math.cos(s.yaw) * 100),
        pitch: 0,
        roll: 0,
        hp: def.hp,
        alive: true,
        reloadLeft: 1.5 + rnd() * 2,
        fullReload: true,
        clipLeft: def.clip?.size ?? 1,
        // L'artillerie des bots tire des obus explosifs.
        ammo: def.cls === "artillerie" && !isPlayer ? "explosif" : "perforant",
        ammoLeft,
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
  let timeLeft = battleSeconds;
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
  const convPivot = new THREE.Vector3();

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
    // Pas dans l'eau profonde (lac, mare, riviere hors des ponts et du gue ; on roule sur la glace).
    if (deepWater(map, nx, nz)) {
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

  // --- Collisions : chaque char est un rectangle oriente (sa vraie forme vue du dessus) ---
  const rectA = { x: 0, z: 0, fx: 0, fz: 1, hl: 1, hw: 1 };
  const rectB = { x: 0, z: 0, fx: 0, fz: 1, hl: 1, hw: 1 };
  const sep = { nx: 0, nz: 0, depth: 0 };
  type Rect = typeof rectA;

  function tankRect(t: SimTank, out: Rect): Rect {
    out.x = t.x;
    out.z = t.z;
    out.fx = Math.sin(t.yaw);
    out.fz = Math.cos(t.yaw);
    out.hl = t.def.look.length * 0.48;
    out.hw = t.def.look.width * 0.48;
    return out;
  }

  /**
   * Axes separateurs de deux rectangles orientes (plan x-z). Si ils se
   * chevauchent, `sep` recoit la direction la moins enfoncee (de a vers b) et
   * la profondeur.
   */
  function rectOverlap(a: Rect, b: Rect): boolean {
    sep.depth = Infinity;
    if (!sepAxis(a, b, a.fx, a.fz) || !sepAxis(a, b, a.fz, -a.fx) || !sepAxis(a, b, b.fx, b.fz) || !sepAxis(a, b, b.fz, -b.fx)) {
      return false;
    }
    return true;
  }

  /** Un axe du test : faux s'il separe les deux rectangles, sinon garde le moins enfonce. */
  function sepAxis(a: Rect, b: Rect, nx: number, nz: number): boolean {
    const ra = a.hl * Math.abs(a.fx * nx + a.fz * nz) + a.hw * Math.abs(a.fz * nx - a.fx * nz);
    const rb = b.hl * Math.abs(b.fx * nx + b.fz * nz) + b.hw * Math.abs(b.fz * nx - b.fx * nz);
    const dist = (b.x - a.x) * nx + (b.z - a.z) * nz;
    const overlap = ra + rb - Math.abs(dist);
    if (overlap <= 0) return false;
    if (overlap < sep.depth) {
      sep.depth = overlap;
      const s = dist < 0 ? -1 : 1;
      sep.nx = nx * s;
      sep.nz = nz * s;
    }
    return true;
  }

  /** Un disque (rocher, tronc) contre le rectangle du char : on repousse le char. */
  function pushFromDisc(t: SimTank, cx: number, cz: number, radius: number): boolean {
    const fx = Math.sin(t.yaw);
    const fz = Math.cos(t.yaw);
    const dx = cx - t.x;
    const dz = cz - t.z;
    // Le centre du disque dans le repere du char, puis le point du char le plus proche.
    const along = THREE.MathUtils.clamp(dx * fx + dz * fz, -t.def.look.length * 0.48, t.def.look.length * 0.48);
    const side = THREE.MathUtils.clamp(dx * fz - dz * fx, -t.def.look.width * 0.48, t.def.look.width * 0.48);
    const px = t.x + fx * along + fz * side;
    const pz = t.z + fz * along - fx * side;
    const ox = px - cx;
    const oz = pz - cz;
    const d = Math.hypot(ox, oz);
    if (d >= radius) return false;
    // Centre du disque dans le char : on sort par le plus court chemin vers le centre du char.
    const nx = d > 1e-4 ? ox / d : t.x - cx;
    const nz = d > 1e-4 ? oz / d : t.z - cz;
    const nl = Math.hypot(nx, nz) || 1;
    t.x += (nx / nl) * (radius - d);
    t.z += (nz / nl) * (radius - d);
    return true;
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
    // Maisons : rectangle contre rectangle.
    for (const h of map.houses) {
      if (Math.abs(t.x - h.x) > h.w / 2 + r * 1.6 || Math.abs(t.z - h.z) > h.d / 2 + r * 1.6) continue;
      tankRect(t, rectA);
      rectB.x = h.x;
      rectB.z = h.z;
      rectB.fx = 0;
      rectB.fz = 1;
      rectB.hl = h.d / 2;
      rectB.hw = h.w / 2;
      if (rectOverlap(rectA, rectB)) {
        t.x -= sep.nx * sep.depth;
        t.z -= sep.nz * sep.depth;
        t.speed *= 0.4;
      }
    }
    // Murets : des rectangles fins le long du trace.
    for (const w of map.walls) {
      if (distToSegment(t.x, t.z, w.x0, w.z0, w.x1, w.z1) > r * 1.6) continue;
      const len = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
      tankRect(t, rectA);
      rectB.x = (w.x0 + w.x1) / 2;
      rectB.z = (w.z0 + w.z1) / 2;
      rectB.fx = (w.x1 - w.x0) / len;
      rectB.fz = (w.z1 - w.z0) / len;
      rectB.hl = len / 2;
      rectB.hw = 0.4;
      if (rectOverlap(rectA, rectB)) {
        t.x -= sep.nx * sep.depth;
        t.z -= sep.nz * sep.depth;
        t.speed *= 0.5;
      }
    }
    // Rochers : un disque contre le char.
    for (const rk of map.rocks) {
      if (Math.abs(t.x - rk.x) > rk.r + r * 1.6 || Math.abs(t.z - rk.z) > rk.r + r * 1.6) continue;
      if (pushFromDisc(t, rk.x, rk.z, rk.r * 0.85)) t.speed *= 0.5;
    }
    // Arbres : a plus de 5 km/h, on les couche ; sinon ils bloquent.
    for (let i = 0; i < map.trees.length; i++) {
      const tr = map.trees[i];
      if (Math.abs(t.x - tr.x) > r + 2 || Math.abs(t.z - tr.z) > r + 2) continue;
      if (treeDown[i]) continue;
      if (Math.abs(t.speed) > 1.4) {
        // Le tronc touche-t-il le char ? (sans le repousser : il va tomber)
        const fx = Math.sin(t.yaw);
        const fz = Math.cos(t.yaw);
        const dx = tr.x - t.x;
        const dz = tr.z - t.z;
        const along = Math.abs(dx * fx + dz * fz);
        const side = Math.abs(dx * fz - dz * fx);
        if (along < t.def.look.length * 0.5 + 0.4 && side < t.def.look.width * 0.5 + 0.4) {
          treeDown[i] = 1;
          events.treeFell(i, fx * Math.sign(t.speed), fz * Math.sign(t.speed));
          t.speed *= 0.82;
        }
      } else {
        pushFromDisc(t, tr.x, tr.z, 0.45);
      }
    }
    // Les autres chars (et les epaves) : on ne passe plus au travers.
    for (const o of tanks) {
      if (o === t) continue;
      if (Math.abs(t.x - o.x) > r + o.radius + 1 || Math.abs(t.z - o.z) > r + o.radius + 1) continue;
      tankRect(t, rectA);
      tankRect(o, rectB);
      if (!rectOverlap(rectA, rectB)) continue;
      // L'epave ne bouge pas ; entre deux chars vivants, chacun recule de moitie.
      const share = o.alive ? 0.5 : 1;
      t.x -= sep.nx * sep.depth * share;
      t.z -= sep.nz * sep.depth * share;
      if (o.alive) {
        o.x += sep.nx * sep.depth * (1 - share);
        o.z += sep.nz * sep.depth * (1 - share);
      }
      // Le choc freine celui qui pousse ; l'autre est un peu bouscule.
      const closing = (Math.sin(t.yaw) * t.speed - Math.sin(o.yaw) * o.speed) * sep.nx + (Math.cos(t.yaw) * t.speed - Math.cos(o.yaw) * o.speed) * sep.nz;
      if (closing > 0) {
        t.speed *= 0.35;
        if (o.alive) o.speed *= 0.7;
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
    t.aimPoint.copy(point);
    // L'artillerie tire toujours a la meme hausse : c'est la charge qui regle la portee.
    const ballistic = t.def.artyAngle !== undefined ? t.def.artyAngle * deg : (launchAngle(horiz, dy, v, shellGravityOf(t)) ?? t.def.elevation * deg);
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

  /**
   * Position et direction de tir d'une bouche. Une bouche hors de l'axe du canon
   * (rampe, paniers, minigun) vise le point de l'axe a la distance du but, comme
   * des armes reglees ensemble : sinon la salve passerait a cote.
   */
  function mouthAim(t: SimTank, mouth: THREE.Object3D, pos: THREE.Vector3, dir: THREE.Vector3) {
    mouth.getWorldPosition(pos);
    dir.set(0, 0, 1).transformDirection(mouth.matrixWorld);
    if (mouth === t.model.muzzle) return;
    t.model.gun.getWorldPosition(convPivot);
    const dist = Math.max(25, convPivot.distanceTo(t.aimPoint));
    convPivot.addScaledVector(dir, dist);
    dir.copy(convPivot).sub(pos).normalize();
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
    // Plusieurs bouches (tubes d'une rampe, deux canons, armes du char d'admin) : chacune son tour.
    const mouths = m.muzzles[t.ammo];
    const mouth = mouths && mouths.length > 0 ? mouths[t.shots % mouths.length] : m.muzzle;
    mouthAim(t, mouth, p0, tmpDir);
    const spec = t.def.ammo[t.ammo];
    const kind = projectileOf(t.def, t.ammo);
    let speed = spec.speed;
    if (t.def.artyAngle !== undefined) {
      // Artillerie : l'obus tombe dans un cercle autour du point vise (plus
      // large en mouvement), le long de la ligne ou pointe vraiment le canon.
      const dist = Math.hypot(t.aimPoint.x - p0.x, t.aimPoint.z - p0.z);
      const off = dispersionOffset((t.def.dispersion * t.bloom * aimFactor * Math.max(60, dist)) / 100, rnd);
      const yaw = Math.atan2(tmpDir.x, tmpDir.z) + Math.atan2(off.dx, Math.max(30, dist));
      const range = Math.max(20, dist + off.dy);
      const elev = Math.asin(THREE.MathUtils.clamp(tmpDir.y, -1, 1));
      tmpDir.set(Math.sin(yaw) * Math.cos(elev), Math.sin(elev), Math.cos(yaw) * Math.cos(elev));
      speed = artyShellSpeed(t, range, t.aimPoint.y - p0.y, elev);
    } else {
      // Dispersion : un point du cercle, plus souvent pres du centre.
      const radius = t.def.dispersion * t.bloom * aimFactor;
      const off = dispersionOffset(radius, rnd);
      tmpRight.crossVectors(tmpDir, up).normalize();
      tmpUp.crossVectors(tmpRight, tmpDir).normalize();
      tmpDir.addScaledVector(tmpRight, off.dx / 100).addScaledVector(tmpUp, off.dy / 100).normalize();
    }
    shells.push({
      owner: t,
      ammo: t.ammo,
      pos: p0.clone(),
      vel: tmpDir.clone().multiplyScalar(speed),
      penetration: spec.penetration,
      damage: spec.damage,
      caliber: t.def.caliber,
      age: 0,
      traveled: 0,
      gravity: shellGravityOf(t),
      splash: spec.splash ?? (AMMO[t.ammo].explosive ? (t.def.splash ?? 0) : 0),
      kind,
    });
    if (!t.def.infiniteAmmo) t.ammoLeft[t.ammo]--;
    t.lastShotAt = time;
    const clip = t.def.clip;
    if (spec.reload !== undefined) {
      // Arme a cadence propre (char d'admin) : pas de chargeur, juste son delai.
      t.reloadLeft = spec.reload;
      t.fullReload = spec.reload > 1;
      t.bloom += kind === "missile" ? 0.6 : spec.reload < 0.2 ? 0.25 : 1.2;
      t.recoil = kind === "missile" ? 0.1 : spec.reload < 0.2 ? 0.2 : 1;
    } else if (clip) {
      // Rafale : l'obus suivant arrive vite, puis tout le chargeur a recharger.
      t.clipLeft--;
      if (t.clipLeft > 0) {
        t.reloadLeft = clip.interval;
        t.fullReload = false;
      } else startFullReload(t);
      // Une roquette ne secoue presque pas le char : la salve garde sa gerbe.
      t.bloom += kind === "obus" ? 0.45 : 0.2;
      // Une roquette ne recule presque pas ; un obus secoue le canon.
      t.recoil = kind === "obus" ? 0.5 : 0.08;
    } else {
      startFullReload(t);
      t.bloom += 2.2;
      t.recoil = kind === "obus" ? 1 : 0.15;
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

  /** Pesanteur du projectile tire avec la munition en place. */
  function shellGravityOf(t: SimTank): number {
    const kind = projectileOf(t.def, t.ammo);
    // Les roquettes poussent tout le long : une trajectoire plus tendue. Le missile vole droit.
    if (kind === "roquette") return 3;
    if (kind === "missile") return 0.01;
    return t.def.shellGravity ?? SHELL_GRAVITY;
  }

  /** Charge d'artillerie pour une portee, bornee par la portee maximale du canon. */
  function artyShellSpeed(t: SimTank, range: number, dy: number, elev: number): number {
    const g = t.def.shellGravity ?? SHELL_GRAVITY;
    const angle = (elev * 180) / Math.PI;
    const vmax = artyCharge(t.def.artyRange ?? 600, 0, t.def.artyAngle ?? 45, g) ?? 200;
    const v = artyCharge(Math.min(range, t.def.artyRange ?? 600), dy, Math.max(5, angle), g);
    return Math.min(vmax * 1.05, v ?? vmax);
  }

  /** Eclats d'un obus d'artillerie : des degats autour du point d'impact, moins le blindage du toit. */
  function splashDamage(s: Shell, point: THREE.Vector3, direct: SimTank | null) {
    events.blast?.(point, s.splash);
    for (const t of tanks) {
      if (t === direct || !t.alive) continue;
      const d = Math.hypot(t.x - point.x, t.z - point.z, (t.y + 1.2 - point.y) * 0.6);
      if (d > s.splash) continue;
      const roof = Math.min(t.def.hull.top, t.def.turret.top);
      const raw = s.damage * 0.5 * (1 - d / s.splash) * (0.75 + rnd() * 0.5);
      const dmg = Math.round(Math.max(0, raw - roof * 1.2));
      if (dmg <= 0) continue;
      splashPoint.set(t.x, t.y + t.def.look.clearance + t.def.look.hullHeight, t.z);
      applyHit(s.owner, t, { outcome: "eclats", damage: dmg, effective: roof, angle: 90 }, splashPoint, "toit");
    }
  }
  const splashPoint = new THREE.Vector3();
  const steerDir = new THREE.Vector3();
  const missileDir = new THREE.Vector3();

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
      if (s.kind === "missile" && s.owner.alive && s.age > 0.15) {
        // Missile filoguide : il tourne vers le point que vise son tireur, sans perdre de vitesse.
        const speed = s.vel.length();
        steerDir.copy(s.owner.aimPoint).sub(s.pos).normalize();
        missileDir.copy(s.vel).divideScalar(speed || 1);
        const angle = missileDir.angleTo(steerDir);
        if (angle > 1e-4) missileDir.lerp(steerDir, Math.min(1, (MISSILE_TURN * dt) / angle)).normalize();
        s.vel.copy(missileDir).multiplyScalar(speed);
      } else {
        s.vel.y -= s.gravity * dt;
      }
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
          if ((res.outcome === "ricochet" || res.outcome === "bloque") && bestTank.alive && bestTank.team !== s.owner.team) bestTank.damageBlocked += s.damage;
          applyHit(s.owner, bestTank, res, tmpV, bestZone);
        } else {
          events.missed(s.owner, tmpV, wall ? "mur" : "sol");
        }
        if (s.splash > 0) splashDamage(s, tmpV, bestTank);
        shells.splice(i, 1);
        continue;
      }
      s.traveled += p0.distanceTo(p1);
      s.pos.copy(p1);
      if (s.age > 14 || Math.abs(s.pos.x) > MAP_HALF + 200 || Math.abs(s.pos.z) > MAP_HALF + 200) shells.splice(i, 1);
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
    // Aide au reperage : celui qui a repere la cible touche une part du merite.
    const spotter = target.spottedBy;
    if (dmg > 0 && spotter && spotter !== shooter && spotter.team === shooter.team) spotter.assist += dmg;
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
          if (e.spottedUntil <= time) {
            a.detections++;
            e.spottedBy = a;
          }
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

  // --- Estimation du blindage ennemi : quelle face on voit, et la chance de la percer ---
  const estDir = new THREE.Vector3();
  const estNormal = new THREE.Vector3();
  const estimate = { chance: 0, turret: false, zone: "avant" as Zone };

  /** Penetration de l'obus a cette distance (les perforants perdent un peu au loin). */
  function penAtDistance(t: SimTank, ammo: AmmoId, dist: number): number {
    const p = t.def.ammo[ammo].penetration;
    if (AMMO[ammo].explosive) return p;
    const loss = ammo === "sousCalibre" ? 0.28 : 0.16;
    return p * (1 - loss * Math.min(1, Math.max(0, dist - 100) / 400));
  }

  const faceOut = { chance: 0, zone: "avant" as Zone };

  /** Chance de percer la plaque de `e` que voit `t`, cote caisse ou tourelle (resultat partage). */
  function faceChance(t: SimTank, e: SimTank, ammo: AmmoId, dist: number, turret: boolean): typeof faceOut {
    const yaw = turret && !e.model.fixedTurret ? e.yaw + e.turretYaw : e.yaw;
    const armor = turret ? e.def.turret : e.def.hull;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    // Direction du tir dans le repere de la cible.
    const along = -(estDir.x * fx + estDir.z * fz);
    const side = -(estDir.x * fz - estDir.z * fx);
    const hl = turret ? e.def.look.turret[2] / 2 : e.def.look.length / 2;
    const hw = turret ? e.def.look.turret[0] / 2 : e.def.look.width / 2;
    let zone: Zone;
    if (Math.abs(along) / hl > Math.abs(side) / hw) {
      zone = along > 0 ? "avant" : "arriere";
      const s = zone === "avant" ? (armor.frontSlope * Math.PI) / 180 : 0;
      const sign = zone === "avant" ? 1 : -1;
      estNormal.set(fx * Math.cos(s) * sign, Math.sin(s), fz * Math.cos(s) * sign);
    } else {
      zone = "flanc";
      const s = (armor.sideSlope * Math.PI) / 180;
      const sign = side > 0 ? 1 : -1;
      estNormal.set(fz * Math.cos(s) * sign, Math.sin(s), -fx * Math.cos(s) * sign);
    }
    const e1 = effectiveArmor(estDir, estNormal, zoneThickness(armor, zone), t.def.caliber, ammo);
    faceOut.chance = e1.ricochet ? 0 : penetrationChance(penAtDistance(t, ammo, dist), e1.effective);
    faceOut.zone = zone;
    return faceOut;
  }

  /** La meilleure plaque a viser sur `e` avec cet obus. */
  function estimatePen(t: SimTank, e: SimTank, ammo: AmmoId): typeof estimate {
    const dx = e.x - t.x;
    const dz = e.z - t.z;
    const d = Math.hypot(dx, dz) || 1;
    estDir.set(dx / d, -0.02, dz / d).normalize();
    // faceChance rend un objet partage : on copie avant le second appel.
    const hull = faceChance(t, e, ammo, d, false);
    const hullChance = hull.chance;
    const hullZone = hull.zone;
    const tur = faceChance(t, e, ammo, d, true);
    estimate.turret = tur.chance > hullChance + 0.05;
    estimate.chance = Math.max(hullChance, tur.chance);
    estimate.zone = estimate.turret ? tur.zone : hullZone;
    return estimate;
  }

  /** Degats moyens attendus d'un obus contre `e` (eclats de l'explosif compris). */
  function expectedDamage(t: SimTank, e: SimTank, ammo: AmmoId): number {
    const c = estimatePen(t, e, ammo).chance;
    const dmg = t.def.ammo[ammo].damage;
    if (AMMO[ammo].explosive) return c * dmg + (1 - c) * Math.max(0, dmg * 0.5 - e.def.hull.side * 1.1) * 0.6;
    return c * dmg;
  }

  /** L'artillerie : une position de tir en retrait, et tout ennemi repere a portee. */
  function thinkArty(t: SimTank) {
    const b = t.brain!;
    b.nextThink = time + 0.5 + rnd() * 0.3;
    const range = t.def.artyRange ?? 600;
    let best: SimTank | null = null;
    let bestScore = Infinity;
    for (const e of tanks) {
      if (e.team === t.team || !e.alive || e.spottedUntil <= time) continue;
      const d = Math.hypot(e.x - t.x, e.z - t.z);
      if (d > range) continue;
      // Les cibles lentes, immobiles et abimees d'abord.
      const still = Math.abs(e.speed) < 1.5 ? 0.55 : 1;
      const score = (150 + d * 0.4) * still * (0.5 + e.hp / e.def.hp) * (e === b.target ? 0.7 : 1);
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    if (best !== b.target) {
      b.target = best;
      if (best) b.readyAt = time + diff.reaction * (1 + rnd());
    }
    if (b.target) b.lastTargetAt = time;
    // Position de tir : un peu devant sa base, de cote ; on la change quand on se fait toucher.
    const ownBase = map.bases[t.team];
    const enemyBase = map.bases[1 - t.team];
    if (Number.isNaN(b.artyX) || t.lastHitAt > b.artyAt) {
      const dx = enemyBase.x - ownBase.x;
      const dz = enemyBase.z - ownBase.z;
      const l = Math.hypot(dx, dz) || 1;
      const ahead = 45 + rnd() * 50;
      const side = (rnd() - 0.5) * 140;
      b.artyX = THREE.MathUtils.clamp(ownBase.x + (dx / l) * ahead + (-dz / l) * side, -MAP_HALF + 20, MAP_HALF - 20);
      b.artyZ = THREE.MathUtils.clamp(ownBase.z + (dz / l) * ahead + (dx / l) * side, -MAP_HALF + 20, MAP_HALF - 20);
      b.artyAt = time;
    }
    setGoal(t, b.artyX, b.artyZ);
    if (Math.hypot(t.x - b.artyX, t.z - b.artyZ) < 18) b.holdUntil = time + 1.2;
  }

  function think(t: SimTank) {
    const b = t.brain!;
    if (b.role === "artillerie") {
      thinkArty(t);
      return;
    }
    b.nextThink = time + 0.35 + rnd() * 0.2;
    // --- Cible : l'ennemi repere, visible depuis le canon, qu'on peut vraiment percer ---
    const eye = t.y + t.def.look.clearance + t.def.look.hullHeight + 1.1;
    let best: SimTank | null = null;
    let bestScore = Infinity;
    for (const e of tanks) {
      if (e.team === t.team || !e.alive || e.spottedUntil <= time) continue;
      const d = Math.hypot(e.x - t.x, e.z - t.z);
      if (d > 480) continue;
      const body = e.y + e.def.look.clearance + e.def.look.hullHeight * 0.7;
      if (!lineOfSight(map, t.x, eye, t.z, e.x, body, e.z)) continue;
      // Proche, abime, et surtout percable ; on s'acharne un peu sur la cible
      // en cours et sur celle que visent deja les allies (tir concentre).
      let pen = 0;
      for (const a of AMMO_ORDER) if (t.ammoLeft[a] > 0) pen = Math.max(pen, estimatePen(t, e, a).chance);
      let focus = 1;
      for (const o of tanks) if (o !== t && o.team === t.team && o.alive && o.brain?.target === e) focus = 0.8;
      const score = (d * (0.4 + e.hp / e.def.hp) * focus * (e === b.target ? 0.75 : 1)) / (0.12 + pen);
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    if (best !== b.target) {
      b.target = best;
      if (best) b.readyAt = time + diff.reaction * (0.8 + rnd() * 0.5);
    }
    if (b.target) {
      b.lastTargetAt = time;
      // Le meilleur obus contre cette cible (a partir de Veteran ; la recrue garde le perforant).
      if (skilled) {
        let want: AmmoId = t.ammo;
        let bestDmg = t.ammoLeft[t.ammo] > 0 ? expectedDamage(t, b.target, t.ammo) : -1;
        for (const a of AMMO_ORDER) {
          if (a === t.ammo || t.ammoLeft[a] <= 0) continue;
          const dmg = expectedDamage(t, b.target, a);
          if (dmg > bestDmg * 1.25 + 1) {
            bestDmg = dmg;
            want = a;
          }
        }
        if (want !== t.ammo && t.reloadLeft <= 0.2 && (!t.def.clip || t.clipLeft === t.def.clip.size)) {
          t.ammo = want;
          startFullReload(t);
          t.reloadLeft = t.def.reload * 0.5;
        }
      }
      // Ou viser : la plaque la plus faible visible (tourelle ou caisse).
      const est = estimatePen(t, b.target, t.ammo);
      b.pen = est.chance;
      const hx = b.target.model.hullHalf;
      const tx = b.target.model.turretHalf;
      const spread = diff.weakspots ? 0.25 : 0.7;
      if (est.turret) b.aimLocal.set((rnd() - 0.5) * tx.x * spread, hx.y + tx.y * 0.8, (rnd() - 0.5) * tx.z * spread * 0.5);
      else b.aimLocal.set((rnd() - 0.5) * hx.x * spread, (diff.weakspots ? -0.1 : rnd() - 0.4) * hx.y * 0.8, (rnd() - 0.5) * hx.z * spread * 0.5);
      // Impossible de percer de face : on contourne pour prendre le flanc.
      if (b.pen < 0.1 && skilled && time > b.flankUntil && b.role !== "embuscade") {
        b.flankUntil = time + 3.5 + rnd() * 2;
        b.flankDir = rnd() < 0.5 ? -1 : 1;
      }
      // L'eclaireur ne reste jamais immobile au contact : il tourne autour de sa cible.
      const dT = Math.hypot(b.target.x - t.x, b.target.z - t.z);
      if (b.role === "eclaireur" && dT < 220 && time > b.flankUntil) {
        b.flankUntil = time + 2 + rnd() * 1.5;
        b.flankDir = rnd() < 0.5 ? -1 : 1;
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
    // Presque detruit : on recule vers sa base et on tire de loin.
    if (t.hp < t.def.hp * 0.25 && b.role !== "eclaireur") {
      setGoal(t, ownBase.x + (t.x - ownBase.x) * 0.4, ownBase.z + (t.z - ownBase.z) * 0.4);
      if (b.target) b.holdUntil = time + 1;
      return;
    }
    // Au contact : les lourds et les chasseurs s'arretent pour tirer, les autres continuent.
    if (b.target) {
      const d = Math.hypot(b.target.x - t.x, b.target.z - t.z);
      const hold = b.role === "embuscade" || b.role === "soutien" ? 420 : b.role === "assaut" ? 260 : 120;
      // Canon en butee (cible trop bas sous une crete) : on avance au lieu d'attendre.
      if (d < hold && !t.pitchBlocked && time > b.flankUntil) {
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
    const target = b.target && b.target.alive ? b.target : null;
    const toTarget = target ? Math.atan2(target.x - t.x, target.z - t.z) : 0;
    if (time < b.reverseUntil) {
      throttle = -1;
      steer = b.reverseSteer;
    } else if (target && time < b.retreatUntil) {
      // Tir puis repli : on recule a couvert pendant le rechargement, face a l'ennemi.
      throttle = -0.9;
      steer = THREE.MathUtils.clamp(wrap(toTarget + b.angleSide * 0.4 - t.yaw) * 1.5, -1, 1);
    } else if (target && time < b.flankUntil) {
      // Contournement : on roule en travers pour prendre la cible de flanc.
      const want = toTarget + b.flankDir * 1.25;
      const d = wrap(want - t.yaw);
      steer = THREE.MathUtils.clamp(d * 2, -1, 1);
      throttle = Math.abs(d) < 1 ? 1 : 0.35;
    } else if (target && time <= b.holdUntil) {
      // A l'arret pour tirer. Chasseur (canon fixe) : la caisse vers la cible.
      // Les autres presentent leur blindage en biais (25 degres) : les obus ricochent mieux.
      const want = t.model.fixedTurret || b.role === "eclaireur" ? toTarget : toTarget + b.angleSide * 0.45;
      const d = wrap(want - t.yaw);
      if (Math.abs(d) > 0.05) steer = THREE.MathUtils.clamp(d * 2.5, -1, 1);
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

  /** Un allie coupe-t-il la ligne de tir entre le canon et le point vise ? */
  function allyInLine(t: SimTank, from: THREE.Vector3, to: THREE.Vector3): boolean {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const l2 = dx * dx + dz * dz;
    if (l2 < 1) return false;
    for (const o of tanks) {
      if (o === t || o.team !== t.team || !o.alive) continue;
      const s = ((o.x - from.x) * dx + (o.z - from.z) * dz) / l2;
      if (s <= 0 || s >= 1) continue;
      const px = from.x + dx * s - o.x;
      const pz = from.z + dz * s - o.z;
      if (px * px + pz * pz < o.radius * o.radius * 0.8) return true;
    }
    return false;
  }

  /** Artillerie : on vise le char repere en anticipant sa course pendant le vol, sans ligne de vue. */
  function botArtyGun(t: SimTank, dt: number) {
    const b = t.brain!;
    const e = b.target;
    if (!e || !e.alive || e.spottedUntil <= time - 3) {
      botAim.set(t.x + Math.sin(t.yaw) * 150, t.y, t.z + Math.cos(t.yaw) * 150);
      aimAt(t, botAim, dt);
      return;
    }
    const dist = Math.hypot(e.x - t.x, e.z - t.z);
    const angle = ((t.def.artyAngle ?? 45) * Math.PI) / 180;
    const v = artyShellSpeed(t, dist, e.y - t.y, angle);
    const flight = dist / Math.max(20, v * Math.cos(angle));
    botAim.set(e.x + Math.sin(e.yaw) * e.speed * flight * 0.8, e.y + 1, e.z + Math.cos(e.yaw) * e.speed * flight * 0.8);
    aimAt(t, botAim, dt);
    if (time < b.readyAt || t.reloadLeft > 0) return;
    t.model.gun.getWorldPosition(botGunPos);
    botDir.set(0, 0, 1).transformDirection(t.model.gun.matrixWorld);
    const off = Math.abs(wrap(Math.atan2(botAim.x - botGunPos.x, botAim.z - botGunPos.z) - Math.atan2(botDir.x, botDir.z)));
    const settled = t.bloom < 1.3 || time - b.readyAt > t.def.aimTime * 2;
    if (off < 0.02 && t.pitchError < 0.03 && settled) fire(t, diff.aimFactor);
  }

  function botGun(t: SimTank, dt: number) {
    const b = t.brain!;
    if (b.role === "artillerie") {
      botArtyGun(t, dt);
      return;
    }
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
        // Discipline de tir : pas d'obus gaspille sur un blindage imperceable
        // (la recrue tire quand meme, c'est ce qui la rend moins dangereuse).
        const worthIt = !skilled || b.pen >= 0.06;
        if (off < tolerance && t.pitchError < tolerance && settled && worthIt) {
          // Le bout du canon doit voir la cible : une crete peut cacher le tube
          // alors que le chef de char, plus haut, voit l'ennemi.
          t.model.muzzle.getWorldPosition(botGunPos);
          if (!lineOfSight(map, botGunPos.x, botGunPos.y, botGunPos.z, botAim.x, botAim.y, botAim.z)) b.readyAt = time + 0.6;
          else if (allyInLine(t, botGunPos, botAim)) {
            // Un allie dans la ligne de tir : on se decale au lieu de lui tirer dans le dos.
            b.readyAt = time + 0.5;
            if (time > b.flankUntil) {
              b.flankUntil = time + 1.5;
              b.flankDir = -b.flankDir;
            }
          } else {
            fire(t, diff.aimFactor);
            // Tir puis repli : les gros canons lents et les chargeurs vides reculent a couvert.
            if (b.role !== "eclaireur" && (t.fullReload && t.reloadLeft > 5)) b.retreatUntil = time + (t.def.clip ? 2 : 1.2);
          }
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
    timeLeft = Math.max(0, battleSeconds - time);
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
    const mouths = m.muzzles[t.ammo];
    const mouth = mouths && mouths.length > 0 ? mouths[0] : m.muzzle;
    mouthAim(t, mouth, p0, tmpDir);
    const arty = t.def.artyAngle !== undefined;
    const slow = projectileOf(t.def, t.ammo) !== "obus";
    const g = shellGravityOf(t);
    const v = arty
      ? artyShellSpeed(t, Math.hypot(t.aimPoint.x - p0.x, t.aimPoint.z - p0.z), t.aimPoint.y - p0.y, Math.asin(THREE.MathUtils.clamp(tmpDir.y, -1, 1)))
      : t.def.ammo[t.ammo].speed;
    const vel = tmpV2.copy(tmpDir).multiplyScalar(v);
    // On suit la trajectoire par pas de 0,05 s (40 m environ) ; plus longtemps pour l'artillerie,
    // les roquettes et les missiles, plus lents.
    const dt = arty || slow ? 0.08 : 0.05;
    const steps = arty ? 160 : slow ? 60 : 40;
    for (let k = 0; k < steps; k++) {
      p1.copy(p0).addScaledVector(vel, dt);
      vel.y -= g * dt;
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
