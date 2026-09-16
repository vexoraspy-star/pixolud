import * as THREE from "three";
import type { DuelTheme } from "./duel";

// Textures de l'arene du Duel, dessinees au canvas comme celles du Manoir.
//
// Chaque carte a son habillage complet — metal bleute pour l'Arene, bardage et
// beton pour l'Entrepot, roche pour le Gouffre, gres et sable pour Poussiere.
// Changer de carte doit changer de PAYSAGE, pas seulement de plan.

function canvas2d(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext("2d")! };
}

function finish(canvas: HTMLCanvasElement, rx = 1, ry = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Mur : l'habillage depend entierement de la carte. */
export function makeArenaWallTexture(theme: DuelTheme = "arene"): THREE.CanvasTexture {
  if (theme === "entrepot") return makeWarehouseWall();
  if (theme === "gouffre") return makeRockWall();
  if (theme === "poussiere") return makeSandstoneWall();
  const { canvas, ctx } = canvas2d(256, 256);
  ctx.fillStyle = "#2b3138";
  ctx.fillRect(0, 0, 256, 256);

  // panneaux
  for (let py = 0; py < 4; py++) {
    for (let px = 0; px < 2; px++) {
      const shade = 46 + Math.floor(Math.random() * 16);
      ctx.fillStyle = `rgb(${shade},${shade + 6},${shade + 12})`;
      ctx.fillRect(px * 128 + 4, py * 64 + 4, 120, 56);
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 3;
      ctx.strokeRect(px * 128 + 4, py * 64 + 4, 120, 56);
    }
  }
  // rivets
  ctx.fillStyle = "#767f89";
  for (let py = 0; py < 4; py++) {
    for (let px = 0; px < 2; px++) {
      for (const [ox, oy] of [
        [14, 14],
        [114, 14],
        [14, 50],
        [114, 50],
      ]) {
        ctx.beginPath();
        ctx.arc(px * 128 + ox, py * 64 + oy, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // rayures d'usure
  ctx.strokeStyle = "rgba(0,0,0,0.22)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 30; i++) {
    const y = Math.random() * 256;
    ctx.beginPath();
    ctx.moveTo(Math.random() * 256, y);
    ctx.lineTo(Math.random() * 256, y + Math.random() * 10 - 5);
    ctx.stroke();
  }
  // bande lumineuse cyan en haut du mur
  ctx.fillStyle = "#1d2a33";
  ctx.fillRect(0, 0, 256, 12);
  ctx.fillStyle = "#4fd8ff";
  ctx.fillRect(0, 3, 256, 5);
  ctx.fillStyle = "rgba(79,216,255,0.3)";
  ctx.fillRect(0, 8, 256, 7);
  return finish(canvas);
}

/** Sol : dalles de beton avec joints et marquages. */
export function makeArenaFloorTexture(width: number, height: number, theme: DuelTheme = "arene"): THREE.CanvasTexture {
  if (theme === "entrepot") return makeWarehouseFloor(width, height);
  if (theme === "gouffre") return makeRockFloor(width, height);
  if (theme === "poussiere") return makeSandFloor(width, height);
  const { canvas, ctx } = canvas2d(128, 128);
  ctx.fillStyle = "#23262b";
  ctx.fillRect(0, 0, 128, 128);
  const shade = 38 + Math.floor(Math.random() * 8);
  ctx.fillStyle = `rgb(${shade},${shade + 2},${shade + 5})`;
  ctx.fillRect(2, 2, 124, 124);
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, 124, 124);
  // moucheture de beton
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(${Math.random() > 0.5 ? "255,255,255" : "0,0,0"},${Math.random() * 0.06})`;
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  return finish(canvas, width, height);
}

/** Plafond : structure sombre avec neons. */
export function makeArenaCeilingTexture(width: number, height: number, theme: DuelTheme = "arene"): THREE.CanvasTexture {
  if (theme === "entrepot") return makeWarehouseCeiling(width, height);
  if (theme === "gouffre") return makeRockCeiling(width, height);
  if (theme === "poussiere") return makeSkyCeiling(width, height);
  const { canvas, ctx } = canvas2d(128, 128);
  ctx.fillStyle = "#15181c";
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = "#1d2127";
  ctx.fillRect(0, 20, 128, 16);
  ctx.fillRect(0, 92, 128, 16);
  ctx.fillStyle = "#8fe8ff";
  ctx.fillRect(24, 56, 80, 6);
  ctx.fillStyle = "rgba(143,232,255,0.22)";
  ctx.fillRect(16, 50, 96, 18);
  return finish(canvas, width / 2, height / 2);
}

// ---------------------------------------------------------------------------
// Armes tenues en main
// ---------------------------------------------------------------------------
// Les modeles etaient des boites de couleur unie : a 60 cm de l'oeil, ca se
// voyait. Quatre petites textures suffisent a donner de la matiere — acier
// usine, polymere grene, noyer verni et tissu de gant.

/** Acier bronze : usinage fin en longueur, aretes usees, quelques eclats. */
export function makeGunMetalTexture(): THREE.CanvasTexture {
  const W = 128;
  const H = 128;
  const { canvas, ctx } = canvas2d(W, H);
  ctx.fillStyle = "#8f98a3";
  ctx.fillRect(0, 0, W, H);
  // Traces d'usinage.
  for (let y = 0; y < H; y += 2) {
    ctx.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.05})`;
    ctx.fillRect(0, y, W, 1);
    ctx.fillStyle = `rgba(20,24,30,${0.04 + Math.random() * 0.06})`;
    ctx.fillRect(0, y + 1, W, 1);
  }
  // Usure sur les aretes : des rayures claires, orientees.
  ctx.strokeStyle = "rgba(230,238,245,0.5)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const len = 4 + Math.random() * 22;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (Math.random() - 0.5) * 3);
    ctx.stroke();
  }
  // Eclats sombres.
  ctx.fillStyle = "rgba(24,28,34,0.55)";
  for (let i = 0; i < 40; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 3, 1 + Math.random() * 2);
  return finish(canvas);
}

/** Polymere mat, avec le grenage antiderapant des poignees modernes. */
export function makePolymerTexture(): THREE.CanvasTexture {
  const S = 128;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#9a9ea4";
  ctx.fillRect(0, 0, S, S);
  // Grenage : une trame de petits points en quinconce.
  for (let y = 0; y < S; y += 5) {
    for (let x = 0; x < S; x += 5) {
      const ox = (y / 5) % 2 === 0 ? 0 : 2.5;
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      ctx.fillRect(x + ox, y, 2, 2);
      ctx.fillStyle = "rgba(30,32,36,0.35)";
      ctx.fillRect(x + ox + 1, y + 2, 2, 1);
    }
  }
  ctx.fillStyle = "rgba(20,22,26,0.25)";
  for (let i = 0; i < 30; i++) ctx.fillRect(Math.random() * S, Math.random() * S, 3 + Math.random() * 10, 1);
  return finish(canvas);
}

/** Noyer verni : veines longues, plus sombres par endroits. */
export function makeGunWoodTexture(): THREE.CanvasTexture {
  const W = 128;
  const H = 128;
  const { canvas, ctx } = canvas2d(W, H);
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, "#8a5a33");
  base.addColorStop(0.5, "#75482a");
  base.addColorStop(1, "#8a5a33");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  ctx.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    const y0 = Math.random() * H;
    ctx.strokeStyle = `rgba(${40 + Math.random() * 30},${22 + Math.random() * 16},10,${0.2 + Math.random() * 0.35})`;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 8) {
      const y = y0 + Math.sin((x / W) * Math.PI * 2 + i) * 3 + Math.sin(x * 0.2 + i) * 1.2;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Reflet du vernis.
  const shine = ctx.createLinearGradient(0, 0, W, H);
  shine.addColorStop(0, "rgba(255,225,180,0.12)");
  shine.addColorStop(0.5, "rgba(255,225,180,0)");
  shine.addColorStop(1, "rgba(255,225,180,0.1)");
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, W, H);
  return finish(canvas);
}

