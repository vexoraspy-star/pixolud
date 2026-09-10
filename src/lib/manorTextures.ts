import * as THREE from "three";

// Toutes les textures du Manoir Maudit sont dessinees au canvas : aucun
// fichier image externe, donc rien a telecharger et aucun souci de licence.

function canvas2d(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext("2d")! };
}

function finish(canvas: HTMLCanvasElement, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Mur : lambris en bas, papier peint en haut, moulure doree entre les deux. */
export function makeManorWallTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(256, 256);
  const railY = 108;

  ctx.fillStyle = "#221a1d";
  ctx.fillRect(0, 0, 256, railY);
  ctx.fillStyle = "rgba(110,45,52,0.3)";
  for (let y = 6, row = 0; y < railY; y += 18, row++) {
    for (let x = row % 2 === 0 ? 6 : 15; x < 256; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x + 4, y);
      ctx.lineTo(x, y + 4);
      ctx.lineTo(x - 4, y);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.fillStyle = "#1c140d";
  ctx.fillRect(0, railY, 256, 256 - railY);
  const panels = 4;
  const panelW = 256 / panels;
  for (let i = 0; i < panels; i++) {
    const shade = 24 + Math.floor(Math.random() * 10);
    ctx.fillStyle = `rgb(${shade + 15},${shade + 7},${shade})`;
    ctx.fillRect(i * panelW + 6, railY + 8, panelW - 12, 256 - railY - 16);
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 2;
    ctx.strokeRect(i * panelW + 6, railY + 8, panelW - 12, 256 - railY - 16);
  }

  ctx.fillStyle = "#3a2a16";
  ctx.fillRect(0, railY - 5, 256, 6);
  ctx.fillStyle = "rgba(255,210,140,0.18)";
  ctx.fillRect(0, railY - 5, 256, 1);

  for (let i = 0; i < 8; i++) {
    const x = Math.random() * 256;
    const y = railY + Math.random() * (256 - railY);
    const r = 5 + Math.random() * 14;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(5,10,5,0.35)");
    grad.addColorStop(1, "rgba(5,10,5,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(canvas);
}

/** Parquet en lattes chaudes avec veines et joints decales. */
export function makeManorFloorTexture(width: number, height: number): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(256, 256);
  ctx.fillStyle = "#160f08";
  ctx.fillRect(0, 0, 256, 256);
  const rows = 10;
  const rowH = 256 / rows;
  for (let r = 0; r < rows; r++) {
    const shade = 22 + Math.floor(Math.random() * 12);
    ctx.fillStyle = `rgb(${shade + 16},${shade + 8},${shade})`;
    ctx.fillRect(0, r * rowH + 1, 256, rowH - 2);
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 1;
    for (let g = 0; g < 3; g++) {
      const gy = r * rowH + 2 + Math.random() * (rowH - 4);
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(256, gy + (Math.random() * 4 - 2));
      ctx.stroke();
    }
    const seamOffset = r % 2 === 0 ? 0 : 42;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    for (let x = seamOffset; x < 256; x += 84) {
      ctx.fillRect(x, r * rowH + 1, 1, rowH - 2);
    }
  }
  return finish(canvas, width / 2.2, height / 2.2);
}

/** Plafond a poutres apparentes. */
export function makeCeilingTexture(width: number, height: number): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(128, 128);
  ctx.fillStyle = "#171009";
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 3 + Math.random() * 8, 1);
  }
  ctx.fillStyle = "#241809";
  ctx.fillRect(0, 46, 128, 34);
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(0, 46, 128, 3);
  ctx.fillRect(0, 77, 128, 3);
  ctx.fillStyle = "rgba(120,90,50,0.12)";
  ctx.fillRect(0, 52, 128, 2);
  return finish(canvas, width / 6, height / 3);
}

