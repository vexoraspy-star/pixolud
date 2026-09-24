import * as THREE from "three";
import { block } from "./voxel";
import { createCrackTexture, tileAverageColor } from "./voxelTextures";

/**
 * Retours visuels de Cubes : eclats de bloc, fissures sur le bloc qu'on
 * casse, poussiere et fumee d'explosion. Tout est pre-alloue (un seul maillage
 * instancie pour les eclats) : rien n'est cree pendant la partie.
 */

export interface VoxelEffects {
  /** Un bloc vient de casser : une gerbe d'eclats de sa couleur. */
  burst(x: number, y: number, z: number, blockId: number, count?: number): void;
  /** Petits eclats pendant qu'on creuse (a appeler de temps en temps). */
  chip(x: number, y: number, z: number, blockId: number): void;
  /** Explosion : fumee grise et eclats. */
  explosion(x: number, y: number, z: number, radius: number): void;
  /** Fissures sur le bloc vise (progress 0..1), ou rien (null). */
  crack(x: number, y: number, z: number, progress: number): void;
  hideCrack(): void;
  update(dt: number, brightness: number): void;
  dispose(): void;
}

const MAX = 160;

export function createVoxelEffects(scene: THREE.Scene, solidAt: (x: number, y: number, z: number) => boolean): VoxelEffects {
  // --- Eclats
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const mesh = new THREE.InstancedMesh(geometry, material, MAX);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = MAX;
  scene.add(mesh);
  const px = new Float32Array(MAX);
  const py = new Float32Array(MAX);
  const pz = new Float32Array(MAX);
  const vx = new Float32Array(MAX);
  const vy = new Float32Array(MAX);
  const vz = new Float32Array(MAX);
  const life = new Float32Array(MAX);
  const total = new Float32Array(MAX);
  const size = new Float32Array(MAX);
  /** Fumee : ne tombe pas, grossit et monte. */
  const smoke = new Uint8Array(MAX);
  let next = 0;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const color = new THREE.Color();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < MAX; i++) {
    mesh.setMatrixAt(i, zero);
    mesh.setColorAt(i, color.setRGB(1, 1, 1));
  }

  function spawn(x: number, y: number, z: number, r: number, g: number, b: number, speed: number, lifeS: number, sz: number, isSmoke: boolean) {
    const i = next;
    next = (next + 1) % MAX;
    px[i] = x;
    py[i] = y;
    pz[i] = z;
    const a = Math.random() * Math.PI * 2;
    const h = Math.random();
    vx[i] = Math.cos(a) * speed * (0.4 + Math.random() * 0.6);
    vz[i] = Math.sin(a) * speed * (0.4 + Math.random() * 0.6);
    vy[i] = isSmoke ? 0.6 + h * 0.8 : 2 + h * 3.2;
    life[i] = lifeS * (0.7 + Math.random() * 0.5);
    total[i] = life[i];
    size[i] = sz * (0.7 + Math.random() * 0.6);
    smoke[i] = isSmoke ? 1 : 0;
    mesh.setColorAt(i, color.setRGB(r, g, b));
  }

  function blockColor(id: number): [number, number, number] {
    const [r, g, b] = tileAverageColor(block(id).tiles[1]);
    // L'atlas est en sRGB, les couleurs d'instance en lineaire.
    return [Math.pow(r, 2.2), Math.pow(g, 2.2), Math.pow(b, 2.2)];
  }

  // --- Fissures : un cube a peine plus grand que le bloc, texture en bande.
  const crackTexture = createCrackTexture();
  crackTexture.repeat.set(1 / 8, 1);
  const crackMaterial = new THREE.MeshBasicMaterial({
    map: crackTexture,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.004, 1.004, 1.004), crackMaterial);
  crackMesh.visible = false;
  scene.add(crackMesh);

  return {
    burst(x, y, z, id, count = 14) {
      const [r, g, b] = blockColor(id);
      for (let k = 0; k < count; k++) {
        const t = 0.75 + Math.random() * 0.4;
        spawn(x + 0.2 + Math.random() * 0.6, y + 0.2 + Math.random() * 0.6, z + 0.2 + Math.random() * 0.6, r * t, g * t, b * t, 2.2, 0.8, 0.11, false);
      }
    },
    chip(x, y, z, id) {
      const [r, g, b] = blockColor(id);
      for (let k = 0; k < 2; k++) spawn(x + Math.random(), y + 0.5 + Math.random() * 0.5, z + Math.random(), r, g, b, 1.4, 0.45, 0.07, false);
    },
    explosion(x, y, z, radius) {
      for (let k = 0; k < 26; k++) {
        const g = 0.35 + Math.random() * 0.3;
        spawn(x + (Math.random() - 0.5) * radius, y + (Math.random() - 0.5) * radius, z + (Math.random() - 0.5) * radius, g, g, g, 1.2, 1.3, 0.5, true);
      }
      for (let k = 0; k < 18; k++) spawn(x, y, z, 1, 0.55 + Math.random() * 0.3, 0.15, 6, 0.5, 0.14, false);
    },
    crack(x, y, z, progress) {
      crackMesh.visible = true;
      crackMesh.position.set(x + 0.5, y + 0.5, z + 0.5);
      crackTexture.offset.x = Math.min(7, Math.floor(progress * 8)) / 8;
    },
    hideCrack() {
      crackMesh.visible = false;
    },
    update(dt, brightness) {
      material.color.setScalar(0.25 + 0.75 * brightness);
      let changed = false;
      for (let i = 0; i < MAX; i++) {
        if (life[i] <= 0) continue;
        changed = true;
        life[i] -= dt;
        if (life[i] <= 0) {
          mesh.setMatrixAt(i, zero);
          continue;
        }
        if (smoke[i]) {
          vx[i] *= 1 - dt * 1.5;
          vz[i] *= 1 - dt * 1.5;
        } else {
          vy[i] -= 18 * dt;
        }
        const nx = px[i] + vx[i] * dt;
        const ny = py[i] + vy[i] * dt;
        const nz = pz[i] + vz[i] * dt;
        if (!smoke[i] && solidAt(Math.floor(nx), Math.floor(ny - size[i] / 2), Math.floor(nz))) {
          // Rebond amorti sur le sol, glissade sur les murs.
          if (vy[i] < 0) { vy[i] *= -0.25; vx[i] *= 0.6; vz[i] *= 0.6; }
          else { vx[i] = 0; vz[i] = 0; }
        } else {
          px[i] = nx;
          py[i] = ny;
          pz[i] = nz;
        }
        const k = life[i] / total[i];
        const sc = smoke[i] ? size[i] * (1.6 - k) : size[i] * Math.min(1, k * 2.5);
        p.set(px[i], py[i], pz[i]);
        s.setScalar(sc);
        q.setFromAxisAngle(p.set(0, 1, 0), i * 0.7 + k * 3);
        p.set(px[i], py[i], pz[i]);
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
      }
      if (changed) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    },
    dispose() {
      scene.remove(mesh, crackMesh);
      geometry.dispose();
      material.dispose();
      mesh.dispose();
      crackMesh.geometry.dispose();
      crackMaterial.dispose();
      crackTexture.dispose();
    },
  };
}
