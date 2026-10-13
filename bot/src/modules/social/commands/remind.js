import { SlashCommandBuilder } from 'discord.js';
import { successEmbed, errorEmbed, infoEmbed } from '../../../core/embeds.js';
import { getGuildConfig } from '../../../core/guildConfig.js';
import { componentText } from '../../../utils/text.js';
import { parseWhen } from '../timeParse.js';
import { peachesName } from '../../../core/peachesVoice.js';
import { createReminder, listUserReminders, cancelReminder, MAX_ACTIVE_PER_USER } from '../reminders.js';

const unix = (ms) => Math.floor(ms / 1000);

export const remind = {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Peaches reminds you of things, right here in this channel.')
    .addSubcommand((sub) =>
      sub
        .setName('me')
        .setDescription('Set a reminder.')
        .addStringOption((o) => o.setName('when').setDescription('e.g. "in 2h", "in 30 minutes", "at 9pm", "tomorrow 8am"').setRequired(true).setMaxLength(60))
        .addStringOption((o) => o.setName('what').setDescription('What to remind you about').setRequired(true).setMaxLength(500)),
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('Your upcoming reminders.'))
    .addSubcommand((sub) =>
      sub
        .setName('cancel')
        .setDescription('Cancel one of your reminders.')
        .addStringOption((o) => o.setName('reminder').setDescription('Which one').setRequired(true).setAutocomplete(true)),
    ),

  async autocomplete(interaction) {
    const typed = interaction.options.getFocused().toLowerCase();
    const mine = listUserReminders(interaction.guildId, interaction.user.id)
      .filter((r) => r.text.toLowerCase().includes(typed))
      .slice(0, 25);
    await interaction.respond(
      mine.map((r) => ({ name: componentText(`${new Date(r.dueAt).toISOString().slice(0, 16).replace('T', ' ')} UTC — ${r.text}`), value: r.id })),
    );
  },

  async execute(interaction) {
    await SUBCOMMANDS[interaction.options.getSubcommand()](interaction);
  },
};

const SUBCOMMANDS = {
  async me(interaction) {
    const parsed = parseWhen(interaction.options.getString('when', true), new Date(), getGuildConfig(interaction.guildId)?.timezone || 'UTC');
    if (parsed.error) {
      await interaction.reply({ embeds: [errorEmbed({ description: `🐀 ${parsed.error}` })], ephemeral: true });
      return;
    }
    if (listUserReminders(interaction.guildId, interaction.user.id).length >= MAX_ACTIVE_PER_USER) {
      await interaction.reply({ embeds: [errorEmbed({ description: `🐀 You already have ${MAX_ACTIVE_PER_USER} reminders waiting — cancel some with \`/remind cancel\` first.` })], ephemeral: true });
      return;
    }

    const reminder = createReminder({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      userId: interaction.user.id,
      text: interaction.options.getString('what', true).trim(),
      dueAt: parsed.date.getTime(),
    });
    await interaction.reply({
      embeds: [successEmbed({ description: `⏰ Got it. ${peachesName(interaction.guildId)} will remind you here <t:${unix(reminder.dueAt)}:R> (<t:${unix(reminder.dueAt)}:f>).\n> ${reminder.text}` })],
      ephemeral: true,
    });
  },

  async list(interaction) {
    const mine = listUserReminders(interaction.guildId, interaction.user.id);
    if (mine.length === 0) {
      await interaction.reply({ embeds: [infoEmbed({ description: '⏰ No reminders waiting. Set one with `/remind me`.' })], ephemeral: true });
      return;
    }
    const lines = mine.map((r) => `• <t:${unix(r.dueAt)}:R> in <#${r.channelId}> — ${r.text.slice(0, 120)}`);
    await interaction.reply({ embeds: [infoEmbed({ title: '⏰ Your reminders', description: lines.join('\n') })], ephemeral: true });
  },

  async cancel(interaction) {
    const ok = cancelReminder(interaction.options.getString('reminder', true), interaction.user.id);
    await interaction.reply({
      embeds: [ok ? successEmbed({ description: '⏰ Cancelled.' }) : errorEmbed({ description: '🐀 Couldn\'t find that reminder — pick one from the suggestions.' })],
      ephemeral: true,
    });
  },
};
