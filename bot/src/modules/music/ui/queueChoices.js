import { getLavalinkManager } from '../../../lavalink/manager.js';
import { fuzzySearch } from '../../../utils/fuzzy.js';
import { componentText } from '../../../utils/text.js';

/** Autocomplete for "pick a queued track": shows "3. Title — Artist", returns the 1-based position. */
export function buildQueuePositionChoices(tracks, typed) {
  const entries = tracks.map((track, i) => ({ position: i + 1, label: `${i + 1}. ${track.info.title || 'Untitled'} — ${track.info.author || 'Unknown'}` }));
  const query = String(typed ?? '').trim();
  const matches = /^\d+$/.test(query)
    ? entries.filter((e) => String(e.position).startsWith(query)).slice(0, 25)
    : fuzzySearch(query, entries, { key: (e) => e.label, limit: 25 });
  return matches.map((e) => ({ name: componentText(e.label), value: e.position }));
}

export async function queuePositionChoices(interaction) {
  const player = getLavalinkManager().getPlayer(interaction.guildId);
  const focused = interaction.options.getFocused(true);
  if (!player || focused.name === 'to') {
    await interaction.respond([]);
    return;
  }
  await interaction.respond(buildQueuePositionChoices(player.queue.tracks, focused.value));
}
