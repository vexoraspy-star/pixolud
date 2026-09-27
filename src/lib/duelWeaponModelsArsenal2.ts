import * as THREE from "three";
import type { WeaponId } from "./duelWeapons";
import { block, front, lathe, optic, top as plan, rod, side, sphere, tube, type Pt } from "./duelWeaponModels";
import {
  apertureSight,
  curvedMag,
  gripOrigin,
  hoodedPost,
  muzzleBrake,
  put,
  rail,
  rearNotch,
  redDotTube,
  rifleGrip,
  rigBase,
  scope,
  screw,
  shotShell,
  triggerBlade,
  triggerUnder,
  type GunRig,
  type Parent,
  type Shop,
} from "./duelWeaponModelsParts";

/**
 * L'arsenal du Duel, suite : revolver, pistolet-mitrailleur, carabine,
 * mitrailleuse, fusil a rafale, fusil a deux canons, arbalete et
 * lance-roquettes.
 *
 * Meme methode que duelWeaponModelsArsenal : des profils de cote extrudes et
 * biseautes, des pieces tournees, et des mains gantees posees sur de vraies
 * poignees. Des armes generiques dans le style des armes reelles, sans
 * copier aucun modele existant. Repere : x a droite, y en haut, bouche vers -z.
 */

// ---------------------------------------------------------------------------
// Pieces propres a ces armes
// ---------------------------------------------------------------------------

/** Poignee lisse de crosse en bois (chasse, fusil de ferme), dans le repere de la main. */
function smoothGrip(s: Shop, parent: Parent, mat: THREE.Material, width = 0.054) {
  const pts: Pt[] = [
    [-0.036, 0.1],
    [-0.04, 0.052, 0.01],
    [-0.045, 0.0, 0.03],
    [-0.046, -0.06, 0.02],
    [-0.036, -0.08, 0.01],
    [0.04, -0.084, 0.01],
    [0.05, -0.068, 0.012],
    [0.05, -0.03, 0.03],
    [0.043, 0.03, 0.02],
    [0.048, 0.07, 0.012],
    [0.05, 0.1],
  ];
  put(s, parent, side(pts, width, { bevel: 0.01, seg: 3 }), mat);
  // Calotte de poignee sombre.
  put(s, parent, side([[-0.036, -0.076], [0.04, -0.08], [0.04, -0.09, 0.005], [-0.034, -0.086, 0.005]], width - 0.006, { bevel: 0.003 }), s.kit.dark);
}

/**
 * Poignee avant verticale, dans son propre repere : le haut en y = 0, elle
 * descend de `len`. Nervures pour les doigts, bouchon en bas.
 */
function foreGrip(s: Shop, parent: Parent, mat: THREE.Material, len = 0.12, depth = 0.066, width = 0.046) {
  const hd = depth / 2;
  put(
    s,
    parent,
    side(
      [
        [-hd, 0.0],
        [hd, 0.0],
        [hd + 0.002, -len * 0.3, 0.02],
        [hd - 0.002, -len * 0.55, 0.01],
        [hd + 0.002, -len * 0.8, 0.01],
        [hd, -len, 0.012],
        [-hd, -len, 0.012],
        [-hd - 0.003, -len * 0.25, 0.03],
      ],
      width,
      { bevel: 0.009, seg: 3 },
    ),
    mat,
  );
  // Anneaux de prise et bouchon.
  for (let i = 0; i < 3; i++) put(s, parent, side([[-hd + 0.004, -len * (0.35 + i * 0.18)], [hd - 0.004, -len * (0.35 + i * 0.18)], [hd - 0.004, -len * (0.35 + i * 0.18) - 0.006], [-hd + 0.004, -len * (0.35 + i * 0.18) - 0.006]], width + 0.003, { bevel: 0.0015 }), s.kit.dark);
  put(s, parent, side([[-hd + 0.003, -len + 0.004], [hd - 0.003, -len + 0.004], [hd - 0.006, -len - 0.008, 0.004], [-hd + 0.006, -len - 0.008, 0.004]], width - 0.004, { bevel: 0.003 }), s.kit.rubber);
}

/**
 * Viseur reflex ouvert (plaque) : embase sur le rail, fenetre en arceau,
 * verre teinte et point. Le centre de la fenetre est a la hauteur `y`.
 */
