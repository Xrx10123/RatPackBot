import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { successEmbed, errorEmbed, infoEmbed, warnEmbed } from '../../../core/embeds.js';
import { fuzzySearch } from '../../../utils/fuzzy.js';
import * as steam from '../providers/steam.js';
import { pollOne } from '../newsScheduler.js';
import { requireManager } from '../../../core/permissions.js';
import { getGuildConfig } from '../../../core/guildConfig.js';
import {
  listSubscriptions,
  getSubscriptionByAppId,
  getSubscriptionByName,
  getSubscriptionById,
  addSubscription,
  removeSubscription,
  setEnabled,
  setTagFilter,
} from '../newsSubscriptions.js';

export const news = {
  data: new SlashCommandBuilder()
    .setName('news')
    .setDescription('Follow Steam news for a game.')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Follow a game (fuzzy-searches the Steam catalog).')
        .addStringOption((o) => o.setName('game').setDescription('Game name or Steam AppID').setRequired(true).setAutocomplete(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Stop following a game.')
        .addStringOption((o) => o.setName('game').setDescription('Currently followed game').setRequired(true).setAutocomplete(true)),
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List followed games.'))
    .addSubcommand((sub) => sub.setName('check').setDescription('Force-refresh news now.'))
    .addSubcommand((sub) =>
      sub
        .setName('filter')
        .setDescription('Narrow a feed to specific Steam news tags.')
        .addStringOption((o) => o.setName('game').setDescription('Currently followed game').setRequired(true).setAutocomplete(true))
        .addStringOption((o) => o.setName('tags').setDescription('Comma-separated tags, e.g. patchnotes,update — or "clear" to remove the filter').setRequired(true).setMaxLength(200)),
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      if (!steam.isAppListConfigured()) {
        await interaction.respond([]);
        return;
      }
      const matches = await steam.searchApps(focused, 25).catch(() => []);
      await interaction.respond(matches.map((a) => ({ name: a.name.slice(0, 100), value: String(a.appid) })));
      return;
    }

    const followed = listSubscriptions(interaction.guildId);
    const matches = fuzzySearch(focused, followed, { key: (s) => s.gameName, limit: 25 });
    // Subscription id as the value — game names can exceed the 100-char option value limit.
    await interaction.respond(matches.map((s) => ({ name: s.gameName.slice(0, 100), value: s.id })));
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    await SUBCOMMAND_HANDLERS[sub](interaction);
  },
};

const SUBCOMMAND_HANDLERS = {
  async add(interaction) {
    if (!(await requireManager(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    if (!steam.isAppListConfigured()) {
      await interaction.editReply({ embeds: [errorEmbed({ description: '🐀 Following games needs `STEAM_API_KEY` set in `.env` — Steam retired the keyless catalog endpoint this plan was built against.' })] });
      return;
    }

    const value = interaction.options.getString('game', true);
    const app = await steam.getAppById(value).catch(() => null);
    if (!app) {
      await interaction.editReply({ embeds: [errorEmbed({ description: "🐀 Couldn't find that on Steam — pick a suggestion from the list." })] });
      return;
    }

    if (getSubscriptionByAppId(interaction.guildId, app.appid)) {
      await interaction.editReply({ embeds: [warnEmbed({ description: `🐀 Already following **${app.name}**.` })] });
      return;
    }

    addSubscription({ guildId: interaction.guildId, gameName: app.name, steamAppid: app.appid });
    await interaction.editReply({ embeds: [successEmbed({ description: `📰 Now following **${app.name}**.` })] });
  },

  async remove(interaction) {
    if (!(await requireManager(interaction))) return;
    const subRow = findFollowed(interaction);
    if (!subRow) {
      await interaction.reply({ embeds: [errorEmbed({ description: "🐀 You're not following that." })], ephemeral: true });
      return;
    }
    removeSubscription(subRow.id);
    await interaction.reply({ embeds: [successEmbed({ description: `🐀 Stopped following **${subRow.gameName}**.` })], ephemeral: true });
  },

  async list(interaction) {
    const subs = listSubscriptions(interaction.guildId);
    if (subs.length === 0) {
      await interaction.reply({ embeds: [infoEmbed({ description: '🐀 Not following any games yet — try `/news add`.' })], ephemeral: true });
      return;
    }

    const rows = [];
    for (let i = 0; i < subs.length; i += 5) {
      rows.push(
        new ActionRowBuilder().addComponents(
          subs.slice(i, i + 5).map((s) =>
            new ButtonBuilder()
              .setCustomId(`games:toggle:${s.id}`)
              .setLabel(s.gameName.slice(0, 80))
              .setEmoji(s.enabled ? '✅' : '❌')
              .setStyle(s.enabled ? ButtonStyle.Success : ButtonStyle.Secondary),
          ),
        ),
      );
    }

    await interaction.reply({
      embeds: [infoEmbed({ title: '📰 Followed Games', description: 'Click to toggle on/off.' })],
      components: rows.slice(0, 5),
      ephemeral: true,
    });
  },

  async check(interaction) {
    if (!(await requireManager(interaction))) return;
    if (!getGuildConfig(interaction.guildId)?.newsChannelId) {
      await interaction.reply({ embeds: [warnEmbed({ description: '🐀 No news channel is set, so there is nowhere to post — pick one in `/setup start`.' })], ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    const subs = listSubscriptions(interaction.guildId).filter((s) => s.enabled);
    let posted = 0;
    let failed = 0;
    for (const s of subs) {
      try {
        posted += await pollOne(interaction.client, s);
      } catch {
        failed += 1;
      }
    }
    const lines = [`🐀 Checked ${subs.length} feed${subs.length === 1 ? '' : 's'} — ${posted > 0 ? `posted **${posted}** new item${posted === 1 ? '' : 's'}` : 'nothing new'}.`];
    if (failed > 0) lines.push(`⚠️ ${failed} feed${failed === 1 ? '' : 's'} couldn't be reached — Steam may be having a moment.`);
    await interaction.editReply({ embeds: [(failed > 0 ? warnEmbed : successEmbed)({ description: lines.join('\n') })] });
  },

  async filter(interaction) {
    if (!(await requireManager(interaction))) return;
    const subRow = findFollowed(interaction);
    if (!subRow) {
      await interaction.reply({ embeds: [errorEmbed({ description: "🐀 You're not following that." })], ephemeral: true });
      return;
    }

    const raw = interaction.options.getString('tags', true).trim();
    if (['clear', 'none', 'off', 'all', '-'].includes(raw.toLowerCase())) {
      setTagFilter(subRow.id, null);
      await interaction.reply({ embeds: [successEmbed({ description: `🐀 **${subRow.gameName}** will show all news again.` })], ephemeral: true });
      return;
    }

    const tags = [...new Set(raw.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))].join(',');
    setTagFilter(subRow.id, tags || null);
    await interaction.reply({ embeds: [successEmbed({ description: `🐀 **${subRow.gameName}**'s feed is now filtered to: ${tags || 'everything'}` })], ephemeral: true });
  },
};

/** Resolves the `game` option — a subscription id from autocomplete, or a typed game name. */
function findFollowed(interaction) {
  const value = interaction.options.getString('game', true);
  const byId = getSubscriptionById(value);
  if (byId && byId.guildId === interaction.guildId) return byId;
  return getSubscriptionByName(interaction.guildId, value);
}

export const newsButtons = {
  async toggle(interaction, subscriptionId) {
    if (!(await requireManager(interaction))) return;
    const subRow = getSubscriptionById(subscriptionId);
    if (!subRow || subRow.guildId !== interaction.guildId) {
      await interaction.deferUpdate();
      return;
    }
    setEnabled(subRow.id, !subRow.enabled);

    const subs = listSubscriptions(interaction.guildId);
    const rows = [];
    for (let i = 0; i < subs.length; i += 5) {
      rows.push(
        new ActionRowBuilder().addComponents(
          subs.slice(i, i + 5).map((s) =>
            new ButtonBuilder()
              .setCustomId(`games:toggle:${s.id}`)
              .setLabel(s.gameName.slice(0, 80))
              .setEmoji(s.enabled ? '✅' : '❌')
              .setStyle(s.enabled ? ButtonStyle.Success : ButtonStyle.Secondary),
          ),
        ),
      );
    }
    await interaction.update({ components: rows.slice(0, 5) });
  },
};
