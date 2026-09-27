import * as THREE from "three";
import type { WeaponId } from "./duelWeapons";
import { block, capsuleBetween, indexTipLocal, lathe, optic, rod, side, sphere, top as plan, tube, type Pt } from "./duelWeaponModels";
import {
  apertureSight,
  curvedMag,
  flashHider,
  foreGrip,
  fromHand,
  gripFrontZ,
  gripOrigin,
  holoSight,
  hoodedPost,
  octoHandguard,
  put,
  rail,
  redDotTube,
  reflexSight,
  rifleGrip,
  rigBase,
  screw,
  shotShell,
  smoothGrip,
  triggerBlade,
  triggerGuard,
  triggerUnder,
  type GunRig,
  type Parent,
  type Shop,
} from "./duelWeaponModelsParts";

/**
 * L'arsenal du Duel, fin : mitrailleuse, fusil a rafale (bullpup), fusil a
 * deux canons juxtaposes, arbalete a poulies et lance-roquettes.
 *
 * Meme methode que les deux autres parties : profils de cote extrudes et
 * biseautes, pieces tournees, mains gantees sur de vraies poignees. Des armes
 * generiques dans le style des armes reelles, sans copier aucun modele
 * existant. Repere : x a droite, y en haut, bouche vers -z.
 */

/** Une cartouche de fusil couchee le long de z : douille en laiton, balle cuivree. */
function rifleRound(s: Shop, parent: Parent, x: number, y: number, zBase: number, len = 0.07, r = 0.0056) {
  const zb = zBase;
  const zs = zb - len * 0.68;
  put(s, parent, lathe([[0.0001, zs], [r * 0.72, zs], [r, zs + len * 0.1, 0.002], [r, zb - 0.003], [r * 1.05, zb - 0.002], [r * 1.05, zb], [0.0001, zb]], 10), s.kit.brass, x, y, 0);
  put(s, parent, lathe([[0.0001, zb - len], [r * 0.3, zb - len + 0.004, 0.002], [r * 0.7, zs - 0.006, 0.006], [r * 0.72, zs + 0.002], [0.0001, zs + 0.002]], 10), s.kit.copper, x, y, 0);
}

// ---------------------------------------------------------------------------
// Mitrailleuse : boitier en tole emboutie, couvercle d'alimentation, canon
// lourd, bipied replie, boite a munitions et sa bande de cartouches
// ---------------------------------------------------------------------------

