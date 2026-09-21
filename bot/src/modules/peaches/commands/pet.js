import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { successEmbed, errorEmbed, infoEmbed, warnEmbed } from '../../../core/embeds.js';
import { MOOD_DISPLAY, pickLine } from '../variants.js';
import { getCurrentState, renamePeaches, getRenameCooldownRemaining, resetToContent } from '../state.js';
import { getUserStats, getLeaderboard } from '../stats.js';
import { getSpawnChannelIds, setSpawnChannelIds, updatePeachesConfig, ensurePeachesConfig } from '../config.js';
import { resolveAllPending } from '../mischiefStore.js';
import { spawnNow } from '../spawner.js';
import { getMediaForMoment, applyMedia } from '../media.js';

const LEADERBOARD_CATEGORIES = [
  { name: 'Cheese Fed', value: 'cheeseFed' },
  { name: 'Turds Cleaned', value: 'turdsCleaned' },
  { name: 'Holes Investigated', value: 'holesInvestigated' },
  { name: 'Walls Knocked', value: 'wallsKnocked' },
  { name: 'Fealty Pledged', value: 'fealtyPledged' },
];

const BAD_WORDS = ['nigger', 'faggot', 'retard', 'cunt']; // minimal blocklist per the design doc's "basic slur filter"

function isAdmin(interaction) {
  return interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);
}

async function requireAdmin(interaction) {
  if (isAdmin(interaction)) return true;
  await interaction.reply({ embeds: [errorEmbed({ description: '🐀 Only server managers can do that.' })], ephemeral: true });
  return false;
}

let calmLastUsed = new Map(); // guildId -> timestamp (in-memory; a restart just clears the cooldown early, low stakes)
const CALM_COOLDOWN_MS = 60 * 60 * 1000;

