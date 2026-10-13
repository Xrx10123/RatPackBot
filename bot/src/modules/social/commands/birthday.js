import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { successEmbed, errorEmbed, infoEmbed, warnEmbed } from '../../../core/embeds.js';
import { getGuildConfig, updateGuildConfig } from '../../../core/guildConfig.js';
import { isManager, requireManager } from '../../../core/permissions.js';
import { audit } from '../../../core/guildLog.js';
import { wallClock } from '../timeParse.js';
import { peachesName, giftCheese } from '../peachesVoice.js';
import { MONTHS, isValidBirthday, setBirthday, removeBirthday, listBirthdays, daysUntilBirthday, formatBirthday, addWish, countWishes } from '../birthdays.js';

function today(guildId) {
  try {
    return wallClock(new Date(), getGuildConfig(guildId)?.timezone || 'UTC');
  } catch {
    return wallClock(new Date(), 'UTC');
  }
}

/** Setting/removing someone else's birthday is a manager thing. */
async function resolveTarget(interaction) {
  const other = interaction.options.getUser('user');
  if (!other || other.id === interaction.user.id) return interaction.user;
  if (!isManager(interaction.member)) {
    await interaction.reply({ embeds: [errorEmbed({ description: '🐀 Only server managers can set someone else\'s birthday.' })], ephemeral: true });
    return null;
  }
  if (other.bot) {
    await interaction.reply({ embeds: [errorEmbed({ description: '🐀 Bots don\'t have birthdays. (Peaches has hers already.)' })], ephemeral: true });
    return null;
  }
  return other;
}

export const birthday = {
  data: new SlashCommandBuilder()
    .setName('birthday')
    .setDescription('Birthdays — Peaches throws a party on the day.')
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Tell Peaches your birthday.')
        .addIntegerOption((o) => o.setName('month').setDescription('Month').setRequired(true).addChoices(...MONTHS.map((name, i) => ({ name, value: i + 1 }))))
        .addIntegerOption((o) => o.setName('day').setDescription('Day of the month').setRequired(true).setMinValue(1).setMaxValue(31))
        .addIntegerOption((o) => o.setName('year').setDescription('Birth year (optional — only used to say how old you\'re turning)').setMinValue(1900).setMaxValue(2100))
        .addUserOption((o) => o.setName('user').setDescription('Set it for someone else (managers only)')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Forget a birthday.')
        .addUserOption((o) => o.setName('user').setDescription('Someone else\'s (managers only)')),
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('Upcoming birthdays in this server.'))
    .addSubcommand((sub) =>
      sub
        .setName('role')
        .setDescription('A role members get for the day on their birthday (managers).')
        .addRoleOption((o) => o.setName('role').setDescription('The birthday role (leave empty to turn this off)')),
    ),

  async execute(interaction) {
    await SUBCOMMANDS[interaction.options.getSubcommand()](interaction);
  },
};

