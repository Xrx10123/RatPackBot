import { logger } from '../../core/logger.js';
import { KNOWN_SERVICES } from './providers/statuspage.js';
import { getMonitorBySlug, addMonitor } from './monitors.js';

// The verified, zero-key-required curated set (see providers/statuspage.js
// for why this replaces the plan's much longer, unverifiable default list).
const DEFAULT_SLUGS = ['discord', 'steam', 'cloudflare', 'epicgames', 'twitch', 'spotify', 'reddit'];

export function seedDefaultMonitors(guildId) {
  for (const slug of DEFAULT_SLUGS) {
    if (getMonitorBySlug(guildId, slug)) continue;
    const name = slug === 'steam' ? 'Steam' : KNOWN_SERVICES[slug]?.name;
    if (!name) continue;
    try {
      addMonitor({ guildId, serviceSlug: slug, serviceName: name });
    } catch (err) {
      logger.warn({ err, slug, guildId }, 'Could not seed default outage monitor');
    }
  }
}
