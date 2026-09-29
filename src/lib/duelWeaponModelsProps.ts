import * as THREE from "three";
import type { WeaponId } from "./duelWeapons";
import { withDetail } from "./duelWeaponModels";
import { buildGunRig, hasGunModel } from "./duelWeaponModelsArsenal";

/**
 * Les armes portees par les soldats (bots et autres joueurs).
 *
 * Tous tenaient la meme boite grise, quelle que soit leur arme : on ne
 * voyait pas qu'un adversaire avait sorti le fusil de precision. Chaque arme
 * reprend ici le modele de la vue a la premiere personne, construit en detail
 * reduit (biseaux d'une facette, pieces tournees moins decoupees), sans les
 * mains ni les pieces minuscules (vis, points de visee), a sa taille reelle.
 *
 * Les couleurs des matieres (et la teinte moyenne de leurs textures) sont
 * cuites dans les couleurs de sommet : UNE geometrie par arme, partagee par
 * tous les soldats, et UN materiau Lambert pour toutes. Un soldat coute donc
 * un seul appel de rendu pour son arme, quelle qu'elle soit.
 */

/** Les armes tenues en main sont dessinees a environ 1,7 fois le reel. */
const PROP_SCALE = 1 / 1.7;
/** Niveau de detail : a dix metres, un canon a six pans reste un canon. */
const PROP_DETAIL = 0.4;
/** Plus petit que ca (unites du modele), une piece ne se voit pas de loin. */
const TINY = 0.011;
/**
 * Ou tombe le centre de la poignee : le creux du poing du soldat anime, dans
 * le repere de l'os Wrist.R tel que `attach` le presente (pose
 * « Idle_Gun_Pointing » : +z devant, +y en haut, en metres). Mesure dans
 * Blender sur les os des doigts du SWAT : les jointures sont 15 cm devant
 * l'os du poignet (meme point que le manche des couteaux, voir duelKnives).
 */
const GRIP_AT = new THREE.Vector3(0.016, -0.02, 0.165);
/** L'eclair se centre un peu devant la bouche. */
const FLASH_AHEAD = 0.05;

interface Prop {
  geo: THREE.BufferGeometry;
  /** Bout du canon, dans le repere du support. */
  muzzle: THREE.Vector3;
}

export interface WeaponProps {
  /** Materiau unique de toutes les armes portees. */
  material: THREE.MeshLambertMaterial;
  /**
   * Met l'arme `id` dans le support accroche au poignet d'un soldat et place
   * l'eclair `flash` au bout de son canon. Ne fait rien si elle y est deja :
   * on peut l'appeler a chaque image (aucune allocation).
   */
  equip(holder: THREE.Object3D, flash: THREE.Object3D | null, id: WeaponId): void;
  /** Nombre de triangles de l'arme `id` (0 si elle n'a pas de modele). */
  triangles(id: WeaponId): number;
  dispose(): void;
}

const tone = new THREE.Color();
const tint = new THREE.Color();
const size = new THREE.Vector3();
const box = new THREE.Box3();

/** Couleur de la matiere, multipliee par la teinte moyenne de sa texture. */
function colorOf(mat: THREE.Material, out: THREE.Color): THREE.Color {
  const m = mat as THREE.MeshLambertMaterial;
  out.set(0xffffff);
  if (m.color) out.copy(m.color);
  const t = m.map?.userData?.tone;
  if (typeof t === "number") out.multiply(tone.setHex(t));
  return out;
}

