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
  DEFAULT_PROFILE,
  RARITY,
  SKINS,
  SKIN_ORDER,
  dailyShop,
  levelInfo,
  loadProfile,
  matchReward,
  saveProfile,
  type CamoId,
  type DuelProfile,
  type SkinId,
} from "@/lib/duelProfile";
import { buildDuelMap, DUEL_MAP_INFO, DUEL_MAP_ORDER, generateDuelCode, type DuelMapId, type DuelSide } from "@/lib/duel";
import { DUEL_MODES, DUEL_MODE_ORDER, type DuelModeId } from "@/lib/duelModes";
import { WEAPONS, SHOP_ORDER, type WeaponId } from "@/lib/duelWeapons";
import DuelScene, { type DuelLink } from "./DuelScene";

type Phase = "menu" | "waiting" | "playing" | "ended";
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
};

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

export default function DuelGame({ title }: { title: string }) {
  const [phase, setPhase] = useState<Phase>("menu");
  const [modeId, setModeId] = useState<DuelModeId>("zone");
  /** Mode choisi dans le salon, lance par le gros bouton. */
  const [selectedMode, setSelectedMode] = useState<DuelModeId>("zone");
  /** Carte choisie pour les modes solo en arene (en ligne : toujours l'Arene). */
  const [mapId, setMapId] = useState<DuelMapId>("poussiere");
  const [joinInput, setJoinInput] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [side, setSide] = useState<DuelSide>("a");
  const [bot, setBot] = useState(false);
  const [opponentName, setOpponentName] = useState("Adversaire");
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<{
    win: boolean;
    mine: number;
    theirs: number;
    rank?: number;
    coins: number;
    xp: number;
    levelUp: boolean;
  } | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [options, setOptions] = useState<DuelOptions>(DEFAULT_DUEL_OPTIONS);
  const [profile, setProfile] = useState<DuelProfile>(DEFAULT_PROFILE);
  const [tab, setTab] = useState<LobbyTab | null>(null);
  const [previewWeapon, setPreviewWeapon] = useState<WeaponId>("fusil");
  const [shopNote, setShopNote] = useState<string | null>(null);
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
    }, 0);
    return () => clearTimeout(t);
  }, []);

  function changeOptions(next: DuelOptions) {
    setOptions(next);
    saveDuelOptions(next);
  }

  function changeProfile(next: DuelProfile) {
    setProfile(next);
    saveProfile(next);
  }

  /** Acheter ou equiper un objet du casier (« skin:neon », « camo:or »). */
  function takeItem(key: string) {
    const [kind, id] = key.split(":") as ["skin" | "camo", string];
    const item = kind === "skin" ? SKINS[id as SkinId] : CAMOS[id as CamoId];
    if (!item) return;
    if (!profile.owned.includes(key)) {
      if (profile.coins < item.price) {
        setShopNote(`Il te manque ${item.price - profile.coins} pièces pour « ${item.name} ». Joue une partie !`);
        return;
      }
      setShopNote(`« ${item.name} » est à toi, et déjà équipé.`);
      changeProfile({
        ...profile,
        coins: profile.coins - item.price,
        owned: [...profile.owned, key],
        ...(kind === "skin" ? { skin: id as SkinId } : { camo: id as CamoId }),
      });
      return;
    }
    setShopNote(null);
    changeProfile({ ...profile, ...(kind === "skin" ? { skin: id as SkinId } : { camo: id as CamoId }) });
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
    setMatchKey((k) => k + 1);
    setPhase("playing");
  }

  function backToMenu() {
    cleanupChannel();
    setPhase("menu");
    setResult(null);
  }

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
        onMatchEnd={(win, mine, theirs, rank) => {
          // Recompense : lue et ecrite d'un bloc sur le profil sauvegarde,
          // pour ne jamais perdre une partie jouee dans un autre onglet.
          const saved = loadProfile();
          const reward = matchReward(win, mine);
          const before = levelInfo(saved.xp).level;
          const next = { ...saved, coins: saved.coins + reward.coins, xp: saved.xp + reward.xp };
          changeProfile(next);
          setResult({
            win,
            mine,
            theirs,
            rank,
            coins: reward.coins,
            xp: reward.xp,
            levelUp: levelInfo(next.xp).level > before,
          });
          setPhase("ended");
        }}
      />
    );
  }

  if (phase === "ended" && result) {
    const mode = DUEL_MODES[modeId];
    return (
      <div
        className={`flex h-full w-full flex-col items-center justify-center gap-4 px-4 text-center ${
          result.win ? "bg-gradient-to-b from-cyan-900 to-black" : "bg-gradient-to-b from-red-950 to-black"
        }`}
      >
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
          {mode.shrinkingZone
            ? `${result.mine} élimination${result.mine > 1 ? "s" : ""}`
            : `${result.mine} — ${result.theirs}`}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <span className="rounded-full bg-yellow-400/15 px-4 py-1.5 font-black text-yellow-300 ring-1 ring-yellow-400/40">
            +{result.coins} 🪙
          </span>
          <span className="rounded-full bg-cyan-400/15 px-4 py-1.5 font-black text-cyan-200 ring-1 ring-cyan-400/40">
            +{result.xp} XP
          </span>
          {result.levelUp && (
            <span className="rounded-full bg-violet-500/25 px-4 py-1.5 font-black text-violet-200 ring-1 ring-violet-400/60">
              Niveau {levelInfo(profile.xp).level} atteint !
            </span>
          )}
        </div>
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
  const selected = DUEL_MODES[selectedMode];
  const shopToday = dailyShop();
  const now = new Date();
  const msLeft = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
  const hoursLeft = Math.floor(msLeft / 3600000);
  const minutesLeft = Math.floor((msLeft % 3600000) / 60000);

  /** Carte d'objet facon casier : fond de rarete, nom, etat. */
  function itemCard(itemKey: string, big = false) {
    const [kind, id] = itemKey.split(":");
    const item = kind === "skin" ? SKINS[id as SkinId] : CAMOS[id as CamoId];
    const rarity = RARITY[item.rarity];
    const isOwned = profile.owned.includes(itemKey);
    const equipped = kind === "skin" ? profile.skin === id : profile.camo === id;
    return (
      <button
        key={itemKey}
        type="button"
        onClick={() => takeItem(itemKey)}
        className={`group relative flex flex-col overflow-hidden rounded-lg text-left ring-2 transition hover:-translate-y-0.5 hover:brightness-110 ${
          equipped ? "ring-yellow-300" : "ring-black/40"
        }`}
        style={{ background: `linear-gradient(160deg, ${rarity.color} 0%, #101521 78%)`, boxShadow: `0 6px 18px ${rarity.glow}` }}
      >
        <div className={`mx-auto ${big ? "h-32 w-24" : "h-20 w-16"} p-1.5`}>
          {kind === "skin" ? <SkinIcon id={id as SkinId} /> : <CamoSwatch id={id as CamoId} />}
        </div>
        <div className="bg-black/55 px-2 py-1.5">
          <p className={`truncate font-black uppercase italic leading-tight ${big ? "text-base" : "text-xs"}`}>{item.name}</p>
          <p className="text-[10px] font-bold uppercase" style={{ color: rarity.color }}>
            {rarity.label} · {kind === "skin" ? "Tenue" : "Camouflage"}
          </p>
          <p className="mt-0.5 text-[11px] font-black">
            {equipped ? (
              <span className="text-yellow-300">✓ Équipé</span>
            ) : isOwned ? (
              <span className="text-emerald-300">Équiper</span>
            ) : (
              <span className={profile.coins >= item.price ? "text-yellow-200" : "text-zinc-400"}>🪙 {item.price}</span>
            )}
          </p>
        </div>
      </button>
    );
  }

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-sky-500 text-white">
      <DuelLobbyStage skin={profile.skin} camo={profile.camo} weapon={previewWeapon} />
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
                onClick={() => setTab(active ? null : t.id)}
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
              </button>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 rounded-md bg-black/45 px-2.5 py-1.5 ring-1 ring-yellow-300/40">
          <span>🪙</span>
          <span className="font-mono text-sm font-black text-yellow-200">{profile.coins.toLocaleString("fr-FR")}</span>
        </div>
      </header>

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

                {selected.arena !== "zone" && (
                  <div className="rounded-lg bg-black/45 p-3 ring-1 ring-white/10">
                    <p className="mb-2 text-xs font-black uppercase tracking-wider text-zinc-300">Carte</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-wider text-zinc-200">Tenues</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-7">
                    {SKIN_ORDER.map((id) => itemCard(`skin:${id}`))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-wider text-zinc-200">
                    Camouflages d&apos;arme <span className="normal-case tracking-normal text-zinc-400">· visibles sur ton arme en jeu</span>
                  </p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-7">
                    {CAMO_ORDER.map((id) => itemCard(`camo:${id}`))}
                  </div>
                </div>
                <p className="text-xs text-white/75">
                  Les pièces se gagnent en jouant : éliminations et victoires. Rien ne s&apos;achète avec de l&apos;argent réel.
                </p>
              </div>
            )}

            {tab === "boutique" && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-2xl font-black uppercase italic drop-shadow">Boutique du jour</h2>
                  <span className="rounded bg-black/50 px-2 py-1 text-xs font-bold text-zinc-200">
                    Nouveaux objets dans {hoursLeft} h {String(minutesLeft).padStart(2, "0")}
                  </span>
                </div>
                {shopNote && <p className="rounded-md bg-black/55 px-3 py-2 text-sm font-semibold text-yellow-100">{shopNote}</p>}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {shopToday.map((key) => itemCard(key, true))}
                </div>
              </div>
            )}

            {tab === "arsenal" && (
              <div className="space-y-3">
                <h2 className="text-2xl font-black uppercase italic drop-shadow">Arsenal · 9 armes</h2>
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
                  <p><b className="text-white">Économie</b> — 1 à 9 pour acheter, B boutique</p>
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
            {selected.arena === "zone" ? "Grande île" : DUEL_MAP_INFO[mapId].name} · Bots {BOT_LEVELS[options.bots].label}
          </p>
          <p className="text-sm font-black uppercase italic">
            {selected.name} <span className="text-yellow-300">· changer</span>
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
