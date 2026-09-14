import * as THREE from "three";

// Les entites des Backrooms.
//
//  - La BACTERIE : une silhouette noire de 2,6 m, filiforme, herissee de
//    pointes. Elle ne marche pas comme un humain : ses membres avancent par
//    saccades, sa tete se tord d'un coup vers ce qu'elle entend.
//  - Le SOURIANT : on ne voit jamais son corps. Deux yeux et un sourire trop
//    large qui flottent dans le noir, et qui s'elargit quand il fonce.
//  - L'EGARE : une silhouette immobile au bout d'un couloir, hallucination
//    du niveau 0 quand la lucidite lache. Elle disparait quand on la fixe.
//
// Materiaux Lambert ou Basic seulement, et les petits morceaux figes entre
// eux (pointes, dents) sont instancies : un appel de rendu par paquet.

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitCone = new THREE.ConeGeometry(0.5, 1, 5);
unitCone.translate(0, 0.5, 0);

interface Piece {
  pos: [number, number, number];
  size: [number, number, number];
  rot?: [number, number, number];
}

function cluster(geo: THREE.BufferGeometry, mat: THREE.Material, pieces: Piece[]): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geo, mat, pieces.length);
  const m = new THREE.Matrix4();
  const e = new THREE.Euler();
  const q = new THREE.Quaternion();
  pieces.forEach((p, i) => {
    e.set(p.rot?.[0] ?? 0, p.rot?.[1] ?? 0, p.rot?.[2] ?? 0);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(...p.pos), q, new THREE.Vector3(...p.size));
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

// ---------------------------------------------------------------------------
// La Bacterie
// ---------------------------------------------------------------------------

export interface BacteriaParts {
  group: THREE.Group;
  body: THREE.Group;
  chest: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  arms: { shoulder: THREE.Group; elbow: THREE.Group; wrist: THREE.Group; side: number }[];
  legs: { hip: THREE.Group; knee: THREE.Group; side: number }[];
  /** Decalages de saccade, tires au hasard et tenus quelques centiemes de seconde. */
  twitch: { until: number; head: [number, number, number]; arms: number[] };
  dispose: () => void;
}

export function buildBacteria(): BacteriaParts {
  const owned: (THREE.BufferGeometry | THREE.Material)[] = [];
  const skin = new THREE.MeshLambertMaterial({ color: 0x0a0a0b });
  const sheen = new THREE.MeshLambertMaterial({ color: 0x1b1a1d });
  owned.push(skin, sheen);

  function limb(radius: number, length: number, mat: THREE.Material = skin): THREE.Mesh {
    const geo = new THREE.CapsuleGeometry(radius, length, 3, 6);
    owned.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = -length / 2;
    return mesh;
  }

  const group = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 1.32;
  group.add(body);

  // Bassin et colonne : une tige, pas un torse.
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), skin);
  pelvis.scale.set(1.2, 0.7, 0.9);
  owned.push(pelvis.geometry);
  body.add(pelvis);

  const chest = new THREE.Group();
  chest.position.y = 0.05;
  body.add(chest);
  const spineGeo = new THREE.CapsuleGeometry(0.07, 0.62, 3, 6);
  owned.push(spineGeo);
  const spine = new THREE.Mesh(spineGeo, skin);
  spine.position.y = 0.36;
  chest.add(spine);
  // Cage thoracique etroite et saillante.
  chest.add(
    cluster(unitBox, sheen, [
      ...[0.42, 0.52, 0.62, 0.72].flatMap((y, i): Piece[] => [
        { pos: [0.1, y, 0.04], size: [0.16 - i * 0.01, 0.025, 0.05], rot: [0, 0.4, -0.3] },
        { pos: [-0.1, y, 0.04], size: [0.16 - i * 0.01, 0.025, 0.05], rot: [0, -0.4, 0.3] },
      ]),
      { pos: [0, 0.8, 0], size: [0.46, 0.05, 0.08] },
    ]),
  );
  // Pointes le long du dos : c'est ce qui la rend reconnaissable de loin.
  const backSpikes: Piece[] = [];
  for (let i = 0; i < 16; i++) {
    const y = 0.12 + i * 0.05;
    const side = i % 2 === 0 ? 1 : -1;
    backSpikes.push({
      pos: [side * (0.02 + Math.random() * 0.05), y, -0.06],
      size: [0.025, 0.12 + Math.random() * 0.22, 0.025],
      rot: [-1.2 - Math.random() * 0.5, 0, side * (0.3 + Math.random() * 0.5)],
    });
  }
  chest.add(cluster(unitCone, skin, backSpikes));

  // Cou long et tete allongee, couronne de pointes.
  const neck = new THREE.Group();
  neck.position.y = 0.82;
  chest.add(neck);
  const neckMesh = limb(0.035, 0.26);
  neckMesh.position.y = 0.13;
  neck.add(neckMesh);
  const head = new THREE.Group();
  head.position.y = 0.3;
  neck.add(head);
  const skullGeo = new THREE.SphereGeometry(0.11, 10, 8);
  owned.push(skullGeo);
  const skull = new THREE.Mesh(skullGeo, skin);
  skull.scale.set(0.8, 1.6, 0.9);
  skull.position.y = 0.1;
  head.add(skull);
  const crown: Piece[] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    crown.push({
      pos: [Math.cos(a) * 0.06, 0.18 + Math.random() * 0.1, Math.sin(a) * 0.06],
      size: [0.03, 0.18 + Math.random() * 0.26, 0.03],
      rot: [Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9],
    });
  }
  head.add(cluster(unitCone, skin, crown));

  // Bras : trois segments, doigts demesures.
  const arms: BacteriaParts["arms"] = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.24, 0.8, 0);
    chest.add(shoulder);
    shoulder.add(limb(0.035, 0.72));
    const elbow = new THREE.Group();
    elbow.position.y = -0.72;
    shoulder.add(elbow);
    elbow.add(limb(0.028, 0.78));
    const wrist = new THREE.Group();
    wrist.position.y = -0.78;
    elbow.add(wrist);
    wrist.add(
      cluster(
        unitBox,
        skin,
        [-1, 0, 1].map((k): Piece => ({ pos: [k * 0.03, -0.17, 0], size: [0.018, 0.34, 0.018], rot: [0, 0, k * 0.18] })),
      ),
    );
    arms.push({ shoulder, elbow, wrist, side });
  }

  // Jambes : longues, genou vers l'arriere.
  const legs: BacteriaParts["legs"] = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.12, 0, 0);
    body.add(hip);
    hip.add(limb(0.045, 0.66));
    const knee = new THREE.Group();
    knee.position.y = -0.66;
    hip.add(knee);
    knee.add(limb(0.035, 0.66));
    legs.push({ hip, knee, side });
  }

  return {
    group,
    body,
    chest,
    neck,
    head,
    arms,
    legs,
    twitch: { until: 0, head: [0, 0, 0], arms: [0, 0] },
    dispose: () => {
      for (const o of owned) o.dispose();
    },
  };
}

