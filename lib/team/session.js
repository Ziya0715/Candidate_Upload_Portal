import 'server-only';
import { cookies } from 'next/headers';
import { sessionSecretValue } from '../defaults';
import { httpError } from '../http';

export const TEAM_COOKIE = 'team_session';
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const TWELVE_HOURS_SECONDS = 12 * 60 * 60;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function teamSecret() {
  const secret = String(process.env.TEAM_SESSION_SECRET || process.env.SESSION_SECRET || '').trim();
  if (secret.length >= 16) return secret;
  return sessionSecretValue();
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function signingKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export function teamCookieOptions(host = '') {
  const hostname = String(host).split(':')[0];
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && !isLocalhost,
    path: '/',
    maxAge: TWELVE_HOURS_SECONDS,
  };
}

export async function createTeamToken(userId) {
  const body = bytesToBase64Url(encoder.encode(JSON.stringify({ userId, exp: Date.now() + TWELVE_HOURS_MS })));
  const key = await signingKey(teamSecret());
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return `${body}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function readTeamToken(token) {
  try {
    if (!token || token.split('.').length !== 2) return null;
    const [body, signature] = token.split('.');
    const key = await signingKey(teamSecret());
    const valid = await crypto.subtle.verify('HMAC', key, base64UrlToBytes(signature), encoder.encode(body));
    if (!valid) return null;
    const payload = JSON.parse(decoder.decode(base64UrlToBytes(body)));
    if (!payload || typeof payload.userId !== 'string' || payload.exp < Date.now()) return null;
    if (!/^[0-9a-f-]{36}$/i.test(payload.userId)) return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

export async function readTeamSession() {
  const jar = await cookies();
  return readTeamToken(jar.get(TEAM_COOKIE)?.value);
}

export function assertTeamWrite(request) {
  if (request.headers.get('x-team-request') !== '1') {
    throw httpError('This request was rejected.', 403);
  }
}
