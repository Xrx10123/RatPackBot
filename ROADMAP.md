# Ratpack Roadmap

Planned from a brainstorm on 2026-10-13. Audience: a small group of close
friends. Most-used parts: music, Peaches, outage alerts. Direction: more
Peaches, plus social features, with Peaches as the voice of the whole bot.

## Decisions
- **Personality:** Peaches speaks for the bot everywhere: alerts, birthdays, reminders.
- **Economy:** cozy. Cheese is earned by caring for her and winning mini-games, and lost only by spending.
- **Delivery:** birthdays and reminders post in a channel (configured in `/setup`), not by DM.
- **Chat reactions:** the Message Content intent is enabled in the Developer Portal (Bot → Privileged Gateway Intents).

## Phase 1: Halloween and life events — ✅ done
- Seasonal mode: Peaches wears a Halloween costume in her embeds from Oct 15 to Oct 31, with spooky flavor text
- Spawn variant "Ghost Peaches" (October only) and a trick-or-treat button that hands out a treat or a trick
- Peaches' own birthday: per server, the day she joined it, with a celebration post and cake slices
- Collectibles album: "Peaches found something…" items she drops; `/pet album` shows the set

## Phase 2: Cheese economy and shop — ✅ done
- Cheese wallet per member, earned from care actions, mischief cleanup and mini-game wins
- `/pet shop` sells treats (stat boosts) and cosmetics (outfits and accessories shown on her embeds)
- `/pet wardrobe` to dress her (a shared server wardrobe; seasonal items are sold only in season)
- `/pet wallet`, plus a Cheese Earned leaderboard

## Phase 3: Mini-games — ✅ done
- Hide-and-seek: she hides in a random channel, and the first to find her with `/pet find` wins cheese
- Cheese trivia: rat and cheese facts, quick-answer buttons
- Rat race: pick a racer and watch an animated race in the embed, with cheese prizes (no betting losses)

## Phase 4: She reacts to chat — ✅ done
- Emoji reactions to "cheese", "rat", her name; replies to "goodnight"/"good morning"
- Strictly rate-limited per channel; managers can toggle it per channel (`/pet chat`)
- The bot detects the Message Content intent at startup; without it she answers only @mentions and replies

## Phase 5: Social — ✅ done
- Birthdays: `/birthday set|remove|list|role`, posted in the new Birthdays & Reminders channel at local midnight, with a cheese gift, wish buttons and an optional birthday role for the day
- Reminders: `/remind me|list|cancel` (`in 2h`, `at 9pm`, `tomorrow 8am`), posted in-channel by Peaches; survives restarts

## Phase 6: More of everything — ✅ done
- Music: autoplay (YouTube mix → same artist → server favourites), `/musicstats`, `/musicquiz` guess-the-song
- Game night: `/games add|remove|list|pick|vote`, `/teams`
- Winter season (December): Santa hat, Frosty Peaches, present unwrapping, winter collectibles and shop stock

## Phase 7: Deals — ✅ done
- Steam sale alerts for games on the game night list (auto-linked on `/games add`), `/games deals`, Epic free games

## Phase 8: Seasons all year — ✅ done
- Valentine's (Cupid Peaches, valentines), spring (Bunny Peaches, egg hunts), summer (Beach Peaches, ice cream), each with art, collectibles and shop items

## Ideas parking lot
- Peaches outfits drawn into her GIF art (not just emoji)
