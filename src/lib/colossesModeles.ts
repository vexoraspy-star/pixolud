import * as THREE from "three";
import type { Colosse } from "./colosses";

/**
 * Les combattants de Colosses, construits en volumes simples.
 *
 * Aucun fichier de modele : tout est pose ici, piece par piece, avec de
 * vraies articulations (epaule, coude, hanche, genou, taille, cou). C'est ce
 * qui permet des animations qui ressemblent a quelque chose — un bras qui se
 * plie au coude, un buste qui tourne sur un direct, une jambe qui se replie
 * avant le coup de pied.
 *
 * Chaque personnage a une silhouette propre (carrure, coiffe, cape,
 * epaulieres) : dans un jeu de combat, on doit reconnaitre qui est qui de
 * l'autre bout de l'ecran, avant meme de lire son nom.
 */

export type Articulation =
  | "racine"
  | "corps"
  | "bassin"
  | "torse"
  | "cou"
  | "epauleG"
  | "epauleD"
  | "coudeG"
  | "coudeD"
  | "hancheG"
  | "hancheD"
  | "genouG"
  | "genouD"
  | "cape";

export type Squelette = Partial<Record<Articulation, THREE.Object3D>>;

export interface ModeleColosse {
  /** Le personnage entier : c'est lui qu'on place et qu'on fait tomber au K.O. */
  racine: THREE.Group;
  os: Squelette;
  /** L'ombre au sol, qui suit le personnage sans monter avec lui. */
  ombre: THREE.Mesh;
  /** Hauteur des hanches au repos : l'accroupissement part de la. */
  hauteurBassin: number;
}

type Garder = <T extends { dispose(): void }>(x: T) => T;

