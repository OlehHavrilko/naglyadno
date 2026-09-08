// Роль 5b — Tracker. published (старше 48ч, ещё не tracked) -> метрики -> tracked.
import { db, updateItem, logRun } from '../db.js';
import { fetchMetrics } from '../publish/index.js';
import { logger } from '../log.js';

const log = logger('track');

export async function runTrack() {
  const rows = db()
    .prepare(
      `SELECT * FROM items
       WHERE status = 'published'
         AND published_at IS NOT NULL
         AND published_at <= datetime('now', '-48 hours')`,
    )
    .all();
  if (!rows.length) {
    log.info('нет постов, готовых к трекингу');
    return [];
  }
  const done = [];
  for (const it of rows) {
    try {
      if (!it.post_id) {
        log.warn(`#${it.id}: нет post_id — пропуск`);
        continue;
      }
      const m = await fetchMetrics(it.post_id);
      updateItem(it.id, { status: 'tracked', metrics_json: JSON.stringify(m) });
      logRun('track', it.id, 'ok', `views=${m.views ?? '?'}`);
      done.push(it.id);
      log.ok(`#${it.id}: views=${m.views ?? '?'} likes=${m.likes ?? '?'}`);
    } catch (e) {
      logRun('track', it.id, 'error', e.message);
      log.error(`#${it.id}: ${e.message}`);
    }
  }
  return done;
}
