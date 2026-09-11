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

/**
 * Le visage.
 *
 * Trois principes, et ils comptent plus que le nombre de details :
 *  - l'asymetrie (un oeil plus haut, la machoire de travers) : le regard
 *    humain lit une symetrie brisee comme « quelque chose ne va pas » avant
 *    meme de comprendre quoi ;
 *  - le vide des orbites, avec un seul point humide au fond. Une pupille
 *    dessinee fait dessin anime ; un reflet dans un trou noir fait vivant ;
 *  - la peau mouillee et tachee, jamais uniforme.
 *
 * Le fond reste transparent : le plan se pose sur le crane en volume, il
 * n'apporte que le detail.
 */
export function makeMonsterFaceTexture(): THREE.CanvasTexture {
  const W = 256;
  const H = 320;
  const { canvas, ctx } = canvas2d(W, H);
  ctx.clearRect(0, 0, W, H);

  // --- Masque du visage : un ovale etire, legerement penche ---
  ctx.save();
  ctx.translate(128, 158);
  ctx.rotate(0.035);
  const skin = ctx.createRadialGradient(-8, -30, 10, 0, 10, 140);
  skin.addColorStop(0, "#a99e8b");
  skin.addColorStop(0.42, "#6f6558");
  skin.addColorStop(0.76, "#332d27");
  skin.addColorStop(1, "rgba(18,14,12,0)");
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(0, 0, 86, 130, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // --- Taches et coulures : rien n'est propre sur ce visage ---
  for (let i = 0; i < 42; i++) {
    const bx = 52 + Math.random() * 152;
    const by = 40 + Math.random() * 250;
    const r = 5 + Math.random() * 24;
    const blot = ctx.createRadialGradient(bx, by, 0, bx, by, r);
    blot.addColorStop(0, `rgba(28,20,16,${0.16 + Math.random() * 0.3})`);
    blot.addColorStop(1, "rgba(28,20,16,0)");
    ctx.fillStyle = blot;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Orbites : deux trous, pas deux yeux. Le gauche est plus haut. ---
  const EYES: [number, number, number, number][] = [
    // x, y, rayon horizontal, rayon vertical
    [86, 126, 33, 27],
    [170, 134, 30, 24],
  ];
  for (const [ex, ey, rx, ry] of EYES) {
    // Cerne creuse autour de l'orbite.
    const bruise = ctx.createRadialGradient(ex, ey, rx * 0.6, ex, ey, rx * 1.9);
    bruise.addColorStop(0, "rgba(26,16,14,0.75)");
    bruise.addColorStop(1, "rgba(26,16,14,0)");
    ctx.fillStyle = bruise;
    ctx.beginPath();
    ctx.ellipse(ex, ey, rx * 1.9, ry * 1.9, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#040303";
    ctx.beginPath();
    ctx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Le seul point vivant : un reflet humide, minuscule, decentre. Plus
    // gros, il deviendrait une pupille — et une pupille fait dessin anime.
    ctx.fillStyle = "rgba(214,204,186,0.6)";
    ctx.beginPath();
    ctx.ellipse(ex + rx * 0.26, ey - ry * 0.22, 1.7, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(214,204,186,0.26)";
    ctx.beginPath();
    ctx.ellipse(ex - rx * 0.32, ey + ry * 0.12, 1.1, 1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(150,40,28,0.5)";
    ctx.beginPath();
    ctx.ellipse(ex, ey + ry * 0.35, rx * 0.5, ry * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Nez : deux fentes, l'os est parti ---
  ctx.fillStyle = "#0a0706";
  for (const [nx, skew] of [
    [120, -3],
    [138, 4],
  ]) {
    ctx.beginPath();
    ctx.moveTo(nx, 168);
    ctx.quadraticCurveTo(nx + skew, 186, nx + 5, 198);
    ctx.quadraticCurveTo(nx + 11, 186, nx + 10, 168);
    ctx.closePath();
    ctx.fill();
  }

  // --- Bouche : la machoire est descendue trop bas, et de travers ---
  ctx.save();
  ctx.translate(126, 246);
  ctx.rotate(0.07);
  ctx.fillStyle = "#060404";
  ctx.beginPath();
  ctx.ellipse(0, 0, 46, 58, 0, 0, Math.PI * 2);
  ctx.fill();
  // Gorge : un degrade qui s'enfonce, pour que le trou ait un fond.
  const throat = ctx.createRadialGradient(0, 12, 2, 0, 12, 44);
  throat.addColorStop(0, "#1c0b0a");
  throat.addColorStop(1, "rgba(6,4,4,0)");
  ctx.fillStyle = throat;
  ctx.beginPath();
  ctx.ellipse(0, 12, 40, 48, 0, 0, Math.PI * 2);
  ctx.fill();

  // Dents irregulieres : ni la meme taille, ni le meme axe.
  ctx.fillStyle = "#c8bda6";
  for (let i = 0; i < 9; i++) {
    const tx = -42 + i * 10.5;
    const len = 13 + Math.random() * 13;
    const lean = (Math.random() - 0.5) * 6;
    ctx.beginPath();
    ctx.moveTo(tx, -52);
    ctx.lineTo(tx + 8, -52);
    ctx.lineTo(tx + 4 + lean, -52 + len);
    ctx.closePath();
    ctx.fill();
  }
  for (let i = 0; i < 8; i++) {
    const tx = -38 + i * 10.5;
    const len = 11 + Math.random() * 12;
    const lean = (Math.random() - 0.5) * 6;
    ctx.beginPath();
    ctx.moveTo(tx, 54);
    ctx.lineTo(tx + 8, 54);
    ctx.lineTo(tx + 4 + lean, 54 - len);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // --- Veines sombres sous la peau ---
  ctx.lineCap = "round";
  for (let i = 0; i < 14; i++) {
    ctx.strokeStyle = `rgba(30,18,16,${0.18 + Math.random() * 0.3})`;
    ctx.lineWidth = 0.8 + Math.random() * 1.6;
    ctx.beginPath();
    let cx = 58 + Math.random() * 140;
    let cy = 46 + Math.random() * 200;
    ctx.moveTo(cx, cy);
    for (let s = 0; s < 4; s++) {
      cx += Math.random() * 22 - 11;
      cy += Math.random() * 24 - 6;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  // --- Bord du visage fondu dans le noir : pas de decoupe nette ---
  const edge = ctx.createRadialGradient(128, 158, 96, 128, 158, 150);
  edge.addColorStop(0, "rgba(0,0,0,0)");
  edge.addColorStop(1, "rgba(0,0,0,0.92)");
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "source-over";

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

/** Ciel d'aube pour la fin : la nuit se retire, les etoiles s'effacent. */
export function makeDawnSkyTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(512, 256);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#131a2e");
  grad.addColorStop(0.45, "#3b3350");
  grad.addColorStop(0.72, "#8a5a52");
  grad.addColorStop(0.88, "#d18c5c");
  grad.addColorStop(1, "#f0b878");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 90; i++) {
    const y = Math.random() * 110;
    ctx.fillStyle = `rgba(255,255,255,${(1 - y / 110) * 0.5 * Math.random()})`;
    ctx.beginPath();
    ctx.arc(Math.random() * 512, y, Math.random() * 1.1 + 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // bancs de nuages bas
  for (let i = 0; i < 14; i++) {
    const cx = Math.random() * 512;
    const cy = 150 + Math.random() * 80;
    const w = 60 + Math.random() * 130;
    const g2 = ctx.createLinearGradient(cx - w / 2, cy, cx + w / 2, cy);
    g2.addColorStop(0, "rgba(255,190,140,0)");
    g2.addColorStop(0.5, `rgba(255,205,160,${0.1 + Math.random() * 0.16})`);
    g2.addColorStop(1, "rgba(255,190,140,0)");
    ctx.fillStyle = g2;
    ctx.fillRect(cx - w / 2, cy - 7, w, 14);
  }
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
