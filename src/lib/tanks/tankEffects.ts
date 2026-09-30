import * as THREE from "three";
import { makeParticleTexture } from "./tankTextures";

// Effets de « Tonnerre d'Acier » : eclair et fumee du canon, poussiere des
// chenilles, gerbes de terre, etincelles, explosions, epaves en feu et
// tracantes des obus.
//
// Toutes les particules vivent dans deux maillages instancies (un additif
// pour le feu et les etincelles, un transparent pour la fumee et la
// poussiere) : quelques centaines de particules, deux appels de rendu.
// Aucune allocation par image.

const CAPACITY = 900;

interface Pool {
  mesh: THREE.Mesh;
  geo: THREE.InstancedBufferGeometry;
  offset: Float32Array;
  scale: Float32Array;
  color: Float32Array;
  rot: Float32Array;
  // Etat de chaque particule.
  px: Float32Array;
  py: Float32Array;
  pz: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  vz: Float32Array;
  age: Float32Array;
  life: Float32Array;
  s0: Float32Array;
  s1: Float32Array;
  r: Float32Array;
  g: Float32Array;
  b: Float32Array;
  a0: Float32Array;
  grav: Float32Array;
  drag: Float32Array;
  spin: Float32Array;
  count: number;
}

const VERT = /* glsl */ `
attribute vec3 iOffset;
attribute float iScale;
attribute vec4 iColor;
attribute float iRot;
varying vec2 vUv;
varying vec4 vColor;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vColor = iColor;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float c = cos(iRot);
  float s = sin(iRot);
  vec2 p = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * iScale;
  vec3 world = iOffset + right * p.x + up * p.y;
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAG = /* glsl */ `
uniform sampler2D map;
varying vec2 vUv;
varying vec4 vColor;
#include <fog_pars_fragment>
void main() {
  vec4 t = texture2D(map, vUv);
  gl_FragColor = vec4(vColor.rgb * t.rgb, t.a * vColor.a);
  if (gl_FragColor.a < 0.004) discard;
  #include <fog_fragment>
}
`;

function makePool(tex: THREE.Texture, additive: boolean): Pool {
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute("position", base.getAttribute("position"));
  geo.setAttribute("uv", base.getAttribute("uv"));
  const offset = new Float32Array(CAPACITY * 3);
  const scale = new Float32Array(CAPACITY);
  const color = new Float32Array(CAPACITY * 4);
  const rot = new Float32Array(CAPACITY);
  geo.setAttribute("iOffset", new THREE.InstancedBufferAttribute(offset, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("iScale", new THREE.InstancedBufferAttribute(scale, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("iColor", new THREE.InstancedBufferAttribute(color, 4).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("iRot", new THREE.InstancedBufferAttribute(rot, 1).setUsage(THREE.DynamicDrawUsage));
  geo.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: tex } }]),
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    fog: !additive,
  });
  mat.uniforms.map.value = tex;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = additive ? 3 : 2;
  const f = () => new Float32Array(CAPACITY);
  return {
    mesh,
    geo,
    offset,
    scale,
    color,
    rot,
    px: f(),
    py: f(),
    pz: f(),
    vx: f(),
    vy: f(),
    vz: f(),
    age: f(),
    life: f(),
    s0: f(),
    s1: f(),
    r: f(),
    g: f(),
    b: f(),
    a0: f(),
    grav: f(),
    drag: f(),
    spin: f(),
    count: 0,
  };
}

function spawn(
  p: Pool,
  x: number,
  y: number,
  z: number,
  vx: number,
  vy: number,
  vz: number,
  life: number,
  s0: number,
  s1: number,
  r: number,
  g: number,
  b: number,
  a0: number,
  grav = 0,
  drag = 0.5,
) {
  if (p.count >= CAPACITY) return;
  const i = p.count++;
  p.px[i] = x;
  p.py[i] = y;
  p.pz[i] = z;
  p.vx[i] = vx;
  p.vy[i] = vy;
  p.vz[i] = vz;
  p.age[i] = 0;
  p.life[i] = life;
  p.s0[i] = s0;
  p.s1[i] = s1;
  p.r[i] = r;
  p.g[i] = g;
  p.b[i] = b;
  p.a0[i] = a0;
  p.grav[i] = grav;
  p.drag[i] = drag;
  p.spin[i] = (Math.random() - 0.5) * 1.2;
  p.rot[i] = Math.random() * Math.PI * 2;
}

function step(p: Pool, dt: number, smoke: boolean) {
  let i = 0;
  while (i < p.count) {
    p.age[i] += dt;
    if (p.age[i] >= p.life[i]) {
      // On remplace la particule morte par la derniere.
      const last = --p.count;
      if (i !== last) {
        p.px[i] = p.px[last];
        p.py[i] = p.py[last];
        p.pz[i] = p.pz[last];
        p.vx[i] = p.vx[last];
        p.vy[i] = p.vy[last];
        p.vz[i] = p.vz[last];
        p.age[i] = p.age[last];
        p.life[i] = p.life[last];
        p.s0[i] = p.s0[last];
        p.s1[i] = p.s1[last];
        p.r[i] = p.r[last];
        p.g[i] = p.g[last];
        p.b[i] = p.b[last];
        p.a0[i] = p.a0[last];
        p.grav[i] = p.grav[last];
        p.drag[i] = p.drag[last];
        p.spin[i] = p.spin[last];
        p.rot[i] = p.rot[last];
      }
      continue;
    }
    const k = Math.max(0, 1 - p.drag[i] * dt);
    p.vx[i] *= k;
    p.vy[i] = p.vy[i] * k - p.grav[i] * dt;
    p.vz[i] *= k;
    p.px[i] += p.vx[i] * dt;
    p.py[i] += p.vy[i] * dt;
    p.pz[i] += p.vz[i] * dt;
    p.rot[i] += p.spin[i] * dt;
    const t = p.age[i] / p.life[i];
    p.offset[i * 3] = p.px[i];
    p.offset[i * 3 + 1] = p.py[i];
    p.offset[i * 3 + 2] = p.pz[i];
    p.scale[i] = p.s0[i] + (p.s1[i] - p.s0[i]) * (smoke ? Math.sqrt(t) : t);
    // Apparition rapide, disparition douce.
    const fade = smoke ? Math.min(1, t * 8) * (1 - t) * (1 - t) : 1 - t * t;
    p.color[i * 4] = p.r[i];
    p.color[i * 4 + 1] = p.g[i];
    p.color[i * 4 + 2] = p.b[i];
    p.color[i * 4 + 3] = p.a0[i] * fade;
    i++;
  }
  p.geo.instanceCount = p.count;
  for (const name of ATTRS) {
    const attr = p.geo.getAttribute(name) as THREE.InstancedBufferAttribute;
    attr.needsUpdate = true;
  }
}

const ATTRS = ["iOffset", "iScale", "iColor", "iRot"] as const;

export interface TankEffects {
  group: THREE.Group;
  /** Tir : eclair, fumee vers l'avant, poussiere soulevee autour. */
  muzzle: (pos: THREE.Vector3, dir: THREE.Vector3, caliber: number, groundY: number) => void;
  /** Impact : dans le sol, sur l'acier (perce ou non), ricochet, sur un mur. */
  impact: (pos: THREE.Vector3, kind: "sol" | "acier" | "ricochet" | "mur" | "perce") => void;
  /** Char detruit : boule de feu, colonne de fumee, eclats. */
  explosion: (pos: THREE.Vector3) => void;
  /** Epave en feu pendant `seconds` secondes. */
  burn: (pos: THREE.Vector3, seconds: number) => void;
  /** Poussiere des chenilles. */
  dust: (x: number, y: number, z: number, amount: number) => void;
  /** Tracantes : a remplir a chaque image entre begin et end. */
  beginTracers: () => void;
  addTracer: (pos: THREE.Vector3, dir: THREE.Vector3) => void;
  endTracers: () => void;
  update: (dt: number) => void;
  dispose: () => void;
}

export function createTankEffects(): TankEffects {
  const group = new THREE.Group();
  const fireTex = makeParticleTexture("feu");
  const smokeTex = makeParticleTexture("fumee");
  const fire = makePool(fireTex, true);
  const smoke = makePool(smokeTex, false);
  group.add(smoke.mesh, fire.mesh);

  // Tracantes : un trait lumineux allonge dans l'axe de l'obus.
  const TRACERS = 48;
  const tracerGeo = new THREE.BoxGeometry(0.09, 0.09, 7);
  tracerGeo.translate(0, 0, -3.5);
  const tracerMat = new THREE.MeshBasicMaterial({
    color: 0xffb35c,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const tracers = new THREE.InstancedMesh(tracerGeo, tracerMat, TRACERS);
  tracers.frustumCulled = false;
  tracers.count = 0;
  group.add(tracers);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const zAxis = new THREE.Vector3(0, 0, 1);
  const one = new THREE.Vector3(1, 1, 1);
  const tmp = new THREE.Vector3();

  const fires: { x: number; y: number; z: number; left: number; acc: number }[] = [];

  const rnd = (a: number) => (Math.random() - 0.5) * a;

  return {
    group,
    muzzle: (pos, dir, caliber, groundY) => {
      const k = Math.min(1.6, caliber / 75);
      // Eclair : trois boules de feu etirees dans l'axe du tube.
      for (let i = 0; i < 4; i++) {
        const d = 0.4 + i * 0.7 * k;
        spawn(fire, pos.x + dir.x * d, pos.y + dir.y * d, pos.z + dir.z * d, dir.x * 3, dir.y * 3, dir.z * 3, 0.09, 1.4 * k, 2.4 * k, 1, 0.8, 0.5, 1);
      }
      // Fumee : un nuage qui part vers l'avant puis s'etale.
      for (let i = 0; i < 12; i++) {
        const sp = 6 + Math.random() * 14;
        spawn(
          smoke,
          pos.x,
          pos.y,
          pos.z,
          dir.x * sp + rnd(4),
          dir.y * sp + rnd(3) + 0.8,
          dir.z * sp + rnd(4),
          1.8 + Math.random() * 1.6,
          0.8 * k,
          (4.5 + Math.random() * 2) * k,
          0.78,
          0.76,
          0.72,
          0.55,
          -0.25,
          2.2,
        );
      }
      // Souffle au sol : la poussiere se souleve en anneau.
      if (pos.y - groundY < 4) {
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          spawn(smoke, pos.x + Math.cos(a) * 1.5, groundY + 0.4, pos.z + Math.sin(a) * 1.5, Math.cos(a) * 7, 0.6, Math.sin(a) * 7, 1.4, 1, 3.5, 0.62, 0.55, 0.42, 0.4, -0.1, 2.5);
        }
      }
    },
    impact: (pos, kind) => {
      if (kind === "sol" || kind === "mur") {
        // Gerbe de terre (ou de platre) et nuage.
        const [r, g, b] = kind === "sol" ? [0.42, 0.34, 0.24] : [0.78, 0.74, 0.66];
        for (let i = 0; i < 14; i++) {
          spawn(smoke, pos.x, pos.y, pos.z, rnd(8), 4 + Math.random() * 9, rnd(8), 1 + Math.random(), 0.5, 2.6, r, g, b, 0.85, 9, 0.6);
        }
        for (let i = 0; i < 6; i++) {
          spawn(smoke, pos.x + rnd(2), pos.y + 0.5, pos.z + rnd(2), rnd(2), 1 + Math.random(), rnd(2), 2.2, 1.5, 4.5, r + 0.1, g + 0.1, b + 0.1, 0.5, -0.1, 1);
        }
        spawn(fire, pos.x, pos.y + 0.3, pos.z, 0, 0, 0, 0.12, 1.2, 2, 1, 0.7, 0.4, 0.8);
        return;
      }
      // Acier : etincelles, plus nombreuses et plus vives quand ca perce.
      const n = kind === "perce" ? 26 : kind === "ricochet" ? 18 : 12;
      for (let i = 0; i < n; i++) {
        spawn(fire, pos.x, pos.y, pos.z, rnd(16), 2 + Math.random() * 9, rnd(16), 0.3 + Math.random() * 0.4, 0.22, 0.05, 1, 0.75, 0.35, 1, 14, 0.8);
      }
      spawn(fire, pos.x, pos.y, pos.z, 0, 0, 0, 0.1, 1.6, 2.4, 1, 0.85, 0.6, 1);
      if (kind === "perce") {
        for (let i = 0; i < 6; i++) {
          spawn(smoke, pos.x, pos.y, pos.z, rnd(3), 1.5 + Math.random() * 2, rnd(3), 2.4, 0.6, 3.2, 0.25, 0.23, 0.21, 0.6, -0.3, 0.9);
        }
      }
    },
    explosion: (pos) => {
      for (let i = 0; i < 14; i++) {
        spawn(fire, pos.x + rnd(2), pos.y + 1 + Math.random() * 2, pos.z + rnd(2), rnd(8), 3 + Math.random() * 8, rnd(8), 0.5 + Math.random() * 0.5, 2.5, 6 + Math.random() * 3, 1, 0.62, 0.3, 1, -1, 1.2);
      }
      for (let i = 0; i < 30; i++) {
        spawn(fire, pos.x, pos.y + 1.5, pos.z, rnd(26), 6 + Math.random() * 16, rnd(26), 0.8 + Math.random() * 0.8, 0.3, 0.1, 1, 0.7, 0.3, 1, 18, 0.4);
      }
      for (let i = 0; i < 24; i++) {
        spawn(smoke, pos.x + rnd(3), pos.y + 1 + Math.random() * 3, pos.z + rnd(3), rnd(4), 3 + Math.random() * 5, rnd(4), 3 + Math.random() * 3, 2.5, 9, 0.16, 0.15, 0.14, 0.75, -0.6, 0.5);
      }
    },
    burn: (pos, seconds) => {
      fires.push({ x: pos.x, y: pos.y, z: pos.z, left: seconds, acc: 0 });
    },
    dust: (x, y, z, amount) => {
      if (Math.random() > amount) return;
      spawn(smoke, x + rnd(0.8), y + 0.3, z + rnd(0.8), rnd(1.5), 0.6 + Math.random() * 0.8, rnd(1.5), 1.4 + Math.random(), 0.8, 3.2, 0.66, 0.58, 0.45, 0.32, -0.15, 1.3);
    },
    beginTracers: () => {
      tracers.count = 0;
    },
    addTracer: (pos, dir) => {
      if (tracers.count >= TRACERS) return;
      q.setFromUnitVectors(zAxis, tmp.copy(dir).normalize());
      m4.compose(pos, q, one);
      tracers.setMatrixAt(tracers.count++, m4);
    },
    endTracers: () => {
      tracers.instanceMatrix.needsUpdate = true;
    },
    update: (dt) => {
      // Epaves en feu : flammes basses et fumee noire qui monte.
      for (let k = fires.length - 1; k >= 0; k--) {
        const f = fires[k];
        f.left -= dt;
        f.acc += dt;
        while (f.acc > 0.07) {
          f.acc -= 0.07;
          const strong = f.left > 8 ? 1 : f.left / 8;
          if (Math.random() < strong) {
            spawn(fire, f.x + rnd(1.6), f.y + 1.2 + Math.random(), f.z + rnd(1.6), rnd(0.6), 1.5 + Math.random() * 1.5, rnd(0.6), 0.5 + Math.random() * 0.4, 1.1, 0.4, 1, 0.55, 0.25, 0.9, -1, 0.6);
          }
          spawn(smoke, f.x + rnd(1), f.y + 2, f.z + rnd(1), 0.6 + rnd(0.8), 2.2 + Math.random() * 1.6, rnd(0.8), 5 + Math.random() * 3, 1.6, 7, 0.13, 0.12, 0.12, 0.6 * (0.3 + strong * 0.7), -0.2, 0.25);
        }
        if (f.left <= 0) fires.splice(k, 1);
      }
      step(fire, dt, false);
      step(smoke, dt, true);
    },
    dispose: () => {
      for (const p of [fire, smoke]) {
        p.geo.dispose();
        (p.mesh.material as THREE.Material).dispose();
      }
      fireTex.dispose();
      smokeTex.dispose();
      tracerGeo.dispose();
      tracerMat.dispose();
      tracers.dispose();
    },
  };
}
