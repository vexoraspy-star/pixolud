import * as THREE from "three";

// Les entites des Backrooms, sculptees a la main (aucun modele externe).
//
//  - La BACTERIE : 2,6 m de peau noire et humide tendue sur des os. Membres
//    effiles et noueux (tournes au tour, pas des tubes), cotes saillantes,
//    colonne herissee, machoire qui se decroche sur des dents en aiguille,
//    doigts de trente centimetres qui se replient un par un.
//  - Le SOURIANT : on ne voit jamais vraiment son corps. Deux yeux injectes
//    et un sourire de dents gatees qui flottent dans le noir.
//  - L'EGARE : une silhouette immobile au bout d'un couloir, hallucination
//    du niveau 0 quand la lucidite lache.
//
// Materiaux Lambert ou Basic seulement, et tout ce qui est fige entre soi
// (cotes, vertebres, dents, pointes) est instancie.

function canvas2d(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext("2d")! };
}

/** Peau de la Bacterie : noir goudron, reflets mouilles, veines, cicatrices. */
function makeWetSkinTexture(): THREE.CanvasTexture {
  const S = 256;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#08080a";
  ctx.fillRect(0, 0, S, S);
  // Marbrure grasse.
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = 10 + Math.random() * 40;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, Math.random() < 0.5 ? "rgba(40,36,44,0.5)" : "rgba(0,0,0,0.6)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Veines violacees sous la peau.
  ctx.strokeStyle = "rgba(70,30,50,0.55)";
  for (let i = 0; i < 14; i++) {
    let x = Math.random() * S;
    let y = Math.random() * S;
    ctx.lineWidth = 0.6 + Math.random() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 10; k++) {
      x += (Math.random() - 0.5) * 18;
      y += Math.random() * 14;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Reflets humides : des filaments clairs, dans le sens de l'etirement.
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const len = 2 + Math.random() * 14;
    ctx.strokeStyle = `rgba(190,200,215,${0.08 + Math.random() * 0.28})`;
    ctx.lineWidth = Math.random() < 0.2 ? 1.5 : 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 2, y + len);
    ctx.stroke();
  }
  // Cicatrices et craquelures.
  ctx.strokeStyle = "rgba(0,0,0,0.9)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 30);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Oeil injecte : sclere jaunie, veines rouges, iris minuscule. */
