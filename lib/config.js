import 'server-only';
import { spacesSettings } from './defaults';

const FIVE_GB = 5 * 1024 * 1024 * 1024;

export function maxUploadBytes() {
  const mb = Number(process.env.MAX_UPLOAD_MB || 2048);
  const requested = (Number.isFinite(mb) && mb > 0 ? mb : 2048) * 1024 * 1024;
  return Math.min(Math.floor(requested), FIVE_GB);
}

export function spacesConfigured() {
  const spaces = spacesSettings();
  return Boolean(
    spaces.accessKeyId && spaces.secretAccessKey && spaces.bucket && spaces.region && spaces.endpoint
  );
}