/** Gant tactique : tissu tresse, coutures et renfort sur les articulations. */
export function makeGloveTexture(): THREE.CanvasTexture {
  const S = 128;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#9aa0a6";
  ctx.fillRect(0, 0, S, S);
  // Tresse du tissu.
  for (let y = 0; y < S; y += 4) {
    for (let x = 0; x < S; x += 4) {
      ctx.fillStyle = (x / 4 + y / 4) % 2 === 0 ? "rgba(255,255,255,0.16)" : "rgba(30,32,36,0.22)";
      ctx.fillRect(x, y, 4, 4);
    }
  }
  // Coutures.
  ctx.strokeStyle = "rgba(20,22,26,0.5)";
  ctx.setLineDash([3, 4]);
  ctx.lineWidth = 1.5;
  for (const y of [28, 64, 100]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(S, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  return finish(canvas);
}

/** Verre de lunette : reticule noir, teinte bleutee et reflet en croissant. */
export function makeScopeLensTexture(): THREE.CanvasTexture {
  const S = 128;
  const { canvas, ctx } = canvas2d(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S / 2);
  g.addColorStop(0, "#2d4a5c");
  g.addColorStop(0.7, "#16262f");
  g.addColorStop(1, "#070d11");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  // Reticule.
  ctx.strokeStyle = "rgba(8,10,12,0.9)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(S / 2, 8);
  ctx.lineTo(S / 2, S - 8);
  ctx.moveTo(8, S / 2);
  ctx.lineTo(S - 8, S / 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(8,10,12,0.9)";
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, 3, 0, Math.PI * 2);
  ctx.fill();
  // Reflet.
  ctx.strokeStyle = "rgba(180,230,255,0.35)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2 - 12, Math.PI * 0.85, Math.PI * 1.35);
  ctx.stroke();
  const t = finish(canvas);
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ---------------------------------------------------------------------------
// Habillages de carte
// ---------------------------------------------------------------------------

/** Entrepot : bardage metallique nervure, bande jaune et rouille en bas. */
function makeWarehouseWall(): THREE.CanvasTexture {
  const S = 256;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#5c6560";
  ctx.fillRect(0, 0, S, S);
  // Nervures verticales du bardage.
  for (let x = 0; x < S; x += 16) {
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fillRect(x, 0, 6, S);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(x + 10, 0, 4, S);
  }
  // Bande d'avertissement jaune a hauteur d'epaule.
  ctx.fillStyle = "#c9a227";
  ctx.fillRect(0, 96, S, 18);
  ctx.fillStyle = "#1b1a17";
  for (let x = -20; x < S + 20; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 96);
    ctx.lineTo(x + 11, 96);
    ctx.lineTo(x - 2, 114);
    ctx.lineTo(x - 13, 114);
    ctx.closePath();
    ctx.fill();
  }
  // Rouille et salissures en bas.
  const dirt = ctx.createLinearGradient(0, S * 0.7, 0, S);
  dirt.addColorStop(0, "rgba(60,40,24,0)");
  dirt.addColorStop(1, "rgba(60,40,24,0.55)");
  ctx.fillStyle = dirt;
  ctx.fillRect(0, S * 0.7, S, S * 0.3);
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = `rgba(${120 + Math.random() * 40},${60 + Math.random() * 20},30,${0.15 + Math.random() * 0.3})`;
    ctx.fillRect(Math.random() * S, 150 + Math.random() * 100, 3 + Math.random() * 12, 6 + Math.random() * 40);
  }
  return finish(canvas);
}

function makeWarehouseFloor(width: number, height: number): THREE.CanvasTexture {
  const S = 128;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#4a4d4c";
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = "#535654";
  ctx.fillRect(2, 2, S - 4, S - 4);
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, S - 4, S - 4);
  // Marquage d'allee peint au sol.
  ctx.fillStyle = "rgba(220,180,40,0.55)";
  ctx.fillRect(0, 58, S, 5);
  for (let i = 0; i < 200; i++) {
    ctx.fillStyle = `rgba(${Math.random() > 0.5 ? "255,255,255" : "0,0,0"},${Math.random() * 0.07})`;
    ctx.fillRect(Math.random() * S, Math.random() * S, 2, 2);
  }
  return finish(canvas, width, height);
}

