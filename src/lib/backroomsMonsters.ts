import * as THREE from "three";
import { createAnimatedModel, type AnimatedModel, type ModelId, type PlayOptions } from "./models3d";

// Les nouveaux monstres des Backrooms, fideles au folklore :
//
//  - le VOLEUR DE PEAU : grand, gris pale, voute, des bras trop longs et des
//    lambeaux de peau humaine qui pendent. Il ne bouge que quand on ne le
//    regarde pas : regarde, il se fige net, meme en pleine foulee.
//  - les CHIENS : des humanoides maigres a quatre pattes, noirs, deux yeux
//    pales. Aveugles, ils entendent de tres loin.
//  - les FETARDS : jaune vif, une tete lisse ou quelqu'un a peint un grand
//    sourire et deux yeux. Ils font coucou, puis ils courent.
//
// Chaque monstre a deux corps : un corps dessine en code, affiche tout de
// suite, et le vrai modele anime (.glb CC0, mannequin Mesh2Motion retravaille
// dans Blender) qui le remplace des qu'il est charge. Si le fichier ne charge
// pas, le corps en code reste. Materiaux Lambert ou Basic seulement.
//
// La scene place et oriente `group` (position, rotation.y) ; `animate` ne
// s'occupe que de la pose. Rien n'est alloue par image.

export type MonsterKind = "voleur" | "chiens" | "fetards";

export interface MonsterPose {
  /** Temps de jeu, en secondes. */
  time: number;
  /** Duree de l'image, en secondes (deja plafonnee par la scene). */
  delta: number;
  /** Vitesse de deplacement, en m/s (0 a l'arret). */
  speed: number;
  /**
   * Etat du cerveau (errer, enqueter, poursuivre, fouiller, debusquer), ou
   * "salut" (le Fetard fait coucou) et "danse" (Fetard decoratif).
   */
  state: string;
  /** 0 a 1 : a portee de griffe. */
  lunge: number;
  /** 0 a 1 : cri en cours (1 au debut du cri). */
  scream: number;
  /** Rotation de la tete vers le joueur, relative au corps (radians). */
  headYaw: number;
  /** Le joueur le regarde : le Voleur de peau se fige. */
  watched: boolean;
}

export interface Monster {
  kind: MonsterKind;
  group: THREE.Group;
  animate(pose: MonsterPose): void;
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Caracteristiques (aides pour la scene)
// ---------------------------------------------------------------------------

export interface MonsterTraits {
  /** Nom affiche, avec son article. */
  name: string;
  /** Multiplicateur de la portee des bruits entendus. */
  hearing: number;
  /** Voit-il ? Les Chiens sont aveugles : ni la lampe ni la vue ne comptent. */
  sees: boolean;
  /** Ne bouge que quand personne ne le regarde. */
  freezesWhenWatched: boolean;
  /** Duree du coucou avant la course, en secondes (0 : aucun). */
  greetSeconds: number;
  /** Vitesses conseillees, en m/s. */
  wander: number;
  investigate: number;
  chase: number;
}

export const MONSTER_TRAITS: Record<MonsterKind, MonsterTraits> = {
  voleur: { name: "le Voleur de peau", hearing: 1, sees: true, freezesWhenWatched: true, greetSeconds: 0, wander: 1.4, investigate: 2.4, chase: 4.6 },
  chiens: { name: "les Chiens", hearing: 1.5, sees: false, freezesWhenWatched: false, greetSeconds: 0, wander: 1.8, investigate: 3.2, chase: 5.6 },
  fetards: { name: "les Fêtards", hearing: 1, sees: true, freezesWhenWatched: false, greetSeconds: 1.5, wander: 1.5, investigate: 2.6, chase: 4.4 },
};

/**
 * Le joueur regarde-t-il ce point ? Meme test que l'Egare : produit scalaire
 * entre la direction du regard (-sin yaw, -cos yaw) et la direction du point.
 * `cosMin` 0,97 pour un regard appuye (l'Egare), 0,7 environ pour « dans le
 * champ de vision » (camera a 72 degres). Les murs (ligne de vue) restent a
 * verifier par la scene. Unites libres (cases ou metres), tant qu'elles sont
 * les memes.
 */
export function isLookingAt(playerX: number, playerZ: number, playerYaw: number, x: number, z: number, cosMin = 0.7): boolean {
  const dx = x - playerX;
  const dz = z - playerZ;
  const d = Math.hypot(dx, dz);
  if (d < 1e-6) return true;
  return (dx * -Math.sin(playerYaw) + dz * -Math.cos(playerYaw)) / d > cosMin;
}

// ---------------------------------------------------------------------------
// Modeles animes
// ---------------------------------------------------------------------------

const MODEL: Record<MonsterKind, { id: ModelId; height: number; color: number }> = {
  voleur: { id: "voleur", height: 2.1, color: 0xa39f94 },
  chiens: { id: "chien", height: 1.9, color: 0x121013 },
  fetards: { id: "fetard", height: 1.85, color: 0xf0c419 },
};

/**
 * createAnimatedModel mesure la hauteur sur la premiere animation du fichier
 * (ici « Attaque », accroupie) : le Fetard aurait fait 2,3 m debout. On
 * ramene donc la pose de repos (debout, bras en croix) a la hauteur voulue.
 * Mettre `false` pour garder la mesure de createAnimatedModel.
 */
const FIX_REST_HEIGHT = true;

/** Vitesse (m/s) a laquelle chaque animation de marche tourne a 1x. */
const PACE: Record<string, number> = {
  Marche: 1.3,
  Course: 4,
  Rode: 1.1,
  Rampe: 1.2,
};

const LOCOMOTION = new Set(["Marche", "Course", "Rode", "Rampe"]);

/** Animations utilisees pour chaque monstre (noms exacts dans les fichiers). */
const CLIPS: Record<MonsterKind, string[]> = {
  voleur: ["Rode", "Course", "Tapie", "Ecoute", "Attaque", "Rampe"],
  chiens: ["Rampe", "Tapie", "Attaque", "Cri"],
  fetards: ["Marche", "Course", "Attente", "Salut", "Danse", "Attaque"],
};

/** Animation ou les pieds touchent le sol a coup sur : sert a poser le modele par terre. */
const GROUND_CLIP: Record<MonsterKind, string> = { voleur: "Ecoute", chiens: "Tapie", fetards: "Attente" };

/** Remplacante d'une animation absente ou inutilisable. */
const SPARE_CLIP: Record<MonsterKind, string> = { voleur: "Rode", chiens: "Rampe", fetards: "Attente" };

/** Au-dessus de cette hauteur (m) a la premiere image, une animation est jugee « en l'air ». */
const AIRBORNE = 0.8;

// ---------------------------------------------------------------------------
// Temporaires partages (aucune allocation par image)
// ---------------------------------------------------------------------------

const tmpQ = new THREE.Quaternion();
const tmpQ2 = new THREE.Quaternion();
const groupQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const PLAY: PlayOptions = { fade: 0.3, loop: true, speed: 1, restart: false, randomStart: false, syncPhase: false };
const REST_POSE: MonsterPose = { time: 0, delta: 0, speed: 0, state: "errer", lunge: 0, scream: 0, headYaw: 0, watched: false };

// ---------------------------------------------------------------------------
// Textures dessinees au canvas, partagees entre les monstres d'un meme type
// ---------------------------------------------------------------------------

function canvas2d(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext("2d")! };
}

function finish(canvas: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  return t;
}

/** Une coulure de peinture : trait vertical, goutte ronde au bout. */
function drip(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, w: number) {
  ctx.lineCap = "round";
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + (Math.random() - 0.5) * 3, y + len * 0.5, x + (Math.random() - 0.5) * 2, y + len);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y + len, w * 0.85, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Le visage peint du Fetard, pose sur un morceau de sphere autour de la tete :
 * u de -65 a +65 degres autour du nez, v de 60 a 135 degres depuis le sommet.
 * Deux yeux ovales et un sourire immense, a la peinture noire qui a coule.
 */
