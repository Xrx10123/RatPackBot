import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

export const config = {
  discord: {
    token: required('DISCORD_TOKEN'),
    clientId: required('DISCORD_CLIENT_ID'),
    devGuildId: process.env.DISCORD_GUILD_ID_DEV || null,
  },
  database: {
    path: process.env.DATABASE_PATH || './data/ratpack.db',
  },
  lavalink: {
    host: process.env.LAVALINK_HOST || 'lavalink',
    port: Number(process.env.LAVALINK_PORT) || 2333,
    password: process.env.LAVALINK_PASSWORD || '',
  },
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID || null,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || null,
  },
  appleMusic: {
    token: process.env.APPLE_MUSIC_TOKEN || null,
  },
  deezer: {
    key: process.env.DEEZER_KEY || null,
  },
  tidal: {
    key: process.env.TIDAL_KEY || null,
  },
  // Note: YOUTUBE_* resilience vars (OAuth/poToken) aren't read here — they
  // go straight to the Lavalink container via its own env_file, since the
  // bot process itself never touches YouTube directly. See lavalink/application.yml.
  steam: {
    apiKey: process.env.STEAM_API_KEY || null,
  },
  riot: {
    apiKey: process.env.RIOT_API_KEY || null,
  },
  fortnite: {
    // Not in the original plan's env list — fortnite-api.com's stats endpoint
    // turned out to require a (free) key despite the build plan assuming none.
    apiKey: process.env.FORTNITE_API_KEY || null,
  },
  dbd: {
    // No confirmed stable public host for "DBD-Database" was found — left
    // unset by default so the feature degrades instead of hitting a guess.
    apiBaseUrl: process.env.DBD_API_BASE_URL || null,
  },
  peaches: {
    imageDir: process.env.PEACHES_IMAGE_DIR || './data/peaches-images',
  },
  logLevel: process.env.LOG_LEVEL || 'info',
  flavorEnabled: (process.env.FLAVOR_ENABLED ?? 'true') !== 'false',
};
