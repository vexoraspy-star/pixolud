import * as THREE from "three";

/**
 * Grenades du Duel : la grenade explosive et le fumigene.
 *
 * Tout se calcule en metres dans le repere du monde (x et z au sol, y en
 * hauteur) ; la grille de la carte, en cases de DUEL_CELL metres, sert aux
 * rebonds. Les grenades en vol, les nuages et l'arc de visee sont pris dans
 * des reserves creees une fois pour toutes : lancer une grenade n'alloue rien
 * pendant la partie.
 */

export type GrenadeKind = "grenade" | "fumigene";

export const GRENADE_KINDS: GrenadeKind[] = ["grenade", "fumigene"];

export const GRENADES: Record<GrenadeKind, { name: string; fuse: number; color: number; loot: number }> = {
  // Meche de 2 s : le temps de voir la grenade rebondir et de s'ecarter.
  grenade: { name: "Grenade", fuse: 2, color: 0x56642b, loot: 0xa6c44e },
  // Le fumigene se declenche plus tot : il sert a se couvrir, tout de suite.
  fumigene: { name: "Fumigène", fuse: 1.3, color: 0x7d848a, loot: 0xc9d0d6 },
};

/** On en porte au plus trois de chaque sorte. */
export const NADE_CARRY_MAX = 3;
/** Rayon de l'explosion, en cases, et degats au centre. */
export const BLAST_RADIUS = 4;
export const BLAST_DAMAGE = 120;

/** Degats selon la distance (en cases) : mortels au centre, nuls au bord. */
export function blastDamage(dist: number): number {
  if (dist >= BLAST_RADIUS) return 0;
  return BLAST_DAMAGE * Math.pow(1 - dist / BLAST_RADIUS, 1.1);
}

/** Duree du nuage de fumee, son rayon et sa hauteur une fois deploye (en metres). */
export const SMOKE_SECONDS = 9;
export const SMOKE_RADIUS = 4.2;
const SMOKE_HEIGHT = 3.1;

/** Gravite propre aux grenades : un peu plus forte que la vraie, l'arc reste lisible. */
export const NADE_GRAVITY = 14;
/** Vitesse du lancer, en m/s. */
export const THROW_SPEED = 13.5;
/** Le lancer part un peu au-dessus du regard (en radians). */
export const THROW_LOFT = 0.2;
const NADE_R = 0.07;
const WALL_BOUNCE = 0.42;
const FLOOR_BOUNCE = 0.34;
const ROLL_FRICTION = 3.4;

/** Ce qu'une grenade doit savoir de la carte pour rebondir. */
export interface NadeWorld {
  /** Taille d'une case, en metres. */
  cell: number;
  width: number;
  height: number;
  wallHeight: number;
  /** Arenes : un plafond a hauteur des murs. L'ile est a ciel ouvert. */
  ceiling: boolean;
  solid(cx: number, cz: number): boolean;
}