export interface BacteriaPose {
  time: number;
  /** Phase de marche, avance avec la distance parcourue. */
  walk: number;
  /** Vitesse en m/s : de l'immobilite a la course. */
  speed: number;
  /** Lacet de la tete par rapport au corps. */
  headYaw: number;
  /** 0 a 1 : bras tendus pour attraper. */
  lunge: number;
}

export function poseBacteria(p: BacteriaParts, pose: BacteriaPose) {
  const run = Math.min(1, pose.speed / 4);
  const stride = Math.min(1, pose.speed / 1.5);

  // Saccades : toutes les quelques centiemes de seconde, un nouveau tic.
  if (pose.time > p.twitch.until) {
    p.twitch.until = pose.time + 0.06 + Math.random() * (run > 0.5 ? 0.12 : 0.35);
    const amp = 0.25 + run * 0.35;
    p.twitch.head = [(Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp * 1.6];
    p.twitch.arms = [(Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp];
  }

  // Corps penche en avant a la course, balancement de cote en marchant.
  p.body.rotation.x = 0.1 + run * 0.55;
  p.body.position.y = 1.32 - run * 0.12 + Math.abs(Math.sin(pose.walk)) * 0.05 * stride;
  p.chest.rotation.z = Math.sin(pose.walk) * 0.08 * stride;

  for (const leg of p.legs) {
    const phase = pose.walk + (leg.side > 0 ? 0 : Math.PI);
    leg.hip.rotation.x = -Math.sin(phase) * 0.75 * stride - run * 0.4;
    // Genou inverse : il plie vers l'arriere quand la jambe revient.
    leg.knee.rotation.x = Math.max(0, Math.cos(phase)) * 1.1 * stride + 0.15;
  }

  p.arms.forEach((arm, i) => {
    const phase = pose.walk + (arm.side > 0 ? Math.PI : 0);
    // Bras qui trainent au repos, projetes en avant a l'attaque.
    const reach = Math.max(run * 0.7, pose.lunge);
    arm.shoulder.rotation.x = -Math.sin(phase) * 0.4 * stride * (1 - reach) - reach * 1.5 + p.twitch.arms[i];
    arm.shoulder.rotation.z = arm.side * (0.12 + reach * 0.25);
    arm.elbow.rotation.x = -0.25 - reach * 0.6 + Math.sin(pose.time * 7 + i) * 0.05;
    arm.wrist.rotation.x = -reach * 0.5;
  });

  // La tete se braque d'un coup : pas de rotation douce, c'est ce qui derange.
  p.neck.rotation.x = -run * 0.5;
  p.head.rotation.set(p.twitch.head[0] - pose.lunge * 0.3, pose.headYaw + p.twitch.head[1], p.twitch.head[2]);
}

// ---------------------------------------------------------------------------
// Le Souriant
// ---------------------------------------------------------------------------

export interface SmilerParts {
  group: THREE.Group;
  eyes: THREE.Mesh[];
  grin: THREE.Group;
  materials: THREE.MeshBasicMaterial[];
  dispose: () => void;
}

export function buildSmiler(): SmilerParts {
  const owned: (THREE.BufferGeometry | THREE.Material)[] = [];
  // fog: false — dans le noir, seules ces formes existent, meme au loin.
  const glow = new THREE.MeshBasicMaterial({ color: 0xf4f1e8, fog: false, transparent: true });
  const pupil = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false, transparent: true });
  owned.push(glow, pupil);

  const group = new THREE.Group();
  const eyeGeo = new THREE.SphereGeometry(0.075, 10, 8);
  const pupilGeo = new THREE.SphereGeometry(0.022, 6, 6);
  owned.push(eyeGeo, pupilGeo);
  const eyes: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, glow);
    eye.position.set(side * 0.2, 1.62, 0);
    eye.scale.set(1, 0.55, 0.5);
    const p = new THREE.Mesh(pupilGeo, pupil);
    p.position.z = 0.07;
    eye.add(p);
    group.add(eye);
    eyes.push(eye);
  }

  // Le sourire : un arc de dents, beaucoup trop large pour un visage.
  const grin = new THREE.Group();
  grin.position.set(0, 1.36, 0);
  const teeth: Piece[] = [];
  const count = 22;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1) - 0.5;
    const x = t * 0.78;
    const y = -Math.cos(t * Math.PI) * 0.1 + 0.1;
    teeth.push({ pos: [x, y + 0.03, 0], size: [0.03, 0.075 - Math.abs(t) * 0.05, 0.02], rot: [0, 0, t * 0.7] });
    teeth.push({ pos: [x, y - 0.045, 0], size: [0.03, 0.06 - Math.abs(t) * 0.04, 0.02], rot: [0, 0, t * 0.7] });
  }
  grin.add(cluster(unitBox, glow, teeth));
  group.add(grin);

  return {
    group,
    eyes,
    grin,
    materials: [glow, pupil],
    dispose: () => {
      for (const o of owned) o.dispose();
    },
  };
}

