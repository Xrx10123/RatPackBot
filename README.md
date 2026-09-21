# RatPackBot 🐀

Discord bot designed for my wife — music, game stats, outage alerts, and a very opinionated pet rat named Peaches.

Self-hosted, modular, multi-guild. Built with Node.js 22, discord.js v14, and Lavalink v4.

## What it does

- **Music** — `/play`, `/search`, queue management, playlists ("hoards"), audio effects, lyrics, and a live control panel posted right in the voice channel's chat.
- **Setup** — a guided `/setup` wizard that configures channels, timezone, and notification preferences, with one-click auto-creation of the channel category.
- **Game stats & news** — `/stats`, `/steam`, and a Steam-appid-based news tracker (`/news`) that follows patch notes for whatever games your server cares about.
- **Outage monitoring** — `/outage` and `/status` watch real services (Discord, Steam, Cloudflare, and anything else on Atlassian Statuspage) and ping the server when something goes down or recovers.
- **Peaches** — a shared pet rat who wanders into channels, needs feeding/watering/playing with, and gets increasingly mischievous if the server neglects her.

## Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose
- A Discord application + bot token — create one at the [Discord Developer Portal](https://discord.com/developers/applications)
  - Under **Bot**, enable it and copy the token
  - Under **Bot**, turn on **2FA/MFA** on your Discord account before granting Administrator (see Permissions below)
  - Copy the **Application ID** from **General Information**

## Setup

1. Copy the example environment file and fill it in:

   ```bash
   cp .env.example .env
   ```

   At minimum, set `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, and `LAVALINK_PASSWORD` (any string — it's just the shared secret between the bot and its own Lavalink container). Everything else in `.env.example` is optional and documented inline — several features (news, Steam lookups, Fortnite/Valorant stats) degrade gracefully with a clear in-Discord message if their key is missing, rather than failing silently.

2. Invite the bot to your server. The simplest path for a self-hosted bot in your own server(s) is the **Administrator** permission — this avoids debugging channel permission overwrites and lets `/setup` auto-create channels without issue. Build the invite URL from the Discord Developer Portal's **OAuth2 → URL Generator** (scopes: `bot`, `applications.commands`; permission: `Administrator`).

   This is a real tradeoff: Administrator is all-or-nothing, so if the token leaks the bot can do anything in any guild it's in. Keep `.env` out of version control (it already is, via `.gitignore`), rotate the token immediately if it's ever exposed, and make sure 2FA is on for the bot's Discord account. If you'd rather scope it down, the bot only actually needs: View Channels, Send Messages, Embed Links, Attach Files, Read Message History, Add Reactions, Use External Emojis, Manage Messages, Manage Channels, Connect, Speak, Mention Everyone.

3. Start everything:

   ```bash
   docker compose up -d --build
   ```

   First boot downloads Lavalink's `youtube-source` and `LavaSrc` plugins automatically (cached afterward in a volume) — give it a minute.

4. In Discord, run `/setup` in any channel. It'll walk through picking (or auto-creating) the four channels Ratpack uses, timezone, and default notification behavior. Run `/setup check` any time to verify everything's still wired up correctly.

## Updating

```bash
git pull
docker compose up -d --build
```

The SQLite database lives in `./data/ratpack.db` on the host and survives rebuilds/restarts.

## Troubleshooting

- **Bot won't start / crashes immediately** — check `docker compose logs bot`. Usually a missing required env var (`DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, or `LAVALINK_PASSWORD`).
- **Slash commands aren't showing up** — global command registration can take up to an hour to propagate. For instant registration during development, set `DISCORD_GUILD_ID_DEV` to your test server's ID.
- **Permission denied writing to `./data`** — on Linux hosts, the bot container runs as a non-root user (uid 1000). If `./data` is owned by a different user on the host, run `sudo chown -R 1000:1000 ./data` once.
- **A song shows in the panel but ends instantly / never plays** — check `docker compose logs lavalink` for `AllClientsFailedException` / "This video requires login" / "unavailable". This is YouTube's bot detection, and it's common even on residential IPs now — a cloud VPS makes it worse. Fix: set `YOUTUBE_OAUTH_ENABLED=true` in `.env`, restart the `lavalink` container, watch `docker compose logs -f lavalink` for a one-time URL + code, authorize with a (burner) Google account, then copy the refresh token it prints into `YOUTUBE_REFRESH_TOKEN` so it persists across restarts. See the comments above those vars in `.env.example` for the full walkthrough.

## Peaches' image folder

Drop a PNG/GIF/MP4 named after a mood, spawn variant, action, or mischief type (e.g. `angry.png`, `feed.gif`) into `./data/peaches-images/` and Peaches will use it instead of the built-in default for that moment.
