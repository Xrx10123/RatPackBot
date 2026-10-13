import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { peachesCollectibles } from '../../db/schema.js';

/**
 * Things Peaches drags out of the walls and hands to people. `season` items
 * can only be found while that season (or event) is active, which is what
 * makes them worth showing off in /pet album later.
 */
export const RARITY = {
  common: { label: 'Common', emoji: '⚪', weight: 60 },
  uncommon: { label: 'Uncommon', emoji: '🟢', weight: 28 },
  rare: { label: 'Rare', emoji: '🔵', weight: 10 },
  legendary: { label: 'Legendary', emoji: '🟣', weight: 2 },
};

export const ITEMS = [
  { key: 'bottle_cap', name: 'Bottle Cap', emoji: '🧢', rarity: 'common', blurb: 'Shiny. Hers now. Well — yours now.' },
  { key: 'button', name: 'Lost Button', emoji: '🔘', rarity: 'common', blurb: 'From someone\'s coat. Nobody will miss it.' },
  { key: 'paperclip', name: 'Bent Paperclip', emoji: '📎', rarity: 'common', blurb: 'Structurally compromised. Emotionally priceless.' },
  { key: 'cheese_rind', name: 'Cheese Rind', emoji: '🧀', rarity: 'common', blurb: 'She ate the good part.' },
  { key: 'sock', name: 'Single Sock', emoji: '🧦', rarity: 'common', blurb: 'This is where they go.' },
  { key: 'crumb', name: 'Artisanal Crumb', emoji: '🍞', rarity: 'common', blurb: 'Hand-selected.' },
  { key: 'marble', name: 'Cat\'s-Eye Marble', emoji: '🔮', rarity: 'uncommon', blurb: 'She rolled it here herself. It took an hour.' },
  { key: 'guitar_pick', name: 'Guitar Pick', emoji: '🎸', rarity: 'uncommon', blurb: 'From the Rat Nest. She has opinions about your playlist.' },
  { key: 'lego', name: 'Single LEGO Brick', emoji: '🧱', rarity: 'uncommon', blurb: 'Placed exactly where you\'ll step on it.' },
  { key: 'feather', name: 'Pigeon Feather', emoji: '🪶', rarity: 'uncommon', blurb: 'She won that fight. Allegedly.' },
  { key: 'arcade_token', name: 'Arcade Token', emoji: '🪙', rarity: 'uncommon', blurb: 'Good for one (1) game of nothing.' },
  { key: 'tiny_crown', name: 'Tiny Crown', emoji: '👑', rarity: 'rare', blurb: 'Queen Peaches\' spare.' },
  { key: 'ring', name: 'Mystery Ring', emoji: '💍', rarity: 'rare', blurb: 'Don\'t ask where it came from.' },
  { key: 'map', name: 'Sewer Map', emoji: '🗺️', rarity: 'rare', blurb: 'X marks the cheese.' },
  { key: 'golden_cheese', name: 'Golden Cheese', emoji: '🏆', rarity: 'legendary', blurb: 'The stuff of rat legend. She is visibly upset to part with it.' },
  { key: 'peach', name: 'A Perfect Peach', emoji: '🍑', rarity: 'legendary', blurb: 'Her namesake. A sign of true trust.' },

  { key: 'candy_corn', name: 'Candy Corn', emoji: '🍬', rarity: 'common', season: 'halloween', blurb: 'Divisive. She loves it.' },
  { key: 'mini_pumpkin', name: 'Mini Pumpkin', emoji: '🎃', rarity: 'common', season: 'halloween', blurb: 'Rat-sized. Already slightly nibbled.' },
  { key: 'spider_ring', name: 'Plastic Spider Ring', emoji: '🕷️', rarity: 'uncommon', season: 'halloween', blurb: 'She wore it first.' },
  { key: 'bat_wing', name: 'Paper Bat Wing', emoji: '🦇', rarity: 'uncommon', season: 'halloween', blurb: 'From a decoration that is now missing a wing.' },
  { key: 'witch_hat', name: 'Spare Witch Hat', emoji: '🧙', rarity: 'rare', season: 'halloween', blurb: 'Her backup costume. An honour.' },
  { key: 'ghost_sheet', name: 'Ghost Peaches\' Sheet', emoji: '👻', rarity: 'legendary', season: 'halloween', blurb: 'Still has eye holes. Still warm.' },

  { key: 'snowflake', name: 'Perfect Snowflake', emoji: '❄️', rarity: 'common', season: 'winter', blurb: 'Somehow not melting. Do not question it.' },
  { key: 'candy_cane', name: 'Candy Cane', emoji: '🍭', rarity: 'common', season: 'winter', blurb: 'Pre-licked. Lovingly.' },
  { key: 'gingerbread_rat', name: 'Gingerbread Rat', emoji: '🍪', rarity: 'uncommon', season: 'winter', blurb: 'A self-portrait. She ate the tail.' },
  { key: 'tiny_stocking', name: 'Tiny Stocking', emoji: '🧦', rarity: 'uncommon', season: 'winter', blurb: 'Big enough for exactly one cheese cube.' },
  { key: 'snow_globe', name: 'Snow Globe', emoji: '🔮', rarity: 'rare', season: 'winter', blurb: 'There\'s a tiny rat inside. Shake it gently.' },
  { key: 'golden_bell', name: 'Golden Sleigh Bell', emoji: '🔔', rarity: 'legendary', season: 'winter', blurb: 'Jingles once a year, on its own, at midnight.' },

  { key: 'love_letter', name: 'Love Letter', emoji: '💌', rarity: 'common', season: 'valentines', blurb: 'Sealed with a tiny paw print.' },
  { key: 'candy_heart', name: 'Candy Heart', emoji: '💗', rarity: 'common', season: 'valentines', blurb: 'It says "SQUEAK ME". Romantic.' },
  { key: 'single_rose', name: 'Single Rose', emoji: '🌹', rarity: 'uncommon', season: 'valentines', blurb: 'Thorns lovingly nibbled off.' },
  { key: 'cupid_arrow', name: "Cupid's Arrow", emoji: '💘', rarity: 'rare', season: 'valentines', blurb: 'Blunt tip. She is a responsible cupid.' },

  { key: 'painted_egg', name: 'Painted Egg', emoji: '🥚', rarity: 'common', season: 'spring', blurb: 'Pastel, with paw prints. Lots of paw prints.' },
  { key: 'tulip', name: 'Tulip', emoji: '🌷', rarity: 'common', season: 'spring', blurb: 'From a neighbour\'s garden. Shh.' },
  { key: 'plush_chick', name: 'Plush Chick', emoji: '🐣', rarity: 'uncommon', season: 'spring', blurb: 'She swears she hatched it.' },
  { key: 'golden_egg', name: 'Golden Egg', emoji: '🪺', rarity: 'legendary', season: 'spring', blurb: 'Heavier than it looks. Do not ask what laid it.' },

  { key: 'seashell', name: 'Seashell', emoji: '🐚', rarity: 'common', season: 'summer', blurb: 'Hold it to your ear: faint squeaking.' },
  { key: 'popsicle_stick', name: 'Lucky Popsicle Stick', emoji: '🍡', rarity: 'common', season: 'summer', blurb: 'It says "WINNER" on it. Winner of what is unclear.' },
  { key: 'message_bottle', name: 'Message in a Bottle', emoji: '🍾', rarity: 'rare', season: 'summer', blurb: 'The message is a cheese recipe.' },
  { key: 'doubloon', name: 'Sunken Doubloon', emoji: '🪙', rarity: 'legendary', season: 'summer', blurb: 'Real pirate gold. She dove for it herself.' },

  { key: 'cake_slice', name: 'Birthday Cake Slice', emoji: '🍰', rarity: 'rare', season: 'birthday', blurb: 'A slice of her birthday cake. One per year.' },
];

