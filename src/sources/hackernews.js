// Hacker News через публичный Algolia API — без ключа.
const UA = 'naglyadno-bot/0.1 (+https://naglyadno.tech)';

export async function fetchHackerNews({ minPoints = 150, limit = 30 } = {}) {
  const since = Math.floor(Date.now() / 1000) - 5 * 24 * 3600; // 5 дней
  const url =
    `https://hn.algolia.com/api/v1/search_by_date?tags=story` +
    `&numericFilters=created_at_i>${since},points>${minPoints}&hitsPerPage=${limit}`;
  const r = await fetch(url, { headers: { 'user-agent': UA } });
  if (!r.ok) throw new Error(`HN API ${r.status}`);
  const { hits } = await r.json();
  return hits
    .filter((h) => h.title)
    .map((h) => ({
      source: 'HackerNews',
      title: h.title,
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      discussion: `https://news.ycombinator.com/item?id=${h.objectID}`,
      score: h.points,
      comments: h.num_comments,
      at: h.created_at,
    }));
}
