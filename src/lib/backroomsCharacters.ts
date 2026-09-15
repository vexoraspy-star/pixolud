import * as THREE from "three";

// Personnages des Backrooms : la main du joueur a la premiere personne, et
// les survivants (les amis, en partie a plusieurs).
//
// Tout est construit a la main (aucun modele externe) et en Lambert. Les
// details qui font « vrai » sont bon marche : des phalanges qui se plient
// autour de la lampe, un pouce qui enfonce vraiment le bouton, un faisceau de
// lampe visible dans la poussiere — dessine comme un cone additif plutot que
// comme une vraie lumiere, pour ne rien couter en ombrage.

function canvas2d(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext("2d")! };
}

function texture(canvas: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  return t;
}

/** Peau : legeres marbrures, pores, un peu de rougeur. */
function makeSkinTexture(base: string): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(128, 128);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    const r = 6 + Math.random() * 18;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, Math.random() < 0.5 ? "rgba(150,70,60,0.12)" : "rgba(255,230,210,0.1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.fillStyle = "rgba(60,30,20,0.12)";
  for (let i = 0; i < 400; i++) ctx.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
  return texture(canvas, true);
}

/** Toile de veste : trame, coutures, usure. */
function makeFabricTexture(base: string, dark: string): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(128, 128);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = dark;
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 128; i += 3) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 128);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.1;
  for (let i = 0; i < 128; i += 3) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(128, i);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.35;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(0, 64);
  ctx.lineTo(128, 64);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  for (let i = 0; i < 10; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    const r = 8 + Math.random() * 20;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(0,0,0,0.14)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return texture(canvas, true);
}

/** Aluminium anodise, strie par le moletage. */
function makeKnurlTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(64, 128);
  ctx.fillStyle = "#26292c";
  ctx.fillRect(0, 0, 64, 128);
  ctx.strokeStyle = "rgba(160,170,180,0.25)";
  ctx.lineWidth = 1;
  for (let i = -128; i < 192; i += 5) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(64, i + 32);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(64, i);
    ctx.lineTo(0, i + 32);
    ctx.stroke();
  }
  // Rayures d'usage.
  ctx.strokeStyle = "rgba(220,225,230,0.35)";
  for (let i = 0; i < 6; i++) {
    const y = Math.random() * 128;
    ctx.beginPath();
    ctx.moveTo(Math.random() * 64, y);
    ctx.lineTo(Math.random() * 64, y + Math.random() * 10);
    ctx.stroke();
  }
  return texture(canvas, true);
}

/** Reflecteur de la lampe : cercles concentriques, point chaud au centre. */
function makeReflectorTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(128, 128);
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.12, "#fff4d0");
  g.addColorStop(0.35, "#b9b4a4");
  g.addColorStop(1, "#4a4a48");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  for (let r = 14; r < 64; r += 7) {
    ctx.beginPath();
    ctx.arc(64, 64, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  return texture(canvas);
}

/** Faisceau : opaque pres de la lampe, qui se dissout vers le bout du cone. */
export function makeBeamTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(64, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "rgba(255,245,220,0)");
  g.addColorStop(0.08, "rgba(255,245,220,0.55)");
  g.addColorStop(0.35, "rgba(255,245,220,0.22)");
  g.addColorStop(1, "rgba(255,245,220,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 256);
  // Bords du cone plus clairs que le centre : on voit le « tube » de lumiere.
  const edge = ctx.createLinearGradient(0, 0, 64, 0);
  edge.addColorStop(0, "rgba(0,0,0,0.5)");
  edge.addColorStop(0.5, "rgba(0,0,0,0)");
  edge.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, 64, 256);
  return texture(canvas);
}

/** Halo rond et doux, pour les lentilles et les neons. */
export function makeGlowTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(64, 64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.2, "rgba(255,255,255,0.6)");
  g.addColorStop(0.55, "rgba(255,255,255,0.15)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return texture(canvas);
}

// ---------------------------------------------------------------------------
// Main a la premiere personne
// ---------------------------------------------------------------------------

export interface HandRig {
  group: THREE.Group;
  /** Couleur de la lentille : allumee ou eteinte. */
  lensMaterial: THREE.MeshBasicMaterial;
  reflectorMaterial: THREE.MeshBasicMaterial;
  glow: THREE.Sprite;
  update: (p: HandPose) => void;
  dispose: () => void;
}

