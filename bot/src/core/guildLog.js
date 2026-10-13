import { getGuildConfig } from './guildConfig.js';
import { infoEmbed, errorEmbed, warnEmbed } from './embeds.js';
import { logger } from './logger.js';

const BUILDERS = { info: infoEmbed, warn: warnEmbed, error: errorEmbed };

/**
 * Posts to the guild's configured Logs channel (set in /setup). A missing
 * channel or missing permissions is silently skipped — logging must never
 * be the reason a real action fails.
 */
export async function logToGuild(client, guildId, { title, description, level = 'info' }) {
  try {
    const channelId = getGuildConfig(guildId)?.logChannelId;
    if (!channelId) return;
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) return;
    const embed = (BUILDERS[level] ?? infoEmbed)({ title, description: description?.slice(0, 4000) });
    embed.setTimestamp();
    // Log lines name people and roles, but should never actually ping them.
    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
  } catch (err) {
    logger.debug({ err, guildId }, 'Could not write to guild log channel');
  }
}

/** "🛠 @user changed X" — for settings changes made through commands or the setup hub. */
export function audit(interaction, description) {
  if (!interaction.guildId) return;
  void logToGuild(interaction.client, interaction.guildId, { description: `🛠 ${interaction.user} ${description}` });
}