/** Position et vitesse d'une grenade, en metres et m/s. */
export interface NadeBody {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

function blocked(w: NadeWorld, x: number, y: number, z: number): boolean {
  const cx = Math.floor(x / w.cell);
  const cz = Math.floor(z / w.cell);
  if (cx < 0 || cz < 0 || cx >= w.width || cz >= w.height) return true;
  // Au-dessus des murs (sur l'ile, sans plafond), on passe par-dessus.
  return y < w.wallHeight && w.solid(cx, cz);
}

/** Hauteur du sol sous un point : le toit d'un mur si l'on est au-dessus. */
function groundAt(w: NadeWorld, x: number, z: number): number {
  const cx = Math.floor(x / w.cell);
  const cz = Math.floor(z / w.cell);
  if (cx < 0 || cz < 0 || cx >= w.width || cz >= w.height) return 0;
  return w.solid(cx, cz) ? w.wallHeight : 0;
}

/**
 * Un pas de physique : trajectoire balistique, rebonds amortis sur les murs,
 * le sol et le plafond, puis la grenade roule et freine. Renvoie la vitesse
 * du choc le plus fort de ce pas (0 s'il n'y en a pas) : c'est ce qui fait
 * tinter la grenade.
 */
export function stepNade(b: NadeBody, dt: number, w: NadeWorld): number {
  let impact = 0;
  b.vy -= NADE_GRAVITY * dt;
  // Un axe apres l'autre : une grenade qui touche un mur de biais glisse le
  // long au lieu de s'y coller.
  const nx = b.x + b.vx * dt;
  if (blocked(w, nx + Math.sign(b.vx) * NADE_R, b.y, b.z)) {
    impact = Math.max(impact, Math.abs(b.vx));
    b.vx = -b.vx * WALL_BOUNCE;
    b.vz *= 0.85;
  } else {
    b.x = nx;
  }
  const nz = b.z + b.vz * dt;
  if (blocked(w, b.x, b.y, nz + Math.sign(b.vz) * NADE_R)) {
    impact = Math.max(impact, Math.abs(b.vz));
    b.vz = -b.vz * WALL_BOUNCE;
    b.vx *= 0.85;
  } else {
    b.z = nz;
  }
  const floor = groundAt(w, b.x, b.z) + NADE_R;
  const ny = b.y + b.vy * dt;
  if (ny <= floor) {
    if (b.vy < -0.8) {
      impact = Math.max(impact, -b.vy);
      b.vy = -b.vy * FLOOR_BOUNCE;
      b.vx *= 0.7;
      b.vz *= 0.7;
    } else {
      b.vy = 0;
    }
    b.y = floor;
  } else if (w.ceiling && ny >= w.wallHeight - NADE_R) {
    impact = Math.max(impact, Math.abs(b.vy));
    b.vy = -Math.abs(b.vy) * 0.4;
    b.y = w.wallHeight - NADE_R;
  } else {
    b.y = ny;
  }
  // Posee au sol : elle roule et freine.
  if (b.vy === 0 && b.y <= floor + 1e-4) {
    const k = Math.max(0, 1 - ROLL_FRICTION * dt);
    b.vx *= k;
    b.vz *= k;
  }
  return impact;
}

/**
 * Vitesse de lancer pour qu'une grenade partie de (ox, oy, oz) retombe pres de
 * (tx, tz), sous un angle fixe de 30 degres. Le point vise est un peu en deca :
 * la grenade roule apres son dernier rebond. Ecrit la vitesse dans `out`.
 */
export function aimNadeAt(out: NadeBody, tx: number, tz: number): boolean {
  const dx = tx - out.x;
  const dz = tz - out.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.5) return false;
  const aim = Math.max(1, dist - 1.1);
  const th = Math.PI / 6;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const drop = out.y - NADE_R;
  const denom = 2 * c * c * (drop + aim * Math.tan(th));
  const v = Math.min(THROW_SPEED * 1.05, Math.sqrt((NADE_GRAVITY * aim * aim) / Math.max(0.01, denom)));
  out.vx = (dx / dist) * c * v;
  out.vy = s * v;
  out.vz = (dz / dist) * c * v;
  return true;
}

// ----------------------------------------------------------------- modeles

