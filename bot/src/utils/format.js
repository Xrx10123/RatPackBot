/** Formats milliseconds as `m:ss` or `h:mm:ss`. */
export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '0:00';

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n) => String(n).padStart(2, '0');

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/** Renders a text progress bar like `▬▬▬🔘▬▬▬▬▬▬ 1:23 / 3:45`. */
export function formatProgressBar(positionMs, durationMs, { length = 20 } = {}) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return `🔴 LIVE`;
  }

  const ratio = Math.min(Math.max(positionMs / durationMs, 0), 1);
  const filled = Math.round(ratio * length);
  const bar = '▬'.repeat(filled) + '🔘' + '▬'.repeat(Math.max(length - filled, 0));

  return `${bar} ${formatDuration(positionMs)} / ${formatDuration(durationMs)}`;
}

/** Joins items as a numbered list, one per line. */
export function formatList(items, { start = 1 } = {}) {
  return items.map((item, i) => `${start + i}. ${item}`).join('\n');
}
