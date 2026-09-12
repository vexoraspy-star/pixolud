import * as THREE from "three";

/**
 * Les retours visuels du Duel : impacts, sang, douilles, traceurs.
 *
 * Dans un jeu de tir, l'information la plus importante n'est pas « j'ai
 * appuye » mais « qu'est-ce que j'ai touche ». Avant, un tir produisait un
 * trait blanc identique qu'il parte dans un mur ou dans un adversaire. Ici
 * chaque impact a sa matiere : etincelles orange sur le beton, gerbe rouge
 * sur un corps.
 *
 * Tout est mutualise : quatre appels de rendu au total, quel que soit le
 * nombre de balles en l'air. Un systeme par effet en aurait coute des
 * dizaines.
 */

const SPARK_COUNT = 260;
const DEBRIS_COUNT = 200;
const CASING_COUNT = 24;
const TRACER_COUNT = 16;

interface Particle {
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  gravity: number;
  r: number;
  g: number;
  b: number;
}

function makePool(count: number): Particle[] {
  return Array.from({ length: count }, () => ({
    vx: 0,
    vy: 0,
    vz: 0,
    life: 0,
    maxLife: 1,
    gravity: 0,
    r: 1,
    g: 1,
    b: 1,
  }));
}

export interface DuelEffects {
  /** Etincelles chaudes : beton, metal, ricochets. */
  sparks(x: number, y: number, z: number, count?: number, tint?: [number, number, number]): void;
  /** Gerbe de sang : uniquement sur un corps touche. */
  blood(x: number, y: number, z: number, count?: number): void;
  /** Douille ejectee sur le cote, qui rebondit au sol. */
  casing(x: number, y: number, z: number, yaw: number): void;
  /** Trait de balle, efface tout seul. */
  tracer(from: THREE.Vector3, to: THREE.Vector3, color: number, thin?: boolean): void;
  update(delta: number): void;
  dispose(): void;
}

