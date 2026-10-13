import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { successEmbed, errorEmbed } from '../../../core/embeds.js';
import { getGuildConfig } from '../../../core/guildConfig.js';
import { getActiveSeason } from '../seasons.js';
import { getCurrentState } from '../state.js';
import { getShopItem, SLOTS } from '../shop.js';
import { buyItem } from '../purchase.js';
import { setOutfit } from '../wardrobe.js';
import { buildShopPayload, buildConfirmPayload, buildWardrobePayload, purchaseAnnouncement } from '../ui/shopUi.js';

function seasonFor(guildId) {
  return getActiveSeason(new Date(), getGuildConfig(guildId)?.timezone);
}

function dressAnnouncement(user, slot, item, name) {
  if (!item) return { embeds: [successEmbed({ description: `👗 ${user} took off ${name}'s ${SLOTS[slot].label.toLowerCase()}. She looks relieved. Or offended. Hard to tell.` })] };
  return { embeds: [successEmbed({ description: `👗 ${user} dressed ${name} in her ${item.emoji} **${item.name}**. Stunning.` })] };
}

async function wear(interaction, slot, itemKey) {
  const { name } = getCurrentState(interaction.guildId);
  if (!setOutfit(interaction.guildId, slot, itemKey)) {
    await interaction.reply({ embeds: [errorEmbed({ description: "🐀 That's not in her wardrobe." })], ephemeral: true });
    return;
  }
  await interaction.update(buildWardrobePayload(interaction.guildId, name));
  await interaction.followUp(dressAnnouncement(interaction.user, slot, getShopItem(itemKey), name)).catch(() => {});
}

export const shopButtons = {
  async shop_back(interaction) {
    const { name } = getCurrentState(interaction.guildId);
    await interaction.update(buildShopPayload(interaction.guildId, interaction.user.id, seasonFor(interaction.guildId), name));
  },

  async shop_buy(interaction, itemKey) {
    const result = buyItem(interaction.guildId, interaction.user.id, itemKey, seasonFor(interaction.guildId));
    if (!result.ok) {
      await interaction.update({ embeds: [errorEmbed({ description: `🐀 ${result.error}` })], components: [backRow()] });
      return;
    }

    const { name } = result.state ?? getCurrentState(interaction.guildId);
    const { item } = result;
    const components = [backRow()];
    if (item.type === 'cosmetic') {
      components[0].addComponents(
        new ButtonBuilder().setCustomId(`peaches:wear:${item.key}`).setEmoji(item.emoji).setLabel('Put it on her now').setStyle(ButtonStyle.Primary),
      );
    }
    await interaction.update({
      embeds: [successEmbed({ description: `✅ Bought **${item.emoji} ${item.name}**. You have **${result.balance} 🧀** left.` })],
      components,
    });
    // The shop itself is private; the purchase is something to show off.
    await interaction.followUp(purchaseAnnouncement(interaction.user, item, name)).catch(() => {});
  },

  async wear(interaction, itemKey) {
    const item = getShopItem(itemKey);
    if (!item?.slot) {
      await interaction.reply({ embeds: [errorEmbed({ description: "🐀 That's not something she can wear." })], ephemeral: true });
      return;
    }
    await wear(interaction, item.slot, itemKey);
  },
};

function backRow() {
  return new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('peaches:shop_back').setLabel('Back to shop').setStyle(ButtonStyle.Secondary));
}

export const shopSelects = {
  async shop_pick(interaction) {
    const item = getShopItem(interaction.values[0]);
    if (!item) {
      await interaction.deferUpdate();
      return;
    }
    await interaction.update(buildConfirmPayload(interaction.guildId, interaction.user.id, item.key));
  },

  async wardrobe_hat(interaction) {
    const value = interaction.values[0];
    await wear(interaction, 'hat', value === 'none' ? null : value);
  },

  async wardrobe_accessory(interaction) {
    const value = interaction.values[0];
    await wear(interaction, 'accessory', value === 'none' ? null : value);
  },
};
