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
 * Tout est mutualise : cinq appels de rendu au total, quel que soit le
 * nombre de balles en l'air. Un systeme par effet en aurait coute des
 * dizaines.
 */

const SPARK_COUNT = 260;
const DEBRIS_COUNT = 200;
const CASING_COUNT = 24;
const TRACER_COUNT = 16;
const SMOKE_COUNT = 48;
/** Grosses volutes sombres d'une explosion de grenade. */
const BILLOW_COUNT = 40;

/** Allure d'une douille : laiton court, laiton long (fusils), ou cartouche de chasse rouge. */
export type CasingKind = "laiton" | "long" | "coque";

const CASING_LOOK: Record<CasingKind, { color: number; rad: number; len: number }> = {
  laiton: { color: 0xc9a227, rad: 1, len: 1 },
  long: { color: 0xd1a93c, rad: 0.95, len: 1.6 },
  coque: { color: 0xa82a20, rad: 1.3, len: 1.25 },
};

export interface DuelEffectsOptions {
  /** Premier rebond d'une douille au sol : c'est la que la scene joue le tintement. */
  onCasingBounce?: (kind: CasingKind) => void;
}

/** Bouffee de fumee : un disque doux, dessine au canvas. */
function makeSmokeTexture(): THREE.CanvasTexture {
  const S = 32;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.45, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

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
  /**
   * Douille ejectee de la fenetre de l'arme, avec sa vitesse de depart (deja
   * additionnee de celle du tireur) ; elle rebondit au sol puis s'efface.
   */
  casing(x: number, y: number, z: number, vx: number, vy: number, vz: number, kind?: CasingKind): void;
  /** Filet de fumee qui s'echappe du canon apres une rafale. */
  smoke(x: number, y: number, z: number): void;
  /** Trait de balle, efface tout seul. */
  tracer(from: THREE.Vector3, to: THREE.Vector3, color: number, thin?: boolean): void;
  /** Boule de feu de roquette : elle gonfle, palit et disparait. */
  explosion(x: number, y: number, z: number, radius: number): void;
  /** Eclats d'un panneau de construction brise. */
  shatter(x: number, y: number, z: number): void;
  /** Grenade : boule de feu, eclats, terre projetee et volutes de fumee noire. */
  grenadeBlast(x: number, y: number, z: number): void;
  update(delta: number): void;
  dispose(): void;
}