function mitrailleuse(s: Shop): GunRig {
  const { kit, body, f } = s;
  const tilt = -0.3;
  const rig = rigBase(s, "appui", tilt);
  const H = gripOrigin(-0.052, 0.16, tilt);
  const by = 0.012;
  const hy = 0.002;
  const sightY = 0.112;

  // --- Boitier : tole emboutie, nervure laterale ---
  put(
    s,
    body,
    side([[-0.215, -0.052], [0.195, -0.052], [0.2, -0.03, 0.008], [0.2, 0.046, 0.006], [-0.215, 0.046, 0.006]], 0.068, { bevel: 0.004, seg: 2 }),
    kit.metal,
  );
  put(s, body, side([[-0.19, -0.014], [0.17, -0.014], [0.17, 0.004, 0.004], [-0.19, 0.004, 0.004]], 0.0716, { bevel: 0.002, seg: 1 }), kit.metal);
  for (const sx of [-1, 1]) {
    for (const zz of [-0.19, -0.1, 0.17]) screw(s, body, sx * 0.0342, -0.032, zz, 0.0042);
  }
  // --- Couvercle d'alimentation : charniere a l'avant, loquet a l'arriere ---
  put(
    s,
    body,
    side([[-0.175, 0.044], [0.105, 0.044], [0.105, 0.068, 0.006], [0.07, 0.076, 0.01], [-0.13, 0.076, 0.01], [-0.175, 0.058, 0.012]], 0.07, { bevel: 0.004, seg: 2 }),
    kit.metal,
  );
  put(s, body, block(0.03, 0.012, 0.018, 0.002), kit.dark, 0, 0.056, 0.114);
  put(s, body, rod(0.006, -0.037, 0.037, 12), kit.steel, 0, 0.05, -0.17, 0, Math.PI / 2, 0);
  // Fenetre d'alimentation (la bande entre a gauche), fente du levier (a droite).
  put(s, body, block(0.0012, 0.018, 0.074, 0), kit.bore, -0.0344, 0.028, -0.06);
  put(s, body, block(0.0012, 0.008, 0.11, 0), kit.bore, 0.0344, by, -0.085);
  // Fenetre d'ejection, dessous a droite.
  put(s, body, block(0.0012, 0.026, 0.08, 0), kit.bore, 0.0344, -0.032, 0.02);
  // Hausse a oeilleton sur l'arriere du boitier.
  apertureSight(s, body, sightY, 0.15, 0.046);

  // --- Canon lourd, bloc d'emprunt, guidon sous capuchon, cache-flamme ---
  put(s, body, lathe([[0.0001, -0.86], [0.0125, -0.86], [0.0125, -0.7], [0.0165, -0.64, 0.01], [0.0165, -0.215], [0.0001, -0.215]], 20), kit.blued, 0, by, 0);
  flashHider(s, body, by, -0.905, 0.05, 0.016);
  put(s, body, rod(0.0068, -0.66, -0.215, 12), kit.metal, 0, by - 0.027, 0);
  put(
    s,
    body,
    side([[-0.682, by - 0.036], [-0.642, by - 0.036], [-0.646, by + 0.026, 0.004], [-0.676, by + 0.026, 0.004]], 0.034, { bevel: 0.004, seg: 2 }),
    kit.metal,
  );
  screw(s, body, 0.0172, by - 0.02, -0.662, 0.004);
  hoodedPost(s, body, sightY, -0.662, by + 0.024);

  // --- Garde-main a lumieres ---
  octoHandguard(s, body, kit.polymer, hy, -0.5, -0.215, 0.04, 0.043);

  // --- Bipied replie sous le canon ---
  put(s, body, tube(0.0165, 0.025, -0.55, -0.515, 18, 0.002), kit.dark, 0, by, 0);
  put(s, body, block(0.044, 0.02, 0.03, 0.004), kit.dark, 0, by - 0.03, -0.532);
  for (const sx of [-1, 1]) {
    put(s, body, rod(0.0055, -0.8, -0.535, 10, 0.002), kit.dark, sx * 0.013, by - 0.036, 0);
    put(s, body, tube(0.0055, 0.0075, -0.7, -0.68, 10, 0.001), kit.steel, sx * 0.013, by - 0.036, 0);
    put(s, body, lathe([[0.0001, -0.83], [0.009, -0.826, 0.003], [0.009, -0.802, 0.002], [0.0001, -0.8]], 10), kit.rubber, sx * 0.013, by - 0.036, 0);
  }

  // --- Culasse (par la fenetre) et levier d'armement a droite ---
  const carrier = f.group(body);
  rig.slide = carrier;
  put(s, carrier, block(0.0014, 0.016, 0.064, 0), kit.steel, 0.0352, -0.032, 0.02);
  put(s, carrier, rod(0.005, 0, 0.026, 10), kit.steel, 0.034, by, -0.12, 0, Math.PI / 2, 0);
  put(s, carrier, lathe([[0.0001, 0], [0.008, 0.001, 0.002], [0.009, 0.012, 0.003], [0.0001, 0.014]], 12), kit.dark, 0.058, by, -0.12, 0, Math.PI / 2, 0);
  rig.handleAt = new THREE.Vector3(0.068, by, -0.12);
  rig.ejectAt.set(0.045, -0.032, 0.02);

  // --- Poignee, detente, pontet ---
  const grip = f.group(body, H.x, H.y, H.z);
  grip.rotation.x = tilt;
  rifleGrip(s, grip, kit.polymer);
  triggerUnder(s, body, H, tilt, -0.052, { width: 0.022, mat: kit.metal });

  // --- Crosse fixe a trou de pouce, plaque de couche ---
  put(
    s,
    body,
    side(
      [
        [0.195, 0.036],
        [0.52, 0.044, 0.01],
        [0.545, 0.036, 0.006],
        [0.55, -0.1, 0.01],
        [0.52, -0.112, 0.012],
        [0.34, -0.066, 0.03],
        [0.24, -0.05, 0.012],
        [0.195, -0.048],
      ],
      0.058,
      { bevel: 0.007, seg: 2, holes: [[[0.26, 0.016], [0.48, 0.024, 0.008], [0.49, -0.066, 0.012], [0.4, -0.042, 0.01], [0.28, -0.024, 0.008]]] },
    ),
    kit.polymer,
  );
  put(s, body, side([[0.543, 0.046], [0.566, 0.046, 0.004], [0.57, -0.108, 0.006], [0.548, -0.116, 0.004]], 0.064, { bevel: 0.004 }), kit.rubber);

  // --- Boite a munitions (elle tombe au rechargement) et sa bande ---
  const mag = f.group(body);
  rig.mag = mag;
  const bx = -0.022;
  put(
    s,
    mag,
    side([[-0.168, -0.05], [-0.004, -0.05], [0.0, -0.06, 0.006], [0.0, -0.2, 0.012], [-0.172, -0.2, 0.012], [-0.172, -0.06, 0.006]], 0.094, { bevel: 0.006, seg: 2 }),
    kit.olive,
    bx,
    0,
    0,
  );
  put(s, mag, side([[-0.175, -0.062], [0.003, -0.062], [0.003, -0.074], [-0.175, -0.074]], 0.098, { bevel: 0.002, seg: 1 }), kit.dark, bx, 0, 0);
  for (let i = 0; i < 3; i++) put(s, mag, block(0.1, 0.1, 0.008, 0.002), kit.olive, bx, -0.137, -0.14 + i * 0.05);
  put(s, mag, block(0.012, 0.024, 0.03, 0.003), kit.dark, bx - 0.052, -0.09, -0.086);
  // Bande : les cartouches pointent vers l'avant, la bande monte sur le flanc
  // gauche jusqu'a la fenetre d'alimentation. Maillons entre deux cartouches.
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const x = -0.056 + 0.012 * Math.sin((t * Math.PI) / 2);
    const y = -0.05 + 0.078 * t;
    rifleRound(s, mag, x, y, -0.03, 0.074, 0.0056);
    put(s, mag, block(0.009, 0.013, 0.012, 0.002), kit.dark, x, y - 0.0078, -0.045);
    put(s, mag, block(0.009, 0.013, 0.012, 0.002), kit.dark, x, y - 0.0078, -0.075);
  }

  rig.muzzleZ = -0.905;
  rig.muzzleY = by;
  rig.sightY = sightY;
  rig.casing = "long";
  rig.rackHand = true;
  rig.rightHand.position.copy(H);
  rig.rightHand.rotation.set(tilt, 0, 0);
  body.add(rig.rightHand);
  rig.leftHand.position.set(0, hy, -0.37);
  body.add(rig.leftHand);
  rig.magGrip.set(-0.03, -0.02, 0);
  return rig;
}

