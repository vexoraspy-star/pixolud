import * as THREE from "three";
import type { WeaponId, WeaponLook } from "./duelWeapons";
import { block, front, lathe, optic, rod, side, sphere, tube, type Disposer, type Pt } from "./duelWeaponModels";
import {
  apertureSight,
  createShop,
  curvedMag,
  gripOrigin,
  hoodedPost,
  muzzleBrake,
  octoHandguard,
  put,
  rail,
  rearNotch,
  redDotTube,
  rifleGrip,
  rigBase,
  scope,
  screw,
  shotShell,
  sightDot,
  triggerBlade,
  triggerGuard,
  triggerUnder,
  type GunRig,
  type Shop,
} from "./duelWeaponModelsParts";
import { ARSENAL_2 } from "./duelWeaponModelsArsenal2";

export type { GunRig } from "./duelWeaponModelsParts";

/**
 * L'arsenal du Duel, modele par modele.
 *
 * Chaque arme est dessinee de profil comme sur une planche d'armurier :
 * carcasse, culasse, crosse et chargeur sont des contours extrudes et
 * biseautes (voir duelWeaponModels), les canons et les optiques sont tournes.
 * Les noms et les formes sont les notres : des armes generiques, dans le
 * style des armes reelles, sans copier aucun modele existant.
 *
 * Le repere est celui de la scene : x a droite, y en haut, la bouche vers -z.
 * Les dimensions gardent l'echelle des anciens modeles (environ 1,7 fois le
 * reel) : l'arme occupe la meme place a l'ecran, les mains aussi.
 */


// ---------------------------------------------------------------------------
// Pistolet : carcasse polymere, culasse acier noir, organes a trois points
// ---------------------------------------------------------------------------

