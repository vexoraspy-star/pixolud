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
  DUEL_GRAVITY,
  DUEL_JUMP_SPEED,
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
import { RARITY, SKINS, streakCoins, type SkinId } from "@/lib/duelProfile";
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
  shopIndexFromKey,
  shopKeyLabel,
  type MechCue,
  type WeaponAnim,
  type WeaponId,
  type WeaponLook,
  type WeaponModel,
  type WeaponSpec,
} from "@/lib/duelWeapons";
import { buildSoldier, poseSoldier, type SoldierParts } from "@/lib/duelSoldier";
import { createDuelEffects, type CasingKind } from "@/lib/duelEffects";
import {
  makeArenaWallTexture,
  makeArenaFloorTexture,
  makeArenaCeilingTexture,
  makeIslandGroundTexture,
  makeBuildTexture,
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
  playExplosion,
  playCrossbow,
  playBuild,
  playBreak,
  playWeaponFoley,
  playCasingTink,
  playGrenadePin,
  playGrenadeThrow,
  playGrenadeBounce,
  playGrenadeBlast,
  playSmokePop,
  playStreak,
} from "@/lib/duelAudio";
import {
  BLAST_RADIUS,
  GRENADES,
  NADE_CARRY_MAX,
  THROW_LOFT,
  THROW_SPEED,
  aimNadeAt,
  blastDamage,
  createAimArc,
  createGrenades,
  createSmokeClouds,
  type GrenadeKind,
  type LiveNade,
  type NadeBody,
  type NadeWorld,
} from "@/lib/duelGrenades";
import { loadLayout3D, loadQuality3D, loadSensitivity3D, type Quality3D } from "@/lib/settings3d";
import {
  BOT_LEVELS,
  DEFAULT_DUEL_OPTIONS,
  loadDuelOptions,
  saveDuelOptions,
  type BotLevel,
  type DuelOptions,
} from "@/lib/duelOptions";
import DuelCrosshair from "./DuelCrosshair";
import { createAnimatedModel, preloadExtraClips, type AnimatedModel } from "@/lib/models3d";
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
    /** Hauteur du saut, en metres : l'adversaire decolle vraiment du sol. */
    jump?: number;
    /** Danse en cours, pour que l'autre la VOIE (avant, elle restait chez soi). */
    dance?: DanceId | null;
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
  /** Pieces gagnees par les series (plafonnees par DuelGame). */
  streakCoins?: number;
}

/** Annonce de serie a l'ecran : eliminations rapprochees et/ou serie sans mourir. */
interface StreakBanner {
  id: number;
  multi: string | null;
  streak: string | null;
}

