// Роль 3 — Scriptwriter. selected -> готовая колода слайдов (slides_json) + подпись + фактчек.
import { askJSON, roleSystemPrompt } from '../llm.js';
import { itemsByStatus, updateItem, getItem, logRun } from '../db.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { logger } from '../log.js';

const log = logger('script');
const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA = readFileSync(join(__dirname, '..', 'render', 'schema.example.json'), 'utf8');

export async function runScriptwriter() {
  const items = itemsByStatus('selected');
  if (!items.length) {
    log.warn('нет тем в статусе selected');
    return [];
  }
  const system = roleSystemPrompt('03-scriptwriter.md');
  const done = [];

  for (const it of items) {
    const brief = {
      topic_root: it.topic_root,
      title: it.title,
      rubric: it.rubric,
      source_url: it.source_url,
      demo_url: it.demo_url,
      candidate: JSON.parse(it.candidates_json || '{}'),
      editor: JSON.parse(it.selected_json || '{}'),
    };
    const user = [
      'Напиши готовую карусель по этой теме строго в голосе бренда.',
      'Обязательно: слайд hook, слайд oneframe («как это работает»), слайд replaces («что заменяет»),',
      'слайд details, слайд try («пощупать за 30 секунд» с реальной живой ссылкой), слайд foretell («через год»).',
      'Каждый термин-англицизм оборачивай как <term>термин|расшифровка в 2 слова</term>.',
      'Заголовки ≤ 7 слов. Одна мысль на слайд.',
      'Верни JSON РОВНО по этой схеме (те же ключи и типы):',
      SCHEMA,
      '',
      'В ответе заполни: rubric (русское название), theme ("dark"/"light"), clarity {emoji,label},',
      'demoUrl (= demo_url из брифа), slides[], caption, hashtags (4–6, через пробел), factcheck (источники через ;).',
      '',
      'БРИФ:',
      JSON.stringify(brief),
    ].join('\n');

    try {
      const deck = await askJSON({ system, user, maxTokens: 4000, temperature: 0.75 });
      if (!Array.isArray(deck.slides) || deck.slides.length < 4) {
        throw new Error('модель вернула меньше 4 слайдов');
      }
      deck.demoUrl = deck.demoUrl || it.demo_url || '';
      // включить авто-скриншот демо в hook, если есть куда идти
      const hook = deck.slides.find((s) => s.type === 'hook');
      if (hook && deck.demoUrl) hook.screenshot = true;

      updateItem(it.id, {
        status: 'scripted',
        title: deck.slides[0]?.title || it.title,
        slides_json: JSON.stringify(deck),
        caption: deck.caption || '',
        hashtags: deck.hashtags || '',
      });
      logRun('script', it.id, 'ok');
      done.push(it.id);
      log.ok(`#${it.id} ${it.topic_root}: ${deck.slides.length} слайдов`);
    } catch (e) {
      updateItem(it.id, { error: `script: ${e.message}` });
      logRun('script', it.id, 'error', e.message);
      log.error(`#${it.id}: ${e.message}`);
    }
  }
  return done;
}
