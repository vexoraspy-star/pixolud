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

  // Tronc plein et decharne, tourne au tour puis sculpte : ventre creuse sous
  // les cotes, cotes en relief sous la peau, epaules tombantes. (Les anciennes
  // cotes en arcs separes laissaient voir a travers : on aurait dit un
  // squelette en baguettes.)
  const torsoProfile: [number, number][] = [
    [0.0001, -0.03],
    [0.1, 0.0],
    [0.082, 0.12],
    [0.075, 0.26],
    [0.1, 0.4],
    [0.132, 0.54],
    [0.148, 0.66],
    [0.15, 0.75],
    [0.12, 0.82],
    [0.05, 0.88],
    [0.0001, 0.9],
  ];
  const torsoGeo = own(
    new THREE.LatheGeometry(
      torsoProfile.map(([r, y]) => new THREE.Vector2(r, y)),
      22,
    ),
  );
  {
    // Relief : les cotes ressortent sur les flancs et le devant, le ventre se creuse.
    const pos = torsoGeo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const r = Math.hypot(x, z);
      if (r < 0.01) continue;
      const front = z / r;
      let d = 0;
      if (y > 0.4 && y < 0.72) d += 0.011 * Math.max(0, Math.sin(((y - 0.4) / 0.32) * Math.PI * 6)) * (0.35 + 0.65 * Math.max(0, front + 0.3));
      if (y > 0.1 && y < 0.38 && front > 0) d -= 0.022 * front * Math.sin(((y - 0.1) / 0.28) * Math.PI);
      const k = (r + d) / r;
      pos.setXYZ(i, x * k, y, z * k);
    }
    torsoGeo.computeVertexNormals();
  }
  const ribs = new THREE.Group();
  const torso = new THREE.Mesh(torsoGeo, skin);
  torso.scale.set(1, 1, 0.62);
  ribs.add(torso);
  chest.add(ribs);
  // Vertebres saillantes le long du dos.
  const vertebrae: Piece[] = [];
  for (let i = 0; i < 17; i++) {
    const y = 0.06 + i * 0.047;
    vertebrae.push({ pos: [0, y, -0.06 - Math.sin((i / 16) * Math.PI) * 0.02], size: [0.034, 0.024, 0.04], rot: [0.3, 0, 0] });
  }
  chest.add(cluster(unitBox, skin, vertebrae));
  // Clavicules et trapezes : le cou se raccorde aux epaules.
  const trap = new THREE.Mesh(own(new THREE.SphereGeometry(1, 14, 10)), skin);
  trap.scale.set(0.25, 0.05, 0.08);
  trap.position.set(0, 0.8, -0.01);
  chest.add(trap);

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
  // Orbites creuses et noires, et au fond deux points pales.
  const socketGeo = own(new THREE.SphereGeometry(0.024, 10, 8));
  const eyeGeo = own(new THREE.SphereGeometry(0.0075, 8, 6));
  for (const side of [-1, 1]) {
    const socket = new THREE.Mesh(socketGeo, mawMat);
    socket.scale.set(1.15, 0.75, 0.45);
    socket.position.set(side * 0.036, 0.085, 0.074);
    head.add(socket);
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(side * 0.036, 0.083, 0.082);
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
  // Arriere du crane etire vers le haut et l'arriere, lisse.
  const occiput = new THREE.Mesh(own(new THREE.SphereGeometry(0.085, 14, 10)), skin);
  occiput.scale.set(0.8, 1.5, 1.2);
  occiput.position.set(0, 0.22, -0.05);
  occiput.rotation.x = -0.45;
  head.add(occiput);

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
    // Moignon d'epaule : le bras sort du tronc, il ne flotte plus a cote.
    const deltoid = new THREE.Mesh(own(new THREE.SphereGeometry(0.05, 10, 8)), skin);
    deltoid.scale.set(1, 1.2, 0.85);
    deltoid.position.y = -0.02;
    shoulder.add(deltoid);
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
//
// Fidele aux Backrooms : on ne voit jamais son corps. Dans le noir, deux yeux
// blancs et un sourire immense, trop large et trop plein de dents, flottent a
// hauteur de visage. Autour, une masse d'ombre qui avale la lumiere de la lampe.
// Tout est peint au canvas et pose sur des plans face au joueur.

/** Oeil du Souriant : globe blanc luisant, veines, pupille minuscule, halo. */
function makeSmilerEyeTexture(): THREE.CanvasTexture {
  const S = 128;
  const { canvas, ctx } = canvas2d(S, S);
  const halo = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  halo.addColorStop(0, "rgba(255,250,235,0.5)");
  halo.addColorStop(0.45, "rgba(255,245,220,0.16)");
  halo.addColorStop(1, "rgba(255,245,220,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, S, S);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(64, 64, 30, 21, 0, 0, Math.PI * 2);
  ctx.clip();
  const white = ctx.createRadialGradient(60, 60, 4, 64, 64, 32);
  white.addColorStop(0, "#fffdf4");
  white.addColorStop(0.7, "#eee4cc");
  white.addColorStop(1, "#b3a283");
  ctx.fillStyle = white;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = "rgba(165,25,25,0.55)";
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2;
    let x = 64 + Math.cos(a) * 30;
    let y = 64 + Math.sin(a) * 21;
    ctx.lineWidth = 0.5 + Math.random() * 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += (64 - x) * 0.2 + (Math.random() - 0.5) * 6;
      y += (64 - y) * 0.2 + (Math.random() - 0.5) * 6;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
  // Pupille : un point noir qui ne cligne jamais.
  ctx.fillStyle = "#050303";
  ctx.beginPath();
  ctx.arc(64, 64, 4.5, 0, Math.PI * 2);
  ctx.fill();
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Point d'une courbe de Bezier cubique. */
function bezier(p: [number, number][], t: number): [number, number] {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0], a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1]];
}

