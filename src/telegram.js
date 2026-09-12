// Ревью в Telegram: отправить альбом слайдов + кнопки, дождаться реакции.
import { readFileSync } from 'node:fs';
import { config } from './config.js';
import { logger } from './log.js';

const log = logger('telegram');
const api = (m) => `https://api.telegram.org/bot${config.telegram.botToken}/${m}`;
const fileApi = () => `https://api.telegram.org/file/bot${config.telegram.botToken}`;

export function telegramReady() {
  return Boolean(config.telegram.botToken && config.telegram.chatId);
}

async function tg(method, payload) {
  const res = await fetch(api(method), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram ${method}: ${JSON.stringify(data)}`);
  return data.result;
}

/**
 * Режет список файлов на альбомы по правилам Telegram: sendMediaGroup
 * принимает от 2 до 10 медиа, ровно 1 элемент он отклоняет. Поэтому
 * альбом из одного файла уходит отдельным sendPhoto, а остальное режется
 * на равные части (не по 10 подряд — иначе на 11 файлах получится хвост
 * из одного элемента).
 */
function chunkForAlbums(files) {
  if (files.length <= 1) return files.length ? [files] : [];
  const parts = Math.ceil(files.length / 10);
  const size = Math.ceil(files.length / parts);
  const chunks = [];
  for (let i = 0; i < files.length; i += size) chunks.push(files.slice(i, i + size));
  return chunks;
}

async function sendChunkAsAlbum(chat_id, chunk, offset, extraFirstMedia) {
  if (chunk.length === 1) {
    const form = new FormData();
    form.set('chat_id', chat_id);
    form.set('photo', new Blob([readFileSync(chunk[0])], { type: 'image/png' }), `${offset + 1}.png`);
    if (extraFirstMedia?.caption) form.set('caption', extraFirstMedia.caption);
    const r = await fetch(api('sendPhoto'), { method: 'POST', body: form });
    const d = await r.json();
    if (!d.ok) throw new Error(`sendPhoto: ${JSON.stringify(d)}`);
    return;
  }
  const form = new FormData();
  form.set('chat_id', chat_id);
  const media = chunk.map((f, i) => {
    const name = `p${i}`;
    form.set(name, new Blob([readFileSync(f)], { type: 'image/png' }), `${offset + i + 1}.png`);
    return { type: 'photo', media: `attach://${name}`, ...(i === 0 && extraFirstMedia ? extraFirstMedia : {}) };
  });
  form.set('media', JSON.stringify(media));
  const r = await fetch(api('sendMediaGroup'), { method: 'POST', body: form });
  const d = await r.json();
  if (!d.ok) throw new Error(`sendMediaGroup: ${JSON.stringify(d)}`);
}

export async function sendPreview(item, files, caption) {
  const chat_id = config.telegram.chatId;
  let offset = 0;
  for (const chunk of chunkForAlbums(files)) {
    await sendChunkAsAlbum(chat_id, chunk, offset, offset === 0 ? { caption: `#${item.id} ${item.title || ''}` } : undefined);
    offset += chunk.length;
  }

  await tg('sendMessage', {
    chat_id,
    text:
      `Материал #${item.id} — ${item.rubric || ''}\n` +
      `${item.title || ''}\n\n` +
      `Подпись:\n${caption}\n\n` +
      `Опубликовать?`,
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Постить', callback_data: `pub:${item.id}` },
        { text: '❌ Скип', callback_data: `skip:${item.id}` },
      ]],
    },
  });
  log.info(`превью #${item.id} отправлено`);
}

/**
 * Ждёт нажатие кнопки для конкретного item. Возвращает 'approved' | 'rejected' | 'timeout'.
 * Реализация на long-polling getUpdates (без вебхука).
 */
export async function waitForDecision(itemId, timeoutMin = config.telegram.approvalTimeoutMin) {
  const deadline = Date.now() + timeoutMin * 60_000;
  let offset = 0;
  while (Date.now() < deadline) {
    let updates = [];
    try {
      updates = await tg('getUpdates', { offset, timeout: 30, allowed_updates: ['callback_query'] });
    } catch (e) {
      log.warn(e.message);
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }
    for (const u of updates) {
      offset = u.update_id + 1;
      const cq = u.callback_query;
      if (!cq) continue;
      const [action, id] = String(cq.data || '').split(':');
      if (Number(id) !== Number(itemId)) {
        await tg('answerCallbackQuery', { callback_query_id: cq.id }).catch(() => {});
        continue;
      }
      await tg('answerCallbackQuery', { callback_query_id: cq.id, text: action === 'pub' ? 'Публикую…' : 'Пропущено' }).catch(() => {});
      return action === 'pub' ? 'approved' : 'rejected';
    }
  }
  return 'timeout';
}

/**
 * Публикация в канал от имени бота. Бот должен быть админом канала
 * с правом «Публикация сообщений».
 *
 * Telegram не принимает больше 10 медиа в одном альбоме, поэтому набор
 * режется на части: 11 карточек уедут двумя альбомами, а не потеряют последнюю.
 * Подпись к альбому ограничена 1024 символами, поэтому текст поста уходит
 * отдельным сообщением следом.
 *
 * @param {string[]} files  пути к PNG в порядке публикации
 * @param {string} text     текст поста (без лимита альбома)
 */
export async function publishToChannel(files, text) {
  const chat_id = config.telegram.channelId;
  if (!chat_id) throw new Error('TELEGRAM_CHANNEL_ID не задан');

  const chunks = chunkForAlbums(files);
  let offset = 0;
  for (const [n, chunk] of chunks.entries()) {
    await sendChunkAsAlbum(chat_id, chunk, offset);
    offset += chunk.length;
    log.info(`альбом ${n + 1} из ${chunks.length}: ${chunk.length} шт. опубликовано`);
  }

  if (text) {
    await tg('sendMessage', { chat_id, text, disable_web_page_preview: true });
  }
  log.ok(`опубликовано в ${chat_id}: ${files.length} карточек`);
}

export async function notify(text) {
  if (!telegramReady()) return;
  await tg('sendMessage', { chat_id: config.telegram.chatId, text }).catch((e) => log.warn(e.message));
}
