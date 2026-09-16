import * as THREE from "three";
import { createAnimatedModel, type AnimatedModel } from "./models3d";

/**
 * Monstres des Backrooms : visages peints au canvas, poses sur des tetes
 * sculptees (bosses et creux deformes a la main), accrochees au cou du
 * squelette anime du soldat (CC0), dont la tete d'origine est effacee.
 *
 * Deux creatures originales :
 * - « le Masque » : un masque blanc sans expression, sale, des yeux vides,
 *   des cheveux en bataille. Il ne court presque jamais : il avance.
 * - « le Souriant » : un visage gris et creuse, des orbites noires percees de
 *   deux points lumineux, et un sourire beaucoup trop grand.
 *
 * Tout reste en MeshLambertMaterial ; un leger emissif garde le visage
 * lisible dans le noir sans aucune lumiere dynamique.
 */

export type HeadKind = "masque" | "souriant";

export interface HorrorHead {
  /** A accrocher au cou : origine a la base du crane, regard vers +Z. */
  group: THREE.Group;
  /** Hauteur des yeux dans le groupe, en metres. */
  eyeY: number;
  materials: THREE.Material[];
  dispose(): void;
}

function canvas2d(size: number) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return { canvas, ctx: canvas.getContext("2d")! };
}

function texture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Tache douce : un degrade radial, pour les ombres et les salissures. */
function blot(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string, alpha: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, color.replace("A", String(alpha)));
  g.addColorStop(1, color.replace("A", "0"));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Masque de latex blanc casse, creuse aux yeux, sali par le temps. */
function makeMaskTexture(): THREE.CanvasTexture {
  const S = 512;
  const { canvas, ctx } = canvas2d(S);
  const base = ctx.createRadialGradient(S * 0.5, S * 0.48, S * 0.05, S * 0.5, S * 0.5, S * 0.7);
  base.addColorStop(0, "#e6e1d6");
  base.addColorStop(0.6, "#d3ccbe");
  base.addColorStop(1, "#9c9587");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);

  // Relief peint, tres doux : un masque, pas un visage.
  blot(ctx, S * 0.5, S * 0.37, S * 0.3, S * 0.05, "rgba(80,74,64,A)", 0.22);
  blot(ctx, S * 0.28, S * 0.63, S * 0.09, S * 0.12, "rgba(90,84,74,A)", 0.22);
  blot(ctx, S * 0.72, S * 0.63, S * 0.09, S * 0.12, "rgba(90,84,74,A)", 0.22);
  blot(ctx, S * 0.5, S * 0.52, S * 0.03, S * 0.13, "rgba(255,253,246,A)", 0.45);
  blot(ctx, S * 0.465, S * 0.63, S * 0.022, S * 0.03, "rgba(70,64,56,A)", 0.4);
  blot(ctx, S * 0.535, S * 0.63, S * 0.022, S * 0.03, "rgba(70,64,56,A)", 0.4);

  // Yeux : deux trous en amande, noirs, avec l'ombre du bord epais du masque.
  for (const ex of [0.36, 0.64]) {
    const dir = ex < 0.5 ? -1 : 1;
    blot(ctx, S * ex, S * 0.47, S * 0.09, S * 0.055, "rgba(40,36,30,A)", 0.45);
    ctx.fillStyle = "#040404";
    ctx.beginPath();
    // Pointe exterieure plus haute : un regard fixe, legerement mauvais.
    ctx.moveTo(S * (ex - dir * 0.065), S * 0.475);
    ctx.quadraticCurveTo(S * ex, S * 0.425, S * (ex + dir * 0.07), S * 0.455);
    ctx.quadraticCurveTo(S * ex, S * 0.515, S * (ex - dir * 0.065), S * 0.475);
    ctx.fill();
  }

  // Bouche : une fente mince a peine entrouverte.
  ctx.strokeStyle = "rgba(30,25,22,0.8)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(S * 0.43, S * 0.76);
  ctx.quadraticCurveTo(S * 0.5, S * 0.772, S * 0.57, S * 0.758);
  ctx.stroke();

  // Usure fine : quelques fissures et de la poussiere dans les creux.
  ctx.strokeStyle = "rgba(90,82,70,0.35)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 18; i++) {
    const x = S * (0.15 + Math.random() * 0.7);
    const y = S * (0.2 + Math.random() * 0.7);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 26, y + (Math.random() - 0.5) * 10);
    ctx.stroke();
  }
  for (let i = 0; i < 8; i++) {
    blot(ctx, S * (0.2 + Math.random() * 0.6), S * (0.55 + Math.random() * 0.4), 8 + Math.random() * 18, 6 + Math.random() * 12, "rgba(110,100,82,A)", 0.12);
  }
  // Quelques eclaboussures seches, en bas d'un cote.
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = `rgba(${80 + Math.random() * 30},20,18,${0.3 + Math.random() * 0.35})`;
    ctx.beginPath();
    ctx.arc(S * (0.6 + Math.random() * 0.22), S * (0.7 + Math.random() * 0.2), 1 + Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  return texture(canvas);
}

