import * as THREE from "three";
import { CELL_PILLAR, DIRS, type DecorItem, type DecorKind, type LevelData, type LevelId } from "./backrooms";
import { makeCardboard, makeFuseBoxTexture } from "./backroomsTextures";

// Decor des Backrooms : tout ce qui habille les niveaux sans changer la
// partie. Chaque type d'objet est UNE InstancedMesh (deux ou trois pour les
// objets en plusieurs pieces) : une centaine d'extincteurs coutent autant
// qu'un seul. Textures dessinees au canvas, aucun fichier externe.
//
// Seule exception « qui compte » : au niveau « ! », les obstacles sont des
// cases pleines ; au lieu de blocs de mur, on les dessine en casiers,
// distributeurs et piles de cartons qui remplissent toute la case — jamais
// de mur invisible.

function canvas2d(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext("2d")! };
}

function finish(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, alpha = 0.18) {
  for (let i = 0; i < amount; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha * 0.5})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}

/** Affiches et panneaux : quatre textes par niveau, dans le style du lieu. */
const POSTERS: Record<LevelId, { text: string[]; style: "bureau" | "danger" | "vapeur" | "fuite" }> = {
  "niveau-0": { text: ["RESTEZ CALME", "IL N'Y A PAS\nDE SORTIE", "NE FAITES\nPAS DE BRUIT", "RÉUNION\nANNULÉE"], style: "bureau" },
  "niveau-1": { text: ["ZONE B-3", "CHARGE MAX\n500 KG", "CASQUE\nOBLIGATOIRE", "ÉTEIGNEZ\nVOTRE LAMPE"], style: "danger" },
  "niveau-2": { text: ["DANGER\nVAPEUR", "NE PAS\nTOUCHER", "PRESSION\nÉLEVÉE", "ELLE\nENTEND"], style: "vapeur" },
  "niveau-run": { text: ["SORTIE →", "← SORTIE", "COUREZ", "NE VOUS\nRETOURNEZ PAS"], style: "fuite" },
};

function makePosterTexture(text: string, style: (typeof POSTERS)[LevelId]["style"], index: number): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(256, 180);
  const exitSign = style === "fuite" && index < 2;
  const bg = { bureau: "#e9e1c8", danger: "#e7b928", vapeur: "#a8231a", fuite: exitSign ? "#0f7a3a" : "#b21d14" }[style];
  const fg = { bureau: "#3b3526", danger: "#15130e", vapeur: "#f4ece0", fuite: "#f6fff2" }[style];
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 180);
  if (style === "danger") {
    // Bandeau de hachures jaunes et noires.
    ctx.fillStyle = "#15130e";
    for (let x = -40; x < 300; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 14, 0);
      ctx.lineTo(x - 6, 26);
      ctx.lineTo(x - 20, 26);
      ctx.closePath();
      ctx.fill();
    }
  }
  if (style === "bureau") {
    ctx.fillStyle = "#b9ad86";
    ctx.fillRect(10, 10, 236, 4);
    ctx.fillRect(10, 166, 236, 4);
  }
  ctx.strokeStyle = fg;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 244, 168);
  ctx.globalAlpha = 1;
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = text.split("\n");
  const size = lines.some((l) => l.length > 11) ? 30 : exitSign ? 46 : 38;
  ctx.font = `bold ${size}px sans-serif`;
  lines.forEach((line, i) => ctx.fillText(line, 128, 98 + (i - (lines.length - 1) / 2) * (size + 8)));
  // Vieilli : coins cornes, taches, eraflures.
  speckle(ctx, 256, 180, 500, 0.2);
  ctx.fillStyle = "rgba(60,40,10,0.25)";
  ctx.beginPath();
  ctx.arc(30 + Math.random() * 190, 30 + Math.random() * 120, 14 + Math.random() * 20, 0, Math.PI * 2);
  ctx.fill();
  return finish(canvas);
}

function makeVentTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(128, 72);
  ctx.fillStyle = "#b9b196";
  ctx.fillRect(0, 0, 128, 72);
  ctx.fillStyle = "#23201a";
  for (let y = 10; y < 64; y += 9) ctx.fillRect(10, y, 108, 5);
  ctx.fillStyle = "#8d856c";
  for (const [x, y] of [[5, 5], [123, 5], [5, 67], [123, 67]]) ctx.fillRect(x - 2, y - 2, 4, 4);
  speckle(ctx, 128, 72, 160);
  return finish(canvas);
}

function makeGaugeTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(128, 128);
  ctx.fillStyle = "#e9e3d2";
  ctx.beginPath();
  ctx.arc(64, 64, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2a2520";
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.strokeStyle = "#b3261e";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(64, 64, 48, -0.2, 0.9);
  ctx.stroke();
  ctx.strokeStyle = "#2a2520";
  ctx.lineWidth = 2;
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    ctx.beginPath();
    ctx.moveTo(64 + Math.cos(a) * 40, 64 + Math.sin(a) * 40);
    ctx.lineTo(64 + Math.cos(a) * 52, 64 + Math.sin(a) * 52);
    ctx.stroke();
  }
  // L'aiguille est dans le rouge.
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(64, 64);
  ctx.lineTo(64 + Math.cos(0.5) * 44, 64 + Math.sin(0.5) * 44);
  ctx.stroke();
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(64, 64, 6, 0, Math.PI * 2);
  ctx.fill();
  return finish(canvas);
}

function makeScratchTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(128, 160);
  ctx.clearRect(0, 0, 128, 160);
  ctx.lineCap = "round";
  for (let set = 0; set < 2; set++) {
    const x0 = 20 + set * 46 + Math.random() * 10;
    const y0 = 16 + Math.random() * 30;
    for (let k = 0; k < 4; k++) {
      ctx.strokeStyle = `rgba(${set ? 40 : 70},6,4,${0.7 + Math.random() * 0.25})`;
      ctx.lineWidth = 2.5 + Math.random() * 2;
      ctx.beginPath();
      ctx.moveTo(x0 + k * 8, y0 + k * 3);
      ctx.bezierCurveTo(x0 + k * 8 + 6, y0 + 50, x0 + k * 7 - 4, y0 + 90, x0 + k * 9 + 2, y0 + 120 - Math.random() * 20);
      ctx.stroke();
    }
  }
  return finish(canvas);
}

function makePuddleTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(128, 128);
  ctx.clearRect(0, 0, 128, 128);
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, "rgba(10,10,8,0.75)");
  g.addColorStop(0.7, "rgba(18,16,12,0.55)");
  g.addColorStop(1, "rgba(18,16,12,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  // Contour irregulier.
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r = 44 + Math.sin(a * 3) * 8 + Math.random() * 10;
    const x = 64 + Math.cos(a) * r;
    const y = 64 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.fill();
  // Reflet mouille.
  ctx.strokeStyle = "rgba(230,230,210,0.25)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(50, 50, 18, 6, -0.5, 0, Math.PI);
  ctx.stroke();
  return finish(canvas);
}

function makePaperTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(64, 90);
  ctx.fillStyle = "#ece7da";
  ctx.fillRect(0, 0, 64, 90);
  ctx.fillStyle = "rgba(40,40,60,0.45)";
  for (let y = 12; y < 84; y += 6) ctx.fillRect(8, y, 20 + Math.random() * 30, 2);
  ctx.fillStyle = "rgba(120,90,40,0.25)";
  ctx.beginPath();
  ctx.arc(40, 60, 12, 0, Math.PI * 2);
  ctx.fill();
  return finish(canvas);
}

function makeGrateTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(128, 128);
  ctx.fillStyle = "#2c2a27";
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = "#070605";
  for (let x = 14; x < 116; x += 14) ctx.fillRect(x, 12, 7, 104);
  ctx.strokeStyle = "#4a4641";
  ctx.lineWidth = 5;
  ctx.strokeRect(5, 5, 118, 118);
  speckle(ctx, 128, 128, 200);
  return finish(canvas);
}

function makePalletTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(128, 128);
  ctx.fillStyle = "#1c150d";
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = "#9a7a4a";
  for (let y = 4; y < 128; y += 26) ctx.fillRect(0, y, 128, 18);
  ctx.fillStyle = "rgba(50,35,15,0.4)";
  for (let i = 0; i < 40; i++) ctx.fillRect(Math.random() * 128, Math.random() * 128, 12, 1);
  return finish(canvas);
}

function makeLockerTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(128, 256);
  ctx.fillStyle = "#4d5a52";
  ctx.fillRect(0, 0, 128, 256);
  ctx.strokeStyle = "#26302a";
  ctx.lineWidth = 3;
  for (const x of [2, 64]) {
    ctx.strokeRect(x + 2, 4, 58, 248);
    ctx.fillStyle = "#1b221e";
    for (let y = 16; y < 46; y += 6) ctx.fillRect(x + 14, y, 34, 3);
    ctx.fillStyle = "#9aa39c";
    ctx.fillRect(x + 48, 120, 5, 22);
  }
  // Une porte enfoncee.
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(34, 170, 16, 28, 0.3, 0, Math.PI * 2);
  ctx.fill();
  speckle(ctx, 128, 256, 600, 0.22);
  return finish(canvas);
}

function makeVendingTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(128, 256);
  ctx.fillStyle = "#1a1c22";
  ctx.fillRect(0, 0, 128, 256);
  ctx.fillStyle = "#d8e8ff";
  ctx.fillRect(10, 14, 80, 170);
  const colors = ["#c0392b", "#e67e22", "#27ae60", "#2980b9", "#8e44ad"];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 4; c++) {
      ctx.fillStyle = colors[(r + c) % colors.length];
      ctx.fillRect(16 + c * 18, 22 + r * 32, 12, 20);
    }
    ctx.fillStyle = "#8a93a0";
    ctx.fillRect(12, 46 + r * 32, 76, 3);
  }
  // Vitre fendue.
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(60, 60);
  ctx.lineTo(40, 20);
  ctx.moveTo(60, 60);
  ctx.lineTo(88, 110);
  ctx.moveTo(60, 60);
  ctx.lineTo(20, 90);
  ctx.stroke();
  ctx.fillStyle = "#30343c";
  ctx.fillRect(98, 30, 20, 60);
  ctx.fillStyle = "#e2c14a";
  ctx.fillRect(102, 40, 12, 6);
  ctx.fillStyle = "#050505";
  ctx.fillRect(20, 200, 70, 36);
  return finish(canvas);
}

function makeCeilingHoleTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(128, 128);
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = "#050403";
  ctx.beginPath();
  ctx.moveTo(8, 10);
  ctx.lineTo(120, 6);
  ctx.lineTo(118, 70);
  ctx.lineTo(90, 76);
  ctx.lineTo(96, 120);
  ctx.lineTo(10, 118);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(60,50,30,0.8)";
  ctx.lineWidth = 3;
  ctx.stroke();
  return finish(canvas);
}

export interface DecorBuild {
  group: THREE.Group;
  update: (time: number) => void;
  dispose: () => void;
}