function pistolet(s: Shop): GunRig {
  const { kit, body, f } = s;
  const tilt = -0.2;
  const rig = rigBase(s, "soutien", tilt);
  const H = gripOrigin(-0.022, 0.038, tilt);

  // --- Culasse mobile ---
  const slide = f.group(body);
  rig.slide = slide;
  put(
    s,
    slide,
    side(
      [
        [-0.236, 0.008, 0.003],
        [0.066, 0.008, 0.003],
        [0.07, 0.052, 0.004],
        [0.065, 0.062, 0.004],
        [-0.212, 0.062, 0.004],
        [-0.236, 0.044, 0.008],
      ],
      0.046,
      { bevel: 0.0055, seg: 2 },
    ),
    kit.blued,
  );
  // Stries de prise, a l'arriere et a l'avant.
  for (let i = 0; i < 8; i++) put(s, slide, block(0.0472, 0.034, 0.0026, 0.0005), kit.dark, 0, 0.034, 0.018 + i * 0.0058);
  for (let i = 0; i < 5; i++) put(s, slide, block(0.0472, 0.026, 0.0026, 0.0005), kit.dark, 0, 0.03, -0.2 + i * 0.0058);
  // Fenetre d'ejection a droite, et la chambre du canon qui y apparait.
  put(s, slide, block(0.0178, 0.031, 0.066, 0.001), kit.bore, 0.0148, 0.0472, -0.046);
  put(s, slide, block(0.026, 0.012, 0.062, 0.0015), kit.steel, 0, 0.0568, -0.046);
  put(s, slide, rod(0.0075, -0.074, -0.02, 10), kit.brass, 0.012, 0.042, 0);
  // Bout du canon, dans la culasse.
  put(s, slide, tube(0.0085, 0.0125, -0.2385, -0.225, 14, 0.0015), kit.steel, 0, 0.03, 0);
  put(s, slide, rod(0.0086, -0.2388, -0.23, 12), kit.bore, 0, 0.03, 0);
  // Organes de visee : hausse a cran, guidon, trois points.
  rearNotch(s, slide, 0.052, 0.0615, 0.034, 0.012, 0.0085, 0.006, 0.014);
  sightDot(s, slide, -0.011, 0.0675, 0.0443);
  sightDot(s, slide, 0.011, 0.0675, 0.0443);
  optic(put(s, slide, side([[-0.009, 0], [0.009, 0], [0.006, 0.011, 0.002], [-0.006, 0.011, 0.002]], 0.0075, { bevel: 0.001 }), kit.dark, 0, 0.0615, -0.212));
  sightDot(s, slide, 0, 0.068, -0.2055, 0.0024, kit.tritium);
  rig.ejectParent = slide;
  rig.ejectAt.set(0.03, 0.05, -0.046);
  rig.rackHand = true;

  // --- Carcasse ---
  put(
    s,
    body,
    side(
      [
        [-0.228, 0.014],
        [0.066, 0.014],
        [0.066, -0.01, 0.006],
        [0.044, -0.024],
        [-0.222, -0.024, 0.004],
        [-0.228, -0.014, 0.004],
      ],
      0.044,
      { bevel: 0.004, seg: 2 },
    ),
    kit.polymer,
  );
  // Rail sous le canon : trois encoches.
  for (let i = 0; i < 3; i++) put(s, body, block(0.046, 0.005, 0.007, 0.0008), kit.dark, 0, -0.0225, -0.205 + i * 0.022);
  // Levier d'arret de culasse et bouton de demontage, a gauche.
  put(s, body, side([[-0.07, 0.004], [0.008, 0.006], [0.012, 0.013, 0.003], [-0.03, 0.012], [-0.074, 0.01, 0.003]], 0.005, { bevel: 0.0012 }), kit.dark, -0.024, 0, 0);
  put(s, body, block(0.004, 0.008, 0.018, 0.001), kit.steel, -0.0225, 0.001, -0.108);
  // Axe et goupilles.
  screw(s, body, 0.0222, -0.006, -0.086, 0.0032);
  screw(s, body, -0.0222, -0.006, -0.086, 0.0032);
  screw(s, body, 0.0222, -0.004, 0.034, 0.003);

  // --- Pontet et detente ---
  triggerGuard(s, body, -0.126, -0.03, -0.022, -0.066, 0.026, 0.008);
  triggerBlade(s, body, -0.024, -0.07, 0.034);

  // --- Poignee (dans le repere de la main) ---
  const grip = f.group(body, H.x, H.y, H.z);
  grip.rotation.x = tilt;
  put(
    s,
    grip,
    side(
      [
        [-0.04, 0.086],
        [-0.042, 0.04, 0.012],
        [-0.047, 0.026, 0.008],
        [-0.042, 0.01, 0.008],
        [-0.047, -0.008, 0.008],
        [-0.042, -0.026, 0.008],
        [-0.046, -0.046, 0.008],
        [-0.045, -0.072, 0.01],
        [0.042, -0.074, 0.01],
        [0.046, -0.02, 0.03],
        [0.043, 0.04, 0.012],
        [0.05, 0.068, 0.008],
        [0.066, 0.08, 0.006],
        [0.062, 0.088, 0.004],
        [0.036, 0.1],
        [-0.04, 0.1],
      ],
      0.058,
      { bevel: 0.01, seg: 3 },
    ),
    kit.polymer,
  );
  // Plaquettes granitees : un panneau sombre de chaque cote.
  put(
    s,
    grip,
    side([[-0.034, 0.024], [0.034, 0.024], [0.037, -0.058, 0.01], [-0.036, -0.058, 0.01]], 0.0602, { bevel: 0.002, seg: 1 }),
    kit.dark,
  );
  // Bouton d'arretoir de chargeur, a gauche.
  put(s, grip, block(0.006, 0.012, 0.012, 0.002), kit.dark, -0.029, 0.07, -0.036);

  // --- Chargeur : il tombe au rechargement ---
  const mag = f.group(body);
  rig.mag = mag;
  const magFrame = f.group(mag, H.x, H.y, H.z);
  magFrame.rotation.x = tilt;
  put(s, magFrame, block(0.034, 0.16, 0.06, 0.004), kit.metal, 0, 0.008, 0.002);
  put(s, magFrame, side([[-0.046, -0.072], [0.044, -0.074], [0.042, -0.088, 0.006], [-0.044, -0.086, 0.006]], 0.058, { bevel: 0.003, seg: 1 }), kit.dark);
  put(s, magFrame, rod(0.0045, -0.012, 0.004, 8), kit.brass, 0, 0.09, 0.0);

  rig.muzzleZ = -0.24;
  rig.muzzleY = 0.03;
  rig.sightY = 0.0725;
  // Deux mains : la gauche enveloppe la droite, comme au stand.
  rig.rightHand.position.copy(H);
  rig.rightHand.rotation.set(tilt, 0, 0);
  body.add(rig.rightHand);
  rig.leftHand.position.copy(H);
  rig.leftHand.rotation.set(tilt, 0, 0);
  body.add(rig.leftHand);
  // Au rechargement, la main gauche garde sa prise et descend avec le chargeur.
  rig.magGrip.set(0, 0.004, 0);
  rig.handleAt = new THREE.Vector3(-0.012, -0.03, 0.09);
  return rig;
}

// ---------------------------------------------------------------------------
// Fusil d'assaut : boitier en deux parties, garde-main flottant, chargeur
// courbe, point rouge sur embase, crosse reglable
// ---------------------------------------------------------------------------

