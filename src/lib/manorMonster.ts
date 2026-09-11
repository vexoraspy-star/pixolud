import * as THREE from "three";
import { makeMonsterFaceTexture } from "./manorTextures";

/**
 * La chose du Manoir Maudit.
 *
 * Le modele precedent etait un cone surmonte d'une sphere : lu de loin, une
 * silhouette de moine, donc rien d'inquietant. Ce qui fait peur tient a trois
 * choses, dans cet ordre :
 *
 *  1. LA SILHOUETTE. Elle est trop haute (2,4 m contre 1,5 m d'oeil joueur),
 *     trop maigre, et surtout mal proportionnee : les epaules sont PLUS HAUTES
 *     que la tete, les bras descendent jusqu'aux chevilles, les genoux sont a
 *     l'envers. Le cerveau reconnait un humain et voit en meme temps que les
 *     proportions sont fausses — c'est cet ecart qui met mal a l'aise.
 *
 *  2. LA TETE INDEPENDANTE. Le corps regarde ou il marche ; la tete, elle,
 *     reste braquee sur le joueur. Elle peut passer devant toi sans changer de
 *     direction, la nuque tordue, sans jamais te lacher des yeux.
 *
 *  3. LES YEUX. Deux points non eclaires et hors brouillard : dans le noir
 *     total on ne voit qu'eux, a l'autre bout d'un couloir.
 *
 * Tout est en MeshLambertMaterial et sans aucun asset externe, conformement
 * aux conventions du Mode 3D.
 */

/** Hauteur totale, en unites monde. Le joueur a les yeux a 1,5. */
export const MONSTER_HEIGHT = 2.4;

export interface MonsterParts {
  group: THREE.Group;
  /** Pivot du buste : c'est lui qui se voute et qui respire. */
  spine: THREE.Group;
  /** Pivot de la nuque : la tete tourne independamment du corps. */
  neck: THREE.Group;
  head: THREE.Group;
  jaw: THREE.Mesh;
  face: THREE.Mesh;
  faceMat: THREE.MeshBasicMaterial;
  eyes: THREE.Mesh;
  eyeMat: THREE.MeshBasicMaterial;
  hair: THREE.Group;
  /** [gauche, droite] */
  legs: { hip: THREE.Group; shin: THREE.Group }[];
  arms: { shoulder: THREE.Group; elbow: THREE.Group; fingers: THREE.Group[] }[];
  dispose(): void;
}

/** Une arete osseuse d'un paquet instancie : position, taille, rotation. */
interface BonePiece {
  pos: [number, number, number];
  size: [number, number, number];
  rot?: [number, number, number];
}

/** Corps translucide ? Non : noir mat. Elle doit etre un trou dans la lumiere. */
const SKIN = 0x17141c;
const SKIN_PALE = 0x6b6355;