export function construireColosse(perso: Colosse, garder: Garder): ModeleColosse {
  const { allure } = perso;
  const k = allure.carrure;
  const t = allure.taille;

  const peau = garder(new THREE.MeshLambertMaterial({ color: perso.peau }));
  const armure = garder(new THREE.MeshLambertMaterial({ color: perso.armure }));
  const tissu = garder(new THREE.MeshLambertMaterial({ color: allure.tissu }));
  const lueur = garder(new THREE.MeshBasicMaterial({ color: perso.accent }));
  const sombre = garder(new THREE.MeshLambertMaterial({ color: 0x0b0b10 }));

  const boite = (l: number, h: number, p: number, m: THREE.Material) =>
    new THREE.Mesh(garder(new THREE.BoxGeometry(l, h, p)), m);
  const tube = (r1: number, r2: number, h: number, m: THREE.Material, seg = 8) =>
    new THREE.Mesh(garder(new THREE.CylinderGeometry(r1, r2, h, seg)), m);

  const racine = new THREE.Group();
  racine.scale.setScalar(t);
  const os: Squelette = { racine };

  // Le corps pivote aux pieds : c'est lui qui bascule en arriere au K.O.
  // Separe de la racine, qui porte deja l'orientation vers l'adversaire —
  // melanger les deux rotations couchait le personnage sur le cote.
  const corps = new THREE.Group();
  racine.add(corps);
  os.corps = corps;

  // --- Le bassin porte tout le reste ---
  const hauteurBassin = 1.02;
  const bassin = new THREE.Group();
  bassin.position.y = hauteurBassin;
  corps.add(bassin);
  os.bassin = bassin;

  const hanches = boite(0.62 * k, 0.26, 0.36, tissu);
  hanches.position.y = 0.02;
  bassin.add(hanches);

  // Ceinture et boucle : un repere visuel a hauteur de taille.
  const ceinture = boite(0.66 * k, 0.1, 0.4, armure);
  ceinture.position.y = 0.16;
  bassin.add(ceinture);
  const boucle = boite(0.16, 0.12, 0.05, lueur);
  boucle.position.set(0, 0.16, 0.21);
  bassin.add(boucle);

  // --- Le torse pivote a la taille : c'est lui qui tourne sur un direct ---
  const torse = new THREE.Group();
  torse.position.y = 0.2;
  bassin.add(torse);
  os.torse = torse;

  // Abdomen plus etroit, poitrine plus large : la silhouette en V d'un
  // combattant, au lieu d'une boite droite.
  const abdomen = boite(0.5 * k, 0.34, 0.3, peau);
  abdomen.position.y = 0.18;
  torse.add(abdomen);
  const poitrine = boite(0.78 * k, 0.46, 0.4, allure.tete === "casque" ? armure : peau);
  poitrine.position.y = 0.56;
  torse.add(poitrine);
  // Un plastron ou une bande de tissu en travers, selon le personnage.
  if (allure.tete === "casque") {
    const embleme = boite(0.2, 0.2, 0.04, lueur);
    embleme.position.set(0, 0.58, 0.21);
    torse.add(embleme);
  } else {
    const bande = boite(0.16, 0.62, 0.43, tissu);
    bande.position.set(0.06 * k, 0.5, 0);
    bande.rotation.z = 0.55;
    torse.add(bande);
  }

  // --- Cou et tete ---
  const cou = new THREE.Group();
  cou.position.y = 0.82;
  torse.add(cou);
  os.cou = cou;
  const gorge = tube(0.1, 0.12, 0.14, peau);
  gorge.position.y = 0.05;
  cou.add(gorge);

  const tete = boite(0.36, 0.42, 0.38, peau);
  tete.position.y = 0.3;
  cou.add(tete);

  const yeux = (y: number, profondeur: number) => {
    for (const dx of [-0.08, 0.08]) {
      const oeil = boite(0.07, 0.035, 0.02, lueur);
      oeil.position.set(dx, y, profondeur);
      cou.add(oeil);
    }
  };

  switch (allure.tete) {
    case "masque": {
      // Masque de tissu sur le bas du visage, bandeau et ses deux pans.
      const masque = boite(0.38, 0.2, 0.4, tissu);
      masque.position.set(0, 0.2, 0.005);
      cou.add(masque);
      const bandeau = boite(0.39, 0.07, 0.4, tissu);
      bandeau.position.set(0, 0.44, 0);
      cou.add(bandeau);
      for (const dy of [0, -0.1]) {
        const pan = boite(0.05, 0.26, 0.03, tissu);
        pan.position.set(0.06, 0.34 + dy, -0.22);
        pan.rotation.x = 0.5;
        cou.add(pan);
      }
      yeux(0.33, 0.195);
      break;
    }
    case "capuche": {
      // Capuche ouverte devant : le visage reste dans l'ombre, seuls les
      // yeux brillent. C'est ce qui rend la silhouette inquietante.
      const capuche = boite(0.48, 0.52, 0.46, tissu);
      capuche.position.set(0, 0.33, -0.03);
      cou.add(capuche);
      const ombreVisage = boite(0.3, 0.3, 0.02, sombre);
      ombreVisage.position.set(0, 0.28, 0.2);
      cou.add(ombreVisage);
      const pointe = boite(0.2, 0.2, 0.2, tissu);
      pointe.position.set(0, 0.55, -0.16);
      pointe.rotation.x = -0.6;
      cou.add(pointe);
      yeux(0.3, 0.215);
      break;
    }
    case "crane": {
      // Crane rase, arcade lourde et barbe carree : une brute.
      const arcade = boite(0.38, 0.06, 0.08, peau);
      arcade.position.set(0, 0.38, 0.17);
      cou.add(arcade);
      const barbe = boite(0.34, 0.16, 0.12, tissu);
      barbe.position.set(0, 0.12, 0.16);
      cou.add(barbe);
      yeux(0.33, 0.195);
      break;
    }
    case "casque": {
      // Casque ferme, fente de visiere et cimier : un chevalier.
      const casque = boite(0.42, 0.46, 0.42, armure);
      casque.position.set(0, 0.31, 0);
      cou.add(casque);
      const fente = boite(0.3, 0.05, 0.02, lueur);
      fente.position.set(0, 0.33, 0.215);
      cou.add(fente);
      const cimier = boite(0.06, 0.22, 0.42, tissu);
      cimier.position.set(0, 0.62, -0.02);
      cou.add(cimier);
      break;
    }
  }

  // --- Les bras : epaule -> coude -> poing ---
  for (const cote of ["G", "D"] as const) {
    const signe = cote === "D" ? 1 : -1;
    const epaule = new THREE.Group();
    epaule.position.set(signe * 0.46 * k, 0.72, 0);
    torse.add(epaule);
    os[`epaule${cote}`] = epaule;

    if (allure.epaulieres) {
      const plaque = boite(0.36, 0.22, 0.4, armure);
      plaque.position.set(signe * 0.06, 0.06, 0);
      plaque.rotation.z = signe * -0.25;
      epaule.add(plaque);
      const clou = boite(0.08, 0.08, 0.08, lueur);
      clou.position.set(signe * 0.12, 0.2, 0);
      epaule.add(clou);
    }

    const bras = tube(0.1 * k, 0.085 * k, 0.42, peau);
    bras.position.y = -0.21;
    epaule.add(bras);

    const coude = new THREE.Group();
    coude.position.y = -0.42;
    epaule.add(coude);
    os[`coude${cote}`] = coude;

    const avantBras = tube(0.085 * k, 0.08 * k, 0.36, peau);
    avantBras.position.y = -0.18;
    coude.add(avantBras);
    // Bandages ou brassards : un detail qui donne l'allure d'un combattant.
    const brassard = tube(0.1 * k, 0.095 * k, 0.16, allure.epaulieres ? armure : tissu);
    brassard.position.y = -0.26;
    coude.add(brassard);

    const poing = boite(0.18 * k, 0.18, 0.2, armure);
    poing.position.y = -0.44;
    coude.add(poing);
  }

  // --- Les jambes : hanche -> genou -> pied ---
  for (const cote of ["G", "D"] as const) {
    const signe = cote === "D" ? 1 : -1;
    const hanche = new THREE.Group();
    hanche.position.set(signe * 0.17 * k, 0, 0);
    bassin.add(hanche);
    os[`hanche${cote}`] = hanche;

    const cuisse = tube(0.13 * k, 0.11 * k, 0.5, tissu);
    cuisse.position.y = -0.25;
    hanche.add(cuisse);

    const genou = new THREE.Group();
    genou.position.y = -0.5;
    hanche.add(genou);
    os[`genou${cote}`] = genou;

    const mollet = tube(0.105 * k, 0.085 * k, 0.44, tissu);
    mollet.position.y = -0.22;
    genou.add(mollet);
    const botte = boite(0.2 * k, 0.24, 0.24, armure);
    botte.position.set(0, -0.36, 0);
    genou.add(botte);
    const semelle = boite(0.2 * k, 0.08, 0.34, armure);
    semelle.position.set(0, -0.48, 0.06);
    genou.add(semelle);
  }

  // --- La cape, accrochee au haut du dos, qui ondule ---
  if (allure.cape) {
    const attache = new THREE.Group();
    attache.position.set(0, 0.78, -0.2);
    torse.add(attache);
    os.cape = attache;
    const cape = boite(0.7 * k, 1.25, 0.04, tissu);
    cape.position.y = -0.62;
    attache.add(cape);
  }

  // --- L'ombre au sol : sans elle, on ne sait pas si un personnage saute ---
  const ombre = new THREE.Mesh(
    garder(new THREE.CircleGeometry(0.62 * k, 20)),
    garder(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false })),
  );
  ombre.rotation.x = -Math.PI / 2;
  ombre.position.y = 0.01;

  return { racine, os, ombre, hauteurBassin };
}