function makeEyeTexture(): THREE.CanvasTexture {
  const S = 128;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#e9e2cf";
  ctx.fillRect(0, 0, S, S);
  const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(1, "rgba(150,90,60,0.55)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = "rgba(170,20,20,0.7)";
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2;
    let x = 64 + Math.cos(a) * 62;
    let y = 64 + Math.sin(a) * 62;
    ctx.lineWidth = 0.6 + Math.random();
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (64 - x) * 0.14 + (Math.random() - 0.5) * 8;
      y += (64 - y) * 0.14 + (Math.random() - 0.5) * 8;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // L'iris est placee sur le devant de la sphere (u = 0.25 pour SphereGeometry).
  const cx = S * 0.25;
  ctx.fillStyle = "#2a1a10";
  ctx.beginPath();
  ctx.arc(cx, 64, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(cx, 64, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillRect(cx - 3, 59, 2, 2);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

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

/**
 * Membre tourne au tour : rayon qui s'affine du haut vers le bas, avec un
 * renflement de muscle et un noeud d'articulation. Il pend depuis son pivot
 * (y = 0) jusqu'a y = -length.
 */
function limbGeometry(r0: number, r1: number, length: number, bulge: number, knot = 0.25): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [];
  const steps = 14;
  pts.push(new THREE.Vector2(0.0001, 0));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let r = THREE.MathUtils.lerp(r0, r1, t);
    r += bulge * Math.pow(Math.sin(Math.PI * Math.min(1, t / 0.7)), 2) * (t < 0.7 ? 1 : 0);
    // Articulation noueuse aux deux bouts.
    r += r0 * knot * Math.exp(-Math.pow(t / 0.07, 2)) + r1 * knot * 1.4 * Math.exp(-Math.pow((1 - t) / 0.06, 2));
    pts.push(new THREE.Vector2(r, -t * length));
  }
  pts.push(new THREE.Vector2(0.0001, -length));
  return new THREE.LatheGeometry(pts, 10);
}

// ---------------------------------------------------------------------------
// La Bacterie
// ---------------------------------------------------------------------------

export interface BacteriaParts {
  group: THREE.Group;
  body: THREE.Group;
  chest: THREE.Group;
  ribs: THREE.Object3D;
  neck: THREE.Group;
  head: THREE.Group;
  jaw: THREE.Group;
  arms: { shoulder: THREE.Group; elbow: THREE.Group; wrist: THREE.Group; fingers: THREE.Group[][]; side: number }[];
  legs: { hip: THREE.Group; knee: THREE.Group; ankle: THREE.Group; side: number }[];
  twitch: { until: number; head: [number, number, number]; arms: number[]; fingers: number[] };
  dispose: () => void;
}

export function buildBacteria(): BacteriaParts {
  const owned: { dispose: () => void }[] = [];
  const own = <T extends { dispose: () => void }>(x: T) => {
    owned.push(x);
    return x;
  };
  const skinTex = own(makeWetSkinTexture());
  const skin = own(new THREE.MeshLambertMaterial({ map: skinTex }));
  // Os et griffes : a peine plus clairs que la peau, ils accrochent la lampe.
  const bone = own(new THREE.MeshLambertMaterial({ color: 0x3b3632 }));
  const toothMat = own(new THREE.MeshLambertMaterial({ color: 0xb9ad8e }));
  const gumMat = own(new THREE.MeshLambertMaterial({ color: 0x2a0b10 }));
  const mawMat = own(new THREE.MeshBasicMaterial({ color: 0x000000 }));
  // Les yeux ne dependent pas de la lumiere : deux points pales dans le noir.
  const eyeMat = own(new THREE.MeshBasicMaterial({ color: 0xd9cf9c }));

  const unitCone = own(new THREE.ConeGeometry(0.5, 1, 6));
  unitCone.translate(0, 0.5, 0);
  const unitBox = own(new THREE.BoxGeometry(1, 1, 1));

  const limb = (r0: number, r1: number, len: number, bulge: number, mat: THREE.Material = skin) =>
    new THREE.Mesh(own(limbGeometry(r0, r1, len, bulge)), mat);

  const group = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 1.34;
  group.add(body);

  // Bassin osseux.
  const pelvis = new THREE.Mesh(own(new THREE.SphereGeometry(0.14, 12, 10)), skin);
  pelvis.scale.set(1.25, 0.65, 0.85);
  body.add(pelvis);
  body.add(
    cluster(unitBox, bone, [
      { pos: [0.13, 0.02, 0.04], size: [0.1, 0.035, 0.12], rot: [0, 0.4, 0.5] },
      { pos: [-0.13, 0.02, 0.04], size: [0.1, 0.035, 0.12], rot: [0, -0.4, -0.5] },
    ]),
  );

  const chest = new THREE.Group();
  chest.position.y = 0.06;
  body.add(chest);

  // Colonne : une tige effilee et des vertebres saillantes dans le dos.
  const spine = limb(0.05, 0.075, 0.78, 0.01);
  spine.rotation.x = Math.PI;
  chest.add(spine);
  const vertebrae: Piece[] = [];
  for (let i = 0; i < 17; i++) {
    const y = 0.04 + i * 0.047;
    vertebrae.push({ pos: [0, y, -0.065], size: [0.05 - i * 0.001, 0.028, 0.045], rot: [0.3, 0, 0] });
  }
  chest.add(cluster(unitBox, bone, vertebrae));

  // Cage thoracique : des arcs de torus, etroits et creux, qui se voient a travers la peau.
  const ribGeo = own(new THREE.TorusGeometry(1, 0.09, 5, 14, Math.PI * 0.85));
  const ribPieces: Piece[] = [];
  for (let i = 0; i < 7; i++) {
    const y = 0.4 + i * 0.058;
    const w = 0.11 + Math.sin((i / 6) * Math.PI) * 0.05;
    for (const side of [-1, 1]) {
      ribPieces.push({ pos: [0, y, -0.01], size: [w, w * 0.8, w * 0.12], rot: [Math.PI / 2 + 0.25, side > 0 ? 0 : Math.PI, side * 0.35] });
    }
  }
  const ribs = cluster(ribGeo, bone, ribPieces);
  chest.add(ribs);
  // Sternum et clavicules.
  chest.add(
    cluster(unitBox, bone, [
      { pos: [0, 0.58, 0.08], size: [0.03, 0.3, 0.025] },
      { pos: [0.12, 0.82, 0.035], size: [0.22, 0.03, 0.03], rot: [0, 0.35, -0.2] },
      { pos: [-0.12, 0.82, 0.035], size: [0.22, 0.03, 0.03], rot: [0, -0.35, 0.2] },
    ]),
  );
  // Pointes le long du dos et des omoplates.
  const spikes: Piece[] = [];
  for (let i = 0; i < 22; i++) {
    const y = 0.1 + i * 0.037;
    const side = i % 2 === 0 ? 1 : -1;
    spikes.push({
      pos: [side * (0.015 + Math.random() * 0.06), y, -0.08],
      size: [0.022, 0.1 + Math.random() * 0.26, 0.022],
      rot: [-1.15 - Math.random() * 0.55, 0, side * (0.25 + Math.random() * 0.55)],
    });
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      spikes.push({
        pos: [side * (0.14 + i * 0.012), 0.72 - i * 0.05, -0.07],
        size: [0.02, 0.12 + Math.random() * 0.12, 0.02],
        rot: [-1.3, 0, side * (0.9 + Math.random() * 0.4)],
      });
    }
  }
  chest.add(cluster(unitCone, skin, spikes));

  // Cou demesure et tete allongee.
  const neck = new THREE.Group();
  neck.position.y = 0.84;
  chest.add(neck);
  const neckMesh = limb(0.028, 0.045, 0.3, 0.005);
  neckMesh.rotation.x = Math.PI;
  neck.add(neckMesh);
  const head = new THREE.Group();
  head.position.y = 0.32;
  neck.add(head);
  const skull = new THREE.Mesh(own(new THREE.SphereGeometry(0.1, 16, 12)), skin);
  skull.scale.set(0.82, 1.7, 1);
  skull.position.set(0, 0.12, -0.01);
  head.add(skull);
  // Arcades et pommettes saillantes.
  head.add(
    cluster(unitBox, bone, [
      { pos: [0.045, 0.08, 0.075], size: [0.05, 0.018, 0.03], rot: [0, 0.3, -0.25] },
      { pos: [-0.045, 0.08, 0.075], size: [0.05, 0.018, 0.03], rot: [0, -0.3, 0.25] },
      { pos: [0.06, 0.02, 0.06], size: [0.03, 0.05, 0.03], rot: [0, 0.5, 0] },
      { pos: [-0.06, 0.02, 0.06], size: [0.03, 0.05, 0.03], rot: [0, -0.5, 0] },
    ]),
  );
  // Quatre yeux, petits et enfonces.
  const eyeGeo = own(new THREE.SphereGeometry(0.009, 8, 6));
  for (const [x, y] of [
    [0.03, 0.06],
    [-0.03, 0.06],
    [0.05, 0.1],
    [-0.05, 0.1],
  ]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(x, y, 0.078);
    head.add(eye);
  }
  // Gueule : fond noir, dents du haut sur le crane, machoire articulee.
  const maw = new THREE.Mesh(own(new THREE.SphereGeometry(0.06, 12, 8)), mawMat);
  maw.scale.set(0.9, 0.6, 0.5);
  maw.position.set(0, -0.03, 0.05);
  head.add(maw);
  const upperTeeth: Piece[] = [];
  for (let i = 0; i < 13; i++) {
    const a = (i / 12 - 0.5) * 2.4;
    upperTeeth.push({
      pos: [Math.sin(a) * 0.055, -0.005, 0.05 + Math.cos(a) * 0.035],
      size: [0.007, 0.03 + Math.random() * 0.03, 0.007],
      rot: [Math.PI, 0, (Math.random() - 0.5) * 0.3],
    });
  }
  head.add(cluster(unitCone, toothMat, upperTeeth));
  const gum = new THREE.Mesh(own(new THREE.TorusGeometry(0.058, 0.012, 6, 16, Math.PI)), gumMat);
  gum.rotation.x = Math.PI / 2;
  gum.position.set(0, 0.0, 0.05);
  head.add(gum);
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.02, -0.02);
  head.add(jaw);
  const jawBone = new THREE.Mesh(own(new THREE.SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5)), skin);
  jawBone.scale.set(0.85, 0.9, 1.25);
  jawBone.position.set(0, -0.005, 0.05);
  jaw.add(jawBone);
  const lowerTeeth: Piece[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 11 - 0.5) * 2.3;
    lowerTeeth.push({
      pos: [Math.sin(a) * 0.05, -0.01, 0.07 + Math.cos(a) * 0.03],
      size: [0.006, 0.025 + Math.random() * 0.03, 0.006],
      rot: [0, 0, (Math.random() - 0.5) * 0.3],
    });
  }
  jaw.add(cluster(unitCone, toothMat, lowerTeeth));
  // Couronne de pointes.
  const crown: Piece[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    crown.push({
      pos: [Math.cos(a) * 0.055, 0.22 + Math.random() * 0.1, Math.sin(a) * 0.06 - 0.02],
      size: [0.026, 0.16 + Math.random() * 0.3, 0.026],
      rot: [Math.sin(a) * 0.95 - 0.35, 0, -Math.cos(a) * 0.95],
    });
  }
  head.add(cluster(unitCone, skin, crown));

  // Bras : epaule, avant-bras, et quatre doigts de trois phalanges chacun.
  const fingerSeg = [0.13, 0.11, 0.09];
  const segGeos = fingerSeg.map((len, i) => own(limbGeometry(0.014 - i * 0.003, 0.01 - i * 0.003, len, 0.002, 0.4)));
  const clawGeo = own(new THREE.ConeGeometry(0.007, 0.06, 5));
  clawGeo.rotateX(Math.PI);
  clawGeo.translate(0, -0.03, 0);
  const arms: BacteriaParts["arms"] = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.24, 0.8, 0);
    chest.add(shoulder);
    shoulder.add(limb(0.038, 0.024, 0.74, 0.012));
    const elbow = new THREE.Group();
    elbow.position.y = -0.74;
    shoulder.add(elbow);
    elbow.add(limb(0.03, 0.018, 0.8, 0.008));
    const wrist = new THREE.Group();
    wrist.position.y = -0.8;
    elbow.add(wrist);
    const palm = new THREE.Mesh(own(new THREE.SphereGeometry(0.03, 8, 6)), skin);
    palm.scale.set(1.2, 1.4, 0.6);
    palm.position.y = -0.03;
    wrist.add(palm);
    const fingers: THREE.Group[][] = [];
    for (let f = 0; f < 4; f++) {
      const chain: THREE.Group[] = [];
      let parent: THREE.Object3D = wrist;
      for (let s = 0; s < 3; s++) {
        const joint = new THREE.Group();
        if (s === 0) {
          joint.position.set((f - 1.5) * 0.02, -0.06, 0);
          joint.rotation.z = (f - 1.5) * 0.12;
        } else {
          joint.position.y = -fingerSeg[s - 1];
        }
        joint.add(new THREE.Mesh(segGeos[s], skin));
        if (s === 2) {
          const claw = new THREE.Mesh(clawGeo, bone);
          claw.position.y = -fingerSeg[2];
          joint.add(claw);
        }
        parent.add(joint);
        chain.push(joint);
        parent = joint;
      }
      fingers.push(chain);
    }
    arms.push({ shoulder, elbow, wrist, fingers, side });
  }

  // Jambes : genou en arriere, pied long pose sur la pointe.
  const legs: BacteriaParts["legs"] = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.13, -0.02, 0);
    body.add(hip);
    hip.add(limb(0.055, 0.03, 0.66, 0.02));
    const knee = new THREE.Group();
    knee.position.y = -0.66;
    hip.add(knee);
    knee.add(limb(0.035, 0.022, 0.6, 0.012));
    const ankle = new THREE.Group();
    ankle.position.y = -0.6;
    knee.add(ankle);
    const foot = limb(0.022, 0.012, 0.2, 0.004);
    foot.rotation.x = -1.2;
    ankle.add(foot);
    ankle.add(
      cluster(unitCone, bone, [-1, 0, 1].map((k): Piece => ({ pos: [k * 0.025, -0.07, 0.18], size: [0.012, 0.08, 0.012], rot: [1.9, 0, k * 0.25] }))),
    );
    legs.push({ hip, knee, ankle, side });
  }

  return {
    group,
    body,
    chest,
    ribs,
    neck,
    head,
    jaw,
    arms,
    legs,
    twitch: { until: 0, head: [0, 0, 0], arms: [0, 0], fingers: [0, 0, 0, 0, 0, 0, 0, 0] },
    dispose: () => {
      for (const o of owned) o.dispose();
    },
  };
}

