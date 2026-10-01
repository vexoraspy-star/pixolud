import * as THREE from "three";
import { AMMO_ORDER, tankById, type AmmoId, type BattleMode, type Difficulty, type ProjectileKind } from "./tankDefs";
import type { MapId } from "./tankTerrain";
import type { Outcome, Zone } from "./tankBallistics";
import { withBonus, type TankBonus } from "./tankCareer";
import type { Battle, BattleEnd, BattleEvents, LineupSlot, PlayerInput } from "./tankSim";

// Le multijoueur de « Tonnerre d'Acier » : l'hote fait tourner toute la bataille
// (bots compris) et diffuse son etat quelques fois par seconde ; chaque invite
// envoie ses commandes et rejoue l'etat recu (voir tankPuppet). Ce module ne
// contient que le format des messages, compact pour menager le canal temps reel.

/** Etats diffuses par l'hote chaque seconde. */
export const NET_HZ = 8;
/** Valeurs par char dans un etat (voir encodeSnapshot). */
export const TANK_FIELDS = 12;
/** Valeurs par projectile dans un etat. */
export const SHELL_FIELDS = 11;
/** Au-dela, un salon est complet. */
export const ROOM_MAX = 8;

export const KINDS: ProjectileKind[] = ["obus", "roquette", "missile"];
const OUTCOMES: Outcome[] = ["penetration", "ricochet", "bloque", "eclats"];
const ZONES: Zone[] = ["avant", "flanc", "arriere", "toit", "dessous"];

/** Une place de la bataille telle qu'elle voyage sur le reseau. */
export interface NetSlot {
  defId: string;
  team: 0 | 1;
  name: string;
  human: string | null;
  camo: string | null;
  bonus: TankBonus | null;
}

/** Le signal de depart : tout ce qu'il faut pour monter la meme bataille partout. */
export interface RoomStart {
  /** Numero de la bataille (un invite ignore un depart deja recu). */
  id: number;
  seed: number;
  mapId: MapId;
  mode: BattleMode;
  difficulty: Difficulty;
  teams: "coop" | "pvp";
  lineup: NetSlot[];
}

/** Commandes d'un invite : throttle, steer, tir (0/1), munition (0 a 2), puis le point vise (x, y, z) s'il y en a un. */
export interface NetInput {
  k: string;
  c: number[];
}

/**
 * Un evenement de la bataille, horodate (temps de l'hote) :
 * tir ["s", t, char, mx, my, mz, dx, dy, dz], impact ["h", t, tireur, cible, issue, degats, epaisseur, angle, px, py, pz, zone, obus],
 * manque ["m", t, tireur, px, py, pz, mur?, obus], destruction ["d", t, cible, tireur ou -1], arbre ["a", t, indice, dx, dz],
 * eclatement ["b", t, px, py, pz, rayon, obus], culasse ["r", t, char]. « obus » : numero du projectile qui s'arrete (-1 : aucun).
 */
export type NetEvent = (string | number)[];

