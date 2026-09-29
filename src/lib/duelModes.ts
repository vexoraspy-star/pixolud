import type { DuelMapId } from "./duel";
import type { WeaponId } from "./duelWeapons";

/**
 * Les modes de jeu du Duel, et la grande carte de la Battle Royale.
 *
 * Le jeu n'avait qu'un mode : 1 contre 1 jusqu'a huit eliminations. C'est
 * tres bien pour se mesurer a quelqu'un, et ca ne vaut rien quand on est
 * seul. Les quatre modes ci-dessous couvrent des envies differentes :
 *
 *  - Duel        : le 1 contre 1 d'origine, en ligne ou contre la Sentinelle.
 *  - Match a mort: chacun pour soi contre quatre bots, sur la meme arene.
 *  - Armement    : chaque elimination change ton arme ; le premier a finir
 *                  les neuf armes gagne. Une seule mort ne coute rien, mais
 *                  se tromper d'arme au mauvais moment, si.
 *  - Zone        : personne ne reapparait, on ramasse ses armes au sol, et
 *                  le terrain se referme. Le dernier debout gagne.
 */

export type DuelModeId = "duel" | "deathmatch" | "armement" | "zone" | "economie" | "entrainement" | "construction";

/**
 * Economie facon Counter-Strike / Valorant : des manches, et entre chaque
 * manche une phase d'achat ou l'on depense l'argent gagne. Mourir fait
 * perdre son arme (retour au pistolet) : l'argent devient une vraie
 * decision — acheter maintenant, ou garder de quoi s'equiper la suivante.
 */
export interface DuelEconomy {
  startMoney: number;
  /** Plafond du portefeuille. */
  maxMoney: number;
  killReward: number;
  winReward: number;
  /** Prime de defaite : sans elle, le perdant ne peut plus jamais remonter. */
  lossReward: number;
  /** Duree de la phase d'achat, joueurs figes. */
  buySeconds: number;
  /** Pause apres la manche, avant la phase d'achat suivante. */
  roundEndSeconds: number;
}

/** Prix de chaque arme en mode Economie. Le pistolet est toujours gratuit. */
export const WEAPON_PRICES: Record<WeaponId, number> = {
  poings: 0,
  pistolet: 0,
  revolver: 700,
  pm: 1050,
  mitraillette: 1200,
  pompe: 1800,
  fusil: 2700,
  carabine: 3400,
  mitrailleuse: 4200,
  sniper: 4700,
  double: 1500,
  rafale: 2400,
  arbalete: 3000,
  roquettes: 5200,
};

export interface DuelMode {
  id: DuelModeId;
  name: string;
  tagline: string;
  /** Description longue, affichee dans le menu. */
  detail: string;
  /** Quelle carte : l'arene symetrique ou le grand terrain. */
  arena: "duel" | "zone";
  /** Nombre d'adversaires controles par l'ordinateur. */
  bots: number;
  /** Eliminations pour gagner. 0 = la victoire ne se compte pas en frags. */
  scoreToWin: number;
  /** Faux en Battle Royale : une mort est definitive. */
  respawn: boolean;
  startWeapon: WeaponId;
  /** Chaque elimination fait passer a l'arme suivante. */
  gunGame: boolean;
  /** Le terrain se referme et blesse ceux qui restent dehors. */
  shrinkingZone: boolean;
  /** Des armes trainent au sol et se ramassent. */
  loot: boolean;
  /** Accessible en ligne avec un code de salon. */
  online: boolean;
  /** Manches et phase d'achat. Absent : pas d'argent dans ce mode. */
  economy?: DuelEconomy;
  /** Stand d'entrainement : des cibles qui ne tirent pas, et un exercice chronometre. */
  training?: boolean;
  /** Carte imposee par le mode (sinon, celle choisie dans le salon). */
  map?: DuelMapId;
  /** Construction : touche F pour poser des murs de planches. */
  build?: boolean;
  /** Armes de depart, a la place de l'arme principale et du pistolet. */
  loadout?: WeaponId[];
  /**
   * Grenades de depart (et a chaque reapparition ou manche), pour le joueur
   * comme pour les bots. Absent : aucune au depart. En battle royale, elles
   * se ramassent au sol avec le reste du butin.
   */
  grenades?: { grenade: number; fumigene: number };
  /**
   * Armure donnee a chaque apparition (0 a ARMOR_MAX), au joueur comme aux
   * bots. Absent : aucune au depart. En Economie, elle s'achete a la place
   * (ARMOR_PRICES). Regle de chaque mode : voir « L'armure » plus bas.
   */
  startArmor?: number;
  /** Casque donne avec l'armure de depart : il protege aussi la tete. */
  startHelmet?: boolean;
}

