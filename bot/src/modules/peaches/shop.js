/**
 * What /pet shop sells. Treats are used immediately (stat boosts for her);
 * cosmetics go into the server's shared wardrobe for anyone to dress her in.
 * `season` items are only for sale while that season is active.
 *
 * Prices are pitched against earnings: an engaged member makes roughly
 * 15–30 🧀 a day, so treats are an everyday thing and the fancy cosmetics
 * are something to save up (or club together) for.
 */
export const SHOP_ITEMS = [
  // Treats
  { key: 'cheddar_cube', type: 'treat', name: 'Cheddar Cube', emoji: '🧀', price: 8, effects: { hunger: 15 }, blurb: 'A classic.' },
  { key: 'spring_water', type: 'treat', name: 'Spring Water', emoji: '💧', price: 6, effects: { thirst: 20 }, blurb: 'Bottled at the source (the sink).' },
  { key: 'sunflower_seeds', type: 'treat', name: 'Sunflower Seeds', emoji: '🌻', price: 12, effects: { hunger: 10, happiness: 10 }, blurb: 'Crunchy. She shells them herself.' },
  { key: 'nap_pillow', type: 'treat', name: 'Nap Pillow', emoji: '🛏️', price: 15, effects: { energy: 30 }, blurb: 'Instant nap, guaranteed.' },
  { key: 'squeaky_toy', type: 'treat', name: 'Squeaky Toy', emoji: '🧸', price: 20, effects: { happiness: 25 }, blurb: 'Squeaks. Endlessly. You were warned.' },
  { key: 'bubble_bath', type: 'treat', name: 'Bubble Bath', emoji: '🛁', price: 20, effects: { cleanliness: 40 }, blurb: 'She acts offended. She is secretly delighted.' },
  { key: 'fancy_brie', type: 'treat', name: 'Fancy Brie', emoji: '🥂', price: 35, effects: { hunger: 30, thirst: 10, happiness: 15 }, blurb: 'Imported. Pretentious. Delicious.' },
  { key: 'cheese_board', type: 'treat', name: 'Royal Cheese Board', emoji: '🍽️', price: 90, effects: { hunger: 40, thirst: 40, happiness: 40, energy: 40, cleanliness: 40 }, blurb: 'Everything. All at once. A feast fit for a queen.' },
  { key: 'chocolate_box', type: 'treat', name: 'Box of Chocolates', emoji: '🍫', price: 25, season: 'valentines', effects: { hunger: 10, happiness: 30 }, blurb: 'Heart-shaped. She eats the box too.' },
  { key: 'carrot_cake', type: 'treat', name: 'Carrot Cake', emoji: '🥕', price: 20, season: 'spring', effects: { hunger: 20, happiness: 10 }, blurb: 'Technically a vegetable.' },
  { key: 'popsicle', type: 'treat', name: 'Popsicle', emoji: '🍭', price: 12, season: 'summer', effects: { thirst: 20, happiness: 10 }, blurb: 'Cherry. It will turn her tongue red.' },
  { key: 'hot_cocoa', type: 'treat', name: 'Hot Cocoa', emoji: '☕', price: 15, season: 'winter', effects: { thirst: 20, happiness: 15 }, blurb: 'Extra marshmallows. She insisted.' },
  { key: 'gingerbread', type: 'treat', name: 'Gingerbread Cookie', emoji: '🍪', price: 20, season: 'winter', effects: { hunger: 20, happiness: 15 }, blurb: 'Warm from the oven. The oven is a lightbulb.' },
  { key: 'pumpkin_pie', type: 'treat', name: 'Pumpkin Pie Slice', emoji: '🥧', price: 25, season: 'halloween', effects: { hunger: 25, happiness: 15 }, blurb: 'Seasonal. Extremely seasonal.' },

  // Cosmetics — hats
  { key: 'beanie', type: 'cosmetic', slot: 'hat', name: 'Tiny Beanie', emoji: '🧢', price: 40, blurb: 'Cozy. Slightly crooked.' },
  { key: 'party_hat', type: 'cosmetic', slot: 'hat', name: 'Party Hat', emoji: '🥳', price: 50, blurb: 'Every day is a party if you\'re a rat.' },
  { key: 'flower_crown', type: 'cosmetic', slot: 'hat', name: 'Flower Crown', emoji: '🌸', price: 60, blurb: 'She looks like a woodland fairy. A menacing one.' },
  { key: 'top_hat', type: 'cosmetic', slot: 'hat', name: 'Top Hat', emoji: '🎩', price: 80, blurb: 'For distinguished vermin.' },
  { key: 'gold_crown', type: 'cosmetic', slot: 'hat', name: 'Gold Crown', emoji: '👑', price: 400, blurb: 'She always knew she was royalty. Now everyone does.' },
  { key: 'pumpkin_hat', type: 'cosmetic', slot: 'hat', name: 'Pumpkin Hat', emoji: '🎃', price: 70, season: 'halloween', blurb: 'Hollowed out. Smells like pie.' },
  { key: 'heart_headband', type: 'cosmetic', slot: 'hat', name: 'Heart Headband', emoji: '💞', price: 60, season: 'valentines', blurb: 'Two hearts on springs. Boing.' },
  { key: 'bunny_ears', type: 'cosmetic', slot: 'hat', name: 'Bunny Ears', emoji: '🐰', price: 60, season: 'spring', blurb: 'A rat in disguise. Flawless.' },
  { key: 'straw_sun_hat', type: 'cosmetic', slot: 'hat', name: 'Straw Sun Hat', emoji: '👒', price: 70, season: 'summer', blurb: 'With a little flower. Very chic.' },
  { key: 'santa_hat', type: 'cosmetic', slot: 'hat', name: 'Santa Hat', emoji: '🎅', price: 70, season: 'winter', blurb: 'Pom-pom included. Dignity not included.' },
  { key: 'reindeer_antlers', type: 'cosmetic', slot: 'hat', name: 'Reindeer Antlers', emoji: '🦌', price: 60, season: 'winter', blurb: 'She is now the fastest reindeer. She has decided.' },
  { key: 'devil_horns', type: 'cosmetic', slot: 'hat', name: 'Devil Horns', emoji: '😈', price: 60, season: 'halloween', blurb: 'Honestly? Accurate.' },

  // Cosmetics — accessories
  { key: 'bow_tie', type: 'cosmetic', slot: 'accessory', name: 'Bow Tie', emoji: '🎀', price: 40, blurb: 'Dapper.' },
  { key: 'tiny_scarf', type: 'cosmetic', slot: 'accessory', name: 'Tiny Scarf', emoji: '🧣', price: 50, blurb: 'Hand-knitted by someone very patient.' },
  { key: 'sunglasses', type: 'cosmetic', slot: 'accessory', name: 'Sunglasses', emoji: '🕶️', price: 75, blurb: 'Too cool for the sewer.' },
  { key: 'pearl_necklace', type: 'cosmetic', slot: 'accessory', name: 'Pearl Necklace', emoji: '📿', price: 120, blurb: 'Real pearls. Do not ask.' },
  { key: 'hero_cape', type: 'cosmetic', slot: 'accessory', name: 'Hero Cape', emoji: '🦸', price: 150, blurb: 'Not every hero wears a cape. This one does.' },
  { key: 'flower_lei', type: 'cosmetic', slot: 'accessory', name: 'Flower Lei', emoji: '🌺', price: 50, season: 'summer', blurb: 'Aloha, rat.' },
  { key: 'ugly_sweater', type: 'cosmetic', slot: 'accessory', name: 'Ugly Holiday Sweater', emoji: '🧶', price: 80, season: 'winter', blurb: 'It has a cheese wheel on it. It lights up.' },
  { key: 'bat_wings', type: 'cosmetic', slot: 'accessory', name: 'Bat Wings', emoji: '🦇', price: 90, season: 'halloween', blurb: 'She cannot fly. She is trying anyway.' },
];

