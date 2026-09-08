// Роль 2 — Editor. Из кандидатов('scouted') выбирает ITEMS_PER_CYCLE тем,
// назначает рубрику, 2 хука, наметки блоков. Остальных -> 'rejected'.
import { askJSON, roleSystemPrompt } from '../llm.js';
import { itemsByStatus, updateItem, isTopicTaken, logRun } from '../db.js';
import { config } from '../config.js';
import { logger } from '../log.js';

const log = logger('editor');

export async function runEditor() {
  const pool = itemsByStatus('scouted');
  if (!pool.length) {
    log.warn('нет кандидатов в статусе scouted');
    return [];
  }
  const system = roleSystemPrompt('02-editor.md');
  const cands = pool.map((it) => ({ id: it.id, ...JSON.parse(it.candidates_json || '{}') }));
  const user = [
    `Выбери ровно ${config.itemsPerCycle} тем(ы) из списка кандидатов для съёмки в этот цикл.`,
    'Учитывай баланс недели (3+ рубрики), не больше 1 «тяжёлой» темы, наличие визуала.',
    'Для каждой выбранной темы верни: id, рубрику (PD|F20|BA|ALT|VIR|MEM), ракурс,',
    'два варианта хука, наметки блоков «что заменяет» и «через год», «пощупать за 30 сек»,',
    'итоговую оценку понятности (green|yellow|orange), demo_url для скриншота.',
    '',
    'Верни JSON: {"selected":[{"id","rubric","angle","hooks":["",""],"replaces","foretell","try","clarity","demo_url"}],"rejected_ids":[...]}',
    '',
    'КАНДИДАТЫ:',
    JSON.stringify(cands),
  ].join('\n');

  const out = await askJSON({ system, user, maxTokens: 3000, temperature: 0.5 });
  const selected = out.selected || [];
  const chosenIds = new Set(selected.map((s) => Number(s.id)));

  const result = [];
  for (const s of selected) {
    const it = pool.find((p) => p.id === Number(s.id));
    if (!it) continue;
    if (isTopicTaken(it.topic_root, 30)) {
      log.warn(`тема ${it.topic_root} занята — пропуск`);
      updateItem(it.id, { status: 'rejected', error: 'topic taken at editor stage' });
      continue;
    }
    updateItem(it.id, {
      status: 'selected',
      rubric: s.rubric || it.rubric,
      hook: (s.hooks && s.hooks[0]) || it.hook,
      clarity: s.clarity || it.clarity,
      demo_url: s.demo_url || it.demo_url,
      selected_json: JSON.stringify(s),
    });
    logRun('editor', it.id, 'ok', s.rubric || '');
    result.push(it.id);
  }
  // остальных — в rejected
  for (const it of pool) {
    if (!chosenIds.has(it.id)) updateItem(it.id, { status: 'rejected' });
  }
  log.ok(`выбрано: ${result.length}, отклонено: ${pool.length - result.length}`);
  return result;
}
