-- Схема хранилища «Наглядно». Заменяет content-calendar.md и published-log.csv.
-- Применяется идемпотентно (CREATE TABLE IF NOT EXISTS).

PRAGMA journal_mode = WAL;

-- Один материал (карусель) на всех стадиях жизненного цикла.
CREATE TABLE IF NOT EXISTS items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  -- pipeline: scouted -> selected -> scripted -> rendered -> awaiting_approval
  --           -> approved | rejected -> published -> tracked
  status        TEXT NOT NULL DEFAULT 'scouted',
  rubric        TEXT,                 -- PD | F20 | BA | ALT | VIR | MEM
  topic_root    TEXT NOT NULL,        -- короткий корень темы для антиповтора
  title         TEXT,
  hook          TEXT,
  source_url    TEXT,
  demo_url      TEXT,                 -- страница/демо для авто-скриншота слайда 02
  clarity       TEXT,                 -- 'green' | 'yellow' | 'orange'
  candidates_json TEXT,               -- сырой вывод Trend Scout по теме
  selected_json TEXT,                 -- вывод Editor (ракурс, 2 хука, наметки блоков)
  slides_json   TEXT,                 -- вывод Scriptwriter (слайды + подпись + хэштеги + фактчек)
  media_json    TEXT,                 -- список PNG + их публичные URL
  caption       TEXT,                 -- финальная подпись поста
  hashtags      TEXT,                 -- через пробел
  post_url      TEXT,
  post_id       TEXT,
  published_at  TEXT,
  metrics_json  TEXT,                 -- views/likes/saves/comments на момент трекинга
  error         TEXT
);

CREATE INDEX IF NOT EXISTS idx_items_status     ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_topic_root ON items(topic_root);
CREATE INDEX IF NOT EXISTS idx_items_created    ON items(created_at);

-- Журнал прогонов пайплайна (для наблюдаемости и недельного разбора).
CREATE TABLE IF NOT EXISTS runs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  stage      TEXT NOT NULL,
  item_id    INTEGER,
  status     TEXT NOT NULL,           -- ok | error | skipped
  note       TEXT
);

-- Пул идей и запланированное — переносится из content-calendar.md один раз.
CREATE TABLE IF NOT EXISTS ideas (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  added_at   TEXT NOT NULL DEFAULT (datetime('now')),
  text       TEXT NOT NULL,
  rubric     TEXT,
  used       INTEGER NOT NULL DEFAULT 0
);