/** Eliminations rapprochees : au plus ce delai entre deux, en secondes. */
const MULTI_KILL_WINDOW = 4;
const MULTI_NAMES = ["Doublé !", "Triplé !", "Quadruplé !", "Carnage !"];
const STREAK_NAMES: Record<number, string> = { 3: "En feu", 5: "Inarrêtable", 8: "Légendaire" };

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
/** Premiere partie du geste : l'ancienne arme descend ; la nouvelle monte ensuite. */
const SWAP_DOWN = 0.14;
/** Lueur du tir sur les murs proches, et sur l'arme elle-meme (intensites de crete). */
const MUZZLE_LIGHT_POWER = 4;
const VM_FLASH_POWER = 0.35;
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
  infinite = false,
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
  /** Partie infinie : aucun score a atteindre, on quitte quand on veut. */
  infinite?: boolean;
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
  /** Lunette (carabine, sniper) : masque noir. */
  const [zoomed, setZoomed] = useState(false);
  /** Visee avec n'importe quelle arme a feu : le reticule s'efface, on vise par l'organe de visee. */
  const [aiming, setAiming] = useState(false);
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
  // Le mode admin s'active ou se coupe en pleine partie (bouton 🛡) : la
  // boucle, lancee une seule fois, lit le droit en direct. Coupe, toutes les
  // triches retombent aussitot.
  const adminLiveRef = useRef(adminEnabled);
  useEffect(() => {
    adminLiveRef.current = adminEnabled;
    if (!adminEnabled) cheatsRef.current = NO_CHEATS;
  }, [adminEnabled]);
  /** Triches affichees : aucune quand le mode admin est coupe. */
  const shownCheats = adminEnabled ? cheats : NO_CHEATS;
  const [adminOpen, setAdminOpen] = useState(false);
  /** Vision a travers les murs : etiquettes a l'ecran (en % de l'ecran). */
  const [espTags, setEspTags] = useState<{ id: number; x: number; y: number; name: string; hp: number; dist: number }[]>([]);
  /** Danses : le menu (touche G) et la danse en cours. */
  const [emoteMenu, setEmoteMenu] = useState(false);
  const emoteMenuRef = useRef(false);
  const [emoting, setEmoting] = useState<DanceId | null>(null);
  const dancesRef = useRef<DanceId[]>(dances);
  /** 1v1 construction : mode construction (touche F) et materiaux. */
  const [buildHud, setBuildHud] = useState<{ on: boolean; mats: number }>({ on: false, mats: 0 });
  /** Grenades : stock, et celle qu'on tient en visant. */
  const [nadeHud, setNadeHud] = useState<{ grenade: number; fumigene: number; aiming: GrenadeKind | null }>({
    grenade: training ? 0 : (mode.grenades?.grenade ?? 0),
    fumigene: training ? 0 : (mode.grenades?.fumigene ?? 0),
    aiming: null,
  });
  /** Touche de la grenade : A en AZERTY, Q en QWERTY (la touche libre a cote du deplacement). */
  const [nadeKey, setNadeKey] = useState("A");
  /** Eclair d'une explosion proche, voile d'un nuage de fumee, grenade ennemie a cote. */
  const [blastFlash, setBlastFlash] = useState(0);
  const [smokeVeil, setSmokeVeil] = useState(0);
  const [nadeWarn, setNadeWarn] = useState(false);
  const [streakBanner, setStreakBanner] = useState<StreakBanner | null>(null);
  /** Les grenades existent dans ce mode (au depart, ou au sol en battle royale). */
  const nadesInMode = !training && (Boolean(mode.grenades) || mode.arena === "zone");

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
    quit: () => void;
    /** Bouton tactile : appuyer pour viser, relacher pour lancer. */
    nadeDown: (kind?: GrenadeKind) => void;
    nadeUp: () => void;
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
      setNadeKey(loadLayout3D() === "qwerty" ? "Q" : "A");
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
    const duelMap = useZone ? null : buildDuelMap(mode.map ?? mapId);
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
      if (mode.loadout) return mode.loadout.map((w) => ({ weapon: w, mag: WEAPONS[w].magSize }));
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
    /** Visee sans lunette : un zoom leger, par le point rouge ou la hausse. */
    const ADS_FOV = 62;
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
    // Lueur du tir : UNE lumiere partagee (4 lumieres dans la scene en tout),
    // presente des le depart et pilotee par son intensite. L'ajouter ou la
    // retirer en pleine partie ferait recompiler tous les materiaux (une
    // saccade d'une seconde). En qualite « performance », on s'en passe.
    const muzzleLight = quality === "performance" ? null : new THREE.PointLight(0xffb45a, 0, 7, 2);
    if (muzzleLight) scene.add(muzzleLight);

    // --- Arme tenue : une seconde scene, dessinee par-dessus le decor ---
    // Enfant de la camera, l'arme traversait les murs quand on s'y collait
    // (le canon du sniper depasse de 60 cm le corps du joueur). Elle vit
    // maintenant dans sa propre scene, rendue apres un effacement de la
    // profondeur : plus rien ne peut passer devant elle. Sa camera reste a
    // l'origine, donc le repere de cette scene EST le repere de la vue.
    const vmScene = new THREE.Scene();
    const vmCamera = new THREE.PerspectiveCamera(BASE_FOV, camera.aspect, 0.01, 10);
    // Memes lumieres que le decor, tournees a chaque image dans le repere de
    // la vue : l'arme reste eclairee par le « soleil » de la carte.
    const vmHemi = new THREE.HemisphereLight(lightPlan.sky, lightPlan.ground, lightPlan.power);
    const vmKey = new THREE.DirectionalLight(lightPlan.key, 0.9);
    const vmFill = new THREE.DirectionalLight(lightPlan.fill, 0.5);
    // L'eclair eclaire aussi le canon et la main qui le tient.
    const vmFlashLight = new THREE.PointLight(0xffb45a, 0, 1.6, 1);
    vmScene.add(vmHemi, vmKey, vmFill, vmFlashLight);
    const keyDir = key.position.clone().normalize();
    const fillDir = fill.position.clone().normalize();
    const vmInvQ = new THREE.Quaternion();

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

    // Constructions (1v1 construction) : des murs de planches poses d'un
    // clic. Pour les collisions, les lignes de vue et les chemins des bots,
    // ce sont des cases pleines comme les autres.
    const BUILD_MAX = 180;
    const BUILD_HP = 150;
    const BUILD_COST = 10;
    const BUILD_MATS_MAX = 500;
    const buildTex = makeBuildTexture();
    const buildGeo = new THREE.BoxGeometry(DUEL_CELL, DUEL_WALL_HEIGHT, DUEL_CELL);
    const buildMat = new THREE.MeshLambertMaterial({ map: buildTex });
    const buildMesh = new THREE.InstancedMesh(buildGeo, buildMat, BUILD_MAX);
    buildMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(BUILD_MAX * 3).fill(1), 3);
    buildMesh.count = 0;
    buildMesh.frustumCulled = false;
    scene.add(buildMesh);
    // Apercu translucide de la case ou le mur va tomber : bleu si c'est
    // possible, rouge sinon.
    const ghostMat = new THREE.MeshBasicMaterial({ color: 0x5ad1ff, transparent: true, opacity: 0.2, depthWrite: false });
    const ghost = new THREE.Mesh(buildGeo, ghostMat);
    // Un contour net : la couleur seule se perdait sur le sol clair.
    const ghostEdgesGeo = new THREE.EdgesGeometry(buildGeo);
    const ghostEdges = new THREE.LineSegments(ghostEdgesGeo, new THREE.LineBasicMaterial({ color: 0xffffff }));
    ghost.add(ghostEdges);
    ghost.visible = false;
    scene.add(ghost);

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

    const effects = createDuelEffects(scene, { onCasingBounce: (kind) => casingTink(kind) });

    // ----------------------------------------------------------- grenades
    // Elles rebondissent sur la meme grille que les balles et les bots (les
    // murs construits compris : solidGrid est mis a jour en direct).
    const nadeWorld: NadeWorld = {
      cell: DUEL_CELL,
      width: mapW,
      height: mapH,
      wallHeight: DUEL_WALL_HEIGHT,
      ceiling: !useZone,
      solid: (cx, cz) => solidGrid[cz * mapW + cx] === 1,
    };
    /** Qui a lance : le joueur, un bot, ou l'adversaire en ligne (on ne fait que la montrer). */
    type NadeOwner = Fighter | "moi" | "distant";
    const grenades = createGrenades<NadeOwner>(scene, nadeWorld, {
      onBounce: (n, speed) => {
        const p = panFor(n.body.x / DUEL_CELL, n.body.z / DUEL_CELL);
        p.gain *= Math.min(1, speed / 7);
        playGrenadeBounce(audio.ctx, audio.master, p);
      },
      onDetonate: (n) => detonateNade(n),
    });
    const smokeClouds = createSmokeClouds(scene, DUEL_CELL, island ? 0xdfe3e6 : 0xa4aab0);
    const aimArc = createAimArc(scene);
    /** Grenades en poche, par sorte (aucune a l'entrainement). */
    const nadeStock = mode.grenades && !training ? mode.grenades : { grenade: 0, fumigene: 0 };
    const myNades: Record<GrenadeKind, number> = { grenade: nadeStock.grenade, fumigene: nadeStock.fumigene };

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
      vmScene.add(wm.group);
      weaponModels[id] = wm;
    }
    /** Arme affichee : l'ancienne pendant qu'elle descend, sinon celle en main. */
    let shownWeapon: WeaponId = me.weapon;
    let swapFrom: WeaponId | null = null;
    let swapFromEmpty = false;
    let swapStart = -10;
    // Cycle de tir (pompe, verrou) : son avancement pilote l'animation et les
    // bruits, sans toucher a la vraie cadence.
    let lastShotAt = -10;
    let cycleSpan = 1;
    let cycleOwner: WeaponId | null = null;
    let lastCycle = 1;
    // Rechargement : les gestes et leurs bruits, declenches au franchissement.
    let reloadCues: MechCue[] = [];
    let reloadShells = 0;
    let lastReloadP = 0;
    // Lueur du tir, fumee du canon, tintement des douilles.
    let muzzleGlow = 0;
    let glowPower = 0;
    let heat = 0;
    let smokeAcc = 0;
    let lastTinkAt = -10;
    // Vitesse du joueur (m/s) : les douilles en heritent.
    let myVelX = 0;
    let myVelZ = 0;
    let lastMeX = me.x;
    let lastMeZ = me.z;
    // Objets de travail reutilises (rien d'alloue par image).
    const vmAnim: WeaponAnim = { time: 0, recoil: 0, reload: 0, aim: 0, sprint: 0, cycle: 1, empty: false, shells: 0 };
    const vmPoint = new THREE.Vector3();
    const ejRight = new THREE.Vector3();
    const ejUp = new THREE.Vector3();
    const ejBack = new THREE.Vector3();
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
        // Pendant un changement d'arme, c'est l'ancienne qui reste a l'ecran
        // le temps de descendre : la boucle de rendu gere la bascule.
        g.visible = id === shownWeapon;
      }
    }
    applyWeaponTransform();
    const currentModel = () => weaponModels[me.weapon];

    // Grenade tenue en visant : dans la scene de l'arme, en bas a gauche,
    // dans un gant aux couleurs de la tenue. Elle part vers l'avant au lancer.
    const heldNade = new THREE.Group();
    const heldModels: Record<GrenadeKind, THREE.Group> = {
      grenade: grenades.buildModel("grenade"),
      fumigene: grenades.buildModel("fumigene"),
    };
    heldNade.add(heldModels.grenade, heldModels.fumigene);
    const gloveGeo = new THREE.BoxGeometry(0.085, 0.075, 0.1);
    const gloveMat = new THREE.MeshLambertMaterial({ color: look?.glove ?? 0x2b2f33 });
    const sleeveGeo = new THREE.BoxGeometry(0.09, 0.09, 0.3);
    const sleeveMat = new THREE.MeshLambertMaterial({ color: look?.sleeve ?? 0x3d4a3a });
    const glove = new THREE.Mesh(gloveGeo, gloveMat);
    glove.position.set(0.01, -0.035, 0.02);
    const sleeve = new THREE.Mesh(sleeveGeo, sleeveMat);
    sleeve.position.set(0.03, -0.08, 0.2);
    sleeve.rotation.x = 0.35;
    heldNade.add(glove, sleeve);
    heldNade.visible = false;
    vmScene.add(heldNade);

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
      const before = me.weapon;
      const beforeEmpty = me.mag === 0 && !WEAPONS[before].melee;
      const slot = me.inv[index];
      me.cur = slot ? index : 0;
      me.weapon = slot ? slot.weapon : "poings";
      me.mag = slot ? slot.mag : 0;
      me.reloadUntil = 0;
      me.nextShotAt = Math.max(me.nextShotAt, elapsed + SWAP_SECONDS);
      if (me.weapon !== before) {
        // Le geste : l'arme a l'ecran descend, puis la nouvelle monte. Mort
        // (reapparition, nouvelle manche), il n'y a rien a ranger : elle monte.
        if (me.dead || !me.alive) {
          swapFrom = null;
          swapStart = elapsed - SWAP_DOWN;
        } else {
          // Deux changements coup sur coup (molette) : l'arme a l'ecran repart
          // de sa hauteur actuelle au lieu de remonter d'un bond.
          const since = elapsed - swapStart;
          let k = 0;
          if (swapFrom !== null && since < SWAP_DOWN) k = (since / SWAP_DOWN) ** 2;
          else if (since < SWAP_SECONDS) k = (1 - THREE.MathUtils.clamp((since - SWAP_DOWN) / (SWAP_SECONDS - SWAP_DOWN), 0, 1)) ** 3;
          swapFrom = shownWeapon;
          swapFromEmpty = shownWeapon === before ? beforeEmpty : false;
          swapStart = elapsed - SWAP_DOWN * Math.sqrt(k);
        }
        cycleOwner = null;
        lastCycle = 1;
      }
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
    type LootKind = "arme" | "soin" | GrenadeKind;
    interface LootDrop {
      x: number;
      z: number;
      kind: LootKind;
      weapon: WeaponId;
      /** Soin : points de vie rendus. Grenades : combien il y en a. Arme : 0. */
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
          // Un butin sur cinq a une grenade a cote (un fumigene une fois sur trois).
          const g = lootRand();
          if (g < 0.2) {
            loots.push({ x: lx + 0.82, z: lz + 0.5, kind: g < 0.067 ? "fumigene" : "grenade", weapon: "poings", heal: 1, taken: false, phase: loots.length * 1.7 });
          }
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
    // (En battle royale, un elimine lache aussi ses grenades : deux tas de plus.)
    const lootCapacity = mode.loot ? loots.length + (mode.respawn ? 12 : (mode.bots + 1) * (MAX_SLOTS + 2) + 12) : 1;

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
      else if (l.kind === "grenade" || l.kind === "fumigene") lootColor.setHex(GRENADES[l.kind].loot);
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
        const small = l.kind !== "arme";
        lootPos.set(wx, 1.4, wz);
        lootScale.set(1, small ? 0.6 : 1, 1);
        lootMatrix.compose(lootPos, lootQuat, lootScale);
        beamMesh.setMatrixAt(i, lootMatrix);

        lootEuler.set(-Math.PI / 2, 0, 0);
        lootQuat.setFromEuler(lootEuler);
        lootPos.set(wx, 0.03, wz);
        lootScale.set(1, 1, 1);
        lootMatrix.compose(lootPos, lootQuat, lootScale);
        ringMesh.setMatrixAt(i, lootMatrix);

        lootEuler.set(0, time * 1.5 + l.phase, small ? 0 : 0.25);
        lootQuat.setFromEuler(lootEuler);
        lootPos.set(wx, 0.62 + Math.sin(time * 2 + l.phase) * 0.09, wz);
        // Un soin : un petit cube vert. Une grenade : un cube plus petit, olive
        // ou gris. Une arme : une silhouette allongee.
        if (l.kind === "soin") lootScale.set(0.5, 2.4, 1.9);
        else if (small) lootScale.set(0.34, 1.6, 1.3);
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
      /** 1v1 construction : ses materiaux, et quand il pourra reconstruire. */
      buildMats: number;
      nextBuildAt: number;
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
      /** Instant de la mort : le corps tombe, puis reste un moment au sol. */
      diedAt: number;
      /** Jusqu'a quand le corps reste visible avant de s'enfoncer dans le sol. */
      corpseUntil: number;
      /** Vitesse de marche lissee (cases/s) : evite les a-coups course/arret. */
      animSpeed: number;
      /** Direction de deplacement lissee, pour choisir course, pas de cote ou recul. */
      velX: number;
      velZ: number;
      /** Orientation affichee : rattrape f.yaw sans pivoter d'un coup. */
      drawYaw: number;
      /** Animation de deplacement tenue au moins un instant (evite les clignotements). */
      clipLockUntil: number;
      /** Ses grenades, et quand il pourra en relancer une. */
      nadeFrag: number;
      nadeSmoke: number;
      nextNadeAt: number;
      /** Derniere position ou il a vu sa cible (en cases), et quand. */
      lastSeenX: number;
      lastSeenZ: number;
      lastSeenAt: number;
      /** Recul d'une explosion, en cases/s : il s'amortit en une demi-seconde. */
      kbX: number;
      kbZ: number;
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
        buildMats: 200,
        nextBuildAt: 0,
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
        diedAt: -1,
        corpseUntil: 0,
        animSpeed: 0,
        velX: 0,
        velZ: 0,
        drawYaw: 0,
        clipLockUntil: 0,
        nadeFrag: nadeStock.grenade,
        nadeSmoke: nadeStock.fumigene,
        // Pas de grenade dans les premieres secondes : on laisse le temps de se placer.
        nextNadeAt: 12 + Math.random() * 14,
        lastSeenX: 0,
        lastSeenZ: 0,
        lastSeenAt: -100,
        kbX: 0,
        kbZ: 0,
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
      // Une arme a un ou deux coups se recharge sans cesse : on compte le
      // cycle complet, sinon l'arbalete passerait pour une mitrailleuse.
      const cycle = w.magSize > 0 && w.magSize <= 2 ? (w.fireInterval * w.magSize + w.reloadSeconds) / w.magSize : w.fireInterval;
      const perShot = w.damage * w.pellets * (w.burst ?? 1) + (w.explosive?.damage ?? 0);
      return (perShot / cycle) * reach * hit;
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
        const y = eyeY + dir.y * t;
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
      if (!adminLiveRef.current || ended) return;
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
      if (!adminLiveRef.current || !island || me.dead || !me.alive) return;
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
        // Les danses animees (fichier a part) arrivent en fond, pour que la
        // touche G reponde tout de suite.
        preloadExtraClips("soldat-swat").catch(() => {});
      })
      .catch(() => {});

    function startMyEmote(id: DanceId) {
      if (!myAvatar || !myDancer || me.dead || !me.alive || buying()) return;
      cancelNadeAim();
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
    let recoil = 0;
    let recoilKick = 0;
    // Montee en visee progressive : l'arme montait d'un coup au centre, ce qui
    // cassait la lecture du tir. Elle glisse maintenant en deux dixiemes.
    let aimBlend = 0;
    // Arme vivante : amplitude du balancement et sprint qui montent et
    // retombent en douceur, et inertie de l'arme quand on tourne la tete.
    let bobAmp = 0;
    let sprintBlend = 0;
    let swayX = 0;
    let swayY = 0;
    let prevYaw = 0;
    let prevPitch = 0;
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
    /** Accroupi (C tenu) : plus bas, plus lent, plus precis. */
    let crouching = false;
    let crouchBlend = 0;
    // Saut : hauteur au-dessus du sol et vitesse verticale. Tout est en
    // metres, comme le reste de la scene.
    let jumpY = 0;
    let jumpV = 0;
    let jumpWasDown = false;
    /** Hauteur des yeux : elle baisse quand on s'accroupit. */
    let eyeY = DUEL_EYE_HEIGHT;
    /** Ping radar : d'ou sont partis les derniers coups de feu. */
    const blips: { x: number; z: number; until: number }[] = [];
    const keys = new Set<string>();
    let firing = false;
    /** Fusil a rafale : balles restantes de la rafale en cours. */
    let burstLeft = 0;
    let burstAt = 0;
    let burstWeapon: WeaponId = "fusil";
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
        f.nadeFrag = nadeStock.grenade;
        f.nadeSmoke = nadeStock.fumigene;
        f.kbX = 0;
        f.kbZ = 0;
      });
      // Nouvelle manche : plus rien en vol ni en fumee, et les poches refaites.
      grenades.reset();
      smokeClouds.reset();
      cancelNadeAim();
      myNades.grenade = nadeStock.grenade;
      myNades.fumigene = nadeStock.fumigene;
      syncNadeHud();
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

    function finish(win: boolean, rank?: number, quitting = false) {
      if (ended) return;
      ended = true;
      playMatchEnd(audio.ctx, audio.master, win);
      const best = fighters.reduce((m, f) => Math.max(m, f.score), 0);
      const extra: MatchExtra = {
        cheated: usedCheats,
        training: training ? trainingResult() : undefined,
        streakCoins: streakCoinTotal,
      };
      // Victoire : on danse (la plus belle danse possedee) avant l'ecran de fin.
      const celebrate = win && !training && !quitting;
      if (celebrate) {
        const owned = dancesRef.current;
        const favorite = owned[owned.length - 1];
        if (favorite) startMyEmote(favorite);
      }
      window.setTimeout(() => onMatchEndRef.current(win, me.score, best, rank, extra), celebrate ? 2600 : quitting ? 250 : 1300);
    }

    /**
     * Quitter la partie. En partie infinie c'est la fin normale : on gagne si
     * l'on mene au score. Ailleurs, c'est un abandon.
     */
    function quitMatch() {
      if (ended) return;
      const best = fighters.reduce((m, f) => Math.max(m, f.score), 0);
      finish(infinite && me.score > best, mode.shrinkingZone ? livingCount() : undefined, true);
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
      // Partie infinie : personne ne gagne au score, on joue jusqu'a quitter.
      if (infinite) return;
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
      myKbX = 0;
      myKbZ = 0;
      // Chaque vie repart avec les grenades du mode (jamais moins que ce qu'on avait).
      myNades.grenade = Math.max(myNades.grenade, nadeStock.grenade);
      myNades.fumigene = Math.max(myNades.fumigene, nadeStock.fumigene);
      syncNadeHud();
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
      // La serie « sans mourir » s'arrete la ; la grenade en main tombe avec soi.
      lifeStreak = 0;
      cancelNadeAim();
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
      // Le corps tombe a la renverse, a l'oppose du tireur (l'animation Death
      // part vers l'arriere), puis reste au sol un moment a cote de son butin.
      f.diedAt = elapsed;
      const tireur = byMe ? { x: me.x, z: me.z } : killer;
      if (tireur) f.yaw = Math.atan2(tireur.x - f.x, tireur.z - f.z);
      f.drawYaw = f.yaw;
      effects.blood(f.x * DUEL_CELL, 1.1, f.z * DUEL_CELL, 26);
      playDeath(audio.ctx, audio.master, panFor(f.x, f.z));
      if (training) {
        // Cible abattue : une autre apparait tout de suite ailleurs.
        trainStats.kills += 1;
        trainStats.reactions.push(elapsed - f.spawnedAt);
        f.respawnAt = elapsed + 0.25;
        f.corpseUntil = f.respawnAt - 0.05;
        me.score += 1;
        setMyScore(me.score);
        return;
      }
      // Avec reapparition, le corps doit avoir disparu avant que le bot ne
      // reapparaisse ailleurs ; en battle royale, il reste 8 s.
      f.corpseUntil = mode.respawn ? f.respawnAt - 0.05 : elapsed + 8;
      maybeTaunt(killer);
      if (byMe) {
        me.score += 1;
        setMyScore(me.score);
        if (mode.gunGame) {
          me.rank = Math.min(GUN_GAME_ORDER.length, me.rank + 1);
          if (me.rank < GUN_GAME_ORDER.length) setOnlyWeapon(GUN_GAME_ORDER[me.rank]);
        }
        addFeed(`Tu as éliminé ${f.name}`, true);
        announceMyKill();
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
        // Ses grenades aussi : un petit tas par sorte, au pied du corps.
        if (f.nadeFrag > 0) dropLoot(f.x + 0.25, f.z - 0.2, "grenade", "poings", f.nadeFrag);
        if (f.nadeSmoke > 0) dropLoot(f.x - 0.25, f.z + 0.2, "fumigene", "poings", f.nadeSmoke);
        f.nadeFrag = 0;
        f.nadeSmoke = 0;
      }
      checkVictory();
      if (byMe) endRound(true);
    }

    function applyDamageToMe(amount: number, fromX?: number, fromZ?: number, killer?: Fighter, unlocked = false) {
      if (me.dead || ended || !me.alive || cheatsRef.current.god) return;
      if (elapsed < me.safeUntil) return;
      // Le plafond ne s'applique qu'aux tirs des bots : un vrai joueur en
      // ligne touche quand il touche, la zone ne rate jamais, et une grenade
      // (`unlocked`) est un evenement unique qu'on doit voir venir.
      if (killer?.isBot && !unlocked) {
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
      // Chaque balle se voit : le buste recule et le soldat s'eclaire un
      // instant, sans casser sa course (geste additif, jambes epargnees).
      if (f.hp > 0) {
        f.anim?.pulse("HitRecieve", Math.min(1, 0.45 + amount / 60));
        f.anim?.flash(0xffffff);
      }
      // Touche : il se retourne contre son agresseur, ou qu'il soit.
      if (f.isBot && (byMe || attacker)) {
        f.targetIsMe = byMe;
        f.targetRef = byMe ? null : (attacker ?? null);
        f.provokedUntil = elapsed + 6;
      }
      if (f.hp <= 0) registerFighterDeath(f, killerName, byMe, attacker);
    }

    // ----------------------------------------------------- constructions
    interface Built {
      cell: number;
      x: number;
      y: number;
      hp: number;
      bornAt: number;
      /** Pose par le joueur : lui seul peut le retirer (clic droit). */
      mine: boolean;
    }
    const builtList: Built[] = [];
    const builtAt = new Map<number, Built>();
    let builtDirty = false;
    let materials = mode.build ? 300 : 0;
    let buildMode = false;
    let buildHeld = false;
    let nextBuildAt = 0;
    let matsTick = 0;
    let lastBuildHud = "";

    /** Un cercle (un combattant) deborde-t-il sur la case (cx, cy) ? */
    function circleInCell(x: number, z: number, cx: number, cy: number, r: number) {
      const nx = THREE.MathUtils.clamp(x, cx, cx + 1);
      const nz = THREE.MathUtils.clamp(z, cy, cy + 1);
      return Math.hypot(x - nx, z - nz) < r;
    }
    function canBuildAt(cx: number, cy: number) {
      if (!mode.build || cx <= 0 || cy <= 0 || cx >= mapW - 1 || cy >= mapH - 1) return false;
      if (isSolid(cx, cy) || builtList.length >= BUILD_MAX) return false;
      // Jamais de mur sur quelqu'un : on s'y retrouverait emmure vivant.
      if (me.alive && !me.dead && circleInCell(me.x, me.z, cx, cy, DUEL_PLAYER_RADIUS + 0.03)) return false;
      for (const f of fighters) {
        if (!f.dead && f.alive && circleInCell(f.x, f.z, cx, cy, DUEL_PLAYER_RADIUS + 0.03)) return false;
      }
      return true;
    }
    function placeBuild(cx: number, cy: number, mine: boolean): boolean {
      if (!canBuildAt(cx, cy)) return false;
      const b: Built = { cell: cy * mapW + cx, x: cx, y: cy, hp: BUILD_HP, bornAt: elapsed, mine };
      builtList.push(b);
      builtAt.set(b.cell, b);
      solidGrid[b.cell] = 1;
      builtDirty = true;
      // Les chemins en cours passaient peut-etre par la : on les recalcule.
      for (const f of fighters) f.repathTimer = 0;
      playBuild(audio.ctx, audio.master, panFor(cx + 0.5, cy + 0.5));
      return true;
    }
    function removeBuild(b: Built, broken: boolean) {
      const i = builtList.indexOf(b);
      if (i < 0) return;
      builtList.splice(i, 1);
      builtAt.delete(b.cell);
      solidGrid[b.cell] = 0;
      builtDirty = true;
      for (const f of fighters) f.repathTimer = 0;
      if (broken) {
        effects.shatter((b.x + 0.5) * DUEL_CELL, 1.3, (b.y + 0.5) * DUEL_CELL);
        playBreak(audio.ctx, audio.master, panFor(b.x + 0.5, b.y + 0.5));
      }
    }
    function damageBuild(b: Built, amount: number) {
      b.hp -= amount;
      builtDirty = true;
      if (b.hp <= 0) removeBuild(b, true);
    }
    /** Le mur construit qui arrete une ligne de tir, s'il n'y a rien de plus dur avant. */
    function firstBuiltBetween(ax: number, az: number, bx: number, bz: number): Built | null {
      const dist = Math.hypot(bx - ax, bz - az);
      const steps = Math.ceil(dist * 4);
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const cx = Math.floor(ax + (bx - ax) * t);
        const cz = Math.floor(az + (bz - az) * t);
        if (!isSolid(cx, cz)) continue;
        return builtAt.get(cz * mapW + cx) ?? null;
      }
      return null;
    }
    /** La case ou poser le mur : devant soi, a un pas et demi. */
    function buildTargetCell(): [number, number] {
      const fx = -Math.sin(me.yaw);
      const fz = -Math.cos(me.yaw);
      let cx = Math.floor(me.x + fx * 1.35);
      let cy = Math.floor(me.z + fz * 1.35);
      if (cx === Math.floor(me.x) && cy === Math.floor(me.z)) {
        cx = Math.floor(me.x + fx * 1.9);
        cy = Math.floor(me.z + fz * 1.9);
      }
      return [cx, cy];
    }
    function setBuildMode(on: boolean) {
      if (!mode.build) return;
      buildMode = on && !me.dead && me.alive;
      buildHeld = false;
      firing = false;
      if (buildMode && isZoomed) toggleZoom(false);
      lastBuildHud = "";
    }
    /** Clic droit en construction : on retire son propre mur (moitie des materiaux rendue). */
    function removeAhead() {
      const [cx, cy] = buildTargetCell();
      const b = builtAt.get(cy * mapW + cx);
      if (!b || !b.mine) return;
      removeBuild(b, false);
      materials = Math.min(BUILD_MATS_MAX, materials + BUILD_COST / 2);
      lastBuildHud = "";
    }
    function updateBuilds(delta: number, canAct: boolean) {
      if (!mode.build) return;
      if (buildMode && (me.dead || !me.alive)) setBuildMode(false);
      // Les materiaux reviennent peu a peu, pour tout le monde.
      matsTick += delta;
      if (matsTick >= 1.2) {
        matsTick -= 1.2;
        materials = Math.min(BUILD_MATS_MAX, materials + 10);
        for (const f of fighters) f.buildMats = Math.min(BUILD_MATS_MAX, f.buildMats + 10);
      }
      const showGhost = buildMode && canAct;
      ghost.visible = showGhost;
      if (showGhost) {
        const [cx, cy] = buildTargetCell();
        const ok = canBuildAt(cx, cy) && (materials >= BUILD_COST || cheatsRef.current.infiniteAmmo);
        ghost.position.set((cx + 0.5) * DUEL_CELL, DUEL_WALL_HEIGHT / 2, (cy + 0.5) * DUEL_CELL);
        ghostMat.color.setHex(ok ? 0x5ad1ff : 0xff5a5a);
        (ghostEdges.material as THREE.LineBasicMaterial).color.setHex(ok ? 0xcff4ff : 0xffb4b4);
        // Clic tenu : on pose en marchant, un mur par case traversee.
        if (buildHeld && ok && elapsed >= nextBuildAt && placeBuild(cx, cy, true)) {
          if (!cheatsRef.current.infiniteAmmo) materials -= BUILD_COST;
          nextBuildAt = elapsed + 0.14;
        }
      }
      // Les murs sortent du sol en un instant, puis foncent a mesure qu'on les abime.
      const growing = builtList.some((b) => elapsed - b.bornAt < 0.2);
      if (builtDirty || growing) {
        builtList.forEach((b, i) => {
          const h = Math.max(0.05, Math.min(1, (elapsed - b.bornAt) / 0.18));
          mat4.makeScale(1, h, 1);
          mat4.setPosition((b.x + 0.5) * DUEL_CELL, (DUEL_WALL_HEIGHT / 2) * h, (b.y + 0.5) * DUEL_CELL);
          buildMesh.setMatrixAt(i, mat4);
          const k = Math.max(0, b.hp / BUILD_HP);
          buildMesh.instanceColor!.setXYZ(i, 0.6 + 0.4 * k, 0.4 + 0.6 * k, 0.34 + 0.66 * k);
        });
        buildMesh.count = builtList.length;
        buildMesh.instanceMatrix.needsUpdate = true;
        buildMesh.instanceColor!.needsUpdate = true;
        builtDirty = false;
      }
      const hud = `${buildMode ? 1 : 0}:${materials}`;
      if (hud !== lastBuildHud) {
        lastBuildHud = hud;
        setBuildHud({ on: buildMode, mats: materials });
      }
    }

    /**
     * Roquette : explosion au point (ex, ez). Les murs construits autour
     * volent en eclats, les combattants a vue prennent des degats qui
     * baissent avec la distance. `attacker` null : c'est le joueur qui tire.
     * Renvoie vrai si quelqu'un a ete touche.
     */
    function explode(
      ex: number,
      ez: number,
      spec: WeaponSpec,
      direct: Fighter | "moi" | null,
      attacker: Fighter | null,
      mult = 1,
    ): boolean {
      const blast = spec.explosive;
      if (!blast) return false;
      const r = blast.radius;
      effects.explosion(ex * DUEL_CELL, 1.1, ez * DUEL_CELL, r * DUEL_CELL * 0.55);
      playExplosion(audio.ctx, audio.master, panFor(ex, ez));
      for (let cy = Math.floor(ez - r); cy <= Math.floor(ez + r); cy++) {
        for (let cx = Math.floor(ex - r); cx <= Math.floor(ex + r); cx++) {
          const b = builtAt.get(cy * mapW + cx);
          if (b && Math.hypot(cx + 0.5 - ex, cy + 0.5 - ez) < r + 0.35) damageBuild(b, spec.damage * (spec.buildDamage ?? 1));
        }
      }
      const splash = (x: number, z: number) => {
        const d = Math.hypot(x - ex, z - ez);
        if (d > r || !hasLineOfSight(ex, ez, x, z)) return 0;
        return blast.damage * (1 - (d / r) * 0.6);
      };
      let touched = false;
      for (const f of fighters) {
        if (f.dead || !f.alive || f === attacker) continue;
        const dmg = (splash(f.x, f.z) + (f === direct ? spec.damage : 0)) * mult;
        if (dmg <= 0) continue;
        touched = true;
        effects.blood(f.x * DUEL_CELL, 1.2, f.z * DUEL_CELL, 10);
        if (attacker) damageFighter(f, dmg * BOT_VS_BOT_DAMAGE, false, attacker.name, attacker);
        else if (f.isBot) damageFighter(f, dmg * (cheatsRef.current.oneShot ? 50 : 1), true, "Toi");
        else link.current.send("hit", { damage: dmg });
      }
      // Pas de degats sur soi : seul un tir ennemi blesse le joueur.
      if (attacker && !me.dead && me.alive) {
        const dmg = (splash(me.x, me.z) + (direct === "moi" ? spec.damage : 0)) * mult;
        if (dmg > 0) {
          touched = true;
          applyDamageToMe(dmg, ex, ez, attacker);
        }
      }
      return touched;
    }

    // ------------------------------------------------------------ grenades
    /** Recul du joueur (cases/s), tremblement de camera, eclair et lueur d'une explosion. */
    let myKbX = 0;
    let myKbZ = 0;
    let shake = 0;
    let flashLevel = 0;
    let blastGlow = 0;
    const blastAt = new THREE.Vector3();
    /** Grenade en main pendant la visee, et ce qui la tient (touche, clic molette, doigt). */
    let nadeAiming: GrenadeKind | null = null;
    let nadeAimKey = "";
    let nadeLower = 0;
    let lastThrowAt = -10;
    /** Aucun bot ne lance deux grenades coup sur coup : un delai commun a tous. */
    let nextBotNadeAt = 14;
    const throwBody: NadeBody = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };
    const camFwd = new THREE.Vector3();
    let lastNadeHud = "";

    function syncNadeHud() {
      const key = `${myNades.grenade}:${myNades.fumigene}:${nadeAiming ?? ""}`;
      if (key === lastNadeHud) return;
      lastNadeHud = key;
      setNadeHud({ grenade: myNades.grenade, fumigene: myNades.fumigene, aiming: nadeAiming });
    }

    /** Touche de grenade : A en AZERTY, Q en QWERTY (la lettre libre a cote du deplacement), X pour le fumigene. */
    function nadeKindForKey(k: string): GrenadeKind | null {
      if (k === (layout.current === "azerty" ? "a" : "q")) return "grenade";
      if (k === "x") return "fumigene";
      return null;
    }

    /** On peut sortir une grenade : vivant, au sol, ni en achat ni entre deux manches. */
    function canThrowNade() {
      return !training && !me.dead && me.alive && !ended && !buying() && roundResetAt < 0 && dropPhase === "sol";
    }

    /** Maintenir : on degoupille et on vise (l'arme s'abaisse, l'arc s'affiche). */
    function startNadeAim(kind: GrenadeKind, source: string) {
      if (nadeAiming || !canThrowNade()) return;
      if (myNades[kind] <= 0 && !cheatsRef.current.infiniteAmmo) {
        playDryFire(audio.ctx, audio.master);
        return;
      }
      if (buildMode) setBuildMode(false);
      if (isZoomed) toggleZoom(false);
      stopMyEmote();
      // Un rechargement en cours est abandonne : la main quitte l'arme.
      if (me.reloadUntil > 0) {
        me.reloadUntil = 0;
        setReloading(false);
      }
      burstLeft = 0;
      nadeAiming = kind;
      nadeAimKey = source;
      playGrenadePin(audio.ctx, audio.master);
      syncNadeHud();
    }

    function cancelNadeAim() {
      if (!nadeAiming) return;
      nadeAiming = null;
      nadeAimKey = "";
      aimArc.hide();
      syncNadeHud();
    }

    /**
     * Depart et vitesse du lancer du joueur : de la main (devant l'oeil, un
     * peu a droite), dans l'axe du regard legerement releve, plus l'elan.
     */
    function myThrow(out: NadeBody) {
      camFwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
      const h = Math.hypot(camFwd.x, camFwd.z);
      const hx = h > 1e-4 ? camFwd.x / h : -Math.sin(me.yaw);
      const hz = h > 1e-4 ? camFwd.z / h : -Math.cos(me.yaw);
      const pitch = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(camFwd.y, -1, 1)) + THROW_LOFT, -1.1, 1.35);
      const c = Math.cos(pitch);
      const s = Math.sin(pitch);
      // La droite du regard vaut (-hz, hx).
      let ox = me.x * DUEL_CELL + hx * 0.35 - hz * 0.12;
      let oz = me.z * DUEL_CELL + hz * 0.35 + hx * 0.12;
      if (isSolid(Math.floor(ox / DUEL_CELL), Math.floor(oz / DUEL_CELL))) {
        ox = me.x * DUEL_CELL;
        oz = me.z * DUEL_CELL;
      }
      out.x = ox;
      out.y = Math.min(eyeY - 0.08, DUEL_WALL_HEIGHT - 0.2);
      out.z = oz;
      out.vx = hx * c * THROW_SPEED + myVelX * 0.6;
      out.vy = s * THROW_SPEED + Math.max(0, jumpV) * 0.5;
      out.vz = hz * c * THROW_SPEED + myVelZ * 0.6;
    }

    /** Relacher : la grenade part. */
    function releaseNade() {
      const kind = nadeAiming;
      if (!kind) return;
      nadeAiming = null;
      nadeAimKey = "";
      aimArc.hide();
      const infinite = cheatsRef.current.infiniteAmmo;
      if (!canThrowNade() || (myNades[kind] <= 0 && !infinite)) {
        syncNadeHud();
        return;
      }
      myThrow(throwBody);
      if (!grenades.throwNade(kind, throwBody, "moi")) {
        syncNadeHud();
        return;
      }
      if (!infinite) myNades[kind] -= 1;
      lastThrowAt = elapsed;
      me.nextShotAt = Math.max(me.nextShotAt, elapsed + 0.45);
      playGrenadeThrow(audio.ctx, audio.master);
      if (!bot) {
        link.current.send("nade", {
          k: kind,
          x: throwBody.x,
          y: throwBody.y,
          z: throwBody.z,
          vx: throwBody.vx,
          vy: throwBody.vy,
          vz: throwBody.vz,
        });
      }
      syncNadeHud();
    }

    /** Une grenade de l'adversaire en ligne : on la simule ici pour la voir. */
    function remoteNade(p: Record<string, unknown>) {
      const x = Number(p.x);
      const y = Number(p.y);
      const z = Number(p.z);
      const vx = Number(p.vx);
      const vy = Number(p.vy);
      const vz = Number(p.vz);
      if (![x, y, z, vx, vy, vz].every(Number.isFinite)) return;
      throwBody.x = THREE.MathUtils.clamp(x, 0, worldW);
      throwBody.y = THREE.MathUtils.clamp(y, 0, DUEL_WALL_HEIGHT);
      throwBody.z = THREE.MathUtils.clamp(z, 0, worldH);
      throwBody.vx = THREE.MathUtils.clamp(vx, -30, 30);
      throwBody.vy = THREE.MathUtils.clamp(vy, -30, 30);
      throwBody.vz = THREE.MathUtils.clamp(vz, -30, 30);
      if (grenades.throwNade(p.k === "fumigene" ? "fumigene" : "grenade", throwBody, "distant")) {
        playGrenadeThrow(audio.ctx, audio.master, panFor(throwBody.x / DUEL_CELL, throwBody.z / DUEL_CELL));
      }
    }

    /**
     * La meche est au bout. Fumigene : le nuage se deploie. Grenade : degats
     * selon la distance, jamais a travers un mur plein, souffle qui pousse,
     * eclair, tremblement et murs construits en miettes.
     */
    function detonateNade(n: LiveNade<NadeOwner>) {
      const b = n.body;
      const ex = b.x / DUEL_CELL;
      const ez = b.z / DUEL_CELL;
      if (n.kind === "fumigene") {
        smokeClouds.spawn(b.x, Math.max(0, b.y - 0.1), b.z);
        playSmokePop(audio.ctx, audio.master, panFor(ex, ez));
        return;
      }
      effects.grenadeBlast(b.x, b.y + 0.35, b.z);
      playGrenadeBlast(audio.ctx, audio.master, panFor(ex, ez));
      pingRadar(ex, ez);
      blastAt.set(b.x, b.y + 0.6, b.z);
      blastGlow = 1;
      // Les murs construits tout proches volent en eclats.
      if (mode.build) {
        for (let cy = Math.floor(ez - 1.6); cy <= Math.floor(ez + 1.6); cy++) {
          for (let cx = Math.floor(ex - 1.6); cx <= Math.floor(ex + 1.6); cx++) {
            const wall = builtAt.get(cy * mapW + cx);
            if (wall && Math.hypot(cx + 0.5 - ex, cy + 0.5 - ez) < 1.6) damageBuild(wall, 110);
          }
        }
      }
      const owner = n.owner;
      let touched = false;
      for (const f of fighters) {
        if (f.dead || !f.alive || f.air > 0.5) continue;
        const dx = f.x - ex;
        const dz = f.z - ez;
        const d = Math.hypot(dx, dz);
        if (d >= BLAST_RADIUS || !hasLineOfSight(ex, ez, f.x, f.z)) continue;
        // Le souffle pousse tout le monde, meme celui qui a lance.
        if (f.isBot) {
          const push = 7 * (1 - d / BLAST_RADIUS);
          f.kbX += (d > 0.05 ? dx / d : Math.random() - 0.5) * push;
          f.kbZ += (d > 0.05 ? dz / d : Math.random() - 0.5) * push;
        }
        // Pas de degats pour son propre lanceur ; ceux de l'adversaire en ligne arrivent par le reseau.
        if (owner === f || owner === "distant" || owner === null) continue;
        const dmg = blastDamage(d);
        effects.blood(f.x * DUEL_CELL, 1.2, f.z * DUEL_CELL, 10);
        if (owner === "moi") {
          touched = true;
          if (f.isBot) damageFighter(f, dmg * (cheatsRef.current.oneShot ? 50 : 1), true, "Toi");
          else link.current.send("hit", { damage: dmg });
        } else {
          damageFighter(f, dmg * BOT_VS_BOT_DAMAGE, false, owner.name, owner);
        }
      }
      if (touched) {
        hitMarkerLevel = 1;
        playHitmarker(audio.ctx, audio.master);
      }
      if (me.dead || !me.alive) return;
      const dx = me.x - ex;
      const dz = me.z - ez;
      const d = Math.hypot(dx, dz);
      const inView = d < BLAST_RADIUS * 2.5 && hasLineOfSight(ex, ez, me.x, me.z);
      if (d < BLAST_RADIUS && inView) {
        const push = 6 * (1 - d / BLAST_RADIUS);
        if (d > 0.05) {
          myKbX += (dx / d) * push;
          myKbZ += (dz / d) * push;
        }
        // Tout pres, le souffle decolle un peu du sol.
        if (d < BLAST_RADIUS * 0.45 && jumpY <= 0.001) jumpV = Math.max(jumpV, 2.6);
        if (owner !== null && owner !== "moi" && owner !== "distant") {
          const cfg = BOT_LEVELS[optionsRef.current.bots] ?? BOT_LEVELS.normal;
          applyDamageToMe(blastDamage(d) * cfg.damage, ex, ez, owner, true);
        }
      }
      // Tremblement : fort tout pres, encore sensible a dix cases, meme derriere un mur.
      shake = Math.max(shake, THREE.MathUtils.clamp(1.15 - d / (BLAST_RADIUS * 2.2), 0, 1));
      // Eclair : plein si on regarde l'explosion, adouci si elle est de cote.
      if (inView) {
        camFwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
        const fl = Math.hypot(camFwd.x, camFwd.z) || 1;
        const facing = d > 0.05 ? (-dx * camFwd.x - dz * camFwd.z) / (d * fl) : 1;
        flashLevel = Math.max(flashLevel, (1 - d / (BLAST_RADIUS * 2.5)) * (facing > 0.3 ? 1 : 0.35));
      }
    }

    /** Une grenade ennemie qui va partir tout pres du joueur : le HUD previent. */
    function hostileNadeNear(): boolean {
      if (me.dead || !me.alive) return false;
      for (const n of grenades.live) {
        if (!n.active || n.popped || n.kind !== "grenade" || n.owner === "moi") continue;
        if (Math.hypot(n.body.x / DUEL_CELL - me.x, n.body.z / DUEL_CELL - me.z) < BLAST_RADIUS * 1.1) return true;
      }
      return false;
    }

    /** Un bot lance une grenade vers (tx, tz), en cases. */
    function botThrowNade(f: Fighter, kind: GrenadeKind, tx: number, tz: number): boolean {
      throwBody.x = f.x * DUEL_CELL;
      throwBody.y = 1.45;
      throwBody.z = f.z * DUEL_CELL;
      if (!aimNadeAt(throwBody, tx * DUEL_CELL, tz * DUEL_CELL)) return false;
      // Elle part de la main, un peu devant lui (sauf s'il est colle a un mur).
      const h = Math.hypot(throwBody.vx, throwBody.vz) || 1;
      const hx = throwBody.x + (throwBody.vx / h) * 0.4;
      const hz = throwBody.z + (throwBody.vz / h) * 0.4;
      if (!isSolid(Math.floor(hx / DUEL_CELL), Math.floor(hz / DUEL_CELL))) {
        throwBody.x = hx;
        throwBody.z = hz;
      }
      if (!grenades.throwNade(kind, throwBody, f)) return false;
      if (kind === "grenade") f.nadeFrag -= 1;
      else f.nadeSmoke -= 1;
      f.yaw = Math.atan2(tx - f.x, tz - f.z);
      f.anim?.pulse("Punch", 0.7);
      f.nextShotAt = Math.max(f.nextShotAt, elapsed + 0.6);
      f.nextNadeAt = elapsed + 20 + Math.random() * 12;
      nextBotNadeAt = elapsed + (island ? 5 : 9) + Math.random() * 5;
      playGrenadeThrow(audio.ctx, audio.master, panFor(f.x, f.z));
      return true;
    }

    /**
     * A chaque reflexion d'un bot : un fumigene pour se couvrir s'il est mal en
     * point, ou une grenade la ou il a vu sa cible pour la derniere fois. Rare
     * par construction : un delai par bot, un delai commun, et un tirage.
     */
    function botConsiderNade(f: Fighter, cfg: BotLevel) {
      if (training || elapsed < nextBotNadeAt || elapsed < f.nextNadeAt) return;
      if (f.nadeFrag <= 0 && f.nadeSmoke <= 0) return;
      if (f.air > 0 || f.dance || elapsed < f.swapUntil) return;
      // Sur l'ile, le debut de partie reste calme (voir l'engagement plus bas).
      if (island && elapsed - dropAt < 90) return;
      if (f.nadeSmoke > 0 && f.sees && f.hp < 45 && elapsed < f.provokedUntil) {
        const t = targetOf(f);
        if (t) {
          const d = Math.hypot(t.x - f.x, t.z - f.z);
          if (d > 3.5 && d < 16 && Math.random() < 0.3) {
            const k = 1.8 / d;
            botThrowNade(f, "fumigene", f.x + (t.x - f.x) * k, f.z + (t.z - f.z) * k);
            return;
          }
        }
      }
      if (f.nadeFrag > 0 && !f.sees) {
        const since = elapsed - f.lastSeenAt;
        const d = Math.hypot(f.lastSeenX - f.x, f.lastSeenZ - f.z);
        // Les meilleurs bots y pensent plus souvent, et visent mieux.
        if (since > 0.7 && since < 4 && d > 3 && d < 7.5 && Math.random() < 0.12 * (cfg.accuracy / 0.62)) {
          const spread = 0.4 + (1 - cfg.accuracy) * 2;
          botThrowNade(
            f,
            "grenade",
            f.lastSeenX + (Math.random() - 0.5) * 2 * spread,
            f.lastSeenZ + (Math.random() - 0.5) * 2 * spread,
          );
        }
      }
    }

    /**
     * Une grenade qu'il a vue tomber pres de lui et qui va partir : il s'ecarte.
     * Trois bots sur dix ne la remarquent pas, sinon une grenade ne toucherait
     * jamais personne.
     */
    function nadeDangerFor(f: Fighter): LiveNade<NadeOwner> | null {
      for (const n of grenades.live) {
        if (!n.active || n.popped || n.kind !== "grenade" || n.fuse > 1.7) continue;
        const gx = n.body.x / DUEL_CELL;
        const gz = n.body.z / DUEL_CELL;
        if (Math.abs(gx - f.x) > BLAST_RADIUS || Math.abs(gz - f.z) > BLAST_RADIUS) continue;
        if (Math.hypot(gx - f.x, gz - f.z) > BLAST_RADIUS * 0.85) continue;
        if ((f.id * 37 + n.seed) % 10 < 3) continue;
        if (!hasLineOfSight(f.x, f.z, gx, gz)) continue;
        return n;
      }
      return null;
    }

    // -------------------------------------------------------------- series
    /** Eliminations sans mourir, eliminations rapprochees, et les pieces qu'elles rapportent. */
    let lifeStreak = 0;
    let multiCount = 0;
    let lastMyKillAt = -100;
    let streakCoinTotal = 0;
    let bannerSeq = 0;

    /** Une elimination du joueur : « Doublé ! », « En feu »... avec un petit son. */
    function announceMyKill() {
      if (training) return;
      multiCount = elapsed - lastMyKillAt <= MULTI_KILL_WINDOW ? multiCount + 1 : 1;
      lastMyKillAt = elapsed;
      lifeStreak += 1;
      const multi = multiCount >= 2 ? MULTI_NAMES[Math.min(multiCount, 5) - 2] : null;
      const streak = STREAK_NAMES[lifeStreak] ?? null;
      if (!multi && !streak) return;
      streakCoinTotal += streakCoins(multi ? multiCount : 0, streak ? lifeStreak : 0);
      const multiLevel = multi ? Math.min(multiCount, 5) - 1 : 0;
      const streakLevel = !streak ? 0 : lifeStreak >= 8 ? 4 : lifeStreak >= 5 ? 3 : 2;
      playStreak(audio.ctx, audio.master, Math.max(multiLevel, streakLevel));
      bannerSeq += 1;
      const id = bannerSeq;
      setStreakBanner({ id, multi, streak });
      window.setTimeout(() => setStreakBanner((b) => (b && b.id === id ? null : b)), 2300);
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
        const y = eyeY + dir.y * t;
        if (y < 0.05 || y > DUEL_HEAD_Y + DUEL_HEAD_RADIUS) continue;
        hitDist = t;
        hitTarget = f;
        headshot = Math.abs(y - DUEL_HEAD_Y) < DUEL_HEAD_RADIUS;
      }

      const start = new THREE.Vector3(me.x * DUEL_CELL, eyeY, me.z * DUEL_CELL).add(
        dir.clone().multiplyScalar(0.6),
      );
      const end = new THREE.Vector3(me.x * DUEL_CELL, eyeY, me.z * DUEL_CELL).add(
        dir.clone().multiplyScalar(hitDist),
      );
      effects.tracer(start, end, spec.tracer, spec.pellets > 1);

      if (spec.explosive) {
        // Juste avant l'impact : l'explosion part du bon cote du mur.
        const back = Math.max(0, hitDist - 0.1);
        if (explode(me.x + dir.x * back, me.z + dir.z * back, spec, hitTarget, null)) {
          shotHit = true;
          hitMarkerLevel = 1;
          playHitmarker(audio.ctx, audio.master);
        }
        return hitDist;
      }

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
        // Un mur construit encaisse la balle : il finira par ceder.
        const b = builtAt.get(Math.floor(me.z + dir.z * hitDist) * mapW + Math.floor(me.x + dir.x * hitDist));
        if (b) damageBuild(b, spec.damage * (spec.buildDamage ?? 1) * (hitDist > spec.range ? 0.5 : 1));
        effects.sparks(end.x, end.y, end.z, spec.pellets > 1 ? 6 : 14, b ? [0.9, 0.62, 0.34] : undefined);
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

    function fire(fromBurst = false) {
      if (me.dead || ended || !me.alive || buying() || roundResetAt > 0 || buildMode) return;
      const spec = WEAPONS[me.weapon];
      if (!fromBurst && elapsed < me.nextShotAt) return;
      if (spec.melee) {
        punch(spec);
        return;
      }
      if (me.reloadUntil > 0) return;
      if (me.mag <= 0) {
        burstLeft = 0;
        if (fromBurst) return;
        playDryFire(audio.ctx, audio.master);
        me.nextShotAt = elapsed + 0.3;
        return;
      }
      const ch = cheatsRef.current;
      // Entrainement et munitions infinies : le chargeur ne se vide pas.
      if (!training && !ch.infiniteAmmo) me.mag -= 1;
      if (!fromBurst) {
        me.nextShotAt = elapsed + spec.fireInterval * (ch.rapidFire ? 0.25 : 1);
        // Fusil a rafale : les balles suivantes partent seules, a intervalles.
        if (spec.burst) {
          burstLeft = spec.burst - 1;
          burstAt = elapsed + (spec.burstGap ?? 0.07);
          burstWeapon = me.weapon;
        }
      }
      setAmmo(me.mag);
      if (spec.silent) playCrossbow(audio.ctx, audio.master);
      else playShot(audio.ctx, audio.master);
      recoil = 1;
      // Le recul de la camera est propre a l'arme : le sniper secoue, la
      // mitraillette chatouille.
      if (!ch.noRecoil) recoilKick += spec.recoil * 0.012;
      const model = currentModel();
      // Eclair en etoile, lueur sur les murs et sur l'arme, chaleur du canon.
      model.fireFlash(elapsed, aimBlend);
      if (model.flashLight > 0) {
        muzzleGlow = 1;
        glowPower = model.flashLight;
        if (muzzleLight) {
          model.flash.getWorldPosition(vmPoint);
          viewToWorld(vmPoint);
          // Un peu en retrait vers l'oeil : jamais dans l'epaisseur d'un mur.
          muzzleLight.position.copy(vmPoint).lerp(camera.position, 0.25);
        }
      }
      heat = Math.min(1.6, heat + (spec.silent ? 0 : spec.auto ? 0.09 : Math.min(0.65, 0.12 + spec.recoil * 0.16)));
      // Pompe et verrou : le geste entre deux coups suit la cadence reelle.
      lastShotAt = elapsed;
      cycleSpan = Math.max(0.05, spec.fireInterval * (ch.rapidFire ? 0.25 : 1));
      cycleOwner = me.weapon;
      lastCycle = 0;
      // L'arbalete ne s'entend pas : elle n'apparait pas sur le radar.
      if (!spec.silent) pingRadar(me.x, me.z);

      // Douille ejectee par la fenetre de l'arme. Pompe et verrou l'ejectent
      // plus tard, pendant le geste ; revolver et fusil double au rechargement.
      if (model.ejectOnShot) ejectCasings(model, 1, "cote");

      // Viser immobile resserre la gerbe ; courir en tirant l'ouvre.
      const movingPenalty = movingNow ? 2 : 1;
      const aimBonus = (isZoomed ? (spec.zoomFov ? 0.35 : 0.55) : 1) * (crouching ? 0.7 : 1);
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
      // Plus de son unique cale sur des delais fixes : chaque geste sonne
      // quand l'animation le montre (voir la boucle), sur toute la duree.
      reloadShells = spec.magSize - me.mag;
      reloadCues = currentModel().reloadCues(reloadShells, me.mag === 0);
      lastReloadP = 0;
    }

    /**
     * Un point du repere de la vue (la scene de l'arme tenue) ramene dans le
     * monde. Colle a un mur, le canon passerait de l'autre cote : on rapproche
     * alors le point de l'oeil le long du meme rayon — a l'ecran, il ne bouge pas.
     */
    function viewToWorld(p: THREE.Vector3) {
      p.applyMatrix4(camera.matrixWorld);
      const ex = camera.position.x;
      const ez = camera.position.z;
      const dx = p.x - ex;
      const dz = p.z - ez;
      const h = Math.hypot(dx, dz);
      if (h < 1e-4) return p;
      const free = rayWallDistance(ex / DUEL_CELL, ez / DUEL_CELL, dx / h, dz / h, h / DUEL_CELL + 0.2) * DUEL_CELL - 0.12;
      if (free < h) {
        const s = Math.max(0.15, free) / h;
        p.set(ex + dx * s, camera.position.y + (p.y - camera.position.y) * s, ez + dz * s);
      }
      return p;
    }

    /**
     * Douilles vides : elles naissent a la fenetre d'ejection et heritent de
     * la vitesse du tireur. « cote » : projetees a droite (culasse) ;
     * « arriere » : sautees en l'air (fusil double) ; « chute » : lachees
     * (barillet du revolver).
     */
    function ejectCasings(model: WeaponModel, count: number, style: "cote" | "arriere" | "chute") {
      model.ejectPort.getWorldPosition(vmPoint);
      viewToWorld(vmPoint);
      ejRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
      ejUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
      ejBack.set(0, 0, 1).applyQuaternion(camera.quaternion);
      for (let i = 0; i < count; i++) {
        let r: number;
        let u: number;
        let b: number;
        if (style === "cote") {
          r = 1.3 + Math.random() * 0.8;
          u = 1 + Math.random() * 0.7;
          b = 0.2 + Math.random() * 0.3;
        } else if (style === "arriere") {
          r = (Math.random() - 0.5) * 0.5;
          u = 1.1 + Math.random() * 0.5;
          b = 0.9 + Math.random() * 0.4;
        } else {
          r = (Math.random() - 0.5) * 0.6;
          u = -0.2 - Math.random() * 0.3;
          b = (Math.random() - 0.5) * 0.4;
        }
        const spreadOff = (Math.random() - 0.5) * 0.03;
        effects.casing(
          vmPoint.x + ejRight.x * spreadOff,
          vmPoint.y + (Math.random() - 0.5) * 0.02,
          vmPoint.z + ejRight.z * spreadOff,
          ejRight.x * r + ejUp.x * u + ejBack.x * b + myVelX,
          ejRight.y * r + ejUp.y * u + ejBack.y * b + jumpV,
          ejRight.z * r + ejUp.z * u + ejBack.z * b + myVelZ,
          model.casing,
        );
      }
    }

    /** Un geste de l'arme vient d'avoir lieu : son bruit, et ses douilles. */
    function playCue(cue: MechCue, fromReload: boolean) {
      if (cue.sound) playWeaponFoley(audio.ctx, audio.master, cue.sound);
      if (!cue.eject) return;
      const model = currentModel();
      if (!fromReload) ejectCasings(model, 1, "cote");
      else ejectCasings(model, Math.max(1, reloadShells), model.reloadStyle === "barillet" ? "chute" : "arriere");
    }

    /** Tintement d'une douille au sol : au plus un toutes les 80 ms. */
    function casingTink(kind: CasingKind) {
      if (elapsed - lastTinkAt < 0.08) return;
      lastTinkAt = elapsed;
      playCasingTink(audio.ctx, audio.master, kind);
    }

    /** Deux passes : le decor, puis l'arme tenue par-dessus, apres effacement de la profondeur. */
    function renderFrame() {
      renderer.render(scene, camera);
      if (!weaponModels[shownWeapon].group.visible && !heldNade.visible) return;
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(vmScene, vmCamera);
      renderer.autoClear = true;
    }

    function toggleZoom(force?: boolean) {
      const spec = WEAPONS[me.weapon];
      const want = force ?? !isZoomed;
      // Toutes les armes a feu visent ; seules celles a lunette ont le masque noir.
      isZoomed = !spec.melee && want && !me.dead && !buildMode;
      setZoomed(isZoomed && Boolean(spec.zoomFov));
      setAiming(isZoomed);
    }

    // --------------------------------------------------------------- entrees
    function applyLook(dx: number, dy: number) {
      // La lunette divise la sensibilite : sinon viser de loin est impossible.
      const zoomFactor = isZoomed ? (WEAPONS[me.weapon].zoomFov ? 0.4 : 0.75) : 1;
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
      // Clic molette : la grenade (le fumigene s'il n'en reste plus), tenue tant qu'on appuie.
      if (e.button === 1) {
        e.preventDefault();
        const kind: GrenadeKind = myNades.grenade > 0 || cheatsRef.current.infiniteAmmo ? "grenade" : "fumigene";
        startNadeAim(kind, "molette");
        return;
      }
      // Clic droit pendant la visee d'une grenade : on la garde en poche.
      if (e.button === 2 && nadeAiming) {
        cancelNadeAim();
        return;
      }
      if (e.button === 0) {
        if (buildMode) buildHeld = true;
        else firing = true;
      } else if (e.button === 2) {
        if (buildMode) removeAhead();
        else toggleZoom(true);
      }
    }
    function onMouseUp(e: MouseEvent) {
      if (e.button === 1) {
        if (nadeAimKey === "molette") releaseNade();
        return;
      }
      if (e.button === 2) toggleZoom(false);
      else {
        firing = false;
        buildHeld = false;
      }
    }
    const SHOP_KEYS: WeaponId[] = SHOP_ORDER;
    function onKeyDown(e: KeyboardEvent) {
      keys.add(e.key.toLowerCase());
      // Espace : sans ca, le navigateur fait defiler la page sous le jeu a
      // chaque saut.
      if (e.code === "Space") e.preventDefault();
      if (e.key.toLowerCase() === "r" && !nadeAiming) startReload();
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
      if (e.key === "F2" && adminLiveRef.current) {
        e.preventDefault();
        setAdminOpen((o) => !o);
        if (document.pointerLockElement === renderer.domElement) document.exitPointerLock?.();
        return;
      }
      // F : construire (1v1 construction). Une touche d'arme en fait sortir.
      if (e.code === "KeyF" && !e.repeat && mode.build) {
        setBuildMode(!buildMode);
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
      // Grenades : A (AZERTY) ou Q (QWERTY), X pour le fumigene. On maintient
      // pour viser, on relache pour lancer.
      const nadeKind = e.repeat ? null : nadeKindForKey(e.key.toLowerCase());
      if (nadeKind) {
        startNadeAim(nadeKind, e.key.toLowerCase());
        return;
      }
      // Entrainement et triche « toutes les armes » : 1 a 9 puis 0 choisit
      // l'arme, Maj + chiffre les suivantes.
      if ((training || cheatsRef.current.allWeapons) && digit && !e.repeat) {
        const idx = shopIndexFromKey(n, e.shiftKey);
        if (idx >= 0 && idx < SHOP_ORDER.length) {
          if (cheatsRef.current.allWeapons) usedCheats = true;
          setOnlyWeapon(SHOP_ORDER[idx]);
          return;
        }
      }
      if (eco && buying()) {
        if (digit) {
          const idx = shopIndexFromKey(n, e.shiftKey);
          if (idx >= 0 && idx < SHOP_KEYS.length) buyWeapon(SHOP_KEYS[idx]);
        }
        if (e.key.toLowerCase() === "b") setShopOpen((o) => !o);
      } else if (!e.repeat && n >= 1 && n <= MAX_SLOTS && me.inv[n - 1]) {
        if (buildMode) setBuildMode(false);
        if (n - 1 !== me.cur) equipSlot(n - 1);
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
      if (buildMode) {
        setBuildMode(false);
        return;
      }
      cycleWeapon(e.deltaY > 0 ? 1 : -1);
    }
    function onKeyUp(e: KeyboardEvent) {
      keys.delete(e.key.toLowerCase());
      if (nadeAiming && nadeAimKey === e.key.toLowerCase()) releaseNade();
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
      quit: () => quitMatch(),
      // Au doigt, chaque bouton a sa sorte ; sans precision : la grenade, ou le fumigene s'il n'en reste plus.
      nadeDown: (kind) =>
        startNadeAim(kind ?? (myNades.grenade > 0 || cheatsRef.current.infiniteAmmo ? "grenade" : "fumigene"), "doigt"),
      nadeUp: () => {
        if (nadeAimKey === "doigt") releaseNade();
      },
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
      cancelNadeAim();
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
          if (remote) {
            remote.flashUntil = elapsed + 0.05;
            remote.anim?.pulse("Gun_Shoot", 0.7);
          }
        } else if (msg.event === "nade") {
          remoteNade(msg.payload);
        }
      }
      const r = link.current.remote;
      if (r && remote) {
        remote.tx = r.x;
        remote.tz = r.z;
        remote.tyaw = r.yaw;
        remote.tpitch = r.pitch ?? 0;
        remote.moving = r.moving;
        // Le saut de l'autre : sa hauteur arrive telle quelle, l'animation
        // « en l'air » se declenche toute seule (voir f.air plus bas).
        remote.air = Math.max(0, Number(r.jump) || 0);
        // Sa danse : sans ca, chacun dansait dans son coin et l'autre ne
        // voyait qu'un soldat immobile.
        if (r.dance && DANCES[r.dance]) {
          remote.dance = r.dance;
          remote.danceUntil = elapsed + 1.5;
        } else if (remote.dance) {
          remote.dance = null;
          remote.danceUntil = 0;
        }
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

    /** Ce que voit un bot : ni a travers un mur, ni a travers un nuage de fumigene. */
    function botSees(ax: number, az: number, bx: number, bz: number): boolean {
      return hasLineOfSight(ax, az, bx, bz) && !smokeClouds.blocks(ax, az, bx, bz);
    }

    function chooseTarget(f: Fighter) {
      // Il vient d'etre touche : il garde son agresseur tant qu'il le voit.
      if (elapsed < f.provokedUntil) {
        const t = targetOf(f);
        if (t && botSees(f.x, f.z, t.x, t.z)) {
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
        if (botSees(f.x, f.z, c.x, c.z)) {
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
        // Les grenades se ramassent en passant, on ne fait pas le detour.
        if (l.taken || l.kind === "grenade" || l.kind === "fumigene") continue;
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
          f.nadeFrag = Math.max(f.nadeFrag, nadeStock.grenade);
          f.nadeSmoke = Math.max(f.nadeSmoke, nadeStock.fumigene);
          f.kbX = 0;
          f.kbZ = 0;
          f.lastSeenAt = -100;
        }
        return;
      }

      // Souffle d'une explosion : il est pousse, sans traverser les murs.
      if (f.kbX !== 0 || f.kbZ !== 0) {
        const nx = f.x + f.kbX * delta;
        if (!isSolid(Math.floor(nx), Math.floor(f.z))) f.x = nx;
        else f.kbX = 0;
        const nz = f.z + f.kbZ * delta;
        if (!isSolid(Math.floor(f.x), Math.floor(nz))) f.z = nz;
        else f.kbZ = 0;
        const k = Math.max(0, 1 - delta * 7);
        f.kbX *= k;
        f.kbZ *= k;
        if (Math.abs(f.kbX) + Math.abs(f.kbZ) < 0.05) {
          f.kbX = 0;
          f.kbZ = 0;
        }
      }

      const botCfg = BOT_LEVELS[optionsRef.current.bots] ?? BOT_LEVELS.normal;
      f.thinkAt -= delta;
      if (f.thinkAt <= 0) {
        f.thinkAt = 0.22 + Math.random() * 0.14;
        chooseTarget(f);
        if (mode.loot) f.lootTarget = lootGoalFor(f);
        const t = targetOf(f);
        botPickWeapon(f, t ? Math.hypot(t.x - f.x, t.z - f.z) : 12);
        botConsiderNade(f, botCfg);
      }

      const spec = WEAPONS[f.weapon];
      const target = targetOf(f);
      if (!target) f.sees = false;
      const dist = target ? Math.hypot(target.x - f.x, target.z - f.z) : Infinity;
      f.seenFor = f.sees ? f.seenFor + delta : 0;
      // Il retient ou il a vu sa cible pour la derniere fois : c'est la que
      // partira sa grenade s'il la perd de vue.
      if (f.sees && target) {
        f.lastSeenX = target.x;
        f.lastSeenZ = target.z;
        f.lastSeenAt = elapsed;
      }
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
      const danger = nadeDangerFor(f);

      if (danger) {
        // Une grenade va partir a cote : il s'en ecarte en courant (et tire quand meme).
        const dx = f.x - danger.body.x / DUEL_CELL;
        const dz = f.z - danger.body.z / DUEL_CELL;
        const d = Math.hypot(dx, dz) || 1;
        const nx = f.x + (dx / d) * speed * 1.15 * delta;
        const nz = f.z + (dz / d) * speed * 1.15 * delta;
        if (!isSolid(Math.floor(nx), Math.floor(f.z))) f.x = nx;
        if (!isSolid(Math.floor(f.x), Math.floor(nz))) f.z = nz;
      } else if (mustReachZone && zone) {
        moveTowards(f, zone.x, zone.z, speed * 1.05, delta);
      } else if (fights && target) {
        // Distance a laquelle il se sent bien : au pompe il colle, au sniper il
        // garde ses distances. C'est ce qui donne aux bots des caracteres.
        const ideal = spec.melee
          ? 0.8
          : spec.pellets > 1
            ? 2.5
            : spec.id === "sniper"
              ? 11
              : spec.id === "carabine" || spec.id === "arbalete"
                ? 9
                : spec.explosive
                  ? 8
                  : 6;
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
        if (l.kind === "grenade" || l.kind === "fumigene") {
          const have = l.kind === "grenade" ? f.nadeFrag : f.nadeSmoke;
          const take = Math.min(NADE_CARRY_MAX - have, Math.max(1, l.heal));
          if (take <= 0) continue;
          if (l.kind === "grenade") f.nadeFrag += take;
          else f.nadeSmoke += take;
          l.heal -= take;
          if (l.heal <= 0) l.taken = true;
          continue;
        }
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

      // --- 1v1 construction ---
      if (mode.build && target) {
        // Touche, ou en plein rechargement : il se met a l'abri derriere un mur.
        const threatened = elapsed < f.provokedUntil || f.reloadUntil > elapsed;
        if (threatened && f.sees && f.buildMats >= BUILD_COST && elapsed >= f.nextBuildAt && dist > 2.2) {
          const a = Math.atan2(target.x - f.x, target.z - f.z);
          if (placeBuild(Math.floor(f.x + Math.sin(a) * 1.3), Math.floor(f.z + Math.cos(a) * 1.3), false)) {
            f.buildMats -= BUILD_COST;
            f.nextBuildAt = elapsed + 1.6 + Math.random() * 1.6;
          } else {
            f.nextBuildAt = elapsed + 0.4;
          }
        }
        // Sa cible s'est emmuree : il tire dans le mur jusqu'a le casser.
        if (
          !f.sees &&
          !spec.melee &&
          dist < spec.range * 1.4 &&
          elapsed >= f.nextShotAt &&
          elapsed >= f.swapUntil &&
          f.reloadUntil <= elapsed
        ) {
          const wall = firstBuiltBetween(f.x, f.z, target.x, target.z);
          if (wall) {
            if (f.mag <= 0) {
              f.reloadUntil = elapsed + spec.reloadSeconds;
              f.mag = spec.magSize;
              f.nextShotAt = elapsed + spec.reloadSeconds;
              return;
            }
            f.mag -= 1;
            f.nextShotAt = elapsed + spec.fireInterval * (1.3 + Math.random() * 0.5) * botCfg.fireDelay;
            f.flashUntil = elapsed + 0.05;
            f.anim?.pulse("Gun_Shoot", 0.7);
            f.yaw = Math.atan2(wall.x + 0.5 - f.x, wall.y + 0.5 - f.z);
            playShot(audio.ctx, audio.master, panFor(f.x, f.z));
            effects.tracer(
              new THREE.Vector3(f.x * DUEL_CELL, DUEL_EYE_HEIGHT, f.z * DUEL_CELL),
              new THREE.Vector3((wall.x + 0.5) * DUEL_CELL, DUEL_EYE_HEIGHT - 0.2, (wall.y + 0.5) * DUEL_CELL),
              spec.tracer,
              spec.pellets > 1,
            );
            if (spec.explosive) explode(wall.x + 0.5, wall.y + 0.5, spec, null, f, botCfg.damage);
            else damageBuild(wall, spec.damage * spec.pellets * (spec.burst ?? 1) * (spec.buildDamage ?? 1) * 0.85);
            return;
          }
        }
      }

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
      f.mag = Math.max(0, f.mag - (spec.burst ?? 1));
      f.nextShotAt = elapsed + spec.fireInterval * (1.7 + Math.random() * 0.8) * botCfg.fireDelay;
      f.flashUntil = elapsed + 0.05;
      f.anim?.pulse("Gun_Shoot", 0.7);
      if (spec.silent) playCrossbow(audio.ctx, audio.master, panFor(f.x, f.z));
      else playShot(audio.ctx, audio.master, panFor(f.x, f.z));
      if (!spec.silent) pingRadar(f.x, f.z);

      const from = new THREE.Vector3(f.x * DUEL_CELL, DUEL_EYE_HEIGHT, f.z * DUEL_CELL);
      const to = new THREE.Vector3(target.x * DUEL_CELL, DUEL_EYE_HEIGHT - 0.15, target.z * DUEL_CELL);
      effects.tracer(from, to, spec.tracer, spec.pellets > 1);

      // Precision : elle chute avec la distance, et encore plus si la cible
      // se deplace. Rester immobile a couvert doit rester une mauvaise idee
      // uniquement quand on est a portee.
      let accuracy = botCfg.accuracy - dist * 0.035;
      if (target.moving) accuracy -= 0.16;
      if (f.targetIsMe && crouching) accuracy -= 0.08;
      if (!f.targetIsMe) accuracy -= 0.12;
      if (dist > spec.range) accuracy *= 0.45;
      accuracy = Math.max(0.08, Math.min(0.85, accuracy));

      if (spec.explosive) {
        // Ratee, la roquette explose quand meme a cote de la cible.
        const hit = Math.random() < accuracy;
        const ox = hit ? 0 : (Math.random() - 0.5) * 3.2;
        const oz = hit ? 0 : (Math.random() - 0.5) * 3.2;
        explode(target.x + ox, target.z + oz, spec, hit ? (f.targetIsMe ? "moi" : f.targetRef) : null, f, botCfg.damage);
        return;
      }
      if (Math.random() < accuracy) {
        // Une rafale qui touche, c'est plusieurs balles d'un coup.
        const dmg = spec.damage * spec.pellets * (spec.pellets > 1 ? 0.55 : 1) * (spec.burst ? spec.burst * 0.75 : 1) * botCfg.damage;
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
        weaponModels[shownWeapon].group.visible = false;
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
        renderFrame();
        return;
      }

      const spec = WEAPONS[me.weapon];
      engagingLast = engagingMe;
      engagingMe = 0;
      const ch = cheatsRef.current;
      if (!usedCheats && anyCheat(ch)) usedCheats = true;
      // Entrainement : la minute est ecoulee.
      if (training && !ended && elapsed >= TRAINING_START + training.seconds) finish(true);

      // Gestes du rechargement : chaque bruit part quand l'avancement franchit
      // son seuil. Avant la fin du rechargement, pour ne pas perdre le dernier.
      const reloadP =
        me.reloadUntil > 0 ? THREE.MathUtils.clamp(1 - (me.reloadUntil - elapsed) / spec.reloadSeconds, 0, 1) : 0;
      if (reloadP > 0) {
        for (const cue of reloadCues) if (lastReloadP < cue.at && cue.at <= reloadP) playCue(cue, true);
      }
      lastReloadP = reloadP;
      // Cycle entre deux coups (pompe, verrou) : meme principe, sur la cadence.
      let cycleNow = 1;
      if (cycleOwner === me.weapon && !me.dead) {
        cycleNow = THREE.MathUtils.clamp((elapsed - lastShotAt) / cycleSpan, 0, 1);
        if (lastCycle < 1) {
          for (const cue of currentModel().cycleCues) if (lastCycle < cue.at && cue.at <= cycleNow) playCue(cue, false);
        }
        lastCycle = cycleNow;
      }

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
      // C tenu : accroupi. Plus lent, plus precis, et plus dur a toucher.
      crouching = canAct && keys.has("c") && jumpY <= 0.001;
      crouchBlend += ((crouching ? 1 : 0) - crouchBlend) * Math.min(1, delta * 12);

      // Espace : saut. On ne saute que depuis le sol — pas d'escalier en
      // l'air — et jamais accroupi ni en mode construction.
      const jumpDown = canAct && (keys.has(" ") || keys.has("space"));
      if (jumpDown && !jumpWasDown && jumpY <= 0.001 && !crouching && !buildMode) {
        jumpV = DUEL_JUMP_SPEED;
        playDuelStep(audio.ctx, audio.master, { gain: 0.45 });
      }
      jumpWasDown = jumpDown;
      if (jumpV !== 0 || jumpY > 0) {
        jumpV -= DUEL_GRAVITY * delta;
        jumpY += jumpV * delta;
        if (jumpY <= 0) {
          // Retombee : un pas au sol, et tout repart de zero.
          if (jumpV < -1) playDuelStep(audio.ctx, audio.master, { gain: 0.6 });
          jumpY = 0;
          jumpV = 0;
        }
      }
      eyeY = DUEL_EYE_HEIGHT - crouchBlend * 0.5 + jumpY;
      const sprinting =
        moving && fwd > 0 && keys.has("shift") && !isZoomed && !crouching && elapsed > me.nextShotAt - 0.05;
      if (moving) {
        const f = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), me.yaw);
        const r = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), me.yaw);
        const mv = new THREE.Vector3().addScaledVector(f, fwd).addScaledVector(r, strafe);
        if (mv.length() > 1) mv.normalize();
        // L'arme lourde ralentit, la lunette cloue sur place.
        const weaponSpeed = spec.moveFactor * (isZoomed ? (spec.zoomFov ? 0.4 : 0.7) : 1) * (crouching ? 0.55 : 1);
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

      // Souffle d'une grenade : on est pousse, sans traverser les murs.
      if (myKbX !== 0 || myKbZ !== 0) {
        if (!me.dead && !ch.noclip) {
          const kx = myKbX * delta;
          const kz = myKbZ * delta;
          if (!circleHitsWall(me.x + kx, me.z)) me.x += kx;
          else myKbX = 0;
          if (!circleHitsWall(me.x, me.z + kz)) me.z += kz;
          else myKbZ = 0;
        }
        const k = Math.max(0, 1 - delta * 7);
        myKbX *= k;
        myKbZ *= k;
        if (Math.abs(myKbX) + Math.abs(myKbZ) < 0.05) {
          myKbX = 0;
          myKbZ = 0;
        }
      }
      // Plus de visee de grenade si l'on ne peut plus la lancer (mort, fin de manche).
      if (nadeAiming && !canThrowNade()) cancelNadeAim();

      // Vitesse reelle du joueur, en m/s : les douilles en heritent. Un saut de
      // plus d'une case (reapparition, teleportation) ne compte pas.
      {
        const mdx = me.x - lastMeX;
        const mdz = me.z - lastMeZ;
        lastMeX = me.x;
        lastMeZ = me.z;
        const jump = Math.abs(mdx) > 1 || Math.abs(mdz) > 1 || delta <= 0;
        myVelX = jump ? 0 : (mdx * DUEL_CELL) / delta;
        myVelZ = jump ? 0 : (mdz * DUEL_CELL) / delta;
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
          me.pitch = Math.atan2(DUEL_HEAD_Y - eyeY, d) - recoilKick;
          camera.rotation.set(me.pitch + recoilKick, me.yaw, 0);
        }
      }
      // Une grenade en main : on ne tire pas en meme temps.
      let wantFire = (firing || touchRef.current.firing) && !myEmote && !buildMode && !nadeAiming;
      if (canAct && ch.triggerbot && !myEmote && !nadeAiming && fighterUnderCrosshair()) wantFire = true;
      if (spec.auto ? wantFire : wantFire && !wasFiring) fire();
      wasFiring = wantFire;
      if (burstLeft > 0 && elapsed >= burstAt) {
        if (me.weapon === burstWeapon && !me.dead && !buildMode) {
          burstLeft -= 1;
          burstAt = elapsed + (WEAPONS[burstWeapon].burstGap ?? 0.07);
          fire(true);
        } else {
          burstLeft = 0;
        }
      }
      updateBuilds(delta, canAct);

      // -------------------------------------------------------- ramassage
      // Une place libre, un doublon (munitions) ou un soin : on prend en
      // passant. Inventaire plein : on propose l'echange, touche E.
      groundLoot = null;
      if (canAct) {
        for (const l of loots) {
          if (l.taken) continue;
          if (Math.hypot(me.x - l.x, me.z - l.z) >= 0.8) continue;
          if (l.kind === "grenade" || l.kind === "fumigene") {
            const room = NADE_CARRY_MAX - myNades[l.kind];
            if (room <= 0) {
              groundLoot ??= l;
              continue;
            }
            const take = Math.min(room, Math.max(1, l.heal));
            myNades[l.kind] += take;
            l.heal -= take;
            if (l.heal <= 0) l.taken = true;
            playReload(audio.ctx, audio.master);
            setPickupToast(`${GRENADES[l.kind].name} +${take}`);
            window.setTimeout(() => setPickupToast(null), 1400);
            syncNadeHud();
            continue;
          }
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
          : groundLoot.kind === "arme"
            ? `E : échanger contre ${WEAPONS[groundLoot.weapon].name}`
            : `${GRENADES[groundLoot.kind].name} : ${NADE_CARRY_MAX} au maximum`
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
        eyeY + (moving ? Math.sin(walkPhase * 2) * 0.022 : 0),
        me.z * DUEL_CELL,
      );
      camera.rotation.y = me.yaw;
      camera.rotation.x = me.pitch + recoilKick;
      camera.rotation.z = moving ? Math.sin(walkPhase) * 0.008 : 0;
      // Tremblement d'une explosion proche : quelques centimetres et une
      // fraction de degre, qui s'eteignent en moins d'une demi-seconde.
      if (shake > 0) {
        const s = shake * shake;
        camera.position.x += (Math.random() - 0.5) * 0.14 * s;
        camera.position.y += (Math.random() - 0.5) * 0.1 * s;
        camera.position.z += (Math.random() - 0.5) * 0.14 * s;
        camera.rotation.x += (Math.random() - 0.5) * 0.035 * s;
        camera.rotation.z += (Math.random() - 0.5) * 0.05 * s;
        shake = Math.max(0, shake - delta * 2.4);
      }

      const targetFov = isZoomed ? (spec.zoomFov ?? ADS_FOV) : BASE_FOV;
      if (Math.abs(camera.fov - targetFov) > 0.2) {
        camera.fov += (targetFov - camera.fov) * Math.min(1, delta * 14);
        camera.updateProjectionMatrix();
      }
      // Les points de l'arme tenue sont convertis vers le monde avec cette matrice.
      camera.updateMatrixWorld();

      // --- Camera de l'arme tenue ---
      // Meme champ que la vue (l'arme garde la taille qu'on lui connait), mais
      // jamais plus serre que la visee sans lunette : dans une lunette, elle
      // grossissait d'un coup avant de disparaitre.
      const vmFov = Math.max(camera.fov, ADS_FOV);
      if (Math.abs(vmCamera.fov - vmFov) > 0.01) {
        vmCamera.fov = vmFov;
        vmCamera.updateProjectionMatrix();
      }
      vmInvQ.copy(camera.quaternion).invert();
      vmHemi.position.set(0, 1, 0).applyQuaternion(vmInvQ);
      vmKey.position.copy(keyDir).applyQuaternion(vmInvQ);
      vmFill.position.copy(fillDir).applyQuaternion(vmInvQ);

      // --- Changement d'arme : l'ancienne descend, puis la nouvelle monte ---
      const sinceSwap = elapsed - swapStart;
      const lowering = swapFrom !== null && sinceSwap < SWAP_DOWN;
      const shown: WeaponId = lowering && swapFrom ? swapFrom : me.weapon;
      if (shown !== shownWeapon) {
        weaponModels[shownWeapon].group.visible = false;
        shownWeapon = shown;
      }
      let swapK = 0;
      if (lowering) {
        const u = sinceSwap / SWAP_DOWN;
        swapK = u * u;
      } else if (sinceSwap < SWAP_SECONDS) {
        const u = THREE.MathUtils.clamp((sinceSwap - SWAP_DOWN) / (SWAP_SECONDS - SWAP_DOWN), 0, 1);
        swapK = (1 - u) * (1 - u) * (1 - u);
      }
      // Grenade en main : l'arme descend comme pour un changement d'arme, et
      // remonte juste apres le lancer.
      const nadeWanted = nadeAiming !== null || elapsed - lastThrowAt < 0.3;
      nadeLower += ((nadeWanted ? 1 : 0) - nadeLower) * Math.min(1, delta * 14);
      if (nadeLower > swapK) swapK = nadeLower;
      const isCur = shown === me.weapon;

      const model = weaponModels[shown];
      // En visee, l'arme vient au centre de l'ecran ; en sprint elle s'abaisse.
      // Pendant un rechargement (hors lunette), elle reste a la hanche pour
      // qu'on voie le geste.
      const aimWanted = isZoomed && !(me.reloadUntil > 0 && !spec.zoomFov);
      aimBlend += ((aimWanted ? 1 : 0) - aimBlend) * Math.min(1, delta * 14);
      const aimLerp = aimBlend;
      const doux = Math.min(1, delta * 8);
      bobAmp += ((moving ? (sprinting ? 1.6 : 1) : 0) - bobAmp) * doux;
      sprintBlend += ((sprinting ? 1 : 0) - sprintBlend) * Math.min(1, delta * 10);
      // L'arme traine un peu derriere le regard, puis revient en place.
      let dYaw = me.yaw - prevYaw;
      dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw));
      const dPitch = me.pitch - prevPitch;
      prevYaw = me.yaw;
      prevPitch = me.pitch;
      swayX += (THREE.MathUtils.clamp(dYaw * 1.2, -0.05, 0.05) - swayX) * Math.min(1, delta * 10);
      swayY += (THREE.MathUtils.clamp(-dPitch * 1.2, -0.04, 0.04) - swayY) * Math.min(1, delta * 10);
      // En visee, presque rien ne bouge : le point rouge doit rester au centre.
      const libre = 1 - aimLerp * 0.85;
      const shotKick = isCur ? recoil : 0;
      model.group.position.set(
        THREE.MathUtils.lerp(GUN_BASE.x, 0, aimLerp) + (Math.sin(walkPhase) * 0.012 * bobAmp + swayX) * libre,
        THREE.MathUtils.lerp(GUN_BASE.y, -0.12, aimLerp) +
          (Math.abs(Math.cos(walkPhase)) * 0.012 * bobAmp + swayY) * libre -
          shotKick * 0.02 -
          sprintBlend * 0.09 -
          swapK * 0.28,
        THREE.MathUtils.lerp(GUN_BASE.z, -0.5, aimLerp) + shotKick * 0.07,
      );
      model.group.rotation.x = shotKick * 0.28 + sprintBlend * 0.38 + swayY * 1.5 * libre - swapK * 0.55;
      model.group.rotation.y = THREE.MathUtils.lerp(-0.06, 0, aimLerp) + swayX * 1.5 * libre;
      model.group.rotation.z = sprintBlend * 0.3 + Math.sin(walkPhase) * 0.012 * bobAmp * libre + swapK * 0.15;
      // Dans la lunette, l'arme disparait : sinon sa hausse et son canon
      // bouchaient le centre de la vue, la ou l'on vise.
      model.group.visible = !me.dead && me.alive && !(isZoomed && spec.zoomFov && aimBlend > 0.55) && !buildMode;
      // Pieces mobiles et mains : culasse, pompe, verrou, chargeur, barillet.
      vmAnim.time = elapsed;
      vmAnim.recoil = shotKick;
      vmAnim.reload = isCur ? reloadP : 0;
      vmAnim.aim = aimLerp;
      vmAnim.sprint = sprintBlend;
      vmAnim.cycle = isCur ? cycleNow : 1;
      vmAnim.empty = isCur ? me.mag === 0 && !spec.melee : swapFromEmpty;
      vmAnim.shells = reloadShells;
      model.update(vmAnim);

      // --- Grenade en main : elle monte en bas a gauche, puis part en avant ---
      const throwT = (elapsed - lastThrowAt) / 0.22;
      const showHeld = !me.dead && me.alive && !myEmote && (nadeAiming !== null || throwT < 1);
      heldNade.visible = showHeld;
      if (showHeld) {
        heldModels.grenade.visible = nadeAiming === "grenade";
        heldModels.fumigene.visible = nadeAiming === "fumigene";
        const bob = Math.abs(Math.cos(walkPhase)) * 0.01 * bobAmp;
        if (nadeAiming) {
          // Le bras monte a mesure que l'arme descend, et respire un peu.
          const rise = 1 - nadeLower;
          heldNade.position.set(-0.19, -0.2 - rise * 0.22 + bob + Math.sin(elapsed * 2.6) * 0.004, -0.42);
          heldNade.rotation.set(0.25, 0.45, 0.12);
        } else {
          // Le lancer : la main part vers l'avant et vers le haut, puis sort du champ.
          const t = Math.min(1, throwT);
          heldNade.position.set(-0.19 + t * 0.18, -0.2 + t * 0.16 - t * t * 0.3, -0.42 - t * 0.4);
          heldNade.rotation.set(0.25 - t * 1.3, 0.45, 0.12);
        }
      }

      // --- Lueur du tir : les murs proches et l'arme elle-meme, deux ou trois images ---
      if (muzzleGlow > 0) {
        if (muzzleLight) muzzleLight.intensity = quality === "performance" ? 0 : MUZZLE_LIGHT_POWER * glowPower * muzzleGlow;
        model.flash.getWorldPosition(vmFlashLight.position);
        vmFlashLight.intensity = VM_FLASH_POWER * glowPower * muzzleGlow;
        muzzleGlow = Math.max(0, muzzleGlow - delta * 22);
      } else {
        if (muzzleLight) muzzleLight.intensity = 0;
        vmFlashLight.intensity = 0;
      }
      // Lueur d'une grenade : la lumiere du tir, pretee un instant et portee
      // plus loin (aucune lumiere en plus dans la scene).
      if (blastGlow > 0) {
        if (muzzleLight) {
          muzzleLight.position.copy(blastAt);
          muzzleLight.distance = 18;
          muzzleLight.intensity = 60 * blastGlow * blastGlow;
        }
        blastGlow = Math.max(0, blastGlow - delta * 4);
        if (blastGlow === 0 && muzzleLight) {
          muzzleLight.distance = 7;
          muzzleLight.intensity = 0;
        }
      }

      // --- Fumee : apres une rafale ou un gros coup, un filet sort du canon ---
      heat = Math.max(0, heat - delta * 0.55);
      if (
        heat > 0.25 &&
        elapsed - lastShotAt > 0.14 &&
        isCur &&
        model.group.visible &&
        !(isZoomed && spec.zoomFov)
      ) {
        smokeAcc += delta * heat * 9;
        if (smokeAcc >= 1) {
          model.flash.getWorldPosition(vmPoint);
          viewToWorld(vmPoint);
          while (smokeAcc >= 1) {
            smokeAcc -= 1;
            effects.smoke(vmPoint.x, vmPoint.y, vmPoint.z);
          }
        }
      } else {
        smokeAcc = 0;
      }

      // --- Laser : du canon jusqu'au premier mur (ou au sol) ---
      const wantLaser = optionsRef.current.laser && !me.dead && me.alive && !isZoomed;
      laserBeam.visible = wantLaser;
      laserDot.visible = wantLaser;
      if (wantLaser) {
        laserDir.set(0, 0, -1).applyQuaternion(camera.quaternion);
        // `rayWallDistance` travaille en cases : la distance revient donc en
        // cases, et on la convertit une seule fois ici.
        let t = rayWallDistance(me.x, me.z, laserDir.x, laserDir.z, 40);
        if (laserDir.y < -1e-4) t = Math.min(t, -eyeY / (laserDir.y * DUEL_CELL));
        if (laserDir.y > 1e-4) t = Math.min(t, (DUEL_WALL_HEIGHT - eyeY) / (laserDir.y * DUEL_CELL));
        const reach = Math.max(0.4, t * DUEL_CELL - 0.02);
        // L'arme vit dans le repere de la vue : son canon est ramene dans le monde.
        model.flash.getWorldPosition(laserFrom).applyMatrix4(camera.matrixWorld);
        laserTo.copy(camera.position).addScaledVector(laserDir, reach);
        const length = laserFrom.distanceTo(laserTo);
        laserBeam.position.copy(laserFrom).add(laserTo).multiplyScalar(0.5);
        laserBeam.scale.set(1, Math.max(0.01, length), 1);
        laserBeam.quaternion.setFromUnitVectors(laserUp, laserDir);
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
        // Un mort reste au sol un moment (corpseUntil) au lieu de s'evaporer.
        const corps = f.dead && elapsed < f.corpseUntil;
        const visible = ((f.alive && !f.dead) || corps) && !inFog;
        f.model.group.visible = visible && !f.anim;
        if (f.anim) f.anim.root.visible = visible;
        if (!visible) continue;
        const bare = WEAPONS[f.weapon].melee === true;
        if (f.animGun) f.animGun.visible = !bare;
        // Orientation affichee : rattrape le regard a 11 rad/s au plus, pour
        // qu'un bot ne pivote pas de 180 degres en une image.
        if (f.dead) f.drawYaw = f.yaw;
        else {
          let dy = f.yaw - f.drawYaw;
          dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          const pas = 11 * delta;
          f.drawYaw += Math.abs(dy) <= pas ? dy : Math.sign(dy) * pas;
        }
        if (f.anim) {
          // Les dernieres secondes, le corps s'enfonce doucement dans le sol.
          const enfonce = f.dead ? THREE.MathUtils.clamp(1 - (f.corpseUntil - elapsed), 0, 1) * 0.6 : 0;
          f.anim.root.position.set(f.x * DUEL_CELL, f.air - enfonce, f.z * DUEL_CELL);
          f.anim.root.rotation.y = f.drawYaw;
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
          // Vitesse et direction reelles, lissees : le deplacement d'une seule
          // image est trop bruite (un bot contre un mur clignotait entre
          // course et arret, et ses pieds sautaient d'une animation a l'autre).
          const mdx = f.x - f.lastAnimX;
          const mdz = f.z - f.lastAnimZ;
          f.lastAnimX = f.x;
          f.lastAnimZ = f.z;
          const lisse = Math.min(1, delta * 10);
          const inst = delta > 0 ? 1 / delta : 0;
          // Au-dela d'un saut de 2 cases (reapparition, teleportation), on repart de zero.
          const teleporte = Math.hypot(mdx, mdz) > 2;
          f.velX = teleporte ? 0 : f.velX + (mdx * inst - f.velX) * lisse;
          f.velZ = teleporte ? 0 : f.velZ + (mdz * inst - f.velZ) * lisse;
          f.animSpeed = Math.hypot(f.velX, f.velZ);
          const shooting = elapsed < f.flashUntil + 0.35;
          const enDeplacement = f.anim.current?.startsWith("Run") || f.anim.current === "Walk";
          // Hysteresis : on part au-dessus de 0,8 case/s, on s'arrete sous 0,4.
          const bouge = f.animSpeed > (enDeplacement ? 0.4 : 0.8);
          let clip: string;
          if (f.dead) clip = "Death";
          else if (f.air > 0.12) clip = "Idle_Gun_Pointing";
          else if (elapsed < f.clipLockUntil && enDeplacement && f.anim.current) clip = f.anim.current;
          else if (bouge) {
            const forward = f.velX * Math.sin(f.drawYaw) + f.velZ * Math.cos(f.drawYaw);
            const right = -f.velX * Math.cos(f.drawYaw) + f.velZ * Math.sin(f.drawYaw);
            if (f.animSpeed < 2.2 && forward > 0 && f.anim.has("Walk")) clip = "Walk";
            else if (Math.abs(right) > Math.abs(forward) * 1.2) clip = right > 0 ? "Run_Right" : "Run_Left";
            else if (forward < 0) clip = "Run_Back";
            else clip = shooting && !bare ? "Run_Shoot" : "Run";
            if (clip !== f.anim.current) f.clipLockUntil = elapsed + 0.2;
          } else if (bare) {
            // Mains nues : pas de pose d'arme.
            clip = "Idle_Neutral";
          } else {
            clip = shooting ? "Idle_Gun_Pointing" : f.seenFor > 0 ? "Idle_Gun_Pointing" : "Idle_Gun";
          }
          const deplacement = clip.startsWith("Run") || clip === "Walk";
          f.anim.play(clip, {
            loop: clip !== "Death",
            fade: clip === "Death" ? 0.08 : 0.18,
            // Les boucles d'attente demarrent a un instant au hasard : trente
            // bots ne respirent plus tous en meme temps.
            randomStart: !deplacement && clip !== "Death",
            // Entre deux courses, la foulee continue au lieu de repartir du debut.
            syncPhase: deplacement,
          });
          if (clip === "Walk") f.anim.setSpeed(THREE.MathUtils.clamp(f.animSpeed / 1.6, 0.6, 1.3));
          else if (clip.startsWith("Run")) f.anim.setSpeed(THREE.MathUtils.clamp(f.animSpeed / 4, 0.7, 1.5));
          // Une fois la chute terminee, le corps garde sa pose : plus besoin
          // de faire tourner le squelette.
          const chuteFinie = f.dead && f.diedAt >= 0 && elapsed - f.diedAt > f.anim.duration("Death") + 0.15;
          if (!chuteFinie) f.anim.update(delta);
          if (f.animFlash) {
            f.animFlash.visible = elapsed < f.flashUntil;
            f.animFlash.rotation.z = Math.random() * Math.PI;
          }
        } else {
          f.model.group.position.set(f.x * DUEL_CELL, f.air, f.z * DUEL_CELL);
          f.model.group.rotation.y = f.drawYaw;
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

      // --- Grenades en vol, nuages, et l'arc de visee (apres la camera de cette image) ---
      grenades.update(delta);
      smokeClouds.update(delta, camera);
      if (nadeAiming && !myEmote) {
        myThrow(throwBody);
        aimArc.show(throwBody, nadeWorld, GRENADES[nadeAiming].fuse, nadeAiming);
      }

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
          jump: jumpY,
          dance: myEmote,
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
      flashLevel = Math.max(0, flashLevel - delta * 2.4);
      damageLevel = Math.max(0, damageLevel - delta * 1.5);
      uiTimer += delta;
      if (uiTimer > 0.05) {
        uiTimer = 0;
        setHitMarker(hitMarkerLevel);
        setDamageFlash(damageLevel);
        // Arrondis au vingtieme : React ne redessine que si ca change vraiment.
        setBlastFlash(Math.round(flashLevel * 20) / 20);
        setSmokeVeil(
          Math.round(smokeClouds.density(camera.position.x, camera.position.y, camera.position.z) * 20) / 20,
        );
        setNadeWarn(hostileNadeNear());
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

      renderFrame();
    }
    syncWeaponUi();
    const intervalId = window.setInterval(tick, 16);
    tick();

    function handleResize() {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      vmCamera.aspect = camera.aspect;
      vmCamera.updateProjectionMatrix();
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
      muzzleLight?.dispose();
      vmHemi.dispose();
      vmKey.dispose();
      vmFill.dispose();
      vmFlashLight.dispose();
      grenades.dispose();
      smokeClouds.dispose();
      aimArc.dispose();
      gloveGeo.dispose();
      gloveMat.dispose();
      sleeveGeo.dispose();
      sleeveMat.dispose();
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
      buildGeo.dispose();
      buildMat.dispose();
      buildTex.dispose();
      ghostMat.dispose();
      ghostEdgesGeo.dispose();
      (ghostEdges.material as THREE.Material).dispose();
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
  const scoreGoal = infinite ? "∞" : mode.gunGame ? GUN_GAME_ORDER.length : mode.scoreToWin;

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

      {/* Dans un nuage de fumigene : on n'y voit presque plus rien */}
      {smokeVeil > 0 && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: island ? `rgba(214,219,223,${(smokeVeil * 0.94).toFixed(2)})` : `rgba(150,156,162,${(smokeVeil * 0.94).toFixed(2)})` }}
        />
      )}
      {/* Eclair d'une grenade qui explose en face */}
      {blastFlash > 0 && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(circle at 50% 50%, rgba(255,244,214,${(blastFlash * 0.9).toFixed(2)}) 0%, rgba(255,190,110,${(blastFlash * 0.6).toFixed(2)}) 100%)` }}
        />
      )}

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
          setNadeKey(l === "qwerty" ? "Q" : "A");
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
      {shownCheats.esp &&
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
      {((mode.shrinkingZone && radar.zone) || shownCheats.radarAll) && (
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
        {/* Grenades : combien il en reste, et la touche pour les lancer */}
        {nadesInMode && (
          <div className="flex gap-1">
            {(["grenade", "fumigene"] as const).map((k) => {
              const count = nadeHud[k];
              const held = nadeHud.aiming === k;
              return (
                <div
                  key={k}
                  className={`flex h-8 items-center gap-1.5 rounded-md px-2 ring-1 ${
                    held ? "bg-lime-500/30 ring-lime-300" : "bg-black/60 ring-white/10"
                  } ${count === 0 && !held ? "opacity-40" : ""}`}
                >
                  <span
                    className={`h-3.5 w-2.5 rounded-[3px] ${k === "grenade" ? "bg-[#6b7b34]" : "bg-[#9aa1a7]"}`}
                    style={{ boxShadow: "inset 0 2px 0 rgba(0,0,0,0.35)" }}
                  />
                  <span className="text-[11px] font-black uppercase leading-none text-white">{GRENADES[k].name}</span>
                  <span className="font-mono text-sm font-black leading-none text-lime-200">{count}</span>
                  <span className="rounded bg-white/10 px-1 font-mono text-[9px] font-bold leading-4 text-zinc-300">
                    {k === "grenade" ? nadeKey : "X"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
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

      {/* 1v1 construction : materiaux, et le mode construction quand il est actif */}
      {mode.build && (
        <div className="pointer-events-none absolute bottom-14 left-4 flex flex-col items-start gap-1.5">
          <div className="flex items-center gap-2 rounded-md bg-black/60 px-2.5 py-1 ring-1 ring-amber-300/40">
            <span className="text-base">🧱</span>
            <span className="font-mono text-sm font-black text-amber-200">{buildHud.mats}</span>
            <span className="text-[10px] font-bold uppercase text-zinc-400">F : construire</span>
          </div>
          {buildHud.on && (
            <div className="rounded-md bg-amber-500/90 px-3 py-1.5 text-xs font-black uppercase text-black shadow-lg">
              Construction · clic : poser (tenir pour enchaîner) · clic droit : retirer · 1-3 : armes
            </div>
          )}
        </div>
      )}

      {/* Quitter : toujours possible, c'est la seule fin d'une partie infinie */}
      {(!locked || touchDevice) && !dropOpen && (
        <button
          type="button"
          onClick={() => sceneApiRef.current?.quit()}
          className="absolute left-1/2 top-14 z-30 -translate-x-1/2 rounded-full bg-black/75 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-zinc-100 ring-1 ring-white/25 backdrop-blur transition hover:bg-red-600/80"
        >
          {infinite ? "⏹ Terminer la partie" : "Quitter la partie"}
        </button>
      )}

      {/* Inventaire plein : l'objet au sol s'echange avec E */}
      {pickupHint && (
        <div className="pointer-events-none absolute bottom-44 left-1/2 -translate-x-1/2 rounded-lg bg-black/75 px-4 py-2 text-sm font-bold text-yellow-200 ring-1 ring-yellow-400/40">
          {pickupHint}
        </div>
      )}

      {/* Series : eliminations rapprochees et serie sans mourir */}
      {streakBanner && (
        <div
          key={streakBanner.id}
          className="pointer-events-none absolute inset-x-0 top-[22%] flex flex-col items-center gap-1"
          style={{ animation: "horror-act-in 2.3s ease-out forwards" }}
        >
          {streakBanner.multi && (
            <p className="rounded-xl bg-black/70 px-6 py-2 text-3xl font-black uppercase italic tracking-wider text-yellow-300 drop-shadow-lg">
              {streakBanner.multi}
            </p>
          )}
          {streakBanner.streak && (
            <p className="rounded-full bg-orange-600/85 px-4 py-1 text-sm font-black uppercase tracking-[0.2em] text-white ring-1 ring-orange-300/60">
              🔥 {streakBanner.streak}
            </p>
          )}
        </div>
      )}

      {/* Grenade ennemie tout pres */}
      {nadeWarn && (
        <div className="pointer-events-none absolute left-1/2 top-[40%] -translate-x-1/2 rounded-full bg-red-600/85 px-3 py-1 text-xs font-black uppercase tracking-wider text-white ring-1 ring-red-300/70 animate-pulse">
          Grenade !
        </div>
      )}

      {/* Grenade en main : comment la lancer */}
      {nadeHud.aiming && (
        <div className="pointer-events-none absolute left-1/2 top-[58%] -translate-x-1/2 whitespace-nowrap rounded-lg bg-black/70 px-3 py-1.5 text-xs font-bold text-lime-200 ring-1 ring-lime-400/40">
          {GRENADES[nadeHud.aiming].name} : relâche pour lancer{touchDevice ? "" : " · clic droit : annuler"}
        </div>
      )}

      {/* Arme ramassee */}
      {pickupToast && (
        <div className="pointer-events-none absolute bottom-32 left-1/2 -translate-x-1/2 rounded-full bg-cyan-950/90 px-4 py-1.5 text-sm font-bold text-cyan-200 ring-1 ring-cyan-600">
          {pickupToast}
        </div>
      )}

      {/* Réticule : regle par le joueur, il s'ouvre a la course et au tir */}
      {!aiming && <DuelCrosshair options={options} spread={spread} hit={hitMarker} />}
      {/* En visee sans lunette : un point rouge au centre, la ou part la balle */}
      {aiming && !zoomed && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 shadow-[0_0_4px_rgba(255,60,60,0.9)]" />
      )}

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
            <span className="text-[11px] text-zinc-400">1-9, 0, Maj+chiffre : acheter · B boutique</span>
          </div>
          {shopOpen && (
            <div className="w-full max-w-3xl rounded-2xl border border-white/15 bg-zinc-950/92 p-3 shadow-2xl backdrop-blur">
              <div className="mb-2 flex items-baseline justify-between">
                <p className="text-sm font-black uppercase tracking-wider text-white">Boutique</p>
                <p className="font-mono text-lg font-black text-emerald-300">${money}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
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
                      <span className="text-[10px] font-bold text-zinc-500">{shopKeyLabel(i)}</span>
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
          {nadesInMode && (
            <button
              type="button"
              aria-label="Grenade : appuyer pour viser, relâcher pour lancer"
              onPointerDown={() => sceneApiRef.current?.nadeDown("grenade")}
              onPointerUp={() => sceneApiRef.current?.nadeUp()}
              onPointerCancel={() => sceneApiRef.current?.nadeUp()}
              className={`absolute bottom-[18.5rem] right-8 size-14 touch-none rounded-full border border-lime-300/40 bg-black/60 text-lg font-bold text-white active:scale-95 sm:bottom-[12rem] sm:right-7 ${
                nadeHud.grenade === 0 ? "opacity-40" : ""
              }`}
            >
              💣
            </button>
          )}
          {/* Le fumigene a son bouton : au doigt, on ne pouvait le lancer qu'une fois les grenades epuisees. */}
          {nadesInMode && (
            <button
              type="button"
              aria-label="Fumigène : appuyer pour viser, relâcher pour lancer"
              onPointerDown={() => sceneApiRef.current?.nadeDown("fumigene")}
              onPointerUp={() => sceneApiRef.current?.nadeUp()}
              onPointerCancel={() => sceneApiRef.current?.nadeUp()}
              className={`absolute bottom-[18.5rem] right-[5.5rem] size-12 touch-none rounded-full border border-zinc-300/40 bg-black/60 text-base font-bold text-white active:scale-95 sm:bottom-[16rem] sm:right-8 ${
                nadeHud.fumigene === 0 ? "opacity-40" : ""
              }`}
            >
              💨
            </button>
          )}
        </>
      )}

      {/* Invite de verrouillage souris (inutile au doigt) */}
      {!locked && respawnIn === 0 && !touchDevice && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="max-w-md rounded-lg bg-black/80 px-5 py-3 text-center text-sm font-semibold text-white ring-1 ring-white/20">
            Clique pour jouer · ZQSD/WASD · clic gauche : tirer · clic droit : viser · Maj : sprint ·
            R : recharger · C : s&apos;accroupir · 1-3 ou molette : changer d&apos;arme · E : échanger · G : danses
            {nadesInMode ? ` · ${nadeKey} ou clic molette : grenade · X : fumigène (maintenir pour viser, relâcher pour lancer)` : ""}
            {mode.build ? " · F : construire" : ""} · Échap : libérer la souris
          </span>
        </div>
      )}
    </div>
  );
}
