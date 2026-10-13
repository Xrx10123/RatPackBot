import { test } from 'node:test';
import assert from 'node:assert/strict';
import { earn, spend, reward, getWallet, getRichest, CHEESE_REWARDS, earnedSuffix } from '../src/modules/peaches/economy.js';
import { SHOP_ITEMS, itemsForSale, purchaseBlocker, getShopItem } from '../src/modules/peaches/shop.js';
import { buyItem } from '../src/modules/peaches/purchase.js';
import { getWardrobe, setOutfit, getOutfit, outfitLine, outfitEmojis } from '../src/modules/peaches/wardrobe.js';
import { ensureState, getCurrentState } from '../src/modules/peaches/state.js';
import { buildShopPayload, buildConfirmPayload, buildWardrobePayload, purchaseAnnouncement } from '../src/modules/peaches/ui/shopUi.js';
import { shopButtons, shopSelects } from '../src/modules/peaches/handlers/shopButtons.js';
import { pet } from '../src/modules/peaches/commands/pet.js';

function assertSendable(payload) {
  for (const row of payload.components ?? []) row.toJSON();
  for (const embed of payload.embeds ?? []) assert.ok(embed.toJSON().description?.length <= 4096);
}

test('earning accumulates balance and lifetime; spending never overdraws', () => {
  earn('g-eco', 'u', 10);
  assert.equal(reward('g-eco', 'u', 'play', 2), CHEESE_REWARDS.play * 2);
  assert.equal(getWallet('g-eco', 'u').cheese, 18);
  assert.equal(spend('g-eco', 'u', 19), false);
  assert.equal(spend('g-eco', 'u', 18), true);
  assert.deepEqual({ ...getWallet('g-eco', 'u') }, { guildId: 'g-eco', userId: 'u', cheese: 0, lifetime: 18 });
  assert.equal(earn('g-eco', 'u', -5), 0, 'never negative');
  assert.equal(getWallet('g-eco', 'nobody').cheese, 0);
  assert.equal(earnedSuffix(0), '');
  assert.match(earnedSuffix(3), /\+3 🧀/);
});

test('richest list is per guild and ranked by lifetime earnings', () => {
  earn('g-rich', 'a', 5);
  earn('g-rich', 'b', 50);
  spend('g-rich', 'b', 50); // spending doesn't lower lifetime
  assert.deepEqual(getRichest('g-rich').map((w) => w.userId), ['b', 'a']);
});

test('catalog: unique keys, sane prices, cosmetics have slots, treats have effects', () => {
  assert.equal(new Set(SHOP_ITEMS.map((i) => i.key)).size, SHOP_ITEMS.length);
  for (const item of SHOP_ITEMS) {
    assert.ok(item.price > 0, item.key);
    if (item.type === 'cosmetic') assert.ok(['hat', 'accessory'].includes(item.slot), item.key);
    else assert.ok(Object.keys(item.effects).length > 0, item.key);
    assert.ok(`peaches:shop_buy:${item.key}`.length <= 100);
  }
  assert.ok(!itemsForSale(null).some((i) => i.season));
  assert.ok(itemsForSale('halloween').some((i) => i.season === 'halloween'));
});

test('purchaseBlocker explains why', () => {
  const hat = getShopItem('top_hat');
  assert.equal(purchaseBlocker(hat, { season: null, owned: new Set(), balance: 1000 }), null);
  assert.match(purchaseBlocker(hat, { season: null, owned: new Set(['top_hat']), balance: 1000 }), /already/);
  assert.match(purchaseBlocker(hat, { season: null, owned: new Set(), balance: 1 }), /need/i);
  assert.match(purchaseBlocker(getShopItem('pumpkin_hat'), { season: null, owned: new Set(), balance: 1000 }), /season/);
  assert.match(purchaseBlocker(null, { season: null, owned: new Set(), balance: 1000 }), /shelf/);
});

test('buying a treat charges and boosts her stats', () => {
  ensureState('g-buy');
  earn('g-buy', 'buyer', 100);
  const before = getCurrentState('g-buy').happiness;
  const result = buyItem('g-buy', 'buyer', 'squeaky_toy', null);
  assert.equal(result.ok, true);
  assert.equal(result.balance, 80);
  assert.ok(result.state.happiness >= Math.min(100, before + 25) - 0.5);
});

test('a cosmetic can only be bought once per server, and failures cost nothing', () => {
  ensureState('g-hat');
  earn('g-hat', 'a', 200);
  earn('g-hat', 'b', 200);
  assert.equal(buyItem('g-hat', 'a', 'top_hat', null).ok, true);
  const second = buyItem('g-hat', 'b', 'top_hat', null);
  assert.equal(second.ok, false);
  assert.equal(getWallet('g-hat', 'b').cheese, 200, 'not charged');
  assert.equal(getWardrobe('g-hat').get('top_hat').boughtBy, 'a');

  const poor = buyItem('g-hat', 'broke', 'gold_crown', null);
  assert.equal(poor.ok, false);
  assert.equal(buyItem('g-hat', 'a', 'pumpkin_hat', null).ok, false, 'out of season');
  assert.equal(buyItem('g-hat', 'a', 'pumpkin_hat', 'halloween').ok, true, 'in season');
});

