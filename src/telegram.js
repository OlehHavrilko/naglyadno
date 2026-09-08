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

export async function sendPreview(item, files, caption) {
  const chat_id = config.telegram.chatId;
  // multipart-загрузка альбома
  const form = new FormData();
  form.set('chat_id', chat_id);
  const media = files.slice(0, 10).map((f, i) => {
    const name = `p${i}`;
    form.set(name, new Blob([readFileSync(f)], { type: 'image/png' }), `${i + 1}.png`);
    return { type: 'photo', media: `attach://${name}`, ...(i === 0 ? { caption: `#${item.id} ${item.title || ''}` } : {}) };
  });
  form.set('media', JSON.stringify(media));
  const r = await fetch(api('sendMediaGroup'), { method: 'POST', body: form });
  const d = await r.json();
  if (!d.ok) throw new Error(`sendMediaGroup: ${JSON.stringify(d)}`);

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

export async function notify(text) {
  if (!telegramReady()) return;
  await tg('sendMessage', { chat_id: config.telegram.chatId, text }).catch((e) => log.warn(e.message));
}
