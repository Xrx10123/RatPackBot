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

## Phase 4: She reacts to chat
- Emoji reactions to "cheese", "rat", her name; replies to "goodnight"/"good morning"
- Strictly rate-limited per channel; managers can toggle it per channel

## Phase 5: Social
- Birthdays: `/birthday set`, posted in the configured channel at local midnight, with an optional "Birthday Rat" role for the day
- Reminders: `/remindme in 2h …` / `at 9pm …`, posted in-channel by Peaches; survives restarts

## Later / ideas parking lot
- Music: autoplay/radio when the queue ends, "guess the song", listening stats
- Game night: "what should we play" picker from a saved list, team randomizer
