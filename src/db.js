// Обёртка над встроенным node:sqlite. Инициализация схемы + типовые запросы.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { paths } from './config.js';

let _db;

export function db() {
  if (_db) return _db;
  _db = new DatabaseSync(paths.db);
  _db.exec(readFileSync(join(paths.root, 'db', 'schema.sql'), 'utf8'));
  return _db;
}

export function insertItem(fields) {
  const cols = Object.keys(fields);
  const stmt = db().prepare(
    `INSERT INTO items (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
  );
  const info = stmt.run(...cols.map((c) => fields[c]));
  return Number(info.lastInsertRowid);
}

export function updateItem(id, fields) {
  const cols = Object.keys(fields);
  if (!cols.length) return;
  const set = cols.map((c) => `${c} = ?`).join(', ');
  db()
    .prepare(`UPDATE items SET ${set}, updated_at = datetime('now') WHERE id = ?`)
    .run(...cols.map((c) => fields[c]), id);
}

export function getItem(id) {
  return db().prepare('SELECT * FROM items WHERE id = ?').get(id);
}

export function itemsByStatus(status) {
  return db().prepare('SELECT * FROM items WHERE status = ? ORDER BY id').all(status);
}

// Антиповтор: тема считается занятой, если её topic_root встречался за N дней
// (в любом статусе, кроме rejected) либо стоит в очереди на публикацию.
export function isTopicTaken(topicRoot, days = 30) {
  const row = db()
    .prepare(
      `SELECT COUNT(*) AS n FROM items
       WHERE topic_root = ?
         AND status != 'rejected'
         AND (
           created_at >= datetime('now', ?)
           OR status IN ('selected','scripted','rendered','awaiting_approval','approved')
         )`,
    )
    .get(topicRoot, `-${days} days`);
  return row.n > 0;
}

export function recentTopicRoots(days = 30) {
  return db()
    .prepare(
      `SELECT DISTINCT topic_root FROM items
       WHERE created_at >= datetime('now', ?) AND status != 'rejected'`,
    )
    .all(`-${days} days`)
    .map((r) => r.topic_root);
}

export function logRun(stage, itemId, status, note = '') {
  db()
    .prepare('INSERT INTO runs (stage, item_id, status, note) VALUES (?,?,?,?)')
    .run(stage, itemId ?? null, status, note);
}

// CLI: node src/db.js --init
if (process.argv[1] && process.argv[1].endsWith('db.js') && process.argv.includes('--init')) {
  db();
  console.log('OK: схема применена ->', paths.db);
}
