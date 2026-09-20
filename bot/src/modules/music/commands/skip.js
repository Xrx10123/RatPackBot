import { SlashCommandBuilder } from 'discord.js';
import { requirePlayerInVoice } from '../guards.js';
import { successEmbed, warnEmbed, infoEmbed } from '../../../core/embeds.js';
import { getGuildConfig } from '../../../core/guildConfig.js';
import { registerSkipVote } from '../voteSkip.js';

export const skip = {
  data: new SlashCommandBuilder().setName('skip').setDescription('Vote to skip the current track (or force-skip with the DJ role).'),

  async execute(interaction) {
    const { ok, player } = await requirePlayerInVoice(interaction);
    if (!ok) return;

    const current = player.queue.current;
    if (!current) {
      await interaction.reply({ embeds: [warnEmbed({ description: "🐀 Nothing's playing." })], ephemeral: true });
      return;
    }

    const guildConfig = getGuildConfig(interaction.guildId);
    const result = registerSkipVote(player, interaction.member, interaction.member.voice.channel, guildConfig);

    if (result.skip) {
      await player.skip();
      await interaction.reply({ embeds: [successEmbed({ description: `⏭ Skipped **${current.info.title}**${result.forced ? ' (DJ).' : '.'}` })] });
      return;
    }

    await interaction.reply({ embeds: [infoEmbed({ description: `🗳 Vote to skip: **${result.votes}/${result.needed}** (of ${result.total} listening).` })] });
  },
};
