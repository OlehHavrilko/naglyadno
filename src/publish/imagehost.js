// Заливка PNG на S3-совместимый бакет (AWS S3 / Cloudflare R2 / Backblaze B2 / MinIO).
// Подпись AWS SigV4 вручную, без SDK.
import { createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { config, requireKeys } from '../config.js';

const sha256hex = (b) => createHash('sha256').update(b).digest('hex');
const hmac = (key, str) => createHmac('sha256', key).update(str, 'utf8').digest();

function signingKey(secret, date, region, service) {
  const kDate = hmac('AWS4' + secret, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

/** Загружает один файл, возвращает публичный URL. */
export async function uploadFile(localPath, keyPrefix = 'posts') {
  const s3 = config.imageHost.s3;
  requireKeys(s3, ['endpoint', 'bucket', 'accessKeyId', 'secretAccessKey', 'publicBaseUrl'], 'S3 image host');

  const body = readFileSync(localPath);
  const key = `${keyPrefix}/${Date.now()}-${basename(localPath)}`;
  const url = new URL(`${s3.endpoint.replace(/\/$/, '')}/${s3.bucket}/${key}`);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = amzDate.slice(0, 8);
  const region = s3.region || 'auto';
  const service = 's3';
  const payloadHash = sha256hex(body);
  const ct = localPath.endsWith('.png') ? 'image/png' : 'application/octet-stream';

  const canonicalHeaders =
    `host:${url.host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    'PUT',
    url.pathname,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const scope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256hex(canonicalRequest),
  ].join('\n');
  const sig = createHmac('sha256', signingKey(s3.secretAccessKey, date, region, service))
    .update(stringToSign, 'utf8')
    .digest('hex');
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${s3.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${sig}`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      authorization,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      'content-type': ct,
      'content-length': String(body.length),
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`S3 PUT ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return `${s3.publicBaseUrl}/${key}`;
}

export async function uploadMany(paths, keyPrefix) {
  const urls = [];
  for (const p of paths) urls.push(await uploadFile(p, keyPrefix));
  return urls;
}
