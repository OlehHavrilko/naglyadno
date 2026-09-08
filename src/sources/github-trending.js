// GitHub Trending — HTML-страница, парсим через cheerio. Без ключа.
import * as cheerio from 'cheerio';
const UA = 'naglyadno-bot/0.1';

export async function fetchGithubTrending({ since = 'daily', limit = 25 } = {}) {
  const r = await fetch(`https://github.com/trending?since=${since}`, {
    headers: { 'user-agent': UA },
  });
  if (!r.ok) throw new Error(`GitHub Trending ${r.status}`);
  const $ = cheerio.load(await r.text());
  const out = [];
  $('article.Box-row').each((i, el) => {
    if (i >= limit) return;
    const repo = $(el).find('h2 a').attr('href')?.trim();
    if (!repo) return;
    const desc = $(el).find('p').text().trim();
    const lang = $(el).find('[itemprop="programmingLanguage"]').text().trim();
    const starsToday = $(el).find('.float-sm-right').text().trim();
    out.push({
      source: 'GitHub Trending',
      title: repo.replace(/^\//, '') + (desc ? ` — ${desc}` : ''),
      url: `https://github.com${repo}`,
      discussion: `https://github.com${repo}`,
      score: starsToday,
      lang,
      at: new Date().toISOString(),
    });
  });
  return out;
}
