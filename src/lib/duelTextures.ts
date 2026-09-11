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
