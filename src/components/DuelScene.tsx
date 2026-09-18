"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import {
  buildDuelMap,
  DUEL_CELL,
  DUEL_WALL_HEIGHT,
  DUEL_MOVE_SPEED,
  DUEL_PLAYER_RADIUS,
  DUEL_EYE_HEIGHT,
  DUEL_MAX_HP,
  DUEL_RESPAWN_SECONDS,
  DUEL_BODY_RADIUS,
  DUEL_HEAD_Y,
  DUEL_HEAD_RADIUS,
  DUEL_NET_HZ,
  type DuelMapId,
  type DuelSide,
  type DuelTheme,
} from "@/lib/duel";
import { buildDuelDecor } from "@/lib/duelDecor";
import { RARITY, SKINS, type SkinId } from "@/lib/duelProfile";
import { createGridPather } from "@/lib/duelPath";
import {
  buildIsland,
  nearestOpenCell,
  ISLAND_DROP_HEIGHT,
  ISLAND_DROP_SECONDS,
  ISLAND_FINAL_RADIUS,
  ISLAND_GRACE_SECONDS,
  ISLAND_SHRINK_SECONDS,
} from "@/lib/duelIsland";
import IslandMapView from "./IslandMapView";
import {
  DUEL_MODES,
  ZONE_DAMAGE_PER_SECOND,
  WEAPON_PRICES,
  type DuelModeId,
} from "@/lib/duelModes";
import {
  WEAPONS,
  GUN_GAME_ORDER,
  LOOT_TABLE,
  SHOP_ORDER,
  WEAPON_RARITY,
  buildWeaponModel,
  rollLootWeapon,
  type WeaponId,
  type WeaponLook,
  type WeaponModel,
} from "@/lib/duelWeapons";
import { buildSoldier, poseSoldier, type SoldierParts } from "@/lib/duelSoldier";
import { createDuelEffects } from "@/lib/duelEffects";
import {
  makeArenaWallTexture,
  makeArenaFloorTexture,
  makeArenaCeilingTexture,
  makeIslandGroundTexture,
} from "@/lib/duelTextures";
import {
  createDuelAudio,
  playShot,
  playImpact,
  playHitmarker,
  playHeadshot,
  playHurt,
  playDeath,
  playReload,
  playDryFire,
  playDuelStep,
  playRespawn,
  playMatchEnd,
} from "@/lib/duelAudio";
import { loadLayout3D, loadQuality3D, loadSensitivity3D, type Quality3D } from "@/lib/settings3d";
import {
  BOT_LEVELS,
  DEFAULT_DUEL_OPTIONS,
  loadDuelOptions,
  saveDuelOptions,
  type DuelOptions,
} from "@/lib/duelOptions";
import DuelCrosshair from "./DuelCrosshair";
import { createAnimatedModel, type AnimatedModel } from "@/lib/models3d";
import DuelOptionsPanel from "./DuelOptionsPanel";
import DuelAdminPanel from "./DuelAdminPanel";
import { DRILLS, trainingScore, type DrillId, type TrainingResult } from "@/lib/duelTraining";
import { NO_CHEATS, anyCheat, type DuelCheats } from "@/lib/duelCheats";
import { DANCES, DANCE_ORDER, createDancer, type DanceId, type Dancer } from "@/lib/duelDances";
import Game3DSettings from "./Game3DSettings";

/** Boite aux lettres partagee avec le parent : aucune mise a jour React par paquet recu. */
export interface DuelLink {
  remote: {
    x: number;
    z: number;
    yaw: number;
    pitch?: number;
    hp: number;
    dead: boolean;
    moving: boolean;
    weapon?: WeaponId;
    /** Tenue de l'adversaire : on le voit tel qu'il s'est habille. */
    skin?: SkinId;
  } | null;
  inbox: { event: string; payload: Record<string, unknown> }[];
  send: (event: string, payload: Record<string, unknown>) => void;
}

/** Ce que la fin de partie rapporte en plus du score. */
export interface MatchExtra {
  /** Statistiques du stand d'entrainement. */
  training?: TrainingResult;
  /** Une triche du mode admin a servi : pas de recompense. */
  cheated?: boolean;
}

interface KillFeedEntry {
  id: number;
  text: string;
  mine: boolean;
}

const LOOK_SENSITIVITY = 0.0034;

/** Couleurs d'equipe : elles doivent rester distinctes dans la penombre. */
const ENEMY_COLORS = [0xd93b2b, 0xd9852b, 0xa93bd9, 0x2bb5d9, 0x6ad93b];
const BOT_NAMES = [
  "Sentinelle",
  "Vigile",
  "Spectre",
  "Rôdeur",
  "Écho",
  "Faucheur",
  "Corsaire",
  "Orage",
  "Lynx",
  "Brasier",
  "Nomade",
  "Vortex",
  "Comète",
  "Taïga",
  "Mirage",
  "Granit",
  "Sirocco",
  "Blizzard",
  "Cobra",
  "Falcon",
  "Onyx",
  "Pixel",
  "Rafale",
  "Zénith",
  "Kraken",
  "Nova",
  "Titan",
  "Loup",
  "Éclipse",
  "Raptor",
];

/** Un emplacement d'inventaire : l'arme, et son chargeur tel qu'on l'a laisse. */
interface Slot {
  weapon: WeaponId;
  mag: number;
}
/** Trois armes au plus ; les mains vides, ce sont les poings. */
const MAX_SLOTS = 3;
/** Temps pour sortir une autre arme : on ne tire pas pendant le geste. */
const SWAP_SECONDS = 0.32;
/** Armes de poing : en Economie, elles ont leur propre emplacement. */
const isSidearm = (id: WeaponId) => id === "pistolet" || id === "revolver";

// La battle royale se joue sur l'ile : ses durees remplacent celles de
// l'ancien terrain de la Zone.
const ZONE_SHRINK_SECONDS = ISLAND_SHRINK_SECONDS;
const ZONE_GRACE_SECONDS = ISLAND_GRACE_SECONDS;
const ZONE_FINAL_RADIUS = ISLAND_FINAL_RADIUS;

/**
 * L'IA, reglee par simulation puis par essais : elle doit etre battable en
 * bougeant et mortelle si on reste plante. Chaque bot tire selon la FICHE de
 * son arme, donc un bot au fusil a pompe doit venir au contact comme toi.
 */
/**
 * Delai de reference, utilise seulement au sortir d'une phase d'achat : la
 * reaction reelle des bots vient du niveau de difficulte choisi par le
 * joueur (voir BOT_LEVELS dans duelOptions).
 */
const BOT_REACTION = 0.5;
/**
 * Plafond de degats en melee.
 *
 * Sans lui, quatre bots qui te voient en meme temps te tuent en 1,2 seconde :
 * chacun est reglable, mais leur SOMME ne l'est pas. Apres un coup au but,
 * plus aucun bot ne peut te toucher pendant ce delai, qui s'allonge avec le
 * nombre d'assaillants. Une prise a partie reste mortelle (moins de 3 s),
 * mais on a le temps de rompre le contact.
 */
function hitLockFor(attackers: number) {
  return 0.12 + 0.11 * Math.max(0, attackers - 1);
}
/**
 * Entre bots, les coups portent moins : reglee sur le joueur, leur precision
 * vidait une battle royale de trente en une minute. Le joueur, lui, subit les
 * degats pleins — la difficulte choisie reste la sienne.
 */
const BOT_VS_BOT_DAMAGE = 0.4;
/** Il change de direction de pas de cote a peu pres tous ces temps-la. */
const BOT_STRAFE_SECONDS = 1.1;
/**
 * Invulnerabilite apres une apparition. Sans elle, naitre dans la ligne de
 * mire de quatre bots coute la moitie de sa vie avant d'avoir bouge le
 * premier doigt — ce n'est pas de la difficulte, c'est une punition.
 */
const SPAWN_PROTECT = 1.6;

