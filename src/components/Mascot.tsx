"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onFunEvent } from "@/lib/fun";
import { CATEGORIES } from "@/lib/types";

const IDLE_LINES = [
  "Psst... essaie de battre ton record !",
  "Tu savais qu'on peut créer son propre jeu ici ?",
  "J'observe... je juge un peu aussi.",
  "Territoire, Chasse aux objets, Bulles géantes... t'as tout essayé ?",
  "Un conseil : le Labyrinthe est plus dur qu'il en a l'air.",
];

const CATEGORY_EMOJI: Record<string, string> = {
  Plateforme: "🧱",
  Puzzle: "🧩",
  Arcade: "👾",
  Labyrinthe: "🌀",
  Quiz: "🧠",
  Course: "🏁",
  Runner: "🦔",
  Musique: "🎵",
  "Calcul Mental": "🧮",
};

const FAQ: { question: string; answer: string }[] = [
  {
    question: "Comment créer un jeu ?",
    answer:
      "Clique sur \"Créer un jeu\" en haut, choisis un type, personnalise-le, puis clique sur Publier !",
  },
  {
    question: "Comment jouer à plusieurs ?",
    answer:
      "Va dans \"Multijoueur\" en haut : Territoire, Chasse aux objets, Bulles géantes ou Échecs t'attendent !",
  },
  {
    question: "C'est gratuit ?",
    answer:
      "Oui, créer et publier des jeux est gratuit. Premium débloque plus d'options (jeux illimités, personnalisations exclusives...).",
  },
  {
    question: "C'est quoi le code secret ?",
    answer: "Un Konami Code : ↑ ↑ ↓ ↓ ← → ← → B A sur ton clavier. Ça débloque une surprise 😉",
  },
];

const IDLE_INTERVAL_MS = 45000;
const GREETING_DELAY_MS = 1500;

export default function Mascot() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
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
        () => say("Salut ! Moi c'est Pixo 🤖, clique-moi pour de l'aide rapide.", 5000),
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
      if (!messageRef.current && !menuOpen) {
        say(IDLE_LINES[Math.floor(Math.random() * IDLE_LINES.length)], 4500);
      }
    }, IDLE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [menuOpen]);

  if (!visible) return null;

  function goToCategory(cat: string) {
    setMenuOpen(false);
    router.push(`/catalogue?categorie=${encodeURIComponent(cat)}`);
  }

  function answerFaq(answer: string) {
    setMenuOpen(false);
    say(answer, 7000);
  }

  return (
    <div className="fixed bottom-4 end-4 z-40 flex flex-col items-end gap-2">
      {message && !menuOpen && (
        <div className="max-w-[220px] rounded-2xl rounded-br-sm bg-white px-3 py-2 text-xs text-zinc-700 shadow-lg dark:bg-zinc-800 dark:text-zinc-200">
          {message}
        </div>
      )}

      {menuOpen && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="relative z-50 flex w-72 max-h-[70vh] flex-col gap-3 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-bold text-zinc-900 dark:text-white">
              🤖 Besoin d&apos;aide ? Pixo à ton service
            </p>

            <div>
              <p className="mb-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                🔍 Trouver un jeu vite
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => goToCategory(cat)}
                    className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:bg-violet-100 hover:text-violet-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-violet-900/40 dark:hover:text-violet-300"
                  >
                    {CATEGORY_EMOJI[cat]} {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                💬 Questions fréquentes
              </p>
              <div className="flex flex-col gap-1">
                {FAQ.map((f) => (
                  <button
                    key={f.question}
                    type="button"
                    onClick={() => answerFaq(f.answer)}
                    className="rounded-lg px-2 py-1.5 text-left text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {f.question}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        onDoubleClick={() => setVisible(false)}
        title="Pixo, la mascotte du site (double-clic pour la faire partir)"
        className="relative z-50 flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 text-2xl shadow-lg transition hover:scale-110 active:scale-95"
      >
        🤖
      </button>
    </div>
  );
}
