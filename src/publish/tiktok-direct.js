// Публикация фото-поста напрямую через TikTok Content Posting API (PHOTO mode).
// Требует аудита приложения для публичных постов. До аудита -> SELF_ONLY.
// Docs: https://developers.tiktok.com/doc/content-posting-api-reference-upload-content/
import { config, requireKeys } from '../config.js';

const BASE = 'https://open.tiktokapis.com/v2';

async function refreshToken() {
  const t = config.publish.tiktok;
  const res = await fetch(`${BASE}/oauth/token/`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: t.clientKey,
      client_secret: t.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: t.refreshToken,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`TikTok refresh: ${JSON.stringify(data)}`);
  return data.access_token;
}

export async function publishTikTokDirect({ imageUrls, caption, accessToken }) {
  const t = config.publish.tiktok;
  requireKeys(t, ['clientKey', 'clientSecret', 'refreshToken'], 'TikTok direct');
  const token = accessToken || t.accessToken || (await refreshToken());

  const res = await fetch(`${BASE}/post/publish/content/init/`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      post_info: {
        title: caption.slice(0, 90),
        description: caption.slice(0, 4000),
        privacy_level: 'PUBLIC_TO_EVERYONE', // до аудита допустимо только SELF_ONLY
        disable_comment: false,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        photo_cover_index: 0,
        photo_images: imageUrls,
      },
      post_mode: 'DIRECT_POST',
      media_type: 'PHOTO',
    }),
  });
  const data = await res.json();
  if (data.error && data.error.code !== 'ok') {
    throw new Error(`TikTok init: ${JSON.stringify(data.error)}`);
  }
  // Статус поста получают опросом /post/publish/status/fetch/ по publish_id.
  return { postId: data.data?.publish_id || '', postUrl: '', raw: data };
}

export async function statusTikTok(publishId, accessToken) {
  const token = accessToken || config.publish.tiktok.accessToken || (await refreshToken());
  const res = await fetch(`${BASE}/post/publish/status/fetch/`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ publish_id: publishId }),
  });
  return res.json();
}
