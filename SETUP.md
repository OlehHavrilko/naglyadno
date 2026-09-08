# Установка и запуск

## 0. Что уже сделано в этом репозитории

- Node.js 24 поставлен (`winget`), зависимости установлены (`npm install`),
  браузер Playwright/Chromium скачан.
- Собран пайплайн `src/`, схема БД, рендер слайдов, workflow n8n.
- Рендер проверен: `npm run render:demo` → `agent/output/demo-render/*.png`.

## 1. Что нужно сделать тебе — аккаунты и ключи

Открой `.env` (уже создан из `.env.example`) и заполни.

### Обязательно
| Ключ | Где взять |
|---|---|
| `ANTHROPIC_API_KEY` | https://console.anthropic.com → API Keys |

### Публикация — выбери один путь
| Путь | Ключи | Плюсы / минусы |
|---|---|---|
| **Ayrshare** (рекомендую для старта) | `AYRSHARE_API_KEY` (+ `AYRSHARE_PROFILE_KEY` если профилей несколько) — https://www.ayrshare.com | аудит TikTok уже пройден у них; платно от ~$0/мес на старте |
| **Свой TikTok app** | `TIKTOK_CLIENT_KEY/SECRET`, `TIKTOK_ACCESS_TOKEN`, `TIKTOK_REFRESH_TOKEN` — https://developers.tiktok.com | бесплатно, но нужен аудит приложения для публичных постов (недели) |

Ставь `PUBLISH_PROVIDER=ayrshare` или `=tiktok`.

### Хостинг картинок (TikTok забирает PNG по публичным ссылкам)
Любой S3-совместимый бакет. Проще всего **Cloudflare R2** (есть бесплатный объём):
`S3_ENDPOINT` (напр. `https://<accountid>.r2.cloudflarestorage.com`), `S3_BUCKET`,
`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL` (публичный домен раздачи бакета).

### Ревью в Telegram (рекомендуется на старте)
1. Создай бота у `@BotFather` → `TELEGRAM_BOT_TOKEN`.
2. Напиши боту любое сообщение, узнай свой id у `@userinfobot` → `TELEGRAM_CHAT_ID`.
3. `AUTO_PUBLISH=false` — пайплайн будет спрашивать перед постингом.
   Позже поставишь `true` для полного автомата.

### Необязательно
- `REDDIT_CLIENT_ID/SECRET` — https://www.reddit.com/prefs/apps (иначе Reddit-источник просто пропускается).
- `PRODUCTHUNT_TOKEN` — https://api.producthunt.com/v2/oauth/applications.

## 2. Первый прогон

> Открой новый терминал (чтобы подхватился PATH с `node`). Проверка: `node -v` → v24.x

```bash
cd D:\claude\naglyadno
npm run db:init                 # создать data/naglyadno.db (уже создан, повтор безопасен)
npm run scout                   # источники → Claude → кандидаты в БД
npm run cycle status            # посмотреть, что появилось
npm run editor                  # выбрать темы цикла
npm run script                  # сгенерировать колоды слайдов
npm run render                  # PNG в agent/output/item-<id>/
npm run publish                 # ревью в Telegram → S3 → TikTok
```

Или всё разом:

```bash
npm run cycle full
```

Метрики опубликованных постов (через 48 ч):

```bash
npm run track
```

## 3. Автоматизация по расписанию

- **Просто:** Планировщик заданий Windows на `npm run cycle full` (3×/нед) и `npm run track` (ежедневно).
- **С историей и ретраями:** n8n — см. `n8n/README.md`, импортируй `n8n/naglyadno-workflow.json`.

## 4. Переход к полному автомату

Когда доля материалов «постить без правок» станет высокой:
`.env` → `AUTO_PUBLISH=true`. Пайплайн перестанет ждать кнопку и будет постить сам.
