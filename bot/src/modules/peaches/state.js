import { randomUUID } from 'node:crypto';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { peachesState, peachesInteractions, peachesSpawns } from '../../db/schema.js';
import { incrementStat } from './stats.js';

const DECAY_PER_HOUR = { hunger: 3, thirst: 3, happiness: 2, energy: 1, cleanliness: 1.5 };
const LOW_THRESHOLD = 30;
const CRITICAL_THRESHOLD = 10;
const NEGLECTED_HOURS = 48;

const ACTION_EFFECTS = {
  feed: { hunger: 30, happiness: 10 },
  water: { thirst: 30, happiness: 5 },
  play: { happiness: 20, energy: -15 },
  sleep: { energy: 40 },
  clean: { cleanliness: 40, happiness: 5 },
};

const ACTION_COOLDOWN_MS = {
  feed: 30 * 60 * 1000,
  water: 30 * 60 * 1000,
  play: 60 * 60 * 1000,
  sleep: 0,
  clean: 2 * 60 * 60 * 1000,
};

function clamp(n) {
  return Math.max(0, Math.min(100, n));
}

export function getRawState(guildId) {
  return db.select().from(peachesState).where(eq(peachesState.guildId, guildId)).get();
}

export function ensureState(guildId) {
  const existing = getRawState(guildId);
  if (existing) return existing;
  const row = {
    guildId,
    name: 'Peaches',
    hunger: 80,
    thirst: 80,
    happiness: 80,
    energy: 80,
    cleanliness: 80,
    mood: 'content',
    level: 1,
    lastSpawnAt: null,
    lastDecayAt: Date.now(),
    renamedAt: null,
  };
  db.insert(peachesState).values(row).run();
  return row;
}

export function calculateMood(stats, neglectedHours) {
  const values = [stats.hunger, stats.thirst, stats.happiness, stats.energy, stats.cleanliness];
  const criticalCount = values.filter((v) => v < CRITICAL_THRESHOLD).length;
  const lowCount = values.filter((v) => v < LOW_THRESHOLD).length;

  if (neglectedHours >= NEGLECTED_HOURS && criticalCount >= 2) return 'neglected';
  if (lowCount >= 2) return 'grumpy';
  if (lowCount === 1) return 'restless';
  if (values.every((v) => v >= 70)) return 'thriving';
  return 'content';
}

/** peaches_interactions rows are scoped to a real spawn; joined through peaches_spawns to filter by guild. */
function getLastInteractionAt(guildId) {
  const row = db
    .select({ createdAt: peachesInteractions.createdAt })
    .from(peachesInteractions)
    .innerJoin(peachesSpawns, eq(peachesInteractions.spawnId, peachesSpawns.id))
    .where(eq(peachesSpawns.guildId, guildId))
    .orderBy(desc(peachesInteractions.createdAt), desc(sql`peaches_interactions.rowid`))
    .limit(1)
    .get();
  return row?.createdAt ?? null;
}

/** Applies real-time decay since the last check, recomputes mood, and persists. Call before reading state anywhere. */
export function getCurrentState(guildId) {
  const state = ensureState(guildId);
  const now = Date.now();
  const elapsedHours = (now - state.lastDecayAt) / (1000 * 60 * 60);

  const decayed = {
    hunger: clamp(state.hunger - DECAY_PER_HOUR.hunger * elapsedHours),
    thirst: clamp(state.thirst - DECAY_PER_HOUR.thirst * elapsedHours),
    happiness: clamp(state.happiness - DECAY_PER_HOUR.happiness * elapsedHours),
    energy: clamp(state.energy - DECAY_PER_HOUR.energy * elapsedHours),
    cleanliness: clamp(state.cleanliness - DECAY_PER_HOUR.cleanliness * elapsedHours),
  };

  const lastInteractionAt = getLastInteractionAt(guildId);
  const neglectedHours = lastInteractionAt ? (now - lastInteractionAt) / (1000 * 60 * 60) : Infinity;
  const mood = calculateMood(decayed, neglectedHours);

  db.update(peachesState).set({ ...decayed, mood, lastDecayAt: now }).where(eq(peachesState.guildId, guildId)).run();

  return { ...state, ...decayed, mood, lastDecayAt: now };
}

