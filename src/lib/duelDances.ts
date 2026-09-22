import * as THREE from "three";
import type { AnimatedModel } from "./models3d";
import type { Rarity } from "./duelProfile";

/**
 * Les danses du Duel.
 *
 * Le soldat anime (CC0) ne sait que courir, tirer et saluer : aucune danse
 * dans le fichier. Elles sont donc ecrites ici, en code, os par os, a la
 * maniere d'une choregraphie : a chaque instant, chaque os du squelette
 * tourne d'un certain angle par rapport a sa position de repos.
 *
 * Les angles sont donnes autour des axes du MONDE vus depuis le personnage au
 * repos (il regarde vers +Z, +Y vers le haut, sa gauche vers +X), puis
 * convertis dans le repere propre de chaque os. Ecrire « leve le bras droit
 * sur le cote » devient : UpperArm.R, -90 degres autour de Z.
 */

export type DanceId =
  | "salut"
  | "robot"
  | "disco"
  | "floss"
  | "fiesta"
  | "champion"
  | "ressort"
  | "pantin"
  | "vague"
  | "moonwalk"
  | "tourbillon"
  | "carton";

export interface Dance {
  id: DanceId;
  name: string;
  rarity: Rarity;
  price: number;
  tagline: string;
  /** Duree d'une boucle, en secondes. */
  loop: number;
  /** Animation du fichier a jouer telle quelle (le salut), sinon choregraphie en code. */
  clip?: string;
  /** Choregraphie : pose le squelette a l'instant t (secondes depuis le debut). */
  pose?: (rig: DanceRig, t: number) => void;
}

/** Ce qu'une choregraphie peut faire au squelette. */
export interface DanceRig {
  /** Tourne un os (angles en radians, autour des axes du monde au repos, appliques X puis Y puis Z). */
  turn(bone: string, x: number, y: number, z: number): void;
  /** Decale le personnage entier (sauts, balancement des hanches), en metres. */
  shift(x: number, y: number, z: number): void;
  /** Rotation du personnage entier sur lui-meme. */
  spin(yaw: number): void;
}

const S = Math.sin;
const C = Math.cos;
const TAU = Math.PI * 2;
/** Temps quantifie : pour les gestes secs du robot. */
const snap = (v: number, steps: number) => Math.round(v * steps) / steps;

