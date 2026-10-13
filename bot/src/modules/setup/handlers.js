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
import { requireManager } from '../../core/permissions.js';
import { audit } from '../../core/guildLog.js';

function hub(interaction) {
  return buildHubPayload(getGuildConfig(interaction.guildId));
}

async function createCategoryAndReturnToHub(interaction) {
  if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
    await interaction.update({ embeds: [missingManageChannelsEmbed()], components: [] });
    return;
  }

  // Five channel creations can easily outlast Discord's 3s interaction window.
  await interaction.deferUpdate();
  const fields = await createRatpackCategory(interaction.guild, getGuildConfig(interaction.guildId)).catch(() => null);
  if (!fields) {
    await interaction.editReply({ embeds: [errorEmbed({ description: "🐀 Couldn't create the category — check my permissions and try again." })], components: [] });
    return;
  }

  updateGuildConfig(interaction.guildId, fields);
  audit(interaction, 'created the 🐀 Ratpack channel category.');
  await interaction.editReply(hub(interaction));
}

/**
 * /setup itself is gated by setDefaultMemberPermissions, but components
 * aren't — and the welcome message's "Set Me Up" button is posted publicly,
 * so without this any member could open the hub and reroute channels or set
 * outage alerts to ping @here. Every setup interaction goes through it.
 */
function managersOnly(handlers) {
  return Object.fromEntries(
    Object.entries(handlers).map(([key, handler]) => [
      key,
      async (interaction, ...args) => {
        if (!(await requireManager(interaction))) return;
        await handler(interaction, ...args);
      },
    ]),
  );
}

export const setupButtons = managersOnly({
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
    audit(interaction, 'set alert pings to **@here**.');
    await interaction.update(hub(interaction));
  },

  async mention_none(interaction) {
    updateGuildConfig(interaction.guildId, { defaultMention: 'none', defaultRoleId: null });
    audit(interaction, 'turned alert pings **off**.');
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
});

export const setupSelects = managersOnly({
  async chan_select(interaction, purpose) {
    const channel = interaction.values[0];
    const meta = CHANNEL_PURPOSES[purpose];
    updateGuildConfig(interaction.guildId, { [meta.field]: channel });
    audit(interaction, `set the **${meta.label}** channel to <#${channel}>.`);
    await interaction.update(hub(interaction));
  },

  async tz_select(interaction) {
    updateGuildConfig(interaction.guildId, { timezone: interaction.values[0] });
    audit(interaction, `set the timezone to **${interaction.values[0]}**.`);
    await interaction.update(hub(interaction));
  },

  async mention_roleselect(interaction) {
    updateGuildConfig(interaction.guildId, { defaultMention: 'role', defaultRoleId: interaction.values[0] });
    audit(interaction, `set alert pings to <@&${interaction.values[0]}>.`);
    await interaction.update(hub(interaction));
  },
});

export const setupModals = managersOnly({
  async tz_modal(interaction) {
    const tz = interaction.fields.getTextInputValue('tz').trim();
    if (!isValidTimezone(tz)) {
      await interaction.reply({ embeds: [errorEmbed({ description: `🐀 **${tz}** isn't a recognized timezone. Try a format like \`Europe/Madrid\`.` })], ephemeral: true });
      return;
    }
    updateGuildConfig(interaction.guildId, { timezone: tz });
    audit(interaction, `set the timezone to **${tz}**.`);
    await interaction.update(hub(interaction));
  },
});