/** Tableau encadre : cadre dore + toile abstraite sombre. */
export function makePaintingTexture(variant: number): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(170, 210);
  ctx.fillStyle = "#7a5a22";
  ctx.fillRect(0, 0, 170, 210);
  ctx.fillStyle = "#c9a24a";
  ctx.fillRect(6, 6, 158, 198);
  ctx.fillStyle = "#7a5a22";
  ctx.fillRect(14, 14, 142, 182);
  const palettes: [string, string, string][] = [
    ["#3a2f22", "#6b4f2e", "#1a1410"],
    ["#2a2e22", "#54613a", "#12140d"],
    ["#341f1f", "#6b3a2e", "#160c0a"],
  ];
  const [c1, c2, c3] = palettes[variant % palettes.length];
  const grad = ctx.createLinearGradient(0, 14, 0, 196);
  grad.addColorStop(0, c1);
  grad.addColorStop(0.55, c2);
  grad.addColorStop(1, c3);
  ctx.fillStyle = grad;
  ctx.fillRect(18, 18, 134, 174);
  ctx.fillStyle = "rgba(10,8,6,0.5)";
  for (let i = 0; i < 3; i++) {
    const bx = 40 + Math.random() * 90;
    const by = 90 + Math.random() * 80;
    const r = 14 + Math.random() * 20;
    ctx.beginPath();
    ctx.ellipse(bx, by, r * 0.4, r, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(canvas);
}

/** Tapis rouge a bordure doree. */
export function makeRugTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(256, 256);
  ctx.fillStyle = "#5c1010";
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "#c99a3f";
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, 228, 228);
  ctx.strokeStyle = "#3a0a0a";
  ctx.lineWidth = 3;
  ctx.strokeRect(26, 26, 204, 204);
  ctx.fillStyle = "rgba(201,154,63,0.5)";
  for (let y = 40; y < 216; y += 34) {
    for (let x = 40; x < 216; x += 34) {
      ctx.beginPath();
      ctx.moveTo(x + 17, y);
      ctx.lineTo(x + 34, y + 17);
      ctx.lineTo(x + 17, y + 34);
      ctx.lineTo(x, y + 17);
      ctx.closePath();
      ctx.fill();
    }
  }
  return finish(canvas);
}

