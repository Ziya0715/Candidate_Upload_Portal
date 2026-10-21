import 'server-only';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { readSessionToken, SESSION_COOKIE } from './session';

export async function getSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return readSessionToken(token);
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    const error = new Error('Please log in.');
    error.status = 401;
    throw error;
  }
  return session;
}

export function secretsMatch(input, expected) {
  const left = crypto.createHash('sha256').update(String(input), 'utf8').digest();
  const right = crypto.createHash('sha256').update(String(expected), 'utf8').digest();
  return crypto.timingSafeEqual(left, right);
}
