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
      "Toi contre quatre Sentinelles, toutes ennemies entre elles aussi. 15 éliminations. Des armes traînent au sol.",
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
      "Trente joueurs sur une île géante aux quinze lieux nommés. Tu atterris les mains vides : fouille les bâtiments, trouve des armes et des soins, change d'arme selon la distance et survis à la zone. Une seule vie, le dernier debout gagne.",
    arena: "zone",
    bots: 29,
    scoreToWin: 0,
    respawn: false,
    startWeapon: "poings",
    gunGame: false,
    shrinkingZone: true,
    loot: true,
    online: false,
  },
  economie: {
    id: "economie",
    name: "Économie",
    tagline: "Achats et manches",
    detail:
      "Comme Counter-Strike ou Valorant : 1 contre 1 en manches, 7 manches pour gagner. Avant chaque manche, achète tes armes avec l'argent gagné. Mourir fait perdre son arme.",
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
