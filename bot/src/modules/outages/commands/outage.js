import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { successEmbed, errorEmbed, infoEmbed } from '../../../core/embeds.js';
import { fuzzySearch } from '../../../utils/fuzzy.js';
import { updateGuildConfig } from '../../../core/guildConfig.js';
import { KNOWN_SERVICES, validateStatuspageHost } from '../providers/statuspage.js';
import { checkService } from '../checkService.js';
import { buildStatusBoardPayload } from '../ui/board.js';
import { listMonitors, getMonitorBySlug, addMonitor, removeMonitor, updateMonitorStatus, setUserNotify } from '../monitors.js';

const CURATED = [{ slug: 'steam', name: 'Steam' }, ...Object.entries(KNOWN_SERVICES).map(([slug, v]) => ({ slug, name: v.name }))];

export const outage = {
  data: new SlashCommandBuilder()
    .setName('outage')
    .setDescription('Monitor service status.')
    .addSubcommand((sub) => sub.setName('list').setDescription('Status board of everything monitored.'))
    .addSubcommand((sub) =>
      sub
        .setName('search')
        .setDescription('Search known services.')
        .addStringOption((o) => o.setName('query').setDescription('Service name').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Start monitoring a service.')
        .addStringOption((o) => o.setName('service').setDescription('Known service, or a Statuspage domain').setRequired(true).setAutocomplete(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Stop monitoring a service.')
        .addStringOption((o) => o.setName('service').setDescription('Currently monitored service').setRequired(true).setAutocomplete(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('check')
        .setDescription('Manually check a service now.')
        .addStringOption((o) => o.setName('service').setDescription('Currently monitored service').setRequired(true).setAutocomplete(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('notify')
        .setDescription('Get an extra personal ping for a service, on top of the channel default.')
        .addStringOption((o) => o.setName('service').setDescription('Currently monitored service').setRequired(true).setAutocomplete(true))
        .addBooleanOption((o) => o.setName('enabled').setDescription('On or off').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('channel')
        .setDescription('Move the alert channel.')
        .addChannelOption((o) => o.setName('channel').setDescription('Text channel for outage alerts').setRequired(true).addChannelTypes(ChannelType.GuildText)),
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const matches = fuzzySearch(focused, CURATED, { key: (s) => s.name, limit: 25 });
      await interaction.respond(matches.map((s) => ({ name: s.name, value: s.slug })));
      return;
    }

    const monitored = listMonitors(interaction.guildId).map((m) => ({ slug: m.serviceSlug, name: m.serviceName }));
    const matches = fuzzySearch(focused, monitored, { key: (s) => s.name, limit: 25 });
    await interaction.respond(matches.map((s) => ({ name: s.name, value: s.slug })));
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    await SUBCOMMAND_HANDLERS[sub](interaction);
  },
};

const SUBCOMMAND_HANDLERS = {
  async list(interaction) {
    await interaction.reply(buildStatusBoardPayload(listMonitors(interaction.guildId)));
  },

  async search(interaction) {
    const query = interaction.options.getString('query', true);
    const matches = fuzzySearch(query, CURATED, { key: (s) => s.name, limit: 10 });
    if (matches.length === 0) {
      await interaction.reply({
        embeds: [infoEmbed({ description: "🐀 No known match. You can still `/outage add` any Statuspage-powered service by its domain (e.g. `status.example.com`)." })],
        ephemeral: true,
      });
      return;
    }
    await interaction.reply({ embeds: [infoEmbed({ title: '🔍 Known Services', description: matches.map((m) => `• ${m.name}`).join('\n') })], ephemeral: true });
  },

  async add(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const value = interaction.options.getString('service', true).trim();

    if (getMonitorBySlug(interaction.guildId, value)) {
      await interaction.editReply({ embeds: [errorEmbed({ description: "🐀 Already monitoring that." })] });
      return;
    }

    const curated = CURATED.find((s) => s.slug === value);
    if (curated) {
      addMonitor({ guildId: interaction.guildId, serviceSlug: curated.slug, serviceName: curated.name });
      await interaction.editReply({ embeds: [successEmbed({ description: `🚨 Now monitoring **${curated.name}**.` })] });
      return;
    }

    const validation = await validateStatuspageHost(value);
    if (!validation.ok) {
      await interaction.editReply({ embeds: [errorEmbed({ description: `🐀 Couldn't find a working Statuspage instance at **${value}**.` })] });
      return;
    }

    addMonitor({ guildId: interaction.guildId, serviceSlug: value, serviceName: validation.name });
    await interaction.editReply({ embeds: [successEmbed({ description: `🚨 Now monitoring **${validation.name}**.` })] });
  },

  async remove(interaction) {
    const slug = interaction.options.getString('service', true);
    const monitor = getMonitorBySlug(interaction.guildId, slug);
    if (!monitor) {
      await interaction.reply({ embeds: [errorEmbed({ description: "🐀 Not monitoring that." })], ephemeral: true });
      return;
    }
    removeMonitor(monitor.id);
    await interaction.reply({ embeds: [successEmbed({ description: `🐀 Stopped monitoring **${monitor.serviceName}**.` })], ephemeral: true });
  },

  async check(interaction) {
    await interaction.deferReply();
    const slug = interaction.options.getString('service', true);
    const monitor = getMonitorBySlug(interaction.guildId, slug);
    if (!monitor) {
      await interaction.editReply({ embeds: [errorEmbed({ description: "🐀 Not monitoring that." })] });
      return;
    }

    try {
      const result = await checkService(monitor.serviceSlug);
      const status = result.indicator === 'none' ? 'up' : result.indicator === 'minor' ? 'degraded' : 'down';
      updateMonitorStatus(monitor.id, status);
      const embed = status === 'up' ? successEmbed({ description: `🟢 **${monitor.serviceName}** — ${result.description}` }) : errorEmbed({ description: `${status === 'down' ? '🔴' : '🟡'} **${monitor.serviceName}** — ${result.description}` });
      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply({ embeds: [errorEmbed({ description: `🐀 Couldn't reach **${monitor.serviceName}**'s status page.` })] });
    }
  },

  async notify(interaction) {
    const slug = interaction.options.getString('service', true);
    const enabled = interaction.options.getBoolean('enabled', true);
    const monitor = getMonitorBySlug(interaction.guildId, slug);
    if (!monitor) {
      await interaction.reply({ embeds: [errorEmbed({ description: "🐀 Not monitoring that." })], ephemeral: true });
      return;
    }
    setUserNotify(interaction.user.id, interaction.guildId, slug, enabled);
    await interaction.reply({
      embeds: [successEmbed({ description: `🔔 Personal pings for **${monitor.serviceName}** are now **${enabled ? 'on' : 'off'}**.` })],
      ephemeral: true,
    });
  },

  async channel(interaction) {
    const channel = interaction.options.getChannel('channel', true);
    updateGuildConfig(interaction.guildId, { outageChannelId: channel.id });
    await interaction.reply({ embeds: [successEmbed({ description: `🚨 Outage alerts now post in <#${channel.id}>.` })], ephemeral: true });
  },
};