/**
 * Visage du Souriant : peau grise tendue, orbites noires, sourire demesure.
 * `glow` sert de carte emissive : dans le noir complet, le visage se devine
 * a peine et les dents luisent.
 */
function makeGrinTextures(): { map: THREE.CanvasTexture; glow: THREE.CanvasTexture } {
  const S = 512;
  const { canvas, ctx } = canvas2d(S);
  const base = ctx.createRadialGradient(S * 0.5, S * 0.45, S * 0.05, S * 0.5, S * 0.5, S * 0.65);
  base.addColorStop(0, "#8f8c84");
  base.addColorStop(0.55, "#5e5b55");
  base.addColorStop(1, "#1e1d1b");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);

  // Veines sous la peau.
  ctx.strokeStyle = "rgba(60,62,80,0.3)";
  for (let i = 0; i < 26; i++) {
    let x = Math.random() * S;
    let y = Math.random() * S * 0.7;
    ctx.lineWidth = 0.8 + Math.random() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (Math.random() - 0.5) * 30;
      y += Math.random() * 18;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Orbites profondes, pommettes saillantes.
  for (const ex of [0.35, 0.65]) {
    blot(ctx, S * ex, S * 0.38, S * 0.17, S * 0.14, "rgba(6,5,5,A)", 1);
    blot(ctx, S * ex, S * 0.38, S * 0.09, S * 0.075, "rgba(0,0,0,A)", 1);
  }
  blot(ctx, S * 0.25, S * 0.56, S * 0.08, S * 0.05, "rgba(210,206,196,A)", 0.35);
  blot(ctx, S * 0.75, S * 0.56, S * 0.08, S * 0.05, "rgba(210,206,196,A)", 0.35);
  blot(ctx, S * 0.5, S * 0.52, S * 0.03, S * 0.06, "rgba(20,18,18,A)", 0.6);

  // Le sourire : d'une tempe a l'autre, les coins dechires vers le haut.
  ctx.fillStyle = "#050303";
  ctx.beginPath();
  ctx.moveTo(S * 0.02, S * 0.5);
  ctx.quadraticCurveTo(S * 0.5, S * 1.12, S * 0.98, S * 0.5);
  ctx.quadraticCurveTo(S * 0.5, S * 0.72, S * 0.02, S * 0.5);
  ctx.fill();
  // Gencives sombres.
  ctx.fillStyle = "#3a0a0c";
  ctx.beginPath();
  ctx.moveTo(S * 0.06, S * 0.53);
  ctx.quadraticCurveTo(S * 0.5, S * 0.8, S * 0.94, S * 0.53);
  ctx.quadraticCurveTo(S * 0.5, S * 0.74, S * 0.06, S * 0.53);
  ctx.fill();
  // Dechirures aux coins de la bouche.
  ctx.strokeStyle = "rgba(60,8,10,0.8)";
  ctx.lineWidth = 3;
  for (const [x0, dir] of [
    [0.03, -1],
    [0.97, 1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(S * x0, S * 0.5);
    ctx.lineTo(S * (x0 - dir * 0.01), S * 0.42);
    ctx.lineTo(S * (x0 + dir * 0.01), S * 0.34);
    ctx.stroke();
  }

  // Carte emissive : le visage a peine, puis les dents par-dessus.
  const glow = canvas2d(S);
  glow.ctx.fillStyle = "#000";
  glow.ctx.fillRect(0, 0, S, S);
  glow.ctx.globalAlpha = 0.2;
  glow.ctx.drawImage(canvas, 0, 0);
  glow.ctx.globalAlpha = 1;

  // Dents : longues, serrees, jaunies, pas une a la meme taille.
  for (let row = 0; row < 2; row++) {
    const count = 28;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const x = S * (0.08 + t * 0.84);
      const curve = Math.sin(t * Math.PI);
      const yTop = row === 0 ? S * (0.535 + curve * 0.2) : S * (0.56 + curve * 0.38);
      const h = S * (0.04 + curve * 0.06) * (0.75 + Math.random() * 0.5);
      const w = S * 0.022 * (0.8 + Math.random() * 0.3);
      const shade = 200 + Math.random() * 30;
      for (const c of [ctx, glow.ctx]) {
        c.fillStyle = `rgb(${shade},${shade - 12},${shade - 48})`;
        c.beginPath();
        if (row === 0) {
          c.moveTo(x - w / 2, yTop);
          c.lineTo(x + w / 2, yTop);
          c.lineTo(x + w * 0.2, yTop + h);
          c.lineTo(x - w * 0.2, yTop + h);
        } else {
          c.moveTo(x - w * 0.2, yTop - h);
          c.lineTo(x + w * 0.2, yTop - h);
          c.lineTo(x + w / 2, yTop);
          c.lineTo(x - w / 2, yTop);
        }
        c.closePath();
        c.fill();
        c.strokeStyle = "rgba(40,20,10,0.5)";
        c.lineWidth = 1;
        c.stroke();
      }
    }
  }
  return { map: texture(canvas), glow: texture(glow.canvas) };
}

/** Cheveux sales : meches sombres en desordre. */
function makeHairTexture(): THREE.CanvasTexture {
  const S = 256;
  const { canvas, ctx } = canvas2d(S);
  ctx.fillStyle = "#1c1814";
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    ctx.strokeStyle = Math.random() < 0.5 ? "rgba(70,58,44,0.5)" : "rgba(8,6,4,0.6)";
    ctx.lineWidth = 1 + Math.random();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 10, y + 8 + Math.random() * 18);
    ctx.stroke();
  }
  const t = texture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 2);
  return t;
}