const SUBCOMMANDS = {
  async set(interaction) {
    const target = await resolveTarget(interaction);
    if (!target) return;
    const month = interaction.options.getInteger('month', true);
    const day = interaction.options.getInteger('day', true);
    const year = interaction.options.getInteger('year');
    if (!isValidBirthday(month, day, year)) {
      await interaction.reply({ embeds: [errorEmbed({ description: `🐀 ${MONTHS[month - 1]} ${day}${year ? `, ${year}` : ''} isn't a real date.` })], ephemeral: true });
      return;
    }

    setBirthday(interaction.guildId, target.id, { month, day, year });
    const row = { month, day, year };
    const days = daysUntilBirthday(row, today(interaction.guildId));
    const who = target.id === interaction.user.id ? 'your' : `${target}'s`;
    const when = days === 0 ? "That's **today** — happy birthday! 🎂" : `That's in **${days} day${days === 1 ? '' : 's'}**.`;
    const channelNote = getGuildConfig(interaction.guildId)?.socialChannelId ? '' : '\n-# No Birthdays & Reminders channel is set yet — a manager can pick one in `/setup start`.';
    await interaction.reply({
      embeds: [successEmbed({ description: `🎂 ${peachesName(interaction.guildId)} wrote down ${who} birthday: **${formatBirthday(row, { withYear: true })}**. ${when}${channelNote}` })],
      ephemeral: true,
    });
  },

  async remove(interaction) {
    const target = await resolveTarget(interaction);
    if (!target) return;
    const removed = removeBirthday(interaction.guildId, target.id);
    await interaction.reply({
      embeds: [removed ? successEmbed({ description: '🎂 Forgotten. (Peaches will pretend she never knew.)' }) : infoEmbed({ description: '🐀 There was no birthday saved.' })],
      ephemeral: true,
    });
  },

  async list(interaction) {
    const now = today(interaction.guildId);
    const rows = listBirthdays(interaction.guildId)
      .map((row) => ({ row, days: daysUntilBirthday(row, now) }))
      .sort((a, b) => a.days - b.days)
      .slice(0, 25);
    if (rows.length === 0) {
      await interaction.reply({ embeds: [infoEmbed({ description: '🎂 No birthdays saved yet — add yours with `/birthday set`.' })], ephemeral: true });
      return;
    }
    const lines = rows.map(({ row, days }) => {
      const when = days === 0 ? '🎉 **today!**' : days === 1 ? 'tomorrow' : `in ${days} days`;
      return `<@${row.userId}> — ${formatBirthday(row)} · ${when}`;
    });
    await interaction.reply({ embeds: [infoEmbed({ title: '🎂 Upcoming Birthdays', description: lines.join('\n') })], allowedMentions: { parse: [] } });
  },

  async role(interaction) {
    if (!(await requireManager(interaction))) return;
    const role = interaction.options.getRole('role');
    if (role && !role.editable) {
      await interaction.reply({
        embeds: [warnEmbed({ description: `🐀 I can't hand out ${role} — drag my role above it in Server Settings → Roles, then try again.` })],
        ephemeral: true,
      });
      return;
    }
    updateGuildConfig(interaction.guildId, { birthdayRoleId: role?.id ?? null });
    audit(interaction, role ? `set the birthday role to ${role}.` : 'turned off the birthday role.');
    await interaction.reply({
      embeds: [successEmbed({ description: role ? `🎂 Birthday people get ${role} for the day.` : '🎂 No birthday role.' })],
      ephemeral: true,
    });
  },
};

export const WISH_GIFT = 2;

export const birthdayButtons = {
  async wish(interaction, yearStr, birthdayUserId) {
    const year = Number(yearStr);
    if (interaction.user.id === birthdayUserId) {
      await interaction.reply({ embeds: [infoEmbed({ description: '🎂 You can\'t wish yourself happy birthday… but happy birthday! 🎉' })], ephemeral: true });
      return;
    }
    if (!addWish(interaction.guildId, birthdayUserId, year, interaction.user.id)) {
      await interaction.reply({ embeds: [infoEmbed({ description: '🎉 You already sent your wishes — Peaches delivered them personally.' })], ephemeral: true });
      return;
    }
    giftCheese(interaction.guildId, interaction.user.id, WISH_GIFT);

    const count = countWishes(interaction.guildId, birthdayUserId, year);
    const original = interaction.message?.embeds?.[0];
    if (original) {
      const embed = EmbedBuilder.from(original).setFooter({ text: `🎉 ${count} birthday wish${count === 1 ? '' : 'es'} delivered by Peaches` });
      await interaction.update({ embeds: [embed] });
      await interaction.followUp({ embeds: [successEmbed({ description: `🎉 Wishes sent to <@${birthdayUserId}>! *(+${WISH_GIFT} 🧀 for being nice)*` })], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [successEmbed({ description: `🎉 Wishes sent to <@${birthdayUserId}>!` })], ephemeral: true });
    }
  },
};