function fusil(s: Shop): GunRig {
  const { kit, body, f } = s;
  const tilt = -0.3;
  const rig = rigBase(s, "appui", tilt);
  const H = gripOrigin(-0.05, 0.13, tilt);
  const furn = kit.sable;

  // --- Boitier superieur : rail sur toute la longueur ---
  put(
    s,
    body,
    side([[-0.205, -0.004], [0.165, -0.004], [0.165, 0.05, 0.004], [0.157, 0.058], [-0.205, 0.058]], 0.062, { bevel: 0.004, seg: 2 }),
    kit.metal,
  );
  rail(s, body, -0.2, 0.16, 0.058, 0.034);
  // Deflecteur de douilles derriere la fenetre, et la fenetre elle-meme.
  put(s, body, side([[0.036, 0.01], [0.066, 0.012], [0.062, 0.046, 0.006], [0.036, 0.046, 0.004]], 0.07, { bevel: 0.004 }), kit.metal);
  put(s, body, block(0.0634, 0.034, 0.088, 0.002), kit.bore, 0, 0.026, -0.008);
  // --- Boitier inferieur : puits de chargeur, goupilles, commandes ---
  put(
    s,
    body,
    side(
      [
        [-0.165, -0.002],
        [0.172, -0.002],
        [0.176, -0.034, 0.01],
        [0.156, -0.052, 0.008],
        [0.0, -0.052],
        [-0.03, -0.068, 0.004],
        [-0.142, -0.068, 0.004],
        [-0.165, -0.032, 0.01],
      ],
      0.058,
      { bevel: 0.0035, seg: 2 },
    ),
    kit.metal,
  );
  // Evasement du puits de chargeur.
  put(s, body, side([[-0.146, -0.056], [-0.026, -0.056], [-0.024, -0.072, 0.003], [-0.148, -0.072, 0.003]], 0.064, { bevel: 0.003 }), kit.metal);
  for (const sx of [-1, 1]) {
    screw(s, body, sx * 0.0292, -0.02, -0.15, 0.0045);
    screw(s, body, sx * 0.0292, -0.018, 0.158, 0.0045);
  }
  // Selecteur (gauche), arretoir de chargeur (droite), arretoir de culasse.
  put(s, body, side([[-0.004, -0.004], [0.028, -0.002], [0.03, 0.006, 0.003], [-0.004, 0.006, 0.003]], 0.005, { bevel: 0.0015 }), kit.dark, -0.031, -0.028, 0.1);
  put(s, body, rod(0.0045, 0, 0.004, 10), kit.steel, -0.03, -0.024, 0.1, 0, -Math.PI / 2, 0);
  put(s, body, rod(0.007, 0, 0.004, 12), kit.dark, 0.029, -0.032, -0.012, 0, Math.PI / 2, 0);
  put(s, body, block(0.004, 0.02, 0.026, 0.0015), kit.dark, -0.0305, -0.03, -0.008);

  // --- Culasse : on la voit par la fenetre, le levier depasse a droite ---
  const carrier = f.group(body);
  rig.slide = carrier;
  put(s, carrier, block(0.004, 0.024, 0.074, 0.001), kit.steel, 0.0302, 0.026, -0.012);
  put(s, carrier, block(0.0032, 0.004, 0.06, 0.0008), kit.dark, 0.0318, 0.026, -0.014);
  put(s, carrier, rod(0.0048, 0, 0.026, 10), kit.steel, 0.03, 0.03, 0.03, 0, Math.PI / 2, 0);
  put(s, carrier, lathe([[0.0001, 0], [0.008, 0.001, 0.002], [0.009, 0.01, 0.003], [0.0001, 0.012]], 12), kit.dark, 0.052, 0.03, 0.03, 0, Math.PI / 2, 0);
  rig.handleAt = new THREE.Vector3(0.062, 0.03, 0.03);
  rig.ejectAt.set(0.045, 0.028, -0.01);

  // --- Garde-main flottant, rail du dessus, canon, frein de bouche ---
  octoHandguard(s, body, furn, 0.02, -0.47, -0.205);
  rail(s, body, -0.465, -0.21, 0.057, 0.03);
  put(s, body, tube(0.0205, 0.028, -0.21, -0.198, 20, 0.002), kit.metal, 0, 0.014, 0);
  put(s, body, rod(0.0108, -0.63, -0.46, 16, 0.001), kit.blued, 0, 0.014, 0);
  muzzleBrake(s, body, 0.014, -0.688, 0.062, 0.0175);
  // Organes de visee de secours, rabattus sur le rail.
  put(s, body, side([[-0.018, 0], [0.012, 0], [0.008, 0.012, 0.003], [-0.012, 0.012, 0.003]], 0.024, { bevel: 0.002 }), kit.dark, 0, 0.068, -0.44);
  put(s, body, side([[-0.014, 0], [0.018, 0], [0.014, 0.011, 0.003], [-0.01, 0.011, 0.003]], 0.028, { bevel: 0.002 }), kit.dark, 0, 0.069, 0.136);

  // --- Point rouge ---
  redDotTube(s, body, 0.128, 0.018, 0.09, 0.069);

  // --- Poignee, detente, pontet ---
  const grip = f.group(body, H.x, H.y, H.z);
  grip.rotation.x = tilt;
  rifleGrip(s, grip, furn);
  triggerUnder(s, body, H, tilt, -0.05, { width: 0.022, mat: kit.metal });

  // --- Chargeur courbe ---
  const mag = f.group(body);
  rig.mag = mag;
  curvedMag(s, mag, kit.dark, -0.04, -0.045, 0.086, 0.46, 0.5, 0.054);

  // --- Tube de crosse et crosse reglable ---
  put(s, body, rod(0.018, 0.165, 0.41, 18, 0.002), kit.metal, 0, 0.012, 0);
  put(s, body, tube(0.0175, 0.023, 0.168, 0.182, 18, 0.002), kit.metal, 0, 0.012, 0);
  put(
    s,
    body,
    side(
      [
        [0.262, 0.04, 0.008],
        [0.448, 0.05, 0.008],
        [0.452, -0.078, 0.01],
        [0.425, -0.088, 0.012],
        [0.36, -0.052, 0.02],
        [0.3, -0.026, 0.012],
        [0.262, -0.022, 0.008],
      ],
      0.056,
      { bevel: 0.006, seg: 2, holes: [[[0.33, 0.012], [0.4, 0.016, 0.006], [0.404, -0.036, 0.008], [0.37, -0.032, 0.008], [0.33, -0.012, 0.006]]] },
    ),
    furn,
  );
  // Appui-joue et plaque de couche caoutchouc.
  put(s, body, side([[0.29, 0.038], [0.43, 0.046], [0.43, 0.06, 0.006], [0.3, 0.054, 0.008]], 0.05, { bevel: 0.005 }), furn);
  put(s, body, side([[0.446, 0.054], [0.466, 0.054, 0.004], [0.47, -0.08, 0.006], [0.45, -0.092, 0.004], [0.44, -0.084]], 0.06, { bevel: 0.004 }), kit.rubber);
  put(s, body, block(0.008, 0.016, 0.03, 0.002), kit.dark, 0, -0.026, 0.28);

  rig.muzzleZ = -0.688;
  rig.muzzleY = 0.014;
  rig.sightY = 0.128;
  rig.rackHand = true;
  rig.rightHand.position.copy(H);
  rig.rightHand.rotation.set(tilt, 0, 0);
  body.add(rig.rightHand);
  rig.leftHand.position.set(0, 0.02, -0.36);
  rig.leftHand.rotation.set(0, 0, 0);
  body.add(rig.leftHand);
  rig.magGrip.set(0, -0.02, 0);
  return rig;
}

