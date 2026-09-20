import { SlashCommandBuilder } from 'discord.js';
import { successEmbed, errorEmbed, warnEmbed } from '../../../core/embeds.js';
import { fuzzySearch } from '../../../utils/fuzzy.js';
import { checkService } from '../checkService.js';
import { listMonitors } from '../monitors.js';
import { KNOWN_SERVICES } from '../providers/statuspage.js';

const CURATED = [{ slug: 'steam', name: 'Steam' }, ...Object.entries(KNOWN_SERVICES).map(([slug, v]) => ({ slug, name: v.name }))];

function candidateList(guildId) {
  const monitored = listMonitors(guildId).map((m) => ({ slug: m.serviceSlug, name: m.serviceName }));
  const extras = CURATED.filter((c) => !monitored.some((m) => m.slug === c.slug));
  return [...monitored, ...extras];
}

export const server = {
  data: new SlashCommandBuilder()
    .setName('server')
    .setDescription("Check if a game or service's servers are up.")
    .addStringOption((opt) => opt.setName('game').setDescription('Game or service name').setRequired(true).setAutocomplete(true)),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const matches = fuzzySearch(focused, candidateList(interaction.guildId), { key: (s) => s.name, limit: 25 });
    await interaction.respond(matches.map((s) => ({ name: s.name, value: s.slug })));
  },

  async execute(interaction) {
    await interaction.deferReply();
    const slug = interaction.options.getString('game', true);

    try {
      const result = await checkService(slug);
      const up = result.indicator === 'none';
      const embed = up
        ? successEmbed({ description: `🟢 **${result.name}** servers are up.${result.description ? ` ${result.description}` : ''}` })
        : errorEmbed({ description: `🔴 **${result.name}** — ${result.description ?? 'issues reported'}.` });
      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply({
        embeds: [warnEmbed({ description: "🐀 Don't know how to check that one yet — try `/outage add` if it's on Statuspage, or `/outage search`." })],
      });
    }
  },
};
