import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSteamPrices, parseEpicFreeGames, pickSteamMatch } from '../src/modules/gamenight/storefronts.js';
import { decideDeal, dealTick, freeGameTick, MIN_DISCOUNT } from '../src/modules/gamenight/deals.js';
import { addGame, setSteamLink, getGame } from '../src/modules/gamenight/store.js';
import { updateGuildConfig } from '../src/core/guildConfig.js';

test('parseSteamPrices: sale, full price, free/missing and junk', () => {
  const prices = parseSteamPrices({
    1966720: { success: true, data: { price_overview: { currency: 'USD', initial: 999, final: 599, discount_percent: 40, initial_formatted: '$9.99', final_formatted: '$5.99' } } },
    413150: { success: true, data: { price_overview: { currency: 'USD', initial: 1499, final: 1499, discount_percent: 0, initial_formatted: '', final_formatted: '$14.99' } } },
    570: { success: true, data: [] }, // free-to-play: no price_overview
    1: { success: false },
    2: null,
  });
  assert.deepEqual(Object.keys(prices).sort(), ['1966720', '413150']);
  assert.equal(prices['1966720'].percent, 40);
  assert.equal(prices['1966720'].finalFormatted, '$5.99');
  assert.equal(prices['413150'].initialFormatted, '$14.99', 'falls back when Steam leaves initial_formatted empty');
  assert.deepEqual(parseSteamPrices(null), {});
});

const NOW = Date.parse('2026-10-15T18:00:00Z');
const epicFixture = {
  data: {
    Catalog: {
      searchStore: {
        elements: [
          {
            id: 'abc',
            title: 'Free Now Game',
            productSlug: 'free-now-game',
            keyImages: [{ type: 'Thumbnail', url: 'https://img/thumb.jpg' }, { type: 'OfferImageWide', url: 'https://img/wide.jpg' }],
            price: { totalPrice: { discountPrice: 0, originalPrice: 1999 } },
            promotions: { promotionalOffers: [{ promotionalOffers: [{ startDate: '2026-10-15T15:00:00.000Z', endDate: '2026-10-22T15:00:00.000Z', discountSetting: { discountType: 'PERCENTAGE', discountPercentage: 0 } }] }], upcomingPromotionalOffers: [] },
          },
          {
            id: 'def',
            title: 'Next Week Game',
            productSlug: null,
            offerMappings: [{ pageSlug: 'next-week' }],
            price: { totalPrice: { discountPrice: 1499, originalPrice: 1499 } },
            promotions: { promotionalOffers: [], upcomingPromotionalOffers: [{ promotionalOffers: [{ startDate: '2026-10-22T15:00:00.000Z', endDate: '2026-10-29T15:00:00.000Z', discountSetting: { discountPercentage: 0 } }] }] },
          },
          {
            id: 'ghi',
            title: 'Just On Sale',
            catalogNs: { mappings: [{ pageSlug: 'just-on-sale' }] },
            price: { totalPrice: { discountPrice: 999, originalPrice: 1999 } },
            promotions: { promotionalOffers: [{ promotionalOffers: [{ startDate: '2026-10-10T00:00:00Z', endDate: '2026-10-30T00:00:00Z', discountSetting: { discountPercentage: 50 } }] }] },
          },
          { id: 'jkl', title: 'Mystery Game', promotions: null, price: null },
          { title: 'Mapping Slug Game', offerMappings: [{ pageSlug: 'mapped' }], price: { totalPrice: { discountPrice: 0 } }, promotions: { promotionalOffers: [{ promotionalOffers: [{ startDate: '2026-10-15T00:00:00Z', endDate: '2026-10-16T00:00:00Z' }] }] } },
          null,
          'garbage',
        ],
      },
    },
  },
};

test('parseEpicFreeGames: only games free right now; tolerant of odd entries', () => {
  const free = parseEpicFreeGames(epicFixture, NOW);
  assert.deepEqual(free.map((g) => g.title), ['Free Now Game', 'Mapping Slug Game']);
  assert.equal(free[0].url, 'https://store.epicgames.com/en-US/p/free-now-game');
  assert.equal(free[0].image, 'https://img/wide.jpg');
  assert.equal(free[0].endsAt, Date.parse('2026-10-22T15:00:00.000Z'));
  assert.equal(free[1].url, 'https://store.epicgames.com/en-US/p/mapped');
  assert.deepEqual(parseEpicFreeGames({}, NOW), []);
  assert.deepEqual(parseEpicFreeGames(null, NOW), []);
  assert.deepEqual(parseEpicFreeGames(epicFixture, Date.parse('2026-10-23T00:00:00Z')), [], "upcoming games aren't announced until Epic makes them free");
});

