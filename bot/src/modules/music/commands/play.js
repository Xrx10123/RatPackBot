import { SlashCommandBuilder } from 'discord.js';
import { getLavalinkManager } from '../../../lavalink/manager.js';
import { successEmbed, errorEmbed, warnEmbed } from '../../../core/embeds.js';
import { checkChannelPermissions } from '../../../core/permissions.js';
import { resolveSearchQuery, isUrl } from '../sources.js';
import { flavor, FLAVOR } from '../../../utils/ratpack.js';

export const play = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Search or play a link.')
    .addStringOption((opt) =>
      opt
        .setName('query')
        .setDescription('A search term or a URL (YouTube, SoundCloud, Spotify, ...)')
        .setRequired(true),
    ),

  async execute(interaction) {
    const voiceChannel = interaction.member.voice?.channel;

    if (!voiceChannel) {
      await interaction.reply({
        embeds: [errorEmbed({ description: '🐀 Hop into a voice channel first — I need somewhere to follow you.' })],
        ephemeral: true,
      });
      return;
    }

    const permCheck = checkChannelPermissions(voiceChannel, ['Connect', 'Speak']);
    if (!permCheck.ok) {
      await interaction.reply({ embeds: [permCheck.embed], ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const query = interaction.options.getString('query', true);
    const manager = getLavalinkManager();

    let player = manager.getPlayer(interaction.guildId);
    if (!player) {
      player = manager.createPlayer({
        guildId: interaction.guildId,
        voiceChannelId: voiceChannel.id,
        textChannelId: interaction.channelId,
        selfDeaf: true,
        selfMute: false,
        volume: 100,
      });
    }

    if (!player.connected) {
      await player.connect();
    }

    const result = await player.search({ query: resolveSearchQuery(query) }, interaction.user);

    if (!result || result.loadType === 'error') {
      await interaction.editReply({
        embeds: [
          errorEmbed({
            description: `🐀 Couldn't fetch that — ${result?.exception?.message ?? 'the trail went cold.'}`,
          }),
        ],
      });
      return;
    }

    if (result.loadType === 'empty' || result.tracks.length === 0) {
      await interaction.editReply({
        embeds: [warnEmbed({ description: '🐀 Nothing turned up for that. Try a different search.' })],
      });
      return;
    }

    if (result.loadType === 'playlist') {
      player.queue.add(result.tracks);
      await interaction.editReply({
        embeds: [
          successEmbed({
            description: `🐀 Added **${result.tracks.length} tracks** from **${result.playlist?.name ?? 'the playlist'}** to the queue.`,
          }),
        ],
      });
    } else {
      const track = result.tracks[0];
      player.queue.add(track);
      const flavorLine = isUrl(query) ? '' : flavor(FLAVOR.queueAdded);
      await interaction.editReply({
        embeds: [successEmbed({ description: [`🐀 Queued **${track.info.title}**.`, flavorLine].filter(Boolean).join(' ') })],
      });
    }

    if (!player.playing && !player.paused) {
      await player.play();
    }
  },
};
