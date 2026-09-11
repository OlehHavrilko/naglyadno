# Установка и запуск

## 0. Что уже сделано в этом репозитории

- Node.js 24 поставлен (`winget`), `npm install` выполнен, Playwright/Chromium скачан.
- Собран пайплайн `src/`, схема БД (`node:sqlite`), рендер слайдов, n8n (Docker).
- Рендер проверен: `npm run render:demo` → `agent/output/demo-render/*.png`.
- Режим по умолчанию — **`PUBLISH_PROVIDER=manual`**: пайплайн готовит пакет,
  TikTok ты загружаешь руками.

## 1. Ключи (`.env` уже создан из `.env.example`)

### Сейчас нужен только один

| Ключ | Где взять |
|---|---|
| `ANTHROPIC_API_KEY` | https://console.anthropic.com → API Keys |

`scout`, `editor`, `script` без него не работают. `render` и источники — работают.

### Необязательно
- `REDDIT_CLIENT_ID/SECRET` — https://www.reddit.com/prefs/apps (иначе Reddit-источник пропускается; HN и GitHub работают без ключей).
- `PRODUCTHUNT_TOKEN` — https://api.producthunt.com/v2/oauth/applications.

### Понадобится позже (только для автопостинга)
`AYRSHARE_API_KEY` + `S3_*` (Cloudflare R2) + `TELEGRAM_*`. Пока не трогаем.

## 2. Прогон (ручная публикация)

> Новый терминал, чтобы подхватился PATH. Проверка: `node -v` → v24.x

```bash
cd D:\claude\gitsight
npm run cycle        # весь цикл: scout → editor → script → render → publish(manual)
npm run status       # что в БД и в каком статусе
```

По стадиям, если нужно вмешаться посередине:

```bash
npm run scout        # источники → Claude → кандидаты
npm run editor       # выбор тем цикла (ITEMS_PER_CYCLE)
npm run script       # колоды слайдов
npm run render       # PNG 1080×1350 → agent/output/item-<id>/
npm run publish      # собрать PUBLISH.md рядом со слайдами
```

На выходе для каждого материала:

```
agent/output/item-<id>/
  01.png … 06.png     слайды по порядку
  deck.json           исходные данные колоды
  PUBLISH.md          подпись, хэштеги, ссылка «пощупать», фактчек, что сделать
```

## 3. После ручной публикации в TikTok

```bash
npm run mark-posted -- <id> <ссылка-на-пост>
# позже, когда будут цифры:
npm run mark-posted -- <id> <ссылка> <views> <likes> <saves> <comments>
```

Это фиксирует тему в БД (антиповтор на 30 дней) и ведёт лог. Без этого шага
пайплайн всё равно не возьмёт ту же тему повторно, но не будет знать URL и метрик.

## 4. Планировщик (опционально)

- **Просто:** Планировщик заданий Windows на `npm run cycle` 3×/нед.
- **С историей/ретраями:** n8n уже поднят в Docker (`docker compose up -d`,
  http://localhost:5678). Импортируй `n8n/workflows/gitsight.json`, но стадия
  `publish` в manual-режиме просто складывает пакет — постить всё равно руками.
- Пайплайн-сервер для n8n: `npm run server` (порт 8477).

## 5. Переход к автопостингу — когда будешь готов

1. Завести Ayrshare + R2 + Telegram-бота, заполнить ключи в `.env`.
2. `PUBLISH_PROVIDER=ayrshare`, `AUTO_PUBLISH=false` — пайплайн шлёт превью в
   Telegram с кнопками ✅/❌.
3. Позже `AUTO_PUBLISH=true` — полный автомат.
