"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasGoldenName, type ArenaIdentity } from "@/lib/arena";
import { getPyodide, runPython } from "@/lib/pyodide";

type Phase = "menu" | "room";

interface ChatMessage {
  id: string;
  pseudo: string;
  emoji: string;
  output: string;
}

interface Participant {
  pseudo: string;
  emoji: string;
}

function generateCode(): string {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

export default function PythonChatGame({
  identity,
  onQuit,
}: {
  identity: ArenaIdentity;
  onQuit: () => void;
}) {
  const { pseudo, emoji, tier } = identity;
  const golden = hasGoldenName(tier);

  const [phase, setPhase] = useState<Phase>("menu");
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [code, setCode] = useState('print("Salut tout le monde !")');
  const [localError, setLocalError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [pyLoading, setPyLoading] = useState(false);
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

  const connect = useCallback(
    (roomCodeValue: string) => {
      cleanupChannel();
      const supabase = createClient();
      const channel = supabase.channel(`python-chat-${roomCodeValue}`, {
        config: { broadcast: { self: false } },
      });
      channelRef.current = channel;

      channel
        .on("broadcast", { event: "message" }, ({ payload }: { payload: ChatMessage }) => {
          setMessages((prev) => [...prev, payload]);
        })
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState<Participant>();
          setParticipants(Object.values(state).flatMap((e) => e));
        })
        .subscribe((status: string) => {
          if (status === "SUBSCRIBED") channel.track({ pseudo, emoji });
        });
    },
    [pseudo, emoji, cleanupChannel],
  );

  useEffect(() => cleanupChannel, [cleanupChannel]);

  useEffect(() => {
    if (phase !== "room") return;
    const timeout = setTimeout(() => {
      setPyLoading(true);
      getPyodide()
        .catch(() => {})
        .finally(() => setPyLoading(false));
    }, 0);
    return () => clearTimeout(timeout);
  }, [phase]);

  function createRoom() {
    const roomCodeValue = generateCode();
    setRoomCode(roomCodeValue);
    setMessages([]);
    setPhase("room");
    connect(roomCodeValue);
  }

  function joinRoom() {
    const roomCodeValue = joinCodeInput.trim().toUpperCase();
    if (!roomCodeValue) return;
    setRoomCode(roomCodeValue);
    setMessages([]);
    setPhase("room");
    connect(roomCodeValue);
  }

  function copyInviteLink() {
    const url = `${window.location.origin}/multijoueur?python=${roomCode}`;
    navigator.clipboard
      ?.writeText(url)
      .then(() => setCopied(true))
      .catch(() => {});
  }

  function backToMenu() {
    cleanupChannel();
    setPhase("menu");
    setRoomCode("");
    setMessages([]);
    setLocalError(null);
  }

  async function send() {
    if (!code.trim()) return;
    setRunning(true);
    setLocalError(null);
    const result = await runPython(code);
    setRunning(false);

    if (result.error) {
      setLocalError(`Erreur dans ton code : ${result.error}`);
      return;
    }
    if (!result.output.trim()) {
      setLocalError("Ton code n'affiche rien ! Utilise print(...) pour envoyer un message.");
      return;
    }

    const message: ChatMessage = {
      id: crypto.randomUUID(),
      pseudo,
      emoji,
      output: result.output,
    };
    setMessages((prev) => [...prev, message]);
    channelRef.current?.send({ type: "broadcast", event: "message", payload: message });
    setCode("");
  }

  if (phase === "menu") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">🐍 Chat en Python</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Ici, on ne parle qu&apos;en code ! Écris du Python avec{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs dark:bg-zinc-800">
            print(...)
          </code>{" "}
          : ce qui s&apos;affiche devient ton message dans le chat.
        </p>

        <button
          type="button"
          onClick={createRoom}
          className="w-full rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Créer un salon
        </button>

        <div className="flex w-full items-center gap-2">
          <input
            value={joinCodeInput}
            onChange={(e) => setJoinCodeInput(e.target.value)}
            placeholder="Code du salon"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm uppercase text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
          />
          <button
            type="button"
            disabled={!joinCodeInput.trim()}
            onClick={joinRoom}
            className="shrink-0 rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Rejoindre
          </button>
        </div>

        <button type="button" onClick={onQuit} className="text-sm font-medium text-zinc-400 hover:text-violet-600">
          ← Retour au hub
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4">
      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          🐍 Toi : <span className={golden ? "font-semibold text-amber-500" : "font-medium"}>{pseudo}</span> ·
          Code : <span className="font-mono font-semibold">{roomCode}</span> ·{" "}
          {participants.length} en ligne
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={copyInviteLink}
            className="text-xs font-medium text-zinc-400 hover:text-violet-600"
          >
            {copied ? "🔗 Lien copié !" : "Copier le lien d'invitation"}
          </button>
          <button type="button" onClick={backToMenu} className="text-sm font-medium text-zinc-400 hover:text-violet-600">
            Quitter
          </button>
        </div>
      </div>

      <div className="flex h-96 flex-col gap-2 overflow-y-auto rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
        {messages.length === 0 && (
          <p className="m-auto text-center text-sm text-zinc-400">
            Aucun message. Écris du Python avec print(...) ci-dessous pour envoyer le premier !
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex max-w-[80%] flex-col gap-0.5 rounded-2xl px-3 py-2 ${
              m.pseudo === pseudo
                ? "self-end bg-emerald-600 text-white"
                : "self-start bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-white"
            }`}
          >
            <span className="text-[10px] font-semibold opacity-70">
              {m.emoji} {m.pseudo}
            </span>
            <pre className="whitespace-pre-wrap font-mono text-sm">{m.output}</pre>
          </div>
        ))}
      </div>

      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={3}
        spellCheck={false}
        placeholder='print("Salut !")'
        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-emerald-300 outline-none focus:border-emerald-500"
      />
      {localError && <p className="text-xs text-rose-500">{localError}</p>}
      <button
        type="button"
        onClick={send}
        disabled={running || pyLoading || !code.trim()}
        className="self-end rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/30 transition hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pyLoading ? "Chargement de Python..." : running ? "Exécution..." : "▶ Envoyer"}
      </button>
    </div>
  );
}
