/**
 * Chemins sur la grille du Duel, sans allouer a chaque recherche.
 *
 * L'ancien BFS construisait une cle texte par case visitee (`"x,y"`) et une
 * Map de predecesseurs : correct sur l'arene de 19 cases, ruineux sur une ile
 * de 150 x 150 avec trente combattants. Ici tout vit dans des tableaux types
 * reutilises : un tampon de generation evite meme de les remettre a zero.
 */
export interface GridPather {
  /**
   * Chemin de (fx, fy) vers (tx, ty), SANS la case de depart (la viser
   * ramenait le bot au centre de sa case a chaque recalcul).
   * `maxNodes` borne la recherche : au-dela, on renvoie null et le bot se
   * rapproche en ligne droite.
   */
  find(fx: number, fy: number, tx: number, ty: number, maxNodes?: number): [number, number][] | null;
}

export function createGridPather(width: number, height: number, solid: Uint8Array): GridPather {
  const size = width * height;
  const prev = new Int32Array(size);
  const seen = new Uint32Array(size);
  const queue = new Int32Array(size);
  let generation = 0;

  return {
    find(fx, fy, tx, ty, maxNodes = size) {
      if (fx < 0 || fy < 0 || fx >= width || fy >= height) return null;
      if (tx < 0 || ty < 0 || tx >= width || ty >= height) return null;
      const start = fy * width + fx;
      const goal = ty * width + tx;
      if (start === goal) return [];
      if (solid[goal]) return null;
      generation = (generation + 1) >>> 0;
      if (generation === 0) {
        seen.fill(0);
        generation = 1;
      }
      let head = 0;
      let tail = 0;
      queue[tail++] = start;
      seen[start] = generation;
      prev[start] = -1;
      let found = false;
      while (head < tail && tail < maxNodes) {
        const i = queue[head++];
        if (i === goal) {
          found = true;
          break;
        }
        const x = i % width;
        // Quatre voisins, sans sortir de la grille.
        if (x > 0) {
          const n = i - 1;
          if (!solid[n] && seen[n] !== generation) {
            seen[n] = generation;
            prev[n] = i;
            queue[tail++] = n;
          }
        }
        if (x < width - 1) {
          const n = i + 1;
          if (!solid[n] && seen[n] !== generation) {
            seen[n] = generation;
            prev[n] = i;
            queue[tail++] = n;
          }
        }
        if (i >= width) {
          const n = i - width;
          if (!solid[n] && seen[n] !== generation) {
            seen[n] = generation;
            prev[n] = i;
            queue[tail++] = n;
          }
        }
        if (i < size - width) {
          const n = i + width;
          if (!solid[n] && seen[n] !== generation) {
            seen[n] = generation;
            prev[n] = i;
            queue[tail++] = n;
          }
        }
      }
      if (!found && seen[goal] !== generation) return null;
      const path: [number, number][] = [];
      for (let i = goal; i !== start && i >= 0; i = prev[i]) path.push([i % width, Math.floor(i / width)]);
      path.reverse();
      return path;
    },
  };
}