/** Geometries et materiaux partages par toutes les grenades (en vol et en main). */
function createNadeKit() {
  const bodyGeo = new THREE.CylinderGeometry(0.048, 0.05, 0.11, 10);
  const capGeo = new THREE.CylinderGeometry(0.024, 0.03, 0.04, 8);
  const leverGeo = new THREE.BoxGeometry(0.014, 0.09, 0.024);
  const ringGeo = new THREE.TorusGeometry(0.018, 0.004, 4, 10);
  const bandGeo = new THREE.CylinderGeometry(0.043, 0.043, 0.022, 10);
  const mats: Record<GrenadeKind, THREE.MeshLambertMaterial> = {
    grenade: new THREE.MeshLambertMaterial({ color: GRENADES.grenade.color }),
    fumigene: new THREE.MeshLambertMaterial({ color: GRENADES.fumigene.color }),
  };
  const metal = new THREE.MeshLambertMaterial({ color: 0x3b3f43 });
  const band = new THREE.MeshLambertMaterial({ color: 0xd7dcdf });

  /** Olive et trapue pour l'explosive ; grise, plus haute et baguee de blanc pour le fumigene. */
  function build(kind: GrenadeKind): THREE.Group {
    const g = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, mats[kind]);
    if (kind === "fumigene") body.scale.set(0.86, 1.3, 0.86);
    g.add(body);
    const top = kind === "fumigene" ? 0.087 : 0.072;
    const cap = new THREE.Mesh(capGeo, metal);
    cap.position.y = top;
    g.add(cap);
    const lever = new THREE.Mesh(leverGeo, metal);
    lever.position.set(0.045, top - 0.03, 0);
    lever.rotation.z = -0.12;
    g.add(lever);
    const ring = new THREE.Mesh(ringGeo, metal);
    ring.position.set(-0.03, top + 0.005, 0);
    ring.rotation.y = Math.PI / 2;
    g.add(ring);
    if (kind === "fumigene") {
      const b = new THREE.Mesh(bandGeo, band);
      b.position.y = 0.02;
      g.add(b);
    }
    return g;
  }

  return {
    build,
    dispose() {
      bodyGeo.dispose();
      capGeo.dispose();
      leverGeo.dispose();
      ringGeo.dispose();
      bandGeo.dispose();
      mats.grenade.dispose();
      mats.fumigene.dispose();
      metal.dispose();
      band.dispose();
    },
  };
}

// --------------------------------------------------------- grenades en vol

export interface LiveNade<O> {
  active: boolean;
  kind: GrenadeKind;
  body: NadeBody;
  /** Temps avant l'explosion (ou avant que le fumigene ne se declenche). */
  fuse: number;
  /** Fumigene declenche : la boite reste au sol le temps du nuage. */
  popped: boolean;
  linger: number;
  owner: O | null;
  /** Tirage propre a chaque grenade : tous les bots ne la remarquent pas. */
  seed: number;
  models: Record<GrenadeKind, THREE.Group>;
  lastBounce: number;
}

export interface GrenadeSystem<O> {
  readonly live: readonly LiveNade<O>[];
  /** Lance une grenade ; faux si la reserve est pleine. */
  throwNade(kind: GrenadeKind, from: NadeBody, owner: O): boolean;
  update(delta: number): void;
  /** Une grenade a tenir en main (repere de la vue), avec les memes materiaux. */
  buildModel(kind: GrenadeKind): THREE.Group;
  /** Nouvelle manche : plus rien en vol. */
  reset(): void;
  dispose(): void;
}

const NADE_POOL = 10;