/** Bois generique pour les meubles (teinte ensuite par instance). */
export function makeWoodTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(64, 64);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 26; i++) {
    ctx.strokeStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.09})`;
    ctx.lineWidth = 1;
    const y = Math.random() * 64;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(64, y + (Math.random() * 4 - 2));
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 62, 62);
  return finish(canvas);
}

/** Plaque gravee qui donne un des trois chiffres du code de la cave. */
export function makeCluePlaqueTexture(rank: number, digit: number): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(200, 150);
  ctx.fillStyle = "#3b3020";
  ctx.fillRect(0, 0, 200, 150);
  ctx.fillStyle = "#6b5a34";
  ctx.fillRect(7, 7, 186, 136);
  ctx.fillStyle = "#241d12";
  ctx.fillRect(15, 15, 170, 120);
  ctx.fillStyle = "#e4c979";
  ctx.font = "bold 22px Georgia, serif";
  ctx.textAlign = "center";
  const labels = ["1er CHIFFRE", "2e CHIFFRE", "3e CHIFFRE"];
  ctx.fillText(labels[rank] ?? "CHIFFRE", 100, 45);
  ctx.font = "bold 74px Georgia, serif";
  ctx.fillStyle = "#ffe9a8";
  ctx.fillText(String(digit), 100, 118);
  return finish(canvas);
}

/** Porte en chene cloutee, avec un cadran a code au centre. */
export function makeDoorTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(128, 200);
  ctx.fillStyle = "#241709";
  ctx.fillRect(0, 0, 128, 200);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#2e1d0c" : "#291a0b";
    ctx.fillRect(i * 32 + 2, 0, 28, 200);
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(i * 32 + 2, 0, 28, 200);
  }
  // renforts metalliques
  ctx.fillStyle = "#3d3630";
  ctx.fillRect(0, 26, 128, 12);
  ctx.fillRect(0, 162, 128, 12);
  ctx.fillStyle = "#5a5147";
  for (let x = 8; x < 128; x += 16) {
    ctx.beginPath();
    ctx.arc(x, 32, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, 168, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // cadran a code
  ctx.fillStyle = "#22201d";
  ctx.beginPath();
  ctx.arc(64, 100, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#8d7a4e";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = "#c9a24a";
  ctx.font = "bold 15px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText("000", 64, 106);
  return finish(canvas);
}

/** Visage du monstre : pale, orbites creuses, bouche hurlante. */
export function makeMonsterFaceTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(256, 320);
  ctx.clearRect(0, 0, 256, 320);

  // crane
  const skin = ctx.createRadialGradient(128, 140, 20, 128, 160, 150);
  skin.addColorStop(0, "#d8cdb8");
  skin.addColorStop(0.65, "#9d907a");
  skin.addColorStop(1, "#4a4239");
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(128, 150, 92, 122, 0, 0, Math.PI * 2);
  ctx.fill();

  // orbites
  for (const ex of [88, 168]) {
    const socket = ctx.createRadialGradient(ex, 132, 2, ex, 132, 34);
    socket.addColorStop(0, "#000000");
    socket.addColorStop(0.7, "#0b0705");
    socket.addColorStop(1, "rgba(11,7,5,0)");
    ctx.fillStyle = socket;
    ctx.beginPath();
    ctx.ellipse(ex, 132, 32, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    // pupille rouge
    ctx.fillStyle = "#ff2a1a";
    ctx.beginPath();
    ctx.ellipse(ex, 134, 8, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,120,90,0.55)";
    ctx.beginPath();
    ctx.ellipse(ex, 134, 15, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // nez creux
  ctx.fillStyle = "#0d0907";
  ctx.beginPath();
  ctx.moveTo(128, 152);
  ctx.lineTo(140, 190);
  ctx.lineTo(116, 190);
  ctx.closePath();
  ctx.fill();

  // bouche hurlante
  ctx.fillStyle = "#080505";
  ctx.beginPath();
  ctx.ellipse(128, 240, 44, 52, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#cfc4ad";
  for (let i = 0; i < 7; i++) {
    const tx = 90 + i * 12.5;
    ctx.beginPath();
    ctx.moveTo(tx, 196);
    ctx.lineTo(tx + 11, 196);
    ctx.lineTo(tx + 5.5, 216);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tx, 284);
    ctx.lineTo(tx + 11, 284);
    ctx.lineTo(tx + 5.5, 264);
    ctx.closePath();
    ctx.fill();
  }

  // craquelures
  ctx.strokeStyle = "rgba(20,12,8,0.5)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    let cx = 60 + Math.random() * 136;
    let cy = 40 + Math.random() * 240;
    ctx.moveTo(cx, cy);
    for (let s = 0; s < 3; s++) {
      cx += Math.random() * 26 - 13;
      cy += Math.random() * 26 - 13;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Ciel etoile pour la cinematique d'ouverture. */
export function makeNightSkyTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(512, 256);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#05060e");
  grad.addColorStop(0.62, "#0a0c18");
  grad.addColorStop(1, "#151322");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 165;
    const r = Math.random() * 1.3 + 0.2;
    ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.7})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // lune
  const moon = ctx.createRadialGradient(408, 52, 4, 408, 52, 46);
  moon.addColorStop(0, "rgba(233,235,255,0.95)");
  moon.addColorStop(0.25, "rgba(210,215,245,0.5)");
  moon.addColorStop(1, "rgba(180,190,230,0)");
  ctx.fillStyle = moon;
  ctx.fillRect(340, 0, 140, 130);
  ctx.fillStyle = "#e8ebff";
  ctx.beginPath();
  ctx.arc(408, 52, 17, 0, Math.PI * 2);
  ctx.fill();
  return finish(canvas);
}

/** Facade du manoir vue de l'exterieur (plan unique pour la cinematique). */
export function makeFacadeTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(512, 384);
  ctx.clearRect(0, 0, 512, 384);

  // corps du batiment
  ctx.fillStyle = "#14110f";
  ctx.fillRect(56, 96, 400, 288);
  // toit
  ctx.fillStyle = "#0d0b0a";
  ctx.beginPath();
  ctx.moveTo(30, 100);
  ctx.lineTo(256, 14);
  ctx.lineTo(482, 100);
  ctx.closePath();
  ctx.fill();
  // tours laterales
  ctx.fillStyle = "#100e0c";
  ctx.fillRect(28, 132, 54, 252);
  ctx.fillRect(430, 132, 54, 252);
  for (const tx of [55, 457]) {
    ctx.beginPath();
    ctx.moveTo(tx - 34, 134);
    ctx.lineTo(tx, 74);
    ctx.lineTo(tx + 34, 134);
    ctx.closePath();
    ctx.fill();
  }

  // fenetres : quelques-unes faiblement eclairees
  const lit = new Set([2, 7, 11]);
  let idx = 0;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      const wx = 92 + col * 68;
      const wy = 128 + row * 82;
      ctx.fillStyle = lit.has(idx) ? "#c9922f" : "#06070b";
      ctx.fillRect(wx, wy, 34, 46);
      if (lit.has(idx)) {
        const glow = ctx.createRadialGradient(wx + 17, wy + 23, 2, wx + 17, wy + 23, 46);
        glow.addColorStop(0, "rgba(230,170,70,0.5)");
        glow.addColorStop(1, "rgba(230,170,70,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(wx - 29, wy - 23, 92, 92);
      }
      ctx.strokeStyle = "#221c16";
      ctx.lineWidth = 3;
      ctx.strokeRect(wx, wy, 34, 46);
      ctx.beginPath();
      ctx.moveTo(wx + 17, wy);
      ctx.lineTo(wx + 17, wy + 46);
      ctx.stroke();
      idx++;
    }
  }

  // porte d'entree
  ctx.fillStyle = "#1d1409";
  ctx.fillRect(226, 286, 60, 98);
  ctx.strokeStyle = "#2f2415";
  ctx.lineWidth = 4;
  ctx.strokeRect(226, 286, 60, 98);
  // perron
  ctx.fillStyle = "#191614";
  ctx.fillRect(196, 372, 120, 12);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