export const pet = {
  data: new SlashCommandBuilder()
    .setName('pet')
    .setDescription('Peaches, the pack rat.')
    .addSubcommand((sub) => sub.setName('status').setDescription('Status embed with mood.'))
    .addSubcommand((sub) =>
      sub
        .setName('stats')
        .setDescription('Per-user stats.')
        .addUserOption((o) => o.setName('user').setDescription('Whose stats (default: you)')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('leaderboard')
        .setDescription('All-time rankings.')
        .addStringOption((o) => o.setName('category').setDescription('Category').addChoices(...LEADERBOARD_CATEGORIES)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('channels')
        .setDescription('Choose where Peaches can appear.')
        .addStringOption((o) =>
          o
            .setName('action')
            .setDescription('add, remove, or list')
            .setRequired(true)
            .addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' }, { name: 'List', value: 'list' }),
        )
        .addChannelOption((o) => o.setName('channel').setDescription('Channel (for add/remove)').addChannelTypes(ChannelType.GuildText)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('config')
        .setDescription('Spawn behavior settings.')
        .addStringOption((o) =>
          o.setName('mischief_frequency').setDescription('How often mischief happens').addChoices({ name: 'Low', value: 'low' }, { name: 'Normal', value: 'normal' }, { name: 'High', value: 'high' }),
        )
        .addBooleanOption((o) => o.setName('escalation_enabled').setDescription('Allow the neglect escalation ladder')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('mischief')
        .setDescription('Toggle mischief types and cross-module hooks.')
        .addStringOption((o) =>
          o
            .setName('toggle')
            .setDescription('What to toggle')
            .setRequired(true)
            .addChoices(
              { name: 'Mischief (overall)', value: 'mischiefEnabled' },
              { name: 'Cross-module: Music', value: 'crossMusic' },
              { name: 'Cross-module: News', value: 'crossNews' },
              { name: 'Cross-module: Outages', value: 'crossOutages' },
              { name: 'Cross-module: Hoards', value: 'crossHoards' },
            ),
        )
        .addBooleanOption((o) => o.setName('enabled').setDescription('On or off').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('rename')
        .setDescription('Rename Peaches (once per week).')
        .addStringOption((o) => o.setName('name').setDescription('New name (1-32 chars)').setRequired(true).setMaxLength(32)),
    )
    .addSubcommand((sub) => sub.setName('calm').setDescription('Emergency reset — mood to Content, clears pending mischief.'))
    .addSubcommand((sub) =>
      sub
        .setName('spawn')
        .setDescription('Force Peaches to appear right now (skips the random timer).')
        .addChannelOption((o) => o.setName('channel').setDescription('Which spawn channel (default: first configured one)').addChannelTypes(ChannelType.GuildText)),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    await SUBCOMMAND_HANDLERS[sub](interaction);
  },
};

const SUBCOMMAND_HANDLERS = {
  async status(interaction) {
    const state = getCurrentState(interaction.guildId);
    const mood = MOOD_DISPLAY[state.mood] ?? MOOD_DISPLAY.content;
    const payload = {
      embeds: [
        successEmbed({
          title: `${mood.emoji} ${state.name}`,
          description: `${state.name} ${pickLine(mood.flavor)}\n\nLevel **${state.level}** · Mood: **${mood.label}**`,
        }),
      ],
    };
    await interaction.reply(await applyMedia(payload, getMediaForMoment(state.mood)));
  },

  async spawn(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const channels = getSpawnChannelIds(interaction.guildId);
    const requestedChannel = interaction.options.getChannel('channel');
    const channelId = requestedChannel?.id ?? channels[0];

    if (!channelId) {
      await interaction.reply({
        embeds: [errorEmbed({ description: '🐀 No spawn channels configured yet — add one with `/pet channels action:Add`.' })],
        ephemeral: true,
      });
      return;
    }
    if (requestedChannel && !channels.includes(requestedChannel.id)) {
      await interaction.reply({
        embeds: [errorEmbed({ description: `🐀 <#${requestedChannel.id}> isn't a configured spawn channel — add it with \`/pet channels action:Add\` first.` })],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    const result = await spawnNow(interaction.client, interaction.guildId, channelId, { force: true });

    if (!result.ok) {
      await interaction.editReply({ embeds: [errorEmbed({ description: "🐀 Couldn't post the spawn — check my permissions in that channel." })] });
      return;
    }

    await interaction.editReply({ embeds: [successEmbed({ description: `🐀 Spawned in <#${channelId}>.` })] });
  },

  async stats(interaction) {
    const user = interaction.options.getUser('user') ?? interaction.user;
    const stats = getUserStats(interaction.guildId, user.id);
    await interaction.reply({
      embeds: [
        infoEmbed({
          title: `🐀 ${user.username}'s Peaches Stats`,
          description: [
            `🧀 Cheese fed: **${stats.cheeseFed}**`,
            `🧹 Turds cleaned: **${stats.turdsCleaned}**`,
            `🕳 Holes investigated: **${stats.holesInvestigated}**`,
            `📦 Walls knocked: **${stats.wallsKnocked}**`,
            `👑 Fealty pledged: **${stats.fealtyPledged}**`,
          ].join('\n'),
        }),
      ],
      ephemeral: true,
    });
  },

  async leaderboard(interaction) {
    const category = interaction.options.getString('category') ?? 'cheeseFed';
    const label = LEADERBOARD_CATEGORIES.find((c) => c.value === category)?.name ?? 'Cheese Fed';
    const rows = getLeaderboard(interaction.guildId, category, 10);

    if (rows.length === 0) {
      await interaction.reply({ embeds: [infoEmbed({ description: '🐀 No stats yet.' })] });
      return;
    }

    const lines = rows.map((r, i) => `${i + 1}. <@${r.userId}> — **${r[category]}**`);
    await interaction.reply({ embeds: [infoEmbed({ title: `🐀 All-Time Leaderboard — ${label}`, description: lines.join('\n') })] });
  },

  async channels(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const action = interaction.options.getString('action', true);
    const current = getSpawnChannelIds(interaction.guildId);

    if (action === 'list') {
      const description = current.length > 0 ? current.map((id) => `<#${id}>`).join('\n') : '🐀 No spawn channels set yet.';
      await interaction.reply({ embeds: [infoEmbed({ title: '🐀 Peaches Spawn Channels', description })], ephemeral: true });
      return;
    }

    const channel = interaction.options.getChannel('channel');
    if (!channel) {
      await interaction.reply({ embeds: [errorEmbed({ description: '🐀 Pick a channel to add or remove.' })], ephemeral: true });
      return;
    }

    if (action === 'add') {
      if (current.includes(channel.id)) {
        await interaction.reply({ embeds: [warnEmbed({ description: `🐀 <#${channel.id}> is already a spawn channel.` })], ephemeral: true });
        return;
      }
      setSpawnChannelIds(interaction.guildId, [...current, channel.id]);
      await interaction.reply({ embeds: [successEmbed({ description: `🐀 Peaches may now appear in <#${channel.id}>.` })], ephemeral: true });
      return;
    }

    setSpawnChannelIds(interaction.guildId, current.filter((id) => id !== channel.id));
    await interaction.reply({ embeds: [successEmbed({ description: `🐀 Removed <#${channel.id}> from spawn channels.` })], ephemeral: true });
  },

  async config(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const patch = {};
    const frequency = interaction.options.getString('mischief_frequency');
    const escalation = interaction.options.getBoolean('escalation_enabled');
    if (frequency) patch.mischiefFrequency = frequency;
    if (escalation !== null) patch.escalationEnabled = escalation ? 1 : 0;

    if (Object.keys(patch).length === 0) {
      const config = ensurePeachesConfig(interaction.guildId);
      await interaction.reply({
        embeds: [infoEmbed({ description: `🐀 Mischief frequency: **${config.mischiefFrequency}** · Escalation: **${config.escalationEnabled ? 'on' : 'off'}**` })],
        ephemeral: true,
      });
      return;
    }

    updatePeachesConfig(interaction.guildId, patch);
    await interaction.reply({ embeds: [successEmbed({ description: '🐀 Updated.' })], ephemeral: true });
  },

  async mischief(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const toggle = interaction.options.getString('toggle', true);
    const enabled = interaction.options.getBoolean('enabled', true);
    updatePeachesConfig(interaction.guildId, { [toggle]: enabled ? 1 : 0 });
    await interaction.reply({ embeds: [successEmbed({ description: `🐀 Set to **${enabled ? 'on' : 'off'}**.` })], ephemeral: true });
  },

  async rename(interaction) {
    const remaining = getRenameCooldownRemaining(interaction.guildId);
    if (remaining > 0) {
      const days = Math.ceil(remaining / (24 * 60 * 60 * 1000));
      await interaction.reply({ embeds: [errorEmbed({ description: `🐀 She was just renamed — try again in ${days} day${days === 1 ? '' : 's'}.` })], ephemeral: true });
      return;
    }

    const name = interaction.options.getString('name', true).trim();
    if (name.length < 1 || name.length > 32 || /[@#<>]/.test(name) || BAD_WORDS.some((w) => name.toLowerCase().includes(w))) {
      await interaction.reply({ embeds: [errorEmbed({ description: "🐀 That name won't do — 1-32 characters, no mentions." })], ephemeral: true });
      return;
    }

    const oldState = getCurrentState(interaction.guildId);
    renamePeaches(interaction.guildId, name);
    await interaction.reply({
      embeds: [successEmbed({ description: `🐀 ${oldState.name} has been renamed to **${name}** by ${interaction.user}. The rats have taken note.` })],
    });
  },

  async calm(interaction) {
    const last = calmLastUsed.get(interaction.guildId) ?? 0;
    const remaining = CALM_COOLDOWN_MS - (Date.now() - last);
    if (remaining > 0) {
      await interaction.reply({ embeds: [errorEmbed({ description: `🐀 Already calmed recently — try again in ${Math.ceil(remaining / 60000)} minutes.` })], ephemeral: true });
      return;
    }

    calmLastUsed.set(interaction.guildId, Date.now());
    resolveAllPending(interaction.guildId);
    const state = resetToContent(interaction.guildId);
    await interaction.reply({ embeds: [successEmbed({ description: `🐀 ${interaction.user} calmed ${state.name} down. Order restored.` })] });
  },
};