export function buildMonster(): MonsterParts {
  const group = new THREE.Group();
  const owned: (THREE.BufferGeometry | THREE.Material)[] = [];

  const dark = new THREE.MeshLambertMaterial({ color: SKIN });
  const pale = new THREE.MeshLambertMaterial({ color: SKIN_PALE });
  owned.push(dark, pale);

  /** Raccourci : une capsule orientee vers le bas depuis son point d'attache. */
  function limb(
    radius: number,
    length: number,
    mat: THREE.Material,
    caps = 4,
    seg = 6,
  ): THREE.Mesh {
    const geo = new THREE.CapsuleGeometry(radius, length, caps, seg);
    owned.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    // On accroche la capsule par le haut : pivoter le groupe fait pivoter le
    // membre autour de son articulation, pas autour de son milieu.
    mesh.position.y = -length / 2;
    return mesh;
  }
  function box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
    const geo = new THREE.BoxGeometry(w, h, d);
    owned.push(geo);
    return new THREE.Mesh(geo, mat);
  }

  /**
   * Un paquet de petites boites figees les unes par rapport aux autres, en un
   * seul appel de rendu. Les os saillants (cotes, clavicules, omoplates) ne
   * bougent jamais entre eux : les dessiner separement coutait une quinzaine
   * d'appels pour du detail de surface.
   */
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  owned.push(unitBox);
  function boneCluster(mat: THREE.Material, pieces: BonePiece[]): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(unitBox, mat, pieces.length);
    const m = new THREE.Matrix4();
    const e = new THREE.Euler();
    const q = new THREE.Quaternion();
    pieces.forEach((p, i) => {
      e.set(p.rot?.[0] ?? 0, p.rot?.[1] ?? 0, p.rot?.[2] ?? 0);
      q.setFromEuler(e);
      m.compose(
        new THREE.Vector3(...p.pos),
        q,
        new THREE.Vector3(...p.size),
      );
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    return mesh;
  }

  // ------------------------------------------------------------------
  // Jambes : articulation inversee, comme une patte d'animal. Le genou
  // part en arriere, ce qui donne une demarche qui n'est pas humaine.
  // ------------------------------------------------------------------
  const legs: MonsterParts["legs"] = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.175, 1.85, 0);
    hip.add(limb(0.075, 0.84, dark));
    // Genoux ecartes, chevilles rentrees : les jambes se lisent comme deux
    // membres et non comme un tronc unique.
    hip.rotation.z = side * 0.09;

    const shin = new THREE.Group();
    shin.position.y = -0.84;
    shin.rotation.z = side * -0.14;
    shin.add(limb(0.056, 0.86, dark));
    // Rotule saillante : le point clair qui separe cuisse et tibia.
    const knee = box(0.085, 0.06, 0.07, pale);
    knee.position.set(0, 0.02, 0.035);
    shin.add(knee);
    // Pied long et osseux, pose sur la pointe.
    const foot = box(0.12, 0.05, 0.32, dark);
    foot.position.set(0, -0.88, 0.09);
    shin.add(foot);
    hip.add(shin);

    group.add(hip);
    legs.push({ hip, shin });
  }

  // Bassin etroit : elle n'a presque rien entre les hanches et les cotes.
  const pelvis = box(0.3, 0.2, 0.18, dark);
  pelvis.position.y = 1.89;
  group.add(pelvis);
  // Cretes iliaques saillantes : sans elles, tout le bas du corps n'est
  // qu'une colonne noire entre les cotes et les jambes.
  group.add(
    boneCluster(pale, [
      { pos: [-0.12, 1.96, 0.07], size: [0.1, 0.07, 0.05], rot: [0, 0, -0.35] },
      { pos: [0.12, 1.96, 0.07], size: [0.1, 0.07, 0.05], rot: [0, 0, 0.35] },
    ]),
  );

  // ------------------------------------------------------------------
  // Buste : penche en avant. Les epaules montent plus haut que la tete.
  // ------------------------------------------------------------------
  const spine = new THREE.Group();
  spine.position.y = 1.95;
  spine.rotation.x = 0.26; // voutee
  group.add(spine);

  // Cage thoracique large, taille minuscule : c'est ce rapport-la qui fait
  // lire « affame » plutot que « mince ». Sans lui, le corps n'est qu'un
  // poteau de la meme epaisseur du haut en bas.
  const ribcage = limb(0.19, 0.3, dark, 4, 8);
  ribcage.position.y = 0.02;
  ribcage.scale.set(1.1, 1, 0.58); // plate de profil
  spine.add(ribcage);
  const waist = limb(0.085, 0.2, dark, 4, 6);
  waist.position.y = -0.16;
  spine.add(waist);

  // Cotes, sternum et clavicules : des aretes claires qui accrochent la lampe
  // torche et dessinent la cage meme quand le reste du corps reste noir.
  const ribPieces: BonePiece[] = [];
  for (let i = 0; i < 5; i++) {
    ribPieces.push({
      pos: [0, 0.1 - i * 0.062, 0.105 - i * 0.009],
      size: [0.34 - i * 0.045, 0.026, 0.02],
    });
  }
  ribPieces.push({ pos: [0, 0.02, 0.115], size: [0.035, 0.26, 0.02] });
  for (const side of [-1, 1]) {
    ribPieces.push({
      pos: [side * 0.11, 0.23, 0.085],
      size: [0.2, 0.028, 0.024],
      rot: [0, 0, side * -0.22],
    });
  }
  spine.add(boneCluster(pale, ribPieces));

  // Omoplates et joug d'epaules : plats et rejetes en arriere. Pointes vers
  // le haut, ils se lisaient comme des oreilles ou des cornes.
  spine.add(
    boneCluster(dark, [
      { pos: [-0.19, 0.31, -0.11], size: [0.2, 0.17, 0.05], rot: [-0.35, 0, -0.24] },
      { pos: [0.19, 0.31, -0.11], size: [0.2, 0.17, 0.05], rot: [-0.35, 0, 0.24] },
      { pos: [0, 0.34, 0], size: [0.5, 0.09, 0.13] },
    ]),
  );

  // ------------------------------------------------------------------
  // Nuque et tete : la tete PEND en avant, sous la ligne des epaules.
  // ------------------------------------------------------------------
  const neck = new THREE.Group();
  neck.position.set(0, 0.3, 0.04);
  spine.add(neck);
  const neckMesh = limb(0.038, 0.3, pale);
  neckMesh.rotation.x = -0.5;
  neckMesh.position.z = 0.07;
  neck.add(neckMesh);

  const head = new THREE.Group();
  head.position.set(0, -0.16, 0.19);
  neck.add(head);

  const skullGeo = new THREE.SphereGeometry(0.135, 12, 12);
  owned.push(skullGeo);
  const skull = new THREE.Mesh(skullGeo, pale);
  skull.scale.set(1, 1.22, 1.1);
  head.add(skull);

  // Machoire separee : elle peut se decrocher pendant le screamer.
  const jaw = box(0.15, 0.1, 0.15, pale);
  jaw.position.set(0, -0.15, 0.03);
  head.add(jaw);

  // Le visage : plan non eclaire, pose juste devant la surface du crane
  // (rayon 0.135 x 1.1 = 0.149) pour ne pas etre enferme dedans.
  const faceMat = new THREE.MeshBasicMaterial({
    map: makeMonsterFaceTexture(),
    transparent: true,
    depthWrite: false,
  });
  owned.push(faceMat);
  const faceGeo = new THREE.PlaneGeometry(0.26, 0.32);
  owned.push(faceGeo);
  const face = new THREE.Mesh(faceGeo, faceMat);
  face.position.set(0, -0.01, 0.155);
  head.add(face);

  // Les yeux : hors brouillard et non eclaires. Dans le noir complet, au
  // bout d'un couloir, c'est tout ce que tu vois — et ca suffit.
  const eyeGeo = new THREE.SphereGeometry(0.028, 6, 6);
  owned.push(eyeGeo);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffd9c0, fog: false });
  owned.push(eyeMat);
  const eyes = new THREE.Mesh(eyeGeo, eyeMat);
  eyes.position.set(-0.045, 0.035, 0.15);
  head.add(eyes);
  const eyeRight = new THREE.Mesh(eyeGeo, eyeMat);
  eyeRight.position.set(0.048, 0.026, 0.15); // decale : rien n'est symetrique
  head.add(eyeRight);

  // Cheveux : des meches fines qui pendent devant le visage. On ne voit la
  // figure que par intermittence, et c'est bien pire que de la voir en entier.
  const hair = new THREE.Group();
  hair.position.set(0, 0.09, 0);
  head.add(hair);
  const strandGeo = new THREE.CylinderGeometry(0.006, 0.002, 1, 3);
  owned.push(strandGeo);
  const hairMat = new THREE.MeshLambertMaterial({ color: 0x07060a });
  owned.push(hairMat);
  // Une mèche = un appel de rendu si on en fait des Mesh separes, soit une
  // trentaine d'appels pour de la coiffure. InstancedMesh les dessine toutes
  // d'un coup : le groupe `hair` continue de pivoter comme un seul objet.
  const STRANDS = 28;
  const hairMesh = new THREE.InstancedMesh(strandGeo, hairMat, STRANDS);
  const strandMatrix = new THREE.Matrix4();
  const strandEuler = new THREE.Euler();
  const strandQuat = new THREE.Quaternion();
  const strandPos = new THREE.Vector3();
  const strandScale = new THREE.Vector3();
  let placed = 0;
  for (let i = 0; i < STRANDS; i++) {
    const a = (i / STRANDS) * Math.PI * 2;
    // Les meches de devant sont plus longues : elles tombent sur le visage
    // et n'en laissent voir que des morceaux.
    const front = Math.max(0, Math.cos(a));
    // Devant, une meche sur deux seulement : sinon le rideau de cheveux
    // masque completement la figure et se lit comme une barbe.
    if (front > 0.55 && i % 2 === 0) continue;
    const len = 0.26 + front * 0.34 + Math.random() * 0.22;
    strandPos.set(Math.sin(a) * 0.115, -len / 2 + 0.05, Math.cos(a) * 0.12);
    // Elles partent du haut du crane et suivent sa courbe avant de pendre :
    // posees droites, elles formaient une cage d'abat-jour.
    strandEuler.set(
      -Math.cos(a) * 0.3 + (Math.random() - 0.5) * 0.18,
      0,
      Math.sin(a) * 0.3 + (Math.random() - 0.5) * 0.18,
    );
    strandQuat.setFromEuler(strandEuler);
    strandScale.set(1.6, len, 1.6);
    strandMatrix.compose(strandPos, strandQuat, strandScale);
    hairMesh.setMatrixAt(placed, strandMatrix);
    placed++;
  }
  hairMesh.count = placed;
  hairMesh.instanceMatrix.needsUpdate = true;
  hairMesh.computeBoundingSphere();
  hair.add(hairMesh);

  // ------------------------------------------------------------------
  // Bras : demesures. Les mains arrivent au niveau des chevilles.
  // ------------------------------------------------------------------
  const arms: MonsterParts["arms"] = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.19, 0.3, -0.02);
    shoulder.add(limb(0.047, 0.66, dark));
    // Au repos les bras tombent COLLES au corps, legerement en avant : la
    // silhouette reste une colonne etroite. Ecartes, elle ferait epouvantail.
    shoulder.rotation.z = side * -0.04;
    spine.add(shoulder);

    const elbow = new THREE.Group();
    elbow.position.y = -0.66;
    elbow.add(limb(0.038, 0.62, dark));
    shoulder.add(elbow);

    const palm = box(0.075, 0.11, 0.035, pale);
    palm.position.y = -0.68;
    elbow.add(palm);

    // Trois doigts trop longs, qui remuent tout seuls. Trois et non cinq :
    // une main qui n'a pas le bon compte de doigts derange davantage, et
    // chaque doigt en moins est un appel de rendu economise.
    const fingers: THREE.Group[] = [];
    for (let f = 0; f < 3; f++) {
      const finger = new THREE.Group();
      finger.position.set((f - 1) * 0.028, -0.73, 0.004);
      const bone = limb(0.0095, 0.19, pale, 3, 4);
      finger.add(bone);
      const nail = limb(0.006, 0.06, dark, 3, 4);
      nail.position.y = -0.205;
      finger.add(nail);
      elbow.add(finger);
      fingers.push(finger);
    }

    arms.push({ shoulder, elbow, fingers });
  }

  return {
    group,
    spine,
    neck,
    head,
    jaw,
    face,
    faceMat,
    eyes,
    eyeMat,
    hair,
    legs,
    arms,
    dispose() {
      for (const o of owned) o.dispose();
    },
  };
}

