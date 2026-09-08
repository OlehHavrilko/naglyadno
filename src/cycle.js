// Оркестратор пайплайна. Запуск отдельной стадии или всего цикла подряд.
//   node --env-file=.env src/cycle.js            # весь цикл: scout..publish
//   node --env-file=.env src/cycle.js scout      # одна стадия
//   node --env-file=.env src/cycle.js track
import { runScout } from './stages/01-trend-scout.js';
import { runEditor } from './stages/02-editor.js';
import { runScriptwriter } from './stages/03-scriptwriter.js';
import { runRender } from './stages/04-render.js';
import { runPublish } from './stages/05-publish.js';
import { runTrack } from './stages/06-track.js';
import { db } from './db.js';
import { logger } from './log.js';

const log = logger('cycle');

export const STAGES = {
  scout: runScout,
  editor: runEditor,
  script: runScriptwriter,
  render: runRender,
  publish: runPublish,
  track: runTrack,
};

// Последовательность «полного цикла» (трекинг отдельно, по своему расписанию).
const FULL = ['scout', 'editor', 'script', 'render', 'publish'];

export async function runStage(name) {
  const fn = STAGES[name];
  if (!fn) throw new Error(`неизвестная стадия: ${name}. Доступно: ${Object.keys(STAGES).join(', ')}`);
  log.info(`=== ${name} ===`);
  const res = await fn();
  log.ok(`${name}: ${JSON.stringify(res)}`);
  return res;
}

export async function runFullCycle() {
  const summary = {};
  for (const s of FULL) {
    try {
      summary[s] = await runStage(s);
    } catch (e) {
      log.error(`${s}: ${e.message}`);
      summary[s] = { error: e.message };
      break; // не тащим сломанный цикл дальше
    }
  }
  return summary;
}

if (process.argv[1] && process.argv[1].endsWith('cycle.js')) {
  db(); // инициализировать схему
  const arg = process.argv[2];
  const run = arg ? () => runStage(arg) : runFullCycle;
  run()
    .then((r) => {
      console.log('\nИТОГ:', JSON.stringify(r, null, 2));
      process.exit(0);
    })
    .catch((e) => {
      console.error('ОШИБКА ЦИКЛА:', e);
      process.exit(1);
    });
}
