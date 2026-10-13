import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { peachesWallets } from '../../db/schema.js';

/**
 * Cozy cheese economy: you earn 🧀 by looking after Peaches and the only way
 * to lose it is to spend it. No bets, no theft, no decay.
 */
export const CHEESE_REWARDS = {
  feed: 3,
  water: 3,
  play: 4,
  clean: 4,
  sleep: 1,
  mischief: 5, // cleaning up after her / dealing with a hole, walls, escalation
  fealty: 10,
  thanks: 2, // thanking her for crumbs or a gift
  treat: 2, // trick-or-treat treat
  cake: 10, // birthday cake slice
  hideSeek: 15, // found her (+ hideSeekFirstTry if on your first guess)
  hideSeekFirstTry: 10,
  trivia: 8,
  raceWin: 12, // backed the winning racer
  raceJoin: 2, // showed up
};

export function cheese(amount) {
  return `${amount} 🧀`;
}

export function getWallet(guildId, userId) {
  return (
    db.select().from(peachesWallets).where(and(eq(peachesWallets.guildId, guildId), eq(peachesWallets.userId, userId))).get() ?? {
      guildId,
      userId,
      cheese: 0,
      lifetime: 0,
    }
  );
}

/** Adds cheese (rounded, never negative). Returns the amount actually earned. */
export function earn(guildId, userId, amount) {
  const value = Math.max(0, Math.round(amount));
  if (value === 0) return 0;
  db.insert(peachesWallets)
    .values({ guildId, userId, cheese: value, lifetime: value })
    .onConflictDoUpdate({
      target: [peachesWallets.guildId, peachesWallets.userId],
      set: { cheese: sql`${peachesWallets.cheese} + ${value}`, lifetime: sql`${peachesWallets.lifetime} + ${value}` },
    })
    .run();
  return value;
}

/** Earns a named reward (see CHEESE_REWARDS), optionally scaled by a spawn variant multiplier. */
export function reward(guildId, userId, reason, multiplier = 1) {
  return earn(guildId, userId, (CHEESE_REWARDS[reason] ?? 0) * multiplier);
}

/**
 * Spends cheese if the member has enough. A single conditional UPDATE, so a
 * double-click can't spend the same cheese twice. Returns true on success.
 */
export function spend(guildId, userId, amount) {
  if (amount <= 0) return true;
  const result = db
    .update(peachesWallets)
    .set({ cheese: sql`${peachesWallets.cheese} - ${amount}` })
    .where(and(eq(peachesWallets.guildId, guildId), eq(peachesWallets.userId, userId), gte(peachesWallets.cheese, amount)))
    .run();
  return result.changes > 0;
}

export function getRichest(guildId, limit = 10) {
  return db
    .select()
    .from(peachesWallets)
    .where(and(eq(peachesWallets.guildId, guildId), sql`${peachesWallets.lifetime} > 0`))
    .orderBy(desc(peachesWallets.lifetime))
    .limit(limit)
    .all();
}

/** " (+3 🧀)" suffix for reply text, or '' when nothing was earned. */
export function earnedSuffix(amount) {
  return amount > 0 ? ` *(+${cheese(amount)})*` : '';
}
