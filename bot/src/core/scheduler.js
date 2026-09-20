import cron from 'node-cron';
import { logger } from './logger.js';

/**
 * Wraps node-cron with a random startup jitter so polling tasks (news, outages,
 * Peaches spawns) don't all fire at exactly :00 and hammer upstream APIs at once.
 *
 * @param {string} expression - cron expression
 * @param {() => Promise<void>|void} task
 * @param {{ name?: string, maxJitterMs?: number }} [options]
 */
export function scheduleWithJitter(expression, task, options = {}) {
  const { name = 'unnamed-task', maxJitterMs = 30_000 } = options;

  if (!cron.validate(expression)) {
    throw new Error(`Invalid cron expression "${expression}" for task "${name}"`);
  }

  return cron.schedule(expression, () => {
    const jitter = Math.floor(Math.random() * maxJitterMs);
    setTimeout(async () => {
      try {
        await task();
      } catch (err) {
        logger.error({ err, task: name }, 'Scheduled task failed');
      }
    }, jitter);
  });
}
