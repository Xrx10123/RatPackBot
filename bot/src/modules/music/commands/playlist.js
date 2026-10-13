import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { successEmbed, errorEmbed, infoEmbed, warnEmbed } from '../../../core/embeds.js';
import { checkChannelPermissions } from '../../../core/permissions.js';
import { getLavalinkManager } from '../../../lavalink/manager.js';
import { fuzzySearch } from '../../../utils/fuzzy.js';
import { isUrl } from '../sources.js';
import { isManager } from '../../../core/permissions.js';
import { ensureConnectedPlayer, voiceConflictEmbed } from '../playerLifecycle.js';
import { escapeMarkdown } from '../../../utils/text.js';
import {
  createHoard,
  getOwnHoardByName,
  isCommunityOwned,
  listVisibleHoards,
  getHoardByName,
  renameHoard,
  deleteHoard,
  getHoardTracks,
  addTrackToHoard,
  removeTrackFromHoard,
  resolveHoardTracks,
} from '../hoards.js';

function requireOwner(interaction, hoard) {
  if (!hoard) {
    return { ok: false, embed: errorEmbed({ description: "🐀 Couldn't find a hoard by that name." }) };
  }
  if (hoard.ownerId === interaction.user.id) return { ok: true };
  // Server-owned hoards (Community Favorites, Peaches' Hoard) have no human
  // owner — without this nobody could ever prune them.
  if (isCommunityOwned(hoard) && isManager(interaction.member)) return { ok: true };
  return {
    ok: false,
    embed: errorEmbed({
      description: isCommunityOwned(hoard) ? '🐀 Only server managers can edit server-owned hoards.' : '🐀 Only the hoard owner can do that.',
    }),
  };
}

const IMPORT_MAX_TRACKS = 500;
const IMPORT_MAX_BYTES = 1024 * 1024;

function asText(value, max = 500) {
  return typeof value === 'string' ? value.slice(0, max) : null;
}

