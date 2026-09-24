import * as THREE from "three";
import { block, tileUV } from "./voxel";
import { isBlock, item } from "./voxelItems";
import { itemSprite } from "./voxelIcons";

/**
 * La main du joueur, a la premiere personne, et ce qu'elle tient.
 *
 * Elle vit dans une petite scene a part, dessinee APRES le monde avec un
 * tampon de profondeur vide : elle ne rentre jamais dans les murs, et sa
 * camera garde un angle fixe (le zoom ou le champ de vision du monde ne la
 * deforment pas). Deux lumieres a elle seule, Lambert comme le reste.
 */

export interface HandState {
  /** Le joueur casse un bloc (bras qui frappe en continu). */
  mining: boolean;
  /** 0 a l'arret, 1 en marche, plus en course. */
  walk: number;
  /** Vitesse de rotation du regard (radians/s) : la main suit avec retard. */
  yawSpeed: number;
  pitchSpeed: number;
  /** Luminosite du lieu (0..1) : la main ne brille pas dans une grotte. */
  brightness: number;
  /** Le joueur mange ou boit. */
  eating: boolean;
}

export interface Hand {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Change l'objet tenu (0 = main nue). Petit mouvement de rangement. */
  setHeld(id: number): void;
  /** Un coup de bras (poser, frapper). */
  swing(): void;
  update(dt: number, state: HandState): void;
  resize(aspect: number): void;
  dispose(): void;
}

const PEAU = new THREE.Color("#d8a07a");
const MANCHE = new THREE.Color("#2f8f8a");

/** Boite avec une couleur par face (ombrage fixe, facon pixel art). */
function boite(w: number, h: number, d: number, color: THREE.Color): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const shades = [0.82, 0.82, 1, 0.6, 0.92, 0.7];
  const colors = new Float32Array(24 * 3);
  const c = new THREE.Color();
  for (let face = 0; face < 6; face++) {
    c.copy(color).multiplyScalar(shades[face]);
    for (let v = 0; v < 4; v++) c.toArray(colors, (face * 4 + v) * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}

/** Cube de bloc texture avec l'atlas (dessus, cotes, dessous). */
function cubeGeometry(id: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(1, 1, 1);
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  const tiles = block(id).tiles;
  // Ordre des faces de BoxGeometry : +x, -x, +y, -y, +z, -z.
  const faceTile = [tiles[1], tiles[1], tiles[0], tiles[2], tiles[1], tiles[1]];
  for (let face = 0; face < 6; face++) {
    for (let v = 0; v < 4; v++) {
      const i = face * 4 + v;
      const [u, w] = tileUV(faceTile[face], uv.getX(i), uv.getY(i));
      uv.setXY(i, u, w);
    }
  }
  const shades = [0.8, 0.8, 1, 0.55, 0.9, 0.7];
  const colors = new Float32Array(24 * 3);
  for (let face = 0; face < 6; face++) for (let v = 0; v < 4; v++) colors.fill(shades[face], (face * 4 + v) * 3, (face * 4 + v) * 3 + 3);
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}

/**
 * Objet plat « extrude » : le dessin de l'icone devant et derriere, et une
 * tranche coloree pixel par pixel sur les bords, comme dans le jeu d'origine.
 */
function spriteGeometry(canvas: HTMLCanvasElement): { faces: THREE.BufferGeometry; bords: THREE.BufferGeometry } {
  const size = canvas.width;
  const data = canvas.getContext("2d")!.getImageData(0, 0, size, size).data;
  const px = 1 / size;
  const ep = px * 1.2;
  const faces = new THREE.PlaneGeometry(1, 1);
  const back = new THREE.PlaneGeometry(1, 1);
  back.rotateY(Math.PI);
  faces.translate(0, 0, ep / 2);
  back.translate(0, 0, -ep / 2);
  const merged = new THREE.BufferGeometry();
  const pos: number[] = [];
  const nor: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  for (const g of [faces, back]) {
    const base = pos.length / 3;
    const p = g.getAttribute("position");
    const n = g.getAttribute("normal");
    const u = g.getAttribute("uv");
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
      uvs.push(u.getX(i), u.getY(i));
    }
    const index = g.getIndex()!;
    for (let i = 0; i < index.count; i++) idx.push(base + index.getX(i));
  }
  merged.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  merged.setIndex(idx);
  faces.dispose();
  back.dispose();

  // Tranches : une petite face par bord de pixel opaque.
  const bp: number[] = [];
  const bn: number[] = [];
  const bc: number[] = [];
  const bi: number[] = [];
  const opaque = (x: number, y: number) => x >= 0 && y >= 0 && x < size && y < size && data[(y * size + x) * 4 + 3] > 40;
  const quad = (a: number[], b: number[], c: number[], d: number[], n: number[], col: number[]) => {
    const s = bp.length / 3;
    for (const v of [a, b, c, d]) {
      bp.push(v[0], v[1], v[2]);
      bn.push(n[0], n[1], n[2]);
      bc.push(col[0], col[1], col[2]);
    }
    bi.push(s, s + 1, s + 2, s, s + 2, s + 3);
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (!opaque(x, y)) continue;
    const o = (y * size + x) * 4;
    const col = [data[o] / 255, data[o + 1] / 255, data[o + 2] / 255].map((v) => Math.pow(v, 2.2) * 0.8);
    const x0 = -0.5 + x * px;
    const x1 = x0 + px;
    const y1 = 0.5 - y * px;
    const y0 = y1 - px;
    const z0 = -ep / 2;
    const z1 = ep / 2;
    if (!opaque(x, y - 1)) quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], col);
    if (!opaque(x, y + 1)) quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], col);
    if (!opaque(x - 1, y)) quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], col);
    if (!opaque(x + 1, y)) quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], col);
  }
  const bords = new THREE.BufferGeometry();
  bords.setAttribute("position", new THREE.Float32BufferAttribute(bp, 3));
  bords.setAttribute("normal", new THREE.Float32BufferAttribute(bn, 3));
  bords.setAttribute("color", new THREE.Float32BufferAttribute(bc, 3));
  bords.setIndex(bi);
  return { faces: merged, bords };
}

