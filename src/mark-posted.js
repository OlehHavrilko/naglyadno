// Отметить материал как опубликованный вручную.
//   node src/mark-posted.js <id> <url> [views] [likes] [saves] [comments]
import { db, getItem, updateItem, logRun } from './db.js';

const [, , idArg, url, views, likes, saves, comments] = process.argv;
const id = Number(idArg);

if (!id || !url) {
  console.error('Использование: npm run mark-posted -- <id> <url-поста> [views likes saves comments]');
  process.exit(1);
}
db();
const it = getItem(id);
if (!it) {
  console.error(`материал #${id} не найден`);
  process.exit(1);
}

const metrics =
  views || likes || saves || comments
    ? { views: num(views), likes: num(likes), saves: num(saves), comments: num(comments), manual: true }
    : null;

updateItem(id, {
  status: metrics ? 'tracked' : 'published',
  post_url: url,
  published_at: it.published_at || new Date().toISOString(),
  ...(metrics ? { metrics_json: JSON.stringify(metrics) } : {}),
});
logRun('mark-posted', id, 'ok', url);
console.log(`OK: #${id} → ${metrics ? 'tracked' : 'published'} · ${url}`);

function num(v) {
  return v == null || v === '' ? null : Number(v);
}