export function createDuelEffects(scene: THREE.Scene, options: DuelEffectsOptions = {}): DuelEffects {
  const owned: { dispose(): void }[] = [];

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

  // --- Douilles : petits cylindres (laiton, ou rouges pour le fusil a pompe)
  // qui tombent et roulent. La couleur passe par instanceColor : un seul
  // appel de rendu pour toutes.
  const casingGeo = new THREE.CylinderGeometry(0.017, 0.017, 0.055, 5);
  const casingMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  owned.push(casingGeo, casingMat);
  const casingMesh = new THREE.InstancedMesh(casingGeo, casingMat, CASING_COUNT);
  casingMesh.frustumCulled = false;
  casingMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  casingMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CASING_COUNT * 3).fill(1), 3);
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
    kind: "laiton" as CasingKind,
    /** Le premier contact avec le sol a deja sonne. */
    bounced: false,
  }));
  let casingCursor = 0;

  // --- Fumee du canon : des disques doux, gris, qui montent et palissent ---
  // Couleur a quatre composantes : l'alpha de chaque bouffee baisse seul.
  const smokePos = new Float32Array(SMOKE_COUNT * 3);
  const smokeCol = new Float32Array(SMOKE_COUNT * 4);
  const smokeGeo = new THREE.BufferGeometry();
  smokeGeo.setAttribute("position", new THREE.BufferAttribute(smokePos, 3));
  smokeGeo.setAttribute("color", new THREE.BufferAttribute(smokeCol, 4));
  const smokeTex = makeSmokeTexture();
  const smokeMat = new THREE.PointsMaterial({
    size: 0.13,
    map: smokeTex,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  });
  owned.push(smokeGeo, smokeMat, smokeTex);
  const smokePoints = new THREE.Points(smokeGeo, smokeMat);
  smokePoints.frustumCulled = false;
  scene.add(smokePoints);
  const smokes = Array.from({ length: SMOKE_COUNT }, () => ({
    vx: 0,
    vy: 0,
    vz: 0,
    life: 0,
    maxLife: 1,
    alpha: 0,
    gray: 0.8,
  }));
  let smokeCursor = 0;
  for (let i = 0; i < SMOKE_COUNT; i++) smokePos[i * 3 + 1] = BURIED;

  // --- Volutes d'explosion : memes disques doux, en beaucoup plus gros ---
  const billowPos = new Float32Array(BILLOW_COUNT * 3);
  const billowCol = new Float32Array(BILLOW_COUNT * 4);
  const billowGeo = new THREE.BufferGeometry();
  billowGeo.setAttribute("position", new THREE.BufferAttribute(billowPos, 3));
  billowGeo.setAttribute("color", new THREE.BufferAttribute(billowCol, 4));
  const billowMat = new THREE.PointsMaterial({
    size: 1.7,
    map: smokeTex,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  });
  owned.push(billowGeo, billowMat);
  const billowPoints = new THREE.Points(billowGeo, billowMat);
  billowPoints.frustumCulled = false;
  scene.add(billowPoints);
  const billows = Array.from({ length: BILLOW_COUNT }, () => ({
    vx: 0,
    vy: 0,
    vz: 0,
    life: 0,
    maxLife: 1,
    alpha: 0,
    gray: 0.3,
  }));
  let billowCursor = 0;
  for (let i = 0; i < BILLOW_COUNT; i++) billowPos[i * 3 + 1] = BURIED;

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

  // --- Explosions : quatre boules de feu recyclees, en melange additif ---
  const BLAST_COUNT = 4;
  const blastGeo = new THREE.SphereGeometry(1, 16, 12);
  owned.push(blastGeo);
  const blasts = Array.from({ length: BLAST_COUNT }, () => {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffa640,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    owned.push(mat);
    const mesh = new THREE.Mesh(blastGeo, mat);
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, mat, life: 0, maxLife: 0.5, radius: 1 };
  });
  let blastCursor = 0;

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
    casing(x, y, z, vx, vy, vz, kind = "laiton") {
      const i = casingCursor;
      const c = casings[i];
      casingCursor = (casingCursor + 1) % CASING_COUNT;
      c.x = x;
      c.y = y;
      c.z = z;
      c.vx = vx;
      c.vy = vy;
      c.vz = vz;
      c.spin = 12 + Math.random() * 14;
      c.rot = Math.random() * Math.PI;
      c.life = 2.4;
      c.kind = kind;
      c.bounced = false;
      tmpColor.setHex(CASING_LOOK[kind].color);
      casingMesh.instanceColor!.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
      casingMesh.instanceColor!.needsUpdate = true;
    },
    smoke(x, y, z) {
      const i = smokeCursor;
      const s = smokes[i];
      smokeCursor = (smokeCursor + 1) % SMOKE_COUNT;
      smokePos[i * 3] = x + (Math.random() - 0.5) * 0.03;
      smokePos[i * 3 + 1] = y;
      smokePos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.03;
      s.vx = (Math.random() - 0.5) * 0.16;
      s.vz = (Math.random() - 0.5) * 0.16;
      s.vy = 0.18 + Math.random() * 0.14;
      s.maxLife = 0.9 + Math.random() * 0.45;
      s.life = s.maxLife;
      s.alpha = 0.2 + Math.random() * 0.1;
      s.gray = 0.74 + Math.random() * 0.12;
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
    explosion(x, y, z, radius) {
      const b = blasts[blastCursor];
      blastCursor = (blastCursor + 1) % BLAST_COUNT;
      b.mesh.position.set(x, y, z);
      b.radius = radius;
      b.life = b.maxLife;
      b.mesh.visible = true;
      emit(sparkPool, sparkPos, sparkCol, x, y, z, 70, 9, 6, 0.55, 1, 0.62, 0.22);
      emit(debrisPool, debrisPos, debrisCol, x, y, z, 45, 4.5, 4, 1.1, 0.3, 0.28, 0.27);
    },
    shatter(x, y, z) {
      emit(debrisPool, debrisPos, debrisCol, x, y, z, 34, 3.2, 9, 0.9, 0.62, 0.46, 0.28);
      emit(sparkPool, sparkPos, sparkCol, x, y, z, 12, 3, 6, 0.3, 0.9, 0.8, 0.6);
    },
    grenadeBlast(x, y, z) {
      const b = blasts[blastCursor];
      blastCursor = (blastCursor + 1) % BLAST_COUNT;
      b.mesh.position.set(x, y, z);
      b.radius = 2.4;
      b.life = b.maxLife;
      b.mesh.visible = true;
      // Eclats brulants, puis metal sombre et terre qui retombent.
      emit(sparkPool, sparkPos, sparkCol, x, y, z, 90, 11, 7, 0.5, 1, 0.66, 0.26);
      emit(debrisPool, debrisPos, debrisCol, x, y, z, 50, 8, 12, 1, 0.2, 0.19, 0.18);
      emit(debrisPool, debrisPos, debrisCol, x, y, z, 30, 4, 10, 1.3, 0.36, 0.3, 0.22);
      // Volutes noires qui montent et s'etalent.
      for (let n = 0; n < 12; n++) {
        const i = billowCursor;
        const s = billows[i];
        billowCursor = (billowCursor + 1) % BILLOW_COUNT;
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 0.9;
        billowPos[i * 3] = x + Math.cos(a) * r;
        billowPos[i * 3 + 1] = y + Math.random() * 0.8;
        billowPos[i * 3 + 2] = z + Math.sin(a) * r;
        s.vx = Math.cos(a) * (0.6 + Math.random() * 1.2);
        s.vz = Math.sin(a) * (0.6 + Math.random() * 1.2);
        s.vy = 0.5 + Math.random() * 0.9;
        s.maxLife = 1.6 + Math.random() * 1.2;
        s.life = s.maxLife;
        s.alpha = 0.55 + Math.random() * 0.2;
        s.gray = 0.18 + Math.random() * 0.14;
      }
    },
    update(delta) {
      for (const b of blasts) {
        if (b.life <= 0) continue;
        b.life -= delta;
        if (b.life <= 0) {
          b.mesh.visible = false;
          continue;
        }
        const k = 1 - b.life / b.maxLife;
        b.mesh.scale.setScalar(b.radius * (0.35 + 0.75 * Math.sqrt(k)));
        b.mat.opacity = 0.95 * (1 - k);
        b.mat.color.setRGB(1, 0.75 - k * 0.45, 0.35 - k * 0.3);
      }
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
          // Le premier vrai choc contre le sol fait tinter la douille.
          if (!c.bounced && c.vy < -0.6) {
            c.bounced = true;
            options.onCasingBounce?.(c.kind);
          }
          c.y = 0.02;
          c.vy *= -0.3;
          c.vx *= 0.55;
          c.vz *= 0.55;
          c.spin *= 0.5;
        }
        tmpPos.set(c.x, c.y, c.z);
        tmpEuler.set(c.rot, c.rot * 0.7, 0);
        tmpQuat.setFromEuler(tmpEuler);
        // Elle retrecit ses derniers instants au lieu de disparaitre d'un coup.
        const look = CASING_LOOK[c.kind];
        const fade = Math.min(1, c.life / 0.25);
        tmpScale.set(look.rad * fade, look.len * fade, look.rad * fade);
        scratch.compose(tmpPos, tmpQuat, tmpScale);
        casingMesh.setMatrixAt(i, c.life > 0 ? scratch : hidden);
        casingsDirty = true;
      }
      if (casingsDirty) casingMesh.instanceMatrix.needsUpdate = true;

      let smokeDirty = false;
      for (let i = 0; i < SMOKE_COUNT; i++) {
        const s = smokes[i];
        if (s.life <= 0) continue;
        smokeDirty = true;
        s.life -= delta;
        if (s.life <= 0) {
          smokePos[i * 3 + 1] = BURIED;
          smokeCol[i * 4 + 3] = 0;
          continue;
        }
        // La fumee chaude monte de plus en plus vite, freinee par l'air.
        s.vy += 0.12 * delta;
        const drag = Math.max(0, 1 - delta * 0.9);
        s.vx *= drag;
        s.vz *= drag;
        smokePos[i * 3] += s.vx * delta;
        smokePos[i * 3 + 1] += s.vy * delta;
        smokePos[i * 3 + 2] += s.vz * delta;
        const age = s.maxLife - s.life;
        const k = s.life / s.maxLife;
        smokeCol[i * 4] = s.gray;
        smokeCol[i * 4 + 1] = s.gray;
        smokeCol[i * 4 + 2] = s.gray;
        smokeCol[i * 4 + 3] = s.alpha * k * Math.min(1, age / 0.06);
      }
      if (smokeDirty) {
        smokeGeo.attributes.position.needsUpdate = true;
        smokeGeo.attributes.color.needsUpdate = true;
      }

      let billowDirty = false;
      for (let i = 0; i < BILLOW_COUNT; i++) {
        const s = billows[i];
        if (s.life <= 0) continue;
        billowDirty = true;
        s.life -= delta;
        if (s.life <= 0) {
          billowPos[i * 3 + 1] = BURIED;
          billowCol[i * 4 + 3] = 0;
          continue;
        }
        // Le souffle les pousse, l'air les freine, la chaleur les fait monter.
        const drag = Math.max(0, 1 - delta * 1.6);
        s.vx *= drag;
        s.vz *= drag;
        s.vy = s.vy * drag + 0.25 * delta;
        billowPos[i * 3] += s.vx * delta;
        billowPos[i * 3 + 1] += s.vy * delta;
        billowPos[i * 3 + 2] += s.vz * delta;
        const age = s.maxLife - s.life;
        const k = s.life / s.maxLife;
        billowCol[i * 4] = s.gray;
        billowCol[i * 4 + 1] = s.gray;
        billowCol[i * 4 + 2] = s.gray;
        billowCol[i * 4 + 3] = s.alpha * k * Math.min(1, age / 0.12);
      }
      if (billowDirty) {
        billowGeo.attributes.position.needsUpdate = true;
        billowGeo.attributes.color.needsUpdate = true;
      }

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
      scene.remove(smokePoints);
      scene.remove(billowPoints);
      scene.remove(tracerMesh);
      for (const b of blasts) scene.remove(b.mesh);
      for (const o of owned) o.dispose();
    },
  };
}
