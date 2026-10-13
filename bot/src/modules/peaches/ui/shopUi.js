import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { infoEmbed, successEmbed } from '../../../core/embeds.js';
import { getWallet } from '../economy.js';
import { SHOP_ITEMS, SLOTS, itemsForSale, describeEffects, getShopItem } from '../shop.js';
import { getWardrobe, getOutfit } from '../wardrobe.js';
import { SEASONS } from '../seasons.js';
import { componentText } from '../../../utils/text.js';

function itemLine(item, owned) {
  const tag = item.season ? ` ${SEASONS[item.season]?.emoji ?? ''}` : '';
  if (item.type === 'treat') return `${item.emoji} **${item.name}** — ${item.price} 🧀 · ${describeEffects(item.effects)}${tag}`;
  return `${item.emoji} **${item.name}** — ${owned ? '✅ in her wardrobe' : `${item.price} 🧀`}${tag}`;
}

export function buildShopPayload(guildId, userId, season, name = 'Peaches') {
  const balance = getWallet(guildId, userId).cheese;
  const owned = new Set(getWardrobe(guildId).keys());
  const forSale = itemsForSale(season);

  const section = (title, items) => `**${title}**\n${items.map((i) => itemLine(i, owned.has(i.key))).join('\n')}`;
  const description = [
    `You have **${balance} 🧀**. Earn more by looking after ${name}.`,
    '',
    section('🍽️ Treats — used right away', forSale.filter((i) => i.type === 'treat')),
    '',
    section('🎩 Hats', forSale.filter((i) => i.slot === 'hat')),
    '',
    section('🎀 Accessories', forSale.filter((i) => i.slot === 'accessory')),
    season ? `\n${SEASONS[season].emoji} = ${SEASONS[season].label} only — gone after the season!` : '',
    '',
    '-# Cosmetics go into the shared wardrobe — anyone can dress her with `/pet wardrobe`.',
  ].join('\n');

  const buyable = forSale.filter((i) => !(i.type === 'cosmetic' && owned.has(i.key)));
  const components = buyable.length
    ? [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('peaches:shop_pick')
            .setPlaceholder('Pick something to buy…')
            .addOptions(
              buyable.slice(0, 25).map((i) => ({
                label: componentText(`${i.name} — ${i.price} 🧀`),
                description: componentText(i.type === 'treat' ? describeEffects(i.effects) : `${SLOTS[i.slot].label} · ${i.blurb}`),
                emoji: i.emoji,
                value: i.key,
              })),
            ),
        ),
      ]
    : [];

  return { embeds: [infoEmbed({ title: `🧀 ${name}'s Cheese Shop`, description })], components };
}

export function buildConfirmPayload(guildId, userId, itemKey) {
  const item = getShopItem(itemKey);
  const balance = getWallet(guildId, userId).cheese;
  const affordable = balance >= item.price;
  const detail = item.type === 'treat' ? `Treat · ${describeEffects(item.effects)}` : `${SLOTS[item.slot].label} for her wardrobe`;
  const embed = infoEmbed({
    title: `${item.emoji} ${item.name}`,
    description: [`> ${item.blurb}`, '', detail, '', `Price: **${item.price} 🧀** · You have **${balance} 🧀**`].join('\n'),
  });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`peaches:shop_buy:${item.key}`)
      .setLabel(affordable ? `Buy for ${item.price} 🧀` : `Need ${item.price - balance} more 🧀`)
      .setStyle(ButtonStyle.Success)
      .setDisabled(!affordable),
    new ButtonBuilder().setCustomId('peaches:shop_back').setLabel('Back to shop').setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [row] };
}

export function buildWardrobePayload(guildId, name = 'Peaches') {
  const wardrobe = getWardrobe(guildId);
  const outfit = getOutfit(guildId);
  const owned = SHOP_ITEMS.filter((i) => i.type === 'cosmetic' && wardrobe.has(i.key));

  const lines = Object.entries(SLOTS).map(([slot, meta]) => {
    const worn = outfit[slot];
    return `**${meta.label}:** ${worn ? `${worn.emoji} ${worn.name}` : '*nothing*'}`;
  });
  const collection = owned.length
    ? owned.map((i) => `${i.emoji} ${i.name} — <@${wardrobe.get(i.key).boughtBy}>`).join('\n')
    : `*Empty! Buy her something in \`/pet shop\`.*`;

  const embed = infoEmbed({
    title: `👗 ${name}'s Wardrobe`,
    description: [...lines, '', '**In the wardrobe** (and who gave it)', collection].join('\n'),
  });

  const components = Object.entries(SLOTS)
    .map(([slot, meta]) => {
      const items = owned.filter((i) => i.slot === slot);
      if (items.length === 0) return null;
      return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`peaches:wardrobe_${slot}`)
          .setPlaceholder(`Choose her ${meta.label.toLowerCase()}…`)
          .addOptions([
            { label: `No ${meta.label.toLowerCase()}`, value: 'none', emoji: '🚫', default: !outfit[slot] },
            ...items.slice(0, 24).map((i) => ({ label: componentText(i.name), value: i.key, emoji: i.emoji, default: outfit[slot]?.key === i.key })),
          ]),
      );
    })
    .filter(Boolean);

  return { embeds: [embed], components };
}

export function purchaseAnnouncement(user, item, name) {
  const text =
    item.type === 'treat'
      ? `${item.emoji} ${user} treated ${name} to a **${item.name}**! ${describeEffects(item.effects)}`
      : `${item.emoji} ${user} bought ${name} a **${item.name}**! It's in her wardrobe — try it on with \`/pet wardrobe\`.`;
  return { embeds: [successEmbed({ description: text })] };
}
