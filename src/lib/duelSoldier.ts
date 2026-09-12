import * as THREE from "three";

/**
 * Les combattants du Duel, vus de l'exterieur : les bots comme les vrais
 * joueurs en ligne.
 *
 * L'ancien modele etait une capsule surmontee d'une sphere. Dans un jeu de
 * tir, ce que tu dois lire en un quart de seconde a trente metres, c'est :
 *   - « c'est quelqu'un » (une silhouette humaine, avec des jambes) ;
 *   - « il est de quel camp » (une couleur franche sur le torse et le casque) ;
 *   - « ou il regarde » (la visiere et l'arme pointent la meme direction) ;
 *   - « il bouge ou il est a couvert » (les jambes marchent vraiment).
 * Une capsule ne dit rien de tout ca.
 *
 * Contraintes du Mode 3D respectees : MeshLambertMaterial uniquement, aucun
 * asset externe, et un budget d'appels de rendu serre parce qu'un mode a
 * plusieurs bots affiche jusqu'a six de ces modeles en meme temps.
 */

/** Une plaque d'equipement figee : position, taille, rotation. */
interface Plate {
  pos: [number, number, number];
  size: [number, number, number];
  rot?: [number, number, number];
}

export interface SoldierParts {
  group: THREE.Group;
  /** Pivot du buste : il se penche a la course et s'effondre a la mort. */
  torso: THREE.Group;
  /** Bras + arme solidaires : ils suivent le tangage de la visee. */
  aim: THREE.Group;
  head: THREE.Group;
  legs: { hip: THREE.Group; shin: THREE.Group }[];
  /** Eclair de bouche de son arme : c'est ce qui te dit qu'il tire sur toi. */
  flash: THREE.Mesh;
  setTeamColor(hex: number): void;
  dispose(): void;
}

/** Un soldat complet mesure 1,80 m ; sa tete est a DUEL_HEAD_Y (1,62). */
export const SOLDIER_HEIGHT = 1.8;

