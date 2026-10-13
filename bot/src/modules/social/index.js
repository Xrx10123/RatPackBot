import { birthday, birthdayButtons } from './commands/birthday.js';
import { remind } from './commands/remind.js';
import { birthdayTick, deliverDueReminders } from './delivery.js';
import { logger } from '../../core/logger.js';

const REMINDER_POLL_MS = 15_000;

export default {
  name: 'social',
  commands: [birthday, remind],
  buttons: { ...birthdayButtons },
  selects: {},
  modals: {},
  events: [],
  cron: [{ schedule: '3 * * * *', name: 'memberBirthdays', task: (client) => birthdayTick(client) }],
  // Reminders need better than cron's one-minute (+ jitter) precision, and
  // anything that came due while the bot was down goes out right away.
  init: async (client) => {
    const poll = () => deliverDueReminders(client).catch((err) => logger.warn({ err }, 'Reminder delivery failed'));
    await poll();
    setInterval(poll, REMINDER_POLL_MS).unref?.();
    await birthdayTick(client);
  },
};
