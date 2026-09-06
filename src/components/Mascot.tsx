"use client";

import { useEffect, useRef, useState } from "react";
import { onFunEvent } from "@/lib/fun";

const IDLE_LINES = [
  "Psst... essaie de battre ton record !",
  "Tu savais qu'on peut créer son propre jeu ici ?",
  "J'observe... je juge un peu aussi.",
  "Territoire, Chasse aux objets, Bulles géantes... t'as tout essayé ?",
  "Un conseil : le Labyrinthe est plus dur qu'il en a l'air.",
];

const IDLE_INTERVAL_MS = 45000;
const GREETING_DELAY_MS = 1500;

export default function Mascot() {
  const [message, setMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);
  const messageRef = useRef<string | null>(null);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function say(text: string, duration = 5000) {
    messageRef.current = text;
    setMessage(text);
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    hideTimeout.current = setTimeout(() => {
      messageRef.current = null;
      setMessage(null);
    }, duration);
  }

  useEffect(() => {
    const unsubscribe = onFunEvent((msg) => say(msg, 6000));

    let greetTimeout: ReturnType<typeof setTimeout> | undefined;
    if (!sessionStorage.getItem("pixolud_mascot_greeted")) {
      sessionStorage.setItem("pixolud_mascot_greeted", "1");
      greetTimeout = setTimeout(
        () => say("Salut ! Moi c'est Pixo 🤖, je traîne dans le coin si besoin.", 5000),
        GREETING_DELAY_MS,
      );
    }

    return () => {
      unsubscribe();
      if (greetTimeout) clearTimeout(greetTimeout);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!messageRef.current) {
        say(IDLE_LINES[Math.floor(Math.random() * IDLE_LINES.length)], 4500);
      }
    }, IDLE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 end-4 z-40 flex flex-col items-end gap-2">
      {message && (
        <div className="max-w-[220px] rounded-2xl rounded-br-sm bg-white px-3 py-2 text-xs text-zinc-700 shadow-lg dark:bg-zinc-800 dark:text-zinc-200">
          {message}
        </div>
      )}
      <button
        type="button"
        onClick={() => say(IDLE_LINES[Math.floor(Math.random() * IDLE_LINES.length)])}
        onDoubleClick={() => setVisible(false)}
        title="Pixo, la mascotte du site (double-clic pour la faire partir)"
        className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 text-2xl shadow-lg transition hover:scale-110 active:scale-95"
      >
        🤖
      </button>
    </div>
  );
}
