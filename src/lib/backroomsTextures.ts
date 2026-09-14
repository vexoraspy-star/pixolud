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
export function makeLightPanel(warm = "#fffbe6"): THREE.CanvasTexture {
  const { canvas, ctx } = canvas2d(256, 128);
  ctx.fillStyle = "#8b8778";
  ctx.fillRect(0, 0, 256, 128);
  const g = ctx.createRadialGradient(128, 64, 10, 128, 64, 130);
  g.addColorStop(0, warm);
  g.addColorStop(1, "#e9e0bd");
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

export type DoorStyle = "service" | "monte-charge" | "trappe" | "sortie";

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