function makePaintedFaceTexture(): THREE.CanvasTexture {
  const W = 512;
  const H = 512;
  const { canvas, ctx } = canvas2d(W, H);
  ctx.clearRect(0, 0, W, H);
  const paint = "#0b0909";
  ctx.fillStyle = paint;
  ctx.strokeStyle = paint;

  // Les yeux : deux ovales pleins, un peu de travers, qui ont bave.
  for (const side of [-1, 1]) {
    const cx = W * (0.5 + side * 0.13);
    const cy = H * 0.33;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(side * 0.08 + (Math.random() - 0.5) * 0.08);
    ctx.beginPath();
    ctx.ellipse(0, 0, W * 0.034, H * 0.068, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    for (let i = 0; i < 2; i++) {
      if (Math.random() < 0.35) continue;
      drip(ctx, cx + (Math.random() - 0.5) * W * 0.03, cy + H * 0.05, H * (0.03 + Math.random() * 0.08), 3 + Math.random() * 3);
    }
  }

  // Le sourire : un croissant epais, trace a la brosse d'une joue a l'autre.
  const left = W * 0.13;
  const right = W * 0.87;
  const top = H * 0.6;
  const smile = new Path2D();
  smile.moveTo(left, top);
  smile.quadraticCurveTo(W * 0.5, H * 0.8, right, top - H * 0.01);
  smile.quadraticCurveTo(right + W * 0.01, top + H * 0.035, right - W * 0.025, top + H * 0.05);
  smile.quadraticCurveTo(W * 0.5, H * 0.99, left + W * 0.025, top + H * 0.05);
  smile.quadraticCurveTo(left - W * 0.012, top + H * 0.03, left, top);
  smile.closePath();
  ctx.fill(smile);
  // Bords irreguliers : la brosse deborde par endroits.
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.stroke(smile);
  for (let i = 0; i < 18; i++) {
    const t = Math.random();
    const x = left + (right - left) * t;
    const y = top + Math.sin(t * Math.PI) * H * 0.2 + (Math.random() - 0.5) * 6;
    ctx.beginPath();
    ctx.arc(x, y, 2 + Math.random() * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Coulures sous le sourire.
  for (let i = 0; i < 7; i++) {
    const t = 0.18 + Math.random() * 0.64;
    const x = left + (right - left) * t;
    const y = top + Math.sin(t * Math.PI) * H * 0.33;
    drip(ctx, x, y, H * (0.02 + Math.random() * 0.07), 3 + Math.random() * 4);
  }
  // Peinture encore fraiche : un reflet gris le long de la levre.
  ctx.strokeStyle = "rgba(120,118,112,0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W * 0.3, top + H * 0.07);
  ctx.quadraticCurveTo(W * 0.5, H * 0.8, W * 0.66, top + H * 0.08);
  ctx.stroke();
  // Eclaboussures autour.
  ctx.fillStyle = paint;
  for (let i = 0; i < 26; i++) {
    const x = W * (0.12 + Math.random() * 0.76);
    const y = H * (0.2 + Math.random() * 0.72);
    ctx.beginPath();
    ctx.arc(x, y, 0.8 + Math.random() * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = finish(canvas);
  t.anisotropy = 4;
  return t;
}

/** Lambeau de peau humaine : chair pale, hematomes, points de suture, bord dechire. */
function makeFlapTexture(): THREE.CanvasTexture {
  const W = 128;
  const H = 256;
  const { canvas, ctx } = canvas2d(W, H);
  ctx.clearRect(0, 0, W, H);
  // Forme : large en haut, dechiree en pointes en bas.
  const shape = new Path2D();
  shape.moveTo(6, 0);
  shape.lineTo(W - 6, 0);
  let x = W - 6;
  let y = 0;
  while (y < H * 0.7) {
    y += 10 + Math.random() * 16;
    x = W - 6 - Math.random() * 14 - (y / H) * 22;
    shape.lineTo(x, Math.min(y, H * 0.7));
  }
  // Bas dechire : des pointes de longueurs inegales.
  const teeth = 5;
  for (let i = 0; i < teeth; i++) {
    const x0 = x - ((x - 30) / teeth) * i;
    const x1 = x - ((x - 30) / teeth) * (i + 1);
    shape.lineTo((x0 + x1) / 2, H * (0.8 + Math.random() * 0.19));
    shape.lineTo(x1, H * (0.68 + Math.random() * 0.08));
  }
  shape.lineTo(6 + Math.random() * 10, H * 0.55);
  shape.closePath();
  ctx.save();
  ctx.clip(shape);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#cfa894");
  g.addColorStop(0.6, "#b98d7a");
  g.addColorStop(1, "#8e5e50");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Hematomes et taches.
  for (let i = 0; i < 9; i++) {
    const cx = Math.random() * W;
    const cy = Math.random() * H;
    const r = 6 + Math.random() * 20;
    const b = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    b.addColorStop(0, Math.random() < 0.5 ? "rgba(92,42,64,0.45)" : "rgba(120,70,40,0.35)");
    b.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = b;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  // Veines.
  ctx.strokeStyle = "rgba(80,60,110,0.35)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    let vx = Math.random() * W;
    let vy = Math.random() * H * 0.6;
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    for (let k = 0; k < 6; k++) {
      vx += (Math.random() - 0.5) * 14;
      vy += 8 + Math.random() * 10;
      ctx.lineTo(vx, vy);
    }
    ctx.stroke();
  }
  ctx.restore();
  // Bord dechire, sang seche.
  ctx.strokeStyle = "rgba(70,12,10,0.8)";
  ctx.lineWidth = 4;
  ctx.stroke(shape);
  // Points de suture en haut, la ou la peau etait cousue.
  ctx.strokeStyle = "rgba(30,20,18,0.9)";
  ctx.lineWidth = 1.5;
  for (let sx = 14; sx < W - 12; sx += 13) {
    ctx.beginPath();
    ctx.moveTo(sx - 4, 5);
    ctx.lineTo(sx + 4, 13);
    ctx.moveTo(sx + 4, 5);
    ctx.lineTo(sx - 4, 13);
    ctx.stroke();
  }
  return finish(canvas);
}

/** Peau grise du Voleur (corps dessine en code) : marbrures, veines, pores. */
function makeGreySkinTexture(): THREE.CanvasTexture {
  const S = 128;
  const { canvas, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#a19d93";
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = 8 + Math.random() * 26;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, Math.random() < 0.5 ? "rgba(70,68,74,0.35)" : "rgba(200,196,186,0.3)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.strokeStyle = "rgba(70,72,95,0.3)";
  for (let i = 0; i < 8; i++) {
    let x = Math.random() * S;
    let y = Math.random() * S;
    ctx.lineWidth = 0.6 + Math.random();
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 7; k++) {
      x += (Math.random() - 0.5) * 16;
      y += (Math.random() - 0.5) * 16;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(40,38,36,0.35)";
  for (let i = 0; i < 140; i++) ctx.fillRect(Math.random() * S, Math.random() * S, 1, 1);
  return finish(canvas, true);
}

type TextureKey = "visage-fetard" | "lambeaux" | "peau-grise";

const TEXTURE_MAKERS: Record<TextureKey, () => THREE.Texture> = {
  "visage-fetard": makePaintedFaceTexture,
  lambeaux: makeFlapTexture,
  "peau-grise": makeGreySkinTexture,
};

/** Textures partagees : dessinees une fois, liberees quand plus personne ne s'en sert. */
const sharedTextures = new Map<TextureKey, { tex: THREE.Texture; users: number }>();

function takeTexture(key: TextureKey): THREE.Texture {
  let entry = sharedTextures.get(key);
  if (!entry) {
    entry = { tex: TEXTURE_MAKERS[key](), users: 0 };
    sharedTextures.set(key, entry);
  }
  entry.users++;
  return entry.tex;
}

function releaseTexture(key: TextureKey) {
  const entry = sharedTextures.get(key);
  if (!entry) return;
  entry.users--;
  if (entry.users <= 0) {
    entry.tex.dispose();
    sharedTextures.delete(key);
  }
}

// ---------------------------------------------------------------------------
// Outils de sculpture
// ---------------------------------------------------------------------------

interface Kit {
  own: <T extends { dispose: () => void }>(x: T) => T;
  tex: (key: TextureKey) => THREE.Texture;
}

/** Membre tourne au tour, qui pend de son pivot (y = 0) jusqu'a y = -len. */
function limbGeo(r0: number, r1: number, len: number, bulge = 0): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [new THREE.Vector2(0.0001, 0)];
  const steps = 9;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let r = THREE.MathUtils.lerp(r0, r1, t) + bulge * Math.sin(Math.PI * t);
    // Articulations noueuses aux deux bouts.
    r += r0 * 0.22 * Math.exp(-Math.pow(t / 0.08, 2)) + r1 * 0.3 * Math.exp(-Math.pow((1 - t) / 0.07, 2));
    pts.push(new THREE.Vector2(r, -t * len));
  }
  pts.push(new THREE.Vector2(0.0001, -len));
  return new THREE.LatheGeometry(pts, 9);
}

/** Tronc tourne au tour a partir d'un profil [rayon, hauteur]. */
function latheGeo(profile: [number, number][], segments = 16): THREE.LatheGeometry {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );
}

function group(parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

function mesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/** Rapproche une rotation de sa cible (lissage exponentiel, sans allocation). */
function ease(o: THREE.Object3D, x: number, y: number, z: number, a: number) {
  o.rotation.x += (x - o.rotation.x) * a;
  o.rotation.y += (y - o.rotation.y) * a;
  o.rotation.z += (z - o.rotation.z) * a;
}

function easeY(o: THREE.Object3D, y: number, a: number) {
  o.position.y += (y - o.position.y) * a;
}

/**
 * Morceau de sphere unite pour une peinture de visage : 130 degres de large
 * centres sur +Z, de 60 a 135 degres depuis le sommet. Mis a l'echelle de la
 * tete, il colle a son devant comme un masque.
 */
function facePatchGeo(): THREE.SphereGeometry {
  const width = (130 * Math.PI) / 180;
  return new THREE.SphereGeometry(1, 28, 14, Math.PI / 2 - width / 2, width, (60 * Math.PI) / 180, (75 * Math.PI) / 180);
}

/** Point d'un ellipsoide : azimut `a` (0 = devant, + vers +X), angle `polar` depuis le sommet. */
function onEllipsoid(out: THREE.Vector3, center: THREE.Vector3, radii: THREE.Vector3, a: number, polar: number) {
  const s = Math.sin(polar);
  return out.set(center.x + radii.x * s * Math.sin(a), center.y + radii.y * Math.cos(polar), center.z + radii.z * s * Math.cos(a));
}

// ---------------------------------------------------------------------------
// Lambeaux de peau qui pendent (Voleur)
// ---------------------------------------------------------------------------

interface Flap {
  mesh: THREE.Mesh;
  /** Decalage de phase du balancement. */
  phase: number;
  /** Orientation autour de la verticale (0 : face vers l'avant du corps). */
  yaw: number;
}

/**
 * Les lambeaux pendent toujours vers le sol, quelle que soit la pose du
 * membre qui les porte : on annule la rotation de leur parent et on ne garde
 * que celle du monstre, plus un balancement.
 */
function hangFlaps(flaps: Flap[], owner: THREE.Object3D, time: number, swing: number) {
  if (!flaps.length) return;
  owner.getWorldQuaternion(groupQ);
  for (const f of flaps) {
    const parent = f.mesh.parent;
    if (!parent) continue;
    parent.getWorldQuaternion(tmpQ).invert().multiply(groupQ);
    tmpE.set(Math.sin(time * 1.9 + f.phase) * (0.08 + swing * 0.25), f.yaw, Math.sin(time * 1.3 + f.phase * 1.7) * (0.06 + swing * 0.15));
    tmpQ2.setFromEuler(tmpE);
    f.mesh.quaternion.copy(tmpQ).multiply(tmpQ2);
  }
}

// ---------------------------------------------------------------------------
// Corps dessines en code
// ---------------------------------------------------------------------------

interface CodeBody {
  root: THREE.Group;
  flaps: Flap[];
  /** Pose le corps selon l'animation choisie (meme nom que dans le modele). */
  pose(clip: string, p: MonsterPose, stride: number, clock: number, yaw: number, a: number): void;
}

// --- Le Fetard --------------------------------------------------------------

const FETARD_HIP = 0.95;

function buildFetardBody(k: Kit, faceMat: THREE.Material, facePatch: THREE.BufferGeometry): CodeBody {
  const skin = k.own(new THREE.MeshLambertMaterial({ color: MODEL.fetards.color }));
  const sphere = k.own(new THREE.SphereGeometry(1, 16, 12));
  const root = new THREE.Group();
  const body = group(root, 0, FETARD_HIP, 0);
  const pelvis = mesh(body, sphere, skin);
  pelvis.scale.set(0.16, 0.11, 0.12);
  const spine = group(body, 0, 0.04, 0);
  const torso = mesh(
    spine,
    k.own(
      latheGeo([
        [0.0001, -0.02],
        [0.14, 0.0],
        [0.15, 0.12],
        [0.145, 0.26],
        [0.16, 0.4],
        [0.175, 0.49],
        [0.13, 0.56],
        [0.05, 0.6],
        [0.0001, 0.61],
      ]),
    ),
    skin,
  );
  torso.scale.z = 0.72;
  const neck = group(spine, 0, 0.56, 0);
  mesh(neck, k.own(new THREE.CylinderGeometry(0.045, 0.05, 0.12, 10)), skin, 0, 0.04, 0);
  const head = group(neck, 0, 0.09, 0);
  // Tete lisse, un peu trop ronde, sans nez ni oreilles.
  const skullRadii = new THREE.Vector3(0.105, 0.135, 0.115);
  const skull = mesh(head, sphere, skin, 0, 0.07, 0.005);
  skull.scale.copy(skullRadii);
  const face = mesh(head, facePatch, faceMat, 0, 0.07, 0.005);
  face.scale.copy(skullRadii).multiplyScalar(1.035);

  const arms: { shoulder: THREE.Group; elbow: THREE.Group; side: number }[] = [];
  const upper = k.own(limbGeo(0.05, 0.04, 0.3, 0.006));
  const fore = k.own(limbGeo(0.042, 0.032, 0.28, 0.004));
  for (const side of [-1, 1]) {
    const shoulder = group(spine, side * 0.2, 0.5, 0);
    shoulder.rotation.z = side * 0.08;
    mesh(shoulder, upper, skin);
    const elbow = group(shoulder, 0, -0.3, 0);
    mesh(elbow, fore, skin);
    const hand = mesh(elbow, sphere, skin, 0, -0.31, 0);
    hand.scale.set(0.036, 0.055, 0.024);
    arms.push({ shoulder, elbow, side });
  }
  const legs: { hip: THREE.Group; knee: THREE.Group; side: number }[] = [];
  const thigh = k.own(limbGeo(0.075, 0.055, 0.44, 0.01));
  const shin = k.own(limbGeo(0.056, 0.04, 0.42, 0.006));
  const footGeo = k.own(new THREE.BoxGeometry(0.09, 0.06, 0.2));
  for (const side of [-1, 1]) {
    const hip = group(body, side * 0.095, -0.03, 0);
    mesh(hip, thigh, skin);
    const knee = group(hip, 0, -0.44, 0);
    mesh(knee, shin, skin);
    mesh(knee, footGeo, skin, 0, -0.45, 0.05);
    legs.push({ hip, knee, side });
  }

  return {
    root,
    flaps: [],
    pose(clip, p, stride, clock, yaw, a) {
      const run = clip === "Course";
      const walk = run || clip === "Marche";
      const amp = walk ? (run ? 0.8 : 0.5) * Math.min(1, 0.4 + p.speed / 2) : 0;
      const beat = clock * 7.6;
      const dance = clip === "Danse";
      const wave = clip === "Salut";
      const attack = clip === "Attaque";

      easeY(body, FETARD_HIP + (walk ? Math.abs(Math.cos(stride)) * 0.035 : dance ? -Math.abs(Math.sin(beat)) * 0.06 : Math.sin(clock * 1.6) * 0.006), a);
      ease(body, attack ? 0.28 : run ? 0.2 : 0.02, 0, dance ? Math.sin(beat * 0.5) * 0.13 : 0, a);
      ease(spine, 0, walk ? Math.sin(stride) * 0.12 : 0, dance ? -Math.sin(beat * 0.5) * 0.1 : 0, a);

      for (const leg of legs) {
        const ph = stride + (leg.side > 0 ? 0 : Math.PI);
        const bend = dance ? Math.abs(Math.sin(beat)) * 0.35 : 0;
        ease(leg.hip, walk ? -Math.sin(ph) * amp : -bend * 0.6, 0, leg.side * 0.03, a);
        ease(leg.knee, walk ? Math.max(0, Math.cos(ph)) * amp * 1.4 + 0.05 : bend + 0.04, 0, 0, a);
      }
      for (const arm of arms) {
        const ph = stride + (arm.side > 0 ? Math.PI : 0);
        let sx = walk ? Math.sin(ph) * amp * 0.9 : Math.sin(clock * 1.3 + arm.side) * 0.03;
        let sz = arm.side * 0.08;
        let ex = walk ? -0.25 - amp * 0.3 : -0.1;
        let ez = 0;
        if (dance) {
          // Bras en l'air, en rythme : une fete ou personne ne s'amuse.
          sx = -0.3;
          sz = arm.side * (2.3 + Math.sin(beat + (arm.side > 0 ? 0 : Math.PI)) * 0.45);
          ez = arm.side * (0.5 + Math.sin(beat * 2) * 0.3);
          ex = 0;
        } else if (wave && arm.side < 0) {
          // Coucou de la main droite, bras leve, l'avant-bras qui balance.
          sx = -0.25;
          sz = -2.55;
          ex = 0;
          ez = -0.35 + Math.sin(clock * 11) * 0.55;
        } else if (attack) {
          sx = -1.45 + Math.sin(clock * 13 + arm.side) * 0.2;
          sz = arm.side * 0.15;
          ex = -0.2;
        }
        ease(arm.shoulder, sx, 0, sz, a);
        ease(arm.elbow, ex, 0, ez, a);
      }
      // La tete penche, toujours tournee vers toi.
      const tilt = wave ? 0.3 : dance ? Math.sin(beat) * 0.15 : 0.18 + Math.sin(clock * 0.7) * 0.05;
      ease(head, attack ? 0.25 : 0, yaw, tilt, a);
    },
  };
}

// --- Le Chien ---------------------------------------------------------------

const DOG_BACK = 0.72;

function buildChienBody(k: Kit, eyeMat: THREE.Material): CodeBody {
  const skin = k.own(new THREE.MeshLambertMaterial({ color: MODEL.chiens.color }));
  const hairMat = k.own(new THREE.MeshLambertMaterial({ color: 0x060506 }));
  const toothMat = k.own(new THREE.MeshLambertMaterial({ color: 0x9c9175 }));
  const sphere = k.own(new THREE.SphereGeometry(1, 14, 10));
  const cone = k.own(new THREE.ConeGeometry(0.5, 1, 5));
  cone.translate(0, -0.5, 0);
  const root = new THREE.Group();
  const body = group(root, 0, DOG_BACK, 0);

  // Tronc maigre et long, a l'horizontale : hanches a l'arriere, cage devant.
  const torso = mesh(
    body,
    k.own(
      latheGeo(
        [
          [0.0001, -0.02],
          [0.08, 0.0],
          [0.095, 0.12],
          [0.075, 0.35],
          [0.085, 0.55],
          [0.13, 0.75],
          [0.125, 0.9],
          [0.06, 0.98],
          [0.0001, 1.0],
        ],
        14,
      ),
    ),
    skin,
    0,
    0,
    -0.56,
  );
  torso.rotation.x = Math.PI / 2;
  torso.scale.set(0.95, 1, 0.85);
  // Colonne qui pointe sous la peau, poils colles en meches.
  const bumps = new THREE.InstancedMesh(sphere, skin, 14);
  const hair = new THREE.InstancedMesh(cone, hairMat, 16);
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    for (let i = 0; i < 14; i++) {
      const z = -0.52 + i * 0.07;
      pos.set(0, 0.075 + Math.sin((i / 13) * Math.PI) * 0.03, z);
      scl.set(0.018, 0.022, 0.026);
      m.compose(pos, q.identity(), scl);
      bumps.setMatrixAt(i, m);
    }
    for (let i = 0; i < 16; i++) {
      const side = i % 2 ? 1 : -1;
      const z = 0.05 + (i / 15) * 0.45;
      pos.set(side * (0.04 + Math.random() * 0.06), 0.06, z);
      e.set(0.3 + Math.random() * 0.3, 0, side * (0.3 + Math.random() * 0.5));
      q.setFromEuler(e);
      scl.set(0.02, 0.14 + Math.random() * 0.2, 0.02);
      m.compose(pos, q, scl);
      hair.setMatrixAt(i, m);
    }
    bumps.instanceMatrix.needsUpdate = true;
    hair.instanceMatrix.needsUpdate = true;
    bumps.computeBoundingSphere();
    hair.computeBoundingSphere();
  }
  body.add(bumps, hair);

  // Pattes avant (des bras) et arriere (des jambes), longues et fines.
  const front: { shoulder: THREE.Group; elbow: THREE.Group; side: number }[] = [];
  const upperArm = k.own(limbGeo(0.042, 0.03, 0.36, 0.006));
  const foreArm = k.own(limbGeo(0.032, 0.022, 0.32, 0.004));
  const clawGeo = k.own(new THREE.ConeGeometry(0.006, 0.05, 4));
  clawGeo.rotateX(Math.PI / 2);
  for (const side of [-1, 1]) {
    const shoulder = group(body, side * 0.14, -0.03, 0.3);
    mesh(shoulder, upperArm, skin);
    const elbow = group(shoulder, 0, -0.36, 0);
    mesh(elbow, foreArm, skin);
    const hand = mesh(elbow, sphere, skin, 0, -0.33, 0.02);
    hand.scale.set(0.035, 0.014, 0.05);
    for (let c = -1; c <= 1; c++) mesh(elbow, clawGeo, toothMat, c * 0.018, -0.335, 0.07);
    front.push({ shoulder, elbow, side });
  }
  const back: { hip: THREE.Group; knee: THREE.Group; side: number }[] = [];
  const thigh = k.own(limbGeo(0.05, 0.034, 0.38, 0.01));
  const shin = k.own(limbGeo(0.034, 0.024, 0.42, 0.004));
  const foot = k.own(limbGeo(0.022, 0.014, 0.17, 0.002));
  for (const side of [-1, 1]) {
    const hip = group(body, side * 0.12, -0.02, -0.5);
    mesh(hip, thigh, skin);
    const knee = group(hip, 0, -0.38, 0);
    mesh(knee, shin, skin);
    const ankle = group(knee, 0, -0.42, 0);
    const f = mesh(ankle, foot, skin);
    f.rotation.x = -1.3;
    back.push({ hip, knee, side });
  }

  // Cou tendu vers l'avant, tete basse : un crane humain etire, machoire qui pend.
  const neck = group(body, 0, 0.04, 0.4);
  mesh(neck, k.own(limbGeo(0.04, 0.032, 0.26, 0.004)), skin);
  const head = group(neck, 0, -0.27, 0);
  const skull = mesh(head, sphere, skin, 0, 0.0, 0.04);
  skull.scale.set(0.078, 0.075, 0.12);
  const brow = mesh(head, sphere, skin, 0, 0.03, 0.1);
  brow.scale.set(0.07, 0.03, 0.05);
  const eyeGeo = k.own(new THREE.SphereGeometry(1, 10, 8));
  for (const side of [-1, 1]) {
    const eye = mesh(head, eyeGeo, eyeMat, side * 0.036, 0.012, 0.143);
    eye.scale.set(0.017, 0.011, 0.01);
  }
  const jaw = group(head, 0, -0.03, -0.02);
  const jawBone = mesh(jaw, sphere, skin, 0, -0.012, 0.09);
  jawBone.scale.set(0.055, 0.022, 0.08);
  const teeth = new THREE.InstancedMesh(cone, toothMat, 10);
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    for (let i = 0; i < 10; i++) {
      const t = (i / 9 - 0.5) * 2.2;
      pos.set(Math.sin(t) * 0.045, 0.012, 0.09 + Math.cos(t) * 0.06);
      q.setFromEuler(new THREE.Euler(Math.PI, 0, 0));
      scl.set(0.008, 0.03 + Math.random() * 0.02, 0.008);
      m.compose(pos, q, scl);
      teeth.setMatrixAt(i, m);
    }
    teeth.instanceMatrix.needsUpdate = true;
    teeth.computeBoundingSphere();
  }
  jaw.add(teeth);

  let snapUntil = 0;
  let snap = 0;
  return {
    root,
    flaps: [],
    pose(clip, p, stride, clock, yaw, a) {
      const moving = clip === "Rampe";
      const crouch = clip === "Tapie";
      const attack = clip === "Attaque";
      const howl = clip === "Cri";
      const run = THREE.MathUtils.clamp((p.speed - 1.2) / 4, 0, 1);
      const amp = moving ? 0.3 + run * 0.4 : 0;

      easeY(body, crouch ? 0.5 : attack ? 0.6 : DOG_BACK - run * 0.1 + (moving ? Math.abs(Math.sin(stride)) * 0.035 : 0), a);
      ease(body, attack ? 0.18 : howl ? -0.2 : moving ? Math.sin(stride * 2) * 0.03 : 0.05, 0, moving ? Math.sin(stride) * 0.04 : 0, a);

      // Trot : patte avant gauche avec l'arriere droite, et inversement.
      for (const leg of front) {
        const ph = stride + (leg.side > 0 ? 0 : Math.PI);
        let sx = -0.1 - Math.sin(ph) * amp;
        let ex = 0.15 + Math.max(0, Math.cos(ph)) * amp * 1.3;
        if (crouch) {
          sx = -0.55;
          ex = 1.05;
        } else if (attack) {
          sx = -1.25 + Math.sin(clock * 12 + leg.side) * 0.25;
          ex = 0.1;
        } else if (howl) {
          sx = 0.25;
          ex = 0.05;
        }
        ease(leg.shoulder, sx, 0, leg.side * 0.06, a);
        ease(leg.elbow, ex, 0, 0, a);
      }
      for (const leg of back) {
        const ph = stride + (leg.side > 0 ? Math.PI : 0);
        let hx = -0.55 - Math.sin(ph) * amp;
        let kx = 1.1 + Math.max(0, Math.cos(ph)) * amp;
        if (crouch) {
          hx = -1.15;
          kx = 1.95;
        } else if (attack) {
          hx = -0.35;
          kx = 0.7;
        }
        ease(leg.hip, hx, 0, leg.side * 0.05, a);
        ease(leg.knee, kx, 0, 0, a);
      }

      // Tete : il ne voit rien, il renifle ; il leve le museau pour hurler.
      // `pitch` est l'inclinaison voulue du visage (+ vers le sol), cou compris.
      const neckX = howl ? -0.55 : attack ? -1.45 : crouch ? -1.4 : -1.22 + run * 0.15;
      const pitch = howl ? -0.6 : attack ? 0 : crouch ? 0.35 : 0.1;
      ease(neck, neckX, 0, 0, a);
      const sniff = crouch || moving ? Math.sin(clock * 9) * 0.06 : 0;
      ease(head, -neckX + pitch + sniff, yaw, 0, a);
      if (clock > snapUntil) {
        snapUntil = clock + 0.15 + Math.random() * 1.2;
        snap = Math.random() < 0.3 ? 0.3 : 0;
      }
      const open = howl ? 0.75 + Math.sin(clock * 30) * 0.05 : attack ? 0.55 + Math.sin(clock * 16) * 0.2 : Math.max(p.scream * 0.8, snap);
      ease(jaw, open, 0, 0, a);
    },
  };
}

// --- Le Voleur de peau --------------------------------------------------------

const THIEF_HIP = 1.02;

function buildVoleurBody(k: Kit, socketMat: THREE.Material, flapMat: THREE.Material, flapGeo: THREE.BufferGeometry): CodeBody {
  const skin = k.own(new THREE.MeshLambertMaterial({ map: k.tex("peau-grise") }));
  const ribMat = k.own(new THREE.MeshLambertMaterial({ color: 0xbdb8ac }));
  const sphere = k.own(new THREE.SphereGeometry(1, 14, 10));
  const root = new THREE.Group();
  const body = group(root, 0, THIEF_HIP, 0);
  const pelvis = mesh(body, sphere, skin);
  pelvis.scale.set(0.13, 0.08, 0.09);

  // Dos voute, tronc etroit ou l'on compte les cotes.
  const spine = group(body, 0, 0.04, 0);
  spine.rotation.x = 0.45;
  const torso = mesh(
    spine,
    k.own(
      latheGeo([
        [0.0001, -0.02],
        [0.09, 0.0],
        [0.068, 0.15],
        [0.078, 0.3],
        [0.115, 0.48],
        [0.135, 0.6],
        [0.1, 0.7],
        [0.04, 0.74],
        [0.0001, 0.75],
      ]),
    ),
    skin,
  );
  torso.scale.z = 0.62;
  const ribs = new THREE.InstancedMesh(k.own(new THREE.TorusGeometry(1, 0.08, 4, 12, Math.PI)), ribMat, 6);
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    for (let i = 0; i < 6; i++) {
      const y = 0.38 + i * 0.05;
      const r = 0.1 + Math.sin((i / 5) * Math.PI * 0.8 + 0.3) * 0.03;
      pos.set(0, y, 0.005);
      scl.set(r, r * 0.66, 0.08);
      m.compose(pos, q, scl);
      ribs.setMatrixAt(i, m);
    }
    ribs.instanceMatrix.needsUpdate = true;
    ribs.computeBoundingSphere();
  }
  spine.add(ribs);

  const neck = group(spine, 0, 0.72, 0);
  neck.rotation.x = 0.35;
  const neckMesh = mesh(neck, k.own(limbGeo(0.03, 0.042, 0.2, 0.004)), skin);
  neckMesh.rotation.x = Math.PI;
  const head = group(neck, 0, 0.21, 0);
  // Visage trop long, orbites creuses, bouche etiree en fente.
  const skull = mesh(head, sphere, skin, 0, 0.1, 0);
  skull.scale.set(0.085, 0.14, 0.1);
  const socketGeo = k.own(new THREE.SphereGeometry(1, 10, 8));
  for (const side of [-1, 1]) {
    const socket = mesh(head, socketGeo, socketMat, side * 0.034, 0.13, 0.082);
    socket.scale.set(0.024, 0.032, 0.012);
  }
  const mouth = mesh(head, k.own(new THREE.BoxGeometry(1, 1, 1)), socketMat, 0, 0.02, 0.092);
  mouth.scale.set(0.06, 0.007, 0.01);

  // Bras trop longs : les doigts descendent plus bas que les genoux.
  const arms: { shoulder: THREE.Group; elbow: THREE.Group; wrist: THREE.Group; side: number }[] = [];
  const upper = k.own(limbGeo(0.04, 0.03, 0.52, 0.006));
  const fore = k.own(limbGeo(0.032, 0.022, 0.56, 0.004));
  const finger = k.own(limbGeo(0.011, 0.006, 0.2, 0.001));
  for (const side of [-1, 1]) {
    const shoulder = group(spine, side * 0.19, 0.66, 0);
    mesh(shoulder, upper, skin);
    const elbow = group(shoulder, 0, -0.52, 0);
    mesh(elbow, fore, skin);
    const wrist = group(elbow, 0, -0.56, 0);
    const palm = mesh(wrist, sphere, skin, 0, -0.03, 0);
    palm.scale.set(0.035, 0.05, 0.018);
    for (let f = 0; f < 4; f++) {
      const fg = mesh(wrist, finger, skin, (f - 1.5) * 0.017, -0.06, 0);
      fg.rotation.z = (f - 1.5) * 0.08;
      fg.rotation.x = -0.25;
    }
    arms.push({ shoulder, elbow, wrist, side });
  }
  const legs: { hip: THREE.Group; knee: THREE.Group; side: number }[] = [];
  const thigh = k.own(limbGeo(0.055, 0.035, 0.5, 0.008));
  const shin = k.own(limbGeo(0.04, 0.025, 0.5, 0.004));
  const foot = k.own(limbGeo(0.025, 0.016, 0.2, 0.002));
  for (const side of [-1, 1]) {
    const hip = group(body, side * 0.1, -0.02, 0);
    mesh(hip, thigh, skin);
    const knee = group(hip, 0, -0.5, 0);
    mesh(knee, shin, skin);
    const ankle = group(knee, 0, -0.5, 0);
    const f = mesh(ankle, foot, skin);
    f.rotation.x = -1.35;
    legs.push({ hip, knee, side });
  }

  // Lambeaux de peau humaine, cousus ici et la, qui pendent.
  const flaps: Flap[] = [];
  const addFlap = (parent: THREE.Object3D, x: number, y: number, z: number, w: number, len: number, yaw: number) => {
    const m = mesh(parent, flapGeo, flapMat, x, y, z);
    m.scale.set(w, len, 1);
    flaps.push({ mesh: m, phase: Math.random() * Math.PI * 2, yaw });
  };
  addFlap(spine, 0.05, 0.52, 0.09, 0.13, 0.36, 0);
  addFlap(spine, -0.04, 0.6, -0.08, 0.17, 0.46, Math.PI);
  addFlap(arms[1].elbow, 0.02, -0.22, 0.02, 0.08, 0.28, Math.PI / 2);
  addFlap(arms[0].shoulder, -0.02, -0.28, -0.02, 0.07, 0.22, -Math.PI / 2);
  addFlap(legs[1].hip, 0.03, -0.18, 0.05, 0.1, 0.3, 0.3);

  let twitchUntil = 0;
  let twitchX = 0;
  let twitchZ = 0;
  return {
    root,
    flaps,
    pose(clip, p, stride, clock, yaw, a) {
      const run = clip === "Course";
      const walk = run || clip === "Rode";
      const crawl = clip === "Rampe";
      const crouch = clip === "Tapie";
      const listen = clip === "Ecoute";
      const attack = clip === "Attaque";
      const amp = walk ? (run ? 0.75 : 0.42) : crawl ? 0.35 : 0;

      easeY(body, crouch ? 0.64 : crawl ? 0.55 : THIEF_HIP - (walk ? 0.06 : 0) + (walk ? Math.abs(Math.cos(stride)) * 0.03 : 0), a);
      const spineX = crawl ? 1.3 : crouch ? 0.85 : run ? 0.75 : listen ? 0.2 : attack ? 0.3 : 0.5;
      const neckX = crawl ? -0.9 : crouch ? -0.3 : 0.35;
      ease(spine, spineX, walk ? Math.sin(stride) * 0.1 : 0, 0, a);

      for (const leg of legs) {
        const ph = stride + (leg.side > 0 ? 0 : Math.PI);
        let hx = walk ? -Math.sin(ph) * amp - 0.15 : -0.12;
        let kx = walk ? Math.max(0, Math.cos(ph)) * amp * 1.5 + 0.35 : 0.25;
        if (crouch) {
          hx = -1.25;
          kx = 2.0;
        } else if (crawl) {
          hx = -1.35 - Math.sin(ph + Math.PI) * amp;
          kx = 1.9;
        }
        ease(leg.hip, hx, 0, leg.side * 0.04, a);
        ease(leg.knee, kx, 0, 0, a);
      }
      for (const arm of arms) {
        const ph = stride + (arm.side > 0 ? Math.PI : 0);
        // Les bras pendent et balancent, trop longs pour le corps.
        let sx = walk ? Math.sin(ph) * amp * 0.6 - 0.3 : -0.3 + Math.sin(clock * 1.1 + arm.side) * 0.04;
        let sz = arm.side * 0.12;
        let ex = walk ? -0.2 : -0.1;
        if (crawl) {
          sx = -1.2 + Math.sin(ph) * amp;
          ex = 0.25;
        } else if (crouch) {
          sx = -0.75;
          ex = -0.2;
        } else if (attack) {
          sx = -2.1 + Math.sin(clock * 10 + arm.side) * 0.3;
          sz = arm.side * 0.35;
          ex = -0.25;
        }
        ease(arm.shoulder, sx, 0, sz, a);
        ease(arm.elbow, ex, 0, 0, a);
        ease(arm.wrist, attack ? -0.4 : -0.1, 0, 0, a);
      }
      // Des tics secs de la tete, puis plus rien.
      if (clock > twitchUntil) {
        twitchUntil = clock + 0.4 + Math.random() * 2.4;
        twitchX = (Math.random() - 0.5) * 0.4;
        twitchZ = (Math.random() - 0.5) * 0.6;
      }
      ease(neck, neckX, 0, 0, a);
      // Le dos est voute, mais le visage reste droit : il te fixe.
      ease(head, -(spineX + neckX) + 0.1 + twitchX + (attack ? 0.2 : 0), yaw, (listen ? 0.45 : 0) + twitchZ, Math.min(1, a * 2.5));
    },
  };
}

// ---------------------------------------------------------------------------
// Habillage du modele anime
// ---------------------------------------------------------------------------

/**
 * Sommets portes par un os (et ses descendants si `withChildren`), dans le
 * repere de `frame`, pour la pose courante. Sert a coller visage, yeux et
 * lambeaux sur le vrai corps, quelles que soient ses proportions.
 */
function boneRegion(model: AnimatedModel, boneName: string, frame: THREE.Object3D, withChildren: boolean): THREE.Vector3[] {
  const bone = model.bone(boneName);
  if (!bone) return [];
  model.root.updateMatrixWorld(true);
  const toFrame = new THREE.Matrix4().copy(frame.matrixWorld).invert();
  const out: THREE.Vector3[] = [];
  model.root.traverse((o) => {
    const skinned = o as THREE.SkinnedMesh;
    if (!skinned.isSkinnedMesh) return;
    const inRegion = skinned.skeleton.bones.map((b) => {
      let cur: THREE.Object3D | null = b;
      while (cur) {
        if (cur === bone) return true;
        if (!withChildren) return false;
        cur = cur.parent;
      }
      return false;
    });
    const geo = skinned.geometry;
    const pos = geo.getAttribute("position");
    const si = geo.getAttribute("skinIndex");
    const sw = geo.getAttribute("skinWeight");
    if (!pos || !si || !sw) return;
    for (let i = 0; i < pos.count; i++) {
      let best = 0;
      let bestW = -1;
      for (let c = 0; c < 4; c++) {
        const w = sw.getComponent(i, c);
        if (w > bestW) {
          bestW = w;
          best = si.getComponent(i, c);
        }
      }
      if (!inRegion[best]) continue;
      const v = new THREE.Vector3().fromBufferAttribute(pos as THREE.BufferAttribute, i);
      skinned.applyBoneTransform(i, v);
      v.applyMatrix4(skinned.matrixWorld).applyMatrix4(toFrame);
      out.push(v);
    }
  });
  return out;
}

/** Plus bas sommet du corps anime (repere de `root`), dans la pose courante. */
function skinnedMinY(root: THREE.Object3D): number {
  root.updateMatrixWorld(true);
  let min = Infinity;
  const v = new THREE.Vector3();
  root.traverse((o) => {
    const skinned = o as THREE.SkinnedMesh;
    if (!skinned.isSkinnedMesh) return;
    const pos = skinned.geometry.getAttribute("position");
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      skinned.getVertexPosition(i, v);
      v.applyMatrix4(skinned.matrixWorld);
      if (v.y < min) min = v.y;
    }
  });
  return min;
}

/** Pose d'une animation a sa premiere image, puis plus bas sommet. */
function sampleMinY(model: AnimatedModel, clip: string): number {
  model.play(clip, { fade: 0, restart: true, loop: true });
  model.update(1e-4);
  return skinnedMinY(model.root);
}

interface HeadFit {
  center: THREE.Vector3;
  /** Demi-dimensions de la tete, deja agrandies pour passer devant 95 % des sommets du visage. */
  radii: THREE.Vector3;
}

/** Ellipsoide qui enveloppe la tete du modele, dans le repere du pivot accroche a l'os. */
function fitHead(model: AnimatedModel, pivot: THREE.Object3D): HeadFit | null {
  const pts = boneRegion(model, "head", pivot, true);
  if (pts.length < 8) return null;
  const box = new THREE.Box3().setFromPoints(pts);
  const center = box.getCenter(new THREE.Vector3());
  const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  if (half.x < 1e-4 || half.y < 1e-4 || half.z < 1e-4) return null;
  const norms = pts
    .filter((p) => p.z > center.z)
    .map((p) => Math.hypot((p.x - center.x) / half.x, (p.y - center.y) / half.y, (p.z - center.z) / half.z))
    .sort((x, y) => x - y);
  const p95 = norms.length ? norms[Math.floor(0.95 * (norms.length - 1))] : 1;
  const k = THREE.MathUtils.clamp(p95 + 0.03, 1, 1.35);
  return { center, radii: half.multiplyScalar(k) };
}

// ---------------------------------------------------------------------------
// Le monstre complet
// ---------------------------------------------------------------------------

export function buildMonster(kind: MonsterKind): Monster {
  const owned: { dispose: () => void }[] = [];
  const textureKeys: TextureKey[] = [];
  const kit: Kit = {
    own: (x) => {
      owned.push(x);
      return x;
    },
    tex: (key) => {
      textureKeys.push(key);
      return takeTexture(key);
    },
  };

  // Pieces partagees entre le corps en code et le modele.
  const faceMat =
    kind === "fetards"
      ? kit.own(new THREE.MeshLambertMaterial({ map: kit.tex("visage-fetard"), transparent: true, depthWrite: false, alphaTest: 0.02 }))
      : null;
  const facePatch = kind === "fetards" ? kit.own(facePatchGeo()) : null;
  // Les yeux des Chiens ne dependent ni de la lumiere ni du brouillard : deux
  // points pales dans le noir, au bout du couloir.
  const eyeMat = kind === "chiens" ? kit.own(new THREE.MeshBasicMaterial({ color: 0xd6d1b8, fog: false })) : null;
  const socketMat = kind === "voleur" ? kit.own(new THREE.MeshBasicMaterial({ color: 0x030202 })) : null;
  const flapMat =
    kind === "voleur" ? kit.own(new THREE.MeshLambertMaterial({ map: kit.tex("lambeaux"), side: THREE.DoubleSide, alphaTest: 0.45 })) : null;
  let flapGeo: THREE.PlaneGeometry | null = null;
  if (kind === "voleur") {
    flapGeo = kit.own(new THREE.PlaneGeometry(1, 1, 1, 4));
    flapGeo.translate(0, -0.5, 0);
    // Le lambeau se recourbe un peu vers l'exterieur en bas.
    const pos = flapGeo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const t = -pos.getY(i);
      pos.setZ(i, t * t * 0.12);
    }
    flapGeo.computeVertexNormals();
  }

  const codeBody =
    kind === "fetards"
      ? buildFetardBody(kit, faceMat!, facePatch!)
      : kind === "chiens"
        ? buildChienBody(kit, eyeMat!)
        : buildVoleurBody(kit, socketMat!, flapMat!, flapGeo!);

  const root = new THREE.Group();
  root.name = `monstre-${kind}`;
  root.add(codeBody.root);
  // Pose de depart posee d'un coup, sans lissage : pas de pantin qui se deplie.
  codeBody.pose(kind === "fetards" ? "Attente" : "Tapie", REST_POSE, 0, 0, 0, 1);
  hangFlaps(codeBody.flaps, root, 0, 0);

  let disposed = false;
  let model: AnimatedModel | null = null;
  let modelFlaps: Flap[] = [];
  let headBone: THREE.Object3D | null = null;
  const headUp = new THREE.Vector3(0, 1, 0);
  const headAnimQ = new THREE.Quaternion();
  const headTurn = kind === "chiens" ? 0.7 : 1;

  let clock = 0;
  let stride = 0;
  let idleFor = 0;
  let clip = "";
  let holdClip = "";
  let holdUntil = 0;
  let lastScream = 0;
  let lastScreamAt = -10;
  let yawShown = 0;
  let twitchYaw = 0;
  let twitchUntil = 0;

  /** Animations du modele a ne pas jouer (absentes, ou qui demarrent en l'air). */
  const unusable = new Set<string>();

  /**
   * Habille le modele charge : taille, couleur, visage, lambeaux. Renvoie la
   * hauteur dont il faut le remonter pour poser ses pieds au sol.
   */
  function dress(m: AnimatedModel): number {
    if (FIX_REST_HEIGHT) {
      // Pose de repos (aucune animation active apres createAnimatedModel).
      m.root.updateMatrixWorld(true);
      const rest = new THREE.Box3().setFromObject(m.root, true);
      const h = rest.max.y - rest.min.y;
      if (h > 0.2) m.root.scale.setScalar(MODEL[kind].height / h);
    }
    m.tint(() => true, MODEL[kind].color);

    const head = new THREE.Group();
    if (m.attach("head", head)) {
      const fit = fitHead(m, head);
      if (fit) {
        const v = new THREE.Vector3();
        if (kind === "fetards" && faceMat && facePatch) {
          const face = new THREE.Mesh(facePatch, faceMat);
          face.position.copy(fit.center);
          face.scale.copy(fit.radii);
          head.add(face);
        } else if (kind === "chiens" && eyeMat) {
          const eyeGeo = kit.own(new THREE.SphereGeometry(1, 10, 8));
          for (const side of [-1, 1]) {
            const eye = new THREE.Mesh(eyeGeo, eyeMat);
            onEllipsoid(v, fit.center, fit.radii, side * 0.32, (86 * Math.PI) / 180);
            eye.position.copy(v);
            eye.scale.set(fit.radii.x * 0.22, fit.radii.x * 0.13, fit.radii.x * 0.1);
            eye.rotation.y = side * 0.32;
            head.add(eye);
          }
        } else if (kind === "voleur" && socketMat) {
          const socketGeo = kit.own(new THREE.SphereGeometry(1, 10, 8));
          for (const side of [-1, 1]) {
            const socket = new THREE.Mesh(socketGeo, socketMat);
            onEllipsoid(v, fit.center, fit.radii, side * 0.34, (84 * Math.PI) / 180);
            socket.position.copy(v);
            socket.scale.set(fit.radii.x * 0.3, fit.radii.x * 0.4, fit.radii.x * 0.12);
            socket.rotation.y = side * 0.34;
            head.add(socket);
          }
          const mouth = new THREE.Mesh(kit.own(new THREE.BoxGeometry(1, 1, 1)), socketMat);
          onEllipsoid(v, fit.center, fit.radii, 0, (118 * Math.PI) / 180);
          mouth.position.copy(v);
          mouth.scale.set(fit.radii.x * 0.75, fit.radii.y * 0.05, fit.radii.z * 0.08);
          mouth.rotation.x = -0.35;
          head.add(mouth);
        }
      }
      headBone = m.bone("head");
    }

    if (kind === "voleur" && flapMat && flapGeo) {
      // Lambeaux accroches aux os : poitrine, dos, avant-bras, bras, cuisse.
      const u = 1 / m.root.scale.x;
      const spots: { bone: string; w: number; len: number; yaw: number; place: (pts: THREE.Vector3[], out: THREE.Vector3) => boolean }[] = [
        { bone: "spine_03", w: 0.14, len: 0.38, yaw: 0, place: (pts, out) => front(pts, out, 0.3, 1) },
        { bone: "spine_02", w: 0.18, len: 0.48, yaw: Math.PI, place: (pts, out) => front(pts, out, -0.4, -1) },
        { bone: "lowerarm_l", w: 0.08, len: 0.28, yaw: Math.PI / 2, place: (pts, out) => middle(pts, out) },
        { bone: "upperarm_r", w: 0.07, len: 0.24, yaw: -Math.PI / 2, place: (pts, out) => middle(pts, out) },
        { bone: "thigh_r", w: 0.1, len: 0.3, yaw: 0.3, place: (pts, out) => front(pts, out, 0, 1) },
      ];
      for (const spot of spots) {
        const pivot = new THREE.Group();
        if (!m.attach(spot.bone, pivot)) continue;
        const pts = boneRegion(m, spot.bone, pivot, false);
        const at = new THREE.Vector3();
        if (!spot.place(pts, at)) {
          pivot.removeFromParent();
          continue;
        }
        const flap = new THREE.Mesh(flapGeo, flapMat);
        flap.position.copy(at);
        flap.scale.set(spot.w * u, spot.len * u, u);
        pivot.add(flap);
        modelFlaps.push({ mesh: flap, phase: Math.random() * Math.PI * 2, yaw: spot.yaw });
      }
    }

    if (headBone) {
      // Axe « vertical » de la tete, dans son propre repere (pose de repos) :
      // la tete tourne vers le joueur autour de lui, quel que soit l'os.
      m.root.updateMatrixWorld(true);
      headBone.getWorldQuaternion(tmpQ);
      headUp.set(0, 1, 0).applyQuaternion(tmpQ.invert()).normalize();
      headAnimQ.copy(headBone.quaternion);
    }

    // Pieds au sol. createAnimatedModel cale le modele sur la premiere image
    // de sa premiere animation (« Attaque ») : si elle commence en l'air, tout
    // le reste passe sous le plancher. On recale sur une pose debout.
    const groundClip = GROUND_CLIP[kind];
    const ground = m.has(groundClip) ? sampleMinY(m, groundClip) : skinnedMinY(m.root);
    const lift = Number.isFinite(ground) ? -ground : 0;
    // Une animation qui demarre a plus de 80 cm du sol (le Chien qui tombe du
    // plafond) est remplacee : elle traverserait le plafond.
    for (const name of CLIPS[kind]) {
      if (!m.has(name) || sampleMinY(m, name) + lift > AIRBORNE) unusable.add(name);
    }
    return lift;
  }

  /** L'animation a jouer vraiment : les absentes ou inutilisables sont remplacees. */
  function resolveClip(name: string): string {
    if (!unusable.has(name)) return name;
    const spare = SPARE_CLIP[kind];
    return unusable.has(spare) ? clip : spare;
  }

  /** Point de la surface avant (sens `dir` : +1 devant, -1 derriere), a une hauteur relative `rel` (-1 bas, +1 haut). */
  function front(pts: THREE.Vector3[], out: THREE.Vector3, rel: number, dir: number): boolean {
    if (pts.length < 4) return false;
    const box = new THREE.Box3().setFromPoints(pts);
    const c = box.getCenter(new THREE.Vector3());
    const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    out.set(c.x, c.y + rel * half.y, dir > 0 ? box.max.z + 0.01 : box.min.z - 0.01);
    return true;
  }

  /** Dessous du milieu d'un membre (bras en croix au repos). */
  function middle(pts: THREE.Vector3[], out: THREE.Vector3): boolean {
    if (pts.length < 4) return false;
    const box = new THREE.Box3().setFromPoints(pts);
    box.getCenter(out);
    out.y = box.min.y;
    return true;
  }

  createAnimatedModel(MODEL[kind].id, MODEL[kind].height)
    .then((m) => {
      if (disposed) {
        m.dispose();
        return;
      }
      let lift = 0;
      try {
        lift = dress(m);
      } catch {
        // Habillage rate : on garde le corps en code, plutot qu'un modele a moitie pret.
        m.dispose();
        modelFlaps = [];
        headBone = null;
        return;
      }
      codeBody.root.visible = false;
      const holder = new THREE.Group();
      holder.position.y = lift;
      holder.add(m.root);
      root.add(holder);
      clip = resolveClip(kind === "fetards" ? "Attente" : "Tapie");
      m.play(clip, { fade: 0, restart: true, randomStart: true });
      model = m;
    })
    .catch(() => {
      /* Fichier absent ou reseau coupe : le corps en code reste affiche. */
    });

  function choose(p: MonsterPose): string {
    // Un geste en cours (le Cri du Chien) tient jusqu'au bout, sauf s'il faut
    // attaquer ou se remettre a courir.
    if (holdClip && clock < holdUntil && p.lunge <= 0.45 && p.speed <= 1) return holdClip;
    holdClip = "";
    if (p.lunge > 0.45) return "Attaque";
    if (kind === "fetards") {
      if (p.state === "salut") return "Salut";
      if (p.state === "danse") return "Danse";
      if (p.speed > 2.2) return "Course";
      if (p.speed > 0.12) return "Marche";
      // Au repos, il attend... puis se met a danser tout seul.
      return idleFor > 1.5 && p.state === "errer" ? "Danse" : "Attente";
    }
    if (kind === "chiens") return p.speed > 0.12 ? "Rampe" : "Tapie";
    if (p.speed > 2.2) return "Course";
    if (p.speed > 0.12) return p.state === "fouiller" ? "Rampe" : "Rode";
    return p.state === "enqueter" || p.state === "fouiller" ? "Ecoute" : "Tapie";
  }

  function animate(p: MonsterPose) {
    // Regarde, le Voleur ne bouge plus du tout : ni corps, ni tete, ni lambeaux.
    if (kind === "voleur" && p.watched) return;
    const dt = Math.max(0, p.delta);
    clock += dt;
    stride += dt * p.speed * (kind === "chiens" ? 3.4 : 2.6);
    if (stride > 1e4) stride -= Math.PI * 2 * 1000;
    idleFor = p.speed > 0.12 ? 0 : idleFor + dt;

    // Cri : le Chien leve la tete et hurle (debout), ou crie en courant.
    const screamStart = p.scream > 0.6 && lastScream <= 0.6 && clock - lastScreamAt > 1.2;
    lastScream = p.scream;
    if (screamStart && kind === "chiens") {
      lastScreamAt = clock;
      if (p.speed <= 1) {
        holdClip = "Cri";
        holdUntil = clock + Math.min(1.8, model?.duration("Cri") || 1.8);
      } else {
        model?.pulse("Cri", 0.8);
      }
    }

    const next = choose(p);
    // Tete : suit le joueur, avec des tics secs chez le Voleur.
    if (kind === "voleur" && clock > twitchUntil) {
      twitchUntil = clock + 0.3 + Math.random() * 2.2;
      twitchYaw = (Math.random() - 0.5) * 0.7;
    }
    const target = THREE.MathUtils.clamp(p.headYaw, -1.2, 1.2) + (kind === "voleur" ? twitchYaw : 0);
    yawShown += (target - yawShown) * Math.min(1, dt * (kind === "voleur" ? 14 : 6));

    const m = model;
    if (m) {
      const name = resolveClip(next);
      const loco = LOCOMOTION.has(name);
      const pace = PACE[name];
      PLAY.speed = pace ? THREE.MathUtils.clamp(p.speed / pace, 0.5, name === "Rampe" ? 3 : 1.8) : 1;
      PLAY.fade = name === "Attaque" ? 0.12 : 0.3;
      PLAY.loop = name !== "Cri";
      PLAY.syncPhase = loco && LOCOMOTION.has(clip);
      PLAY.randomStart = name === "Danse" && clip !== "Danse";
      m.play(name, PLAY);
      clip = name;
      if (headBone) headBone.quaternion.copy(headAnimQ);
      m.update(dt);
      if (headBone) {
        headAnimQ.copy(headBone.quaternion);
        tmpQ.setFromAxisAngle(headUp, yawShown * headTurn);
        headBone.quaternion.multiply(tmpQ);
      }
      hangFlaps(modelFlaps, root, clock, Math.min(1, p.speed / 4));
    } else {
      clip = next;
      codeBody.pose(next, p, stride, clock, yawShown * headTurn, 1 - Math.exp(-dt * 12));
      hangFlaps(codeBody.flaps, root, clock, Math.min(1, p.speed / 4));
    }
  }

  return {
    kind,
    group: root,
    animate,
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      model?.dispose();
      model = null;
      for (const o of owned) o.dispose();
      for (const key of textureKeys) releaseTexture(key);
    },
  };
}