export function buildSoldier(teamHex: number): SoldierParts {
  const group = new THREE.Group();
  const owned: (THREE.BufferGeometry | THREE.Material)[] = [];

  // Trois materiaux seulement : l'uniforme, l'equipement, et la couleur
  // d'equipe. Moins de materiaux = moins de changements d'etat GPU.
  //
  // L'uniforme est volontairement PLUS CLAIR que les murs de l'arene. Un
  // premier jet a 0x22262c donnait des soldats qui disparaissaient dans les
  // couloirs sombres : dans un jeu de tir, ne pas voir l'ennemi n'est pas
  // une ambiance, c'est un defaut.
  const cloth = new THREE.MeshLambertMaterial({ color: 0x454f5c });
  const gear = new THREE.MeshLambertMaterial({ color: 0x23282f });
  const team = new THREE.MeshLambertMaterial({ color: teamHex });
  owned.push(cloth, gear, team);

  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  owned.push(unitBox);

  function limb(radius: number, length: number, mat: THREE.Material, seg = 6): THREE.Mesh {
    const geo = new THREE.CapsuleGeometry(radius, length, 3, seg);
    owned.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    // Accrochee par le haut : tourner le groupe fait pivoter le membre
    // autour de son articulation, pas autour de son milieu.
    mesh.position.y = -length / 2;
    return mesh;
  }
  function box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
    const geo = new THREE.BoxGeometry(w, h, d);
    owned.push(geo);
    return new THREE.Mesh(geo, mat);
  }
  /** Plusieurs petites plaques figees entre elles, en un seul appel de rendu. */
  function plates(mat: THREE.Material, pieces: Plate[]): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(unitBox, mat, pieces.length);
    const m = new THREE.Matrix4();
    const e = new THREE.Euler();
    const q = new THREE.Quaternion();
    pieces.forEach((p, i) => {
      e.set(p.rot?.[0] ?? 0, p.rot?.[1] ?? 0, p.rot?.[2] ?? 0);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(...p.pos), q, new THREE.Vector3(...p.size));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    return mesh;
  }

  // ---------------------------------------------------------------- jambes
  const legs: SoldierParts["legs"] = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.11, 0.86, 0);
    hip.add(limb(0.085, 0.42, cloth));

    const shin = new THREE.Group();
    shin.position.y = -0.42;
    shin.add(limb(0.07, 0.4, cloth));
    // Botte : le bloc sombre qui ancre la silhouette au sol.
    const boot = box(0.15, 0.11, 0.26, gear);
    boot.position.set(0, -0.44, 0.03);
    shin.add(boot);
    // Bande d'equipe sur la cuisse : on identifie le camp meme quand seules
    // les jambes depassent d'un couvert.
    const band = box(0.175, 0.09, 0.175, team);
    band.position.y = -0.3;
    hip.add(band);
    hip.add(shin);

    group.add(hip);
    legs.push({ hip, shin });
  }

  // ----------------------------------------------------------------- buste
  const torso = new THREE.Group();
  torso.position.y = 0.9;
  group.add(torso);

  const chest = box(0.42, 0.46, 0.25, cloth);
  chest.position.y = 0.22;
  torso.add(chest);

  // Gilet pare-balles aux couleurs de l'equipe : c'est LA zone qu'on voit en
  // premier, donc c'est elle qui porte l'identification.
  torso.add(
    plates(team, [
      { pos: [0, 0.26, 0.135], size: [0.3, 0.3, 0.04] },
      { pos: [0, 0.26, -0.135], size: [0.3, 0.3, 0.04] },
      { pos: [-0.2, 0.3, 0], size: [0.06, 0.16, 0.22] },
      { pos: [0.2, 0.3, 0], size: [0.06, 0.16, 0.22] },
      // Epaulettes : visibles meme de dos et de profil.
      { pos: [-0.23, 0.38, 0], size: [0.12, 0.07, 0.24] },
      { pos: [0.23, 0.38, 0], size: [0.12, 0.07, 0.24] },
    ]),
  );
  // Sangles, poches et sac : du volume sombre qui casse la forme de boite.
  torso.add(
    plates(gear, [
      { pos: [0, 0.06, 0.14], size: [0.26, 0.1, 0.06] },
      { pos: [-0.1, 0.12, 0.15], size: [0.08, 0.08, 0.05] },
      { pos: [0.1, 0.12, 0.15], size: [0.08, 0.08, 0.05] },
      { pos: [0, 0.24, -0.2], size: [0.3, 0.34, 0.14] },
      { pos: [0, 0.02, 0], size: [0.36, 0.12, 0.24] },
    ]),
  );

  // ------------------------------------------------------------------ tete
  const head = new THREE.Group();
  head.position.y = 0.72;
  torso.add(head);

  const neck = box(0.1, 0.08, 0.1, gear);
  neck.position.y = -0.06;
  head.add(neck);

  const skullGeo = new THREE.SphereGeometry(0.12, 10, 8);
  owned.push(skullGeo);
  const skull = new THREE.Mesh(skullGeo, gear);
  skull.scale.set(1, 1.05, 1.1);
  head.add(skull);

  // Casque : une demi-sphere aux couleurs de l'equipe. Vue de loin, c'est le
  // second reperage de camp apres le gilet.
  const helmetGeo = new THREE.SphereGeometry(0.132, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.58);
  owned.push(helmetGeo);
  const helmet = new THREE.Mesh(helmetGeo, team);
  helmet.position.y = 0.025;
  helmet.scale.set(1, 1, 1.1);
  head.add(helmet);

  // Visiere non eclairee : elle brille meme dans l'ombre, et donne au premier
  // coup d'oeil la direction du regard.
  const visorMat = new THREE.MeshBasicMaterial({ color: 0x6ff0ff });
  owned.push(visorMat);
  const visorGeo = new THREE.BoxGeometry(0.17, 0.045, 0.02);
  owned.push(visorGeo);
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 0.005, 0.115);
  head.add(visor);

  // ------------------------------------------------- bras et arme solidaires
  // Les deux avant-bras et le fusil forment un seul ensemble qui pivote avec
  // le tangage : l'arme pointe donc toujours exactement ou il vise.
  const aim = new THREE.Group();
  aim.position.set(0, 0.34, 0);
  torso.add(aim);

  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.24, 0.04, 0);
    // Bras plies vers l'avant, en position de tir.
    shoulder.rotation.x = side === -1 ? -1.15 : -1.35;
    shoulder.rotation.z = side * 0.22;
    shoulder.add(limb(0.068, 0.34, cloth));
    const fore = new THREE.Group();
    fore.position.y = -0.34;
    fore.rotation.x = side === -1 ? 0.75 : 1.0;
    fore.add(limb(0.058, 0.3, gear));
    shoulder.add(fore);
    aim.add(shoulder);
  }

  const weapon = new THREE.Group();
  weapon.position.set(0.07, -0.02, 0.22);
  aim.add(weapon);
  const receiver = box(0.07, 0.11, 0.4, gear);
  weapon.add(receiver);
  const barrelGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.34, 6);
  owned.push(barrelGeo);
  const barrel = new THREE.Mesh(barrelGeo, gear);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 0.34;
  weapon.add(barrel);
  const stock = box(0.06, 0.09, 0.2, cloth);
  stock.position.z = -0.27;
  weapon.add(stock);
  const mag = box(0.05, 0.16, 0.07, gear);
  mag.position.set(0, -0.12, 0.02);
  weapon.add(mag);

  // Eclair de bouche : non eclaire, visible a travers toute l'arene.
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xfff0b0,
    transparent: true,
    opacity: 0.95,
  });
  owned.push(flashMat);
  const flashGeo = new THREE.SphereGeometry(0.11, 6, 5);
  owned.push(flashGeo);
  const flash = new THREE.Mesh(flashGeo, flashMat);
  flash.position.z = 0.54;
  flash.scale.set(1, 1, 1.7);
  flash.visible = false;
  weapon.add(flash);

  return {
    group,
    torso,
    aim,
    head,
    legs,
    flash,
    setTeamColor(hex: number) {
      team.color.setHex(hex);
    },
    dispose() {
      for (const o of owned) o.dispose();
    },
  };
}

