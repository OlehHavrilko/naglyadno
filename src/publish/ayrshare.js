// Публикация фото-карусели в TikTok через Ayrshare.
// Docs: https://www.ayrshare.com/docs/apis/post/social-networks/tiktok
import { config, requireKeys } from '../config.js';

export async function publishAyrshare({ imageUrls, caption }) {
  const a = config.publish.ayrshare;
  requireKeys(a, ['apiKey'], 'Ayrshare');

  const headers = {
    authorization: `Bearer ${a.apiKey}`,
    'content-type': 'application/json',
  };
  if (a.profileKey) headers['profile-key'] = a.profileKey;

  const res = await fetch('https://api.ayrshare.com/api/post', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      post: caption,
      platforms: ['tiktok'],
      mediaUrls: imageUrls, // >1 картинки -> TikTok photo carousel
      tiktokOptions: {
        // фото-пост; звук не добавляется через API
        disableComments: false,
        privacyLevel: 'PUBLIC_TO_EVERYONE',
      },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status === 'error') {
    throw new Error(`Ayrshare: ${JSON.stringify(data).slice(0, 500)}`);
  }
  const tt = (data.postIds || []).find((p) => p.platform === 'tiktok') || {};
  return { postId: data.id || tt.id || '', postUrl: tt.postUrl || '', raw: data };
}

export async function analyticsAyrshare(postId) {
  const a = config.publish.ayrshare;
  const headers = { authorization: `Bearer ${a.apiKey}`, 'content-type': 'application/json' };
  if (a.profileKey) headers['profile-key'] = a.profileKey;
  const res = await fetch('https://api.ayrshare.com/api/analytics/post', {
    method: 'POST',
    headers,
    body: JSON.stringify({ id: postId, platforms: ['tiktok'] }),
  });
  const data = await res.json().catch(() => ({}));
  const tt = data.tiktok || {};
  return {
    views: tt.videoViews ?? tt.views ?? null,
    likes: tt.likeCount ?? null,
    comments: tt.commentCount ?? null,
    saves: tt.shareCount ?? null,
    raw: data,
  };
}
