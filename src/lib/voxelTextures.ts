import * as THREE from "three";

// Atlas original dessine au canvas, sans image externe.
export const TILE_COLORS = ["#65a442", "#876044", "#876044", "#7d8386", "#92999b", "#decb8b", "#d0b77d", "#c6ad78", "#ba935b", "#725035", "#bf965d", "#42803d", "#b2e2e7", "#4c95c5", "#a95e48", "#525458", "#b69b86", "#e3bc45", "#58d1cc", "#372b4c", "#92918a", "#ebf3f2", "#aedbeb", "#333940", "#7eaa49", "#568541", "#e2ddd2", "#bc4545", "#4976b9", "#e6c94f", "#68a34e", "#f3bf4c", "#da5359", "#f7cf4c", "#6fa64a", "#ffe5a0"];

export function createVoxelAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  let state = 731;
  const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  TILE_COLORS.forEach((color, tile) => {
    const x = (tile % 8) * 32, y = Math.floor(tile / 8) * 32;
    const rect = (px: number, py: number, w: number, h: number, fill: string) => {
      ctx.fillStyle = fill;
      ctx.fillRect(x + px, y + py, w, h);
    };
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 32, 32);
    for (let n = 0; n < 100; n++) {
      ctx.fillStyle = random() > .5 ? "#ffffff20" : "#00000020";
      ctx.fillRect(x + Math.floor(random() * 16) * 2, y + Math.floor(random() * 16) * 2, 2, 2);
    }
    if (tile === 0 || tile === 11) {
      for (let n = 0; n < 36; n++) {
        const px = Math.floor(random() * 15) * 2, py = Math.floor(random() * 15) * 2;
        rect(px, py, 4, 2, tile === 11 ? "#86b15466" : "#b8d96555");
        rect(px, py + 2, 2, 2, "#173b242e");
      }
    }
    if (tile === 1) {
      rect(0, 0, 32, 6, TILE_COLORS[0]);
      for (let px = 0; px < 32; px += 2) {
        rect(px, 6, 2, 2 + Math.floor(random() * 3) * 2, "#518637");
        rect(px, 0, 2, 2, "#91b954");
      }
    }
    if ([4, 10, 14].includes(tile)) {
      ctx.fillStyle = "#00000040";
      for (let row = 0; row < 4; row++) {
        ctx.fillRect(x, y + row * 8, 32, 1);
        ctx.fillRect(x + (row % 2 ? 8 : 24), y + row * 8, 1, 8);
      }
    }
    if (tile === 9 || tile === 25) {
      ctx.fillStyle = "#00000040";
      for (let col = 3; col < 32; col += 7) ctx.fillRect(x + col, y, 2, 32);
      if (tile === 9) {
        for (let n = 0; n < 12; n++) rect(Math.floor(random() * 14) * 2, Math.floor(random() * 12) * 2, 2, 6, "#bc8d4d66");
      } else {
        for (let row = 3; row < 32; row += 8) for (let col = 3; col < 32; col += 8) rect(col, row, 2, 2, "#e2d49e");
      }
    }
    if (tile === 8) {
      for (let inset = 3; inset < 16; inset += 5) {
        rect(inset, inset, 32 - inset * 2, 2, "#785638");
        rect(inset, 30 - inset, 32 - inset * 2, 2, "#785638");
        rect(inset, inset, 2, 32 - inset * 2, "#785638");
        rect(30 - inset, inset, 2, 32 - inset * 2, "#785638");
      }
    }
    if (tile === 10) {
      for (let row = 0; row < 4; row++) {
        rect(2, row * 8 + 3, 12, 1, "#edd09b66");
        rect(17, row * 8 + 6, 13, 1, "#6e462b55");
      }
    }
    if (tile === 13 || tile === 22) {
      for (let n = 0; n < 8; n++) rect(Math.floor(random() * 11) * 2, n * 4, 8, 1, "#d7f5ff66");
    }
    if (tile === 7) {
      for (let row = 6; row < 32; row += 8) rect(0, row, 32, 1, "#967b4855");
    }
    if (tile >= 15 && tile <= 18) {
      ctx.fillStyle = "#747a7f"; ctx.fillRect(x, y, 32, 32);
      ctx.fillStyle = color;
      for (let n = 0; n < 9; n++) {
        const px = 2 + Math.floor(random() * 12) * 2, py = 2 + Math.floor(random() * 12) * 2;
        rect(px, py, 4, 4, color);
        rect(px, py, 2, 2, tile === 15 ? "#343b42" : "#ffffff88");
      }
    }
    if ([12, 31, 32, 33, 34].includes(tile)) {
      ctx.clearRect(x, y, 32, 32);
      if (tile === 12) {
        ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, 30, 30);
        // Le verre partage le materiau decoupe : son centre reste transparent.
        for (let n = 0; n < 5; n++) rect(6 + n * 2, 17 - n * 2, 2, 2, "#e1faff");
      } else if (tile === 31) {
        rect(11, 12, 10, 20, "#795233");
        rect(11, 12, 3, 20, "#ac8253");
        rect(7, 5, 18, 10, "#f19032");
        rect(10, 2, 12, 10, "#ffce52");
        rect(13, 4, 6, 7, "#fff1a6");
      } else if (tile === 34) {
        for (let n = 0; n < 5; n++) {
          const px = 4 + n * 5, top = 6 + Math.floor(random() * 10);
          rect(px, top, 3, 32 - top, n % 2 ? "#92bc55" : "#548435");
          rect(px - 2, top - 3, 2, 8, "#70a441");
        }
      } else {
        rect(15, 13, 3, 19, "#45823e");
        rect(10, 23, 7, 3, "#679c44");
        rect(17, 19, 6, 3, "#528e3e");
        rect(10, 5, 12, 15, color);
        rect(7, 8, 18, 9, color);
        rect(13, 10, 6, 5, tile === 32 ? "#ffce67" : "#996b34");
        rect(10, 6, 4, 3, "#ffffff66");
      }
    }
    if (tile === 35) {
      rect(0, 0, 32, 3, "#80633d"); rect(0, 29, 32, 3, "#80633d");
      rect(0, 0, 3, 32, "#80633d"); rect(29, 0, 3, 32, "#80633d");
      rect(7, 7, 18, 18, "#fff5cc");
    }
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = "Cubes - atlas original";
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  return texture;
}
