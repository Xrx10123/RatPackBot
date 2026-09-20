import { PermissionsBitField } from 'discord.js';
import { permissionErrorEmbed } from './embeds.js';

const PERMISSION_LABELS = {
  ViewChannel: 'View Channel',
  SendMessages: 'Send Messages',
  EmbedLinks: 'Embed Links',
  AttachFiles: 'Attach Files',
  ReadMessageHistory: 'Read Message History',
  AddReactions: 'Add Reactions',
  UseExternalEmojis: 'Use External Emojis',
  ManageMessages: 'Manage Messages',
  ManageChannels: 'Manage Channels',
  Connect: 'Connect',
  Speak: 'Speak',
  MentionEveryone: 'Mention Everyone',
};

/**
 * Checks that the bot holds every permission in `required` for `channel`.
 * Returns { ok: true } or { ok: false, embed } ready to reply with —
 * matches the "problem, cause, fix" error format from the design doc.
 */
export function checkChannelPermissions(channel, required = []) {
  const me = channel.guild.members.me;
  const missing = required.filter((perm) => !me.permissionsIn(channel).has(PermissionsBitField.Flags[perm]));

  if (missing.length === 0) return { ok: true };

  const label = PERMISSION_LABELS[missing[0]] ?? missing[0];
  return {
    ok: false,
    missing,
    embed: permissionErrorEmbed({
      channel,
      missingPermission: label,
      fixUrl: `https://discord.com/channels/${channel.guild.id}/${channel.id}`,
    }),
  };
}