export function getActionCooldownRemaining(guildId, userId, action) {
  const cooldownMs = ACTION_COOLDOWN_MS[action] ?? 0;
  if (cooldownMs === 0) return 0;

  const last = db
    .select({ createdAt: peachesInteractions.createdAt })
    .from(peachesInteractions)
    .innerJoin(peachesSpawns, eq(peachesInteractions.spawnId, peachesSpawns.id))
    .where(and(eq(peachesSpawns.guildId, guildId), eq(peachesInteractions.userId, userId), eq(peachesInteractions.action, action)))
    .orderBy(desc(peachesInteractions.createdAt), desc(sql`peaches_interactions.rowid`))
    .limit(1)
    .get();

  if (!last) return 0;
  return Math.max(0, cooldownMs - (Date.now() - last.createdAt));
}

/** Applies feed/water/play/sleep/clean against a real active spawn, and records it for cooldowns + credit. */
export function applyInteraction(guildId, spawnId, userId, action, multiplier = 1) {
  const state = getCurrentState(guildId);
  const effects = ACTION_EFFECTS[action] ?? {};
  const scale = (v) => (v ?? 0) * (v > 0 ? multiplier : 1); // only positive effects scale; energy costs (play) stay fixed

  const updated = {
    hunger: clamp(state.hunger + scale(effects.hunger)),
    thirst: clamp(state.thirst + scale(effects.thirst)),
    happiness: clamp(state.happiness + scale(effects.happiness)),
    energy: clamp(state.energy + scale(effects.energy)),
    cleanliness: clamp(state.cleanliness + scale(effects.cleanliness)),
  };

  db.update(peachesState).set(updated).where(eq(peachesState.guildId, guildId)).run();

  db.insert(peachesInteractions).values({
    id: randomUUID(),
    spawnId,
    userId,
    action,
    createdAt: Date.now(),
  }).run();

  if (action === 'feed') incrementStat(guildId, userId, 'feed');

  return getCurrentState(guildId);
}

/** First interaction of any kind on a spawn — used for the "credit" flavor text. */
export function getFirstInteractor(spawnId) {
  return db.select().from(peachesInteractions).where(eq(peachesInteractions.spawnId, spawnId)).orderBy(peachesInteractions.createdAt).limit(1).get();
}

/** Small ad-hoc stat nudges (mischief rewards, etc.) outside the fixed action-effect table. */
export function nudgeStats(guildId, deltas) {
  const state = getCurrentState(guildId);
  const updated = {
    hunger: clamp(state.hunger + (deltas.hunger ?? 0)),
    thirst: clamp(state.thirst + (deltas.thirst ?? 0)),
    happiness: clamp(state.happiness + (deltas.happiness ?? 0)),
    energy: clamp(state.energy + (deltas.energy ?? 0)),
    cleanliness: clamp(state.cleanliness + (deltas.cleanliness ?? 0)),
  };
  db.update(peachesState).set(updated).where(eq(peachesState.guildId, guildId)).run();
  return getCurrentState(guildId);
}

export function resetToContent(guildId) {
  db
    .update(peachesState)
    .set({ hunger: 60, thirst: 60, happiness: 60, energy: 60, cleanliness: 60, mood: 'content', lastDecayAt: Date.now() })
    .where(eq(peachesState.guildId, guildId))
    .run();
  return getRawState(guildId);
}

const RENAME_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export function getRenameCooldownRemaining(guildId) {
  const state = ensureState(guildId);
  if (!state.renamedAt) return 0;
  return Math.max(0, RENAME_COOLDOWN_MS - (Date.now() - state.renamedAt));
}

export function renamePeaches(guildId, newName) {
  ensureState(guildId);
  db.update(peachesState).set({ name: newName, renamedAt: Date.now() }).where(eq(peachesState.guildId, guildId)).run();
  return getRawState(guildId);
}

export function bumpLastSpawnAt(guildId) {
  db.update(peachesState).set({ lastSpawnAt: Date.now() }).where(eq(peachesState.guildId, guildId)).run();
}
