// Выбор провайдера публикации по config.publish.provider.
import { config } from '../config.js';
import { publishAyrshare, analyticsAyrshare } from './ayrshare.js';
import { publishTikTokDirect } from './tiktok-direct.js';

export async function publish({ imageUrls, caption }) {
  switch (config.publish.provider) {
    case 'ayrshare':
      return publishAyrshare({ imageUrls, caption });
    case 'tiktok':
      return publishTikTokDirect({ imageUrls, caption });
    default:
      throw new Error(`Неизвестный PUBLISH_PROVIDER: ${config.publish.provider}`);
  }
}

export async function fetchMetrics(postId) {
  if (config.publish.provider === 'ayrshare') return analyticsAyrshare(postId);
  return { views: null, likes: null, comments: null, saves: null, note: 'метрики для tiktok-direct не реализованы' };
}