test('wardrobe: only owned items in the right slot can be worn', () => {
  ensureState('g-dress');
  earn('g-dress', 'a', 500);
  buyItem('g-dress', 'a', 'bow_tie', null);
  assert.equal(setOutfit('g-dress', 'hat', 'top_hat'), false, 'not owned');
  assert.equal(setOutfit('g-dress', 'hat', 'bow_tie'), false, 'wrong slot');
  assert.equal(outfitLine('g-dress'), null);
  assert.equal(setOutfit('g-dress', 'accessory', 'bow_tie'), true);
  assert.equal(getOutfit('g-dress').accessory.key, 'bow_tie');
  assert.match(outfitLine('g-dress'), /Bow Tie/);
  assert.equal(outfitEmojis('g-dress'), '🎀');
  assert.equal(setOutfit('g-dress', 'accessory', null), true);
  assert.equal(outfitLine('g-dress'), null);
});

test('shop, confirm, wardrobe and announcement payloads are valid Discord messages', () => {
  ensureState('g-ui');
  earn('g-ui', 'a', 1000);
  for (const season of [null, 'halloween']) assertSendable(buildShopPayload('g-ui', 'a', season));
  assertSendable(buildConfirmPayload('g-ui', 'a', 'gold_crown'));
  assertSendable(buildConfirmPayload('g-ui', 'poor', 'gold_crown'));
  assertSendable(buildWardrobePayload('g-ui'));
  for (const key of ['top_hat', 'flower_crown', 'bow_tie', 'hero_cape']) buyItem('g-ui', 'a', key, null);
  setOutfit('g-ui', 'hat', 'top_hat');
  const wardrobe = buildWardrobePayload('g-ui');
  assertSendable(wardrobe);
  assert.equal(wardrobe.components.length, 2);
  assertSendable(purchaseAnnouncement('<@a>', getShopItem('cheese_board'), 'Peaches'));

  // Once every cosmetic is owned, the menu still only offers treats.
  const shop = buildShopPayload('g-ui', 'a', null).components[0].toJSON();
  assert.ok(!shop.components[0].options.some((o) => o.value === 'top_hat'));
});

test('buy button flow: success announces publicly, failure stays private', async () => {
  ensureState('g-flow');
  earn('g-flow', 'shopper', 60);
  const calls = [];
  const interaction = (userId) => ({
    guildId: 'g-flow',
    user: { id: userId, toString: () => `<@${userId}>` },
    update: async (p) => calls.push(['update', p]),
    followUp: async (p) => calls.push(['followUp', p]),
    reply: async (p) => calls.push(['reply', p]),
  });
  await shopButtons.shop_buy(interaction('shopper'), 'party_hat');
  assert.deepEqual(calls.map((c) => c[0]), ['update', 'followUp']);
  assert.match(calls[1][1].embeds[0].data.description, /Party Hat/);

  calls.length = 0;
  await shopButtons.shop_buy(interaction('shopper'), 'gold_crown');
  assert.deepEqual(calls.map((c) => c[0]), ['update'], 'no public post on failure');

  calls.length = 0;
  await shopSelects.wardrobe_hat({ ...interaction('someone'), values: ['party_hat'] });
  assert.deepEqual(calls.map((c) => c[0]), ['update', 'followUp']);
  assert.equal(getOutfit('g-flow').hat.key, 'party_hat');
});

test('/pet command definition stays under Discord\'s size limits', () => {
  const json = pet.data.toJSON();
  assert.ok(json.options.length <= 25);
  assert.ok(JSON.stringify(json).length < 8000);
});

import { spawnButtons } from '../src/modules/peaches/handlers/spawnButtons.js';
import { createSpawn } from '../src/modules/peaches/spawns.js';

test('caring for a Queen Peaches spawn pays double cheese and says so', async () => {
  ensureState('g-care');
  const spawn = createSpawn({ guildId: 'g-care', channelId: 'c', variant: 'queen', expiresInMs: 60_000 });
  const replies = [];
  await spawnButtons.feed(
    {
      guildId: 'g-care',
      user: { id: 'carer', toString: () => '<@carer>' },
      reply: async (p) => replies.push(p),
      followUp: async () => {},
      message: { edit: async () => {} },
    },
    spawn.id,
  );
  assert.equal(getWallet('g-care', 'carer').cheese, CHEESE_REWARDS.feed * 2);
  assert.match(replies[0].embeds[0].data.description, /\+6 🧀/);
});
