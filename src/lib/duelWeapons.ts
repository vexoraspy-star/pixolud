import * as THREE from "three";

/**
 * L'arsenal du Duel.
 *
 * Le jeu n'avait qu'une arme, donc un seul rythme de combat : on avancait et
 * on tirait, toujours pareil. Cinq armes aux defauts assumes creent des
 * situations differentes — le fusil a pompe force le corps a corps, le sniper
 * punit ceux qui traversent a decouvert, la mitraillette rate de loin.
 *
 * Chaque arme est definie une seule fois ici : degats, cadence, dispersion,
 * et le modele 3D tenu en main. Le reste du jeu ne connait que WeaponSpec.
 */

export type WeaponId = "pistolet" | "mitraillette" | "fusil" | "pompe" | "sniper";

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  /** Nom court pour l'interface en jeu. */
  short: string;
  damage: number;
  /** Multiplicateur de degats sur un tir a la tete. */
  headshot: number;
  /** Secondes entre deux tirs. */
  fireInterval: number;
  /** Vrai = feu continu en gardant le bouton enfonce. */
  auto: boolean;
  magSize: number;
  reloadSeconds: number;
  /** Nombre de projectiles par tir (fusil a pompe). */
  pellets: number;
  /** Dispersion en radians, a l'arret. Elle double en mouvement. */
  spread: number;
  /** Amplitude du recul vertical de la camera. */
  recoil: number;
  /** Portee utile en cases ; au-dela, les degats tombent de moitie. */
  range: number;
  /** Facteur de vitesse de deplacement : une arme lourde ralentit. */
  moveFactor: number;
  /** Champ de vision en visee (undefined = pas de lunette). */
  zoomFov?: number;
  /** Couleur du traceur, pour distinguer les armes en combat. */
  tracer: number;
}

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  pistolet: {
    id: "pistolet",
    name: "Pistolet",
    short: "PIST",
    damage: 34,
    headshot: 2.2,
    fireInterval: 0.26,
    auto: false,
    magSize: 12,
    reloadSeconds: 1.2,
    pellets: 1,
    spread: 0.009,
    recoil: 0.9,
    range: 18,
    moveFactor: 1.08,
    tracer: 0xffe6a8,
  },
  mitraillette: {
    id: "mitraillette",
    name: "Mitraillette",
    short: "SMG",
    damage: 17,
    headshot: 1.9,
    fireInterval: 0.075,
    auto: true,
    magSize: 30,
    reloadSeconds: 1.6,
    pellets: 1,
    // Elle crache vite mais arrose : au-dela de dix metres, elle ne sert plus.
    spread: 0.034,
    recoil: 0.5,
    range: 11,
    moveFactor: 1.05,
    tracer: 0xfff0c0,
  },
  fusil: {
    id: "fusil",
    name: "Fusil d'assaut",
    short: "FUSIL",
    damage: 25,
    headshot: 2.1,
    fireInterval: 0.125,
    auto: true,
    magSize: 30,
    reloadSeconds: 2,
    pellets: 1,
    spread: 0.016,
    recoil: 0.8,
    range: 22,
    moveFactor: 1,
    tracer: 0xffd98a,
  },
  pompe: {
    id: "pompe",
    name: "Fusil à pompe",
    short: "POMPE",
    // Huit plombs a 14 : colle au corps c'est mortel, a dix metres c'est rien.
    damage: 14,
    headshot: 1.4,
    fireInterval: 0.85,
    auto: false,
    magSize: 6,
    reloadSeconds: 2.7,
    pellets: 8,
    spread: 0.105,
    recoil: 2.2,
    range: 8,
    moveFactor: 0.95,
    tracer: 0xffbf7a,
  },
  sniper: {
    id: "sniper",
    name: "Fusil de précision",
    short: "SNIPER",
    // Un tir au corps ne tue pas tout a fait : il reste 5 PV, donc le duel
    // continue. A la tete, c'est fini.
    damage: 95,
    headshot: 1.6,
    fireInterval: 1.25,
    auto: false,
    magSize: 5,
    reloadSeconds: 2.9,
    pellets: 1,
    spread: 0.0015,
    recoil: 3.2,
    range: 40,
    moveFactor: 0.86,
    zoomFov: 26,
    tracer: 0xbfe9ff,
  },
};

/** L'ordre de progression du mode Course a l'armement. */
export const GUN_GAME_ORDER: WeaponId[] = [
  "pistolet",
  "mitraillette",
  "fusil",
  "pompe",
  "sniper",
];

/** Ce qu'on trouve au sol en Battle Royale, du plus commun au plus rare. */
export const LOOT_TABLE: WeaponId[] = [
  "mitraillette",
  "mitraillette",
  "fusil",
  "fusil",
  "pompe",
  "sniper",
];

export interface WeaponModel {
  group: THREE.Group;
  /** Sphere de l'eclair de bouche, deja placee au bout du canon. */
  flash: THREE.Mesh;
  dispose(): void;
}

/**
 * Le modele tenu en main, a la premiere personne. Chaque arme a une
 * silhouette franchement differente : on doit savoir ce qu'on tient sans
 * lire l'interface.
 */
