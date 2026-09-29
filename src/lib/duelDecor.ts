import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { DuelMap, DuelTheme } from "./duel";
import {
  makeBarrelTexture,
  makeBoulderTexture,
  makeCrateTexture,
  makeSandbagTexture,
  makeSiteMarkTexture,
  makeWoodBeamTexture,
} from "./duelMapTextures";
import { buildDesertTown } from "./duelTown";

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
 * La carte « Poussiere » recoit en plus toute une ville (duelTown).
 *
 * Tout est instancie : une carte entierement decoree coute une quinzaine
 * d'appels de rendu (une vingtaine de plus pour la ville du desert).
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
  caissons: number;
  buissons: number;
  /** Peintures des bidons (l'Arene est plus technique que rouillee). */
  barilColors: number[];
}

const THEME_PROPS: Record<DuelTheme, ThemeProps> = {
  arene: { every: 6, barils: 0.35, sacs: 0, palettes: 0, rochers: 0, caissons: 0.65, buissons: 0, barilColors: [0x6d7681, 0x5a636e, 0x8a929b] },
  entrepot: {
    every: 5,
    barils: 0.35,
    sacs: 0.1,
    palettes: 0.5,
    rochers: 0,
    caissons: 0.1,
    buissons: 0,
    barilColors: [0x3f6fa8, 0xb5793a, 0x4d6b3c, 0x9a3a2a, 0xc9a23a],
  },
  gouffre: { every: 6, barils: 0.2, sacs: 0.15, palettes: 0.1, rochers: 0.55, caissons: 0, buissons: 0, barilColors: [0x7a6a52, 0x5d6448, 0x8a4a2c] },
  // Le sable, les herbes et les palmiers de Poussiere viennent de la ville.
  poussiere: {
    every: 4,
    barils: 0.4,
    sacs: 0.25,
    palettes: 0.45,
    rochers: 0,
    caissons: 0,
    buissons: 0,
    barilColors: [0x3f6fa8, 0x2f5f94, 0xa04a2c, 0x6b7045, 0xc9a23a, 0x8f8f86],
  },
  ile: { every: 9, barils: 0.25, sacs: 0.15, palettes: 0.3, rochers: 0.1, caissons: 0, buissons: 0.4, barilColors: [0x4f7fb5, 0xa04a2c, 0x5d7a45] },
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
  const crateCells = new Set(map.crates.map(([x, y]) => `${x},${y}`));
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
  const tint = new THREE.Color();

  // Les caisses (grille et accessoires) partagent une geometrie : un cube a
  // montants en relief sur les douze aretes.
  const crateTex = keep(makeCrateTexture());
  const crateMat = keep(new THREE.MeshLambertMaterial({ map: crateTex }));
  const crateGeo = keep(crateGeometry());

  // Ombre de contact sous les accessoires : un disque flou pose au sol.
  const blobs: THREE.Matrix4[] = [];
  const addBlob = (x: number, z: number, sx: number, sz: number, yaw: number) => {
    euler.set(0, yaw, 0);
    q4.setFromEuler(euler);
    blobs.push(new THREE.Matrix4().compose(v3.set(x, 0.01, z), q4, s3.set(sx, 1, sz)));
  };

  // --- Caisses empilees : elles remplacent le mur sur ces cases ---
  if (map.crates.length > 0) {
    const mesh = new THREE.InstancedMesh(crateGeo, crateMat, map.crates.length * 6);
    let i = 0;
    /** Une caisse de cote `w` (profondeur `d`), haute de `h`, posee a `y0`. */
    const put = (x: number, z: number, y0: number, w: number, h: number, d: number, yaw: number) => {
      euler.set(0, yaw, 0);
      q4.setFromEuler(euler);
      m4.compose(v3.set(x, y0 + h / 2, z), q4, s3.set(w, h, d));
      mesh.setMatrixAt(i, m4);
      // Bois plus ou moins grise par le temps.
      const k = 0.82 + rng() * 0.22;
      mesh.setColorAt(i, tint.setRGB(k, k * (0.96 + rng() * 0.04), k * (0.9 + rng() * 0.1)));
      i++;
    };
    for (const [cx, cy] of map.crates) {
      const x = (cx + 0.5) * cell;
      const z = (cy + 0.5) * cell;
      const jit = () => (rng() - 0.5) * 0.08;
      const r = rng();
      // Toujours pleine largeur jusqu'a hauteur de tete : ce qui semble
      // couvrir doit couvrir. Au-dessus, les piles varient.
      if (r < 0.35) {
        // Deux grosses caisses l'une sur l'autre.
        const h = wallHeight / 2;
        put(x, z, 0, cell * 0.98, h * 0.99, cell * 0.98, jit());
        put(x, z, h, cell * 0.95, h * 0.99, cell * 0.95, jit() * 1.5);
      } else if (r < 0.72) {
        // Trois tailles, de plus en plus petites et de travers.
        put(x, z, 0, cell * 0.98, 1.3, cell * 0.98, jit());
        put(x, z, 1.3, cell * 0.9, 1.15, cell * 0.9, jit() * 2);
        const s = 0.95 + rng() * 0.3;
        put(x + (rng() - 0.5) * 0.3, z + (rng() - 0.5) * 0.3, 2.45, s, wallHeight - 2.45, s, (rng() - 0.5) * 0.9);
      } else {
        // Quatre petites caisses au sol, une grande dessus, une moyenne au sommet.
        const hs = 0.92;
        for (const ox of [-1, 1]) for (const oz of [-1, 1]) put(x + ox * cell * 0.245, z + oz * cell * 0.245, 0, cell * 0.48, hs, cell * 0.48, jit() * 0.5);
        put(x, z, hs, cell * 0.96, 1.4, cell * 0.96, jit());
        const s = 1.0 + rng() * 0.25;
        put(x + (rng() - 0.5) * 0.25, z + (rng() - 0.5) * 0.25, hs + 1.4, s, wallHeight - hs - 1.4, s, (rng() - 0.5) * 0.7);
      }
    }
    mesh.count = i;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
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
  const caissons: Spot[] = [];
  const buissons: Spot[] = [];
  const total = plan.barils + plan.sacs + plan.palettes + plan.rochers + plan.caissons + plan.buissons;
  for (const spot of spots) {
    let r = rng() * total;
    if ((r -= plan.barils) < 0) barils.push(spot);
    else if ((r -= plan.sacs) < 0) sacs.push(spot);
    else if ((r -= plan.palettes) < 0) palettes.push(spot);
    else if ((r -= plan.rochers) < 0) rochers.push(spot);
    else if ((r -= plan.caissons) < 0) caissons.push(spot);
    else buissons.push(spot);
  }

  /** Position collee au mur, avec un petit desordre. */
  const place = (spot: Spot, inset: number) => ({
    x: (spot.x + 0.5 + spot.dx * (0.5 - inset)) * cell + (spot.dx === 0 ? (rng() - 0.5) * cell * 0.4 : 0),
    z: (spot.y + 0.5 + spot.dy * (0.5 - inset)) * cell + (spot.dy === 0 ? (rng() - 0.5) * cell * 0.4 : 0),
  });
  /** Direction le long du mur d'un emplacement. */
  const alongOf = (spot: Spot) => (spot.dx !== 0 ? { ax: 0, az: 1 } : { ax: 1, az: 0 });

  if (barils.length > 0) {
    // Un a trois futs cercles cote a cote ; parfois un fut couche devant.
    const mat = keep(new THREE.MeshLambertMaterial({ map: keep(makeBarrelTexture()) }));
    const geo = keep(barrelGeometry());
    const mesh = new THREE.InstancedMesh(geo, mat, barils.length * 4);
    let i = 0;
    for (const spot of barils) {
      const p = place(spot, 0.2);
      const { ax, az } = alongOf(spot);
      const n = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) {
        const off = (k - (n - 1) / 2) * 0.62;
        euler.set(0, rng() * Math.PI * 2, 0);
        q4.setFromEuler(euler);
        m4.compose(v3.set(p.x + ax * off, 0, p.z + az * off), q4, s3.set(1, 0.97 + rng() * 0.06, 1));
        mesh.setMatrixAt(i, m4);
        mesh.setColorAt(i, tint.set(plan.barilColors[Math.floor(rng() * plan.barilColors.length)]));
        i++;
      }
      if (rng() < 0.2) {
        // Fut couche, pose devant les autres.
        const out = 0.62;
        euler.set(Math.PI / 2, (spot.dx !== 0 ? 0 : Math.PI / 2) + (rng() - 0.5) * 0.4, 0, "YXZ");
        q4.setFromEuler(euler);
        m4.compose(v3.set(p.x - spot.dx * out + ax * 0.44, 0.3, p.z - spot.dy * out + az * 0.44), q4, s3.set(1, 1, 1));
        mesh.setMatrixAt(i, m4);
        mesh.setColorAt(i, tint.set(plan.barilColors[Math.floor(rng() * plan.barilColors.length)]));
        i++;
        euler.order = "XYZ";
      }
      addBlob(p.x, p.z, 0.75 + n * 0.55, 0.9, spot.dx !== 0 ? Math.PI / 2 : 0);
    }
    mesh.count = i;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
  }

  if (sacs.length > 0) {
    const mat = keep(new THREE.MeshLambertMaterial({ map: keep(makeSandbagTexture()) }));
    // Sac bourre : une sphere ecrasee a 10 x 6 facettes, pas une boite.
    const geo = keep(new THREE.SphereGeometry(1, 10, 6).scale(0.29, 0.12, 0.18));
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
          const off = (j - 0.5) * 0.56 + (k === 1 ? 0.14 : 0);
          m4.compose(
            v3.set(p.x + (spot.dx !== 0 ? 0 : off), 0.1 + k * 0.2, p.z + (spot.dx !== 0 ? off : 0)),
            q4,
            s3.set(1, 1, 1),
          );
          mesh.setMatrixAt(i++, m4);
        }
      }
      euler.set(0, yaw + (rng() - 0.5) * 0.5, 0);
      q4.setFromEuler(euler);
      m4.compose(v3.set(p.x, 0.5, p.z), q4, s3.set(1, 1, 1));
      mesh.setMatrixAt(i++, m4);
      addBlob(p.x, p.z, 1.5, 0.75, yaw);
    }
    mesh.count = i;
    group.add(mesh);
  }

  if (palettes.length > 0) {
    // Palette de manutention (planches sur trois longerons) et des caisses de
    // tailles variees dessus : jamais plus haut que 95 cm.
    const mat = keep(new THREE.MeshLambertMaterial({ map: keep(makeWoodBeamTexture()), color: 0xc9b89e }));
    const geo = keep(palletGeometry());
    const mesh = new THREE.InstancedMesh(geo, mat, palettes.length);
    const boxes = new THREE.InstancedMesh(crateGeo, crateMat, palettes.length * 3);
    let c = 0;
    const box = (x: number, y0: number, z: number, s: number, yaw: number) => {
      euler.set(0, yaw, 0);
      q4.setFromEuler(euler);
      m4.compose(v3.set(x, y0 + s / 2, z), q4, s3.set(s, s, s));
      boxes.setMatrixAt(c, m4);
      const k = 0.85 + rng() * 0.2;
      boxes.setColorAt(c, tint.setRGB(k, k, k * (0.92 + rng() * 0.08)));
      c++;
    };
    palettes.forEach((spot, i) => {
      const p = place(spot, 0.28);
      const yaw = (spot.dx !== 0 ? Math.PI / 2 : 0) + (rng() - 0.5) * 0.3;
      euler.set(0, yaw, 0);
      q4.setFromEuler(euler);
      m4.compose(v3.set(p.x, 0, p.z), q4, s3.set(1, 1, 1));
      mesh.setMatrixAt(i, m4);
      const top = 0.14;
      const ax = Math.cos(yaw);
      const az = -Math.sin(yaw);
      const r = rng();
      if (r < 0.35) {
        box(p.x, top, p.z, 0.62 + rng() * 0.14, yaw + (rng() - 0.5) * 0.3);
      } else if (r < 0.7) {
        for (const s of [-1, 1]) box(p.x + ax * s * 0.29, top, p.z + az * s * 0.29, 0.46 + rng() * 0.1, yaw + (rng() - 0.5) * 0.25);
      } else if (r < 0.9) {
        const s1 = 0.52 + rng() * 0.06;
        box(p.x, top, p.z, s1, yaw + (rng() - 0.5) * 0.2);
        box(p.x + (rng() - 0.5) * 0.1, top + s1, p.z + (rng() - 0.5) * 0.1, 0.24 + rng() * 0.05, yaw + (rng() - 0.5) * 1.2);
      }
      addBlob(p.x, p.z, 1.45, 1.05, yaw);
    });
    boxes.count = c;
    if (boxes.instanceColor) boxes.instanceColor.needsUpdate = true;
    group.add(mesh);
    if (c > 0) group.add(boxes);
  }

  if (rochers.length > 0) {
    const mat = keep(new THREE.MeshLambertMaterial({ map: keep(makeBoulderTexture()), flatShading: true }));
    const geo = keep(rockGeometry(rng));
    const mesh = new THREE.InstancedMesh(geo, mat, rochers.length * 2);
    let i = 0;
    for (const spot of rochers) {
      const p = place(spot, 0.2);
      const n = rng() < 0.4 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        euler.set(rng() * 3, rng() * 3, rng() * 3);
        q4.setFromEuler(euler);
        const s = (0.6 + rng() * 0.7) * (k === 1 ? 0.55 : 1);
        const ox = k === 1 ? (rng() - 0.5) * 0.8 : 0;
        const oz = k === 1 ? (rng() - 0.5) * 0.8 : 0;
        m4.compose(v3.set(p.x + ox, 0.2 * s, p.z + oz), q4, s3.set(s, s * 0.7, s));
        mesh.setMatrixAt(i++, m4);
      }
      addBlob(p.x, p.z, 1.2, 1.2, 0);
    }
    mesh.count = i;
    group.add(mesh);
  }

  // --- Arbres (battle royale) : de vraies cases pleines, tronc et feuillage ---
  if (map.trees && map.trees.length > 0) {
    const trunkMat = keep(new THREE.MeshLambertMaterial({ color: 0x7a5534 }));
    const pineMat = keep(new THREE.MeshLambertMaterial({ color: 0x2f6f3a, flatShading: true }));
    const leafMat = keep(new THREE.MeshLambertMaterial({ color: 0x4f9a3c, flatShading: true }));
    const trunkGeo = keep(new THREE.CylinderGeometry(0.2, 0.28, 2.6, 7));
    const coneGeo = keep(new THREE.ConeGeometry(1.25, 2.4, 8));
    const ballGeo = keep(new THREE.IcosahedronGeometry(1.35, 0));
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, map.trees.length);
    const pines = new THREE.InstancedMesh(coneGeo, pineMat, map.trees.length * 2);
    const leaves = new THREE.InstancedMesh(ballGeo, leafMat, map.trees.length);
    let pi = 0;
    let li = 0;
    map.trees.forEach(([tx, ty], i) => {
      const x = (tx + 0.5) * cell;
      const z = (ty + 0.5) * cell;
      const s = 0.85 + rng() * 0.45;
      m4.compose(v3.set(x, 1.3 * s, z), q4.identity(), s3.set(s, s, s));
      trunks.setMatrixAt(i, m4);
      if (rng() < 0.55) {
        // Sapin : deux cones empiles.
        for (let k = 0; k < 2; k++) {
          euler.set(0, rng() * 3, 0);
          q4.setFromEuler(euler);
          const ks = s * (1 - k * 0.28);
          m4.compose(v3.set(x, (2.6 + k * 1.3) * s, z), q4, s3.set(ks, ks, ks));
          pines.setMatrixAt(pi++, m4);
        }
      } else {
        euler.set(rng() * 3, rng() * 3, rng() * 3);
        q4.setFromEuler(euler);
        m4.compose(v3.set(x, 3.2 * s, z), q4, s3.set(s * 1.1, s, s * 1.1));
        leaves.setMatrixAt(li++, m4);
      }
    });
    pines.count = pi;
    leaves.count = li;
    group.add(trunks, pines, leaves);
  }

  // --- Caissons techniques (Arene) : coffre sombre avec un liseré lumineux ---
  if (caissons.length > 0) {
    const bodyMat = keep(new THREE.MeshLambertMaterial({ color: 0x39424d }));
    const glowMat = keep(new THREE.MeshBasicMaterial({ color: 0x4fd8ff }));
    const bodyGeo = keep(new THREE.BoxGeometry(0.95, 0.55, 0.6));
    const glowGeo = keep(new THREE.BoxGeometry(0.97, 0.035, 0.62));
    const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, caissons.length);
    const glows = new THREE.InstancedMesh(glowGeo, glowMat, caissons.length);
    caissons.forEach((spot, i) => {
      const p = place(spot, 0.2);
      euler.set(0, (spot.dx !== 0 ? Math.PI / 2 : 0) + (rng() - 0.5) * 0.15, 0);
      q4.setFromEuler(euler);
      m4.compose(v3.set(p.x, 0.275, p.z), q4, s3.set(1, 1, 1));
      bodies.setMatrixAt(i, m4);
      m4.compose(v3.set(p.x, 0.5, p.z), q4, s3.set(1, 1, 1));
      glows.setMatrixAt(i, m4);
      addBlob(p.x, p.z, 1.3, 0.9, spot.dx !== 0 ? Math.PI / 2 : 0);
    });
    group.add(bodies, glows);
  }

  // --- Buissons (ile) ---
  if (buissons.length > 0) {
    const mat = keep(new THREE.MeshLambertMaterial({ color: 0x7d7a3e, flatShading: true }));
    const geo = keep(new THREE.IcosahedronGeometry(0.3, 0));
    const mesh = new THREE.InstancedMesh(geo, mat, buissons.length * 3);
    let i = 0;
    for (const spot of buissons) {
      const p = place(spot, 0.22);
      for (let k = 0; k < 3; k++) {
        euler.set(rng() * 3, rng() * 3, rng() * 3);
        q4.setFromEuler(euler);
        const sc = 0.55 + rng() * 0.5;
        m4.compose(v3.set(p.x + (rng() - 0.5) * 0.4, 0.14 * sc, p.z + (rng() - 0.5) * 0.4), q4, s3.set(sc, sc * 0.75, sc));
        mesh.setMatrixAt(i++, m4);
      }
    }
    group.add(mesh);
  }

  // --- Ombres de contact des accessoires ---
  if (blobs.length > 0) {
    const tex = keep(makeBlobTexture());
    const mat = keep(
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        alphaMap: tex,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    const geo = keep(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
    const mesh = new THREE.InstancedMesh(geo, mat, blobs.length);
    blobs.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.renderOrder = 1;
    group.add(mesh);
  }

  // --- Habillage des murs et du plafond ---
  // Tout ce qui est accroche aux murs reste soit tres plat (panneaux), soit
  // au-dessus des tetes (neons, tuyaux, poutres) : jamais un faux couvert.
  type Face = { x: number; z: number; nx: number; nz: number };
  const faces: Face[] = [];
  const openCells: [number, number][] = [];
  for (let y = 1; y < map.height - 1; y++) {
    for (let x = 1; x < map.width - 1; x++) {
      if (isSolid(x, y)) continue;
      openCells.push([x, y]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (!isSolid(x + dx, y + dy)) continue;
        // Les caisses ne portent pas de decor mural.
        if (crateCells.has(`${x + dx},${y + dy}`)) continue;
        faces.push({ x: (x + 0.5 + dx * 0.5) * cell, z: (y + 0.5 + dy * 0.5) * cell, nx: -dx, nz: -dy });
      }
    }
  }
  const pick = <T,>(list: T[], chance: number) => list.filter(() => rng() < chance);
  /** Pose contre une face : decale vers la piece, tourne le long du mur. */
  const onFace = (mesh: THREE.InstancedMesh, i: number, f: Face, y: number, out: number, sx = 1, sy = 1, sz = 1) => {
    euler.set(0, Math.atan2(f.nx, f.nz), 0);
    q4.setFromEuler(euler);
    m4.compose(v3.set(f.x + f.nx * out, y, f.z + f.nz * out), q4, s3.set(sx, sy, sz));
    mesh.setMatrixAt(i, m4);
  };

  if (map.theme === "arene") {
    // Bandeaux lumineux en haut des murs, et panneaux de controle.
    const strips = pick(faces, 0.45);
    const stripMesh = new THREE.InstancedMesh(
      keep(new THREE.BoxGeometry(cell * 0.82, 0.06, 0.04)),
      keep(new THREE.MeshBasicMaterial({ color: 0x54dcff })),
      Math.max(1, strips.length),
    );
    strips.forEach((f, i) => onFace(stripMesh, i, f, wallHeight - 0.45, 0.02));
    stripMesh.count = strips.length;
    const panels = pick(faces, 0.12);
    const panelMesh = new THREE.InstancedMesh(
      keep(new THREE.BoxGeometry(0.8, 1.05, 0.05)),
      keep(new THREE.MeshLambertMaterial({ color: 0x1f262e })),
      Math.max(1, panels.length),
    );
    const screenMesh = new THREE.InstancedMesh(
      keep(new THREE.BoxGeometry(0.6, 0.34, 0.012)),
      keep(new THREE.MeshBasicMaterial({ color: 0x2aa6c9 })),
      Math.max(1, panels.length),
    );
    const ledMesh = new THREE.InstancedMesh(
      keep(new THREE.BoxGeometry(0.05, 0.05, 0.02)),
      keep(new THREE.MeshBasicMaterial({ color: 0x7dff9a })),
      Math.max(1, panels.length * 3),
    );
    let li = 0;
    panels.forEach((f, i) => {
      onFace(panelMesh, i, f, 1.55, 0.03);
      onFace(screenMesh, i, f, 1.72, 0.06);
      for (let k = 0; k < 3; k++) {
        const along = (k - 1) * 0.14;
        euler.set(0, Math.atan2(f.nx, f.nz), 0);
        q4.setFromEuler(euler);
        // Le long du mur : la tangente est (nz, -nx).
        m4.compose(v3.set(f.x + f.nx * 0.065 + f.nz * along, 1.3, f.z + f.nz * 0.065 - f.nx * along), q4, s3.set(1, 1, 1));
        ledMesh.setMatrixAt(li++, m4);
      }
    });
    panelMesh.count = panels.length;
    screenMesh.count = panels.length;
    ledMesh.count = li;
    group.add(stripMesh, panelMesh, screenMesh, ledMesh);
  }

  if (map.theme === "entrepot") {
    // Tuyaux le long des murs, extincteurs, et lampes industrielles suspendues.
    const pipes = pick(faces, 0.55);
    const pipeMesh = new THREE.InstancedMesh(
      keep(new THREE.CylinderGeometry(0.07, 0.07, cell, 8)),
      keep(new THREE.MeshLambertMaterial({ color: 0x6d7a6b })),
      Math.max(1, pipes.length),
    );
    pipes.forEach((f, i) => {
      // Cylindre couche le long du mur.
      euler.set(0, Math.atan2(f.nx, f.nz), Math.PI / 2);
      q4.setFromEuler(euler);
      m4.compose(v3.set(f.x + f.nx * 0.12, wallHeight - 0.35, f.z + f.nz * 0.12), q4, s3.set(1, 1, 1));
      pipeMesh.setMatrixAt(i, m4);
    });
    pipeMesh.count = pipes.length;
    const ext = pick(faces, 0.07);
    const extMesh = new THREE.InstancedMesh(
      keep(new THREE.CylinderGeometry(0.09, 0.09, 0.46, 10)),
      keep(new THREE.MeshLambertMaterial({ color: 0xc0281c })),
      Math.max(1, ext.length),
    );
    ext.forEach((f, i) => onFace(extMesh, i, f, 1.0, 0.11));
    extMesh.count = ext.length;
    group.add(pipeMesh, extMesh);
  }

  if (map.theme === "gouffre") {
    // Etais de mine en bois contre la roche, et ampoules nues.
    const posts = pick(faces, 0.22);
    const postMesh = new THREE.InstancedMesh(
      keep(new THREE.BoxGeometry(0.2, wallHeight, 0.2)),
      keep(new THREE.MeshLambertMaterial({ color: 0x5a4028 })),
      Math.max(1, posts.length),
    );
    const beamMesh = new THREE.InstancedMesh(
      keep(new THREE.BoxGeometry(cell, 0.2, 0.2)),
      keep(new THREE.MeshLambertMaterial({ color: 0x4c3620 })),
      Math.max(1, posts.length),
    );
    posts.forEach((f, i) => {
      onFace(postMesh, i, f, wallHeight / 2, 0.1);
      onFace(beamMesh, i, f, wallHeight - 0.12, 0.1);
    });
    postMesh.count = posts.length;
    beamMesh.count = posts.length;
    group.add(postMesh, beamMesh);
  }

  if (map.theme === "entrepot" || map.theme === "gouffre") {
    // Lampes suspendues au-dessus des passages.
    const lampCells = openCells.filter(([x, y]) => (x * 7 + y * 13) % 6 === 0);
    const cableMesh = new THREE.InstancedMesh(
      keep(new THREE.BoxGeometry(0.02, 0.7, 0.02)),
      keep(new THREE.MeshLambertMaterial({ color: 0x1b1a18 })),
      Math.max(1, lampCells.length),
    );
    const shadeMesh = new THREE.InstancedMesh(
      keep(new THREE.ConeGeometry(0.3, 0.22, 10, 1, true)),
      keep(new THREE.MeshLambertMaterial({ color: 0x3a3f3a, side: THREE.DoubleSide })),
      Math.max(1, lampCells.length),
    );
    const bulbMesh = new THREE.InstancedMesh(
      keep(new THREE.SphereGeometry(0.09, 8, 6)),
      keep(new THREE.MeshBasicMaterial({ color: map.theme === "entrepot" ? 0xfff2cc : 0xffc070 })),
      Math.max(1, lampCells.length),
    );
    lampCells.forEach(([x, y], i) => {
      const cx = (x + 0.5) * cell;
      const cz = (y + 0.5) * cell;
      m4.makeTranslation(cx, wallHeight - 0.35, cz);
      cableMesh.setMatrixAt(i, m4);
      m4.makeTranslation(cx, wallHeight - 0.75, cz);
      shadeMesh.setMatrixAt(i, m4);
      m4.makeTranslation(cx, wallHeight - 0.84, cz);
      bulbMesh.setMatrixAt(i, m4);
    });
    cableMesh.count = lampCells.length;
    shadeMesh.count = lampCells.length;
    bulbMesh.count = lampCells.length;
    group.add(cableMesh, shadeMesh, bulbMesh);
  }

  // --- Poussiere : toute une ville du desert autour de la grille ---
  if (map.theme === "poussiere") {
    const town = keep(buildDesertTown(map, cell, wallHeight));
    group.add(town.group);
  }

  return {
    group,
    dispose() {
      for (const o of owned) o.dispose();
    },
  };
}

// ---------------------------------------------------------------------------
// Geometries
// ---------------------------------------------------------------------------

/**
 * Caisse unite (1 m) : un cube un peu en retrait et douze montants en relief
 * sur les aretes. Les montants prennent le bois de la bande de bord de la
 * texture (14 px a gauche), le fil dans leur longueur.
 */
function crateGeometry(): THREE.BufferGeometry {
  const t = 0.075;
  const e = 0.5 - t / 2;
  const parts: THREE.BufferGeometry[] = [new THREE.BoxGeometry(0.94, 0.94, 0.94)];
  const batten = (sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
    const g = new THREE.BoxGeometry(sx, sy, sz);
    const pos = g.getAttribute("position");
    const uv = g.getAttribute("uv");
    const long = sx >= sy && sx >= sz ? 0 : sy >= sz ? 1 : 2;
    const size = [sx, sy, sz];
    for (let i = 0; i < pos.count; i++) {
      const c = [pos.getX(i), pos.getY(i), pos.getZ(i)];
      const s = c[long] / size[long];
      const across = (c[(long + 1) % 3] + c[(long + 2) % 3]) / (t * 2);
      uv.setXY(i, 0.012 + (across * 0.5 + 0.5) * 0.032, 0.5 + s * 0.98);
    }
    g.translate(x, y, z);
    parts.push(g);
  };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) batten(t, 1, t, sx * e, 0, sz * e);
  for (const sy of [-1, 1]) {
    for (const sz of [-1, 1]) batten(1 - 2 * t, t, t, 0, sy * e, sz * e);
    for (const sx of [-1, 1]) batten(t, t, 1 - 2 * t, sx * e, sy * e, 0);
  }
  const merged = mergeGeometries(parts, false)!;
  for (const p of parts) p.dispose();
  return merged;
}

