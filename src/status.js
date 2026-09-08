// Краткая сводка по материалам. node src/status.js
import { db } from './db.js';

db();
const byStatus = db().prepare('SELECT status, COUNT(*) n FROM items GROUP BY status ORDER BY n DESC').all();
const recent = db()
  .prepare('SELECT id, status, rubric, topic_root, title, post_url FROM items ORDER BY id DESC LIMIT 12')
  .all();

console.log('\nПо статусам:');
if (!byStatus.length) console.log('  (пусто)');
for (const r of byStatus) console.log(`  ${String(r.n).padStart(3)}  ${r.status}`);

console.log('\nПоследние:');
for (const r of recent) {
  console.log(`  #${r.id}  ${r.status.padEnd(18)} ${(r.rubric || '').padEnd(4)} ${r.title || r.topic_root}${r.post_url ? '  ' + r.post_url : ''}`);
}
console.log('');
