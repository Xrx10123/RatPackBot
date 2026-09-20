import { PermissionsBitField } from 'discord.js';
import { errorEmbed } from '../../core/embeds.js';
import { CHANNEL_PURPOSES, getGuildConfig, updateGuildConfig } from '../../core/guildConfig.js';
import { buildHubPayload } from './ui/hub.js';
import { buildChannelStepPayload, buildChannelSelectPayload, createRatpackCategory, missingManageChannelsEmbed } from './ui/channelStep.js';
import { buildTimezoneStepPayload, buildTimezoneSearchModal, isValidTimezone } from './ui/timezoneStep.js';
import { buildMentionStepPayload, buildRoleSelectPayload } from './ui/mentionStep.js';
import { buildPeachesSettingsPayload } from './ui/peachesSettingsStep.js';
import { buildMusicSettingsPayload } from './ui/musicSettingsStep.js';
import { verifyGuildChannels, buildVerifyEmbed } from './verify.js';

function hub(interaction) {
  return buildHubPayload(getGuildConfig(interaction.guildId));
}

async function createCategoryAndReturnToHub(interaction) {
  if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
    await interaction.update({ embeds: [missingManageChannelsEmbed()], components: [] });
    return;
  }

  const fields = await createRatpackCategory(interaction.guild).catch(() => null);
  if (!fields) {
    await interaction.update({ embeds: [errorEmbed({ description: "🐀 Couldn't create the category — check my permissions and try again." })], components: [] });
    return;
  }

  updateGuildConfig(interaction.guildId, fields);
  await interaction.update(hub(interaction));
}

export const setupButtons = {
  async welcome_start(interaction) {
    await interaction.message.edit({ components: [] }).catch(() => {});
    await interaction.reply({ ...hub(interaction), ephemeral: true });
  },

  async chan_open(interaction, purpose) {
    await interaction.update(buildChannelStepPayload(purpose, getGuildConfig(interaction.guildId)));
  },

  async chan_pickmenu(interaction, purpose) {
    await interaction.update(buildChannelSelectPayload(purpose));
  },

  async create_all(interaction) {
    await createCategoryAndReturnToHub(interaction);
  },

  async back(interaction) {
    await interaction.update(hub(interaction));
  },

  async tz_open(interaction) {
    await interaction.update(buildTimezoneStepPayload(getGuildConfig(interaction.guildId)));
  },

  async tz_search(interaction) {
    await interaction.showModal(buildTimezoneSearchModal());
  },

  async mention_open(interaction) {
    await interaction.update(buildMentionStepPayload());
  },

  async mention_here(interaction) {
    updateGuildConfig(interaction.guildId, { defaultMention: 'here', defaultRoleId: null });
    await interaction.update(hub(interaction));
  },

  async mention_none(interaction) {
    updateGuildConfig(interaction.guildId, { defaultMention: 'none', defaultRoleId: null });
    await interaction.update(hub(interaction));
  },

  async mention_rolemenu(interaction) {
    await interaction.update(buildRoleSelectPayload());
  },

  async check(interaction) {
    const config = getGuildConfig(interaction.guildId);
    const results = await verifyGuildChannels(interaction.guild, config);
    await interaction.reply({ embeds: [buildVerifyEmbed(results)], ephemeral: true });
  },

  async peaches_open(interaction) {
    await interaction.update(buildPeachesSettingsPayload(interaction.guildId));
  },

  async music_open(interaction) {
    await interaction.update(buildMusicSettingsPayload(getGuildConfig(interaction.guildId)));
  },
};

export const setupSelects = {
  async chan_select(interaction, purpose) {
    const channel = interaction.values[0];
    const meta = CHANNEL_PURPOSES[purpose];
    updateGuildConfig(interaction.guildId, { [meta.field]: channel });
    await interaction.update(hub(interaction));
  },

  async tz_select(interaction) {
    updateGuildConfig(interaction.guildId, { timezone: interaction.values[0] });
    await interaction.update(hub(interaction));
  },

  async mention_roleselect(interaction) {
    updateGuildConfig(interaction.guildId, { defaultMention: 'role', defaultRoleId: interaction.values[0] });
    await interaction.update(hub(interaction));
  },
};

export const setupModals = {
  async tz_modal(interaction) {
    const tz = interaction.fields.getTextInputValue('tz').trim();
    if (!isValidTimezone(tz)) {
      await interaction.reply({ embeds: [errorEmbed({ description: `🐀 **${tz}** isn't a recognized timezone. Try a format like \`Europe/Madrid\`.` })], ephemeral: true });
      return;
    }
    updateGuildConfig(interaction.guildId, { timezone: tz });
    await interaction.update(hub(interaction));
  },
};