// ---------------------------------------------------------------------------
// Fusil de precision : culasse a verrou sur chassis, canon lourd cannele,
// grand frein de bouche, lunette a tourelles, crosse squelette, bipied replie
// ---------------------------------------------------------------------------

function sniper(s: Shop): GunRig {
  const { kit, body, f } = s;
  const tilt = -0.25;
  const rig = rigBase(s, "appui", tilt);
  const H = gripOrigin(-0.05, 0.2, tilt);
  const furn = kit.olive;
  const ay = 0.02;

  // --- Boitier rond, rail, fenetre d'ejection ---
  put(s, body, lathe([[0.02, -0.15], [0.026, -0.148, 0.002], [0.026, 0.128, 0.004], [0.02, 0.13]], 22), kit.blued, 0, ay, 0);
  put(s, body, block(0.03, 0.012, 0.25, 0.002), kit.blued, 0, ay + 0.024, -0.01);
  rail(s, body, -0.14, 0.12, ay + 0.03, 0.03);
  put(s, body, block(0.018, 0.022, 0.07, 0.002), kit.bore, 0.018, ay + 0.004, -0.03);
  screw(s, body, 0.02, ay - 0.018, -0.12, 0.004);
  screw(s, body, 0.02, ay - 0.018, 0.1, 0.004);

  // --- Canon lourd cannele et frein de bouche ---
  put(s, body, lathe([[0.0001, -0.86], [0.0145, -0.86], [0.0145, -0.5, 0.01], [0.02, -0.2, 0.02], [0.021, -0.15], [0.0001, -0.15]], 20), kit.blued, 0, 0.014, 0);
  for (const a of [0.55, -0.55, Math.PI - 0.55]) {
    const x = Math.sin(a) * 0.0165;
    const yy = 0.014 + Math.cos(a) * 0.0165;
    put(s, body, block(0.0045, 0.0045, 0.3, 0.001), kit.bore, x, yy, -0.52, 0, 0, -a);
  }
  muzzleBrake(s, body, 0.014, -0.95, 0.092, 0.024);

  // --- Chassis : fut octogonal, logement du chargeur ---
  octoHandguard(s, body, furn, 0.008, -0.47, -0.13, 0.034, 0.034);
  put(
    s,
    body,
    side(
      [
        [-0.14, 0.0],
        [0.2, 0.0],
        [0.22, 0.02, 0.006],
        [0.24, 0.02],
        [0.24, -0.045, 0.008],
        [0.12, -0.05],
        [-0.012, -0.05],
        [-0.02, -0.064, 0.004],
        [-0.108, -0.064, 0.004],
        [-0.14, -0.03, 0.008],
      ],
      0.058,
      { bevel: 0.004, seg: 2 },
    ),
    furn,
  );
  // Bipied replie sous le fut.
  put(s, body, block(0.04, 0.016, 0.03, 0.004), kit.dark, 0, -0.034, -0.44);
  for (const sx of [-0.012, 0.012]) {
    put(s, body, rod(0.0055, -0.43, -0.2, 10, 0.002), kit.dark, sx, -0.034, 0);
    put(s, body, sphere(0.0075, 10, 8), kit.rubber, sx, -0.034, -0.2);
  }

  // --- Verrou : leve, tire, repousse, rabattu ---
  const bolt = f.group(body, 0, ay, 0.1);
  rig.bolt = bolt;
  put(s, bolt, rod(0.017, 0.02, 0.07, 18, 0.003), kit.steel, 0, 0, 0);
  put(s, bolt, lathe([[0.0001, 0.07], [0.017, 0.07], [0.018, 0.08, 0.003], [0.012, 0.086, 0.003], [0.0001, 0.086]], 18), kit.blued, 0, 0, 0);
  put(s, bolt, rod(0.0048, 0, 0.05, 10), kit.steel, 0.012, 0, 0.056, 0, Math.PI / 2 - 0.25, 0);
  put(
    s,
    bolt,
    lathe([[0.0001, -0.012], [0.009, -0.011, 0.003], [0.012, 0.0, 0.004], [0.011, 0.012, 0.003], [0.0001, 0.014]], 14),
    kit.dark,
    0.062,
    0,
    0.06,
    0,
    Math.PI / 2,
    0,
  );

  // --- Lunette ---
  scope(s, body, 0.14, -0.3, 0.14, ay + 0.041);

  // --- Poignee, detente, pontet ---
  const grip = f.group(body, H.x, H.y, H.z);
  grip.rotation.x = tilt;
  rifleGrip(s, grip, furn);
  triggerUnder(s, body, H, tilt, -0.048, { width: 0.022, mat: kit.dark });

  // --- Chargeur droit ---
  const mag = f.group(body);
  rig.mag = mag;
  put(s, mag, side([[-0.104, -0.02], [-0.024, -0.02], [-0.03, -0.132, 0.004], [-0.108, -0.132, 0.004]], 0.05, { bevel: 0.003 }), kit.metal);
  put(s, mag, side([[-0.112, -0.128], [-0.022, -0.128], [-0.026, -0.146, 0.004], [-0.112, -0.144, 0.004]], 0.056, { bevel: 0.003 }), kit.dark);
  put(s, mag, rod(0.0068, -0.098, -0.03, 10), kit.brass, 0, -0.022, 0);

  // --- Crosse squelette ---
  put(
    s,
    body,
    side(
      [
        [0.2, 0.042],
        [0.5, 0.056, 0.006],
        [0.516, 0.05, 0.004],
        [0.52, -0.1, 0.008],
        [0.48, -0.106, 0.01],
        [0.3, -0.05, 0.02],
        [0.2, -0.042, 0.008],
      ],
      0.054,
      { bevel: 0.006, seg: 2, holes: [[[0.28, 0.016], [0.46, 0.028, 0.01], [0.47, -0.07, 0.012], [0.33, -0.03, 0.012]]] },
    ),
    furn,
  );
  // Busc reglable sur ses deux tiges, plaque de couche.
  put(s, body, side([[0.3, 0.058], [0.45, 0.064], [0.45, 0.08, 0.008], [0.31, 0.076, 0.01]], 0.046, { bevel: 0.006 }), kit.dark);
  for (const zz of [0.33, 0.42]) put(s, body, rod(0.0042, -0.004, 0.004, 8), kit.steel, 0, 0.054 + (zz - 0.3) * 0.047, zz, -Math.PI / 2, 0, 0);
  put(s, body, side([[0.514, 0.058], [0.534, 0.058, 0.004], [0.538, -0.104, 0.006], [0.516, -0.112, 0.004]], 0.058, { bevel: 0.004 }), kit.rubber);

  rig.muzzleZ = -0.95;
  rig.muzzleY = 0.014;
  rig.sightY = 0.14;
  rig.casing = "long";
  rig.ejectAt.set(0.04, 0.03, -0.03);
  rig.rightHand.position.copy(H);
  rig.rightHand.rotation.set(tilt, 0, 0);
  body.add(rig.rightHand);
  rig.leftHand.position.set(0, 0.008, -0.3);
  body.add(rig.leftHand);
  rig.magGrip.set(0, -0.01, 0);
  return rig;
}

