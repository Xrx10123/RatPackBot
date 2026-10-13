import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { peachesState, peachesWallets } from '../../db/schema.js';

/**
 * Peaches is the voice of the whole bot. This module reads/writes her
 * shared tables directly (the same pattern /setup uses) rather than
 * importing the peaches module's internals, so social keeps working even if
 * the peaches folder is ever removed.
 */
export function peachesName(guildId) {
  return db.select({ name: peachesState.name }).from(peachesState).where(eq(peachesState.guildId, guildId)).get()?.name ?? 'Peaches';
}

/** A cheese gift (e.g. on your birthday). Mirrors peaches/economy.js earn(). */
export function giftCheese(guildId, userId, amount) {
  db.insert(peachesWallets)
    .values({ guildId, userId, cheese: amount, lifetime: amount })
    .onConflictDoUpdate({
      target: [peachesWallets.guildId, peachesWallets.userId],
      set: { cheese: sql`${peachesWallets.cheese} + ${amount}`, lifetime: sql`${peachesWallets.lifetime} + ${amount}` },
    })
    .run();
}
