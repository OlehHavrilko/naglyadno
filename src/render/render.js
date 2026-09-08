// Рендер слайдов: slides.json -> PNG 1080×1350 через Playwright/Chromium.
// Плюс авто-скриншот демо-страницы для слайда «hook».
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { paths } from '../config.js';
import { logger } from '../log.js';

const log = logger('render');
const __dirname = dirname(fileURLToPath(import.meta.url));
const CARD_HTML = readFileSync(join(__dirname, 'card.html'), 'utf8');

const COOKIE_BUTTONS = [
  'button:has-text("Accept all")', 'button:has-text("Accept All")',
  'button:has-text("I agree")', 'button:has-text("Agree")',
  'button:has-text("Принять")', 'button:has-text("Согласен")',
  '[aria-label="Accept cookies"]', '#onetrust-accept-btn-handler',
];

async function captureDemo(context, url) {
  const page = await context.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    for (const sel of COOKIE_BUTTONS) {
      const b = page.locator(sel).first();
      if (await b.count().catch(() => 0)) {
        await b.click({ timeout: 1500 }).catch(() => {});
        break;
      }
    }
    await page.waitForTimeout(1200);
    const buf = await page.screenshot({ type: 'jpeg', quality: 80 });
    return 'data:image/jpeg;base64,' + buf.toString('base64');
  } catch (e) {
    log.warn(`демо-скриншот не удался (${url}): ${e.message}`);
    return null;
  } finally {
    await page.close();
  }
}

/**
 * @param {object} deck  slides.json (см. src/render/schema.example.json)
 * @param {object} opts  { outDir, demoUrl }
 * @returns {Promise<{files:string[], dir:string}>}
 */
export async function renderDeck(deck, { outDir, demoUrl } = {}) {
  const dir = outDir || join(paths.data, 'render', String(Date.now()));
  mkdirSync(dir, { recursive: true });

  const meta = {
    brandName: deck.brandName || 'Наглядно',
    rubric: deck.rubric || 'Проект дня',
    theme: deck.theme || 'dark',
    clarity: deck.clarity || null,
    total: deck.slides.length,
  };

  const browser = await chromium.launch();
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  const files = [];
  try {
    // Скриншот демо один раз, вставим в hook-слайд.
    let demoDataUri = null;
    const wantsShot = deck.slides.some((s) => s.type === 'hook' && s.screenshot);
    if (wantsShot && (demoUrl || deck.demoUrl)) {
      demoDataUri = await captureDemo(context, demoUrl || deck.demoUrl);
    }

    const page = await context.newPage();
    await page.setViewportSize({ width: 1080, height: 1350 });
    await page.setContent(CARD_HTML, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400); // подхватить веб-шрифты

    for (let i = 0; i < deck.slides.length; i++) {
      const slide = { ...deck.slides[i], index: i + 1 };
      if (slide.type === 'hook' && demoDataUri) slide.screenshotDataUri = demoDataUri;
      await page.evaluate(
        ([m, s]) => window.renderSlide(m, s),
        [meta, slide],
      );
      await page.waitForTimeout(150);
      const el = page.locator('.card');
      const out = join(dir, String(i + 1).padStart(2, '0') + '.png');
      await el.screenshot({ path: out });
      files.push(out);
      log.info('slide', i + 1, '->', out);
    }
    await page.close();
  } finally {
    await context.close();
    await browser.close();
  }
  writeFileSync(join(dir, 'deck.json'), JSON.stringify(deck, null, 2));
  log.ok(`${files.length} PNG -> ${dir}`);
  return { files, dir };
}

// CLI: node src/render/render.js --demo  (рендер демо-колоды без сети/ключей)
if (process.argv[1]?.endsWith('render.js') && process.argv.includes('--demo')) {
  const sample = join(__dirname, 'schema.example.json');
  const deck = existsSync(sample)
    ? JSON.parse(readFileSync(sample, 'utf8'))
    : null;
  if (!deck) {
    console.error('нет src/render/schema.example.json');
    process.exit(1);
  }
  renderDeck(deck, { outDir: join(paths.output, 'demo-render') }).then(({ dir }) =>
    console.log('готово:', dir),
  );
}
