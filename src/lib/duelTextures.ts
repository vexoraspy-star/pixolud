import * as THREE from "three";

// Textures de l'arene du Duel, dessinees au canvas comme celles du Manoir.

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

/** Mur d'arene : panneaux metalliques rivetes, bande lumineuse en haut. */
export function makeArenaWallTexture(): THREE.CanvasTexture {
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
export function makeArenaFloorTexture(width: number, height: number): THREE.CanvasTexture {
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
export function makeArenaCeilingTexture(width: number, height: number): THREE.CanvasTexture {
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
