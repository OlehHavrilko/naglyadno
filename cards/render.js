// Рендерит карточки колод (trending-repos.html, local-ai.html) в PNG 1080×1920.
// PNG в git не хранятся (см. .gitignore) — перед публикацией прогони:
//   node cards/render.js
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import { mkdirSync } from 'fs';

const dir = path.dirname(fileURLToPath(import.meta.url));

const decks = [
  { file: 'trending-repos.html', outDir: 'render' },
  { file: 'local-ai.html', outDir: 'render-ai' },
  { file: 'terminal-wow.html', outDir: 'render-wow' },
  { file: 'time-savers.html', outDir: 'render-tools' },
];

const browser = await chromium.launch();
for (const deck of decks) {
  const outDir = path.join(dir, deck.outDir);
  mkdirSync(outDir, { recursive: true });

  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto('file://' + path.join(dir, deck.file));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);

  const cards = await page.locator('.card').all();
  for (let i = 0; i < cards.length; i++) {
    const heading = (await cards[i].locator('h1, h2').first().innerText().catch(() => '')) || 'oblozhka';
    const slug = heading
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'card';
    const outFile = path.join(outDir, String(i).padStart(2, '0') + '-' + slug + '.png');
    await cards[i].screenshot({ path: outFile });
    console.log('rendered', deck.outDir, outFile);
  }
  await page.close();
}
await browser.close();