export const SLOTS = { hat: { label: 'Hat', column: 'outfitHat' }, accessory: { label: 'Accessory', column: 'outfitAccessory' } };

const BY_KEY = new Map(SHOP_ITEMS.map((item) => [item.key, item]));

export function getShopItem(key) {
  return BY_KEY.get(key) ?? null;
}

/** Items on sale right now: everything without a season, plus the active season's. */
export function itemsForSale(season) {
  return SHOP_ITEMS.filter((item) => !item.season || item.season === season);
}

/**
 * Why an item can't be bought right now, or null if it can.
 * `owned` is the set of cosmetic keys already in the server wardrobe.
 */
export function purchaseBlocker(item, { season, owned, balance }) {
  if (!item) return "That's not on the shelf.";
  if (item.season && item.season !== season) return 'That one is out of season.';
  if (item.type === 'cosmetic' && owned.has(item.key)) return "She already has that in her wardrobe — dress her in it with `/pet wardrobe`.";
  if (balance < item.price) return `You need ${item.price} 🧀 and have ${balance} 🧀. Look after her a bit more!`;
  return null;
}

export function describeEffects(effects = {}) {
  const icons = { hunger: '🧀', thirst: '💧', happiness: '🎾', energy: '😴', cleanliness: '🧼' };
  return Object.entries(effects)
    .map(([stat, amount]) => `${icons[stat]} +${amount}`)
    .join(' ');
}
