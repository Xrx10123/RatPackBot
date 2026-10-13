import { db } from '../../db/index.js';
import { getWallet, spend } from './economy.js';
import { getShopItem, purchaseBlocker } from './shop.js';
import { getWardrobe, addToWardrobe } from './wardrobe.js';
import { nudgeStats } from './state.js';

class PurchaseError extends Error {}

/**
 * Buys a shop item for this member. Spending and receiving happen in one
 * transaction, so a double-click (or two people buying the last cosmetic at
 * the same moment) can't charge twice or charge for nothing.
 *
 * @returns {{ ok: true, item, balance, state? } | { ok: false, error: string }}
 */
export function buyItem(guildId, userId, itemKey, season) {
  const item = getShopItem(itemKey);
  try {
    return db.transaction(() => {
      const blocker = purchaseBlocker(item, { season, owned: new Set(getWardrobe(guildId).keys()), balance: getWallet(guildId, userId).cheese });
      if (blocker) throw new PurchaseError(blocker);
      if (!spend(guildId, userId, item.price)) throw new PurchaseError("You don't have enough cheese for that.");

      let state;
      if (item.type === 'cosmetic') {
        if (!addToWardrobe(guildId, item.key, userId)) throw new PurchaseError('Someone beat you to it — it\'s already in her wardrobe.');
      } else {
        state = nudgeStats(guildId, item.effects ?? {});
      }
      return { ok: true, item, balance: getWallet(guildId, userId).cheese, state };
    });
  } catch (err) {
    if (err instanceof PurchaseError) return { ok: false, error: err.message };
    throw err;
  }
}