/** Fut de 200 litres : profil tourne avec deux bourrelets de roulement et un couvercle en retrait. */
function barrelGeometry(): THREE.BufferGeometry {
  const pts = [
    [0, 0],
    [0.265, 0],
    [0.285, 0.015],
    [0.285, 0.17],
    [0.298, 0.18],
    [0.298, 0.2],
    [0.285, 0.21],
    [0.285, 0.44],
    [0.298, 0.45],
    [0.298, 0.47],
    [0.285, 0.48],
    [0.285, 0.7],
    [0.298, 0.71],
    [0.298, 0.73],
    [0.285, 0.74],
    [0.285, 0.865],
    [0.27, 0.88],
    [0.25, 0.88],
    [0.25, 0.868],
    [0, 0.868],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(pts, 18);
}

/** Palette 1,2 x 0,8 m : cinq planches sur trois longerons, 14 cm de haut. */
function palletGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 5; k++) parts.push(new THREE.BoxGeometry(1.2, 0.025, 0.13).translate(0, 0.1275, -0.335 + k * 0.1675));
  for (const z of [-0.34, 0, 0.34]) parts.push(new THREE.BoxGeometry(1.2, 0.09, 0.09).translate(0, 0.07, z));
  for (const z of [-0.33, 0.33]) parts.push(new THREE.BoxGeometry(1.2, 0.025, 0.13).translate(0, 0.0125, z));
  const merged = mergeGeometries(parts, false)!;
  for (const p of parts) p.dispose();
  return merged;
}

/** Rocher : icosaedre subdivise, bossele par un tirage fixe. */
function rockGeometry(rng: () => number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(0.42, 1);
  const pos = geo.getAttribute("position");
  // Meme bosse pour les sommets confondus : on tire par position arrondie.
  const bumps = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    let k = bumps.get(key);
    if (k === undefined) {
      k = 0.78 + rng() * 0.4;
      bumps.set(key, k);
    }
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Disque flou (ombre de contact), en niveaux de gris pour un alphaMap. */
function makeBlobTexture(): THREE.CanvasTexture {
  const S = 64;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.55, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(canvas);
}
