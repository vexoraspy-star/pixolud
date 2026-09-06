"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyMove,
  getGameStatus,
  initialState,
  legalMovesFrom,
  PIECE_SYMBOLS,
  type ChessMove,
  type ChessState,
  type Color,
  type Square,
} from "@/lib/chess";
import { createClient } from "@/lib/supabase/client";
import { hasGoldenName, type ArenaIdentity } from "@/lib/arena";

type Phase = "menu" | "waiting" | "playing" | "ended";

function generateCode(): string {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

function sameSquare(a: Square, b: Square): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

export default function ChessGame({
  identity,
  onQuit,
}: {
  identity: ArenaIdentity;
  onQuit: () => void;
}) {
  const { pseudo, tier } = identity;
  const golden = hasGoldenName(tier);

  const [phase, setPhase] = useState<Phase>("menu");
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [myColor, setMyColor] = useState<Color>("w");
  const [opponentPseudo, setOpponentPseudo] = useState<string | null>(null);
  const [chessState, setChessState] = useState<ChessState>(() => initialState());
  const [selected, setSelected] = useState<Square | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null);

  const cleanupChannel = useCallback(() => {
    if (channelRef.current) {
      const supabase = createClient();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  const sendBroadcast = useCallback((event: string, payload: unknown) => {
    channelRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  const connect = useCallback((code: string, color: Color) => {
    cleanupChannel();
    const supabase = createClient();
    const channel = supabase.channel(`chess-${code}`, { config: { broadcast: { self: false } } });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "move" }, ({ payload }: { payload: { move: ChessMove } }) => {
        setChessState((prev) => applyMove(prev, payload.move));
      })
      .on("broadcast", { event: "resign" }, ({ payload }: { payload: { pseudo: string } }) => {
        setResultMessage(`🏳️ ${payload.pseudo} a abandonné. Tu gagnes !`);
        setPhase("ended");
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ pseudo: string; color: Color }>();
        const entries = Object.values(state).flatMap((e) => e);
        const opponent = entries.find((e) => e.color !== color);
        setOpponentPseudo(opponent?.pseudo ?? null);
        setPhase((p) => (opponent && p === "waiting" ? "playing" : p));
      })
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          channel.track({ pseudo, color });
        }
      });
  }, [pseudo, cleanupChannel]);

  useEffect(() => cleanupChannel, [cleanupChannel]);

  function createRoom() {
    const code = generateCode();
    setRoomCode(code);
    setMyColor("w");
    setChessState(initialState());
    setSelected(null);
    setResultMessage(null);
    setPhase("waiting");
    connect(code, "w");
  }

  function joinRoom() {
    const code = joinCodeInput.trim().toUpperCase();
    if (!code) return;
    setRoomCode(code);
    setMyColor("b");
    setChessState(initialState());
    setSelected(null);
    setResultMessage(null);
    setPhase("waiting");
    connect(code, "b");
  }

  function copyInviteLink() {
    const url = `${window.location.origin}/multijoueur?chess=${roomCode}`;
    navigator.clipboard
      ?.writeText(url)
      .then(() => setCopied(true))
      .catch(() => {});
  }

  function resign() {
    sendBroadcast("resign", { pseudo });
    setResultMessage("🏳️ Tu as abandonné la partie.");
    setPhase("ended");
  }

  function backToMenu() {
    cleanupChannel();
    setPhase("menu");
    setRoomCode("");
    setOpponentPseudo(null);
    setSelected(null);
    setResultMessage(null);
    setChessState(initialState());
  }

  const handleSquareClick = useCallback((x: number, y: number) => {
    if (phase !== "playing" || chessState.turn !== myColor) return;
    const piece = chessState.board[y][x];

    if (selected) {
      if (sameSquare(selected, [x, y])) {
        setSelected(null);
        return;
      }
      const legal = legalMovesFrom(chessState, selected[0], selected[1]);
      const isLegal = legal.some((sq) => sameSquare(sq, [x, y]));
      if (isLegal) {
        const move: ChessMove = { from: selected, to: [x, y] };
        const next = applyMove(chessState, move);
        setChessState(next);
        setSelected(null);
        sendBroadcast("move", { move });

        const status = getGameStatus(next);
        if (status === "checkmate") {
          setResultMessage(
            `♟️ Échec et mat ! Les ${next.turn === "w" ? "Noirs" : "Blancs"} gagnent.`,
          );
          setPhase("ended");
        } else if (status === "stalemate") {
          setResultMessage("🤝 Pat — match nul.");
          setPhase("ended");
        }
        return;
      }
      if (piece && piece.color === myColor) {
        setSelected([x, y]);
        return;
      }
      setSelected(null);
      return;
    }

    if (piece && piece.color === myColor) setSelected([x, y]);
  }, [phase, chessState, myColor, selected, sendBroadcast]);

  if (phase === "menu") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">♟️ Échecs</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Une partie à deux, en temps réel. Crée une partie et envoie le code à
          un ami, ou rejoins avec un code reçu.
        </p>

        <button
          type="button"
          onClick={createRoom}
          className="w-full rounded-full bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
        >
          Créer une partie (tu joues les Blancs)
        </button>

        <div className="flex w-full items-center gap-2">
          <input
            value={joinCodeInput}
            onChange={(e) => setJoinCodeInput(e.target.value)}
            placeholder="Code de la partie"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm uppercase text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
          />
          <button
            type="button"
            disabled={!joinCodeInput.trim()}
            onClick={joinRoom}
            className="shrink-0 rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Rejoindre (Noirs)
          </button>
        </div>

        <button type="button" onClick={onQuit} className="text-sm font-medium text-zinc-400 hover:text-violet-600">
          ← Retour au hub
        </button>
      </div>
    );
  }

  const files = myColor === "w" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const ranks = myColor === "w" ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const legalTargets = selected ? legalMovesFrom(chessState, selected[0], selected[1]) : [];
  const inCheck = phase === "playing" && getGameStatus(chessState) === "check";

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4">
      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          ♟️ Toi : <span className={golden ? "font-semibold text-amber-500" : "font-medium"}>{pseudo}</span>{" "}
          ({myColor === "w" ? "Blancs" : "Noirs"}) · Code :{" "}
          <span className="font-mono font-semibold">{roomCode}</span>
        </p>
        <button type="button" onClick={backToMenu} className="text-sm font-medium text-zinc-400 hover:text-violet-600">
          Quitter
        </button>
      </div>

      {phase === "waiting" && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            En attente d&apos;un adversaire... Partage ce code :
          </p>
          <p className="text-3xl font-bold tracking-widest text-violet-600">{roomCode}</p>
          <button
            type="button"
            onClick={copyInviteLink}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {copied ? "🔗 Lien copié !" : "Copier le lien d'invitation"}
          </button>
        </div>
      )}

      {(phase === "playing" || phase === "ended") && (
        <>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Adversaire : {opponentPseudo ?? "..."} ·{" "}
            {phase === "ended"
              ? resultMessage
              : chessState.turn === myColor
                ? inCheck
                  ? "Échec ! À toi de jouer."
                  : "À toi de jouer"
                : "Au tour de l'adversaire..."}
          </p>

          <div className="grid grid-cols-8 overflow-hidden rounded-2xl border border-zinc-300 shadow-lg dark:border-zinc-700">
            {/* eslint-disable-next-line react-hooks/refs -- onClick only invokes handleSquareClick on user interaction, never during render */}
            {ranks.map((y) =>
              files.map((x) => {
                const piece = chessState.board[y][x];
                const isDark = (x + y) % 2 === 0;
                const isSelected = selected && sameSquare(selected, [x, y]);
                const isTarget = legalTargets.some((sq) => sameSquare(sq, [x, y]));
                return (
                  <button
                    key={`${x}-${y}`}
                    type="button"
                    onClick={() => handleSquareClick(x, y)}
                    disabled={phase !== "playing"}
                    className={`relative flex size-11 items-center justify-center text-3xl sm:size-14 sm:text-4xl ${
                      isDark ? "bg-emerald-700" : "bg-emerald-50"
                    } ${isSelected ? "ring-4 ring-inset ring-amber-400" : ""}`}
                  >
                    {piece && (
                      <span className={piece.color === "w" ? "text-white drop-shadow" : "text-zinc-900"}>
                        {PIECE_SYMBOLS[piece.color][piece.type]}
                      </span>
                    )}
                    {isTarget && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="size-3 rounded-full bg-amber-500/80 sm:size-4" />
                      </span>
                    )}
                  </button>
                );
              }),
            )}
          </div>

          {phase === "playing" && (
            <button
              type="button"
              onClick={resign}
              className="text-sm font-medium text-red-500 hover:underline"
            >
              🏳️ Abandonner
            </button>
          )}

          {phase === "ended" && (
            <button
              type="button"
              onClick={backToMenu}
              className="rounded-full bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
            >
              Nouvelle partie
            </button>
          )}
        </>
      )}

      <p className="text-xs text-zinc-400">
        Les pions sont automatiquement promus en Dame. Clique une pièce puis une case en surbrillance pour jouer.
      </p>
    </div>
  );
}