export function createGrenades<O>(
  scene: THREE.Scene,
  world: NadeWorld,
  hooks: {
    /** Un choc assez fort pour s'entendre. */
    onBounce?: (n: LiveNade<O>, speed: number) => void;
    /** L'explosive explose, le fumigene se declenche. */
    onDetonate: (n: LiveNade<O>) => void;
  },
): GrenadeSystem<O> {
  const kit = createNadeKit();
  const extra: THREE.Group[] = [];
  let clock = 0;
  let seedCounter = 1;
  const live: LiveNade<O>[] = Array.from({ length: NADE_POOL }, () => {
    const models = { grenade: kit.build("grenade"), fumigene: kit.build("fumigene") };
    for (const m of Object.values(models)) {
      m.visible = false;
      scene.add(m);
    }
    return {
      active: false,
      kind: "grenade" as GrenadeKind,
      body: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 },
      fuse: 0,
      popped: false,
      linger: 0,
      owner: null,
      seed: 0,
      models,
      lastBounce: -1,
    };
  });

  function hide(n: LiveNade<O>) {
    n.active = false;
    n.owner = null;
    n.models.grenade.visible = false;
    n.models.fumigene.visible = false;
  }

  return {
    live,
    throwNade(kind, from, owner) {
      const n = live.find((l) => !l.active);
      if (!n) return false;
      n.active = true;
      n.kind = kind;
      n.body.x = from.x;
      n.body.y = from.y;
      n.body.z = from.z;
      n.body.vx = from.vx;
      n.body.vy = from.vy;
      n.body.vz = from.vz;
      n.fuse = GRENADES[kind].fuse;
      n.popped = false;
      n.linger = 0;
      n.owner = owner;
      seedCounter = (seedCounter * 1103515245 + 12345) >>> 0;
      n.seed = seedCounter % 1000;
      n.lastBounce = -1;
      const m = n.models[kind];
      m.visible = true;
      m.position.set(from.x, from.y, from.z);
      m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      n.models[kind === "grenade" ? "fumigene" : "grenade"].visible = false;
      return true;
    },
    update(delta) {
      clock += delta;
      const steps = Math.max(1, Math.ceil(delta / 0.016));
      const dt = delta / steps;
      for (const n of live) {
        if (!n.active) continue;
        if (n.popped) {
          n.linger -= delta;
          if (n.linger <= 0) hide(n);
          continue;
        }
        const b = n.body;
        for (let s = 0; s < steps; s++) {
          const hit = stepNade(b, dt, world);
          if (hit > 1.6 && clock - n.lastBounce > 0.08) {
            n.lastBounce = clock;
            hooks.onBounce?.(n, hit);
          }
        }
        const m = n.models[n.kind];
        m.position.set(b.x, b.y, b.z);
        const hs = Math.hypot(b.vx, b.vz);
        if (b.vy === 0) {
          // Couchee au sol, dans le sens ou elle roule.
          if (hs > 0.05) m.rotation.set(0, Math.atan2(b.vx, b.vz), Math.PI / 2);
          else if (Math.abs(m.rotation.z - Math.PI / 2) > 1e-3) m.rotation.set(0, m.rotation.y, Math.PI / 2);
        } else {
          // En l'air, elle tourne sur elle-meme.
          m.rotation.x += delta * (6 + hs * 0.8);
          m.rotation.z += delta * 4;
        }
        n.fuse -= delta;
        if (n.fuse > 0) continue;
        if (n.kind === "grenade") {
          hooks.onDetonate(n);
          hide(n);
        } else {
          n.popped = true;
          n.linger = SMOKE_SECONDS;
          hooks.onDetonate(n);
        }
      }
    },
    buildModel(kind) {
      const g = kit.build(kind);
      extra.push(g);
      return g;
    },
    reset() {
      for (const n of live) hide(n);
    },
    dispose() {
      for (const n of live) {
        scene.remove(n.models.grenade);
        scene.remove(n.models.fumigene);
      }
      for (const g of extra) g.removeFromParent();
      kit.dispose();
    },
  };
}

// ------------------------------------------------------------ arc de visee

export interface AimArc {
  /** Recalcule l'arc depuis ce depart, pour la duree de la meche. */
  show(from: NadeBody, world: NadeWorld, seconds: number, kind: GrenadeKind): void;
  hide(): void;
  dispose(): void;
}

const ARC_DOTS = 48;
const ARC_DT = 1 / 60;
const ARC_EVERY = 3;

