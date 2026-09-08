// Роль 1 — Trend Scout. Источники -> LLM -> кандидаты -> антиповтор -> items('scouted').
import { gatherSignals } from '../sources/index.js';
import { askJSON, roleSystemPrompt } from '../llm.js';
import { insertItem, recentTopicRoots, logRun } from '../db.js';
import { logger } from '../log.js';

const log = logger('scout');
const CLARITY = { '🟢': 'green', '🟡': 'yellow', '🟠': 'orange', green: 'green', yellow: 'yellow', orange: 'orange' };

export async function runScout() {
  const signals = await gatherSignals();
  log.info(`сырых сигналов: ${signals.length}`);
  if (!signals.length) throw new Error('источники не дали ни одного сигнала');

  const taken = recentTopicRoots(30);
  const system = roleSystemPrompt('01-trend-scout.md');
  const user = [
    'Вот сырые сигналы из источников (JSON). Отбери 5–10 тем, понятных не-технарю за 5 секунд,',
    'с визуалом для показа. Применяй 5 критериев отбора из своей роли.',
    'Для каждой темы дай короткий topic_root (латиница-дефис, напр. "local-video-gen"),',
    'простое описание, ссылку, что показать, оценку понятности, гипотезу рубрики (PD|F20|BA|ALT|VIR|MEM),',
    'и demo_url — публичную страницу/демо, которую можно заскриншотить для слайда «как это работает».',
    '',
    `Уже выходило за 30 дней (не повторять эти topic_root): ${JSON.stringify(taken)}`,
    '',
    'Верни JSON: {"candidates":[{"topic_root","title","summary","url","demo_url","show","clarity":"green|yellow|orange","rubric","note"}]}',
    '',
    'СИГНАЛЫ:',
    JSON.stringify(signals.slice(0, 80)),
  ].join('\n');

  const out = await askJSON({ system, user, maxTokens: 4000, temperature: 0.6 });
  const cands = (out.candidates || []).filter((c) => c.topic_root && c.title);
  const fresh = cands.filter((c) => !taken.includes(c.topic_root));
  log.info(`кандидатов от LLM: ${cands.length}, после антиповтора: ${fresh.length}`);

  const ids = [];
  for (const c of fresh) {
    const id = insertItem({
      status: 'scouted',
      rubric: c.rubric || null,
      topic_root: c.topic_root,
      title: c.title,
      source_url: c.url || null,
      demo_url: c.demo_url || null,
      clarity: CLARITY[c.clarity] || null,
      candidates_json: JSON.stringify(c),
    });
    ids.push(id);
    logRun('scout', id, 'ok', c.topic_root);
  }
  log.ok(`создано кандидатов: ${ids.length}`);
  return ids;
}
