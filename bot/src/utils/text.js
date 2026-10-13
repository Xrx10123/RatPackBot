/**
 * Discord rejects component labels/descriptions that are empty or over 100
 * chars — and one bad option fails the WHOLE message (e.g. a single queued
 * radio stream with a blank author used to break every panel render).
 * Use this for any user/track-supplied text going into a component.
 */
export function componentText(value, fallback = 'Unknown', max = 100) {
  const text = String(value ?? '').trim();
  const safe = text.length > 0 ? text : fallback;
  return safe.length > max ? `${safe.slice(0, max - 1)}…` : safe;
}

/** Escapes Discord markdown so titles like "**WARNING**" or "Song_Name_" render literally. */
export function escapeMarkdown(value) {
  return String(value ?? '').replace(/([\\*_~`|>[\]])/g, '\\$1');
}
