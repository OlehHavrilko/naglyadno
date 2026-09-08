// Роль 4 — Visual Producer. scripted -> PNG-слайды на диске. media_json = локальные пути.
import { renderDeck } from '../render/render.js';
import { itemsByStatus, updateItem, logRun } from '../db.js';
import { paths } from '../config.js';
import { join } from 'node:path';
import { logger } from '../log.js';

const log = logger('render-stage');

export async function runRender() {
  const items = itemsByStatus('scripted');
  if (!items.length) {
    log.warn('нет тем в статусе scripted');
    return [];
  }
  const done = [];
  for (const it of items) {
    try {
      const deck = JSON.parse(it.slides_json);
      const outDir = join(paths.output, `item-${it.id}`);
      const { files, dir } = await renderDeck(deck, { outDir, demoUrl: it.demo_url });
      updateItem(it.id, {
        status: 'rendered',
        media_json: JSON.stringify({ dir, files }),
      });
      logRun('render', it.id, 'ok', `${files.length} png`);
      done.push(it.id);
    } catch (e) {
      updateItem(it.id, { error: `render: ${e.message}` });
      logRun('render', it.id, 'error', e.message);
      log.error(`#${it.id}: ${e.message}`);
    }
  }
  return done;
}
