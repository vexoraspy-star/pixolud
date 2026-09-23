import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Modeles 3D animes (.glb), pour les jeux du Mode 3D.
 *
 * Les fichiers sont dans public/models (licence CC0, voir LICENCES.txt), deja
 * alleges pour le web. Ce module s'occupe du reste :
 *
 * - un seul telechargement par fichier, partage par toutes les instances
 *   (onze bots = un seul fichier, onze squelettes) ;
 * - les materiaux PBR du glTF sont remplaces par des MeshLambertMaterial :
 *   c'est la regle du Mode 3D, des materiaux PBR avaient fait tomber un jeu
 *   a 1 image par seconde ;
 * - le modele est ramene a une hauteur donnee, pieds a y = 0, regard vers +Z ;
 * - les animations se jouent par leur nom, avec un fondu entre deux.
 *
 * Si un fichier ne charge pas (reseau coupe), la promesse est rejetee : les
 * jeux gardent alors leur modele dessine en code.
 */

export type ModelId = "zombie-a" | "zombie-b" | "soldat-swat" | "colosse";

const MODEL_URL: Record<ModelId, string> = {
  "zombie-a": "/models/zombie-a.glb",
  "zombie-b": "/models/zombie-b.glb",
  "soldat-swat": "/models/soldat-swat.glb",
  colosse: "/models/colosse.glb",
};

const cache = new Map<ModelId, Promise<GLTF>>();

/**
 * Fusionne les morceaux d'un personnage (jambes, buste, tete...) en un seul
 * maillage anime, quand ils partagent le meme squelette.
 *
 * Le SWAT arrive en neuf morceaux et quatre squelettes identiques : douze
 * soldats a l'ecran, c'etaient cent huit appels de rendu et quarante-huit
 * textures d'os envoyees a chaque image — trop pour une puce graphique
 * integree. Fusionne : un appel et un squelette par soldat. Les couleurs des
 * materiaux (sans texture) passent dans des couleurs de sommets, et on garde
 * la plage de chaque ancien materiau pour pouvoir le reteindre.
 */
function mergeSkinnedParts(scene: THREE.Object3D) {
  const parts: THREE.SkinnedMesh[] = [];
  scene.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) parts.push(o as THREE.SkinnedMesh);
  });
  if (parts.length < 2) return;
  const first = parts[0];
  // Chaque morceau vit dans son propre groupe (un par noeud glTF) : on compare
  // donc les positions dans le monde, pas les parents.
  scene.updateMatrixWorld(true);
  const sameRig = parts.every(
    (p) =>
      p.matrixWorld.equals(first.matrixWorld) &&
      p.bindMatrix.equals(first.bindMatrix) &&
      p.skeleton.bones.length === first.skeleton.bones.length &&
      p.skeleton.bones.every((b, i) => b === first.skeleton.bones[i]) &&
      p.skeleton.boneInverses.every((m, i) => m.equals(first.skeleton.boneInverses[i])),
  );
  const noTextures = parts.every((p) => !(p.material as THREE.MeshStandardMaterial).map);
  if (!sameRig || !noTextures) return;

  const geos: THREE.BufferGeometry[] = [];
  const ranges: { name: string; start: number; count: number }[] = [];
  let offset = 0;
  const color = new THREE.Color();
  for (const p of parts) {
    const src = p.geometry;
    const mat = p.material as THREE.MeshStandardMaterial;
    const g = new THREE.BufferGeometry();
    const count = src.getAttribute("position").count;
    // Tout en flottants : les morceaux doivent avoir exactement les memes formats.
    for (const name of ["position", "normal", "skinWeight"]) {
      const a = src.getAttribute(name);
      if (!a) return;
      const arr = new Float32Array(count * a.itemSize);
      for (let i = 0; i < count; i++) for (let k = 0; k < a.itemSize; k++) arr[i * a.itemSize + k] = a.getComponent(i, k);
      g.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
    }
    const si = src.getAttribute("skinIndex");
    const idx = new Uint16Array(count * 4);
    for (let i = 0; i < count; i++) for (let k = 0; k < 4; k++) idx[i * 4 + k] = si.getComponent(i, k);
    g.setAttribute("skinIndex", new THREE.BufferAttribute(idx, 4));
    color.copy(mat.color);
    const cols = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      cols[i * 3] = color.r;
      cols[i * 3 + 1] = color.g;
      cols[i * 3 + 2] = color.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    if (src.index) g.setIndex(src.index.clone());
    geos.push(g);
    ranges.push({ name: mat.name, start: offset, count });
    offset += count;
  }
  const merged = mergeGeometries(geos, false);
  if (!merged) return;
  const mesh = new THREE.SkinnedMesh(merged, new THREE.MeshStandardMaterial({ name: "fusion", vertexColors: true }));
  mesh.name = "fusion";
  mesh.userData.colorRanges = ranges;
  mesh.position.copy(first.position);
  mesh.quaternion.copy(first.quaternion);
  mesh.scale.copy(first.scale);
  first.parent!.add(mesh);
  mesh.bind(first.skeleton, first.bindMatrix);
  for (const p of parts) p.parent!.remove(p);
}

