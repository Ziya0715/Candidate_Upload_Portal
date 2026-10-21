const EXTENSION_TYPES = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.ogv': 'video/ogg',
  '.ogg': 'video/ogg',
  '.mkv': 'video/x-matroska',
};

export const ACCEPT_ATTRIBUTE =
  '.mp4,.m4v,.webm,.mov,.ogv,.ogg,.mkv,video/mp4,video/webm,video/quicktime,video/ogg';

export function displayFilename(name) {
  const base = String(name || '')
    .split(/[/\\]/)
    .pop();
  const cleaned = String(base || '')
    .replace(/[\u0000-\u001f]/g, '')
    .trim();
  return cleaned.slice(0, 180);
}

export function contentTypeFor(filename) {
  return EXTENSION_TYPES[extensionOf(filename)] || '';
}

export function extensionOf(filename) {
  const lower = String(filename || '').toLowerCase();
  const index = lower.lastIndexOf('.');
  if (index <= 0) return '';
  return lower.slice(index);
}

export function storageName(filename) {
  const extension = extensionOf(filename);
  const stem = filename.slice(0, filename.length - extension.length);
  const safeStem = stem
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return `${safeStem || 'video'}${extension}`;
}

export function formatBytes(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size < 0) return '0 B';
  if (size < 1024) return `${Math.round(size)} B`;

  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = size / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = value >= 10 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

export function checkVideo({ filename, size, maxBytes }) {
  const displayName = displayFilename(filename);
  if (!displayName) {
    return { ok: false, error: 'Choose a video file.' };
  }

  const contentType = EXTENSION_TYPES[extensionOf(displayName)];
  if (!contentType) {
    return {
      ok: false,
      error: 'Use an MP4, WebM, MOV, OGG, or MKV file. MP4 and WebM play in the most browsers.',
    };
  }

  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return { ok: false, error: 'That file is empty.' };
  }

  if (bytes > maxBytes) {
    return {
      ok: false,
      error: `This file is ${formatBytes(bytes)}. The limit is ${formatBytes(maxBytes)}.`,
    };
  }

  return {
    ok: true,
    filename: displayName,
    contentType,
    storageName: storageName(displayName),
    size: bytes,
  };
}
