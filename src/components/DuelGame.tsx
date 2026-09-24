"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import DuelOptionsPanel from "./DuelOptionsPanel";
import DuelCrosshair from "./DuelCrosshair";
import DuelLobbyStage from "./DuelLobbyStage";
import {
  BOT_LEVELS,
  BOT_ORDER,
  DEFAULT_DUEL_OPTIONS,
  loadDuelOptions,
  saveDuelOptions,
  type DuelOptions,
} from "@/lib/duelOptions";
import {
  CAMOS,
  CAMO_ORDER,
  DAILY_GIFT,
  DEFAULT_PROFILE,
  RARITY,
  SHOP_PACKS,
  SKINS,
  allShopKeys,
  SKIN_ORDER,
  dailyShop,
  dayKey,
  giftAvailable,
  levelInfo,
  loadProfile,
  matchReward,
  packPrice,
  saveProfile,
  shopItem,
  type CamoId,
  type DuelProfile,
  type ShopPack,
  type SkinId,
} from "@/lib/duelProfile";
import { DANCE_ORDER, type DanceId } from "@/lib/duelDances";
import { claimMyGifts } from "@/app/cadeaux/actions";
import { GIVE_DUEL_EVENT } from "@/lib/adminGive";
import { DRILLS, DRILL_ORDER, loadTrainingBests, saveTrainingBest, type DrillId, type TrainingResult } from "@/lib/duelTraining";
import { buildDuelMap, DUEL_MAP_INFO, DUEL_MAP_ORDER, generateDuelCode, type DuelMapId, type DuelSide } from "@/lib/duel";
import { DUEL_MODES, DUEL_MODE_ORDER, supportsInfinite, type DuelModeId } from "@/lib/duelModes";
import { WEAPONS, SHOP_ORDER, type WeaponId } from "@/lib/duelWeapons";
import DuelScene, { type DuelLink, type MatchExtra } from "./DuelScene";

type Phase = "menu" | "matchmaking" | "waiting" | "playing" | "ended";
type LobbyTab = "jouer" | "casier" | "boutique" | "arsenal" | "reglages";

const TABS: { id: LobbyTab; label: string }[] = [
  { id: "jouer", label: "Jouer" },
  { id: "casier", label: "Casier" },
  { id: "boutique", label: "Boutique" },
  { id: "arsenal", label: "Arsenal" },
  { id: "reglages", label: "Réglages du tir" },
];

/** Accent de couleur par mode : le menu doit se lire d'un coup d'oeil. */
const MODE_STYLE: Record<DuelModeId, { ring: string; text: string; bg: string }> = {
  duel: { ring: "ring-cyan-400", text: "text-cyan-300", bg: "from-cyan-700/80 to-cyan-950/80" },
  deathmatch: { ring: "ring-orange-400", text: "text-orange-300", bg: "from-orange-700/80 to-orange-950/80" },
  armement: { ring: "ring-violet-400", text: "text-violet-300", bg: "from-violet-700/80 to-violet-950/80" },
  zone: { ring: "ring-emerald-400", text: "text-emerald-300", bg: "from-emerald-700/80 to-emerald-950/80" },
  economie: { ring: "ring-amber-400", text: "text-amber-300", bg: "from-amber-700/80 to-amber-950/80" },
  entrainement: { ring: "ring-sky-400", text: "text-sky-300", bg: "from-sky-700/80 to-slate-950/80" },
  construction: { ring: "ring-yellow-400", text: "text-yellow-200", bg: "from-yellow-700/80 to-stone-950/80" },
};

/** Noms qui s'affichent pendant la recherche de joueurs de la battle royale. */
const LOBBY_NAMES = [
  "Sentinelle", "Vigile", "Spectre", "Rôdeur", "Écho", "Faucheur", "Corsaire", "Orage", "Lynx", "Brasier",
  "Nomade", "Vortex", "Comète", "Taïga", "Mirage", "Granit", "Sirocco", "Blizzard", "Cobra", "Falcon",
  "Onyx", "Pixel", "Rafale", "Zénith", "Kraken", "Nova", "Titan", "Loup", "Éclipse",
];

/** Mini-plan de chaque carte, dessine a partir de la vraie grille. */
function MapThumb({ id }: { id: DuelMapId }) {
  const map = buildDuelMap(id);
  const crates = new Set(map.crates.map(([x, y]) => `${x},${y}`));
  return (
    <svg viewBox={`0 0 ${map.width} ${map.height}`} className="h-16 w-full rounded bg-zinc-800/80" aria-hidden="true">
      {map.walls.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={crates.has(`${x},${y}`) ? "#8a6236" : "#0b0f14"} />
      ))}
      {map.marks.map((m) => (
        <circle key={`m${m.x}-${m.y}`} cx={m.x + 0.5} cy={m.y + 0.5} r={1.4} fill="none" stroke="#e0503a" strokeWidth={0.35} />
      ))}
      {map.spawns.a.map(([x, y]) => (
        <circle key={`a${x}-${y}`} cx={x + 0.5} cy={y + 0.5} r={0.55} fill="#22d3ee" />
      ))}
      {map.spawns.b.map(([x, y]) => (
        <circle key={`b${x}-${y}`} cx={x + 0.5} cy={y + 0.5} r={0.55} fill="#f87171" />
      ))}
    </svg>
  );
}

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

/** Silhouette de soldat aux couleurs d'une tenue, pour les cartes du casier. */
function SkinIcon({ id }: { id: SkinId }) {
  const s = SKINS[id];
  return (
    <svg viewBox="0 0 40 56" className="h-full w-full" aria-hidden="true">
      <rect x="13" y="30" width="6" height="20" rx="2" fill={hex(s.cloth)} />
      <rect x="21" y="30" width="6" height="20" rx="2" fill={hex(s.cloth)} />
      <rect x="12" y="47" width="8" height="4" rx="1" fill={hex(s.gear)} />
      <rect x="20" y="47" width="8" height="4" rx="1" fill={hex(s.gear)} />
      <rect x="10" y="16" width="20" height="17" rx="3" fill={hex(s.cloth)} />
      <rect x="13" y="18" width="14" height="12" rx="2" fill={hex(s.accent)} />
      <rect x="6" y="18" width="5" height="13" rx="2" fill={hex(s.cloth)} />
      <rect x="29" y="18" width="5" height="13" rx="2" fill={hex(s.cloth)} />
      <circle cx="20" cy="10" r="7" fill={hex(s.gear)} />
      <path d="M13 9 a7 7 0 0 1 14 0 z" fill={hex(s.accent)} />
      <rect x="15" y="10" width="10" height="2.5" rx="1" fill={hex(s.visor)} />
    </svg>
  );
}

/** Pastille de camouflage : les taches en degrade radial. */
function CamoSwatch({ id }: { id: CamoId }) {
  const c = CAMOS[id];
  if (c.colors.length === 0) {
    return <div className="h-full w-full rounded-md bg-gradient-to-br from-zinc-500 to-zinc-800" />;
  }
  const [a, b, d, e] = c.colors;
  return (
    <div
      className="h-full w-full rounded-md"
      style={{
        background: `radial-gradient(circle at 25% 30%, ${b} 0 18%, transparent 19%), radial-gradient(circle at 70% 65%, ${d} 0 22%, transparent 23%), radial-gradient(circle at 60% 20%, ${e ?? d} 0 12%, transparent 13%), radial-gradient(circle at 20% 80%, ${e ?? d} 0 14%, transparent 15%), ${a}`,
      }}
    />
  );
}

