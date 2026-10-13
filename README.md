# RatPackBot 🐀

Discord bot designed for my wife — music, game stats, outage alerts, and a very opinionated pet rat named Peaches.

Self-hosted, modular, multi-guild. Built with Node.js 22, discord.js v14, and Lavalink v4.

## What it does

- **Music** — `/play`, `/search`, queue management (`/queue`, `/remove`, `/move`), playlists ("hoards"), audio effects, lyrics, and a live control panel posted right in the voice channel's chat (or your music channel, if the bot can't post there). Turn on `/musicconfig autoplay` and when the queue runs out it keeps going with related songs (`/stop` still stops). `/musicstats` shows the server's most-played songs, artists and DJs, and `/musicquiz` is a guess-the-song game built from what you've actually listened to, with cheese for the winners.
- **Setup** — a guided `/setup` wizard that configures channels, timezone, and notification preferences, with one-click auto-creation of the channel category.
- **Game stats & news** — `/stats`, `/steam`, and a Steam-appid-based news tracker (`/news`) that follows patch notes for whatever games your server cares about.
- **Outage monitoring** — `/outage` and `/status` watch real services (Discord, Steam, Cloudflare, and anything else on Atlassian Statuspage) and ping the server when something goes down or recovers.
- **Peaches** — a shared pet rat who wanders into channels, needs feeding/watering/playing with, and gets increasingly mischievous if the server neglects her. She levels up as the server takes care of her (`/pet status` shows her stats and progress), and sleeps overnight in your server's timezone, so no 3 AM pings (`/pet config quiet_hours` to turn that off). Her birthday in each server is the day she joined it, and she throws a party with cake for everyone. She also finds odd little things and hands them to people (`/pet album`). Looking after her earns 🧀 cheese (`/pet wallet`), which you can spend in `/pet shop` on treats that perk her up, or on hats and accessories that go into her shared wardrobe for anyone to dress her in (`/pet wardrobe`). Nothing ever takes your cheese except spending it. Win more with her mini-games: `/pet hideandseek` (she hides in a channel; first to `/pet find` her wins), `/pet trivia` (rat and cheese questions), and `/pet race` (back a racer; nobody loses anything). She also reads the room: she reacts with 🧀/🐀 when people talk about cheese, rats or her, says goodnight and good morning back, and answers when you @mention her, all gently rate-limited. Managers can switch that off server-wide or per channel with `/pet chat`. For her to see ordinary messages, turn on **Message Content Intent** in the Discord Developer Portal (your app → Bot → Privileged Gateway Intents). The bot detects it at startup; without it she only responds to @mentions and replies. Seasonal events: from Oct 15 to Oct 31 she wears a witch hat, Ghost Peaches haunts the place, and every visit has a 🎃 Trick or Treat button. All of December she's in a Santa hat, Frosty Peaches turns up in earmuffs, every visit has 🎁 presents to unwrap, and the shop stocks hot cocoa, antlers and an ugly sweater.
- **Birthdays & reminders** — `/birthday set` and Peaches throws a party at local midnight in your Birthdays & Reminders channel: a cheese gift, a "wish them happy birthday" button, and an optional birthday role for the day (`/birthday role`). `/birthday list` shows what's coming up. `/remind me when:"in 2h" what:"…"` (or `at 9pm`, `tomorrow 8am`, in your server's timezone) and she'll ping you in that channel; reminders survive restarts. `/remind list` and `/remind cancel` manage them.
- **Game night** — keep the group's game list with `/games add` (optionally with player counts). `/games pick` has Peaches choose something that fits everyone in your voice channel, favouring games you haven't played lately (🎲 reroll, ✅ lock it in). `/games vote` puts a few up for a quick vote, and `/teams` splits the voice channel (or a list of @mentions) into random teams.
- **Logs** — settings changes ("@someone set alert pings to @here") and anything that breaks get posted to the Logs channel you pick in `/setup`, so managers can see what changed and when.

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

4. In Discord, run `/setup` in any channel. It'll walk through picking (or auto-creating) the five channels Ratpack uses, timezone, and default notification behavior. Run `/setup check` any time to verify everything's still wired up correctly.

## Updating

```bash
git pull
docker compose up -d --build
```

The SQLite database lives in `./data/ratpack.db` on the host and survives rebuilds/restarts.

## Permissions inside Discord

Anything that changes server-wide settings — the `/setup` panel and its buttons, `/musicconfig`, `/outage add/remove/channel`, `/news add/remove/filter/check`, and the admin `/pet` subcommands — requires the **Manage Server** permission. Everyone else can still play music, check `/status` and `/server`, follow their own outage pings with `/outage notify`, and look after Peaches.

## Development

```bash
cd bot
npm install
npm test
```

Tests use Node's built-in test runner and a throwaway SQLite database per test file — no Discord token or Lavalink needed.

## Troubleshooting

- **Bot won't start / crashes immediately** — check `docker compose logs bot`. Usually a missing required env var (`DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, or `LAVALINK_PASSWORD`).
- **Slash commands aren't showing up** — global command registration can take up to an hour to propagate. For instant registration during development, set `DISCORD_GUILD_ID_DEV` to your test server's ID.
- **Permission denied writing to `./data`** — on Linux hosts, the bot container runs as a non-root user (uid 1000). If `./data` is owned by a different user on the host, run `sudo chown -R 1000:1000 ./data` once.
- **A song shows in the panel but ends instantly / never plays** — check `docker compose logs lavalink` for `AllClientsFailedException` / "This video requires login" / "unavailable". This is YouTube's bot detection, and it's common even on residential IPs now — a cloud VPS makes it worse. Fix: set `YOUTUBE_OAUTH_ENABLED=true` in `.env`, restart the `lavalink` container, watch `docker compose logs -f lavalink` for a one-time URL + code, authorize with a (burner) Google account, then copy the refresh token it prints into `YOUTUBE_REFRESH_TOKEN` so it persists across restarts. See the comments above those vars in `.env.example` for the full walkthrough.

## Peaches' art

Every picture of Peaches is from one matching set of original animated GIFs in `bot/assets/peaches/`: her moods, visitor variants, care actions, mischief, birthday and seasonal events (27 in all). They're drawn by `bot/tools/draw_peaches.py` (`python3 bot/tools/draw_peaches.py --sheet` re-renders them and writes a preview sheet). Nothing is downloaded at runtime.

To use your own picture for a moment, drop a GIF/PNG/MP4 with that moment's name (e.g. `angry.png`, `feed.gif`) into `./data/peaches-images/`. Yours wins over the built-in art. The names match the files in `bot/assets/peaches/`.