const BY_KEY = new Map(ITEMS.map((item) => [item.key, item]));

export function getItem(key) {
  return BY_KEY.get(key) ?? null;
}

/** Items findable right now: everything without a season, plus the active season's. */
export function findableItems(season) {
  return ITEMS.filter((item) => !item.season || item.season === season);
}

/**
 * Picks an item by rarity weight. In season, seasonal items get a strong
 * boost (`seasonalBoost`) so the event actually feels like an event; items
 * the finder doesn't own yet count double so albums fill up.
 */
export function rollItem({ season = null, owned = new Set(), seasonalBoost = 4, onlySeasonal = false, random = Math.random } = {}) {
  let pool = findableItems(season).filter((item) => item.season !== 'birthday');
  if (onlySeasonal && season) pool = pool.filter((item) => item.season === season);
  if (pool.length === 0) return null;

  const weighted = pool.map((item) => {
    let weight = RARITY[item.rarity].weight;
    if (item.season && item.season === season) weight *= seasonalBoost;
    if (!owned.has(item.key)) weight *= 2;
    return { item, weight };
  });
  let roll = random() * weighted.reduce((sum, w) => sum + w.weight, 0);
  for (const { item, weight } of weighted) {
    if (roll < weight) return item;
    roll -= weight;
  }
  return weighted.at(-1).item;
}