export interface MonsterPose {
  /** Temps ecoule, en secondes. Pilote les tics et la respiration. */
  time: number;
  /** Avance avec les pas. 0 quand elle est immobile. */
  walk: number;
  /** Vitesse actuelle, pour amplifier la foulee. */
  speed: number;
  /**
   * Lacet vers le joueur, RELATIF a l'orientation du corps. C'est lui qui
   * permet a la tete de rester braquee sur toi quand elle marche ailleurs.
   */
  headYaw: number;
  /** Tangage vers le joueur : elle baisse la tete sur toi quand tu es pres. */
  headPitch: number;
  /** 0 = normale, 1 = elle bondit (machoire decrochee, bras ecartes). */
  lunge: number;
}

/** L'angle au-dela duquel la nuque ne peut plus suivre. Elle va au-dela. */
const NECK_LIMIT = 1.75;

export function poseMonster(m: MonsterParts, p: MonsterPose) {
  const stride = Math.min(1, p.speed / 2.4);

  // --- Jambes : le genou inverse part en arriere, et elle boite. ---
  m.legs.forEach((leg, i) => {
    const phase = p.walk + i * Math.PI;
    // La jambe droite a une foulee plus courte : la boiterie est ce qui
    // rend la demarche reconnaissable a l'oreille comme a l'oeil.
    const limpAmount = i === 1 ? 0.62 : 1;
    leg.hip.rotation.x = Math.sin(phase) * 0.6 * stride * limpAmount;
    const lift = Math.max(0, Math.sin(phase + 0.9));
    leg.shin.rotation.x = -0.22 - lift * 0.95 * stride * limpAmount;
  });

  // --- Respiration : les cotes se soulevent, trop lentement. ---
  const breath = Math.sin(p.time * 0.9) * 0.5 + 0.5;
  m.spine.scale.set(1 + breath * 0.035, 1, 1 + breath * 0.05);
  // Elle se voute davantage quand elle charge.
  m.spine.rotation.x = 0.26 + stride * 0.16 + p.lunge * 0.3;
  // Balancement d'epaules, decale d'un demi-pas par rapport aux jambes.
  m.spine.rotation.z = Math.sin(p.walk + 1.6) * 0.06 * stride;

  // --- Tete : elle suit le joueur meme quand le corps part ailleurs. ---
  const wanted = THREE.MathUtils.clamp(p.headYaw, -NECK_LIMIT, NECK_LIMIT);
  m.neck.rotation.y += (wanted - m.neck.rotation.y) * 0.14;
  m.neck.rotation.x = THREE.MathUtils.clamp(p.headPitch, -0.5, 0.7) - p.lunge * 0.55;
  // Inclinaison lente et irreguliere du crane : le detail qui met mal a l'aise.
  m.head.rotation.z = Math.sin(p.time * 0.37) * 0.3 + Math.sin(p.time * 1.9) * 0.04;
  // Tic : toutes les quelques secondes, un sursaut sec.
  const twitch = Math.max(0, Math.sin(p.time * 0.8) - 0.985) * 60;
  m.head.rotation.y = twitch * 0.25;

  // --- Machoire : decrochee pendant le bond. ---
  m.jaw.position.y = -0.15 - p.lunge * 0.14;
  m.jaw.rotation.x = p.lunge * 0.5;

  // --- Yeux : ils s'allument quand elle charge. ---
  // Quasi blancs : plus sombres, ils se noyaient dans le noir au lieu d en
  // percer le fond, ce qui etait tout l interet de les sortir du brouillard.
  const glow = 1 + breath * 0.25 + p.lunge * 0.8;
  m.eyeMat.color.setRGB(glow, glow * 0.82, glow * 0.7);

  // --- Cheveux : ils trainent derriere le mouvement. ---
  m.hair.rotation.x = -0.08 - stride * 0.22 - p.lunge * 0.3;
  m.hair.rotation.z = Math.sin(p.walk * 0.5) * 0.07 * stride;

  // --- Bras : ils pendent et suivent avec du retard, puis s'ecartent. ---
  m.arms.forEach((arm, i) => {
    const side = i === 0 ? -1 : 1;
    const phase = p.walk + i * Math.PI;
    // Le bras se leve peu : c'est le COUDE qui plie, et l'avant-bras qui
    // vient vers toi. Un bras tendu en grand ecart fait epouvantail ;
    // un coude plie, main en avant, fait quelqu'un qui attrape.
    arm.shoulder.rotation.x = 0.12 - Math.sin(phase) * 0.34 * stride - p.lunge * 0.75;
    arm.shoulder.rotation.z = side * (-0.04 + p.lunge * 0.3);
    arm.elbow.rotation.x =
      -0.22 - Math.max(0, Math.sin(phase)) * 0.2 * stride - p.lunge * 1.25;
    // Les doigts ne sont jamais au repos, et se recourbent quand elle saisit.
    arm.fingers.forEach((finger, f) => {
      finger.rotation.x =
        Math.sin(p.time * (2.1 + f * 0.37) + i * 2 + f) * 0.22 - 0.1 + p.lunge * 0.85;
      finger.rotation.z = Math.sin(p.time * 1.3 + f) * 0.06 + side * p.lunge * 0.12;
    });
  });
}
