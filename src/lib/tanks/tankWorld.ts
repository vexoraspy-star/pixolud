import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { HEIGHT_STEP, WATER_LEVEL, WORLD_HALF, BASE_RADIUS, type TankMap } from "./tankTerrain";
import {
  makeGroundDetailTexture,
  makeRoofTexture,
  makeSkyTexture,
  makeWallTexture,
  paintTerrainTexture,
} from "./tankTextures";

// Le decor de « Tonnerre d'Acier » en maillages three.js : terrain, lac,
// village, fermes, murets, rochers, arbres, buissons, bases et ciel.
// Peu d'appels de rendu : tout ce qui se repete est instancie, les murs et
// les toits de tous les batiments sont fusionnes par materiau.

export interface TankWorld {
  group: THREE.Group;
  /** Se resout quand l'image du sol est entierement peinte (par tranches). */
  ready: Promise<void>;
  /** Couche un arbre dans la direction (dx, dz). */
  fellTree: (index: number, dx: number, dz: number) => void;
  /** Arbre deja couche (on passe dessus). */
  treeDown: (index: number) => boolean;
  /** Anime les arbres qui tombent et les drapeaux. */
  update: (dt: number, time: number) => void;
  dispose: () => void;
}

/** Tons du drapeau de chaque equipe (joueur : vert, adversaire : rouge). */
export const TEAM_COLORS = [0x3fbf5a, 0xd94141];