function reflexSight(s: Shop, parent: Parent, y: number, z: number, railY: number) {
  const k = s.kit;
  const hw = 0.019;
  const winH = 0.03;
  const y0 = y - winH / 2 - 0.004;
  // Embase : du rail jusque sous la fenetre.
  put(s, parent, side([[z - 0.03, railY], [z + 0.03, railY], [z + 0.03, y0, 0.004], [z - 0.022, y0, 0.006]], 0.034, { bevel: 0.003 }), k.dark);
  put(s, parent, block(0.036, 0.006, 0.05, 0.002), k.dark, 0, railY + 0.003, z);
  screw(s, parent, 0.0172, railY + 0.004, z + 0.012, 0.0035);
  // Arceau de la fenetre.
  const outer: Pt[] = [
    [-hw, 0],
    [hw, 0],
    [hw, winH + 0.004, 0.012],
    [-hw, winH + 0.004, 0.012],
  ];
  const hole: Pt[] = [
    [-hw + 0.004, 0.004],
    [hw - 0.004, 0.004],
    [hw - 0.004, winH, 0.009],
    [-hw + 0.004, winH, 0.009],
  ];
  optic(put(s, parent, front(outer, 0.008, { bevel: 0.0015, seg: 1, holes: [hole] }), k.dark, 0, y0, z - 0.02));
  // Verre et point : le point flotte juste derriere le verre.
  optic(put(s, parent, block(hw * 2 - 0.008, winH - 0.004, 0.0006, 0), k.glassTint, 0, y0 + winH / 2 + 0.002, z - 0.02));
  const dot = optic(put(s, parent, rod(0.0024, -0.0004, 0.0004, 10), k.accent, 0, y, z - 0.014));
  dot.name = "dot";
  // Emetteur, a l'arriere de l'embase.
  optic(put(s, parent, block(0.008, 0.006, 0.008, 0.001), k.dark, 0, y0 + 0.003, z + 0.02));
}

/**
 * Viseur holographique : embase, boitier de pile en travers, capot
 * rectangulaire ouvert aux deux bouts, verres et reticule (cercle et point).
 */
function holoSight(s: Shop, parent: Parent, y: number, zFront: number, zBack: number, railY: number) {
  const k = s.kit;
  const len = zBack - zFront;
  const zc = (zFront + zBack) / 2;
  const hw = 0.025;
  const hh = 0.02;
  const yb = y - hh;
  // Embase et boitier de pile, sous la fenetre, a l'avant.
  put(s, parent, block(0.04, 0.008, len, 0.002), k.dark, 0, railY + 0.004, zc);
  put(s, parent, side([[zFront, railY + 0.006], [zBack, railY + 0.006], [zBack - 0.004, yb, 0.004], [zFront + 0.004, yb, 0.004]], 0.036, { bevel: 0.003 }), k.dark);
  put(s, parent, rod(0.0095, -0.024, 0.024, 14, 0.002), k.metal, 0, yb - 0.004, zFront + 0.012, 0, Math.PI / 2, 0);
  // Boutons de reglage, a gauche.
  for (let i = 0; i < 2; i++) put(s, parent, block(0.004, 0.007, 0.01, 0.0015), k.rubber, -0.02, yb - 0.004, zc + 0.006 + i * 0.014);
  // Capot : un cadre rectangulaire creux.
  const outer: Pt[] = [
    [-hw, 0],
    [hw, 0],
    [hw, hh * 2 + 0.008, 0.006],
    [-hw, hh * 2 + 0.008, 0.006],
  ];
  const hole: Pt[] = [
    [-hw + 0.005, 0.006],
    [hw - 0.005, 0.006],
    [hw - 0.005, hh * 2 + 0.002, 0.004],
    [-hw + 0.005, hh * 2 + 0.002, 0.004],
  ];
  optic(put(s, parent, front(outer, len - 0.024, { bevel: 0.002, seg: 1, holes: [hole] }), k.dark, 0, yb - 0.002, zc + 0.006));
  // Verres, avant et arriere.
  for (const zz of [zFront + 0.02, zBack - 0.008]) {
    optic(put(s, parent, block(hw * 2 - 0.01, hh * 2 - 0.004, 0.0006, 0), k.glassTint, 0, y + 0.002, zz));
  }
  // Reticule : un cercle et son point, lumineux.
  const zr = zFront + 0.028;
  optic(put(s, parent, tube(0.0074, 0.0084, zr - 0.0003, zr + 0.0003, 24), k.accent, 0, y, 0));
  const dot = optic(put(s, parent, rod(0.0016, zr - 0.0003, zr + 0.0003, 10), k.accent, 0, y, 0));
  dot.name = "dot";
}

