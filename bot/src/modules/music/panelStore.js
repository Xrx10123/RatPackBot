import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { voicePanels } from '../../db/schema.js';

export function getPanelRow(voiceChannelId) {
  return db.select().from(voicePanels).where(eq(voicePanels.voiceChannelId, voiceChannelId)).get();
}

export function getLatestPanelRowForGuild(guildId) {
  return db.select().from(voicePanels).where(eq(voicePanels.guildId, guildId)).orderBy(desc(voicePanels.updatedAt)).get();
}

export function getPanelRowByMessageId(messageId) {
  return db.select().from(voicePanels).where(eq(voicePanels.messageId, messageId)).get();
}

/** The channel a panel row's message actually lives in (the VC chat, or the fallback music channel). */
export function panelMessageChannelId(row) {
  return row?.messageChannelId ?? row?.voiceChannelId ?? null;
}

export function upsertPanelRow({ guildId, voiceChannelId, messageId, messageChannelId = null }) {
  const existing = getPanelRow(voiceChannelId);
  if (existing) {
    db.update(voicePanels).set({ messageId, messageChannelId, updatedAt: Date.now() }).where(eq(voicePanels.voiceChannelId, voiceChannelId)).run();
  } else {
    db.insert(voicePanels).values({ guildId, voiceChannelId, messageId, messageChannelId, updatedAt: Date.now() }).run();
  }
}

export function deletePanelRow(voiceChannelId) {
  db.delete(voicePanels).where(eq(voicePanels.voiceChannelId, voiceChannelId)).run();
}
