// Роль 5 — Publisher. rendered -> (ревью в Telegram) -> заливка PNG -> публикация -> published.
import { itemsByStatus, updateItem, getItem, logRun } from '../db.js';
import { config } from '../config.js';
import { uploadMany } from '../publish/imagehost.js';
import { publish } from '../publish/index.js';
import { telegramReady, sendPreview, waitForDecision, notify } from '../telegram.js';
import { logger } from '../log.js';

const log = logger('publish');

export async function runPublish() {
  const items = itemsByStatus('rendered');
  if (!items.length) {
    log.warn('нет тем в статусе rendered');
    return [];
  }
  const published = [];

  for (const it of items) {
    const media = JSON.parse(it.media_json || '{}');
    const files = media.files || [];
    if (!files.length) {
      updateItem(it.id, { status: 'rejected', error: 'нет отрендеренных файлов' });
      continue;
    }

    // ── Ревью ──
    if (!config.telegram.autoPublish) {
      if (!telegramReady()) {
        log.warn(`#${it.id}: AUTO_PUBLISH=false, но Telegram не настроен — оставляю на ревью вручную`);
        continue;
      }
      await sendPreview(it, files, it.caption || '');
      updateItem(it.id, { status: 'awaiting_approval' });
      const decision = await waitForDecision(it.id);
      if (decision === 'rejected') {
        updateItem(it.id, { status: 'rejected', error: 'отклонено в Telegram' });
        logRun('publish', it.id, 'skipped', 'rejected in telegram');
        continue;
      }
      if (decision === 'timeout') {
        updateItem(it.id, { status: 'rendered' }); // вернуть в очередь на следующий прогон
        await notify(`⏳ Материал #${it.id} не подтверждён за ${config.telegram.approvalTimeoutMin} мин — отложен.`);
        logRun('publish', it.id, 'skipped', 'approval timeout');
        continue;
      }
      updateItem(it.id, { status: 'approved' });
    }

    // ── Заливка + публикация ──
    try {
      const urls = await uploadMany(files, `posts/item-${it.id}`);
      const { postId, postUrl, raw } = await publish({ imageUrls: urls, caption: it.caption || '' });
      updateItem(it.id, {
        status: 'published',
        post_id: postId || null,
        post_url: postUrl || null,
        published_at: new Date().toISOString(),
        media_json: JSON.stringify({ ...media, urls, publish_raw: raw }),
      });
      logRun('publish', it.id, 'ok', postUrl || postId || '');
      await notify(`✅ Опубликовано #${it.id}: ${it.title}\n${postUrl || '(ссылка появится после обработки TikTok)'}`);
      published.push(it.id);
      log.ok(`#${it.id} -> ${postUrl || postId}`);
    } catch (e) {
      updateItem(it.id, { status: 'approved', error: `publish: ${e.message}` });
      logRun('publish', it.id, 'error', e.message);
      await notify(`⚠️ Ошибка публикации #${it.id}: ${e.message}`);
      log.error(`#${it.id}: ${e.message}`);
    }
  }
  return published;
}
