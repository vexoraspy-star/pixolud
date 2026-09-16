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
 * Tout est instancie : une carte entierement decoree coute une quinzaine d'appels de
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
  caissons: number;
  buissons: number;
  /** Teinte des bidons (l'Arene est plus technique que rouillee). */
  barilColor: number;
}

const THEME_PROPS: Record<DuelTheme, ThemeProps> = {
  arene: { every: 6, barils: 0.35, sacs: 0, palettes: 0, rochers: 0, caissons: 0.65, buissons: 0, barilColor: 0x6d7681 },
  entrepot: { every: 5, barils: 0.35, sacs: 0.1, palettes: 0.5, rochers: 0, caissons: 0.1, buissons: 0, barilColor: 0xb5793a },
  gouffre: { every: 6, barils: 0.2, sacs: 0.15, palettes: 0.1, rochers: 0.55, caissons: 0, buissons: 0, barilColor: 0x7a6a52 },
  poussiere: { every: 4, barils: 0.3, sacs: 0.35, palettes: 0.2, rochers: 0.05, caissons: 0, buissons: 0.3, barilColor: 0xb5793a },
  ile: { every: 9, barils: 0.25, sacs: 0.15, palettes: 0.3, rochers: 0.1, caissons: 0, buissons: 0.4, barilColor: 0x4f7fb5 },
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
    });
    group.add(bodies, glows);
  }

  // --- Buissons secs (Poussiere) ---
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
        if (map.crates.some(([cx, cy]) => cx === x + dx && cy === y + dy)) continue;
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

  if (map.theme === "entrepot" || map.theme === "gouffre" || map.theme === "poussiere") {
    // Lampes suspendues (ou lanternes) au-dessus des passages.
    const lampCells = openCells.filter(([x, y]) => (x * 7 + y * 13) % (map.theme === "poussiere" ? 11 : 6) === 0);
    const cableMesh = new THREE.InstancedMesh(
      keep(new THREE.BoxGeometry(0.02, 0.7, 0.02)),
      keep(new THREE.MeshLambertMaterial({ color: 0x1b1a18 })),
      Math.max(1, lampCells.length),
    );
    const shadeMesh = new THREE.InstancedMesh(
      keep(new THREE.ConeGeometry(0.3, 0.22, 10, 1, true)),
      keep(new THREE.MeshLambertMaterial({ color: map.theme === "poussiere" ? 0x6a4a2a : 0x3a3f3a, side: THREE.DoubleSide })),
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
    // Poussiere se joue dehors : pas de cables au ciel, seulement les lanternes
    // accrochees aux poutres.
    if (map.theme !== "poussiere") group.add(cableMesh, shadeMesh, bulbMesh);
  }

  if (map.theme === "poussiere") {
    // Poutres qui depassent du haut des murs, et auvents de toile.
    const beams = pick(faces, 0.3);
    const beamMesh = new THREE.InstancedMesh(
      keep(new THREE.BoxGeometry(0.16, 0.16, 0.9)),
      keep(new THREE.MeshLambertMaterial({ color: 0x6b4a2c })),
      Math.max(1, beams.length * 2),
    );
    let bi = 0;
    for (const f of beams) {
      for (const along of [-0.45, 0.45]) {
        euler.set(0, Math.atan2(f.nx, f.nz), 0);
        q4.setFromEuler(euler);
        m4.compose(
          v3.set(f.x + f.nx * 0.45 + f.nz * along, wallHeight - 0.25, f.z + f.nz * 0.45 - f.nx * along),
          q4,
          s3.set(1, 1, 1),
        );
        beamMesh.setMatrixAt(bi++, m4);
      }
    }
    beamMesh.count = bi;
    const awnings = pick(faces, 0.12);
    const awningMesh = new THREE.InstancedMesh(
      keep(new THREE.BoxGeometry(cell * 0.9, 0.04, 1.0)),
      keep(new THREE.MeshLambertMaterial({ color: 0xb4452f })),
      Math.max(1, awnings.length),
    );
    awnings.forEach((f, i) => {
      euler.set(0, Math.atan2(f.nx, f.nz), 0);
      const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.35);
      q4.setFromEuler(euler).multiply(tilt);
      m4.compose(v3.set(f.x + f.nx * 0.5, wallHeight - 0.7, f.z + f.nz * 0.5), q4, s3.set(1, 1, 1));
      awningMesh.setMatrixAt(i, m4);
    });
    awningMesh.count = awnings.length;
    group.add(beamMesh, awningMesh);
  }

  return {
    group,
    dispose() {
      for (const o of owned) o.dispose();
    },
  };
}
