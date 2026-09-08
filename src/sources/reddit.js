// Reddit — публичный JSON сабреддита (top за неделю). Ключ не обязателен.
const UA = 'naglyadno-bot/0.1 (by /u/naglyadno)';
const SUBS = [
  'InternetIsBeautiful',
  'LocalLLaMA',
  'StableDiffusion',
  'artificial',
  'technology',
];

export async function fetchReddit({ perSub = 8 } = {}) {
  const out = [];
  for (const sub of SUBS) {
    try {
      const r = await fetch(
        `https://www.reddit.com/r/${sub}/top.json?t=week&limit=${perSub}`,
        { headers: { 'user-agent': UA } },
      );
      if (!r.ok) continue;
      const j = await r.json();
      for (const { data: d } of j.data.children) {
        if (d.stickied || d.over_18) continue;
        out.push({
          source: `Reddit r/${sub}`,
          title: d.title,
          url: d.url_overridden_by_dest || `https://reddit.com${d.permalink}`,
          discussion: `https://reddit.com${d.permalink}`,
          score: d.ups,
          comments: d.num_comments,
          at: new Date(d.created_utc * 1000).toISOString(),
        });
      }
    } catch {
      /* пропускаем упавший сабреддит */
    }
  }
  return out;
}
