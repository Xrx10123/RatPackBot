import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { successEmbed, errorEmbed, infoEmbed } from '../../../core/embeds.js';
import * as fortnite from '../providers/fortnite.js';
import * as overwatch from '../providers/overwatch.js';
import * as valorant from '../providers/valorant.js';

function overwatchRankLine(role, data) {
  if (!data) return null;
  return `${role}: **${data.division ?? '?'} ${data.tier ?? ''}**`.trim();
}

function refreshRow(game, username) {
  // username is rejoined from every segment after `game` in the button
  // handler, so a literal ':' in a username (unusual, but not impossible)
  // doesn't get mis-split.
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`games:stats_refresh:${game}:${username}`).setEmoji('🔄').setLabel('Refresh').setStyle(ButtonStyle.Secondary),
  );
}

/** Shared by /stats and its refresh button. Valorant is handled by the caller since it never hits this (static-only, no refreshable data). */
export async function buildStatsPayload(game, username) {
  if (game === 'fortnite') {
    if (!fortnite.isConfigured()) {
      return { embeds: [errorEmbed({ description: '🐀 Fortnite stats need `FORTNITE_API_KEY` set in `.env`.' })] };
    }
    try {
      const data = await fortnite.getPlayerStats(username);
      const overall = data?.stats?.all?.overall;
      if (!overall) {
        return { embeds: [errorEmbed({ description: `🐀 No stats found for **${username}**.` })] };
      }
      const embed = successEmbed({
        title: `${data.account.name} — Fortnite`,
        description: [
          `🏆 Wins: **${overall.wins}** (${overall.winRate}%)`,
          `🎯 Kills: **${overall.kills}** · K/D **${overall.kd}**`,
          `🎮 Matches: **${overall.matches}**`,
        ].join('\n'),
      });
      embed.setTimestamp();
      return { embeds: [embed], components: [refreshRow(game, username)] };
    } catch {
      return { embeds: [errorEmbed({ description: `🐀 Couldn't find **${username}**.` })] };
    }
  }

  // overwatch
  try {
    const p = await overwatch.getPlayerSummary(username);
    if (p.private) {
      return { embeds: [errorEmbed({ description: `🐀 **${username}**'s profile is private.` })] };
    }

    const ranks = [overwatchRankLine('Tank', p.competitive?.tank), overwatchRankLine('Damage', p.competitive?.damage), overwatchRankLine('Support', p.competitive?.support)].filter(Boolean);

    const embed = successEmbed({
      title: `${p.username} — Overwatch 2`,
      description: [p.title, `Level ${p.level ?? '?'} · Endorsement ${p.endorsement_level ?? '?'}`, ranks.length > 0 ? ranks.join(' · ') : 'No competitive rank on record.'].filter(Boolean).join('\n'),
      thumbnail: p.avatar ?? undefined,
    });
    embed.setTimestamp();
    return { embeds: [embed], components: [refreshRow(game, username)] };
  } catch {
    return { embeds: [errorEmbed({ description: `🐀 Couldn't find **${username}** — check the BattleTag (Name#1234).` })] };
  }
}

export const stats = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Look up player stats.')
    .addStringOption((opt) =>
      opt
        .setName('game')
        .setDescription('Game')
        .setRequired(true)
        .addChoices(
          { name: 'Fortnite', value: 'fortnite' },
          { name: 'Overwatch 2', value: 'overwatch' },
          { name: 'Valorant', value: 'valorant' },
        ),
    )
    .addStringOption((opt) => opt.setName('username').setDescription('Player name (BattleTag for Overwatch)').setRequired(true)),

  async execute(interaction) {
    const game = interaction.options.getString('game', true);
    const username = interaction.options.getString('username', true);

    if (game === 'valorant') {
      await interaction.reply({ embeds: [infoEmbed({ description: `🐀 ${valorant.liveStatsUnavailableReason()}` })], ephemeral: true });
      return;
    }

    await interaction.deferReply();
    await interaction.editReply(await buildStatsPayload(game, username));
  },
};
