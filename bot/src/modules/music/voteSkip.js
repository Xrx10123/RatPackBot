import { PermissionsBitField } from 'discord.js';

export function isDJ(member, guildConfig) {
  if (member.permissions.has(PermissionsBitField.Flags.ManageGuild)) return true;
  if (guildConfig?.djRoleId && member.roles.cache.has(guildConfig.djRoleId)) return true;
  return false;
}

function eligibleVoterCount(voiceChannel) {
  return voiceChannel.members.filter((m) => !m.user.bot).size;
}

/**
 * Vote state lives on the Player's own generic data store (Player.set/get)
 * so it's naturally guild-scoped and doesn't need a DB table — it's
 * intentionally ephemeral, reset on every new track (see lavalink/events.js).
 *
 * Returns { skip: true, forced } if the track should skip now (DJ/manager
 * force-skip, or the vote threshold was just reached), or
 * { skip: false, votes, needed, total } to report vote progress otherwise.
 */
export function registerSkipVote(player, member, voiceChannel, guildConfig) {
  if (isDJ(member, guildConfig)) return { skip: true, forced: true };

  const votes = player.get('voteSkips') ?? new Set();
  votes.add(member.id);
  player.set('voteSkips', votes);

  const total = eligibleVoterCount(voiceChannel);
  const thresholdPercent = guildConfig?.voteSkipThreshold ?? 50;
  const needed = Math.max(1, Math.ceil((thresholdPercent / 100) * total));

  if (votes.size >= needed) {
    player.set('voteSkips', new Set());
    return { skip: true, forced: false };
  }

  return { skip: false, votes: votes.size, needed, total };
}