export interface HandPose {
  time: number;
  delta: number;
  walkPhase: number;
  /** 0 immobile, 1 en marche. */
  bob: number;
  sprint: number;
  crouch: number;
  lampOn: boolean;
  /** Vitesse angulaire de la camera (rad/s), pour le retard de la main. */
  yawSpeed: number;
  pitchSpeed: number;
  /** Instant du dernier clic de lampe, -1 si aucun. */
  clickAt: number;
  /** Instant du dernier geste de ramassage, -1 si aucun. */
  reachAt: number;
}

export function buildHandRig(): HandRig {
  const owned: { dispose: () => void }[] = [];
  const own = <T extends { dispose: () => void }>(x: T) => {
    owned.push(x);
    return x;
  };

  const skin = own(new THREE.MeshLambertMaterial({ map: own(makeSkinTexture("#b38463")) }));
  const sleeveMat = own(new THREE.MeshLambertMaterial({ map: own(makeFabricTexture("#3c4a36", "#1a2016")) }));
  const knurl = own(new THREE.MeshLambertMaterial({ map: own(makeKnurlTexture()) }));
  const anodized = own(new THREE.MeshLambertMaterial({ color: 0x2c3034 }));
  const rubber = own(new THREE.MeshLambertMaterial({ color: 0x121314 }));
  const lensMaterial = own(new THREE.MeshBasicMaterial({ color: 0x6a6658 }));
  const reflectorMaterial = own(new THREE.MeshBasicMaterial({ map: own(makeReflectorTexture()), color: 0x777777 }));

  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  // --- Lampe : axe le long de -Z ---
  const torch = new THREE.Group();
  body.add(torch);
  const tube = new THREE.Mesh(own(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 18)), knurl);
  tube.rotation.x = Math.PI / 2;
  tube.position.z = -0.03;
  torch.add(tube);
  const tail = new THREE.Mesh(own(new THREE.CylinderGeometry(0.024, 0.023, 0.03, 18)), rubber);
  tail.rotation.x = Math.PI / 2;
  tail.position.z = 0.085;
  torch.add(tail);
  // Tete evasee et sa couronne.
  const neck = new THREE.Mesh(own(new THREE.CylinderGeometry(0.034, 0.023, 0.05, 20)), anodized);
  neck.rotation.x = Math.PI / 2;
  neck.position.z = -0.155;
  torch.add(neck);
  const head = new THREE.Mesh(own(new THREE.CylinderGeometry(0.036, 0.036, 0.035, 20)), anodized);
  head.rotation.x = Math.PI / 2;
  head.position.z = -0.197;
  torch.add(head);
  const bezel = new THREE.Mesh(own(new THREE.TorusGeometry(0.034, 0.005, 8, 24)), knurl);
  bezel.position.z = -0.215;
  torch.add(bezel);
  const reflector = new THREE.Mesh(own(new THREE.CircleGeometry(0.031, 24)), reflectorMaterial);
  reflector.position.z = -0.214;
  reflector.rotation.y = Math.PI;
  torch.add(reflector);
  const lens = new THREE.Mesh(own(new THREE.CircleGeometry(0.009, 16)), lensMaterial);
  lens.position.z = -0.2155;
  lens.rotation.y = Math.PI;
  torch.add(lens);
  // Bouton caoutchouc sur le dessus, sous le pouce.
  const button = new THREE.Mesh(own(new THREE.CylinderGeometry(0.008, 0.009, 0.008, 12)), rubber);
  button.position.set(0, 0.024, -0.095);
  torch.add(button);
  // Dragonne qui pend.
  const strap = new THREE.Mesh(own(new THREE.TorusGeometry(0.03, 0.003, 6, 16, Math.PI * 1.4)), rubber);
  strap.position.set(0, -0.03, 0.1);
  strap.rotation.set(0.2, Math.PI / 2, 0);
  torch.add(strap);
  const glow = new THREE.Sprite(
    own(new THREE.SpriteMaterial({ map: own(makeGlowTexture()), color: 0xfff1c8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })),
  );
  glow.scale.setScalar(0.12);
  glow.position.z = -0.222;
  torch.add(glow);

  // --- Main droite ---
  const hand = new THREE.Group();
  hand.position.set(0.004, -0.004, -0.045);
  body.add(hand);
  const palmGeo = own(new THREE.CapsuleGeometry(0.026, 0.05, 6, 12));
  const palm = new THREE.Mesh(palmGeo, skin);
  palm.rotation.x = Math.PI / 2;
  palm.scale.set(0.95, 1, 1.35);
  palm.position.set(0.03, -0.004, 0.005);
  hand.add(palm);
  // Dos de la main, legerement bombe.
  const back = new THREE.Mesh(own(new THREE.SphereGeometry(0.035, 14, 10)), skin);
  back.scale.set(0.7, 0.85, 1.25);
  back.position.set(0.038, 0.004, 0.006);
  hand.add(back);

  const segGeo = [0.019, 0.015, 0.012].map((len, i) => own(new THREE.CapsuleGeometry(0.0095 - i * 0.0012, len, 4, 8)));
  const lengths = [0.019, 0.015, 0.012];
  const knuckleGeo = own(new THREE.SphereGeometry(0.0105, 10, 8));
  const nailMat = own(new THREE.MeshLambertMaterial({ color: 0xd8b9a6 }));
  const nailGeo = own(new THREE.BoxGeometry(0.012, 0.004, 0.012));

  /** Doigt : trois phalanges, chaque articulation plie autour de Z. */
  type Finger = { joints: THREE.Group[]; baseCurl: number[] };
  const fingers: Finger[] = [];
  const fingerZ = [-0.034, -0.012, 0.01, 0.03];
  fingerZ.forEach((z, fi) => {
    const joints: THREE.Group[] = [];
    let parent: THREE.Object3D = hand;
    const base = new THREE.Group();
    // Articulation sous la lampe, cote droit : les doigts passent dessous et remontent a gauche.
    base.position.set(0.034, -0.026, z);
    const knuckle = new THREE.Mesh(knuckleGeo, skin);
    base.add(knuckle);
    parent.add(base);
    parent = base;
    for (let s = 0; s < 3; s++) {
      const joint = new THREE.Group();
      if (s > 0) joint.position.set(-lengths[s - 1] - 0.004, 0, 0);
      const seg = new THREE.Mesh(segGeo[s], skin);
      seg.rotation.z = Math.PI / 2;
      seg.position.x = -lengths[s] / 2 - 0.002;
      joint.add(seg);
      if (s === 2) {
        const nail = new THREE.Mesh(nailGeo, nailMat);
        nail.position.set(-lengths[s] / 2 - 0.004, -0.007, 0);
        joint.add(nail);
      }
      parent.add(joint);
      joints.push(joint);
      parent = joint;
    }
    // L'auriculaire serre un peu moins, l'index un peu plus.
    fingers.push({ joints, baseCurl: [-0.55 - fi * 0.05, -1.25, -1.1] });
  });

  // Pouce : il repose sur le bouton.
  const thumbBase = new THREE.Group();
  thumbBase.position.set(0.026, 0.02, 0.02);
  hand.add(thumbBase);
  const thumbSegs = [0.024, 0.018];
  const thumbJoints: THREE.Group[] = [];
  let tParent: THREE.Object3D = thumbBase;
  thumbSegs.forEach((len, i) => {
    const joint = new THREE.Group();
    if (i > 0) joint.position.set(0, 0, -thumbSegs[i - 1] - 0.003);
    const seg = new THREE.Mesh(own(new THREE.CapsuleGeometry(0.0105 - i * 0.0015, len, 4, 8)), skin);
    seg.rotation.x = Math.PI / 2;
    seg.position.z = -len / 2 - 0.002;
    joint.add(seg);
    if (i === 1) {
      const nail = new THREE.Mesh(nailGeo, nailMat);
      nail.position.set(0, 0.008, -len / 2 - 0.004);
      joint.add(nail);
    }
    tParent.add(joint);
    thumbJoints.push(joint);
    tParent = joint;
  });
  thumbBase.rotation.set(0, 0.55, -0.35);

  // Poignet et manche de veste : l'avant-bras part vers le bas et la droite de
  // l'ecran. Tout droit vers la camera, il passait derriere le plan proche et
  // il ne restait qu'un anneau de poignet flottant.
  const forearmDir = new THREE.Vector3(0.5, -0.55, 0.67).normalize();
  const alongForearm = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), forearmDir);
  const wristAt = new THREE.Vector3(0.042, -0.016, 0.045);
  const wrist = new THREE.Mesh(own(new THREE.CapsuleGeometry(0.024, 0.05, 4, 10)), skin);
  wrist.quaternion.copy(alongForearm);
  wrist.position.copy(wristAt).addScaledVector(forearmDir, 0.03);
  hand.add(wrist);
  const sleeve = new THREE.Mesh(own(new THREE.CylinderGeometry(0.05, 0.06, 0.36, 16)), sleeveMat);
  sleeve.quaternion.copy(alongForearm);
  sleeve.position.copy(wristAt).addScaledVector(forearmDir, 0.075 + 0.18);
  hand.add(sleeve);
  // Ourlet de la manche : un bord un peu plus large, a peine plus sombre.
  const hem = new THREE.Mesh(own(new THREE.CylinderGeometry(0.053, 0.053, 0.03, 16)), sleeveMat);
  hem.quaternion.copy(alongForearm);
  hem.position.copy(wristAt).addScaledVector(forearmDir, 0.075);
  hand.add(hem);

  // Etat lisse de l'animation.
  const lag = { x: 0, y: 0 };
  let sprintPose = 0;

  function update(p: HandPose) {
    const k = Math.min(1, p.delta * 10);
    // La main traine derriere la camera quand on tourne vite, puis rattrape.
    lag.x += (THREE.MathUtils.clamp(-p.yawSpeed * 0.018, -0.05, 0.05) - lag.x) * k;
    lag.y += (THREE.MathUtils.clamp(p.pitchSpeed * 0.014, -0.04, 0.04) - lag.y) * k;
    sprintPose += (p.sprint - sprintPose) * Math.min(1, p.delta * 6);

    const breathe = Math.sin(p.time * 1.6) * 0.004;
    const stepX = Math.sin(p.walkPhase) * 0.016 * p.bob * (1 + sprintPose);
    const stepY = Math.abs(Math.cos(p.walkPhase)) * 0.02 * p.bob * (1 + sprintPose * 1.4);
    body.position.set(stepX + lag.x, stepY + breathe + lag.y - sprintPose * 0.06 - p.crouch * 0.01, sprintPose * 0.05);
    // En courant, la lampe se couche et ballotte.
    body.rotation.set(
      0.05 + sprintPose * 0.55 + Math.sin(p.walkPhase * 2) * 0.05 * sprintPose + lag.y * 2,
      -0.08 + lag.x * 3 + sprintPose * 0.25,
      0.04 + Math.sin(p.walkPhase) * 0.03 * p.bob + sprintPose * 0.35,
    );

    // Geste de ramassage : la main plonge et revient.
    if (p.reachAt >= 0) {
      const t = (p.time - p.reachAt) / 0.45;
      if (t < 1) {
        const r = Math.sin(t * Math.PI);
        body.position.y -= r * 0.09;
        body.position.z -= r * 0.08;
        body.rotation.x -= r * 0.5;
      }
    }

    // Pouce qui enfonce le bouton.
    let press = 0;
    if (p.clickAt >= 0) {
      const t = (p.time - p.clickAt) / 0.22;
      if (t < 1) press = Math.sin(t * Math.PI);
    }
    thumbJoints[0].rotation.x = -0.2 - press * 0.35;
    thumbJoints[1].rotation.x = -0.25 - press * 0.45;

    // Doigts : serres, avec un leger tremblement de nervosite.
    const grip = 1 + sprintPose * 0.08;
    fingers.forEach((f, i) => {
      const jitter = Math.sin(p.time * 9 + i * 1.7) * 0.02;
      f.joints.forEach((j, s) => {
        j.rotation.z = f.baseCurl[s] * grip + jitter;
      });
    });

    lensMaterial.color.setHex(p.lampOn ? 0xfffbe8 : 0x5d594e);
    reflectorMaterial.color.setHex(p.lampOn ? 0xffffff : 0x6e6c66);
    glow.visible = p.lampOn;
  }

  return {
    group,
    lensMaterial,
    reflectorMaterial,
    glow,
    update,
    dispose: () => {
      for (const o of owned) o.dispose();
    },
  };
}