// ---------------------------------------------------------------------------
// Revolver : carcasse inox, canon a bande ventilee et tenon plein, barillet
// cannele a six coups, chien a crete, plaquettes en noyer
// ---------------------------------------------------------------------------

function revolver(s: Shop): GunRig {
  const { kit, body, f } = s;
  const tilt = -0.36;
  const rig = rigBase(s, "soutien", tilt);
  const H = gripOrigin(-0.012, 0.074, tilt);
  const by = 0.034;
  // Axe du barillet : la chambre du haut est dans l'axe du canon.
  const ring = 0.025;
  const cy = by - ring;
  const sightY = 0.077;
  const st = kit.steel;

  // --- Carcasse : pont superieur, fenetre du barillet, bouclier arriere ---
  put(
    s,
    body,
    side(
      [
        [-0.104, 0.066, 0.004],
        [0.05, 0.066],
        [0.066, 0.066, 0.006],
        [0.078, 0.058, 0.008],
        [0.086, 0.03, 0.01],
        [0.088, 0.0, 0.01],
        [0.082, -0.03],
        [0.03, -0.048],
        [-0.085, -0.048],
        [-0.104, -0.034, 0.012],
      ],
      0.05,
      { bevel: 0.004, seg: 2, holes: [[[-0.082, 0.053, 0.005], [0.042, 0.053, 0.005], [0.042, -0.036, 0.005], [-0.082, -0.036, 0.005]]] },
    ),
    st,
  );
  // Plaque laterale, vis, verrou du barillet (a gauche).
  put(s, body, side([[0.046, -0.04], [0.08, -0.028], [0.084, 0.02, 0.006], [0.046, 0.024, 0.006]], 0.0508, { bevel: 0.0012 }), st);
  for (const [yy, zz] of [
    [0.012, 0.074],
    [-0.03, 0.06],
    [0.04, 0.074],
  ]) {
    screw(s, body, 0.0254, yy, zz, 0.0034);
  }
  put(s, body, side([[0.046, 0.026], [0.072, 0.026], [0.074, 0.038, 0.004], [0.048, 0.04, 0.004]], 0.006, { bevel: 0.0015 }), kit.blued, -0.027, 0, 0);
  for (let i = 0; i < 5; i++) put(s, body, block(0.0012, 0.01, 0.0018, 0), kit.dark, -0.0302, 0.033, 0.05 + i * 0.005);

  // --- Canon : tube, tenon plein dessous (il cache la tige d'ejecteur),
  // bande ventilee dessus ---
  put(s, body, lathe([[0.0001, -0.34], [0.0118, -0.34], [0.0132, -0.337, 0.0015], [0.0132, -0.1], [0.0001, -0.1]], 18), st, 0, by, 0);
  put(s, body, rod(0.0085, -0.3405, -0.335, 12), kit.bore, 0, by, 0);
  put(
    s,
    body,
    side([[-0.338, by + 0.004], [-0.102, by + 0.004], [-0.102, cy - 0.012], [-0.3, cy - 0.013, 0.012], [-0.338, cy + 0.002, 0.012]], 0.028, { bevel: 0.004, seg: 2 }),
    st,
  );
  const vents: Pt[][] = [];
  for (let i = 0; i < 5; i++) {
    const z0 = -0.305 + i * 0.041;
    vents.push([
      [z0, by + 0.013],
      [z0 + 0.026, by + 0.013],
      [z0 + 0.026, by + 0.019, 0.002],
      [z0, by + 0.019, 0.002],
    ]);
  }
  put(s, body, side([[-0.338, by + 0.008], [-0.102, by + 0.008], [-0.102, by + 0.024], [-0.338, by + 0.024]], 0.016, { bevel: 0.002, seg: 1, holes: vents }), st);
  // Guidon a rampe, insert rouge ; hausse reglable sur le pont.
  optic(put(s, body, side([[-0.338, by + 0.022], [-0.31, by + 0.022], [-0.31, sightY, 0.001], [-0.321, sightY, 0.002]], 0.0075, { bevel: 0.001 }), kit.blued));
  optic(put(s, body, block(0.0076, 0.008, 0.0012, 0), kit.accent, 0, sightY - 0.0065, -0.3095));
  rearNotch(s, body, 0.058, 0.066, 0.03, 0.012, 0.009, 0.0062, 0.013, kit.blued);
  put(s, body, block(0.034, 0.004, 0.03, 0.001), kit.blued, 0, 0.068, 0.054);
  screw(s, body, 0.0175, 0.0715, 0.052, 0.0028, kit.steel);

  // --- Chien a crete, derriere le barillet ---
  put(
    s,
    body,
    side([[0.064, 0.02], [0.082, 0.018], [0.098, 0.056, 0.004], [0.108, 0.066, 0.003], [0.102, 0.071, 0.003], [0.084, 0.064], [0.07, 0.054]], 0.012, { bevel: 0.002 }),
    kit.blued,
  );
  for (let i = 0; i < 4; i++) put(s, body, block(0.0124, 0.0014, 0.005, 0), kit.dark, 0, 0.061 + i * 0.0024, 0.1 + i * 0.002);

  // --- Barillet : il tourne d'un sixieme de tour par coup et bascule a
  // gauche au rechargement ---
  const drum = f.group(body, 0, cy, -0.02);
  rig.drum = drum;
  const R = 0.042;
  put(s, drum, lathe([[0.0001, -0.058], [0.036, -0.058], [R, -0.052, 0.003], [R, -0.042], [0.0001, -0.042]], 24), st);
  put(s, drum, lathe([[0.0001, 0.034], [R, 0.034], [R, 0.054], [0.04, 0.058, 0.002], [0.0001, 0.058]], 24), st);
  // Section cannelee : six gorges entre les chambres.
  const flutes: Pt[] = [];
  const a0 = Math.PI / 2 + Math.PI / 6;
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const c = Math.cos(6 * (a - a0));
    const r = R - 0.0068 * Math.max(0, c) ** 2;
    flutes.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  put(s, drum, front(flutes, 0.077, { bevel: 0.0008, seg: 1 }), st, 0, 0, -0.0045);
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 3;
    const x = Math.cos(a) * ring;
    const y = Math.sin(a) * ring;
    // Bouches des chambres a l'avant, culots des cartouches a l'arriere.
    put(s, drum, rod(0.0088, -0.0585, -0.056, 12), kit.bore, x, y, 0);
    put(s, drum, rod(0.0102, 0.056, 0.0594, 14, 0.001), kit.brass, x, y, 0);
    put(s, drum, rod(0.003, 0.0594, 0.0598, 8), kit.copper, x, y, 0);
  }
  put(s, drum, lathe([[0.0001, 0.058], [0.009, 0.058], [0.009, 0.0596, 0.0005], [0.0001, 0.0596]], 12), kit.steel);
  // Tige d'ejecteur (cachee par le tenon, elle sort avec le barillet).
  put(s, drum, rod(0.0052, -0.17, -0.058, 10), kit.steel);
  put(s, drum, lathe([[0.0001, -0.182], [0.007, -0.182, 0.002], [0.0075, -0.17], [0.0001, -0.17]], 12), kit.steel);
  rig.ejectParent = drum;
  rig.ejectAt.set(0, 0, 0.062);

  // --- Detente, pontet, poignee en noyer ---
  triggerUnder(s, body, H, tilt, -0.048, { width: 0.02, mat: st, bladeMat: kit.blued });
  const grip = f.group(body, H.x, H.y, H.z);
  grip.rotation.x = tilt;
  put(
    s,
    grip,
    side(
      [
        [-0.038, 0.09],
        [-0.042, 0.04, 0.012],
        [-0.047, 0.025, 0.008],
        [-0.042, 0.008, 0.008],
        [-0.047, -0.01, 0.008],
        [-0.042, -0.028, 0.008],
        [-0.046, -0.05, 0.01],
        [-0.042, -0.08, 0.02],
        [0.0, -0.093, 0.03],
        [0.046, -0.08, 0.025],
        [0.05, -0.02, 0.03],
        [0.044, 0.04, 0.02],
        [0.05, 0.08, 0.01],
        [0.03, 0.1],
        [-0.038, 0.1],
      ],
      0.06,
      { bevel: 0.012, seg: 3 },
    ),
    kit.wood,
  );
  // Medaillons de plaquettes, et le talon d'acier sous la poignee.
  for (const sx of [-1, 1]) screw(s, grip, sx * 0.0302, -0.012, 0.004, 0.0065, kit.steel);
  put(s, grip, side([[-0.02, -0.088], [0.03, -0.086], [0.032, -0.093, 0.003], [-0.018, -0.095, 0.003]], 0.03, { bevel: 0.002 }), st);

  // --- Chargeur rapide : la main gauche l'apporte au barillet ouvert ---
  // Le barillet s'ouvre de 7,5 cm a gauche et 2 cm vers le bas (voir
  // buildWeaponModel) ; le chargeur se presente contre sa face arriere.
  const target = new THREE.Vector3(-0.075, cy - 0.02, -0.02 + 0.058 + 0.02);
  const grab = new THREE.Vector3(0, -0.035, 0.075);
  rig.dipPort.copy(target).add(grab);
  const handQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, 0, 0));
  const inv = handQ.clone().invert();
  const carry = new THREE.Group();
  carry.position.copy(target).sub(rig.dipPort).applyQuaternion(inv);
  carry.quaternion.copy(inv);
  rig.leftHand.add(carry);
  put(s, carry, lathe([[0.0001, -0.008], [0.03, -0.008], [0.033, -0.004, 0.002], [0.033, 0.012], [0.02, 0.016, 0.004], [0.0001, 0.016]], 18), kit.dark);
  put(s, carry, lathe([[0.0001, 0.016], [0.011, 0.016], [0.012, 0.03, 0.004], [0.0001, 0.032]], 12), kit.dark);
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 3;
    put(s, carry, rod(0.0088, -0.03, -0.008, 10), kit.brass, Math.cos(a) * ring, Math.sin(a) * ring, 0);
    put(s, carry, lathe([[0.0001, -0.044], [0.006, -0.04, 0.003], [0.0086, -0.03], [0.0001, -0.03]], 10), kit.copper, Math.cos(a) * ring, Math.sin(a) * ring, 0);
  }
  rig.carry = carry;

  rig.muzzleZ = -0.3405;
  rig.muzzleY = by;
  rig.sightY = sightY;
  rig.reloadStyle = "barillet";
  rig.rightHand.position.copy(H);
  rig.rightHand.rotation.set(tilt, 0, 0);
  body.add(rig.rightHand);
  rig.leftHand.position.copy(H);
  rig.leftHand.rotation.set(tilt, 0, 0);
  body.add(rig.leftHand);
  return rig;
}

