// Локальный пайплайн-сервер. n8n (в Docker) дергает его по HTTP через
// host.docker.internal. Тяжёлая работа (LLM, Chromium, публикация) — здесь, на хосте.
//   node --env-file=.env src/server.js
import { createServer } from 'node:http';
import { runStage } from './cycle.js';
import { db } from './db.js';
import { logger } from './log.js';

const log = logger('server');
const PORT = Number(process.env.PIPELINE_PORT || 8477);
const TOKEN = process.env.PIPELINE_TOKEN || 'change-me-local-token';

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(body);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/health') return send(res, 200, { ok: true });

  if (req.headers.authorization !== `Bearer ${TOKEN}`) {
    return send(res, 401, { error: 'unauthorized' });
  }

  // GET /state — краткая сводка по items
  if (req.method === 'GET' && url.pathname === '/state') {
    const rows = db().prepare('SELECT status, COUNT(*) n FROM items GROUP BY status').all();
    const recent = db()
      .prepare('SELECT id,status,rubric,topic_root,title,post_url FROM items ORDER BY id DESC LIMIT 15')
      .all();
    return send(res, 200, { byStatus: rows, recent });
  }

  // POST /run/:stage
  const m = url.pathname.match(/^\/run\/([a-z]+)$/);
  if (req.method === 'POST' && m) {
    const stage = m[1];
    log.info(`-> run ${stage}`);
    try {
      const result = await runStage(stage);
      return send(res, 200, { stage, ok: true, result });
    } catch (e) {
      log.error(`${stage}: ${e.message}`);
      return send(res, 500, { stage, ok: false, error: e.message });
    }
  }

  send(res, 404, { error: 'not found', try: ['GET /health', 'GET /state', 'POST /run/{scout|editor|script|render|publish|track}'] });
});

db(); // применить схему на старте
server.listen(PORT, () => log.ok(`pipeline server on http://localhost:${PORT} (token ${TOKEN === 'change-me-local-token' ? 'ДЕФОЛТНЫЙ — поменяй' : 'set'})`));
