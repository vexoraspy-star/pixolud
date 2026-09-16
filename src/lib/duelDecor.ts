import * as THREE from "three";
import type { DuelMap, DuelTheme } from "./duel";
import {
  makeBarrelTexture,
  makeCrateTexture,
  makeSandbagTexture,
  makeSiteMarkTexture,
} from "./duelTextures";

/**
 * Le decor d'une carte du Duel.
 *
 * Deux choses differentes vivent ici :
 *
 * - les CAISSES, qui sont de vraies cases pleines de la grille (meme
 *   collision qu'un mur) simplement dessinees en caisses empilees plutot
 *   qu'en panneau. Elles montent jusqu'au plafond, sinon on croirait pouvoir
 *   tirer par-dessus alors que la balle serait arretee ;
 * - les ACCESSOIRES (bidons, sacs de sable, palettes, rochers), qui ne
 *   bloquent rien. Ils sont donc tous bas — moins d'un metre — pour ne jamais
 *   sembler arreter une balle tiree a hauteur d'yeux.
 *
 * Tout est instancie : une carte entierement decoree coute cinq appels de
 * rendu.
 */
export interface DuelDecor {
  group: THREE.Group;
  dispose(): void;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface ThemeProps {
  /** Une case decoree sur N cases libres bordant un mur. */
  every: number;
  barils: number;
  sacs: number;
  palettes: number;
  rochers: number;
  /** Teinte des bidons (l'Arene est plus technique que rouillee). */
  barilColor: number;
}

const THEME_PROPS: Record<DuelTheme, ThemeProps> = {
  arene: { every: 14, barils: 0.5, sacs: 0.1, palettes: 0.4, rochers: 0, barilColor: 0x6d7681 },
  entrepot: { every: 7, barils: 0.4, sacs: 0.1, palettes: 0.5, rochers: 0, barilColor: 0xb5793a },
  gouffre: { every: 9, barils: 0.25, sacs: 0.15, palettes: 0.1, rochers: 0.5, barilColor: 0x7a6a52 },
  poussiere: { every: 6, barils: 0.35, sacs: 0.4, palettes: 0.25, rochers: 0, barilColor: 0xb5793a },
};

export function buildDuelDecor(map: DuelMap, cell: number, wallHeight: number): DuelDecor {
  const group = new THREE.Group();
  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => {
    owned.push(x);
    return x;
  };
  const plan = THEME_PROPS[map.theme];
  const rng = mulberry32(map.width * 7919 + map.height * 104729 + map.crates.length * 31 + map.theme.length);

  const solid = new Set(map.walls.map(([x, y]) => `${x},${y}`));
  const isSolid = (x: number, y: number) => x < 0 || y < 0 || x >= map.width || y >= map.height || solid.has(`${x},${y}`);
  const spawnCells = new Set(
    [...map.spawns.a, ...map.spawns.b].flatMap(([x, y]) => [
      `${x},${y}`,
      `${x + 1},${y}`,
      `${x - 1},${y}`,
      `${x},${y + 1}`,
      `${x},${y - 1}`,
    ]),
  );

  const m4 = new THREE.Matrix4();
  const q4 = new THREE.Quaternion();
  const v3 = new THREE.Vector3();
  const s3 = new THREE.Vector3(1, 1, 1);
  const euler = new THREE.Euler();

  // --- Caisses empilees : elles remplacent le mur sur ces cases ---
  if (map.crates.length > 0) {
    const crateMat = keep(new THREE.MeshLambertMaterial({ map: keep(makeCrateTexture()) }));
    const geo = keep(new THREE.BoxGeometry(1, 1, 1));
    const mesh = new THREE.InstancedMesh(geo, crateMat, map.crates.length * 3);
    let i = 0;
    for (const [cx, cy] of map.crates) {
      const x = (cx + 0.5) * cell;
      const z = (cy + 0.5) * cell;
      // Deux grosses caisses l'une sur l'autre, plus une petite de traviole
      // posee sur le dessus : c'est la silhouette qui fait « entrepot ».
      const hBig = wallHeight / 2;
      for (let k = 0; k < 2; k++) {
        euler.set(0, (rng() - 0.5) * 0.09, 0);
        q4.setFromEuler(euler);
        m4.compose(v3.set(x, hBig / 2 + k * hBig, z), q4, s3.set(cell * 0.99, hBig * 0.99, cell * 0.99));
        mesh.setMatrixAt(i++, m4);
      }
      if (rng() < 0.35) {
        const s = cell * 0.42;
        euler.set(0, rng() * 1.2, 0);
        q4.setFromEuler(euler);
        m4.compose(
          v3.set(x + (rng() - 0.5) * cell * 0.3, wallHeight + s / 2, z + (rng() - 0.5) * cell * 0.3),
          q4,
          s3.set(s, s, s),
        );
        mesh.setMatrixAt(i++, m4);
      }
    }
    mesh.count = i;
    group.add(mesh);
  }

  // --- Marquages de site peints au sol ---
  if (map.marks.length > 0) {
    const markGeo = keep(new THREE.PlaneGeometry(cell * 2.6, cell * 2.6));
    for (const mark of map.marks) {
      const mat = keep(
        new THREE.MeshLambertMaterial({
          map: keep(makeSiteMarkTexture(mark.label)),
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
        }),
      );
      const mesh = new THREE.Mesh(markGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set((mark.x + 0.5) * cell, 0.015, (mark.y + 0.5) * cell);
      group.add(mesh);
    }
  }

  // --- Accessoires bas, colles aux murs ---
  // Une case libre qui touche un mur, une sur `every` : assez pour habiller
  // les couloirs sans transformer l'arene en brocante.
  type Spot = { x: number; y: number; dx: number; dy: number };
  const spots: Spot[] = [];
  for (let y = 1; y < map.height - 1; y++) {
    for (let x = 1; x < map.width - 1; x++) {
      if (isSolid(x, y) || spawnCells.has(`${x},${y}`)) continue;
      const dirs = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).filter(([dx, dy]) => isSolid(x + dx, y + dy));
      if (dirs.length === 0) continue;
      if (rng() > 1 / plan.every) continue;
      const [dx, dy] = dirs[Math.floor(rng() * dirs.length)];
      spots.push({ x, y, dx, dy });
    }
  }

  const barils: Spot[] = [];
  const sacs: Spot[] = [];
  const palettes: Spot[] = [];
  const rochers: Spot[] = [];
  const total = plan.barils + plan.sacs + plan.palettes + plan.rochers;
  for (const spot of spots) {
    let r = rng() * total;
    if ((r -= plan.barils) < 0) barils.push(spot);
    else if ((r -= plan.sacs) < 0) sacs.push(spot);
    else if ((r -= plan.palettes) < 0) palettes.push(spot);
    else rochers.push(spot);
  }

  /** Position collee au mur, avec un petit desordre. */
  const place = (spot: Spot, inset: number) => ({
    x: (spot.x + 0.5 + spot.dx * (0.5 - inset)) * cell + (spot.dx === 0 ? (rng() - 0.5) * cell * 0.4 : 0),
    z: (spot.y + 0.5 + spot.dy * (0.5 - inset)) * cell + (spot.dy === 0 ? (rng() - 0.5) * cell * 0.4 : 0),
  });

  if (barils.length > 0) {
    const mat = keep(new THREE.MeshLambertMaterial({ map: keep(makeBarrelTexture()), color: plan.barilColor }));
    const geo = keep(new THREE.CylinderGeometry(0.29, 0.29, 0.88, 12));
    const lidMat = keep(new THREE.MeshLambertMaterial({ color: 0x3f3a33 }));
    const lidGeo = keep(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 12));
    const mesh = new THREE.InstancedMesh(geo, mat, barils.length);
    const lids = new THREE.InstancedMesh(lidGeo, lidMat, barils.length);
    barils.forEach((spot, i) => {
      const p = place(spot, 0.22);
      euler.set(0, rng() * Math.PI, 0);
      q4.setFromEuler(euler);
      m4.compose(v3.set(p.x, 0.44, p.z), q4, s3.set(1, 1, 1));
      mesh.setMatrixAt(i, m4);
      m4.compose(v3.set(p.x, 0.9, p.z), q4, s3.set(1, 1, 1));
      lids.setMatrixAt(i, m4);
    });
    group.add(mesh, lids);
  }

