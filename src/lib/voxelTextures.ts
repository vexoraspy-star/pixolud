import * as THREE from "three";

// Palette originale : prairie lumineuse, bois miel et pierre aux tons doux.
export const TILE_COLORS = ["#78ad52", "#967352", "#967352", "#9aa4a5", "#a6afb0", "#ead5a5", "#d7bf8d", "#d2b886", "#caa16b", "#8c6748", "#c49a68", "#50874c", "#bce9e7", "#53b9c6", "#be7864", "#454e59", "#c89f7f", "#edc95e", "#69ded4", "#493e60", "#a7aaa3", "#eef4ef", "#b5dfe9", "#414953", "#81ac61", "#65965b", "#e8e3d6", "#c96668", "#759dc7", "#e8c764", "#87ad65", "#f2b64b", "#e97c87", "#f6cf65", "#81b65b", "#ffe3a2"];

export function createVoxelAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  TILE_COLORS.forEach((color, tile) => {
    const x = (tile % 8) * 32, y = Math.floor(tile / 8) * 32;
    // Une graine par tuile garde les autres motifs stables lors des retouches.
    let state = 731 + tile * 9743;
    const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
    const rect = (px: number, py: number, w: number, h: number, fill: string) => {
      ctx.fillStyle = fill;
      ctx.fillRect(x + px, y + py, w, h);
    };
    // Les taches jointes donnent du volume sans bruit pixel par pixel.
    const clusters = (count: number, shades: string[], size = 4) => {
      for (let n = 0; n < count; n++) {
        const px = Math.floor(random() * 16) * 2, py = Math.floor(random() * 16) * 2;
        const shade = shades[Math.floor(random() * shades.length)];
        const width = size + Math.floor(random() * 3) * 2;
        rect(px, py, width, 2, shade);
        rect(px + 2, py + 2, Math.max(2, width - 2), 2, shade);
      }
    };
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, 32, 32); ctx.clip();
    rect(0, 0, 32, 32, color);

    if (tile === 0) {
      clusters(18, ["#80b558", "#73a64f", "#89b95e", "#6fa24c"]);
      for (let n = 0; n < 7; n++) {
        const px = Math.floor(random() * 15) * 2, py = Math.floor(random() * 15) * 2;
        rect(px, py, 2, 4, "#9cc774"); rect(px + 2, py + 2, 2, 2, "#8bbd61");
      }
    } else if (tile === 1 || tile === 2) {
      clusters(23, ["#a37e58", "#896948", "#9d7953", "#ad8962"]);
      for (let n = 0; n < 4; n++) rect(Math.floor(random() * 14) * 2, 12 + Math.floor(random() * 9) * 2, 3, 2, "#c3a281");
      if (tile === 1) {
        rect(0, 0, 32, 6, "#78ad52");
        for (let px = 0; px < 32; px += 4) {
          const depth = 2 + Math.floor(random() * 3) * 2;
          rect(px, 6, 4, depth, "#67964b"); rect(px, 5, 4, depth - 1, "#78ad52");
          rect(px, 0, 4, 2, px % 8 ? "#8cbb63" : "#82b459");
        }
      }
    } else if ([3, 15, 16, 17, 18].includes(tile)) {
      rect(0, 0, 32, 32, TILE_COLORS[3]);
      clusters(18, ["#8f9a9b", "#a5aeae", "#939fa0", "#acb4b2"], 6);
      if (tile !== 3) {
        for (const [px, py] of [[4, 5], [21, 4], [13, 14], [3, 23], [23, 24]]) {
          rect(px, py + 1, 7, 5, "#778789"); rect(px + 1, py, 5, 5, color);
          rect(px + 1, py, 3, 2, tile === 15 ? "#66717b" : "#ffffff70");
          rect(px + 4, py + 3, 2, 2, "#00000020");
        }
      }
    } else if (tile === 4 || tile === 14) {
      rect(0, 0, 32, 32, tile === 4 ? "#899698" : "#a16e60");
      for (let row = 0; row < 4; row++) for (let col = -1; col < 3; col++) {
        const px = col * 16 + (row % 2) * 8, py = row * 8;
        rect(px + 1, py + 1, 15, 7, color);
        rect(px + 2, py + 1, 13, 1, tile === 4 ? "#bbc2bf" : "#d9937a");
        rect(px + 3, py + 3, 7, 2, tile === 4 ? "#adb6b3" : "#c7836d");
        rect(px + 1, py + 7, 15, 1, tile === 4 ? "#929fa0" : "#b47261");
      }
    } else if ([5, 6, 7].includes(tile)) {
      clusters(14, ["#ffffff18", "#b798621b"], 6);
      if (tile === 5) {
        for (let n = 0; n < 9; n++) rect(Math.floor(random() * 15) * 2, Math.floor(random() * 15) * 2, 2, 1, "#bc9e6f55");
        rect(2, 9, 8, 1, "#f4e6c3"); rect(18, 25, 10, 1, "#f4e6c3");
      } else if (tile === 7) {
        for (let row = 6; row < 32; row += 8) {
          rect(0, row, 32, 1, "#b3976c"); rect(0, row + 1, 32, 1, "#e6cca0");
        }
      }
    } else if (tile === 8) {
      rect(0, 0, 32, 32, "#94704b"); rect(2, 2, 28, 28, color);
      for (let inset = 5; inset < 15; inset += 5) {
        rect(inset + 2, inset, 28 - inset * 2, 2, "#a78053");
        rect(inset + 2, 30 - inset, 28 - inset * 2, 2, "#e0b980");
        rect(inset, inset + 2, 2, 28 - inset * 2, "#a78053");
        rect(30 - inset, inset + 2, 2, 28 - inset * 2, "#a78053");
      }
      rect(15, 14, 3, 4, "#9c744a");
    } else if (tile === 9) {
      for (let col = 0; col < 32; col += 8) {
        rect(col, 0, 2, 32, "#76573f"); rect(col + 2, 0, 2, 32, "#a37b50");
        rect(col + 5, 4 + (col % 3) * 5, 2, 13, "#7d5b3f");
        rect(col + 3, 3 + (col % 4) * 5, 2, 8, "#b18a5c");
      }
      rect(19, 18, 5, 7, "#75533b"); rect(20, 20, 3, 3, "#b18a5c");
    } else if (tile === 10) {
      for (let row = 0; row < 4; row++) {
        const py = row * 8, join = row % 2 ? 9 : 24;
        rect(0, py, 32, 1, "#96714f"); rect(0, py + 1, 32, 1, "#dfb985");
        rect(join, py, 1, 8, "#9e7952"); rect(3, py + 4, 10, 1, "#d4aa77");
        rect(18, py + 6, 11, 1, "#b48a5b");
      }
    } else if (tile === 11) {
      rect(0, 0, 32, 32, "#467748");
      // Rosettes de feuillage en quinconce, avec une lumiere douce sur le dessus.
      for (let row = -1; row < 4; row++) for (let col = -1; col < 4; col++) {
        const px = col * 10 + (row % 2) * 5, py = row * 10;
        rect(px + 2, py + 2, 6, 8, "#58924f"); rect(px, py + 4, 10, 4, "#58924f");
        rect(px + 2, py + 2, 6, 2, "#7ba95a"); rect(px + 2, py + 4, 2, 2, "#6ca153");
        rect(px + 4, py + 8, 4, 2, "#396d43");
      }
    } else if (tile === 13) {
      clusters(7, ["#64c3cc", "#4cb0c0"], 8);
      for (const [px, py, width] of [[2, 7, 9], [19, 15, 11], [6, 25, 10]]) {
        rect(px, py, width, 1, "#c1eeeb99"); rect(px + 3, py + 1, width - 3, 1, "#8ed6db88");
      }
    } else if (tile === 19 || tile === 23) {
      clusters(24, tile === 19 ? ["#584b70", "#3b3650", "#635579"] : ["#53606a", "#38424a", "#626c72"], 6);
    } else if (tile === 20) {
      clusters(28, ["#b9bab0", "#919b96", "#c4c3b8", "#a2aaa2"], 4);
    } else if (tile === 21 || tile === 22) {
      clusters(9, tile === 21 ? ["#e0ebe9", "#f6f8ef"] : ["#c6e8ed", "#a8d3e0"], 6);
      if (tile === 22) {
        for (let n = 0; n < 6; n++) rect(5 + n * 2, 20 - n * 2, 2, 5, "#e6f6f3");
        rect(22, 6, 7, 2, "#e6f6f3");
      }
    } else if (tile === 24 || tile === 25) {
      clusters(10, ["#ffffff0c", "#173f2914"]);
      if (tile === 24) {
        rect(5, 5, 22, 22, "#91b972"); rect(9, 9, 14, 14, "#739e58"); rect(13, 13, 6, 6, "#b3c888");
      } else for (let col = 3; col < 32; col += 8) {
        rect(col, 0, 2, 32, "#4f804e"); rect(col + 2, 0, 2, 32, "#83ad65");
        for (let row = 4; row < 32; row += 10) rect(col + 3, row + (col % 3), 2, 2, "#decea0");
      }
    } else if (tile >= 26 && tile <= 30) {
      // Un tissage discret conserve la couleur lisible pour la construction.
      for (let row = 0; row < 32; row += 4) for (let col = 0; col < 32; col += 4) {
        rect(col, row, 3, 1, "#ffffff13"); rect(col + 3, row + 1, 1, 3, "#0000000b");
      }
    }

    if ([12, 31, 32, 33, 34].includes(tile)) {
      ctx.clearRect(x, y, 32, 32);
      if (tile === 12) {
        // Le verre partage le materiau decoupe : son centre reste transparent.
        rect(0, 0, 32, 1, "#e0f5ef"); rect(0, 0, 1, 32, "#e0f5ef");
        rect(31, 0, 1, 32, "#9bd5d9"); rect(0, 31, 32, 1, "#9bd5d9");
        for (let n = 0; n < 5; n++) rect(5 + n * 2, 16 - n * 2, 2, 2, "#d5eeed");
        rect(21, 24, 2, 2, "#d5eeed"); rect(23, 22, 2, 2, "#d5eeed");
      } else if (tile === 31) {
        rect(13, 13, 6, 19, "#805b40"); rect(13, 13, 2, 19, "#bd945f");
        rect(11, 15, 10, 3, "#635444"); rect(10, 6, 12, 9, "#e89242");
        rect(12, 3, 8, 10, "#f8c65c"); rect(14, 6, 4, 7, "#fff1b4"); rect(16, 1, 2, 4, "#f8c65c");
      } else if (tile === 34) {
        for (const [px, top, shade] of [[5, 15, "#659b4e"], [10, 9, "#91bd67"], [16, 5, "#7aaf55"], [22, 12, "#91bd67"], [27, 18, "#659b4e"]] as const) {
          rect(px, top, 2, 32 - top, shade); rect(px - 2, top - 3, 2, 8, shade);
          rect(px - 4, top - 5, 2, 4, shade); rect(px + 2, top + 7, 2, 4, "#568946");
        }
      } else {
        rect(15, 15, 2, 17, "#548549"); rect(16, 16, 1, 16, "#8dbb64");
        rect(10, 23, 5, 2, "#7eae58"); rect(8, 21, 4, 2, "#96bf6b");
        rect(17, 20, 5, 3, "#699e50"); rect(20, 18, 4, 2, "#88b95f");
        rect(12, 4, 8, 15, color); rect(8, 8, 16, 7, color);
        rect(12, 4, 6, 2, tile === 32 ? "#ffacac" : "#ffe699");
        rect(8, 8, 4, 3, tile === 32 ? "#f89a9f" : "#ffe18a");
        rect(12, 17, 8, 2, tile === 32 ? "#c85e73" : "#dbab45");
        rect(13, 9, 6, 5, tile === 32 ? "#ffe09a" : "#b98845");
        rect(13, 9, 4, 2, tile === 32 ? "#fff0bd" : "#d4ab62");
      }
    }
    if (tile === 35) {
      rect(0, 0, 32, 3, "#887153"); rect(0, 29, 32, 3, "#887153");
      rect(0, 0, 3, 32, "#887153"); rect(29, 0, 3, 32, "#887153");
      rect(5, 5, 22, 22, "#fff0bd"); rect(8, 8, 16, 16, "#fff7d6");
      for (const px of [1, 28]) for (const py of [1, 28]) rect(px, py, 3, 3, "#bf9e65");
    }
    ctx.restore();
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = "Cubes - atlas original";
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  return texture;
}