// ---------------------------------------------------------------------------
// Pistolet-mitrailleur compact : chargeur dans la poignee, poignee avant
// repliable, rail et viseur reflex, levier d'armement en T, crosse rentree
// ---------------------------------------------------------------------------

function pm(s: Shop): GunRig {
  const { kit, body, f } = s;
  const tilt = -0.14;
  const vTilt = 0.14;
  const rig = rigBase(s, "poignee", tilt, vTilt);
  const H = gripOrigin(-0.036, 0.034, tilt);
  const by = 0.008;
  const railTop = 0.047;
  const sightY = 0.074;

  // --- Boitier superieur en alliage, carcasse polymere ---
  put(
    s,
    body,
    side([[-0.2, -0.004], [0.1, -0.004], [0.104, 0.028, 0.006], [0.094, 0.036], [-0.19, 0.036], [-0.2, 0.026, 0.006]], 0.048, { bevel: 0.004, seg: 2 }),
    kit.metal,
  );
  put(
    s,
    body,
    side([[-0.202, -0.002], [0.1, -0.002], [0.1, -0.028, 0.008], [0.06, -0.038], [-0.17, -0.038], [-0.202, -0.02, 0.012]], 0.046, { bevel: 0.005, seg: 2 }),
    kit.polymer,
  );
  // Rainures de refroidissement sur le devant, rail dessous.
  for (let i = 0; i < 4; i++) put(s, body, block(0.0476, 0.004, 0.018, 0.001), kit.bore, 0, -0.018, -0.185 + i * 0.026);
  rail(s, body, -0.19, 0.09, 0.036, 0.03);
  // Fenetre d'ejection a droite et la culasse qu'on y voit.
  put(s, body, block(0.006, 0.016, 0.05, 0.001), kit.bore, 0.0214, 0.016, -0.04);
  put(s, body, block(0.004, 0.01, 0.044, 0.001), kit.steel, 0.0212, 0.016, -0.04);
  // Selecteur et arretoir, a gauche ; goupilles.
  put(s, body, side([[-0.004, -0.003], [0.024, -0.001], [0.026, 0.006, 0.003], [-0.004, 0.006, 0.003]], 0.005, { bevel: 0.0015 }), kit.dark, -0.025, -0.02, 0.06);
  put(s, body, rod(0.004, 0, 0.004, 10), kit.steel, -0.0235, -0.016, 0.06, 0, -Math.PI / 2, 0);
  for (const sx of [-1, 1]) {
    screw(s, body, sx * 0.0232, -0.02, -0.12, 0.0035);
    screw(s, body, sx * 0.0232, -0.02, 0.085, 0.0035);
  }

  // --- Canon court filete et compensateur ---
  put(s, body, rod(0.0085, -0.25, -0.2, 14), kit.blued, 0, by, 0);
  put(s, body, lathe([[0.006, -0.277], [0.0125, -0.277], [0.0135, -0.273, 0.002], [0.0135, -0.25], [0.011, -0.246], [0.006, -0.246]], 16), kit.blued, 0, by, 0);
  for (let i = 0; i < 3; i++) put(s, body, block(0.006, 0.004, 0.004, 0.0008), kit.bore, 0, by + 0.012, -0.271 + i * 0.008);
  put(s, body, rod(0.0062, -0.2775, -0.27, 12), kit.bore, 0, by, 0);

  // --- Viseur reflex ---
  reflexSight(s, body, sightY, 0.03, railTop);
  // Guidon de secours rabattu, a l'avant du rail.
  put(s, body, side([[-0.016, 0], [0.012, 0], [0.008, 0.009, 0.003], [-0.012, 0.009, 0.003]], 0.022, { bevel: 0.002 }), kit.dark, 0, railTop, -0.17);

  // --- Levier d'armement en T, a l'arriere : il claque a chaque coup ---
  const handle = f.group(body);
  rig.slide = handle;
  put(s, handle, block(0.012, 0.008, 0.03, 0.002), kit.dark, 0, 0.03, 0.098);
  put(s, handle, side([[0.1, 0.024], [0.116, 0.024], [0.118, 0.036, 0.004], [0.1, 0.036, 0.002]], 0.068, { bevel: 0.003 }), kit.dark);
  rig.handleAt = new THREE.Vector3(-0.034, 0.03, 0.11);
  rig.ejectAt.set(0.028, 0.016, -0.04);

  // --- Poignee avant repliable ---
  const zFG = -0.13;
  put(s, body, block(0.03, 0.012, 0.04, 0.003), kit.dark, 0, -0.043, zFG);
  const fg = f.group(body, 0, -0.046, zFG);
  fg.rotation.x = vTilt;
  foreGrip(s, fg, kit.polymer, 0.118, 0.06, 0.042);

  // --- Poignee (le chargeur passe dedans), detente ---
  const grip = f.group(body, H.x, H.y, H.z);
  grip.rotation.x = tilt;
  put(
    s,
    grip,
    side(
      [
        [-0.04, 0.09],
        [-0.042, 0.04, 0.012],
        [-0.048, 0.026, 0.008],
        [-0.043, 0.01, 0.008],
        [-0.048, -0.008, 0.008],
        [-0.043, -0.026, 0.008],
        [-0.047, -0.046, 0.008],
        [-0.046, -0.08, 0.008],
        [0.046, -0.082, 0.008],
        [0.05, -0.02, 0.03],
        [0.046, 0.04, 0.012],
        [0.05, 0.068, 0.008],
        [0.04, 0.1],
        [-0.04, 0.1],
      ],
      0.056,
      { bevel: 0.01, seg: 3 },
    ),
    kit.polymer,
  );
  put(s, grip, side([[-0.034, 0.02], [0.036, 0.02], [0.04, -0.06, 0.01], [-0.036, -0.06, 0.01]], 0.0584, { bevel: 0.002 }), kit.dark);
  put(s, grip, block(0.006, 0.012, 0.012, 0.002), kit.dark, -0.027, 0.06, -0.036);
  triggerUnder(s, body, H, tilt, -0.038, { width: 0.02, mat: kit.polymer });

  // --- Chargeur : il depasse longuement sous la poignee ---
  const mag = f.group(body);
  rig.mag = mag;
  const magFrame = f.group(mag, H.x, H.y, H.z);
  magFrame.rotation.x = tilt;
  put(s, magFrame, block(0.034, 0.27, 0.052, 0.004), kit.metal, 0, -0.055, 0.004);
  // Nervures laterales du chargeur (sous la poignee) et semelle.
  for (const sx of [-1, 1]) put(s, magFrame, block(0.003, 0.08, 0.012, 0.001), kit.metal, sx * 0.0172, -0.14, 0.004);
  put(s, magFrame, side([[-0.034, -0.186], [0.04, -0.186], [0.038, -0.2, 0.005], [-0.032, -0.2, 0.005]], 0.042, { bevel: 0.003 }), kit.dark);
  put(s, magFrame, rod(0.0045, -0.014, 0.018, 8), kit.brass, 0, 0.078, 0);

  // --- Crosse rentree : deux tiges et une plaque de couche ---
  for (const sx of [-1, 1]) put(s, body, rod(0.0048, 0.095, 0.205, 10, 0.001), kit.steel, sx * 0.018, 0.004, 0);
  put(s, body, side([[0.2, 0.03], [0.222, 0.034, 0.004], [0.226, -0.058, 0.006], [0.206, -0.062, 0.004], [0.2, -0.02, 0.006]], 0.05, { bevel: 0.005, seg: 2 }), kit.polymer);
  put(s, body, side([[0.222, 0.032], [0.232, 0.032, 0.003], [0.235, -0.058, 0.004], [0.224, -0.06]], 0.054, { bevel: 0.003 }), kit.rubber);

  rig.muzzleZ = -0.2775;
  rig.muzzleY = by;
  rig.sightY = sightY;
  rig.rackHand = true;
  rig.rightHand.position.copy(H);
  rig.rightHand.rotation.set(tilt, 0, 0);
  body.add(rig.rightHand);
  // La main gauche empoigne la poignee avant : l'index, le pouce et le haut
  // de la main juste sous le boitier.
  rig.leftHand.position.set(0, -0.046 - 0.068 * Math.cos(vTilt), zFG + 0.068 * Math.sin(vTilt));
  rig.leftHand.rotation.set(vTilt, 0, 0);
  body.add(rig.leftHand);
  // Au rechargement, elle saisit le bas du chargeur, sous la poignee.
  rig.magGrip.set(0, -0.08 * Math.cos(tilt), -0.08 * Math.sin(tilt));
  return rig;
}