function makeWarehouseCeiling(width: number, height: number): THREE.CanvasTexture {
  const S = 128;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#23262a";
  ctx.fillRect(0, 0, S, S);
  // Fermes metalliques.
  ctx.fillStyle = "#33383d";
  ctx.fillRect(0, 14, S, 10);
  ctx.fillRect(0, 104, S, 10);
  ctx.strokeStyle = "#2b2f34";
  ctx.lineWidth = 4;
  for (let x = 0; x < S; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 24);
    ctx.lineTo(x + 12, 104);
    ctx.stroke();
  }
  // Lanterneau : la lumiere du jour qui tombe.
  ctx.fillStyle = "#cfe6f2";
  ctx.fillRect(28, 52, 72, 22);
  ctx.fillStyle = "rgba(207,230,242,0.3)";
  ctx.fillRect(20, 46, 88, 34);
  return finish(canvas, width / 2, height / 2);
}

/** Gouffre : paroi rocheuse sombre, veines claires et fissures. */
function makeRockWall(): THREE.CanvasTexture {
  const S = 256;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#2f2b28";
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = 12 + Math.random() * 40;
    const v = 30 + Math.random() * 34;
    ctx.fillStyle = `rgba(${v + 12},${v + 6},${v},${0.5 + Math.random() * 0.4})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.5 + Math.random() * 0.6), Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // Fissures.
  ctx.strokeStyle = "rgba(10,8,7,0.75)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    let x = Math.random() * S;
    let y = Math.random() * S;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (Math.random() - 0.5) * 40;
      y += 10 + Math.random() * 24;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Veines de mineral clair.
  ctx.strokeStyle = "rgba(150,160,170,0.25)";
  ctx.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * S, Math.random() * S);
    ctx.lineTo(Math.random() * S, Math.random() * S);
    ctx.stroke();
  }
  return finish(canvas);
}

function makeRockFloor(width: number, height: number): THREE.CanvasTexture {
  const S = 128;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#26231f";
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 400; i++) {
    const v = 26 + Math.random() * 40;
    ctx.fillStyle = `rgba(${v + 8},${v + 4},${v},${0.35 + Math.random() * 0.5})`;
    const r = 1 + Math.random() * 4;
    ctx.beginPath();
    ctx.arc(Math.random() * S, Math.random() * S, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(canvas, width, height);
}

function makeRockCeiling(width: number, height: number): THREE.CanvasTexture {
  const S = 128;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#171412";
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 60; i++) {
    const v = 16 + Math.random() * 20;
    ctx.fillStyle = `rgba(${v + 6},${v + 3},${v},0.7)`;
    ctx.beginPath();
    ctx.ellipse(Math.random() * S, Math.random() * S, 8 + Math.random() * 26, 6 + Math.random() * 18, Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Quelques lampes de chantier accrochees a la voute.
  ctx.fillStyle = "#ffd9a0";
  ctx.fillRect(56, 58, 16, 8);
  ctx.fillStyle = "rgba(255,217,160,0.25)";
  ctx.fillRect(46, 50, 36, 24);
  return finish(canvas, width / 2, height / 2);
}

/** Poussiere : blocs de gres chauds, joints de mortier, sable au pied. */
function makeSandstoneWall(): THREE.CanvasTexture {
  const S = 256;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#8a6f47";
  ctx.fillRect(0, 0, S, S);
  const bh = 42;
  for (let row = 0, y = 0; y < S; row++, y += bh) {
    const off = row % 2 === 0 ? 0 : 42;
    for (let x = -off; x < S; x += 84) {
      const v = 176 + Math.random() * 34;
      ctx.fillStyle = `rgb(${v},${v - 32},${v - 78})`;
      ctx.fillRect(x + 4, y + 4, 76, bh - 8);
      ctx.fillStyle = "rgba(255,240,200,0.14)";
      ctx.fillRect(x + 4, y + 4, 76, 3);
      ctx.fillStyle = "rgba(60,40,20,0.2)";
      ctx.fillRect(x + 4, y + bh - 7, 76, 3);
      // Eclats et usure.
      if (Math.random() < 0.3) {
        ctx.fillStyle = "rgba(90,66,36,0.35)";
        ctx.fillRect(x + 10 + Math.random() * 50, y + 10, 8 + Math.random() * 18, 6 + Math.random() * 10);
      }
    }
  }
  // Voile de poussiere qui monte du sol.
  const dust = ctx.createLinearGradient(0, S * 0.72, 0, S);
  dust.addColorStop(0, "rgba(214,188,140,0)");
  dust.addColorStop(1, "rgba(214,188,140,0.5)");
  ctx.fillStyle = dust;
  ctx.fillRect(0, S * 0.72, S, S * 0.28);
  return finish(canvas);
}

function makeSandFloor(width: number, height: number): THREE.CanvasTexture {
  const S = 128;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#c0a271";
  ctx.fillRect(0, 0, S, S);
  // Grain de sable.
  for (let i = 0; i < 900; i++) {
    const v = Math.random();
    ctx.fillStyle = v > 0.5 ? "rgba(255,240,200,0.18)" : "rgba(110,84,48,0.18)";
    ctx.fillRect(Math.random() * S, Math.random() * S, 2, 2);
  }
  // Quelques pierres plates affleurantes.
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = `rgba(150,128,92,${0.25 + Math.random() * 0.25})`;
    ctx.beginPath();
    ctx.ellipse(Math.random() * S, Math.random() * S, 6 + Math.random() * 14, 5 + Math.random() * 10, Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(canvas, width, height);
}

/** Ciel de fin d'apres-midi : Poussiere se joue dehors. */
function makeSkyCeiling(width: number, height: number): THREE.CanvasTexture {
  const S = 128;
  const { canvas, ctx } = canvas2d(S, S);
  const g = ctx.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, "#eac98d");
  g.addColorStop(0.5, "#dcbf96");
  g.addColorStop(1, "#c9ab7e");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.1 + Math.random() * 0.14})`;
    ctx.beginPath();
    ctx.ellipse(Math.random() * S, Math.random() * S, 14 + Math.random() * 26, 6 + Math.random() * 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(canvas, Math.max(1, width / 6), Math.max(1, height / 6));
}

// ---------------------------------------------------------------------------
// Decor pose sur les cartes
// ---------------------------------------------------------------------------

/** Caisse en bois cerclee : le meuble universel des jeux de tir. */
export function makeCrateTexture(): THREE.CanvasTexture {
  const S = 128;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#9a6f3c";
  ctx.fillRect(0, 0, S, S);
  // Planches.
  for (let y = 0; y < S; y += 21) {
    const v = 140 + Math.random() * 40;
    ctx.fillStyle = `rgb(${v},${v - 40},${v - 86})`;
    ctx.fillRect(2, y + 2, S - 4, 17);
    ctx.fillStyle = "rgba(60,36,14,0.35)";
    ctx.fillRect(2, y + 18, S - 4, 3);
  }
  // Cadre et diagonale.
  ctx.strokeStyle = "rgba(70,44,18,0.85)";
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, S - 8, S - 8);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(8, 8);
  ctx.lineTo(S - 8, S - 8);
  ctx.stroke();
  // Vis metalliques aux coins.
  ctx.fillStyle = "#b9b2a2";
  for (const [x, y] of [[12, 12], [S - 12, 12], [12, S - 12], [S - 12, S - 12]]) {
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(canvas);
}

/** Bidon metallique : cerclages, rouille et un pictogramme inflammable. */
export function makeBarrelTexture(): THREE.CanvasTexture {
  const W = 128;
  const H = 96;
  const { canvas, ctx } = canvas2d(W, H);
  ctx.fillStyle = "#8d3a2c";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(0, 0, W, 8);
  for (const y of [24, 68]) {
    ctx.fillStyle = "#5e2a20";
    ctx.fillRect(0, y, W, 10);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(0, y, W, 3);
  }
  ctx.fillStyle = "#e8d7a8";
  ctx.beginPath();
  ctx.moveTo(64, 38);
  ctx.lineTo(76, 60);
  ctx.lineTo(52, 60);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#2a1a12";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("!", 64, 57);
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = `rgba(${60 + Math.random() * 40},${36 + Math.random() * 20},20,${0.2 + Math.random() * 0.4})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 3 + Math.random() * 10, 2 + Math.random() * 8);
  }
  return finish(canvas);
}

/** Sac de sable : toile rugueuse et coutures. */
export function makeSandbagTexture(): THREE.CanvasTexture {
  const S = 64;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#9c8f68";
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,245,210,0.12)" : "rgba(60,52,32,0.16)";
    ctx.fillRect(Math.random() * S, Math.random() * S, 2, 2);
  }
  ctx.strokeStyle = "rgba(60,52,32,0.5)";
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(4, S / 2);
  ctx.lineTo(S - 4, S / 2);
  ctx.stroke();
  ctx.setLineDash([]);
  return finish(canvas);
}

/** Lettre de site peinte au sol, facon « bombsite A ». */
export function makeSiteMarkTexture(label: string): THREE.CanvasTexture {
  const S = 256;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.clearRect(0, 0, S, S);
  ctx.strokeStyle = "rgba(220,60,40,0.75)";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, 96, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(220,60,40,0.8)";
  ctx.font = "bold 150px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, S / 2, S / 2 + 6);
  // Peinture ecaillee : on gratte quelques pixels.
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.fillRect(Math.random() * S, Math.random() * S, 2 + Math.random() * 6, 2 + Math.random() * 5);
  }
  ctx.globalCompositeOperation = "source-over";
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