/** Le sourire : d'une joue a l'autre, coins dechires, dents serrees et inegales. */
function makeSmilerGrinTexture(): THREE.CanvasTexture {
  const W = 1024;
  const H = 512;
  const { canvas, ctx } = canvas2d(W, H);
  const upper: [number, number][] = [
    [W * 0.03, H * 0.2],
    [W * 0.22, H * 0.52],
    [W * 0.78, H * 0.52],
    [W * 0.97, H * 0.2],
  ];
  const lower: [number, number][] = [
    [W * 0.97, H * 0.2],
    [W * 0.84, H * 0.98],
    [W * 0.16, H * 0.98],
    [W * 0.03, H * 0.2],
  ];
  const mouth = new Path2D();
  mouth.moveTo(upper[0][0], upper[0][1]);
  mouth.bezierCurveTo(upper[1][0], upper[1][1], upper[2][0], upper[2][1], upper[3][0], upper[3][1]);
  mouth.bezierCurveTo(lower[1][0], lower[1][1], lower[2][0], lower[2][1], lower[3][0], lower[3][1]);
  mouth.closePath();

  // Halo pale autour de la bouche, puis le fond noir.
  ctx.save();
  ctx.shadowColor = "rgba(255,240,210,0.55)";
  ctx.shadowBlur = 40;
  ctx.fillStyle = "#070303";
  ctx.fill(mouth);
  ctx.restore();

  ctx.save();
  ctx.clip(mouth);
  // Gencives sombres le long des deux levres.
  ctx.lineCap = "round";
  for (const [curve, width] of [
    [upper, 34],
    [lower, 30],
  ] as const) {
    ctx.strokeStyle = "#3b080c";
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(curve[0][0], curve[0][1]);
    ctx.bezierCurveTo(curve[1][0], curve[1][1], curve[2][0], curve[2][1], curve[3][0], curve[3][1]);
    ctx.stroke();
  }

  // Dents : longues au milieu, plus courtes vers les coins, certaines cassees.
  const drawRow = (curve: [number, number][], count: number, down: boolean) => {
    for (let i = 0; i < count; i++) {
      const t0 = (i + 0.08) / count;
      const t1 = (i + 0.92) / count;
      if (Math.random() < 0.04) continue; // une dent manquante
      const [x0, y0] = bezier(curve, t0);
      const [x1, y1] = bezier(curve, t1);
      const mid = (t0 + t1) / 2;
      const taper = Math.sin(mid * Math.PI);
      const broken = Math.random() < 0.12;
      const len = H * (0.05 + taper * (down ? 0.13 : 0.1)) * (broken ? 0.45 : 0.85 + Math.random() * 0.3);
      const dir = down ? 1 : -1;
      const inset = dir * 8;
      const tipX = (x0 + x1) / 2 + (Math.random() - 0.5) * 6;
      const tipY = (y0 + y1) / 2 + inset + dir * len;
      const g = ctx.createLinearGradient(0, (y0 + y1) / 2, 0, tipY);
      const shade = 205 + Math.random() * 35;
      g.addColorStop(0, `rgb(${shade - 90},${shade - 100},${shade - 130})`);
      g.addColorStop(0.35, `rgb(${shade},${shade - 10},${shade - 45})`);
      g.addColorStop(1, `rgb(${Math.min(255, shade + 20)},${shade + 8},${shade - 20})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x0, y0 + inset - dir * 6);
      ctx.lineTo(x1, y1 + inset - dir * 6);
      ctx.quadraticCurveTo(x1 - (x1 - x0) * 0.1, tipY - dir * len * 0.25, tipX + (x1 - x0) * 0.12, tipY);
      ctx.lineTo(tipX - (x1 - x0) * 0.12, tipY);
      ctx.quadraticCurveTo(x0 + (x1 - x0) * 0.1, tipY - dir * len * 0.25, x0, y0 + inset - dir * 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(35,18,10,0.75)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };
  drawRow(upper, 30, true);
  drawRow(lower.slice().reverse() as [number, number][], 28, false);
  ctx.restore();

  // Levres gercees, et les coins dechires qui remontent vers les yeux.
  ctx.strokeStyle = "rgba(18,4,4,0.9)";
  ctx.lineWidth = 7;
  ctx.stroke(mouth);
  ctx.strokeStyle = "rgba(70,10,12,0.85)";
  ctx.lineWidth = 4;
  for (const [x, dir] of [
    [W * 0.03, 1],
    [W * 0.97, -1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x, H * 0.2);
    ctx.lineTo(x + dir * 10, H * 0.12);
    ctx.lineTo(x + dir * 2, H * 0.04);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Tache d'ombre douce et irreguliere (noir, transparence sur les bords). */
function makeShadowTexture(dense: boolean): THREE.CanvasTexture {
  const S = 128;
  const { canvas, ctx } = canvas2d(S, S);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(2,2,3,${dense ? 0.95 : 0.7})`);
  g.addColorStop(dense ? 0.55 : 0.4, `rgba(2,2,3,${dense ? 0.8 : 0.35})`);
  g.addColorStop(1, "rgba(2,2,3,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  if (!dense) {
    // Volutes : la fumee n'est jamais ronde.
    for (let i = 0; i < 14; i++) {
      const x = 20 + Math.random() * 88;
      const y = 20 + Math.random() * 88;
      const r = 8 + Math.random() * 22;
      const b = ctx.createRadialGradient(x, y, 0, x, y, r);
      b.addColorStop(0, "rgba(0,0,0,0.35)");
      b.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = b;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Hauteur du visage et du sourire, en metres. */
const SMILER_FACE_Y = 1.58;
const SMILER_GRIN_Y = -0.17;

export interface SmilerParts {
  group: THREE.Group;
  /** Ombre du visage, yeux et sourire : penche, tressaille. */
  face: THREE.Group;
  eyes: THREE.Mesh[];
  grin: THREE.Mesh;
  smoke: THREE.Mesh[];
  /** Chaque materiau et son opacite a pleine apparition. */
  materials: { mat: THREE.Material; base: number }[];
  twitch: { until: number; roll: number; x: number };
  dispose: () => void;
}

export function buildSmiler(): SmilerParts {
  const owned: { dispose: () => void }[] = [];
  const own = <T extends { dispose: () => void }>(x: T) => {
    owned.push(x);
    return x;
  };
  // fog: false pour le visage — au bout d'un couloir noir, le sourire reste
  // visible. La fumee, elle, se perd dans le brouillard.
  const glow = (map: THREE.Texture) =>
    own(new THREE.MeshBasicMaterial({ map, fog: false, transparent: true, depthWrite: false }));
  const eyeMat = glow(own(makeSmilerEyeTexture()));
  const grinMat = glow(own(makeSmilerGrinTexture()));
  const voidMat = own(new THREE.MeshBasicMaterial({ map: own(makeShadowTexture(true)), fog: false, transparent: true, depthWrite: false }));
  const smokeMat = own(new THREE.MeshBasicMaterial({ map: own(makeShadowTexture(false)), transparent: true, depthWrite: false }));
  const materials = [
    { mat: eyeMat, base: 1 },
    { mat: grinMat, base: 1 },
    { mat: voidMat, base: 0.9 },
    { mat: smokeMat, base: 0.75 },
  ];

  const group = new THREE.Group();
  const plane = own(new THREE.PlaneGeometry(1, 1));

  // La masse d'ombre : des volutes empilees, plus larges vers le haut.
  const smoke: THREE.Mesh[] = [];
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(plane, smokeMat);
    const t = i / 6;
    const size = 0.75 + t * 0.55 + Math.random() * 0.2;
    m.position.set((Math.random() - 0.5) * 0.2, 0.35 + t * 1.45, -0.12 - Math.random() * 0.2);
    m.scale.set(size, size * 1.15, 1);
    m.rotation.z = Math.random() * Math.PI * 2;
    m.userData.spin = (Math.random() < 0.5 ? -1 : 1) * (0.05 + Math.random() * 0.12);
    m.userData.size = size;
    m.userData.angle = m.rotation.z;
    m.renderOrder = 1;
    group.add(m);
    smoke.push(m);
  }

  const face = new THREE.Group();
  face.position.y = SMILER_FACE_Y;
  // Un visage plus grand qu'un visage humain : on le reconnait de loin.
  face.scale.setScalar(1.25);
  group.add(face);
  const shade = new THREE.Mesh(plane, voidMat);
  shade.scale.set(1.25, 1.35, 1);
  shade.position.set(0, -0.06, -0.02);
  shade.renderOrder = 2;
  face.add(shade);

  const eyes: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(plane, eyeMat);
    eye.position.set(side * 0.14, 0.08, 0.01);
    eye.scale.set(0.3, 0.3, 1);
    eye.renderOrder = 3;
    face.add(eye);
    eyes.push(eye);
  }
  const grin = new THREE.Mesh(plane, grinMat);
  grin.position.set(0, SMILER_GRIN_Y, 0.02);
  grin.scale.set(0.95, 0.475, 1);
  grin.renderOrder = 3;
  face.add(grin);

  return {
    group,
    face,
    eyes,
    grin,
    smoke,
    materials,
    twitch: { until: 0, roll: 0, x: 0 },
    dispose: () => {
      for (const o of owned) o.dispose();
    },
  };
}

export function poseSmiler(s: SmilerParts, time: number, rush: number, opacity: number) {
  for (const { mat, base } of s.materials) mat.opacity = opacity * base;
  s.group.visible = opacity > 0.01;
  const jitter = rush * 0.035;
  s.group.position.y = Math.sin(time * 1.3) * 0.04 + (Math.random() - 0.5) * jitter;

  // La tete penche et oscille lentement ; quand il fonce, des tics secs.
  if (time > s.twitch.until) {
    s.twitch.until = time + (rush > 0.2 ? 0.05 + Math.random() * 0.12 : 0.7 + Math.random() * 2.2);
    const amp = 0.06 + rush * 0.32;
    s.twitch.roll = (Math.random() - 0.5) * amp;
    s.twitch.x = (Math.random() - 0.5) * amp * 0.25;
  }
  s.face.rotation.z = 0.12 + Math.sin(time * 0.55) * 0.1 + s.twitch.roll;
  s.face.position.x = s.twitch.x;

  // Le sourire s'etire en foncant : plus large, et surtout plus ouvert.
  s.grin.scale.set(0.95 * (1 + rush * 0.3), 0.475 * (1 + rush * 0.9), 1);
  s.grin.position.y = SMILER_GRIN_Y - rush * 0.1;
  s.eyes.forEach((eye, i) => {
    const k = 0.3 * (1 + rush * 0.4 + Math.sin(time * 23 + i * 2) * 0.03);
    eye.scale.set(k, k, 1);
  });

  // La fumee tourne sur elle-meme et gonfle quand il approche.
  for (const m of s.smoke) {
    m.rotation.z = m.userData.angle + time * m.userData.spin;
    const size = m.userData.size * (1 + Math.sin(time * 0.9 + m.userData.angle) * 0.06 + rush * 0.3);
    m.scale.set(size, size * 1.15, 1);
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