export function createDuelEffects(scene: THREE.Scene): DuelEffects {
  const owned: (THREE.BufferGeometry | THREE.Material)[] = [];

  // --- Etincelles : melange additif, elles brillent dans la penombre ---
  const sparkPool = makePool(SPARK_COUNT);
  const sparkPos = new Float32Array(SPARK_COUNT * 3);
  const sparkCol = new Float32Array(SPARK_COUNT * 3);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute("color", new THREE.BufferAttribute(sparkCol, 3));
  const sparkMat = new THREE.PointsMaterial({
    size: 0.07,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  owned.push(sparkGeo, sparkMat);
  const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
  sparkPoints.frustumCulled = false;
  scene.add(sparkPoints);

  // --- Debris et sang : melange normal, sinon le rouge vire au rose fluo ---
  const debrisPool = makePool(DEBRIS_COUNT);
  const debrisPos = new Float32Array(DEBRIS_COUNT * 3);
  const debrisCol = new Float32Array(DEBRIS_COUNT * 3);
  const debrisGeo = new THREE.BufferGeometry();
  debrisGeo.setAttribute("position", new THREE.BufferAttribute(debrisPos, 3));
  debrisGeo.setAttribute("color", new THREE.BufferAttribute(debrisCol, 3));
  const debrisMat = new THREE.PointsMaterial({
    size: 0.085,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  owned.push(debrisGeo, debrisMat);
  const debrisPoints = new THREE.Points(debrisGeo, debrisMat);
  debrisPoints.frustumCulled = false;
  scene.add(debrisPoints);

  // Les particules mortes sont renvoyees tres loin sous la carte : c'est
  // moins couteux que de redimensionner le tampon a chaque image.
  const BURIED = -999;
  for (let i = 0; i < SPARK_COUNT; i++) sparkPos[i * 3 + 1] = BURIED;
  for (let i = 0; i < DEBRIS_COUNT; i++) debrisPos[i * 3 + 1] = BURIED;

  // --- Douilles : petits cylindres laiton qui tombent et roulent ---
  const casingGeo = new THREE.CylinderGeometry(0.017, 0.017, 0.055, 5);
  const casingMat = new THREE.MeshLambertMaterial({ color: 0xc9a227 });
  owned.push(casingGeo, casingMat);
  const casingMesh = new THREE.InstancedMesh(casingGeo, casingMat, CASING_COUNT);
  casingMesh.frustumCulled = false;
  casingMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(casingMesh);
  const casings = Array.from({ length: CASING_COUNT }, () => ({
    x: 0,
    y: BURIED,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    spin: 0,
    rot: 0,
    life: 0,
  }));
  let casingCursor = 0;

  // --- Traceurs : une seule boite instanciee, orientee par balle ---
  const tracerGeo = new THREE.BoxGeometry(1, 1, 1);
  const tracerMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  owned.push(tracerGeo, tracerMat);
  const tracerMesh = new THREE.InstancedMesh(tracerGeo, tracerMat, TRACER_COUNT);
  tracerMesh.frustumCulled = false;
  tracerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // instanceColor permet a chaque arme d'avoir la couleur de traceur definie
  // dans sa fiche, sans multiplier les materiaux.
  tracerMesh.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(TRACER_COUNT * 3).fill(1),
    3,
  );
  scene.add(tracerMesh);
  const tracers = Array.from({ length: TRACER_COUNT }, () => ({
    life: 0,
    maxLife: 0.06,
  }));
  const tracerMatrices = Array.from({ length: TRACER_COUNT }, () => new THREE.Matrix4());
  let tracerCursor = 0;

  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < TRACER_COUNT; i++) tracerMesh.setMatrixAt(i, hidden);
  for (let i = 0; i < CASING_COUNT; i++) casingMesh.setMatrixAt(i, hidden);
  tracerMesh.instanceMatrix.needsUpdate = true;
  casingMesh.instanceMatrix.needsUpdate = true;

  /** Trouve une particule libre, sinon recycle la plus avancee. */
  function grab(pool: Particle[]): number {
    let oldest = 0;
    let oldestRatio = -1;
    for (let i = 0; i < pool.length; i++) {
      if (pool[i].life <= 0) return i;
      const ratio = 1 - pool[i].life / pool[i].maxLife;
      if (ratio > oldestRatio) {
        oldestRatio = ratio;
        oldest = i;
      }
    }
    return oldest;
  }

  function emit(
    pool: Particle[],
    pos: Float32Array,
    col: Float32Array,
    x: number,
    y: number,
    z: number,
    count: number,
    speed: number,
    gravity: number,
    life: number,
    r: number,
    g: number,
    b: number,
  ) {
    for (let n = 0; n < count; n++) {
      const i = grab(pool);
      const p = pool[i];
      // Direction uniforme sur la sphere, puis vitesse aleatoire.
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const s = speed * (0.35 + Math.random() * 0.65);
      p.vx = Math.sin(phi) * Math.cos(theta) * s;
      p.vy = Math.abs(Math.cos(phi)) * s * 0.9;
      p.vz = Math.sin(phi) * Math.sin(theta) * s;
      p.gravity = gravity;
      p.maxLife = life * (0.6 + Math.random() * 0.7);
      p.life = p.maxLife;
      p.r = r;
      p.g = g;
      p.b = b;
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      col[i * 3] = r;
      col[i * 3 + 1] = g;
      col[i * 3 + 2] = b;
    }
  }

  function step(pool: Particle[], pos: Float32Array, col: Float32Array, delta: number) {
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      if (p.life <= 0) continue;
      p.life -= delta;
      if (p.life <= 0) {
        pos[i * 3 + 1] = BURIED;
        continue;
      }
      p.vy -= p.gravity * delta;
      pos[i * 3] += p.vx * delta;
      pos[i * 3 + 1] += p.vy * delta;
      pos[i * 3 + 2] += p.vz * delta;
      // Rebond mou au sol plutot qu'une disparition sous le plancher.
      if (pos[i * 3 + 1] < 0.02 && p.vy < 0) {
        pos[i * 3 + 1] = 0.02;
        p.vy *= -0.28;
        p.vx *= 0.6;
        p.vz *= 0.6;
      }
      // L'extinction passe par la couleur : pas d'alpha par particule en
      // PointsMaterial, mais une couleur qui tend vers le noir marche pour
      // l'additif comme pour le normal sur fond sombre.
      const k = p.life / p.maxLife;
      col[i * 3] = p.r * k;
      col[i * 3 + 1] = p.g * k;
      col[i * 3 + 2] = p.b * k;
    }
  }

  // Objets de travail reutilises a chaque image : allouer un Vector3 par
  // particule et par image ferait travailler le ramasse-miettes en plein jeu.
  const tmpQuat = new THREE.Quaternion();
  const tmpPos = new THREE.Vector3();
  const tmpScale = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();
  const FORWARD = new THREE.Vector3(0, 0, 1);
  const scratch = new THREE.Matrix4();
  const tmpEuler = new THREE.Euler();
  const tmpColor = new THREE.Color();

  return {
    sparks(x, y, z, count = 14, tint) {
      const [r, g, b] = tint ?? [1, 0.78, 0.36];
      emit(sparkPool, sparkPos, sparkCol, x, y, z, count, 3.4, 7, 0.32, r, g, b);
      // Un peu de poussiere grise part avec : ca donne de la matiere au mur.
      emit(debrisPool, debrisPos, debrisCol, x, y, z, Math.ceil(count / 3), 1.6, 5, 0.5, 0.42, 0.4, 0.38);
    },
    blood(x, y, z, count = 18) {
      emit(debrisPool, debrisPos, debrisCol, x, y, z, count, 2.6, 9, 0.6, 0.72, 0.06, 0.07);
      // Quelques eclats sombres, plus lents, qui retombent : la difference
      // entre « une tache rouge » et « quelque chose a ete arrache ».
      emit(debrisPool, debrisPos, debrisCol, x, y, z, Math.ceil(count / 3), 1.3, 11, 0.9, 0.34, 0.03, 0.04);
    },
    casing(x, y, z, yaw) {
      const c = casings[casingCursor];
      casingCursor = (casingCursor + 1) % CASING_COUNT;
      c.x = x;
      c.y = y;
      c.z = z;
      // Ejectee vers la droite de l'arme, avec un peu de hauteur.
      const right = yaw - Math.PI / 2;
      c.vx = Math.sin(right) * (1.5 + Math.random() * 0.9);
      c.vz = Math.cos(right) * (1.5 + Math.random() * 0.9);
      c.vy = 1.6 + Math.random() * 0.8;
      c.spin = 12 + Math.random() * 14;
      c.rot = Math.random() * Math.PI;
      c.life = 2.4;
    },
    tracer(from, to, color, thin = false) {
      const i = tracerCursor;
      tracerCursor = (tracerCursor + 1) % TRACER_COUNT;
      const len = from.distanceTo(to);
      if (len < 0.05) return;
      tmpDir.subVectors(to, from).normalize();
      tmpQuat.setFromUnitVectors(FORWARD, tmpDir);
      tmpPos.copy(from).lerp(to, 0.5);
      const w = thin ? 0.016 : 0.03;
      tmpScale.set(w, w, len);
      tracerMatrices[i].compose(tmpPos, tmpQuat, tmpScale);
      tracerMesh.setMatrixAt(i, tracerMatrices[i]);
      tmpColor.setHex(color);
      tracerMesh.instanceColor!.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
      tracerMesh.instanceColor!.needsUpdate = true;
      tracers[i].maxLife = thin ? 0.09 : 0.055;
      tracers[i].life = tracers[i].maxLife;
      tracerMesh.instanceMatrix.needsUpdate = true;
    },
    update(delta) {
      step(sparkPool, sparkPos, sparkCol, delta);
      step(debrisPool, debrisPos, debrisCol, delta);
      sparkGeo.attributes.position.needsUpdate = true;
      sparkGeo.attributes.color.needsUpdate = true;
      debrisGeo.attributes.position.needsUpdate = true;
      debrisGeo.attributes.color.needsUpdate = true;

      let casingsDirty = false;
      for (let i = 0; i < CASING_COUNT; i++) {
        const c = casings[i];
        if (c.life <= 0) continue;
        c.life -= delta;
        c.vy -= 11 * delta;
        c.x += c.vx * delta;
        c.y += c.vy * delta;
        c.z += c.vz * delta;
        c.rot += c.spin * delta;
        if (c.y < 0.02) {
          c.y = 0.02;
          c.vy *= -0.3;
          c.vx *= 0.55;
          c.vz *= 0.55;
          c.spin *= 0.5;
        }
        tmpPos.set(c.x, c.y, c.z);
        tmpEuler.set(c.rot, c.rot * 0.7, 0);
        tmpQuat.setFromEuler(tmpEuler);
        tmpScale.set(1, 1, 1);
        scratch.compose(tmpPos, tmpQuat, tmpScale);
        casingMesh.setMatrixAt(i, c.life > 0 ? scratch : hidden);
        casingsDirty = true;
      }
      if (casingsDirty) casingMesh.instanceMatrix.needsUpdate = true;

      let tracersDirty = false;
      for (let i = 0; i < TRACER_COUNT; i++) {
        const t = tracers[i];
        if (t.life <= 0) continue;
        t.life -= delta;
        if (t.life <= 0) {
          tracerMesh.setMatrixAt(i, hidden);
          tracersDirty = true;
        }
      }
      if (tracersDirty) tracerMesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      scene.remove(sparkPoints);
      scene.remove(debrisPoints);
      scene.remove(casingMesh);
      scene.remove(tracerMesh);
      for (const o of owned) o.dispose();
    },
  };
}
