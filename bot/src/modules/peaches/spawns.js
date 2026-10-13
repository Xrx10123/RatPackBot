import { randomUUID } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { peachesSpawns } from '../../db/schema.js';

const VARIANTS = [
  { variant: 'normal', weight: 70 },
  { variant: 'fancy', weight: 7.5 },
  { variant: 'angry', weight: 7.5 },
  { variant: 'sneaky', weight: 7.5 },
  { variant: 'queen', weight: 7.5 },
  { variant: 'ghost', weight: 20, season: 'halloween' },
];

/** Seasonal variants only roll while their season is active. */
export function pickVariant(season = null, random = Math.random) {
  const pool = VARIANTS.filter((v) => !v.season || v.season === season);
  const total = pool.reduce((sum, v) => sum + v.weight, 0);
  let roll = random() * total;
  for (const v of pool) {
    if (roll < v.weight) return v.variant;
    roll -= v.weight;
  }
  return 'normal';
}

export function getActiveSpawn(guildId) {
  return db.select().from(peachesSpawns).where(and(eq(peachesSpawns.guildId, guildId), eq(peachesSpawns.resolved, 0))).get();
}

export function getSpawnById(id) {
  return db.select().from(peachesSpawns).where(eq(peachesSpawns.id, id)).get();
}

export function createSpawn({ guildId, channelId, variant, expiresInMs }) {
  const row = {
    id: randomUUID(),
    guildId,
    channelId,
    messageId: null,
    spawnedAt: Date.now(),
    expiresAt: Date.now() + expiresInMs,
    variant,
    resolved: 0,
  };
  db.insert(peachesSpawns).values(row).run();
  return row;
}

export function setSpawnMessageId(id, messageId) {
  db.update(peachesSpawns).set({ messageId }).where(eq(peachesSpawns.id, id)).run();
}

export function resolveSpawn(id) {
  db.update(peachesSpawns).set({ resolved: 1 }).where(eq(peachesSpawns.id, id)).run();
}