export function buildWeaponModel(id: WeaponId): WeaponModel {
  const group = new THREE.Group();
  const owned: (THREE.BufferGeometry | THREE.Material)[] = [];

  const metal = new THREE.MeshLambertMaterial({ color: 0x3a4048 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x191d22 });
  const wood = new THREE.MeshLambertMaterial({ color: 0x4a3527 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xa87c58 });
  owned.push(metal, dark, wood, skin);

  function box(w: number, h: number, d: number, mat: THREE.Material) {
    const geo = new THREE.BoxGeometry(w, h, d);
    owned.push(geo);
    return new THREE.Mesh(geo, mat);
  }
  function tube(r: number, len: number, mat: THREE.Material, seg = 8) {
    const geo = new THREE.CylinderGeometry(r, r, len, seg);
    owned.push(geo);
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = Math.PI / 2;
    return m;
  }
  function add(mesh: THREE.Mesh, x: number, y: number, z: number) {
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  }

  /** Longueur du canon : elle fixe ou se place l'eclair de bouche. */
  let muzzleZ = -0.6;

  switch (id) {
    case "pistolet": {
      add(box(0.075, 0.11, 0.26, metal), 0, 0, -0.04);
      add(tube(0.02, 0.16, dark), 0, 0.012, -0.2);
      const grip = add(box(0.07, 0.2, 0.09, dark), 0, -0.14, 0.05);
      grip.rotation.x = -0.16;
      add(box(0.016, 0.035, 0.016, dark), 0, 0.075, -0.12);
      muzzleZ = -0.3;
      break;
    }
    case "mitraillette": {
      add(box(0.085, 0.12, 0.34, dark), 0, 0, 0);
      add(tube(0.018, 0.24, metal), 0, 0.012, -0.28);
      const grip = add(box(0.07, 0.19, 0.09, dark), 0, -0.15, 0.09);
      grip.rotation.x = -0.2;
      // Chargeur long et incline : la signature visuelle de l'arme.
      const mag = add(box(0.06, 0.3, 0.07, metal), 0, -0.2, -0.06);
      mag.rotation.x = 0.22;
      add(box(0.05, 0.05, 0.16, dark), 0, 0.02, 0.22);
      muzzleZ = -0.42;
      break;
    }
    case "fusil": {
      add(box(0.1, 0.13, 0.44, metal), 0, 0, 0);
      add(tube(0.026, 0.42, dark), 0, 0.015, -0.4);
      const grip = add(box(0.08, 0.22, 0.1, dark), 0, -0.16, 0.12);
      grip.rotation.x = -0.22;
      add(box(0.07, 0.2, 0.09, dark), 0, -0.17, -0.06);
      add(box(0.02, 0.05, 0.02, dark), 0, 0.09, -0.18);
      add(box(0.08, 0.1, 0.22, dark), 0, -0.02, 0.3);
      muzzleZ = -0.62;
      break;
    }
    case "pompe": {
      add(box(0.11, 0.13, 0.5, wood), 0, 0, 0);
      add(tube(0.036, 0.5, dark, 10), 0, 0.035, -0.44);
      // Le tube magasin sous le canon : c'est ce qui fait « pompe ».
      add(tube(0.026, 0.42, metal), 0, -0.03, -0.4);
      const pump = add(box(0.075, 0.08, 0.16, wood), 0, -0.03, -0.34);
      pump.name = "pump";
      const grip = add(box(0.085, 0.2, 0.1, wood), 0, -0.15, 0.14);
      grip.rotation.x = -0.2;
      add(box(0.1, 0.12, 0.24, wood), 0, -0.04, 0.34);
      muzzleZ = -0.7;
      break;
    }
    case "sniper": {
      add(box(0.09, 0.12, 0.56, dark), 0, 0, 0);
      add(tube(0.022, 0.66, metal), 0, 0.015, -0.58);
      // Lunette : le volume au-dessus qui dit tout de suite ce que c'est.
      add(tube(0.045, 0.3, dark, 10), 0, 0.13, -0.1);
      add(box(0.02, 0.07, 0.02, dark), 0, 0.08, -0.02);
      add(box(0.02, 0.07, 0.02, dark), 0, 0.08, -0.2);
      const grip = add(box(0.08, 0.21, 0.1, dark), 0, -0.16, 0.16);
      grip.rotation.x = -0.22;
      add(box(0.09, 0.14, 0.3, dark), 0, -0.04, 0.4);
      add(box(0.06, 0.16, 0.08, metal), 0, -0.15, -0.04);
      muzzleZ = -0.88;
      break;
    }
  }

  // Main gantee sur la poignee : sans elle, l'arme flotte dans le vide.
  const handGeo = new THREE.CapsuleGeometry(0.055, 0.09, 4, 8);
  owned.push(handGeo);
  const hand = new THREE.Mesh(handGeo, skin);
  hand.rotation.z = Math.PI / 2;
  hand.position.set(0, -0.09, 0.08);
  group.add(hand);

  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffd27a,
    transparent: true,
    opacity: 0.95,
  });
  owned.push(flashMat);
  const flashGeo = new THREE.SphereGeometry(id === "pompe" ? 0.14 : 0.09, 8, 8);
  owned.push(flashGeo);
  const flash = new THREE.Mesh(flashGeo, flashMat);
  flash.position.set(0, 0.015, muzzleZ);
  flash.visible = false;
  group.add(flash);

  return {
    group,
    flash,
    dispose() {
      for (const o of owned) o.dispose();
    },
  };
}
