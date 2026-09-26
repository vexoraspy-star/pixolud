import * as THREE from "three";

// Textures des Backrooms, toutes peintes au canvas (aucune image externe).
//
// Le secret du « look » Backrooms tient a trois choses qu'on reproduit ici :
// un jaune moutarde uniforme mais jamais propre, des taches d'humidite avec
// leur aureole, et un grain de papier/moquette qui accroche la lumiere des
// neons. Chaque texture recoit un bruit pixel par pixel : sans lui, les murs
// ressemblent a du plastique.

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

/** Tuile de bruit gris, calculee une seule fois pour toutes les textures. */
let noiseTile: HTMLCanvasElement | null = null;
function getNoiseTile(): HTMLCanvasElement {
  if (noiseTile) return noiseTile;
  const { canvas, ctx } = canvas2d(256, 256);
  const img = ctx.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(Math.random() * 256);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  noiseTile = canvas;
  return canvas;
}

/**
 * Le grain qui rend une surface « vraie ». On superpose une tuile de bruit
 * en mode « overlay » plutot que de relire l'image pixel par pixel : relire
 * un canvas depuis la carte graphique figeait le lancement d'un niveau.
 */
function grain(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  const tile = getNoiseTile();
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = Math.min(0.6, amount / 70);
  const ox = -Math.floor(Math.random() * 256);
  const oy = -Math.floor(Math.random() * 256);
  for (let y = oy; y < h; y += 256) {
    for (let x = ox; x < w; x += 256) ctx.drawImage(tile, x, y);
  }
  ctx.restore();
}