export function buildDecor(opts: {
  data: LevelData;
  cellSize: number;
  wallHeight: number;
  floorY: (z: number) => number;
}): DecorBuild {
  const { data } = opts;
  const CS = opts.cellSize;
  const WH = opts.wallHeight;
  const W = data.width;
  const levelId = data.def.id;
  const group = new THREE.Group();
  const owned: { dispose: () => void }[] = [];
  const own = <T extends { dispose: () => void }>(x: T) => {
    owned.push(x);
    return x;
  };

  const byKind = new Map<DecorKind, DecorItem[]>();
  for (const item of data.decor) {
    const list = byKind.get(item.kind);
    if (list) list.push(item);
    else byKind.set(item.kind, [item]);
  }

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();

  /** Position contre le mur `dir` de la case, a `inset` metres du mur, et lacet face a la piece. */
  function wallPose(item: DecorItem, inset: number) {
    const [dx, dy] = DIRS[item.dir];
    return {
      x: (item.x + 0.5 + dx * 0.5) * CS - dx * inset,
      z: (item.y + 0.5 + dy * 0.5) * CS - dy * inset,
      yaw: Math.atan2(-dx, -dy),
      base: opts.floorY(item.y + 0.5),
    };
  }

  function instanced(geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], count: number) {
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, count));
    mesh.count = count;
    group.add(mesh);
    return mesh;
  }

  // --- Extincteurs ---
  const extinguishers = byKind.get("extincteur") ?? [];
  if (extinguishers.length) {
    const body = instanced(own(new THREE.CylinderGeometry(0.075, 0.08, 0.46, 12)), own(new THREE.MeshLambertMaterial({ color: 0xb01f16 })), extinguishers.length);
    const head = instanced(own(new THREE.CylinderGeometry(0.03, 0.05, 0.12, 8)), own(new THREE.MeshLambertMaterial({ color: 0x1b1b1b })), extinguishers.length);
    const plate = instanced(own(new THREE.PlaneGeometry(0.22, 0.3)), own(new THREE.MeshBasicMaterial({ map: own(makePosterTexture("FEU", "fuite", 3)) })), extinguishers.length);
    extinguishers.forEach((item, i) => {
      const p = wallPose(item, 0.12);
      e.set(0, p.yaw, 0);
      q.setFromEuler(e);
      m.compose(v.set(p.x, p.base + 0.55, p.z), q, sc.set(1, 1, 1));
      body.setMatrixAt(i, m);
      m.compose(v.set(p.x, p.base + 0.84, p.z), q, sc.set(1, 1, 1));
      head.setMatrixAt(i, m);
      const w = wallPose(item, 0.012);
      m.compose(v.set(w.x, w.base + 1.1, w.z), q, sc.set(1, 1, 1));
      plate.setMatrixAt(i, m);
    });
  }

  // --- Affiches et panneaux ---
  const posters = byKind.get("affiche") ?? [];
  if (posters.length) {
    const plan = POSTERS[levelId];
    const runSign = levelId === "niveau-run";
    const geo = own(new THREE.PlaneGeometry(runSign ? 0.95 : 0.62, runSign ? 0.62 : 0.44));
    for (let variant = 0; variant < 4; variant++) {
      const mine = posters.filter((p) => p.variant === variant);
      if (!mine.length) continue;
      const mat = own(new THREE.MeshLambertMaterial({ map: own(makePosterTexture(plan.text[variant], plan.style, variant)) }));
      const mesh = instanced(geo, mat, mine.length);
      mine.forEach((item, i) => {
        const p = wallPose(item, 0.011);
        e.set(0, p.yaw, (((item.x * 13 + item.y * 7) % 7) - 3) * 0.02);
        q.setFromEuler(e);
        m.compose(v.set(p.x, p.base + (runSign ? 1.9 : 1.5), p.z), q, sc.set(1, 1, 1));
        mesh.setMatrixAt(i, m);
      });
    }
  }

  // --- Boitiers electriques ---
  const boxes = byKind.get("boitier") ?? [];
  if (boxes.length) {
    const mesh = instanced(own(new THREE.BoxGeometry(0.42, 0.58, 0.12)), own(new THREE.MeshLambertMaterial({ map: own(makeFuseBoxTexture(0)) })), boxes.length);
    const conduit = instanced(own(new THREE.CylinderGeometry(0.025, 0.025, 1, 6)), own(new THREE.MeshLambertMaterial({ color: 0x3a3a36 })), boxes.length);
    boxes.forEach((item, i) => {
      const p = wallPose(item, 0.07);
      e.set(0, p.yaw, 0);
      q.setFromEuler(e);
      m.compose(v.set(p.x, p.base + 1.35, p.z), q, sc.set(1, 1, 1));
      mesh.setMatrixAt(i, m);
      const top = WH - 1.64;
      m.compose(v.set(p.x, p.base + 1.64 + top / 2, p.z), q, sc.set(1, Math.max(0.1, top), 1));
      conduit.setMatrixAt(i, m);
    });
  }

  // --- Grilles de ventilation, pres du sol ---
  const vents = byKind.get("ventilation") ?? [];
  if (vents.length) {
    const mesh = instanced(own(new THREE.PlaneGeometry(0.5, 0.28)), own(new THREE.MeshLambertMaterial({ map: own(makeVentTexture()) })), vents.length);
    vents.forEach((item, i) => {
      const p = wallPose(item, 0.012);
      e.set(0, p.yaw, 0);
      q.setFromEuler(e);
      const high = item.variant === 3;
      m.compose(v.set(p.x, p.base + (high ? WH - 0.35 : 0.3), p.z), q, sc.set(1, 1, 1));
      mesh.setMatrixAt(i, m);
    });
  }

  // --- Manometres ---
  const gauges = byKind.get("manometre") ?? [];
  if (gauges.length) {
    const dial = instanced(own(new THREE.CircleGeometry(0.13, 20)), own(new THREE.MeshLambertMaterial({ map: own(makeGaugeTexture()) })), gauges.length);
    const rim = instanced(own(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 20)), own(new THREE.MeshLambertMaterial({ color: 0x6b5a3a })), gauges.length);
    const pipe = instanced(own(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8)), own(new THREE.MeshLambertMaterial({ color: 0x4a3b2e })), gauges.length);
    gauges.forEach((item, i) => {
      const p = wallPose(item, 0.07);
      const y = p.base + 1.45 + item.variant * 0.08;
      e.set(0, p.yaw, 0);
      q.setFromEuler(e);
      const front = wallPose(item, 0.101);
      m.compose(v.set(front.x, y, front.z), q, sc.set(1, 1, 1));
      dial.setMatrixAt(i, m);
      e.set(Math.PI / 2, p.yaw, 0);
      q.setFromEuler(e);
      m.compose(v.set(p.x, y, p.z), q, sc.set(1, 1, 1));
      rim.setMatrixAt(i, m);
      e.set(0, p.yaw, 0);
      q.setFromEuler(e);
      m.compose(v.set(p.x, y - 0.35, p.z), q, sc.set(1, 1, 1));
      pipe.setMatrixAt(i, m);
    });
  }

  // --- Griffures ---
  const scratches = byKind.get("griffures") ?? [];
  if (scratches.length) {
    const mesh = instanced(
      own(new THREE.PlaneGeometry(0.62, 0.78)),
      own(new THREE.MeshBasicMaterial({ map: own(makeScratchTexture()), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })),
      scratches.length,
    );
    scratches.forEach((item, i) => {
      const p = wallPose(item, 0.01);
      e.set(0, p.yaw, (item.variant - 1.5) * 0.25);
      q.setFromEuler(e);
      m.compose(v.set(p.x, p.base + 0.9 + item.variant * 0.15, p.z), q, sc.set(1, 1, 1));
      mesh.setMatrixAt(i, m);
    });
  }

  // --- Gyrophares (niveau « ! ») : un socle, un dome rouge et un reflecteur qui tourne ---
  const beacons = byKind.get("gyrophare") ?? [];
  let beaconSpin: THREE.InstancedMesh | null = null;
  const beaconPoses: { x: number; y: number; z: number; phase: number }[] = [];
  const domeMat = own(new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
  if (beacons.length) {
    const base = instanced(own(new THREE.BoxGeometry(0.22, 0.08, 0.22)), own(new THREE.MeshLambertMaterial({ color: 0x1a1a1a })), beacons.length);
    const dome = instanced(own(new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)), domeMat, beacons.length);
    beaconSpin = instanced(
      own(new THREE.PlaneGeometry(0.5, 0.14)),
      own(new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })),
      beacons.length,
    );
    beacons.forEach((item, i) => {
      const p = wallPose(item, 0.2);
      const y = p.base + WH - 0.3;
      m.compose(v.set(p.x, y, p.z), q.identity(), sc.set(1, 1, 1));
      base.setMatrixAt(i, m);
      m.compose(v.set(p.x, y + 0.04, p.z), q.identity(), sc.set(1, 1, 1));
      dome.setMatrixAt(i, m);
      beaconPoses.push({ x: p.x, y: y + 0.09, z: p.z, phase: item.variant * 0.7 + i * 0.3 });
    });
  }

  // --- Flaques ---
  const puddles = byKind.get("flaque") ?? [];
  if (puddles.length) {
    const mesh = instanced(
      own(new THREE.PlaneGeometry(1, 1)),
      own(new THREE.MeshBasicMaterial({ map: own(makePuddleTexture()), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })),
      puddles.length,
    );
    puddles.forEach((item, i) => {
      const size = CS * (0.5 + item.variant * 0.15);
      e.set(-Math.PI / 2, 0, item.variant * 1.3 + item.x);
      q.setFromEuler(e);
      m.compose(v.set((item.x + 0.5) * CS, opts.floorY(item.y + 0.5) + 0.006, (item.y + 0.5) * CS), q, sc.set(size, size * 0.7, 1));
      mesh.setMatrixAt(i, m);
    });
  }

  // --- Papiers eparpilles : trois feuilles par emplacement ---
  const papers = byKind.get("papiers") ?? [];
  if (papers.length) {
    const mesh = instanced(
      own(new THREE.PlaneGeometry(0.21, 0.3)),
      own(new THREE.MeshLambertMaterial({ map: own(makePaperTexture()), polygonOffset: true, polygonOffsetFactor: -3 })),
      papers.length * 3,
    );
    papers.forEach((item, i) => {
      for (let k = 0; k < 3; k++) {
        const seed = item.x * 31 + item.y * 17 + k * 5;
        const ox = (((seed * 7) % 11) / 11 - 0.5) * CS * 0.7;
        const oz = (((seed * 13) % 11) / 11 - 0.5) * CS * 0.7;
        e.set(-Math.PI / 2, 0, seed * 0.7);
        q.setFromEuler(e);
        m.compose(v.set((item.x + 0.5) * CS + ox, opts.floorY(item.y + 0.5) + 0.008 + k * 0.002, (item.y + 0.5) * CS + oz), q, sc.set(1, 1, 1));
        mesh.setMatrixAt(i * 3 + k, m);
      }
    });
  }

  // --- Grilles d'egout ---
  const grates = byKind.get("grille") ?? [];
  if (grates.length) {
    const mesh = instanced(
      own(new THREE.PlaneGeometry(0.62, 0.62)),
      own(new THREE.MeshLambertMaterial({ map: own(makeGrateTexture()), polygonOffset: true, polygonOffsetFactor: -2 })),
      grates.length,
    );
    grates.forEach((item, i) => {
      e.set(-Math.PI / 2, 0, item.variant * (Math.PI / 2));
      q.setFromEuler(e);
      m.compose(v.set((item.x + 0.5) * CS, opts.floorY(item.y + 0.5) + 0.007, (item.y + 0.5) * CS), q, sc.set(1, 1, 1));
      mesh.setMatrixAt(i, m);
    });
  }

  // --- Palettes, contre les murs : assez basses pour marcher dessus ---
  const pallets = byKind.get("palette") ?? [];
  if (pallets.length) {
    const palletMat = own(new THREE.MeshLambertMaterial({ map: own(makePalletTexture()) }));
    const mesh = instanced(own(new THREE.BoxGeometry(1.1, 0.13, 0.9)), palletMat, pallets.length);
    const crate = instanced(own(new THREE.BoxGeometry(0.55, 0.45, 0.5)), own(new THREE.MeshLambertMaterial({ map: own(makeCardboard()) })), pallets.length);
    let crates = 0;
    pallets.forEach((item, i) => {
      const [dx, dy] = DIRS[item.dir];
      const x = (item.x + 0.5 + dx * 0.22) * CS;
      const z = (item.y + 0.5 + dy * 0.22) * CS;
      const base = opts.floorY(item.y + 0.5);
      e.set(0, Math.atan2(-dx, -dy) + (item.variant - 1.5) * 0.08, 0);
      q.setFromEuler(e);
      m.compose(v.set(x, base + 0.065, z), q, sc.set(1, 1, 1));
      mesh.setMatrixAt(i, m);
      // Un carton oublie sur une palette sur deux, pousse contre le mur.
      if (item.variant % 2 === 0) {
        m.compose(v.set(x + dx * 0.15, base + 0.36, z + dy * 0.15), q, sc.set(1, 1, 1));
        crate.setMatrixAt(crates++, m);
      }
    });
    crate.count = crates;
  }

  // --- Dalles de plafond tombees (Hall) ---
  const tiles = byKind.get("dalle") ?? [];
  if (tiles.length) {
    const hole = instanced(
      own(new THREE.PlaneGeometry(CS * 0.6, CS * 0.6)),
      own(new THREE.MeshBasicMaterial({ map: own(makeCeilingHoleTexture()), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })),
      tiles.length,
    );
    const hanging = instanced(own(new THREE.BoxGeometry(CS * 0.5, 0.02, CS * 0.5)), own(new THREE.MeshLambertMaterial({ color: 0xc8bd8c })), tiles.length);
    tiles.forEach((item, i) => {
      const x = (item.x + 0.5) * CS;
      const z = (item.y + 0.5) * CS;
      const top = opts.floorY(item.y + 0.5) + WH;
      e.set(Math.PI / 2, 0, 0);
      q.setFromEuler(e);
      m.compose(v.set(x, top - 0.005, z), q, sc.set(1, 1, 1));
      hole.setMatrixAt(i, m);
      // La dalle pend, accrochee par un coin.
      e.set(0.9 + item.variant * 0.1, item.variant * 1.2, 0.3);
      q.setFromEuler(e);
      m.compose(v.set(x + CS * 0.18, top - 0.32, z), q, sc.set(1, 1, 1));
      hanging.setMatrixAt(i, m);
    });
  }

  // --- Cables pendants ---
  const cables = byKind.get("cables") ?? [];
  if (cables.length) {
    const mesh = instanced(own(new THREE.CylinderGeometry(0.012, 0.012, 1, 5)), own(new THREE.MeshLambertMaterial({ color: 0x151515 })), cables.length * 3);
    cables.forEach((item, i) => {
      const top = opts.floorY(item.y + 0.5) + WH;
      for (let k = 0; k < 3; k++) {
        const len = 0.5 + ((item.x * 7 + item.y * 3 + k * 5) % 9) * 0.1;
        e.set((k - 1) * 0.12, 0, (item.variant - 1.5) * 0.1 + k * 0.05);
        q.setFromEuler(e);
        m.compose(v.set((item.x + 0.5) * CS + (k - 1) * 0.12, top - len / 2, (item.y + 0.5) * CS + (k - 1) * 0.08), q, sc.set(1, len, 1));
        mesh.setMatrixAt(i * 3 + k, m);
      }
    });
  }

  // --- Obstacles du niveau « ! » : casiers, distributeurs, piles de cartons ---
  if (levelId === "niveau-run") {
    const obstacles: number[] = [];
    for (let i = 0; i < data.cells.length; i++) if (data.cells[i] === CELL_PILLAR) obstacles.push(i);
    const kinds: number[][] = [[], [], []];
    for (const i of obstacles) kinds[((i * 2654435761) >>> 0) % 3].push(i);
    const side = own(new THREE.MeshLambertMaterial({ color: 0x3d4640 }));
    const top = own(new THREE.MeshLambertMaterial({ color: 0x2a302c }));
    const lockerFace = own(new THREE.MeshLambertMaterial({ map: own(makeLockerTexture()) }));
    const vendingSide = own(new THREE.MeshLambertMaterial({ color: 0x23262d }));
    // Le distributeur eclaire : sa vitre ne depend pas de la lumiere de l'alarme.
    const vendingFace = own(new THREE.MeshBasicMaterial({ map: own(makeVendingTexture()) }));
    const cardboard = own(new THREE.MeshLambertMaterial({ map: own(makeCardboard()) }));
    const h = Math.min(2.2, WH - 0.3);
    // Faces ±X : les couloirs courent le long de X, c'est la que l'on regarde.
    const lockers = instanced(own(new THREE.BoxGeometry(CS * 0.92, h, CS * 0.92)), [lockerFace, lockerFace, top, top, side, side], kinds[0].length);
    const vending = instanced(own(new THREE.BoxGeometry(CS * 0.85, h * 0.9, CS * 0.85)), [vendingFace, vendingFace, vendingSide, vendingSide, vendingSide, vendingSide], kinds[1].length);
    const stack = instanced(own(new THREE.BoxGeometry(1, 1, 1)), cardboard, kinds[2].length * 3);
    kinds[0].forEach((i, k) => {
      const x = ((i % W) + 0.5) * CS;
      const z = (Math.floor(i / W) + 0.5) * CS;
      m.compose(v.set(x, h / 2, z), q.identity(), sc.set(1, 1, 1));
      lockers.setMatrixAt(k, m);
    });
    kinds[1].forEach((i, k) => {
      const x = ((i % W) + 0.5) * CS;
      const z = (Math.floor(i / W) + 0.5) * CS;
      e.set(0, 0, ((i % 5) - 2) * 0.03);
      q.setFromEuler(e);
      m.compose(v.set(x, (h * 0.9) / 2, z), q, sc.set(1, 1, 1));
      vending.setMatrixAt(k, m);
    });
    kinds[2].forEach((i, k) => {
      const x = ((i % W) + 0.5) * CS;
      const z = (Math.floor(i / W) + 0.5) * CS;
      // Trois cartons empiles de travers, qui couvrent toute la case.
      const layers = [
        { y: 0.45, s: CS * 0.92, hh: 0.9, r: 0 },
        { y: 1.2, s: CS * 0.8, hh: 0.6, r: 0.2 },
        { y: 1.75, s: CS * 0.55, hh: 0.5, r: -0.35 },
      ];
      layers.forEach((layer, n) => {
        e.set(0, layer.r + ((i % 3) - 1) * 0.1, 0);
        q.setFromEuler(e);
        m.compose(v.set(x, layer.y, z), q, sc.set(layer.s, layer.hh, layer.s));
        stack.setMatrixAt(k * 3 + n, m);
      });
    });
  }

  return {
    group,
    update(time: number) {
      if (beaconSpin && beaconPoses.length) {
        // Tout pulse au meme rythme, chaque reflecteur tourne a son angle.
        domeMat.color.setRGB(0.6 + Math.max(0, Math.sin(time * 6)) * 0.4, 0.1, 0.05);
        beaconPoses.forEach((b, i) => {
          e.set(0, time * 5 + b.phase, 0);
          q.setFromEuler(e);
          m.compose(v.set(b.x, b.y, b.z), q, sc.set(1, 1, 1));
          beaconSpin!.setMatrixAt(i, m);
        });
        beaconSpin.instanceMatrix.needsUpdate = true;
      }
    },
    dispose() {
      for (const o of owned) o.dispose();
    },
  };
}