// ---------------------------------------------------------------------------
// Carabine de precision : crosse de chasse en noyer d'une piece, boitier
// rond bronze, lunette sur rail, chargeur droit, levier d'armement a droite
// ---------------------------------------------------------------------------

function carabine(s: Shop): GunRig {
  const { kit, body, f } = s;
  const tilt = -0.42;
  const rig = rigBase(s, "appui", tilt);
  const H = gripOrigin(-0.03, 0.15, tilt);
  const by = 0.014;
  const scopeY = 0.1;

  // --- Boitier rond, rail, fenetre d'ejection ---
  put(s, body, lathe([[0.0001, -0.165], [0.019, -0.165], [0.024, -0.16, 0.003], [0.024, 0.125], [0.02, 0.13, 0.004], [0.0001, 0.13]], 24), kit.blued, 0, 0.018, 0);
  put(s, body, side([[-0.165, -0.022], [0.13, -0.022], [0.13, 0.018], [-0.165, 0.018]], 0.044, { bevel: 0.004 }), kit.blued);
  rail(s, body, -0.13, 0.1, 0.04, 0.026);
  put(s, body, block(0.006, 0.017, 0.07, 0.002), kit.bore, 0.0205, 0.028, 0.012, 0, 0, -0.5);
  put(s, body, block(0.004, 0.012, 0.064, 0.001), kit.steel, 0.019, 0.027, 0.012, 0, 0, -0.5);
  screw(s, body, 0.022, 0.0, -0.14, 0.004);
  screw(s, body, 0.022, 0.0, 0.11, 0.004);

  // --- Canon effile, bloc d'emprunt de gaz, frein de bouche ---
  put(s, body, lathe([[0.0001, -0.72], [0.0105, -0.72], [0.011, -0.716, 0.0015], [0.011, -0.52], [0.0145, -0.3, 0.06], [0.0165, -0.165], [0.0001, -0.165]], 20), kit.blued, 0, by, 0);
  put(s, body, lathe([[0.0001, -0.49], [0.017, -0.49], [0.018, -0.486, 0.002], [0.018, -0.466, 0.002], [0.0001, -0.462]], 18), kit.metal, 0, by, 0);
  muzzleBrake(s, body, by, -0.765, 0.05, 0.015);

  // --- Lunette ---
  scope(s, body, scopeY, -0.2, 0.13, 0.051, 0.017);

  // --- Crosse de chasse : fut, poignee, crosse a busc ---
  put(
    s,
    body,
    side([[-0.46, 0.008, 0.006], [-0.16, 0.012], [-0.16, -0.046], [-0.24, -0.05], [-0.42, -0.044, 0.02], [-0.462, -0.026, 0.012]], 0.052, { bevel: 0.008, seg: 3 }),
    kit.wood,
  );
  put(s, body, side([[-0.168, 0.012], [0.13, 0.012], [0.13, -0.03], [-0.02, -0.03], [-0.168, -0.046]], 0.054, { bevel: 0.006, seg: 2 }), kit.wood);
  put(
    s,
    body,
    side(
      [
        [0.12, 0.034],
        [0.46, 0.04, 0.01],
        [0.5, 0.038, 0.006],
        [0.505, -0.105, 0.008],
        [0.48, -0.115, 0.01],
        [0.25, -0.1, 0.03],
        [0.2, -0.1],
        [0.16, -0.03],
        [0.12, -0.03],
      ],
      0.054,
      { bevel: 0.008, seg: 3 },
    ),
    kit.wood,
  );
  // Busc a gauche (joue), plaque de couche, grenadieres.
  put(s, body, side([[0.24, 0.034], [0.42, 0.038], [0.42, -0.012, 0.02], [0.26, -0.004, 0.02]], 0.02, { bevel: 0.006, seg: 2 }), kit.wood, -0.022, 0, 0);
  put(s, body, side([[0.5, 0.04], [0.518, 0.04, 0.004], [0.522, -0.108, 0.006], [0.504, -0.118, 0.004]], 0.058, { bevel: 0.004 }), kit.rubber);
  put(s, body, tube(0.004, 0.0075, -0.004, 0.004, 12), kit.steel, 0, -0.056, -0.41, 0, Math.PI / 2, 0);
  put(s, body, tube(0.004, 0.0075, -0.004, 0.004, 12), kit.steel, 0, -0.118, 0.42, 0, Math.PI / 2, 0);
  const grip = f.group(body, H.x, H.y, H.z);
  grip.rotation.x = tilt;
  smoothGrip(s, grip, kit.wood, 0.054);
  triggerUnder(s, body, H, tilt, -0.03, { width: 0.02, mat: kit.blued, bladeMat: kit.steel });

  // --- Levier d'armement a droite : il recule a chaque coup ---
  const handle = f.group(body);
  rig.slide = handle;
  put(s, handle, block(0.004, 0.008, 0.09, 0.001), kit.steel, 0.0262, 0.004, -0.08);
  put(s, handle, rod(0.0042, 0, 0.018, 10), kit.steel, 0.028, 0.004, -0.036, 0, Math.PI / 2, 0);
  put(s, handle, lathe([[0.0001, 0], [0.0075, 0.001, 0.002], [0.0085, 0.012, 0.003], [0.0001, 0.014]], 12), kit.blued, 0.044, 0.004, -0.036, 0, Math.PI / 2, 0);
  rig.handleAt = new THREE.Vector3(0.052, 0.004, -0.036);
  rig.ejectAt.set(0.03, 0.03, 0.012);

  // --- Chargeur droit ---
  const mag = f.group(body);
  rig.mag = mag;
  put(s, mag, side([[-0.098, -0.02], [-0.024, -0.02], [-0.028, -0.108, 0.004], [-0.104, -0.108, 0.004]], 0.04, { bevel: 0.003 }), kit.metal);
  put(s, mag, side([[-0.108, -0.104], [-0.024, -0.104], [-0.026, -0.118, 0.004], [-0.108, -0.116, 0.004]], 0.046, { bevel: 0.003 }), kit.dark);
  put(s, mag, rod(0.0068, -0.094, -0.03, 10), kit.brass, 0, -0.022, 0);

  rig.muzzleZ = -0.765;
  rig.muzzleY = by;
  rig.sightY = scopeY;
  rig.casing = "long";
  rig.rackHand = true;
  rig.rightHand.position.copy(H);
  rig.rightHand.rotation.set(tilt, 0, 0);
  body.add(rig.rightHand);
  rig.leftHand.position.set(0, -0.012, -0.33);
  body.add(rig.leftHand);
  rig.magGrip.set(0, -0.02, 0);
  return rig;
}

// Pieces encore inutilisees par ces armes, gardees pour les suivantes.
void apertureSight;
void curvedMag;
void hoodedPost;
void redDotTube;
void rifleGrip;
void shotShell;
void sphere;
void plan;
void triggerBlade;
void holoSight;

/** Les armes de cette partie de l'arsenal, par identifiant. */
export const ARSENAL_2: Partial<Record<WeaponId, (s: Shop) => GunRig>> = {
  revolver,
  pm,
  carabine,
};
