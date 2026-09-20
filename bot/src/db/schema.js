import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

// --- Setup & Config ---------------------------------------------------

export const guilds = sqliteTable('guilds', {
  id: text('id').primaryKey(),
  panelChannelId: text('panel_channel_id'),
  newsChannelId: text('news_channel_id'),
  outageChannelId: text('outage_channel_id'),
  logChannelId: text('log_channel_id'),
  timezone: text('timezone').default('UTC'),
  defaultMention: text('default_mention'), // 'here' | 'role' | 'none'
  defaultRoleId: text('default_role_id'),
  flavorEnabled: integer('flavor_enabled').default(1),
  createdAt: integer('created_at'),
});

// --- Music --------------------------------------------------------------

export const hoards = sqliteTable('hoards', {
  id: text('id').primaryKey(),
  guildId: text('guild_id').notNull(),
  ownerId: text('owner_id').notNull(),
  name: text('name').notNull(),
  isPublic: integer('is_public').default(0),
  createdAt: integer('created_at'),
});

export const hoardTracks = sqliteTable('hoard_tracks', {
  id: text('id').primaryKey(),
  hoardId: text('hoard_id').notNull(),
  position: integer('position').notNull(),
  title: text('title'),
  artist: text('artist'),
  uri: text('uri'),
  duration: integer('duration'),
  source: text('source'),
});

export const voicePanels = sqliteTable('voice_panels', {
  guildId: text('guild_id').notNull(),
  voiceChannelId: text('voice_channel_id').primaryKey(),
  messageId: text('message_id'),
  updatedAt: integer('updated_at'),
});

// --- Games & News ---------------------------------------------------------

export const gameNewsSubscriptions = sqliteTable('game_news_subscriptions', {
  id: text('id').primaryKey(),
  guildId: text('guild_id').notNull(),
  gameName: text('game_name').notNull(),
  steamAppid: text('steam_appid'),
  enabled: integer('enabled').default(1),
  tagFilter: text('tag_filter'), // comma-separated Steam news tags
  lastCheckedAt: integer('last_checked_at'),
});

// --- Outages --------------------------------------------------------------

export const outageMonitors = sqliteTable('outage_monitors', {
  id: text('id').primaryKey(),
  guildId: text('guild_id').notNull(),
  serviceSlug: text('service_slug').notNull(), // e.g. 'steam', 'discord'
  serviceName: text('service_name').notNull(),
  enabled: integer('enabled').default(1),
  lastStatus: text('last_status'), // 'up' | 'down' | 'degraded'
  lastCheckedAt: integer('last_checked_at'),
  lastNotifiedAt: integer('last_notified_at'),
});

export const userOutagePrefs = sqliteTable(
  'user_outage_prefs',
  {
    userId: text('user_id').notNull(),
    guildId: text('guild_id').notNull(),
    serviceSlug: text('service_slug').notNull(),
    notifyEnabled: integer('notify_enabled').default(1),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.guildId, table.serviceSlug] }),
  }),
);

// --- Peaches (the pet rat) -------------------------------------------------

export const peachesState = sqliteTable('peaches_state', {
  guildId: text('guild_id').primaryKey(),
  name: text('name').default('Peaches'),
  hunger: integer('hunger').default(80),
  thirst: integer('thirst').default(80),
  happiness: integer('happiness').default(80),
  energy: integer('energy').default(80),
  cleanliness: integer('cleanliness').default(80),
  mood: text('mood').default('content'), // thriving|content|restless|grumpy|neglected
  level: integer('level').default(1),
  lastSpawnAt: integer('last_spawn_at'),
  lastDecayAt: integer('last_decay_at'),
  renamedAt: integer('renamed_at'),
});

export const peachesSpawns = sqliteTable('peaches_spawns', {
  id: text('id').primaryKey(),
  guildId: text('guild_id').notNull(),
  channelId: text('channel_id').notNull(),
  messageId: text('message_id'),
  spawnedAt: integer('spawned_at'),
  expiresAt: integer('expires_at'),
  variant: text('variant'), // normal|fancy|angry|sneaky|queen
  resolved: integer('resolved').default(0),
});

export const peachesInteractions = sqliteTable('peaches_interactions', {
  id: text('id').primaryKey(),
  spawnId: text('spawn_id'),
  userId: text('user_id'),
  action: text('action'), // feed|water|play|sleep|clean
  createdAt: integer('created_at'),
});

export const peachesMischief = sqliteTable('peaches_mischief', {
  id: text('id').primaryKey(),
  guildId: text('guild_id').notNull(),
  channelId: text('channel_id').notNull(),
  messageId: text('message_id'),
  type: text('type'), // crumbs|gift|turd|hole|shred|walls|ruler
  spawnedAt: integer('spawned_at'),
  expiresAt: integer('expires_at'),
  resolved: integer('resolved').default(0),
  resolvedBy: text('resolved_by'),
  resolvedAt: integer('resolved_at'),
});

export const peachesStats = sqliteTable(
  'peaches_stats',
  {
    guildId: text('guild_id').notNull(),
    userId: text('user_id').notNull(),
    cheeseFed: integer('cheese_fed').default(0),
    turdsCleaned: integer('turds_cleaned').default(0),
    holesInvestigated: integer('holes_investigated').default(0),
    wallsKnocked: integer('walls_knocked').default(0),
    fealtyPledged: integer('fealty_pledged').default(0),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.guildId, table.userId] }),
  }),
);

export const peachesConfig = sqliteTable('peaches_config', {
  guildId: text('guild_id').primaryKey(),
  mischiefEnabled: integer('mischief_enabled').default(1),
  escalationEnabled: integer('escalation_enabled').default(1),
  mischiefFrequency: text('mischief_frequency').default('normal'), // low|normal|high
  crossMusic: integer('cross_music').default(1),
  crossNews: integer('cross_news').default(1),
  crossOutages: integer('cross_outages').default(1),
  crossHoards: integer('cross_hoards').default(1),
  spawnChannels: text('spawn_channels'), // comma-separated channel IDs
});
