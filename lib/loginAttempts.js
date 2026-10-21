import 'server-only';

const attempts = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function recentAttempts(key) {
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter((time) => now - time < WINDOW_MS);
  attempts.set(key, recent);
  return recent;
}

export function loginBlocked(key) {
  return recentAttempts(key).length >= MAX_ATTEMPTS;
}

export function recordLoginFailure(key) {
  const recent = recentAttempts(key);
  recent.push(Date.now());
  attempts.set(key, recent);
  return recent.length >= MAX_ATTEMPTS;
}

export function clearLoginFailures(key) {
  attempts.delete(key);
}