export function preloadModel(id: ModelId): Promise<GLTF> {
  let p = cache.get(id);
  if (!p) {
    p = new GLTFLoader().loadAsync(MODEL_URL[id]).then((gltf) => {
      mergeSkinnedParts(gltf.scene);
      return gltf;
    });
    // Un echec ne doit pas rester en cache : la partie suivante reessaiera.
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}

export interface AnimatedModel {
  /** A placer dans la scene : origine aux pieds, regard vers +Z. */
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  /** Nom de l'animation en cours. */
  current: string | null;
  has(name: string): boolean;
  /**
   * Joue une animation (fondu depuis la precedente). Sans effet si elle tourne
   * deja, sauf avec `restart` : deux coups de poing de suite doivent repartir
   * du debut.
   */
  play(name: string, opts?: { fade?: number; loop?: boolean; speed?: number; restart?: boolean }): void;
  /** Duree d'une animation, en secondes (0 si elle n'existe pas). */
  duration(name: string): number;
  /** Vitesse de l'animation en cours (pour caler la foulee sur la vitesse reelle). */
  setSpeed(speed: number): void;
  update(delta: number): void;
  /** Teinte les materiaux dont le nom correspond (couleur d'equipe, tenue). */
  tint(match: (materialName: string) => boolean, color: number): void;
  /** Trouve un os par son nom (pour accrocher une arme a la main). */
  bone(name: string): THREE.Object3D | null;
  /**
   * Accroche un objet a un os. Dans la pose de reference (par exemple la
   * visee), l'objet est oriente vers l'avant du personnage (+Z) ; il suit
   * ensuite la main dans toutes les autres animations. L'objet est a
   * l'echelle du monde, en metres.
   */
  attach(boneName: string, object: THREE.Object3D, referencePose?: string): boolean;
  /**
   * Reduit un os a rien : les sommets qui en dependent disparaissent (la tete
   * d'origine, pour en poser une autre sur le cou). Les animations n'ont pas
   * de pistes d'echelle, donc ca tient d'une image a l'autre.
   */
  hideBone(name: string): boolean;
  dispose(): void;
}

export async function createAnimatedModel(id: ModelId, height: number): Promise<AnimatedModel> {
  const gltf = await preloadModel(id);
  const inner = cloneSkinned(gltf.scene) as THREE.Object3D;
  const root = new THREE.Group();
  root.add(inner);

  // --- Materiaux : Lambert, meme texture, meme couleur ---
  const materials: THREE.MeshLambertMaterial[] = [];
  const convert = (m: THREE.Material): THREE.MeshLambertMaterial => {
    const src = m as THREE.MeshStandardMaterial;
    const lambert = new THREE.MeshLambertMaterial({
      name: src.name,
      map: src.map ?? null,
      color: src.color ? src.color.clone() : new THREE.Color(0xffffff),
      vertexColors: src.vertexColors,
      transparent: src.transparent,
      alphaTest: src.alphaTest,
      side: src.side,
    });
    materials.push(lambert);
    return lambert;
  };
  const colorParts: { mesh: THREE.Mesh; ranges: { name: string; start: number; count: number }[] }[] = [];
  inner.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(convert) : convert(mesh.material);
    const ranges = mesh.userData.colorRanges as { name: string; start: number; count: number }[] | undefined;
    if (ranges) {
      // Geometrie partagee entre toutes les instances, sauf les couleurs :
      // chaque soldat a les siennes.
      const src = mesh.geometry;
      const own = new THREE.BufferGeometry();
      if (src.index) own.setIndex(src.index);
      for (const name of Object.keys(src.attributes)) {
        own.setAttribute(name, name === "color" ? src.getAttribute(name).clone() : src.getAttribute(name));
      }
      mesh.geometry = own;
      colorParts.push({ mesh, ranges });
    }
    // Un modele anime sort de sa boite englobante de depart : sans ceci, il
    // disparait des qu'il leve un bras hors du cadre de la camera.
    mesh.frustumCulled = false;
  });

  // --- Hauteur et pieds au sol ---
  const mixer = new THREE.AnimationMixer(inner);
  const clips = new Map(gltf.animations.map((c) => [c.name.split("|").pop() as string, c]));
  const idle = clips.get("Idle") ?? clips.get("Idle_Gun") ?? clips.get("Idle_Neutral") ?? gltf.animations[0];
  if (idle) {
    mixer.clipAction(idle).play();
    mixer.update(0);
  }
  inner.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner, true);
  const size = box.getSize(new THREE.Vector3());
  const scale = size.y > 1e-6 ? height / size.y : 1;
  inner.scale.multiplyScalar(scale);
  const center = box.getCenter(new THREE.Vector3());
  inner.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  mixer.stopAllAction();

  let currentAction: THREE.AnimationAction | null = null;
  const model: AnimatedModel = {
    root,
    mixer,
    current: null,
    has: (name) => clips.has(name),
    play(name, opts = {}) {
      const clip = clips.get(name);
      if (!clip) return;
      const speed = opts.speed ?? 1;
      if (model.current === name && currentAction && !opts.restart) {
        currentAction.timeScale = speed;
        return;
      }
      const loop = opts.loop ?? true;
      const next = mixer.clipAction(clip);
      if (next === currentAction) {
        // Meme animation relancee : on repart du debut, sans fondu sur soi-meme.
        next.reset();
        next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
        next.clampWhenFinished = !loop;
        next.timeScale = speed;
        next.play();
        return;
      }
      next.reset();
      next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      next.clampWhenFinished = !loop;
      next.timeScale = speed;
      next.enabled = true;
      if (currentAction && currentAction !== next) next.crossFadeFrom(currentAction, opts.fade ?? 0.2, false);
      next.play();
      currentAction = next;
      model.current = name;
    },
    duration(name) {
      return clips.get(name)?.duration ?? 0;
    },
    setSpeed(speed) {
      if (currentAction) currentAction.timeScale = speed;
    },
    update(delta) {
      mixer.update(delta);
    },
    tint(match, color) {
      for (const m of materials) if (match(m.name)) m.color.setHex(color);
      const c = new THREE.Color(color);
      for (const part of colorParts) {
        const attr = part.mesh.geometry.getAttribute("color") as THREE.BufferAttribute;
        for (const r of part.ranges) {
          if (!match(r.name)) continue;
          for (let i = r.start; i < r.start + r.count; i++) attr.setXYZ(i, c.r, c.g, c.b);
        }
        attr.needsUpdate = true;
      }
    },
    bone(name) {
      // Le chargeur glTF nettoie les noms (« Wrist.R » devient « WristR ») :
      // on compare sans ponctuation ni casse.
      const key = name.replace(/[^a-z0-9]/gi, "").toLowerCase();
      let found: THREE.Object3D | null = null;
      inner.traverse((o) => {
        if (!found && o.name.replace(/[^a-z0-9]/gi, "").toLowerCase() === key) found = o;
      });
      return found;
    },
    attach(boneName, object, referencePose) {
      const b = model.bone(boneName);
      if (!b) return false;
      const clip = referencePose ? clips.get(referencePose) : undefined;
      const wasCurrent = model.current;
      mixer.stopAllAction();
      let ref: THREE.AnimationAction | null = null;
      if (clip) {
        ref = mixer.clipAction(clip);
        ref.reset().play();
        mixer.update(0.25);
      }
      root.updateMatrixWorld(true);
      const rootQ = root.getWorldQuaternion(new THREE.Quaternion());
      const boneQ = b.getWorldQuaternion(new THREE.Quaternion());
      const boneS = b.getWorldScale(new THREE.Vector3());
      object.quaternion.copy(boneQ.invert().multiply(rootQ));
      // Le monde du personnage est deja a l'echelle : on annule celle de l'os.
      const rootS = root.getWorldScale(new THREE.Vector3());
      object.scale.set(rootS.x / boneS.x, rootS.y / boneS.y, rootS.z / boneS.z);
      b.add(object);
      if (ref) ref.stop();
      currentAction = null;
      model.current = null;
      if (wasCurrent) model.play(wasCurrent, { fade: 0 });
      return true;
    },
    hideBone(name) {
      const b = model.bone(name);
      if (!b) return false;
      b.scale.setScalar(1e-4);
      return true;
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(inner);
      // Geometries et textures appartiennent au fichier en cache, partage
      // entre toutes les instances : seuls nos materiaux sont a liberer.
      for (const m of materials) m.dispose();
    },
  };
  return model;
}