// ---------------------------------------------------------------------------
// Survivant (les amis en partie a plusieurs)
// ---------------------------------------------------------------------------

export const SURVIVOR_COLORS = [
  { jacket: "#c9a227", dark: "#6b5510", beanie: "#b3261e", name: "jaune" },
  { jacket: "#2f7d7a", dark: "#133836", beanie: "#e0e0d8", name: "sarcelle" },
  { jacket: "#b4541e", dark: "#55240a", beanie: "#1f2a44", name: "orange" },
  { jacket: "#6a3fa0", dark: "#2c1745", beanie: "#c9a227", name: "violet" },
];

export interface Survivor {
  group: THREE.Group;
  /** Hauteur de la tete, pour placer le son de la voix et l'etiquette. */
  headHeight: number;
  update: (p: SurvivorPose) => void;
  setName: (name: string) => void;
  dispose: () => void;
}

export interface SurvivorPose {
  time: number;
  walkPhase: number;
  speed: number;
  crouch: number;
  pitch: number;
  lampOn: boolean;
  dead: boolean;
  /** 0 a 1 : volume de sa voix, pour l'indicateur au-dessus de la tete. */
  speaking: number;
}

function makeTagTexture(name: string, speaking: boolean): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(512, 128);
  ctx.clearRect(0, 0, 512, 128);
  ctx.font = "bold 44px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const w = Math.min(470, ctx.measureText(name).width + (speaking ? 110 : 50));
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(256 - w / 2, 24, w, 80);
  ctx.fillStyle = "#f3e3a0";
  ctx.fillText(name, speaking ? 286 : 256, 66);
  if (speaking) {
    ctx.fillStyle = "#6ee7a0";
    const x0 = 256 - w / 2 + 22;
    [18, 34, 24].forEach((h, i) => ctx.fillRect(x0 + i * 14, 64 - h / 2, 8, h));
  }
  return texture(canvas);
}

