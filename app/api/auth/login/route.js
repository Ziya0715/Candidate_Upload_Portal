import { secretsMatch } from '@/lib/auth';
import { staffPassword, staffUsername } from '@/lib/defaults';
import { fail, httpError, jsonOk, readBody } from '@/lib/http';
import { clearLoginFailures, loginBlocked, recordLoginFailure } from '@/lib/loginAttempts';
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/session';

export const runtime = 'nodejs';

function clientKey(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim().slice(0, 80) || 'unknown';
  return 'local';
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request) {
  const key = clientKey(request);

  try {
    const username = staffUsername();
    const password = staffPassword();

    if (process.env.NODE_ENV === 'production' && password === 'change-this-password') {
      throw httpError('Change STAFF_PASSWORD before running this app in production.', 500);
    }

    if (loginBlocked(key)) {
      throw httpError('Too many login attempts. Wait a few minutes and try again.', 429);
    }

    const body = await readBody(request);
    const givenUsername = body?.username;
    const givenPassword = body?.password;
    const shapeIsValid =
      typeof givenUsername === 'string' &&
      typeof givenPassword === 'string' &&
      givenUsername.length > 0 &&
      givenUsername.length <= 80 &&
      givenPassword.length > 0 &&
      givenPassword.length <= 200;

    const matches =
      shapeIsValid &&
      secretsMatch(givenUsername, username) &&
      secretsMatch(givenPassword, password);

    if (!matches) {
      await delay(500);
      if (recordLoginFailure(key)) {
        throw httpError('Too many login attempts. Wait a few minutes and try again.', 429);
      }
      throw httpError('Incorrect username or password.', 401);
    }

    clearLoginFailures(key);
    const token = await createSessionToken(username);
    const response = jsonOk({ ok: true });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(request.headers.get('host')));
    return response;
  } catch (error) {
    return fail(error);
  }
}
