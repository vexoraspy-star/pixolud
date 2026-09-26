import * as THREE from "three";
import {
  CELL_OPEN,
  CELL_PILLAR,
  DIRS,
  PROP_DIRS,
  ROOM_KINDS,
  fixtureBulb,
  type DecorItem,
  type DecorKind,
  type Dir,
  type LevelData,
  type LevelId,
  type PropItem,
  type PropKind,
} from "./backrooms";
import {
  makeCardboard,
  makeCheckerFloor,
  makeConcreteFloor,
  makeFuseBoxTexture,
  makeHotelRoomDoor,
  makeMarble,
  makeParquet,
  makeReceptionPanel,
  makeWhiteboard,
  makeWoodCrate,
} from "./backroomsTextures";

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
const POSTERS: Record<LevelId, { text: string[]; style: "bureau" | "danger" | "vapeur" | "fuite" | "piscine" | "hotel" | "noir" | "fete" }> = {
  "niveau-0": { text: ["RESTEZ CALME", "IL N'Y A PAS\nDE SORTIE", "NE FAITES\nPAS DE BRUIT", "RÉUNION\nANNULÉE"], style: "bureau" },
  "niveau-1": { text: ["ZONE B-3", "CHARGE MAX\n500 KG", "CASQUE\nOBLIGATOIRE", "ÉTEIGNEZ\nVOTRE LAMPE"], style: "danger" },
  "niveau-2": { text: ["DANGER\nVAPEUR", "NE PAS\nTOUCHER", "PRESSION\nÉLEVÉE", "ELLE\nENTEND"], style: "vapeur" },
  "niveau-3": { text: ["HAUTE\nTENSION", "NE PAS\nRÉARMER", "DANGER\nDE MORT", "IL AIME\nLE NOIR"], style: "danger" },
  "niveau-4": { text: ["OBJECTIFS\nDU MOIS", "SOURIEZ !", "RÉUNION\n9 H 00", "PERSONNE\nNE PART"], style: "bureau" },
  "niveau-37": { text: ["PAS DE\nPLONGEON", "BAIGNADE\nSURVEILLÉE", "DOUCHE\nOBLIGATOIRE", "PERSONNE NE\nSURVEILLE"], style: "piscine" },
  "niveau-run": { text: ["SORTIE →", "← SORTIE", "COUREZ", "NE VOUS\nRETOURNEZ PAS"], style: "fuite" },
  "niveau-5": { text: ["NE PAS\nDÉRANGER", "PETIT-DÉJEUNER\n7 H – 10 H", "RESTEZ DANS\nVOTRE CHAMBRE", "DÉPART :\nJAMAIS"], style: "hotel" },
  "niveau-6": { text: ["ÉTEIGNEZ\nTOUT", "ILS\nENTENDENT", "NE COUREZ\nPAS", "CHUT"], style: "noir" },
  "niveau-fun": { text: ["JOYEUX\nANNIVERSAIRE !", "BIENVENUE\nÀ LA FÊTE", "=)", "ON NE PART\nJAMAIS"], style: "fete" },
};

