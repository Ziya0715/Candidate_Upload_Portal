import 'server-only';

const FIVE_GB = 5 * 1024 * 1024 * 1024;

export function maxUploadBytes() {
  const mb = Number(process.env.MAX_UPLOAD_MB || 2048);
  const requested = (Number.isFinite(mb) && mb > 0 ? mb : 2048) * 1024 * 1024;
  return Math.min(Math.floor(requested), FIVE_GB);
}

export function spacesConfigured() {
  return Boolean(
    process.env.DO_SPACES_KEY &&
      process.env.DO_SPACES_SECRET &&
      process.env.DO_SPACES_BUCKET &&
      process.env.DO_SPACES_REGION &&
      process.env.DO_SPACES_ENDPOINT
  );
}