export function buildTankWorld(map: TankMap, detail: boolean): TankWorld {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(o: T): T => {
    disposables.push(o);
    return o;
  };

  // --- Terrain ---
  // Un sommet tous les deux pas de la grille des hauteurs (5 m).
  const stride = 2;
  const segs = Math.floor((map.hn - 1) / stride);
  const size = segs * stride * HEIGHT_STEP;
  const terrainGeo = keep(new THREE.PlaneGeometry(size, size, segs, segs));
  terrainGeo.rotateX(-Math.PI / 2);
  const tp = terrainGeo.getAttribute("position");
  const tuv = terrainGeo.getAttribute("uv");
  for (let k = 0; k < tp.count; k++) {
    const x = tp.getX(k);
    const z = tp.getZ(k);
    const i = Math.round((x + WORLD_HALF) / HEIGHT_STEP);
    const j = Math.round((z + WORLD_HALF) / HEIGHT_STEP);
    tp.setY(k, map.heights[Math.min(map.hn - 1, j) * map.hn + Math.min(map.hn - 1, i)]);
    // La texture couvre tout le monde : v vers le sud comme sur le canvas.
    tuv.setXY(k, (x + WORLD_HALF) / (WORLD_HALF * 2), 1 - (z + WORLD_HALF) / (WORLD_HALF * 2));
  }
  terrainGeo.computeVertexNormals();
  const terrainPaint = paintTerrainTexture(map, detail ? 2048 : 1536);
  const terrainTex = keep(terrainPaint.texture);
  terrainTex.flipY = true;
  const groundDetail = keep(makeGroundDetailTexture());
  const terrainMat = keep(new THREE.MeshLambertMaterial({ map: terrainTex }));
  // Detail vu de pres : un carreau de 4 m qui module la couleur, qui s'efface au loin.
  terrainMat.onBeforeCompile = (shader) => {
    shader.uniforms.uDetail = { value: groundDetail };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTkWorld;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvTkWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform sampler2D uDetail;\nvarying vec3 vTkWorld;")
      .replace(
        "#include <map_fragment>",
        [
          "#include <map_fragment>",
          "float tkDist = length(vTkWorld - cameraPosition);",
          "float tkFade = 1.0 - smoothstep(25.0, 110.0, tkDist);",
          "float tkD = texture2D(uDetail, vTkWorld.xz * 0.25).r * 1.25;",
          "float tkD2 = texture2D(uDetail, vTkWorld.xz * 0.043).r * 1.25;",
          "diffuseColor.rgb *= mix(1.0, tkD, tkFade) * mix(1.0, tkD2, 0.5);",
        ].join("\n"),
      );
  };
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.receiveShadow = true;
  group.add(terrain);

  // --- Le lac ---
  const waterGeo = keep(new THREE.CircleGeometry(map.lake.r + 14, 40));
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = keep(
    new THREE.MeshLambertMaterial({ color: 0x3f6f78, transparent: true, opacity: 0.86, emissive: 0x0b1a1e }),
  );
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.set(map.lake.x, WATER_LEVEL, map.lake.z);
  group.add(water);

  // --- Batiments : murs crepis, murs de pierre, toits de tuiles ---
  const plaster: THREE.BufferGeometry[] = [];
  const stone: THREE.BufferGeometry[] = [];
  const roofs: THREE.BufferGeometry[] = [];
  const dark: THREE.BufferGeometry[] = [];
  for (const h of map.houses) {
    const wallGeo = new THREE.BoxGeometry(h.w, h.h + 1.5, h.d);
    // Carreaux de texture de 4 m sur 3,2 m : une fenetre par carreau.
    const uv = wallGeo.getAttribute("uv");
    const nrm = wallGeo.getAttribute("normal");
    for (let k = 0; k < uv.count; k++) {
      const alongX = Math.abs(nrm.getZ(k)) > 0.5;
      const span = alongX ? h.w : h.d;
      uv.setXY(k, uv.getX(k) * Math.max(1, Math.round(span / 4)), uv.getY(k) * Math.max(1, Math.round((h.h + 1.5) / 3.2)));
    }
    wallGeo.translate(h.x, h.y - 1.5 + (h.h + 1.5) / 2, h.z);
    (h.kind === 0 ? plaster : stone).push(wallGeo);
    if (h.kind === 3) {
      // Clocher : baies sombres en haut et petit toit pointu.
      for (const [dx, dz] of [
        [0, h.d / 2],
        [0, -h.d / 2],
        [h.w / 2, 0],
        [-h.w / 2, 0],
      ]) {
        const bay = new THREE.BoxGeometry(dx ? 0.1 : 1.6, 2.6, dz ? 0.1 : 1.6);
        bay.translate(h.x + dx * 1.01, h.y + h.h - 2.4, h.z + dz * 1.01);
        dark.push(bay);
      }
      const spire = new THREE.ConeGeometry(h.w * 0.78, 4.2, 4);
      spire.rotateY(Math.PI / 4);
      spire.translate(h.x, h.y + h.h + 2.1, h.z);
      roofs.push(spire);
      continue;
    }
    // Toit a deux pans, un peu debordant.
    const ridge = h.kind === 2 ? 3.6 : 2.2;
    const long = h.ridgeX ? h.w + 0.8 : h.d + 0.8;
    const wide = (h.ridgeX ? h.d : h.w) / 2 + 0.5;
    const shape = new THREE.Shape();
    shape.moveTo(-wide, 0);
    shape.lineTo(wide, 0);
    shape.lineTo(0, ridge);
    shape.lineTo(-wide, 0);
    const roof = new THREE.ExtrudeGeometry(shape, { depth: long, bevelEnabled: false });
    roof.translate(0, 0, -long / 2);
    if (h.ridgeX) roof.rotateY(Math.PI / 2);
    // Tuiles : coordonnees a l'echelle du metre.
    const ruv = roof.getAttribute("uv");
    for (let k = 0; k < ruv.count; k++) ruv.setXY(k, ruv.getX(k) * 0.35, ruv.getY(k) * 0.35);
    roof.translate(h.x, h.y + h.h, h.z);
    roofs.push(roof);
    // Porte sombre sur une facade.
    const door = new THREE.BoxGeometry(h.ridgeX ? 1.3 : 0.1, 2.2, h.ridgeX ? 0.1 : 1.3);
    door.translate(h.x + (h.ridgeX ? 0 : h.w / 2 + 0.02), h.y + 1.1, h.z + (h.ridgeX ? h.d / 2 + 0.02 : 0));
    dark.push(door);
  }
  // Murets de pierre.
  for (const w of map.walls) {
    const len = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
    const steps = Math.ceil(len / 6);
    for (let s = 0; s < steps; s++) {
      const t0 = s / steps;
      const t1 = (s + 1) / steps;
      const x0 = w.x0 + (w.x1 - w.x0) * t0;
      const z0 = w.z0 + (w.z1 - w.z0) * t0;
      const x1 = w.x0 + (w.x1 - w.x0) * t1;
      const z1 = w.z0 + (w.z1 - w.z0) * t1;
      const seg = new THREE.BoxGeometry(0.7, w.h + 0.6, Math.hypot(x1 - x0, z1 - z0) + 0.1);
      seg.rotateY(Math.atan2(x1 - x0, z1 - z0));
      const mx = (x0 + x1) / 2;
      const mz = (z0 + z1) / 2;
      const y = heightAtWorld(map, mx, mz);
      seg.translate(mx, y + (w.h + 0.6) / 2 - 0.5, mz);
      stone.push(seg);
    }
  }
  const mergeTo = (list: THREE.BufferGeometry[], mat: THREE.Material, shadow: boolean) => {
    if (list.length === 0) return;
    const clean = list.map((g) => {
      const n = g.index ? g.toNonIndexed() : g;
      if (n !== g) g.dispose();
      return n;
    });
    const merged = keep(mergeGeometries(clean, false)!);
    for (const g of clean) g.dispose();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  mergeTo(plaster, keep(new THREE.MeshLambertMaterial({ map: keep(makeWallTexture(false, 3)) })), true);
  mergeTo(stone, keep(new THREE.MeshLambertMaterial({ map: keep(makeWallTexture(true, 5)) })), true);
  mergeTo(roofs, keep(new THREE.MeshLambertMaterial({ map: keep(makeRoofTexture()) })), true);
  mergeTo(dark, keep(new THREE.MeshLambertMaterial({ color: 0x241f1b })), false);

  // --- Rochers ---
  const rockGeo = keep(new THREE.IcosahedronGeometry(1, 1));
  {
    const p = rockGeo.getAttribute("position");
    for (let k = 0; k < p.count; k++) {
      const s = 0.82 + Math.abs(Math.sin(k * 12.9898) * 43758.5453) % 0.36;
      p.setXYZ(k, p.getX(k) * s, p.getY(k) * s * 0.75, p.getZ(k) * s);
    }
    rockGeo.computeVertexNormals();
  }
  const rockMat = keep(new THREE.MeshLambertMaterial({ color: 0xb8b0a2, flatShading: true }));
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, Math.max(1, map.rocks.length));
  const m4 = new THREE.Matrix4();
  const q4 = new THREE.Quaternion();
  const e3 = new THREE.Euler();
  const v3 = new THREE.Vector3();
  const s3 = new THREE.Vector3();
  const tint = new THREE.Color();
  map.rocks.forEach((r, i) => {
    e3.set(0, (i * 1.7) % 6.28, 0);
    q4.setFromEuler(e3);
    m4.compose(v3.set(r.x, r.y - r.r * 0.2, r.z), q4, s3.set(r.r, r.r * 0.9, r.r * 1.1));
    rocks.setMatrixAt(i, m4);
    // Calcaire gris, plus ou moins sombre et un peu dore selon le rocher.
    rocks.setColorAt(i, tint.setHSL(0.1, 0.05 + (i % 5) * 0.015, 0.42 + (i % 7) * 0.035));
  });
  rocks.count = map.rocks.length;
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  group.add(rocks);

  // --- Arbres : un tronc commun, trois feuillages (olivier, cypres, pin parasol) ---
  const trunkGeo = keep(new THREE.CylinderGeometry(0.16, 0.3, 1, 7));
  trunkGeo.translate(0, 0.5, 0);
  const trunkMat = keep(new THREE.MeshLambertMaterial({ color: 0x5f4a36 }));
  const foliage: THREE.BufferGeometry[] = [];
  // Olivier : trois masses gris-vert, basses et larges.
  {
    const parts: THREE.BufferGeometry[] = [];
    for (const [x, y, z, s] of [
      [0, 3.1, 0, 1.9],
      [1.1, 2.7, 0.4, 1.3],
      [-0.9, 2.8, -0.5, 1.4],
    ]) {
      const b = new THREE.IcosahedronGeometry(s, 1);
      b.scale(1, 0.72, 1);
      b.translate(x, y, z);
      parts.push(b);
    }
    foliage.push(keep(mergeGeometries(parts, false)!));
    for (const p of parts) p.dispose();
  }
  // Cypres : un fuseau sombre et haut.
  {
    const g = new THREE.CylinderGeometry(0.1, 1.05, 9, 9, 4);
    const p = g.getAttribute("position");
    for (let k = 0; k < p.count; k++) {
      const y = p.getY(k);
      const bulge = Math.sin(((y + 4.5) / 9) * Math.PI) * 0.35;
      p.setX(k, p.getX(k) * (1 + bulge));
      p.setZ(k, p.getZ(k) * (1 + bulge));
    }
    g.translate(0, 5.5, 0);
    g.computeVertexNormals();
    foliage.push(keep(g));
  }
  // Pin parasol : un large plateau en haut d'un long fut.
  {
    const parts: THREE.BufferGeometry[] = [];
    const top = new THREE.IcosahedronGeometry(3.2, 1);
    top.scale(1, 0.36, 1);
    top.translate(0, 8.4, 0);
    parts.push(top);
    const side = new THREE.IcosahedronGeometry(1.8, 1);
    side.scale(1, 0.4, 1);
    side.translate(1.6, 7.8, 0.8);
    parts.push(side);
    foliage.push(keep(mergeGeometries(parts, false)!));
    for (const p of parts) p.dispose();
  }
  const foliageMats = [
    keep(new THREE.MeshLambertMaterial({ color: 0x7c8c5c, flatShading: true })),
    keep(new THREE.MeshLambertMaterial({ color: 0x2f4a2c, flatShading: true })),
    keep(new THREE.MeshLambertMaterial({ color: 0x486a38, flatShading: true })),
  ];
  const trunkHeight = [2.2, 1.4, 7.6];
  const trees = map.trees;
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, Math.max(1, trees.length));
  const counts = [0, 0, 0];
  for (const t of trees) counts[t.kind]++;
  const crowns = foliage.map((g, k) => new THREE.InstancedMesh(g, foliageMats[k], Math.max(1, counts[k])));
  /** Pour chaque arbre : son indice dans le maillage de son feuillage. */
  const crownIndex = new Int32Array(trees.length);
  const used = [0, 0, 0];
  const qFall = new THREE.Quaternion();
  const axisX = new THREE.Vector3(1, 0, 0);
  const treeMatrix = (i: number, fall: number, dirYaw: number, crown: boolean) => {
    const t = trees[i];
    // Couche autour de sa base, dans la direction de la poussee.
    e3.set(0, dirYaw, 0);
    q4.setFromEuler(e3);
    qFall.setFromAxisAngle(axisX, fall);
    q4.multiply(qFall);
    if (crown) m4.compose(v3.set(t.x, t.y - 0.2, t.z), q4, s3.set(t.scale, t.scale, t.scale));
    else m4.compose(v3.set(t.x, t.y - 0.2, t.z), q4, s3.set(t.scale, trunkHeight[t.kind] * t.scale, t.scale));
    return m4;
  };
  trees.forEach((t, i) => {
    trunks.setMatrixAt(i, treeMatrix(i, 0, (i * 2.3) % 6.28, false));
    const k = used[t.kind]++;
    crownIndex[i] = k;
    crowns[t.kind].setMatrixAt(k, treeMatrix(i, 0, (i * 2.3) % 6.28, true));
    crowns[t.kind].setColorAt(k, tint.setRGB(0.85 + (i % 5) * 0.06, 0.85 + (i % 3) * 0.07, 0.85 + (i % 4) * 0.05));
  });
  trunks.count = trees.length;
  trunks.castShadow = true;
  group.add(trunks);
  for (const cm of crowns) {
    cm.castShadow = true;
    cm.receiveShadow = true;
    if (cm.instanceColor) cm.instanceColor.needsUpdate = true;
    group.add(cm);
  }
  const falling: { i: number; t: number; yaw: number }[] = [];
  const down = new Uint8Array(trees.length);

  // --- Buissons ---
  const bushGeo = keep(new THREE.IcosahedronGeometry(1, 0));
  bushGeo.scale(1, 0.6, 1);
  const bushMat = keep(new THREE.MeshLambertMaterial({ color: 0x566b34, flatShading: true }));
  const bushes = new THREE.InstancedMesh(bushGeo, bushMat, Math.max(1, map.bushes.length));
  map.bushes.forEach((b, i) => {
    e3.set(0, i * 0.9, 0);
    q4.setFromEuler(e3);
    m4.compose(v3.set(b.x, b.y + 0.2 * b.s, b.z), q4, s3.set(b.s * 1.3, b.s, b.s * 1.1));
    bushes.setMatrixAt(i, m4);
  });
  bushes.count = map.bushes.length;
  group.add(bushes);

  // --- Bases : cercle de capture, mats et drapeaux ---
  const flags: THREE.Mesh[] = [];
  map.bases.forEach((b, team) => {
    const y = heightAtWorld(map, b.x, b.z);
    const ringGeo = keep(new THREE.RingGeometry(BASE_RADIUS - 0.8, BASE_RADIUS, 64));
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = keep(
      new THREE.MeshBasicMaterial({ color: TEAM_COLORS[team], transparent: true, opacity: 0.55, depthWrite: false }),
    );
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(b.x, y + 0.12, b.z);
    group.add(ring);
    const poleGeo = keep(new THREE.CylinderGeometry(0.07, 0.09, 9, 8));
    const poleMat = keep(new THREE.MeshLambertMaterial({ color: 0xcfcfcf }));
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(b.x, y + 4.5, b.z);
    pole.castShadow = true;
    group.add(pole);
    const flagGeo = keep(new THREE.PlaneGeometry(2.6, 1.6, 8, 1));
    flagGeo.translate(1.3, 0, 0);
    const flagMat = keep(new THREE.MeshLambertMaterial({ color: TEAM_COLORS[team], side: THREE.DoubleSide }));
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(b.x + 0.08, y + 8.1, b.z);
    group.add(flag);
    flags.push(flag);
  });

  // --- Ciel ---
  const skyTex = keep(makeSkyTexture());
  const skyGeo = keep(new THREE.SphereGeometry(1400, 32, 16));
  const skyMat = keep(new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.renderOrder = -1;
  group.add(sky);

  return {
    group,
    ready: terrainPaint.ready,
    fellTree: (index, dx, dz) => {
      if (index < 0 || index >= trees.length || down[index]) return;
      down[index] = 1;
      // Le cap vers lequel il tombe : l'axe x tourne, l'arbre bascule vers +z local.
      falling.push({ i: index, t: 0, yaw: Math.atan2(dx, dz) });
    },
    treeDown: (index) => down[index] === 1,
    update: (dt, time) => {
      for (let k = falling.length - 1; k >= 0; k--) {
        const f = falling[k];
        f.t = Math.min(1, f.t + dt * 1.1);
        // Chute acceleree, qui finit couchee sur le sol.
        const angle = (f.t * f.t * Math.PI) / 2.15;
        trunks.setMatrixAt(f.i, treeMatrix(f.i, angle, f.yaw, false));
        const t = trees[f.i];
        crowns[t.kind].setMatrixAt(crownIndex[f.i], treeMatrix(f.i, angle, f.yaw, true));
        trunks.instanceMatrix.needsUpdate = true;
        crowns[t.kind].instanceMatrix.needsUpdate = true;
        if (f.t >= 1) falling.splice(k, 1);
      }
      for (let k = 0; k < flags.length; k++) {
        flags[k].rotation.y = Math.sin(time * 1.3 + k) * 0.35;
      }
      sky.rotation.y = time * 0.002;
    },
    dispose: () => {
      for (const d of disposables) d.dispose();
      rocks.dispose();
      trunks.dispose();
      for (const c of crowns) c.dispose();
      bushes.dispose();
    },
  };
}

function heightAtWorld(map: TankMap, x: number, z: number): number {
  const fx = (x + WORLD_HALF) / HEIGHT_STEP;
  const fz = (z + WORLD_HALF) / HEIGHT_STEP;
  const i = Math.max(0, Math.min(map.hn - 2, Math.floor(fx)));
  const j = Math.max(0, Math.min(map.hn - 2, Math.floor(fz)));
  const u = fx - i;
  const v = fz - j;
  const h = map.heights;
  const n = map.hn;
  return (
    h[j * n + i] * (1 - u) * (1 - v) + h[j * n + i + 1] * u * (1 - v) + h[(j + 1) * n + i] * (1 - u) * v + h[(j + 1) * n + i + 1] * u * v
  );
}
