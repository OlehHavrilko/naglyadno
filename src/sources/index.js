// Сбор сырых сигналов из всех доступных источников в один список.
import { fetchHackerNews } from './hackernews.js';
import { fetchReddit } from './reddit.js';
import { fetchGithubTrending } from './github-trending.js';
import { logger } from '../log.js';

const log = logger('sources');

export async function gatherSignals() {
  const jobs = [
    ['HackerNews', fetchHackerNews()],
    ['Reddit', fetchReddit()],
    ['GitHubTrending', fetchGithubTrending({ since: 'daily' })],
    ['GitHubTrendingWeek', fetchGithubTrending({ since: 'weekly' })],
  ];
  const all = [];
  for (const [name, p] of jobs) {
    try {
      const rows = await p;
      log.info(`${name}: ${rows.length}`);
      all.push(...rows);
    } catch (e) {
      log.warn(`${name}: ${e.message}`);
    }
  }
  // Грубая дедупликация по нормализованному заголовку.
  const seen = new Set();
  const dedup = [];
  for (const s of all) {
    const k = s.title.toLowerCase().replace(/[^a-zа-я0-9 ]/gi, '').slice(0, 80);
    if (seen.has(k)) continue;
    seen.add(k);
    dedup.push(s);
  }
  return dedup;
}