export const DUEL_MODES: Record<DuelModeId, DuelMode> = {
  duel: {
    id: "duel",
    name: "Duel",
    tagline: "1 contre 1",
    detail:
      "L'arène symétrique, 8 éliminations pour gagner. Réapparition immédiate, fusil d'assaut pour tout le monde.",
    arena: "duel",
    bots: 1,
    scoreToWin: 8,
    respawn: true,
    startWeapon: "fusil",
    gunGame: false,
    shrinkingZone: false,
    loot: false,
    online: true,
    grenades: { grenade: 1, fumigene: 1 },
  },
  deathmatch: {
    id: "deathmatch",
    name: "Match à mort",
    tagline: "Chacun pour soi",
    detail:
      "Toi contre quatre Sentinelles, toutes ennemies entre elles aussi. 15 éliminations. Des armes traînent au sol. Tout le monde renaît avec gilet et casque.",
    arena: "duel",
    bots: 4,
    scoreToWin: 15,
    respawn: true,
    startWeapon: "fusil",
    gunGame: false,
    shrinkingZone: false,
    loot: true,
    online: false,
    grenades: { grenade: 2, fumigene: 1 },
    // Comme le match a mort des jeux du genre : tout le monde renait avec
    // gilet et casque, les tirs a la tete des bots forts comptent moins.
    startArmor: 100,
    startHelmet: true,
  },
  armement: {
    id: "armement",
    name: "Course à l'armement",
    tagline: "Neuf armes à enchaîner",
    detail:
      "Chaque élimination te fait passer à l'arme suivante, du pistolet au sniper en passant par le revolver, la mitrailleuse et la carabine. Le premier à finir les neuf gagne.",
    arena: "duel",
    bots: 3,
    scoreToWin: 5,
    respawn: true,
    startWeapon: "pistolet",
    gunGame: true,
    shrinkingZone: false,
    loot: false,
    online: false,
    // Pas de grenade explosive : une elimination doit se faire avec l'arme
    // du moment, c'est tout le principe de la course.
    grenades: { grenade: 0, fumigene: 1 },
  },
  zone: {
    id: "zone",
    name: "Battle royale",
    tagline: "Île géante · 30 joueurs",
    detail:
      "Trente joueurs sur une île géante aux quinze lieux nommés. Tu atterris les mains vides, un gilet sur le dos : fouille les bâtiments, trouve des armes et des soins, change d'arme selon la distance et survis à la zone. Une seule vie, le dernier debout gagne.",
    arena: "zone",
    bots: 29,
    scoreToWin: 0,
    respawn: false,
    startWeapon: "poings",
    gunGame: false,
    shrinkingZone: true,
    loot: true,
    online: false,
    // Un gilet sans casque pour chacun : il use les premiers echanges, et
    // comme il ne se ramasse pas, il ne se refait pas.
    startArmor: 100,
  },
  economie: {
    id: "economie",
    name: "Économie",
    tagline: "Achats et manches",
    detail:
      "Comme Counter-Strike ou Valorant : 1 contre 1 en manches, 7 manches pour gagner. Avant chaque manche, achète tes armes et ton armure avec l'argent gagné. Mourir fait perdre son arme et son armure.",
    arena: "duel",
    bots: 1,
    // Ici, le score compte les MANCHES gagnees.
    scoreToWin: 7,
    respawn: true,
    startWeapon: "pistolet",
    gunGame: false,
    shrinkingZone: false,
    loot: false,
    online: false,
    economy: {
      startMoney: 800,
      maxMoney: 9000,
      killReward: 300,
      winReward: 2500,
      lossReward: 1500,
      buySeconds: 10,
      roundEndSeconds: 2.4,
    },
    grenades: { grenade: 1, fumigene: 1 },
  },
  construction: {
    id: "construction",
    name: "1v1 Construction",
    tagline: "Buildfight",
    detail:
      "Un contre un sur un terrain ouvert. F pour construire, clic pour poser des murs (même en courant), clic droit pour retirer les tiens. Les balles les usent, le lance-roquettes les pulvérise. 5 éliminations.",
    arena: "duel",
    map: "chantier",
    bots: 1,
    scoreToWin: 5,
    respawn: true,
    startWeapon: "fusil",
    loadout: ["fusil", "pompe", "roquettes"],
    gunGame: false,
    shrinkingZone: false,
    loot: false,
    online: false,
    build: true,
    grenades: { grenade: 2, fumigene: 1 },
  },
  entrainement: {
    id: "entrainement",
    name: "Entraînement",
    tagline: "Visée et réflexes",
    detail:
      "Le stand de tir : cibles fixes, cibles mobiles, réflexes ou précision, une minute chacun. Munitions illimitées, toutes les armes au choix (1 à 0, Maj + chiffre pour les suivantes), et tes statistiques à la fin.",
    arena: "duel",
    bots: 4,
    scoreToWin: 0,
    respawn: true,
    startWeapon: "fusil",
    gunGame: false,
    shrinkingZone: false,
    loot: false,
    online: false,
    training: true,
  },
};