  if (sacs.length > 0) {
    const mat = keep(new THREE.MeshLambertMaterial({ map: keep(makeSandbagTexture()) }));
    const geo = keep(new THREE.BoxGeometry(0.55, 0.22, 0.34));
    const mesh = new THREE.InstancedMesh(geo, mat, sacs.length * 5);
    let i = 0;
    for (const spot of sacs) {
      const p = place(spot, 0.2);
      const yaw = spot.dx !== 0 ? Math.PI / 2 : 0;
      // Deux rangees de deux, une troisieme posee en travers au-dessus.
      for (let k = 0; k < 2; k++) {
        for (let j = 0; j < 2; j++) {
          euler.set(0, yaw + (rng() - 0.5) * 0.2, 0);
          q4.setFromEuler(euler);
          const off = (j - 0.5) * 0.58;
          m4.compose(
            v3.set(p.x + (spot.dx !== 0 ? 0 : off), 0.11 + k * 0.22, p.z + (spot.dx !== 0 ? off : 0)),
            q4,
            s3.set(1, 1, 1),
          );
          mesh.setMatrixAt(i++, m4);
        }
      }
      euler.set(0, yaw + (rng() - 0.5) * 0.5, 0);
      q4.setFromEuler(euler);
      m4.compose(v3.set(p.x, 0.55, p.z), q4, s3.set(1, 1, 1));
      mesh.setMatrixAt(i++, m4);
    }
    mesh.count = i;
    group.add(mesh);
  }

