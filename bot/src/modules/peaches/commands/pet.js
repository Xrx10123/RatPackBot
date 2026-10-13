import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { successEmbed, errorEmbed, infoEmbed, warnEmbed } from '../../../core/embeds.js';
import { MOOD_DISPLAY, pickLine } from '../variants.js';
import { getCurrentState, renamePeaches, getRenameCooldownRemaining, resetToContent, syncLevel } from '../state.js';
import { levelProgress, titleForLevel, statBar, QUIET_START_HOUR, QUIET_END_HOUR } from '../progression.js';
import { getUserStats, getLeaderboard } from '../stats.js';
import { getSpawnChannelIds, setSpawnChannelIds, updatePeachesConfig, ensurePeachesConfig, isSleepingNow } from '../config.js';
import { resolveAllPending } from '../mischiefStore.js';
import { spawnNow } from '../spawner.js';
import { getMediaForMoment, applyMedia } from '../media.js';
import { SEASONS, getActiveSeason } from '../seasons.js';
import { getBirthdayInfo, birthdayStatusLine, ensureBirthday } from '../birthday.js';
import { ITEMS, RARITY, getAlbum, getServerFoundKeys } from '../collectibles.js';
import { getGuildConfig } from '../../../core/guildConfig.js';
import { getWallet, getRichest } from '../economy.js';
import { outfitLine, outfitEmojis } from '../wardrobe.js';
import { buildShopPayload, buildWardrobePayload } from '../ui/shopUi.js';
import { startHideAndSeek, guessHideAndSeek, startTrivia, startRaceLobby } from '../games/index.js';
import { audit } from '../../../core/guildLog.js';

