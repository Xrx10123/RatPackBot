import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { peachesState, peachesWardrobe } from '../../db/schema.js';
import { ensureState } from './state.js';
import { SLOTS, getShopItem } from './shop.js';

/** Cosmetic keys in this server's wardrobe → { boughtBy, boughtAt }. */
export function getWardrobe(guildId) {
  const rows = db.select().from(peachesWardrobe).where(eq(peachesWardrobe.guildId, guildId)).all();
  return new Map(rows.map((r) => [r.itemKey, r]));
}

/** Adds a cosmetic to the wardrobe. Returns false if the server already owned it (the PK makes this race-safe). */
export function addToWardrobe(guildId, itemKey, boughtBy) {
  const result = db.insert(peachesWardrobe).values({ guildId, itemKey, boughtBy, boughtAt: Date.now() }).onConflictDoNothing().run();
  return result.changes > 0;
}

export function getOutfit(guildId) {
  const state = ensureState(guildId);
  return { hat: getShopItem(state.outfitHat), accessory: getShopItem(state.outfitAccessory) };
}

/** Puts an owned cosmetic on her (or clears the slot with null). Returns false if not allowed. */
export function setOutfit(guildId, slot, itemKey) {
  const meta = SLOTS[slot];
  if (!meta) return false;
  if (itemKey) {
    const item = getShopItem(itemKey);
    if (!item || item.slot !== slot || !getWardrobe(guildId).has(itemKey)) return false;
  }
  ensureState(guildId);
  db.update(peachesState).set({ [meta.column]: itemKey ?? null }).where(eq(peachesState.guildId, guildId)).run();
  return true;
}

/** "👗 Wearing her 🎩 Top Hat and 🎀 Bow Tie" — or null when she's in her natural fur. */
export function outfitLine(guildId) {
  const worn = Object.values(getOutfit(guildId)).filter(Boolean);
  if (worn.length === 0) return null;
  return `👗 Wearing her ${worn.map((i) => `${i.emoji} ${i.name}`).join(' and ')}`;
}

/** Emojis for her title, e.g. "🎩🎀". */
export function outfitEmojis(guildId) {
  return Object.values(getOutfit(guildId))
    .filter(Boolean)
    .map((i) => i.emoji)
    .join('');
}