// ---------------------------------------------------------------------------
// Fusil a pompe : boitier noir, canon a bande ventilee, tube magasin, pompe
// en noyer striee, crosse en noyer, cartouches de rechange sur le flanc
// ---------------------------------------------------------------------------

function pompe(s: Shop): GunRig {
  const { kit, body, f } = s;
  const tilt = -0.3;
  const rig = rigBase(s, "appui", tilt);
  const H = gripOrigin(-0.036, 0.2, tilt);
  const by = 0.03;
  const my = -0.014;

  // --- Boitier : dessus arrondi, fenetres d'ejection et de chargement ---
  put(
    s,
    body,
    side(
      [
        [-0.1, -0.042],
        [0.162, -0.042],
        [0.168, -0.012, 0.012],
        [0.15, 0.05, 0.03],
        [0.118, 0.062, 0.012],
        [-0.1, 0.062, 0.006],
      ],
      0.06,
      { bevel: 0.006, seg: 3 },
    ),
    kit.metal,
  );
  put(s, body, block(0.0612, 0.036, 0.1, 0.004), kit.bore, 0, 0.022, -0.02);
  put(s, body, block(0.034, 0.008, 0.11, 0.003), kit.bore, 0, -0.04, -0.03);
  screw(s, body, 0.03, -0.02, 0.1, 0.0045);
  screw(s, body, -0.03, -0.02, 0.1, 0.0045);
  screw(s, body, 0.03, -0.02, 0.135, 0.0045);
  // Surete : bouton en travers, derriere la detente.
  put(s, body, rod(0.005, -0.034, 0.034, 12), kit.dark, 0, -0.034, 0.145, 0, Math.PI / 2, 0);

  // --- Canon, bande ventilee et guidons ---
  put(s, body, rod(0.0195, -0.72, -0.1, 20, 0.001), kit.blued, 0, by, 0);
  put(s, body, rod(0.0118, -0.7215, -0.7, 16), kit.bore, 0, by, 0);
  put(s, body, block(0.012, 0.004, 0.62, 0.001), kit.dark, 0, by + 0.026, -0.41);
  for (let i = 0; i < 12; i++) put(s, body, block(0.006, 0.008, 0.012, 0.001), kit.dark, 0, by + 0.021, -0.69 + i * 0.05);
  optic(put(s, body, sphere(0.0048, 12, 10), kit.brass, 0, by + 0.031, -0.705));
  optic(put(s, body, sphere(0.0032, 10, 8), kit.steel, 0, by + 0.03, -0.42));

  // --- Tube magasin, bouchon, collier ---
  put(s, body, rod(0.0165, -0.64, -0.1, 18, 0.001), kit.blued, 0, my, 0);
  put(s, body, lathe([[0.0001, -0.668], [0.015, -0.668, 0.003], [0.018, -0.66], [0.018, -0.636, 0.002], [0.0001, -0.636]], 18), kit.dark, 0, my, 0);
  put(s, body, side([[-0.62, my - 0.02], [-0.59, my - 0.02], [-0.59, by + 0.02, 0.006], [-0.62, by + 0.02, 0.006]], 0.046, { bevel: 0.004 }), kit.dark);

  // --- Pompe : elle coulisse avec ses barres d'action et la culasse ---
  const pump = f.group(body, 0, my, -0.3);
  rig.pump = pump;
  const hw = 0.032;
  const forend: Pt[] = [
    [-hw + 0.01, -0.03],
    [hw - 0.01, -0.03],
    [hw, -0.012, 0.01],
    [hw - 0.002, 0.018, 0.012],
    [hw - 0.012, 0.03, 0.006],
    [-hw + 0.012, 0.03, 0.006],
    [-hw + 0.002, 0.018, 0.012],
    [-hw, -0.012, 0.01],
  ];
  put(s, pump, front(forend, 0.19, { bevel: 0.006, seg: 3, holes: [[[-0.017, -0.017], [0.017, -0.017], [0.017, 0.017], [-0.017, 0.017]]] }), kit.wood);
  for (let i = 0; i < 7; i++) put(s, pump, front(forend, 0.004, { bevel: 0.0005 }), kit.dark, 0, 0, -0.066 + i * 0.022).scale.set(1.012, 1.02, 1);
  for (const sx of [-1, 1]) put(s, pump, rod(0.004, 0.095, 0.26, 8), kit.steel, sx * 0.02, 0.004, 0);
  put(s, pump, block(0.003, 0.028, 0.07, 0.001), kit.steel, 0.0295, by - my - 0.008, 0.28);
  rig.dipPort.set(0, -0.03 - my, 0.0 - pump.position.z);
  rig.ejectAt.set(0.045, 0.024, -0.02);

  // --- Poignee, detente, pontet ---
  const grip = f.group(body, H.x, H.y, H.z);
  grip.rotation.x = tilt;
  rifleGrip(s, grip, kit.wood, 0.056);
  triggerUnder(s, body, H, tilt, -0.042, { width: 0.022, mat: kit.dark });

  // --- Crosse en noyer, plaque de couche, cartouches de rechange ---
  put(
    s,
    body,
    side(
      [
        [0.158, 0.056, 0.006],
        [0.52, 0.034, 0.006],
        [0.53, 0.028],
        [0.534, -0.122],
        [0.5, -0.13, 0.01],
        [0.36, -0.074, 0.04],
        [0.27, -0.044, 0.02],
        [0.2, -0.038, 0.01],
        [0.158, -0.036, 0.006],
      ],
      0.058,
      { bevel: 0.008, seg: 3 },
    ),
    kit.wood,
  );
  put(s, body, side([[0.528, 0.036], [0.552, 0.036, 0.006], [0.558, -0.128, 0.008], [0.53, -0.132, 0.004]], 0.062, { bevel: 0.005 }), kit.rubber);
  put(s, body, side([[0.29, 0.03], [0.44, 0.022], [0.44, -0.058], [0.29, -0.04]], 0.066, { bevel: 0.004 }), kit.dark);
  for (let i = 0; i < 4; i++) shotShell(s, body, 0.0345, -0.014, 0.322 + i * 0.025, 0.058, 0.0105, 0, Math.PI / 2);

  // --- Cartouche que la main gauche apporte ---
  const carry = shotShell(s, rig.leftHand, 0, -0.034, 0, 0.058, 0.0115);
  rig.carry = carry;

  rig.muzzleZ = -0.72;
  rig.muzzleY = by;
  rig.sightY = by + 0.036;
  rig.reloadStyle = "cartouches";
  rig.casing = "coque";
  rig.rightHand.position.copy(H);
  rig.rightHand.rotation.set(tilt, 0, 0);
  body.add(rig.rightHand);
  // La main gauche est fille de la pompe : elle coulisse avec elle.
  rig.leftHand.position.set(0, 0, 0);
  pump.add(rig.leftHand);
  return rig;
}

