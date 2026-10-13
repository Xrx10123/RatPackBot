const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Fetches JSON and throws a descriptive error on a non-2xx response. Every
 * call gets a timeout — without one, a single hung upstream (a status page,
 * Steam, lrclib) stalls the whole sequential poll loop it's part of, and an
 * interaction waiting on it just silently expires.
 */
export async function fetchJson(url, { timeoutMs = DEFAULT_TIMEOUT_MS, ...options } = {}) {
  const res = await fetch(url, { ...options, signal: options.signal ?? AbortSignal.timeout(timeoutMs) });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} — ${url}`);
  }
  return res.json();
}
