import 'server-only';

export const SESSION_COOKIE = 'staff_session';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

function bytesToBase64Url(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
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

async function signingKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export function sessionCookieOptions(host = '') {
  const hostname = String(host).split(':')[0];
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  return {
    httpOnly: true,
    sameSite: 'lax',
    // Local http://localhost can stay signed in. A public server still requires HTTPS.
    secure: process.env.NODE_ENV === 'production' && !isLocalhost,
    path: '/',
    maxAge: SEVEN_DAYS_SECONDS,
  };
}

export async function createSessionToken(username) {
  const payload = {
    username,
    exp: Date.now() + SEVEN_DAYS_MS,
  };
  const body = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await signingKey(sessionSecret());
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return `${body}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function readSessionToken(token) {
  try {
    if (!token || !token.includes('.')) return null;
    const secret = process.env.SESSION_SECRET || '';
    if (secret.length < 32 || secret.includes('replace-with')) return null;

    const [body, signature] = token.split('.');
    if (!body || !signature || token.split('.').length !== 2) return null;

    const key = await signingKey(secret);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlToBytes(signature),
      encoder.encode(body)
    );
    if (!valid) return null;

    const payload = JSON.parse(decoder.decode(base64UrlToBytes(body)));
    if (!payload || typeof payload.username !== 'string' || typeof payload.exp !== 'number') {
      return null;
    }
    if (payload.exp < Date.now() || payload.username.length > 80) return null;
    return { username: payload.username };
  } catch {
    return null;
  }
}