// ---------------------------------------------------------------------------
// Mitraillette : boitier en tole emboutie, tube d'armement au-dessus du
// canon, dioptre et guidon sous capuchon, chargeur legerement courbe,
// crosse a coulisse
// ---------------------------------------------------------------------------

function mitraillette(s: Shop): GunRig {
  const { kit, body, f } = s;
  const tilt = -0.25;
  const rig = rigBase(s, "appui", tilt);
  const H = gripOrigin(-0.05, 0.12, tilt);
  const by = 0.008;
  const ty = 0.03;
  const sightY = 0.066;

  // --- Boitier en tole : dessus arrondi, nervure laterale emboutie ---
  put(
    s,
    body,
    side([[-0.19, -0.018], [0.17, -0.018], [0.173, 0.028, 0.012], [0.16, 0.044, 0.008], [-0.19, 0.044, 0.004]], 0.052, { bevel: 0.008, seg: 3 }),
    kit.metal,
  );
  put(s, body, side([[-0.17, -0.004], [0.15, -0.004], [0.15, 0.016, 0.004], [-0.17, 0.016, 0.004]], 0.0556, { bevel: 0.0022, seg: 1 }), kit.metal);
  // Fenetre d'ejection et culasse.
  put(s, body, block(0.0562, 0.022, 0.056, 0.002), kit.bore, 0, 0.024, -0.032);
  put(s, body, block(0.0035, 0.014, 0.046, 0.001), kit.steel, 0.0268, 0.024, -0.032);
  // Puits de chargeur.
  put(s, body, side([[-0.13, -0.016], [-0.035, -0.016], [-0.038, -0.064, 0.004], [-0.128, -0.064, 0.004]], 0.05, { bevel: 0.003 }), kit.metal);
  // Carcasse polymere de la detente.
  put(
    s,
    body,
    side([[-0.03, -0.014], [0.172, -0.014], [0.176, -0.036, 0.008], [0.145, -0.052, 0.008], [-0.03, -0.052, 0.004]], 0.05, { bevel: 0.004, seg: 2 }),
    kit.polymer,
  );
  for (const sx of [-1, 1]) {
    screw(s, body, sx * 0.0255, -0.03, 0.0, 0.004);
    screw(s, body, sx * 0.0255, -0.03, 0.15, 0.004);
  }
  put(s, body, side([[-0.004, -0.003], [0.024, -0.001], [0.026, 0.006, 0.003], [-0.004, 0.006, 0.003]], 0.005, { bevel: 0.0015 }), kit.dark, -0.026, -0.03, 0.09);

  // --- Tube d'armement, garde-main, canon, cache-flamme ---
  put(s, body, rod(0.0145, -0.37, -0.18, 18, 0.002), kit.metal, 0, ty, 0);
  put(s, body, block(0.004, 0.005, 0.14, 0.001), kit.bore, -0.0138, ty, -0.27);
  const hg: Pt[] = [
    [-0.024, -0.042],
    [0.024, -0.042],
    [0.034, -0.03, 0.008],
    [0.034, 0.012, 0.01],
    [0.018, 0.026, 0.006],
    [-0.018, 0.026, 0.006],
    [-0.034, 0.012, 0.01],
    [-0.034, -0.03, 0.008],
  ];
  put(s, body, front(hg, 0.17, { bevel: 0.004, seg: 2 }), kit.polymer, 0, -0.004, -0.285);
  for (let i = 0; i < 5; i++) put(s, body, block(0.0694, 0.006, 0.012, 0.002), kit.dark, 0, -0.012, -0.345 + i * 0.03);
  put(s, body, rod(0.0092, -0.41, -0.36, 14), kit.blued, 0, by, 0);
  put(
    s,
    body,
    lathe([[0.006, -0.448], [0.0125, -0.448], [0.0125, -0.414, 0.002], [0.0095, -0.408], [0.006, -0.408]], 16),
    kit.blued,
    0,
    by,
    0,
  );
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    put(s, body, block(0.004, 0.004, 0.018, 0.001), kit.dark, Math.sin(a) * 0.0125, by + Math.cos(a) * 0.0125, -0.426, 0, 0, -a);
  }
  // Organes de visee.
  hoodedPost(s, body, sightY, -0.352, ty + 0.012);
  apertureSight(s, body, sightY, 0.13, 0.043);

  // --- Levier d'armement, a gauche du tube : il claque a chaque coup ---
  const handle = f.group(body);
  rig.slide = handle;
  put(s, handle, rod(0.0042, 0, 0.022, 10), kit.steel, -0.014, ty, -0.305, 0, -Math.PI / 2, 0);
  put(s, handle, lathe([[0.0001, 0], [0.0075, 0.001, 0.002], [0.0085, 0.012, 0.003], [0.0001, 0.014]], 12), kit.dark, -0.034, ty, -0.305, 0, -Math.PI / 2, 0);
  rig.handleAt = new THREE.Vector3(-0.04, ty, -0.305);
  rig.ejectAt.set(0.034, 0.024, -0.032);

  // --- Poignee, detente, chargeur ---
  const grip = f.group(body, H.x, H.y, H.z);
  grip.rotation.x = tilt;
  rifleGrip(s, grip, kit.polymer, 0.052);
  triggerUnder(s, body, H, tilt, -0.05, { width: 0.02, mat: kit.polymer });
  const mag = f.group(body);
  rig.mag = mag;
  curvedMag(s, mag, kit.metal, -0.04, -0.03, 0.08, 1.15, 0.2, 0.04);

  // --- Crosse a coulisse : deux tiges et une plaque ---
  for (const sx of [-1, 1]) put(s, body, rod(0.0062, 0.16, 0.37, 10, 0.001), kit.steel, sx * 0.02, 0.012, 0);
  put(s, body, block(0.056, 0.018, 0.02, 0.004), kit.dark, 0, 0.012, 0.175);
  put(
    s,
    body,
    side([[0.35, 0.046], [0.378, 0.05, 0.006], [0.384, -0.066, 0.008], [0.36, -0.07, 0.006], [0.35, -0.02, 0.01]], 0.07, { bevel: 0.006, seg: 2 }),
    kit.polymer,
  );
  put(s, body, side([[0.378, 0.05], [0.392, 0.05, 0.004], [0.396, -0.068, 0.004], [0.382, -0.07]], 0.074, { bevel: 0.003 }), kit.rubber);

  rig.muzzleZ = -0.448;
  rig.muzzleY = by;
  rig.sightY = sightY;
  rig.rackHand = true;
  rig.rightHand.position.copy(H);
  rig.rightHand.rotation.set(tilt, 0, 0);
  body.add(rig.rightHand);
  rig.leftHand.position.set(0, -0.004, -0.29);
  body.add(rig.leftHand);
  rig.magGrip.set(0, -0.02, 0);
  return rig;
}

// ---------------------------------------------------------------------------
// Distribution
// ---------------------------------------------------------------------------

const BUILDERS: Partial<Record<WeaponId, (s: Shop) => GunRig>> = {
  pistolet,
  fusil,
  sniper,
  pompe,
  mitraillette,
  ...ARSENAL_2,
};

/** Vrai si l'arme a son modele realiste dans cet arsenal. */
export function hasGunModel(id: WeaponId): boolean {
  return BUILDERS[id] !== undefined;
}

/**
 * Construit l'arme `id` dans `body` (le sous-groupe anime de WeaponModel) et
 * rend ses pieces mobiles et ses reperes.
 */
export function buildGunRig(id: WeaponId, body: THREE.Group, look: WeaponLook, keep: Disposer): GunRig {
  const builder = BUILDERS[id];
  if (!builder) throw new Error(`Arme sans modele : ${id}`);
  return builder(createShop(body, look, keep));
}
