import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { peachesInteractions } from '../../../db/schema.js';
import { successEmbed, infoEmbed, errorEmbed } from '../../../core/embeds.js';
import { getGuildConfig } from '../../../core/guildConfig.js';
import { getSpawnById } from '../spawns.js';
import { getCurrentState, nudgeStats } from '../state.js';
import { getActiveSeason } from '../seasons.js';
import { maybeFindSomething, giveItem, hasItemSince, foundLine, getItem } from '../collectibles.js';
import { pickLine } from '../variants.js';
import { getBirthdayInfo } from '../birthday.js';
import { reward, earnedSuffix } from '../economy.js';

const TREAT_CHANCE = 0.6;
const TREAT_ITEM_CHANCE = 0.45;

const TREATS = [
  (name) => `🍬 ${name} rummages in her pumpkin pail and hands you a fun-size candy bar. It's a little chewed.`,
  (name) => `🍫 ${name} gives you a chocolate coin and a long, meaningful stare.`,
  (name) => `🍭 ${name} shares her lollipop. Generous! Slightly sticky.`,
];

// Tricks are harmless pranks — the economy is cozy, nobody loses anything.
const TRICKS = [
  (name) => `🕷️ ${name} drops a plastic spider down your shirt and scurries off cackling.`,
  (name) => `🧻 ${name} has toilet-papered your profile picture. Metaphorically.`,
  (name) => `👻 ${name} hides under a sheet and yells BOO. You jump. She will be telling everyone.`,
  (name) => `🥚 ${name} swapped your candy for a single raisin. Respect the hustle.`,
];

function alreadyKnocked(spawnId, userId, action) {
  return Boolean(
    db
      .select({ id: peachesInteractions.id })
      .from(peachesInteractions)
      .where(and(eq(peachesInteractions.spawnId, spawnId), eq(peachesInteractions.userId, userId), eq(peachesInteractions.action, action)))
      .get(),
  );
}

const GIFTS = [
  (name) => `🍫 ${name} hands you a present wrapped in newspaper. It's hot cocoa mix. She's very proud.`,
  (name) => `🧦 ${name} gives you a tiny pair of socks. She knitted them. They fit nobody. You love them.`,
  (name) => `🍪 ${name} unwraps a gingerbread rat for you. She's already eaten the ears.`,
];

// Coal is a joke, not a loss — nobody's cheese is touched.
const COAL = [
  (name) => `⚫ ${name} hands you a lump of coal, then breaks into giggles. It's a chocolate. Mostly.`,
  (name) => `🧊 ${name} gives you a box. It's full of snow. She thinks this is hilarious.`,
  (name) => `🎀 ${name} wrapped the box so well that neither of you can open it. You both stare at it.`,
];

/**
 * One knock per person per visit on the season's spawn button. A good
 * outcome cheers her up, pays a little cheese and may come with a seasonal
 * collectible; a prank outcome is just a laugh.
 */
const SEASONAL_KNOCKS = {
  trickortreat: {
    season: 'halloween',
    goodTitle: (u) => `🍬 Treat for ${u}!`,
    good: TREATS,
    badTitle: () => '🕸️ Trick!',
    bad: TRICKS,
    gone: "🐀 She's already scurried off with her candy.",
    repeat: '🎃 You already knocked. Greedy. She remembers faces.',
  },
  unwrap: {
    season: 'winter',
    goodTitle: (u) => `🎁 A present for ${u}!`,
    good: GIFTS,
    badTitle: () => '⚫ Coal?!',
    bad: COAL,
    gone: "🐀 She's scampered back into the snow with the presents.",
    repeat: "🎁 You've already unwrapped yours. She's watching you very closely.",
  },
};

async function seasonalKnock(interaction, spawnId, action) {
  const knock = SEASONAL_KNOCKS[action];
  const spawn = getSpawnById(spawnId);
  if (!spawn || spawn.resolved || Date.now() > spawn.expiresAt) {
    await interaction.reply({ embeds: [errorEmbed({ description: knock.gone })], ephemeral: true });
    return;
  }
  if (alreadyKnocked(spawnId, interaction.user.id, action)) {
    await interaction.reply({ embeds: [infoEmbed({ description: knock.repeat })], ephemeral: true });
    return;
  }

  db.insert(peachesInteractions).values({ id: randomUUID(), spawnId, userId: interaction.user.id, action, createdAt: Date.now() }).run();
  const state = getCurrentState(interaction.guildId);
  const season = getActiveSeason(new Date(), getGuildConfig(interaction.guildId)?.timezone) ?? knock.season;

  if (Math.random() < TREAT_CHANCE) {
    nudgeStats(interaction.guildId, { happiness: 5 });
    const earned = reward(interaction.guildId, interaction.user.id, 'treat');
    const lines = [`${pickLine(knock.good)(state.name)}${earnedSuffix(earned)}`];
    const item = maybeFindSomething(interaction.guildId, interaction.user.id, { chance: TREAT_ITEM_CHANCE, season, onlySeasonal: true });
    if (item) lines.push('', foundLine(state.name, interaction.user, item));
    await interaction.reply({ embeds: [successEmbed({ title: knock.goodTitle(interaction.user.displayName), description: lines.join('\n') })] });
    return;
  }

  nudgeStats(interaction.guildId, { happiness: 3 }); // the prank cheered her up
  await interaction.reply({ embeds: [infoEmbed({ title: knock.badTitle(), description: `${pickLine(knock.bad)(state.name)}\n-# ${interaction.user}` })] });
}

export const eventButtons = {
  trickortreat: (interaction, spawnId) => seasonalKnock(interaction, spawnId, 'trickortreat'),
  unwrap: (interaction, spawnId) => seasonalKnock(interaction, spawnId, 'unwrap'),

  /** On the birthday post: everyone can grab one slice of cake per birthday. */
  async birthday_cake(interaction) {
    const info = getBirthdayInfo(interaction.guildId);
    if (!info?.isToday) {
      await interaction.reply({ embeds: [infoEmbed({ description: '🍰 The cake is gone. There are only crumbs and a very full rat.' })], ephemeral: true });
      return;
    }
    // "Today" can be measured against a local-midnight timestamp, but a day's
    // grace is plenty to stop double-dipping without timezone gymnastics.
    if (hasItemSince(interaction.guildId, interaction.user.id, 'cake_slice', Date.now() - 36 * 60 * 60 * 1000)) {
      await interaction.reply({ embeds: [infoEmbed({ description: '🍰 You already have a slice. She counted.' })], ephemeral: true });
      return;
    }
    giveItem(interaction.guildId, interaction.user.id, 'cake_slice');
    const earned = reward(interaction.guildId, interaction.user.id, 'cake');
    const state = nudgeStats(interaction.guildId, { happiness: 10 });
    const item = getItem('cake_slice');
    await interaction.reply({
      embeds: [successEmbed({ description: `${item.emoji} ${interaction.user} grabbed a slice of ${state.name}'s birthday cake and wished her a happy birthday! It's in your \`/pet album\` now.${earnedSuffix(earned)}` })],
    });
  },
};
