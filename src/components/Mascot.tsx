"use client";

import { useEffect, useRef, useState } from "react";
import PixoAvatar from "./PixoAvatar";
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
  Mélodie: "🎶",
  "Calcul Mental": "🧮",
  "Petit Bac": "📝",
  Devinettes: "🔍",
  Éducation: "🎓",
  Python: "🐍",
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

  return (
    <div data-site-chrome className="pixo-dock">
      {message && !menuOpen && <div className="pixo-message"><span className="pixo-message-label">Pixo</span>{message}</div>}
      {menuOpen && (
        <>
          <button type="button" aria-hidden tabIndex={-1} onClick={() => setMenuOpen(false)} className="fixed inset-0 z-40 cursor-default" />
          <section id="pixo-help" role="dialog" aria-labelledby="pixo-title" className="utility-panel pixo-panel"
            onKeyDown={(e) => { if (e.key === "Escape") setMenuOpen(false); }}>
            <header className="utility-heading">
              <PixoAvatar className="pixo-avatar" />
              <div><p className="utility-kicker">TON GUIDE PIXOLUD</p><h2 id="pixo-title">Un coup de main ?</h2></div>
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="Fermer l’aide de Pixo" className="utility-close">×</button>
            </header>
            <div className="pixo-scroll">
              <div className="pixo-welcome"><span className="pixo-greeting">Salut, moi c’est Pixo !</span><p>Je t’aide à trouver ta prochaine partie et à faire tes premiers pas sur Pixolud.</p></div>
              <section className="pixo-section">
                <h3>À quoi veux-tu jouer ?<span>{CATEGORIES.length} catégories</span></h3>
                <div className="pixo-categories">
                  {CATEGORIES.map(cat => <button key={cat} type="button" onClick={() => goToCategory(cat)}><span aria-hidden="true">{CATEGORY_EMOJI[cat]}</span>{cat}<span className="pixo-category-arrow" aria-hidden="true">↗</span></button>)}
                </div>
              </section>
              <section className="pixo-section">
                <h3>Les réponses rapides</h3>
                <div className="pixo-faq">
                  {FAQ.map(f => <details key={f.question}><summary>{f.question}<span aria-hidden="true">+</span></summary><p>{f.answer}</p></details>)}
                </div>
              </section>
            </div>
            <footer className="pixo-footer"><span className="pixo-status-dot" />Toujours partant pour t’aider.</footer>
          </section>
        </>
      )}
      <button type="button" onClick={() => setMenuOpen(o => !o)} onDoubleClick={() => setVisible(false)}
        aria-expanded={menuOpen} aria-controls="pixo-help" aria-label="Pixo, aide rapide"
        title="Pixo, la mascotte du site (double-clic pour la faire partir)" className="utility-launcher pixo-launcher">
        <PixoAvatar className="pixo-avatar" /><span>Pixo</span>
      </button>
    </div>
  );
}
