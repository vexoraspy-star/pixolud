import { BLOCKS, WORLD_HEIGHT, decodeEdits, type SavedWorld } from "./voxel";

export const CUBES_SAVE_KEY = "pixolud-cubes-v1";
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function parseWorldSave(raw: string): SavedWorld {
  if (raw.length > 5000000) throw new Error("Sauvegarde trop volumineuse (5 Mo maximum).");
  const data = JSON.parse(raw) as SavedWorld;
  if (!data || data.version !== 1 || !Number.isSafeInteger(data.seed) || !["creatif", "survie"].includes(data.mode)
    || !data.player || !Object.values(data.player).every(finite)
    || ![data.player.x, data.player.y, data.player.z, data.player.yaw, data.player.pitch].every(finite)
    || Math.abs(data.player.x) > 1e6 || Math.abs(data.player.z) > 1e6 || data.player.y < 0 || data.player.y > WORLD_HEIGHT + 10
    || !Array.isArray(data.hotbar) || data.hotbar.length !== 9 || !data.hotbar.every(id => Number.isInteger(id) && id > 0 && id < BLOCKS.length)
    || !data.stock || typeof data.stock !== "object" || Array.isArray(data.stock) || !Object.entries(data.stock).every(([id, count]) => /^[1-9]\d*$/.test(id) && Number(id) < BLOCKS.length && Number.isInteger(count) && count >= 0 && count <= 1e6)
    || !Number.isSafeInteger(data.savedAt) || data.savedAt < 0
    || !Array.isArray(data.edits) || data.edits.length % 4 !== 0 || data.edits.length > 400000) throw new Error("Sauvegarde incompatible ou endommagée.");
  for (let i = 0; i < data.edits.length; i += 4) {
    const [x, y, z, id] = data.edits.slice(i, i + 4);
    if (![x, y, z, id].every(Number.isSafeInteger) || Math.abs(x) > 1e6 || Math.abs(z) > 1e6 || y <= 0 || y >= WORLD_HEIGHT || id < 0 || id >= BLOCKS.length) throw new Error("Blocs de sauvegarde invalides.");
  }
  // Validation du format partage avec le moteur.
  decodeEdits(data.edits);
  return data;
}