export function giveItem(guildId, userId, itemKey) {
  db.insert(peachesCollectibles).values({ id: randomUUID(), guildId, userId, itemKey, foundAt: Date.now() }).run();
  return getItem(itemKey);
}

/** Map of itemKey -> count for one member. */
export function getAlbum(guildId, userId) {
  const rows = db
    .select({ itemKey: peachesCollectibles.itemKey, count: sql`COUNT(*)` })
    .from(peachesCollectibles)
    .where(and(eq(peachesCollectibles.guildId, guildId), eq(peachesCollectibles.userId, userId)))
    .groupBy(peachesCollectibles.itemKey)
    .all();
  return new Map(rows.map((r) => [r.itemKey, Number(r.count)]));
}

/** Distinct item keys anyone in the server has found. */
export function getServerFoundKeys(guildId) {
  return new Set(
    db
      .selectDistinct({ itemKey: peachesCollectibles.itemKey })
      .from(peachesCollectibles)
      .where(eq(peachesCollectibles.guildId, guildId))
      .all()
      .map((r) => r.itemKey),
  );
}

/** True if this member already got `itemKey` at or after `sinceMs` (e.g. one cake slice per birthday). */
export function hasItemSince(guildId, userId, itemKey, sinceMs) {
  return Boolean(
    db
      .select({ id: peachesCollectibles.id })
      .from(peachesCollectibles)
      .where(
        and(
          eq(peachesCollectibles.guildId, guildId),
          eq(peachesCollectibles.userId, userId),
          eq(peachesCollectibles.itemKey, itemKey),
          sql`${peachesCollectibles.foundAt} >= ${sinceMs}`,
        ),
      )
      .get(),
  );
}

/**
 * Rolls a chance for Peaches to hand this member something. Returns the
 * item given, or null. Used after care actions and trick-or-treat.
 */
export function maybeFindSomething(guildId, userId, { chance, season = null, onlySeasonal = false, random = Math.random }) {
  if (random() >= chance) return null;
  const owned = new Set(getAlbum(guildId, userId).keys());
  const item = rollItem({ season, owned, onlySeasonal, random });
  return item ? giveItem(guildId, userId, item.key) : null;
}

export function foundLine(peachesName, user, item) {
  const rarity = RARITY[item.rarity];
  return `🔎 ${peachesName} found something… she drops a **${item.emoji} ${item.name}** at ${user}'s feet. *(${rarity.emoji} ${rarity.label})*\n> ${item.blurb}`;
}