export default function DuelScene({
  side,
  opponentName,
  bot,
  mode: modeId,
  mapId = "arene",
  link,
  look,
  skin,
  seed = 1,
  devAllowed = false,
  drill = "fixes",
  dances = ["salut"],
  onMatchEnd,
}: {
  side: DuelSide;
  opponentName: string;
  bot: boolean;
  mode: DuelModeId;
  /** Carte de l'arene (ignoree en Zone, qui a son propre terrain). */
  mapId?: DuelMapId;
  /** Ref vers la boite aux lettres reseau : on ne la lit que dans l'effet. */
  link: RefObject<DuelLink>;
  /** Camouflage de l'arme et couleurs de la tenue sur les mains. */
  look?: WeaponLook;
  /** Tenue du joueur, envoyee a l'adversaire en ligne. */
  skin?: SkinId;
  /** Graine de l'ile en battle royale : une nouvelle ile a chaque partie. */
  seed?: number;
  /** Compte admin : triches du mode admin (F2), jamais en ligne. */
  devAllowed?: boolean;
  /** Entrainement : l'exercice choisi. */
  drill?: DrillId;
  /** Danses possedees, dans le menu des danses (G). */
  dances?: DanceId[];
  onMatchEnd: (win: boolean, myScore: number, oppScore: number, rank?: number, extra?: MatchExtra) => void;
}) {
  const mode = DUEL_MODES[modeId];
  const training = mode.training ? DRILLS[drill] : null;
  /** Le mode admin ne sert qu'en solo : jamais contre une vraie personne. */
  const adminEnabled = devAllowed && bot;
  const containerRef = useRef<HTMLDivElement>(null);
  const [hp, setHp] = useState(DUEL_MAX_HP);
  const [ammo, setAmmo] = useState(WEAPONS[mode.startWeapon].magSize);
  const [magSize, setMagSize] = useState(WEAPONS[mode.startWeapon].magSize);
  const [weaponName, setWeaponName] = useState(WEAPONS[mode.startWeapon].short);
  const [reloading, setReloading] = useState(false);
  const [myScore, setMyScore] = useState(0);
  const [bestRival, setBestRival] = useState(0);
  const [respawnIn, setRespawnIn] = useState(0);
  const [hitMarker, setHitMarker] = useState(0);
  const [damageFlash, setDamageFlash] = useState(0);
  const [damageFrom, setDamageFrom] = useState<number | null>(null);
  const [feed, setFeed] = useState<KillFeedEntry[]>([]);
  const [locked, setLocked] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [pickupToast, setPickupToast] = useState<string | null>(null);
  /** Les armes portees (1 a 3) et celle en main ; -1 = mains nues. */
  const [inventory, setInventory] = useState<{ slots: WeaponId[]; cur: number }>({ slots: [], cur: -1 });
  /** Arme ou soin au sol quand l'inventaire est plein : « E pour echanger ». */
  const [pickupHint, setPickupHint] = useState<string | null>(null);
  /** Battle royale : combattants encore en vie, et si on est hors zone. */
  const [alive, setAlive] = useState(mode.bots + 1);
  const [outsideZone, setOutsideZone] = useState(false);
  const [zoneLeft, setZoneLeft] = useState(ZONE_SHRINK_SECONDS);
  /** Battle royale : l'ile de cette partie, la meme pour la carte et pour la scene. */
  const island = useMemo(() => (mode.arena === "zone" ? buildIsland(seed) : null), [mode.arena, seed]);
  const [dropOpen, setDropOpen] = useState(mode.arena === "zone");
  const [dropLeft, setDropLeft] = useState(ISLAND_DROP_SECONDS);
  const [fallMeters, setFallMeters] = useState(0);
  const [bigMap, setBigMap] = useState(false);
  const [radar, setRadar] = useState<{ me: [number, number]; yaw: number; blips: [number, number][]; zone: [number, number, number] | null; all?: [number, number][] }>({
    me: [0, 0],
    yaw: 0,
    blips: [],
    zone: null,
  });

  const [touchDevice, setTouchDevice] = useState(false);
  /** Reglages du joueur : reticule, laser, affichage, difficulte des bots. */
  const [options, setOptions] = useState<DuelOptions>(DEFAULT_DUEL_OPTIONS);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [fps, setFps] = useState(0);
  const [ping, setPing] = useState<number | null>(null);
  /** Ouverture du reticule : course, saut de recul, tir. */
  const [spread, setSpread] = useState(0);
  /** Mode Economie : argent, manche en cours, phase d'achat et boutique. */
  const [money, setMoney] = useState(mode.economy?.startMoney ?? 0);
  const [round, setRound] = useState(1);
  const [buyLeft, setBuyLeft] = useState(mode.economy?.buySeconds ?? 0);
  const [shopOpen, setShopOpen] = useState(Boolean(mode.economy));
  const [roundBanner, setRoundBanner] = useState<string | null>(null);
  /** Entrainement : temps restant, score, precision, compte a rebours. */
  const [trainingHud, setTrainingHud] = useState<{ left: number; score: number; kills: number; accuracy: number; countdown: number } | null>(null);
  /** Mode admin : triches actives et panneau. */
  const [cheats, setCheats] = useState<DuelCheats>(NO_CHEATS);
  const cheatsRef = useRef<DuelCheats>(NO_CHEATS);
  const [adminOpen, setAdminOpen] = useState(false);
  /** Vision a travers les murs : etiquettes a l'ecran (en % de l'ecran). */
  const [espTags, setEspTags] = useState<{ id: number; x: number; y: number; name: string; hp: number; dist: number }[]>([]);
  /** Danses : le menu (touche G) et la danse en cours. */
  const [emoteMenu, setEmoteMenu] = useState(false);
  const emoteMenuRef = useRef(false);
  const [emoting, setEmoting] = useState<DanceId | null>(null);
  const dancesRef = useRef<DanceId[]>(dances);

  const onMatchEndRef = useRef(onMatchEnd);
  // La boucle 3D lit les reglages a chaque image : une ref, pas un etat, pour
  // ne pas relancer la scene a chaque case cochee.
  const optionsRef = useRef<DuelOptions>(DEFAULT_DUEL_OPTIONS);
  const sensitivityRef = useRef(1.5);
  const layoutRef = useRef<{ current: "azerty" | "qwerty" } | null>(null);
  const touchRef = useRef({ moveX: 0, moveZ: 0, firing: false });
  const sceneApiRef = useRef<{
    reload: () => void;
    zoom: () => void;
    applyQuality: (value: Quality3D) => void;
    buy: (id: WeaponId) => void;
    drop: (x: number, z: number) => void;
    admin: (action: "tuer" | "soigner" | "zone" | "armes") => void;
    teleport: (x: number, z: number) => void;
    emote: (id: DanceId) => void;
  } | null>(null);
  const stickOrigin = useRef<{ x: number; y: number } | null>(null);
  const [stickOffset, setStickOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const t = setTimeout(() => {
      setTouchDevice(
        typeof window !== "undefined" &&
          (window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window),
      );
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    onMatchEndRef.current = onMatchEnd;
  }, [onMatchEnd]);
  useEffect(() => {
    dancesRef.current = dances;
  }, [dances]);

  function changeCheats(next: DuelCheats) {
    setCheats(next);
    cheatsRef.current = next;
  }
  function toggleEmoteMenu(open: boolean) {
    emoteMenuRef.current = open;
    setEmoteMenu(open);
  }
  useEffect(() => {
    const t = setTimeout(() => {
      const saved = loadDuelOptions();
      setOptions(saved);
      optionsRef.current = saved;
    }, 0);
    return () => clearTimeout(t);
  }, []);

  function changeOptions(next: DuelOptions) {
    setOptions(next);
    optionsRef.current = next;
    saveDuelOptions(next);
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const layout = { current: loadLayout3D() };
    layoutRef.current = layout;
    const sensitivity = sensitivityRef;
    sensitivity.current = loadSensitivity3D();

    // ------------------------------------------------------------ la carte
    const useZone = mode.arena === "zone";
    /** Combattants controles par l'ordinateur : des cibles a l'entrainement. */
    const botCount = training ? training.targets : mode.bots;
    const zoneMap = island
      ? { width: island.width, height: island.height, walls: island.walls, spawns: island.spawns, loot: island.loot }
      : null;
    const duelMap = useZone ? null : buildDuelMap(mapId);
    const mapW = zoneMap?.width ?? duelMap!.width;
    const mapH = zoneMap?.height ?? duelMap!.height;
    const mapWalls = zoneMap?.walls ?? duelMap!.walls;
    // L'habillage suit la carte : metal bleute, hangar, roche ou gres.
    const theme: DuelTheme = island ? "ile" : (duelMap?.theme ?? "arene");
    const crateSet = new Set((duelMap?.crates ?? []).map(([x, y]) => `${x},${y}`));
    // Grille pleine en octets : les collisions, lignes de vue et chemins la
    // lisent des milliers de fois par image. Un Set de cles texte suffisait
    // sur l'arene, pas sur une ile de 150 cases avec trente combattants.
    const solidGrid = new Uint8Array(mapW * mapH);
    for (const [wx, wy] of mapWalls) solidGrid[wy * mapW + wx] = 1;
    const isSolid = (cx: number, cy: number) =>
      cx < 0 || cy < 0 || cx >= mapW || cy >= mapH || solidGrid[cy * mapW + cx] === 1;
    const pather = createGridPather(mapW, mapH, solidGrid);

    /**
     * Points d'apparition bien repartis.
     *
     * L'arene du duel n'en compte que quatre, un par coin : avec quatre bots,
     * tout le monde nait a portee de tir de tout le monde. On complete donc
     * la liste par echantillonnage du plus loin — on ajoute a chaque tour la
     * case ouverte la plus eloignee de tous les points deja retenus.
     */
    function spreadSpawns(seeds: [number, number][], wanted: number): [number, number][] {
      const open: [number, number][] = [];
      for (let y = 0; y < mapH; y++)
        for (let x = 0; x < mapW; x++) if (!isSolid(x, y)) open.push([x, y]);
      const chosen: [number, number][] = [...seeds];
      while (chosen.length < wanted && chosen.length < open.length) {
        let best = open[0];
        let bestDist = -1;
        for (const c of open) {
          let nearest = Infinity;
          for (const s of chosen) {
            nearest = Math.min(nearest, Math.hypot(c[0] - s[0], c[1] - s[1]));
          }
          if (nearest > bestDist) {
            bestDist = nearest;
            best = c;
          }
        }
        chosen.push(best);
      }
      return chosen;
    }

    /** Toutes les apparitions disponibles, melangees pour ce match. */
    const seedSpawns: [number, number][] = zoneMap
      ? [...zoneMap.spawns]
      : [...duelMap!.spawns.a, ...duelMap!.spawns.b];
    // Il faut au moins une apparition par combattant, et de la marge pour
    // que la reapparition puisse choisir la plus eloignee du danger.
    const allSpawns = spreadSpawns(seedSpawns, Math.max(seedSpawns.length, (botCount + 1) * 2));
    const mySpawnPool: [number, number][] =
      botCount > 1 || zoneMap ? allSpawns : duelMap!.spawns[side];
    const enemySpawnPool: [number, number][] =
      botCount > 1 || zoneMap ? allSpawns : duelMap!.spawns[side === "a" ? "b" : "a"];

    // -------------------------------------------------------------- le joueur
    /**
     * Entrainement : on se place sur la case la plus degagee de la carte,
     * celle d'ou l'on voit le plus de sol a bonne distance de tir. Une
     * apparition de coin ne laissait voir qu'un couloir.
     */
    function openestCell(minD: number, maxD: number): [number, number] {
      let best: [number, number] = mySpawnPool[0];
      let bestScore = -1;
      for (let cz = 1; cz < mapH - 1; cz += 2) {
        for (let cx = 1; cx < mapW - 1; cx += 2) {
          if (isSolid(cx, cz)) continue;
          let score = 0;
          for (let tz = 0; tz < mapH; tz += 2) {
            for (let tx = 0; tx < mapW; tx += 2) {
              const d = Math.hypot(tx - cx, tz - cz);
              if (d < minD || d > maxD || isSolid(tx, tz)) continue;
              if (hasLineOfSight(cx + 0.5, cz + 0.5, tx + 0.5, tz + 0.5)) score++;
            }
          }
          if (score > bestScore) {
            bestScore = score;
            best = [cx, cz];
          }
        }
      }
      return best;
    }
    const firstSpawn = training ? openestCell(training.minDist, training.maxDist) : mySpawnPool[0];
    /** Le regard vaut (-sin yaw, -cos yaw) : on garde le cap qui porte le plus loin. */
    function openestYaw(x: number, z: number): number {
      let best = 0;
      let bestD = -1;
      for (let i = 0; i < 32; i++) {
        const yaw = (i / 32) * Math.PI * 2;
        const d = rayWallDistance(x, z, -Math.sin(yaw), -Math.cos(yaw), 30);
        if (d > bestD) {
          bestD = d;
          best = yaw;
        }
      }
      return best;
    }
    /**
     * Inventaire de depart. Arme principale et pistolet dans les modes
     * classiques ; une seule arme en course a l'armement (c'est le principe) ;
     * rien du tout en battle royale.
     */
    function startingInventory(): Slot[] {
      if (mode.startWeapon === "poings") return [];
      const inv: Slot[] = [{ weapon: mode.startWeapon, mag: WEAPONS[mode.startWeapon].magSize }];
      if (!mode.gunGame && mode.startWeapon !== "pistolet") inv.push({ weapon: "pistolet", mag: WEAPONS.pistolet.magSize });
      return inv;
    }
    const me = {
      inv: startingInventory(),
      /** Emplacement tenu en main. */
      cur: 0,
      x: firstSpawn[0] + 0.5,
      z: firstSpawn[1] + 0.5,
      // Entrainement : face a la plus longue ligne de vue.
      yaw: training
        ? openestYaw(firstSpawn[0] + 0.5, firstSpawn[1] + 0.5)
        : side === "a"
          ? -Math.PI * 0.75
          : Math.PI * 0.25,
      pitch: 0,
      hp: DUEL_MAX_HP,
      dead: false,
      alive: true,
      respawnAt: 0,
      mag: WEAPONS[mode.startWeapon].magSize,
      reloadUntil: 0,
      nextShotAt: 0,
      score: 0,
      weapon: mode.startWeapon as WeaponId,
      /** Course a l'armement : rang atteint dans GUN_GAME_ORDER. */
      rank: 0,
      /** Tant que ce temps n'est pas passe, on ne peut pas etre touche. */
      safeUntil: training ? Infinity : SPAWN_PROTECT,
    };

    // ------------------------------------------------------------- la scene
    const scene = new THREE.Scene();
    // L'ile se joue en plein jour sous un ciel bleu ; les arenes restent sombres.
    const skyColor = island ? 0x9fd4ff : 0x0d1014;
    scene.background = new THREE.Color(skyColor);
    scene.fog = new THREE.Fog(skyColor, (island ? 24 : 16) * DUEL_CELL, (island ? 64 : 30) * DUEL_CELL);

    const BASE_FOV = 82;
    const camera = new THREE.PerspectiveCamera(
      BASE_FOV,
      container.clientWidth / container.clientHeight,
      0.05,
      200,
    );
    camera.rotation.order = "YXZ";

    // Qualite graphique : "performance" coupe l'anticrenelage (fixe a la
    // creation, donc valable au prochain match) et plafonne plus bas la
    // resolution reelle (modifiable en pleine partie, elle).
    let quality: Quality3D = loadQuality3D();
    const pixelRatioCap = () => Math.min(window.devicePixelRatio, quality === "performance" ? 1 : 2);
    const renderer = new THREE.WebGLRenderer({ antialias: quality !== "performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(pixelRatioCap());
    container.appendChild(renderer.domElement);
    scene.add(camera);

    // Eclairage volontairement simple : l'arene doit rester LISIBLE, c'est
    // un jeu de tir, pas un jeu d'ambiance.
    // L'eclairage change avec le lieu : neon bleute dans l'Arene, jour filtre
    // dans l'Entrepot, lampes chaudes au Gouffre, plein soleil sur Poussiere.
    const LIGHTS: Record<DuelTheme, { sky: number; ground: number; power: number; key: number; fill: number }> = {
      arene: { sky: 0xb6c9dd, ground: 0x2a3138, power: 2.7, key: 0xd6f0ff, fill: 0x8fb4d8 },
      entrepot: { sky: 0xd8dcd6, ground: 0x32332e, power: 2.5, key: 0xfff3d6, fill: 0x9fb0bd },
      gouffre: { sky: 0x8f8778, ground: 0x1a1714, power: 2.2, key: 0xffd9a0, fill: 0x6d7a88 },
      poussiere: { sky: 0xffe6b8, ground: 0x6b5637, power: 2.8, key: 0xfff0c8, fill: 0xc9b089 },
      ile: { sky: 0xe8f6ff, ground: 0x4a6a3a, power: 2.6, key: 0xfff4dc, fill: 0xb8d4ea },
    };
    const lightPlan = LIGHTS[theme];
    scene.add(new THREE.HemisphereLight(lightPlan.sky, lightPlan.ground, lightPlan.power));
    const key = new THREE.DirectionalLight(lightPlan.key, 0.9);
    key.position.set(12, 24, 8);
    scene.add(key);
    const fill = new THREE.DirectionalLight(lightPlan.fill, 0.5);
    fill.position.set(-14, 18, -10);
    scene.add(fill);

    const worldW = mapW * DUEL_CELL;
    const worldH = mapH * DUEL_CELL;

    const floorTex = island ? makeIslandGroundTexture(island) : makeArenaFloorTexture(mapW, mapH, theme);
    floorTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const floorMat = new THREE.MeshLambertMaterial({ map: floorTex });
    const floorGeo = new THREE.PlaneGeometry(worldW, worldH);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(worldW / 2, 0, worldH / 2);
    scene.add(floor);
    // Autour de l'ile : la mer jusqu'a l'horizon.
    let sea: THREE.Mesh | null = null;
    if (island) {
      sea = new THREE.Mesh(
        new THREE.PlaneGeometry(worldW * 4, worldH * 4),
        new THREE.MeshLambertMaterial({ color: 0x2f8fd0 }),
      );
      sea.rotation.x = -Math.PI / 2;
      sea.position.set(worldW / 2, -0.04, worldH / 2);
      scene.add(sea);
    }

    // La Zone se joue a ciel ouvert : un plafond sur un terrain de 31x31
    // enfermerait la partie et masquerait les trajectoires de sniper.
    const ceilingGeo = new THREE.PlaneGeometry(worldW, worldH);
    const ceilingTex = makeArenaCeilingTexture(mapW, mapH, theme);
    const ceilingMat = new THREE.MeshLambertMaterial({ map: ceilingTex });
    let ceiling: THREE.Mesh | null = null;
    if (!useZone) {
      ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
      ceiling.rotation.x = Math.PI / 2;
      ceiling.position.set(worldW / 2, DUEL_WALL_HEIGHT, worldH / 2);
      scene.add(ceiling);
    }

    const wallGeo = new THREE.BoxGeometry(DUEL_CELL, DUEL_WALL_HEIGHT, DUEL_CELL);
    const wallTex = makeArenaWallTexture(theme);
    const wallMat = new THREE.MeshLambertMaterial({ map: wallTex });
    // Les caisses sont des cases pleines comme les autres, mais dessinees par
    // le decor : on les sort donc du maillage des murs.
    const plainWalls = island ? island.structures : mapWalls.filter(([wx, wy]) => !crateSet.has(`${wx},${wy}`));
    const wallMesh = new THREE.InstancedMesh(wallGeo, wallMat, Math.max(1, plainWalls.length));
    const mat4 = new THREE.Matrix4();
    plainWalls.forEach(([wx, wy], i) => {
      mat4.makeTranslation((wx + 0.5) * DUEL_CELL, DUEL_WALL_HEIGHT / 2, (wy + 0.5) * DUEL_CELL);
      wallMesh.setMatrixAt(i, mat4);
    });
    wallMesh.count = plainWalls.length;
    scene.add(wallMesh);

    // Caisses empilees, bidons, sacs de sable et lettres de site peintes au
    // sol : c'est ce qui donne son caractere a chaque carte.
    const decor = duelMap
      ? buildDuelDecor(duelMap, DUEL_CELL, DUEL_WALL_HEIGHT)
      : island
        ? buildDuelDecor(
            {
              width: island.width,
              height: island.height,
              walls: [...island.structures, ...island.crates],
              crates: island.crates,
              marks: [],
              spawns: { a: [], b: [] },
              theme: "ile",
              trees: island.trees,
            },
            DUEL_CELL,
            DUEL_WALL_HEIGHT,
          )
        : null;
    if (decor) scene.add(decor.group);

    const effects = createDuelEffects(scene);

    // ------------------------------------------------------ mur de la zone
    // Un cylindre bleu translucide : on doit voir a travers, mais savoir tout
    // de suite de quel cote on se trouve.
    const zoneGeo = new THREE.CylinderGeometry(1, 1, DUEL_WALL_HEIGHT * 2.4, 48, 1, true);
    const zoneMat = new THREE.MeshBasicMaterial({
      color: 0x49b6ff,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const zoneMesh = new THREE.Mesh(zoneGeo, zoneMat);
    zoneMesh.visible = false;
    scene.add(zoneMesh);

    const zoneCenter = { x: mapW / 2, z: mapH / 2 };
    let zoneRadius = Math.max(mapW, mapH);
    // Le centre final est tire au sort, decale du milieu : deux parties ne se
    // finissent jamais au meme endroit.
    const finalCenter = {
      x: mapW / 2 + (Math.random() - 0.5) * mapW * 0.3,
      z: mapH / 2 + (Math.random() - 0.5) * mapH * 0.3,
    };
    // Le rayon de depart doit contenir TOUTES les apparitions avec de la
    // marge : un premier jet a 0.72 x la largeur laissait les coins dehors
    // des les premieres secondes, et la zone tuait la moitie des bots avant
    // le premier echange de tirs.
    const farthestSpawn = allSpawns.reduce(
      (max, [sx, sz]) => Math.max(max, Math.hypot(sx + 0.5 - mapW / 2, sz + 0.5 - mapH / 2)),
      0,
    );
    const startRadius = island ? island.radius * 1.08 : farthestSpawn * 1.3;

    // --------------------------------------------------- armes du joueur
    // Les cinq modeles sont construits d'avance : basculer d'une arme a
    // l'autre ne doit pas provoquer de micro-coupure en plein duel. Une arme
    // invisible ne coute aucun appel de rendu.
    const weaponModels = {} as Record<WeaponId, WeaponModel>;
    for (const id of Object.keys(WEAPONS) as WeaponId[]) {
      const wm = buildWeaponModel(id, look);
      wm.group.visible = false;
      camera.add(wm.group);
      weaponModels[id] = wm;
    }
    // Arme un peu plus presente a l'ecran depuis qu'elle a des mains : trop
    // petite, on ne voyait ni les doigts ni la culasse qui recule.
    // --- Viseur laser (optionnel) ---
    // Un rayon fin depuis le canon, et le point rouge la ou il touche. Il
    // part du canon et pas de l'oeil : de pres, le point est donc legerement
    // decale, exactement comme un vrai laser monte sous l'arme.
    const laserMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.35, depthWrite: false });
    const laserGeo = new THREE.CylinderGeometry(0.006, 0.006, 1, 5, 1, true);
    const laserBeam = new THREE.Mesh(laserGeo, laserMat);
    laserBeam.visible = false;
    scene.add(laserBeam);
    const laserDotMat = new THREE.MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: 0.9, depthWrite: false });
    const laserDotGeo = new THREE.SphereGeometry(0.035, 8, 6);
    const laserDot = new THREE.Mesh(laserDotGeo, laserDotMat);
    laserDot.visible = false;
    scene.add(laserDot);
    const laserFrom = new THREE.Vector3();
    const laserTo = new THREE.Vector3();
    const laserDir = new THREE.Vector3();
    const laserUp = new THREE.Vector3(0, 1, 0);

    const GUN_BASE = new THREE.Vector3(0.21, -0.18, -0.62);
    function applyWeaponTransform() {
      for (const id of Object.keys(weaponModels) as WeaponId[]) {
        const g = weaponModels[id].group;
        g.position.copy(GUN_BASE);
        g.rotation.set(0, -0.06, 0);
        g.scale.setScalar(0.66);
        g.visible = id === me.weapon;
      }
    }
    applyWeaponTransform();
    const currentModel = () => weaponModels[me.weapon];

    /** L'arme tenue et l'inventaire, tels que l'interface les affiche. */
    function syncWeaponUi() {
      const spec = WEAPONS[me.weapon];
      setAmmo(me.mag);
      setMagSize(spec.magSize);
      setWeaponName(spec.short);
      setReloading(me.reloadUntil > 0);
      setInventory({ slots: me.inv.map((s) => s.weapon), cur: me.inv.length > 0 ? me.cur : -1 });
    }

    function announceWeapon(id: WeaponId) {
      setPickupToast(WEAPONS[id].name);
      window.setTimeout(() => setPickupToast(null), 1600);
    }

    /**
     * Sort l'arme d'un emplacement (les poings si l'inventaire est vide). Le
     * chargeur de l'arme rangee est garde : changer d'arme n'est pas recharger.
     */
    function equipSlot(index: number, announce = false, saveCurrent = true) {
      if (saveCurrent && me.inv[me.cur]) me.inv[me.cur].mag = me.mag;
      const slot = me.inv[index];
      me.cur = slot ? index : 0;
      me.weapon = slot ? slot.weapon : "poings";
      me.mag = slot ? slot.mag : 0;
      me.reloadUntil = 0;
      me.nextShotAt = Math.max(me.nextShotAt, elapsed + SWAP_SECONDS);
      if (isZoomed) toggleZoom(false);
      applyWeaponTransform();
      syncWeaponUi();
      if (announce) announceWeapon(me.weapon);
    }

    function cycleWeapon(dir: number) {
      if (me.inv.length < 2) return;
      equipSlot((me.cur + dir + me.inv.length) % me.inv.length);
    }

    /**
     * Une arme ramassee ou recue. Deja dans l'inventaire : on recharge son
     * chargeur. Une place libre : elle y va, en main. Inventaire plein : rien
     * (le joueur choisit avec E ce qu'il lache).
     */
    function giveWeapon(id: WeaponId): "ajout" | "recharge" | "plein" {
      if (id === "poings") return "plein";
      const spec = WEAPONS[id];
      const have = me.inv.findIndex((s) => s.weapon === id);
      if (have >= 0) {
        me.inv[have].mag = spec.magSize;
        if (have === me.cur) me.mag = spec.magSize;
        syncWeaponUi();
        return "recharge";
      }
      if (me.inv.length >= MAX_SLOTS) return "plein";
      if (me.inv[me.cur]) me.inv[me.cur].mag = me.mag;
      me.inv.push({ weapon: id, mag: spec.magSize });
      equipSlot(me.inv.length - 1, true, false);
      return "ajout";
    }

    /** Remplace l'arme en main par une autre (echange au sol, achat). */
    function replaceCurrent(id: WeaponId, announce = true) {
      const slot = { weapon: id, mag: WEAPONS[id].magSize };
      if (me.inv.length === 0) me.inv.push(slot);
      else me.inv[me.cur] = slot;
      equipSlot(me.inv.indexOf(slot), announce, false);
    }

    /** Une seule arme, tout le reste oublie (course a l'armement, mort en Economie). */
    function setOnlyWeapon(id: WeaponId, announce = true) {
      me.inv = id === "poings" ? [] : [{ weapon: id, mag: WEAPONS[id].magSize }];
      equipSlot(0, announce, false);
    }

    // --------------------------------------------------- armes au sol (loot)
    /**
     * Le butin : des armes et, en battle royale, des soins.
     *
     * Le faisceau prend la couleur de la rarete (gris commun, bleu rare,
     * violet epique, or legendaire) : on sait de loin si le detour vaut le
     * coup. Les soins sont verts, et leur icone est un petit cube.
     */
    type LootKind = "arme" | "soin";
    interface LootDrop {
      x: number;
      z: number;
      kind: LootKind;
      weapon: WeaponId;
      /** Points de vie rendus par un soin (0 pour une arme). */
      heal: number;
      taken: boolean;
      phase: number;
    }
    // Tirage du butin propre a la partie : la meme graine que l'ile.
    let lootSeed = (seed * 2654435761) >>> 0;
    const lootRand = () => {
      lootSeed = (lootSeed + 0x6d2b79f5) >>> 0;
      let t = lootSeed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const loots: LootDrop[] = [];
    const addStartLoot = (lx: number, lz: number, kind: LootKind, weapon: WeaponId, heal = 0) => {
      loots.push({ x: lx + 0.5, z: lz + 0.5, kind, weapon, heal, taken: false, phase: loots.length * 1.7 });
    };
    if (mode.loot) {
      if (zoneMap) {
        zoneMap.loot.forEach(([lx, lz], i) => {
          if (!island) {
            addStartLoot(lx, lz, "arme", LOOT_TABLE[i % LOOT_TABLE.length]);
            return;
          }
          // Un quart de soins (bandages surtout, quelques trousses), le reste en armes.
          const r = lootRand();
          if (r < 0.25) addStartLoot(lx, lz, "soin", "poings", r < 0.07 ? 75 : 30);
          else addStartLoot(lx, lz, "arme", rollLootWeapon(lootRand));
        });
      } else {
        const spots: [number, number, WeaponId][] = [
          [9, 4, "pompe"],
          [9, 14, "sniper"],
          [3, 9, "mitraillette"],
          [15, 9, "mitraillette"],
        ];
        for (const sp of spots) if (!isSolid(sp[0], sp[1])) addStartLoot(sp[0], sp[1], "arme", sp[2]);
      }
    }
    // Place pour les armes lachees par les elimines en cours de partie.
    const lootCapacity = mode.loot ? loots.length + (mode.respawn ? 12 : (mode.bots + 1) * MAX_SLOTS + 12) : 1;

    const beamGeo = new THREE.CylinderGeometry(0.17, 0.3, 2.8, 8, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ringGeo = new THREE.RingGeometry(0.26, 0.38, 14);
    const ringMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const iconGeo = new THREE.BoxGeometry(0.42, 0.09, 0.11);
    const iconMat = new THREE.MeshBasicMaterial({});
    const beamMesh = new THREE.InstancedMesh(beamGeo, beamMat, lootCapacity);
    const ringMesh = new THREE.InstancedMesh(ringGeo, ringMat, lootCapacity);
    const iconMesh = new THREE.InstancedMesh(iconGeo, iconMat, lootCapacity);
    const lootMeshes = [beamMesh, ringMesh, iconMesh];
    for (const m of lootMeshes) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(lootCapacity * 3).fill(1), 3);
      m.frustumCulled = false;
      m.count = loots.length;
      m.visible = loots.length > 0;
      scene.add(m);
    }
    const lootMatrix = new THREE.Matrix4();
    const lootQuat = new THREE.Quaternion();
    const lootEuler = new THREE.Euler();
    const lootPos = new THREE.Vector3();
    const lootScale = new THREE.Vector3(1, 1, 1);
    const lootColor = new THREE.Color();
    const lootHidden = new THREE.Matrix4().makeScale(0, 0, 0);
    function paintLoot(i: number) {
      const l = loots[i];
      if (l.kind === "soin") lootColor.setHex(l.heal >= 60 ? 0x3cff8a : 0xc6ffd8);
      else lootColor.set(RARITY[WEAPON_RARITY[l.weapon]].color);
      for (const m of lootMeshes) m.instanceColor!.setXYZ(i, lootColor.r, lootColor.g, lootColor.b);
    }
    loots.forEach((_, i) => paintLoot(i));
    for (const m of lootMeshes) m.instanceColor!.needsUpdate = true;

    /** Pose un objet au sol (arme lachee par un elimine ou par un echange). */
    function dropLoot(x: number, z: number, kind: LootKind, weapon: WeaponId, heal = 0) {
      if (!mode.loot || (kind === "arme" && weapon === "poings")) return;
      // Jamais dans un mur : on retombe sur la case de celui qui lache.
      if (isSolid(Math.floor(x), Math.floor(z))) {
        x = Math.floor(x) + 0.5;
        z = Math.floor(z) + 0.5;
        if (isSolid(Math.floor(x), Math.floor(z))) return;
      }
      const drop: LootDrop = { x, z, kind, weapon, heal, taken: false, phase: Math.random() * 6 };
      let i = loots.findIndex((l) => l.taken);
      if (i < 0) {
        if (loots.length >= lootCapacity) return;
        i = loots.length;
        loots.push(drop);
      } else {
        loots[i] = drop;
      }
      paintLoot(i);
      for (const m of lootMeshes) {
        m.instanceColor!.needsUpdate = true;
        m.count = loots.length;
        m.visible = true;
      }
    }

    /** Repositionne les faisceaux : appele a chaque image, cout negligeable. */
    function updateLootVisuals(time: number) {
      if (loots.length === 0) return;
      loots.forEach((l, i) => {
        if (l.taken) {
          beamMesh.setMatrixAt(i, lootHidden);
          ringMesh.setMatrixAt(i, lootHidden);
          iconMesh.setMatrixAt(i, lootHidden);
          return;
        }
        const wx = l.x * DUEL_CELL;
        const wz = l.z * DUEL_CELL;
        lootQuat.identity();
        lootPos.set(wx, 1.4, wz);
        lootScale.set(1, l.kind === "soin" ? 0.6 : 1, 1);
        lootMatrix.compose(lootPos, lootQuat, lootScale);
        beamMesh.setMatrixAt(i, lootMatrix);

        lootEuler.set(-Math.PI / 2, 0, 0);
        lootQuat.setFromEuler(lootEuler);
        lootPos.set(wx, 0.03, wz);
        lootScale.set(1, 1, 1);
        lootMatrix.compose(lootPos, lootQuat, lootScale);
        ringMesh.setMatrixAt(i, lootMatrix);

        lootEuler.set(0, time * 1.5 + l.phase, l.kind === "soin" ? 0 : 0.25);
        lootQuat.setFromEuler(lootEuler);
        lootPos.set(wx, 0.62 + Math.sin(time * 2 + l.phase) * 0.09, wz);
        // Un soin : un petit cube vert. Une arme : une silhouette allongee.
        if (l.kind === "soin") lootScale.set(0.5, 2.4, 1.9);
        else lootScale.set(1, 1, 1);
        lootMatrix.compose(lootPos, lootQuat, lootScale);
        iconMesh.setMatrixAt(i, lootMatrix);
      });
      beamMesh.instanceMatrix.needsUpdate = true;
      ringMesh.instanceMatrix.needsUpdate = true;
      iconMesh.instanceMatrix.needsUpdate = true;
    }

    // ------------------------------------------------------ les adversaires
    interface Fighter {
      id: number;
      name: string;
      color: number;
      model: SoldierParts;
      x: number;
      z: number;
      yaw: number;
      pitch: number;
      hp: number;
      dead: boolean;
      /** Battle royale : faux quand il est definitivement elimine. */
      alive: boolean;
      respawnAt: number;
      /** 0 = debout, monte vers 1 pendant la chute. */
      deathT: number;
      score: number;
      rank: number;
      weapon: WeaponId;
      mag: number;
      /** Ses armes (trois au plus), comme le joueur ; vide = poings. */
      inv: Slot[];
      cur: number;
      /** Fin du geste de changement d'arme : il ne tire pas avant. */
      swapUntil: number;
      reloadUntil: number;
      nextShotAt: number;
      isBot: boolean;
      safeUntil: number;
      // IA
      path: [number, number][] | null;
      pathIndex: number;
      repathTimer: number;
      /** Case visee par le chemin en cours (indice de grille). */
      pathGoal: number;
      seenFor: number;
      targetId: number;
      /** Prochaine reflexion : choix de la cible et de l'arme, a intervalles. */
      thinkAt: number;
      /** Cible de combat : le joueur, un autre bot, ou personne. */
      targetIsMe: boolean;
      targetRef: Fighter | null;
      /** Il voit sa cible (ligne de vue verifiee a la derniere reflexion). */
      sees: boolean;
      /** L'objet au sol qu'il va chercher. */
      lootTarget: LootDrop | null;
      /** Entrainement : apparition de la cible (temps de reaction). */
      spawnedAt: number;
      /** Danse de victoire apres une elimination. */
      dance: DanceId | null;
      danceUntil: number;
      dancer: Dancer | null;
      /** Temperament : au-dessus de 1 il engage de loin, en dessous il evite les combats. */
      aggro: number;
      /** Jusqu'a quand il riposte a celui qui l'a touche, quelle que soit la distance. */
      provokedUntil: number;
      /** Battle royale : point de balade quand il n'a ni cible ni objet a aller chercher. */
      wanderX: number;
      wanderZ: number;
      strafeDir: number;
      strafeUntil: number;
      // rendu
      walkPhase: number;
      speed: number;
      flashUntil: number;
      // reseau
      tx: number;
      tz: number;
      tyaw: number;
      tpitch: number;
      moving: boolean;
      /** Battle royale : hauteur restante avant de toucher le sol, en metres. */
      air: number;
      /** Soldat anime (SWAT) : remplace le soldat dessine en code une fois charge. */
      anim: AnimatedModel | null;
      animFlash: THREE.Mesh | null;
      /** L'arme tenue par le modele anime : cachee quand il se bat aux poings. */
      animGun: THREE.Group | null;
      lastAnimX: number;
      lastAnimZ: number;
    }

    const fighters: Fighter[] = [];
    // Attribution SANS doublon : un tirage au sort avec repetition faisait
    // apparaitre un bot sur la case du joueur, qui mourait avant d'avoir vu
    // le terrain. On retire du lot celle du joueur, puis on distribue.
    const freeSpawns = [...enemySpawnPool]
      .filter(([sx, sz]) => sx !== firstSpawn[0] || sz !== firstSpawn[1])
      .sort(() => Math.random() - 0.5);
    for (let i = 0; i < botCount; i++) {
      // S'il manque des emplacements, on retombe sur le lot complet plutot
      // que de ne pas faire apparaitre le bot du tout.
      const spawn = freeSpawns[i] ?? enemySpawnPool[(i + 1) % enemySpawnPool.length];
      const color = ENEMY_COLORS[i % ENEMY_COLORS.length];
      const model = buildSoldier(color);
      scene.add(model.group);
      const startInv = startingInventory();
      fighters.push({
        inv: startInv,
        cur: 0,
        swapUntil: 0,
        pathGoal: -1,
        thinkAt: Math.random() * 0.3,
        targetIsMe: false,
        targetRef: null,
        sees: false,
        lootTarget: null,
        spawnedAt: 0,
        dance: null,
        danceUntil: 0,
        dancer: null,
        aggro: 0.55 + Math.random() * 0.9,
        provokedUntil: 0,
        wanderX: NaN,
        wanderZ: NaN,
        animGun: null,
        id: i,
        name: bot || i > 0 ? BOT_NAMES[i % BOT_NAMES.length] : opponentName,
        color,
        model,
        x: spawn[0] + 0.5,
        z: spawn[1] + 0.5,
        yaw: 0,
        pitch: 0,
        hp: DUEL_MAX_HP,
        dead: false,
        alive: true,
        respawnAt: 0,
        deathT: 0,
        score: 0,
        rank: 0,
        weapon: startInv[0]?.weapon ?? "poings",
        mag: startInv[0]?.mag ?? 0,
        reloadUntil: 0,
        nextShotAt: 2,
        // En ligne, le premier combattant est le vrai joueur d'en face.
        isBot: bot || i > 0,
        safeUntil: SPAWN_PROTECT,
        path: null,
        pathIndex: 0,
        repathTimer: 0,
        seenFor: 0,
        targetId: -1,
        strafeDir: 1,
        strafeUntil: 0,
        walkPhase: 0,
        speed: 0,
        flashUntil: 0,
        tx: spawn[0] + 0.5,
        tz: spawn[1] + 0.5,
        tyaw: 0,
        tpitch: 0,
        moving: false,
        air: 0,
        anim: null,
        animFlash: null,
        lastAnimX: spawn[0] + 0.5,
        lastAnimZ: spawn[1] + 0.5,
      });
    }

    // --- Soldats animes ---
    // Le modele SWAT (CC0) apporte de vraies animations : course, pas de cote,
    // tir en courant, mort. Il se charge en arriere-plan ; tant qu'il n'est
    // pas la (ou si le reseau echoue), on garde les soldats dessines en code.
    let sceneDisposed = false;
    const botGunMat = new THREE.MeshLambertMaterial({ color: 0x23272c });
    const botGunBody = new THREE.BoxGeometry(0.06, 0.1, 0.46);
    const botGunBarrel = new THREE.CylinderGeometry(0.018, 0.018, 0.26, 6);
    const botFlashMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95 });
    const botFlashGeo = new THREE.SphereGeometry(0.09, 6, 5);
    for (const f of fighters) {
      createAnimatedModel("soldat-swat", 1.8)
        .then((m) => {
          if (sceneDisposed) {
            m.dispose();
            return;
          }
          // Couleur d'equipe sur l'uniforme, adoucie pour rester lisible.
          const uniform = new THREE.Color(0x4a5058).lerp(new THREE.Color(f.color), 0.62).getHex();
          m.tint((n) => n === "Swat", uniform);
          const gun = new THREE.Group();
          const body = new THREE.Mesh(botGunBody, botGunMat);
          body.position.set(0, 0.03, 0.12);
          const barrel = new THREE.Mesh(botGunBarrel, botGunMat);
          barrel.rotation.x = Math.PI / 2;
          barrel.position.set(0, 0.05, 0.47);
          const flash = new THREE.Mesh(botFlashGeo, botFlashMat);
          flash.position.set(0, 0.05, 0.64);
          flash.scale.set(1, 1, 1.7);
          flash.visible = false;
          gun.add(body, barrel, flash);
          m.attach("Wrist.R", gun, "Idle_Gun_Pointing");
          f.anim = m;
          f.animFlash = flash;
          f.animGun = gun;
          m.root.visible = false;
          scene.add(m.root);
        })
        .catch(() => {});
    }

    // --- Inventaire des bots : les memes regles que le joueur ---
    function botEquip(f: Fighter, index: number, saveCurrent = true) {
      if (saveCurrent && f.inv[f.cur]) f.inv[f.cur].mag = f.mag;
      const slot = f.inv[index];
      f.cur = slot ? index : 0;
      f.weapon = slot ? slot.weapon : "poings";
      f.mag = slot ? slot.mag : 0;
      f.reloadUntil = 0;
      f.swapUntil = elapsed + SWAP_SECONDS + 0.15;
    }

    function botSetOnly(f: Fighter, id: WeaponId) {
      f.inv = id === "poings" ? [] : [{ weapon: id, mag: WEAPONS[id].magSize }];
      botEquip(f, 0, false);
    }

    const RARITY_RANK: Record<string, number> = { commun: 0, rare: 1, epique: 2, legendaire: 3 };
    /**
     * Il ramasse une arme : dans une place libre, en munitions si c'est un
     * doublon, ou a la place de sa moins bonne si elle est plus rare.
     */
    function botTakeWeapon(f: Fighter, id: WeaponId): boolean {
      const magSize = WEAPONS[id].magSize;
      const have = f.inv.findIndex((s) => s.weapon === id);
      if (have >= 0) {
        f.inv[have].mag = magSize;
        if (have === f.cur) f.mag = magSize;
        return true;
      }
      if (f.inv[f.cur]) f.inv[f.cur].mag = f.mag;
      if (f.inv.length < MAX_SLOTS) {
        f.inv.push({ weapon: id, mag: magSize });
        if (f.inv.length === 1) botEquip(f, 0, false);
        return true;
      }
      let worst = 0;
      f.inv.forEach((s, k) => {
        if (RARITY_RANK[WEAPON_RARITY[s.weapon]] < RARITY_RANK[WEAPON_RARITY[f.inv[worst].weapon]]) worst = k;
      });
      if (RARITY_RANK[WEAPON_RARITY[id]] <= RARITY_RANK[WEAPON_RARITY[f.inv[worst].weapon]]) return false;
      dropLoot(f.x, f.z, "arme", f.inv[worst].weapon);
      f.inv[worst] = { weapon: id, mag: magSize };
      if (worst === f.cur) {
        f.weapon = id;
        f.mag = magSize;
        f.reloadUntil = 0;
      }
      return true;
    }

    /**
     * Ce que vaut une arme a une distance donnee : degats par seconde, tenus
     * par la portee et par la dispersion (un fusil a pompe ne touche rien a
     * dix metres, un sniper ne sert a rien dans un couloir).
     */
    function weaponValueAt(id: WeaponId, dist: number): number {
      const w = WEAPONS[id];
      if (w.melee) return dist < 1.8 ? 60 : 0.5;
      const reach = dist <= w.range ? 1 : dist <= w.range * 1.6 ? 0.45 : 0.08;
      const hit =
        w.pellets > 1
          ? dist < 3
            ? 0.9
            : dist < 6
              ? 0.5
              : dist < 9
                ? 0.2
                : 0.05
          : THREE.MathUtils.clamp(1 - ((w.spread * dist) / DUEL_BODY_RADIUS) * 0.5, 0.15, 1);
      return ((w.damage * w.pellets) / w.fireInterval) * reach * hit;
    }

    /** Il sort l'arme la plus utile pour la distance, et change plutot que recharger. */
    function botPickWeapon(f: Fighter, dist: number) {
      if (f.inv.length < 2) return;
      let best = f.cur;
      let bestValue = -1;
      f.inv.forEach((s, k) => {
        const mag = k === f.cur ? f.mag : s.mag;
        let value = weaponValueAt(s.weapon, dist);
        if (mag <= 0) value *= 0.3;
        if (k === f.cur) value *= 1.2; // un peu d'inertie : pas de valse des armes
        if (value > bestValue) {
          bestValue = value;
          best = k;
        }
      });
      if (best !== f.cur) botEquip(f, best);
    }

    // ------------------------------------------------ entrainement
    /** Compte a rebours avant la premiere cible. */
    const TRAINING_START = 3;
    const trainStats = { shots: 0, hits: 0, headshots: 0, kills: 0, missedTargets: 0, reactions: [] as number[] };
    /** Le tir en cours a touche (et a la tete) : une seule fois par tir, meme au pompe. */
    let shotHit = false;
    let shotHead = false;

    /** Une cible apparait devant soi (ou n'importe ou si la place manque), a vue. */
    function placeTarget(f: Fighter) {
      if (!training) return;
      for (let attempt = 0; attempt < 120; attempt++) {
        // La direction du regard vaut `yaw + PI` dans le repere atan2(dx, dz).
        const cone = attempt < 60 ? 2.2 : Math.PI * 2;
        const a = me.yaw + Math.PI + (Math.random() - 0.5) * cone;
        const d = training.minDist + Math.random() * (training.maxDist - training.minDist);
        const x = me.x + Math.sin(a) * d;
        const z = me.z + Math.cos(a) * d;
        if (isSolid(Math.floor(x), Math.floor(z))) continue;
        if (!hasLineOfSight(me.x, me.z, x, z)) continue;
        if (fighters.some((o) => o !== f && !o.dead && Math.hypot(o.x - x, o.z - z) < 1.6)) continue;
        f.x = Math.floor(x) + 0.5;
        f.z = Math.floor(z) + 0.5;
        break;
      }
      f.hp = training.hp;
      f.dead = false;
      f.deathT = 0;
      f.alive = true;
      f.safeUntil = 0;
      f.spawnedAt = elapsed;
      f.strafeDir = Math.random() < 0.5 ? -1 : 1;
      f.strafeUntil = elapsed + 0.6 + Math.random() * 0.8;
      f.yaw = Math.atan2(me.x - f.x, me.z - f.z);
      f.lastAnimX = f.x;
      f.lastAnimZ = f.z;
    }

    /** Une cible, une image : elle ne tire jamais, elle se contente d'exister (ou de bouger). */
    function updateTarget(f: Fighter, delta: number) {
      if (!training) return;
      if (f.dead) {
        f.deathT = Math.min(1, f.deathT + delta * 3);
        if (elapsed >= f.respawnAt && elapsed >= TRAINING_START) placeTarget(f);
        return;
      }
      if (training.lifetime && elapsed - f.spawnedAt > training.lifetime) {
        trainStats.missedTargets += 1;
        placeTarget(f);
        return;
      }
      const prevX = f.x;
      const prevZ = f.z;
      if (training.moving) {
        if (elapsed > f.strafeUntil) {
          f.strafeUntil = elapsed + 0.5 + Math.random() * 1.1;
          f.strafeDir = -f.strafeDir;
        }
        const sideA = Math.atan2(me.x - f.x, me.z - f.z) + (Math.PI / 2) * f.strafeDir;
        const sp = 2.6 * delta;
        const nx = f.x + Math.sin(sideA) * sp;
        const nz = f.z + Math.cos(sideA) * sp;
        if (!isSolid(Math.floor(nx), Math.floor(nz))) {
          f.x = nx;
          f.z = nz;
        } else {
          f.strafeDir = -f.strafeDir;
        }
      }
      f.yaw = Math.atan2(me.x - f.x, me.z - f.z);
      f.speed = Math.hypot(f.x - prevX, f.z - prevZ) / Math.max(delta, 1e-4);
      f.walkPhase += f.speed * delta * 2.6;
    }

    function trainingResult(): TrainingResult {
      const base = {
        drill,
        kills: trainStats.kills,
        shots: trainStats.shots,
        hits: trainStats.hits,
        headshots: trainStats.headshots,
        missedTargets: trainStats.missedTargets,
        avgReactionMs: trainStats.reactions.length
          ? Math.round((trainStats.reactions.reduce((a, b) => a + b, 0) / trainStats.reactions.length) * 1000)
          : null,
      };
      return { ...base, score: trainingScore(base) };
    }

    if (training) {
      // Les cibles attendent la fin du compte a rebours.
      fighters.forEach((f, i) => {
        f.dead = true;
        f.deathT = 1;
        f.hp = 0;
        f.respawnAt = TRAINING_START + i * 0.12;
      });
    }

    // ------------------------------------------------ mode admin
    /** Une triche a servi pendant la partie : pas de recompense a la fin. */
    let usedCheats = false;

    /** L'ennemi le mieux place pour l'aimbot : en vue, dans un cone de 70 degres. */
    function aimbotTarget(): Fighter | null {
      let best: Fighter | null = null;
      let bestAngle = 1.22;
      const fx = -Math.sin(me.yaw);
      const fz = -Math.cos(me.yaw);
      for (const f of fighters) {
        if (f.dead || !f.alive || f.air > 0.5) continue;
        const dx = f.x - me.x;
        const dz = f.z - me.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.3 || d > 48) continue;
        const ang = Math.acos(THREE.MathUtils.clamp((dx * fx + dz * fz) / d, -1, 1));
        if (ang >= bestAngle || !hasLineOfSight(me.x, me.z, f.x, f.z)) continue;
        bestAngle = ang;
        best = f;
      }
      return best;
    }

    /** Qui est sous le reticule, avant tout mur (meme calcul que le tir). */
    function fighterUnderCrosshair(): Fighter | null {
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      let hitDist = rayWallDistance(me.x, me.z, dir.x, dir.z, 60);
      let hit: Fighter | null = null;
      for (const f of fighters) {
        if (f.dead || !f.alive) continue;
        const fx = me.x - f.x;
        const fz = me.z - f.z;
        const a = dir.x * dir.x + dir.z * dir.z;
        const b = 2 * (fx * dir.x + fz * dir.z);
        const c = fx * fx + fz * fz - DUEL_BODY_RADIUS * DUEL_BODY_RADIUS;
        const disc = b * b - 4 * a * c;
        if (a <= 1e-6 || disc < 0) continue;
        const t = (-b - Math.sqrt(disc)) / (2 * a);
        if (t <= 0 || t >= hitDist) continue;
        const y = DUEL_EYE_HEIGHT + dir.y * t;
        if (y < 0.05 || y > DUEL_HEAD_Y + DUEL_HEAD_RADIUS) continue;
        hitDist = t;
        hit = f;
      }
      return hit;
    }

    // Vision a travers les murs : une cage en fil de fer par combattant, qui
    // ignore la profondeur (toujours dessinee par-dessus le decor).
    const espGeo = new THREE.BoxGeometry(0.8, 1.9, 0.8);
    espGeo.translate(0, 0.95, 0);
    const espMat = new THREE.MeshBasicMaterial({ wireframe: true, depthTest: false, depthWrite: false, transparent: true, opacity: 0.95 });
    const espMesh = new THREE.InstancedMesh(espGeo, espMat, Math.max(1, fighters.length));
    espMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, fighters.length) * 3).fill(1), 3);
    espMesh.renderOrder = 999;
    espMesh.frustumCulled = false;
    espMesh.visible = false;
    scene.add(espMesh);
    const espMatrix = new THREE.Matrix4();
    const espColor = new THREE.Color();
    const espHidden = new THREE.Matrix4().makeScale(0, 0, 0);
    const espProj = new THREE.Vector3();
    let lastLootEsp = false;
    let espTagsShown = false;

    function adminAction(action: "tuer" | "soigner" | "zone" | "armes") {
      if (!adminEnabled || ended) return;
      usedCheats = true;
      if (action === "tuer") {
        for (const f of fighters) if (!f.dead && f.alive) registerFighterDeath(f, "Admin", true);
      } else if (action === "soigner") {
        me.hp = DUEL_MAX_HP;
        setHp(me.hp);
      } else if (action === "armes") {
        me.inv = [
          { weapon: "fusil", mag: WEAPONS.fusil.magSize },
          { weapon: "sniper", mag: WEAPONS.sniper.magSize },
          { weapon: "pompe", mag: WEAPONS.pompe.magSize },
        ];
        equipSlot(0, true, false);
      } else if (action === "zone" && island) {
        teleportTo(zoneCenter.x, zoneCenter.z);
      }
    }

    function teleportTo(x: number, z: number) {
      if (!adminEnabled || !island || me.dead || !me.alive) return;
      usedCheats = true;
      const [ox, oz] = nearestOpenCell(island, x, z);
      me.x = ox + 0.5;
      me.z = oz + 0.5;
    }

    // ------------------------------------------------ danses
    // Le joueur a son propre soldat anime, invisible a la premiere personne :
    // il n'apparait que pendant une danse, filme par une camera qui tourne
    // autour de lui (comme dans Fortnite).
    let myAvatar: AnimatedModel | null = null;
    let myDancer: Dancer | null = null;
    let myEmote: DanceId | null = null;
    let emoteT = 0;
    createAnimatedModel("soldat-swat", 1.8)
      .then((m) => {
        if (sceneDisposed) {
          m.dispose();
          return;
        }
        const sk = SKINS[skin ?? "commando"];
        m.tint((n) => n === "Swat", sk.accent);
        m.tint((n) => n === "Swat_Black", sk.gear);
        m.tint((n) => n === "Visor", sk.visor);
        m.root.visible = false;
        m.play("Idle_Neutral");
        scene.add(m.root);
        myAvatar = m;
        myDancer = createDancer(m);
      })
      .catch(() => {});

    function startMyEmote(id: DanceId) {
      if (!myAvatar || !myDancer || me.dead || !me.alive || buying()) return;
      toggleEmoteMenu(false);
      if (isZoomed) toggleZoom(false);
      myAvatar.root.position.set(me.x * DUEL_CELL, 0, me.z * DUEL_CELL);
      // L'avatar regarde vers +Z ; le joueur regarde vers (-sin yaw, -cos yaw).
      myAvatar.root.rotation.y = me.yaw + Math.PI;
      myDancer.start(id);
      myEmote = id;
      emoteT = 0;
      setEmoting(id);
    }

    function stopMyEmote() {
      if (!myEmote) return;
      myEmote = null;
      myDancer?.start(null);
      if (myAvatar) myAvatar.root.visible = false;
      setEmoting(null);
    }

    /** Un bot qui vient d'eliminer quelqu'un danse parfois sur place. */
    function maybeTaunt(f: Fighter | null | undefined) {
      if (!f || !f.isBot || f.dead || !f.alive || training) return;
      if (Math.random() > 0.35) return;
      f.dance = DANCE_ORDER[1 + Math.floor(Math.random() * (DANCE_ORDER.length - 1))];
      f.danceUntil = elapsed + 2.6;
    }

    const audio = createDuelAudio();

    // ------------------------------------------------ economie et manches
    const eco = mode.economy ?? null;
    let myMoney = eco?.startMoney ?? 0;
    let botMoney = eco?.startMoney ?? 0;
    /** Fin de la phase d'achat : personne ne bouge ni ne tire avant. */
    let buyUntil = eco ? eco.buySeconds : 0;
    /** Debut de la manche suivante, -1 tant que la manche est en cours. */
    let roundResetAt = -1;
    let roundNumber = 1;
    /** Qui est mort a la manche precedente : il repart au pistolet. */
    let iDiedLastRound = false;
    let botDiedLastRound = false;
    if (eco) {
      me.safeUntil = buyUntil;
      for (const f of fighters) {
        f.safeUntil = buyUntil;
        f.nextShotAt = buyUntil + BOT_REACTION;
      }
    }

    let elapsed = 0;
    let lastTime = performance.now();
    let muzzleUntil = 0;
    let recoil = 0;
    let recoilKick = 0;
    // Montee en visee progressive : l'arme montait d'un coup au centre, ce qui
    // cassait la lecture du tir. Elle glisse maintenant en deux dixiemes.
    let aimBlend = 0;
    let walkPhase = 0;
    let nextStepAt = 0;
    let nextNetAt = 0;
    let uiTimer = 0;
    let hitMarkerLevel = 0;
    // Compteur d'images : moyenne sur une demi-seconde, sinon le chiffre
    // clignote trop vite pour etre lu.
    let frameCount = 0;
    let fpsTimer = 0;
    let nextPingAt = 2;
    let lastPingSentAt = -1;
    let damageLevel = 0;
    let lastDamageYaw: number | null = null;
    let lastDamageAt = -10;
    let feedId = 0;
    /** Combien de bots me tirent dessus en ce moment, et le plafond en cours. */
    let engagingMe = 0;
    let engagingLast = 0;
    let hitLockUntil = 0;
    let ended = false;
    let isZoomed = false;
    /** Ping radar : d'ou sont partis les derniers coups de feu. */
    const blips: { x: number; z: number; until: number }[] = [];
    const keys = new Set<string>();
    let firing = false;
    let wasFiring = false;

    function addFeed(text: string, mine: boolean) {
      feedId += 1;
      const id = feedId;
      setFeed((f) => [...f.slice(-3), { id, text, mine }]);
      window.setTimeout(() => setFeed((f) => f.filter((e) => e.id !== id)), 4000);
    }

    function circleHitsWall(px: number, pz: number): boolean {
      const minX = Math.floor(px - DUEL_PLAYER_RADIUS);
      const maxX = Math.floor(px + DUEL_PLAYER_RADIUS);
      const minZ = Math.floor(pz - DUEL_PLAYER_RADIUS);
      const maxZ = Math.floor(pz + DUEL_PLAYER_RADIUS);
      for (let cx = minX; cx <= maxX; cx++) {
        for (let cz = minZ; cz <= maxZ; cz++) {
          if (!isSolid(cx, cz)) continue;
          const clx = Math.max(cx, Math.min(px, cx + 1));
          const clz = Math.max(cz, Math.min(pz, cz + 1));
          const dx = px - clx;
          const dz = pz - clz;
          if (dx * dx + dz * dz < DUEL_PLAYER_RADIUS * DUEL_PLAYER_RADIUS) return true;
        }
      }
      return false;
    }

    /** Distance jusqu'au premier mur le long d'un rayon. */
    function rayWallDistance(ox: number, oz: number, dx: number, dz: number, max: number): number {
      const step = 0.07;
      for (let d = step; d < max; d += step) {
        if (isSolid(Math.floor(ox + dx * d), Math.floor(oz + dz * d))) return d;
      }
      return max;
    }

    function hasLineOfSight(ax: number, az: number, bx: number, bz: number): boolean {
      const dist = Math.hypot(bx - ax, bz - az);
      const steps = Math.ceil(dist * 4);
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        if (isSolid(Math.floor(ax + (bx - ax) * t), Math.floor(az + (bz - az) * t))) return false;
      }
      return true;
    }

    /** Apparition la plus eloignee de tous les combattants encore debout. */
    function safestSpawn(pool: [number, number][], avoid: { x: number; z: number }[]) {
      let best = pool[0];
      let bestScore = -1;
      for (const s of pool) {
        let nearest = Infinity;
        for (const a of avoid) {
          nearest = Math.min(nearest, Math.hypot(s[0] + 0.5 - a.x, s[1] + 0.5 - a.z));
        }
        if (nearest > bestScore) {
          bestScore = nearest;
          best = s;
        }
      }
      return best;
    }

    function panFor(x: number, z: number) {
      const dx = x - me.x;
      const dz = z - me.z;
      const len = Math.hypot(dx, dz) || 1;
      const pan = (dx / len) * Math.cos(me.yaw) - (dz / len) * Math.sin(me.yaw);
      return {
        pan: Math.max(-1, Math.min(1, pan)),
        gain: Math.max(0.05, 1 - len / (useZone ? 34 : 22)),
      };
    }

    function pingRadar(x: number, z: number) {
      blips.push({ x, z, until: elapsed + 2.2 });
      if (blips.length > 12) blips.shift();
    }

    // ------------------------------------------------ achats et manches
    function buying() {
      return Boolean(eco) && elapsed < buyUntil && !ended;
    }

    function buyWeapon(id: WeaponId) {
      if (!eco || !buying() || me.dead) return;
      const price = WEAPON_PRICES[id];
      if (me.inv.some((s) => s.weapon === id)) {
        // Deja achetee : on la sort, sans repayer.
        equipSlot(me.inv.findIndex((s) => s.weapon === id));
        return;
      }
      if (price > myMoney) {
        playDryFire(audio.ctx, audio.master);
        return;
      }
      myMoney -= price;
      setMoney(myMoney);
      // Comme dans Counter-Strike : une arme principale et une arme de poing.
      // Une arme achetee remplace celle de sa categorie.
      if (me.inv[me.cur]) me.inv[me.cur].mag = me.mag;
      const bought = { weapon: id, mag: WEAPONS[id].magSize };
      const primary = me.inv.find((s) => !isSidearm(s.weapon));
      const sidearm = me.inv.find((s) => isSidearm(s.weapon));
      me.inv = isSidearm(id) ? [...(primary ? [primary] : []), bought] : [bought, ...(sidearm ? [sidearm] : [])];
      equipSlot(me.inv.indexOf(bought), true, false);
      playReload(audio.ctx, audio.master);
    }

    /** La Sentinelle depense comme un joueur prudent : elle garde de quoi rebondir. */
    function botBuy(f: Fighter) {
      if (!eco) return;
      const wishes: WeaponId[] =
        botMoney >= 6500
          ? ["sniper", "mitrailleuse", "fusil"]
          : ["fusil", "carabine", "pompe", "mitraillette", "pm", "revolver"];
      for (const w of wishes) {
        if (f.inv.some((s) => s.weapon === w)) return;
        if (WEAPON_PRICES[w] <= botMoney) {
          botMoney -= WEAPON_PRICES[w];
          f.inv = [{ weapon: w, mag: WEAPONS[w].magSize }, { weapon: "pistolet", mag: WEAPONS.pistolet.magSize }];
          botEquip(f, 0, false);
          return;
        }
      }
    }

    function giveMoney(toMe: boolean, amount: number) {
      if (!eco) return;
      if (toMe) {
        myMoney = Math.min(eco.maxMoney, myMoney + amount);
        setMoney(myMoney);
      } else {
        botMoney = Math.min(eco.maxMoney, botMoney + amount);
      }
    }

    /** Une elimination met fin a la manche (1 contre 1). */
    function endRound(iWon: boolean) {
      if (!eco || roundResetAt > 0 || ended) return;
      giveMoney(iWon, eco.killReward + eco.winReward);
      giveMoney(!iWon, eco.lossReward);
      iDiedLastRound = !iWon;
      botDiedLastRound = iWon;
      setRoundBanner(iWon ? "Manche gagnée" : "Manche perdue");
      if (!ended) roundResetAt = elapsed + eco.roundEndSeconds;
    }

    function startRound() {
      if (!eco) return;
      roundResetAt = -1;
      roundNumber += 1;
      buyUntil = elapsed + eco.buySeconds;
      // Retour aux apparitions de depart, vie pleine, chargeur plein.
      const mine = mySpawnPool[0];
      me.x = mine[0] + 0.5;
      me.z = mine[1] + 0.5;
      me.yaw = side === "a" ? -Math.PI * 0.75 : Math.PI * 0.25;
      me.pitch = 0;
      me.hp = DUEL_MAX_HP;
      me.dead = false;
      me.safeUntil = buyUntil;
      if (iDiedLastRound) setOnlyWeapon("pistolet", false);
      else {
        for (const s of me.inv) s.mag = WEAPONS[s.weapon].magSize;
        me.mag = WEAPONS[me.weapon].magSize;
        me.reloadUntil = 0;
        syncWeaponUi();
      }
      fighters.forEach((f, i) => {
        const spawn = enemySpawnPool[i % enemySpawnPool.length];
        f.x = spawn[0] + 0.5;
        f.z = spawn[1] + 0.5;
        f.hp = DUEL_MAX_HP;
        f.dead = false;
        f.deathT = 0;
        f.path = null;
        f.safeUntil = buyUntil;
        f.nextShotAt = buyUntil + BOT_REACTION;
        if (botDiedLastRound) botSetOnly(f, "pistolet");
        for (const s of f.inv) s.mag = WEAPONS[s.weapon].magSize;
        f.mag = WEAPONS[f.weapon].magSize;
        botBuy(f);
      });
      setHp(DUEL_MAX_HP);
      setRound(roundNumber);
      setRoundBanner(null);
      setShopOpen(true);
      playRespawn(audio.ctx, audio.master);
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock?.();
    }

    // ---------------------------------------------------- fin de partie
    function livingCount() {
      return (me.alive ? 1 : 0) + fighters.filter((f) => f.alive).length;
    }

    function finish(win: boolean, rank?: number) {
      if (ended) return;
      ended = true;
      playMatchEnd(audio.ctx, audio.master, win);
      const best = fighters.reduce((m, f) => Math.max(m, f.score), 0);
      const extra: MatchExtra = { cheated: usedCheats, training: training ? trainingResult() : undefined };
      // Victoire : on danse (la plus belle danse possedee) avant l'ecran de fin.
      if (win && !training) {
        const owned = dancesRef.current;
        const favorite = owned[owned.length - 1];
        if (favorite) startMyEmote(favorite);
      }
      window.setTimeout(() => onMatchEndRef.current(win, me.score, best, rank, extra), win && !training ? 2600 : 1300);
    }

    function checkVictory() {
      if (ended) return;
      if (mode.shrinkingZone) {
        if (!me.alive) {
          // Le classement, c'est le nombre de survivants au moment de mourir.
          finish(false, livingCount() + 1);
        } else if (livingCount() <= 1) {
          finish(true, 1);
        }
        return;
      }
      if (mode.gunGame) {
        if (me.rank >= GUN_GAME_ORDER.length) finish(true);
        else if (fighters.some((f) => f.rank >= GUN_GAME_ORDER.length)) finish(false);
        return;
      }
      if (me.score >= mode.scoreToWin) finish(true);
      else if (fighters.some((f) => f.score >= mode.scoreToWin)) finish(false);
    }

    // ------------------------------------------------- mort et reapparition
    function myRespawn() {
      const s = safestSpawn(
        mySpawnPool,
        fighters.filter((f) => !f.dead).map((f) => ({ x: f.x, z: f.z })),
      );
      me.x = s[0] + 0.5;
      me.z = s[1] + 0.5;
      me.hp = DUEL_MAX_HP;
      me.dead = false;
      for (const s of me.inv) s.mag = WEAPONS[s.weapon].magSize;
      me.mag = WEAPONS[me.weapon].magSize;
      me.reloadUntil = 0;
      me.safeUntil = elapsed + SPAWN_PROTECT;
      playRespawn(audio.ctx, audio.master);
      setHp(DUEL_MAX_HP);
      syncWeaponUi();
    }

    function registerMyDeath(killerName: string, killer: Fighter | null) {
      if (me.dead) return;
      me.dead = true;
      me.hp = 0;
      me.respawnAt = elapsed + DUEL_RESPAWN_SECONDS;
      setHp(0);
      playDeath(audio.ctx, audio.master);
      damageLevel = 1;
      effects.blood(me.x * DUEL_CELL, 1.2, me.z * DUEL_CELL, 26);
      if (killer) {
        killer.score += 1;
        if (mode.gunGame) {
          killer.rank = Math.min(GUN_GAME_ORDER.length, killer.rank + 1);
          // Comme le joueur : l'arme suivante tout de suite, pas a la prochaine mort.
          if (killer.isBot && killer.rank < GUN_GAME_ORDER.length) botSetOnly(killer, GUN_GAME_ORDER[killer.rank]);
        }
      }
      addFeed(`${killerName} t'a éliminé`, false);
      maybeTaunt(killer);
      if (!bot) link.current.send("died", {});
      if (!mode.respawn) {
        me.alive = false;
        setAlive(livingCount());
      }
      checkVictory();
      endRound(false);
    }

    /** Elimination d'un bot. `byMe` distingue mes frags de ceux des bots. */
    function registerFighterDeath(f: Fighter, killerName: string, byMe: boolean, killer?: Fighter) {
      if (f.dead) return;
      f.dead = true;
      f.hp = 0;
      f.deathT = 0;
      f.respawnAt = elapsed + DUEL_RESPAWN_SECONDS;
      f.dance = null;
      effects.blood(f.x * DUEL_CELL, 1.1, f.z * DUEL_CELL, 26);
      playDeath(audio.ctx, audio.master, panFor(f.x, f.z));
      if (training) {
        // Cible abattue : une autre apparait tout de suite ailleurs.
        trainStats.kills += 1;
        trainStats.reactions.push(elapsed - f.spawnedAt);
        f.respawnAt = elapsed + 0.25;
        me.score += 1;
        setMyScore(me.score);
        return;
      }
      maybeTaunt(killer);
      if (byMe) {
        me.score += 1;
        setMyScore(me.score);
        if (mode.gunGame) {
          me.rank = Math.min(GUN_GAME_ORDER.length, me.rank + 1);
          if (me.rank < GUN_GAME_ORDER.length) setOnlyWeapon(GUN_GAME_ORDER[me.rank]);
        }
        addFeed(`Tu as éliminé ${f.name}`, true);
      } else {
        addFeed(`${killerName} a éliminé ${f.name}`, false);
      }
      if (!mode.respawn) {
        f.alive = false;
        setAlive(livingCount());
        // Battle royale : son equipement tombe au sol, pour qui passera par la.
        f.inv.forEach((s, k) => {
          const a = (k / Math.max(1, f.inv.length)) * Math.PI * 2 + Math.random();
          dropLoot(f.x + Math.cos(a) * 0.55, f.z + Math.sin(a) * 0.55, "arme", s.weapon);
        });
        f.inv = [];
      }
      checkVictory();
      if (byMe) endRound(true);
    }

    function applyDamageToMe(amount: number, fromX?: number, fromZ?: number, killer?: Fighter) {
      if (me.dead || ended || !me.alive || cheatsRef.current.god) return;
      if (elapsed < me.safeUntil) return;
      // Le plafond ne s'applique qu'aux bots : un vrai joueur en ligne touche
      // quand il touche, et la zone ne rate jamais.
      if (killer?.isBot) {
        if (elapsed < hitLockUntil) return;
        hitLockUntil = elapsed + hitLockFor(engagingLast);
      }
      me.hp = Math.max(0, me.hp - amount);
      setHp(me.hp);
      damageLevel = Math.min(1, damageLevel + 0.55);
      if (fromX !== undefined && fromZ !== undefined) {
        lastDamageYaw = Math.atan2(fromX - me.x, fromZ - me.z);
        lastDamageAt = elapsed;
      }
      playHurt(audio.ctx, audio.master);
      if (me.hp <= 0) registerMyDeath(killer?.name ?? opponentName, killer ?? null);
    }

    function damageFighter(f: Fighter, amount: number, byMe: boolean, killerName: string, attacker?: Fighter) {
      if (f.dead || !f.alive || ended) return;
      if (elapsed < f.safeUntil) return;
      f.hp = Math.max(0, f.hp - amount);
      // Touche : il se retourne contre son agresseur, ou qu'il soit.
      if (f.isBot && (byMe || attacker)) {
        f.targetIsMe = byMe;
        f.targetRef = byMe ? null : (attacker ?? null);
        f.provokedUntil = elapsed + 6;
      }
      if (f.hp <= 0) registerFighterDeath(f, killerName, byMe, attacker);
    }

    // ------------------------------------------------------------- le tir
    /**
     * Un projectile : mur d'abord, puis chaque combattant. Le fusil a pompe
     * en tire huit d'un coup, chacun avec sa propre dispersion.
     */
    function fireOnePellet(dir: THREE.Vector3, spec: (typeof WEAPONS)[WeaponId]) {
      const maxRange = spec.range * 2.2;
      const wallDist = rayWallDistance(me.x, me.z, dir.x, dir.z, maxRange);

      let hitDist = wallDist;
      let hitTarget: Fighter | null = null;
      let headshot = false;
      for (const f of fighters) {
        if (f.dead || !f.alive) continue;
        const fx = me.x - f.x;
        const fz = me.z - f.z;
        const a = dir.x * dir.x + dir.z * dir.z;
        const b = 2 * (fx * dir.x + fz * dir.z);
        const c = fx * fx + fz * fz - DUEL_BODY_RADIUS * DUEL_BODY_RADIUS;
        const disc = b * b - 4 * a * c;
        if (a <= 1e-6 || disc < 0) continue;
        const t = (-b - Math.sqrt(disc)) / (2 * a);
        if (t <= 0 || t >= hitDist) continue;
        const y = DUEL_EYE_HEIGHT + dir.y * t;
        if (y < 0.05 || y > DUEL_HEAD_Y + DUEL_HEAD_RADIUS) continue;
        hitDist = t;
        hitTarget = f;
        headshot = Math.abs(y - DUEL_HEAD_Y) < DUEL_HEAD_RADIUS;
      }

      const start = new THREE.Vector3(me.x * DUEL_CELL, DUEL_EYE_HEIGHT, me.z * DUEL_CELL).add(
        dir.clone().multiplyScalar(0.6),
      );
      const end = new THREE.Vector3(me.x * DUEL_CELL, DUEL_EYE_HEIGHT, me.z * DUEL_CELL).add(
        dir.clone().multiplyScalar(hitDist),
      );
      effects.tracer(start, end, spec.tracer, spec.pellets > 1);

      if (hitTarget) {
        // Les degats tombent au-dela de la portee utile : c'est ce qui
        // empeche la mitraillette de valoir un sniper a trente metres.
        const falloff = hitDist > spec.range ? 0.5 : 1;
        let dmg = spec.damage * (headshot ? spec.headshot : 1) * falloff * (cheatsRef.current.oneShot ? 50 : 1);
        // Exercice de precision : le corps ne compte pas.
        if (training?.headOnly && !headshot) dmg = 0;
        if (!training?.headOnly || headshot) shotHit = true;
        if (headshot) shotHead = true;
        hitMarkerLevel = 1;
        if (headshot) playHeadshot(audio.ctx, audio.master);
        else playHitmarker(audio.ctx, audio.master);
        effects.blood(end.x, end.y, end.z, headshot ? 24 : 12);
        if (hitTarget.isBot) {
          damageFighter(hitTarget, dmg, true, "Toi");
        } else {
          link.current.send("hit", { damage: dmg });
        }
      } else {
        effects.sparks(end.x, end.y, end.z, spec.pellets > 1 ? 6 : 14);
        playImpact(audio.ctx, audio.master, panFor(me.x + dir.x * hitDist, me.z + dir.z * hitDist));
      }
      return hitDist;
    }

    /** Coup de poing : le combattant le plus proche devant soi, a portee de bras. */
    function punch(spec: (typeof WEAPONS)[WeaponId]) {
      me.nextShotAt = elapsed + spec.fireInterval * (cheatsRef.current.rapidFire ? 0.25 : 1);
      recoil = 1;
      const fx = -Math.sin(me.yaw);
      const fz = -Math.cos(me.yaw);
      let target: Fighter | null = null;
      let best = spec.range + DUEL_BODY_RADIUS;
      for (const f of fighters) {
        if (f.dead || !f.alive) continue;
        const dx = f.x - me.x;
        const dz = f.z - me.z;
        const d = Math.hypot(dx, dz);
        // Devant soi seulement : un cone d'une quarantaine de degres.
        if (d > best || (dx * fx + dz * fz) / (d || 1) < 0.75) continue;
        best = d;
        target = f;
      }
      if (!target) {
        playDryFire(audio.ctx, audio.master);
        return;
      }
      hitMarkerLevel = 1;
      playHitmarker(audio.ctx, audio.master);
      effects.blood(target.x * DUEL_CELL, 1.3, target.z * DUEL_CELL, 6);
      const dmg = spec.damage * (cheatsRef.current.oneShot ? 50 : 1);
      if (target.isBot) damageFighter(target, dmg, true, "Toi");
      else link.current.send("hit", { damage: dmg });
    }

    function fire() {
      if (me.dead || ended || !me.alive || buying() || roundResetAt > 0) return;
      const spec = WEAPONS[me.weapon];
      if (elapsed < me.nextShotAt) return;
      if (spec.melee) {
        punch(spec);
        return;
      }
      if (me.reloadUntil > 0) return;
      if (me.mag <= 0) {
        playDryFire(audio.ctx, audio.master);
        me.nextShotAt = elapsed + 0.3;
        return;
      }
      const ch = cheatsRef.current;
      // Entrainement et munitions infinies : le chargeur ne se vide pas.
      if (!training && !ch.infiniteAmmo) me.mag -= 1;
      me.nextShotAt = elapsed + spec.fireInterval * (ch.rapidFire ? 0.25 : 1);
      setAmmo(me.mag);
      playShot(audio.ctx, audio.master);
      recoil = 1;
      // Le recul de la camera est propre a l'arme : le sniper secoue, la
      // mitraillette chatouille.
      if (!ch.noRecoil) recoilKick += spec.recoil * 0.012;
      const model = currentModel();
      model.flash.visible = true;
      model.flash.rotation.z = Math.random() * Math.PI;
      muzzleUntil = elapsed + 0.045;
      pingRadar(me.x, me.z);

      // Douille ejectee a hauteur d'arme, sur la droite.
      effects.casing(
        me.x * DUEL_CELL + Math.sin(me.yaw - Math.PI / 2) * 0.3,
        DUEL_EYE_HEIGHT - 0.2,
        me.z * DUEL_CELL + Math.cos(me.yaw - Math.PI / 2) * 0.3,
        me.yaw,
      );

      // Viser immobile resserre la gerbe ; courir en tirant l'ouvre.
      const movingPenalty = movingNow ? 2 : 1;
      const aimBonus = isZoomed ? 0.35 : 1;
      const spread = ch.noRecoil ? 0 : spec.spread * movingPenalty * aimBonus;

      const base = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      let lastDist = 0;
      shotHit = false;
      shotHead = false;
      for (let p = 0; p < spec.pellets; p++) {
        const dir = base.clone();
        if (spread > 0) {
          dir.x += (Math.random() - 0.5) * spread * 2;
          dir.y += (Math.random() - 0.5) * spread * 2;
          dir.z += (Math.random() - 0.5) * spread * 2;
          dir.normalize();
        }
        lastDist = fireOnePellet(dir, spec);
      }
      if (training && elapsed >= TRAINING_START) {
        trainStats.shots += 1;
        if (shotHit) trainStats.hits += 1;
        if (shotHead) trainStats.headshots += 1;
      }

      if (!bot) {
        link.current.send("shot", {
          x: me.x,
          z: me.z,
          dx: base.x,
          dy: base.y,
          dz: base.z,
          dist: lastDist,
          w: me.weapon,
        });
      }
    }

    function startReload() {
      const spec = WEAPONS[me.weapon];
      if (spec.melee || me.dead || me.reloadUntil > 0 || me.mag >= spec.magSize) return;
      me.reloadUntil = elapsed + spec.reloadSeconds;
      setReloading(true);
      playReload(audio.ctx, audio.master);
    }

    function toggleZoom(force?: boolean) {
      const spec = WEAPONS[me.weapon];
      const want = force ?? !isZoomed;
      isZoomed = Boolean(spec.zoomFov) && want && !me.dead;
      setZoomed(isZoomed);
    }

    // --------------------------------------------------------------- entrees
    function applyLook(dx: number, dy: number) {
      // La lunette divise la sensibilite : sinon viser de loin est impossible.
      const zoomFactor = isZoomed ? 0.4 : 1;
      const s = LOOK_SENSITIVITY * sensitivity.current * zoomFactor;
      me.yaw -= dx * s;
      me.pitch = THREE.MathUtils.clamp(me.pitch - dy * s, -1.2, 1.2);
    }
    function onMouseMove(e: MouseEvent) {
      if (document.pointerLockElement !== renderer.domElement) return;
      applyLook(e.movementX, e.movementY);
    }
    function onPointerLockChange() {
      setLocked(document.pointerLockElement === renderer.domElement);
    }
    function onMouseDown(e: MouseEvent) {
      if (document.pointerLockElement !== renderer.domElement) {
        if (e.button !== 0) return;
        try {
          renderer.domElement.requestPointerLock?.()?.catch(() => {});
        } catch {
          // ignore
        }
        return;
      }
      if (e.button === 0) {
        firing = true;
      } else if (e.button === 2) {
        toggleZoom(true);
      }
    }
    function onMouseUp(e: MouseEvent) {
      if (e.button === 2) toggleZoom(false);
      else firing = false;
    }
    const SHOP_KEYS: WeaponId[] = SHOP_ORDER;
    function onKeyDown(e: KeyboardEvent) {
      keys.add(e.key.toLowerCase());
      if (e.key.toLowerCase() === "r") startReload();
      // L : allumer ou eteindre le laser sans ouvrir aucun menu.
      if (e.key.toLowerCase() === "l" && !e.repeat) {
        changeOptions({ ...optionsRef.current, laser: !optionsRef.current.laser });
      }
      // M : la grande carte de l'ile.
      if (e.key.toLowerCase() === "m" && !e.repeat && island) setBigMap((o) => !o);
      // Les chiffres se lisent sur la touche physique (e.code) : en AZERTY,
      // la touche 1 envoie « & » et l'ancien achat au clavier ne marchait pas.
      const digit = /^(Digit|Numpad)([0-9])$/.exec(e.code);
      const n = digit ? Number(digit[2]) : NaN;
      // F2 : le mode admin (comptes admin seulement, jamais en ligne).
      if (e.key === "F2" && adminEnabled) {
        e.preventDefault();
        setAdminOpen((o) => !o);
        if (document.pointerLockElement === renderer.domElement) document.exitPointerLock?.();
        return;
      }
      // G : le menu des danses ; un chiffre choisit la danse.
      if (e.key.toLowerCase() === "g" && !e.repeat) {
        if (myEmote) stopMyEmote();
        else toggleEmoteMenu(!emoteMenuRef.current);
        return;
      }
      if (emoteMenuRef.current) {
        if (n >= 1 && n <= dancesRef.current.length) startMyEmote(dancesRef.current[n - 1]);
        if (e.key === "Escape") toggleEmoteMenu(false);
        return;
      }
      // Entrainement et triche « toutes les armes » : 1 a 9 choisit l'arme.
      if ((training || cheatsRef.current.allWeapons) && n >= 1 && n <= SHOP_ORDER.length && !e.repeat) {
        if (cheatsRef.current.allWeapons) usedCheats = true;
        setOnlyWeapon(SHOP_ORDER[n - 1]);
        return;
      }
      if (eco && buying()) {
        if (n >= 1 && n <= SHOP_KEYS.length) buyWeapon(SHOP_KEYS[n - 1]);
        if (e.key.toLowerCase() === "b") setShopOpen((o) => !o);
      } else if (!e.repeat && n >= 1 && n <= MAX_SLOTS && me.inv[n - 1] && n - 1 !== me.cur) {
        equipSlot(n - 1);
      }
      // E : echanger l'arme en main contre celle qui est au sol.
      if (e.key.toLowerCase() === "e" && !e.repeat) swapWithGround();
    }
    // Molette : arme suivante ou precedente, avec un temps mort pour ne pas
    // faire defiler tout l'inventaire d'un seul coup de molette.
    let wheelReadyAt = 0;
    function onWheel(e: WheelEvent) {
      if (document.pointerLockElement !== renderer.domElement || Math.abs(e.deltaY) < 1) return;
      if (performance.now() < wheelReadyAt) return;
      wheelReadyAt = performance.now() + 140;
      cycleWeapon(e.deltaY > 0 ? 1 : -1);
    }
    function onKeyUp(e: KeyboardEvent) {
      keys.delete(e.key.toLowerCase());
    }
    function onContextMenu(e: MouseEvent) {
      e.preventDefault();
    }
    // --- Visee tactile : glisser sur la moitie droite de l'ecran ---
    let lookPointerId = -1;
    let lookLastX = 0;
    let lookLastY = 0;
    function onTouchPointerDown(e: PointerEvent) {
      if (e.pointerType !== "touch" || lookPointerId !== -1) return;
      const rect = renderer.domElement.getBoundingClientRect();
      if (e.clientX - rect.left < rect.width * 0.42) return;
      lookPointerId = e.pointerId;
      lookLastX = e.clientX;
      lookLastY = e.clientY;
      try {
        renderer.domElement.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    function onTouchPointerMove(e: PointerEvent) {
      if (e.pointerId !== lookPointerId) return;
      applyLook((e.clientX - lookLastX) * 1.5, (e.clientY - lookLastY) * 1.5);
      lookLastX = e.clientX;
      lookLastY = e.clientY;
    }
    function onTouchPointerUp(e: PointerEvent) {
      if (e.pointerId !== lookPointerId) return;
      lookPointerId = -1;
      try {
        renderer.domElement.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.addEventListener("pointerdown", onTouchPointerDown);
    renderer.domElement.addEventListener("pointermove", onTouchPointerMove);
    renderer.domElement.addEventListener("pointerup", onTouchPointerUp);
    renderer.domElement.addEventListener("pointercancel", onTouchPointerUp);

    // -------------------------------------------- saut en parachute (ile)
    let dropPhase: "choix" | "chute" | "sol" = island ? "choix" : "sol";
    /** Instant de l'atterrissage : la zone ne compte qu'a partir de la. */
    let dropAt = island ? Infinity : 0;
    let fall = 0;
    let lastDropSecond = -1;
    let lastFallShown = -1;
    function doDrop(tx: number, tz: number) {
      if (!island || dropPhase !== "choix") return;
      const [ox, oz] = nearestOpenCell(island, tx, tz);
      me.x = ox + 0.5;
      me.z = oz + 0.5;
      me.pitch = -0.75;
      fall = ISLAND_DROP_HEIGHT;
      dropPhase = "chute";
      // Six sur dix sautent sur un lieu nomme (parfois le meme que toi), les
      // autres en pleine nature : si tout le monde vise les memes maisons, la
      // moitie de la partie est eliminee dans la premiere minute.
      for (const f of fighters) {
        let aimX: number;
        let aimZ: number;
        if (Math.random() < 0.6) {
          const poi = island.pois[Math.floor(Math.random() * island.pois.length)];
          aimX = poi.x + (Math.random() - 0.5) * 16;
          aimZ = poi.y + (Math.random() - 0.5) * 16;
        } else {
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * island.radius * 0.85;
          aimX = island.width / 2 + Math.cos(a) * r;
          aimZ = island.height / 2 + Math.sin(a) * r;
        }
        const [bx, bz] = nearestOpenCell(island, aimX, aimZ);
        f.x = bx + 0.5;
        f.z = bz + 0.5;
        f.tx = f.x;
        f.tz = f.z;
        f.air = ISLAND_DROP_HEIGHT * (0.75 + Math.random() * 0.45);
        f.path = null;
      }
      setDropOpen(false);
    }

    sceneApiRef.current = {
      reload: () => startReload(),
      zoom: () => toggleZoom(),
      applyQuality: (value) => {
        quality = value;
        renderer.setPixelRatio(pixelRatioCap());
      },
      buy: (id) => buyWeapon(id),
      drop: (x, z) => doDrop(x, z),
      admin: (action) => adminAction(action),
      teleport: (x, z) => teleportTo(x, z),
      emote: (id) => startMyEmote(id),
    };

    renderer.domElement.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("wheel", onWheel, { passive: true });
    renderer.domElement.addEventListener("contextmenu", onContextMenu);

    // Alt+Tab en pleine course laissait la touche "enfoncee" : on revenait
    // en train de courir droit dans un mur, et parfois de tirer tout seul.
    function onBlur() {
      keys.clear();
      firing = false;
      lookPointerId = -1;
      touchRef.current.moveX = 0;
      touchRef.current.moveZ = 0;
      touchRef.current.firing = false;
    }
    window.addEventListener("blur", onBlur);

    // ------------------------------------------------------ reception reseau
    /** Derniere tenue appliquee a l'adversaire en ligne : on ne la refait pas a chaque paquet. */
    let remoteSkin: SkinId | null = null;
    function drainInbox() {
      const remote = fighters[0];
      const box = link.current.inbox;
      while (box.length) {
        const msg = box.shift()!;
        if (msg.event === "hit") {
          applyDamageToMe(
            Number(msg.payload.damage) || WEAPONS.fusil.damage,
            remote?.x,
            remote?.z,
            remote ?? undefined,
          );
        } else if (msg.event === "died") {
          if (remote && !remote.dead) registerFighterDeath(remote, "Toi", true);
        } else if (msg.event === "ping") {
          // On renvoie l'horodatage tel quel : c'est l'autre qui calcule.
          link.current.send("pong", { t: Number(msg.payload.t) || 0 });
        } else if (msg.event === "pong") {
          const sent = Number(msg.payload.t) || 0;
          if (sent > 0) setPing(Math.max(1, Math.round(performance.now() - sent)));
        } else if (msg.event === "shot") {
          const p = msg.payload as Record<string, number | string>;
          const wid = (p.w as WeaponId) ?? "fusil";
          const spec = WEAPONS[wid] ?? WEAPONS.fusil;
          playShot(audio.ctx, audio.master, panFor(Number(p.x), Number(p.z)));
          const s = new THREE.Vector3(
            Number(p.x) * DUEL_CELL,
            DUEL_EYE_HEIGHT,
            Number(p.z) * DUEL_CELL,
          );
          const e = s
            .clone()
            .add(
              new THREE.Vector3(Number(p.dx), Number(p.dy), Number(p.dz)).multiplyScalar(
                Number(p.dist) || 10,
              ),
            );
          effects.tracer(s, e, spec.tracer);
          effects.sparks(e.x, e.y, e.z, 8);
          pingRadar(Number(p.x), Number(p.z));
          if (remote) remote.flashUntil = elapsed + 0.05;
        }
      }
      const r = link.current.remote;
      if (r && remote) {
        remote.tx = r.x;
        remote.tz = r.z;
        remote.tyaw = r.yaw;
        remote.tpitch = r.pitch ?? 0;
        remote.moving = r.moving;
        if (r.weapon && WEAPONS[r.weapon]) remote.weapon = r.weapon;
        if (r.skin && r.skin in SKINS && r.skin !== remoteSkin) {
          remoteSkin = r.skin;
          const sk = SKINS[r.skin];
          remote.model.setLook({ cloth: sk.cloth, gear: sk.gear, visor: sk.visor });
          remote.anim?.tint((n) => n === "Swat", sk.accent);
          remote.anim?.tint((n) => n === "Visor", sk.visor);
        }
        if (r.dead && !remote.dead) remote.dead = true;
        else if (!r.dead && remote.dead) {
          remote.dead = false;
          remote.deathT = 0;
          remote.hp = DUEL_MAX_HP;
        }
      }
    }

    // ---------------------------------------------------------------- l'IA
    //
    // Un bot pense en deux temps. A intervalles (un quart de seconde), il
    // choisit QUI combattre (le plus proche qu'il voit), QUOI ramasser et
    // QUELLE arme sortir. A chaque image, il decide OU aller et tire s'il voit
    // sa cible — meme en courant vers la zone ou vers une arme.
    //
    // L'ancienne IA confondait les deux : un bot envoye vers la zone ou vers
    // une arme « ne voyait » plus personne, et en battle royale, ou il y a
    // toujours une zone ou une arme a rejoindre, les bots ne tiraient presque
    // jamais.

    /** Sur l'ile, chacun ne s'occupe que de ce qui l'entoure. */
    const SIGHT_CELLS = island ? 36 : 80;

    function chooseTarget(f: Fighter) {
      // Il vient d'etre touche : il garde son agresseur tant qu'il le voit.
      if (elapsed < f.provokedUntil) {
        const t = targetOf(f);
        if (t && hasLineOfSight(f.x, f.z, t.x, t.z)) {
          f.sees = true;
          return;
        }
      }
      const near: { d: number; isMe: boolean; ref: Fighter | null; x: number; z: number }[] = [];
      // On ne prend pas pour cible quelqu'un qui vient d'apparaitre : sinon
      // les bots l'attendent au bord de sa protection et le tuent a la seconde
      // ou elle expire.
      if (!me.dead && me.alive && elapsed >= me.safeUntil && !cheatsRef.current.invisible) {
        const d = Math.hypot(me.x - f.x, me.z - f.z);
        if (d <= SIGHT_CELLS) near.push({ d, isMe: true, ref: null, x: me.x, z: me.z });
      }
      // En duel classique il n'y a qu'un adversaire : pas de tir ami a gerer.
      if (botCount > 1) {
        for (const o of fighters) {
          if (o === f || o.dead || !o.alive || elapsed < o.safeUntil || o.air > 0) continue;
          const d = Math.hypot(o.x - f.x, o.z - f.z);
          if (d <= SIGHT_CELLS) near.push({ d, isMe: false, ref: o, x: o.x, z: o.z });
        }
      }
      near.sort((a, b) => a.d - b.d);
      f.sees = false;
      f.targetIsMe = false;
      f.targetRef = null;
      // Les lignes de vue coutent cher : les quatre plus proches suffisent.
      for (let k = 0; k < near.length && k < 4; k++) {
        const c = near[k];
        if (hasLineOfSight(f.x, f.z, c.x, c.z)) {
          f.sees = true;
          f.targetIsMe = c.isMe;
          f.targetRef = c.ref;
          return;
        }
      }
      // Personne en vue : dans l'arene on se cherche ; sur l'ile, seul un
      // adversaire tout proche (on l'entend) merite qu'on aille le debusquer.
      if (near.length > 0 && (!island || near[0].d < 12)) {
        f.targetIsMe = near[0].isMe;
        f.targetRef = near[0].ref;
      }
    }

    /** Position de la cible a cette image, ou null si elle n'existe plus. */
    function targetOf(f: Fighter): { x: number; z: number; moving: boolean } | null {
      if (f.targetIsMe) return !me.dead && me.alive && !cheatsRef.current.invisible ? { x: me.x, z: me.z, moving: movingNow } : null;
      const o = f.targetRef;
      return o && !o.dead && o.alive ? { x: o.x, z: o.z, moving: o.speed > 0.5 } : null;
    }

    /** L'objet qui vaut le detour : une arme s'il en manque, un soin s'il est blesse. */
    function lootGoalFor(f: Fighter): LootDrop | null {
      const needWeapon = f.inv.length === 0 || (Boolean(island) && f.inv.length < MAX_SLOTS);
      const needHeal = f.hp < 70;
      if (!needWeapon && !needHeal) return null;
      let best: LootDrop | null = null;
      let bestD = f.inv.length === 0 ? 40 : 18;
      for (const l of loots) {
        if (l.taken) continue;
        if (l.kind === "soin" ? !needHeal : !needWeapon || f.inv.some((s) => s.weapon === l.weapon)) continue;
        const d = Math.abs(l.x - f.x) + Math.abs(l.z - f.z);
        if (d < bestD) {
          bestD = d;
          best = l;
        }
      }
      return best;
    }

    /**
     * Avance vers (gx, gz) en suivant un chemin sur la grille. Le chemin est
     * recalcule de temps en temps, et au plus tous les tiers de seconde quand
     * la destination bouge : une cible qui court change de case sans arret.
     */
    function moveTowards(f: Fighter, gx: number, gz: number, speed: number, delta: number) {
      const cgx = THREE.MathUtils.clamp(Math.floor(gx), 0, mapW - 1);
      const cgz = THREE.MathUtils.clamp(Math.floor(gz), 0, mapH - 1);
      const goal = cgz * mapW + cgx;
      f.repathTimer -= delta;
      if (f.repathTimer <= 0 || (goal !== f.pathGoal && f.repathTimer < 0.55)) {
        f.repathTimer = 0.85 + Math.random() * 0.3;
        f.pathGoal = goal;
        f.path = pather.find(Math.floor(f.x), Math.floor(f.z), cgx, cgz, island ? 14000 : undefined);
        f.pathIndex = 0;
      }
      let tx = gx;
      let tz = gz;
      if (f.path && f.path.length > 0) {
        // Case atteinte : on vise aussitot la suivante, sans marquer d'arret.
        while (
          f.pathIndex < f.path.length - 1 &&
          Math.hypot(f.path[f.pathIndex][0] + 0.5 - f.x, f.path[f.pathIndex][1] + 0.5 - f.z) < 0.14
        ) {
          f.pathIndex++;
        }
        const node = f.path[Math.min(f.pathIndex, f.path.length - 1)];
        tx = node[0] + 0.5;
        tz = node[1] + 0.5;
      }
      const dx = tx - f.x;
      const dz = tz - f.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.05) return;
      const step = Math.min(d, speed * delta);
      const nx = f.x + (dx / d) * step;
      const nz = f.z + (dz / d) * step;
      if (!isSolid(Math.floor(nx), Math.floor(f.z))) f.x = nx;
      if (!isSolid(Math.floor(f.x), Math.floor(nz))) f.z = nz;
    }

    /** Battle royale : un point de balade dans la zone, quand il n'a rien d'autre a faire. */
    function wander(f: Fighter, zone: { x: number; z: number; r: number }, speed: number, delta: number) {
      const stale =
        Number.isNaN(f.wanderX) ||
        Math.hypot(f.wanderX - f.x, f.wanderZ - f.z) < 1.5 ||
        Math.hypot(f.wanderX - zone.x, f.wanderZ - zone.z) > zone.r * 0.8;
      if (stale && island) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * zone.r * 0.65;
        const [ox, oz] = nearestOpenCell(island, zone.x + Math.cos(a) * r, zone.z + Math.sin(a) * r);
        f.wanderX = ox + 0.5;
        f.wanderZ = oz + 0.5;
      }
      moveTowards(f, f.wanderX, f.wanderZ, speed * 0.8, delta);
    }

    /**
     * Un bot, une image. `zone` (battle royale) : le cercle a rejoindre en
     * priorite quand il s'en eloigne.
     */
    function updateBot(f: Fighter, delta: number, zone: { x: number; z: number; r: number } | null) {
      if (!f.alive) return;
      if (f.dead) {
        f.deathT = Math.min(1, f.deathT + delta * (f.anim ? 0.35 : 2.6));
        if (mode.respawn && !eco && elapsed >= f.respawnAt) {
          const s = safestSpawn(allSpawns, [{ x: me.x, z: me.z }]);
          f.x = s[0] + 0.5;
          f.z = s[1] + 0.5;
          f.hp = DUEL_MAX_HP;
          f.dead = false;
          f.deathT = 0;
          f.safeUntil = elapsed + SPAWN_PROTECT;
          f.path = null;
          if (mode.gunGame) botSetOnly(f, GUN_GAME_ORDER[Math.min(f.rank, GUN_GAME_ORDER.length - 1)]);
          for (const s of f.inv) s.mag = WEAPONS[s.weapon].magSize;
          f.mag = WEAPONS[f.weapon].magSize;
        }
        return;
      }

      const botCfg = BOT_LEVELS[optionsRef.current.bots] ?? BOT_LEVELS.normal;
      f.thinkAt -= delta;
      if (f.thinkAt <= 0) {
        f.thinkAt = 0.22 + Math.random() * 0.14;
        chooseTarget(f);
        if (mode.loot) f.lootTarget = lootGoalFor(f);
        const t = targetOf(f);
        botPickWeapon(f, t ? Math.hypot(t.x - f.x, t.z - f.z) : 12);
      }

      const spec = WEAPONS[f.weapon];
      const target = targetOf(f);
      if (!target) f.sees = false;
      const dist = target ? Math.hypot(target.x - f.x, target.z - f.z) : Infinity;
      f.seenFor = f.sees ? f.seenFor + delta : 0;
      if (f.sees && f.targetIsMe) engagingMe += 1;

      // Il danse sur sa victoire, sauf si quelqu'un s'approche.
      if (f.dance) {
        if (elapsed < f.danceUntil && !(f.sees && dist < 10)) {
          f.speed = 0;
          return;
        }
        f.dance = null;
      }

      const prevX = f.x;
      const prevZ = f.z;
      const speed = DUEL_MOVE_SPEED * 0.76 * spec.moveFactor;
      const zoneDist = zone ? Math.hypot(f.x - zone.x, f.z - zone.z) : 0;
      // Priorite 1 : rentrer dans le cercle des 80 % du rayon. Attendre d'etre
      // dehors pour reagir revenait a le condamner.
      const mustReachZone = zone !== null && zoneDist > zone.r * 0.8;
      // Jusqu'ou il accepte le combat : la portee de son arme, son temperament,
      // et sur l'ile un debut de partie calme (on s'equipe avant de chasser).
      // Touche, il riposte quoi qu'il arrive. Aux poings, seulement de tres pres.
      const provoked = elapsed < f.provokedUntil;
      let engage = spec.melee ? 4.5 : spec.range * 1.3 * f.aggro;
      if (island && !provoked) {
        engage = Math.min(engage, 26);
        // Les quatre-vingt-dix premieres secondes au sol, on s'equipe : on ne
        // tire que sur qui s'approche vraiment, et on ne se bat pas aux poings.
        if (elapsed - dropAt < 90) engage = spec.melee ? 0 : Math.min(engage, 6);
      }
      if (provoked && !spec.melee) engage = Math.max(engage, spec.range * 1.6);
      const fights = target !== null && f.sees && dist <= engage;

      if (mustReachZone && zone) {
        moveTowards(f, zone.x, zone.z, speed * 1.05, delta);
      } else if (fights && target) {
        // Distance a laquelle il se sent bien : au pompe il colle, au sniper il
        // garde ses distances. C'est ce qui donne aux bots des caracteres.
        const ideal = spec.melee ? 0.8 : spec.id === "pompe" ? 2.5 : spec.id === "sniper" ? 11 : spec.id === "carabine" ? 9 : 6;
        if (dist > ideal + 1.5) {
          moveTowards(f, target.x, target.z, speed, delta);
        } else if (dist < ideal - 1) {
          // Trop pres : il recule en gardant la cible en vue.
          const dx = f.x - target.x;
          const dz = f.z - target.z;
          const d = Math.hypot(dx, dz) || 1;
          const nx = f.x + (dx / d) * speed * delta;
          const nz = f.z + (dz / d) * speed * delta;
          if (!isSolid(Math.floor(nx), Math.floor(nz))) {
            f.x = nx;
            f.z = nz;
          }
        } else {
          // A bonne distance il fait des pas de cote : un bot immobile est une
          // cible gratuite, et c'est ce qui rendait les duels ternes.
          if (elapsed > f.strafeUntil) {
            f.strafeUntil = elapsed + (BOT_STRAFE_SECONDS * (0.6 + Math.random() * 0.8)) / botCfg.strafe;
            f.strafeDir = Math.random() < 0.5 ? -1 : 1;
          }
          const sideA = Math.atan2(target.x - f.x, target.z - f.z) + (Math.PI / 2) * f.strafeDir;
          const nx = f.x + Math.sin(sideA) * speed * 0.9 * delta;
          const nz = f.z + Math.cos(sideA) * speed * 0.9 * delta;
          if (!isSolid(Math.floor(nx), Math.floor(nz))) {
            f.x = nx;
            f.z = nz;
          } else {
            // Il a touche un mur : il repartira de l'autre cote.
            f.strafeUntil = 0;
          }
        }
      } else if (f.lootTarget && !f.lootTarget.taken) {
        moveTowards(f, f.lootTarget.x, f.lootTarget.z, speed, delta);
      } else if (target && !island) {
        // Dans l'arene, on se cherche.
        moveTowards(f, target.x, target.z, speed, delta);
      } else if (zone) {
        wander(f, zone, speed, delta);
      }

      // Il ramasse ce qu'il traverse : sans ca, seul le joueur progresse et
      // la fin de partie oppose un sniper a des pistolets.
      for (const l of loots) {
        if (l.taken || Math.abs(f.x - l.x) > 0.9 || Math.abs(f.z - l.z) > 0.9) continue;
        if (l.kind === "soin") {
          if (f.hp < DUEL_MAX_HP) {
            f.hp = Math.min(DUEL_MAX_HP, f.hp + l.heal);
            l.taken = true;
          }
        } else if (botTakeWeapon(f, l.weapon)) {
          l.taken = true;
        }
      }

      // Il regarde sa cible s'il la voit, sinon la ou il va.
      const mdx = f.x - prevX;
      const mdz = f.z - prevZ;
      if (f.sees && target) {
        f.yaw = Math.atan2(target.x - f.x, target.z - f.z);
      } else if (Math.hypot(mdx, mdz) > 1e-4) {
        let turn = Math.atan2(mdx, mdz) - f.yaw;
        while (turn > Math.PI) turn -= Math.PI * 2;
        while (turn < -Math.PI) turn += Math.PI * 2;
        f.yaw += turn * Math.min(1, delta * 8);
      }
      f.pitch = 0;
      f.speed = Math.hypot(mdx, mdz) / Math.max(delta, 1e-4);
      f.walkPhase += f.speed * delta * 2.6;

      // --- Il frappe ou il tire ---
      if (!target || !f.sees || f.seenFor < botCfg.reaction) return;
      if (elapsed < f.nextShotAt || elapsed < f.swapUntil) return;

      if (spec.melee) {
        if (!fights || dist > spec.range + 0.3) return;
        f.nextShotAt = elapsed + spec.fireInterval * (1.2 + Math.random() * 0.6) * botCfg.fireDelay;
        const dmg = spec.damage * botCfg.damage;
        if (f.targetIsMe) applyDamageToMe(dmg, f.x, f.z, f);
        else if (f.targetRef) damageFighter(f.targetRef, dmg * BOT_VS_BOT_DAMAGE, false, f.name, f);
        playImpact(audio.ctx, audio.master, panFor(f.x, f.z));
        return;
      }

      // Hors de portee (ou pas encore decide a se battre) : il ne tire pas.
      if (!fights || dist > spec.range * 1.6) return;
      if (f.reloadUntil > elapsed) return;
      if (f.mag <= 0) {
        f.reloadUntil = elapsed + spec.reloadSeconds;
        f.mag = spec.magSize;
        f.nextShotAt = elapsed + spec.reloadSeconds;
        return;
      }
      f.mag -= 1;
      f.nextShotAt = elapsed + spec.fireInterval * (1.7 + Math.random() * 0.8) * botCfg.fireDelay;
      f.flashUntil = elapsed + 0.05;
      playShot(audio.ctx, audio.master, panFor(f.x, f.z));
      pingRadar(f.x, f.z);

      const from = new THREE.Vector3(f.x * DUEL_CELL, DUEL_EYE_HEIGHT, f.z * DUEL_CELL);
      const to = new THREE.Vector3(target.x * DUEL_CELL, DUEL_EYE_HEIGHT - 0.15, target.z * DUEL_CELL);
      effects.tracer(from, to, spec.tracer, spec.pellets > 1);

      // Precision : elle chute avec la distance, et encore plus si la cible
      // se deplace. Rester immobile a couvert doit rester une mauvaise idee
      // uniquement quand on est a portee.
      let accuracy = botCfg.accuracy - dist * 0.035;
      if (target.moving) accuracy -= 0.16;
      if (!f.targetIsMe) accuracy -= 0.12;
      if (dist > spec.range) accuracy *= 0.45;
      accuracy = Math.max(0.08, Math.min(0.85, accuracy));

      if (Math.random() < accuracy) {
        const dmg = spec.damage * spec.pellets * (spec.pellets > 1 ? 0.55 : 1) * botCfg.damage;
        if (f.targetIsMe) {
          applyDamageToMe(dmg, f.x, f.z, f);
          effects.blood(me.x * DUEL_CELL, 1.2, me.z * DUEL_CELL, 8);
        } else if (f.targetRef) {
          damageFighter(f.targetRef, dmg * BOT_VS_BOT_DAMAGE, false, f.name, f);
        }
      } else {
        effects.sparks(to.x + (Math.random() - 0.5), to.y + Math.random() * 0.6, to.z + (Math.random() - 0.5), 6);
      }
    }

    // ------------------------------------------------------------ la boucle
    let movingNow = false;
    /** Objet au sol sous les pieds qu'on ne peut pas prendre en passant. */
    let groundLoot: LootDrop | null = null;
    let lastHint: string | null = null;

    /** E : l'arme en main tombe au sol, celle du sol vient en main. */
    function swapWithGround() {
      const l = groundLoot;
      if (!l || l.taken || l.kind !== "arme" || me.dead || !me.alive) return;
      l.taken = true;
      if (me.inv.length === 0) {
        giveWeapon(l.weapon);
      } else {
        const old = me.inv[me.cur].weapon;
        replaceCurrent(l.weapon);
        dropLoot(me.x, me.z, "arme", old);
      }
      groundLoot = null;
      playReload(audio.ctx, audio.master);
    }

    function tick() {
      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      elapsed += delta;

      if (!bot) drainInbox();

      // ------------------------------------- battle royale : avant le sol
      if (dropPhase !== "sol") {
        currentModel().group.visible = false;
        laserBeam.visible = false;
        laserDot.visible = false;
        if (dropPhase === "choix") {
          const left = Math.max(0, Math.ceil(ISLAND_DROP_SECONDS - elapsed));
          if (left !== lastDropSecond) {
            lastDropSecond = left;
            setDropLeft(left);
          }
          if (elapsed >= ISLAND_DROP_SECONDS && island) {
            const poi = island.pois[Math.floor(Math.random() * island.pois.length)];
            doDrop(poi.x, poi.y);
          }
          // Vue d'avion au-dessus de l'ile, qui tourne lentement.
          const a = elapsed * 0.08;
          camera.position.set(worldW / 2 + Math.cos(a) * worldW * 0.55, 70, worldH / 2 + Math.sin(a) * worldH * 0.55);
          camera.lookAt(worldW / 2, 0, worldH / 2);
        } else {
          // Chute : on se dirige avec les touches, on ne tire pas encore.
          const fk = layout.current === "azerty" ? "z" : "w";
          const lk = layout.current === "azerty" ? "q" : "a";
          let gf = 0;
          let gs = 0;
          if (keys.has(fk) || keys.has("arrowup")) gf += 1;
          if (keys.has("s") || keys.has("arrowdown")) gf -= 1;
          if (keys.has(lk) || keys.has("arrowleft")) gs -= 1;
          if (keys.has("d") || keys.has("arrowright")) gs += 1;
          gf += touchRef.current.moveZ;
          gs += touchRef.current.moveX;
          const glide = (7 / DUEL_CELL) * delta;
          const gsin = Math.sin(me.yaw);
          const gcos = Math.cos(me.yaw);
          me.x = THREE.MathUtils.clamp(me.x + (-gsin * gf + gcos * gs) * glide, 1, mapW - 1);
          me.z = THREE.MathUtils.clamp(me.z + (-gcos * gf - gsin * gs) * glide, 1, mapH - 1);
          // Chute libre, puis le parachute s'ouvre a douze metres.
          fall = Math.max(0, fall - delta * (fall > 12 ? 13 : 6));
          const shown = Math.ceil(fall);
          if (shown !== lastFallShown) {
            lastFallShown = shown;
            setFallMeters(shown);
          }
          camera.position.set(me.x * DUEL_CELL, DUEL_EYE_HEIGHT + fall, me.z * DUEL_CELL);
          camera.rotation.set(me.pitch, me.yaw, 0);
          if (fall <= 0 && island) {
            if (isSolid(Math.floor(me.x), Math.floor(me.z))) {
              const [lx, lz] = nearestOpenCell(island, me.x, me.z);
              me.x = lx + 0.5;
              me.z = lz + 0.5;
            }
            dropPhase = "sol";
            dropAt = elapsed;
            me.safeUntil = elapsed + 2.5;
            me.pitch = 0;
            playRespawn(audio.ctx, audio.master);
          }
        }
        // Les bots descendent eux aussi.
        for (const f of fighters) {
          if (f.air > 0) f.air = Math.max(0, f.air - delta * 11);
          f.model.group.visible = dropPhase === "chute" && !f.anim;
          f.model.group.position.set(f.x * DUEL_CELL, f.air, f.z * DUEL_CELL);
          if (f.anim) {
            f.anim.root.visible = dropPhase === "chute";
            f.anim.root.position.set(f.x * DUEL_CELL, f.air, f.z * DUEL_CELL);
            f.anim.play("Idle_Gun_Pointing");
            f.anim.update(delta);
          }
        }
        renderer.render(scene, camera);
        return;
      }

      const spec = WEAPONS[me.weapon];
      engagingLast = engagingMe;
      engagingMe = 0;
      const ch = cheatsRef.current;
      if (!usedCheats && anyCheat(ch)) usedCheats = true;
      // Entrainement : la minute est ecoulee.
      if (training && !ended && elapsed >= TRAINING_START + training.seconds) finish(true);

      if (me.reloadUntil > 0 && elapsed >= me.reloadUntil) {
        me.reloadUntil = 0;
        me.mag = spec.magSize;
        setAmmo(spec.magSize);
        setReloading(false);
      }
      if (me.dead && me.alive && mode.respawn && !eco && elapsed >= me.respawnAt) myRespawn();
      if (eco && roundResetAt > 0 && elapsed >= roundResetAt && !ended) startRound();

      // ------------------------------------------------------- deplacement
      const forwardKey = layout.current === "azerty" ? "z" : "w";
      const leftKey = layout.current === "azerty" ? "q" : "a";
      let fwd = 0;
      let strafe = 0;
      const canAct = !me.dead && !ended && me.alive && !buying() && roundResetAt < 0;
      if (canAct) {
        if (keys.has(forwardKey) || keys.has("arrowup")) fwd += 1;
        if (keys.has("s") || keys.has("arrowdown")) fwd -= 1;
        if (keys.has(leftKey) || keys.has("arrowleft")) strafe -= 1;
        if (keys.has("d") || keys.has("arrowright")) strafe += 1;
        fwd += touchRef.current.moveZ;
        strafe += touchRef.current.moveX;
      }

      const moving = Math.abs(fwd) > 0.03 || Math.abs(strafe) > 0.03;
      movingNow = moving;
      const sprinting =
        moving && fwd > 0 && keys.has("shift") && !isZoomed && elapsed > me.nextShotAt - 0.05;
      if (moving) {
        const f = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), me.yaw);
        const r = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), me.yaw);
        const mv = new THREE.Vector3().addScaledVector(f, fwd).addScaledVector(r, strafe);
        if (mv.length() > 1) mv.normalize();
        // L'arme lourde ralentit, la lunette cloue sur place.
        const weaponSpeed = spec.moveFactor * (isZoomed ? 0.4 : 1);
        mv.multiplyScalar(DUEL_MOVE_SPEED * weaponSpeed * (sprinting ? 1.5 : 1) * (ch.speed ? 2 : 1) * delta);
        if (ch.noclip) {
          // Traverser les murs, sans sortir de la carte.
          me.x = THREE.MathUtils.clamp(me.x + mv.x, 0.6, mapW - 0.6);
          me.z = THREE.MathUtils.clamp(me.z + mv.z, 0.6, mapH - 0.6);
        } else {
          if (!circleHitsWall(me.x + mv.x, me.z)) me.x += mv.x;
          if (!circleHitsWall(me.x, me.z + mv.z)) me.z += mv.z;
        }
        if (elapsed >= nextStepAt) {
          nextStepAt = elapsed + (sprinting ? 0.26 : 0.34);
          playDuelStep(audio.ctx, audio.master, { gain: sprinting ? 0.7 : 0.5 });
        }
      }

      // Une arme automatique tire tant que le bouton est tenu ; une arme
      // semi-automatique part une seule fois, sur le FRONT de la pression.
      // Passer par le front plutot que par le gestionnaire de clic fait
      // marcher le pistolet au doigt exactement comme a la souris.
      // Bouger ou tirer arrete la danse.
      if (myEmote && (moving || firing || touchRef.current.firing || me.dead || !me.alive)) stopMyEmote();

      // Mode admin : l'aimbot tourne le regard vers la tete la plus proche
      // (en tirant ou en visant), le triggerbot tire tout seul.
      if (canAct && ch.aimbot && (firing || isZoomed || touchRef.current.firing)) {
        const tgt = aimbotTarget();
        if (tgt) {
          const d = Math.hypot(tgt.x - me.x, tgt.z - me.z);
          me.yaw = Math.atan2(-(tgt.x - me.x), -(tgt.z - me.z));
          me.pitch = Math.atan2(DUEL_HEAD_Y - DUEL_EYE_HEIGHT, d) - recoilKick;
          camera.rotation.set(me.pitch + recoilKick, me.yaw, 0);
        }
      }
      let wantFire = (firing || touchRef.current.firing) && !myEmote;
      if (canAct && ch.triggerbot && !myEmote && fighterUnderCrosshair()) wantFire = true;
      if (spec.auto ? wantFire : wantFire && !wasFiring) fire();
      wasFiring = wantFire;

      // -------------------------------------------------------- ramassage
      // Une place libre, un doublon (munitions) ou un soin : on prend en
      // passant. Inventaire plein : on propose l'echange, touche E.
      groundLoot = null;
      if (canAct) {
        for (const l of loots) {
          if (l.taken) continue;
          if (Math.hypot(me.x - l.x, me.z - l.z) >= 0.8) continue;
          if (l.kind === "soin") {
            if (me.hp >= DUEL_MAX_HP) {
              groundLoot ??= l;
              continue;
            }
            l.taken = true;
            me.hp = Math.min(DUEL_MAX_HP, me.hp + l.heal);
            setHp(me.hp);
            playReload(audio.ctx, audio.master);
            setPickupToast(`Soin +${l.heal}`);
            window.setTimeout(() => setPickupToast(null), 1400);
            continue;
          }
          const result = giveWeapon(l.weapon);
          if (result === "plein") {
            groundLoot = l;
            continue;
          }
          l.taken = true;
          playReload(audio.ctx, audio.master);
          if (result === "recharge") {
            setPickupToast(`Munitions · ${WEAPONS[l.weapon].name}`);
            window.setTimeout(() => setPickupToast(null), 1400);
          }
        }
      }
      const hint = groundLoot
        ? groundLoot.kind === "soin"
          ? "Vie déjà pleine"
          : `E : échanger contre ${WEAPONS[groundLoot.weapon].name}`
        : null;
      if (hint !== lastHint) {
        lastHint = hint;
        setPickupHint(hint);
      }
      updateLootVisuals(elapsed);

      // ------------------------------------------------------------ la zone
      if (mode.shrinkingZone) {
        const zoneTime = Math.max(0, elapsed - dropAt);
        const raw = THREE.MathUtils.clamp(
          (zoneTime - ZONE_GRACE_SECONDS) / (ZONE_SHRINK_SECONDS - ZONE_GRACE_SECONDS),
          0,
          1,
        );
        // Fermeture progressive et non lineaire : douce au debut, le temps de
        // trouver une arme et de rejoindre le centre, brutale a la fin pour
        // forcer le dernier affrontement.
        const t = Math.pow(raw, 1.7);
        // Le cercle glisse vers son centre final en meme temps qu'il se ferme.
        zoneRadius = THREE.MathUtils.lerp(startRadius, ZONE_FINAL_RADIUS, t);
        zoneCenter.x = THREE.MathUtils.lerp(mapW / 2, finalCenter.x, t);
        zoneCenter.z = THREE.MathUtils.lerp(mapH / 2, finalCenter.z, t);
        zoneMesh.visible = true;
        zoneMesh.position.set(
          zoneCenter.x * DUEL_CELL,
          DUEL_WALL_HEIGHT * 0.6,
          zoneCenter.z * DUEL_CELL,
        );
        zoneMesh.scale.set(zoneRadius * DUEL_CELL, 1, zoneRadius * DUEL_CELL);

        const myDist = Math.hypot(me.x - zoneCenter.x, me.z - zoneCenter.z);
        const outside = myDist > zoneRadius;
        if (outside && canAct && !ch.noZone && !ch.god) {
          me.hp = Math.max(0, me.hp - ZONE_DAMAGE_PER_SECOND * delta);
          setHp(Math.ceil(me.hp));
          damageLevel = Math.max(damageLevel, 0.3);
          if (me.hp <= 0) registerMyDeath("La zone", null);
        }
        setOutsideZone(outside);
        setZoneLeft(Math.max(0, ZONE_SHRINK_SECONDS - zoneTime));

        // Les bots aussi doivent rentrer, sinon ils meurent tous dehors et la
        // partie se gagne toute seule.
        const zonePlan = { x: zoneCenter.x, z: zoneCenter.z, r: zoneRadius };
        for (const f of fighters) {
          if (f.dead || !f.alive) continue;
          // Encore en l'air : il ne subit rien et ne fait rien.
          if (f.air > 0) {
            f.air = Math.max(0, f.air - delta * 11);
            continue;
          }
          const d = Math.hypot(f.x - zoneCenter.x, f.z - zoneCenter.z);
          if (d > zoneRadius) {
            f.hp = Math.max(0, f.hp - ZONE_DAMAGE_PER_SECOND * delta);
            if (f.hp <= 0) registerFighterDeath(f, "La zone", false);
          }
          if (!ch.freezeBots) updateBot(f, delta, zonePlan);
        }
      } else {
        // En Economie, tout le monde est fige pendant les achats et la fin de manche.
        if (!buying() && roundResetAt < 0) {
          for (const f of fighters) {
            if (!f.isBot) continue;
            if (training) updateTarget(f, delta);
            else if (!ch.freezeBots) updateBot(f, delta, null);
          }
        }
      }

      // Adversaire en ligne : interpolation vers l'etat recu.
      if (!bot && fighters[0]) {
        const f = fighters[0];
        const k = Math.min(1, delta * 12);
        const px = f.x;
        const pz = f.z;
        f.x += (f.tx - f.x) * k;
        f.z += (f.tz - f.z) * k;
        let dy = f.tyaw - f.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        f.yaw += dy * k;
        f.pitch += (f.tpitch - f.pitch) * k;
        f.speed = Math.hypot(f.x - px, f.z - pz) / Math.max(delta, 1e-4);
        f.walkPhase += f.speed * delta * 2.6;
        if (f.dead) f.deathT = Math.min(1, f.deathT + delta * (f.anim ? 0.35 : 2.6));
      }

      // ------------------------------------------------------------- camera
      walkPhase += moving ? delta * 9 : 0;
      recoil = Math.max(0, recoil - delta * 7);
      recoilKick = Math.max(0, recoilKick - delta * 2.4);
      camera.position.set(
        me.x * DUEL_CELL,
        DUEL_EYE_HEIGHT + (moving ? Math.sin(walkPhase * 2) * 0.022 : 0),
        me.z * DUEL_CELL,
      );
      camera.rotation.y = me.yaw;
      camera.rotation.x = me.pitch + recoilKick;
      camera.rotation.z = moving ? Math.sin(walkPhase) * 0.008 : 0;

      const targetFov = isZoomed && spec.zoomFov ? spec.zoomFov : BASE_FOV;
      if (Math.abs(camera.fov - targetFov) > 0.2) {
        camera.fov += (targetFov - camera.fov) * Math.min(1, delta * 14);
        camera.updateProjectionMatrix();
      }

      const model = currentModel();
      // En visee, l'arme vient au centre de l'ecran ; en sprint elle s'abaisse.
      aimBlend += ((isZoomed ? 1 : 0) - aimBlend) * Math.min(1, delta * 14);
      const aimLerp = aimBlend;
      model.group.position.set(
        THREE.MathUtils.lerp(GUN_BASE.x, 0, aimLerp) + (moving ? Math.sin(walkPhase) * 0.012 : 0),
        THREE.MathUtils.lerp(GUN_BASE.y, -0.12, aimLerp) +
          (moving ? Math.abs(Math.cos(walkPhase)) * 0.012 : 0) -
          recoil * 0.02 -
          (sprinting ? 0.09 : 0),
        THREE.MathUtils.lerp(GUN_BASE.z, -0.5, aimLerp) + recoil * 0.07,
      );
      model.group.rotation.x = recoil * 0.28 + (sprinting ? 0.38 : 0);
      model.group.rotation.y = THREE.MathUtils.lerp(-0.06, 0, aimLerp);
      model.group.rotation.z = sprinting ? 0.3 : 0;
      model.group.visible = !me.dead && me.alive;
      // Pieces mobiles et mains : culasse, pompe, verrou, chargeur qui tombe.
      const reloadProgress =
        me.reloadUntil > 0
          ? THREE.MathUtils.clamp(1 - (me.reloadUntil - elapsed) / spec.reloadSeconds, 0, 1)
          : 0;
      model.update({
        time: elapsed,
        recoil,
        reload: reloadProgress,
        aim: aimLerp,
        sprint: sprinting ? 1 : 0,
      });
      if (elapsed > muzzleUntil) model.flash.visible = false;

      // --- Laser : du canon jusqu'au premier mur (ou au sol) ---
      const wantLaser = optionsRef.current.laser && !me.dead && me.alive && !isZoomed;
      laserBeam.visible = wantLaser;
      laserDot.visible = wantLaser;
      if (wantLaser) {
        laserDir.set(0, 0, -1).applyQuaternion(camera.quaternion);
        // `rayWallDistance` travaille en cases : la distance revient donc en
        // cases, et on la convertit une seule fois ici.
        let t = rayWallDistance(me.x, me.z, laserDir.x, laserDir.z, 40);
        if (laserDir.y < -1e-4) t = Math.min(t, -DUEL_EYE_HEIGHT / (laserDir.y * DUEL_CELL));
        if (laserDir.y > 1e-4) t = Math.min(t, (DUEL_WALL_HEIGHT - DUEL_EYE_HEIGHT) / (laserDir.y * DUEL_CELL));
        const reach = Math.max(0.4, t * DUEL_CELL - 0.02);
        model.flash.getWorldPosition(laserFrom);
        laserTo.copy(camera.position).addScaledVector(laserDir, reach);
        const length = laserFrom.distanceTo(laserTo);
        laserBeam.position.copy(laserFrom).add(laserTo).multiplyScalar(0.5);
        laserBeam.scale.set(1, Math.max(0.01, length), 1);
        laserBeam.quaternion.setFromUnitVectors(laserUp, laserDir.clone().normalize());
        laserDot.position.copy(laserTo);
        // Le point garde a peu pres la meme taille a l'ecran, de pres comme de loin.
        laserDot.scale.setScalar(0.6 + length * 0.12);
      }

      // --- Danse : la camera sort du corps et tourne autour de l'avatar ---
      if (myEmote && myAvatar && myDancer) {
        emoteT += delta;
        model.group.visible = false;
        laserBeam.visible = false;
        laserDot.visible = false;
        myAvatar.root.visible = true;
        myAvatar.update(delta);
        myDancer.update(delta);
        const a = me.yaw + Math.PI + Math.sin(emoteT * 0.35) * 0.9;
        const dirX = Math.sin(a);
        const dirZ = Math.cos(a);
        const room = Math.min(3.4, rayWallDistance(me.x, me.z, dirX, dirZ, 3.4 / DUEL_CELL) * DUEL_CELL - 0.25);
        const back = Math.max(1.2, room);
        camera.position.set(me.x * DUEL_CELL + dirX * back, 1.75, me.z * DUEL_CELL + dirZ * back);
        camera.lookAt(me.x * DUEL_CELL, 1.05, me.z * DUEL_CELL);
      }

      // --------------------------------------------------- rendu des soldats
      for (const f of fighters) {
        // Sur l'ile, au-dela du brouillard on ne voit personne : inutile de
        // dessiner ou d'animer trente soldats.
        const inFog = island !== null && Math.hypot(f.x - me.x, f.z - me.z) > 66;
        const visible = f.alive && (!f.dead || f.deathT < 1) && !inFog;
        f.model.group.visible = visible && !f.anim;
        if (f.anim) f.anim.root.visible = visible;
        if (!visible) continue;
        const bare = WEAPONS[f.weapon].melee === true;
        if (f.animGun) f.animGun.visible = !bare;
        if (f.anim) {
          f.anim.root.position.set(f.x * DUEL_CELL, f.air, f.z * DUEL_CELL);
          f.anim.root.rotation.y = f.yaw;
          // Danse de victoire : la choregraphie remplace les animations.
          if (f.dance && elapsed < f.danceUntil && !f.dead) {
            if (!f.dancer) f.dancer = createDancer(f.anim);
            if (f.dancer.current !== f.dance) f.dancer.start(f.dance);
            if (f.animGun) f.animGun.visible = false;
            f.anim.update(delta);
            f.dancer.update(delta);
            continue;
          }
          if (f.dancer?.current) f.dancer.start(null);
          // Sens du deplacement par rapport au regard : course, pas de cote, recul.
          const mdx = f.x - f.lastAnimX;
          const mdz = f.z - f.lastAnimZ;
          f.lastAnimX = f.x;
          f.lastAnimZ = f.z;
          const shooting = elapsed < f.flashUntil + 0.35;
          let clip: string;
          if (f.dead) clip = "Death";
          else if (f.air > 0.5) clip = "Idle_Gun_Pointing";
          else if (f.speed > 0.6) {
            const forward = mdx * Math.sin(f.yaw) + mdz * Math.cos(f.yaw);
            const right = -mdx * Math.cos(f.yaw) + mdz * Math.sin(f.yaw);
            if (Math.abs(right) > Math.abs(forward) * 1.2) clip = right > 0 ? "Run_Right" : "Run_Left";
            else if (forward < 0) clip = "Run_Back";
            else clip = shooting && !bare ? "Run_Shoot" : "Run";
          } else if (bare) {
            // Mains nues : pas de pose d'arme.
            clip = "Idle_Neutral";
          } else {
            clip = shooting ? "Idle_Gun_Shoot" : f.seenFor > 0 ? "Idle_Gun_Pointing" : "Idle_Gun";
          }
          f.anim.play(clip, { loop: clip !== "Death", fade: clip === "Death" ? 0.08 : 0.18 });
          if (clip.startsWith("Run")) f.anim.setSpeed(THREE.MathUtils.clamp(f.speed / 4, 0.7, 1.5));
          f.anim.update(delta);
          if (f.animFlash) {
            f.animFlash.visible = elapsed < f.flashUntil;
            f.animFlash.rotation.z = Math.random() * Math.PI;
          }
        } else {
          f.model.group.position.set(f.x * DUEL_CELL, f.air, f.z * DUEL_CELL);
          f.model.group.rotation.y = f.yaw;
          poseSoldier(f.model, {
            walk: f.walkPhase,
            speed: f.dead ? 0 : f.speed,
            pitch: f.pitch,
            death: f.dead ? f.deathT : 0,
          });
          f.model.flash.visible = elapsed < f.flashUntil;
        }
        if (f.dead) f.deathT = Math.min(1, f.deathT + delta * (f.anim ? 0.35 : 2.2));
        else f.speed *= 0.86;
      }

      // --- Mode admin : vision a travers les murs ---
      espMesh.visible = ch.esp;
      if (ch.esp) {
        fighters.forEach((f, i) => {
          if (f.dead || !f.alive) {
            espMesh.setMatrixAt(i, espHidden);
            return;
          }
          espMatrix.makeTranslation(f.x * DUEL_CELL, f.air, f.z * DUEL_CELL);
          espMesh.setMatrixAt(i, espMatrix);
          // Du vert (vie pleine) au rouge (presque mort).
          espColor.setHSL((Math.max(0, f.hp) / DUEL_MAX_HP) * 0.33, 1, 0.55);
          espMesh.setColorAt(i, espColor);
        });
        espMesh.instanceMatrix.needsUpdate = true;
        if (espMesh.instanceColor) espMesh.instanceColor.needsUpdate = true;
      }
      if (ch.lootEsp !== lastLootEsp) {
        lastLootEsp = ch.lootEsp;
        for (const m of [beamMat, ringMat, iconMat]) {
          m.depthTest = !ch.lootEsp;
          m.needsUpdate = true;
        }
        for (const m of lootMeshes) m.renderOrder = ch.lootEsp ? 998 : 0;
      }

      effects.update(delta);

      // ---------------------------------------------------- envoi reseau
      if (!bot && elapsed >= nextNetAt) {
        nextNetAt = elapsed + 1 / DUEL_NET_HZ;
        link.current.send("state", {
          x: me.x,
          z: me.z,
          yaw: me.yaw,
          pitch: me.pitch,
          hp: me.hp,
          dead: me.dead,
          moving,
          weapon: me.weapon,
          skin,
        });
      }

      // ------------------------------------------------- retours a React
      frameCount++;
      fpsTimer += delta;
      if (fpsTimer >= 0.5) {
        if (optionsRef.current.showFps) setFps(Math.round(frameCount / fpsTimer));
        frameCount = 0;
        fpsTimer = 0;
      }
      // Ping : un aller-retour toutes les deux secondes sur le canal du duel.
      if (!bot && optionsRef.current.showPing && elapsed >= nextPingAt) {
        nextPingAt = elapsed + 2;
        lastPingSentAt = performance.now();
        link.current.send("ping", { t: lastPingSentAt });
      }
      hitMarkerLevel = Math.max(0, hitMarkerLevel - delta * 3.4);
      damageLevel = Math.max(0, damageLevel - delta * 1.5);
      uiTimer += delta;
      if (uiTimer > 0.05) {
        uiTimer = 0;
        setHitMarker(hitMarkerLevel);
        setDamageFlash(damageLevel);
        // Ouverture du reticule : elle suit la gerbe reelle de l'arme.
        setSpread(
          Math.min(1, hitMarkerLevel * 0 + recoil * 0.7 + (movingNow ? 0.3 : 0) + (sprinting ? 0.35 : 0)),
        );
        setRespawnIn(me.dead && me.alive && mode.respawn && !eco ? Math.max(0, me.respawnAt - elapsed) : 0);
        if (eco) {
          const left = buying() ? Math.max(0, buyUntil - elapsed) : 0;
          setBuyLeft(Math.ceil(left * 10) / 10);
          if (left <= 0) setShopOpen(false);
        }
        setBestRival(
          mode.gunGame
            ? fighters.reduce((m, f) => Math.max(m, f.rank), 0)
            : fighters.reduce((m, f) => Math.max(m, f.score), 0),
        );
        // Indicateur de direction des degats : il s'efface en deux secondes.
        setDamageFrom(
          lastDamageYaw !== null && elapsed - lastDamageAt < 2 ? lastDamageYaw - me.yaw : null,
        );
        if (mode.shrinkingZone || ch.radarAll) {
          while (blips.length && blips[0].until < elapsed) blips.shift();
          setRadar({
            me: [me.x / mapW, me.z / mapH],
            yaw: me.yaw,
            blips: blips.map((b) => [b.x / mapW, b.z / mapH] as [number, number]),
            zone: mode.shrinkingZone ? [zoneCenter.x / mapW, zoneCenter.z / mapH, zoneRadius / mapW] : null,
            all: ch.radarAll
              ? fighters.filter((f) => f.alive && !f.dead).map((f) => [f.x / mapW, f.z / mapH] as [number, number])
              : undefined,
          });
        }
        if (training) {
          const r = trainingResult();
          setTrainingHud({
            left: Math.max(0, TRAINING_START + training.seconds - elapsed),
            score: r.score,
            kills: r.kills,
            accuracy: r.shots > 0 ? r.hits / r.shots : 0,
            countdown: Math.max(0, TRAINING_START - elapsed),
          });
        }
        // Etiquettes de la vision a travers les murs : nom, vie, distance.
        if (ch.esp) {
          const tags: { id: number; x: number; y: number; name: string; hp: number; dist: number }[] = [];
          for (const f of fighters) {
            if (f.dead || !f.alive) continue;
            espProj.set(f.x * DUEL_CELL, f.air + 2.15, f.z * DUEL_CELL).project(camera);
            if (espProj.z > 1 || espProj.z < -1 || Math.abs(espProj.x) > 1.05 || Math.abs(espProj.y) > 1.05) continue;
            tags.push({
              id: f.id,
              x: (espProj.x + 1) * 50,
              y: (1 - espProj.y) * 50,
              name: f.name,
              hp: Math.ceil(f.hp),
              dist: Math.round(Math.hypot(f.x - me.x, f.z - me.z) * DUEL_CELL),
            });
          }
          setEspTags(tags);
          espTagsShown = true;
        } else if (espTagsShown) {
          setEspTags([]);
          espTagsShown = false;
        }
      }

      renderer.render(scene, camera);
    }
    syncWeaponUi();
    const intervalId = window.setInterval(tick, 16);
    tick();

    function handleResize() {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }
    window.addEventListener("resize", handleResize);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("mouseup", onMouseUp);
      renderer.domElement.removeEventListener("pointerdown", onTouchPointerDown);
      renderer.domElement.removeEventListener("pointermove", onTouchPointerMove);
      renderer.domElement.removeEventListener("pointerup", onTouchPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onTouchPointerUp);
      sceneApiRef.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      renderer.domElement.removeEventListener("contextmenu", onContextMenu);
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock?.();
      sceneDisposed = true;
      for (const f of fighters) {
        f.model.dispose();
        f.anim?.dispose();
      }
      espGeo.dispose();
      espMat.dispose();
      myAvatar?.dispose();
      botGunMat.dispose();
      botGunBody.dispose();
      botGunBarrel.dispose();
      botFlashMat.dispose();
      botFlashGeo.dispose();
      for (const id of Object.keys(weaponModels) as WeaponId[]) weaponModels[id].dispose();
      laserGeo.dispose();
      laserMat.dispose();
      laserDotGeo.dispose();
      laserDotMat.dispose();
      effects.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      floorTex.dispose();
      ceilingGeo.dispose();
      ceilingMat.dispose();
      ceilingTex.dispose();
      decor?.dispose();
      if (sea) {
        sea.geometry.dispose();
        (sea.material as THREE.Material).dispose();
      }
      wallGeo.dispose();
      wallMat.dispose();
      wallTex.dispose();
      zoneGeo.dispose();
      zoneMat.dispose();
      beamGeo.dispose();
      beamMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      iconGeo.dispose();
      iconMat.dispose();
      audio.stop();
      audio.ctx.close().catch(() => {});
      // Libere la carte graphique tout de suite : sinon les contextes WebGL
      // s'accumulent a chaque aller-retour et le navigateur finit par en tuer un.
      renderer.forceContextLoss();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, bot, modeId]);

  const hpPct = Math.max(0, Math.round(hp));
  const scoreGoal = mode.gunGame ? GUN_GAME_ORDER.length : mode.scoreToWin;

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-black select-none">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 50%, transparent 42%, rgba(190,20,20,${(
            damageFlash * 0.55
          ).toFixed(2)}) 100%)`,
        }}
      />

      {/* Hors zone : tout l'ecran vire au bleu froid, on ne peut pas l'ignorer. */}
      {outsideZone && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            boxShadow: "inset 0 0 140px rgba(60,160,255,0.55)",
            animation: "horror-breathe 1.1s ease-in-out infinite",
          }}
        />
      )}

      {/* Battle royale : choix du point d'atterrissage */}
      {island && dropOpen && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 overflow-y-auto bg-[#061528]/80 p-3 backdrop-blur-sm">
          <div className="text-center">
            <p className="text-3xl font-black uppercase italic text-white drop-shadow sm:text-4xl">Choisis où atterrir</p>
            <p className="mt-1 text-sm font-semibold text-sky-100">
              Clique sur la carte · saut automatique dans{" "}
              <span className="font-mono font-black text-yellow-300">{dropLeft} s</span> · {mode.bots + 1} joueurs
            </p>
          </div>
          <div className="aspect-square w-full max-w-[min(78vh,640px)] overflow-hidden rounded-xl shadow-2xl ring-4 ring-white/25">
            <IslandMapView island={island} onPick={(x, y) => sceneApiRef.current?.drop(x, y)} />
          </div>
          <p className="text-xs text-sky-100/80">Pendant la chute : ZQSD pour te diriger. Touche M en partie : la carte.</p>
        </div>
      )}

      {/* Chute en parachute */}
      {island && !dropOpen && fallMeters > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-30 flex flex-col items-center">
          <p className="rounded-full bg-black/60 px-5 py-2 text-2xl font-black uppercase italic text-yellow-300">
            🪂 {fallMeters} m
          </p>
          <p className="mt-1 rounded bg-black/50 px-3 py-1 text-xs font-semibold text-white">
            ZQSD pour te diriger · la souris pour regarder
          </p>
        </div>
      )}

      {/* Grande carte de l'ile (touche M) */}
      {island && bigMap && !dropOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 p-4" onClick={() => setBigMap(false)}>
          <div className="aspect-square w-full max-w-[min(85vh,680px)] overflow-hidden rounded-xl ring-4 ring-white/25">
            <IslandMapView
              island={island}
              zone={
                radar.zone
                  ? { x: radar.zone[0] * island.width, y: radar.zone[1] * island.height, r: radar.zone[2] * island.width }
                  : null
              }
              me={{ x: radar.me[0] * island.width, y: radar.me[1] * island.height, yaw: radar.yaw }}
              onPick={adminEnabled ? (x, y) => sceneApiRef.current?.teleport(x, y) : undefined}
            />
          </div>
        </div>
      )}

      {/* Images/seconde et ping */}
      {(options.showFps || (options.showPing && !bot)) && (
        <div className="pointer-events-none absolute left-3 top-14 flex flex-col items-start gap-0.5 rounded-lg bg-black/55 px-2 py-1 font-mono text-[11px] leading-tight backdrop-blur">
          {options.showFps && (
            <span className={fps >= 50 ? "text-emerald-300" : fps >= 30 ? "text-amber-300" : "text-red-400"}>
              {fps} IPS
            </span>
          )}
          {options.showPing && !bot && (
            <span className={ping === null ? "text-zinc-500" : ping < 80 ? "text-emerald-300" : ping < 160 ? "text-amber-300" : "text-red-400"}>
              {ping === null ? "— ms" : `${ping} ms`}
            </span>
          )}
        </div>
      )}

      {/* Laser : un vrai bouton, visible en permanence (ou la touche L) */}
      <button
        type="button"
        onClick={() => changeOptions({ ...options, laser: !options.laser })}
        aria-pressed={options.laser}
        aria-label={options.laser ? "Éteindre le laser" : "Allumer le laser"}
        className={`absolute right-14 top-[6.5rem] z-30 flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-black uppercase tracking-wider backdrop-blur transition ${
          options.laser
            ? "bg-red-600/90 text-white shadow-[0_0_14px_rgba(255,60,60,0.7)] hover:bg-red-500"
            : "bg-black/70 text-zinc-300 hover:bg-black/90"
        }`}
      >
        <span className={`size-2 rounded-full ${options.laser ? "bg-white" : "bg-red-500"}`} />
        Laser
        <span className="font-mono text-[10px] opacity-60">L</span>
      </button>

      {/* Réglages du tir : réticule, laser, affichage, bots */}
      <button
        type="button"
        onClick={() => setOptionsOpen((o) => !o)}
        aria-label="Réglages du tir"
        className="absolute right-3 top-[6.5rem] z-30 flex size-9 items-center justify-center rounded-full bg-black/70 text-base text-white backdrop-blur transition hover:bg-black/90"
      >
        🎯
      </button>
      {optionsOpen && (
        <div className="absolute right-3 top-[9.5rem] z-40 max-h-[70vh] overflow-y-auto">
          <DuelOptionsPanel
            options={options}
            onChange={changeOptions}
            onClose={() => setOptionsOpen(false)}
            showBots={bot}
          />
        </div>
      )}

      <Game3DSettings
        onLayout={(l) => {
          if (layoutRef.current) layoutRef.current.current = l;
        }}
        onSensitivity={(s) => {
          sensitivityRef.current = s;
        }}
        onQuality={(q) => sceneApiRef.current?.applyQuality(q)}
        className="top-14"
      />

      {/* Mode admin : bouton, badge et panneau (F2) */}
      {adminEnabled && (
        <button
          type="button"
          onClick={() => setAdminOpen((o) => !o)}
          className={`absolute left-3 top-[6.5rem] z-30 flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-black uppercase tracking-wider backdrop-blur transition ${
            anyCheat(cheats) ? "bg-fuchsia-600/90 text-white" : "bg-black/70 text-fuchsia-200 hover:bg-black/90"
          }`}
        >
          🛠 Admin <span className="font-mono text-[10px] opacity-60">F2</span>
        </button>
      )}
      {adminEnabled && adminOpen && (
        <div className="absolute left-3 top-[9.5rem] z-40">
          <DuelAdminPanel
            cheats={cheats}
            onChange={changeCheats}
            onAction={(a) => sceneApiRef.current?.admin(a)}
            onClose={() => setAdminOpen(false)}
            island={Boolean(island)}
          />
        </div>
      )}

      {/* Vision a travers les murs : etiquettes */}
      {cheats.esp &&
        espTags.map((t) => (
          <div
            key={t.id}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded bg-black/60 px-1.5 py-0.5 text-center font-mono text-[10px] font-bold leading-tight text-white"
            style={{ left: `${t.x}%`, top: `${t.y}%` }}
          >
            {t.name}
            <br />
            <span className={t.hp > 60 ? "text-emerald-300" : t.hp > 30 ? "text-amber-300" : "text-red-400"}>{t.hp} PV</span> · {t.dist} m
          </div>
        ))}

      {/* Entrainement : compte a rebours au centre */}
      {training && trainingHud && trainingHud.countdown > 0 && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-7xl font-black text-yellow-300 drop-shadow-lg">{Math.ceil(trainingHud.countdown)}</p>
          <p className="mt-2 rounded bg-black/60 px-3 py-1 text-sm font-bold text-white">
            {training.name} · 1 à 9 pour changer d&apos;arme
          </p>
        </div>
      )}

      {/* Menu des danses (G) */}
      {emoteMenu && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 w-72 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-black/80 p-3 text-white ring-1 ring-white/20 backdrop-blur">
          <p className="mb-2 text-center text-xs font-black uppercase tracking-wider text-yellow-300">Danses · appuie sur un chiffre</p>
          <div className="grid grid-cols-2 gap-1.5">
            {dances.map((id, i) => (
              <div key={id} className="rounded-lg bg-white/10 px-2 py-1.5 text-sm font-bold">
                <span className="mr-1.5 font-mono text-xs text-yellow-300">{i + 1}</span>
                {DANCES[id].name}
              </div>
            ))}
          </div>
          <p className="mt-2 text-center text-[10px] text-zinc-400">G ou Échap pour fermer · d&apos;autres danses au casier</p>
        </div>
      )}
      {emoting && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-4 py-1.5 text-sm font-bold text-yellow-200">
          💃 {DANCES[emoting].name} · bouge ou tire pour arrêter
        </div>
      )}

      {/* Score / progression */}
      <div className="pointer-events-none absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/70 px-4 py-1.5 backdrop-blur">
        {training && trainingHud ? (
          <>
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">{training.name}</span>
            <span className="font-mono text-lg font-black text-yellow-300">{Math.ceil(trainingHud.left)} s</span>
            <span className="text-xs text-zinc-600">·</span>
            <span className="text-sm font-black text-cyan-300">{trainingHud.kills} cibles</span>
            <span className="text-xs text-zinc-600">·</span>
            <span className="font-mono text-sm text-emerald-300">{Math.round(trainingHud.accuracy * 100)} %</span>
            <span className="text-xs text-zinc-600">·</span>
            <span className="font-mono text-sm font-black text-white">{trainingHud.score} pts</span>
          </>
        ) : mode.shrinkingZone ? (
          <>
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              En vie
            </span>
            <span className="text-lg font-black text-cyan-300">{alive}</span>
            <span className="text-xs text-zinc-600">·</span>
            <span className="font-mono text-sm text-sky-300">
              {Math.floor(zoneLeft / 60)}:{String(Math.floor(zoneLeft % 60)).padStart(2, "0")}
            </span>
          </>
        ) : (
          <>
            {mode.economy && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Manche {round}
              </span>
            )}
            <span className="text-lg font-black text-cyan-300">
              {mode.gunGame ? `${myScore}` : myScore}
            </span>
            <span className="text-xs text-zinc-500">— {scoreGoal} —</span>
            <span className="text-lg font-black text-red-400">{bestRival}</span>
            {mode.economy && (
              <span className="ml-1 rounded-full bg-emerald-950/80 px-2 py-0.5 font-mono text-sm font-black text-emerald-300">
                ${money}
              </span>
            )}
          </>
        )}
      </div>

      {/* Mini-carte : en Zone (terrain trop grand), ou partout avec le radar admin. */}
      {((mode.shrinkingZone && radar.zone) || cheats.radarAll) && (
        <div className="pointer-events-none absolute right-3 top-24 size-28 rounded-lg border border-white/15 bg-black/60 backdrop-blur sm:size-32">
          <svg viewBox="0 0 100 100" className="size-full">
            {radar.zone && (
              <circle
                cx={radar.zone[0] * 100}
                cy={radar.zone[1] * 100}
                r={radar.zone[2] * 100}
                fill="rgba(73,182,255,0.10)"
                stroke="#49b6ff"
                strokeWidth="1.2"
              />
            )}
            {radar.all?.map((b, i) => (
              <circle key={`a${i}`} cx={b[0] * 100} cy={b[1] * 100} r="1.6" fill="#ff3bd4" />
            ))}
            {radar.blips.map((b, i) => (
              <circle key={i} cx={b[0] * 100} cy={b[1] * 100} r="1.8" fill="#ff6a4a" />
            ))}
            <circle cx={radar.me[0] * 100} cy={radar.me[1] * 100} r="2.4" fill="#7ff0ff" />
          </svg>
          <span className="absolute bottom-0.5 left-0 w-full text-center text-[9px] uppercase tracking-wider text-zinc-500">
            {island ? "M : carte" : "Coups de feu"}
          </span>
        </div>
      )}

      {/* Vie */}
      <div className="pointer-events-none absolute bottom-4 left-4 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-400">♥</span>
          <div className="h-2.5 w-44 overflow-hidden rounded-full bg-black/70">
            <div
              className={`h-full rounded-full transition-all ${
                hpPct < 30 ? "bg-red-500" : hpPct < 60 ? "bg-amber-400" : "bg-emerald-400"
              }`}
              style={{ width: `${hpPct}%` }}
            />
          </div>
          <span className="font-mono text-sm font-bold text-white">{hpPct}</span>
        </div>
      </div>

      {/* Arme + munitions, et l'inventaire : touches 1 a 3 ou molette */}
      <div className="pointer-events-none absolute bottom-16 right-4 flex flex-col items-end gap-1.5 text-right sm:bottom-4">
        {!mode.gunGame && (inventory.slots.length > 0 || island) && (
          <div className="flex gap-1">
            {Array.from({ length: 3 }).map((_, i) => {
              const w = inventory.slots[i];
              if (!w) {
                return (
                  <div key={i} className="flex h-10 min-w-[4.4rem] items-center justify-center rounded-md bg-black/35 ring-1 ring-white/10">
                    <span className="font-mono text-[10px] text-zinc-600">{i + 1}</span>
                  </div>
                );
              }
              return (
                <div
                  key={i}
                  className={`flex h-10 min-w-[4.4rem] flex-col items-start justify-center rounded-md px-2 ring-1 ${
                    i === inventory.cur ? "bg-cyan-500/30 ring-cyan-300" : "bg-black/60 ring-white/10"
                  }`}
                  style={{ boxShadow: `inset 0 -3px 0 ${RARITY[WEAPON_RARITY[w]].color}` }}
                >
                  <span className="font-mono text-[9px] font-bold leading-none text-zinc-400">{i + 1}</span>
                  <span className="text-[11px] font-black uppercase leading-tight text-white">{WEAPONS[w].short}</span>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">{weaponName}</p>
        {magSize > 0 ? (
          <>
            <p className="font-mono text-3xl font-black text-white">
              {reloading ? "—" : ammo}
              <span className="ml-1 text-base text-zinc-500">/ {magSize}</span>
            </p>
            <p className="text-xs font-semibold text-zinc-400">
              {reloading ? "Rechargement..." : ammo === 0 ? "R pour recharger" : "R : recharger"}
            </p>
          </>
        ) : (
          <p className="text-xs font-semibold text-amber-200">
            {island ? "Mains nues · trouve une arme" : "Corps à corps"}
          </p>
        )}
      </div>

      {/* Inventaire plein : l'objet au sol s'echange avec E */}
      {pickupHint && (
        <div className="pointer-events-none absolute bottom-44 left-1/2 -translate-x-1/2 rounded-lg bg-black/75 px-4 py-2 text-sm font-bold text-yellow-200 ring-1 ring-yellow-400/40">
          {pickupHint}
        </div>
      )}

      {/* Arme ramassee */}
      {pickupToast && (
        <div className="pointer-events-none absolute bottom-32 left-1/2 -translate-x-1/2 rounded-full bg-cyan-950/90 px-4 py-1.5 text-sm font-bold text-cyan-200 ring-1 ring-cyan-600">
          {pickupToast}
        </div>
      )}

      {/* Réticule : regle par le joueur, il s'ouvre a la course et au tir */}
      {!zoomed && <DuelCrosshair options={options} spread={spread} hit={hitMarker} />}

      {/* Lunette du sniper : un vrai masque noir, pas juste un zoom */}
      {zoomed && (
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, transparent 26%, rgba(0,0,0,0.97) 31%)",
            }}
          />
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-black/70" />
          <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-black/70" />
          <div className="absolute left-1/2 top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500" />
        </div>
      )}

      {/* D'ou viennent les tirs recus */}
      {damageFrom !== null && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="size-48"
            style={{ transform: `rotate(${-damageFrom}rad)` }}
          >
            <div
              className="absolute left-1/2 top-0 h-8 w-16 -translate-x-1/2"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,60,40,0.85), rgba(255,60,40,0))",
                clipPath: "polygon(50% 0, 100% 100%, 0 100%)",
              }}
            />
          </div>
        </div>
      )}

      {/* Journal des éliminations */}
      <div className="pointer-events-none absolute right-4 top-14 flex flex-col items-end gap-1">
        {feed.map((f) => (
          <span
            key={f.id}
            className={`rounded px-2.5 py-1 text-xs font-semibold backdrop-blur ${
              f.mine ? "bg-cyan-900/70 text-cyan-200" : "bg-red-950/70 text-red-200"
            }`}
          >
            {f.text}
          </span>
        ))}
      </div>

      {/* Economie : fin de manche */}
      {mode.economy && roundBanner && (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center">
          <p
            className={`rounded-xl bg-black/70 px-6 py-3 text-2xl font-black uppercase tracking-wider ${
              roundBanner === "Manche gagnée" ? "text-emerald-300" : "text-red-400"
            }`}
          >
            {roundBanner}
          </p>
        </div>
      )}

      {/* Economie : phase d'achat */}
      {mode.economy && buyLeft > 0 && (
        <div className="absolute inset-x-0 top-14 flex flex-col items-center gap-2 px-3">
          <div className="pointer-events-none flex items-center gap-3 rounded-full bg-black/75 px-4 py-1.5 backdrop-blur">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300">Phase d&apos;achat</span>
            <span className="font-mono text-sm font-black text-white">{buyLeft.toFixed(1)}s</span>
            <span className="text-[11px] text-zinc-400">1-9 acheter · B boutique</span>
          </div>
          {shopOpen && (
            <div className="w-full max-w-3xl rounded-2xl border border-white/15 bg-zinc-950/92 p-3 shadow-2xl backdrop-blur">
              <div className="mb-2 flex items-baseline justify-between">
                <p className="text-sm font-black uppercase tracking-wider text-white">Boutique</p>
                <p className="font-mono text-lg font-black text-emerald-300">${money}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
                {SHOP_ORDER.map((id, i) => {
                  const w = WEAPONS[id];
                  const price = WEAPON_PRICES[id];
                  const owned = weaponName === w.short;
                  const affordable = price <= money;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => sceneApiRef.current?.buy(id)}
                      disabled={owned || !affordable}
                      className={`flex flex-col items-start rounded-lg px-2.5 py-2 text-left ring-1 transition ${
                        owned
                          ? "bg-cyan-900/50 ring-cyan-500"
                          : affordable
                            ? "bg-white/5 ring-white/10 hover:bg-white/10"
                            : "cursor-not-allowed bg-white/[0.02] opacity-40 ring-white/5"
                      }`}
                    >
                      <span className="text-[10px] font-bold text-zinc-500">{i + 1}</span>
                      <span className="text-xs font-bold text-white">{w.name}</span>
                      <span className={`font-mono text-xs font-bold ${price === 0 ? "text-zinc-400" : "text-emerald-300"}`}>
                        {owned ? "Équipée" : price === 0 ? "Gratuit" : `$${price}`}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
                Manche gagnée : +$2800 · perdue : +$1500. Si tu meurs, tu repars au pistolet.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Écran de mort */}
      {respawnIn > 0 && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55">
          <p className="text-2xl font-black text-red-400">Éliminé</p>
          <p className="text-sm text-zinc-300">Réapparition dans {respawnIn.toFixed(1)}s</p>
        </div>
      )}

      {/* Commandes tactiles */}
      {touchDevice && (
        <>
          <div
            className="absolute bottom-32 left-4 size-32 touch-none rounded-full border border-white/20 bg-black/40 sm:bottom-16 sm:left-5"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              stickOrigin.current = { x: e.clientX, y: e.clientY };
              setStickOffset({ x: 0, y: 0 });
            }}
            onPointerMove={(e) => {
              const o = stickOrigin.current;
              if (!o) return;
              const dx = e.clientX - o.x;
              const dy = e.clientY - o.y;
              const max = 52;
              const len = Math.hypot(dx, dy);
              const k = len > max ? max / len : 1;
              const ox = dx * k;
              const oy = dy * k;
              setStickOffset({ x: ox, y: oy });
              touchRef.current.moveX = ox / max;
              touchRef.current.moveZ = -oy / max;
            }}
            onPointerUp={(e) => {
              try {
                e.currentTarget.releasePointerCapture(e.pointerId);
              } catch {
                // ignore
              }
              stickOrigin.current = null;
              setStickOffset({ x: 0, y: 0 });
              touchRef.current.moveX = 0;
              touchRef.current.moveZ = 0;
            }}
            onPointerCancel={() => {
              stickOrigin.current = null;
              setStickOffset({ x: 0, y: 0 });
              touchRef.current.moveX = 0;
              touchRef.current.moveZ = 0;
            }}
          >
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 size-14 rounded-full bg-white/25"
              style={{
                transform: `translate(calc(-50% + ${stickOffset.x}px), calc(-50% + ${stickOffset.y}px))`,
              }}
            />
          </div>

          <button
            type="button"
            aria-label="Tirer"
            className="absolute bottom-32 right-5 size-20 touch-none rounded-full border border-red-400/40 bg-red-600/70 text-2xl text-white active:scale-95 sm:bottom-24 sm:right-6"
            onPointerDown={() => (touchRef.current.firing = true)}
            onPointerUp={() => (touchRef.current.firing = false)}
            onPointerLeave={() => (touchRef.current.firing = false)}
            onPointerCancel={() => (touchRef.current.firing = false)}
          >
            🔥
          </button>
          <button
            type="button"
            aria-label="Recharger"
            onClick={() => sceneApiRef.current?.reload()}
            className="absolute bottom-56 right-8 size-14 touch-none rounded-full border border-white/20 bg-black/60 text-lg font-bold text-white active:scale-95 sm:bottom-24 sm:right-28"
          >
            ⟳
          </button>
          <button
            type="button"
            aria-label="Viser"
            onClick={() => sceneApiRef.current?.zoom()}
            className="absolute bottom-56 right-28 size-14 touch-none rounded-full border border-white/20 bg-black/60 text-lg font-bold text-white active:scale-95 sm:bottom-40 sm:right-28"
          >
            ⊕
          </button>
        </>
      )}

      {/* Invite de verrouillage souris (inutile au doigt) */}
      {!locked && respawnIn === 0 && !touchDevice && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="max-w-md rounded-lg bg-black/80 px-5 py-3 text-center text-sm font-semibold text-white ring-1 ring-white/20">
            Clique pour jouer · ZQSD/WASD · clic gauche : tirer · clic droit : viser · Maj : sprint ·
            R : recharger · 1-3 ou molette : changer d&apos;arme · E : échanger · G : danses · Échap : libérer la souris
          </span>
        </div>
      )}
    </div>
  );
}