// ---------------------------------------------------------------------------
// Fusil a rafale : bullpup a coque polymere, chargeur derriere la poignee,
// garde-main integre, rail et viseur holographique, levier a gauche
// ---------------------------------------------------------------------------

function rafale(s: Shop): GunRig {
  const { kit, body, f } = s;
  const tilt = -0.25;
  const rig = rigBase(s, "appui", tilt);
  const H = gripOrigin(-0.048, 0.0, tilt);
  const by = 0.008;
  const railTop = 0.055;
  const sightY = 0.1;
  const shell = kit.polymer;

  // --- Coque d'un seul tenant : garde-main, arretoir de main, puits de
  // chargeur, crosse ---
  put(
    s,
    body,
    side(
      [
        [-0.27, 0.03, 0.01],
        [-0.27, -0.034, 0.012],
        [-0.252, -0.05, 0.008],
        [-0.238, -0.05],
        [-0.232, -0.068, 0.005],
        [-0.212, -0.068, 0.005],
        [-0.2, -0.048, 0.006],
        [0.05, -0.048],
        [0.07, -0.07, 0.01],
        [0.215, -0.07],
        [0.235, -0.112, 0.012],
        [0.29, -0.118, 0.008],
        [0.296, 0.036, 0.01],
        [0.27, 0.044, 0.006],
        [-0.24, 0.044, 0.006],
      ],
      0.066,
      { bevel: 0.005, seg: 2 },
    ),
    shell,
  );
  // Ouies du garde-main, appui-joue caoutchouc, vis de la coque.
  for (let i = 0; i < 3; i++) put(s, body, block(0.0676, 0.009, 0.026, 0.002), kit.bore, 0, -0.016, -0.255 + i * 0.036);
  put(s, body, side([[0.13, 0.008], [0.265, 0.01], [0.265, 0.034, 0.005], [0.13, 0.032, 0.005]], 0.0686, { bevel: 0.002 }), kit.rubber);
  for (const sx of [-1, 1]) {
    screw(s, body, sx * 0.0332, -0.02, 0.06, 0.004);
    screw(s, body, sx * 0.0332, -0.03, 0.2, 0.004);
  }
  rail(s, body, -0.24, 0.24, 0.044, 0.03);
  // Fente du levier (a gauche), fenetre d'ejection (a droite, derriere).
  put(s, body, block(0.0012, 0.009, 0.12, 0), kit.bore, -0.0336, 0.028, -0.1);
  put(s, body, block(0.0012, 0.022, 0.064, 0), kit.bore, 0.0336, 0.014, 0.14);
  // Bouton d'arretoir du chargeur, derriere le puits.
  put(s, body, block(0.07, 0.012, 0.014, 0.003), kit.dark, 0, -0.08, 0.228);

  // --- Canon, bloc d'emprunt, cache-flamme ---
  put(s, body, tube(0.0112, 0.02, -0.285, -0.268, 18, 0.002), kit.metal, 0, by, 0);
  put(s, body, rod(0.0112, -0.475, -0.27, 16, 0.001), kit.blued, 0, by, 0);
  put(s, body, side([[-0.35, by - 0.018], [-0.318, by - 0.018], [-0.32, by + 0.016, 0.004], [-0.346, by + 0.016, 0.004]], 0.03, { bevel: 0.003 }), kit.metal);
  flashHider(s, body, by, -0.525, 0.052, 0.0148);

  // --- Viseur holographique ---
  holoSight(s, body, sightY, -0.02, 0.07, railTop);

  // --- Levier d'armement a gauche et culasse (a droite, par la fenetre) :
  // ils reculent a chaque coup ---
  const handle = f.group(body);
  rig.slide = handle;
  put(s, handle, rod(0.0045, 0, 0.022, 10), kit.steel, -0.034, 0.028, -0.12, 0, -Math.PI / 2, 0);
  put(s, handle, lathe([[0.0001, 0], [0.0075, 0.001, 0.002], [0.0085, 0.012, 0.003], [0.0001, 0.014]], 12), kit.dark, -0.054, 0.028, -0.12, 0, -Math.PI / 2, 0);
  put(s, handle, block(0.0014, 0.012, 0.05, 0), kit.steel, 0.0344, 0.014, 0.14);
  rig.handleAt = new THREE.Vector3(-0.064, 0.028, -0.12);
  rig.ejectAt.set(0.04, 0.014, 0.14);

  // --- Poignee et detente ---
  const grip = f.group(body, H.x, H.y, H.z);
  grip.rotation.x = tilt;
  rifleGrip(s, grip, shell);
  triggerUnder(s, body, H, tilt, -0.048, { width: 0.022, mat: shell });

  // --- Chargeur courbe, derriere la poignee ---
  const mag = f.group(body);
  rig.mag = mag;
  curvedMag(s, mag, kit.dark, 0.205, -0.062, 0.072, 0.55, 0.33, 0.05);

  // --- Plaque de couche ---
  put(s, body, side([[0.29, 0.038], [0.306, 0.038, 0.004], [0.31, -0.118, 0.006], [0.292, -0.124, 0.004]], 0.07, { bevel: 0.004 }), kit.rubber);

  rig.muzzleZ = -0.525;
  rig.muzzleY = by;
  rig.sightY = sightY;
  rig.rackHand = true;
  rig.rightHand.position.copy(H);
  rig.rightHand.rotation.set(tilt, 0, 0);
  body.add(rig.rightHand);
  rig.leftHand.position.set(0, -0.002, -0.2);
  body.add(rig.leftHand);
  rig.magGrip.set(0, -0.02, 0);
  return rig;
}