/** Tache d'humidite : un voile brun, puis l'aureole plus sombre la ou l'eau a seche. */
function waterStain(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, tint: string, ring: string) {
  const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
  g.addColorStop(0, tint);
  g.addColorStop(0.75, tint);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * (0.6 + Math.random() * 0.5), Math.random() * Math.PI, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ring;
  ctx.lineWidth = 1 + Math.random();
  for (let k = 0; k < 1; k++) {
    ctx.beginPath();
    const rr = r * (0.78 + Math.random() * 0.12);
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.3) {
      const wobble = rr * (0.9 + Math.sin(a * 3 + x) * 0.08 + Math.random() * 0.05);
      const px = x + Math.cos(a) * wobble;
      const py = y + Math.sin(a) * wobble * 0.75;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Niveau 0 — le Hall
// ---------------------------------------------------------------------------

/** Papier peint jaune moutarde, a motif discret, sali par le bas. */
export function makeHallWallpaper(): THREE.CanvasTexture {
  const W = 512;
  const H = 716;
  const { canvas, ctx } = canvas2d(W, H);

  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, "#cdb964");
  base.addColorStop(0.7, "#c2ac56");
  base.addColorStop(1, "#a8904a");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // Doubles filets verticaux et petits chevrons entre eux : le motif qu'on
  // ne remarque qu'au bout de dix minutes, et qu'on ne peut plus ignorer.
  for (let x = 0; x < W; x += 32) {
    ctx.fillStyle = "rgba(140,112,40,0.28)";
    ctx.fillRect(x + 2, 0, 2, H);
    ctx.fillRect(x + 7, 0, 1, H);
    ctx.fillStyle = "rgba(150,122,48,0.2)";
    for (let y = (x / 32) % 2 === 0 ? 10 : 26; y < H; y += 32) {
      ctx.beginPath();
      ctx.moveTo(x + 19, y - 6);
      ctx.lineTo(x + 25, y);
      ctx.lineTo(x + 19, y + 6);
      ctx.lineTo(x + 13, y);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Les raccords entre les les de papier.
  for (let x = 0; x < W; x += 128) {
    ctx.fillStyle = "rgba(90,70,25,0.35)";
    ctx.fillRect(x, 0, 1, H);
    ctx.fillStyle = "rgba(255,245,190,0.18)";
    ctx.fillRect(x + 1, 0, 1, H);
  }

  // Salissure qui monte du sol, plinthe.
  const dirt = ctx.createLinearGradient(0, H * 0.62, 0, H);
  dirt.addColorStop(0, "rgba(70,52,18,0)");
  dirt.addColorStop(1, "rgba(70,52,18,0.45)");
  ctx.fillStyle = dirt;
  ctx.fillRect(0, H * 0.62, W, H * 0.38);

  const stains = Math.floor(Math.random() * 3);
  for (let i = 0; i < stains; i++) {
    waterStain(
      ctx,
      Math.random() * W,
      H * (0.2 + Math.random() * 0.7),
      40 + Math.random() * 90,
      "rgba(120,92,32,0.09)",
      "rgba(96,70,22,0.12)",
    );
  }
  // Coulures verticales sous les taches du haut.
  for (let i = 0; i < 7; i++) {
    const x = Math.random() * W;
    const y0 = Math.random() * H * 0.4;
    const len = 80 + Math.random() * 260;
    const g = ctx.createLinearGradient(0, y0, 0, y0 + len);
    g.addColorStop(0, "rgba(100,76,26,0.22)");
    g.addColorStop(1, "rgba(100,76,26,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y0, 2 + Math.random() * 4, len);
  }
  // Papier decolle en haut d'un raccord.
  const peel = 128 * Math.floor(Math.random() * 4);
  ctx.fillStyle = "#e0d397";
  ctx.beginPath();
  ctx.moveTo(peel, 18);
  ctx.lineTo(peel + 22, 30);
  ctx.lineTo(peel + 8, 64);
  ctx.lineTo(peel, 58);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(60,45,15,0.45)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Plinthe de bois fatigue.
  ctx.fillStyle = "#6e5a2c";
  ctx.fillRect(0, H - 34, W, 34);
  ctx.fillStyle = "rgba(255,230,160,0.2)";
  ctx.fillRect(0, H - 34, W, 2);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, H - 6, W, 6);

  grain(ctx, W, H, 18);
  return finish(canvas);
}

/** Moquette beige-jaune, detrempee par endroits. On l'entend presque faire « scrouitch ». */
export function makeHallCarpet(): THREE.CanvasTexture {
  const S = 512;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#8b7638";
  ctx.fillRect(0, 0, S, S);
  // Fibres : des milliers de petits traits clairs et sombres.
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const light = Math.random() < 0.5;
    ctx.strokeStyle = light ? "rgba(190,165,95,0.18)" : "rgba(50,38,14,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 4, y + (Math.random() - 0.5) * 4);
    ctx.stroke();
  }
  // Zones humides, sombres et larges.
  for (let i = 0; i < 4; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = 80 + Math.random() * 140;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(55,42,14,0.22)");
    g.addColorStop(0.6, "rgba(55,42,14,0.1)");
    g.addColorStop(1, "rgba(55,42,14,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Passages uses : la moquette est ecrasee en longues bandes.
  for (let i = 0; i < 3; i++) {
    const y = Math.random() * S;
    const g = ctx.createLinearGradient(0, y - 40, 0, y + 40);
    g.addColorStop(0, "rgba(160,140,80,0)");
    g.addColorStop(0.5, "rgba(160,140,80,0.1)");
    g.addColorStop(1, "rgba(160,140,80,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 40, S, 80);
  }
  grain(ctx, S, S, 26);
  return finish(canvas);
}

/** Dalles de plafond acoustiques, cadre en T, taches d'eau. */
export function makeCeilingTiles(tint = "#d8cd9f", stains = 1): THREE.CanvasTexture {
  const S = 512;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, S, S);
  // Micro-perforations.
  ctx.fillStyle = "rgba(90,80,50,0.22)";
  for (let i = 0; i < 3200; i++) {
    ctx.fillRect(Math.random() * S, Math.random() * S, 1.5, 1.5);
  }
  for (let i = 0; i < stains; i++) {
    waterStain(ctx, Math.random() * S, Math.random() * S, 20 + Math.random() * 50, "rgba(140,110,40,0.12)", "rgba(110,80,25,0.16)");
  }
  // Une dalle un peu affaissee, plus sombre.
  const tx = Math.floor(Math.random() * 2) * 256;
  const ty = Math.floor(Math.random() * 2) * 256;
  ctx.fillStyle = "rgba(60,50,25,0.14)";
  ctx.fillRect(tx, ty, 256, 256);
  // Profiles en T.
  for (const p of [0, 256]) {
    ctx.fillStyle = "#b3a674";
    ctx.fillRect(p, 0, 6, S);
    ctx.fillRect(0, p, S, 6);
    ctx.fillStyle = "rgba(255,250,215,0.4)";
    ctx.fillRect(p, 0, 1, S);
    ctx.fillRect(0, p, S, 1);
  }
  grain(ctx, S, S, 12);
  return finish(canvas);
}

/** Dalle de neon : plaque laiteuse, grille de diffusion, cadre metallique. */
export function makeLightPanel(warm = "#fffbe6", edge = "#e9e0bd"): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(256, 128);
  ctx.fillStyle = "#8b8778";
  ctx.fillRect(0, 0, 256, 128);
  const g = ctx.createRadialGradient(128, 64, 10, 128, 64, 130);
  g.addColorStop(0, warm);
  g.addColorStop(1, edge);
  ctx.fillStyle = g;
  ctx.fillRect(8, 8, 240, 112);
  ctx.strokeStyle = "rgba(160,150,110,0.55)";
  ctx.lineWidth = 1;
  for (let x = 8; x < 248; x += 12) {
    ctx.beginPath();
    ctx.moveTo(x, 8);
    ctx.lineTo(x, 120);
    ctx.stroke();
  }
  for (let y = 8; y < 120; y += 12) {
    ctx.beginPath();
    ctx.moveTo(8, y);
    ctx.lineTo(248, y);
    ctx.stroke();
  }
  // Insectes morts dans le diffuseur.
  ctx.fillStyle = "rgba(40,30,10,0.55)";
  for (let i = 0; i < 5; i++) ctx.fillRect(20 + Math.random() * 216, 20 + Math.random() * 88, 3, 2);
  const t = finish(canvas);
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ---------------------------------------------------------------------------
// Niveau 1 — Zone habitable
// ---------------------------------------------------------------------------

/** Beton coffre : panneaux, trous de banches, coulures, bande de securite. */
export function makeConcreteWall(): THREE.CanvasTexture {
  const W = 512;
  const H = 860;
  const { canvas, ctx } = canvas2d(W, H);
  ctx.fillStyle = "#6c6a64";
  ctx.fillRect(0, 0, W, H);
  // Nuances de coulage.
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 60 + Math.random() * 160;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const light = Math.random() < 0.5;
    g.addColorStop(0, light ? "rgba(150,148,140,0.18)" : "rgba(30,30,28,0.2)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Joints des panneaux de coffrage et trous de tiges.
  ctx.strokeStyle = "rgba(30,30,28,0.45)";
  ctx.lineWidth = 2;
  for (let y = 215; y < H; y += 215) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(256, 0);
  ctx.lineTo(256, H);
  ctx.stroke();
  for (let y = 107; y < H; y += 215) {
    for (const x of [64, 192, 320, 448]) {
      ctx.fillStyle = "rgba(20,20,18,0.7)";
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(160,158,150,0.25)";
      ctx.beginPath();
      ctx.arc(x - 1, y - 1, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Coulures sombres depuis le haut.
  for (let i = 0; i < 16; i++) {
    const x = Math.random() * W;
    const len = 150 + Math.random() * 500;
    const g = ctx.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, "rgba(25,24,20,0.35)");
    g.addColorStop(1, "rgba(25,24,20,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 3 + Math.random() * 8, len);
  }
  // Fissures.
  ctx.strokeStyle = "rgba(15,15,12,0.55)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 4; i++) {
    let x = Math.random() * W;
    let y = Math.random() * H;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 12; k++) {
      x += (Math.random() - 0.5) * 30;
      y += Math.random() * 24;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Bande de securite jaune et noire, usee, a hauteur de chariot.
  const by = H - 150;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, by, W, 46);
  ctx.clip();
  ctx.fillStyle = "#b8932a";
  ctx.fillRect(0, by, W, 46);
  ctx.fillStyle = "#1b1a17";
  for (let x = -60; x < W + 60; x += 44) {
    ctx.beginPath();
    ctx.moveTo(x, by + 46);
    ctx.lineTo(x + 22, by + 46);
    ctx.lineTo(x + 68, by);
    ctx.lineTo(x + 46, by);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = "rgba(108,106,100,0.55)";
  for (let i = 0; i < 90; i++) ctx.fillRect(Math.random() * W, by + Math.random() * 46, 2 + Math.random() * 10, 2 + Math.random() * 6);
  // Humidite en pied de mur.
  const damp = ctx.createLinearGradient(0, H - 120, 0, H);
  damp.addColorStop(0, "rgba(20,24,22,0)");
  damp.addColorStop(1, "rgba(20,24,22,0.6)");
  ctx.fillStyle = damp;
  ctx.fillRect(0, H - 120, W, 120);
  grain(ctx, W, H, 30);
  return finish(canvas);
}

/** Dalle de beton : joints de dilatation, taches d'huile, flaques. */
export function makeConcreteFloor(): THREE.CanvasTexture {
  const S = 512;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#4f4d48";
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = 30 + Math.random() * 120;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, Math.random() < 0.5 ? "rgba(110,108,100,0.14)" : "rgba(15,15,12,0.2)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Flaques : tres sombres, avec un liseré clair qui evoque le reflet.
  for (let i = 0; i < 2; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const rx = 30 + Math.random() * 70;
    const ry = rx * (0.4 + Math.random() * 0.4);
    ctx.fillStyle = "rgba(18,20,22,0.38)";
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(170,180,190,0.16)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(20,20,18,0.55)";
  ctx.fillRect(0, 254, S, 3);
  ctx.fillRect(254, 0, 3, S);
  grain(ctx, S, S, 34);
  return finish(canvas);
}

/** Carton ondule, pour les caisses des rayonnages. */
export function makeCardboard(): THREE.CanvasTexture {
  const S = 256;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#8a6a3e";
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = "rgba(60,42,18,0.25)";
  for (let x = 0; x < S; x += 6) ctx.fillRect(x, 0, 2, S);
  ctx.fillStyle = "#b49356";
  ctx.fillRect(0, S / 2 - 14, S, 28);
  ctx.fillStyle = "rgba(40,30,15,0.6)";
  ctx.font = "bold 20px monospace";
  ctx.fillText("FRAGILE", 20, 60);
  ctx.fillText("↑ ↑", 180, 220);
  grain(ctx, S, S, 22);
  return finish(canvas);
}

// ---------------------------------------------------------------------------
// Niveau 2 — Tuyauterie
// ---------------------------------------------------------------------------

/** Toles rouillees et rivetees. */
export function makeMetalWall(): THREE.CanvasTexture {
  const W = 512;
  const H = 668;
  const { canvas, ctx } = canvas2d(W, H);
  ctx.fillStyle = "#3a3431";
  ctx.fillRect(0, 0, W, H);
  const panelH = 167;
  for (let py = 0; py < H; py += panelH) {
    for (let px = 0; px < W; px += 256) {
      const shade = 48 + Math.floor(Math.random() * 16);
      ctx.fillStyle = `rgb(${shade + 6},${shade},${shade - 4})`;
      ctx.fillRect(px + 3, py + 3, 250, panelH - 6);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(px, py, 256, 3);
      ctx.fillRect(px, py, 3, panelH);
      // Rivets.
      for (let rx = px + 14; rx < px + 256; rx += 32) {
        for (const ry of [py + 12, py + panelH - 12]) {
          ctx.fillStyle = "rgba(20,16,14,0.8)";
          ctx.beginPath();
          ctx.arc(rx + 1, ry + 1, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(150,130,110,0.4)";
          ctx.beginPath();
          ctx.arc(rx - 1, ry - 1, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  // Rouille : coulures orangees et plaques.
  for (let i = 0; i < 22; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const len = 40 + Math.random() * 220;
    const g = ctx.createLinearGradient(0, y, 0, y + len);
    g.addColorStop(0, "rgba(140,62,22,0.55)");
    g.addColorStop(1, "rgba(140,62,22,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, 2 + Math.random() * 6, len);
  }
  for (let i = 0; i < 10; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 15 + Math.random() * 45;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(120,52,18,0.5)");
    g.addColorStop(1, "rgba(120,52,18,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  grain(ctx, W, H, 28);
  return finish(canvas);
}

/** Caillebotis metallique : on voit le noir a travers. */
export function makeGrating(): THREE.CanvasTexture {
  const S = 256;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#050404";
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = "#3d3632";
  ctx.lineWidth = 5;
  for (let i = -S; i < S * 2; i += 20) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + S, S);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i + S, 0);
    ctx.lineTo(i, S);
    ctx.stroke();
  }
  ctx.fillStyle = "#4a423c";
  for (let y = 0; y < S; y += 64) ctx.fillRect(0, y, S, 6);
  ctx.fillStyle = "rgba(130,60,20,0.35)";
  for (let i = 0; i < 40; i++) ctx.fillRect(Math.random() * S, Math.random() * S, 4 + Math.random() * 12, 3);
  grain(ctx, S, S, 20);
  return finish(canvas);
}

/** Plafond sombre et suintant, pour les tunnels et l'entrepot. */
export function makeDarkCeiling(base = "#1e1c1a"): THREE.CanvasTexture {
  const S = 256;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 12; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = 20 + Math.random() * 60;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(0,0,0,0.35)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(0, 126, S, 4);
  grain(ctx, S, S, 22);
  return finish(canvas);
}

// ---------------------------------------------------------------------------
// Niveau ! — Cours
// ---------------------------------------------------------------------------

/** Carrelage blanc sale : sous les lumieres d'alarme, il devient rouge sang. */
export function makeTileWall(): THREE.CanvasTexture {
  const W = 512;
  const H = 768;
  const { canvas, ctx } = canvas2d(W, H);
  ctx.fillStyle = "#6f6a63";
  ctx.fillRect(0, 0, W, H);
  const t = 64;
  for (let y = 0; y < H; y += t) {
    for (let x = 0; x < W; x += t) {
      const shade = 200 + Math.floor(Math.random() * 30);
      ctx.fillStyle = `rgb(${shade},${shade - 6},${shade - 14})`;
      ctx.fillRect(x + 3, y + 3, t - 6, t - 6);
      if (Math.random() < 0.05) {
        ctx.fillStyle = "rgba(40,35,30,0.55)";
        ctx.beginPath();
        ctx.moveTo(x + 5 + Math.random() * 20, y + 5);
        ctx.lineTo(x + t - 5, y + t - 5 - Math.random() * 20);
        ctx.lineTo(x + t - 8, y + t - 5);
        ctx.fill();
      }
    }
  }
  for (let i = 0; i < 12; i++) {
    const x = Math.random() * W;
    const len = 120 + Math.random() * 400;
    const y = Math.random() * H * 0.5;
    const g = ctx.createLinearGradient(0, y, 0, y + len);
    g.addColorStop(0, "rgba(60,40,30,0.4)");
    g.addColorStop(1, "rgba(60,40,30,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, 4 + Math.random() * 10, len);
  }
  const dirt = ctx.createLinearGradient(0, H * 0.7, 0, H);
  dirt.addColorStop(0, "rgba(30,20,15,0)");
  dirt.addColorStop(1, "rgba(30,20,15,0.6)");
  ctx.fillStyle = dirt;
  ctx.fillRect(0, H * 0.7, W, H * 0.3);
  grain(ctx, W, H, 24);
  return finish(canvas);
}

export function makeTileFloor(): THREE.CanvasTexture {
  const S = 512;
  const { canvas, ctx } = canvas2d(S, S);
  const t = 64;
  for (let y = 0; y < S; y += t) {
    for (let x = 0; x < S; x += t) {
      const dark = ((x + y) / t) % 2 === 0;
      const v = dark ? 40 + Math.random() * 10 : 120 + Math.random() * 20;
      ctx.fillStyle = `rgb(${v},${v - 4},${v - 8})`;
      ctx.fillRect(x, y, t, t);
    }
  }
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 2;
  for (let p = 0; p <= S; p += t) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, S);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(S, p);
    ctx.stroke();
  }
  for (let i = 0; i < 8; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = 30 + Math.random() * 80;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(20,10,8,0.5)");
    g.addColorStop(1, "rgba(20,10,8,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  grain(ctx, S, S, 26);
  return finish(canvas);
}

// ---------------------------------------------------------------------------
// Decors communs
// ---------------------------------------------------------------------------

/** Fleche peinte a la bombe, vers la droite, avec ses coulures. */
export function makeArrowDecal(color = "#8a1410"): THREE.CanvasTexture {
  const S = 256;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.clearRect(0, 0, S, S);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.moveTo(30, 132);
  ctx.quadraticCurveTo(110, 118, 190, 128);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(150, 78);
  ctx.lineTo(214, 128);
  ctx.lineTo(148, 180);
  ctx.stroke();
  // Pulverisation autour du trait.
  for (let i = 0; i < 700; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 14 + Math.random() * 18;
    const along = Math.random();
    const x = 30 + along * 180 + Math.cos(a) * r;
    const y = 128 + Math.sin(a) * r * 0.6;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;
  // Coulures.
  ctx.lineWidth = 4;
  for (let i = 0; i < 6; i++) {
    const x = 40 + Math.random() * 160;
    ctx.beginPath();
    ctx.moveTo(x, 138);
    ctx.lineTo(x + (Math.random() - 0.5) * 3, 150 + Math.random() * 70);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export type DoorStyle = "service" | "monte-charge" | "trappe" | "sortie" | "centrale" | "securite" | "piscine" | "hotel" | "noir" | "fete";

/** Portes de sortie, une par niveau. */
export function makeDoorTexture(style: DoorStyle): THREE.CanvasTexture {
  const W = 256;
  const H = 512;
  const { canvas, ctx } = canvas2d(W, H);
  if (style === "monte-charge") {
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, "#5d5e5c");
    g.addColorStop(0.5, "#8b8c88");
    g.addColorStop(1, "#5d5e5c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 3) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
      ctx.fillRect(0, y, W, 1);
    }
    ctx.fillStyle = "#1c1c1a";
    ctx.fillRect(W / 2 - 2, 0, 4, H);
    ctx.fillStyle = "#b8932a";
    ctx.fillRect(0, H - 40, W, 40);
    ctx.fillStyle = "#1b1a17";
    for (let x = -40; x < W + 40; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, H);
      ctx.lineTo(x + 15, H);
      ctx.lineTo(x + 45, H - 40);
      ctx.lineTo(x + 30, H - 40);
      ctx.fill();
    }
    ctx.fillStyle = "#1c1c1a";
    ctx.fillRect(W / 2 - 60, 40, 120, 30);
    ctx.fillStyle = "#e7b24a";
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.fillText("MONTE-CHARGE", W / 2, 61);
  } else if (style === "trappe") {
    ctx.fillStyle = "#3b3531";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#1a1614";
    ctx.lineWidth = 10;
    ctx.strokeRect(14, 14, W - 28, H - 28);
    ctx.strokeStyle = "#7a6a58";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 64, 0, Math.PI * 2);
    ctx.stroke();
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
      ctx.beginPath();
      ctx.moveTo(W / 2, H / 2);
      ctx.lineTo(W / 2 + Math.cos(a) * 64, H / 2 + Math.sin(a) * 64);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(140,62,22,0.5)";
    for (let i = 0; i < 18; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 3 + Math.random() * 8, 20 + Math.random() * 80);
  } else if (style === "centrale") {
    // Porte de local technique : tole grise, triangle haute tension, rouille.
    ctx.fillStyle = "#4d524d";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 8;
    ctx.strokeRect(12, 12, W - 24, H - 24);
    for (let y = 60; y < H - 40; y += 90) {
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(30, y, W - 60, 4);
    }
    ctx.fillStyle = "#e7b92a";
    ctx.beginPath();
    ctx.moveTo(W / 2, 70);
    ctx.lineTo(W / 2 + 62, 178);
    ctx.lineTo(W / 2 - 62, 178);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#15130e";
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = "#15130e";
    ctx.beginPath();
    ctx.moveTo(W / 2 + 8, 96);
    ctx.lineTo(W / 2 - 18, 142);
    ctx.lineTo(W / 2 + 2, 142);
    ctx.lineTo(W / 2 - 10, 170);
    ctx.lineTo(W / 2 + 20, 124);
    ctx.lineTo(W / 2, 124);
    ctx.closePath();
    ctx.fill();
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#e7b92a";
    ctx.fillText("DANGER", W / 2, 214);
    ctx.fillStyle = "#1b1a17";
    ctx.fillRect(W - 60, 270, 30, 50);
    ctx.fillStyle = "rgba(130,60,20,0.45)";
    for (let i = 0; i < 26; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 3 + Math.random() * 10, 10 + Math.random() * 60);
  } else if (style === "securite") {
    // Porte coupe-feu des bureaux : lecteur de badge, bandeau, vitre armee.
    ctx.fillStyle = "#8d9496";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, W - 20, H - 20);
    ctx.fillStyle = "#c9dde2";
    ctx.fillRect(W / 2 - 30, 60, 60, 150);
    ctx.strokeStyle = "rgba(70,80,85,0.5)";
    ctx.lineWidth = 1;
    for (let y = 60; y < 210; y += 12) {
      ctx.beginPath();
      ctx.moveTo(W / 2 - 30, y);
      ctx.lineTo(W / 2 + 30, y);
      ctx.stroke();
    }
    for (let x = W / 2 - 30; x <= W / 2 + 30; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, 60);
      ctx.lineTo(x, 210);
      ctx.stroke();
    }
    ctx.fillStyle = "#2a6f9e";
    ctx.fillRect(10, 240, W - 20, 30);
    ctx.fillStyle = "#f2f6f8";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ACCÈS RÉSERVÉ", W / 2, 262);
    ctx.fillStyle = "#1d2022";
    ctx.fillRect(W - 62, 296, 34, 56);
    ctx.fillStyle = "#c0392b";
    ctx.fillRect(W - 52, 306, 14, 6);
    ctx.fillStyle = "#3a3e40";
    ctx.fillRect(28, 300, 16, 70);
  } else if (style === "piscine") {
    // Porte de vestiaire : blanche, hublot rond, pictogramme de nageur.
    ctx.fillStyle = "#e4eeee";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(60,110,120,0.35)";
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, W - 20, H - 20);
    ctx.fillStyle = "#1f3b44";
    ctx.beginPath();
    ctx.arc(W / 2, 130, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#9fb4b8";
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.fillStyle = "#2a7fa0";
    ctx.fillRect(40, 240, W - 80, 64);
    ctx.fillStyle = "#f4fbfc";
    ctx.beginPath();
    ctx.arc(W / 2 - 34, 262, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#f4fbfc";
    ctx.beginPath();
    ctx.moveTo(W / 2 - 24, 268);
    ctx.lineTo(W / 2 + 30, 262);
    ctx.stroke();
    ctx.beginPath();
    for (let x = 56; x < W - 56; x += 4) ctx.lineTo(x, 292 + Math.sin(x * 0.2) * 4);
    ctx.stroke();
    ctx.fillStyle = "#b9c6c7";
    ctx.fillRect(28, 330, 18, 60);
    ctx.fillStyle = "rgba(90,130,120,0.18)";
    for (let i = 0; i < 12; i++) ctx.fillRect(Math.random() * W, H - 80 + Math.random() * 60, 2 + Math.random() * 30, 2);
  } else if (style === "hotel") {
    // Porte du personnel : tole peinte creme, on la distingue des portes de chambre en bois.
    ctx.fillStyle = "#cfc4a8";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(60,45,30,0.4)";
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, W - 20, H - 20);
    ctx.fillStyle = "#7a1c1c";
    ctx.fillRect(38, 70, W - 76, 64);
    ctx.fillStyle = "#e9d3a0";
    ctx.font = "bold 22px serif";
    ctx.textAlign = "center";
    ctx.fillText("PERSONNEL", W / 2, 99);
    ctx.font = "13px serif";
    ctx.fillText("SORTIE DE SERVICE", W / 2, 121);
    // Barre anti-panique et traces de mains sales autour.
    ctx.fillStyle = "#3a3630";
    ctx.fillRect(24, 272, W - 48, 20);
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(24, 272, W - 48, 3);
    ctx.fillStyle = "rgba(70,50,30,0.22)";
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.ellipse(40 + Math.random() * (W - 80), 250 + Math.random() * 60, 12, 16, Math.random(), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#8a7a5a";
    ctx.fillRect(0, H - 34, W, 34);
  } else if (style === "noir") {
    // Lourde porte d'acier noir ; quelqu'un a peint « SORTIE » en vert qui luit.
    ctx.fillStyle = "#18191b";
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 64) {
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(12, y + 4, W - 24, 2);
    }
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, W - 16, H - 16);
    ctx.save();
    ctx.translate(W / 2, 170);
    ctx.rotate(-0.08);
    ctx.fillStyle = "#6dff8a";
    ctx.shadowColor = "#6dff8a";
    ctx.shadowBlur = 14;
    ctx.font = "bold 44px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SORTIE", 0, 0);
    ctx.restore();
    ctx.fillStyle = "#6dff8a";
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 5; i++) ctx.fillRect(70 + Math.random() * 110, 176, 3, 20 + Math.random() * 50);
    ctx.globalAlpha = 1;
    // Griffures profondes, a hauteur de chien.
    ctx.strokeStyle = "rgba(160,160,165,0.55)";
    ctx.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.moveTo(60 + k * 12, 360);
      ctx.lineTo(80 + k * 14, 470);
      ctx.stroke();
    }
    ctx.fillStyle = "#2c2d30";
    ctx.fillRect(W - 58, 270, 26, 60);
  } else if (style === "fete") {
    // Porte de sortie de la fete : rayures bonbon, ballons scotches, et un grand sourire.
    for (let k = 0, x = -H; x < W + H; k++, x += 40) {
      ctx.fillStyle = k % 2 === 0 ? "#ff7ab8" : "#fff2f8";
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 20, 0);
      ctx.lineTo(x + 20 + H * 0.4, H);
      ctx.lineTo(x + H * 0.4, H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(90,20,60,0.5)";
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, W - 16, H - 16);
    ctx.fillStyle = "#fff8d6";
    ctx.beginPath();
    ctx.arc(W / 2, 150, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1b1418";
    ctx.font = "bold 72px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("=)", W / 2, 152);
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#7a1450";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText("À BIENTÔT !", W / 2, 262);
    for (const [bx, by, c] of [
      [30, 40, "#5fd4ff"],
      [W - 34, 52, "#ffe45c"],
      [44, 330, "#8cff6a"],
    ] as const) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(bx, by, 18, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(40,20,30,0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bx, by + 22);
      ctx.lineTo(bx + 6, by + 70);
      ctx.stroke();
    }
    ctx.fillStyle = "#3a1830";
    ctx.fillRect(W - 60, 290, 26, 54);
  } else {
    ctx.fillStyle = style === "sortie" ? "#6b6560" : "#77746a";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, W - 20, H - 20);
    // Hublot grillage.
    ctx.fillStyle = "#1d1f20";
    ctx.fillRect(W / 2 - 34, 70, 68, 100);
    ctx.strokeStyle = "rgba(160,170,170,0.35)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.moveTo(W / 2 - 34, 70 + i * 10);
      ctx.lineTo(W / 2 + 34, 70 + i * 10 + 20);
      ctx.stroke();
    }
    // Barre anti-panique.
    ctx.fillStyle = "#2b2b28";
    ctx.fillRect(24, 270, W - 48, 22);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(24, 270, W - 48, 3);
    ctx.fillStyle = "rgba(40,30,20,0.4)";
    for (let i = 0; i < 20; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 20, 2);
  }
  grain(ctx, W, H, 20);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Panneau lumineux « SORTIE » / « EXIT » au-dessus de la porte. */
export function makeExitSign(text = "SORTIE"): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(256, 96);
  ctx.fillStyle = "#0e1a10";
  ctx.fillRect(0, 0, 256, 96);
  ctx.fillStyle = "#39ff6a";
  ctx.shadowColor = "#39ff6a";
  ctx.shadowBlur = 16;
  ctx.font = "bold 46px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 50);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Armoire electrique du niveau 1 : les fusibles se posent la. */
export function makeFuseBoxTexture(filled: number): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(256, 256);
  ctx.fillStyle = "#56605a";
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 240, 240);
  ctx.fillStyle = "#e7b24a";
  ctx.beginPath();
  ctx.moveTo(128, 20);
  ctx.lineTo(160, 76);
  ctx.lineTo(96, 76);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#1b1a17";
  ctx.font = "bold 36px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("⚡", 128, 70);
  for (let i = 0; i < 3; i++) {
    const x = 52 + i * 76;
    ctx.fillStyle = "#1a1c1a";
    ctx.fillRect(x - 22, 110, 44, 100);
    if (i < filled) {
      ctx.fillStyle = "#d9d3c0";
      ctx.fillRect(x - 12, 120, 24, 80);
      ctx.fillStyle = "#c0392b";
      ctx.fillRect(x - 12, 150, 24, 18);
    }
  }
  grain(ctx, 256, 256, 18);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Etiquette de l'eau d'amande. */
export function makeWaterLabel(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(256, 128);
  ctx.fillStyle = "#f2ecd9";
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = "#8a6a2e";
  ctx.fillRect(0, 0, 256, 18);
  ctx.fillRect(0, 110, 256, 18);
  ctx.fillStyle = "#3b2a10";
  ctx.font = "bold 22px serif";
  ctx.textAlign = "center";
  ctx.fillText("EAU D'AMANDE", 128, 62);
  ctx.font = "14px serif";
  ctx.fillText("Buvez lentement", 128, 88);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

// ---------------------------------------------------------------------------
// Niveau 3 — Centrale electrique
// ---------------------------------------------------------------------------

/** Brique noircie de suie, soubassement peint en vert d'usine, cable qui court. */
export function makeBrickWall(): THREE.CanvasTexture {
  const W = 512;
  const H = 768;
  const { canvas, ctx } = canvas2d(W, H);
  ctx.fillStyle = "#2a1c16";
  ctx.fillRect(0, 0, W, H);
  const bw = 64;
  const bh = 28;
  for (let row = 0, y = 0; y < H; row++, y += bh) {
    const off = row % 2 === 0 ? 0 : bw / 2;
    for (let x = -off; x < W; x += bw) {
      const r = 96 + Math.random() * 40;
      const g = 52 + Math.random() * 22;
      const b = 38 + Math.random() * 16;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x + 3, y + 3, bw - 6, bh - 5);
      // Arete eclairee et ombre sous chaque brique.
      ctx.fillStyle = "rgba(255,200,160,0.08)";
      ctx.fillRect(x + 3, y + 3, bw - 6, 2);
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(x + 3, y + bh - 4, bw - 6, 2);
      if (Math.random() < 0.06) {
        ctx.fillStyle = "rgba(20,12,8,0.5)";
        ctx.fillRect(x + 6 + Math.random() * 30, y + 5, 10 + Math.random() * 16, bh - 10);
      }
    }
  }
  // Suie qui monte vers le plafond.
  const soot = ctx.createLinearGradient(0, 0, 0, H * 0.5);
  soot.addColorStop(0, "rgba(10,8,6,0.65)");
  soot.addColorStop(1, "rgba(10,8,6,0)");
  ctx.fillStyle = soot;
  ctx.fillRect(0, 0, W, H * 0.5);
  // Soubassement peint, ecaille.
  const band = H * 0.62;
  ctx.fillStyle = "#3f5347";
  ctx.fillRect(0, band, W, H - band);
  ctx.fillStyle = "#c9a227";
  ctx.fillRect(0, band - 10, W, 10);
  ctx.fillStyle = "#15130e";
  for (let x = -20; x < W + 20; x += 26) {
    ctx.beginPath();
    ctx.moveTo(x, band - 10);
    ctx.lineTo(x + 12, band - 10);
    ctx.lineTo(x + 4, band);
    ctx.lineTo(x - 8, band);
    ctx.closePath();
    ctx.fill();
  }
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(${100 + Math.random() * 30},${56 + Math.random() * 20},40,0.9)`;
    ctx.fillRect(Math.random() * W, band + Math.random() * (H - band), 4 + Math.random() * 22, 3 + Math.random() * 10);
  }
  const dirt = ctx.createLinearGradient(0, H * 0.85, 0, H);
  dirt.addColorStop(0, "rgba(10,8,6,0)");
  dirt.addColorStop(1, "rgba(10,8,6,0.6)");
  ctx.fillStyle = dirt;
  ctx.fillRect(0, H * 0.85, W, H * 0.15);
  // Chemin de cables.
  ctx.fillStyle = "#161412";
  ctx.fillRect(0, 150, W, 9);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(0, 150, W, 2);
  grain(ctx, W, H, 26);
  return finish(canvas);
}

/** Face d'armoire ou de transformateur : tole peinte, grilles, voyants, jauge. */
export function makeMachinePanel(): THREE.CanvasTexture {
  const S = 512;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#56615a";
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, S - 12, S - 12);
  ctx.beginPath();
  ctx.moveTo(S / 2, 6);
  ctx.lineTo(S / 2, S - 6);
  ctx.stroke();
  // Grilles d'aeration.
  ctx.fillStyle = "#1a1d1b";
  for (const x0 of [40, S / 2 + 40]) {
    for (let y = 60; y < 200; y += 14) ctx.fillRect(x0, y, 176, 7);
  }
  // Plaque constructeur et jauge.
  ctx.fillStyle = "#c8c2ad";
  ctx.fillRect(60, 240, 130, 60);
  ctx.fillStyle = "#2a2620";
  ctx.font = "bold 15px monospace";
  ctx.fillText("TR-400 kVA", 70, 266);
  ctx.fillText("20 000 V", 70, 288);
  ctx.fillStyle = "#e9e3d2";
  ctx.beginPath();
  ctx.arc(S * 0.75, 280, 40, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2a2520";
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.strokeStyle = "#b3261e";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(S * 0.75, 280);
  ctx.lineTo(S * 0.75 + 26, 262);
  ctx.stroke();
  // Bandeau haute tension.
  ctx.fillStyle = "#d9a91f";
  ctx.fillRect(6, S - 110, S - 12, 34);
  ctx.fillStyle = "#15130e";
  for (let x = -30; x < S + 30; x += 34) {
    ctx.beginPath();
    ctx.moveTo(x, S - 110);
    ctx.lineTo(x + 16, S - 110);
    ctx.lineTo(x + 2, S - 76);
    ctx.lineTo(x - 14, S - 76);
    ctx.closePath();
    ctx.fill();
  }
  // Coulures d'huile et rouille.
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * S;
    const y = 320 + Math.random() * 60;
    const g = ctx.createLinearGradient(0, y, 0, y + 120);
    g.addColorStop(0, "rgba(40,24,12,0.45)");
    g.addColorStop(1, "rgba(40,24,12,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, 3 + Math.random() * 6, 120);
  }
  const dirt = ctx.createLinearGradient(0, S * 0.8, 0, S);
  dirt.addColorStop(0, "rgba(10,10,8,0)");
  dirt.addColorStop(1, "rgba(10,10,8,0.55)");
  ctx.fillStyle = dirt;
  ctx.fillRect(0, S * 0.8, S, S * 0.2);
  grain(ctx, S, S, 24);
  return finish(canvas);
}

// ---------------------------------------------------------------------------
// Niveau 4 — Bureaux abandonnes
// ---------------------------------------------------------------------------

/** Peinture blanc casse de bureau, plinthe grise, traces de chaises et de scotch. */
export function makeOfficeWall(): THREE.CanvasTexture {
  const W = 512;
  const H = 716;
  const { canvas, ctx } = canvas2d(W, H);
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, "#d9d8cf");
  base.addColorStop(1, "#c3c2b8");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  // Rail de protection a hauteur de chaise.
  ctx.fillStyle = "#9ea3a3";
  ctx.fillRect(0, H * 0.6, W, 14);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(0, H * 0.6, W, 2);
  // Rayures de dossiers de chaises sous le rail.
  ctx.strokeStyle = "rgba(60,60,55,0.18)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 16; i++) {
    const x = Math.random() * W;
    const y = H * 0.64 + Math.random() * 50;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 20 + Math.random() * 50, y + (Math.random() - 0.5) * 6);
    ctx.stroke();
  }
  // Traces rectangulaires : des cadres et des tableaux decroches.
  for (let i = 0; i < 2; i++) {
    const w = 70 + Math.random() * 110;
    const h = 50 + Math.random() * 80;
    const x = Math.random() * (W - w);
    const y = 90 + Math.random() * 180;
    ctx.fillStyle = "rgba(240,240,232,0.55)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(90,88,80,0.2)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
  }
  // Morceaux de scotch jauni.
  ctx.fillStyle = "rgba(210,190,120,0.5)";
  for (let i = 0; i < 5; i++) ctx.fillRect(Math.random() * W, 120 + Math.random() * 260, 18, 7);
  if (Math.random() < 0.5) {
    waterStain(ctx, Math.random() * W, 60 + Math.random() * 120, 30 + Math.random() * 60, "rgba(140,120,70,0.1)", "rgba(110,90,50,0.14)");
  }
  // Plinthe.
  ctx.fillStyle = "#4a4d4f";
  ctx.fillRect(0, H - 30, W, 30);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(0, H - 30, W, 2);
  const dirt = ctx.createLinearGradient(0, H * 0.8, 0, H - 30);
  dirt.addColorStop(0, "rgba(50,48,40,0)");
  dirt.addColorStop(1, "rgba(50,48,40,0.25)");
  ctx.fillStyle = dirt;
  ctx.fillRect(0, H * 0.8, W, H * 0.2 - 30);
  grain(ctx, W, H, 14);
  return finish(canvas);
}

/** Moquette en dalles de 50 cm, poses a sens alterne, bleu-gris d'open-space. */
export function makeOfficeCarpet(): THREE.CanvasTexture {
  const S = 512;
  const { canvas, ctx } = canvas2d(S, S);
  const t = 128;
  for (let y = 0; y < S; y += t) {
    for (let x = 0; x < S; x += t) {
      const v = Math.random() * 8;
      ctx.fillStyle = `rgb(${72 + v},${80 + v},${90 + v})`;
      ctx.fillRect(x, y, t, t);
      const vertical = ((x + y) / t) % 2 === 0;
      ctx.strokeStyle = "rgba(30,34,40,0.22)";
      ctx.lineWidth = 1;
      for (let k = 4; k < t; k += 5) {
        ctx.beginPath();
        if (vertical) {
          ctx.moveTo(x + k, y);
          ctx.lineTo(x + k, y + t);
        } else {
          ctx.moveTo(x, y + k);
          ctx.lineTo(x + t, y + k);
        }
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(20,22,26,0.4)";
      ctx.strokeRect(x + 0.5, y + 0.5, t - 1, t - 1);
    }
  }
  for (let i = 0; i < 3; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = 30 + Math.random() * 60;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(40,34,24,0.3)");
    g.addColorStop(1, "rgba(40,34,24,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  grain(ctx, S, S, 22);
  return finish(canvas);
}

/** Tissu des cloisons de box : chine bleu-gris, profil alu en haut. */
export function makeCubicleFabric(): THREE.CanvasTexture {
  const S = 256;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#5f6b78";
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 5000; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? "rgba(140,152,166,0.18)" : "rgba(30,36,44,0.2)";
    ctx.fillRect(Math.random() * S, Math.random() * S, 1.5, 1.5);
  }
  ctx.fillStyle = "#b5babd";
  ctx.fillRect(0, 0, S, 10);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, 10, S, 3);
  // Post-it oublies.
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = ["#e8dc6a", "#e89ab0", "#8fd1e0"][i];
    ctx.fillRect(20 + Math.random() * 200, 40 + Math.random() * 150, 22, 22);
  }
  grain(ctx, S, S, 18);
  return finish(canvas);
}

/** Ecran d'ordinateur allume pour personne : fenetres, tableur, et un message. */
export function makeScreenTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(256, 160);
  const g = ctx.createLinearGradient(0, 0, 0, 160);
  g.addColorStop(0, "#2d6fa6");
  g.addColorStop(1, "#1b4a73");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 160);
  ctx.fillStyle = "#e9eef2";
  ctx.fillRect(22, 18, 150, 104);
  ctx.fillStyle = "#1f5f99";
  ctx.fillRect(22, 18, 150, 12);
  ctx.strokeStyle = "rgba(60,80,100,0.35)";
  ctx.lineWidth = 1;
  for (let y = 38; y < 118; y += 8) {
    ctx.beginPath();
    ctx.moveTo(26, y);
    ctx.lineTo(168, y);
    ctx.stroke();
  }
  for (let x = 58; x < 168; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, 34);
    ctx.lineTo(x, 120);
    ctx.stroke();
  }
  ctx.fillStyle = "#101418";
  ctx.font = "bold 13px monospace";
  ctx.fillText("AIDEZ-MOI", 150, 142);
  ctx.fillStyle = "#1a1f24";
  ctx.fillRect(0, 150, 256, 10);
  return finish(canvas);
}

// ---------------------------------------------------------------------------
// Niveau 37 — Les Piscines
// ---------------------------------------------------------------------------

/** Petit carrelage blanc brillant (ou bleu pour le fond des bassins), joints gris. */
export function makePoolTile(bottom = false): THREE.CanvasTexture {
  const S = 512;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = bottom ? "#6fa9b4" : "#b9c9c9";
  ctx.fillRect(0, 0, S, S);
  const t = 32;
  for (let y = 0; y < S; y += t) {
    for (let x = 0; x < S; x += t) {
      const v = Math.random() * 10;
      ctx.fillStyle = bottom ? `rgb(${96 + v},${176 + v},${190 + v})` : `rgb(${232 + v * 0.5},${240 + v * 0.5},${238 + v * 0.5})`;
      ctx.fillRect(x + 2, y + 2, t - 3, t - 3);
      // Reflet sur l'emaille.
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(x + 4, y + 4, t - 12, 2);
    }
  }
  if (!bottom) {
    // Traces de calcaire, rares : c'est presque trop propre.
    for (let i = 0; i < 3; i++) {
      const x = Math.random() * S;
      const y = Math.random() * S;
      const r = 20 + Math.random() * 50;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(150,170,160,0.16)");
      g.addColorStop(1, "rgba(150,170,160,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  grain(ctx, S, S, 8);
  return finish(canvas);
}

/** Surface de l'eau : reseau de caustiques clairs, a faire defiler. */
export function makeWaterSurface(): THREE.CanvasTexture {
  const S = 256;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#7fd3de";
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = "rgba(240,255,255,0.55)";
  ctx.lineCap = "round";
  // Cellules de Voronoi approximees : des boucles irregulieres qui se touchent.
  for (let i = 0; i < 26; i++) {
    const cx = Math.random() * S;
    const cy = Math.random() * S;
    const r = 14 + Math.random() * 18;
    ctx.lineWidth = 1 + Math.random() * 2.2;
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.5) {
        const rr = r * (0.75 + Math.sin(a * 3 + i) * 0.2);
        const px = cx + ox + Math.cos(a) * rr;
        const py = cy + oy + Math.sin(a) * rr;
        if (a === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
  return finish(canvas);
}

/**
 * Dessine `draw(x, y)` a sa place et, pres d'un bord, de l'autre cote aussi :
 * la texture se repete sans couture.
 */
function wrapped(S: number, x: number, y: number, margin: number, draw: (x: number, y: number) => void) {
  for (const ox of [0, -S, S]) {
    if (ox !== 0 && (ox < 0 ? x < S - margin : x > margin)) continue;
    for (const oy of [0, -S, S]) {
      if (oy !== 0 && (oy < 0 ? y < S - margin : y > margin)) continue;
      draw(x + ox, y + oy);
    }
  }
}

// ---------------------------------------------------------------------------
// Niveau 5 — L'Hotel de la terreur
// ---------------------------------------------------------------------------

/** Fleuron de damas : une feuille en goutte, deux volutes, une perle. */
function damask(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, fill: string, line: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(cx, cy - s);
  ctx.quadraticCurveTo(cx + s * 0.75, cy - s * 0.2, cx, cy + s * 0.9);
  ctx.quadraticCurveTo(cx - s * 0.75, cy - s * 0.2, cx, cy - s);
  ctx.fill();
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx + side * s * 0.62, cy + s * 0.55, s * 0.32, side < 0 ? -0.4 : Math.PI - 1.9, side < 0 ? 1.9 : Math.PI + 0.4);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy - s * 1.25, s * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = line;
  ctx.fill();
}

/** Papier peint d'hotel : damas rouge sombre, cimaise, lambris de noyer. Les motifs se raccordent d'un mur a l'autre. */
export function makeHotelWallpaper(): THREE.CanvasTexture {
  const W = 512;
  const H = 756;
  const { canvas, ctx } = canvas2d(W, H);
  const rail = Math.round(H * 0.6);
  const base = ctx.createLinearGradient(0, 0, 0, rail);
  base.addColorStop(0, "#4a0e12");
  base.addColorStop(1, "#5c1519");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, rail);
  // Rayures fines, puis le damas en quinconce.
  for (let x = 0; x < W; x += 32) {
    ctx.fillStyle = "rgba(0,0,0,0.1)";
    ctx.fillRect(x, 0, 2, rail);
  }
  for (let row = 0, y = 70; y < rail + 60; row++, y += 110) {
    for (let x = row % 2 === 0 ? 64 : 0; x <= W; x += 128) {
      damask(ctx, x, y, 30, "rgba(140,60,34,0.4)", "rgba(190,120,60,0.35)");
    }
  }
  // Voile de fumee et de nicotine vers le plafond.
  const smoke = ctx.createLinearGradient(0, 0, 0, rail * 0.5);
  smoke.addColorStop(0, "rgba(20,8,4,0.45)");
  smoke.addColorStop(1, "rgba(20,8,4,0)");
  ctx.fillStyle = smoke;
  ctx.fillRect(0, 0, W, rail * 0.5);
  // Trace plus claire d'un tableau decroche.
  if (Math.random() < 0.5) {
    const tw = 90 + Math.random() * 80;
    const tx = Math.random() * (W - tw);
    ctx.fillStyle = "rgba(160,70,60,0.16)";
    ctx.fillRect(tx, 150 + Math.random() * 120, tw, tw * 0.75);
  }
  for (let i = 0; i < 2; i++) {
    waterStain(ctx, Math.random() * W, Math.random() * rail * 0.8, 30 + Math.random() * 60, "rgba(30,10,4,0.16)", "rgba(20,6,2,0.2)");
  }
  // Lambris de noyer, par panneaux de 128 px (quatre par mur, raccordes).
  ctx.fillStyle = "#3a1c10";
  ctx.fillRect(0, rail, W, H - rail);
  for (let x = 0; x < W; x += 128) {
    const g = ctx.createLinearGradient(x, 0, x + 128, 0);
    g.addColorStop(0, "#43210f");
    g.addColorStop(0.5, "#4f2814");
    g.addColorStop(1, "#40200e");
    ctx.fillStyle = g;
    ctx.fillRect(x + 14, rail + 34, 100, H - rail - 84);
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 14, rail + 34, 100, H - rail - 84);
    ctx.strokeStyle = "rgba(230,170,110,0.18)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 17, rail + 37, 94, H - rail - 90);
  }
  // Fil du bois.
  ctx.strokeStyle = "rgba(20,8,2,0.25)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * W;
    ctx.beginPath();
    ctx.moveTo(x, rail + 10);
    ctx.bezierCurveTo(x + 4, rail + 80, x - 4, H - 120, x + 2, H - 40);
    ctx.stroke();
  }
  // Cimaise moulee.
  ctx.fillStyle = "#2a1208";
  ctx.fillRect(0, rail - 6, W, 22);
  ctx.fillStyle = "rgba(240,190,130,0.28)";
  ctx.fillRect(0, rail - 6, W, 3);
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(0, rail + 14, W, 4);
  // Plinthe.
  ctx.fillStyle = "#1e0d06";
  ctx.fillRect(0, H - 30, W, 30);
  ctx.fillStyle = "rgba(240,190,130,0.16)";
  ctx.fillRect(0, H - 30, W, 2);
  grain(ctx, W, H, 18);
  return finish(canvas);
}

/** Moquette d'hotel rouge : losanges dores et fleurons, usee en longues bandes, avec ses taches. */
export function makeHotelCarpet(): THREE.CanvasTexture {
  const S = 512;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#651016";
  ctx.fillRect(0, 0, S, S);
  // Treillis de losanges (periode 64 : il se raccorde tout seul).
  ctx.strokeStyle = "rgba(196,128,52,0.55)";
  ctx.lineWidth = 3;
  for (let i = -S; i <= S * 2; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + S, S);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i + S, 0);
    ctx.lineTo(i, S);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(20,4,6,0.45)";
  ctx.lineWidth = 1;
  for (let i = -S; i <= S * 2; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i + 4, 0);
    ctx.lineTo(i + 4 + S, S);
    ctx.stroke();
  }
  // Fleurons au centre de chaque losange.
  const fleuron = (x: number, y: number) => {
    ctx.fillStyle = "rgba(214,150,64,0.7)";
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 6, 3, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#2a0608";
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  };
  for (let a = 0; a <= S; a += 64) {
    for (let b = 0; b <= S; b += 64) {
      fleuron(a + 32, b);
      fleuron(a, b + 32);
    }
  }
  // Usure : des bandes plus claires la ou tout le monde marche.
  for (let i = 0; i < 3; i++) {
    const y = Math.random() * S;
    const g = ctx.createLinearGradient(0, y - 50, 0, y + 50);
    g.addColorStop(0, "rgba(170,90,70,0)");
    g.addColorStop(0.5, "rgba(170,90,70,0.12)");
    g.addColorStop(1, "rgba(170,90,70,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 50, S, 100);
  }
  // Taches sombres, qu'on prefere ne pas identifier.
  for (let i = 0; i < 3; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = 20 + Math.random() * 40;
    wrapped(S, x, y, 60, (px, py) => {
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, "rgba(28,4,4,0.45)");
      g.addColorStop(0.7, "rgba(28,4,4,0.25)");
      g.addColorStop(1, "rgba(28,4,4,0)");
      ctx.fillStyle = g;
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
    });
  }
  grain(ctx, S, S, 30);
  return finish(canvas);
}

/** Plafond de platre creme a caissons, fissure et tache d'eau. */
export function makeHotelCeiling(): THREE.CanvasTexture {
  const S = 512;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#b8a888";
  ctx.fillRect(0, 0, S, S);
  for (const p of [0, 256]) {
    ctx.fillStyle = "rgba(60,45,25,0.35)";
    ctx.fillRect(p, 0, 8, S);
    ctx.fillRect(0, p, S, 8);
    ctx.fillStyle = "rgba(255,245,215,0.3)";
    ctx.fillRect(p + 8, 0, 2, S);
    ctx.fillRect(0, p + 8, S, 2);
  }
  for (let i = 0; i < 2; i++) {
    waterStain(ctx, Math.random() * S, Math.random() * S, 30 + Math.random() * 60, "rgba(110,80,40,0.16)", "rgba(80,55,25,0.2)");
  }
  ctx.strokeStyle = "rgba(50,38,24,0.5)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    let x = Math.random() * S;
    let y = Math.random() * S;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 10; k++) {
      x += (Math.random() - 0.5) * 36;
      y += (Math.random() - 0.5) * 36;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  grain(ctx, S, S, 14);
  return finish(canvas);
}

/**
 * Porte de chambre en bois sombre : quatre panneaux moulures, judas, poignee
 * et plaque de proprete en laiton. La plaque du numero est posee par le decor
 * (a 1,70 m). `sign` : l'affichette « NE PAS DERANGER » pend a la poignee.
 */
export function makeHotelRoomDoor(sign: boolean): THREE.CanvasTexture {
  const W = 256;
  const H = 512;
  const { canvas, ctx } = canvas2d(W, H);
  ctx.fillStyle = "#1c0c06";
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, "#40200f");
  g.addColorStop(0.5, "#4d2813");
  g.addColorStop(1, "#3c1d0d");
  ctx.fillStyle = g;
  ctx.fillRect(12, 12, W - 24, H - 12);
  ctx.strokeStyle = "rgba(10,4,0,0.3)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    const x = 14 + Math.random() * (W - 28);
    ctx.beginPath();
    ctx.moveTo(x, 12);
    ctx.bezierCurveTo(x + 3, 150, x - 3, 350, x + 1, H);
    ctx.stroke();
  }
  // Panneaux moulures.
  for (const [px, py, pw, ph] of [
    [34, 44, 80, 170],
    [142, 44, 80, 170],
    [34, 250, 80, 200],
    [142, 250, 80, 200],
  ]) {
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 3;
    ctx.strokeRect(px, py, pw, ph);
    ctx.strokeStyle = "rgba(230,160,100,0.2)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px + 5, py + 5, pw - 10, ph - 10);
  }
  // Judas.
  ctx.fillStyle = "#b8914a";
  ctx.beginPath();
  ctx.arc(W / 2, 150, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#050302";
  ctx.beginPath();
  ctx.arc(W / 2, 150, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // Poignee, rosace et serrure.
  ctx.fillStyle = "#c9a052";
  ctx.beginPath();
  ctx.arc(210, 272, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(186, 268, 28, 8);
  ctx.fillStyle = "#2a1a08";
  ctx.fillRect(207, 292, 6, 12);
  // Plaque de proprete, rayee par les valises.
  ctx.fillStyle = "#a88440";
  ctx.fillRect(12, H - 40, W - 24, 34);
  ctx.strokeStyle = "rgba(60,40,10,0.5)";
  for (let i = 0; i < 14; i++) {
    const x = 16 + Math.random() * (W - 40);
    ctx.beginPath();
    ctx.moveTo(x, H - 36 + Math.random() * 10);
    ctx.lineTo(x + 10 + Math.random() * 30, H - 30 + Math.random() * 20);
    ctx.stroke();
  }
  if (sign) {
    // Affichette qui pend a la poignee.
    ctx.save();
    ctx.translate(200, 280);
    ctx.rotate(0.06);
    ctx.fillStyle = "#e9dcc0";
    ctx.fillRect(-22, 0, 44, 110);
    ctx.strokeStyle = "#7a1c1c";
    ctx.lineWidth = 3;
    ctx.strokeRect(-19, 3, 38, 104);
    ctx.fillStyle = "#7a1c1c";
    ctx.font = "bold 10px serif";
    ctx.textAlign = "center";
    ctx.fillText("NE PAS", 0, 44);
    ctx.fillText("DÉRANGER", 0, 58);
    ctx.fillStyle = "#1c0c06";
    ctx.beginPath();
    ctx.arc(0, 12, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  grain(ctx, W, H, 16);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Parquet de la salle de bal : lames de chene en quinconce, cire usee, rayures de talons. */
export function makeParquet(): THREE.CanvasTexture {
  const S = 512;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#2c1606";
  ctx.fillRect(0, 0, S, S);
  const lane = 42.67;
  for (let r = 0; r < 12; r++) {
    const y = r * lane;
    let x = -Math.random() * 200;
    while (x < S) {
      const len = [128, 192, 256][Math.floor(Math.random() * 3)];
      const shade = Math.random() * 26;
      const plank = (px: number) => {
        ctx.fillStyle = `rgb(${128 + shade},${78 + shade * 0.7},${38 + shade * 0.4})`;
        ctx.fillRect(px + 1, y + 1, len - 2, lane - 2);
        ctx.strokeStyle = "rgba(60,30,8,0.3)";
        ctx.lineWidth = 1;
        for (let k = 0; k < 4; k++) {
          const gy = y + 5 + Math.random() * (lane - 10);
          ctx.beginPath();
          ctx.moveTo(px + 2, gy);
          ctx.bezierCurveTo(px + len * 0.3, gy + 3, px + len * 0.6, gy - 3, px + len - 2, gy + 1);
          ctx.stroke();
        }
      };
      plank(x);
      if (x + len > S) plank(x - S);
      if (x < 0) plank(x + S);
      x += len;
    }
  }
  // Cire usee au centre, lustre sur les bords.
  const g = ctx.createRadialGradient(S / 2, S / 2, 40, S / 2, S / 2, S * 0.7);
  g.addColorStop(0, "rgba(255,220,160,0.1)");
  g.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = "rgba(20,10,4,0.4)";
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 10);
    ctx.stroke();
  }
  grain(ctx, S, S, 16);
  return finish(canvas);
}

/** Marbre creme veine de gris, pour les colonnes. */
export function makeMarble(): THREE.CanvasTexture {
  const W = 256;
  const H = 512;
  const { canvas, ctx } = canvas2d(W, H);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#e6dfcf");
  g.addColorStop(1, "#d6cdb8");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 10; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 40 + Math.random() * 90;
    const b = ctx.createRadialGradient(x, y, 0, x, y, r);
    b.addColorStop(0, "rgba(170,160,140,0.18)");
    b.addColorStop(1, "rgba(170,160,140,0)");
    ctx.fillStyle = b;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let v = 0; v < 7; v++) {
    let x = Math.random() * W;
    let y = 0;
    ctx.strokeStyle = `rgba(80,78,84,${0.2 + Math.random() * 0.3})`;
    ctx.lineWidth = 0.6 + Math.random() * 1.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    while (y < H) {
      x += (Math.random() - 0.45) * 26;
      y += 10 + Math.random() * 26;
      ctx.lineTo(((x % W) + W) % W, y);
    }
    ctx.stroke();
  }
  // Salissure au pied, la ou frottent les chaussures.
  const dirt = ctx.createLinearGradient(0, H * 0.85, 0, H);
  dirt.addColorStop(0, "rgba(60,50,35,0)");
  dirt.addColorStop(1, "rgba(60,50,35,0.3)");
  ctx.fillStyle = dirt;
  ctx.fillRect(0, H * 0.85, W, H * 0.15);
  grain(ctx, W, H, 8);
  return finish(canvas);
}

// ---------------------------------------------------------------------------
// Niveau 6 — Lumieres eteintes
// ---------------------------------------------------------------------------

/** Beton noir : coffrage, coulures humides, griffures, traits comptes a la craie. Presque rien sans lampe. */
export function makeBlackConcreteWall(): THREE.CanvasTexture {
  const W = 512;
  const H = 692;
  const { canvas, ctx } = canvas2d(W, H);
  ctx.fillStyle = "#2a2a2d";
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 16; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 50 + Math.random() * 140;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, Math.random() < 0.5 ? "rgba(70,70,75,0.22)" : "rgba(8,8,10,0.3)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 2;
  for (let y = 173; y < H; y += 173) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // Coulures humides : un filet sombre, un filet clair qui brille sous la lampe.
  for (let i = 0; i < 12; i++) {
    const x = Math.random() * W;
    const len = 120 + Math.random() * 420;
    const g = ctx.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, "rgba(5,5,6,0.5)");
    g.addColorStop(1, "rgba(5,5,6,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 3 + Math.random() * 7, len);
    ctx.fillStyle = "rgba(150,160,170,0.12)";
    ctx.fillRect(x - 1, 0, 1, len * 0.7);
  }
  // Griffures, par quatre, a hauteur de chien.
  ctx.strokeStyle = "rgba(150,150,155,0.45)";
  ctx.lineCap = "round";
  for (let set = 0; set < 2; set++) {
    if (Math.random() < 0.4) continue;
    const x0 = Math.random() * (W - 80);
    const y0 = H * (0.55 + Math.random() * 0.2);
    for (let k = 0; k < 4; k++) {
      ctx.lineWidth = 1.5 + Math.random() * 1.5;
      ctx.beginPath();
      ctx.moveTo(x0 + k * 11, y0);
      ctx.quadraticCurveTo(x0 + k * 11 + 12, y0 + 50, x0 + k * 12 + 6, y0 + 100 + Math.random() * 30);
      ctx.stroke();
    }
  }
  // Quelqu'un a compte les jours, a la craie.
  if (Math.random() < 0.45) {
    const tx = 40 + Math.random() * (W - 200);
    const ty = 200 + Math.random() * 200;
    ctx.strokeStyle = "rgba(210,210,200,0.5)";
    ctx.lineWidth = 3;
    for (let n = 0; n < 3 + Math.floor(Math.random() * 3); n++) {
      const gx = tx + n * 34;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(gx + k * 6, ty);
        ctx.lineTo(gx + k * 6 + 1, ty + 36);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(gx - 4, ty + 30);
      ctx.lineTo(gx + 24, ty + 6);
      ctx.stroke();
    }
  }
  const damp = ctx.createLinearGradient(0, H - 110, 0, H);
  damp.addColorStop(0, "rgba(4,4,5,0)");
  damp.addColorStop(1, "rgba(4,4,5,0.6)");
  ctx.fillStyle = damp;
  ctx.fillRect(0, H - 110, W, 110);
  grain(ctx, W, H, 30);
  return finish(canvas);
}

/** Sol de beton sombre et mouille : les flaques brillent sous la lampe. */
export function makeBlackFloor(): THREE.CanvasTexture {
  const S = 512;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#222225";
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 18; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = 30 + Math.random() * 90;
    const tone = Math.random() < 0.5 ? "rgba(60,60,66,0.2)" : "rgba(6,6,8,0.3)";
    wrapped(S, x, y, 120, (px, py) => {
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, tone);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
    });
  }
  for (let i = 0; i < 3; i++) {
    const x = 60 + Math.random() * (S - 120);
    const y = 60 + Math.random() * (S - 120);
    const rx = 25 + Math.random() * 45;
    ctx.fillStyle = "rgba(6,7,9,0.5)";
    ctx.beginPath();
    ctx.ellipse(x, y, rx, rx * (0.4 + Math.random() * 0.4), Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(160,170,185,0.2)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, 254, S, 3);
  ctx.fillRect(254, 0, 3, S);
  grain(ctx, S, S, 30);
  return finish(canvas);
}

// ---------------------------------------------------------------------------
// Niveau Fun — La Fete
// ---------------------------------------------------------------------------

const PARTY_COLORS = ["#ff5fa2", "#5fd4ff", "#ffb02e", "#8cd65f", "#c58cff"];

/** Papier peint de fete : pois de toutes les couleurs, frise, soubassement a rayures bonbon. Un sourire au crayon, parfois. */
export function makePartyWallpaper(): THREE.CanvasTexture {
  const W = 512;
  const H = 745;
  const { canvas, ctx } = canvas2d(W, H);
  const low = Math.round(H * 0.72);
  const g = ctx.createLinearGradient(0, 0, 0, low);
  g.addColorStop(0, "#fff0a6");
  g.addColorStop(1, "#ffe98a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, low);
  // Pois en quinconce, periode 64 : ils se raccordent d'un mur a l'autre.
  for (let row = 0, y = 120; y < low - 10; row++, y += 48) {
    for (let x = row % 2 === 0 ? 32 : 0; x <= W; x += 64) {
      ctx.fillStyle = PARTY_COLORS[(row * 3 + Math.round(x / 64)) % PARTY_COLORS.length];
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // Frise.
  ctx.fillStyle = "#ff7ab8";
  ctx.fillRect(0, 40, W, 50);
  ctx.fillStyle = "#fff6fb";
  ctx.fillRect(0, 44, W, 3);
  ctx.fillRect(0, 83, W, 3);
  ctx.font = "bold 26px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("JOYEUX ANNIVERSAIRE !", W / 2, 66);
  ctx.textBaseline = "alphabetic";
  // Soubassement a rayures bonbon, puis plinthe.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, low, W, H - low);
  ctx.clip();
  ctx.fillStyle = "#fff4fa";
  ctx.fillRect(0, low, W, H - low);
  ctx.fillStyle = "#ff9ccb";
  for (let x = -H; x < W + H; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, low);
    ctx.lineTo(x + 16, low);
    ctx.lineTo(x + 16 + (H - low), H);
    ctx.lineTo(x + (H - low), H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = "#c2407e";
  ctx.fillRect(0, low - 4, W, 8);
  ctx.fillStyle = "#6a1c48";
  ctx.fillRect(0, H - 26, W, 26);
  // Salissures : de la sueur de mains, une trainee de gateau, des taches.
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = "rgba(90,50,30,0.16)";
    ctx.beginPath();
    ctx.ellipse(Math.random() * W, low - 40 - Math.random() * 200, 14, 20, Math.random(), 0, Math.PI * 2);
    ctx.fill();
  }
  waterStain(ctx, Math.random() * W, 140 + Math.random() * 200, 30 + Math.random() * 50, "rgba(120,90,20,0.1)", "rgba(100,70,10,0.14)");
  if (Math.random() < 0.5) {
    // Un sourire dessine au crayon gras, a hauteur d'enfant.
    const sx = 60 + Math.random() * (W - 120);
    const sy = low - 70 - Math.random() * 90;
    ctx.strokeStyle = "rgba(30,20,30,0.7)";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(sx, sy, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sx, sy + 2, 20, 0.2, Math.PI - 0.2);
    ctx.stroke();
    ctx.fillStyle = "rgba(30,20,30,0.75)";
    ctx.fillRect(sx - 13, sy - 14, 6, 10);
    ctx.fillRect(sx + 7, sy - 14, 6, 10);
  }
  grain(ctx, W, H, 12);
  return finish(canvas);
}

/** Moquette criarde de salle des fetes : confettis et zigzags fluo sur fond violet nuit, taches de soda. */
export function makePartyCarpet(): THREE.CanvasTexture {
  const S = 512;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#28123e";
  ctx.fillRect(0, 0, S, S);
  const neon = ["#ff4fa0", "#3fe0ff", "#ffe44a", "#7dff6a", "#b886ff"];
  for (let i = 0; i < 150; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const c = neon[i % neon.length];
    const kind = i % 4;
    const a = Math.random() * Math.PI * 2;
    wrapped(S, x, y, 30, (px, py) => {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a);
      ctx.fillStyle = c;
      ctx.strokeStyle = c;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 3;
      if (kind === 0) {
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(8, 6);
        ctx.lineTo(-8, 6);
        ctx.closePath();
        ctx.fill();
      } else if (kind === 1) {
        ctx.beginPath();
        ctx.moveTo(-14, 0);
        for (let k = 0; k < 4; k++) ctx.lineTo(-10 + k * 8, k % 2 === 0 ? -6 : 6);
        ctx.stroke();
      } else if (kind === 2) {
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillRect(-7, -2, 14, 4);
      }
      ctx.restore();
    });
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 4; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = 20 + Math.random() * 35;
    wrapped(S, x, y, 60, (px, py) => {
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, "rgba(10,4,14,0.45)");
      g.addColorStop(1, "rgba(10,4,14,0)");
      ctx.fillStyle = g;
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
    });
  }
  grain(ctx, S, S, 24);
  return finish(canvas);
}

/** Plafond de salle des fetes : dalles pastel, bouts de serpentin encore colles. */
export function makePartyCeiling(): THREE.CanvasTexture {
  const t = makeCeilingTiles("#e9d2e4", 1);
  const canvas = t.image as HTMLCanvasElement;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.lineWidth = 4;
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = PARTY_COLORS[i % PARTY_COLORS.length];
      ctx.globalAlpha = 0.7;
      let x = Math.random() * 512;
      let y = Math.random() * 512;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 8; k++) {
        x += 14 + Math.random() * 10;
        y += Math.sin(k * 1.4) * 12;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    t.needsUpdate = true;
  }
  return t;
}

/** Damier : `tiles` carreaux par cote, joints fins, reflet sur chaque carreau. */
export function makeCheckerFloor(a = "#f4f4f4", b = "#1b1b1f", tiles = 2): THREE.CanvasTexture {
  const S = 256;
  const { canvas, ctx } = canvas2d(S, S);
  const t = S / tiles;
  for (let y = 0; y < tiles; y++) {
    for (let x = 0; x < tiles; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? a : b;
      ctx.fillRect(x * t, y * t, t, t);
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      ctx.fillRect(x * t + 6, y * t + 6, t - 12, 4);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(x * t + 6, y * t + t - 10, t - 12, 4);
    }
  }
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 3;
  for (let p = 0; p <= S; p += t) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, S);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(S, p);
    ctx.stroke();
  }
  grain(ctx, S, S, 10);
  return finish(canvas);
}

// ---------------------------------------------------------------------------
// Objets des salles marquantes (caisses, salle de reunion, reception)
// ---------------------------------------------------------------------------

/** Caisse en bois d'entrepot : planches clouees, cadre, croisillon et pochoir de zone. */
export function makeWoodCrate(): THREE.CanvasTexture {
  const S = 256;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#3e2a14";
  ctx.fillRect(0, 0, S, S);
  // Planches horizontales, chacune de sa teinte, avec le fil du bois.
  for (let y = 0; y < S; y += 32) {
    const shade = Math.random() * 24 - 12;
    ctx.fillStyle = `rgb(${150 + shade},${112 + shade},${66 + shade * 0.6})`;
    ctx.fillRect(0, y + 1, S, 30);
    ctx.strokeStyle = "rgba(70,45,15,0.3)";
    ctx.lineWidth = 1;
    for (let k = 0; k < 3; k++) {
      const gy = y + 6 + Math.random() * 20;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(80, gy + 3, 170, gy - 3, S, gy + 1);
      ctx.stroke();
    }
  }
  // Pochoir sous le croisillon : zone et fleches.
  ctx.fillStyle = "rgba(24,16,6,0.55)";
  ctx.font = "bold 30px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("B-3", 86, 78);
  ctx.font = "bold 22px monospace";
  ctx.fillText("↑ ↑", 170, 186);
  // Cadre et croisillon, plus sombres.
  ctx.fillStyle = "#6b4b25";
  ctx.fillRect(0, 0, S, 24);
  ctx.fillRect(0, S - 24, S, 24);
  ctx.fillRect(0, 0, 24, S);
  ctx.fillRect(S - 24, 0, 24, S);
  ctx.save();
  ctx.beginPath();
  ctx.rect(24, 24, S - 48, S - 48);
  ctx.clip();
  ctx.translate(S / 2, S / 2);
  ctx.rotate(-Math.PI / 4);
  ctx.fillRect(-S * 0.75, -13, S * 1.5, 26);
  ctx.restore();
  ctx.strokeStyle = "rgba(20,12,4,0.6)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, S - 2, S - 2);
  ctx.strokeRect(24, 24, S - 48, S - 48);
  // Clous.
  ctx.fillStyle = "#1c1814";
  for (const p of [12, S - 12]) {
    for (const r of [12, S / 2, S - 12]) {
      ctx.fillRect(p - 2, r - 2, 4, 4);
      ctx.fillRect(r - 2, p - 2, 4, 4);
    }
  }
  grain(ctx, S, S, 22);
  return finish(canvas);
}

/**
 * Tableau blanc de salle de reunion : cadre alu, courbe qui plonge, une
 * liste au feutre et un mot entoure. Des traces mal effacees en dessous.
 */
export function makeWhiteboard(): THREE.CanvasTexture {
  const W = 512;
  const H = 320;
  const { canvas, ctx } = canvas2d(W, H);
  ctx.fillStyle = "#eef0eb";
  ctx.fillRect(0, 0, W, H);
  // Fantomes d'anciennes reunions.
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = "rgba(90,100,120,0.07)";
    ctx.beginPath();
    ctx.ellipse(40 + Math.random() * (W - 80), 40 + Math.random() * (H - 80), 40 + Math.random() * 60, 8 + Math.random() * 14, (Math.random() - 0.5) * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#1f3f9a";
  ctx.font = "bold 30px sans-serif";
  ctx.fillText("OBJECTIFS", 34, 58);
  ctx.fillStyle = "#23262b";
  ctx.font = "21px sans-serif";
  ["• trouver la sortie", "• rester calme", "• ne pas se retourner"].forEach((line, i) => ctx.fillText(line, 38, 104 + i * 34));
  // Le graphique : des barres qui baissent, une fleche rouge qui plonge.
  const ox = 300;
  const oy = 230;
  ctx.strokeStyle = "#23262b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ox, 60);
  ctx.lineTo(ox, oy);
  ctx.lineTo(ox + 180, oy);
  ctx.stroke();
  ctx.fillStyle = "rgba(31,63,154,0.75)";
  [120, 96, 70, 40, 14].forEach((h, i) => ctx.fillRect(ox + 14 + i * 32, oy - h, 20, h));
  ctx.strokeStyle = "#b3241c";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(ox + 20, 92);
  ctx.lineTo(ox + 90, 128);
  ctx.lineTo(ox + 118, 116);
  ctx.lineTo(ox + 168, 200);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ox + 152, 196);
  ctx.lineTo(ox + 170, 204);
  ctx.lineTo(ox + 172, 184);
  ctx.stroke();
  // Un mot entoure, en bas.
  ctx.fillStyle = "#b3241c";
  ctx.font = "bold 24px sans-serif";
  ctx.fillText("SORTIE ?", 60, 270);
  ctx.beginPath();
  ctx.ellipse(116, 262, 78, 24, -0.05, 0, Math.PI * 2);
  ctx.stroke();
  // Un coup d'eponge qui a emporte la moitie d'une ligne.
  ctx.fillStyle = "rgba(238,240,235,0.8)";
  ctx.fillRect(150, 150, 90, 22);
  // Cadre en aluminium.
  ctx.strokeStyle = "#a6abb0";
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, W - 14, H - 14);
  ctx.strokeStyle = "rgba(40,44,48,0.5)";
  ctx.lineWidth = 2;
  ctx.strokeRect(14, 14, W - 28, H - 28);
  grain(ctx, W, H, 6);
  return finish(canvas);
}

/** Facade de comptoir de reception : panneau de noyer, filets de laiton, plinthe noire. Se repete le long du comptoir. */
export function makeReceptionPanel(): THREE.CanvasTexture {
  const W = 256;
  const H = 200;
  const { canvas, ctx } = canvas2d(W, H);
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, "#3a1c0d");
  g.addColorStop(0.5, "#4a2612");
  g.addColorStop(1, "#381a0c");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(15,6,2,0.3)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * W;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + 4, H * 0.3, x - 4, H * 0.7, x + 1, H);
    ctx.stroke();
  }
  // Panneau moulure, centre dans la largeur : il se raccorde a son voisin.
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(22, 30, W - 44, H - 72);
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 3;
  ctx.strokeRect(22, 30, W - 44, H - 72);
  ctx.strokeStyle = "rgba(230,160,100,0.2)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(28, 36, W - 56, H - 84);
  // Filets de laiton en haut et au-dessus de la plinthe.
  ctx.fillStyle = "#c9a052";
  ctx.fillRect(0, 8, W, 5);
  ctx.fillRect(0, H - 34, W, 4);
  ctx.fillStyle = "rgba(255,230,160,0.35)";
  ctx.fillRect(0, 8, W, 1);
  // Plinthe noire, rayee par les valises.
  ctx.fillStyle = "#140a05";
  ctx.fillRect(0, H - 30, W, 30);
  ctx.strokeStyle = "rgba(120,90,50,0.3)";
  for (let i = 0; i < 8; i++) {
    const x = Math.random() * W;
    ctx.beginPath();
    ctx.moveTo(x, H - 26 + Math.random() * 8);
    ctx.lineTo(x + 12 + Math.random() * 24, H - 18 + Math.random() * 12);
    ctx.stroke();
  }
  grain(ctx, W, H, 14);
  return finish(canvas);
}
