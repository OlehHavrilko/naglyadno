// Пересобирает PNG-экспорты логотипа из SVG-исходников этой папки.
// В git PNG не хранятся (репозиторий держит только код/векторные исходники) —
// перед использованием иконок/лок-апов как файлов (аватар, favicon и т.п.)
// прогони: node brand/logo/render.js
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const dir = path.dirname(fileURLToPath(import.meta.url));

const jobs = [
  { file: 'icon-dark.svg', out: 'icon-dark-512.png', size: 512 },
  { file: 'icon-dark.svg', out: 'icon-dark-1024.png', size: 1024 },
  { file: 'icon-dark.svg', out: 'icon-dark-2048.png', size: 2048 },
  { file: 'icon-light.svg', out: 'icon-light-512.png', size: 512 },
  { file: 'icon-light.svg', out: 'icon-light-1024.png', size: 1024 },
  { file: 'icon-light.svg', out: 'icon-light-2048.png', size: 2048 },
  { file: 'lockup-dark.svg', out: 'lockup-dark-1400.png', width: 1400, height: 420, transparent: true },
  { file: 'lockup-light.svg', out: 'lockup-light-1400.png', width: 1400, height: 420, transparent: true },
];

const browser = await chromium.launch();
for (const job of jobs) {
  const svg = readFileSync(path.join(dir, job.file), 'utf8');
  const w = job.size ?? job.width;
  const h = job.size ?? job.height;
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const html = `<!doctype html><html><head><style>html,body{margin:0;padding:0;background:transparent;}svg{display:block;width:${w}px;height:${h}px;}</style></head><body>${svg}</body></html>`;
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(dir, job.out), omitBackground: Boolean(job.transparent) });
  await page.close();
  console.log('rendered', job.out);
}
await browser.close();