export interface BacteriaPose {
  time: number;
  walk: number;
  /** Vitesse en m/s. */
  speed: number;
  headYaw: number;
  /** 0 a 1 : bras tendus pour attraper. */
  lunge: number;
  /** 0 a 1 : machoire grande ouverte (cri). */
  scream?: number;
}

export function poseBacteria(p: BacteriaParts, pose: BacteriaPose) {
  const run = Math.min(1, pose.speed / 4);
  const stride = Math.min(1, pose.speed / 1.5);
  const scream = Math.max(pose.scream ?? 0, pose.lunge * 0.8);

  // Saccades : un nouveau tic toutes les quelques centiemes de seconde.
  if (pose.time > p.twitch.until) {
    p.twitch.until = pose.time + 0.05 + Math.random() * (run > 0.5 ? 0.1 : 0.32);
    const amp = 0.22 + run * 0.35;
    p.twitch.head = [(Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp * 1.8];
    p.twitch.arms = [(Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp];
    p.twitch.fingers = p.twitch.fingers.map(() => Math.random() * 0.6);
  }

  // Respiration : la cage se souleve, lentement au repos, vite en chasse.
  const breath = Math.sin(pose.time * (1.4 + run * 3)) * 0.5 + 0.5;
  p.ribs.scale.set(1 + breath * 0.05, 1, 1 + breath * 0.09);

  p.body.rotation.x = 0.12 + run * 0.6;
  p.body.position.y = 1.34 - run * 0.14 + Math.abs(Math.sin(pose.walk)) * 0.05 * stride;
  p.chest.rotation.z = Math.sin(pose.walk) * 0.09 * stride;
  p.chest.rotation.y = Math.sin(pose.walk * 0.5) * 0.08 * stride;

  for (const leg of p.legs) {
    const phase = pose.walk + (leg.side > 0 ? 0 : Math.PI);
    leg.hip.rotation.x = -Math.sin(phase) * 0.78 * stride - run * 0.45;
    leg.knee.rotation.x = Math.max(0, Math.cos(phase)) * 1.15 * stride + 0.18;
    leg.ankle.rotation.x = -0.3 - Math.max(0, -Math.cos(phase)) * 0.5 * stride;
  }

  p.arms.forEach((arm, i) => {
    const phase = pose.walk + (arm.side > 0 ? Math.PI : 0);
    const reach = Math.max(run * 0.65, pose.lunge);
    arm.shoulder.rotation.x = -Math.sin(phase) * 0.4 * stride * (1 - reach) - reach * 1.5 + p.twitch.arms[i];
    arm.shoulder.rotation.z = arm.side * (0.1 + reach * 0.3);
    arm.elbow.rotation.x = -0.25 - reach * 0.55 + Math.sin(pose.time * 6 + i) * 0.04;
    arm.wrist.rotation.x = -reach * 0.4;
    // Doigts : ils pendent a demi replies, s'ouvrent pour saisir.
    arm.fingers.forEach((chain, f) => {
      const tw = p.twitch.fingers[i * 4 + f] ?? 0;
      const curl = (1 - pose.lunge) * (0.25 + tw * 0.5);
      chain.forEach((joint, s) => {
        joint.rotation.x = -curl * (0.6 + s * 0.3) + (s === 0 ? pose.lunge * 0.35 : 0);
      });
    });
  });

  p.neck.rotation.x = -run * 0.55;
  p.head.rotation.set(p.twitch.head[0] - pose.lunge * 0.35, pose.headYaw + p.twitch.head[1], p.twitch.head[2]);
  // Machoire : claquements rapides au repos, grande ouverte quand elle crie.
  const chatter = Math.max(0, Math.sin(pose.time * 31)) * 0.08 * (1 - scream);
  p.jaw.rotation.x = chatter + scream * 0.85;
}

// ---------------------------------------------------------------------------
// Le Souriant
// ---------------------------------------------------------------------------

export interface SmilerParts {
  group: THREE.Group;
  eyes: THREE.Mesh[];
  grin: THREE.Group;
  materials: THREE.Material[];
  dispose: () => void;
}

export function buildSmiler(): SmilerParts {
  const owned: { dispose: () => void }[] = [];
  const own = <T extends { dispose: () => void }>(x: T) => {
    owned.push(x);
    return x;
  };
  // fog: false — dans le noir, seules ces formes existent, meme au loin.
  const eyeMat = own(new THREE.MeshBasicMaterial({ map: own(makeEyeTexture()), fog: false, transparent: true }));
  const toothMat = own(new THREE.MeshBasicMaterial({ color: 0xe6dcc0, fog: false, transparent: true }));
  const gumMat = own(new THREE.MeshBasicMaterial({ color: 0x3a0a0e, fog: false, transparent: true }));
  const shadowMat = own(new THREE.MeshBasicMaterial({ color: 0x010101, transparent: true, depthWrite: false }));
  const materials: THREE.Material[] = [eyeMat, toothMat, gumMat, shadowMat];

  const group = new THREE.Group();
  // Silhouette a peine visible contre un fond eclaire.
  const silhouette = new THREE.Mesh(own(new THREE.CapsuleGeometry(0.34, 1.3, 6, 12)), shadowMat);
  silhouette.position.y = 1.15;
  silhouette.scale.set(1, 1, 0.5);
  group.add(silhouette);

  const eyeGeo = own(new THREE.SphereGeometry(0.075, 16, 12));
  const eyes: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(side * 0.19, 1.62, 0.12);
    // L'iris est peinte a u = 0.25, qui regarde deja vers +Z (vers le joueur).
    eye.scale.set(1, 0.72, 1);
    group.add(eye);
    eyes.push(eye);
  }

  // Sourire : dents irregulieres, certaines cassees, gencives sombres.
  const grin = new THREE.Group();
  grin.position.set(0, 1.36, 0.12);
  const unitBox = own(new THREE.BoxGeometry(1, 1, 1));
  const teeth: Piece[] = [];
  const count = 26;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1) - 0.5;
    const x = t * 0.82;
    const y = -Math.cos(t * Math.PI) * 0.12 + 0.12;
    const broken = Math.random() < 0.15;
    const hTop = (0.08 - Math.abs(t) * 0.05) * (broken ? 0.45 : 0.85 + Math.random() * 0.3);
    const hBot = (0.065 - Math.abs(t) * 0.04) * (0.8 + Math.random() * 0.35);
    const lean = t * 0.7 + (Math.random() - 0.5) * 0.25;
    teeth.push({ pos: [x, y + 0.012 + hTop / 2, 0], size: [0.026 + Math.random() * 0.008, hTop, 0.018], rot: [0, 0, lean] });
    teeth.push({ pos: [x, y - 0.012 - hBot / 2, 0], size: [0.024 + Math.random() * 0.008, hBot, 0.018], rot: [0, 0, lean] });
  }
  grin.add(cluster(unitBox, toothMat, teeth));
  const gumGeo = own(new THREE.TorusGeometry(0.43, 0.018, 6, 30, Math.PI * 0.95));
  for (const [y, flip] of [
    [0.1, 1],
    [0.02, -1],
  ] as const) {
    const gum = new THREE.Mesh(gumGeo, gumMat);
    gum.rotation.z = flip > 0 ? Math.PI + 0.08 : 0.08;
    gum.scale.set(1, 0.32, 1);
    gum.position.set(0, y + (flip > 0 ? 0.13 : -0.02), -0.01);
    grin.add(gum);
  }
  group.add(grin);

  return {
    group,
    eyes,
    grin,
    materials,
    dispose: () => {
      for (const o of owned) o.dispose();
    },
  };
}

export function poseSmiler(s: SmilerParts, time: number, rush: number, opacity: number) {
  s.materials.forEach((m, i) => {
    m.opacity = i === 3 ? opacity * 0.55 : opacity;
  });
  s.group.visible = opacity > 0.01;
  const jitter = rush * 0.035;
  s.group.position.y = Math.sin(time * 1.3) * 0.04 + (Math.random() - 0.5) * jitter;
  s.grin.scale.set(1 + rush * 0.6, 1 + rush * 1.1, 1);
  for (const eye of s.eyes) {
    eye.scale.set(1 + rush * 0.35, 0.72 + rush * 0.45, 1 + rush * 0.35);
    // Les yeux tremblent dans leurs orbites.
    eye.rotation.x = Math.sin(time * 23 + eye.position.x * 10) * 0.05 * (0.3 + rush);
  }
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
