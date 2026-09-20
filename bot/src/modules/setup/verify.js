import { PermissionsBitField } from 'discord.js';
import { CHANNEL_PURPOSES } from '../../core/guildConfig.js';
import { successEmbed, errorEmbed } from '../../core/embeds.js';

const REQUIRED_PERMS = ['ViewChannel', 'SendMessages', 'EmbedLinks'];

async function checkOne(guild, channelId) {
  if (!channelId) return { status: 'unset' };

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel) return { status: 'missing' };

  const me = guild.members.me;
  const missing = REQUIRED_PERMS.filter((perm) => !me.permissionsIn(channel).has(PermissionsBitField.Flags[perm]));

  return { status: missing.length === 0 ? 'ok' : 'broken', channel, missing };
}

/** Runs the /setup check verification across all four configured channels. */
export async function verifyGuildChannels(guild, guildConfig) {
  const results = {};
  for (const [purpose, meta] of Object.entries(CHANNEL_PURPOSES)) {
    results[purpose] = { ...(await checkOne(guild, guildConfig?.[meta.field])), meta };
  }
  return results;
}

export function buildVerifyEmbed(results) {
  const lines = Object.values(results).map(({ status, channel, missing, meta }) => {
    if (status === 'unset') return `⚪ ${meta.emoji} **${meta.label}** — not configured yet`;
    if (status === 'missing') return `❌ ${meta.emoji} **${meta.label}** — channel no longer exists. Fix it with \`/setup\`.`;
    if (status === 'broken') {
      const link = `https://discord.com/channels/${channel.guild.id}/${channel.id}`;
      return `❌ ${meta.emoji} **${meta.label}** — <#${channel.id}>, missing **${missing.join(', ')}**. Fix it here → ${link}`;
    }
    return `✅ ${meta.emoji} **${meta.label}** — <#${channel.id}>`;
  });

  const allOk = Object.values(results).every((r) => r.status === 'ok');
  const build = allOk ? successEmbed : errorEmbed;
  return build({ title: '🐀 Setup Check', description: lines.join('\n') });
}