// ---------------------------------------------------------------------------
// Fusil a deux canons juxtaposes : bascule en acier, canons bronzes et bande,
// devant et crosse en noyer, levier d'ouverture, deux detentes
// ---------------------------------------------------------------------------

function double(s: Shop): GunRig {
  const { kit, body, f } = s;
  const tilt = -0.45;
  const rig = rigBase(s, "appui", tilt);
  const H = gripOrigin(-0.026, 0.145, tilt);
  const by = 0.03;
  const br = 0.021;
  const bx = 0.022;
  const breech = -0.03;
  const sightY = 0.062;
  const hinge = new THREE.Vector3(0, by - 0.036, -0.105);

  // --- Bascule : barre sous les canons, face de culasse, epaulements ---
  put(
    s,
    body,
    side(
      [
        [-0.124, by - 0.042, 0.012],
        [-0.104, by - 0.058, 0.006],
        [0.05, by - 0.058],
        [0.09, by - 0.046, 0.012],
        [0.104, by - 0.004, 0.01],
        [0.098, by + 0.018, 0.008],
        [breech, by + 0.022, 0.004],
        [breech, by - 0.03],
        [-0.124, by - 0.03],
      ],
      0.084,
      { bevel: 0.005, seg: 2 },
    ),
    kit.steel,
  );
  for (const sx of [-1, 1]) {
    put(s, body, lathe([[0.0001, breech], [br + 0.003, breech], [br + 0.002, breech + 0.012, 0.012], [0.0001, breech + 0.032]], 20), kit.steel, sx * bx, by, 0);
    screw(s, body, sx * 0.0422, by - 0.03, 0.02, 0.0048);
    screw(s, body, sx * 0.0422, by - 0.012, 0.062, 0.0036);
  }
  // Levier d'ouverture sur la queue de bascule, surete a coulisse.
  put(s, body, plan([[-0.008, 0.012], [0.008, 0.012], [0.034, 0.064, 0.006], [0.024, 0.07, 0.006], [-0.008, 0.032]], 0.006, { bevel: 0.0015 }), kit.blued, 0, by + 0.023, 0);
  put(s, body, block(0.01, 0.005, 0.014, 0.0015), kit.blued, 0, by + 0.02, 0.082);

  // --- Deux detentes et le pontet ---
  const yTop = by - 0.058;
  const l = indexTipLocal(tilt);
  const tip = fromHand(H, tilt, l.x, l.y, l.z);
  triggerBlade(s, body, yTop - 0.002, tip.z + 0.017, Math.max(0.026, yTop - tip.y + 0.012), kit.steel);
  triggerBlade(s, body, yTop - 0.002, tip.z + 0.045, Math.max(0.026, yTop - tip.y + 0.004), kit.steel);
  const yBot = Math.min(tip.y - 0.02, yTop - 0.04);
  const zBack = Math.max(tip.z + 0.075, gripFrontZ(H, tilt, yBot) + 0.006);
  triggerGuard(s, body, tip.z - 0.026, zBack, yTop, yBot, 0.022, 0.008, kit.blued);

  // --- Poignee demi-pistolet et crosse anglaise en noyer ---
  const grip = f.group(body, H.x, H.y, H.z);
  grip.rotation.x = tilt;
  smoothGrip(s, grip, kit.wood, 0.054);
  put(
    s,
    body,
    side(
      [
        [0.096, 0.047],
        [0.47, 0.03, 0.012],
        [0.5, 0.028, 0.006],
        [0.508, -0.118, 0.008],
        [0.48, -0.126, 0.01],
        [0.3, -0.094, 0.03],
        [0.232, -0.106, 0.02],
        [0.2, -0.124, 0.01],
        [0.14, -0.03],
        [0.098, -0.028],
      ],
      0.054,
      { bevel: 0.008, seg: 3 },
    ),
    kit.wood,
  );
  put(s, body, side([[0.498, 0.03], [0.516, 0.03, 0.004], [0.522, -0.124, 0.006], [0.504, -0.13, 0.004]], 0.058, { bevel: 0.004 }), kit.rubber);

  // --- Canons : ils basculent autour de la charniere pour le rechargement ---
  const bar = f.group(body, hinge.x, hinge.y, hinge.z);
  rig.barrels = bar;
  const ay = by - hinge.y;
  const rz = (z: number) => z - hinge.z;
  for (const sx of [-1, 1]) {
    put(
      s,
      bar,
      lathe(
        [
          [0.0001, rz(-0.69)],
          [br - 0.002, rz(-0.69)],
          [br - 0.002, rz(-0.45), 0.02],
          [br, rz(-0.2), 0.04],
          [br + 0.002, rz(-0.07), 0.01],
          [br + 0.002, rz(breech)],
          [0.0001, rz(breech)],
        ],
        20,
      ),
      kit.blued,
      sx * bx,
      ay,
      0,
    );
    put(s, bar, rod(br - 0.008, rz(-0.6905), rz(-0.678), 14), kit.bore, sx * bx, ay, 0);
    put(s, bar, rod(br - 0.008, rz(breech) - 0.012, rz(breech) + 0.0005, 14), kit.bore, sx * bx, ay, 0);
  }
  // Bande de visee entre les canons, guidon a bille en laiton.
  put(s, bar, block(0.014, 0.006, 0.655, 0.001), kit.dark, 0, ay + br - 0.001, rz(-0.36));
  optic(put(s, bar, sphere(0.0038, 12, 10), kit.brass, 0, sightY - 0.0038 - hinge.y, rz(-0.672)));
  // Crochets sous les canons (ils se logent dans la bascule).
  put(s, bar, side([[rz(breech), ay - br + 0.004], [rz(-0.11), ay - br + 0.004], [rz(-0.11), ay - 0.034, 0.006], [rz(breech), ay - 0.034]], 0.03, { bevel: 0.003 }), kit.blued);
  // Devant en noyer, sa ferrure et son verrou.
  put(
    s,
    bar,
    side(
      [
        [rz(-0.315), ay - 0.018, 0.012],
        [rz(-0.1), ay - 0.014],
        [rz(-0.1), ay - 0.052, 0.006],
        [rz(-0.29), ay - 0.048, 0.014],
        [rz(-0.318), ay - 0.034, 0.01],
      ],
      0.074,
      { bevel: 0.006, seg: 2 },
    ),
    kit.wood,
  );
  put(s, bar, side([[rz(-0.13), ay - 0.03], [rz(-0.098), ay - 0.03], [rz(-0.098), ay - 0.054, 0.004], [rz(-0.126), ay - 0.052, 0.006]], 0.07, { bevel: 0.003 }), kit.steel);
  put(s, bar, block(0.016, 0.006, 0.03, 0.002), kit.steel, 0, ay - 0.051, rz(-0.28));

  // --- Douilles, cartouches neuves ---
  rig.ejectParent = bar;
  rig.ejectAt.set(0, ay, rz(breech) + 0.012);
  // La main gauche (fille des canons) pousse la cartouche dans la chambre.
  rig.dipPort.set(0, ay + 0.036, rz(breech) + 0.036);
  const carry = shotShell(s, rig.leftHand, 0, -0.034, 0, 0.058, 0.0115);
  rig.carry = carry;

  rig.muzzleZ = -0.69;
  rig.muzzleY = by;
  rig.sightY = sightY;
  rig.reloadStyle = "bascule";
  rig.casing = "coque";
  rig.rightHand.position.copy(H);
  rig.rightHand.rotation.set(tilt, 0, 0);
  body.add(rig.rightHand);
  // La main gauche tient le devant : elle suit les canons quand ils basculent.
  rig.leftHand.position.set(0, by - 0.014 - hinge.y, rz(-0.215));
  bar.add(rig.leftHand);
  return rig;
}

