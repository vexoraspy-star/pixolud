import * as THREE from "three";

/**
 * Les cinq poupees de porcelaine de la quete secondaire.
 *
 * Deux choix de mise en scene, et un choix technique :
 *
 *  - Elles sont ASSISES, poupees posees au sol et non objets flottants qui
 *    tournent : on doit hesiter une seconde avant de comprendre que c'est
 *    ce qu'on cherche.
 *  - Leur tete SUIT le joueur quand il passe pres d'elles. Lentement, et
 *    seulement quand il ne regarde pas droit dessus.
 *  - Toutes les pieces sont instanciees : cinq poupees de quatre morceaux
 *    auraient coute vingt appels de rendu, elles en coutent quatre.
 */

export interface DollSpot {
  x: number;
  z: number;
  /** Hauteur du sol sous la poupee (l'etage est a UPPER_Y). */
  floorY: number;
}

export interface Dolls {
  group: THREE.Group;
  /** A appeler a chaque image. Renvoie rien : les matrices sont mises a jour. */
  update(params: {
    playerX: number;
    playerZ: number;
    /** Direction du regard du joueur, pour savoir s'il regarde la poupee. */
    lookX: number;
    lookZ: number;
    time: number;
  }): void;
  /** Fait disparaitre une poupee ramassee. */
  hide(index: number): void;
  dispose(): void;
}

const PORCELAIN = 0xe6ddd0;
const DRESS = 0x6b1f2a;
const HAIR = 0x2a1a12;

export function buildDolls(spots: DollSpot[], cellSize: number): Dolls {
  const group = new THREE.Group();
  const n = spots.length;

  const dressGeo = new THREE.ConeGeometry(0.15, 0.3, 8);
  const headGeo = new THREE.SphereGeometry(0.085, 12, 10);
  const hairGeo = new THREE.SphereGeometry(0.092, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const eyeGeo = new THREE.SphereGeometry(0.013, 6, 6);

  const dressMat = new THREE.MeshLambertMaterial({ color: DRESS });
  const headMat = new THREE.MeshLambertMaterial({ color: PORCELAIN });
  const hairMat = new THREE.MeshLambertMaterial({ color: HAIR });
  // Yeux noirs et brillants, non eclaires : on les voit meme quand la lampe
  // ne passe pas dessus, ce qui fait tout.
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x050303 });

  const dresses = new THREE.InstancedMesh(dressGeo, dressMat, n);
  const heads = new THREE.InstancedMesh(headGeo, headMat, n);
  const hairs = new THREE.InstancedMesh(hairGeo, hairMat, n);
  const eyes = new THREE.InstancedMesh(eyeGeo, eyeMat, n * 2);
  for (const mesh of [dresses, heads, hairs, eyes]) {
    // Les instances bougent : la sphere englobante calculee au depart ne
    // suffirait pas, et les poupees disparaitraient au bord de l'ecran.
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  /** Lacet de chaque tete, lisse d'une image a l'autre. */
  const headYaw = spots.map((_, i) => (i * 1.7) % (Math.PI * 2));
  /** Lacet du corps, fixe : chaque poupee regarde ailleurs au depart. */
  const bodyYaw = spots.map((_, i) => (i * 2.3) % (Math.PI * 2));
  const hidden = spots.map(() => false);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const zero = new THREE.Vector3(0, 0, 0);
  // Reutilise a chaque image : dix allocations par image pour les yeux,
  // c'est du travail inutile pour le ramasse-miettes.
  const local = new THREE.Vector3();

  function writeInstance(i: number) {
    const s = spots[i];
    const baseX = s.x * cellSize;
    const baseZ = s.z * cellSize;

    if (hidden[i]) {
      m.compose(pos.set(baseX, -10, baseZ), q.identity(), zero);
      dresses.setMatrixAt(i, m);
      heads.setMatrixAt(i, m);
      hairs.setMatrixAt(i, m);
      eyes.setMatrixAt(i * 2, m);
      eyes.setMatrixAt(i * 2 + 1, m);
      return;
    }

    // Corps assis : la robe repose sur le sol.
    e.set(0, bodyYaw[i], 0);
    q.setFromEuler(e);
    m.compose(pos.set(baseX, s.floorY + 0.15, baseZ), q, scl.set(1, 1, 1));
    dresses.setMatrixAt(i, m);

    // Tete : legerement penchee sur le cote, et tournee vers son lacet.
    const headY = s.floorY + 0.36;
    e.set(0.12, headYaw[i], 0.22);
    q.setFromEuler(e);
    m.compose(pos.set(baseX, headY, baseZ), q, scl.set(1, 1, 1));
    heads.setMatrixAt(i, m);
    m.compose(pos.set(baseX, headY + 0.012, baseZ), q, scl.set(1, 1, 1));
    hairs.setMatrixAt(i, m);

    // Les yeux suivent la tete : on les place dans son repere local.
    for (const side of [-1, 1]) {
      local.set(side * 0.03, 0.01, 0.078).applyQuaternion(q);
      m.compose(pos.set(baseX + local.x, headY + local.y, baseZ + local.z), q, scl.set(1, 1, 1));
      eyes.setMatrixAt(i * 2 + (side < 0 ? 0 : 1), m);
    }
  }

  for (let i = 0; i < n; i++) writeInstance(i);

  return {
    group,
    update({ playerX, playerZ, lookX, lookZ, time }) {
      for (let i = 0; i < n; i++) {
        if (hidden[i]) continue;
        const dx = playerX - spots[i].x;
        const dz = playerZ - spots[i].z;
        const dist = Math.hypot(dx, dz);
        let target = headYaw[i];
        if (dist < 6) {
          // Est-ce que le joueur regarde la poupee ? Si oui, elle ne bouge
          // pas. Elle ne tourne la tete que dans son dos.
          const toDollX = -dx / (dist || 1);
          const toDollZ = -dz / (dist || 1);
          const watched = toDollX * lookX + toDollZ * lookZ > 0.82;
          if (!watched) target = Math.atan2(dx, dz);
        } else {
          // Au repos, un balancement a peine perceptible.
          target = headYaw[i] + Math.sin(time * 0.4 + i) * 0.002;
        }
        let diff = target - headYaw[i];
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        headYaw[i] += diff * 0.035;
        writeInstance(i);
      }
      dresses.instanceMatrix.needsUpdate = true;
      heads.instanceMatrix.needsUpdate = true;
      hairs.instanceMatrix.needsUpdate = true;
      eyes.instanceMatrix.needsUpdate = true;
    },
    hide(index: number) {
      if (index < 0 || index >= n) return;
      hidden[index] = true;
      writeInstance(index);
      dresses.instanceMatrix.needsUpdate = true;
      heads.instanceMatrix.needsUpdate = true;
      hairs.instanceMatrix.needsUpdate = true;
      eyes.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      for (const g of [dressGeo, headGeo, hairGeo, eyeGeo]) g.dispose();
      for (const mat of [dressMat, headMat, hairMat, eyeMat]) mat.dispose();
    },
  };
}