/** Etat de la bataille diffuse par l'hote. */
export interface NetSnapshot {
  /** Temps de l'hote. */
  t: number;
  /** Temps restant. */
  tl: number;
  /** Points de capture de chaque base, puis nombre de chars dans chaque cercle. */
  cp: number[];
  /** Chars dans l'ordre des id, TANK_FIELDS valeurs chacun. */
  k: number[];
  /** Joueurs humains : [id, rechargement, complet, chargeur, munition, restes x3, dispersion, tirs, touches, percees, recus, bloques, aide, reperes, tourelle]. */
  h: number[][];
  /** Projectiles en vol, SHELL_FIELDS valeurs chacun : numero, x, y, z, vx, vy, vz, sorte, tireur, pesanteur, age. */
  s: number[];
  /** Evenements depuis l'etat precedent. */
  e: NetEvent[];
  /** Fin de la bataille : vainqueur, raison. */
  f?: [number, string];
  /** La bataille n'a pas encore commence (l'hote attend les joueurs). */
  w?: number;
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Les places recues, avec le char de chacun (modules et commandant compris). */
export function resolveLineup(slots: NetSlot[]): LineupSlot[] {
  return slots.map((s) => ({ def: withBonus(tankById(s.defId), s.bonus), team: s.team, name: s.name, human: s.human, camo: s.camo }));
}

/** Les places a envoyer (le char par son identifiant ; le bonus des humains a part). */
export function lineupToNet(slots: LineupSlot[], bonusOf: (key: string) => TankBonus | null): NetSlot[] {
  return slots.map((s) => ({ defId: s.def.id, team: s.team, name: s.name, human: s.human, camo: s.camo ?? null, bonus: s.human ? bonusOf(s.human) : null }));
}

/**
 * Chez l'hote : les evenements de la bataille vont a la scene comme d'habitude,
 * et une copie compacte part dans `outbox` pour les invites.
 */
export function recordEvents(scene: BattleEvents, outbox: NetEvent[], now: () => number): BattleEvents {
  return {
    shot: (t, m, d) => {
      outbox.push(["s", r3(now()), t.id, r2(m.x), r2(m.y), r2(m.z), r3(d.x), r3(d.y), r3(d.z)]);
      scene.shot(t, m, d);
    },
    hit: (shooter, target, res, p, zone, shell = -1) => {
      outbox.push(["h", r3(now()), shooter.id, target.id, OUTCOMES.indexOf(res.outcome), res.damage, Math.round(res.effective), Math.round(res.angle), r2(p.x), r2(p.y), r2(p.z), ZONES.indexOf(zone), shell]);
      scene.hit(shooter, target, res, p, zone, shell);
    },
    missed: (shooter, p, kind, shell = -1) => {
      outbox.push(["m", r3(now()), shooter.id, r2(p.x), r2(p.y), r2(p.z), kind === "mur" ? 1 : 0, shell]);
      scene.missed(shooter, p, kind, shell);
    },
    destroyed: (target, by) => {
      outbox.push(["d", r3(now()), target.id, by ? by.id : -1]);
      scene.destroyed(target, by);
    },
    treeFell: (index, dx, dz) => {
      outbox.push(["a", r3(now()), index, r3(dx), r3(dz)]);
      scene.treeFell(index, dx, dz);
    },
    reloaded: (t) => {
      outbox.push(["r", r3(now()), t.id]);
      scene.reloaded(t);
    },
    blast: (p, radius, shell = -1) => {
      outbox.push(["b", r3(now()), r2(p.x), r2(p.y), r2(p.z), r1(radius), shell]);
      scene.blast?.(p, radius, shell);
    },
  };
}

/** L'etat de la bataille a diffuser (vide la boite des evenements). */
export function encodeSnapshot(b: Battle, outbox: NetEvent[], waiting = false): NetSnapshot {
  const t = b.time();
  const k: number[] = [];
  const h: number[][] = [];
  for (const tk of b.tanks) {
    k.push(
      r2(tk.x),
      r2(tk.z),
      r3(tk.yaw),
      r3(tk.turretYaw),
      r3(tk.gunPitch),
      Math.round(tk.hp),
      tk.alive ? 1 : 0,
      r1(Math.max(0, tk.spottedUntil - t)),
      r1(tk.speed),
      tk.kills,
      Math.round(tk.damageDealt),
      AMMO_ORDER.indexOf(tk.ammo),
    );
    if (tk.human) {
      h.push([
        tk.id,
        r2(tk.reloadLeft),
        tk.fullReload ? 1 : 0,
        tk.clipLeft,
        AMMO_ORDER.indexOf(tk.ammo),
        tk.ammoLeft.perforant,
        tk.ammoLeft.sousCalibre,
        tk.ammoLeft.explosif,
        r2(tk.bloom),
        tk.shots,
        tk.hits,
        tk.pens,
        Math.round(tk.damageTaken),
        Math.round(tk.damageBlocked),
        Math.round(tk.assist),
        tk.detections,
        r2(tk.turretRate),
      ]);
    }
  }
  const s: number[] = [];
  for (const sh of b.shells) {
    s.push(sh.id, r2(sh.pos.x), r2(sh.pos.y), r2(sh.pos.z), r2(sh.vel.x), r2(sh.vel.y), r2(sh.vel.z), KINDS.indexOf(sh.kind), sh.owner.id, r2(sh.gravity), r3(sh.age));
  }
  const cap = b.capture;
  const snap: NetSnapshot = {
    t: r3(t),
    tl: r1(b.timeLeft),
    cp: [r1(cap.points[0]), r1(cap.points[1]), cap.cappers[0], cap.cappers[1]],
    k,
    h,
    s,
    e: outbox.splice(0),
  };
  if (b.ended) snap.f = [b.ended.winner, b.ended.reason];
  if (waiting) snap.w = 1;
  return snap;
}

/** Les commandes d'un invite, a envoyer. */
export function encodeInput(key: string, input: PlayerInput): NetInput {
  const c = [r2(input.throttle), r2(input.steer), input.fire ? 1 : 0, AMMO_ORDER.indexOf(input.ammo)];
  if (input.aim) c.push(r2(input.aim.x), r2(input.aim.y), r2(input.aim.z));
  return { k: key, c };
}

/** Les commandes recues d'un invite (`aim` reutilise le vecteur de `out`). */
export function decodeInput(msg: NetInput, out: PlayerInput, aim: THREE.Vector3): PlayerInput {
  const c = msg.c;
  out.throttle = THREE.MathUtils.clamp(Number(c[0]) || 0, -1, 1);
  out.steer = THREE.MathUtils.clamp(Number(c[1]) || 0, -1, 1);
  out.fire = c[2] === 1;
  out.ammo = (AMMO_ORDER[Number(c[3])] ?? "perforant") as AmmoId;
  out.aim = c.length >= 7 ? aim.set(Number(c[4]) || 0, Number(c[5]) || 0, Number(c[6]) || 0) : null;
  return out;
}

export function outcomeAt(i: number): Outcome {
  return OUTCOMES[i] ?? "bloque";
}

export function zoneAt(i: number): Zone {
  return ZONES[i] ?? "avant";
}

/** La fin telle que la voit un joueur de l'equipe `myTeam` (les equipes sont renumerotees chez lui). */
export function endFor(f: [number, string], swap: boolean): BattleEnd {
  const w = f[0] === -1 ? -1 : swap ? 1 - f[0] : f[0];
  const reason = (["destruction", "capture", "temps", "hote"].includes(f[1]) ? f[1] : "temps") as BattleEnd["reason"];
  return { winner: w as BattleEnd["winner"], reason };
}

/** Code de salon : cinq lettres sans les confusions (I, O, 0, 1). */
export function roomCode(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 5; i++) code += letters[Math.floor(Math.random() * letters.length)];
  return code;
}