export const DUEL_MODE_ORDER: DuelModeId[] = ["zone", "duel", "construction", "deathmatch", "armement", "economie", "entrainement"];

/**
 * Partie infinie : pas de score a atteindre, on joue jusqu'a quitter. Seuls
 * les modes « aux eliminations » s'y pretent (pas les manches, ni la course
 * a l'armement, ni la battle royale).
 */
export function supportsInfinite(mode: DuelMode): boolean {
  return mode.scoreToWin > 0 && mode.respawn && !mode.economy && !mode.gunGame && !mode.training;
}

// ---------------------------------------------------------------- l'armure
/*
 * Qui porte de l'armure, selon le mode (champs startArmor / startHelmet) :
 *  - Economie      : rien au depart ; elle s'achete (gilet 650, gilet +
 *                    casque 1000), bots compris. Elle reste d'une manche a
 *                    l'autre si on survit, et se perd a la mort.
 *  - Match a mort  : gilet + casque a chaque apparition, pour tout le monde.
 *  - Battle royale : un gilet (sans casque) a l'atterrissage, pour tout le
 *                    monde. Il ne se ramasse pas au sol : use, il est perdu.
 *  - Duel, Course a l'armement, Construction : rien. Le duel reste un duel
 *    de visee aux degats d'origine (c'est aussi le seul mode en ligne), la
 *    course doit rester rapide, la construction a deja ses murs.
 *  - Entrainement  : les cibles ne tirent pas, l'armure n'y servirait a rien.
 * Un nouveau mode choisit sa regle avec startArmor / startHelmet (et hasArmor
 * decide si la case d'armure s'affiche).
 *
 * Les degats : tant qu'il reste de l'armure, elle prend une part de chaque
 * coup (ARMOR_ABSORB, selon l'arme) et s'use d'autant ; le reste va a la vie.
 *  - Tir a la tete : sans casque, l'armure ne compte pas ; avec casque, il
 *    retient la meme part qu'un gilet (un sniper tue encore d'une balle).
 *  - Couteau : le gilet n'en retient qu'un peu, et un coup dans le dos
 *    elimine toujours (ses degats depassent toute armure).
 *  - Grenade et roquette : le gilet amortit les eclats (ARMOR_BLAST_ABSORB).
 *  - La zone de la battle royale ignore l'armure.
 * Quand l'armure tombe a zero, le casque est perdu avec elle.
 */

/** Armure pleine : un gilet neuf. */
export const ARMOR_MAX = 100;

/** Les deux achats d'armure du mode Economie. */
export type ArmorItem = "gilet" | "casque";

/**
 * Ordre dans le menu d'achat. Au clavier, ils suivent les armes de la
 * boutique (aujourd'hui Maj+4 et Maj+5, voir shopKeyLabel).
 */
export const ARMOR_ITEMS: ArmorItem[] = ["gilet", "casque"];

/**
 * Prix en mode Economie. Le gilet coute a peu pres un revolver, le gilet +
 * casque un pistolet-mitrailleur : sur la premiere manche (800), il faut
 * choisir entre l'armure et une meilleure arme de poing.
 */
export const ARMOR_PRICES: Record<ArmorItem, number> = { gilet: 650, casque: 1000 };

export const ARMOR_NAMES: Record<ArmorItem, string> = { gilet: "Gilet", casque: "Gilet + casque" };

/** L'armure existe dans ce mode : achetee (Economie) ou donnee au depart. */
export function hasArmor(mode: DuelMode): boolean {
  return !mode.training && (Boolean(mode.economy) || (mode.startArmor ?? 0) > 0);
}

/**
 * Prix reel d'un achat d'armure, vu ce qu'on porte deja. 0 : rien a acheter.
 * Gilet deja intact : « gilet + casque » ne fait payer que le casque (350).
 * Casque deja porte : seul le gilet abime se rachete (650).
 * L'armure est comparee arrondie, comme elle s'affiche.
 */
export function armorCost(item: ArmorItem, armor: number, helmet: boolean): number {
  const vest = Math.round(armor) < ARMOR_MAX ? ARMOR_PRICES.gilet : 0;
  if (item === "gilet" || helmet) return vest;
  return vest + (ARMOR_PRICES.casque - ARMOR_PRICES.gilet);
}

