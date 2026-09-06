import { useSyncExternalStore } from "react";

export interface ShameBadge {
  id: string;
  emoji: string;
  label: string;
  description: string;
  statKey: string;
  threshold: number;
}

export const SHAME_BADGES: ShameBadge[] = [
  {
    id: "cascadeur",
    emoji: "💀",
    label: "Le Cascadeur",
    description: "Mourir 10 fois en Territoire.",
    statKey: "territoire-death",
    threshold: 10,
  },
  {
    id: "chute-libre",
    emoji: "🕳️",
    label: "Chute Libre",
    description: "Tomber 20 fois en Plateforme.",
    statKey: "plateforme-fall",
    threshold: 20,
  },
  {
    id: "pas-presse",
    emoji: "🐌",
    label: "Pas Pressé",
    description: "Perdre 15 fois au Runner.",
    statKey: "runner-lost",
    threshold: 15,
  },
  {
    id: "trop-tot",
    emoji: "⏱️",
    label: "Toujours Trop Tôt",
    description: "Démarrer 10 fois avant le signal en Course.",
    statKey: "course-too-soon",
    threshold: 10,
  },
];

export const SECRET_CHARACTER = "🥷";

const FUN_EVENT_NAME = "pixolud:fun-event";
const STORE_CHANGED_EVENT = "pixolud:fun-store-changed";
const STAT_PREFIX = "pixolud_stat_";
const BADGE_PREFIX = "pixolud_badge_";
const SECRET_KEY = "pixolud_secret_konami";

function notifyStoreChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(STORE_CHANGED_EVENT));
}

function subscribeToStore(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(STORE_CHANGED_EVENT, callback);
  return () => window.removeEventListener(STORE_CHANGED_EVENT, callback);
}

let badgesSnapshot = new Set<string>();
function refreshBadgesSnapshot() {
  badgesSnapshot = new Set(SHAME_BADGES.filter((b) => isBadgeUnlocked(b.id)).map((b) => b.id));
}
refreshBadgesSnapshot();

export function fireFunEvent(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(FUN_EVENT_NAME, { detail: { message } }));
}

export function onFunEvent(handler: (message: string) => void): () => void {
  if (typeof window === "undefined") return () => {};
  function listener(e: Event) {
    const detail = (e as CustomEvent<{ message: string }>).detail;
    handler(detail.message);
  }
  window.addEventListener(FUN_EVENT_NAME, listener);
  return () => window.removeEventListener(FUN_EVENT_NAME, listener);
}

export function recordEvent(statKey: string) {
  if (typeof window === "undefined") return;
  const key = STAT_PREFIX + statKey;
  const current = Number(localStorage.getItem(key) ?? "0") + 1;
  localStorage.setItem(key, String(current));

  for (const badge of SHAME_BADGES) {
    if (badge.statKey !== statKey || current !== badge.threshold) continue;
    const unlockKey = BADGE_PREFIX + badge.id;
    if (localStorage.getItem(unlockKey)) continue;
    localStorage.setItem(unlockKey, "1");
    refreshBadgesSnapshot();
    notifyStoreChanged();
    fireFunEvent(`🏆 Trophée débloqué : ${badge.emoji} ${badge.label} — ${badge.description}`);
  }
}

export function isBadgeUnlocked(id: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(BADGE_PREFIX + id) === "1";
}

export function isSecretUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SECRET_KEY) === "1";
}

export function unlockSecret() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(SECRET_KEY) === "1") return;
  localStorage.setItem(SECRET_KEY, "1");
  notifyStoreChanged();
  fireFunEvent(`🥷 Code secret activé ! Nouveau personnage débloqué : ${SECRET_CHARACTER}`);
}

export function useSecretUnlocked(): boolean {
  return useSyncExternalStore(subscribeToStore, isSecretUnlocked, () => false);
}

export function useUnlockedBadges(): Set<string> {
  return useSyncExternalStore(subscribeToStore, () => badgesSnapshot, () => badgesSnapshot);
}
