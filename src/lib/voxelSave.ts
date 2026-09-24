import { BLOCKS, WORLD_HEIGHT, decodeEdits, type SavedWorld } from "./voxel";
import { ITEM_BASE, isKnownThing } from "./voxelItems";

export const CUBES_SAVE_KEY = "pixolud-cubes-v1";
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const pourcent = (value: unknown) => finite(value) && value >= 0 && value <= 100;

/**
 * Lit une sauvegarde (locale ou importee) et refuse tout ce qui est suspect.
 * Les mondes de la version 1 (d'avant la fabrication) restent lisibles : les
 * champs ajoutes en version 2 sont tous facultatifs.
 */
export function parseWorldSave(raw: string): SavedWorld {
  if (raw.length > 5000000) throw new Error("Sauvegarde trop volumineuse (5 Mo maximum).");
  const data = JSON.parse(raw) as SavedWorld;
  if (!data || (data.version !== 1 && data.version !== 2) || !Number.isSafeInteger(data.seed) || !["creatif", "survie"].includes(data.mode)
    || !data.player || !Object.values(data.player).every(finite)
    || ![data.player.x, data.player.y, data.player.z, data.player.yaw, data.player.pitch].every(finite)
    || Math.abs(data.player.x) > 1e6 || Math.abs(data.player.z) > 1e6 || data.player.y < 0 || data.player.y > WORLD_HEIGHT + 10
    || !Array.isArray(data.hotbar) || data.hotbar.length !== 9 || !data.hotbar.every(id => id === 0 || isKnownThing(id))
    || !data.stock || typeof data.stock !== "object" || Array.isArray(data.stock) || !Object.entries(data.stock).every(([id, count]) => /^[1-9]\d*$/.test(id) && isKnownThing(Number(id)) && Number.isInteger(count) && count >= 0 && count <= 1e6)
    || !Number.isSafeInteger(data.savedAt) || data.savedAt < 0
    || !Array.isArray(data.edits) || data.edits.length % 4 !== 0 || data.edits.length > 400000) throw new Error("Sauvegarde incompatible ou endommagée.");
  for (let i = 0; i < data.edits.length; i += 4) {
    const [x, y, z, id] = data.edits.slice(i, i + 4);
    if (![x, y, z, id].every(Number.isSafeInteger) || Math.abs(x) > 1e6 || Math.abs(z) > 1e6 || y <= 0 || y >= WORLD_HEIGHT || id < 0 || id >= BLOCKS.length || id >= ITEM_BASE) throw new Error("Blocs de sauvegarde invalides.");
  }
  // Champs de la version 2 : facultatifs, mais valides s'ils sont la.
  if (data.survie !== undefined && !(data.survie && pourcent(data.survie.vie) && pourcent(data.survie.faim) && pourcent(data.survie.soif))) throw new Error("État de survie invalide.");
  if (data.temps !== undefined && !(finite(data.temps) && data.temps >= 0 && data.temps < 1e9)) throw new Error("Heure du monde invalide.");
  if (data.usure !== undefined && !(data.usure && typeof data.usure === "object" && !Array.isArray(data.usure)
    && Object.entries(data.usure).every(([id, n]) => isKnownThing(Number(id)) && Number.isInteger(n) && n >= 0 && n <= 1e6))) throw new Error("Usure des outils invalide.");
  if (data.armure !== undefined && !(Array.isArray(data.armure) && data.armure.length === 4 && data.armure.every(id => id === 0 || isKnownThing(id)))) throw new Error("Armure invalide.");
  if (data.cultures !== undefined && !(Array.isArray(data.cultures) && data.cultures.length % 4 === 0 && data.cultures.length <= 40000
    && data.cultures.every(finite))) throw new Error("Cultures invalides.");
  // Validation du format partage avec le moteur.
  decodeEdits(data.edits);
  return data;
}
