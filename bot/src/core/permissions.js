import { PermissionsBitField } from 'discord.js';
import { permissionErrorEmbed, errorEmbed } from './embeds.js';

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

/**
 * True if the member can manage the server — the bar for changing any
 * guild-wide Ratpack setting. `member.permissions` is a PermissionsBitField
 * for a cached GuildMember, but discord.js falls back to the raw
 * APIInteractionGuildMember (permissions as a bitfield string) when the
 * guild isn't in its cache yet — e.g. right after a restart — so this
 * accepts either shape.
 */
export function isManager(member) {
  const permissions = member?.permissions;
  if (!permissions) return false;
  const bitfield = typeof permissions.has === 'function' ? permissions : new PermissionsBitField(BigInt(permissions));
  return bitfield.has(PermissionsBitField.Flags.ManageGuild);
}

/**
 * Guard for config-changing interactions. Slash commands can be gated with
 * setDefaultMemberPermissions, but buttons/selects/modals (and individual
 * subcommands of an otherwise-public command) can't — so those check here.
 * Replies ephemerally and returns false if the member isn't a manager.
 */
export async function requireManager(interaction) {
  if (isManager(interaction.member)) return true;
  const payload = { embeds: [errorEmbed({ description: '🐀 Only server managers (Manage Server) can change that.' })], ephemeral: true };
  if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
  else await interaction.reply(payload);
  return false;
}