export const DANCES: Record<DanceId, Dance> = {
  salut: {
    id: "salut",
    name: "Salut",
    rarity: "commun",
    price: 0,
    tagline: "Un signe de la main. Poli, toujours.",
    loop: 2.2,
    clip: "Wave",
  },
  robot: {
    id: "robot",
    name: "Robot",
    rarity: "rare",
    price: 500,
    tagline: "Bip. Bip. Pas de hanche.",
    loop: 2.4,
    pose(rig, t) {
      const p = (t % 2.4) / 2.4;
      const step = snap(p, 8);
      const armA = step < 0.5 ? 1 : 0;
      // Les avant-bras a l'equerre, qui montent et descendent a tour de role.
      rig.turn("UpperArm.R", -0.25, 0, -0.35);
      rig.turn("UpperArm.L", -0.25, 0, 0.35);
      rig.turn("LowerArm.R", -1.5 + armA * 0.7, 0, 0);
      rig.turn("LowerArm.L", -1.5 + (1 - armA) * 0.7, 0, 0);
      rig.turn("Wrist.R", 0, 0, -0.6 * armA);
      rig.turn("Wrist.L", 0, 0, 0.6 * (1 - armA));
      // La tete et le buste pivotent par crans.
      rig.turn("Head", 0, snap(S(p * TAU), 2) * 0.6, 0);
      rig.turn("Chest", 0, -snap(S(p * TAU), 2) * 0.25, 0);
      rig.shift(0, Math.abs(snap(S(p * TAU * 2), 1)) * 0.03, 0);
    },
  },
  disco: {
    id: "disco",
    name: "Disco",
    rarity: "rare",
    price: 600,
    tagline: "L'index vers le ciel, puis vers le sol.",
    loop: 1.6,
    pose(rig, t) {
      const b = S((t / 1.6) * TAU);
      // Bras droit en diagonale : en haut a droite, puis en bas a gauche.
      rig.turn("UpperArm.R", -0.6 * b, 0, -1.2 - b * 1.4);
      rig.turn("LowerArm.R", 0, 0, -0.1);
      rig.turn("UpperArm.L", 0, 0, 0.5);
      rig.turn("LowerArm.L", -1.4, 0, 0);
      rig.turn("Hips", 0, b * 0.25, b * 0.08);
      rig.turn("Chest", 0, -b * 0.3, 0);
      rig.turn("Head", 0.1, b * 0.3, 0);
      rig.turn("UpperLeg.R", 0, 0, -Math.max(0, b) * 0.12);
      rig.turn("UpperLeg.L", 0, 0, Math.max(0, -b) * 0.12);
      rig.shift(b * 0.05, Math.abs(S((t / 1.6) * TAU * 2)) * 0.04, 0);
    },
  },
  floss: {
    id: "floss",
    name: "Floss",
    rarity: "epique",
    price: 1000,
    tagline: "Les bras passent devant, puis derriere. Tres vite.",
    loop: 0.9,
    pose(rig, t) {
      const phase = (t / 0.9) * TAU;
      const side = S(phase);
      const frontBack = C(phase * 2);
      // Les deux bras tendus vont du meme cote, l'un devant, l'autre derriere.
      rig.turn("UpperArm.R", frontBack * 0.5, 0, -0.35 + side * 0.55);
      rig.turn("UpperArm.L", -frontBack * 0.5, 0, 0.35 + side * 0.55);
      rig.turn("LowerArm.R", 0, 0, 0);
      rig.turn("LowerArm.L", 0, 0, 0);
      // Les hanches partent a l'oppose.
      rig.turn("Hips", 0, 0, -side * 0.18);
      rig.turn("Chest", 0, 0, side * 0.12);
      rig.shift(-side * 0.07, 0, 0);
    },
  },
  fiesta: {
    id: "fiesta",
    name: "Fiesta",
    rarity: "epique",
    price: 1200,
    tagline: "Bras devant, mains sur la tete, tour sur soi. Olé.",
    loop: 4,
    pose(rig, t) {
      const p = (t % 4) / 4;
      const beat = Math.floor(p * 8);
      // Huit temps : chaque temps ajoute un geste, comme la chanson.
      const rFront = beat >= 1 ? 1 : 0;
      const lFront = beat >= 2 ? 1 : 0;
      const rHead = beat >= 5 ? 1 : 0;
      const lHead = beat >= 6 ? 1 : 0;
      rig.turn("UpperArm.R", -1.5 * rFront + 1.2 * rHead, 0, -0.2 - rHead * 1.1);
      rig.turn("LowerArm.R", -rHead * 2.2, 0, 0);
      rig.turn("UpperArm.L", -1.5 * lFront + 1.2 * lHead, 0, 0.2 + lHead * 1.1);
      rig.turn("LowerArm.L", -lHead * 2.2, 0, 0);
      const sway = S(t * TAU * 2);
      rig.turn("Hips", 0, 0, sway * 0.14);
      rig.shift(sway * 0.06, 0, 0);
      // Dernier temps : un quart de tour sur soi.
      if (beat === 7) rig.spin(((p * 8 - 7) * Math.PI) / 2);
    },
  },
  champion: {
    id: "champion",
    name: "Champion",
    rarity: "legendaire",
    price: 2000,
    tagline: "Les poings au ciel, sauts de victoire et tour d'honneur.",
    loop: 2,
    pose(rig, t) {
      const phase = (t / 2) * TAU;
      const hop = Math.abs(S(phase * 2));
      // Les deux poings montent et redescendent au rythme des sauts.
      const pump = 0.5 + 0.5 * S(phase * 2);
      rig.turn("UpperArm.R", 0, 0, -2.4 - pump * 0.4);
      rig.turn("UpperArm.L", 0, 0, 2.4 + pump * 0.4);
      rig.turn("LowerArm.R", 0, 0, -0.6 * pump);
      rig.turn("LowerArm.L", 0, 0, 0.6 * pump);
      rig.turn("Head", -0.35, 0, 0);
      rig.turn("Chest", -0.15, 0, 0);
      rig.turn("UpperLeg.R", -hop * 0.35, 0, 0);
      rig.turn("UpperLeg.L", -hop * 0.35, 0, 0);
      rig.turn("LowerLeg.R", hop * 0.6, 0, 0);
      rig.turn("LowerLeg.L", hop * 0.6, 0, 0);
      rig.shift(0, hop * 0.28, 0);
      rig.spin(S(phase * 0.5) * 0.6);
    },
  },
  ressort: {
    id: "ressort",
    name: "Ressort",
    rarity: "commun",
    price: 400,
    tagline: "Des petits bonds, les genoux souples. Impossible a arreter.",
    loop: 1.2,
    pose(rig, t) {
      const phase = (t / 1.2) * TAU;
      const hop = Math.abs(S(phase));
      const cote = S(phase / 2);
      rig.turn("UpperLeg.R", -hop * 0.5, 0, 0);
      rig.turn("UpperLeg.L", -hop * 0.5, 0, 0);
      rig.turn("LowerLeg.R", hop * 0.9, 0, 0);
      rig.turn("LowerLeg.L", hop * 0.9, 0, 0);
      rig.turn("UpperArm.R", -hop * 0.7, 0, -0.5);
      rig.turn("UpperArm.L", -hop * 0.7, 0, 0.5);
      rig.turn("Head", hop * 0.2 - 0.1, cote * 0.2, 0);
      rig.shift(0, hop * 0.22, 0);
    },
  },
  pantin: {
    id: "pantin",
    name: "Pantin",
    rarity: "commun",
    price: 450,
    tagline: "Les bras retombent comme s'ils etaient tenus par des fils.",
    loop: 2,
    pose(rig, t) {
      const p = (t % 2) / 2;
      // Un fil tire, l'autre lache : les deux cotes sont toujours decales.
      const tire = Math.max(0, S(p * TAU));
      const lache = Math.max(0, -S(p * TAU));
      rig.turn("UpperArm.R", 0, 0, -0.3 - tire * 2.2);
      rig.turn("UpperArm.L", 0, 0, 0.3 + lache * 2.2);
      rig.turn("LowerArm.R", -tire * 1.2, 0, 0);
      rig.turn("LowerArm.L", -lache * 1.2, 0, 0);
      rig.turn("Head", 0.15 - tire * 0.4, (tire - lache) * 0.35, 0);
      rig.turn("Chest", 0, (lache - tire) * 0.2, 0);
      rig.turn("UpperLeg.R", 0, 0, -tire * 0.25);
      rig.turn("UpperLeg.L", 0, 0, lache * 0.25);
      rig.shift(0, (tire + lache) * 0.05, 0);
    },
  },
  vague: {
    id: "vague",
    name: "Vague",
    rarity: "rare",
    price: 700,
    tagline: "L'onde part d'une main, traverse le corps, ressort par l'autre.",
    loop: 2.4,
    pose(rig, t) {
      const phase = (t / 2.4) * TAU;
      // Chaque os reprend la meme onde, avec un retard : c'est ce decalage
      // qui donne l'illusion que quelque chose traverse le corps.
      const onde = (retard: number) => S(phase - retard);
      rig.turn("UpperArm.R", 0, 0, -1.5 - onde(0) * 0.6);
      rig.turn("LowerArm.R", 0, 0, -onde(0.5) * 0.8);
      rig.turn("Chest", 0, 0, onde(1) * 0.3);
      rig.turn("Head", onde(1.3) * 0.2, 0, onde(1.3) * 0.25);
      rig.turn("UpperArm.L", 0, 0, 1.5 + onde(2) * 0.6);
      rig.turn("LowerArm.L", 0, 0, onde(2.4) * 0.8);
      rig.turn("Hips", 0, 0, -onde(1) * 0.12);
      rig.shift(onde(1) * 0.05, 0, 0);
    },
  },
  moonwalk: {
    id: "moonwalk",
    name: "Glisse arrière",
    rarity: "epique",
    price: 1400,
    tagline: "Les pieds glissent en arriere, le corps reste devant.",
    loop: 1.6,
    pose(rig, t) {
      const phase = (t / 1.6) * TAU;
      const pied = S(phase);
      // Un pied racle le sol pendant que l'autre se souleve sur la pointe.
      rig.turn("UpperLeg.R", -pied * 0.55, 0, 0);
      rig.turn("LowerLeg.R", Math.max(0, pied) * 0.9, 0, 0);
      rig.turn("UpperLeg.L", pied * 0.55, 0, 0);
      rig.turn("LowerLeg.L", Math.max(0, -pied) * 0.9, 0, 0);
      rig.turn("UpperArm.R", -0.2, 0, -0.75 + pied * 0.2);
      rig.turn("UpperArm.L", -0.2, 0, 0.75 - pied * 0.2);
      rig.turn("Chest", 0.1, 0, 0);
      rig.turn("Head", -0.12, pied * 0.15, 0);
      rig.shift(0, Math.abs(pied) * 0.03, pied * 0.08);
    },
  },
  tourbillon: {
    id: "tourbillon",
    name: "Tourbillon",
    rarity: "epique",
    price: 1600,
    tagline: "Bras tendus, un tour complet, et on repart.",
    loop: 2.8,
    pose(rig, t) {
      const p = (t % 2.8) / 2.8;
      const tour = p < 0.6 ? (p / 0.6) * TAU : TAU;
      const ouvert = p < 0.6 ? 1 : 0.35;
      rig.turn("UpperArm.R", 0, 0, -1.55 * ouvert);
      rig.turn("UpperArm.L", 0, 0, 1.55 * ouvert);
      rig.turn("LowerArm.R", 0, 0, -0.2);
      rig.turn("LowerArm.L", 0, 0, 0.2);
      rig.turn("Head", -0.1, S(p * TAU) * 0.3, 0);
      rig.turn("Chest", 0, 0, S(p * TAU * 2) * 0.12);
      rig.turn("UpperLeg.R", 0, 0, -0.1 * ouvert);
      rig.turn("UpperLeg.L", 0, 0, 0.1 * ouvert);
      rig.spin(tour);
      rig.shift(0, p < 0.6 ? 0.03 : 0, 0);
    },
  },
  carton: {
    id: "carton",
    name: "Carton rouge",
    rarity: "legendaire",
    price: 2400,
    tagline: "Il sort le carton, le leve bien haut, et se detourne.",
    loop: 3.2,
    pose(rig, t) {
      const p = (t % 3.2) / 3.2;
      // Trois temps : on sort le carton, on le brandit, on tourne le dos.
      const sortie = Math.min(1, p / 0.25);
      const brandi = p > 0.25 ? Math.min(1, (p - 0.25) / 0.2) : 0;
      const dos = p > 0.7 ? Math.min(1, (p - 0.7) / 0.25) : 0;
      rig.turn("UpperArm.R", -0.4 * sortie - brandi * 1.1, 0, -0.3 - brandi * 1.5);
      rig.turn("LowerArm.R", -1.3 * sortie + brandi * 0.9, 0, 0);
      rig.turn("Wrist.R", 0, 0, -0.4 * brandi);
      rig.turn("UpperArm.L", 0, 0, 0.35);
      rig.turn("LowerArm.L", -0.5, 0, 0);
      rig.turn("Head", -0.25 * brandi, 0.3 * dos, 0);
      rig.turn("Chest", -0.1 * brandi, 0.35 * dos, 0);
      rig.spin(dos * Math.PI * 0.9);
      rig.shift(0, brandi * 0.04, 0);
    },
  },
};

