/**
 * Scores how well `query` fuzzy-matches `target` as a subsequence, favoring
 * consecutive characters and matches near the start. Returns -1 if `query`
 * isn't a subsequence of `target` at all. No dependency needed for
 * autocomplete-scale lists (dozens to low hundreds of entries).
 */
export function fuzzyScore(query, target) {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (q.length === 0) return 0;

  let score = 0;
  let queryIndex = 0;
  let consecutive = 0;

  for (let i = 0; i < t.length && queryIndex < q.length; i++) {
    if (t[i] === q[queryIndex]) {
      consecutive += 1;
      score += 1 + consecutive; // reward runs of consecutive matches
      if (i === queryIndex) score += 2; // bonus for matching position from the start
      queryIndex += 1;
    } else {
      consecutive = 0;
    }
  }

  return queryIndex === q.length ? score : -1;
}

/** Filters + ranks `items` by fuzzy match against `query`, best first. */
export function fuzzySearch(query, items, { key = (item) => item, limit = 25 } = {}) {
  if (!query) return items.slice(0, limit);

  const q = normalizeForMatch(query);
  return items
    .map((item) => {
      const target = key(item);
      const normalized = normalizeForMatch(target);
      return { item, score: fuzzyScore(query, target), exact: normalized === q, length: target.length };
    })
    .filter(({ score }) => score >= 0)
    // Subsequence scoring alone ties every target that starts with the
    // query ("PEAK" scores the same against "PEAK" and "Peaky Blinders"),
    // so an exact match wins outright and shorter names break the rest of
    // the ties — otherwise the default news seed followed the wrong game.
    .sort((a, b) => Number(b.exact) - Number(a.exact) || b.score - a.score || a.length - b.length)
    .slice(0, limit)
    .map(({ item }) => item);
}

/** Lowercases and strips ™/®/punctuation so "Overwatch® 2" exactly matches "overwatch 2". */
export function normalizeForMatch(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N} ]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
