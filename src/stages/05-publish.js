// Роль 5 — Publisher.
//   PUBLISH_PROVIDER=manual  → собрать пакет для ручной загрузки, НЕ постить.
//   ayrshare | tiktok        → ревью в Telegram → заливка PNG → публикация.
import { itemsByStatus, updateItem, logRun } from '../db.js';
import { config } from '../config.js';
import { writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { logger } from '../log.js';

const log = logger('publish');

function buildPackage(item, deck, files) {
  const stripTerms = (s) =>
    String(s || '').replace(/<term>(.+?)\|(.+?)<\/term>/g, '$1 ($2)').replace(/<\/?term>/g, '');
  const tryLine = stripTerms((deck.slides || []).find((s) => s.type === 'try')?.body || item.demo_url || '');
  return [
    `# PUBLISH — #${item.id} · ${item.rubric || ''} · ${item.topic_root}`,
    ``,
    `**${item.title || ''}**`,
    ``,
    `## Слайды (загружать в этом порядке)`,
    ...files.map((f, i) => `${i + 1}. ${basename(f)}`),
    ``,
    `## Подпись (вставить как есть)`,
    ``,
    (item.caption || deck.caption || '').trim(),
    ``,
    `## Хэштеги`,
    ``,
    (item.hashtags || deck.hashtags || '').trim(),
    ``,
    `## Пощупать / ссылка`,
    ``,
    tryLine,
    ``,
    `## Фактчек / источники`,
    ``,
    (deck.factcheck || '—').trim(),
    ``,
    `## Вручную`,
    `1. TikTok → новый пост → фото-карусель → PNG выше, по порядку.`,
    `2. Обложка — слайд 1. Подпись + хэштеги — из блоков выше.`,
    `3. После публикации записать ссылку:`,
    ``,
    '   ```',
    `   npm run mark-posted -- ${item.id} <ссылка-на-пост>`,
    '   ```',
    ``,
  ].join('\n');
}

async function runManual(items) {
  const ready = [];
  for (const it of items) {
    const media = JSON.parse(it.media_json || '{}');
    const files = media.files || [];
    if (!files.length) {
      updateItem(it.id, { status: 'rejected', error: 'нет отрендеренных файлов' });
      continue;
    }
    const deck = JSON.parse(it.slides_json || '{}');
    const md = buildPackage(it, deck, files);
    const path = join(media.dir, 'PUBLISH.md');
    writeFileSync(path, md, 'utf8');
    updateItem(it.id, { status: 'ready' });
    logRun('publish', it.id, 'ok', 'manual package');
    log.ok(`#${it.id}: пакет готов → ${path}`);
    ready.push(it.id);
  }
  return ready;
}

async function runAuto(items) {
  // ленивые импорты: не тянуть провайдеров в manual-режиме
  const { uploadMany } = await import('../publish/imagehost.js');
  const { publish } = await import('../publish/index.js');
  const { telegramReady, sendPreview, waitForDecision, notify } = await import('../telegram.js');

  const published = [];
  for (const it of items) {
    const media = JSON.parse(it.media_json || '{}');
    const files = media.files || [];
    if (!files.length) {
      updateItem(it.id, { status: 'rejected', error: 'нет отрендеренных файлов' });
      continue;
    }

    if (!config.telegram.autoPublish) {
      if (!telegramReady()) {
        log.warn(`#${it.id}: AUTO_PUBLISH=false и Telegram не настроен — оставляю на ревью`);
        continue;
      }
      await sendPreview(it, files, it.caption || '');
      updateItem(it.id, { status: 'awaiting_approval' });
      const decision = await waitForDecision(it.id);
      if (decision === 'rejected') {
        updateItem(it.id, { status: 'rejected', error: 'отклонено в Telegram' });
        continue;
      }
      if (decision === 'timeout') {
        updateItem(it.id, { status: 'rendered' });
        await notify(`⏳ #${it.id} не подтверждён — отложен.`);
        continue;
      }
      updateItem(it.id, { status: 'approved' });
    }

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
      await notify(`✅ Опубликовано #${it.id}: ${it.title}\n${postUrl || '(ссылка после обработки)'}`);
      published.push(it.id);
    } catch (e) {
      updateItem(it.id, { status: 'approved', error: `publish: ${e.message}` });
      logRun('publish', it.id, 'error', e.message);
      log.error(`#${it.id}: ${e.message}`);
    }
  }
  return published;
}

export async function runPublish() {
  const items = itemsByStatus('rendered');
  if (!items.length) {
    log.warn('нет тем в статусе rendered');
    return [];
  }
  return config.publish.provider === 'manual' ? runManual(items) : runAuto(items);
}