/**
 * Deforme le devant d'une sphere pour en faire un visage : nez, arcades,
 * orbites, pommettes, menton. `u` va de la gauche a la droite du visage vu de
 * face, `v` du front au menton.
 */
function sculptFace(geo: THREE.BufferGeometry, bumps: [number, number, number, number, number][]) {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i);
    const v = 1 - uv.getY(i);
    let d = 0;
    for (const [cu, cv, su, sv, h] of bumps) {
      d += h * Math.exp(-(((u - cu) / su) ** 2) - ((v - cv) / sv) ** 2);
    }
    p.fromBufferAttribute(pos, i);
    const len = p.length();
    p.multiplyScalar((len + d) / len);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

export function buildHorrorHead(kind: HeadKind): HorrorHead {
  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => {
    owned.push(x);
    return x;
  };
  const group = new THREE.Group();
  const materials: THREE.Material[] = [];
  const mat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return keep(m);
  };

  const R = kind === "souriant" ? 0.118 : 0.112;
  const headY = kind === "souriant" ? 0.16 : 0.13;

  // --- Le visage : le devant d'une sphere, sculpte puis peint ---
  const faceGeo = keep(new THREE.SphereGeometry(R, 48, 36, Math.PI / 2 - Math.PI * 0.36, Math.PI * 0.72, Math.PI * 0.1, Math.PI * 0.76));
  sculptFace(
    faceGeo,
    kind === "masque"
      ? [
          [0.5, 0.56, 0.04, 0.15, 0.03], // nez
          [0.5, 0.36, 0.3, 0.05, 0.009], // arcades
          [0.37, 0.44, 0.06, 0.05, -0.014], // orbites
          [0.63, 0.44, 0.06, 0.05, -0.014],
          [0.3, 0.66, 0.07, 0.08, -0.006], // joues creusees
          [0.7, 0.66, 0.07, 0.08, -0.006],
          [0.5, 0.9, 0.1, 0.06, 0.007], // menton
        ]
      : [
          [0.5, 0.52, 0.035, 0.1, 0.012],
          [0.36, 0.42, 0.08, 0.07, -0.022], // orbites tres creuses
          [0.64, 0.42, 0.08, 0.07, -0.022],
          [0.24, 0.55, 0.06, 0.05, 0.012], // pommettes saillantes
          [0.76, 0.55, 0.06, 0.05, 0.012],
          [0.5, 0.72, 0.36, 0.1, 0.01], // la bouche pousse en avant
        ],
  );
  const faceMat =
    kind === "masque"
      ? (() => {
          const map = keep(makeMaskTexture());
          return mat(new THREE.MeshLambertMaterial({ map, emissive: new THREE.Color(0x2a2824), emissiveMap: map }));
        })()
      : (() => {
          const { map, glow } = makeGrinTextures();
          // fog: false — au bout d'un couloir noir, le sourire reste visible.
          return mat(
            new THREE.MeshLambertMaterial({ map: keep(map), emissive: new THREE.Color(0xd8d2c4), emissiveMap: keep(glow), fog: false }),
          );
        })();
  const face = new THREE.Mesh(faceGeo, faceMat);
  face.position.y = headY;
  face.scale.set(kind === "souriant" ? 1 : 0.94, kind === "souriant" ? 1.28 : 1.24, 1.05);
  group.add(face);

  // --- Le crane derriere le visage ---
  const skullMat =
    kind === "masque"
      ? mat(new THREE.MeshLambertMaterial({ map: keep(makeHairTexture()) }))
      : mat(new THREE.MeshLambertMaterial({ color: 0x5a5852, emissive: new THREE.Color(0x0c0c0b) }));
  const skull = new THREE.Mesh(keep(new THREE.SphereGeometry(R * 0.985, 28, 20)), skullMat);
  // Le crane reste en retrait du visage : sinon il le traverse au front.
  skull.position.set(0, headY + 0.004, kind === "souriant" ? -0.012 : -0.04);
  skull.scale.set(kind === "souriant" ? 1 : 0.97, kind === "souriant" ? 1.3 : 1.2, kind === "souriant" ? 1.08 : 1);
  group.add(skull);

  // --- Cou ---
  const neckMat = mat(new THREE.MeshLambertMaterial({ color: kind === "masque" ? 0x2d3239 : 0x0b0b0d }));
  const neck = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.048, 0.058, kind === "souriant" ? 0.2 : 0.12, 12)), neckMat);
  neck.position.y = kind === "souriant" ? 0.02 : 0.02;
  group.add(neck);

  if (kind === "masque") {
    // Meches qui depassent autour du masque : la silhouette n'est plus une boule.
    const strandGeo = keep(new THREE.ConeGeometry(0.02, 0.15, 5));
    // Trois couronnes de meches : le dessus, les tempes, la nuque. Aucune
    // devant le masque, qui doit rester lisse et vide.
    const rings = [
      [0, 18, 0.1, 0.8],
      [1, 16, 0.03, 1],
      [2, 14, -0.05, 0.95],
    ] as const;
    // Une seule instance pour toutes les meches : un appel de rendu, pas 48.
    const hair = keep(new THREE.InstancedMesh(strandGeo, skullMat, rings.reduce((n, r) => n + r[1], 0)));
    const strand = new THREE.Object3D();
    let k = 0;
    for (const [ring, count, height, spread] of rings) {
      for (let i = 0; i < count; i++) {
        // L'angle 0 est la nuque (-Z) : on couvre l'arriere et les tempes,
        // jamais le devant du masque.
        const a = -Math.PI * 0.62 + (i / (count - 1)) * Math.PI * 1.24;
        const r = R * spread * (ring === 0 ? 0.7 : 1.02);
        strand.position.set(Math.sin(a) * r, headY + height + Math.random() * 0.03, -Math.cos(a) * r * 0.95 - 0.035);
        if (ring === 0) {
          // Le dessus : des epis en desordre.
          strand.rotation.set(-0.35 + (Math.random() - 0.5) * 0.9, 0, (Math.random() - 0.5) * 0.9);
        } else {
          // Tempes et nuque : les meches retombent le long du crane.
          strand.rotation.set(Math.PI + 0.35 * Math.cos(a) + (Math.random() - 0.5) * 0.35, 0, -0.35 * Math.sin(a) + (Math.random() - 0.5) * 0.35);
        }
        strand.updateMatrix();
        hair.setMatrixAt(k++, strand.matrix);
      }
    }
    hair.instanceMatrix.needsUpdate = true;
    group.add(hair);
    // Col de la combinaison de travail.
    const collar = new THREE.Mesh(keep(new THREE.TorusGeometry(0.075, 0.022, 8, 20)), neckMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = -0.02;
    group.add(collar);
  } else {
    // Deux pupilles minuscules qui brillent au fond des orbites, meme sans lumiere.
    const pupilMat = mat(new THREE.MeshBasicMaterial({ color: 0xf4f1e0, fog: false }));
    const pupilGeo = keep(new THREE.SphereGeometry(0.0095, 8, 6));
    for (const sx of [-0.052, 0.052]) {
      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(sx, headY + 0.045, R * 0.9);
      group.add(pupil);
    }
    // Capuche noire ouverte sur le devant : le visage flotte dans le noir.
    const clothMat = mat(new THREE.MeshLambertMaterial({ color: 0x060607, side: THREE.DoubleSide }));
    const opening = Math.PI * 0.62;
    const hood = new THREE.Mesh(
      keep(new THREE.SphereGeometry(R * 1.32, 28, 20, Math.PI / 2 + opening / 2, Math.PI * 2 - opening, 0, Math.PI * 0.78)),
      clothMat,
    );
    hood.position.set(0, headY + 0.01, -0.01);
    hood.scale.set(1, 1.38, 1.12);
    group.add(hood);
    // Le voile tombe sur les epaules.
    const veil = new THREE.Mesh(keep(new THREE.CylinderGeometry(R * 1.3, 0.3, 0.46, 24, 1, true)), clothMat);
    veil.position.set(0, headY - 0.3, -0.02);
    group.add(veil);
  }

  return {
    group,
    eyeY: headY + 0.04,
    materials,
    dispose() {
      for (const o of owned) o.dispose();
    },
  };
}