export function createHand(atlas: THREE.Texture): Hand {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.01, 10);
  const hemi = new THREE.HemisphereLight("#fff6e8", "#6d6a78", 1.5);
  const sun = new THREE.DirectionalLight("#ffffff", 1.6);
  sun.position.set(-1, 2, 1.5);
  scene.add(hemi, sun);

  // Le bras : pivot a l'epaule (hors champ), avant-bras vers le centre de l'ecran.
  const pivot = new THREE.Group();
  scene.add(pivot);
  const bras = new THREE.Group();
  pivot.add(bras);
  const armMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
  const sleeveGeo = boite(0.26, 0.26, 0.5, MANCHE);
  const skinGeo = boite(0.25, 0.25, 0.42, PEAU);
  const sleeve = new THREE.Mesh(sleeveGeo, armMaterial);
  sleeve.position.set(0, 0, 0.1);
  const skin = new THREE.Mesh(skinGeo, armMaterial);
  skin.position.set(0, 0, -0.36);
  bras.add(sleeve, skin);

  // Ce que la main tient.
  const tenu = new THREE.Group();
  bras.add(tenu);
  const blockMaterial = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true, alphaTest: 0.15, side: THREE.DoubleSide });
  const spriteMaterial = new THREE.MeshLambertMaterial({ transparent: false, alphaTest: 0.3, side: THREE.DoubleSide });
  const edgeMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
  const cache = new Map<number, { geos: THREE.BufferGeometry[]; texture?: THREE.Texture }>();
  /** L'objet tenu et son materiau propre (une texture par objet). */
  let held: THREE.Object3D | null = null;
  let heldMaterial: THREE.MeshLambertMaterial | null = null;
  let heldId = -1;
  let tool = false;

  function build(id: number) {
    if (held) tenu.remove(held);
    heldMaterial?.dispose();
    held = null;
    heldMaterial = null;
    tool = false;
    if (id === 0) return;
    const b = isBlock(id) ? block(id) : null;
    let c = cache.get(id);
    if (b && b.shape === "cube") {
      if (!c) { c = { geos: [cubeGeometry(id)] }; cache.set(id, c); }
      const m = new THREE.Mesh(c.geos[0], blockMaterial);
      m.scale.setScalar(0.22);
      m.position.set(0.0, 0.2, -0.6);
      m.rotation.set(0.1, 0.78, 0);
      held = m;
    } else {
      if (!c) {
        const canvas = itemSprite(id);
        const { faces, bords } = spriteGeometry(canvas);
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        texture.colorSpace = THREE.SRGBColorSpace;
        c = { geos: [faces, bords], texture };
        cache.set(id, c);
      }
      heldMaterial = spriteMaterial.clone();
      heldMaterial.map = c.texture!;
      const g = new THREE.Group();
      g.add(new THREE.Mesh(c.geos[0], heldMaterial), new THREE.Mesh(c.geos[1], edgeMaterial));
      // Outils tenus par le manche, tete vers l'avant ; le reste a plat dans la paume.
      const it = item(id);
      tool = !!it?.tool || it?.icon.shape === "arc" || it?.icon.shape === "baton";
      if (tool) {
        g.scale.setScalar(0.62);
        g.position.set(0.02, 0.22, -0.66);
        g.rotation.set(-0.35, Math.PI / 2 + 0.15, 0.78);
      } else {
        g.scale.setScalar(0.42);
        g.position.set(0.0, 0.2, -0.64);
        g.rotation.set(-0.2, Math.PI / 2 - 0.3, 0.1);
      }
      held = g;
    }
    tenu.add(held);
  }

  // Animation.
  let swingT = 1;
  let equipT = 1;
  let pendingId = -1;
  let walkPhase = 0;
  let swayX = 0;
  let swayY = 0;
  let time = 0;
  const base = new THREE.Vector3(0.56, -0.5, -0.46);

  const hand: Hand = {
    scene,
    camera,
    setHeld(id) {
      if (id === heldId && pendingId === -1) return;
      pendingId = id;
      equipT = 0;
    },
    swing() {
      if (swingT > 0.55) swingT = 0;
    },
    update(dt, s) {
      time += dt;
      // Rangement : le bras descend, change d'objet a mi-course, remonte.
      if (equipT < 1) {
        const before = equipT;
        equipT = Math.min(1, equipT + dt / 0.28);
        if (before < 0.5 && equipT >= 0.5 && pendingId !== -1) {
          heldId = pendingId;
          pendingId = -1;
          build(heldId);
        }
      }
      if (s.mining && swingT >= 1) swingT = 0;
      if (swingT < 1) swingT = Math.min(1, swingT + dt / 0.26);
      walkPhase += dt * (5.5 + s.walk * 3) * Math.min(1, s.walk);
      swayX += ((-s.yawSpeed * 0.025) - swayX) * Math.min(1, dt * 8);
      swayY += ((s.pitchSpeed * 0.02) - swayY) * Math.min(1, dt * 8);
      swayX = THREE.MathUtils.clamp(swayX, -0.08, 0.08);
      swayY = THREE.MathUtils.clamp(swayY, -0.06, 0.06);

      const w = Math.min(1, s.walk);
      const bobX = Math.sin(walkPhase) * 0.028 * w;
      const bobY = -Math.abs(Math.cos(walkPhase)) * 0.03 * w + Math.sin(time * 1.6) * 0.004;
      const dip = Math.sin(equipT * Math.PI) * 0.35;
      const sw = Math.sin(swingT * Math.PI);
      const sw2 = Math.sin(Math.sqrt(swingT) * Math.PI);
      let eatY = 0;
      let eatX = 0;
      if (s.eating) {
        eatY = 0.12 + Math.abs(Math.sin(time * 14)) * 0.035;
        eatX = -0.18;
      }
      pivot.position.set(base.x + bobX + swayX - sw2 * 0.12 + eatX, base.y + bobY + swayY - dip + sw * 0.05 + eatY, base.z - sw2 * 0.08);
      // Le coup : le bras part en arc vers le bas et le centre.
      pivot.rotation.set(0.12 - sw * 0.95 + (s.eating ? 0.5 : 0), 0.32 + sw2 * 0.55 + (tool ? 0 : 0.05), -0.05 + sw * 0.3);

      // Teinte selon la lumiere du lieu (plancher pour garder la main lisible).
      const l = 0.18 + 0.82 * s.brightness;
      armMaterial.color.setScalar(l);
      blockMaterial.color.setScalar(l);
      edgeMaterial.color.setScalar(l);
      heldMaterial?.color.setScalar(l);
    },
    resize(aspect) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    },
    dispose() {
      for (const c of cache.values()) {
        for (const g of c.geos) g.dispose();
        c.texture?.dispose();
      }
      heldMaterial?.dispose();
      sleeveGeo.dispose();
      skinGeo.dispose();
      armMaterial.dispose();
      blockMaterial.dispose();
      spriteMaterial.dispose();
      edgeMaterial.dispose();
    },
  };
  return hand;
}
