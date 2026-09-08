# Архитектура автопайплайна «Наглядно»

Канал слайдовых каруселей в TikTok, собираемых автоматически: тренды → отбор →
сценарий → рендер PNG → (ревью в Telegram) → публикация → метрики.

```
┌─ Docker ───────────────┐      HTTP (host.docker.internal:8477)      ┌─ хост ────────────────────────┐
│  n8n  (оркестратор)    │  ───────────────────────────────────────▶ │  src/server.js (пайплайн)     │
│  • Schedule (cron)     │      POST /run/{scout|editor|script|      │  • LLM (Claude Messages API)  │
│  • HTTP Request → этап │            render|publish|track}          │  • Playwright/Chromium рендер │
│  • том n8n_data        │  ◀─────────────────────────────────────── │  • заливка S3 + публикация    │
└────────────────────────┘             {ok, result}                  │  • SQLite (data/naglyadno.db) │
                                                                     └──────────────────────────────┘
```

n8n только дирижирует (расписание, порядок, ретраи). Вся тяжёлая работа —
на хосте, где уже установлены Node 24 и Chromium.

## Стадии

| Стадия | Файл | Вход → Выход | Ключи |
|---|---|---|---|
| `scout` | `src/stages/01-trend-scout.js` | источники (HN/Reddit/GitHub) + LLM → `items(status=scouted)` | ANTHROPIC |
| `editor` | `src/stages/02-editor.js` | `scouted` + LLM → `selected` (рубрика, хук, наметки), остальное `rejected` | ANTHROPIC |
| `script` | `src/stages/03-scriptwriter.js` | `selected` + LLM → `scripted` (`slides_json` по схеме) | ANTHROPIC |
| `render` | `src/stages/04-render.js` | `scripted` → PNG 1080×1350 в `agent/output/item-<id>/`, `rendered` | — (Chromium) |
| `publish` | `src/stages/05-publish.js` | `rendered` → Telegram-ревью → S3 → TikTok → `published` | Telegram, S3, Ayrshare/TikTok |
| `track` | `src/stages/06-track.js` | `published` старше 48ч → метрики → `tracked` | Ayrshare |

Статусы одного материала: `scouted → selected → scripted → rendered →
awaiting_approval → approved → published → tracked` (или `rejected` на любом шаге).

## Ревью человеком

`AUTO_PUBLISH=false` (по умолчанию): стадия `publish` шлёт альбом слайдов в Telegram
с кнопками **✅ Постить / ❌ Скип** и ждёт до `APPROVAL_TIMEOUT_MIN` минут.
Нет реакции — материал откладывается (вернётся в очередь на следующий прогон).
`AUTO_PUBLISH=true` — публикует сразу, без Telegram.

## Хранилище

- `data/naglyadno.db` — SQLite (`node:sqlite`). Таблицы `items`, `runs`, `ideas`.
  Схема: `db/schema.sql`, применяется идемпотентно при каждом старте.
- Заменяет `content/content-calendar.md` и `content/published-log.csv`.
- Антиповтор: `isTopicTaken(topic_root, 30)` — тема занята, если её корень
  встречался за 30 дней или стоит в очереди.
- `data/` в git не коммитится — бэкапить отдельно (это память канала).

## Публикация в TikTok

Фото-карусель. Провайдер выбирается `PUBLISH_PROVIDER`:
- `ayrshare` — обёртка над официальным API, аудит пройден у них. Быстрый старт.
- `tiktok` — свой TikTok for Developers app. Нужен аудит для публичных постов
  (до аудита — только `SELF_ONLY`).

TikTok скачивает картинки по публичным URL → PNG сначала льются на S3-совместимый
бакет (`S3_PUBLIC_BASE_URL`). Трендовый звук через API недоступен — для слайдов ок.

## Запуск

```bash
# 1. зависимости (однократно)
npm install
npx playwright install chromium

# 2. конфиг
cp .env.example .env   # заполнить ключи

# 3. пайплайн-сервер на хосте
npm run server         # http://localhost:8477

# 4. n8n
docker compose up -d   # http://localhost:5678
#   n8n → Import from File → n8n/workflows/naglyadno.json → Activate
```

Ручной прогон без n8n:

```bash
npm run cycle          # scout → editor → script → render → publish
npm run scout          # одна стадия
npm run track
```

## Что нужно от человека (внешнее)

| Нужно | Где взять |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| Публикация: Ayrshare API key | ayrshare.com (платно) — или свой TikTok app + аудит |
| S3 бакет (R2/S3/B2) | Cloudflare R2 дешевле всего |
| Telegram bot token + chat id | @BotFather, @userinfobot |
| (опц.) Reddit / Product Hunt | для более широкого пула тем |