// ---------------------------------------------------------------------------
// Arbalete a poulies : rail d'aluminium, branches doubles et poulies, corde
// armee, crosse polymere, viseur point rouge au-dessus du mecanisme
// ---------------------------------------------------------------------------

function arbalete(s: Shop): GunRig {
  const { kit, body, f } = s;
  const tilt = -0.3;
  const rig = rigBase(s, "appui", tilt);
  const H = gripOrigin(-0.038, 0.1, tilt);
  const by = 0.064;
  const railTop = 0.057;
  const sy = 0.061;
  const sightY = 0.135;

  // --- Rail de tir et sa rainure ---
  put(s, body, side([[-0.455, 0.03], [0.035, 0.03], [0.035, railTop], [-0.455, railTop]], 0.034, { bevel: 0.003, seg: 1 }), kit.metal);
  put(s, body, block(0.008, 0.0014, 0.47, 0), kit.bore, 0, railTop + 0.0002, -0.21);
  for (let i = 0; i < 4; i++) put(s, body, block(0.0352, 0.01, 0.05, 0.002), kit.bore, 0, 0.043, -0.42 + i * 0.1);

  // --- Fut polymere sous le rail ---
  put(
    s,
    body,
    side([[-0.405, 0.034], [0.035, 0.034], [0.035, -0.032, 0.008], [-0.1, -0.036], [-0.38, -0.03, 0.012], [-0.405, -0.004, 0.01]], 0.064, { bevel: 0.006, seg: 2 }),
    kit.polymer,
  );
  for (const zz of [-0.35, -0.11]) put(s, body, block(0.0656, 0.012, 0.05, 0.003), kit.bore, 0, -0.008, zz);

  // --- Mecanisme : boitier de la gachette, crochet de corde, rail du viseur ---
  put(
    s,
    body,
    side([[0.03, -0.036], [0.125, -0.04], [0.13, 0.02, 0.008], [0.115, 0.086, 0.01], [0.065, 0.086, 0.008], [0.03, 0.068, 0.01]], 0.056, { bevel: 0.005, seg: 2 }),
    kit.polymer,
  );
  put(s, body, block(0.024, 0.012, 0.014, 0.002), kit.dark, 0, railTop + 0.005, 0.03);
  for (const sx of [-1, 1]) screw(s, body, sx * 0.028, 0.02, 0.09, 0.0045);
  rail(s, body, 0.035, 0.115, 0.086, 0.026);
  redDotTube(s, body, sightY, 0.035, 0.105, 0.097);

  // --- Poignee, detente ---
  const grip = f.group(body, H.x, H.y, H.z);
  grip.rotation.x = tilt;
  rifleGrip(s, grip, kit.polymer);
  triggerUnder(s, body, H, tilt, -0.037, { width: 0.022, mat: kit.dark });

  // --- Crosse squelette, busc, plaque de couche ---
  put(
    s,
    body,
    side(
      [
        [0.125, 0.07],
        [0.44, 0.078, 0.01],
        [0.465, 0.072, 0.006],
        [0.47, -0.1, 0.01],
        [0.44, -0.11, 0.01],
        [0.27, -0.068, 0.02],
        [0.18, -0.052],
        [0.125, -0.045],
      ],
      0.054,
      { bevel: 0.007, seg: 2, holes: [[[0.2, 0.045], [0.41, 0.052, 0.008], [0.42, -0.06, 0.01], [0.33, -0.04, 0.01], [0.21, -0.026, 0.008]]] },
    ),
    kit.polymer,
  );
  put(s, body, side([[0.24, 0.07], [0.42, 0.076], [0.42, 0.09, 0.006], [0.25, 0.086, 0.008]], 0.044, { bevel: 0.005 }), kit.rubber);
  put(s, body, side([[0.464, 0.08], [0.482, 0.08, 0.004], [0.486, -0.104, 0.006], [0.466, -0.112, 0.004]], 0.06, { bevel: 0.004 }), kit.rubber);

  // --- Arc : etrier avant, branches doubles, poulies ---
  put(s, body, plan([[-0.07, -0.37], [0.07, -0.37], [0.075, -0.4, 0.006], [0.05, -0.445, 0.01], [-0.05, -0.445, 0.01], [-0.075, -0.4, 0.006]], 0.05, { bevel: 0.004, seg: 2 }), kit.metal, 0, 0.045, 0);
  put(
    s,
    body,
    plan([[-0.055, -0.425], [0.055, -0.425], [0.055, -0.53, 0.03], [-0.055, -0.53, 0.03]], 0.01, {
      bevel: 0.002,
      holes: [[[-0.041, -0.44], [0.041, -0.44], [0.041, -0.516, 0.02], [-0.041, -0.516, 0.02]]],
    }),
    kit.dark,
    0,
    0.02,
    0,
  );
  put(s, body, block(0.084, 0.014, 0.018, 0.004), kit.rubber, 0, 0.02, -0.523);
  const limb: Pt[] = [
    [0.05, -0.435],
    [0.16, -0.408, 0.03],
    [0.27, -0.358],
    [0.276, -0.338, 0.005],
    [0.16, -0.382, 0.03],
    [0.05, -0.395],
  ];
  const limbL: Pt[] = limb.map((p) => (p.length > 2 ? ([-p[0], p[1], p[2] ?? 0] as const) : ([-p[0], p[1]] as const)));
  for (const pts of [limb, limbL]) {
    for (const dy of [-0.014, 0.014]) put(s, body, plan(pts, 0.008, { bevel: 0.002 }), kit.dark, 0, sy + dy, 0);
  }
  for (const sx of [-1, 1]) {
    put(s, body, block(0.03, 0.04, 0.05, 0.004), kit.dark, sx * 0.07, sy, -0.41);
    put(s, body, rod(0.024, -0.006, 0.006, 20, 0.002), kit.metal, sx * 0.262, sy, -0.335, Math.PI / 2, 0, 0);
    put(s, body, rod(0.004, -0.02, 0.02, 8), kit.steel, sx * 0.262, sy, -0.335, Math.PI / 2, 0, 0);
  }
  // Corde armee : des poulies jusqu'au crochet, et son tranchefil au centre.
  const nock = new THREE.Vector3(0, sy, 0.024);
  for (const sx of [-1, 1]) put(s, body, capsuleBetween(new THREE.Vector3(sx * 0.252, sy, -0.316), nock, 0.0022, 6), kit.cord);
  put(s, body, capsuleBetween(new THREE.Vector3(-0.022, sy, 0.022), new THREE.Vector3(0.022, sy, 0.022), 0.0032, 6), kit.dark);

  // --- Carreau : fut carbone, lame a trois tranchants, empennes, encoche
  // lumineuse. Il part au tir et un neuf revient au rechargement ---
  const bolt = f.group(body);
  rig.mag = bolt;
  put(s, bolt, rod(0.0055, -0.4, 0.018, 10), kit.rubber, 0, by, 0);
  put(s, bolt, rod(0.006, -0.412, -0.396, 10, 0.001), kit.steel, 0, by, 0);
  put(s, bolt, lathe([[0.0001, -0.456], [0.004, -0.442, 0.001], [0.0075, -0.426, 0.002], [0.006, -0.41], [0.0001, -0.41]], 12), kit.steel, 0, by, 0);
  for (let i = 0; i < 3; i++) {
    const a = Math.PI + (i * Math.PI * 2) / 3;
    put(s, bolt, side([[-0.45, 0.0], [-0.412, 0.0], [-0.416, 0.017, 0.002]], 0.0016, { bevel: 0.0005, seg: 1 }), kit.steel, 0, by, 0, 0, 0, a);
    put(s, bolt, side([[-0.046, 0.005], [-0.004, 0.005], [-0.011, 0.018, 0.004], [-0.034, 0.015, 0.006]], 0.0012, { bevel: 0.0004, seg: 1 }), i === 0 ? kit.white : kit.accent, 0, by, 0, 0, 0, a);
  }
  put(s, bolt, lathe([[0.0001, 0.018], [0.0058, 0.018], [0.0058, 0.03], [0.004, 0.032, 0.001], [0.0001, 0.032]], 10), kit.accent, 0, by, 0);

  rig.muzzleZ = -0.455;
  rig.muzzleY = by;
  rig.sightY = sightY;
  rig.reloadStyle = "projectile";
  // La main apporte le carreau par en dessous (decalage par rapport au carreau).
  rig.dipPort.set(0, 0.035, 0);
  rig.rightHand.position.copy(H);
  rig.rightHand.rotation.set(tilt, 0, 0);
  body.add(rig.rightHand);
  rig.leftHand.position.set(0, 0.012, -0.25);
  body.add(rig.leftHand);
  return rig;
}