/**
 * Part des degats que prend l'armure, arme par arme. Les petits calibres
 * (pistolet, pistolets-mitrailleurs) s'y ecrasent ; les fusils d'assaut y
 * perdent un tiers ; les balles de fusil de precision et les carreaux
 * d'arbalete la traversent presque ; une lame n'y trouve qu'un peu de prise
 * (poings : c'est l'arme du couteau) ; la roquette est une explosion.
 * Une arme absente du tableau prend ARMOR_ABSORB_DEFAULT.
 */
export const ARMOR_ABSORB: Partial<Record<WeaponId, number>> = {
  poings: 0.2,
  pistolet: 0.4,
  pm: 0.4,
  mitraillette: 0.35,
  pompe: 0.35,
  double: 0.35,
  rafale: 0.3,
  fusil: 0.3,
  mitrailleuse: 0.3,
  revolver: 0.2,
  carabine: 0.2,
  arbalete: 0.12,
  sniper: 0.1,
  roquettes: 0.4,
};
export const ARMOR_ABSORB_DEFAULT = 0.3;
/** Grenade et roquette : le gilet arrete une bonne part des eclats. */
export const ARMOR_BLAST_ABSORB = 0.4;

/**
 * Ce que l'armure encaisse d'un coup de `amount` degats (le reste va a la
 * vie, et l'armure perd exactement ce qu'elle encaisse). Jamais plus que
 * l'armure restante. `source` : l'arme du tireur, ou « explosion ».
 */
export function armorAbsorbed(
  amount: number,
  armor: number,
  helmet: boolean,
  source: WeaponId | "explosion",
  head: boolean,
): number {
  if (armor <= 0 || amount <= 0) return 0;
  // Sans casque, la tete n'est pas protegee du tout.
  if (head && !helmet) return 0;
  const ratio = source === "explosion" ? ARMOR_BLAST_ABSORB : (ARMOR_ABSORB[source] ?? ARMOR_ABSORB_DEFAULT);
  return Math.min(armor, amount * ratio);
}

/**
 * Le terrain de la Zone : 31x31, quatre fois l'arene du duel.
 *
 * Il est dessine autour de trois idees : des batiments fermes ou se planquer,
 * de longues avenues qui recompensent le sniper, et assez de diagonales pour
 * qu'on ne puisse jamais surveiller tout le monde. '$' marque un point
 * d'apparition, '*' un coffre d'armes.
 */
const ZONE_ROWS = [
  "###############################",
  "#$...........................$#",
  "#..####...........####........#",
  "#..#..#...*.......#..#...*....#",
  "#..#..#...##...##.#..#...###..#",
  "#..#.##...##...##.#.##...###..#",
  "#.........................#...#",
  "#...###.......#.#.......#####.#",
  "#...#..*......#.#.............#",
  "#...#..#####..#.#....####.....#",
  "#......#...#..#.#....#..#..*..#",
  "#..##..#...#..###....#..#..##.#",
  "#..##..##.##.........#.##..##.#",
  "#$...........*...............$#",
  "#..####....###.###....####....#",
  "#..#..#....#..*..#....#..#....#",
  "#..#..#....#.....#....#..#....#",
  "#..#.##....#..#..#....#.##....#",
  "#..........#.....#............#",
  "#....##.....##.##.......##....#",
  "#....##...*.............##..*.#",
  "#.............................#",
  "#..###...####.....####...###..#",
  "#....#...#..#..*..#..#...#....#",
  "#....#...#..#.....#..#...#....#",
  "#....#...#.##.....#.##...#....#",
  "#..###.................###....#",
  "#........*...........*........#",
  "#...#.##...........#.##.......#",
  "#$..#..#...........#..#......$#",
  "###############################",
];

export interface ZoneMap {
  width: number;
  height: number;
  walls: [number, number][];
  /** Apparitions dispersees aux quatre coins et sur les cotes. */
  spawns: [number, number][];
  /** Emplacements des armes a ramasser. */
  loot: [number, number][];
}

export function buildZoneMap(): ZoneMap {
  const walls: [number, number][] = [];
  const spawns: [number, number][] = [];
  const loot: [number, number][] = [];
  ZONE_ROWS.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c === "#") walls.push([x, y]);
      else if (c === "$") spawns.push([x, y]);
      else if (c === "*") loot.push([x, y]);
    }
  });
  return { width: ZONE_ROWS[0].length, height: ZONE_ROWS.length, walls, spawns, loot };
}

/** Duree totale du retrecissement de la zone, en secondes. */
export const ZONE_SHRINK_SECONDS = 165;
/** Le premier palier ne bouge pas : le temps de trouver une arme. */
export const ZONE_GRACE_SECONDS = 22;
/** Degats par seconde hors de la zone. Ca ne tue pas d'un coup, ca presse. */
export const ZONE_DAMAGE_PER_SECOND = 9;
/** Rayon final, en cases : assez petit pour forcer le dernier affrontement. */
export const ZONE_FINAL_RADIUS = 4.5;