export function buildSurvivor(colorIndex: number, name: string): Survivor {
  const palette = SURVIVOR_COLORS[colorIndex % SURVIVOR_COLORS.length];
  const owned: { dispose: () => void }[] = [];
  const own = <T extends { dispose: () => void }>(x: T) => {
    owned.push(x);
    return x;
  };
  const jacket = own(new THREE.MeshLambertMaterial({ map: own(makeFabricTexture(palette.jacket, palette.dark)), transparent: true }));
  const jeans = own(new THREE.MeshLambertMaterial({ map: own(makeFabricTexture("#34405a", "#161c2a")), transparent: true }));
  const skin = own(new THREE.MeshLambertMaterial({ map: own(makeSkinTexture("#b8896a")), transparent: true }));
  const boots = own(new THREE.MeshLambertMaterial({ color: 0x2b1f16, transparent: true }));
  const hairMat = own(new THREE.MeshLambertMaterial({ color: 0x2a1c12, transparent: true }));
  const beanieMat = own(new THREE.MeshLambertMaterial({ map: own(makeFabricTexture(palette.beanie, "#111111")), transparent: true }));
  const packMat = own(new THREE.MeshLambertMaterial({ color: 0x3a3a32, transparent: true }));
  const metal = own(new THREE.MeshLambertMaterial({ color: 0x26292c, transparent: true }));
  const eyeMat = own(new THREE.MeshBasicMaterial({ color: 0x14100c, transparent: true }));
  const lensMat = own(new THREE.MeshBasicMaterial({ color: 0xfffbe8, transparent: true }));
  const materials = [jacket, jeans, skin, boots, hairMat, beanieMat, packMat, metal, eyeMat, lensMat];

  const group = new THREE.Group();
  const root = new THREE.Group();
  group.add(root);

  const cap = (r: number, len: number, mat: THREE.Material, hang = true) => {
    const mesh = new THREE.Mesh(own(new THREE.CapsuleGeometry(r, len, 5, 12)), mat);
    if (hang) mesh.position.y = -len / 2;
    return mesh;
  };

  // Hanches et jambes.
  const hips = new THREE.Group();
  hips.position.y = 0.95;
  root.add(hips);
  const pelvis = new THREE.Mesh(own(new THREE.SphereGeometry(0.16, 14, 10)), jeans);
  pelvis.scale.set(1.15, 0.7, 0.8);
  hips.add(pelvis);
  const legs = [-1, 1].map((side) => {
    const thigh = new THREE.Group();
    thigh.position.set(side * 0.1, -0.02, 0);
    thigh.add(cap(0.075, 0.36, jeans));
    const knee = new THREE.Group();
    knee.position.y = -0.44;
    thigh.add(knee);
    knee.add(cap(0.06, 0.36, jeans));
    const foot = new THREE.Mesh(own(new THREE.BoxGeometry(0.11, 0.08, 0.25)), boots);
    foot.position.set(0, -0.47, 0.05);
    knee.add(foot);
    hips.add(thigh);
    return { thigh, knee, side };
  });

  // Torse en veste, sac a dos.
  const torso = new THREE.Group();
  torso.position.y = 0.05;
  hips.add(torso);
  const chest = new THREE.Mesh(own(new THREE.CapsuleGeometry(0.17, 0.3, 6, 14)), jacket);
  chest.scale.set(1.1, 1, 0.72);
  chest.position.y = 0.3;
  torso.add(chest);
  const zipper = new THREE.Mesh(own(new THREE.BoxGeometry(0.012, 0.42, 0.01)), metal);
  zipper.position.set(0, 0.3, 0.125);
  torso.add(zipper);
  const hood = new THREE.Mesh(own(new THREE.TorusGeometry(0.11, 0.045, 8, 16, Math.PI)), jacket);
  hood.position.set(0, 0.55, -0.05);
  hood.rotation.x = Math.PI / 2 + 0.3;
  torso.add(hood);
  const pack = new THREE.Mesh(own(new THREE.BoxGeometry(0.3, 0.36, 0.15)), packMat);
  pack.position.set(0, 0.32, -0.19);
  torso.add(pack);
  const packTop = new THREE.Mesh(own(new THREE.CapsuleGeometry(0.075, 0.18, 4, 10)), packMat);
  packTop.rotation.z = Math.PI / 2;
  packTop.position.set(0, 0.52, -0.19);
  torso.add(packTop);

  // Tete.
  const neckG = new THREE.Group();
  neckG.position.y = 0.6;
  torso.add(neckG);
  neckG.add(new THREE.Mesh(own(new THREE.CylinderGeometry(0.045, 0.05, 0.09, 10)), skin));
  const headG = new THREE.Group();
  headG.position.y = 0.15;
  neckG.add(headG);
  const skull = new THREE.Mesh(own(new THREE.SphereGeometry(0.105, 18, 14)), skin);
  skull.scale.set(0.92, 1.1, 1);
  headG.add(skull);
  const jaw = new THREE.Mesh(own(new THREE.SphereGeometry(0.075, 14, 10)), skin);
  jaw.scale.set(1, 0.7, 1);
  jaw.position.set(0, -0.06, 0.02);
  headG.add(jaw);
  const nose = new THREE.Mesh(own(new THREE.ConeGeometry(0.015, 0.04, 8)), skin);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.005, 0.105);
  headG.add(nose);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(own(new THREE.SphereGeometry(0.012, 8, 6)), eyeMat);
    eye.position.set(side * 0.036, 0.022, 0.092);
    headG.add(eye);
    const ear = new THREE.Mesh(own(new THREE.SphereGeometry(0.022, 8, 6)), skin);
    ear.scale.set(0.5, 1, 0.8);
    ear.position.set(side * 0.1, 0, 0);
    headG.add(ear);
  }
  const hair = new THREE.Mesh(own(new THREE.SphereGeometry(0.11, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55)), hairMat);
  hair.position.y = 0.012;
  hair.rotation.x = -0.25;
  headG.add(hair);
  const beanie = new THREE.Mesh(own(new THREE.SphereGeometry(0.115, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.45)), beanieMat);
  beanie.position.y = 0.03;
  headG.add(beanie);
  const brim = new THREE.Mesh(own(new THREE.TorusGeometry(0.1, 0.022, 8, 20)), beanieMat);
  brim.rotation.x = Math.PI / 2;
  brim.position.y = 0.05;
  headG.add(brim);

  // Bras : le droit tient la lampe devant lui.
  const arms = [-1, 1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.22, 0.5, 0);
    torso.add(shoulder);
    shoulder.add(cap(0.058, 0.26, jacket));
    const elbow = new THREE.Group();
    elbow.position.y = -0.32;
    shoulder.add(elbow);
    elbow.add(cap(0.048, 0.24, jacket));
    const handMesh = new THREE.Mesh(own(new THREE.SphereGeometry(0.045, 10, 8)), skin);
    handMesh.scale.set(0.8, 1.1, 0.9);
    handMesh.position.y = -0.31;
    elbow.add(handMesh);
    return { shoulder, elbow, side, hand: handMesh };
  });
  const rightHand = arms[1].elbow;
  const torchG = new THREE.Group();
  torchG.position.set(0, -0.32, 0.03);
  rightHand.add(torchG);
  const torchBody = new THREE.Mesh(own(new THREE.CylinderGeometry(0.022, 0.03, 0.22, 10)), metal);
  torchBody.rotation.x = Math.PI / 2;
  torchBody.position.z = 0.06;
  torchG.add(torchBody);
  const torchLens = new THREE.Mesh(own(new THREE.CircleGeometry(0.028, 12)), lensMat);
  torchLens.position.z = 0.172;
  torchG.add(torchLens);

  // Faisceau visible : un cone additif, jamais une vraie lumiere.
  const beamMat = own(
    new THREE.MeshBasicMaterial({
      map: own(makeBeamTexture()),
      color: 0xfff3d6,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  const beamLength = 7;
  const beamGeo = own(new THREE.ConeGeometry(1.1, beamLength, 20, 1, true));
  // Pointe du cone sur la lentille, ouverture vers l'avant.
  beamGeo.translate(0, -beamLength / 2, 0);
  beamGeo.rotateX(-Math.PI / 2);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.z = 0.18;
  torchG.add(beam);
  const lensGlow = new THREE.Sprite(
    own(new THREE.SpriteMaterial({ map: own(makeGlowTexture()), color: 0xfff1c8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })),
  );
  lensGlow.scale.setScalar(0.35);
  lensGlow.position.z = 0.19;
  torchG.add(lensGlow);

  // Etiquette de nom.
  let tagName = name;
  let tagSpeaking = false;
  const tagMat = own(new THREE.SpriteMaterial({ map: makeTagTexture(name, false), transparent: true, depthWrite: false, depthTest: false }));
  const tag = new THREE.Sprite(tagMat);
  tag.scale.set(0.9, 0.225, 1);
  tag.position.y = 2.02;
  tag.renderOrder = 10;
  group.add(tag);
  function refreshTag() {
    tagMat.map?.dispose();
    tagMat.map = makeTagTexture(tagName, tagSpeaking);
    tagMat.needsUpdate = true;
  }

  function update(p: SurvivorPose) {
    const stride = THREE.MathUtils.clamp(p.speed / 3, 0, 1.4);
    const crouch = p.crouch;
    root.position.y = -crouch * 0.38 + Math.abs(Math.sin(p.walkPhase)) * 0.035 * stride;
    for (const leg of legs) {
      const phase = p.walkPhase + (leg.side > 0 ? 0 : Math.PI);
      leg.thigh.rotation.x = Math.sin(phase) * 0.55 * stride - crouch * 1.1;
      leg.knee.rotation.x = Math.max(0, -Math.cos(phase)) * 0.9 * stride + crouch * 1.9;
    }
    torso.rotation.x = crouch * 0.45 + stride * 0.08;
    // Bras gauche qui balance, bras droit tendu vers ou il regarde.
    const left = arms[0];
    left.shoulder.rotation.x = -Math.sin(p.walkPhase) * 0.5 * stride;
    left.elbow.rotation.x = -0.3 - stride * 0.3;
    const right = arms[1];
    right.shoulder.rotation.x = -1.35 - p.pitch * 0.8 + crouch * 0.3;
    right.shoulder.rotation.z = 0.12;
    right.elbow.rotation.x = -0.15;
    torchG.rotation.x = 1.5 - 0.15;
    headG.rotation.x = -p.pitch * 0.6;
    beam.visible = p.lampOn && !p.dead;
    lensGlow.visible = beam.visible;
    lensMat.color.setHex(p.lampOn ? 0xfffbe8 : 0x3a3a36);
    beamMat.opacity = 0.42 + Math.sin(p.time * 13) * 0.02;

    // Mort : une silhouette grise, a moitie effacee — un fantome qui erre.
    const alpha = p.dead ? 0.22 : 1;
    for (const m of materials) m.opacity = alpha;

    const speaking = p.speaking > 0.12 && !p.dead;
    if (speaking !== tagSpeaking) {
      tagSpeaking = speaking;
      refreshTag();
    }
    tag.position.y = 2.02 - crouch * 0.38;
  }

  return {
    group,
    headHeight: 1.62,
    update,
    setName: (n: string) => {
      if (n === tagName) return;
      tagName = n;
      refreshTag();
    },
    dispose: () => {
      tagMat.map?.dispose();
      for (const o of owned) o.dispose();
    },
  };
}
