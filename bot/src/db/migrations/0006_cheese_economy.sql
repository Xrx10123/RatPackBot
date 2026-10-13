-- Cozy cheese economy: earned by looking after Peaches, only ever lost by spending.
CREATE TABLE IF NOT EXISTS peaches_wallets (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  cheese INTEGER NOT NULL DEFAULT 0,
  lifetime INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
);

-- Cosmetics are bought into a shared, per-server wardrobe (anyone can dress her).
CREATE TABLE IF NOT EXISTS peaches_wardrobe (
  guild_id TEXT NOT NULL,
  item_key TEXT NOT NULL,
  bought_by TEXT NOT NULL,
  bought_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, item_key)
);

-- What she's wearing right now (item keys from the shop catalog, or NULL).
ALTER TABLE peaches_state ADD COLUMN outfit_hat TEXT;
ALTER TABLE peaches_state ADD COLUMN outfit_accessory TEXT;
