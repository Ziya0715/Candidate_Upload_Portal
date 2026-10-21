import 'server-only';
import crypto from 'node:crypto';
import { candidateFolder, COURSE_VIDEO_FOLDER, normalizeCandidateId } from './candidateId';
import { contentTypeFor } from './fileRules';
import { listStoredObjects, statObject } from './spaces';

const VIDEO_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isVideoId(value) {
  return typeof value === 'string' && VIDEO_ID.test(value);
}

export function createVideoId() {
  return crypto.randomUUID();
}

function sessionSecret() {
  const secret = process.env.SESSION_SECRET || '';
  if (secret.length < 32 || secret.includes('replace-with')) {
    const error = new Error('Set SESSION_SECRET to a random string of at least 32 characters.');
    error.status = 500;
    error.publicMessage = error.message;
    throw error;
  }
  return secret;
}

export function shareTokenFor(storageKey) {
  const payload = Buffer.from(storageKey, 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret()).update(storageKey).digest('base64url');
  return `${payload}.${signature}`;
}

export function storageKeyFromShareToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const splitAt = token.lastIndexOf('.');
  const payload = token.slice(0, splitAt);
  const signature = token.slice(splitAt + 1);
  if (!payload || !signature) return null;

  let storageKey = '';
  try {
    storageKey = Buffer.from(payload, 'base64url').toString('utf8');
  } catch {
    return null;
  }

  const expected = crypto.createHmac('sha256', sessionSecret()).update(storageKey).digest('base64url');
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  return storageKey;
}

export function parseStorageKey(storageKey) {
  const folder = COURSE_VIDEO_FOLDER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(storageKey || '').match(new RegExp(`^${folder}/([A-Za-z0-9][A-Za-z0-9._-]*)/([^/]+)$`));
  if (!match) return null;

  const [, candidateId, rest] = match;
  const named = rest.match(
    /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})-(.+)$/i
  );
  const filename = named ? named[2] : rest;
  return {
    id: named ? named[1] : Buffer.from(rest, 'utf8').toString('base64url'),
    filename,
    storageKey,
    candidateId,
    contentType: contentTypeFor(filename) || 'video/mp4',
  };
}

function toVideo(parsed, details) {
  return {
    id: parsed.id,
    filename: parsed.filename,
    storageKey: parsed.storageKey,
    sizeBytes: Number(details.sizeBytes) || 0,
    contentType: details.contentType || parsed.contentType,
    shareToken: shareTokenFor(parsed.storageKey),
    createdAt: details.createdAt || '',
    candidateId: parsed.candidateId,
  };
}

export function toPublicVideo(video) {
  return {
    id: video.id,
    filename: video.filename,
    sizeBytes: video.sizeBytes,
    contentType: video.contentType,
    shareToken: video.shareToken,
    createdAt: video.createdAt,
    candidateId: video.candidateId,
  };
}

export async function listVideos(candidateId) {
  const objects = await listStoredObjects(candidateFolder(candidateId));
  return objects
    .filter((object) => object.Key && !object.Key.endsWith('/'))
    .map((object) => {
      const parsed = parseStorageKey(object.Key);
      if (!parsed || parsed.candidateId !== candidateId) return null;
      return toVideo(parsed, {
        sizeBytes: object.Size,
        createdAt: object.LastModified ? new Date(object.LastModified).toISOString() : '',
      });
    })
    .filter(Boolean)
    .sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1));
}

export async function getVideo(candidateId, id) {
  const checked = normalizeCandidateId(candidateId);
  if (!checked.ok || typeof id !== 'string' || !id) return null;
  const videos = await listVideos(checked.candidateId);
  return videos.find((video) => video.id === id) || null;
}

export async function getVideoByShareToken(token) {
  const storageKey = storageKeyFromShareToken(token);
  const parsed = storageKey ? parseStorageKey(storageKey) : null;
  if (!parsed) return null;

  const stored = await statObject(parsed.storageKey);
  if (!stored) return null;

  return toVideo(parsed, {
    sizeBytes: stored.ContentLength,
    contentType: stored.ContentType || parsed.contentType,
    createdAt: stored.LastModified ? new Date(stored.LastModified).toISOString() : '',
  });
}

export function videoFromUpload({ storageKey, sizeBytes, contentType, createdAt }) {
  const parsed = parseStorageKey(storageKey);
  if (!parsed) return null;
  return toVideo(parsed, { sizeBytes, contentType, createdAt });
}
