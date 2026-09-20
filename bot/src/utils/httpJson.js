/** Fetches JSON and throws a descriptive error on a non-2xx response. */
export async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} — ${url}`);
  }
  return res.json();
}