/** Construit l'arme `id` en detail reduit et la fond en une seule geometrie. */
function buildProp(id: WeaponId): Prop | null {
  if (!hasGunModel(id)) return null;
  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => {
    owned.push(x);
    return x;
  };
  const body = new THREE.Group();
  const rig = withDetail(PROP_DETAIL, () => buildGunRig(id, body, {}, keep));
  // La poignee : c'est la que la main droite etait posee.
  const grip = rig.rightHand.position.clone();
  rig.rightHand.removeFromParent();
  rig.leftHand.removeFromParent();
  if (rig.carry) rig.carry.removeFromParent();

  // Repere du support : l'arme tourne d'un demi-tour (la bouche vers +z),
  // prend sa taille reelle, et sa poignee vient en GRIP_AT.
  const s = PROP_SCALE;
  const place = new THREE.Matrix4()
    .makeRotationY(Math.PI)
    .premultiply(new THREE.Matrix4().makeTranslation(GRIP_AT.x + s * grip.x, GRIP_AT.y - s * grip.y, GRIP_AT.z + s * grip.z))
    .multiply(new THREE.Matrix4().makeScale(s, s, s));
  body.updateMatrixWorld(true);

  // Les pieces gardees : ni vitres teintees, ni pieces minuscules.
  const kept: THREE.Mesh[] = [];
  let total = 0;
  body.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || Array.isArray(o.material)) return;
    const mat = o.material as THREE.Material;
    if (mat.transparent || mat.blending === THREE.AdditiveBlending) return;
    const g = o.geometry as THREE.BufferGeometry;
    const pos = g.attributes.position as THREE.BufferAttribute | undefined;
    if (!pos || !g.attributes.normal) return;
    box.setFromBufferAttribute(pos).getSize(size);
    if (Math.max(size.x, size.y, size.z) < TINY) return;
    kept.push(o);
    total += g.index ? g.index.count : pos.count;
  });
  if (total === 0) {
    for (const x of owned) x.dispose();
    return null;
  }
  // Une seule geometrie : chaque sommet est pose d'un coup dans le repere du
  // support, avec sa couleur (usure des aretes fois matiere).
  const P = new Float32Array(total * 3);
  const N = new Float32Array(total * 3);
  const C = new Float32Array(total * 3);
  const m4 = new THREE.Matrix4();
  const nm = new THREE.Matrix3();
  let w = 0;
  for (const o of kept) {
    const g = o.geometry as THREE.BufferGeometry;
    const pa = (g.attributes.position as THREE.BufferAttribute).array;
    const na = (g.attributes.normal as THREE.BufferAttribute).array;
    const wear = g.attributes.color as THREE.BufferAttribute | undefined;
    const idx = g.index;
    const count = idx ? idx.count : g.attributes.position.count;
    m4.multiplyMatrices(place, o.matrixWorld);
    nm.getNormalMatrix(m4);
    const e = m4.elements;
    const n = nm.elements;
    // Un miroir retourne les triangles : on echange deux sommets.
    const flip = m4.determinant() < 0;
    colorOf(o.material as THREE.Material, tint);
    for (let t = 0; t < count; t++) {
      const r = t % 3;
      const corner = flip && r > 0 ? t + (r === 1 ? 1 : -1) : t;
      const i = idx ? idx.getX(corner) : corner;
      const x = pa[i * 3];
      const y = pa[i * 3 + 1];
      const z = pa[i * 3 + 2];
      P[w] = e[0] * x + e[4] * y + e[8] * z + e[12];
      P[w + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
      P[w + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      const nx = na[i * 3];
      const ny = na[i * 3 + 1];
      const nz = na[i * 3 + 2];
      const ox = n[0] * nx + n[3] * ny + n[6] * nz;
      const oy = n[1] * nx + n[4] * ny + n[7] * nz;
      const oz = n[2] * nx + n[5] * ny + n[8] * nz;
      const len = Math.hypot(ox, oy, oz) || 1;
      N[w] = ox / len;
      N[w + 1] = oy / len;
      N[w + 2] = oz / len;
      const k = wear ? wear.getX(i) : 1;
      C[w] = Math.min(1, tint.r * k);
      C[w + 1] = Math.min(1, tint.g * k);
      C[w + 2] = Math.min(1, tint.b * k);
      w += 3;
    }
  }
  for (const x of owned) x.dispose();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(P, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(N, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(C, 3));
  geo.computeBoundingSphere();
  const muzzle = new THREE.Vector3(0, rig.muzzleY, rig.muzzleZ - FLASH_AHEAD / s).applyMatrix4(place);
  return { geo, muzzle };
}

/**
 * Les armes des soldats, construites une fois pour toute la partie (a
 * appeler au chargement de la scene : environ 20 ms par arme).
 */
export function createWeaponProps(ids?: readonly WeaponId[]): WeaponProps {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const props = new Map<WeaponId, Prop | null>();
  const get = (id: WeaponId): Prop | null => {
    let p = props.get(id);
    if (p === undefined) {
      p = buildProp(id);
      props.set(id, p);
    }
    return p;
  };
  if (ids) for (const id of ids) get(id);
  return {
    material,
    equip(holder, flash, id) {
      if (holder.userData.propId === id) return;
      const p = get(id);
      // Couteau : le support est cache, on garde l'arme precedente.
      if (!p) return;
      holder.userData.propId = id;
      let mesh = holder.userData.propMesh as THREE.Mesh | undefined;
      if (!mesh) {
        mesh = new THREE.Mesh(p.geo, material);
        holder.userData.propMesh = mesh;
        holder.add(mesh);
      } else {
        mesh.geometry = p.geo;
      }
      if (flash) flash.position.copy(p.muzzle);
    },
    triangles(id) {
      const p = get(id);
      return p ? p.geo.attributes.position.count / 3 : 0;
    },
    dispose() {
      for (const p of props.values()) p?.geo.dispose();
      props.clear();
      material.dispose();
    },
  };
}