const LEADERBOARD_CATEGORIES = [
  { name: 'Cheese Fed', value: 'cheeseFed' },
  { name: 'Turds Cleaned', value: 'turdsCleaned' },
  { name: 'Holes Investigated', value: 'holesInvestigated' },
  { name: 'Walls Knocked', value: 'wallsKnocked' },
  { name: 'Fealty Pledged', value: 'fealtyPledged' },
  { name: 'Cheese Earned (all-time)', value: 'cheeseLifetime' },
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
        .addBooleanOption((o) => o.setName('escalation_enabled').setDescription('Allow the neglect escalation ladder'))
        .addBooleanOption((o) => o.setName('quiet_hours').setDescription(`No spawns/mischief ${QUIET_START_HOUR}:00–${QUIET_END_HOUR}:00 server time (set in /setup)`)),
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
    .addSubcommand((sub) =>
      sub
        .setName('chat')
        .setDescription('Let her react to chat (cheese, her name, goodnight…) — server-wide or per channel.')
        .addBooleanOption((o) => o.setName('enabled').setDescription('On or off').setRequired(true))
        .addChannelOption((o) => o.setName('channel').setDescription('Just this channel (default: the whole server)').addChannelTypes(ChannelType.GuildText)),
    )
    .addSubcommand((sub) => sub.setName('hideandseek').setDescription('She hides in a channel — first to /pet find her wins cheese.'))
    .addSubcommand((sub) => sub.setName('find').setDescription('Look for her in THIS channel (hide-and-seek).'))
    .addSubcommand((sub) => sub.setName('trivia').setDescription('A rat & cheese trivia question — first right answer wins.'))
    .addSubcommand((sub) => sub.setName('race').setDescription('Start a rat race — pick a racer, win cheese.'))
    .addSubcommand((sub) => sub.setName('shop').setDescription('Spend your cheese on treats and outfits for her.'))
    .addSubcommand((sub) => sub.setName('wardrobe').setDescription('Dress her in something from the shared wardrobe.'))
    .addSubcommand((sub) =>
      sub
        .setName('wallet')
        .setDescription('How much cheese you (or someone) have.')
        .addUserOption((o) => o.setName('user').setDescription('Whose wallet (default: you)')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('album')
        .setDescription('Everything Peaches has found and given you.')
        .addUserOption((o) => o.setName('user').setDescription('Whose album (default: you)')),
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
    if (interaction.guild) ensureBirthday(interaction.guild);
    const state = getCurrentState(interaction.guildId);
    const seasonKey = getActiveSeason(new Date(), getGuildConfig(interaction.guildId)?.timezone);
    const { xp } = syncLevel(interaction.guildId);
    const { level, into, needed } = levelProgress(xp);
    const mood = MOOD_DISPLAY[state.mood] ?? MOOD_DISPLAY.content;
    const meter = (emoji, label, value) => `${emoji} \`${statBar(value)}\` ${label} ${Math.round(value)}`;

    const lines = [
      `${state.name} ${pickLine(mood.flavor)}`,
      '',
      `⭐ Level **${level}** — *${titleForLevel(level)}*`,
      needed > 0 ? `\`${statBar((into / needed) * 100)}\` ${into}/${needed} XP to level ${level + 1}` : '👑 Max level. There is nothing left to prove.',
      '',
      meter('🧀', 'Hunger', state.hunger),
      meter('💧', 'Thirst', state.thirst),
      meter('🎾', 'Happiness', state.happiness),
      meter('😴', 'Energy', state.energy),
      meter('🧼', 'Cleanliness', state.cleanliness),
      '',
      `Mood: **${mood.label}**${isSleepingNow(interaction.guildId) ? ' · 💤 asleep for the night' : ''}`,
      outfitLine(interaction.guildId),
      birthdayStatusLine(getBirthdayInfo(interaction.guildId)),
      seasonKey ? SEASONS[seasonKey].statusLine : null,
    ].filter((line) => line !== null);

    const payload = {
      embeds: [
        successEmbed({
          title: `${seasonKey ? `${SEASONS[seasonKey].emoji} ` : ''}${mood.emoji} ${state.name} ${outfitEmojis(interaction.guildId)}`.trim(),
          description: lines.join('\n'),
        }),
      ],
    };
    const mediaKey = seasonKey && Math.random() < 0.5 ? SEASONS[seasonKey].media : state.mood;
    await interaction.reply(await applyMedia(payload, getMediaForMoment(mediaKey)));
  },

  async album(interaction) {
    const user = interaction.options.getUser('user') ?? interaction.user;
    const album = getAlbum(interaction.guildId, user.id);
    const serverFound = getServerFoundKeys(interaction.guildId);
    const seasonKey = getActiveSeason(new Date(), getGuildConfig(interaction.guildId)?.timezone);
    const state = getCurrentState(interaction.guildId);

    const sections = Object.entries(RARITY)
      .reverse()
      .map(([rarity, meta]) => {
        const entries = ITEMS.filter((item) => item.rarity === rarity).map((item) => {
          const count = album.get(item.key);
          if (count) return `${item.emoji} ${item.name}${count > 1 ? ` ×${count}` : ''}`;
          const hint = item.season ? ` *(${item.season === 'birthday' ? 'her birthday' : SEASONS[item.season]?.label ?? item.season}${item.season === seasonKey ? ' — now!' : ' only'})*` : '';
          return `❔ ???${hint}`;
        });
        return `${meta.emoji} **${meta.label}**\n${entries.join(' · ')}`;
      });

    const owned = ITEMS.filter((item) => album.has(item.key)).length;
    const embed = infoEmbed({
      title: `🗃️ ${user.displayName}'s Album — ${owned}/${ITEMS.length}`,
      description: [
        owned === 0 ? `${state.name} hasn't given ${user.id === interaction.user.id ? 'you' : 'them'} anything yet. Keep looking after her — she drops things for her favourite people.` : null,
        ...sections,
      ]
        .filter(Boolean)
        .join('\n\n'),
    });
    embed.setFooter({ text: `🐀 The whole server has found ${serverFound.size}/${ITEMS.length} different things` });
    await interaction.reply({ embeds: [embed] });
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

  async chat(interaction) {
    if (!(await requireAdmin(interaction))) return;
    const enabled = interaction.options.getBoolean('enabled', true);
    const channel = interaction.options.getChannel('channel');
    const config = ensurePeachesConfig(interaction.guildId);

    if (channel) {
      const muted = new Set((config.chatMutedChannels ?? '').split(',').filter(Boolean));
      if (enabled) muted.delete(channel.id);
      else muted.add(channel.id);
      updatePeachesConfig(interaction.guildId, { chatMutedChannels: [...muted].join(',') || null });
      audit(interaction, `${enabled ? 'unmuted' : 'muted'} Peaches' chat reactions in <#${channel.id}>.`);
      const note = enabled && config.chatReactions === 0 ? ' (They\'re still off server-wide — run `/pet chat enabled:True` to turn them back on.)' : '';
      await interaction.reply({ embeds: [successEmbed({ description: `🐀 She'll ${enabled ? 'chime in' : 'stay quiet'} in <#${channel.id}>.${note}` })], ephemeral: true });
      return;
    }

    updatePeachesConfig(interaction.guildId, { chatReactions: enabled ? 1 : 0 });
    audit(interaction, `turned Peaches' chat reactions **${enabled ? 'on' : 'off'}** server-wide.`);
    const intentNote =
      enabled && !interaction.client.ratpack?.messageContent
        ? '\n-# The Message Content intent is off in the Developer Portal, so for now she only answers @mentions and replies to her.'
        : '';
    await interaction.reply({ embeds: [successEmbed({ description: `🐀 Chat reactions are **${enabled ? 'on' : 'off'}** across the server.${intentNote}` })], ephemeral: true });
  },

  hideandseek: startHideAndSeek,
  find: guessHideAndSeek,
  trivia: startTrivia,
  race: startRaceLobby,

  async shop(interaction) {
    const { name } = getCurrentState(interaction.guildId);
    const season = getActiveSeason(new Date(), getGuildConfig(interaction.guildId)?.timezone);
    await interaction.reply({ ...buildShopPayload(interaction.guildId, interaction.user.id, season, name), ephemeral: true });
  },

  async wardrobe(interaction) {
    const { name } = getCurrentState(interaction.guildId);
    await interaction.reply({ ...buildWardrobePayload(interaction.guildId, name), ephemeral: true });
  },

  async wallet(interaction) {
    const user = interaction.options.getUser('user') ?? interaction.user;
    const wallet = getWallet(interaction.guildId, user.id);
    const you = user.id === interaction.user.id;
    await interaction.reply({
      embeds: [
        infoEmbed({
          title: `🧀 ${user.displayName}'s Cheese`,
          description: [
            `**${wallet.cheese} 🧀** to spend`,
            `${wallet.lifetime} 🧀 earned all-time`,
            '',
            you ? 'Spend it in `/pet shop`. Earn more by looking after her and cleaning up her messes.' : null,
          ]
            .filter((l) => l !== null)
            .join('\n'),
        }),
      ],
      ephemeral: true,
    });
  },

  async leaderboard(interaction) {
    const category = interaction.options.getString('category') ?? 'cheeseFed';
    const label = LEADERBOARD_CATEGORIES.find((c) => c.value === category)?.name ?? 'Cheese Fed';
    const rows =
      category === 'cheeseLifetime'
        ? getRichest(interaction.guildId, 10).map((w) => ({ userId: w.userId, cheeseLifetime: `${w.lifetime} 🧀` }))
        : getLeaderboard(interaction.guildId, category, 10);

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
      audit(interaction, `let Peaches appear in <#${channel.id}>.`);
      await interaction.reply({ embeds: [successEmbed({ description: `🐀 Peaches may now appear in <#${channel.id}>.` })], ephemeral: true });
      return;
    }

    setSpawnChannelIds(interaction.guildId, current.filter((id) => id !== channel.id));
    audit(interaction, `removed <#${channel.id}> from Peaches' spawn channels.`);
    await interaction.reply({ embeds: [successEmbed({ description: `🐀 Removed <#${channel.id}> from spawn channels.` })], ephemeral: true });
  },

  async config(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const patch = {};
    const frequency = interaction.options.getString('mischief_frequency');
    const escalation = interaction.options.getBoolean('escalation_enabled');
    const quietHours = interaction.options.getBoolean('quiet_hours');
    if (frequency) patch.mischiefFrequency = frequency;
    if (escalation !== null) patch.escalationEnabled = escalation ? 1 : 0;
    if (quietHours !== null) patch.quietHours = quietHours ? 1 : 0;

    if (Object.keys(patch).length === 0) {
      const config = ensurePeachesConfig(interaction.guildId);
      await interaction.reply({
        embeds: [
          infoEmbed({
            description: `🐀 Mischief frequency: **${config.mischiefFrequency}** · Escalation: **${config.escalationEnabled ? 'on' : 'off'}** · Quiet hours: **${config.quietHours === 0 ? 'off' : 'on'}**`,
          }),
        ],
        ephemeral: true,
      });
      return;
    }

    updatePeachesConfig(interaction.guildId, patch);
    audit(interaction, `changed Peaches settings: ${Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(', ')}.`);
    await interaction.reply({ embeds: [successEmbed({ description: '🐀 Updated.' })], ephemeral: true });
  },

  async mischief(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const toggle = interaction.options.getString('toggle', true);
    const enabled = interaction.options.getBoolean('enabled', true);
    updatePeachesConfig(interaction.guildId, { [toggle]: enabled ? 1 : 0 });
    audit(interaction, `turned Peaches' **${toggle}** ${enabled ? 'on' : 'off'}.`);
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
    audit(interaction, `renamed ${oldState.name} to **${name}**.`);
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