export interface SoldierPose {
  /** Avance avec les pas ; fige quand il est immobile. */
  walk: number;
  /** Vitesse au sol, pour amplifier la foulee. */
  speed: number;
  /** Tangage de visee, en radians (positif = il vise vers le haut). */
  pitch: number;
  /** 0 = debout, 1 = effondre. Pilote la chute a la mort. */
  death: number;
}

export function poseSoldier(s: SoldierParts, p: SoldierPose) {
  const stride = Math.min(1, p.speed / 4.2);

  s.legs.forEach((leg, i) => {
    const phase = p.walk + i * Math.PI;
    leg.hip.rotation.x = Math.sin(phase) * 0.78 * stride;
    // Le genou ne plie que pendant la phase de retour : sinon la jambe
    // traverse le sol au lieu de se lever.
    leg.shin.rotation.x = -Math.max(0, Math.sin(phase + 0.6)) * 1.1 * stride;
  });

  // Il se penche en avant quand il court : lisible de loin, et ca donne du
  // poids a sa course.
  s.torso.rotation.x = stride * 0.17;
  s.torso.position.y = 0.9 + Math.abs(Math.sin(p.walk)) * 0.03 * stride;
  // Le buste roule legerement en sens inverse des jambes.
  s.torso.rotation.z = Math.sin(p.walk) * 0.05 * stride;

  // L'arme et la tete suivent la visee, en retirant l'inclinaison du buste
  // pour que le canon pointe bien la ou il regarde.
  s.aim.rotation.x = -p.pitch - stride * 0.17;
  s.head.rotation.x = -p.pitch * 0.6 - stride * 0.17;

  if (p.death > 0) {
    // Effondrement : il bascule en arriere et s'enfonce dans le sol.
    const t = Math.min(1, p.death);
    s.group.rotation.x = -t * 1.45;
    s.group.position.y = -t * 0.35;
  } else {
    s.group.rotation.x = 0;
    s.group.position.y = 0;
  }
}