/** Icone de danse : une silhouette en mouvement, un geste par danse. */
const DANCE_EMOJI: Record<DanceId, string> = {
  salut: "👋",
  robot: "🤖",
  disco: "🕺",
  floss: "💃",
  fiesta: "🎉",
  champion: "🏆",
  ressort: "🦘",
  pantin: "🎭",
  vague: "🌊",
  moonwalk: "🌙",
  tourbillon: "🌀",
  carton: "🟥",
  loser: "🤟",
};

function ItemIcon({ itemKey }: { itemKey: string }) {
  const [kind, id] = itemKey.split(":");
  if (kind === "skin") return <SkinIcon id={id as SkinId} />;
  if (kind === "camo") return <CamoSwatch id={id as CamoId} />;
  return <div className="flex h-full w-full items-center justify-center text-4xl">{DANCE_EMOJI[id as DanceId]}</div>;
}

const KIND_LABEL: Record<string, string> = { skin: "Tenue", camo: "Camouflage", dance: "Danse" };

export default function DuelGame({ title, devAllowed = false }: { title: string; devAllowed?: boolean }) {
  const [phase, setPhase] = useState<Phase>("menu");
  const [modeId, setModeId] = useState<DuelModeId>("zone");
  /** Mode choisi dans le salon, lance par le gros bouton. */
  const [selectedMode, setSelectedMode] = useState<DuelModeId>("zone");
  /** Carte choisie pour les modes solo en arene (en ligne : toujours l'Arene). */
  const [mapId, setMapId] = useState<DuelMapId>("poussiere");
  /** Exercice du stand d'entrainement. */
  const [drill, setDrill] = useState<DrillId>("fixes");
  const [trainingBests, setTrainingBests] = useState<Partial<Record<DrillId, number>>>({});
  /** Cadeau de l'equipe recu a l'ouverture (panneau admin). */
  const [giftNote, setGiftNote] = useState<string | null>(null);
  /** Partie infinie : pas de score a atteindre, on quitte quand on veut. */
  const [infinite, setInfinite] = useState(false);
  const [joinInput, setJoinInput] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [side, setSide] = useState<DuelSide>("a");
  const [bot, setBot] = useState(false);
  const [opponentName, setOpponentName] = useState("Adversaire");
  const [copied, setCopied] = useState(false);
  /** Battle royale : joueurs trouves pendant la recherche. */
  const [lobbyCount, setLobbyCount] = useState(1);
  const [result, setResult] = useState<{
    win: boolean;
    mine: number;
    theirs: number;
    rank?: number;
    coins: number;
    xp: number;
    levelUp: boolean;
    training?: TrainingResult;
    record?: boolean;
    cheated?: boolean;
  } | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [options, setOptions] = useState<DuelOptions>(DEFAULT_DUEL_OPTIONS);
  const [profile, setProfile] = useState<DuelProfile>(DEFAULT_PROFILE);
  const [tab, setTab] = useState<LobbyTab | null>(null);
  const [previewWeapon, setPreviewWeapon] = useState<WeaponId>("fusil");
  const [shopNote, setShopNote] = useState<string | null>(null);
  /** Objet ou pack affiche en detail (apercu sur le personnage, achat). */
  const [selected, setSelected] = useState<{ type: "item"; key: string } | { type: "pack"; pack: ShopPack } | null>(null);
  /** Deuxieme clic pour confirmer un achat. */
  const [confirmBuy, setConfirmBuy] = useState(false);
  const [matchKey, setMatchKey] = useState(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null);
  // Boite aux lettres mutable : la scene 3D la lit a chaque image, sans
  // jamais declencher de rendu React sur un paquet reseau. On passe la REF
  // elle-meme a la scene (et non son contenu) : lire `.current` pendant le
  // rendu est interdit, mais le faire dans un effet ne l'est pas.
  const link = useRef<DuelLink>({
    remote: null,
    inbox: [],
    send: () => {},
  });

  useEffect(() => {
    link.current.send = (event, payload) => {
      channelRef.current?.send({ type: "broadcast", event, payload });
    };
  }, []);

  const cleanupChannel = useCallback(() => {
    if (channelRef.current) {
      const supabase = createClient();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    link.current.remote = null;
    link.current.inbox.length = 0;
  }, []);

  useEffect(() => cleanupChannel, [cleanupChannel]);

  useEffect(() => {
    const t = setTimeout(() => {
      setOptions(loadDuelOptions());
      setProfile(loadProfile());
      setTrainingBests(loadTrainingBests());
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // Cadeaux de l'equipe (envoyes depuis le panneau admin), et « give » admin
  // fait sur cet appareil : le profil est relu sans quitter le salon.
  useEffect(() => {
    let cancelled = false;
    claimMyGifts()
      .then((gifts) => {
        if (cancelled || gifts.length === 0) return;
        const saved = loadProfile();
        let coins = 0;
        let xp = 0;
        let all = false;
        const notes: string[] = [];
        for (const g of gifts) {
          if (g.kind === "pieces") coins += g.amount;
          else if (g.kind === "xp") xp += g.amount;
          else all = true;
          if (g.message) notes.push(g.message);
        }
        const owned = all ? Array.from(new Set([...saved.owned, ...allShopKeys()])) : saved.owned;
        const next = { ...saved, coins: saved.coins + coins, xp: saved.xp + xp, owned };
        saveProfile(next);
        setProfile(next);
        const what = [coins ? `+${coins.toLocaleString("fr-FR")} pièces` : "", xp ? `+${xp.toLocaleString("fr-FR")} XP` : "", all ? "tout le casier débloqué" : ""]
          .filter(Boolean)
          .join(", ");
        setGiftNote(`🎁 Cadeau de l'équipe Pixolud : ${what}${notes.length ? ` — « ${notes.join(" · ")} »` : ""}`);
      })
      .catch(() => {});
    const onGive = () => setProfile(loadProfile());
    window.addEventListener(GIVE_DUEL_EVENT, onGive);
    return () => {
      cancelled = true;
      window.removeEventListener(GIVE_DUEL_EVENT, onGive);
    };
  }, []);

  // Recherche de joueurs de la battle royale : le salon se remplit, puis on part.
  useEffect(() => {
    if (phase !== "matchmaking") return;
    const total = DUEL_MODES.zone.bots + 1;
    const iv = window.setInterval(() => {
      setLobbyCount((c) => {
        const next = Math.min(total, c + 1 + Math.floor(Math.random() * 3));
        if (next >= total) {
          window.clearInterval(iv);
          window.setTimeout(() => setPhase("playing"), 600);
        }
        return next;
      });
    }, 110);
    return () => window.clearInterval(iv);
  }, [phase]);

  function changeOptions(next: DuelOptions) {
    setOptions(next);
    saveDuelOptions(next);
  }

  function changeProfile(next: DuelProfile) {
    setProfile(next);
    saveProfile(next);
  }

  /** Equiper un objet deja possede (les danses s'utilisent toutes en partie). */
  function equip(key: string) {
    const [kind, id] = key.split(":");
    if (kind === "skin") changeProfile({ ...profile, skin: id as SkinId });
    else if (kind === "camo") changeProfile({ ...profile, camo: id as CamoId });
  }

  /** Acheter un objet : il est a toi, et deja equipe si c'est une tenue ou un camouflage. */
  function buyItem(key: string) {
    const item = shopItem(key);
    if (!item || profile.owned.includes(key)) return;
    if (profile.coins < item.price) {
      setShopNote(`Il te manque ${item.price - profile.coins} pièces pour « ${item.name} ». Joue une partie !`);
      return;
    }
    const [kind, id] = key.split(":");
    changeProfile({
      ...profile,
      coins: profile.coins - item.price,
      owned: [...profile.owned, key],
      ...(kind === "skin" ? { skin: id as SkinId } : kind === "camo" ? { camo: id as CamoId } : {}),
    });
    setShopNote(
      kind === "dance"
        ? `« ${item.name} » est à toi. En partie : touche G, puis son numéro.`
        : `« ${item.name} » est à toi, et déjà équipé.`,
    );
    setConfirmBuy(false);
  }

  function buyPack(pack: ShopPack) {
    const price = packPrice(pack, profile.owned);
    const missing = pack.items.filter((k) => !profile.owned.includes(k));
    if (missing.length === 0) return;
    if (profile.coins < price) {
      setShopNote(`Il te manque ${price - profile.coins} pièces pour le ${pack.name}.`);
      return;
    }
    changeProfile({ ...profile, coins: profile.coins - price, owned: [...profile.owned, ...missing] });
    setShopNote(`${pack.name} débloqué : ${missing.length} objet${missing.length > 1 ? "s" : ""} ajouté${missing.length > 1 ? "s" : ""} au casier.`);
    setConfirmBuy(false);
  }

  function claimGift() {
    const saved = loadProfile();
    if (!giftAvailable(saved)) return;
    changeProfile({ ...saved, coins: saved.coins + DAILY_GIFT, lastGift: dayKey() });
    setShopNote(`Cadeau du jour : +${DAILY_GIFT} pièces. Reviens demain !`);
  }

  function openItem(key: string) {
    setSelected({ type: "item", key });
    setConfirmBuy(false);
    setShopNote(null);
  }

  const connect = useCallback(
    (code: string, mySide: DuelSide) => {
      cleanupChannel();
      const supabase = createClient();
      const channel = supabase.channel(`duel-${code}`, {
        config: { broadcast: { self: false }, presence: { key: mySide } },
      });
      channelRef.current = channel;

      channel
        .on(
          "broadcast",
          { event: "state" },
          ({ payload }: { payload: NonNullable<DuelLink["remote"]> }) => {
            link.current.remote = payload;
          },
        )
        .on("broadcast", { event: "hit" }, ({ payload }: { payload: Record<string, unknown> }) => {
          link.current.inbox.push({ event: "hit", payload });
        })
        .on("broadcast", { event: "died" }, () => {
          link.current.inbox.push({ event: "died", payload: {} });
        })
        .on("broadcast", { event: "shot" }, ({ payload }: { payload: Record<string, unknown> }) => {
          link.current.inbox.push({ event: "shot", payload });
        })
        // Mesure du ping : l'un envoie son horodatage, l'autre le renvoie tel quel.
        .on("broadcast", { event: "ping" }, ({ payload }: { payload: Record<string, unknown> }) => {
          link.current.inbox.push({ event: "ping", payload });
        })
        .on("broadcast", { event: "pong" }, ({ payload }: { payload: Record<string, unknown> }) => {
          link.current.inbox.push({ event: "pong", payload });
        })
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState<{ side: DuelSide }>();
          const others = Object.values(state)
            .flatMap((e) => e)
            .filter((e) => e.side !== mySide);
          if (others.length > 0) {
            setOpponentName(mySide === "a" ? "Joueur B" : "Joueur A");
            setPhase((p) => (p === "waiting" ? "playing" : p));
          }
        })
        .subscribe((status: string) => {
          if (status === "SUBSCRIBED") channel.track({ side: mySide });
        });
    },
    [cleanupChannel],
  );

  function createRoom() {
    const code = generateDuelCode();
    setRoomCode(code);
    setSide("a");
    setBot(false);
    setModeId("duel");
    setResult(null);
    setMatchKey((k) => k + 1);
    setPhase("waiting");
    connect(code, "a");
  }

  function joinRoom() {
    const code = joinInput.trim().toUpperCase();
    if (code.length < 4) {
      setJoinError("Entre le code à 5 lettres reçu de ton adversaire.");
      return;
    }
    setJoinError(null);
    setRoomCode(code);
    setSide("b");
    setBot(false);
    setModeId("duel");
    setResult(null);
    setMatchKey((k) => k + 1);
    setPhase("waiting");
    connect(code, "b");
  }

  function startSolo(id: DuelModeId) {
    cleanupChannel();
    setRoomCode("");
    setSide("a");
    setBot(true);
    setModeId(id);
    setOpponentName("Sentinelle");
    setResult(null);
    setSelected(null);
    setMatchKey((k) => k + 1);
    if (id === "zone") {
      // Battle royale : on attend que le salon soit plein.
      setLobbyCount(1);
      setPhase("matchmaking");
    } else {
      setPhase("playing");
    }
  }

  function backToMenu() {
    cleanupChannel();
    setPhase("menu");
    setResult(null);
  }

  const ownedDances = DANCE_ORDER.filter((d) => profile.owned.includes(`dance:${d}`));

  if (phase === "playing") {
    const skin = SKINS[profile.skin];
    return (
      <DuelScene
        key={matchKey}
        side={side}
        bot={bot}
        mode={modeId}
        mapId={bot ? mapId : "arene"}
        opponentName={opponentName}
        link={link}
        look={{ camo: profile.camo, sleeve: skin.sleeve, glove: skin.glove }}
        skin={profile.skin}
        seed={matchKey * 7919 + 17}
        devAllowed={devAllowed}
        drill={drill}
        dances={ownedDances}
        infinite={bot && infinite && supportsInfinite(DUEL_MODES[modeId])}
        onMatchEnd={(win, mine, theirs, rank, extra?: MatchExtra) => {
          // Recompense : lue et ecrite d'un bloc sur le profil sauvegarde,
          // pour ne jamais perdre une partie jouee dans un autre onglet.
          // Une partie ou une triche a servi ne rapporte rien ; l'entrainement
          // rapporte un peu d'experience, pas de pieces.
          const saved = loadProfile();
          const base = matchReward(win, mine);
          const reward = extra?.cheated
            ? { coins: 0, xp: 0 }
            : extra?.training
              ? { coins: 0, xp: Math.min(60, 10 + extra.training.kills * 2) }
              : base;
          const before = levelInfo(saved.xp).level;
          const next = { ...saved, coins: saved.coins + reward.coins, xp: saved.xp + reward.xp };
          changeProfile(next);
          let record = false;
          if (extra?.training && !extra.cheated) {
            record = saveTrainingBest(extra.training.drill, extra.training.score);
            setTrainingBests(loadTrainingBests());
          }
          setResult({
            win,
            mine,
            theirs,
            rank,
            coins: reward.coins,
            xp: reward.xp,
            levelUp: levelInfo(next.xp).level > before,
            training: extra?.training,
            record,
            cheated: extra?.cheated,
          });
          setPhase("ended");
        }}
      />
    );
  }

  if (phase === "matchmaking") {
    const total = DUEL_MODES.zone.bots + 1;
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-5 bg-gradient-to-b from-[#0b2a4a] to-black px-4 text-white">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">Battle royale · contre des bots</p>
        <p className="text-3xl font-black uppercase italic">Recherche de joueurs…</p>
        <div className="w-72 max-w-full">
          <div className="h-3 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${(lobbyCount / total) * 100}%` }} />
          </div>
          <p className="mt-2 text-center font-mono text-2xl font-black text-yellow-300">
            {lobbyCount} / {total}
          </p>
        </div>
        <div className="flex max-w-xl flex-wrap justify-center gap-1.5">
          <span className="rounded-full bg-yellow-300 px-2.5 py-1 text-xs font-black text-black">Toi</span>
          {LOBBY_NAMES.slice(0, Math.max(0, lobbyCount - 1)).map((n) => (
            <span key={n} className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-zinc-200">
              {n}
            </span>
          ))}
        </div>
        <button type="button" onClick={backToMenu} className="text-xs text-zinc-400 hover:text-white">
          Annuler
        </button>
      </div>
    );
  }

  if (phase === "ended" && result) {
    const mode = DUEL_MODES[modeId];
    const tr = result.training;
    return (
      <div
        className={`flex h-full w-full flex-col items-center justify-center gap-4 overflow-y-auto px-4 py-6 text-center ${
          tr ? "bg-gradient-to-b from-sky-900 to-black" : result.win ? "bg-gradient-to-b from-cyan-900 to-black" : "bg-gradient-to-b from-red-950 to-black"
        }`}
      >
        {tr ? (
          <>
            <span className="text-5xl">🎯</span>
            <p className="text-3xl font-black uppercase italic text-yellow-300">{DRILLS[tr.drill].name}</p>
            <p className="font-mono text-4xl font-black text-white">
              {tr.score} <span className="text-lg text-zinc-400">pts</span>
            </p>
            {result.record && (
              <span className="rounded-full bg-yellow-300 px-4 py-1 text-sm font-black uppercase text-black">Nouveau record !</span>
            )}
            <div className="grid w-full max-w-md grid-cols-2 gap-2 text-left sm:grid-cols-3">
              {[
                ["Cibles", String(tr.kills)],
                ["Précision", tr.shots > 0 ? `${Math.round((tr.hits / tr.shots) * 100)} %` : "—"],
                ["Tirs", String(tr.shots)],
                ["Tête", String(tr.headshots)],
                ["Réaction", tr.avgReactionMs !== null ? `${tr.avgReactionMs} ms` : "—"],
                ["Ratées", String(tr.missedTargets)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-black/40 px-3 py-2 ring-1 ring-white/10">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{label}</p>
                  <p className="font-mono text-lg font-black text-white">{value}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-zinc-400">Record : {trainingBests[tr.drill] ?? tr.score} pts</p>
          </>
        ) : (
          <>
            <span className="text-5xl">{result.win ? "🏆" : "💀"}</span>
            <p className={`text-3xl font-black uppercase italic ${result.win ? "text-yellow-300" : "text-red-400"}`}>
              {mode.shrinkingZone
                ? result.win
                  ? "Top 1 !"
                  : `${result.rank ?? "?"}ᵉ sur ${mode.bots + 1}`
                : result.win
                  ? "Victoire !"
                  : "Défaite"}
            </p>
            <p className="font-mono text-lg text-zinc-300">
              {mode.shrinkingZone ? `${result.mine} élimination${result.mine > 1 ? "s" : ""}` : `${result.mine} — ${result.theirs}`}
            </p>
          </>
        )}
        {result.cheated ? (
          <span className="rounded-full bg-fuchsia-600/30 px-4 py-1.5 text-sm font-black text-fuchsia-200 ring-1 ring-fuchsia-400/60">
            🛠 Mode admin utilisé : aucune récompense
          </span>
        ) : (
          <div className="flex flex-wrap justify-center gap-2">
            {result.coins > 0 && (
              <span className="rounded-full bg-yellow-400/15 px-4 py-1.5 font-black text-yellow-300 ring-1 ring-yellow-400/40">
                +{result.coins} 🪙
              </span>
            )}
            <span className="rounded-full bg-cyan-400/15 px-4 py-1.5 font-black text-cyan-200 ring-1 ring-cyan-400/40">+{result.xp} XP</span>
            {result.levelUp && (
              <span className="rounded-full bg-violet-500/25 px-4 py-1.5 font-black text-violet-200 ring-1 ring-violet-400/60">
                Niveau {levelInfo(profile.xp).level} atteint !
              </span>
            )}
          </div>
        )}
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={bot ? () => startSolo(modeId) : backToMenu}
            className="rounded-lg bg-yellow-400 px-6 py-2.5 text-sm font-black uppercase italic text-black shadow-[0_4px_0_#a07a00] transition hover:bg-yellow-300 active:translate-y-0.5"
          >
            {bot ? "Rejouer" : "Nouvelle partie"}
          </button>
          <button
            type="button"
            onClick={backToMenu}
            className="rounded-lg border border-white/25 bg-black/30 px-5 py-2.5 text-sm font-bold uppercase text-zinc-100 hover:bg-white/10"
          >
            Salon
          </button>
          <Link
            href="/mode-3d"
            className="rounded-lg border border-white/15 px-5 py-2.5 text-sm font-semibold text-zinc-400 hover:bg-white/10"
          >
            Mode 3D
          </Link>
        </div>
      </div>
    );
  }

  if (phase === "waiting") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-5 bg-gradient-to-b from-zinc-950 to-black px-4">
        <span className="animate-pulse text-4xl">📡</span>
        <p className="text-lg font-bold text-white">En attente de ton adversaire...</p>
        <p className="max-w-sm text-center text-sm text-zinc-400">
          Envoie-lui ce code. Il doit ouvrir le même jeu et choisir « Rejoindre ».
        </p>
        <div className="flex items-center gap-2">
          {roomCode.split("").map((c, i) => (
            <span
              key={i}
              className="flex size-12 items-center justify-center rounded-xl bg-cyan-950 font-mono text-2xl font-black text-cyan-300 ring-1 ring-cyan-700"
            >
              {c}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(roomCode).then(
              () => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
              },
              () => {},
            );
          }}
          className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-zinc-200 ring-1 ring-white/20 hover:bg-white/20"
        >
          {copied ? "Code copié ✓" : "Copier le code"}
        </button>
        <button type="button" onClick={backToMenu} className="text-xs text-zinc-500 hover:text-zinc-300">
          Annuler
        </button>
      </div>
    );
  }

  // ------------------------------------------------------------------ salon
  const lvl = levelInfo(profile.xp);
  const skin = SKINS[profile.skin];
  const camo = CAMOS[profile.camo];
  const chosenMode = DUEL_MODES[selectedMode];
  const shopToday = dailyShop();
  const now = new Date();
  const msLeft = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
  const hoursLeft = Math.floor(msLeft / 3600000);
  const minutesLeft = Math.floor((msLeft % 3600000) / 60000);
  const gift = giftAvailable(profile);

  // Apercu sur le personnage : l'objet ouvert dans la boutique ou le casier.
  const previewItem = selected?.type === "item" ? shopItem(selected.key) : null;
  const stageSkin = previewItem?.kind === "skin" ? (previewItem.id as SkinId) : profile.skin;
  const stageCamo = previewItem?.kind === "camo" ? (previewItem.id as CamoId) : profile.camo;
  const stageDance = previewItem?.kind === "dance" ? (previewItem.id as DanceId) : null;

  /** Carte d'objet facon casier : fond de rarete, nom, etat. */
  function itemCard(itemKey: string, big = false) {
    const item = shopItem(itemKey);
    if (!item) return null;
    const rarity = RARITY[item.rarity];
    const isOwned = profile.owned.includes(itemKey);
    const equipped =
      (item.kind === "skin" && profile.skin === item.id) || (item.kind === "camo" && profile.camo === item.id);
    const active = selected?.type === "item" && selected.key === itemKey;
    return (
      <button
        key={itemKey}
        type="button"
        onClick={() => openItem(itemKey)}
        className={`group relative flex flex-col overflow-hidden rounded-lg text-left ring-2 transition hover:-translate-y-0.5 hover:brightness-110 ${
          active ? "ring-white" : equipped ? "ring-yellow-300" : "ring-black/40"
        }`}
        style={{ background: `linear-gradient(160deg, ${rarity.color} 0%, #101521 78%)`, boxShadow: `0 6px 18px ${rarity.glow}` }}
      >
        <div className={`mx-auto ${big ? "h-32 w-24" : "h-20 w-16"} p-1.5`}>
          <ItemIcon itemKey={itemKey} />
        </div>
        <div className="bg-black/55 px-2 py-1.5">
          <p className={`truncate font-black uppercase italic leading-tight ${big ? "text-base" : "text-xs"}`}>{item.name}</p>
          <p className="text-[10px] font-bold uppercase" style={{ color: rarity.color }}>
            {rarity.label} · {KIND_LABEL[item.kind]}
          </p>
          <p className="mt-0.5 text-[11px] font-black">
            {equipped ? (
              <span className="text-yellow-300">✓ Équipé</span>
            ) : isOwned ? (
              <span className="text-emerald-300">{item.kind === "dance" ? "✓ Possédée" : "Équiper"}</span>
            ) : (
              <span className={profile.coins >= item.price ? "text-yellow-200" : "text-zinc-400"}>🪙 {item.price}</span>
            )}
          </p>
        </div>
      </button>
    );
  }

  /** Detail de l'objet ou du pack ouvert : apercu, prix, achat en deux clics. */
  function detailPanel() {
    if (!selected) return null;
    if (selected.type === "pack") {
      const pack = selected.pack;
      const price = packPrice(pack, profile.owned);
      const missing = pack.items.filter((k) => !profile.owned.includes(k));
      return (
        <div className="rounded-xl bg-black/70 p-3 ring-1 ring-white/15 backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-lg font-black uppercase italic">{pack.name}</p>
              <p className="text-xs text-zinc-300">{pack.tagline}</p>
            </div>
            <button type="button" onClick={() => setSelected(null)} className="rounded px-2 text-zinc-400 hover:text-white" aria-label="Fermer">
              ✕
            </button>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">{pack.items.map((k) => itemCard(k))}</div>
          {missing.length === 0 ? (
            <p className="mt-2 text-sm font-black text-emerald-300">Tu as déjà tout le pack.</p>
          ) : (
            <button
              type="button"
              onClick={() => (confirmBuy ? buyPack(pack) : setConfirmBuy(true))}
              className={`mt-3 w-full rounded-lg px-4 py-2.5 text-sm font-black uppercase ${
                confirmBuy ? "bg-emerald-400 text-black" : profile.coins >= price ? "bg-yellow-300 text-black hover:bg-yellow-200" : "bg-white/10 text-zinc-400"
              }`}
            >
              {confirmBuy ? `Confirmer : 🪙 ${price}` : `Acheter le pack · 🪙 ${price}`}
            </button>
          )}
        </div>
      );
    }
    const item = shopItem(selected.key);
    if (!item) return null;
    const rarity = RARITY[item.rarity];
    const owned = profile.owned.includes(item.key);
    const equipped = (item.kind === "skin" && profile.skin === item.id) || (item.kind === "camo" && profile.camo === item.id);
    return (
      <div className="rounded-xl bg-black/70 p-3 ring-1 ring-white/15 backdrop-blur">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: rarity.color }}>
              {rarity.label} · {KIND_LABEL[item.kind]}
            </p>
            <p className="text-xl font-black uppercase italic">{item.name}</p>
            <p className="text-xs text-zinc-300">{item.tagline}</p>
          </div>
          <button type="button" onClick={() => setSelected(null)} className="rounded px-2 text-zinc-400 hover:text-white" aria-label="Fermer">
            ✕
          </button>
        </div>
        <p className="mt-1 text-[11px] text-sky-200">
          {item.kind === "dance" ? "Ton personnage la danse à droite. En partie : touche G." : "Aperçu sur ton personnage, à droite."}
        </p>
        {owned ? (
          item.kind === "dance" ? (
            <p className="mt-2 text-sm font-black text-emerald-300">✓ Dans ton casier</p>
          ) : (
            <button
              type="button"
              disabled={equipped}
              onClick={() => equip(item.key)}
              className="mt-3 w-full rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-black uppercase text-black disabled:bg-white/10 disabled:text-yellow-300"
            >
              {equipped ? "✓ Équipé" : "Équiper"}
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={() => (confirmBuy ? buyItem(item.key) : setConfirmBuy(true))}
            className={`mt-3 w-full rounded-lg px-4 py-2.5 text-sm font-black uppercase ${
              confirmBuy ? "bg-emerald-400 text-black" : profile.coins >= item.price ? "bg-yellow-300 text-black hover:bg-yellow-200" : "bg-white/10 text-zinc-400"
            }`}
          >
            {confirmBuy ? `Confirmer l'achat : 🪙 ${item.price}` : `Acheter · 🪙 ${item.price}`}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-sky-500 text-white">
      <DuelLobbyStage skin={stageSkin} camo={stageCamo} weapon={previewWeapon} dance={stageDance} />
      {/* Voile a gauche : le texte reste lisible sur le ciel. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-full bg-gradient-to-r from-[#061528]/85 via-[#061528]/35 to-transparent sm:w-[62%]" />

      {/* --- Barre du haut --- */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 bg-gradient-to-b from-[#04101f]/90 to-transparent px-3 pb-4 pt-2">
        <Link
          href="/mode-3d"
          className="rounded-md bg-black/40 px-2.5 py-1.5 text-xs font-bold text-zinc-200 ring-1 ring-white/15 hover:bg-black/60"
        >
          ←
        </Link>
        <div className="flex items-center gap-2 rounded-md bg-black/40 px-2 py-1 ring-1 ring-white/15">
          <span className="flex size-8 items-center justify-center rounded bg-gradient-to-b from-yellow-300 to-amber-600 text-sm font-black text-black">
            {lvl.level}
          </span>
          <div className="hidden w-20 sm:block">
            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-300">Niveau</p>
            <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-cyan-300" style={{ width: `${Math.round((lvl.into / lvl.need) * 100)}%` }} />
            </div>
          </div>
        </div>

        <nav className="mx-auto flex min-w-0 items-center gap-0.5 overflow-x-auto">
          {TABS.map((t) => {
            const active = tab === t.id;
            const settings = t.id === "reglages";
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(active ? null : t.id);
                  setSelected(null);
                  setShopNote(null);
                }}
                className={`relative shrink-0 whitespace-nowrap rounded px-2.5 py-1.5 text-xs font-black uppercase italic tracking-wide transition sm:px-3.5 sm:text-sm ${
                  active
                    ? "bg-yellow-300 text-black"
                    : settings
                      ? "bg-cyan-500/25 text-cyan-100 ring-1 ring-cyan-300/60 hover:bg-cyan-500/40"
                      : "text-zinc-100 hover:bg-white/10"
                }`}
              >
                {settings && "🎯 "}
                {t.label}
                {t.id === "boutique" && gift && <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-red-500" />}
              </button>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 rounded-md bg-black/45 px-2.5 py-1.5 ring-1 ring-yellow-300/40">
          <span>🪙</span>
          <span className="font-mono text-sm font-black text-yellow-200">{profile.coins.toLocaleString("fr-FR")}</span>
        </div>
      </header>

      {giftNote && (
        <button
          type="button"
          onClick={() => setGiftNote(null)}
          className="absolute left-1/2 top-16 z-30 -translate-x-1/2 rounded-xl bg-gradient-to-r from-amber-400 to-rose-500 px-5 py-3 text-sm font-black text-black shadow-2xl"
        >
          {giftNote} <span className="ml-2 opacity-60">✕</span>
        </button>
      )}

      {/* --- Accueil : tenue equipee et reglages --- */}
      {tab === null && (
        <div className="absolute left-3 top-16 z-10 flex w-[min(20rem,calc(100%-1.5rem))] flex-col gap-3">
          <div className="text-left">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-cyan-200/80">{title}</p>
            <p className="text-2xl font-black uppercase italic leading-none drop-shadow">Salon</p>
          </div>

          <button
            type="button"
            onClick={() => setTab("casier")}
            className="overflow-hidden rounded-lg text-left ring-2 ring-black/30 transition hover:ring-yellow-300"
            style={{ background: `linear-gradient(135deg, ${RARITY[skin.rarity].color} 0%, #0d1628 70%)` }}
          >
            <div className="flex items-center gap-3 p-2.5">
              <div className="h-16 w-12 shrink-0">
                <SkinIcon id={profile.skin} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Tenue</p>
                <p className="truncate text-lg font-black uppercase italic leading-tight">{skin.name}</p>
                <p className="text-[10px] font-bold uppercase" style={{ color: RARITY[skin.rarity].color }}>
                  {"★".repeat(SKIN_ORDER.indexOf(profile.skin) > 3 ? 5 : 3)} {RARITY[skin.rarity].label}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-black/45 px-2.5 py-2">
              <div className="size-7 shrink-0">
                <CamoSwatch id={profile.camo} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold uppercase tracking-wider text-white/60">Camouflage d&apos;arme</p>
                <p className="truncate text-sm font-black uppercase italic">{camo.name}</p>
              </div>
              <span className="rounded bg-white/15 px-2 py-1 text-[10px] font-black uppercase">Modifier</span>
            </div>
          </button>

          {gift && (
            <button
              type="button"
              onClick={() => setTab("boutique")}
              className="flex items-center gap-3 rounded-lg bg-gradient-to-r from-amber-500/90 to-rose-600/90 p-2.5 text-left ring-2 ring-yellow-200/60 transition hover:ring-white"
            >
              <span className="text-2xl">🎁</span>
              <div>
                <p className="text-sm font-black uppercase italic">Cadeau du jour</p>
                <p className="text-[11px] text-white/90">+{DAILY_GIFT} pièces à récupérer dans la boutique</p>
              </div>
            </button>
          )}

          {/* Reglages du tir : en evidence, avec l'apercu du reticule. */}
          <button
            type="button"
            onClick={() => setTab("reglages")}
            className="flex items-center gap-3 rounded-lg bg-gradient-to-r from-cyan-600/90 to-cyan-900/90 p-2.5 text-left ring-2 ring-cyan-300/60 transition hover:ring-yellow-300"
          >
            <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-black/60">
              <DuelCrosshair options={options} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black uppercase italic">🎯 Réglages du tir</p>
              <p className="text-[11px] leading-snug text-cyan-100/85">
                Réticule · laser {options.laser ? "allumé" : "éteint"} · FPS/ping · bots {BOT_LEVELS[options.bots].label}
              </p>
            </div>
          </button>

          <p className="hidden text-[11px] text-white/70 sm:block">Fais glisser ton personnage pour le tourner.</p>
        </div>
      )}

      {/* --- Onglets --- */}
      {tab !== null && (
        <div className="absolute inset-x-0 bottom-0 top-14 z-10 overflow-y-auto px-3 pb-28">
          <div className="max-w-3xl">
            {tab === "jouer" && (
              <div className="space-y-3">
                <h2 className="text-2xl font-black uppercase italic drop-shadow">Choisis ton mode</h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {DUEL_MODE_ORDER.map((id) => {
                    const m = DUEL_MODES[id];
                    const style = MODE_STYLE[id];
                    const active = selectedMode === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSelectedMode(id)}
                        className={`rounded-lg bg-gradient-to-br p-3 text-left ring-2 transition hover:brightness-110 ${style.bg} ${
                          active ? "ring-yellow-300" : "ring-black/30"
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-lg font-black uppercase italic">{m.name}</p>
                          <span className={`text-[10px] font-black uppercase ${style.text}`}>{m.tagline}</span>
                        </div>
                        <p className="mt-1 text-xs leading-snug text-white/80">{m.detail}</p>
                        {active && <p className="mt-1.5 text-[11px] font-black uppercase text-yellow-300">✓ Sélectionné</p>}
                      </button>
                    );
                  })}
                </div>

                {supportsInfinite(chosenMode) && (
                  <button
                    type="button"
                    onClick={() => setInfinite((v) => !v)}
                    aria-pressed={infinite}
                    className={`flex w-full items-center gap-3 rounded-lg p-3 text-left ring-2 transition ${
                      infinite ? "bg-violet-500/30 ring-violet-300" : "bg-black/45 ring-white/10 hover:bg-black/60"
                    }`}
                  >
                    <span className="text-3xl font-black text-violet-200">∞</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black uppercase italic">Partie infinie</p>
                      <p className="text-[11px] leading-snug text-zinc-300">
                        Pas de score à atteindre : tu joues autant que tu veux et tu quittes quand tu veux (Échap, puis « Terminer la
                        partie »).
                      </p>
                    </div>
                    <span
                      className={`relative h-6 w-11 shrink-0 rounded-full transition ${infinite ? "bg-violet-400" : "bg-white/20"}`}
                      aria-hidden="true"
                    >
                      <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${infinite ? "left-5" : "left-0.5"}`} />
                    </span>
                  </button>
                )}

                {/* Battle royale : contre des bots maintenant, en ligne bientot. */}
                {selectedMode === "zone" && (
                  <div className="rounded-lg bg-black/45 p-3 ring-1 ring-white/10">
                    <p className="mb-2 text-xs font-black uppercase tracking-wider text-zinc-300">Type de partie</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-md bg-emerald-400/20 p-2.5 ring-2 ring-emerald-300">
                        <p className="text-sm font-black uppercase italic">🤖 Contre des bots</p>
                        <p className="text-[11px] leading-snug text-zinc-300">29 bots, tout de suite.</p>
                        <p className="mt-1 text-[10px] font-black uppercase text-emerald-300">✓ Disponible</p>
                      </div>
                      <div aria-disabled="true" className="cursor-not-allowed rounded-md bg-white/5 p-2.5 opacity-60 ring-1 ring-white/10">
                        <p className="text-sm font-black uppercase italic">🌐 Multijoueur</p>
                        <p className="text-[11px] leading-snug text-zinc-400">Jusqu&apos;à 30 vrais joueurs.</p>
                        <p className="mt-1 inline-block rounded bg-amber-400/20 px-1.5 text-[10px] font-black uppercase text-amber-300">Bientôt</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Entrainement : l'exercice, et son record. */}
                {selectedMode === "entrainement" && (
                  <div className="rounded-lg bg-black/45 p-3 ring-1 ring-white/10">
                    <p className="mb-2 text-xs font-black uppercase tracking-wider text-zinc-300">Exercice · une minute</p>
                    <div className="grid grid-cols-2 gap-2">
                      {DRILL_ORDER.map((d) => {
                        const info = DRILLS[d];
                        const active = drill === d;
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setDrill(d)}
                            aria-pressed={active}
                            className={`rounded-md p-2.5 text-left ring-2 transition ${
                              active ? "bg-sky-400/20 ring-yellow-300" : "bg-white/5 ring-white/10 hover:bg-white/10"
                            }`}
                          >
                            <div className="flex items-baseline justify-between gap-1">
                              <p className="text-sm font-black uppercase italic">{info.name}</p>
                              <span className="text-[10px] font-black uppercase text-sky-300">{info.tagline}</span>
                            </div>
                            <p className="text-[11px] leading-snug text-zinc-300">{info.detail}</p>
                            <p className="mt-1 text-[10px] font-bold text-yellow-200">
                              Record : {trainingBests[d] !== undefined ? `${trainingBests[d]} pts` : "—"}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {chosenMode.arena !== "zone" && !chosenMode.map && (
                  <div className="rounded-lg bg-black/45 p-3 ring-1 ring-white/10">
                    <p className="mb-2 text-xs font-black uppercase tracking-wider text-zinc-300">Carte</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {DUEL_MAP_ORDER.map((id) => {
                        const info = DUEL_MAP_INFO[id];
                        const active = mapId === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setMapId(id)}
                            aria-pressed={active}
                            className={`flex flex-col items-center gap-1 rounded-md p-1.5 text-center ring-2 transition ${
                              active ? "bg-yellow-300/15 ring-yellow-300" : "bg-black/30 ring-white/10 hover:bg-white/5"
                            }`}
                          >
                            <MapThumb id={id} />
                            <span className="text-sm font-black uppercase italic">{info.name}</span>
                            <span className="text-[10px] leading-tight text-zinc-300">{info.tagline}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!chosenMode.training && (
                  <div className="rounded-lg bg-black/45 p-3 ring-1 ring-white/10">
                    <p className="mb-2 text-xs font-black uppercase tracking-wider text-zinc-300">Difficulté des bots</p>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      {BOT_ORDER.map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => changeOptions({ ...options, bots: b })}
                          className={`rounded-md px-2 py-2 text-left ring-2 transition ${
                            options.bots === b ? "bg-yellow-300 text-black ring-yellow-300" : "bg-white/5 ring-white/10 hover:bg-white/10"
                          }`}
                        >
                          <p className="text-sm font-black uppercase italic">{BOT_LEVELS[b].label}</p>
                          <p className={`text-[10px] leading-tight ${options.bots === b ? "text-black/70" : "text-zinc-400"}`}>
                            {BOT_LEVELS[b].tagline}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-lg bg-gradient-to-br from-cyan-800/70 to-slate-950/80 p-3 ring-1 ring-cyan-400/30">
                  <p className="text-lg font-black uppercase italic">En ligne · 1 contre 1</p>
                  <p className="text-xs text-zinc-300">Le mode Duel contre une vraie personne, avec un code de salon.</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={createRoom}
                      className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-black uppercase text-black transition hover:bg-cyan-400"
                    >
                      Créer un duel
                    </button>
                    <input
                      value={joinInput}
                      onChange={(e) => {
                        setJoinInput(e.target.value.toUpperCase().slice(0, 5));
                        setJoinError(null);
                      }}
                      placeholder="CODE"
                      className="w-28 rounded-md bg-black/50 px-3 py-2 text-center font-mono text-lg font-bold uppercase tracking-widest text-cyan-300 outline-none ring-1 ring-white/15 focus:ring-cyan-400"
                    />
                    <button
                      type="button"
                      onClick={joinRoom}
                      className="rounded-md border border-white/25 px-4 py-2 text-sm font-bold uppercase text-zinc-100 transition hover:bg-white/10"
                    >
                      Rejoindre
                    </button>
                  </div>
                  {joinError && <p className="mt-2 text-xs font-semibold text-red-300">{joinError}</p>}
                </div>
              </div>
            )}

            {tab === "casier" && (
              <div className="space-y-4">
                <h2 className="text-2xl font-black uppercase italic drop-shadow">Casier</h2>
                {shopNote && <p className="rounded-md bg-black/55 px-3 py-2 text-sm font-semibold text-yellow-100">{shopNote}</p>}
                {selected && <div className="sticky top-0 z-10 max-w-md">{detailPanel()}</div>}
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-wider text-zinc-200">Tenues</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-7">{SKIN_ORDER.map((id) => itemCard(`skin:${id}`))}</div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-wider text-zinc-200">
                    Camouflages d&apos;arme <span className="normal-case tracking-normal text-zinc-400">· visibles sur ton arme en jeu</span>
                  </p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-7">{CAMO_ORDER.map((id) => itemCard(`camo:${id}`))}</div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-wider text-zinc-200">
                    Danses <span className="normal-case tracking-normal text-zinc-400">· en partie, touche G puis le numéro</span>
                  </p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">{DANCE_ORDER.map((id) => itemCard(`dance:${id}`))}</div>
                </div>
                <p className="text-xs text-white/75">
                  Clique sur un objet pour le voir sur ton personnage. Les pièces se gagnent en jouant : éliminations et victoires. Rien ne
                  s&apos;achète avec de l&apos;argent réel.
                </p>
              </div>
            )}

            {tab === "boutique" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-2xl font-black uppercase italic drop-shadow">Boutique</h2>
                  <span className="rounded bg-black/50 px-2 py-1 text-xs font-bold text-zinc-200">
                    Nouveaux objets dans {hoursLeft} h {String(minutesLeft).padStart(2, "0")}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={!gift}
                  onClick={claimGift}
                  className={`flex w-full items-center gap-3 rounded-lg p-3 text-left ring-2 transition ${
                    gift ? "bg-gradient-to-r from-amber-500 to-rose-600 ring-yellow-200 hover:brightness-110" : "bg-black/40 ring-white/10"
                  }`}
                >
                  <span className="text-3xl">{gift ? "🎁" : "✅"}</span>
                  <div>
                    <p className="text-sm font-black uppercase italic">{gift ? `Cadeau du jour : +${DAILY_GIFT} pièces` : "Cadeau du jour récupéré"}</p>
                    <p className="text-[11px] text-white/85">{gift ? "Clique pour le récupérer." : "Reviens demain pour le suivant."}</p>
                  </div>
                </button>

                {shopNote && <p className="rounded-md bg-black/55 px-3 py-2 text-sm font-semibold text-yellow-100">{shopNote}</p>}
                {selected && <div className="sticky top-0 z-10 max-w-md">{detailPanel()}</div>}

                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-wider text-yellow-200">★ À la une</p>
                  <div className="grid grid-cols-2 gap-3">{shopToday.featured.map((key) => itemCard(key, true))}</div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-wider text-zinc-200">Offres du jour</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{shopToday.daily.map((key) => itemCard(key))}</div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-wider text-zinc-200">Packs · jusqu&apos;à −35 %</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {SHOP_PACKS.map((pack) => {
                      const price = packPrice(pack, profile.owned);
                      const done = pack.items.every((k) => profile.owned.includes(k));
                      return (
                        <button
                          key={pack.id}
                          type="button"
                          onClick={() => {
                            setSelected({ type: "pack", pack });
                            setConfirmBuy(false);
                            setShopNote(null);
                          }}
                          className="flex flex-col gap-1 rounded-lg bg-gradient-to-br from-violet-700/80 to-slate-950/90 p-2.5 text-left ring-2 ring-black/30 transition hover:ring-yellow-300"
                        >
                          <div className="flex gap-1">
                            {pack.items.map((k) => (
                              <div key={k} className="h-12 w-10">
                                <ItemIcon itemKey={k} />
                              </div>
                            ))}
                          </div>
                          <p className="text-sm font-black uppercase italic">{pack.name}</p>
                          <p className="text-[11px] font-black text-yellow-200">
                            {done ? "✓ Complet" : `🪙 ${price} · −${Math.round(pack.discount * 100)} %`}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {tab === "arsenal" && (
              <div className="space-y-3">
                <h2 className="text-2xl font-black uppercase italic drop-shadow">Arsenal · {SHOP_ORDER.length} armes</h2>
                <p className="text-xs text-white/75">Clique sur une arme pour l&apos;afficher à côté de ton personnage, avec ton camouflage.</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {SHOP_ORDER.map((id) => {
                    const w = WEAPONS[id];
                    const bars: [string, number][] = [
                      ["Dégâts", Math.min(1, (w.damage * w.pellets) / 112)],
                      ["Cadence", Math.min(1, 60 / w.fireInterval / 1100)],
                      ["Portée", Math.min(1, w.range / 40)],
                      ["Chargeur", Math.min(1, w.magSize / 75)],
                    ];
                    const active = previewWeapon === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setPreviewWeapon(id)}
                        className={`rounded-lg bg-black/55 px-3 py-2 text-left ring-2 transition hover:bg-black/70 ${
                          active ? "ring-yellow-300" : "ring-white/10"
                        }`}
                      >
                        <p className="text-sm font-black uppercase italic">{w.name}</p>
                        {bars.map(([label, value]) => (
                          <div key={label} className="mt-1 flex items-center gap-2">
                            <span className="w-14 text-[10px] font-bold uppercase text-zinc-400">{label}</span>
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                              <div className="h-full rounded-full bg-cyan-300" style={{ width: `${Math.round(value * 100)}%` }} />
                            </div>
                          </div>
                        ))}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {tab === "reglages" && (
              <div className="space-y-3">
                <h2 className="text-2xl font-black uppercase italic drop-shadow">🎯 Réglages du tir</h2>
                <DuelOptionsPanel options={options} onChange={changeOptions} />
                <div className="grid gap-1 rounded-lg bg-black/50 p-3 text-xs text-zinc-300 sm:grid-cols-2">
                  <p><b className="text-white">Déplacement</b> — ZQSD ou WASD, Maj pour sprinter</p>
                  <p><b className="text-white">Tirer</b> — clic gauche · <b className="text-white">Viser</b> — clic droit</p>
                  <p><b className="text-white">Recharger</b> — R · <b className="text-white">Laser</b> — L</p>
                  <p><b className="text-white">S&apos;accroupir</b> — C (tenir)</p>
                  <p><b className="text-white">Armes</b> — 1 à 3 ou molette · <b className="text-white">Échanger</b> — E</p>
                  <p><b className="text-white">Danses</b> — G, puis le numéro</p>
                  <p><b className="text-white">Construire</b> — F (mode 1v1 Construction)</p>
                  <p><b className="text-white">Économie</b> — 1 à 0 (Maj pour la suite) pour acheter, B boutique</p>
                  {devAllowed && <p className="text-fuchsia-200"><b>Mode admin</b> — F2 en partie solo</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Lancer --- */}
      <div className="absolute bottom-3 right-3 z-20 flex flex-col items-end gap-1.5">
        <button
          type="button"
          onClick={() => setTab("jouer")}
          className="rounded-md bg-black/55 px-3 py-1.5 text-right ring-1 ring-white/15 transition hover:bg-black/75"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-300">
            {chosenMode.arena === "zone"
              ? "Île géante · contre des bots"
              : chosenMode.training
                ? `${DRILLS[drill].name} · ${DUEL_MAP_INFO[mapId].name}`
                : `${DUEL_MAP_INFO[chosenMode.map ?? mapId].name} · Bots ${BOT_LEVELS[options.bots].label}${
                    infinite && supportsInfinite(chosenMode) ? " · ∞" : ""
                  }`}
          </p>
          <p className="text-sm font-black uppercase italic">
            {chosenMode.name} <span className="text-yellow-300">· changer</span>
          </p>
        </button>
        <button
          type="button"
          onClick={() => startSolo(selectedMode)}
          className="rounded-lg bg-gradient-to-b from-yellow-300 to-yellow-500 px-10 py-3.5 text-2xl font-black uppercase italic tracking-wide text-black shadow-[0_5px_0_#9a7400,0_10px_24px_rgba(0,0,0,0.45)] transition hover:from-yellow-200 hover:to-yellow-400 active:translate-y-1 active:shadow-[0_1px_0_#9a7400] sm:px-14 sm:text-3xl"
        >
          Lancer
        </button>
      </div>
    </div>
  );
}