// ---------------------------------------------------------------------------
// Le corps anime
// ---------------------------------------------------------------------------

export interface HorrorMonster {
  model: AnimatedModel;
  head: HorrorHead;
  /** Hauteur des yeux au-dessus des pieds, en metres, debout. */
  eyeHeight: number;
  /** Vitesses au sol des animations « Walk » et « Run » a la cadence normale (m/s). */
  walkSpeed: number;
  runSpeed: number;
  /** Tourne la tete : lacet (vers sa gauche > 0), menton (baisse > 0), penche (sur l'epaule). */
  look(yaw: number, pitch: number, roll: number): void;
  /** Opacite du corps et de la tete (monstre cree avec `fading`). */
  setOpacity(opacity: number): void;
  dispose(): void;
}

const MONSTER_HEIGHT: Record<HeadKind, number> = { masque: 1.95, souriant: 2.2 };

/**
 * Un monstre complet : le squelette anime du soldat, reteint, sa tete
 * d'origine (et le casque) effacee, et la tete sculptee posee sur le cou.
 *
 * Avec `fading`, tous les materiaux restent transparents en permanence :
 * basculer entre opaque et transparent recompilerait les shaders au pire
 * moment, quand le monstre surgit du noir.
 */
export async function createHorrorMonster(kind: HeadKind, opts: { fading?: boolean } = {}): Promise<HorrorMonster> {
  const height = MONSTER_HEIGHT[kind];
  const model = await createAnimatedModel("soldat-swat", height);
  if (kind === "masque") {
    // Un bleu de travail sale, des mains pales.
    model.tint((n) => n === "Swat", 0x2d3239);
    model.tint((n) => n === "Swat_Black", 0x262a30);
    model.tint((n) => n === "Skin", 0x9a9186);
    model.tint((n) => n === "Visor", 0x1b1d20);
  } else {
    // Une silhouette noire, des mains grises.
    model.tint(() => true, 0x0b0b0d);
    model.tint((n) => n === "Skin", 0x55534e);
  }
  model.hideBone("Head");
  const head = buildHorrorHead(kind);
  // Le pivot est aligne sur le corps par attach() ; la tete tourne dedans.
  const pivot = new THREE.Group();
  pivot.add(head.group);
  head.group.rotation.order = "YXZ";
  model.attach("Neck", pivot, "Idle_Neutral");
  model.root.updateMatrixWorld(true);
  const eyeHeight = pivot.getWorldPosition(new THREE.Vector3()).y + head.eyeY;

  const materials = new Set<THREE.Material>();
  model.root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(m);
  });
  if (opts.fading) for (const m of materials) m.transparent = true;

  // Mesure sur le pied d'appui du squelette, pour 1,95 m de haut.
  const scale = height / 1.95;
  return {
    model,
    head,
    eyeHeight,
    walkSpeed: 1.39 * scale,
    runSpeed: 3.4 * scale,
    look(yaw, pitch, roll) {
      head.group.rotation.set(pitch, yaw, roll);
    },
    setOpacity(opacity) {
      const o = THREE.MathUtils.clamp(opacity, 0, 1);
      for (const m of materials) m.opacity = o;
      model.root.visible = o > 0.01;
    },
    dispose() {
      model.dispose();
      head.dispose();
    },
  };
}