export const playlist = {
  data: new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('Manage your hoards (playlists).')
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Create a new hoard.')
        .addStringOption((o) => o.setName('name').setDescription('Hoard name').setRequired(true).setMaxLength(64))
        .addBooleanOption((o) => o.setName('public').setDescription('Visible to everyone in this server?')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a track to a hoard.')
        .addStringOption((o) => o.setName('name').setDescription('Hoard name').setRequired(true).setAutocomplete(true))
        .addStringOption((o) => o.setName('query').setDescription('Search term or URL').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a track from a hoard.')
        .addStringOption((o) => o.setName('name').setDescription('Hoard name').setRequired(true).setAutocomplete(true))
        .addStringOption((o) => o.setName('track').setDescription('Track to remove').setRequired(true).setAutocomplete(true)),
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List hoards you can see.'))
    .addSubcommand((sub) =>
      sub
        .setName('play')
        .setDescription('Load a hoard into the queue.')
        .addStringOption((o) => o.setName('name').setDescription('Hoard name').setRequired(true).setAutocomplete(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('Delete a hoard you own.')
        .addStringOption((o) => o.setName('name').setDescription('Hoard name').setRequired(true).setAutocomplete(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('rename')
        .setDescription('Rename a hoard you own.')
        .addStringOption((o) => o.setName('name').setDescription('Current name').setRequired(true).setAutocomplete(true))
        .addStringOption((o) => o.setName('new_name').setDescription('New name').setRequired(true).setMaxLength(64)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('save-current')
        .setDescription("Save the current queue as a new hoard.")
        .addStringOption((o) => o.setName('name').setDescription('Hoard name').setRequired(true).setMaxLength(64))
        .addBooleanOption((o) => o.setName('public').setDescription('Visible to everyone in this server?')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('import')
        .setDescription('Import a hoard from a JSON file.')
        .addStringOption((o) => o.setName('name').setDescription('Hoard name').setRequired(true).setMaxLength(64))
        .addAttachmentOption((o) => o.setName('file').setDescription('JSON file exported from /playlist export').setRequired(true))
        .addBooleanOption((o) => o.setName('public').setDescription('Visible to everyone in this server?')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('export')
        .setDescription('Export a hoard as a JSON file.')
        .addStringOption((o) => o.setName('name').setDescription('Hoard name').setRequired(true).setAutocomplete(true)),
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    if (focused.name === 'name') {
      const hoards = listVisibleHoards(guildId, userId);
      const matches = fuzzySearch(focused.value, hoards, { key: (h) => h.name, limit: 25 });
      await interaction.respond(matches.map((h) => ({ name: h.isPublic ? `${h.name} (public)` : h.name, value: h.name })));
      return;
    }

    if (focused.name === 'track') {
      const hoardName = interaction.options.getString('name');
      const hoard = hoardName ? getHoardByName(guildId, userId, hoardName) : null;
      if (!hoard) {
        await interaction.respond([]);
        return;
      }
      const tracks = getHoardTracks(hoard.id);
      const matches = fuzzySearch(focused.value, tracks, { key: (t) => t.title ?? '', limit: 25 });
      await interaction.respond(matches.map((t) => ({ name: `${t.title ?? 'Unknown'} — ${t.artist ?? ''}`.slice(0, 100), value: String(t.position) })));
      return;
    }

    await interaction.respond([]);
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const handler = SUBCOMMAND_HANDLERS[sub];
    await handler(interaction);
  },
};

const SUBCOMMAND_HANDLERS = {
  async create(interaction) {
    const name = interaction.options.getString('name', true);
    const isPublic = interaction.options.getBoolean('public') ?? false;

    if (getOwnHoardByName(interaction.guildId, interaction.user.id, name)) {
      await interaction.reply({ embeds: [errorEmbed({ description: `🐀 You already have a hoard named **${escapeMarkdown(name)}**.` })], ephemeral: true });
      return;
    }

    createHoard({ guildId: interaction.guildId, ownerId: interaction.user.id, name, isPublic });
    await interaction.reply({
      embeds: [successEmbed({ description: `🐀 Started hoarding into **${name}**${isPublic ? ' (public)' : ''}.` })],
      ephemeral: true,
    });
  },

  async add(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const name = interaction.options.getString('name', true);
    const query = interaction.options.getString('query', true);

    const hoard = getHoardByName(interaction.guildId, interaction.user.id, name);
    const owned = requireOwner(interaction, hoard);
    if (!owned.ok) {
      await interaction.editReply({ embeds: [owned.embed] });
      return;
    }

    const manager = getLavalinkManager();
    const node = manager.nodeManager.leastUsedNodes()[0];
    if (!node) {
      await interaction.editReply({ embeds: [errorEmbed({ description: "🐀 Lavalink isn't connected right now." })] });
      return;
    }

    const result = await node.search({ query: isUrl(query) ? query : `ytsearch:${query}` }, interaction.user);
    const track = result?.tracks?.[0];
    if (!track) {
      await interaction.editReply({ embeds: [warnEmbed({ description: "🐀 Nothing turned up for that." })] });
      return;
    }

    addTrackToHoard(hoard.id, track);
    await interaction.editReply({ embeds: [successEmbed({ description: `🐀 Added **${track.info.title}** to **${hoard.name}**.` })] });
  },

  async remove(interaction) {
    const name = interaction.options.getString('name', true);
    const position = Number(interaction.options.getString('track', true));

    const hoard = getHoardByName(interaction.guildId, interaction.user.id, name);
    const owned = requireOwner(interaction, hoard);
    if (!owned.ok) {
      await interaction.reply({ embeds: [owned.embed], ephemeral: true });
      return;
    }

    if (!Number.isInteger(position) || !removeTrackFromHoard(hoard.id, position)) {
      await interaction.reply({ embeds: [errorEmbed({ description: `🐀 Couldn't find that track in **${escapeMarkdown(hoard.name)}** — pick one from the suggestions.` })], ephemeral: true });
      return;
    }
    await interaction.reply({ embeds: [successEmbed({ description: `🐀 Removed that track from **${hoard.name}**.` })], ephemeral: true });
  },

  async list(interaction) {
    const hoards = listVisibleHoards(interaction.guildId, interaction.user.id);
    if (hoards.length === 0) {
      await interaction.reply({ embeds: [infoEmbed({ description: '🐀 No hoards yet — start one with `/playlist create`.' })], ephemeral: true });
      return;
    }

    const lines = hoards.map((h) => `${h.isPublic ? '🌐' : '🔒'} **${escapeMarkdown(h.name)}**${h.ownerId === interaction.user.id ? ' *(yours)*' : ''}`);
    let description = '';
    for (const [i, line] of lines.entries()) {
      if (description.length + line.length > 3900) {
        description += `\n…and ${lines.length - i} more`;
        break;
      }
      description += `${description ? '\n' : ''}${line}`;
    }
    await interaction.reply({ embeds: [infoEmbed({ title: '🐀 Hoards', description })], ephemeral: true });
  },

  async play(interaction) {
    const voiceChannel = interaction.member.voice?.channel;
    if (!voiceChannel) {
      await interaction.reply({ embeds: [errorEmbed({ description: '🐀 Hop into a voice channel first.' })], ephemeral: true });
      return;
    }

    const permCheck = checkChannelPermissions(voiceChannel, ['Connect', 'Speak']);
    if (!permCheck.ok) {
      await interaction.reply({ embeds: [permCheck.embed], ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString('name', true);
    const hoard = getHoardByName(interaction.guildId, interaction.user.id, name);
    if (!hoard) {
      await interaction.editReply({ embeds: [errorEmbed({ description: "🐀 Couldn't find a hoard by that name." })] });
      return;
    }

    const rows = getHoardTracks(hoard.id);
    if (rows.length === 0) {
      await interaction.editReply({ embeds: [warnEmbed({ description: `🐀 **${hoard.name}** is empty.` })] });
      return;
    }

    const { player, conflictChannelId } = await ensureConnectedPlayer(interaction.guildId, voiceChannel);
    if (!player) {
      await interaction.editReply({ embeds: [voiceConflictEmbed(conflictChannelId)] });
      return;
    }

    const tracks = await resolveHoardTracks(player, rows, interaction.user);
    if (tracks.length === 0) {
      await interaction.editReply({ embeds: [errorEmbed({ description: `🐀 Couldn't resolve any tracks from **${hoard.name}** — the links may be dead.` })] });
      return;
    }

    await player.queue.add(tracks);
    if (!player.playing && !player.paused) await player.play();

    const skipped = rows.length - tracks.length;
    await interaction.editReply({
      embeds: [
        successEmbed({
          description: `🐀 Loaded **${tracks.length} tracks** from **${hoard.name}** into the queue.${skipped > 0 ? ` (${skipped} dead link${skipped === 1 ? '' : 's'} skipped)` : ''}`,
        }),
      ],
    });
  },

  async delete(interaction) {
    const name = interaction.options.getString('name', true);
    const hoard = getHoardByName(interaction.guildId, interaction.user.id, name);
    const owned = requireOwner(interaction, hoard);
    if (!owned.ok) {
      await interaction.reply({ embeds: [owned.embed], ephemeral: true });
      return;
    }

    deleteHoard(hoard.id);
    await interaction.reply({ embeds: [successEmbed({ description: `🐀 **${hoard.name}** has been let loose.` })], ephemeral: true });
  },

  async rename(interaction) {
    const name = interaction.options.getString('name', true);
    const newName = interaction.options.getString('new_name', true);

    const hoard = getHoardByName(interaction.guildId, interaction.user.id, name);
    const owned = requireOwner(interaction, hoard);
    if (!owned.ok) {
      await interaction.reply({ embeds: [owned.embed], ephemeral: true });
      return;
    }

    if (getOwnHoardByName(interaction.guildId, hoard.ownerId, newName)) {
      await interaction.reply({ embeds: [errorEmbed({ description: `🐀 You already have a hoard named **${newName}**.` })], ephemeral: true });
      return;
    }

    renameHoard(hoard.id, newName);
    await interaction.reply({ embeds: [successEmbed({ description: `🐀 **${name}** is now **${newName}**.` })], ephemeral: true });
  },

  async 'save-current'(interaction) {
    const manager = getLavalinkManager();
    const player = manager.getPlayer(interaction.guildId);
    const upcoming = player?.queue.tracks ?? [];
    const all = player?.queue.current ? [player.queue.current, ...upcoming] : upcoming;

    if (all.length === 0) {
      await interaction.reply({ embeds: [warnEmbed({ description: "🐀 Nothing's playing or queued to save." })], ephemeral: true });
      return;
    }

    const name = interaction.options.getString('name', true);
    const isPublic = interaction.options.getBoolean('public') ?? false;

    if (getOwnHoardByName(interaction.guildId, interaction.user.id, name)) {
      await interaction.reply({ embeds: [errorEmbed({ description: `🐀 You already have a hoard named **${escapeMarkdown(name)}**.` })], ephemeral: true });
      return;
    }

    const hoard = createHoard({ guildId: interaction.guildId, ownerId: interaction.user.id, name, isPublic });
    for (const track of all) addTrackToHoard(hoard.id, track);

    await interaction.reply({
      embeds: [successEmbed({ description: `🐀 Saved **${all.length} tracks** into **${name}**${isPublic ? ' (public)' : ''}.` })],
      ephemeral: true,
    });
  },

  async import(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const name = interaction.options.getString('name', true);
    const isPublic = interaction.options.getBoolean('public') ?? false;
    const file = interaction.options.getAttachment('file', true);

    if (getOwnHoardByName(interaction.guildId, interaction.user.id, name)) {
      await interaction.editReply({ embeds: [errorEmbed({ description: `🐀 You already have a hoard named **${escapeMarkdown(name)}**.` })] });
      return;
    }

    if (file.size > IMPORT_MAX_BYTES) {
      await interaction.editReply({ embeds: [errorEmbed({ description: '🐀 That file is too big — hoard exports are well under 1 MB.' })] });
      return;
    }

    let entries;
    try {
      const res = await fetch(file.url, { signal: AbortSignal.timeout(10_000) });
      const json = await res.json();
      if (!Array.isArray(json)) throw new Error('not an array');
      entries = json;
    } catch {
      await interaction.editReply({ embeds: [errorEmbed({ description: "🐀 That file isn't valid hoard JSON." })] });
      return;
    }

    const hoard = createHoard({ guildId: interaction.guildId, ownerId: interaction.user.id, name, isPublic });
    let imported = 0;
    for (const entry of entries.slice(0, IMPORT_MAX_TRACKS)) {
      const uri = asText(entry?.uri, 2000);
      const title = asText(entry?.title);
      if (!uri && !title) continue;
      addTrackToHoard(hoard.id, {
        info: {
          title: title ?? 'Unknown',
          author: asText(entry.artist) ?? '',
          uri: uri ?? '',
          duration: Number.isFinite(entry.duration) ? entry.duration : 0,
          sourceName: asText(entry.source, 50),
        },
      });
      imported += 1;
    }

    const capped = entries.length > IMPORT_MAX_TRACKS ? ` (capped at ${IMPORT_MAX_TRACKS})` : '';
    await interaction.editReply({ embeds: [successEmbed({ description: `🐀 Imported **${imported} tracks** into **${escapeMarkdown(name)}**${capped}.` })] });
  },

  async export(interaction) {
    const name = interaction.options.getString('name', true);
    const hoard = getHoardByName(interaction.guildId, interaction.user.id, name);
    if (!hoard) {
      await interaction.reply({ embeds: [errorEmbed({ description: "🐀 Couldn't find a hoard by that name." })], ephemeral: true });
      return;
    }

    const rows = getHoardTracks(hoard.id);
    const json = JSON.stringify(
      rows.map((r) => ({ title: r.title, artist: r.artist, uri: r.uri, duration: r.duration, source: r.source })),
      null,
      2,
    );
    const attachment = new AttachmentBuilder(Buffer.from(json, 'utf8'), { name: `${hoard.name.replace(/[^\w\- ]+/g, '_').trim() || 'hoard'}.json` });

    await interaction.reply({
      embeds: [successEmbed({ description: `🐀 Here's **${hoard.name}**, ${rows.length} tracks.` })],
      files: [attachment],
      ephemeral: true,
    });
  },
};