  if (palettes.length > 0) {
    const mat = keep(new THREE.MeshLambertMaterial({ map: keep(makeCrateTexture()), color: 0xb9a184 }));
    const plankGeo = keep(new THREE.BoxGeometry(0.9, 0.06, 0.16));
    const mesh = new THREE.InstancedMesh(plankGeo, mat, palettes.length * 6);
    const crateMat = keep(new THREE.MeshLambertMaterial({ map: keep(makeCrateTexture()) }));
    const crateGeo = keep(new THREE.BoxGeometry(0.62, 0.62, 0.62));
    const crates = new THREE.InstancedMesh(crateGeo, crateMat, palettes.length);
    let i = 0;
    let c = 0;
    for (const spot of palettes) {
      const p = place(spot, 0.24);
      const yaw = (spot.dx !== 0 ? Math.PI / 2 : 0) + (rng() - 0.5) * 0.3;
      euler.set(0, yaw, 0);
      q4.setFromEuler(euler);
      for (let k = 0; k < 4; k++) {
        m4.compose(
          v3.set(p.x + Math.cos(yaw) * (k - 1.5) * 0.24, 0.06, p.z - Math.sin(yaw) * (k - 1.5) * 0.24),
          q4,
          s3.set(1, 1, 1),
        );
        mesh.setMatrixAt(i++, m4);
      }
      // Une caisse posee dessus une fois sur deux.
      if (rng() < 0.55) {
        euler.set(0, yaw + (rng() - 0.5) * 0.6, 0);
        q4.setFromEuler(euler);
        m4.compose(v3.set(p.x, 0.41, p.z), q4, s3.set(1, 1, 1));
        crates.setMatrixAt(c++, m4);
      }
    }
    mesh.count = i;
    crates.count = c;
    group.add(mesh);
    if (c > 0) group.add(crates);
  }

  if (rochers.length > 0) {
    const mat = keep(new THREE.MeshLambertMaterial({ color: 0x4a443c, flatShading: true }));
    const geo = keep(new THREE.IcosahedronGeometry(0.42, 0));
    const mesh = new THREE.InstancedMesh(geo, mat, rochers.length);
    rochers.forEach((spot, i) => {
      const p = place(spot, 0.2);
      euler.set(rng() * 3, rng() * 3, rng() * 3);
      q4.setFromEuler(euler);
      const s = 0.6 + rng() * 0.7;
      m4.compose(v3.set(p.x, 0.2 * s, p.z), q4, s3.set(s, s * 0.7, s));
      mesh.setMatrixAt(i, m4);
    });
    group.add(mesh);
  }

  return {
    group,
    dispose() {
      for (const o of owned) o.dispose();
    },
  };
}
