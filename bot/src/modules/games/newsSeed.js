import { logger } from '../../core/logger.js';
import * as steam from './providers/steam.js';
import { getSubscriptionByAppId, addSubscription } from './newsSubscriptions.js';

// Per the build plan's default-followed list. Fortnite and Valorant aren't
// on Steam at all (Epic/Riot don't distribute either there), so they have
// no Steam AppID and are silently skipped — the Steam-based news system
// simply can't cover them, regardless of how they're searched for.
const DEFAULT_GAMES = ['Dead by Daylight', 'Overwatch 2', 'Project Zomboid', 'PEAK'];

export async function seedDefaultNewsSubscriptions(guildId) {
  if (!steam.isAppListConfigured()) {
    logger.info({ guildId }, 'Skipping default news subscriptions — STEAM_API_KEY is not configured');
    return;
  }

  for (const name of DEFAULT_GAMES) {
    try {
      const [best] = await steam.searchApps(name, 1);
      if (!best) continue;
      if (getSubscriptionByAppId(guildId, best.appid)) continue;
      addSubscription({ guildId, gameName: best.name, steamAppid: best.appid });
    } catch (err) {
      logger.warn({ err, game: name, guildId }, 'Could not seed default news subscription');
    }
  }
}
