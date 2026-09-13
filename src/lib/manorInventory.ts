import type { KeyId, PickupKind } from "./manor";

// Inventaire du Manoir Maudit.
//
// Cinq emplacements pour les objets qu'on UTILISE (pieces, piles, sel, boite
// a musique). Les cles et les notes ne prennent pas de place : on ne jette
// pas une cle, on ne choisit pas entre une page de journal et une pile.

export type UsableItem = "coin" | "battery" | "salt" | "musicbox";

export interface ItemDef {
  id: UsableItem;
  name: string;
  emoji: string;
  description: string;
  /** Combien on peut en porter dans un seul emplacement. */
  stack: number;
  /** Ce que dit le bouton d'action quand l'objet est selectionne. */
  verb: string;
}

export const ITEM_DEFS: Record<UsableItem, ItemDef> = {
  coin: {
    id: "coin",
    name: "Pièce de monnaie",
    emoji: "🪙",
    description: "Lance-la loin : elle ira voir d'où vient le bruit.",
    stack: 10,
    verb: "Lancer",
  },
  battery: {
    id: "battery",
    name: "Pile",
    emoji: "🔋",
    description: "Recharge la lampe de 45 %.",
    stack: 5,
    verb: "Recharger",
  },
  salt: {
    id: "salt",
    name: "Poignée de sel",
    emoji: "🧂",
    description: "Jetée sur elle quand elle est tout près, elle recule quelques secondes.",
    stack: 3,
    verb: "Jeter",
  },
  musicbox: {
    id: "musicbox",
    name: "Boîte à musique",
    emoji: "🎶",
    description: "Posée au sol, elle joue douze secondes. Elle ne résiste jamais à la mélodie.",
    stack: 2,
    verb: "Poser",
  },
};

export const KEY_NAMES: Record<KeyId, { name: string; emoji: string }> = {
  "cle-condamnee": { name: "Clé de la chambre condamnée", emoji: "🗝️" },
  "cle-laboratoire": { name: "Clé du laboratoire", emoji: "🔑" },
  "cle-docteur": { name: "Clé du bureau du docteur", emoji: "🗝️" },
};

export const SLOT_COUNT = 5;

export interface Slot {
  item: UsableItem;
  count: number;
}

export interface Inventory {
  slots: (Slot | null)[];
  selected: number;
  keys: KeyId[];
  /** Identifiants des notes lues, dans l'ordre ou on les a trouvees. */
  notes: string[];
}

export function emptyInventory(): Inventory {
  return { slots: Array.from({ length: SLOT_COUNT }, () => null), selected: 0, keys: [], notes: [] };
}

export function isUsable(kind: PickupKind): kind is UsableItem {
  return kind === "coin" || kind === "battery" || kind === "salt" || kind === "musicbox";
}

/**
 * Ajoute un objet. Remplit d'abord une pile existante, puis un emplacement
 * vide. Renvoie un NOUVEL inventaire, ou null si tout est plein : l'objet
 * reste alors au sol, on ne le perd pas.
 */
export function addItem(inv: Inventory, item: UsableItem, count = 1): Inventory | null {
  const max = ITEM_DEFS[item].stack;
  const slots = inv.slots.map((s) => (s ? { ...s } : null));
  let left = count;
  for (const s of slots) {
    if (left <= 0) break;
    if (s && s.item === item && s.count < max) {
      const put = Math.min(max - s.count, left);
      s.count += put;
      left -= put;
    }
  }
  for (let i = 0; i < slots.length && left > 0; i++) {
    if (slots[i] === null) {
      const put = Math.min(max, left);
      slots[i] = { item, count: put };
      left -= put;
    }
  }
  if (left === count) return null;
  return { ...inv, slots };
}

/** Consomme un exemplaire de l'objet selectionne. */
export function consumeSelected(inv: Inventory): { inv: Inventory; used: UsableItem | null } {
  const slot = inv.slots[inv.selected];
  if (!slot) return { inv, used: null };
  const slots = inv.slots.map((s) => (s ? { ...s } : null));
  const s = slots[inv.selected]!;
  s.count -= 1;
  if (s.count <= 0) slots[inv.selected] = null;
  return { inv: { ...inv, slots }, used: slot.item };
}

export function selectSlot(inv: Inventory, index: number): Inventory {
  const n = inv.slots.length;
  return { ...inv, selected: ((index % n) + n) % n };
}

export function addKey(inv: Inventory, key: KeyId): Inventory {
  return inv.keys.includes(key) ? inv : { ...inv, keys: [...inv.keys, key] };
}

export function addNote(inv: Inventory, noteId: string): Inventory {
  return inv.notes.includes(noteId) ? inv : { ...inv, notes: [...inv.notes, noteId] };
}

export function countOf(inv: Inventory, item: UsableItem): number {
  return inv.slots.reduce((acc, s) => acc + (s && s.item === item ? s.count : 0), 0);
}