/** Trajectoire en pointilles, et un anneau la ou la grenade finira. */
export function createAimArc(scene: THREE.Scene): AimArc {
  const pos = new Float32Array(ARC_DOTS * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setDrawRange(0, 0);
  const mat = new THREE.PointsMaterial({
    color: 0xfff1a8,
    size: 0.075,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const dots = new THREE.Points(geo, mat);
  dots.frustumCulled = false;
  dots.visible = false;
  scene.add(dots);

  const ringGeo = new THREE.RingGeometry(0.2, 0.32, 24);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffa640,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);

  const sim: NadeBody = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };

  return {
    show(from, world, seconds, kind) {
      sim.x = from.x;
      sim.y = from.y;
      sim.z = from.z;
      sim.vx = from.vx;
      sim.vy = from.vy;
      sim.vz = from.vz;
      const steps = Math.ceil(seconds / ARC_DT);
      let n = 0;
      for (let s = 1; s <= steps; s++) {
        stepNade(sim, ARC_DT, world);
        // Les premiers points passeraient devant l'oeil : on les saute.
        if (s % ARC_EVERY === 0 && s > ARC_EVERY && n < ARC_DOTS) {
          pos[n * 3] = sim.x;
          pos[n * 3 + 1] = sim.y;
          pos[n * 3 + 2] = sim.z;
          n++;
        }
      }
      geo.setDrawRange(0, n);
      geo.attributes.position.needsUpdate = true;
      dots.visible = true;
      ring.position.set(sim.x, sim.y - NADE_R + 0.03, sim.z);
      ringMat.color.setHex(kind === "grenade" ? 0xffa640 : 0xdfe6ec);
      ring.visible = true;
    },
    hide() {
      dots.visible = false;
      ring.visible = false;
    },
    dispose() {
      scene.remove(dots);
      scene.remove(ring);
      geo.dispose();
      mat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
    },
  };
}

// ------------------------------------------------------- nuages de fumee

export interface SmokeClouds {
  spawn(x: number, y: number, z: number): void;
  /** Deploiement, disparition, et chaque bouffee tournee vers la camera. */
  update(delta: number, camera: THREE.Camera): void;
  /** Un nuage coupe-t-il la ligne entre deux points (en cases) ? */
  blocks(ax: number, az: number, bx: number, bz: number): boolean;
  /** Epaisseur du nuage autour d'un point du monde : 0 (rien) a 1 (on n'y voit rien). */
  density(x: number, y: number, z: number): number;
  reset(): void;
  dispose(): void;
}

const CLOUDS = 4;
const PUFFS = 14;

/** Bouffee de fumee epaisse : plusieurs disques doux, dessines au canvas. */
function makePuffTexture(): THREE.CanvasTexture {
  const S = 64;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const blob = (x: number, y: number, r: number, a: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(0.55, `rgba(255,255,255,${a * 0.6})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  };
  blob(32, 34, 30, 0.85);
  blob(22, 28, 17, 0.5);
  blob(42, 26, 16, 0.5);
  blob(34, 42, 15, 0.45);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Les nuages des fumigenes : des bouffees tournees vers la camera, un appel
 * de rendu par nuage. Chaque nuage a son materiau, pour s'effacer seul.
 */
export function createSmokeClouds(scene: THREE.Scene, cell: number, color: number): SmokeClouds {
  const tex = makePuffTexture();
  const plane = new THREE.PlaneGeometry(1, 1);
  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpScale = new THREE.Vector3();
  const tmpMat = new THREE.Matrix4();
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  const zAxis = new THREE.Vector3(0, 0, 1);

  const clouds = Array.from({ length: CLOUDS }, () => {
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const mesh = new THREE.InstancedMesh(plane, mat, PUFFS);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.visible = false;
    for (let i = 0; i < PUFFS; i++) mesh.setMatrixAt(i, hidden);
    scene.add(mesh);
    return {
      active: false,
      x: 0,
      y: 0,
      z: 0,
      age: 0,
      /** Rayon et opacite du moment. */
      radius: 0,
      alpha: 0,
      mesh,
      mat,
      offsets: new Float32Array(PUFFS * 3),
      sizes: new Float32Array(PUFFS),
      spins: Array.from({ length: PUFFS }, () => new THREE.Quaternion()),
    };
  });
  let cursor = 0;

  return {
    spawn(x, y, z) {
      // Un nuage libre, sinon le plus ancien.
      let c = clouds.find((k) => !k.active);
      if (!c) {
        c = clouds[cursor];
        cursor = (cursor + 1) % CLOUDS;
      }
      c.active = true;
      c.x = x;
      c.y = y;
      c.z = z;
      c.age = 0;
      c.radius = 0;
      c.alpha = 0;
      c.mesh.visible = true;
      for (let i = 0; i < PUFFS; i++) {
        // Un dome : les bouffees basses s'etalent, les hautes restent au centre.
        const a = Math.random() * Math.PI * 2;
        const h = 0.18 + Math.random() * 0.72;
        const r = Math.sqrt(Math.random()) * (0.85 - h * 0.35);
        c.offsets[i * 3] = Math.cos(a) * r;
        c.offsets[i * 3 + 1] = h;
        c.offsets[i * 3 + 2] = Math.sin(a) * r;
        c.sizes[i] = 2.5 + Math.random() * 1.3;
        c.spins[i].setFromAxisAngle(zAxis, Math.random() * Math.PI * 2);
      }
    },
    update(delta, camera) {
      for (const c of clouds) {
        if (!c.active) continue;
        c.age += delta;
        if (c.age >= SMOKE_SECONDS) {
          c.active = false;
          c.mesh.visible = false;
          c.alpha = 0;
          continue;
        }
        // Il gonfle en une seconde et demie, tient, puis se dissipe.
        const g = 1 - Math.pow(1 - Math.min(1, c.age / 1.5), 3);
        c.radius = SMOKE_RADIUS * (0.3 + 0.7 * g);
        const fadeOut = Math.min(1, (SMOKE_SECONDS - c.age) / 2);
        c.alpha = Math.min(1, c.age / 0.3) * fadeOut;
        c.mat.opacity = 0.92 * c.alpha;
        const rise = c.age * 0.04;
        for (let i = 0; i < PUFFS; i++) {
          tmpPos.set(
            c.x + c.offsets[i * 3] * c.radius,
            c.y + c.offsets[i * 3 + 1] * SMOKE_HEIGHT * (0.45 + 0.55 * g) + rise,
            c.z + c.offsets[i * 3 + 2] * c.radius,
          );
          tmpQuat.copy(camera.quaternion).multiply(c.spins[i]);
          const s = c.sizes[i] * (0.4 + 0.6 * g) * (0.85 + 0.15 * fadeOut);
          tmpScale.set(s, s, 1);
          tmpMat.compose(tmpPos, tmpQuat, tmpScale);
          c.mesh.setMatrixAt(i, tmpMat);
        }
        c.mesh.instanceMatrix.needsUpdate = true;
      }
    },
    blocks(ax, az, bx, bz) {
      const dx = bx - ax;
      const dz = bz - az;
      const len2 = dx * dx + dz * dz;
      for (const c of clouds) {
        // Un nuage qui nait ou se dissipe laisse encore voir a travers.
        if (!c.active || c.alpha < 0.5) continue;
        const cx = c.x / cell;
        const cz = c.z / cell;
        const r = (c.radius * 0.8) / cell;
        let t = len2 > 1e-6 ? ((cx - ax) * dx + (cz - az) * dz) / len2 : 0;
        t = Math.max(0, Math.min(1, t));
        const px = ax + dx * t - cx;
        const pz = az + dz * t - cz;
        if (px * px + pz * pz < r * r) return true;
      }
      return false;
    },
    density(x, y, z) {
      let best = 0;
      for (const c of clouds) {
        if (!c.active || c.alpha <= 0) continue;
        if (y > c.y + SMOKE_HEIGHT * 1.15) continue;
        const d = Math.hypot(x - c.x, z - c.z);
        const k = Math.max(0, Math.min(1, (1 - d / (c.radius * 0.95)) * 2)) * c.alpha;
        if (k > best) best = k;
      }
      return best;
    },
    reset() {
      for (const c of clouds) {
        c.active = false;
        c.alpha = 0;
        c.mesh.visible = false;
      }
    },
    dispose() {
      for (const c of clouds) {
        scene.remove(c.mesh);
        c.mat.dispose();
        c.mesh.dispose();
      }
      plane.dispose();
      tex.dispose();
    },
  };
}
