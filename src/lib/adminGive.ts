/**
 * « Give » admin pour SOI, sur cet appareil : les jeux gardent leur
 * progression dans le navigateur (localStorage). On ecrit la sauvegarde, puis
 * on previent le jeu ouvert par un evenement pour qu'il la relise sans quitter
 * la partie. Les modules des jeux ne sont charges qu'au clic.
 */

export const GIVE_DUEL_EVENT = "pixolud:give-duel";
export const GIVE_CUBES_EVENT = "pixolud:give-cubes";

export interface CubesGive {
  blocks: Record<string, number>;
  /** Mis a vrai par la partie de Cubes en cours si elle a pris le cadeau. */
  handled?: boolean;
}

export async function giveDuel(opts: { coins?: number; xp?: number; all?: boolean }): Promise<string> {
  const { loadProfile, saveProfile, allShopKeys } = await import("./duelProfile");
  const p = loadProfile();
  const owned = opts.all ? Array.from(new Set([...p.owned, ...allShopKeys()])) : p.owned;
  saveProfile({ ...p, coins: p.coins + (opts.coins ?? 0), xp: p.xp + (opts.xp ?? 0), owned });
  window.dispatchEvent(new Event(GIVE_DUEL_EVENT));
  const parts = [
    opts.coins ? `+${opts.coins.toLocaleString("fr-FR")} pièces` : "",
    opts.xp ? `+${opts.xp.toLocaleString("fr-FR")} XP` : "",
    opts.all ? "tout le casier débloqué" : "",
  ].filter(Boolean);
  return `Duel : ${parts.join(", ")}.`;
}

export async function giveCubes(count: number): Promise<string> {
  const [{ PALETTE }, { CUBES_SAVE_KEY }, { allThings }] = await Promise.all([import("./voxel"), import("./voxelSave"), import("./voxelItems")]);
  const blocks: Record<string, number> = {};
  // Tous les blocs ET tous les objets (outils, armures, nourriture...).
  for (const id of allThings(PALETTE)) blocks[String(id)] = count;
  // 1. Une partie de survie est ouverte : elle ajoute les blocs elle-meme.
  const detail: CubesGive = { blocks };
  window.dispatchEvent(new CustomEvent(GIVE_CUBES_EVENT, { detail }));
  if (detail.handled) return `Cubes : +${count} de chaque bloc et objet dans ta partie.`;
  // 2. Sinon, on les range dans la sauvegarde du monde de survie.
  try {
    const raw = localStorage.getItem(CUBES_SAVE_KEY);
    if (!raw) return "Cubes : aucun monde sauvegardé sur cet appareil. Lance une partie de survie d'abord.";
    const save = JSON.parse(raw) as { mode?: string; stock?: Record<string, number> };
    if (save.mode !== "survie") return "Cubes : ton monde est en créatif, les blocs y sont déjà illimités.";
    const stock = { ...(save.stock ?? {}) };
    for (const [id, n] of Object.entries(blocks)) stock[id] = Math.min(1_000_000, (stock[id] ?? 0) + n);
    localStorage.setItem(CUBES_SAVE_KEY, JSON.stringify({ ...save, stock }));
    return `Cubes : +${count} de chaque bloc et objet dans ton monde de survie.`;
  } catch {
    return "Cubes : sauvegarde illisible, rien n'a changé.";
  }
}