test('pickSteamMatch prefers an exact name', () => {
  const items = [{ id: 1, name: 'Lethal Company Soundtrack' }, { id: 2, name: 'Lethal Company' }];
  assert.equal(pickSteamMatch(items, 'lethal company').id, 2);
  assert.equal(pickSteamMatch(items, 'something else').id, 1);
  assert.equal(pickSteamMatch([], 'x'), null);
  assert.equal(pickSteamMatch(undefined, 'x'), null);
});

test('decideDeal: announce on start, again only when deeper, reset when over', () => {
  assert.deepEqual(decideDeal({ dealPercent: null }, { percent: 40 }), { announce: true, dealPercent: 40 });
  assert.deepEqual(decideDeal({ dealPercent: 40 }, { percent: 40 }), { announce: false, dealPercent: 40 });
  assert.deepEqual(decideDeal({ dealPercent: 40 }, { percent: 25 }), { announce: false, dealPercent: 40 });
  assert.deepEqual(decideDeal({ dealPercent: 40 }, { percent: 75 }), { announce: true, dealPercent: 75 });
  assert.deepEqual(decideDeal({ dealPercent: 75 }, { percent: 0 }), { announce: false, dealPercent: 0 });
  assert.equal(decideDeal({}, { percent: MIN_DISCOUNT - 1 }).announce, false, 'tiny discounts are noise');
});

function fakeClient(guildIds) {
  const sent = [];
  return {
    sent,
    guilds: { cache: new Map(guildIds.map((id) => [id, { id }])) },
    channels: { fetch: async (id) => ({ id, isTextBased: () => true, send: async (p) => sent.push([id, p]) }) },
  };
}

test('dealTick posts a sale once per server, grouped, then again when deeper', async () => {
  updateGuildConfig('g-deal', { newsChannelId: 'news' });
  const a = addGame({ guildId: 'g-deal', name: 'Lethal Company', addedBy: 'u' });
  const b = addGame({ guildId: 'g-deal', name: 'Phasmophobia', addedBy: 'u' });
  setSteamLink(a.id, '1966720');
  setSteamLink(b.id, '739630');
  const client = fakeClient(['g-deal']);
  const sale = (pa, pb) => ({
    1966720: { percent: pa, finalFormatted: '$5.99', initialFormatted: '$9.99' },
    739630: { percent: pb, finalFormatted: '$11.99', initialFormatted: '$19.99' },
  });

  assert.equal(await dealTick(client, { prices: sale(40, 40) }), 2);
  assert.equal(client.sent.length, 1, 'one grouped message');
  assert.match(client.sent[0][1].embeds[0].data.description, /Lethal Company.*40% off/);
  assert.equal(await dealTick(client, { prices: sale(40, 40) }), 0, 'same sale is not re-announced');
  assert.equal(await dealTick(client, { prices: sale(60, 40) }), 1, 'deeper discount is news');
  await dealTick(client, { prices: sale(0, 0) });
  assert.equal(getGame(a.id).dealPercent, 0, 'reset after the sale');
  assert.equal(await dealTick(client, { prices: sale(40, 0) }), 1, 'the next sale is news again');

  updateGuildConfig('g-deal', { dealAlerts: 0 });
  await dealTick(client, { prices: sale(0, 0) });
  assert.equal(await dealTick(client, { prices: sale(50, 50) }), 0, 'switched off');
});

test('freeGameTick posts each free game once per server and respects the switch', async () => {
  updateGuildConfig('g-free', { newsChannelId: null, socialChannelId: 'rat-chat' });
  updateGuildConfig('g-free-off', { newsChannelId: 'news2', freeGameAlerts: 0 });
  const client = fakeClient(['g-free', 'g-free-off']);
  const free = parseEpicFreeGames(epicFixture, NOW);
  assert.equal(await freeGameTick(client, { freeGames: free, now: NOW }), 2);
  assert.equal(await freeGameTick(client, { freeGames: free, now: NOW }), 0);
  assert.ok(client.sent.every(([channelId]) => channelId === 'rat-chat'), 'falls back to the social channel; the opted-out server gets nothing');
  client.sent[0][1].embeds[0].toJSON();
});
