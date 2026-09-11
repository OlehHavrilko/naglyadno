// Единая точка доступа к конфигурации и путям проекта.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, '..');

export const paths = {
  root: ROOT,
  brand: join(ROOT, 'brand'),
  agentRoles: join(ROOT, 'agent'),
  content: join(ROOT, 'content'),
  cardsTemplate: join(ROOT, 'cards', 'template.html'),
  data: join(ROOT, 'data'),
  db: join(ROOT, 'data', 'gitsight.db'),
  output: join(ROOT, 'agent', 'output'),
};

for (const d of [paths.data, paths.output]) {
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

const env = process.env;

export const config = {
  llm: {
    apiKey: env.ANTHROPIC_API_KEY || '',
    model: env.ANTHROPIC_MODEL || 'claude-sonnet-5',
    baseUrl: 'https://api.anthropic.com/v1/messages',
    version: '2023-06-01',
  },
  publish: {
    provider: (env.PUBLISH_PROVIDER || 'ayrshare').toLowerCase(),
    ayrshare: {
      apiKey: env.AYRSHARE_API_KEY || '',
      profileKey: env.AYRSHARE_PROFILE_KEY || '',
    },
    tiktok: {
      clientKey: env.TIKTOK_CLIENT_KEY || '',
      clientSecret: env.TIKTOK_CLIENT_SECRET || '',
      accessToken: env.TIKTOK_ACCESS_TOKEN || '',
      refreshToken: env.TIKTOK_REFRESH_TOKEN || '',
    },
  },
  imageHost: {
    kind: (env.IMAGE_HOST || 's3').toLowerCase(),
    s3: {
      endpoint: env.S3_ENDPOINT || '',
      region: env.S3_REGION || 'auto',
      bucket: env.S3_BUCKET || '',
      accessKeyId: env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: env.S3_SECRET_ACCESS_KEY || '',
      publicBaseUrl: (env.S3_PUBLIC_BASE_URL || '').replace(/\/$/, ''),
    },
  },
  telegram: {
    botToken: env.TELEGRAM_BOT_TOKEN || '',
    chatId: env.TELEGRAM_CHAT_ID || '',
    autoPublish: String(env.AUTO_PUBLISH || 'false') === 'true',
    approvalTimeoutMin: Number(env.APPROVAL_TIMEOUT_MIN || 180),
  },
  sources: {
    reddit: { clientId: env.REDDIT_CLIENT_ID || '', clientSecret: env.REDDIT_CLIENT_SECRET || '' },
    productHunt: { token: env.PRODUCTHUNT_TOKEN || '' },
  },
  itemsPerCycle: Number(env.ITEMS_PER_CYCLE || 1),
  tz: env.TZ || 'Europe/Kyiv',
};

export function requireKeys(obj, keys, where) {
  const missing = keys.filter((k) => !obj[k]);
  if (missing.length) {
    throw new Error(
      `Не заполнено в .env для «${where}»: ${missing.join(', ')}. См. .env.example.`,
    );
  }
}