function makePosterTexture(text: string, style: (typeof POSTERS)[LevelId]["style"], index: number): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(256, 180);
  const exitSign = style === "fuite" && index < 2;
  const bg = {
    bureau: "#e9e1c8",
    danger: "#e7b928",
    vapeur: "#a8231a",
    fuite: exitSign ? "#0f7a3a" : "#b21d14",
    piscine: "#eef7f7",
    hotel: "#5a1418",
    noir: "#151516",
    fete: "#ffe45c",
  }[style];
  const fg = {
    bureau: "#3b3526",
    danger: "#15130e",
    vapeur: "#f4ece0",
    fuite: "#f6fff2",
    piscine: "#1d5f7c",
    hotel: "#e9d3a0",
    noir: "#d8d8cc",
    fete: "#d6246e",
  }[style];
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 180);
  if (style === "hotel") {
    // Double filet dore, comme une carte de l'hotel.
    ctx.strokeStyle = "#c9a052";
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 14, 228, 152);
    ctx.strokeRect(19, 19, 218, 142);
  }
  if (style === "fete") {
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = ["#ff5fa2", "#5fd4ff", "#8cd65f", "#c58cff"][i % 4];
      ctx.beginPath();
      ctx.arc(Math.random() * 256, Math.random() * 180, 4 + Math.random() * 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
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
  if (style === "piscine") {
    // Liseré de vaguelettes, en haut et en bas.
    ctx.strokeStyle = "#3a93b5";
    ctx.lineWidth = 4;
    for (const y of [18, 162]) {
      ctx.beginPath();
      for (let x = 10; x <= 246; x += 4) ctx.lineTo(x, y + Math.sin(x * 0.12) * 4);
      ctx.stroke();
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
  let size = lines.some((l) => l.length > 11) ? 30 : exitSign ? 46 : 38;
  ctx.font = `bold ${size}px sans-serif`;
  // Les lignes trop longues (« PETIT-DEJEUNER ») retrecissent au lieu de deborder.
  while (size > 16 && Math.max(...lines.map((l) => ctx.measureText(l).width)) > 232) {
    size -= 2;
    ctx.font = `bold ${size}px sans-serif`;
  }
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

// ---------------------------------------------------------------------------
// Textures du decor des niveaux 5, 6 et Fun
// ---------------------------------------------------------------------------

/** Tableaux de l'hotel, cadre dore compris : 0 paysage, 1 portrait sans visage, 2 tempete, 3 un couloir jaune. */
function makePaintingTexture(variant: number): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(256, 200);
  const inner = { x: 22, y: 22, w: 212, h: 156 };
  if (variant === 0) {
    const sky = ctx.createLinearGradient(0, inner.y, 0, inner.y + inner.h);
    sky.addColorStop(0, "#3b2a4a");
    sky.addColorStop(0.55, "#c46a3a");
    sky.addColorStop(1, "#2a1a10");
    ctx.fillStyle = sky;
    ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
    ctx.fillStyle = "#1d140c";
    ctx.beginPath();
    ctx.moveTo(inner.x, 150);
    ctx.quadraticCurveTo(90, 110, 150, 140);
    ctx.quadraticCurveTo(200, 120, inner.x + inner.w, 135);
    ctx.lineTo(inner.x + inner.w, inner.y + inner.h);
    ctx.lineTo(inner.x, inner.y + inner.h);
    ctx.fill();
    // Une maison au loin, une seule fenetre allumee.
    ctx.fillRect(160, 118, 22, 18);
    ctx.beginPath();
    ctx.moveTo(157, 118);
    ctx.lineTo(171, 106);
    ctx.lineTo(185, 118);
    ctx.fill();
    ctx.fillStyle = "#ffd27a";
    ctx.fillRect(166, 123, 5, 5);
  } else if (variant === 1) {
    ctx.fillStyle = "#1b1410";
    ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
    const halo = ctx.createRadialGradient(128, 90, 10, 128, 90, 90);
    halo.addColorStop(0, "rgba(120,90,60,0.5)");
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
    // Epaules et costume.
    ctx.fillStyle = "#0e0b09";
    ctx.beginPath();
    ctx.moveTo(70, inner.y + inner.h);
    ctx.quadraticCurveTo(80, 128, 128, 124);
    ctx.quadraticCurveTo(176, 128, 186, inner.y + inner.h);
    ctx.fill();
    ctx.fillStyle = "#d8cfc0";
    ctx.beginPath();
    ctx.moveTo(118, 128);
    ctx.lineTo(128, 150);
    ctx.lineTo(138, 128);
    ctx.fill();
    // Le visage : lisse, sans rien. Personne n'a su le peindre.
    ctx.fillStyle = "#c9a88a";
    ctx.beginPath();
    ctx.ellipse(128, 86, 26, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a1a10";
    ctx.beginPath();
    ctx.ellipse(128, 58, 27, 12, 0, Math.PI, Math.PI * 2);
    ctx.fill();
  } else if (variant === 2) {
    const sea = ctx.createLinearGradient(0, inner.y, 0, inner.y + inner.h);
    sea.addColorStop(0, "#2a3238");
    sea.addColorStop(0.45, "#3d4a4a");
    sea.addColorStop(1, "#0f2224");
    ctx.fillStyle = sea;
    ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
    ctx.strokeStyle = "rgba(200,220,210,0.45)";
    ctx.lineWidth = 2;
    for (let y = 100; y < 176; y += 12) {
      ctx.beginPath();
      for (let x = inner.x; x <= inner.x + inner.w; x += 6) ctx.lineTo(x, y + Math.sin(x * 0.08 + y) * 5);
      ctx.stroke();
    }
    // Un navire qui gite.
    ctx.save();
    ctx.translate(120, 104);
    ctx.rotate(-0.3);
    ctx.fillStyle = "#0b0908";
    ctx.fillRect(-26, 0, 52, 10);
    ctx.fillRect(-2, -40, 4, 40);
    ctx.beginPath();
    ctx.moveTo(2, -38);
    ctx.lineTo(24, -8);
    ctx.lineTo(2, -8);
    ctx.fill();
    ctx.restore();
  } else {
    // Un couloir jaune, des neons : quelqu'un d'ici connaissait le Hall.
    ctx.fillStyle = "#c2ac56";
    ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
    ctx.fillStyle = "#8b7638";
    ctx.beginPath();
    ctx.moveTo(inner.x, inner.y + inner.h);
    ctx.lineTo(112, 108);
    ctx.lineTo(144, 108);
    ctx.lineTo(inner.x + inner.w, inner.y + inner.h);
    ctx.fill();
    ctx.fillStyle = "#d8cd9f";
    ctx.beginPath();
    ctx.moveTo(inner.x, inner.y);
    ctx.lineTo(112, 84);
    ctx.lineTo(144, 84);
    ctx.lineTo(inner.x + inner.w, inner.y);
    ctx.fill();
    ctx.fillStyle = "#6e5a2c";
    ctx.fillRect(112, 84, 32, 24);
    ctx.fillStyle = "#fffbe6";
    for (const [y, w] of [
      [34, 60],
      [56, 34],
      [72, 16],
    ]) {
      ctx.fillRect(128 - w / 2, y, w, 5);
    }
  }
  // Cadre dore.
  ctx.strokeStyle = "#8a6a2a";
  ctx.lineWidth = 22;
  ctx.strokeRect(11, 11, 234, 178);
  ctx.strokeStyle = "#d8b766";
  ctx.lineWidth = 4;
  ctx.strokeRect(5, 5, 246, 190);
  ctx.strokeStyle = "rgba(40,25,5,0.8)";
  ctx.lineWidth = 2;
  ctx.strokeRect(21, 21, 214, 158);
  speckle(ctx, 256, 200, 300, 0.12);
  return finish(canvas);
}

/** Empreintes de pattes mouillees, en file : de grosses pattes, trop grosses pour un chien. */
function makePawTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(128, 256);
  ctx.clearRect(0, 0, 128, 256);
  const paw = (x: number, y: number, a: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = "rgba(14,12,10,0.8)";
    ctx.beginPath();
    ctx.ellipse(0, 6, 11, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const [tx, ty] of [
      [-11, -8],
      [-4, -14],
      [4, -14],
      [11, -8],
    ]) {
      ctx.beginPath();
      ctx.ellipse(tx, ty, 4, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Les griffes.
      ctx.fillRect(tx - 0.8, ty - 11, 1.6, 5);
    }
    ctx.restore();
  };
  paw(42, 216, 0.1);
  paw(86, 160, -0.08);
  paw(40, 100, 0.12);
  paw(84, 42, -0.1);
  return finish(canvas);
}

/** Confettis sur fond transparent. */
function makeConfettiTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(256, 256);
  ctx.clearRect(0, 0, 256, 256);
  const colors = ["#ff4fa0", "#3fd8ff", "#ffe04a", "#7dff6a", "#c58cff", "#ff9a4a", "#ffffff"];
  for (let i = 0; i < 220; i++) {
    const r = Math.hypot(Math.random() - 0.5, Math.random() - 0.5);
    if (r > 0.5) continue;
    ctx.save();
    ctx.translate(Math.random() * 236 + 10, Math.random() * 236 + 10);
    ctx.rotate(Math.random() * Math.PI);
    ctx.fillStyle = colors[i % colors.length];
    if (i % 3 === 0) {
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    } else ctx.fillRect(-4, -1.5, 8, 3);
    ctx.restore();
  }
  return finish(canvas);
}

/** Guirlande de fanions : une ficelle qui pend et des triangles de couleur, fond transparent. */
function makeBuntingTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(512, 128);
  ctx.clearRect(0, 0, 512, 128);
  const sag = (x: number) => 14 + Math.sin((x / 512) * Math.PI) * 22;
  const colors = ["#ff4f8f", "#ffd23f", "#3fc8ff", "#7ee05a", "#b27cff", "#ff8a3d"];
  for (let k = 0; k < 9; k++) {
    const x0 = 8 + k * 56;
    const x1 = x0 + 44;
    ctx.fillStyle = colors[k % colors.length];
    ctx.beginPath();
    ctx.moveTo(x0, sag(x0));
    ctx.lineTo(x1, sag(x1));
    ctx.lineTo((x0 + x1) / 2, sag((x0 + x1) / 2) + 60);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.moveTo(x0 + 6, sag(x0) + 3);
    ctx.lineTo(x0 + 16, sag(x0) + 3);
    ctx.lineTo((x0 + x1) / 2 - 4, sag((x0 + x1) / 2) + 40);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = "#f4f0e6";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 0; x <= 512; x += 8) ctx.lineTo(x, sag(x));
  ctx.stroke();
  return finish(canvas);
}

/** Papier cadeau clair (rayures et pois), teinte ensuite par cadeau. */
function makeGiftWrap(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(128, 128);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  for (let x = -128; x < 256; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 10, 0);
    ctx.lineTo(x + 138, 128);
    ctx.lineTo(x + 128, 128);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  for (let y = 12; y < 128; y += 24) for (let x = 12; x < 128; x += 24) {
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(canvas);
}

/** Flanc du gateau geant : glacage rose, coulures blanches, vermicelles, et un sourire poche en creme. */
function makeCakeTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(512, 160);
  ctx.fillStyle = "#f7a8c8";
  ctx.fillRect(0, 0, 512, 160);
  ctx.fillStyle = "#e88ab0";
  ctx.fillRect(0, 118, 512, 42);
  // Coulures de creme depuis le haut.
  ctx.fillStyle = "#fff6f9";
  ctx.fillRect(0, 0, 512, 16);
  for (let x = 0; x < 512; x += 18) {
    const len = 14 + ((x * 37) % 41);
    ctx.beginPath();
    ctx.moveTo(x, 10);
    ctx.lineTo(x + 12, 10);
    ctx.lineTo(x + 12, 10 + len);
    ctx.arc(x + 6, 10 + len, 6, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
  }
  const sprinkles = ["#ff3b6b", "#3bb8ff", "#ffe14a", "#6ee05a", "#ffffff", "#b27cff"];
  for (let i = 0; i < 260; i++) {
    ctx.save();
    ctx.translate(Math.random() * 512, 40 + Math.random() * 110);
    ctx.rotate(Math.random() * Math.PI);
    ctx.fillStyle = sprinkles[i % sprinkles.length];
    ctx.fillRect(-4, -1.2, 8, 2.4);
    ctx.restore();
  }
  // Un sourire en creme, sur chaque face.
  for (const cx of [128, 384]) {
    ctx.strokeStyle = "#fff6f9";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(cx, 72, 30, 0.25, Math.PI - 0.25);
    ctx.stroke();
    ctx.fillStyle = "#fff6f9";
    ctx.fillRect(cx - 18, 56, 8, 14);
    ctx.fillRect(cx + 10, 56, 8, 14);
  }
  const t = finish(canvas);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** Nappe de fete : rose pale, pois blancs, dentelle au bord. */
function makeTableclothTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(256, 256);
  ctx.fillStyle = "#ffd6e8";
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "#ffffff";
  for (let row = 0, y = 16; y < 230; row++, y += 32) {
    for (let x = row % 2 === 0 ? 16 : 32; x < 256; x += 32) {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (let x = 0; x < 256; x += 16) {
    ctx.beginPath();
    ctx.arc(x + 8, 240, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(120,60,40,0.2)";
  ctx.beginPath();
  ctx.ellipse(40 + Math.random() * 170, 60 + Math.random() * 120, 16, 10, Math.random(), 0, Math.PI * 2);
  ctx.fill();
  speckle(ctx, 256, 256, 200, 0.06);
  return finish(canvas);
}

/** Fonte de chaudiere : toles rivetees, noircies, coulures de rouille. */
function makeBoilerTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(512, 256);
  ctx.fillStyle = "#2b2622";
  ctx.fillRect(0, 0, 512, 256);
  for (let y = 0; y < 256; y += 64) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, y, 512, 4);
    for (let x = 8; x < 512; x += 24) {
      ctx.fillStyle = "rgba(10,8,6,0.8)";
      ctx.beginPath();
      ctx.arc(x + 1, y + 12, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(150,120,90,0.35)";
      ctx.beginPath();
      ctx.arc(x - 1, y + 10, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (let i = 0; i < 18; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 200;
    const len = 30 + Math.random() * 120;
    const g = ctx.createLinearGradient(0, y, 0, y + len);
    g.addColorStop(0, "rgba(140,62,22,0.55)");
    g.addColorStop(1, "rgba(140,62,22,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, 2 + Math.random() * 6, len);
  }
  speckle(ctx, 512, 256, 900, 0.2);
  const t = finish(canvas);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** Boule a facettes : des carres de miroir plus ou moins clairs. */
function makeMirrorBallTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(256, 128);
  for (let y = 0; y < 128; y += 8) {
    for (let x = 0; x < 256; x += 8) {
      const v = 90 + Math.random() * 165;
      ctx.fillStyle = Math.random() < 0.06 ? "#ffffff" : `rgb(${v * 0.9},${v * 0.92},${v})`;
      ctx.fillRect(x, y, 7, 7);
    }
  }
  const t = finish(canvas);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** Draps d'hotel : blanc casse, plis, une tache qu'on n'a pas lavee. */
function makeSheetTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(128, 128);
  ctx.fillStyle = "#ddd6c8";
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = "rgba(120,110,95,0.3)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const y = Math.random() * 128;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(40, y + 10, 80, y - 10, 128, y + 4);
    ctx.stroke();
  }
  if (Math.random() < 0.7) {
    ctx.fillStyle = "rgba(90,40,25,0.25)";
    ctx.beginPath();
    ctx.ellipse(40 + Math.random() * 50, 40 + Math.random() * 50, 14, 9, Math.random(), 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(canvas);
}

/** Atlas des plaques de numero de chambre : laiton, chiffres graves. */
function makePlateAtlas(numbers: number[], cols: number, rows: number, cw: number, ch: number): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(cols * cw, rows * ch);
  numbers.forEach((n, k) => {
    const s = k % (cols * rows);
    const x = (s % cols) * cw;
    const y = Math.floor(s / cols) * ch;
    const g = ctx.createLinearGradient(x, y, x, y + ch);
    g.addColorStop(0, "#dcbc6c");
    g.addColorStop(1, "#8a6a2a");
    ctx.fillStyle = g;
    ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);
    ctx.strokeStyle = "#3a2a0a";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 3, y + 3, cw - 6, ch - 6);
    ctx.fillStyle = "#1e1406";
    ctx.font = "bold 20px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(n), x + cw / 2, y + ch / 2 + 1);
  });
  return finish(canvas);
}

const GIFT_COLORS = [0xff4f8f, 0x3fb8ff, 0xffd23f, 0x6ee05a, 0xb27cff, 0xff8a3d, 0xf4f4f4];
const BALLOON_COLORS = [0xff3b6b, 0x3bb8ff, 0xffd23f, 0x6ee05a, 0xb27cff, 0xff8a3d, 0xff9ccb];
const CAKE_TINTS = [0xffffff, 0xd8ffe8, 0xfff2c8, 0xffd8f0];
const DANCE_COLORS = [0xff4fa0, 0x3fd8ff, 0xffe04a, 0x7dff6a, 0xc58cff];
const SUITCASE_COLORS = [0x4a2a18, 0x1c1c1e, 0x6a1c20, 0x2a3a4a];

/** Petit hachage deterministe (0..1) : la meme case garde le meme aspect. */
function hash01(a: number, b: number, c: number): number {
  return (((Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791)) >>> 0) % 100003) / 100003;
}

/**
 * Objets pleins que ce fichier sait dessiner. Un genre absent de cette liste
 * est dessine en pile de caisses : jamais de case pleine invisible.
 */
type AnyPropKind = PropKind;
const DRAWN_PROPS: readonly string[] = [
  "colonne",
  "gateau",
  "chaudiere",
  "lit",
  "chariot",
  "table",
  "chaise",
  "caisse",
  "vanne-geante",
  "comptoir",
] satisfies readonly AnyPropKind[];

const PARTY_CLOTHS = [0xffffff, 0xd8ecff, 0xfff2c4, 0xdcffd4];
const CRATE_TINTS = [0xffffff, 0xe6dccb, 0xd2c3a8, 0xf2e2c8];
const BLANKETS = [0x6a1418, 0x5a4a2a, 0x2a3a5a, 0x4a1a3a];
/** Demi-largeur et demi-hauteur d'un ballon (m). */
const BALLOON_RX = 0.2;
const BALLOON_RY = 0.25;
const MIRROR_BALL_R = 0.34;

/** Rectangle interieur d'une salle, bornes incluses, en cases. */
interface CellRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
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
  function wallPose(item: { x: number; y: number; dir: Dir }, inset: number) {
    const [dx, dy] = DIRS[item.dir];
    return {
      x: (item.x + 0.5 + dx * 0.5) * CS - dx * inset,
      z: (item.y + 0.5 + dy * 0.5) * CS - dy * inset,
      yaw: Math.atan2(-dx, -dy),
      base: opts.floorY(item.y + 0.5),
    };
  }

  // Euler a part (ordre lacet d'abord) : ne pas changer l'ordre de `e`, dont
  // dependent les objets plus anciens.
  const ey = new THREE.Euler(0, 0, 0, "YXZ");
  /**
   * Compose dans `m` : centre (x, y, z), lacet `yaw`, decalage local (lx, lz)
   * qui tourne avec le lacet (+z local = devant), echelle, puis tangage et
   * roulis. Ordre lacet-tangage-roulis : un cylindre couche par `roll`
   * (axe x local) ou `pitch` (axe z local) suit ensuite le lacet.
   */
  function pose(x: number, y: number, z: number, yaw: number, lx: number, lz: number, sx: number, sy: number, sz: number, pitch: number, roll: number): THREE.Matrix4 {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    ey.set(pitch, yaw, roll);
    q.setFromEuler(ey);
    return m.compose(v.set(x + lx * c + lz * s, y, z - lx * s + lz * c), q, sc.set(sx, sy, sz));
  }
  /** Place l'instance `idx` d'une InstancedMesh deja creee (voir `pose`). */
  function place(mesh: THREE.InstancedMesh, idx: number, x: number, y: number, z: number, yaw: number, lx = 0, lz = 0, sx = 1, sy = 1, sz = 1, pitch = 0, roll = 0) {
    mesh.setMatrixAt(idx, pose(x, y, z, yaw, lx, lz, sx, sy, sz, pitch, roll));
  }
  const tint = new THREE.Color();

  function instanced(geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], count: number) {
    // Possedee elle aussi : sa liberation rend les tampons d'instances a la carte graphique.
    const mesh = own(new THREE.InstancedMesh(geo, mat, Math.max(1, count)));
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

  // ===========================================================================
  // Niveaux 5, 6, Fun et salles marquantes
  // ===========================================================================
  // Tout passe par des lots : chaque piece (pied de chaise, abat-jour,
  // ballon...) devient UNE InstancedMesh, remplie objet par objet puis creee
  // au compte exact. Les matrices sont calculees ici, une seule fois ;
  // `update` ne retouche que les quelques objets animes, sans rien allouer.

  interface Batch {
    geo: THREE.BufferGeometry;
    mat: THREE.Material | THREE.Material[];
    matrices: number[];
    /** Teinte de chaque instance (hex), -1 pour la laisser telle quelle. */
    colors: number[];
    mesh: THREE.InstancedMesh | null;
  }
  const batches: Batch[] = [];
  function batch(geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[]): Batch {
    const b: Batch = { geo, mat, matrices: [], colors: [], mesh: null };
    batches.push(b);
    return b;
  }
  /** Ajoute une instance au lot (memes arguments que `pose`), teintee par `color` si ce n'est pas -1. */
  function put(b: Batch, x: number, y: number, z: number, yaw = 0, lx = 0, lz = 0, sx = 1, sy = 1, sz = 1, pitch = 0, roll = 0, color = -1) {
    const el = pose(x, y, z, yaw, lx, lz, sx, sy, sz, pitch, roll).elements;
    for (let k = 0; k < 16; k++) b.matrices.push(el[k]);
    b.colors.push(color);
  }
  const lambert = (p: THREE.MeshLambertMaterialParameters) => own(new THREE.MeshLambertMaterial(p));
  const basic = (p: THREE.MeshBasicMaterialParameters) => own(new THREE.MeshBasicMaterial(p));
  const geoCache = new Map<string, THREE.BufferGeometry>();
  /** Geometrie partagee entre les lots, creee a la premiere demande. */
  function shared(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
    let g = geoCache.get(key);
    if (!g) {
      g = own(make());
      geoCache.set(key, g);
    }
    return g;
  }
  const unitBox = () => shared("box", () => new THREE.BoxGeometry(1, 1, 1));
  const unitCyl = (seg: number) => shared(`cyl${seg}`, () => new THREE.CylinderGeometry(1, 1, 1, seg));
  const unitPlane = () => shared("plane", () => new THREE.PlaneGeometry(1, 1));
  const unitSphere = () => shared("sphere", () => new THREE.SphereGeometry(1, 16, 12));
  let brassMat: THREE.MeshLambertMaterial | null = null;
  const brass = () => (brassMat ??= lambert({ color: 0xc9a052, emissive: 0x2a1c05 }));
  const FLAT = -Math.PI / 2;

  /** Repete le motif des quatre flancs d'un pave tous les `period` metres, sans l'etirer (dessus et dessous inchanges). */
  function repeatSides(geo: THREE.BufferGeometry, sx: number, sz: number, period: number) {
    const uv = geo.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) {
      // Faces du BoxGeometry, quatre sommets chacune : +x, -x, +y, -y, +z, -z.
      const face = Math.floor(i / 4);
      if (face === 2 || face === 3) continue;
      uv.setX(i, uv.getX(i) * Math.max(1, Math.round((face < 2 ? sz : sx) / period)));
    }
    uv.needsUpdate = true;
  }

  // --- Objets pleins : chaque case CELL_PROP a sa forme, jamais de mur invisible ---
  const propsByKind = new Map<string, PropItem[]>();
  for (const p of data.props) {
    const list = propsByKind.get(p.kind);
    if (list) list.push(p);
    else propsByKind.set(p.kind, [p]);
  }
  const propsOf = (kind: AnyPropKind) => propsByKind.get(kind) ?? [];
  /** Emprise d'un objet en metres : centre, largeur (x), profondeur (z) et hauteur du sol. */
  function footprint(p: PropItem) {
    const w = (p.x1 - p.x0 + 1) * CS;
    const d = (p.y1 - p.y0 + 1) * CS;
    return { cx: p.x0 * CS + w / 2, cz: p.y0 * CS + d / 2, w, d, base: opts.floorY((p.y0 + p.y1 + 1) / 2) };
  }
  /** Lacet qui tourne le +z local vers `dir`. */
  const yawTo = (dir: Dir) => Math.atan2(DIRS[dir][0], DIRS[dir][1]);
  const propDir = (variant: number): Dir => PROP_DIRS[((variant % 4) + 4) % 4];

  // Colonnes de marbre : socle, tore, fut, chapiteau et tailloir contre le plafond.
  const columns = propsOf("colonne");
  if (columns.length) {
    const marble = own(makeMarble());
    marble.repeat.set(2, 1);
    const stone = lambert({ map: marble, color: 0xcfc6b4 });
    const bBlock = batch(unitBox(), stone);
    const bTorus = batch(unitCyl(20), stone);
    const bShaft = batch(shared("fut", () => new THREE.CylinderGeometry(1, 1, 1, 20, 1, true)), lambert({ map: marble }));
    const bCapital = batch(shared("chapiteau", () => new THREE.CylinderGeometry(1.3, 1, 1, 20)), stone);
    for (const p of columns) {
      const f = footprint(p);
      const side = Math.min(f.w, f.d);
      const r = side * 0.3;
      const top = f.base + WH;
      put(bBlock, f.cx, f.base + 0.11, f.cz, 0, 0, 0, f.w - side * 0.16, 0.22, f.d - side * 0.16);
      put(bTorus, f.cx, f.base + 0.29, f.cz, 0, 0, 0, r * 1.22, 0.14, r * 1.22);
      put(bShaft, f.cx, (f.base + 0.36 + top - 0.4) / 2, f.cz, 0, 0, 0, r, WH - 0.76, r);
      put(bCapital, f.cx, top - 0.31, f.cz, 0, 0, 0, r, 0.18, r);
      put(bBlock, f.cx, top - 0.11, f.cz, 0, 0, 0, f.w - side * 0.16, 0.22, f.d - side * 0.16);
    }
  }

  // Gateau geant : trois etages sur un plateau qui couvre toute l'emprise, bougies au sommet.
  let flameMat: THREE.MeshBasicMaterial | null = null;
  const cakes = propsOf("gateau");
  if (cakes.length) {
    const cakeTex = own(makeCakeTexture());
    cakeTex.repeat.set(4, 1);
    const cream = lambert({ color: 0xfff1f6 });
    const bTier = batch(shared("etage", () => new THREE.CylinderGeometry(1, 1, 1, 40)), [lambert({ map: cakeTex }), cream, cream]);
    const bBoard = batch(unitBox(), lambert({ color: 0xd9d2c4 }));
    const bCandle = batch(unitCyl(8), lambert({ color: 0xffffff }));
    flameMat = basic({ color: 0xffb347 });
    const bFlame = batch(shared("flamme", () => new THREE.ConeGeometry(1, 1, 8)), flameMat);
    const total = Math.max(1.2, Math.min(2.3, WH - 1));
    for (const p of cakes) {
      const f = footprint(p);
      const R = Math.min(f.w, f.d) / 2;
      const cakeTint = CAKE_TINTS[p.variant % CAKE_TINTS.length];
      put(bBoard, f.cx, f.base + 0.05, f.cz, 0, 0, 0, f.w - 0.06, 0.1, f.d - 0.06);
      let y = f.base + 0.1;
      let topR = R;
      for (const [rk, hk] of [
        [0.9, 0.4],
        [0.64, 0.32],
        [0.4, 0.28],
      ]) {
        const h = total * hk;
        topR = R * rk;
        put(bTier, f.cx, y + h / 2, f.cz, p.variant * 0.8, 0, 0, topR, h, topR, 0, 0, cakeTint);
        y += h;
      }
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + p.variant;
        const x = f.cx + Math.cos(a) * topR * 0.62;
        const z = f.cz + Math.sin(a) * topR * 0.62;
        put(bCandle, x, y + 0.17, z, 0, 0, 0, 0.045, 0.34, 0.045, 0, 0, BALLOON_COLORS[(k + p.variant) % BALLOON_COLORS.length]);
        put(bFlame, x, y + 0.4, z, 0, 0, 0, 0.04, 0.12, 0.04);
      }
    }
  }

  // Chaudieres : caisson de tole rivetee, dome, conduit jusqu'au plafond, porte du foyer qui rougeoie.
  let glowMat: THREE.MeshBasicMaterial | null = null;
  const boilers = propsOf("chaudiere");
  if (boilers.length) {
    const boilerTex = own(makeBoilerTexture());
    boilerTex.repeat.set(1, 2);
    const iron = lambert({ map: boilerTex });
    const soot = lambert({ color: 0x1c1916 });
    const bBody = batch(unitBox(), [iron, iron, soot, soot, iron, iron]);
    const bDome = batch(unitCyl(20), iron);
    const bFlue = batch(unitCyl(12), lambert({ color: 0x2b2622 }));
    const bDoor = batch(unitBox(), soot);
    glowMat = basic({ color: 0xff6a1a });
    const bGlow = batch(unitPlane(), glowMat);
    const bDial = batch(shared("cadran", () => new THREE.CircleGeometry(1, 20)), lambert({ map: own(makeGaugeTexture()) }));
    const bodyH = Math.max(1.4, Math.min(2.2, WH - 0.9));
    for (const p of boilers) {
      const f = footprint(p);
      const dir = propDir(p.variant);
      const yaw = yawTo(dir);
      const facingX = DIRS[dir][0] !== 0;
      // Du centre a la face du foyer, et largeur de cette face.
      const half = (facingX ? f.w : f.d) * 0.45;
      const across = (facingX ? f.d : f.w) * 0.9;
      put(bBody, f.cx, f.base + bodyH / 2, f.cz, 0, 0, 0, f.w * 0.9, bodyH, f.d * 0.9);
      const domeR = Math.min(f.w, f.d) * 0.3;
      put(bDome, f.cx, f.base + bodyH + 0.15, f.cz, 0, 0, 0, domeR, 0.3, domeR);
      const flueLo = f.base + bodyH + 0.3;
      const flueHi = f.base + WH;
      if (flueHi - flueLo > 0.05) put(bFlue, f.cx, (flueLo + flueHi) / 2, f.cz, 0, 0, 0, 0.16, flueHi - flueLo, 0.16);
      put(bDoor, f.cx, f.base + 0.7, f.cz, yaw, 0, half + 0.03, Math.min(0.8, across * 0.45), 0.62, 0.06);
      put(bGlow, f.cx, f.base + 0.6, f.cz, yaw, 0, half + 0.062, Math.min(0.6, across * 0.34), 0.09, 1);
      put(bDial, f.cx, f.base + bodyH - 0.45, f.cz, yaw, across * 0.3, half + 0.004, 0.16, 0.16, 1);
    }
  }

  // Lits d'hotel : cadre, matelas, oreillers, couverture ; la tete de lit contre le mur `variant`.
  const beds = propsOf("lit");
  if (beds.length) {
    const bWood = batch(unitBox(), lambert({ color: 0x3a1d10 }));
    const bLinen = batch(unitBox(), lambert({ map: own(makeSheetTexture()) }));
    const blanket = lambert({ color: 0xffffff });
    const bBlanket = batch(unitBox(), blanket);
    const bLump = batch(unitSphere(), blanket);
    for (const p of beds) {
      const f = footprint(p);
      const dir = propDir(p.variant);
      const yaw = yawTo(dir);
      const facingX = DIRS[dir][0] !== 0;
      const L = (facingX ? f.w : f.d) * 0.94;
      const wide = (facingX ? f.d : f.w) * 0.8;
      const b = f.base;
      const color = BLANKETS[Math.floor(hash01(p.x0, p.y0, 51) * BLANKETS.length)];
      put(bWood, f.cx, b + 0.19, f.cz, yaw, 0, 0, wide, 0.38, L);
      put(bLinen, f.cx, b + 0.48, f.cz, yaw, 0, -0.04, wide * 0.96, 0.2, L - 0.14);
      put(bWood, f.cx, b + 0.6, f.cz, yaw, 0, L / 2 - 0.045, wide * 1.04, 1.2, 0.09);
      for (const s of [-1, 1]) put(bLinen, f.cx, b + 0.645, f.cz, yaw, s * wide * 0.22, L / 2 - 0.36, wide * 0.38, 0.13, 0.36);
      put(bBlanket, f.cx, b + 0.6, f.cz, yaw, 0, -L * 0.18, wide, 0.07, L * 0.58, 0, 0, color);
      // Un lit sur quatre n'est pas vide.
      if (hash01(p.x0, p.y0, 52) < 0.25) put(bLump, f.cx, b + 0.62, f.cz, yaw, wide * 0.08, -L * 0.06, 0.24, 0.14, L * 0.36, 0, 0, color);
    }
  }

  // Chariots a bagages : plateau moquette, arceau de laiton, valises empilees.
  const carts = propsOf("chariot");
  if (carts.length) {
    const bRod = batch(unitCyl(8), brass());
    const bArch = batch(shared("arceau", () => new THREE.TorusGeometry(1, 0.035, 6, 18, Math.PI)), brass());
    const bDeck = batch(unitBox(), lambert({ color: 0x5a1418 }));
    const bWheel = batch(unitCyl(10), lambert({ color: 0x141414 }));
    const bCase = batch(unitBox(), lambert({ color: 0xffffff }));
    for (const p of carts) {
      const f = footprint(p);
      const side = Math.min(f.w, f.d);
      const yaw = (hash01(p.x0, p.y0, 61) < 0.5 ? 0 : Math.PI / 2) + (hash01(p.x0, p.y0, 62) - 0.5) * 0.5;
      const hw = side * 0.36;
      const hd = side * 0.22;
      const b = f.base;
      put(bDeck, f.cx, b + 0.2, f.cz, yaw, 0, 0, hw * 2, 0.06, hd * 2);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) put(bWheel, f.cx, b + 0.085, f.cz, yaw, sx * hw * 0.85, sz * hd * 0.8, 0.085, 0.05, 0.085, 0, Math.PI / 2);
      }
      const postTop = b + Math.max(0.9, Math.min(1.55, WH - 0.4 - hw));
      for (const sx of [-1, 1]) put(bRod, f.cx, (b + 0.23 + postTop) / 2, f.cz, yaw, sx * hw, 0, 0.022, postTop - b - 0.23, 0.022);
      put(bArch, f.cx, postTop, f.cz, yaw, 0, 0, hw, hw, hw);
      put(bRod, f.cx, postTop - 0.25, f.cz, yaw, 0, 0, 0.018, hw * 2, 0.018, 0, Math.PI / 2);
      let y = b + 0.23;
      const n = 2 + (p.variant % 2);
      for (let k = 0; k < n; k++) {
        const h = 0.2 + hash01(p.x0 + k, p.y0, 63) * 0.14;
        const turn = (hash01(p.x0, p.y0 + k, 64) - 0.5) * 0.3;
        const color = SUITCASE_COLORS[(p.variant + k) % SUITCASE_COLORS.length];
        put(bCase, f.cx, y + h / 2, f.cz, yaw + turn, 0, 0, hw * 2 * (0.9 - k * 0.12), h, hd * 2 * (0.85 - k * 0.08), 0, 0, color);
        y += h;
      }
    }
  }

  // Tables : nappe de fete au niveau Fun, table de reunion ailleurs.
  const tables = propsOf("table");
  const tableCells = new Set<number>();
  for (const p of tables) {
    for (let y = p.y0; y <= p.y1; y++) for (let x = p.x0; x <= p.x1; x++) tableCells.add(y * W + x);
  }
  if (tables.length && levelId === "niveau-fun") {
    const bCloth = batch(unitBox(), lambert({ map: own(makeTableclothTexture()) }));
    const bCup = batch(unitCyl(10), lambert({ color: 0xffffff }));
    const bPlate = batch(unitCyl(16), lambert({ color: 0xf4f0ea }));
    for (const p of tables) {
      const f = footprint(p);
      put(bCloth, f.cx, f.base + 0.38, f.cz, 0, 0, 0, f.w - CS * 0.08, 0.76, f.d - CS * 0.16, 0, 0, PARTY_CLOTHS[p.variant % PARTY_CLOTHS.length]);
      const top = f.base + 0.76;
      for (let k = 0; k < 6; k++) {
        const x = f.cx + (hash01(p.x0, p.y0, 70 + k) - 0.5) * (f.w - CS * 0.5);
        const z = f.cz + (hash01(p.x0, p.y0, 80 + k) - 0.5) * (f.d - CS * 0.5);
        if (k < 4) put(bCup, x, top + 0.055, z, 0, 0, 0, 0.04, 0.11, 0.04, 0, 0, BALLOON_COLORS[(k + p.variant) % BALLOON_COLORS.length]);
        else put(bPlate, x, top + 0.008, z, 0, 0, 0, 0.13, 0.016, 0.13);
      }
    }
  } else if (tables.length) {
    const bTop = batch(unitBox(), lambert({ color: 0x5b3b24 }));
    const bLeg = batch(unitBox(), lambert({ color: 0x4a4d52 }));
    const bPhone = batch(unitCyl(16), lambert({ color: 0x1b1b1d }));
    const bPaper = batch(
      shared("feuille", () => new THREE.PlaneGeometry(0.21, 0.3)),
      lambert({ map: own(makePaperTexture()), polygonOffset: true, polygonOffsetFactor: -3 }),
    );
    for (const p of tables) {
      const f = footprint(p);
      const alongX = f.w >= f.d;
      const L = alongX ? f.w : f.d;
      const D = alongX ? f.d : f.w;
      const yaw = alongX ? 0 : Math.PI / 2;
      const top = f.base + 0.75;
      put(bTop, f.cx, top - 0.025, f.cz, yaw, 0, 0, L - CS * 0.08, 0.05, D - CS * 0.2);
      for (const s of [-1, 1]) put(bLeg, f.cx, f.base + 0.36, f.cz, yaw, s * (L / 2 - 0.35), 0, 0.07, 0.72, D * 0.6);
      // Voile de fond sur toute la longueur : la table se lit comme un bloc, d'un bout a l'autre.
      put(bTop, f.cx, top - 0.3, f.cz, yaw, 0, 0, L - 0.8, 0.5, 0.03);
      // Pieuvre de conference au centre, quelques feuilles oubliees.
      put(bPhone, f.cx, top + 0.02, f.cz, 0, 0, 0, 0.14, 0.04, 0.14);
      const c = Math.cos(yaw);
      const s = Math.sin(yaw);
      for (let k = 0; k < 3; k++) {
        const lx = (hash01(p.x0, p.y0, 90 + k) - 0.5) * (L - 0.8);
        const lz = (hash01(p.x0, p.y0, 95 + k) - 0.5) * (D - CS * 0.5);
        put(bPaper, f.cx + lx * c + lz * s, top + 0.002 + k * 0.001, f.cz - lx * s + lz * c, hash01(p.x0, p.y0, 99 + k) * 3, 0, 0, 1, 1, 1, FLAT, 0);
      }
    }
  }

  // Chaises : tournees vers la table voisine (salle de reunion), sinon dans le sens de `variant`.
  const chairs = propsOf("chaise");
  if (chairs.length) {
    // Au Hall, une vieille chaise de bois ; ailleurs, des chaises de bureau.
    const office = levelId !== "niveau-0";
    const bSeat = batch(unitBox(), lambert({ color: office ? 0x2d3238 : 0x8a6634 }));
    const bLeg = batch(unitCyl(6), lambert({ color: office ? 0x6b6f75 : 0x5e4222 }));
    // Tapis sous la chaise seule, et sous la table de reunion et ses chaises :
    // une chaise est bien plus petite que sa case pleine, le tapis montre
    // jusqu'ou l'on bute (sinon, on se cogne a un mur invisible).
    const rugOffset = { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 };
    const bRugEdge = batch(unitPlane(), lambert({ color: office ? 0x1f242c : 0x3a1f14, ...rugOffset }));
    const bRug = batch(unitPlane(), lambert({ color: office ? 0x3a424e : 0x6b3526, ...rugOffset }));
    const rug = (x0: number, y0: number, x1: number, y1: number) => {
      const w = (x1 - x0 + 1) * CS - CS * 0.1;
      const d = (y1 - y0 + 1) * CS - CS * 0.1;
      const cx = ((x0 + x1 + 1) / 2) * CS;
      const cz = ((y0 + y1 + 1) / 2) * CS;
      const b = opts.floorY((y0 + y1 + 1) / 2);
      put(bRugEdge, cx, b + 0.004, cz, 0, 0, 0, w, d, 1, FLAT, 0);
      put(bRug, cx, b + 0.005, cz, 0, 0, 0, w - 0.24, d - 0.24, 1, FLAT, 0);
    };
    for (const r of data.rooms) {
      if (r.kind !== "reunion") continue;
      for (const t of tables) {
        if (t.x0 < r.x0 || t.x1 > r.x1 || t.y0 < r.y0 || t.y1 > r.y1) continue;
        rug(Math.max(r.x0, t.x0 - 1), Math.max(r.y0, t.y0 - 1), Math.min(r.x1, t.x1 + 1), Math.min(r.y1, t.y1 + 1));
      }
    }
    for (const p of chairs) {
      let alone = true;
      for (const d of PROP_DIRS) if (tableCells.has((p.y0 + DIRS[d][1]) * W + p.x0 + DIRS[d][0])) alone = false;
      if (alone) rug(p.x0, p.y0, p.x1, p.y1);
    }
    // Un peu plus grande que nature : la case pleine qui l'entoure se lit mieux.
    const k = 1.15;
    for (const p of chairs) {
      const f = footprint(p);
      let face = propDir(p.variant);
      let atTable = false;
      for (const d of PROP_DIRS) {
        const [dx, dy] = DIRS[d];
        if (tableCells.has((p.y0 + dy) * W + p.x0 + dx)) {
          face = d;
          atTable = true;
          break;
        }
      }
      const [dx, dy] = DIRS[face];
      // Autour d'une table, un peu de desordre ; la chaise seule est parfaitement droite.
      const yaw = yawTo(face) + (atTable ? (hash01(p.x0, p.y0, 101) - 0.5) * 0.5 : 0);
      const x = f.cx + (atTable ? dx * CS * 0.16 : 0);
      const z = f.cz + (atTable ? dy * CS * 0.16 : 0);
      const b = f.base;
      put(bSeat, x, b + 0.46 * k, z, yaw, 0, 0, 0.48 * k, 0.06 * k, 0.46 * k);
      put(bSeat, x, b + 0.8 * k, z, yaw, 0, -0.21 * k, 0.46 * k, 0.4 * k, 0.05 * k, -0.08);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) put(bLeg, x, b + 0.23 * k, z, yaw, sx * 0.2 * k, sz * 0.19 * k, 0.018 * k, 0.46 * k, 0.018 * k);
        put(bLeg, x, b + 0.62 * k, z, yaw, sx * 0.2 * k, -0.21 * k, 0.016 * k, 0.34 * k, 0.016 * k);
      }
    }
  }

  // Caisses empilees (et tout objet d'un genre inconnu) : chaque case de l'emprise porte sa
  // pile, de `variant` + 1 caisses, chacune un peu plus petite et de travers.
  const crateProps = [...propsOf("caisse")];
  for (const [kind, list] of propsByKind) if (!DRAWN_PROPS.includes(kind)) crateProps.push(...list);
  if (crateProps.length) {
    const bWood = batch(unitBox(), lambert({ map: own(makeWoodCrate()) }));
    const bCard = batch(unitBox(), lambert({ map: own(makeCardboard()) }));
    const maxH = WH - 0.35;
    for (const p of crateProps) {
      const count = 1 + (((p.variant % 4) + 4) % 4);
      const woodTint = CRATE_TINTS[(((p.variant % 4) + 4) % 4) % CRATE_TINTS.length];
      for (let cy = p.y0; cy <= p.y1; cy++) {
        for (let cx = p.x0; cx <= p.x1; cx++) {
          const x = (cx + 0.5) * CS;
          const z = (cy + 0.5) * CS;
          const b = opts.floorY(cy + 0.5);
          let y = 0;
          for (let n = 0; n < count; n++) {
            const r1 = hash01(cx, cy, 111 + n);
            const r2 = hash01(cx, cy, 121 + n);
            // La caisse du bas remplit la case : c'est elle qui dit ou l'on bute.
            const size = n === 0 ? 0.95 : Math.max(0.42, 0.82 - (n - 1) * 0.14 - r2 * 0.06);
            const h = Math.min(maxH - y, n === 0 ? 0.95 + r1 * 0.3 : 0.55 + r1 * 0.3);
            if (h < 0.3) break;
            const turn = n === 0 ? (r2 - 0.5) * 0.06 : (r1 - 0.5) * 0.36;
            const slide = n === 0 ? 0 : (1 - size) * CS * 0.3;
            const ox = (r1 - 0.5) * slide;
            const oz = (r2 - 0.5) * slide;
            // Des cartons sur les piles hautes, jamais en bas.
            const card = n >= 2 && r2 < 0.5;
            put(card ? bCard : bWood, x + ox, b + y + h / 2, z + oz, turn, 0, 0, CS * size, h, CS * size * (0.94 + r1 * 0.06), 0, 0, card ? -1 : woodTint);
            y += h;
          }
        }
      }
    }
  }

  // Vannes geantes : socle de beton, corps rivete, conduite qui sort du sol et y replonge,
  // et un grand volant jaune dresse face a `variant` (rien a voir avec les petites vannes
  // rouges de l'objectif, accrochees aux murs).
  const bigValves = propsOf("vanne-geante");
  if (bigValves.length) {
    const rustTex = own(makeBoilerTexture());
    const bPlinth = batch(unitBox(), lambert({ color: 0x55524b }));
    const bIron = batch(unitCyl(18), lambert({ map: rustTex, color: 0xb8a58c }));
    const bBonnet = batch(shared("chapeau", () => new THREE.CylinderGeometry(0.55, 1, 1, 18)), lambert({ map: rustTex, color: 0x9a8a74 }));
    const paint = lambert({ color: 0xb8891c });
    const bWheel = batch(shared("volant", () => new THREE.TorusGeometry(1, 0.07, 8, 32)), paint);
    const bSpoke = batch(unitBox(), paint);
    const bTag = batch(unitPlane(), lambert({ map: own(makePosterTexture("NE PAS\nTOUCHER", "vapeur", 1)) }));
    for (const p of bigValves) {
      const f = footprint(p);
      const face = propDir(p.variant);
      const yaw = yawTo(face);
      const facingX = DIRS[face][0] !== 0;
      // Profondeur (vers le volant) et largeur de l'emprise, vues depuis l'allee.
      const depth = facingX ? f.w : f.d;
      const span = (facingX ? f.d : f.w) * 0.94;
      const side = Math.min(f.w, f.d);
      const b = f.base;
      const plinthH = 0.22;
      const y0 = b + plinthH;
      const bodyR = side * 0.24;
      const bodyH = Math.min(1, WH * 0.36);
      const pipeR = side * 0.15;
      const pipeY = y0 + bodyH * 0.45;
      put(bPlinth, f.cx, b + plinthH / 2, f.cz, 0, 0, 0, f.w - CS * 0.06, plinthH, f.d - CS * 0.06);
      put(bIron, f.cx, y0 + bodyH / 2, f.cz, 0, 0, 0, bodyR, bodyH, bodyR);
      put(bIron, f.cx, y0 + 0.04, f.cz, 0, 0, 0, bodyR * 1.2, 0.08, bodyR * 1.2);
      put(bIron, f.cx, y0 + bodyH - 0.04, f.cz, 0, 0, 0, bodyR * 1.2, 0.08, bodyR * 1.2);
      put(bBonnet, f.cx, y0 + bodyH + 0.15, f.cz, 0, 0, 0, bodyR * 0.8, 0.3, bodyR * 0.8);
      // La conduite, couchee en travers (parallele au volant), et ses deux coudes plongeant dans le socle.
      put(bIron, f.cx, pipeY, f.cz, yaw, 0, 0, pipeR, span - pipeR * 2, pipeR, 0, Math.PI / 2);
      for (const s of [-1, 1]) {
        put(bIron, f.cx, (y0 + pipeY + pipeR * 0.5) / 2, f.cz, yaw, s * (span / 2 - pipeR), 0, pipeR, pipeY + pipeR * 0.5 - y0, pipeR);
        put(bIron, f.cx, pipeY, f.cz, yaw, s * (bodyR + 0.06), 0, pipeR * 1.3, 0.07, pipeR * 1.3, 0, Math.PI / 2);
      }
      // Le volant, dresse devant le corps, au bout de sa tige ; il ne touche ni le socle ni le plafond.
      const wheelR = side * 0.4;
      const wheelZ = depth * 0.4;
      const wheelY = Math.max(y0 + wheelR + 0.08, Math.min(b + 1.3, b + WH - wheelR - 0.15));
      const spin = p.variant * 0.4 + hash01(p.x0, p.y0, 115);
      put(bIron, f.cx, wheelY, f.cz, yaw, 0, (bodyR * 0.8 + wheelZ) / 2, 0.05, wheelZ - bodyR * 0.8 + 0.06, 0.05, Math.PI / 2, 0);
      put(bIron, f.cx, wheelY, f.cz, yaw, 0, bodyR * 0.6, bodyR * 0.55, bodyR * 0.5, bodyR * 0.55, Math.PI / 2, 0);
      put(bWheel, f.cx, wheelY, f.cz, yaw, 0, wheelZ, wheelR, wheelR, wheelR);
      for (let k = 0; k < 3; k++) put(bSpoke, f.cx, wheelY, f.cz, yaw, 0, wheelZ, wheelR * 2, 0.05, 0.06, 0, spin + (k * Math.PI) / 3);
      put(bIron, f.cx, wheelY, f.cz, yaw, 0, wheelZ, 0.1, 0.12, 0.1, Math.PI / 2, 0);
      // L'etiquette pend devant le moyeu.
      put(bTag, f.cx, wheelY - 0.26, f.cz, yaw, 0, wheelZ + 0.075, 0.3, 0.21, 1, 0.08, 0);
    }
  }

  // Comptoir de reception : facade de noyer (panneaux repetes sans etirement), dessus de marbre,
  // sonnette, registre et chevalet.
  const counters = propsOf("comptoir");
  if (counters.length) {
    const panel = lambert({ map: own(makeReceptionPanel()) });
    const wood = lambert({ color: 0x2a140a });
    const bSlab = batch(unitBox(), lambert({ map: own(makeMarble()), color: 0xe8e0d0 }));
    const bBell = batch(shared("sonnette", () => new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)), brass());
    const bBook = batch(unitBox(), lambert({ color: 0x5a1418 }));
    const bSign = batch(unitPlane(), lambert({ map: own(makePosterTexture("RÉCEPTION", "hotel", 0)) }));
    const H = 1.08;
    for (const p of counters) {
      const f = footprint(p);
      const alongX = f.w >= f.d;
      const L = (alongX ? f.w : f.d) - CS * 0.06;
      const D = (alongX ? f.d : f.w) * 0.72;
      const sx = alongX ? L : D;
      const sz = alongX ? D : L;
      // Une geometrie par comptoir (ils sont rares) : le panneau s'y repete a sa taille.
      const geo = own(new THREE.BoxGeometry(sx, H, sz));
      repeatSides(geo, sx, sz, 1.35);
      const body = new THREE.Mesh(geo, [panel, panel, wood, wood, panel, panel]);
      body.position.set(f.cx, f.base + H / 2, f.cz);
      group.add(body);
      put(bSlab, f.cx, f.base + H + 0.03, f.cz, 0, 0, 0, sx + 0.08, 0.06, sz + 0.12);
      // Le +z local regarde les clients (`variant`), le long du comptoir sinon.
      const clients = propDir(p.variant);
      const yaw = (DIRS[clients][0] !== 0) !== alongX ? yawTo(clients) : alongX ? 0 : Math.PI / 2;
      const top = f.base + H + 0.06;
      put(bBell, f.cx, top, f.cz, yaw, L * 0.28, D * 0.25, 0.08, 0.08, 0.08);
      put(bBook, f.cx, top + 0.025, f.cz, yaw + 0.2, -L * 0.22, D * 0.1, 0.36, 0.05, 0.26);
      // Chevalet lisible des deux cotes : deux faces adossees, en toit.
      put(bSign, f.cx, top + 0.13, f.cz, yaw, 0, 0.04, 0.42, 0.3, 1, -0.15, 0);
      put(bSign, f.cx, top + 0.13, f.cz, yaw + Math.PI, 0, 0.04, 0.42, 0.3, 1, -0.15, 0);
    }
  }

  // --- Luminaires « hotel » et « fete » : le corps autour de l'ampoule que pose la scene ---
  // (Les batons lumineux du niveau 6 sont entierement dessines par la scene.)
  const sconces = data.lights.filter((l) => l.fixture === "applique");
  if (sconces.length) {
    const bulb = fixtureBulb("applique", WH);
    const bPlate = batch(unitBox(), brass());
    const bArm = batch(unitCyl(6), brass());
    const shade = shared("abat-jour", () => new THREE.CylinderGeometry(0.075, 0.13, 0.17, 16, 1, true));
    const bLit = batch(shade, lambert({ color: 0xe9d6a8, emissive: 0x5a3c14, side: THREE.DoubleSide }));
    const bDead = batch(shade, lambert({ color: 0x8c7a5c, side: THREE.DoubleSide }));
    for (const l of sconces) {
      if (!l.wall) continue;
      const p = wallPose({ x: l.x, y: l.y, dir: l.wall }, 0);
      const y = p.base + bulb.y;
      put(bPlate, p.x, y - 0.12, p.z, p.yaw, 0, 0.0125, 0.09, 0.22, 0.025);
      put(bArm, p.x, y - 0.1, p.z, p.yaw, 0, bulb.inset / 2, 0.012, bulb.inset, 0.012, Math.PI / 2, 0);
      put(bArm, p.x, y - 0.075, p.z, p.yaw, 0, bulb.inset, 0.032, 0.05, 0.032);
      put(l.state === 1 ? bDead : bLit, p.x, y + 0.03, p.z, p.yaw, 0, bulb.inset);
    }
  }
  const chandeliers = data.lights.filter((l) => l.fixture === "lustre");
  if (chandeliers.length) {
    const bulb = fixtureBulb("lustre", WH);
    const bRod = batch(unitCyl(8), brass());
    const bRing = batch(shared("couronne", () => new THREE.TorusGeometry(1, 0.04, 6, 32)), brass());
    const bCrystal = batch(shared("pampille", () => new THREE.OctahedronGeometry(1, 0)), lambert({ color: 0xeef4ff, emissive: 0x3a4250 }));
    const bFlameLit = batch(unitSphere(), basic({ color: 0xffe2a8 }));
    const bFlameDead = batch(unitSphere(), lambert({ color: 0x9a927e }));
    const ringR = 0.45;
    for (const l of chandeliers) {
      const x = (l.x + 0.5) * CS;
      const z = (l.y + 0.5) * CS;
      const base = opts.floorY(l.y + 0.5);
      const y = base + bulb.y;
      const ceil = base + WH;
      const ringY = y - 0.12;
      put(bRod, x, (y + 0.18 + ceil) / 2, z, 0, 0, 0, 0.012, ceil - y - 0.18, 0.012);
      put(bRod, x, ceil - 0.02, z, 0, 0, 0, 0.13, 0.04, 0.13);
      put(bRod, x, (ringY + y + 0.18) / 2, z, 0, 0, 0, 0.018, y + 0.18 - ringY, 0.018);
      put(bRod, x, ringY, z, 0, 0, 0, 0.06, 0.08, 0.06);
      put(bRing, x, ringY, z, 0, 0, 0, ringR, ringR, ringR, Math.PI / 2, 0);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        put(bRod, x + (ca * ringR) / 2, ringY, z + (sa * ringR) / 2, -a, 0, 0, 0.012, ringR, 0.012, 0, Math.PI / 2);
        put(bRod, x + ca * ringR, ringY + 0.03, z + sa * ringR, 0, 0, 0, 0.035, 0.05, 0.035);
        put(l.state === 1 ? bFlameDead : bFlameLit, x + ca * ringR, ringY + 0.1, z + sa * ringR, 0, 0, 0, 0.022, 0.045, 0.022);
        const b2 = a + Math.PI / 6;
        put(bCrystal, x + Math.cos(b2) * ringR, ringY - 0.1, z + Math.sin(b2) * ringR, 0, 0, 0, 0.022, 0.05, 0.022);
        put(bCrystal, x + ca * ringR * 0.55, ringY - 0.16, z + sa * ringR * 0.55, 0, 0, 0, 0.022, 0.05, 0.022);
      }
      put(bCrystal, x, ringY - 0.26, z, 0, 0, 0, 0.04, 0.09, 0.04);
    }
  }
  const bareBulbs = data.lights.filter((l) => l.fixture === "ampoule");
  if (bareBulbs.length) {
    const bulb = fixtureBulb("ampoule", WH);
    const bCord = batch(unitCyl(8), lambert({ color: 0x151515 }));
    for (const l of bareBulbs) {
      const x = (l.x + 0.5) * CS;
      const z = (l.y + 0.5) * CS;
      const base = opts.floorY(l.y + 0.5);
      const y = base + bulb.y;
      const ceil = base + WH;
      put(bCord, x, (y + 0.1 + ceil) / 2, z, 0, 0, 0, 0.006, ceil - y - 0.1, 0.006);
      put(bCord, x, y + 0.075, z, 0, 0, 0, 0.024, 0.07, 0.024);
    }
  }

  // --- Salles marquantes : sols propres, piste de danse, boule a facettes, plongeoir ---
  /** Rectangles des salles d'un genre ; a defaut de marque, la boite englobante de leur zone. */
  function roomsOf(kind: string): CellRect[] {
    const marked: CellRect[] = data.rooms.filter((r) => r.kind === kind);
    if (marked.length > 0) return marked;
    const code = ROOM_KINDS.findIndex((k) => k === kind) + 1;
    if (code <= 0) return [];
    let x0 = W;
    let y0 = data.height;
    let x1 = -1;
    let y1 = -1;
    for (let i = 0; i < data.zones.length; i++) {
      if (data.zones[i] !== code) continue;
      const x = i % W;
      const y = (i - x) / W;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    return x1 < 0 ? [] : [{ x0, y0, x1, y1 }];
  }
  const roomFloors: [string, () => THREE.CanvasTexture, number][] = [
    ["bal", makeParquet, 3],
    ["piste", () => makeCheckerFloor(), CS],
    ["chaufferie", makeConcreteFloor, 5],
    ["reception", () => makeCheckerFloor("#e7dfcc", "#3b2f27", 2), 1.6],
  ];
  for (const [kind, make, period] of roomFloors) {
    const rects = roomsOf(kind);
    if (rects.length === 0) continue;
    const mat = lambert({ map: own(make()), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    for (const r of rects) {
      const rw = (r.x1 - r.x0 + 1) * CS;
      const rh = (r.y1 - r.y0 + 1) * CS;
      const geo = own(new THREE.PlaneGeometry(rw, rh));
      // Motif a l'echelle du metre, cale sur le coin de la salle (le damier tombe sur les cases).
      const uv = geo.getAttribute("uv");
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * rw) / period, (uv.getY(i) * rh) / period);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = FLAT;
      mesh.position.set(r.x0 * CS + rw / 2, opts.floorY((r.y0 + r.y1 + 1) / 2) + 0.004, r.y0 * CS + rh / 2);
      group.add(mesh);
    }
  }

  // Piste de danse : chaque carreau du damier s'allume en couleur, au rythme ; la boule tourne au-dessus.
  const pistes = roomsOf("piste");
  const danceXY: number[] = [];
  const ballXYZ: number[] = [];
  let bDance: Batch | null = null;
  let bBall: Batch | null = null;
  if (pistes.length) {
    bDance = batch(
      unitPlane(),
      basic({ color: 0xffffff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    );
    bBall = batch(unitSphere(), basic({ map: own(makeMirrorBallTexture()), color: 0xd8d8e0 }));
    const bHanger = batch(unitCyl(6), lambert({ color: 0x222222 }));
    const half = CS / 2;
    for (const r of pistes) {
      const base = opts.floorY((r.y0 + r.y1 + 1) / 2);
      for (let y = r.y0; y <= r.y1; y++) {
        for (let x = r.x0; x <= r.x1; x++) {
          if (data.cells[y * W + x] !== CELL_OPEN) continue;
          for (let k = 0; k < 4; k++) {
            const sx = x * 2 + (k & 1);
            const sy = y * 2 + (k >> 1);
            put(bDance, (sx + 0.5) * half, base + 0.008, (sy + 0.5) * half, 0, 0, 0, half * 0.9, half * 0.9, 1, FLAT, 0, 0x000000);
            danceXY.push(sx, sy);
          }
        }
      }
      const bx = ((r.x0 + r.x1 + 1) / 2) * CS;
      const bz = ((r.y0 + r.y1 + 1) / 2) * CS;
      const ceil = base + WH;
      const by = ceil - 0.8;
      put(bBall, bx, by, bz, 0, 0, 0, MIRROR_BALL_R, MIRROR_BALL_R, MIRROR_BALL_R);
      put(bHanger, bx, (by + ceil) / 2, bz, 0, 0, 0, 0.01, ceil - by, 0.01);
      ballXYZ.push(bx, by, bz);
    }
  }

  // Plongeoir du bassin profond : socle carrele contre un mur, planche au-dessus de l'eau, rampes.
  const pools = roomsOf("bassin-profond");
  if (pools.length) {
    const bTile = batch(unitBox(), lambert({ color: 0xd9dfdc }));
    const bBoard = batch(unitBox(), lambert({ color: 0x2f7fb0 }));
    const bRail = batch(unitCyl(8), lambert({ color: 0xb8bec4, emissive: 0x15181a }));
    const solidAt = (x: number, y: number) => x < 0 || y < 0 || x >= W || y >= data.height || data.cells[y * W + x] !== CELL_OPEN;
    for (const r of pools) {
      const cx = Math.floor((r.x0 + r.x1) / 2);
      const cy = Math.floor((r.y0 + r.y1) / 2);
      const spots: { x: number; y: number; dir: Dir }[] = [
        { x: cx, y: r.y0, dir: "N" },
        { x: cx, y: r.y1, dir: "S" },
        { x: r.x0, y: cy, dir: "W" },
        { x: r.x1, y: cy, dir: "E" },
      ];
      const spot = spots.find((s) => !solidAt(s.x, s.y) && solidAt(s.x + DIRS[s.dir][0], s.y + DIRS[s.dir][1]));
      if (!spot) continue;
      const p = wallPose(spot, 0);
      const b = p.base;
      put(bTile, p.x, b + 0.45, p.z, p.yaw, 0, 0.28, 0.7, 0.9, 0.56);
      // La planche flechit un peu vers le bout. Elle traverse la margelle
      // (une case) et avance d'environ 80 cm au-dessus de l'eau.
      const boardLen = CS + 0.6;
      put(bBoard, p.x, b + 0.93, p.z, p.yaw, 0, 0.2 + boardLen / 2, 0.5, 0.06, boardLen, 0.025);
      for (const s of [-1, 1]) {
        put(bRail, p.x, b + 1.27, p.z, p.yaw, s * 0.3, 0.5, 0.02, 0.7, 0.02);
        put(bRail, p.x, b + 1.62, p.z, p.yaw, s * 0.3, 0.27, 0.02, 0.5, 0.02, Math.PI / 2, 0);
      }
    }
  }

  // --- Portes de chambres numerotees (hotel) : battant, chambranle, plaque de laiton ---
  const doors = byKind.get("porte") ?? [];
  if (doors.length) {
    const doorH = Math.min(2.15, WH - 0.45);
    const doorW = 0.98;
    const bPlain = batch(unitPlane(), lambert({ map: own(makeHotelRoomDoor(false)) }));
    const bSign = batch(unitPlane(), lambert({ map: own(makeHotelRoomDoor(true)) }));
    const bFrame = batch(unitBox(), lambert({ color: 0x24110a }));
    // Les plaques forment UN maillage fusionne : chacune lit son numero dans l'atlas.
    const numbers = [...new Set(doors.map((d) => d.variant))].sort((a, b) => a - b);
    const cols = 8;
    const rows = Math.max(1, Math.ceil(numbers.length / cols));
    const atlas = own(makePlateAtlas(numbers, cols, rows, 64, 32));
    const slot = new Map<number, number>();
    numbers.forEach((n, k) => slot.set(n, k));
    const pos: number[] = [];
    const nor: number[] = [];
    const uvs: number[] = [];
    const index: number[] = [];
    const hw = 0.085;
    const hh = 0.042;
    for (const item of doors) {
      const p = wallPose(item, 0.012);
      // Une porte sur cinq porte l'affichette « NE PAS DERANGER ».
      put(hash01(item.x, item.y, item.variant) < 0.2 ? bSign : bPlain, p.x, p.base + doorH / 2, p.z, p.yaw, 0, 0, doorW, doorH, 1);
      const f = wallPose(item, 0.025);
      for (const s of [-1, 1]) put(bFrame, f.x, f.base + (doorH + 0.08) / 2, f.z, f.yaw, s * (doorW / 2 + 0.04), 0, 0.08, doorH + 0.08, 0.05);
      put(bFrame, f.x, f.base + doorH + 0.08, f.z, f.yaw, 0, 0, doorW + 0.16, 0.1, 0.05);
      const k = slot.get(item.variant) ?? 0;
      const u0 = (k % cols) / cols;
      const u1 = u0 + 1 / cols;
      const v1 = 1 - Math.floor(k / cols) / rows;
      const v0 = v1 - 1 / rows;
      const pl = wallPose(item, 0.018);
      const c = Math.cos(pl.yaw);
      const s = Math.sin(pl.yaw);
      const y = pl.base + Math.min(1.7, doorH - 0.25);
      const n0 = pos.length / 3;
      for (const [lx, ly, u, vv] of [
        [-hw, -hh, u0, v0],
        [hw, -hh, u1, v0],
        [hw, hh, u1, v1],
        [-hw, hh, u0, v1],
      ]) {
        pos.push(pl.x + lx * c, y + ly, pl.z - lx * s);
        nor.push(s, 0, c);
        uvs.push(u, vv);
      }
      index.push(n0, n0 + 1, n0 + 2, n0, n0 + 2, n0 + 3);
    }
    const plates = own(new THREE.BufferGeometry());
    plates.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    plates.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    plates.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    plates.setIndex(index);
    group.add(new THREE.Mesh(plates, lambert({ map: atlas })));
  }

  // --- Tableaux : toiles encadrees (hotel), tableau blanc dans les bureaux ---
  const paintings = byKind.get("tableau") ?? [];
  if (paintings.length && levelId === "niveau-4") {
    const bBoard = batch(unitPlane(), lambert({ map: own(makeWhiteboard()) }));
    const bTray = batch(unitBox(), lambert({ color: 0x9aa0a6 }));
    const bw = Math.min(1.6, CS * 0.8);
    for (const item of paintings) {
      const p = wallPose(item, 0.012);
      const y = p.base + Math.min(1.45, WH - 0.9);
      put(bBoard, p.x, y, p.z, p.yaw, 0, 0, bw, bw * 0.625, 1);
      const t = wallPose(item, 0.04);
      put(bTray, t.x, y - bw * 0.3125 - 0.02, t.z, t.yaw, 0, 0, bw * 0.8, 0.025, 0.07);
    }
  } else if (paintings.length) {
    const bBack = batch(unitBox(), lambert({ color: 0x4a3418 }));
    const pw = 0.95;
    const ph = 0.74;
    for (let variant = 0; variant < 4; variant++) {
      const mine = paintings.filter((item) => ((item.variant % 4) + 4) % 4 === variant);
      if (!mine.length) continue;
      const bCanvas = batch(unitPlane(), lambert({ map: own(makePaintingTexture(variant)) }));
      for (const item of mine) {
        const r = hash01(item.x, item.y, 121);
        // De travers : un peu pour la plupart, franchement pour un sur six.
        const roll = (r < 0.17 ? 0.2 : 0.05) * (hash01(item.x, item.y, 122) < 0.5 ? -1 : 1) * (0.5 + r);
        const p = wallPose(item, 0.042);
        const y = p.base + Math.min(1.6, WH - 0.85);
        put(bCanvas, p.x, y, p.z, p.yaw, 0, 0, pw, ph, 1, 0, roll);
        const back = wallPose(item, 0.02);
        put(bBack, back.x, y, back.z, back.yaw, 0, 0, pw, ph, 0.04, 0, roll);
      }
    }
  }

  // --- Empreintes de pattes, confettis : a plat sur le sol ---
  const paws = byKind.get("traces") ?? [];
  if (paws.length) {
    const b = batch(
      unitPlane(),
      basic({ map: own(makePawTexture()), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    for (const item of paws) {
      const yaw = item.variant * (Math.PI / 2) + (hash01(item.x, item.y, 131) - 0.5) * 0.6;
      put(b, (item.x + 0.5) * CS, opts.floorY(item.y + 0.5) + 0.007, (item.y + 0.5) * CS, yaw, 0, 0, CS * 0.42, CS * 0.84, 1, FLAT, 0);
    }
  }
  const confetti = byKind.get("confettis") ?? [];
  if (confetti.length) {
    const b = batch(
      unitPlane(),
      lambert({ map: own(makeConfettiTexture()), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    for (const item of confetti) {
      put(b, (item.x + 0.5) * CS, opts.floorY(item.y + 0.5) + 0.006, (item.y + 0.5) * CS, item.variant * 1.3 + item.x, 0, 0, CS * 0.95, CS * 0.95, 1, FLAT, 0);
    }
  }

  // --- Cadeaux : une a trois boites, papier teinte, ruban en croix et noeud ---
  const gifts = byKind.get("cadeau") ?? [];
  if (gifts.length) {
    const bBox = batch(unitBox(), lambert({ map: own(makeGiftWrap()) }));
    const bRibbon = batch(unitBox(), lambert({ color: 0xffffff }));
    const bBow = batch(unitSphere(), lambert({ color: 0xffffff }));
    for (const item of gifts) {
      const n = 1 + (item.variant % 3);
      const base = opts.floorY(item.y + 0.5);
      for (let k = 0; k < n; k++) {
        const r1 = hash01(item.x, item.y, 140 + k);
        const r2 = hash01(item.x, item.y, 150 + k);
        const r3 = hash01(item.x, item.y, 160 + k);
        const w = 0.28 + r1 * 0.3;
        const h = w * (0.6 + r2 * 0.5);
        const d = w * (0.8 + r3 * 0.4);
        // Plusieurs boites : en rond autour du centre, pour ne pas s'interpenetrer.
        const a = (k / n) * Math.PI * 2 + r1;
        const dist = n > 1 ? CS * 0.2 : (r2 - 0.5) * CS * 0.3;
        const x = (item.x + 0.5) * CS + Math.cos(a) * dist;
        const z = (item.y + 0.5) * CS + Math.sin(a) * dist;
        const yaw = r1 * Math.PI;
        const ribbon = r3 < 0.5 ? 0xffd23f : 0xffffff;
        put(bBox, x, base + h / 2, z, yaw, 0, 0, w, h, d, 0, 0, GIFT_COLORS[(item.variant + k * 3) % GIFT_COLORS.length]);
        put(bRibbon, x, base + h / 2, z, yaw, 0, 0, w + 0.012, h + 0.012, 0.05, 0, 0, ribbon);
        put(bRibbon, x, base + h / 2, z, yaw, 0, 0, 0.05, h + 0.012, d + 0.012, 0, 0, ribbon);
        put(bBow, x, base + h + 0.03, z, yaw, 0, 0, 0.08, 0.045, 0.06, 0, 0, ribbon);
      }
    }
  }

  // --- Ballons : ceux du sol flottent au bout de leur ficelle (et bougent), ceux du plafond s'y collent ---
  const floatInfo: number[] = [];
  let bFloat: Batch | null = null;
  let bFloatString: Batch | null = null;
  const looseBalloons = byKind.get("ballon") ?? [];
  const bunches = byKind.get("ballons") ?? [];
  if (looseBalloons.length || bunches.length) {
    const rubber = lambert({ color: 0xffffff, emissive: 0x181818 });
    const twine = lambert({ color: 0xe6e2da });
    if (looseBalloons.length) {
      bFloat = batch(unitSphere(), rubber);
      bFloatString = batch(unitCyl(4), twine);
      const bWeight = batch(unitBox(), lambert({ color: 0x8a8a90 }));
      for (const item of looseBalloons) {
        const x = (item.x + 0.5) * CS + (hash01(item.x, item.y, 171) - 0.5) * CS * 0.4;
        const z = (item.y + 0.5) * CS + (hash01(item.x, item.y, 172) - 0.5) * CS * 0.4;
        const base = opts.floorY(item.y + 0.5);
        const h = 1.05 + hash01(item.x, item.y, 173) * 0.5;
        const phase = hash01(item.x, item.y, 174) * Math.PI * 2;
        const color = BALLOON_COLORS[(item.variant + Math.floor(phase * 7)) % BALLOON_COLORS.length];
        put(bFloat, x, base + h, z, phase, 0, 0, BALLOON_RX, BALLOON_RY, BALLOON_RX, 0, 0, color);
        put(bFloatString, x, base + (h - BALLOON_RY + 0.06) / 2, z, 0, 0, 0, 0.004, h - BALLOON_RY - 0.06, 0.004);
        put(bWeight, x, base + 0.03, z, phase, 0, 0, 0.07, 0.06, 0.07);
        floatInfo.push(x, base, z, h, phase);
      }
    }
    if (bunches.length) {
      const bBalloon = batch(unitSphere(), rubber);
      const bString = batch(unitCyl(4), twine);
      for (const item of bunches) {
        const n = 3 + (item.variant % 3);
        const ceil = opts.floorY(item.y + 0.5) + WH;
        const turn = item.variant + hash01(item.x, item.y, 181) * 2;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2 + turn;
          const dist = 0.24 + hash01(item.x, item.y, 182 + k) * 0.12;
          const x = (item.x + 0.5) * CS + Math.cos(a) * dist;
          const z = (item.y + 0.5) * CS + Math.sin(a) * dist;
          const y = ceil - BALLOON_RY - 0.01 - hash01(item.x, item.y, 190 + k) * 0.08;
          const len = 0.6 + hash01(item.x, item.y, 200 + k) * 0.6;
          const tilt = (hash01(item.x, item.y, 210 + k) - 0.5) * 0.16;
          put(bBalloon, x, y, z, a, 0, 0, BALLOON_RX, BALLOON_RY, BALLOON_RX, 0, 0, BALLOON_COLORS[(item.variant + k) % BALLOON_COLORS.length]);
          put(bString, x, y - BALLOON_RY - len / 2, z, a, 0, 0, 0.004, len, 0.004, 0, tilt);
        }
      }
    }
  }

  // --- Guirlandes de fanions, tendues sous le plafond (variant pair : est-ouest ; impair : nord-sud) ---
  const garlands = byKind.get("guirlande") ?? [];
  if (garlands.length) {
    const b = batch(unitPlane(), lambert({ map: own(makeBuntingTexture()), alphaTest: 0.5, side: THREE.DoubleSide }));
    const bh = CS * 0.25;
    for (const item of garlands) {
      const ceil = opts.floorY(item.y + 0.5) + WH;
      put(b, (item.x + 0.5) * CS, ceil - 0.03 - bh / 2, (item.y + 0.5) * CS, item.variant % 2 === 0 ? 0 : Math.PI / 2, 0, 0, CS, bh, 1);
    }
  }

  // --- Creation des lots, au compte exact ---
  for (const b of batches) {
    const n = b.colors.length;
    if (n === 0) continue;
    const mesh = own(new THREE.InstancedMesh(b.geo, b.mat, n));
    (mesh.instanceMatrix.array as Float32Array).set(b.matrices);
    if (b.colors.some((c) => c >= 0)) {
      for (let i = 0; i < n; i++) mesh.setColorAt(i, tint.setHex(b.colors[i] >= 0 ? b.colors[i] : 0xffffff));
    }
    group.add(mesh);
    b.mesh = mesh;
    // Les matrices et teintes sont copiees : on relache les tableaux de travail.
    b.matrices = [];
    b.colors = [];
  }
  const floatMesh = bFloat?.mesh ?? null;
  const floatStringMesh = bFloatString?.mesh ?? null;
  const floatData = new Float32Array(floatInfo);
  const floatCount = floatInfo.length / 5;
  const danceMesh = bDance?.mesh ?? null;
  const danceData = new Int32Array(danceXY);
  const danceCount = danceXY.length / 2;
  const ballMesh = bBall?.mesh ?? null;
  const ballData = new Float32Array(ballXYZ);
  const ballCount = ballXYZ.length / 3;
  let lastBeat = -1;

  return {
    group,
    update(time: number) {
      if (beaconSpin && beaconPoses.length) {
        // Tout pulse au meme rythme, chaque reflecteur tourne a son angle.
        domeMat.color.setRGB(0.6 + Math.max(0, Math.sin(time * 6)) * 0.4, 0.1, 0.05);
        for (let i = 0; i < beaconPoses.length; i++) {
          const b = beaconPoses[i];
          e.set(0, time * 5 + b.phase, 0);
          q.setFromEuler(e);
          m.compose(v.set(b.x, b.y, b.z), q, sc.set(1, 1, 1));
          beaconSpin.setMatrixAt(i, m);
        }
        beaconSpin.instanceMatrix.needsUpdate = true;
      }
      // Bougies du gateau et foyers des chaudieres : une seule couleur par materiau.
      if (flameMat) flameMat.color.setRGB(1, 0.62 + Math.sin(time * 17) * 0.07 + Math.sin(time * 5.3) * 0.05, 0.24);
      if (glowMat) {
        const k = 0.78 + Math.sin(time * 7.1) * 0.12 + Math.sin(time * 2.3) * 0.08;
        glowMat.color.setRGB(k, k * 0.4, k * 0.08);
      }
      if (ballMesh) {
        for (let i = 0; i < ballCount; i++) {
          place(ballMesh, i, ballData[i * 3], ballData[i * 3 + 1], ballData[i * 3 + 2], time * 0.5, 0, 0, MIRROR_BALL_R, MIRROR_BALL_R, MIRROR_BALL_R);
        }
        ballMesh.instanceMatrix.needsUpdate = true;
      }
      if (floatMesh && floatStringMesh) {
        // Les ballons du sol montent, descendent et derivent un peu ; la ficelle suit.
        for (let i = 0; i < floatCount; i++) {
          const o = i * 5;
          const x = floatData[o];
          const base = floatData[o + 1];
          const z = floatData[o + 2];
          const phase = floatData[o + 4];
          const sway = Math.sin(time * 0.6 + phase * 1.7) * 0.05;
          const y = base + floatData[o + 3] + Math.sin(time * 0.9 + phase) * 0.05;
          place(floatMesh, i, x + sway, y, z, phase, 0, 0, BALLOON_RX, BALLOON_RY, BALLOON_RX);
          const len = y - BALLOON_RY - base - 0.06;
          place(floatStringMesh, i, x + sway / 2, base + 0.06 + len / 2, z, 0, 0, 0, 0.004, len, 0.004, 0, -sway / len);
        }
        floatMesh.instanceMatrix.needsUpdate = true;
        floatStringMesh.instanceMatrix.needsUpdate = true;
      }
      if (danceMesh) {
        // Nouveau motif de la piste a chaque temps (environ 126 battements par minute).
        const beat = Math.floor(time * 2.1);
        if (beat !== lastBeat) {
          lastBeat = beat;
          for (let i = 0; i < danceCount; i++) {
            const h = hash01(danceData[i * 2], danceData[i * 2 + 1], beat);
            if (h < 0.4) tint.setHex(DANCE_COLORS[Math.floor(h * 1000) % DANCE_COLORS.length]);
            else tint.setRGB(0, 0, 0);
            danceMesh.setColorAt(i, tint);
          }
          if (danceMesh.instanceColor) danceMesh.instanceColor.needsUpdate = true;
        }
      }
    },
    dispose() {
      for (const o of owned) o.dispose();
    },
  };
}
