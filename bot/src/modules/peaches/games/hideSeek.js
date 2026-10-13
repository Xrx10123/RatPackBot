import { ChannelType, PermissionsBitField } from 'discord.js';
import { successEmbed, infoEmbed, errorEmbed, warnEmbed } from '../../../core/embeds.js';
import { getCurrentState } from '../state.js';
import { reward, CHEESE_REWARDS } from '../economy.js';
import { pickLine } from '../variants.js';
import { createGame, getActiveGame, getGame, saveGameData, resolveGame, setGameMessage, fetchGameMessage, later } from './store.js';

export const HIDE_DURATION_MS = 20 * 60 * 1000;
export const GUESSES_PER_PERSON = 3;

const HIDING_LINES = [
  (n) => `🙈 **${n} has gone into hiding!** She's tucked herself away in one of this server's channels.`,
  (n) => `🙈 **${n} is playing hide-and-seek!** She giggled and scampered off into some channel or other.`,
];

/**
 * Where she can hide: ordinary text channels every member can see and the
 * bot can talk in. Private channels are off-limits — hiding somewhere half
 * the server can't open would just be mean.
 */
export function hidingSpots(guild, excludeChannelId = null) {
  const everyone = guild.roles.everyone;
  const me = guild.members.me;
  return [...guild.channels.cache.values()].filter(
    (c) =>
      c.type === ChannelType.GuildText &&
      c.id !== excludeChannelId &&
      c.permissionsFor(everyone)?.has(PermissionsBitField.Flags.ViewChannel) &&
      c.permissionsFor(me)?.has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]),
  );
}

/** The hint for a wrong guess: warm if you're in the same category as her. */
export function guessHint(guessChannel, hidingChannel) {
  if (hidingChannel && guessChannel?.parentId && guessChannel.parentId === hidingChannel.parentId) {
    return '🔊 Not here… but you hear tiny footsteps *very* close by. (Same category!)';
  }
  return '🍃 Not a whisker in here.';
}

export async function startHideAndSeek(interaction) {
  const existing = getActiveGame(interaction.guildId, 'hideseek');
  if (existing && existing.expiresAt > Date.now()) {
    await interaction.reply({ embeds: [warnEmbed({ description: '🙈 She\'s already hiding! Try `/pet find` in the channel you think she\'s in.' })], ephemeral: true });
    return;
  }
  if (existing) await endHideAndSeek(interaction.client, existing.id, existing); // expired but not swept yet

  const spots = hidingSpots(interaction.guild, interaction.channelId);
  if (spots.length < 2) {
    await interaction.reply({ embeds: [errorEmbed({ description: '🐀 There aren\'t enough public channels for her to hide in — she needs at least two besides this one.' })], ephemeral: true });
    return;
  }

  const hideIn = spots[Math.floor(Math.random() * spots.length)];
  const { name } = getCurrentState(interaction.guildId);
  const game = createGame({
    guildId: interaction.guildId,
    type: 'hideseek',
    channelId: interaction.channelId,
    durationMs: HIDE_DURATION_MS,
    data: { hidingChannelId: hideIn.id, guesses: {}, startedBy: interaction.user.id },
  });

  const embed = infoEmbed({
    title: '🔍 Hide and Seek!',
    description: [
      pickLine(HIDING_LINES)(name),
      '',
      `Go to the channel you think she's in and use \`/pet find\` there. Everyone gets **${GUESSES_PER_PERSON} guesses**.`,
      `First to find her wins **${CHEESE_REWARDS.hideSeek} 🧀** — **+${CHEESE_REWARDS.hideSeekFirstTry}** more if you get it first try.`,
    ].join('\n'),
  });
  embed.setTimestamp(game.expiresAt);
  embed.setFooter({ text: '🐀 She gives up hiding' });

  await interaction.reply({ embeds: [embed] });
  const reply = await interaction.fetchReply();
  setGameMessage(game.id, reply.id);
  later(HIDE_DURATION_MS, () => endHideAndSeek(interaction.client, game.id));
}

export async function guessHideAndSeek(interaction) {
  const game = getActiveGame(interaction.guildId, 'hideseek');
  if (!game || game.expiresAt < Date.now()) {
    await interaction.reply({ embeds: [infoEmbed({ description: '🐀 She isn\'t hiding right now. Start a round with `/pet hideandseek`.' })], ephemeral: true });
    return;
  }

  const used = game.data.guesses[interaction.user.id] ?? 0;
  if (used >= GUESSES_PER_PERSON) {
    await interaction.reply({ embeds: [warnEmbed({ description: '🙈 You\'re out of guesses this round. Cheer the others on!' })], ephemeral: true });
    return;
  }

  const { name } = getCurrentState(interaction.guildId);
  if (interaction.channelId !== game.data.hidingChannelId) {
    game.data.guesses[interaction.user.id] = used + 1;
    saveGameData(game.id, game.data);
    const hiding = interaction.guild.channels.cache.get(game.data.hidingChannelId);
    const left = GUESSES_PER_PERSON - used - 1;
    await interaction.reply({
      embeds: [infoEmbed({ description: `${guessHint(interaction.channel, hiding)}\n${left > 0 ? `${left} guess${left === 1 ? '' : 'es'} left.` : 'That was your last guess!'}` })],
      ephemeral: true,
    });
    return;
  }

  if (!resolveGame(game.id, interaction.user.id)) {
    await interaction.reply({ embeds: [infoEmbed({ description: '🐀 Someone found her a split second before you!' })], ephemeral: true });
    return;
  }

  const firstTry = used === 0;
  const earned = reward(interaction.guildId, interaction.user.id, 'hideSeek') + (firstTry ? reward(interaction.guildId, interaction.user.id, 'hideSeekFirstTry') : 0);
  const text = `🎉 ${interaction.user} found **${name}** hiding in <#${interaction.channelId}>${firstTry ? ' — on the very first try!' : '!'} *(+${earned} 🧀)*`;
  await interaction.reply({ embeds: [successEmbed({ description: text })] });

  const message = await fetchGameMessage(interaction.client, game);
  await message?.edit({ embeds: [successEmbed({ title: '🔍 Hide and Seek — found!', description: text })] }).catch(() => {});
}

/** Time's up: reveal where she was. No-op if someone already found her. */
export async function endHideAndSeek(client, gameId, game = null) {
  const current = game ?? getGame(gameId);
  if (!current || !resolveGame(current.id)) return;
  const { name } = getCurrentState(current.guildId);
  const message = await fetchGameMessage(client, current);
  await message
    ?.edit({
      embeds: [infoEmbed({ title: '🔍 Hide and Seek — time\'s up!', description: `🐀 Nobody found ${name}. She was in <#${current.data.hidingChannelId}> the whole time, looking extremely smug.` })],
    })
    .catch(() => {});
}
