import { infoEmbed } from '../../../core/embeds.js';

const STATUS_EMOJI = { up: '🟢', degraded: '🟡', down: '🔴' };

export function buildStatusBoard(monitors) {
  if (monitors.length === 0) {
    return infoEmbed({ title: '🚨 Status Board', description: '🐀 Nothing monitored yet — try `/outage add`.' });
  }

  const lines = monitors.map((m) => `${STATUS_EMOJI[m.lastStatus] ?? '⚪'} **${m.serviceName}**${m.lastStatus ? '' : ' *(checking soon)*'}`);
  return infoEmbed({ title: '🚨 Status Board', description: lines.join('\n') });
}