export function poseSmiler(s: SmilerParts, time: number, rush: number, opacity: number) {
  for (const m of s.materials) m.opacity = opacity;
  s.group.visible = opacity > 0.01;
  // Flotte a peine, tremble quand il charge.
  const jitter = rush * 0.03;
  s.group.position.y = Math.sin(time * 1.3) * 0.04 + (Math.random() - 0.5) * jitter;
  s.grin.scale.set(1 + rush * 0.55, 1 + rush * 0.9, 1);
  for (const eye of s.eyes) eye.scale.set(1 + rush * 0.3, 0.55 + rush * 0.35, 0.5);
}

// ---------------------------------------------------------------------------
// L'Egare (hallucination)
// ---------------------------------------------------------------------------

export interface Wanderer {
  group: THREE.Group;
  setOpacity: (value: number) => void;
  dispose: () => void;
}

export function buildWanderer(): Wanderer {
  const mat = new THREE.MeshBasicMaterial({ color: 0x07060a, transparent: true, opacity: 1 });
  const bodyGeo = new THREE.CapsuleGeometry(0.2, 1.05, 4, 8);
  const headGeo = new THREE.SphereGeometry(0.13, 10, 8);
  const armGeo = new THREE.CapsuleGeometry(0.05, 0.7, 3, 6);
  const group = new THREE.Group();
  const body = new THREE.Mesh(bodyGeo, mat);
  body.position.y = 0.95;
  group.add(body);
  const head = new THREE.Mesh(headGeo, mat);
  head.position.y = 1.72;
  head.rotation.z = 0.25;
  group.add(head);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, mat);
    arm.position.set(side * 0.25, 1.05, 0);
    group.add(arm);
  }
  return {
    group,
    setOpacity: (value: number) => {
      mat.opacity = Math.max(0, Math.min(1, value));
      group.visible = mat.opacity > 0.01;
    },
    dispose: () => {
      mat.dispose();
      bodyGeo.dispose();
      headGeo.dispose();
      armGeo.dispose();
    },
  };
}
