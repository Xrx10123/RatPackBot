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

  return items
    .map((item) => ({ item, score: fuzzyScore(query, key(item)) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => item);
}