export const DANCE_ORDER: DanceId[] = [
  "salut", "ressort", "pantin",
  "robot", "disco", "vague",
  "floss", "fiesta", "moonwalk", "tourbillon",
  "champion", "carton",
];

/** Os que les choregraphies touchent : on les remet au repos a chaque image. */
const DANCE_BONES = [
  "Hips",
  "Abdomen",
  "Torso",
  "Chest",
  "Neck",
  "Head",
  "UpperArm.L",
  "LowerArm.L",
  "Wrist.L",
  "UpperArm.R",
  "LowerArm.R",
  "Wrist.R",
  "UpperLeg.L",
  "LowerLeg.L",
  "UpperLeg.R",
  "LowerLeg.R",
];

export interface Dancer {
  /** Lance une danse (null : reprend les animations normales). */
  start(id: DanceId | null): void;
  /** La danse en cours, ou null. */
  readonly current: DanceId | null;
  /** A appeler a chaque image APRES model.update() : pose le squelette. */
  update(delta: number): void;
}

/**
 * Prepare un soldat anime a danser. La pose de repos est lue une seule fois
 * (animation « Idle_Neutral ») : chaque os garde son orientation locale et
 * l'orientation du monde qui permet de traduire les axes.
 */
export function createDancer(model: AnimatedModel): Dancer {
  const rest = new Map<string, { bone: THREE.Object3D; local: THREE.Quaternion; toLocal: THREE.Quaternion; pos: THREE.Vector3 }>();
  let current: DanceId | null = null;
  let time = 0;
  let baseY = 0;
  let baseX = 0;
  let baseZ = 0;
  let baseYaw = 0;
  let captured = false;

  function capture() {
    const wasCurrent = model.current;
    model.mixer.stopAllAction();
    model.current = null;
    model.play("Idle_Neutral", { fade: 0 });
    model.update(0.001);
    model.root.updateMatrixWorld(true);
    const rootQ = model.root.getWorldQuaternion(new THREE.Quaternion());
    for (const name of DANCE_BONES) {
      const bone = model.bone(name);
      if (!bone) continue;
      // Axe du monde (dans le repere du personnage) vers le repere local de l'os.
      const boneWorld = bone.getWorldQuaternion(new THREE.Quaternion());
      const toLocal = rootQ.clone().invert().multiply(boneWorld).invert();
      rest.set(name, { bone, local: bone.quaternion.clone(), toLocal, pos: bone.position.clone() });
    }
    if (wasCurrent && wasCurrent !== "Idle_Neutral") {
      model.current = null;
      model.play(wasCurrent, { fade: 0 });
    }
    captured = true;
  }

  const axis = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const rig: DanceRig = {
    turn(name, x, y, z) {
      const r = rest.get(name);
      if (!r) return;
      const bone = r.bone;
      for (const [ax, ay, az, angle] of [
        [1, 0, 0, x],
        [0, 1, 0, y],
        [0, 0, 1, z],
      ] as const) {
        if (angle === 0) continue;
        axis.set(ax, ay, az).applyQuaternion(r.toLocal);
        q.setFromAxisAngle(axis, angle);
        bone.quaternion.multiply(q);
      }
    },
    shift(x, y, z) {
      model.root.position.set(baseX + x, baseY + y, baseZ + z);
    },
    spin(yaw) {
      model.root.rotation.y = baseYaw + yaw;
    },
  };

  return {
    get current() {
      return current;
    },
    start(id) {
      if (!captured) capture();
      if (current && !id) {
        // Fin de danse : le personnage revient a sa place, et la prochaine
        // animation demandee repartira vraiment (le modele croyait encore
        // jouer celle d'avant la danse).
        model.root.position.set(baseX, baseY, baseZ);
        model.root.rotation.y = baseYaw;
        for (const r of rest.values()) r.bone.quaternion.copy(r.local);
        model.current = null;
      }
      current = id;
      time = 0;
      if (id) {
        baseX = model.root.position.x;
        baseY = model.root.position.y;
        baseZ = model.root.position.z;
        baseYaw = model.root.rotation.y;
        const dance = DANCES[id];
        if (dance.clip) model.play(dance.clip, { fade: 0.15 });
        else {
          model.mixer.stopAllAction();
          model.current = null;
        }
      }
    },
    update(delta) {
      if (!current) return;
      time += delta;
      const dance = DANCES[current];
      if (dance.clip || !dance.pose) return;
      // Chaque image repart de la pose de repos : les angles ne s'accumulent pas.
      for (const r of rest.values()) r.bone.quaternion.copy(r.local);
      model.root.position.set(baseX, baseY, baseZ);
      model.root.rotation.y = baseYaw;
      dance.pose(rig, time);
    },
  };
}