// ---------------------------------------------------------------------------
// Lance-roquettes : tube composite, protege-chaleur strie, cone arriere,
// viseur reflex sur embase, poignee de tir et poignee avant, roquette
// dont l'ogive depasse du tube
// ---------------------------------------------------------------------------

function roquettes(s: Shop): GunRig {
  const { kit, body, f } = s;
  const tilt = -0.18;
  const vTilt = 0.12;
  const rig = rigBase(s, "poignee", tilt, vTilt);
  const H = gripOrigin(-0.075, 0.05, tilt);
  const ty = 0.02;
  const R = 0.068;
  const zF = -0.79;
  const zB = 0.17;
  const sightY = 0.155;

  // --- Tube, bagues, protege-chaleur, cone arriere ---
  put(s, body, tube(R - 0.007, R, zF, zB, 32, 0.002), kit.olive, 0, ty, 0);
  put(s, body, tube(R - 0.007, R + 0.006, zF, zF + 0.042, 32, 0.003), kit.dark, 0, ty, 0);
  put(s, body, tube(R - 0.007, R + 0.006, zB - 0.04, zB, 32, 0.003), kit.dark, 0, ty, 0);
  for (const zz of [-0.52, -0.3]) put(s, body, tube(R, R + 0.0045, zz - 0.012, zz + 0.012, 32, 0.0015), kit.dark, 0, ty, 0);
  put(s, body, tube(R, R + 0.009, -0.2, 0.09, 32, 0.004), kit.polymer, 0, ty, 0);
  for (let i = 0; i < 6; i++) {
    const zz = -0.185 + i * 0.05;
    put(s, body, tube(R + 0.008, R + 0.012, zz, zz + 0.014, 32, 0.0015), kit.polymer, 0, ty, 0);
  }
  put(
    s,
    body,
    lathe([[R - 0.007, zB], [R + 0.004, zB], [R + 0.022, zB + 0.12, 0.006], [R + 0.014, zB + 0.12], [R - 0.01, zB + 0.02], [R - 0.007, zB]], 32),
    kit.dark,
    0,
    ty,
    0,
  );
  // Interieur du tube, noir, et marquage jaune de securite a la bouche.
  put(s, body, rod(R - 0.008, zF + 0.16, zF + 0.17, 20), kit.bore, 0, ty, 0);
  put(s, body, tube(R + 0.0005, R + 0.001, zF + 0.05, zF + 0.07, 32), kit.brass, 0, ty, 0);

  // --- Viseur reflex sur embase ---
  put(s, body, side([[-0.13, ty + R - 0.006], [0.0, ty + R - 0.006], [-0.01, 0.113, 0.004], [-0.12, 0.113, 0.004]], 0.03, { bevel: 0.003 }), kit.dark);
  for (const zz of [-0.115, -0.015]) put(s, body, tube(R, R + 0.005, zz - 0.01, zz + 0.01, 32, 0.0015), kit.dark, 0, ty, 0);
  screw(s, body, 0.0155, 0.1, -0.1, 0.004);
  screw(s, body, 0.0155, 0.1, -0.03, 0.004);
  rail(s, body, -0.12, -0.01, 0.113, 0.03);
  reflexSight(s, body, sightY, -0.065, 0.124);

  // --- Mecanisme de tir, poignee, detente, appui d'epaule ---
  put(
    s,
    body,
    side([[-0.13, ty - R + 0.006], [0.07, ty - R + 0.006], [0.07, -0.075, 0.008], [-0.11, -0.075, 0.006], [-0.13, -0.06, 0.006]], 0.04, { bevel: 0.004, seg: 2 }),
    kit.dark,
  );
  for (const sx of [-1, 1]) screw(s, body, sx * 0.0202, -0.062, 0.03, 0.0038);
  const grip = f.group(body, H.x, H.y, H.z);
  grip.rotation.x = tilt;
  rifleGrip(s, grip, kit.polymer);
  triggerUnder(s, body, H, tilt, -0.075, { width: 0.022, mat: kit.dark });
  put(s, body, side([[0.07, ty - R + 0.004], [0.165, ty - R + 0.004], [0.165, -0.088, 0.012], [0.09, -0.074, 0.012]], 0.05, { bevel: 0.006, seg: 2 }), kit.rubber);

  // --- Poignee avant ---
  const zFG = -0.3;
  const yFG = ty - R - 0.004;
  put(s, body, block(0.03, 0.014, 0.05, 0.003), kit.dark, 0, ty - R + 0.002, zFG);
  const fg = f.group(body, 0, yFG, zFG);
  fg.rotation.x = vTilt;
  foreGrip(s, fg, kit.polymer, 0.12, 0.062, 0.044);

  // --- Roquette : moteur dans le tube, ogive et fusee devant ---
  const rocket = f.group(body);
  rig.mag = rocket;
  put(s, rocket, rod(0.05, zF - 0.02, zF + 0.1, 24, 0.002), kit.sable, 0, ty, 0);
  put(
    s,
    rocket,
    lathe(
      [
        [0.0001, -1.06],
        [0.009, -1.06, 0.002],
        [0.012, -1.045],
        [0.03, -0.99, 0.02],
        [0.062, -0.9, 0.03],
        [0.064, -0.86, 0.006],
        [0.052, -0.83, 0.006],
        [0.05, -0.81],
        [0.0001, -0.81],
      ],
      24,
    ),
    kit.olive,
    0,
    ty,
    0,
  );
  put(s, rocket, tube(0.05, 0.0535, -0.83, -0.815, 24, 0.001), kit.dark, 0, ty, 0);
  put(s, rocket, tube(0.0615, 0.0645, -0.905, -0.89, 24, 0.001), kit.brass, 0, ty, 0);
  put(s, rocket, lathe([[0.0001, -1.076], [0.005, -1.073, 0.002], [0.0092, -1.06], [0.0001, -1.06]], 12), kit.steel, 0, ty, 0);

  rig.muzzleZ = zF;
  rig.muzzleY = ty;
  rig.sightY = sightY;
  rig.reloadStyle = "projectile";
  // La main gauche porte la roquette par-dessous (decalage par rapport a son centre).
  rig.dipPort.set(-0.03, -0.085, 0.06);
  rig.rightHand.position.copy(H);
  rig.rightHand.rotation.set(tilt, 0, 0);
  body.add(rig.rightHand);
  // Main gauche sur la poignee avant : son origine est sur l'axe de la poignee.
  const d = 0.066;
  rig.leftHand.position.set(0, yFG - d * Math.cos(vTilt), zFG - d * Math.sin(vTilt));
  rig.leftHand.rotation.set(vTilt, 0, 0);
  body.add(rig.leftHand);
  return rig;
}

/** Les armes de cette partie de l'arsenal, par identifiant. */
export const ARSENAL_3: Partial<Record<WeaponId, (s: Shop) => GunRig>> = {
  mitrailleuse,
  rafale,
  double,
  arbalete,
  roquettes,
};
