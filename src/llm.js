// Клиент Claude Messages API. Роли берут system-промпт из agent/*.md.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config, paths, requireKeys } from './config.js';

export function roleSystemPrompt(roleFile) {
  // Общая рамка бренда + текст конкретной роли.
  const brandGuide = safeRead(join(paths.brand, 'brand-guide.md'));
  const brandVoice = safeRead(join(paths.brand, 'brand-voice.md'));
  const role = readFileSync(join(paths.agentRoles, roleFile), 'utf8');
  return [
    'Ты — часть автоматического контент-пайплайна канала «Наглядно».',
    'Действуй строго по своей роли. Возвращай ТОЛЬКО валидный JSON без обрамляющего текста и без markdown-кодоблоков.',
    '\n\n=== BRAND GUIDE ===\n' + brandGuide,
    '\n\n=== BRAND VOICE ===\n' + brandVoice,
    '\n\n=== ТВОЯ РОЛЬ ===\n' + role,
  ].join('');
}

function safeRead(p) {
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return '(файл не найден)';
  }
}

// Один вызов модели. Ожидаем JSON на выходе -> парсим.
export async function askJSON({ system, user, maxTokens = 4000, temperature = 0.7 }) {
  requireKeys(config.llm, ['apiKey'], 'LLM / Anthropic');
  const res = await fetch(config.llm.baseUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.llm.apiKey,
      'anthropic-version': config.llm.version,
    },
    body: JSON.stringify({
      model: config.llm.model,
      max_tokens: maxTokens,
      temperature,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${t.slice(0, 500)}`);
  }
  const data = await res.json();
  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  return parseLooseJSON(text);
}

// Модель иногда добавляет ```json ... ``` или префикс — вычищаем.
export function parseLooseJSON(text) {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const first = Math.min(
    ...['{', '['].map((c) => (s.indexOf(c) === -1 ? Infinity : s.indexOf(c))),
  );
  const last = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (first !== Infinity && last !== -1) s = s.slice(first, last + 1);
  return JSON.parse(s);
}
